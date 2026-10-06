import { useMemo } from 'react';
import { fmtNum } from '../domain/format.js';
import { accionTexto, avisosTransformacion, decisionTexto, seEligen } from '../utils/exportar.js';
import ArbolBalas from './ArbolBalas.jsx';

export default function ResultadoBalas({ model, data, svgRef }) {
  const avisos = useMemo(() => avisosTransformacion(model, data), [model, data]);
  const t = data.transform;
  const limite = data.status === 'limite';

  return (
    <div className="eb-resultado">
      {limite && (
        <p className="eb-aviso eb-aviso--mal" role="alert">
          Se alcanzó el límite de nodos ({data.trace.length.toLocaleString('es-CO')}): la búsqueda se detuvo y la solución mostrada puede no ser la óptima.
        </p>
      )}
      {!data.best ? (
        <p className="eb-estado eb-estado--mal">
          {limite ? 'No se encontró ninguna solución factible antes del límite de nodos' : 'El problema no tiene solución factible'}
        </p>
      ) : (
        <div className="eb-estado">
          <p className="eb-estado-z">{limite ? 'Mejor solución encontrada' : 'Óptimo'}: Z = {fmtNum(data.best.z)}</p>
          <p>{seEligen(model, data.best.x)} <span className="eb-nota">(en las variables originales)</span></p>
        </div>
      )}
      {avisos.map((a, k) => <p key={k} className="eb-aviso" role="note">{a}</p>)}
      <p className="eb-conteo">Nodos explorados: {data.trace.length}.</p>

      <h3 className="eb-sub">Árbol</h3>
      <div className="eb-scroll eb-arbol" data-testid="arbol">
        <ArbolBalas ref={svgRef} trace={data.trace} nombres={t.nombres} />
      </div>

      <h3 className="eb-sub">Traza</h3>
      <div className="eb-scroll">
        <table className="eb-tabla eb-tabla--datos" data-testid="tabla-traza">
          <thead>
            <tr>
              <th scope="col">Nodo</th>
              <th scope="col">Decisión que lo crea</th>
              <th scope="col">Z</th>
              <th scope="col">Holguras</th>
              <th scope="col">Infactibilidad</th>
              <th scope="col">Acción</th>
            </tr>
          </thead>
          <tbody>
            {data.trace.map((n) => (
              <tr key={n.id} className={n.decision === 'factible' ? 'is-factible' : ''} title={n.motivo}>
                <td>N{n.id}</td>
                <td>{decisionTexto(n, t)}</td>
                <td>{fmtNum(n.z)}</td>
                <td className="eb-holguras">({n.s.map(fmtNum).join('; ')})</td>
                <td>{fmtNum(n.I)}</td>
                <td className={n.decision === 'poda-infactible' || n.decision === 'poda-cota' ? 'eb-bad' : ''}>{accionTexto(n, t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="eb-nota">Pasa el cursor sobre una fila para ver el motivo de su decisión.</p>
    </div>
  );
}
