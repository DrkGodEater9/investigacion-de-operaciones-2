// Pruebas del dominio de tiempos (3.2): normal, tiempos sobre la tabla, pasos y red del dibujo.
// Se comparan contra cálculos independientes: integración numérica, enumeración de todas las rutas y analyze().
import test from 'node:test';
import assert from 'node:assert/strict';
import { erf, erfc, phi } from '../domain/normal.js';
import { calcularTiempos, calcularPERT, tiempoEsperado, varianzaAct } from '../domain/tiempos.js';
import { analyze } from '../domain/analyze.js';
import { pasosTiempo } from '../domain/pasosTiempo.js';
import { EJEMPLOS_TIEMPO } from '../domain/ejemplosTiempo.js';
import { mulberry32 } from '../domain/practicaTiempo.js';
import { fmt } from '../domain/format.js';

const cerca = (a, b, t = 1e-9) => Math.abs(a - b) <= t;

// ── Normal ─────────────────────────────────────────────────────────────
function phiSimpson(z) {
  // ∫ de −12 a z de la densidad, regla de Simpson con 200 000 tramos
  const lo = -12;
  const n = 200000;
  const h = (z - lo) / n;
  const g = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  let s = g(lo) + g(z);
  for (let i = 1; i < n; i++) s += g(lo + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

test('normal: valores de referencia conocidos', () => {
  const ref = [
    [0, 0.5], [1, 0.8413447460685429], [-1, 0.15865525393145707], [1.96, 0.9750021048517795], [2, 0.9772498680518208],
    [3, 0.9986501019683699], [-3, 0.0013498980316300946], [-6, 9.865876450376946e-10], [1.2247448713915892, 0.8897], [2.5, 0.9937903346742238],
  ];
  for (const [z, p] of ref) assert.ok(cerca(phi(z), p, z === 1.2247448713915892 ? 1e-4 : 1e-13), `Φ(${z}) = ${phi(z)} y debía ser ${p}`);
  assert.equal(phi(Infinity), 1);
  assert.equal(phi(-Infinity), 0);
  assert.ok(cerca(erf(0.5), 0.5204998778130465, 1e-14));
  assert.ok(cerca(erfc(4), 1.541725790028002e-8, 1e-20));
});

test('normal: coincide con integración numérica y es continua en el empalme (|x| = 3)', () => {
  for (let z = -5; z <= 5; z += 0.25) assert.ok(cerca(phi(z), phiSimpson(z), 1e-9), `z = ${z}`);
  const c = 3 * Math.SQRT2; // empalme de la serie y la fracción continua
  for (const z of [-c - 1e-9, -c + 1e-9]) assert.ok(cerca(phi(z), phiSimpson(z), 1e-9));
  let ant = 0;
  for (let z = -8; z <= 8; z += 0.01) { const p = phi(z); assert.ok(p >= ant - 1e-15 && p >= 0 && p <= 1); ant = p; }
  for (let z = -6; z <= 6; z += 0.37) assert.ok(cerca(phi(z) + phi(-z), 1, 1e-14));
});

// ── Cálculo independiente: enumeración de todas las rutas ────────────────
// Rutas de la tabla: cadenas de actividades; para cada actividad se calcula la ruta más larga que pasa por ella.
function porRutas(acts, dur) {
  const nombres = acts.map((a) => a.name);
  const sucs = Object.fromEntries(nombres.map((n) => [n, []]));
  acts.forEach((a) => a.preds.forEach((p) => sucs[p].push(a.name)));
  const rutas = [];
  const camino = [];
  const anda = (n) => {
    camino.push(n);
    if (!sucs[n].length) rutas.push([...camino]);
    else sucs[n].forEach(anda);
    camino.pop();
  };
  acts.filter((a) => !a.preds.length).forEach((a) => anda(a.name));
  const largo = (r) => r.reduce((s, n) => s + dur(n), 0);
  const T = Math.max(...rutas.map(largo));
  const out = { T, fila: {}, rutasCriticas: rutas.filter((r) => cerca(largo(r), T)) };
  for (const n of nombres) {
    let masLarga = -Infinity;
    let antes = 0; // largo de lo que va antes de n en la mejor ruta
    let despues = 0;
    for (const r of rutas) {
      const i = r.indexOf(n);
      if (i < 0) continue;
      const L = largo(r);
      if (L > masLarga + 1e-12) { masLarga = L; antes = largo(r.slice(0, i)); despues = largo(r.slice(i + 1)); }
    }
    out.fila[n] = { tic: antes, tfc: antes + dur(n), tfl: T - despues, til: T - despues - dur(n), ht: T - masLarga };
  }
  // El TIC real es el mayor «antes» entre todas las rutas que pasan por n (no solo la de la ruta más larga).
  for (const n of nombres) {
    let tic = 0;
    for (const r of rutas) { const i = r.indexOf(n); if (i >= 0) tic = Math.max(tic, largo(r.slice(0, i))); }
    let tras = 0;
    for (const r of rutas) { const i = r.indexOf(n); if (i >= 0) tras = Math.max(tras, largo(r.slice(i + 1))); }
    out.fila[n] = { tic, tfc: tic + dur(n), tfl: T - tras, til: T - tras - dur(n), ht: T - tras - dur(n) - tic };
  }
  return out;
}

function redAzar(rng, { maxN = 11, durMax = 4, redundantes = true } = {}) {
  const n = rng.int(2, maxN);
  const names = Array.from({ length: n }, (_, i) => (i < 26 ? String.fromCharCode(65 + i) : `X${i}`));
  return names.map((name, i) => {
    const preds = [];
    if (i > 0 && rng.next() < 0.8) {
      const k = rng.int(1, Math.min(3, i));
      while (preds.length < k) { const p = names[rng.int(0, i - 1)]; if (!preds.includes(p)) preds.push(p); }
    }
    return { name, preds, d: rng.int(1, durMax) };
  });
}
const aFilas = (acts) => acts.map((a) => ({ name: a.name, preds: a.preds.join(',') || '-', d: String(a.d), a: '', m: '', b: '' }));
const durDe = (acts) => { const m = new Map(acts.map((a) => [a.name, a.d])); return (n) => m.get(n); };

test('tiempos: coinciden con la enumeración de rutas en miles de redes aleatorias (con empates)', () => {
  let conVarias = 0;
  for (let seed = 1; seed <= 3000; seed++) {
    const rng = mulberry32(seed);
    const acts = redAzar(rng, { durMax: seed % 3 === 0 ? 2 : 6 });
    const dur = durDe(acts);
    const r = calcularTiempos(acts, dur);
    const ref = porRutas(acts, dur);
    assert.ok(cerca(r.T, ref.T), `seed ${seed}: T`);
    for (const a of acts) {
      const x = r.fila[a.name];
      const y = ref.fila[a.name];
      for (const k of ['tic', 'tfc', 'til', 'tfl', 'ht']) assert.ok(cerca(x[k], y[k]), `seed ${seed} ${a.name}.${k}: ${x[k]} vs ${y[k]}`);
      // holgura libre por definición: lo que se puede atrasar sin mover a las sucesoras
      const sig = acts.filter((s) => s.preds.includes(a.name));
      const hl = (sig.length ? Math.min(...sig.map((s) => r.fila[s.name].tic)) : r.T) - x.tfc;
      assert.ok(cerca(x.hl, hl));
      assert.ok(x.hl >= -1e-9 && x.hl <= x.ht + 1e-9, `seed ${seed}: 0 ≤ HL ≤ HT`);
      assert.equal(x.critica, cerca(y.ht, 0));
    }
    const clave = (rs) => rs.map((q) => q.join('>')).sort().join('|');
    assert.equal(clave(r.rutasCriticas), clave(ref.rutasCriticas), `seed ${seed}: rutas críticas`);
    if (r.rutasCriticas.length > 1) conVarias++;
    // toda ruta crítica dura T
    r.rutasCriticas.forEach((q) => assert.ok(cerca(q.reduce((s, n) => s + dur(n), 0), r.T)));
  }
  assert.ok(conVarias > 300, `se probaron pocas redes con varias rutas críticas (${conVarias})`);
});

test('tiempos: coinciden con la red de flechas de analyze() (TIC, TFC, TIL, TFL, holguras, rutas críticas)', () => {
  let conFicticias = 0;
  let difHL = 0;
  for (let seed = 1; seed <= 1500; seed++) {
    const rng = mulberry32(seed + 77000);
    const acts = redAzar(rng, { maxN: 10, durMax: 5 });
    const r = calcularTiempos(acts, durDe(acts));
    const an = analyze({ rows: aFilas(acts), mode: 'cpm', decimals: 2 });
    assert.ok(an.ok, `seed ${seed}: analyze falló`);
    if (an.dummies) conFicticias++;
    assert.ok(cerca(an.times.T, r.T));
    for (const e of an.net.edges.filter((x) => x.kind === 'activity')) {
      const i = an.times.edgeInfo[e.id];
      const x = r.fila[e.act];
      for (const k of ['tic', 'tfc', 'til', 'tfl', 'ht']) assert.ok(cerca(i[k], x[k]), `seed ${seed} ${e.act}.${k}: red ${i[k]} tabla ${x[k]}`);
      // Holgura libre: la de la red (tiempo del evento j − TFC) nunca supera a la definición por sucesoras;
      // son iguales si la red no tiene ficticias. Con ficticias la red puede dar menos (hallazgo avisado).
      assert.ok(i.hl <= x.hl + 1e-9, `seed ${seed} ${e.act}: HL de la red mayor que la de la tabla`);
      if (!an.dummies) assert.ok(cerca(i.hl, x.hl), `seed ${seed} ${e.act}.hl sin ficticias`);
      else if (!cerca(i.hl, x.hl)) difHL++;
    }
    const clave = (rs) => rs.map((q) => q.join('>')).sort().join('|');
    assert.equal(clave(an.critical.routes.map((q) => q.acts)), clave(r.rutasCriticas), `seed ${seed}: rutas críticas`);
  }
  assert.ok(conFicticias > 200, `pocas redes con ficticias (${conFicticias})`);
  assert.ok(difHL >= 0);
});

test('PERT: te, varianza, ruta de mayor varianza y sumas coinciden con un cálculo en sextos (enteros)', () => {
  for (let seed = 1; seed <= 1500; seed++) {
    const rng = mulberry32(seed + 5000);
    const base = redAzar(rng, { maxN: 9 });
    const acts = base.map((x) => { const a = rng.int(1, 8); const m = a + rng.int(0, 5); const b = m + rng.int(0, 7); return { name: x.name, preds: x.preds, a, m, b }; });
    const r = calcularPERT(acts);
    // te en sextos: 6·te = a + 4m + b es entero; las comparaciones de empates se hacen en enteros
    const t6 = new Map(acts.map((a) => [a.name, a.a + 4 * a.m + a.b]));
    const ref = porRutas(acts, (n) => t6.get(n));
    assert.ok(cerca(r.T * 6, ref.T, 1e-7), `seed ${seed}: Te`);
    const clave = (rs) => rs.map((q) => q.join('>')).sort().join('|');
    assert.equal(clave(r.rutasCriticas), clave(ref.rutasCriticas), `seed ${seed}: rutas críticas PERT`);
    // varianza de cada ruta crítica en 36avos: (b − a)² es entero
    const v36 = (rt) => rt.reduce((s, n) => { const a = acts.find((x) => x.name === n); return s + (a.b - a.a) ** 2; }, 0);
    const mejor = Math.max(...ref.rutasCriticas.map(v36));
    assert.ok(cerca(r.varianza * 36, mejor, 1e-7), `seed ${seed}: varianza`);
    assert.ok(cerca(r.sd * r.sd, r.varianza, 1e-12));
    assert.equal(r.unicaRuta, ref.rutasCriticas.length === 1);
    for (const a of acts) {
      assert.ok(cerca(r.por.get(a.name).te, tiempoEsperado(a.a, a.m, a.b)));
      assert.ok(cerca(r.por.get(a.name).v, varianzaAct(a.a, a.b)));
    }
  }
});

test('PERT: ejemplo a mano (Te = 10, σ² = 8/3, P(T ≤ 12) = 0,8897)', () => {
  const ej = EJEMPLOS_TIEMPO.find((e) => e.id === 'pert');
  const p = pasosTiempo(ej);
  assert.ok(p.ok);
  assert.ok(cerca(p.res.Te, 10));
  assert.ok(cerca(p.res.varianza, 16 / 36 + 16 / 36 + 64 / 36));
  assert.deepEqual(p.res.ruta, ['A', 'C', 'F']);
  const ult = p.pasos.at(-1).estado.campana;
  assert.ok(cerca(ult.p, 0.8897, 1e-4));
  assert.ok(cerca(ult.z, 2 / Math.sqrt(8 / 3)));
});

// ── Pasos ───────────────────────────────────────────────────────────────
function revisarPasos(rows, modo, etiqueta) {
  const p = pasosTiempo({ rows, modo, plazo: modo === 'pert' ? 20 : null });
  assert.ok(p.ok, `${etiqueta}: no construyó`);
  const { analysis: an, pasos, res } = p;
  const n = res.orden.length;
  const nNum = (x) => fmt(x, 2).replace('-', '−');
  // número de pasos: inicio + n adelante + duración + n atrás + n holguras + crítica (+ PERT)
  const pert = modo === 'pert';
  assert.equal(pasos.length, 1 + n + 1 + n + n + 1 + (pert ? n + 2 + (res.opciones.length > 1 ? 1 : 0) : 0), `${etiqueta}: número de pasos`);
  const evEarly = an.times.early;
  const evLate = an.times.late;
  let prevE = 0;
  let prevL = 0;
  for (const s of pasos) {
    const st = s.estado;
    assert.ok(st.early.length >= prevE, `${etiqueta}: los eventos tempranos solo se agregan`);
    prevE = st.early.length;
    assert.ok(st.late.length >= prevL);
    prevL = st.late.length;
    if (s.fase === 'adelante') {
      const x = res.fila[st.actual];
      assert.ok(s.calculo[0].includes(`= ${nNum(x.tic)}`), `${etiqueta}: ${s.calculo[0]}`);
      assert.ok(s.calculo[1].endsWith(`= ${nNum(x.tfc)}`), `${etiqueta}: ${s.calculo[1]}`);
      assert.ok(st.cols.tic.includes(st.actual));
    }
    if (s.fase === 'atras') {
      const x = res.fila[st.actual];
      assert.ok(s.calculo[0].endsWith(`= ${nNum(x.tfl)}`), `${etiqueta}: ${s.calculo[0]}`);
      assert.ok(s.calculo[1].endsWith(`= ${nNum(x.til)}`));
    }
    if (s.fase === 'holguras') {
      const x = res.fila[st.actual];
      assert.ok(s.calculo[0].endsWith(`= ${nNum(x.ht)}`) && s.calculo[1].endsWith(`= ${nNum(x.hl)}`), `${etiqueta}: ${s.calculo.join(' | ')}`);
    }
    // todo evento ya visible tiene su tiempo definido y el paso no muestra NaN
    st.early.forEach((v) => assert.ok(Number.isFinite(evEarly[v])));
    st.late.forEach((v) => assert.ok(Number.isFinite(evLate[v])));
    for (const t of [s.titulo, s.texto, ...s.calculo]) assert.ok(!/NaN|undefined|Infinity/.test(t), `${etiqueta}: texto con ${t}`);
  }
  // tras el pase hacia adelante se conocen todos los eventos tempranos; tras el de atrás, todos los tardíos
  const ult = pasos.findLast((s) => s.fase === 'adelante').estado;
  assert.equal(ult.early.length, an.net.nodes.length, `${etiqueta}: faltan eventos tempranos`);
  const ultB = pasos.findLast((s) => s.fase === 'atras').estado;
  assert.equal(ultB.late.length, an.net.nodes.length, `${etiqueta}: faltan eventos tardíos`);
  const crit = pasos.find((s) => s.fase === 'critica');
  assert.ok(crit.estado.rutas.length >= 1);
  assert.equal(pasos.filter((s) => s.fase === 'duracion').length, 1);
  return p;
}

test('pasos: los tres ejemplos de la pestaña', () => {
  for (const e of EJEMPLOS_TIEMPO) revisarPasos(e.rows, e.modo, e.id);
  const cpm2 = pasosTiempo(EJEMPLOS_TIEMPO.find((e) => e.id === 'cpm2'));
  assert.deepEqual(cpm2.res.rutasCriticas.map((r) => r.join('')).sort(), ['ACF', 'BDF']);
  const cpm = pasosTiempo(EJEMPLOS_TIEMPO.find((e) => e.id === 'cpm'));
  assert.equal(cpm.res.T, 10);
  assert.deepEqual(cpm.res.rutasCriticas, [['A', 'C', 'F']]);
  assert.equal(cpm.res.fila.B.ht, 1);
  assert.equal(cpm.res.fila.B.hl, 0);
});

test('pasos: redes aleatorias CPM y PERT (con ficticias, varias rutas críticas y empates)', () => {
  for (let seed = 1; seed <= 400; seed++) {
    const rng = mulberry32(seed + 31000);
    const acts = redAzar(rng, { maxN: 9, durMax: 4 });
    revisarPasos(aFilas(acts), 'cpm', `cpm ${seed}`);
    const pertRows = acts.map((a) => { const x = rng.int(1, 5); const m = x + rng.int(0, 3); return { name: a.name, preds: a.preds.join(',') || '-', d: '', a: String(x), m: String(m), b: String(m + rng.int(0, 4)) }; });
    revisarPasos(pertRows, 'pert', `pert ${seed}`);
  }
});

test('pasos: errores de la tabla se devuelven sin lanzar excepción', () => {
  const r = pasosTiempo({ rows: [{ name: 'A', preds: 'Z', d: '3', a: '', m: '', b: '' }], modo: 'cpm' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length > 0);
});
