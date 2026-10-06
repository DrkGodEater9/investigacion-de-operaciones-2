import test from 'node:test';
import assert from 'node:assert/strict';
import { frac } from '../domain/fraction.js';
import { solveLP } from '../domain/simplex.js';
import { solveIP } from '../domain/branchAndBound.js';
import { resolverRelajacion } from '../domain/tablero.js';
import { planosDeCorte } from '../domain/cortes.js';
import { fuerzaBruta } from './utils/fuerzaBruta.mjs';

/**
 * Prueba de estrés del solucionador: 600 modelos aleatorios (2-3 variables, máx/mín, ≤ ≥ =,
 * b negativo, entera pura y mixta) contra la fuerza bruta independiente, con 4 configuraciones
 * del B&B, simplex clásico vs tablero Gran M, y cortes de Gomory vs fuerza bruta.
 */
test('estrés: solveIP, simplex, tablero y Gomory coinciden con la fuerza bruta', () => {
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const bad = []; const stats = { ip: 0, lp: 0, cut: 0, infe: 0, opts: 0 };
  for (let it = 0; it < 600; it++) {
    const n = ri(2, 3), m = ri(1, 3);
    const sense = rnd() < 0.5 ? 'max' : 'min';
    const c = Array.from({ length: n }, () => ri(-3, 9));
    const integer = Array.from({ length: n }, () => rnd() < 0.6);
    if (rnd() < 0.2) integer.fill(true);
    const constraints = Array.from({ length: m }, () => {
      const op = ['<=', '<=', '>=', '='][ri(0, 3)];
      return { a: Array.from({ length: n }, () => ri(-2, 8)), op, b: op === '=' ? ri(0, 20) : ri(-3, 40) };
    });
    constraints.push({ a: Array(n).fill(1), op: '<=', b: 12 }); // acota
    const modelo = { sense, c, constraints, integer };
    const bf = fuerzaBruta(modelo, { cota: 12 });
    const tag = JSON.stringify(modelo);
    for (const opts of [{}, { pruneWithFloor: false }, { branchRule: 'lowestIndex', childOrder: 'upFirst' }, { childOrder: 'downFirst' }]) {
      const r = solveIP({ sense, c, constraints, integer, options: opts }); stats.opts++;
      if (bf.estado === 'infactible') { if (r.status === 'optimal') bad.push(['IP dice óptimo, BF infactible', tag, opts]); }
      else if (r.status !== 'optimal' || !r.best.z.eq(bf.z)) bad.push(['IP z distinto', tag, JSON.stringify(opts), r.status, r.best && r.best.z.toString(), bf.z.toString()]);
      else {
        // factibilidad del x devuelto
        const x = r.best.x;
        for (let j = 0; j < n; j++) { if (x[j].lt(frac(0))) bad.push(['x<0', tag]); if (integer[j] && !x[j].isInteger()) bad.push(['no entera', tag]); }
        for (const k of constraints) { let s = frac(0); k.a.forEach((v, j) => (s = s.add(frac(v).mul(x[j])))); const d = s.cmp(frac(k.b)); if ((k.op === '<=' && d > 0) || (k.op === '>=' && d < 0) || (k.op === '=' && d !== 0)) bad.push(['x infactible', tag]); }
      }
    }
    stats.ip++; if (bf.estado === 'infactible') stats.infe++;
    // relajación: simplex clásico vs tablero
    const lp = solveLP({ sense, c, constraints });
    const tb = resolverRelajacion(modelo);
    stats.lp++;
    const tz = tb.z ?? (tb.tablero && tb.tablero.zval && tb.tablero.zval.a);
    if (lp.status === 'optimal') { if (tb.estado !== 'optimo' || !tz.eq(lp.z)) bad.push(['LP vs tablero', tag, lp.z.toString(), tb.estado, tz && tz.toString()]); }
    else if (lp.status === 'infeasible' && tb.estado !== 'infactible') bad.push(['LP infactible vs tablero', tag, tb.estado]);
    // cortes
    if (bf.estado === 'optimo') {
      const pc = planosDeCorte(modelo, { tipo: 'mixto', maxCortes: 60 }); stats.cut++;
      if (pc.estado === 'optimo' && !pc.z.eq(bf.z)) bad.push(['Gomory mixto z', tag, pc.z.toString(), bf.z.toString()]);
      if (pc.estado === 'infactible') bad.push(['Gomory infactible pero BF factible', tag]);
    }
  }
  assert.equal(bad.length, 0, bad.slice(0, 5).map((b) => JSON.stringify(b)).join(' | '));
  assert.ok(stats.infe > 50 && stats.cut > 200, 'la muestra debe incluir infactibles y factibles');
});
