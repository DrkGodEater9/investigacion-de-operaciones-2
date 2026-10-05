import test from 'node:test';
import assert from 'node:assert/strict';
import { frac } from '../domain/fraction.js';
import {
  TIPOS, generar, respuestaCorrecta, corregir, armarRamificar, armarPoda, armarCorte, armarResolver,
} from '../domain/practicaMixta.js';

const SEMILLAS = Array.from({ length: 300 }, (_, i) => i * 17 + 1);

// ---------------------------------------------------------------- determinismo
test('determinismo: mismo tipo y semilla dan el mismo ejercicio', () => {
  for (const t of TIPOS) {
    const vistos = new Set();
    for (let s = 1; s <= 50; s++) {
      const a = generar(t, s);
      assert.deepEqual(a, generar(t, s));
      vistos.add(JSON.stringify(a));
    }
    assert.ok(vistos.size >= 30, `${t}: solo ${vistos.size} ejercicios distintos en 50 semillas`);
  }
});

// ---------------------------------------------------------------- 300 semillas
function alterar(ej, campo, resp) {
  const r = { ...resp };
  if (campo.tipo === 'opcion') {
    let otras;
    if (ej.tipo === 'ramificar') otras = campo.opciones.map((o) => o.id).filter((id) => !ej.solucion.validas.includes(id));
    else otras = campo.opciones.map((o) => o.id).filter((id) => id !== resp[campo.id]);
    r[campo.id] = otras[0];
  } else if (campo.tipo === 'numero') {
    r[campo.id] = frac(resp[campo.id]).add(1).toString();
  } else {
    r[campo.id] = frac(resp[campo.id]).add(frac(1).div(7)).toString();
  }
  return r;
}

for (const tipo of TIPOS) {
  test(`${tipo}: 300 semillas, respuesta correcta acierta y cada campo alterado falla solo él`, () => {
    for (const s of SEMILLAS) {
      const ej = generar(tipo, s);
      const ok = respuestaCorrecta(ej);
      const res = corregir(ej, ok);
      assert.equal(res.correcto, true, `${tipo} ${s}`);
      assert.ok(res.explicacion.length > 0);
      assert.equal(res.detalle.length, ej.campos.length);
      ej.campos.forEach((campo, i) => {
        const r = corregir(ej, alterar(ej, campo, ok));
        assert.equal(r.correcto, false, `${tipo} ${s} campo ${campo.id}`);
        r.detalle.forEach((d, j) => assert.equal(d.ok, j !== i, `${tipo} ${s} alterado ${campo.id}, detalle ${d.campo}`));
      });
    }
  });
}

test('campos vacíos o ilegibles son incorrectos con mensaje claro', () => {
  const ej = generar('resolver', 5);
  const r = corregir(ej, { zRelajacion: '', x2: 'abc', zMixto: '1/0' });
  assert.equal(r.correcto, false);
  r.detalle.forEach((d) => {
    assert.equal(d.ok, false);
    assert.match(d.mensaje, /No entendí este valor/);
  });
});

test('clasificar: tres situaciones distintas, al menos una entera y una continua', () => {
  for (const s of SEMILLAS) {
    const ej = generar('clasificar', s);
    assert.equal(new Set(ej.enunciado.situaciones).size, 3);
    const t = Object.values(ej.solucion);
    assert.ok(t.includes('entera') && t.includes('continua'));
  }
});

test('ramificar: siempre hay entera fraccionaria y continua fraccionaria', () => {
  for (const s of SEMILLAS) {
    const v = generar('ramificar', s).enunciado.variables;
    assert.ok(v.some((x) => x.entera && x.valor.includes('/')));
    assert.ok(v.some((x) => !x.entera && x.valor.includes('/')));
  }
});

// ---------------------------------------------------------------- ramificar fijo
test('ramificar: x=(7/2, 10/3, 9/4), enteras x1 y x3', () => {
  const ej = armarRamificar([
    { valor: '7/2', entera: true }, { valor: '10/3', entera: false }, { valor: '9/4', entera: true },
  ]);
  assert.deepEqual(ej.solucion.validas, ['x1', 'x3']);
  assert.equal(corregir(ej, { variable: 'x1', cotaInf: '3', cotaSup: '4' }).correcto, true);
  assert.equal(corregir(ej, { variable: 'x3', cotaInf: '2', cotaSup: '3' }).correcto, true);
  const cont = corregir(ej, { variable: 'x2', cotaInf: '3', cotaSup: '4' });
  assert.equal(cont.correcto, false);
  assert.match(cont.errorComun, /las continuas no se ramifican/);
  assert.equal(corregir(ej, { variable: 'ninguna', cotaInf: '3', cotaSup: '4' }).correcto, false);
  const misma = corregir(ej, { variable: 'x1', cotaInf: '3', cotaSup: '3' });
  assert.equal(misma.correcto, false);
  assert.match(misma.errorComun, /misma cota/);
  assert.equal(corregir(ej, { variable: 'x1', cotaInf: '3,5', cotaSup: '4' }).correcto, false);
});

test('ramificar (reserva): x=(3, 3/2), x2 entera → x2, cotas 1 y 2', () => {
  const ej = armarRamificar([{ valor: 3, entera: false }, { valor: '3/2', entera: true }]);
  assert.deepEqual(ej.solucion.validas, ['x2']);
  assert.equal(corregir(ej, { variable: 'x2', cotaInf: '1', cotaSup: '2' }).correcto, true);
});

// ---------------------------------------------------------------- poda fija
const pod = (sentido, inc, nodo) => armarPoda({ sentido, incumbente: inc, nodo }).solucion.accion;
test('poda: casos fijos', () => {
  assert.equal(pod('max', 59, { factible: true, z: 58, enterasEnteras: false }), 'cota');
  assert.equal(pod('max', 59, { factible: true, z: 59, enterasEnteras: true }), 'cota');
  assert.equal(pod('max', 59, { factible: true, z: 61, enterasEnteras: true }), 'incumbente');
  assert.equal(pod('max', 59, { factible: true, z: 61, enterasEnteras: false }), 'ramificar');
  assert.equal(pod('min', 153, { factible: true, z: '645/4', enterasEnteras: false }), 'cota');
  assert.equal(pod('min', 153, { factible: true, z: 152, enterasEnteras: true }), 'incumbente');
  assert.equal(pod('max', null, { factible: false }), 'infactibilidad');
  assert.equal(pod('max', null, { factible: true, z: 40, enterasEnteras: true }), 'incumbente');
  assert.equal(pod('max', null, { factible: true, z: 40, enterasEnteras: false }), 'ramificar');
  // reserva
  assert.equal(pod('max', '62/3', { factible: true, z: 18, enterasEnteras: true }), 'cota');
});

test('poda: corregir con la igualdad', () => {
  const ej = armarPoda({ sentido: 'max', incumbente: 59, nodo: { factible: true, z: 59, enterasEnteras: true } });
  const r = corregir(ej, { accion: 'incumbente' });
  assert.equal(r.correcto, false);
  assert.match(r.errorComun, /igualdad/);
  assert.match(ej.explicacion.join(' '), /igualdad/);
});

test('poda: las cuatro acciones salen con frecuencia parecida', () => {
  const cuenta = {};
  for (const s of SEMILLAS) {
    const a = generar('poda', s).solucion.accion;
    cuenta[a] = (cuenta[a] || 0) + 1;
  }
  assert.equal(Object.keys(cuenta).length, 4);
  Object.values(cuenta).forEach((n) => assert.ok(n > 45, JSON.stringify(cuenta)));
});

// ---------------------------------------------------------------- corte fijo
const S = (xs) => xs.map(String);
const FILA = [
  { nombre: 's1', a: '3/2', entera: false },
  { nombre: 's2', a: '-1/4', entera: false },
  { nombre: 'y1', a: '7/4', entera: true },
  { nombre: 'y2', a: '-1/2', entera: true },
  { nombre: 'y3', a: '9/4', entera: true },
  { nombre: 'y4', a: '-13/5', entera: true },
];
const coefsDe = (ej) => Object.values(ej.solucion.coefs);
test('corte: mixto y fraccional', () => {
  const mix = armarCorte({ b: '17/5', noBasicas: FILA, tipo: 'mixto' });
  assert.deepEqual(coefsDe(mix), S(['3/2', '1/6', '1/6', '1/3', '1/4', '2/5']));
  assert.equal(mix.solucion.rhs, '2/5');
  assert.equal(mix.solucion.f0, '2/5');
  const fra = armarCorte({ b: '17/5', noBasicas: FILA.map((v) => ({ ...v, entera: true })), tipo: 'fraccional' });
  assert.deepEqual(coefsDe(fra), S(['1/2', '3/4', '3/4', '1/2', '1/4', '2/5']));
  assert.equal(fra.solucion.rhs, '2/5');
});

test('corte: parte fraccionaria usada en una continua y fila simple', () => {
  const mix = armarCorte({ b: '17/5', noBasicas: FILA, tipo: 'mixto' });
  const ok = respuestaCorrecta(mix);
  const mal = corregir(mix, { ...ok, c_s1: '1/2' });
  assert.equal(mal.correcto, false);
  assert.match(mal.errorComun, /parte fraccionaria/);
  assert.equal(mal.detalle.find((d) => d.campo === 'c_s1').ok, false);
  const simple = armarCorte({ b: '1/2', noBasicas: [{ nombre: 's', a: '5/4', entera: false }], tipo: 'mixto' });
  assert.equal(simple.solucion.coefs.c_s, '5/4');
  assert.equal(simple.solucion.rhs, '1/2');
});

test('corte: f > f0 en entera sin la fórmula', () => {
  const ej = armarCorte({ b: '17/5', noBasicas: FILA, tipo: 'mixto' });
  const r = corregir(ej, { ...respuestaCorrecta(ej), c_y1: '3/4' });
  assert.equal(r.correcto, false);
  assert.match(r.errorComun, /f₀\(1 − f\)/);
});

// ---------------------------------------------------------------- resolver fijo
test('resolver: caso fijo max 7x1+9x2', () => {
  const ej = armarResolver({ c: [7, 9], restricciones: [{ a: [-1, 3], b: 6 }, { a: [7, 1], b: 35 }] });
  assert.deepEqual(ej.solucion, { zRelajacion: '63', x2: '3', zMixto: '59' });
  assert.equal(corregir(ej, { zRelajacion: '63', x2: '3', zMixto: '59' }).correcto, true);
  const r = corregir(ej, { zRelajacion: '63', x2: '3', zMixto: '63' });
  assert.equal(r.correcto, false);
  assert.match(r.errorComun, /relajación/);
});

test('resolver (reserva): max 5x1+4x2', () => {
  const ej = armarResolver({ c: [5, 4], restricciones: [{ a: [6, 4], b: 24 }, { a: [1, 2], b: 6 }] });
  assert.deepEqual(ej.solucion, { zRelajacion: '21', x2: '1', zMixto: '62/3' });
  assert.equal(corregir(ej, { zRelajacion: '21', x2: '1', zMixto: '20,67' }).correcto, true);
});

// Fuerza bruta independiente (sin solveIP ni solveLP).
function fuerzaBrutaMixta(m) {
  const R = m.restricciones.map((r) => ({ a: r.a.map((v) => frac(v)), b: frac(r.b) }));
  const c = m.c.map((v) => frac(v));
  const cumple = (x1, x2) =>
    x1.gte(0) && x2.gte(0) && R.every((r) => r.a[0].mul(x1).add(r.a[1].mul(x2)).lte(r.b));
  // Entero en x2
  let mejor = null;
  for (let x2 = 0; x2 <= 60; x2++) {
    let lo = frac(0);
    let hi = null;
    let posible = true;
    for (const r of R) {
      const resto = r.b.sub(r.a[1].mul(x2));
      if (r.a[0].isZero()) { if (resto.lt(0)) posible = false; continue; }
      const lim = resto.div(r.a[0]);
      if (r.a[0].gt(0)) { if (hi === null || lim.lt(hi)) hi = lim; } else if (lim.gt(lo)) lo = lim;
    }
    if (!posible || hi === null || hi.lt(lo)) continue;
    const z = c[0].mul(hi).add(c[1].mul(x2));
    if (!mejor || z.gt(mejor.z)) mejor = { z, x2 };
  }
  // Relajación: máximo sobre vértices
  const rectas = [...R.map((r) => ({ p: r.a[0], q: r.a[1], b: r.b })), { p: frac(1), q: frac(0), b: frac(0) }, { p: frac(0), q: frac(1), b: frac(0) }];
  let relax = null;
  for (let i = 0; i < rectas.length; i++) {
    for (let j = i + 1; j < rectas.length; j++) {
      const A = rectas[i], B = rectas[j];
      const det = A.p.mul(B.q).sub(A.q.mul(B.p));
      if (det.isZero()) continue;
      const x1 = A.b.mul(B.q).sub(A.q.mul(B.b)).div(det);
      const x2 = A.p.mul(B.b).sub(A.b.mul(B.p)).div(det);
      if (!cumple(x1, x2)) continue;
      const z = c[0].mul(x1).add(c[1].mul(x2));
      if (!relax || z.gt(relax.z)) relax = { z, x2 };
    }
  }
  return { relax, mejor };
}

test('resolver: 300 semillas coinciden con fuerza bruta independiente', () => {
  for (const s of SEMILLAS) {
    const ej = generar('resolver', s);
    const m = {
      c: ej.enunciado.c,
      restricciones: ej.enunciado.restricciones,
    };
    assert.ok(m.restricciones.length >= 2 && m.restricciones.length <= 3);
    const fb = fuerzaBrutaMixta(m);
    assert.equal(ej.solucion.zRelajacion, fb.relax.z.toString(), `relajación ${s}`);
    assert.equal(ej.solucion.zMixto, fb.mejor.z.toString(), `Z mixto ${s}`);
    assert.equal(ej.solucion.x2, String(fb.mejor.x2), `x2 ${s}`);
    assert.notEqual(ej.solucion.zRelajacion, ej.solucion.zMixto);
  }
});

// ---------------------------------------------------------------- tolerancias
test('tolerancias en campos numero y fraccion', () => {
  const num = armarResolver({ c: [7, 9], restricciones: [{ a: [-1, 3], b: 6 }, { a: [7, 1], b: 35 }] });
  const ej = { ...num, solucion: { ...num.solucion, zRelajacion: '7/2' } };
  const prueba = (t) => corregir(ej, { zRelajacion: t, x2: '3', zMixto: '59' }).detalle[0].ok;
  assert.equal(prueba('3,5'), true);
  assert.equal(prueba('3.5'), true);
  assert.equal(prueba('7/2'), true);
  assert.equal(prueba('3,505'), true);
  assert.equal(prueba('3,52'), false);

  const cor = armarCorte({ b: '1/2', noBasicas: [{ nombre: 's', a: '5/4', entera: false }], tipo: 'mixto' });
  const ok = respuestaCorrecta(cor);
  assert.equal(corregir(cor, { ...ok, f0: '0.5' }).correcto, true);
  assert.equal(corregir(cor, { ...ok, f0: '1/2' }).correcto, true);
  assert.equal(corregir(cor, { ...ok, f0: '0,4999' }).correcto, false);
});
