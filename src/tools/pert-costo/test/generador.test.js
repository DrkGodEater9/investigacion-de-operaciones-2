import test from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS, generarEjercicio, corregir, respuestaCorrecta } from '../domain/generador.js';
import { curvaPorEnumeracion, duracionBruta } from './utils.mjs';

const SEMILLAS = [...Array.from({ length: 150 }, (_, i) => i + 1), ...Array.from({ length: 50 }, (_, i) => 4000 + i * 37)];
const cerca = (a, b, msg, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${msg}: ${a} ≠ ${b}`);

/** Respuesta correcta calculada con enumeración y bucles propios (sin usar resolver). */
function respuestaIndependiente(ej) {
  const f = ej.filas;
  if (ej.tipo === 'pendiente') return (Number(f[0].cl) - Number(f[0].cn)) / (Number(f[0].dn) - Number(f[0].dl));
  const dn = f.map((x) => Number(x.dn));
  const dl = f.map((x) => Number(x.dl === '' ? x.dn : x.dl));
  const cn = f.map((x) => Number(x.cn));
  const cl = f.map((x) => Number(x.cl === '' ? x.cn : x.cl));
  const filasNum = f.map((x, j) => ({ ...x, dl: String(dl[j]), cl: String(cl[j]) }));
  const T0 = duracionBruta(f, dn);
  if (ej.tipo === 'primera') {
    // Acortar j una unidad baja T solo si j es crítica; entre ellas, la de menor pendiente que se pueda acortar
    let mejor = -1;
    let ps = Infinity;
    f.forEach((_, j) => {
      if (dn[j] === dl[j]) return;
      const d = dn.slice();
      d[j] -= 1;
      if (duracionBruta(f, d) < T0) {
        const s = (cl[j] - cn[j]) / (dn[j] - dl[j]);
        if (s < ps) { ps = s; mejor = j; }
      }
    });
    return mejor;
  }
  if (ej.tipo === 'limite') return duracionBruta(f, dl);
  const { curva, Tmin, Tmax } = curvaPorEnumeracion(filasNum);
  if (ej.tipo === 'conjunto') return curva.get(Tmax - 1) - curva.get(Tmax);
  if (ej.tipo === 'costoDirecto') return curva.get(ej.objetivo);
  let mejorT = null;
  let mejorC = Infinity;
  for (let T = Tmin; T <= Tmax; T++) {
    const c = curva.get(T) + ej.ci * T;
    if (c < mejorC - 1e-9 || (Math.abs(c - mejorC) <= 1e-9 && T > mejorT)) { mejorC = c; mejorT = T; }
  }
  return ej.tipo === 'duracionOptima' ? mejorT : mejorC;
}

for (const tipo of TIPOS) {
  test(`práctica «${tipo}»: la respuesta coincide con el cálculo independiente (${SEMILLAS.length} semillas)`, () => {
    for (const seed of SEMILLAS) {
      const ej = generarEjercicio(tipo, seed);
      assert.equal(ej.tipo, tipo);
      assert.equal(ej.id, `${tipo}-${seed}`);
      assert.ok(ej.enunciado && ej.pregunta && ej.explicacion && ej.solucionDetallada);
      const esperada = respuestaIndependiente(ej);
      const dominio = respuestaCorrecta(ej);
      cerca(dominio, esperada, `${tipo} semilla ${seed}`);
      // corregir acepta la correcta y rechaza una errónea
      const bien = tipo === 'primera' ? esperada : dominio;
      assert.equal(corregir(ej, bien).correcta, true, `${tipo} ${seed} correcta`);
      const mala = tipo === 'primera' ? (esperada + 1) % ej.filas.length : dominio + 7;
      const r = corregir(ej, mala);
      assert.equal(r.correcta, false, `${tipo} ${seed} incorrecta`);
      assert.ok(r.mensaje.length > 5);
    }
  });
}

test('práctica: misma semilla, mismo ejercicio; JSON serializable; variedad entre semillas', () => {
  for (const tipo of TIPOS) {
    const a = generarEjercicio(tipo, 321);
    const b = generarEjercicio(tipo, 321);
    assert.deepEqual(a, b);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
    const distintos = new Set();
    for (let s = 1; s <= 100; s++) { const e = generarEjercicio(tipo, s); distintos.add(e.enunciado + JSON.stringify(e.filas) + (e.objetivo ?? '')); }
    assert.ok(distintos.size >= 95, `${tipo}: solo ${distintos.size} ejercicios distintos de 100`);
  }
});

test('práctica: el corrector da pistas de los errores típicos', () => {
  const pend = generarEjercicio('pendiente', 9);
  const f = pend.filas[0];
  const c = respuestaCorrecta(pend);
  assert.match(corregir(pend, Number(f.cl) - Number(f.cn)).detalle, /dividir/);
  assert.match(corregir(pend, 1 / c).mensaje, /Invertiste/);
  const lim = generarEjercicio('limite', 5);
  const T0 = duracionBruta(lim.filas, lim.filas.map((x) => Number(x.dn)));
  const rl = corregir(lim, T0);
  assert.equal(rl.correcta, false);
  assert.match(rl.mensaje, /normal/);
  const conj = generarEjercicio('conjunto', 12);
  assert.equal(corregir(conj, 'x').correcta, false);
  const pri = generarEjercicio('primera', 3);
  const buena = respuestaCorrecta(pri);
  const otra = pri.filas.findIndex((_, j) => j !== buena);
  assert.equal(corregir(pri, otra).correcta, false);
  // una actividad fuera de la ruta crítica
  const tm = pri.filas.map((_, j) => j).filter((j) => j !== buena);
  assert.ok(tm.some((j) => /ruta crítica|no se puede|menor pendiente/.test(corregir(pri, j).mensaje)));
});
