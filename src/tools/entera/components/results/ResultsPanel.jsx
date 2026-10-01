import { useState } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import { SummaryCards } from './SummaryCards.jsx';
import { NodesTable } from './NodesTable.jsx';
import { TreeDiagram } from '../diagrams/TreeDiagram.jsx';
import { RegionPlot2D } from '../diagrams/RegionPlot2D.jsx';
import { exportPdf } from '../../utils/exportPdf.js';
import { exportNodesCSV, exportModelMarkdown } from '../../utils/exportData.js';

export function ResultsPanel({ model, result, notify }) {
  const [viewMode, setViewMode] = useState('tree');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  if (!result) return null;

  const is2D = model && model.c && model.c.length === 2;

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      notify?.('Generando documento PDF...');
      const ok = await exportPdf({ model, result, title: 'Programación entera pura' });
      if (ok) notify?.('PDF generado y descargado con éxito.');
    } catch (err) {
      console.error(err);
      notify?.('Error al generar el PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const ok = await exportNodesCSV(result, 'arbol-ramificacion.csv');
      if (ok) notify?.('Archivo CSV descargado con éxito.');
    } catch (err) {
      console.error(err);
      notify?.('Error al generar el CSV.');
    }
  };

  const handleExportMarkdown = async () => {
    try {
      const ok = await exportModelMarkdown(model, result, 'modelo-y-resultados.md');
      if (ok) notify?.('Archivo Markdown descargado con éxito.');
    } catch (err) {
      console.error(err);
      notify?.('Error al generar el Markdown.');
    }
  };

  return (
    <section className="panel results-panel">
      <div className="results-header-row">
        <div>
          <h2>Resultados de la resolución</h2>
          <p className="panel-desc">
            Árbol de ramificación y acotamiento resuelto con aritmética exacta fraccionaria.
          </p>
        </div>

        {/* Barra de exportación */}
        <div className="export-actions-row">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleExportCSV}
            title="Descargar la tabla de nodos en formato CSV"
          >
            Descargar CSV
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleExportMarkdown}
            title="Descargar el modelo y resultados en formato Markdown"
          >
            Descargar Markdown
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            title="Exportar informe formal en PDF"
          >
            {isExportingPdf ? 'Exportando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <SummaryCards result={result} numVars={model.c.length} />

      {/* Visualización de diagramas */}
      <div className="diagram-section-container">
        <div className="diagram-header-bar">
          <h3>Visualización gráfica</h3>
          {is2D && (
            <Segmented
              size="small"
              options={[
                { id: 'tree', label: 'Árbol de ramificación', hint: 'Ver jerarquía de nodos' },
                { id: 'plot2d', label: 'Plano 2D', hint: 'Ver región factible y cuadrícula entera' },
              ]}
              value={viewMode}
              onChange={setViewMode}
            />
          )}
        </div>

        <div className="diagram-canvas-wrapper">
          {viewMode === 'tree' || !is2D ? (
            <TreeDiagram nodes={result.nodes} />
          ) : (
            <RegionPlot2D model={model} result={result} />
          )}
        </div>
      </div>

      {/* Tabla detallada de nodos */}
      <NodesTable nodes={result.nodes} isMax={model.sense === 'max'} />
    </section>
  );
}
export default ResultsPanel;
