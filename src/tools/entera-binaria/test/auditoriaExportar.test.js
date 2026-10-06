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
const { balas } = await import('../domain/balas.js');
const { enumerate } = await import('../domain/enumerar.js');
const { EJEMPLOS } = await import('../domain/ejemplos.js');
const { parseMarkdown, modelToMarkdown } = await import('../domain/modelo.js');
const { borradorDeModelo, borradorAMarkdown } = await import('../hooks/useSolver.js').catch(() => ({}));

const M = (id) => EJEMPLOS.find((e) => e.id === id).model;

test('plano y crudo', () => {
  assert.equal(X.plano('x₁₂ + x₃′ ≤ 5, xⱼ ∈ {0,1}'), "x12 + x3' ≤ 5, xj en {0,1}");
  assert.equal(X.crudo(0.5), '0.5');
  assert.equal(X.crudo(-0.00001), '0');
  assert.equal(X.crudo(1 / 3), '0.3333');
  assert.equal(X.crudo(-0), '0');
});

test('seEligen y textoFactibles', () => {
  const m = M('T1');
  assert.equal(X.seEligen(m, [0, 0, 0]), 'No se elige ninguna variable');
  assert.equal(X.seEligen(m, [0, 1, 0]), 'Se elige x₂');
  assert.equal(X.seEligen(m, [1, 1, 1]), 'Se eligen x₁, x₂ y x₃');
  assert.equal(X.textoFactibles(1, 8), '1 de 8 combinaciones es factible');
  assert.equal(X.textoFactibles(4, 8), '4 de 8 combinaciones son factibles');
  assert.equal(X.textoFactibles(0, 8), '0 de 8 combinaciones son factibles');
});

test('lineasResultado: enumeración (óptimo, empate, infactible) y balas (óptimo, límite, infactible)', () => {
  const m = M('T3');
  const e = enumerate(m);
  assert.deepEqual(X.lineasResultado(m, 'enumeracion', e), ['Óptimo: Z = 10', 'Se eligen x₂ y x₃', '4 de 8 combinaciones son factibles']);
  const empate = { sense: 'max', names: ['x1', 'x2'], c: [1, 1], constraints: [{ name: 'R', a: [1, 1], op: '<=', b: 1 }] };
  const l = X.lineasResultado(empate, 'enumeracion', enumerate(empate));
  assert.equal(l[1], 'Hay 2 soluciones óptimas (empate):');
  assert.equal(l.length, 5);
  const inf = { sense: 'min', names: ['x1'], c: [1], constraints: [{ name: 'R', a: [1], op: '>=', b: 2 }] };
  assert.equal(X.lineasResultado(inf, 'enumeracion', enumerate(inf))[0], 'El problema no tiene solución factible');
  assert.equal(X.lineasResultado(inf, 'balas', balas(inf))[0], 'El problema no tiene solución factible');
  const b = balas(M('MOCHILA'));
  const lb = X.lineasResultado(M('MOCHILA'), 'balas', b);
  assert.ok(lb[0].startsWith('Óptimo: Z = 21'));
  assert.equal(lb[1], 'Se eligen x₂, x₃ y x₄ (variables originales)');
  assert.equal(lb[2], `Nodos explorados: ${b.trace.length}`);
  const lim = balas(M('MOCHILA'), { maxNodes: 1 });
  assert.equal(lim.status, 'limite');
  assert.ok(X.lineasResultado(M('MOCHILA'), 'balas', lim)[0].startsWith('Se alcanzó el límite'));
  assert.ok(X.lineasResultado(M('MOCHILA'), 'balas', lim).some((s) => s.includes('No se encontró ninguna solución factible antes del límite')));
});

test('tablaDatos coincide con el cálculo (enumeración y traza)', () => {
  const m = M('T3');
  const e = enumerate(m);
  const t = X.tablaDatos(m, 'enumeracion', e, X.crudo);
  assert.equal(t.rows.length, 8);
  assert.deepEqual(t.headers, ['Combinación', 'Capacidad', 'Z', 'Estado']);
  const fila = t.rows.find((r) => r[0] === '011');
  assert.deepEqual(fila, ['011', '140', '10', 'Óptima']);
  assert.equal(t.rows.find((r) => r[0] === '100')[3], 'No factible');
  assert.equal(t.rows.find((r) => r[0] === '111')[3], 'Factible');
  assert.equal(t.optimas.filter(Boolean).length, 1);
  const big = { sense: 'max', names: Array.from({ length: 13 }, (_, j) => 'x' + (j + 1)), c: Array(13).fill(1), constraints: [] };
  assert.equal(X.tablaDatos(big, 'enumeracion', enumerate(big)), null);
  const b = balas(m);
  const tb = X.tablaDatos(m, 'balas', b);
  assert.equal(tb.rows.length, b.trace.length);
  assert.equal(tb.rows[0][1], 'raíz');
});

test('exportarCSV: BOM, comillas, comas y punto decimal', async () => {
  guardados.length = 0;
  const m = M('T3');
  await X.exportarCSV({ model: m, metodo: 'enumeracion', data: enumerate(m) });
  const csv = guardados[0].data;
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const lineas = csv.slice(1).split('\n');
  assert.equal(lineas[0], 'Combinación,Capacidad,Z,Estado');
  assert.equal(lineas.length, 9);
  assert.ok(lineas.includes('011,140,10,Óptima'));
  // traza de balas: el motivo lleva comas/decimales y debe ir entrecomillado con 5 columnas efectivas
  const mo = { sense: 'min', names: ['x1', 'x2'], c: [1.5, 2], constraints: [{ name: 'Re,stricción "a"', a: [1, 1], op: '>=', b: 1 }] };
  guardados.length = 0;
  await X.exportarCSV({ model: mo, metodo: 'balas', data: balas(mo) });
  const filas = guardados[0].data.slice(1);
  assert.ok(filas.includes('"'), 'campos con coma o comillas van entrecomillados');
  // parseo CSV mínimo para comprobar que todas las filas tienen 7 campos
  const parse = (txt) => {
    const out = []; let row = []; let cur = ''; let q = false;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); out.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    row.push(cur); out.push(row); return out;
  };
  const r = parse(filas);
  assert.ok(r.length >= 2);
  r.forEach((f) => assert.equal(f.length, 7, JSON.stringify(f)));
  // sin tabla (n > 12): resumen
  const big = { sense: 'max', names: Array.from({ length: 13 }, (_, j) => 'x' + (j + 1)), c: Array(13).fill(1), constraints: [] };
  guardados.length = 0;
  await X.exportarCSV({ model: big, metodo: 'enumeracion', data: enumerate(big) });
  assert.ok(guardados[0].data.includes('Combinaciones,8192'));
  assert.ok(guardados[0].data.includes('Z óptimo,13'));
});

test('exportarMarkdown: tabla con el mismo número de celdas en todas las filas y datos correctos', async () => {
  for (const [id, metodo] of [['T3', 'enumeracion'], ['T2', 'balas'], ['MOCHILA', 'balas'], ['ASIGNACION', 'balas']]) {
    guardados.length = 0;
    const m = M(id);
    await X.exportarMarkdown({ model: m, metodo, data: metodo === 'enumeracion' ? enumerate(m) : balas(m) });
    const md = guardados[0].data;
    const tabla = md.split('\n').filter((l) => l.startsWith('| '));
    const cols = tabla[0].split(' | ').length;
    tabla.forEach((l) => assert.equal(l.split(' | ').length, cols, l));
    assert.ok(md.includes('- Óptimo: Z = '));
    assert.ok(md.includes('- xⱼ ∈ {0, 1} para todo j'));
  }
});

test('avisosTransformacion', () => {
  const m = M('T1');
  const a = X.avisosTransformacion(m, balas(m));
  assert.deepEqual(a, []);
  const max = { sense: 'max', names: ['x1', 'x2'], c: [3, -2], constraints: [{ name: 'R', a: [1, 1], op: '=', b: 1 }] };
  const a2 = X.avisosTransformacion(max, balas(max));
  assert.equal(a2.length, 2);
  assert.ok(a2[0].includes('complementos'));
  assert.ok(a2[1].includes('2 restricciones'));
});

test('hooks: borrador ↔ Markdown conserva el modelo (puro, sin React)', async (t) => {
  if (!borradorDeModelo) { t.skip('useSolver no importable sin React'); return; }
  for (const e of EJEMPLOS) {
    const d = borradorDeModelo(e.model);
    const r = parseMarkdown(borradorAMarkdown(d));
    assert.deepEqual(r.errors, [], e.id);
    assert.deepEqual(r.model, e.model, e.id);
    assert.deepEqual(parseMarkdown(modelToMarkdown(e.model)).model, e.model);
  }
  // decimales con coma y negativos escritos por el usuario en la tabla
  const d = borradorDeModelo(M('T1'));
  d.c[0] = '-1,5'; d.rows[0].a[1] = '2,25'; d.rows[0].b = '3,5'; d.rows[1].a[0] = '';
  const r = parseMarkdown(borradorAMarkdown(d));
  assert.deepEqual(r.errors, []);
  assert.equal(r.model.c[0], -1.5);
  assert.equal(r.model.constraints[0].a[1], 2.25);
  assert.equal(r.model.constraints[0].b, 3.5);
  assert.equal(r.model.constraints[1].a[0], 0);
  // nombre de restricción con barra vertical no rompe la tabla
  const d2 = borradorDeModelo(M('T1'));
  d2.rows[0].name = 'a|b';
  assert.deepEqual(parseMarkdown(borradorAMarkdown(d2)).errors, []);
});

test('logica: cada restricción lógica equivale a su predicado en todas las combinaciones', async () => {
  const { restriccionLogica } = await import('../domain/logica.js');
  const { evaluate } = await import('../domain/evaluar.js');
  const n = 4;
  const names = ['x1', 'x2', 'x3', 'x4'];
  const todas = Array.from({ length: 16 }, (_, m) => [0, 1, 2, 3].map((j) => (m >> j) & 1));
  const subconj = [[0], [1, 2], [0, 3], [0, 1, 2, 3], [2, 1, 3]];
  const casos = [];
  for (const vars of subconj) {
    for (let k = 0; k <= vars.length; k++) {
      casos.push(['aLoSumo', { vars, k }, (x) => vars.reduce((t, j) => t + x[j], 0) <= k]);
      casos.push(['alMenos', { vars, k }, (x) => vars.reduce((t, j) => t + x[j], 0) >= k]);
      casos.push(['exactamente', { vars, k }, (x) => vars.reduce((t, j) => t + x[j], 0) === k]);
    }
    casos.push(['excluyentes', { vars }, (x) => vars.reduce((t, j) => t + x[j], 0) <= 1]);
    casos.push(['alMenosUno', { vars }, (x) => vars.some((j) => x[j] === 1)]);
  }
  for (const [a, b] of [[0, 1], [1, 0], [2, 3]]) {
    casos.push(['requiere', { a, b }, (x) => !(x[a] === 1 && x[b] === 0)]);
    casos.push(['juntos', { a, b }, (x) => x[a] === x[b]]);
  }
  for (const [tipo, p, pred] of casos) {
    const r = restriccionLogica(tipo, p, names);
    const m = { sense: 'max', names, c: [0, 0, 0, 0], constraints: [r] };
    for (const x of todas) assert.equal(evaluate(m, x).feasible, pred(x), `${tipo} ${JSON.stringify(p)} ${x}`);
  }
  assert.throws(() => restriccionLogica('aLoSumo', { vars: [0], k: 2 }, names));
  assert.throws(() => restriccionLogica('aLoSumo', { vars: [0, 0], k: 1 }, names));
  assert.throws(() => restriccionLogica('aLoSumo', { vars: [], k: 1 }, names));
  assert.throws(() => restriccionLogica('requiere', { a: 1, b: 1 }, names));
  assert.throws(() => restriccionLogica('aLoSumo', { vars: [9], k: 1 }, names));
  assert.throws(() => restriccionLogica('aLoSumo', { vars: [0], k: 0.5 }, names));
});

test('regresiones de la auditoría: máx/mín, miles con coma, fmtNum grande, pasos con límite sin solución', async () => {
  const { fmtNum } = await import('../domain/format.js');
  const { pasosBalas } = await import('../domain/pasos.js');
  const H = '| R | x1 | Signo | b |\n|---|---|---|---|\n';
  assert.equal(parseMarkdown(H + '| máx Z | 3 | | |').model.sense, 'max');
  assert.equal(parseMarkdown(H + '| Mín Z | 3 | | |').model.sense, 'min');
  const e = parseMarkdown(H + '| max Z | 1.000,5 | | |').errors[0].mensaje;
  assert.ok(e.includes('miles') && e.includes('1000,5'));
  assert.equal(fmtNum(1e21), '1e+21');
  assert.equal(fmtNum(123456789012345), '123456789012345');
  const m = M('CENTROS');
  const ps = pasosBalas(m, { maxNodes: 1 });
  assert.ok(/límite de nodos/.test(ps[ps.length - 1].texto));
  const p = pasosBalas({ sense: 'max', names: ['x1', 'x2'], c: [-3, 5], constraints: [] });
  assert.ok(p[0].texto.includes('Z transformada'));
  assert.ok(!/ \+ −/.test(pasosBalas(M('T1')).map((q) => q.calculo.join('\n')).join('\n')));
});
