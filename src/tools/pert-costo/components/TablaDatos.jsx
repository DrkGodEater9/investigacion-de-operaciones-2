import '../pert-costo.css';

/** Tabla de resultados con desplazamiento horizontal propio. `clases[i]` es la clase de la fila i. */
export default function TablaDatos({ headers, rows, clases = [], etiqueta, primeraIzq = true }) {
  return (
    <div className="pc-tabla-caja" role="region" aria-label={etiqueta} tabIndex={0}>
      <table className={'pc-tabla' + (primeraIzq ? ' pc-tabla--izq' : '')}>
        <thead>
          <tr>{headers.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={clases[i] || undefined}>
              {r.map((c, k) => <td key={k}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
