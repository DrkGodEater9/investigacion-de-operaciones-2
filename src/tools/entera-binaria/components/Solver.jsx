import { useCallback, useRef, useState } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import Tabs from '@/ui/Tabs.jsx';
import Toast from '@/ui/Toast.jsx';
import { copyText } from '@/shared/files.js';
import { EJEMPLOS } from '../domain/ejemplos.js';
import { objetivoTexto, restriccionTexto } from '../domain/format.js';
import { MAX_ENUM } from '../domain/enumerar.js';
import { useSolver } from '../hooks/useSolver.js';
import { exportarCSV, exportarMarkdown, exportarPDF } from '../utils/exportar.js';
import EditorModelo from './EditorModelo.jsx';
import PanelLogica from './PanelLogica.jsx';
import PlantillaIA from './PlantillaIA.jsx';
import ResultadoBalas from './ResultadoBalas.jsx';
import ResultadoEnumeracion from './ResultadoEnumeracion.jsx';
import '../solver.css';

/** «Fila X, campo Y: mensaje»; si el mensaje ya empieza por «Fila», se deja tal cual. */
export function textoError(e) {
  if (/^Fila\s/.test(e.mensaje) || e.fila == null) return e.mensaje;
  return `Fila ${e.fila}${e.campo ? `, campo ${e.campo}` : ''}: ${e.mensaje}`;
}

function ModeloMatematico({ model }) {
  return (
    <div className="eb-modelo" data-testid="modelo">
      <div>{objetivoTexto(model)}</div>
      <div>Sujeto a:</div>
      <ul>
        {model.constraints.map((_, i) => <li key={i}>{restriccionTexto(model, i)}</li>)}
        <li>xⱼ ∈ {'{0, 1}'}, j = 1, …, {model.names.length}</li>
      </ul>
    </div>
  );
}

export default function Solver() {
  const s = useSolver();
  const [pestana, setPestana] = useState('modelo');
  const [toast, setToast] = useState(null);
  const [exportando, setExportando] = useState(false);
  const svgRef = useRef(null);
  const notify = useCallback((m) => setToast(m), []);
  const limpiarToast = useCallback(() => setToast(null), []);

  const lista = s.res && !s.res.calculando && !s.res.error && s.res.data;

  const exportar = async (cual) => {
    if (!lista) return;
    const args = { model: s.res.model, metodo: s.res.metodo, data: s.res.data, svg: svgRef.current };
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
    <div className="eb-solver">
      <section className="eb-panel" aria-label="Entrada del modelo">
        <Tabs
          label="Entrada"
          value={pestana}
          onChange={setPestana}
          tabs={[{ id: 'modelo', label: 'Tu modelo' }, { id: 'plantilla', label: 'Plantilla para IA' }]}
        />
        <div className="eb-cuerpo">
          {pestana === 'plantilla' ? (
            <PlantillaIA notify={notify} />
          ) : (
            <>
              <div className="eb-fila">
                <label className="inline-field">
                  Ejemplo
                  <select value={s.ejemploId} onChange={(e) => s.cargarEjemplo(e.target.value)} aria-label="Ejemplo">
                    {EJEMPLOS.map((e) => <option key={e.id} value={e.id}>{e.id}: {e.titulo}</option>)}
                  </select>
                </label>
                <button type="button" className="btn btn--sm" onClick={() => s.cargarEjemplo(s.ejemploId)}>Cargar</button>
              </div>
              {ejemplo && <p className="eb-nota eb-enunciado">{ejemplo.enunciado}</p>}

              <div className="eb-fila">
                <Segmented
                  label="Modo de entrada"
                  value={s.modo}
                  onChange={s.cambiarModo}
                  options={[{ id: 'tabla', label: 'Tabla' }, { id: 'markdown', label: 'Markdown' }]}
                />
                <button type="button" className="btn btn--sm" onClick={copiarEntrada}>Copiar Markdown de entrada</button>
              </div>

              {s.modo === 'tabla' ? (
                <EditorModelo draft={s.draft} acciones={s.acciones} />
              ) : (
                <div className="eb-bloque">
                  <textarea
                    className="eb-textarea"
                    value={s.md}
                    rows={12}
                    spellCheck={false}
                    aria-label="Tabla Markdown del modelo"
                    onChange={(e) => s.setMd(e.target.value)}
                  />
                  <p className="eb-nota">
                    Encabezado | Restricción | x1 | … | Signo | b |; la primera fila es el objetivo (max o min en la primera celda).
                  </p>
                </div>
              )}

              <PanelLogica names={s.names} onAgregar={s.agregarLogica} />

              <div className="eb-fila">
                <span className="eb-etiqueta">Método</span>
                <div className="segmented" role="radiogroup" aria-label="Método">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={s.metodo === 'enumeracion'}
                    className={s.metodo === 'enumeracion' ? 'is-on' : ''}
                    disabled={!s.enumDisponible}
                    onClick={() => s.setMetodoPref('enumeracion')}
                  >
                    Enumeración
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={s.metodo === 'balas'}
                    className={s.metodo === 'balas' ? 'is-on' : ''}
                    onClick={() => s.setMetodoPref('balas')}
                  >
                    Aditivo de Balas
                  </button>
                </div>
              </div>
              {!s.enumDisponible && (
                <p className="eb-aviso" role="note">
                  Con más de {MAX_ENUM} variables la enumeración tendría más de un millón de combinaciones; se usa el método aditivo de Balas.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {pestana === 'modelo' && (
        <section className="eb-panel eb-cuerpo" aria-label="Resultado" aria-busy={s.pendiente}>
          {s.errores.length > 0 ? (
            <div className="eb-errores" role="alert">
              <strong>Corrige estos errores para ver el resultado:</strong>
              <ul>{s.errores.map((e, i) => <li key={i}>{textoError(e)}</li>)}</ul>
            </div>
          ) : !s.res ? (
            <p className="eb-nota">Escribe un modelo para ver el resultado.</p>
          ) : (
            <>
              <div className="eb-cab">
                <h3>Resultado</h3>
                <div className="eb-fila">
                  <button type="button" className="btn btn--sm btn--primary" disabled={!lista || exportando} onClick={() => exportar('pdf')}>Exportar PDF</button>
                  <button type="button" className="btn btn--sm" disabled={!lista} onClick={() => exportar('csv')}>Exportar CSV</button>
                  <button type="button" className="btn btn--sm" disabled={!lista} onClick={() => exportar('md')}>Exportar Markdown</button>
                </div>
              </div>
              {s.avisos.map((a, i) => <p key={i} className="eb-aviso" role="note">{a}</p>)}
              <ModeloMatematico model={s.res.model} />
              <div className={s.pendiente ? 'eb-actualizando' : ''}>
                {s.res.calculando && <p className="eb-aviso" role="status">Calculando…</p>}
                {s.res.error && <p className="eb-estado eb-estado--mal" role="alert">{s.res.error}</p>}
                {lista && s.res.metodo === 'enumeracion' && <ResultadoEnumeracion model={s.res.model} data={s.res.data} />}
                {lista && s.res.metodo === 'balas' && <ResultadoBalas model={s.res.model} data={s.res.data} svgRef={svgRef} />}
              </div>
            </>
          )}
        </section>
      )}
      <Toast message={toast} onDone={limpiarToast} />
    </div>
  );
}
