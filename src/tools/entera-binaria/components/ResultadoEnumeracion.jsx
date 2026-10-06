import { useMemo, useState } from 'react';
import Toggle from '@/ui/Toggle.jsx';
import { fmtNum } from '../domain/format.js';
import { seEligen, tablaDatos, textoFactibles } from '../utils/exportar.js';

const PAGINA = 64;

export default function ResultadoEnumeracion({ model, data }) {
  const [soloFact, setSoloFact] = useState(false);
  const [pagina, setPagina] = useState(0);
  const t = useMemo(() => tablaDatos(model, 'enumeracion', data), [model, data]);

  const indices = useMemo(() => {
    if (!t) return [];
    const todos = t.rows.map((_, i) => i);
    return soloFact ? todos.filter((i) => data.rows[i].feasible) : todos;
  }, [t, data, soloFact]);

  const paginas = Math.max(1, Math.ceil(indices.length / PAGINA));
  const p = Math.min(pagina, paginas - 1);
  const visibles = indices.slice(p * PAGINA, (p + 1) * PAGINA);
  const sols = data.best?.solutions || [];

  return (
    <div className="eb-resultado">
      {!data.best ? (
        <p className="eb-estado eb-estado--mal">El problema no tiene solución factible</p>
      ) : (
        <div className="eb-estado">
          <p className="eb-estado-z">Óptimo: Z = {fmtNum(data.best.z)}</p>
          {sols.length === 1 ? (
            <p>{seEligen(model, sols[0])}</p>
          ) : (
            <>
              <p>Hay {sols.length} soluciones óptimas (empate):</p>
              <ul className="eb-lista">
                {sols.map((s, k) => <li key={k}>{seEligen(model, s)}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
      <p className="eb-conteo">{textoFactibles(data.feasibleCount, data.total)}.</p>

      {!t ? (
        <p className="eb-aviso" role="note">
          Con más de 12 variables no se lista la tabla de combinaciones ({data.total.toLocaleString('es-CO')} filas): solo se muestran los conteos y el óptimo.
        </p>
      ) : (
        <>
          <div className="eb-fila">
            <Toggle checked={soloFact} onChange={(v) => { setSoloFact(v); setPagina(0); }}>Mostrar solo factibles</Toggle>
            {paginas > 1 && (
              <span className="eb-pager">
                <button type="button" className="btn btn--sm" disabled={p === 0} onClick={() => setPagina(p - 1)}>Anterior</button>
                <span className="eb-nota">Página {p + 1} de {paginas}</span>
                <button type="button" className="btn btn--sm" disabled={p >= paginas - 1} onClick={() => setPagina(p + 1)}>Siguiente</button>
              </span>
            )}
          </div>
          <div className="eb-scroll">
            <table className="eb-tabla eb-tabla--datos" data-testid="tabla-enumeracion">
              <thead>
                <tr>
                  {t.headers.map((h, k) => <th key={k} scope="col">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {visibles.map((i) => {
                  const r = data.rows[i];
                  const fila = t.rows[i];
                  const esOpt = t.optimas[i];
                  return (
                    <tr key={i} className={esOpt ? 'is-optima' : ''}>
                      <td className="eb-mono">{fila[0]}</td>
                      {r.lhs.map((_, c) => (
                        <td key={c} className={r.satisfied[c] ? '' : 'eb-bad'}>{fila[1 + c]}</td>
                      ))}
                      <td>{fila[1 + r.lhs.length]}</td>
                      <td>{fila[2 + r.lhs.length]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="eb-nota">
            Filas {indices.length === 0 ? 0 : p * PAGINA + 1} a {Math.min((p + 1) * PAGINA, indices.length)} de {indices.length}.
            En rojo, el valor del lado izquierdo de una restricción que no se cumple; con fondo azul, las combinaciones óptimas.
          </p>
        </>
      )}
    </div>
  );
}
