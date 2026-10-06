import test from 'node:test';
import assert from 'node:assert/strict';
import { fmtNum, sub, expresionLineal, restriccionTexto, objetivoTexto } from '../domain/format.js';
import { validateModel, parseMarkdown, modelToMarkdown, defaultNames } from '../domain/modelo.js';
import { restriccionLogica } from '../domain/logica.js';
import { evaluate } from '../domain/evaluar.js';
import { enumerate } from '../domain/enumerar.js';
import { EJEMPLOS } from '../domain/ejemplos.js';
import { mulberry32, modeloAleatorio, fuerzaBruta, clave } from './utils.mjs';

const ej = (id) => EJEMPLOS.find((e) => e.id === id);
const M = (id) => ej(id).model;

test('format', () => {
  assert.equal(fmtNum(21), '21');
  assert.equal(fmtNum(0.6), '0,6');
  assert.equal(fmtNum(1 / 3), '0,3333');
  assert.equal(fmtNum(-3), '-3');
  assert.equal(fmtNum(0), '0');
  assert.equal(fmtNum(-0.00001), '0');
  assert.equal(sub('x12'), 'x₁₂');
  assert.equal(sub('A'), 'A');
  assert.equal(objetivoTexto(M('T1')), 'Minimizar Z = 2x₁ + 3x₂ + x₃');
  assert.equal(restriccionTexto(M('T1'), 0), 'x₁ + 2x₂ + x₃ ≥ 3');
  assert.equal(objetivoTexto(M('PROYECTOS_5')), 'Maximizar Z = 8A + 10B + 6C + 11D + 5E');
  assert.equal(expresionLineal([1, -1, 0], ['x1', 'x2', 'x3']), 'x₁ − x₂');
  assert.equal(expresionLineal([-1, 1], ['x1', 'x2']), '−x₁ + x₂');
  assert.equal(expresionLineal([0, 0], ['x1', 'x2']), '0');
  assert.equal(expresionLineal([0.5, 2], ['x1', 'x2']), '0,5x₁ + 2x₂');
});

test('ejemplos válidos', () => {
  for (const e of EJEMPLOS) assert.deepEqual(validateModel(e.model), [], e.id);
});

test('parseMarkdown de T2 y ida y vuelta de todos los ejemplos', () => {
  const t = `| Restricción | x1 | x2 | x3 | Signo | b |
|---|---|---|---|---|---|
| max Z | 50 | 40 | 35 | | |
| Presupuesto | 30 | 25 | 20 | <= | 50 |`;
  const r = parseMarkdown(t);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.model, M('T2'));
  for (const e of EJEMPLOS) {
    const rt = parseMarkdown(modelToMarkdown(e.model));
    assert.deepEqual(rt.errors, [], e.id);
    assert.deepEqual(rt.model, e.model, e.id);
  }
});

test('parseMarkdown: opcionales (sin separador, encabezado sin barras externas, símbolos y comas)', () => {
  const r = parseMarkdown(`Restricción | a | b | Signo | b
| minimizar | 1,5 | 2 | | |
| | 1 | | ≥ | 0,5 |`);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.model, {
    sense: 'min', names: ['a', 'b'], c: [1.5, 2],
    constraints: [{ name: 'R1', a: [1, 0], op: '>=', b: 0.5 }],
  });
});

const ENC = '| Restricción | x1 | x2 | x3 | Signo | b |\n|---|---|---|---|---|---|\n| min Z | 2 | 3 | 1 | | |\n';

test('parseMarkdown: errores', () => {
  let r = parseMarkdown(ENC + '| R1 | 1 | 2 | 1 | >= | 3 |\n| R2 | 1 | >= | 2 |');
  assert.equal(r.model, null);
  assert.equal(r.errors[0].fila, 3);
  assert.match(r.errors[0].mensaje, /columnas/);
  assert.match(r.errors[0].mensaje, /Fila 3: se esperaban 6 columnas y llegaron 4/);

  r = parseMarkdown(ENC + '| R1 | 1 | 2 | 1 | => | 3 |');
  assert.match(r.errors[0].mensaje, /signo/);
  assert.equal(r.errors[0].campo, 'signo');

  r = parseMarkdown(ENC + '| R1 | 1 | abc | 1 | >= | 3 |');
  assert.equal(r.errors[0].campo, 'x2');
  assert.match(r.errors[0].mensaje, /número/);
  assert.equal(r.errors[0].fila, 2);

  r = parseMarkdown('| Restricción | x1 | x2 | Signo | b |\n|---|---|---|---|---|\n| Z | 1 | 2 | | |\n');
  assert.match(r.errors[0].mensaje, /max o min/);

  r = parseMarkdown(ENC + '| R1 | 1.000 | 2 | 1 | >= | 3 |');
  assert.match(r.errors[0].mensaje, /miles/);
  r = parseMarkdown(ENC + '| R1 | 1 | 2 | 1 | >= | 1,000 |');
  assert.match(r.errors[0].mensaje, /miles/);

  r = parseMarkdown(ENC + '| R1 | 1 | 2 | 1 | >= | |');
  assert.equal(r.errors[0].campo, 'b');
  assert.match(r.errors[0].mensaje, /b/);

  r = parseMarkdown(ENC + '| R1 | 0,5 | 2 | 1 | >= | 3 |');
  assert.equal(r.model.constraints[0].a[0], 0.5);

  r = parseMarkdown('| Restricción | x1 | x1 | Signo | b |\n|---|---|---|---|---|\n| max Z | 1 | 1 | | |');
  assert.equal(r.model, null);
  assert.match(r.errors[0].mensaje, /repetido/);

  r = parseMarkdown(ENC);
  assert.equal(r.errors.length, 0);
  assert.equal(r.warnings.length, 1);
  assert.deepEqual(parseMarkdown('').model, null);
});

test('validateModel', () => {
  const base = M('T1');
  assert.ok(validateModel({ ...base, sense: 'x' }).length);
  assert.ok(validateModel({ ...base, names: ['a', 'a', 'b'] }).length);
  assert.ok(validateModel({ ...base, names: ['a', 'b c', 'd'] }).length);
  assert.ok(validateModel({ ...base, c: [1, 2] }).length);
  assert.ok(validateModel({ ...base, c: [1, NaN, 2] }).length);
  assert.ok(validateModel({ ...base, constraints: [{ name: 'r', a: [1, 1, 1], op: '<', b: 1 }] }).length);
  assert.ok(validateModel({ ...base, constraints: [{ name: 'r', a: [1, 1, 1], op: '<=', b: Infinity }] }).length);
  const n31 = defaultNames(31);
  assert.ok(validateModel({ sense: 'max', names: n31, c: n31.map(() => 1), constraints: [] }).length);
  assert.deepEqual(validateModel({ sense: 'max', names: ['x1'], c: [1], constraints: [] }), []);
});

test('logica', () => {
  const nm = ['x1', 'x2', 'x3'];
  let r = restriccionLogica('requiere', { a: 1, b: 0 }, nm);
  assert.deepEqual([r.a, r.op, r.b], [[-1, 1, 0], '<=', 0]);
  assert.equal(r.name, 'x₂ solo si x₁');
  r = restriccionLogica('aLoSumo', { vars: [0, 1, 2], k: 2 }, nm);
  assert.deepEqual([r.a, r.op, r.b], [[1, 1, 1], '<=', 2]);
  assert.equal(r.name, 'A lo sumo 2 de (x₁, x₂, x₃)');
  r = restriccionLogica('alMenosUno', { vars: [0, 1] }, defaultNames(5));
  assert.deepEqual([r.a, r.op, r.b], [[1, 1, 0, 0, 0], '>=', 1]);
  assert.equal(restriccionLogica('juntos', { a: 0, b: 2 }, nm).op, '=');
  assert.equal(restriccionLogica('alMenos', { vars: [0, 1], k: 1 }, nm).op, '>=');
  assert.equal(restriccionLogica('exactamente', { vars: [0, 1], k: 1 }, nm).op, '=');
  assert.deepEqual(restriccionLogica('excluyentes', { vars: [0, 2] }, nm).a, [1, 0, 1]);
  assert.throws(() => restriccionLogica('requiere', { a: 0, b: 5 }, nm));
  assert.throws(() => restriccionLogica('requiere', { a: 1, b: 1 }, nm));
  assert.throws(() => restriccionLogica('aLoSumo', { vars: [0, 1], k: 1.5 }, nm));
  assert.throws(() => restriccionLogica('aLoSumo', { vars: [], k: 1 }, nm));
  assert.throws(() => restriccionLogica('aLoSumo', { vars: [0, 9], k: 1 }, nm));
});

test('evaluate', () => {
  let e = evaluate(M('T3'), [0, 1, 1]);
  assert.deepEqual([e.lhs, e.satisfied, e.feasible, e.z, e.violationTotal], [[140], [true], true, 10, 0]);
  e = evaluate(M('T3'), [1, 0, 0]);
  assert.deepEqual([e.lhs, e.feasible, e.violationTotal], [[100], false, 40]);
  e = evaluate(M('T1'), [1, 1, 0]);
  assert.deepEqual([e.lhs, e.satisfied, e.z, e.violationTotal], [[3, 3], [true, false], 5, 1]);
  assert.equal(evaluate(M('ASIGNACION'), Array(9).fill(0)).violationTotal, 6);
});

test('enumerate: ejemplos contra lo esperado', () => {
  for (const id of ['T1', 'T2', 'T3', 'CENTROS', 'MOCHILA_EXCL', 'TORRES', 'PROYECTOS_5', 'ESTACIONES', 'MOCHILA', 'ASIGNACION']) {
    const { model, esperado } = ej(id);
    const r = enumerate(model);
    assert.equal(r.status, 'optimo', id);
    assert.equal(r.best.z, esperado.z, id);
    assert.deepEqual(r.best.solutions, esperado.soluciones, id);
    assert.equal(r.feasibleCount, esperado.factibles, id);
    assert.equal(r.total, 2 ** model.names.length, id);
  }
});

test('enumerate: orden binario de T3', () => {
  const r = enumerate(M('T3'));
  assert.deepEqual(r.rows.map((f) => f.x.join('')), ['000', '001', '010', '011', '100', '101', '110', '111']);
  assert.deepEqual(r.rows.filter((f) => f.feasible).map((f) => f.x.join('')), ['011', '101', '110', '111']);
  assert.deepEqual(r.rows.map((f) => f.z), [0, 4, 6, 10, 8, 12, 14, 18]);
});

test('enumerate: bordes', () => {
  const mk = (sense, c, a, op, b) => ({ sense, names: defaultNames(c.length), c, constraints: [{ name: 'R', a, op, b }] });
  let r = enumerate(mk('min', [1, 1], [1, 1], '>=', 3));
  assert.equal(r.status, 'infactible');
  assert.equal(r.best, null);
  assert.equal(r.feasibleCount, 0);
  r = enumerate(mk('min', [1, 1], [1, 1], '>=', 1));
  assert.equal(r.feasibleCount, 3);
  assert.equal(r.best.z, 1);
  assert.deepEqual(r.best.solutions, [[0, 1], [1, 0]]);
  r = enumerate(mk('max', [5], [3], '<=', 2));
  assert.deepEqual(r.best.solutions, [[0]]);
  assert.equal(r.best.z, 0);
  assert.equal(r.feasibleCount, 1);
  const n21 = defaultNames(21);
  assert.throws(() => enumerate({ sense: 'min', names: n21, c: n21.map(() => 1), constraints: [] }), /20/);
  assert.equal(enumerate(M('T1'), { keepRows: false }).rows, null);
  assert.equal(enumerate(M('T1')).rows.length, 8);
  const n13 = defaultNames(13);
  assert.equal(enumerate({ sense: 'min', names: n13, c: n13.map(() => 1), constraints: [] }).rows, null);
});

for (const semilla of [12345, 777]) {
  test(`enumerate contra fuerza bruta independiente (300 modelos, semilla ${semilla})`, () => {
    const rng = mulberry32(semilla);
    for (let k = 0; k < 300; k++) {
      const model = modeloAleatorio(rng);
      const a = enumerate(model);
      const b = fuerzaBruta(model);
      assert.equal(a.status, b.status, `modelo ${k}`);
      assert.equal(a.feasibleCount, b.factibles, `modelo ${k}`);
      if (b.status === 'optimo') {
        assert.equal(a.best.z, b.z, `modelo ${k}`);
        assert.equal(clave(a.best.solutions), clave(b.sols), `modelo ${k}`);
      }
    }
  });
}

test('lógica combinada: max 3x₁+9x₂+4x₃ con x₂ ≤ x₁', () => {
  const model = {
    sense: 'max', names: defaultNames(3), c: [3, 9, 4],
    constraints: [
      { name: 'Cap', a: [3, 2, 2], op: '<=', b: 4 },
      restriccionLogica('requiere', { a: 1, b: 0 }, defaultNames(3)),
    ],
  };
  const r = enumerate(model);
  assert.equal(r.feasibleCount, 3);
  assert.deepEqual(r.best.solutions, [[0, 0, 1]]);
  assert.equal(r.best.z, 4);
});

test('rendimiento: n = 20', () => {
  const n = 20;
  const model = { sense: 'max', names: defaultNames(n), c: Array.from({ length: n }, (_, j) => j + 1), constraints: [{ name: 'Suma', a: Array(n).fill(1), op: '<=', b: 10 }] };
  const t0 = performance.now();
  const r = enumerate(model, { keepRows: false });
  console.log(`enumerate n=20: ${Math.round(performance.now() - t0)} ms`);
  assert.equal(r.total, 1048576);
  assert.equal(r.best.z, 11 + 12 + 13 + 14 + 15 + 16 + 17 + 18 + 19 + 20);
});
