import { EXAMPLES } from '../domain/examples.js';

/** Título del ejercicio, selector de ejemplos y botón de ejercicio nuevo. */
export default function SolverHeader({ project, dispatch }) {
  return (
    <div className="solver-header">
      <input
        className="title-input"
        value={project.title}
        onChange={(e) => dispatch({ type: 'title', value: e.target.value })}
        aria-label="Título del ejercicio"
      />
      <div className="header-actions">
        <label className="select-wrap">
          <span className="sr-only">Cargar un ejemplo</span>
          <select
            value=""
            onChange={(e) => {
              const ex = EXAMPLES.find((x) => x.id === e.target.value);
              if (ex) dispatch({ type: 'load', project: ex });
            }}
          >
            <option value="" disabled>Cargar ejercicio de ejemplo</option>
            {EXAMPLES.map((ex) => (
              <option key={ex.id} value={ex.id}>{ex.title}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'new' })}>
          Nuevo ejercicio
        </button>
      </div>
    </div>
  );
}
