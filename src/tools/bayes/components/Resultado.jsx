import { lineasResultado, tablasResultado } from '../domain/tablas.js';
import { listaTexto } from '../domain/formato.js';
import TablaDatos from './TablaDatos.jsx';

function CriteriosTexto({ problema, c }) {
  const nom = (idx) => listaTexto(idx.map((i) => problema.alternativas[i]));
  const min = problema.objetivo === 'min';
  return (
    <ul className="bz-lineas">
      <li><strong>{min ? 'Pesimista (minimax)' : 'Pesimista (maximin)'}:</strong> {nom(c.pesimista.indices)}</li>
      <li><strong>{min ? 'Optimista (minimin)' : 'Optimista (maximax)'}:</strong> {nom(c.optimista.indices)}</li>
      <li><strong>Laplace:</strong> {nom(c.laplace.indices)}</li>
      <li><strong>Arrepentimiento mínimo (Savage):</strong> {nom(c.savage.indices)}</li>
      <li>
        <strong>Máxima verosimilitud:</strong> {nom(c.verosimilitud.indices)}
        {c.verosimilitud.empate ? ' (hay empate entre los estados más probables; se usa el primero)' : ''}
      </li>
      <li><strong>Bayes (valor esperado):</strong> {nom(c.bayes.indices)}</li>
    </ul>
  );
}

/** Resultado del análisis: líneas de conclusión y tablas. Todo viene del dominio. */
export default function Resultado({ problema, analisis }) {
  const tablas = tablasResultado(problema, analisis);
  const c = analisis.criterios;
  const principales = tablas.filter((t) => t.id !== 'criterios');
  const criterios = tablas.find((t) => t.id === 'criterios');
  return (
    <div className="bz-resultado" data-testid="resultado">
      <ul className="bz-lineas" data-testid="lineas-resultado">
        {lineasResultado(problema, analisis).map((l, i) => <li key={i}>{l}</li>)}
      </ul>
      {principales.map((t) => <TablaDatos key={t.id} tabla={t} />)}
      <details className="bz-detalles">
        <summary>Criterios que no usan probabilidades (para comparar)</summary>
        <div>
          <CriteriosTexto problema={problema} c={c} />
          <TablaDatos tabla={criterios} mostrarTitulo={false} />
        </div>
      </details>
    </div>
  );
}
