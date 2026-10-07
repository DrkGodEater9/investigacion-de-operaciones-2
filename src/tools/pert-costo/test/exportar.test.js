import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

// exportar.js importa '@/shared/files.js' (alias de Vite): se resuelve con un hook mínimo.
const SRC = pathToFileURL(fileURLToPath(new URL('../../../', import.meta.url))).href;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, n) { if (s.startsWith('@/')) return n(${JSON.stringify(SRC)} + s.slice(2), c); return n(s, c); }`,
));
globalThis.window = { claude: { use: async () => ({ save: async () => {} }) } };

const { textoCSV, textoMarkdown, plano } = await import('../utils/exportar.js');
const { analizar } = await import('../domain/analizar.js');
const { EJEMPLOS } = await import('../domain/ejemplos.js');

test('exportar: CSV y Markdown son funciones puras y repetibles, con las cifras del dominio', () => {
  for (const e of EJEMPLOS) {
    const a = analizar({ filas: e.filas, ci: e.ci, fijo: e.fijo });
    const csv1 = textoCSV(a);
    assert.equal(textoCSV(a), csv1);
    const bloques = csv1.replace('﻿', '').split('\n\n');
    assert.equal(bloques.length, 3);
    // una fila de curva por duración entera, sin huecos
    const filasCurva = bloques[2].split('\n').slice(2);
    assert.equal(filasCurva.length, a.res.estados.length);
    assert.equal(bloques[1].split('\n').length - 2, a.res.pasos.length);
    assert.doesNotMatch(csv1, /−|undefined|NaN/);
    const md = textoMarkdown(a, e.titulo);
    assert.ok(md.includes(`Duración de costo mínimo: ${a.res.optimo.T}`));
    assert.ok(md.includes(String(a.res.optimo.total).replace('.', ',')));
    assert.doesNotMatch(md, /undefined|NaN|Infinity/);
  }
  assert.equal(plano('A → B'), 'A → B');
});
