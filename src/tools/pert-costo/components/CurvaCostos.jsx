import { useMemo } from 'react';
import { num } from '../domain/formato.js';
import '../pert-costo.css';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";
const INK = '#000000';
const BLUE = '#1d3f8f';
const RED = '#b3261e';
const halo = { paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3.5, strokeLinejoin: 'round' };

/** Paso «bonito» para los ejes. */
function pasoNice(rango, objetivo) {
  const crudo = rango / objetivo;
  const mag = 10 ** Math.floor(Math.log10(crudo));
  const f = crudo / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
}

/**
 * Curva costo-duración: costo directo, costo indirecto y costo total para cada duración entera.
 * `hasta` limita las duraciones dibujadas del costo directo y total (las más cortas aún no se calculan);
 * `actual` marca una duración; `mostrarOptimo` dibuja el mínimo del costo total.
 */
export default function CurvaCostos({ res, hasta = null, actual = null, mostrarOptimo = true, svgRef, ancho = 640, alto = 340 }) {
  const datos = useMemo(() => {
    const puntos = [...res.estados].sort((a, b) => a.T - b.T); // de la duración límite a la normal
    const visibles = puntos.filter((p) => hasta == null || p.T >= hasta);
    const todos = [...puntos.map((p) => p.directo), ...puntos.map((p) => p.indirecto), ...puntos.map((p) => p.total)];
    let ymin = Math.min(...todos);
    let ymax = Math.max(...todos);
    if (ymax === ymin) { ymax += 1; ymin -= 1; }
    const paso = pasoNice(ymax - ymin, 5);
    ymin = Math.max(0, Math.floor((ymin - (ymax - ymin) * 0.05) / paso) * paso);
    ymax = Math.ceil((ymax + (ymax - ymin) * 0.05) / paso) * paso;
    const xs = puntos.map((p) => p.T);
    return { puntos, visibles, ymin, ymax, paso, xmin: Math.min(...xs), xmax: Math.max(...xs) };
  }, [res, hasta]);

  const L = 62;
  const R = 22;
  const Tm = 22;
  const B = 50;
  const w = ancho - L - R;
  const h = alto - Tm - B;
  const { puntos, visibles, ymin, ymax, paso, xmin, xmax } = datos;
  const sx = (T) => L + (xmax === xmin ? w / 2 : ((T - xmin) / (xmax - xmin)) * w);
  const sy = (c) => Tm + h - ((c - ymin) / (ymax - ymin)) * h;
  const linea = (lista, clave) => lista.map((p, i) => `${i ? 'L' : 'M'}${sx(p.T).toFixed(1)},${sy(p[clave]).toFixed(1)}`).join(' ');

  const yTicks = [];
  for (let v = ymin; v <= ymax + 1e-9; v += paso) yTicks.push(v);
  const nX = puntos.length;
  const cadaX = nX <= 14 ? 1 : Math.ceil(nX / 12);
  const xTicks = puntos.filter((_, i) => i % cadaX === 0 || i === nX - 1).map((p) => p.T);
  const opt = res.estadoEn(res.optimo.T);
  const frente = visibles[0] || puntos[puntos.length - 1];
  const mitad = xmin + (xmax - xmin) * 0.5;
  const marcas = nX <= 40;
  const act = actual != null ? res.estadoEn(actual) : null;
  const optX = sx(opt.T);
  const etOpt = `Óptimo: duración ${opt.T}, total ${num(opt.total)}`;
  const anclaOpt = optX > L + w * 0.6 ? 'end' : 'start';

  return (
    <div className="pc-scroll">
      <svg
        ref={svgRef}
        className="pc-curva"
        viewBox={`0 0 ${ancho} ${alto}`}
        style={{ width: '100%', maxWidth: ancho, minWidth: 460, height: 'auto' }}
        role="img"
        aria-label={`Curva costo-duración: el costo total mínimo es ${num(opt.total)} con duración ${opt.T}.`}
      >
        <rect data-ui x="0" y="0" width={ancho} height={alto} fill="#fff" />
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={L} y1={sy(v)} x2={L + w} y2={sy(v)} stroke="#d8d8d3" strokeWidth="0.8" />
            <text x={L - 8} y={sy(v) + 4} textAnchor="end" fontFamily={SERIF} fontSize="12.5" fill={INK}>{num(v, 0)}</text>
          </g>
        ))}
        <line x1={L} y1={Tm} x2={L} y2={Tm + h} stroke={INK} strokeWidth="1.2" />
        <line x1={L} y1={Tm + h} x2={L + w} y2={Tm + h} stroke={INK} strokeWidth="1.2" />
        {xTicks.map((T) => (
          <g key={T}>
            <line x1={sx(T)} y1={Tm + h} x2={sx(T)} y2={Tm + h + 5} stroke={INK} strokeWidth="1" />
            <text x={sx(T)} y={Tm + h + 19} textAnchor="middle" fontFamily={SERIF} fontSize="12.5" fill={INK}>{T}</text>
          </g>
        ))}
        <text x={L + w / 2} y={alto - 8} textAnchor="middle" fontFamily={SERIF} fontSize="14" fill={INK}>Duración del proyecto</text>
        <text x="14" y={Tm + h / 2} textAnchor="middle" fontFamily={SERIF} fontSize="14" fill={INK} transform={`rotate(-90 14 ${Tm + h / 2})`}>Costo</text>

        {/* Costo indirecto: recta */}
        <path d={linea(puntos, 'indirecto')} fill="none" stroke={INK} strokeWidth="1.5" strokeDasharray="6 4" />
        {/* Costo directo */}
        <path d={linea(visibles, 'directo')} fill="none" stroke={INK} strokeWidth="1.8" />
        {/* Costo total */}
        <path d={linea(visibles, 'total')} fill="none" stroke={BLUE} strokeWidth="2.6" />
        {marcas && visibles.map((p) => <circle key={p.T} cx={sx(p.T)} cy={sy(p.total)} r="3.2" fill="#fff" stroke={BLUE} strokeWidth="1.6" />)}
        {marcas && visibles.map((p) => <circle key={'d' + p.T} cx={sx(p.T)} cy={sy(p.directo)} r="2.4" fill={INK} />)}

        {/* Rótulos de las curvas: el costo indirecto va en el extremo derecho; directo y total, en el último punto dibujado */}
        <text x={sx(xmax) - 4} y={sy(puntos[puntos.length - 1].indirecto) - 8} textAnchor="end" fontFamily={SERIF} fontSize="13" fill={INK} {...halo}>Costo indirecto</text>
        <text x={sx(frente.T) + (frente.T > mitad ? -8 : 8)} y={sy(frente.directo) + (frente.T > mitad ? -9 : -9)} textAnchor={frente.T > mitad ? 'end' : 'start'} fontFamily={SERIF} fontSize="13" fill={INK} {...halo}>Costo directo</text>
        <text x={sx(frente.T) + (frente.T > mitad ? -8 : 8)} y={sy(frente.total) - 11} textAnchor={frente.T > mitad ? 'end' : 'start'} fontFamily={SERIF} fontSize="13" fontWeight="600" fill={BLUE} {...halo}>Costo total</text>

        {act && (
          <g>
            <line x1={sx(act.T)} y1={Tm} x2={sx(act.T)} y2={Tm + h} stroke={BLUE} strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={sx(act.T)} cy={sy(act.total)} r="6" fill="none" stroke={BLUE} strokeWidth="1.8" />
          </g>
        )}
        {mostrarOptimo && (
          <g>
            <line x1={optX} y1={Tm} x2={optX} y2={Tm + h} stroke={RED} strokeWidth="1.2" strokeDasharray="5 4" />
            <circle cx={optX} cy={sy(opt.total)} r="5.5" fill={RED} stroke="#fff" strokeWidth="1.2" />
            <text x={optX + (anclaOpt === 'end' ? -9 : 9)} y={sy(opt.total) + (opt.total > (ymin + ymax) / 2 ? 24 : -12)} textAnchor={anclaOpt} fontFamily={SERIF} fontSize="13" fontWeight="600" fill={RED} {...halo}>{etOpt}</text>
          </g>
        )}
      </svg>
    </div>
  );
}
