import { normalPdf } from '../../domain/pert.js';
import { fmt } from '../../domain/format.js';

/** Campana normal con el área P(T ≤ x) sombreada. */
export default function NormalCurve({ mean, sd, x, decimals }) {
  const W = 560;
  const H = 190;
  const padX = 24;
  const base = H - 34;
  const lo = mean - 4 * sd;
  const hi = mean + 4 * sd;
  const sx = (v) => padX + ((v - lo) / (hi - lo)) * (W - 2 * padX);
  const sy = (z) => base - (normalPdf(z) / normalPdf(0)) * (base - 18);
  const N = 120;
  const pts = Array.from({ length: N + 1 }, (_, i) => lo + ((hi - lo) * i) / N);
  const curve = pts.map((v, i) => `${i ? 'L' : 'M'}${sx(v)},${sy((v - mean) / sd)}`).join(' ');
  const xc = Math.min(Math.max(x, lo), hi);
  const shadePts = pts.filter((v) => v <= xc);
  const shade =
    shadePts.length > 0
      ? `M${sx(lo)},${base} ` + shadePts.map((v) => `L${sx(v)},${sy((v - mean) / sd)}`).join(' ') + ` L${sx(xc)},${sy((xc - mean) / sd)} L${sx(xc)},${base} Z`
      : '';
  const ticks = [-3, -2, -1, 0, 1, 2, 3];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="normal-curve" role="img" aria-label="Distribución normal del tiempo del proyecto">
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#1d3f8f" strokeWidth="1.6" />
        </pattern>
      </defs>
      {shade && <path d={shade} fill="url(#hatch)" opacity="0.55" />}
      <path d={curve} fill="none" stroke="#000" strokeWidth="1.5" />
      <line x1={padX} y1={base} x2={W - padX} y2={base} stroke="#000" strokeWidth="1" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={sx(mean + t * sd)} y1={base} x2={sx(mean + t * sd)} y2={base + 5} stroke="#000" />
          <text x={sx(mean + t * sd)} y={base + 19} textAnchor="middle" fontSize="11" fontFamily="'STIX Two Text', serif">
            {t === 0 ? `Te = ${fmt(mean, decimals)}` : fmt(mean + t * sd, 1)}
          </text>
        </g>
      ))}
      <line x1={sx(xc)} y1={base} x2={sx(xc)} y2={14} stroke="#1d3f8f" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x={sx(xc)} y={11} textAnchor="middle" fontSize="12" fill="#1d3f8f" fontFamily="'STIX Two Text', serif">
        T = {fmt(x, decimals)}
      </text>
    </svg>
  );
}
