import { Article, Section, Callout, Figure, Formula } from '@/ui/Article.jsx';
import { hrefTopic } from '@/app/router.js';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";
const BLUE = '#1d3f8f';
const RED = '#b3261e';

const halo = { paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3.5, strokeLinejoin: 'round' };

function T({ x, y, anchor = 'middle', size = 14, fill = '#000', weight, children }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontFamily={SERIF} fontSize={size} fill={fill} fontWeight={weight}>
      {children}
    </text>
  );
}

/* ==========================================================================
   Figura 1: árbol binario de las 8 combinaciones del ejemplo de proyectos
   ========================================================================== */
function FiguraEnumeracion() {
  const leaves = ['111', '110', '101', '100', '011', '010', '001', '000'];
  const benef = [125, 90, 85, 50, 75, 40, 35, 0];
  const lx = [40, 120, 200, 280, 360, 440, 520, 600];
  const nodes = [
    { x: 320, y: 28, v: 'x₁', kids: [[160, 98], [480, 98]] },
    { x: 160, y: 98, v: 'x₂', kids: [[80, 168], [240, 168]] },
    { x: 480, y: 98, v: 'x₂', kids: [[400, 168], [560, 168]] },
    { x: 80, y: 168, v: 'x₃', kids: [[40, 238], [120, 238]] },
    { x: 240, y: 168, v: 'x₃', kids: [[200, 238], [280, 238]] },
    { x: 400, y: 168, v: 'x₃', kids: [[360, 238], [440, 238]] },
    { x: 560, y: 168, v: 'x₃', kids: [[520, 238], [600, 238]] },
  ];
  return (
    <svg
      viewBox="0 0 640 300"
      role="img"
      aria-label="Árbol binario con las 8 combinaciones de x1, x2 y x3 y su beneficio. 111 y 110 no caben en el presupuesto. La mejor es 101 con beneficio 85."
      style={{ width: '100%', maxWidth: 640, minWidth: 520, display: 'block', margin: '0 auto' }}
    >
      {nodes.map((n, i) =>
        n.kids.map(([kx, ky], k) => {
          const mx = (n.x + kx) / 2;
          const my = (n.y + ky) / 2;
          const izq = k === 0;
          return (
            <g key={`${i}-${k}`}>
              <line x1={n.x} y1={n.y + 14} x2={kx} y2={ky - (ky === 238 ? 12 : 14)} stroke="#000" strokeWidth="1.1" />
              <text x={mx + (izq ? -6 : 6)} y={my - 2} textAnchor={izq ? 'end' : 'start'} fontFamily={SERIF} fontSize="12" {...halo}>
                {izq ? 'x = 1' : 'x = 0'}
              </text>
            </g>
          );
        }),
      )}
      {nodes.map((n, i) => (
        <g key={'n' + i}>
          <circle cx={n.x} cy={n.y} r="14" fill="#fff" stroke="#000" strokeWidth="1.2" />
          <T x={n.x} y={n.y + 5}>{n.v}</T>
        </g>
      ))}
      {leaves.map((c, i) => {
        const bad = i < 2;
        const best = c === '101';
        const col = bad ? RED : best ? BLUE : '#000';
        return (
          <g key={c}>
            <rect x={lx[i] - 24} y={226} width="48" height="24" rx="2" fill="#fff" stroke={col} strokeWidth={best ? 2.6 : 1.2} />
            <T x={lx[i]} y={243} fill={col} weight={best || bad ? 600 : undefined}>{c}</T>
            <T x={lx[i]} y={272} fill={col} weight={best ? 600 : undefined}>{benef[i]}</T>
            {bad && <T x={lx[i]} y={290} fill={RED} size={16} weight={600}>×</T>}
          </g>
        );
      })}
    </svg>
  );
}

/* ==========================================================================
   Figura 2: árbol del método aditivo (ejemplo de servidores), calculado
   ========================================================================== */
const ARBOL = {
  z: 0,
  kids: [
    {
      lab: 'x₁ = 1', z: 8,
      kids: [
        { lab: 'x₂ = 1', z: 14, estado: 'factible' },
        {
          lab: 'x₂ = 0', z: 8,
          kids: [
            { lab: 'x₃ = 1', z: 12, estado: 'factible' },
            { lab: 'x₃ = 0', z: 8, estado: 'podada' },
          ],
        },
      ],
    },
    {
      lab: 'x₁ = 0', z: 0,
      kids: [
        {
          lab: 'x₂ = 1', z: 6,
          kids: [
            { lab: 'x₃ = 1', z: 10, estado: 'óptimo' },
            { lab: 'x₃ = 0', z: 6, estado: 'podada' },
          ],
        },
        { lab: 'x₂ = 0', z: 0, estado: 'podada' },
      ],
    },
  ],
};

/** Las hojas se reparten de izquierda a derecha; cada padre queda en el promedio de sus hijos. */
function distribuir(n, prof, st) {
  if (!n.kids) {
    n.px = st.next;
    st.next += 86;
  } else {
    n.kids.forEach((k) => distribuir(k, prof + 1, st));
    n.px = n.kids.reduce((s, k) => s + k.px, 0) / n.kids.length;
  }
  n.py = 20 + prof * 74;
  return n;
}

function aplanar(n, lista = []) {
  lista.push(n);
  (n.kids || []).forEach((k) => aplanar(k, lista));
  return lista;
}

function FiguraAditivo() {
  const raiz = distribuir(JSON.parse(JSON.stringify(ARBOL)), 0, { next: 50 });
  const todos = aplanar(raiz);
  const W = 50 + 86 * 5 + 50;
  const H = 20 + 3 * 74 + 34 + 30;
  const col = (n) => (n.estado === 'podada' ? RED : n.estado === 'óptimo' ? BLUE : '#000');
  const aristas = [];
  todos.forEach((n) => (n.kids || []).forEach((k) => aristas.push([n, k])));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label="Árbol del método aditivo para el ejemplo de servidores, con 11 nodos: tres soluciones factibles con Z igual a 14, 12 y 10, tres ramas podadas y el óptimo con Z igual a 10."
      style={{ display: 'block', maxWidth: 'none' }}
    >
      {aristas.map(([p, k], i) => (
        <g key={i}>
          <line x1={p.px} y1={p.py + 34} x2={k.px} y2={k.py} stroke="#000" strokeWidth="1.1" />
          <text
            x={(p.px + k.px) / 2 + (k.px < p.px ? -4 : 4)}
            y={(p.py + 34 + k.py) / 2 + 4}
            textAnchor={k.px < p.px ? 'end' : 'start'}
            fontFamily={SERIF}
            fontSize="12"
            {...halo}
          >
            {k.lab}
          </text>
        </g>
      ))}
      {todos.map((n, i) => (
        <g key={'n' + i}>
          <rect
            x={n.px - 35}
            y={n.py}
            width="70"
            height="34"
            rx="6"
            fill="#fff"
            stroke={col(n)}
            strokeWidth={n.estado === 'óptimo' ? 2.8 : 1.2}
          />
          <T x={n.px} y={n.py + 22} fill={col(n)} weight={n.estado === 'óptimo' ? 600 : undefined}>{`Z = ${n.z}`}</T>
          {n.estado && (
            <T x={n.px} y={n.py + 52} size={13} fill={col(n)} weight={n.estado === 'factible' ? undefined : 600}>
              {n.estado}
            </T>
          )}
        </g>
      ))}
    </svg>
  );
}

/* ==========================================================================
   Figura 3: la relajación como cota (escala vertical)
   ========================================================================== */
function FiguraCota() {
  const y = (v) => 230 - (v - 15) * 25;
  const marcas = [15, 16, 17, 18, 19, 20, 21, 22, 23];
  const puntos = [
    { v: 22, txt: 'Relajación lineal (cota superior)', c: '#000' },
    { v: 21, txt: 'Óptimo binario', c: BLUE },
    { v: 17, txt: 'Una solución factible cualquiera', c: '#000' },
  ];
  return (
    <svg
      viewBox="0 0 600 260"
      role="img"
      aria-label="Escala vertical de 15 a 23. La relajación lineal está en 22, el óptimo binario en 21 y una solución factible cualquiera en 17. Entre 22 y 21 está la brecha."
      style={{ width: '100%', maxWidth: 600, minWidth: 480, display: 'block', margin: '0 auto' }}
    >
      <line x1="60" y1={y(23)} x2="60" y2={y(15)} stroke="#000" strokeWidth="1.2" />
      {marcas.map((v) => (
        <g key={v}>
          <line x1="55" y1={y(v)} x2="60" y2={y(v)} stroke="#000" strokeWidth="1" />
          {v % 2 === 1 && <T x={50} y={y(v) + 5} anchor="end">{v}</T>}
        </g>
      ))}
      {puntos.map((p) => (
        <g key={p.v}>
          <line x1="60" y1={y(p.v)} x2="200" y2={y(p.v)} stroke={p.c} strokeWidth="0.8" strokeDasharray="3 3" />
          <circle cx="200" cy={y(p.v)} r="5.5" fill={p.c === BLUE ? BLUE : '#fff'} stroke={p.c} strokeWidth="1.5" />
          <T x={214} y={y(p.v) + 5} anchor="start" fill={p.c} weight={p.c === BLUE ? 600 : undefined}>{`${p.v}  ${p.txt}`}</T>
        </g>
      ))}
      <path d={`M 168 ${y(22)} L 174 ${y(22)} L 174 ${y(21)} L 168 ${y(21)}`} fill="none" stroke="#000" strokeWidth="1.1" />
      <T x={164} y={(y(22) + y(21)) / 2 + 5} anchor="end" size={13}>brecha</T>
    </svg>
  );
}

/* ==========================================================================
   Componente principal
   ========================================================================== */
export default function Teoria() {
  return (
    <Article>
      <Section title="Decisiones de sí o no">
        <p>
          En muchos problemas hay que decidir si algo se hace o no: activar un módulo de software, abrir un centro de distribución, aprobar un proyecto, encender un servidor. Cada decisión se representa con una variable que solo vale 0 o 1. La <strong>programación entera binaria</strong> (PEB) es la programación lineal en la que todas las variables son de este tipo.
        </p>
        <ul className="defs">
          <li><strong>Variable de decisión:</strong> <em>x</em><sub><em>j</em></sub> = 1 si se toma la decisión <em>j</em>, <em>x</em><sub><em>j</em></sub> = 0 si no.</li>
          <li><strong>Función objetivo:</strong> una suma lineal <em>Z</em> = <em>c</em>₁<em>x</em>₁ + … + <em>c</em><sub><em>n</em></sub><em>x</em><sub><em>n</em></sub> que se quiere maximizar (beneficio) o minimizar (costo).</li>
          <li><strong>Restricciones:</strong> igualdades o desigualdades lineales que expresan presupuesto, capacidad o reglas lógicas.</li>
        </ul>
        <Formula>Maximizar o minimizar <em>Z</em> = <em>c</em>₁<em>x</em>₁ + <em>c</em>₂<em>x</em>₂ + … + <em>c</em><sub><em>n</em></sub><em>x</em><sub><em>n</em></sub></Formula>
        <Formula>sujeto a <em>a</em><sub><em>i</em>1</sub><em>x</em>₁ + … + <em>a</em><sub><em>in</em></sub><em>x</em><sub><em>n</em></sub> (≤, = o ≥) <em>b</em><sub><em>i</em></sub> &nbsp; para <em>i</em> = 1, …, <em>m</em></Formula>
        <Formula><em>x</em><sub><em>j</em></sub> ∈ {'{0, 1}'} &nbsp; para <em>j</em> = 1, …, <em>n</em></Formula>
        <table className="mini-table">
          <thead>
            <tr><th></th><th>Binaria</th><th>Entera pura</th><th>Entera mixta</th></tr>
          </thead>
          <tbody>
            <tr><td>Variables</td><td>Todas 0 o 1</td><td>Todas enteras (0, 1, 2…)</td><td>Algunas enteras, otras continuas</td></tr>
            <tr><td>Uso típico</td><td>Decisiones de sí o no</td><td>Contar unidades</td><td>Decisiones discretas y cantidades continuas</td></tr>
          </tbody>
        </table>
        <p>
          La PEB es un caso particular de la entera pura, con 0 ≤ <em>x</em> ≤ 1 (<a href={hrefTopic('entera-pura')}>tema 1.1</a>).
        </p>
      </Section>

      <Section title="Cómo se plantea un modelo">
        <p>
          Una empresa de desarrollo de software debe elegir entre 3 proyectos con un presupuesto de 50 unidades monetarias.
        </p>
        <table className="mini-table">
          <thead>
            <tr><th>Proyecto</th><th>Beneficio</th><th>Costo</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>50</td><td>30</td></tr>
            <tr><td>2</td><td>40</td><td>25</td></tr>
            <tr><td>3</td><td>35</td><td>20</td></tr>
          </tbody>
        </table>
        <ol>
          <li>Variables: <em>x</em><sub><em>j</em></sub> = 1 si se elige el proyecto <em>j</em>, y 0 si no.</li>
          <li>Objetivo: maximizar <em>Z</em> = 50<em>x</em>₁ + 40<em>x</em>₂ + 35<em>x</em>₃.</li>
          <li>Presupuesto: 30<em>x</em>₁ + 25<em>x</em>₂ + 20<em>x</em>₃ ≤ 50.</li>
          <li><em>x</em><sub><em>j</em></sub> ∈ {'{0, 1}'}.</li>
        </ol>
      </Section>

      <Section title="Condiciones lógicas">
        <p>
          Las variables binarias permiten escribir reglas del tipo «si… entonces…» como restricciones lineales.
        </p>
        <table className="mini-table">
          <thead>
            <tr><th>Condición</th><th>Restricción</th></tr>
          </thead>
          <tbody>
            <tr><td>A lo sumo <em>k</em> de <em>n</em></td><td><em>x</em>₁ + … + <em>x</em><sub><em>n</em></sub> ≤ <em>k</em></td></tr>
            <tr><td>Al menos <em>k</em> de <em>n</em></td><td><em>x</em>₁ + … + <em>x</em><sub><em>n</em></sub> ≥ <em>k</em></td></tr>
            <tr><td>Exactamente <em>k</em> de <em>n</em></td><td><em>x</em>₁ + … + <em>x</em><sub><em>n</em></sub> = <em>k</em></td></tr>
            <tr><td>A lo sumo uno (excluyentes)</td><td><em>x</em>₁ + … + <em>x</em><sub><em>k</em></sub> ≤ 1</td></tr>
            <tr><td>Al menos uno de un grupo (por ejemplo, la zona norte son las ubicaciones 1 y 2)</td><td><em>x</em>₁ + <em>x</em>₂ ≥ 1</td></tr>
            <tr><td>A solo si B (interdependencia)</td><td><em>x</em><sub>A</sub> ≤ <em>x</em><sub>B</sub></td></tr>
            <tr><td>A y B van juntos</td><td><em>x</em><sub>A</sub> = <em>x</em><sub>B</sub></td></tr>
            <tr><td>Presupuesto o capacidad máxima</td><td>Σ <em>c</em><sub><em>j</em></sub><em>x</em><sub><em>j</em></sub> ≤ <em>b</em></td></tr>
            <tr><td>Capacidad o requisito mínimo</td><td>Σ <em>a</em><sub><em>j</em></sub><em>x</em><sub><em>j</em></sub> ≥ <em>b</em></td></tr>
          </tbody>
        </table>
        <Callout tone="regla" title="Cómo comprobar una restricción lógica">
          Prueba todas las combinaciones de las variables que intervienen. Por ejemplo, «si se abre el centro 2 debe abrirse el 1» se escribe <em>x</em>₂ ≤ <em>x</em>₁. Con (<em>x</em>₁, <em>x</em>₂) = (0, 1) queda 1 ≤ 0, que es falso: esa combinación queda prohibida. Con (1, 1), (1, 0) y (0, 0) se cumple.
        </Callout>
      </Section>

      <Section title="Resolver por enumeración">
        <p>
          Con <em>n</em> variables hay 2<sup><em>n</em></sup> combinaciones. La enumeración exhaustiva las prueba todas:
        </p>
        <ol>
          <li>Escribe las 2<sup><em>n</em></sup> combinaciones.</li>
          <li>Evalúa cada restricción en cada combinación.</li>
          <li>Descarta las que violan alguna restricción.</li>
          <li>Calcula <em>Z</em> en las factibles.</li>
          <li>Elige la de mayor <em>Z</em> si maximizas o la de menor <em>Z</em> si minimizas.</li>
        </ol>
        <p>Aplicada al ejemplo de los proyectos:</p>
        <table className="mini-table">
          <thead>
            <tr><th><em>x</em>₁<em>x</em>₂<em>x</em>₃</th><th>Costo</th><th>Beneficio</th><th>¿Cabe en 50?</th></tr>
          </thead>
          <tbody>
            <tr><td>000</td><td>0</td><td>0</td><td>Sí</td></tr>
            <tr><td>100</td><td>30</td><td>50</td><td>Sí</td></tr>
            <tr><td>010</td><td>25</td><td>40</td><td>Sí</td></tr>
            <tr><td>001</td><td>20</td><td>35</td><td>Sí</td></tr>
            <tr><td>110</td><td>55</td><td>90</td><td>No</td></tr>
            <tr><td>101</td><td>50</td><td>85</td><td>Sí</td></tr>
            <tr><td>011</td><td>45</td><td>75</td><td>Sí</td></tr>
            <tr><td>111</td><td>75</td><td>125</td><td>No</td></tr>
          </tbody>
        </table>
        <p>
          El óptimo es elegir los proyectos 1 y 3, con beneficio 85 y costo 50. Fíjate en que 110 tiene más beneficio (90) pero no cabe en el presupuesto.
        </p>
        <Figure caption="Figura 1. Cada camino de la raíz a una hoja es una combinación. En rojo, las que no caben en el presupuesto; en azul, la mejor.">
          <div style={{ overflowX: 'auto' }}><FiguraEnumeracion /></div>
        </Figure>
      </Section>

      <Section title="Por qué no basta con enumerar">
        <p>Cada variable nueva duplica el número de combinaciones.</p>
        <table className="mini-table">
          <thead>
            <tr><th>Variables <em>n</em></th><th>Combinaciones 2<sup><em>n</em></sup></th></tr>
          </thead>
          <tbody>
            <tr><td>5</td><td>32</td></tr>
            <tr><td>10</td><td>1.024</td></tr>
            <tr><td>20</td><td>1.048.576</td></tr>
            <tr><td>30</td><td>1.073.741.824</td></tr>
          </tbody>
        </table>
        <p>
          Con 30 variables ya hay más de mil millones de combinaciones. La PEB es un problema NP-duro: no se conoce un método que, en todos los casos, evite este crecimiento. Los métodos de ramificación y poda evitan probar muchas combinaciones.
        </p>
      </Section>

      <Section title="Método aditivo de Balas (enumeración implícita)">
        <p>
          En vez de probar todas las combinaciones, se construye un árbol y se descartan ramas completas. Se parte de que todas las variables valen 0 (lo más barato cuando los costos no son negativos). Si así se cumplen las restricciones, ya hay solución. Si no, se mide la infactibilidad (cuánto falta para cumplirlas) y se fija en 1 la variable libre que deja la menor infactibilidad; si hay empate, la de menor índice.
        </p>
        <p>
          Cada decisión abre dos ramas: <em>x</em><sub><em>j</em></sub> = 1 y <em>x</em><sub><em>j</em></sub> = 0. Una rama se poda cuando (a) ya no puede cumplir las restricciones aunque se usen todas las variables que quedan libres, o (b) no puede mejorar la mejor solución encontrada.
        </p>
        <Callout tone="regla" title="Forma que necesita el método">
          Minimización con costos <em>c</em><sub><em>j</em></sub> ≥ 0 y todas las restricciones escritas como ≤. Una restricción ≥ se multiplica por −1. Un problema de maximización se pasa a minimización cambiando el signo de la función objetivo, y las variables con costo negativo se reemplazan por su complemento (1 − <em>x</em>).
        </Callout>
        <p>
          Ejemplo (servidores): minimizar <em>Z</em> = 8<em>x</em>₁ + 6<em>x</em>₂ + 4<em>x</em>₃ sujeto a 100<em>x</em>₁ + 80<em>x</em>₂ + 60<em>x</em>₃ ≥ 140. Resultado: activar los servidores 2 y 3, con consumo 10 y capacidad 140.
        </p>
        <Figure caption="Figura 2. Se encontraron tres soluciones factibles (Z = 14, 12 y 10). La mejor es Z = 10. Las demás ramas se podan porque no pueden cumplir la capacidad mínima.">
          <div style={{ overflowX: 'auto' }}><FiguraAditivo /></div>
        </Figure>
      </Section>

      <Section title="La relajación lineal como cota">
        <p>
          Si se cambia <em>x</em><sub><em>j</em></sub> ∈ {'{0, 1}'} por 0 ≤ <em>x</em><sub><em>j</em></sub> ≤ 1, el problema se vuelve de programación lineal y es más fácil de resolver. Su óptimo sirve de cota: en maximización es mayor o igual que el óptimo binario; en minimización es menor o igual. Si la solución de la relajación sale con todo 0 o 1, ya es el óptimo del problema original. Esta idea es la base de la ramificación y acotamiento (ver <a href={hrefTopic('entera-pura')}>1.1 Programación entera pura</a>).
        </p>
        <p>
          Ejemplo: maximizar 8<em>x</em>₁ + 6<em>x</em>₂ + 5<em>x</em>₃ + 9<em>x</em>₄ + 7<em>x</em>₅ sujeto a 4<em>x</em>₁ + 2<em>x</em>₂ + 3<em>x</em>₃ + 5<em>x</em>₄ + 3<em>x</em>₅ ≤ 10, <em>x</em>₁ + <em>x</em>₃ ≤ 1 y <em>x</em>₂ + <em>x</em>₄ ≤ 1. La relajación da <em>Z</em> = 22 con <em>x</em>₂ = ⅔ y <em>x</em>₄ = ⅓; el óptimo binario es <em>Z</em> = 21 con <em>x</em> = (1, 1, 0, 0, 1). Una solución factible cualquiera, como (1, 0, 0, 1, 0), da <em>Z</em> = 17.
        </p>
        <Figure caption="Figura 3. El óptimo binario nunca supera la cota de la relajación.">
          <div style={{ overflowX: 'auto' }}><FiguraCota /></div>
        </Figure>
      </Section>

      <Section title="Errores frecuentes">
        <ol>
          <li>
            <strong>Creer que hay que llegar al máximo permitido de elementos.</strong> Con costos 6, 5, 8, 9 y 4, a lo sumo 3 elementos y al menos uno de los dos primeros, el óptimo es elegir solo el segundo (costo 5). Agregar elementos solo sube el costo.
          </li>
          <li>
            <strong>Redondear la relajación.</strong> En la mochila «maximizar 8<em>x</em>₁ + 11<em>x</em>₂ + 6<em>x</em>₃ + 4<em>x</em>₄ con 5<em>x</em>₁ + 7<em>x</em>₂ + 4<em>x</em>₃ + 3<em>x</em>₄ ≤ 14», la relajación da <em>x</em> = (1, 1, ½, 0) con <em>Z</em> = 22. Redondear hacia abajo da (1, 1, 0, 0) con <em>Z</em> = 19, pero el óptimo binario es (0, 1, 1, 1) con <em>Z</em> = 21.
          </li>
          <li>
            <strong>Invertir el sentido de una restricción de requisito mínimo.</strong> «Capacidad mínima 140» es ≥ 140, no ≤ 140.
          </li>
        </ol>
      </Section>

      <Section title="Aplicaciones">
        <ul className="defs">
          <li><strong>Presupuesto de capital:</strong> decidir qué inversiones hacer.</li>
          <li><strong>Portafolios financieros:</strong> qué acciones incluir.</li>
          <li><strong>Localización de instalaciones:</strong> dónde abrir centros.</li>
        </ul>
        <p>
          <strong>Fuentes:</strong> Hillier, F. S. y Lieberman, G. J., <em>Introducción a la investigación de operaciones</em>, 7.ª ed.; Taha, H. A., <em>Investigación de operaciones</em>, 7.ª ed.
        </p>
      </Section>

      <Section title="Pruébalo">
        <ul className="defs">
          <li><a href={hrefTopic('entera-binaria', 'resuelve')}>Resuelve el tuyo</a>: escribes tu modelo y obtienes la tabla de combinaciones o el árbol del método aditivo.</li>
          <li><a href={hrefTopic('entera-binaria', 'paso')}>Paso a paso</a>: ves el método avanzar un paso a la vez.</li>
        </ul>
      </Section>
    </Article>
  );
}
