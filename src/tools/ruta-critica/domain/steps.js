import { fmt } from './format.js';

/** Pasos didácticos: pase hacia adelante (TIC), pase hacia atrás (TTL) y ruta crítica. */
export function buildSteps(net, layout, times, dur, decimals) {
  const f = (x) => fmt(x, decimals);
  const num = layout.number;
  const d = (e) => (e.kind === 'dummy' ? 0 : dur(e.act));
  const lab = (e) => (e.kind === 'dummy' ? 'ficticia' : e.act);
  const steps = [];
  for (const v of layout.numbered) {
    const ins = net.edges.filter((e) => e.to === v);
    let text;
    if (!ins.length) text = `Evento ${num[v]}: es el inicio del proyecto, su tiempo más temprano es 0.`;
    else {
      const terms = ins.map((e) => `${f(times.early[e.from])} + ${f(d(e))} (${lab(e)})`);
      text = ins.length === 1
        ? `Evento ${num[v]}: ${terms[0]} = ${f(times.early[v])}.`
        : `Evento ${num[v]}: máx[ ${terms.join(', ')} ] = ${f(times.early[v])}.`;
    }
    steps.push({ phase: 'forward', node: v, text });
  }
  for (const v of [...layout.numbered].reverse()) {
    const outs = net.edges.filter((e) => e.from === v);
    let text;
    if (!outs.length) text = `Evento ${num[v]}: es el final, su tiempo más tardío es igual a la duración del proyecto, ${f(times.T)}.`;
    else {
      const terms = outs.map((e) => `${f(times.late[e.to])} − ${f(d(e))} (${lab(e)})`);
      text = outs.length === 1
        ? `Evento ${num[v]}: ${terms[0]} = ${f(times.late[v])}.`
        : `Evento ${num[v]}: mín[ ${terms.join(', ')} ] = ${f(times.late[v])}.`;
    }
    steps.push({ phase: 'backward', node: v, text });
  }
  steps.push({ phase: 'critical', node: null, text: 'Las actividades con holgura 0 forman la ruta crítica (trazo grueso).' });
  return steps;
}
