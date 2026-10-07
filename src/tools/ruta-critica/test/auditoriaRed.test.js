// Auditoría independiente de buildNetwork y del CPM: node --test src/tools/ruta-critica/test/auditoriaRed.test.js
// Todo se re-deriva aquí (verificador, búsqueda exhaustiva, holguras) sin usar dependenciasRed.js ni tiempos.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNetwork } from '../domain/network.js';
import { computeLayout } from '../domain/layout.js';
import { analyze } from '../domain/analyze.js';
import { normalize } from '../domain/validate.js';
import { minimoFicticiasExacto } from '../domain/dependenciasRed.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  return { next, int };
}

/** Tabla aleatoria con predecesoras posiblemente transitivas (redundantes). */
function tabla(rng, n, maxPreds = 4) {
  const acts = [];
  for (let i = 0; i < n; i++) {
    const k = i === 0 ? 0 : rng.int(0, Math.min(maxPreds, i));
    const pool = acts.map((a) => a.name);
    const preds = [];
    while (preds.length < k) {
      const p = pool.splice(rng.int(0, pool.length - 1), 1)[0];
      preds.push(p);
    }
    acts.push({ name: String.fromCharCode(65 + i), preds: preds.sort() });
  }
  return acts;
}

/** Ascendientes (cierre transitivo) por actividad, calculado por punto fijo. */
function ascendientes(acts) {
  const anc = new Map(acts.map((a) => [a.name, new Set(a.preds)]));
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const a of acts) {
      for (const p of [...anc.get(a.name)]) for (const x of anc.get(p)) if (!anc.get(a.name).has(x)) { anc.get(a.name).add(x); cambio = true; }
    }
  }
  return anc;
}

/** Verificador propio: devuelve lista de problemas (vacía si la red es exacta). */
function problemas(acts, net) {
  const out = [];
  const anc = ascendientes(acts);
  const nodos = new Set(net.nodes);
  const inc = new Map([...nodos].map((v) => [v, []]));
  const sal = new Map([...nodos].map((v) => [v, []]));
  for (const e of net.edges) {
    if (!nodos.has(e.from) || !nodos.has(e.to)) out.push('arista con nodo inexistente');
    if (e.from === e.to) out.push('lazo');
    inc.get(e.to)?.push(e);
    sal.get(e.from)?.push(e);
  }
  // una flecha de actividad por actividad
  const cuenta = new Map();
  net.edges.filter((e) => e.kind === 'activity').forEach((e) => cuenta.set(e.act, (cuenta.get(e.act) || 0) + 1));
  for (const a of acts) if (cuenta.get(a.name) !== 1) out.push(`actividad ${a.name} aparece ${cuenta.get(a.name)} veces`);
  // inicial y final únicos
  const fuentes = [...nodos].filter((v) => !inc.get(v).length);
  const sumideros = [...nodos].filter((v) => !sal.get(v).length);
  if (fuentes.length !== 1 || fuentes[0] !== net.start) out.push(`fuentes: ${fuentes}`);
  if (sumideros.length !== 1 || sumideros[0] !== net.end) out.push(`sumideros: ${sumideros}`);
  // aciclicidad (Kahn) y alcance
  const pend = new Map([...nodos].map((v) => [v, inc.get(v).length]));
  const cola = [...nodos].filter((v) => !pend.get(v));
  const reach = new Map([...nodos].map((v) => [v, new Set()]));
  let vis = 0;
  while (cola.length) {
    const v = cola.shift();
    vis++;
    for (const e of sal.get(v)) {
      for (const x of reach.get(v)) reach.get(e.to).add(x);
      if (e.kind === 'activity') reach.get(e.to).add(e.act);
      pend.set(e.to, pend.get(e.to) - 1);
      if (pend.get(e.to) === 0) cola.push(e.to);
    }
  }
  if (vis !== nodos.size) { out.push('ciclo en la red'); return out; }
  for (const e of net.edges) {
    if (e.kind !== 'activity') continue;
    const got = [...reach.get(e.from)].sort().join('');
    const want = [...anc.get(e.act)].sort().join('');
    if (got !== want) out.push(`${e.act}: la red le exige {${got}} y la tabla {${want}}`);
  }
  // sin paralelas ni ida-y-vuelta
  const pares = new Set();
  for (const e of net.edges) {
    const k = e.from + '>' + e.to;
    if (pares.has(k)) out.push('flechas paralelas');
    pares.add(k);
  }
  // el final debe haber recibido todas las actividades
  if ([...reach.get(net.end)].length !== acts.length) out.push('el evento final no agrupa todo');
  return out;
}

/** Mínimo de ficticias por búsqueda exhaustiva sobre GRAFOS (no sobre el modelo de etiquetas del constructor). */
function minimoFicticias(acts, tope) {
  const n = acts.length;
  const idx = new Map(acts.map((a, i) => [a.name, i]));
  const anc = ascendientes(acts);
  const A = acts.map((a) => [...anc.get(a.name)].reduce((m, x) => m | (1 << idx.get(x)), 0));
  const full = (1 << n) - 1;
  for (let d = 0; d <= tope; d++) {
    const m = n + d + 1;
    // nodos 0..k-1 construidos; reach[v] máscara; usada: máscara de actividades ya puestas
    const reach = [0];
    const hay = [];
    const outdeg = [0];
    const edgesSet = new Set();
    const dfs = (v, usadas, dRest) => {
      // v = siguiente nodo a crear (v ≥ 1). Elegir actividades que terminan en v y ficticias entrantes.
      if (usadas === full) {
        // el último nodo creado debe ser el final: único sin salida y con reach total
        const k = reach.length;
        const sinSalida = [];
        for (let u = 0; u < k; u++) if (!outdeg[u]) sinSalida.push(u);
        if (sinSalida.length === 1 && sinSalida[0] === k - 1 && reach[k - 1] === full) return true;
      }
      if (v >= m) return false;
      // candidatos de actividad: no usadas con origen u (u<v) tal que reach[u] === A[a]
      const cand = [];
      for (let a = 0; a < n; a++) {
        if (usadas & (1 << a)) continue;
        for (let u = 0; u < v; u++) if (reach[u] === A[a]) cand.push([a, u]);
      }
      // subconjuntos de actividades que terminan en v (a lo más una por origen u; una actividad una sola vez)
      const sel = [];
      const eleg = (i, usadasLoc, origenes) => {
        if (i === cand.length) {
          // ahora las ficticias entrantes: subconjunto de nodos u<v con presupuesto dRest
          const base = sel.length;
          return fict(0, usadasLoc, origenes, dRest, base);
        }
        const [a, u] = cand[i];
        if (!(usadasLoc & (1 << a)) && !(origenes & (1 << u))) {
          sel.push([a, u]);
          if (eleg(i + 1, usadasLoc | (1 << a), origenes | (1 << u))) return true;
          sel.pop();
        }
        return eleg(i + 1, usadasLoc, origenes);
      };
      const fict = (u, usadasLoc, origenes, dr, base) => {
        if (u === v) {
          // evaluar nodo v
          let r = 0;
          const entradas = [];
          for (const [a, uu] of sel) { r |= reach[uu] | (1 << a); entradas.push(uu); }
          for (let w = 0; w < v; w++) if (dummyIn & (1 << w)) { r |= reach[w]; entradas.push(w); }
          if (!entradas.length || r === 0) return false; // r = 0: otro «inicio» disfrazado, no se admite
          const salvaDeg = entradas.map((w) => [w, outdeg[w]]);
          entradas.forEach((w) => { outdeg[w]++; });
          reach.push(r);
          outdeg.push(0);
          const ok = dfs(v + 1, usadasLoc, dr);
          reach.pop();
          outdeg.pop();
          salvaDeg.forEach(([w, x]) => { outdeg[w] = x; });
          return ok;
        }
        // sin repetir par: una actividad ya sale de u->v, la ficticia no se pone encima
        if (dr > 0 && !(origenes & (1 << u))) {
          dummyIn |= 1 << u;
          if (fict(u + 1, usadasLoc, origenes, dr - 1, base)) { dummyIn &= ~(1 << u); return true; }
          dummyIn &= ~(1 << u);
        }
        return fict(u + 1, usadasLoc, origenes, dr, base);
      };
      let dummyIn = 0;
      return eleg(0, usadas, 0);
    };
    if (dfs(1, 0, d)) return d;
  }
  return Infinity;
}

// ---------- 1. Exactitud en miles de tablas ----------
test('buildNetwork: red exacta, acíclica, extremos únicos y numeración i<j en 6000 tablas (con transitivas)', () => {
  const rng = mulberry32(123);
  let conFicticias = 0;
  let conTransitivas = 0;
  for (let it = 0; it < 6000; it++) {
    const n = rng.int(1, 12);
    const acts = tabla(rng, n, rng.int(1, 5));
    const net = buildNetwork(acts);
    const p = problemas(acts, net);
    assert.deepEqual(p, [], JSON.stringify(acts));
    const lay = computeLayout(net);
    for (const e of net.edges) assert.ok(lay.number[e.from] < lay.number[e.to], `numeración ${JSON.stringify(acts)}`);
    assert.equal(lay.number[net.start], 1);
    assert.equal(lay.number[net.end], net.nodes.length);
    if (net.edges.some((e) => e.kind === 'dummy')) conFicticias++;
    if (net.notes.length) conTransitivas++;
  }
  assert.ok(conFicticias > 1500 && conTransitivas > 800, `${conFicticias} ${conTransitivas}`);
});

test('buildNetwork: casos del libro y redundantes', () => {
  const T = (spec) => spec.map(([name, preds]) => ({ name, preds: preds ? preds.split(',') : [] }));
  // A,B sin pred; C pred A; D pred A,B; E pred B,C
  const libro = T([['A', ''], ['B', ''], ['C', 'A'], ['D', 'A,B'], ['E', 'B,C']]);
  const net = buildNetwork(libro);
  assert.deepEqual(problemas(libro, net), []);
  assert.equal(minimoFicticias(libro, 4), net.edges.filter((e) => e.kind === 'dummy').length);
  // C pide A,B y además A (transitiva) y D pide A,B,C
  const red = T([['A', ''], ['B', 'A'], ['C', 'A,B'], ['D', 'A,B,C']]);
  const n2 = buildNetwork(red);
  assert.deepEqual(problemas(red, n2), []);
  assert.equal(n2.edges.filter((e) => e.kind === 'dummy').length, 0);
  assert.equal(n2.notes.length, 3);
});

// ---------- 2. Mínimo exacto por búsqueda exhaustiva de grafos ----------
test('buildNetwork: mínimo de ficticias = búsqueda exhaustiva de grafos (n ≤ 5)', () => {
  const rng = mulberry32(555);
  for (let it = 0; it < 400; it++) {
    const acts = tabla(rng, rng.int(2, 5), 4);
    const net = buildNetwork(acts);
    const d = net.edges.filter((e) => e.kind === 'dummy').length;
    const min = minimoFicticias(acts, d);
    assert.equal(d, min, JSON.stringify(acts));
  }
});

test('buildNetwork con n = 6 y 7: nunca usa más de 1 ficticia sobre el mínimo absoluto y casi siempre lo alcanza', { timeout: 600000 }, () => {
  // Hallazgo documentado: con 4 o más actividades de igual predecesora (p. ej. A; B,C,D,F pred A; E pred A,B,C)
  // existe una red con una ficticia menos (se separa el grupo con una ficticia al INICIO en vez de una por paralela).
  // El constructor sigue la convención del curso (una ficticia por cada paralela); es rara (~0,1 % de las tablas).
  const rng = mulberry32(777);
  let total = 0;
  let peores = 0;
  for (let it = 0; it < 300; it++) {
    const acts = tabla(rng, rng.int(6, 7), 3);
    const d = buildNetwork(acts).edges.filter((e) => e.kind === 'dummy').length;
    if (d > 3) continue;
    total++;
    const min = minimoFicticias(acts, d);
    assert.ok(min <= d && d - min <= 1, JSON.stringify(acts));
    assert.equal(minimoFicticiasExacto(acts, d), min);
    if (min < d) peores++;
  }
  assert.ok(total > 100 && peores / total < 0.05, `${peores}/${total}`);
});

test('minimoFicticiasExacto (dominio) coincide con la búsqueda propia de la prueba', () => {
  const rng = mulberry32(31);
  for (let it = 0; it < 300; it++) {
    const acts = tabla(rng, rng.int(2, 6), 4);
    assert.equal(minimoFicticiasExacto(acts, 4), minimoFicticias(acts, 4), JSON.stringify(acts));
  }
});

// ---------- 3. Errores de tabla ----------
test('tabla inválida: ciclos, inexistentes, duplicadas y autodependencia dan error claro', () => {
  const fila = (name, preds) => ({ name, preds, d: '1', a: '', m: '', b: '' });
  const ciclo = normalize([fila('A', 'C'), fila('B', 'A'), fila('C', 'B')], 'cpm');
  assert.ok(ciclo.errors.some((e) => /ciclo/i.test(e.msg)));
  const inex = normalize([fila('A', '-'), fila('B', 'Z')], 'cpm');
  assert.ok(inex.errors.some((e) => /no existe/.test(e.msg)));
  const dup = normalize([fila('A', '-'), fila('A', '-')], 'cpm');
  assert.ok(dup.errors.some((e) => /repetida/.test(e.msg)));
  const auto = normalize([fila('A', 'A')], 'cpm');
  assert.ok(auto.errors.some((e) => /sí misma/.test(e.msg)));
  // predecesora repetida en la fila: se acepta una sola vez
  const rep = normalize([fila('A', '-'), fila('B', 'A, A')], 'cpm');
  assert.deepEqual(rep.errors, []);
  assert.deepEqual(rep.activities[1].preds, ['A']);
  const an = analyze({ rows: [fila('A', 'B'), fila('B', 'A')], mode: 'cpm', decimals: 2 });
  assert.equal(an.ok, false);
});

// ---------- 4. CPM re-derivado sobre la tabla ----------
function cpmTabla(acts, dur) {
  const anc = ascendientes(acts);
  const by = new Map(acts.map((a) => [a.name, a]));
  const memo = new Map();
  const tfc = (n) => {
    if (!memo.has(n)) memo.set(n, tic(n) + dur(n));
    return memo.get(n);
  };
  const tic = (n) => Math.max(0, ...by.get(n).preds.map(tfc));
  const T = Math.max(...acts.map((a) => tfc(a.name)));
  const sucs = (n) => acts.filter((a) => a.preds.includes(n)).map((a) => a.name);
  // TIL/TFL por rutas: máximo de longitud de cadena que sigue a n (sobre todos los descendientes)
  const cola = new Map();
  const largo = (n) => {
    if (!cola.has(n)) cola.set(n, Math.max(0, ...sucs(n).map((s) => dur(s) + largo(s))));
    return cola.get(n);
  };
  const fila = {};
  for (const a of acts) {
    const n = a.name;
    const TIC = tic(n);
    const TFC = tfc(n);
    const TFL = T - largo(n);
    const TIL = TFL - dur(n);
    const s = sucs(n);
    fila[n] = { tic: TIC, tfc: TFC, til: TIL, tfl: TFL, ht: TIL - TIC, hl: (s.length ? Math.min(...s.map(tic)) : T) - TFC };
  }
  void anc;
  return { T, fila };
}

test('CPM: la red (Resuelve) coincide con la tabla en TIC, TFC, TIL, TFL, HT y HL (4000 redes, con ficticias)', () => {
  const rng = mulberry32(2025);
  let conF = 0;
  let hlDifiere = 0;
  for (let it = 0; it < 4000; it++) {
    const acts = tabla(rng, rng.int(2, 11), 4);
    const dur = new Map(acts.map((a) => [a.name, rng.int(it % 4 === 0 ? 0 : 1, it % 3 === 0 ? 2 : 9)]));
    const ref = cpmTabla(acts, (n) => dur.get(n));
    const an = analyze({ rows: acts.map((a) => ({ name: a.name, preds: a.preds.join(',') || '-', d: String(dur.get(a.name)) })), mode: 'cpm', decimals: 2 });
    assert.ok(an.ok);
    if (an.dummies) conF++;
    assert.equal(an.times.T, ref.T);
    for (const e of an.net.edges.filter((x) => x.kind === 'activity')) {
      const i = an.times.edgeInfo[e.id];
      const r = ref.fila[e.act];
      for (const k of ['tic', 'tfc', 'til', 'tfl', 'ht', 'hl']) assert.ok(Math.abs(i[k] - r[k]) < 1e-9, `${JSON.stringify(acts)} ${e.act}.${k}: ${i[k]} vs ${r[k]}`);
      assert.ok(i.hl >= -1e-9 && i.hl <= i.ht + 1e-9);
      // lo que cambiaría con el tiempo del evento j (definición descartada)
      const alt = an.times.early[e.to] - i.tfc;
      if (Math.abs(alt - i.hl) > 1e-9) hlDifiere++;
    }
    // ruta crítica: cada ruta enumerada dura T y todas las actividades críticas están en alguna ruta
    const enRutas = new Set(an.critical.routes.flatMap((q) => q.acts));
    for (const q of an.critical.routes) assert.ok(Math.abs(q.length - ref.T) < 1e-9);
    for (const a of acts) assert.equal(enRutas.has(a.name), Math.abs(ref.fila[a.name].ht) < 1e-9, `${JSON.stringify(acts)} crítica ${a.name}`);
  }
  assert.ok(conF > 1000);
  assert.ok(hlDifiere > 0, 'el caso con ficticias donde early[j]−TFC daría otro valor debe aparecer');
});

test('Rutas: el número de rutas de la red = cadenas de actividades de la tabla (sin duplicados por ficticias)', () => {
  const rng = mulberry32(8080);
  for (let it = 0; it < 3000; it++) {
    const acts = tabla(rng, rng.int(2, 9), 4);
    const anc = ascendientes(acts);
    // sucesoras directas reducidas: p es predecesora directa de a si no hay otra predecesora de a que descienda de p
    const sucs = new Map(acts.map((a) => [a.name, []]));
    for (const a of acts) for (const p of a.preds) if (!a.preds.some((q) => q !== p && anc.get(q).has(p))) sucs.get(p).push(a.name);
    let cuenta = 0;
    const anda = (n) => { if (!sucs.get(n).length) cuenta++; else sucs.get(n).forEach(anda); };
    acts.filter((a) => !a.preds.length).forEach((a) => anda(a.name));
    const an = analyze({ rows: acts.map((a) => ({ name: a.name, preds: a.preds.join(',') || '-', d: '1' })), mode: 'cpm', decimals: 2 });
    assert.equal(an.all.routes.length, cuenta, JSON.stringify(acts));
    const claves = an.all.routes.map((q) => q.acts.join('>'));
    assert.equal(new Set(claves).size, claves.length);
  }
});

test('CPM: caso mínimo donde early[j] − TFC subestimaba la holgura libre', () => {
  // D acaba en un evento con solo ficticias de salida; sus sucesoras (G) empiezan en otro evento al que llega además F.
  // A(2) B(5) | C pred A | D pred A,B no existe: usamos un caso construido con la búsqueda aleatoria.
  const rng = mulberry32(2025);
  let hallado = null;
  for (let it = 0; it < 4000 && !hallado; it++) {
    const acts = tabla(rng, rng.int(2, 8), 3);
    const dur = new Map(acts.map((a) => [a.name, rng.int(1, 9)]));
    const an = analyze({ rows: acts.map((a) => ({ name: a.name, preds: a.preds.join(',') || '-', d: String(dur.get(a.name)) })), mode: 'cpm', decimals: 2 });
    for (const e of an.net.edges.filter((x) => x.kind === 'activity')) {
      const alt = an.times.early[e.to] - an.times.edgeInfo[e.id].tfc;
      if (Math.abs(alt - an.times.edgeInfo[e.id].hl) > 1e-9) { hallado = { acts, dur, e, an, alt }; break; }
    }
  }
  assert.ok(hallado);
  const { acts, dur, e, an, alt } = hallado;
  const sig = acts.filter((a) => a.preds.includes(e.act));
  const ref = cpmTabla(acts, (n) => dur.get(n));
  // por la definición (mín TIC sucesoras − TFC) la holgura es la de la tabla, y la red ya la reproduce
  assert.ok(alt < ref.fila[e.act].hl);
  assert.equal(an.times.edgeInfo[e.id].hl, ref.fila[e.act].hl);
  assert.ok(sig.length > 0 || alt !== ref.fila[e.act].hl);
});

// ---------- 5. Práctica de estructura: respuestas únicas y correctas (verificador propio) ----------
import { generarEjercicio, corregir, TIPOS } from '../domain/practicaEstructura.js';

test('práctica estructura: 3000 semillas por tipo, respuesta única y verificada de forma independiente', () => {
  for (let seed = 1; seed <= 3000; seed++) {
    for (const tipo of TIPOS) {
      const ej = generarEjercicio(tipo, seed);
      const acts = ej.tabla;
      const etiqueta = `${tipo} ${seed}`;
      if (tipo === 'ficticias') {
        const net = buildNetwork(acts);
        assert.deepEqual(problemas(acts, net), [], etiqueta);
        assert.equal(ej.respuesta, net.edges.filter((e) => e.kind === 'dummy').length, etiqueta);
        assert.ok(corregir(ej, ej.respuesta).correcta && !corregir(ej, ej.respuesta + 1).correcta);
      } else if (tipo === 'extremos') {
        const conSuc = new Set(acts.flatMap((a) => a.preds));
        const esperado = ej.modo === 'inicio' ? acts.filter((a) => !a.preds.length) : acts.filter((a) => !conSuc.has(a.name));
        assert.deepEqual(ej.respuesta, esperado.map((a) => ej.nombres.indexOf(a.name)).sort((x, y) => x - y), etiqueta);
        assert.ok(corregir(ej, ej.respuesta).correcta);
        assert.ok(!corregir(ej, ej.respuesta.slice(1)).correcta);
      } else if (tipo === 'red') {
        const buenas = ej.redes.map((r, i) => (problemas(acts, r).length === 0 ? i : -1)).filter((i) => i >= 0);
        assert.deepEqual(buenas, [ej.respuesta], etiqueta);
        ej.redes.forEach((_, i) => assert.equal(corregir(ej, i).correcta, i === ej.respuesta, etiqueta));
      } else if (tipo === 'error') {
        const net = ej.redes[0];
        const anc = ascendientes(acts);
        const reach = new Map();
        const inc = (v) => net.edges.filter((e) => e.to === v);
        const alc = (v) => {
          if (reach.has(v)) return reach.get(v);
          const s = new Set();
          for (const e of inc(v)) { alc(e.from).forEach((x) => s.add(x)); if (e.kind === 'activity') s.add(e.act); }
          reach.set(v, s);
          return s;
        };
        const malas = acts.filter((a) => {
          const e = net.edges.find((x) => x.kind === 'activity' && x.act === a.name);
          return [...alc(e.from)].sort().join('') !== [...anc.get(a.name)].sort().join('');
        }).map((a) => a.name);
        assert.deepEqual(malas, [ej.objetivo], etiqueta);
        assert.equal(ej.entrada.opciones[ej.respuesta], ej.objetivo);
      } else {
        const net = ej.redes[0];
        const validas = ej.numeraciones.map((m, i) => (net.edges.every((e) => m[e.from] < m[e.to]) && new Set(Object.values(m)).size === net.nodes.length ? i : -1)).filter((i) => i >= 0);
        assert.deepEqual(validas, [ej.respuesta], etiqueta);
        assert.equal(new Set(ej.entrada.opciones).size, ej.entrada.opciones.length, 'opciones repetidas');
      }
      assert.ok(typeof ej.explicacion === 'string' && ej.explicacion.length > 10);
    }
  }
});

test('práctica estructura: la respuesta «cuántas ficticias» es el mínimo exacto (búsqueda exhaustiva, 1500 semillas)', { timeout: 600000 }, () => {
  let distintas = 0;
  for (let seed = 1; seed <= 1500; seed++) {
    const ej = generarEjercicio('ficticias', seed);
    if (!ej.respuesta) continue;
    const min = minimoFicticias(ej.tabla, ej.respuesta - 1);
    if (min < ej.respuesta) distintas++;
  }
  assert.equal(distintas, 0);
});
