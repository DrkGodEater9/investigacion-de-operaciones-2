/**
 * Disposición del árbol en el plano (de izquierda a derecha): la profundidad da la x y las hojas se reparten
 * en y; cada nodo interno queda a la altura media de su primera y su última rama.
 * Funciones puras (se prueban sin navegador).
 */
import { fmtNum } from './format.js';
import { NOTACION } from './notacion.js';

export const GEOM = {
  dy: 62, // separación vertical entre hojas
  margen: 30,
  anchoMinNivel: 150,
  pxPorLetra: 6.6, // estimación del ancho del texto de 12 px
  radio: 14, // mitad del lado del cuadrado / radio del círculo
  anchoHoja: 70, // espacio para el valor que se escribe a la derecha de la hoja
  arriba: 52, // espacio para el nombre y el valor sobre la raíz
};

/** Textos de una rama: el nombre va sobre la línea; la probabilidad y el pago, debajo. */
export function textosRama(n, r) {
  const abajo = [];
  if (n.tipo === 'azar') {
    // p puede ser null (incógnita) o un texto como «1 − p» en los ejercicios de completar
    abajo.push(r.p == null ? 'p = ?' : typeof r.p === 'string' ? `p = ${r.p}` : `p = ${fmtNum(r.p)}`);
  }
  if (r.pago) abajo.push(`${NOTACION.pago} ${fmtNum(r.pago)}`);
  return { arriba: String(r.etiqueta), abajo: abajo.join(' · ') };
}

const largoRama = (r, n) => {
  const t = textosRama(n, r);
  return Math.max(t.arriba.length, t.abajo.length);
};

/** Devuelve { nodos, aristas, ancho, alto }. nodos: [{ id, nodo, x, y, nivel }]; aristas: [{ padre, hijo, rama, idx, ... }]. */
export function disponer(arbol, opts = {}) {
  const g = { ...GEOM, ...opts };
  const nodos = [];
  const aristas = [];
  const ancho = []; // ancho de cada nivel (por la etiqueta más larga que llega a él)
  let hoja = 0;

  function rec(n, nivel) {
    let y;
    const hijos = [];
    if (!n.ramas || n.ramas.length === 0) {
      y = hoja * g.dy;
      hoja += 1;
    } else {
      n.ramas.forEach((r) => {
        ancho[nivel + 1] = Math.max(ancho[nivel + 1] || 0, largoRama(r, n) * g.pxPorLetra + 56);
        hijos.push(rec(r.hijo, nivel + 1));
      });
      y = (hijos[0].y + hijos[hijos.length - 1].y) / 2;
    }
    const reg = { id: n.id, nodo: n, y, nivel };
    nodos.push(reg);
    n.ramas?.forEach((r, i) => aristas.push({ padre: reg, hijo: hijos[i], rama: r, idx: i }));
    return reg;
  }
  const raiz = rec(arbol.raiz, 0);
  void raiz;

  const xNivel = [0];
  for (let d = 1; d < ancho.length; d++) xNivel[d] = xNivel[d - 1] + Math.max(g.anchoMinNivel, ancho[d] || 0);
  // el nombre de la raíz se escribe hacia la izquierda: se reserva ese espacio
  const izq = Math.max(g.margen, Math.max(String(arbol.raiz.nombre || '').length, 14) * 7 - g.radio + 8);
  nodos.forEach((r) => { r.x = izq + xNivel[r.nivel]; r.y += g.margen + g.arriba; });
  aristas.forEach((a) => {
    a.x1 = a.padre.x;
    a.y1 = a.padre.y;
    a.x2 = a.hijo.x;
    a.y2 = a.hijo.y;
  });
  const maxX = Math.max(...nodos.map((r) => r.x));
  const maxY = Math.max(...nodos.map((r) => r.y));
  return { nodos, aristas, ancho: maxX + g.anchoHoja + g.margen, alto: maxY + g.margen + 20, geom: g };
}
