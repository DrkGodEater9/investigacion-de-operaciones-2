import test from 'node:test';
import assert from 'node:assert/strict';
import { frac } from '../domain/fraction.js';
import { solveIP, canUseFloorPruning } from '../domain/branchAndBound.js';
import { solveLP } from '../domain/simplex.js';
import { planosDeCorte } from '../domain/cortes.js';
import { buildSteps } from '../domain/pasos.js';
import { pasosCortes, pasosRamificacion } from '../domain/pasosMixta.js';
import { EXAMPLES } from '../domain/examples.js';
import { ejemplosMixta } from '../domain/examplesMixta.js';
import { gen } from './utils/generadorAuditoria.mjs';

/**
 * Auditoría de los textos de «Paso a paso»: cada afirmación numérica se recalcula con el solucionador.
 */
const texto = (steps) => steps.map((s) => `${s.title ?? s.titulo}\n${s.explanation ?? s.queHago}\n${s.porQue ?? ''}\n${s.calculation ?? (s.calculo || []).join('\n')}`).join('\n----\n');

test('pasos pura: el incumbente solo mejora, la poda cita ⌊⌋/⌈⌉ según el sentido y cada cifra sale del árbol', () => {
  let revisados = 0;
  for (let it = 0; it < 400; it++) {
    const g = gen(900 + it, { n: 2 });
    const modelo = { ...g, integer: [true, true], c: g.c.map((v) => (typeof v === 'string' ? '3' : v)), options: {} };
    modelo.constraints = g.constraints.map((k) => ({ ...k, a: k.a.map((v) => (typeof v === 'string' ? 1 : v)), b: typeof k.b === 'string' ? 4 : k.b }));
    for (const options of [{}, { pruneWithFloor: false }, { childOrder: 'downFirst' }, { branchRule: 'lowestIndex', childOrder: 'upFirst' }]) {
      const m = { ...modelo, options };
      const r = solveIP(m);
      const steps = buildSteps(m, r);
      const usaPiso = canUseFloorPruning(m.c, [true, true], options.pruneWithFloor !== false);
      const isMax = m.sense === 'max';
      let inc = null;
      const porLabel = Object.fromEntries((r.nodes || []).map((n) => [n.label, n]));
      for (const st of steps) {
        revisados++;
        const sInc = st.state.incumbent;
        if (sInc) {
          if (inc) assert.ok(isMax ? sInc.z.gte(inc) : sInc.z.lte(inc), `incumbente empeora: ${st.title}`);
          inc = sInc.z;
        }
        if (st.phase === 'node_incumbent') {
          const nd = porLabel[/Resolver (P\d+)/.exec(st.title)[1]];
          assert.equal(nd.action, 'incumbent', `${st.title}: no era un nuevo incumbente`);
        }
        if (st.phase === 'node_pruned' && /^Podar/.test(st.title)) {
          const nd = porLabel[/Podar (P\d+)/.exec(st.title)[1]];
          const incZ = st.state.incumbent.z;
          if (usaPiso) {
            const mm = /(⌊|⌈).*?(⌋|⌉) = (-?\d+) (≤|≥) (-?\d+)$/.exec(st.title);
            assert.ok(mm, `título de poda sin cota entera: ${st.title}`);
            assert.equal(mm[1], isMax ? '⌊' : '⌈');
            assert.equal(mm[4], isMax ? '≤' : '≥');
            assert.equal(BigInt(mm[3]), isMax ? nd.z.floor() : nd.z.ceil());
            assert.equal(BigInt(mm[5]), isMax ? incZ.floor() : incZ.ceil());
            assert.ok(isMax ? nd.z.floor() <= incZ.floor() : nd.z.ceil() >= incZ.ceil());
          } else {
            assert.ok(!/[⌊⌈]/.test(st.title), `sin piso no debe citar ⌊⌋: ${st.title}`);
            assert.ok(isMax ? nd.z.lte(incZ) : nd.z.gte(incZ), st.title);
          }
        }
      }
      const ult = steps[steps.length - 1];
      assert.equal(ult.phase, 'conclusion');
      if (r.status === 'optimal') assert.ok(ult.state.incumbent.z.eq(r.best.z));
      if (r.status === 'infeasible') assert.ok(/infactible/i.test(ult.title), ult.title);
    }
  }
  assert.ok(revisados > 2000);
});

test('pasos pura: ejemplos del tema (minimización: un entero peor no se presenta como incumbente)', () => {
  const e = EXAMPLES.find((x) => x.id === 'minimizacion');
  const r = solveIP(e);
  const t = texto(buildSteps(e, r));
  assert.ok(!/nuevo incumbente Z\* = 15/.test(t));
  assert.ok(!/nuevo incumbente Z\* = 14/.test(t));
  assert.ok(/entera, no mejora Z\* = 13/.test(t));
  const inf = EXAMPLES.find((x) => x.id === 'infactible');
  const ti = texto(buildSteps(inf, solveIP(inf)));
  assert.ok(!/Región factible vacía/.test(ti), 'la relajación de 2x1 = 3 sí tiene región factible');
  assert.ok(/relajación lineal tiene solución/.test(ti));
});

test('pasos pura: no acotado, límite de nodos y regla de menor índice', () => {
  const noAc = { sense: 'max', c: ['1', '1'], constraints: [{ a: ['1', '-1'], op: '<=', b: '2' }], integer: [true, true] };
  const s1 = buildSteps(noAc, solveIP(noAc));
  assert.ok(/no acotado/i.test(s1[1].title));
  const lim = { sense: 'max', c: ['3', '5'], constraints: [{ a: ['6', '10'], op: '=', b: '1000001' }], integer: [true, true], options: { maxNodes: 20 } };
  const rl = solveIP(lim);
  assert.equal(rl.status, 'nodeLimit');
  const sl = buildSteps(lim, rl);
  assert.ok(/límite de nodos/i.test(sl[sl.length - 1].title), sl[sl.length - 1].title);
  assert.ok(!/finaliza con éxito/.test(sl[sl.length - 1].explanation));
  // x = (7/2, 5/2): ambas con parte 1/2; con menor índice no se compara, con la regla estándar se informa el empate
  const emp = { sense: 'max', c: ['1', '1'], constraints: [{ a: ['2', '0'], op: '<=', b: '7' }, { a: ['0', '2'], op: '<=', b: '5' }], integer: [true, true] };
  const t1 = buildSteps({ ...emp, options: {} }, solveIP(emp))[2].calculation;
  assert.ok(/empate/.test(t1), t1);
  const t2 = buildSteps({ ...emp, options: { branchRule: 'lowestIndex' } }, solveIP({ ...emp, options: { branchRule: 'lowestIndex' } }))[2].calculation;
  assert.ok(/menor índice/.test(t2) && !/>/.test(t2), t2);
  // regla estándar con partes distintas: la comparación citada es verdadera
  const dis = { sense: 'max', c: ['1', '1'], constraints: [{ a: ['4', '0'], op: '<=', b: '15' }, { a: ['0', '4'], op: '<=', b: '5' }], integer: [true, true] };
  const t3 = buildSteps(dis, solveIP(dis))[2].calculation;
  assert.ok(/\{x1\} \(0,75\) > \{x2\} \(0,25\)/.test(t3), t3);
});

test('pasos mixta: estados sin solución no se confunden (infactible entero ≠ relajación infactible)', () => {
  const m = { sense: 'max', c: [1, 0], constraints: [{ a: [2, 0], op: '=', b: 3 }], integer: [true, true] };
  const pc = pasosCortes(m);
  const tc = texto(pc);
  assert.ok(!/Sin solución para la relajación/.test(tc));
  assert.ok(/infactible/.test(pc[pc.length - 1].queHago));
  const pr = pasosRamificacion(m);
  assert.ok(!/La relajación es infactible/.test(texto(pr)));
  assert.ok(/No existe ninguna solución admisible/.test(pr[pr.length - 1].queHago));
  const real = { sense: 'max', c: [1, 1], constraints: [{ a: [1, 1], op: '<=', b: -1 }], integer: [true, false] };
  assert.ok(/La relajación es infactible/.test(pasosRamificacion(real)[1].queHago));
  assert.ok(/infactible/.test(pasosCortes(real)[0].calculo[0]));
});

test('pasos mixta: minimización (Z sube, cota con ⌈⌉) y poda con piso explicada con cifras ciertas', () => {
  const mm = { sense: 'min', c: [4, 3], constraints: [{ a: [2, 1], op: '>=', b: 5 }, { a: [1, 3], op: '>=', b: 6 }], integer: [false, true] };
  const t = texto(pasosCortes(mm, { conContinuacionPura: true }));
  assert.ok(!/Z bajó/.test(t) && !/Z baja/.test(t));
  assert.ok(/no puede bajar/.test(t) || /no baja/.test(t));
  assert.ok(/Si x1 también fuera entera/.test(texto(pasosCortes(ejemplosMixta[0], { conContinuacionPura: true }))));
  // x2 continua: el título de la continuación nombra la variable continua real
  const m2 = { sense: 'max', c: [9, 7], constraints: [{ a: [3, -1], op: '<=', b: 6 }, { a: [1, 7], op: '<=', b: 35 }], integer: [true, false] };
  const c2 = pasosCortes(m2, { conContinuacionPura: true });
  assert.ok(!c2.some((p) => /Si x1 también/.test(p.titulo)));
  // poda por cota con piso: la relajación del nodo (23,33) SÍ supera 23, y el texto lo explica con ⌊Z⌋
  const pura = { sense: 'max', c: [5, 4], constraints: [{ a: [1, 1], op: '<=', b: 5 }, { a: [10, 6], op: '<=', b: 45 }], integer: [true, true] };
  const pr = pasosRamificacion(pura);
  const poda = pr.find((p) => /podada por cota/.test(p.titulo));
  assert.ok(/⌊Z⌋ = 23/.test(poda.queHago), poda.queHago);
  // mixta con c sobre variable continua: no se usa el piso
  const mx = { sense: 'max', c: [7, 9], constraints: [{ a: [-1, 3], op: '<=', b: 6 }, { a: [7, 1], op: '<=', b: 35 }], integer: [false, true] };
  assert.ok(!pasosRamificacion(mx).some((p) => /⌊Z⌋/.test(p.queHago)));
});

test('pasos mixta: todo ejemplo y modelos aleatorios generan pasos sin excepción y con números del solucionador', () => {
  for (const e of ejemplosMixta) {
    const m = { sense: e.sense, c: e.c, constraints: e.constraints, integer: e.integer, options: e.options };
    for (const ps of [pasosCortes(m, { conContinuacionPura: true }), pasosRamificacion(m)]) {
      assert.ok(ps.length >= 3);
      ps.forEach((p, i) => { assert.equal(p.id, i + 1); assert.ok(p.titulo.startsWith(`${i + 1}. `)); });
    }
    const r = solveIP({ ...m, integer: m.integer });
    const ult = pasosRamificacion(m).at(-1);
    if (r.status === 'optimal') assert.ok(ult.calculo.join(' ').includes(`Z = ${r.best.z.toString()}`), `${e.id}: ${ult.calculo}`);
  }
  for (let it = 0; it < 150; it++) {
    const g = gen(7000 + it, { n: 2 });
    const m = { sense: g.sense, c: g.c, constraints: g.constraints, integer: g.integer };
    const lp = solveLP(m);
    if (lp.status === 'unbounded') continue;
    assert.doesNotThrow(() => pasosRamificacion(m), `ramificación ${it}`);
    assert.doesNotThrow(() => pasosCortes(m), `cortes ${it}`);
    const pc = planosDeCorte(m, { maxCortes: 25 });
    if (pc.estado === 'optimo') {
      const ps = pasosCortes(m);
      assert.ok(ps.at(-1).calculo.join(' ').includes(`Z = ${pc.z.toString()}`), `cortes ${it}`);
    }
  }
});
