import { forwardRef } from 'react';
import { fmtNum } from '../domain/format.js';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";
const BLUE = '#1d3f8f';
const RED = '#b3261e';
const HALO = { stroke: '#fff', strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' };

const W = 640;
const H = 320;
const M = { izq: 56, der: 170, arr: 20, aba: 44 };

/** Separa verticalmente las etiquetas del extremo derecho para que no se encimen. */
function separar(ys, minGap = 15) {
  const orden = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < orden.length; k++) if (orden[k].y - orden[k - 1].y < minGap) orden[k].y = orden[k - 1].y + minGap;
  const out = [];
  orden.forEach((o) => { out[o.i] = o.y; });
  return out;
}

/**
 * Valor del árbol (azul) y de cada alternativa de la raíz (negro) en función de la probabilidad p que varía.
 * Los cortes (rojo, vertical) son los valores de p donde cambia la estrategia óptima.
 */
const GraficaSensibilidad = forwardRef(function GraficaSensibilidad({ datos, p = null, unidad = '' }, ref) {
  const todos = [...datos.valores, ...(datos.series || []).flatMap((s) => s.valores)];
  let lo = Math.min(...todos);
  let hi = Math.max(...todos);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const x = (v) => M.izq + v * (W - M.izq - M.der);
  const y = (v) => H - M.aba - ((v - lo) / (hi - lo)) * (H - M.aba - M.arr);
  const linea = (vals) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(datos.ps[i]).toFixed(2)} ${y(v).toFixed(2)}`).join(' ');

  // marcas del eje vertical (4 o 5 valores redondos)
  const bruto = (hi - lo) / 5;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((s) => s >= bruto) || bruto;
  const marcas = [];
  for (let v = Math.ceil(lo / paso) * paso; v <= hi + 1e-9; v += paso) marcas.push(Math.round(v / paso) * paso);

  const etiquetasY = separar((datos.series || []).map((s) => y(s.valores[s.valores.length - 1])));

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      style={{ display: 'block', maxWidth: 'none' }}
      role="img"
      aria-label={`Sensibilidad a la probabilidad de «${datos.etiqueta}» del nodo «${datos.nombreNodo}»`}
    >
      <line x1={M.izq} y1={H - M.aba} x2={W - M.der} y2={H - M.aba} stroke="#000" strokeWidth="1.1" />
      <line x1={M.izq} y1={M.arr} x2={M.izq} y2={H - M.aba} stroke="#000" strokeWidth="1.1" />
      {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => (
        <g key={v}>
          <line x1={x(v)} y1={H - M.aba} x2={x(v)} y2={H - M.aba + 5} stroke="#000" strokeWidth="1" />
          <text x={x(v)} y={H - M.aba + 19} textAnchor="middle" fontFamily={SERIF} fontSize="13" fill="#000">{fmtNum(v, 1)}</text>
        </g>
      ))}
      {marcas.map((v) => (
        <g key={v}>
          <line x1={M.izq - 5} y1={y(v)} x2={M.izq} y2={y(v)} stroke="#000" strokeWidth="1" />
          <line x1={M.izq} y1={y(v)} x2={W - M.der} y2={y(v)} stroke="#d8d8d3" strokeWidth="0.6" />
          <text x={M.izq - 8} y={y(v) + 4.5} textAnchor="end" fontFamily={SERIF} fontSize="13" fill="#000">{fmtNum(v)}</text>
        </g>
      ))}
      <text x={(M.izq + W - M.der) / 2} y={H - 8} textAnchor="middle" fontFamily={SERIF} fontSize="13.5" fill="#000">
        {`Probabilidad p de «${datos.etiqueta}»`}
      </text>
      {unidad && <text x={M.izq} y={12} fontFamily={SERIF} fontSize="12" fill="#444">{`Valor (${unidad})`}</text>}

      {(datos.series || []).map((s, k) => (
        <g key={s.etiqueta}>
          <path d={linea(s.valores)} fill="none" stroke="#000" strokeWidth="1.1" />
          <text x={W - M.der + 8} y={etiquetasY[k] + 4} fontFamily={SERIF} fontSize="12.5" fill="#000">{s.etiqueta}</text>
        </g>
      ))}
      <path d={linea(datos.valores)} fill="none" stroke={BLUE} strokeWidth="2.6" strokeLinejoin="round" />
      {datos.cortes.map((c) => (
        <g key={c.p}>
          <line x1={x(c.p)} y1={M.arr} x2={x(c.p)} y2={H - M.aba} stroke={RED} strokeWidth="1.2" strokeDasharray="4 3" />
          <circle cx={x(c.p)} cy={y(c.valor)} r="4" fill="#fff" stroke={RED} strokeWidth="1.6" />
          <text x={x(c.p) + 5} y={M.arr + 10} fontFamily={SERIF} fontSize="12.5" fill={RED} {...HALO}>{`p* = ${fmtNum(c.p, 3)}`}</text>
        </g>
      ))}
      {p != null && (
        <g>
          <line x1={x(p)} y1={M.arr} x2={x(p)} y2={H - M.aba} stroke="#000" strokeWidth="1" strokeDasharray="1 3" />
          <text x={x(p) + 4} y={H - M.aba - 6} fontFamily={SERIF} fontSize="12" fill="#000" {...HALO}>{`p = ${fmtNum(p, 3)}`}</text>
        </g>
      )}
    </svg>
  );
});

export default GraficaSensibilidad;
