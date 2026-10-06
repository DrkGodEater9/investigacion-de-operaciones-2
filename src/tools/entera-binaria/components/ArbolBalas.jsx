import { forwardRef, useMemo } from 'react';
import { fmtNum, sub } from '../domain/format.js';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";
const BLUE = '#1d3f8f';
const RED = '#b3261e';
const DX = 92;
const DY = 80;
const NW = 76;
const NH = 40;
const PAD = 24;
const MAX_NODOS = 200;

/** Nombre visible de una variable transformada: «x₂» o «x₂′» (complemento). */
const visible = (nombre) => sub(String(nombre).replace(/′$/, '')) + (String(nombre).endsWith('′') ? '′' : '');

/**
 * Árbol del método aditivo de Balas (SVG con atributos inline, igual en pantalla, PNG y PDF).
 * Props: trace, hasta (índice base 0 del último nodo visible), actual (id resaltado o null), nombres.
 */
const ArbolBalas = forwardRef(function ArbolBalas({ trace, hasta, actual = null, nombres }, ref) {
  const ultimo = hasta == null ? trace.length - 1 : hasta;
  const grande = trace.length > MAX_NODOS;

  const dibujo = useMemo(() => {
    if (grande) return null;
    const vis = trace.filter((_, k) => k <= ultimo);
    if (vis.length === 0) return null;
    const hijos = new Map();
    vis.forEach((n) => {
      if (n.parentId != null) {
        if (!hijos.has(n.parentId)) hijos.set(n.parentId, []);
        hijos.get(n.parentId).push(n);
      }
    });
    const pos = new Map();
    let hoja = 0;
    let profMax = 0;
    const colocar = (n, prof) => {
      profMax = Math.max(profMax, prof);
      const hs = hijos.get(n.id) || [];
      let x;
      if (hs.length === 0) { x = hoja * DX; hoja += 1; }
      else {
        const xs = hs.map((h) => colocar(h, prof + 1));
        x = (xs[0] + xs[xs.length - 1]) / 2;
      }
      pos.set(n.id, { x, y: prof * DY });
      return x;
    };
    colocar(vis[0], 0);
    // la solución óptima se marca solo cuando el árbol está completo
    const completo = ultimo >= trace.length - 1;
    const factibles = trace.filter((n) => n.decision === 'factible');
    const optimoId = completo && factibles.length ? factibles[factibles.length - 1].id : null;
    return { vis, hijos, pos, optimoId, ancho: Math.max(hoja, 1) * DX - DX + NW + 2 * PAD, alto: profMax * DY + NH + 2 * PAD + 20 };
  }, [trace, ultimo, grande]);

  if (grande) return <p className="arbol-aviso">El árbol es demasiado grande para dibujarlo; usa la tabla.</p>;
  if (!dibujo) return null;
  const { vis, pos, optimoId, ancho, alto } = dibujo;
  const px = (id) => pos.get(id).x + PAD + NW / 2;
  const py = (id) => pos.get(id).y + PAD;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${ancho} ${alto}`}
      width={ancho}
      height={alto}
      style={{ display: 'block', maxWidth: 'none' }}
      role="img"
      aria-label="Árbol del método aditivo de Balas"
    >
      {vis.filter((n) => n.parentId != null).map((n) => {
        const x1 = px(n.parentId);
        const y1 = py(n.parentId) + NH;
        const x2 = px(n.id);
        const y2 = py(n.id);
        const nombre = n.rama ? visible(nombres ? nombres[n.rama.j] : 'x' + (n.rama.j + 1)) : '';
        return (
          <g key={'e' + n.id}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#000" strokeWidth="1" />
            <text
              x={(x1 + x2) / 2 + (x2 < x1 ? -4 : 4)}
              y={(y1 + y2) / 2 + 4}
              textAnchor={x2 < x1 ? 'end' : 'start'}
              fontFamily={SERIF}
              fontSize="13"
              fill="#000"
              stroke="#fff"
              strokeWidth="3"
              paintOrder="stroke"
            >
              {`${nombre} = ${n.rama.valor}`}
            </text>
          </g>
        );
      })}
      {vis.map((n) => {
        const x = px(n.id) - NW / 2;
        const y = py(n.id);
        const esFactible = n.decision === 'factible';
        const esPoda = n.decision === 'poda-infactible' || n.decision === 'poda-cota';
        const esOptimo = n.id === optimoId;
        const esActual = n.id === actual;
        const color = esFactible ? BLUE : '#000';
        const grosor = esActual ? 2.6 : esFactible ? 2 : 1.2;
        const etiqueta = esOptimo ? 'óptimo' : esFactible ? 'factible' : esPoda ? 'podada' : null;
        return (
          <g key={'n' + n.id}>
            <rect x={x} y={y} width={NW} height={NH} rx="6" fill="#fff" stroke={esPoda ? RED : color} strokeWidth={grosor} />
            <text x={x + NW / 2} y={y + 16} textAnchor="middle" fontFamily={SERIF} fontSize="13" fill="#000">{`N${n.id}`}</text>
            <text x={x + NW / 2} y={y + 32} textAnchor="middle" fontFamily={SERIF} fontSize="14" fill="#000">{`Z = ${fmtNum(n.z)}`}</text>
            {etiqueta && (
              <text
                x={x + NW / 2}
                y={y + NH + 16}
                textAnchor="middle"
                fontFamily={SERIF}
                fontSize="13"
                fontWeight={esOptimo ? 700 : 400}
                fill={esPoda ? RED : BLUE}
              >
                {etiqueta}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
});

export default ArbolBalas;
