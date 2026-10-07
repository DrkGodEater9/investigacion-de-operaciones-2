/**
 * Notación de la pestaña de tiempos (Teoría, Paso a paso y Práctica del tema 3.2).
 * Es la misma de la tabla de «Resuelve el tuyo». Para cambiarla (por ejemplo a ES, EF, LS, LF)
 * basta editar este objeto: todos los textos de pasos, ejercicios y explicaciones la leen de aquí.
 */
export const NOT = {
  tic: 'TIC', // tiempo de inicio más cercano (temprano)
  tfc: 'TFC', // tiempo de finalización más cercano = TIC + duración
  til: 'TIL', // tiempo de inicio más lejano (tardío)
  tfl: 'TFL', // tiempo de finalización más lejano = TIL + duración
  ht: 'HT', // holgura total
  hl: 'HL', // holgura libre
  T: 'T', // duración del proyecto
  Te: 'Tₑ', // duración esperada del proyecto (PERT)
  te: 'tₑ', // tiempo esperado de una actividad
  v: 'σ²', // varianza
  sd: 'σ', // desviación estándar
};

export const NOMBRE = {
  tic: 'tiempo de inicio más cercano',
  tfc: 'tiempo de finalización más cercano',
  til: 'tiempo de inicio más lejano',
  tfl: 'tiempo de finalización más lejano',
  ht: 'holgura total',
  hl: 'holgura libre',
};
