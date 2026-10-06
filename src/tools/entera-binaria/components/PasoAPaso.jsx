import { useState, useMemo, useEffect } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import { ejemploPorId } from '../domain/ejemplos.js';
import { balas } from '../domain/balas.js';
import { enumerate } from '../domain/enumerar.js';
import { pasosBalas, pasosEnumeracion } from '../domain/pasos.js';
import { fmtNum, objetivoTexto, restriccionTexto, listaNombres } from '../domain/format.js';
import ArbolBalas from './ArbolBalas.jsx';
import '../paso.css';

const OPCIONES_EJEMPLO = [
  { id: 'T3', label: 'Servidores' },
  { id: 'T1', label: 'Módulos de software' },
  { id: 'T2', label: 'Proyectos' },
];
const OPCIONES_METODO = [
  { id: 'balas', label: 'Aditivo de Balas' },
  { id: 'enum', label: 'Enumeración' },
];
const MS_PASO = 1500;
const num = (x) => fmtNum(x).replace('-', '−');

function MejorConocida({ historial, nodoActual, conclusion, model }) {
  let entrada = null;
  if (conclusion) entrada = historial[historial.length - 1] || null;
  else if (nodoActual != null) {
    for (const h of historial) if (h.nodeId <= nodoActual) entrada = h;
  }
  return (
    <div className="ps-incumbente">
      <strong>Mejor solución conocida</strong>
      {entrada ? (
        <span>
          Z = {num(entrada.z)}, elige {listaNombres(entrada.x.map((v, j) => (v ? j : -1)).filter((j) => j >= 0), model.names)}
          {' '}(nodo {entrada.nodeId})
        </span>
      ) : 'ninguna todavía'}
    </div>
  );
}

function TablaEnumeracion({ rows, model, fila, mejor }) {
  const visibles = fila == null ? rows : rows.slice(0, fila + 1);
  if (visibles.length === 0) return <p className="ps-vacio">Todavía no se evalúa ninguna combinación.</p>;
  const esMejor = (x) => mejor && mejor.x.join('') === x.join('');
  return (
    <table className="mini-table ps-tabla">
      <thead>
        <tr>
          <th>Combinación</th>
          {model.constraints.map((r, i) => <th key={i}>{r.name}</th>)}
          <th>Z</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        {visibles.map((row, k) => {
          const actual = fila != null && k === fila;
          const m = esMejor(row.x) && row.feasible;
          return (
            <tr key={k} className={(actual ? 'is-actual ' : '') + (m ? 'is-mejor' : '')} aria-current={actual ? 'true' : undefined}>
              <td>{row.x.join('')}</td>
              {row.lhs.map((v, i) => (
                <td key={i} className={row.satisfied[i] ? '' : 'ps-infactible'}>{num(v)}</td>
              ))}
              <td>{num(row.z)}</td>
              <td className={row.feasible ? (m ? 'ps-mejor' : '') : 'ps-infactible'}>
                {row.feasible ? (m ? 'Factible, mejor' : 'Factible') : 'No factible'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Pestaña «Paso a paso» del tema 1.3. Todo el cálculo viene del dominio. */
export default function PasoAPaso() {
  const [ejemploId, setEjemploId] = useState('T3');
  const [metodo, setMetodo] = useState('balas');
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const ejemplo = ejemploPorId(ejemploId);
  const model = ejemplo.model;

  const datos = useMemo(() => {
    if (metodo === 'balas') {
      return { pasos: pasosBalas(model), r: balas(model) };
    }
    return { pasos: pasosEnumeracion(model), rows: enumerate(model, { keepRows: true }).rows };
  }, [model, metodo]);

  const { pasos } = datos;
  const total = pasos.length;
  const idx = Math.min(stepIndex, total - 1);
  const paso = pasos[idx];
  const estado = paso.estado;
  const conclusion = idx === total - 1;

  const ir = (k) => { setPlaying(false); setStepIndex(Math.max(0, Math.min(total - 1, k))); };
  const cambiarEjemplo = (id) => { setPlaying(false); setEjemploId(id); setStepIndex(0); };
  const cambiarMetodo = (m) => { setPlaying(false); setMetodo(m); setStepIndex(0); };

  useEffect(() => {
    if (!playing) return undefined;
    if (idx >= total - 1) { setPlaying(false); return undefined; }
    const t = setTimeout(() => setStepIndex(idx + 1), MS_PASO);
    return () => clearTimeout(t);
  }, [playing, idx, total]);

  const onKeyDown = (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'range') return; // el deslizador ya usa las flechas
    if (e.key === 'ArrowLeft') { e.preventDefault(); ir(idx - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); ir(idx + 1); }
  };

  const alternar = () => {
    if (idx >= total - 1) { setStepIndex(0); setPlaying(true); } else setPlaying(!playing);
  };

  return (
    <div className="ps-root">
      <div className="ps-head">
        <h2>Ejemplo resuelto paso a paso</h2>
        <span className="ps-tag">Programación entera binaria</span>
      </div>

      <div className="ps-selectores">
        <Segmented options={OPCIONES_EJEMPLO} value={ejemploId} onChange={cambiarEjemplo} label="Ejemplo" size="sm" />
        <Segmented options={OPCIONES_METODO} value={metodo} onChange={cambiarMetodo} label="Método de resolución" size="sm" />
      </div>

      <div className="ps-modelo">
        <p>{ejemplo.enunciado}</p>
        <div className="ps-math">
          <div>{objetivoTexto(model)}</div>
          {model.constraints.map((_, i) => <div key={i}>{restriccionTexto(model, i)}</div>)}
          <div>xⱼ ∈ {'{0, 1}'}</div>
        </div>
      </div>

      <div className="ps-bar" onKeyDown={onKeyDown}>
        <div className="ps-controls step-controls">
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
          <span className="ps-count">Paso {idx + 1} de {total}</span>
        </div>
        <input
          type="range"
          className="ps-range"
          min="0"
          max={total - 1}
          value={idx}
          onChange={(e) => ir(Number(e.target.value))}
          aria-label="Selector deslizante de pasos"
        />
      </div>

      <div className="ps-main">
        <div className="ps-card" aria-live="polite">
          <h3>{paso.titulo}</h3>
          <p>{paso.texto}</p>
          <div className="ps-calc">
            {paso.calculo.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>

        {metodo === 'balas' ? (
          <div className="ps-panel">
            <h4>Árbol del aditivo de Balas</h4>
            {idx === 0 ? (
              <p className="ps-vacio">El árbol aparece al empezar a ramificar.</p>
            ) : (
              <div className="ps-arbol">
                <ArbolBalas
                  trace={datos.r.trace}
                  hasta={estado.hastaNodo}
                  actual={estado.nodoActual}
                  nombres={datos.r.transform.nombres}
                />
              </div>
            )}
            <MejorConocida
              historial={datos.r.incumbentHistory}
              nodoActual={estado.nodoActual}
              conclusion={conclusion}
              model={model}
            />
          </div>
        ) : (
          <div className="ps-panel">
            <h4>Combinaciones evaluadas</h4>
            <TablaEnumeracion
              rows={datos.rows}
              model={model}
              fila={idx === 0 ? -1 : estado.fila}
              mejor={estado.mejorHastaAhora}
            />
          </div>
        )}
      </div>
    </div>
  );
}
