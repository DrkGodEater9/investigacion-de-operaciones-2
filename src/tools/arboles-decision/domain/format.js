export const MENOS = '−';

/** Número en español: coma decimal, signo menos tipográfico, sin ceros sobrantes. */
export function fmtNum(x, dec = 4) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return '—';
  let r = Math.round(x * 10 ** dec) / 10 ** dec;
  if (r === 0) r = 0;
  const s = r.toFixed(dec).replace(/\.?0+$/, '').replace('.', ',');
  return s.startsWith('-') ? MENOS + s.slice(1) : s;
}

/** Igual que fmtNum, pero los negativos van entre paréntesis (para usarlos dentro de una operación). */
export const fmtPar = (x, dec = 4) => (x < 0 && fmtNum(x, dec) !== '0' ? `(${fmtNum(x, dec)})` : fmtNum(x, dec));

/** Número para el texto de entrada: coma decimal y 10 decimales como máximo (ida y vuelta sin pérdida). */
export function fmtTexto(x) {
  let r = Math.round(x * 1e10) / 1e10;
  if (r === 0) r = 0;
  return String(r).replace('.', ',');
}

const aNumero = (s) => Number(s.replace(',', '.'));

/**
 * Interpreta un número escrito por una persona: acepta coma o punto decimal, el signo menos
 * tipográfico y fracciones como 1/3. Devuelve null si no es un número (o está vacío).
 */
export function parseNumero(t) {
  if (typeof t === 'number') return Number.isFinite(t) ? t : null;
  const s = String(t ?? '').trim().replace(/−/g, '-').replace(/\s+/g, '');
  if (!s) return null;
  const f = /^([-+]?\d+(?:[.,]\d+)?)\/(\d+(?:[.,]\d+)?)$/.exec(s);
  if (f) {
    const b = aNumero(f[2]);
    return b === 0 ? null : aNumero(f[1]) / b;
  }
  if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(s)) return null;
  const n = aNumero(s);
  return Number.isFinite(n) ? n : null;
}

/** Como parseNumero, pero también acepta porcentajes («60 %»). */
export function parseProb(t) {
  if (typeof t === 'string' && /%\s*$/.test(t)) {
    const n = parseNumero(t.replace(/%\s*$/, ''));
    return n === null ? null : n / 100;
  }
  return parseNumero(t);
}

export const vacio = (t) => t === undefined || t === null || String(t).trim() === '';
