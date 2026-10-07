/**
 * Auditoría adversarial del tema 3.3 (PERT/COSTO). Todo se re-deriva por otro camino:
 *  - óptimo exacto por enumeración de TODAS las duraciones enteras (código propio, sin tiempos() ni resolver()),
 *  - método «clásico» (acortar el conjunto de menor costo que corta todas las rutas críticas, sin devolver tiempo) propio.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, armarModelo } from '../domain/modelo.js';
import { resolver } from '../domain/reducir.js';
import { analizar, resumen, tablaActividades } from '../domain/analizar.js';
import { explicarPasos } from '../domain/pasos.js';
import { leerTexto, aMarkdown } from '../domain/entrada.js';
import { EJEMPLOS } from '../domain/ejemplos.js';
import { TIPOS, generarEjercicio, corregir, respuestaCorrecta, solucionDe } from '../domain/generador.js';
import { mulberry32, redAleatoria, puenteAleatorio } from './utils.mjs';

const cerca = (a, b, msg, tol = 1e-7) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${msg}: ${a} ≠ ${b}`);
const N = 'ABCDEFGHIJKLMNOP';
const coma = (x) => String(x).replace('.', ',');

/* ---------- referencia independiente ---------- */

function aNumeros(filas) {
  const names = filas.map((f) => f.name);
  return {
    n: filas.length,
    names,
    preds: filas.map((f) => String(f.preds).split(',').map((s) => s.trim()).filter((s) => s && s !== '-').map((p) => names.indexOf(p))),
    dn: filas.map((f) => Number(f.dn)),
    dl: filas.map((f) => (f.dl === '' ? Number(f.dn) : Number(f.dl))),
    cn: filas.map((f) => Number(f.cn)),
    cl: filas.map((f) => (f.cl === '' ? Number(f.cn) : Number(f.cl))),
  };
}
const pendRef = (r, j) => (r.dn[j] > r.dl[j] ? (r.cl[j] - r.cn[j]) / (r.dn[j] - r.dl[j]) : 0);

function finales(r, d) {
  const ef = [];
  const calc = (j) => {
    if (ef[j] === undefined) ef[j] = d[j] + Math.max(0, ...r.preds[j].map(calc));
    return ef[j];
  };
  for (let j = 0; j < r.n; j++) calc(j);
  return ef;
}

/** Mapa T → costo directo mínimo con duración EXACTA T (todas las combinaciones enteras). */
function curvaExacta(r) {
  const mejor = new Map();
  const d = new Array(r.n).fill(0);
  const rec = (j, c) => {
    if (j === r.n) {
      const T = Math.max(...finales(r, d));
      if (!mejor.has(T) || c < mejor.get(T)) mejor.set(T, c);
      return;
    }
    for (let x = r.dl[j]; x <= r.dn[j]; x++) { d[j] = x; rec(j + 1, c + r.cn[j] + pendRef(r, j) * (r.dn[j] - x)); }
  };
  rec(0, 0);
  return mejor;
}

/** Método clásico del curso, escrito aparte: cada unidad se acorta el conjunto de menor costo que corta todas las rutas críticas. */
function clasico(r, desempate) {
  const d = r.dn.slice();
  let costo = r.cn.reduce((a, b) => a + b, 0);
  const salida = new Map();
  for (;;) {
    const ef = finales(r, d);
    const T = Math.max(...ef);
    salida.set(T, costo);
    const caminos = [];
    const atras = (j, acc) => {
      const acc2 = [...acc, j];
      if (ef[j] - d[j] === 0) caminos.push(acc2);
      for (const i of r.preds[j]) if (ef[i] === ef[j] - d[j]) atras(i, acc2);
    };
    for (let j = 0; j < r.n; j++) if (ef[j] === T) atras(j, []);
    const criticas = new Set(caminos.flat());
    const red = [...criticas].filter((j) => r.dn[j] > r.dl[j] && d[j] > r.dl[j]);
    const cand = [];
    for (let mask = 1; mask < 2 ** red.length; mask++) {
      const set = red.filter((_, k) => (mask >> k) & 1);
      if (caminos.every((c) => c.some((j) => set.includes(j)))) cand.push({ set, c: set.reduce((s, j) => s + pendRef(r, j), 0) });
    }
    if (!cand.length) break;
    const mn = Math.min(...cand.map((x) => x.c));
    const empatados = cand.filter((x) => Math.abs(x.c - mn) < 1e-9);
    const el = desempate(empatados);
    el.set.forEach((j) => { d[j] -= 1; });
    costo += el.c;
  }
  return salida;
}

function modelo(filas, ci, fijo = 0) {
  const nor = normalizar(filas, { ci: String(ci), fijo: String(fijo) });
  assert.deepEqual(nor.errores, [], 'red válida');
  return armarModelo(nor.actividades, { ci: nor.ci, fijo: nor.fijo });
}

/** Red aleatoria más agresiva que la de utils: duración normal 0, DN = DL, costos decimales, pendientes iguales. */
function redRara(rng) {
  const n = rng.int(2, 7);
  const pp = rng.pick([0.1, 0.3, 0.55]);
  const filas = [];
  for (let j = 0; j < n; j++) {
    const preds = [];
    for (let i = 0; i < j; i++) if (rng.next() < pp) preds.push(N[i]);
    const dn = rng.int(0, 5);
    const fija = dn === 0 || rng.next() < 0.2;
    const dl = fija ? dn : Math.max(0, dn - rng.int(1, 3));
    const cn = rng.pick([0, 1, 2, 10, 33.5]);
    const extra = rng.pick([0, 1, 2, 3, 5, 7.25, 40]);
    filas.push({ name: N[j], preds: preds.join(','), dn: String(dn), dl: String(dl), cn: String(cn), cl: String(fija ? cn : cn + extra) });
  }
  return filas;
}

const FUENTES = [
  (rng) => redRara(rng),
  (rng) => redAleatoria(rng, { nMin: 3, nMax: 7, maxRed: 3, costos: 'chicos', pPred: 0.15 }), // paralelas, empates
  (rng) => puenteAleatorio(rng, rng.next() < 0.5), // puente
  (rng) => redAleatoria(rng, { nMin: 3, nMax: 8, maxRed: 2, pPred: 0.4 }),
];

/* ---------- 1-2: óptimo, curva, total con indirecto y fijo ---------- */

test('curva, costo total, duración óptima y empates coinciden con la enumeración exacta (indirecto 0, chico, grande; con y sin fijo)', () => {
  const CIS = [0, 0.5, 3, 25, 1000];
  let redes = 0;
  for (let s = 1; s <= 2400; s++) {
    const rng = mulberry32(s * 31 + 7);
    const filas = FUENTES[s % FUENTES.length](rng);
    const ci = CIS[s % CIS.length];
    const fijo = s % 4 === 0 ? 17.5 : 0;
    const r = aNumeros(filas);
    const m = modelo(filas, ci, fijo);
    const res = resolver(m, { verificar: true });
    const ex = curvaExacta(r);
    const Ts = [...ex.keys()];
    assert.equal(res.T0, Math.max(...Ts), `T normal s=${s}`);
    assert.equal(res.Tmin, Math.min(...Ts), `T mínimo (crash) s=${s}`);
    assert.equal(res.estados.length, res.T0 - res.Tmin + 1, 'curva sin huecos');
    for (let T = res.Tmin; T <= res.T0; T++) {
      assert.ok(ex.has(T), `T=${T} debe poder lograrse s=${s}`);
      const e = res.estadoEn(T);
      assert.equal(e.T, T);
      cerca(e.directo, ex.get(T), `directo T=${T} s=${s}`);
      cerca(e.indirecto, ci * T + fijo, `indirecto s=${s}`);
      cerca(e.total, ex.get(T) + ci * T + fijo, `total s=${s}`);
      assert.equal(Math.max(...finales(r, e.d)), T, `las duraciones del estado dan T s=${s}`);
      e.d.forEach((x, j) => assert.ok(x >= r.dl[j] && x <= r.dn[j] && Number.isInteger(x)));
    }
    let mejor = Infinity;
    for (const T of Ts) mejor = Math.min(mejor, ex.get(T) + ci * T + fijo);
    const emp = Ts.filter((T) => ex.get(T) + ci * T + fijo <= mejor + 1e-9 * Math.max(1, mejor)).sort((a, b) => b - a);
    cerca(res.optimo.total, mejor, `total óptimo s=${s}`);
    assert.deepEqual(res.optimo.empates.slice().sort((a, b) => b - a), emp, `empates s=${s}`);
    assert.equal(res.optimo.T, emp[0], `con empate se informa la duración más larga s=${s}`);
    redes++;
  }
  assert.equal(redes, 2400);
});

test('costo fijo no cambia la duración óptima, solo suma una constante', () => {
  for (let s = 1; s <= 200; s++) {
    const filas = redRara(mulberry32(s + 99000));
    const a = resolver(modelo(filas, 4, 0));
    const b = resolver(modelo(filas, 4, 123.5));
    assert.equal(a.optimo.T, b.optimo.T);
    cerca(b.optimo.total, a.optimo.total + 123.5, 'total + fijo');
  }
});

/* ---------- 1b: método clásico vs. óptimo ---------- */

test('método clásico (solo acortar, un corte por unidad): nunca mejora al óptimo y solo lo supera cuando la herramienta usa un alargue', () => {
  let peores = 0;
  let total = 0;
  for (let s = 1; s <= 3000; s++) {
    const rng = mulberry32(s * 13 + 5);
    const filas = s % 3 === 0 ? puenteAleatorio(rng, s % 2 === 0) : redAleatoria(rng, { nMin: 3, nMax: 8, pPred: 0.3 });
    const res = resolver(modelo(filas, 5));
    const conAlargue = res.pasos.some((p) => p.tipo === 'con-alargue');
    for (const desempate of [(t) => t[0], (t) => t[t.length - 1]]) {
      const k = clasico(aNumeros(filas), desempate);
      let peor = false;
      for (const [T, c] of k) {
        const o = res.estadoEn(T).directo;
        assert.ok(c >= o - 1e-7, `el clásico no puede ser mejor que el óptimo (s=${s}, T=${T}: ${c} < ${o})`);
        if (c > o + 1e-7) peor = true;
      }
      total++;
      if (peor) {
        peores++;
        assert.ok(conAlargue, `s=${s}: el clásico da más caro pero la herramienta no lo explica con un paso «con alargue»`);
      }
    }
  }
  assert.ok(peores > 20, `debe haber redes donde el clásico falla (${peores}/${total})`);
});

test('en el ejemplo «Con alargue» el paso a paso avisa que solo acortar sale más caro, con el número correcto', () => {
  const e = EJEMPLOS.find((x) => x.id === 'puente');
  const a = analizar({ filas: e.filas, ci: e.ci, fijo: e.fijo });
  const p = a.pasos.find((x) => /Reducción 4/.test(x.titulo));
  assert.match(p.texto, /Si solo se acortara \(sin devolver tiempo\), lo más barato desde aquí sería D y E \(85 por unidad\)/);
  const k = clasico(aNumeros(e.filas.map((f) => ({ ...f }))), (t) => t[0]);
  const optimo = a.res.estadoEn(11).directo;
  assert.equal(optimo, 870);
  assert.ok(k.get(11) > optimo, `clásico ${k.get(11)} debería superar 870`);
});

/* ---------- 3: pendiente y casos DN = DL, CL < CN ---------- */

test('pendiente: DN=DL, CL=CN (pendiente 0), CL<CN (error), decimales', () => {
  const base = { name: 'A', preds: '', dn: '4', dl: '2', cn: '10', cl: '10' };
  const m0 = modelo([base], 3);
  assert.equal(m0.pend[0], 0);
  const r0 = resolver(m0);
  assert.equal(r0.optimo.T, 2); // acortar es gratis
  assert.equal(r0.pasos[0].pendiente, 0);
  assert.equal(r0.pasos[0].conviene, true);
  const fija = normalizar([{ ...base, dl: '4', cl: '99' }], { ci: '1' });
  assert.deepEqual(fija.errores, []);
  assert.equal(armarModelo(fija.actividades, {}).pend[0], null);
  assert.match(normalizar([{ ...base, cl: '9' }], { ci: '1' }).errores[0].msg, /no puede ser menor/);
  const dec = modelo([{ ...base, cn: '10,5', cl: '13' }], 1);
  assert.equal(dec.pend[0], 1.25);
  const r1 = resolver(modelo([{ ...base, cl: '30' }], 0));
  assert.equal(r1.optimo.T, 4);
  const r2 = resolver(modelo([base], 0));
  assert.equal(r2.optimo.T, 4);
  assert.deepEqual(r2.optimo.empates.slice().sort(), [2, 3, 4]);
});

/* ---------- 4: entrada y validación ---------- */

const CAB = '| Actividad | Predecesoras | Duración normal | Costo normal | Duración límite | Costo límite |\n|---|---|---|---|---|---|\n';

test('entrada: líneas de costo indirecto/fijo en varias formas', () => {
  const caso = (lineas) => leerTexto(lineas + '\n' + CAB + '| A | - | 4 | 100 | 2 | 160 |\n| B | A | 2 | 5 | - | - |');
  assert.equal(caso('Costo indirecto por unidad de tiempo: 50').ci, '50');
  assert.equal(caso('Costo indirecto por día: 1,5').ci, '1.5');
  assert.equal(caso('Costo indirecto diario: 50').ci, '50');
  assert.equal(caso('- Costo indirecto: $50').ci, '50');
  const f = caso('Costo indirecto por unidad de tiempo: 7\nCosto indirecto fijo: 100');
  assert.deepEqual([f.ci, f.fijo], ['7', '100']);
  const g = caso('Costo fijo: 25\nCosto indirecto por semana: 3');
  assert.deepEqual([g.ci, g.fijo], ['3', '25']);
  assert.equal(caso('Costo indirecto por unidad de tiempo: 0').ci, '0');
});

test('entrada: celdas con $, columnas en otro orden, miles, texto no numérico, ciclos y predecesoras inexistentes', () => {
  const a1 = leerTexto(`Costo indirecto por unidad de tiempo: 3\n${CAB}| A | - | 4 | $100 | 2 | $160 |`);
  assert.deepEqual([a1.filas[0].cn, a1.filas[0].cl], ['100', '160']);
  const orden = leerTexto('Costo indirecto por unidad de tiempo: 3\n| Actividad | Predecesoras | Costo normal | Duración normal | Costo límite | Duración límite |\n|---|---|---|---|---|---|\n| A | - | 100 | 4 | 160 | 2 |');
  assert.deepEqual([orden.filas[0].dn, orden.filas[0].cn, orden.filas[0].dl, orden.filas[0].cl], ['4', '100', '2', '160']);
  const miles = leerTexto(`Costo indirecto por unidad de tiempo: 3\n${CAB}| A | - | 4 | 1.000 | 2 | 1.600 |`);
  assert.ok(miles.notas.some((n) => /separador de miles/.test(n)), 'avisa que 1.000 se leyó como 1');
  const raro = (cel, preds = '-') => analizar(leerTexto(`Costo indirecto por unidad de tiempo: 3\n${CAB}| A | ${preds} | ${cel} | 100 | 2 | 150 |`));
  assert.match(raro('abc').errores[0].msg, /no es un número/);
  assert.match(raro('').errores[0].msg, /Falta la duración normal/);
  assert.match(raro('4.5').errores[0].msg, /entero/);
  assert.match(raro('4', 'Z').errores[0].msg, /no existe/);
  const ciclo = leerTexto(`Costo indirecto por unidad de tiempo: 3\n${CAB}| A | B | 4 | 1 | | |\n| B | C | 3 | 1 | | |\n| C | A | 3 | 1 | | |`);
  assert.match(analizar(ciclo).errores[0].msg, /ciclo/);
  const sp = leerTexto(`Costo indirecto por unidad de tiempo: 3\n${CAB}| Obra civil | - | 4 | 1 | | |\n| B | Obra civil | 3 | 1 | | |`);
  assert.match(analizar(sp).errores.map((e) => e.msg).join(' '), /no deben llevar espacios/);
  assert.equal(analizar({ filas: [], ci: '1', fijo: '' }).ok, false);
});

test('Markdown: ida y vuelta con el análisis idéntico (redes aleatorias con decimales, con y sin fijo)', () => {
  for (let s = 1; s <= 150; s++) {
    const rng = mulberry32(s + 4400);
    const filas = redRara(rng);
    const ci = rng.pick(['0', '2,5', '40']);
    const fijo = s % 2 ? '12' : '';
    const md = aMarkdown({ titulo: 'T', ci, fijo, filas });
    const l = leerTexto(md);
    const a = analizar({ filas, ci, fijo });
    const b = analizar({ filas: l.filas, ci: l.ci, fijo: l.fijo });
    assert.equal(b.ok, a.ok, `s=${s}`);
    if (a.ok) cerca(b.res.optimo.total, a.res.optimo.total, `s=${s} total`);
  }
});

/* ---------- 5: texto del paso a paso ---------- */

test('pasos: cada número citado en el texto de los ejemplos coincide con el dominio', () => {
  for (const e of EJEMPLOS) {
    const a = analizar({ filas: e.filas, ci: e.ci, fijo: e.fijo });
    const { res, m } = a;
    const reds = a.pasos.filter((p) => p.fase === 'reduccion');
    assert.equal(reds.length, res.pasos.length);
    let dirAnt = res.normal.directo;
    reds.forEach((p, k) => {
      const r = res.pasos[k];
      assert.match(p.titulo, new RegExp(`de ${r.desde} a ${r.hasta}`));
      assert.equal(p.calculo[1], `Costo directo = ${coma(dirAnt)} + ${coma(r.pendiente)} × ${r.unidades} = ${coma(r.directo)}`);
      cerca(r.directo, dirAnt + r.pendiente * r.unidades, 'cuenta del costo directo');
      cerca(r.indirecto, m.ci * r.hasta + m.fijo, 'indirecto');
      cerca(r.total, r.directo + r.indirecto, 'total');
      assert.ok(p.texto.includes(`${coma(m.ci)} en costos indirectos`), 'cita el costo indirecto por unidad');
      assert.match(p.texto, r.unidades === 1 ? /Se acorta 1 unidad/ : new RegExp(`Se acortan ${r.unidades} unidades`));
      const est = res.estadoEn(r.hasta);
      assert.equal(p.T, r.hasta);
      assert.deepEqual(p.d, est.d);
      if (/se vuelve crítica otra ruta/.test(p.texto)) assert.notDeepEqual(r.criticasAntes, r.criticasDespues);
      if (/porque .* llegan? a su duración límite/.test(p.texto)) r.llegaLimite.forEach((nom) => assert.equal(est.d[m.names.indexOf(nom)], m.dl[m.names.indexOf(nom)]));
      dirAnt = r.directo;
    });
    const fin = a.pasos[a.pasos.length - 1];
    assert.equal(fin.T, res.optimo.T);
    assert.ok(fin.calculo.includes(`Costo total mínimo = ${coma(res.optimo.total)}`));
  }
});

test('pasos: la razón por la que termina cada tramo es verdadera (límite / cambian críticas / cambia el corte) en miles de redes', () => {
  let ruta = 0;
  let corte = 0;
  for (let s = 1; s <= 2500; s++) {
    const rng = mulberry32(s * 17 + 3);
    const filas = FUENTES[s % FUENTES.length](rng);
    const m = modelo(filas, rng.int(0, 60));
    const res = resolver(m);
    const pasos = explicarPasos(m, res).filter((p) => p.fase === 'reduccion');
    pasos.forEach((p, k) => {
      const r = res.pasos[k];
      if (r.termina === 'fin') { assert.equal(r.hasta, res.Tmin); return; }
      if (r.termina === 'limite') { assert.ok(r.llegaLimite.length > 0); return; }
      const mismas = r.criticasAntes.join() === r.criticasDespues.join();
      if (/cambian las actividades críticas/.test(p.texto)) { assert.equal(mismas, false, `s=${s}: dice que cambian las críticas y no`); ruta++; }
      else { assert.match(p.texto, /el corte más barato cambia/); assert.equal(mismas, true, `s=${s}`); corte++; }
      assert.ok(res.pasos[k + 1], 'si no es el último, hay otro paso');
    });
  }
  assert.ok(ruta > 100);
  console.log(`  tramos que terminan por nueva ruta crítica: ${ruta}; por cambio de corte con las mismas críticas: ${corte}`);
});

test('pasos: con muchísimas rutas críticas el texto no las lista todas ni miente con la cuenta', () => {
  // 9 pares paralelos en serie: 2^9 = 512 rutas críticas (el recuento se trunca en 200)
  const filas = [];
  let prev = '';
  for (let k = 0; k < 9; k++) {
    const a = `A${k}`;
    const b = `B${k}`;
    filas.push({ name: a, preds: prev, dn: '3', dl: '2', cn: '10', cl: String(12 + k) });
    filas.push({ name: b, preds: prev, dn: '3', dl: '2', cn: '10', cl: String(12 + k) });
    prev = `${a},${b}`;
  }
  filas.push({ name: 'Z', preds: prev, dn: '1', dl: '1', cn: '1', cl: '1' });
  const a = analizar({ filas, ci: '100', fijo: '' });
  assert.equal(a.ok, true, JSON.stringify(a.errores));
  assert.equal(a.res.normal.rutas.truncado, true);
  const normal = a.pasos.find((p) => p.id === 'normal');
  assert.match(normal.texto, /más de 200 rutas críticas/);
  assert.ok(normal.texto.length < 600, 'no lista cientos de rutas');
  assert.ok(a.pasos.find((p) => p.id === 'red1').texto.length < 1200);
  const t = tablaActividades(a);
  assert.ok(t.criticas.every(Boolean), 'todas las actividades son críticas');
  assert.match(resumen(a).join(' '), /más de 200/);
});

/* ---------- 6: generador y corregir ---------- */

test('práctica: en los ejercicios de costo el método clásico (cualquier desempate) da la misma respuesta que el óptimo', () => {
  for (const tipo of ['costoDirecto', 'duracionOptima', 'costoTotal']) {
    for (let s = 1; s <= 400; s++) {
      const ej = generarEjercicio(tipo, s * 7);
      const { m, res } = solucionDe(ej);
      for (const desempate of [(t) => t[0], (t) => t[t.length - 1]]) {
        const k = clasico(aNumeros(ej.filas), desempate);
        if (tipo === 'costoDirecto') cerca(k.get(ej.objetivo), res.estadoEn(ej.objetivo).directo, `${tipo} ${s}`);
        else {
          let mejor = Infinity;
          let mt = 0;
          for (const [T, c] of k) {
            const t = c + m.ci * T;
            if (t < mejor - 1e-9 || (Math.abs(t - mejor) < 1e-9 && T > mt)) { mejor = t; mt = T; }
          }
          cerca(mejor, res.optimo.total, `${tipo} ${s} total`);
          assert.equal(mt, res.optimo.T, `${tipo} ${s} duración`);
        }
      }
    }
  }
});

test('práctica: «primera» tiene mínimo único; «conjunto» respuesta única y rutas como dice el enunciado; solo se acepta lo correcto', () => {
  for (let s = 1; s <= 500; s++) {
    const p = generarEjercicio('primera', s);
    const r = aNumeros(p.filas);
    const T = Math.max(...finales(r, r.dn));
    const criticas = [];
    for (let j = 0; j < r.n; j++) {
      const d = r.dn.slice();
      if (r.dn[j] > r.dl[j]) { d[j] -= 1; if (Math.max(...finales(r, d)) < T) criticas.push(j); }
    }
    const pend = criticas.map((j) => pendRef(r, j)).sort((a, b) => a - b);
    assert.ok(pend.length >= 2 && pend[0] < pend[1], `primera ${s}: debe haber un único mínimo entre las críticas`);
    assert.equal(respuestaCorrecta(p), criticas.find((j) => pendRef(r, j) === pend[0]));
    p.filas.forEach((_, j) => assert.equal(corregir(p, j).correcta, j === respuestaCorrecta(p), `primera ${s} opción ${j}`));

    const c = generarEjercicio('conjunto', s);
    const k = curvaExacta(aNumeros(c.filas));
    const T0 = Math.max(...k.keys());
    cerca(respuestaCorrecta(c), k.get(T0 - 1) - k.get(T0), `conjunto ${s}`);
    assert.ok(Number(c.enunciado.match(/hay (\d+) rutas críticas/)[1]) >= 2);
    assert.match(c.pregunta, new RegExp(`de ${T0} a ${T0 - 1}`));
    assert.equal(corregir(c, respuestaCorrecta(c) + 0.5).correcta, false);
    assert.equal(corregir(c, respuestaCorrecta(c)).correcta, true);
  }
});

test('práctica: enunciado ↔ datos (costo indirecto, objetivo) y la solución detallada cita la cifra correcta', () => {
  for (let s = 1; s <= 300; s++) {
    for (const tipo of TIPOS) {
      const ej = generarEjercicio(tipo, s);
      const { m, res } = solucionDe(ej);
      assert.equal(ej.filas.length === 1, tipo === 'pendiente');
      const mci = ej.enunciado.match(/Costo indirecto: (\d+)/);
      if (mci) assert.equal(Number(mci[1]), ej.ci);
      const resp = respuestaCorrecta(ej);
      const txt = coma(Math.round(resp * 100) / 100);
      if (tipo !== 'primera' && tipo !== 'limite') assert.ok(ej.solucionDetallada.replace('−', '-').includes(txt), `${tipo} ${s}: la solución no cita ${txt}\n${ej.solucionDetallada}`);
      if (tipo === 'costoDirecto') {
        assert.ok(ej.pregunta.includes(`en ${ej.objetivo} `) && ej.pregunta.includes(`dura ${res.T0}.`));
        const hastas = [...ej.solucionDetallada.matchAll(/De (\d+) a (\d+):/g)].map((x) => Number(x[2]));
        assert.ok(hastas.length > 0 && Math.min(...hastas) === ej.objetivo, `costoDirecto ${s}: el detalle debe parar en ${ej.objetivo}: ${hastas}`);
      }
      if (tipo === 'duracionOptima' || tipo === 'costoTotal') assert.equal(res.optimo.empates.length, 1, 'sin empates en el óptimo');
      if (tipo === 'limite') assert.equal(resp, res.Tmin);
      if (tipo === 'pendiente') assert.ok(Number.isFinite(resp) && resp > 0 && m.pend[0] === resp);
    }
  }
});

test('práctica: corregir recalcula desde los datos y rechaza respuestas no numéricas', () => {
  for (const tipo of TIPOS) {
    const ej = JSON.parse(JSON.stringify(generarEjercicio(tipo, 77)));
    assert.equal(corregir(ej, respuestaCorrecta(ej)).correcta, true);
    if (tipo !== 'primera') for (const x of [NaN, Infinity, '12', null, undefined]) assert.equal(corregir(ej, x).correcta, false, `${tipo} ${String(x)}`);
    else for (const x of [-1, 99, 0.5, NaN, null]) assert.equal(corregir(ej, x).correcta, false);
  }
});
