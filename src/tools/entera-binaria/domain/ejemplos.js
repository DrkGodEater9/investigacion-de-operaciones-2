import { defaultNames } from './modelo.js';

const todos = (n) => Array(n).fill(1);
function modelo(sense, c, constraints, names) {
  return {
    sense,
    names: names || defaultNames(c.length),
    c,
    constraints: constraints.map(([name, a, op, b]) => ({ name, a, op, b })),
  };
}

export const EJEMPLOS = [
  {
    id: 'T1',
    titulo: 'Módulos de software (trabajo en clase 3, ej. 1)',
    enunciado: 'Se pueden activar tres módulos de software con costos 2, 3 y 1. Entre los módulos activados se deben aportar al menos 3 unidades de procesamiento y 4 de memoria. Se busca el menor costo.',
    model: modelo('min', [2, 3, 1], [
      ['Procesamiento', [1, 2, 1], '>=', 3],
      ['Memoria', [2, 1, 2], '>=', 4],
    ]),
    esperado: { z: 6, soluciones: [[1, 1, 1]], factibles: 1 },
  },
  {
    id: 'T2',
    titulo: 'Selección de proyectos (trabajo en clase 3, ej. 2)',
    enunciado: 'Una empresa de software elige entre 3 proyectos con beneficios 50, 40 y 35 y costos 30, 25 y 20. El presupuesto es 50. Se busca el mayor beneficio.',
    model: modelo('max', [50, 40, 35], [['Presupuesto', [30, 25, 20], '<=', 50]]),
    esperado: { z: 85, soluciones: [[1, 0, 1]], factibles: 6 },
  },
  {
    id: 'T3',
    titulo: 'Servidores del centro de datos (trabajo en clase 3, ej. 3)',
    enunciado: 'Se pueden encender tres servidores con consumo 8, 6 y 4 y capacidad 100, 80 y 60. Se necesita una capacidad total de al menos 140 con el menor consumo.',
    model: modelo('min', [8, 6, 4], [['Capacidad', [100, 80, 60], '>=', 140]]),
    esperado: { z: 10, soluciones: [[0, 1, 1]], factibles: 4 },
  },
  {
    id: 'CENTROS',
    titulo: 'Centros de distribución',
    enunciado: 'Se evalúan 5 ubicaciones para centros de distribución con costos 8, 6, 5, 7 y 4. Se pueden abrir a lo sumo 3 y debe abrirse al menos uno en el norte (ubicaciones 1 y 2). Se busca el menor costo.',
    model: modelo('min', [8, 6, 5, 7, 4], [
      ['Máximo 3 centros', [1, 1, 1, 1, 1], '<=', 3],
      ['Al menos uno en el norte', [1, 1, 0, 0, 0], '>=', 1],
    ]),
    esperado: { z: 6, soluciones: [[0, 1, 0, 0, 0]], factibles: 18 },
  },
  {
    id: 'MOCHILA_EXCL',
    titulo: 'Mochila con exclusiones',
    enunciado: 'Cinco elementos con valores 8, 6, 5, 9 y 7 y pesos 4, 2, 3, 5 y 3; capacidad 10. Los elementos 1 y 3 no pueden ir juntos, ni tampoco el 2 y el 4. Se busca el mayor valor.',
    model: modelo('max', [8, 6, 5, 9, 7], [
      ['Presupuesto', [4, 2, 3, 5, 3], '<=', 10],
      ['x1 y x3 excluyentes', [1, 0, 1, 0, 0], '<=', 1],
      ['x2 y x4 excluyentes', [0, 1, 0, 1, 0], '<=', 1],
    ]),
    esperado: { z: 21, soluciones: [[1, 1, 0, 0, 1]], factibles: 16 },
  },
  {
    id: 'TORRES',
    titulo: 'Torres de comunicación',
    enunciado: 'Se evalúan 5 torres con costos 6, 5, 8, 9 y 4. Se pueden construir a lo sumo 3 y al menos una de las dos zonas rurales (torres 1 y 2). Se busca el menor costo.',
    model: modelo('min', [6, 5, 8, 9, 4], [
      ['Máximo 3 torres', [1, 1, 1, 1, 1], '<=', 3],
      ['Al menos una rural', [1, 1, 0, 0, 0], '>=', 1],
    ]),
    esperado: { z: 5, soluciones: [[0, 1, 0, 0, 0]], factibles: 18 },
  },
  {
    id: 'PROYECTOS_5',
    titulo: 'Proyectos con presupuesto y mínimo',
    enunciado: 'Cinco proyectos (A a E) con beneficios 8, 10, 6, 11 y 5 y costos 1000, 1200, 800, 1500 y 700. El presupuesto es 3000 y se deben elegir al menos 2 proyectos.',
    model: modelo('max', [8, 10, 6, 11, 5], [
      ['Presupuesto', [1000, 1200, 800, 1500, 700], '<=', 3000],
      ['Mínimo 2 proyectos', todos(5), '>=', 2],
    ], ['A', 'B', 'C', 'D', 'E']),
    esperado: { z: 24, soluciones: [[1, 1, 1, 0, 0]], factibles: 15 },
  },
  {
    id: 'ESTACIONES',
    titulo: 'Estaciones base',
    enunciado: 'Seis ubicaciones para estaciones base con costos 9, 7, 6, 5, 4 y 3. Se pueden instalar a lo sumo 2 y al menos una debe ser costera (ubicaciones 1 y 2). Se busca el menor costo.',
    model: modelo('min', [9, 7, 6, 5, 4, 3], [
      ['Máximo 2 estaciones', todos(6), '<=', 2],
      ['Al menos una costera', [1, 1, 0, 0, 0, 0], '>=', 1],
    ]),
    esperado: { z: 7, soluciones: [[0, 1, 0, 0, 0, 0]], factibles: 11 },
  },
  {
    id: 'MOCHILA',
    titulo: 'Mochila clásica',
    enunciado: 'Cuatro objetos con valores 8, 11, 6 y 4 y pesos 5, 7, 4 y 3; la mochila soporta 14. Se busca el mayor valor.',
    model: modelo('max', [8, 11, 6, 4], [['Peso', [5, 7, 4, 3], '<=', 14]]),
    esperado: { z: 21, soluciones: [[0, 1, 1, 1]], factibles: 13 },
  },
  {
    id: 'ASIGNACION',
    titulo: 'Asignación 3×3',
    enunciado: 'Tres personas y tres tareas; cada persona hace una tarea y cada tarea la hace una persona. La variable xij vale 1 si la persona i hace la tarea j. Costos: 9, 2, 7 / 3, 6, 1 / 5, 8, 4. Se busca el menor costo.',
    model: modelo('min', [9, 2, 7, 3, 6, 1, 5, 8, 4], [
      ['Persona 1', [1, 1, 1, 0, 0, 0, 0, 0, 0], '=', 1],
      ['Persona 2', [0, 0, 0, 1, 1, 1, 0, 0, 0], '=', 1],
      ['Persona 3', [0, 0, 0, 0, 0, 0, 1, 1, 1], '=', 1],
      ['Tarea 1', [1, 0, 0, 1, 0, 0, 1, 0, 0], '=', 1],
      ['Tarea 2', [0, 1, 0, 0, 1, 0, 0, 1, 0], '=', 1],
      ['Tarea 3', [0, 0, 1, 0, 0, 1, 0, 0, 1], '=', 1],
    ], ['x11', 'x12', 'x13', 'x21', 'x22', 'x23', 'x31', 'x32', 'x33']),
    esperado: { z: 8, soluciones: [[0, 1, 0, 0, 0, 1, 1, 0, 0]], factibles: 6 },
  },
];

export const ejemploPorId = (id) => EJEMPLOS.find((e) => e.id === id);
