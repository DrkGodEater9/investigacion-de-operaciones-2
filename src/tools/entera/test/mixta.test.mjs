import test from 'node:test';
import assert from 'node:assert/strict';
import { frac } from '../domain/fraction.js';
import { solveLP } from '../domain/simplex.js';
import { solveIP } from '../domain/branchAndBound.js';
import {
  BM, bmCmp, bmATexto, construirTablero, simplexPrimal, simplexDual, limpiarArtificiales,
  valoresColumnas, solucionOriginal, resolverRelajacion,
} from '../domain/tablero.js';
import { cortePlanoDeFila, planosDeCorte } from '../domain/cortes.js';
import { ejemplosMixta } from '../domain/examplesMixta.js';
import { fuerzaBruta } from './utils/fuerzaBruta.mjs';

const S = (arr) => arr.map((v) => v.toString());
const modeloDe = (e) => ({ sense: e.sense, c: e.c, constraints: e.constraints, integer: e.integer });
const filaTxt = (t, i) => [...S(t.A[i]), '|', t.b[i].toString()];
const nombresBase = (t) => t.base.map((j) => t.cols[j].nombre);
const e = Object.fromEntries(ejemplosMixta.map((x) => [x.id.replace('mixta-', ''), x]));

test('BigM: comparación y texto', () => {
  assert.ok(bmCmp(BM(100, -1), BM(-5, 0)) < 0);
  assert.equal(bmATexto(BM(3, 4)), '3+4M');
  assert.equal(bmATexto(BM(0, -1)), '-M');
  assert.equal(bmATexto(BM(2, -5)), '2-5M');
  assert.equal(bmATexto(BM(frac('5/2'), -1)), '5/2-M');
  assert.equal(bmATexto(BM(0, 1)), 'M');
  assert.equal(bmATexto(BM(0, 0)), '0');
});

test('ejemplosMixta: formato y e1 primero', () => {
  assert.equal(ejemplosMixta.length, 6);
  assert.equal(ejemplosMixta[0].id, 'mixta-e1');
  for (const x of ejemplosMixta) {
    for (const k of ['id', 'title', 'description', 'sense', 'numVars', 'c', 'constraints', 'integer', 'options', 'esperado']) {
      assert.ok(k in x, `${x.id} sin ${k}`);
    }
    assert.equal(x.c.length, x.numVars);
  }
});

test('integralidad de holguras y columnas de e1', () => {
  const t0 = construirTablero(modeloDe(e.e1));
  // x1 continua en ambas restricciones, luego ambas holguras son continuas
  assert.deepEqual(t0.cols.map((c) => c.entera), [false, true, false, false]);
});

test('traza de e1: iteraciones', () => {
  const r = simplexPrimal(construirTablero(modeloDe(e.e1)));
  assert.equal(r.estado, 'optimo');
  assert.equal(r.iteraciones.length, 2);
  const it1 = r.iteraciones[0];
  assert.equal(it1.entra, 1);
  assert.equal(it1.sale, 0);
  assert.deepEqual(S(it1.razones), ['2', '35']);
  assert.equal(it1.pivote.toString(), '3');
  const d = it1.despues;
  assert.deepEqual(filaTxt(d, 0), ['-1/3', '1', '1/3', '0', '|', '2']);
  assert.deepEqual(filaTxt(d, 1), ['22/3', '0', '-1/3', '1', '|', '33']);
  assert.deepEqual(d.zj.map(bmATexto), ['-3', '9', '3', '0']);
  assert.equal(bmATexto(d.zval), '18');
  assert.deepEqual(d.cz.map(bmATexto), ['10', '0', '-3', '0']);
  const it2 = r.iteraciones[1];
  assert.equal(it2.entra, 0);
  assert.equal(it2.sale, 1);
  assert.deepEqual(it2.razones.map((x) => (x === null ? null : x.toString())), [null, '9/2']);
  assert.equal(it2.pivote.toString(), '22/3');
  const f = r.tablero;
  assert.deepEqual(nombresBase(f), ['x2', 'x1']);
  assert.deepEqual(filaTxt(f, 0), ['0', '1', '7/22', '1/22', '|', '7/2']);
  assert.deepEqual(filaTxt(f, 1), ['1', '0', '-1/22', '3/22', '|', '9/2']);
  assert.deepEqual(f.zj.map(bmATexto), ['7', '9', '28/11', '15/11']);
  assert.deepEqual(f.cz.map(bmATexto), ['0', '0', '-28/11', '-15/11']);
  assert.equal(bmATexto(f.zval), '63');
  assert.deepEqual(S(valoresColumnas(f)), ['9/2', '7/2', '0', '0']);
  assert.deepEqual(S(solucionOriginal(f)), ['9/2', '7/2']);
});

test('inmutabilidad: simplexPrimal no altera el tablero inicial', () => {
  const t0 = construirTablero(modeloDe(e.e1));
  const copia = JSON.stringify(t0, (k, v) => (typeof v === 'bigint' ? v.toString() : v));
  simplexPrimal(t0);
  assert.equal(JSON.stringify(t0, (k, v) => (typeof v === 'bigint' ? v.toString() : v)), copia);
});

test('relajación de e1..e6 (tablero) y contra solveLP', () => {
  for (const x of ejemplosMixta) {
    const r = resolverRelajacion(modeloDe(x));
    assert.equal(r.estado, 'optimo', x.id);
    assert.equal(r.z.toString(), x.esperado.relajacion.z, `${x.id} z`);
    assert.deepEqual(S(r.x), x.esperado.relajacion.x, `${x.id} x`);
    const lp = solveLP(modeloDe(x));
    assert.equal(lp.z.toString(), r.z.toString(), `${x.id} vs solveLP`);
  }
});

test('mixto de e1..e6 con solveIP existente', () => {
  for (const x of ejemplosMixta) {
    const r = solveIP(modeloDe(x));
    assert.equal(r.status, 'optimal', x.id);
    assert.equal(r.best.z.toString(), x.esperado.mixto.z, `${x.id} z`);
    assert.deepEqual(S(r.best.x), x.esperado.mixto.x, `${x.id} x`);
  }
});

test('infactible y no acotado', () => {
  const inf = resolverRelajacion({ sense: 'max', c: [1, 0], constraints: [
    { a: [1, 1], op: '<=', b: 1 }, { a: [1, 1], op: '>=', b: 3 }] });
  assert.equal(inf.estado, 'infactible');
  const noA = resolverRelajacion({ sense: 'max', c: [1, 1], constraints: [{ a: [1, -1], op: '<=', b: 1 }] });
  assert.equal(noA.estado, 'no_acotado');
});

test('igualdad, b negativo y caso de reserva', () => {
  const ig = resolverRelajacion({ sense: 'max', c: [2, 1], constraints: [
    { a: [1, 1], op: '=', b: 4 }, { a: [1, 0], op: '<=', b: 3 }] });
  assert.equal(ig.z.toString(), '7');
  assert.deepEqual(S(ig.x), ['3', '1']);
  const neg = resolverRelajacion({ sense: 'min', c: [1, 2], constraints: [{ a: [-1, -1], op: '<=', b: -2 }] });
  assert.equal(neg.z.toString(), '2');
  assert.deepEqual(S(neg.x), ['2', '0']);
  assert.equal(neg.tableroInicial.info.restr[0].invertida, true);
  const res = resolverRelajacion({ sense: 'max', c: [5, 4], constraints: [
    { a: [6, 4], op: '<=', b: 24 }, { a: [1, 2], op: '<=', b: 6 }] });
  assert.equal(res.z.toString(), '21');
  assert.deepEqual(S(res.x), ['3', '3/2']);
});

test('limpiarArtificiales elimina columnas y filas redundantes', () => {
  // x1+x2=4 repetida: una fila queda redundante
  const m = { sense: 'max', c: [1, 1], constraints: [
    { a: [1, 1], op: '=', b: 4 }, { a: [2, 2], op: '=', b: 8 }] };
  const r = simplexPrimal(construirTablero(m));
  assert.equal(r.estado, 'optimo');
  const l = limpiarArtificiales(r.tablero);
  assert.ok(l.cols.every((c) => c.tipo !== 'art'));
  assert.equal(l.A.length, 1);
  assert.equal(l.zval.a.toString(), '4');
});

test('simplexDual exige factibilidad dual', () => {
  const t0 = construirTablero(modeloDe(e.e1));
  assert.throws(() => simplexDual(t0), /dual/);
});

test('e1 mixto: 1 corte x2 <= 3 con tablero final', () => {
  const r = planosDeCorte(modeloDe(e.e1), { tipo: 'mixto' });
  assert.equal(r.estado, 'optimo');
  assert.equal(r.cortes.length, 1);
  const c = r.cortes[0];
  assert.equal(c.k, 1);
  assert.equal(c.colFuente, 1);
  assert.equal(c.filaFuente.nombre, 'x2');
  assert.equal(c.f0.toString(), '1/2');
  assert.deepEqual(c.coefs.map((q) => [q.nombre, q.valor.toString()]), [['x3', '7/22'], ['x4', '1/22']]);
  assert.equal(c.rhs.toString(), '1/2');
  assert.deepEqual(S(c.enOriginales.coefs), ['0', '1']);
  assert.equal(c.enOriginales.op, '<=');
  assert.equal(c.enOriginales.rhs.toString(), '3');
  assert.equal(c.dual.estado, 'optimo');
  assert.deepEqual(S(c.dual.iteraciones[0].razones.map((q) => (q ? q.valor : null)).filter(Boolean)), ['8', '30']);
  assert.equal(c.dual.iteraciones[0].entra, 2);
  assert.equal(r.z.toString(), '59');
  assert.deepEqual(S(r.x), ['32/7', '3']);
  const f = r.tableroFinal;
  assert.deepEqual(nombresBase(f), ['x2', 'x1', 'x3']);
  assert.deepEqual(filaTxt(f, 0), ['0', '1', '0', '0', '1', '|', '3']);
  assert.deepEqual(filaTxt(f, 1), ['1', '0', '0', '1/7', '-1/7', '|', '32/7']);
  assert.deepEqual(filaTxt(f, 2), ['0', '0', '1', '1/7', '-22/7', '|', '11/7']);
  assert.deepEqual(f.cz.map(bmATexto), ['0', '0', '0', '-1', '-8']);
  assert.equal(bmATexto(f.zval), '59');
});

test('e1 con ambas enteras y corte fraccional: x2<=3 y x1+x2<=7', () => {
  const m = { ...modeloDe(e.e1), integer: [true, true] };
  const r = planosDeCorte(m, { tipo: 'fraccional' });
  assert.equal(r.estado, 'optimo');
  assert.equal(r.cortes.length, 2);
  const c2 = r.cortes[1];
  assert.equal(c2.colFuente, 0);
  assert.equal(c2.f0.toString(), '4/7');
  assert.deepEqual(c2.coefs.map((q) => [q.nombre, q.valor.toString()]), [['x4', '1/7'], ['S1', '6/7']]);
  assert.equal(c2.rhs.toString(), '4/7');
  assert.deepEqual(S(c2.enOriginales.coefs), ['1', '1']);
  assert.equal(c2.enOriginales.op, '<=');
  assert.equal(c2.enOriginales.rhs.toString(), '7');
  assert.deepEqual(S(r.cortes[0].enOriginales.coefs), ['0', '1']);
  assert.equal(r.cortes[0].enOriginales.rhs.toString(), '3');
  assert.deepEqual(c2.dual.iteraciones[0].razones.filter(Boolean).map((q) => q.valor.toString()), ['7', '28/3']);
  assert.equal(c2.dual.iteraciones[0].entra, 3);
  assert.equal(r.z.toString(), '55');
  assert.deepEqual(S(r.x), ['4', '3']);
  const f = r.tableroFinal;
  assert.deepEqual(valoresColumnas(f).slice(2, 4).map(String), ['1', '4']);
  assert.deepEqual(nombresBase(f), ['x2', 'x1', 'x3', 'x4']);
  assert.deepEqual(filaTxt(f, 0), ['0', '1', '0', '0', '1', '0', '|', '3']);
  assert.deepEqual(filaTxt(f, 1), ['1', '0', '0', '0', '-1', '1', '|', '4']);
  assert.deepEqual(filaTxt(f, 2), ['0', '0', '1', '0', '-4', '1', '|', '1']);
  assert.deepEqual(filaTxt(f, 3), ['0', '0', '0', '1', '6', '-7', '|', '4']);
  assert.deepEqual(f.zj.map(bmATexto), ['7', '9', '0', '0', '2', '7']);
  assert.deepEqual(f.cz.map(bmATexto), ['0', '0', '0', '0', '-2', '-7']);
  assert.equal(bmATexto(f.zval), '55');
});

test('cortePlanoDeFila: fila de 17/5 y (5/4)s', () => {
  const mk = (a, entera) => ({ a: frac(a), entera });
  const fila = { b: frac('17/5'), coefs: [
    mk('3/2', false), mk('-1/4', false), mk('7/4', true), mk('-1/2', true), mk('9/4', true), mk('-13/5', true)] };
  const m = cortePlanoDeFila(fila, { tipo: 'mixto' });
  assert.deepEqual(S(m.coefs), ['3/2', '1/6', '1/6', '1/3', '1/4', '2/5']);
  assert.equal(m.rhs.toString(), '2/5');
  assert.equal(m.f0.toString(), '2/5');
  const enteras = { b: fila.b, coefs: fila.coefs.map((c) => ({ a: c.a, entera: true })) };
  const f = cortePlanoDeFila(enteras, { tipo: 'fraccional' });
  assert.deepEqual(S(f.coefs), ['1/2', '3/4', '3/4', '1/2', '1/4', '2/5']);
  assert.equal(f.rhs.toString(), '2/5');
  const s = cortePlanoDeFila({ b: frac('1/2'), coefs: [mk('5/4', false)] }, { tipo: 'mixto' });
  assert.equal(s.coefs[0].toString(), '5/4');
  assert.throws(() => cortePlanoDeFila(fila, { tipo: 'fraccional' }), /fraccional solo es válido/);
});

test('fraccional con variable continua: Error en español', () => {
  assert.throws(() => planosDeCorte(modeloDe(e.e1), { tipo: 'fraccional' }), /entero puro/);
});

test('planosDeCorte en e1..e6 (mixto)', () => {
  for (const x of ejemplosMixta) {
    const r = planosDeCorte(modeloDe(x), { tipo: 'mixto' });
    if (r.estado === 'limite_de_cortes') { console.log(`  ${x.id}: limite_de_cortes`); continue; }
    assert.equal(r.estado, 'optimo', x.id);
    assert.equal(r.z.toString(), x.esperado.mixto.z, `${x.id} z`);
  }
});

// ---------------------------------------------------------------------------
// Prueba aleatoria contra fuerza bruta independiente
// ---------------------------------------------------------------------------
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('aleatorio: 200 modelos mixtos vs fuerza bruta, B&B existente y validez de cortes', () => {
  const rnd = mulberry32(20240607);
  const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  let limite = 0, infact = 0, conCortes = 0, totalCortes = 0;
  for (let it = 0; it < 200; it++) {
    const n = ri(2, 3);
    const integer = Array.from({ length: n }, () => rnd() < 0.5);
    if (integer.every(Boolean)) integer[ri(0, n - 1)] = false;
    if (!integer.some(Boolean)) integer[ri(0, n - 1)] = true;
    const m = ri(2, 4);
    const constraints = [];
    for (let k = 0; k < m; k++) {
      const a = Array.from({ length: n }, () => ri(-3, 6));
      if (a.every((v) => v === 0)) a[0] = 1;
      const q = rnd();
      const op = q < 0.65 ? '<=' : q < 0.92 ? '>=' : '=';
      const b = op === '<=' ? ri(5, 40) : op === '>=' ? ri(-4, 8) : ri(0, 10);
      constraints.push({ a, op, b });
    }
    constraints.push({ a: Array(n).fill(1), op: '<=', b: 20 });
    const modelo = {
      sense: rnd() < 0.5 ? 'max' : 'min',
      c: Array.from({ length: n }, () => ri(-3, 9)),
      constraints,
      integer,
    };
    const fb = fuerzaBruta(modelo);
    const cp = planosDeCorte(modelo, { tipo: 'mixto' });
    const ip = solveIP({ ...modelo, options: { maxNodes: 5000 } });
    const rel = resolverRelajacion(modelo);
    const lp = solveLP(modelo);
    const msg = `modelo ${it}: ${JSON.stringify(modelo)}`;

    // relajación: tablero vs solveLP
    assert.equal(rel.estado === 'optimo' ? 'optimal' : rel.estado === 'infactible' ? 'infeasible' : 'unbounded', lp.status, msg);
    if (lp.status === 'optimal') assert.equal(rel.z.toString(), lp.z.toString(), msg);

    // B&B existente
    if (fb.estado === 'infactible') {
      infact++;
      assert.equal(ip.status, 'infeasible', msg);
    } else {
      assert.equal(ip.status, 'optimal', msg);
      assert.equal(ip.best.z.toString(), fb.z.toString(), msg);
    }

    // Planos de corte
    if (cp.estado === 'limite_de_cortes') { limite++; }
    else if (fb.estado === 'infactible') assert.equal(cp.estado, 'infactible', msg);
    else {
      assert.equal(cp.estado, 'optimo', msg);
      assert.equal(cp.z.toString(), fb.z.toString(), msg);
      assert.ok(cp.x.every((v, j) => !integer[j] || v.isInteger()), msg);
    }
    // Validez de cada corte generado: todo punto factible lo cumple
    if (cp.cortes.length) { conCortes++; totalCortes += cp.cortes.length; }
    for (const corte of cp.cortes) {
      const { coefs, op, rhs } = corte.enOriginales;
      for (const p of fb.puntos) {
        let s = frac(0);
        coefs.forEach((cf, j) => { s = s.add(cf.mul(p.x[j])); });
        const ok = op === '<=' ? s.lte(rhs) : s.gte(rhs);
        assert.ok(ok, `corte ${corte.k} inválido en ${p.x.map(String)} — ${msg}`);
      }
    }
  }
  console.log(`  aleatorio: 200 modelos, infactibles=${infact}, con cortes=${conCortes} (${totalCortes} cortes), limite_de_cortes=${limite} (${(limite / 2).toFixed(1)}%)`);
});
