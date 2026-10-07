import { useMemo } from 'react';
import EventNode from '../diagram/EventNode.jsx';
import ActivityArrow from '../diagram/ActivityArrow.jsx';
import { edgeGeometry } from '../../utils/geometry.js';
import { computeLayout, boundsOf } from '../../domain/layout.js';
import { INK, BLUE } from '../diagram/theme.js';

const ESCALA = 0.8;
const RADIO = 22;

/** Calcula la distribución de una red (la red de un solo evento también es válida). */
export function layoutDeRed(net) {
  const layout = computeLayout(net, { radius: RADIO });
  const box = boundsOf(layout.pos, layout.bends, RADIO, 26);
  return { layout, box };
}

/**
 * Dibujo estático de una red. `etiquetas`: Map|objeto nodo -> texto (por defecto sin número);
 * `resaltar`: ids de flechas en azul; `actual`: nodo con halo azul. `caja`: viewBox común opcional.
 */
export default function RedSvg({ net, etiquetas, resaltar, actual, caja, label, numerar }) {
  const { layout, box } = useMemo(() => layoutDeRed(net), [net]);
  const vb = caja ? { x: box.x, y: box.y, w: Math.max(box.w, caja.w), h: Math.max(box.h, caja.h) } : box;
  const geom = useMemo(() => {
    const g = {};
    for (const e of net.edges) g[e.id] = edgeGeometry(layout.pos[e.from], layout.bends[e.id], layout.pos[e.to], RADIO);
    return g;
  }, [net, layout]);
  const texto = (v) => {
    if (!etiquetas) return numerar ? layout.number[v] : '';
    const t = etiquetas instanceof Map ? etiquetas.get(v) : etiquetas[v];
    return t == null ? '' : t;
  };
  return (
    <div className="pe-fig">
      <svg
        className="pe-svg"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        style={{ width: '100%', maxWidth: vb.w * ESCALA, minWidth: vb.w * ESCALA * (vb.w * ESCALA > 520 ? 0.85 : 0.62), height: 'auto' }}
        role="img"
        aria-label={label || `Red con ${net.nodes.length} eventos y ${net.edges.length} flechas`}
      >
        {net.edges.map((e) => {
          const on = resaltar && resaltar.has(e.id);
          return (
            <ActivityArrow
              key={e.id}
              geometry={geom[e.id]}
              kind={e.kind}
              name={e.act}
              color={on ? BLUE : INK}
              width={on ? 2.8 : 1.3}
              showDummyLabel={false}
              onEnter={() => {}}
              onLeave={() => {}}
            />
          );
        })}
        {net.nodes.map((v) => (
          <EventNode
            key={v}
            x={layout.pos[v].x}
            y={layout.pos[v].y}
            r={RADIO}
            number={texto(v)}
            early={null}
            late={null}
            critical={false}
            current={actual === v}
            strong={false}
          />
        ))}
      </svg>
    </div>
  );
}
