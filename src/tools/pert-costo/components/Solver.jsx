import { useCallback, useEffect, useRef, useState } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import Tabs from '@/ui/Tabs.jsx';
import Toast from '@/ui/Toast.jsx';
import { filtrar } from '@/shared/campos.js';
import { copyText } from '@/shared/files.js';
import { aMarkdown } from '../domain/entrada.js';
import { useProyecto } from '../hooks/useProyecto.js';
import { exportarCSV, exportarMarkdown, exportarPDF } from '../utils/exportar.js';
import EditorTabla from './EditorTabla.jsx';
import PlantillaIA from './PlantillaIA.jsx';
import Resultados from './Resultados.jsx';
import '../pert-costo.css';

/** Pestaña «Resuelve el tuyo» del tema 3.3: tabla o Markdown → pendientes, reducciones, red y curva. */
export default function Solver() {
  const p = useProyecto('obra');
  const { analisis: a } = p;
  const [pestana, setPestana] = useState('proyecto');
  const [toast, setToast] = useState(null);
  const [exportando, setExportando] = useState(false);
  const [verT, setVerT] = useState(null);
  const svgRedRef = useRef(null);
  const svgCurvaRef = useRef(null);
  const notify = useCallback((m) => setToast(m), []);
  const limpiarToast = useCallback(() => setToast(null), []);

  // Cuando cambia la solución, la red vuelve a mostrarse con la duración óptima
  const optimaT = a.ok ? a.res.optimo.T : null;
  const clave = a.ok ? `${a.res.T0}-${a.res.Tmin}-${a.res.optimo.T}` : '';
  useEffect(() => { setVerT(optimaT); }, [clave, optimaT]);

  const exportar = async (cual) => {
    if (!a.ok) return;
    try {
      if (cual === 'pdf') {
        setExportando(true);
        notify('Generando el PDF…');
        if (await exportarPDF(a, p.titulo, { svgRed: svgRedRef.current, svgCurva: svgCurvaRef.current, duracionRed: verT })) notify('PDF generado.');
      } else if (cual === 'csv') {
        if (await exportarCSV(a, p.titulo)) notify('CSV descargado.');
      } else if (await exportarMarkdown(a, p.titulo)) notify('Markdown descargado.');
    } catch (err) {
      console.error(err);
      notify('No se pudo generar el archivo.');
    } finally {
      setExportando(false);
    }
  };

  const copiarEntrada = async () => {
    const texto = p.modo === 'markdown' ? p.md : aMarkdown({ titulo: p.titulo, ci: p.ci, fijo: p.fijo, filas: p.filas });
    notify((await copyText(texto)) ? 'Markdown de entrada copiado.' : 'El navegador no permitió copiar.');
  };

  const ejemplo = p.ejemplos.find((e) => e.id === p.ejemploId);
  const erroresFila = new Set((a.errores || []).filter((e) => e.fila != null).map((e) => e.fila));
  const tabla = p.modo === 'tabla';
  const listaLista = a.ok && verT != null;

  return (
    <div className="pc-solver">
      <section className="pc-panel pc-panel--entrada" aria-label="Entrada del proyecto">
        <Tabs
          label="Entrada"
          value={pestana}
          onChange={setPestana}
          tabs={[{ id: 'proyecto', label: 'Tu proyecto' }, { id: 'plantilla', label: 'Plantilla para IA' }]}
        />
        <div className="pc-cuerpo">
          {pestana === 'plantilla' ? (
            <PlantillaIA notify={notify} />
          ) : (
            <>
              <div className="pc-fila">
                <label className="inline-field">
                  Ejemplo
                  <select value={p.ejemploId} onChange={(e) => p.cargarEjemplo(e.target.value)} aria-label="Ejemplo">
                    {!ejemplo && <option value="">Tu proyecto</option>}
                    {p.ejemplos.map((e) => <option key={e.id} value={e.id}>{e.titulo}</option>)}
                  </select>
                </label>
                <button type="button" className="btn btn--sm" onClick={() => p.cargarEjemplo(p.ejemploId || p.ejemplos[0].id)}>Cargar</button>
              </div>
              {ejemplo && <p className="pc-nota pc-enunciado-nota">{ejemplo.enunciado}</p>}

              <div className="pc-fila">
                <Segmented
                  label="Modo de entrada"
                  value={p.modo}
                  onChange={p.cambiarModo}
                  options={[{ id: 'tabla', label: 'Tabla' }, { id: 'markdown', label: 'Markdown' }]}
                />
                <button type="button" className="btn btn--sm" onClick={copiarEntrada}>Copiar Markdown de entrada</button>
              </div>

              {tabla ? (
                <>
                  <div className="pc-parametros">
                    <label className="pc-campo">
                      <span>Título</span>
                      <input className="pc-in pc-in--titulo" autoComplete="off" value={p.titulo} onChange={(e) => p.setTitulo(filtrar.texto1(e.target.value))} />
                    </label>
                    <label className="pc-campo">
                      <span>Costo indirecto por unidad de tiempo</span>
                      <input className="pc-in pc-in--num" inputMode="decimal" autoComplete="off" spellCheck={false} value={p.ci} onChange={(e) => p.setCi(filtrar.decimal(e.target.value))} aria-invalid={!p.ci.trim() || undefined} />
                    </label>
                    <label className="pc-campo">
                      <span>Costo indirecto fijo (opcional)</span>
                      <input className="pc-in pc-in--num" inputMode="decimal" autoComplete="off" spellCheck={false} value={p.fijo} onChange={(e) => p.setFijo(filtrar.decimal(e.target.value))} />
                    </label>
                  </div>
                  <EditorTabla filas={p.filas} acciones={p.acciones} filasConError={erroresFila} />
                </>
              ) : (
                <div className="pc-bloque">
                  <textarea
                    className="pc-textarea"
                    value={p.md}
                    rows={12}
                    spellCheck={false}
                    aria-label="Proyecto en Markdown"
                    maxLength={20000}
                    onChange={(e) => p.setMd(e.target.value.slice(0, 20000))}
                  />
                  <p className="pc-nota">
                    Un título con #, las líneas «Costo indirecto por unidad de tiempo: …» y «Costo indirecto fijo: …», y una tabla con Actividad, Predecesoras, Duración normal, Costo normal, Duración límite y Costo límite.
                  </p>
                  {p.lectura && p.lectura.notas.map((n, i) => <p key={i} className="pc-aviso" role="note">{n}</p>)}
                </div>
              )}

              <label className="pc-campo pc-campo--objetivo">
                <span>Duración objetivo (opcional): ¿cuánto cuesta terminar en…?</span>
                <input className="pc-in pc-in--num" inputMode="numeric" autoComplete="off" spellCheck={false} value={p.objetivo} onChange={(e) => p.setObjetivo(filtrar.entero(e.target.value))} placeholder="por ejemplo 20" />
              </label>
            </>
          )}
        </div>
      </section>

      {pestana === 'proyecto' && (
        <section className="pc-panel pc-cuerpo" aria-label="Resultado" aria-busy={p.pendiente}>
          {!a.ok ? (
            <div className="pc-errores" role="alert">
              <strong>Corrige estos errores para ver el resultado:</strong>
              <ul>{a.errores.map((e, i) => <li key={i}>{e.msg}</li>)}</ul>
            </div>
          ) : (
            <>
              <div className="pc-cab-res">
                <h3>Resultado</h3>
                <div className="pc-fila">
                  <button type="button" className="btn btn--sm btn--primary" disabled={!listaLista || exportando} onClick={() => exportar('pdf')}>Exportar PDF</button>
                  <button type="button" className="btn btn--sm" disabled={!listaLista} onClick={() => exportar('csv')}>Exportar CSV</button>
                  <button type="button" className="btn btn--sm" disabled={!listaLista} onClick={() => exportar('md')}>Exportar Markdown</button>
                </div>
              </div>
              {a.avisos.map((t, i) => <p key={i} className="pc-aviso" role="note">{t}</p>)}
              {listaLista && (
                <div className={p.pendiente ? 'pc-actualizando' : ''}>
                  <Resultados a={a} verT={verT} setVerT={setVerT} svgRedRef={svgRedRef} svgCurvaRef={svgCurvaRef} />
                </div>
              )}
            </>
          )}
        </section>
      )}
      <Toast message={toast} onDone={limpiarToast} />
    </div>
  );
}
