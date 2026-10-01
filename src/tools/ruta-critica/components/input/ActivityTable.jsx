import { useEffect, useRef } from 'react';

const COLS = {
  network: [],
  cpm: [{ key: 'd', label: 'Duración', hint: 't(i-j)' }],
  pert: [
    { key: 'a', label: 'a', hint: 'Tiempo optimista' },
    { key: 'm', label: 'm', hint: 'Tiempo más probable' },
    { key: 'b', label: 'b', hint: 'Tiempo pesimista' },
  ],
};

export default function ActivityTable({ project, dispatch, errorRows, hoveredAct, onHoverAct }) {
  const { rows, mode, lastAdded } = project;
  const cols = COLS[mode];
  const tableRef = useRef(null);

  useEffect(() => {
    if (!lastAdded) return;
    const el = tableRef.current?.querySelector(`[data-row="${lastAdded}"] input`);
    el?.focus();
    el?.select();
  }, [lastAdded]);

  const onKey = (e, row, field) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const i = rows.findIndex((r) => r.id === row.id);
    const next = rows[i + 1];
    if (next) tableRef.current?.querySelector(`[data-row="${next.id}"] [data-field="${field}"]`)?.focus();
    else dispatch({ type: 'add' });
  };

  return (
    <div className="activity-table-wrap">
      <table className="activity-table" ref={tableRef}>
        <thead>
          <tr>
            <th className="col-name">Actividad</th>
            <th className="col-preds">Predecesoras</th>
            {cols.map((c) => (
              <th key={c.key} className="col-num" title={c.hint}>
                {c.label}
              </th>
            ))}
            <th className="col-actions">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const bad = errorRows.has(i);
            const name = row.name.trim();
            return (
              <tr
                key={row.id}
                data-row={row.id}
                className={(bad ? 'has-error ' : '') + (hoveredAct && hoveredAct === name ? 'is-hover' : '')}
                onMouseEnter={() => onHoverAct(name || null)}
                onMouseLeave={() => onHoverAct(null)}
              >
                <td>
                  <input
                    data-field="name"
                    value={row.name}
                    aria-label={`Nombre de la actividad, fila ${i + 1}`}
                    onChange={(e) => dispatch({ type: 'update', id: row.id, field: 'name', value: e.target.value })}
                    onKeyDown={(e) => onKey(e, row, 'name')}
                  />
                </td>
                <td>
                  <input
                    data-field="preds"
                    value={row.preds}
                    placeholder="-"
                    aria-label={`Predecesoras de ${name || 'la fila ' + (i + 1)}`}
                    onChange={(e) => dispatch({ type: 'update', id: row.id, field: 'preds', value: e.target.value })}
                    onKeyDown={(e) => onKey(e, row, 'preds')}
                  />
                </td>
                {cols.map((c) => (
                  <td key={c.key}>
                    <input
                      data-field={c.key}
                      className="num"
                      inputMode="decimal"
                      value={row[c.key]}
                      aria-label={`${c.hint} de ${name || 'la fila ' + (i + 1)}`}
                      onChange={(e) => dispatch({ type: 'update', id: row.id, field: c.key, value: e.target.value })}
                      onKeyDown={(e) => onKey(e, row, c.key)}
                    />
                  </td>
                ))}
                <td className="row-actions">
                  <button type="button" className="icon-btn" title="Insertar fila debajo" onClick={() => dispatch({ type: 'add', afterId: row.id })}>
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
                    <span className="sr-only">Insertar fila debajo</span>
                  </button>
                  <button type="button" className="icon-btn" title="Eliminar fila" onClick={() => dispatch({ type: 'remove', id: row.id })}>
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                    <span className="sr-only">Eliminar fila</span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="table-foot">
        <button type="button" className="btn btn--ghost" onClick={() => dispatch({ type: 'add' })}>
          Agregar actividad
        </button>
        <span className="hint">Enter pasa a la fila siguiente. Predecesoras separadas por comas; «-» si no tiene.</span>
      </div>
    </div>
  );
}
