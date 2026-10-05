/**
 * Ejemplos del tema 1.2 «Programación entera mixta» (formato de examples.js).
 * `esperado` guarda z y x (fracciones exactas, como texto) de la relajación
 * lineal y del óptimo mixto, verificados por enumeración de vértices.
 */
const OPCIONES = { branchRule: 'lowestIndex', childOrder: 'downFirst', pruneWithFloor: true };

export const ejemplosMixta = [
  {
    id: 'mixta-e1',
    title: 'Ejemplo del profesor',
    description: 'Maximizar Z = 7x₁ + 9x₂ con x₂ entera y x₁ continua.',
    sense: 'max',
    numVars: 2,
    c: ['7', '9'],
    constraints: [
      { a: ['-1', '3'], op: '<=', b: '6' },
      { a: ['7', '1'], op: '<=', b: '35' },
    ],
    integer: [false, true],
    options: { ...OPCIONES },
    esperado: {
      relajacion: { z: '63', x: ['9/2', '7/2'] },
      mixto: { z: '59', x: ['32/7', '3'] },
    },
  },
  {
    id: 'mixta-e2',
    title: 'Máximo con una restricción ≥',
    description: 'Maximizar Z = 3x₁ + 2x₂ con una restricción ≥ (Gran M) y x₂ entera.',
    sense: 'max',
    numVars: 2,
    c: ['3', '2'],
    constraints: [
      { a: ['2', '1'], op: '<=', b: '15' },
      { a: ['2', '3'], op: '<=', b: '35' },
      { a: ['4', '-5'], op: '>=', b: '20' },
    ],
    integer: [false, true],
    options: { ...OPCIONES },
    esperado: {
      relajacion: { z: '325/14', x: ['95/14', '10/7'] },
      mixto: { z: '23', x: ['7', '1'] },
    },
  },
  {
    id: 'mixta-e3',
    title: 'Máximo con cota superior en x₁',
    description: 'Maximizar Z = 2x₁ + 5x₂ con x₁ entera; la relajación ya cumple la integralidad.',
    sense: 'max',
    numVars: 2,
    c: ['2', '5'],
    constraints: [
      { a: ['1', '1'], op: '>=', b: '5' },
      { a: ['-1', '1'], op: '<=', b: '8' },
      { a: ['1', '3'], op: '<=', b: '17' },
      { a: ['1', '0'], op: '<=', b: '12' },
    ],
    integer: [true, false],
    options: { ...OPCIONES },
    esperado: {
      relajacion: { z: '97/3', x: ['12', '5/3'] },
      mixto: { z: '97/3', x: ['12', '5/3'] },
    },
  },
  {
    id: 'mixta-e4',
    title: 'Mínimo con dos enteras y una continua',
    description: 'Minimizar Z = 63x₁ + 18x₂ + 21x₃ con x₁ y x₂ enteras, x₃ continua.',
    sense: 'min',
    numVars: 3,
    c: ['63', '18', '21'],
    constraints: [
      { a: ['0', '3/2', '1'], op: '>=', b: '29/4' },
      { a: ['1', '0', '0'], op: '>=', b: '1' },
    ],
    integer: [true, true, false],
    options: { ...OPCIONES },
    esperado: {
      relajacion: { z: '150', x: ['1', '29/6', '0'] },
      mixto: { z: '153', x: ['1', '5', '0'] },
    },
  },
  {
    id: 'mixta-e5',
    title: 'Cuatro variables, dos enteras',
    description: 'Maximizar Z = 4x₁ + 3x₂ + 2x₃ + x₄ con x₁ y x₃ enteras.',
    sense: 'max',
    numVars: 4,
    c: ['4', '3', '2', '1'],
    constraints: [
      { a: ['6', '0', '4', '0'], op: '<=', b: '35' },
      { a: ['3', '7', '5', '2'], op: '<=', b: '125' },
      { a: ['0', '22', '0', '13'], op: '<=', b: '480' },
    ],
    integer: [true, false, true, false],
    options: { ...OPCIONES },
    esperado: {
      relajacion: { z: '20425/282', x: ['35/6', '875/94', '0', '995/47'] },
      mixto: { z: '3299/47', x: ['5', '405/47', '1', '1050/47'] },
    },
  },
  {
    id: 'mixta-e6',
    title: 'Mínimo con dos restricciones ≥',
    description: 'Minimizar Z = x₁ + 2x₂ + x₃ + 2x₄ con x₁ y x₂ enteras.',
    sense: 'min',
    numVars: 4,
    c: ['1', '2', '1', '2'],
    constraints: [
      { a: ['850', '0', '900', '0'], op: '<=', b: '8000' },
      { a: ['0', '400', '0', '600'], op: '<=', b: '5600' },
      { a: ['1', '1', '0', '0'], op: '>=', b: '10' },
      { a: ['0', '0', '1', '1'], op: '>=', b: '5/2' },
    ],
    integer: [true, true, false, false],
    options: { ...OPCIONES },
    esperado: {
      relajacion: { z: '265/17', x: ['160/17', '10/17', '0', '5/2'] },
      mixto: { z: '281/18', x: ['9', '1', '7/18', '19/9'] },
    },
  },
];
