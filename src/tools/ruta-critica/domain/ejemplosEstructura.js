// Ejemplos del Paso a paso del tema 3.1 (tabla de actividades y predecesoras).
import { EXAMPLES } from './examples.js';
import { splitPreds } from './parser.js';

const T = (spec) => spec.map(([name, preds]) => ({ name, preds: preds ? preds.split(',') : [] }));

const ej5 = EXAMPLES.find((e) => e.id === 'ej5');

export const EJEMPLOS_ESTRUCTURA = [
  {
    id: 'teoria',
    etiqueta: 'Ejemplo de la teoría',
    enunciado: 'C necesita a A y a B, pero D solo necesita a B.',
    acts: T([['A', ''], ['B', ''], ['C', 'A,B'], ['D', 'B']]),
  },
  {
    id: 'paralelas',
    etiqueta: 'Actividades paralelas',
    enunciado: 'A y B tienen las mismas predecesoras (ninguna) y los mismos sucesores; C y D también.',
    acts: T([['A', ''], ['B', ''], ['C', 'A,B'], ['D', 'A,B'], ['E', 'C,D']]),
  },
  {
    id: 'ej5',
    etiqueta: 'Ejercicio 5 del curso',
    enunciado: 'Proyecto de 12 actividades con varias dependencias parciales.',
    acts: ej5.activities.map((r) => ({ name: r.name, preds: splitPreds(r.preds) })),
  },
];
