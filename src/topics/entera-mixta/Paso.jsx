import { useState, useMemo, useEffect } from 'react';
import { ejemplosMixta } from '@/tools/entera/domain/examplesMixta.js';
import { solveIP } from '@/tools/entera/domain/branchAndBound.js';
import { pasosCortes, pasosRamificacion } from '@/tools/entera/domain/pasosMixta.js';
import { TreeDiagram } from '@/tools/entera/components/diagrams/TreeDiagram.jsx';
import TableroSimplex from '@/tools/entera/components/TableroSimplex.jsx';
import RegionCorte from '@/tools/entera/components/RegionCorte.jsx';
import Segmented from '@/ui/Segmented.jsx';
import Toggle from '@/ui/Toggle.jsx';
import '@/tools/entera/solver.css';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";
const PANEL = {
  border: '1px solid var(--rule)',
  borderRadius: 'var(--radius)',
  background: '#fff',
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  minWidth: 0,
};
const PANEL_H = {
  margin: 0,
  fontFamily: SERIF,
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--muted)',
  borderBottom: '1px solid var(--rule)',
  paddingBottom: '6px',
};

const MODELOS = Object.fromEntries(ejemplosMixta.map((e) => [e.id, e]));
const E_CORTES = [{ id: 'mixta-e1', label: 'Ejemplo 1: ejemplo del profesor (7x₁ + 9x₂)' }];
const E_RAMIFICACION = [
  ...E_CORTES,
  { id: 'mixta-e2', label: 'Ejemplo 2: con una restricción ≥ (3x₁ + 2x₂)' },
];

/**
 * Pestaña «Paso a paso» del tema 1.2: Programación entera mixta.
 * Dos métodos sobre el ejemplo del profesor: planos de corte (con tablero simplex) y
 * ramificación y acotamiento. Todo el cálculo viene de domain/pasosMixta.js.
 */
export default function Paso() {
  const [metodo, setMetodo] = useState('cortes');
  const [ejemploId, setEjemploId] = useState('mixta-e1');
  const [continuacion, setContinuacion] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const modelo = MODELOS[ejemploId];

  const steps = useMemo(
    () => (metodo === 'cortes'
      ? pasosCortes(modelo, { conContinuacionPura: continuacion })
      : pasosRamificacion(modelo)),
    [metodo, modelo, continuacion]
  );
  const result = useMemo(() => solveIP(modelo), [modelo]);

  const total = steps.length;
  const idx = Math.min(stepIndex, total - 1);
  const step = steps[idx];

  const cambiarMetodo = (m) => {
    setPlaying(false);
    setMetodo(m);
    if (m === 'cortes') setEjemploId('mixta-e1');
    setStepIndex(0);
  };
  const cambiarEjemplo = (id) => {
    setPlaying(false);
    setEjemploId(id);
    setStepIndex(0);
  };
  const cambiarContinuacion = (v) => {
    setPlaying(false);
    setContinuacion(v);
  };

  useEffect(() => {
    if (!playing) return undefined;
    if (idx >= total - 1) {
      setPlaying(false);
      return undefined;
    }
    const timer = setTimeout(() => setStepIndex(idx + 1), 2600);
    return () => clearTimeout(timer);
  }, [playing, idx, total]);

  const nodosVisibles = useMemo(() => {
    if (!step || step.vista.tipo !== 'arbol') return [];
    return (result.nodes || []).filter((n) => n.id <= step.vista.hastaId);
  }, [step, result]);

  const ejemplos = metodo === 'cortes' ? E_CORTES : E_RAMIFICACION;
  const hayGrafica = !!(step && step.grafica);
  const vista = step?.vista;

  return (
    <div className="paso-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 0 40px', minWidth: 0 }}>
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
          flexWrap: 'wrap', paddingBottom: '12px', borderBottom: '1px solid var(--rule)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>
            Ejemplo resuelto paso a paso
          </h2>
          <span
            style={{
              fontSize: '12px', color: 'var(--muted)', border: '1px solid var(--rule)',
              padding: '2px 8px', borderRadius: 'var(--radius)', background: 'var(--wash)',
            }}
          >
            Programación entera mixta
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, maxWidth: '100%' }}>
          <label htmlFor="paso-mixta-ejemplo" style={{ fontSize: '13px', fontWeight: 500 }}>Ejemplo:</label>
          <select
            id="paso-mixta-ejemplo"
            value={ejemploId}
            onChange={(e) => cambiarEjemplo(e.target.value)}
            style={{
              height: '32px', minWidth: 0, flex: '1 1 auto', fontSize: '13px', padding: '0 28px 0 10px',
              border: '1px solid var(--rule-strong)', borderRadius: 'var(--radius)', background: '#fff',
            }}
          >
            {ejemplos.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px 20px', flexWrap: 'wrap' }}>
        <Segmented
          options={[
            { id: 'cortes', label: 'Planos de corte' },
            { id: 'ramificacion', label: 'Ramificación y acotamiento' },
          ]}
          value={metodo}
          onChange={cambiarMetodo}
          label="Método de resolución"
          size="sm"
        />
        {metodo === 'cortes' && (
          <Toggle checked={continuacion} onChange={cambiarContinuacion}>
            Mostrar la continuación para entera pura (x₁ también entera)
          </Toggle>
        )}
      </div>

      {/* Controles de avance */}
      <div
        className="step-bar"
        style={{
          border: '1px solid var(--rule)', borderRadius: 'var(--radius)', padding: '10px 14px',
          display: 'grid', gap: '8px', background: '#fafaf8',
        }}
      >
        <div className="step-controls" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button type="button" className="icon-btn" onClick={() => { setPlaying(false); setStepIndex(0); }} disabled={idx === 0} title="Al inicio" aria-label="Al inicio">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3v10M12 3L6 8l6 5z" /></svg>
          </button>
          <button type="button" className="icon-btn" onClick={() => { setPlaying(false); setStepIndex(Math.max(0, idx - 1)); }} disabled={idx === 0} title="Paso anterior" aria-label="Paso anterior">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 3L5 8l6 5z" /></svg>
          </button>
          <button
            type="button"
            className="btn btn--sm btn--primary step-play"
            onClick={() => {
              if (idx >= total - 1) { setStepIndex(0); setPlaying(true); } else setPlaying(!playing);
            }}
            style={{ minWidth: '96px', margin: '0 4px' }}
          >
            {playing ? 'Pausar' : idx >= total - 1 ? 'Repetir' : 'Reproducir'}
          </button>
          <button type="button" className="icon-btn" onClick={() => { setPlaying(false); setStepIndex(Math.min(total - 1, idx + 1)); }} disabled={idx >= total - 1} title="Paso siguiente" aria-label="Paso siguiente">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l6 5-6 5z" /></svg>
          </button>
          <button type="button" className="icon-btn" onClick={() => { setPlaying(false); setStepIndex(total - 1); }} disabled={idx >= total - 1} title="Al final" aria-label="Al final">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12 3v10M4 3l6 5-6 5z" /></svg>
          </button>
          <span className="step-count" style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
            Paso {idx + 1} de {total}
          </span>
        </div>
        <input
          type="range"
          className="step-range"
          min="0"
          max={total - 1}
          value={idx}
          onChange={(e) => { setPlaying(false); setStepIndex(Number(e.target.value)); }}
          aria-label="Selector deslizante de pasos"
          style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: '6px' }}
        />
      </div>

      {step && (
        <div
          className="step-card"
          style={{
            border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: '#fff',
            padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>{step.titulo}</h3>
            {step.etiqueta && (
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '1px 8px' }}>
                {step.etiqueta}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.5, color: 'var(--ink)' }}>
            <strong>Qué hago. </strong>{step.queHago}
          </p>
          <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.5, color: 'var(--ink)' }}>
            <strong>Por qué. </strong>{step.porQue}
          </p>
          <div
            style={{
              background: '#fbfbf9', border: '1px solid var(--rule)', borderLeft: '3px solid var(--accent)',
              borderRadius: 'var(--radius)', padding: '10px 14px', fontFamily: SERIF, fontSize: '14.5px',
              lineHeight: 1.55, color: 'var(--ink)', overflowWrap: 'anywhere',
            }}
          >
            {step.calculo.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}

      {step && (vista.tipo !== 'texto' || hayGrafica) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: vista.tipo !== 'texto' && hayGrafica ? 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))' : '1fr',
            gap: '16px',
            alignItems: 'start',
          }}
        >
          {vista.tipo === 'tablero' && (
            <div style={PANEL}>
              <h4 style={PANEL_H}>Tablero simplex</h4>
              <TableroSimplex tablero={vista.tablero} pivote={vista.pivote} razones={vista.razones} />
            </div>
          )}
          {vista.tipo === 'arbol' && (
            <div style={{ ...PANEL, overflowX: 'auto' }}>
              <h4 style={PANEL_H}>
                Árbol de ramificación y acotamiento ({nodosVisibles.length} {nodosVisibles.length === 1 ? 'nodo' : 'nodos'})
              </h4>
              <TreeDiagram nodes={nodosVisibles} activeNodeId={vista.activoId} />
            </div>
          )}
          {hayGrafica && (
            <div style={PANEL}>
              <h4 style={PANEL_H}>Región factible</h4>
              <RegionCorte model={modelo} grafica={step.grafica} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
