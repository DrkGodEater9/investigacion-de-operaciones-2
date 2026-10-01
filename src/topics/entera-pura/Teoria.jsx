import { Article, Section, Callout, Figure, Formula } from '@/ui/Article.jsx';
import { hrefTopic } from '@/app/router.js';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";

/* ==========================================================================
   Constantes geométricas para las figuras de la región factible (ejes 0 a 6)
   ========================================================================== */
const S = 58;       // Escala: px por unidad en ambos ejes
const OX = 44;      // Origen X en el SVG
const OY = 380;     // Origen Y en el SVG (x2 = 0)
const toX = (val) => OX + val * S;
const toY = (val) => OY - val * S;

// Los 19 puntos enteros factibles del problema
const INTEGER_POINTS = [];
for (let x1 = 0; x1 <= 6; x1++) {
  for (let x2 = 0; x2 <= 6; x2++) {
    if (x1 + x2 <= 5 && 10 * x1 + 6 * x2 <= 45) {
      INTEGER_POINTS.push({ x1, x2 });
    }
  }
}

/**
 * Ejes cartesianos de 0 a 6 con marcas y números en serif.
 */
function CoordinateAxes() {
  const ticks = [0, 1, 2, 3, 4, 5, 6];
  return (
    <g>
      {/* Rejilla suave de fondo (negra con opacidad baja) */}
      {ticks.slice(1).map((t) => (
        <g key={`grid-${t}`} stroke="#000" strokeOpacity="0.15" strokeWidth="0.8" strokeDasharray="2 3">
          <line x1={toX(t)} y1={toY(0)} x2={toX(t)} y2={toY(6.2)} />
          <line x1={toX(0)} y1={toY(t)} x2={toX(6.2)} y2={toY(t)} />
        </g>
      ))}

      {/* Eje X1 */}
      <line x1={toX(0)} y1={toY(0)} x2={toX(6.3)} y2={toY(0)} stroke="#000" strokeWidth="1.2" />
      <polygon
        points={`${toX(6.35)},${toY(0)} ${toX(6.35) - 8},${toY(0) - 3.5} ${toX(6.35) - 8},${toY(0) + 3.5}`}
        fill="#000"
      />
      <text x={toX(6.35) + 6} y={toY(0) + 4} fontFamily={SERIF} fontSize="14" fontStyle="italic">
        x₁
      </text>

      {/* Eje X2 */}
      <line x1={toX(0)} y1={toY(0)} x2={toX(0)} y2={toY(6.3)} stroke="#000" strokeWidth="1.2" />
      <polygon
        points={`${toX(0)},${toY(6.35)} ${toX(0) - 3.5},${toY(6.35) + 8} ${toX(0) + 3.5},${toY(6.35) + 8}`}
        fill="#000"
      />
      <text
        x={toX(0) - 4}
        y={toY(6.35) - 6}
        textAnchor="middle"
        fontFamily={SERIF}
        fontSize="14"
        fontStyle="italic"
      >
        x₂
      </text>

      {/* Marcas eje X1 */}
      {ticks.map((t) => (
        <g key={`tx-${t}`}>
          <line x1={toX(t)} y1={toY(0)} x2={toX(t)} y2={toY(0) + 4} stroke="#000" strokeWidth="1" />
          <text
            x={toX(t)}
            y={toY(0) + 16}
            textAnchor="middle"
            fontFamily={SERIF}
            fontSize="13"
            fill="#000"
          >
            {t}
          </text>
        </g>
      ))}

      {/* Marcas eje X2 */}
      {ticks.slice(1).map((t) => (
        <g key={`ty-${t}`}>
          <line x1={toX(0) - 4} y1={toY(t)} x2={toX(0)} y2={toY(t)} stroke="#000" strokeWidth="1" />
          <text
            x={toX(0) - 8}
            y={toY(t) + 4}
            textAnchor="end"
            fontFamily={SERIF}
            fontSize="13"
            fill="#000"
          >
            {t}
          </text>
        </g>
      ))}
    </g>
  );
}

/**
 * Figura 1: Región factible relajada, rectas frontera y los 19 puntos enteros.
 */
function FeasibleRegionFigure() {
  return (
    <svg
      viewBox="0 -16 440 431"
      role="img"
      aria-label="La región factible y sus 19 puntos enteros, con el óptimo relajado, el redondeo infactible y el óptimo entero"
      style={{ width: '100%', maxWidth: 440 }}
    >
      <CoordinateAxes />

      {/* Polígono de la región factible relajada */}
      <polygon
        points={`${toX(0)},${toY(0)} ${toX(4.5)},${toY(0)} ${toX(3.75)},${toY(1.25)} ${toX(0)},${toY(5)}`}
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="1.2"
      />

      {/* Recta x1 + x2 = 5 */}
      <line
        x1={toX(-0.1)}
        y1={toY(5.1)}
        x2={toX(5.2)}
        y2={toY(-0.2)}
        stroke="#000000"
        strokeWidth="1.1"
      />
      <text
        x={toX(1.3)}
        y={toY(3.95)}
        fontFamily={SERIF}
        fontSize="13"
        fill="#000"
        paintOrder="stroke"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        x₁ + x₂ = 5
      </text>

      {/* Recta 10x1 + 6x2 = 45 */}
      <line
        x1={toX(0.85)}
        y1={toY(6.08)}
        x2={toX(4.65)}
        y2={toY(-0.25)}
        stroke="#000000"
        strokeWidth="1.1"
      />
      <text
        x={toX(3.1)}
        y={toY(2.65)}
        fontFamily={SERIF}
        fontSize="13"
        fill="#000"
        paintOrder="stroke"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        10x₁ + 6x₂ = 45
      </text>

      {/* Recta Z = 23 (discontinua azul de (0; 5,75) a (4,6; 0)) */}
      <line
        x1={toX(0)}
        y1={toY(5.75)}
        x2={toX(4.6)}
        y2={toY(0)}
        stroke="#1d3f8f"
        strokeWidth="1.5"
        strokeDasharray="6 4"
      />
      <text
        x={toX(0.2)}
        y={toY(5.6)}
        fontFamily={SERIF}
        fontSize="13"
        fill="#1d3f8f"
        fontWeight="600"
        paintOrder="stroke"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        Z = 23 (5x₁ + 4x₂ = 23)
      </text>

      {/* Puntos enteros factibles (19 puntos) */}
      {INTEGER_POINTS.map(({ x1, x2 }) => {
        if (x1 === 3 && x2 === 2) return null; // El óptimo entero se dibuja resaltado
        return (
          <circle
            key={`pt-${x1}-${x2}`}
            cx={toX(x1)}
            cy={toY(x2)}
            r="2.8"
            fill="#000000"
          />
        );
      })}

      {/* Óptimo entero (3, 2): círculo azul con halo blanco en el rótulo */}
      <circle cx={toX(3)} cy={toY(2)} r="5.5" fill="#1d3f8f" stroke="#1d3f8f" />
      <text
        x={toX(3) - 9}
        y={toY(2) - 8}
        textAnchor="end"
        fontFamily={SERIF}
        fontSize="13"
        fill="#1d3f8f"
        fontWeight="600"
        paintOrder="stroke"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        óptimo entero, Z = 23
      </text>

      {/* Óptimo de la relajación (3,75; 1,25): cuadrito */}
      <rect
        x={toX(3.75) - 4.5}
        y={toY(1.25) - 4.5}
        width="9"
        height="9"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="1.4"
      />
      <text
        x={toX(3.75) + 8}
        y={toY(1.25) - 6}
        textAnchor="start"
        fontFamily={SERIF}
        fontSize="13"
        fill="#000"
        paintOrder="stroke"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        (3,75; 1,25)
      </text>
      <text
        x={toX(3.75) + 8}
        y={toY(1.25) + 9}
        textAnchor="start"
        fontFamily={SERIF}
        fontSize="13"
        fill="#000"
        paintOrder="stroke"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        Z = 23,75
      </text>

      {/* Redondeo (4, 1): cruz roja infactible con halo */}
      <g stroke="#b3261e" strokeWidth="2">
        <line x1={toX(4) - 4.5} y1={toY(1) - 4.5} x2={toX(4) + 4.5} y2={toY(1) + 4.5} />
        <line x1={toX(4) - 4.5} y1={toY(1) + 4.5} x2={toX(4) + 4.5} y2={toY(1) - 4.5} />
      </g>
      <text
        x={toX(4) + 8}
        y={toY(1) + 4}
        fontFamily={SERIF}
        fontSize="13"
        fill="#b3261e"
        fontWeight="600"
        paintOrder="stroke"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        (4, 1) infactible
      </text>
    </svg>
  );
}

/**
 * Figura 2: Ramificación en x1 con las rectas x1 <= 3 y x1 >= 4 y la franja tachada.
 */
function BranchingCutFigure() {
  return (
    <svg
      viewBox="0 -16 440 431"
      role="img"
      aria-label="Ramificación en la variable x1: dos ramas x1 menor o igual a 3 y x1 mayor o igual a 4, con la franja sin enteros descartada"
      style={{ width: '100%', maxWidth: 440 }}
    >
      <defs>
        <pattern
          id="hatch-strip"
          width="8"
          height="8"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0" y1="0" x2="0" y2="8" stroke="#b3261e" strokeWidth="0.8" opacity="0.45" />
        </pattern>
      </defs>

      <CoordinateAxes />

      {/* Polígono de la región continua */}
      <polygon
        points={`${toX(0)},${toY(0)} ${toX(4.5)},${toY(0)} ${toX(3.75)},${toY(1.25)} ${toX(0)},${toY(5)}`}
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="1.2"
      />

      {/* Franja rayada 3 < x1 < 4 */}
      <rect
        x={toX(3)}
        y={toY(5.5)}
        width={toX(4) - toX(3)}
        height={toY(0) - toY(5.5)}
        fill="url(#hatch-strip)"
      />

      {/* Rectas frontera x1 = 3 y x1 = 4 */}
      <line
        x1={toX(3)}
        y1={toY(5.5)}
        x2={toX(3)}
        y2={toY(0)}
        stroke="#1d3f8f"
        strokeWidth="1.6"
      />
      <text
        x={toX(3) - 6}
        y={toY(5.1)}
        textAnchor="end"
        fontFamily={SERIF}
        fontSize="13"
        fill="#1d3f8f"
        fontWeight="600"
        paintOrder="stroke"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        x₁ ≤ 3
      </text>

      <line
        x1={toX(4)}
        y1={toY(5.5)}
        x2={toX(4)}
        y2={toY(0)}
        stroke="#1d3f8f"
        strokeWidth="1.6"
      />
      <text
        x={toX(4) + 6}
        y={toY(5.1)}
        textAnchor="start"
        fontFamily={SERIF}
        fontSize="13"
        fill="#1d3f8f"
        fontWeight="600"
        paintOrder="stroke"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        x₁ ≥ 4
      </text>

      {/* Cartel «sin enteros» en el centro de la franja (ancho 54 px para no tocar las líneas) */}
      <rect
        x={toX(3.5) - 27}
        y={toY(3.5) - 11}
        width="54"
        height="22"
        fill="#ffffff"
        stroke="#b3261e"
        strokeWidth="1"
        rx="2"
      />
      <text
        x={toX(3.5)}
        y={toY(3.5) + 4}
        textAnchor="middle"
        fontFamily={SERIF}
        fontSize="13"
        fill="#b3261e"
        fontWeight="600"
      >
        sin enteros
      </text>

      {/* Todos los 19 puntos enteros (se aprecia que ninguno queda en la franja) */}
      {INTEGER_POINTS.map(({ x1, x2 }) => (
        <circle
          key={`bc-pt-${x1}-${x2}`}
          cx={toX(x1)}
          cy={toY(x2)}
          r="2.8"
          fill="#000000"
        />
      ))}

      {/* Óptimo relajado (3,75; 1,25) dentro de la franja, tachado */}
      <rect
        x={toX(3.75) - 4.5}
        y={toY(1.25) - 4.5}
        width="9"
        height="9"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="1.2"
      />
      <line
        x1={toX(3.75) - 6}
        y1={toY(1.25) - 6}
        x2={toX(3.75) + 6}
        y2={toY(1.25) + 6}
        stroke="#b3261e"
        strokeWidth="2"
      />
      <line
        x1={toX(3.75) - 6}
        y1={toY(1.25) + 6}
        x2={toX(3.75) + 6}
        y2={toY(1.25) - 6}
        stroke="#b3261e"
        strokeWidth="2"
      />
      <text
        x={toX(3.75) + 8}
        y={toY(1.25) - 6}
        fontFamily={SERIF}
        fontSize="13"
        fill="#b3261e"
        fontWeight="600"
        paintOrder="stroke"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        (3,75; 1,25)
      </text>
      <text
        x={toX(3.75) + 8}
        y={toY(1.25) + 8}
        fontFamily={SERIF}
        fontSize="13"
        fill="#b3261e"
        paintOrder="stroke"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        descartado
      </text>
    </svg>
  );
}

/**
 * Figura 3: Árbol de ramificación y acotamiento con P0, P1 y P2.
 */
function BranchAndBoundTree() {
  return (
    <svg
      viewBox="0 0 440 240"
      role="img"
      aria-label="Árbol de ramificación y acotamiento mostrando el nodo raíz P0 y los hijos P1 y P2"
      style={{ width: '100%', maxWidth: 460 }}
    >
      {/* Nodo raíz P0 */}
      <g>
        <rect
          x="120"
          y="10"
          width="200"
          height="52"
          rx="4"
          fill="#ffffff"
          stroke="#000000"
          strokeWidth="1.3"
        />
        <text
          x="220"
          y="30"
          textAnchor="middle"
          fontFamily={SERIF}
          fontSize="14"
          fontWeight="600"
        >
          P0 (raíz)
        </text>
        <text
          x="220"
          y="49"
          textAnchor="middle"
          fontFamily={SERIF}
          fontSize="13"
          fill="#000"
        >
          x = (3,75; 1,25) · Z = 23,75
        </text>
      </g>

      {/* Flecha hacia P1 (izquierda) */}
      <line x1="170" y1="62" x2="114" y2="120" stroke="#000000" strokeWidth="1.2" />
      <polygon points="110,125 120,119 114,113" fill="#000000" />
      <text
        x="130"
        y="90"
        textAnchor="end"
        fontFamily={SERIF}
        fontSize="13"
        fill="#1d3f8f"
        fontWeight="600"
        paintOrder="stroke"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        x₁ ≤ 3
      </text>

      {/* Flecha hacia P2 (derecha) */}
      <line x1="270" y1="62" x2="326" y2="120" stroke="#000000" strokeWidth="1.2" />
      <polygon points="330,125 326,113 320,119" fill="#000000" />
      <text
        x="310"
        y="90"
        textAnchor="start"
        fontFamily={SERIF}
        fontSize="13"
        fill="#1d3f8f"
        fontWeight="600"
        paintOrder="stroke"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        x₁ ≥ 4
      </text>

      {/* Nodo P1 (solución entera, nuevo incumbente) */}
      <g>
        <rect
          x="12"
          y="126"
          width="196"
          height="74"
          rx="4"
          fill="#ffffff"
          stroke="#1d3f8f"
          strokeWidth="1.6"
        />
        <text
          x="110"
          y="146"
          textAnchor="middle"
          fontFamily={SERIF}
          fontSize="14"
          fontWeight="600"
          fill="#1d3f8f"
        >
          P1
        </text>
        <text
          x="110"
          y="166"
          textAnchor="middle"
          fontFamily={SERIF}
          fontSize="13"
        >
          x = (3; 2) · Z = 23
        </text>
        <text
          x="110"
          y="185"
          textAnchor="middle"
          fontFamily={SERIF}
          fontSize="13"
          fill="#1d3f8f"
          fontWeight="600"
        >
          entera, incumbente (Z* = 23)
        </text>
      </g>

      {/* Nodo P2 (podado por cota) */}
      <g>
        <rect
          x="232"
          y="126"
          width="196"
          height="74"
          rx="4"
          fill="#ffffff"
          stroke="#b3261e"
          strokeWidth="1.6"
        />
        <text
          x="330"
          y="146"
          textAnchor="middle"
          fontFamily={SERIF}
          fontSize="14"
          fontWeight="600"
          fill="#b3261e"
        >
          P2
        </text>
        <text
          x="330"
          y="166"
          textAnchor="middle"
          fontFamily={SERIF}
          fontSize="13"
        >
          x = (4; 0,83) · Z = 23,33
        </text>
        <text
          x="330"
          y="185"
          textAnchor="middle"
          fontFamily={SERIF}
          fontSize="13"
          fill="#b3261e"
          fontWeight="600"
        >
          ⌊Z⌋ = 23 ≤ 23: podado
        </text>

        {/* Flecha de salida corta con barra roja cruzada que indica poda */}
        <line x1="330" y1="200" x2="330" y2="226" stroke="#b3261e" strokeWidth="1.3" />
        <polygon points="330,228 327,222 333,222" fill="#b3261e" />
        <line x1="320" y1="213" x2="340" y2="213" stroke="#b3261e" strokeWidth="2.5" />
      </g>
    </svg>
  );
}

/* ==========================================================================
   Componente principal de Teoría
   ========================================================================== */
export default function Teoria() {
  return (
    <Article>
      <Section title="Qué es la programación entera pura">
        <p>
          La <strong>programación entera pura</strong> es una rama de la programación lineal donde <em>todas</em> las variables de decisión deben tomar valores enteros. Se utiliza cuando las unidades que se modelan son indivisibles y no tendría sentido fraccionarlas en la práctica: personas en un turno laboral, máquinas asignadas a un proceso, barcos en una ruta o proyectos que se ejecutan completos o no se ejecutan.
        </p>
        <p>
          El modelo matemático general se formula como:
        </p>
        <Formula>
          Maximizar (o minimizar) <em>Z</em> = <em>c</em>₁<em>x</em>₁ + <em>c</em>₂<em>x</em>₂ + … + <em>c</em><sub><em>n</em></sub><em>x</em><sub><em>n</em></sub>
        </Formula>
        <p>
          sujeto a:
        </p>
        <Formula>
          Σ<sub><em>j</em>=1</sub><sup><em>n</em></sup> <em>a</em><sub><em>i</em>,<em>j</em></sub><em>x</em><sub><em>j</em></sub> ≤ <em>b</em><sub><em>i</em></sub> (para <em>i</em> = 1, …, <em>m</em>)
        </Formula>
        <Formula>
          <em>x</em><sub><em>j</em></sub> ≥ 0 y <em>x</em><sub><em>j</em></sub> ∈ ℤ (para <em>j</em> = 1, …, <em>n</em>)
        </Formula>
        <p>
          En este modelo:
        </p>
        <ul className="defs">
          <li><strong><em>Z</em>.</strong> Valor de la función objetivo que se busca optimizar.</li>
          <li><strong><em>x</em><sub><em>j</em></sub>.</strong> Variables de decisión del problema (<em>j</em> = 1, …, <em>n</em>).</li>
          <li><strong><em>c</em><sub><em>j</em></sub>.</strong> Coeficiente de beneficio o costo unitario de la variable <em>x</em><sub><em>j</em></sub>.</li>
          <li><strong><em>a</em><sub><em>i</em>,<em>j</em></sub>.</strong> Cantidad del recurso <em>i</em> consumida por cada unidad de <em>x</em><sub><em>j</em></sub>.</li>
          <li><strong><em>b</em><sub><em>i</em></sub>.</strong> Cantidad total disponible del recurso <em>i</em> (<em>i</em> = 1, …, <em>m</em>).</li>
          <li><strong>ℤ.</strong> Conjunto de los números enteros &#123;…, −2, −1, 0, 1, 2, …&#125;.</li>
        </ul>
        <p>
          Si solo una parte de las variables debe ser entera y las demás pueden ser continuas, el problema se denomina <a href={hrefTopic('entera-mixta')}>programación entera mixta</a>. Si las variables únicamente pueden tomar los valores 0 o 1, se trata de <a href={hrefTopic('entera-binaria')}>programación entera binaria</a>.
        </p>
        <p>
          La programación entera es mucho más difícil de resolver que la programación lineal continua. En la continua, la región factible es un poliedro convexo y el método simplex se desplaza entre sus vértices hasta hallar el óptimo. En la entera, la región factible deja de ser un continuo y pasa a ser una retícula de puntos aislados dentro de ese poliedro. El óptimo entero en general no coincide con un vértice continuo, por lo que el simplex por sí solo no basta.
        </p>
      </Section>

      <Section title="La relajación lineal">
        <p>
          La <strong>relajación lineal</strong> de un problema entero consiste en resolver exactamente el mismo modelo, con la misma función objetivo y las mismas restricciones técnicas, pero suprimiendo la exigencia de integralidad (es decir, omitiendo la condición <em>x</em><sub><em>j</em></sub> ∈ ℤ). Al admitir valores fraccionarios, el modelo resultante es de programación lineal continua ordinaria y se resuelve con el método simplex.
        </p>
        <p>
          Toda solución entera que sea factible para el problema original también satisface las restricciones de la relajación lineal. Por lo tanto, el conjunto de soluciones de la relajación contiene por completo a todos los puntos enteros factibles. Esto significa que la relajación lineal proporciona una <strong>cota insuperable</strong> sobre el valor óptimo:
        </p>
        <ul className="defs">
          <li><strong>En maximización.</strong> <em>Z</em><sub>entero</sub> ≤ <em>Z</em><sub>relajado</sub> (la relajación da una cota superior).</li>
          <li><strong>En minimización.</strong> <em>Z</em><sub>entero</sub> ≥ <em>Z</em><sub>relajado</sub> (la relajación da una cota inferior).</li>
        </ul>
        <p>
          Si al resolver la relajación lineal la solución arroja de forma casual valores enteros para todas las variables, esa solución es de inmediato el óptimo entero y no hace falta ningún cálculo adicional.
        </p>
      </Section>

      <Section title="Por qué no basta con redondear">
        <p>
          Una primera intuición suele ser resolver la relajación lineal continua y luego redondear los valores fraccionarios al entero más próximo. Sin embargo, el redondeo no funciona como método general.
        </p>
        <p>
          Considera el siguiente modelo de dos variables (que desarrollamos en el ejemplo resuelto): Maximizar <em>Z</em> = 5<em>x</em>₁ + 4<em>x</em>₂ sujeto a <em>x</em>₁ + <em>x</em>₂ ≤ 5 y 10<em>x</em>₁ + 6<em>x</em>₂ ≤ 45, con <em>x</em>₁, <em>x</em>₂ ≥ 0 y enteras.
        </p>
        <p>
          Al resolver la relajación lineal se obtiene el punto fraccionario <em>x</em> = (3,75; 1,25) con <em>Z</em> = 23,75. Observa lo que ocurre al intentar redondear:
        </p>
        <ul className="defs">
          <li><strong>Redondear al entero más cercano da (4, 1).</strong> Este punto es <strong>infactible</strong>: al evaluarlo en la segunda restricción resulta 10·4 + 6·1 = 46 &gt; 45. Queda fuera de la región factible.</li>
          <li><strong>Redondear hacia abajo da (3, 1).</strong> Este punto sí es factible, pero produce <em>Z</em> = 5·3 + 4·1 = 19. El verdadero óptimo entero es (3, 2) con <em>Z</em> = 23, por lo que el redondeo hacia abajo deja escapar 4 unidades de beneficio.</li>
        </ul>
        <Callout tone="regla" title="Redondear no es un método">
          El redondeo puede arrojar un punto infactible (que viola restricciones) o un punto factible pero no óptimo. En problemas con decenas de variables, probar combinaciones de redondeo a ciegas conduce a errores graves o a soluciones muy lejanas de la óptima.
        </Callout>
        <Figure caption="Ningún punto entero factible queda por encima de la recta Z = 23.">
          <FeasibleRegionFigure />
        </Figure>
      </Section>

      <Section title="Ramificación y acotamiento">
        <p>
          El método estándar para resolver la programación entera es la <strong>ramificación y acotamiento</strong> (<em>Branch &amp; Bound</em>). La idea central consiste en dividir sistemáticamente el espacio de soluciones en subproblemas más pequeños (ramificar) y descartar aquellos donde se demuestre matemáticamente que no puede existir una solución mejor que la mejor ya conocida (acotar y podar).
        </p>
        <p>
          <strong>Ramificar.</strong> Si en la relajación lineal de un subproblema una variable <em>x</em><sub><em>k</em></sub> que debería ser entera toma un valor fraccionario <em>v</em>, se divide el subproblema en dos hijos independientes: uno con la restricción adicional <em>x</em><sub><em>k</em></sub> ≤ ⌊<em>v</em>⌋ (piso) y otro con <em>x</em><sub><em>k</em></sub> ≥ ⌈<em>v</em>⌉ (techo). No se pierde ninguna solución entera viable, porque entre ⌊<em>v</em>⌋ y ⌈<em>v</em>⌉ no existe ningún número entero.
        </p>
        <Figure caption="Las dos ramas cubren todos los puntos enteros; la franja descartada no tiene ninguno.">
          <BranchingCutFigure />
        </Figure>
        <p>
          <strong>Incumbente (<em>Z</em>*).</strong> El incumbente es la mejor solución entera factible encontrada hasta el momento en cualquier punto del árbol. Al inicio, como aún no se conoce ninguna solución entera, se arranca en maximización con <em>Z</em>* = −∞ (y en minimización con <em>Z</em>* = +∞).
        </p>
        <p>
          <strong>Criterios de poda.</strong> Un subproblema se poda (se marca como cerrado y no se generan más ramas a partir de él) si cae en alguno de los siguientes tres casos:
        </p>
        <ol>
          <li><strong>Infactibilidad:</strong> la región del subproblema no tiene puntos factibles (el simplex determina que el sistema de restricciones es incompatible).</li>
          <li><strong>Cota no prometedora:</strong> el valor <em>Z</em> de su relajación lineal no supera al incumbente actual (en maximización: <em>Z</em> ≤ <em>Z</em>*). Como agregar restricciones nunca puede mejorar el valor de <em>Z</em>, ningún descendiente de esa rama podrá superar a <em>Z</em>*. Si todos los coeficientes de <em>Z</em> son enteros, el valor de <em>Z</em> para cualquier punto entero también debe ser entero, y basta comparar ⌊<em>Z</em> relajado⌋ ≤ <em>Z</em>*.</li>
          <li><strong>Solución entera:</strong> la solución de la relajación lineal resulta ser entera en todas sus variables. Si su valor <em>Z</em> mejora a <em>Z</em>*, este punto pasa a ser el nuevo incumbente (se actualiza <em>Z</em>* = <em>Z</em>) y la rama se poda, pues ya se extrajo su mejor solución posible.</li>
        </ol>
        <p>
          <strong>Pasos del algoritmo:</strong>
        </p>
        <ol>
          <li>Resolver la relajación lineal del problema original (nodo raíz).</li>
          <li>Si la solución ya es entera, terminar: es el óptimo entero.</li>
          <li>Elegir un subproblema abierto y una variable con valor fraccionario, y ramificar creando dos nuevos subproblemas con <em>x</em><sub><em>k</em></sub> ≤ ⌊<em>v</em>⌋ y <em>x</em><sub><em>k</em></sub> ≥ ⌈<em>v</em>⌉.</li>
          <li>Resolver la relajación lineal de ambos hijos y evaluar los tres criterios de poda sobre cada uno.</li>
          <li>Repetir los pasos 3 y 4 hasta que no queden subproblemas abiertos. El incumbente final es el óptimo entero. Si el árbol concluye sin haber hallado ninguna solución entera, el problema no tiene solución factible.</li>
        </ol>
        <p>
          En problemas de <strong>minimización</strong> los signos se invierten: la relajación lineal da una cota inferior, el incumbente arranca en <em>Z</em>* = +∞, un subproblema se poda si su <em>Z</em> relajado satisface <em>Z</em> ≥ <em>Z</em>* y, cuando los coeficientes de <em>Z</em> son enteros, se poda directamente al cumplirse ⌈<em>Z</em> relajado⌉ ≥ <em>Z</em>*.
        </p>
      </Section>

      <Section title="Ejemplo resuelto">
        <p>
          Resolvamos el modelo planteado paso a paso con el método de ramificación y acotamiento:
        </p>
        <Formula>
          Maximizar <em>Z</em> = 5<em>x</em>₁ + 4<em>x</em>₂
        </Formula>
        <p>
          sujeto a:
        </p>
        <Formula>
          <em>x</em>₁ + <em>x</em>₂ ≤ 5
        </Formula>
        <Formula>
          10<em>x</em>₁ + 6<em>x</em>₂ ≤ 45
        </Formula>
        <Formula>
          <em>x</em>₁, <em>x</em>₂ ≥ 0 y enteras
        </Formula>
        <p>
          Los vértices de la región factible relajada son (0, 0), (4,5; 0), (3,75; 1,25) y (0, 5).
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="mini-table">
            <thead>
              <tr>
                <th>Subproblema</th>
                <th>Restricciones añadidas</th>
                <th>Solución relajada (<em>x</em>₁, <em>x</em>₂)</th>
                <th><em>Z</em> relajado</th>
                <th>Acción / Resultado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>P0</strong></td>
                <td>Sin restricciones añadidas</td>
                <td>(3,75; 1,25)</td>
                <td>23,75</td>
                <td>Ramificar en <em>x</em>₁</td>
              </tr>
              <tr>
                <td><strong>P1</strong></td>
                <td><em>x</em>₁ ≤ 3</td>
                <td>(3; 2)</td>
                <td>23</td>
                <td>Entera: incumbente <em>Z</em>* = 23</td>
              </tr>
              <tr>
                <td><strong>P2</strong></td>
                <td><em>x</em>₁ ≥ 4</td>
                <td>(4; 0,83)</td>
                <td>23,33</td>
                <td>⌊23,33⌋ = 23 ≤ 23: se poda</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          En P2 la solución exacta es <em>x</em> = (4; 5/6) con <em>Z</em> = 70/3 ≈ 23,33. Como los coeficientes de la función objetivo son enteros (5 y 4), cualquier solución entera que pudiera descender de P2 tendría un valor <em>Z</em> entero a lo sumo igual a ⌊23,33⌋ = 23. Al tener ya un incumbente con <em>Z</em>* = 23, P2 no puede mejorar ese valor y se poda por cota de forma inmediata.
        </p>
        <p>
          <strong>Conclusión:</strong> la solución óptima entera es <em>x</em> = (3, 2) con <em>Z</em> = 23. Bastó explorar únicamente 3 subproblemas, en vez de revisar uno por uno los 19 puntos enteros factibles de la región.
        </p>
        <p>
          <em>Nota:</em> si no se utilizara el redondeo al piso entero para podar, P2 tendría que ramificarse en <em>x</em>₂: la rama <em>x</em>₂ ≤ 0 arrojaría (4,5; 0) con <em>Z</em> = 22,5 &lt; 23 (podada por cota) y la rama <em>x</em>₂ ≥ 1 resultaría infactible. El árbol habría requerido 5 subproblemas para llegar exactamente a la misma conclusión.
        </p>
        <Figure caption="Árbol de ramificación: P1 proporciona el incumbente Z* = 23 y P2 se poda por cota usando el piso entero.">
          <BranchAndBoundTree />
        </Figure>
      </Section>

      <Section title="Convenciones y consejos para terminar rápido">
        <Callout tone="regla" title="Cómo se hace en este sitio">
          <ul>
            <li><strong>Variable a ramificar:</strong> elige la variable con mayor parte fraccionaria; si hay empate, la de menor índice (por ejemplo, <em>x</em>₁ antes que <em>x</em>₂).</li>
            <li><strong>Resuelve los dos hijos antes de seguir:</strong> si uno de los hijos produce una solución entera, obtienes de inmediato un incumbente que te permite podar el otro hijo sin tener que abrirlo.</li>
            <li><strong>Baja primero por el hijo con mejor <em>Z</em>:</strong> explora primero la rama más prometedora hasta cerrarla; de este modo el incumbente aparece pronto y con un valor alto, acelerando la poda del resto del árbol.</li>
            <li><strong>Incumbente inicial barato:</strong> si todas las restricciones son de tipo ≤ con coeficientes no negativos, redondear hacia abajo la solución relajada siempre es factible y proporciona un <em>Z</em>* de partida antes de ramificar.</li>
            <li><strong>Poda con el piso o el techo:</strong> si la función objetivo <em>Z</em> tiene coeficientes enteros, compara ⌊<em>Z</em> relajado⌋ ≤ <em>Z</em>* en maximización (o ⌈<em>Z</em> relajado⌉ ≥ <em>Z</em>* en minimización) para podar nodos antes de tiempo.</li>
            <li><strong>Dibuja con 2 variables:</strong> graficar la región factible continua y los puntos enteros ayuda a verificar el resultado visualmente y a evitar confusiones con las cotas.</li>
            <li><strong>Revisión de sentido común:</strong> en maximización, un nodo hijo nunca puede tener un <em>Z</em> mayor que el de su nodo padre, y siempre se debe cumplir <em>Z</em><sub>entero</sub> ≤ <em>Z</em><sub>relajado</sub>. Si alguna de estas condiciones no se cumple, hay un error de cálculo.</li>
          </ul>
        </Callout>
      </Section>

      <Section title="Pruébalo">
        <p>
          En la pestaña <a href={hrefTopic('entera-pura', 'resuelve')}>Resuelve el tuyo</a> puedes cargar el modelo de dos variables de esta página o ingresar el tuyo propio para ver la región factible, los puntos enteros y el árbol de ramificación.
        </p>
        <p>
          <strong>Fuentes:</strong> Taha, H. A., <em>Investigación de operaciones</em>, 7.ª ed. (Alfaomega); Hillier, F. S. y Lieberman, G. J., <em>Introducción a la investigación de operaciones</em>, 7.ª ed. (McGraw-Hill).
        </p>
      </Section>
    </Article>
  );
}
