import { EXAMPLES } from '../domain/examples.js';

export function SolverHeader({ title, onSelectExample }) {
  return (
    <header className="solver-header">
      <div className="solver-header-main">
        <h2 className="solver-title">{title || 'Programación Entera'}</h2>
        <span className="solver-badge">Branch &amp; Bound exacto</span>
      </div>
      <div className="solver-header-actions">
        <label className="example-selector-label" htmlFor="example-select">
          <span>Ejemplo:</span>
          <select
            id="example-select"
            className="example-select"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onSelectExample(e.target.value);
                e.target.value = '';
              }
            }}
          >
            <option value="" disabled>
              Cargar ejemplo…
            </option>
            {EXAMPLES.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
