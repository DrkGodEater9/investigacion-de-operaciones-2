import { fmt } from '../../domain/format.js';

export default function GanttView({ analysis, hoveredAct, onHoverAct }) {
  const { activities, times, net, decimals } = analysis;
  const edgeOf = new Map(net.edges.filter((e) => e.kind === 'activity').map((e) => [e.act, e]));
  const rows = activities
    .map((a) => ({ name: a.name, ...times.edgeInfo[edgeOf.get(a.name).id] }))
    .sort((x, y) => x.tic - y.tic || x.tfc - y.tfc);
  const T = times.T || 1;
  const labelW = 54;
  const W = 880;
  const rowH = 24;
  const top = 30;
  const H = top + rows.length * rowH + 16;
  const sx = (t) => labelW + (t / T) * (W - labelW - 20);
  const step = niceStep(T / 10);
  const ticks = [];
  for (let t = 0; t <= T + 1e-9; t += step) ticks.push(t);

  return (
    <div className="gantt">
      <div className="table-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} className="gantt-svg" style={{ minWidth: 640 }}>
          <defs>
            <pattern id="float" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="5" stroke="#000" strokeWidth="0.8" />
            </pattern>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={sx(t)} y1={top - 6} x2={sx(t)} y2={H - 12} stroke="#e2e2de" />
              <text x={sx(t)} y={top - 12} textAnchor="middle" fontSize="11" fill="#555">
                {fmt(t, 1)}
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const y = top + i * rowH;
            const hot = hoveredAct === r.name;
            return (
              <g key={r.name} onMouseEnter={() => onHoverAct(r.name)} onMouseLeave={() => onHoverAct(null)} className="gantt-row">
                {hot && <rect x="0" y={y} width={W} height={rowH} fill="#eef1f8" />}
                <text x={labelW - 10} y={y + rowH / 2} textAnchor="end" dominantBaseline="central" fontSize="13" fontFamily="'STIX Two Text', serif">
                  {r.name}
                </text>
                <rect x={sx(r.tic)} y={y + 5} width={Math.max(1, sx(r.tfc) - sx(r.tic))} height={rowH - 10} fill={r.critical ? '#000' : '#fff'} stroke="#000" strokeWidth="1" />
                {r.ht > 1e-7 && <rect x={sx(r.tfc)} y={y + 8} width={sx(r.tfc + r.ht) - sx(r.tfc)} height={rowH - 16} fill="url(#float)" stroke="#000" strokeWidth="0.6" />}
                <title>
                  {`${r.name}: de ${fmt(r.tic, decimals)} a ${fmt(r.tfc, decimals)}, holgura ${fmt(r.ht, decimals)}`}
                </title>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="table-note">Barras negras: actividades críticas. Barras blancas: no críticas, con su holgura total rayada. Cada barra empieza en su TIC.</p>
    </div>
  );
}

function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}
