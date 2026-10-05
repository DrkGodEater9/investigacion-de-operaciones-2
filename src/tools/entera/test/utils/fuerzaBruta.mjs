/**
 * Fuerza bruta INDEPENDIENTE para programación entera mixta pequeña.
 * No usa simplex, ni solveLP, ni solveIP, ni el tablero: enumera todas las
 * asignaciones enteras 0..cota para las variables enteras y, con ellas fijas,
 * optimiza las continuas enumerando vértices (combinaciones de restricciones
 * activas, incluidas y ≥ 0) con Fraction y eliminación de Gauss.
 * Supone que el modelo está acotado (p. ej. x1+…+xn ≤ cota).
 */
import { frac, ZERO } from '../../domain/fraction.js';

function resolverGauss(M, rhs) {
  const n = M.length;
  const A = M.map((f, i) => [...f, rhs[i]]);
  for (let col = 0; col < n; col++) {
    let p = -1;
    for (let r = col; r < n; r++) if (!A[r][col].isZero()) { p = r; break; }
    if (p < 0) return null;
    [A[col], A[p]] = [A[p], A[col]];
    const piv = A[col][col];
    A[col] = A[col].map((v) => v.div(piv));
    for (let r = 0; r < n; r++) {
      if (r === col || A[r][col].isZero()) continue;
      const f = A[r][col];
      A[r] = A[r].map((v, j) => v.sub(f.mul(A[col][j])));
    }
  }
  return A.map((f) => f[n]);
}

function combinaciones(total, k, cb, ini = 0, act = []) {
  if (act.length === k) { cb(act); return; }
  for (let i = ini; i < total; i++) {
    act.push(i);
    combinaciones(total, k, cb, i + 1, act);
    act.pop();
  }
}

function cumple(v, op, b) {
  const c = v.cmp(b);
  return op === '<=' ? c <= 0 : op === '>=' ? c >= 0 : c === 0;
}

export function fuerzaBruta(modelo, { cota = 20 } = {}) {
  const n = modelo.c.length;
  const esMax = modelo.sense === 'max';
  const c = modelo.c.map((v) => frac(v));
  const rest = modelo.constraints.map((r) => ({ a: r.a.map((v) => frac(v)), op: r.op, b: frac(r.b) }));
  const ent = [], con = [];
  for (let j = 0; j < n; j++) (modelo.integer[j] ? ent : con).push(j);
  const nc = con.length;

  let mejor = null;
  const puntos = []; // mejor punto por asignación entera (todos factibles)
  const z = Array(ent.length).fill(0);

  const resolverContinuas = () => {
    // Semiplanos en el espacio continuo
    const hp = [];
    for (const r of rest) {
      let b = r.b;
      ent.forEach((j, i) => { b = b.sub(r.a[j].mul(z[i])); });
      hp.push({ a: con.map((j) => r.a[j]), op: r.op, b });
    }
    for (let q = 0; q < nc; q++) {
      hp.push({ a: con.map((_, i) => frac(i === q ? 1 : 0)), op: '>=', b: ZERO });
    }
    let mejorLocal = null;
    combinaciones(hp.length, nc, (idx) => {
      const y = resolverGauss(idx.map((i) => hp[i].a), idx.map((i) => hp[i].b));
      if (!y) return;
      for (const h of hp) {
        let s = ZERO;
        h.a.forEach((v, i) => { s = s.add(v.mul(y[i])); });
        if (!cumple(s, h.op, h.b)) return;
      }
      let val = ZERO;
      ent.forEach((j, i) => { val = val.add(c[j].mul(z[i])); });
      con.forEach((j, i) => { val = val.add(c[j].mul(y[i])); });
      if (!mejorLocal || (esMax ? val.gt(mejorLocal.z) : val.lt(mejorLocal.z))) {
        const x = Array(n).fill(ZERO);
        ent.forEach((j, i) => { x[j] = frac(z[i]); });
        con.forEach((j, i) => { x[j] = y[i]; });
        mejorLocal = { z: val, x };
      }
    });
    return mejorLocal;
  };

  const enumerar = (pos) => {
    if (pos === ent.length) {
      const r = resolverContinuas();
      if (r) {
        puntos.push(r);
        if (!mejor || (esMax ? r.z.gt(mejor.z) : r.z.lt(mejor.z))) mejor = r;
      }
      return;
    }
    for (let v = 0; v <= cota; v++) { z[pos] = v; enumerar(pos + 1); }
  };
  enumerar(0);

  return mejor
    ? { estado: 'optimo', z: mejor.z, x: mejor.x, puntos }
    : { estado: 'infactible', z: null, x: null, puntos: [] };
}
