// Verificación: npm test
import { EXAMPLES } from '../domain/examples.js';
import { analyze } from '../domain/analyze.js';

const close = (a, b) => Math.abs(a - b) < 1e-6;

// Cálculo independiente sobre la tabla (sin red de flechas): ES, EF, LS, LF por actividad.
function reference(acts, dur) {
  const byName = new Map(acts.map((a) => [a.name, a]));
  const ES = {}, EF = {}, LS = {}, LF = {};
  const order = [];
  const seen = new Set();
  const visit = (n) => { if (seen.has(n)) return; seen.add(n); byName.get(n).preds.forEach(visit); order.push(n); };
  acts.forEach((a) => visit(a.name));
  for (const n of order) { ES[n] = Math.max(0, ...byName.get(n).preds.map((p) => EF[p])); EF[n] = ES[n] + dur(n); }
  const T = Math.max(...acts.map((a) => EF[a.name]));
  const succ = new Map(acts.map((a) => [a.name, []]));
  acts.forEach((a) => a.preds.forEach((p) => succ.get(p).push(a.name)));
  for (const n of [...order].reverse()) { LF[n] = Math.min(T, ...succ.get(n).map((s) => LS[s])); LS[n] = LF[n] - dur(n); }
  return { T, ES, EF, LS, LF };
}

function check(rows, mode) {
  const r = analyze({ rows, mode, decimals: 2 });
  if (!r.ok) return [`no construyó: ${r.errors[0].msg}`];
  const errs = [];
  const { net, layout } = r;
  const N = layout.number;
  const pos = layout.pos;
  // 1. Flechas hacia adelante (número y posición)
  for (const e of net.edges) {
    if (N[e.from] >= N[e.to]) errs.push(`flecha ${e.act || e.label} no cumple i<j`);
    if (pos[e.from].x >= pos[e.to].x) errs.push(`flecha ${e.act || e.label} va hacia atrás`);
  }
  // 2. Ni flechas paralelas ni ficticias de ida y vuelta
  const pairs = new Set();
  for (const e of net.edges) {
    const k = e.from + '>' + e.to;
    if (pairs.has(k)) errs.push('dos flechas entre los mismos eventos');
    if (pairs.has(e.to + '>' + e.from)) errs.push('ida y vuelta');
    pairs.add(k);
  }
  // 3. Un solo inicio y un solo fin
  const indeg = {}, outdeg = {};
  net.nodes.forEach((v) => { indeg[v] = 0; outdeg[v] = 0; });
  net.edges.forEach((e) => { indeg[e.to]++; outdeg[e.from]++; });
  if (net.nodes.filter((v) => !indeg[v]).length !== 1) errs.push('más de un evento inicial');
  if (net.nodes.filter((v) => !outdeg[v]).length !== 1) errs.push('más de un evento final');
  // 4. Precedencias idénticas a la tabla (ni faltan ni sobran)
  const out = new Map();
  net.edges.forEach((e) => (out.get(e.from) || out.set(e.from, []).get(e.from)).push(e));
  const actEdge = new Map(net.edges.filter((e) => e.kind === 'activity').map((e) => [e.act, e]));
  const reach = (v) => { const s = new Set(); const seen = new Set([v]); const st = [v]; while (st.length) { const x = st.pop(); for (const e of out.get(x) || []) { if (e.kind === 'activity') s.add(e.act); if (!seen.has(e.to)) { seen.add(e.to); st.push(e.to); } } } return s; };
  const spec = new Map(r.activities.map((a) => [a.name, a.preds]));
  const memo = new Map();
  const anc = (n) => { if (memo.has(n)) return memo.get(n); const s = new Set(); for (const p of spec.get(n)) { s.add(p); anc(p).forEach((x) => s.add(x)); } memo.set(n, s); return s; };
  for (const a of r.activities) {
    const after = reach(actEdge.get(a.name).to);
    for (const b of r.activities) if (a !== b && after.has(b.name) !== anc(b.name).has(a.name)) errs.push(`precedencia ${a.name}→${b.name} incorrecta`);
  }
  // 5. Tiempos iguales al cálculo independiente
  if (r.dur) {
    const ref = reference(r.activities, r.dur);
    if (!close(ref.T, r.times.T)) errs.push(`T ${r.times.T} ≠ ${ref.T}`);
    for (const a of r.activities) {
      const x = r.times.edgeInfo[actEdge.get(a.name).id];
      if (!close(x.tic, ref.ES[a.name]) || !close(x.tfc, ref.EF[a.name]) || !close(x.til, ref.LS[a.name]) || !close(x.tfl, ref.LF[a.name]))
        errs.push(`tiempos de ${a.name} no coinciden`);
    }
    // cada ruta crítica suma T
    for (const cr of r.critical.routes) if (!close(cr.length, r.times.T)) errs.push('ruta crítica que no suma T');
  }
  return errs.length ? errs : null;
}

let failures = 0;
for (const ex of EXAMPLES) {
  const e = check(ex.activities, ex.mode);
  const r = analyze({ rows: ex.activities, mode: ex.mode, decimals: 2 });
  console.log(`${e ? 'FALLA' : 'ok   '} ${ex.title.padEnd(24)} T=${r.times?.T ?? '-'}  ficticias=${r.dummies}  rutas críticas: ${r.critical.routes.map((x) => x.acts.join('-')).join(' | ') || '-'}`);
  if (e) { failures++; console.log('   ', e.slice(0, 5)); }
}

// Redes aleatorias
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const TOTAL = 1500;
for (let t = 0; t < TOTAL; t++) {
  const n = 2 + Math.floor(rnd() * 18);
  const rows = [];
  for (let i = 0; i < n; i++) {
    const preds = [];
    for (let j = 0; j < i; j++) if (rnd() < 0.25) preds.push('T' + j);
    rows.push({ name: 'T' + i, preds: preds.join(',') || '-', d: String(1 + Math.floor(rnd() * 9)) });
  }
  const e = check(rows, 'cpm');
  if (e) { failures++; if (failures < 5) console.log('FALLA aleatoria', rows.map((r) => r.name + ':' + r.preds).join(' '), e.slice(0, 3)); }
}
console.log(`\n${TOTAL} redes aleatorias + ${EXAMPLES.length} ejercicios: ${failures === 0 ? 'todo correcto' : failures + ' fallas'}`);
process.exit(failures ? 1 : 0);
