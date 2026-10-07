import { useMemo } from 'react';
import EventNode from '../diagram/EventNode.jsx';
import ActivityArrow from '../diagram/ActivityArrow.jsx';
import { edgeGeometry } from '../../utils/geometry.js';
import { boundsOf } from '../../domain/layout.js';
import { fmt } from '../../domain/format.js';
import { INK, RED, BLUE } from '../diagram/theme.js';
import { NOT } from '../../domain/notacion.js';

/**
 * Red de flechas (solo lectura) con los tiempos de los eventos que ya se calcularon.
 * analysis: resultado de analyze(). estado: { early, late, actual, rutas } como en pasosTiempo();
 * si no se pasa, se muestra todo calculado y las rutas críticas (rutasCriticas) en rojo.
 */
export default function RedTiempos({ analysis, estado, rutasCriticas, etiqueta = 'Red del proyecto', leyenda = true }) {
  const { net, layout, times, dur, decimals } = analysis;
  const r = layout.radius;
  const bounds = useMemo(() => boundsOf(layout.pos, layout.bends, r), [layout, r]);
  const geo = useMemo(() => {
    const g = {};
    for (const e of net.edges) g[e.id] = edgeGeometry(layout.pos[e.from], layout.bends[e.id], layout.pos[e.to], r);
    return g;
  }, [net, layout, r]);

  const early = estado ? new Set(estado.early) : null;
  const late = estado ? new Set(estado.late) : null;
  const rutas = estado ? estado.rutas : rutasCriticas;
  const resaltadas = new Set((rutas || []).flat());
  const actual = estado?.actual ?? null;
  const edgeActual = actual ? net.edges.find((e) => e.act === actual) : null;

  const estilo = (e) => {
    if (actual && e.act === actual) return { color: BLUE, width: 3 };
    if (e.kind === 'activity' && resaltadas.has(e.act)) return { color: RED, width: 3 };
    return { color: INK, width: 1.3 };
  };

  return (
    <div className="pt-red">
      <div className="pt-red-scroll">
        <svg
          viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
          style={{ width: `${Math.round(bounds.w * 0.78)}px`, minWidth: '100%', maxWidth: 'none' }}
          role="img"
          aria-label={`${etiqueta}: ${net.nodes.length} eventos y ${net.edges.length} flechas`}
        >
          {net.edges.map((e) => {
            const st = estilo(e);
            return (
              <ActivityArrow
                key={e.id}
                geometry={geo[e.id]}
                kind={e.kind}
                name={e.act}
                duration={dur && e.kind === 'activity' ? fmt(dur(e.act), decimals) : null}
                color={st.color}
                width={st.width}
              />
            );
          })}
          {layout.numbered.map((v) => {
            const p = layout.pos[v];
            const tieneT = !!times;
            return (
              <EventNode
                key={v}
                x={p.x}
                y={p.y}
                r={r}
                number={layout.number[v]}
                early={tieneT && (!early || early.has(v)) ? fmt(times.early[v], decimals) : null}
                late={tieneT && (!late || late.has(v)) ? fmt(times.late[v], decimals) : null}
                critical={!!rutas && Math.abs(times.early[v] - times.late[v]) < 1e-7 && (!early || (early.has(v) && late.has(v)))}
                strong={!!rutas}
                current={!!edgeActual && (edgeActual.from === v || edgeActual.to === v)}
              />
            );
          })}
        </svg>
      </div>
      {leyenda && (
        <p className="pt-leyenda">
          En cada evento: arriba su número; abajo a la izquierda el tiempo más cercano ({NOT.tic}) y a la derecha el más lejano ({NOT.til}). Sobre cada flecha, la actividad y su duración. Las flechas discontinuas son actividades ficticias (duran 0). Si la red no cabe, deslízala de lado.
        </p>
      )}
    </div>
  );
}
