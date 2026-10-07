/**
 * Análisis del tiempo calculado directamente sobre la tabla de actividades (sin dibujar la red):
 * TIC, TFC, TIL, TFL, holguras y rutas críticas. Funciones puras.
 *
 * acts: [{ name, preds: [nombres] }]; dur(nombre) → duración (CPM) o tiempo esperado (PERT).
 * Las actividades ficticias no existen aquí: son solo un recurso del dibujo.
 */
const EPS = 1e-9;
const igual = (x, y) => Math.abs(x - y) < EPS;

/** Orden topológico estable (por posición en la tabla). */
export function ordenTopologico(acts) {
  const byName = new Map(acts.map((a) => [a.name, a]));
  const visto = new Set();
  const orden = [];
  const visita = (n) => {
    if (visto.has(n)) return;
    visto.add(n);
    byName.get(n).preds.forEach(visita);
    orden.push(n);
  };
  acts.forEach((a) => visita(a.name));
  return orden;
}

export function calcularTiempos(acts, dur) {
  const orden = ordenTopologico(acts);
  const sucs = new Map(acts.map((a) => [a.name, []]));
  acts.forEach((a) => a.preds.forEach((p) => sucs.get(p).push(a.name)));
  const byName = new Map(acts.map((a) => [a.name, a]));
  const f = {};
  for (const n of orden) {
    const d = dur(n);
    const ps = byName.get(n).preds;
    const tic = ps.length ? Math.max(...ps.map((p) => f[p].tfc)) : 0;
    f[n] = { name: n, d, preds: ps, sucs: sucs.get(n), tic, tfc: tic + d };
  }
  const T = Math.max(...orden.map((n) => f[n].tfc));
  for (const n of [...orden].reverse()) {
    const s = f[n].sucs;
    f[n].tfl = s.length ? Math.min(...s.map((x) => f[x].til)) : T;
    f[n].til = f[n].tfl - f[n].d;
  }
  for (const n of orden) {
    const x = f[n];
    x.ht = x.til - x.tic;
    x.hl = (x.sucs.length ? Math.min(...x.sucs.map((s) => f[s].tic)) : T) - x.tfc;
    x.critica = Math.abs(x.ht) < EPS;
  }
  const criticas = orden.filter((n) => f[n].critica);
  // Rutas críticas: cadenas de actividades críticas donde cada una empieza justo cuando termina la anterior.
  const rutas = [];
  const camino = [];
  const anda = (n) => {
    camino.push(n);
    const sig = f[n].sucs.filter((s) => f[s].critica && igual(f[n].tfc, f[s].tic));
    if (!sig.length && igual(f[n].tfc, T)) rutas.push([...camino]);
    sig.forEach(anda);
    camino.pop();
  };
  criticas.filter((n) => f[n].preds.length === 0 && igual(f[n].tic, 0)).forEach(anda);
  return { orden, fila: f, T, criticas, rutasCriticas: rutas };
}

/** Variables PERT de una actividad. */
export const tiempoEsperado = (a, m, b) => (a + 4 * m + b) / 6;
export const varianzaAct = (a, b) => ((b - a) / 6) ** 2;

/**
 * PERT: acts con a, m, b. Con varias rutas críticas se toma la de mayor varianza
 * (criterio de «Resuelve el tuyo»); `empate` avisa si hay rutas con la misma varianza máxima pero distintas.
 */
export function calcularPERT(acts) {
  const por = new Map(acts.map((a) => [a.name, { te: tiempoEsperado(a.a, a.m, a.b), v: varianzaAct(a.a, a.b) }]));
  const t = calcularTiempos(acts, (n) => por.get(n).te);
  const opciones = t.rutasCriticas.map((r) => ({ ruta: r, varianza: r.reduce((s, n) => s + por.get(n).v, 0) }));
  const mejor = opciones.reduce((m, o) => (!m || o.varianza > m.varianza + EPS ? o : m), null);
  const empate = opciones.filter((o) => igual(o.varianza, mejor.varianza)).length > 1;
  return {
    ...t,
    por,
    opciones,
    ruta: mejor.ruta,
    varianza: mejor.varianza,
    sd: Math.sqrt(mejor.varianza),
    Te: t.T,
    unicaRuta: t.rutasCriticas.length === 1,
    empate,
  };
}
