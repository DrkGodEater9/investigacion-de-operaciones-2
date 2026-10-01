import { solveIP } from './branchAndBound.js';
import { solveLP } from './simplex.js';
import { frac, parseFraction } from './fraction.js';
import { MODEL_TEMPLATES, TRUE_FALSE_BANK } from '../../../topics/entera-pura/practica-data.js';

/**
 * Generador de números pseudoaleatorios reproducible a partir de una semilla entera (Mulberry32).
 */
export function createPRNG(seed) {
  let s = (Math.abs(Math.floor(seed)) || 1) >>> 0;
  return function next() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Verifica por fuerza bruta en la retícula de enteros que la solución entera óptima sea ÚNICA.
 * @param {Object} model
 * @param {Object} result - Resultado de solveIP
 * @returns {boolean}
 */
export function hasUniqueIntegerOptimum(model, result) {
  if (!result || result.status !== 'optimal' || !result.best) return false;
  if (!model.c || model.c.length !== 2) return true; // para más variables confiamos en solveIP

  const bestX1 = Number(result.best.x[0].n);
  const bestX2 = Number(result.best.x[1].n);
  const bestZ = result.best.z;

  // Determinar cotas máximas para explorar la retícula
  let maxX1 = Math.max(bestX1 * 2, 8);
  let maxX2 = Math.max(bestX2 * 2, 8);

  for (const ct of model.constraints) {
    const a1 = frac(ct.a[0]);
    const a2 = frac(ct.a[1]);
    const b = frac(ct.b);
    if (a1.gt(0)) {
      const bound1 = Math.ceil(b.div(a1).toNumber());
      if (bound1 > 0 && bound1 < 50) maxX1 = Math.max(maxX1, bound1);
    }
    if (a2.gt(0)) {
      const bound2 = Math.ceil(b.div(a2).toNumber());
      if (bound2 > 0 && bound2 < 50) maxX2 = Math.max(maxX2, bound2);
    }
  }

  maxX1 = Math.min(maxX1, 40);
  maxX2 = Math.min(maxX2, 40);

  const c1 = frac(model.c[0]);
  const c2 = frac(model.c[1]);
  const isMax = (model.sense || 'max') === 'max';

  let matchCount = 0;

  for (let x1 = 0; x1 <= maxX1; x1++) {
    for (let x2 = 0; x2 <= maxX2; x2++) {
      // Verificar factibilidad
      let feasible = true;
      for (const ct of model.constraints) {
        const lhs = frac(ct.a[0]).mul(x1).add(frac(ct.a[1]).mul(x2));
        const rhs = frac(ct.b);
        if (ct.op === '<=' && lhs.gt(rhs)) { feasible = false; break; }
        if (ct.op === '>=' && lhs.lt(rhs)) { feasible = false; break; }
        if (ct.op === '=' && !lhs.eq(rhs)) { feasible = false; break; }
      }

      if (feasible) {
        const z = c1.mul(x1).add(c2.mul(x2));
        if (z.eq(bestZ)) {
          matchCount++;
          if (matchCount > 1) return false; // No es único
        } else if (isMax ? z.gt(bestZ) : z.lt(bestZ)) {
          // Si encontramos un punto factible mejor que el best reportado, algo no cuadra
          return false;
        }
      }
    }
  }

  return matchCount === 1;
}

/**
 * Normaliza y compara una restricción ingresada por el usuario permitiendo expresiones equivalentes.
 * Por ejemplo: "x1 <= 3", "3 >= x1", "x₁ ≤ 3", "x_1 <= 3".
 */
export function parseAndCompareConstraint(userInput, expectedVar, expectedOp, expectedBound) {
  if (!userInput || typeof userInput !== 'string') return false;

  let s = userInput.trim().replace(/\s+/g, '').toLowerCase();
  s = s.replace(/x_1/g, 'x1').replace(/x_2/g, 'x2').replace(/x₁/g, 'x1').replace(/x₂/g, 'x2');

  // Identificar operador
  let op = null;
  let parts = null;

  if (s.includes('<=') || s.includes('≤')) {
    op = '<=';
    parts = s.split(/<=|≤/);
  } else if (s.includes('>=') || s.includes('≥')) {
    op = '>=';
    parts = s.split(/>=|≥/);
  } else if (s.includes('=')) {
    op = '=';
    parts = s.split('=');
  }

  if (!op || !parts || parts.length !== 2) return false;

  const left = parts[0];
  const right = parts[1];

  let userVar = null;
  let userOp = op;
  let userBound = null;

  try {
    if (left === 'x1' || left === 'x2') {
      userVar = left;
      userBound = parseFraction(right).toNumber();
    } else if (right === 'x1' || right === 'x2') {
      // Expresión invertida: ej. "3 >= x1" equivale a "x1 <= 3"
      userVar = right;
      userOp = op === '<=' ? '>=' : op === '>=' ? '<=' : '=';
      userBound = parseFraction(left).toNumber();
    } else {
      return false;
    }
  } catch (e) {
    return false;
  }

  const expVar = expectedVar.replace('₁', '1').replace('₂', '2');
  const expBound = typeof expectedBound === 'number' ? expectedBound : parseFraction(String(expectedBound)).toNumber();

  return userVar === expVar && userOp === expectedOp && Math.abs(userBound - expBound) < 1e-5;
}

// ============================================================================
// GENERADORES POR TIPO
// ============================================================================

/**
 * Tipo A: Redondear o no.
 * Se presenta un modelo con 2 variables. El estudiante calcula el redondeo al entero más cercano,
 * evalúa si es factible, e ingresa el óptimo entero real.
 */
export function generateExerciseA(seed = 1) {
  if (seed === 0 || seed === 'tema') {
    const defaultModel = {
      sense: 'max',
      numVars: 2,
      c: ['5', '4'],
      constraints: [
        { a: ['1', '1'], op: '<=', b: '5' },
        { a: ['10', '6'], op: '<=', b: '45' },
      ],
      integer: [true, true],
    };
    return {
      type: 'A',
      id: `A-${seed}`,
      seed,
      title: 'A. Redondear o no',
      model: defaultModel,
      relaxation: { x1: '3,75', x2: '1,25', z: '23,75', x1Num: 3.75, x2Num: 1.25 },
      nearestRounding: {
        x1: 4,
        x2: 1,
        isFeasible: false,
        violatedConstraint: { index: 2, lhs: 46, rhs: 45, formula: '10(4) + 6(1) = 46 > 45' },
        z: 24,
      },
      optimal: { x1: 3, x2: 2, z: 23 },
    };
  }

  const prng = createPRNG(seed);

  // Parámetros candidatos
  for (let attempt = 0; attempt < 50; attempt++) {
    const c1 = 3 + Math.floor(prng() * 5); // 3..7
    const c2 = 2 + Math.floor(prng() * 5); // 2..6

    const a11 = 1;
    const a12 = 1;
    const b1 = 4 + Math.floor(prng() * 3); // 4..6

    const a21 = 8 + Math.floor(prng() * 5); // 8..12
    const a22 = 4 + Math.floor(prng() * 4); // 4..7
    // Elegir b2 para que el corte entre las dos rectas sea fraccionario
    const det = a11 * a22 - a12 * a21; // negativo
    const b2 = Math.floor(b1 * a21 * 0.75 + prng() * 8);

    const model = {
      sense: 'max',
      numVars: 2,
      c: [String(c1), String(c2)],
      constraints: [
        { a: [String(a11), String(a12)], op: '<=', b: String(b1) },
        { a: [String(a21), String(a22)], op: '<=', b: String(b2) },
      ],
      integer: [true, true],
    };

    const rootLP = solveLP(model);
    if (rootLP.status !== 'optimal') continue;

    // Regla: la relajación NO debe ser entera
    if (rootLP.x[0].isInteger() && rootLP.x[1].isInteger()) continue;

    const ipResult = solveIP(model);
    if (ipResult.status !== 'optimal' || !ipResult.best) continue;

    // Regla: la solución entera debe ser ÚNICA
    if (!hasUniqueIntegerOptimum(model, ipResult)) continue;

    // Calcular redondeo al más cercano
    const v1 = rootLP.x[0].toNumber();
    const v2 = rootLP.x[1].toNumber();
    const r1 = Math.round(v1);
    const r2 = Math.round(v2);

    // Evaluar factibilidad del redondeo al más cercano
    let isFeasible = true;
    let violatedConstraint = null;

    for (let i = 0; i < model.constraints.length; i++) {
      const ct = model.constraints[i];
      const lhs = Number(ct.a[0]) * r1 + Number(ct.a[1]) * r2;
      const rhs = Number(ct.b);
      if (ct.op === '<=' && lhs > rhs) {
        isFeasible = false;
        violatedConstraint = { index: i + 1, lhs, rhs, formula: `${ct.a[0]}(${r1}) + ${ct.a[1]}(${r2}) = ${lhs} > ${rhs}` };
        break;
      }
    }

    const roundingZ = c1 * r1 + c2 * r2;
    const optimalX1 = Number(ipResult.best.x[0].n);
    const optimalX2 = Number(ipResult.best.x[1].n);
    const optimalZ = Number(ipResult.best.z.n);

    // Si el redondeo es factible pero resulta dar el mismo óptimo, buscar otro para que el ejercicio sea pedagógico
    if (isFeasible && r1 === optimalX1 && r2 === optimalX2) continue;

    return {
      type: 'A',
      id: `A-${seed}`,
      seed,
      title: 'A. Redondear o no',
      model,
      relaxation: {
        x1: rootLP.x[0].toDecimal(),
        x2: rootLP.x[1].toDecimal(),
        z: rootLP.z.toDecimal(),
        x1Num: v1,
        x2Num: v2,
      },
      nearestRounding: {
        x1: r1,
        x2: r2,
        isFeasible,
        violatedConstraint,
        z: roundingZ,
      },
      optimal: {
        x1: optimalX1,
        x2: optimalX2,
        z: optimalZ,
      },
    };
  }

  // Fallback canónico si no converge en 50 intentos: el ejemplo exacto de Teoría
  const defaultModel = {
    sense: 'max',
    numVars: 2,
    c: ['5', '4'],
    constraints: [
      { a: ['1', '1'], op: '<=', b: '5' },
      { a: ['10', '6'], op: '<=', b: '45' },
    ],
    integer: [true, true],
  };
  return {
    type: 'A',
    id: `A-${seed}`,
    seed,
    title: 'A. Redondear o no',
    model: defaultModel,
    relaxation: { x1: '3,75', x2: '1,25', z: '23,75', x1Num: 3.75, x2Num: 1.25 },
    nearestRounding: {
      x1: 4,
      x2: 1,
      isFeasible: false,
      violatedConstraint: { index: 2, lhs: 46, rhs: 45, formula: '10(4) + 6(1) = 46 > 45' },
      z: 24,
    },
    optimal: { x1: 3, x2: 2, z: 23 },
  };
}

/**
 * Tipo B: Completar el árbol.
 * Se da la relajación continua de P0; el estudiante elige la variable a ramificar (regla mayor parte fraccionaria),
 * define las restricciones de las ramas hijas y decide si se podan y por qué razón.
 */
export function generateExerciseB(seed = 1) {
  const prng = createPRNG(seed);

  for (let attempt = 0; attempt < 50; attempt++) {
    const c1 = 3 + Math.floor(prng() * 4);
    const c2 = 2 + Math.floor(prng() * 4);

    const a11 = 1;
    const a12 = 1;
    const b1 = 5 + Math.floor(prng() * 2);

    const a21 = 7 + Math.floor(prng() * 4);
    const a22 = 4 + Math.floor(prng() * 4);
    const b2 = 35 + Math.floor(prng() * 15);

    const model = {
      sense: 'max',
      numVars: 2,
      c: [String(c1), String(c2)],
      constraints: [
        { a: [String(a11), String(a12)], op: '<=', b: String(b1) },
        { a: [String(a21), String(a22)], op: '<=', b: String(b2) },
      ],
      integer: [true, true],
    };

    const rootLP = solveLP(model);
    if (rootLP.status !== 'optimal') continue;
    if (rootLP.x[0].isInteger() && rootLP.x[1].isInteger()) continue;

    const ipResult = solveIP(model);
    if (ipResult.status !== 'optimal' || !ipResult.best) continue;
    if (!hasUniqueIntegerOptimum(model, ipResult)) continue;

    // Calcular partes fraccionarias
    const frac1 = rootLP.x[0].fractionalPart();
    const frac2 = rootLP.x[1].fractionalPart();

    // Evitar empates ambiguos para que la regla se aprecie con total claridad
    if (frac1.eq(frac2)) continue;

    const branchVar = frac1.gt(frac2) ? 'x1' : 'x2';
    const chosenVal = branchVar === 'x1' ? rootLP.x[0] : rootLP.x[1];
    const floorVal = Number(chosenVal.floor());
    const ceilVal = Number(chosenVal.ceil());

    // Nodos hijos de P0
    const p1Node = ipResult.nodes.find((n) => n.parentId === 0 && n.branchOp === '<=');
    const p2Node = ipResult.nodes.find((n) => n.parentId === 0 && n.branchOp === '>=');

    if (!p1Node || !p2Node) continue;

    const classifyChild = (node) => {
      if (node.status === 'infeasible') return 'infactible';
      if (node.status === 'integer' || node.action === 'incumbent') return 'entera';
      if (node.action === 'pruned-bound') return 'cota';
      return 'ramificar';
    };

    return {
      type: 'B',
      id: `B-${seed}`,
      seed,
      title: 'B. Completar el árbol',
      model,
      root: {
        x1: rootLP.x[0].toDecimal(),
        x2: rootLP.x[1].toDecimal(),
        z: rootLP.z.toDecimal(),
        frac1: frac1.toDecimal(),
        frac2: frac2.toDecimal(),
      },
      branchVar,
      leftBranch: { var: branchVar, op: '<=', bound: floorVal },
      rightBranch: { var: branchVar, op: '>=', bound: ceilVal },
      children: [
        {
          label: 'P1',
          branch: `${branchVar} ≤ ${floorVal}`,
          sol: p1Node.status === 'infeasible' ? 'Infactible' : `x = (${p1Node.x.map((f) => f.toDecimal()).join('; ')}), Z = ${p1Node.z.toDecimal()}`,
          expectedAction: classifyChild(p1Node),
        },
        {
          label: 'P2',
          branch: `${branchVar} ≥ ${ceilVal}`,
          sol: p2Node.status === 'infeasible' ? 'Infactible' : `x = (${p2Node.x.map((f) => f.toDecimal()).join('; ')}), Z = ${p2Node.z.toDecimal()}`,
          expectedAction: classifyChild(p2Node),
        },
      ],
      optimal: {
        x1: Number(ipResult.best.x[0].n),
        x2: Number(ipResult.best.x[1].n),
        z: Number(ipResult.best.z.n),
      },
    };
  }

  // Fallback canónico con el ejemplo del tema
  return {
    type: 'B',
    id: `B-${seed}`,
    seed,
    title: 'B. Completar el árbol',
    model: {
      sense: 'max',
      c: ['5', '4'],
      constraints: [
        { a: ['1', '1'], op: '<=', b: '5' },
        { a: ['10', '6'], op: '<=', b: '45' },
      ],
    },
    root: { x1: '3,75', x2: '1,25', z: '23,75', frac1: '0,75', frac2: '0,25' },
    branchVar: 'x1',
    leftBranch: { var: 'x1', op: '<=', bound: 3 },
    rightBranch: { var: 'x1', op: '>=', bound: 4 },
    children: [
      { label: 'P1', branch: 'x1 ≤ 3', sol: 'x = (3; 2), Z = 23', expectedAction: 'entera' },
      { label: 'P2', branch: 'x1 ≥ 4', sol: 'x = (4; 0,83), Z = 23,33', expectedAction: 'cota' },
    ],
    optimal: { x1: 3, x2: 2, z: 23 },
  };
}

/**
 * Tipo C: Modelado en texto.
 * Problema contextualizado (servidores, ingenieros, robots). El estudiante elige el modelo correcto
 * entre 3 alternativas (errores comunes: integralidad omitida, desigualdad invertida) e ingresa el óptimo entero.
 */
export function generateExerciseC(seed = 1) {
  const prng = createPRNG(seed);
  const templateIdx = Math.floor(prng() * MODEL_TEMPLATES.length);
  const tpl = MODEL_TEMPLATES[templateIdx];

  // Variar coeficientes ligeramente según la semilla
  const delta = Math.floor(prng() * 3) - 1; // -1, 0, +1
  const c1 = tpl.cBase[0] + delta;
  const c2 = tpl.cBase[1];
  const a11 = tpl.ct1Base[0];
  const a12 = tpl.ct1Base[1];
  const b1 = tpl.b1Base;
  const a21 = tpl.ct2Base[0];
  const a22 = tpl.ct2Base[1];
  const b2 = tpl.b2Base;

  const model = {
    sense: 'max',
    numVars: 2,
    c: [String(c1), String(c2)],
    constraints: [
      { a: [String(a11), String(a12)], op: '<=', b: String(b1) },
      { a: [String(a21), String(a22)], op: '<=', b: String(b2) },
    ],
    integer: [true, true],
  };

  const rootLP = solveLP(model);
  const ipResult = solveIP(model);

  // Asegurar que la relajación sea fraccionaria y el óptimo entero sea único
  const isFractional = rootLP.status === 'optimal' && (!rootLP.x[0].isInteger() || !rootLP.x[1].isInteger());
  const isUnique = ipResult.status === 'optimal' && hasUniqueIntegerOptimum(model, ipResult);

  // Si no cumple, usamos los valores base de la plantilla que garantizan unicidad
  const finalC1 = isFractional && isUnique ? c1 : tpl.cBase[0];
  const finalC2 = tpl.cBase[1];
  const finalModel = {
    sense: 'max',
    numVars: 2,
    c: [String(finalC1), String(finalC2)],
    constraints: [
      { a: [String(a11), String(a12)], op: '<=', b: String(b1) },
      { a: [String(a21), String(a22)], op: '<=', b: String(b2) },
    ],
    integer: [true, true],
  };
  const finalRes = solveIP(finalModel);

  const story = tpl.storyText(finalC1, finalC2, a11, a12, b1, a21, a22, b2);

  // Crear 3 modelos
  // Opción correcta
  const optCorrect = {
    id: 'opt-correct',
    text: `Maximizar Z = ${finalC1}x₁ + ${finalC2}x₂\nsujeto a:\n${a11}x₁ + ${a12}x₂ ≤ ${b1}\n${a21}x₁ + ${a22}x₂ ≤ ${b2}\nx₁, x₂ ≥ 0 y enteras (x₁, x₂ ∈ ℤ)`,
    isCorrect: true,
    flaw: 'Modelo correcto: función objetivo de maximización, restricciones de capacidad ≤ y condición de integralidad estricta.',
  };

  // Opción con error 1: Omite integralidad (variables continuas)
  const optErrorContinuous = {
    id: 'opt-err-cont',
    text: `Maximizar Z = ${finalC1}x₁ + ${finalC2}x₂\nsujeto a:\n${a11}x₁ + ${a12}x₂ ≤ ${b1}\n${a21}x₁ + ${a22}x₂ ≤ ${b2}\nx₁, x₂ ≥ 0 (continuas)`,
    isCorrect: false,
    flaw: 'Error de integralidad: modela las variables como continuas (x₁, x₂ ≥ 0). Las unidades del problema son indivisibles y requieren x₁, x₂ ∈ ℤ.',
  };

  // Opción con error 2: Restricción invertida (≥ en lugar de ≤)
  const optErrorInverted = {
    id: 'opt-err-inv',
    text: `Maximizar Z = ${finalC1}x₁ + ${finalC2}x₂\nsujeto a:\n${a11}x₁ + ${a12}x₂ ≥ ${b1}\n${a21}x₁ + ${a22}x₂ ≤ ${b2}\nx₁, x₂ ≥ 0 y enteras (x₁, x₂ ∈ ℤ)`,
    isCorrect: false,
    flaw: 'Error de sentido: la primera restricción aparece como ≥ en lugar de ≤. Los recursos disponibles representan límites máximos que no se pueden sobrepasar.',
  };

  const rawOptions = [optCorrect, optErrorContinuous, optErrorInverted];
  // Mezclar opciones determinísticamente con el PRNG
  const perm = prng() > 0.5 ? [0, 1, 2] : [1, 0, 2];
  if (prng() > 0.5) {
    const tmp = perm[0];
    perm[0] = perm[2];
    perm[2] = tmp;
  }
  const options = perm.map((idx) => rawOptions[idx]);
  const correctIndex = options.findIndex((o) => o.isCorrect);

  return {
    type: 'C',
    id: `C-${seed}`,
    seed,
    title: 'C. Modelado en texto',
    context: tpl.context,
    story,
    options,
    correctOptionIndex: correctIndex,
    model: finalModel,
    optimal: {
      x1: Number(finalRes.best.x[0].n),
      x2: Number(finalRes.best.x[1].n),
      z: Number(finalRes.best.z.n),
    },
  };
}

/**
 * Tipo D: Verdadero o Falso sobre la teoría.
 * Preguntas conceptuales sobre cotas, redondeo, criterios de poda y la franja descartada.
 */
export function generateExerciseD(seed = 1) {
  const prng = createPRNG(seed);
  const qIndex = Math.floor(prng() * TRUE_FALSE_BANK.length);
  const q = TRUE_FALSE_BANK[qIndex];

  return {
    type: 'D',
    id: `D-${seed}`,
    seed,
    title: 'D. Preguntas teóricas',
    questionId: q.id,
    statement: q.statement,
    expectedAnswer: q.isTrue,
    explanation: q.explanation,
  };
}

/**
 * Despachador general de generación según el tipo de ejercicio ('A', 'B', 'C', 'D').
 */
export function generateExercise(type, seed = 1) {
  switch (type) {
    case 'A': return generateExerciseA(seed);
    case 'B': return generateExerciseB(seed);
    case 'C': return generateExerciseC(seed);
    case 'D': return generateExerciseD(seed);
    default: return generateExerciseA(seed);
  }
}

// ============================================================================
// CORRECTOR / CALIFICADOR
// ============================================================================

/**
 * Califica el intento del estudiante sobre un ejercicio dado.
 * Devuelve un veredicto detallado con explicaciones matemáticas paso a paso.
 *
 * @param {Object} exercise - Objeto generado por generateExercise
 * @param {Object} userAnswers - Respuestas del estudiante
 * @returns {Object} { isCorrect, score, details, explanations }
 */
export function gradeExercise(exercise, userAnswers = {}) {
  if (!exercise) return { isCorrect: false, score: 0, explanations: [] };

  switch (exercise.type) {
    case 'A': {
      const { nearestRounding, optimal } = exercise;

      const userR1 = parseInt(userAnswers.r1, 10);
      const userR2 = parseInt(userAnswers.r2, 10);
      const userIsFeasible = userAnswers.isFeasible; // true o false (booleano)
      const userOptX1 = parseInt(userAnswers.optX1, 10);
      const userOptX2 = parseInt(userAnswers.optX2, 10);
      const userOptZ = parseInt(userAnswers.optZ, 10);

      const rMatch = userR1 === nearestRounding.x1 && userR2 === nearestRounding.x2;
      const feasMatch = userIsFeasible === nearestRounding.isFeasible;
      const optXMatch = userOptX1 === optimal.x1 && userOptX2 === optimal.x2;
      const optZMatch = !Number.isNaN(userOptZ) ? userOptZ === optimal.z : true;

      const explanations = [];

      // 1. Redondeo
      if (rMatch) {
        explanations.push(`✓ Redondeo al más cercano correcto: (${nearestRounding.x1}, ${nearestRounding.x2}).`);
      } else {
        explanations.push(`✗ Redondeo incorrecto: a partir de (${exercise.relaxation.x1}; ${exercise.relaxation.x2}), los enteros más cercanos son (${nearestRounding.x1}, ${nearestRounding.x2}).`);
      }

      // 2. Factibilidad del redondeo
      if (feasMatch) {
        if (nearestRounding.isFeasible) {
          explanations.push(`✓ Correcto: el punto (${nearestRounding.x1}, ${nearestRounding.x2}) sí es factible (Z = ${nearestRounding.z}), pero no es óptimo.`);
        } else {
          explanations.push(`✓ Correcto: el punto (${nearestRounding.x1}, ${nearestRounding.x2}) es infactible. Viola la restricción ${nearestRounding.violatedConstraint.index}: ${nearestRounding.violatedConstraint.formula}.`);
        }
      } else {
        if (nearestRounding.isFeasible) {
          explanations.push(`✗ El punto redondeado (${nearestRounding.x1}, ${nearestRounding.x2}) sí cumple todas las restricciones (es factible), aunque produce un beneficio inferior al óptimo.`);
        } else {
          explanations.push(`✗ El punto redondeado (${nearestRounding.x1}, ${nearestRounding.x2}) es infactible. Al sustituirlo en la restricción ${nearestRounding.violatedConstraint.index} resulta ${nearestRounding.violatedConstraint.formula}.`);
        }
      }

      // 3. Óptimo entero
      if (optXMatch && optZMatch) {
        explanations.push(`✓ Óptimo entero exacto: x* = (${optimal.x1}, ${optimal.x2}) con Z* = ${optimal.z}.`);
      } else {
        explanations.push(`✗ Óptimo entero incorrecto: el verdadero óptimo entero es x* = (${optimal.x1}, ${optimal.x2}) con Z* = ${optimal.z}.`);
      }

      const allCorrect = rMatch && feasMatch && optXMatch && optZMatch;
      const score = (rMatch ? 1 : 0) + (feasMatch ? 1 : 0) + (optXMatch && optZMatch ? 1 : 0);

      return {
        isCorrect: allCorrect,
        score,
        maxScore: 3,
        details: { rMatch, feasMatch, optXMatch, optZMatch },
        explanations,
      };
    }

    case 'B': {
      const { branchVar, leftBranch, rightBranch, children, optimal } = exercise;

      const userBranchVar = (userAnswers.branchVar || '').toLowerCase().replace('₁', '1').replace('₂', '2');
      const varMatch = userBranchVar === branchVar;

      const leftMatch = parseAndCompareConstraint(userAnswers.leftBranch, leftBranch.var, leftBranch.op, leftBranch.bound);
      const rightMatch = parseAndCompareConstraint(userAnswers.rightBranch, rightBranch.var, rightBranch.op, rightBranch.bound);

      const p1ActionMatch = (userAnswers.p1Action || '').toLowerCase() === children[0].expectedAction;
      const p2ActionMatch = (userAnswers.p2Action || '').toLowerCase() === children[1].expectedAction;

      const explanations = [];

      if (varMatch) {
        explanations.push(`✓ Variable a ramificar correcta: ${branchVar} (parte fraccionaria ${exercise.root[branchVar === 'x1' ? 'frac1' : 'frac2']}).`);
      } else {
        explanations.push(`✗ Variable incorrecta: se debe ramificar en ${branchVar} por tener mayor parte fraccionaria ({x₁} = ${exercise.root.frac1}, {x₂} = ${exercise.root.frac2}).`);
      }

      if (leftMatch && rightMatch) {
        explanations.push(`✓ Ramas correctas: ${branchVar} ≤ ${leftBranch.bound} y ${branchVar} ≥ ${rightBranch.bound}.`);
      } else {
        explanations.push(`✗ Restricciones de rama incorrectas: deben ser ${branchVar} ≤ ${leftBranch.bound} y ${branchVar} ≥ ${rightBranch.bound}.`);
      }

      if (p1ActionMatch && p2ActionMatch) {
        explanations.push(`✓ Decisiones de poda correctas: P1 (${children[0].expectedAction}), P2 (${children[1].expectedAction}).`);
      } else {
        explanations.push(`✗ Decisiones sobre los hijos: P1 es '${children[0].expectedAction}' y P2 es '${children[1].expectedAction}'.`);
      }

      const allCorrect = varMatch && leftMatch && rightMatch && p1ActionMatch && p2ActionMatch;
      const score = (varMatch ? 1 : 0) + (leftMatch && rightMatch ? 1 : 0) + (p1ActionMatch && p2ActionMatch ? 1 : 0);

      return {
        isCorrect: allCorrect,
        score,
        maxScore: 3,
        details: { varMatch, leftMatch, rightMatch, p1ActionMatch, p2ActionMatch },
        explanations,
      };
    }

    case 'C': {
      const { correctOptionIndex, options, optimal } = exercise;

      const userOpt = parseInt(userAnswers.optionIndex, 10);
      const userOptX1 = parseInt(userAnswers.optX1, 10);
      const userOptX2 = parseInt(userAnswers.optX2, 10);
      const userOptZ = parseInt(userAnswers.optZ, 10);

      const modelMatch = userOpt === correctOptionIndex;
      const optMatch = userOptX1 === optimal.x1 && userOptX2 === optimal.x2 && (!Number.isNaN(userOptZ) ? userOptZ === optimal.z : true);

      const explanations = [];

      if (modelMatch) {
        explanations.push(`✓ Formulación seleccionada correcta.`);
      } else {
        const chosen = options[userOpt];
        explanations.push(`✗ Formulación incorrecta: ${chosen ? chosen.flaw : 'La opción elegida no corresponde al modelo correcto.'}`);
      }

      if (optMatch) {
        explanations.push(`✓ Solución óptima entera correcta: x* = (${optimal.x1}, ${optimal.x2}) con Z* = ${optimal.z}.`);
      } else {
        explanations.push(`✗ Solución entera incorrecta: el óptimo del modelo entero es x* = (${optimal.x1}, ${optimal.x2}) con Z* = ${optimal.z}.`);
      }

      const allCorrect = modelMatch && optMatch;
      const score = (modelMatch ? 1 : 0) + (optMatch ? 1 : 0);

      return {
        isCorrect: allCorrect,
        score,
        maxScore: 2,
        details: { modelMatch, optMatch },
        explanations,
      };
    }

    case 'D': {
      const { expectedAnswer, explanation } = exercise;
      const userVal = userAnswers.answer; // true o false booleano

      const isCorrect = userVal === expectedAnswer;
      const explanations = [
        isCorrect
          ? `✓ Respuesta correcta (${expectedAnswer ? 'Verdadero' : 'Falso'}).`
          : `✗ Respuesta incorrecta: la afirmación es ${expectedAnswer ? 'Verdadera' : 'Falsa'}.`,
        explanation,
      ];

      return {
        isCorrect,
        score: isCorrect ? 1 : 0,
        maxScore: 1,
        details: { isCorrect },
        explanations,
      };
    }

    default:
      return { isCorrect: false, score: 0, explanations: ['Tipo de ejercicio no reconocido.'] };
  }
}
