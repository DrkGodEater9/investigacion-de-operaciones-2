/** Utilidades de prueba: árboles aleatorios y un evaluador independiente (enumera todas las estrategias puras). */
import { mulberry32 } from '../domain/rng.js';

export { mulberry32 };

/** Árbol aleatorio (borrador: ids n1, n2… en preorden; probabilidades como números o como texto). */
export function arbolAleatorio(rng, { prof = 3, total = 20, texto = false } = {}) {
  let k = 0;
  const sense = rng.next() < 0.5 ? 'max' : 'min';
  const val = (v) => (texto ? String(v).replace('.', ',') : v);
  function nodo(nivel, forzarInterno) {
    k += 1;
    const id = `n${k}`;
    if (!forzarInterno && (nivel >= prof || rng.next() < 0.3)) {
      return { id, tipo: 'final', nombre: '', valor: val(rng.int(-50, 150)), ramas: [] };
    }
    const tipo = rng.next() < 0.5 ? 'decision' : 'azar';
    const nRamas = rng.int(2, 3);
    let pesos = [];
    if (tipo === 'azar') {
      // pesos enteros que suman `total`
      let resto = total;
      for (let i = 0; i < nRamas - 1; i++) {
        const w = rng.int(1, Math.max(1, resto - (nRamas - 1 - i)));
        pesos.push(w);
        resto -= w;
      }
      pesos.push(resto);
    }
    const ramas = [];
    for (let i = 0; i < nRamas; i++) {
      ramas.push({
        etiqueta: `r${k}.${i + 1}`,
        p: tipo === 'azar' ? val(pesos[i] / total) : '',
        pago: rng.next() < 0.4 ? val(rng.int(-30, 30)) : '',
        hijo: nodo(nivel + 1, false),
      });
    }
    return { id, tipo, nombre: rng.next() < 0.5 ? `N${k}` : '', ramas };
  }
  return { sense, unidad: '', raiz: nodo(0, true) };
}

/**
 * Valor óptimo por otro camino: se enumeran todas las estrategias puras (una rama por decisión)
 * y se calcula el valor esperado de cada una; se toma la mejor. No usa evaluar().
 * Trabaja sobre el árbol normalizado.
 */
export function valoresDeEstrategias(n) {
  if (n.tipo === 'final') return [n.valor];
  if (n.tipo === 'decision') {
    return n.ramas.flatMap((r) => valoresDeEstrategias(r.hijo).map((v) => v + r.pago));
  }
  let combos = [0];
  n.ramas.forEach((r) => {
    const vs = valoresDeEstrategias(r.hijo);
    combos = combos.flatMap((c) => vs.map((v) => c + r.p * (r.pago + v)));
  });
  return combos;
}

export function mejorPorEstrategias(arbol) {
  const vs = valoresDeEstrategias(arbol.raiz);
  return arbol.sense === 'max' ? Math.max(...vs) : Math.min(...vs);
}

export const cerca = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
