// Pruebas del tema 3.1 (Paso a paso y Práctica): node --test src/tools/ruta-critica/test/estructura.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNetwork } from '../domain/network.js';
import { computeLayout } from '../domain/layout.js';
import { EXAMPLES } from '../domain/examples.js';
import { splitPreds } from '../domain/parser.js';
import {
  verificarRed, contarFicticias, sinFicticiasNecesarias, cierrePredecesoras, alcanceEventos, extremosTabla,
} from '../domain/dependenciasRed.js';
import { pasosConstruccion, ordenConstruccion, explicarFicticias } from '../domain/pasosEstructura.js';
import { EJEMPLOS_ESTRUCTURA } from '../domain/ejemplosEstructura.js';
import {
  TIPOS, generarEjercicio, corregir, tablaAleatoria, numeracionValida,
} from '../domain/practicaEstructura.js';

// ---------- Utilidades de prueba ----------
function rngSimple(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = (arr) => arr[int(0, arr.length - 1)];
  const shuffle = (arr) => { const r = arr.slice(); for (let i = r.length - 1; i > 0; i--) { const j = int(0, i); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  return { next, int, pick, shuffle };
}
const T = (spec) => spec.map(([name, preds]) => ({ name, preds: preds ? preds.split(',') : [] }));

/** Tabla aleatoria libre (con redundancias posibles), para estresar el constructor. */
function tablaLibre(rng, n) {
  const acts = [];
  for (let i = 0; i < n; i++) {
    const k = i === 0 ? 0 : rng.int(0, Math.min(3, i));
    const preds = rng.shuffle(acts.map((a) => a.name)).slice(0, k).sort();
    acts.push({ name: String.fromCharCode(65 + i), preds });
  }
  return acts;
}

/** Mínimo exacto de ficticias por búsqueda exhaustiva (modelo de etiquetas; solo para n pequeño). */
function minimoExacto(acts) {
  const n = acts.length;
  const idx = new Map(acts.map((a, i) => [a.name, i]));
  const cierre = cierrePredecesoras(acts);
  const F = acts.map((a) => [...cierre.get(a.name)].reduce((m, x) => m | (1 << idx.get(x)), 0));
  const c = acts.map((_, i) => F[i] | (1 << i));
  const full = (1 << n) - 1;
  // etiquetas posibles: uniones de contribuciones
  const E = new Set([...c, full]);
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const x of [...E]) for (const y of [...E]) if (!E.has(x | y)) { E.add(x | y); cambio = true; }
  }
  const cand = acts.map((_, i) => [...E].filter((L) => (L & c[i]) === c[i]));
  const pop = (x) => { let k = 0; while (x) { k += x & 1; x >>= 1; } return k; };
  let mejor = Infinity;
  const label = new Array(n);
  const evaluar = () => {
    const nodos = new Set([0, full, ...F, ...label]);
    let costo = 0;
    for (const L of nodos) {
      let directo = 0;
      for (let a = 0; a < n; a++) if (label[a] === L) directo |= c[a];
      const falta = L & ~directo;
      if (!falta) continue;
      const fuentes = [...nodos].filter((u) => u !== L && (u & L) === u && u !== 0);
      let minimo = Infinity;
      const m = fuentes.length;
      for (let s = 1; s < 1 << m; s++) {
        const k = pop(s);
        if (k >= minimo) continue;
        let u = 0;
        for (let j = 0; j < m; j++) if (s & (1 << j)) u |= fuentes[j];
        if ((u & falta) === falta) minimo = k;
      }
      if (minimo === Infinity) return;
      costo += minimo;
      if (costo >= mejor) return;
    }
    const grupos = new Map();
    for (let a = 0; a < n; a++) { const k = F[a] + ':' + label[a]; grupos.set(k, (grupos.get(k) || 0) + 1); }
    for (const v of grupos.values()) costo += v - 1;
    if (costo < mejor) mejor = costo;
  };
  const rec = (i) => {
    if (i === n) { evaluar(); return; }
    for (const L of cand[i]) { label[i] = L; rec(i + 1); }
  };
  rec(0);
  return mejor;
}

// ---------- Casos conocidos ----------
test('ejemplo de la teoría: A,B,C(A,B),D(B) necesita una ficticia', () => {
  const acts = T([['A', ''], ['B', ''], ['C', 'A,B'], ['D', 'B']]);
  const net = buildNetwork(acts);
  assert.equal(contarFicticias(net), 1);
  assert.equal(net.nodes.length, 4);
  assert.ok(verificarRed(acts, net).ok);
  assert.equal(minimoExacto(acts), 1);
});

test('casos clásicos: cadena, paralelas, rombo', () => {
  const cadena = T([['A', ''], ['B', 'A'], ['C', 'B']]);
  assert.equal(contarFicticias(buildNetwork(cadena)), 0);
  const paralelas = T([['A', ''], ['B', ''], ['C', 'A,B'], ['D', 'A,B'], ['E', 'C,D']]);
  const n2 = buildNetwork(paralelas);
  // A y B (mismos extremos) y C y D (mismos extremos) son dos parejas de paralelas: una ficticia por pareja
  assert.equal(contarFicticias(n2), 2);
  assert.ok(verificarRed(paralelas, n2).ok);
  assert.equal(minimoExacto(paralelas), 2);
  // Varios grupos de paralelas que desembocan en el mismo evento comparten el auxiliar: una sola ficticia
  const compartida = T([['A', ''], ['B', ''], ['C', ''], ['D', 'C'], ['E', 'C']]);
  assert.equal(contarFicticias(buildNetwork(compartida)), 1);
  assert.equal(minimoExacto(compartida), 1);
  assert.ok(verificarRed(compartida, buildNetwork(compartida)).ok);
  // Predecesoras equivalentes (A,D equivale a A,B,D porque D depende de B) caen en el mismo evento
  const equivalentes = T([['A', ''], ['B', ''], ['C', 'A,B'], ['D', 'B'], ['E', 'A,D']]);
  assert.equal(contarFicticias(buildNetwork(equivalentes)), 2);
  assert.equal(minimoExacto(equivalentes), 2);
  const rombo = T([['A', ''], ['B', 'A'], ['C', 'A'], ['D', 'B,C']]);
  // B y C salen del mismo evento y llegan al mismo evento: una ficticia las separa
  assert.equal(contarFicticias(buildNetwork(rombo)), 1);
  assert.equal(minimoExacto(rombo), 1);
  assert.equal(sinFicticiasNecesarias(rombo), false);
});

test('ejemplos del curso: la red respeta la tabla', () => {
  for (const ex of EXAMPLES) {
    const acts = ex.activities.map((r) => ({ name: r.name, preds: splitPreds(r.preds) }));
    const net = buildNetwork(acts);
    const v = verificarRed(acts, net);
    assert.ok(v.ok, ex.id + ' ' + JSON.stringify(v));
  }
});

test('verificarRed detecta una ficticia faltante y una dependencia de más', () => {
  const acts = T([['A', ''], ['B', ''], ['C', 'A,B'], ['D', 'B']]);
  const net = buildNetwork(acts);
  const sin = { ...net, edges: net.edges.filter((e) => e.kind !== 'dummy') };
  const v = verificarRed(acts, sin);
  assert.ok(!v.ok);
  // Sin la ficticia, C solo espera a una de las dos o la red tiene 2 finales: algo se rompe
  assert.ok(v.dependencias.length || v.estructura.length);
});

// ---------- Constructor: validez, necesidad de cada ficticia y criterio sin ficticias ----------
test('tablas aleatorias: red válida, ficticias necesarias y criterio independiente de cero ficticias', () => {
  const rng = rngSimple(2024);
  let conFict = 0;
  for (let it = 0; it < 4000; it++) {
    const acts = tablaLibre(rng, rng.int(2, 10));
    const net = buildNetwork(acts);
    const v = verificarRed(acts, net);
    assert.ok(v.ok, JSON.stringify(acts) + JSON.stringify(v));
    const d = contarFicticias(net);
    assert.equal(d === 0, sinFicticiasNecesarias(acts), 'cero ficticias: ' + JSON.stringify(acts));
    if (d) conFict++;
    for (const e of net.edges.filter((x) => x.kind === 'dummy')) {
      const sin = { ...net, edges: net.edges.filter((x) => x.id !== e.id) };
      assert.ok(!verificarRed(acts, sin).ok, 'ficticia innecesaria en ' + JSON.stringify(acts));
    }
    assert.equal(net.edges.filter((e) => e.kind === 'activity').length, acts.length);
  }
  assert.ok(conFict > 500);
});

test('mínimo exacto: el constructor usa el mínimo de ficticias (búsqueda exhaustiva, n <= 5)', () => {
  const rng = rngSimple(77);
  let casos = 0;
  for (let it = 0; it < 500; it++) {
    const acts = tablaLibre(rng, rng.int(2, 5));
    const esperado = minimoExacto(acts);
    const obtenido = contarFicticias(buildNetwork(acts));
    assert.equal(obtenido, esperado, JSON.stringify(acts));
    casos++;
  }
  assert.equal(casos, 500);
});

test('mínimo exacto con tablas de práctica de 6 actividades (muestra pequeña: la búsqueda es lenta)', () => {
  const rng = rngSimple(5);
  for (let it = 0; it < 4; it++) {
    const acts = tablaAleatoria(rng, 6);
    assert.equal(contarFicticias(buildNetwork(acts)), minimoExacto(acts), JSON.stringify(acts));
  }
});

// ---------- Paso a paso ----------
test('pasos: construcción coherente en tablas aleatorias', () => {
  const rng = rngSimple(99);
  for (let it = 0; it < 1500; it++) {
    const acts = tablaLibre(rng, rng.int(2, 9));
    const { pasos, orden, red, layout } = pasosConstruccion(acts);
    const cierre = cierrePredecesoras(acts);
    assert.equal(orden.length, acts.length);
    assert.deepEqual(red.edges.map((e) => e.kind + e.from + e.to + (e.act || '')), buildNetwork(acts).edges.map((e) => e.kind + e.from + e.to + (e.act || '')));
    const acts_k = pasos.filter((p) => p.tipo === 'actividad');
    assert.equal(acts_k.length, acts.length);
    acts_k.forEach((p, k) => {
      const dibuj = p.net.edges.filter((e) => e.kind === 'activity').map((e) => e.act).sort();
      assert.deepEqual(dibuj, orden.slice(0, k + 1).sort());
      // cada actividad dibujada espera exactamente a sus predecesoras totales
      const reach = alcanceEventos(p.net);
      for (const e of p.net.edges.filter((x) => x.kind === 'activity')) {
        assert.deepEqual([...reach.get(e.from)].sort(), [...cierre.get(e.act)].sort(), `paso ${k} act ${e.act} ${JSON.stringify(acts)}`);
      }
      assert.ok(p.net.edges.some((e) => p.resaltar.has(e.id) && e.act === p.actividad));
      assert.ok(p.texto.length > 10);
    });
    const ver = pasos.find((p) => p.tipo === 'verificacion');
    assert.equal(ver.ok, true);
    const nums = pasos.filter((p) => p.tipo === 'numeracion');
    assert.equal(nums.length, red.nodes.length);
    const ultimo = pasos[pasos.length - 1];
    assert.equal(ultimo.tipo, 'resumen');
    const num = Object.fromEntries(ultimo.numeros);
    assert.ok(numeracionValida(red, num));
    assert.equal(layout.numbered.length, red.nodes.length);
    // los pasos de numeración asignan 1..k sin repetir
    nums.forEach((p, k) => assert.deepEqual([...p.numeros.values()].sort((a, b) => a - b), Array.from({ length: k + 1 }, (_, i) => i + 1)));
  }
});

test('pasos: la ficticia del ejemplo de la teoría aparece al agregar C y se explica', () => {
  const acts = T([['A', ''], ['B', ''], ['C', 'A,B'], ['D', 'B']]);
  const { pasos } = pasosConstruccion(acts);
  const pC = pasos.find((p) => p.actividad === 'C');
  assert.match(pC.texto, /ficticia/);
  assert.match(pC.calculo.join(' '), /Ficticias nuevas: 1/);
  const pD = pasos.find((p) => p.actividad === 'D');
  assert.match(pD.texto, /indispensable/);
  assert.equal(explicarFicticias(buildNetwork(acts)).length, 1);
});

test('pasos: ordenConstruccion aplaza actividades sin predecesoras listas y rechaza ciclos', () => {
  const acts = T([['C', 'A'], ['A', ''], ['B', 'C']]);
  assert.deepEqual(ordenConstruccion(acts), ['A', 'C', 'B']);
  assert.throws(() => ordenConstruccion(T([['A', 'B'], ['B', 'A']])));
});

test('ejemplos del curso: los pasos terminan con la red y numeración válidas', () => {
  for (const ex of EXAMPLES) {
    const acts = ex.activities.map((r) => ({ name: r.name, preds: splitPreds(r.preds) }));
    const { pasos, red } = pasosConstruccion(acts);
    const num = Object.fromEntries(pasos[pasos.length - 1].numeros);
    assert.ok(numeracionValida(red, num), ex.id);
    assert.equal(computeLayout(red).numbered.length, red.nodes.length);
  }
});

// ---------- Práctica ----------
const SEMILLAS = Array.from({ length: 2500 }, (_, i) => i + 1);

const respuestasIncorrectas = (ej) => {
  const { entrada, respuesta } = ej;
  if (entrada.tipo === 'numero') return [respuesta + 1, respuesta + 2, respuesta === 0 ? 3 : 0];
  if (entrada.tipo === 'multi') {
    const todas = entrada.opciones.map((_, i) => i);
    const otras = todas.filter((i) => !respuesta.includes(i));
    return [[...respuesta.slice(1)], [...respuesta, ...otras.slice(0, 1)].sort((a, b) => a - b), []].filter((r) => JSON.stringify(r) !== JSON.stringify(respuesta));
  }
  return entrada.opciones.map((_, i) => i).filter((i) => i !== respuesta);
};

for (const tipo of TIPOS) {
  test(`práctica ${tipo}: ${SEMILLAS.length} semillas sin excepciones y con corrección coherente`, () => {
    for (const s of SEMILLAS) {
      const ej = generarEjercicio(tipo, s);
      assert.equal(JSON.stringify(ej), JSON.stringify(generarEjercicio(tipo, s)), 'determinista');
      assert.ok(ej.pregunta && ej.enunciado && ej.explicacion);
      const ok = corregir(ej, ej.respuesta);
      assert.equal(ok.correcta, true);
      assert.ok(ok.mensaje.length > 5);
      for (const r of respuestasIncorrectas(ej)) {
        const m = corregir(ej, r);
        assert.equal(m.correcta, false, `${tipo} ${s} resp ${JSON.stringify(r)}`);
        assert.ok(m.mensaje.length > 5);
      }
      // la tabla del ejercicio es válida y sin ciclos
      assert.doesNotThrow(() => ordenConstruccion(ej.tabla));
    }
  });
}

test('práctica ficticias: la respuesta coincide con el mínimo exacto y la red es válida', () => {
  const vistos = new Set();
  let exactos = 0;
  for (const s of SEMILLAS) {
    const ej = generarEjercicio('ficticias', s);
    assert.ok(verificarRed(ej.tabla, ej.red).ok);
    assert.equal(ej.respuesta, contarFicticias(ej.red));
    assert.equal(ej.respuesta === 0, sinFicticiasNecesarias(ej.tabla));
    vistos.add(ej.respuesta);
    if (s <= 150 && ej.tabla.length <= 5) { assert.equal(ej.respuesta, minimoExacto(ej.tabla), `semilla ${s}`); exactos++; }
  }
  assert.ok(vistos.has(0) && vistos.has(1) && vistos.has(2), [...vistos].join());
  assert.ok(exactos > 20, 'ejercicios comprobados con el mínimo exacto: ' + exactos);
});

test('práctica extremos: cálculo independiente desde la tabla', () => {
  for (const s of SEMILLAS) {
    const ej = generarEjercicio('extremos', s);
    const nombres = ej.tabla.map((a) => a.name);
    const referenciada = new Set(ej.tabla.flatMap((a) => a.preds));
    const esperado = (ej.modo === 'inicio' ? ej.tabla.filter((a) => !a.preds.length) : ej.tabla.filter((a) => !referenciada.has(a.name)))
      .map((a) => nombres.indexOf(a.name));
    assert.deepEqual(ej.respuesta, esperado);
    // y coincide con la red: salen del inicio / llegan al final
    const net = buildNetwork(ej.tabla);
    const desdeInicio = net.edges.filter((e) => e.kind === 'activity' && e.from === net.start).map((e) => e.act).sort();
    // llegan al final las actividades que ninguna otra actividad espera (según lo que alcanza cada evento de inicio)
    const reachN = alcanceEventos(net);
    const esperada = new Set(net.edges.filter((e) => e.kind === 'activity').flatMap((e) => [...reachN.get(e.from)]));
    const alFinal = net.edges.filter((e) => e.kind === 'activity' && !esperada.has(e.act)).map((e) => e.act).sort();
    const contrastar = ej.modo === 'inicio' ? desdeInicio : alFinal;
    assert.deepEqual(contrastar, esperado.map((i) => nombres[i]).sort());
    assert.deepEqual(extremosTabla(ej.tabla)[ej.modo === 'inicio' ? 'iniciales' : 'finales'].sort(), contrastar);
  }
});

test('práctica red: exactamente una red respeta la tabla', () => {
  for (const s of SEMILLAS) {
    const ej = generarEjercicio('red', s);
    assert.equal(ej.redes.length, 3);
    const buenas = ej.redes.map((r, i) => (verificarRed(ej.tabla, r).ok ? i : -1)).filter((i) => i >= 0);
    assert.deepEqual(buenas, [ej.respuesta], `semilla ${s}`);
  }
});

test('práctica error: solo la actividad indicada no respeta la tabla', () => {
  for (const s of SEMILLAS) {
    const ej = generarEjercicio('error', s);
    const v = verificarRed(ej.tabla, ej.redes[0]);
    assert.deepEqual(v.estructura, []);
    assert.deepEqual(v.dependencias.map((d) => d.act), [ej.objetivo]);
    assert.equal(ej.entrada.opciones[ej.respuesta], ej.objetivo);
  }
});

test('práctica numeración: exactamente una opción cumple i < j', () => {
  for (const s of SEMILLAS) {
    const ej = generarEjercicio('numeracion', s);
    const net = ej.redes[0];
    const validas = ej.numeraciones.map((m, i) => (numeracionValida(net, m) ? i : -1)).filter((i) => i >= 0);
    assert.deepEqual(validas, [ej.respuesta], `semilla ${s}`);
    assert.equal(new Set(ej.entrada.opciones).size, ej.entrada.opciones.length);
    assert.equal(Object.keys(ej.etiquetas).length, net.nodes.length);
  }
});

test('práctica: variedad de ejercicios entre semillas', () => {
  for (const tipo of TIPOS) {
    const set = new Set(SEMILLAS.slice(0, 300).map((s) => JSON.stringify({ ...generarEjercicio(tipo, s), id: 0, seed: 0 })));
    assert.ok(set.size > 100, tipo + ' ' + set.size);
  }
});

test('ejemplos del Paso a paso: red válida y, hasta 5 actividades, mínimo exacto', () => {
  for (const ex of EJEMPLOS_ESTRUCTURA) {
    const net = buildNetwork(ex.acts);
    assert.ok(verificarRed(ex.acts, net).ok, ex.id);
    if (ex.acts.length <= 5) assert.equal(contarFicticias(net), minimoExacto(ex.acts), ex.id);
    const { pasos } = pasosConstruccion(ex.acts);
    assert.equal(pasos.length, 1 + ex.acts.length + 1 + net.nodes.length + 1);
  }
});
