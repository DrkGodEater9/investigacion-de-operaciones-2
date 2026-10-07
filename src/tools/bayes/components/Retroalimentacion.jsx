import StatusMark from '@/ui/StatusMark.jsx';
import { hrefTopic } from '@/app/router.js';

/** Resultado de corregir(): se muestra tal cual; nada se recalcula aquí. */
export default function Retroalimentacion({ ej, resultado }) {
  const ok = resultado.correcta;
  return (
    <div className="bz-pr-resultado" aria-live="polite" data-testid="retro">
      <div className={'bz-pr-veredicto ' + (ok ? 'is-ok' : 'is-mal')}>
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
          <p className="bz-pr-texto">{ej.explicacion}</p>
        </div>
      )}
      {ej.solucionDetallada && (
        <div>
          <b>Solución detallada</b>
          <p className="bz-pr-calculo">{ej.solucionDetallada}</p>
        </div>
      )}
      {!ok && (
        <p className="bz-pr-enlaces">
          <span>Repasa el método:</span>
          <a href={hrefTopic('decision-bayes', 'paso')}>Paso a paso</a>
          <a href={hrefTopic('decision-bayes', 'resuelve')}>Resuelve el tuyo</a>
        </p>
      )}
    </div>
  );
}
