/**
 * Nombres y siglas del tema 2.1, en un solo lugar para ajustarlos al material del profesor.
 * (Pendiente de confirmar con el material oficial: siglas, y si «VEIM» es la ganancia o el valor total.)
 *
 * Convención actual:
 *   VEcIP = valor esperado con información perfecta   (valor total)
 *   VEIP  = VEcIP − VE sin información                (ganancia; en costos: VE sin info − VEcIP)
 *   VEcIM = valor esperado con información muestral   (valor total)
 *   VEIM  = VEcIM − VE sin información                (ganancia; en costos: VE sin info − VEcIM)
 *   Eficiencia = VEIM / VEIP
 */
export const NOTACION = {
  ve: 'VE',
  vesi: 'VE sin información',
  vecip: 'VEcIP',
  vecipLargo: 'valor esperado con información perfecta',
  veip: 'VEIP',
  veipLargo: 'valor esperado de la información perfecta',
  vecim: 'VEcIM',
  vecimLargo: 'valor esperado con información muestral',
  veim: 'VEIM',
  veimLargo: 'valor esperado de la información muestral',
  eficiencia: 'Eficiencia',
  priori: 'a priori',
  posteriori: 'posterior',
  verosimilitud: 'verosimilitud',
};

/** Textos que dependen de si los pagos son utilidades (max) o costos (min). */
export function palabrasObjetivo(objetivo) {
  return objetivo === 'max'
    ? { pagos: 'utilidades', mejor: 'mayor', peor: 'menor', accion: 'maximiza', regla: 'máximo', ganancia: 'ganancia' }
    : { pagos: 'costos', mejor: 'menor', peor: 'mayor', accion: 'minimiza', regla: 'mínimo', ganancia: 'ahorro' };
}
