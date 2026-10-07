/** Utilidades de prueba: generador con semilla y solución por fuerza bruta independiente del dominio. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  return { next, int, pick: (arr) => arr[int(0, arr.length - 1)] };
}

const NOMBRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Red aleatoria pequeña. Devuelve filas editables { name, preds, dn, dl, cn, cl }.
 * opciones: n (actividades), rango (reducción máxima por actividad), costos ('grandes' | 'chicos' para empates).
 */
export function redAleatoria(rng, { nMin = 2, nMax = 8, maxRed = 3, costos = 'grandes', pPred = 0.35, pFija = 0.2 } = {}) {
  const n = rng.int(nMin, nMax);
  const filas = [];
  for (let j = 0; j < n; j++) {
    const preds = [];
    for (let i = 0; i < j; i++) if (rng.next() < pPred) preds.push(NOMBRES[i]);
    const dn = rng.int(1, 7);
    const fija = rng.next() < pFija;
    const dl = fija ? dn : Math.max(0, dn - rng.int(1, maxRed));
    const cn = costos === 'chicos' ? rng.int(0, 3) : rng.int(10, 100);
    const extra = costos === 'chicos' ? rng.int(0, 4) : rng.int(0, 120);
    const cl = fija ? cn : cn + extra;
    filas.push({ name: NOMBRES[j], preds: preds.join(','), dn: String(dn), dl: String(dl), cn: String(cn), cl: String(cl) });
  }
  return filas;
}

/** Longitud del camino más largo (actividad en el nodo), escrita aparte del dominio. */
export function duracionBruta(filas, d) {
  const idx = new Map(filas.map((f, i) => [f.name, i]));
  const fin = new Array(filas.length).fill(null);
  const calc = (j) => {
    if (fin[j] !== null) return fin[j];
    let ini = 0;
    const ps = String(filas[j].preds).split(',').map((s) => s.trim()).filter(Boolean);
    for (const p of ps) ini = Math.max(ini, calc(idx.get(p)));
    fin[j] = ini + d[j];
    return fin[j];
  };
  let T = 0;
  for (let j = 0; j < filas.length; j++) T = Math.max(T, calc(j));
  return T;
}

/**
 * Costo directo mínimo para cada duración T (terminar en T o antes), probando TODAS las
 * combinaciones de duraciones enteras entre el límite y la normal. Devuelve Map T → costo.
 */
export function curvaPorEnumeracion(filas) {
  const n = filas.length;
  const dn = filas.map((f) => Number(f.dn));
  const dl = filas.map((f) => Number(f.dl));
  const cn = filas.map((f) => Number(f.cn));
  const cl = filas.map((f) => Number(f.cl));
  const costo = (j, x) => (dn[j] === dl[j] ? cn[j] : cn[j] + ((cl[j] - cn[j]) * (dn[j] - x)) / (dn[j] - dl[j]));
  const mejorExacto = new Map();
  const d = new Array(n).fill(0);
  const rec = (j, acum) => {
    if (j === n) {
      const T = duracionBruta(filas, d);
      if (!mejorExacto.has(T) || acum < mejorExacto.get(T)) mejorExacto.set(T, acum);
      return;
    }
    for (let x = dl[j]; x <= dn[j]; x++) { d[j] = x; rec(j + 1, acum + costo(j, x)); }
  };
  rec(0, 0);
  // costo mínimo para terminar en T o antes
  const Ts = [...mejorExacto.keys()].sort((a, b) => a - b);
  const curva = new Map();
  let corriente = Infinity;
  for (const T of Ts) {
    corriente = Math.min(corriente, mejorExacto.get(T));
    curva.set(T, corriente);
  }
  return { curva, Tmin: Ts[0], Tmax: Ts[Ts.length - 1] };
}

/**
 * Red en puente (A→C→E, A→D, B→E): la forma clásica donde el corte de costo mínimo
 * puede ALARGAR una actividad ya acortada. `cola` agrega actividades después del puente.
 */
export function puenteAleatorio(rng, cola = false) {
  const est = [['A', ''], ['B', ''], ['C', 'A'], ['D', 'A'], ['E', 'B,C']];
  if (cola) est.push(['F', 'D,E'], ['G', 'E']);
  return est.map(([name, preds]) => {
    const dn = rng.int(2, 8);
    const dl = Math.max(0, dn - rng.int(1, 4));
    const cn = rng.int(10, 50);
    return { name, preds, dn: String(dn), dl: String(dl), cn: String(cn), cl: String(cn + rng.int(0, 80)) };
  });
}
