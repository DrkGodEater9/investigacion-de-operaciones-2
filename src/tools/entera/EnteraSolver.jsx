import { useState, useCallback } from 'react';
import { useModel } from './hooks/useModel.js';
import { useSolver } from './hooks/useSolver.js';
import { SolverHeader } from './components/SolverHeader.jsx';
import { InputPanel } from './components/input/InputPanel.jsx';
import { ResultsPanel } from './components/results/ResultsPanel.jsx';
import Toast from '@/ui/Toast.jsx';
import './solver.css';

/**
 * Solucionador de Programación Entera (Branch & Bound exacto con fracciones).
 * Componente modular y reutilizable para:
 * - 1.1 Entera Pura (todas las variables enteras)
 * - 1.2 Entera Mixta (permite seleccionar variables enteras vs continuas)
 * - 1.3 Entera Binaria
 */
export default function EnteraSolver({
  start = 'tema',
  allowIntegerToggle = false,
  title = 'Programación entera pura',
}) {
  const {
    model,
    setSense,
    setNumVars,
    setC,
    addConstraint,
    removeConstraint,
    setConstraintA,
    setConstraintOp,
    setConstraintB,
    setInteger,
    setOptions,
    loadExample,
    loadFromMarkdown,
  } = useModel(start, !allowIntegerToggle);

  const { ok, errors, warnings, result } = useSolver(model);

  const [toast, setToast] = useState(null);
  const notify = useCallback((m) => setToast(m), []);
  const clearToast = useCallback(() => setToast(null), []);

  return (
    <div className="solver">
      <SolverHeader
        title={title}
        onSelectExample={loadExample}
      />
      <div className="solver-fit">
        <main className="workspace">
          <InputPanel
            model={model}
            onSetSense={setSense}
            onSetNumVars={setNumVars}
            onSetC={setC}
            onAddConstraint={addConstraint}
            onRemoveConstraint={removeConstraint}
            onSetConstraintA={setConstraintA}
            onSetConstraintOp={setConstraintOp}
            onSetConstraintB={setConstraintB}
            onSetInteger={setInteger}
            onSetOptions={setOptions}
            onApplyMarkdown={loadFromMarkdown}
            allowIntegerToggle={allowIntegerToggle}
            errors={errors}
            warnings={warnings}
            notify={notify}
          />

          {ok && result ? (
            <ResultsPanel
              model={model}
              result={result}
              notify={notify}
            />
          ) : (
            <section className="panel results-panel empty-state">
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--muted)' }}>
                <h3>Esperando modelo factible</h3>
                <p style={{ marginTop: '0.5rem', fontSize: '13px' }}>
                  Corrige los errores o completa los coeficientes en la tabla de entrada para calcular el árbol de ramificación y acotamiento.
                </p>
              </div>
            </section>
          )}
        </main>
      </div>
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
