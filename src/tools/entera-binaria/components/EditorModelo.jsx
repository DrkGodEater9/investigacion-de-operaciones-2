import { MAX_VARS } from '../domain/modelo.js';
import { sub } from '../domain/format.js';

/** Tabla editable del modelo. Todo el estado vive en useSolver; aquí solo se muestra. */
export default function EditorModelo({ draft, acciones: a }) {
  const n = draft.names.length;
  return (
    <div className="eb-editor">
      <div className="eb-scroll">
        <table className="eb-tabla eb-tabla--editor">
          <thead>
            <tr>
              <th scope="col">Fila</th>
              {draft.names.map((nm, j) => (
                <th scope="col" key={j}>
                  <input
                    className="eb-in eb-in--nombre"
                    value={nm}
                    aria-label={`Nombre de la variable ${j + 1}`}
                    spellCheck={false}
                    onChange={(e) => a.setNombre(j, e.target.value)}
                  />
                </th>
              ))}
              <th scope="col">Signo</th>
              <th scope="col">b</th>
              <th scope="col"><span className="sr-only">Quitar</span></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <select
                  value={draft.sense}
                  aria-label="Objetivo"
                  className="eb-sel"
                  onChange={(e) => a.setSense(e.target.value)}
                >
                  <option value="max">Maximizar Z</option>
                  <option value="min">Minimizar Z</option>
                </select>
              </td>
              {draft.c.map((v, j) => (
                <td key={j}>
                  <input
                    className="eb-in eb-in--num"
                    inputMode="decimal"
                    value={v}
                    placeholder="0"
                    aria-label={`Costo de ${sub(draft.names[j])} en el objetivo`}
                    onChange={(e) => a.setC(j, e.target.value)}
                  />
                </td>
              ))}
              <td colSpan={3} className="eb-celda-nota">función objetivo</td>
            </tr>
            {draft.rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <input
                    className="eb-in eb-in--restr"
                    value={r.name}
                    aria-label={`Nombre de la restricción ${i + 1}`}
                    onChange={(e) => a.setNombreRestr(i, e.target.value)}
                  />
                </td>
                {r.a.map((v, j) => (
                  <td key={j}>
                    <input
                      className="eb-in eb-in--num"
                      inputMode="decimal"
                      value={v}
                      placeholder="0"
                      aria-label={`Restricción ${i + 1}, coeficiente de ${sub(draft.names[j])}`}
                      onChange={(e) => a.setA(i, j, e.target.value)}
                    />
                  </td>
                ))}
                <td>
                  <select
                    className="eb-sel eb-sel--op"
                    value={r.op}
                    aria-label={`Restricción ${i + 1}, signo`}
                    onChange={(e) => a.setOp(i, e.target.value)}
                  >
                    <option value="<=">≤</option>
                    <option value=">=">≥</option>
                    <option value="=">=</option>
                  </select>
                </td>
                <td>
                  <input
                    className="eb-in eb-in--num"
                    inputMode="decimal"
                    value={r.b}
                    placeholder="0"
                    aria-label={`Restricción ${i + 1}, valor de b`}
                    onChange={(e) => a.setB(i, e.target.value)}
                  />
                </td>
                <td>
                  <button type="button" className="btn btn--sm btn--ghost" onClick={() => a.quitarRestriccion(i)} aria-label={`Quitar la restricción ${i + 1}`}>
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="eb-acciones">
        <button type="button" className="btn btn--sm" onClick={a.agregarRestriccion}>Agregar restricción</button>
        <button type="button" className="btn btn--sm" onClick={a.agregarVariable} disabled={n >= MAX_VARS}>Agregar variable</button>
        <button type="button" className="btn btn--sm" onClick={a.quitarVariable} disabled={n <= 1}>Quitar variable</button>
        <span className="eb-nota">{n} {n === 1 ? 'variable' : 'variables'} (de 1 a {MAX_VARS}); todas valen 0 o 1.</span>
      </div>
    </div>
  );
}
