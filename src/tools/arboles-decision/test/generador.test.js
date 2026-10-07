import test from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS, generarEjercicio, corregir, solucionDe } from '../domain/generador.js';
import { evaluar } from '../domain/evaluar.js';
import { normalizar } from '../domain/arbol.js';
import { mejorPorEstrategias, cerca } from './utils.mjs';

const SEMILLAS = Array.from({ length: 120 }, (_, i) => i + 1);

/** Cálculo independiente de la respuesta de cada tipo (no usa solucionDe ni el generador). */
function independiente(ej) {
  const raiz = ej.arbol?.raiz;
  switch (ej.tipo) {
    case 'valorEsperado': {
      let s = 0;
      for (const r of raiz.ramas) s += r.p * r.hijo.valor;
      return s;
    }
    case 'completar': {
      let falta = 1;
      for (const r of raiz.ramas) if (r.p != null) falta -= r.p;
      let s = 0;
      for (const r of raiz.ramas) s += (r.p == null ? falta : r.p) * r.hijo.valor;
      return s;
    }
    case 'alternativa': {
      // valor de cada alternativa por estrategias puras
      const sub = (n) => ({ ...ej.arbol, raiz: n });
      const vals = raiz.ramas.map((r) => r.pago + mejorPorEstrategias(sub(r.hijo.tipo === 'final' ? { ...r.hijo } : r.hijo)));
      // una hoja sola no es un árbol válido, pero mejorPorEstrategias solo mira el nodo
      return vals.indexOf(ej.arbol.sense === 'max' ? Math.max(...vals) : Math.min(...vals));
    }
    case 'secuencial':
      return mejorPorEstrategias(ej.arbol);
    case 'estrategia': {
      // evalúa las tres estrategias con las fórmulas del enunciado
      const inv = raiz.ramas[0];
      const res = inv.hijo;
      const buena = res.ramas[0];
      const exp = buena.hijo;
      const mercado = exp.ramas[0].hijo;
      const vMercado = mercado.ramas[0].p * mercado.ramas[0].hijo.valor + mercado.ramas[1].p * mercado.ramas[1].hijo.valor;
      const conExp = exp.ramas[0].pago + vMercado;
      const sinExp = exp.ramas[1].pago + exp.ramas[1].hijo.valor;
      const regular = res.ramas[1];
      const total = (vBuena) => inv.pago + buena.p * vBuena + regular.p * regular.hijo.valor;
      const e = total(conExp);
      const n = total(sinExp);
      const opts = [raiz.ramas[1].hijo.valor + raiz.ramas[1].pago, e, n];
      return opts.indexOf(Math.max(...opts));
    }
    case 'indiferencia': {
      const { a, b, K } = ej.datos;
      // se busca p por bisección: p·a + (1 − p)·b = K
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 80; i++) {
        const mid = (lo + hi) / 2;
        if (mid * a + (1 - mid) * b < K) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    }
    case 'veip': {
      const { p, pagos } = ej.tabla;
      let con = 0;
      for (let j = 0; j < p.length; j++) {
        let m = -Infinity;
        for (const fila of pagos) m = Math.max(m, fila[j]);
        con += p[j] * m;
      }
      let sin = -Infinity;
      for (const fila of pagos) {
        let e = 0;
        for (let j = 0; j < p.length; j++) e += p[j] * fila[j];
        sin = Math.max(sin, e);
      }
      return con - sin;
    }
    case 'riesgo': {
      let s = 0;
      for (const r of raiz.ramas) if (r.hijo.valor < 0) s += r.p;
      return s;
    }
    default:
      throw new Error(ej.tipo);
  }
}

test('mismo ejercicio con la misma semilla; JSON puro', () => {
  for (const tipo of TIPOS) {
    for (const s of [1, 42, 4821, 999999]) {
      const a = generarEjercicio(tipo, s);
      const b = generarEjercicio(tipo, s);
      assert.deepEqual(a, b);
      assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
      assert.equal(a.id, `${tipo}-${s}`);
    }
  }
  assert.throws(() => generarEjercicio('nada', 1));
});

test('la solución del generador coincide con el cálculo independiente en 120 semillas por tipo', () => {
  for (const tipo of TIPOS) {
    for (const s of SEMILLAS) {
      const ej = generarEjercicio(tipo, s);
      const ind = independiente(ej);
      const sol = ej.solucion;
      if (ej.entrada.tipo === 'opcion') {
        assert.equal(sol, ind, `${tipo}-${s}`);
        assert.equal(solucionDe(ej), ind, `${tipo}-${s} (solucionDe)`);
      } else {
        assert.ok(cerca(sol, ind, 1e-9), `${tipo}-${s}: ${sol} vs ${ind}`);
        assert.ok(cerca(solucionDe(ej), ind, 1e-9), `${tipo}-${s} (solucionDe)`);
      }
    }
  }
});

test('corregir: acepta la respuesta correcta y rechaza una incorrecta', () => {
  for (const tipo of TIPOS) {
    for (const s of SEMILLAS) {
      const ej = generarEjercicio(tipo, s);
      const ind = independiente(ej);
      if (ej.entrada.tipo === 'opcion') {
        assert.equal(corregir(ej, ind).correcta, true, `${tipo}-${s}`);
        for (let i = 0; i < ej.entrada.opciones.length; i++) {
          if (i !== ind) {
            const r = corregir(ej, i);
            assert.equal(r.correcta, false);
            assert.ok(r.mensaje.includes(ej.entrada.opciones[ind]));
          }
        }
      } else {
        assert.equal(corregir(ej, ind).correcta, true, `${tipo}-${s}`);
        assert.equal(corregir(ej, Math.round(ind * 100) / 100).correcta, true, `${tipo}-${s} redondeado`);
        const mal = corregir(ej, ind + 3);
        assert.equal(mal.correcta, false);
        assert.ok(mal.mensaje.includes('No coincide'));
        assert.equal(corregir(ej, null).correcta, false);
      }
    }
  }
});

test('hay variedad de enunciados y datos', () => {
  for (const tipo of TIPOS) {
    const vistos = new Set(SEMILLAS.map((s) => {
      const e = generarEjercicio(tipo, s);
      return e.enunciado + JSON.stringify(e.arbol ?? e.tabla);
    }));
    assert.ok(vistos.size >= 100, `${tipo}: solo ${vistos.size} distintos`);
  }
});

test('los árboles de los ejercicios son válidos y se resuelven (salvo las incógnitas)', () => {
  for (const tipo of ['valorEsperado', 'alternativa', 'secuencial', 'estrategia', 'riesgo']) {
    for (const s of SEMILLAS) {
      const ej = generarEjercicio(tipo, s);
      const r = normalizar(ej.arbol);
      assert.deepEqual(r.errores, [], `${tipo}-${s}`);
      const ev = evaluar(r.arbol);
      assert.ok(Number.isFinite(ev.valor));
    }
  }
  for (const tipo of ['completar', 'indiferencia']) {
    const ej = generarEjercicio(tipo, 7);
    assert.ok(ej.arbol.raiz.ramas.some((r) => r.p == null || typeof r.p === 'string' || (r.hijo.ramas || []).some((q) => q.p == null || typeof q.p === 'string')));
  }
});

test('alternativa y estrategia: sin empates en el óptimo', () => {
  for (const s of SEMILLAS) {
    const ej = generarEjercicio('alternativa', s);
    const ev = evaluar(ej.arbol);
    assert.equal(ev.porNodo[ej.arbol.raiz.id].empates.length, 1);
    const e2 = generarEjercicio('estrategia', s);
    const ev2 = evaluar(e2.arbol);
    assert.equal(ev2.porNodo[e2.arbol.raiz.id].empates.length, 1);
  }
});

test('errores típicos reciben una pista', () => {
  const ej = generarEjercicio('valorEsperado', 11);
  const v = ej.arbol.raiz.ramas.map((r) => r.hijo.valor);
  const prom = v.reduce((a, b) => a + b, 0) / v.length;
  if (Math.abs(prom - ej.solucion) > 0.05) {
    const r = corregir(ej, prom);
    assert.equal(r.correcta, false);
    assert.match(r.detalle, /promediaste/);
  }
  const veip = generarEjercicio('veip', 3);
  const { p, pagos } = veip.tabla;
  const con = p.reduce((s, x, j) => s + x * Math.max(...pagos.map((f) => f[j])), 0);
  assert.match(corregir(veip, con).detalle, /CON información perfecta/);
  const ind = generarEjercicio('indiferencia', 9);
  const r = corregir(ind, 1 - ind.solucion);
  if (Math.abs(1 - 2 * ind.solucion) > 0.02) assert.match(r.detalle, /1 − p/);
  const rie = generarEjercicio('riesgo', 5);
  assert.match(corregir(rie, 1 - rie.solucion).detalle, /complemento/);
});
