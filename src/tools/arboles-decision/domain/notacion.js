/**
 * Notación y reglas de método del tema 2.2 en UN solo lugar, para cambiarlas cuando
 * llegue el material oficial del curso (todo el texto de la herramienta sale de aquí).
 */
export const NOTACION = {
  /** Nombre de cada tipo de nodo (la figura usa cuadrado para decisión y círculo para azar). */
  decision: 'Decisión',
  azar: 'Azar',
  final: 'Resultado',
  /** Sigla del valor esperado que se escribe en cada nodo de azar. */
  valorEsperado: 'VE',
  /** Valor de un nodo de decisión (el de la mejor rama). */
  valorDecision: 'Valor',
  /** Palabra para la cantidad de las ramas y de las hojas. */
  pago: 'pago',
  valorFinal: 'valor',
  /** Nombre del objetivo en cada sentido. */
  max: 'maximizar (utilidad, ganancia)',
  min: 'minimizar (costo)',
  /** Etiqueta de la rama descartada en un nodo de decisión. */
  podada: 'descartada',
};

/**
 * Reglas de método.
 *  - empate: en un nodo de decisión con ramas igual de buenas se elige la primera (de arriba abajo)
 *    y se avisa del empate.
 *  - pagosEnRamas: los pagos de las ramas se acumulan hacia atrás junto con el valor del nodo siguiente
 *    (valor de la rama = pago de la rama + valor del nodo al que llega). Un árbol con pagos solo en las
 *    hojas es el caso particular con todos los pagos de rama en 0.
 */
export const REGLAS = {
  empate: 'primera',
  pagosEnRamas: true,
  tolerancia: 1e-9,
  toleranciaProb: 1e-6,
};
