// Comprobación de una red AOA contra la tabla de actividades y predecesoras (tema 3.1).
// Es un cálculo independiente de buildNetwork: parte del grafo de la red y de la tabla, no del constructor.
import { topoNodes } from './network.js';

/** Predecesoras totales (cierre transitivo) de cada actividad de la tabla. Devuelve Map nombre -> Set. */
export function cierrePredecesoras(acts) {
  const byName = new Map(acts.map((a) => [a.name, a]));
  const memo = new Map();
  const visit = (nm) => {
    if (memo.has(nm)) return memo.get(nm);
    const s = new Set();
    memo.set(nm, s);
    for (const p of byName.get(nm).preds) {
      s.add(p);
      for (const x of visit(p)) s.add(x);
    }
    return s;
  };
  acts.forEach((a) => visit(a.name));
  return memo;
}

/** Actividades que deben haber terminado para llegar a cada evento (siguiendo flechas y ficticias). */
export function alcanceEventos(net) {
  const reach = new Map(net.nodes.map((v) => [v, new Set()]));
  for (const v of topoNodes(net)) {
    for (const e of net.edges) {
      if (e.from !== v) continue;
      const dst = reach.get(e.to);
      for (const x of reach.get(v)) dst.add(x);
      if (e.kind === 'activity') dst.add(e.act);
    }
  }
  return reach;
}

export const nombresOrdenados = (set) => [...set].sort();

/**
 * Compara lo que la red obliga a esperar a cada actividad con lo que pide la tabla.
 * Devuelve { ok, dependencias: [{act, falta, sobra}], estructura: [mensaje] }.
 */
export function verificarRed(acts, net) {
  const estructura = [];
  const topo = topoNodes(net);
  if (topo.length !== net.nodes.length) estructura.push('La red tiene un ciclo.');
  const sinEntrada = net.nodes.filter((v) => !net.edges.some((e) => e.to === v));
  const sinSalida = net.nodes.filter((v) => !net.edges.some((e) => e.from === v));
  if (sinEntrada.length !== 1) estructura.push(`Hay ${sinEntrada.length} eventos de inicio (debe haber uno).`);
  if (sinSalida.length !== 1) estructura.push(`Hay ${sinSalida.length} eventos de fin (debe haber uno).`);
  const par = new Set();
  for (const e of net.edges) {
    const k = e.from + '>' + e.to;
    if (par.has(k)) estructura.push('Dos flechas comparten el mismo par de eventos.');
    par.add(k);
  }
  const cierre = cierrePredecesoras(acts);
  const reach = alcanceEventos(net);
  const dependencias = [];
  for (const a of acts) {
    const edge = net.edges.find((e) => e.kind === 'activity' && e.act === a.name);
    if (!edge) { dependencias.push({ act: a.name, falta: nombresOrdenados(cierre.get(a.name)), sobra: [] }); continue; }
    const got = reach.get(edge.from);
    const want = cierre.get(a.name);
    const falta = [...want].filter((x) => !got.has(x));
    const sobra = [...got].filter((x) => !want.has(x));
    if (falta.length || sobra.length) dependencias.push({ act: a.name, falta: falta.sort(), sobra: sobra.sort() });
  }
  const repetidas = acts.filter((a) => net.edges.filter((e) => e.kind === 'activity' && e.act === a.name).length > 1);
  repetidas.forEach((a) => estructura.push(`La actividad ${a.name} aparece más de una vez.`));
  return { ok: !estructura.length && !dependencias.length, dependencias, estructura };
}

export const contarFicticias = (net) => net.edges.filter((e) => e.kind === 'dummy').length;

/** Actividades sin sucesoras en la tabla (llegan al evento final) y sin predecesoras (salen del inicial). */
export function extremosTabla(acts) {
  const conSucesora = new Set(acts.flatMap((a) => a.preds));
  return {
    iniciales: acts.filter((a) => !a.preds.length).map((a) => a.name),
    finales: acts.filter((a) => !conSucesora.has(a.name)).map((a) => a.name),
  };
}

/** ¿La red se arma sin ninguna ficticia? (criterio independiente: cada actividad con sucesoras tiene todas sus
 *  sucesoras con el mismo conjunto de predecesoras reducido, y no hay paralelas al final). */
export function sinFicticiasNecesarias(acts) {
  const cierre = cierrePredecesoras(acts);
  const red = acts.map((a) => ({
    name: a.name,
    preds: a.preds.filter((p) => !a.preds.some((q) => q !== p && cierre.get(q).has(p))),
  }));
  const key = (a) => [...a.preds].sort().join(',');
  for (const a of red) {
    const sucs = red.filter((b) => b.preds.includes(a.name));
    if (sucs.length > 1 && new Set(sucs.map(key)).size > 1) return false;
  }
  // actividades con el mismo extremo inicial y final (mismo conjunto de predecesoras y mismos sucesores o ambas finales)
  const grupos = new Map();
  for (const a of red) {
    const sucs = red.filter((b) => b.preds.includes(a.name)).map(key);
    const k = key(a) + '|' + (sucs.length ? sucs[0] : 'FIN');
    grupos.set(k, (grupos.get(k) || 0) + 1);
  }
  return ![...grupos.values()].some((c) => c > 1);
}

/**
 * Mínimo de ficticias entre TODAS las redes posibles (búsqueda exhaustiva sobre grafos, para tablas pequeñas).
 * Se construyen los eventos en orden: cada actividad sale de un evento donde ya terminaron exactamente sus
 * predecesoras totales. Un evento distinto del inicial siempre tiene algo terminado. Devuelve el menor número
 * de ficticias que no supere `tope`, o Infinity si con `tope` no alcanza.
 */
export function minimoFicticiasExacto(acts, tope) {
  const n = acts.length;
  const idx = new Map(acts.map((a, i) => [a.name, i]));
  const cierre = cierrePredecesoras(acts);
  const F = acts.map((a) => [...cierre.get(a.name)].reduce((m, x) => m | (1 << idx.get(x)), 0));
  const full = (1 << n) - 1;
  for (let d = 0; d <= tope; d++) {
    const m = n + d + 1;
    const reach = [0];
    const outdeg = [0];
    const dfs = (v, usadas, dRest) => {
      if (usadas === full) {
        const k = reach.length;
        let sin = 0;
        let ultimo = -1;
        for (let u = 0; u < k; u++) if (!outdeg[u]) { sin++; ultimo = u; }
        if (sin === 1 && ultimo === k - 1 && reach[k - 1] === full) return true;
      }
      if (v >= m) return false;
      const cand = [];
      for (let a = 0; a < n; a++) {
        if (usadas & (1 << a)) continue;
        for (let u = 0; u < v; u++) if (reach[u] === F[a]) cand.push([a, u]);
      }
      const sel = [];
      let dummyIn = 0;
      const fict = (u, usadasLoc, origenes, dr) => {
        if (u === v) {
          let r = 0;
          const entradas = [];
          for (const [a, uu] of sel) { r |= reach[uu] | (1 << a); entradas.push(uu); }
          for (let w = 0; w < v; w++) if (dummyIn & (1 << w)) { r |= reach[w]; entradas.push(w); }
          if (!entradas.length || r === 0) return false;
          const previos = entradas.map((w) => [w, outdeg[w]]);
          entradas.forEach((w) => { outdeg[w]++; });
          reach.push(r);
          outdeg.push(0);
          const ok = dfs(v + 1, usadasLoc, dr);
          reach.pop();
          outdeg.pop();
          previos.forEach(([w, x]) => { outdeg[w] = x; });
          return ok;
        }
        if (dr > 0 && !(origenes & (1 << u))) {
          dummyIn |= 1 << u;
          const ok = fict(u + 1, usadasLoc, origenes, dr - 1);
          dummyIn &= ~(1 << u);
          if (ok) return true;
        }
        return fict(u + 1, usadasLoc, origenes, dr);
      };
      const eleg = (i, usadasLoc, origenes) => {
        if (i === cand.length) return fict(0, usadasLoc, origenes, dRest);
        const [a, u] = cand[i];
        if (!(usadasLoc & (1 << a)) && !(origenes & (1 << u))) {
          sel.push([a, u]);
          if (eleg(i + 1, usadasLoc | (1 << a), origenes | (1 << u))) return true;
          sel.pop();
        }
        return eleg(i + 1, usadasLoc, origenes);
      };
      return eleg(0, usadas, 0);
    };
    if (dfs(1, 0, d)) return d;
  }
  return Infinity;
}
