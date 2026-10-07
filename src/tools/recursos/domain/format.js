/** Texto para la pantalla: listas en español y nombres de períodos. */

/** ['A','B','C'] → «A, B y C»; [] → «ninguna». */
export function lista(items, vacio = 'ninguna') {
  const xs = items.map(String);
  if (!xs.length) return vacio;
  if (xs.length === 1) return xs[0];
  return xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1];
}

/** 1 → «1 período», 3 → «3 períodos». */
export const periodos = (n) => `${n} ${n === 1 ? 'período' : 'períodos'}`;

/** Intervalo de períodos que ocupa una actividad que empieza en s con duración d. */
export const rangoPeriodos = (s, d) => (d === 1 ? `período ${s + 1}` : `períodos ${s + 1} a ${s + d}`);

/** Texto de requerimientos «4 Obreros, 1 Grúa» (omite los ceros; «sin recursos» si todos son 0). */
export function textoReq(red, i) {
  const partes = red.recursos.map((nom, k) => (red.r[i][k] > 0 ? `${red.r[i][k]} ${nom}` : null)).filter(Boolean);
  return partes.length ? partes.join(', ') : 'sin recursos';
}

/** Nombres de los períodos con exceso, «períodos 1 y 2». */
export function textoPeriodos(ps) {
  if (!ps.length) return 'ninguno';
  return (ps.length === 1 ? 'período ' : 'períodos ') + lista(ps);
}
