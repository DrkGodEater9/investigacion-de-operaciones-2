import { useState } from 'react';
import { filtrar } from '@/shared/campos.js';
import { fmt } from '../../domain/format.js';

export default function RoutesView({ analysis, selectedRoute, onSelectRoute }) {
  const { critical, all, times, decimals } = analysis;
  const [shown, setShown] = useState(60);
  const [query, setQuery] = useState('');
  const f = (x) => fmt(x, decimals);
  const q = query.trim().toUpperCase();
  const list = q ? all.routes.filter((r) => r.acts.some((a) => a.toUpperCase() === q)) : all.routes;
  const key = (r) => r.edges.join('|');

  return (
    <div className="routes">
      {times && (
        <div className="critical-list">
          <h3>{critical.routes.length === 1 ? 'Ruta crítica' : `${critical.routes.length} rutas críticas`}</h3>
          <ol>
            {critical.routes.map((r) => (
              <li key={key(r)}>
                <button
                  type="button"
                  className={'route-chip' + (selectedRoute === key(r) ? ' is-on' : '')}
                  onClick={() => onSelectRoute(selectedRoute === key(r) ? null : r)}
                  aria-pressed={selectedRoute === key(r)}
                >
                  <span className="route-seq">{r.acts.join(' – ')}</span>
                  <span className="route-len">{f(r.length)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="routes-head">
        <h3>
          Todas las rutas ({all.routes.length}
          {all.truncated ? '+' : ''})
        </h3>
        <label className="inline-field">
          Que pasen por
          <input value={query} onChange={(e) => setQuery(filtrar.nombre(e.target.value))} placeholder="Actividad" size="8" autoComplete="off" spellCheck={false} aria-label="Buscar actividad" />
        </label>
      </div>
      {all.truncated && <p className="table-note">La red tiene muchísimas rutas; se listan las primeras {all.routes.length}.</p>}
      <div className="table-scroll">
        <table className="data-table routes-table">
          <thead>
            <tr>
              <th>N.º</th>
              <th>Secuencia de actividades</th>
              {times && <th>Duración</th>}
              {times && <th>Holgura de la ruta</th>}
            </tr>
          </thead>
          <tbody>
            {list.slice(0, shown).map((r, i) => {
              const slack = times ? times.T - r.length : null;
              const isCrit = times && Math.abs(slack) < 1e-7;
              return (
                <tr
                  key={key(r)}
                  className={'clickable' + (isCrit ? ' is-critical' : '') + (selectedRoute === key(r) ? ' is-selected' : '')}
                  onClick={() => onSelectRoute(selectedRoute === key(r) ? null : r)}
                >
                  <td className="num">{i + 1}</td>
                  <td>{r.acts.join(' – ')}</td>
                  {times && <td className="num">{f(r.length)}</td>}
                  {times && <td className="num">{f(slack)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {list.length > shown && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShown(shown + 100)}>
          Mostrar 100 más ({list.length - shown} restantes)
        </button>
      )}
      <p className="table-note">Haz clic en una ruta para resaltarla en el diagrama.</p>
    </div>
  );
}
