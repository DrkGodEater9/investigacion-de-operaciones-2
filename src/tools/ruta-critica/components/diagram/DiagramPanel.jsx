import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NetworkCanvas from './NetworkCanvas.jsx';
import DiagramToolbar from './DiagramToolbar.jsx';
import StepBar from './StepBar.jsx';
import Legend from './Legend.jsx';
import { boundsOf } from '../../domain/layout.js';
import { fmt } from '../../domain/format.js';
import { saveFile, serializeSvg, svgToPng, slug } from '@/shared/files.js';
import { buildPdf } from '../../utils/pdf.js';

export default function DiagramPanel({ analysis, title, hoveredAct, onHoverAct, highlightEdges, notify, pertInfo }) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const [overrides, setOverrides] = useState({});
  const [view, setView] = useState({ x: 0, y: 0, w: 800, h: 500 });
  const [options, setOptions] = useState({ showCritical: true, colorCritical: false, showDurations: true, labelDummies: false });
  const [stepMode, setStepMode] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tip, setTip] = useState(null);

  const { layout, net, times } = analysis;
  const positions = useMemo(() => ({ ...layout.pos, ...overrides }), [layout, overrides]);
  const bounds = useMemo(() => boundsOf(positions, layout.bends, layout.radius), [positions, layout]);

  // Encuadre: todo el diagrama si cabe legible; si no, a un tamaño legible desde el inicio (izquierda).
  const fit = useCallback(
    (all = false) => {
      const b = boundsOf({ ...layout.pos }, layout.bends, layout.radius);
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect || !rect.width) { setView(b); return; }
      const fitScale = Math.min(rect.width / b.w, rect.height / b.h);
      const scale = all ? fitScale : Math.max(fitScale, 14 / layout.radius);
      const w = rect.width / scale;
      const h = rect.height / scale;
      const x = w >= b.w ? b.x + b.w / 2 - w / 2 : b.x;
      const y = h >= b.h ? b.y + b.h / 2 - h / 2 : b.y;
      setView({ x, y, w, h });
    },
    [layout],
  );

  useEffect(() => {
    setOverrides({});
    fit(false);
    setStepIndex(0);
    setPlaying(false);
  }, [layout, fit]);

  const setOption = (k, v) => setOptions((o) => ({ ...o, [k]: v }));

  const visible = useMemo(() => {
    if (!times || !stepMode) return { early: null, late: null, critical: true, current: null };
    const early = new Set();
    const late = new Set();
    analysis.steps.slice(0, stepIndex).forEach((s) => {
      if (s.phase === 'forward') early.add(s.node);
      if (s.phase === 'backward') late.add(s.node);
    });
    const cur = analysis.steps[stepIndex - 1];
    return { early, late, critical: stepIndex >= analysis.steps.length, current: cur?.node ?? null };
  }, [times, stepMode, stepIndex, analysis.steps]);

  const zoom = (k) =>
    setView((v) => {
      const cx = v.x + v.w / 2;
      const cy = v.y + v.h / 2;
      return { x: cx - (v.w * k) / 2, y: cy - (v.h * k) / 2, w: v.w * k, h: v.h * k };
    });

  const onHoverEdge = (e, ev) => {
    if (!e || e.kind === 'dummy') {
      onHoverAct(null);
      setTip(e ? { x: ev.clientX, y: ev.clientY, dummy: e } : null);
      return;
    }
    onHoverAct(e.act);
    setTip({ x: ev.clientX, y: ev.clientY, edge: e });
  };

  const exportAs = async (kind) => {
    const name = slug(title);
    try {
      if (kind === 'print') {
        window.print();
        return;
      }
      if (kind === 'pdf') {
        notify('Generando el PDF…');
        const blob = await buildPdf({ svg: svgRef.current, bounds, analysis, title, pertInfo });
        await saveFile(`${name}.pdf`, blob, 'application/pdf');
        return;
      }
      const svgText = serializeSvg(svgRef.current, bounds);
      if (kind === 'svg') await saveFile(`${name}.svg`, svgText, 'image/svg+xml');
      if (kind === 'png') await saveFile(`${name}.png`, await svgToPng(svgText, bounds.w, bounds.h, 2.5), 'image/png');
    } catch (err) {
      notify('No se pudo exportar: ' + err.message);
    }
  };

  const tipContent = () => {
    if (!tip) return null;
    const rect = wrapRef.current?.getBoundingClientRect();
    const style = rect ? { left: tip.x - rect.left + 14, top: tip.y - rect.top + 14 } : {};
    const n = layout.number;
    const d = analysis.decimals;
    if (tip.dummy) {
      return (
        <div className="tip" style={style}>
          <strong>Ficticia {tip.dummy.label}</strong> ({n[tip.dummy.from]}, {n[tip.dummy.to]}), duración 0
        </div>
      );
    }
    const e = tip.edge;
    const info = times?.edgeInfo[e.id];
    const act = analysis.byName.get(e.act);
    return (
      <div className="tip" style={style}>
        <strong>
          {e.act} ({n[e.from]}, {n[e.to]})
        </strong>
        {act.preds.length ? <span className="tip-sub">Depende de {act.preds.join(', ')}</span> : <span className="tip-sub">Sin predecesoras</span>}
        {info && (
          <dl>
            <dt>Duración</dt><dd>{fmt(info.d, d)}</dd>
            <dt>Inicio temprano</dt><dd>{fmt(info.tic, d)}</dd>
            <dt>Fin temprano</dt><dd>{fmt(info.tfc, d)}</dd>
            <dt>Inicio tardío</dt><dd>{fmt(info.til, d)}</dd>
            <dt>Fin tardío</dt><dd>{fmt(info.tfl, d)}</dd>
            <dt>Holgura</dt><dd>{fmt(info.ht, d)}{info.critical ? ' (crítica)' : ''}</dd>
          </dl>
        )}
      </div>
    );
  };

  return (
    <section className="panel diagram-panel print-area" aria-label="Diagrama de red">
      <div className="diagram-head no-print">
        <DiagramToolbar
          options={options}
          setOption={setOption}
          hasTimes={!!times}
          stepMode={stepMode}
          setStepMode={(v) => { setStepMode(v); setStepIndex(0); setPlaying(v); }}
          onZoom={zoom}
          onFit={() => fit(false)}
          onFitAll={() => fit(true)}
          onRelayout={() => { setOverrides({}); fit(false); }}
          onExport={exportAs}
        />
      </div>
      {stepMode && times && (
        <div className="no-print">
          <StepBar steps={analysis.steps} index={stepIndex} setIndex={setStepIndex} playing={playing} setPlaying={setPlaying} />
        </div>
      )}
      <div className="canvas-wrap" ref={wrapRef} onPointerLeave={() => setTip(null)}>
        <h2 className="print-title">{title}</h2>
        <NetworkCanvas
          analysis={analysis}
          positions={positions}
          view={view}
          setView={setView}
          visible={visible}
          options={options}
          highlightEdges={highlightEdges}
          hoveredAct={hoveredAct}
          onHoverEdge={onHoverEdge}
          onMoveNode={(v, p) => setOverrides((o) => ({ ...o, [v]: p }))}
          svgRef={svgRef}
        />
        {tipContent()}
        <p className="canvas-hint no-print">Arrastra un evento para acomodarlo (nunca queda detrás de sus predecesores). Rueda para acercar, arrastra el fondo para mover.</p>
      </div>
      <Legend hasTimes={!!times} />
      <p className="sr-only">
        Red con {net.nodes.length} eventos, {analysis.dummies} actividades ficticias
        {times ? ` y duración total ${fmt(times.T, analysis.decimals)}` : ''}.
      </p>
    </section>
  );
}
