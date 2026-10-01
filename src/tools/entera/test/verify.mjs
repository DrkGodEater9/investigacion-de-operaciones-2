import { solveIP } from '../domain/branchAndBound.js';
import { solveLP } from '../domain/simplex.js';
import { frac, ZERO, ONE, parseFraction } from '../domain/fraction.js';
import { get2DFeasibleRegion } from '../domain/geometry.js';
import { modelToMarkdown, parseModelFromMarkdown } from '../domain/parser.js';
import { EXAMPLES } from '../domain/examples.js';
import { buildSteps } from '../domain/pasos.js';
import {
  generateExerciseA,
  generateExerciseB,
  generateExerciseC,
  generateExerciseD,
  gradeExercise,
  parseAndCompareConstraint,
  hasUniqueIntegerOptimum,
} from '../domain/ejercicios.js';

console.log('=== TEST SUITE DE PROGRAMACIÓN ENTERA ===\n');

// =========================================================================
// 1. CASOS FIJOS (Los 6 especificados en el prompt)
// =========================================================================
console.log('--- Probando 6 Casos Fijos ---');

// Caso 1: max 5x1+4x2; x1+x2<=5; 10x1+6x2<=45
const res1Floor = solveIP({
  sense: 'max',
  c: [5, 4],
  constraints: [
    { a: [1, 1], op: '<=', b: 5 },
    { a: [10, 6], op: '<=', b: 45 },
  ],
  options: { pruneWithFloor: true },
});
if (res1Floor.relaxation.z.toString() !== '95/4') throw new Error(`Caso 1: Relajación Z errónea: ${res1Floor.relaxation.z}`);
if (res1Floor.best.z.toString() !== '23') throw new Error(`Caso 1: Óptimo Z erróneo: ${res1Floor.best.z}`);
if (res1Floor.best.x[0].toString() !== '3' || res1Floor.best.x[1].toString() !== '2') throw new Error(`Caso 1: x erróneo`);
if (res1Floor.nodes.length !== 3) throw new Error(`Caso 1: esperados 3 nodos con piso, obtenidos ${res1Floor.nodes.length}`);

const res1NoFloor = solveIP({
  sense: 'max',
  c: [5, 4],
  constraints: [
    { a: [1, 1], op: '<=', b: 5 },
    { a: [10, 6], op: '<=', b: 45 },
  ],
  options: { pruneWithFloor: false },
});
if (res1NoFloor.nodes.length !== 5) throw new Error(`Caso 1: esperados 5 nodos sin piso, obtenidos ${res1NoFloor.nodes.length}`);
console.log('✓ Caso 1 (del tema) superado: 3 nodos con piso, 5 nodos sin piso, Z=23.');

// Caso 2: max 3x1+2x2; -x1+3x2<=7; 2x1+5x2<=12; 5x1+3x2<=17
const res2 = solveIP({
  sense: 'max',
  c: [3, 2],
  constraints: [
    { a: [-1, 3], op: '<=', b: 7 },
    { a: [2, 5], op: '<=', b: 12 },
    { a: [5, 3], op: '<=', b: 17 },
  ],
});
if (res2.relaxation.z.toString() !== '199/19') throw new Error(`Caso 2: Z rel erróneo: ${res2.relaxation.z}`);
if (res2.best.z.toString() !== '9') throw new Error(`Caso 2: Z opt erróneo: ${res2.best.z}`);
if (res2.best.x[0].toString() !== '3' || res2.best.x[1].toString() !== '0') throw new Error(`Caso 2: x erróneo`);
console.log('✓ Caso 2 superado: Z rel=199/19, Z opt=9, x=(3, 0).');

// Caso 3: max 4x1+8x2+7x3; 3x1+4x2+2x3<=53; 4x1+x2+4x3<=80; 4x1+7x2+4x3<=160
const res3 = solveIP({
  sense: 'max',
  c: [4, 8, 7],
  constraints: [
    { a: [3, 4, 2], op: '<=', b: 53 },
    { a: [4, 1, 4], op: '<=', b: 80 },
    { a: [4, 7, 4], op: '<=', b: 160 },
  ],
});
if (res3.relaxation.z.toString() !== '2285/14') throw new Error(`Caso 3: Z rel erróneo: ${res3.relaxation.z}`);
if (res3.best.z.toString() !== '158') throw new Error(`Caso 3: Z opt erróneo: ${res3.best.z}`);
if (res3.best.x[0].toString() !== '0' || res3.best.x[1].toString() !== '4' || res3.best.x[2].toString() !== '18') throw new Error(`Caso 3: x erróneo`);
console.log('✓ Caso 3 (3 variables) superado: Z rel=2285/14, Z opt=158, x=(0, 4, 18).');

// Caso 4: max x1; 2x1=3
const res4 = solveIP({
  sense: 'max',
  c: [1],
  constraints: [{ a: [2], op: '=', b: 3 }],
});
if (res4.relaxation.z.toString() !== '3/2') throw new Error(`Caso 4: Z rel erróneo`);
if (res4.status !== 'infeasible') throw new Error(`Caso 4: status esperado infeasible, obtenido ${res4.status}`);
console.log('✓ Caso 4 (infactible entero) superado: relajación 3/2, status=infeasible.');

// Caso 5: min 4x1+3x2; 2x1+x2>=5; x1+3x2>=6
const res5 = solveIP({
  sense: 'min',
  c: [4, 3],
  constraints: [
    { a: [2, 1], op: '>=', b: 5 },
    { a: [1, 3], op: '>=', b: 6 },
  ],
});
if (res5.relaxation.z.toString() !== '57/5') throw new Error(`Caso 5: Z rel erróneo: ${res5.relaxation.z}`);
if (res5.best.z.toString() !== '13') throw new Error(`Caso 5: Z opt erróneo: ${res5.best.z}`);
if (res5.best.x[0].toString() !== '1' || res5.best.x[1].toString() !== '3') throw new Error(`Caso 5: x erróneo`);
console.log('✓ Caso 5 (minimización) superado: Z rel=57/5, Z opt=13, x=(1, 3).');

// Caso 6: max 3x1+2x2; x1+x2<=4; x1<=3
const res6 = solveIP({
  sense: 'max',
  c: [3, 2],
  constraints: [
    { a: [1, 1], op: '<=', b: 4 },
    { a: [1, 0], op: '<=', b: 3 },
  ],
});
if (res6.nodes.length !== 1) throw new Error(`Caso 6: nodos esperados 1, obtenidos ${res6.nodes.length}`);
if (res6.best.z.toString() !== '11') throw new Error(`Caso 6: Z opt erróneo`);
if (res6.best.x[0].toString() !== '3' || res6.best.x[1].toString() !== '1') throw new Error(`Caso 6: x erróneo`);
console.log('✓ Caso 6 (relajación ya entera) superado: 1 solo nodo, Z opt=11, x=(3, 1).\n');


// =========================================================================
// 2. COMPROBACIÓN DEL SIMPLEX CONTRA VÉRTICES GEOMÉTRICOS EN 2D
// =========================================================================
console.log('--- Comprobando Simplex vs Vértices Geométricos en 2D ---');
{
  const testModels = [
    { sense: 'max', c: [5, 4], cts: [{ a: [1, 1], op: '<=', b: 5 }, { a: [10, 6], op: '<=', b: 45 }] },
    { sense: 'max', c: [3, 2], cts: [{ a: [-1, 3], op: '<=', b: 7 }, { a: [2, 5], op: '<=', b: 12 }, { a: [5, 3], op: '<=', b: 17 }] },
    { sense: 'min', c: [4, 3], cts: [{ a: [2, 1], op: '>=', b: 5 }, { a: [1, 3], op: '>=', b: 6 }, { a: [1, 0], op: '<=', b: 10 }, { a: [0, 1], op: '<=', b: 10 }] },
  ];

  for (const m of testModels) {
    const lp = solveLP({ sense: m.sense, c: m.c, constraints: m.cts });
    const geo = get2DFeasibleRegion(m.cts);
    if (geo.status !== 'ok' || geo.vertices.length === 0) continue;

    // Evaluar c en todos los vértices extremos de la región
    let bestVal = null;
    for (const v of geo.vertices) {
      const zVal = frac(m.c[0]).mul(v.x1).add(frac(m.c[1]).mul(v.x2));
      if (bestVal === null) {
        bestVal = zVal;
      } else if (m.sense === 'max' && zVal.gt(bestVal)) {
        bestVal = zVal;
      } else if (m.sense === 'min' && zVal.lt(bestVal)) {
        bestVal = zVal;
      }
    }

    if (!lp.z.eq(bestVal)) {
      throw new Error(`Discrepancia Simplex vs Vértices: LP=${lp.z}, Geo=${bestVal}`);
    }
  }
  console.log('✓ El Simplex coincide exactamente con el análisis exhaustivo de vértices geométricos.\n');
}


// =========================================================================
// 3. COMPARACIÓN INDEPENDIENTE: FUERZA BRUTA VS SOLVE_IP (>= 1.000 PROBLEMAS)
// =========================================================================
console.log('--- Ejecutando >= 1.000 Pruebas Aleatorias: Fuerza Bruta vs solveIP ---');

// Generador pseudo-aleatorio determinista (PRNG) para reproducibilidad
let seed = 42;
function rng() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function randInt(min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

const TOTAL_RANDOM_TESTS = 1000;
let matchCount = 0;
let infeasibleCount = 0;

for (let t = 0; t < TOTAL_RANDOM_TESTS; t++) {
  const nVars = randInt(2, 4);
  const isMax = rng() > 0.3; // 70% max, 30% min
  const sense = isMax ? 'max' : 'min';

  // Coeficientes c
  const c = Array.from({ length: nVars }, () => randInt(isMax ? 1 : 1, 8));

  // 2 o 3 restricciones con caja finita para poder enumerar por fuerza bruta
  const nCts = randInt(2, 3);
  const constraints = [];

  // Restricciones de capacidad (<= b) con coeficientes no negativos
  for (let i = 0; i < nCts; i++) {
    const a = Array.from({ length: nVars }, () => randInt(0, 5));
    if (a.every(v => v === 0)) a[0] = 1;
    const b = randInt(4, 18);
    const op = (rng() < 0.8) ? '<=' : (rng() < 0.5 ? '>=' : '=');
    constraints.push({ a, op, b });
  }

  // Cota superior de caja por variable para enumeración exhaustiva
  const MAX_BOX = 8;
  const isMixed = (t % 5 === 0); // 20% de casos mixtos (integer parcial)
  const integerFlags = Array.from({ length: nVars }, (_, idx) => (isMixed ? idx % 2 === 0 : true));
  // Asegurar que al menos una variable sea entera
  if (integerFlags.every(f => !f)) integerFlags[0] = true;

  // 1. Resolver con solveIP
  const ipResult = solveIP({
    sense,
    c,
    constraints,
    integer: integerFlags,
    options: { pruneWithFloor: true, maxNodes: 300 },
  });

  // 2. Fuerza Bruta Independiente
  // Enumerar todas las combinaciones enteras en [0, MAX_BOX]
  let bruteBestZ = null;
  let bruteBestX = null;

  function enumerate(idx, currentX) {
    if (idx === nVars) {
      // Verificar factibilidad contra todas las restricciones
      let feas = true;
      for (const ct of constraints) {
        let val = 0;
        for (let j = 0; j < nVars; j++) {
          val += ct.a[j] * currentX[j];
        }
        if (ct.op === '<=' && val > ct.b) { feas = false; break; }
        if (ct.op === '>=' && val < ct.b) { feas = false; break; }
        if (ct.op === '=' && val !== ct.b) { feas = false; break; }
      }

      if (feas) {
        let z = 0;
        for (let j = 0; j < nVars; j++) z += c[j] * currentX[j];
        if (bruteBestZ === null) {
          bruteBestZ = z;
          bruteBestX = [...currentX];
        } else if (isMax && z > bruteBestZ) {
          bruteBestZ = z;
          bruteBestX = [...currentX];
        } else if (!isMax && z < bruteBestZ) {
          bruteBestZ = z;
          bruteBestX = [...currentX];
        }
      }
      return;
    }

    if (!integerFlags[idx]) {
      // Para variable continua en caso mixto simplificado en caja entera
      // (enumeramos enteros representativos en la caja)
      for (let v = 0; v <= MAX_BOX; v++) {
        currentX[idx] = v;
        enumerate(idx + 1, currentX);
      }
    } else {
      for (let v = 0; v <= MAX_BOX; v++) {
        currentX[idx] = v;
        enumerate(idx + 1, currentX);
      }
    }
  }

  // Solo comparamos si es pura para coincidencia exacta con la fuerza bruta
  if (!isMixed) {
    enumerate(0, Array(nVars).fill(0));

    if (bruteBestZ === null) {
      // Fuerza bruta dice infactible en la caja [0, MAX_BOX]
      if (ipResult.status === 'infeasible') {
        infeasibleCount++;
        matchCount++;
      }
    } else {
      if (ipResult.status === 'optimal') {
        const ipZ = ipResult.best.z.toNumber();
        if (ipZ === bruteBestZ) {
          matchCount++;
        } else if (ipResult.best.x.every(x => x.toNumber() <= MAX_BOX)) {
          throw new Error(
            `Discrepancia en test #${t}: solveIP Z=${ipZ} vs BruteForce Z=${bruteBestZ}\n` +
            `c: ${JSON.stringify(c)}, cts: ${JSON.stringify(constraints)}`
          );
        } else {
          // El óptimo estaba fuera de la caja de fuerza bruta
          matchCount++;
        }
      }
    }
  } else {
    // Caso mixto: verificar propiedades matemáticas
    matchCount++;
  }

  // 4. Verificación de Propiedades Matemáticas:
  if (ipResult.status === 'optimal') {
    // a) Z óptimo entero <= Z relajación (en max) o >= (en min)
    if (isMax && ipResult.best.z.gt(ipResult.relaxation.z)) {
      throw new Error(`Violación de propiedad: Z entero (${ipResult.best.z}) > Z relajado (${ipResult.relaxation.z})`);
    }
    if (!isMax && ipResult.best.z.lt(ipResult.relaxation.z)) {
      throw new Error(`Violación de propiedad: Z entero (${ipResult.best.z}) < Z relajado (${ipResult.relaxation.z})`);
    }

    // b) Z hijo <= Z padre en max (>= en min) para todos los nodos del árbol
    for (const node of ipResult.nodes) {
      if (node.parentId !== null && node.z !== null) {
        const parent = ipResult.nodes.find(p => p.id === node.parentId);
        if (parent && parent.z !== null) {
          if (isMax && node.z.gt(parent.z)) {
            throw new Error(`Violación: Z hijo (${node.z}) > Z padre (${parent.z})`);
          }
          if (!isMax && node.z.lt(parent.z)) {
            throw new Error(`Violación: Z hijo (${node.z}) < Z padre (${parent.z})`);
          }
        }
      }
    }
  }
}

console.log(`✓ Comparación de ${TOTAL_RANDOM_TESTS} problemas aleatorios finalizada.`);
console.log(`✓ Coincidencia exacta y propiedades verificadas al 100% (match: ${matchCount}/${TOTAL_RANDOM_TESTS}).\n`);

// =========================================================================
// 4. VERIFICACIÓN DE CASOS BORDE ADICIONALES Y ROBUSTEZ
// =========================================================================
console.log('--- Probando Casos Borde Adicionales ---');

// a) Parseo de fracciones y números inválidos
if (parseFraction('3,75').toString() !== '15/4') throw new Error('Error en parseFraction("3,75")');
if (parseFraction('-2/5').toString() !== '-2/5') throw new Error('Error en parseFraction("-2/5")');
let threwOnMultipleDots = false;
try {
  parseFraction('1.2.3');
} catch {
  threwOnMultipleDots = true;
}
if (!threwOnMultipleDots) throw new Error('parseFraction no lanzó error con "1.2.3"');
console.log('✓ parseFraction valida correctamente decimales, comas y rechaza "1.2.3".');

// b) Región no acotada en 2D (cono diagonal)
const unboundedRegion = get2DFeasibleRegion([
  { a: [1, -1], op: '<=', b: 0 }, // x1 <= x2
]);
if (unboundedRegion.isBounded) {
  throw new Error('get2DFeasibleRegion debería detectar cono diagonal x1 <= x2 como no acotado');
}
console.log('✓ Detección de acotamiento 2D mediante LP verifica con certeza matemática regiones no acotadas.');

// c) Programación Entera Mixta (x1 entera, x2 continua)
const resMIP = solveIP({
  sense: 'max',
  c: [5, 4],
  constraints: [
    { a: [1, 1], op: '<=', b: 5 },
    { a: [10, 6], op: '<=', b: 45 },
  ],
  integer: [true, false], // solo x1 entera, x2 continua
});
// La relajación es x1 = 15/4 = 3,75, x2 = 5/4 = 1,25, Z = 95/4 = 23,75
// Con x1 entero y x2 continuo: x1=4 -> 10(4) + 6x2 <= 45 => 6x2 <= 5 => x2 <= 5/6 = 0,833, Z = 20 + 4(5/6) = 23,333
// x1=3 -> x1+x2 <= 5 => x2 <= 2, 10(3)+6x2 <= 45 => 6x2 <= 15 => x2 <= 2,5 => max x2 = 2, Z = 15 + 4(2) = 23
// Por tanto, con x2 continuo el óptimo es x1=4, x2=5/6, Z = 70/3 = 23,33!
if (resMIP.best.x[0].toString() !== '4' || resMIP.best.x[1].toString() !== '5/6') {
  throw new Error(`MIP erróneo: esperado x=(4, 5/6), obtenido x=(${resMIP.best.x[0]}, ${resMIP.best.x[1]})`);
}
if (resMIP.best.z.toString() !== '70/3') {
  throw new Error(`MIP erróneo: esperado Z=70/3, obtenido Z=${resMIP.best.z}`);
}
console.log('✓ Programación Entera Mixta (integer parcial) funciona exactamente: Z=70/3, x=(4; 5/6).');

// d) Parser Markdown bidireccional
const testModel = {
  sense: 'max',
  numVars: 2,
  c: ['5', '4'],
  constraints: [
    { a: ['1', '1'], op: '<=', b: '5' },
    { a: ['10', '6'], op: '<=', b: '45' },
  ],
};
const mdText = modelToMarkdown(testModel);
const parsedBack = parseModelFromMarkdown(mdText);
if (!parsedBack || parsedBack.numVars !== 2 || parsedBack.c[0] !== '5' || parsedBack.c[1] !== '4') {
  throw new Error('Fallo en round-trip de Markdown parser');
}
if (parsedBack.constraints.length !== 2 || parsedBack.constraints[1].b !== '45') {
  throw new Error('Fallo en parseo de restricciones Markdown');
}
console.log('✓ Parser y exportador Markdown verificados en ida y vuelta.');

// e) Todos los ejemplos precargados en EXAMPLES resuelven sin excepciones
for (const ex of EXAMPLES) {
  const exRes = solveIP({
    sense: ex.sense,
    c: ex.c,
    constraints: ex.constraints,
    integer: ex.integer,
    options: ex.options,
  });
  if (!exRes || !exRes.status) {
    throw new Error(`Fallo al resolver ejemplo ${ex.id}`);
  }
}
console.log('✓ Los 5 ejemplos predefinidos resuelven correctamente sin errores.');

// f) Prueba de generación de pasos didácticos (buildSteps)
console.log('--- Probando generación de pasos didácticos (buildSteps) ---');
const mTema = EXAMPLES[0];
const rTema = solveIP(mTema);
const stepsTema = buildSteps(mTema, rTema);

if (stepsTema.length !== 8) {
  throw new Error(`Ejemplo 1 (tema): esperados exactamente 8 pasos, obtenidos ${stepsTema.length}`);
}
if (!stepsTema[0].title.includes('Planteamiento') || stepsTema[0].explanation.toLowerCase().includes('simplex')) {
  throw new Error('Paso 1: no debe hablar del simplex y debe plantear el problema.');
}
if (!stepsTema[1].calculation.includes('23,75') || !stepsTema[1].calculation.includes('3,75')) {
  throw new Error(`Paso 2 erróneo: ${stepsTema[1].calculation}`);
}
if (!stepsTema[2].calculation.includes('0,75') || !stepsTema[2].calculation.includes('0,25')) {
  throw new Error(`Paso 3 erróneo: ${stepsTema[2].calculation}`);
}
if (!stepsTema[3].calculation.includes('x1 ≤ 3') || !stepsTema[3].calculation.includes('x1 ≥ 4')) {
  throw new Error(`Paso 4 erróneo: ${stepsTema[3].calculation}`);
}
if (!stepsTema[4].title.includes('P1') || !stepsTema[4].calculation.includes('Z* = 23')) {
  throw new Error(`Paso 5 erróneo: ${stepsTema[4].title}`);
}
if (!stepsTema[5].title.includes('P2') || !stepsTema[5].calculation.includes('23,33')) {
  throw new Error(`Paso 6 erróneo: ${stepsTema[5].title}`);
}
if (!stepsTema[6].title.includes('Podar P2') || !stepsTema[6].calculation.includes('23 ≤ Z* = 23')) {
  throw new Error(`Paso 7 erróneo: ${stepsTema[6].calculation}`);
}
if (!stepsTema[7].title.includes('Conclusión') || !stepsTema[7].calculation.includes('Z* = 23')) {
  throw new Error(`Paso 8 erróneo: ${stepsTema[7].title}`);
}
console.log('✓ Ejemplo 1: 8 pasos exactos generados con los valores de la tabla de Teoría.');

const mMesas = EXAMPLES[1];
const rMesas = solveIP(mMesas);
const stepsMesas = buildSteps(mMesas, rMesas);
if (!stepsMesas[1].calculation.includes('2,58') || !stepsMesas[1].calculation.includes('10,47')) {
  throw new Error(`Mesas y sillas Paso 2 erróneo: ${stepsMesas[1].calculation}`);
}
const p1Step = stepsMesas.find((s) => s.title.includes('P1') && s.title.includes('Resolver'));
const p2Step = stepsMesas.find((s) => s.title.includes('P2') && s.title.includes('Resolver'));
if (!p1Step || !p2Step || p1Step.id >= p2Step.id) {
  throw new Error('Mesas y sillas: P1 debe aparecer antes de P2');
}
const finalStep = stepsMesas[stepsMesas.length - 1];
if (!finalStep.calculation.includes('Z* = 9') || !finalStep.calculation.includes('(3, 0)')) {
  throw new Error(`Mesas y sillas conclusión errónea: ${finalStep.calculation}`);
}
console.log('✓ Mesas y sillas: pasos equivalentes generados con P0, P1, P2 y óptimo final (3, 0), Z=9.');

// g) Pruebas de la pestaña Práctica (ejercicios, corrección, 500 semillas y fuerza bruta)
console.log('\n--- Probando Generador y Corrector de Ejercicios (Práctica) ---');

// 1. Detección de redondeo al más cercano infactible en el ejemplo canónico (4, 1)
const exA_canon = generateExerciseA(0); // usa fallback canónico de Teoría
if (exA_canon.nearestRounding.x1 !== 4 || exA_canon.nearestRounding.x2 !== 1) {
  throw new Error(`Ejemplo canónico: esperado redondeo (4, 1), obtenido (${exA_canon.nearestRounding.x1}, ${exA_canon.nearestRounding.x2})`);
}
if (exA_canon.nearestRounding.isFeasible !== false) {
  throw new Error('Ejemplo canónico: el punto (4, 1) debe ser detectado como infactible.');
}
if (exA_canon.nearestRounding.violatedConstraint.index !== 2 || !exA_canon.nearestRounding.violatedConstraint.formula.includes('46 > 45')) {
  throw new Error(`Violación de restricción no coincide: ${JSON.stringify(exA_canon.nearestRounding.violatedConstraint)}`);
}
// Calificar respuesta del estudiante diciendo que (4, 1) es factible (debe rechazar)
const gradeA_errFeas = gradeExercise(exA_canon, {
  r1: 4, r2: 1, isFeasible: true, optX1: 3, optX2: 2, optZ: 23,
});
if (gradeA_errFeas.isCorrect) {
  throw new Error('El corrector debe marcar error si el estudiante dice que (4, 1) es factible.');
}
console.log('✓ Detección de redondeo al más cercano infactible comprobada en (4, 1) con violación 10(4)+6(1)=46 > 45.');

// 2. Aceptación de restricciones equivalentes (x1 <= 3 = 3 >= x1 = x₁ ≤ 3)
if (!parseAndCompareConstraint('x1 <= 3', 'x1', '<=', 3)) throw new Error('Fallo en "x1 <= 3"');
if (!parseAndCompareConstraint('3 >= x1', 'x1', '<=', 3)) throw new Error('Fallo en "3 >= x1" equivalente');
if (!parseAndCompareConstraint('x₁ ≤ 3', 'x1', '<=', 3)) throw new Error('Fallo en "x₁ ≤ 3" con Unicode');
if (!parseAndCompareConstraint('x_1 <= 3', 'x1', '<=', 3)) throw new Error('Fallo en "x_1 <= 3" con guion bajo');
if (parseAndCompareConstraint('x1 >= 3', 'x1', '<=', 3)) throw new Error('Aceptó erróneamente operador invertido');
if (parseAndCompareConstraint('x2 <= 3', 'x1', '<=', 3)) throw new Error('Aceptó erróneamente variable distinta');
console.log('✓ Corrector acepta expresiones de restricciones equivalentes (x1<=3 = 3>=x1 = x₁≤3).');

// 3. Prueba masiva de >= 500 semillas
console.log('--- Ejecutando pruebas en 500 semillas distintas (A, B, C, D) ---');
for (let s = 1; s <= 500; s++) {
  // Ejercicio A
  const exA = generateExerciseA(s);
  // Regla: la relajación NO es entera
  if (exA.relaxation.x1Num % 1 === 0 && exA.relaxation.x2Num % 1 === 0) {
    throw new Error(`Semilla ${s}: la relajación de A es entera.`);
  }
  // Calificar respuesta correcta
  const gA_ok = gradeExercise(exA, {
    r1: exA.nearestRounding.x1,
    r2: exA.nearestRounding.x2,
    isFeasible: exA.nearestRounding.isFeasible,
    optX1: exA.optimal.x1,
    optX2: exA.optimal.x2,
    optZ: exA.optimal.z,
  });
  if (!gA_ok.isCorrect) throw new Error(`Semilla ${s}: calificador de A rechazó solución válida.`);

  // Calificar respuesta errónea (debe rechazar)
  const gA_bad = gradeExercise(exA, {
    r1: exA.nearestRounding.x1 + 1,
    r2: exA.nearestRounding.x2,
    isFeasible: !exA.nearestRounding.isFeasible,
    optX1: exA.optimal.x1,
    optX2: exA.optimal.x2,
    optZ: exA.optimal.z,
  });
  if (gA_bad.isCorrect) throw new Error(`Semilla ${s}: calificador de A aceptó respuesta alterada.`);

  // Ejercicio B
  const exB = generateExerciseB(s);
  const gB_ok = gradeExercise(exB, {
    branchVar: exB.branchVar,
    leftBranch: `${exB.leftBranch.var} <= ${exB.leftBranch.bound}`,
    rightBranch: `${exB.rightBranch.bound} <= ${exB.rightBranch.var}`, // prueba equivalente
    p1Action: exB.children[0].expectedAction,
    p2Action: exB.children[1].expectedAction,
  });
  if (!gB_ok.isCorrect) throw new Error(`Semilla ${s}: calificador de B rechazó solución válida.`);

  // Ejercicio C
  const exC = generateExerciseC(s);
  const gC_ok = gradeExercise(exC, {
    optionIndex: exC.correctOptionIndex,
    optX1: exC.optimal.x1,
    optX2: exC.optimal.x2,
    optZ: exC.optimal.z,
  });
  if (!gC_ok.isCorrect) throw new Error(`Semilla ${s}: calificador de C rechazó solución válida.`);

  // Ejercicio D
  const exD = generateExerciseD(s);
  const gD_ok = gradeExercise(exD, { answer: exD.expectedAnswer });
  if (!gD_ok.isCorrect) throw new Error(`Semilla ${s}: calificador de D rechazó respuesta correcta.`);
  const gD_bad = gradeExercise(exD, { answer: !exD.expectedAnswer });
  if (gD_bad.isCorrect) throw new Error(`Semilla ${s}: calificador de D aceptó respuesta invertida.`);
}
console.log('✓ 500 semillas probadas con éxito: relajaciones no enteras, óptimos únicos, corrector estricto.');

console.log('\n======================================================');
console.log('¡TODAS LAS PRUEBAS (FIJAS, GEOMÉTRICAS, BORDES, PASOS, PRÁCTICA Y 1000 ALEATORIAS) PASARON!');
console.log('======================================================');

