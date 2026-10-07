// Auditoría independiente del tema 3.2: node --test src/tools/ruta-critica/test/auditoriaTiempo.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../domain/analyze.js';
import { calcularPERT, calcularTiempos } from '../domain/tiempos.js';
import { pasosTiempo } from '../domain/pasosTiempo.js';
import { generarEjercicio, corregir, TIPOS, TOL_PROB, mulberry32, resolver } from '../domain/practicaTiempo.js';
import { phi } from '../domain/normal.js';
import { normalCdf, normalInv } from '../domain/pert.js';
import { fmt } from '../domain/format.js';

const f = (x) => fmt(x, 2).replace('-', '−');
const f4 = (x) => fmt(x, 4).replace('-', '−');
const r2 = (x) => Math.round(x * 100) / 100;

/** Φ por integración de Simpson, independiente de normal.js. */
function phiSimpson(z) {
  const lo = -12; const n = 40000; const h = (z - lo) / n;
  const g = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  let s = g(lo) + g(z);
  for (let i = 1; i < n; i++) s += g(lo + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

test('normal: pert.normalCdf es la misma Φ de doble precisión; inversa consistente; extremos', () => {
  for (let z = -7; z <= 7; z += 0.173) {
    assert.equal(normalCdf(z), phi(z));
    assert.ok(Math.abs(phi(z) - phiSimpson(z)) < 1e-9, `z=${z}`);
  }
  assert.equal(normalCdf(40), 1);
  assert.ok(normalCdf(-40) >= 0 && normalCdf(-40) < 1e-300);
  assert.equal(phi(0), 0.5);
  for (const p of [0.001, 0.05, 0.3, 0.5, 0.9, 0.95, 0.999]) assert.ok(Math.abs(phi(normalInv(p)) - p) < 1e-8);
});

function triple(rng) {
  const a = rng.int(0, 6); const m = a + rng.int(0, 4); const b = m + rng.int(0, 6);
  return { a, m, b };
}
function redAzar(rng, n) {
  const acts = [];
  for (let i = 0; i < n; i++) {
    const k = i === 0 ? 0 : rng.int(0, Math.min(3, i));
    const pool = acts.map((a) => a.name);
    const preds = [];
    while (preds.length < k) preds.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    acts.push({ name: String.fromCharCode(65 + i), preds: preds.sort(), ...triple(rng) });
  }
  return acts;
}
const aFilas = (acts) => acts.map((a) => ({ name: a.name, preds: a.preds.join(',') || '-', d: '', a: String(a.a), m: String(a.m), b: String(a.b) }));

test('PERT: te, varianza y ruta de mayor varianza coinciden entre Resuelve (analyze) y tabla, con empates', () => {
  let empates = 0;
  for (let seed = 1; seed <= 2000; seed++) {
    const rng = mulberry32(seed + 900);
    const acts = redAzar(rng, rng.int(2, 9));
    const an = analyze({ rows: aFilas(acts), mode: 'pert', decimals: 2 });
    assert.ok(an.ok);
    const r = calcularPERT(acts);
    for (const a of acts) {
      assert.ok(Math.abs(an.byName.get(a.name).te - (a.a + 4 * a.m + a.b) / 6) < 1e-12);
      assert.ok(Math.abs(an.byName.get(a.name).var - ((a.b - a.a) / 6) ** 2) < 1e-12);
    }
    // varianza máxima entre rutas críticas de la red (como en RutaCriticaSolver) = la de calcularPERT
    const vars = an.critical.routes.map((q) => q.acts.reduce((s, n) => s + an.byName.get(n).var, 0));
    assert.ok(Math.abs(Math.max(...vars) - r.varianza) < 1e-9, `seed ${seed}`);
    // no hay rutas críticas repetidas (misma secuencia de actividades) por culpa de las ficticias
    const claves = an.critical.routes.map((q) => q.acts.join('>'));
    assert.equal(new Set(claves).size, claves.length, `seed ${seed}: rutas duplicadas ${claves}`);
    if (r.rutasCriticas.length > 1) empates++;
  }
  assert.ok(empates > 20, `${empates}`);
});

test('PERT: sigma = 0, plazo menor/igual/mayor, Z extremos (pasosTiempo)', () => {
  const rows = [
    { name: 'A', preds: '-', d: '', a: '3', m: '3', b: '3' },
    { name: 'B', preds: 'A', d: '', a: '2', m: '2', b: '2' },
  ];
  for (const [plazo, esperado] of [[4, 0], [5, 1], [6, 1]]) {
    const r = pasosTiempo({ rows, modo: 'pert', plazo });
    assert.ok(r.ok);
    const ult = r.pasos[r.pasos.length - 1];
    assert.equal(ult.estado.campana.p, esperado, `plazo ${plazo}`);
    assert.ok(ult.calculo.join(' ').includes('σ = 0'));
    assert.ok(ult.calculo.every((l) => !/NaN|Infinity/.test(l)));
  }
  const rows2 = [{ name: 'A', preds: '-', d: '', a: '1', m: '2', b: '3' }];
  for (const plazo of [-5, 0, 2, 100]) {
    const r = pasosTiempo({ rows: rows2, modo: 'pert', plazo });
    const l = r.pasos[r.pasos.length - 1].calculo.join(' ');
    assert.ok(!/NaN|Infinity/.test(l), l);
  }
  assert.equal(pasosTiempo({ rows: rows2, modo: 'pert', plazo: 2 }).pasos.at(-1).estado.campana.p, 0.5);
});

test('práctica 3.2: 3000 semillas por tipo; la solución coincide con un cálculo independiente y la explicación la contiene', () => {
  for (let seed = 1; seed <= 3000; seed++) {
    for (const tipo of TIPOS) {
      const ej = generarEjercicio(tipo, seed);
      const et = `${tipo} ${seed}`;
      const esp = resolver(ej);
      if (Array.isArray(ej.solucion)) assert.deepEqual(ej.solucion, esp, et);
      else assert.ok(Math.abs(ej.solucion - esp) < 1e-9, `${et}: ${ej.solucion} vs ${esp}`);
      assert.ok(corregir(ej, esp).correcta, et);
      if (!Array.isArray(esp)) {
        const mal = esp + (ej.entrada.tol * 3 + 0.5);
        assert.ok(!corregir(ej, mal).correcta, `${et}: acepta un valor lejano`);
        const texto = ej.explicacion;
        if (['tiempo', 'holgura', 'duracion'].includes(tipo)) assert.ok(texto.includes(`= ${f(esp)}`), `${et}: «${texto}» no contiene = ${f(esp)}`);
        if (tipo === 'te' || tipo === 'varianza') assert.ok(texto.includes(f4(esp)), et);
        if (tipo === 'probabilidad') assert.ok(texto.includes(`${f(esp)} %`), `${et}: ${texto}`);
        if (tipo === 'pertProyecto') {
          const num = ej.datos.pide === 'Te' ? f(esp) : f4(esp);
          assert.ok(texto.includes(num), `${et}: ${texto}`);
        }
      }
      if (tipo === 'pertProyecto' || tipo === 'probabilidad') assert.equal(calcularPERT(ej.datos.acts).unicaRuta, true, et);
    }
  }
});

test('práctica 3.2: la tolerancia de probabilidad acepta lo que sale con redondeos de alumno', () => {
  let peor = 0;
  for (let seed = 1; seed <= 3000; seed++) {
    const ej = generarEjercicio('probabilidad', seed);
    const acts = ej.datos.acts;
    const r = calcularPERT(acts);
    const exacto = phi((ej.datos.plazo - r.Te) / r.sd) * 100;
    // alumno 1: te y σ² por actividad a 2 decimales, suma, raíz a 2 decimales, Z a 2 decimales
    const idx = new Map(acts.map((a, i) => [a.name, i]));
    const Te1 = r.ruta.reduce((s, nm) => { const a = acts[idx.get(nm)]; return s + r2((a.a + 4 * a.m + a.b) / 6); }, 0);
    const var1 = r.ruta.reduce((s, nm) => { const a = acts[idx.get(nm)]; return s + r2(((a.b - a.a) / 6) ** 2); }, 0);
    const sd1 = r2(Math.sqrt(var1));
    const p1 = phi(r2((ej.datos.plazo - Te1) / sd1)) * 100;
    // alumno 2: Te exacto, σ a 2 decimales, Z a 2 decimales
    const p2 = phi(r2((ej.datos.plazo - r.Te) / r2(r.sd))) * 100;
    for (const p of [p1, p2]) {
      peor = Math.max(peor, Math.abs(p - exacto));
      assert.ok(corregir(ej, r2(p)).correcta, `seed ${seed}: alumno ${r2(p)} vs ${exacto}`);
    }
  }
  assert.ok(peor < TOL_PROB, `peor diferencia ${peor}`);
});

test('práctica 3.2: el plazo de probabilidad es razonable y σ > 0', () => {
  const zs = [];
  for (let seed = 1; seed <= 3000; seed++) {
    const ej = generarEjercicio('probabilidad', seed);
    const r = calcularPERT(ej.datos.acts);
    assert.ok(ej.datos.plazo > 0 && Number.isInteger(ej.datos.plazo));
    assert.ok(r.sd > 0, `seed ${seed}: sd = 0`);
    zs.push((ej.datos.plazo - r.Te) / r.sd);
  }
  assert.ok(Math.min(...zs) > -3 && Math.max(...zs) < 3.5, `${Math.min(...zs)} ${Math.max(...zs)}`);
});

test('CPM en Resuelve: la tabla trae HL = mín TIC de las sucesoras − TFC también con ficticias', () => {
  const rows = [['A', '-', 3], ['B', '-', 1], ['C', 'A,B', 4], ['D', 'B', 5], ['E', 'C', 2], ['F', 'C,D', 3]]
    .map(([name, preds, d]) => ({ name, preds, d: String(d), a: '', m: '', b: '' }));
  const an = analyze({ rows, mode: 'cpm', decimals: 2 });
  const hl = Object.fromEntries(an.net.edges.filter((e) => e.kind === 'activity').map((e) => [e.act, an.times.edgeInfo[e.id].hl]));
  assert.deepEqual(hl, { A: 0, B: 0, C: 0, D: 1, E: 1, F: 0 });
  const t = calcularTiempos(rows.map((r) => ({ name: r.name, preds: r.preds === '-' ? [] : r.preds.split(',') })), (n) => Number(rows.find((r) => r.name === n).d));
  for (const n of Object.keys(hl)) assert.equal(t.fila[n].hl, hl[n]);
});
