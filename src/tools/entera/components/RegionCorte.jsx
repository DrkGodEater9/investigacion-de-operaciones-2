import { useMemo } from 'react';
import { get2DFeasibleRegion, get2DIntegerPoints, get2DMixedSegments } from '../domain/geometry.js';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";
const HALO = { paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3, strokeLinejoin: 'round' };

/**
 * Gráfica de 2 variables para el paso a paso: región factible, segmentos azules
 * (una variable entera) o puntos (ambas enteras), rectas discontinuas azules de
 * cortes o ramas con su ecuación, franja eliminada rayada y puntos destacados.
 * Solo dibuja: los datos (rectas, franjas, puntos) vienen del dominio (pasosMixta.js).
 *   grafica = { integer:[bool,bool], relajacion?, optimo?, puntos?, rectas?, franjas? }
 */
export default function RegionCorte({ model, grafica }) {
  const ok = model && model.c && model.c.length === 2 && grafica;
  const data = useMemo(() => {
    if (!ok) return null;
    const region = get2DFeasibleRegion(model.constraints);
    if (region.status !== 'ok' || !region.isBounded || !region.bounds) return { region, segmentos: [], puntos: [] };
    const flags = grafica.integer || [true, true];
    const nEnt = flags.filter(Boolean).length;
    let segmentos = [];
    let puntos = [];
    if (nEnt === 1) segmentos = get2DMixedSegments(model.constraints, flags[0] ? 0 : 1).segmentos;
    if (nEnt === 2) puntos = get2DIntegerPoints(model.constraints, region.bounds).points;
    return { region, segmentos, puntos };
  }, [ok, model, grafica]);

  if (!ok) {
    return <p className="section-note">La gráfica solo está disponible con exactamente 2 variables de decisión.</p>;
  }
  if (!data.region || data.region.status !== 'ok' || !data.region.isBounded) {
    return <p className="section-note">La región no es acotada o está vacía: no se dibuja.</p>;
  }

  const { region, segmentos, puntos } = data;
  const maxVal = Math.min(Math.max(Math.ceil(Math.max(region.bounds.maxX, region.bounds.maxY, 4) * 1.2), 5), 60);
  const W = 500;
  const H = 440;
  const padL = 45;
  const padB = 38;
  const padT = 30;
  const padR = 45;
  const scale = Math.min((W - padL - padR) / maxVal, (H - padT - padB) / maxVal);
  const OX = padL;
  const OY = padT + maxVal * scale;
  const X = (v) => OX + v * scale;
  const Y = (v) => OY - v * scale;
  const step = maxVal > 30 ? 5 : maxVal > 15 ? 2 : 1;
  const ticks = [];
  for (let q = 0; q <= maxVal; q += step) ticks.push(q);

  const poly = (vs) => vs.map((v) => `${X(v.x1.toNumber())},${Y(v.x2.toNumber())}`).join(' ');

  // Extremos de una recta a1·x1 + a2·x2 = b dentro del cuadro [0, maxVal]²
  const extremos = (r) => {
    const a1 = r.a[0].toNumber();
    const a2 = r.a[1].toNumber();
    const b = r.b.toNumber();
    const pts = [];
    const eps = 1e-9;
    if (Math.abs(a2) > eps) {
      [0, maxVal].forEach((x1) => {
        const x2 = (b - a1 * x1) / a2;
        if (x2 >= -eps && x2 <= maxVal + eps) pts.push([x1, x2]);
      });
    }
    if (Math.abs(a1) > eps) {
      [0, maxVal].forEach((x2) => {
        const x1 = (b - a2 * x2) / a1;
        if (x1 >= -eps && x1 <= maxVal + eps && !pts.some((p) => Math.abs(p[0] - x1) < 1e-6 && Math.abs(p[1] - x2) < 1e-6)) pts.push([x1, x2]);
      });
    }
    return pts.length >= 2 ? [pts[0], pts[pts.length - 1]] : null;
  };

  const rectas = (grafica.rectas || []).map((r, i) => ({ r, e: extremos(r), i })).filter((q) => q.e);
  const franjas = grafica.franjas || [];
  const puntosExtra = grafica.puntos || [];

  const marca = (p, tipo) => {
    const x = X(p.x[0].toNumber());
    const y = Y(p.x[1].toNumber());
    if (tipo === 'relajacion') {
      return (
        <g key={`m-${tipo}`}>
          <rect x={x - 4.5} y={y - 4.5} width="9" height="9" fill="#fff" stroke="#000" strokeWidth="1.8" />
          <text x={x + 8} y={y - 8} fontFamily={SERIF} fontSize="13" fill="#000" {...HALO}>{p.etiqueta}</text>
        </g>
      );
    }
    if (tipo === 'optimo') {
      return (
        <g key={`m-${tipo}`}>
          <circle cx={x} cy={y} r="6" fill="#1d3f8f" stroke="#000" strokeWidth="1.5" />
          <text x={x + 10} y={y + 4} fontFamily={SERIF} fontSize="13" fontWeight="bold" fill="#1d3f8f" {...HALO}>{p.etiqueta}</text>
        </g>
      );
    }
    return (
      <g key={`m-${tipo}-${x}-${y}`}>
        <circle cx={x} cy={y} r="5" fill="#fff" stroke="#1d3f8f" strokeWidth="2" />
        <text x={x + 9} y={y - 7} fontFamily={SERIF} fontSize="13" fill="#1d3f8f" {...HALO}>{p.etiqueta}</text>
      </g>
    );
  };

  return (
    <div style={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', maxWidth: '620px', margin: '0 auto' }}
        role="img"
        aria-label={`Región factible con ${rectas.map((q) => q.r.etiqueta).join(' y ') || 'sus restricciones'}`}
      >
        <defs>
          <pattern id="hatch-corte" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#b3261e" strokeWidth="1" opacity="0.6" />
          </pattern>
        </defs>

        {ticks.slice(1).map((q) => (
          <g key={`g-${q}`} stroke="#000" strokeOpacity="0.12" strokeWidth="0.8" strokeDasharray="2 3">
            <line x1={X(q)} y1={Y(0)} x2={X(q)} y2={Y(maxVal)} />
            <line x1={X(0)} y1={Y(q)} x2={X(maxVal)} y2={Y(q)} />
          </g>
        ))}

        {region.vertices.length >= 3 && (
          <polygon points={poly(region.vertices)} fill="#1d3f8f" fillOpacity="0.10" stroke="#1d3f8f" strokeWidth="1.6" />
        )}

        {franjas.map((f, i) => (
          <polygon key={`f-${i}`} points={poly(f)} fill="url(#hatch-corte)" stroke="#b3261e" strokeWidth="1" strokeDasharray="3 2" />
        ))}

        {segmentos.map((sg) => {
          const d = sg.desde.toNumber();
          const h = sg.hasta.toNumber();
          const horiz = sg.varIdx === 1;
          const [x1, y1, x2, y2] = horiz ? [X(d), Y(sg.valor), X(h), Y(sg.valor)] : [X(sg.valor), Y(d), X(sg.valor), Y(h)];
          return <line key={`s-${sg.valor}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1d3f8f" strokeWidth="3.5" strokeLinecap="round" />;
        })}

        {puntos.map((p, i) => (
          <circle key={`p-${i}`} cx={X(p.x1)} cy={Y(p.x2)} r="3.2" fill="#000" />
        ))}

        {rectas.map(({ r, e, i }) => (
          <g key={`r-${i}`}>
            <line x1={X(e[0][0])} y1={Y(e[0][1])} x2={X(e[1][0])} y2={Y(e[1][1])} stroke="#1d3f8f" strokeWidth="2" strokeDasharray="7 4" />
            <text
              x={X((e[0][0] + e[1][0]) / 2) + 4}
              y={Y((e[0][1] + e[1][1]) / 2) - 7}
              fontFamily={SERIF}
              fontSize="14"
              fontWeight="600"
              fill="#1d3f8f"
              {...HALO}
            >
              {r.etiqueta}
            </text>
          </g>
        ))}

        {grafica.relajacion && marca(grafica.relajacion, 'relajacion')}
        {puntosExtra.map((p) => marca(p, 'nodo'))}
        {grafica.optimo && marca(grafica.optimo, grafica.optimo.tipo === 'nodo' ? 'nodo' : 'optimo')}

        <line x1={X(0)} y1={Y(0)} x2={X(maxVal) + 15} y2={Y(0)} stroke="#000" strokeWidth="1.2" />
        <polygon points={`${X(maxVal) + 20},${Y(0)} ${X(maxVal) + 12},${Y(0) - 3.5} ${X(maxVal) + 12},${Y(0) + 3.5}`} fill="#000" />
        <text x={X(maxVal) + 24} y={Y(0) + 4} fontFamily={SERIF} fontSize="14" fontStyle="italic">x₁</text>
        <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(maxVal) - 15} stroke="#000" strokeWidth="1.2" />
        <polygon points={`${X(0)},${Y(maxVal) - 20} ${X(0) - 3.5},${Y(maxVal) - 12} ${X(0) + 3.5},${Y(maxVal) - 12}`} fill="#000" />
        <text x={X(0) - 4} y={Y(maxVal) - 24} textAnchor="middle" fontFamily={SERIF} fontSize="14" fontStyle="italic">x₂</text>
        {ticks.map((q) => (
          <g key={`tx-${q}`}>
            <line x1={X(q)} y1={Y(0)} x2={X(q)} y2={Y(0) + 4} stroke="#000" strokeWidth="1" />
            <text x={X(q)} y={Y(0) + 16} textAnchor="middle" fontFamily={SERIF} fontSize="13">{q}</text>
          </g>
        ))}
        {ticks.slice(1).map((q) => (
          <g key={`ty-${q}`}>
            <line x1={X(0) - 4} y1={Y(q)} x2={X(0)} y2={Y(q)} stroke="#000" strokeWidth="1" />
            <text x={X(0) - 8} y={Y(q) + 4} textAnchor="end" fontFamily={SERIF} fontSize="13">{q}</text>
          </g>
        ))}
      </svg>

      <div className="diagram-legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', justifyContent: 'center', marginTop: '8px', fontSize: '13px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 12, height: 12, background: 'rgba(29,63,143,0.1)', border: '1.5px solid #1d3f8f', display: 'inline-block' }} />
          Región factible continua
        </span>
        {segmentos.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 16, borderTop: '3.5px solid #1d3f8f', display: 'inline-block' }} />
            Segmentos factibles de la mixta
          </span>
        )}
        {puntos.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#000', display: 'inline-block' }} />
            Punto entero factible
          </span>
        )}
        {rectas.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 18, borderTop: '2px dashed #1d3f8f', display: 'inline-block' }} />
            Corte o rama
          </span>
        )}
        {franjas.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" aria-hidden="true"><rect width="14" height="14" fill="#fff" stroke="#b3261e" strokeWidth="1" /><path d="M0 14L14 0M0 8L8 0M6 14L14 6" stroke="#b3261e" strokeWidth="1" /></svg>
            Zona eliminada
          </span>
        )}
      </div>
    </div>
  );
}
