import test from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS, generarEjercicio, corregir, solucionDe } from '../domain/generador.js';
import { validarProblema } from '../domain/bayes.js';
import { referencia, aNum, cerca } from './utils.mjs';

const SEMILLAS = Array.from({ length: 300 }, (_, i) => i + 1);

/** Problema → forma exacta (las probabilidades del generador son múltiplos de 0,05). */
function exacto(p) {
  const D = 20;
  const ent = (x) => {
    const v = Math.round(x * D);
    assert.ok(Math.abs(v / D - x) < 1e-12, `probabilidad no múltiplo de 0,05: ${x}`);
    return v;
  };
  return {
    D,
    prioriN: p.priori.map(ent),
    likN: p.verosimilitud ? p.verosimilitud.map((f) => f.map(ent)) : p.estados.map(() => [D]),
    pagos: p.pagos,
  };
}

const mejorIdx = (obj, v) => {
  const mejor = obj === 'max' ? Math.max(...v) : Math.min(...v);
  return v.map((x, i) => (Math.abs(x - mejor) < 1e-9 ? i : -1)).filter((i) => i >= 0);
};

/** Respuesta esperada calculada por otro camino (fracciones y bucles simples). */
function esperado(ej) {
  const p = ej.problema;
  const ex = exacto(p);
  const r = referencia(p, ex);
  const d = ej.datos;
  switch (ej.tipo) {
    case 'valorEsperado': return { valor: aNum(r.ve[d.i]) };
    case 'decision': return { indice: r.optimas[0], unica: r.optimas.length === 1 };
    case 'veip': return { valor: aNum(r.veip) };
    case 'posterior': return { valor: aNum(r.post[d.j][d.k]) };
    case 'marginal': return { valor: aNum(r.marg[d.k]) };
    case 'decisionIndicador': {
      const ve = p.pagos.map((f) => f.reduce((s, v, j) => s + v * aNum(r.post[j][d.k]), 0));
      const idx = mejorIdx(p.objetivo, ve);
      return { indice: idx[0], unica: idx.length === 1 };
    }
    case 'veim': return { valor: aNum(r.veim) };
    case 'eficiencia': return { valor: aNum(r.eficiencia) * 100 };
    case 'criterio': {
      const m = p.pagos.length;
      const n = p.estados.length;
      const max = p.objetivo === 'max';
      let valores;
      if (d.criterio === 'pesimista') valores = p.pagos.map((f) => (max ? Math.min(...f) : Math.max(...f)));
      else if (d.criterio === 'optimista') valores = p.pagos.map((f) => (max ? Math.max(...f) : Math.min(...f)));
      else if (d.criterio === 'laplace') valores = p.pagos.map((f) => f.reduce((s, v) => s + v, 0) / n);
      else {
        const mejorEst = Array.from({ length: n }, (_, j) => {
          const col = p.pagos.map((f) => f[j]);
          return max ? Math.max(...col) : Math.min(...col);
        });
        valores = p.pagos.map((f) => Math.max(...f.map((v, j) => (max ? mejorEst[j] - v : v - mejorEst[j]))));
      }
      const idx = d.criterio === 'savage' ? mejorIdx('min', valores) : mejorIdx(p.objetivo, valores);
      assert.equal(valores.length, m);
      return { indice: idx[0], unica: idx.length === 1 };
    }
    default: throw new Error(ej.tipo);
  }
}

test('hay al menos 5 tipos de ejercicio', () => {
  assert.ok(TIPOS.length >= 5);
  assert.equal(new Set(TIPOS).size, TIPOS.length);
});

test('300 semillas × todos los tipos: determinista, JSON puro, problema válido, respuesta única y igual al cálculo independiente', () => {
  for (const tipo of TIPOS) {
    for (const s of SEMILLAS) {
      const ej = generarEjercicio(tipo, s);
      assert.deepEqual(generarEjercicio(tipo, s), ej, 'determinista');
      assert.deepEqual(JSON.parse(JSON.stringify(ej)), ej, 'JSON puro');
      assert.equal(ej.id, `${tipo}-${s}`);
      const v = validarProblema(ej.problema);
      assert.deepEqual(v.errores, [], `${ej.id}: ${v.errores}`);
      assert.deepEqual(v.avisos, [], 'las probabilidades suman exactamente 1');
      for (const k of ['titulo', 'enunciado', 'pregunta', 'explicacion', 'solucionDetallada']) assert.ok(ej[k] && ej[k].length > 5, `${ej.id} ${k}`);
      assert.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(ej)), ej.id);
      const e = esperado(ej);
      const sol = solucionDe(ej);
      if (ej.entrada.tipo === 'opcion') {
        assert.ok(e.unica, `${ej.id}: respuesta no única`);
        assert.equal(sol.indice, e.indice, ej.id);
        assert.equal(ej.solucion, e.indice);
        assert.equal(ej.entrada.opciones.length, ej.problema.alternativas.length);
        assert.equal(corregir(ej, e.indice).correcta, true);
        ej.entrada.opciones.forEach((_, i) => { if (i !== e.indice) assert.equal(corregir(ej, i).correcta, false, `${ej.id} opción ${i}`); });
      } else {
        assert.ok(cerca(sol.valor, e.valor, 1e-9), `${ej.id}: ${sol.valor} vs ${e.valor}`);
        assert.ok(cerca(ej.solucion, e.valor, 1e-9));
        assert.equal(corregir(ej, e.valor).correcta, true, ej.id);
        const tol = tipo === 'posterior' || tipo === 'marginal' ? 0.0051 : tipo === 'eficiencia' ? 1 : Math.max(0.2, 0.005 * Math.abs(e.valor));
        assert.equal(corregir(ej, e.valor + 3 * tol).correcta, false, `${ej.id} +3tol`);
        assert.equal(corregir(ej, e.valor - 3 * tol).correcta, false, `${ej.id} -3tol`);
      }
    }
  }
});

test('variedad: problemas distintos, ambos objetivos, 2 y 3 alternativas, estados e indicadores', () => {
  for (const tipo of TIPOS) {
    const vistos = new Set();
    const objetivos = new Set();
    const dims = new Set();
    const contextos = new Set();
    for (const s of SEMILLAS.slice(0, 200)) {
      const ej = generarEjercicio(tipo, s);
      vistos.add(JSON.stringify([ej.problema, ej.datos]));
      objetivos.add(ej.problema.objetivo);
      dims.add(`${ej.problema.alternativas.length}x${ej.problema.estados.length}x${ej.problema.indicadores ? ej.problema.indicadores.length : 0}`);
      contextos.add(ej.contexto);
    }
    assert.ok(vistos.size >= 195, `${tipo}: solo ${vistos.size} distintos de 200`);
    assert.deepEqual([...objetivos].sort(), ['max', 'min'], tipo);
    assert.ok(dims.size >= 4, `${tipo}: dimensiones ${[...dims]}`);
    assert.ok(contextos.size === 5, `${tipo}: contextos ${contextos.size}`);
  }
});

test('el ejercicio con información trae indicadores y los demás tipos no', () => {
  const con = new Set(['posterior', 'marginal', 'decisionIndicador', 'veim', 'eficiencia']);
  for (const tipo of TIPOS) {
    const ej = generarEjercicio(tipo, 11);
    assert.equal(Boolean(ej.problema.indicadores), con.has(tipo), tipo);
  }
});

test('corregir: tolerancias y formas de respuesta aceptadas', () => {
  const ej = generarEjercicio('posterior', 5);
  const sol = ej.solucion;
  assert.equal(corregir(ej, Math.round(sol * 1e4) / 1e4).correcta, true);
  assert.equal(corregir(ej, Math.round(sol * 1e3) / 1e3).correcta, true);
  assert.equal(corregir(ej, sol + 0.02).correcta, false);
  const ef = generarEjercicio('eficiencia', 5);
  const r = ef.solucion;
  assert.equal(corregir(ef, Math.round(r * 10) / 10).correcta, true);
  const fr = corregir(ef, r / 100);
  assert.equal(fr.correcta, true);
  assert.match(fr.detalle, /fracción/);
  assert.equal(corregir(ef, r + 5).correcta, false);
});

test('corregir: respuestas inválidas no rompen y no se aceptan', () => {
  const num = generarEjercicio('veip', 2);
  [undefined, null, NaN, 'abc', Infinity].forEach((x) => assert.equal(corregir(num, x).correcta, false));
  const op = generarEjercicio('decision', 2);
  [undefined, null, -1, 99, 1.5, 'a'].forEach((x) => assert.equal(corregir(op, x).correcta, false));
});

test('corregir: la explicación del error trae números concretos', () => {
  // Posterior: dar la conjunta o la verosimilitud
  const buscar = (tipo, pred) => {
    for (let s = 1; s < 500; s++) { const ej = generarEjercicio(tipo, s); if (pred(ej)) return ej; }
    throw new Error('sin caso ' + tipo);
  };
  const post = buscar('posterior', (e) => Math.abs(e.problema.priori[e.datos.j] * e.problema.verosimilitud[e.datos.j][e.datos.k] - e.solucion) > 0.05
    && Math.abs(e.problema.verosimilitud[e.datos.j][e.datos.k] - e.solucion) > 0.05
    && Math.abs(e.problema.priori[e.datos.j] - e.solucion) > 0.05);
  const conj = post.problema.priori[post.datos.j] * post.problema.verosimilitud[post.datos.j][post.datos.k];
  let r = corregir(post, conj);
  assert.equal(r.correcta, false);
  assert.match(r.detalle, /probabilidad conjunta/);
  assert.match(r.detalle, new RegExp(String(conj).replace('.', ',').slice(0, 4)));
  assert.match(r.mensaje, /La respuesta es 0,\d+/);
  r = corregir(post, post.problema.verosimilitud[post.datos.j][post.datos.k]);
  assert.match(r.detalle, /verosimilitud/);
  r = corregir(post, post.problema.priori[post.datos.j]);
  assert.match(r.detalle, /a priori/);

  // VEIP: dar el VEcIP, o el VE sin información
  const veip = generarEjercicio('veip', 8);
  const sol = solucionDe(veip).valor;
  const ex = referencia(veip.problema, exacto(veip.problema));
  r = corregir(veip, aNum(ex.vecip));
  assert.match(r.detalle, /VEcIP/);
  assert.match(r.detalle, new RegExp(String(Math.round(aNum(ex.vecip) * 1e4) / 1e4).replace('.', ',').replace('-', '−')));
  r = corregir(veip, aNum(ex.vesi));
  assert.match(r.detalle, /valor esperado sin información/);
  assert.ok(sol > 0);
  r = corregir(veip, -sol);
  assert.match(r.detalle, /signo/);

  // VEIM: dar el VEcIM; eficiencia: dar el VEIM o dividir al revés
  const veim = generarEjercicio('veim', 8);
  const rv = referencia(veim.problema, exacto(veim.problema));
  assert.match(corregir(veim, aNum(rv.vecim)).detalle, /VEcIM/);
  const efi = generarEjercicio('eficiencia', 8);
  const re = referencia(efi.problema, exacto(efi.problema));
  assert.match(corregir(efi, aNum(re.veim)).detalle, /VEIM/);
  assert.match(corregir(efi, (aNum(re.veip) / aNum(re.veim)) * 100).detalle, /al revés/);

  // Opciones: números en el detalle
  const dec = generarEjercicio('decision', 8);
  const mal = dec.entrada.opciones.findIndex((_, i) => i !== dec.solucion);
  r = corregir(dec, mal);
  assert.equal(r.correcta, false);
  assert.match(r.detalle, /VE\(/);
  assert.match(r.mensaje, new RegExp(dec.problema.alternativas[dec.solucion]));
});

test('decisionIndicador: elegir la decisión a priori en vez de la posterior se explica', () => {
  let visto = 0;
  for (let s = 1; s < 400; s++) {
    const ej = generarEjercicio('decisionIndicador', s);
    const r0 = referencia(ej.problema, exacto(ej.problema));
    const prior = r0.optimas[0];
    if (prior !== ej.solucion) {
      visto += 1;
      const r = corregir(ej, prior);
      assert.equal(r.correcta, false);
      assert.match(r.detalle, /a priori/);
    }
  }
  assert.ok(visto > 20, 'casos donde la información cambia la decisión: ' + visto);
});

test('tipo desconocido lanza error y semilla inválida usa 1', () => {
  assert.throws(() => generarEjercicio('nada', 1), /desconocido/);
  assert.equal(generarEjercicio('veip', -5).seed, 1);
  assert.equal(generarEjercicio('veip', 2.5).seed, 1);
  assert.deepEqual(generarEjercicio('veip', 1), generarEjercicio('veip', -5));
});
