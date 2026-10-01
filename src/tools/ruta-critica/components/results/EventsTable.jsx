import { eventsTable } from '../../domain/tables.js';
import TableActions from './TableActions.jsx';

export default function EventsTable({ analysis, title, notify }) {
  const { headers, rows, critical } = eventsTable(analysis);
  return (
    <div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r[0]} className={critical[i] ? 'is-critical' : ''}>
                {r.map((c, j) => (
                  <td key={j} className={j === 0 || j >= 3 ? 'num' : ''}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TableActions headers={headers} rows={rows} name={`${title}-eventos`} notify={notify} />
    </div>
  );
}
