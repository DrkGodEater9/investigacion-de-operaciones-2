import test from 'node:test';
import assert from 'node:assert/strict';
import { compilar, cpm } from '../domain/cpm.js';
import { perfil, sumaCuadrados, finProyecto, violaciones, cotaInferior } from '../domain/perfil.js';
import { nivelar } from '../domain/nivelar.js';
import { asignar, REGLAS, culpables } from '../domain/asignar.js';
import { mulberry32, modeloAleatorio, cpmIndep, verificar, asignarIndep, aMapa } from './utils.mjs';

const N = 3000;

test('nivelación: no alarga el proyecto, respeta precedencias, queda dentro de [ES, LS] y no empeora Σ uso² (3000 redes)', () => {
  const rng = mulberry32(31337);
  let mejoran = 0;
  for (let i = 0; i < N; i++) {
    const m = modeloAleatorio(rng);
    const red = compilar(m);
    const o = cpmIndep(m);
    const r = nivelar(red);
    const mapa = aMapa(red, r.starts);
    // verificador independiente sin límites
    const sinLimite = { ...m, recursos: m.recursos.map((x) => ({ ...x, limite: null })) };
    assert.deepEqual(verificar(sinLimite, mapa), []);
    assert.equal(finProyecto(red, r.starts), o.T, 'la duración no cambia');
    assert.equal(r.T, o.T);
    red.nombres.forEach((nm, j) => {
      assert.ok(r.starts[j] >= o.ES[nm] && r.starts[j] <= o.LS[nm], `${nm} fuera de su holgura`);
      if (o.H[nm] === 0) assert.equal(r.starts[j], o.ES[nm], 'las críticas no se mueven');
    });
    assert.ok(r.objetivoDespues <= r.objetivoAntes);
    assert.equal(r.objetivoDespues, sumaCuadrados(perfil(red, r.starts, o.T)));
    if (r.objetivoDespues < r.objetivoAntes) mejoran += 1;
    // idempotente: nivelar de nuevo desde el resultado no es posible por API, pero el resultado es determinista
    assert.deepEqual(nivelar(red).starts, r.starts);
  }
  assert.ok(mejoran > 100, 'la nivelación debería mejorar bastantes casos (' + mejoran + ')');
});

test('nivelación: múltiples recursos, un solo movimiento a la vez baja Σ uso²', () => {
  const rng = mulberry32(99);
  for (let i = 0; i < 500; i++) {
    const m = modeloAleatorio(rng);
    const red = compilar(m);
    const r = nivelar(red);
    let previo = r.objetivoAntes;
    for (const paso of r.log) {
      const obj = sumaCuadrados(perfil(red, paso.starts, r.T));
      assert.ok(obj <= previo);
      previo = obj;
    }
    assert.equal(previo, r.objetivoDespues);
  }
});

test('asignación: factible, igual al método independiente y con cota inferior (3000 redes x 5 reglas)', () => {
  const rng = mulberry32(424242);
  let aumentan = 0;
  let infactibles = 0;
  for (let i = 0; i < N; i++) {
    const m = modeloAleatorio(rng);
    const red = compilar(m);
    const o = cpmIndep(m);
    for (const regla of REGLAS) {
      const r = asignar(red, { regla: regla.id });
      const ind = asignarIndep(m, regla.id);
      if (ind === null) {
        assert.equal(r.ok, false);
        assert.equal(r.motivo, 'infactible');
        assert.ok(r.culpables.length > 0 && /no cabe/.test(r.mensaje));
        if (regla.id === 'holgura') infactibles += 1;
        continue;
      }
      assert.equal(r.ok, true);
      const mapa = aMapa(red, r.starts);
      assert.deepEqual(verificar(m, mapa), [], 'el cronograma debe ser factible');
      assert.deepEqual(violaciones(red, r.starts), []);
      assert.deepEqual(mapa, ind, 'coincide con el cálculo independiente');
      assert.ok(r.T >= o.T, 'no puede ser más corto que la ruta crítica');
      assert.ok(r.T >= cotaInferior(red, o.T), 'respeta la cota del trabajo total');
      assert.equal(r.T, Math.max(...m.acts.map((a) => mapa[a.name] + a.d)));
      assert.equal(r.Tsinlimite, o.T);
      // nadie empieza antes que su ES
      red.nombres.forEach((nm, j) => assert.ok(r.starts[j] >= o.ES[nm]));
      if (regla.id === 'holgura' && r.T > o.T) aumentan += 1;
    }
  }
  assert.ok(aumentan > 100 && infactibles > 50, `cobertura: ${aumentan} alargan, ${infactibles} infactibles`);
});

test('asignación: si el cronograma temprano ya cabe, nada se mueve ni se alarga', () => {
  const rng = mulberry32(8);
  let casos = 0;
  for (let i = 0; i < 4000; i++) {
    const m = modeloAleatorio(rng, { conLimite: 'factible' });
    const red = compilar(m);
    const c = cpm(red);
    if (violaciones(red, c.ES).length) continue;
    casos += 1;
    for (const regla of REGLAS) {
      const r = asignar(red, { regla: regla.id });
      assert.deepEqual(r.starts, c.ES);
      assert.equal(r.T, c.T);
      assert.equal(r.retrasos.length, 0);
    }
  }
  assert.ok(casos > 200, 'casos sin pico: ' + casos);
});

test('asignación: con límite muy grande equivale a CPM; con límite 1 y demanda 1 es una cola', () => {
  const acts = [
    { name: 'A', d: 2, preds: [], r: [1] },
    { name: 'B', d: 3, preds: [], r: [1] },
    { name: 'C', d: 1, preds: ['A'], r: [1] },
  ];
  const red = compilar({ recursos: [{ name: 'R', limite: 1 }], acts });
  const r = asignar(red, { regla: 'holgura' });
  assert.equal(r.T, 6); // trabajo total 6 con un solo recurso
  assert.deepEqual(violaciones(red, r.starts), []);
});

test('infactibilidad: una actividad sola excede el límite y el mensaje la nombra', () => {
  const red = compilar({ recursos: [{ name: 'Grúa', limite: 2 }], acts: [{ name: 'X', d: 1, preds: [], r: [3] }, { name: 'Y', d: 1, preds: [], r: [1] }] });
  const r = asignar(red, {});
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'infactible');
  assert.deepEqual(culpables(red).map((x) => x.nombre), ['X']);
  assert.match(r.mensaje, /La actividad X necesita 3 de Grúa y el límite es 2/);
  // sin límite no se puede asignar
  const sin = compilar({ recursos: [{ name: 'G', limite: null }], acts: [{ name: 'X', d: 1, preds: [], r: [3] }] });
  assert.equal(asignar(sin, {}).motivo, 'sinLimite');
});

test('el registro de pasos de la asignación es coherente con el resultado', () => {
  const rng = mulberry32(6);
  for (let i = 0; i < 800; i++) {
    const m = modeloAleatorio(rng, { conLimite: 'factible' });
    const red = compilar(m);
    const r = asignar(red, { regla: 'ls' });
    const programadas = r.log.flatMap((p) => p.decisiones.filter((d) => d.accion === 'programa').map((d) => d.act));
    assert.equal(new Set(programadas).size, red.n);
    for (const p of r.log) {
      p.decisiones.forEach((d) => {
        if (d.accion === 'programa') assert.equal(r.starts[d.act], p.t);
        else assert.ok(d.falla.uso + d.falla.req > d.falla.limite);
      });
      // el uso final del período nunca supera el límite
      p.usoFinal.forEach((u, k) => assert.ok(u <= red.limites[k]));
    }
  }
});

import { EJEMPLOS } from '../domain/ejemplos.js';
import { parseMarkdown, modeloAMarkdown } from '../domain/modelo.js';
import { resumen } from '../domain/perfil.js';
import { pasosAsignar, pasosNivelar } from '../domain/pasos.js';

test('ejemplos: valores calculados a mano (E1 nivelar, E2 limitar con la regla de menor holgura)', () => {
  const [e1, e2] = EJEMPLOS;
  const red1 = compilar(e1.modelo);
  const c1 = cpm(red1);
  assert.equal(c1.T, 7);
  assert.deepEqual(resumen(red1, c1.ES).porRecurso[0].uso, [11, 9, 5, 4, 2, 2, 1]);
  assert.deepEqual(c1.H, [0, 5, 0, 2, 2, 1, 5]);
  const n1 = nivelar(red1);
  assert.equal(n1.T, 7);
  assert.equal(resumen(red1, n1.starts, 7).porRecurso[0].pico, 6);

  const red2 = compilar(e2.modelo);
  const c2 = cpm(red2);
  assert.equal(c2.T, 8);
  assert.deepEqual(resumen(red2, c2.ES).porRecurso[0].uso, [12, 12, 12, 8, 7, 7, 7, 3]);
  const a = asignar(red2, { regla: 'holgura' });
  // A=0, B=0, C=3, D=5, E=6, F=4 (hecho a mano período por período)
  assert.deepEqual(a.starts, [0, 0, 3, 5, 6, 4]);
  assert.equal(a.T, 10);
  assert.equal(asignar(red2, { regla: 'lf' }).T, 9);
  assert.deepEqual(a.retrasos.map((x) => [red2.nombres[x.act], x.retraso]), [['C', 3], ['D', 3], ['E', 3]]);
  assert.equal(asignar(compilar(EJEMPLOS[3].modelo), {}).ok, false);
});

test('los ejemplos cargan desde su Markdown y los pasos se construyen sin errores', () => {
  for (const e of EJEMPLOS) {
    const r = parseMarkdown(modeloAMarkdown(e.modelo));
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.modelo, e.modelo);
    if (e.id === 'E4') continue;
    const red = compilar(e.modelo);
    const pn = pasosNivelar(red);
    assert.ok(pn.length >= 4);
    for (const regla of REGLAS) {
      const pa = pasosAsignar(red, regla.id);
      assert.ok(pa.ok && pa.pasos.length >= 4);
      pa.pasos.forEach((p) => { assert.ok(p.titulo && p.texto && p.starts.length === red.n); });
    }
  }
});
