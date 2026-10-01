/**
 * Ejemplos cargables para la herramienta de Programación Entera.
 */
export const EXAMPLES = [
  {
    id: 'tema',
    title: 'Ejemplo del tema (2 variables)',
    description: 'Maximizar Z = 5x₁ + 4x₂ con 19 puntos enteros factibles y óptimo en (3, 2).',
    sense: 'max',
    numVars: 2,
    c: ['5', '4'],
    constraints: [
      { a: ['1', '1'], op: '<=', b: '5' },
      { a: ['10', '6'], op: '<=', b: '45' },
    ],
    integer: [true, true],
    options: {
      branchRule: 'mostFractional',
      childOrder: 'bestZ',
      pruneWithFloor: true,
    },
  },
  {
    id: 'mesas-sillas',
    title: 'Mesas y sillas (3x₁ + 2x₂)',
    description: 'Maximizar Z = 3x₁ + 2x₂ sujeto a 3 restricciones tecnológicas.',
    sense: 'max',
    numVars: 2,
    c: ['3', '2'],
    constraints: [
      { a: ['-1', '3'], op: '<=', b: '7' },
      { a: ['2', '5'], op: '<=', b: '12' },
      { a: ['5', '3'], op: '<=', b: '17' },
    ],
    integer: [true, true],
    options: {
      branchRule: 'mostFractional',
      childOrder: 'bestZ',
      pruneWithFloor: true,
    },
  },
  {
    id: 'tres-variables',
    title: 'Tres variables (asignación de recursos)',
    description: 'Maximizar Z = 4x₁ + 8x₂ + 7x₃ sujeto a 3 restricciones tecnológicas.',
    sense: 'max',
    numVars: 3,
    c: ['4', '8', '7'],
    constraints: [
      { a: ['3', '4', '2'], op: '<=', b: '53' },
      { a: ['4', '1', '4'], op: '<=', b: '80' },
      { a: ['4', '7', '4'], op: '<=', b: '160' },
    ],
    integer: [true, true, true],
    options: {
      branchRule: 'mostFractional',
      childOrder: 'bestZ',
      pruneWithFloor: true,
    },
  },
  {
    id: 'infactible',
    title: 'Infactible entero',
    description: 'Maximizar x₁ sujeto a 2x₁ = 3 (la relajación da 3/2 pero no hay solución entera).',
    sense: 'max',
    numVars: 2,
    c: ['1', '0'],
    constraints: [
      { a: ['2', '0'], op: '=', b: '3' },
    ],
    integer: [true, true],
    options: {
      branchRule: 'mostFractional',
      childOrder: 'bestZ',
      pruneWithFloor: true,
    },
  },
  {
    id: 'minimizacion',
    title: 'Minimización con restricciones ≥',
    description: 'Minimizar Z = 4x₁ + 3x₂ sujeto a 2x₁ + x₂ ≥ 5 y x₁ + 3x₂ ≥ 6.',
    sense: 'min',
    numVars: 2,
    c: ['4', '3'],
    constraints: [
      { a: ['2', '1'], op: '>=', b: '5' },
      { a: ['1', '3'], op: '>=', b: '6' },
    ],
    integer: [true, true],
    options: {
      branchRule: 'mostFractional',
      childOrder: 'bestZ',
      pruneWithFloor: true,
    },
  },
];
