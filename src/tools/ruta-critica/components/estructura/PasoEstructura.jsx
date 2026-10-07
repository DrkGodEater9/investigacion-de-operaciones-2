import { useEffect, useMemo, useState } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import RedSvg, { layoutDeRed } from './RedSvg.jsx';
import { pasosConstruccion } from '../../domain/pasosEstructura.js';
import { EJEMPLOS_ESTRUCTURA } from '../../domain/ejemplosEstructura.js';
import '../../estructura.css';

const MS_PASO = 1600;
const OPCIONES = EJEMPLOS_ESTRUCTURA.map((e) => ({ id: e.id, label: e.etiqueta }));

/** Pestaña «Paso a paso» del tema 3.1: la red se arma actividad por actividad. Todo el cálculo viene del dominio. */
export default function PasoEstructura() {
  const [ejemploId, setEjemploId] = useState('teoria');
  const [indice, setIndice] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const ejemplo = EJEMPLOS_ESTRUCTURA.find((e) => e.id === ejemploId);

  const { pasos, caja } = useMemo(() => {
    const r = pasosConstruccion(ejemplo.acts);
    let w = 0;
    let h = 0;
    for (const p of r.pasos) {
      const b = layoutDeRed(p.net).box;
      w = Math.max(w, b.w);
      h = Math.max(h, b.h);
    }
    return { pasos: r.pasos, caja: { w, h } };
  }, [ejemplo]);

  const total = pasos.length;
  const idx = Math.min(indice, total - 1);
  const paso = pasos[idx];
  const ultimo = idx === total - 1;

  const ir = (k) => { setReproduciendo(false); setIndice(Math.max(0, Math.min(total - 1, k))); };
  const cambiarEjemplo = (id) => { setReproduciendo(false); setEjemploId(id); setIndice(0); };

  useEffect(() => {
    if (!reproduciendo) return undefined;
    if (idx >= total - 1) { setReproduciendo(false); return undefined; }
    const t = setTimeout(() => setIndice(idx + 1), MS_PASO);
    return () => clearTimeout(t);
  }, [reproduciendo, idx, total]);

  const alternar = () => {
    if (ultimo) { setIndice(0); setReproduciendo(true); } else setReproduciendo(!reproduciendo);
  };
  const onKeyDown = (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'range') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); ir(idx - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); ir(idx + 1); }
  };

  const actual = useMemo(() => {
    if (paso.tipo !== 'numeracion') return undefined;
    const k = paso.numeros.size;
    for (const [v, n] of paso.numeros) if (n === k) return v;
    return undefined;
  }, [paso]);

  return (
    <div className="pe-root">
      <div className="pe-head">
        <h2>Construcción de la red paso a paso</h2>
        <span className="pe-tag">Análisis de la estructura</span>
      </div>

      <div className="pe-selectores">
        <Segmented options={OPCIONES} value={ejemploId} onChange={cambiarEjemplo} label="Ejemplo" size="sm" />
      </div>

      <div className="pe-modelo">
        <p>{ejemplo.enunciado}</p>
        <div className="pe-tabla-wrap">
          <table className="mini-table pe-tabla">
            <thead>
              <tr><th>Actividad</th>{ejemplo.acts.map((a) => <th key={a.name}>{a.name}</th>)}</tr>
            </thead>
            <tbody>
              <tr>
                <td>Predecesoras</td>
                {ejemplo.acts.map((a) => <td key={a.name}>{a.preds.length ? a.preds.join(', ') : '-'}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="pe-bar" onKeyDown={onKeyDown}>
        <div className="pe-controls step-controls">
          <button type="button" className="icon-btn" onClick={() => ir(idx - 1)} disabled={idx === 0} title="Paso anterior" aria-label="Paso anterior">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 3L5 8l6 5z" /></svg>
          </button>
          <button type="button" className="btn btn--sm btn--primary pe-play" onClick={alternar}>
            {reproduciendo ? 'Pausar' : ultimo ? 'Repetir' : 'Reproducir'}
          </button>
          <button type="button" className="icon-btn" onClick={() => ir(idx + 1)} disabled={ultimo} title="Paso siguiente" aria-label="Paso siguiente">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l6 5-6 5z" /></svg>
          </button>
          <button type="button" className="btn btn--sm" onClick={() => ir(0)} disabled={idx === 0 && !reproduciendo}>Reiniciar</button>
          <span className="pe-count">Paso {idx + 1} de {total}</span>
        </div>
        <input
          type="range"
          className="pe-range"
          min="0"
          max={total - 1}
          value={idx}
          onChange={(e) => ir(Number(e.target.value))}
          aria-label="Selector deslizante de pasos"
        />
      </div>

      <div className="pe-main">
        <div className="pe-card" aria-live="polite">
          <h3>{paso.titulo}</h3>
          <p>{paso.texto}</p>
          <div className="pe-calc">
            {paso.calculo.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
        <div className="pe-panel">
          <h4>Red hasta este paso</h4>
          <div className="pe-dibujo" style={{ minHeight: caja.h * 0.8 }}>
            <RedSvg net={paso.net} etiquetas={paso.numeros} resaltar={paso.resaltar} actual={actual} caja={caja} label={paso.titulo} />
          </div>
          <p className="pe-leyenda">
            Flecha continua: actividad. Flecha discontinua: ficticia (dura 0). En azul, lo que se agrega o se usa en este paso.
          </p>
        </div>
      </div>
    </div>
  );
}
