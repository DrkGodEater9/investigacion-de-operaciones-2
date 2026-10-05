import { useMemo } from 'react';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";

/**
 * Diagrama SVG interactivo del árbol de ramificación y acotamiento.
 * Calcula automáticamente la distribución espacial de los nodos según su jerarquía.
 */
export function TreeDiagram({ nodes = [], activeNodeId = null }) {
  const layout = useMemo(() => {
    if (!nodes || nodes.length === 0) return null;

    // Agrupar por profundidad
    const byDepth = new Map();
    nodes.forEach((n) => {
      const d = n.depth || 0;
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d).push(n);
    });

    const NODE_W = 160;
    const NODE_H = 62;
    const GAP_Y = 70;
    const LEAF_GAP = 28;

    // Para distribuir horizontalmente:
    // Hacemos un recorrido recursivo desde la raíz para asignar posX y posY
    const nodeMap = new Map(nodes.map((n) => [n.id, { ...n, children: [] }]));
    nodes.forEach((n) => {
      if (n.parentId !== null && nodeMap.has(n.parentId)) {
        nodeMap.get(n.parentId).children.push(nodeMap.get(n.id));
      }
    });

    let currentLeafX = 0;

    function assignPosition(node) {
      if (node.children.length === 0) {
        node.posX = currentLeafX;
        currentLeafX += NODE_W + LEAF_GAP;
      } else {
        node.children.forEach(assignPosition);
        const first = node.children[0].posX;
        const last = node.children[node.children.length - 1].posX;
        node.posX = (first + last) / 2;
      }
      node.posY = 20 + node.depth * (NODE_H + GAP_Y);
    }

    const roots = nodes.filter((n) => n.parentId === null);
    roots.forEach((r) => assignPosition(nodeMap.get(r.id)));

    // Extraer nodos posicionados
    const positionedNodes = Array.from(nodeMap.values());

    // Calcular límites para el viewBox
    const minX = Math.min(...positionedNodes.map((n) => n.posX)) - 20;
    const maxX = Math.max(...positionedNodes.map((n) => n.posX + NODE_W)) + 20;
    const maxY = Math.max(...positionedNodes.map((n) => n.posY + NODE_H + 30));

    const totalW = Math.max(480, maxX - minX);
    const totalH = Math.max(220, maxY + 20);

    return {
      nodes: positionedNodes,
      viewBox: `${minX} 0 ${totalW} ${totalH}`,
      width: totalW,
      height: totalH,
    };
  }, [nodes]);

  if (!layout) {
    return (
      <div className="empty-state" style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#666', border: '1px dashed #d0d0d0', borderRadius: '4px' }}>
        <p style={{ margin: 0, fontFamily: SERIF, fontSize: '15px' }}>El árbol de ramificación y acotamiento se irá construyendo paso a paso.</p>
      </div>
    );
  }

  return (
    <div className="tree-diagram-container" style={{ width: '100%' }}>
      <div className="tree-svg-scroll-wrap" style={{ overflowX: 'auto', width: '100%' }}>
        <svg
          viewBox={layout.viewBox}
          role="img"
          aria-label="Árbol de ramificación y acotamiento"
          className="tree-diagram-svg"
          style={{ width: '100%', minWidth: Math.min(layout.width * 0.7, 680), maxWidth: '100%', height: 'auto', display: 'block' }}
        >
          {/* Conexiones (flechas entre padre e hijo) */}
          {layout.nodes.map((node) => {
            if (node.parentId === null) return null;
            const parent = layout.nodes.find((p) => p.id === node.parentId);
            if (!parent) return null;

            const x1 = parent.posX + 80;
            const y1 = parent.posY + 62;
            const x2 = node.posX + 80;
            const y2 = node.posY;

            // Etiqueta de la rama (x_k <= v o x_k >= v)
            const sign = node.branchOp === '<=' ? '≤' : node.branchOp === '>=' ? '≥' : '=';
            const label = `x${node.branchVar + 1} ${sign} ${node.branchBound ? node.branchBound.toString() : ''}`;
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            return (
              <g key={`edge-${node.id}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#000"
                  strokeWidth="1.2"
                />
                {/* Rótulo de la restricción con halo blanco */}
                <text
                  x={midX}
                  y={midY - 4}
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
                  {label}
                </text>
              </g>
            );
          })}

          {/* Cajas de Nodos */}
          {layout.nodes.map((node) => {
            const isActive = activeNodeId !== null && node.id === activeNodeId;
            const isIncumbent = node.action === 'incumbent';
            const isPruned = node.action.startsWith('pruned');
            const strokeColor = isActive ? '#1d3f8f' : isIncumbent ? '#1d3f8f' : isPruned ? '#b3261e' : '#000000';
            const strokeWidth = isActive ? 2.4 : isIncumbent || isPruned ? 1.6 : 1.2;
            const fillColor = isActive ? '#f0f4fa' : '#ffffff';

            const formatX = (vec) => {
              if (!Array.isArray(vec)) return 'infactible';
              return '(' + vec.map((v) => (v.toDual ? v.toDual() : String(v))).join('; ') + ')';
            };

            // Si el texto no cabe en el recuadro (4 o más variables), se comprime para que no se salga.
            const textoX = Array.isArray(node.x) ? `x = ${formatX(node.x)}` : 'Infactible';
            const ajusteX = textoX.length * 6.3 > 148
              ? { textLength: 148, lengthAdjust: 'spacingAndGlyphs' }
              : {};

            return (
              <g key={`node-${node.id}`} transform={`translate(${node.posX}, ${node.posY})`}>
                <rect
                  width="160"
                  height="62"
                  rx="3"
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                />
                {isActive && (
                  <rect
                    x="-3"
                    y="-3"
                    width="166"
                    height="68"
                    rx="5"
                    fill="none"
                    stroke="#1d3f8f"
                    strokeWidth="1"
                    strokeDasharray="3 2"
                    opacity="0.7"
                  />
                )}
                {/* Título del nodo (P0, P1...) */}
                <text
                  x="80"
                  y="20"
                  textAnchor="middle"
                  fontFamily={SERIF}
                  fontSize="13.5"
                  fontWeight="600"
                  fill={strokeColor}
                >
                  {node.label}
                </text>

                {/* Coordenadas x y Z */}
                <text
                  x="80"
                  y="38"
                  textAnchor="middle"
                  fontFamily={SERIF}
                  fontSize="12.5"
                  fill="#000"
                  {...ajusteX}
                >
                  {textoX}
                </text>

                <text
                  x="80"
                  y="53"
                  textAnchor="middle"
                  fontFamily={SERIF}
                  fontSize="12"
                  fill={strokeColor}
                  fontWeight={isIncumbent || isPruned ? '600' : 'normal'}
                >
                  {node.z ? `Z = ${node.z.toDual ? node.z.toDual() : node.z}` : '—'}
                  {isIncumbent ? ' · entera' : isPruned ? ' · podado' : ''}
                </text>

                {/* Marca de poda con barra cruzada si es nodo terminal podado */}
                {isPruned && (
                  <g>
                    <line x1="80" y1="62" x2="80" y2="78" stroke="#b3261e" strokeWidth="1.2" />
                    <line x1="70" y1="72" x2="90" y2="72" stroke="#b3261e" strokeWidth="2.5" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
export default TreeDiagram;
