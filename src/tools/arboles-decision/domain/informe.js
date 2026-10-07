/** Textos y tablas de los informes (Markdown, CSV y PDF). Funciones puras: se prueban con Node. */
import { fmtNum } from './format.js';
import { estrategiaTexto } from './evaluar.js';
import { arbolATexto } from './texto.js';
import { NOTACION } from './notacion.js';

export const TITULO = 'Árbol de decisión';
const SUBS = '₀₁₂₃₄₅₆₇₈₉';

/** Texto sin los símbolos que la fuente del PDF no trae (subíndices, ›, ✓). */
export const plano = (s) => String(s)
  .replace(/[₀-₉]/g, (d) => SUBS.indexOf(d))
  .replace(/›/g, '>')
  .replace(/✓/g, 'si');

/** Número con punto decimal (CSV). */
export const crudo = (x) => {
  let r = Math.round(x * 1e6) / 1e6;
  if (r === 0) r = 0;
  return String(r);
};

export const objetivoTxt = (arbol) => (arbol.sense === 'max' ? 'Maximizar (utilidad, ganancia)' : 'Minimizar (costo)');
const sufijo = (arbol) => (arbol.unidad ? ` ${arbol.unidad}` : '');

/** Líneas de resultado (texto plano) compartidas por Markdown y PDF. */
export function lineasResultado(arbol, ev) {
  return [
    `${arbol.sense === 'max' ? 'Valor máximo esperado' : 'Valor mínimo esperado'}: ${fmtNum(ev.valor)}${sufijo(arbol)}`,
    ...estrategiaTexto(ev),
  ];
}

const TIPO = { decision: NOTACION.decision, azar: NOTACION.azar };

/** Tabla de cálculo: una fila por rama de cada nodo interno, en el orden de la inducción hacia atrás. */
export function tablaNodos(arbol, ev, f = fmtNum) {
  const headers = ['Nodo', 'Tipo', 'Rama', 'p', 'Pago de la rama', 'Valor del nodo siguiente', 'Valor de la rama', 'Elegida', 'Valor del nodo'];
  const rows = [];
  ev.orden.forEach((id) => {
    const n = ev.porNodo[id];
    n.ramas.forEach((r, i) => {
      rows.push([
        n.nombre, TIPO[n.tipo], r.etiqueta,
        n.tipo === 'azar' ? f(r.p) : '', f(r.pago), f(r.valorHijo), f(r.total),
        n.tipo === 'decision' ? (r.elegida ? 'Sí' : r.optima ? 'Empata' : 'No') : '',
        i === 0 ? f(n.valor) : '',
      ]);
    });
  });
  return { headers, rows };
}

/** Líneas del perfil de riesgo. */
export function lineasRiesgo(riesgo, f = fmtNum) {
  return [
    `Valor esperado: ${f(riesgo.esperado)}; desviación estándar: ${f(riesgo.desviacion)}`,
    `Peor resultado: ${f(riesgo.minimo)}; mejor resultado: ${f(riesgo.maximo)}`,
    `Probabilidad de un resultado negativo: ${f(riesgo.pNegativo)}`,
  ];
}

export function tablaRiesgo(riesgo, f = fmtNum) {
  return { headers: ['Resultado final', 'Probabilidad', 'Camino'], rows: riesgo.puntos.map((x) => [f(x.valor), f(x.p), x.caminos.join('; ')]) };
}

export function lineasSensibilidad(sens, f = fmtNum) {
  if (!sens) return [];
  const out = [`Se varió la probabilidad de «${sens.etiqueta}» del nodo «${sens.nombreNodo}» (valor actual: ${f(sens.p0)}).`];
  if (sens.cortes.length === 0) out.push(`La decisión óptima no cambia entre p = 0 y p = 1: ${sens.tramos[0].estrategia}.`);
  sens.cortes.forEach((c) => out.push(`Punto de indiferencia p* = ${f(c.p, 4)}: con p menor conviene ${c.antes}; con p mayor, ${c.despues}.`));
  return out;
}

/* ---------------- CSV ---------------- */

function csv(headers, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

export const construirCSV = ({ arbol, ev }) => { const t = tablaNodos(arbol, ev, crudo); return csv(t.headers, t.rows); };

const tablaMd = (headers, rows) => {
  const celda = (c) => String(c ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const line = (r) => '| ' + r.map(celda).join(' | ') + ' |';
  return [line(headers), '|' + headers.map(() => '---').join('|') + '|', ...rows.map(line)].join('\n');
};

/* ---------------- Markdown ---------------- */

export function construirMarkdown({ arbol, ev, riesgo, sens }) {
  const t = tablaNodos(arbol, ev);
  const lines = [
    `# ${TITULO}: resultados`,
    `Fecha: ${new Date().toLocaleDateString('es-CO')}`,
    `Objetivo: ${objetivoTxt(arbol)}${arbol.unidad ? `. Unidad: ${arbol.unidad}` : ''}`,
    '',
    '## Árbol',
    '',
    '```',
    arbolATexto(arbol),
    '```',
    '',
    '## Resultado',
    ...lineasResultado(arbol, ev).map((l) => '- ' + l),
    '',
    '## Cálculo por nodo (de derecha a izquierda)',
    '',
    tablaMd(t.headers, t.rows),
  ];
  if (riesgo) {
    const r = tablaRiesgo(riesgo);
    lines.push('', '## Perfil de riesgo de la estrategia óptima', '', ...lineasRiesgo(riesgo).map((l) => '- ' + l), '', tablaMd(r.headers, r.rows));
  }
  if (sens) lines.push('', '## Sensibilidad', '', ...lineasSensibilidad(sens).map((l) => '- ' + l));
  return lines.join('\n');
}

