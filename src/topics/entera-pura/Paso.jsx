import { useState, useMemo, useEffect } from 'react';
import { EXAMPLES } from '@/tools/entera/domain/examples.js';
import { solveIP } from '@/tools/entera/domain/branchAndBound.js';
import { buildSteps } from '@/tools/entera/domain/pasos.js';
import { TreeDiagram } from '@/tools/entera/components/diagrams/TreeDiagram.jsx';
import { RegionPlot2D } from '@/tools/entera/components/diagrams/RegionPlot2D.jsx';
import Segmented from '@/ui/Segmented.jsx';
import '@/tools/entera/solver.css';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";

/**
 * Pestaña «Paso a paso» del tema 1.1: Programación entera pura.
 * Permite explorar interactivamente la resolución completa por Branch & Bound,
 * avanzando paso a paso o con animación automática, sincronizando el árbol y la región 2D.
 */
export default function Paso() {
  // Selector de ejemplo: tema (por defecto) o mesas y sillas
  const [exampleId, setExampleId] = useState('tema');

  const selectedModel = useMemo(() => {
    return EXAMPLES.find((ex) => ex.id === exampleId) || EXAMPLES[0];
  }, [exampleId]);

  // Resolución pura y cálculo de pasos
  const result = useMemo(() => {
    return solveIP(selectedModel);
  }, [selectedModel]);

  const steps = useMemo(() => {
    return buildSteps(selectedModel, result);
  }, [selectedModel, result]);

  // Estado del paso actual (0-indexed)
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Selector de vista de diagramas: 'both', 'tree' o 'region'
  const [diagramView, setDiagramView] = useState('both');

  // Reiniciar paso al cambiar de ejemplo
  const handleExampleChange = (newId) => {
    setPlaying(false);
    setExampleId(newId);
    setStepIndex(0);
  };

  const totalSteps = steps.length;
  const currentStep = steps[stepIndex] || steps[0];
  const stepState = currentStep?.state || {};

  // Filtrar los nodos visibles en el árbol según el paso activo
  const visibleNodes = useMemo(() => {
    if (!result?.nodes) return [];
    const visibleIds = stepState.visibleNodeIds || [];
    return result.nodes.filter((n) => visibleIds.includes(n.id));
  }, [result, stepState.visibleNodeIds]);

  // Animación / reproducción automática
  useEffect(() => {
    if (!playing) return undefined;
    if (stepIndex >= totalSteps - 1) {
      setPlaying(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      setStepIndex((curr) => {
        if (curr >= totalSteps - 1) {
          setPlaying(false);
          return curr;
        }
        return curr + 1;
      });
    }, 2400);
    return () => clearTimeout(timer);
  }, [playing, stepIndex, totalSteps]);

  return (
    <div className="paso-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 0 40px' }}>
      {/* Barra superior con selector de ejemplo y resumen del modelo */}
      <div
        className="paso-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>
            Ejemplo resuelto paso a paso
          </h2>
          <span
            style={{
              fontSize: '12px',
              color: 'var(--muted)',
              border: '1px solid var(--rule)',
              padding: '2px 8px',
              borderRadius: 'var(--radius)',
              background: 'var(--wash)',
            }}
          >
            {selectedModel.sense === 'max' ? 'Maximizar' : 'Minimizar'} {selectedModel.c.map((cj, i) => `${cj}x${i + 1}`).join(' + ')} · enteras
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, maxWidth: '100%' }}>
          <label htmlFor="paso-example-select" style={{ fontSize: '13px', fontWeight: 500 }}>
            Ejemplo:
          </label>
          <select
            id="paso-example-select"
            value={exampleId}
            onChange={(e) => handleExampleChange(e.target.value)}
            style={{
              height: '32px', minWidth: 0, flex: '1 1 auto',
              fontSize: '13px',
              padding: '0 28px 0 10px',
              border: '1px solid var(--rule-strong)',
              borderRadius: 'var(--radius)',
              background: '#fff',
            }}
          >
            <option value="tema">Ejemplo 1: Tema (5x₁ + 4x₂)</option>
            <option value="mesas-sillas">Ejemplo 2: Mesas y sillas (3x₁ + 2x₂)</option>
          </select>
        </div>
      </div>

      {/* Controles de avance StepBar */}
      <div
        className="step-bar"
        style={{
          border: '1px solid var(--rule)',
          borderRadius: 'var(--radius)',
          padding: '10px 14px',
          display: 'grid',
          gap: '8px',
          background: '#fafaf8',
        }}
      >
        <div className="step-controls" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="icon-btn"
            onClick={() => { setPlaying(false); setStepIndex(0); }}
            disabled={stepIndex === 0}
            title="Al inicio"
            aria-label="Al inicio"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3v10M12 3L6 8l6 5z" /></svg>
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => { setPlaying(false); setStepIndex(Math.max(0, stepIndex - 1)); }}
            disabled={stepIndex === 0}
            title="Paso anterior"
            aria-label="Paso anterior"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 3L5 8l6 5z" /></svg>
          </button>
          <button
            type="button"
            className="btn btn--sm btn--primary step-play"
            onClick={() => {
              if (stepIndex >= totalSteps - 1) {
                setStepIndex(0);
                setPlaying(true);
              } else {
                setPlaying(!playing);
              }
            }}
            style={{ minWidth: '96px', margin: '0 4px' }}
          >
            {playing ? 'Pausar' : stepIndex >= totalSteps - 1 ? 'Repetir' : 'Reproducir'}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => { setPlaying(false); setStepIndex(Math.min(totalSteps - 1, stepIndex + 1)); }}
            disabled={stepIndex >= totalSteps - 1}
            title="Paso siguiente"
            aria-label="Paso siguiente"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l6 5-6 5z" /></svg>
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => { setPlaying(false); setStepIndex(totalSteps - 1); }}
            disabled={stepIndex >= totalSteps - 1}
            title="Al final"
            aria-label="Al final"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12 3v10M4 3l6 5-6 5z" /></svg>
          </button>

          <span
            className="step-count"
            style={{
              marginLeft: 'auto',
              fontSize: '13px',
              color: 'var(--muted)',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 500,
            }}
          >
            Paso {stepIndex + 1} de {totalSteps}
          </span>
        </div>

        <input
          type="range"
          className="step-range"
          min="0"
          max={totalSteps - 1}
          value={stepIndex}
          onChange={(e) => {
            setPlaying(false);
            setStepIndex(Number(e.target.value));
          }}
          aria-label="Selector deslizante de pasos"
          style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: '6px' }}
        />
      </div>

      {/* Ficha explicativa del paso actual */}
      {currentStep && (
        <div
          className="step-card"
          style={{
            border: '1px solid var(--rule)',
            borderRadius: 'var(--radius)',
            background: '#ffffff',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <h3
              style={{
                margin: 0,
                fontFamily: SERIF,
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--ink)',
              }}
            >
              {currentStep.title}
            </h3>
            <span
              style={{
                fontFamily: 'var(--ui)',
                fontSize: '12px',
                fontWeight: 600,
                color: currentStep.phase === 'node_incumbent' || currentStep.phase === 'conclusion'
                  ? '#1d3f8f'
                  : currentStep.phase === 'node_pruned' || currentStep.phase === 'node_infeasible'
                  ? '#b3261e'
                  : 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {currentStep.phase === 'formulation' && 'Planteamiento'}
              {currentStep.phase === 'relaxation' && 'Relajación'}
              {currentStep.phase === 'select_branch' && 'Integralidad'}
              {currentStep.phase === 'branch' && 'Ramificación'}
              {currentStep.phase === 'node_solve' && 'Subproblema'}
              {currentStep.phase === 'node_incumbent' && 'Incumbente'}
              {currentStep.phase === 'node_pruned' && 'Poda por cota'}
              {currentStep.phase === 'node_infeasible' && 'Infactible'}
              {currentStep.phase === 'node_branch' && 'Subproblema abierto'}
              {currentStep.phase === 'conclusion' && 'Solución final'}
            </span>
          </div>

          <p
            style={{
              margin: 0,
              fontFamily: 'var(--ui)',
              fontSize: '14.5px',
              lineHeight: 1.5,
              color: 'var(--ink)',
            }}
          >
            {currentStep.explanation}
          </p>

          {/* Caja con el cálculo a la vista */}
          <div
            style={{
              background: '#fbfbf9',
              border: '1px solid var(--rule)',
              borderLeft: '3px solid var(--accent)',
              borderRadius: 'var(--radius)',
              padding: '10px 14px',
              fontFamily: SERIF,
              fontSize: '14.5px',
              lineHeight: 1.5,
              whiteSpace: 'pre-line',
              color: 'var(--ink)',
            }}
          >
            {currentStep.calculation}
          </div>
        </div>
      )}

      {/* Sección de diagramas sincronizados con el paso */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>
            Representación gráfica sincronizada
          </span>
          <Segmented
            options={[
              { id: 'both', label: 'Ambos diagramas' },
              { id: 'tree', label: 'Árbol B&B' },
              { id: 'region', label: 'Región 2D' },
            ]}
            value={diagramView}
            onChange={setDiagramView}
            label="Selector de vista de diagramas"
            size="sm"
          />
        </div>

        {/* Rejilla de diagramas */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: diagramView === 'both' ? 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))' : '1fr',
            gap: '16px',
            alignItems: 'start',
          }}
        >
          {(diagramView === 'both' || diagramView === 'tree') && (
            <div
              style={{
                border: '1px solid var(--rule)',
                borderRadius: 'var(--radius)',
                background: '#ffffff',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                overflowX: 'auto',
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontFamily: SERIF,
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  borderBottom: '1px solid var(--rule)',
                  paddingBottom: '6px',
                }}
              >
                Árbol de ramificación y acotamiento ({visibleNodes.length} {visibleNodes.length === 1 ? 'nodo' : 'nodos'})
              </h4>
              <TreeDiagram nodes={visibleNodes} activeNodeId={stepState.activeNodeId} />
            </div>
          )}

          {(diagramView === 'both' || diagramView === 'region') && (
            <div
              style={{
                border: '1px solid var(--rule)',
                borderRadius: 'var(--radius)',
                background: '#ffffff',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                overflowX: 'auto',
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontFamily: SERIF,
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  borderBottom: '1px solid var(--rule)',
                  paddingBottom: '6px',
                }}
              >
                Región factible 2D y puntos enteros
              </h4>
              <RegionPlot2D model={selectedModel} result={result} stepState={stepState} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
