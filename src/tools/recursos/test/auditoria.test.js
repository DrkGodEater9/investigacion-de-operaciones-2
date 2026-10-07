import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { compilar, cpm } from '../domain/cpm.js';
import { perfil, resumen, sumaCuadrados, cotaInferior } from '../domain/perfil.js';
import { nivelar } from '../domain/nivelar.js';
import { asignar, REGLAS } from '../domain/asignar.js';
import { EJEMPLOS } from '../domain/ejemplos.js';
import { validarModelo, parseMarkdown } from '../domain/modelo.js';
import { pasosAsignar, pasosNivelar } from '../domain/pasos.js';
import { generarEjercicio, TIPOS } from '../domain/generador.js';
import { rangoPeriodos } from '../domain/format.js';
import { mulberry32, modeloAleatorio, cpmIndep, verificar, asignarIndep, aMapa, usoEnPeriodo } from './utils.mjs';

// exportar.js importa '@/shared/files.js' (alias de Vite): se resuelve con un hook mínimo.
const SRC = pathToFileURL(fileURLToPath(new URL('../../../', import.meta.url))).href;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, n) { if (s.startsWith('@/')) return n(${JSON.stringify(SRC)} + s.slice(2), c); return n(s, c); }`,
));
const X = await import('../utils/exportar.js');

const LETRAS = 'ABCDEFGH';
/** Modelo pequeño de un recurso para búsquedas exhaustivas. */
function chico(rng, n = rng.int(3, 6)) {
  const acts = Array.from({ length: n }, (_, i) => ({
    name: LETRAS[i], d: rng.int(1, 3), preds: [...LETRAS.slice(0, i)].filter(() => rng.next() < 0.3), r: [rng.int(1, 5)],
  }));
  return { recursos: [{ name: 'R', limite: null }], acts };
}

/** Σ uso² mínimo sobre TODOS los cronogramas con comienzos en [ES, LS] y precedencias (duración fija). */
function optimoNivelacion(red) {
  const b = cpm(red);
  const s = new Array(red.n).fill(0);
  let best = Infinity;
  (function rec(k) {
    if (k === red.n) { best = Math.min(best, sumaCuadrados(perfil(red, s, b.T))); return; }
    const i = red.orden[k];
    const lo = red.preds[i].length ? Math.max(...red.preds[i].map((p) => s[p] + red.d[p])) : 0;
    for (let x = lo; x <= b.LS[i]; x++) { s[i] = x; rec(k + 1); }
  }(0));
  return best;
}

/** Duración mínima con límite (búsqueda exhaustiva de comienzos, en orden topológico). */
function optimoDuracion(red, lim) {
  const H = red.d.reduce((a, b) => a + b, 0);
  const s = new Array(red.n).fill(0);
  const uso = new Array(H + 1).fill(0);
  let best = H;
  (function rec(k, fin) {
    if (fin >= best) return;
    if (k === red.n) { best = fin; return; }
    const i = red.orden[k];
    const lo = red.preds[i].length ? Math.max(...red.preds[i].map((p) => s[p] + red.d[p])) : 0;
    for (let x = lo; x + red.d[i] < best; x++) {
      let ok = true;
      for (let t = x; t < x + red.d[i]; t++) if (uso[t] + red.r[i][0] > lim) { ok = false; break; }
      if (!ok) continue;
      for (let t = x; t < x + red.d[i]; t++) uso[t] += red.r[i][0];
      s[i] = x;
      rec(k + 1, Math.max(fin, x + red.d[i]));
      for (let t = x; t < x + red.d[i]; t++) uso[t] -= red.r[i][0];
    }
  }(0, 0));
  return best;
}

test('nivelación: el pico de cada recurso nunca sube y Σ uso² nunca empeora (reproducciones que antes subían el pico)', () => {
  const casos = [
    [{ name: 'A', d: 3, preds: [], r: [1] }, { name: 'B', d: 3, preds: [], r: [3] }, { name: 'C', d: 3, preds: [], r: [2] }, { name: 'D', d: 1, preds: ['C'], r: [3] }, { name: 'E', d: 2, preds: ['A'], r: [1] }],
    [{ name: 'A', d: 3, preds: [], r: [3] }, { name: 'B', d: 2, preds: ['A'], r: [1] }, { name: 'C', d: 1, preds: ['A', 'B'], r: [1] }, { name: 'D', d: 2, preds: ['A'], r: [3] }, { name: 'E', d: 2, preds: [], r: [4] }],
  ];
  for (const acts of casos) {
    const red = compilar({ recursos: [{ name: 'R', limite: null }], acts });
    const b = cpm(red);
    const antes = resumen(red, b.ES).porRecurso[0].pico;
    const r = nivelar(red);
    assert.ok(resumen(red, r.starts, b.T).porRecurso[0].pico <= antes);
    assert.ok(r.objetivoDespues <= r.objetivoAntes);
  }
  const rng = mulberry32(2024);
  for (let i = 0; i < 4000; i++) {
    const m = modeloAleatorio(rng);
    const red = compilar(m);
    const b = cpm(red);
    const r = nivelar(red);
    const e = resumen(red, b.ES);
    const l = resumen(red, r.starts, b.T);
    l.porRecurso.forEach((p, k) => assert.ok(p.pico <= e.porRecurso[k].pico, `pico sube en ${JSON.stringify(m)}`));
    assert.equal(r.objetivoDespues, sumaCuadrados(perfil(red, r.starts, b.T)), 'objetivo incremental = recalculado');
    assert.ok(r.objetivoDespues <= r.objetivoAntes);
    assert.deepEqual(verificar({ ...m, recursos: m.recursos.map((x) => ({ ...x, limite: null })) }, aMapa(red, r.starts)), []);
    assert.deepEqual(nivelar(red).starts, r.starts, 'determinista');
  }
});

test('nivelación vs óptimo exhaustivo: nunca mejor que el óptimo y lo acierta la mayoría de las veces', () => {
  const rng = mulberry32(99);
  let n = 0; let optimos = 0;
  for (let i = 0; i < 600; i++) {
    const red = compilar(chico(rng));
    const r = nivelar(red);
    const o = optimoNivelacion(red);
    assert.ok(r.objetivoDespues >= o, 'la heurística no puede superar al óptimo');
    assert.ok(o <= r.objetivoAntes);
    n += 1; if (r.objetivoDespues === o) optimos += 1;
  }
  assert.ok(optimos / n > 0.6, `la heurística debería acertar el óptimo con frecuencia (${optimos}/${n})`);
});

test('asignación: duración ≥ óptimo exhaustivo ≥ cota inferior (la cota lo es de verdad)', () => {
  const rng = mulberry32(555);
  for (let i = 0; i < 500; i++) {
    const m = chico(rng);
    const mx = Math.max(...m.acts.map((a) => a.r[0]));
    m.recursos[0].limite = rng.int(mx, mx + 4);
    const red = compilar(m);
    const o = optimoDuracion(red, m.recursos[0].limite);
    const cota = cotaInferior(red, cpm(red).T);
    assert.ok(cota <= o, `cota ${cota} > óptimo ${o}`);
    for (const regla of REGLAS) {
      const r = asignar(red, { regla: regla.id });
      assert.ok(r.T >= o, 'una heurística no puede ser mejor que el óptimo');
      assert.ok(r.T >= cota && r.cota === cota);
      assert.deepEqual(verificar(m, aMapa(red, r.starts)), []);
    }
  }
});

test('asignación con tres recursos: factible y igual al método independiente', () => {
  const rng = mulberry32(8080);
  for (let i = 0; i < 1500; i++) {
    const n = rng.int(2, 8);
    const K = 3;
    const acts = Array.from({ length: n }, (_, j) => ({ name: LETRAS[j], d: rng.int(1, 4), preds: [...LETRAS.slice(0, j)].filter(() => rng.next() < 0.25), r: Array.from({ length: K }, () => rng.int(0, 4)) }));
    const recursos = Array.from({ length: K }, (_, k) => ({ name: 'R' + k, limite: rng.int(Math.max(...acts.map((a) => a.r[k])), 8) }));
    const m = { recursos, acts };
    const red = compilar(m);
    for (const regla of REGLAS) {
      const r = asignar(red, { regla: regla.id });
      assert.ok(r.ok);
      assert.deepEqual(verificar(m, aMapa(red, r.starts)), []);
      assert.deepEqual(aMapa(red, r.starts), asignarIndep(m, regla.id));
    }
  }
});

test('cifras de Teoría.jsx coinciden con el dominio', () => {
  const r1 = compilar(EJEMPLOS[0].modelo);
  const b1 = cpm(r1);
  const n1 = nivelar(r1);
  assert.equal(b1.T, 7);
  assert.deepEqual(resumen(r1, b1.ES).uso[0], [11, 9, 5, 4, 2, 2, 1]);
  assert.deepEqual(resumen(r1, n1.starts, b1.T).uso[0], [6, 6, 5, 4, 6, 2, 5]);
  assert.equal(n1.T, 7);
  const movidas = r1.nombres.map((nm, i) => (n1.starts[i] !== b1.ES[i] ? `${nm} ${b1.ES[i]}->${n1.starts[i]}` : null)).filter(Boolean);
  assert.deepEqual(movidas, ['B 0->4', 'F 4->5', 'G 1->6']);
  const r2 = compilar(EJEMPLOS[1].modelo);
  const b2 = cpm(r2);
  assert.equal(b2.T, 8);
  assert.deepEqual(resumen(r2, b2.ES).uso[0], [12, 12, 12, 8, 7, 7, 7, 3]);
  assert.deepEqual(r2.nombres.filter((_, i) => b2.critica[i]), ['B', 'F']);
  const a = asignar(r2, { regla: 'holgura' });
  assert.equal(a.T, 10);
  assert.equal(asignar(r2, { regla: 'lf' }).T, 9);
  assert.equal(a.cota, 8);
  assert.deepEqual([b2.H[0], b2.H[2], b2.LS[0], b2.LS[2]], [1, 1, 1, 1]); // A y C empatan en holgura y en LS
  assert.equal(a.starts[2], 3); // C empieza en el tiempo 3 = período 4
  assert.equal(rangoPeriodos(0, 3), 'períodos 1 a 3');
});

test('modelo: enteros obligatorios; una actividad llamada «Max» no es la fila de límites', () => {
  const base = () => ({ recursos: [{ name: 'R', limite: 5 }], acts: [{ name: 'A', d: 2, preds: [], r: [1] }] });
  assert.deepEqual(validarModelo(base()).errores, []);
  let m = base(); m.acts[0].d = 0; assert.ok(validarModelo(m).errores.length);
  m = base(); m.acts[0].d = 1.5; assert.ok(validarModelo(m).errores.length);
  m = base(); m.acts[0].r = [-1]; assert.ok(validarModelo(m).errores.length);
  m = base(); m.acts[0].r = []; assert.ok(validarModelo(m).errores.length);
  m = base(); m.recursos[0].limite = 2.5; assert.ok(validarModelo(m).errores.length);
  const p = parseMarkdown('| Actividad | Duración | Predecesoras | R |\n|---|---|---|---|\n| Max | 2 | - | 3 |\n| B | 1 | Max | 1 |\n| Límite | | | 4 |');
  assert.deepEqual(p.errores, []);
  assert.deepEqual(p.modelo.acts.map((a) => a.name), ['Max', 'B']);
  assert.equal(p.modelo.recursos[0].limite, 4);
  const d0 = parseMarkdown('| Actividad | Duración | Predecesoras | R |\n|---|---|---|---|\n| A | 0 | - | 3 |');
  assert.ok(d0.errores.length && d0.modelo === null);
});

test('pasos de la asignación: lo que dicen período por período coincide con la simulación independiente', () => {
  const rng = mulberry32(4242);
  for (let i = 0; i < 400; i++) {
    const m = modeloAleatorio(rng, { conLimite: 'factible' });
    const red = compilar(m);
    for (const regla of REGLAS) {
      const ini = asignarIndep(m, regla.id);
      const { ok, pasos } = pasosAsignar(red, regla.id);
      assert.ok(ok);
      for (const p of pasos.filter((x) => /^Período \d+$/.test(x.titulo))) {
        const t = Number(p.titulo.split(' ')[1]) - 1;
        const empiezan = m.acts.filter((a) => ini[a.name] === t).map((a) => a.name);
        const mm = /Empiezan: ([^.]*)\./.exec(p.texto);
        const dicho = mm ? mm[1].split(/, | y /).filter(Boolean) : [];
        assert.deepEqual([...dicho].sort(), [...empiezan].sort(), `${regla.id} período ${t + 1}`);
        const ult = p.calculo[p.calculo.length - 1];
        m.recursos.forEach((rec, k) => assert.ok(ult.includes(`${rec.name} ${usoEnPeriodo(m, ini, k, t + 1)} de ${rec.limite}`), ult));
      }
    }
    pasosNivelar(red); // no lanza
  }
});

test('generador: 3000 semillas por tipo; convención de períodos, desempate explícito y respuesta única', () => {
  for (const tipo of TIPOS) {
    for (let s = 1; s <= 3000; s++) {
      const e = generarEjercicio(tipo, s);
      assert.ok(e.enunciado.includes('s + 1 a s + d'), 'convención de períodos');
      assert.deepEqual(validarModelo(e.modelo).errores, []);
      if (tipo !== 'retraso' && tipo !== 'duracion') continue;
      assert.ok(/desempata por menor LS/.test(e.enunciado) && /sin límite de recursos/.test(e.enunciado) && /no se interrumpe/.test(e.enunciado));
      const m = e.modelo;
      const c = cpmIndep(m);
      const ini = asignarIndep(m, e.regla);
      if (tipo === 'duracion') {
        assert.equal(e.respuesta, Math.max(...m.acts.map((a) => ini[a.name] + a.d)));
      } else {
        const t0 = e.extra.periodo - 1;
        const dur = (nm) => m.acts.find((x) => x.name === nm).d;
        const el = m.acts.filter((a) => ini[a.name] >= t0 && a.preds.every((p) => ini[p] + dur(p) <= t0));
        const clave = (a) => ({ holgura: c.H[a.name], ls: c.LS[a.name], lf: c.LS[a.name] + a.d, duracion: -a.d, demanda: -a.r[0] })[e.regla];
        const claves = el.map(clave);
        assert.equal(new Set(claves).size, claves.length, 'sin empates en la clave principal');
        assert.ok(el.some((a) => a.name === e.respuesta && ini[a.name] > t0), 'la retrasada realmente no empieza en ese período');
      }
    }
  }
});

test('exportar.js: funciones puras y consistentes con el dominio', () => {
  const armar = (modelo, metodo, regla = 'holgura') => {
    const red = compilar(modelo);
    const base = cpm(red);
    const antes = resumen(red, base.ES);
    let despues = null; let error = null; let detalle = null;
    if (metodo === 'nivelar') { const r = nivelar(red); despues = { starts: r.starts, T: r.T, resumen: resumen(red, r.starts, Math.max(base.T, r.T)) }; }
    else { const r = asignar(red, { regla }); if (!r.ok) error = r.mensaje; else { detalle = r; despues = { starts: r.starts, T: r.T, resumen: resumen(red, r.starts) }; } }
    return { red, base, antes, despues, error, horizonte: Math.max(base.T, despues ? despues.T : 0), metodo, regla, detalle };
  };
  for (const e of EJEMPLOS) for (const metodo of ['nivelar', 'asignar']) for (const regla of REGLAS.map((r) => r.id)) {
    const a = armar(e.modelo, metodo, regla);
    const copia = JSON.stringify(a);
    const l1 = X.lineasResultado(a);
    const t1 = X.tablaActividades(a);
    const t2 = X.tablaHistograma(a);
    assert.equal(JSON.stringify(a), copia, 'no muta su entrada');
    assert.deepEqual(X.lineasResultado(a), l1);
    assert.equal(t1.rows.length, a.red.n);
    t1.rows.forEach((r) => assert.equal(r.length, t1.headers.length));
    assert.equal(t2.rows.length, a.horizonte);
    t2.rows.forEach((r) => assert.equal(r.length, t2.headers.length));
    t2.rows.forEach((r, t) => assert.equal(r[0], t + 1));
    if (a.error) assert.ok(l1.some((x) => /no cabe/.test(x)));
    else {
      assert.ok(l1.some((x) => x.startsWith(`Duración resultante: ${a.despues.T} `)));
      t2.rows.forEach((r, t) => assert.equal(r[2], a.despues.resumen.uso[0][t] ?? 0));
    }
  }
  assert.equal(X.plano('x₁ Σ → ≤ −'), 'x1 suma de -> <= -');
});

test('recursos sin uso (todo 0) y límite 0', () => {
  const m = { recursos: [{ name: 'R', limite: 0 }], acts: [{ name: 'A', d: 2, preds: [], r: [0] }, { name: 'B', d: 1, preds: ['A'], r: [0] }] };
  const red = compilar(m);
  assert.equal(asignar(red).T, 3);
  assert.equal(nivelar(red).T, 3);
  assert.deepEqual(resumen(red, cpm(red).ES).porRecurso[0].periodosPico, []);
});
