import { fmt } from '../../ruta-critica/domain/format.js';

/** Número en formato es-CO (coma decimal), con hasta 2 decimales y sin separador de miles. */
export const num = (x, dec = 2) => fmt(x, dec).replace('-', '−');

/** Número con punto decimal, para CSV. */
export const crudo = (x) => {
  let r = Math.round(x * 1e4) / 1e4;
  if (r === 0) r = 0;
  return String(r);
};

/** «A, B y C». */
export function lista(nombres) {
  if (nombres.length <= 1) return nombres.join('');
  return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
}

/** «una unidad» / «3 unidades». */
export const unidades = (k) => (k === 1 ? '1 unidad' : `${k} unidades`);
