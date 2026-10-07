import test from 'node:test';
import assert from 'node:assert/strict';
import { analizar, tablaActividades, tablaReducciones, tablaCurva, evaluarObjetivo, resumen } from '../domain/analizar.js';
import { EJEMPLOS } from '../domain/ejemplos.js';
import { leerTexto, aMarkdown } from '../domain/entrada.js';
import { cortesPosibles } from '../domain/alternativas.js';
import { normalizar, armarModelo } from '../domain/modelo.js';
import { resolver } from '../domain/reducir.js';
import { explicarPasos } from '../domain/pasos.js';
import { construirRed, tiemposRed } from '../domain/red.js';
import { mulberry32, redAleatoria, puenteAleatorio } from './utils.mjs';

const montar = (filas, ci = 10) => {
  const nor = normalizar(filas, { ci: String(ci) });
  assert.deepEqual(nor.errores, []);
  const m = armarModelo(nor.actividades, { ci: nor.ci, fijo: 0 });
  return { m, res: resolver(m) };
};

test('los ejemplos cargan sin errores y son coherentes', () => {
  for (const e of EJEMPLOS) {
    const a = analizar({ filas: e.filas, ci: e.ci, fijo: e.fijo });
    assert.equal(a.ok, true, e.id);
    assert.ok(a.pasos.length >= 3);
    assert.ok(a.res.optimo.T <= a.res.T0 && a.res.optimo.T >= a.res.Tmin);
  }
  const por = Object.fromEntries(EJEMPLOS.map((e) => [e.id, analizar({ filas: e.filas, ci: e.ci, fijo: e.fijo })]));
  // Números citados en la Teoría (rombo) y en el Paso a paso
  const r = por.rombo.res;
  assert.deepEqual(r.estados.map((s) => s.T), [12, 11, 10, 9, 8]);
  assert.deepEqual(r.estados.map((s) => s.directo), [65, 75, 85, 115, 145]);
  assert.deepEqual(r.estados.map((s) => s.total), [209, 207, 205, 223, 241]);
  assert.equal(r.optimo.T, 10);
  assert.deepEqual([por.cadena.res.T0, por.cadena.res.Tmin, por.cadena.res.optimo.T, por.cadena.res.optimo.total], [18, 10, 13, 1155]);
  assert.deepEqual([por.obra.res.T0, por.obra.res.Tmin, por.obra.res.optimo.T, por.obra.res.optimo.total], [28, 14, 16, 1510]);
  assert.deepEqual([por.puente.res.T0, por.puente.res.Tmin, por.puente.res.optimo.T, por.puente.res.optimo.total], [18, 11, 13, 1500]);
  assert.ok(por.puente.res.pasos.some((p) => p.tipo === 'con-alargue'));
  assert.ok(por.obra.res.pasos.some((p) => p.tipo === 'conjunto'));
});

test('el primer corte sin alargues es el conjunto de menor costo que corta todas las rutas críticas', () => {
  let comparados = 0;
  for (let seed = 1; seed <= 1500; seed++) {
    const rng = mulberry32(seed + 5000);
    const filas = seed % 3 === 0 ? puenteAleatorio(rng, seed % 2 === 0) : redAleatoria(rng, { nMin: 3, nMax: 8, pPred: 0.3 });
    const { m, res } = montar(filas);
    for (const p of res.pasos) {
      if (p.tipo === 'con-alargue') continue;
      const alt = cortesPosibles(m, res.estadoEn(p.desde).d);
      if (!alt) continue;
      assert.ok(alt.cortes.length > 0);
      assert.ok(Math.abs(alt.cortes[0].costo - p.pendiente) < 1e-7, `semilla ${seed} paso ${p.n}: ${alt.cortes[0].costo} vs ${p.pendiente}`);
      comparados++;
    }
  }
  assert.ok(comparados > 2000);
});

test('los textos de los pasos no tienen undefined, NaN ni Infinity', () => {
  for (let seed = 1; seed <= 600; seed++) {
    const rng = mulberry32(seed + 900);
    const filas = seed % 2 ? puenteAleatorio(rng, true) : redAleatoria(rng, { nMin: 2, nMax: 8 });
    const { m, res } = montar(filas, rng.int(0, 60));
    for (const p of explicarPasos(m, res)) {
      const t = [p.titulo, p.texto, ...p.calculo].join('\n');
      assert.doesNotMatch(t, /undefined|NaN|Infinity|\[object/, `semilla ${seed}: ${t}`);
    }
  }
});

test('red AOA: los tiempos de la red coinciden con los del modelo en cada paso', () => {
  for (const e of EJEMPLOS) {
    const a = analizar({ filas: e.filas, ci: e.ci, fijo: e.fijo });
    for (const s of a.res.estados) assert.equal(tiemposRed(a.red, s.d).T, s.T);
    assert.ok(a.red.bounds.w > 0 && a.red.bounds.h > 0);
  }
  const m = montar([{ name: 'A', preds: '', dn: '3', dl: '3', cn: '1', cl: '1' }]).m;
  assert.equal(construirRed(m).net.edges.length, 1);
});

test('leerTexto: Markdown, encabezados alternativos, TSV y líneas de costo indirecto', () => {
  const md = [
    '# Mi proyecto',
    'Costo indirecto por unidad de tiempo: 50',
    'Costo indirecto fijo: 200',
    '| Actividad | Predecesoras | Duración normal | Costo normal | Duración límite | Costo límite |',
    '|---|---|---|---|---|---|',
    '| A | - | 4 | 100 | 2 | 160 |',
    '| B | A | 5 | 90,5 | - | - |',
  ].join('\n');
  const r = leerTexto(md);
  assert.equal(r.titulo, 'Mi proyecto');
  assert.equal(r.ci, '50');
  assert.equal(r.fijo, '200');
  assert.equal(r.filas.length, 2);
  assert.deepEqual(r.filas[0], { name: 'A', preds: '', dn: '4', cn: '100', dl: '2', cl: '160' });
  assert.deepEqual(r.filas[1], { name: 'B', preds: 'A', dn: '5', cn: '90.5', dl: '', cl: '' });
  const alt = leerTexto('Actividad\tPredecesoras\tTiempo normal\tCosto normal\tTiempo crash\tCosto crash\nA\t\t3\t10\t2\t15');
  assert.deepEqual(alt.filas[0], { name: 'A', preds: '', dn: '3', cn: '10', dl: '2', cl: '15' });
  const orden = leerTexto('| Actividad | Predecesoras | DL | CL | DN | CN |\n|---|---|---|---|---|---|\n| A | - | 2 | 15 | 3 | 10 |');
  assert.deepEqual(orden.filas[0], { name: 'A', preds: '', dn: '3', cn: '10', dl: '2', cl: '15' });
  const sinCab = leerTexto('A,-,3,10,2,15\nB,A,4,20,3,25');
  assert.equal(sinCab.filas.length, 2);
  assert.equal(sinCab.filas[1].preds, 'A');
  const ind = leerTexto('Costo indirecto: 1.500\nA,-,3,10,2,15');
  assert.equal(ind.ci, '1.5');
  assert.deepEqual(leerTexto('').filas, []);
});

test('Markdown ida y vuelta de cada ejemplo', () => {
  for (const e of EJEMPLOS) {
    const md = aMarkdown({ titulo: e.titulo, ci: e.ci, fijo: e.fijo, filas: e.filas });
    const r = leerTexto(md);
    assert.deepEqual(r.filas, e.filas.map((f) => ({ ...f, preds: f.preds === '-' ? '' : f.preds })));
    assert.equal(r.ci, e.ci);
    assert.equal(r.titulo, e.titulo);
    const a = analizar({ filas: r.filas, ci: r.ci, fijo: r.fijo });
    assert.equal(a.ok, true);
  }
});

test('tablas y objetivo', () => {
  const e = EJEMPLOS[0];
  const a = analizar({ filas: e.filas, ci: e.ci, fijo: e.fijo, objetivo: '9' });
  assert.equal(a.objetivo.estado.directo, 115);
  assert.equal(tablaActividades(a).rows[0][6], '10');
  assert.equal(tablaActividades(a).rows[3][6], 'No se acorta');
  assert.equal(tablaReducciones(a).rows.length, 2);
  assert.equal(tablaCurva(a).rows.filter((r) => r[4] === 'Sí').length, 1);
  assert.equal(evaluarObjetivo(a.res, '5').imposible, true);
  assert.match(evaluarObjetivo(a.res, '20').mensaje, /duraciones normales/);
  assert.ok(evaluarObjetivo(a.res, 'abc').error);
  assert.equal(evaluarObjetivo(a.res, ''), null);
  assert.ok(resumen(a).length >= 4);
});

test('costo indirecto fijo no cambia la duración óptima, solo el total', () => {
  const e = EJEMPLOS[2];
  const a = analizar({ filas: e.filas, ci: e.ci, fijo: '0' });
  const b = analizar({ filas: e.filas, ci: e.ci, fijo: '500' });
  assert.equal(a.res.optimo.T, b.res.optimo.T);
  assert.equal(b.res.optimo.total, a.res.optimo.total + 500);
});

test('datos inválidos devuelven errores, no excepciones', () => {
  const a = analizar({ filas: [{ name: 'A', preds: 'Z', dn: 'x', cn: '', dl: '', cl: '' }], ci: '' });
  assert.equal(a.ok, false);
  assert.ok(a.errores.length >= 3);
});

test('la plantilla para IA describe el formato que lee la herramienta', async () => {
  const { PLANTILLA_IA } = await import('../domain/plantilla.js');
  // la fila de ejemplo de la plantilla se interpreta bien
  const r = leerTexto(PLANTILLA_IA.split('Reglas:')[0].replace('<número>', '50').replace('<número, 0 si no hay>', '0'));
  assert.equal(r.filas.length, 1);
  assert.deepEqual(r.filas[0], { name: 'A', preds: '', dn: '4', cn: '100', dl: '2', cl: '160' });
  assert.equal(r.ci, '50');
});
