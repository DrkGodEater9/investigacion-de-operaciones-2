import { toCSV, toMarkdown, saveFile } from '@/shared/files.js';

function getNodesData(result) {
  if (!result || !result.nodes) return { headers: [], rows: [] };

  const headers = ['Nodo', 'Padre', 'Restricción', 'Solución (X)', 'Z', 'Estado', 'Incumbente Z*', 'Acción'];
  const rows = result.nodes.map((n) => {
    const nodo = n.label || `P${n.id}`;
    const padre = n.parentId !== null ? `P${n.parentId}` : '—';
    const opSym = n.branchOp === '<=' ? '≤' : n.branchOp === '>=' ? '≥' : n.branchOp || '';
    const restr = n.branchVar !== null ? `x${n.branchVar + 1} ${opSym} ${n.branchBound}` : 'Raíz';

    let solX = '—';
    if (n.status === 'infeasible') {
      solX = 'Infactible';
    } else if (n.status === 'unbounded') {
      solX = 'No acotado';
    } else if (n.x) {
      solX = `(${n.x.map((v) => v.toDual()).join('; ')})`;
    }

    const zVal = n.z ? n.z.toDual() : '—';

    let estado = 'Fraccionario';
    if (n.status === 'integer') estado = 'Entero';
    else if (n.status === 'infeasible') estado = 'Infactible';
    else if (n.status === 'unbounded') estado = 'No acotado';

    const inc = n.incumbentAfter
      ? (n.incumbentAfter.toDual ? n.incumbentAfter.toDual() : n.incumbentAfter.z ? n.incumbentAfter.z.toDual() : String(n.incumbentAfter))
      : '—';

    let accion = 'Ramificar';
    if (n.action === 'incumbent') accion = 'Nuevo incumbente';
    else if (n.action === 'pruned-bound') accion = 'Podado por cota';
    else if (n.action === 'pruned-infeasible') accion = 'Podado por infactibilidad';
    else if (n.action === 'pruned-worse-than-parent') accion = 'Podado (≤ incumbente)';

    return [nodo, padre, restr, solX, zVal, estado, inc, accion];
  });

  return { headers, rows };
}

export async function exportNodesCSV(result, filename = 'arbol-ramificacion.csv') {
  const { headers, rows } = getNodesData(result);
  const csvContent = toCSV(headers, rows);
  return await saveFile(filename, csvContent, 'text/csv;charset=utf-8');
}

export async function exportModelMarkdown(model, result, filename = 'modelo-y-resultados.md') {
  const { headers, rows } = getNodesData(result);

  const lines = [
    `# Programación entera pura — Resultados`,
    `Fecha: ${new Date().toLocaleDateString('es-CO')}`,
    ``,
    `## Modelo matemático`,
    `**Función objetivo:**`,
    `${model.sense === 'max' ? 'Maximizar' : 'Minimizar'} Z = ${model.c.map((coef, i) => `${coef}x${i + 1}`).join(' + ')}`,
    ``,
    `**Sujeto a:**`,
    ...model.constraints.map((ct) => {
      const op = ct.op === '<=' ? '≤' : ct.op === '>=' ? '≥' : '=';
      return `- ${ct.a.map((ai, j) => `${ai}x${j + 1}`).join(' + ')} ${op} ${ct.b}`;
    }),
    `- xⱼ ≥ 0 y xⱼ ∈ ℤ para todo j`,
    ``,
    `## Resumen de la solución`,
  ];

  if (result.status === 'optimal' && result.best) {
    lines.push(`- **Estado:** Solución óptima entera encontrada`);
    lines.push(`- **Valor óptimo Z\*:** ${result.best.z.toDual()}`);
    lines.push(`- **Punto óptimo X\*:** (${result.best.x.map((v) => v.toDual()).join('; ')})`);
  } else if (result.status === 'infeasible') {
    lines.push(`- **Estado:** Problema infactible (sin solución entera factible)`);
  } else if (result.status === 'unbounded') {
    lines.push(`- **Estado:** Problema no acotado`);
  } else {
    lines.push(`- **Estado:** Límite de nodos alcanzado`);
  }

  if (result.relaxation?.z) {
    lines.push(`- **Relajación continua Z(P₀):** ${result.relaxation.z.toDual()}`);
  }

  lines.push(`- **Nodos explorados:** ${result.counts?.nodes || 0}`);
  lines.push(`- **Nodos podados:** ${result.counts?.pruned || 0}`);
  lines.push(``);
  lines.push(`## Tabla de nodos del árbol (Branch & Bound)`);
  lines.push(toMarkdown(headers, rows));

  const mdContent = lines.join('\n');
  return await saveFile(filename, mdContent, 'text/markdown;charset=utf-8');
}
