import { frac, ZERO } from '../../domain/fraction.js';

export function gen(seed, opts = {}) {
  let s = seed; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (arr) => arr[ri(0, arr.length - 1)];
  const n = opts.n ?? ri(2, 4);
  const m = ri(1, 3);
  const num = (lo, hi) => (rnd() < 0.15 ? pick(['1/2', '3/2', '0,5', '2,5', '-1/2', '1/3']) : ri(lo, hi));
  const sense = rnd() < 0.5 ? 'max' : 'min';
  const c = Array.from({ length: n }, () => num(-3, 9));
  const integer = Array.from({ length: n }, () => rnd() < 0.6);
  if (rnd() < 0.3) integer.fill(true);
  const constraints = Array.from({ length: m }, () => {
    const op = pick(['<=', '<=', '>=', '=']);
    const deg = rnd() < 0.25;
    return { a: Array.from({ length: n }, () => num(-2, 8)), op, b: deg ? 0 : op === '=' ? ri(0, 20) : ri(-3, 40) };
  });
  constraints.push({ a: Array(n).fill(1), op: '<=', b: n <= 3 ? 8 : 4 });
  if (rnd() < 0.3) constraints.push({ a: Array(n).fill(0).map((_, j) => (j === 0 ? 1 : 0)), op: '<=', b: ri(1, 5) });
  return { sense, c, constraints, integer };
}


