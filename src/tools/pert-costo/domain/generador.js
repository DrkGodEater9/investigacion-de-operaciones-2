/**
 * Generador y corrector de ejercicios de la pestaña «Práctica» del tema 3.3 (Análisis de costos).
 * Funciones puras: la misma semilla produce siempre el mismo ejercicio.
 *
 * Ejercicio (JSON serializable):
 *   { id: `${tipo}-${seed}`, tipo, seed, titulo, contexto, unidad, enunciado, pregunta,
 *     filas: [{ name, preds, dn, cn, dl, cl }], ci, fijo, objetivo?,
 *     entrada: { tipo: 'numero' } | { tipo: 'opcion', opciones: string[] },
 *     explicacion, solucionDetallada }
 *
 * corregir() NO confía en lo guardado: recalcula con resolver() a partir de `filas`, `ci` y `objetivo`.
 *
 * Tipos:
 *   pendiente     -> una actividad (filas.length = 1). Respuesta: número.
 *   primera       -> red con una sola ruta crítica. Respuesta: índice de la actividad que se acorta primero.
 *   conjunto      -> varias rutas críticas. Respuesta: costo por unidad del primer corte (número).
 *   limite        -> duración mínima del proyecto (número).
 *   costoDirecto  -> costo directo mínimo para terminar en `objetivo` (número).
 *   duracionOptima-> duración de costo total mínimo (número).
 *   costoTotal    -> costo total mínimo (número).
 */
import { normalizar, armarModelo } from './modelo.js';
import { resolver } from './reducir.js';
import { tiempos, rutasCriticas } from './calculo.js';
import { num, lista } from './formato.js';
import { textoRuta } from './pasos.js';

export const TIPOS = ['pendiente', 'primera', 'conjunto', 'limite', 'costoDirecto', 'duracionOptima', 'costoTotal'];

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
  return { next, int, pick: (arr) => arr[int(0, arr.length - 1)] };
}

const CONTEXTOS = [
  { nombre: 'Montaje de una línea de producción', unidad: 'días' },
  { nombre: 'Adecuación de una sala de cómputo', unidad: 'días' },
  { nombre: 'Lanzamiento de una aplicación móvil', unidad: 'semanas' },
  { nombre: 'Remodelación de un laboratorio', unidad: 'semanas' },
  { nombre: 'Construcción de una bodega', unidad: 'semanas' },
];

const TOPOLOGIAS = {
  rombo: [['A', ''], ['B', 'A'], ['C', 'A'], ['D', 'B,C']],
  rombo5: [['A', ''], ['B', 'A'], ['C', 'A'], ['D', 'B,C'], ['E', 'D']],
  paralelas: [['A', ''], ['B', 'A'], ['C', ''], ['D', 'C'], ['E', 'B,D']],
  lateral: [['A', ''], ['B', 'A'], ['C', 'B'], ['D', 'A'], ['E', 'C,D']],
  puente: [['A', ''], ['B', ''], ['C', 'A'], ['D', 'A'], ['E', 'B,C'], ['F', 'D,E']],
  serie: [['A', ''], ['B', 'A'], ['C', 'B'], ['D', 'A'], ['E', 'C,D']],
};

const modeloDe = (filas, ci) => {
  const nor = normalizar(filas, { ci: String(ci), fijo: '0' });
  if (nor.errores.length) throw new Error('Ejercicio inválido: ' + nor.errores[0].msg);
  return armarModelo(nor.actividades, { ci: nor.ci, fijo: nor.fijo });
};

const cache = new WeakMap();
/** Modelo y solución de un ejercicio (se recalculan desde sus datos). */
export function solucionDe(ej) {
  if (cache.has(ej)) return cache.get(ej);
  const m = modeloDe(ej.filas, ej.ci);
  const res = resolver(m);
  const r = { m, res };
  cache.set(ej, r);
  return r;
}

/** Filas aleatorias para una topología con pendientes enteras. */
function filasAleatorias(rng, topo, { dnMax = 8, fija = 0.15 } = {}) {
  return TOPOLOGIAS[topo].map(([name, preds]) => {
    const dn = rng.int(2, dnMax);
    const r = rng.next() < fija ? 0 : rng.int(1, Math.min(3, dn - 1));
    const cn = 10 * rng.int(3, 20);
    const s = 5 * rng.int(1, 12);
    return {
      name, preds,
      dn: String(dn), cn: String(cn),
      dl: r === 0 ? '' : String(dn - r),
      cl: r === 0 ? '' : String(cn + s * r),
    };
  });
}

const textoPendientes = (m) => m.names
  .map((nom, j) => (m.pend[j] == null ? `${nom}: no se puede acortar` : `${nom}: (${num(m.cl[j])} − ${num(m.cn[j])}) / (${num(m.dn[j])} − ${num(m.dl[j])}) = ${num(m.pend[j])}`))
  .join('\n');

const textoReducciones = (m, res) => res.pasos.map((p) => {
  const acort = lista(p.acortan.map((a) => a.nombre));
  const alar = p.alargan.length ? ` y se alarga ${lista(p.alargan.map((a) => a.nombre))}` : '';
  return `De ${p.desde} a ${p.hasta}: se acorta ${acort}${alar} (${num(p.pendiente)} por unidad × ${p.unidades}). Directo ${num(p.directo)}, indirecto ${num(p.indirecto)}, total ${num(p.total)}.`;
}).join('\n');

/** Igual que textoReducciones, pero solo hasta la duración `objetivo` (el último paso puede quedar a medias). */
const textoReduccionesHasta = (m, res, objetivo) => res.pasos
  .filter((p) => p.desde > objetivo)
  .map((p) => {
    const hasta = Math.max(p.hasta, objetivo);
    const u = p.desde - hasta;
    const acort = lista(p.acortan.map((a) => a.nombre));
    const alar = p.alargan.length ? ` y se alarga ${lista(p.alargan.map((a) => a.nombre))}` : '';
    return `De ${p.desde} a ${hasta}: se acorta ${acort}${alar} (${num(p.pendiente)} por unidad × ${u}). Costo directo ${num(res.estadoEn(hasta).directo)}.`;
  })
  .join('\n');

function base(tipo, seed, rng) {
  const ctx = rng.pick(CONTEXTOS);
  return { id: `${tipo}-${seed}`, tipo, seed, contexto: ctx.nombre, unidad: ctx.unidad };
}

function encabezado(ej) {
  return `Proyecto «${ej.contexto}». Los tiempos están en ${ej.unidad}; los costos, en millones de pesos.`;
}

/* ---------- generadores por tipo ---------- */

function genPendiente(seed, rng) {
  const e = base('pendiente', seed, rng);
  const dn = rng.int(5, 14);
  const r = rng.int(2, Math.min(6, dn - 1));
  const cn = 10 * rng.int(8, 60);
  const s = rng.pick([5, 8, 10, 12, 15, 20, 25, 30, 40]);
  const fila = { name: 'X', preds: '', dn: String(dn), cn: String(cn), dl: String(dn - r), cl: String(cn + s * r) };
  return {
    ...e,
    titulo: 'Pendiente de costo',
    filas: [fila],
    ci: 0,
    fijo: '0',
    enunciado: `En el proyecto «${e.contexto}», la actividad X dura normalmente ${dn} ${e.unidad} y cuesta ${cn}. Si se acelera al máximo, dura ${dn - r} ${e.unidad} y cuesta ${cn + s * r}.`,
    pregunta: `¿Cuánto cuesta acortar la actividad X una unidad de tiempo (pendiente de costo)?`,
    entrada: { tipo: 'numero' },
  };
}

function genPrimera(seed, rng) {
  const e = base('primera', seed, rng);
  for (let intento = 0; intento < 400; intento++) {
    const topo = rng.pick(['rombo5', 'lateral', 'serie', 'paralelas']);
    const filas = filasAleatorias(rng, topo, { fija: 0.2 });
    const ci = 5 * rng.int(4, 16);
    const m = modeloDe(filas, ci);
    const tm = tiempos(m, m.dn);
    const rutas = rutasCriticas(m, tm).rutas;
    if (rutas.length !== 1) continue;
    const cand = m.names.map((_, j) => j).filter((j) => tm.critica[j] && m.pend[j] != null);
    if (cand.length < 2) continue;
    const orden = cand.map((j) => m.pend[j]).sort((a, b) => a - b);
    if (orden[0] === orden[1]) continue; // mínimo único
    // trampa: una actividad fuera de la ruta crítica con pendiente menor que la mejor
    const mejor = orden[0];
    const trampa = m.names.some((_, j) => !tm.critica[j] && m.pend[j] != null && m.pend[j] < mejor);
    if (!trampa && intento < 300) continue;
    return {
      ...e,
      titulo: 'Qué actividad acortar primero',
      filas,
      ci: 0,
      fijo: '0',
      enunciado: `${encabezado(e)}`,
      pregunta: 'Para reducir la duración del proyecto con el menor costo, ¿qué actividad se acorta primero?',
      entrada: { tipo: 'opcion', opciones: m.names.map((nom) => `Actividad ${nom}`) },
    };
  }
  throw new Error('No se pudo generar el ejercicio (primera)');
}

function genConjunto(seed, rng) {
  const e = base('conjunto', seed, rng);
  for (let intento = 0; intento < 2000; intento++) {
    const topo = rng.pick(['rombo', 'rombo5', 'paralelas', 'puente', 'lateral']);
    const filas = filasAleatorias(rng, topo, { dnMax: 5, fija: 0.1 });
    const ci = 5 * rng.int(4, 16);
    const m = modeloDe(filas, ci);
    const tm = tiempos(m, m.dn);
    const rutas = rutasCriticas(m, tm).rutas;
    if (rutas.length < 2) continue;
    const res = resolver(m);
    if (!res.pasos.length) continue;
    const p = res.pasos[0];
    if (p.tipo === 'con-alargue') continue;
    // La respuesta no debe coincidir con la pendiente de la actividad crítica más barata (la trampa)
    const reducibles = m.names.map((_, j) => j).filter((j) => tm.critica[j] && m.pend[j] != null);
    const ingenua = Math.min(...reducibles.map((j) => m.pend[j]));
    if (Math.abs(ingenua - p.pendiente) < 1e-9 && intento < 1500) continue;
    return {
      ...e,
      titulo: 'Varias rutas críticas',
      filas,
      ci,
      fijo: '0',
      enunciado: `${encabezado(e)} Costo indirecto: ${ci} por ${e.unidad.replace(/s$/, '')}. Con las duraciones normales hay ${rutas.length} rutas críticas simultáneas.`,
      pregunta: `Para bajar la duración del proyecto de ${res.T0} a ${res.T0 - 1}, ¿cuánto cuesta (por unidad) la reducción más barata?`,
      entrada: { tipo: 'numero' },
    };
  }
  throw new Error('No se pudo generar el ejercicio (conjunto)');
}

function genLimite(seed, rng) {
  const e = base('limite', seed, rng);
  const topo = rng.pick(Object.keys(TOPOLOGIAS));
  const filas = filasAleatorias(rng, topo, { dnMax: 9, fija: 0.2 });
  return {
    ...e,
    titulo: 'Duración límite del proyecto',
    filas,
    ci: 0,
    fijo: '0',
    enunciado: `${encabezado(e)}`,
    pregunta: 'Si todas las actividades se aceleran al máximo (duración límite), ¿cuál es la menor duración posible del proyecto?',
    entrada: { tipo: 'numero' },
  };
}

function genCostoDirecto(seed, rng) {
  const e = base('costoDirecto', seed, rng);
  for (let intento = 0; intento < 800; intento++) {
    const topo = rng.pick(['rombo5', 'lateral', 'paralelas', 'rombo', 'puente']);
    const filas = filasAleatorias(rng, topo, { dnMax: 7 });
    const ci = 5 * rng.int(4, 16);
    const m = modeloDe(filas, ci);
    const res = resolver(m);
    const posibles = res.T0 - res.Tmin;
    if (posibles < 2) continue;
    const k = rng.int(2, Math.min(4, posibles));
    const objetivo = res.T0 - k;
    if (res.pasos.some((p) => p.tipo === 'con-alargue' && p.hasta >= objetivo)) continue; // sin pasos con alargue: más didáctico
    return {
      ...e,
      titulo: 'Costo directo de acelerar',
      filas,
      ci,
      fijo: '0',
      objetivo,
      enunciado: `${encabezado(e)}`,
      pregunta: `¿Cuál es el costo directo mínimo para terminar el proyecto en ${objetivo} ${e.unidad}? (Con las duraciones normales el proyecto dura ${res.T0}.)`,
      entrada: { tipo: 'numero' },
    };
  }
  throw new Error('No se pudo generar el ejercicio (costoDirecto)');
}

function genOptimo(tipo, seed, rng) {
  const e = base(tipo, seed, rng);
  for (let intento = 0; intento < 1500; intento++) {
    const topo = rng.pick(['rombo5', 'lateral', 'paralelas', 'rombo', 'puente', 'serie']);
    const filas = filasAleatorias(rng, topo, { dnMax: 7 });
    const ci = 5 * rng.int(3, 16);
    const m = modeloDe(filas, ci);
    const res = resolver(m);
    if (res.optimo.empates.length !== 1) continue;
    if (res.optimo.T >= res.T0 || res.optimo.T <= res.Tmin) continue; // un óptimo intermedio es más interesante
    if (res.pasos.length > 6) continue;
    if (res.pasos.some((p) => p.tipo === 'con-alargue' && p.conviene)) continue;
    return {
      ...e,
      titulo: tipo === 'duracionOptima' ? 'Duración de costo mínimo' : 'Costo total mínimo',
      filas,
      ci,
      fijo: '0',
      enunciado: `${encabezado(e)} Costo indirecto: ${ci} por ${e.unidad.replace(/s$/, '')}.`,
      pregunta: tipo === 'duracionOptima'
        ? `¿Qué duración del proyecto (en ${e.unidad}) da el menor costo total, directo más indirecto?`
        : '¿Cuál es el costo total mínimo del proyecto (directo más indirecto)?',
      entrada: { tipo: 'numero' },
    };
  }
  throw new Error(`No se pudo generar el ejercicio (${tipo})`);
}

/** Texto y respuesta correcta; se agregan al ejercicio para mostrarlos después de corregir. */
function conSolucion(ej) {
  const { m, res } = solucionDe(ej);
  const rn = res.normal.rutas.rutas.map((r) => textoRuta(r, m.names)).join(' y ');
  const base = {
    pendiente: () => ({
      explicacion: 'La pendiente de costo es lo que cuesta acortar una unidad de tiempo: (costo límite − costo normal) / (duración normal − duración límite).',
      solucionDetallada: textoPendientes(m),
    }),
    primera: () => {
      const j = respuestaCorrecta(ej);
      return {
        explicacion: `Solo sirve acortar actividades de la ruta crítica (${rn}); de ellas, se elige la de menor pendiente que todavía se pueda acortar. Una actividad barata fuera de la ruta crítica no reduce la duración del proyecto.`,
        solucionDetallada: `Pendientes:\n${textoPendientes(m)}\nCrítica: ${rn}. Se acorta ${m.names[j]} (pendiente ${num(m.pend[j])}).`,
      };
    },
    conjunto: () => ({
      explicacion: `Hay varias rutas críticas simultáneas (${rn}). Acortar una sola actividad no baja la duración si hay otra ruta igual de larga; hay que acortar al menos una actividad en cada ruta crítica. Entre los conjuntos que las cortan todas, se elige el de menor costo por unidad.`,
      solucionDetallada: `Pendientes:\n${textoPendientes(m)}\nPrimera reducción: se acorta ${lista(res.pasos[0].acortan.map((a) => a.nombre))}, con costo ${num(res.pasos[0].pendiente)} por unidad.`,
    }),
    limite: () => ({
      explicacion: 'Se vuelve a calcular la ruta más larga, pero usando la duración límite de cada actividad.',
      solucionDetallada: `Con las duraciones límite: ${m.names.map((nom, j) => `${nom} = ${m.dl[j]}`).join(', ')}. La ruta más larga dura ${res.Tmin}.`,
    }),
    costoDirecto: () => ({
      explicacion: 'Se parte del costo directo normal y se suma, en cada reducción, la pendiente del corte por las unidades acortadas.',
      solucionDetallada: `Costo directo normal = ${num(res.normal.directo)}.\n${textoReducciones(m, res)}\nPara terminar en ${ej.objetivo} el costo directo es ${num(res.estadoEn(ej.objetivo).directo)}.`,
    }),
    duracionOptima: () => ({
      explicacion: `Se acorta mientras la pendiente del corte sea menor que el costo indirecto por unidad (${num(ej.ci)}). Cuando la pendiente supera ese ahorro, el costo total vuelve a subir.`,
      solucionDetallada: `Costo directo normal = ${num(res.normal.directo)}; total normal = ${num(res.normal.total)}.\n${textoReducciones(m, res)}\nEl menor costo total (${num(res.optimo.total)}) se da con duración ${res.optimo.T}.`,
    }),
    costoTotal: () => ({
      explicacion: `Se acorta mientras la pendiente del corte sea menor que el costo indirecto por unidad (${num(ej.ci)}), y el costo total es directo más indirecto en la duración óptima.`,
      solucionDetallada: `Costo directo normal = ${num(res.normal.directo)}; total normal = ${num(res.normal.total)}.\n${textoReducciones(m, res)}\nCosto total mínimo = ${num(res.optimo.total)} (duración ${res.optimo.T}).`,
    }),
  }[ej.tipo]();
  return { ...ej, ...base };
}

const GENERADORES = {
  pendiente: genPendiente,
  primera: genPrimera,
  conjunto: genConjunto,
  limite: genLimite,
  costoDirecto: genCostoDirecto,
  duracionOptima: (s, r) => genOptimo('duracionOptima', s, r),
  costoTotal: (s, r) => genOptimo('costoTotal', s, r),
};

export function generarEjercicio(tipo, seed) {
  const gen = GENERADORES[tipo];
  if (!gen) throw new Error('Tipo de ejercicio desconocido');
  const rng = mulberry32((Number(seed) * 2654435761 + TIPOS.indexOf(tipo) * 40503) >>> 0);
  return conSolucion(gen(Number(seed), rng));
}

/* ---------- respuesta correcta y corrección ---------- */

/** Respuesta correcta (número; en 'primera', índice de la actividad). Se calcula siempre desde los datos. */
export function respuestaCorrecta(ej) {
  if (ej.tipo === 'pendiente') {
    const f = ej.filas[0];
    return (Number(f.cl) - Number(f.cn)) / (Number(f.dn) - Number(f.dl));
  }
  const { m, res } = solucionDe(ej);
  switch (ej.tipo) {
    case 'primera': {
      const tm = tiempos(m, m.dn);
      let mejor = -1;
      m.names.forEach((_, j) => {
        if (tm.critica[j] && m.pend[j] != null && (mejor < 0 || m.pend[j] < m.pend[mejor])) mejor = j;
      });
      return mejor;
    }
    case 'conjunto': return res.pasos[0].pendiente;
    case 'limite': return res.Tmin;
    case 'costoDirecto': return res.estadoEn(ej.objetivo).directo;
    case 'duracionOptima': return res.optimo.T;
    case 'costoTotal': return res.optimo.total;
    default: throw new Error('Tipo de ejercicio desconocido');
  }
}

const igual = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const ok = (mensaje) => ({ correcta: true, mensaje, detalle: '' });
const mal = (mensaje, detalle = '') => ({ correcta: false, mensaje, detalle });

const CORRECTORES = {
  pendiente(ej, r) {
    const f = ej.filas[0];
    const [dn, dl, cn, cl] = [Number(f.dn), Number(f.dl), Number(f.cn), Number(f.cl)];
    const c = respuestaCorrecta(ej);
    if (igual(r, c)) return ok(`Correcto: (${num(cl)} − ${num(cn)}) / (${num(dn)} − ${num(dl)}) = ${num(c)}.`);
    if (igual(r, cl - cn)) return mal(`Eso es el aumento total de costo (${num(cl - cn)}).`, `Falta dividir entre las unidades de tiempo que se acortan (${num(dn)} − ${num(dl)} = ${num(dn - dl)}). La pendiente es ${num(c)}.`);
    if (igual(r, 1 / c, 0.001)) return mal('Invertiste el cociente.', `La pendiente es costo extra sobre tiempo ganado: (${num(cl)} − ${num(cn)}) / (${num(dn)} − ${num(dl)}) = ${num(c)}.`);
    return mal(`La pendiente es ${num(c)}.`, `(${num(cl)} − ${num(cn)}) / (${num(dn)} − ${num(dl)}) = ${num(c)}.`);
  },
  primera(ej, r) {
    const { m } = solucionDe(ej);
    const c = respuestaCorrecta(ej);
    if (r === c) return ok(`Correcto: ${m.names[c]} es la actividad crítica de menor pendiente (${num(m.pend[c])}).`);
    if (!Number.isInteger(r) || r < 0 || r >= m.n) return mal('Elige una de las actividades de la lista.');
    const tm = tiempos(m, m.dn);
    const nom = m.names[r];
    if (!tm.critica[r]) return mal(`${nom} no está en la ruta crítica.`, `Acortarla no reduce la duración del proyecto: su pendiente (${m.pend[r] == null ? 'no se puede acortar' : num(m.pend[r])}) no importa. Hay que elegir entre las actividades críticas; la de menor pendiente es ${m.names[c]} (${num(m.pend[c])}).`);
    if (m.pend[r] == null) return mal(`${nom} es crítica, pero no se puede acortar (duración normal igual a la límite).`, `La mejor opción es ${m.names[c]}, con pendiente ${num(m.pend[c])}.`);
    return mal(`${nom} es crítica, pero no es la de menor pendiente (${num(m.pend[r])}).`, `La de menor pendiente entre las críticas es ${m.names[c]}, con ${num(m.pend[c])}.`);
  },
  conjunto(ej, r) {
    const { m, res } = solucionDe(ej);
    const c = respuestaCorrecta(ej);
    const p = res.pasos[0];
    if (igual(r, c)) return ok(`Correcto: se acorta ${lista(p.acortan.map((a) => a.nombre))} a ${num(c)} por unidad.`);
    const tm = tiempos(m, m.dn);
    const ingenua = Math.min(...m.names.map((_, j) => j).filter((j) => tm.critica[j] && m.pend[j] != null).map((j) => m.pend[j]));
    if (igual(r, ingenua)) return mal(`${num(r)} es la pendiente de la actividad crítica más barata, pero acortarla sola no basta.`, `Hay varias rutas críticas: al acortar solo una, las otras siguen durando lo mismo. Hay que cortar todas las rutas críticas; el conjunto de menor costo es ${lista(p.acortan.map((a) => a.nombre))} y cuesta ${num(c)} por unidad.`);
    return mal(`El costo por unidad de la reducción más barata es ${num(c)}.`, `Se acorta ${lista(p.acortan.map((a) => a.nombre))} (${p.acortan.map((a) => num(a.pend)).join(' + ')}).`);
  },
  limite(ej, r) {
    const { res } = solucionDe(ej);
    const c = respuestaCorrecta(ej);
    if (igual(r, c, 1e-6)) return ok(`Correcto: con todas las actividades en su límite, la ruta más larga dura ${num(c)}.`);
    if (igual(r, res.T0, 1e-6)) return mal('Esa es la duración normal.', `Hay que volver a calcular la ruta crítica con las duraciones límite. Resulta ${num(c)}.`);
    return mal(`La duración mínima es ${num(c)}.`, 'Recalcula la ruta más larga usando la duración límite de cada actividad (cuidado: la ruta crítica puede cambiar).');
  },
  costoDirecto(ej, r) {
    const { res } = solucionDe(ej);
    const c = respuestaCorrecta(ej);
    if (igual(r, c, 1e-6)) return ok(`Correcto: el costo directo para terminar en ${ej.objetivo} es ${num(c)}.`);
    if (igual(r, res.normal.directo, 1e-6)) return mal('Ese es el costo directo con las duraciones normales.', `Al acortar hasta ${ej.objetivo} se suma la pendiente de cada reducción: ${num(c)}.`);
    if (igual(r, res.estadoEn(ej.objetivo).total, 1e-6)) return mal('Incluiste los costos indirectos.', `La pregunta pide solo el costo directo: ${num(c)}.`);
    return mal(`El costo directo mínimo es ${num(c)}.`, 'Suma, a cada reducción, pendiente del corte por unidades acortadas, empezando en el costo normal.');
  },
  duracionOptima(ej, r) {
    const { res } = solucionDe(ej);
    const c = respuestaCorrecta(ej);
    if (igual(r, c, 1e-6)) return ok(`Correcto: con duración ${c} el costo total es el menor (${num(res.optimo.total)}).`);
    if (igual(r, res.Tmin, 1e-6)) return mal('Esa es la duración límite: acortar tanto no conviene.', `Hay que parar cuando la pendiente del corte supera el costo indirecto por unidad (${num(ej.ci)}). La duración óptima es ${c}.`);
    if (igual(r, res.T0, 1e-6)) return mal('Esa es la duración normal: todavía conviene acortar.', `Las primeras reducciones cuestan menos que el ahorro indirecto (${num(ej.ci)}). La duración óptima es ${c}.`);
    return mal(`La duración de costo mínimo es ${c}.`, 'Compara la pendiente de cada reducción con el costo indirecto por unidad: conviene mientras sea menor.');
  },
  costoTotal(ej, r) {
    const { res } = solucionDe(ej);
    const c = respuestaCorrecta(ej);
    if (igual(r, c, 1e-6)) return ok(`Correcto: el costo total mínimo es ${num(c)}, con duración ${res.optimo.T}.`);
    const e = res.estadoEn(res.optimo.T);
    if (igual(r, e.directo, 1e-6)) return mal('Ese es solo el costo directo en la duración óptima.', `Falta sumar el costo indirecto (${num(e.indirecto)}): ${num(c)}.`);
    if (igual(r, res.normal.total, 1e-6)) return mal('Ese es el costo total con las duraciones normales.', `Al acortar hasta la duración óptima (${res.optimo.T}) el total baja a ${num(c)}.`);
    return mal(`El costo total mínimo es ${num(c)}.`, `Se obtiene con duración ${res.optimo.T}: directo ${num(e.directo)} + indirecto ${num(e.indirecto)}.`);
  },
};

export function corregir(ej, respuesta) {
  const f = CORRECTORES[ej && ej.tipo];
  if (!f) throw new Error('Tipo de ejercicio desconocido');
  if (ej.tipo !== 'primera' && !(typeof respuesta === 'number' && Number.isFinite(respuesta))) return mal('Escribe un número.');
  return f(ej, respuesta);
}
