/** Predecesoras directas (sin las implícitas por transitividad) de cada actividad: Map nombre → Set. */
export function predecesorasDirectas(acts) {
  const por = new Map(acts.map((a) => [a.name, new Set(a.preds)]));
  const anc = new Map();
  const visita = (n) => {
    if (anc.has(n)) return anc.get(n);
    const s = new Set();
    anc.set(n, s);
    for (const p of por.get(n)) { s.add(p); visita(p).forEach((x) => s.add(x)); }
    return s;
  };
  acts.forEach((a) => visita(a.name));
  return new Map(acts.map((a) => [a.name, new Set([...por.get(a.name)].filter((p) => ![...por.get(a.name)].some((q) => q !== p && anc.get(q).has(p))))]));
}

/**
 * Enumera rutas de inicio a fin. edgeOk filtra aristas (p. ej. solo críticas).
 * directos (opcional): con ficticias, un camino de la red puede «saltarse» una actividad intermedia
 * (p. ej. C → ficticia → ficticia → F aunque F espera a E, que espera a C). Con esta tabla de predecesoras directas
 * solo se admiten rutas en las que cada actividad sigue a una predecesora directa de la tabla.
 */
export function enumerateRoutes(net, { dur, edgeOk = () => true, limit = 3000, directos = null } = {}) {
  const out = new Map(net.nodes.map((v) => [v, []]));
  net.edges.forEach((e) => { if (edgeOk(e)) out.get(e.from).push(e); });
  const routes = [];
  const porActs = new Map(); // una ruta es una secuencia de actividades: dos caminos que difieren solo en ficticias son la misma ruta
  let truncated = false;
  const path = [];
  const walk = (v, last) => {
    if (routes.length >= limit) { truncated = true; return; }
    if (v === net.end) {
      const acts = path.filter((e) => e.kind === 'activity').map((e) => e.act);
      const length = dur ? path.reduce((s, e) => s + (e.kind === 'dummy' ? 0 : dur(e.act)), 0) : null;
      const clave = acts.join('>');
      const previa = porActs.get(clave);
      if (previa) {
        path.forEach((e) => { if (!previa.edges.includes(e.id)) previa.edges.push(e.id); });
        return;
      }
      const ruta = { edges: path.map((e) => e.id), acts, length };
      porActs.set(clave, ruta);
      routes.push(ruta);
      return;
    }
    for (const e of out.get(v)) {
      if (directos && e.kind === 'activity' && last && !directos.get(e.act).has(last)) continue;
      path.push(e);
      walk(e.to, e.kind === 'activity' ? e.act : last);
      path.pop();
      if (truncated) return;
    }
  };
  walk(net.start, null);
  if (dur) routes.sort((x, y) => y.length - x.length);
  return { routes, truncated };
}
