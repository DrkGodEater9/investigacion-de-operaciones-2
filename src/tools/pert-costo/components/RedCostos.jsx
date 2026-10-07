import { useEffect, useMemo, useRef, useState } from 'react';
import EventNode from '../../ruta-critica/components/diagram/EventNode.jsx';
import ActivityArrow from '../../ruta-critica/components/diagram/ActivityArrow.jsx';
import { edgeGeometry } from '../../ruta-critica/utils/geometry.js';
import { INK, RED, BLUE } from '../../ruta-critica/components/diagram/theme.js';
import { tiemposRed } from '../domain/red.js';
import '../pert-costo.css';

/**
 * Red (actividad en la flecha) con las duraciones d. Estática: sin zoom ni arrastre.
 *  - rojo: actividades críticas con esas duraciones; azul: actividades acortadas (o alargadas) en este paso.
 *  - etiquetas: { A: '4 / 2' } para sustituir el número bajo la flecha.
 */
export default function RedCostos({ red, d, acortadas = [], alargadas = [], marcarCriticas = true, etiquetas = null, mostrarTiempos = true, escala = 1, svgRef, descripcion }) {
  const { net, layout, bounds } = red;
  const tm = useMemo(() => tiemposRed(red, d), [red, d]);
  const r = layout.radius;
  // Si la red es más ancha que su caja, se reduce hasta un 72 % antes de usar el desplazamiento horizontal
  const caja = useRef(null);
  const [anchoCaja, setAnchoCaja] = useState(0);
  useEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setAnchoCaja(el.clientWidth));
    ro.observe(el);
    setAnchoCaja(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const ajuste = anchoCaja > 0 ? Math.max(0.72, Math.min(1, (anchoCaja - 4) / bounds.w)) : 1;
  const k = escala * ajuste;
  const cambiadas = useMemo(() => new Set([...acortadas, ...alargadas]), [acortadas, alargadas]);
  const geometrias = useMemo(() => {
    const g = {};
    for (const e of net.edges) g[e.id] = edgeGeometry(layout.pos[e.from], layout.bends[e.id], layout.pos[e.to], r);
    return g;
  }, [net, layout, r]);

  const estilo = (e) => {
    if (e.kind === 'activity' && cambiadas.has(e.act)) return { color: BLUE, width: 3.2 };
    if (marcarCriticas && tm.edgeInfo[e.id].critical) return { color: RED, width: 2.8 };
    return { color: INK, width: 1.3 };
  };
  const criticoNodo = (v) => marcarCriticas && Math.abs(tm.early[v] - tm.late[v]) < 1e-7;

  return (
    <div className="pc-scroll" ref={caja}>
      <svg
        ref={svgRef}
        className="pc-red"
        viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
        width={Math.round(bounds.w * k)}
        height={Math.round(bounds.h * k)}
        role="img"
        aria-label={descripcion || `Red del proyecto con ${net.nodes.length} eventos; duración ${tm.T}.`}
      >
        <rect data-ui x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} fill="#fff" />
        {net.edges.map((e) => {
          const st = estilo(e);
          const texto = e.kind === 'activity' ? (etiquetas && etiquetas[e.act] != null ? etiquetas[e.act] : String(d[red.indice.get(e.act)])) : null;
          return (
            <ActivityArrow
              key={e.id}
              geometry={geometrias[e.id]}
              kind={e.kind}
              name={e.act}
              dummyLabel={e.label}
              showDummyLabel={false}
              duration={texto}
              color={st.color}
              width={st.width}
              hovered={false}
              onEnter={() => {}}
              onLeave={() => {}}
            />
          );
        })}
        {layout.numbered.map((v) => (
          <EventNode
            key={v}
            x={layout.pos[v].x}
            y={layout.pos[v].y}
            r={r}
            number={layout.number[v]}
            early={mostrarTiempos ? String(tm.early[v]) : null}
            late={mostrarTiempos ? String(tm.late[v]) : null}
            critical={criticoNodo(v)}
            strong={marcarCriticas}
            current={false}
            onPointerDown={undefined}
          />
        ))}
      </svg>
    </div>
  );
}
