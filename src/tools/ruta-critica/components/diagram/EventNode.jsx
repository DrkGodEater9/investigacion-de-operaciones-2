import { memo } from 'react';
import { INK, BLUE, SERIF } from './theme.js';

/** Evento: círculo partido; arriba el número, abajo a la izquierda el tiempo más temprano y a la derecha el más tardío. */
function EventNode({ x, y, r, number, early, late, critical, current, strong, onPointerDown }) {
  const fitSize = (text, base) => {
    const t = String(text ?? '');
    const w = r * 0.86;
    return Math.min(base, t.length ? w / (t.length * 0.52) : base);
  };
  const low = r * 0.5;
  const stroke = current ? BLUE : INK;
  return (
    <g className="event-node" transform={`translate(${x},${y})`} onPointerDown={onPointerDown}>
      {current && <circle data-ui r={r + 6} fill="none" stroke={BLUE} strokeWidth="1.4" strokeDasharray="3 3" />}
      <circle r={r} fill="#fff" stroke={stroke} strokeWidth={strong && critical ? 2.4 : 1.4} />
      <line x1={-r} y1="0" x2={r} y2="0" stroke={stroke} strokeWidth="1.2" />
      <line x1="0" y1="0" x2="0" y2={r} stroke={stroke} strokeWidth="1.2" />
      <text y={-r * 0.36} textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontSize={fitSize(number, r * 0.62)} fill={INK}>
        {number}
      </text>
      {early != null && (
        <text x={-r * 0.47} y={low} textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontSize={fitSize(early, r * 0.48)} fill={INK}>
          {early}
        </text>
      )}
      {late != null && (
        <text x={r * 0.47} y={low} textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontSize={fitSize(late, r * 0.48)} fill={INK}>
          {late}
        </text>
      )}
    </g>
  );
}

export default memo(EventNode);
