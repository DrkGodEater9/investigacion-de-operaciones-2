import { periodos, textoPeriodos } from '../domain/format.js';

/** Leyenda de los colores del Gantt y del histograma. */
export function Leyenda({ conLimite = true, paso = false }) {
  return (
    <ul className="rc-leyenda" aria-label="Leyenda">
      <li><span className="rc-sw rc-sw--crit" aria-hidden="true" />Crítica (holgura 0)</li>
      <li><span className="rc-sw rc-sw--nocrit" aria-hidden="true" />No crítica</li>
      <li><span className="rc-sw rc-sw--holg" aria-hidden="true" />Holgura hasta su LF</li>
      <li><span className="rc-sw rc-sw--fant" aria-hidden="true" />Posición original</li>
      {paso && <li><span className="rc-sw rc-sw--azul" aria-hidden="true" />Programada o movida en este paso</li>}
      {paso && <li><span className="rc-sw rc-sw--roja" aria-hidden="true" />Elegible que se retrasa</li>}
      <li><span className="rc-sw rc-sw--barra" aria-hidden="true" />Consumo del período</li>
      {conLimite && <li><span className="rc-sw rc-sw--pico" aria-hidden="true" />Consumo sobre el límite</li>}
    </ul>
  );
}

/** Tabla de datos y tiempos. `nuevo`: comienzos finales (opcional) para mostrar el comienzo nuevo y el corrimiento. */
export function TablaActividades({ red, base, nuevo, nombreNuevo = 'Comienzo nuevo' }) {
  return (
    <div className="rc-tabla-wrap">
      <table className="rc-tabla">
        <thead>
          <tr>
            <th scope="col">Actividad</th>
            <th scope="col">Dur.</th>
            <th scope="col">Predecesoras</th>
            {red.recursos.map((r) => <th scope="col" key={r}>{r}</th>)}
            <th scope="col">ES</th>
            <th scope="col">EF</th>
            <th scope="col">LS</th>
            <th scope="col">LF</th>
            <th scope="col">Holgura</th>
            {nuevo && <th scope="col">{nombreNuevo}</th>}
            {nuevo && <th scope="col">Cambio</th>}
          </tr>
        </thead>
        <tbody>
          {red.nombres.map((nm, i) => (
            <tr key={nm} className={base.H[i] === 0 ? 'is-crit' : ''}>
              <th scope="row">{nm}</th>
              <td>{red.d[i]}</td>
              <td>{red.preds[i].length ? red.preds[i].map((p) => red.nombres[p]).join(', ') : '—'}</td>
              {red.recursos.map((r, k) => <td key={r}>{red.r[i][k]}</td>)}
              <td>{base.ES[i]}</td>
              <td>{base.EF[i]}</td>
              <td>{base.LS[i]}</td>
              <td>{base.LF[i]}</td>
              <td>{base.H[i]}</td>
              {nuevo && <td>{nuevo[i]}</td>}
              {nuevo && <td className={nuevo[i] !== base.ES[i] ? 'rc-cambio' : ''}>{nuevo[i] === base.ES[i] ? '—' : `${nuevo[i] > base.ES[i] ? '+' : ''}${nuevo[i] - base.ES[i]}`}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Comparación antes / después: duración, pico y períodos sobre el límite por recurso. */
export function TablaComparacion({ antes, despues, etiquetaDespues }) {
  return (
    <div className="rc-tabla-wrap">
      <table className="rc-tabla rc-tabla--comp">
        <thead>
          <tr>
            <th scope="col">Medida</th>
            <th scope="col">Antes (cronograma temprano)</th>
            <th scope="col">{etiquetaDespues}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Duración del proyecto</th>
            <td>{periodos(antes.T)}</td>
            <td className={despues.T !== antes.T ? 'rc-cambio' : ''}>{periodos(despues.T)}</td>
          </tr>
          {antes.porRecurso.map((a, k) => {
            const d = despues.porRecurso[k];
            return [
              <tr key={'p' + k}>
                <th scope="row">Pico de {a.nombre}</th>
                <td>{a.pico}{a.periodosPico.length ? ` (${textoPeriodos(a.periodosPico)})` : ''}</td>
                <td>{d.pico}{d.periodosPico.length ? ` (${textoPeriodos(d.periodosPico)})` : ''}</td>
              </tr>,
              a.limite != null && (
                <tr key={'l' + k}>
                  <th scope="row">{a.nombre}: períodos sobre el límite ({a.limite})</th>
                  <td>{a.excesos.length ? `${a.excesos.length}: ${a.excesos.map((e) => `${e.periodo} (+${e.exceso})`).join(', ')}` : 'ninguno'}</td>
                  <td className={d.excesos.length ? 'rc-mal' : ''}>{d.excesos.length ? `${d.excesos.length}: ${d.excesos.map((e) => `${e.periodo} (+${e.exceso})`).join(', ')}` : 'ninguno'}</td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
