import test from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS, generarEjercicio, corregir } from '../domain/generador.js';
import { cpmIndep, asignarIndep, usoEnPeriodo, verificar } from './utils.mjs';

const SEMILLAS = 1500;

/** Cronograma temprano {nombre: ES} por el cálculo independiente. */
const temprano = (m) => cpmIndep(m).ES;

function picoIndep(m, inicio) {
  let T = 0;
  m.acts.forEach((a) => { T = Math.max(T, inicio[a.name] + a.d); });
  let p = 0;
  for (let t = 1; t <= T; t++) p = Math.max(p, usoEnPeriodo(m, inicio, 0, t));
  return p;
}

test('cada tipo: respuesta igual al cálculo independiente (1500 semillas por tipo)', () => {
  for (const tipo of TIPOS) {
    for (let s = 1; s <= SEMILLAS; s++) {
      const ej = generarEjercicio(tipo, s);
      const m = ej.modelo;
      const o = cpmIndep(m);
      const ES = o.ES;
      const T = o.T;
      const lim = m.recursos[0].limite;
      if (tipo === 'uso') {
        assert.equal(ej.respuesta, usoEnPeriodo(m, ES, 0, ej.extra.t));
        assert.ok(ej.extra.t >= 1 && ej.extra.t <= T);
      } else if (tipo === 'pico') {
        assert.equal(ej.respuesta, picoIndep(m, ES));
      } else if (tipo === 'excede') {
        let n = 0;
        for (let t = 1; t <= T; t++) if (usoEnPeriodo(m, ES, 0, t) > lim) n += 1;
        assert.equal(ej.respuesta, n);
        assert.ok(n >= 1);
      } else if (tipo === 'holgura') {
        const nm = ej.pregunta.match(/actividad (\w)/)[1];
        assert.equal(ej.respuesta, o.H[nm]);
        assert.ok(o.H[nm] > 0);
      } else if (tipo === 'desplazar') {
        const nm = ej.pregunta.match(/actividad (\w) empieza en el tiempo (\d+)/);
        const inicio = { ...ES, [nm[1]]: Number(nm[2]) };
        const sinLim = { ...m, recursos: [{ ...m.recursos[0], limite: null }] };
        assert.deepEqual(verificar(sinLim, inicio), [], 'mover la actividad respeta las precedencias');
        assert.equal(Math.max(...m.acts.map((a) => inicio[a.name] + a.d)), T, 'la duración no cambia');
        assert.equal(ej.respuesta, picoIndep(m, inicio));
        assert.ok(ej.respuesta < picoIndep(m, ES));
      } else {
        const ind = asignarIndep(m, ej.regla);
        assert.ok(ind, 'factible');
        assert.deepEqual(verificar(m, ind), []);
        if (tipo === 'duracion') {
          const Tn = Math.max(...m.acts.map((a) => ind[a.name] + a.d));
          assert.equal(ej.respuesta, Tn);
          assert.ok(Tn > T);
        } else {
          // retraso: primer período donde alguna elegible no cabe; el retrasado es el único que se queda
          const hold = m.acts.filter((a) => ind[a.name] > ES[a.name]).map((a) => a.name);
          assert.ok(hold.includes(ej.respuesta), 'la actividad que se retrasa en el primer conflicto empieza después de su ES');
          // en el primer período con conflicto, ninguna otra elegible queda retrasada
          const t0 = ej.extra.periodo - 1;
          const eleg = m.acts.filter((a) => a.preds.every((p) => ind[p] + m.acts.find((x) => x.name === p).d <= t0) && ind[a.name] >= t0);
          const retr = eleg.filter((a) => ind[a.name] > t0).map((a) => a.name);
          assert.deepEqual(retr, [ej.respuesta]);
        }
      }
      // corregir
      if (ej.entrada.tipo === 'numero') {
        assert.equal(corregir(ej, ej.respuesta).correcta, true);
        assert.equal(corregir(ej, ej.respuesta + 1).correcta, false);
        assert.match(corregir(ej, ej.respuesta + 1).mensaje, new RegExp(String(ej.respuesta)));
      } else {
        assert.ok(ej.entrada.opciones.includes(ej.respuesta));
        assert.equal(corregir(ej, ej.respuesta).correcta, true);
        const otra = ej.entrada.opciones.find((x) => x !== ej.respuesta);
        assert.equal(corregir(ej, otra).correcta, false);
      }
      assert.ok(ej.explicacion && ej.solucionDetallada && ej.enunciado && ej.pregunta);
    }
  }
});

test('determinismo: misma semilla, mismo ejercicio; semillas distintas varían', () => {
  for (const tipo of TIPOS) {
    assert.deepEqual(generarEjercicio(tipo, 4821), generarEjercicio(tipo, 4821));
    const vistos = new Set();
    for (let s = 1; s <= 40; s++) vistos.add(JSON.stringify(generarEjercicio(tipo, s).modelo));
    assert.ok(vistos.size > 30, `${tipo}: poca variedad (${vistos.size})`);
  }
  assert.throws(() => generarEjercicio('nada', 1), /desconocido/);
});

test('pistas de error frecuentes', () => {
  const ej = generarEjercicio('duracion', 12);
  assert.match(corregir(ej, ej.extra.Tcpm).detalle, /ruta crítica/);
});
