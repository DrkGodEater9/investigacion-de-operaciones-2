import { useMemo } from 'react';
import { Article, Section, Callout, Figure, Formula } from '@/ui/Article.jsx';
import { hrefTopic } from '@/app/router.js';
import { EJEMPLOS } from '@/tools/pert-costo/domain/ejemplos.js';
import { analizar } from '@/tools/pert-costo/domain/analizar.js';
import RedCostos from '@/tools/pert-costo/components/RedCostos.jsx';
import CurvaCostos from '@/tools/pert-costo/components/CurvaCostos.jsx';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";
const BLUE = '#1d3f8f';
const halo = { paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3.5, strokeLinejoin: 'round' };

/* ==========================================================================
   Figura 1: relación costo-duración de una actividad (recta entre normal y límite)
   ========================================================================== */
function FiguraPendiente() {
  // Actividad A del ejemplo: DN = 4, CN = 10, DL = 2, CL = 30
  const x0 = 60;
  const y0 = 230;
  const sx = (t) => x0 + t * 90;
  const sy = (c) => y0 - c * 6;
  return (
    <svg
      viewBox="0 0 520 280"
      role="img"
      aria-label="Recta de costo contra duración de la actividad A: pasa por el punto límite (2, 30) y el punto normal (4, 10). La pendiente es 10 por unidad de tiempo."
      style={{ width: '100%', maxWidth: 520, minWidth: 480, display: 'block', margin: '0 auto' }}
    >
      <line x1={x0} y1="20" x2={x0} y2={y0} stroke="#000" strokeWidth="1.2" />
      <line x1={x0} y1={y0} x2="500" y2={y0} stroke="#000" strokeWidth="1.2" />
      <text x="500" y={y0 + 34} textAnchor="end" fontFamily={SERIF} fontSize="14">Duración</text>
      <text x={x0 - 8} y="16" textAnchor="end" fontFamily={SERIF} fontSize="14">Costo</text>
      {[0, 1, 2, 3, 4, 5].map((t) => (
        <g key={t}>
          <line x1={sx(t)} y1={y0} x2={sx(t)} y2={y0 + 5} stroke="#000" />
          <text x={sx(t)} y={y0 + 20} textAnchor="middle" fontFamily={SERIF} fontSize="13">{t}</text>
        </g>
      ))}
      {[0, 10, 20, 30].map((c) => (
        <g key={c}>
          <line x1={x0 - 5} y1={sy(c)} x2={x0} y2={sy(c)} stroke="#000" />
          <text x={x0 - 9} y={sy(c) + 4} textAnchor="end" fontFamily={SERIF} fontSize="13">{c}</text>
        </g>
      ))}
      {/* líneas guía */}
      <path d={`M${sx(2)},${sy(30)} V${y0} M${sx(4)},${sy(10)} V${y0} M${x0},${sy(30)} H${sx(2)} M${x0},${sy(10)} H${sx(4)}`} stroke="#b9b9b3" strokeDasharray="4 4" fill="none" />
      {/* recta */}
      <line x1={sx(2)} y1={sy(30)} x2={sx(4)} y2={sy(10)} stroke={BLUE} strokeWidth="2.8" />
      <circle cx={sx(2)} cy={sy(30)} r="5" fill="#fff" stroke="#000" strokeWidth="1.8" />
      <circle cx={sx(4)} cy={sy(10)} r="5" fill="#fff" stroke="#000" strokeWidth="1.8" />
      <text x={sx(2) - 10} y={sy(30) - 10} textAnchor="start" fontFamily={SERIF} fontSize="14" {...halo}>Límite (DL = 2, CL = 30)</text>
      <text x={sx(4) + 4} y={sy(10) + 26} textAnchor="end" fontFamily={SERIF} fontSize="14" {...halo}>Normal (DN = 4, CN = 10)</text>
      <text x={sx(3) + 14} y={sy(20) - 4} textAnchor="start" fontFamily={SERIF} fontSize="14" fill={BLUE} fontWeight="600" {...halo}>pendiente = 20 / 2 = 10</text>
    </svg>
  );
}

const ROMBO = EJEMPLOS[0];

export default function Teoria() {
  const a = useMemo(() => analizar({ filas: ROMBO.filas, ci: ROMBO.ci, fijo: ROMBO.fijo }), []);
  const { m, res, red } = a;
  const etiquetas = useMemo(() => Object.fromEntries(m.names.map((n, j) => [n, `${m.dn[j]} / ${m.dl[j]}`])), [m]);
  const d10 = res.estadoEn(10).d;

  return (
    <Article>
      <Section title="La idea">
        <p>
          Terminar un proyecto antes cuesta más en las actividades (más personal, horas extras, equipos), pero ahorra costos indirectos (administración, alquileres, supervisión), que crecen con cada día que dura el proyecto. El método PERT/COSTO busca la duración en la que la suma de los dos costos es la menor.
        </p>
        <ul className="defs">
          <li><strong>Costo directo:</strong> lo que cuestan las actividades. Sube al acortarlas.</li>
          <li><strong>Costo indirecto:</strong> lo que cuesta mantener el proyecto en marcha. Se calcula como un costo por unidad de tiempo por la duración del proyecto (y, a veces, una parte fija).</li>
          <li><strong>Costo total</strong> = costo directo + costo indirecto.</li>
        </ul>
      </Section>

      <Section title="Duración normal y duración límite">
        <p>De cada actividad se conocen dos situaciones:</p>
        <ul className="defs">
          <li><strong>Normal</strong> (DN, CN): la duración más económica y su costo.</li>
          <li><strong>Límite</strong> o acelerada (DL, CL): la duración más corta posible (<em>crash</em>) y su costo, que es mayor. No se puede ir por debajo de DL.</li>
        </ul>
        <p>
          Se supone que entre los dos puntos el costo cambia en línea recta. Lo que cuesta ganar una unidad de tiempo es la pendiente de esa recta:
        </p>
        <Formula>pendiente de costo = (CL − CN) / (DN − DL)</Formula>
        <p>
          Con la actividad A del ejemplo (DN = 4, CN = 10, DL = 2, CL = 30): (30 − 10) / (4 − 2) = 10 por unidad de tiempo. Si DN = DL la actividad no se puede acortar.
        </p>
        <Figure caption="Figura 1. Entre la duración normal y la límite, el costo de la actividad sube en línea recta. La pendiente es el costo de cada unidad de tiempo ganada.">
          <div style={{ overflowX: 'auto' }}><FiguraPendiente /></div>
        </Figure>
        <Callout tone="nota" title="Duraciones enteras">
          La herramienta del sitio trabaja con duraciones enteras (días, semanas). Si tus datos traen decimales, cambia la unidad de tiempo.
        </Callout>
      </Section>

      <Section title="Un ejemplo completo">
        <p>
          Cuatro actividades: A va primero, B y C se hacen en paralelo después de A, y D cierra el proyecto (no se puede acortar). El costo indirecto es 12 por día.
        </p>
        <table className="mini-table">
          <thead>
            <tr><th>Actividad</th><th>Predecesoras</th><th>DN</th><th>CN</th><th>DL</th><th>CL</th><th>Pendiente</th></tr>
          </thead>
          <tbody>
            {m.names.map((nom, j) => (
              <tr key={nom}>
                <td>{nom}</td>
                <td>{m.actividades[j].preds.join(', ') || '-'}</td>
                <td>{m.dn[j]}</td><td>{m.cn[j]}</td><td>{m.dl[j]}</td><td>{m.cl[j]}</td>
                <td>{m.pend[j] == null ? 'no se acorta' : m.pend[j]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Figure caption="Figura 2. Red del ejemplo. Bajo cada flecha: duración normal / duración límite. En rojo, las dos rutas críticas con duraciones normales: A–B–D y A–C–D (12 días).">
          <RedCostos red={red} d={m.dn} etiquetas={etiquetas} descripcion="Red del ejemplo: A, luego B y C en paralelo, luego D. Duración normal 12." />
        </Figure>
        <p>
          Con las duraciones normales el proyecto dura 12 días y el costo directo es 10 + 20 + 20 + 15 = 65. El costo indirecto es 12 × 12 = 144, así que el costo total es 209.
        </p>
      </Section>

      <Section title="Reducir la duración paso a paso">
        <ol>
          <li>Calcula la pendiente de cada actividad.</li>
          <li>Halla la ruta crítica con las duraciones actuales.</li>
          <li>Acorta la actividad crítica de menor pendiente, siempre que todavía se pueda acortar. Acortar una actividad que no es crítica no baja la duración del proyecto.</li>
          <li>Acórtala hasta que llegue a su duración límite o hasta que otra ruta se vuelva crítica; lo que ocurra primero.</li>
          <li>Recalcula la duración, el costo directo y el costo total, y repite.</li>
        </ol>
        <p>En el ejemplo:</p>
        <ul className="defs">
          <li>
            <strong>De 12 a 10.</strong> En las dos rutas críticas está A, con pendiente 10 (la más barata de las que están en ambas). Se acorta A dos días, hasta su límite. El costo directo sube a 65 + 10 × 2 = 85.
          </li>
          <li>
            <strong>De 10 a 8.</strong> A ya no se puede acortar y D tampoco. Quedan B (20) y C (10), que están en rutas distintas: hay que acortar las dos a la vez. Cuesta 20 + 10 = 30 por día. El costo directo sube a 85 + 30 × 2 = 145.
          </li>
        </ul>
        <Callout tone="ojo" title="Varias rutas críticas a la vez">
          Si hay dos rutas críticas y solo acortas la actividad más barata de una, la otra sigue durando lo mismo y el proyecto no baja. Hay que acortar al menos una actividad en cada ruta crítica: se busca el conjunto de actividades que corta todas las rutas críticas al menor costo (un corte mínimo). Puede ser una sola actividad que esté en todas las rutas, o varias, una por ruta. Si hay varias opciones se elige la de menor suma de pendientes.
        </Callout>
        <Figure caption="Figura 3. Red del ejemplo con duración 10. A llegó a su límite. Las dos rutas siguen siendo críticas, así que se acortan B y C juntas (en azul).">
          <RedCostos red={red} d={d10} acortadas={['B', 'C']} descripcion="Red del ejemplo con duración 10; B y C se acortan juntas." />
        </Figure>
        <Callout tone="nota" title="Cuando conviene deshacer una reducción">
          En redes más complejas, el corte más barato puede incluir alargar una actividad que ya se había acortado: se pierde un poco de tiempo en ella, pero se recupera su costo. El paso a paso del sitio lo muestra en el ejemplo «Con alargue».
        </Callout>
      </Section>

      <Section title="Costo total y duración óptima">
        <p>
          Cada día que se acorta cuesta la pendiente del corte y ahorra el costo indirecto por día (aquí, 12). Conviene reducir mientras la pendiente sea menor que ese ahorro; cuando es mayor, el costo total vuelve a subir.
        </p>
        <table className="mini-table">
          <thead>
            <tr><th>Duración</th><th>Costo directo</th><th>Costo indirecto (12 × T)</th><th>Costo total</th></tr>
          </thead>
          <tbody>
            {res.estados.map((e) => (
              <tr key={e.T}>
                <td>{e.T}</td><td>{e.directo}</td><td>{e.indirecto}</td><td>{e.T === res.optimo.T ? <strong>{e.total} (mínimo)</strong> : e.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          De 12 a 10 cada día cuesta 10 y ahorra 12: conviene. De 10 a 9 cuesta 30 y ahorra 12: ya no. La duración de costo mínimo es 10 días, con costo total 205.
        </p>
        <Figure caption="Figura 4. Curva costo-duración del ejemplo. El costo directo (negro) baja al alargar el proyecto; el indirecto (discontinuo) sube; el total (azul) tiene su mínimo en 10 días (rojo).">
          <CurvaCostos res={res} />
        </Figure>
        <Formula>costo total = costo directo + (costo indirecto por unidad) × duración (+ costo fijo)</Formula>
        <p>
          Un costo indirecto fijo no cambia cuál es la mejor duración; solo suma una constante al costo total.
        </p>
      </Section>

      <Section title="Errores frecuentes">
        <ol>
          <li><strong>Acortar una actividad barata que no es crítica.</strong> No baja la duración del proyecto: solo gasta dinero.</li>
          <li><strong>Acortar solo una ruta cuando hay varias críticas.</strong> Hay que cortar todas.</li>
          <li><strong>Pasarse del límite.</strong> Una actividad no puede durar menos que DL.</li>
          <li><strong>Seguir reduciendo cuando la pendiente supera el ahorro indirecto.</strong> El costo total sube.</li>
          <li><strong>Olvidar el costo indirecto al comparar.</strong> El costo directo solo siempre es menor con las duraciones normales.</li>
        </ol>
      </Section>

      <Section title="Pruébalo">
        <ul className="defs">
          <li><a href={hrefTopic('redes-costos', 'paso')}>Paso a paso</a>: ves cada reducción, la red y la curva avanzar.</li>
          <li><a href={hrefTopic('redes-costos', 'resuelve')}>Resuelve el tuyo</a>: escribes tus actividades y obtienes pendientes, reducciones y curva.</li>
          <li><a href={hrefTopic('redes-costos', 'practica')}>Práctica</a>: ejercicios con corrección.</li>
        </ul>
        <p>
          <strong>Fuentes:</strong> Taha, H. A., <em>Investigación de operaciones</em>, 7.ª ed. (métodos de redes: PERT/COSTO); Hillier, F. S. y Lieberman, G. J., <em>Introducción a la investigación de operaciones</em>, 7.ª ed. (intercambio tiempo-costo en la administración de proyectos). Esta pestaña usa notación propia (DN, DL, CN, CL); se ajusta a la del curso cuando se tenga el material.
        </p>
      </Section>
    </Article>
  );
}
