import { resumen } from '../domain/perfil.js';

/** Colores: solo tinta, azul y rojo del sitio. */
export const INK = '#000000';
export const BLUE = '#1d3f8f';
export const RED = '#b3261e';
const GRIS = '#d8d8d3';
const FONDO_AZUL = '#eaeef7';
const SERIF = "'STIX Two Text', 'Times New Roman', serif";

const LABEL_W = 46;
const PAD_R = 14;

/** Ancho de un período en el dibujo según cuántos hay (los dos gráficos comparten escala para alinear columnas). */
export function anchoPeriodo(horizonte) {
  return Math.max(24, Math.min(70, Math.floor(780 / Math.max(1, horizonte))));
}
const anchoTotal = (H) => LABEL_W + H * anchoPeriodo(H) + PAD_R;
const px = (H, t) => LABEL_W + t * anchoPeriodo(H); // borde izquierdo del período t+1

const estiloSvg = (W) => ({ width: '100%', minWidth: Math.round(W * 0.7), maxWidth: Math.round(W * 1.2), height: 'auto', display: 'block' });

/** Pasos «bonitos» para el eje vertical. */
function paso(max) {
  if (max <= 6) return 1;
  if (max <= 12) return 2;
  if (max <= 30) return 5;
  const p = 10 ** Math.floor(Math.log10(max / 4));
  return p * (max / p / 4 < 2 ? 2 : max / p / 4 < 5 ? 5 : 10);
}

/**
 * Gantt de las actividades.
 *  starts: comienzos dibujados (null = sin programar); base: resultado de cpm(); fantasma: comienzos de referencia
 *  (se dibujan con borde punteado donde difieren); resalta: {índice: 'programa'|'retrasa'|'mueve'|'foco'};
 *  periodo: período destacado (franja azul).
 */
export function GanttRecursos({ red, base, starts, horizonte, fantasma, resalta = {}, periodo = null, svgRef, titulo }) {
  const H = Math.max(1, horizonte);
  const W = anchoTotal(H);
  const u = anchoPeriodo(H);
  const orden = [...Array(red.n).keys()].sort((a, b) => base.ES[a] - base.ES[b] || base.EF[a] - base.EF[b] || a - b);
  const rowH = 24;
  const top = 26;
  const alto = top + red.n * rowH + 10;
  const x = (t) => px(H, t);
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${alto}`} role="img" style={estiloSvg(W)} aria-label={`${titulo || 'Diagrama de Gantt'}: ${red.nombres.map((nm, i) => (starts[i] == null ? `${nm} sin programar` : `${nm} del tiempo ${starts[i]} al ${starts[i] + red.d[i]}`)).join('; ')}`}>
      {periodo != null && <rect x={x(periodo - 1)} y={top - 4} width={u} height={alto - top} fill={FONDO_AZUL} />}
      {Array.from({ length: H }, (_, t) => (
        <g key={t}>
          <line x1={x(t)} y1={top - 4} x2={x(t)} y2={alto - 6} stroke={GRIS} />
          <text x={x(t) + u / 2} y={top - 10} textAnchor="middle" fontSize="11" fill="#555" fontFamily={SERIF}>{t + 1}</text>
        </g>
      ))}
      <line x1={x(H)} y1={top - 4} x2={x(H)} y2={alto - 6} stroke={GRIS} />
      <text x={LABEL_W - 8} y={top - 10} textAnchor="end" fontSize="10" fill="#555" fontFamily={SERIF}>período</text>
      {orden.map((i, fila) => {
        const y = top + fila * rowH;
        const s = starts[i];
        const crit = base.H[i] === 0;
        const est = resalta[i];
        const ghost = fantasma && fantasma[i] != null && fantasma[i] !== s;
        return (
          <g key={i}>
            <text x={LABEL_W - 8} y={y + rowH / 2} textAnchor="end" dominantBaseline="central" fontSize="13" fontFamily={SERIF}>{red.nombres[i]}</text>
            {ghost && <rect x={x(fantasma[i])} y={y + 4} width={red.d[i] * u} height={rowH - 8} fill="none" stroke={INK} strokeWidth="0.9" strokeDasharray="3 2" opacity="0.55" />}
            {s != null && (
              <>
                {base.LF[i] > s + red.d[i] && (
                  <rect x={x(s + red.d[i])} y={y + 8} width={(base.LF[i] - s - red.d[i]) * u} height={rowH - 16} fill="#ecece8" stroke={INK} strokeWidth="0.5" />
                )}
                <rect
                  x={x(s)}
                  y={y + 4}
                  width={red.d[i] * u}
                  height={rowH - 8}
                  fill={est === 'programa' || est === 'mueve' ? BLUE : crit ? INK : '#fff'}
                  stroke={est === 'programa' || est === 'mueve' ? BLUE : INK}
                  strokeWidth={est ? 1.8 : 1}
                />
                <text x={x(s) + (red.d[i] * u) / 2} y={y + rowH / 2} textAnchor="middle" dominantBaseline="central" fontSize="11" fontFamily={SERIF} fill={est === 'programa' || est === 'mueve' || crit ? '#fff' : INK}>{red.recursos.length === 1 ? red.r[i][0] : ''}</text>
              </>
            )}
            {s == null && est === 'retrasa' && periodo != null && (
              <rect x={x(periodo - 1)} y={y + 4} width={red.d[i] * u} height={rowH - 8} fill="none" stroke={RED} strokeWidth="1.6" strokeDasharray="4 3" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Histograma de un recurso k: barras por período, línea roja del límite y barras rojas donde se supera.
 *  starts: cronograma (las actividades con null no cuentan); marca: período destacado.
 */
export function Histograma({ red, starts, k, horizonte, periodo = null, svgRef, titulo }) {
  const H = Math.max(1, horizonte);
  const W = anchoTotal(H);
  const u = anchoPeriodo(H);
  const res = resumen(red, starts, H);
  const uso = res.uso[k];
  const lim = red.limites[k];
  const maxV = Math.max(1, ...uso, lim ?? 0);
  const st = paso(maxV);
  const tope = Math.ceil((maxV * 1.08) / st) * st;
  const alto = 170;
  const top = 18;
  const bottom = 24;
  const hh = alto - top - bottom;
  const y = (v) => top + hh - (v / tope) * hh;
  const ticks = [];
  for (let v = 0; v <= tope; v += st) ticks.push(v);
  const x = (t) => px(H, t);
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${alto}`} role="img" style={estiloSvg(W)} aria-label={`${titulo || 'Histograma'} de ${red.recursos[k]}: ${uso.join(', ')}${lim != null ? `; límite ${lim}` : ''}`}>
      {periodo != null && <rect x={x(periodo - 1)} y={top - 4} width={u} height={hh + 4} fill={FONDO_AZUL} />}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={LABEL_W} y1={y(v)} x2={x(H)} y2={y(v)} stroke={v === 0 ? INK : GRIS} strokeWidth={v === 0 ? 1 : 0.8} />
          <text x={LABEL_W - 6} y={y(v)} textAnchor="end" dominantBaseline="central" fontSize="11" fill="#555" fontFamily={SERIF}>{v}</text>
        </g>
      ))}
      {uso.map((v, t) => {
        const sobre = lim != null && v > lim;
        return (
          <g key={t}>
            {v > 0 && <rect x={x(t) + 3} y={y(v)} width={u - 6} height={y(0) - y(v)} fill={sobre ? RED : BLUE} />}
            {v > 0 && <text x={x(t) + u / 2} y={y(v) - 4} textAnchor="middle" fontSize="11" fontFamily={SERIF} fill={sobre ? RED : INK} fontWeight={sobre ? 700 : 400}>{v}</text>}
            <text x={x(t) + u / 2} y={alto - 8} textAnchor="middle" fontSize="11" fill="#555" fontFamily={SERIF}>{t + 1}</text>
          </g>
        );
      })}
      {lim != null && (
        <g>
          <line x1={LABEL_W} y1={y(lim)} x2={x(H)} y2={y(lim)} stroke={RED} strokeWidth="1.6" strokeDasharray="6 4" />
          <text x={x(H) - 2} y={y(lim) - 4} textAnchor="end" fontSize="11" fontFamily={SERIF} fill={RED} fontWeight="700" stroke="#fff" strokeWidth="0" >{`límite ${lim}`}</text>
        </g>
      )}
    </svg>
  );
}

/** Gantt + un histograma por recurso, con título y envoltorio que se desplaza en pantallas angostas. */
export default function Cronograma({ titulo, red, base, starts, horizonte, fantasma, resalta, periodo, refs }) {
  return (
    <div className="rc-crono">
      {titulo && <h4 className="rc-crono-t">{titulo}</h4>}
      <div className="rc-scroll" tabIndex={0} aria-label={`${titulo || 'Cronograma'}: desplaza para ver todo`}>
        <GanttRecursos red={red} base={base} starts={starts} horizonte={horizonte} fantasma={fantasma} resalta={resalta} periodo={periodo} svgRef={refs?.gantt} titulo={`Gantt: ${titulo || ''}`} />
      </div>
      {red.recursos.map((nom, k) => (
        <div key={k} className="rc-hist">
          <div className="rc-hist-t">Consumo de {nom} por período</div>
          <div className="rc-scroll" tabIndex={0} aria-label={`Histograma de ${nom}: desplaza para ver todo`}>
            <Histograma red={red} starts={starts} k={k} horizonte={horizonte} periodo={periodo} svgRef={refs?.hist?.[k]} titulo={`Histograma: ${titulo || ''}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
