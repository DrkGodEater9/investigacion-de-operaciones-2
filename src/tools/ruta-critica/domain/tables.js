import { fmt } from './format.js';

/** Filas de las tablas de resultados; las usan la interfaz y el PDF. */
export function timesTable(analysis) {
  const { net, layout, times, activities, decimals, mode } = analysis;
  const n = layout.number;
  const f = (x) => fmt(x, decimals);
  const edgeOf = new Map(net.edges.filter((e) => e.kind === 'activity').map((e) => [e.act, e]));
  const headers = times
    ? ['Actividad', 'Predecesoras', 'Evento (i, j)', mode === 'pert' ? 't esperado' : 'Duración', 'TIC', 'TFC', 'TIL', 'TFL', 'Holgura total', 'Holgura libre', 'Crítica']
    : ['Actividad', 'Predecesoras', 'Evento (i, j)'];
  const critical = [];
  const rows = activities.map((a) => {
    const e = edgeOf.get(a.name);
    const base = [a.name, a.preds.join(', ') || '-', `(${n[e.from]}, ${n[e.to]})`];
    if (!times) { critical.push(false); return base; }
    const x = times.edgeInfo[e.id];
    critical.push(x.critical);
    return [...base, f(x.d), f(x.tic), f(x.tfc), f(x.til), f(x.tfl), f(x.ht), f(x.hl), x.critical ? 'Sí' : 'No'];
  });
  return { headers, rows, critical };
}

export function eventsTable(analysis) {
  const { net, layout, times, decimals } = analysis;
  const n = layout.number;
  const label = (e) => (e.kind === 'dummy' ? e.label : e.act);
  const headers = times ? ['Evento', 'Llegan', 'Salen', 'Tiempo más temprano', 'Tiempo más tardío', 'Holgura del evento'] : ['Evento', 'Llegan', 'Salen'];
  const critical = [];
  const rows = layout.numbered.map((v) => {
    const inc = net.edges.filter((e) => e.to === v).map(label).join(', ') || '(inicio)';
    const out = net.edges.filter((e) => e.from === v).map(label).join(', ') || '(fin)';
    const base = [String(n[v]), inc, out];
    if (!times) { critical.push(false); return base; }
    const slack = times.late[v] - times.early[v];
    critical.push(Math.abs(slack) < 1e-7);
    return [...base, fmt(times.early[v], decimals), fmt(times.late[v], decimals), fmt(slack, decimals)];
  });
  return { headers, rows, critical };
}

export function pertTable(analysis, criticalActs = new Set()) {
  const { activities, decimals } = analysis;
  const f = (x) => fmt(x, decimals);
  const headers = ['Actividad', 'Predecesoras', 'a', 'm', 'b', 'te = (a+4m+b)/6', 'σ² = ((b−a)/6)²', 'σ'];
  const rows = activities.map((a) => [a.name, a.preds.join(', ') || '-', f(a.a), f(a.m), f(a.b), f(a.te), fmt(a.var, 4), fmt(Math.sqrt(a.var), 4)]);
  return { headers, rows, critical: activities.map((a) => criticalActs.has(a.name)) };
}
