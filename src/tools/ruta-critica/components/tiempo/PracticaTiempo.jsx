import { useMemo, useRef, useState, useCallback } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import Toast from '@/ui/Toast.jsx';
import StatusMark from '@/ui/StatusMark.jsx';
import { useProgress } from '@/app/ProgressContext.jsx';
import { hrefTopic } from '@/app/router.js';
import RedTiempos from './RedTiempos.jsx';
import { TIPOS, generarEjercicio, corregir } from '../../domain/practicaTiempo.js';
import { analyze } from '../../domain/analyze.js';
import './tiempo.css';

const TEMA = 'redes-tiempos';
const ETIQUETAS = {
  tiempo: 'Tiempos de una actividad', holgura: 'Holguras', duracion: 'Duración', ruta: 'Ruta crítica',
  te: 'Tiempo esperado', varianza: 'Varianza', pertProyecto: 'PERT del proyecto', probabilidad: 'Probabilidad',
};
const OPCIONES = [{ id: 'todos', label: 'Todos' }, ...TIPOS.map((t) => ({ id: t, label: ETIQUETAS[t] }))];
const semillaNueva = () => Math.floor(Math.random() * 9000) + 1000;

/** Interpreta un campo numérico: acepta punto o coma decimal; null si no es un número. */
function parseNumero(t) {
  const s = String(t ?? '').trim().replace(',', '.').replace('%', '').replace('−', '-');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
const lista = (resp, entrada) => (entrada.tipo === 'multi' ? Array.isArray(resp) && resp.length > 0 : parseNumero(resp) !== null);

function TablaEj({ ej }) {
  const pert = ej.modo !== 'cpm';
  const simple = ej.modo === 'act';
  return (
    <div className="pt-scroll">
      <table className="pt-tabla" aria-label="Actividades del proyecto">
        <thead>
          <tr>
            <th>Actividad</th>
            {!simple && <th>Predecesoras</th>}
            {pert ? <><th>a</th><th>m</th><th>b</th></> : <th>Duración (días)</th>}
          </tr>
        </thead>
        <tbody>
          {ej.datos.acts.map((a) => (
            <tr key={a.name}>
              <td>{a.name}</td>
              {!simple && <td>{a.preds.join(', ') || '-'}</td>}
              {pert ? <><td>{a.a}</td><td>{a.m}</td><td>{a.b}</td></> : <td>{a.d}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Control({ ej, resp, onChange, bloqueado }) {
  const { entrada } = ej;
  const id = `pt-${ej.id}`;
  if (entrada.tipo === 'multi') {
    const marcadas = Array.isArray(resp) ? resp : [];
    const alternar = (i) => onChange(marcadas.includes(i) ? marcadas.filter((k) => k !== i) : [...marcadas, i].sort((a, b) => a - b));
    return (
      <fieldset className="pt-campo">
        <legend>Marca todas las que apliquen</legend>
        <div className="pt-opciones">
          {entrada.opciones.map((o, i) => (
            <label key={o}>
              <input type="checkbox" checked={marcadas.includes(i)} disabled={bloqueado} onChange={() => alternar(i)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  const invalido = resp !== undefined && resp !== '' && parseNumero(resp) === null;
  return (
    <div className="pt-campo">
      <label htmlFor={`${id}-n`}>Tu respuesta{entrada.unidad ? ` (${entrada.unidad})` : ' (número)'}</label>
      <input
        id={`${id}-n`}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={resp ?? ''}
        disabled={bloqueado}
        aria-invalid={invalido || undefined}
        aria-describedby={invalido ? `${id}-ayuda` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {invalido && <span id={`${id}-ayuda`} className="pt-ayuda">Escribe un número, por ejemplo 12 o 12,5.</span>}
    </div>
  );
}

function RedDeEjercicio({ ej }) {
  const an = useMemo(() => {
    if (ej.modo === 'act') return null;
    const rows = ej.datos.acts.map((a) => ({ name: a.name, preds: a.preds.join(',') || '-', d: String(a.d ?? ''), a: String(a.a ?? ''), m: String(a.m ?? ''), b: String(a.b ?? '') }));
    const r = analyze({ rows, mode: ej.modo, decimals: 2 });
    return r.ok ? r : null;
  }, [ej]);
  if (!an) return null;
  const rutas = an.critical.routes.map((r) => r.acts);
  return (
    <details className="pt-det" open>
      <summary>Red con los tiempos y la ruta crítica</summary>
      <RedTiempos analysis={an} rutasCriticas={rutas} etiqueta="Red del ejercicio resuelta" />
    </details>
  );
}

function Retro({ ej, res }) {
  const ok = res.correcta;
  return (
    <div className="pt-fb" aria-live="polite">
      <div className={'pt-veredicto ' + (ok ? 'is-ok' : 'is-mal')}>
        <h4>
          <span aria-hidden="true"><StatusMark status={ok ? 'completo' : 'pendiente'} /></span>
          {ok ? 'Correcto' : 'Incorrecto'}
        </h4>
        <p>{res.mensaje}</p>
        {res.detalle && <p>{res.detalle}</p>}
      </div>
      <div>
        <b>Explicación</b>
        <p className="pt-pre">{ej.explicacion}</p>
      </div>
      {ej.solucionDetallada && (
        <details className="pt-det">
          <summary>Tabla completa de tiempos</summary>
          <p className="pt-pre">{ej.solucionDetallada}</p>
        </details>
      )}
      <RedDeEjercicio ej={ej} />
      {!ok && (
        <p className="pt-enlaces">
          <span>Repasa el método:</span>
          <a href={hrefTopic(TEMA, 'teoria')}>Teoría</a>
          <a href={hrefTopic(TEMA, 'paso')}>Paso a paso</a>
          <a href={hrefTopic(TEMA, 'resuelve')}>Resuelve el tuyo</a>
        </p>
      )}
    </div>
  );
}

/** Pestaña «Práctica» del tema 3.2. */
export default function PracticaTiempo() {
  const { studied, toggle } = useProgress();
  const [modo, setModo] = useState('todos');
  const [rot, setRot] = useState(0);
  const [semilla, setSemilla] = useState(semillaNueva);
  const [resp, setResp] = useState(undefined);
  const [resultado, setResultado] = useState(null);
  const [sesion, setSesion] = useState({ a: 0, b: 0 });
  const [entradaSemilla, setEntradaSemilla] = useState('');
  const [aviso, setAviso] = useState('');
  const marcado = useRef(false);
  const limpiarAviso = useCallback(() => setAviso(''), []);

  const tipo = modo === 'todos' ? TIPOS[rot % TIPOS.length] : modo;
  const ej = useMemo(() => generarEjercicio(tipo, semilla), [tipo, semilla]);

  const limpiar = () => { setResp(undefined); setResultado(null); };
  const otro = () => {
    if (modo === 'todos') setRot((r) => r + 1);
    setSemilla(semillaNueva());
    limpiar();
  };
  const cambiarModo = (m) => { setModo(m); setSemilla(semillaNueva()); limpiar(); };
  const usarSemilla = (ev) => {
    ev.preventDefault();
    const s = Number(entradaSemilla.trim());
    if (!Number.isInteger(s) || s < 1 || s > 999999999) { setAviso('Escribe una semilla entera entre 1 y 999999999.'); return; }
    setSemilla(s); limpiar(); setEntradaSemilla('');
  };

  const puedeRevisar = lista(resp, ej.entrada);
  const revisar = () => {
    if (!puedeRevisar || resultado) return;
    const r = corregir(ej, ej.entrada.tipo === 'multi' ? resp : parseNumero(resp));
    setResultado(r);
    setSesion((p) => ({ a: p.a + (r.correcta ? 1 : 0), b: p.b + 1 }));
    if (r.correcta && !marcado.current) {
      marcado.current = true;
      if (!studied.has(TEMA)) { toggle(TEMA); setAviso('Tema marcado como estudiado.'); }
    }
  };

  return (
    <div className="pt-root">
      <div className="pt-tipos">
        <Segmented options={OPCIONES} value={modo} onChange={cambiarModo} label="Tipo de ejercicio" />
      </div>
      <div className="pt-barra">
        <form className="inline-field" onSubmit={usarSemilla}>
          <label htmlFor="pt-semilla">Repetir semilla</label>
          <input id="pt-semilla" inputMode="numeric" value={entradaSemilla} onChange={(e) => setEntradaSemilla(e.target.value)} placeholder="4821" />
          <button type="submit" className="btn btn--sm">Ir</button>
        </form>
        <span className="pt-sesion" aria-live="polite">Correctas: {sesion.a} de {sesion.b}</span>
      </div>

      <form
        key={ej.id}
        className="pt-ej"
        noValidate
        onSubmit={(ev) => { ev.preventDefault(); revisar(); }}
      >
        <div>
          <h3>{ej.titulo}</h3>
          <span className="pt-semilla">Ejercicio #{ej.seed} · {ETIQUETAS[ej.tipo]}</span>
        </div>
        <p className="pt-texto">{ej.enunciado}</p>
        <TablaEj ej={ej} />
        <p className="pt-pregunta">{ej.pregunta}</p>
        <Control ej={ej} resp={resp} onChange={setResp} bloqueado={!!resultado} />
        <div className="pt-acciones">
          <button type="button" className="btn btn--primary" disabled={!puedeRevisar || !!resultado} onClick={revisar}>Revisar</button>
          {resultado && <button type="button" className="btn" onClick={limpiar}>Intentar de nuevo</button>}
          <button type="button" className="btn" onClick={otro}>Otro ejercicio</button>
        </div>
        {resultado && <Retro ej={ej} res={resultado} />}
      </form>

      <p className="pt-enlaces">
        <span>¿Quieres comprobarlo con tu propia tabla?</span>
        <a href={hrefTopic(TEMA, 'resuelve')}>Ve a Resuelve el tuyo</a>
        <span>Repasa el método en</span>
        <a href={hrefTopic(TEMA, 'paso')}>Paso a paso</a>
      </p>
      <Toast message={aviso} onDone={limpiarAviso} />
    </div>
  );
}
