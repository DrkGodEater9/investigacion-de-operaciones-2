import { useCallback, useMemo, useRef, useState } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import Tabs from '@/ui/Tabs.jsx';
import Toast from '@/ui/Toast.jsx';
import { copyText } from '@/shared/files.js';
import { EJEMPLOS, ejemploPorId } from '../domain/ejemplos.js';
import { nodosAzar, sensibilidad } from '../domain/sensibilidad.js';
import { arbolATexto } from '../domain/texto.js';
import { useArbol } from '../hooks/useArbol.js';
import { exportarCSV, exportarMarkdown, exportarPDF } from '../utils/exportar.js';
import EditorArbol from './EditorArbol.jsx';
import PlantillaIA from './PlantillaIA.jsx';
import ResultadoArbol from './ResultadoArbol.jsx';
import Sensibilidad from './Sensibilidad.jsx';
import '../solver.css';

export default function Solver() {
  const s = useArbol();
  const [pestana, setPestana] = useState('arbol');
  const [toast, setToast] = useState(null);
  const [exportando, setExportando] = useState(false);
  const [sel, setSel] = useState({ nodoId: '', rama: 0 });
  const [ligar, setLigar] = useState(true);
  const svgRef = useRef(null);
  const svgSensRef = useRef(null);
  const notify = useCallback((m) => setToast(m), []);
  const limpiarToast = useCallback(() => setToast(null), []);

  const listo = !!(s.arbol && s.ev && s.errores.length === 0);

  // Selección efectiva de la sensibilidad: si el nodo elegido ya no existe, se usa el primero de azar.
  const sens = useMemo(() => {
    if (!listo) return null;
    const nodos = nodosAzar(s.arbol);
    if (!nodos.length) return null;
    const nodo = nodos.find((n) => n.id === sel.nodoId) || nodos[0];
    const rama = Math.min(sel.rama, nodo.ramas.length - 1);
    try {
      return sensibilidad(s.arbol, nodo.id, rama, { ligar });
    } catch {
      return null;
    }
  }, [listo, s.arbol, sel, ligar]);

  const exportar = async (cual) => {
    if (!listo) return;
    const args = { arbol: s.arbol, ev: s.ev, riesgo: s.riesgo, sens, svg: svgRef.current, svgSens: svgSensRef.current };
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

  const copiarEntrada = async () => {
    const t = s.modo === 'texto' ? s.texto : arbolATexto(s.draft);
    notify((await copyText(t)) ? 'Texto del árbol copiado.' : 'El navegador no permitió copiar.');
  };

  const ejemplo = ejemploPorId(s.ejemploId);

  return (
    <div className="ad-solver">
      <section className="ad-panel" aria-label="Entrada del árbol">
        <Tabs
          label="Entrada"
          value={pestana}
          onChange={setPestana}
          tabs={[{ id: 'arbol', label: 'Tu árbol' }, { id: 'plantilla', label: 'Plantilla para IA' }]}
        />
        <div className="ad-cuerpo">
          {pestana === 'plantilla' ? (
            <PlantillaIA notify={notify} />
          ) : (
            <>
              <div className="ad-fila">
                <label className="inline-field">
                  Ejemplo
                  <select value={s.ejemploId} onChange={(e) => s.cargarEjemplo(e.target.value)} aria-label="Ejemplo">
                    {!s.ejemploId && <option value="">(tu árbol)</option>}
                    {EJEMPLOS.map((e) => <option key={e.id} value={e.id}>{e.titulo}</option>)}
                  </select>
                </label>
                <button type="button" className="btn btn--sm" onClick={() => s.cargarEjemplo(s.ejemploId || EJEMPLOS[0].id)}>Cargar</button>
                <button type="button" className="btn btn--sm" onClick={s.limpiar}>Árbol en blanco</button>
              </div>
              {ejemplo && <p className="ad-nota">{ejemplo.enunciado}</p>}

              <div className="ad-fila">
                <span className="ad-etiqueta">Objetivo</span>
                <Segmented
                  label="Objetivo"
                  value={s.sense}
                  onChange={s.acciones.setSense}
                  options={[{ id: 'max', label: 'Maximizar utilidad' }, { id: 'min', label: 'Minimizar costo' }]}
                />
                <label className="inline-field">
                  Unidad
                  <input className="ad-in ad-in--unidad" value={s.unidad} placeholder="millones de pesos" aria-label="Unidad de los pagos" onChange={(e) => s.acciones.setUnidad(e.target.value)} />
                </label>
              </div>

              <div className="ad-fila">
                <Segmented
                  label="Modo de entrada"
                  value={s.modo}
                  onChange={s.cambiarModo}
                  options={[{ id: 'editor', label: 'Editor' }, { id: 'texto', label: 'Texto (Markdown)' }]}
                />
                <button type="button" className="btn btn--sm" onClick={copiarEntrada}>Copiar el árbol como texto</button>
              </div>

              {s.modo === 'editor' ? (
                <EditorArbol draft={s.draft} acc={s.acciones} errores={s.erroresNorm} />
              ) : (
                <div className="ad-bloque">
                  <textarea
                    className="ad-textarea"
                    value={s.texto}
                    rows={14}
                    spellCheck={false}
                    aria-label="Árbol en texto indentado"
                    onChange={(e) => s.setTexto(e.target.value)}
                  />
                  <p className="ad-nota">
                    «[D] nombre» es un nodo de decisión y «[A] nombre» uno de azar. Las ramas van debajo, con más sangría: «- nombre | p 0,6 | pago -120 | valor 300».
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {pestana === 'arbol' && (
        <section className="ad-panel ad-cuerpo" aria-label="Resultado">
          {s.errores.length > 0 ? (
            <div className="ad-errores" role="alert" data-testid="errores">
              <strong>Corrige esto para ver el resultado:</strong>
              <ul>{s.errores.map((e, i) => <li key={i}>{e.mensaje}</li>)}</ul>
            </div>
          ) : !listo ? (
            <p className="ad-nota">Escribe un árbol para ver el resultado.</p>
          ) : (
            <>
              <div className="ad-cab">
                <h3>Resultado</h3>
                <div className="ad-fila">
                  <button type="button" className="btn btn--sm btn--primary" disabled={exportando} onClick={() => exportar('pdf')}>Exportar PDF</button>
                  <button type="button" className="btn btn--sm" onClick={() => exportar('csv')}>Exportar CSV</button>
                  <button type="button" className="btn btn--sm" onClick={() => exportar('md')}>Exportar Markdown</button>
                </div>
              </div>
              {s.avisos.map((a, i) => <p key={i} className="ad-aviso" role="note">{a}</p>)}
              <ResultadoArbol arbol={s.arbol} ev={s.ev} riesgo={s.riesgo} svgRef={svgRef} />
              <h3 className="ad-sub">Sensibilidad de una probabilidad</h3>
              <Sensibilidad arbol={s.arbol} sel={sel} onSel={setSel} ligar={ligar} onLigar={setLigar} sens={sens} unidad={s.unidad} svgRef={svgSensRef} />
            </>
          )}
        </section>
      )}
      <Toast message={toast} onDone={limpiarToast} />
    </div>
  );
}
