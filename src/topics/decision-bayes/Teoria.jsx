import { Article, Section, Callout, Figure, Formula } from '@/ui/Article.jsx';
import { hrefTopic } from '@/app/router.js';
import { analizar } from '@/tools/bayes/domain/bayes.js';
import { ejemploPorId } from '@/tools/bayes/domain/ejemplos.js';
import { fmtNum } from '@/tools/bayes/domain/formato.js';
import '@/tools/bayes/bayes.css';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";
const BLUE = '#1d3f8f';
const RED = '#b3261e';

const P = ejemploPorId('B1').problema;
const A = analizar(P);
const M = A.muestral;

const halo = { paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3.5, strokeLinejoin: 'round' };

function T({ x, y, anchor = 'middle', size = 13, fill = '#000', weight, children }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontFamily={SERIF} fontSize={size} fill={fill} fontWeight={weight}>
      {children}
    </text>
  );
}

/* ==========================================================================
   Figura 1: de la a priori a la posterior (una cadena de cinco pasos)
   ========================================================================== */
function FiguraCadena() {
  const cajas = [
    { t: 'A priori', f: 'P(Petróleo)', n: fmtNum(P.priori[0]) },
    { t: 'Verosimilitud', f: 'P(Favorable | Petróleo)', n: fmtNum(P.verosimilitud[0][0]) },
    { t: 'Conjunta', f: 'P(Petróleo y Favorable)', n: `${fmtNum(P.priori[0])} · ${fmtNum(P.verosimilitud[0][0])} = ${fmtNum(M.conjunta[0][0])}` },
    { t: 'Marginal', f: 'P(Favorable)', n: `${fmtNum(M.conjunta[0][0])} + ${fmtNum(M.conjunta[1][0])} = ${fmtNum(M.marginal[0])}` },
    { t: 'Posterior', f: 'P(Petróleo | Favorable)', n: `${fmtNum(M.conjunta[0][0])} / ${fmtNum(M.marginal[0])} = ${fmtNum(M.posterior[0][0])}` },
  ];
  const w = 158;
  const gap = 30;
  const W = 5 * w + 4 * gap + 20;
  const signos = ['×', '=', 'Σ', '÷'];
  return (
    <svg
      viewBox={`0 0 ${W} 120`}
      style={{ width: '100%', maxWidth: W, minWidth: 640 }}
      role="img"
      aria-label="Cadena de cálculo: la probabilidad a priori 0,3 se multiplica por la verosimilitud 0,8 y da la conjunta 0,24; la marginal 0,45 suma la columna de conjuntas; la posterior es 0,24 dividido entre 0,45, igual a 0,5333."
      className="bz-fig"
    >
      {cajas.map((c, i) => {
        const x = 10 + i * (w + gap);
        const ultimo = i === cajas.length - 1;
        const col = ultimo ? BLUE : '#000';
        return (
          <g key={c.t}>
            <rect x={x} y={26} width={w} height={74} rx="4" fill="#fff" stroke={col} strokeWidth={ultimo ? 2.4 : 1.2} />
            <T x={x + w / 2} y={46} weight={600} fill={col}>{c.t}</T>
            <T x={x + w / 2} y={64} size={12} fill={col}>{c.f}</T>
            <T x={x + w / 2} y={88} size={13} fill={col} weight={ultimo ? 600 : undefined}>{c.n}</T>
            {i < cajas.length - 1 && (
              <g>
                <line x1={x + w + 3} y1={63} x2={x + w + gap - 3} y2={63} stroke="#000" strokeWidth="1.1" />
                <path d={`M ${x + w + gap - 3} 63 l -6 -3.5 v 7 z`} fill="#000" />
                <text x={x + w + gap / 2} y={56} textAnchor="middle" fontFamily={SERIF} fontSize="10.5" {...halo}>{signos[i]}</text>
              </g>
            )}
          </g>
        );
      })}
      <T x={W / 2} y={14} size={11.5} fill="#62625d">Se repite para cada estado y cada resultado del indicador</T>
    </svg>
  );
}

/* ==========================================================================
   Figura 2: la información cambia las probabilidades (a priori frente a posteriores)
   ========================================================================== */
function FiguraBarras() {
  const x0 = 70;
  const yb = 200;
  const alto = 150;
  const y = (v) => yb - v * alto;
  const grupos = P.estados.map((e, j) => ({
    e,
    barras: [
      { v: P.priori[j], estilo: 'prior' },
      { v: M.posterior[j][0], estilo: 'fav' },
      { v: M.posterior[j][1], estilo: 'des' },
    ],
  }));
  const ancho = 44;
  const sepGrupo = 190;
  const estilo = {
    prior: { fill: '#fff', stroke: '#000' },
    fav: { fill: BLUE, stroke: BLUE },
    des: { fill: '#000', stroke: '#000' },
  };
  const marcas = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg
      viewBox="0 0 560 250"
      style={{ width: '100%', maxWidth: 560, minWidth: 480 }}
      role="img"
      aria-label="Barras con la probabilidad de petróleo y de terreno seco: a priori 0,3 y 0,7; si el estudio es favorable 0,5333 y 0,4667; si es desfavorable 0,1091 y 0,8909."
      className="bz-fig"
    >
      <line x1={x0 - 10} y1={y(0)} x2={x0 + 2 * sepGrupo - 20} y2={y(0)} stroke="#000" strokeWidth="1.1" />
      <line x1={x0 - 10} y1={y(1)} x2={x0 - 10} y2={y(0)} stroke="#000" strokeWidth="1.1" />
      {marcas.map((m) => (
        <g key={m}>
          <line x1={x0 - 14} y1={y(m)} x2={x0 - 10} y2={y(m)} stroke="#000" strokeWidth="1" />
          <T x={x0 - 18} y={y(m) + 4} anchor="end" size={11.5}>{fmtNum(m)}</T>
        </g>
      ))}
      {grupos.map((g, gi) => (
        <g key={g.e}>
          {g.barras.map((b, bi) => {
            const bx = x0 + gi * sepGrupo + bi * (ancho + 6);
            return (
              <g key={bi}>
                <rect x={bx} y={y(b.v)} width={ancho} height={b.v * alto} fill={estilo[b.estilo].fill} stroke={estilo[b.estilo].stroke} strokeWidth="1.2" />
                <T x={bx + ancho / 2} y={y(b.v) - 5} size={11.5}>{fmtNum(b.v)}</T>
              </g>
            );
          })}
          <T x={x0 + gi * sepGrupo + (3 * ancho + 12) / 2} y={y(0) + 18} size={13} weight={600}>{g.e}</T>
        </g>
      ))}
      <T x={x0 - 10} y={20} anchor="start" size={12} fill="#62625d">Probabilidad</T>
      {[['prior', 'A priori'], ['fav', 'Posterior si es favorable'], ['des', 'Posterior si es desfavorable']].map(([k, txt], i) => (
        <g key={k}>
          <rect x={425} y={60 + i * 24} width={14} height={14} fill={estilo[k].fill} stroke={estilo[k].stroke} strokeWidth="1.2" />
          <T x={445} y={72 + i * 24} anchor="start" size={11.5}>{txt}</T>
        </g>
      ))}
    </svg>
  );
}

/* ==========================================================================
   Figura 3: cuánto vale la información (escalera de valores esperados)
   ========================================================================== */
function FiguraEscalera() {
  const base = 235;
  const esc = 1.05;
  const y = (v) => base - v * esc;
  const vesi = A.sinInfo.valor;
  const vecim = M.vecim;
  const vecip = A.perfecta.vecip;
  const x = 150;
  const w = 90;
  const marcas = [0, 50, 100, 150, 200];
  return (
    <svg
      viewBox="0 0 640 265"
      style={{ width: '100%', maxWidth: 640, minWidth: 560 }}
      role="img"
      aria-label="Barra apilada de valores esperados: 80 sin información; 132 con la información muestral, es decir 52 más; 192 con información perfecta, es decir 112 más que sin información."
      className="bz-fig"
    >
      <line x1={x - 30} y1={y(0)} x2={x - 30} y2={y(200)} stroke="#000" strokeWidth="1.1" />
      {marcas.map((m) => (
        <g key={m}>
          <line x1={x - 34} y1={y(m)} x2={x - 30} y2={y(m)} stroke="#000" strokeWidth="1" />
          <T x={x - 38} y={y(m) + 4} anchor="end" size={11.5}>{m}</T>
        </g>
      ))}
      <rect x={x} y={y(vesi)} width={w} height={vesi * esc} fill="#fff" stroke="#000" strokeWidth="1.2" />
      <rect x={x} y={y(vecim)} width={w} height={(vecim - vesi) * esc} fill="#eaeef7" stroke={BLUE} strokeWidth="1.6" />
      <rect x={x} y={y(vecip)} width={w} height={(vecip - vecim) * esc} fill="#fff" stroke="#000" strokeWidth="1.2" strokeDasharray="4 3" />
      <T x={x + w / 2} y={y(vesi / 2) + 4} size={12.5}>{fmtNum(vesi)}</T>
      <T x={x + w / 2} y={y((vesi + vecim) / 2) + 4} size={12.5} fill={BLUE} weight={600}>{`+${fmtNum(M.veim)}`}</T>
      <T x={x + w / 2} y={y((vecim + vecip) / 2) + 4} size={12.5}>{`+${fmtNum(vecip - vecim)}`}</T>
      {/* niveles */}
      {[[vesi, 'VE sin información', '#000'], [vecim, 'VEcIM', BLUE], [vecip, 'VEcIP', '#000']].map(([v, t, c]) => (
        <g key={t}>
          <line x1={x + w} y1={y(v)} x2={x + w + 30} y2={y(v)} stroke={c} strokeWidth="1" />
          <T x={x + w + 36} y={y(v) + 4} anchor="start" size={12.5} fill={c} weight={t === 'VEcIM' ? 600 : undefined}>{`${t} = ${fmtNum(v)}`}</T>
        </g>
      ))}
      {/* corchetes de VEIM y VEIP */}
      <path d={`M ${x - 52} ${y(vesi)} h -8 V ${y(vecim)} h 8`} fill="none" stroke={BLUE} strokeWidth="1.4" />
      <T x={x - 66} y={y((vesi + vecim) / 2) + 4} anchor="end" size={12.5} fill={BLUE} weight={600}>{`VEIM = ${fmtNum(M.veim)}`}</T>
      <path d={`M ${x + w + 250} ${y(vesi)} h 8 V ${y(vecip)} h -8`} fill="none" stroke={RED} strokeWidth="1.4" />
      <T x={x + w + 266} y={y((vesi + vecip) / 2) + 4} anchor="start" size={12.5} fill={RED} weight={600}>{`VEIP = ${fmtNum(A.perfecta.veip)}`}</T>
    </svg>
  );
}

export default function Teoria() {
  return (
    <Article>
      <Section title="Qué problema resuelve">
        <p>
          Hay que escoger entre varias <strong>alternativas</strong> sin saber cuál <strong>estado de la naturaleza</strong> ocurrirá. Cada combinación alternativa-estado tiene un <strong>pago</strong> (una utilidad o un costo), y de cada estado se conoce una <strong>probabilidad a priori</strong>, es decir, lo que se cree antes de recibir cualquier información adicional.
        </p>
        <p>Ejemplo que seguiremos en toda la página. Una empresa tiene un terreno que puede tener petróleo o estar seco, y decide entre perforar o venderlo. Pagos en millones:</p>
        <table className="mini-table">
          <thead>
            <tr><th>Alternativa</th><th>Petróleo</th><th>Seco</th></tr>
          </thead>
          <tbody>
            <tr><td>Perforar</td><td>500</td><td>−100</td></tr>
            <tr><td>Vender</td><td>60</td><td>60</td></tr>
            <tr><td><em>P</em>(estado) a priori</td><td>0,3</td><td>0,7</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Criterio de Bayes: valor esperado">
        <p>
          Sin información adicional, el criterio de Bayes calcula el <strong>valor esperado</strong> (VE) de cada alternativa, ponderando cada pago con la probabilidad a priori de su estado, y escoge la alternativa con el mejor valor.
        </p>
        <Formula>VE(<em>a</em>) = Σ<sub><em>j</em></sub> <em>P</em>(<em>E</em><sub><em>j</em></sub>) · pago(<em>a</em>, <em>E</em><sub><em>j</em></sub>)</Formula>
        <p>
          En el ejemplo: VE(Perforar) = 0,3·500 + 0,7·(−100) = 80 y VE(Vender) = 0,3·60 + 0,7·60 = 60. Se perfora, con valor esperado 80.
        </p>
        <Callout tone="regla" title="Utilidades o costos">
          Si los pagos son utilidades se escoge el VE <em>mayor</em>. Si son costos se escoge el VE <em>menor</em>. Todo lo demás de la página se aplica igual, cambiando «máximo» por «mínimo» y el orden de las restas (se explica en cada fórmula).
        </Callout>
      </Section>

      <Section title="Si no hay probabilidades">
        <p>
          Cuando no se conocen las probabilidades hay criterios que solo miran la matriz de pagos: el <strong>pesimista</strong> (maximin con utilidades, minimax con costos) escoge la alternativa con el mejor peor pago; el <strong>optimista</strong> (maximax o minimin) la del mejor mejor pago; el de <strong>Laplace</strong> supone todos los estados igual de probables y promedia; el de <strong>Savage</strong> calcula el arrepentimiento (cuánto se pierde frente al mejor pago de cada estado) y escoge el menor arrepentimiento máximo.
        </p>
        <table className="mini-table">
          <thead>
            <tr><th>Alternativa</th><th>Peor</th><th>Mejor</th><th>Promedio</th><th>Arrepentimiento máx.</th></tr>
          </thead>
          <tbody>
            <tr><td>Perforar</td><td>−100</td><td>500</td><td>200</td><td>160</td></tr>
            <tr><td>Vender</td><td>60</td><td>60</td><td>60</td><td>440</td></tr>
          </tbody>
        </table>
        <p>
          El pesimista escoge Vender (60 es el mejor de los peores); los otros tres escogen Perforar. Con probabilidades conocidas el criterio de Bayes aprovecha más información, por eso es el que se usa de aquí en adelante.
        </p>
      </Section>

      <Section title="Información perfecta: cuánto vale saber el estado">
        <p>
          Imagina que alguien te dijera con certeza qué estado ocurrirá antes de decidir. Elegirías la mejor alternativa de cada estado: 500 (perforar) si hay petróleo y 60 (vender) si está seco. Como no sabes de antemano qué dirá, se pondera con las probabilidades a priori:
        </p>
        <Formula>VEcIP = Σ<sub><em>j</em></sub> <em>P</em>(<em>E</em><sub><em>j</em></sub>) · (mejor pago del estado <em>E</em><sub><em>j</em></sub>)</Formula>
        <p>VEcIP = 0,3·500 + 0,7·60 = 192. El <strong>valor esperado de la información perfecta</strong> es lo que mejora esto frente a decidir sin información:</p>
        <Formula>VEIP = VEcIP − VE sin información = 192 − 80 = 112</Formula>
        <p>
          Con costos se resta al revés (VE sin información − VEcIP), de modo que el VEIP nunca sea negativo. El VEIP es un techo: ninguna información, por buena que sea, puede valer más.
        </p>
      </Section>

      <Section title="Información muestral: actualizar con el teorema de Bayes">
        <p>
          Casi nunca hay información perfecta. Lo habitual es un estudio, una prueba o una encuesta (un <strong>indicador</strong>) que se acerca al estado sin revelarlo. Su fiabilidad se resume en la <strong>verosimilitud</strong> <em>P</em>(resultado | estado). Aquí un estudio sísmico:
        </p>
        <table className="mini-table">
          <thead>
            <tr><th>Estado</th><th>Favorable</th><th>Desfavorable</th></tr>
          </thead>
          <tbody>
            <tr><td>Petróleo</td><td>0,8</td><td>0,2</td></tr>
            <tr><td>Seco</td><td>0,3</td><td>0,7</td></tr>
          </tbody>
        </table>
        <p>Cada fila suma 1. Con ella se actualizan las probabilidades en tres pasos:</p>
        <ol>
          <li><strong>Conjunta:</strong> <em>P</em>(estado y resultado) = <em>P</em>(estado) · <em>P</em>(resultado | estado).</li>
          <li><strong>Marginal:</strong> <em>P</em>(resultado) = suma de las conjuntas de ese resultado en todos los estados.</li>
          <li><strong>Posterior</strong> (teorema de Bayes): <em>P</em>(estado | resultado) = <em>P</em>(estado y resultado) / <em>P</em>(resultado).</li>
        </ol>
        <Figure caption="Figura 1. Del dato a la posterior para «petróleo» cuando el estudio sale favorable. Se repite para cada estado y cada resultado.">
          <div style={{ overflowX: 'auto' }}><FiguraCadena /></div>
        </Figure>
        <table className="mini-table">
          <thead>
            <tr><th>Estado</th><th>Conj. favorable</th><th>Conj. desfavorable</th></tr>
          </thead>
          <tbody>
            <tr><td>Petróleo</td><td>0,3·0,8 = 0,24</td><td>0,3·0,2 = 0,06</td></tr>
            <tr><td>Seco</td><td>0,7·0,3 = 0,21</td><td>0,7·0,7 = 0,49</td></tr>
            <tr><td><em>P</em>(resultado)</td><td>0,45</td><td>0,55</td></tr>
          </tbody>
        </table>
        <p>
          Posteriores: si el estudio es favorable, <em>P</em>(petróleo | favorable) = 0,24/0,45 = 0,5333 y <em>P</em>(seco | favorable) = 0,4667. Si es desfavorable, 0,06/0,55 = 0,1091 y 0,8909 para seco. Las posteriores de un mismo resultado siempre suman 1.
        </p>
        <Figure caption="Figura 2. Un estudio favorable sube la probabilidad de petróleo de 0,3 a 0,5333; uno desfavorable la baja a 0,1091.">
          <div style={{ overflowX: 'auto' }}><FiguraBarras /></div>
        </Figure>
      </Section>

      <Section title="Decisión según el resultado, VEIM y eficiencia">
        <p>
          Con el resultado en la mano se repite el criterio de Bayes, pero con las <strong>posteriores</strong> en lugar de las a priori:
        </p>
        <ul className="defs">
          <li>Favorable: VE(Perforar) = 0,5333·500 + 0,4667·(−100) = 220 y VE(Vender) = 60. Se perfora.</li>
          <li>Desfavorable: VE(Perforar) = 0,1091·500 + 0,8909·(−100) ≈ −34,5 y VE(Vender) = 60. Se vende.</li>
        </ul>
        <p>Esa regla (qué hacer según lo que salga) se pondera con las marginales:</p>
        <Formula>VEcIM = Σ<sub><em>k</em></sub> <em>P</em>(<em>z</em><sub><em>k</em></sub>) · (mejor VE con las posteriores de <em>z</em><sub><em>k</em></sub>) = 0,45·220 + 0,55·60 = 132</Formula>
        <Formula>VEIM = VEcIM − VE sin información = 132 − 80 = 52</Formula>
        <p>
          El VEIM es lo máximo que conviene pagar por el estudio. Se compara con el VEIP con la <strong>eficiencia</strong> de la información:
        </p>
        <Formula>Eficiencia = VEIM / VEIP = 52 / 112 = 46,4 %</Formula>
        <p>
          Siempre se cumple 0 ≤ VEIM ≤ VEIP. Con costos el VEIM se calcula como VE sin información − VEcIM.
        </p>
        <Figure caption="Figura 3. El estudio recupera 52 de los 112 que valdría saber el estado con certeza.">
          <div style={{ overflowX: 'auto' }}><FiguraEscalera /></div>
        </Figure>
      </Section>

      <Section title="Errores frecuentes">
        <ol>
          <li>
            <strong>Quedarse en la conjunta.</strong> 0,24 no es la posterior: falta dividir entre <em>P</em>(favorable) = 0,45.
          </li>
          <li>
            <strong>Usar las a priori después del resultado.</strong> Con el estudio desfavorable la mejor decisión cambia (de perforar a vender): hay que recalcular con las posteriores.
          </li>
          <li>
            <strong>Confundir <em>P</em>(resultado | estado) con <em>P</em>(estado | resultado).</strong> La primera es la verosimilitud (dato del problema) y la segunda es la posterior (se calcula).
          </li>
          <li>
            <strong>Restar al revés con costos.</strong> Con costos el VEIP es VE sin información − VEcIP; un VEIP negativo indica que se restó mal.
          </li>
        </ol>
      </Section>

      <Section title="Fuentes y práctica">
        <p>
          <strong>Fuentes:</strong> Hillier, F. S. y Lieberman, G. J., <em>Introducción a la investigación de operaciones</em>, 7.ª ed.; Taha, H. A., <em>Investigación de operaciones</em>, 7.ª ed.
        </p>
        <ul className="defs">
          <li><a href={hrefTopic('decision-bayes', 'paso')}>Paso a paso</a>: el ejemplo del terreno resuelto un paso a la vez, con las tablas llenándose.</li>
          <li><a href={hrefTopic('decision-bayes', 'resuelve')}>Resuelve el tuyo</a>: escribes la matriz de pagos, las a priori y la verosimilitud y obtienes todas las tablas.</li>
          <li><a href={hrefTopic('decision-bayes', 'practica')}>Práctica</a>: ejercicios que cambian de números, con corrección.</li>
        </ul>
      </Section>
    </Article>
  );
}
