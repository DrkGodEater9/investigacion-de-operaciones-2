import { Article, Section, Callout, Figure, Formula } from '@/ui/Article.jsx';
import { hrefTopic } from '@/app/router.js';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";
const BLUE = '#1d3f8f';

/* ==========================================================================
   Escala de las figuras 1 y 2: origen en el píxel (60, 370),
   90 px por unidad en x1 y 75 px por unidad en x2.
   ========================================================================== */
const OX = 60;
const OY = 370;
const SX = 90;
const SY = 75;
const px = (x1) => OX + x1 * SX;
const py = (x2) => OY - x2 * SY;

const halo = {
  paintOrder: 'stroke',
  stroke: '#fff',
  strokeWidth: 3.5,
  strokeLinejoin: 'round',
};

function Label({ x, y, anchor = 'start', fill = '#000', weight, children }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontFamily={SERIF}
      fontSize="15"
      fill={fill}
      fontWeight={weight}
      {...halo}
    >
      {children}
    </text>
  );
}

/** Ejes, rejilla suave, relajación y rectas de restricción (comunes a las figuras 1 y 2). */
function MarcoBase() {
  const xs = [0, 1, 2, 3, 4, 5, 6];
  const ys = [0, 1, 2, 3, 4];
  return (
    <g>
      {xs.slice(1).map((t) => (
        <line key={'gx' + t} x1={px(t)} y1={py(0)} x2={px(t)} y2={py(4.5)} stroke="#000" strokeOpacity="0.12" strokeWidth="0.8" strokeDasharray="2 3" />
      ))}
      {ys.slice(1).map((t) => (
        <line key={'gy' + t} x1={px(0)} y1={py(t)} x2={px(6)} y2={py(t)} stroke="#000" strokeOpacity="0.12" strokeWidth="0.8" strokeDasharray="2 3" />
      ))}

      {/* Ejes */}
      <line x1={px(0)} y1={py(0)} x2={px(6.1)} y2={py(0)} stroke="#000" strokeWidth="1.2" />
      <polygon points={`${px(6.1) + 8},${py(0)} ${px(6.1)},${py(0) - 3.5} ${px(6.1)},${py(0) + 3.5}`} fill="#000" />
      <text x={px(6.1) - 6} y={py(0) - 8} textAnchor="end" fontFamily={SERIF} fontSize="15" fontStyle="italic">x₁</text>
      <line x1={px(0)} y1={py(0)} x2={px(0)} y2={py(4.6)} stroke="#000" strokeWidth="1.2" />
      <polygon points={`${px(0)},${py(4.6) - 8} ${px(0) - 3.5},${py(4.6)} ${px(0) + 3.5},${py(4.6)}`} fill="#000" />
      <text x={px(0) + 8} y={py(4.6) + 6} fontFamily={SERIF} fontSize="15" fontStyle="italic">x₂</text>

      {xs.map((t) => (
        <g key={'tx' + t}>
          <line x1={px(t)} y1={py(0)} x2={px(t)} y2={py(0) + 5} stroke="#000" strokeWidth="1" />
          <text x={px(t)} y={py(0) + 20} textAnchor="middle" fontFamily={SERIF} fontSize="14">{t}</text>
        </g>
      ))}
      {ys.slice(1).map((t) => (
        <g key={'ty' + t}>
          <line x1={px(0) - 5} y1={py(t)} x2={px(0)} y2={py(t)} stroke="#000" strokeWidth="1" />
          <text x={px(0) - 9} y={py(t) + 5} textAnchor="end" fontFamily={SERIF} fontSize="14">{t}</text>
        </g>
      ))}

      {/* Región de la relajación: (0,0), (5,0), (9/2, 7/2), (0,2) */}
      <polygon
        points={`${px(0)},${py(0)} ${px(5)},${py(0)} ${px(4.5)},${py(3.5)} ${px(0)},${py(2)}`}
        fill="#f6f6f6"
        stroke="#000"
        strokeWidth="1.2"
      />

      {/* −x1 + 3x2 = 6 (prolongada hasta x1 = 6) */}
      <line x1={px(0)} y1={py(2)} x2={px(6)} y2={py(4)} stroke="#000" strokeWidth="1" />
      <Label x={px(6)} y={py(4) - 14} anchor="end">−x₁ + 3x₂ = 6</Label>

      {/* 7x1 + x2 = 35 (de x2 = 0 a x2 = 4,5) */}
      <line x1={px(5)} y1={py(0)} x2={px(35 / 7 - 4.5 / 7)} y2={py(4.5)} stroke="#000" strokeWidth="1" />
      <Label x={px(5) + 10} y={py(0.8)}>7x₁ + x₂ = 35</Label>
    </g>
  );
}

/** Los dos puntos notables, con sus rótulos. */
function PuntosNotables() {
  return (
    <g>
      <line x1={px(4.5) - 6} y1={py(3.5) - 6} x2={px(4.5) - 26} y2={py(3.5) - 22} stroke="#000" strokeWidth="0.8" />
      <Label x={px(4.5) - 28} y={py(3.5) - 34} anchor="end">relajación:</Label>
      <Label x={px(4.5) - 28} y={py(3.5) - 17} anchor="end">(9/2, 7/2), Z = 63</Label>
      <circle cx={px(4.5)} cy={py(3.5)} r="5" fill="#fff" stroke="#000" strokeWidth="1.4" />

      <circle cx={px(32 / 7)} cy={py(3)} r="5.5" fill={BLUE} stroke={BLUE} />
      <Label x={px(32 / 7) + 12} y={py(3) - 2} fill={BLUE} weight="600">óptimo mixto:</Label>
      <Label x={px(32 / 7) + 12} y={py(3) + 15} fill={BLUE} weight="600">(32/7, 3), Z = 59</Label>
    </g>
  );
}

/** Figura 1: relajación y puntos factibles del problema mixto. */
function FiguraRegionMixta() {
  const segs = [
    [0, 0, 5],
    [1, 0, 34 / 7],
    [2, 0, 33 / 7],
    [3, 3, 32 / 7],
  ];
  return (
    <svg
      viewBox="0 0 640 420"
      role="img"
      aria-label="Región de la relajación con vértices (0,0), (5,0), (9/2, 7/2) y (0,2). Con x2 entera, lo factible son segmentos horizontales en x2 igual a 0, 1, 2 y 3. El óptimo mixto está en (32/7, 3) con Z igual a 59."
      style={{ width: '100%', maxWidth: 640 }}
    >
      <MarcoBase />
      {/* Recta objetivo 7x1 + 9x2 = 59 por el óptimo mixto */}
      <line x1={px((59 - 40.5) / 7)} y1={py(4.5)} x2={px(6)} y2={py((59 - 42) / 9)} stroke="#000" strokeWidth="1.1" strokeDasharray="6 4" />
      <Label x={px(6) - 4} y={py(1.1)} anchor="end">7x₁ + 9x₂ = 59</Label>
      {segs.map(([k, a, b]) => (
        <line key={'seg' + k} x1={px(a)} y1={py(k)} x2={px(b)} y2={py(k)} stroke={BLUE} strokeWidth="4" strokeLinecap="butt" />
      ))}
      <PuntosNotables />
    </svg>
  );
}

/** Figura 2: el corte x2 ≤ 3 y la zona que elimina. */
function FiguraCorte() {
  return (
    <svg
      viewBox="0 0 640 420"
      role="img"
      aria-label="La misma región con la recta x2 igual a 3 como corte. El triángulo con vértices (3,3), (32/7,3) y (9/2, 7/2) queda eliminado."
      style={{ width: '100%', maxWidth: 640 }}
    >
      <defs>
        <pattern id="rayado-corte" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#000" strokeWidth="0.8" />
        </pattern>
      </defs>
      <MarcoBase />
      <polygon
        points={`${px(3)},${py(3)} ${px(32 / 7)},${py(3)} ${px(4.5)},${py(3.5)}`}
        fill="url(#rayado-corte)"
        stroke="#000"
        strokeWidth="0.8"
      />
      <line x1={px(0)} y1={py(3)} x2={px(6)} y2={py(3)} stroke={BLUE} strokeWidth="1.6" strokeDasharray="7 4" />
      <Label x={px(0) + 10} y={py(3) - 8} fill={BLUE} weight="600">corte: x₂ ≤ 3</Label>
      <line x1={px(3.6)} y1={py(3.2)} x2={px(2.6)} y2={py(3.75)} stroke="#000" strokeWidth="0.8" />
      <Label x={px(2.6) - 4} y={py(3.75) - 2} anchor="end">zona eliminada</Label>
      <PuntosNotables />
    </svg>
  );
}

/** Figura 3: árbol de ramificación del ejemplo. */
function FiguraArbol() {
  const T = (x, y, txt, extra = {}) => (
    <text x={x} y={y} textAnchor="middle" fontFamily={SERIF} fontSize="14" {...extra}>
      {txt}
    </text>
  );
  return (
    <svg
      viewBox="0 0 460 250"
      role="img"
      aria-label="Árbol de ramificación: la raíz número 1 con Z igual a 63 ramifica en x2. La rama x2 menor o igual a 3 da el nodo 2 con Z igual a 59, solución entera. La rama x2 mayor o igual a 4 da el nodo 3, infactible."
      style={{ width: '100%', maxWidth: 520 }}
    >
      {/* Raíz */}
      <rect x="95" y="8" width="270" height="62" rx="3" fill="#fff" stroke="#000" strokeWidth="1.3" />
      {T(230, 27, '#1 · Z = 63', { fontWeight: 600 })}
      {T(230, 44, 'x₁ = 9/2, x₂ = 7/2')}
      {T(230, 61, 'ramifica en x₂')}

      {/* Aristas */}
      <line x1="170" y1="70" x2="112" y2="140" stroke="#000" strokeWidth="1.2" />
      <line x1="290" y1="70" x2="348" y2="140" stroke="#000" strokeWidth="1.2" />
      <text x="128" y="100" textAnchor="end" fontFamily={SERIF} fontSize="14" fill={BLUE} fontWeight="600" {...halo}>x₂ ≤ 3</text>
      <text x="332" y="100" textAnchor="start" fontFamily={SERIF} fontSize="14" fill={BLUE} fontWeight="600" {...halo}>x₂ ≥ 4</text>

      {/* Hijo izquierdo: incumbente */}
      <rect x="4" y="140" width="216" height="92" rx="3" fill="#fff" stroke={BLUE} strokeWidth="2.4" />
      {T(112, 160, '#2 · x₂ ≤ 3', { fontWeight: 600 })}
      {T(112, 178, 'Z = 59')}
      {T(112, 196, 'x = (32/7, 3)')}
      {T(112, 217, 'entera: mejor hasta ahora', { fill: BLUE, fontWeight: 600 })}

      {/* Hijo derecho: infactible */}
      <rect x="240" y="140" width="216" height="92" rx="3" fill="#fff" stroke="#000" strokeWidth="1.3" strokeDasharray="6 4" />
      {T(348, 160, '#3 · x₂ ≥ 4', { fontWeight: 600 })}
      {T(348, 190, 'infactible', { fontWeight: 600 })}
      {T(348, 210, '(pide x₁ ≥ 6 y 7x₁ ≤ 31)')}
    </svg>
  );
}

/* ==========================================================================
   Componente principal
   ========================================================================== */
export default function Teoria() {
  return (
    <Article>
      <Section title="Qué es la programación entera mixta">
        <p>
          Es un problema de programación lineal (función objetivo y restricciones lineales, variables ≥ 0) en el que solo <em>algunas</em> variables deben ser enteras; las demás son continuas. En texto, la forma general es: maximizar o minimizar <em>Z</em> = <em>c</em>·<em>x</em> sujeto a <em>A</em>·<em>x</em> ≤ <em>b</em>, <em>x</em> ≥ 0, y <em>x</em><sub><em>j</em></sub> entera para <em>j</em> en un subconjunto <em>I</em> de las variables.
        </p>
        <p>Según cuántas variables exijan ser enteras, hay tres casos:</p>
        <ul className="defs">
          <li><strong>Ninguna.</strong> Programación lineal.</li>
          <li><strong>Todas.</strong> Programación entera pura (<a href={hrefTopic('entera-pura')}>tema 1.1</a>).</li>
          <li><strong>Algunas.</strong> Programación entera mixta, que es este tema. Las binarias son enteras que solo toman los valores 0 o 1 (<a href={hrefTopic('entera-binaria')}>tema 1.3</a>).</li>
        </ul>
        <p>
          Una variable es entera cuando lo que representa no se puede fraccionar: camiones que se despachan, operarios que se contratan, máquinas que se compran, cubículos que se construyen. Es continua cuando representa algo que se mide: litros de jugo, kilos de harina, metros cuadrados de vidrio, horas asignadas.
        </p>
      </Section>

      <Section title="Relajación lineal y cota">
        <p>
          <strong>Relajar</strong> es ignorar la condición de que algunas variables sean enteras y resolver el problema lineal que queda. Como el conjunto factible del problema mixto está contenido en el de la relajación, en un problema de maximizar el óptimo mixto no puede superar el de la relajación, y en uno de minimizar no puede ser menor. Por eso la relajación da una <strong>cota</strong>.
        </p>
        <p>
          Si en la solución de la relajación las variables enteras ya salen enteras, esa solución también es la óptima del problema mixto.
        </p>
        <Callout tone="ojo" title="Redondear no sirve">
          Con el ejemplo de abajo, la relajación da <em>x</em>₂ = 7/2. Redondear a <em>x</em>₂ = 4 vuelve infactible el problema: pide <em>x</em>₁ ≥ 6 y 7<em>x</em>₁ ≤ 31. Y fijar <em>x</em>₂ = 3 no basta: hay que volver a optimizar <em>x</em>₁, que es continua, y sale <em>x</em>₁ = 32/7, no 9/2. Las continuas se recalculan; no se redondean.
        </Callout>
      </Section>

      <Section title="Ejemplo que usaremos">
        <Formula>
          Maximizar <em>Z</em> = 7<em>x</em>₁ + 9<em>x</em>₂
        </Formula>
        <Formula>
          −<em>x</em>₁ + 3<em>x</em>₂ ≤ 6 &nbsp;&nbsp; 7<em>x</em>₁ + <em>x</em>₂ ≤ 35 &nbsp;&nbsp; <em>x</em>₁, <em>x</em>₂ ≥ 0 &nbsp;&nbsp; <em>x</em>₂ entera (<em>x</em>₁ continua)
        </Formula>
        <p>
          La relajación da <em>Z</em> = 63 en (<em>x</em>₁, <em>x</em>₂) = (9/2, 7/2). Como <em>x</em>₂ = 7/2 no es entera, ese punto no sirve para el problema mixto.
        </p>
        <Figure caption="Figura 1. Región de la relajación y puntos factibles del problema mixto: los segmentos azules en x₂ = 0, 1, 2 y 3.">
          <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 520 }}><FiguraRegionMixta /></div></div>
        </Figure>
        <Callout tone="nota" title="Qué dibujar en un problema mixto">
          Si una variable es entera, lo factible son segmentos paralelos al otro eje, no el polígono completo. El óptimo está en uno de esos segmentos y no necesariamente en un vértice del polígono: aquí es (32/7, 3), que no es vértice de la relajación.
        </Callout>
      </Section>

      <Section title="Ramificación y acotamiento (Branch & Bound)">
        <ol>
          <li>Resuelve la relajación. Si las variables enteras salen enteras, terminaste.</li>
          <li>Si no, escoge una variable <strong>entera</strong> con valor fraccionario <em>v</em> (las continuas nunca se ramifican, aunque salgan fraccionarias). Crea dos subproblemas: uno con <em>x</em><sub><em>j</em></sub> ≤ ⌊<em>v</em>⌋ y otro con <em>x</em><sub><em>j</em></sub> ≥ ⌈<em>v</em>⌉. Entre esos dos valores no hay enteros, así que no se pierde ninguna solución entera.</li>
          <li>Resuelve cada subproblema (es una relajación con una restricción más). Cada uno se poda o se sigue ramificando.</li>
        </ol>
        <Callout tone="regla" title="Cuándo se poda un nodo">
          <ul>
            <li><strong>(a) Infactible:</strong> no tiene puntos factibles.</li>
            <li><strong>(b) Por cota:</strong> su <em>Z</em> no mejora al mejor valor entero ya encontrado, el incumbente <em>Z</em>*. En maximizar, <em>Z</em> ≤ <em>Z</em>*; en minimizar, <em>Z</em> ≥ <em>Z</em>*.</li>
            <li><strong>(c) Entera:</strong> da una solución con las variables enteras enteras. Se guarda como nuevo incumbente si mejora.</li>
          </ul>
        </Callout>
        <p>
          En el ejemplo, la raíz (#1) tiene <em>Z</em> = 63 y <em>x</em> = (9/2, 7/2); ramifica en <em>x</em>₂. La rama <em>x</em>₂ ≤ 3 da el nodo #2: <em>Z</em> = 59, <em>x</em> = (32/7, 3). Su <em>x</em>₂ es entera, así que es el incumbente; <em>x</em>₁ puede quedar fraccionaria porque es continua. La rama <em>x</em>₂ ≥ 4 da el nodo #3, infactible. El óptimo mixto es <em>Z</em> = 59 con <em>x</em>₁ = 32/7 ≈ 4,571 y <em>x</em>₂ = 3. Se visita primero la rama ≤ y luego la ≥; es una convención del sitio y se puede cambiar en la herramienta.
        </p>
        <Figure caption="Figura 3. Árbol de ramificación del ejemplo. El estado de cada nodo también está escrito, no solo marcado con el trazo.">
          <FiguraArbol />
        </Figure>
        <p>
          Para contrastar, mira qué pasa si <em>x</em>₁ también fuera entera (caso puro). Aquí aparece una poda por cota:
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="mini-table">
            <thead>
              <tr>
                <th>Nodo</th>
                <th>Restricciones añadidas</th>
                <th><em>Z</em></th>
                <th>Solución</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>#1</td><td>—</td><td>63</td><td>(9/2, 7/2)</td><td>ramifica en <em>x</em>₁</td></tr>
              <tr><td>#2</td><td><em>x</em>₁ ≤ 4</td><td>58</td><td>(4, 10/3)</td><td>ramifica en <em>x</em>₂</td></tr>
              <tr><td>#3</td><td><em>x</em>₁ ≤ 4 y <em>x</em>₂ ≤ 3</td><td>55</td><td>(4, 3)</td><td>entera: incumbente</td></tr>
              <tr><td>#4</td><td><em>x</em>₁ ≤ 4 y <em>x</em>₂ ≥ 4</td><td>—</td><td>—</td><td>infactible</td></tr>
              <tr><td>#5</td><td><em>x</em>₁ ≥ 5</td><td>35</td><td>(5, 0)</td><td>podado por cota (35 ≤ 55)</td></tr>
            </tbody>
          </table>
        </div>
        <p>Óptimo entero puro: <em>Z</em> = 55, <em>x</em> = (4, 3).</p>
      </Section>

      <Section title="Planos de corte de Gomory">
        <p>
          En vez de ramificar, este método agrega una restricción (un <strong>corte</strong>) que elimina el óptimo fraccionario de la relajación sin quitar ningún punto factible del problema mixto. Se resuelve de nuevo y se repite hasta que las variables enteras salgan enteras. Los pasos son:
        </p>
        <ol>
          <li>En el tablero óptimo de la relajación, toma una variable entera básica con valor fraccionario y su fila.</li>
          <li>Escribe cada coeficiente y la constante de esa fila como entero más una fracción entre 0 y 1; deja a la izquierda los términos fraccionarios y a la derecha los enteros.</li>
          <li>Como la parte fraccionaria de la izquierda no puede ser negativa y el lado derecho entero queda acotado, se obtiene la nueva restricción.</li>
          <li>Agrégala al tablero con una variable de holgura <em>S</em> y lado derecho negativo. Eso rompe la factibilidad pero conserva la optimalidad, así que se resuelve con el simplex dual: sale la variable con <em>b</em> negativo y entra la que tenga el menor |(<em>C</em><sub><em>j</em></sub> − <em>Z</em><sub><em>j</em></sub>) / elemento de la fila|.</li>
        </ol>

        <p><strong>Con los números del ejemplo.</strong> Tablero óptimo de la relajación:</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="mini-table">
            <thead>
              <tr>
                <th><em>C</em><sub><em>j</em></sub></th>
                <th></th>
                <th>7</th><th>9</th><th>0</th><th>0</th>
                <th></th>
              </tr>
              <tr>
                <th>V.B.</th>
                <th><em>C</em><sub><em>B</em></sub></th>
                <th><em>x</em>₁</th><th><em>x</em>₂</th><th><em>x</em>₃</th><th><em>x</em>₄</th>
                <th><em>b</em><sub><em>j</em></sub></th>
              </tr>
            </thead>
            <tbody>
              <tr><td><em>x</em>₂</td><td>9</td><td>0</td><td>1</td><td>7/22</td><td>1/22</td><td>7/2</td></tr>
              <tr><td><em>x</em>₁</td><td>7</td><td>1</td><td>0</td><td>−1/22</td><td>3/22</td><td>9/2</td></tr>
              <tr><td><em>Z</em><sub><em>j</em></sub></td><td></td><td>7</td><td>9</td><td>28/11</td><td>15/11</td><td><em>Z</em> = 63</td></tr>
              <tr><td><em>C</em><sub><em>j</em></sub> − <em>Z</em><sub><em>j</em></sub></td><td></td><td>0</td><td>0</td><td>−28/11</td><td>−15/11</td><td></td></tr>
            </tbody>
          </table>
        </div>
        <p>
          La fila de <em>x</em>₂ dice <em>x</em>₂ + 7/22·<em>x</em>₃ + 1/22·<em>x</em>₄ = 7/2. Escrita como entero más fracción: <em>x</em>₂ + (0 + 7/22)<em>x</em>₃ + (0 + 1/22)<em>x</em>₄ = 3 + 1/2. Con <em>f</em><sub>0</sub> = 1/2, el corte es
        </p>
        <Formula>7/22·<em>x</em>₃ + 1/22·<em>x</em>₄ ≥ 1/2</Formula>
        <p>
          Como ecuación: <em>S</em>₁ − 7/22·<em>x</em>₃ − 1/22·<em>x</em>₄ = −1/2. En el dual sale <em>S</em>₁. Las razones son |(−28/11)/(−7/22)| = 8 para <em>x</em>₃ y |(−15/11)/(−1/22)| = 30 para <em>x</em>₄; entra <em>x</em>₃. El tablero final queda:
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="mini-table">
            <thead>
              <tr>
                <th>V.B.</th>
                <th><em>x</em>₁</th><th><em>x</em>₂</th><th><em>x</em>₃</th><th><em>x</em>₄</th><th><em>S</em>₁</th>
                <th><em>b</em><sub><em>j</em></sub></th>
              </tr>
            </thead>
            <tbody>
              <tr><td><em>x</em>₂</td><td>0</td><td>1</td><td>0</td><td>0</td><td>1</td><td>3</td></tr>
              <tr><td><em>x</em>₁</td><td>1</td><td>0</td><td>0</td><td>1/7</td><td>−1/7</td><td>32/7</td></tr>
              <tr><td><em>x</em>₃</td><td>0</td><td>0</td><td>1</td><td>1/7</td><td>−22/7</td><td>11/7</td></tr>
              <tr><td><em>C</em><sub><em>j</em></sub> − <em>Z</em><sub><em>j</em></sub></td><td>0</td><td>0</td><td>0</td><td>−1</td><td>−8</td><td><em>Z</em> = 59</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Solución: <em>x</em>₁ = 32/7, <em>x</em>₂ = 3, <em>x</em>₃ = 11/7, <em>x</em>₄ = 0, <em>Z</em> = 59. La misma del árbol.
        </p>
        <Callout tone="nota" title="Qué corta realmente">
          Como <em>x</em>₃ = 6 + <em>x</em>₁ − 3<em>x</em>₂ y <em>x</em>₄ = 35 − 7<em>x</em>₁ − <em>x</em>₂, al sustituir queda 7/22·<em>x</em>₃ + 1/22·<em>x</em>₄ = 7/2 − <em>x</em>₂. Entonces el corte 7/2 − <em>x</em>₂ ≥ 1/2 equivale a <em>x</em>₂ ≤ 3: exactamente la rama <em>x</em>₂ ≤ 3 del otro método.
        </Callout>
        <Figure caption="Figura 2. El corte x₂ ≤ 3 elimina el triángulo de vértices (3, 3), (32/7, 3) y (9/2, 7/2), donde estaba el óptimo de la relajación.">
          <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 520 }}><FiguraCorte /></div></div>
        </Figure>

        <Callout tone="ojo" title="Cuándo vale la fórmula con las partes fraccionarias">
          <p>
            La fórmula del profesor (la parte fraccionaria de cada coeficiente) es la de la programación entera pura: vale cuando <em>todas</em> las variables de la fila, holguras incluidas, son enteras. En este ejemplo da el resultado correcto porque las no básicas (<em>x</em>₃, <em>x</em>₄) son continuas con coeficientes positivos menores que 1, y en ese caso coincide con el corte mixto de Gomory. En general no es así.
          </p>
          <p>
            Para una fila <em>x</em><sub><em>B</em></sub> + Σ <em>a</em><sub><em>j</em></sub><em>x</em><sub><em>j</em></sub> = <em>b</em>, sea <em>f</em><sub>0</sub> la parte fraccionaria de <em>b</em> y <em>f</em><sub><em>j</em></sub> la de <em>a</em><sub><em>j</em></sub>. El corte mixto es Σ <em>c</em><sub><em>j</em></sub><em>x</em><sub><em>j</em></sub> ≥ <em>f</em><sub>0</sub>, con:
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="mini-table">
              <thead>
                <tr><th>Variable <em>x</em><sub><em>j</em></sub></th><th>Condición</th><th>Coeficiente <em>c</em><sub><em>j</em></sub></th></tr>
              </thead>
              <tbody>
                <tr><td>entera</td><td><em>f</em><sub><em>j</em></sub> ≤ <em>f</em><sub>0</sub></td><td><em>f</em><sub><em>j</em></sub></td></tr>
                <tr><td>entera</td><td><em>f</em><sub><em>j</em></sub> &gt; <em>f</em><sub>0</sub></td><td><em>f</em><sub>0</sub>(1 − <em>f</em><sub><em>j</em></sub>) / (1 − <em>f</em><sub>0</sub>)</td></tr>
                <tr><td>continua</td><td><em>a</em><sub><em>j</em></sub> &gt; 0</td><td><em>a</em><sub><em>j</em></sub></td></tr>
                <tr><td>continua</td><td><em>a</em><sub><em>j</em></sub> &lt; 0</td><td><em>f</em><sub>0</sub>(−<em>a</em><sub><em>j</em></sub>) / (1 − <em>f</em><sub>0</sub>)</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            Por qué importa: con <em>x</em><sub><em>B</em></sub> + (5/4)<em>s</em> = 1/2 y <em>s</em> continua, la fórmula con partes fraccionarias daría el corte (1/4)<em>s</em> ≥ 1/2, que descartaría el punto factible <em>s</em> = 2/5. El corte mixto da (5/4)<em>s</em> ≥ 1/2.
          </p>
        </Callout>

        <h3>Continuación a entera pura</h3>
        <p>
          <strong>No aplica a la mixta: <em>x</em>₁ es continua.</strong> Si <em>x</em>₁ también tuviera que ser entera, <em>x</em>₁ = 32/7 sería fraccionaria (parte 4/7). Su fila es <em>x</em>₁ + 1/7·<em>x</em>₄ − 1/7·<em>S</em>₁ = 32/7, y el coeficiente de <em>S</em>₁ es −1/7 = −1 + 6/7. El corte es
        </p>
        <Formula>1/7·<em>x</em>₄ + 6/7·<em>S</em>₁ ≥ 4/7</Formula>
        <p>
          Como ecuación: <em>S</em>₂ − 1/7·<em>x</em>₄ − 6/7·<em>S</em>₁ = −4/7. En las variables originales es <em>x</em>₁ + <em>x</em>₂ ≤ 7. En el dual sale <em>S</em>₂; las razones son |(−1)/(−1/7)| = 7 para <em>x</em>₄ y |(−8)/(−6/7)| = 28/3 para <em>S</em>₁; entra <em>x</em>₄. Resultado: <em>x</em>₁ = 4, <em>x</em>₂ = 3, <em>x</em>₃ = 1, <em>x</em>₄ = 4, <em>Z</em> = 55, el mismo del árbol puro. Aquí la fórmula fraccional sí es válida, porque todas las variables son enteras.
        </p>
      </Section>

      <Section title="Cuál método usar">
        <div style={{ overflowX: 'auto' }}>
          <table className="mini-table">
            <thead>
              <tr><th></th><th>Ramificación y acotamiento</th><th>Planos de corte</th></tr>
            </thead>
            <tbody>
              <tr><td>Idea</td><td>Dividir el problema en dos subproblemas</td><td>Agregar una restricción que corta el óptimo fraccionario</td></tr>
              <tr><td>Qué se resuelve cada vez</td><td>Una relajación con una cota más</td><td>El mismo tablero con una fila nueva, con simplex dual</td></tr>
              <tr><td>Variables que se tocan</td><td>Solo las enteras fraccionarias</td><td>Solo las enteras fraccionarias; las continuas aportan al corte con su coeficiente</td></tr>
              <tr><td>Se detiene cuando</td><td>Las enteras salen enteras o todo está podado</td><td>Las variables enteras salen enteras</td></tr>
              <tr><td>Con el ejemplo</td><td>3 nodos, <em>Z</em> = 59</td><td>1 corte, <em>Z</em> = 59</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          En la práctica los programas combinan los dos (ramificar y cortar), pero en el curso se estudian por separado.
        </p>
      </Section>

      <Section title="Resumen">
        <ol>
          <li>La mixta pide enteras solo algunas variables; las continuas se recalculan, nunca se redondean.</li>
          <li>La relajación lineal da una cota: no puede ser peor que el óptimo mixto.</li>
          <li>Ramificar y acotar solo ramifica variables enteras fraccionarias y poda por infactibilidad, por cota o por solución entera.</li>
          <li>Un corte de Gomory elimina el óptimo fraccionario; en la mixta hay que usar el corte mixto, no el de partes fraccionarias.</li>
        </ol>
      </Section>

      <Section title="Pruébalo">
        <ul className="defs">
          <li><a href={hrefTopic('entera-mixta', 'paso')}>Paso a paso</a>: recorre el ejemplo del profesor tablero por tablero, con el corte incluido.</li>
          <li><a href={hrefTopic('entera-mixta', 'resuelve')}>Resuelve el tuyo</a>: escribe tu modelo, marca cuáles variables son enteras y míralo resuelto con cualquiera de los dos métodos.</li>
          <li><a href={hrefTopic('entera-mixta', 'practica')}>Práctica</a>: ejercicios generados al azar para comprobar que dominas cada paso.</li>
        </ul>
        <p>
          <strong>Fuentes:</strong> Taha, H. A., <em>Investigación de operaciones</em>, 7.ª ed.; Hillier, F. S. y Lieberman, G. J., <em>Introducción a la investigación de operaciones</em>, 7.ª ed.
        </p>
      </Section>
    </Article>
  );
}
