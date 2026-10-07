/** Ejemplos cargables. Filas: [actividad, duración, predecesoras, requerimientos por recurso]. */
const m = (recursos, filas) => ({
  recursos,
  acts: filas.map(([name, d, p, ...r]) => ({ name, d, preds: p ? p.split(',') : [], r })),
});

export const EJEMPLOS = [
  {
    id: 'E1',
    titulo: 'Bodega: nivelar sin alargar',
    enunciado: 'Siete actividades de una obra comparten una cuadrilla de obreros. El cronograma temprano exige hasta 11 obreros, pero solo hay 7. Nivelando dentro de las holguras el proyecto no se alarga.',
    modelo: m([{ name: 'Obreros', limite: 7 }], [
      ['A', 4, '', 4], ['B', 1, '', 5], ['C', 3, 'A', 1], ['D', 2, '', 2], ['E', 1, 'D', 1], ['F', 2, 'A,E', 1], ['G', 1, 'B', 3],
    ]),
  },
  {
    id: 'E2',
    titulo: 'Taller: el recurso alarga el proyecto',
    enunciado: 'Seis actividades con una cuadrilla de 9 obreros. Los tres primeros períodos piden 12, así que algo debe esperar y el proyecto se alarga.',
    modelo: m([{ name: 'Obreros', limite: 9 }], [
      ['A', 3, '', 5], ['B', 4, '', 4], ['C', 2, '', 3], ['D', 1, 'C', 3], ['E', 4, 'A,D', 4], ['F', 4, 'B', 3],
    ]),
  },
  {
    id: 'E3',
    titulo: 'Dos recursos: obreros y grúa',
    enunciado: 'Seis actividades que usan obreros y grúas (hay 2). Hay que respetar los dos límites a la vez.',
    modelo: m([{ name: 'Obreros', limite: 6 }, { name: 'Grúa', limite: 2 }], [
      ['A', 3, '', 3, 1], ['B', 2, '', 4, 1], ['C', 4, 'A', 2, 0], ['D', 3, 'B', 3, 1], ['E', 2, 'A,B', 2, 1], ['F', 2, 'C,D,E', 4, 0],
    ]),
  },
  {
    id: 'E4',
    titulo: 'Infactible: una actividad no cabe sola',
    enunciado: 'Igual que el taller, pero con 4 obreros disponibles: la actividad A pide 5 y nunca cabría. La herramienta lo detecta y lo explica.',
    modelo: m([{ name: 'Obreros', limite: 4 }], [
      ['A', 3, '', 5], ['B', 4, '', 4], ['C', 2, '', 3], ['D', 1, 'C', 3], ['E', 4, 'A,D', 4], ['F', 4, 'B', 3],
    ]),
  },
];

export const ejemploPorId = (id) => EJEMPLOS.find((e) => e.id === id) || EJEMPLOS[0];
