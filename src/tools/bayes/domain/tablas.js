/**
 * Tablas y líneas de resultado a partir del análisis. Una sola fuente para la pantalla, el PDF, el CSV y el Markdown.
 *   tabla = { id, titulo, headers: string[], rows: string[][], resaltar: [fila, col][], totales: número de filas (al final) que son de totales }
 */
import { fmtNum, fmtPct, listaTexto } from './formato.js';
import { NOTACION, palabrasObjetivo } from './notacion.js';

const nombres = (lista, idx) => listaTexto(idx.map((i) => lista[i]));

export function tablaPagos(p, a, f = fmtNum) {
  const n = p.estados.length;
  const rows = p.alternativas.map((alt, i) => [alt, ...p.pagos[i].map(f), f(a.sinInfo.ve[i])]);
  rows.push(['Prob. a priori', ...p.priori.map(f), '']);
  return {
    id: 'pagos',
    titulo: 'Matriz de pagos, probabilidades a priori y valor esperado',
    headers: ['Alternativa', ...p.estados, 'Valor esperado'],
    rows,
    resaltar: a.sinInfo.optimas.map((i) => [i, n + 1]),
    totales: 1,
  };
}

export function tablaPerfecta(p, a, f = fmtNum) {
  const rows = p.estados.map((e, j) => {
    const pe = a.perfecta.porEstado[j];
    return [e, f(p.priori[j]), nombres(p.alternativas, pe.alts), f(pe.valor), f(p.priori[j] * pe.valor)];
  });
  rows.push([NOTACION.vecip, '', '', '', f(a.perfecta.vecip)]);
  return {
    id: 'perfecta',
    titulo: 'Información perfecta: mejor alternativa en cada estado',
    headers: ['Estado', 'Probabilidad', 'Mejor alternativa', 'Mejor pago', 'Prob. × mejor pago'],
    rows,
    resaltar: [],
    totales: 1,
  };
}

export function tablaVerosimilitud(p, f = fmtNum) {
  return {
    id: 'verosimilitud',
    titulo: 'Verosimilitud P(indicador | estado)',
    headers: ['Estado', ...p.indicadores, 'Suma'],
    rows: p.estados.map((e, j) => [e, ...p.verosimilitud[j].map(f), f(p.verosimilitud[j].reduce((s, v) => s + v, 0))]),
    resaltar: [],
    totales: 0,
  };
}

export function tablaConjunta(p, m, f = fmtNum) {
  const rows = p.estados.map((e, j) => [e, ...m.conjunta[j].map(f), f(p.priori[j])]);
  rows.push(['P(indicador)', ...m.marginal.map(f), f(m.marginal.reduce((s, v) => s + v, 0))]);
  return {
    id: 'conjunta',
    titulo: 'Probabilidades conjuntas P(estado y indicador) y marginales',
    headers: ['Estado', ...p.indicadores, 'P(estado)'],
    rows,
    resaltar: [],
    totales: 1,
  };
}

export function tablaPosterior(p, m, f = fmtNum) {
  const rows = p.estados.map((e, j) => [e, ...m.posterior[j].map((v) => (v === null ? '—' : f(v)))]);
  rows.push(['Suma', ...m.posterior[0].map((_, k) => (m.marginal[k] > 1e-12 ? f(p.estados.reduce((s, __, j) => s + m.posterior[j][k], 0)) : '—'))]);
  return {
    id: 'posterior',
    titulo: 'Probabilidades posteriores P(estado | indicador)',
    headers: ['Estado', ...p.indicadores],
    rows,
    resaltar: [],
    totales: 1,
  };
}

export function tablaDecision(p, a, f = fmtNum) {
  const m = a.muestral;
  const rows = [];
  const resaltar = [];
  m.porIndicador.forEach((d, k) => {
    if (!d.posible) {
      rows.push([p.indicadores[k], f(m.marginal[k]), ...p.alternativas.map(() => '—'), 'No puede ocurrir', '—', '—']);
      return;
    }
    rows.push([
      p.indicadores[k], f(m.marginal[k]), ...d.ve.map(f),
      d.optimas.length > 1 ? `Empate: ${nombres(p.alternativas, d.optimas)}` : p.alternativas[d.optimas[0]],
      f(d.valor), f(m.marginal[k] * d.valor),
    ]);
    d.optimas.forEach((i) => resaltar.push([rows.length - 1, 2 + i]));
  });
  rows.push([NOTACION.vecim, '', ...p.alternativas.map(() => ''), '', '', f(m.vecim)]);
  return {
    id: 'decision',
    titulo: 'Decisión óptima según el resultado del indicador (VE con las posteriores)',
    headers: ['Indicador', 'P(indicador)', ...p.alternativas.map((x) => `VE(${x})`), 'Decisión', 'VE óptimo', 'P × VE'],
    rows,
    resaltar,
    totales: 1,
  };
}

export function tablaResumen(p, a, f = fmtNum) {
  const rows = [
    [NOTACION.vesi, f(a.sinInfo.valor)],
    [`${NOTACION.vecip} (${NOTACION.vecipLargo})`, f(a.perfecta.vecip)],
    [`${NOTACION.veip} (${NOTACION.veipLargo})`, f(a.perfecta.veip)],
  ];
  if (a.muestral) {
    rows.push([`${NOTACION.vecim} (${NOTACION.vecimLargo})`, f(a.muestral.vecim)]);
    rows.push([`${NOTACION.veim} (${NOTACION.veimLargo})`, f(a.muestral.veim)]);
    const ef = a.muestral.eficiencia;
    // En pantalla/PDF/Markdown, «46,4 %»; en el CSV (f = crudo) el número lleva punto decimal, como el resto.
    const efTexto = ef === null ? 'No definida (VEIP = 0)' : f === fmtNum ? fmtPct(ef) : `${f(ef * 100)} %`;
    rows.push([`${NOTACION.eficiencia} (${NOTACION.veim} / ${NOTACION.veip})`, efTexto]);
  }
  return { id: 'resumen', titulo: 'Resumen de valores', headers: ['Medida', 'Valor'], rows, resaltar: [], totales: 0 };
}

export function tablaCriterios(p, a, f = fmtNum) {
  const c = a.criterios;
  const resaltar = [];
  c.pesimista.indices.forEach((i) => resaltar.push([i, 1]));
  c.optimista.indices.forEach((i) => resaltar.push([i, 2]));
  c.laplace.indices.forEach((i) => resaltar.push([i, 3]));
  c.savage.indices.forEach((i) => resaltar.push([i, 4]));
  return {
    id: 'criterios',
    titulo: 'Criterios que no usan probabilidades (para comparar)',
    headers: ['Alternativa', 'Peor pago (pesimista)', 'Mejor pago (optimista)', 'Promedio (Laplace)', 'Arrepentimiento máximo (Savage)'],
    rows: p.alternativas.map((alt, i) => [alt, f(c.peor[i]), f(c.mejor[i]), f(c.promedio[i]), f(c.arrepMax[i])]),
    resaltar,
    totales: 0,
  };
}

/** Todas las tablas del resultado, en el orden del método. */
export function tablasResultado(p, a, f = fmtNum) {
  const out = [tablaPagos(p, a, f), tablaPerfecta(p, a, f)];
  if (a.muestral) {
    out.push(tablaVerosimilitud(p, f), tablaConjunta(p, a.muestral, f), tablaPosterior(p, a.muestral, f), tablaDecision(p, a, f));
  }
  out.push(tablaResumen(p, a, f), tablaCriterios(p, a, f));
  return out;
}

/** Líneas de texto del resultado (compartidas por Markdown y PDF). */
export function lineasResultado(p, a, f = fmtNum) {
  const o = palabrasObjetivo(p.objetivo);
  const out = [];
  const s = a.sinInfo;
  out.push(s.optimas.length > 1
    ? `Sin información: hay empate entre ${nombres(p.alternativas, s.optimas)} (VE ${o.regla} = ${f(s.valor)}).`
    : `Sin información: la mejor alternativa es ${p.alternativas[s.optimas[0]]} (VE ${o.regla} = ${f(s.valor)}).`);
  out.push(`${NOTACION.vecip} = ${f(a.perfecta.vecip)}; ${NOTACION.veip} = ${f(a.perfecta.veip)}.`);
  if (a.muestral) {
    const m = a.muestral;
    m.porIndicador.forEach((d, k) => {
      if (!d.posible) out.push(`Si el resultado es ${p.indicadores[k]}: no puede ocurrir (probabilidad 0).`);
      else if (d.optimas.length > 1) out.push(`Si el resultado es ${p.indicadores[k]} (probabilidad ${f(m.marginal[k])}): empate entre ${nombres(p.alternativas, d.optimas)} (VE = ${f(d.valor)}).`);
      else out.push(`Si el resultado es ${p.indicadores[k]} (probabilidad ${f(m.marginal[k])}): ${p.alternativas[d.optimas[0]]} (VE = ${f(d.valor)}).`);
    });
    out.push(`${NOTACION.vecim} = ${f(m.vecim)}; ${NOTACION.veim} = ${f(m.veim)}.`);
    out.push(m.eficiencia === null ? 'Eficiencia no definida porque el VEIP es 0.' : `${NOTACION.eficiencia} = ${fmtPct(m.eficiencia)} (${NOTACION.veim} / ${NOTACION.veip}).`);
  }
  return out;
}
