import { frac } from './fraction.js';
import { canUseFloorPruning } from './branchAndBound.js';

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

/** Misma regla de poda por cota que solveIP. */
function podaPorCota(z, inc, isMax, usaPiso) {
  if (isMax) return usaPiso ? z.floor() <= inc.floor() : z.lte(inc);
  return usaPiso ? z.ceil() >= inc.ceil() : z.gte(inc);
}

/**
 * Comparación de poda por cota entre la relajación de un nodo (z) y el incumbente (inc).
 * Con piso (coeficientes enteros sobre variables enteras): en máx. ⌊Z⌋ ≤ ⌊Z*⌋ y en mín. ⌈Z⌉ ≥ ⌈Z*⌉.
 * Sin piso: Z ≤ Z* (máx.) o Z ≥ Z* (mín.).
 */
function comparacionCota(z, inc, isMax, usaPiso) {
  const zd = z.toDecimal();
  const cmp = isMax ? '≤' : '≥';
  if (usaPiso) {
    const zi = isMax ? z.floor() : z.ceil();
    const ii = isMax ? inc.floor() : inc.ceil();
    const a = isMax ? '⌊' : '⌈';
    const c = isMax ? '⌋' : '⌉';
    return {
      titulo: `${a}${zd}${c} = ${zi} ${cmp} ${ii}`,
      calculo: `Cota entera: ${a}Z${c} = ${a}${zd}${c} = ${zi}\nComparación: ${a}Z${c} = ${zi} ${cmp} Z* = ${ii}\nResultado: se poda por cota.`,
      parcial: `${a}Z${c} = ${zi}`,
      limite: `${ii}`,
      zi: `${zi}`,
    };
  }
  return {
    titulo: `${zd} ${cmp} ${inc.toDecimal()}`,
    calculo: `Comparación: Z = ${zd} ${cmp} Z* = ${inc.toDecimal()}\nResultado: se poda por cota.`,
    parcial: `Z = ${zd}`,
    limite: inc.toDecimal(),
    zi: zd,
  };
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
  const cModelo = model.c || ['5', '4'];
  const flagsInt = cModelo.map((_, j) => (model.integer && model.integer[j] !== undefined ? !!model.integer[j] : true));
  // Misma decisión que toma solveIP: con piso/techo solo si c es entera sobre variables enteras.
  const usaPiso = canUseFloorPruning(cModelo, flagsInt, model.options?.pruneWithFloor !== false);

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

  const sinFinal = { visibleNodeIds: [], activeNodeId: null, incumbent: null, strip: null, highlightPoint: null };
  if (result.status === 'unbounded') {
    steps.push({
      id: 2,
      phase: 'conclusion',
      title: '2. Problema no acotado',
      explanation:
        'La relajación lineal no tiene óptimo finito: la función objetivo puede mejorar sin límite dentro de la región factible. Por eso no hay un óptimo entero que buscar.',
      calculation: 'Relajación lineal no acotada.',
      state: sinFinal,
    });
    return steps;
  }

  if (!nodes || nodes.length === 0 || (result.status === 'infeasible' && !result.relaxation)) {
    steps.push({
      id: 2,
      phase: 'conclusion',
      title: '2. Problema infactible',
      explanation: 'El sistema de restricciones no admite ninguna solución factible: ni siquiera la relajación lineal tiene región factible.',
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
      f,
      isFrac: flagsInt[idx] && !xj.isInteger(),
    };
  });

  const fracCalcs = fracParts
    .filter((p) => p.isFrac)
    .map((p) => `{${p.name}} = ${p.val} − ⌊${p.val}⌋ = ${p.fracDec} (${p.fracStr})`)
    .join('\n');

  const chosenVarName = `x${branchVarIndex + 1}`;
  const regla = model.options?.branchRule || 'mostFractional';
  const elegida = fracParts[branchVarIndex];
  const otras = fracParts.filter((p) => p.idx !== branchVarIndex && p.isFrac);
  let comparisonText;
  if (otras.length === 0) {
    comparisonText = `Se selecciona ${chosenVarName} por ser la única variable fraccionaria.`;
  } else if (regla === 'lowestIndex') {
    comparisonText = `Con la regla de menor índice se selecciona ${chosenVarName}, la primera variable fraccionaria.`;
  } else {
    const empatadas = otras.filter((p) => p.f.eq(elegida.f));
    if (empatadas.length > 0) {
      comparisonText = `{${chosenVarName}} (${elegida.fracDec}) = ${empatadas.map((p) => `{${p.name}} (${p.fracDec})`).join(' = ')}: hay empate y se selecciona la de menor subíndice, ${chosenVarName}.`;
    } else {
      comparisonText = `Como {${chosenVarName}} (${elegida.fracDec}) > ${otras.map((p) => `{${p.name}} (${p.fracDec})`).join(' y ')}, se selecciona ${chosenVarName}.`;
    }
  }

  steps.push({
    id: 3,
    phase: 'select_branch',
    title: '3. ¿Es entera? Verificación y selección de variable',
    explanation:
      regla === 'lowestIndex'
        ? `La solución relajada contiene variables con valores fraccionarios. Se calculan las partes fraccionarias de cada variable ({v} = v − ⌊v⌋) y, con la regla de menor índice, se ramifica en la primera variable fraccionaria.`
        : `La solución relajada contiene variables con valores fraccionarios. Se calculan las partes fraccionarias de cada variable ({v} = v − ⌊v⌋) y se elige la de mayor valor fraccionario para ramificar. En caso de empate se selecciona la de menor subíndice.`,
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

    if (node.status === 'integer' && node.action !== 'incumbent') {
      // Entera, pero no mejora el incumbente: la rama se cierra sin cambiar Z*.
      const zInc = currentIncumbent ? formatZ(currentIncumbent.z) : '—';
      steps.push({
        id: steps.length + 1,
        phase: 'node_pruned',
        title: `Resolver ${node.label}: ${formatVec(node.x, false)}, Z = ${formatZ(node.z)} (entera, no mejora Z* = ${zInc})`,
        explanation:
          `Se resuelve la relajación de ${node.label} con la restricción ${branchLabel}. La solución es totalmente entera: x = ${formatVec(node.x, false)} con Z = ${formatZ(node.z)}. Como ${isMax ? 'no es mayor' : 'no es menor'} que el incumbente Z* = ${zInc}, no lo reemplaza y la rama queda cerrada.`,
        calculation: `Restricción: ${branchLabel}\nSolución: x = ${formatVec(node.x, false)}\nZ = ${formatZ(node.z)}\nResultado: entera factible, pero Z ${isMax ? '≤' : '≥'} Z* = ${zInc} → el incumbente se conserva.`,
        state: {
          visibleNodeIds: [...currentVisible],
          activeNodeId: node.id,
          incumbent: currentIncumbent,
          strip: stripInfo,
          highlightPoint: nodeX,
        },
      });
      continue;
    }

    if (node.action === 'incumbent') {
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
        const canPrune = podaPorCota(pNode.z, currentIncumbent.z, isMax, usaPiso);

        if (canPrune) {
          pendingPrunes.splice(pIdx, 1);
          const cmpCota = comparacionCota(pNode.z, currentIncumbent.z, isMax, usaPiso);
          steps.push({
            id: steps.length + 1,
            phase: 'node_pruned',
            title: `Podar ${pNode.label}: ${cmpCota.titulo}`,
            explanation:
              `Con el nuevo incumbente Z* = ${currentIncumbent.z.toDual()} hallado en ${node.label}, se comprueba la cota del subproblema pendiente ${pNode.label}. Como ${cmpCota.parcial} no ${isMax ? 'puede superar' : 'puede mejorar por debajo de'} Z* = ${cmpCota.limite}, ${pNode.label} se poda por cota.`,
            calculation: cmpCota.calculo,
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
      const canPruneNow = currentIncumbent !== null && podaPorCota(node.z, currentIncumbent.z, isMax, usaPiso);

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
        const cmpCota = comparacionCota(node.z, currentIncumbent.z, isMax, usaPiso);

        steps.push({
          id: steps.length + 1,
          phase: 'node_pruned',
          title: `Podar ${node.label}: ${cmpCota.titulo}`,
          explanation: usaPiso
            ? `Dado que los coeficientes de la función objetivo son enteros, cualquier solución entera que pudiera existir en las ramas descendientes de ${node.label} tendría un valor Z entero ${isMax ? 'a lo sumo igual a' : 'al menos igual a'} ${cmpCota.zi}. Como ya se dispone de un incumbente con Z* = ${currentIncumbent.z.toDual()}, este subproblema no puede mejorarlo y se poda por cota.`
            : `La relajación de ${node.label} da Z = ${node.z.toDual()}, que ${isMax ? 'no supera' : 'no es menor que'} el incumbente Z* = ${currentIncumbent.z.toDual()}. Como agregar restricciones nunca mejora Z, ningún descendiente de ${node.label} puede mejorarlo y se poda por cota.`,
          calculation: cmpCota.calculo,
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
        `Se resuelve la relajación de ${node.label} con ${branchLabel}. La solución es fraccionaria con Z = ${formatZ(node.z)}. ${
          currentIncumbent
            ? 'Su cota todavía puede mejorar al incumbente, así que el subproblema queda abierto para seguir ramificando.'
            : 'Todavía no hay incumbente con el cual compararlo, así que no se puede podar por cota: el subproblema queda abierto para seguir ramificando.'
        }`,
      calculation: `Restricción: ${branchLabel}\nSolución: x = ${formatVec(node.x, false)}\nZ = ${formatZ(node.z)}\nEstado: fraccionario → subproblema abierto.`,
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
    if (!currentIncumbent) continue;
    const cmpCota = comparacionCota(pNode.z, currentIncumbent.z, isMax, usaPiso);
    steps.push({
      id: steps.length + 1,
      phase: 'node_pruned',
      title: `Podar ${pNode.label}: ${cmpCota.titulo}`,
      explanation:
        `Con el incumbente Z* = ${currentIncumbent.z.toDual()}, la cota de ${pNode.label} (${cmpCota.parcial}) no puede mejorarlo. Se poda por cota.`,
      calculation: cmpCota.calculo,
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
  const limite = result.status === 'nodeLimit';

  let titulo;
  let explicacion;
  let calculo;
  if (!best) {
    titulo = limite ? 'Conclusión: límite de nodos alcanzado sin solución entera' : 'Conclusión: problema infactible (no hay solución entera)';
    explicacion = limite
      ? 'Se alcanzó el límite de nodos del árbol sin hallar ninguna solución entera factible. No se puede afirmar nada sobre el óptimo.'
      : 'Todos los subproblemas del árbol terminaron podados por infactibilidad: la relajación lineal tiene solución, pero ningún punto con coordenadas enteras cumple las restricciones. El problema entero es infactible.';
    calculo = `Sin solución entera factible
Nodos explorados: ${nodes.length}`;
  } else if (limite) {
    titulo = `Conclusión: límite de nodos, mejor solución ${bestXStr}, Z = ${bestZStr}`;
    explicacion = `Se alcanzó el límite de nodos y quedaron subproblemas sin explorar. La mejor solución entera hallada es x = ${bestXStr} con Z = ${bestZStr}, pero no está probado que sea la óptima.`;
    calculo = `Mejor solución hallada:
x = ${bestXStr}
Z = ${bestZStr}
Nodos explorados: ${nodes.length}`;
  } else {
    titulo = `Conclusión: óptimo entero ${bestXStr}, Z = ${bestZStr}`;
    explicacion = `Todos los subproblemas del árbol han sido explorados o podados. La búsqueda finaliza con éxito. La solución óptima entera del problema es x = ${bestXStr} con un valor de función objetivo Z = ${bestZStr}.`;
    calculo = `Solución óptima entera:
x* = ${bestXStr}
Z* = ${bestZStr}
Nodos explorados: ${nodes.length}`;
  }

  steps.push({
    id: steps.length + 1,
    phase: 'conclusion',
    title: titulo,
    explanation: explicacion,
    calculation: calculo,
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
