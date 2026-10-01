import { frac } from './fraction.js';

/**
 * Formatea un vector de variables para presentación en texto.
 * Usa punto y coma como separador si hay números con coma.
 */
function formatVec(x, useDual = false) {
  if (!x || !Array.isArray(x)) return '—';
  const parts = x.map((v) => {
    const f = frac(v);
    if (f.isInteger()) return f.n.toString();
    if (useDual) {
      return `${f.toDecimal()} (${f.toString()})`;
    }
    return f.toDecimal();
  });
  const hasComma = parts.some((p) => p.includes(','));
  const sep = hasComma ? '; ' : ', ';
  return `(${parts.join(sep)})`;
}

/**
 * Formatea un valor escalar Z para presentación didáctica.
 */
function formatZ(z) {
  if (z === null || z === undefined) return '—';
  const f = frac(z);
  if (f.isInteger()) return f.n.toString();
  return `${f.toDecimal()} (${f.toString()})`;
}

/**
 * Genera la lista ordenada de pasos didácticos para la pestaña «Paso a paso».
 * Función 100% pura y reproducible, basada en el resultado de solveIP.
 *
 * @param {Object} arg1 - Modelo o resultado de solveIP
 * @param {Object} arg2 - Resultado de solveIP o modelo
 * @returns {Array<Object>} Lista de pasos para recorrer con StepBar
 */
export function buildSteps(arg1, arg2) {
  let model;
  let result;

  if (arg1 && (arg1.nodes || arg1.status)) {
    result = arg1;
    model = arg2 || {};
  } else {
    model = arg1 || {};
    result = arg2 || {};
  }

  const steps = [];
  const nodes = result?.nodes || [];
  const isMax = (model.sense || 'max') === 'max';

  // --------------------------------------------------------------------------
  // Paso 1: Planteamiento y región factible
  // --------------------------------------------------------------------------
  const cTerms = (model.c || ['5', '4'])
    .map((cj, idx) => {
      const coeff = frac(cj);
      const sign = coeff.gte(0) && idx > 0 ? '+ ' : '';
      return `${sign}${coeff.toString()}x${idx + 1}`;
    })
    .join(' ');

  const ctLines = (model.constraints || [])
    .map((ct) => {
      const left = ct.a
        .map((ai, idx) => {
          const coeff = frac(ai);
          if (coeff.isZero()) return null;
          const sign = coeff.gte(0) && idx > 0 ? '+ ' : '';
          return `${sign}${coeff.toString()}x${idx + 1}`;
        })
        .filter(Boolean)
        .join(' ');
      const opSymbol = ct.op === '<=' ? '≤' : ct.op === '>=' ? '≥' : '=';
      return `${left} ${opSymbol} ${frac(ct.b).toString()}`;
    })
    .join('\n');

  steps.push({
    id: 1,
    phase: 'formulation',
    title: '1. Planteamiento y región factible',
    explanation:
      'Se plantea el modelo matemático de programación entera pura. Todas las variables de decisión deben tomar valores enteros en ℤ. Dentro de la región factible continua delimitada por las restricciones se identifican los puntos con coordenadas enteras.',
    calculation: `${isMax ? 'Maximizar' : 'Minimizar'} Z = ${cTerms}\nsujeto a:\n${ctLines}\nxⱼ ≥ 0 y enteras (xⱼ ∈ ℤ)`,
    state: {
      visibleNodeIds: [],
      activeNodeId: null,
      incumbent: null,
      strip: null,
      highlightPoint: null,
    },
  });

  if (!nodes || nodes.length === 0 || result.status === 'infeasible') {
    steps.push({
      id: 2,
      phase: 'conclusion',
      title: '2. Problema infactible',
      explanation: 'El sistema de restricciones no admite ninguna solución factible.',
      calculation: 'Región factible vacía (infactible).',
      state: {
        visibleNodeIds: [],
        activeNodeId: null,
        incumbent: null,
        strip: null,
        highlightPoint: null,
      },
    });
    return steps;
  }

  const root = nodes[0];

  // --------------------------------------------------------------------------
  // Paso 2: Relajación lineal en el nodo raíz P0
  // --------------------------------------------------------------------------
  const rootXStr = root.x ? formatVec(root.x, false) : '—';
  const rootZStr = root.z ? formatZ(root.z) : '—';
  const boundType = isMax ? 'Cota superior' : 'Cota inferior';
  const boundComp = isMax ? '≤' : '≥';

  steps.push({
    id: 2,
    phase: 'relaxation',
    title: '2. Relajación lineal (nodo P0)',
    explanation:
      `Se resuelve la relajación lineal continua suprimiendo la exigencia de integralidad. La solución continua en el nodo raíz P0 es x = ${rootXStr} con Z = ${rootZStr}. Esta solución proporciona una cota insuperable para el problema entero (${boundType}: Z ${boundComp} ${root.z?.toDecimal() || rootZStr}).`,
    calculation: `Solución relajada P0:\nx = ${rootXStr}\nZ = ${rootZStr}\n${boundType}: Z ${boundComp} ${root.z?.toDecimal() || rootZStr}`,
    state: {
      visibleNodeIds: [root.id],
      activeNodeId: root.id,
      incumbent: null,
      strip: null,
      highlightPoint: root.x ? [root.x[0].toNumber(), root.x[1].toNumber()] : null,
    },
  });

  // Si la raíz ya es entera: terminar directamente
  if (root.status === 'integer') {
    steps.push({
      id: 3,
      phase: 'conclusion',
      title: '3. Solución entera en la raíz',
      explanation:
        'La solución de la relajación lineal ya cumple con todas las restricciones de integralidad. Por tanto, es de inmediato el óptimo entero sin necesidad de ramificar.',
      calculation: `x* = ${rootXStr}\nZ* = ${rootZStr}`,
      state: {
        visibleNodeIds: [root.id],
        activeNodeId: root.id,
        incumbent: { x: root.x, z: root.z },
        strip: null,
        highlightPoint: root.x ? [root.x[0].toNumber(), root.x[1].toNumber()] : null,
      },
    });
    return steps;
  }

  // --------------------------------------------------------------------------
  // Paso 3: ¿Es entera? Selección de variable
  // --------------------------------------------------------------------------
  const firstChildren = nodes.filter((n) => n.parentId === root.id);
  const branchVarIndex = firstChildren.length > 0 && firstChildren[0].branchVar !== null
    ? firstChildren[0].branchVar
    : 0;

  const fracParts = root.x.map((xj, idx) => {
    const f = xj.fractionalPart();
    return {
      idx,
      name: `x${idx + 1}`,
      val: xj.toDecimal(),
      fracDec: f.toDecimal(),
      fracStr: f.toString(),
      isFrac: !xj.isInteger(),
    };
  });

  const fracCalcs = fracParts
    .filter((p) => p.isFrac)
    .map((p) => `{${p.name}} = ${p.val} − ⌊${p.val}⌋ = ${p.fracDec} (${p.fracStr})`)
    .join('\n');

  const chosenVarName = `x${branchVarIndex + 1}`;
  const otherVarPart = fracParts.find((p) => p.idx !== branchVarIndex && p.isFrac);
  const comparisonText = otherVarPart
    ? `Como {${chosenVarName}} (${fracParts[branchVarIndex].fracDec}) > {${otherVarPart.name}} (${otherVarPart.fracDec}), se selecciona ${chosenVarName}.`
    : `Se selecciona ${chosenVarName} por ser fraccionaria.`;

  steps.push({
    id: 3,
    phase: 'select_branch',
    title: '3. ¿Es entera? Verificación y selección de variable',
    explanation:
      `La solución relajada contiene variables con valores fraccionarios. Se calculan las partes fraccionarias de cada variable ({v} = v − ⌊v⌋) y se elige la de mayor valor fraccionario para ramificar. En caso de empate se selecciona la de menor subíndice.`,
    calculation: `${fracCalcs}\n${comparisonText}`,
    state: {
      visibleNodeIds: [root.id],
      activeNodeId: root.id,
      incumbent: null,
      strip: null,
      highlightPoint: root.x ? [root.x[0].toNumber(), root.x[1].toNumber()] : null,
    },
  });

  // --------------------------------------------------------------------------
  // Paso 4: Ramificación del nodo raíz
  // --------------------------------------------------------------------------
  const leftChild = firstChildren.find((c) => c.branchOp === '<=') || firstChildren[0];
  const rightChild = firstChildren.find((c) => c.branchOp === '>=') || firstChildren[1];

  const floorBound = leftChild ? leftChild.branchBound.toString() : '3';
  const ceilBound = rightChild ? rightChild.branchBound.toString() : '4';

  const stripInfo = {
    var: branchVarIndex,
    low: Number(floorBound),
    high: Number(ceilBound),
  };

  steps.push({
    id: 4,
    phase: 'branch',
    title: `4. Ramificar: ${chosenVarName} ≤ ${floorBound} y ${chosenVarName} ≥ ${ceilBound}`,
    explanation:
      `Como no existen números enteros en el intervalo abierto (${floorBound}, ${ceilBound}), se divide el espacio de soluciones en dos subproblemas excluyentes: ${leftChild?.label || 'P1'} con ${chosenVarName} ≤ ${floorBound} y ${rightChild?.label || 'P2'} con ${chosenVarName} ≥ ${ceilBound}. La franja rayada ${floorBound} < ${chosenVarName} < ${ceilBound} queda descartada sin perder ningún punto entero.`,
    calculation: `Subproblemas generados:\n• ${leftChild?.label || 'P1'}: ${chosenVarName} ≤ ${floorBound}\n• ${rightChild?.label || 'P2'}: ${chosenVarName} ≥ ${ceilBound}\nFranja descartada: ${floorBound} < ${chosenVarName} < ${ceilBound}`,
    state: {
      visibleNodeIds: [root.id, ...(leftChild ? [leftChild.id] : []), ...(rightChild ? [rightChild.id] : [])],
      activeNodeId: root.id,
      incumbent: null,
      strip: stripInfo,
      highlightPoint: null,
    },
  });

  // --------------------------------------------------------------------------
  // Pasos de evaluación de los nodos hijos
  // --------------------------------------------------------------------------
  let currentIncumbent = null;
  const currentVisible = [root.id, ...(leftChild ? [leftChild.id] : []), ...(rightChild ? [rightChild.id] : [])];
  const pendingPrunes = [];

  const childNodes = nodes.slice(1);

  for (let idx = 0; idx < childNodes.length; idx++) {
    const node = childNodes[idx];
    if (!currentVisible.includes(node.id)) {
      currentVisible.push(node.id);
    }

    const varName = node.branchVar !== null ? `x${node.branchVar + 1}` : 'x';
    const opSym = node.branchOp === '<=' ? '≤' : node.branchOp === '>=' ? '≥' : '=';
    const boundStr = node.branchBound ? node.branchBound.toString() : '';
    const branchLabel = `${varName} ${opSym} ${boundStr}`;
    const nodeX = node.x ? [node.x[0].toNumber(), node.x[1].toNumber()] : null;

    if (node.status === 'infeasible') {
      steps.push({
        id: steps.length + 1,
        phase: 'node_infeasible',
        title: `Resolver ${node.label} (${branchLabel}): infactible`,
        explanation:
          `Al incorporar la restricción adicional ${branchLabel}, el sistema de restricciones se torna incompatible. El subproblema no tiene región factible y se poda por infactibilidad.`,
        calculation: `Restricción: ${branchLabel}\nEstado: infactible\nAcción: podado por infactibilidad.`,
        state: {
          visibleNodeIds: [...currentVisible],
          activeNodeId: node.id,
          incumbent: currentIncumbent,
          strip: stripInfo,
          highlightPoint: null,
        },
      });
      continue;
    }

    if (node.status === 'integer' || node.action === 'incumbent') {
      currentIncumbent = { x: node.x, z: node.z };
      steps.push({
        id: steps.length + 1,
        phase: 'node_incumbent',
        title: `Resolver ${node.label}: ${formatVec(node.x, false)}, Z = ${formatZ(node.z)} (incumbente)`,
        explanation:
          `Se resuelve la relajación de ${node.label} con la restricción ${branchLabel}. La solución resulta ser totalmente entera: x = ${formatVec(node.x, false)} con Z = ${formatZ(node.z)}. Al ser factible entera y mejorar las cotas conocidas, se establece como nuevo incumbente Z* = ${formatZ(node.z)} y la rama queda cerrada por integralidad.`,
        calculation: `Restricción: ${branchLabel}\nSolución: x = ${formatVec(node.x, false)}\nZ = ${formatZ(node.z)}\nResultado: entera factible → Nuevo incumbente Z* = ${formatZ(node.z)}`,
        state: {
          visibleNodeIds: [...currentVisible],
          activeNodeId: node.id,
          incumbent: currentIncumbent,
          strip: stripInfo,
          highlightPoint: nodeX,
        },
      });

      // Si había nodos pendientes de poda que ahora pueden ser podados por este nuevo incumbente
      for (let pIdx = pendingPrunes.length - 1; pIdx >= 0; pIdx--) {
        const pNode = pendingPrunes[pIdx];
        const canPrune = isMax
          ? pNode.z.floor() <= currentIncumbent.z.floor()
          : pNode.z.ceil() >= currentIncumbent.z.ceil();

        if (canPrune) {
          pendingPrunes.splice(pIdx, 1);
          const zFloor = pNode.z.floor();
          const incFloor = currentIncumbent.z.floor();
          steps.push({
            id: steps.length + 1,
            phase: 'node_pruned',
            title: `Podar ${pNode.label}: ⌊${pNode.z.toDecimal()}⌋ = ${zFloor} ≤ ${incFloor}`,
            explanation:
              `Con el nuevo incumbente Z* = ${currentIncumbent.z.toDual()} hallado en ${node.label}, se comprueba la cota del subproblema pendiente ${pNode.label}. Como ⌊Z⌋ = ${zFloor} no puede superar a Z* = ${incFloor}, ${pNode.label} se poda por cota.`,
            calculation: `Cota entera: ⌊Z⌋ = ⌊${pNode.z.toDecimal()}⌋ = ${zFloor}\nComparación: ⌊Z⌋ = ${zFloor} ≤ Z* = ${incFloor}\nResultado: se poda por cota.`,
            state: {
              visibleNodeIds: [...currentVisible],
              activeNodeId: pNode.id,
              incumbent: currentIncumbent,
              strip: stripInfo,
              highlightPoint: pNode.x ? [pNode.x[0].toNumber(), pNode.x[1].toNumber()] : null,
            },
          });
        }
      }
      continue;
    }

    if (node.action === 'pruned-bound') {
      // ¿Existe ya un incumbente que lo pode en este instante?
      const canPruneNow = currentIncumbent !== null && (
        isMax ? node.z.floor() <= currentIncumbent.z.floor() : node.z.ceil() >= currentIncumbent.z.ceil()
      );

      // Paso 1: Resolver la relajación del nodo
      steps.push({
        id: steps.length + 1,
        phase: 'node_solve',
        title: `Resolver ${node.label}: ${formatVec(node.x, false)}, Z = ${formatZ(node.z)}`,
        explanation:
          `Se resuelve la relajación continua del subproblema ${node.label} con la restricción ${branchLabel}. Se obtiene la solución continua x = ${formatVec(node.x, true)} con Z = ${formatZ(node.z)}.`,
        calculation: `Restricción: ${branchLabel}\nSolución relajada: x = ${formatVec(node.x, true)}\nZ = ${formatZ(node.z)}`,
        state: {
          visibleNodeIds: [...currentVisible],
          activeNodeId: node.id,
          incumbent: currentIncumbent,
          strip: stripInfo,
          highlightPoint: nodeX,
        },
      });

      if (canPruneNow) {
        // Paso 2: Podar inmediatamente por cota contra el incumbente activo
        const zFloor = node.z.floor();
        const incFloor = currentIncumbent.z.floor();

        steps.push({
          id: steps.length + 1,
          phase: 'node_pruned',
          title: `Podar ${node.label}: ⌊${node.z.toDecimal()}⌋ = ${zFloor} ≤ ${incFloor}`,
          explanation:
            `Dado que los coeficientes de la función objetivo son enteros, cualquier solución entera que pudiera existir en las ramas descendientes de ${node.label} tendría un valor Z entero a lo sumo igual a ⌊${node.z.toDecimal()}⌋ = ${zFloor}. Como ya se dispone de un incumbente con Z* = ${currentIncumbent.z.toDual()}, este subproblema no puede mejorarlo y se poda por cota.`,
          calculation: `Cota entera: ⌊Z⌋ = ⌊${node.z.toDecimal()}⌋ = ${zFloor}\nComparación: ⌊Z⌋ = ${zFloor} ≤ Z* = ${incFloor}\nResultado: se poda por cota.`,
          state: {
            visibleNodeIds: [...currentVisible],
            activeNodeId: node.id,
            incumbent: currentIncumbent,
            strip: stripInfo,
            highlightPoint: nodeX,
          },
        });
      } else {
        // Guardar para podar cuando aparezca el incumbente
        pendingPrunes.push(node);
      }
      continue;
    }

    // Nodo fraccionario que continúa abierto (ramifica)
    steps.push({
      id: steps.length + 1,
      phase: 'node_branch',
      title: `Resolver ${node.label} (${branchLabel}): x = ${formatVec(node.x, false)}, Z = ${formatZ(node.z)}`,
      explanation:
        `Se resuelve la relajación de ${node.label} con ${branchLabel}. La solución es fraccionaria con Z = ${formatZ(node.z)}. Al superar al incumbente actual, el subproblema queda abierto para seguir ramificando.`,
      calculation: `Restricción: ${branchLabel}\nSolución: x = ${formatVec(node.x, false)}\nZ = ${formatZ(node.z)}\nEstado: fraccionario prometedor → subproblema abierto.`,
      state: {
        visibleNodeIds: [...currentVisible],
        activeNodeId: node.id,
        incumbent: currentIncumbent,
        strip: stripInfo,
        highlightPoint: nodeX,
      },
    });
  }

  // Si queda algún pendiente de podar antes de concluir
  for (const pNode of pendingPrunes) {
    const zFloor = pNode.z.floor();
    const incFloor = currentIncumbent ? currentIncumbent.z.floor() : '—';
    steps.push({
      id: steps.length + 1,
      phase: 'node_pruned',
      title: `Podar ${pNode.label}: ⌊${pNode.z.toDecimal()}⌋ = ${zFloor} ≤ ${incFloor}`,
      explanation:
        `Con el incumbente Z* = ${currentIncumbent ? currentIncumbent.z.toDual() : '—'}, la cota entera de ${pNode.label} (⌊Z⌋ = ${zFloor}) no puede superarlo. Se poda por cota.`,
      calculation: `Cota entera: ⌊Z⌋ = ⌊${pNode.z.toDecimal()}⌋ = ${zFloor}\nComparación: ⌊Z⌋ = ${zFloor} ≤ Z* = ${incFloor}\nResultado: se poda por cota.`,
      state: {
        visibleNodeIds: [...currentVisible],
        activeNodeId: pNode.id,
        incumbent: currentIncumbent,
        strip: stripInfo,
        highlightPoint: pNode.x ? [pNode.x[0].toNumber(), pNode.x[1].toNumber()] : null,
      },
    });
  }

  // --------------------------------------------------------------------------
  // Paso final: Conclusión
  // --------------------------------------------------------------------------
  const best = result.best;
  const bestXStr = best ? formatVec(best.x, false) : 'Ninguno';
  const bestZStr = best ? formatZ(best.z) : '—';
  const bestNode = nodes.find((n) => n.action === 'incumbent' && best && n.z && n.z.eq(best.z));

  steps.push({
    id: steps.length + 1,
    phase: 'conclusion',
    title: `Conclusión: óptimo entero ${bestXStr}, Z = ${best ? best.z.toString() : '—'}`,
    explanation:
      `Todos los subproblemas del árbol han sido explorados o podados. La búsqueda finaliza con éxito. La solución óptima entera del problema es x = ${bestXStr} con un valor de función objetivo Z = ${bestZStr}.`,
    calculation: `Solución óptima entera:\nx* = ${bestXStr}\nZ* = ${bestZStr}\nNodos explorados: ${nodes.length}`,
    state: {
      visibleNodeIds: nodes.map((n) => n.id),
      activeNodeId: bestNode ? bestNode.id : null,
      incumbent: best,
      strip: stripInfo,
      highlightPoint: best ? [best.x[0].toNumber(), best.x[1].toNumber()] : null,
    },
  });

  return steps;
}
