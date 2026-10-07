import test from 'node:test';
import assert from 'node:assert/strict';
import { fmtNum, fmtPar, fmtTexto, parseNumero, parseProb } from '../domain/format.js';
import { normalizar, normalizarOError, listaNodos, hojas, contarNodos, MAX_NODOS } from '../domain/arbol.js';
import { evaluar, estrategiaTexto } from '../domain/evaluar.js';
import { perfilRiesgo } from '../domain/riesgo.js';
import { parsearTexto, arbolATexto } from '../domain/texto.js';
import { disponer, GEOM } from '../domain/layout.js';
import { pasosInduccion } from '../domain/pasos.js';
import * as ed from '../domain/edicion.js';
import { EJEMPLOS, arbolDeEjemplo } from '../domain/ejemplos.js';
import { mulberry32, arbolAleatorio, mejorPorEstrategias, cerca } from './utils.mjs';

const MENOS = '−';

test('format: números en español', () => {
  assert.equal(fmtNum(21), '21');
  assert.equal(fmtNum(0.6), '0,6');
  assert.equal(fmtNum(1 / 3), '0,3333');
  assert.equal(fmtNum(-3), `${MENOS}3`);
  assert.equal(fmtNum(0), '0');
  assert.equal(fmtNum(-0.00001), '0');
  assert.equal(fmtNum(100), '100');
  assert.equal(fmtNum(1000), '1000');
  assert.equal(fmtNum(NaN), '—');
  assert.equal(fmtPar(-5), `(${MENOS}5)`);
  assert.equal(fmtPar(5), '5');
  assert.equal(fmtTexto(0.25), '0,25');
  assert.equal(fmtTexto(-1.5), '-1,5');
});

test('format: parseNumero y parseProb', () => {
  assert.equal(parseNumero('12'), 12);
  assert.equal(parseNumero(' 0,6 '), 0.6);
  assert.equal(parseNumero('.5'), 0.5);
  assert.equal(parseNumero(`${MENOS}7`), -7);
  assert.equal(parseNumero('-7,25'), -7.25);
  assert.equal(parseNumero('3/4'), 0.75);
  assert.equal(parseNumero('1/0'), null);
  assert.equal(parseNumero(''), null);
  assert.equal(parseNumero('abc'), null);
  assert.equal(parseNumero('1,2,3'), null);
  assert.equal(parseNumero('12 %'), null);
  assert.equal(parseProb('60 %'), 0.6);
  assert.equal(parseProb('60%'), 0.6);
  assert.equal(parseProb('0,6'), 0.6);
  assert.equal(parseProb('x%'), null);
  assert.equal(parseNumero(Infinity), null);
});

test('ejemplos: todos válidos y con el valor calculado a mano', () => {
  const esperado = { planta: 84, estudio: 74.2, mantenimiento: 50, lanzamiento: 41.6 };
  for (const e of EJEMPLOS) {
    const r = normalizar(e.arbol);
    assert.deepEqual(r.errores, [], e.id);
    const ev = evaluar(r.arbol);
    assert.ok(cerca(ev.valor, esperado[e.id]), `${e.id}: ${ev.valor}`);
  }
  // planta: grande 0,6·300 + 0,4·60 − 120 = 84; pequeña 0,6·150 + 0,4·90 − 50 = 76; no construir 0
  const ev = evaluar(arbolDeEjemplo('planta'));
  const raiz = ev.porNodo.n1;
  assert.deepEqual(raiz.ramas.map((r) => Math.round(r.total * 1e9) / 1e9), [84, 76, 0]);
  assert.equal(raiz.elegida, 0);
  assert.deepEqual(estrategiaTexto(ev), ['En «Tamaño de la planta»: elegir «Grande».']);
});

test('estudio: estrategia con dos decisiones y camino óptimo', () => {
  const ev = evaluar(arbolDeEjemplo('estudio'));
  assert.ok(cerca(ev.valor, 74.2));
  assert.deepEqual(ev.estrategia.map((e) => e.eleccion), ['Hacer el estudio', 'Lanzar', 'No lanzar']);
  assert.deepEqual(ev.estrategia[1].ruta, ['Hacer el estudio', 'Favorable']);
  // La rama «Sin estudio» no está en la política
  assert.equal(ev.politica['n1:1'], undefined);
  assert.equal(ev.politica['n1:0'], true);
});

test('mantenimiento: minimización toma el mínimo', () => {
  const ev = evaluar(arbolDeEjemplo('mantenimiento'));
  assert.equal(ev.estrategia[0].eleccion, 'Preventivo');
  assert.deepEqual(ev.porNodo.n1.ramas.map((r) => Math.round(r.total * 1e9) / 1e9), [50, 63, 90]);
});

test('evaluar: empate se resuelve con la primera rama y se avisa', () => {
  const t = normalizarOError({
    sense: 'max', raiz: { id: 'a', tipo: 'decision', nombre: 'D', ramas: [
      { etiqueta: 'X', pago: 0, hijo: { id: 'b', tipo: 'final', valor: 10 } },
      { etiqueta: 'Y', pago: 0, hijo: { id: 'c', tipo: 'final', valor: 10 } },
      { etiqueta: 'Z', pago: 0, hijo: { id: 'd', tipo: 'final', valor: 3 } },
    ] },
  });
  const ev = evaluar(t);
  assert.deepEqual(ev.porNodo.a.empates, [0, 1]);
  assert.equal(ev.porNodo.a.elegida, 0);
  assert.ok(ev.porNodo.a.lineas.at(-1).includes('empate'));
  assert.ok(estrategiaTexto(ev)[0].includes('empata'));
});

test('evaluar contra cálculo independiente (estrategias puras) en 400 árboles aleatorios', () => {
  const rng = mulberry32(2025);
  let conDecision = 0;
  for (let i = 0; i < 400; i++) {
    const t = normalizarOError(arbolAleatorio(rng, { prof: 3, total: rng.pick([20, 7, 10, 3]) }));
    const ev = evaluar(t);
    const ind = mejorPorEstrategias(t);
    assert.ok(cerca(ev.valor, ind), `árbol ${i}: ${ev.valor} vs ${ind}`);
    if (listaNodos(t).some((n) => n.tipo === 'decision')) conDecision += 1;
    // la rama elegida de cada decisión alcanzada es la mejor de sus ramas
    for (const e of ev.estrategia) {
      const info = ev.porNodo[e.nodoId];
      const tot = info.ramas.map((r) => r.total);
      const m = t.sense === 'max' ? Math.max(...tot) : Math.min(...tot);
      assert.ok(cerca(tot[e.idx], m));
    }
    // un nodo de azar vale la suma ponderada de sus ramas
    for (const n of listaNodos(t)) {
      if (n.tipo !== 'azar') continue;
      const s = n.ramas.reduce((a, r) => a + r.p * (r.pago + ev.porNodo[r.hijo.id].valor), 0);
      assert.ok(cerca(ev.porNodo[n.id].valor, s));
    }
  }
  assert.ok(conDecision > 300);
});

test('perfil de riesgo: probabilidades suman 1 y la media es el valor del árbol', () => {
  const rng = mulberry32(77);
  for (let i = 0; i < 200; i++) {
    const t = normalizarOError(arbolAleatorio(rng, { prof: 3, total: 20 }));
    const ev = evaluar(t);
    const pr = perfilRiesgo(t, ev);
    assert.ok(cerca(pr.puntos.reduce((s, x) => s + x.p, 0), 1), `suma de p en ${i}`);
    assert.ok(cerca(pr.esperado, ev.valor), `media en ${i}`);
    assert.ok(pr.varianza >= -1e-9);
    assert.ok(pr.minimo <= pr.maximo);
    assert.ok(cerca(pr.pNegativo, pr.puntos.filter((x) => x.valor < 0).reduce((s, x) => s + x.p, 0)));
  }
  // planta: grande da 180 (p 0,6) o −60 (p 0,4) → media 84
  const t = arbolDeEjemplo('planta');
  const pr = perfilRiesgo(t, evaluar(t));
  assert.deepEqual(pr.puntos.map((x) => [x.valor, Math.round(x.p * 1e9) / 1e9]), [[-60, 0.4], [180, 0.6]]);
  assert.ok(cerca(pr.pNegativo, 0.4));
  assert.ok(cerca(pr.desviacion, Math.sqrt(0.6 * 96 ** 2 + 0.4 * 144 ** 2)));
});

test('validación: mensajes claros', () => {
  const base = () => ({
    sense: 'max', raiz: { id: 'n1', tipo: 'azar', nombre: 'Demanda', ramas: [
      { etiqueta: 'Alta', p: '0,6', pago: '', hijo: { id: 'n2', tipo: 'final', valor: '100' } },
      { etiqueta: 'Baja', p: '0,4', pago: '', hijo: { id: 'n3', tipo: 'final', valor: '-20' } },
    ] },
  });
  assert.deepEqual(normalizar(base()).errores, []);

  let a = base(); a.raiz.ramas[1].p = '0,3';
  let r = normalizar(a);
  assert.equal(r.arbol, null);
  assert.match(r.errores[0].mensaje, /suman 0,9 y deben sumar 1 \(faltan 0,1\)/);

  a = base(); a.raiz.ramas[1].p = '0,5';
  assert.match(normalizar(a).errores[0].mensaje, /sobran 0,1/);

  a = base(); a.raiz.ramas[0].p = '';
  assert.match(normalizar(a).errores[0].mensaje, /Falta la probabilidad de la rama «Alta»/);

  a = base(); a.raiz.ramas[0].p = '1,2'; a.raiz.ramas[1].p = '-0,2';
  assert.match(normalizar(a).errores[0].mensaje, /debe estar entre 0 y 1/);

  a = base(); a.raiz.ramas[0].p = 'mucho';
  assert.match(normalizar(a).errores[0].mensaje, /no es un número/);

  a = base(); a.raiz.ramas[0].hijo.valor = '';
  assert.match(normalizar(a).errores[0].mensaje, /Falta el valor del resultado al final de «Alta»/);

  a = base(); a.raiz.ramas[0].hijo.valor = '';
  a.raiz.ramas[0].pago = '100';
  assert.deepEqual(normalizar(a).errores, [], 'con pago en la rama, el valor vacío es 0');

  a = base(); a.raiz.ramas[0].pago = 'x';
  assert.match(normalizar(a).errores[0].mensaje, /El pago de la rama «Alta»/);

  a = base(); a.raiz.ramas = [];
  assert.match(normalizar(a).errores[0].mensaje, /no tiene ramas/);

  a = base(); a.raiz.tipo = 'otro';
  assert.match(normalizar(a).errores[0].mensaje, /debe ser decision, azar o final/);

  assert.match(normalizar(null).errores[0].mensaje, /vacío/);
  assert.match(normalizar({ sense: 'max', raiz: { id: 'x', tipo: 'final', valor: 1 } }).errores[0].mensaje, /al menos un nodo de decisión o de azar/);

  a = base(); a.sense = 'mediana';
  assert.match(normalizar(a).errores[0].mensaje, /maximizar o minimizar/);
});

test('validación: la ruta del error dice dónde está', () => {
  const a = {
    sense: 'max', raiz: { id: 'n1', tipo: 'decision', nombre: 'Elegir', ramas: [
      { etiqueta: 'Invertir', pago: 0, hijo: { id: 'n2', tipo: 'azar', nombre: 'Mercado', ramas: [
        { etiqueta: 'Alto', p: 0.5, hijo: { id: 'n3', tipo: 'final', valor: 1 } },
        { etiqueta: 'Bajo', p: 0.3, hijo: { id: 'n4', tipo: 'final', valor: 2 } },
      ] } },
      { etiqueta: 'No invertir', hijo: { id: 'n5', tipo: 'final', valor: 0 } },
    ] },
  };
  const r = normalizar(a);
  assert.equal(r.errores.length, 1);
  assert.equal(r.errores[0].nodoId, 'n2');
  assert.equal(r.errores[0].ruta, 'Invertir');
  assert.match(r.errores[0].mensaje, /«Mercado»/);
});

test('validación: ciclos, repetidos y tamaño', () => {
  const hoja = { id: 'h', tipo: 'final', valor: 1 };
  const a = { id: 'a', tipo: 'decision', nombre: 'A', ramas: [] };
  a.ramas.push({ etiqueta: 'vuelve', hijo: a }, { etiqueta: 'sale', hijo: hoja });
  const r = normalizar({ sense: 'max', raiz: a });
  assert.ok(r.errores.some((e) => /más de una vez/.test(e.mensaje)));

  // el mismo objeto en dos ramas
  const comun = { id: 'c', tipo: 'final', valor: 2 };
  const b = { id: 'b', tipo: 'decision', nombre: 'B', ramas: [{ etiqueta: '1', hijo: comun }, { etiqueta: '2', hijo: comun }] };
  assert.ok(normalizar({ sense: 'max', raiz: b }).errores.some((e) => /más de una vez/.test(e.mensaje)));

  // identificadores repetidos
  const c = { id: 'x', tipo: 'decision', nombre: 'C', ramas: [{ etiqueta: '1', hijo: { id: 'x', tipo: 'final', valor: 1 } }, { etiqueta: '2', hijo: { id: 'y', tipo: 'final', valor: 1 } }] };
  assert.ok(normalizar({ sense: 'max', raiz: c }).errores.some((e) => /mismo identificador/.test(e.mensaje)));

  // demasiado grande
  const muchas = { id: 'g', tipo: 'decision', nombre: 'G', ramas: Array.from({ length: MAX_NODOS + 5 }, (_, i) => ({ etiqueta: `r${i}`, hijo: { id: `h${i}`, tipo: 'final', valor: i } })) };
  const g = normalizar({ sense: 'max', raiz: muchas });
  assert.ok(g.errores.some((e) => /más de/.test(e.mensaje)));
  assert.equal(g.arbol, null);

  // demasiado profundo no desborda la pila
  let prof = { id: 'f', tipo: 'final', valor: 0 };
  for (let i = 0; i < 100; i++) prof = { id: `d${i}`, tipo: 'decision', nombre: `D${i}`, ramas: [{ etiqueta: 'a', hijo: prof }] };
  assert.ok(normalizar({ sense: 'max', raiz: prof }).errores.some((e) => /profundo/.test(e.mensaje)));
});

test('validación: avisos de una sola rama y ramas repetidas', () => {
  const r = normalizar({
    sense: 'max', raiz: { id: 'n1', tipo: 'decision', nombre: 'D', ramas: [
      { etiqueta: 'A', hijo: { id: 'n2', tipo: 'final', valor: 1 } },
    ] },
  });
  assert.equal(r.errores.length, 0);
  assert.match(r.avisos[0], /una sola rama/);
  const r2 = normalizar({
    sense: 'max', raiz: { id: 'n1', tipo: 'decision', nombre: 'D', ramas: [
      { etiqueta: 'A', hijo: { id: 'n2', tipo: 'final', valor: 1 } },
      { etiqueta: 'A', hijo: { id: 'n3', tipo: 'final', valor: 2 } },
    ] },
  });
  assert.match(r2.avisos[0], /mismo nombre/);
});

test('nombres por defecto y probabilidades que suman 1 con decimales', () => {
  const t = normalizarOError({
    sense: 'max', raiz: { id: 'n1', tipo: 'azar', nombre: '', ramas: [
      { etiqueta: 'a', p: '0,1', hijo: { id: 'n2', tipo: 'final', valor: 1 } },
      { etiqueta: 'b', p: '0,2', hijo: { id: 'n3', tipo: 'final', valor: 1 } },
      { etiqueta: 'c', p: '0,7', hijo: { id: 'n4', tipo: 'final', valor: 1 } },
    ] },
  });
  assert.equal(t.raiz.nombre, 'Azar 1');
  assert.equal(contarNodos(t), 4);
  assert.equal(hojas(t).length, 3);
});

test('texto indentado: lectura de un árbol y errores con número de línea', () => {
  const src = `objetivo: max
unidad: millones
# comentario
- [D] Tamaño
  - Grande | pago -120
    - [A] Demanda
      - Alta | p 0,6 | valor 300
      - Baja | p 40 % | valor 60
  - No construir | valor 0`;
  const r = parsearTexto(src);
  assert.deepEqual(r.errores, []);
  const n = normalizar(r.arbol);
  assert.deepEqual(n.errores, []);
  assert.equal(n.arbol.unidad, 'millones');
  assert.ok(cerca(evaluar(n.arbol).valor, 84));

  // sin viñetas y con sangría de 4 espacios o tabulador
  const r2 = parsearTexto('max\n[D] D\n\tA | valor 1\n\tB | valor 2');
  assert.deepEqual(r2.errores, []);
  assert.equal(evaluar(normalizarOError(r2.arbol)).valor, 2);

  // símbolos □ y ○
  const r3 = parsearTexto('□ Elegir\n  - Riesgo\n    ○ Suerte\n      - Sí | p 0,5 | valor 10\n      - No | p 0,5 | valor 0\n  - Seguro | valor 4');
  assert.deepEqual(r3.errores, []);
  assert.ok(cerca(evaluar(normalizarOError(r3.arbol)).valor, 5));

  // errores
  assert.match(parsearTexto('').errores[0].mensaje, /Escribe el árbol/);
  assert.match(parsearTexto('- Rama suelta | valor 3').errores[0].mensaje, /^Línea 1: el árbol debe empezar con un nodo/);
  assert.match(parsearTexto('[D] A\n  - x | valor 1\n[D] B').errores[0].mensaje, /^Línea 3: solo puede haber un nodo raíz/);
  assert.match(parsearTexto('[D] A\n  - x | foo 3').errores[0].mensaje, /^Línea 2: no entiendo el campo «foo 3»/);
  assert.match(parsearTexto('[D] A\n  - x | valor 1\n    - [A] N').errores[0].mensaje, /ya termina en un valor/);
  assert.match(parsearTexto('objetivo: mediano\n[D] A\n  - x | valor 1').errores[0].mensaje, /no entiendo el objetivo/);
  assert.match(parsearTexto('[D] A\n  - | valor 1').errores[0].mensaje, /no tiene nombre/);
  // una hoja sin valor ni pago se reporta al validar, con la ruta
  const sin = parsearTexto('[D] A\n  - x\n  - y | valor 2');
  assert.deepEqual(sin.errores, []);
  assert.match(normalizar(sin.arbol).errores[0].mensaje, /Falta el valor del resultado al final de «x»/);
  // con pago en la rama basta
  assert.deepEqual(normalizar(parsearTexto('[D] A\n  - x | pago 5\n  - y | valor 2').arbol).errores, []);
});

test('texto: ida y vuelta en árboles aleatorios', () => {
  const rng = mulberry32(31337);
  for (let i = 0; i < 200; i++) {
    const original = arbolAleatorio(rng, { prof: 3, total: rng.pick([20, 7, 3]), texto: rng.next() < 0.5 });
    const n1 = normalizar(original);
    assert.deepEqual(n1.errores, [], `original ${i}`);
    const txt = arbolATexto(original);
    const p = parsearTexto(txt);
    assert.deepEqual(p.errores, [], `parseo ${i}\n${txt}`);
    const n2 = normalizar(p.arbol);
    assert.deepEqual(n2.errores, [], `normalización ${i}\n${txt}`);
    assert.ok(cerca(evaluar(n1.arbol).valor, evaluar(n2.arbol).valor, 1e-6), `valor ${i}`);
    assert.equal(contarNodos(n1.arbol), contarNodos(n2.arbol));
    assert.equal(n1.arbol.sense, n2.arbol.sense);
    // el árbol normalizado también se serializa y se vuelve a leer
    const n3 = normalizar(parsearTexto(arbolATexto(n1.arbol)).arbol);
    assert.deepEqual(n3.errores, []);
    assert.ok(cerca(evaluar(n3.arbol).valor, evaluar(n1.arbol).valor, 1e-6));
  }
  for (const e of EJEMPLOS) {
    const n = normalizar(parsearTexto(arbolATexto(e.arbol)).arbol);
    assert.deepEqual(n.errores, [], e.id);
    assert.ok(cerca(evaluar(n.arbol).valor, evaluar(normalizarOError(e.arbol)).valor));
  }
});

test('JSON: el árbol viaja ida y vuelta sin perder nada', () => {
  for (const e of EJEMPLOS) {
    const t = normalizarOError(e.arbol);
    const ida = JSON.parse(JSON.stringify(t));
    assert.deepEqual(ida, t);
    assert.deepEqual(evaluar(ida).valor, evaluar(t).valor);
  }
});

test('edición: agregar, quitar y cambiar tipo sin tocar el original', () => {
  const t0 = ed.arbolVacio();
  const copia = JSON.stringify(t0);
  const t1 = ed.agregarRama(t0, 'n1');
  assert.equal(JSON.stringify(t0), copia);
  assert.equal(t1.raiz.ramas.length, 3);
  assert.equal(new Set(listaNodos(t1).map((n) => n.id)).size, 4);

  const t2 = ed.cambiarTipo(t1, 'n2', 'azar');
  const azar = listaNodos(t2).find((n) => n.id === 'n2');
  assert.equal(azar.tipo, 'azar');
  assert.equal(azar.ramas.length, 2);
  assert.equal(new Set(listaNodos(t2).map((n) => n.id)).size, listaNodos(t2).length);

  const t3 = ed.cambiarTipo(t2, 'n2', 'final');
  assert.equal(listaNodos(t3).find((n) => n.id === 'n2').ramas.length, 0);
  assert.equal(listaNodos(t3).length, 4);

  const t4 = ed.quitarRama(t3, 'n1', 0);
  assert.equal(t4.raiz.ramas.length, 2);

  const t5 = ed.actualizarRama(ed.actualizarNodo(t4, 'n1', { nombre: 'Raíz' }), 'n1', 0, { etiqueta: 'X', pago: '5' });
  assert.equal(t5.raiz.nombre, 'Raíz');
  assert.equal(t5.raiz.ramas[0].etiqueta, 'X');
  assert.equal(t5.raiz.ramas[0].pago, '5');
});

test('edición: repartir y completar probabilidades', () => {
  let t = ed.arbolVacio();
  t = ed.cambiarTipo(t, 'n1', 'azar');
  t = ed.agregarRama(t, 'n1');
  t = ed.repartirProbabilidades(t, 'n1');
  const ps = t.raiz.ramas.map((r) => parseProb(r.p));
  assert.ok(Math.abs(ps.reduce((s, x) => s + x, 0) - 1) < 1e-9);
  t = ed.actualizarRama(t, 'n1', 0, { p: '0,5' });
  t = ed.actualizarRama(t, 'n1', 1, { p: '0,3' });
  t = ed.completarUltima(t, 'n1');
  assert.equal(t.raiz.ramas[2].p, '0,2');
  // si alguna es inválida no cambia nada
  t = ed.actualizarRama(t, 'n1', 0, { p: 'x' });
  const antes = t.raiz.ramas[2].p;
  t = ed.actualizarRama(t, 'n1', 1, { p: '0,1' });
  assert.equal(ed.completarUltima(t, 'n1').raiz.ramas[2].p, antes);
});

test('edición: un árbol construido solo con operaciones se puede resolver', () => {
  let t = ed.arbolVacio();
  t = ed.actualizarArbol(t, { sense: 'max' });
  t = ed.cambiarTipo(t, 'n2', 'azar');
  t = ed.actualizarRama(t, 'n1', 0, { etiqueta: 'Riesgo' });
  t = ed.actualizarRama(t, 'n1', 1, { etiqueta: 'Seguro' });
  t = ed.actualizarNodo(t, 'n3', { valor: '4' });
  const azar = listaNodos(t).find((n) => n.id === 'n2');
  t = ed.actualizarRama(t, 'n2', 0, { etiqueta: 'Sí', p: '0,5' });
  t = ed.actualizarRama(t, 'n2', 1, { etiqueta: 'No', p: '0,5' });
  t = ed.actualizarNodo(t, azar.ramas[0].hijo.id, { valor: '10' });
  t = ed.actualizarNodo(t, azar.ramas[1].hijo.id, { valor: '0' });
  const r = normalizar(t);
  assert.deepEqual(r.errores, []);
  assert.ok(cerca(evaluar(r.arbol).valor, 5));
});

test('layout: padres centrados, hojas separadas, profundidad creciente', () => {
  const rng = mulberry32(99);
  for (let i = 0; i < 100; i++) {
    const t = normalizarOError(arbolAleatorio(rng, { prof: 4 }));
    const L = disponer(t);
    const porId = Object.fromEntries(L.nodos.map((n) => [n.id, n]));
    assert.equal(L.nodos.length, contarNodos(t));
    const ys = L.nodos.filter((n) => n.nodo.ramas.length === 0).map((n) => n.y).sort((a, b) => a - b);
    for (let k = 1; k < ys.length; k++) assert.ok(ys[k] - ys[k - 1] >= GEOM.dy - 1e-9);
    for (const n of L.nodos) {
      if (n.nodo.ramas.length) {
        const hs = n.nodo.ramas.map((r) => porId[r.hijo.id]);
        assert.ok(Math.abs(n.y - (hs[0].y + hs[hs.length - 1].y) / 2) < 1e-9);
        for (const h of hs) assert.ok(h.x > n.x);
      }
      assert.ok(n.x >= 0 && n.y >= 0 && n.x <= L.ancho && n.y <= L.alto);
    }
    assert.equal(L.aristas.length, L.nodos.length - 1);
  }
});

test('pasos: uno por nodo interno más el inicio y el final', () => {
  for (const e of EJEMPLOS) {
    const t = normalizarOError(e.arbol);
    const ev = evaluar(t);
    const pasos = pasosInduccion(t, ev);
    const internos = listaNodos(t).filter((n) => n.tipo !== 'final').length;
    assert.equal(pasos.length, internos + 2);
    assert.deepEqual(pasos[0].estado.resueltos, []);
    assert.equal(pasos.at(-1).estado.final, true);
    // los hijos se resuelven antes que el padre
    const visto = new Set();
    for (const p of pasos.slice(1, -1)) {
      const n = listaNodos(t).find((x) => x.id === p.estado.actual);
      for (const r of n.ramas) if (r.hijo.tipo !== 'final') assert.ok(visto.has(r.hijo.id), `${e.id}: ${n.nombre}`);
      visto.add(n.id);
      assert.ok(p.calculo.length >= 1);
      assert.equal(p.estado.resueltos.at(-1), n.id);
    }
    assert.ok(pasos.at(-1).texto.includes(fmtNum(ev.valor)));
  }
});
