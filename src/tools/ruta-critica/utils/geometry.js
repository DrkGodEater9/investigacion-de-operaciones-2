const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v) => Math.hypot(v.x, v.y) || 1;
const HEAD = 12;
const HALF = 4.2;
const along = (p, v, t) => ({ x: p.x + (v.x / len(v)) * t, y: p.y + (v.y / len(v)) * t });

/** Trazo de una flecha entre dos eventos pasando por puntos intermedios. */
export function edgeGeometry(p0, bends, p1, r) {
  const raw = [p0, ...bends, p1];
  const start = along(raw[0], sub(raw[1], raw[0]), r);
  const end = along(raw[raw.length - 1], sub(raw[raw.length - 2], raw[raw.length - 1]), r + 1);
  const pts = [start, ...bends, end];

  let d;
  let tail; // punto desde donde llega la flecha a la punta (define su dirección)
  if (pts.length === 2) {
    tail = start;
    d = null;
  } else {
    d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0_ = pts[i - 1] || pts[i];
      const p1_ = pts[i];
      const p2_ = pts[i + 1];
      const p3_ = pts[i + 2] || p2_;
      const c1 = { x: p1_.x + (p2_.x - p0_.x) / 6, y: p1_.y + (p2_.y - p0_.y) / 6 };
      const c2 = { x: p2_.x - (p3_.x - p1_.x) / 6, y: p2_.y - (p3_.y - p1_.y) / 6 };
      if (i === pts.length - 2) {
        tail = c2;
        const back = along(p2_, sub(c2, p2_), HEAD * 0.7);
        d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${back.x},${back.y}`;
      } else d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2_.x},${p2_.y}`;
    }
  }
  if (!d) {
    const back = along(end, sub(start, end), HEAD * 0.7);
    d = `M${start.x},${start.y} L${back.x},${back.y}`;
  }
  // Punta de flecha como triángulo explícito (mismo aspecto en pantalla, PNG y PDF)
  const dir = sub(end, tail);
  const L = len(dir);
  const ux = dir.x / L;
  const uy = dir.y / L;
  const bx = end.x - ux * HEAD;
  const by = end.y - uy * HEAD;
  const head = `M${end.x},${end.y} L${bx - uy * HALF},${by + ux * HALF} L${bx + uy * HALF},${by - ux * HALF} Z`;

  // Punto medio de la poligonal para ubicar la etiqueta
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = len(sub(pts[i + 1], pts[i]));
    segs.push(l);
    total += l;
  }
  let acc = 0;
  let label = pts[0];
  let angle = 0;
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= total / 2) {
      const t = (total / 2 - acc) / segs[i];
      label = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
      angle = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
      break;
    }
    acc += segs[i];
  }
  return { d, head, label, angle };
}
