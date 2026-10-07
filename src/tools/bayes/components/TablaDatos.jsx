/**
 * Dibuja una tabla { titulo, headers, rows, resaltar, totales } del dominio (tablas.js).
 *   resaltar: [fila, columna][]   celdas óptimas en azul
 *   totales:  número de filas finales que son de totales
 *   colActiva: índice de la columna a subrayar (paso a paso)
 */
export default function TablaDatos({ tabla, colActiva = null, mostrarTitulo = true, vacias = null }) {
  const opt = new Set((tabla.resaltar || []).map(([i, j]) => `${i},${j}`));
  const n = tabla.rows.length;
  return (
    <>
      {mostrarTitulo && tabla.titulo && <h4 className="bz-titulo-tabla">{tabla.titulo}</h4>}
      <div className="bz-scroll">
        <table className="bz-tabla" data-testid={`tabla-${tabla.id}`}>
          <thead>
            <tr>
              {tabla.headers.map((h, j) => <th scope="col" key={j} className={colActiva === j ? 'is-col' : undefined}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {tabla.rows.map((r, i) => (
              <tr key={i} className={i >= n - (tabla.totales || 0) ? 'is-total' : undefined}>
                {r.map((c, j) => {
                  const vacio = vacias && vacias(i, j);
                  const cls = [opt.has(`${i},${j}`) ? 'is-opt' : '', colActiva === j ? 'is-col' : '', vacio ? 'is-vacio' : ''].filter(Boolean).join(' ');
                  return <td key={j} className={cls || undefined}>{vacio ? '·' : c}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
