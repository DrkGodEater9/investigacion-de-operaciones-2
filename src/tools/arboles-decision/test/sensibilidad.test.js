import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarOError, listaNodos } from '../domain/arbol.js';
import { evaluar } from '../domain/evaluar.js';
import { nodosAzar, conProbabilidad, sensibilidad } from '../domain/sensibilidad.js';
import { arbolDeEjemplo } from '../domain/ejemplos.js';
import { mulberry32, arbolAleatorio, mejorPorEstrategias, cerca } from './utils.mjs';

/** Decisión entre un valor seguro K y un proyecto con éxito (a, prob p) o fracaso (b). */
const arbolIndiferencia = (a, b, K, p = 0.5) => normalizarOError({
  sense: 'max', raiz: { id: 'n1', tipo: 'decision', nombre: 'D', ramas: [
    { etiqueta: 'Proyecto', hijo: { id: 'n2', tipo: 'azar', nombre: 'Resultado', ramas: [
      { etiqueta: 'Éxito', p, hijo: { id: 'n3', tipo: 'final', valor: a } },
      { etiqueta: 'Fracaso', p: 1 - p, hijo: { id: 'n4', tipo: 'final', valor: b } },
    ] } },
    { etiqueta: 'Seguro', hijo: { id: 'n5', tipo: 'final', valor: K } },
  ] },
});

test('conProbabilidad: reescala las demás ramas y suma 1', () => {
  const t = normalizarOError({
    sense: 'max', raiz: { id: 'n1', tipo: 'azar', nombre: 'A', ramas: [
      { etiqueta: 'x', p: 0.2, hijo: { id: 'n2', tipo: 'final', valor: 1 } },
      { etiqueta: 'y', p: 0.3, hijo: { id: 'n3', tipo: 'final', valor: 1 } },
      { etiqueta: 'z', p: 0.5, hijo: { id: 'n4', tipo: 'final', valor: 1 } },
    ] },
  });
  const c = conProbabilidad(t, 'n1', 0, 0.6);
  assert.deepEqual(c.raiz.ramas.map((r) => Math.round(r.p * 1e9) / 1e9), [0.6, 0.15, 0.25]);
  assert.ok(cerca(c.raiz.ramas.reduce((s, r) => s + r.p, 0), 1));
  assert.equal(t.raiz.ramas[0].p, 0.2, 'no modifica el original');
  // si el resto era 0, se reparte en partes iguales
  const t2 = conProbabilidad(t, 'n1', 0, 1);
  const c2 = conProbabilidad(t2, 'n1', 0, 0.5);
  assert.deepEqual(c2.raiz.ramas.map((r) => r.p), [0.5, 0.25, 0.25]);
  assert.throws(() => conProbabilidad(t, 'nope', 0, 0.5));
  assert.throws(() => conProbabilidad(t, 'n1', 9, 0.5));
});

test('indiferencia: el punto de corte coincide con (K − b) / (a − b)', () => {
  const rng = mulberry32(5150);
  for (let i = 0; i < 150; i++) {
    const b = rng.int(-100, 50);
    const a = b + rng.int(20, 300);
    const K = b + rng.int(1, a - b - 1) + rng.next() * 0.5;
    if (K <= b || K >= a) continue;
    const t = arbolIndiferencia(a, b, K, rng.int(1, 19) / 20);
    const s = sensibilidad(t, 'n2', 0);
    const esperado = (K - b) / (a - b);
    assert.equal(s.cortes.length, 1, `caso ${i}`);
    assert.ok(Math.abs(s.cortes[0].p - esperado) < 1e-6, `${s.cortes[0].p} vs ${esperado}`);
    assert.ok(cerca(s.cortes[0].valor, K, 1e-6));
    assert.match(s.cortes[0].antes, /Seguro/);
    assert.match(s.cortes[0].despues, /Proyecto/);
    assert.equal(s.tramos.length, 2);
    // la serie de «Proyecto» es una recta de b a a y la de «Seguro» es constante
    assert.ok(cerca(s.series[0].valores[0], b) && cerca(s.series[0].valores[100], a));
    assert.ok(s.series[1].valores.every((v) => cerca(v, K)));
    // y el valor óptimo es el máximo de ambas en cada p
    s.ps.forEach((p, j) => assert.ok(cerca(s.valores[j], Math.max(s.series[0].valores[j], s.series[1].valores[j]))));
  }
});

test('sin cambio de decisión no hay cortes', () => {
  const t = arbolIndiferencia(100, 50, 10);
  const s = sensibilidad(t, 'n2', 0);
  assert.equal(s.cortes.length, 0);
  assert.equal(s.tramos.length, 1);
  assert.match(s.tramos[0].estrategia, /Proyecto/);
});

test('planta: la decisión cambia donde se cruzan las rectas de las alternativas', () => {
  const t = arbolDeEjemplo('planta');
  assert.equal(nodosAzar(t).length, 2);
  // Se varía la demanda de la planta grande (n2): Grande(p) = 240p − 60 contra Pequeña = 76 (fija) → p = 136/240
  const s = sensibilidad(t, 'n2', 0);
  const corte = s.cortes.find((c) => /Grande/.test(c.despues));
  assert.ok(Math.abs(corte.p - 136 / 240) < 1e-6);
  assert.ok(Math.abs(s.p0 - 0.6) < 1e-12);
  // Se varía la demanda de la pequeña (n5): Pequeña(p) = 60p + 40 contra Grande = 84 → p = 44/60 (y a favor de Pequeña después)
  const s2 = sensibilidad(t, 'n5', 0);
  const c2 = s2.cortes.find((c) => /Pequeña/.test(c.despues));
  assert.ok(Math.abs(c2.p - 44 / 60) < 1e-6);
});

test('el valor del barrido coincide con evaluar en árboles aleatorios', () => {
  const rng = mulberry32(8080);
  let probados = 0;
  for (let i = 0; i < 150; i++) {
    const t = normalizarOError(arbolAleatorio(rng, { prof: 3, total: 20 }));
    const azar = listaNodos(t).filter((n) => n.tipo === 'azar');
    if (!azar.length) continue;
    const n = rng.pick(azar);
    const idx = rng.int(0, n.ramas.length - 1);
    const s = sensibilidad(t, n.id, idx, { pasos: 20 });
    probados += 1;
    s.ps.forEach((p, j) => {
      const tp = conProbabilidad(t, n.id, idx, p);
      assert.ok(cerca(s.valores[j], mejorPorEstrategias(tp)), `p=${p}`);
      assert.ok(cerca(s.valores[j], evaluar(tp).valor));
    });
    // los tramos cubren [0, 1] sin huecos
    assert.equal(s.tramos[0].desde, 0);
    assert.equal(s.tramos.at(-1).hasta, 1);
    for (let k = 1; k < s.tramos.length; k++) assert.equal(s.tramos[k].desde, s.tramos[k - 1].hasta);
    // el valor óptimo de un árbol con una sola probabilidad que varía es convexo (max) o cóncavo (min) en p
    // solo si todo lo demás es fijo; aquí basta con que el valor en p0 coincida con el del árbol original
    assert.ok(cerca(evaluar(conProbabilidad(t, n.id, idx, n.ramas[idx].p)).valor, evaluar(t).valor));
  }
  assert.ok(probados > 100);
});

test('nodos ligados: la misma demanda bajo cada alternativa se varía junta (p* = 5/9)', async () => {
  const { nodosLigados } = await import('../domain/sensibilidad.js');
  const t = arbolDeEjemplo('planta');
  assert.deepEqual(nodosLigados(t, 'n2'), ['n2', 'n5']);
  const s = sensibilidad(t, 'n2', 0, { ligar: true });
  assert.deepEqual(s.ligados, ['n2', 'n5']);
  assert.equal(s.cortes.length, 1);
  assert.ok(Math.abs(s.cortes[0].p - 100 / 180) < 1e-6);
  assert.match(s.cortes[0].antes, /Pequeña/);
  assert.match(s.cortes[0].despues, /Grande/);
  // en cada p la rama «Grande» vale 240p − 60 y la «Pequeña» 60p + 40
  s.ps.forEach((p, j) => {
    assert.ok(cerca(s.series[0].valores[j], 240 * p - 60));
    assert.ok(cerca(s.series[1].valores[j], 60 * p + 40));
  });
  // el árbol con el estudio tiene tres nodos «Demanda» con probabilidades distintas: no se ligan
  const e = arbolDeEjemplo('estudio');
  const demanda = listaNodos(e).find((n) => n.nombre === 'Demanda');
  assert.deepEqual(nodosLigados(e, demanda.id), [demanda.id]);
  // sin ligar solo cambia un nodo
  const s1 = sensibilidad(t, 'n2', 0);
  assert.deepEqual(s1.ligados, []);
});
