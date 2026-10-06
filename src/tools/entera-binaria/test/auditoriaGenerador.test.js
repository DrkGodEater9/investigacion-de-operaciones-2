import test from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS, generarEjercicio, corregir } from '../domain/generador.js';

// Cálculo propio, independiente del dominio.
const combs = (n) => Array.from({ length: 2 ** n }, (_, m) => Array.from({ length: n }, (_, j) => (m >> (n - 1 - j)) & 1));
const cumpleR = (r, x) => {
  let s = 0;
  r.a.forEach((v, j) => { s += v * x[j]; });
  return r.op === '<=' ? s <= r.b : r.op === '>=' ? s >= r.b : s === r.b;
};
const fact = (m, x) => m.constraints.every((r) => cumpleR(r, x));
const zz = (m, x) => m.c.reduce((t, v, j) => t + v * x[j], 0);
const optProp = (m) => {
  const f = combs(m.c.length).filter((x) => fact(m, x));
  const zs = f.map((x) => zz(m, x));
  const z = m.sense === 'max' ? Math.max(...zs) : Math.min(...zs);
  return { z, sols: f.filter((x) => zz(m, x) === z) };
};
const suma = (x, vars) => vars.reduce((t, j) => t + x[j], 0);
const REGLAS = {
  aLoSumo: (g, x) => suma(x, g.vars) <= g.k,
  alMenos: (g, x) => suma(x, g.vars) >= g.k,
  exactamente: (g, x) => suma(x, g.vars) === g.k,
  alMenosUno: (g, x) => x[g.vars[0]] + x[g.vars[1]] >= 1,
  excluyentes: (g, x) => suma(x, g.vars) <= 1,
  requiere: (g, x) => !(x[g.a] && !x[g.b]),
  juntos: (g, x) => x[g.a] === x[g.b],
};

test('auditoría generador: opción única correcta, distractores incorrectos, detalle con números reales', () => {
  for (const tipo of TIPOS) {
    for (let seed = 1; seed <= 400; seed++) {
      const e = generarEjercicio(tipo, seed);
      const ops = e.entrada.opciones;
      const tag = `${tipo} ${seed}`;
      if (tipo === 'modelar') {
        const ok = ops.map((o) => combs(e.n).every((x) => cumpleR(o.restriccion, x) === REGLAS[e.regla.tipo](e.regla, x)));
        assert.equal(ok.filter(Boolean).length, 1, tag);
        assert.equal(ok.indexOf(true), e.solucion.indice, tag);
        ops.forEach((o, i) => assert.equal(corregir(e, i).correcta, ok[i], tag));
        const nm = (j) => e.items[j];
        const g = e.regla;
        if (g.tipo === 'alMenosUno') assert.ok(e.enunciado.includes(`Al menos uno de ${nm(0)} o ${nm(1)}`), tag);
        if (g.tipo === 'requiere') assert.ok(e.enunciado.includes(`${nm(g.a)} solo puede elegirse si también se elige ${nm(g.b)}`), tag);
        if (g.tipo === 'juntos') assert.ok(e.enunciado.includes(`${nm(g.a)} y ${nm(g.b)} deben`), tag);
        if (g.tipo === 'excluyentes') g.vars.forEach((j) => assert.ok(e.enunciado.includes(nm(j)), tag));
        if (['aLoSumo', 'alMenos', 'exactamente'].includes(g.tipo)) assert.ok(e.enunciado.includes(` ${g.k} de los ${e.n} `), tag);
        assert.equal(new Set(ops.map((o) => o.texto)).size, ops.length, tag);
      } else if (tipo === 'factible') {
        const x = e.datos.x;
        const falla = e.modelo.constraints.map((r, i) => (cumpleR(r, x) ? -1 : i)).filter((i) => i >= 0);
        assert.ok(falla.length <= 1, `${tag}: más de una violada`);
        const v = falla.length ? 1 + falla[0] : 0;
        ops.forEach((o, i) => {
          const r = corregir(e, i);
          assert.equal(r.correcta, i === v, tag);
          e.modelo.constraints.forEach((rc) => {
            const l = rc.a.reduce((t, a, j) => t + a * x[j], 0);
            assert.ok(r.detalle.includes(`${rc.name}: ${l} `), r.detalle);
          });
        });
      } else if (tipo === 'valorZ') {
        const z = zz(e.modelo, e.datos.x);
        assert.equal(corregir(e, z).correcta, true);
        for (const w of [z + 1, z - 1, -z - 1, z + 0.5, z * 2 + 7]) {
          if (w === z) continue;
          const r = corregir(e, w);
          assert.equal(r.correcta, false);
          assert.ok(r.detalle.includes(`= ${z}.`), r.detalle);
        }
        assert.equal(e.solucion.valor, z);
      } else if (tipo === 'enumeracion') {
        const reales = combs(3).map((x, k) => (fact(e.modelo, x) ? k : -1)).filter((k) => k >= 0);
        assert.deepEqual(e.solucion.indices, reales, tag);
        assert.equal(corregir(e, reales).correcta, true);
        assert.equal(corregir(e, reales.slice().reverse()).correcta, true);
        assert.equal(corregir(e, [...reales, reales[0]]).correcta, true);
        assert.equal(corregir(e, reales.slice(1)).correcta, false);
        const otra = [0, 1, 2, 3, 4, 5, 6, 7].find((k) => !reales.includes(k));
        if (otra !== undefined) assert.equal(corregir(e, [...reales, otra]).correcta, false);
      } else if (tipo === 'optimo') {
        const o = optProp(e.modelo);
        assert.equal(o.sols.length, 1, `${tag} óptimo único`);
        const mejor = o.sols[0].join('');
        assert.equal(ops.filter((b) => b === mejor).length, 1, tag);
        assert.equal(new Set(ops).size, 4, tag);
        ops.forEach((b, i) => {
          const x = b.split('').map(Number);
          const r = corregir(e, i);
          assert.equal(r.correcta, b === mejor, tag);
          assert.ok(r.detalle.includes(`Z = ${zz(e.modelo, x)}`), r.detalle);
          assert.ok(r.detalle.includes(`óptimo es ${mejor}, con Z = ${o.z}`), r.detalle);
          if (!r.correcta) assert.equal(r.detalle.includes('no es factible'), !fact(e.modelo, x), tag);
        });
      } else if (tipo === 'trampa') {
        const o = optProp(e.modelo);
        assert.equal(e.solucion.valor, o.z);
        const tope = e.modelo.constraints[0].b;
        assert.ok(o.sols.every((s) => suma(s, s.map((_, j) => j)) < tope), 'el óptimo no llega al máximo');
        assert.equal(corregir(e, o.z).correcta, true);
        assert.equal(corregir(e, o.z + 1).correcta, false);
        assert.ok(e.enunciado.includes(`a lo sumo ${tope},`), tag);
        assert.ok(e.enunciado.includes(`al menos uno de ${e.items[0]} o ${e.items[1]}`), tag);
        assert.equal(/al menos 2 en total/.test(e.enunciado), e.modelo.constraints.length === 3, tag);
      } else if (tipo === 'aditivo') {
        const m = e.modelo;
        // con todo en 0 y restricciones ≥: la infactibilidad que queda al fijar x_j = 1 es Σ max(0, b − a_j)
        const Ij = m.c.map((_, j) => m.constraints.reduce((t, r) => t + Math.max(0, r.b - r.a[j]), 0));
        const mn = Math.min(...Ij);
        assert.equal(Ij.filter((v) => v === mn).length, 1, tag);
        assert.equal(Ij.indexOf(mn), e.solucion.indice, tag);
        ops.forEach((_, i) => {
          const r = corregir(e, i);
          assert.equal(r.correcta, i === e.solucion.indice, tag);
          m.names.forEach((_n, j) => assert.ok(r.detalle.includes(`: ${Ij[j]}`), r.detalle));
        });
      }
    }
  }
});

test('auditoría corregir: entradas raras no revientan', () => {
  const raros = [undefined, null, NaN, Infinity, -Infinity, '', 'abc', '12', {}, [], [NaN], [1.5], [-1], [99], -1, 99, 1.5, 0, -0, 1e308, true, () => 1];
  for (const tipo of TIPOS) {
    const e = generarEjercicio(tipo, 7);
    for (const r of raros) {
      let res;
      assert.doesNotThrow(() => { res = corregir(e, r); }, `${tipo} con ${String(r)}`);
      assert.equal(typeof res.correcta, 'boolean');
      assert.equal(typeof res.mensaje, 'string');
      assert.equal(typeof res.detalle, 'string');
      const indice = ['modelar', 'factible', 'optimo', 'aditivo'].includes(tipo);
      if (indice && !(Number.isInteger(r) && r >= 0 && r < e.entrada.opciones.length)) assert.equal(res.correcta, false, `${tipo} con ${String(r)}`);
      if ((tipo === 'valorZ' || tipo === 'trampa') && !(typeof r === 'number' && Number.isFinite(r))) assert.equal(res.correcta, false);
    }
  }
  const v = generarEjercicio('valorZ', 3);
  assert.equal(corregir(v, v.solucion.valor + 1e-7).correcta, true);
  assert.equal(corregir(v, -v.solucion.valor - 3).correcta, false);
  assert.throws(() => corregir({ tipo: 'nope' }, 1));
});
