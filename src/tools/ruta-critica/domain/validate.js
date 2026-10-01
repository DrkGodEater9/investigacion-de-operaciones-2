import { splitPreds, toNumber } from './parser.js';

/** Normaliza filas editables a actividades y detecta errores. */
export function normalize(rows, mode) {
  const errors = [];
  const warnings = [];
  const activities = [];
  const seen = new Map();

  rows.forEach((r, i) => {
    const name = String(r.name ?? '').trim();
    const hasContent = name || String(r.preds ?? '').trim() || r.d || r.a || r.m || r.b;
    if (!name) {
      if (hasContent) errors.push({ row: i, msg: `La fila ${i + 1} no tiene nombre de actividad.` });
      return;
    }
    if (seen.has(name)) {
      errors.push({ row: i, msg: `La actividad "${name}" está repetida (filas ${seen.get(name) + 1} y ${i + 1}).` });
      return;
    }
    seen.set(name, i);
    const act = { name, preds: [...new Set(splitPreds(r.preds))], row: i };
    if (mode === 'cpm') {
      act.d = toNumber(r.d);
      if (act.d == null) errors.push({ row: i, msg: `Falta la duración de "${name}".` });
      else if (act.d < 0) errors.push({ row: i, msg: `La duración de "${name}" no puede ser negativa.` });
    }
    if (mode === 'pert') {
      act.a = toNumber(r.a);
      act.m = toNumber(r.m);
      act.b = toNumber(r.b);
      if (act.a == null || act.m == null || act.b == null) {
        errors.push({ row: i, msg: `"${name}" necesita los tres tiempos a, m y b.` });
      } else if (act.a < 0 || act.m < 0 || act.b < 0) {
        errors.push({ row: i, msg: `Los tiempos de "${name}" no pueden ser negativos.` });
      } else if (!(act.a <= act.m && act.m <= act.b)) {
        warnings.push(`En "${name}" se esperaba a ≤ m ≤ b (hay ${act.a}, ${act.m}, ${act.b}).`);
      }
    }
    activities.push(act);
  });

  for (const act of activities) {
    for (const p of act.preds) {
      if (p === act.name) errors.push({ row: act.row, msg: `"${act.name}" no puede depender de sí misma.` });
      else if (!seen.has(p)) errors.push({ row: act.row, msg: `"${act.name}" depende de "${p}", que no existe en la tabla.` });
    }
  }

  if (!errors.length) {
    const cycle = findCycle(activities);
    if (cycle) errors.push({ row: null, msg: `Hay un ciclo de dependencias: ${cycle.join(' → ')}. Una red de proyecto no puede volver atrás.` });
  }

  if (!activities.length && !errors.length) errors.push({ row: null, msg: 'Agrega al menos una actividad para construir la red.' });
  return { activities, errors, warnings };
}

function findCycle(acts) {
  const preds = new Map(acts.map((a) => [a.name, a.preds]));
  const state = new Map();
  const stack = [];
  const dfs = (n) => {
    state.set(n, 1);
    stack.push(n);
    for (const p of preds.get(n) || []) {
      if (state.get(p) === 1) return [...stack.slice(stack.indexOf(p)), p].reverse();
      if (!state.get(p)) {
        const c = dfs(p);
        if (c) return c;
      }
    }
    stack.pop();
    state.set(n, 2);
    return null;
  };
  for (const a of acts) if (!state.get(a.name)) {
    const c = dfs(a.name);
    if (c) return c;
  }
  return null;
}
