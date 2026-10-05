import { useEffect, useMemo, useRef } from 'react';
import EventNode from './EventNode.jsx';
import ActivityArrow from './ActivityArrow.jsx';
import { edgeGeometry } from '../../utils/geometry.js';
import { fmt } from '../../domain/format.js';
import { INK, RED, BLUE } from './theme.js';

export default function NetworkCanvas({
  analysis,
  positions,
  view,
  setView,
  visible,
  options,
  highlightEdges,
  hoveredAct,
  onHoverEdge,
  onMoveNode,
  svgRef,
}) {
  const { net, layout, times, dur } = analysis;
  const r = layout.radius;
  const decimals = analysis.decimals;
  const gesture = useRef(null);
  const pointers = useRef(new Map()); // dedos activos, para el zoom con pellizco

  const geometries = useMemo(() => {
    const g = {};
    for (const e of net.edges) g[e.id] = edgeGeometry(positions[e.from], layout.bends[e.id], positions[e.to], r);
    return g;
  }, [net, layout, positions, r]);

  const toSvg = (clientX, clientY) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  // Zoom con la rueda, centrado en el puntero
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const p = toSvg(e.clientX, e.clientY);
      const k = Math.exp(e.deltaY * 0.0015);
      setView((v) => {
        const w = Math.min(Math.max(v.w * k, 120), 20000);
        const f = w / v.w;
        return { x: p.x - (p.x - v.x) * f, y: p.y - (p.y - v.y) * f, w, h: v.h * f };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  });

  const limitsFor = (v) => {
    let min = -Infinity;
    let max = Infinity;
    for (const e of net.edges) {
      const b = layout.bends[e.id];
      if (e.to === v) {
        const prev = b.length ? b[b.length - 1] : positions[e.from];
        min = Math.max(min, prev.x + (b.length ? r + 18 : 2 * r + 24));
      }
      if (e.from === v) {
        const next = b.length ? b[0] : positions[e.to];
        max = Math.min(max, next.x - (b.length ? r + 18 : 2 * r + 24));
      }
    }
    return [min, max];
  };

  const startNodeDrag = (v) => (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = toSvg(e.clientX, e.clientY);
    gesture.current = { type: 'node', v, dx: positions[v].x - p.x, dy: positions[v].y - p.y, limits: limitsFor(v) };
    svgRef.current.setPointerCapture(e.pointerId);
  };

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    svgRef.current.setPointerCapture(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        type: 'pinch',
        d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        start: view,
        anchor: toSvg((a.x + b.x) / 2, (a.y + b.y) / 2),
      };
      return;
    }
    gesture.current = { type: 'pan', cx: e.clientX, cy: e.clientY, start: view };
  };

  const onPointerMove = (e) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.type === 'pinch') {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()];
      const k = g.d0 / (Math.hypot(a.x - b.x, a.y - b.y) || 1);
      const w = Math.min(Math.max(g.start.w * k, 120), 20000);
      const f = w / g.start.w;
      setView({ x: g.anchor.x - (g.anchor.x - g.start.x) * f, y: g.anchor.y - (g.anchor.y - g.start.y) * f, w, h: g.start.h * f });
    } else if (g.type === 'node') {
      const p = toSvg(e.clientX, e.clientY);
      const [min, max] = g.limits;
      const x = Math.min(Math.max(p.x + g.dx, min), Math.max(min, max));
      onMoveNode(g.v, { x, y: p.y + g.dy });
    } else {
      const rect = svgRef.current.getBoundingClientRect();
      const s = Math.max(g.start.w / rect.width, g.start.h / rect.height);
      setView({ ...g.start, x: g.start.x - (e.clientX - g.cx) * s, y: g.start.y - (e.clientY - g.cy) * s });
    }
  };

  const endGesture = (e) => {
    pointers.current.delete(e.pointerId);
    gesture.current = null;
  };

  const critOn = visible.critical && options.showCritical && !!times;
  const edgeStyle = (e) => {
    if (highlightEdges?.has(e.id)) return { color: BLUE, width: 3, marker: 'arw-blue' };
    if (hoveredAct && e.act === hoveredAct) return { color: BLUE, width: 2.6, marker: 'arw-blue' };
    const isCrit = critOn && times.edgeInfo[e.id].critical;
    if (isCrit) return options.colorCritical ? { color: RED, width: 2.8, marker: 'arw-red' } : { color: INK, width: 2.8, marker: 'arw-ink' };
    return { color: INK, width: 1.3, marker: 'arw-ink' };
  };

  const nodeCritical = (v) => critOn && Math.abs(times.early[v] - times.late[v]) < 1e-7;

  return (
    <svg
      ref={svgRef}
      className="network-svg"
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      role="img"
      aria-label={`Diagrama de red con ${net.nodes.length} eventos y ${net.edges.length} flechas`}
    >
      <rect data-ui x={view.x - view.w * 5} y={view.y - view.h * 5} width={view.w * 11} height={view.h * 11} fill="transparent" />

      {net.edges.map((e) => {
        const st = edgeStyle(e);
        return (
          <ActivityArrow
            key={e.id}
            geometry={geometries[e.id]}
            kind={e.kind}
            name={e.act}
            dummyLabel={e.label}
            showDummyLabel={options.labelDummies}
            duration={dur && e.kind === 'activity' && options.showDurations ? fmt(dur(e.act), decimals) : null}
            color={st.color}
            width={st.width}
            hovered={hoveredAct && e.act === hoveredAct}
            onEnter={(ev) => onHoverEdge(e, ev)}
            onLeave={() => onHoverEdge(null)}
          />
        );
      })}

      {layout.numbered.map((v) => {
        const p = positions[v];
        const showE = times && (!visible.early || visible.early.has(v));
        const showL = times && (!visible.late || visible.late.has(v));
        return (
          <EventNode
            key={v}
            x={p.x}
            y={p.y}
            r={r}
            number={layout.number[v]}
            early={showE ? fmt(times.early[v], decimals) : null}
            late={showL ? fmt(times.late[v], decimals) : null}
            critical={nodeCritical(v)}
            strong={options.showCritical}
            current={visible.current === v}
            onPointerDown={startNodeDrag(v)}
          />
        );
      })}
    </svg>
  );
}
