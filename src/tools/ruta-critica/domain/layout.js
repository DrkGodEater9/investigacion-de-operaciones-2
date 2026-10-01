import { topoNodes } from './network.js';

/**
 * Distribución por capas (estilo Sugiyama) de izquierda a derecha.
 * Garantiza que toda flecha avanza hacia la derecha: capa(destino) > capa(origen).
 * Las flechas largas pasan por puntos de control intermedios para no cruzar eventos.
 */
export function computeLayout(net, { radius = 26 } = {}) {
  const XGAP = Math.max(150, radius * 4 + 70);
  const YGAP = Math.max(96, radius * 2 + 56);
  const VGAP = 46;
  const MARGIN = radius + 40;

  const order = topoNodes(net);
  const layer = {};
  for (const v of order) {
    const ins = net.edges.filter((e) => e.to === v);
    layer[v] = ins.length ? Math.max(...ins.map((e) => layer[e.from] + 1)) : 0;
  }
  // Empuja hacia la derecha los eventos que pueden avanzar sin alargar flechas (menos cruces).
  for (const v of [...order].reverse()) {
    if (v === net.start) continue;
    const outs = net.edges.filter((e) => e.from === v);
    if (outs.length) {
      const target = Math.min(...outs.map((e) => layer[e.to] - 1));
      const ins = net.edges.filter((e) => e.to === v);
      if (target > layer[v] && ins.length) layer[v] = target;
    }
  }
  const maxLayer = Math.max(...Object.values(layer));

  // Vértices reales + virtuales
  const layers = Array.from({ length: maxLayer + 1 }, () => []);
  const isVirtual = {};
  const up = {};
  const down = {};
  const link = (a, b) => {
    (down[a] ||= []).push(b);
    (up[b] ||= []).push(a);
  };
  order.forEach((v) => { layers[layer[v]].push(v); isVirtual[v] = false; });
  const chains = {};
  for (const e of net.edges) {
    const chain = [e.from];
    for (let L = layer[e.from] + 1; L < layer[e.to]; L++) {
      const vid = `${e.id}#${L}`;
      isVirtual[vid] = true;
      layer[vid] = L;
      layers[L].push(vid);
      chain.push(vid);
    }
    chain.push(e.to);
    for (let i = 0; i + 1 < chain.length; i++) link(chain[i], chain[i + 1]);
    chains[e.id] = chain;
  }

  // Orden inicial por recorrido en profundidad desde el inicio
  const visit = {};
  let counter = 0;
  const dfs = (v) => {
    if (visit[v] != null) return;
    visit[v] = counter++;
    for (const w of down[v] || []) dfs(w);
  };
  dfs(net.start);
  Object.keys(isVirtual).forEach((v) => dfs(v));
  layers.forEach((L) => L.sort((a, b) => visit[a] - visit[b]));

  const posIndex = () => {
    const p = {};
    layers.forEach((L) => L.forEach((v, i) => { p[v] = i; }));
    return p;
  };
  const crossings = () => {
    const p = posIndex();
    let c = 0;
    for (let L = 0; L < layers.length - 1; L++) {
      const segs = [];
      layers[L].forEach((v) => (down[v] || []).forEach((w) => segs.push([p[v], p[w]])));
      for (let i = 0; i < segs.length; i++)
        for (let j = i + 1; j < segs.length; j++)
          if ((segs[i][0] - segs[j][0]) * (segs[i][1] - segs[j][1]) < 0) c++;
    }
    return c;
  };
  const bary = (v, nbrs, p) => {
    const ns = nbrs[v] || [];
    return ns.length ? ns.reduce((s, w) => s + p[w], 0) / ns.length : p[v];
  };
  let best = layers.map((L) => [...L]);
  let bestC = crossings();
  for (let it = 0; it < 28 && bestC > 0; it++) {
    const downward = it % 2 === 0;
    const range = downward ? [...layers.keys()].slice(1) : [...layers.keys()].reverse().slice(1);
    for (const L of range) {
      const p = posIndex();
      const nb = downward ? up : down;
      const key = {};
      layers[L].forEach((v) => { key[v] = bary(v, nb, p); });
      layers[L].sort((a, b) => key[a] - key[b] || p[a] - p[b]);
    }
    const c = crossings();
    if (c < bestC) { bestC = c; best = layers.map((L) => [...L]); }
  }
  best.forEach((L, i) => { layers[i] = L; });

  // Coordenadas verticales: acercar cada vértice al promedio de sus vecinos
  const size = (v) => (isVirtual[v] ? VGAP : YGAP);
  const y = {};
  layers.forEach((L) => {
    let acc = 0;
    L.forEach((v, i) => { if (i) acc += (size(L[i - 1]) + size(v)) / 2; y[v] = acc; });
    const mid = acc / 2;
    L.forEach((v) => { y[v] -= mid; });
  });
  for (let it = 0; it < 24; it++) {
    const seq = it % 2 === 0 ? layers : [...layers].reverse();
    for (const L of seq) {
      const want = L.map((v) => {
        const ns = [...(up[v] || []), ...(down[v] || [])];
        return ns.length ? ns.reduce((s, w) => s + y[w], 0) / ns.length : y[v];
      });
      const placed = [];
      L.forEach((v, i) => {
        const min = i ? placed[i - 1] + (size(L[i - 1]) + size(v)) / 2 : -Infinity;
        placed.push(Math.max(want[i], min));
      });
      for (let i = L.length - 2; i >= 0; i--) {
        const max = placed[i + 1] - (size(L[i]) + size(L[i + 1])) / 2;
        placed[i] = Math.min(placed[i], Math.max(max, want[i]));
        placed[i] = Math.min(placed[i], max);
      }
      const shift = (want.reduce((s, x) => s + x, 0) - placed.reduce((s, x) => s + x, 0)) / L.length;
      L.forEach((v, i) => { y[v] = placed[i] + shift * 0.5; });
    }
  }

  const minY = Math.min(...Object.values(y));
  const pos = {};
  const points = {};
  Object.keys(isVirtual).forEach((v) => {
    const p = { x: MARGIN + layer[v] * XGAP, y: MARGIN + 20 + (y[v] - minY) };
    if (isVirtual[v]) points[v] = p;
    else pos[v] = p;
  });
  const bends = {};
  for (const e of net.edges) bends[e.id] = chains[e.id].slice(1, -1).map((v) => points[v]);

  // Numeración: orden topológico, de izquierda a derecha y de arriba abajo (i < j siempre)
  const indeg = {};
  net.nodes.forEach((v) => { indeg[v] = 0; });
  net.edges.forEach((e) => { indeg[e.to]++; });
  const ready = net.nodes.filter((v) => indeg[v] === 0);
  const number = {};
  let k = 1;
  while (ready.length) {
    ready.sort((a, b) => layer[a] - layer[b] || pos[a].y - pos[b].y);
    const v = ready.shift();
    number[v] = k++;
    net.edges.filter((e) => e.from === v).forEach((e) => { if (--indeg[e.to] === 0) ready.push(e.to); });
  }
  const numbered = [...net.nodes].sort((a, b) => number[a] - number[b]);

  return { pos, bends, number, numbered, layer, radius, margin: MARGIN, crossings: bestC };
}

export function boundsOf(pos, bends, radius, pad = 40) {
  const pts = [...Object.values(pos), ...Object.values(bends).flat()];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    x: Math.min(...xs) - radius - pad,
    y: Math.min(...ys) - radius - pad,
    w: Math.max(...xs) - Math.min(...xs) + 2 * (radius + pad),
    h: Math.max(...ys) - Math.min(...ys) + 2 * (radius + pad),
  };
}
