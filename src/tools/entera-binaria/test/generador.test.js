import test from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS, generarEjercicio, corregir, mulberry32 } from '../domain/generador.js';
import { EJEMPLOS } from '../domain/ejemplos.js';

const M = (id) => EJEMPLOS.find((e) => e.id === id).model;
const SEEDS = [...Array.from({ length: 200 }, (_, i) => i + 1), ...Array.from({ length: 101 }, (_, i) => 5000 + i)];

// ── Cálculo independiente (bucles propios) ──
const combos = (n) => {
  const out = [];
  for (let m = 0; m < 2 ** n; m++) {
    const x = [];
    for (let j = 0; j < n; j++) x.push((m >> (n - 1 - j)) & 1);
    out.push(x);
  }
  return out;
};
function lado(a, x) { let s = 0; for (let j = 0; j < x.length; j++) s += a[j] * x[j]; return s; }
function cumple(r, x) {
  const s = lado(r.a, x);
  return r.op === '<=' ? s <= r.b : r.op === '>=' ? s >= r.b : s === r.b;
}
const factibleProp = (m, x) => { for (const r of m.constraints) if (!cumple(r, x)) return false; return true; };
const zProp = (m, x) => { let z = 0; for (let j = 0; j < x.length; j++) z += m.c[j] * x[j]; return z; };
const mejor = (m, a, b) => (m.sense === 'max' ? a > b : a < b);

function optimoPropio(m) {
  const n = m.c.length;
  let best = null; let cuenta = 0; let sols = [];
  (function rec(j, x) {
    if (j === n) {
      if (!factibleProp(m, x)) return;
      const z = zProp(m, x);
      if (best === null || mejor(m, z, best)) { best = z; cuenta = 1; sols = [x.slice()]; }
      else if (z === best) { cuenta += 1; sols.push(x.slice()); }
      return;
    }
    for (const v of [0, 1]) { x[j] = v; rec(j + 1, x); }
    x.length = j;
  })(0, []);
  return { z: best, cuenta, sols };
}

// predicados de regla escritos aparte del generador
function predicado(regla, n) {
  const vars = regla.vars || Array.from({ length: n }, (_, j) => j);
  const suma = (x) => { let s = 0; for (const j of vars) s += x[j]; return s; };
  switch (regla.tipo) {
    case 'aLoSumo': return (x) => suma(x) <= regla.k;
    case 'alMenos': return (x) => suma(x) >= regla.k;
    case 'exactamente': return (x) => suma(x) === regla.k;
    case 'alMenosUno': return (x) => x[vars[0]] === 1 || x[vars[1]] === 1;
    case 'excluyentes': return (x) => suma(x) <= 1;
    case 'requiere': return (x) => !(x[regla.a] === 1 && x[regla.b] === 0);
    case 'juntos': return (x) => (x[regla.a] === 1) === (x[regla.b] === 1);
    default: throw new Error(regla.tipo);
  }
}

test('mulberry32: rango, int inclusivo, pick y shuffle (copia)', () => {
  const r = mulberry32(7);
  const vistos = new Set();
  for (let i = 0; i < 500; i++) {
    const v = r.next(); assert.ok(v >= 0 && v < 1);
    const k = r.int(2, 4); assert.ok(k >= 2 && k <= 4); vistos.add(k);
  }
  assert.deepEqual([...vistos].sort(), [2, 3, 4]);
  const arr = [1, 2, 3, 4, 5];
  const copia = r.shuffle(arr);
  assert.deepEqual(arr, [1, 2, 3, 4, 5]);
  assert.deepEqual([...copia].sort(), arr);
  assert.ok(arr.includes(r.pick(arr)));
  assert.deepEqual(mulberry32(3).next(), mulberry32(3).next());
});

test('a) determinismo y serialización JSON', () => {
  for (const t of TIPOS) {
    for (let s = 1; s <= 50; s++) {
      const e = generarEjercicio(t, s);
      assert.deepEqual(generarEjercicio(t, s), e);
      assert.deepEqual(JSON.parse(JSON.stringify(e)), e);
      assert.equal(e.id, `${t}-${s}`);
    }
  }
});

test('b) variedad: al menos 100 de 200 (enunciado + modelo/regla)', () => {
  for (const t of TIPOS) {
    const set = new Set();
    for (let s = 1; s <= 200; s++) {
      const e = generarEjercicio(t, s);
      set.add(e.enunciado + '|' + JSON.stringify(e.modelo) + '|' + JSON.stringify(e.regla));
    }
    assert.ok(set.size >= 100, `${t}: solo ${set.size} distintos`);
  }
});

test('c) modelar: correcta equivalente, distractores no, 4 distintas', () => {
  for (const s of SEEDS) {
    const e = generarEjercicio('modelar', s);
    const n = e.n;
    assert.ok(n >= 4 && n <= 6);
    const pred = predicado(e.regla, n);
    const ops = e.entrada.opciones;
    assert.equal(ops.length, 4);
    assert.equal(new Set(ops.map((o) => o.texto)).size, 4);
    assert.equal(new Set(ops.map((o) => JSON.stringify(o.restriccion))).size, 4);
    let correctas = 0;
    ops.forEach((o, i) => {
      const equiv = combos(n).every((x) => pred(x) === cumple(o.restriccion, x));
      if (equiv) { correctas += 1; assert.equal(i, e.solucion.indice); }
    });
    assert.equal(correctas, 1, `semilla ${s}`);
    if (e.regla.tipo === 'juntos') assert.equal(ops[e.solucion.indice].restriccion.op, '=');
    assert.equal(corregir(e, e.solucion.indice).correcta, true);
    ops.forEach((_, i) => {
      if (i === e.solucion.indice) return;
      const c = corregir(e, i);
      assert.equal(c.correcta, false);
      assert.match(c.detalle, /Con x = \(/);
    });
  }
});

test('d) factible: 0 o 1 restricción violada y solución coincide', () => {
  for (const s of SEEDS) {
    const e = generarEjercicio('factible', s);
    const x = e.datos.x;
    const n = e.modelo.c.length;
    assert.ok(n >= 3 && n <= 5);
    assert.ok(e.modelo.constraints.length >= 2 && e.modelo.constraints.length <= 3);
    const fallan = [];
    e.modelo.constraints.forEach((r, i) => { if (!cumple(r, x)) fallan.push(i); });
    assert.ok(fallan.length <= 1, `semilla ${s}`);
    assert.equal(e.solucion.indice, fallan.length ? 1 + fallan[0] : 0);
    assert.equal(e.entrada.opciones.length, 1 + e.modelo.constraints.length);
    assert.equal(corregir(e, e.solucion.indice).correcta, true);
    const mala = corregir(e, (e.solucion.indice + 1) % e.entrada.opciones.length);
    assert.equal(mala.correcta, false);
    assert.match(mala.detalle, /→ (se cumple|no se cumple)/);
  }
});

test('e) valorZ: Z a mano y tolerancia', () => {
  for (const s of SEEDS) {
    const e = generarEjercicio('valorZ', s);
    assert.equal(e.solucion.valor, zProp(e.modelo, e.datos.x));
    assert.equal(corregir(e, e.solucion.valor).correcta, true);
    const mala = corregir(e, e.solucion.valor + 1);
    assert.equal(mala.correcta, false);
    assert.ok(mala.detalle.includes(String(e.solucion.valor)));
  }
});

test('f) enumeracion: factibles recalculadas', () => {
  for (const s of SEEDS) {
    const e = generarEjercicio('enumeracion', s);
    const cs = combos(3);
    const reales = [];
    cs.forEach((x, k) => { if (factibleProp(e.modelo, x)) reales.push(k); });
    assert.deepEqual(e.solucion.indices, reales);
    assert.ok(reales.length >= 2 && reales.length <= 6);
    assert.deepEqual(e.entrada.opciones, cs.map((x) => x.join('')));
    assert.equal(corregir(e, reales).correcta, true);
    const mala = corregir(e, reales.slice(1));
    assert.equal(mala.correcta, false);
    assert.match(mala.detalle, /Faltaron/);
  }
});

test('g) optimo: único, una óptima, una no factible, una factible no óptima', () => {
  for (const s of SEEDS) {
    const e = generarEjercicio('optimo', s);
    const o = optimoPropio(e.modelo);
    assert.equal(o.cuenta, 1, `semilla ${s}`);
    const ops = e.entrada.opciones;
    assert.equal(ops.length, 4);
    assert.equal(new Set(ops).size, 4);
    let opt = 0; let inf = 0; let noOpt = 0;
    ops.forEach((t) => {
      const x = t.split('').map(Number);
      if (!factibleProp(e.modelo, x)) inf += 1;
      else if (zProp(e.modelo, x) === o.z) opt += 1;
      else noOpt += 1;
    });
    assert.equal(opt, 1);
    assert.ok(inf >= 1 && noOpt >= 1);
    assert.equal(ops[e.solucion.indice], o.sols[0].join(''));
    assert.equal(corregir(e, e.solucion.indice).correcta, true);
    ops.forEach((_, i) => { if (i !== e.solucion.indice) assert.equal(corregir(e, i).correcta, false); });
  }
});

test('h) trampa: costo mínimo verificado y óptimo factible', () => {
  for (const s of SEEDS) {
    const e = generarEjercicio('trampa', s);
    const o = optimoPropio(e.modelo);
    assert.equal(e.solucion.valor, o.z);
    assert.ok(o.sols.length >= 1 && factibleProp(e.modelo, o.sols[0]));
    assert.equal(e.modelo.sense, 'min');
    const n = e.modelo.c.length;
    assert.ok(n >= 5 && n <= 6);
    assert.equal(corregir(e, o.z).correcta, true);
    const mala = corregir(e, o.z + 3);
    assert.equal(mala.correcta, false);
    assert.ok(mala.detalle.includes('Z = '));
  }
});

test('i) aditivo: Ij propias, mínimo único, version taha', () => {
  for (const s of SEEDS) {
    const e = generarEjercicio('aditivo', s);
    assert.equal(e.version, 'taha');
    const m = e.modelo;
    const n = m.c.length;
    const infact = (fijadas) => {
      let t = 0;
      for (const r of m.constraints) {
        let sum = 0; for (const j of fijadas) sum += r.a[j];
        if (sum < r.b) t += r.b - sum;
      }
      return t;
    };
    const Ij = Array.from({ length: n }, (_, j) => infact([j]));
    const min = Math.min(...Ij);
    assert.equal(Ij.filter((v) => v === min).length, 1, `semilla ${s}`);
    assert.equal(e.solucion.indice, Ij.indexOf(min));
    assert.equal(e.entrada.opciones.length, n);
    assert.equal(corregir(e, e.solucion.indice).correcta, true);
    const otra = (e.solucion.indice + 1) % n;
    const mala = corregir(e, otra);
    assert.equal(mala.correcta, false);
    assert.ok(mala.detalle.includes(String(infact([]))));
  }
});

test('j) corregir con ejercicios armados a mano', () => {
  // valorZ T2
  const ev = { tipo: 'valorZ', modelo: M('T2'), datos: { x: [1, 0, 1] }, entrada: { tipo: 'numero' } };
  assert.equal(corregir(ev, 85).correcta, true);
  const mz = corregir(ev, 75);
  assert.equal(mz.correcta, false);
  assert.ok(mz.detalle.includes('85'));
  assert.ok(mz.detalle.includes('50·1 + 40·0 + 35·1 = 85'));
  assert.equal(corregir(ev, 85 + 1e-9).correcta, true);

  // optimo T3
  const eo = { tipo: 'optimo', modelo: M('T3'), entrada: { tipo: 'opcion', opciones: ['110', '101', '011', '111'] }, solucion: { indice: 2 } };
  assert.equal(corregir(eo, 2).correcta, true);
  const mo = corregir(eo, 1);
  assert.equal(mo.correcta, false);
  assert.ok(mo.detalle.includes('101'));
  assert.ok(mo.detalle.includes('Z = 12'));
  assert.match(mo.detalle, /óptimo es .*Z = 10/);
  // no factible
  const m110 = corregir({ ...eo, modelo: { ...M('T3'), constraints: [{ name: 'Capacidad', a: [100, 80, 60], op: '>=', b: 200 }] } }, 0);
  assert.equal(m110.correcta, false);

  // trampa TORRES
  const torres = M('TORRES');
  const et = { tipo: 'trampa', modelo: torres, entrada: { tipo: 'numero' } };
  assert.equal(corregir(et, 5).correcta, true);
  const mt = corregir(et, 15);
  assert.equal(mt.correcta, false);
  assert.ok(mt.detalle.includes('Z = 5 = 5'));
  assert.ok(mt.detalle.includes('a lo sumo 3'));
  const conExtra = { ...torres, constraints: [...torres.constraints, { name: 'Al menos 2', a: [1, 1, 1, 1, 1], op: '>=', b: 2 }] };
  assert.equal(optimoPropio(conExtra).z, 9);
  assert.equal(corregir({ tipo: 'trampa', modelo: conExtra, entrada: { tipo: 'numero' } }, 9).correcta, true);
  assert.equal(corregir({ tipo: 'trampa', modelo: conExtra, entrada: { tipo: 'numero' } }, 5).correcta, false);

  // enumeracion T3
  const ee = { tipo: 'enumeracion', modelo: M('T3'), entrada: { tipo: 'multi', opciones: combos(3).map((x) => x.join('')) } };
  assert.equal(corregir(ee, [3, 5, 6, 7]).correcta, true);
  assert.equal(corregir(ee, [7, 3, 6, 5]).correcta, true);
  const me = corregir(ee, [3, 4, 6, 7]);
  assert.equal(me.correcta, false);
  assert.match(me.detalle, /Faltaron:\n101/);
  assert.match(me.detalle, /Sobraron:\n100/);

  // aditivo T3
  const ea = { tipo: 'aditivo', version: 'taha', modelo: M('T3'), entrada: { tipo: 'opcion', opciones: ['x₁', 'x₂', 'x₃'] } };
  assert.equal(corregir(ea, 0).correcta, true);
  const ma = corregir(ea, 2);
  assert.equal(ma.correcta, false);
  for (const v of ['140', '40', '60', '80']) assert.ok(ma.detalle.includes(v), v);

  // modelar requiere
  const emod = {
    tipo: 'modelar', n: 3, regla: { tipo: 'requiere', a: 1, b: 0 },
    entrada: {
      tipo: 'opcion',
      opciones: [
        { texto: 'x₁ − x₂ ≤ 0', restriccion: { a: [1, -1, 0], op: '<=', b: 0 } },
        { texto: '−x₁ + x₂ ≤ 0', restriccion: { a: [-1, 1, 0], op: '<=', b: 0 } },
      ],
    },
  };
  assert.equal(corregir(emod, 1).correcta, true);
  const mm = corregir(emod, 0);
  assert.equal(mm.correcta, false);
  assert.match(mm.detalle, /Con x = \(0, 1, 0\), la regla no se cumple pero tu restricción/);

  // factible a mano
  const ef = { tipo: 'factible', modelo: M('T1'), datos: { x: [1, 0, 0] }, entrada: { tipo: 'opcion', opciones: ['Es factible', 'No es factible: falla «Procesamiento»', 'No es factible: falla «Memoria»'] } };
  const mf = corregir(ef, 0);
  assert.equal(mf.correcta, false);
  assert.ok(mf.detalle.includes('Procesamiento: 1 ≥ 3 → no se cumple'));
  assert.ok(mf.detalle.includes('Memoria: 2 ≥ 4 → no se cumple'));
  assert.equal(corregir(ef, 1).correcta, true);

  // respuestas no válidas
  assert.equal(corregir(ev, 'abc').correcta, false);
  assert.equal(corregir(ee, 'x').correcta, false);
});

test('k) sin funciones ni referencias circulares; solo JSON', () => {
  for (const t of TIPOS) {
    for (let s = 1; s <= 30; s++) {
      const e = generarEjercicio(t, s);
      const visto = new Set();
      (function rec(v, camino) {
        assert.notEqual(typeof v, 'function');
        assert.notEqual(v, undefined, camino);
        if (v && typeof v === 'object') {
          assert.ok(!visto.has(v), 'referencia repetida/circular en ' + camino);
          visto.add(v);
          for (const k of Object.keys(v)) rec(v[k], camino + '.' + k);
          visto.delete(v);
        }
      })(e, t);
    }
  }
});
