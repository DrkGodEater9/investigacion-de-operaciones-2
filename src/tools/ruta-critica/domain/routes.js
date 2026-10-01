/** Enumera rutas de inicio a fin. edgeOk filtra aristas (p. ej. solo críticas). */
export function enumerateRoutes(net, { dur, edgeOk = () => true, limit = 3000 } = {}) {
  const out = new Map(net.nodes.map((v) => [v, []]));
  net.edges.forEach((e) => { if (edgeOk(e)) out.get(e.from).push(e); });
  const routes = [];
  let truncated = false;
  const path = [];
  const walk = (v) => {
    if (routes.length >= limit) { truncated = true; return; }
    if (v === net.end) {
      const acts = path.filter((e) => e.kind === 'activity').map((e) => e.act);
      const length = dur ? path.reduce((s, e) => s + (e.kind === 'dummy' ? 0 : dur(e.act)), 0) : null;
      routes.push({ edges: path.map((e) => e.id), acts, length });
      return;
    }
    for (const e of out.get(v)) {
      path.push(e);
      walk(e.to);
      path.pop();
      if (truncated) return;
    }
  };
  walk(net.start);
  if (dur) routes.sort((x, y) => y.length - x.length);
  return { routes, truncated };
}
