export function SummaryCards({ result, numVars }) {
  if (!result) return null;

  const isOptimal = result.status === 'optimal';
  const isInfeasible = result.status === 'infeasible';
  const isUnbounded = result.status === 'unbounded';
  const isNodeLimit = result.status === 'nodeLimit';

  const formatVector = (vec) => {
    if (!vec) return '—';
    return '(' + vec.map((v) => v.toDual()).join('; ') + ')';
  };

  return (
    <div className="summary-cards-grid">
      {/* Tarjeta de Estado */}
      <div className={`summary-card ${isOptimal ? 'summary-card--optimal' : 'summary-card--alert'}`}>
        <span className="summary-card-label">Estado</span>
        <strong className="summary-card-value">
          {isOptimal && 'Óptimo entero'}
          {isInfeasible && 'Infactible (sin enteros)'}
          {isUnbounded && 'No acotado'}
          {isNodeLimit && 'Límite de nodos'}
        </strong>
        <span className="summary-card-desc">
          {isOptimal && 'Solución entera factible óptima encontrada.'}
          {isInfeasible && 'El problema no tiene ninguna solución entera factible.'}
          {isUnbounded && 'La región o la función objetivo crece indefinidamente.'}
          {isNodeLimit && 'Se exploró el máximo de nodos sin cerrar todas las ramas.'}
        </span>
      </div>

      {/* Tarjeta de Z Óptimo Entero */}
      <div className="summary-card">
        <span className="summary-card-label">Valor óptimo (Z*)</span>
        <strong className="summary-card-value summary-card-value--serif">
          {isOptimal && result.best ? result.best.z.toDual() : '—'}
        </strong>
        <span className="summary-card-desc">
          {isOptimal && result.best
            ? `x* = ${formatVector(result.best.x)}`
            : 'Sin solución'}
        </span>
      </div>

      {/* Tarjeta de Relajación Lineal */}
      <div className="summary-card">
        <span className="summary-card-label">Relajación lineal (P0)</span>
        <strong className="summary-card-value summary-card-value--serif">
          {result.relaxation ? result.relaxation.z.toDual() : '—'}
        </strong>
        <span className="summary-card-desc">
          {result.relaxation
            ? `x_rel = ${formatVector(result.relaxation.x)}`
            : 'Infactible'}
        </span>
      </div>

      {/* Tarjeta de Nodos y Podas */}
      <div className="summary-card">
        <span className="summary-card-label">Árbol de ramificación</span>
        <strong className="summary-card-value">
          {result.counts.nodes} {result.counts.nodes === 1 ? 'nodo' : 'nodos'}
        </strong>
        <span className="summary-card-desc">
          {result.counts.pruned} podados · {result.counts.integer} soluciones enteras
        </span>
      </div>
    </div>
  );
}
