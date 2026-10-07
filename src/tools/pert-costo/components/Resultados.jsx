import { useMemo } from 'react';
import { tablaActividades, tablaReducciones, tablaCurva, tablaDuracionOptima } from '../domain/analizar.js';
import { num } from '../domain/formato.js';
import { textoRuta } from '../domain/pasos.js';
import RedCostos from './RedCostos.jsx';
import CurvaCostos from './CurvaCostos.jsx';
import TablaDatos from './TablaDatos.jsx';

/** Resultados: resumen, red, pendientes, secuencia de reducciones, curva y duraciones del óptimo. */
export default function Resultados({ a, verT, setVerT, svgRedRef, svgCurvaRef }) {
  const { m, res, red } = a;
  const act = useMemo(() => tablaActividades(a), [a]);
  const reduc = useMemo(() => tablaReducciones(a), [a]);
  const curva = useMemo(() => tablaCurva(a), [a]);
  const optimas = useMemo(() => tablaDuracionOptima(a), [a]);
  const T = Math.min(res.T0, Math.max(res.Tmin, verT));
  const estado = res.estadoEn(T);
  // Las acortadas llevan su duración normal entre paréntesis (así el rojo de la ruta crítica no se tapa)
  const etiquetas = Object.fromEntries(m.names.map((nom, j) => [nom, estado.d[j] < m.dn[j] ? `${estado.d[j]} (${m.dn[j]})` : String(estado.d[j])]));
  const opt = res.estadoEn(res.optimo.T);
  const rutasNormal = res.normal.rutas.rutas.map((r) => textoRuta(r, m.names));

  return (
    <div className="pc-resultado">
      <dl className="pc-kpis">
        <div><dt>Duración normal</dt><dd>{res.T0}</dd><span>costo total {num(res.normal.total)}</span></div>
        <div><dt>Duración límite</dt><dd>{res.Tmin}</dd><span>costo total {num(res.limite.total)}</span></div>
        <div className="pc-kpi-total"><dt>Duración de costo mínimo</dt><dd>{res.optimo.T}</dd><span>directo {num(opt.directo)} + indirecto {num(opt.indirecto)}</span></div>
        <div className="pc-kpi-total"><dt>Costo total mínimo</dt><dd>{num(res.optimo.total)}</dd><span>{res.optimo.empates.length > 1 ? `empate en ${res.optimo.empates.join(', ')}` : 'sin empates'}</span></div>
      </dl>
      {a.objetivo && (a.objetivo.error || a.objetivo.mensaje) && (
        <p className={'pc-aviso' + (a.objetivo.error || a.objetivo.imposible ? ' pc-aviso--mal' : '')} role="status">{a.objetivo.error || a.objetivo.mensaje}</p>
      )}
      <p className="pc-nota">
        {rutasNormal.length === 1 ? 'Ruta crítica con duraciones normales: ' : `${rutasNormal.length} rutas críticas simultáneas con duraciones normales: `}
        {rutasNormal.join(', ')}.
      </p>

      <section className="pc-seccion" aria-label="Red del proyecto">
        <h3>Red del proyecto con la duración elegida</h3>
        <div className="pc-fila">
          <label className="pc-control" htmlFor="pc-ver-t">
            Duración del proyecto: <b>{T}</b>
          </label>
          <input
            id="pc-ver-t"
            type="range"
            className="pc-rango"
            min={res.Tmin}
            max={res.T0}
            step="1"
            value={T}
            disabled={res.T0 === res.Tmin}
            onChange={(e) => setVerT(Number(e.target.value))}
          />
          <button type="button" className="btn btn--sm" onClick={() => setVerT(res.optimo.T)}>Ir a la óptima ({res.optimo.T})</button>
        </div>
        <p className="pc-nota">
          Costo directo {num(estado.directo)}, indirecto {num(estado.indirecto)}, total <b>{num(estado.total)}</b>. Las actividades acortadas muestran entre paréntesis su duración normal.
        </p>
        <RedCostos red={red} d={estado.d} etiquetas={etiquetas} svgRef={svgRedRef} descripcion={`Red con duración ${T}`} />
        <p className="pc-leyenda">
          <span className="pc-ley pc-ley--rojo">Ruta crítica</span>
          <span className="pc-ley">Bajo cada flecha: duración (y, entre paréntesis, la normal si fue acortada). En cada evento: tiempo temprano (izquierda) y tardío (derecha).</span>
        </p>
      </section>

      <section className="pc-seccion" aria-label="Pendientes de costo">
        <h3>Datos y pendientes de costo</h3>
        <TablaDatos etiqueta="Pendientes de costo" headers={act.headers} rows={act.rows} clases={act.criticas.map((c) => (c ? 'is-critica' : ''))} />
      </section>

      <section className="pc-seccion" aria-label="Reducciones">
        <h3>Secuencia de reducciones</h3>
        {reduc.rows.length ? (
          <>
            <TablaDatos etiqueta="Reducciones" headers={reduc.headers} rows={reduc.rows} clases={reduc.optimas.map((o) => (o ? 'is-optima' : ''))} />
            <details className="pc-detalle">
              <summary>Explicación de cada reducción</summary>
              <ol className="pc-explica">
                {a.pasos.filter((p) => p.fase === 'reduccion').map((p) => (
                  <li key={p.id}><b>{p.titulo}.</b> {p.texto}</li>
                ))}
              </ol>
            </details>
          </>
        ) : (
          <p className="pc-nota">Ninguna actividad se puede acortar: el proyecto solo puede durar {res.T0}.</p>
        )}
      </section>

      <section className="pc-seccion" aria-label="Curva costo-duración">
        <h3>Curva costo-duración</h3>
        <CurvaCostos res={res} actual={T} svgRef={svgCurvaRef} />
        <TablaDatos etiqueta="Costos por duración" headers={curva.headers} rows={curva.rows} clases={curva.optimas.map((o) => (o ? 'is-optima' : ''))} />
      </section>

      <section className="pc-seccion" aria-label="Duraciones en el óptimo">
        <h3>Duración de cada actividad en el óptimo ({res.optimo.T})</h3>
        <TablaDatos etiqueta="Duraciones en el óptimo" headers={optimas.headers} rows={optimas.rows} clases={optimas.cambiadas.map((c) => (c ? 'is-cambio' : ''))} />
      </section>
    </div>
  );
}
