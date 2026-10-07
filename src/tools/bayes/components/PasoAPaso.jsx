import { useEffect, useMemo, useState } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import { analizar } from '../domain/bayes.js';
import { ejemploPorId } from '../domain/ejemplos.js';
import { fmtNum, fmtPct } from '../domain/formato.js';
import { NOTACION, palabrasObjetivo } from '../domain/notacion.js';
import { pasosBayes } from '../domain/pasos.js';
import { tablaConjunta, tablaDecision, tablaPosterior, tablaVerosimilitud } from '../domain/tablas.js';
import TablaDatos from './TablaDatos.jsx';
import '../bayes.css';

const OPCIONES_EJEMPLO = [
  { id: 'B1', label: 'Terreno (utilidades)' },
  { id: 'B2', label: 'Máquina (costos)' },
  { id: 'B3', label: 'Producto (3 × 3)' },
  { id: 'B4', label: 'Inventario (sin muestra)' },
];
const MS_PASO = 1800;

/** Matriz de pagos que se va llenando: columna de VE, decisión y fila del mejor pago por estado. */
function tablaPagosPaso(p, a, e) {
  const n = p.estados.length;
  const headers = ['Alternativa', ...p.estados, ...(e.ve ? ['Valor esperado'] : [])];
  const rows = p.alternativas.map((alt, i) => [alt, ...p.pagos[i].map(fmtNum), ...(e.ve ? [fmtNum(a.sinInfo.ve[i])] : [])]);
  const resaltar = [];
  if (e.decision) a.sinInfo.optimas.forEach((i) => resaltar.push([i, n + 1]));
  rows.push(['Prob. a priori', ...p.priori.map(fmtNum), ...(e.ve ? [''] : [])]);
  let totales = 1;
  if (e.perfecta) {
    rows.push(['Mejor pago del estado', ...a.perfecta.porEstado.map((x) => fmtNum(x.valor)), ...(e.ve ? [''] : [])]);
    totales = 2;
    p.estados.forEach((_, j) => a.perfecta.porEstado[j].alts.forEach((i) => resaltar.push([i, j + 1])));
  }
  return { id: 'pagos', titulo: 'Matriz de pagos', headers, rows, resaltar, totales };
}

function Resumen({ a, e }) {
  const filas = [];
  if (e.decision) filas.push([NOTACION.vesi, fmtNum(a.sinInfo.valor)]);
  if (e.perfecta) filas.push([NOTACION.vecip, fmtNum(a.perfecta.vecip)]);
  if (e.perfecta === 'veip') filas.push([NOTACION.veip, fmtNum(a.perfecta.veip)]);
  if (a.muestral && e.vecim) filas.push([NOTACION.vecim, fmtNum(a.muestral.vecim)]);
  if (a.muestral && e.veim) filas.push([NOTACION.veim, fmtNum(a.muestral.veim)]);
  if (a.muestral && e.efic) filas.push([NOTACION.eficiencia, a.muestral.eficiencia === null ? 'no definida' : fmtPct(a.muestral.eficiencia)]);
  if (filas.length === 0) return null;
  return (
    <div className="bz-ps-resumen" data-testid="resumen-paso">
      {filas.map(([k, v]) => <span key={k}><b>{k}</b> = {v}</span>)}
    </div>
  );
}

/** Pestaña «Paso a paso» del tema 2.1. Todo el cálculo viene del dominio. */
export default function PasoAPaso() {
  const [ejemploId, setEjemploId] = useState('B1');
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const ejemplo = ejemploPorId(ejemploId);
  const p = ejemplo.problema;
  const o = palabrasObjetivo(p.objetivo);
  const datos = useMemo(() => {
    const a = analizar(p);
    return { a, pasos: pasosBayes(p, a) };
  }, [p]);
  const { a, pasos } = datos;
  const total = pasos.length;
  const idx = Math.min(stepIndex, total - 1);
  const paso = pasos[idx];
  const e = paso.estado;
  const conclusion = idx === total - 1;

  const ir = (k) => { setPlaying(false); setStepIndex(Math.max(0, Math.min(total - 1, k))); };
  const cambiarEjemplo = (id) => { setPlaying(false); setEjemploId(id); setStepIndex(0); };

  useEffect(() => {
    if (!playing) return undefined;
    if (idx >= total - 1) { setPlaying(false); return undefined; }
    const t = setTimeout(() => setStepIndex(idx + 1), MS_PASO);
    return () => clearTimeout(t);
  }, [playing, idx, total]);

  const onKeyDown = (ev) => {
    if (ev.target.tagName === 'INPUT' && ev.target.type === 'range') return;
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); ir(idx - 1); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); ir(idx + 1); }
  };
  const alternar = () => {
    if (idx >= total - 1) { setStepIndex(0); setPlaying(true); } else setPlaying(!playing);
  };

  const m = a.muestral;
  let tLik = null;
  let tConj = null;
  let tPost = null;
  let tDec = null;
  if (m) {
    if (e.lik) tLik = tablaVerosimilitud(p);
    if (e.conj) {
      tConj = tablaConjunta(p, m);
      if (!e.marg) tConj = { ...tConj, rows: tConj.rows.slice(0, -1), totales: 0 };
    }
    if (e.post > 0) tPost = tablaPosterior(p, m);
    if (e.dec > 0) {
      const t = tablaDecision(p, a);
      const filas = t.rows.slice(0, e.dec);
      if (e.vecim) filas.push(t.rows[t.rows.length - 1]);
      tDec = { ...t, rows: filas, totales: e.vecim ? 1 : 0 };
    }
  }

  return (
    <div className="bz-ps">
      <div className="bz-ps-head">
        <h2>Ejemplo resuelto paso a paso</h2>
        <span className="bz-ps-tag">Teoría bayesiana de la decisión</span>
      </div>

      <div className="bz-ps-selectores">
        <Segmented options={OPCIONES_EJEMPLO} value={ejemploId} onChange={cambiarEjemplo} label="Ejemplo" size="sm" />
      </div>

      <div className="bz-ps-modelo">
        <p>{ejemplo.enunciado}</p>
      </div>

      <div className="bz-ps-bar" onKeyDown={onKeyDown}>
        <div className="bz-ps-controls step-controls">
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
          <span className="bz-ps-count">Paso {idx + 1} de {total}</span>
        </div>
        <input
          type="range"
          className="bz-ps-range"
          min="0"
          max={total - 1}
          value={idx}
          onChange={(ev) => ir(Number(ev.target.value))}
          aria-label="Selector deslizante de pasos"
        />
      </div>

      <div className="bz-ps-main">
        <div className="bz-ps-card" aria-live="polite">
          <h3>{paso.titulo}</h3>
          <p>{paso.texto}</p>
          <div className="bz-ps-calc" data-testid="calculo">
            {paso.calculo.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>

        <div className="bz-ps-panel">
          <h4>Tablas ({o.pagos}; se busca el {o.mejor} valor esperado)</h4>
          <TablaDatos tabla={tablaPagosPaso(p, a, e)} />
          {tLik && <TablaDatos tabla={tLik} />}
          {tConj && <TablaDatos tabla={tConj} />}
          {tPost && (
            <TablaDatos
              tabla={tPost}
              colActiva={e.col !== null && e.col !== undefined ? e.col + 1 : null}
              vacias={(i, j) => j > e.post}
            />
          )}
          {tDec && <TablaDatos tabla={tDec} />}
          <Resumen a={a} e={e} />
        </div>
      </div>
    </div>
  );
}
