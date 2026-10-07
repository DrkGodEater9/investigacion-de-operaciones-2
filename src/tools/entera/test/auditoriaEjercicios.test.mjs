import test from 'node:test';
import assert from 'node:assert/strict';
import { frac, ZERO } from '../domain/fraction.js';
import { solveLP } from '../domain/simplex.js';
import {
  generateExerciseA, generateExerciseB, generateExerciseC, generateExerciseD,
  gradeExercise, leerEntero, parseAndCompareConstraint,
} from '../domain/ejercicios.js';
import { generar, corregir, respuestaCorrecta, leerNumero, TIPOS, decidirPoda } from '../domain/practicaMixta.js';
import { TRUE_FALSE_BANK, MODEL_TEMPLATES } from '../../../topics/entera-pura/practica-data.js';
import { fuerzaBruta } from './utils/fuerzaBruta.mjs';

/**
 * Auditoría de la práctica (temas 1.1 y 1.2): la respuesta correcta de cada ejercicio se recalcula por otro
 * camino (enumeración de la retícula, vértices con fracciones, fórmulas escritas aparte) en miles de semillas.
 */
const SEEDS = 800;
const evalLin = (a, x) => a.reduce((s, v, j) => s.add(frac(v).mul(x[j])), ZERO);
const factibleEntero = (m, x) => m.constraints.every((c) => evalLin(c.a, x).lte(frac(c.b)));
function enumerarEnteros(m, cota = 45) {
  const pts = [];
  for (let a = 0; a <= cota; a++) for (let b = 0; b <= cota; b++) if (factibleEntero(m, [a, b])) pts.push([a, b]);
  return pts;
}
const zDe = (m, p) => evalLin(m.c, p);
/** Óptimo único de la relajación: ninguna perturbación pequeña del objetivo cambia el punto óptimo. */
function relajacionTieneOptimoUnico(m) {
  const base = solveLP({ sense: 'max', c: m.c, constraints: m.constraints });
  for (const [d1, d2] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = [frac(m.c[0]).mul(1000).add(d1), frac(m.c[1]).mul(1000).add(d2)];
    const r = solveLP({ sense: 'max', c, constraints: m.constraints });
    if (!r.x.every((v, j) => v.eq(base.x[j]))) return false;
  }
  return true;
}
const redondeo = (f) => f.add(frac('1/2')).floor(); // entero más cercano (sin empates en estos ejercicios)

test('ejercicio A: redondeo sin empates, óptimo único y cifras correctas (miles de semillas)', () => {
  for (let s = 1; s <= SEEDS; s++) {
    const e = generateExerciseA(s);
    const m = e.model;
    const lp = fuerzaBruta({ ...m, integer: [false, false] }, { cota: 0 });
    const [x1, x2] = lp.x;
    assert.ok(!x1.fractionalPart().eq(frac('1/2')) && !x2.fractionalPart().eq(frac('1/2')), `seed ${s}: empate en x,5`);
    assert.ok(!x1.isInteger() || !x2.isInteger(), `seed ${s}: relajación entera`);
    assert.ok(relajacionTieneOptimoUnico(m), `seed ${s}: la relajación tiene óptimos alternativos`);
    assert.equal(e.nearestRounding.x1, Number(redondeo(x1)), `seed ${s}`);
    assert.equal(e.nearestRounding.x2, Number(redondeo(x2)), `seed ${s}`);
    const fact = factibleEntero(m, [e.nearestRounding.x1, e.nearestRounding.x2]);
    assert.equal(e.nearestRounding.isFeasible, fact, `seed ${s}`);
    assert.equal(e.nearestRounding.z, Number(zDe(m, [e.nearestRounding.x1, e.nearestRounding.x2]).n), `seed ${s}`);
    const pts = enumerarEnteros(m);
    const zs = pts.map((p) => zDe(m, p));
    const zmax = zs.reduce((a, b) => (a.gt(b) ? a : b));
    const optimos = pts.filter((p, i) => zs[i].eq(zmax));
    assert.equal(optimos.length, 1, `seed ${s}: óptimo no único`);
    assert.deepEqual([e.optimal.x1, e.optimal.x2, e.optimal.z], [optimos[0][0], optimos[0][1], Number(zmax.n)], `seed ${s}`);
    const g = gradeExercise(e, { r1: e.nearestRounding.x1, r2: e.nearestRounding.x2, isFeasible: fact, optX1: e.optimal.x1, optX2: e.optimal.x2, optZ: e.optimal.z });
    assert.ok(g.isCorrect, `seed ${s}`);
  }
});

test('ejercicio B: variable, ramas y decisión de cada hijo coinciden con un cálculo independiente', () => {
  for (let s = 1; s <= SEEDS; s++) {
    const e = generateExerciseB(s);
    const k = e.branchVar === 'x1' ? 0 : 1;
    const lp = solveLP({ sense: 'max', c: e.model.c, constraints: e.model.constraints });
    const f = lp.x.map((v) => v.fractionalPart());
    assert.ok(!f[0].eq(f[1]), `seed ${s}: empate`);
    assert.ok(relajacionTieneOptimoUnico(e.model), `seed ${s}: la relajación tiene óptimos alternativos`);
    assert.equal(k, f[0].gt(f[1]) ? 0 : 1, `seed ${s}`);
    assert.equal(e.leftBranch.bound, Number(lp.x[k].floor()));
    assert.equal(e.rightBranch.bound, Number(lp.x[k].ceil()));
    const rama = (op, b) => {
      const a = [0, 0]; a[k] = 1;
      return solveLP({ sense: 'max', c: e.model.c, constraints: [...e.model.constraints, { a, op, b }] });
    };
    const L = rama('<=', e.leftBranch.bound), R = rama('>=', e.rightBranch.bound);
    const ent = (r) => r.status === 'optimal' && r.x.every((v) => v.isInteger());
    const cls = (me, otro) => (me.status !== 'optimal' ? 'infactible' : ent(me) ? 'entera' : ent(otro) && me.z.floor() <= otro.z.floor() ? 'cota' : 'ramificar');
    assert.equal(e.children[0].expectedAction, cls(L, R), `seed ${s} P1`);
    assert.equal(e.children[1].expectedAction, cls(R, L), `seed ${s} P2`);
    for (const [r, c] of [[L, e.children[0]], [R, e.children[1]]]) {
      if (r.status === 'optimal' && !r.z.isInteger()) assert.ok(/Z = \d+,\d+/.test(c.sol), `seed ${s}: ${c.sol}`);
    }
    const m = { ...e.model, integer: [true, true] };
    const pts = enumerarEnteros(m);
    const zmax = pts.map((p) => zDe(m, p)).reduce((a, b) => (a.gt(b) ? a : b));
    assert.equal(e.optimal.z, Number(zmax.n), `seed ${s}`);
  }
});

test('ejercicio C: el enunciado coincide con el modelo, el óptimo es único y la opción correcta es la única válida', () => {
  for (let s = 1; s <= SEEDS; s++) {
    const e = generateExerciseC(s);
    const m = e.model;
    const nums = [...m.c, ...m.constraints.flatMap((c) => [...c.a, c.b])];
    for (const n of nums) assert.ok(e.story.includes(String(n)), `seed ${s}: el relato no menciona ${n}`);
    const pts = enumerarEnteros(m);
    const zs = pts.map((p) => zDe(m, p));
    const zmax = zs.reduce((a, b) => (a.gt(b) ? a : b));
    assert.equal(pts.filter((p, i) => zs[i].eq(zmax)).length, 1, `seed ${s}: óptimo no único`);
    const opt = pts[zs.findIndex((z) => z.eq(zmax))];
    assert.deepEqual([e.optimal.x1, e.optimal.x2, e.optimal.z], [opt[0], opt[1], Number(zmax.n)], `seed ${s}`);
    assert.equal(e.options.filter((o) => o.isCorrect).length, 1);
    assert.equal(e.options[e.correctOptionIndex].isCorrect, true);
    assert.ok(!solveLP(m).x.every((v) => v.isInteger()), `seed ${s}: relajación entera`);
    assert.ok(relajacionTieneOptimoUnico(m), `seed ${s}: la relajación tiene óptimos alternativos`);
    const g = gradeExercise(e, { optionIndex: e.correctOptionIndex, optX1: e.optimal.x1, optX2: e.optimal.x2, optZ: e.optimal.z });
    assert.ok(g.isCorrect);
  }
  assert.ok(MODEL_TEMPLATES.length >= 3);
});

test('ejercicio D: banco verdadero/falso (cifras de las explicaciones y todas las semillas)', () => {
  for (let s = 1; s <= 300; s++) {
    const e = generateExerciseD(s);
    assert.ok(e.statement && e.explanation && typeof e.expectedAnswer === 'boolean');
    assert.ok(gradeExercise(e, { answer: e.expectedAnswer }).isCorrect);
    assert.ok(!gradeExercise(e, { answer: !e.expectedAnswer }).isCorrect);
  }
  const lp = solveLP({ sense: 'max', c: [5, 4], constraints: [{ a: [1, 1], op: '<=', b: 5 }, { a: [10, 6], op: '<=', b: 45 }] });
  assert.deepEqual(lp.x.map(String), ['15/4', '5/4']);
  assert.equal(10 * 4 + 6 * 1, 46);
  assert.equal(5 * 3 + 4 * 1, 19);
  assert.equal(5 * 3 + 4 * 2, 23);
  assert.equal(Math.floor(23.8), 23);
  const cuerpo = TRUE_FALSE_BANK.map((q) => q.explanation).join(' ');
  for (const frag of ['10·4 + 6·1 = 46 > 45', '(3, 1) con Z = 19', '(3, 2) con Z = 23', '⌊23,8⌋ = 23']) assert.ok(cuerpo.includes(frag), frag);
});

test('corrección de la práctica pura: enteros estrictos (3,0 sí; 3,5 no) y Z obligatorio', () => {
  assert.equal(leerEntero('3'), 3);
  assert.equal(leerEntero('3,0'), 3);
  assert.equal(leerEntero('3.0'), 3);
  assert.equal(leerEntero(' +4 '), 4);
  assert.ok(Number.isNaN(leerEntero('3,5')));
  assert.ok(Number.isNaN(leerEntero('')));
  assert.ok(Number.isNaN(leerEntero('abc')));
  const e = generateExerciseA(0);
  const ok = { r1: '4', r2: '1', isFeasible: false, optX1: '3,0', optX2: '2.0', optZ: '23' };
  assert.ok(gradeExercise(e, ok).isCorrect);
  assert.ok(!gradeExercise(e, { ...ok, optX1: '3,5' }).isCorrect);
  assert.ok(!gradeExercise(e, { ...ok, optZ: '' }).isCorrect, 'Z vacío no debe dar por bueno el óptimo');
  assert.ok(parseAndCompareConstraint('x₁ ≤ 3', 'x1', '<=', 3));
  assert.ok(parseAndCompareConstraint('3 >= x1', 'x1', '<=', 3));
  assert.ok(parseAndCompareConstraint('x1<=3,0', 'x1', '<=', 3));
  assert.ok(!parseAndCompareConstraint('x1 >= 3', 'x1', '<=', 3));
  assert.ok(!parseAndCompareConstraint('x2 <= 3', 'x1', '<=', 3));
});

test('práctica mixta: lectura de números (fracción, coma, punto, signo menos tipográfico)', () => {
  const casos = { '3': '3', '2,5': '5/2', '2.5': '5/2', '7/2': '7/2', '-1/2': '-1/2', '−3': '-3', ' + 4 ': '4', '.5': '1/2', '0,25': '1/4', '1,5/2': '3/4' };
  for (const [t, v] of Object.entries(casos)) assert.equal(String(leerNumero(t)), v, t);
  for (const t of ['', 'a', '1/0', '1/2/3', '1,2,3', '--2']) assert.equal(leerNumero(t), null, t);
});

test('práctica mixta: «resolver» coincide con enumeración de vértices; ramas con x2 entera (basta un nivel)', () => {
  for (let s = 1; s <= 400; s++) {
    const e = generar('resolver', s);
    const mod = { sense: 'max', c: e.enunciado.c, constraints: e.enunciado.restricciones.map((r) => ({ a: r.a, op: '<=', b: r.b })), integer: [false, true] };
    const bf = fuerzaBruta(mod, { cota: 70 });
    assert.equal(e.solucion.zMixto, bf.z.toString(), `seed ${s}`);
    assert.equal(e.solucion.x2, bf.x[1].toString(), `seed ${s}`);
    const rel = solveLP(mod);
    assert.equal(e.solucion.zRelajacion, rel.z.toString(), `seed ${s}`);
    for (const [op, b] of [['<=', rel.x[1].floor()], ['>=', rel.x[1].ceil()]]) {
      const r = solveLP({ ...mod, constraints: [...mod.constraints, { a: [0, 1], op, b }] });
      if (r.status === 'optimal') assert.ok(r.x[1].isInteger(), `seed ${s}: la rama necesitaría otro nivel`);
    }
    const z = frac(e.solucion.zMixto);
    for (const txt of [z.toString(), z.toNumber().toFixed(3).replace('.', ','), z.toNumber().toFixed(3)]) {
      const c = corregir(e, { zRelajacion: rel.z.toString(), x2: e.solucion.x2, zMixto: txt });
      assert.ok(c.detalle[2].ok, `seed ${s}: «${txt}» debía aceptarse`);
    }
  }
});

test('práctica mixta: cortes de Gomory válidos para todo punto entero admisible de la fila', () => {
  for (let s = 1; s <= SEEDS; s++) {
    const e = generar('corte', s);
    const { b, noBasicas, tipoCorte } = e.enunciado;
    const bf = frac(b);
    const f0 = bf.fractionalPart();
    assert.equal(e.solucion.f0, f0.toString());
    assert.equal(e.solucion.rhs, f0.toString());
    const coef = noBasicas.map((v) => {
      const a = frac(v.a), fj = a.fractionalPart();
      if (tipoCorte === 'fraccional') return fj;
      if (v.entera) return fj.lte(f0) ? fj : f0.mul(frac(1).sub(fj)).div(frac(1).sub(f0));
      return a.gt(ZERO) ? a : f0.mul(a.neg()).div(frac(1).sub(f0));
    });
    noBasicas.forEach((v, i) => assert.equal(e.solucion.coefs[`c_${v.nombre}`], coef[i].toString(), `seed ${s} ${v.nombre}`));
    // x_B = b − Σ a_j y_j entero ≥ 0 con y_j ≥ 0 (entero o fracción si es continua)  ⇒  Σ coef·y ≥ f0
    const rec = (i, y) => {
      if (i === noBasicas.length) {
        const xB = bf.sub(y.reduce((acc, yi, j) => acc.add(frac(noBasicas[j].a).mul(yi)), ZERO));
        if (xB.isInteger() && xB.gte(ZERO)) {
          const lhs = y.reduce((acc, yi, j) => acc.add(coef[j].mul(yi)), ZERO);
          assert.ok(lhs.gte(f0), `seed ${s}: el corte elimina un punto entero admisible ${y.map(String)}`);
        }
        return;
      }
      const vals = noBasicas[i].entera
        ? [0, 1, 2, 3, 4].map((p) => frac(p))
        : [0, 1, 2, 3].flatMap((p) => [frac(p), frac(p).add(frac('2/5')), frac(p).add(frac('1/3'))]);
      for (const v of vals) rec(i + 1, [...y, v]);
    };
    if (noBasicas.length <= 4) rec(0, []);
    assert.ok(ZERO.lt(f0)); // la solución actual (no básicas en 0) queda cortada: 0 ≥ f0 es falso
    assert.ok(corregir(e, respuestaCorrecta(e)).correcto);
  }
});

test('práctica mixta: poda y ramificar contra reglas escritas aparte; todas las semillas sin excepción', () => {
  for (let s = 1; s <= 3000; s++) {
    for (const tipo of TIPOS) {
      const e = generar(tipo, s);
      assert.ok(e.campos.length > 0 && e.explicacion.length > 0);
      JSON.stringify(e);
      assert.ok(corregir(e, respuestaCorrecta(e)).correcto, `${tipo} ${s}`);
      assert.ok(!corregir(e, {}).correcto, `${tipo} ${s}: respuesta vacía no puede ser correcta`);
      if (tipo === 'poda') {
        const { sentido, incumbente, nodo } = e.enunciado;
        let esperado;
        if (!nodo.factible) esperado = 'infactibilidad';
        else if (incumbente !== null && (sentido === 'max' ? frac(nodo.z).lte(frac(incumbente)) : frac(nodo.z).gte(frac(incumbente)))) esperado = 'cota';
        else esperado = nodo.enterasEnteras ? 'incumbente' : 'ramificar';
        assert.equal(e.solucion.accion, esperado, `poda ${s}`);
        assert.equal(decidirPoda({ sentido, incumbente, nodo }), esperado);
      }
      if (tipo === 'ramificar') {
        const validas = e.enunciado.variables.filter((v) => v.entera && !frac(v.valor).isInteger()).map((v) => v.nombre);
        assert.deepEqual(e.solucion.validas, validas);
        for (const nm of validas) {
          const v = frac(e.enunciado.variables.find((x) => x.nombre === nm).valor);
          assert.equal(e.solucion.limites[nm].piso, String(v.floor()));
          assert.equal(e.solucion.limites[nm].techo, String(v.floor() + 1n));
          const l = e.solucion.limites[nm];
          assert.ok(corregir(e, { variable: nm, cotaInf: l.piso, cotaSup: l.techo }).correcto);
        }
      }
    }
  }
});
