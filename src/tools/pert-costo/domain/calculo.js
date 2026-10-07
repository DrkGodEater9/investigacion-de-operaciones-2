/** Método de la ruta crítica sobre actividades (actividad en el nodo), con duraciones enteras. */

/** Orden topológico de las actividades (índices). */
export function ordenTopologico(m) {
  const grado = m.preds.map((p) => p.length);
  const cola = [];
  for (let j = 0; j < m.n; j++) if (!grado[j]) cola.push(j);
  const orden = [];
  while (cola.length) {
    const v = cola.shift();
    orden.push(v);
    for (const w of m.succs[v]) if (--grado[w] === 0) cola.push(w);
  }
  return orden;
}

/** Tiempos de cada actividad para las duraciones d: es, ef, ls, lf, holgura total, T y críticas. */
export function tiempos(m, d, orden = ordenTopologico(m)) {
  const es = new Array(m.n).fill(0);
  const ef = new Array(m.n).fill(0);
  for (const j of orden) {
    es[j] = m.preds[j].length ? Math.max(...m.preds[j].map((i) => ef[i])) : 0;
    ef[j] = es[j] + d[j];
  }
  const T = m.n ? Math.max(...ef) : 0;
  const ls = new Array(m.n).fill(0);
  const lf = new Array(m.n).fill(0);
  for (let k = orden.length - 1; k >= 0; k--) {
    const j = orden[k];
    lf[j] = m.succs[j].length ? Math.min(...m.succs[j].map((s) => ls[s])) : T;
    ls[j] = lf[j] - d[j];
  }
  const holgura = es.map((_, j) => ls[j] - es[j]);
  return { es, ef, ls, lf, holgura, T, critica: holgura.map((h) => h === 0) };
}

/** Duración del proyecto con las duraciones d. */
export const duracionProyecto = (m, d) => tiempos(m, d).T;

/** Rutas críticas (listas de nombres), hasta `limite`. Una ruta es una cadena de actividades críticas pegadas. */
export function rutasCriticas(m, tm, limite = 200) {
  const rutas = [];
  let truncado = false;
  const camino = [];
  const sigue = (j) => m.succs[j].filter((s) => tm.critica[s] && tm.es[s] === tm.ef[j]);
  const crece = (j) => {
    if (rutas.length >= limite) { truncado = true; return; }
    camino.push(j);
    const sig = sigue(j);
    if (tm.ef[j] === tm.T && !sig.length) rutas.push(camino.map((x) => m.names[x]));
    else for (const s of sig) crece(s);
    camino.pop();
  };
  for (let j = 0; j < m.n; j++) {
    if (tm.critica[j] && tm.es[j] === 0 && !m.preds[j].some((i) => tm.critica[i] && tm.ef[i] === 0)) crece(j);
  }
  return { rutas, truncado };
}
