export default function IssuesList({ errors = [], warnings = [] }) {
  if (!errors.length && !warnings.length) return null;
  return (
    <div className="issues">
      {errors.length > 0 && (
        <div className="issue-block issue-block--error" role="alert">
          <strong>Corrige esto para construir la red</strong>
          <ul>
            {errors.map((e, i) => (
              <li key={i}>{e.msg}</li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <details className="issue-block issue-block--warn">
          <summary>
            {warnings.length} {warnings.length === 1 ? 'observación' : 'observaciones'} sobre los datos
          </summary>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
