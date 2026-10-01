import { useEffect, useState } from 'react';
import { fmt } from '../../domain/format.js';
import { normalCdf, normalInv } from '../../domain/pert.js';
import NormalCurve from './NormalCurve.jsx';
import TableActions from './TableActions.jsx';
import { pertTable } from '../../domain/tables.js';

export default function PertView({ analysis, pertInfo, routeIdx, setRouteIdx, title, notify }) {
  const { times, decimals } = analysis;
  const f = (x) => fmt(x, decimals);
  const Te = times.T;
  const sd = pertInfo.sd;
  const [deadline, setDeadline] = useState(Math.round(Te));
  const [prob, setProb] = useState(95);
  useEffect(() => { setDeadline(Math.round(Te)); }, [Te]);

  const z = sd > 0 ? (deadline - Te) / sd : deadline >= Te ? Infinity : -Infinity;
  const p = sd > 0 ? normalCdf(z) : deadline >= Te ? 1 : 0;
  const zInv = normalInv(Math.min(Math.max(prob / 100, 0.0001), 0.9999));
  const tInv = Te + zInv * sd;

  const { headers, rows, critical } = pertTable(analysis, new Set(pertInfo.route.acts));

  return (
    <div className="pert">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r[0]} className={critical[i] ? 'is-critical' : ''}>
                {r.map((c, j) => (
                  <td key={j} className={j >= 2 ? 'num' : ''}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TableActions headers={headers} rows={rows} name={`${title}-pert`} notify={notify} />

      <div className="pert-grid">
        <div className="pert-card">
          <h3>Varianza de la ruta crítica</h3>
          {pertInfo.options.length > 1 && (
            <label className="inline-field">
              Ruta
              <select value={routeIdx} onChange={(e) => setRouteIdx(Number(e.target.value))}>
                {pertInfo.options.map((o, i) => (
                  <option key={i} value={i}>
                    {o.route.acts.join('–')} (σ² = {fmt(o.variance, 3)})
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="formula">
            σ²<sub>T</sub> = {pertInfo.route.acts.map((a) => fmt(analysis.byName.get(a).var, 3)).join(' + ')} = <strong>{fmt(pertInfo.variance, 4)}</strong>
          </p>
          <p className="formula">
            σ<sub>T</sub> = √{fmt(pertInfo.variance, 4)} = <strong>{fmt(sd, 4)}</strong>
          </p>
          <p className="formula">
            T<sub>e</sub> = <strong>{f(Te)}</strong>
          </p>
          {pertInfo.options.length > 1 && <p className="table-note">Con varias rutas críticas se toma por defecto la de mayor varianza (la más incierta).</p>}
        </div>

        <div className="pert-card">
          <h3>¿Qué probabilidad hay de terminar en T?</h3>
          <div className="calc-row">
            <label className="inline-field">
              T
              <input type="number" value={deadline} step="any" onChange={(e) => setDeadline(Number(e.target.value))} />
            </label>
            <input
              type="range"
              min={Math.floor(Te - 3.5 * sd)}
              max={Math.ceil(Te + 3.5 * sd)}
              step={sd > 0 ? Math.max(0.1, sd / 20) : 1}
              value={deadline}
              onChange={(e) => setDeadline(Number(e.target.value))}
              aria-label="Tiempo objetivo"
            />
          </div>
          <p className="formula">
            Z = (T − T<sub>e</sub>) / σ = ({f(deadline)} − {f(Te)}) / {fmt(sd, 4)} = <strong>{Number.isFinite(z) ? fmt(z, 4) : '∞'}</strong>
          </p>
          <p className="big-result">
            P(T ≤ {f(deadline)}) = <strong>{fmt(p * 100, 2)} %</strong>
          </p>
          {sd > 0 && <NormalCurve mean={Te} sd={sd} x={deadline} decimals={decimals} />}
        </div>

        <div className="pert-card">
          <h3>¿Qué plazo da cierta probabilidad?</h3>
          <label className="inline-field">
            Probabilidad deseada (%)
            <input type="number" min="0.01" max="99.99" step="any" value={prob} onChange={(e) => setProb(Number(e.target.value))} />
          </label>
          <p className="formula">
            Z = {fmt(zInv, 4)} → T = T<sub>e</sub> + Z·σ = {f(Te)} + {fmt(zInv, 4)} × {fmt(sd, 4)}
          </p>
          <p className="big-result">
            T = <strong>{f(tInv)}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
