import test from 'node:test';
import assert from 'node:assert/strict';
import { balas, aFormaBalas } from '../domain/balas.js';
import { pasosBalas, pasosEnumeracion } from '../domain/pasos.js';
import { enumerate } from '../domain/enumerar.js';
import { evaluate } from '../domain/evaluar.js';
import { EJEMPLOS } from '../domain/ejemplos.js';
import { defaultNames } from '../domain/modelo.js';
import { mulberry32, modeloAleatorio, fuerzaBruta } from './utils.mjs';

const M = (id) => EJEMPLOS.find((e) => e.id === id).model;
const col = (r, k) => r.trace.map((t) => t[k]);

test('traza de T1', () => {
  const r = balas(M('T1'));
  assert.equal(r.status, 'optimo');
  assert.deepEqual(r.best, { z: 6, x: [1, 1, 1] });
  assert.equal(r.trace.length, 7);
  assert.deepEqual(col(r, 'decision'), ['ramifica', 'ramifica', 'ramifica', 'factible', 'poda-infactible', 'poda-infactible', 'poda-infactible']);
  assert.deepEqual(col(r, 'id'), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(col(r, 'parentId'), [null, 1, 2, 3, 3, 2, 1]);
  assert.deepEqual(col(r, 'branchVar'), [0, 1, 2, null, null, null, null]);
  assert.deepEqual(col(r, 'z'), [0, 2, 5, 6, 5, 2, 0]);
  assert.deepEqual(col(r, 's'), [[-3, -4], [-2, -2], [0, -1], [1, 1], [0, -1], [-2, -2], [-3, -4]]);
  assert.deepEqual(r.trace[4].rama, { j: 2, valor: 0 });
  assert.deepEqual(r.trace[5].rama, { j: 1, valor: 0 });
  assert.deepEqual(r.trace[6].rama, { j: 0, valor: 0 });
  assert.equal(r.trace[0].rama, null);
  assert.deepEqual(r.trace[0].Ij, { 0: 4, 1: 4, 2: 4 });
});

test('traza de T3', () => {
  const r = balas(M('T3'));
  assert.equal(r.status, 'optimo');
  assert.deepEqual(r.best, { z: 10, x: [0, 1, 1] });
  assert.equal(r.trace.length, 11);
  assert.deepEqual(col(r, 'decision'), ['ramifica', 'ramifica', 'factible', 'ramifica', 'factible', 'poda-infactible', 'ramifica', 'ramifica', 'factible', 'poda-infactible', 'poda-infactible']);
  assert.deepEqual(col(r, 'parentId'), [null, 1, 2, 2, 4, 4, 1, 7, 8, 8, 7]);
  assert.deepEqual(col(r, 'z'), [0, 8, 14, 8, 12, 8, 0, 6, 10, 6, 0]);
  assert.deepEqual(col(r, 's'), [[-140], [-40], [40], [-40], [20], [-40], [-140], [-60], [0], [-60], [-140]]);
  assert.deepEqual(col(r, 'zStar'), [null, null, null, 14, 14, 12, 12, 12, 12, 10, 10]);
  assert.deepEqual(r.incumbentHistory.map((h) => [h.z, h.x]), [[14, [1, 1, 0]], [12, [1, 0, 1]], [10, [0, 1, 1]]]);
});

test('transformaciones', () => {
  const t = aFormaBalas(M('T2'));
  assert.deepEqual(t.comp, [true, true, true]);
  assert.equal(t.K, -125);
  assert.deepEqual(t.c, [50, 40, 35]);
  assert.deepEqual(t.A, [[-30, -25, -20]]);
  assert.deepEqual(t.b, [-25]);
  assert.equal(t.signo, -1);
  assert.deepEqual(t.nombres, ['x1′', 'x2′', 'x3′']);
  assert.deepEqual(balas(M('T2')).best, { z: 85, x: [1, 0, 1] });

  const neg = { sense: 'min', names: ['x1', 'x2'], c: [-1, 2], constraints: [{ name: 'R', a: [1, 1], op: '<=', b: 1 }] };
  const t2 = aFormaBalas(neg);
  assert.deepEqual([t2.comp, t2.K, t2.c, t2.A, t2.b], [[true, false], -1, [1, 2], [[-1, 1]], [0]]);
  assert.deepEqual(balas(neg).best, { z: -1, x: [1, 0] });
});

test('igualdades (ASIGNACION)', () => {
  assert.equal(aFormaBalas(M('ASIGNACION')).A.length, 12);
  const r = balas(M('ASIGNACION'));
  assert.equal(r.best.z, 8);
  assert.deepEqual(r.best.x, [0, 1, 0, 0, 0, 1, 1, 0, 0]);
});

test('infactible y límite de nodos', () => {
  const inf = { sense: 'min', names: ['x1', 'x2'], c: [1, 1], constraints: [{ name: 'R', a: [1, 1], op: '>=', b: 3 }] };
  const r = balas(inf);
  assert.equal(r.status, 'infactible');
  assert.equal(r.best, null);
  assert.equal(balas(M('CENTROS'), { maxNodes: 2 }).status, 'limite');
});

test('poda por cota (modelo que la fuerza)', () => {
  const model = {
    sense: 'min', names: defaultNames(3), c: [6, 1, 5],
    constraints: [
      { name: 'R1', a: [0, 1, 1], op: '>=', b: 1 },
      { name: 'R2', a: [1, 0, 1], op: '>=', b: 1 },
    ],
  };
  const r = balas(model);
  assert.equal(r.trace.length, 3);
  assert.deepEqual(col(r, 'decision'), ['ramifica', 'factible', 'poda-cota']);
  assert.equal(r.trace[0].branchVar, 2);
  assert.deepEqual(r.best, { z: 5, x: [0, 0, 1] });
});

test('casos con óptimo conocido', () => {
  assert.equal(balas(M('MOCHILA')).best.z, 21);
  assert.deepEqual(balas(M('MOCHILA')).best.x, [0, 1, 1, 1]);
  assert.equal(balas(M('PROYECTOS_5')).best.z, 24);
});

for (const semilla of [4242, 9001]) {
  test(`balas equivale a enumerate (300 modelos, semilla ${semilla})`, () => {
    const rng = mulberry32(semilla);
    for (let k = 0; k < 300; k++) {
      const model = modeloAleatorio(rng);
      const e = enumerate(model);
      const b = balas(model);
      const bf = fuerzaBruta(model);
      assert.equal(b.status === 'optimo', e.status === 'optimo', `modelo ${k}`);
      assert.equal(bf.status === 'optimo', e.status === 'optimo', `modelo ${k}`);
      if (e.status === 'optimo') {
        assert.ok(Math.abs(b.best.z - e.best.z) < 1e-9, `modelo ${k}: z`);
        const ev = evaluate(model, b.best.x);
        assert.ok(ev.feasible, `modelo ${k}: factible`);
        assert.ok(Math.abs(ev.z - b.best.z) < 1e-9, `modelo ${k}: z de x`);
      }
    }
  });
}

test('pasosBalas', () => {
  const p1 = pasosBalas(M('T1'));
  const p3 = pasosBalas(M('T3'));
  assert.equal(p1.length, 9);
  assert.equal(p3.length, 13);
  const ult = p3[p3.length - 1];
  assert.ok(ult.texto.includes('10') && ult.texto.includes('x₂') && ult.texto.includes('x₃'));
  for (const p of [...p1, ...p3]) assert.ok(p.texto.length > 0 && p.titulo.length > 0);
  for (const p of [p1, p3, pasosBalas(M('T2')), pasosBalas(M('ASIGNACION'))]) {
    for (let i = 1; i < p.length; i++) assert.ok(p[i].estado.hastaNodo >= p[i - 1].estado.hastaNodo);
  }
  assert.equal(pasosBalas(M('T2')).length, balas(M('T2')).trace.length + 2);
  assert.equal(pasosBalas(M('ASIGNACION')).length, balas(M('ASIGNACION')).trace.length + 2);
  assert.equal(p3[0].titulo, 'Planteamiento y forma del método');
  assert.deepEqual(p3[3].estado, { hastaNodo: 2, nodoActual: 3 });
  assert.ok(p3[3].texto.includes('factible'));
  assert.match(pasosBalas(M('T2'))[0].texto, /complemento/);
  const inf = pasosBalas({ sense: 'min', names: ['x1'], c: [1], constraints: [{ name: 'R', a: [1], op: '>=', b: 2 }] });
  assert.match(inf[inf.length - 1].texto, /no tiene solución factible/);
});

test('pasosEnumeracion', () => {
  const p = pasosEnumeracion(M('T1'));
  assert.equal(p.length, 10);
  const p3 = pasosEnumeracion(M('T3'));
  const u = p3[p3.length - 1];
  assert.ok(u.texto.includes('x₂') && u.texto.includes('x₃'));
  assert.deepEqual(p3[4].estado.mejorHastaAhora, { z: 10, x: [0, 1, 1] }); // 011 es la primera factible
  assert.deepEqual(p3[8].estado.mejorHastaAhora, { z: 10, x: [0, 1, 1] }); // 111 no la reemplaza
  assert.equal(p3[1].estado.mejorHastaAhora, null);
  assert.throws(() => pasosEnumeracion(M('MOCHILA_EXCL')), /aditivo/);
});
