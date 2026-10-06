/** Formato de números y de expresiones para la pantalla (coma decimal, subíndices). */

const SUBS = '₀₁₂₃₄₅₆₇₈₉';

/** Número con hasta 4 decimales, coma decimal y sin ceros finales. */
export function fmtNum(x) {
  if (!Number.isFinite(x)) return String(x);
  if (Math.abs(x) >= 1e12) return String(x).replace('.', ','); // x·1e4 perdería precisión
  let r = Math.round(x * 1e4) / 1e4;
  if (r === 0) r = 0; // evita «-0»
  return String(r).replace('.', ',');
}

/** x12 → x₁₂; cualquier otro nombre queda igual. */
export function sub(name) {
  const m = /^x(\d+)$/.exec(String(name));
  if (!m) return String(name);
  return 'x' + m[1].replace(/\d/g, (d) => SUBS[d]);
}

/** Texto de una combinación lineal: «x₁ + 2x₂ − x₃». */
export function expresionLineal(coefs, names) {
  let out = '';
  coefs.forEach((c, j) => {
    if (c === 0 || Math.abs(c) < 1e-12) return;
    const neg = c < 0;
    const abs = Math.abs(c);
    const term = (Math.abs(abs - 1) < 1e-12 ? '' : fmtNum(abs)) + sub(names[j]);
    if (out === '') out = (neg ? '−' : '') + term;
    else out += (neg ? ' − ' : ' + ') + term;
  });
  return out === '' ? '0' : out;
}

const OP_TXT = { '<=': '≤', '>=': '≥', '=': '=' };

export function restriccionTexto(model, i) {
  const r = model.constraints[i];
  return `${expresionLineal(r.a, model.names)} ${OP_TXT[r.op]} ${fmtNum(r.b)}`;
}

export function objetivoTexto(model) {
  return `${model.sense === 'max' ? 'Maximizar' : 'Minimizar'} Z = ${expresionLineal(model.c, model.names)}`;
}

/** Lista «x₁, x₂ y x₃» a partir de índices de variable. */
export function listaNombres(indices, names) {
  const t = indices.map((j) => sub(names[j]));
  if (t.length === 0) return 'ninguna';
  if (t.length === 1) return t[0];
  return t.slice(0, -1).join(', ') + ' y ' + t[t.length - 1];
}
