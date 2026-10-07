import { Article, Section, Callout, Formula, Figure } from '@/ui/Article.jsx';
import { hrefTopic } from '@/app/router.js';
import RedTiempos from '@/tools/ruta-critica/components/tiempo/RedTiempos.jsx';
import NormalCurve from '@/tools/ruta-critica/components/results/NormalCurve.jsx';
import '@/tools/ruta-critica/components/tiempo/tiempo.css';
import { analyze } from '@/tools/ruta-critica/domain/analyze.js';
import { calcularTiempos, calcularPERT } from '@/tools/ruta-critica/domain/tiempos.js';
import { EJEMPLOS_TIEMPO } from '@/tools/ruta-critica/domain/ejemplosTiempo.js';
import { phi } from '@/tools/ruta-critica/domain/normal.js';
import { fmt } from '@/tools/ruta-critica/domain/format.js';
import { NOT } from '@/tools/ruta-critica/domain/notacion.js';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";
const f = (x) => fmt(x, 2).replace('-', '−');
const f4 = (x) => fmt(x, 4).replace('-', '−');

// Los números de la teoría salen del mismo dominio que usan Paso a paso y Práctica.
const EJ = EJEMPLOS_TIEMPO.find((e) => e.id === 'cpm');
const EJP = EJEMPLOS_TIEMPO.find((e) => e.id === 'pert');
const an = analyze({ rows: EJ.rows, mode: 'cpm', decimals: 2 });
const acts = an.activities.map((a) => ({ name: a.name, preds: a.preds }));
const r = calcularTiempos(acts, (n) => an.byName.get(n).d);
const anP = analyze({ rows: EJP.rows, mode: 'pert', decimals: 2 });
const p = calcularPERT(anP.activities.map((a) => ({ name: a.name, preds: a.preds, a: a.a, m: a.m, b: a.b })));
const PLAZO = EJP.plazo;
const Z = (PLAZO - p.Te) / p.sd;
const PROB = phi(Z);

/** Una actividad sobre el eje del tiempo: duración, holgura libre y holgura total. */
function Holguras() {
  const d = { tic: 4, dur: 3, sig: 9, tfl: 12 }; // tfc = 7; HL = 9 − 7 = 2; HT = 12 − 7 = 5
  const tfc = d.tic + d.dur;
  const X0 = 36;
  const U = 40; // píxeles por unidad de tiempo
  const x = (t) => X0 + t * U;
  const yb = 78;
  const h = 26;
  const marca = (t, txt, dy = 0) => (
    <g key={t + txt}>
      <line x1={x(t)} x2={x(t)} y1={yb - 16} y2={yb + h + 10} stroke="#000" strokeWidth="0.9" strokeDasharray="3 3" />
      <text x={x(t)} y={yb + h + 28 + dy} textAnchor="middle" fontFamily={SERIF} fontSize="14">{txt}</text>
    </g>
  );
  return (
    <svg className="pt-fig" viewBox="0 0 560 190" role="img" aria-label="Una actividad con su holgura libre y su holgura total" style={{ width: '100%', maxWidth: 560 }}>
      <line x1={x(0)} x2={x(13.2)} y1={yb + h + 10} y2={yb + h + 10} stroke="#000" strokeWidth="1.1" />
      {Array.from({ length: 14 }, (_, t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={yb + h + 10} y2={yb + h + 15} stroke="#000" strokeWidth="0.8" />
          <text x={x(t)} y={yb + h + 62} textAnchor="middle" fontFamily={SERIF} fontSize="11" fill="#62625d">{t}</text>
        </g>
      ))}
      {/* barra de la actividad */}
      <rect x={x(d.tic)} y={yb} width={d.dur * U} height={h} fill="#000" />
      <text x={x(d.tic + d.dur / 2)} y={yb + h / 2 + 1} textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontSize="15" fill="#fff">duración 3</text>
      {/* holgura libre y resto de la holgura total */}
      <rect x={x(tfc)} y={yb} width={(d.sig - tfc) * U} height={h} fill="#fff" stroke="#1d3f8f" strokeWidth="1.6" />
      <text x={x((tfc + d.sig) / 2)} y={yb + h / 2 + 1} textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontSize="14" fill="#1d3f8f">{NOT.hl} = 2</text>
      <rect x={x(d.sig)} y={yb} width={(d.tfl - d.sig) * U} height={h} fill="#fff" stroke="#1d3f8f" strokeWidth="1.6" strokeDasharray="5 3" />
      <text x={x((d.sig + d.tfl) / 2)} y={yb + h / 2 + 1} textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontSize="14" fill="#1d3f8f">resto de {NOT.ht}</text>
      {/* llave de la holgura total */}
      <path d={`M ${x(tfc)} ${yb - 12} L ${x(tfc)} ${yb - 20} L ${x(d.tfl)} ${yb - 20} L ${x(d.tfl)} ${yb - 12}`} fill="none" stroke="#1d3f8f" strokeWidth="1.2" />
      <text x={x((tfc + d.tfl) / 2)} y={yb - 27} textAnchor="middle" fontFamily={SERIF} fontSize="15" fill="#1d3f8f">{NOT.ht} = {NOT.tfl} − {NOT.tfc} = 12 − 7 = 5</text>
      {marca(d.tic, NOT.tic + ' = 4')}
      {marca(tfc, NOT.tfc + ' = 7', 18)}
      {marca(d.sig, NOT.tic + ' sucesoras = 9', 0)}
      {marca(d.tfl, NOT.tfl + ' = 12', 18)}
    </svg>
  );
}

/** Forma típica de las tres estimaciones: la beta es asimétrica y el tiempo esperado se corre hacia b. */
function TresEstimaciones() {
  const a = 2; const b = 14; const alpha = 2; const beta = 4;
  const m = a + ((alpha - 1) / (alpha + beta - 2)) * (b - a); // moda de la beta
  const te = (a + 4 * m + b) / 6;
  const W = 560; const H = 200; const X0 = 40; const X1 = W - 40; const base = H - 44;
  const sx = (t) => X0 + ((t - 1) / 14) * (X1 - X0);
  const g = (t) => { const u = (t - a) / (b - a); return u <= 0 || u >= 1 ? 0 : u * (1 - u) ** 3; };
  const gmax = g(m);
  const sy = (t) => base - (g(t) / gmax) * (base - 30);
  const pts = Array.from({ length: 121 }, (_, i) => a + ((b - a) * i) / 120);
  const curva = pts.map((t, i) => `${i ? 'L' : 'M'}${sx(t)},${sy(t)}`).join(' ');
  const poste = (t, txt, dy, azul) => (
    <g key={txt}>
      <line x1={sx(t)} x2={sx(t)} y1={base} y2={sy(t)} stroke={azul ? '#1d3f8f' : '#000'} strokeWidth="1.2" strokeDasharray={azul ? '4 3' : undefined} />
      <text x={sx(t)} y={base + 20 + dy} textAnchor="middle" fontFamily={SERIF} fontSize="15" fill={azul ? '#1d3f8f' : '#000'}>{txt}</text>
    </g>
  );
  return (
    <svg className="pt-fig" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Estimaciones optimista, más probable y pesimista, con el tiempo esperado" style={{ width: '100%', maxWidth: 560 }}>
      <line x1={X0 - 10} x2={X1 + 10} y1={base} y2={base} stroke="#000" strokeWidth="1.1" />
      <path d={curva} fill="none" stroke="#000" strokeWidth="1.6" />
      {poste(a, 'a', 0)}
      {poste(m, 'm', 0)}
      {poste(b, 'b', 0)}
      {poste(te, `${NOT.te}`, 18, true)}
      <text x={X1 + 8} y={base + 36} textAnchor="end" fontFamily={SERIF} fontSize="13" fill="#62625d">tiempo de la actividad →</text>
      <text x={X0} y={20} fontFamily={SERIF} fontSize="14" fill="#62625d">Con a = 2, m = 5 y b = 14: {NOT.te} = (2 + 20 + 14) / 6 = 6</text>
    </svg>
  );
}

const celdasTiempos = r.orden.map((n) => r.fila[n]);

export default function Teoria() {
  return (
    <Article>
      <Section title="Qué se calcula">
        <p>
          Con la red de <a href={hrefTopic('redes-estructura')}>3.1 Estructura de redes</a> ya dibujada, el análisis del tiempo responde tres preguntas: cuánto dura el proyecto, qué actividades no admiten ningún atraso y cuánto se puede atrasar cada una de las demás. Se resuelve con dos recorridos sobre la red, uno hacia adelante y otro hacia atrás.
        </p>
        <p>
          Hay dos versiones. En <strong>CPM</strong> (método de la ruta crítica) cada actividad tiene una duración conocida. En <strong>PERT</strong> la duración es incierta y se estima con tres tiempos; se calcula igual que en CPM, usando el tiempo esperado, y además se mide la probabilidad de cumplir un plazo.
        </p>
      </Section>

      <Section title="Método CPM: dos recorridos">
        <p>Se usará este proyecto de seis actividades (duraciones en días). D solo necesita a B, pero C necesita a A y a B, por eso la red lleva una ficticia.</p>
        <table className="mini-table">
          <thead><tr><th>Actividad</th><th>Predecesoras</th><th>Duración</th></tr></thead>
          <tbody>
            {an.activities.map((a) => (
              <tr key={a.name}><td>{a.name}</td><td>{a.preds.join(', ') || '-'}</td><td>{f(a.d)}</td></tr>
            ))}
          </tbody>
        </table>
        <Callout tone="regla" title="Pase hacia adelante (tiempos más cercanos)">
          <ul>
            <li>{NOT.tic} de una actividad: el mayor {NOT.tfc} de sus predecesoras (0 si no tiene).</li>
            <li>{NOT.tfc} = {NOT.tic} + duración.</li>
            <li>La duración del proyecto, {NOT.T}, es el mayor {NOT.tfc} de las actividades finales.</li>
          </ul>
        </Callout>
        <Callout tone="regla" title="Pase hacia atrás (tiempos más lejanos)">
          <ul>
            <li>{NOT.tfl} de una actividad: el menor {NOT.til} de sus sucesoras ({NOT.T} si no tiene).</li>
            <li>{NOT.til} = {NOT.tfl} − duración.</li>
          </ul>
        </Callout>
        <p>
          En el ejemplo, C empieza cuando terminan A (en {f(r.fila.A.tfc)}) y B (en {f(r.fila.B.tfc)}): {NOT.tic}(C) = máx[{f(r.fila.A.tfc)}, {f(r.fila.B.tfc)}] = {f(r.fila.C.tic)}. Hacia atrás, C debe terminar a tiempo para E y F: {NOT.tfl}(C) = mín[{f(r.fila.E.til)}, {f(r.fila.F.til)}] = {f(r.fila.C.tfl)}. La duración del proyecto es {NOT.T} = {f(r.T)} días.
        </p>
        <Figure caption="La misma red con los tiempos en cada evento: abajo a la izquierda el más cercano y a la derecha el más lejano. En rojo, la ruta crítica.">
          <RedTiempos analysis={an} rutasCriticas={r.rutasCriticas} etiqueta="Red del ejemplo con los tiempos calculados" leyenda={false} />
        </Figure>
      </Section>

      <Section title="Actividad crítica y ruta crítica">
        <p>
          Una actividad es <strong>crítica</strong> cuando no tiene ninguna holgura: su {NOT.tic} es igual a su {NOT.til} (y su {NOT.tfc} a su {NOT.tfl}). Cualquier atraso en ella atrasa todo el proyecto. La <strong>ruta crítica</strong> es la cadena de actividades críticas que va del inicio al fin, y su duración es la del proyecto.
        </p>
        <p>
          Aquí las críticas son {r.criticas.join(', ')}: la ruta {r.rutasCriticas.map((x) => x.join(' → ')).join(' y ')} dura {f(r.T)} días.
        </p>
        <Callout tone="ojo" title="Puede haber más de una">
          Si dos rutas empatan en duración, las dos son críticas. Se ve en la pestaña <a href={hrefTopic('redes-tiempos', 'paso')}>Paso a paso</a> con el ejemplo de dos rutas críticas. Ojo con las actividades ficticias: no se nombran en la ruta, pero conectan actividades que sí lo son.
        </Callout>
      </Section>

      <Section title="Holguras">
        <p>La holgura es el tiempo que una actividad puede atrasarse. Hay dos clases.</p>
        <ul className="defs">
          <li><strong>Holgura total ({NOT.ht}).</strong> Lo que se puede atrasar sin atrasar el proyecto: {NOT.ht} = {NOT.til} − {NOT.tic} = {NOT.tfl} − {NOT.tfc}.</li>
          <li><strong>Holgura libre ({NOT.hl}).</strong> Lo que se puede atrasar sin atrasar el inicio más cercano de ninguna sucesora: {NOT.hl} = (menor {NOT.tic} de las sucesoras) − {NOT.tfc}.</li>
        </ul>
        <Figure caption="Una actividad que empieza en 4 y dura 3. Sus sucesoras no pueden empezar antes de 9 y el proyecto la tolera hasta 12. Siempre 0 ≤ HL ≤ HT.">
          <Holguras />
        </Figure>
        <table className="mini-table">
          <thead>
            <tr><th>Act.</th><th>{NOT.tic}</th><th>{NOT.tfc}</th><th>{NOT.til}</th><th>{NOT.tfl}</th><th>{NOT.ht}</th><th>{NOT.hl}</th><th>Crítica</th></tr>
          </thead>
          <tbody>
            {celdasTiempos.map((x) => (
              <tr key={x.name}>
                <td>{x.name}</td><td>{f(x.tic)}</td><td>{f(x.tfc)}</td><td>{f(x.til)}</td><td>{f(x.tfl)}</td><td>{f(x.ht)}</td><td>{f(x.hl)}</td><td>{x.critica ? 'Sí' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          B tiene {NOT.ht} = {f(r.fila.B.ht)} pero {NOT.hl} = {f(r.fila.B.hl)}: puede atrasarse una unidad sin atrasar el proyecto, pero si se atrasa, D arranca tarde. Toda actividad crítica tiene {NOT.ht} = 0 y por lo tanto también {NOT.hl} = 0.
        </p>
      </Section>

      <Section title="Método PERT: tiempo esperado y varianza">
        <p>
          En PERT cada actividad tiene tres estimaciones: la <strong>optimista</strong> a (si todo sale bien), la <strong>más probable</strong> m y la <strong>pesimista</strong> b (si todo sale mal). Se supone una distribución beta, de la que se toman la media y la varianza:
        </p>
        <Formula>{NOT.te} = (a + 4m + b) / 6</Formula>
        <Formula>{NOT.v} = ((b − a) / 6)²</Formula>
        <Figure caption="La distribución es asimétrica: como b está más lejos de m que a, el tiempo esperado queda a la derecha de la estimación más probable.">
          <TresEstimaciones />
        </Figure>
        <p>
          Con los {NOT.te} se hace exactamente el análisis CPM de arriba. Como las actividades son independientes, la varianza de la ruta crítica es la suma de las varianzas <em>de sus actividades</em>:
        </p>
        <Formula>{NOT.v}<sub>T</sub> = Σ {NOT.v} (actividades de la ruta crítica),  {NOT.sd}<sub>T</sub> = √{NOT.v}<sub>T</sub></Formula>
        <table className="mini-table">
          <thead><tr><th>Act.</th><th>a</th><th>m</th><th>b</th><th>{NOT.te}</th><th>{NOT.v}</th></tr></thead>
          <tbody>
            {anP.activities.map((a) => (
              <tr key={a.name}><td>{a.name}</td><td>{f(a.a)}</td><td>{f(a.m)}</td><td>{f(a.b)}</td><td>{f(a.te)}</td><td>{f4(a.var)}</td></tr>
            ))}
          </tbody>
        </table>
        <p>
          La ruta crítica es {p.ruta.join(' → ')}, con {NOT.Te} = {f(p.Te)} días. Su varianza es {p.ruta.map((n) => f4(p.por.get(n).v)).join(' + ')} = {f4(p.varianza)} y {NOT.sd} = {f4(p.sd)}.
        </p>
        <Callout tone="ojo" title="Varias rutas críticas en PERT">
          Si hay empate entre rutas críticas con distinta varianza, se toma la de mayor varianza, que es la más incierta. La pestaña Resuelve el tuyo deja elegir la ruta.
        </Callout>
      </Section>

      <Section title="Probabilidad de cumplir un plazo">
        <p>
          Por el teorema del límite central, la duración del proyecto se aproxima con una normal de media {NOT.Te} y desviación {NOT.sd}. Para hallar la probabilidad de terminar en T días o menos se estandariza y se consulta la normal estándar Φ:
        </p>
        <Formula>Z = (T − {NOT.Te}) / {NOT.sd},  P(duración ≤ T) = Φ(Z)</Formula>
        <p>
          Para terminar en {PLAZO} días: Z = ({PLAZO} − {f(p.Te)}) / {f4(p.sd)} = {f4(Z)} y P = Φ({f4(Z)}) = {f4(PROB)}, es decir, {f(PROB * 100)} %. Con la tabla normal se redondea Z a dos decimales (1,22), y se obtiene 0,8888: la diferencia con el valor exacto es de décimas de punto porcentual.
        </p>
        <Figure caption={`El área sombreada es la probabilidad de terminar en ${PLAZO} días o menos, con ${NOT.Te} = ${f(p.Te)} y ${NOT.sd} = ${f4(p.sd)}.`}>
          <div className="pt-curva" style={{ width: '100%' }}>
            <NormalCurve mean={p.Te} sd={p.sd} x={PLAZO} decimals={2} />
          </div>
        </Figure>
        <Callout tone="nota" title="Al revés también se puede">
          Si se pide el plazo que se cumple con probabilidad del 95 %, se busca Z en la tabla (1,645) y se despeja: T = {NOT.Te} + Z·{NOT.sd}. Resuelve el tuyo hace este cálculo.
        </Callout>
      </Section>

      <Section title="Pruébalo">
        <p>
          En <a href={hrefTopic('redes-tiempos', 'paso')}>Paso a paso</a> ves este ejemplo calculado actividad por actividad sobre la red; en <a href={hrefTopic('redes-tiempos', 'resuelve')}>Resuelve el tuyo</a> escribes tu tabla, y en <a href={hrefTopic('redes-tiempos', 'practica')}>Práctica</a> hay ejercicios con corrección.
        </p>
        <p className="pt-fuente">Bibliografía: Taha, <em>Investigación de operaciones</em> (análisis de redes, CPM y PERT); Hillier y Lieberman, <em>Introducción a la investigación de operaciones</em>.</p>
      </Section>
    </Article>
  );
}
