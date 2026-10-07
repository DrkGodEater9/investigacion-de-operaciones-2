/**
 * Construye una red AOA (actividad en la flecha) a partir de actividades con predecesoras.
 *
 * Idea: cada evento (nodo) representa "terminó exactamente este conjunto de actividades".
 *  1. Se eliminan predecesoras redundantes (reducción transitiva).
 *  2. Cada conjunto distinto de predecesoras es un evento de inicio; el evento final agrupa
 *     las actividades sin sucesoras.
 *  3. Cada actividad termina en el evento más pequeño que la contiene (intersección de todos
 *     los conjuntos donde aparece); si esa intersección no existe se crea un evento auxiliar.
 *  4. Un evento recibe ficticias solo desde eventos cuyo conjunto está contenido en el suyo,
 *     eligiendo el mínimo de ficticias que cubra el conjunto.
 *  5. Se eliminan ficticias redundantes, se fusionan eventos sobrantes y se separan
 *     actividades paralelas (mismo inicio y fin) con una ficticia.
 * Todas las flechas quedan hacia adelante (la red es acíclica) y no hay ficticias de ida y vuelta.
 */
export function buildNetwork(acts) {
  const n = acts.length;
  const names = acts.map((a) => a.name);
  const idx = new Map(names.map((nm, i) => [nm, i]));
  const preds = acts.map((a) => [...new Set(a.preds.map((p) => idx.get(p)))]);

  const order = topoActivities(n, preds);
  const anc = Array.from({ length: n }, () => new Set());
  for (const i of order) for (const p of preds[i]) {
    anc[i].add(p);
    for (const x of anc[p]) anc[i].add(x);
  }

  const notes = [];
  const rpreds = preds.map((ps, i) =>
    ps.filter((p) => {
      const via = ps.find((q) => q !== p && anc[q].has(p));
      if (via !== undefined) {
        notes.push({ activity: names[i], removed: names[p], via: names[via] });
        return false;
      }
      return true;
    }),
  );

  const hasSucc = new Array(n).fill(false);
  rpreds.forEach((ps) => ps.forEach((p) => { hasSucc[p] = true; }));

  const key = (s) => [...s].sort((a, b) => a - b).join(',');
  const sets = new Map();
  const addSet = (s) => {
    const k = key(s);
    if (sets.has(k)) return false;
    sets.set(k, new Set(s));
    return true;
  };
  // Un evento se identifica por todas las actividades que deben haber terminado (las predecesoras y las de ellas),
  // así dos conjuntos de predecesoras equivalentes caen en el mismo evento.
  const close = (ps) => {
    const s = new Set(ps);
    ps.forEach((p) => anc[p].forEach((x) => s.add(x)));
    return s;
  };
  rpreds.forEach((ps) => { if (ps.length) addSet(close(ps)); });
  const terminal = [];
  for (let i = 0; i < n; i++) if (!hasSucc[i]) terminal.push(i);
  const endSet = close(terminal);
  const endKey = key(endSet);
  addSet(endSet);

  const home = new Array(n);
  let changed = true;
  while (changed) {
    changed = false;
    for (let a = 0; a < n; a++) {
      let inter = null;
      for (const s of sets.values()) {
        if (!s.has(a)) continue;
        if (!inter) inter = new Set(s);
        else for (const x of [...inter]) if (!s.has(x)) inter.delete(x);
      }
      if (addSet(inter)) changed = true;
      home[a] = key(inter);
    }
  }

  // --- Grafo inicial -----------------------------------------------------------
  let nodeSeq = 0;
  const START = 'n' + nodeSeq++;
  const nodeOf = new Map();
  for (const k of sets.keys()) nodeOf.set(k, 'n' + nodeSeq++);
  let END = nodeOf.get(endKey);

  let edgeSeq = 0;
  let edges = [];
  for (let a = 0; a < n; a++) {
    edges.push({
      id: 'a' + edgeSeq++,
      kind: 'activity',
      act: names[a],
      from: rpreds[a].length ? nodeOf.get(key(close(rpreds[a]))) : START,
      to: nodeOf.get(home[a]),
    });
  }

  const isSubset = (A, B) => A.size < B.size && [...A].every((x) => B.has(x));
  for (const [tk, T] of sets) {
    const covered = new Set();
    for (let a = 0; a < n; a++) if (home[a] === tk) covered.add(a);
    const direct = new Set(covered);
    const subs = [...sets].filter(([k, S]) => k !== tk && isSubset(S, T));
    const maximal = subs
      .filter(([k, S]) => !subs.some(([k2, S2]) => k2 !== k && isSubset(S, S2)))
      .sort((x, y) => y[1].size - x[1].size);
    const chosen = [];
    for (const item of maximal) {
      if ([...item[1]].some((x) => !covered.has(x))) {
        chosen.push(item);
        item[1].forEach((x) => covered.add(x));
      }
    }
    for (let i = chosen.length - 1; i >= 0; i--) {
      const others = new Set(direct);
      chosen.forEach((c, j) => { if (j !== i) c[1].forEach((x) => others.add(x)); });
      if ([...chosen[i][1]].every((x) => others.has(x))) chosen.splice(i, 1);
    }
    for (const [sk] of chosen) {
      edges.push({ id: 'd' + edgeSeq++, kind: 'dummy', from: nodeOf.get(sk), to: nodeOf.get(tk) });
    }
  }

  // --- Limpieza ------------------------------------------------------------------
  const reachable = (from, to, skipId) => {
    const adj = new Map();
    for (const e of edges) {
      if (e.id === skipId) continue;
      if (!adj.has(e.from)) adj.set(e.from, []);
      adj.get(e.from).push(e.to);
    }
    const seen = new Set([from]);
    const stack = [from];
    while (stack.length) {
      const v = stack.pop();
      if (v === to) return true;
      for (const w of adj.get(v) || []) if (!seen.has(w)) { seen.add(w); stack.push(w); }
    }
    return false;
  };

  let again = true;
  while (again) {
    again = false;
    for (const e of [...edges]) {
      if (e.kind === 'dummy' && reachable(e.from, e.to, e.id)) {
        edges = edges.filter((x) => x !== e);
        again = true;
      }
    }
    const nodes = new Set(edges.flatMap((e) => [e.from, e.to]));
    for (const v of nodes) {
      if (v === START) continue;
      const out = edges.filter((e) => e.from === v);
      const inc = edges.filter((e) => e.to === v);
      // Evento cuya única salida es una ficticia: sus flechas pueden llegar directo al destino.
      if (v !== END && out.length === 1 && out[0].kind === 'dummy') {
        const target = out[0].to;
        edges = edges.filter((e) => e !== out[0]);
        inc.forEach((e) => { e.to = target; });
        again = true;
        break;
      }
      // Evento cuya única entrada es una ficticia que es la única salida de su origen.
      if (inc.length === 1 && inc[0].kind === 'dummy') {
        const src = inc[0].from;
        const srcOut = edges.filter((e) => e.from === src);
        if (srcOut.length === 1 && src !== START) {
          edges = edges.filter((e) => e !== inc[0]);
          out.forEach((e) => { e.from = src; });
          if (v === END) END = src;
          again = true;
          break;
        }
      }
    }
  }

  // Actividades paralelas (mismo par de eventos): se separan con una ficticia.
  const groups = new Map();
  for (const e of edges) {
    const k = e.from + '>' + e.to;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const auxPool = new Map();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const dummies = group.filter((e) => e.kind === 'dummy');
    const actsG = group.filter((e) => e.kind === 'activity');
    if (actsG.length) dummies.forEach((d) => { edges = edges.filter((x) => x !== d); });
    else dummies.slice(1).forEach((d) => { edges = edges.filter((x) => x !== d); });
    actsG.sort((x, y) => names.indexOf(x.act) - names.indexOf(y.act));
    // Los eventos auxiliares que desembocan en el mismo evento se comparten entre grupos de paralelas
    // (la i-ésima sobrante de cada grupo usa el auxiliar i): así se usan menos ficticias.
    actsG.slice(1).forEach((e, i) => {
      const to = e.to;
      if (!auxPool.has(to)) auxPool.set(to, []);
      const pool = auxPool.get(to);
      if (!pool[i]) {
        pool[i] = 'n' + nodeSeq++;
        edges.push({ id: 'd' + edgeSeq++, kind: 'dummy', from: pool[i], to });
      }
      e.to = pool[i];
    });
  }

  // Última pasada: una ficticia que se puede quitar sin alterar ninguna dependencia no es necesaria.
  const cumpleTabla = (list) => {
    const inN = new Map();
    const outN = new Map();
    list.forEach((e) => {
      inN.set(e.to, (inN.get(e.to) || 0) + 1);
      outN.set(e.from, (outN.get(e.from) || 0) + 1);
    });
    const nodos = new Set([START, ...list.flatMap((e) => [e.from, e.to])]);
    for (const v of nodos) {
      if (!inN.get(v) && v !== START) return false;
      if (!outN.get(v) && v !== END) return false;
    }
    const reach = new Map([...nodos].map((v) => [v, new Set()]));
    const pend = new Map([...nodos].map((v) => [v, inN.get(v) || 0]));
    const cola = [...nodos].filter((v) => !pend.get(v));
    let visitados = 0;
    while (cola.length) {
      const v = cola.pop();
      visitados++;
      for (const e of list) {
        if (e.from !== v) continue;
        const dst = reach.get(e.to);
        reach.get(v).forEach((x) => dst.add(x));
        if (e.kind === 'activity') dst.add(idx.get(e.act));
        pend.set(e.to, pend.get(e.to) - 1);
        if (pend.get(e.to) === 0) cola.push(e.to);
      }
    }
    if (visitados !== nodos.size) return false;
    return list.every((e) => {
      if (e.kind !== 'activity') return true;
      const got = reach.get(e.from);
      const want = anc[idx.get(e.act)];
      return got.size === want.size && [...want].every((x) => got.has(x));
    });
  };
  for (const d of [...edges].reverse()) {
    if (d.kind !== 'dummy') continue;
    const sin = edges.filter((e) => e !== d);
    if (cumpleTabla(sin)) edges = sin;
  }

  const nodeIds = [...new Set([START, ...edges.flatMap((e) => [e.from, e.to])])];
  let dummyNo = 0;
  edges.forEach((e) => { if (e.kind === 'dummy') e.label = 'f' + ++dummyNo; });
  return { nodes: nodeIds, edges, start: START, end: END, notes, names };
}

function topoActivities(n, preds) {
  const indeg = preds.map((p) => p.length);
  const succ = Array.from({ length: n }, () => []);
  preds.forEach((ps, i) => ps.forEach((p) => succ[p].push(i)));
  const q = [];
  for (let i = 0; i < n; i++) if (!indeg[i]) q.push(i);
  const out = [];
  while (q.length) {
    const v = q.shift();
    out.push(v);
    for (const w of succ[v]) if (--indeg[w] === 0) q.push(w);
  }
  return out;
}

/** Orden topológico de eventos. */
export function topoNodes(net) {
  const indeg = new Map(net.nodes.map((v) => [v, 0]));
  net.edges.forEach((e) => indeg.set(e.to, indeg.get(e.to) + 1));
  const q = net.nodes.filter((v) => indeg.get(v) === 0);
  const out = [];
  while (q.length) {
    const v = q.shift();
    out.push(v);
    for (const e of net.edges) if (e.from === v) {
      indeg.set(e.to, indeg.get(e.to) - 1);
      if (indeg.get(e.to) === 0) q.push(e.to);
    }
  }
  return out;
}
