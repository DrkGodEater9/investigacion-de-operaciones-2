import { normalize } from './validate.js';
import { buildNetwork } from './network.js';
import { computeLayout } from './layout.js';
import { computeTimes } from './cpm.js';
import { expectedTime, variance } from './pert.js';
import { enumerateRoutes } from './routes.js';
import { buildSteps } from './steps.js';
import { fmt } from './format.js';

/** Tubería completa: filas editables → red, distribución, tiempos, rutas y pasos. */
export function analyze({ rows, mode, decimals }) {
  const { activities, errors, warnings } = normalize(rows, mode);
  if (errors.length) return { ok: false, errors, warnings, activities };

  const byName = new Map(activities.map((a) => [a.name, a]));
  if (mode === 'pert') {
    activities.forEach((a) => {
      a.te = expectedTime(a.a, a.m, a.b);
      a.var = variance(a.a, a.b);
    });
  }
  const dur = mode === 'cpm' ? (n) => byName.get(n).d : mode === 'pert' ? (n) => byName.get(n).te : null;

  const net = buildNetwork(activities);
  let longest = 2;
  if (dur) {
    // Estimación del texto más largo dentro de un evento, para dimensionar los círculos.
    const sample = activities.reduce((s, a) => s + dur(a.name), 0);
    longest = Math.max(2, fmt(sample, decimals).length);
  }
  const radius = Math.max(27, Math.min(46, 11 + longest * 6));
  const layout = computeLayout(net, { radius });
  // Ficticias numeradas en el orden en que aparecen en el diagrama
  net.edges
    .filter((e) => e.kind === 'dummy')
    .sort((a, b) => layout.number[a.from] - layout.number[b.from] || layout.number[a.to] - layout.number[b.to])
    .forEach((e, i) => { e.label = 'f' + (i + 1); });

  let times = null;
  let steps = [];
  let critical = { routes: [], truncated: false };
  if (dur) {
    times = computeTimes(net, layout.numbered, dur);
    steps = buildSteps(net, layout, times, dur, decimals);
    critical = enumerateRoutes(net, { dur, edgeOk: (e) => times.edgeInfo[e.id].critical, limit: 500 });
  }
  const all = enumerateRoutes(net, { dur, limit: 3000 });

  const notes = net.notes.map((x) => `En "${x.activity}" se omitió la predecesora "${x.removed}" porque ya está implícita a través de "${x.via}".`);
  return {
    ok: true,
    errors: [],
    warnings: [...warnings, ...notes],
    mode,
    decimals,
    activities,
    byName,
    dur,
    net,
    layout,
    times,
    steps,
    critical,
    all,
    dummies: net.edges.filter((e) => e.kind === 'dummy').length,
  };
}
