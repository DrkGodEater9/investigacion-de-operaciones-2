import StatusMark from '@/ui/StatusMark.jsx';
import { hrefTopic } from '@/app/router.js';

/** Interpreta un campo numérico: acepta punto o coma decimal; null si no es un número. */
export function parseNumero(t) {
  const s = String(t ?? '').trim().replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** ¿La respuesta guardada se puede revisar? */
export const respuestaLista = (entrada, resp) => (entrada.tipo === 'opcion' ? typeof resp === 'string' && resp !== '' : parseNumero(resp) !== null);

/** Convierte la respuesta de pantalla a la que espera corregir(). */
export const respuestaParaCorregir = (entrada, resp) => (entrada.tipo === 'numero' ? parseNumero(resp) : resp);

function TablaModelo({ modelo }) {
  const { acts, recursos } = modelo;
  return (
    <div className="rc-tabla-wrap">
      <table className="rc-tabla">
        <thead>
          <tr>
            <th scope="col">Actividad</th>
            <th scope="col">Duración</th>
            <th scope="col">Predecesoras</th>
            {recursos.map((r) => <th scope="col" key={r.name}>{r.name} por período</th>)}
          </tr>
        </thead>
        <tbody>
          {acts.map((a) => (
            <tr key={a.name}>
              <th scope="row">{a.name}</th>
              <td>{a.d}</td>
              <td>{a.preds.length ? a.preds.join(', ') : '—'}</td>
              {a.r.map((v, k) => <td key={k}>{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Control({ ej, resp, onChange, bloqueado }) {
  const { entrada } = ej;
  const nombre = `rc-${ej.id}`;
  if (entrada.tipo === 'numero') {
    const invalido = resp !== undefined && resp !== '' && parseNumero(resp) === null;
    return (
      <div className="rc-campo">
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
        {invalido && <span id={`${nombre}-ayuda`} className="rc-ayuda">Escribe un número, por ejemplo 12.</span>}
      </div>
    );
  }
  return (
    <fieldset className="rc-campo">
      <legend>Elige una actividad</legend>
      <div className="rc-opciones">
        {entrada.opciones.map((o) => (
          <label key={o}>
            <input type="radio" name={nombre} checked={resp === o} disabled={bloqueado} onChange={() => onChange(o)} />
            <span>{o}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Resultado de corregir(): se muestra tal cual; nada se recalcula aquí. */
export function Retroalimentacion({ ej, resultado, tema }) {
  const ok = resultado.correcta;
  return (
    <div className="rc-retro" aria-live="polite">
      <div className={'rc-veredicto ' + (ok ? 'is-ok' : 'is-mal')}>
        <h4>
          <span aria-hidden="true"><StatusMark status={ok ? 'completo' : 'pendiente'} /></span>
          {ok ? 'Correcto' : 'Incorrecto'}
        </h4>
        <p>{resultado.mensaje}</p>
        {resultado.detalle && <p>{resultado.detalle}</p>}
      </div>
      <div>
        <b>Explicación</b>
        <p className="rc-texto">{ej.explicacion}</p>
      </div>
      <div>
        <b>Solución detallada</b>
        <p className="rc-texto">{ej.solucionDetallada}</p>
      </div>
      {!ok && (
        <p className="rc-enlaces">
          <span>Repasa el método:</span>
          <a href={hrefTopic(tema, 'paso')}>Paso a paso</a>
          <a href={hrefTopic(tema, 'resuelve')}>Resuelve el tuyo</a>
        </p>
      )}
    </div>
  );
}

/** Tarjeta del ejercicio: título, enunciado, tabla, pregunta y control. */
export default function Ejercicio({ ej, etiqueta, resp, onChange, bloqueado, onRevisar, puedeRevisar, children }) {
  const lim = ej.modelo.recursos[0].limite;
  return (
    <form className="rc-card" onSubmit={(ev) => { ev.preventDefault(); if (puedeRevisar && !bloqueado) onRevisar(); }} noValidate>
      <div>
        <h3>{ej.titulo}</h3>
        <span className="rc-semilla">Ejercicio #{ej.seed} · {etiqueta}</span>
      </div>
      <p className="rc-enun">{ej.enunciado}</p>
      <TablaModelo modelo={ej.modelo} />
      {lim != null && <p className="rc-nota">Límite disponible: {lim} {ej.modelo.recursos[0].name} por período.</p>}
      <p className="rc-pregunta">{ej.pregunta}</p>
      <Control ej={ej} resp={resp} onChange={onChange} bloqueado={bloqueado} />
      {children}
    </form>
  );
}
