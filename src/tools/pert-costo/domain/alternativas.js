/**
 * Conjuntos de actividades que cortan TODAS las rutas críticas (una actividad por ruta, como mínimo).
 * Sirve para explicar el paso y para comprobar el primer corte: sin actividades ya acortadas,
 * el corte de costo mínimo es el conjunto de menor costo entre estos.
 */
import { tiempos, rutasCriticas } from './calculo.js';

const MAX_REDUCIBLES = 14;

/**
 * Devuelve { cortes: [{ actividades: nombres[], costo }] ordenados por costo (solo los minimales), o null si no aplica
 * (demasiadas actividades críticas o rutas truncadas).
 */
export function cortesPosibles(m, d, limite = 6) {
  const tm = tiempos(m, d);
  const { rutas, truncado } = rutasCriticas(m, tm);
  if (truncado) return null;
  const idx = new Map(m.names.map((n, j) => [n, j]));
  const red = [];
  for (let j = 0; j < m.n; j++) if (tm.critica[j] && m.pend[j] != null && d[j] > m.dl[j]) red.push(j);
  if (red.length > MAX_REDUCIBLES) return null;
  const rutasIdx = rutas.map((r) => new Set(r.map((n) => idx.get(n))));
  const cubre = (mask) => rutasIdx.every((r) => red.some((j, k) => (mask >> k) & 1 && r.has(j)));
  const cortes = [];
  for (let mask = 1; mask < 2 ** red.length; mask++) {
    if (!cubre(mask)) continue;
    let minimal = true;
    for (let k = 0; k < red.length && minimal; k++) if ((mask >> k) & 1 && cubre(mask & ~(1 << k))) minimal = false;
    if (!minimal) continue;
    const act = red.filter((_, k) => (mask >> k) & 1);
    cortes.push({ actividades: act.map((j) => m.names[j]), costo: act.reduce((s, j) => s + m.pend[j], 0) });
  }
  cortes.sort((a, b) => a.costo - b.costo || a.actividades.length - b.actividades.length || a.actividades.join().localeCompare(b.actividades.join()));
  return { cortes: cortes.slice(0, limite), total: cortes.length, rutas: rutas.length };
}
