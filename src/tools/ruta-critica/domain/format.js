const cache = new Map();
function formatter(decimals) {
  if (!cache.has(decimals)) {
    cache.set(decimals, new Intl.NumberFormat('es-CO', { maximumFractionDigits: decimals, useGrouping: false }));
  }
  return cache.get(decimals);
}

export function fmt(x, decimals = 2) {
  if (x == null || Number.isNaN(x)) return '';
  const r = Math.abs(x) < 1e-9 ? 0 : x;
  return formatter(decimals).format(r);
}

export const EPS = 1e-7;
export const isZero = (x) => Math.abs(x) < EPS;
