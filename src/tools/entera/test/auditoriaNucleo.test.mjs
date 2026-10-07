import test from 'node:test';
import assert from 'node:assert/strict';
import { frac, ZERO } from '../domain/fraction.js';
import { solveLP } from '../domain/simplex.js';
import { solveIP } from '../domain/branchAndBound.js';
import { resolverRelajacion, solucionOriginal } from '../domain/tablero.js';
import { planosDeCorte } from '../domain/cortes.js';
import { gen } from './utils/generadorAuditoria.mjs';
import { fuerzaBruta } from './utils/fuerzaBruta.mjs';

/**
 * Auditoría del núcleo: modelos aleatorios (n hasta 4, coeficientes fraccionarios y negativos,
 * degenerados, igualdades, b negativo) contra la fuerza bruta independiente.
 * Los cortes de Gomory se validan además punto a punto: cada corte debe cortar la solución
 * fraccionaria previa y no eliminar ningún punto factible entero/mixto conocido.
 */
function evalFila(a, x) { let s = ZERO; a.forEach((v, j) => { s = s.add(frac(v).mul(x[j])); }); return s; }
function cumpleRestr(modelo, x) {
  if (x.some((v) => v.lt(ZERO))) return false;
  return modelo.constraints.every((k) => {
    const d = evalFila(k.a, x).cmp(frac(k.b));
    return k.op === '<=' ? d <= 0 : k.op === '>=' ? d >= 0 : d === 0;
  });
}

test('auditoría núcleo: B&B (4 configuraciones) y tablero vs fuerza bruta', () => {
  const bad = [];
  let infe = 0, opt = 0;
  for (let it = 0; it < 1500; it++) {
    const modelo = gen(1000 + it);
    const n = modelo.c.length;
    const bf = fuerzaBruta(modelo, { cota: n <= 3 ? 8 : 4 });
    const tag = JSON.stringify(modelo);
    bf.estado === 'infactible' ? infe++ : opt++;
    for (const options of [{}, { pruneWithFloor: false }, { branchRule: 'lowestIndex', childOrder: 'upFirst' }, { childOrder: 'downFirst', maxNodes: 5000 }]) {
      const r = solveIP({ ...modelo, options: { maxNodes: 5000, ...options } });
      if (bf.estado === 'infactible') { if (r.status === 'optimal') bad.push(['IP óptimo vs BF infactible', tag]); continue; }
      if (r.status !== 'optimal' || !r.best.z.eq(bf.z)) { bad.push(['z distinto', tag, JSON.stringify(options), r.status, r.best?.z.toString(), bf.z.toString()]); continue; }
      if (!cumpleRestr(modelo, r.best.x)) bad.push(['x infactible', tag]);
      modelo.integer.forEach((e, j) => { if (e && !r.best.x[j].isInteger()) bad.push(['x no entera', tag]); });
      if (!evalFila(modelo.c, r.best.x).eq(r.best.z)) bad.push(['z != c·x', tag]);
    }
    // relajación: simplex clásico vs tablero Gran M vs fuerza bruta de LP (todas continuas)
    const lp = solveLP(modelo);
    let tb;
    try { tb = resolverRelajacion(modelo); } catch (e) { bad.push(['tablero lanzó', tag, e.message]); continue; }
    if (lp.status === 'optimal') {
      if (tb.estado !== 'optimo' || !tb.z.eq(lp.z)) bad.push(['LP vs tablero', tag, lp.z.toString(), tb.estado, tb.z?.toString()]);
      if (!cumpleRestr(modelo, lp.x) || !evalFila(modelo.c, lp.x).eq(lp.z)) bad.push(['LP x inválido', tag]);
    } else if (lp.status === 'infeasible' && tb.estado !== 'infactible') bad.push(['LP infactible vs tablero', tag, tb.estado]);
    // LP puro por enumeración de vértices
    const lpModelo = { ...modelo, integer: modelo.integer.map(() => false) };
    const bfLP = fuerzaBruta(lpModelo, { cota: 0 });
    if (bfLP.estado === 'optimo') { if (lp.status !== 'optimal' || !lp.z.eq(bfLP.z)) bad.push(['LP vs vértices', tag, lp.status, lp.z?.toString(), bfLP.z.toString()]); }
    else if (lp.status !== 'infeasible') bad.push(['LP debía ser infactible', tag, lp.status]);
  }
  assert.ok(infe > 20 && opt > 100, `muestra: ${infe} infactibles, ${opt} factibles`);
  assert.equal(bad.length, 0, `${bad.length}: ` + bad.slice(0, 4).map((b) => JSON.stringify(b)).join(' | '));
});

test('auditoría núcleo: cortes de Gomory válidos, cortan la solución previa y convergen', () => {
  const bad = []; let cortes = 0, lim = 0, lanz = 0;
  for (let it = 0; it < 1200; it++) {
    const modelo = gen(50000 + it, { n: 2 + (it % 3) });
    const n = modelo.c.length;
    const cota = n <= 3 ? 8 : 4;
    const bf = fuerzaBruta(modelo, { cota });
    if (bf.estado === 'infactible') continue;
    const tag = JSON.stringify(modelo);
    // puntos factibles de referencia: óptimos por asignación entera bajo varios objetivos
    const pts = [...bf.puntos.map((p) => p.x)];
    for (const cc of [modelo.c.map((v) => frac(v).neg()), modelo.c.map((_, j) => (j % 2 ? 1 : -1)), modelo.c.map(() => 1), modelo.c.map(() => -1)]) {
      const b2 = fuerzaBruta({ ...modelo, c: cc }, { cota });
      pts.push(...b2.puntos.map((p) => p.x));
    }
    let pc;
    try { pc = planosDeCorte(modelo, { tipo: 'mixto', maxCortes: 14 }); } catch (e) { lanz++; bad.push(['planosDeCorte lanzó', tag, e.message]); continue; }
    if (pc.estado === 'limite_de_cortes') { lim++; continue; }
    if (pc.estado === 'infactible') { bad.push(['infactible pero BF factible', tag]); continue; }
    if (pc.estado !== 'optimo' || !pc.z.eq(bf.z)) bad.push(['z cortes', tag, pc.estado, pc.z?.toString(), bf.z.toString()]);
    for (const k of pc.cortes) {
      cortes++;
      const { coefs, op, rhs } = k.enOriginales;
      const holds = (x) => { const d = evalFila(coefs, x).cmp(rhs); return op === '>=' ? d >= 0 : d <= 0; };
      const antes = solucionOriginal(k.tableroAntes);
      if (holds(antes)) bad.push(['corte no corta la solución previa', tag, k.k]);
      for (const p of pts) if (!holds(p)) { bad.push(['corte elimina punto factible', tag, k.k, p.map(String)]); break; }
    }
  }
  assert.ok(cortes > 300, `cortes revisados: ${cortes}`);
  assert.equal(bad.length, 0, `${bad.length} (límite ${lim}): ` + bad.slice(0, 4).map((b) => JSON.stringify(b)).join(' | '));
});

