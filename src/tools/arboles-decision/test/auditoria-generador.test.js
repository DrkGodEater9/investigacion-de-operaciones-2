/** Auditoría del generador: miles de semillas por tipo, recalculadas por otro camino. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS, generarEjercicio, corregir } from '../domain/generador.js';
import { fmtNum } from '../domain/format.js';
import { arbolATexto } from '../domain/texto.js';

const N = 2500;
const casi = (a, b, t = 1e-9) => Math.abs(a - b) <= t * Math.max(1, Math.abs(a), Math.abs(b));

/** Valores de las 3 estrategias de los árboles de dos etapas, a mano desde la forma del árbol. */
function estrategiasSecuencial(arbol) {
  const inv = arbol.raiz.ramas[0];
  const res = inv.hijo;
  const [bueno, regular] = res.ramas;
  const exp = bueno.hijo;
  const merc = exp.ramas[0].hijo;
  const conExp = exp.ramas[0].pago + merc.ramas[0].p * merc.ramas[0].hijo.valor + merc.ramas[1].p * merc.ramas[1].hijo.valor;
  const sinExp = exp.ramas[1].pago + exp.ramas[1].hijo.valor;
  const tot = (v) => inv.pago + bueno.p * v + regular.p * regular.hijo.valor;
  const noInv = arbol.raiz.ramas[1].pago + arbol.raiz.ramas[1].hijo.valor;
  return { noInv, conExp: tot(conExp), sinExp: tot(sinExp), vExp: conExp, vNo: sinExp, c: -inv.pago, e: -exp.ramas[0].pago };
}

test('generador: respuesta única, correcta y sin empates (2500 semillas por tipo)', () => {
  for (const tipo of TIPOS) {
    for (let s = 1; s <= N; s++) {
      const ej = generarEjercicio(tipo, s);
      const id = `${tipo}-${s}`;
      // corregir acepta la solución y rechaza otras
      if (ej.entrada.tipo === 'opcion') {
        assert.ok(corregir(ej, ej.solucion).correcta, id);
        ej.entrada.opciones.forEach((_, i) => assert.equal(corregir(ej, i).correcta, i === ej.solucion, id));
      } else {
        const tol = ej.entrada.tolerancia;
        assert.ok(corregir(ej, ej.solucion).correcta, id);
        assert.ok(corregir(ej, Math.round(ej.solucion * 100) / 100).correcta, `${id} redondeada`);
        assert.ok(!corregir(ej, ej.solucion + 3 * tol + 0.01).correcta, id);
        assert.ok(!corregir(ej, ej.solucion - 3 * tol - 0.01).correcta, id);
        assert.ok(!corregir(ej, NaN).correcta, id);
      }
      // la explicación y el detalle muestran la cifra correcta
      if (ej.entrada.tipo === 'numero') {
        assert.ok(ej.explicacion.includes(fmtNum(ej.solucion)), `${id}: explicación sin ${fmtNum(ej.solucion)}`);
        assert.ok(ej.solucionDetallada.includes(fmtNum(ej.solucion)), `${id}: detalle sin la cifra`);
      }
      assert.ok(!/ de el /.test(` ${ej.enunciado} ${ej.pregunta} ${ej.explicacion} `), `${id}: «de el» → «del»: ${ej.enunciado}`);

      if (tipo === 'secuencial' || tipo === 'estrategia') {
        const q = estrategiasSecuencial(ej.arbol);
        const v = [q.noInv, q.conExp, q.sinExp];
        const mx = Math.max(...v);
        assert.equal(v.filter((x) => casi(x, mx)).length, 1, `${id}: empate de estrategias ${v}`);
        assert.ok(Math.abs(q.vExp - q.vNo) >= 4 - 1e-9, `${id}`);
        // el enunciado dice los mismos costos que el árbol
        assert.ok(ej.enunciado.includes(`costo inicial ${q.c}`) || ej.enunciado.includes(`costo ${q.c} `), `${id}: costo de invertir`);
        assert.ok(ej.enunciado.includes(`(costo ${q.e})`) || ej.enunciado.includes(`(costo ${q.e}) `), `${id}: costo de expandir`);
        if (tipo === 'secuencial') assert.ok(casi(ej.solucion, mx), id);
        else assert.equal(ej.solucion, v.indexOf(mx), id);
      }
      if (tipo === 'alternativa') {
        const ram = ej.arbol.raiz.ramas;
        const vals = ram.map((r) => r.pago + (r.hijo.tipo === 'final' ? r.hijo.valor : r.hijo.ramas.reduce((a, x) => a + x.p * x.hijo.valor, 0)));
        const mx = ej.arbol.sense === 'max' ? Math.max(...vals) : Math.min(...vals);
        assert.equal(vals.filter((x) => casi(x, mx)).length, 1, `${id}: empate ${vals}`);
        assert.equal(ej.solucion, vals.indexOf(mx), id);
        assert.equal(ram.length, ej.entrada.opciones.length);
        ram.forEach((r, i) => assert.equal(r.etiqueta, ej.entrada.opciones[i]));
        vals.forEach((x, i) => assert.ok(ej.explicacion.includes(`${ej.entrada.opciones[i]}: ${fmtNum(x)}`), id));
      }
      if (tipo === 'indiferencia') {
        const { a, b, K } = ej.datos;
        const [e, f] = ej.arbol.raiz.ramas[0].hijo.ramas;
        assert.equal(e.hijo.valor, a);
        assert.equal(f.hijo.valor, b);
        assert.equal(ej.arbol.raiz.ramas[1].hijo.valor, K);
        assert.ok(ej.enunciado.includes(`${a} `) && ej.enunciado.includes(`${fmtNum(b)} `) && ej.enunciado.includes(fmtNum(K)), `${id}: ${ej.enunciado}`);
        const p = (K - b) / (a - b);
        assert.ok(p > 0 && p < 1, id);
        assert.ok(casi(p * a + (1 - p) * b, K));
        assert.ok(casi(Math.round(p * 100) / 100, p, 1e-9), `${id}: p* no es de dos decimales`);
      }
      if (tipo === 'veip') {
        const { p, pagos, alternativas, estados } = ej.tabla;
        assert.ok(casi(p.reduce((x, y) => x + y, 0), 1));
        assert.equal(pagos.length, alternativas.length);
        pagos.forEach((fila) => assert.equal(fila.length, estados.length));
        const ve = pagos.map((fila) => fila.reduce((a, x, j) => a + x * p[j], 0));
        const sin = Math.max(...ve);
        assert.equal(ve.filter((x) => casi(x, sin)).length, 1, `${id}: empate sin información`);
        let con = 0;
        for (let j = 0; j < p.length; j++) con += p[j] * Math.max(...pagos.map((f) => f[j]));
        assert.ok(con >= sin - 1e-9);
        assert.ok(casi(ej.solucion, con - sin), id);
        assert.ok(ej.solucion >= 2 - 1e-9, `${id}: VEIP casi nulo`);
      }
      if (tipo === 'riesgo') {
        const r = ej.arbol.raiz.ramas;
        assert.ok(casi(r.reduce((a, x) => a + x.p, 0), 1));
        assert.equal(new Set(r.map((x) => x.hijo.valor)).size, r.length);
        assert.ok(ej.solucion >= 0.1 - 1e-9 && ej.solucion <= 0.9 + 1e-9);
        const ve = r.reduce((a, x) => a + x.p * x.hijo.valor, 0);
        assert.ok(ej.enunciado.includes(`(${fmtNum(ve)})`), `${id}: VE del enunciado`);
      }
      if (tipo === 'completar' || tipo === 'valorEsperado') {
        const ps = ej.arbol.raiz.ramas.map((x) => x.p);
        const falt = ps.filter((x) => x == null).length;
        assert.equal(falt, tipo === 'completar' ? 1 : 0);
        const suma = ps.reduce((a, x) => a + (x ?? 0), 0);
        assert.ok(tipo === 'completar' ? suma < 1 - 0.05 + 1e-9 : casi(suma, 1), id);
      }
      // el árbol dibujado es serializable por el editor de texto (sin romper) cuando es un árbol completo
      if (ej.arbol && tipo !== 'completar' && tipo !== 'indiferencia') assert.ok(arbolATexto(ej.arbol).length > 0);
    }
  }
});
