export function NodesTable({ nodes = [], isMax = true }) {
  if (!nodes || nodes.length === 0) return null;

  const formatVector = (vec) => {
    if (!vec) return '—';
    return '(' + vec.map((v) => v.toDual()).join('; ') + ')';
  };

  const getActionText = (node) => {
    if (node.action === 'incumbent') {
      return `Entera: nuevo incumbente, Z* = ${node.z.toDual()}`;
    }
    if (node.action === 'pruned-infeasible') {
      return 'Infactible: se poda';
    }
    if (node.action === 'pruned-bound') {
      if (node.status === 'integer') {
        return `Entera pero no supera a Z* (${node.incumbentAfter ? node.incumbentAfter.toDual() : '—'}): se poda`;
      }
      return `Cota ${node.z.toDual()} no mejora a Z*: se poda`;
    }
    if (node.action === 'branch') {
      if (node.branchVar !== null) {
        return `Ramificar en x${node.branchVar + 1}`;
      }
      return 'Ramificar';
    }
    return node.action;
  };

  const getRestrictionText = (node) => {
    if (node.parentId === null || node.branchVar === null) {
      return 'Sin restricciones añadidas';
    }
    const sign = node.branchOp === '<=' ? '≤' : node.branchOp === '>=' ? '≥' : '=';
    return `x${node.branchVar + 1} ${sign} ${node.branchBound ? node.branchBound.toString() : ''}`;
  };

  return (
    <div className="nodes-table-section">
      <div className="section-subtitle-row">
        <h3>Tabla de nodos del árbol de ramificación</h3>
        <span className="section-note">{nodes.length} nodos registrados</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="mini-table nodes-table">
          <thead>
            <tr>
              <th>Nodo</th>
              <th>Restricción añadida</th>
              <th>Solución relajada (x)</th>
              <th>Z relajado</th>
              <th>Acción / Resultado</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node) => {
              const isIncumbent = node.action === 'incumbent';
              const isPruned = node.action.startsWith('pruned');
              return (
                <tr
                  key={`node-row-${node.id}`}
                  className={
                    isIncumbent
                      ? 'tr-incumbent'
                      : isPruned
                      ? 'tr-pruned'
                      : ''
                  }
                >
                  <td className="td-node-id">
                    <strong>{node.label}</strong>
                  </td>
                  <td>{getRestrictionText(node)}</td>
                  <td className="td-mono">{formatVector(node.x)}</td>
                  <td className="td-mono">{node.z ? node.z.toDual() : '—'}</td>
                  <td>
                    <span
                      className={`badge-action ${
                        isIncumbent
                          ? 'badge-action--blue'
                          : isPruned
                          ? 'badge-action--red'
                          : ''
                      }`}
                    >
                      {getActionText(node)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
