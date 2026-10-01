export function ValidationAlert({ errors = [], warnings = [] }) {
  if (errors.length === 0 && warnings.length === 0) return null;

  return (
    <div className="validation-box" role="alert" aria-live="polite">
      {errors.length > 0 && (
        <div className="validation-group validation-group--error">
          <strong className="validation-title">Datos pendientes o errores por corregir:</strong>
          <ul className="validation-list">
            {errors.map((err, i) => (
              <li key={i}>{err.msg}</li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="validation-group validation-group--warn">
          <strong className="validation-title">Avisos:</strong>
          <ul className="validation-list">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
