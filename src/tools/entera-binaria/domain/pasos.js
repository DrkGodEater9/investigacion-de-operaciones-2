/** Pasos explicados para la pestaña «Paso a paso» (aditivo de Balas y enumeración). */
import { balas, nombreBalas } from './balas.js';
import { enumerate } from './enumerar.js';
import { fmtNum as fmtBase, sub, expresionLineal, restriccionTexto, objetivoTexto, listaNombres } from './format.js';

const fmtNum = (x) => fmtBase(x).replace('-', '−');

const OP = { '<=': '≤', '>=': '≥', '=': '=' };

const lista = (js, nom) => (js.length ? js.map(nom).join(', ') : 'ninguna');

/** Texto «a₁·1 + a₂·0 …» solo con los términos en 1: devuelve la suma y su detalle. */
function sumaTexto(fila, F1) {
  if (F1.length === 0) return { suma: 0, txt: '0' };
  let suma = 0;
  const partes = F1.map((j) => { suma += fila[j]; return fmtNum(fila[j]); });
  return { suma, txt: partes.join(' + ').replace(/ \+ −/g, ' − ') };
}

export function pasosBalas(model, opts) {
  const r = balas(model, opts);
  const { trace, transform: T } = r;
  const n = model.names.length;
  const nom = (j) => nombreBalas(T, j);
  const nomsSub = T.nombres.map((_, j) => nom(j));
  const pasos = [];

  // Paso 0: planteamiento
  const complementadas = T.comp.map((v, j) => (v ? j : -1)).filter((j) => j >= 0);
  const partes = [];
  if (model.sense === 'max') partes.push('se cambia el signo de la función objetivo para minimizar (Z = −Z′)');
  if (model.constraints.some((c) => c.op === '>=')) partes.push('las restricciones ≥ se multiplican por −1 para dejarlas como ≤');
  if (model.constraints.some((c) => c.op === '=')) partes.push('cada igualdad se escribe como dos desigualdades (≤ y ≥)');
  if (complementadas.length) {
    partes.push(`${listaNombres(complementadas, model.names)} ${complementadas.length === 1 ? 'tiene' : 'tienen'} costo negativo, así que ${complementadas.length === 1 ? 'se reemplaza' : 'se reemplazan'} por su complemento (1 − x), que se escribe con ′`);
  }
  pasos.push({
    id: 0,
    titulo: 'Planteamiento y forma del método',
    texto:
      `Modelo: ${objetivoTexto(model)}; sujeto a ${model.constraints.map((_, i) => restriccionTexto(model, i)).join('; ') || 'ninguna restricción'}; con xⱼ ∈ {0, 1}. ` +
      (partes.length
        ? `El método necesita minimizar con costos no negativos y restricciones ≤. Para lograrlo: ${partes.join('; ')}.`
        : 'El modelo ya está en la forma que necesita el método (minimizar, costos no negativos y restricciones ≤).') +
      (model.sense === 'max' || T.K !== 0
        ? ` En los nodos, «Z» es el valor de esta función transformada${T.K !== 0 ? ' sin su constante' : ''}; al terminar se recupera el Z del problema original (${model.sense === 'max' ? 'Z = −(' : 'Z = ('}${T.K !== 0 ? `${fmtNum(T.K)} + ` : ''}Z transformada)).`
        : '') +
      ' Se parte con todas las variables en 0 y se ramifica fijando en 1 la que más reduce la infactibilidad.',
    calculo: [
      `Minimizar Z${model.sense === 'max' ? '′' : ''} = ${expresionLineal(T.c, nomsSub)}${T.K !== 0 ? ` ${T.K < 0 ? '−' : '+'} ${fmtNum(Math.abs(T.K))}` : ''}`,
      ...T.A.map((fila, i) => `R${i + 1}: ${expresionLineal(fila, nomsSub)} ≤ ${fmtNum(T.b[i])}${T.origen[i] ? `   (${T.origen[i]})` : ''}`),
    ],
    estado: { hastaNodo: 0, nodoActual: null },
  });

  // Un paso por nodo
  trace.forEach((nd, k) => {
    const resumen = nd.rama ? `${nom(nd.rama.j)} = ${nd.rama.valor}` : 'raíz';
    const base =
      `Fijadas en 1: ${lista(nd.F1, nom)}. Excluidas (en 0): ${lista(nd.F0, nom)}. Z = ${fmtNum(nd.z)}. Infactibilidad = ${fmtNum(nd.I)}. `;
    let texto;
    if (nd.decision === 'ramifica') {
      const ij = nd.candidatas.map((j) => `${nom(j)}: ${fmtNum(nd.Ij[j])}`).join(', ');
      texto = `${base}Al fijar cada variable libre candidata en 1 quedaría: ${ij}. Se ramifica en ${nom(nd.branchVar)} porque deja la menor infactibilidad (si hay empate, la de menor índice).`;
    } else if (nd.decision === 'factible') {
      texto = `${base}Todas las holguras son no negativas: la solución es factible. Z = ${fmtNum(nd.z)}. Queda como mejor solución (Z* = ${fmtNum(nd.z)}).`;
      if (nd.zStar !== null) texto += ` Mejora la anterior (Z* era ${fmtNum(nd.zStar)}).`;
    } else if (nd.decision === 'poda-infactible') {
      const i = nd.s.findIndex((v) => v < -1e-9);
      texto = `${base}Aunque se fijaran en 1 todas las variables libres que aún pueden usarse, la restricción ${nd.motivo.match(/«(.*?)»/)?.[1] ?? 'R' + (i + 1)} no se cumpliría. Se poda la rama.`;
    } else {
      texto = nd.z >= nd.zStar - 1e-9
        ? `${base}Su Z (${fmtNum(nd.z)}) ya no es menor que la mejor solución conocida (Z* = ${fmtNum(nd.zStar)}), y fijar más variables en 1 no baja Z. Se poda la rama.`
        : `${base}Esta rama no puede mejorar la mejor solución conocida (Z* = ${fmtNum(nd.zStar)}): ${nd.motivo.charAt(0).toLowerCase()}${nd.motivo.slice(1)} Se poda la rama.`;
    }
    const calculo = T.A.map((fila, i) => {
      const { suma, txt } = sumaTexto(fila, nd.F1);
      const k1 = subIdx(i + 1);
      return `s${k1} = b${k1} − Σ a·x = ${fmtNum(T.b[i])} − (${txt === '0' ? '0' : `${txt} = ${fmtNum(suma)}`}) = ${fmtNum(nd.s[i])}`;
    });
    pasos.push({
      id: pasos.length,
      titulo: `Nodo ${nd.id}: ${resumen}`,
      texto,
      calculo,
      estado: { hastaNodo: k, nodoActual: nd.id },
    });
  });

  // Conclusión
  const total = 2 ** n;
  let concl;
  if (r.status === 'infactible') {
    concl = 'El problema no tiene solución factible: ninguna combinación de variables cumple todas las restricciones.';
  } else if (!r.best) {
    concl = 'Se alcanzó el límite de nodos antes de encontrar una solución factible: no se puede concluir nada sobre el problema.';
  } else {
    const elegidas = r.best.x.map((v, j) => (v === 1 ? j : -1)).filter((j) => j >= 0);
    concl =
      (elegidas.length === 0 ? 'No se elige ninguna variable (todas valen 0). ' : `Se ${elegidas.length === 1 ? 'elige' : 'eligen'} ${listaNombres(elegidas, model.names)}. `) +
      `${model.sense === 'max' ? 'El máximo' : 'El mínimo'} es Z = ${fmtNum(r.best.z)}. ` +
      `Se visitaron ${trace.length} ${trace.length === 1 ? 'nodo' : 'nodos'} del árbol; la enumeración completa tendría 2${superindice(n)} = ${total.toLocaleString('es-CO')} combinaciones.`;
    if (r.status === 'limite') concl = 'Se alcanzó el límite de nodos: la mejor solución encontrada no está garantizada como óptima. ' + concl;
  }
  pasos.push({
    id: pasos.length,
    titulo: 'Conclusión',
    texto: concl,
    calculo: r.best
      ? [`x = (${r.best.x.join(', ')})`, `Z = ${fmtNum(r.best.z)}`]
      : ['Sin solución factible'],
    estado: { hastaNodo: trace.length - 1, nodoActual: null },
  });
  return pasos;
}

const subIdx = (i) => String(i).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]);

function superindice(n) {
  const S = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  return String(n).replace(/\d/g, (d) => S[d]);
}

/** Pasos de la enumeración (solo n ≤ 4). */
export function pasosEnumeracion(model) {
  const n = model.names.length;
  if (n > 4) {
    throw new Error('El paso a paso de la enumeración solo es práctico con 4 variables o menos; usa el método aditivo.');
  }
  const total = 2 ** n;
  const e = enumerate(model, { keepRows: true });
  const max = model.sense === 'max';
  const pasos = [];
  pasos.push({
    id: 0,
    titulo: 'Planteamiento',
    texto: `Con ${n} variables hay 2${superindice(n)} = ${total} combinaciones. Se evalúa cada restricción en cada una, se descartan las que no se cumplen y entre las factibles se elige la de ${max ? 'mayor' : 'menor'} Z.`,
    calculo: [objetivoTexto(model), ...model.constraints.map((_, i) => restriccionTexto(model, i)), 'xⱼ ∈ {0, 1}'],
    estado: { fila: null, mejorHastaAhora: null },
  });
  let mejor = null;
  e.rows.forEach((row, k) => {
    const comb = row.x.join('');
    const lineas = model.constraints.map((rest, i) => {
      const terminos = rest.a.map((a, j) => `${fmtNum(a)}·${row.x[j]}`).join(' + ');
      return `${rest.name}: ${terminos} = ${fmtNum(row.lhs[i])} ${OP[rest.op]} ${fmtNum(rest.b)} → ${row.satisfied[i] ? 'se cumple' : 'no se cumple'}`;
    });
    const zTerm = model.c.map((c, j) => `${fmtNum(c)}·${row.x[j]}`).join(' + ');
    let extra;
    if (!row.feasible) extra = 'No es factible: se descarta.';
    else if (mejor === null || (max ? row.z > mejor.z + 1e-9 : row.z < mejor.z - 1e-9)) {
      extra = mejor === null ? 'Es factible y es la primera: queda como mejor hasta ahora.' : `Es factible y mejora la anterior (Z = ${fmtNum(mejor.z)}): queda como mejor hasta ahora.`;
      mejor = { z: row.z, x: row.x.slice() };
    } else extra = `Es factible, pero no mejora la mejor hasta ahora (Z = ${fmtNum(mejor.z)}).`;
    pasos.push({
      id: pasos.length,
      titulo: `Combinación ${comb}`,
      texto: `${row.feasible ? 'Cumple todas las restricciones. ' : ''}Z = ${fmtNum(row.z)}. ${extra}`,
      calculo: [...lineas, `Z = ${zTerm} = ${fmtNum(row.z)}`],
      estado: { fila: k, mejorHastaAhora: mejor ? { z: mejor.z, x: mejor.x.slice() } : null },
    });
  });
  let concl;
  if (e.status === 'infactible') concl = 'Ninguna combinación cumple todas las restricciones: el problema no tiene solución factible.';
  else {
    const sols = e.best.solutions.map((x) => listaNombres(x.map((v, j) => (v ? j : -1)).filter((j) => j >= 0), model.names));
    concl = `Hay ${e.feasibleCount} combinaciones factibles. El óptimo es Z = ${fmtNum(e.best.z)} eligiendo ${sols.join(' o ')}.`;
  }
  pasos.push({
    id: pasos.length,
    titulo: 'Conclusión',
    texto: concl,
    calculo: e.best ? e.best.solutions.map((x) => `x = (${x.join(', ')}), Z = ${fmtNum(e.best.z)}`) : ['Sin solución factible'],
    estado: { fila: null, mejorHastaAhora: mejor },
  });
  return pasos;
}
