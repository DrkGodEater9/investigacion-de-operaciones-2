import StatusMark from '@/ui/StatusMark.jsx';
import { hrefTopic } from '@/app/router.js';

/** Resultado de corregir(): se muestra tal cual; nada se recalcula aquí. */
export default function Retroalimentacion({ ej, resultado }) {
  const ok = resultado.correcta;
  return (
    <div className="pb-resultado" aria-live="polite">
      <div className={'pb-veredicto ' + (ok ? 'is-ok' : 'is-mal')}>
        <h4>
          <span aria-hidden="true"><StatusMark status={ok ? 'completo' : 'pendiente'} /></span>
          {ok ? 'Correcto' : 'Incorrecto'}
        </h4>
        <p>{resultado.mensaje}</p>
        {resultado.detalle && <p className="pb-detalle">{resultado.detalle}</p>}
      </div>
      {ej.explicacion && (
        <div>
          <b>Explicación</b>
          <p className="pb-texto">{ej.explicacion}</p>
        </div>
      )}
      {ej.solucionDetallada && (
        <div>
          <b>Solución detallada</b>
          <p className="pb-texto">{ej.solucionDetallada}</p>
        </div>
      )}
      {!ok && (
        <p className="pb-enlaces">
          <span>Repasa el método:</span>
          <a href={hrefTopic('entera-binaria', 'paso')}>Paso a paso</a>
          <a href={hrefTopic('entera-binaria', 'resuelve')}>Resuelve el tuyo</a>
        </p>
      )}
    </div>
  );
}
