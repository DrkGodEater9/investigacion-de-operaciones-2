import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analizar, analisisSinInformacion, informacionPerfecta, analisisMuestral, criteriosSinProbabilidades,
  validarProblema, optimos, verosimilitudPorFiabilidad,
} from '../domain/bayes.js';
import { fmtNum, fmtPct, fmtFactor, crudo, listaTexto } from '../domain/formato.js';
import { EJEMPLOS, ejemploPorId } from '../domain/ejemplos.js';
import { mulberry32, problemaAleatorio, referencia, aNum, cerca } from './utils.mjs';

const P = (id) => ejemploPorId(id).problema;
const casi = (a, b, msg, tol = 1e-9) => assert.ok(cerca(a, b, tol), `${msg || ''} ${a} vs ${b}`);

/* ------------------------------------------------------------------ Ejemplos a mano */

test('B1 (utilidades): números calculados a mano', () => {
  const p = P('B1');
  const a = analizar(p);
  assert.deepEqual(a.sinInfo.ve.map((x) => Math.round(x * 1e9) / 1e9), [80, 60]);
  assert.deepEqual(a.sinInfo.optimas, [0]);
  casi(a.perfecta.vecip, 192);
  casi(a.perfecta.veip, 112);
  const m = a.muestral;
  casi(m.conjunta[0][0], 0.24); casi(m.conjunta[0][1], 0.06); casi(m.conjunta[1][0], 0.21); casi(m.conjunta[1][1], 0.49);
  casi(m.marginal[0], 0.45); casi(m.marginal[1], 0.55);
  casi(m.posterior[0][0], 0.24 / 0.45); casi(m.posterior[1][0], 0.21 / 0.45);
  casi(m.posterior[0][1], 0.06 / 0.55); casi(m.posterior[1][1], 0.49 / 0.55);
  casi(m.porIndicador[0].valor, 220); assert.deepEqual(m.porIndicador[0].optimas, [0]);
  casi(m.porIndicador[1].valor, 60); assert.deepEqual(m.porIndicador[1].optimas, [1]);
  casi(m.vecim, 132); casi(m.veim, 52); casi(m.eficiencia, 52 / 112);
});

test('B2 (costos, se minimiza): números calculados a mano', () => {
  const p = P('B2');
  const a = analizar(p);
  [86, 62, 100].forEach((v, i) => casi(a.sinInfo.ve[i], v));
  assert.deepEqual(a.sinInfo.optimas, [1]);
  casi(a.perfecta.vecip, 38); // 0,6·10 + 0,4·80
  casi(a.perfecta.veip, 24); // 62 − 38
  const m = a.muestral;
  casi(m.marginal[0], 0.59); casi(m.marginal[1], 0.41);
  casi(m.posterior[0][0], 0.51 / 0.59);
  assert.deepEqual(m.porIndicador[0].optimas, [0]); // Normal → esperar
  assert.deepEqual(m.porIndicador[1].optimas, [1]); // Alta → reparar
  casi(m.porIndicador[0].valor, (0.51 * 10 + 0.08 * 200) / 0.59);
  casi(m.vecim, 51.2); // 21,1 (Normal: esperar) + 30,1 (Alta: reparar), exacto a mano
  assert.ok(m.veim > 0 && m.veim < a.perfecta.veip);
});

test('B4 sin información muestral: no hay análisis muestral', () => {
  const a = analizar(P('B4'));
  assert.equal(a.muestral, null);
  casi(a.sinInfo.valor, 820);
  casi(a.perfecta.veip, 120); // 820 − 700
});

test('criterios sin probabilidades en B1 (a mano)', () => {
  const c = criteriosSinProbabilidades(P('B1'));
  assert.deepEqual(c.peor, [-100, 60]);
  assert.deepEqual(c.pesimista.indices, [1]); // maximin: Vender
  assert.deepEqual(c.optimista.indices, [0]); // maximax: Perforar
  assert.deepEqual(c.promedio, [200, 60]);
  assert.deepEqual(c.laplace.indices, [0]);
  assert.deepEqual(c.arrepentimiento, [[0, 160], [440, 0]]);
  assert.deepEqual(c.arrepMax, [160, 440]);
  assert.deepEqual(c.savage.indices, [0]);
  assert.deepEqual(c.verosimilitud.estados, [1]); // el estado más probable es «Seco»
  assert.deepEqual(c.verosimilitud.indices, [1]); // allí lo mejor es vender
});

test('criterios en costos (B2): pesimista = minimax, optimista = minimin', () => {
  const c = criteriosSinProbabilidades(P('B2'));
  assert.deepEqual(c.peor, [200, 80, 100]);
  assert.deepEqual(c.pesimista.indices, [1]);
  assert.deepEqual(c.mejor, [10, 50, 100]);
  assert.deepEqual(c.optimista.indices, [0]);
  // arrepentimiento: mejor por estado = [10, 80]; Esperar: [0,120]; Reparar: [40,0]; Reemplazar: [90,20]
  assert.deepEqual(c.arrepMax, [120, 40, 90]);
  assert.deepEqual(c.savage.indices, [1]);
});

/* ------------------------------------------------------------------ Contra referencia exacta */

test('400 problemas aleatorios (max y min) contra la referencia con fracciones y enumeración de reglas', () => {
  const rng = mulberry32(2024);
  for (let t = 0; t < 400; t++) {
    const { p, exacto } = problemaAleatorio(rng, { conInfo: true });
    const v = validarProblema(p);
    assert.deepEqual(v.errores, [], `caso ${t}: ${v.errores}`);
    const a = analizar(p);
    const r = referencia(p, exacto);
    a.sinInfo.ve.forEach((x, i) => casi(x, aNum(r.ve[i]), `VE ${t}`));
    casi(a.sinInfo.valor, aNum(r.vesi), `VEsi ${t}`);
    assert.deepEqual(a.sinInfo.optimas, r.optimas, `óptimas ${t}`);
    casi(a.perfecta.vecip, aNum(r.vecip), `VEcIP ${t}`);
    casi(a.perfecta.veip, aNum(r.veip), `VEIP ${t}`);
    const m = a.muestral;
    p.estados.forEach((_, j) => p.indicadores.forEach((__, k) => {
      casi(m.conjunta[j][k], aNum(r.conj[j][k]), `conjunta ${t}`);
      if (r.post[j][k] === null) assert.equal(m.posterior[j][k], null);
      else casi(m.posterior[j][k], aNum(r.post[j][k]), `posterior ${t}`);
    }));
    m.marginal.forEach((x, k) => casi(x, aNum(r.marg[k]), `marginal ${t}`));
    casi(m.vecim, aNum(r.vecim), `VEcIM ${t} (${p.objetivo})`);
    casi(m.veim, aNum(r.veim), `VEIM ${t}`);
    if (r.eficiencia === null) assert.equal(m.eficiencia, null);
    else casi(m.eficiencia, aNum(r.eficiencia), `eficiencia ${t}`);
  }
});

test('propiedades: probabilidades suman 1, 0 ≤ VEIM ≤ VEIP, VEcIM entre VE sin info y VEcIP', () => {
  const rng = mulberry32(77);
  for (let t = 0; t < 400; t++) {
    const { p } = problemaAleatorio(rng, { conInfo: true });
    const a = analizar(p);
    const m = a.muestral;
    casi(m.marginal.reduce((s, x) => s + x, 0), 1, 'marginales');
    m.marginal.forEach((x, k) => {
      if (x > 1e-12) casi(p.estados.reduce((s, _, j) => s + m.posterior[j][k], 0), 1, 'posteriores');
    });
    // La probabilidad a priori es el promedio de las posteriores ponderado por las marginales.
    p.estados.forEach((_, j) => {
      const s = m.marginal.reduce((acc, x, k) => acc + (m.posterior[j][k] === null ? 0 : x * m.posterior[j][k]), 0);
      casi(s, p.priori[j], 'consistencia');
    });
    assert.ok(m.veim >= -1e-9, 'VEIM ≥ 0');
    assert.ok(m.veim <= a.perfecta.veip + 1e-9, 'VEIM ≤ VEIP');
    assert.ok(a.perfecta.veip >= 0);
    if (a.perfecta.veip > 1e-9) assert.ok(m.eficiencia >= -1e-9 && m.eficiencia <= 1 + 1e-9);
    // En utilidades: sin info ≤ con muestra ≤ perfecta; en costos al revés.
    if (p.objetivo === 'max') assert.ok(a.sinInfo.valor <= m.vecim + 1e-9 && m.vecim <= a.perfecta.vecip + 1e-9);
    else assert.ok(a.sinInfo.valor >= m.vecim - 1e-9 && m.vecim >= a.perfecta.vecip - 1e-9);
  }
});

test('indicador que no informa (verosimilitud igual en todos los estados): VEIM = 0 y posterior = a priori', () => {
  const p = {
    objetivo: 'max', alternativas: ['A', 'B'], estados: ['E1', 'E2'], pagos: [[10, -5], [3, 3]], priori: [0.4, 0.6],
    indicadores: ['Z1', 'Z2'], verosimilitud: [[0.7, 0.3], [0.7, 0.3]],
  };
  const m = analizar(p).muestral;
  casi(m.veim, 0);
  casi(m.posterior[0][0], 0.4); casi(m.posterior[0][1], 0.4);
  casi(m.eficiencia, 0);
});

test('indicador perfecto (diagonal): VEIM = VEIP y eficiencia 100 %', () => {
  const rng = mulberry32(5);
  for (let t = 0; t < 100; t++) {
    const { p } = problemaAleatorio(rng, { conInfo: false });
    const n = p.estados.length;
    p.indicadores = p.estados.map((_, k) => 'Z' + (k + 1));
    p.verosimilitud = p.estados.map((_, j) => p.estados.map((__, k) => (j === k ? 1 : 0)));
    const a = analizar(p);
    casi(a.muestral.veim, a.perfecta.veip, 'VEIM = VEIP');
    if (a.perfecta.veip > 1e-9) casi(a.muestral.eficiencia, 1);
    assert.equal(n, a.muestral.K);
  }
});

/* ------------------------------------------------------------------ Casos límite */

test('empates: las dos alternativas iguales salen como óptimas y no se rompe nada', () => {
  const p = { objetivo: 'max', alternativas: ['A', 'B', 'C'], estados: ['E1', 'E2'], pagos: [[10, 20], [10, 20], [0, 5]], priori: [0.5, 0.5] };
  const a = analizar(p);
  assert.deepEqual(a.sinInfo.optimas, [0, 1]);
  casi(a.perfecta.veip, 0);
  assert.equal(a.muestral, null);
  const c = criteriosSinProbabilidades(p);
  assert.deepEqual(c.laplace.indices, [0, 1]);
});

test('empate de estados más probables en máxima verosimilitud se marca', () => {
  const c = criteriosSinProbabilidades({ objetivo: 'max', alternativas: ['A', 'B'], estados: ['E1', 'E2'], pagos: [[1, 2], [2, 1]], priori: [0.5, 0.5] });
  assert.equal(c.verosimilitud.empate, true);
  assert.deepEqual(c.verosimilitud.estados, [0, 1]);
});

test('probabilidad a priori cero y resultado imposible: sin NaN y el VEcIM ignora el resultado imposible', () => {
  const rng = mulberry32(31);
  let vistos = 0;
  for (let t = 0; t < 300; t++) {
    const { p, exacto } = problemaAleatorio(rng, { conInfo: true, ceros: true });
    const a = analizar(p);
    const r = referencia(p, exacto);
    const json = JSON.stringify(a);
    assert.ok(!/NaN|Infinity/.test(json), 'sin NaN/Infinity');
    casi(a.muestral.vecim, aNum(r.vecim));
    a.muestral.porIndicador.forEach((d, k) => {
      if (!d.posible) {
        vistos += 1;
        assert.equal(d.valor, null);
        assert.deepEqual(d.optimas, []);
        p.estados.forEach((_, j) => assert.equal(a.muestral.posterior[j][k], null));
      }
    });
  }
  assert.ok(vistos > 50, 'el generador produjo resultados imposibles: ' + vistos);
});

test('a priori cero: la posterior de ese estado es 0 y la alternativa solo útil en él no se elige', () => {
  const p = {
    objetivo: 'max', alternativas: ['A', 'B'], estados: ['E1', 'E2', 'E3'],
    pagos: [[100, 0, 0], [10, 10, 10]], priori: [0, 0.5, 0.5],
    indicadores: ['Z1', 'Z2'], verosimilitud: [[0.5, 0.5], [0.4, 0.6], [0.3, 0.7]],
  };
  const a = analizar(p);
  casi(a.muestral.posterior[0][0], 0);
  assert.deepEqual(a.sinInfo.optimas, [1]);
  casi(a.perfecta.veip, 0); // con P(E1)=0 la información perfecta no aporta
});

test('tolerancia numérica: valores que difieren en ~1e-15 cuentan como empate', () => {
  const o = optimos('max', [0.1 + 0.2, 0.3, 0.29]);
  assert.deepEqual(o.indices, [0, 1]);
  const o2 = optimos('min', [1 / 3 + 1 / 3 + 1 / 3, 1, 1.5]);
  assert.deepEqual(o2.indices, [0, 1]);
});

/* ------------------------------------------------------------------ Validación */

const base = () => JSON.parse(JSON.stringify(P('B1')));

test('validarProblema acepta los ejemplos y no los modifica', () => {
  EJEMPLOS.forEach((e) => {
    const v = validarProblema(e.problema);
    assert.deepEqual(v.errores, [], e.id);
    assert.deepEqual(v.avisos, [], e.id);
    assert.deepEqual(v.problema, e.problema, e.id);
  });
});

test('validarProblema: errores con mensajes claros', () => {
  const casos = [
    [(p) => { p.priori = [0.5, 0.4]; }, /suman 0,9 y deben sumar 1/],
    [(p) => { p.priori = [1.2, -0.2]; }, /entre 0 y 1/],
    [(p) => { p.priori = [0.5]; }, /debe tener 2 valores/],
    [(p) => { p.alternativas = ['A', 'A']; }, /«A» está repetido/],
    [(p) => { p.estados = ['', 'Seco']; }, /no tiene nombre/],
    [(p) => { p.pagos[0][1] = NaN; }, /no es un número/],
    [(p) => { p.pagos = [[1, 2]]; }, /debe tener 2 filas/],
    [(p) => { p.alternativas = ['A']; p.pagos = [[1, 2]]; }, /al menos 2 alternativas/],
    [(p) => { p.objetivo = 'otro'; }, /maximizar|minimizar/],
    [(p) => { p.verosimilitud[0] = [0.5, 0.2]; }, /Verosimilitud del estado «Petróleo».*suman 0,7/],
    [(p) => { p.verosimilitud = [[1, 0]]; }, /verosimilitudes debe tener 2 filas/],
    [(p) => { p.indicadores = ['solo uno']; p.verosimilitud = [[1], [1]]; }, /al menos 2 resultados/],
  ];
  for (const [mut, re] of casos) {
    const p = base();
    mut(p);
    const v = validarProblema(p);
    assert.equal(v.problema, null);
    assert.ok(v.errores.some((e) => re.test(e)), `se esperaba ${re}, llegó ${JSON.stringify(v.errores)}`);
  }
});

test('validarProblema: sumas que fallan por redondeo (0,333·3) se normalizan con aviso; las grandes son error', () => {
  const p = { objetivo: 'max', alternativas: ['A', 'B'], estados: ['E1', 'E2', 'E3'], pagos: [[1, 2, 3], [3, 2, 1]], priori: [0.333, 0.333, 0.333] };
  const v = validarProblema(p);
  assert.deepEqual(v.errores, []);
  assert.equal(v.avisos.length, 1);
  assert.match(v.avisos[0], /sumaban 0,999/);
  casi(v.problema.priori.reduce((s, x) => s + x, 0), 1);
  const w = validarProblema({ ...p, priori: [0.3, 0.3, 0.3] });
  assert.ok(w.errores.length === 1 && /suman 0,9 y deben sumar 1/.test(w.errores[0]));
});

/* ------------------------------------------------------------------ Otros */

test('verosimilitudPorFiabilidad: filas que suman 1', () => {
  [[2, 2, 0.8], [3, 3, 0.6], [3, 2, 0.9], [2, 3, 0.7]].forEach(([n, K, r]) => {
    const L = verosimilitudPorFiabilidad(n, K, r);
    L.forEach((f) => casi(f.reduce((s, x) => s + x, 0), 1));
    casi(L[0][0], r);
  });
});

test('analisisSinInformacion e informacionPerfecta coinciden con analizar', () => {
  const p = P('B3');
  const a = analizar(p);
  assert.deepEqual(analisisSinInformacion(p), a.sinInfo);
  assert.deepEqual(informacionPerfecta(p), a.perfecta);
  assert.deepEqual(analisisMuestral(p), a.muestral);
});

test('formato: coma decimal, menos tipográfico, sin -0', () => {
  assert.equal(fmtNum(1 / 3), '0,3333');
  assert.equal(fmtNum(-0), '0');
  assert.equal(fmtNum(-0.00001), '0');
  assert.equal(fmtNum(1234.5), '1234,5');
  assert.equal(fmtNum(-100), '−100');
  assert.equal(fmtNum(80), '80');
  assert.equal(fmtNum(null), '—');
  assert.equal(fmtFactor(-100), '(−100)');
  assert.equal(fmtFactor(0.5), '0,5');
  assert.equal(fmtPct(52 / 112), '46,4 %');
  assert.equal(fmtPct(0), '0 %');
  assert.equal(crudo(1 / 3), '0.333333');
  assert.equal(crudo(-0), '0');
  assert.equal(listaTexto(['a', 'b', 'c']), 'a, b y c');
  assert.equal(listaTexto([]), 'ninguna');
});
