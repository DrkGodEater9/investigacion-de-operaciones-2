import { ZERO, ONE, frac } from './fraction.js';
import {
  BM,
  construirTablero,
  simplexPrimal,
  simplexDual,
  limpiarArtificiales,
  recalcular,
  solucionOriginal,
} from './tablero.js';

/**
 * Planos de corte de Gomory sobre el tablero simplex.
 */

/**
 * Corte de Gomory a partir de una fila  x_B + Σ a_j x_j = b  (f0 = parteFrac(b) > 0).
 * Devuelve {f0, coefs, rhs} con el sentido  Σ coef_j x_j ≥ rhs  y rhs = f0.
 *   fila = {b, coefs:[{a, entera}]}
 *   tipo 'mixto'     : corte mixto de Gomory (4 casos)
 *   tipo 'fraccional': solo si todas las variables son enteras (coef = f_j)
 */
export function cortePlanoDeFila(fila, { tipo = 'mixto' } = {}) {
  if (tipo !== 'mixto' && tipo !== 'fraccional') {
    throw new Error('El tipo de corte debe ser "mixto" o "fraccional".');
  }
  const b = frac(fila.b);
  const f0 = b.fractionalPart();
  if (f0.isZero()) throw new Error('La fila no tiene lado derecho fraccionario: no genera corte.');
  if (tipo === 'fraccional' && fila.coefs.some((c) => !c.entera)) {
    throw new Error(
      'El corte fraccional solo es válido si todas las variables, holguras incluidas, son enteras.'
    );
  }
  const uno_f0 = ONE.sub(f0);
  const coefs = fila.coefs.map(({ a, entera }) => {
    const aj = frac(a);
    if (tipo === 'fraccional') return aj.fractionalPart();
    if (entera) {
      const fj = aj.fractionalPart();
      return fj.lte(f0) ? fj : f0.mul(ONE.sub(fj)).div(uno_f0);
    }
    return aj.gt(ZERO) ? aj : f0.mul(aj.neg()).div(uno_f0);
  });
  return { f0, coefs, rhs: f0 };
}

function expresionBase(t) {
  const n = t.info.n;
  const exprs = t.cols.map((col, j) => {
    const m = Array(n).fill(ZERO);
    if (col.tipo === 'orig') {
      m[j] = ONE;
      return { k0: ZERO, m };
    }
    const r = t.info.restr[col.restr];
    if (col.tipo === 'holgura') {
      // s = b − a·x
      return { k0: r.b, m: r.a.map((v) => v.neg()) };
    }
    if (col.tipo === 'exceso') {
      // s = a·x − b
      return { k0: r.b.neg(), m: r.a.slice() };
    }
    return null;
  });
  return exprs;
}

function normalizarEnOriginales(coefs, rhs) {
  let op = '>=';
  const idx = coefs.findIndex((v) => !v.isZero());
  if (idx < 0) return { coefs, op, rhs };
  const p = coefs[idx];
  if (p.lt(ZERO)) op = '<=';
  return { coefs: coefs.map((v) => v.div(p)), op, rhs: rhs.div(p) };
}

function ordenarRegla(t) {
  // Candidatas: básicas enteras con valor fraccionario. Mayor parte fraccionaria.
  // Empate: la fila que aparece primero en el tablero (así el ejemplo del profesor
  // corta primero x2 y no x1, aunque ambas tengan parte fraccionaria 1/2).
  let mejorFila = -1;
  let mejorF = ZERO;
  t.base.forEach((j, i) => {
    if (!t.cols[j].entera) return;
    const f = t.b[i].fractionalPart();
    if (f.isZero()) return;
    const c = f.cmp(mejorF);
    if (mejorFila === -1 || c > 0) {
      mejorFila = i;
      mejorF = f;
    }
  });
  return mejorFila;
}

export function planosDeCorte(modelo, { tipo = 'mixto', maxCortes = 25 } = {}) {
  if (tipo !== 'mixto' && tipo !== 'fraccional') {
    throw new Error('El tipo de corte debe ser "mixto" o "fraccional".');
  }
  const n = modelo.c.length;
  if (tipo === 'fraccional') {
    const integer = Array.from({ length: n }, (_, j) =>
      modelo.integer && modelo.integer[j] !== undefined ? !!modelo.integer[j] : true
    );
    const ok =
      integer.every(Boolean) &&
      modelo.c.every((v) => frac(v).isInteger()) &&
      modelo.constraints.every((r) => r.a.every((v) => frac(v).isInteger()) && frac(r.b).isInteger());
    if (!ok) {
      throw new Error(
        'El corte fraccional exige un problema entero puro (todas las variables enteras) con coeficientes y lados derechos enteros.'
      );
    }
  }

  const tableroInicial = construirTablero(modelo);
  const primal = simplexPrimal(tableroInicial);
  const lp = {
    estado: primal.estado,
    z: null,
    x: null,
    tableroInicial,
    tablero: primal.tablero,
    iteraciones: primal.iteraciones,
  };
  if (primal.estado !== 'optimo') {
    return {
      estado: primal.estado,
      z: null,
      x: null,
      lp,
      tableroInicial,
      tableroFinal: primal.tablero,
      cortes: [],
    };
  }
  let t = limpiarArtificiales(primal.tablero);
  lp.z = t.zval.a;
  lp.x = solucionOriginal(t);
  lp.tablero = t;

  const exprs = expresionBase(t);
  const cortes = [];
  let estado = 'optimo';

  for (;;) {
    const fi = ordenarRegla(t);
    if (fi === -1) break;
    if (cortes.length >= maxCortes) {
      estado = 'limite_de_cortes';
      break;
    }
    const k = cortes.length + 1;
    const colFuente = t.base[fi];
    const noBasicas = t.cols.map((_, j) => j).filter((j) => !t.base.includes(j) && !t.A[fi][j].isZero());
    const filaFuente = {
      nombre: t.cols[colFuente].nombre,
      coefs: noBasicas.map((j) => ({ nombre: t.cols[j].nombre, a: t.A[fi][j], entera: t.cols[j].entera })),
      b: t.b[fi],
    };
    const { f0, coefs: cs, rhs } = cortePlanoDeFila(
      { b: filaFuente.b, coefs: filaFuente.coefs },
      { tipo }
    );
    const coefsNombrados = noBasicas.map((j, i) => ({ nombre: t.cols[j].nombre, valor: cs[i] }));

    // Expresado en las variables originales
    const m = Array(n).fill(ZERO);
    let k0 = ZERO;
    noBasicas.forEach((j, i) => {
      const e = exprs[j];
      k0 = k0.add(cs[i].mul(e.k0));
      for (let q = 0; q < n; q++) m[q] = m[q].add(cs[i].mul(e.m[q]));
    });
    const enOriginales = normalizarEnOriginales(m, rhs.sub(k0));

    // Nueva columna S_k y nueva fila:  −Σ coef_j x_j + S_k = −rhs
    const nombreS = `S${k}`;
    const colS = t.cols.length;
    const cols = [...t.cols, { nombre: nombreS, tipo: 'corte', entera: tipo === 'fraccional' }];
    const c = [...t.c, BM(ZERO, ZERO)];
    const A = t.A.map((f) => [...f, ZERO]);
    const filaNueva = Array(colS + 1).fill(ZERO);
    noBasicas.forEach((j, i) => {
      filaNueva[j] = cs[i].neg();
    });
    filaNueva[colS] = ONE;
    A.push(filaNueva);
    const conCorte = recalcular({
      ...t,
      cols,
      c,
      A,
      b: [...t.b, rhs.neg()],
      base: [...t.base, colS],
    });

    // S_k = Σ coef_j x_j − rhs  en función de las originales
    exprs.push({ k0: ZERO.sub(rhs).add(k0), m: m.slice() });

    const dual = simplexDual(conCorte);
    cortes.push({
      k,
      colFuente,
      filaFuente,
      f0,
      coefs: coefsNombrados,
      rhs,
      enOriginales,
      tableroAntes: t,
      tableroConCorte: conCorte,
      dual: { estado: dual.estado, iteraciones: dual.iteraciones, tableroDespues: dual.tablero },
    });
    t = dual.tablero;
    if (dual.estado === 'infactible') {
      estado = 'infactible';
      break;
    }
  }

  const ok = estado === 'optimo' || estado === 'limite_de_cortes';
  return {
    estado,
    z: ok ? t.zval.a : null,
    x: ok ? solucionOriginal(t) : null,
    lp,
    tableroInicial,
    tableroFinal: t,
    cortes,
  };
}
