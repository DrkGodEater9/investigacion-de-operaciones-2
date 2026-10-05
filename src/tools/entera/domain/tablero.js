import { Fraction, ZERO, ONE, frac } from './fraction.js';

/**
 * Tablero simplex en la notación del profesor (filas Cj, V.B., C_B, Zj, Cj−Zj, bj)
 * con fracciones exactas. Para ≥ y = se usa el método de la Gran M, con una
 * pequeña aritmética a + b·M (a, b fracciones) que compara primero la parte de M.
 *
 * Todo es inmutable: cada operación devuelve un tablero nuevo.
 *
 * Tablero = {
 *   sentido: 'max'|'min',
 *   cols: [{ nombre, tipo: 'orig'|'holgura'|'exceso'|'art'|'corte', entera, restr? }],
 *   c: [BM], base: [índice de columna por fila],
 *   A: [[Fraction]], b: [Fraction],
 *   zj: [BM], cz: [BM], zval: BM,
 *   info: { n, restr: [{a, op, b, invertida}] }   // restricciones normalizadas (b ≥ 0)
 * }
 */

// ---------------------------------------------------------------------------
// Aritmética a + b·M
// ---------------------------------------------------------------------------
export function BM(a = ZERO, b = ZERO) {
  return Object.freeze({ a: frac(a), b: frac(b) });
}
export const bmSuma = (x, y) => BM(x.a.add(y.a), x.b.add(y.b));
export const bmResta = (x, y) => BM(x.a.sub(y.a), x.b.sub(y.b));
export const bmPorEscalar = (x, f) => BM(x.a.mul(f), x.b.mul(f));
export const bmEsCero = (x) => x.a.isZero() && x.b.isZero();
/** Compara primero la parte de M y luego la parte constante. */
export function bmCmp(x, y) {
  const cb = x.b.cmp(y.b);
  return cb !== 0 ? cb : x.a.cmp(y.a);
}
export function bmSigno(x) {
  return bmCmp(x, BM(ZERO, ZERO));
}
export function bmATexto(x) {
  const ta = x.a.toString();
  if (x.b.isZero()) return ta;
  const bn = x.b;
  let tb;
  if (bn.eq(ONE)) tb = 'M';
  else if (bn.eq(ONE.neg())) tb = '-M';
  else tb = `${bn.toString()}M`;
  if (x.a.isZero()) return tb;
  return `${ta}${bn.n < 0n ? '' : '+'}${tb}`;
}

const BM0 = BM(ZERO, ZERO);

// ---------------------------------------------------------------------------
// Construcción
// ---------------------------------------------------------------------------
function normalizarModelo(modelo) {
  const sentido = modelo.sense || modelo.sentido || 'max';
  if (sentido !== 'max' && sentido !== 'min') throw new Error('El sentido debe ser "max" o "min".');
  const n = modelo.c.length;
  const c = modelo.c.map((v) => frac(v));
  const integer = Array.from({ length: n }, (_, j) =>
    modelo.integer && modelo.integer[j] !== undefined ? !!modelo.integer[j] : true
  );
  const restr = (modelo.constraints || []).map((ct, k) => {
    if (ct.a.length !== n) throw new Error(`Restricción ${k + 1}: debe tener ${n} coeficientes.`);
    let a = ct.a.map((v) => frac(v));
    let b = frac(ct.b);
    let op = ct.op;
    if (op === '≤') op = '<=';
    if (op === '≥') op = '>=';
    if (!['<=', '>=', '='].includes(op)) throw new Error(`Restricción ${k + 1}: operador no soportado (${ct.op}).`);
    let invertida = false;
    // Se conserva el original para decidir la integralidad de la holgura.
    const enteraRestr =
      a.every((v, j) => v.isZero() || (integer[j] && v.isInteger())) && b.isInteger();
    if (b.lt(ZERO)) {
      a = a.map((v) => v.neg());
      b = b.neg();
      op = op === '<=' ? '>=' : op === '>=' ? '<=' : '=';
      invertida = true;
    }
    return { a, op, b, invertida, enteraRestr };
  });
  return { sentido, n, c, integer, restr };
}

export function construirTablero(modelo) {
  const { sentido, n, c, integer, restr } = normalizarModelo(modelo);
  const m = restr.length;

  const cols = [];
  const costos = [];
  for (let j = 0; j < n; j++) {
    cols.push({ nombre: `x${j + 1}`, tipo: 'orig', entera: integer[j] });
    costos.push(BM(c[j], ZERO));
  }
  const colHolgura = Array(m).fill(-1);
  restr.forEach((r, k) => {
    if (r.op === '=') return;
    colHolgura[k] = cols.length;
    cols.push({
      nombre: `x${n + k + 1}`,
      tipo: r.op === '<=' ? 'holgura' : 'exceso',
      entera: r.enteraRestr,
      restr: k,
    });
    costos.push(BM0);
  });
  const colArt = Array(m).fill(-1);
  const costoArt = sentido === 'max' ? BM(ZERO, ONE.neg()) : BM(ZERO, ONE);
  restr.forEach((r, k) => {
    if (r.op === '<=') return;
    colArt[k] = cols.length;
    cols.push({ nombre: `R${k + 1}`, tipo: 'art', entera: false, restr: k });
    costos.push(costoArt);
  });

  const N = cols.length;
  const A = restr.map((r, k) => {
    const fila = Array(N).fill(ZERO);
    for (let j = 0; j < n; j++) fila[j] = r.a[j];
    if (colHolgura[k] >= 0) fila[colHolgura[k]] = r.op === '<=' ? ONE : ONE.neg();
    if (colArt[k] >= 0) fila[colArt[k]] = ONE;
    return fila;
  });
  const b = restr.map((r) => r.b);
  const base = restr.map((r, k) => (r.op === '<=' ? colHolgura[k] : colArt[k]));

  return recalcular({
    sentido,
    cols,
    c: costos,
    base,
    A,
    b,
    zj: [],
    cz: [],
    zval: BM0,
    info: {
      n,
      restr: restr.map((r) => ({ a: r.a, op: r.op, b: r.b, invertida: r.invertida })),
    },
  });
}

/** Recalcula zj, cz y zval. Devuelve un tablero nuevo. */
export function recalcular(t) {
  const N = t.cols.length;
  const zj = [];
  for (let j = 0; j < N; j++) {
    let s = BM0;
    for (let i = 0; i < t.base.length; i++) {
      s = bmSuma(s, bmPorEscalar(t.c[t.base[i]], t.A[i][j]));
    }
    zj.push(s);
  }
  const cz = t.c.map((cj, j) => bmResta(cj, zj[j]));
  let zval = BM0;
  for (let i = 0; i < t.base.length; i++) zval = bmSuma(zval, bmPorEscalar(t.c[t.base[i]], t.b[i]));
  return { ...t, zj, cz, zval };
}

export function pivotear(t, fila, col) {
  const p = t.A[fila][col];
  if (p.isZero()) throw new Error('No se puede pivotear sobre un elemento igual a cero.');
  const N = t.cols.length;
  const filaP = t.A[fila].map((v) => v.div(p));
  const bP = t.b[fila].div(p);
  const A = t.A.map((f, i) => {
    if (i === fila) return filaP;
    const factor = f[col];
    if (factor.isZero()) return f.slice();
    return f.map((v, j) => v.sub(factor.mul(filaP[j])));
  });
  const b = t.b.map((v, i) => {
    if (i === fila) return bP;
    const factor = t.A[i][col];
    return factor.isZero() ? v : v.sub(factor.mul(bP));
  });
  const base = t.base.slice();
  base[fila] = col;
  void N;
  return recalcular({ ...t, A, b, base });
}

// ---------------------------------------------------------------------------
// Simplex primal
// ---------------------------------------------------------------------------
function mejora(t, cz) {
  // cz "mejora" el objetivo?
  const s = bmSigno(cz);
  return t.sentido === 'max' ? s > 0 : s < 0;
}

export function simplexPrimal(t0, { maxIter = 200 } = {}) {
  let t = t0;
  const iteraciones = [];
  const hayArtPositiva = (tt) =>
    tt.base.some((j, i) => tt.cols[j].tipo === 'art' && tt.b[i].gt(ZERO));

  for (let it = 1; ; it++) {
    // Columna que entra
    let entra = -1;
    for (let j = 0; j < t.cols.length; j++) {
      if (!mejora(t, t.cz[j])) continue;
      if (entra === -1) entra = j;
      else {
        const c = bmCmp(t.cz[j], t.cz[entra]);
        if (t.sentido === 'max' ? c > 0 : c < 0) entra = j;
      }
    }
    if (entra === -1) {
      return { estado: hayArtPositiva(t) ? 'infactible' : 'optimo', tablero: t, iteraciones };
    }
    if (it > maxIter) throw new Error(`El simplex superó el máximo de ${maxIter} iteraciones.`);

    // Fila que sale
    const razones = t.A.map((f, i) => (f[entra].gt(ZERO) ? t.b[i].div(f[entra]) : null));
    let sale = -1;
    razones.forEach((r, i) => {
      if (r !== null && (sale === -1 || r.lt(razones[sale]))) sale = i;
    });
    if (sale === -1) {
      return { estado: hayArtPositiva(t) ? 'infactible' : 'no_acotado', tablero: t, iteraciones };
    }
    const pivote = t.A[sale][entra];
    const despues = pivotear(t, sale, entra);
    iteraciones.push({ n: it, antes: t, entra, sale, razones, pivote, despues });
    t = despues;
  }
}

// ---------------------------------------------------------------------------
// Artificiales
// ---------------------------------------------------------------------------
function quitarColumnas(t, quitar) {
  const mantener = t.cols.map((_, j) => !quitar.has(j));
  const nuevoIdx = [];
  let k = 0;
  mantener.forEach((m, j) => {
    nuevoIdx[j] = m ? k++ : -1;
  });
  const filtra = (arr) => arr.filter((_, j) => mantener[j]);
  return recalcular({
    ...t,
    cols: filtra(t.cols),
    c: filtra(t.c),
    A: t.A.map(filtra),
    base: t.base.map((j) => nuevoIdx[j]),
  });
}

function quitarFilas(t, quitar) {
  const f = (arr) => arr.filter((_, i) => !quitar.has(i));
  return recalcular({ ...t, A: f(t.A), b: f(t.b), base: f(t.base) });
}

export function limpiarArtificiales(t0) {
  let t = t0;
  // Artificiales básicas con valor 0: sacarlas o eliminar la fila redundante.
  const filasQuitar = new Set();
  for (let i = 0; i < t.base.length; i++) {
    if (t.cols[t.base[i]].tipo !== 'art') continue;
    if (!t.b[i].isZero()) continue;
    let col = -1;
    for (let j = 0; j < t.cols.length; j++) {
      if (t.cols[j].tipo !== 'art' && !t.A[i][j].isZero()) {
        col = j;
        break;
      }
    }
    if (col >= 0) t = pivotear(t, i, col);
    else filasQuitar.add(i);
  }
  if (filasQuitar.size > 0) t = quitarFilas(t, filasQuitar);
  // Columnas artificiales no básicas.
  const quitar = new Set();
  t.cols.forEach((c, j) => {
    if (c.tipo === 'art' && !t.base.includes(j)) quitar.add(j);
  });
  if (quitar.size > 0) t = quitarColumnas(t, quitar);
  return t;
}

// ---------------------------------------------------------------------------
// Simplex dual
// ---------------------------------------------------------------------------
export function simplexDual(t0, { maxIter = 200 } = {}) {
  let t = t0;
  const iteraciones = [];
  const esOptimoDual = (tt) =>
    tt.cz.every((v) => (tt.sentido === 'max' ? bmSigno(v) <= 0 : bmSigno(v) >= 0));
  if (!esOptimoDual(t)) {
    throw new Error('El simplex dual exige un tablero con Cj−Zj de signo óptimo (factible en el dual).');
  }
  if (t.cz.some((v) => !v.b.isZero())) {
    throw new Error('El simplex dual no admite términos con M en Cj−Zj; limpia las artificiales antes.');
  }

  for (let it = 1; ; it++) {
    let sale = -1;
    t.b.forEach((v, i) => {
      if (v.lt(ZERO) && (sale === -1 || v.lt(t.b[sale]))) sale = i;
    });
    if (sale === -1) return { estado: 'optimo', tablero: t, iteraciones };
    if (it > maxIter) throw new Error(`El simplex dual superó el máximo de ${maxIter} iteraciones.`);

    const razones = t.cols.map((_, j) => {
      const a = t.A[sale][j];
      if (!a.lt(ZERO)) return null;
      return { col: j, valor: t.cz[j].a.div(a).abs() };
    });
    let entra = -1;
    razones.forEach((r, j) => {
      if (r !== null && (entra === -1 || r.valor.lt(razones[entra].valor))) entra = j;
    });
    if (entra === -1) return { estado: 'infactible', tablero: t, iteraciones };

    const pivote = t.A[sale][entra];
    const despues = pivotear(t, sale, entra);
    iteraciones.push({ n: it, antes: t, sale, razones, entra, pivote, despues });
    t = despues;
  }
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------
export function valoresColumnas(t) {
  const v = t.cols.map(() => ZERO);
  t.base.forEach((j, i) => {
    v[j] = t.b[i];
  });
  return v;
}

export function solucionOriginal(t, n = t.info.n) {
  return valoresColumnas(t).slice(0, n);
}

/**
 * Resuelve la relajación lineal con el tablero (Gran M).
 * Devuelve {estado:'optimo'|'infactible'|'no_acotado', z, x, tableroInicial, tablero, iteraciones}
 * con z en el sentido original.
 */
export function resolverRelajacion(modelo, opts = {}) {
  const tableroInicial = construirTablero(modelo);
  const r = simplexPrimal(tableroInicial, opts);
  if (r.estado !== 'optimo') {
    return { estado: r.estado, z: null, x: null, tableroInicial, tablero: r.tablero, iteraciones: r.iteraciones };
  }
  return {
    estado: 'optimo',
    z: r.tablero.zval.a,
    x: solucionOriginal(r.tablero),
    tableroInicial,
    tablero: r.tablero,
    iteraciones: r.iteraciones,
  };
}
