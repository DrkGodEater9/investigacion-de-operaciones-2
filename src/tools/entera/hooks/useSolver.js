import { useMemo } from 'react';
import { solveIP } from '../domain/branchAndBound.js';
import { parseFraction, frac } from '../domain/fraction.js';
import { get2DFeasibleRegion, get2DIntegerPoints } from '../domain/geometry.js';

export function useSolver(model) {
  return useMemo(() => {
    const errors = [];
    const warnings = [];

    // 1. Validar coeficientes de la función objetivo
    const parsedC = [];
    for (let j = 0; j < model.numVars; j++) {
      const raw = model.c[j];
      if (raw === undefined || raw === null || String(raw).trim() === '') {
        errors.push({
          field: `c_${j}`,
          msg: `El coeficiente de x${j + 1} en la función objetivo está vacío.`,
        });
      } else {
        try {
          parsedC.push(parseFraction(String(raw)));
        } catch {
          errors.push({
            field: `c_${j}`,
            msg: `El coeficiente de x${j + 1} ("${raw}") no es un número o fracción válida.`,
          });
        }
      }
    }

    // 2. Validar restricciones
    const parsedCts = [];
    model.constraints.forEach((ct, i) => {
      const rowNum = i + 1;
      const parsedA = [];
      let allZeros = true;

      for (let j = 0; j < model.numVars; j++) {
        const raw = ct.a[j];
        if (raw === undefined || raw === null || String(raw).trim() === '') {
          errors.push({
            field: `a_${i}_${j}`,
            msg: `En la restricción R${rowNum}, el coeficiente de x${j + 1} está vacío.`,
          });
        } else {
          try {
            const f = parseFraction(String(raw));
            parsedA.push(f);
            if (!f.isZero()) allZeros = false;
          } catch {
            errors.push({
              field: `a_${i}_${j}`,
              msg: `En la restricción R${rowNum}, el coeficiente de x${j + 1} ("${raw}") no es válido.`,
            });
          }
        }
      }

      if (allZeros) {
        errors.push({
          field: `ct_${i}`,
          msg: `La restricción R${rowNum} no tiene ningún coeficiente distinto de cero.`,
        });
      }

      // Término independiente b
      const rawB = ct.b;
      let parsedB = null;
      if (rawB === undefined || rawB === null || String(rawB).trim() === '') {
        errors.push({
          field: `b_${i}`,
          msg: `En la restricción R${rowNum}, el término independiente b está vacío.`,
        });
      } else {
        try {
          parsedB = parseFraction(String(rawB));
        } catch {
          errors.push({
            field: `b_${i}`,
            msg: `En la restricción R${rowNum}, el término independiente b ("${rawB}") no es válido.`,
          });
        }
      }

      if (parsedA.length === model.numVars && parsedB !== null) {
        parsedCts.push({ a: parsedA, op: ct.op, b: parsedB });
      }
    });

    if (errors.length > 0) {
      return {
        ok: false,
        errors,
        warnings,
        result: null,
        region2D: null,
        integerPoints2D: null,
      };
    }

    // Ejecutar solveIP
    let result = null;
    try {
      result = solveIP({
        sense: model.sense,
        c: parsedC,
        constraints: parsedCts,
        integer: model.integer,
        options: model.options,
      });
    } catch (err) {
      errors.push({ field: 'solver', msg: `Error de cálculo: ${err.message}` });
      return {
        ok: false,
        errors,
        warnings,
        result: null,
        region2D: null,
        integerPoints2D: null,
      };
    }

    // Geometría 2D si son 2 variables
    let region2D = null;
    let integerPoints2D = null;

    if (model.numVars === 2 && (result.status === 'optimal' || result.status === 'infeasible')) {
      try {
        region2D = get2DFeasibleRegion(parsedCts);
        if (region2D.status === 'ok' && region2D.isBounded) {
          integerPoints2D = get2DIntegerPoints(parsedCts, region2D.bounds);
        }
      } catch {
        // Si la región es degenerada o tiene error, se omite el dibujo
      }
    }

    return {
      ok: true,
      errors: [],
      warnings,
      result,
      region2D,
      integerPoints2D,
    };
  }, [model]);
}
