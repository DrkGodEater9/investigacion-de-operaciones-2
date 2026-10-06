/**
 * Índice del curso: ÚNICA fuente de verdad del menú, la portada y las rutas.
 * Sale del syllabus de Investigación de operaciones II y del índice del Moodle.
 *
 * Para agregar o renombrar un tema solo se toca este archivo.
 *  - id:        se usa en la URL (#/t/<id>), en topics/<id>/ y en registry.js
 *  - subtopics: lista del syllabus (aparece en la pestaña Teoría mientras no esté escrita)
 *  - plan:      qué tendrá cada pestaña cuando se construya (se muestra mientras está pendiente)
 */
export const COURSE = {
  title: 'Investigación de operaciones II',
  program: 'Ingeniería de Sistemas',
  intro:
    'Un lugar para estudiar cada tema del curso, ver el paso a paso de cómo se resuelve y practicar con tus propios ejercicios.',
};

export const MODULES = [
  {
    id: 'entera',
    number: 1,
    title: 'Programación entera',
    summary: 'Modelos de optimización donde algunas o todas las variables deben tomar valores enteros.',
    topics: [
      {
        id: 'entera-pura',
        number: '1.1',
        title: 'Programación entera pura',
        summary: 'Problemas de programación lineal donde todas las variables deben ser enteras.',
        subtopics: [],
        plan: {
          paso: 'Ramificación y acotamiento (Branch & Bound) animado: se resuelve la relajación lineal, se ramifica en una variable fraccionaria y se poda el árbol nodo por nodo.',
          resuelve: 'Ingresas el modelo (máximo o mínimo, restricciones) y ves la región factible con los puntos enteros, el óptimo lineal, el óptimo entero y el árbol de ramificación.',
          practica: 'Ejercicios de redondear frente a hallar el óptimo entero, y de completar el árbol de ramificación, con corrección.',
        },
      },
      {
        id: 'entera-mixta',
        number: '1.2',
        title: 'Programación entera mixta',
        summary: 'Programación lineal donde solo una parte de las variables debe ser entera.',
        subtopics: [],
        plan: {
          paso: 'Branch & Bound donde solo se ramifica en las variables enteras; las continuas pueden quedar fraccionarias.',
          resuelve: 'El mismo solucionador de la entera pura, marcando qué variables son enteras y cuáles continuas.',
          practica: 'Ejercicios de identificar en qué variable ramificar y cuándo podar, con corrección.',
        },
      },
      {
        id: 'entera-binaria',
        number: '1.3',
        title: 'Programación entera binaria',
        summary: 'Variables que solo toman los valores 0 o 1, para modelar decisiones de sí o no.',
        subtopics: [],
        plan: {
          paso: 'Enumeración de las 2ⁿ combinaciones y método aditivo de Balas (enumeración implícita) animado, nodo por nodo.',
          resuelve: 'Ingresas costos, beneficios y condiciones lógicas, y obtienes la mejor combinación por enumeración o con el método aditivo de Balas.',
          practica: 'Ejercicios de modelado: dado el enunciado, elegir las restricciones correctas.',
        },
      },
    ],
  },
  {
    id: 'decision',
    number: 2,
    title: 'Análisis de decisión',
    summary: 'Cómo elegir la mejor alternativa cuando hay incertidumbre.',
    topics: [
      {
        id: 'decision-bayes',
        number: '2.1',
        title: 'Teoría bayesiana de la decisión',
        summary: 'Actualizar las probabilidades con nueva información antes de decidir.',
        subtopics: [],
        plan: {
          paso: 'Del teorema de Bayes a la tabla de probabilidades a priori, verosimilitud, conjunta y posterior, y de ahí al valor esperado de la información.',
          resuelve: 'Ingresas la matriz de pagos, las probabilidades a priori y la fiabilidad de la información; calcula las posteriores, la decisión óptima y el valor de la información.',
          practica: 'Problemas de texto que piden las probabilidades posteriores y la decisión, con corrección.',
        },
      },
      {
        id: 'decision-arboles',
        number: '2.2',
        title: 'Árboles de decisión',
        summary: 'Representar una decisión secuencial con nodos de decisión y de azar, y resolverla hacia atrás.',
        subtopics: [],
        plan: {
          paso: 'Inducción hacia atrás animada: se calcula el valor esperado de cada nodo de azar y se elige la mejor rama en cada nodo de decisión.',
          resuelve: 'Editor del árbol donde agregas nodos, ramas, probabilidades y pagos; marca el camino óptimo y permite ver qué pasa si cambia una probabilidad.',
          practica: 'Árboles para completar y ejercicios de interpretar el camino óptimo, con corrección.',
        },
      },
    ],
  },
  {
    id: 'redes',
    number: 3,
    title: 'Técnicas de planeación de redes',
    summary: 'Planear, programar y controlar proyectos representándolos como una red de actividades.',
    topics: [
      {
        id: 'redes-estructura',
        number: '3.1',
        title: 'Análisis de la estructura',
        summary: 'Cómo se representa un proyecto como red: actividades, eventos, ficticias y numeración.',
        subtopics: [
          'Elementos básicos del diagrama de redes',
          'Formas y propiedades de la representación gráfica',
          'Numeración del diagrama de redes',
        ],
        plan: {
          paso: 'Construcción de la red actividad por actividad, mostrando en qué momento hace falta una ficticia.',
          resuelve: 'Pegas o escribes la tabla de actividades y predecesoras, y se dibuja la red con el mínimo de ficticias.',
          practica: 'Ejercicios de dibujar la red desde la tabla, con verificación de las dependencias.',
        },
      },
      {
        id: 'redes-tiempos',
        number: '3.2',
        title: 'Análisis del tiempo',
        summary: 'Duración del proyecto, ruta crítica y holguras con CPM, y la incertidumbre con PERT.',
        subtopics: [
          'Análisis del tiempo por el método CPM',
          'Actividad crítica y la ruta crítica',
          'Determinación de las holguras',
          'Análisis del tiempo por el método PERT',
          'Determinación del tiempo esperado y de la varianza',
        ],
        plan: {
          paso: 'Pase hacia adelante y hacia atrás animado, holguras y cómo se identifica la ruta crítica.',
          resuelve: 'CPM y PERT con diagrama, tablas, rutas, Gantt, probabilidades y PDF.',
          practica: 'Ejercicios con los tiempos para completar y autocorrección.',
        },
      },
      {
        id: 'redes-costos',
        number: '3.3',
        title: 'Análisis de costos',
        summary: 'Acortar un proyecto al menor costo: PERT/COSTO con duración normal y límite.',
        subtopics: [
          'Análisis de costos por el método PERT/COSTO',
          'Determinación de la duración normal y límite de las actividades',
        ],
        plan: {
          paso: 'Reducción de la duración paso a paso: se acelera la actividad crítica de menor costo por unidad de tiempo hasta llegar al límite o hasta que cambie la ruta crítica.',
          resuelve: 'Ingresas duración y costo normal y límite de cada actividad; calcula las pendientes de costo, la secuencia de reducciones y la curva costo-duración.',
          practica: 'Ejercicios de hallar la duración de costo mínimo, con corrección.',
        },
      },
      {
        id: 'redes-recursos',
        number: '3.4',
        title: 'Distribución de recursos',
        summary: 'Programar las actividades cuando los recursos disponibles son limitados.',
        subtopics: ['Distribución óptima de recursos limitados en función del tiempo'],
        plan: {
          paso: 'Del Gantt con holguras al histograma de recursos: se detectan los picos y se retrasan actividades no críticas hasta respetar el límite.',
          resuelve: 'Ingresas los recursos por actividad y el límite disponible; muestra el histograma antes y después de la distribución, y la nueva duración.',
          practica: 'Ejercicios de nivelar o limitar recursos, con corrección.',
        },
      },
    ],
  },
];

/** Las cuatro partes de cada tema, en orden. */
export const SLOTS = [
  { id: 'teoria', label: 'Teoría', hint: 'Explicación corta, con dibujos' },
  { id: 'paso', label: 'Paso a paso', hint: 'Un ejemplo resuelto que avanza de a un paso' },
  { id: 'resuelve', label: 'Resuelve el tuyo', hint: 'Calculadora donde ingresas tu ejercicio' },
  { id: 'practica', label: 'Práctica', hint: 'Ejercicios con corrección' },
];

// ---- Utilidades derivadas (no se editan) ----------------------------------
export const TOPICS = MODULES.flatMap((m) => m.topics.map((t) => ({ ...t, moduleId: m.id, moduleNumber: m.number, moduleTitle: m.title })));
export const topicById = (id) => TOPICS.find((t) => t.id === id);
export const moduleById = (id) => MODULES.find((m) => m.id === id);
export const neighbors = (id) => {
  const i = TOPICS.findIndex((t) => t.id === id);
  return { prev: TOPICS[i - 1] || null, next: TOPICS[i + 1] || null };
};
