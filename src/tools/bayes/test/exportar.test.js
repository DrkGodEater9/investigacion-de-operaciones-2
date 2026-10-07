import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

// exportar.js importa '@/shared/files.js' (alias de Vite): se resuelve con un hook mínimo.
const SRC = pathToFileURL(fileURLToPath(new URL('../../../', import.meta.url))).href;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, n) { if (s.startsWith('@/')) return n(${JSON.stringify(SRC)} + s.slice(2), c); return n(s, c); }`,
));

const guardados = [];
globalThis.window = { claude: { use: async () => ({ save: async (f) => { guardados.push(f); } }) } };

const X = await import('../utils/exportar.js');
const { analizar } = await import('../domain/bayes.js');
const { EJEMPLOS, ejemploPorId } = await import('../domain/ejemplos.js');
const { PLANTILLA_IA } = await import('../domain/plantilla.js');

const todo = (id) => { const p = ejemploPorId(id).problema; return { p, a: analizar(p) }; };

test('plano: ASCII para la fuente del PDF', () => {
  assert.equal(X.plano('x₁₂ ≤ −5'), 'x12 <= -5');
});

test('Markdown de B1: secciones, coma decimal y cifras del resultado', () => {
  const { p, a } = todo('B1');
  const md = X.construirMarkdown(p, a, '1/1/2026');
  assert.match(md, /^# Teoría bayesiana de la decisión: resultados/);
  assert.match(md, /Fecha: 1\/1\/2026/);
  assert.match(md, /- Probabilidades a priori: Petróleo = 0,3; Seco = 0,7\./);
  assert.match(md, /- VEcIP = 192; VEIP = 112\./);
  assert.match(md, /- VEcIM = 132; VEIM = 52\./);
  assert.match(md, /Eficiencia = 46,4 %/);
  for (const t of ['Matriz de pagos', 'Información perfecta', 'Verosimilitud', 'Probabilidades conjuntas', 'Probabilidades posteriores', 'Decisión óptima', 'Resumen de valores', 'Criterios']) {
    assert.ok(md.includes('## ' + t) || md.includes(t), t);
  }
  assert.match(md, /\| Perforar \| 500 \| −100 \| 80 \|/);
  assert.match(md, /\| P\(indicador\) \| 0,45 \| 0,55 \| 1 \|/);
  assert.ok(!/NaN|undefined/.test(md));
});

test('Markdown sin información muestral: no trae tablas de posteriores', () => {
  const { p, a } = todo('B4');
  const md = X.construirMarkdown(p, a);
  assert.ok(!md.includes('posteriores'));
  assert.match(md, /VEIP = 120/);
});

test('CSV: punto decimal, secciones separadas por línea en blanco y comillas cuando hace falta', () => {
  const { p, a } = todo('B1');
  const csv = X.construirCSV(p, a);
  assert.ok(csv.startsWith('﻿'));
  const lineas = csv.slice(1).split('\n');
  assert.ok(lineas.includes('Perforar,500,-100,80'));
  assert.ok(lineas.includes('P(indicador),0.45,0.55,1'));
  assert.ok(lineas.some((l) => l === ''), 'separador entre tablas');
  // nombre con coma se entrecomilla
  const q = { ...p, alternativas: ['Perforar, ya', 'Vender'] };
  const csv2 = X.construirCSV(q, analizar(q));
  assert.ok(csv2.includes('"Perforar, ya",500,-100,80'));
  EJEMPLOS.forEach((e) => assert.ok(!/NaN|undefined/.test(X.construirCSV(e.problema, analizar(e.problema)))));
});

test('exportarMarkdown y exportarCSV guardan archivos con el nombre y el contenido esperados', async () => {
  const { p, a } = todo('B2');
  guardados.length = 0;
  assert.equal(await X.exportarMarkdown({ problema: p, analisis: a }), true);
  assert.equal(await X.exportarCSV({ problema: p, analisis: a }), true);
  assert.deepEqual(guardados.map((g) => g.filename), ['teoria-bayesiana-decision.md', 'teoria-bayesiana-decision.csv']);
  assert.match(guardados[0].data, /VEIP = 24/);
});

test('plantilla para IA: describe el formato que entiende parseMarkdown', async () => {
  assert.ok(PLANTILLA_IA, 'la plantilla existe');
  assert.match(PLANTILLA_IA, /Objetivo: maximizar/);
  assert.match(PLANTILLA_IA, /Prob\. a priori/);
  assert.match(PLANTILLA_IA, /verosimilitud/);
  assert.match(PLANTILLA_IA, /<pega aquí el enunciado>/);
});
