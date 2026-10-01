import { useCallback, useEffect, useMemo, useState } from 'react';
import SolverHeader from './components/SolverHeader.jsx';
import InputPanel from './components/input/InputPanel.jsx';
import DiagramPanel from './components/diagram/DiagramPanel.jsx';
import ResultsPanel from './components/results/ResultsPanel.jsx';
import Toast from '@/ui/Toast.jsx';
import { useProject } from './hooks/useProject.js';
import { useAnalysis } from './hooks/useAnalysis.js';
import './solver.css';

/**
 * Herramienta completa: tabla o Markdown → red AOA, tiempos, rutas, PERT y PDF.
 * Props: start = id del ejemplo con el que arranca ('ej1' … 'ej5', 'clase').
 */
export default function RutaCriticaSolver({ start = 'ej1' }) {
  const [project, dispatch] = useProject(start);
  const analysis = useAnalysis(project);
  const [hoveredAct, setHoveredAct] = useState(null);
  const [selected, setSelected] = useState(null);
  const [routeIdx, setRouteIdx] = useState(0);
  const [toast, setToast] = useState(null);
  const notify = useCallback((m) => setToast(m), []);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => { setSelected(null); setRouteIdx(0); }, [analysis.net]);

  // Varianza de cada ruta crítica (PERT); por defecto la de mayor varianza.
  const pertInfo = useMemo(() => {
    if (!analysis.ok || analysis.mode !== 'pert' || !analysis.critical.routes.length) return null;
    const options = analysis.critical.routes
      .map((route) => ({ route, variance: route.acts.reduce((s, a) => s + analysis.byName.get(a).var, 0) }))
      .sort((a, b) => b.variance - a.variance);
    const pick = options[Math.min(routeIdx, options.length - 1)];
    return { options, route: pick.route, variance: pick.variance, sd: Math.sqrt(pick.variance) };
  }, [analysis, routeIdx]);

  const highlightEdges = useMemo(() => (selected ? new Set(selected.edges) : null), [selected]);

  return (
    <div className="solver">
      <SolverHeader project={project} dispatch={dispatch} />
      <div className="solver-fit">
      <main className="workspace">
        <InputPanel project={project} dispatch={dispatch} analysis={analysis} hoveredAct={hoveredAct} onHoverAct={setHoveredAct} notify={notify} />
        {analysis.ok ? (
          <DiagramPanel
            analysis={analysis}
            title={project.title}
            hoveredAct={hoveredAct}
            onHoverAct={setHoveredAct}
            highlightEdges={highlightEdges}
            notify={notify}
            pertInfo={pertInfo}
          />
        ) : (
          <section className="panel diagram-panel empty-state">
            <p>La red aparecerá aquí en cuanto la tabla no tenga errores.</p>
            <ul>
              {analysis.errors.slice(0, 4).map((e, i) => <li key={i}>{e.msg}</li>)}
            </ul>
          </section>
        )}
      </main>
      </div>
      {analysis.ok && (
        <ResultsPanel
          analysis={analysis}
          title={project.title}
          hoveredAct={hoveredAct}
          onHoverAct={setHoveredAct}
          selectedRoute={selected ? selected.edges.join('|') : null}
          onSelectRoute={setSelected}
          pertInfo={pertInfo}
          routeIdx={routeIdx}
          setRouteIdx={setRouteIdx}
          notify={notify}
        />
      )}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
