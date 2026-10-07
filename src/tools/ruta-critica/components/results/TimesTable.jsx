import { timesTable } from '../../domain/tables.js';
import TableActions from './TableActions.jsx';

const HINTS = {
  TIC: 'Tiempo de inicio más cercano (temprano)',
  TFC: 'Tiempo de finalización más cercano = TIC + duración',
  TIL: 'Tiempo de inicio más lejano (tardío) = TFL − duración',
  TFL: 'Tiempo de finalización más lejano (tardío)',
  'Holgura total': 'Cuánto puede retrasarse sin retrasar el proyecto',
  'Holgura libre': 'Cuánto puede retrasarse sin retrasar a ninguna sucesora',
};

export default function TimesTable({ analysis, hoveredAct, onHoverAct, title, notify }) {
  const { headers, rows, critical } = timesTable(analysis);
  return (
    <div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} title={HINTS[h]}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r[0]}
                className={(critical[i] ? 'is-critical ' : '') + (hoveredAct === r[0] ? 'is-hover' : '')}
                onMouseEnter={() => onHoverAct(r[0])}
                onMouseLeave={() => onHoverAct(null)}
              >
                {r.map((c, j) => (
                  <td key={j} className={j >= 3 ? 'num' : ''}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {analysis.times && (
        <p className="table-note">
          TIC y TFC: inicio y fin más cercanos. TIL y TFL: inicio y fin más lejanos. Holgura total = TIL − TIC; holgura libre = mínimo TIC de las actividades sucesoras − TFC.
        </p>
      )}
      <TableActions headers={headers} rows={rows} name={`${title}-tiempos`} notify={notify} />
    </div>
  );
}
