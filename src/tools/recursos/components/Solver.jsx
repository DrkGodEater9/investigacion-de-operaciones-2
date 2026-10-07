import { useCallback, useRef, useState } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import Tabs from '@/ui/Tabs.jsx';
import Toast from '@/ui/Toast.jsx';
import { copyText } from '@/shared/files.js';
import { EJEMPLOS } from '../domain/ejemplos.js';
import { REGLAS } from '../domain/asignar.js';
import { periodos } from '../domain/format.js';
import { useRecursos } from '../hooks/useRecursos.js';
import { exportarCSV, exportarMarkdown, exportarPDF } from '../utils/exportar.js';
import EditorTabla from './EditorTabla.jsx';
import PlantillaIA from './PlantillaIA.jsx';
import Cronograma from './Graficos.jsx';
import { Leyenda, TablaActividades, TablaComparacion } from './Piezas.jsx';
import '../recursos.css';

export default function Solver() {
  const s = useRecursos();
  const [pestana, setPestana] = useState('proyecto');
  const [toast, setToast] = useState(null);
  const [exportando, setExportando] = useState(false);
  const rg1 = useRef(null); const rg2 = useRef(null);
  const rh = [useRef(null), useRef(null), useRef(null)];
  const rh2 = [useRef(null), useRef(null), useRef(null)];
  const notify = useCallback((m) => setToast(m), []);
  const limpiarToast = useCallback(() => setToast(null), []);

  const a = s.analisis;
  const lista = !!a && !s.errores.length;
  const ejemplo = EJEMPLOS.find((e) => e.id === s.ejemploId);
  const etiquetaDespues = s.metodo === 'nivelar' ? 'Después de nivelar' : 'Con recursos limitados';

  const exportar = async (cual) => {
    if (!lista) return;
    const analisis = { ...a, antes: a.antes, despues: a.despues, metodo: s.metodo, regla: s.regla };
    try {
      if (cual === 'pdf') {
        setExportando(true);
        notify('Generando el PDF…');
        const svgs = [{ titulo: 'Antes: diagrama de Gantt', el: rg1.current }];
        a.red.recursos.forEach((nm, k) => svgs.push({ titulo: `Antes: consumo de ${nm}`, el: rh[k].current }));
        if (a.despues) {
          svgs.push({ titulo: `${etiquetaDespues}: diagrama de Gantt`, el: rg2.current });
          a.red.recursos.forEach((nm, k) => svgs.push({ titulo: `${etiquetaDespues}: consumo de ${nm}`, el: rh2[k].current }));
        }
        if (await exportarPDF({ analisis, svgs })) notify('PDF generado.');
      } else if (cual === 'csv') {
        if (await exportarCSV({ analisis })) notify('CSV descargado.');
      } else if (await exportarMarkdown({ analisis })) notify('Markdown descargado.');
    } catch (err) {
      console.error(err);
      notify('No se pudo generar el archivo.');
    } finally {
      setExportando(false);
    }
  };

  const copiarEntrada = async () => notify((await copyText(s.src)) ? 'Markdown de entrada copiado.' : 'El navegador no permitió copiar.');

  return (
    <div className="rc-solver">
      <section className="rc-panel" aria-label="Entrada del proyecto">
        <Tabs
          label="Entrada"
          value={pestana}
          onChange={setPestana}
          tabs={[{ id: 'proyecto', label: 'Tu proyecto' }, { id: 'plantilla', label: 'Plantilla para IA' }]}
        />
        <div className="rc-cuerpo">
          {pestana === 'plantilla' ? (
            <PlantillaIA notify={notify} />
          ) : (
            <>
              <div className="rc-fila">
                <label className="inline-field">
                  Ejemplo
                  <select value={s.ejemploId} onChange={(e) => s.cargarEjemplo(e.target.value)} aria-label="Ejemplo">
                    {EJEMPLOS.map((e) => <option key={e.id} value={e.id}>{e.id}: {e.titulo}</option>)}
                  </select>
                </label>
                <button type="button" className="btn btn--sm" onClick={() => s.cargarEjemplo(s.ejemploId)}>Cargar</button>
              </div>
              {ejemplo && <p className="rc-nota rc-enunciado">{ejemplo.enunciado}</p>}

              <div className="rc-fila">
                <Segmented
                  label="Modo de entrada"
                  value={s.modo}
                  onChange={s.cambiarModo}
                  options={[{ id: 'tabla', label: 'Tabla' }, { id: 'markdown', label: 'Markdown' }]}
                />
                <button type="button" className="btn btn--sm" onClick={copiarEntrada}>Copiar Markdown de entrada</button>
              </div>

              {s.modo === 'tabla' ? (
                <EditorTabla draft={s.draft} acciones={s.acciones} />
              ) : (
                <div className="rc-bloque">
                  <textarea
                    className="rc-textarea"
                    value={s.md}
                    rows={12}
                    spellCheck={false}
                    aria-label="Tabla Markdown del proyecto"
                    onChange={(e) => s.setMd(e.target.value)}
                  />
                  <p className="rc-nota">
                    Encabezado | Actividad | Duración | Predecesoras | recurso … |; la fila «Límite» trae las unidades disponibles por período.
                  </p>
                </div>
              )}

              <div className="rc-fila">
                <span className="rc-etiqueta">Qué hacer</span>
                <Segmented
                  label="Método"
                  value={s.metodo}
                  onChange={s.setMetodo}
                  options={[{ id: 'nivelar', label: 'Nivelar' }, { id: 'asignar', label: 'Limitar recursos' }]}
                />
                {s.metodo === 'asignar' && (
                  <label className="inline-field">
                    Regla de prioridad
                    <select value={s.regla} onChange={(e) => s.setRegla(e.target.value)} aria-label="Regla de prioridad">
                      {REGLAS.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </label>
                )}
              </div>
              <p className="rc-nota">
                {s.metodo === 'nivelar'
                  ? 'Nivelar mueve actividades no críticas dentro de su holgura para emparejar el consumo; el proyecto no se alarga.'
                  : 'Limitar recursos programa período a período sin pasar el límite; si una actividad no cabe se retrasa y el proyecto puede alargarse.'}
              </p>
            </>
          )}
        </div>
      </section>

      {pestana === 'proyecto' && (
        <section className="rc-panel rc-cuerpo" aria-label="Resultado" aria-busy={s.pendiente}>
          {s.errores.length > 0 ? (
            <div className="rc-errores" role="alert">
              <strong>Corrige estos errores para ver el resultado:</strong>
              <ul>{s.errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          ) : !a ? (
            <p className="rc-nota">Escribe un proyecto para ver el resultado.</p>
          ) : (
            <div className={'rc-resultado' + (s.pendiente ? ' rc-actualizando' : '')}>
              <div className="rc-cab">
                <h3>Resultado</h3>
                <div className="rc-fila">
                  <button type="button" className="btn btn--sm btn--primary" disabled={exportando} onClick={() => exportar('pdf')}>Exportar PDF</button>
                  <button type="button" className="btn btn--sm" onClick={() => exportar('csv')}>Exportar CSV</button>
                  <button type="button" className="btn btn--sm" onClick={() => exportar('md')}>Exportar Markdown</button>
                </div>
              </div>
              {s.avisos.map((x, i) => <p key={i} className="rc-aviso" role="note">{x}</p>)}

              <div className="rc-resumen" data-testid="resumen">
                <div><span>Sin límites</span><strong>{periodos(a.base.T)}</strong></div>
                <div>
                  <span>{etiquetaDespues}</span>
                  <strong data-testid="duracion-final">{a.despues ? periodos(a.despues.T) : '—'}</strong>
                </div>
                {a.antes.porRecurso.map((p, k) => (
                  <div key={k}>
                    <span>Pico de {p.nombre}</span>
                    <strong>{p.pico}{a.despues ? ` → ${a.despues.resumen.porRecurso[k].pico}` : ''}{p.limite != null ? ` (límite ${p.limite})` : ''}</strong>
                  </div>
                ))}
              </div>
              {a.error && <p className="rc-estado rc-estado--mal" role="alert" data-testid="error-asignar">{a.error}</p>}
              {s.metodo === 'asignar' && a.despues && a.despues.T > a.base.T && (
                <p className="rc-aviso" role="note">La duración aumenta de {periodos(a.base.T)} a {periodos(a.despues.T)} porque algunas actividades esperan recurso. Cota inferior: {a.detalle.cota}.</p>
              )}
              {s.metodo === 'nivelar' && a.antes.porRecurso.some((p, k) => p.limite != null && a.despues.resumen.porRecurso[k].pico > p.limite) && (
                <p className="rc-aviso rc-aviso--mal" role="note">Aún después de nivelar el consumo supera el límite: nivelar no basta; prueba «Limitar recursos».</p>
              )}

              <Leyenda conLimite />
              <Cronograma
                titulo="Antes: cronograma temprano"
                red={a.red}
                base={a.base}
                starts={a.base.ES}
                horizonte={a.horizonte}
                refs={{ gantt: rg1, hist: rh }}
              />
              {a.despues && (
                <Cronograma
                  titulo={`${etiquetaDespues}`}
                  red={a.red}
                  base={a.base}
                  starts={a.despues.starts}
                  fantasma={a.base.ES}
                  horizonte={a.horizonte}
                  refs={{ gantt: rg2, hist: rh2 }}
                />
              )}
              {a.despues && <TablaComparacion antes={a.antes} despues={a.despues.resumen} etiquetaDespues={etiquetaDespues} />}
              <TablaActividades red={a.red} base={a.base} nuevo={a.despues ? a.despues.starts : null} />
            </div>
          )}
        </section>
      )}
      <Toast message={toast} onDone={limpiarToast} />
    </div>
  );
}
