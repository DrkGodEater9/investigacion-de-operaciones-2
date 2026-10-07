import { useCallback, useState } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import Tabs from '@/ui/Tabs.jsx';
import Toast from '@/ui/Toast.jsx';
import { copyText } from '@/shared/files.js';
import { EJEMPLOS } from '../domain/ejemplos.js';
import { useSolver } from '../hooks/useSolver.js';
import { exportarCSV, exportarMarkdown, exportarPDF } from '../utils/exportar.js';
import EditorProblema from './EditorProblema.jsx';
import PlantillaIA from './PlantillaIA.jsx';
import Resultado from './Resultado.jsx';
import '../bayes.css';

export default function Solver() {
  const s = useSolver();
  const [pestana, setPestana] = useState('problema');
  const [toast, setToast] = useState(null);
  const [exportando, setExportando] = useState(false);
  const notify = useCallback((m) => setToast(m), []);
  const limpiarToast = useCallback(() => setToast(null), []);

  const lista = Boolean(s.problema && s.analisis);
  const exportar = async (cual) => {
    if (!lista) return;
    const args = { problema: s.problema, analisis: s.analisis };
    try {
      if (cual === 'pdf') {
        setExportando(true);
        notify('Generando el PDF…');
        if (await exportarPDF(args)) notify('PDF generado.');
      } else if (cual === 'csv') {
        if (await exportarCSV(args)) notify('CSV descargado.');
      } else if (await exportarMarkdown(args)) notify('Markdown descargado.');
    } catch (err) {
      console.error(err);
      notify('No se pudo generar el archivo.');
    } finally {
      setExportando(false);
    }
  };

  const copiarEntrada = async () => notify((await copyText(s.src)) ? 'Markdown de entrada copiado.' : 'El navegador no permitió copiar.');
  const ejemplo = EJEMPLOS.find((e) => e.id === s.ejemploId);

  return (
    <div className="bz-solver">
      <section className="bz-panel" aria-label="Entrada del problema">
        <Tabs
          label="Entrada"
          value={pestana}
          onChange={setPestana}
          tabs={[{ id: 'problema', label: 'Tu problema' }, { id: 'plantilla', label: 'Plantilla para IA' }]}
        />
        <div className="bz-cuerpo">
          {pestana === 'plantilla' ? (
            <PlantillaIA notify={notify} />
          ) : (
            <>
              <div className="bz-fila">
                <label className="inline-field">
                  Ejemplo
                  <select value={s.ejemploId} onChange={(e) => s.cargarEjemplo(e.target.value)} aria-label="Ejemplo">
                    {EJEMPLOS.map((e) => <option key={e.id} value={e.id}>{e.id}: {e.titulo}</option>)}
                  </select>
                </label>
                <button type="button" className="btn btn--sm" onClick={() => s.cargarEjemplo(s.ejemploId)}>Cargar</button>
              </div>
              {ejemplo && <p className="bz-nota">{ejemplo.enunciado}</p>}

              <div className="bz-fila">
                <Segmented
                  label="Modo de entrada"
                  value={s.modo}
                  onChange={s.cambiarModo}
                  options={[{ id: 'tabla', label: 'Tabla' }, { id: 'markdown', label: 'Markdown' }]}
                />
                <button type="button" className="btn btn--sm" onClick={copiarEntrada}>Copiar Markdown de entrada</button>
              </div>

              {s.modo === 'tabla' ? (
                <EditorProblema draft={s.draft} acciones={s.acciones} />
              ) : (
                <div className="bz-bloque">
                  <textarea
                    className="bz-textarea"
                    value={s.md}
                    rows={14}
                    spellCheck={false}
                    aria-label="Tablas Markdown del problema"
                    onChange={(e) => s.setMd(e.target.value)}
                  />
                  <p className="bz-nota">
                    Primera tabla: pagos, con la última fila «Prob. a priori». Segunda tabla (opcional, tras una línea en blanco): verosimilitud, una fila por estado.
                    La línea «Objetivo: maximizar» o «Objetivo: minimizar» va antes de la primera tabla.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {pestana === 'problema' && (
        <section className="bz-panel bz-cuerpo" aria-label="Resultado" aria-busy={s.pendiente}>
          {s.errores.length > 0 ? (
            <div className="bz-errores" role="alert">
              <strong>Corrige estos errores para ver el resultado:</strong>
              <ul>{s.errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          ) : !lista ? (
            <p className="bz-nota">Escribe un problema para ver el resultado.</p>
          ) : (
            <>
              <div className="bz-cab">
                <h3>Resultado</h3>
                <div className="bz-fila">
                  <button type="button" className="btn btn--sm btn--primary" disabled={exportando} onClick={() => exportar('pdf')}>Exportar PDF</button>
                  <button type="button" className="btn btn--sm" onClick={() => exportar('csv')}>Exportar CSV</button>
                  <button type="button" className="btn btn--sm" onClick={() => exportar('md')}>Exportar Markdown</button>
                </div>
              </div>
              {s.avisos.map((a, i) => <p key={i} className="bz-aviso" role="note">{a}</p>)}
              <div className={s.pendiente ? 'bz-actualizando' : ''}>
                <Resultado problema={s.problema} analisis={s.analisis} />
              </div>
            </>
          )}
        </section>
      )}
      <Toast message={toast} onDone={limpiarToast} />
    </div>
  );
}
