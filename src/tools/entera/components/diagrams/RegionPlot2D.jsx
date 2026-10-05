import { useMemo } from 'react';
import { get2DFeasibleRegion, get2DIntegerPoints, get2DMixedSegments } from '../../domain/geometry.js';
import { frac } from '../../domain/fraction.js';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";

export function RegionPlot2D({ model, result, stepState = null }) {
  // Solo aplicable para 2 variables
  const is2D = model && model.c && model.c.length === 2;

  const data = useMemo(() => {
    if (!is2D) return null;
    const region = get2DFeasibleRegion(model.constraints);
    let intPointsData = { tooMany: false, points: [] };
    // Modelo mixto: x_j continua se dibuja como segmentos, no como puntos.
    const flags = [0, 1].map((j) => !(model.integer && model.integer[j] === false));
    const nEnteras = flags.filter(Boolean).length;
    let segmentos = [];
    if (region.status === 'ok' && region.isBounded && region.bounds) {
      if (nEnteras === 2) {
        intPointsData = get2DIntegerPoints(model.constraints, region.bounds);
      } else if (nEnteras === 1) {
        segmentos = get2DMixedSegments(model.constraints, flags[0] ? 0 : 1).segmentos;
      }
    }
    return { region, intPointsData, segmentos, nEnteras };
  }, [is2D, model]);

  if (!is2D) {
    return (
      <div className="empty-state" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
        <p>El plano 2D solo está disponible para modelos con exactamente 2 variables de decisión (<em>x</em>₁, <em>x</em>₂).</p>
      </div>
    );
  }

  if (!data || data.region.status === 'empty') {
    return (
      <div className="empty-state" style={{ padding: '2rem 1rem', textAlign: 'center', color: '#b3261e' }}>
        <p>La región factible es vacía (sistema infactible). No hay puntos para graficar.</p>
      </div>
    );
  }

  const { region, intPointsData, segmentos, nEnteras } = data;

  // Determinar límites del gráfico
  const bX = region.bounds ? region.bounds.maxX : 6;
  const bY = region.bounds ? region.bounds.maxY : 6;
  const rawMax = Math.max(bX, bY, 4);
  const maxVal = Math.min(Math.max(Math.ceil(rawMax * 1.2), 5), 60);

  // Escala y origen
  const padLeft = 45;
  const padBottom = 40;
  const padTop = 30;
  const padRight = 45;
  const width = 500;
  const height = 460;
  const usableW = width - padLeft - padRight;
  const usableH = height - padTop - padBottom;
  const scale = Math.min(usableW / maxVal, usableH / maxVal);

  const OX = padLeft;
  const OY = padTop + maxVal * scale;

  const toX = (val) => OX + val * scale;
  const toY = (val) => OY - val * scale;

  // Paso para marcas de ejes
  let step = 1;
  if (maxVal > 30) step = 5;
  else if (maxVal > 15) step = 2;

  const ticks = [];
  for (let t = 0; t <= maxVal; t += step) {
    ticks.push(t);
  }

  // Puntos del polígono factible
  const polygonPoints = region.vertices
    .map((v) => `${toX(v.x1.toNumber())},${toY(v.x2.toNumber())}`)
    .join(' ');

  // Óptimo continuo (relajado)
  const relPt = result?.relaxation?.x && result.relaxation.x.length >= 2 ? {
    x1: result.relaxation.x[0].toNumber(),
    x2: result.relaxation.x[1].toNumber(),
    z: result.relaxation.z.toDual(),
  } : null;

  // Óptimo entero
  const intPt = result?.best?.x && result.best.x.length >= 2 ? {
    x1: result.best.x[0].toNumber(),
    x2: result.best.x[1].toNumber(),
    z: result.best.z.toDual(),
  } : null;

  // Rectas de restricciones para dibujar segmentos
  const constraintLines = model.constraints.map((ct, idx) => {
    const a1 = frac(ct.a[0] || 0).toNumber();
    const a2 = frac(ct.a[1] || 0).toNumber();
    const b = frac(ct.b).toNumber();

    let p1 = null;
    let p2 = null;

    if (Math.abs(a2) < 1e-9 && Math.abs(a1) > 1e-9) {
      // x1 = b / a1
      const x1 = b / a1;
      if (x1 >= 0 && x1 <= maxVal) {
        p1 = { x: toX(x1), y: toY(0) };
        p2 = { x: toX(x1), y: toY(maxVal) };
      }
    } else if (Math.abs(a1) < 1e-9 && Math.abs(a2) > 1e-9) {
      // x2 = b / a2
      const x2 = b / a2;
      if (x2 >= 0 && x2 <= maxVal) {
        p1 = { x: toX(0), y: toY(x2) };
        p2 = { x: toX(maxVal), y: toY(x2) };
      }
    } else if (Math.abs(a1) > 1e-9 && Math.abs(a2) > 1e-9) {
      // a1*x1 + a2*x2 = b
      // Puntos de corte con x1=0 -> x2 = b/a2; x2=0 -> x1 = b/a1
      const candidates = [];
      const yAt0 = b / a2;
      if (yAt0 >= 0 && yAt0 <= maxVal) candidates.push({ x: toX(0), y: toY(yAt0), gx: 0, gy: yAt0 });
      const xAt0 = b / a1;
      if (xAt0 >= 0 && xAt0 <= maxVal) candidates.push({ x: toX(xAt0), y: toY(0), gx: xAt0, gy: 0 });
      const yAtMax = (b - a1 * maxVal) / a2;
      if (yAtMax >= 0 && yAtMax <= maxVal) candidates.push({ x: toX(maxVal), y: toY(yAtMax), gx: maxVal, gy: yAtMax });
      const xAtMax = (b - a2 * maxVal) / a1;
      if (xAtMax >= 0 && xAtMax <= maxVal) candidates.push({ x: toX(xAtMax), y: toY(maxVal), gx: xAtMax, gy: maxVal });

      if (candidates.length >= 2) {
        p1 = candidates[0];
        p2 = candidates[candidates.length - 1];
      }
    }

    const opSymbol = ct.op === '<=' ? '≤' : ct.op === '>=' ? '≥' : '=';
    const label = `${ct.a[0]}x₁ + ${ct.a[1]}x₂ ${opSymbol} ${ct.b}`;

    return { id: idx, p1, p2, label };
  }).filter((line) => line.p1 && line.p2);

  return (
    <div className="region-plot-container" style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block', maxWidth: '640px', margin: '0 auto' }}
      >
        {/* Rejilla de fondo */}
        {ticks.slice(1).map((t) => (
          <g key={`grid-${t}`} stroke="#000" strokeOpacity="0.12" strokeWidth="0.8" strokeDasharray="2 3">
            <line x1={toX(t)} y1={toY(0)} x2={toX(t)} y2={toY(maxVal)} />
            <line x1={toX(0)} y1={toY(t)} x2={toX(maxVal)} y2={toY(t)} />
          </g>
        ))}

        <defs>
          <pattern
            id="hatch-strip-plot"
            width="8"
            height="8"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke="#b3261e" strokeWidth="0.8" opacity="0.45" />
          </pattern>
        </defs>

        {/* Polígono de la región factible */}
        {region.vertices.length >= 3 && (
          <polygon
            points={polygonPoints}
            fill="#1d3f8f"
            fillOpacity="0.10"
            stroke="#1d3f8f"
            strokeWidth="1.6"
          />
        )}

        {/* Franja descartada de ramificación si hay stepState.strip */}
        {stepState?.strip && stepState.strip.var === 0 && (
          <g>
            <rect
              x={toX(stepState.strip.low)}
              y={toY(maxVal)}
              width={toX(stepState.strip.high) - toX(stepState.strip.low)}
              height={toY(0) - toY(maxVal)}
              fill="url(#hatch-strip-plot)"
            />
            {/* Frontera x1 <= low */}
            <line
              x1={toX(stepState.strip.low)}
              y1={toY(maxVal)}
              x2={toX(stepState.strip.low)}
              y2={toY(0)}
              stroke="#1d3f8f"
              strokeWidth="1.6"
            />
            <text
              x={toX(stepState.strip.low) - 6}
              y={toY(maxVal * 0.85)}
              textAnchor="end"
              fontFamily={SERIF}
              fontSize="13"
              fill="#1d3f8f"
              fontWeight="600"
              paintOrder="stroke"
              stroke="#fff"
              strokeWidth="3"
              strokeLinejoin="round"
            >
              {`x₁ ≤ ${stepState.strip.low}`}
            </text>
            {/* Frontera x1 >= high */}
            <line
              x1={toX(stepState.strip.high)}
              y1={toY(maxVal)}
              x2={toX(stepState.strip.high)}
              y2={toY(0)}
              stroke="#1d3f8f"
              strokeWidth="1.6"
            />
            <text
              x={toX(stepState.strip.high) + 6}
              y={toY(maxVal * 0.85)}
              textAnchor="start"
              fontFamily={SERIF}
              fontSize="13"
              fill="#1d3f8f"
              fontWeight="600"
              paintOrder="stroke"
              stroke="#fff"
              strokeWidth="3"
              strokeLinejoin="round"
            >
              {`x₁ ≥ ${stepState.strip.high}`}
            </text>
            {/* Cartel «sin enteros» */}
            <rect
              x={toX((stepState.strip.low + stepState.strip.high) / 2) - 34}
              y={toY(maxVal * 0.5) - 11}
              width="68"
              height="22"
              fill="#ffffff"
              stroke="#b3261e"
              strokeWidth="1"
              rx="2"
            />
            <text
              x={toX((stepState.strip.low + stepState.strip.high) / 2)}
              y={toY(maxVal * 0.5) + 4}
              textAnchor="middle"
              fontFamily={SERIF}
              fontSize="12"
              fill="#b3261e"
              fontWeight="600"
            >
              sin enteros
            </text>
          </g>
        )}

        {stepState?.strip && stepState.strip.var === 1 && (
          <g>
            <rect
              x={toX(0)}
              y={toY(stepState.strip.high)}
              width={toX(maxVal) - toX(0)}
              height={toY(stepState.strip.low) - toY(stepState.strip.high)}
              fill="url(#hatch-strip-plot)"
            />
            <line
              x1={toX(0)}
              y1={toY(stepState.strip.low)}
              x2={toX(maxVal)}
              y2={toY(stepState.strip.low)}
              stroke="#1d3f8f"
              strokeWidth="1.6"
            />
            <text
              x={toX(maxVal * 0.85)}
              y={toY(stepState.strip.low) + 14}
              textAnchor="middle"
              fontFamily={SERIF}
              fontSize="13"
              fill="#1d3f8f"
              fontWeight="600"
              paintOrder="stroke"
              stroke="#fff"
              strokeWidth="3"
              strokeLinejoin="round"
            >
              {`x₂ ≤ ${stepState.strip.low}`}
            </text>
            <line
              x1={toX(0)}
              y1={toY(stepState.strip.high)}
              x2={toX(maxVal)}
              y2={toY(stepState.strip.high)}
              stroke="#1d3f8f"
              strokeWidth="1.6"
            />
            <text
              x={toX(maxVal * 0.85)}
              y={toY(stepState.strip.high) - 6}
              textAnchor="middle"
              fontFamily={SERIF}
              fontSize="13"
              fill="#1d3f8f"
              fontWeight="600"
              paintOrder="stroke"
              stroke="#fff"
              strokeWidth="3"
              strokeLinejoin="round"
            >
              {`x₂ ≥ ${stepState.strip.high}`}
            </text>
            <rect
              x={toX(maxVal * 0.5) - 34}
              y={toY((stepState.strip.low + stepState.strip.high) / 2) - 11}
              width="68"
              height="22"
              fill="#ffffff"
              stroke="#b3261e"
              strokeWidth="1"
              rx="2"
            />
            <text
              x={toX(maxVal * 0.5)}
              y={toY((stepState.strip.low + stepState.strip.high) / 2) + 4}
              textAnchor="middle"
              fontFamily={SERIF}
              fontSize="12"
              fill="#b3261e"
              fontWeight="600"
            >
              sin enteros
            </text>
          </g>
        )}

        {/* Líneas de las restricciones */}
        {constraintLines.map((line) => (
          <g key={`line-${line.id}`}>
            <line
              x1={line.p1.x}
              y1={line.p1.y}
              x2={line.p2.x}
              y2={line.p2.y}
              stroke="#000"
              strokeWidth="1.2"
              strokeDasharray="4 3"
            />
            {/* Etiqueta en el punto medio */}
            <text
              x={(line.p1.x + line.p2.x) / 2}
              y={(line.p1.y + line.p2.y) / 2 - 6}
              fontFamily={SERIF}
              fontSize="13"
              fill="#000"
              textAnchor="middle"
              paintOrder="stroke"
              stroke="#fff"
              strokeWidth="3"
              strokeLinejoin="round"
            >
              {line.label}
            </text>
          </g>
        ))}

        {/* Modelo mixto con una variable entera: lo factible son segmentos */}
        {segmentos.map((sg) => {
          const d = sg.desde.toNumber();
          const h = sg.hasta.toNumber();
          const horizontal = sg.varIdx === 1; // x2 entera: segmentos horizontales
          const [x1, y1, x2, y2] = horizontal
            ? [toX(d), toY(sg.valor), toX(h), toY(sg.valor)]
            : [toX(sg.valor), toY(d), toX(sg.valor), toY(h)];
          return (
            <line
              key={`sg-${sg.valor}`}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#1d3f8f" strokeWidth="3.5" strokeLinecap="round"
            />
          );
        })}

        {/* Puntos enteros factibles */}
        {intPointsData.points.map((pt, i) => {
          const isOptimal = intPt && Math.abs(pt.x1 - intPt.x1) < 1e-5 && Math.abs(pt.x2 - intPt.x2) < 1e-5;
          if (isOptimal) return null; // se dibuja encima luego
          return (
            <circle
              key={`ip-${i}`}
              cx={toX(pt.x1)}
              cy={toY(pt.x2)}
              r="3.2"
              fill="#000"
            />
          );
        })}

        {/* Punto destacado del paso actual (si aplica) */}
        {stepState?.highlightPoint && (
          <g>
            <circle
              cx={toX(stepState.highlightPoint[0])}
              cy={toY(stepState.highlightPoint[1])}
              r="7"
              fill="#ffffff"
              stroke="#1d3f8f"
              strokeWidth="2.2"
            />
            <circle
              cx={toX(stepState.highlightPoint[0])}
              cy={toY(stepState.highlightPoint[1])}
              r="3"
              fill="#1d3f8f"
            />
            <text
              x={toX(stepState.highlightPoint[0]) + 10}
              y={toY(stepState.highlightPoint[1]) - 8}
              fontFamily={SERIF}
              fontSize="13"
              fontWeight="600"
              fill="#1d3f8f"
              paintOrder="stroke"
              stroke="#fff"
              strokeWidth="3"
              strokeLinejoin="round"
            >
              {`(${stepState.highlightPoint[0].toFixed(2).replace('.', ',')}; ${stepState.highlightPoint[1].toFixed(2).replace('.', ',')})`}
            </text>
          </g>
        )}

        {/* Óptimo relajado (cuadrado) - en modo normal o en pasos de relajación */}
        {relPt && (!stepState || stepState.phase === 'relaxation' || stepState.phase === 'select_branch') && (
          <g>
            <rect
              x={toX(relPt.x1) - 4.5}
              y={toY(relPt.x2) - 4.5}
              width="9"
              height="9"
              fill="#fff"
              stroke="#000"
              strokeWidth="1.8"
            />
            <text
              x={toX(relPt.x1) + 8}
              y={toY(relPt.x2) - 8}
              fontFamily={SERIF}
              fontSize="13"
              fill="#000"
              paintOrder="stroke"
              stroke="#fff"
              strokeWidth="3"
              strokeLinejoin="round"
            >
              Relajación ({relPt.x1.toFixed(2).replace('.', ',')}; {relPt.x2.toFixed(2).replace('.', ',')})
            </text>
          </g>
        )}

        {/* Incumbente / Óptimo entero (círculo azul destacado) */}
        {(() => {
          const activeInt = stepState ? (
            stepState.incumbent?.x && stepState.incumbent.x.length >= 2 ? {
              x1: frac(stepState.incumbent.x[0]).toNumber(),
              x2: frac(stepState.incumbent.x[1]).toNumber(),
              isFinal: stepState.phase === 'conclusion',
            } : null
          ) : (intPt ? { x1: intPt.x1, x2: intPt.x2, isFinal: true } : null);

          if (!activeInt) return null;

          return (
            <g>
              <circle
                cx={toX(activeInt.x1)}
                cy={toY(activeInt.x2)}
                r="6"
                fill="#1d3f8f"
                stroke="#000"
                strokeWidth="1.5"
              />
              <text
                x={toX(activeInt.x1) + 10}
                y={toY(activeInt.x2) + 4}
                fontFamily={SERIF}
                fontSize="13"
                fontWeight="bold"
                fill="#1d3f8f"
                paintOrder="stroke"
                stroke="#fff"
                strokeWidth="3"
                strokeLinejoin="round"
              >
                {activeInt.isFinal
                  ? `Óptimo entero (${activeInt.x1}; ${activeInt.x2})`
                  : `Incumbente (${activeInt.x1}; ${activeInt.x2})`}
              </text>
            </g>
          );
        })()}

        {/* Ejes cartesianos */}
        {/* Eje X1 */}
        <line x1={toX(0)} y1={toY(0)} x2={toX(maxVal) + 15} y2={toY(0)} stroke="#000" strokeWidth="1.2" />
        <polygon
          points={`${toX(maxVal) + 20},${toY(0)} ${toX(maxVal) + 12},${toY(0) - 3.5} ${toX(maxVal) + 12},${toY(0) + 3.5}`}
          fill="#000"
        />
        <text x={toX(maxVal) + 24} y={toY(0) + 4} fontFamily={SERIF} fontSize="14" fontStyle="italic">
          x₁
        </text>

        {/* Eje X2 */}
        <line x1={toX(0)} y1={toY(0)} x2={toX(0)} y2={toY(maxVal) - 15} stroke="#000" strokeWidth="1.2" />
        <polygon
          points={`${toX(0)},${toY(maxVal) - 20} ${toX(0) - 3.5},${toY(maxVal) - 12} ${toX(0) + 3.5},${toY(maxVal) - 12}`}
          fill="#000"
        />
        <text x={toX(0) - 4} y={toY(maxVal) - 24} textAnchor="middle" fontFamily={SERIF} fontSize="14" fontStyle="italic">
          x₂
        </text>

        {/* Marcas de graduación X1 */}
        {ticks.map((t) => (
          <g key={`tx-${t}`}>
            <line x1={toX(t)} y1={toY(0)} x2={toX(t)} y2={toY(0) + 4} stroke="#000" strokeWidth="1" />
            <text x={toX(t)} y={toY(0) + 16} textAnchor="middle" fontFamily={SERIF} fontSize="13" fill="#000">
              {t}
            </text>
          </g>
        ))}

        {/* Marcas de graduación X2 */}
        {ticks.slice(1).map((t) => (
          <g key={`ty-${t}`}>
            <line x1={toX(0) - 4} y1={toY(t)} x2={toX(0)} y2={toY(t)} stroke="#000" strokeWidth="1" />
            <text x={toX(0) - 8} y={toY(t) + 4} textAnchor="end" fontFamily={SERIF} fontSize="13" fill="#000">
              {t}
            </text>
          </g>
        ))}
      </svg>

      {/* Leyenda explicativa en estilo editorial formal */}
      <div className="diagram-legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', marginTop: '0.75rem', fontSize: '0.85rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '12px', height: '12px', background: 'rgba(29, 63, 143, 0.1)', border: '1.5px solid #1d3f8f', display: 'inline-block' }} />
          Región factible continua
        </span>
        {nEnteras === 2 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#000', display: 'inline-block' }} />
            Punto entero factible ({intPointsData.points.length})
          </span>
        )}
        {nEnteras === 1 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '16px', height: '0', borderTop: '3.5px solid #1d3f8f', display: 'inline-block' }} />
            Segmento factible mixto ({segmentos.length})
          </span>
        )}
        {relPt && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '9px', height: '9px', background: '#fff', border: '1.5px solid #000', display: 'inline-block' }} />
            Óptimo relajado
          </span>
        )}
        {intPt && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#1d3f8f', border: '1px solid #000', display: 'inline-block' }} />
            Óptimo entero
          </span>
        )}
      </div>
    </div>
  );
}
