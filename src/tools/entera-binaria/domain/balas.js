/**
 * Método aditivo de Balas (enumeración implícita), versión tipo Taha:
 * minimizar con costos ≥ 0 y restricciones ≤; se parte de todo en 0 y se fija en 1
 * la variable que más reduce la infactibilidad.
 */
import { EPS, MAX_VARS, validateModel } from './modelo.js';
import { sub, fmtNum } from './format.js';

/** Pasa el modelo a «minimizar con costos ≥ 0 y restricciones ≤». */
export function aFormaBalas(model) {
  const n = model.names.length;
  const signo = model.sense === 'min' ? 1 : -1;
  const cp = model.c.map((v) => signo * v);
  const A = [];
  const b = [];
  const origen = [];
  for (const r of model.constraints) {
    const neg = (a) => a.map((v) => -v);
    if (r.op === '<=') { A.push(r.a.slice()); b.push(r.b); origen.push(r.name); }
    else if (r.op === '>=') { A.push(neg(r.a)); b.push(-r.b); origen.push(r.name); }
    else {
      A.push(r.a.slice()); b.push(r.b); origen.push(r.name + ' (≤)');
      A.push(neg(r.a)); b.push(-r.b); origen.push(r.name + ' (≥)');
    }
  }
  const comp = Array(n).fill(false);
  const c = cp.slice();
  let K = 0;
  for (let j = 0; j < n; j++) {
    if (cp[j] < 0) {
      comp[j] = true;
      c[j] = -cp[j];
      K += cp[j];
      for (let i = 0; i < A.length; i++) {
        b[i] -= A[i][j];
        A[i][j] = -A[i][j];
      }
    }
  }
  const nombres = model.names.map((nm, j) => (comp[j] ? nm + '′' : nm));
  return { c, A, b, comp, K: K === 0 ? 0 : K, signo, nombres, origen };
}

/** Nombre visible de la variable transformada j (con subíndice y ′ si es complemento). */
export const nombreBalas = (transform, j) => {
  const base = transform.nombres[j].replace(/′$/, '');
  return sub(base) + (transform.comp[j] ? '′' : '');
};

export function balas(model, { maxNodes = 200000 } = {}) {
  const errores = validateModel(model);
  if (errores.length) throw new Error(errores[0].mensaje);
  const n = model.names.length;
  if (n > MAX_VARS) throw new Error(`El método aditivo admite hasta ${MAX_VARS} variables.`);

  const transform = aFormaBalas(model);
  const { c, A, b, comp, K, signo } = transform;
  const m = A.length;
  const nom = (j) => nombreBalas(transform, j);

  const trace = [];
  const incumbentHistory = [];
  let zStar = null;
  let yStar = null;
  let limite = false;

  const aOriginal = (y) => y.map((v, j) => (comp[j] ? 1 - v : v));
  const zOriginal = (zt) => {
    const v = signo * (K + zt);
    return v === 0 ? 0 : v;
  };

  /** Infactibilidad que quedaría con holguras s. */
  const infact = (s) => s.reduce((t, v) => (v < -EPS ? t - v : t), 0);

  function procesar(F1, F0, libres, parentId, rama) {
    if (trace.length >= maxNodes) { limite = true; return; }
    const id = trace.length + 1;
    let z = 0;
    for (const j of F1) z += c[j];
    const s = b.map((bi, i) => {
      let t = bi;
      for (const j of F1) t -= A[i][j];
      return t;
    });
    const I = infact(s);
    const reg = {
      id, parentId, rama, F1: F1.slice(), F0: F0.slice(), libres: libres.slice(),
      z, s, I, zStar, candidatas: [], Ij: {}, decision: null, branchVar: null, motivo: '',
    };
    trace.push(reg);

    // 1. ¿Ya no puede mejorar la mejor solución?
    if (zStar !== null && z >= zStar - EPS) {
      reg.decision = 'poda-cota';
      reg.motivo = `Z = ${fmtNum(z)} ya no mejora la mejor solución conocida (Z* = ${fmtNum(zStar)}).`;
      return;
    }
    // 2. ¿Es factible?
    if (s.every((v) => v >= -EPS)) {
      reg.decision = 'factible';
      const previa = zStar;
      zStar = z;
      const y = Array(n).fill(0);
      for (const j of F1) y[j] = 1;
      yStar = y;
      const xo = aOriginal(y);
      incumbentHistory.push({ nodeId: id, z: zOriginal(z), x: xo });
      reg.motivo = previa === null
        ? `Todas las holguras son no negativas: es factible, con Z = ${fmtNum(z)}.`
        : `Todas las holguras son no negativas: es factible, con Z = ${fmtNum(z)}; mejora Z* = ${fmtNum(previa)}.`;
      return;
    }
    // 3. Hay holguras negativas
    const cand = libres.filter((j) => zStar === null || z + c[j] < zStar - EPS);
    reg.candidatas = cand.slice();
    const falla = (grupo) => {
      for (let i = 0; i < m; i++) {
        if (s[i] < -EPS) {
          let alcance = s[i];
          for (const j of grupo) alcance -= Math.min(0, A[i][j]);
          if (alcance < -EPS) return i;
        }
      }
      return -1;
    };
    const f1 = falla(cand);
    if (f1 >= 0) {
      if (falla(libres) < 0) {
        reg.decision = 'poda-cota';
        reg.motivo = `Solo cumpliría las restricciones con variables que ya no mejoran Z* = ${fmtNum(zStar)}.`;
      } else {
        reg.decision = 'poda-infactible';
        reg.motivo = `Aunque se fijaran en 1 todas las variables libres que aún sirven, la restricción «${transform.origen[f1]}» no se cumpliría.`;
      }
      return;
    }
    let mejor = null;
    let mejorI = Infinity;
    for (const j of cand) {
      const Ij = infact(s.map((v, i) => v - A[i][j]));
      reg.Ij[j] = Ij;
      if (Ij < mejorI - EPS) { mejorI = Ij; mejor = j; }
    }
    reg.decision = 'ramifica';
    reg.branchVar = mejor;
    reg.motivo = `Se ramifica en ${nom(mejor)}: al fijarla en 1 la infactibilidad baja de ${fmtNum(I)} a ${fmtNum(mejorI)}, la menor entre las candidatas.`;
    const resto = libres.filter((j) => j !== mejor);
    procesar([...F1, mejor], F0, resto, id, { j: mejor, valor: 1 });
    if (limite) return;
    procesar(F1, [...F0, mejor], resto, id, { j: mejor, valor: 0 });
  }

  procesar([], [], Array.from({ length: n }, (_, j) => j), null, null);

  let status;
  let best = null;
  if (yStar) best = { z: zOriginal(zStar), x: aOriginal(yStar) };
  if (limite) status = 'limite';
  else status = yStar ? 'optimo' : 'infactible';
  return { status, best, trace, transform, incumbentHistory };
}
