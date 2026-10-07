/**
 * Análisis de sensibilidad de una probabilidad.
 *
 * Se elige una rama de un nodo de azar y se hace variar su probabilidad p entre 0 y 1; las demás ramas
 * de ese nodo se reparten el resto (1 − p) en la misma proporción que tenían (si no había resto, en partes iguales).
 * En un nodo de azar de dos ramas esto es simplemente p y 1 − p.
 */
import { listaNodos } from './arbol.js';
import { evaluar } from './evaluar.js';

const clonar = (x) => JSON.parse(JSON.stringify(x));

/** Nodos de azar con sus ramas (para elegir cuál variar). */
export function nodosAzar(arbol) {
  return listaNodos(arbol)
    .filter((n) => n.tipo === 'azar')
    .map((n) => ({ id: n.id, nombre: n.nombre, ramas: n.ramas.map((r) => ({ etiqueta: r.etiqueta, p: r.p })) }));
}

/**
 * Nodos de azar que representan el mismo evento que `nodoId`: mismo nombre, mismas ramas y mismas probabilidades
 * (por ejemplo, la «Demanda» que aparece bajo cada alternativa). Incluye al propio nodo.
 */
export function nodosLigados(arbol, nodoId) {
  const lista = listaNodos(arbol).filter((n) => n.tipo === 'azar');
  const base = lista.find((n) => n.id === nodoId);
  if (!base) return [];
  const firma = (n) => JSON.stringify([n.nombre, n.ramas.map((r) => [r.etiqueta, Math.round(r.p * 1e12)])]);
  return lista.filter((n) => firma(n) === firma(base)).map((n) => n.id);
}

/**
 * Copia del árbol con la probabilidad de la rama `idx` del nodo `nodoId` igual a p (las otras se reescalan).
 * `tambien`: identificadores de otros nodos de azar (con las mismas ramas) que reciben el mismo cambio.
 */
export function conProbabilidad(arbol, nodoId, idx, p, tambien = []) {
  const copia = clonar(arbol);
  const lista = listaNodos(copia);
  const n = lista.find((x) => x.id === nodoId);
  if (!n || n.tipo !== 'azar' || !n.ramas[idx]) throw new Error('El nodo de azar o la rama no existen.');
  const ids = new Set([nodoId, ...tambien]);
  lista.filter((x) => ids.has(x.id)).forEach((m) => {
    if (m.tipo !== 'azar' || m.ramas.length !== n.ramas.length) return;
    const resto = 1 - m.ramas[idx].p;
    m.ramas.forEach((r, j) => {
      if (j === idx) r.p = p;
      else r.p = resto > 1e-12 ? (r.p * (1 - p)) / resto : (1 - p) / (m.ramas.length - 1);
    });
  });
  return copia;
}

/**
 * Elección de TODAS las decisiones del árbol (también las que dejan de alcanzarse cuando p = 0 o p = 1).
 * Así llegar o dejar de llegar a una decisión por un extremo de p no se confunde con un cambio de estrategia.
 */
const elecciones = (arbol, ev) => listaNodos(arbol)
  .filter((n) => n.tipo === 'decision')
  .map((n) => ({ id: n.id, idx: ev.porNodo[n.id].elegida, eleccion: n.ramas[ev.porNodo[n.id].elegida].etiqueta }));
const firmaDe = (arbol, ev) => elecciones(arbol, ev).map((e) => `${e.id}:${e.idx}`).join('|');
const textoDe = (arbol, ev) => {
  const l = elecciones(arbol, ev);
  return l.length ? l.map((e) => e.eleccion).join(' / ') : '(sin decisiones)';
};

/**
 * Barrido de p en [0, 1].
 * Devuelve { nodoId, rama, p0, ps, valores, series, cortes, tramos }:
 *  - valores: valor óptimo de la raíz para cada p de `ps`;
 *  - series: si la raíz es una decisión, el valor de cada alternativa en función de p (donde se cruzan está la indiferencia);
 *  - cortes: valores de p donde cambia la estrategia óptima (se afinan por bisección);
 *  - tramos: intervalos de p con la misma estrategia.
 * Con `ligar` se varían a la vez todos los nodos que son el mismo evento (ver nodosLigados).
 * Limitación: si la estrategia cambiara y volviera a cambiar dentro de un mismo paso de la malla, ese cambio no se ve.
 */
export function sensibilidad(arbol, nodoId, idx, { pasos = 100, ligar = false } = {}) {
  const nodo = listaNodos(arbol).find((x) => x.id === nodoId);
  if (!nodo || nodo.tipo !== 'azar' || !nodo.ramas[idx]) throw new Error('El nodo de azar o la rama no existen.');
  const p0 = nodo.ramas[idx].p;
  const tambien = ligar ? nodosLigados(arbol, nodoId) : [];
  const evalEn = (p) => evaluar(conProbabilidad(arbol, nodoId, idx, p, tambien));

  const ps = [];
  const evs = [];
  for (let i = 0; i <= pasos; i++) {
    const p = i / pasos;
    ps.push(p);
    evs.push(evalEn(p));
  }
  const valores = evs.map((e) => e.valor);
  const firmas = evs.map((e) => firmaDe(arbol, e));

  let series = null;
  const raiz = arbol.raiz;
  if (raiz.tipo === 'decision') {
    series = raiz.ramas.map((r, i) => ({ etiqueta: r.etiqueta, valores: evs.map((e) => e.porNodo[raiz.id].ramas[i].total) }));
  }

  const cortes = [];
  for (let i = 0; i < pasos; i++) {
    if (firmas[i] === firmas[i + 1]) continue;
    let lo = ps[i];
    let hi = ps[i + 1];
    const fLo = firmas[i];
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2;
      if (firmaDe(arbol, evalEn(mid)) === fLo) lo = mid; else hi = mid;
    }
    const p = (lo + hi) / 2;
    cortes.push({ p, valor: evalEn(p).valor, antes: textoDe(arbol, evs[i]), despues: textoDe(arbol, evs[i + 1]) });
  }

  const tramos = [];
  let desde = 0;
  cortes.forEach((c) => {
    tramos.push({ desde, hasta: c.p, estrategia: c.antes });
    desde = c.p;
  });
  tramos.push({ desde, hasta: 1, estrategia: textoDe(arbol, evs[pasos]) });

  return { nodoId, ligados: tambien.length > 1 ? tambien : [], nombreNodo: nodo.nombre, rama: idx, etiqueta: nodo.ramas[idx].etiqueta, p0, ps, valores, series, cortes, tramos };
}
