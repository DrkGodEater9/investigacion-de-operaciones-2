import { Fraction, ZERO, frac } from './fraction.js';
import { solveLP } from './simplex.js';

/**
 * Calcula los vértices y puntos enteros de la región factible para 2 variables (x1, x2 >= 0).
 * Todo el cálculo de intersecciones y filtrado se realiza con fracciones exactas.
 */

/**
 * Intersección de dos rectas 2D:
 * L1: a1*x1 + a2*x2 = b1
 * L2: c1*x1 + c2*x2 = b2
 */
function lineIntersection(a1, a2, b1, c1, c2, b2) {
  // det = a1*c2 - a2*c1
  const det = a1.mul(c2).sub(a2.mul(c1));
  if (det.isZero()) return null; // paralelas o coincidentes

  // x1 = (b1*c2 - a2*b2) / det
  const num1 = b1.mul(c2).sub(a2.mul(b2));
  const x1 = num1.div(det);

  // x2 = (a1*b2 - b1*c1) / det
  const num2 = a1.mul(b2).sub(b1.mul(c1));
  const x2 = num2.div(det);

  return { x1, x2 };
}

/**
 * Comprueba si un punto (x1, x2) cumple las restricciones dadas y x1, x2 >= 0.
 */
function isPointFeasible(x1, x2, constraints) {
  if (x1.lt(ZERO) || x2.lt(ZERO)) return false;

  for (const ct of constraints) {
    const a1 = frac(ct.a[0] || 0);
    const a2 = frac(ct.a[1] || 0);
    const b = frac(ct.b);
    const val = a1.mul(x1).add(a2.mul(x2));

    if (ct.op === '<=' && val.gt(b)) return false;
    if (ct.op === '>=' && val.lt(b)) return false;
    if (ct.op === '=' && !val.eq(b)) return false;
  }
  return true;
}

/**
 * Encuentra todos los vértices extremos de la región factible en 2D.
 */
export function get2DFeasibleRegion(constraints) {
  // Colección de todas las rectas frontera:
  // - x1 = 0
  // - x2 = 0
  // - a_i1*x1 + a_i2*x2 = b_i
  const lines = [
    { a1: frac(1), a2: frac(0), b: frac(0), label: 'x₁ = 0' },
    { a1: frac(0), a2: frac(1), b: frac(0), label: 'x₂ = 0' },
  ];

  constraints.forEach((ct, i) => {
    const a1 = frac(ct.a[0] || 0);
    const a2 = frac(ct.a[1] || 0);
    if (!a1.isZero() || !a2.isZero()) {
      lines.push({ a1, a2, b: frac(ct.b), label: `R${i + 1}` });
    }
  });

  // Intersección de cada par de rectas
  const rawVertices = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const pt = lineIntersection(
        lines[i].a1, lines[i].a2, lines[i].b,
        lines[j].a1, lines[j].a2, lines[j].b
      );
      if (pt && isPointFeasible(pt.x1, pt.x2, constraints)) {
        // Evitar duplicados exactos
        const exists = rawVertices.some(
          (v) => v.x1.eq(pt.x1) && v.x2.eq(pt.x2)
        );
        if (!exists) {
          rawVertices.push(pt);
        }
      }
    }
  }

  if (rawVertices.length === 0) {
    return {
      status: 'empty',
      vertices: [],
      bounds: null,
      isBounded: true,
    };
  }

  // Comprobar si la región está acotada en x1 y x2
  let maxX = ZERO;
  let maxY = ZERO;
  rawVertices.forEach((v) => {
    if (v.x1.gt(maxX)) maxX = v.x1;
    if (v.x2.gt(maxY)) maxY = v.x2;
  });

  // Comprobar rigurosamente si la región factible en x1, x2 >= 0 es acotada:
  // La región es acotada sii Max(x1 + x2) es finito (status !== 'unbounded')
  const boundTest = solveLP({ sense: 'max', c: [1, 1], constraints });
  const isBounded = boundTest.status !== 'unbounded';

  // Ordenar vértices angularmente alrededor del centroide para formar polígono convexo
  let orderedVertices = [...rawVertices];
  if (rawVertices.length >= 3) {
    const cx = rawVertices.reduce((s, v) => s + v.x1.toNumber(), 0) / rawVertices.length;
    const cy = rawVertices.reduce((s, v) => s + v.x2.toNumber(), 0) / rawVertices.length;

    orderedVertices.sort((a, b) => {
      const angleA = Math.atan2(a.x2.toNumber() - cy, a.x1.toNumber() - cx);
      const angleB = Math.atan2(b.x2.toNumber() - cy, b.x1.toNumber() - cx);
      return angleA - angleB;
    });
  }

  return {
    status: 'ok',
    vertices: orderedVertices,
    bounds: {
      minX: 0,
      maxX: Math.ceil(maxX.toNumber()),
      minY: 0,
      maxY: Math.ceil(maxY.toNumber()),
    },
    isBounded,
  };
}

/**
 * Enumera los puntos enteros factibles en 2D dentro de los límites.
 */
export function get2DIntegerPoints(constraints, bounds, maxLimit = 1500) {
  if (!bounds || bounds.maxX > 80 || bounds.maxY > 80) {
    return { tooMany: true, points: [] };
  }

  const totalGrid = (bounds.maxX + 1) * (bounds.maxY + 1);
  if (totalGrid > maxLimit) {
    return { tooMany: true, points: [] };
  }

  const points = [];
  for (let x1 = 0; x1 <= bounds.maxX; x1++) {
    for (let x2 = 0; x2 <= bounds.maxY; x2++) {
      const f1 = new Fraction(BigInt(x1), 1n);
      const f2 = new Fraction(BigInt(x2), 1n);
      if (isPointFeasible(f1, f2, constraints)) {
        points.push({ x1, x2 });
      }
    }
  }

  return { tooMany: false, points };
}

/**
 * Conjunto factible de un modelo MIXTO de 2 variables en el que exactamente una es entera:
 * un segmento por cada valor entero k de esa variable, con el intervalo que le queda a la continua.
 * Devuelve [{ varIdx, valor, desde, hasta }] (varIdx = índice de la variable entera; desde/hasta son
 * fracciones exactas sobre la otra variable). Cálculo exacto con fracciones.
 */
export function get2DMixedSegments(constraints, intIdx, maxEntero = 80) {
  const contIdx = 1 - intIdx;
  const segmentos = [];
  for (let k = 0; k <= maxEntero; k++) {
    const kf = new Fraction(BigInt(k), 1n);
    let lo = ZERO;
    let hi = null; // sin cota superior todavía
    let vacio = false;
    for (const ct of constraints) {
      const ai = frac(ct.a[intIdx] || 0);
      const ac = frac(ct.a[contIdx] || 0);
      const resto = frac(ct.b).sub(ai.mul(kf)); // ac * xc (op) resto
      if (ac.isZero()) {
        const ok =
          (ct.op === '<=' && ZERO.lte(resto)) ||
          (ct.op === '>=' && ZERO.gte(resto)) ||
          (ct.op === '=' && resto.isZero());
        if (!ok) { vacio = true; break; }
        continue;
      }
      const v = resto.div(ac);
      const esCota = (ct.op === '<=' && ac.gt(ZERO)) || (ct.op === '>=' && ac.lt(ZERO));
      if (ct.op === '=') {
        if (v.gt(lo)) lo = v;
        if (hi === null || v.lt(hi)) hi = v;
      } else if (esCota) {
        if (hi === null || v.lt(hi)) hi = v;
      } else if (v.gt(lo)) {
        lo = v;
      }
    }
    if (vacio) continue;
    if (hi === null) return { sinCota: true, segmentos };
    if (lo.lte(hi)) segmentos.push({ varIdx: intIdx, valor: k, desde: lo, hasta: hi });
  }
  return { sinCota: false, segmentos };
}
