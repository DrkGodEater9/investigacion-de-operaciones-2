/**
 * Auditoría adversarial del tema 2.1: casos de libro resueltos a mano, entrada rara, criterios en costos,
 * miles de semillas del generador contra una referencia con fracciones (utils.mjs) y distractores.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { analizar, validarProblema } from '../domain/bayes.js';
import { parseMarkdown } from '../domain/entrada.js';
import { generarEjercicio, corregir, TIPOS } from '../domain/generador.js';
import { tablaResumen } from '../domain/tablas.js';
import { fmtNum, crudo } from '../domain/formato.js';
import { referencia, aNum, cerca } from './utils.mjs';

/* Hillier y Lieberman, Goferbroke Company (cifras en miles de dólares; a priori 0,25 / 0,75):
 * perforar 700 / −100, vender 90 / 90. Estudio sísmico: P(FSS | petróleo) = 0,6; P(FSS | seco) = 0,2.
 * A mano: VE(perforar) = 0,25·700 − 0,75·100 = 100; VEcIP = 0,25·700 + 0,75·90 = 242,5; VEIP = 142,5.
 * P(FSS) = 0,15 + 0,15 = 0,30; P(petróleo | FSS) = 0,5; VE(perforar | FSS) = 350 − 50 = 300 > 90.
 * P(USS) = 0,70; P(petróleo | USS) = 0,10/0,70 = 1/7; VE(perforar | USS) = 100 − 600/7·... = 14,2857 < 90 → vender.
 * VEcIM = 0,3·300 + 0,7·90 = 153; VEIM = 53; eficiencia = 53/142,5. */
const GOFER = {
  objetivo: 'max',
  alternativas: ['Perforar', 'Vender'],
  estados: ['Petróleo', 'Seco'],
  pagos: [[700, -100], [90, 90]],
  priori: [0.25, 0.75],
  indicadores: ['FSS', 'USS'],
  verosimilitud: [[0.6, 0.4], [0.2, 0.8]],
};

test('Goferbroke (Hillier-Lieberman): VEIP 142,5, VEcIM 153, VEIM 53', () => {
  const a = analizar(GOFER);
  assert.ok(cerca(a.sinInfo.valor, 100));
  assert.ok(cerca(a.perfecta.vecip, 242.5));
  assert.ok(cerca(a.perfecta.veip, 142.5));
  assert.ok(cerca(a.muestral.marginal[0], 0.3));
  assert.ok(cerca(a.muestral.posterior[0][0], 0.5));
  assert.ok(cerca(a.muestral.posterior[0][1], 1 / 7));
  assert.deepEqual(a.muestral.porIndicador.map((d) => d.optimas), [[0], [1]]);
  assert.ok(cerca(a.muestral.porIndicador[0].valor, 300));
  assert.ok(cerca(a.muestral.vecim, 153));
  assert.ok(cerca(a.muestral.veim, 53));
  assert.ok(cerca(a.muestral.eficiencia, 53 / 142.5));
});

test('costos a mano: criterios sin probabilidades con el sentido invertido', () => {
  // costos: A = [4, 9, 2], B = [6, 6, 6], C = [1, 12, 3]
  const p = {
    objetivo: 'min', alternativas: ['A', 'B', 'C'], estados: ['x', 'y', 'z'],
    pagos: [[4, 9, 2], [6, 6, 6], [1, 12, 3]], priori: [0.2, 0.5, 0.3],
  };
  const c = analizar(p).criterios;
  assert.deepEqual(c.peor, [9, 6, 12]);       // el peor costo es el mayor
  assert.deepEqual(c.pesimista.indices, [1]); // minimax → B
  assert.deepEqual(c.mejor, [2, 6, 1]);
  assert.deepEqual(c.optimista.indices, [2]); // minimin → C
  assert.ok(cerca(c.promedio[0], 5) && cerca(c.promedio[1], 6) && cerca(c.promedio[2], 16 / 3));
  assert.deepEqual(c.laplace.indices, [0]);
  // mejor por estado: 1, 6, 2 → arrepentimientos A: 3,3,0; B: 5,0,4; C: 0,6,1
  assert.deepEqual(c.arrepentimiento, [[3, 3, 0], [5, 0, 4], [0, 6, 1]]);
  assert.deepEqual(c.arrepMax, [3, 5, 6]);
  assert.deepEqual(c.savage.indices, [0]);
  // Bayes: VE = A 0,8+4,5+0,6 = 5,9; B 6; C 0,2+6+0,9 = 7,1
  assert.deepEqual(c.bayes.indices, [0]);
});

test('utilidades a mano: el arrepentimiento de Savage no depende del signo de los pagos', () => {
  const p = { objetivo: 'max', alternativas: ['A', 'B'], estados: ['x', 'y'], pagos: [[-5, 10], [-8, 14]], priori: [0.5, 0.5] };
  const c = analizar(p).criterios;
  assert.deepEqual(c.arrepentimiento, [[0, 4], [3, 0]]);
  assert.deepEqual(c.savage.indices, [1]); // 3 < 4
  assert.deepEqual(c.pesimista.indices, [0]); // −5 > −8
  assert.deepEqual(c.optimista.indices, [1]);
});

test('máxima verosimilitud usa el estado más probable a priori y la mejor alternativa en él', () => {
  const p = { objetivo: 'min', alternativas: ['A', 'B'], estados: ['x', 'y'], pagos: [[3, 9], [5, 1]], priori: [0.4, 0.6] };
  const v = analizar(p).criterios.verosimilitud;
  assert.deepEqual(v.estados, [1]);
  assert.deepEqual(v.indices, [1]);
  assert.equal(v.valor, 1);
});

test('VEIM es ganancia (no valor total) en max y min, y coincide en todos los textos del dominio', async () => {
  const { pasosBayes } = await import('../domain/pasos.js');
  const { EJEMPLOS } = await import('../domain/ejemplos.js');
  for (const e of EJEMPLOS) {
    const a = analizar(e.problema);
    if (!a.muestral) continue;
    const ref = e.problema.objetivo === 'max' ? a.muestral.vecim - a.sinInfo.valor : a.sinInfo.valor - a.muestral.vecim;
    assert.ok(cerca(a.muestral.veim, ref));
    const txt = pasosBayes(e.problema).map((s) => s.calculo.join('\n')).join('\n');
    assert.ok(txt.includes(`VEIM = ${e.problema.objetivo === 'max' ? 'VEcIM − VE sin información' : 'VE sin información − VEcIM'}`));
    assert.ok(txt.includes(`= ${fmtNum(a.muestral.veim)}`));
  }
});

test('entrada: «Probar sensor» no es la fila de probabilidades; «Probabilidad a priori» sí', () => {
  const base = (nombre, etiqueta) => `| Alternativa | A | B |\n|---|---|---|\n| ${nombre} | 1 | 2 |\n| Otra | 3 | 1 |\n| ${etiqueta} | 0,5 | 0,5 |`;
  const r = parseMarkdown(base('Probar sensor', 'Prob. a priori'));
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.problema.alternativas, ['Probar sensor', 'Otra']);
  for (const et of ['Probabilidad a priori', 'Probabilidades a priori', 'Prob', 'prob. a priori', 'PROB.']) {
    const q = parseMarkdown(base('Uno', et));
    assert.deepEqual(q.errores, [], et);
    assert.deepEqual(q.problema.priori, [0.5, 0.5]);
  }
});

test('entrada: guion largo o medio como signo menos; casos raros no lanzan excepciones', () => {
  const r = parseMarkdown('| Alternativa | A | B |\n|---|---|---|\n| X | –100 | 2 |\n| Y | 3 | −1 |\n| Prob. a priori | 0,5 | 0,5 |');
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.problema.pagos, [[-100, 2], [3, -1]]);
  for (const t of ['', '|', '||', '| a |', '| a | b |\n| c |', 'Objetivo: ???', '| A | B | C |\n|---|---|---|\n| x | y | z |', '|\n|\n|\n|']) {
    assert.doesNotThrow(() => parseMarkdown(t), JSON.stringify(t));
    const x = parseMarkdown(t);
    assert.ok(x.problema === null || x.errores.length === 0);
  }
});

test('probabilidad 0 en el resultado: sin NaN en todo el análisis y en los textos', async () => {
  const { pasosBayes } = await import('../domain/pasos.js');
  const { tablasResultado, lineasResultado } = await import('../domain/tablas.js');
  const v = validarProblema({
    objetivo: 'min', alternativas: ['a', 'b'], estados: ['e1', 'e2'], pagos: [[1, 5], [3, 3]], priori: [0.5, 0.5],
    indicadores: ['z1', 'z2', 'z3'], verosimilitud: [[0.5, 0.5, 0], [0.5, 0.5, 0]],
  });
  const a = analizar(v.problema);
  const todo = JSON.stringify([pasosBayes(v.problema, a), tablasResultado(v.problema, a), lineasResultado(v.problema, a)]);
  assert.ok(!/NaN|undefined|Infinity/.test(todo));
});

test('resumen: la eficiencia lleva coma en pantalla y punto decimal con el formato crudo (CSV)', () => {
  const a = analizar(GOFER);
  assert.equal(tablaResumen(GOFER, a).rows.at(-1)[1], '37,2 %');
  assert.equal(tablaResumen(GOFER, a, crudo).rows.at(-1)[1], '37.192982 %');
});

/* ---------------------------------------------------------------- Generador a gran escala */

const D = 20;
const enteros = (x) => { const r = Math.round(x * D); assert.ok(Math.abs(r - x * D) < 1e-9, `${x} no es múltiplo de 0,05`); return r; };
const exactoDe = (p) => ({
  D, pagos: p.pagos, prioriN: p.priori.map(enteros), likN: p.verosimilitud ? p.verosimilitud.map((f) => f.map(enteros)) : p.estados.map(() => [D]),
});
const cruda = (s) => String(s).replace('.', ',');

test('3000 semillas × 9 tipos: solución independiente (fracciones), unicidad con margen, distractores rechazados', () => {
  let numericos = 0;
  for (let seed = 1; seed <= 3000; seed++) {
    for (const tipo of TIPOS) {
      const ej = generarEjercicio(tipo, seed);
      const p = ej.problema;
      const ref = referencia(p, exactoDe(p));
      const max = p.objetivo === 'max';
      const d = ej.datos;
      // enunciado coherente con el modelo
      assert.ok(max ? !/costos/.test(ej.unidad) : /costos/.test(ej.unidad), `${ej.id}: unidad ${ej.unidad}`);
      assert.equal(!!p.indicadores, ['posterior', 'marginal', 'decisionIndicador', 'veim', 'eficiencia'].includes(tipo));
      // sin probabilidades 0 ni 1
      [...p.priori, ...(p.verosimilitud || []).flat()].forEach((x) => assert.ok(x > 0 && x < 1, `${ej.id}: probabilidad ${x}`));

      if (ej.entrada.tipo === 'opcion') {
        let valores;
        let esperado;
        if (tipo === 'decision') { valores = ref.ve.map(aNum); }
        if (tipo === 'decisionIndicador') {
          valores = p.alternativas.map((_, i) => p.estados.reduce((s, __, j) => s + aNum(ref.post[j][d.k]) * p.pagos[i][j], 0));
        }
        if (tipo === 'criterio') {
          const f = p.pagos;
          const mejorEst = p.estados.map((_, j) => (max ? Math.max(...f.map((r) => r[j])) : Math.min(...f.map((r) => r[j]))));
          valores = {
            pesimista: f.map((r) => (max ? Math.min(...r) : Math.max(...r))),
            optimista: f.map((r) => (max ? Math.max(...r) : Math.min(...r))),
            laplace: f.map((r) => r.reduce((s, v) => s + v, 0) / r.length),
            savage: f.map((r) => Math.max(...r.map((v, j) => Math.abs(mejorEst[j] - v)))),
          }[d.criterio];
        }
        const minimiza = tipo === 'criterio' ? (d.criterio === 'savage' || !max) : !max;
        const mejor = minimiza ? Math.min(...valores) : Math.max(...valores);
        const ganadoras = valores.map((v, i) => (Math.abs(v - mejor) < 1e-9 ? i : -1)).filter((i) => i >= 0);
        assert.equal(ganadoras.length, 1, `${ej.id}: empate ${valores}`);
        esperado = ganadoras[0];
        const otros = valores.filter((_, i) => i !== esperado).map((v) => Math.abs(v - mejor));
        assert.ok(Math.min(...otros) >= 1.99, `${ej.id}: margen ${Math.min(...otros)}`);
        p.alternativas.forEach((_, i) => assert.equal(corregir(ej, i).correcta, i === esperado, `${ej.id} opción ${i}`));
        assert.equal(ej.solucion, esperado);
        assert.equal(corregir(ej, -1).correcta, false);
        assert.equal(corregir(ej, 99).correcta, false);
        continue;
      }

      numericos++;
      let valor;
      if (tipo === 'valorEsperado') valor = aNum(ref.ve[d.i]);
      else if (tipo === 'veip') valor = aNum(ref.veip);
      else if (tipo === 'posterior') valor = aNum(ref.post[d.j][d.k]);
      else if (tipo === 'marginal') valor = aNum(ref.marg[d.k]);
      else if (tipo === 'veim') valor = aNum(ref.veim);
      else valor = aNum(ref.eficiencia) * 100;
      assert.ok(cerca(ej.solucion, valor, 1e-9), `${ej.id}: ${ej.solucion} vs ${valor}`);
      if (tipo === 'veip') assert.ok(valor >= 5);
      if (tipo === 'veim') assert.ok(valor >= 2 && aNum(ref.veim) <= aNum(ref.veip));
      // aceptada: exacta, redondeada a 2 decimales (4 en posteriores), también con coma
      const dec = tipo === 'posterior' || tipo === 'marginal' ? 4 : 2;
      const red = Number(valor.toFixed(dec));
      assert.equal(corregir(ej, valor).correcta, true, `${ej.id} exacta`);
      assert.equal(corregir(ej, red).correcta, true, `${ej.id} redondeada ${red} vs ${valor}`);
      // rechazadas: error de unidad natural
      const malas = [valor + (tipo === 'posterior' || tipo === 'marginal' ? 0.02 : tipo === 'eficiencia' ? 3 : 0.5), valor - (tipo === 'posterior' || tipo === 'marginal' ? 0.02 : tipo === 'eficiencia' ? 3 : 0.5), -valor === valor ? 1 : -valor];
      malas.forEach((x) => assert.equal(corregir(ej, x).correcta, false, `${ej.id}: ${x} aceptada, correcta ${valor}`));
      // distractores típicos (cifras intermedias) nunca se aceptan salvo coincidencia numérica real con la respuesta
      const m = ref.conj ? analizar(p).muestral : null;
      const a = analizar(p);
      let distractores = [];
      if (tipo === 'veip') distractores = [a.perfecta.vecip, a.sinInfo.valor];
      if (tipo === 'veim') distractores = [m.vecim, a.perfecta.veip, a.sinInfo.valor];
      if (tipo === 'posterior') distractores = [m.conjunta[d.j][d.k], p.verosimilitud[d.j][d.k], p.priori[d.j]];
      if (tipo === 'marginal') distractores = [m.conjunta[d.j ?? 0][d.k]];
      if (tipo === 'eficiencia') distractores = [m.veim, (a.perfecta.veip / m.veim) * 100];
      // un distractor solo se acepta si coincide numéricamente con la respuesta (dentro de la tolerancia)
      const tolMax = tipo === 'posterior' || tipo === 'marginal' ? 0.0051 : tipo === 'eficiencia' ? 1 : tipo === 'veim' ? 0.3 : 0.2;
      distractores.forEach((x) => {
        if (corregir(ej, x).correcta) {
          const comoFraccion = tipo === 'eficiencia' && x > 0 && x <= 1.5 && Math.abs(x * 100 - valor) <= 1;
          assert.ok(Math.abs(x - valor) <= tolMax || comoFraccion, `${ej.id}: distractor ${x} aceptado, correcta ${valor}`);
        }
      });
      // detalle con cifras: nunca NaN/undefined
      const r = corregir(ej, valor + 7.77);
      assert.ok(!/NaN|undefined/.test(JSON.stringify(r)));
      assert.ok(r.mensaje.includes(cruda(fmtNum(valor)).split(' ')[0]) || tipo === 'eficiencia', `${ej.id} ${r.mensaje}`);
    }
  }
  assert.ok(numericos > 10000);
});

test('porcentaje escrito donde se pide decimal: no se acepta pero el detalle lo explica', () => {
  let visto = 0;
  for (let seed = 1; seed <= 200 && visto < 5; seed++) {
    const ej = generarEjercicio('posterior', seed);
    const v = ej.solucion * 100;
    const r = corregir(ej, Number(v.toFixed(2)));
    assert.equal(r.correcta, false);
    assert.match(r.detalle, /porcentaje/);
    visto++;
  }
});

test('formato: redondeo half-up estable (3/32 = 0,09375 → 0,0938; 0,4643 → 46,4 %; negativos simétricos)', async () => {
  const { fmtPct } = await import('../domain/formato.js');
  assert.equal(fmtNum(3 / 32), '0,0938');
  assert.equal(fmtNum(0.09374999999999997), '0,0938');
  assert.equal(fmtNum(-3 / 32), '−0,0938');
  assert.equal(fmtNum(0.1 + 0.2), '0,3');
  assert.equal(fmtNum(-0.00001), '0');
  assert.equal(fmtPct(0.4643), '46,4 %');
  assert.equal(fmtPct(0.12345), '12,3 %');
});
