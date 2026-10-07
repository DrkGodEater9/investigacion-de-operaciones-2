import test from 'node:test';
import assert from 'node:assert/strict';
import { analizar } from '../domain/bayes.js';
import { pasosBayes } from '../domain/pasos.js';
import { tablasResultado, lineasResultado } from '../domain/tablas.js';
import { fmtNum, fmtPct } from '../domain/formato.js';
import { EJEMPLOS } from '../domain/ejemplos.js';
import { mulberry32, problemaAleatorio } from './utils.mjs';

test('pasos: cantidad, estado monótono, sin NaN/undefined y cierre con conclusión (4 ejemplos y 100 aleatorios)', () => {
  const rng = mulberry32(3);
  const problemas = [...EJEMPLOS.map((e) => e.problema), ...Array.from({ length: 100 }, (_, t) => problemaAleatorio(rng, { conInfo: t % 5 !== 0, ceros: t % 7 === 0 }).p)];
  for (const p of problemas) {
    const pasos = pasosBayes(p);
    assert.ok(pasos.length >= 6);
    const ultimo = pasos[pasos.length - 1];
    assert.equal(ultimo.estado.final, true);
    assert.equal(ultimo.titulo, 'Conclusión');
    pasos.forEach((s, i) => {
      assert.ok(s.titulo && s.texto && s.calculo.length > 0, `paso ${i}`);
      const txt = JSON.stringify(s);
      assert.ok(!/NaN|undefined|Infinity/.test(txt), `paso ${i}: ${txt}`);
      if (i > 0) {
        const a = pasos[i - 1].estado;
        const b = s.estado;
        for (const k of ['ve', 'decision', 'lik', 'conj', 'marg', 'vecim', 'veim', 'efic']) assert.ok(!a[k] || b[k], `${k} no puede apagarse (paso ${i})`);
        assert.ok(b.post >= a.post && b.dec >= a.dec);
      }
    });
    if (p.indicadores) {
      const K = p.indicadores.length;
      assert.equal(ultimo.estado.post, K);
      assert.equal(ultimo.estado.dec, K);
      assert.equal(pasos.length, 5 + 3 + 2 * K + 3 + 1);
    } else assert.equal(pasos.length, 6);
  }
});

test('pasos de B1: las cifras del cálculo son las del análisis', () => {
  const p = EJEMPLOS[0].problema;
  const pasos = pasosBayes(p);
  const t = (titulo) => pasos.find((s) => s.titulo.startsWith(titulo)).calculo.join('\n');
  assert.match(t('Valor esperado de cada'), /VE\(Perforar\) = 0,3·500 \+ 0,7·\(−100\) = 80/);
  assert.match(t('Valor esperado de cada'), /VE\(Vender\) = 0,3·60 \+ 0,7·60 = 60/);
  assert.match(t('Mejor alternativa en cada'), /VEcIP = 0,3·500 \+ 0,7·60 = 192/);
  assert.match(t('VEIP'), /VEIP = VEcIP − VE sin información = 192 − 80 = 112/);
  assert.match(t('Probabilidades conjuntas'), /P\(Petróleo y Favorable\) = 0,3·0,8 = 0,24/);
  assert.match(t('Probabilidades marginales'), /P\(Favorable\) = 0,24 \+ 0,21 = 0,45/);
  assert.match(t('Posteriores si el resultado es Favorable'), /P\(Petróleo \| Favorable\) = 0,24 \/ 0,45 = 0,5333/);
  assert.match(t('Decisión si el resultado es Favorable'), /Decisión si sale Favorable: Perforar \(VE = 220\)/);
  assert.match(t('Valor esperado con información muestral'), /VEcIM = 0,45·220 \+ 0,55·60 = 132/);
  assert.match(t('Valor de la información muestral'), /VEIM = VEcIM − VE sin información = 132 − 80 = 52/);
  assert.match(t('Eficiencia'), /Eficiencia = 52 \/ 112 = 46,4 %/);
});

test('pasos en costos usan la resta contraria para VEIP y VEIM', () => {
  const p = EJEMPLOS[1].problema;
  const pasos = pasosBayes(p);
  const todo = pasos.map((s) => s.calculo.join('\n')).join('\n');
  assert.match(todo, /VEIP = VE sin información − VEcIP = 62 − 38 = 24/);
  assert.match(todo, /VEIM = VE sin información − VEcIM = 62 − 51,2 = 10,8/);
});

test('tablas del resultado: filas con el mismo ancho que los encabezados y valores coherentes', () => {
  for (const e of EJEMPLOS) {
    const a = analizar(e.problema);
    const tablas = tablasResultado(e.problema, a);
    tablas.forEach((t) => {
      t.rows.forEach((r) => assert.equal(r.length, t.headers.length, `${e.id} ${t.id}`));
      t.resaltar.forEach(([i, j]) => assert.ok(i < t.rows.length && j < t.headers.length));
    });
    const ids = tablas.map((t) => t.id);
    assert.deepEqual(ids, e.problema.indicadores
      ? ['pagos', 'perfecta', 'verosimilitud', 'conjunta', 'posterior', 'decision', 'resumen', 'criterios']
      : ['pagos', 'perfecta', 'resumen', 'criterios']);
    const pagos = tablas[0];
    assert.equal(pagos.rows[0][pagos.headers.length - 1], fmtNum(a.sinInfo.ve[0]));
    assert.deepEqual(pagos.resaltar, a.sinInfo.optimas.map((i) => [i, e.problema.estados.length + 1]));
  }
  const b1 = tablasResultado(EJEMPLOS[0].problema, analizar(EJEMPLOS[0].problema));
  const conj = b1.find((t) => t.id === 'conjunta');
  assert.deepEqual(conj.rows[2], ['P(indicador)', '0,45', '0,55', '1']);
  const post = b1.find((t) => t.id === 'posterior');
  assert.deepEqual(post.rows[2], ['Suma', '1', '1']);
  const res = b1.find((t) => t.id === 'resumen');
  assert.equal(res.rows.at(-1)[1], '46,4 %');
});

test('líneas de resultado: empate y resultado imposible', () => {
  const p = {
    objetivo: 'max', alternativas: ['A', 'B'], estados: ['E1', 'E2'], pagos: [[10, 20], [10, 20]], priori: [0.5, 0.5],
    indicadores: ['Z1', 'Z2'], verosimilitud: [[1, 0], [1, 0]],
  };
  const l = lineasResultado(p, analizar(p)).join('\n');
  assert.match(l, /empate entre A y B/);
  assert.match(l, /Z2: no puede ocurrir/);
  assert.match(l, /Eficiencia no definida/);
  assert.equal(fmtPct(0.25), '25 %');
});
