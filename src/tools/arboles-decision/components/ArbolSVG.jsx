import { forwardRef, useMemo } from 'react';
import { disponer, textosRama } from '../domain/layout.js';
import { fmtNum } from '../domain/format.js';
import { NOTACION } from '../domain/notacion.js';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";
const BLUE = '#1d3f8f';
const RED = '#b3261e';
const INK = '#000';
const HALO = { stroke: '#fff', strokeWidth: 3.2, paintOrder: 'stroke', strokeLinejoin: 'round' };

/**
 * Árbol de decisión en SVG (atributos inline: se ve igual en pantalla, en PNG y en PDF).
 * Decisión = cuadrado, azar = círculo, resultado final = el valor a la derecha de la rama.
 *
 * Props:
 *  - arbol: árbol normalizado (en los ejercicios puede traer probabilidades desconocidas: p null o texto)
 *  - evaluacion: resultado de evaluar() (opcional); si falta solo se dibuja el árbol
 *  - resueltos: objeto { id: true } con los nodos cuyo valor ya se muestra (null = todos)
 *  - actual: id del nodo que se está resolviendo (se resalta)
 *  - camino: resalta en azul la estrategia óptima (ramas elegidas)
 */
const ArbolSVG = forwardRef(function ArbolSVG({ arbol, evaluacion = null, resueltos = null, actual = null, camino = false, etiqueta = 'Árbol de decisión' }, ref) {
  const L = useMemo(() => disponer(arbol), [arbol]);
  const g = L.geom;
  const r = g.radio;
  const resuelto = (id) => evaluacion && (resueltos == null || resueltos[id]);
  const enPolitica = (id, i) => camino && evaluacion && evaluacion.politica[`${id}:${i}`];

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${L.ancho} ${L.alto}`}
      width={L.ancho}
      height={L.alto}
      style={{ display: 'block', maxWidth: 'none' }}
      role="img"
      aria-label={etiqueta}
    >
      {L.aristas.map((a, k) => {
        const nodoP = a.padre.nodo;
        const hijo = a.hijo.nodo;
        const xm = a.x1 + r + 26;
        const xFin = a.x2 - (hijo.tipo === 'final' ? 0 : r);
        const azul = enPolitica(nodoP.id, a.idx);
        const info = evaluacion && resuelto(nodoP.id) ? evaluacion.porNodo[nodoP.id] : null;
        const podada = nodoP.tipo === 'decision' && info && !info.ramas[a.idx].optima;
        const t = textosRama(nodoP, a.rama);
        return (
          <g key={`e${k}`}>
            <path d={`M ${a.x1 + r} ${a.y1} H ${xm} V ${a.y2} H ${xFin}`} fill="none" stroke={azul ? BLUE : INK} strokeWidth={azul ? 2.4 : 1.1} strokeLinejoin="round" />
            <text x={xm + 6} y={a.y2 - 6} fontFamily={SERIF} fontSize="12.5" fill={azul ? BLUE : INK} {...HALO}>{t.arriba}</text>
            {t.abajo && <text x={xm + 6} y={a.y2 + 14} fontFamily={SERIF} fontSize="12" fill="#444" {...HALO}>{t.abajo}</text>}
            {podada && (
              <g stroke={RED} strokeWidth="1.8">
                <line x1={xFin - 26} y1={a.y2 - 8} x2={xFin - 26} y2={a.y2 + 8} />
                <line x1={xFin - 21} y1={a.y2 - 8} x2={xFin - 21} y2={a.y2 + 8} />
              </g>
            )}
          </g>
        );
      })}
      {L.nodos.map((n) => {
        const nodo = n.nodo;
        const info = evaluacion && resuelto(n.id) ? evaluacion.porNodo[n.id] : null;
        const esActual = n.id === actual;
        const enCamino = camino && evaluacion && evaluacion.alcanzados[n.id];
        const trazo = esActual || (enCamino && nodo.tipo !== 'final') ? BLUE : INK;
        const grosor = esActual ? 2.8 : enCamino ? 2.2 : 1.4;
        if (nodo.tipo === 'final') {
          return (
            <text key={`n${n.id}`} x={n.x + 8} y={n.y + 4.5} fontFamily={SERIF} fontSize="14" fontWeight="700" fill={enCamino ? BLUE : INK} {...HALO}>
              {fmtNum(nodo.valor)}
            </text>
          );
        }
        const valorTxt = info ? `${nodo.tipo === 'azar' ? NOTACION.valorEsperado : NOTACION.valorDecision} = ${fmtNum(info.valor)}` : null;
        return (
          <g key={`n${n.id}`}>
            {nodo.tipo === 'decision'
              ? <rect x={n.x - r} y={n.y - r} width={2 * r} height={2 * r} fill="#fff" stroke={trazo} strokeWidth={grosor} />
              : <circle cx={n.x} cy={n.y} r={r} fill="#fff" stroke={trazo} strokeWidth={grosor} />}
            <text x={n.x + r} y={n.y - r - 22} textAnchor="end" fontFamily={SERIF} fontSize="12.5" fill={INK} {...HALO}>{nodo.nombre}</text>
            {valorTxt && (
              <text x={n.x + r} y={n.y - r - 8} textAnchor="end" fontFamily={SERIF} fontSize="13.5" fontWeight="700" fill={enCamino ? BLUE : INK} {...HALO}>{valorTxt}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
});

export default ArbolSVG;
