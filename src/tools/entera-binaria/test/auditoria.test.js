import test from 'node:test';
import assert from 'node:assert/strict';
import { balas } from '../domain/balas.js';
import { evaluate } from '../domain/evaluar.js';
import { mulberry32 } from './utils.mjs';

/** Fuerza bruta propia (aritmética entera/decimal exacta por escala x2). */
function brute(m) {
  const n = m.c.length;
  let best = null; let nf = 0;
  for (let mask = 0; mask < 2 ** n; mask++) {
    let ok = true;
    for (const r of m.constraints) {
      let s = 0;
      for (let j = 0; j < n; j++) if ((mask >> j) & 1) s += r.a[j];
      if (r.op === '<=' ? s > r.b : r.op === '>=' ? s < r.b : s !== r.b) { ok = false; break; }
    }
    if (!ok) continue;
    nf++;
    let z = 0;
    for (let j = 0; j < n; j++) if ((mask >> j) & 1) z += m.c[j];
    if (best === null || (m.sense === 'max' ? z > best : z < best)) best = z;
  }
  return { best, nf };
}

function modelo(rng, nMax, cMin, cMax) {
  const n = rng.int(1, nMax);
  const mm = rng.int(0, 5);
  return {
    sense: rng.pick(['max', 'min']),
    names: Array.from({ length: n }, (_, j) => 'x' + (j + 1)),
    c: Array.from({ length: n }, () => rng.int(cMin, cMax) / rng.pick([1, 1, 2])),
    constraints: Array.from({ length: mm }, (_, i) => ({
      name: 'R' + (i + 1),
      a: Array.from({ length: n }, () => (rng.next() < 0.25 ? 0 : rng.int(-6, 9) / rng.pick([1, 1, 2]))),
      op: rng.pick(['<=', '>=', '=', '<=', '>=']),
      b: rng.int(-8, 20) / rng.pick([1, 1, 2]),
    })),
  };
}

for (const [seed, nMax, cMin, cMax] of [[1, 12, -9, 9], [2, 12, 0, 0], [3, 6, -3, 3], [4, 12, 0, 9], [5, 9, -9, 0]]) {
  test(`auditoría: balas vs fuerza bruta (semilla ${seed})`, () => {
    const rng = mulberry32(seed);
    for (let k = 0; k < 1200; k++) {
      const m = modelo(rng, nMax, cMin, cMax);
      const bf = brute(m);
      const b = balas(m, { maxNodes: 1e7 });
      assert.equal(b.status, bf.nf ? 'optimo' : 'infactible', JSON.stringify(m));
      if (bf.nf) {
        assert.ok(Math.abs(b.best.z - bf.best) < 1e-9, `z ${b.best.z} vs ${bf.best} ${JSON.stringify(m)}`);
        const ev = evaluate(m, b.best.x);
        assert.ok(ev.feasible, 'x factible ' + JSON.stringify(m));
        assert.ok(Math.abs(ev.z - b.best.z) < 1e-9, 'z coincide con evaluate');
        // la historia de incumbentes mejora monótonamente y termina en best
        const h = b.incumbentHistory;
        for (let i = 1; i < h.length; i++) assert.ok(m.sense === 'max' ? h[i].z > h[i - 1].z : h[i].z < h[i - 1].z);
        assert.ok(Math.abs(h[h.length - 1].z - b.best.z) < 1e-9);
      } else assert.equal(b.best, null);
    }
  });
}

test('auditoría: límite de nodos devuelve un best parcial factible y consistente', () => {
  const rng = mulberry32(77);
  let vistos = 0;
  for (let k = 0; k < 400 && vistos < 40; k++) {
    const m = modelo(rng, 12, -9, 9);
    const full = balas(m, { maxNodes: 1e7 });
    if (full.trace.length < 6) continue;
    for (const lim of [1, 2, 3, Math.floor(full.trace.length / 2)]) {
      const p = balas(m, { maxNodes: lim });
      if (p.status !== 'limite') continue;
      vistos++;
      assert.ok(p.trace.length <= lim);
      if (p.best) {
        const ev = evaluate(m, p.best.x);
        assert.ok(ev.feasible);
        assert.ok(Math.abs(ev.z - p.best.z) < 1e-9);
        // nunca mejor que el óptimo real
        assert.ok(m.sense === 'max' ? p.best.z <= full.best.z + 1e-9 : p.best.z >= full.best.z - 1e-9);
      }
    }
  }
  assert.ok(vistos > 5);
});

test('auditoría: n = 30 con poca estructura termina (óptimo o límite) en tiempo razonable', () => {
  const rng = mulberry32(5);
  let peor = 0;
  for (let k = 0; k < 6; k++) {
    const n = 30;
    const m = {
      sense: rng.pick(['max', 'min']),
      names: Array.from({ length: n }, (_, j) => 'x' + (j + 1)),
      c: Array.from({ length: n }, () => rng.int(-9, 9)),
      constraints: Array.from({ length: 3 }, (_, i) => ({
        name: 'R' + i, a: Array.from({ length: n }, () => rng.int(0, 9)), op: '<=', b: rng.int(20, 60),
      })),
    };
    const t0 = performance.now();
    const r = balas(m);
    peor = Math.max(peor, performance.now() - t0);
    assert.ok(['optimo', 'limite', 'infactible'].includes(r.status));
    if (r.best) assert.ok(evaluate(m, r.best.x).feasible);
  }
  console.log('peor tiempo n=30 (ms):', Math.round(peor));
  assert.ok(peor < 20000);
});

// ───────────── pasos.js: cada número escrito coincide con un cálculo independiente ─────────────
import { pasosBalas, pasosEnumeracion } from '../domain/pasos.js';
import { EJEMPLOS } from '../domain/ejemplos.js';
import { enumerate } from '../domain/enumerar.js';

const num = (t) => Number(String(t).replace('−', '-').replace(',', '.'));
const fmt = (x) => { let r = Math.round(x * 1e4) / 1e4; if (r === 0) r = 0; return String(r).replace('.', ',').replace('-', '−'); };

function holguras(m, comp, F1) {
  // y -> x original (independiente de aFormaBalas)
  const n = m.c.length;
  const x = Array(n).fill(0);
  for (let j = 0; j < n; j++) x[j] = F1.includes(j) ? (comp[j] ? 0 : 1) : (comp[j] ? 1 : 0);
  const s = [];
  for (const r of m.constraints) {
    let l = 0; for (let j = 0; j < n; j++) l += r.a[j] * x[j];
    if (r.op === '<=') s.push(r.b - l);
    else if (r.op === '>=') s.push(l - r.b);
    else { s.push(r.b - l); s.push(l - r.b); }
  }
  return { s, x };
}

test('auditoría pasosBalas: cada número del texto y del cálculo coincide con el cálculo real', () => {
  const rng = mulberry32(123);
  const modelos = EJEMPLOS.filter((e) => e.model.names.length <= 12).map((e) => e.model);
  for (let k = 0; k < 250; k++) modelos.push(modelo(rng, 7, -6, 9));
  let nodos = 0; const decs = {};
  for (const m of modelos) {
    const r = balas(m);
    const ps = pasosBalas(m);
    const comp = r.transform.comp;
    assert.equal(ps.length, r.trace.length + 2);
    r.trace.forEach((nd, k) => {
      nodos++; decs[nd.decision] = (decs[nd.decision] || 0) + 1;
      const p = ps[k + 1];
      const { s, x } = holguras(m, comp, nd.F1);
      assert.equal(s.length, nd.s.length);
      s.forEach((v, i) => {
        assert.ok(Math.abs(v - nd.s[i]) < 1e-9, `s${i} nodo ${nd.id}`);
        // el último «= valor» de la línea de cálculo
        const fin = p.calculo[i].split('= ').pop();
        assert.ok(Math.abs(num(fin) - v) < 1e-4, `calculo ${p.calculo[i]} vs ${v}`);
      });
      const I = s.reduce((t, v) => (v < -1e-9 ? t - v : t), 0);
      assert.ok(Math.abs(I - nd.I) < 1e-9);
      assert.ok(p.texto.includes(`Infactibilidad = ${fmt(I)}.`), p.texto);
      const zt = nd.F1.reduce((t, j) => t + r.transform.c[j], 0);
      assert.ok(p.texto.includes(`Z = ${fmt(zt)}.`), p.texto);
      if (nd.decision === 'ramifica') {
        // Ij independiente
        const mejor = Math.min(...nd.candidatas.map((j) => nd.Ij[j]));
        for (const j of nd.candidatas) {
          const { s: s2 } = holguras(m, comp, [...nd.F1, j]);
          const Ij = s2.reduce((t, v) => (v < -1e-9 ? t - v : t), 0);
          assert.ok(Math.abs(Ij - nd.Ij[j]) < 1e-9);
          assert.ok(p.texto.includes(`: ${fmt(Ij)}`));
        }
        assert.ok(Math.abs(nd.Ij[nd.branchVar] - mejor) < 1e-9);
        assert.equal(nd.branchVar, nd.candidatas.find((j) => Math.abs(nd.Ij[j] - mejor) < 1e-9), 'empate: menor índice');
      }
      if (nd.decision === 'factible') {
        assert.ok(evaluate(m, x).feasible);
        assert.ok(s.every((v) => v >= -1e-9));
      } else assert.ok(nd.decision === 'ramifica' ? s.some((v) => v < -1e-9) : true);
      if (nd.decision === 'poda-infactible') {
        // el nombre citado debe ser una restricción que ninguna completación de los libres satisface (usando todos los libres útiles)
        const nombre = p.texto.match(/la restricción (.*?) no se cumpliría/)[1];
        const idx = r.transform.origen.findIndex((o) => o === nombre);
        assert.ok(idx >= 0, 'nombre de restricción real: ' + nombre);
        let alcance = nd.s[idx];
        for (const j of nd.candidatas) alcance -= Math.min(0, r.transform.A[idx][j]);
        assert.ok(alcance < -1e-9, 'la restricción citada realmente no se puede cumplir');
      }
    });
    const concl = ps[ps.length - 1];
    if (r.best) {
      assert.deepEqual(concl.calculo[0], `x = (${r.best.x.join(', ')})`);
      assert.equal(concl.calculo[1], `Z = ${fmtNum1(r.best.z)}`);
      assert.ok(concl.texto.includes(`Z = ${fmt(r.best.z)}.`));
      assert.ok(concl.texto.includes(`Se visitaron ${r.trace.length} `));
      const ev = evaluate(m, r.best.x);
      assert.ok(Math.abs(ev.z - r.best.z) < 1e-9);
    } else assert.ok(/no tiene solución factible/.test(concl.texto));
  }
  console.log('nodos verificados:', nodos, JSON.stringify(decs));
  assert.ok(decs['poda-cota'] > 5 && decs['poda-infactible'] > 5 && decs.factible > 5);
});
const fmtNum1 = (x) => fmt(x);

test('auditoría pasosEnumeracion: números del texto', () => {
  const rng = mulberry32(321);
  const ms = EJEMPLOS.filter((e) => e.model.names.length <= 4).map((e) => e.model);
  for (let k = 0; k < 150; k++) { const m = modelo(rng, 4, -6, 9); ms.push(m); }
  for (const m of ms) {
    const ps = pasosEnumeracion(m);
    const e = enumerate(m, { keepRows: true });
    assert.equal(ps.length, 2 ** m.names.length + 2);
    e.rows.forEach((row, k) => {
      const ev = evaluate(m, row.x);
      assert.ok(ps[k + 1].texto.includes(`Z = ${fmt(ev.z)}.`));
      m.constraints.forEach((r, i) => assert.ok(ps[k + 1].calculo[i].includes(`= ${fmt(ev.lhs[i])} `)));
      assert.equal(ps[k + 1].texto.includes('No es factible'), !ev.feasible);
    });
    const c = ps[ps.length - 1];
    if (e.best) {
      assert.ok(c.texto.includes(`Hay ${e.feasibleCount} combinaciones factibles`));
      assert.ok(c.texto.includes(`Z = ${fmt(e.best.z)} `));
      assert.equal(c.calculo.length, e.best.solutions.length);
    }
  }
});
