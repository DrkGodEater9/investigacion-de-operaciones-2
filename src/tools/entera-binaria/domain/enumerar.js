import { EPS } from './modelo.js';

export const MAX_ENUM = 20;

/**
 * Enumeración exhaustiva de las 2ⁿ combinaciones (x₁ es el bit más significativo).
 * Devuelve el óptimo (con todos los empates), el número de factibles y, si keepRows, todas las filas.
 */
export function enumerate(model, { keepRows } = {}) {
  const n = model.names.length;
  if (n > MAX_ENUM) {
    throw new Error('Con más de 20 variables hay más de un millón de combinaciones; usa el método aditivo.');
  }
  const total = 2 ** n;
  const guardar = keepRows === undefined ? n <= 12 : !!keepRows;
  const cons = model.constraints;
  const m = cons.length;
  const x = new Array(n).fill(0); // buffer reutilizado
  const rows = guardar ? [] : null;
  const max = model.sense === 'max';
  let feasibleCount = 0;
  let bestZ = null;
  let sols = [];

  for (let mask = 0; mask < total; mask++) {
    for (let j = 0; j < n; j++) x[j] = (mask >> (n - 1 - j)) & 1;
    let z = 0;
    for (let j = 0; j < n; j++) if (x[j]) z += model.c[j];
    let feasible = true;
    let lhs = null;
    let satisfied = null;
    if (guardar) { lhs = new Array(m); satisfied = new Array(m); }
    for (let i = 0; i < m; i++) {
      const r = cons[i];
      let s = 0;
      for (let j = 0; j < n; j++) if (x[j]) s += r.a[j];
      const ok = r.op === '<=' ? s <= r.b + EPS : r.op === '>=' ? s >= r.b - EPS : Math.abs(s - r.b) <= EPS;
      if (!ok) feasible = false;
      if (guardar) { lhs[i] = s; satisfied[i] = ok; }
    }
    if (guardar) rows.push({ x: x.slice(), z, lhs, satisfied, feasible });
    if (!feasible) continue;
    feasibleCount += 1;
    if (bestZ === null || (max ? z > bestZ + EPS : z < bestZ - EPS)) {
      bestZ = z;
      sols = [x.slice()];
    } else if (Math.abs(z - bestZ) <= EPS) {
      sols.push(x.slice());
    }
  }
  return {
    n,
    total,
    feasibleCount,
    status: feasibleCount > 0 ? 'optimo' : 'infactible',
    best: feasibleCount > 0 ? { z: bestZ, solutions: sols } : null,
    rows,
  };
}
