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

  const edgeInfo = {};
  for (const e of net.edges) {
    const dd = d(e);
    const tic = early[e.from];
    const tfc = tic + dd;
    const tfl = late[e.to];
    const til = tfl - dd;
    const ht = til - tic;
    const hl = early[e.to] - tfc;
    edgeInfo[e.id] = { d: dd, tic, tfc, til, tfl, ht, hl, critical: isZero(ht) };
  }
  return { early, late, T, edgeInfo };
}
