import test from 'node:test';
import assert from 'node:assert/strict';
import { frac } from '../domain/fraction.js';
import { bmATexto } from '../domain/tablero.js';
import { planosDeCorte } from '../domain/cortes.js';
import { solveIP } from '../domain/branchAndBound.js';
import { ejemplosMixta } from '../domain/examplesMixta.js';
import { pasosCortes, pasosRamificacion } from '../domain/pasosMixta.js';

const e1 = ejemplosMixta[0];
const e2 = ejemplosMixta[1];
const txt = (p) => [p.titulo, p.queHago, p.porQue, ...p.calculo].join('\n');
const cz = (tab) => `(${tab.cz.map(bmATexto).join(', ')})`;
const zj = (tab) => `(${tab.zj.map(bmATexto).join(', ')})`;
const enBase = (tab, nombre) => {
  const i = tab.base.findIndex((j) => tab.cols[j].nombre === nombre);
  return i === -1 ? '0' : tab.b[i].toString();
};

const sin = pasosCortes(e1, { conContinuacionPura: false });
const con = pasosCortes(e1, { conContinuacionPura: true });
const ram = pasosRamificacion(e1);
const res = planosDeCorte(e1);
const c1 = res.cortes[0];
const pura = planosDeCorte({ ...e1, integer: [true, true] }, { tipo: 'fraccional' });

test('número de pasos: 13 / 17 / 7 y campos obligatorios', () => {
  assert.equal(sin.length, 13);
  assert.equal(con.length, 17);
  assert.equal(ram.length, 7);
  for (const lista of [sin, con, ram, pasosRamificacion(e2)]) {
    lista.forEach((p, i) => {
      assert.equal(p.id, i + 1);
      assert.ok(p.titulo.startsWith(`${i + 1}. `));
      assert.ok(p.queHago.trim().length > 20, `queHago vacío en ${p.id}`);
      assert.ok(p.porQue.trim().length > 20, `porQue vacío en ${p.id}`);
      assert.ok(Array.isArray(p.calculo) && p.calculo.length > 0);
      assert.ok(['tablero', 'arbol', 'texto'].includes(p.vista.tipo));
    });
  }
  // La continuación solo agrega pasos al final y los marca
  assert.deepEqual(con.slice(0, 13).map((p) => p.titulo), sin.map((p) => p.titulo));
  con.slice(13).forEach((p) => {
    assert.equal(p.continuacion, true);
    assert.match(p.etiqueta, /No aplica a la mixta: x1 es continua/);
  });
  sin.forEach((p) => assert.ok(!p.continuacion));
});

test('paso 3: tablero inicial, entra x2, razones 6/3 y 35/1, pivote 3', () => {
  const p = sin[2];
  const t0 = res.tableroInicial;
  assert.deepEqual(p.vista.tablero, res.lp.iteraciones[0].antes);
  assert.equal(zj(p.vista.tablero), '(0, 0, 0, 0)');
  assert.equal(cz(p.vista.tablero), '(7, 9, 0, 0)');
  assert.equal(cz(t0), '(7, 9, 0, 0)');
  assert.deepEqual(p.vista.pivote, { fila: 0, col: 1 });
  assert.deepEqual(p.vista.razones.filas, ['2', '35']);
  const s = txt(p);
  assert.match(s, /Entra x2/);
  assert.match(s, /6\/3 = 2/);
  assert.match(s, /35\/1 = 35/);
  assert.match(s, /Sale x3; pivote = 3/);
  assert.match(s, /Cj−Zj = \(7, 9, 0, 0\)/);
});

test('paso 4: tablero 2 con x2=2, x4=33, Z=18; entra x1, razón 33/(22/3)=9/2, pivote 22/3', () => {
  const p = sin[3];
  const t2 = res.lp.iteraciones[0].despues;
  assert.deepEqual(p.vista.tablero, res.lp.iteraciones[1].antes);
  assert.equal(enBase(p.vista.tablero, 'x2'), '2');
  assert.equal(enBase(p.vista.tablero, 'x4'), '33');
  assert.equal(p.vista.tablero.zval.a.toString(), '18');
  assert.equal(cz(p.vista.tablero), '(10, 0, -3, 0)');
  assert.equal(cz(t2), '(10, 0, -3, 0)');
  assert.deepEqual(p.vista.pivote, { fila: 1, col: 0 });
  const s = txt(p);
  assert.match(s, /Entra x1/);
  assert.match(s, /coeficiente -1\/3 ≤ 0, no cuenta/);
  assert.match(s, /33\/\(22\/3\) = 9\/2/);
  assert.match(s, /pivote = 22\/3/);
  assert.equal(p.vista.razones.filas[1], '9/2');
  assert.equal(p.vista.razones.filas[0], null);
});

test('paso 5: óptimo de la relajación x=(9/2,7/2), Z=63, Cj−Zj=(0,0,-28/11,-15/11)', () => {
  const p = sin[4];
  assert.deepEqual(p.vista.tablero, res.lp.tablero);
  assert.equal(enBase(p.vista.tablero, 'x1'), '9/2');
  assert.equal(enBase(p.vista.tablero, 'x2'), '7/2');
  assert.equal(p.vista.tablero.zval.a.toString(), '63');
  assert.equal(cz(p.vista.tablero), '(0, 0, -28/11, -15/11)');
  const s = txt(p);
  assert.match(s, /x1 = 9\/2/);
  assert.match(s, /x2 = 7\/2/);
  assert.match(s, /Z = 63/);
  assert.match(s, /\(0, 0, -28\/11, -15\/11\)/);
});

test('pasos 6 y 7: se corta x2 (x1 continua se ignora) y la fila sale del tablero', () => {
  assert.match(sin[5].queHago, /x2 = 7\/2 no es entera/);
  assert.match(sin[5].queHago, /x1 es continua/);
  assert.match(sin[6].calculo.join('\n'), /x2 \+ 7\/22·x3 \+ 1\/22·x4 = 7\/2/);
});

test('paso 8: f0 = 1/2 y corte 7/22·x3 + 1/22·x4 ≥ 1/2 (coeficientes del dominio)', () => {
  const p = sin[7];
  assert.equal(c1.f0.toString(), '1/2');
  assert.deepEqual(c1.coefs.map((q) => q.valor.toString()), ['7/22', '1/22']);
  const s = txt(p);
  assert.match(s, /f0 = 1\/2/);
  assert.match(s, /x3 es continua y su coeficiente 7\/22 > 0/);
  assert.match(s, /7\/22·x3 \+ 1\/22·x4 ≥ 1\/2/);
});

test('paso 9: el corte equivale a x2 ≤ 3, con recta y franja eliminada en la gráfica', () => {
  const p = sin[8];
  assert.equal(c1.enOriginales.op, '<=');
  assert.equal(c1.enOriginales.rhs.toString(), '3');
  assert.match(txt(p), /x2 ≤ 3/);
  assert.match(p.calculo.join('\n'), /x3 = 6 \+ x1 - 3x2/);
  assert.match(p.calculo.join('\n'), /x4 = 35 - 7x1 - x2/);
  const g = p.grafica;
  assert.equal(g.rectas.length, 1);
  assert.deepEqual(g.rectas[0].a.map(String), ['0', '1']);
  assert.equal(g.rectas[0].op, '<=');
  assert.equal(g.rectas[0].b.toString(), '3');
  assert.equal(g.rectas[0].etiqueta, 'x2 ≤ 3');
  assert.equal(g.franjas.length, 1);
  // la franja eliminada queda del lado x2 >= 3 y contiene el óptimo de la relajación
  assert.ok(g.franjas[0].every((v) => v.x2.gte(frac(3))));
  assert.ok(g.franjas[0].some((v) => v.x2.eq(frac('7/2'))));
  assert.deepEqual(g.integer, [false, true]);
});

test('paso 10: el corte como ecuación entra con b = -1/2', () => {
  const p = sin[9];
  assert.deepEqual(p.vista.tablero, c1.tableroConCorte);
  assert.match(p.queHago, /-7\/22·x3 - 1\/22·x4 \+ S1 = -1\/2/);
  assert.match(p.porQue, /simplex dual/);
});

test('paso 11: simplex dual, sale S1, razones 8 y 30, entra x3', () => {
  const p = sin[10];
  const it = c1.dual.iteraciones[0];
  assert.deepEqual(p.vista.tablero, it.antes);
  assert.deepEqual(p.vista.pivote, { fila: it.sale, col: it.entra });
  assert.equal(p.vista.tablero.cols[it.entra].nombre, 'x3');
  assert.equal(p.vista.razones.columnas[2], '8');
  assert.equal(p.vista.razones.columnas[3], '30');
  const s = txt(p);
  assert.match(s, /Sale S1/);
  assert.match(s, /x3: \|\(-28\/11\)\/\(-7\/22\)\| = 8/);
  assert.match(s, /x4: \|\(-15\/11\)\/\(-1\/22\)\| = 30/);
  assert.match(s, /Entra x3/);
});

test('paso 12: x2=3, x1=32/7, x3=11/7; Z=59; Cj−Zj=(0,0,0,-1,-8)', () => {
  const p = sin[11];
  assert.deepEqual(p.vista.tablero, c1.dual.tableroDespues);
  assert.equal(enBase(p.vista.tablero, 'x2'), '3');
  assert.equal(enBase(p.vista.tablero, 'x1'), '32/7');
  assert.equal(enBase(p.vista.tablero, 'x3'), '11/7');
  assert.equal(p.vista.tablero.zval.a.toString(), '59');
  assert.equal(cz(p.vista.tablero), '(0, 0, 0, -1, -8)');
  assert.match(txt(p), /\(0, 0, 0, -1, -8\) en \(x1, x2, x3, x4, S1\)/);
});

test('paso 13: óptimo mixto Z=59, x1=32/7≈4,571, x2=3', () => {
  const p = sin[12];
  const ip = solveIP(e1);
  assert.equal(ip.best.z.toString(), '59');
  assert.equal(res.z.toString(), '59');
  assert.deepEqual(res.x.map(String), ['32/7', '3']);
  const s = txt(p);
  assert.match(s, /x1 = 32\/7 ≈ 4,571/);
  assert.match(s, /x2 = 3/);
  assert.match(s, /Z = 59/);
  assert.equal(p.grafica.optimo.x[0].toString(), '32/7');
});

test('paso 14: x1=32/7 y x3=11/7 fraccionarios (4/7 las dos), se corta x1', () => {
  const p = con[13];
  const tA = pura.cortes[1].tableroAntes;
  assert.deepEqual(p.vista.tablero, tA);
  assert.equal(enBase(tA, 'x1'), '32/7');
  assert.equal(enBase(tA, 'x3'), '11/7');
  const s = txt(p);
  assert.match(s, /x1 = 32\/7 y x3 = 11\/7/);
  assert.match(s, /4\/7 las dos/);
  assert.match(s, /Fila fuente: x1/);
});

test('paso 15: fila de x1, corte fraccional 1/7·x4 + 6/7·S1 ≥ 4/7, x1 + x2 ≤ 7, ecuación con S2', () => {
  const p = con[14];
  const c2 = pura.cortes[1];
  assert.equal(c2.f0.toString(), '4/7');
  assert.deepEqual(c2.coefs.map((q) => `${q.nombre}${q.valor}`), ['x41/7', 'S16/7']);
  assert.equal(c2.enOriginales.op, '<=');
  assert.equal(c2.enOriginales.rhs.toString(), '7');
  const s = txt(p);
  assert.match(s, /x1 \+ 1\/7·x4 - 1\/7·S1 = 32\/7/);
  assert.match(s, /1\/7·x4 \+ 6\/7·S1 ≥ 4\/7/);
  assert.match(s, /x1 \+ x2 ≤ 7/);
  assert.match(s, /-1\/7·x4 - 6\/7·S1 \+ S2 = -4\/7/);
  assert.equal(p.grafica.rectas.length, 2);
  assert.equal(p.grafica.rectas[1].etiqueta, 'x1 + x2 ≤ 7');
  assert.equal(p.grafica.franjas.length, 1);
});

test('paso 16: dual, sale S2, razones 7 y 28/3, entra x4', () => {
  const p = con[15];
  const it = pura.cortes[1].dual.iteraciones[0];
  assert.deepEqual(p.vista.tablero, it.antes);
  assert.equal(p.vista.tablero.cols[it.entra].nombre, 'x4');
  assert.equal(p.vista.razones.columnas[3], '7');
  assert.equal(p.vista.razones.columnas[4], '28/3');
  const s = txt(p);
  assert.match(s, /Sale S2/);
  assert.match(s, /x4: \|\(-1\)\/\(-1\/7\)\| = 7/);
  assert.match(s, /S1: \|\(-8\)\/\(-6\/7\)\| = 28\/3/);
  assert.match(s, /Entra x4/);
});

test('paso 17: Z=55, x=(4,3,1,4), Zj y Cj−Zj recalculados, con la nota', () => {
  const p = con[16];
  const tf = pura.tableroFinal;
  assert.deepEqual(p.vista.tablero, tf);
  assert.equal(tf.zval.a.toString(), '55');
  assert.equal(zj(tf), '(7, 9, 0, 0, 2, 7)');
  assert.equal(cz(tf), '(0, 0, 0, 0, -2, -7)');
  const s = txt(p);
  assert.match(s, /x2 = 3, x1 = 4, x3 = 1, x4 = 4; Z = 55/);
  assert.match(s, /Zj = \(7, 9, 0, 0, 2, 7\)/);
  assert.match(s, /Cj−Zj = \(0, 0, 0, 0, -2, -7\)/);
  assert.match(s, /última fila de Zj y Cj−Zj aparece sin actualizar; aquí están recalculadas/);
});

test('ningún paso referencia datos futuros (cortes)', () => {
  // Hasta el paso 11 no aparece el óptimo mixto; hasta el paso 16 no aparece Z = 55.
  sin.slice(0, 11).forEach((p) => {
    const s = txt(p);
    assert.ok(!/32\/7|Z = 59|11\/7/.test(s), `adelanta el resultado en el paso ${p.id}`);
  });
  con.slice(0, 16).forEach((p) => assert.ok(!/Z = 55|x4 = 4/.test(txt(p)), `adelanta la entera pura en el paso ${p.id}`));
  // Hasta el paso 8 no se menciona el corte en originales ni el tablero con S1
  sin.slice(0, 8).forEach((p) => assert.ok(!/x2 ≤ 3(?!\d)|S1/.test(txt(p))));
  // Los tableros mostrados avanzan en el tiempo: el paso k no muestra un tablero de un paso posterior
  const orden = [
    res.tableroInicial, res.lp.iteraciones[0].despues, res.lp.tablero, c1.tableroConCorte, c1.dual.tableroDespues,
  ];
  assert.equal(sin[2].vista.tablero.zval.a.toString(), '0');
  assert.ok(orden.length === 5);
  // Gráfica: la recta del corte no aparece antes del paso 9; el óptimo mixto no aparece antes del 12
  sin.slice(0, 8).forEach((p) => assert.ok(!(p.grafica && p.grafica.rectas && p.grafica.rectas.length)));
  sin.slice(0, 11).forEach((p) => assert.ok(!(p.grafica && p.grafica.optimo)));
});

test('sin continuación no hay pasos 14-17 y con ella el modelo no se modifica', () => {
  const antes = JSON.stringify(e1);
  pasosCortes(e1, { conContinuacionPura: true });
  assert.equal(JSON.stringify(e1), antes);
  assert.deepEqual(e1.integer, [false, true]);
});

test('ramificación e1: 7 pasos con los valores del dominio', () => {
  const ip = solveIP(e1);
  const [n0, n1, n2] = ip.nodes;
  assert.equal(ip.nodes.length, 3);
  assert.match(ram[0].titulo, /Planteamiento/);
  // 2 relajación
  let s = txt(ram[1]);
  assert.match(s, /x1 = 9\/2, x2 = 7\/2/);
  assert.match(s, /Z = 63/);
  assert.match(s, /Z ≤ 63/);
  assert.deepEqual(ram[1].vista, { tipo: 'arbol', hastaId: n0.id, activoId: n0.id });
  // 3 variable
  s = txt(ram[2]);
  assert.match(s, /x2 = 7\/2 debe ser entera/);
  assert.match(s, /x1 es continua/);
  // 4 ramas
  s = txt(ram[3]);
  assert.match(s, /x2 ≤ 3 y x2 ≥ 4/);
  assert.equal(n1.branchBound.toString(), '3');
  assert.equal(n2.branchBound.toString(), '4');
  assert.equal(ram[3].grafica.rectas.length, 2);
  assert.equal(ram[3].grafica.franjas.length, 1);
  // 5 incumbente
  s = txt(ram[4]);
  assert.equal(n1.action, 'incumbent');
  assert.match(s, /x = \(32\/7, 3\)/);
  assert.match(s, /Z = 59/);
  assert.match(s, /incumbente/);
  assert.deepEqual(ram[4].vista, { tipo: 'arbol', hastaId: n1.id, activoId: n1.id });
  // 6 infactible
  s = txt(ram[5]);
  assert.equal(n2.status, 'infeasible');
  assert.match(s, /infactible/);
  assert.match(s, /x1 ≥ 6/);
  assert.match(s, /7x1 ≤ 35 - 1·4 = 31/);
  // 7 conclusión
  s = txt(ram[6]);
  assert.match(s, /Z = 59/);
  assert.match(s, /La rama x2 ≤ 3 es exactamente el corte de Gomory del otro método/);
});

test('ramificación: sin datos futuros y árbol creciente', () => {
  for (const lista of [ram, pasosRamificacion(e2), pasosRamificacion({ sense: 'max', c: ['5', '4'], constraints: [{ a: ['6', '4'], op: '<=', b: '24' }, { a: ['1', '2'], op: '<=', b: '6' }], integer: [false, true] })]) {
    let prev = -1;
    lista.forEach((p) => {
      if (p.vista.tipo !== 'arbol') return;
      assert.ok(p.vista.hastaId >= prev, 'hastaId decrece');
      assert.ok(p.vista.activoId <= p.vista.hastaId);
      prev = p.vista.hastaId;
    });
  }
  ram.slice(0, 4).forEach((p) => assert.ok(!/32\/7|Z = 59|infactible/.test(txt(p).replace(/Z = 63/g, ''))));
  assert.ok(ram.slice(0, 4).every((p) => p.vista.tipo !== 'arbol' || p.vista.hastaId === 0));
});

test('ramificación e2: mismos pasos genéricos', () => {
  const lista = pasosRamificacion(e2);
  const ip = solveIP(e2);
  assert.equal(lista.length, 2 + 2 + ip.nodes.length - 1 + 1);
  assert.match(txt(lista[1]), /x1 = 95\/14, x2 = 10\/7/);
  assert.match(txt(lista[1]), /Z = 325\/14/);
  assert.match(txt(lista.at(-1)), new RegExp(`Z = ${ip.best.z}`));
  assert.equal(ip.best.z.toString(), '23');
});

test('caso de reserva: max 5x1+4x2; 6x1+4x2≤24; x1+2x2≤6; x2 entera', () => {
  const m = {
    sense: 'max', c: ['5', '4'],
    constraints: [{ a: ['6', '4'], op: '<=', b: '24' }, { a: ['1', '2'], op: '<=', b: '6' }],
    integer: [false, true],
  };
  const ip = solveIP(m);
  const lista = pasosRamificacion(m);
  assert.equal(lista.length, 7);
  assert.match(txt(lista[1]), /x1 = 3, x2 = 3\/2/);
  assert.match(txt(lista[1]), /Z = 21/);
  assert.match(txt(lista[3]), /x2 ≤ 1 y x2 ≥ 2/);
  // rama x2 ≤ 1: x=(10/3,1), Z=62/3, incumbente
  assert.match(txt(lista[4]), /x = \(10\/3, 1\)/);
  assert.match(txt(lista[4]), /Z = 62\/3/);
  assert.match(txt(lista[4]), /incumbente/);
  assert.equal(ip.nodes[1].action, 'incumbent');
  // rama x2 ≥ 2 podada por cota con Z = 18
  assert.match(lista[5].titulo, /podada por cota/);
  assert.match(txt(lista[5]), /Z = 18/);
  assert.match(txt(lista[5]), /Incumbente: Z = 62\/3/);
  assert.match(txt(lista[6]), /Z = 62\/3/);
});

test('modelos sin solución o ya enteros no rompen', () => {
  const infact = { sense: 'max', c: ['1', '1'], constraints: [{ a: ['1', '1'], op: '<=', b: '1' }, { a: ['1', '1'], op: '>=', b: '3' }], integer: [false, true] };
  assert.ok(pasosCortes(infact).length >= 1);
  assert.ok(pasosRamificacion(infact).length >= 2);
  const entero = { sense: 'max', c: ['1', '1'], constraints: [{ a: ['1', '1'], op: '<=', b: '4' }], integer: [true, true] };
  assert.equal(pasosRamificacion(entero).length, 3);
  assert.ok(pasosCortes(entero).length >= 5);
});
