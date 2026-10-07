import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, problemaAMarkdown, borradorDeProblema, borradorAMarkdown, leerNumero } from '../domain/entrada.js';
import { analizar } from '../domain/bayes.js';
import { EJEMPLOS, ejemploPorId } from '../domain/ejemplos.js';
import { mulberry32, problemaAleatorio, cerca } from './utils.mjs';

const MD_B1 = `Objetivo: maximizar
| Alternativa | Petróleo | Seco |
|---|---|---|
| Perforar | 500 | -100 |
| Vender | 60 | 60 |
| Prob. a priori | 0,3 | 0,7 |

| Estado | Favorable | Desfavorable |
|---|---|---|
| Petróleo | 0,8 | 0,2 |
| Seco | 0,3 | 0,7 |
`;

test('parseMarkdown lee el ejemplo B1 y da el mismo análisis que el problema original', () => {
  const r = parseMarkdown(MD_B1);
  assert.deepEqual(r.errores, []);
  const b1 = ejemploPorId('B1').problema;
  assert.deepEqual(r.problema.pagos, b1.pagos);
  assert.deepEqual(r.problema.priori, b1.priori);
  assert.deepEqual(analizar(r.problema), analizar(b1));
});

test('ida y vuelta: problema → Markdown → problema (ejemplos y 200 aleatorios en max y min)', () => {
  const comparar = (p) => {
    const r = parseMarkdown(problemaAMarkdown(p));
    assert.deepEqual(r.errores, [], problemaAMarkdown(p));
    assert.equal(r.problema.objetivo, p.objetivo);
    assert.deepEqual(r.problema.alternativas, p.alternativas);
    assert.deepEqual(r.problema.estados, p.estados);
    r.problema.pagos.forEach((f, i) => f.forEach((v, j) => assert.ok(cerca(v, p.pagos[i][j]))));
    r.problema.priori.forEach((v, j) => assert.ok(cerca(v, p.priori[j], 1e-9)));
    assert.equal(Boolean(r.problema.indicadores), Boolean(p.indicadores));
    if (p.indicadores) r.problema.verosimilitud.forEach((f, j) => f.forEach((v, k) => assert.ok(cerca(v, p.verosimilitud[j][k], 1e-9))));
  };
  EJEMPLOS.forEach((e) => comparar(e.problema));
  const rng = mulberry32(9);
  for (let t = 0; t < 200; t++) comparar(problemaAleatorio(rng, { conInfo: t % 4 !== 0 }).p);
});

test('borrador: el borrador del problema y el problema del borrador coinciden', () => {
  const p = ejemploPorId('B3').problema;
  const d = borradorDeProblema(p);
  assert.equal(d.pagos[0][2], '-400');
  assert.equal(d.priori[0], '0,3');
  assert.equal(d.conInfo, true);
  assert.deepEqual(parseMarkdown(borradorAMarkdown(d)).problema, p);
  const sin = borradorDeProblema(ejemploPorId('B4').problema);
  assert.equal(sin.conInfo, false);
  assert.ok(!borradorAMarkdown(sin).includes('Estado |'));
});

test('sin línea de objetivo se maximiza; «minimizar», «costos» y mayúsculas se entienden', () => {
  const t = (obj) => `${obj}\n| Alt | E1 | E2 |\n|---|---|---|\n| A | 1 | 2 |\n| B | 2 | 1 |\n| Prob | 0,5 | 0,5 |`;
  assert.equal(parseMarkdown(t('')).problema.objetivo, 'max');
  assert.equal(parseMarkdown(t('Objetivo: Minimizar')).problema.objetivo, 'min');
  assert.equal(parseMarkdown(t('objetivo: costos')).problema.objetivo, 'min');
  assert.equal(parseMarkdown(t('Objetivo: utilidades')).problema.objetivo, 'max');
  assert.match(parseMarkdown(t('Objetivo: qué sé yo')).errores[0], /no se entiende/);
});

test('probabilidades como porcentaje y fracción; coma o punto', () => {
  const t = '| Alt | E1 | E2 | E3 |\n|---|---|---|---|\n| A | 1 | 2 | 3 |\n| B | 3 | 2 | 1 |\n| Prob. | 25% | 1/4 | 0.5 |';
  const r = parseMarkdown(t);
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.problema.priori, [0.25, 0.25, 0.5]);
  assert.deepEqual(leerNumero('1/3', true).valor, 1 / 3);
  assert.equal(leerNumero('12,5').valor, 12.5);
  assert.equal(leerNumero('−3').valor, -3);
});

test('errores de lectura: mensajes con fila y columna', () => {
  const casos = [
    ['', /Escribe la tabla de pagos/],
    ['| Alt | E1 |\n|---|---|\n| A | 1 |', /al menos dos estados/],
    ['| Alt | E1 | E2 |\n|---|---|---|\n| A | 1 | 2 |\n| B | 3 | 4 |', /Falta la fila de probabilidades a priori/],
    ['| Alt | E1 | E2 |\n|---|---|---|\n| A | 1 | x |\n| B | 3 | 4 |\n| Prob | 0,5 | 0,5 |', /fila «A», columna «E2»: «x» no es un número/],
    ['| Alt | E1 | E2 |\n|---|---|---|\n| A | 1.000 | 2 |\n| B | 3 | 4 |\n| Prob | 0,5 | 0,5 |', /separador de miles/],
    ['| Alt | E1 | E2 |\n|---|---|---|\n| A | 1 |\n| B | 3 | 4 |\n| Prob | 0,5 | 0,5 |', /fila «A»: se esperaban 3 columnas y llegaron 2/],
    ['| Alt | E1 | E2 |\n|---|---|---|\n| A | 1 | 2 |\n| B | 3 | 4 |\n| Prob | 0,5 | 0,4 |', /suman 0,9 y deben sumar 1/],
    [MD_B1.replace('| Seco | 0,3 | 0,7 |', '| Seco | 0,3 | 0,6 |'), /Verosimilitud del estado «Seco».*suman 0,9/],
    [MD_B1.replace('| Seco | 0,3 | 0,7 |\n', ''), /una fila por estado \(2\) y tiene 1/],
    [MD_B1.replace('| Estado | Favorable | Desfavorable |', '| Estado | Favorable |').replace(/\| 0,8 \| 0,2 \|/, '| 0,8 |').replace(/\| 0,3 \| 0,7 \|\n$/, '| 0,3 |\n'), /al menos dos resultados/],
  ];
  for (const [txt, re] of casos) {
    const r = parseMarkdown(txt);
    assert.equal(r.problema, null, txt);
    assert.ok(r.errores.some((e) => re.test(e)), `${re} en ${JSON.stringify(r.errores)}`);
  }
});

test('aviso cuando el nombre de la fila de verosimilitud no coincide con el estado', () => {
  const r = parseMarkdown(MD_B1.replace('| Seco | 0,3 | 0,7 |', '| Otro | 0,3 | 0,7 |'));
  assert.deepEqual(r.errores, []);
  assert.match(r.avisos[0], /«Otro».*«Seco»/);
});

test('el nombre de una alternativa con barra vertical no rompe la tabla', () => {
  const d = borradorDeProblema(ejemploPorId('B1').problema);
  d.alts[0] = 'Per|forar';
  const r = parseMarkdown(borradorAMarkdown(d));
  assert.deepEqual(r.errores, []);
  assert.equal(r.problema.alternativas[0], 'Per forar');
});
