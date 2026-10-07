import { useState, useMemo, useEffect } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import { EJEMPLOS, ejemploPorId } from '../domain/ejemplos.js';
import { normalizarOError } from '../domain/arbol.js';
import { evaluar } from '../domain/evaluar.js';
import { pasosInduccion } from '../domain/pasos.js';
import { fmtNum } from '../domain/format.js';
import ArbolSVG from './ArbolSVG.jsx';
import '../paso.css';

const OPCIONES = EJEMPLOS.map((e) => ({ id: e.id, label: e.titulo.replace(/ \(.*\)$/, '') }));
const MS_PASO = 1800;

/** Pestaña «Paso a paso» del tema 2.2: inducción hacia atrás animada. Todo el cálculo viene del dominio. */
export default function PasoAPaso() {
  const [ejemploId, setEjemploId] = useState(EJEMPLOS[0].id);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const ejemplo = ejemploPorId(ejemploId);
  const datos = useMemo(() => {
    const arbol = normalizarOError(ejemplo.arbol);
    const ev = evaluar(arbol);
    return { arbol, ev, pasos: pasosInduccion(arbol, ev) };
  }, [ejemplo]);

  const { arbol, ev, pasos } = datos;
  const total = pasos.length;
  const idx = Math.min(stepIndex, total - 1);
  const paso = pasos[idx];
  const resueltos = useMemo(() => Object.fromEntries(paso.estado.resueltos.map((id) => [id, true])), [paso]);
  const conclusion = idx === total - 1;

  const ir = (k) => { setPlaying(false); setStepIndex(Math.max(0, Math.min(total - 1, k))); };
  const cambiarEjemplo = (id) => { setPlaying(false); setEjemploId(id); setStepIndex(0); };

  useEffect(() => {
    if (!playing) return undefined;
    if (idx >= total - 1) { setPlaying(false); return undefined; }
    const t = setTimeout(() => setStepIndex(idx + 1), MS_PASO);
    return () => clearTimeout(t);
  }, [playing, idx, total]);

  const onKeyDown = (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'range') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); ir(idx - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); ir(idx + 1); }
  };

  const alternar = () => {
    if (idx >= total - 1) { setStepIndex(0); setPlaying(true); } else setPlaying(!playing);
  };

  return (
    <div className="ad-ps-root">
      <div className="ad-ps-head">
        <h2>Ejemplo resuelto paso a paso</h2>
        <span className="ad-ps-tag">Árboles de decisión</span>
      </div>

      <div className="ad-ps-selectores">
        <Segmented options={OPCIONES} value={ejemploId} onChange={cambiarEjemplo} label="Ejemplo" size="sm" />
      </div>

      <div className="ad-ps-modelo">
        <p>{ejemplo.enunciado}</p>
        <p className="ad-ps-nota">
          Objetivo: {arbol.sense === 'max' ? 'maximizar la utilidad esperada' : 'minimizar el costo esperado'}
          {arbol.unidad ? ` (${arbol.unidad})` : ''}.
        </p>
      </div>

      <div className="ad-ps-bar" onKeyDown={onKeyDown}>
        <div className="ad-ps-controls step-controls">
          <button type="button" className="icon-btn" onClick={() => ir(idx - 1)} disabled={idx === 0} title="Paso anterior" aria-label="Paso anterior">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 3L5 8l6 5z" /></svg>
          </button>
          <button type="button" className="btn btn--sm btn--primary step-play" onClick={alternar} style={{ minWidth: '96px', margin: '0 4px' }}>
            {playing ? 'Pausar' : conclusion ? 'Repetir' : 'Reproducir'}
          </button>
          <button type="button" className="icon-btn" onClick={() => ir(idx + 1)} disabled={idx >= total - 1} title="Paso siguiente" aria-label="Paso siguiente">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l6 5-6 5z" /></svg>
          </button>
          <button type="button" className="btn btn--sm" onClick={() => ir(0)} disabled={idx === 0 && !playing}>Reiniciar</button>
          <span className="ad-ps-count" data-testid="contador">Paso {idx + 1} de {total}</span>
        </div>
        <input
          type="range"
          className="ad-ps-range"
          min="0"
          max={total - 1}
          value={idx}
          onChange={(e) => ir(Number(e.target.value))}
          aria-label="Selector deslizante de pasos"
        />
      </div>

      <div className="ad-ps-main">
        <div className="ad-ps-card" aria-live="polite">
          <h3 data-testid="paso-titulo">{paso.titulo}</h3>
          <p>{paso.texto}</p>
          <div className="ad-ps-calc">
            {paso.calculo.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>

        <div className="ad-ps-panel">
          <h4>Árbol (se completa de derecha a izquierda)</h4>
          <div className="ad-ps-arbol" tabIndex={0} aria-label="Árbol de decisión (desplázate para verlo completo)">
            <ArbolSVG
              arbol={arbol}
              evaluacion={ev}
              resueltos={resueltos}
              actual={paso.estado.actual}
              camino={conclusion}
              etiqueta={`Árbol de decisión, paso ${idx + 1} de ${total}`}
            />
          </div>
          <div className="ad-ps-resumen">
            <strong>Valor del árbol</strong>
            <span>{resueltos[arbol.raiz.id] ? `${fmtNum(ev.valor)}${arbol.unidad ? ` ${arbol.unidad}` : ''}` : 'todavía no se conoce'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
