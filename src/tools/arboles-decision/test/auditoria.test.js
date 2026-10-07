/** Auditoría adversarial: planes completos enumerados por otro camino, riesgo, sensibilidad y texto. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, normalizarOError } from '../domain/arbol.js';
import { evaluar } from '../domain/evaluar.js';
import { perfilRiesgo } from '../domain/riesgo.js';
import { sensibilidad, conProbabilidad } from '../domain/sensibilidad.js';
import { parsearTexto, arbolATexto } from '../domain/texto.js';
import { mulberry32 } from '../domain/rng.js';

const casi = (a, b, t = 1e-8) => Math.abs(a - b) <= t * Math.max(1, Math.abs(a), Math.abs(b));

/** Árbol aleatorio con empates frecuentes (valores pequeños), negativos, p = 0 y nodos de una rama. */
function arbolRaro(rng, prof = 4) {
  let k = 0;
  function nodo(nivel, forzar) {
    const id = `n${++k}`;
    if (!forzar && (nivel >= prof || rng.next() < 0.3)) return { id, tipo: 'final', nombre: '', valor: rng.int(-6, 6) * 5, ramas: [] };
    const tipo = rng.next() < 0.5 ? 'decision' : 'azar';
    const m = rng.next() < 0.1 ? 1 : rng.int(2, 3);
    let ps = [];
    if (tipo === 'azar') {
      const w = Array.from({ length: m }, () => (rng.next() < 0.15 ? 0 : rng.int(1, 5)));
      if (w.every((x) => x === 0)) w[0] = 1;
      const s = w.reduce((a, b) => a + b, 0);
      ps = w.map((x) => x / s);
    }
    return {
      id, tipo, nombre: '',
      ramas: Array.from({ length: m }, (_, i) => ({ etiqueta: `r${id}.${i}`, p: tipo === 'azar' ? ps[i] : '', pago: rng.next() < 0.5 ? rng.int(-4, 4) * 5 : '', hijo: nodo(nivel + 1, false) })),
    };
  }
  return { sense: rng.next() < 0.5 ? 'max' : 'min', unidad: '', raiz: nodo(0, true) };
}

/** Planes completos: [{ valor, elige: {idDecision: idx} }] solo con las decisiones alcanzables (p > 0). */
function planes(n) {
  if (n.tipo === 'final') return [{ valor: n.valor, elige: {} }];
  if (n.tipo === 'decision') {
    return n.ramas.flatMap((r, i) => planes(r.hijo).map((pl) => ({ valor: r.pago + pl.valor, elige: { ...pl.elige, [n.id]: i } })));
  }
  let acc = [{ valor: 0, elige: {} }];
  n.ramas.forEach((r) => {
    const sub = planes(r.hijo);
    acc = acc.flatMap((a) => (r.p === 0
      ? [a]
      : sub.map((s) => ({ valor: a.valor + r.p * (r.pago + s.valor), elige: { ...a.elige, ...s.elige } }))));
  });
  return acc;
}

/** Valor de seguir un plan dado (falla si el plan no dice qué hacer en una decisión alcanzable). */
function valorPlan(n, elige) {
  if (n.tipo === 'final') return n.valor;
  if (n.tipo === 'decision') {
    const i = elige[n.id];
    assert.ok(i !== undefined, `el plan no dice qué hacer en ${n.id}`);
    return n.ramas[i].pago + valorPlan(n.ramas[i].hijo, elige);
  }
  return n.ramas.reduce((s, r) => (r.p === 0 ? s : s + r.p * (r.pago + valorPlan(r.hijo, elige))), 0);
}

/** Distribución de resultados (valor final, prob.) bajo un plan, por recorrido propio. */
function distribucion(n, elige, p = 1, acum = 0, out = []) {
  if (n.tipo === 'final') { out.push([acum + n.valor, p]); return out; }
  if (n.tipo === 'decision') { const r = n.ramas[elige[n.id]]; return distribucion(r.hijo, elige, p, acum + r.pago, out); }
  n.ramas.forEach((r) => { if (r.p > 0) distribucion(r.hijo, elige, p * r.p, acum + r.pago, out); });
  return out;
}

test('auditoría: valor, estrategia completa y riesgo contra enumeración de planes (1500 árboles)', () => {
  for (let s = 1; s <= 1500; s++) {
    const rng = mulberry32(s * 7919);
    const norm = normalizar(arbolRaro(rng, rng.int(1, 4)));
    assert.deepEqual(norm.errores, [], `semilla ${s}`);
    const arbol = norm.arbol;
    const todos = planes(arbol.raiz);
    const mejor = arbol.sense === 'max' ? Math.max(...todos.map((x) => x.valor)) : Math.min(...todos.map((x) => x.valor));
    const ev = evaluar(arbol);
    assert.ok(casi(ev.valor, mejor), `semilla ${s}: ${ev.valor} vs ${mejor}`);
    const elige = Object.fromEntries(ev.estrategia.map((e) => [e.nodoId, e.idx]));
    assert.ok(casi(valorPlan(arbol.raiz, elige), ev.valor), `semilla ${s}: la estrategia no rinde el valor`);
    ev.estrategia.forEach((e) => assert.ok(ev.porNodo[e.nodoId].empates.includes(e.idx)));
    const r = perfilRiesgo(arbol, ev);
    const dist = distribucion(arbol.raiz, elige);
    assert.ok(casi(r.puntos.reduce((a, x) => a + x.p, 0), 1), `semilla ${s}: suma p`);
    assert.ok(casi(r.esperado, ev.valor), `semilla ${s}: esperado del perfil`);
    const m = new Map();
    dist.forEach(([v, p]) => m.set(v, (m.get(v) || 0) + p));
    assert.equal(r.puntos.length, m.size, `semilla ${s}: puntos`);
    r.puntos.forEach((x) => assert.ok(casi(x.p, [...m.entries()].find(([v]) => casi(v, x.valor))[1])));
    const varianza = dist.reduce((a, [v, p]) => a + p * (v - ev.valor) ** 2, 0);
    assert.ok(casi(r.varianza, varianza, 1e-6));
    assert.ok(casi(r.pNegativo, dist.filter(([v]) => v < 0).reduce((a, [, p]) => a + p, 0)));
  }
});

test('auditoría: casos límite de evaluar', () => {
  const a = normalizarOError({ sense: 'min', raiz: { tipo: 'decision', ramas: [{ etiqueta: 'A', hijo: { tipo: 'final', valor: 7 } }, { etiqueta: 'B', pago: -2, hijo: { tipo: 'final', valor: 8 } }] } });
  const ev = evaluar(a);
  assert.equal(ev.valor, 6);
  assert.equal(ev.estrategia[0].eleccion, 'B');
  for (const ps of [[0.5, 0.4], [1.2, -0.2], ['x', 1]]) {
    const r = normalizar({ raiz: { tipo: 'azar', ramas: ps.map((p, i) => ({ etiqueta: `r${i}`, p, hijo: { tipo: 'final', valor: 1 } })) } });
    assert.ok(r.errores.length > 0, JSON.stringify(ps));
  }
  const e = evaluar(normalizarOError({ raiz: { tipo: 'decision', ramas: [{ etiqueta: 'X', hijo: { tipo: 'final', valor: 3 } }, { etiqueta: 'Y', hijo: { tipo: 'final', valor: 3 } }] } }));
  assert.equal(e.estrategia[0].idx, 0);
  assert.equal(e.estrategia[0].empate, true);
});

test('auditoría: sensibilidad contra fórmula cerrada y fuerza bruta', () => {
  for (let s = 1; s <= 300; s++) {
    const rng = mulberry32(s * 31);
    const b = rng.int(-10, 10) * 10;
    const a = b + rng.int(1, 20) * 10;
    const K = b + (rng.int(1, 99) / 100) * (a - b);
    const arbol = normalizarOError({ raiz: { tipo: 'decision', ramas: [
      { etiqueta: 'Riesgo', hijo: { tipo: 'azar', ramas: [{ etiqueta: 'Éxito', p: 0.3, hijo: { tipo: 'final', valor: a } }, { etiqueta: 'Fracaso', p: 0.7, hijo: { tipo: 'final', valor: b } }] } },
      { etiqueta: 'Seguro', hijo: { tipo: 'final', valor: K } },
    ] } });
    const sen = sensibilidad(arbol, arbol.raiz.ramas[0].hijo.id, 0, { pasos: 20 });
    assert.equal(sen.cortes.length, 1, `semilla ${s}`);
    assert.ok(Math.abs(sen.cortes[0].p - (K - b) / (a - b)) < 1e-7, `semilla ${s} ${sen.cortes[0].p} ${(K - b) / (a - b)}`);
    assert.ok(casi(sen.cortes[0].valor, K, 1e-7));
  }
  const sin = normalizarOError({ raiz: { tipo: 'decision', ramas: [
    { etiqueta: 'Riesgo', hijo: { tipo: 'azar', ramas: [{ etiqueta: 'E', p: 0.3, hijo: { tipo: 'final', valor: 10 } }, { etiqueta: 'F', p: 0.7, hijo: { tipo: 'final', valor: 0 } }] } },
    { etiqueta: 'Seguro', hijo: { tipo: 'final', valor: -5 } },
  ] } });
  const r = sensibilidad(sin, sin.raiz.ramas[0].hijo.id, 0);
  assert.equal(r.cortes.length, 0);
  assert.equal(r.valores[0], 0);
  assert.equal(r.valores[100], 10);
  const tres = normalizarOError({ raiz: { tipo: 'azar', ramas: [{ etiqueta: 'a', p: 0.2, hijo: { tipo: 'final', valor: 1 } }, { etiqueta: 'b', p: 0.3, hijo: { tipo: 'final', valor: 2 } }, { etiqueta: 'c', p: 0.5, hijo: { tipo: 'final', valor: 3 } }] } });
  for (const p of [0, 0.4, 1]) {
    const c = conProbabilidad(tres, tres.raiz.id, 0, p);
    const ps = c.raiz.ramas.map((x) => x.p);
    assert.ok(casi(ps.reduce((x, y) => x + y, 0), 1));
    if (p < 1) assert.ok(casi(ps[1] / ps[2], 0.6));
  }
  const uno = normalizarOError({ raiz: { tipo: 'azar', ramas: [{ etiqueta: 'a', p: 1, hijo: { tipo: 'final', valor: 1 } }, { etiqueta: 'b', p: 0, hijo: { tipo: 'final', valor: 2 } }, { etiqueta: 'c', p: 0, hijo: { tipo: 'final', valor: 3 } }] } });
  const c = conProbabilidad(uno, uno.raiz.id, 0, 0.4);
  assert.ok(casi(c.raiz.ramas[1].p, 0.3) && casi(c.raiz.ramas[2].p, 0.3));
});

test('auditoría: texto, ida y vuelta y entradas raras', () => {
  for (let s = 1; s <= 300; s++) {
    const rng = mulberry32(s * 101);
    const norm = normalizar(arbolRaro(rng, 3));
    if (!norm.arbol) continue;
    const txt = arbolATexto(norm.arbol);
    const p = parsearTexto(txt.replace(/\n/g, s % 2 ? '\r\n' : '\n'));
    assert.deepEqual(p.errores, [], `semilla ${s}\n${txt}`);
    const n2 = normalizar(p.arbol);
    assert.deepEqual(n2.errores, [], `semilla ${s}\n${txt}`);
    assert.ok(casi(evaluar(n2.arbol).valor, evaluar(norm.arbol).valor, 1e-7), `semilla ${s} ${evaluar(n2.arbol).valor} ${evaluar(norm.arbol).valor}
${txt}`);
  }
  const t = parsearTexto('Objetivo: Mínimo\nunidad: pesos\n\t- [D] Decisión ñandú\n\t\t- Sí | pago -1,5\n\t\t\t- [A] Azar\n\t\t\t\t- Alta | p 60 % | valor 10\n\t\t\t\t- Baja | p 3/10 | valor −2\n\t\t\t\t- Media | probabilidad: 0.1 | valor 1\n\t\t- No | valor 4\r\n');
  assert.deepEqual(t.errores, []);
  const ar = normalizarOError(t.arbol);
  assert.equal(ar.sense, 'min');
  assert.ok(casi(evaluar(ar).valor, Math.min(-1.5 + 6 - 0.6 + 0.1, 4)));
  assert.ok(parsearTexto('').errores.length);
  assert.ok(parsearTexto('- Rama | valor 1').errores.length);
  assert.ok(parsearTexto('- [D] A\n  - x | foo 3').errores.length);
});

test('auditoría: llegar o dejar de llegar a una decisión en p = 0 o p = 1 no es un punto de indiferencia', () => {
  const F = (v) => ({ tipo: 'final', valor: v });
  const a = normalizarOError({ raiz: { tipo: 'azar', nombre: 'Az', ramas: [
    { etiqueta: 'x', p: 0.5, hijo: { tipo: 'decision', nombre: 'D', ramas: [{ etiqueta: 'd1', hijo: F(10) }, { etiqueta: 'd2', hijo: F(5) }] } },
    { etiqueta: 'y', p: 0.5, hijo: F(3) },
  ] } });
  for (const idx of [0, 1]) {
    const s = sensibilidad(a, a.raiz.id, idx);
    assert.deepEqual(s.cortes, [], `rama ${idx}`);
    assert.equal(s.tramos.length, 1);
    assert.equal(s.tramos[0].estrategia, 'd1');
  }
});

test('auditoría: nombres con «|», «#» o saltos de línea sobreviven a la ida y vuelta por texto', () => {
  const F = (v) => ({ tipo: 'final', valor: v });
  const b = normalizarOError({ raiz: { tipo: 'azar', nombre: 'Az | uno', ramas: [
    { etiqueta: 'a|b', p: 0.5, hijo: F(1) },
    { etiqueta: '# y', p: 0.5, hijo: F(3) },
  ] } });
  const p = parsearTexto(arbolATexto(b));
  assert.deepEqual(p.errores, []);
  assert.ok(casi(evaluar(normalizarOError(p.arbol)).valor, 2));
});

test('auditoría: los pasos de los 4 ejemplos dicen cifras que coinciden con el valor y la estrategia', async () => {
  const { EJEMPLOS, arbolDeEjemplo } = await import('../domain/ejemplos.js');
  const { pasosInduccion } = await import('../domain/pasos.js');
  const { fmtNum } = await import('../domain/format.js');
  const esperado = { planta: 84, estudio: 74.2, mantenimiento: 50, lanzamiento: 41.6 };
  for (const e of EJEMPLOS) {
    const arbol = arbolDeEjemplo(e.id);
    const pasos = pasosInduccion(arbol);
    const ev = evaluar(arbol);
    assert.ok(casi(ev.valor, esperado[e.id]), e.id);
    const ultimo = pasos[pasos.length - 1];
    assert.ok(ultimo.calculo[0].includes(fmtNum(esperado[e.id])), e.id);
    assert.ok(ultimo.texto.includes(fmtNum(esperado[e.id])), e.id);
    // un paso por nodo interno, más el planteamiento y el cierre
    assert.equal(pasos.length, ev.orden.length + 2, e.id);
    // cada línea «VE(...) = ... = x» tiene la aritmética correcta
    pasos.flatMap((p) => p.calculo).filter((l) => l.startsWith('VE(')).forEach((l) => {
      const [, rhs] = l.split(' = ').slice(0, 2).concat(l.split(' = ')[1]);
      const t = l.split(' = ');
      const num = (s) => Number(s.replace('−', '-').replace(',', '.'));
      const resultado = num(t[t.length - 1]);
      const suma = t[1].split(' + ').reduce((acc, term) => {
        const [p, v] = term.split(' × ');
        return acc + num(p) * num(v.replace(/[()]/g, ''));
      }, 0);
      assert.ok(casi(suma, resultado, 1e-3), `${e.id}: ${l}`);
      assert.ok(rhs !== undefined);
    });
  }
});
