// Práctica del tema 3.1: ejercicios generados por semilla y corrección con explicación.
import { buildNetwork } from './network.js';
import { computeLayout } from './layout.js';
import {
  cierrePredecesoras, verificarRed, contarFicticias, extremosTabla, nombresOrdenados,
} from './dependenciasRed.js';
import { explicarFicticias } from './pasosEstructura.js';

export const TIPOS = ['ficticias', 'extremos', 'red', 'error', 'numeracion'];

export const ETIQUETAS = {
  ficticias: 'Contar ficticias',
  extremos: 'Inicio y fin',
  red: 'Elegir la red',
  error: 'Detectar el error',
  numeracion: 'Numerar eventos',
};

const LETRAS_ACT = 'ABCDEFGHIJ';
const LETRAS_EVENTO = 'abcdefghijklmnop';

function mulberry32(seed) {
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
  const shuffle = (arr) => {
    const r = arr.slice();
    for (let i = r.length - 1; i > 0; i--) {
      const j = int(0, i);
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  };
  return { next, int, pick, shuffle };
}

const lista = (xs) => {
  const a = [...xs];
  if (a.length <= 1) return a.join('');
  return a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1];
};
const conj = (xs) => (xs.length ? '{' + xs.join(', ') + '}' : '{ }');
const plural = (n, a, b) => (n === 1 ? a : b);

// ---------- Tablas ----------

/** Tabla aleatoria sin predecesoras redundantes. Siempre es acíclica (cada actividad solo depende de anteriores). */
export function tablaAleatoria(rng, n) {
  for (let intento = 0; intento < 200; intento++) {
    const nIni = rng.int(2, Math.min(3, n - 2));
    const acts = [];
    for (let i = 0; i < n; i++) {
      const nm = LETRAS_ACT[i];
      if (i < nIni) { acts.push({ name: nm, preds: [] }); continue; }
      const k = rng.pick([1, 1, 2, 2, 3]);
      const cand = acts.map((a) => a.name);
      const preds = rng.shuffle(cand).slice(0, Math.min(k, cand.length)).sort();
      acts.push({ name: nm, preds });
    }
    const cierre = cierrePredecesoras(acts);
    const redundante = acts.some((a) => a.preds.some((p) => a.preds.some((q) => q !== p && cierre.get(q).has(p))));
    if (redundante) continue;
    // todas las actividades deben tener un papel: o tienen sucesora o son finales (siempre cierto); evita una sola cadena trivial
    const { iniciales } = extremosTabla(acts);
    if (iniciales.length < 2) continue;
    return acts;
  }
  return [{ name: 'A', preds: [] }, { name: 'B', preds: [] }, { name: 'C', preds: ['A', 'B'] }, { name: 'D', preds: ['B'] }, { name: 'E', preds: ['C', 'D'] }];
}

const tablaTexto = (acts) => acts.map((a) => `${a.name}: ${a.preds.length ? a.preds.join(', ') : '-'}`).join('; ');

const base = (tipo, seed, extra) => ({
  id: `${tipo}-${seed}`,
  tipo,
  seed,
  ...extra,
});

// ---------- Mutaciones de la tabla (para distractores) ----------

function descendientes(acts, nm) {
  const out = new Set();
  const stack = [nm];
  while (stack.length) {
    const v = stack.pop();
    for (const a of acts) if (a.preds.includes(v) && !out.has(a.name)) { out.add(a.name); stack.push(a.name); }
  }
  return out;
}

/** Cambia las predecesoras de una actividad: quita una o agrega una. Devuelve una tabla nueva o null. */
function mutarTabla(rng, acts, soloActividad = null) {
  const objetivos = soloActividad ? [soloActividad] : rng.shuffle(acts.map((a) => a.name));
  const cierre = cierrePredecesoras(acts);
  for (const nm of objetivos) {
    const a = acts.find((x) => x.name === nm);
    const desc = descendientes(acts, nm);
    const opciones = [];
    if (a.preds.length >= 1) a.preds.forEach((p) => opciones.push({ quita: p }));
    acts.forEach((b) => {
      if (b.name !== nm && !a.preds.includes(b.name) && !desc.has(b.name) && !cierre.get(nm).has(b.name)) opciones.push({ agrega: b.name });
    });
    if (!opciones.length) continue;
    const o = rng.pick(opciones);
    return acts.map((x) => (x.name !== nm ? x : { name: nm, preds: o.quita ? x.preds.filter((p) => p !== o.quita) : [...x.preds, o.agrega].sort() }));
  }
  return null;
}

// ---------- Utilidades de redes ----------

/** Quita una ficticia: la red resultante ya no respeta alguna dependencia. */
function sinFicticia(net, id) {
  return { ...net, edges: net.edges.filter((e) => e.id !== id) };
}

const redTexto = (n) => `la red ${n + 1}`;

function descripcionErrores(ver, acts) {
  return ver.dependencias
    .map((d) => {
      const partes = [];
      if (d.sobra.length) partes.push(`hace esperar a ${d.act} también por ${conj(d.sobra)}, que la tabla no pide`);
      if (d.falta.length) partes.push(`no obliga a ${d.act} a esperar a ${conj(d.falta)}, que la tabla sí pide`);
      return partes.join(' y ');
    })
    .concat(ver.estructura);
}

// ---------- Generadores por tipo ----------

function genFicticias(seed, rng) {
  const objetivo = rng.pick([0, 1, 1, 2, 2, 3]);
  let acts = null;
  let net = null;
  for (let i = 0; i < 80; i++) {
    acts = tablaAleatoria(rng, rng.int(5, 6));
    net = buildNetwork(acts);
    if (contarFicticias(net) === objetivo) break;
  }
  const n = contarFicticias(net);
  const razones = explicarFicticias(net);
  const explicacion = n
    ? `La red necesita ${n} ${plural(n, 'ficticia', 'ficticias')}.\n${razones.map((r, i) => `${i + 1}. ${r.texto}`).join('\n')}`
    : 'No hace falta ninguna ficticia: cada actividad se dibuja entre eventos que ya reúnen exactamente sus predecesoras, y ninguna comparte sus dos extremos con otra.';
  return base('ficticias', seed, {
    titulo: 'Cuántas ficticias hacen falta',
    enunciado: 'Con esta tabla de actividades y predecesoras se dibuja la red usando el mínimo de actividades ficticias.',
    tabla: acts,
    pregunta: '¿Cuántas actividades ficticias necesita la red?',
    entrada: { tipo: 'numero' },
    respuesta: n,
    red: net,
    explicacion,
  });
}

function genExtremos(seed, rng) {
  const acts = tablaAleatoria(rng, rng.int(5, 8));
  const { iniciales, finales } = extremosTabla(acts);
  const inicio = rng.next() < 0.5;
  const correctas = inicio ? iniciales : finales;
  const nombres = acts.map((a) => a.name);
  const explicacion = inicio
    ? `Salen del evento inicial las actividades que no tienen predecesoras: ${lista(iniciales)}.`
    : `Llegan al evento final las actividades que no son predecesoras de ninguna otra: ${lista(finales)}.`;
  return base('extremos', seed, {
    titulo: inicio ? 'Actividades del evento inicial' : 'Actividades del evento final',
    enunciado: 'Se arma la red con esta tabla de actividades y predecesoras. Solo debe haber un evento de inicio y uno de fin.',
    tabla: acts,
    pregunta: inicio ? '¿Cuáles actividades salen del evento inicial?' : '¿Cuáles actividades llegan al evento final?',
    entrada: { tipo: 'multi', opciones: nombres },
    respuesta: correctas.map((nm) => nombres.indexOf(nm)).sort((a, b) => a - b),
    explicacion,
    nombres,
    modo: inicio ? 'inicio' : 'fin',
    solucionDetallada: inicio
      ? acts.map((a) => `${a.name}: ${a.preds.length ? `espera a ${lista(a.preds)}` : 'sin predecesoras, sale del inicio'}`).join('\n')
      : acts.map((a) => `${a.name}: ${acts.some((b) => b.preds.includes(a.name)) ? `la esperan ${lista(acts.filter((b) => b.preds.includes(a.name)).map((b) => b.name))}` : 'nadie la espera, llega al final'}`).join('\n'),
  });
}

function genRed(seed, rng) {
  for (let intento = 0; intento < 60; intento++) {
    const acts = tablaAleatoria(rng, rng.int(4, 5));
    const correcta = buildNetwork(acts);
    const opciones = [{ net: correcta, ok: true, origen: 'correcta' }];
    const dums = correcta.edges.filter((e) => e.kind === 'dummy');
    if (dums.length) {
      const red = sinFicticia(correcta, rng.pick(dums).id);
      if (!verificarRed(acts, red).ok) opciones.push({ net: red, ok: false, origen: 'sin ficticia' });
    }
    for (let k = 0; k < 12 && opciones.length < 3; k++) {
      const mut = mutarTabla(rng, acts);
      if (!mut) break;
      const red = buildNetwork(mut);
      if (verificarRed(acts, red).ok) continue;
      const firma = JSON.stringify(red.edges.map((e) => [e.act || 'f', e.from, e.to]));
      if (opciones.some((o) => JSON.stringify(o.net.edges.map((e) => [e.act || 'f', e.from, e.to])) === firma)) continue;
      opciones.push({ net: red, ok: false, origen: 'otra tabla' });
    }
    if (opciones.length < 3) continue;
    const barajadas = rng.shuffle(opciones);
    const idx = barajadas.findIndex((o) => o.ok);
    const informes = barajadas.map((o) => verificarRed(acts, o.net));
    return base('red', seed, {
      titulo: 'Elegir la red correcta',
      enunciado: 'Esta es la tabla de actividades y predecesoras de un proyecto. Abajo hay tres redes; una sola respeta todas las dependencias (las ficticias son las flechas discontinuas).',
      tabla: acts,
      pregunta: '¿Cuál red representa la tabla?',
      entrada: { tipo: 'opcion', opciones: barajadas.map((_, i) => `Red ${i + 1}`) },
      redes: barajadas.map((o) => o.net),
      respuesta: idx,
      explicacion: `La ${redTexto(idx)} es la que respeta la tabla.\n${barajadas.map((o, i) => (i === idx ? null : `En ${redTexto(i)}: ${descripcionErrores(informes[i], acts).join('; ')}.`)).filter(Boolean).join('\n')}`,
      motivos: barajadas.map((_, i) => (i === idx ? '' : descripcionErrores(informes[i], acts).join('; '))),
    });
  }
  throw new Error('No se pudo generar el ejercicio de elegir la red.');
}

function genError(seed, rng) {
  for (let intento = 0; intento < 100; intento++) {
    const acts = tablaAleatoria(rng, rng.int(5, 7));
    const { finales } = extremosTabla(acts);
    const objetivo = rng.pick(finales);
    const mut = mutarTabla(rng, acts, objetivo);
    if (!mut) continue;
    const red = buildNetwork(mut);
    const ver = verificarRed(acts, red);
    if (ver.estructura.length || ver.dependencias.length !== 1 || ver.dependencias[0].act !== objetivo) continue;
    const d = ver.dependencias[0];
    const nombres = acts.map((a) => a.name);
    const detalle = d.sobra.length
      ? `En la red, ${objetivo} espera también a ${conj(d.sobra)}, y la tabla no lo pide.`
      : `En la red, ${objetivo} no espera a ${conj(d.falta)}, y la tabla sí lo pide.`;
    const real = acts.find((a) => a.name === objetivo).preds;
    return base('error', seed, {
      titulo: 'Detectar la dependencia mal dibujada',
      enunciado: 'Un compañero dibujó esta red a partir de la tabla, pero una actividad quedó con predecesoras que no son las de la tabla. Las demás están bien.',
      tabla: acts,
      pregunta: '¿Cuál actividad está mal dibujada?',
      entrada: { tipo: 'opcion', opciones: nombres },
      redes: [red],
      respuesta: nombres.indexOf(objetivo),
      explicacion: `${objetivo} debería esperar a ${real.length ? lista(real) : 'nadie (sin predecesoras)'}. ${detalle} Para comprobarlo, se sigue hacia atrás desde el evento donde empieza cada actividad, pasando por las ficticias, y se comparan las actividades que se encuentran con las de la tabla.`,
      objetivo,
    });
  }
  throw new Error('No se pudo generar el ejercicio de detectar el error.');
}

/** Una numeración (nodo -> número) es válida si en toda flecha el número de origen es menor que el de destino. */
export function numeracionValida(net, numero) {
  const usados = new Set(Object.values(numero));
  if (usados.size !== net.nodes.length) return false;
  for (let k = 1; k <= net.nodes.length; k++) if (!usados.has(k)) return false;
  return net.edges.every((e) => numero[e.from] < numero[e.to]);
}

function genNumeracion(seed, rng) {
  for (let intento = 0; intento < 60; intento++) {
    const acts = tablaAleatoria(rng, rng.int(4, 6));
    const net = buildNetwork(acts);
    if (net.nodes.length > LETRAS_EVENTO.length) continue;
    const layout = computeLayout(net);
    const letraDe = {};
    rng.shuffle(net.nodes).forEach((v, i) => { letraDe[v] = LETRAS_EVENTO[i]; });
    const correcta = { ...layout.number };
    if (!numeracionValida(net, correcta)) throw new Error('La numeración de la red no cumple i < j.');
    const claves = new Set();
    const opciones = [{ num: correcta, ok: true }];
    claves.add(JSON.stringify(correcta));
    const aristas = rng.shuffle(net.edges);
    for (const e of aristas) {
      if (opciones.length >= 4) break;
      const m = { ...correcta };
      [m[e.from], m[e.to]] = [m[e.to], m[e.from]];
      if (numeracionValida(net, m) || claves.has(JSON.stringify(m))) continue;
      claves.add(JSON.stringify(m));
      opciones.push({ num: m, ok: false });
    }
    if (opciones.length < 3) continue;
    const barajadas = rng.shuffle(opciones);
    const orden = [...net.nodes].sort((a, b) => LETRAS_EVENTO.indexOf(letraDe[a]) - LETRAS_EVENTO.indexOf(letraDe[b]));
    const texto = (m) => orden.map((v) => `${letraDe[v]} = ${m[v]}`).join(', ');
    const idx = barajadas.findIndex((o) => o.ok);
    const violaciones = (m) => net.edges.filter((e) => m[e.from] >= m[e.to]).map((e) => `${e.kind === 'dummy' ? 'la ficticia' : e.act} va de ${letraDe[e.from]} (${m[e.from]}) a ${letraDe[e.to]} (${m[e.to]})`);
    return base('numeracion', seed, {
      titulo: 'Numerar los eventos',
      enunciado: 'Esta es la red de un proyecto con sus eventos señalados con letras. Hay que numerarlos de modo que toda actividad, ficticias incluidas, vaya de un evento con número menor a uno con número mayor (i < j).',
      tabla: acts,
      pregunta: '¿Cuál numeración cumple la regla?',
      entrada: { tipo: 'opcion', opciones: barajadas.map((o) => texto(o.num)) },
      redes: [net],
      etiquetas: letraDe,
      respuesta: idx,
      explicacion: `La numeración correcta es: ${texto(correcta)}. El inicio recibe el 1 y el final el ${net.nodes.length}.\n${barajadas.map((o, i) => (o.ok ? null : `Opción ${i + 1}: ${violaciones(o.num).join('; ')}, y debería ir de menor a mayor.`)).filter(Boolean).join('\n')}`,
      numeraciones: barajadas.map((o) => o.num),
    });
  }
  throw new Error('No se pudo generar el ejercicio de numerar.');
}

const GENERADORES = { ficticias: genFicticias, extremos: genExtremos, red: genRed, error: genError, numeracion: genNumeracion };

export function generarEjercicio(tipo, seed) {
  if (!GENERADORES[tipo]) throw new Error(`Tipo de ejercicio desconocido: ${tipo}`);
  const s = Number(seed) >>> 0;
  const rng = mulberry32(s * 7919 + TIPOS.indexOf(tipo) * 104729 + 17);
  return GENERADORES[tipo](s, rng);
}

// ---------- Corrección ----------

export function corregir(ej, respuesta) {
  const { entrada } = ej;
  if (entrada.tipo === 'numero') {
    if (!Number.isFinite(respuesta)) return { correcta: false, mensaje: 'Escribe un número.', detalle: '' };
    const ok = respuesta === ej.respuesta;
    return {
      correcta: ok,
      mensaje: ok
        ? `Correcto: la red necesita ${ej.respuesta} ${plural(ej.respuesta, 'ficticia', 'ficticias')}.`
        : `Incorrecto: respondiste ${respuesta} y la red necesita ${ej.respuesta} ${plural(ej.respuesta, 'ficticia', 'ficticias')}.`,
      detalle: '',
    };
  }
  if (entrada.tipo === 'multi') {
    const marcadas = Array.isArray(respuesta) ? [...respuesta].sort((a, b) => a - b) : [];
    const ok = marcadas.length === ej.respuesta.length && marcadas.every((v, i) => v === ej.respuesta[i]);
    const nom = (i) => ej.nombres[i];
    const correctas = ej.respuesta.map(nom);
    const sobran = marcadas.filter((i) => !ej.respuesta.includes(i)).map(nom);
    const faltan = ej.respuesta.filter((i) => !marcadas.includes(i)).map(nom);
    const que = ej.modo === 'inicio' ? 'salen del evento inicial' : 'llegan al evento final';
    let mensaje;
    let detalle = '';
    if (ok) mensaje = `Correcto: ${que} ${lista(correctas)}.`;
    else {
      mensaje = `Incorrecto: ${que} ${lista(correctas)}.`;
      const partes = [];
      if (sobran.length) partes.push(`Marcaste de más: ${lista(sobran)}.`);
      if (faltan.length) partes.push(`Te faltó: ${lista(faltan)}.`);
      detalle = partes.join(' ');
    }
    return { correcta: ok, mensaje, detalle };
  }
  // opcion
  const ok = respuesta === ej.respuesta;
  const nombre = (i) => entrada.opciones[i];
  let mensaje;
  let detalle = '';
  if (ej.tipo === 'red') {
    mensaje = ok ? `Correcto: la red ${ej.respuesta + 1} respeta la tabla.` : `Incorrecto: la respuesta es la red ${ej.respuesta + 1}.`;
    if (!ok && ej.motivos[respuesta]) detalle = `En la red ${respuesta + 1}: ${ej.motivos[respuesta]}.`;
  } else if (ej.tipo === 'error') {
    mensaje = ok ? `Correcto: la actividad mal dibujada es ${ej.objetivo}.` : `Incorrecto: la actividad mal dibujada es ${ej.objetivo}, no ${nombre(respuesta)}.`;
  } else {
    mensaje = ok ? `Correcto: la opción ${ej.respuesta + 1} respeta i < j.` : `Incorrecto: la respuesta es la opción ${ej.respuesta + 1}.`;
    if (!ok) {
      const net = ej.redes[0];
      const m = ej.numeraciones[respuesta];
      const letra = ej.etiquetas;
      const viol = net.edges.filter((e) => m[e.from] >= m[e.to]).map((e) => `${e.kind === 'dummy' ? 'la ficticia' : e.act} va de ${letra[e.from]} (${m[e.from]}) a ${letra[e.to]} (${m[e.to]})`);
      detalle = `En la opción ${respuesta + 1}: ${viol.join('; ')}.`;
    }
  }
  return { correcta: ok, mensaje, detalle };
}

export { nombresOrdenados, tablaTexto };
