import StatusMark from '@/ui/StatusMark.jsx';
import { filtrar } from '@/shared/campos.js';
import { hrefTopic } from '@/app/router.js';
import { parseNumero, fmtNum } from '../domain/format.js';
import ArbolSVG from './ArbolSVG.jsx';

/** ¿La respuesta guardada se puede revisar? */
export function respuestaLista(entrada, resp) {
  if (entrada.tipo === 'opcion') return Number.isInteger(resp);
  return parseNumero(resp) !== null;
}

/** Convierte la respuesta de pantalla a la que espera corregir(). */
export const respuestaParaCorregir = (entrada, resp) => (entrada.tipo === 'numero' ? parseNumero(resp) : resp);

function Control({ ej, resp, onChange, bloqueado }) {
  const { entrada } = ej;
  const nombre = `ad-${ej.id}`;
  if (entrada.tipo === 'numero') {
    const invalido = resp !== undefined && resp !== '' && parseNumero(resp) === null;
    return (
      <div className="ad-pr-campo">
        <label htmlFor={`${nombre}-n`}>Tu respuesta (número)</label>
        <input
          id={`${nombre}-n`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={resp ?? ''}
          disabled={bloqueado}
          aria-invalid={invalido || undefined}
          aria-describedby={`${nombre}-ayuda`}
          onChange={(e) => onChange(filtrar.decimal(e.target.value, { negativo: true, fraccion: true }))}
        />
        <span id={`${nombre}-ayuda`} className={'ad-pr-ayuda' + (invalido ? ' is-mal' : '')}>
          {invalido ? 'Escribe un número, por ejemplo 12 o 12,5.' : (entrada.ayuda || 'Puedes escribir decimales con coma o punto.')}
        </span>
      </div>
    );
  }
  return (
    <fieldset className="ad-pr-campo">
      <legend>Elige una opción</legend>
      <div className="ad-pr-opciones">
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

function TablaPagos({ tabla }) {
  return (
    <div className="ad-pr-tabla">
      <table>
        <thead>
          <tr>
            <th>Alternativa</th>
            {tabla.estados.map((e, j) => <th key={j}>{e} (p = {fmtNum(tabla.p[j])})</th>)}
          </tr>
        </thead>
        <tbody>
          {tabla.alternativas.map((a, i) => (
            <tr key={i}><td>{a}</td>{tabla.pagos[i].map((v, j) => <td key={j}>{fmtNum(v)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tarjeta del ejercicio: título, enunciado, árbol o tabla, pregunta y control de respuesta. */
export function Ejercicio({ ej, etiqueta, resp, onChange, bloqueado, onRevisar, puedeRevisar, children }) {
  return (
    <form className="ad-pr-card" onSubmit={(ev) => { ev.preventDefault(); if (puedeRevisar && !bloqueado) onRevisar(); }} noValidate>
      <div>
        <h3>{ej.titulo}</h3>
        <span className="ad-pr-semilla">Ejercicio #{ej.seed} · {etiqueta}</span>
      </div>
      <p className="ad-pr-enunciado">{ej.enunciado}</p>
      {ej.arbol && (
        <div className="ad-pr-arbol" tabIndex={0} aria-label="Árbol del ejercicio (desplázate para verlo completo)">
          <ArbolSVG arbol={ej.arbol} etiqueta={`Árbol del ejercicio ${ej.seed}`} />
        </div>
      )}
      {ej.tabla && <TablaPagos tabla={ej.tabla} />}
      <p className="ad-pr-pregunta">{ej.pregunta}</p>
      <Control ej={ej} resp={resp} onChange={onChange} bloqueado={bloqueado} />
      {children}
    </form>
  );
}

/** Resultado de corregir(): se muestra tal cual; nada se recalcula aquí. */
export function Retroalimentacion({ ej, resultado }) {
  const ok = resultado.correcta;
  return (
    <div className="ad-pr-resultado" aria-live="polite" data-testid="retro">
      <div className={'ad-pr-veredicto ' + (ok ? 'is-ok' : 'is-mal')}>
        <h4>
          <span aria-hidden="true"><StatusMark status={ok ? 'completo' : 'pendiente'} /></span>
          {ok ? 'Correcto' : 'Incorrecto'}
        </h4>
        <p>{resultado.mensaje}</p>
        {resultado.detalle && <p>{resultado.detalle}</p>}
      </div>
      {ej.explicacion && (
        <div>
          <b>Explicación</b>
          <p className="ad-pr-texto">{ej.explicacion}</p>
        </div>
      )}
      {ej.solucionDetallada && (
        <div>
          <b>Solución detallada</b>
          <p className="ad-pr-texto">{ej.solucionDetallada}</p>
        </div>
      )}
      {!ok && (
        <p className="ad-pr-enlaces">
          <span>Repasa el método:</span>
          <a href={hrefTopic('decision-arboles', 'paso')}>Paso a paso</a>
          <a href={hrefTopic('decision-arboles', 'resuelve')}>Resuelve el tuyo</a>
        </p>
      )}
    </div>
  );
}
