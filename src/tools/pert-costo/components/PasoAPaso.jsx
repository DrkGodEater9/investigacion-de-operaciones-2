import { useEffect, useMemo, useState } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import { EJEMPLOS, ejemploPorId } from '../domain/ejemplos.js';
import { analizar } from '../domain/analizar.js';
import { NOTACION } from '../domain/notacion.js';
import { num } from '../domain/formato.js';
import RedCostos from './RedCostos.jsx';
import CurvaCostos from './CurvaCostos.jsx';
import TablaDatos from './TablaDatos.jsx';
import '../pert-costo.css';

const MS_PASO = 2400;
const OPCIONES = EJEMPLOS.map((e) => ({ id: e.id, label: e.corto, hint: e.titulo }));

/** Pestaña «Paso a paso» del tema 3.3. Todo el cálculo y el texto vienen del dominio. */
export default function PasoAPaso() {
  const [ejemploId, setEjemploId] = useState('rombo');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  const ejemplo = ejemploPorId(ejemploId);
  const a = useMemo(() => analizar({ filas: ejemplo.filas, ci: ejemplo.ci, fijo: ejemplo.fijo }), [ejemplo]);
  const { m, res, red, pasos } = a;
  const total = pasos.length;
  const i = Math.min(idx, total - 1);
  const paso = pasos[i];
  const ultimo = i === total - 1;

  const ir = (k) => { setPlaying(false); setIdx(Math.max(0, Math.min(total - 1, k))); };
  const cambiarEjemplo = (id) => { setPlaying(false); setEjemploId(id); setIdx(0); };

  useEffect(() => {
    if (!playing) return undefined;
    if (i >= total - 1) { setPlaying(false); return undefined; }
    const t = setTimeout(() => setIdx(i + 1), MS_PASO);
    return () => clearTimeout(t);
  }, [playing, i, total]);

  const alternar = () => {
    if (ultimo) { setIdx(0); setPlaying(true); } else setPlaying(!playing);
  };
  const teclas = (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'range') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); ir(i - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); ir(i + 1); }
  };

  const criticas = new Set(paso.criticas);
  const filasAct = m.names.map((nom, j) => {
    const cambio = paso.acortadas.includes(nom) ? 'Se acorta' : paso.alargadas.includes(nom) ? 'Se alarga' : paso.d[j] < m.dn[j] ? 'Acortada' : '';
    return [nom, num(m.dn[j]), num(m.dl[j]), m.pend[j] == null ? '-' : num(m.pend[j]), num(paso.d[j]), cambio || (criticas.has(nom) ? 'Crítica' : '')];
  });
  const clasesAct = m.names.map((nom) => (paso.acortadas.includes(nom) || paso.alargadas.includes(nom) ? 'is-cambio' : criticas.has(nom) ? 'is-critica' : ''));
  const alcanzados = res.estados.filter((e) => e.T >= paso.hasta);
  const filasCosto = alcanzados.map((e) => [String(e.T), num(e.directo), num(e.indirecto), num(e.total)]);
  const clasesCosto = alcanzados.map((e) => (paso.optimo && e.T === res.optimo.T ? 'is-optima' : e.T === paso.T ? 'is-actual' : ''));
  const marcarCriticas = paso.id !== 'pendientes';

  return (
    <div className="pc-paso">
      <div className="pc-cab">
        <h2>Ejemplo resuelto paso a paso</h2>
        <span className="pc-etiqueta">PERT/COSTO</span>
      </div>

      <div className="pc-selectores">
        <Segmented options={OPCIONES} value={ejemploId} onChange={cambiarEjemplo} label="Ejemplo" size="sm" />
      </div>

      <div className="pc-enunciado">
        <p>{ejemplo.enunciado}</p>
        <TablaDatos
          etiqueta="Datos del ejemplo"
          headers={[NOTACION.nombre.name, NOTACION.nombre.preds, NOTACION.nombre.dn, NOTACION.nombre.cn, NOTACION.nombre.dl, NOTACION.nombre.cl]}
          rows={m.names.map((nom, j) => [nom, m.actividades[j].preds.join(', ') || '-', num(m.dn[j]), num(m.cn[j]), num(m.dl[j]), num(m.cl[j])])}
        />
      </div>

      <div className="pc-barra" onKeyDown={teclas}>
        <div className="pc-controles step-controls">
          <button type="button" className="icon-btn" onClick={() => ir(i - 1)} disabled={i === 0} title="Paso anterior" aria-label="Paso anterior">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 3L5 8l6 5z" /></svg>
          </button>
          <button type="button" className="btn btn--sm btn--primary pc-play" onClick={alternar}>
            {playing ? 'Pausar' : ultimo ? 'Repetir' : 'Reproducir'}
          </button>
          <button type="button" className="icon-btn" onClick={() => ir(i + 1)} disabled={ultimo} title="Paso siguiente" aria-label="Paso siguiente">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l6 5-6 5z" /></svg>
          </button>
          <button type="button" className="btn btn--sm" onClick={() => ir(0)} disabled={i === 0 && !playing}>Reiniciar</button>
          <span className="pc-cuenta">Paso {i + 1} de {total}</span>
        </div>
        <input type="range" className="pc-rango" min="0" max={total - 1} value={i} onChange={(e) => ir(Number(e.target.value))} aria-label="Selector deslizante de pasos" />
      </div>

      <div className="pc-principal">
        <div className="pc-tarjeta" aria-live="polite">
          <h3>{paso.titulo}</h3>
          <p>{paso.texto}</p>
          <div className="pc-calculo">
            {paso.calculo.map((l, k) => <div key={k}>{l}</div>)}
          </div>
        </div>

        <div className="pc-panel">
          <h4>Actividades en este paso</h4>
          <TablaDatos
            etiqueta="Duraciones por actividad"
            headers={['Actividad', NOTACION.dn, NOTACION.dl, NOTACION.pendiente, 'Duración ahora', 'Estado']}
            rows={filasAct}
            clases={clasesAct}
          />
          <dl className="pc-kpis pc-kpis--chico">
            <div><dt>Duración</dt><dd>{paso.T}</dd></div>
            <div><dt>Costo directo</dt><dd>{num(paso.directo)}</dd></div>
            <div><dt>Costo indirecto</dt><dd>{num(paso.indirecto)}</dd></div>
            <div className="pc-kpi-total"><dt>Costo total</dt><dd>{num(paso.total)}</dd></div>
          </dl>
        </div>
      </div>

      <div className="pc-panel">
        <h4>Red con las duraciones de este paso</h4>
        <RedCostos
          red={red}
          d={paso.d}
          acortadas={paso.acortadas}
          alargadas={paso.alargadas}
          marcarCriticas={marcarCriticas}
          mostrarTiempos={marcarCriticas}
          descripcion={`Red en el paso ${i + 1}: el proyecto dura ${paso.T}.`}
        />
        <p className="pc-leyenda">
          <span className="pc-ley pc-ley--rojo">Ruta crítica</span>
          <span className="pc-ley pc-ley--azul">Actividad que cambia en este paso</span>
          <span className="pc-ley">Bajo cada flecha: duración actual. En cada evento: tiempo temprano (izquierda) y tardío (derecha).</span>
        </p>
      </div>

      <div className="pc-principal pc-principal--curva">
        <div className="pc-panel">
          <h4>Costos de las duraciones ya calculadas</h4>
          <TablaDatos etiqueta="Costos por duración" headers={['Duración', 'Directo', 'Indirecto', 'Total']} rows={filasCosto} clases={clasesCosto} />
        </div>
        <div className="pc-panel">
          <h4>Curva costo-duración (se dibuja a medida que se reduce)</h4>
          <CurvaCostos res={res} hasta={paso.hasta} actual={paso.fase === 'reduccion' ? paso.T : null} mostrarOptimo={!!paso.optimo} />
        </div>
      </div>
    </div>
  );
}
