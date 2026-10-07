import { toMarkdown } from '../../../shared/files.js';
import { parseFraction } from '../domain/fraction.js';

/**
 * Funciones puras (sin DOM) que arman el texto de las exportaciones CSV/Markdown/PDF.
 */

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const subindice = (i) => String(i).replace(/\d/g, (d) => SUB[d]);

/** Valor escrito por el usuario como fracción irreducible («0,5» → «1/2»); si no se entiende, tal cual. */
function valorTexto(raw) {
  try {
    return parseFraction(String(raw)).toString();
  } catch {
    return String(raw);
  }
}

/**
 * Expresión lineal legible: «3x₁ − 2x₂ + (1/2)x₃». Omite los coeficientes nulos; si todos son nulos, «0».
 * ascii=true usa «x1» y «-» (PDF, cuya fuente puede no tener subíndices).
 */
export function formatoLineal(coefs, { ascii = false } = {}) {
  const partes = [];
  coefs.forEach((raw, j) => {
    const txt = valorTexto(raw);
    if (txt === '0') return;
    const neg = txt.startsWith('-');
    const abs = neg ? txt.slice(1) : txt;
    const cuerpo = abs === '1' ? '' : abs.includes('/') ? `(${abs})` : abs;
    const nombre = ascii ? `x${j + 1}` : `x${subindice(j + 1)}`;
    const menos = ascii ? '-' : '−';
    if (partes.length === 0) partes.push(`${neg ? menos : ''}${cuerpo}${nombre}`);
    else partes.push(`${neg ? menos : '+'} ${cuerpo}${nombre}`);
  });
  return partes.length ? partes.join(' ') : '0';
}

export function simboloOperador(op, { ascii = false } = {}) {
  if (op === '<=') return ascii ? '<=' : '≤';
  if (op === '>=') return ascii ? '>=' : '≥';
  return '=';
}

export function getNodesData(result) {
  if (!result || !result.nodes) return { headers: [], rows: [] };

  const headers = ['Nodo', 'Padre', 'Restricción', 'Solución (X)', 'Z', 'Estado', 'Incumbente Z*', 'Acción'];
  const rows = result.nodes.map((n) => {
    const nodo = n.label || `P${n.id}`;
    const padre = n.parentId !== null && n.parentId !== undefined ? `P${n.parentId}` : '—';
    const opSym = n.branchOp === '<=' ? '≤' : n.branchOp === '>=' ? '≥' : n.branchOp || '';
    const restr = n.branchVar !== null && n.branchVar !== undefined ? `x${n.branchVar + 1} ${opSym} ${n.branchBound}` : 'Raíz';

    let solX = '—';
    if (n.status === 'infeasible') {
      solX = 'Infactible';
    } else if (n.status === 'unbounded') {
      solX = 'No acotado';
    } else if (n.x) {
      solX = `(${n.x.map((v) => v.toDual()).join('; ')})`;
    }

    const zVal = n.z ? n.z.toDual() : '—';

    let estado = 'Fraccionario';
    if (n.status === 'integer') estado = 'Entero';
    else if (n.status === 'infeasible') estado = 'Infactible';
    else if (n.status === 'unbounded') estado = 'No acotado';

    const inc = n.incumbentAfter
      ? (n.incumbentAfter.toDual ? n.incumbentAfter.toDual() : n.incumbentAfter.z ? n.incumbentAfter.z.toDual() : String(n.incumbentAfter))
      : '—';

    let accion = 'Ramificar';
    if (n.action === 'incumbent') accion = 'Nuevo incumbente';
    else if (n.action === 'pruned-bound') accion = 'Podado por cota';
    else if (n.action === 'pruned-infeasible') accion = 'Podado por infactibilidad';
    else if (n.action === 'pruned-worse-than-parent') accion = 'Podado (≤ incumbente)';

    return [nodo, padre, restr, solX, zVal, estado, inc, accion];
  });

  return { headers, rows };
}

/** Descripción de la integralidad del modelo: «todas enteras» o cuáles son enteras y cuáles continuas. */
export function describirIntegralidad(model, formato = 'md') {
  const n = model.c.length;
  const esEntera = (j) => !(Array.isArray(model.integer) && model.integer[j] === false);
  const enteras = Array.from({ length: n }, (_, j) => j).filter(esEntera).map((j) => `x${j + 1}`);
  const continuas = Array.from({ length: n }, (_, j) => j).filter((j) => !esEntera(j)).map((j) => `x${j + 1}`);
  const mixto = continuas.length > 0;
  if (formato === 'pdf') {
    return mixto
      ? `x_j >= 0; enteras: ${enteras.join(', ') || 'ninguna'}; continuas: ${continuas.join(', ')}`
      : 'x_j >= 0, x_j enteras para todo j';
  }
  return mixto
    ? `xⱼ ≥ 0; enteras: ${enteras.join(', ') || 'ninguna'}; continuas: ${continuas.join(', ')}`
    : 'xⱼ ≥ 0 y xⱼ ∈ ℤ para todo j';
}

/** Líneas de resumen del resultado (estado, óptimo o mejor solución, relajación, conteos). */
export function resumenResultado(model, result, { ascii = false } = {}) {
  const mixto = Array.isArray(model.integer) && model.integer.some((v) => v === false);
  const lineas = [];
  const vec = (x) => `(${x.map((v) => v.toDual()).join('; ')})`;
  const zStar = ascii ? 'Z*' : 'Z*';
  if (result.status === 'optimal' && result.best) {
    lineas.push({ k: 'Estado', v: `Solución óptima ${mixto ? 'mixta' : 'entera'} encontrada` });
    lineas.push({ k: `Valor óptimo ${zStar}`, v: result.best.z.toDual() });
    lineas.push({ k: 'Punto óptimo X*', v: vec(result.best.x) });
  } else if (result.status === 'infeasible') {
    lineas.push({ k: 'Estado', v: `Problema infactible (sin solución ${mixto ? 'mixta' : 'entera'} factible)` });
  } else if (result.status === 'unbounded') {
    lineas.push({ k: 'Estado', v: 'Problema no acotado' });
  } else {
    lineas.push({ k: 'Estado', v: 'Límite de nodos alcanzado (la mejor solución hallada no está probada como óptima)' });
    if (result.best) {
      lineas.push({ k: `Mejor solución hallada ${zStar}`, v: result.best.z.toDual() });
      lineas.push({ k: 'Punto X', v: vec(result.best.x) });
    }
  }
  if (result.relaxation?.z) lineas.push({ k: 'Relajación continua Z(P0)', v: result.relaxation.z.toDual() });
  lineas.push({ k: 'Nodos explorados', v: String(result.counts?.nodes || 0) });
  lineas.push({ k: 'Nodos podados', v: String(result.counts?.pruned || 0) });
  return lineas;
}

/** Contenido Markdown completo de la exportación (puro; la fecha se inyecta para poder probarlo). */
export function construirMarkdown(model, result, fecha = new Date().toLocaleDateString('es-CO')) {
  const { headers, rows } = getNodesData(result);
  const mixto = Array.isArray(model.integer) && model.integer.some((v) => v === false);
  const lines = [
    `# ${mixto ? 'Programación entera mixta' : 'Programación entera pura'} — Resultados`,
    `Fecha: ${fecha}`,
    ``,
    `## Modelo matemático`,
    `**Función objetivo:**`,
    `${model.sense === 'max' ? 'Maximizar' : 'Minimizar'} Z = ${formatoLineal(model.c)}`,
    ``,
    `**Sujeto a:**`,
    ...model.constraints.map((ct) => `- ${formatoLineal(ct.a)} ${simboloOperador(ct.op)} ${valorTexto(ct.b)}`),
    `- ${describirIntegralidad(model)}`,
    ``,
    `## Resumen de la solución`,
    ...resumenResultado(model, result).map(({ k, v }) => `- **${k}:** ${v}`),
    ``,
    `## Tabla de nodos del árbol (Branch & Bound)`,
    toMarkdown(headers, rows),
  ];
  return lines.join('\n');
}
