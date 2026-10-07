/**
 * Red de actividades en el nodo (cada actividad es un bloque con predecesoras) y método de la ruta crítica.
 * Todo trabaja con índices: red.d[i], red.preds[i], red.succs[i], red.r[i][k].
 */

/** Modelo → red indexada. Supone un modelo válido (sin ciclos ni predecesoras inexistentes). */
export function compilar(modelo) {
  const n = modelo.acts.length;
  const idx = new Map(modelo.acts.map((a, i) => [a.name, i]));
  const preds = modelo.acts.map((a) => a.preds.map((p) => idx.get(p)));
  const succs = Array.from({ length: n }, () => []);
  preds.forEach((ps, i) => ps.forEach((p) => succs[p].push(i)));
  return {
    n,
    nombres: modelo.acts.map((a) => a.name),
    d: modelo.acts.map((a) => a.d),
    r: modelo.acts.map((a) => a.r.slice()),
    preds,
    succs,
    recursos: modelo.recursos.map((x) => x.name),
    limites: modelo.recursos.map((x) => x.limite),
    orden: ordenTopologico(n, preds),
  };
}

/** Orden topológico estable (entre las listas se respeta el orden de la tabla). */
export function ordenTopologico(n, preds) {
  const grado = preds.map((p) => p.length);
  const succ = Array.from({ length: n }, () => []);
  preds.forEach((ps, i) => ps.forEach((p) => succ[p].push(i)));
  const listos = [];
  for (let i = 0; i < n; i++) if (!grado[i]) listos.push(i);
  const out = [];
  while (listos.length) {
    listos.sort((a, b) => a - b);
    const v = listos.shift();
    out.push(v);
    for (const w of succ[v]) if (--grado[w] === 0) listos.push(w);
  }
  return out;
}

/**
 * Tiempos de cada actividad: ES (comienzo temprano), EF, LS (comienzo tardío), LF, H (holgura total).
 * T = duración del proyecto sin restricciones de recursos.
 */
export function cpm(red) {
  const { n, d, preds, succs, orden } = red;
  const ES = new Array(n).fill(0);
  const EF = new Array(n).fill(0);
  for (const i of orden) {
    ES[i] = preds[i].length ? Math.max(...preds[i].map((p) => EF[p])) : 0;
    EF[i] = ES[i] + d[i];
  }
  const T = n ? Math.max(...EF) : 0;
  const LS = new Array(n).fill(0);
  const LF = new Array(n).fill(0);
  for (const i of [...orden].reverse()) {
    LF[i] = succs[i].length ? Math.min(...succs[i].map((s) => LS[s])) : T;
    LS[i] = LF[i] - d[i];
  }
  const H = ES.map((_, i) => LS[i] - ES[i]);
  return { T, ES, EF, LS, LF, H, critica: H.map((h) => h === 0) };
}
