import { estrategiaTexto } from '../domain/evaluar.js';
import { fmtNum } from '../domain/format.js';
import { NOTACION } from '../domain/notacion.js';
import { tablaNodos, tablaRiesgo, lineasRiesgo } from '../domain/informe.js';
import ArbolSVG from './ArbolSVG.jsx';

/** Resultado del árbol: valor, estrategia, árbol con el camino óptimo, tabla de cálculo y perfil de riesgo. */
export default function ResultadoArbol({ arbol, ev, riesgo, svgRef }) {
  const t = tablaNodos(arbol, ev);
  const r = riesgo ? tablaRiesgo(riesgo) : null;
  const maximiza = arbol.sense === 'max';
  return (
    <div className="ad-resultado" data-testid="resultado">
      <div className="ad-estado">
        <p className="ad-estado-z" data-testid="valor-arbol">
          {maximiza ? 'Valor máximo esperado' : 'Valor mínimo esperado'}: {fmtNum(ev.valor)}{arbol.unidad ? ` ${arbol.unidad}` : ''}
        </p>
        <ul className="ad-lista" data-testid="estrategia">
          {estrategiaTexto(ev).map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </div>

      <div className="ad-figura">
        <div className="ad-scroll ad-arbol" tabIndex={0} aria-label="Árbol resuelto (desplázate para verlo completo)">
          <ArbolSVG ref={svgRef} arbol={arbol} evaluacion={ev} camino etiqueta="Árbol de decisión resuelto" />
        </div>
      </div>
      <p className="ad-leyenda">
        Cuadrado: decisión. Círculo: azar. Azul: estrategia óptima. Doble raya roja: rama descartada. {NOTACION.valorEsperado} = valor esperado del nodo de azar.
      </p>

      <h3 className="ad-sub">Cálculo por nodo</h3>
      <div className="ad-scroll">
        <table className="ad-tabla ad-tabla--izq" data-testid="tabla-nodos">
          <thead><tr>{t.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {t.rows.map((row, i) => (
              <tr key={i} className={row[7] === 'Sí' ? 'is-optima' : ''}>
                {row.map((c, j) => <td key={j}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {riesgo && r && (
        <>
          <h3 className="ad-sub">Perfil de riesgo de la estrategia óptima</h3>
          <ul className="ad-lista" data-testid="riesgo">
            {lineasRiesgo(riesgo).map((l, i) => <li key={i}>{l}</li>)}
          </ul>
          <div className="ad-scroll">
            <table className="ad-tabla ad-tabla--izq">
              <thead><tr>{r.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{r.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
