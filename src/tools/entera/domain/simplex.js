import { Fraction, ZERO, ONE, frac } from './fraction.js';

/**
 * Solucionador Simplex exacto de dos fases con regla de Bland.
 * Opera 100% sobre fracciones exactas (BigInt).
 * 
 * Convención unificada:
 * Fila 0 almacena los costos reducidos: r_j = c_j - c_B^T A_j.
 * Valor objetivo actual: Z_0 = c_B^T b (almacenado en tableau[0][RHS]).
 * En maximización:
 * - Una variable con r_j > 0 mejora el objetivo si entra a la base.
 * - Óptimo si r_j <= 0 para todas las variables no básicas.
 * - Regla de Bland: menor índice de columna con r_j > 0; menor índice de básica en empates de razón mínima.
 */
export function solveLP({ sense = 'max', c, constraints }) {
  const n = c.length;
  const m = constraints.length;

  if (m === 0) {
    const isMax = sense === 'max';
    const cFracs = c.map((v) => frac(v));
    const allZero = cFracs.every((v) => v.isZero());
    if (allZero) {
      return { status: 'optimal', x: Array(n).fill(ZERO), z: ZERO };
    }
    const hasUnbounded = cFracs.some((v) => (isMax ? v.gt(ZERO) : v.lt(ZERO)));
    if (hasUnbounded) {
      return { status: 'unbounded', x: null, z: null };
    }
    return { status: 'optimal', x: Array(n).fill(ZERO), z: ZERO };
  }

  const isMin = sense === 'min';
  // Maximizar cTarget^T x: si era min c^T x, maximizamos (-c)^T x
  const cTarget = c.map((val) => {
    const f = frac(val);
    return isMin ? f.neg() : f;
  });

  // Normalizar restricciones para que b_i >= 0
  const normalized = constraints.map((ct) => {
    let a = ct.a.map((v) => frac(v));
    let b = frac(ct.b);
    let op = ct.op;

    if (b.lt(ZERO)) {
      a = a.map((v) => v.neg());
      b = b.neg();
      if (op === '<=') op = '>=';
      else if (op === '>=') op = '<=';
    }
    return { a, op, b };
  });

  // Construcción de columnas:
  // 0 .. n-1: variables originales x_j
  // luego holguras / excesos / artificiales
  const varCols = []; // { type: 'x'|'slack'|'surplus'|'art', id }
  for (let j = 0; j < n; j++) {
    varCols.push({ type: 'x', origIdx: j });
  }

  let nextCol = n;
  const rowInfo = [];

  normalized.forEach((ct, i) => {
    if (ct.op === '<=') {
      const col = nextCol++;
      varCols.push({ type: 'slack', row: i });
      rowInfo.push({ slackCol: col, surplusCol: -1, artCol: -1 });
    } else if (ct.op === '>=') {
      const surCol = nextCol++;
      varCols.push({ type: 'surplus', row: i });
      const artCol = nextCol++;
      varCols.push({ type: 'art', row: i });
      rowInfo.push({ slackCol: -1, surplusCol: surCol, artCol });
    } else if (ct.op === '=') {
      const artCol = nextCol++;
      varCols.push({ type: 'art', row: i });
      rowInfo.push({ slackCol: -1, surplusCol: -1, artCol });
    } else {
      throw new Error(`Operador no soportado: ${ct.op}`);
    }
  });

  const totalCols = nextCol;
  const rhsCol = totalCols;
  const numRows = m + 1; // fila 0: costos reducidos

  // tableau[0..m][0..totalCols]
  const tableau = Array.from({ length: numRows }, () =>
    Array.from({ length: totalCols + 1 }, () => ZERO)
  );

  // Llenar filas de restricciones 1..m
  normalized.forEach((ct, i) => {
    const row = i + 1;
    for (let j = 0; j < n; j++) {
      tableau[row][j] = ct.a[j] || ZERO;
    }
    tableau[row][rhsCol] = ct.b;

    const info = rowInfo[i];
    if (info.slackCol >= 0) tableau[row][info.slackCol] = ONE;
    if (info.surplusCol >= 0) tableau[row][info.surplusCol] = ONE.neg();
    if (info.artCol >= 0) tableau[row][info.artCol] = ONE;
  });

  // Base inicial para las filas 1..m
  const basis = [];
  normalized.forEach((ct, i) => {
    const info = rowInfo[i];
    basis.push(info.artCol >= 0 ? info.artCol : info.slackCol);
  });

  const hasArtificials = rowInfo.some((info) => info.artCol >= 0);

  // Función de pivoteo
  function pivot(pRow, pCol) {
    const pivotElem = tableau[pRow][pCol];
    if (pivotElem.isZero()) throw new Error('Pivote en elemento nulo');

    // Dividir fila pivote por el pivote
    for (let j = 0; j <= rhsCol; j++) {
      tableau[pRow][j] = tableau[pRow][j].div(pivotElem);
    }

    // Actualizar todas las demás filas (incluida la fila 0 de costos reducidos)
    for (let i = 0; i < numRows; i++) {
      if (i === pRow) continue;
      const factor = tableau[i][pCol];
      if (factor.isZero()) continue;

      for (let j = 0; j <= rhsCol; j++) {
        tableau[i][j] = tableau[i][j].sub(factor.mul(tableau[pRow][j]));
      }
    }

    basis[pRow - 1] = pCol;
  }

  // Bucle genérico del simplex para maximizar
  // activeCols: filtro para excluir variables artificiales en Fase 2
  function runSimplex(allowColFn) {
    const MAX_ITER = 5000;
    let iter = 0;

    while (iter++ < MAX_ITER) {
      // 1. Variable entrante: menor índice con costo reducido > 0 (Regla de Bland)
      let enterCol = -1;
      for (let j = 0; j < totalCols; j++) {
        if (!allowColFn(j)) continue;
        if (tableau[0][j].gt(ZERO)) {
          enterCol = j;
          break;
        }
      }

      if (enterCol === -1) {
        // Óptimo alcanzado
        return 'optimal';
      }

      // 2. Variable saliente: prueba de razón mínima b_i / a_ik con a_ik > 0
      let leaveRow = -1;
      let minRatio = null;

      for (let i = 1; i <= m; i++) {
        const a_ik = tableau[i][enterCol];
        if (a_ik.gt(ZERO)) {
          const ratio = tableau[i][rhsCol].div(a_ik);
          if (minRatio === null || ratio.lt(minRatio)) {
            minRatio = ratio;
            leaveRow = i;
          } else if (ratio.eq(minRatio)) {
            // Desempate por regla de Bland: menor índice de la variable básica actual
            if (basis[i - 1] < basis[leaveRow - 1]) {
              leaveRow = i;
            }
          }
        }
      }

      if (leaveRow === -1) {
        // Ningún elemento estrictamente positivo en la columna entrante: no acotado
        return 'unbounded';
      }

      pivot(leaveRow, enterCol);
    }

    return 'unbounded';
  }

  // ==========================================
  // FASE 1: Minimizar sum(artificiales) <=> Maximizar -sum(artificiales)
  // ==========================================
  if (hasArtificials) {
    // En Fase 1: para columnas no artificiales, r_j = sum_{i in art} A_{ij}.
    // Para columnas artificiales, r_j = 0 (están en la base).
    for (let j = 0; j <= rhsCol; j++) {
      tableau[0][j] = ZERO;
    }

    for (let i = 0; i < m; i++) {
      if (varCols[basis[i]].type === 'art') {
        const row = i + 1;
        for (let j = 0; j < totalCols; j++) {
          if (varCols[j].type !== 'art') {
            tableau[0][j] = tableau[0][j].add(tableau[row][j]);
          }
        }
        tableau[0][rhsCol] = tableau[0][rhsCol].sub(tableau[row][rhsCol]);
      }
    }

    // Correr Simplex Fase 1 (las variables artificiales nunca deben entrar a la base)
    runSimplex((j) => varCols[j].type !== 'art');

    // Verificar factibilidad:
    // El problema es factible sii todas las variables artificiales valen 0.
    for (let i = 0; i < m; i++) {
      if (varCols[basis[i]].type === 'art') {
        if (tableau[i + 1][rhsCol].gt(ZERO)) {
          return { status: 'infeasible', x: null, z: null };
        }
      }
    }

    // Si alguna variable artificial sigue básica con valor 0:
    for (let i = 0; i < m; i++) {
      if (varCols[basis[i]].type === 'art') {
        const row = i + 1;
        // Buscar columna no artificial y no básica con elemento no nulo para pivotear
        let candCol = -1;
        for (let j = 0; j < totalCols; j++) {
          if (varCols[j].type !== 'art' && !tableau[row][j].isZero() && !basis.includes(j)) {
            candCol = j;
            break;
          }
        }
        if (candCol >= 0) {
          pivot(row, candCol);
        }
      }
    }
  }

  // ==========================================
  // FASE 2: Maximizar cTarget^T x
  // ==========================================
  // Calcular costos reducidos para Fase 2:
  // r_j = c_j - sum_i c_{B_i} * A_{ij}
  // Z_0 = sum_i c_{B_i} * b_i
  for (let j = 0; j <= rhsCol; j++) {
    tableau[0][j] = ZERO;
  }

  // Inicializar con cTarget_j para las variables originales
  for (let j = 0; j < n; j++) {
    tableau[0][j] = cTarget[j];
  }

  // Restar c_{B_i} * A_i
  for (let i = 0; i < m; i++) {
    const basicCol = basis[i];
    const cB = basicCol < n ? cTarget[basicCol] : ZERO;
    if (!cB.isZero()) {
      const row = i + 1;
      for (let j = 0; j < totalCols; j++) {
        tableau[0][j] = tableau[0][j].sub(cB.mul(tableau[row][j]));
      }
      tableau[0][rhsCol] = tableau[0][rhsCol].add(cB.mul(tableau[row][rhsCol]));
    }
  }

  // Correr Simplex Fase 2 (ignorando columnas artificiales)
  const p2Status = runSimplex((j) => varCols[j].type !== 'art');

  if (p2Status === 'unbounded') {
    return { status: 'unbounded', x: null, z: null };
  }

  // Extraer solución x
  const xSol = Array(n).fill(ZERO);
  for (let i = 0; i < m; i++) {
    const basicCol = basis[i];
    if (basicCol < n) {
      xSol[basicCol] = tableau[i + 1][rhsCol];
    }
  }

  // Calcular valor óptimo Z con la función objetivo original
  let finalZ = ZERO;
  for (let j = 0; j < n; j++) {
    finalZ = finalZ.add(frac(c[j]).mul(xSol[j]));
  }

  return {
    status: 'optimal',
    x: xSol,
    z: finalZ,
  };
}
