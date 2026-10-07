import { isZero } from './format.js';

/**
 * Tiempos de eventos y de actividades (método de la ruta crítica).
 * order: eventos en orden topológico; dur(nombre) → duración.
 */
export function computeTimes(net, order, dur) {
  const d = (e) => (e.kind === 'dummy' ? 0 : dur(e.act));
  const inc = new Map(net.nodes.map((v) => [v, []]));
  const out = new Map(net.nodes.map((v) => [v, []]));
  net.edges.forEach((e) => { inc.get(e.to).push(e); out.get(e.from).push(e); });

  const early = {};
  for (const v of order) {
    const ins = inc.get(v);
    early[v] = ins.length ? Math.max(...ins.map((e) => early[e.from] + d(e))) : 0;
  }
  const T = early[net.end];
  const late = {};
  for (const v of [...order].reverse()) {
    const outs = out.get(v);
    late[v] = outs.length ? Math.min(...outs.map((e) => late[e.to] - d(e))) : T;
  }

  // Holgura libre = mín TIC de las actividades sucesoras − TFC (T si no hay sucesoras). En una red con ficticias,
  // las sucesoras de una flecha son las actividades que salen de su evento final o de los eventos a los que se
  // llega desde él solo por ficticias. Usar el tiempo del evento j (early[j] − TFC) subestima la holgura cuando
  // j solo tiene ficticias de salida y otra actividad más larga llega al evento donde sí empiezan las sucesoras.
  const sucTic = {};
  const primerTic = (v) => {
    if (sucTic[v] !== undefined) return sucTic[v];
    const outs = out.get(v);
    if (!outs.length) return (sucTic[v] = T);
    let m = Infinity;
    for (const e of outs) m = Math.min(m, e.kind === 'dummy' ? primerTic(e.to) : early[v]);
    return (sucTic[v] = m);
  };
  const edgeInfo = {};
  for (const e of net.edges) {
    const dd = d(e);
    const tic = early[e.from];
    const tfc = tic + dd;
    const tfl = late[e.to];
    const til = tfl - dd;
    const ht = til - tic;
    const hl = primerTic(e.to) - tfc;
    edgeInfo[e.id] = { d: dd, tic, tfc, til, tfl, ht, hl, critical: isZero(ht) };
  }
  return { early, late, T, edgeInfo };
}
