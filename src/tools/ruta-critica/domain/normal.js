/** Distribución normal con precisión de doble (error < 1e-14), sin tablas ni aproximaciones cortas. */

// erf para |x| < 3: serie sin cancelación  erf(x) = 2/√π · e^(−x²) · Σ 2ⁿ x^(2n+1) / (1·3·5···(2n+1))
function erfSerie(x) {
  let term = x;
  let sum = x;
  for (let n = 1; n < 200; n++) {
    term *= (2 * x * x) / (2 * n + 1);
    sum += term;
    if (Math.abs(term) < 1e-17 * Math.abs(sum)) break;
  }
  return (2 / Math.sqrt(Math.PI)) * Math.exp(-x * x) * sum;
}

// erfc para x ≥ 3: fracción continua  erfc(x) = e^(−x²)/√π · 1/(x + (1/2)/(x + 1/(x + (3/2)/(x + …))))
function erfcFraccion(x) {
  let f = x;
  for (let k = 80; k >= 1; k--) f = x + k / 2 / f;
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / f;
}

export function erfc(x) {
  if (Number.isNaN(x)) return NaN;
  const ax = Math.abs(x);
  const v = ax < 3 ? 1 - erfSerie(ax) : erfcFraccion(ax);
  return x >= 0 ? v : 2 - v;
}

export const erf = (x) => (Math.abs(x) < 3 ? (x < 0 ? -erfSerie(-x) : erfSerie(x)) : 1 - erfc(x));

/** Φ(z) = P(Z ≤ z) para Z normal estándar. */
export function phi(z) {
  if (z === Infinity) return 1;
  if (z === -Infinity) return 0;
  return 0.5 * erfc(-z / Math.SQRT2);
}
