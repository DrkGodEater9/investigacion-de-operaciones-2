/**
 * Datos y plantillas didácticas para la pestaña «Práctica» de Programación Entera Pura.
 */

/**
 * Plantillas contextualizadas para ejercicios de modelado en texto (Tipo C).
 * Cada plantilla describe un escenario de toma de decisiones indivisibles.
 */
export const MODEL_TEMPLATES = [
  {
    id: 'servidores',
    context: 'Un centro de datos debe adquirir dos tipos de servidores (Tipo A y Tipo B) para procesar solicitudes de red.',
    itemA: 'servidores Tipo A',
    itemB: 'servidores Tipo B',
    unit: 'servidores',
    varA: 'x₁',
    varB: 'x₂',
    benefitName: 'capacidad de procesamiento (miles de peticiones/s)',
    cost1Name: 'consumo eléctrico (kW)',
    cost2Name: 'espacio en rack (unidades U)',
    cBase: [5, 4],
    ct1Base: [1, 1],
    b1Base: 5,
    ct2Base: [10, 6],
    b2Base: 45,
    storyText: (c1, c2, a11, a12, b1, a21, a22, b2) =>
      `Un centro de cómputo planea adquirir servidores Tipo A (x₁) y Tipo B (x₂). Cada servidor Tipo A procesa ${c1} mil peticiones/segundo, consume ${a11} kW de energía y ocupa ${a21} unidades de rack. Cada servidor Tipo B procesa ${c2} mil peticiones/segundo, consume ${a12} kW y ocupa ${a22} unidades de rack. Se dispone de un máximo de ${b1} kW de energía y ${b2} unidades de espacio en rack. Obviamente, los servidores son equipos indivisibles que deben adquirirse en cantidades enteras no negativas. Se desea maximizar la capacidad total de procesamiento.`,
  },
  {
    id: 'ingenieros',
    context: 'Una firma de consultoría tecnológica asigna ingenieros sénior e ingenieros júnior a proyectos críticos.',
    itemA: 'ingenieros sénior',
    itemB: 'ingenieros júnior',
    unit: 'profesionales',
    varA: 'x₁',
    varB: 'x₂',
    benefitName: 'puntos de historia completados por semana',
    cost1Name: 'horas de supervisión disponibles',
    cost2Name: 'presupuesto semanal de viáticos (millones COP)',
    cBase: [6, 5],
    ct1Base: [2, 1],
    b1Base: 8,
    ct2Base: [3, 4],
    b2Base: 18,
    storyText: (c1, c2, a11, a12, b1, a21, a22, b2) =>
      `Una empresa de software debe conformar un equipo de trabajo con ingenieros sénior (x₁) e ingenieros júnior (x₂). Cada ingeniero sénior entrega ${c1} puntos de historia por sprint, requiere ${a11} horas de inducción técnica y ${a21} millones de pesos en licencias especializadas. Cada ingeniero júnior entrega ${c2} puntos, requiere ${a12} horas de inducción y ${a22} millones en licencias. La empresa cuenta como máximo con ${b1} horas de inducción y un presupuesto de ${b2} millones. No se pueden contratar fracciones de personas. Se busca maximizar la productividad total del equipo.`,
  },
  {
    id: 'maquinaria',
    context: 'Una fábrica automatizada evalúa la instalación de robots soldadores y robots ensambladores.',
    itemA: 'robots soldadores',
    itemB: 'robots ensambladores',
    unit: 'máquinas',
    varA: 'x₁',
    varB: 'x₂',
    benefitName: 'unidades producidas por turno',
    cost1Name: 'tiempo de mantenimiento preventivo (h)',
    cost2Name: 'aire comprimido requerido (m³)',
    cBase: [7, 4],
    ct1Base: [2, 1],
    b1Base: 9,
    ct2Base: [4, 5],
    b2Base: 26,
    storyText: (c1, c2, a11, a12, b1, a21, a22, b2) =>
      `Una planta de manufactura desea instalar robots soldadores (x₁) y ensambladores (x₂). Cada robot soldador produce ${c1} piezas/turno, requiere ${a11} horas de mantenimiento semanal y ${a21} m³ de aire comprimido. Cada robot ensamblador produce ${c2} piezas/turno, requiere ${a12} horas de mantenimiento y ${a22} m³ de aire. Se tienen como máximo ${b1} horas de mantenimiento y ${b2} m³ de aire comprimido por semana. Las máquinas son unidades enteras. Se desea maximizar la producción semanal.`,
  },
];

/**
 * Banco de preguntas conceptuales de Verdadero o Falso (Tipo D).
 * Cada pregunta incluye su enunciado, respuesta correcta y retroalimentación pedagógica detallada.
 */
export const TRUE_FALSE_BANK = [
  {
    id: 'tf-cota-max',
    statement:
      'En un problema de maximización entera, la función objetivo de la relajación lineal (Z_relajado) proporciona una cota superior insuperable para el óptimo entero (Z_entero ≤ Z_relajado).',
    isTrue: true,
    explanation:
      'Verdadero. La relajación lineal amplía el espacio de búsqueda permitiendo cualquier valor continuo. Dado que toda solución entera factible también satisface las restricciones continuas, el valor óptimo de la relajación contiene al óptimo entero y, al maximizar, actúa como cota superior (Z* ≤ Z_rel).',
  },
  {
    id: 'tf-redondeo-garantizado',
    statement:
      'Redondear la solución de la relajación lineal al número entero más cercano garantiza siempre una solución factible para el problema entero.',
    isTrue: false,
    explanation:
      'Falso. El redondeo al entero más cercano con frecuencia produce puntos infactibles que violan una o varias restricciones. Por ejemplo, en el problema de Teoría con solución relajada (3,75; 1,25), el redondeo da (4, 1), el cual viola la segunda restricción (10·4 + 6·1 = 46 > 45).',
  },
  {
    id: 'tf-redondeo-optimo',
    statement:
      'Si al redondear la relajación lineal hacia abajo se obtiene un punto factible, este punto siempre coincide con el óptimo entero.',
    isTrue: false,
    explanation:
      'Falso. Aunque redondear hacia abajo suele ser factible cuando todas las restricciones son de tipo ≤ con coeficientes positivos, no tiene por qué ser óptimo. En el ejemplo de Teoría, redondear (3,75; 1,25) hacia abajo da (3, 1) con Z = 19, mientras que el óptimo entero real es (3, 2) con Z = 23.',
  },
  {
    id: 'tf-poda-piso',
    statement:
      'Si todos los coeficientes de la función objetivo Z son enteros y se busca maximizar, un subproblema con Z_relajado = 23,8 se puede podar inmediatamente si ya se conoce un incumbente con Z* = 23.',
    isTrue: true,
    explanation:
      'Verdadero. Como los coeficientes de Z son enteros, cualquier solución entera que descienda de ese subproblema producirá un Z entero. Por lo tanto, el mayor Z entero posible es ⌊23,8⌋ = 23. Al tener ya un incumbente con Z* = 23, ningún descendiente podrá superar este valor y la rama se poda por cota.',
  },
  {
    id: 'tf-poda-entera',
    statement:
      'Un nodo en el árbol de ramificación y acotamiento se poda inmediatamente si su relajación lineal arroja una solución donde todas las variables son enteras.',
    isTrue: true,
    explanation:
      'Verdadero. Al ser la solución totalmente entera, representa la mejor solución posible dentro de ese subespacio. Si mejora el valor de Z*, se actualiza el incumbente; en cualquier caso, la rama no necesita ramificarse más y se poda por integralidad.',
  },
  {
    id: 'tf-poda-infactible',
    statement:
      'Si un subproblema resulta infactible en su relajación lineal, aún es posible encontrar puntos enteros factibles si continuamos ramificando en sus variables.',
    isTrue: false,
    explanation:
      'Falso. La ramificación solo añade nuevas restricciones al subproblema. Si un sistema ya es incompatible (región factible vacía), agregar restricciones adicionales jamás podrá hacerlo factible. Por tanto, se poda por infactibilidad.',
  },
  {
    id: 'tf-cota-min',
    statement:
      'En un problema de minimización entera, la relajación lineal proporciona una cota inferior para el óptimo entero (Z_entero ≥ Z_relajado).',
    isTrue: true,
    explanation:
      'Verdadero. Al eliminar la restricción de integralidad en minimización, se permite explorar un conjunto mayor de puntos, lo que solo puede mantener o reducir el costo. Por ello, la relajación da una cota inferior insuperable.',
  },
  {
    id: 'tf-vertices-continuos',
    statement:
      'El óptimo de un problema de programación entera pura siempre coincide con alguno de los vértices extremos de la región factible relajada.',
    isTrue: false,
    explanation:
      'Falso. La región factible entera no es un poliedro continuo sino una retícula de puntos aislados. Los vértices del poliedro continuo suelen ser fraccionarios (en el ejemplo de Teoría, (3,75; 1,25)), y el óptimo entero (3, 2) queda en el interior de la región, no en uno de sus vértices; por eso no basta con recorrer los vértices como en el simplex.',
  },
  {
    id: 'tf-franja-descartada',
    statement:
      'Al ramificar sobre una variable fraccionaria x_k con valor v, la franja abierta ⌊v⌋ < x_k < ⌈v⌉ se descarta porque en ella no existe ningún número entero.',
    isTrue: true,
    explanation:
      'Verdadero. Entre un número entero y su consecutivo inmediato no existe ningún otro entero. Al restringir x_k ≤ ⌊v⌋ y x_k ≥ ⌈v⌉ se garantiza que no se pierde ninguna solución entera admisible.',
  },
  {
    id: 'tf-empate-ramificacion',
    statement:
      'La regla estándar de mayor parte fraccionaria para ramificar selecciona la variable cuyo valor {v} = v − ⌊v⌋ esté más alejado de 0, y en caso de empate desempata por el menor subíndice (por ejemplo, x₁ antes que x₂).',
    isTrue: true,
    explanation:
      'Verdadero. Es la convención didáctica establecida en el curso: priorizar la variable con mayor residuo fraccionario para generar cortes profundos temprano, desempatando por orden natural de variables.',
  },
];
