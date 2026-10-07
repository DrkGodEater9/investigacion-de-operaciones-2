import test from 'node:test';
import assert from 'node:assert/strict';
import { frac } from '../domain/fraction.js';
import { solveLP } from '../domain/simplex.js';
import { solveIP } from '../domain/branchAndBound.js';
import { planosDeCorte } from '../domain/cortes.js';
import { construirTablero, simplexPrimal, limpiarArtificiales, bmATexto } from '../domain/tablero.js';
import { modelToMarkdown, parseModelFromMarkdown } from '../domain/parser.js';
import { EXAMPLES } from '../domain/examples.js';
import { ejemplosMixta } from '../domain/examplesMixta.js';
import { formatoLineal, construirMarkdown, getNodesData, describirIntegralidad, resumenResultado } from '../utils/exportTexto.js';
import { toCSV } from '../../../shared/files.js';

const S = (arr) => arr.map(String);

test('parser: ida y vuelta de todos los ejemplos (pura y mixta)', () => {
  for (const e of [...EXAMPLES, ...ejemplosMixta]) {
    const p = parseModelFromMarkdown(modelToMarkdown(e, e.title));
    assert.equal(p.sense, e.sense, e.id);
    assert.deepEqual(p.c, e.c, e.id);
    assert.equal(p.numVars, e.numVars, e.id);
    assert.deepEqual(p.constraints, e.constraints.map(({ a, op, b }) => ({ a, op, b })), e.id);
    assert.deepEqual(p.integer, e.integer, e.id);
  }
});

test('parser: el título no cambia el sentido (Administración, Minimizar…) y «Sentido:» manda', () => {
  const base = { sense: 'max', numVars: 2, c: ['1', '2'], constraints: [{ a: ['1', '1'], op: '<=', b: '3' }] };
  for (const titulo of ['Administración de personal', 'Minimizar costo', 'Mínimos y máximos']) {
    assert.equal(parseModelFromMarkdown(modelToMarkdown(base, titulo)).sense, 'max', titulo);
    assert.equal(parseModelFromMarkdown(modelToMarkdown({ ...base, sense: 'min' }, titulo)).sense, 'min', titulo);
  }
  const tabla = '| Tipo | x1 | x2 | Op | b |\n|---|---|---|---|---|\n| FO | 3 | 2 | | |\n| R1 | 1 | 1 | >= | 4 |';
  assert.equal(parseModelFromMarkdown(`Minimizar\n${tabla}`).sense, 'min');
  assert.equal(parseModelFromMarkdown(`Maximizar\n${tabla}`).sense, 'max');
});

test('parser: fracciones, decimales con coma, operadores, celdas vacías, errores', () => {
  const md = '| Tipo | x1 | x2 | Op | b |\n|---|---|---|---|---|\n| FO | 3,5 | 1/2 | | |\n| R1 | 1 | -2 | =< | 4,5 |\n| R2 | 2 |  | ≥ | 2/3 |\n| R3 | 1 | 1 | = | 7 |';
  const p = parseModelFromMarkdown(md);
  assert.deepEqual(p.c, ['3,5', '1/2']);
  assert.deepEqual(p.constraints.map((c) => c.op), ['<=', '>=', '=']);
  assert.deepEqual(p.constraints[1].a, ['2', '0'], 'una celda vacía no corre las columnas');
  assert.equal(p.constraints[1].b, '2/3');
  // los valores se leen después con parseFraction sin pérdida
  assert.equal(String(frac(p.c[0])), '7/2');
  assert.equal(parseModelFromMarkdown('texto suelto'), null);
  assert.equal(parseModelFromMarkdown(''), null);
  assert.equal(parseModelFromMarkdown(null), null);
  // más variables de las que admite la herramienta: error, no un modelo recortado en silencio
  assert.equal(parseModelFromMarkdown('| Tipo | x1 | x2 | x3 | x4 | x5 | Op | b |\n|---|---|---|---|---|---|---|---|\n| FO | 1 | 1 | 1 | 1 | 1 | | |\n| R1 | 1 | 1 | 1 | 1 | 1 | <= | 4 |'), null);
  // sin restricciones: no se inventa ninguna
  assert.equal(parseModelFromMarkdown('| Tipo | x1 | x2 | Op | b |\n|---|---|---|---|---|\n| FO | 3 | 2 | | |'), null);
  // sin encabezado la fila FO no se pierde
  const sinEnc = parseModelFromMarkdown('| FO | 3 | 2 | | |\n| R1 | 1 | 1 | <= | 4 |');
  assert.deepEqual(sinEnc.c, ['3', '2']);
  assert.equal(sinEnc.constraints.length, 1);
  // «Enteras:» marca las continuas
  const mix = parseModelFromMarkdown(`Sentido: Maximizar\nEnteras: x2\n${md}`);
  assert.deepEqual(mix.integer, [false, true]);
});

test('exportación: expresiones lineales, Markdown completo y CSV con decimales con coma', () => {
  assert.equal(formatoLineal(['3', '-2', '0,5', '0']), '3x₁ − 2x₂ + (1/2)x₃');
  assert.equal(formatoLineal(['0', '0']), '0');
  assert.equal(formatoLineal(['1', '-1'], { ascii: true }), 'x1 - x2');
  const e = EXAMPLES[0];
  const m = { sense: e.sense, c: e.c, constraints: e.constraints, integer: e.integer };
  const r = solveIP({ ...m, options: e.options });
  const md = construirMarkdown(m, r, '01/01/2026');
  assert.ok(md.includes('Maximizar Z = 5x₁ + 4x₂'));
  assert.ok(md.includes('- 10x₁ + 6x₂ ≤ 45'));
  assert.ok(md.includes('**Valor óptimo Z*:** 23'));
  assert.ok(md.includes('**Punto óptimo X*:** (3; 2)'));
  assert.ok(md.includes('Relajación continua Z(P0):** 23,75 (95/4)'));
  assert.ok(md.includes('**Nodos explorados:** 3'));
  assert.ok(md.includes('| P2 | P0 | x1 ≥ 4 | (4; 0,83 (5/6)) | 23,33 (70/3) | Fraccionario | 23 | Podado por cota |'), md);
  // el CSV (separado por «;») entrecomilla lo que lleva coma
  const { headers, rows } = getNodesData(r);
  const csv = toCSV(headers, rows);
  assert.ok(csv.includes('"(4; 0,83 (5/6))"'));
  assert.equal(csv.split('\n').length, rows.length + 1);
  // límite de nodos: no se presenta como óptimo
  const lim = { sense: 'max', c: ['3', '5'], constraints: [{ a: ['6', '10'], op: '=', b: '1000001' }], integer: [true, true] };
  const rl = solveIP({ ...lim, options: { maxNodes: 20 } });
  const txt = resumenResultado(lim, rl).map((l) => `${l.k}: ${l.v}`).join('\n');
  assert.ok(/Límite de nodos/.test(txt) && !/Solución óptima/.test(txt));
  assert.ok(/continuas: x2/.test(describirIntegralidad({ c: [1, 1], integer: [true, false] })));
  assert.ok(/x_j enteras/.test(describirIntegralidad({ c: [1, 1], integer: [true, true] }, 'pdf')));
  const inf = solveIP({ sense: 'max', c: ['1', '0'], constraints: [{ a: ['2', '0'], op: '=', b: '3' }] });
  assert.ok(construirMarkdown({ sense: 'max', c: ['1', '0'], constraints: [{ a: ['2', '0'], op: '=', b: '3' }], integer: [true, true] }, inf, 'x').includes('Problema infactible'));
});

test('Teoría 1.1: cifras del ejemplo (19 puntos, vértices, P0, P1, P2, nota de 5 nodos) coinciden con el solucionador', () => {
  const m = { sense: 'max', c: [5, 4], constraints: [{ a: [1, 1], op: '<=', b: 5 }, { a: [10, 6], op: '<=', b: 45 }] };
  let n = 0;
  for (let a = 0; a <= 6; a++) for (let b = 0; b <= 6; b++) if (a + b <= 5 && 10 * a + 6 * b <= 45) n++;
  assert.equal(n, 19);
  const lp = solveLP(m);
  assert.deepEqual(S(lp.x), ['15/4', '5/4']);
  assert.equal(String(lp.z), '95/4');
  const r = solveIP({ ...m, options: { pruneWithFloor: true } });
  assert.equal(r.nodes.length, 3);
  assert.deepEqual(S(r.nodes[1].x), ['3', '2']);
  assert.equal(String(r.nodes[1].z), '23');
  assert.deepEqual(S(r.nodes[2].x), ['4', '5/6']);
  assert.equal(String(r.nodes[2].z), '70/3');
  assert.equal(r.nodes[2].action, 'pruned-bound');
  assert.deepEqual(S(r.best.x), ['3', '2']);
  const sin = solveIP({ ...m, options: { pruneWithFloor: false } });
  assert.equal(sin.nodes.length, 5);
  const p3 = sin.nodes.find((q) => q.branchVar === 1 && q.branchOp === '<=' && q.branchBound.eq(frac(0)));
  assert.deepEqual(S(p3.x), ['9/2', '0']);
  assert.equal(String(p3.z), '45/2');
  assert.ok(sin.nodes.some((q) => q.branchVar === 1 && q.branchOp === '>=' && q.status === 'infeasible'));
  // redondeos citados
  assert.equal(10 * 4 + 6 * 1, 46);
  assert.equal(5 * 3 + 4 * 1, 19);
  // Z = 23 → rectas (0; 23/4) y (23/5; 0)
  assert.equal(23 / 4, 5.75);
  assert.equal(23 / 5, 4.6);
  // mínimo con ⌈⌉: el ejemplo de minimización del sitio
  const mn = EXAMPLES.find((x) => x.id === 'minimizacion');
  assert.equal(String(solveIP(mn).best.z), '13');
});

test('Teoría 1.2: relajación, árbol, tablero, corte, continuación a entera pura y tabla del caso puro', () => {
  const m = { sense: 'max', c: [7, 9], constraints: [{ a: [-1, 3], op: '<=', b: 6 }, { a: [7, 1], op: '<=', b: 35 }], integer: [false, true] };
  const rel = solveLP(m);
  assert.deepEqual(S(rel.x), ['9/2', '7/2']);
  assert.equal(String(rel.z), '63');
  // x2 = 4 vuelve infactible (pide x1 ≥ 6 y 7x1 ≤ 31) y x2 = 3 da x1 = 32/7
  const fija4 = solveLP({ ...m, constraints: [...m.constraints, { a: [0, 1], op: '=', b: 4 }] });
  assert.equal(fija4.status, 'infeasible');
  const fija3 = solveLP({ ...m, constraints: [...m.constraints, { a: [0, 1], op: '=', b: 3 }] });
  assert.deepEqual(S(fija3.x), ['32/7', '3']);
  // segmentos de la figura 1: x1 máximo con x2 = 0,1,2 → 5, 34/7, 33/7
  for (const [k, tope] of [[0, '5'], [1, '34/7'], [2, '33/7']]) {
    const s = solveLP({ sense: 'max', c: [1, 0], constraints: [...m.constraints, { a: [0, 1], op: '=', b: k }] });
    assert.equal(String(s.x[0]), tope);
  }
  const r = solveIP(m);
  assert.equal(r.nodes.length, 3);
  assert.equal(String(r.best.z), '59');
  assert.deepEqual(S(r.best.x), ['32/7', '3']);
  assert.equal(r.nodes[2].status, 'infeasible');
  // tablero óptimo y corte
  const t0 = limpiarArtificiales(simplexPrimal(construirTablero(m)).tablero);
  assert.deepEqual(t0.zj.map(bmATexto), ['7', '9', '28/11', '15/11']);
  assert.deepEqual(t0.cz.map(bmATexto), ['0', '0', '-28/11', '-15/11']);
  const pc = planosDeCorte(m);
  assert.equal(pc.cortes.length, 1);
  const c1 = pc.cortes[0];
  assert.deepEqual(c1.coefs.map((q) => [q.nombre, String(q.valor)]), [['x3', '7/22'], ['x4', '1/22']]);
  assert.equal(String(c1.rhs), '1/2');
  assert.deepEqual([c1.enOriginales.op, ...S(c1.enOriginales.coefs), String(c1.enOriginales.rhs)], ['<=', '0', '1', '3']); // x2 ≤ 3
  const razones = c1.dual.iteraciones[0].razones.map((q) => (q ? String(q.valor) : null));
  assert.deepEqual(razones.filter(Boolean), ['8', '30']);
  const tf = pc.tableroFinal;
  const fila = (nm) => { const i = tf.base.findIndex((j) => tf.cols[j].nombre === nm); return [...S(tf.A[i]), String(tf.b[i])]; };
  assert.deepEqual(fila('x2'), ['0', '1', '0', '0', '1', '3']);
  assert.deepEqual(fila('x1'), ['1', '0', '0', '1/7', '-1/7', '32/7']);
  assert.deepEqual(fila('x3'), ['0', '0', '1', '1/7', '-22/7', '11/7']);
  assert.deepEqual(tf.cz.map(bmATexto), ['0', '0', '0', '-1', '-8']);
  assert.equal(bmATexto(tf.zval), '59');
  // continuación a entera pura: corte 1/7 x4 + 6/7 S1 ≥ 4/7  ⇔  x1 + x2 ≤ 7; resultado (4,3,1,4) con Z = 55
  const pura = planosDeCorte({ ...m, integer: [true, true] }, { tipo: 'fraccional' });
  const c2 = pura.cortes[1];
  assert.deepEqual(c2.coefs.map((q) => [q.nombre, String(q.valor)]), [['x4', '1/7'], ['S1', '6/7']]);
  assert.equal(String(c2.rhs), '4/7');
  assert.deepEqual([c2.enOriginales.op, ...S(c2.enOriginales.coefs), String(c2.enOriginales.rhs)], ['<=', '1', '1', '7']);
  assert.deepEqual(c2.dual.iteraciones[0].razones.filter(Boolean).map((q) => String(q.valor)), ['7', '28/3']);
  assert.equal(String(pura.z), '55');
  assert.deepEqual(S(pura.x), ['4', '3']);
  // árbol del caso puro: nodos #1..#5 de la tabla (nodo, Z)
  const rp = solveIP({ ...m, integer: [true, true] });
  const porRestr = (var_, op, b, padreBranch) => rp.nodes.find((q) => q.branchVar === var_ && q.branchOp === op && String(q.branchBound) === String(b) && (padreBranch === undefined || q.addedConstraints.length === padreBranch));
  assert.equal(String(porRestr(0, '<=', 4, 1).z), '58');
  assert.deepEqual(S(porRestr(0, '<=', 4, 1).x), ['4', '10/3']);
  assert.equal(String(porRestr(1, '<=', 3, 2).z), '55');
  assert.equal(porRestr(1, '>=', 4, 2).status, 'infeasible');
  assert.equal(String(porRestr(0, '>=', 5, 1).z), '35');
  // La Teoría lo llama «podado por cota (35 ≤ 55)» porque visita la rama ≤ antes; el solucionador resuelve ambos hijos
  // antes de bajar, así que (5,0) con Z = 35 entra primero como incumbente. La cota 35 ≤ 55 sí es cierta.
  assert.equal(porRestr(0, '>=', 5, 1).status, 'integer');
  assert.ok(porRestr(0, '>=', 5, 1).z.lte(rp.best.z));
  assert.equal(String(rp.best.z), '55');
  // callout de «cuándo vale la fórmula»: x_B + (5/4)s = 1/2 con s continua
  const f0 = frac('1/2');
  assert.equal(String(frac('5/4').fractionalPart()), '1/4');
  assert.equal(String(f0.mul(frac(1).sub(frac(0))).div(frac(1).sub(f0)).mul(frac(0))), '0');
  assert.ok(frac('1/4').mul(frac('2/5')).lt(f0)); // el corte (1/4)s ≥ 1/2 descartaría s = 2/5, factible
  assert.ok(frac('5/4').mul(frac('2/5')).gte(f0)); // el corte mixto (5/4)s ≥ 1/2 lo conserva
});
