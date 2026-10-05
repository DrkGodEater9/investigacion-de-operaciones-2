import { bmATexto } from '../domain/tablero.js';
import '../tablero.css';

/** x1 → x<sub>1</sub>, S1 → S<sub>1</sub>. */
function Nombre({ texto }) {
  const m = /^([A-Za-z]+)(\d+)$/.exec(texto);
  if (!m) return <>{texto}</>;
  return (
    <>
      {m[1]}
      <sub>{m[2]}</sub>
    </>
  );
}

/**
 * Tablero simplex en la notación del profesor. Solo muestra: todos los valores
 * vienen ya calculados en `tablero` (domain/tablero.js).
 *   tablero : {cols, c, base, A, b, zj, cz, zval}
 *   pivote  : {fila, col} | null  (columna pivote sombreada, celda pivote con borde, fila saliente en negrita)
 *   razones : {filas?: (string|null)[], columnas?: (string|null)[]}
 */
export default function TableroSimplex({ tablero, pivote = null, razones = null, titulo = null }) {
  if (!tablero) return null;
  const { cols, c, base, A, b, zj, cz, zval } = tablero;
  const N = cols.length;
  const colPiv = pivote ? pivote.col : -1;
  const filaPiv = pivote ? pivote.fila : -1;
  const tieneRazF = !!(razones && razones.filas);
  const tieneRazC = !!(razones && razones.columnas);
  const cp = (j) => (j === colPiv ? 'tb-colpivote' : undefined);

  return (
    <div className="tablero-wrap">
      {titulo && <h4 className="tablero-titulo">{titulo}</h4>}
      <div className="tablero-scroll" tabIndex={0} role="region" aria-label={titulo || 'Tablero simplex'}>
        <table className="tablero-simplex">
          <caption className="sr-only">{titulo || 'Tablero simplex'}</caption>
          <thead>
            <tr className="tb-cj">
              <td className="tb-vacio" />
              <th scope="row" className="tb-etq">C<sub>j</sub></th>
              {c.map((cj, j) => (
                <td key={j} className={cp(j)}>{bmATexto(cj)}</td>
              ))}
              <td className="tb-vacio" />
              {tieneRazF && <td className="tb-vacio" />}
            </tr>
            <tr>
              <th scope="col">V.B.</th>
              <th scope="col">C<sub>B</sub></th>
              {cols.map((col, j) => (
                <th key={j} scope="col" className={cp(j)}><Nombre texto={col.nombre} /></th>
              ))}
              <th scope="col">b<sub>j</sub></th>
              {tieneRazF && <th scope="col">b<sub>j</sub>/a<sub>ij</sub></th>}
            </tr>
          </thead>
          <tbody>
            {base.map((jb, i) => (
              <tr key={i} className={i === filaPiv ? 'tb-sale' : undefined}>
                <th scope="row"><Nombre texto={cols[jb].nombre} /></th>
                <td>{bmATexto(c[jb])}</td>
                {A[i].map((v, j) => {
                  const esPiv = i === filaPiv && j === colPiv;
                  return (
                    <td key={j} className={esPiv ? 'tb-pivote' : cp(j)} aria-label={esPiv ? `Pivote ${v.toString()}` : undefined}>
                      {v.toString()}
                    </td>
                  );
                })}
                <td>{b[i].toString()}</td>
                {tieneRazF && <td className="tb-razon">{razones.filas[i] ?? '—'}</td>}
              </tr>
            ))}
            <tr className="tb-sep">
              <th scope="row" colSpan={2} className="tb-etq">Z<sub>j</sub></th>
              {zj.map((v, j) => (
                <td key={j} className={cp(j)}>{bmATexto(v)}</td>
              ))}
              <td>{bmATexto(zval)}</td>
              {tieneRazF && <td className="tb-vacio" />}
            </tr>
            <tr>
              <th scope="row" colSpan={2} className="tb-etq">C<sub>j</sub>−Z<sub>j</sub></th>
              {cz.map((v, j) => (
                <td key={j} className={cp(j)}>{bmATexto(v)}</td>
              ))}
              <td className="tb-vacio" />
              {tieneRazF && <td className="tb-vacio" />}
            </tr>
            {tieneRazC && (
              <tr className="tb-razon-fila">
                <th scope="row" colSpan={2} className="tb-etq">|C<sub>j</sub>−Z<sub>j</sub>| / |a|</th>
                {Array.from({ length: N }, (_, j) => (
                  <td key={j} className={'tb-razon ' + (cp(j) || '')}>{razones.columnas[j] ?? '—'}</td>
                ))}
                <td className="tb-vacio" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
