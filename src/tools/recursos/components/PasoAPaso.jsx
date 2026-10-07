import { useEffect, useMemo, useState } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import { EJEMPLOS, ejemploPorId } from '../domain/ejemplos.js';
import { compilar, cpm } from '../domain/cpm.js';
import { REGLAS } from '../domain/asignar.js';
import { pasosAsignar, pasosNivelar } from '../domain/pasos.js';
import Cronograma from './Graficos.jsx';
import { Leyenda, TablaActividades } from './Piezas.jsx';
import '../recursos.css';

const OPCIONES_EJEMPLO = [
  { id: 'E2', label: 'Taller' },
  { id: 'E1', label: 'Bodega' },
  { id: 'E3', label: 'Dos recursos' },
];
const OPCIONES_METODO = [
  { id: 'asignar', label: 'Limitar recursos' },
  { id: 'nivelar', label: 'Nivelar' },
];
const MS_PASO = 1600;

/** Pestaña «Paso a paso» del tema 3.4. Todo el cálculo viene del dominio. */
export default function PasoAPaso() {
  const [ejemploId, setEjemploId] = useState('E2');
  const [metodo, setMetodo] = useState('asignar');
  const [regla, setRegla] = useState('holgura');
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const ejemplo = ejemploPorId(ejemploId);
  const datos = useMemo(() => {
    const red = compilar(ejemplo.modelo);
    const base = cpm(red);
    if (metodo === 'nivelar') return { red, base, pasos: pasosNivelar(red), T: base.T };
    const r = pasosAsignar(red, regla);
    return { red, base, pasos: r.pasos, T: r.resultado.T };
  }, [ejemplo, metodo, regla]);

  const { red, base, pasos } = datos;
  const total = pasos.length;
  const idx = Math.min(stepIndex, total - 1);
  const paso = pasos[idx];
  const conclusion = idx === total - 1;
  const horizonte = Math.max(datos.T, base.T);

  const ir = (k) => { setPlaying(false); setStepIndex(Math.max(0, Math.min(total - 1, k))); };
  const reiniciar = (fn) => (v) => { setPlaying(false); fn(v); setStepIndex(0); };

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
    <div className="rc-ps">
      <div className="rc-ps-head">
        <h2>Ejemplo resuelto paso a paso</h2>
        <span className="rc-tag">Distribución de recursos</span>
      </div>

      <div className="rc-ps-sel">
        <Segmented options={OPCIONES_EJEMPLO} value={ejemploId} onChange={reiniciar(setEjemploId)} label="Ejemplo" size="sm" />
        <Segmented options={OPCIONES_METODO} value={metodo} onChange={reiniciar(setMetodo)} label="Método" size="sm" />
        {metodo === 'asignar' && (
          <label className="inline-field">
            Regla de prioridad
            <select value={regla} onChange={(e) => reiniciar(setRegla)(e.target.value)} aria-label="Regla de prioridad">
              {REGLAS.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="rc-ps-modelo">
        <p>{ejemplo.enunciado}</p>
        <TablaActividades red={red} base={base} />
        <p className="rc-nota">Límite disponible: {red.recursos.map((n, k) => `${n} ${red.limites[k]}`).join('; ')}. ES y EF son comienzo y fin tempranos; LS y LF, tardíos; holgura = LS − ES.</p>
      </div>

      <div className="rc-ps-bar" onKeyDown={onKeyDown}>
        <div className="rc-ps-ctrl step-controls">
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
          <span className="rc-ps-cuenta">Paso {idx + 1} de {total}</span>
        </div>
        <input
          type="range"
          className="rc-ps-range"
          min="0"
          max={total - 1}
          value={idx}
          onChange={(e) => ir(Number(e.target.value))}
          aria-label="Selector deslizante de pasos"
        />
      </div>

      <div className="rc-ps-main">
        <div className="rc-ps-card" aria-live="polite">
          <h3>{paso.titulo}</h3>
          <p>{paso.texto}</p>
          <div className="rc-ps-calc">
            {paso.calculo.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
        <div className="rc-ps-panel">
          <h4>Gantt e histograma en este paso</h4>
          <Leyenda paso />
          <Cronograma
            red={red}
            base={base}
            starts={paso.starts}
            fantasma={metodo === 'nivelar' ? base.ES : undefined}
            horizonte={horizonte}
            resalta={paso.resalta}
            periodo={paso.periodo}
          />
        </div>
      </div>
    </div>
  );
}
