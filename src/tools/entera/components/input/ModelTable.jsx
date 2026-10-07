import Segmented from '@/ui/Segmented.jsx';
import { filtrar, propsNumero } from '@/shared/campos.js';

const OPC_MODELO = { negativo: true, fraccion: true };
const num = (v) => filtrar.decimal(v, OPC_MODELO);

export function ModelTable({
  model,
  onSetSense,
  onSetNumVars,
  onSetC,
  onAddConstraint,
  onRemoveConstraint,
  onSetConstraintA,
  onSetConstraintOp,
  onSetConstraintB,
  allowIntegerToggle = false,
  onSetInteger,
}) {
  const n = model.numVars;

  return (
    <div className="model-table-container">
      {/* Controles de Sentido y Número de Variables */}
      <div className="model-controls-row">
        <div className="control-group">
          <label className="control-label">Sentido de optimización:</label>
          <Segmented
            size="sm"
            value={model.sense}
            onChange={onSetSense}
            options={[
              { id: 'max', label: 'Maximizar' },
              { id: 'min', label: 'Minimizar' },
            ]}
          />
        </div>

        <div className="control-group">
          <label className="control-label">Variables de decisión:</label>
          <Segmented
            size="sm"
            value={String(n)}
            onChange={(val) => onSetNumVars(parseInt(val, 10))}
            options={[
              { id: '2', label: '2 variables' },
              { id: '3', label: '3 variables' },
              { id: '4', label: '4 variables' },
            ]}
          />
        </div>
      </div>

      {/* Función Objetivo */}
      <div className="objective-card">
        <div className="objective-header">
          <strong>Función Objetivo (Z)</strong>
          <span className="objective-hint">
            {model.sense === 'max' ? 'Maximizar' : 'Minimizar'} Z = Σ cⱼ xⱼ
          </span>
        </div>
        <div className="coeff-grid">
          {Array.from({ length: n }, (_, j) => (
            <div key={`c-${j}`} className="coeff-cell">
              <label htmlFor={`input-c-${j}`} className="coeff-label">
                c<sub>{j + 1}</sub> (para x<sub>{j + 1}</sub>):
              </label>
              <input
                id={`input-c-${j}`}
                type="text"
                {...propsNumero}
                className="input-num"
                value={model.c[j] || ''}
                placeholder="0"
                aria-label={`Coeficiente c${j + 1} de la función objetivo`}
                onChange={(e) => onSetC(j, num(e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Tipo de variables (Entera Pura vs Mixta) */}
      {allowIntegerToggle && (
        <div className="integers-row">
          <span className="control-label">Variables enteras (ℤ):</span>
          <div className="integers-list">
            {Array.from({ length: n }, (_, j) => (
              <label key={`int-${j}`} className="checkbox-wrap">
                <input
                  type="checkbox"
                  checked={!!model.integer[j]}
                  onChange={(e) => onSetInteger(j, e.target.checked)}
                />
                <span>x<sub>{j + 1}</sub> entera</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Tabla de Restricciones Dinámicas */}
      <div className="constraints-section">
        <div className="constraints-header">
          <strong>Restricciones técnicas</strong>
          <span className="constraints-hint">
            Sujeto a: a<sub>i1</sub>x₁ + … + a<sub>in</sub>x<sub>n</sub> (≤, ≥, =) b<sub>i</sub>
          </span>
        </div>

        <div className="constraints-table-wrap">
          <table className="constraints-table">
            <thead>
              <tr>
                <th className="th-id">#</th>
                {Array.from({ length: n }, (_, j) => (
                  <th key={`th-x-${j}`}>
                    x<sub>{j + 1}</sub>
                  </th>
                ))}
                <th className="th-op">Signo</th>
                <th className="th-b">b (Lado derecho)</th>
                <th className="th-del"></th>
              </tr>
            </thead>
            <tbody>
              {model.constraints.map((ct, i) => (
                <tr key={`ct-row-${i}`}>
                  <td className="td-id">R{i + 1}</td>
                  {Array.from({ length: n }, (_, j) => (
                    <td key={`ct-${i}-${j}`}>
                      <input
                        type="text"
                        {...propsNumero}
                        className="input-num"
                        value={ct.a[j] || ''}
                        placeholder="0"
                        aria-label={`R${i + 1} coeficiente x${j + 1}`}
                        onChange={(e) => onSetConstraintA(i, j, num(e.target.value))}
                      />
                    </td>
                  ))}
                  <td className="td-op">
                    <select
                      className="select-op"
                      value={ct.op}
                      aria-label={`R${i + 1} operador`}
                      onChange={(e) => onSetConstraintOp(i, e.target.value)}
                    >
                      <option value="<=">≤</option>
                      <option value=">=">≥</option>
                      <option value="=">=</option>
                    </select>
                  </td>
                  <td className="td-b">
                    <input
                      type="text"
                      {...propsNumero}
                      className="input-num"
                      value={ct.b || ''}
                      placeholder="0"
                      aria-label={`R${i + 1} término independiente b`}
                      onChange={(e) => onSetConstraintB(i, num(e.target.value))}
                    />
                  </td>
                  <td className="td-del">
                    {model.constraints.length > 1 && (
                      <button
                        type="button"
                        className="btn-del"
                        title="Eliminar esta restricción"
                        aria-label={`Eliminar restricción R${i + 1}`}
                        onClick={() => onRemoveConstraint(i)}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="constraints-footer">
          <button
            type="button"
            className="btn btn--sm"
            onClick={onAddConstraint}
          >
            + Agregar restricción
          </button>
          <span className="nonneg-badge">Todas las variables xⱼ ≥ 0 y xⱼ ∈ ℤ</span>
        </div>
      </div>
    </div>
  );
}
