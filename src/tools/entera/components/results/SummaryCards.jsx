export function SummaryCards({ result, numVars, mixed = false }) {
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
          {isOptimal && (mixed ? 'Óptimo mixto' : 'Óptimo entero')}
          {isInfeasible && (mixed ? 'Infactible (sin solución mixta)' : 'Infactible (sin enteros)')}
          {isUnbounded && 'No acotado'}
          {isNodeLimit && 'Límite de nodos'}
        </strong>
        <span className="summary-card-desc">
          {isOptimal && (mixed ? 'Solución factible óptima: las variables enteras son enteras y las continuas pueden ser fracciones.' : 'Solución entera factible óptima encontrada.')}
          {isInfeasible && (mixed ? 'El problema no tiene ninguna solución factible que cumpla la condición entera.' : 'El problema no tiene ninguna solución entera factible.')}
          {isUnbounded && 'La región o la función objetivo crece indefinidamente.'}
          {isNodeLimit && 'Se exploró el máximo de nodos sin cerrar todas las ramas; la mejor solución hallada puede no ser la óptima.'}
        </span>
      </div>

      {/* Tarjeta de Z Óptimo Entero */}
      <div className="summary-card">
        <span className="summary-card-label">Valor óptimo (Z*)</span>
        <strong className="summary-card-value summary-card-value--serif">
          {(isOptimal || isNodeLimit) && result.best ? result.best.z.toDual() : '—'}
        </strong>
        <span className="summary-card-desc">
          {(isOptimal || isNodeLimit) && result.best
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
          {result.counts.pruned} podados · {result.counts.integer} {mixed ? 'soluciones factibles mixtas' : 'soluciones enteras'}
        </span>
      </div>
    </div>
  );
}
