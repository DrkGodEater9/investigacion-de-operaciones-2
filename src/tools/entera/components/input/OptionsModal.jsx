export function OptionsModal({ options, onChange }) {
  return (
    <details className="advanced-options">
      <summary className="advanced-options-summary">
        Opciones avanzadas del algoritmo
      </summary>
      <div className="advanced-options-content">
        <div className="option-row">
          <label className="option-label" htmlFor="branch-rule-select">
            Variable a ramificar:
          </label>
          <select
            id="branch-rule-select"
            className="option-select"
            value={options.branchRule || 'mostFractional'}
            onChange={(e) => onChange({ branchRule: e.target.value })}
          >
            <option value="mostFractional">Mayor parte fraccionaria (sitio)</option>
            <option value="lowestIndex">Menor índice de variable (x₁ antes)</option>
          </select>
        </div>

        <div className="option-row">
          <label className="option-label" htmlFor="child-order-select">
            Orden de exploración de hijos:
          </label>
          <select
            id="child-order-select"
            className="option-select"
            value={options.childOrder || 'bestZ'}
            onChange={(e) => onChange({ childOrder: e.target.value })}
          >
            <option value="bestZ">Hijo con mejor Z primero (sitio)</option>
            <option value="downFirst">Rama izquierda (≤ piso) primero</option>
            <option value="upFirst">Rama derecha (≥ techo) primero</option>
          </select>
        </div>

        <div className="option-row">
          <label className="option-label" htmlFor="prune-floor-check">
            Poda con piso/techo entero:
          </label>
          <label className="checkbox-wrap">
            <input
              id="prune-floor-check"
              type="checkbox"
              checked={options.pruneWithFloor !== false}
              onChange={(e) => onChange({ pruneWithFloor: e.target.checked })}
            />
            <span>Podar con ⌊Z⌋ ≤ Z* (o ⌈Z⌉ ≥ Z*) si coeficientes de Z son enteros</span>
          </label>
        </div>
      </div>
    </details>
  );
}
