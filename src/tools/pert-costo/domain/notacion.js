/**
 * Notación y rótulos de la herramienta, en un solo lugar para cambiarlos fácil
 * cuando se tenga el material oficial del curso (nombres de columnas, símbolos, orden).
 */
export const NOTACION = {
  // Símbolos que aparecen en fórmulas y encabezados cortos
  dn: 'DN',
  dl: 'DL',
  cn: 'CN',
  cl: 'CL',
  pendiente: 'Pendiente',
  ci: 'CI',
  // Nombres largos
  nombre: {
    name: 'Actividad',
    preds: 'Predecesoras',
    dn: 'Duración normal',
    cn: 'Costo normal',
    dl: 'Duración límite',
    cl: 'Costo límite',
  },
  // Orden de las columnas en la tabla y en el Markdown
  columnas: ['name', 'preds', 'dn', 'cn', 'dl', 'cl'],
  // Texto de las líneas de costo indirecto en el Markdown
  lineaIndirecto: 'Costo indirecto por unidad de tiempo',
  lineaFijo: 'Costo indirecto fijo',
  // Fórmula de la pendiente, como texto
  formulaPendiente: 'Pendiente = (CL − CN) / (DN − DL)',
};

/** Encabezados de columna con el rótulo largo. */
export const encabezados = () => NOTACION.columnas.map((c) => NOTACION.nombre[c]);
