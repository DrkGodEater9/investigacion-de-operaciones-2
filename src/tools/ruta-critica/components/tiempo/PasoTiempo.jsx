import { useState, useMemo, useEffect } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import RedTiempos from './RedTiempos.jsx';
import NormalCurve from '../results/NormalCurve.jsx';
import { EJEMPLOS_TIEMPO, ejemploTiempoPorId } from '../../domain/ejemplosTiempo.js';
import { pasosTiempo } from '../../domain/pasosTiempo.js';
import { fmt } from '../../domain/format.js';
import { NOT } from '../../domain/notacion.js';
import './tiempo.css';

const MS_PASO = 1500;
const OPCIONES = EJEMPLOS_TIEMPO.map((e) => ({ id: e.id, label: e.etiqueta }));
const f = (x) => fmt(x, 2).replace('-', '−');

function Tabla({ datos, estado }) {
  const { filas, pert } = datos;
  const c = {};
  Object.keys(estado.cols).forEach((k) => { c[k] = new Set(estado.cols[k]); });
  const celda = (visible, valor, key, clase = '') =>
    visible ? <td key={key} className={clase}>{valor}</td> : <td key={key} className="vacia">·</td>;
  return (
    <div className="pt-scroll">
      <table className="pt-tabla">
        <thead>
          <tr>
            <th>Actividad</th>
            <th>Predecesoras</th>
            {pert ? (
              <>
                <th>a</th><th>m</th><th>b</th><th>{NOT.te}</th><th>{NOT.v}</th>
              </>
            ) : (
              <th>Duración</th>
            )}
            <th>{NOT.tic}</th><th>{NOT.tfc}</th><th>{NOT.til}</th><th>{NOT.tfl}</th><th>{NOT.ht}</th><th>{NOT.hl}</th><th>Crítica</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((x) => (
            <tr key={x.name} className={estado.actual === x.name ? 'is-actual' : ''} aria-current={estado.actual === x.name ? 'true' : undefined}>
              <td>{x.name}</td>
              <td>{x.preds.join(', ') || '-'}</td>
              {pert ? (
                <>
                  <td>{f(x.a)}</td><td>{f(x.m)}</td><td>{f(x.b)}</td>
                  {celda(c.te.has(x.name), f(x.te), 'te')}
                  {celda(c.te.has(x.name), fmt(x.v, 4), 'v')}
                </>
              ) : (
                <td>{f(x.d)}</td>
              )}
              {celda(c.tic.has(x.name), f(x.tic), 'tic')}
              {celda(c.tic.has(x.name), f(x.tfc), 'tfc')}
              {celda(c.til.has(x.name), f(x.til), 'til')}
              {celda(c.til.has(x.name), f(x.tfl), 'tfl')}
              {celda(c.ht.has(x.name), f(x.ht), 'ht', c.crit.has(x.name) && x.critica ? 'es-critica' : '')}
              {celda(c.hl.has(x.name), f(x.hl), 'hl')}
              {celda(c.crit.has(x.name), x.critica ? 'Sí' : 'No', 'cr', x.critica ? 'es-critica' : '')}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Pestaña «Paso a paso» del tema 3.2. Todo el cálculo viene de domain/pasosTiempo.js. */
export default function PasoTiempo() {
  const [ejemploId, setEjemploId] = useState('cpm');
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const ejemplo = ejemploTiempoPorId(ejemploId);
  const datos = useMemo(() => pasosTiempo({ rows: ejemplo.rows, modo: ejemplo.modo, plazo: ejemplo.plazo ?? null }), [ejemplo]);
  const { pasos } = datos;
  const total = pasos.length;
  const idx = Math.min(stepIndex, total - 1);
  const paso = pasos[idx];
  const estado = paso.estado;
  const fin = idx === total - 1;

  const ir = (k) => { setPlaying(false); setStepIndex(Math.max(0, Math.min(total - 1, k))); };
  const cambiar = (id) => { setPlaying(false); setEjemploId(id); setStepIndex(0); };

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
    if (fin) { setStepIndex(0); setPlaying(true); } else setPlaying(!playing);
  };

  return (
    <div className="pt-root">
      <div className="pt-head">
        <h2>Ejemplo resuelto paso a paso</h2>
        <span className="pt-tag">Análisis del tiempo: CPM y PERT</span>
      </div>

      <div className="pt-selectores">
        <Segmented options={OPCIONES} value={ejemploId} onChange={cambiar} label="Ejemplo" size="sm" />
      </div>
      <p className="pt-enunciado">{ejemplo.enunciado}</p>

      <div className="pt-bar" onKeyDown={onKeyDown}>
        <div className="pt-controls step-controls">
          <button type="button" className="icon-btn" onClick={() => ir(idx - 1)} disabled={idx === 0} title="Paso anterior" aria-label="Paso anterior">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 3L5 8l6 5z" /></svg>
          </button>
          <button type="button" className="btn btn--sm btn--primary" onClick={alternar} style={{ minWidth: '96px', margin: '0 4px' }}>
            {playing ? 'Pausar' : fin ? 'Repetir' : 'Reproducir'}
          </button>
          <button type="button" className="icon-btn" onClick={() => ir(idx + 1)} disabled={fin} title="Paso siguiente" aria-label="Paso siguiente">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l6 5-6 5z" /></svg>
          </button>
          <button type="button" className="btn btn--sm" onClick={() => ir(0)} disabled={idx === 0 && !playing}>Reiniciar</button>
          <span className="pt-count">Paso {idx + 1} de {total}</span>
        </div>
        <input type="range" className="pt-range" min="0" max={total - 1} value={idx} onChange={(e) => ir(Number(e.target.value))} aria-label="Selector deslizante de pasos" />
      </div>

      <div className="pt-main">
        <div className="pt-card" aria-live="polite">
          <h3>{paso.titulo}</h3>
          <p>{paso.texto}</p>
          <div className="pt-calc">
            {paso.calculo.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>

        <div className="pt-panel">
          <h4>Red del proyecto</h4>
          <RedTiempos analysis={datos.analysis} estado={estado} etiqueta="Red con los tiempos calculados hasta este paso" />
        </div>

        <div className="pt-panel">
          <h4>Tabla de actividades</h4>
          <Tabla datos={datos} estado={estado} />
          {fin && !datos.pert && (
            <div className="pt-resultado">
              Duración del proyecto: {NOT.T} = {f(datos.res.T)}. Ruta crítica: {datos.res.rutasCriticas.map((r) => r.join(' → ')).join(' y ')}.
            </div>
          )}
        </div>

        {estado.campana && estado.campana.sd > 0 && (
          <div className="pt-panel">
            <h4>Distribución normal de la duración</h4>
            <div className="pt-curva">
              <NormalCurve mean={estado.campana.Te} sd={estado.campana.sd} x={estado.campana.T} decimals={2} />
            </div>
            <div className="pt-resultado">
              P(T ≤ {f(estado.campana.T)}) = {fmt(estado.campana.p * 100, 2)} %
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
