/** Formato de números para la pantalla (coma decimal, signo menos tipográfico). Funciones puras. */

/** Número con hasta 4 decimales, sin ceros finales, coma decimal y «−» para los negativos. */
export function fmtNum(x) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  if (!Number.isFinite(x)) return String(x);
  if (Math.abs(x) >= 1e12) return String(x).replace('.', ',').replace('-', '−');
  let r = Math.round(x * 1e4) / 1e4;
  if (r === 0) r = 0; // evita «-0»
  return String(r).replace('.', ',').replace('-', '−');
}

/** Igual que fmtNum pero entre paréntesis si es negativo: sirve para productos como 0,7·(−100). */
export function fmtFactor(x) {
  return x < 0 ? `(${fmtNum(x)})` : fmtNum(x);
}

/** Porcentaje con hasta 1 decimal: 0,4643 → «46,4 %». */
export function fmtPct(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  let r = Math.round(x * 1000) / 10;
  if (r === 0) r = 0;
  return String(r).replace('.', ',').replace('-', '−') + ' %';
}

/** Número con punto decimal y hasta 6 decimales (para CSV y para comparar en pruebas). */
export function crudo(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '';
  let r = Math.round(x * 1e6) / 1e6;
  if (r === 0) r = 0;
  return String(r);
}

/** Texto de un conjunto de nombres: «A», «A y B», «A, B y C». */
export function listaTexto(nombres) {
  if (nombres.length === 0) return 'ninguna';
  if (nombres.length === 1) return nombres[0];
  return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
}
