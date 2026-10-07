import { filtrar, nombreEspacios, propsEntero } from '@/shared/campos.js';
import { MAX_ACT, MAX_REC } from '../domain/modelo.js';

/** Tabla editable. Todo el estado vive en useRecursos; aquí solo se muestra. */
export default function EditorTabla({ draft, acciones: a }) {
  return (
    <div className="rc-editor">
      <div className="rc-scroll-tabla">
        <table className="rc-tabla rc-tabla--editor">
          <thead>
            <tr>
              <th scope="col">Actividad</th>
              <th scope="col">Duración</th>
              <th scope="col">Predecesoras</th>
              {draft.recursos.map((r, k) => (
                <th scope="col" key={k}>
                  <input
                    className="rc-in rc-in--rec"
                    value={r.name}
                    spellCheck={false}
                    autoComplete="off"
                   
                    aria-label={`Nombre del recurso ${k + 1}`}
                    onChange={(e) => a.setRecNombre(k, nombreEspacios(e.target.value))}
                  />
                </th>
              ))}
              <th scope="col"><span className="sr-only">Quitar</span></th>
            </tr>
          </thead>
          <tbody>
            {draft.rows.map((r, i) => (
              <tr key={i}>
                <td><input className="rc-in rc-in--nom" value={r.name} aria-label={`Nombre de la actividad ${i + 1}`} spellCheck={false} autoComplete="off" onChange={(e) => a.setActNombre(i, filtrar.nombre(e.target.value))} /></td>
                <td><input className="rc-in rc-in--num" {...propsEntero} value={r.d} aria-label={`Duración de ${r.name || 'la actividad ' + (i + 1)}`} onChange={(e) => a.setDur(i, filtrar.entero(e.target.value, { max: 3 }))} /></td>
                <td><input className="rc-in rc-in--pred" value={r.preds} placeholder="-" spellCheck={false} autoComplete="off" aria-label={`Predecesoras de ${r.name || 'la actividad ' + (i + 1)}`} onChange={(e) => a.setPreds(i, filtrar.listaNombres(e.target.value))} /></td>
                {r.r.map((v, k) => (
                  <td key={k}><input className="rc-in rc-in--num" {...propsEntero} value={v} placeholder="0" aria-label={`${draft.recursos[k].name || 'Recurso ' + (k + 1)} que usa ${r.name || 'la actividad ' + (i + 1)}`} onChange={(e) => a.setReq(i, k, filtrar.entero(e.target.value, { max: 5 }))} /></td>
                ))}
                <td>
                  <button type="button" className="rc-x" aria-label={`Quitar la actividad ${r.name || i + 1}`} title="Quitar" onClick={() => a.quitarActividad(i)} disabled={draft.rows.length <= 1}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3}>Límite disponible por período</th>
              {draft.recursos.map((r, k) => (
                <td key={k}><input className="rc-in rc-in--num" {...propsEntero} value={r.limite} placeholder="sin límite" aria-label={`Límite de ${r.name || 'recurso ' + (k + 1)}`} onChange={(e) => a.setLimite(k, filtrar.entero(e.target.value, { max: 5 }))} /></td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="rc-fila">
        <button type="button" className="btn btn--sm" onClick={a.agregarActividad} disabled={draft.rows.length >= MAX_ACT}>Agregar actividad</button>
        <button type="button" className="btn btn--sm" onClick={a.agregarRecurso} disabled={draft.recursos.length >= MAX_REC}>Agregar recurso</button>
        <button type="button" className="btn btn--sm" onClick={a.quitarRecurso} disabled={draft.recursos.length <= 1}>Quitar último recurso</button>
      </div>
      <p className="rc-nota">Las duraciones y los requerimientos son enteros (períodos y unidades por período). Escribe las predecesoras separadas por coma, o deja «-» si no tiene.</p>
    </div>
  );
}
