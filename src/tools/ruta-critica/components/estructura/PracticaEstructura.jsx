import { useMemo, useRef, useState, useCallback } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import Toast from '@/ui/Toast.jsx';
import StatusMark from '@/ui/StatusMark.jsx';
import { useProgress } from '@/app/ProgressContext.jsx';
import { hrefTopic } from '@/app/router.js';
import RedSvg from './RedSvg.jsx';
import { TIPOS, ETIQUETAS, generarEjercicio, corregir } from '../../domain/practicaEstructura.js';
import '../../estructura.css';

const TEMA = 'redes-estructura';
const OPCIONES = [{ id: 'todos', label: 'Todos' }, ...TIPOS.map((t) => ({ id: t, label: ETIQUETAS[t] }))];
const semillaNueva = () => Math.floor(Math.random() * 9000) + 1000;

/** Interpreta un campo numérico: acepta punto o coma decimal; null si no es un número. */
export function parseNumero(t) {
  const s = String(t ?? '').trim().replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const respuestaLista = (entrada, resp) => {
  if (entrada.tipo === 'opcion') return Number.isInteger(resp);
  if (entrada.tipo === 'multi') return Array.isArray(resp) && resp.length > 0;
  return parseNumero(resp) !== null;
};
const respuestaParaCorregir = (entrada, resp) => (entrada.tipo === 'numero' ? parseNumero(resp) : resp);

function TablaActividades({ tabla }) {
  return (
    <div className="pe-tabla-wrap">
      <table className="mini-table pe-tabla" aria-label="Actividades y predecesoras">
        <thead>
          <tr><th>Actividad</th>{tabla.map((a) => <th key={a.name}>{a.name}</th>)}</tr>
        </thead>
        <tbody>
          <tr>
            <td>Predecesoras</td>
            {tabla.map((a) => <td key={a.name}>{a.preds.length ? a.preds.join(', ') : '-'}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Control({ ej, resp, onChange, bloqueado }) {
  const { entrada } = ej;
  const nombre = `pe-${ej.id}`;
  if (entrada.tipo === 'numero') {
    const invalido = resp !== undefined && resp !== '' && parseNumero(resp) === null;
    return (
      <div className="pe-campo">
        <label htmlFor={`${nombre}-n`}>Tu respuesta (número)</label>
        <input
          id={`${nombre}-n`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={resp ?? ''}
          disabled={bloqueado}
          aria-invalid={invalido || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {invalido && <span className="pe-ayuda">Escribe un número entero, por ejemplo 2.</span>}
      </div>
    );
  }
  if (entrada.tipo === 'multi') {
    const marcadas = Array.isArray(resp) ? resp : [];
    const alternar = (i) => onChange(marcadas.includes(i) ? marcadas.filter((k) => k !== i) : [...marcadas, i].sort((a, b) => a - b));
    return (
      <fieldset className="pe-campo">
        <legend>Marca todas las que apliquen</legend>
        <div className="pe-opciones pe-opciones--filas">
          {entrada.opciones.map((o, i) => (
            <label key={i}>
              <input type="checkbox" checked={marcadas.includes(i)} disabled={bloqueado} onChange={() => alternar(i)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <fieldset className="pe-campo">
      <legend>Elige una opción</legend>
      <div className="pe-opciones">
        {entrada.opciones.map((o, i) => (
          <label key={i}>
            <input type="radio" name={nombre} checked={resp === i} disabled={bloqueado} onChange={() => onChange(i)} />
            <span>{o}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Redes({ ej }) {
  if (!ej.redes) return null;
  const varias = ej.tipo === 'red';
  return (
    <div className="pe-redes">
      {ej.redes.map((net, i) => (
        <div className="pe-red" key={i}>
          <b>{varias ? `Red ${i + 1}` : ej.tipo === 'error' ? 'Red del compañero' : 'Red'}</b>
          <RedSvg net={net} etiquetas={ej.etiquetas} numerar label={varias ? `Red ${i + 1}` : 'Red del ejercicio'} />
        </div>
      ))}
    </div>
  );
}

const quitarPrefijo = (t) => {
  const r = t.replace(/^(In)?correcto:\s*/i, '');
  return r.charAt(0).toUpperCase() + r.slice(1);
};

function Retroalimentacion({ ej, resultado }) {
  const ok = resultado.correcta;
  return (
    <div className="pe-resultado" aria-live="polite">
      <div className={'pe-veredicto ' + (ok ? 'is-ok' : 'is-mal')}>
        <h4>
          <span aria-hidden="true"><StatusMark status={ok ? 'completo' : 'pendiente'} /></span>
          {ok ? 'Correcto' : 'Incorrecto'}
        </h4>
        <p>{quitarPrefijo(resultado.mensaje)}</p>
        {resultado.detalle && <p>{resultado.detalle}</p>}
      </div>
      <div>
        <b>Explicación</b>
        <p className="pe-texto">{ej.explicacion}</p>
      </div>
      {ej.solucionDetallada && (
        <div>
          <b>Solución detallada</b>
          <p className="pe-texto">{ej.solucionDetallada}</p>
        </div>
      )}
      {!ok && (
        <p className="pe-enlaces">
          <span>Repasa el método:</span>
          <a href={hrefTopic(TEMA, 'paso')}>Paso a paso</a>
          <a href={hrefTopic(TEMA, 'resuelve')}>Resuelve el tuyo</a>
        </p>
      )}
    </div>
  );
}

/** Pestaña «Práctica» del tema 3.1. Los ejercicios y la corrección vienen del dominio. */
export default function PracticaEstructura() {
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

  const puedeRevisar = respuestaLista(ej.entrada, resp);
  const revisar = () => {
    if (!puedeRevisar || resultado) return;
    const r = corregir(ej, respuestaParaCorregir(ej.entrada, resp));
    setResultado(r);
    setSesion((p) => ({ a: p.a + (r.correcta ? 1 : 0), b: p.b + 1 }));
    if (r.correcta && !marcado.current) {
      marcado.current = true;
      if (!studied.has(TEMA)) { toggle(TEMA); setAviso('Tema marcado como estudiado.'); }
    }
  };

  return (
    <div className="pe">
      <div className="pe-tipos">
        <Segmented options={OPCIONES} value={modo} onChange={cambiarModo} label="Tipo de ejercicio" />
      </div>
      <div className="pe-barra">
        <form className="inline-field" onSubmit={usarSemilla}>
          <label htmlFor="pe-semilla">Repetir semilla</label>
          <input id="pe-semilla" inputMode="numeric" value={entradaSemilla} onChange={(e) => setEntradaSemilla(e.target.value)} placeholder="4821" />
          <button type="submit" className="btn btn--sm">Ir</button>
        </form>
        <span className="pe-sesion" aria-live="polite">Correctas: {sesion.a} de {sesion.b}</span>
      </div>

      <form
        className="pe-ej"
        key={ej.id}
        onSubmit={(ev) => { ev.preventDefault(); revisar(); }}
        noValidate
      >
        <div>
          <h3>{ej.titulo}</h3>
          <span className="pe-semilla">Ejercicio #{ej.seed} · {ETIQUETAS[ej.tipo]}</span>
        </div>
        <p className="pe-enunciado">{ej.enunciado}</p>
        <TablaActividades tabla={ej.tabla} />
        <Redes ej={ej} />
        <p className="pe-pregunta">{ej.pregunta}</p>
        <Control ej={ej} resp={resp} onChange={setResp} bloqueado={!!resultado} />
        <div className="pe-acciones">
          <button type="button" className="btn btn--primary" disabled={!puedeRevisar || !!resultado} onClick={revisar}>Revisar</button>
          {resultado && <button type="button" className="btn" onClick={limpiar}>Intentar de nuevo</button>}
          <button type="button" className="btn" onClick={otro}>Otro ejercicio</button>
        </div>
        {resultado && <Retroalimentacion ej={ej} resultado={resultado} />}
      </form>

      <p className="pe-enlaces">
        <span>¿Quieres comprobarlo con tu propia tabla?</span>
        <a href={hrefTopic(TEMA, 'resuelve')}>Ve a Resuelve el tuyo</a>
        <span>Repasa el método en</span>
        <a href={hrefTopic(TEMA, 'paso')}>Paso a paso</a>
      </p>
      <Toast message={aviso} onDone={limpiarAviso} />
    </div>
  );
}
