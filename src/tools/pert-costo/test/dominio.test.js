import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, armarModelo, costoDirecto, pendiente } from '../domain/modelo.js';
import { tiempos, rutasCriticas } from '../domain/calculo.js';
import { resolver } from '../domain/reducir.js';
import { corteMinimo, corteExhaustivo } from '../domain/corte.js';
import { mulberry32, redAleatoria, puenteAleatorio, curvaPorEnumeracion, duracionBruta } from './utils.mjs';

const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b)), `${msg}: ${a} ≠ ${b}`);

function resolverFilas(filas, ci = 10, opts) {
  const nor = normalizar(filas, { ci: String(ci), fijo: '0' });
  assert.deepEqual(nor.errores, [], 'la red aleatoria debe ser válida');
  const m = armarModelo(nor.actividades, { ci: nor.ci, fijo: nor.fijo });
  return { m, res: resolver(m, opts) };
}

test('pendiente de costo = (CL − CN) / (DN − DL)', () => {
  assert.equal(pendiente({ dn: 10, dl: 6, cn: 100, cl: 180 }), 20);
  assert.equal(pendiente({ dn: 3, dl: 3, cn: 100, cl: 100 }), null);
  assert.equal(pendiente({ dn: 7, dl: 4, cn: 0, cl: 10 }), 10 / 3);
});

test('validación: mensajes y casos límite', () => {
  const base = { name: 'A', preds: '', dn: '4', dl: '2', cn: '10', cl: '30' };
  const err = (filas, p) => normalizar(filas, p ?? { ci: '5' }).errores.map((e) => e.msg).join(' | ');
  assert.match(err([{ ...base, dn: '' }]), /Falta la duración normal/);
  assert.match(err([{ ...base, dn: '4,5' }]), /entero/);
  assert.match(err([{ ...base, dl: '5' }]), /no puede ser mayor/);
  assert.match(err([{ ...base, cl: '5' }]), /no puede ser menor/);
  assert.match(err([{ ...base, dl: '', cl: '30' }]), /juntos/);
  assert.match(err([base, { ...base }]), /repetida/);
  assert.match(err([{ ...base, preds: 'Z' }]), /no existe/);
  assert.match(err([{ ...base, preds: 'A' }]), /sí misma/);
  assert.match(err([{ ...base, preds: 'B' }, { ...base, name: 'B', preds: 'A' }]), /ciclo/);
  assert.match(err([base], { ci: '' }), /costo indirecto/);
  assert.match(err([base], { ci: '-3' }), /no negativo/);
  assert.match(err([]), /al menos una/);
  const ok = normalizar([{ name: 'A', preds: '-', dn: '4', dl: '', cn: '10', cl: '' }], { ci: '5' });
  assert.deepEqual(ok.errores, []);
  assert.equal(ok.actividades[0].dl, 4);
  const aviso = normalizar([{ ...base, dl: '4', cl: '50' }], { ci: '5' });
  assert.equal(aviso.avisos.length, 1);
  // decimales y coma en costos
  const dec = normalizar([{ ...base, cn: '10,5', cl: '30,25' }], { ci: '2,5' });
  assert.deepEqual(dec.errores, []);
  assert.equal(dec.ci, 2.5);
});

test('ejemplo de mano: dos rutas críticas simultáneas', () => {
  // A(4,2: 10→30, pend 10) ; B(5,3: 20→60, pend 20) ; C(5,3: 20→40, pend 10) ; D tras B y C (3, no se acorta)
  const filas = [
    { name: 'A', preds: '', dn: '4', dl: '2', cn: '10', cl: '30' },
    { name: 'B', preds: 'A', dn: '5', dl: '3', cn: '20', cl: '60' },
    { name: 'C', preds: 'A', dn: '5', dl: '3', cn: '20', cl: '40' },
    { name: 'D', preds: 'B,C', dn: '3', dl: '', cn: '15', cl: '' },
  ];
  const { m, res } = resolverFilas(filas, 12, { verificar: true });
  assert.equal(res.T0, 12);
  assert.equal(res.Tmin, 8);
  assert.equal(res.normal.rutas.rutas.length, 2);
  // 12→10: A (pend 10); 10→8: B y C a la vez (30); además A ya está en el límite
  const costos = res.estados.map((e) => e.directo);
  assert.deepEqual(costos.map((c) => Math.round(c)), [65, 75, 85, 115, 145]);
  assert.equal(res.pasos.length, 2);
  assert.deepEqual(res.pasos[0].acortan.map((a) => a.nombre), ['A']);
  assert.deepEqual(res.pasos[1].acortan.map((a) => a.nombre).sort(), ['B', 'C']);
  assert.equal(res.pasos[1].pendiente, 30);
  assert.equal(res.pasos[0].conviene, true); // 10 < 12
  assert.equal(res.pasos[1].conviene, false); // 30 > 12
  // total = directo + 12 T
  assert.equal(res.optimo.T, 10);
  cerca(res.optimo.total, 85 + 120, 'total óptimo');
  assert.deepEqual(res.optimo.empates, [10]);
  assert.equal(costoDirecto(m, m.dn), 65);
});

test('caso con alargue: se recupera el costo de una actividad ya acortada', () => {
  // Búsqueda determinista de una red donde el corte óptimo alarga una actividad
  let visto = 0;
  for (let seed = 1; seed <= 4000 && visto === 0; seed++) {
    const rng = mulberry32(seed);
    const filas = redAleatoria(rng, { nMin: 5, nMax: 8 });
    const { res } = resolverFilas(filas, 10);
    if (res.pasos.some((p) => p.tipo === 'con-alargue')) visto++;
  }
  assert.ok(visto > 0, 'debe existir al menos una red de prueba con alargue');
});

test('el flujo con cotas inferiores coincide con la búsqueda exhaustiva de cortes', () => {
  const rng = mulberry32(777);
  let comparados = 0;
  for (let k = 0; k < 600; k++) {
    // red de 5..9 nodos con flechas hacia adelante; lo ≤ cap y flujo factible garantizado con lo = 0 o lo = cap en caminos
    const n = rng.int(4, 9);
    const flechas = [];
    for (let u = 0; u < n; u++) {
      for (let v = u + 1; v < n; v++) {
        if (rng.next() < 0.4 || v === u + 1) {
          const cap = rng.next() < 0.2 ? Infinity : rng.int(0, 9);
          const lo = Number.isFinite(cap) && rng.next() < 0.3 ? rng.int(0, cap) : 0;
          flechas.push({ u, v, cap, lo });
        }
      }
    }
    let r;
    try { r = corteMinimo(n, flechas, 0, n - 1); } catch { continue; } // sin flujo factible: no aplica
    const ex = corteExhaustivo(n, flechas, 0, n - 1);
    if (Number.isFinite(ex)) { assert.equal(r.infinito, false); cerca(r.costo, ex, `corte k=${k}`); } else assert.equal(r.infinito, true);
    comparados++;
  }
  assert.ok(comparados > 300);
});

function compararConEnumeracion(semillas, opcionesRed, ci, generar = (rng) => redAleatoria(rng, opcionesRed)) {
  let redes = 0;
  let pasosTot = 0;
  const tipos = { una: 0, conjunto: 0, 'con-alargue': 0 };
  for (const seed of semillas) {
    const rng = mulberry32(seed);
    const filas = generar(rng);
    const { m, res } = resolverFilas(filas, ci(rng), { verificar: true });
    const bruto = curvaPorEnumeracion(filas);
    assert.equal(res.T0, bruto.Tmax, `T normal, semilla ${seed}`);
    assert.equal(res.Tmin, bruto.Tmin, `T límite, semilla ${seed}`);
    for (let T = res.T0; T >= res.Tmin; T--) {
      cerca(res.estadoEn(T).directo, bruto.curva.get(T), `costo directo en T=${T}, semilla ${seed}`);
      assert.equal(duracionBruta(filas, res.estadoEn(T).d), T, `duraciones del estado T=${T}, semilla ${seed}`);
      res.estadoEn(T).d.forEach((x, j) => assert.ok(x >= m.dl[j] && x <= m.dn[j], 'duración fuera de [DL, DN]'));
    }
    // el costo total mínimo es el mínimo de la enumeración
    let mejor = Infinity;
    for (let T = res.Tmin; T <= res.T0; T++) mejor = Math.min(mejor, bruto.curva.get(T) + m.ci * T);
    cerca(res.optimo.total, mejor, `costo total óptimo, semilla ${seed}`);
    cerca(res.estadoEn(res.optimo.T).total, mejor, `estado óptimo, semilla ${seed}`);
    // convexidad: la pendiente de la curva no baja al recortar más
    let anterior = -Infinity;
    for (let T = res.T0; T > res.Tmin; T--) {
      const p = res.estadoEn(T - 1).directo - res.estadoEn(T).directo;
      assert.ok(p >= anterior - 1e-7, `curva no convexa, semilla ${seed}`);
      anterior = p;
    }
    // los pasos cubren de T0 a Tmin sin huecos y su costo suma lo mismo
    let t = res.T0;
    let suma = res.normal.directo;
    for (const p of res.pasos) {
      assert.equal(p.desde, t);
      t = p.hasta;
      suma += p.costoAdicional;
      cerca(suma, p.directo, `suma de pasos, semilla ${seed}`);
    }
    assert.equal(t, res.Tmin);
    redes++;
    pasosTot += res.pasos.length;
    res.pasos.forEach((p) => { tipos[p.tipo]++; });
  }
  return { redes, pasosTot, tipos };
}

test('contra la enumeración de todas las duraciones enteras: 3000 redes aleatorias (costos grandes)', () => {
  const sem = Array.from({ length: 3000 }, (_, i) => i + 1);
  const r = compararConEnumeracion(sem, { nMin: 2, nMax: 7, maxRed: 3 }, (rng) => rng.int(0, 90));
  assert.equal(r.redes, 3000);
  assert.ok(r.tipos.conjunto > 100, JSON.stringify(r.tipos));
  console.log('  pasos por tipo:', JSON.stringify(r.tipos));
});

test('contra la enumeración: 3000 redes con costos chicos (muchos empates de corte)', () => {
  const sem = Array.from({ length: 3000 }, (_, i) => 10000 + i);
  const r = compararConEnumeracion(sem, { nMin: 3, nMax: 7, maxRed: 3, costos: 'chicos', pPred: 0.3 }, (rng) => rng.int(0, 5));
  assert.equal(r.redes, 3000);
});

test('contra la enumeración: redes en paralelo, muchas rutas críticas simultáneas', () => {
  const sem = Array.from({ length: 1500 }, (_, i) => 50000 + i);
  const r = compararConEnumeracion(sem, { nMin: 4, nMax: 8, maxRed: 2, costos: 'chicos', pPred: 0.15, pFija: 0.1 }, (rng) => rng.int(0, 4));
  assert.equal(r.redes, 1500);
});

test('contra la enumeración: 3000 redes en puente (aquí el corte alarga actividades ya acortadas)', () => {
  const sem = Array.from({ length: 3000 }, (_, i) => 200000 + i);
  const r = compararConEnumeracion(sem, {}, (rng) => rng.int(0, 40), (rng) => puenteAleatorio(rng, false));
  assert.ok(r.tipos['con-alargue'] >= 40, JSON.stringify(r.tipos));
  const r2 = compararConEnumeracion(sem.slice(0, 1500), {}, (rng) => rng.int(0, 40), (rng) => puenteAleatorio(rng, true));
  assert.ok(r2.tipos['con-alargue'] >= 20, JSON.stringify(r2.tipos));
  console.log('  puente:', JSON.stringify(r.tipos), 'con cola:', JSON.stringify(r2.tipos));
});

test('contra la enumeración: redes con más precedencias y más actividades (hasta 9, reducción 1)', () => {
  const sem = Array.from({ length: 400 }, (_, i) => 90000 + i);
  const r = compararConEnumeracion(sem, { nMin: 7, nMax: 9, maxRed: 1, costos: 'grandes', pPred: 0.5, pFija: 0.1 }, (rng) => rng.int(0, 60));
  assert.equal(r.redes, 400);
});

test('costos con decimales (pendientes fraccionarias) siguen coincidiendo con la enumeración', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rng = mulberry32(seed + 700000);
    const filas = redAleatoria(rng, { nMin: 3, nMax: 7, maxRed: 3 });
    // pendientes del tipo 7/3: el costo límite se vuelve decimal
    filas.forEach((f) => { f.cl = String(Number(f.cl) + 0.37 * (Number(f.dn) - Number(f.dl) > 0 ? 1 : 0)); });
    const { res } = resolverFilas(filas, 17.5, { verificar: true });
    const bruto = curvaPorEnumeracion(filas);
    for (let T = res.T0; T >= res.Tmin; T--) cerca(res.estadoEn(T).directo, bruto.curva.get(T), `T=${T}, semilla ${seed}`);
  }
});

test('el modelo AON y la red de la herramienta de ruta crítica dan la misma duración en cada estado', async () => {
  const { buildNetwork } = await import('../../ruta-critica/domain/network.js');
  const { computeTimes } = await import('../../ruta-critica/domain/cpm.js');
  const { topoNodes } = await import('../../ruta-critica/domain/network.js');
  for (let seed = 1; seed <= 800; seed++) {
    const rng = mulberry32(seed + 31000);
    const filas = redAleatoria(rng, { nMin: 2, nMax: 9, maxRed: 3, pPred: 0.4 });
    const { m, res } = resolverFilas(filas, 8);
    const net = buildNetwork(m.actividades.map((a) => ({ name: a.name, preds: a.preds })));
    const orden = topoNodes(net);
    for (const e of [res.estadoEn(res.T0), res.estadoEn(res.Tmin), res.estadoEn(res.optimo.T)]) {
      const tmAOA = computeTimes(net, orden, (nombre) => e.d[m.names.indexOf(nombre)]);
      assert.equal(tmAOA.T, e.T, `red AOA y AON difieren, semilla ${seed}`);
      // las actividades críticas también coinciden
      const tm = tiempos(m, e.d);
      for (const ed of net.edges.filter((x) => x.kind === 'activity')) {
        const j = m.names.indexOf(ed.act);
        assert.equal(tmAOA.edgeInfo[ed.id].critical, tm.critica[j], `actividad ${ed.act} crítica, semilla ${seed}`);
      }
    }
  }
});

test('rutas críticas: una ruta por camino crítico', () => {
  const filas = [
    { name: 'A', preds: '', dn: '3', dl: '3', cn: '1', cl: '1' },
    { name: 'B', preds: '', dn: '3', dl: '3', cn: '1', cl: '1' },
    { name: 'C', preds: 'A,B', dn: '2', dl: '2', cn: '1', cl: '1' },
    { name: 'D', preds: '', dn: '1', dl: '1', cn: '1', cl: '1' },
  ];
  const nor = normalizar(filas, { ci: '0' });
  const m = armarModelo(nor.actividades, {});
  const r = rutasCriticas(m, tiempos(m, m.dn));
  assert.deepEqual(r.rutas.map((x) => x.join('-')).sort(), ['A-C', 'B-C']);
});

test('límites: duración límite nula, sin actividades acortables y proyecto de una sola actividad', () => {
  const sola = resolverFilas([{ name: 'A', preds: '', dn: '5', dl: '2', cn: '10', cl: '40' }], 15, { verificar: true });
  assert.equal(sola.res.T0, 5);
  assert.equal(sola.res.Tmin, 2);
  assert.equal(sola.res.pasos.length, 1);
  assert.equal(sola.res.pasos[0].pendiente, 10);
  assert.equal(sola.res.optimo.T, 2); // 10 < 15: conviene llegar al límite
  const fija = resolverFilas([{ name: 'A', preds: '', dn: '5', dl: '', cn: '10', cl: '' }, { name: 'B', preds: 'A', dn: '2', dl: '', cn: '5', cl: '' }], 3);
  assert.equal(fija.res.pasos.length, 0);
  assert.equal(fija.res.optimo.T, 7);
  const cero = resolverFilas([{ name: 'A', preds: '', dn: '4', dl: '0', cn: '0', cl: '8' }], 1, { verificar: true });
  assert.equal(cero.res.Tmin, 0);
  assert.equal(cero.res.pasos[0].pendiente, 2);
});

test('empates: si la pendiente iguala el costo indirecto, el costo total no cambia', () => {
  const filas = [{ name: 'A', preds: '', dn: '6', dl: '2', cn: '10', cl: '50' }]; // pendiente 10
  const { res } = resolverFilas(filas, 10);
  assert.deepEqual(res.optimo.empates, [6, 5, 4, 3, 2]);
  assert.equal(res.optimo.T, 6);
  assert.equal(res.pasos[0].empata, true);
  assert.equal(res.pasos[0].conviene, false);
});

test('rendimiento: 40 actividades y duraciones de cientos de unidades', () => {
  const rng = mulberry32(5);
  const filas = [];
  for (let j = 0; j < 40; j++) {
    const preds = [];
    for (let i = Math.max(0, j - 4); i < j; i++) if (rng.next() < 0.4) preds.push(String.fromCharCode(65 + i % 26) + (i >= 26 ? '2' : ''));
    const nombre = String.fromCharCode(65 + j % 26) + (j >= 26 ? '2' : '');
    const dn = rng.int(20, 60);
    filas.push({ name: nombre, preds: preds.join(','), dn: String(dn), dl: String(dn - rng.int(0, 15)), cn: '100', cl: String(100 + rng.int(10, 400)) });
  }
  const t0 = Date.now();
  const { res } = resolverFilas(filas, 30, { verificar: false });
  assert.ok(Date.now() - t0 < 8000, 'tarda demasiado');
  assert.ok(res.estados.length > 10);
});
