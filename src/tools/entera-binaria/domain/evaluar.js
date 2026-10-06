import { EPS } from './modelo.js';

/** Evalúa una combinación x (arreglo de 0/1) en el modelo. */
export function evaluate(model, x) {
  const n = model.names.length;
  let z = 0;
  for (let j = 0; j < n; j++) z += model.c[j] * x[j];
  const lhs = [];
  const satisfied = [];
  const violation = [];
  let violationTotal = 0;
  for (const r of model.constraints) {
    let s = 0;
    for (let j = 0; j < n; j++) s += r.a[j] * x[j];
    let v;
    if (r.op === '<=') v = Math.max(0, s - r.b);
    else if (r.op === '>=') v = Math.max(0, r.b - s);
    else v = Math.abs(s - r.b);
    if (v <= EPS) v = 0;
    lhs.push(s);
    satisfied.push(v === 0);
    violation.push(v);
    violationTotal += v;
  }
  return { z, lhs, satisfied, feasible: violationTotal === 0, violation, violationTotal };
}
