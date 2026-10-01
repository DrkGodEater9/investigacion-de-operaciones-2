import { Article, Section, Callout, Figure } from '@/ui/Article.jsx';
import { hrefTopic } from '@/app/router.js';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";

/** Evento en miniatura: círculo partido con el número arriba. */
function Node({ x, y, n, r = 19, times }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={r} fill="#fff" stroke="#000" strokeWidth="1.4" />
      <line x1={-r} x2={r} y1="0" y2="0" stroke="#000" strokeWidth="1.1" />
      <line x1="0" x2="0" y1="0" y2={r} stroke="#000" strokeWidth="1.1" />
      <text y={-r * 0.52} textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontSize="13">{n}</text>
      {times && (
        <>
          <text x={-r * 0.47} y={r * 0.5} textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontSize="10">{times[0]}</text>
          <text x={r * 0.47} y={r * 0.5} textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontSize="10">{times[1]}</text>
        </>
      )}
    </g>
  );
}

/** Flecha recta entre dos eventos, con su etiqueta. */
function Arrow({ from, to, label, dummy, r = 19, dy = -9, dx = 0 }) {
  const vx = to.x - from.x;
  const vy = to.y - from.y;
  const L = Math.hypot(vx, vy);
  const ux = vx / L;
  const uy = vy / L;
  const a = { x: from.x + ux * r, y: from.y + uy * r };
  const b = { x: to.x - ux * r, y: to.y - uy * r };
  const hx = b.x - ux * 10;
  const hy = b.y - uy * 10;
  const head = `M${b.x},${b.y} L${hx - uy * 3.8},${hy + ux * 3.8} L${hx + uy * 3.8},${hy - ux * 3.8} Z`;
  return (
    <g>
      <line x1={a.x} y1={a.y} x2={hx} y2={hy} stroke="#000" strokeWidth="1.3" strokeDasharray={dummy ? '6 4' : undefined} />
      <path d={head} fill="#000" />
      {label && (
        <text x={(a.x + b.x) / 2 + dx} y={(a.y + b.y) / 2 + dy} textAnchor="middle" fontFamily={SERIF} fontSize="14" fontStyle={dummy ? 'italic' : 'normal'}>{label}</text>
      )}
    </g>
  );
}

function EventAnatomy() {
  const label = (x, y, anchor, lines) => (
    <text x={x} y={y} textAnchor={anchor} fontFamily={SERIF} fontSize="15">
      {lines.map((t, k) => <tspan key={t} x={x} dy={k ? 18 : 0}>{t}</tspan>)}
    </text>
  );
  return (
    <svg viewBox="0 0 640 200" role="img" aria-label="Partes de un evento" style={{ width: '100%', maxWidth: 640 }}>
      <g transform="translate(320,100)">
        <circle r="62" fill="#fff" stroke="#000" strokeWidth="1.8" />
        <line x1="-62" x2="62" y1="0" y2="0" stroke="#000" strokeWidth="1.5" />
        <line x1="0" x2="0" y1="0" y2="62" stroke="#000" strokeWidth="1.5" />
        <text y="-28" textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontSize="30">i</text>
        <text x="-31" y="32" textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontSize="24">12</text>
        <text x="31" y="32" textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontSize="24">15</text>
      </g>
      <g fill="none" stroke="#000" strokeWidth="0.9">
        <path d="M 338 72 L 395 40" />
        <path d="M 263 125 L 228 150" />
        <path d="M 377 125 L 412 150" />
      </g>
      {label(402, 38, 'start', ['Número del evento'])}
      {label(218, 152, 'end', ['Tiempo más temprano', '(se va sumando)'])}
      {label(422, 152, 'start', ['Tiempo más tardío', '(se va restando)'])}
    </svg>
  );
}

function DummyExample() {
  const p1 = { x: 40, y: 100 };
  const p2 = { x: 180, y: 40 }; // fin de B
  const p3 = { x: 180, y: 160 }; // fin de A
  const p4 = { x: 330, y: 100 };
  return (
    <svg viewBox="0 0 380 200" role="img" aria-label="Red con una actividad ficticia" style={{ width: '100%', maxWidth: 420 }}>
      <Arrow from={p1} to={p2} label="B" dy={-10} dx={-8} />
      <Arrow from={p1} to={p3} label="A" dy={14} dx={-10} />
      <Arrow from={p2} to={p3} label="ficticia" dummy dx={30} dy={4} />
      <Arrow from={p3} to={p4} label="C" dy={14} dx={14} />
      <Arrow from={p2} to={p4} label="D" dy={-10} dx={14} />
      <Node {...p1} n="1" />
      <Node {...p2} n="2" />
      <Node {...p3} n="3" />
      <Node {...p4} n="4" />
    </svg>
  );
}

export default function Teoria() {
  return (
    <Article>
      <Section title="Qué es una red de proyecto">
        <p>
          Un proyecto se descompone en <strong>actividades</strong>: tareas con una duración, que no pueden empezar hasta que terminen otras. La red es un dibujo que muestra qué actividades hay y en qué orden deben hacerse. Con ella se calcula cuánto dura el proyecto y cuáles actividades no admiten retraso, que es lo que se ve en <a href={hrefTopic('redes-tiempos')}>3.2 Análisis del tiempo</a>.
        </p>
        <p>
          Antes de calcular nada hay que dibujar bien la red. Un dibujo mal armado da duraciones equivocadas, así que este tema trata de las reglas para construirla.
        </p>
      </Section>

      <Section title="Elementos básicos">
        <ul className="defs">
          <li><strong>Actividad.</strong> Una tarea que consume tiempo y recursos. Se dibuja como una flecha con su nombre y su duración.</li>
          <li><strong>Evento.</strong> El instante en que terminan todas las actividades que llegan a él y pueden empezar las que salen. No consume tiempo. Se dibuja como un círculo.</li>
          <li><strong>Actividad ficticia.</strong> Una flecha discontinua que dura 0. No es una tarea real: solo sirve para dibujar una dependencia que de otra forma no se podría representar.</li>
        </ul>
        <Figure caption="Un evento se dibuja como un círculo partido. Las dos mitades de abajo se llenan al calcular los tiempos (tema 3.2).">
          <EventAnatomy />
        </Figure>
      </Section>

      <Section title="Formas y propiedades de la representación">
        <p>
          Hay dos maneras de dibujar el mismo proyecto. En la de <strong>actividad en la flecha</strong> (AOA), la que usa este sitio, las actividades son flechas y los eventos son círculos. En la de <strong>actividad en el nodo</strong> (AON), cada actividad es un recuadro y las flechas solo indican el orden.
        </p>
        <Callout tone="regla" title="Propiedades que debe cumplir la red">
          <ol>
            <li>Tiene un solo evento de inicio y uno solo de fin.</li>
            <li>Todas las flechas avanzan hacia adelante: no hay ciclos ni flechas que vuelvan atrás.</li>
            <li>Dos actividades no pueden tener el mismo evento de inicio y el mismo de fin. Si ocurre, se separa una con una ficticia.</li>
            <li>Se usan las ficticias estrictamente necesarias.</li>
          </ol>
        </Callout>
      </Section>

      <Section title="Cuándo hace falta una ficticia">
        <p>
          Sucede cuando una actividad depende de <em>parte</em> de las predecesoras de otra. Con esta tabla:
        </p>
        <table className="mini-table">
          <thead><tr><th>Actividad</th><th>Predecesoras</th></tr></thead>
          <tbody>
            <tr><td>A</td><td>-</td></tr>
            <tr><td>B</td><td>-</td></tr>
            <tr><td>C</td><td>A, B</td></tr>
            <tr><td>D</td><td>B</td></tr>
          </tbody>
        </table>
        <p>
          C necesita que terminen A y B, pero D solo necesita B. Si A y B terminaran en el mismo evento, D tendría que esperar también a A, y eso no es lo que dice la tabla. Se resuelve haciendo que B termine en su propio evento (el 2) y uniéndolo con el evento donde termina A (el 3) mediante una ficticia.
        </p>
        <Figure caption="Como la ficticia va del evento 2 al 3, C espera a A y a B, mientras que D arranca apenas termina B.">
          <DummyExample />
        </Figure>
      </Section>

      <Section title="Numeración de los eventos">
        <Callout tone="regla" title="Regla de numeración">
          Para toda actividad que va del evento <em>i</em> al evento <em>j</em> se cumple <em>i</em> &lt; <em>j</em>. Se numera de izquierda a derecha, empezando por el inicio, y un evento no recibe su número hasta que ya lo tengan todos los eventos de los que le llegan flechas.
        </Callout>
        <p>
          Gracias a esa numeración cada actividad se nombra por su par de eventos, como (1, 3), y se sabe de inmediato que ninguna flecha va hacia atrás.
        </p>
      </Section>

      <Section title="Pruébalo">
        <p>
          En la pestaña <a href={hrefTopic('redes-estructura', 'resuelve')}>Resuelve el tuyo</a> escribes la tabla de actividades y predecesoras y se dibuja la red con el mínimo de ficticias. Prueba con la tabla de arriba y compara con la figura.
        </p>
      </Section>
    </Article>
  );
}
