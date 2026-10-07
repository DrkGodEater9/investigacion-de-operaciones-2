/**
 * Generador y corrector de la pestaña «Práctica» del tema 3.2 (análisis del tiempo).
 * Funciones puras, sin React ni DOM. Cada ejercicio es JSON y se regenera igual con la misma semilla.
 *
 *   {
 *     id, tipo, seed, titulo, contexto, enunciado, pregunta,
 *     modo: 'cpm' | 'pert' | 'act',          // 'act': una sola actividad (te, varianza)
 *     datos: { acts: [{ name, preds, d | a,m,b }], ...campos del tipo },
 *     entrada: { tipo: 'numero' | 'multi', opciones?, tol?, unidad? },
 *     solucion, explicacion, solucionDetallada
 *   }
 *
 * corregir() NO confía en `solucion`: recalcula con datos (tiempos.js), así sirven ejercicios armados a mano.
 *   tiempo        datos { acts, act, pide: 'tic'|'tfc'|'til'|'tfl' }                -> número
 *   holgura       datos { acts, act, pide: 'ht'|'hl' }                                -> número
 *   duracion      datos { acts }                                                      -> número
 *   ruta          datos { acts }; entrada.opciones = nombres                           -> arreglo de índices (actividades críticas)
 *   te            datos { acts: [{ name, a, m, b }] }                                 -> número (tol 0,02)
 *   varianza      datos { acts: [{ name, a, m, b }] }                                 -> número (tol 0,01)
 *   pertProyecto  datos { acts (a,m,b), pide: 'Te'|'var'|'sd' }                       -> número (tol 0,05)
 *   probabilidad  datos { acts (a,m,b), plazo }                                       -> porcentaje (tol 0,6 puntos)
 */
import { analyze } from './analyze.js';
import { calcularTiempos, calcularPERT, tiempoEsperado, varianzaAct } from './tiempos.js';
import { phi } from './normal.js';
import { fmt } from './format.js';
import { NOT, NOMBRE } from './notacion.js';

export const TIPOS = ['tiempo', 'holgura', 'duracion', 'ruta', 'te', 'varianza', 'pertProyecto', 'probabilidad'];
export const TOL_PROB = 0.6; // puntos porcentuales: cubre redondear Z a dos decimales, como en la tabla normal
const TOL = { te: 0.02, varianza: 0.01, pertProyecto: 0.05 };

const f = (x) => fmt(x, 2).replace('-', '−');
const f4 = (x) => fmt(x, 4).replace('-', '−');
const lista = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/** Generador pseudoaleatorio con semilla (mulberry32). */
export function mulberry32(seed) {
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
  return { next, int, pick };
}

const CONTEXTOS = [
  'la construcción de una bodega', 'el montaje de una feria empresarial', 'el lanzamiento de un producto',
  'la adecuación de un laboratorio', 'la migración de un sistema de información', 'la apertura de una sucursal',
  'la organización de un congreso', 'el mantenimiento de una planta',
];
const NOMBRES = 'ABCDEFGHIJ';

/** Red aleatoria: sin predecesoras redundantes. */
function redAleatoria(rng, n) {
  const names = NOMBRES.slice(0, n).split('');
  const preds = [];
  const anc = [];
  const nIni = n >= 6 ? rng.int(1, 3) : rng.int(1, 2);
  for (let i = 0; i < n; i++) {
    let ps = [];
    if (i >= nIni) {
      const k = rng.next() < 0.5 ? 1 : rng.next() < 0.75 ? 2 : 3;
      const cand = names.slice(0, i).map((_, j) => j);
      while (ps.length < Math.min(k, cand.length)) {
        // prefiere predecesoras recientes: la red queda más encadenada
        const j = cand[Math.max(0, cand.length - 1 - Math.floor(rng.next() * rng.next() * cand.length))];
        if (!ps.includes(j)) ps.push(j);
      }
      // reducción transitiva: se quita la predecesora que ya es ancestro de otra
      ps = ps.filter((p) => !ps.some((q) => q !== p && anc[q].has(p)));
    }
    const a = new Set();
    ps.forEach((p) => { a.add(p); anc[p].forEach((x) => a.add(x)); });
    anc.push(a);
    preds.push(ps.sort((x, y) => x - y).map((j) => names[j]));
  }
  return names.map((name, i) => ({ name, preds: preds[i] }));
}
const triple = (rng) => {
  const a = rng.int(1, 8);
  const m = a + rng.int(1, 5);
  const b = m + rng.int(1, 7);
  return { a, m, b };
};
const redCPM = (rng, n) => redAleatoria(rng, n).map((x) => ({ ...x, d: rng.int(2, 12) }));
const redPERT = (rng, n) => redAleatoria(rng, n).map((x) => ({ ...x, ...triple(rng) }));

const durCPM = (acts) => { const m = new Map(acts.map((a) => [a.name, a.d])); return (n) => m.get(n); };
const tCPM = (acts) => calcularTiempos(acts, durCPM(acts));

const tablaTexto = (acts, pert) =>
  acts.map((a) => `${a.name}: ${pert ? `a=${a.a}, m=${a.m}, b=${a.b}` : `d=${a.d}`}; predecesoras ${a.preds.join(', ') || '-'}`).join('\n');

function filaTexto(x) {
  return `${x.name}: ${NOT.tic} ${f(x.tic)}, ${NOT.tfc} ${f(x.tfc)}, ${NOT.til} ${f(x.til)}, ${NOT.tfl} ${f(x.tfl)}, ${NOT.ht} ${f(x.ht)}, ${NOT.hl} ${f(x.hl)}${x.critica ? ' (crítica)' : ''}`;
}

/** Texto del cálculo de un valor de una actividad, con los números del ejercicio. */
function explicarValor(r, n, pide) {
  const F = r.fila;
  const x = F[n];
  const dd = `d(${n})`;
  switch (pide) {
    case 'tic':
      return x.preds.length
        ? `${NOT.tic}(${n}) = ${x.preds.length > 1 ? `máx[ ${x.preds.map((p) => `${NOT.tfc}(${p}) = ${f(F[p].tfc)}`).join(', ')} ]` : `${NOT.tfc}(${x.preds[0]})`} = ${f(x.tic)}. Empieza cuando termina la última predecesora.`
        : `${NOT.tic}(${n}) = 0, porque ${n} no tiene predecesoras.`;
    case 'tfc':
      return `${NOT.tfc}(${n}) = ${NOT.tic} + ${dd} = ${f(x.tic)} + ${f(x.d)} = ${f(x.tfc)}.`;
    case 'tfl':
      return x.sucs.length
        ? `${NOT.tfl}(${n}) = ${x.sucs.length > 1 ? `mín[ ${x.sucs.map((s) => `${NOT.til}(${s}) = ${f(F[s].til)}`).join(', ')} ]` : `${NOT.til}(${x.sucs[0]})`} = ${f(x.tfl)}. Debe terminar a tiempo para la primera sucesora que arranque.`
        : `${NOT.tfl}(${n}) = ${NOT.T} = ${f(r.T)}, porque ${n} no tiene sucesoras.`;
    case 'til':
      return `${NOT.til}(${n}) = ${NOT.tfl} − ${dd} = ${f(x.tfl)} − ${f(x.d)} = ${f(x.til)}.`;
    case 'ht':
      return `${NOT.ht}(${n}) = ${NOT.til} − ${NOT.tic} = ${f(x.til)} − ${f(x.tic)} = ${f(x.ht)}.`;
    case 'hl':
      return x.sucs.length
        ? `${NOT.hl}(${n}) = mín ${NOT.tic} de las sucesoras − ${NOT.tfc} = ${f(Math.min(...x.sucs.map((s) => F[s].tic)))} − ${f(x.tfc)} = ${f(x.hl)}.`
        : `${NOT.hl}(${n}) = ${NOT.T} − ${NOT.tfc} = ${f(r.T)} − ${f(x.tfc)} = ${f(x.hl)}.`;
    default:
      return '';
  }
}

const todas_hl = (r, permitidas) => r.orden.some((n) => r.fila[n].sucs.length && permitidas.has(n));
const nombrePide = (p) => `${NOT[p]} (${NOMBRE[p]})`;

/** Elige una actividad con cierto interés (con predecesoras o sucesoras según lo que se pregunta). */
/**
 * Actividades cuya holgura libre es la misma por la definición (mín TIC de las sucesoras − TFC) y en la
 * red de flechas de «Resuelve el tuyo» (tiempo del evento j − TFC). Con ficticias pueden diferir; esos
 * casos no se preguntan para que la respuesta no dependa del método.
 */
export function holguraLibreSinAmbiguedad(acts, r) {
  const rows = acts.map((a) => ({ name: a.name, preds: a.preds.join(',') || '-', d: String(a.d), a: '', m: '', b: '' }));
  const an = analyze({ rows, mode: 'cpm', decimals: 2 });
  if (!an.ok) return new Set();
  const ok = new Set();
  for (const e of an.net.edges) {
    if (e.kind !== 'activity') continue;
    if (Math.abs(an.times.edgeInfo[e.id].hl - r.fila[e.act].hl) < 1e-9) ok.add(e.act);
  }
  return ok;
}

function elegirAct(rng, r, pide, permitidas) {
  const todas = r.orden;
  let cand = todas;
  if (pide === 'tic') cand = todas.filter((n) => r.fila[n].preds.length);
  if (pide === 'tfl') cand = todas.filter((n) => r.fila[n].sucs.length);
  if (pide === 'hl') cand = todas.filter((n) => r.fila[n].sucs.length && permitidas.has(n));
  if (!cand.length) cand = todas;
  return rng.pick(cand);
}

function armarPERT(rng, n) {
  // Rutas críticas únicas: así la varianza del proyecto no depende de un criterio de desempate.
  for (let i = 0; i < 400; i++) {
    const acts = redPERT(rng, n);
    const r = calcularPERT(acts);
    if (r.unicaRuta) return { acts, r };
  }
  throw new Error('no se pudo armar una red PERT con ruta crítica única');
}

export function generarEjercicio(tipo, seed) {
  if (!TIPOS.includes(tipo)) throw new Error(`Tipo de ejercicio desconocido: ${tipo}`);
  const rng = mulberry32(seed * 7919 + TIPOS.indexOf(tipo) * 104729 + 13);
  const contexto = rng.pick(CONTEXTOS);
  const ej = { id: `${tipo}-${seed}`, tipo, seed, contexto };

  if (tipo === 'te' || tipo === 'varianza') {
    const t = triple(rng);
    const act = { name: rng.pick(NOMBRES.split('')), preds: [], ...t };
    const te = tiempoEsperado(t.a, t.m, t.b);
    const v = varianzaAct(t.a, t.b);
    Object.assign(ej, {
      titulo: tipo === 'te' ? 'Tiempo esperado (PERT)' : 'Varianza de una actividad (PERT)',
      modo: 'act',
      datos: { acts: [act] },
      enunciado: `En ${contexto}, la actividad ${act.name} tiene un tiempo optimista de ${t.a} días, uno más probable de ${t.m} y uno pesimista de ${t.b}.`,
      pregunta: tipo === 'te' ? `¿Cuál es el tiempo esperado ${NOT.te} de ${act.name}, en días? (dos decimales)` : `¿Cuál es la varianza ${NOT.v} de ${act.name}? (dos decimales)`,
      entrada: { tipo: 'numero', tol: TOL[tipo], unidad: tipo === 'te' ? 'días' : '' },
      solucion: tipo === 'te' ? te : v,
      explicacion: tipo === 'te'
        ? `${NOT.te} = (a + 4m + b) / 6 = (${t.a} + 4·${t.m} + ${t.b}) / 6 = ${f(t.a + 4 * t.m + t.b)} / 6 = ${f4(te)} días.`
        : `${NOT.v} = ((b − a) / 6)² = ((${t.b} − ${t.a}) / 6)² = (${f4((t.b - t.a) / 6)})² = ${f4(v)}.`,
    });
    return ej;
  }

  if (tipo === 'pertProyecto' || tipo === 'probabilidad') {
    const { acts, r } = armarPERT(rng, rng.int(5, 7));
    ej.modo = 'pert';
    ej.datos = { acts };
    const sumas = r.ruta.map((n) => f4(r.por.get(n).v)).join(' + ');
    const base = `${r.ruta.join(' → ')}`;
    const detalle = `Los ${NOT.te} son ${acts.map((a) => `${a.name} = ${f(r.por.get(a.name).te)}`).join(', ')}. La ruta crítica es ${base}, con ${NOT.Te} = ${f(r.Te)} días. ${NOT.v}(proyecto) = ${sumas} = ${f4(r.varianza)}; ${NOT.sd} = ${f4(r.sd)}.`;
    if (tipo === 'pertProyecto') {
      const pide = rng.pick(['Te', 'var', 'sd']);
      ej.datos.pide = pide;
      Object.assign(ej, {
        titulo: 'PERT: la ruta crítica del proyecto',
        enunciado: `En ${contexto}, las actividades tienen tres estimaciones de tiempo en días (a, m, b), como muestra la tabla.`,
        pregunta: pide === 'Te' ? `¿Cuál es la duración esperada ${NOT.Te} del proyecto, en días?` : pide === 'var' ? `¿Cuál es la varianza ${NOT.v} del proyecto? (dos decimales)` : `¿Cuál es la desviación estándar ${NOT.sd} del proyecto? (dos decimales)`,
        entrada: { tipo: 'numero', tol: TOL.pertProyecto, unidad: pide === 'Te' || pide === 'sd' ? 'días' : '' },
        solucion: pide === 'Te' ? r.Te : pide === 'var' ? r.varianza : r.sd,
        explicacion: detalle,
      });
      return ej;
    }
    // probabilidad: plazo a z entre −1,5 y 2, redondeado a días enteros
    const z0 = rng.int(-6, 8) / 4;
    let plazo = Math.round(r.Te + z0 * r.sd);
    if (plazo <= 0) plazo = Math.ceil(r.Te);
    const z = (plazo - r.Te) / r.sd;
    ej.datos.plazo = plazo;
    Object.assign(ej, {
      titulo: 'PERT: probabilidad de cumplir un plazo',
      enunciado: `En ${contexto}, las actividades tienen tres estimaciones de tiempo en días (a, m, b), como muestra la tabla. Se supone que la duración del proyecto sigue una distribución normal.`,
      pregunta: `¿Qué probabilidad hay de terminar en ${plazo} días o menos? Respóndela en porcentaje (por ejemplo 84,13).`,
      entrada: { tipo: 'numero', tol: TOL_PROB, unidad: '%' },
      solucion: phi(z) * 100,
      explicacion: `${detalle} Z = (T − ${NOT.Te}) / ${NOT.sd} = (${plazo} − ${f(r.Te)}) / ${f4(r.sd)} = ${f4(z)}. P(T ≤ ${plazo}) = Φ(${f4(z)}) = ${f4(phi(z))}, es decir, ${f(phi(z) * 100)} %.`,
    });
    return ej;
  }

  // Ejercicios CPM sobre una red
  const n = rng.int(5, 7);
  const acts = redCPM(rng, n);
  const r = tCPM(acts);
  ej.modo = 'cpm';
  ej.datos = { acts };
  ej.enunciado = `En ${contexto}, las actividades, sus duraciones en días y sus predecesoras son las de la tabla.`;
  ej.entrada = { tipo: 'numero', tol: 1e-6, unidad: 'días' };
  const detalleTabla = r.orden.map((x) => filaTexto(r.fila[x])).join('\n');
  ej.solucionDetallada = `${detalleTabla}\nDuración del proyecto ${NOT.T} = ${f(r.T)}. Ruta crítica: ${r.rutasCriticas.map((x) => x.join(' → ')).join(' y ')}.`;

  if (tipo === 'tiempo') {
    const pide = rng.pick(['tic', 'tfc', 'til', 'tfl']);
    const a = elegirAct(rng, r, pide);
    ej.datos.act = a;
    ej.datos.pide = pide;
    Object.assign(ej, {
      titulo: 'Tiempos de una actividad',
      pregunta: `¿Cuál es el ${nombrePide(pide)} de la actividad ${a}?`,
      solucion: r.fila[a][pide],
      explicacion: explicarValor(r, a, pide),
    });
  } else if (tipo === 'holgura') {
    const permitidas = holguraLibreSinAmbiguedad(acts, r);
    let pide = rng.pick(['ht', 'hl']);
    if (pide === 'hl' && !todas_hl(r, permitidas)) pide = 'ht';
    const a = elegirAct(rng, r, pide, permitidas);
    ej.datos.act = a;
    ej.datos.pide = pide;
    Object.assign(ej, {
      titulo: 'Holguras',
      pregunta: `¿Cuál es la ${NOMBRE[pide]} (${NOT[pide]}) de la actividad ${a}?`,
      solucion: r.fila[a][pide],
      explicacion: pide === 'ht'
        ? `${explicarValor(r, a, 'tic')} ${explicarValor(r, a, 'til')} ${explicarValor(r, a, 'ht')}`
        : `${explicarValor(r, a, 'tfc')} ${explicarValor(r, a, 'hl')}`,
    });
  } else if (tipo === 'duracion') {
    const fin = r.orden.filter((x) => !r.fila[x].sucs.length);
    Object.assign(ej, {
      titulo: 'Duración del proyecto',
      pregunta: 'Si las actividades empiezan lo antes posible, ¿cuánto dura el proyecto?',
      solucion: r.T,
      explicacion: `El proyecto dura lo que la ruta más larga: ${NOT.T} = máx ${NOT.tfc} de las actividades finales = máx[ ${fin.map((x) => `${NOT.tfc}(${x}) = ${f(r.fila[x].tfc)}`).join(', ')} ] = ${f(r.T)} días.`,
    });
  } else if (tipo === 'ruta') {
    const opciones = acts.map((a) => a.name);
    Object.assign(ej, {
      titulo: 'Actividades críticas',
      pregunta: 'Marca todas las actividades críticas (holgura total 0).',
      entrada: { tipo: 'multi', opciones },
      solucion: r.criticas.map((x) => opciones.indexOf(x)).sort((x, y) => x - y),
      explicacion: `Son críticas las de ${NOT.ht} = 0: ${lista(r.criticas)}. ${r.rutasCriticas.map((x) => `${x.join(' → ')} = ${f(x.reduce((s, k) => s + r.fila[k].d, 0))}`).join('; ')}. ${r.rutasCriticas.length > 1 ? 'Hay varias rutas críticas y todas duran lo mismo.' : ''}`.trim(),
    });
  }
  return ej;
}

const toleranciaDe = (ej) => ej.entrada.tol ?? 1e-6;

/** Valor correcto, recalculado desde los datos del ejercicio. */
export function resolver(ej) {
  const { datos, tipo } = ej;
  if (tipo === 'te') { const a = datos.acts[0]; return tiempoEsperado(a.a, a.m, a.b); }
  if (tipo === 'varianza') { const a = datos.acts[0]; return varianzaAct(a.a, a.b); }
  if (tipo === 'pertProyecto') {
    const r = calcularPERT(datos.acts);
    return datos.pide === 'Te' ? r.Te : datos.pide === 'var' ? r.varianza : r.sd;
  }
  if (tipo === 'probabilidad') {
    const r = calcularPERT(datos.acts);
    return r.sd > 0 ? phi((datos.plazo - r.Te) / r.sd) * 100 : datos.plazo >= r.Te ? 100 : 0;
  }
  const r = tCPM(datos.acts);
  if (tipo === 'tiempo' || tipo === 'holgura') return r.fila[datos.act][datos.pide];
  if (tipo === 'duracion') return r.T;
  if (tipo === 'ruta') return datos.acts.map((a, i) => (r.fila[a.name].critica ? i : -1)).filter((i) => i >= 0);
  throw new Error(`Tipo de ejercicio desconocido: ${tipo}`);
}

/** Pistas sobre el error más común, según el tipo. */
function pista(ej, resp, esperado) {
  const cerca = (x, y, t = 0.02) => Math.abs(x - y) <= t;
  const d = ej.datos;
  if (ej.tipo === 'tiempo' || ej.tipo === 'holgura') {
    const x = tCPM(d.acts).fila[d.act];
    const otros = ej.tipo === 'tiempo' ? ['tic', 'tfc', 'til', 'tfl'] : ['ht', 'hl'];
    const q = otros.find((k) => k !== d.pide && cerca(resp, x[k], 1e-6));
    if (q) return `Ese valor es el ${NOT[q]} de ${d.act}, no el ${NOT[d.pide]}.`;
    if (ej.tipo === 'holgura' && cerca(resp, x.til - x.tfc, 1e-6) && !cerca(resp, x.ht, 1e-6)) return `Recuerda que ${NOT.ht} = ${NOT.til} − ${NOT.tic} (o ${NOT.tfl} − ${NOT.tfc}).`;
  }
  if (ej.tipo === 'te') {
    const a = d.acts[0];
    if (cerca(resp, (a.a + a.m + a.b) / 3, 0.02)) return 'Parece que promediaste a, m y b sin ponderar: la m cuenta cuatro veces, (a + 4m + b) / 6.';
  }
  if (ej.tipo === 'varianza') {
    const a = d.acts[0];
    if (cerca(resp, (a.b - a.a) / 6, 0.02)) return 'Ese valor es la desviación (b − a) / 6; la varianza es ese número al cuadrado.';
    if (cerca(resp, (a.b - a.a) / 6 ** 2, 0.02)) return 'Hay que elevar al cuadrado todo el cociente: ((b − a) / 6)², no solo dividir entre 36 después.';
  }
  if (ej.tipo === 'pertProyecto') {
    const r = calcularPERT(d.acts);
    const todas = d.acts.reduce((s, a) => s + varianzaAct(a.a, a.b), 0);
    if (d.pide === 'var' && cerca(resp, todas, 0.05) && !cerca(resp, r.varianza, 0.05)) return 'Sumaste las varianzas de todas las actividades; solo cuentan las de la ruta crítica.';
    if (d.pide === 'var' && cerca(resp, r.sd, 0.05)) return 'Ese valor es la desviación estándar; la varianza es su cuadrado.';
    if (d.pide === 'sd' && cerca(resp, r.varianza, 0.05)) return 'Ese valor es la varianza; la desviación es su raíz cuadrada.';
  }
  if (ej.tipo === 'probabilidad') {
    if (cerca(resp, 100 - esperado, TOL_PROB)) return 'Parece que calculaste la probabilidad contraria, P(T ≥ plazo). Revisa el signo de Z.';
    if (resp <= 1 && cerca(resp * 100, esperado, TOL_PROB)) return 'Escribe la probabilidad en porcentaje (84,13 y no 0,8413).';
    const r = calcularPERT(d.acts);
    const zMal = (d.plazo - r.Te) / r.varianza; // dividir entre σ² en vez de σ
    if (Number.isFinite(zMal) && cerca(resp, phi(zMal) * 100, TOL_PROB)) return 'Dividiste entre la varianza; Z se calcula con la desviación estándar σ.';
  }
  return '';
}

/**
 * Corrige una respuesta: numero (tipo 'numero') o arreglo de índices (tipo 'multi').
 * → { correcta, mensaje, detalle, esperado }
 */
export function corregir(ej, resp) {
  const esperado = resolver(ej);
  if (ej.entrada.tipo === 'multi') {
    const dada = Array.isArray(resp) ? [...resp].sort((x, y) => x - y) : [];
    const ok = dada.length === esperado.length && dada.every((x, i) => x === esperado[i]);
    const nombre = (i) => ej.entrada.opciones[i];
    if (ok) return { correcta: true, mensaje: `Correcto: las actividades críticas son ${lista(esperado.map(nombre))}.`, detalle: '', esperado };
    const sobran = dada.filter((x) => !esperado.includes(x));
    const faltan = esperado.filter((x) => !dada.includes(x));
    const partes = [];
    if (sobran.length) partes.push(`${lista(sobran.map(nombre))} no ${sobran.length > 1 ? 'son críticas' : 'es crítica'} (tiene${sobran.length > 1 ? 'n' : ''} holgura)`);
    if (faltan.length) partes.push(`falta${faltan.length > 1 ? 'n' : ''} ${lista(faltan.map(nombre))}`);
    return { correcta: false, mensaje: `Incorrecto. Las críticas son ${lista(esperado.map(nombre))}.`, detalle: partes.length ? `En tu respuesta ${partes.join(' y ')}.` : '', esperado };
  }
  const tol = toleranciaDe(ej);
  if (typeof resp !== 'number' || !Number.isFinite(resp)) {
    return { correcta: false, mensaje: 'Escribe un número.', detalle: '', esperado };
  }
  const con = (x) => {
    const t = f4(x);
    const u = ej.entrada.unidad;
    if (!u) return t;
    if (u === 'días') return `${t} ${Math.abs(x - 1) < 1e-9 ? 'día' : 'días'}`;
    return `${t} ${u}`;
  };
  const ok = Math.abs(resp - esperado) <= tol + 1e-12;
  const aprox = ['probabilidad', 'te', 'varianza', 'pertProyecto'].includes(ej.tipo);
  if (ok) {
    return {
      correcta: true,
      mensaje: `Correcto: ${con(Math.round(esperado * 100) / 100)}.`,
      detalle: aprox ? `Valor exacto: ${con(esperado)}. Se acepta una diferencia de hasta ${f(tol)}${ej.tipo === 'probabilidad' ? ' puntos' : ''} por redondeo.` : '',
      esperado,
    };
  }
  return { correcta: false, mensaje: `Incorrecto: respondiste ${con(resp)}, el valor es ${con(aprox ? Math.round(esperado * 10000) / 10000 : esperado)}.`, detalle: pista(ej, resp, esperado), esperado };
}
