import { Article, Section, Callout, Figure, Formula } from '@/ui/Article.jsx';
import { hrefTopic } from '@/app/router.js';
import ArbolSVG from '@/tools/arboles-decision/components/ArbolSVG.jsx';
import GraficaSensibilidad from '@/tools/arboles-decision/components/GraficaSensibilidad.jsx';
import { arbolDeEjemplo } from '@/tools/arboles-decision/domain/ejemplos.js';
import { evaluar } from '@/tools/arboles-decision/domain/evaluar.js';
import { perfilRiesgo } from '@/tools/arboles-decision/domain/riesgo.js';
import { sensibilidad } from '@/tools/arboles-decision/domain/sensibilidad.js';
import { fmtNum } from '@/tools/arboles-decision/domain/format.js';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";
const num = (x) => fmtNum(x);

/* Todos los números del texto salen del mismo dominio que usan las otras pestañas. */
const PLANTA = arbolDeEjemplo('planta');
const EV_PLANTA = evaluar(PLANTA);
const RAMAS = EV_PLANTA.porNodo.n1.ramas; // Grande, Pequeña, No construir
const VE_GRANDE = EV_PLANTA.porNodo.n2.valor;
const VE_PEQ = EV_PLANTA.porNodo.n5.valor;
const RIESGO_GRANDE = perfilRiesgo(PLANTA, EV_PLANTA);
const SENS_PLANTA = sensibilidad(PLANTA, 'n2', 0, { ligar: true });
const P_STAR = SENS_PLANTA.cortes[0].p;

const ESTUDIO = arbolDeEjemplo('estudio');
const EV_ESTUDIO = evaluar(ESTUDIO);
const CON_ESTUDIO = EV_ESTUDIO.porNodo.n1.ramas[0];
const SIN_ESTUDIO = EV_ESTUDIO.porNodo.n1.ramas[1];
const COSTO_ESTUDIO = -CON_ESTUDIO.pago;
const VEIM = CON_ESTUDIO.total + COSTO_ESTUDIO - SIN_ESTUDIO.total;
const P_ALTA_SIN = 0.53;
const VEIP = P_ALTA_SIN * 200 - SIN_ESTUDIO.total;

const MANT = evaluar(arbolDeEjemplo('mantenimiento'));
const LANZ = evaluar(arbolDeEjemplo('lanzamiento'));

const overflow = { overflowX: 'auto' };

/* ==========================================================================
   Figura 1: los tres símbolos
   ========================================================================== */
function FiguraSimbolos() {
  const T = ({ x, y, children, size = 13.5, weight, anchor = 'middle' }) => (
    <text x={x} y={y} textAnchor={anchor} fontFamily={SERIF} fontSize={size} fontWeight={weight} fill="#000">{children}</text>
  );
  return (
    <svg
      viewBox="0 0 640 170"
      role="img"
      aria-label="Los tres símbolos de un árbol de decisión: cuadrado para el nodo de decisión, círculo para el nodo de azar y el valor al final de la rama para el resultado."
      style={{ width: '100%', maxWidth: 640, minWidth: 520, display: 'block', margin: '0 auto' }}
    >
      <rect x="84" y="24" width="32" height="32" fill="#fff" stroke="#000" strokeWidth="1.5" />
      <T x={100} y={84} weight={600}>Nodo de decisión</T>
      <T x={100} y={104}>Tú eliges una rama.</T>
      <T x={100} y={122}>Se toma la de mejor valor.</T>

      <circle cx="320" cy="40" r="17" fill="#fff" stroke="#000" strokeWidth="1.5" />
      <T x={320} y={84} weight={600}>Nodo de azar</T>
      <T x={320} y={104}>Ocurre una rama, con su</T>
      <T x={320} y={122}>probabilidad. Se promedia (VE).</T>

      <path d="M 500 40 H 560" fill="none" stroke="#000" strokeWidth="1.1" />
      <T x={530} y={31} size={12.5}>rama</T>
      <T x={572} y={45} weight={700} anchor="start" size={14}>120</T>
      <T x={540} y={84} weight={600}>Resultado final</T>
      <T x={540} y={104}>Lo que se obtiene al terminar</T>
      <T x={540} y={122}>el camino (pago o costo).</T>
    </svg>
  );
}

export default function Teoria() {
  return (
    <Article>
      <Section title="Decidir cuando el futuro es incierto">
        <p>
          Algunas decisiones se toman en etapas: primero eliges, luego ocurre algo que no controlas (la demanda, el clima, el resultado de un estudio) y entonces vuelves a elegir. Un <strong>árbol de decisión</strong> dibuja esa secuencia de izquierda a derecha y permite calcular qué conviene hacer en cada punto.
        </p>
        <ul className="defs">
          <li><strong>Nodo de decisión (cuadrado):</strong> aquí tú escoges entre varias ramas. Cada rama es una alternativa.</li>
          <li><strong>Nodo de azar (círculo):</strong> aquí ocurre uno de varios eventos. Cada rama tiene una probabilidad y las de un mismo nodo suman 1.</li>
          <li><strong>Resultado final:</strong> el pago (ganancia) o el costo al terminar un camino.</li>
          <li><strong>Pago de una rama:</strong> lo que cuesta o deja tomar esa rama (por ejemplo, la inversión). Se acumula con lo que venga después.</li>
        </ul>
        <Figure caption="Figura 1. Símbolos del árbol. El valor esperado (VE) se calcula solo en los nodos de azar.">
          <div style={overflow}><FiguraSimbolos /></div>
        </Figure>
      </Section>

      <Section title="Cómo se plantea">
        <p>
          Una empresa decide el tamaño de una planta. Construir la grande cuesta 120 y la pequeña 50 (millones). La demanda es alta con probabilidad 0,6 y baja con 0,4. El ingreso al terminar depende de la planta y de la demanda:
        </p>
        <table className="mini-table">
          <thead>
            <tr><th>Alternativa</th><th>Costo de construir</th><th>Ingreso con demanda alta (0,6)</th><th>Ingreso con demanda baja (0,4)</th></tr>
          </thead>
          <tbody>
            <tr><td>Planta grande</td><td>120</td><td>300</td><td>60</td></tr>
            <tr><td>Planta pequeña</td><td>50</td><td>150</td><td>90</td></tr>
            <tr><td>No construir</td><td>0</td><td>0</td><td>0</td></tr>
          </tbody>
        </table>
        <ol>
          <li>Se dibuja la decisión como un cuadrado con una rama por alternativa.</li>
          <li>En cada rama que lleva a una situación incierta se dibuja un círculo con una rama por evento y su probabilidad.</li>
          <li>Se escribe en cada rama su pago (aquí, el costo de construir, en negativo) y al final de cada camino el resultado.</li>
        </ol>
        <Figure caption="Figura 2. El árbol planteado. Debajo de cada rama están su probabilidad y su pago.">
          <div style={overflow}><ArbolSVG arbol={PLANTA} etiqueta="Árbol de la planta, sin resolver" /></div>
        </Figure>
      </Section>

      <Section title="Resolver hacia atrás">
        <p>
          Se empieza por el final del árbol y se retrocede hacia la raíz. En cada nodo se calcula un valor:
        </p>
        <Callout tone="regla" title="Inducción hacia atrás">
          <ol>
            <li>Valor de una rama = pago de la rama + valor del nodo al que llega (en una hoja, su resultado).</li>
            <li><strong>Nodo de azar:</strong> valor esperado, VE = suma de (probabilidad × valor de la rama).</li>
            <li><strong>Nodo de decisión:</strong> el mayor valor entre sus ramas si maximizas utilidad, o el menor si minimizas costo. Las otras ramas se descartan (doble raya).</li>
            <li>Al llegar a la raíz se tiene el valor del árbol; las ramas elegidas desde la raíz forman el camino óptimo.</li>
          </ol>
        </Callout>
        <p>En el ejemplo, los dos nodos de azar son los primeros en resolverse:</p>
        <Formula>VE(grande) = 0,6 × 300 + 0,4 × 60 = {num(VE_GRANDE)} &nbsp;→&nbsp; {num(VE_GRANDE)} − 120 = {num(RAMAS[0].total)}</Formula>
        <Formula>VE(pequeña) = 0,6 × 150 + 0,4 × 90 = {num(VE_PEQ)} &nbsp;→&nbsp; {num(VE_PEQ)} − 50 = {num(RAMAS[1].total)}</Formula>
        <p>
          Después se resuelve la decisión: se comparan {num(RAMAS[0].total)} (grande), {num(RAMAS[1].total)} (pequeña) y 0 (no construir). El máximo es {num(EV_PLANTA.valor)}: conviene construir la planta grande.
        </p>
        <Figure caption="Figura 3. El árbol resuelto. Azul: camino óptimo. Doble raya roja: ramas descartadas. VE y Valor muestran el resultado de cada nodo.">
          <div style={overflow}><ArbolSVG arbol={PLANTA} evaluacion={EV_PLANTA} camino etiqueta="Árbol de la planta, resuelto" /></div>
        </Figure>
        <p>
          Verlo paso a paso: <a href={hrefTopic('decision-arboles', 'paso')}>pestaña Paso a paso</a>.
        </p>
      </Section>

      <Section title="Minimizar costos">
        <p>
          Si los pagos son costos, el criterio se invierte: en los nodos de decisión se elige el <strong>menor</strong> valor; los nodos de azar siguen siendo un valor esperado. Ejemplo (mantenimiento de una máquina): preventivo cuesta 40 y la falla (100) ocurre con probabilidad 0,1, así que vale {num(MANT.porNodo.n1.ramas[0].total)}; solo reparar deja la falla (180) con probabilidad 0,35 y vale {num(MANT.porNodo.n1.ramas[1].total)}; reemplazar cuesta 90. Se elige el preventivo, con costo esperado {num(MANT.valor)}.
        </p>
      </Section>

      <Section title="Varias decisiones en secuencia">
        <p>
          En un árbol con una segunda decisión, lo que se elige allí puede cambiar según lo que ocurrió antes. El resultado no es una sola alternativa sino una <strong>estrategia</strong>: «si pasa esto, haz aquello».
        </p>
        <p>
          Ejemplo: lanzar cuesta 30. Si la acogida es buena (0,4) se decide si expandir (cuesta 50). Con expansión el mercado deja 250 con probabilidad 0,7 u 80 con 0,3 (VE = {num(LANZ.porNodo.n4.valor)}, y la rama vale {num(LANZ.porNodo.n3.ramas[0].total)}); sin expandir deja 100. Se expande. Con acogida regular (0,6) se obtienen 20. El valor del nodo «Acogida» es 0,4 × {num(LANZ.porNodo.n3.valor)} + 0,6 × 20 = {num(LANZ.porNodo.n2.valor)} y el de lanzar es {num(LANZ.porNodo.n2.valor)} − 30 = {num(LANZ.valor)}, mejor que no lanzar (0).
        </p>
        <Callout tone="ojo" title="Decide con lo que ya sabes">
          La decisión de expandir solo se toma si la acogida fue buena. Por eso se resuelve primero el nodo de la derecha y después el de azar que lo contiene, nunca al revés.
        </Callout>
      </Section>

      <Section title="Riesgo: no solo el valor esperado">
        <p>
          El valor esperado resume el árbol en un número, pero no dice cuánto se puede perder. El perfil de riesgo de la estrategia óptima lista cada resultado final con su probabilidad. Para la planta grande: {RIESGO_GRANDE.puntos.map((x) => `${num(x.valor)} con probabilidad ${num(x.p)}`).join(' y ')}. Su valor esperado es {num(RIESGO_GRANDE.esperado)}, la desviación estándar es {num(RIESGO_GRANDE.desviacion)} y la probabilidad de perder dinero es {num(RIESGO_GRANDE.pNegativo)}. La planta pequeña vale menos ({num(RAMAS[1].total)}) pero nunca da pérdida: quien no quiera arriesgarse puede preferirla aunque su valor esperado sea menor.
        </p>
      </Section>

      <Section title="Sensibilidad de una probabilidad">
        <p>
          Las probabilidades suelen ser estimaciones. El análisis de sensibilidad hace variar una (por ejemplo, la probabilidad de demanda alta) y mira si la decisión cambia. El valor de p donde dos alternativas valen lo mismo es el <strong>punto de indiferencia</strong>.
        </p>
        <p>
          Con p = probabilidad de demanda alta: grande vale 300p + 60(1 − p) − 120 = 240p − 60 y pequeña vale 150p + 90(1 − p) − 50 = 60p + 40. Se igualan: 240p − 60 = 60p + 40, así que p* = 100/180 = {num(P_STAR)}. Con p mayor que {num(P_STAR)} conviene la grande; con p menor, la pequeña. Como la estimación fue 0,6, la decisión es poco robusta: está apenas por encima del punto de cambio.
        </p>
        <Figure caption="Figura 4. Valor de cada alternativa según p. La línea azul es el valor óptimo; en p* (rojo) cambia la decisión.">
          <div style={overflow}><GraficaSensibilidad datos={SENS_PLANTA} p={0.6} unidad="millones" /></div>
        </Figure>
        <p>
          En <a href={hrefTopic('decision-arboles', 'resuelve')}>Resuelve el tuyo</a> puedes hacerlo con cualquier nodo de azar de tu árbol.
        </p>
      </Section>

      <Section title="Árbol con información (muestra)">
        <p>
          Una decisión puede incluir comprar información antes de decidir, por ejemplo un estudio de mercado de {COSTO_ESTUDIO} (en el árbol, un pago negativo en la rama «Hacer el estudio»). El estudio sale favorable con probabilidad 0,55, y las probabilidades de demanda cambian según el resultado. Lanzar deja 200 con demanda alta y −80 con demanda baja; sin estudio, la probabilidad de demanda alta es {P_ALTA_SIN}.
        </p>
        <ul className="defs">
          <li><strong>Con estudio:</strong> si es favorable se lanza (valor 144); si es desfavorable no se lanza (0). {num(0.55)} × 144 + {num(0.45)} × 0 − {COSTO_ESTUDIO} = <strong>{num(CON_ESTUDIO.total)}</strong>.</li>
          <li><strong>Sin estudio:</strong> lanzar vale {num(P_ALTA_SIN)} × 200 + {num(1 - P_ALTA_SIN)} × (−80) = <strong>{num(SIN_ESTUDIO.total)}</strong>.</li>
        </ul>
        <p>
          Conviene hacer el estudio. Lo que aporta, sin contar su costo, es el <strong>valor esperado de la información muestral</strong>: {num(CON_ESTUDIO.total + COSTO_ESTUDIO)} − {num(SIN_ESTUDIO.total)} = {num(VEIM)}; como supera el costo ({COSTO_ESTUDIO}), vale la pena. Una información perfecta sobre la demanda valdría más: {num(P_ALTA_SIN)} × 200 + {num(1 - P_ALTA_SIN)} × 0 − {num(SIN_ESTUDIO.total)} = {num(VEIP)} (valor esperado de la información perfecta, VEIP). La información de una muestra nunca vale más que la perfecta. Más sobre cómo se obtienen las probabilidades de cada resultado en <a href={hrefTopic('decision-bayes')}>2.1 Teoría bayesiana</a>.
        </p>
      </Section>

      <Section title="Errores frecuentes">
        <ol>
          <li>
            <strong>Elegir el máximo en un nodo de azar.</strong> En un nodo de azar no eliges: ocurre un evento. Se promedia con las probabilidades.
          </li>
          <li>
            <strong>Resolver de izquierda a derecha.</strong> El valor de un nodo depende de lo que viene después; hay que empezar por las hojas.
          </li>
          <li>
            <strong>Olvidar el pago de la rama.</strong> Los costos de invertir o de comprar información se suman al valor del nodo siguiente. En la planta grande, {num(VE_GRANDE)} no es el valor de la rama: son {num(RAMAS[0].total)} después de restar 120.
          </li>
          <li>
            <strong>Probabilidades que no suman 1.</strong> En cada nodo de azar la suma debe ser exactamente 1; si falta una, se deduce como 1 menos las demás.
          </li>
          <li>
            <strong>Minimizar con el criterio de maximizar.</strong> Con costos, la mejor rama de una decisión es la de menor valor.
          </li>
        </ol>
      </Section>

      <Section title="Fuentes y práctica">
        <p>
          <strong>Fuentes:</strong> Hillier, F. S. y Lieberman, G. J., <em>Introducción a la investigación de operaciones</em>, 7.ª ed.; Taha, H. A., <em>Investigación de operaciones</em>, 7.ª ed. La notación (símbolos, VE, pagos en las ramas) se puede ajustar al material oficial del curso.
        </p>
        <ul className="defs">
          <li><a href={hrefTopic('decision-arboles', 'resuelve')}>Resuelve el tuyo</a>: arma tu árbol, obtén el camino óptimo, el riesgo y la sensibilidad.</li>
          <li><a href={hrefTopic('decision-arboles', 'paso')}>Paso a paso</a>: ve la inducción hacia atrás nodo por nodo.</li>
          <li><a href={hrefTopic('decision-arboles', 'practica')}>Práctica</a>: ejercicios con corrección.</li>
        </ul>
      </Section>
    </Article>
  );
}
