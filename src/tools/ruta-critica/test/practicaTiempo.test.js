// Pruebas del generador y corrector de la Práctica del tema 3.2.
// Cada respuesta correcta se obtiene aparte (enumeración de rutas, integración numérica de la normal),
// no con las mismas funciones que usa el generador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS, TOL_PROB, generarEjercicio, corregir, resolver } from '../domain/practicaTiempo.js';
import { phi } from '../domain/normal.js';
import { analyze } from '../domain/analyze.js';

const SEEDS = [...Array.from({ length: 400 }, (_, i) => i + 1), ...Array.from({ length: 200 }, (_, i) => 70000 + i * 37)];

// ── Referencia independiente ─────────────────────────────────────────
function rutasDe(acts) {
  const sucs = Object.fromEntries(acts.map((a) => [a.name, acts.filter((x) => x.preds.includes(a.name)).map((x) => x.name)]));
  const out = [];
  const cam = [];
  const anda = (n) => { cam.push(n); if (!sucs[n].length) out.push([...cam]); else sucs[n].forEach(anda); cam.pop(); };
  acts.filter((a) => !a.preds.length).forEach((a) => anda(a.name));
  return out;
}
function referencia(acts, dur) {
  const rutas = rutasDe(acts);
  const largo = (r) => r.reduce((s, n) => s + dur(n), 0);
  const T = Math.max(...rutas.map(largo));
  const f = {};
  for (const a of acts) {
    let antes = 0; let despues = 0;
    for (const r of rutas) {
      const i = r.indexOf(a.name);
      if (i < 0) continue;
      antes = Math.max(antes, largo(r.slice(0, i)));
      despues = Math.max(despues, largo(r.slice(i + 1)));
    }
    f[a.name] = { tic: antes, tfc: antes + dur(a.name), tfl: T - despues, til: T - despues - dur(a.name) };
    f[a.name].ht = f[a.name].til - f[a.name].tic;
    const sig = acts.filter((s) => s.preds.includes(a.name)).map((s) => s.name);
    f[a.name].sucs = sig;
  }
  for (const a of acts) {
    const x = f[a.name];
    x.hl = (x.sucs.length ? Math.min(...x.sucs.map((s) => f[s].tic)) : T) - x.tfc;
  }
  return { T, f, rutas, largo };
}
const simpson = (z) => {
  const lo = -12; const n = 100000; const h = (z - lo) / n;
  const g = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  let s = g(lo) + g(z);
  for (let i = 1; i < n; i++) s += g(lo + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
};
const cerca = (a, b, t = 1e-9) => Math.abs(a - b) <= t;

function esperadoIndependiente(ej) {
  const { acts } = ej.datos;
  if (ej.tipo === 'te') return (acts[0].a + 4 * acts[0].m + acts[0].b) / 6;
  if (ej.tipo === 'varianza') return (acts[0].b - acts[0].a) ** 2 / 36;
  if (ej.tipo === 'pertProyecto' || ej.tipo === 'probabilidad') {
    const t6 = new Map(acts.map((a) => [a.name, a.a + 4 * a.m + a.b]));
    const R = referencia(acts, (n) => t6.get(n));
    const crit = R.rutas.filter((r) => R.largo(r) === R.T);
    assert.equal(crit.length, 1, `${ej.id}: PERT con más de una ruta crítica`);
    const Te = R.T / 6;
    const v = crit[0].reduce((s, n) => { const a = acts.find((x) => x.name === n); return s + (a.b - a.a) ** 2; }, 0) / 36;
    if (ej.tipo === 'pertProyecto') return ej.datos.pide === 'Te' ? Te : ej.datos.pide === 'var' ? v : Math.sqrt(v);
    return simpson((ej.datos.plazo - Te) / Math.sqrt(v)) * 100;
  }
  const dur = new Map(acts.map((a) => [a.name, a.d]));
  const R = referencia(acts, (n) => dur.get(n));
  if (ej.tipo === 'tiempo' || ej.tipo === 'holgura') return R.f[ej.datos.act][ej.datos.pide];
  if (ej.tipo === 'duracion') return R.T;
  if (ej.tipo === 'ruta') return acts.map((a, i) => (R.f[a.name].ht === 0 ? i : -1)).filter((i) => i >= 0);
  throw new Error(ej.tipo);
}

test('generador: la solución coincide con el cálculo independiente y corregir() la acepta', () => {
  for (const tipo of TIPOS) {
    for (const seed of SEEDS) {
      const ej = generarEjercicio(tipo, seed);
      const esp = esperadoIndependiente(ej);
      if (Array.isArray(esp)) {
        assert.deepEqual(ej.solucion, esp, `${ej.id}`);
        assert.deepEqual(resolver(ej), esp);
        assert.equal(corregir(ej, ej.solucion).correcta, true);
        assert.equal(corregir(ej, []).correcta, false);
        assert.equal(corregir(ej, [...esp, 99]).correcta, false);
      } else {
        assert.ok(cerca(ej.solucion, esp, 1e-7), `${ej.id}: solución ${ej.solucion} vs independiente ${esp}`);
        assert.ok(cerca(resolver(ej), esp, 1e-7), `${ej.id}: resolver`);
        const r = corregir(ej, esp);
        assert.equal(r.correcta, true, `${ej.id}: ${r.mensaje}`);
        assert.equal(corregir(ej, esp + 5).correcta, false, `${ej.id}: +5 no debía aceptarse`);
        assert.equal(corregir(ej, esp - 3).correcta, false);
      }
    }
  }
});

test('generador: reproducible, serializable, sin textos rotos y con variedad', () => {
  for (const tipo of TIPOS) {
    const vistos = new Set();
    for (const seed of SEEDS) {
      const a = generarEjercicio(tipo, seed);
      const b = generarEjercicio(tipo, seed);
      assert.deepEqual(a, b);
      assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
      for (const t of [a.titulo, a.enunciado, a.pregunta, a.explicacion, a.solucionDetallada || '']) {
        assert.ok(typeof t === 'string' && !/NaN|undefined|Infinity|\[object/.test(t), `${a.id}: texto roto «${t}»`);
      }
      assert.ok(a.explicacion.length > 10);
      vistos.add(a.enunciado + JSON.stringify(a.datos));
    }
    assert.ok(vistos.size >= SEEDS.length * 0.9, `${tipo}: poca variedad (${vistos.size} de ${SEEDS.length})`);
  }
  assert.throws(() => generarEjercicio('nada', 1));
});

test('generador: redes bien formadas (sin predecesoras redundantes ni ciclos) y analizables', () => {
  for (const tipo of ['tiempo', 'holgura', 'duracion', 'ruta', 'pertProyecto', 'probabilidad']) {
    for (const seed of SEEDS.slice(0, 250)) {
      const ej = generarEjercicio(tipo, seed);
      const { acts } = ej.datos;
      const idx = new Map(acts.map((a, i) => [a.name, i]));
      acts.forEach((a, i) => a.preds.forEach((p) => assert.ok(idx.get(p) < i, `${ej.id}: predecesora posterior`)));
      const anc = acts.map(() => new Set());
      acts.forEach((a, i) => a.preds.forEach((p) => { anc[i].add(idx.get(p)); anc[idx.get(p)].forEach((x) => anc[i].add(x)); }));
      acts.forEach((a, i) => a.preds.forEach((p) => assert.ok(!a.preds.some((q) => q !== p && anc[i] && anc[idx.get(q)].has(idx.get(p))), `${ej.id}: predecesora redundante`)));
      const rows = acts.map((a) => ({ name: a.name, preds: a.preds.join(',') || '-', d: String(a.d ?? ''), a: String(a.a ?? ''), m: String(a.m ?? ''), b: String(a.b ?? '') }));
      assert.ok(analyze({ rows, mode: ej.modo, decimals: 2 }).ok, `${ej.id}: la red no se pudo dibujar`);
    }
  }
});

test('holgura libre: nunca se pregunta donde la red con ficticias daría otro valor', () => {
  let hl = 0;
  for (const seed of SEEDS) {
    const ej = generarEjercicio('holgura', seed);
    if (ej.datos.pide !== 'hl') continue;
    hl++;
    const rows = ej.datos.acts.map((a) => ({ name: a.name, preds: a.preds.join(',') || '-', d: String(a.d), a: '', m: '', b: '' }));
    const an = analyze({ rows, mode: 'cpm', decimals: 2 });
    const e = an.net.edges.find((x) => x.act === ej.datos.act);
    assert.ok(cerca(an.times.edgeInfo[e.id].hl, ej.solucion), `${ej.id}: la red da HL ${an.times.edgeInfo[e.id].hl} y el ejercicio ${ej.solucion}`);
  }
  assert.ok(hl > 100);
});

test('probabilidad: se acepta la respuesta con Z redondeado a dos decimales (tabla normal) y se rechaza una errada', () => {
  let aceptadasTabla = 0;
  for (const seed of SEEDS) {
    const ej = generarEjercicio('probabilidad', seed);
    const { acts, plazo } = ej.datos;
    const t6 = new Map(acts.map((a) => [a.name, a.a + 4 * a.m + a.b]));
    const R = referencia(acts, (n) => t6.get(n));
    const crit = R.rutas.find((r) => R.largo(r) === R.T);
    const Te = R.T / 6;
    const sd = Math.sqrt(crit.reduce((s, n) => { const a = acts.find((x) => x.name === n); return s + (a.b - a.a) ** 2; }, 0) / 36);
    const z = (plazo - Te) / sd;
    const zTabla = Math.round(z * 100) / 100;
    const pTabla = simpson(zTabla) * 100;
    const pTablaRedond = Math.round(pTabla * 100) / 100; // la tabla trae 4 decimales
    assert.equal(corregir(ej, pTablaRedond).correcta, true, `${ej.id}: z ${z}, tabla ${pTablaRedond}, exacto ${ej.solucion}`);
    aceptadasTabla++;
    // también si el estudiante redondea σ a dos decimales antes de estandarizar
    const zSd = Math.round(((plazo - Te) / (Math.round(sd * 100) / 100)) * 100) / 100;
    assert.ok(Math.abs(simpson(zSd) * 100 - ej.solucion) < TOL_PROB, `${ej.id}: redondear σ rompe la tolerancia (${simpson(zSd) * 100} vs ${ej.solucion})`);
    // errores típicos se rechazan y se diagnostican
    assert.equal(corregir(ej, ej.solucion + 2 * TOL_PROB + 0.3).correcta, false);
    const contraria = 100 - ej.solucion;
    if (Math.abs(contraria - ej.solucion) > 2 * TOL_PROB) {
      const r = corregir(ej, contraria);
      assert.equal(r.correcta, false);
      assert.match(r.detalle, /contraria/);
    }
    assert.ok(ej.solucion > 3 && ej.solucion < 99.9, `${ej.id}: probabilidad extrema ${ej.solucion}`);
  }
  assert.ok(aceptadasTabla > 500);
});

test('corregir: respuestas no numéricas, pistas y mensajes con números concretos', () => {
  const tic = generarEjercicio('tiempo', 11);
  assert.equal(corregir(tic, null).correcta, false);
  assert.equal(corregir(tic, NaN).correcta, false);
  const r = corregir(tic, tic.solucion + 1);
  assert.match(r.mensaje, /Incorrecto: respondiste .* el valor es/);
  const te = { ...generarEjercicio('te', 5) };
  const a = te.datos.acts[0];
  const sinPonderar = corregir(te, (a.a + a.m + a.b) / 3);
  if (Math.abs((a.a + a.m + a.b) / 3 - te.solucion) > 0.05) assert.match(sinPonderar.detalle, /ponderar/);
  const va = generarEjercicio('varianza', 9);
  const b = va.datos.acts[0];
  assert.match(corregir(va, (b.b - b.a) / 6).detalle, /desviación|cuadrado/);
  // un ejercicio armado a mano también se corrige (no depende de `solucion`)
  const mano = {
    tipo: 'duracion', entrada: { tipo: 'numero', tol: 1e-6 },
    datos: { acts: [{ name: 'A', preds: [], d: 3 }, { name: 'B', preds: [], d: 1 }, { name: 'C', preds: ['A', 'B'], d: 4 }, { name: 'D', preds: ['B'], d: 5 }, { name: 'E', preds: ['C'], d: 2 }, { name: 'F', preds: ['C', 'D'], d: 3 }] },
  };
  assert.equal(corregir(mano, 10).correcta, true);
  assert.equal(corregir(mano, 9).correcta, false);
  const prob = { tipo: 'probabilidad', entrada: { tipo: 'numero', tol: TOL_PROB, unidad: '%' }, datos: { plazo: 12, acts: [{ name: 'A', preds: [], a: 1, m: 3, b: 5 }, { name: 'B', preds: [], a: 0, m: 1, b: 2 }, { name: 'C', preds: ['A', 'B'], a: 2, m: 4, b: 6 }, { name: 'D', preds: ['B'], a: 2, m: 5, b: 8 }, { name: 'E', preds: ['C'], a: 1, m: 2, b: 3 }, { name: 'F', preds: ['C', 'D'], a: 1, m: 2, b: 9 }] } };
  assert.equal(corregir(prob, 88.97).correcta, true);
  assert.equal(corregir(prob, 89.2).correcta, true);
  assert.equal(corregir(prob, 91).correcta, false);
  assert.ok(cerca(phi(2 / Math.sqrt(8 / 3)) * 100, simpson(2 / Math.sqrt(8 / 3)) * 100, 1e-6));
  assert.ok(Math.abs(phi(2 / Math.sqrt(8 / 3)) * 100 - 88.97) < 0.01);
});
