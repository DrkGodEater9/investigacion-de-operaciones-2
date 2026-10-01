import { useMemo } from 'react';
import { analyze } from '../domain/analyze.js';

/** Deriva toda la solución (red, tiempos, rutas) a partir del estado editable. */
export function useAnalysis(project) {
  const { rows, mode, decimals } = project;
  return useMemo(() => {
    try {
      return analyze({ rows, mode, decimals });
    } catch (err) {
      console.error(err);
      return { ok: false, errors: [{ row: null, msg: 'No se pudo construir la red con estos datos: ' + err.message }], warnings: [] };
    }
  }, [rows, mode, decimals]);
}
