import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, modeloAMarkdown, validarModelo } from '../domain/modelo.js';
import { compilar, cpm } from '../domain/cpm.js';
import { perfil, picos, resumen, violaciones, cotaInferior } from '../domain/perfil.js';
import { analyze } from '../../ruta-critica/domain/analyze.js';
import { mulberry32, modeloAleatorio, cpmIndep, usoEnPeriodo, aMapa, verificar } from './utils.mjs';

const MD = `| Actividad | Duración | Predecesoras | Obreros |
|---|---|---|---|
| A | 2 | - | 3 |
| B | 3 | - | 4 |
| C | 4 | A | 2 |
| Límite | | | 6 |`;

test('parseMarkdown lee actividades, recurso y límite', () => {
  const r = parseMarkdown(MD);
  assert.deepEqual(r.errores, []);
  assert.equal(r.modelo.acts.length, 3);
  assert.deepEqual(r.modelo.recursos, [{ name: 'Obreros', limite: 6 }]);
  assert.deepEqual(r.modelo.acts[2], { name: 'C', d: 4, preds: ['A'], r: [2] });
});

test('modeloAMarkdown y parseMarkdown son inversos (500 modelos)', () => {
  const rng = mulberry32(11);
  for (let i = 0; i < 500; i++) {
    const m = modeloAleatorio(rng);
    const r = parseMarkdown(modeloAMarkdown(m, 'x'));
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.modelo, m);
  }
});

test('validación: errores claros', () => {
  const f = (md) => parseMarkdown(md).errores.join(' ');
  assert.match(f('hola'), /Escribe la tabla|encabezado/);
  assert.match(f('| Actividad | Duración | Predecesoras | R |\n|---|---|---|---|\n| A | 0 | - | 1 |'), /al menos 1 período/);
  assert.match(f('| Actividad | Duración | Predecesoras | R |\n|---|---|---|---|\n| A | 2,5 | - | 1 |'), /entero/);
  assert.match(f('| Actividad | Duración | Predecesoras | R |\n|---|---|---|---|\n| A | 2 | Z | 1 |'), /"Z", que no existe/);
  assert.match(f('| Actividad | Duración | Predecesoras | R |\n|---|---|---|---|\n| A | 2 | A | 1 |'), /de sí misma/);
  assert.match(f('| Actividad | Duración | Predecesoras | R |\n|---|---|---|---|\n| A | 2 | B | 1 |\n| B | 1 | A | 1 |'), /ciclo/);
  assert.match(f('| Actividad | Duración | Predecesoras | R |\n|---|---|---|---|\n| A | 2 | - | -3 |'), /requerimiento/);
  assert.match(f('| Actividad | Duración | Predecesoras | R |\n|---|---|---|---|\n| A | 2 | - | 1 |\n| A | 1 | - | 1 |'), /repetida/);
  assert.match(f('| Actividad | Duración | Predecesoras |\n|---|---|---|\n| A | 2 | - |'), /al menos un recurso/);
  const sinLimite = parseMarkdown('| Actividad | Duración | Predecesoras | R |\n|---|---|---|---|\n| A | 2 | - | 1 |');
  assert.equal(sinLimite.errores.length, 0);
  assert.equal(sinLimite.modelo.recursos[0].limite, null);
  assert.equal(sinLimite.avisos.length, 1);
  assert.ok(validarModelo({ acts: [], recursos: [] }).errores.length >= 2);
});

test('columnas en otro orden y pegado desde hoja (tabuladores)', () => {
  const r = parseMarkdown('Tarea\tGrúa\tPredecesoras\tDuración\nA\t1\t-\t2\nB\t1\tA\t3\nDisponible\t1\t\t');
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.modelo.acts[1], { name: 'B', d: 3, preds: ['A'], r: [1] });
  assert.equal(r.modelo.recursos[0].limite, 1);
});

test('CPM coincide con la relajación independiente (3000 redes)', () => {
  const rng = mulberry32(2024);
  for (let i = 0; i < 3000; i++) {
    const m = modeloAleatorio(rng);
    const red = compilar(m);
    const c = cpm(red);
    const o = cpmIndep(m);
    assert.equal(c.T, o.T);
    red.nombres.forEach((nm, j) => {
      assert.equal(c.ES[j], o.ES[nm]);
      assert.equal(c.LS[j], o.LS[nm]);
      assert.equal(c.H[j], o.H[nm]);
    });
  }
});

test('CPM coincide con la ruta crítica de la herramienta 3.1/3.2 (ES y holgura total)', () => {
  const rng = mulberry32(77);
  for (let i = 0; i < 150; i++) {
    const m = modeloAleatorio(rng);
    const rows = m.acts.map((a) => ({ name: a.name, preds: a.preds.join(',') || '-', d: String(a.d), a: '', m: '', b: '' }));
    const an = analyze({ rows, mode: 'cpm', decimals: 0 });
    assert.ok(an.ok);
    const c = cpm(compilar(m));
    assert.equal(an.times.T, c.T);
    const edge = new Map(an.net.edges.filter((e) => e.kind === 'activity').map((e) => [e.act, an.times.edgeInfo[e.id]]));
    m.acts.forEach((a, j) => {
      const idx = compilar(m).nombres.indexOf(a.name);
      assert.equal(edge.get(a.name).tic, c.ES[idx], `ES de ${a.name}`);
      assert.equal(edge.get(a.name).ht, c.H[idx], `holgura de ${a.name}`);
      void j;
    });
  }
});

test('perfil: el consumo de cada período coincide con el conteo directo (2000 redes)', () => {
  const rng = mulberry32(5);
  for (let i = 0; i < 2000; i++) {
    const m = modeloAleatorio(rng);
    const red = compilar(m);
    const c = cpm(red);
    const uso = perfil(red, c.ES);
    const mapa = aMapa(red, c.ES);
    assert.equal(uso[0].length, c.T);
    for (let k = 0; k < m.recursos.length; k++) for (let t = 1; t <= c.T; t++) assert.equal(uso[k][t - 1], usoEnPeriodo(m, mapa, k, t));
    // suma del consumo = Σ d·r
    m.recursos.forEach((_, k) => assert.equal(uso[k].reduce((s, x) => s + x, 0), m.acts.reduce((s, a) => s + a.d * a.r[k], 0)));
  }
});

test('picos y resumen: períodos sobre el límite', () => {
  const m = parseMarkdown(MD).modelo;
  const red = compilar(m);
  const c = cpm(red);
  // A 0-2 (3), B 0-3 (4), C 2-6 (2): uso = 7,7,6,2,2,2
  const r = resumen(red, c.ES);
  assert.deepEqual(r.porRecurso[0].uso, [7, 7, 6, 2, 2, 2]);
  assert.equal(r.porRecurso[0].pico, 7);
  assert.deepEqual(r.porRecurso[0].periodosPico, [1, 2]);
  assert.deepEqual(r.porRecurso[0].excesos, [{ periodo: 1, uso: 7, exceso: 1 }, { periodo: 2, uso: 7, exceso: 1 }]);
  assert.deepEqual(picos([1, 2], null), []);
  assert.equal(cotaInferior(red, c.T), 6); // trabajo 6+12+8 = 26 → ceil(26/6)=5; ruta crítica 6
  assert.ok(violaciones(red, c.ES).length > 0);
});
