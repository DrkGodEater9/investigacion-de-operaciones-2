/**
 * Diagrama de red (actividad en la flecha) del proyecto, reutilizando la construcción de la herramienta de ruta crítica.
 * La red y su distribución se calculan una sola vez; para cada estado de duraciones solo se recalculan los tiempos.
 */
import { buildNetwork } from '../../ruta-critica/domain/network.js';
import { computeLayout, boundsOf } from '../../ruta-critica/domain/layout.js';
import { computeTimes } from '../../ruta-critica/domain/cpm.js';

export function construirRed(m) {
  const net = buildNetwork(m.actividades.map((a) => ({ name: a.name, preds: a.preds })));
  const suma = m.dn.reduce((t, d) => t + d, 0);
  const radius = Math.max(27, Math.min(46, 11 + Math.max(2, String(suma).length) * 6));
  const layout = computeLayout(net, { radius });
  net.edges
    .filter((e) => e.kind === 'dummy')
    .sort((a, b) => layout.number[a.from] - layout.number[b.from] || layout.number[a.to] - layout.number[b.to])
    .forEach((e, i) => { e.label = 'f' + (i + 1); });
  const bounds = boundsOf(layout.pos, layout.bends, layout.radius);
  const indice = new Map(m.names.map((n, j) => [n, j]));
  return { net, layout, bounds, indice, ficticias: net.edges.filter((e) => e.kind === 'dummy').length };
}

/** Tiempos de eventos y flechas para las duraciones d (índice por actividad). */
export function tiemposRed(red, d) {
  return computeTimes(red.net, red.layout.numbered, (nombre) => d[red.indice.get(nombre)]);
}
