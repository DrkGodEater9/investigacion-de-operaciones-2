import test from 'node:test';
import assert from 'node:assert/strict';
import { arbolDeEjemplo, EJEMPLOS } from '../domain/ejemplos.js';
import { evaluar } from '../domain/evaluar.js';
import { perfilRiesgo } from '../domain/riesgo.js';
import { sensibilidad } from '../domain/sensibilidad.js';
import { parsearTexto } from '../domain/texto.js';
import { normalizar } from '../domain/arbol.js';
import { tablaNodos, construirCSV, construirMarkdown, lineasResultado, plano, crudo } from '../domain/informe.js';
import { mulberry32, arbolAleatorio } from './utils.mjs';
import { normalizarOError } from '../domain/arbol.js';

test('plano: sin subíndices ni símbolos que falten en la fuente del PDF', () => {
  assert.equal(plano('x₁ › x₂'), 'x1 > x2');
  assert.equal(plano('Tamaño − 5 × 2'), 'Tamaño − 5 × 2');
  assert.equal(crudo(0.1 + 0.2), '0.3');
  assert.equal(crudo(-0), '0');
});

test('tabla de nodos: una fila por rama de cada nodo interno', () => {
  for (const e of EJEMPLOS) {
    const t = arbolDeEjemplo(e.id);
    const ev = evaluar(t);
    const tabla = tablaNodos(t, ev);
    const ramas = ev.orden.reduce((s, id) => s + ev.porNodo[id].ramas.length, 0);
    assert.equal(tabla.rows.length, ramas);
    assert.ok(tabla.rows.every((r) => r.length === tabla.headers.length));
  }
  const t = arbolDeEjemplo('planta');
  const tabla = tablaNodos(t, evaluar(t));
  // la rama elegida de la decisión raíz es «Grande» con valor 84
  const fila = tabla.rows.find((r) => r[0] === 'Tamaño de la planta' && r[7] === 'Sí');
  assert.equal(fila[2], 'Grande');
  assert.equal(fila[6], '84');
});

test('CSV: encabezado, número de filas y decimales con punto', () => {
  const t = arbolDeEjemplo('estudio');
  const ev = evaluar(t);
  const csv = construirCSV({ arbol: t, ev });
  const lineas = csv.replace(/^﻿/, '').split('\n');
  assert.equal(lineas.length, 1 + tablaNodos(t, ev).rows.length);
  assert.match(lineas[0], /^Nodo,Tipo,Rama,p,/);
  assert.ok(lineas.some((l) => l.includes('0.55')));
  assert.ok(lineas.every((l) => !/\d,\d/.test(l.replace(/"[^"]*"/g, '')) || l.split(',').length >= 9));
});

test('Markdown: contiene el árbol en texto y se puede volver a leer', () => {
  for (const e of EJEMPLOS) {
    const t = arbolDeEjemplo(e.id);
    const ev = evaluar(t);
    const sens = sensibilidad(t, 'n2', 0, { pasos: 20 });
    const md = construirMarkdown({ arbol: t, ev, riesgo: perfilRiesgo(t, ev), sens });
    assert.match(md, /^# Árbol de decisión: resultados/);
    assert.match(md, /## Perfil de riesgo/);
    assert.match(md, /## Sensibilidad/);
    const bloque = /```\n([\s\S]*?)\n```/.exec(md)[1];
    const r = normalizar(parsearTexto(bloque).arbol);
    assert.deepEqual(r.errores, []);
    assert.ok(Math.abs(evaluar(r.arbol).valor - ev.valor) < 1e-9);
    assert.ok(lineasResultado(t, ev)[0].includes(String(ev.valor).replace('.', ',').slice(0, 3)));
  }
});

test('informes de árboles aleatorios no fallan', () => {
  const rng = mulberry32(4242);
  for (let i = 0; i < 80; i++) {
    const t = normalizarOError(arbolAleatorio(rng, { prof: 3, total: 20 }));
    const ev = evaluar(t);
    const md = construirMarkdown({ arbol: t, ev, riesgo: perfilRiesgo(t, ev), sens: null });
    assert.ok(md.length > 100);
    assert.ok(construirCSV({ arbol: t, ev }).length > 50);
  }
});
