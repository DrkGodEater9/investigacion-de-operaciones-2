import { useCallback, useMemo, useRef, useState } from 'react';
import Segmented from '@/ui/Segmented.jsx';
import Toast from '@/ui/Toast.jsx';
import StatusMark from '@/ui/StatusMark.jsx';
import { useProgress } from '@/app/ProgressContext.jsx';
import { hrefTopic } from '@/app/router.js';
import { TIPOS, generarEjercicio, corregir } from '../domain/generador.js';
import { NOTACION } from '../domain/notacion.js';
import TablaDatos from './TablaDatos.jsx';
import '../pert-costo.css';

const TEMA = 'redes-costos';
const ETIQUETAS = {
  pendiente: 'Pendiente de costo',
  primera: 'Cuál acortar',
  conjunto: 'Varias rutas críticas',
  limite: 'Duración límite',
  costoDirecto: 'Costo directo',
  duracionOptima: 'Duración óptima',
  costoTotal: 'Costo mínimo',
};
const OPCIONES = [{ id: 'todos', label: 'Todos' }, ...TIPOS.map((t) => ({ id: t, label: ETIQUETAS[t] }))];
const semillaNueva = () => Math.floor(Math.random() * 9000) + 1000;

/** Interpreta un número escrito con punto o coma decimal; null si no lo es. */
export function parseNumero(t) {
  const s = String(t ?? '').trim().replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function Datos({ ej }) {
  const filas = ej.filas.map((f) => [f.name, f.preds || '-', f.dn, f.cn, f.dl === '' ? '-' : f.dl, f.cl === '' ? '-' : f.cl]);
  return (
    <TablaDatos
      etiqueta="Datos del ejercicio"
      headers={NOTACION.columnas.map((c) => NOTACION.nombre[c])}
      rows={filas}
    />
  );
}

function Control({ ej, resp, onChange, bloqueado }) {
  const nombre = `pc-${ej.id}`;
  if (ej.entrada.tipo === 'opcion') {
    return (
      <fieldset className="pc-campo-resp">
        <legend>Elige una opción</legend>
        <div className="pc-opciones">
          {ej.entrada.opciones.map((o, i) => (
            <label key={i}>
              <input type="radio" name={nombre} checked={resp === i} disabled={bloqueado} onChange={() => onChange(i)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  const invalido = resp !== undefined && resp !== '' && parseNumero(resp) === null;
  return (
    <div className="pc-campo-resp">
      <label htmlFor={`${nombre}-n`}>Tu respuesta (número)</label>
      <input
        id={`${nombre}-n`}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={resp ?? ''}
        disabled={bloqueado}
        aria-invalid={invalido || undefined}
        aria-describedby={invalido ? `${nombre}-ayuda` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {invalido && <span id={`${nombre}-ayuda`} className="pc-ayuda">Escribe un número, por ejemplo 12 o 12,5.</span>}
    </div>
  );
}

const lista = (ej, resp) => (ej.entrada.tipo === 'opcion' ? Number.isInteger(resp) : parseNumero(resp) !== null);
const aCorregir = (ej, resp) => (ej.entrada.tipo === 'opcion' ? resp : parseNumero(resp));

export default function PracticaCostos() {
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

  const puedeRevisar = lista(ej, resp);
  const revisar = () => {
    if (!puedeRevisar || resultado) return;
    const r = corregir(ej, aCorregir(ej, resp));
    setResultado(r);
    setSesion((s) => ({ a: s.a + (r.correcta ? 1 : 0), b: s.b + 1 }));
    if (r.correcta && !marcado.current) {
      marcado.current = true;
      if (!studied.has(TEMA)) { toggle(TEMA); setAviso('Tema marcado como estudiado.'); }
    }
  };

  return (
    <div className="pc-practica">
      <div className="pc-tipos">
        <Segmented options={OPCIONES} value={modo} onChange={cambiarModo} label="Tipo de ejercicio" />
      </div>
      <div className="pc-barra-p">
        <form className="inline-field" onSubmit={usarSemilla}>
          <label htmlFor="pc-semilla">Repetir semilla</label>
          <input id="pc-semilla" inputMode="numeric" value={entradaSemilla} onChange={(e) => setEntradaSemilla(e.target.value)} placeholder="4821" />
          <button type="submit" className="btn btn--sm">Ir</button>
        </form>
        <span className="pc-sesion" aria-live="polite">Correctas: {sesion.a} de {sesion.b}</span>
      </div>

      <form className="pc-card" key={ej.id} onSubmit={(e) => { e.preventDefault(); revisar(); }} noValidate>
        <div>
          <h3>{ej.titulo}</h3>
          <span className="pc-semilla">Ejercicio #{ej.seed} · {ETIQUETAS[ej.tipo]}</span>
        </div>
        <p className="pc-enunciado">{ej.enunciado}</p>
        {ej.tipo !== 'pendiente' && <Datos ej={ej} />}
        <p className="pc-pregunta">{ej.pregunta}</p>
        <Control ej={ej} resp={resp} onChange={setResp} bloqueado={!!resultado} />
        <div className="pc-acciones">
          <button type="submit" className="btn btn--primary" disabled={!puedeRevisar || !!resultado}>Revisar</button>
          {resultado && <button type="button" className="btn" onClick={limpiar}>Intentar de nuevo</button>}
          <button type="button" className="btn" onClick={otro}>Otro ejercicio</button>
        </div>
        {resultado && (
          <div className="pc-resultado-p" aria-live="polite">
            <div className={'pc-veredicto ' + (resultado.correcta ? 'is-ok' : 'is-mal')}>
              <h4>
                <span aria-hidden="true"><StatusMark status={resultado.correcta ? 'completo' : 'pendiente'} /></span>
                {resultado.correcta ? 'Correcto' : 'Incorrecto'}
              </h4>
              <p>{resultado.mensaje}</p>
              {resultado.detalle && <p>{resultado.detalle}</p>}
            </div>
            <div>
              <b>Explicación</b>
              <p className="pc-texto">{ej.explicacion}</p>
            </div>
            <div>
              <b>Solución detallada</b>
              <p className="pc-texto">{ej.solucionDetallada}</p>
            </div>
          </div>
        )}
      </form>

      <p className="pc-enlaces">
        <span>¿Quieres comprobarlo con tu propio proyecto?</span>
        <a href={hrefTopic(TEMA, 'resuelve')}>Ve a Resuelve el tuyo</a>
        <span>Repasa el método en</span>
        <a href={hrefTopic(TEMA, 'paso')}>Paso a paso</a>
      </p>
      <Toast message={aviso} onDone={limpiarAviso} />
    </div>
  );
}
