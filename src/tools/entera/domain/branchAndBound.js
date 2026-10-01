import { Fraction, ZERO, ONE, frac } from './fraction.js';
import { solveLP } from './simplex.js';

/**
 * Determina si es válido usar la cota del piso (en max) o techo (en min).
 * Regla: solo si todos los coeficientes de la función objetivo c son enteros
 * y todas las variables con c_j != 0 están marcadas como enteras.
 */
export function canUseFloorPruning(c, integer, pruneOption = true) {
  if (!pruneOption) return false;
  for (let j = 0; j < c.length; j++) {
    const cj = frac(c[j]);
    if (!cj.isZero()) {
      if (!cj.isInteger()) return false;
      if (!integer[j]) return false;
    }
  }
  return true;
}

/**
 * Comprueba si una solución x cumple la integralidad en las variables enteras.
 */
export function isSolutionInteger(x, integer) {
  for (let j = 0; j < x.length; j++) {
    if (integer[j] && !x[j].isInteger()) {
      return false;
    }
  }
  return true;
}

/**
 * Elige la variable en la cual ramificar.
 * - 'mostFractional': mayor parte fraccionaria (v - floor(v)). Empate: menor índice.
 * - 'lowestIndex': primera variable fraccionaria de menor índice.
 */
export function selectBranchVariable(x, integer, rule = 'mostFractional') {
  const candidates = [];
  for (let j = 0; j < x.length; j++) {
    if (integer[j] && !x[j].isInteger()) {
      candidates.push(j);
    }
  }

  if (candidates.length === 0) return -1;
  if (rule === 'lowestIndex') return candidates[0];

  // mostFractional: mayor v - floor(v)
  let bestVar = candidates[0];
  let bestFrac = x[bestVar].fractionalPart();

  for (let i = 1; i < candidates.length; i++) {
    const v = candidates[i];
    const f = x[v].fractionalPart();
    if (f.gt(bestFrac)) {
      bestFrac = f;
      bestVar = v;
    }
  }

  return bestVar;
}

/**
 * Solucionador principal de Programación Entera (pura o mixta) mediante Branch & Bound.
 * API 100% pura y exacta.
 */
export function solveIP({
  sense = 'max',
  c,
  constraints = [],
  integer = [],
  options = {},
}) {
  const n = c.length;
  const isMax = sense === 'max';
  const branchRule = options.branchRule || 'mostFractional';
  const childOrder = options.childOrder || 'bestZ';
  const pruneWithFloor = options.pruneWithFloor !== false;
  const maxNodes = options.maxNodes || 500;

  // Si no se especifica integer[], por defecto todas son enteras (entera pura)
  const isInt = Array.from({ length: n }, (_, j) => (integer[j] !== undefined ? !!integer[j] : true));

  const floorPruningActive = canUseFloorPruning(c, isInt, pruneWithFloor);

  // 1. Resolver la relajación continua del problema original (raíz)
  const rootLP = solveLP({ sense, c, constraints });

  if (rootLP.status === 'infeasible') {
    return {
      status: 'infeasible',
      relaxation: null,
      best: null,
      nodes: [
        {
          id: 0,
          parentId: null,
          label: 'P0',
          branchVar: null,
          branchOp: null,
          branchBound: null,
          x: null,
          z: null,
          status: 'infeasible',
          action: 'pruned-infeasible',
          incumbentAfter: null,
          order: 0,
          depth: 0,
          constraints: [],
        },
      ],
      counts: { nodes: 1, pruned: 1, integer: 0 },
    };
  }

  if (rootLP.status === 'unbounded') {
    return {
      status: 'unbounded',
      relaxation: null,
      best: null,
      nodes: [],
      counts: { nodes: 1, pruned: 0, integer: 0 },
    };
  }

  const relaxation = {
    x: rootLP.x,
    z: rootLP.z,
  };

  // Verificar si la raíz ya es entera
  if (isSolutionInteger(rootLP.x, isInt)) {
    const rootNode = {
      id: 0,
      parentId: null,
      label: 'P0',
      branchVar: null,
      branchOp: null,
      branchBound: null,
      x: rootLP.x,
      z: rootLP.z,
      status: 'integer',
      action: 'incumbent',
      incumbentAfter: rootLP.z,
      order: 0,
      depth: 0,
      constraints: [],
    };
    return {
      status: 'optimal',
      relaxation,
      best: { x: rootLP.x, z: rootLP.z },
      nodes: [rootNode],
      counts: { nodes: 1, pruned: 1, integer: 1 },
    };
  }

  // Estructura del árbol B&B
  let incumbent = null; // { x, z }
  let nodeCount = 0;
  let prunedCount = 0;
  let integerCount = 0;

  const allNodes = [];
  let nextId = 0;

  // Nodo raíz P0
  const rootNode = {
    id: nextId++,
    parentId: null,
    label: 'P0',
    branchVar: null,
    branchOp: null,
    branchBound: null,
    x: rootLP.x,
    z: rootLP.z,
    status: 'fractional',
    action: 'branch',
    incumbentAfter: null,
    order: 0,
    depth: 0,
    addedConstraints: [],
  };

  allNodes.push(rootNode);
  nodeCount++;

  // Pila de nodos abiertos por explorar
  // Cada elemento: { node, addedConstraints }
  const openStack = [{ node: rootNode, addedConstraints: [] }];
  let visitOrder = 1;

  while (openStack.length > 0 && nodeCount < maxNodes) {
    // Tomar el siguiente nodo según estrategia de exploración
    const current = openStack.pop();
    const currNode = current.node;
    const currConstraints = current.addedConstraints;

    // Antes de ramificar, comprobar si el nodo quedó obsoleto por un incumbente descubierto después
    if (incumbent !== null) {
      let isPruned = false;
      if (isMax) {
        if (floorPruningActive) {
          if (currNode.z.floor() <= incumbent.z.floor()) isPruned = true;
        } else {
          if (currNode.z.lte(incumbent.z)) isPruned = true;
        }
      } else {
        if (floorPruningActive) {
          if (currNode.z.ceil() >= incumbent.z.ceil()) isPruned = true;
        } else {
          if (currNode.z.gte(incumbent.z)) isPruned = true;
        }
      }
      if (isPruned) {
        currNode.action = 'pruned-bound';
        prunedCount++;
        continue;
      }
    }

    // Elegir variable en la cual ramificar
    const branchVar = selectBranchVariable(currNode.x, isInt, branchRule);
    if (branchVar === -1) {
      // Debería ser entera
      continue;
    }

    const val = currNode.x[branchVar];
    const floorVal = new Fraction(val.floor(), 1n);
    const ceilVal = new Fraction(val.ceil(), 1n);

    // Crear especificación de los dos hijos
    // Hijo izquierdo: x_k <= floorVal
    const leftA = Array(n).fill(ZERO);
    leftA[branchVar] = ONE;
    const leftCt = { a: leftA, op: '<=', b: floorVal };

    // Hijo derecho: x_k >= ceilVal
    const rightA = Array(n).fill(ZERO);
    rightA[branchVar] = ONE;
    const rightCt = { a: rightA, op: '>=', b: ceilVal };

    // Resolver ambos hijos antes de continuar
    const leftFullConstraints = [...constraints, ...currConstraints, leftCt];
    const leftLP = solveLP({ sense, c, constraints: leftFullConstraints });

    const rightFullConstraints = [...constraints, ...currConstraints, rightCt];
    const rightLP = solveLP({ sense, c, constraints: rightFullConstraints });

    // Preparar registros de nodos
    const leftNode = {
      id: nextId++,
      parentId: currNode.id,
      label: `P${nodeCount++}`,
      branchVar,
      branchOp: '<=',
      branchBound: floorVal,
      x: leftLP.x,
      z: leftLP.z,
      status: leftLP.status === 'optimal' ? (isSolutionInteger(leftLP.x, isInt) ? 'integer' : 'fractional') : leftLP.status,
      action: 'branch',
      incumbentAfter: null,
      order: visitOrder++,
      depth: currNode.depth + 1,
      addedConstraints: [...currConstraints, leftCt],
    };

    const rightNode = {
      id: nextId++,
      parentId: currNode.id,
      label: `P${nodeCount++}`,
      branchVar,
      branchOp: '>=',
      branchBound: ceilVal,
      x: rightLP.x,
      z: rightLP.z,
      status: rightLP.status === 'optimal' ? (isSolutionInteger(rightLP.x, isInt) ? 'integer' : 'fractional') : rightLP.status,
      action: 'branch',
      incumbentAfter: null,
      order: visitOrder++,
      depth: currNode.depth + 1,
      addedConstraints: [...currConstraints, rightCt],
    };

    allNodes.push(leftNode);
    allNodes.push(rightNode);

    // Función auxiliar para evaluar y podar un hijo
    function evaluateChild(node) {
      if (node.status === 'infeasible') {
        node.action = 'pruned-infeasible';
        prunedCount++;
        return false; // no abierto
      }
      if (node.status === 'unbounded') {
        node.action = 'pruned-infeasible';
        return false;
      }
      if (node.status === 'integer') {
        integerCount++;
        const isBetter =
          incumbent === null ||
          (isMax ? node.z.gt(incumbent.z) : node.z.lt(incumbent.z));

        if (isBetter) {
          incumbent = { x: node.x, z: node.z };
          node.action = 'incumbent';
        } else {
          node.action = 'pruned-bound';
        }
        prunedCount++;
        return false; // la rama entera se poda
      }

      // Solución fraccionaria: verificar contra incumbente actual
      if (incumbent !== null) {
        let isPruned = false;
        if (isMax) {
          if (floorPruningActive) {
            if (node.z.floor() <= incumbent.z.floor()) isPruned = true;
          } else {
            if (node.z.lte(incumbent.z)) isPruned = true;
          }
        } else {
          if (floorPruningActive) {
            if (node.z.ceil() >= incumbent.z.ceil()) isPruned = true;
          } else {
            if (node.z.gte(incumbent.z)) isPruned = true;
          }
        }
        if (isPruned) {
          node.action = 'pruned-bound';
          prunedCount++;
          return false;
        }
      }

      return true; // permanece abierto
    }

    // Evaluar ambos hijos
    const leftOpen = evaluateChild(leftNode);
    const rightOpen = evaluateChild(rightNode);

    // Re-evaluar por si uno de los hijos generó un nuevo incumbente que poda al otro
    if (leftOpen && !rightOpen && rightNode.action === 'incumbent') {
      if (!evaluateChild(leftNode)) {
        // Se podó gracias al nuevo incumbente
      }
    } else if (rightOpen && !leftOpen && leftNode.action === 'incumbent') {
      if (!evaluateChild(rightNode)) {
        // Se podó gracias al nuevo incumbente
      }
    }

    // Actualizar incumbentAfter en ambos nodos
    leftNode.incumbentAfter = incumbent ? incumbent.z : null;
    rightNode.incumbentAfter = incumbent ? incumbent.z : null;

    // Agregar los hijos abiertos a la pila según orden de exploración
    const openChildren = [];
    if (leftNode.action === 'branch') {
      openChildren.push({ node: leftNode, addedConstraints: leftNode.addedConstraints });
    }
    if (rightNode.action === 'branch') {
      openChildren.push({ node: rightNode, addedConstraints: rightNode.addedConstraints });
    }

    if (openChildren.length === 2) {
      if (childOrder === 'bestZ') {
        // En max: queremos que el de mayor Z quede arriba del stack (se procese primero)
        const leftBetter = isMax ? leftNode.z.gte(rightNode.z) : leftNode.z.lte(rightNode.z);
        if (leftBetter) {
          // Meter derecho primero, luego izquierdo
          openStack.push(openChildren[1]);
          openStack.push(openChildren[0]);
        } else {
          openStack.push(openChildren[0]);
          openStack.push(openChildren[1]);
        }
      } else if (childOrder === 'downFirst') {
        // Left (<=) primero en salir: meter right primero
        openStack.push(openChildren[1]);
        openStack.push(openChildren[0]);
      } else if (childOrder === 'upFirst') {
        // Right (>=) primero en salir: meter left primero
        openStack.push(openChildren[0]);
        openStack.push(openChildren[1]);
      }
    } else if (openChildren.length === 1) {
      openStack.push(openChildren[0]);
    }
  }

  // Comprobar si se alcanzó el límite de nodos
  const reachedLimit = nodeCount >= maxNodes && openStack.length > 0;
  const status = incumbent !== null ? 'optimal' : reachedLimit ? 'nodeLimit' : 'infeasible';

  return {
    status,
    relaxation,
    best: incumbent,
    nodes: allNodes,
    counts: {
      nodes: allNodes.length,
      pruned: prunedCount,
      integer: integerCount,
    },
  };
}
