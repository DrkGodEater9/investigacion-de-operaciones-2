/**
 * Ejercicios de práctica generados por semilla. Mismo (tipo, semilla) → mismo ejercicio.
 * Todas las respuestas salen del dominio (cpm, perfil, asignar); las pruebas las recalculan por otro camino.
 */
import { compilar, cpm } from './cpm.js';
import { perfil, resumen } from './perfil.js';
import { asignar, REGLAS, reglaPorId, claveVisible } from './asignar.js';
import { lista, textoPeriodos } from './format.js';

export const TIPOS = ['uso', 'pico', 'excede', 'holgura', 'desplazar', 'retraso', 'duracion'];

export const ETIQUETAS = {
  uso: 'Recurso en un período',
  pico: 'Pico del histograma',
  excede: 'Períodos sobre el límite',
  holgura: 'Holgura de una actividad',
  desplazar: 'Mover una actividad',
  retraso: 'Qué actividad se retrasa',
  duracion: 'Nueva duración',
};

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
  return { next, int, pick: (arr) => arr[int(0, arr.length - 1)] };
}

const LETRAS = 'ABCDEFGH';
const RECURSOS = ['Obreros', 'Operarios', 'Técnicos', 'Camiones'];

/** Red aleatoria pequeña de un solo recurso (sin límite todavía). */
function redAleatoria(rng) {
  const n = rng.int(5, 7);
  const nombre = rng.pick(RECURSOS);
  const acts = Array.from({ length: n }, (_, i) => {
    const preds = [];
    for (let j = 0; j < i; j++) if (rng.next() < 0.28) preds.push(LETRAS[j]);
    if (i > 0 && !preds.length && rng.next() < 0.5) preds.push(LETRAS[rng.int(0, i - 1)]);
    return { name: LETRAS[i], d: rng.int(1, 4), preds, r: [rng.int(1, 5)] };
  });
  return { recursos: [{ name: nombre, limite: null }], acts };
}

const conLimite = (modelo, limite) => ({ recursos: [{ ...modelo.recursos[0], limite }], acts: modelo.acts });

const ORDEN_TEXTO = 'Los tiempos ES, LS, LF y la holgura son los de la ruta crítica sin límite de recursos. Una actividad que empieza no se interrumpe. Si hay empate se desempata por menor LS, luego menor holgura y luego por orden alfabético.';

function enunciadoBase(modelo, extra) {
  const rec = modelo.recursos[0].name;
  return `Cada actividad de la tabla consume la cantidad indicada de ${rec} en cada período que dura. Una actividad que empieza en el tiempo s ocupa los períodos s + 1 a s + d (el período t es el intervalo (t − 1, t]). ${extra}`;
}

/** Perfil temprano y datos comunes. */
function preparar(modelo) {
  const red = compilar(modelo);
  const c = cpm(red);
  const res = resumen(red, c.ES);
  return { red, c, uso: res.uso[0], pico: res.porRecurso[0].pico };
}

const INTENTOS = 6000;

/* Cada constructor devuelve { modelo, enunciado, pregunta, entrada, respuesta, explicacion, solucionDetallada, extra? } o null si la red no sirve. */
const CONSTRUCTORES = {
  uso(rng) {
    const modelo = redAleatoria(rng);
    const { red, c, uso } = preparar(modelo);
    if (c.T < 6 || c.T > 12) return null;
    const t = rng.int(1, c.T);
    const enCurso = red.nombres.filter((_, i) => c.ES[i] < t && t <= c.EF[i]);
    if (enCurso.length < 2) return null;
    const nom = modelo.recursos[0].name;
    const idx = enCurso.map((x) => red.nombres.indexOf(x));
    return {
      modelo,
      enunciado: enunciadoBase(modelo, 'Cada actividad empieza en su comienzo temprano (ES).'),
      pregunta: `¿Cuántas unidades de ${nom} se necesitan en el período ${t}?`,
      entrada: { tipo: 'numero' },
      respuesta: uso[t - 1],
      explicacion: `Comienzos tempranos: ${red.nombres.map((x, i) => `${x}=${c.ES[i]}`).join(', ')}. En el período ${t} están en curso ${lista(enCurso)}.`,
      solucionDetallada: `${idx.map((i) => `${red.nombres[i]} (ES ${c.ES[i]}, EF ${c.EF[i]}) aporta ${red.r[i][0]}`).join('; ')}. Suma: ${idx.map((i) => red.r[i][0]).join(' + ')} = ${uso[t - 1]}.`,
      extra: { t },
    };
  },
  pico(rng) {
    const modelo = redAleatoria(rng);
    const { red, c, uso, pico } = preparar(modelo);
    if (c.T < 6 || c.T > 12) return null;
    const dist = new Set(uso).size;
    if (dist < 3) return null;
    const nom = modelo.recursos[0].name;
    const ps = uso.map((u, t) => (u === pico ? t + 1 : 0)).filter(Boolean);
    return {
      modelo,
      enunciado: enunciadoBase(modelo, 'Cada actividad empieza en su comienzo temprano (ES) y no hay límite de recursos.'),
      pregunta: `¿Cuál es el valor más alto del histograma de ${nom} (el pico)?`,
      entrada: { tipo: 'numero' },
      respuesta: pico,
      explicacion: `Comienzos tempranos: ${red.nombres.map((x, i) => `${x}=${c.ES[i]}`).join(', ')}. Consumo por período: ${uso.join(', ')}.`,
      solucionDetallada: `El mayor consumo es ${pico}, en ${textoPeriodos(ps)}.`,
    };
  },
  excede(rng) {
    const modelo0 = redAleatoria(rng);
    const { red, c, uso, pico } = preparar(modelo0);
    if (c.T < 6 || c.T > 12 || pico < 4) return null;
    const limite = pico - rng.int(1, 3);
    if (limite < 2) return null;
    const ex = uso.map((u, t) => (u > limite ? t + 1 : 0)).filter(Boolean);
    if (ex.length < 1 || ex.length >= c.T) return null;
    const modelo = conLimite(modelo0, limite);
    const nom = modelo.recursos[0].name;
    const iguales = uso.filter((u) => u >= limite).length;
    return {
      modelo,
      enunciado: enunciadoBase(modelo, `Hay ${limite} ${nom} disponibles. Cada actividad empieza en su comienzo temprano (ES).`),
      pregunta: `¿En cuántos períodos el consumo supera el límite de ${limite}?`,
      entrada: { tipo: 'numero' },
      respuesta: ex.length,
      explicacion: `Consumo por período: ${uso.join(', ')}. Límite: ${limite}.`,
      solucionDetallada: `Superan el límite (consumo mayor que ${limite}) los ${textoPeriodos(ex)}: son ${ex.length}.`,
      extra: { iguales, limite },
    };
  },
  holgura(rng) {
    const modelo = redAleatoria(rng);
    const { red, c } = preparar(modelo);
    if (c.T < 6 || c.T > 12) return null;
    const cand = red.nombres.map((_, i) => i).filter((i) => c.H[i] > 0);
    if (!cand.length) return null;
    const i = rng.pick(cand);
    return {
      modelo,
      enunciado: enunciadoBase(modelo, 'La holgura total de una actividad es cuántos períodos se puede retrasar sin alargar el proyecto: LS − ES.'),
      pregunta: `¿Cuántos períodos de holgura total tiene la actividad ${red.nombres[i]}?`,
      entrada: { tipo: 'numero' },
      respuesta: c.H[i],
      explicacion: `La ruta crítica dura ${c.T} períodos. ${red.nombres[i]} empieza lo más pronto en ${c.ES[i]} (ES) y lo más tarde en ${c.LS[i]} (LS).`,
      solucionDetallada: `Holgura = LS − ES = ${c.LS[i]} − ${c.ES[i]} = ${c.H[i]}.`,
      extra: { act: i },
    };
  },
  desplazar(rng) {
    const modelo = redAleatoria(rng);
    const { red, c, pico } = preparar(modelo);
    if (c.T < 6 || c.T > 12) return null;
    const opciones = [];
    red.nombres.forEach((_, i) => {
      const hasta = (red.succs[i].length ? Math.min(...red.succs[i].map((q) => c.ES[q])) : c.T) - red.d[i];
      for (let s = c.ES[i] + 1; s <= hasta; s++) {
        const starts = c.ES.slice();
        starts[i] = s;
        const nuevo = Math.max(...perfil(red, starts, c.T)[0]);
        if (nuevo < pico) opciones.push({ i, s, nuevo, hasta });
      }
    });
    if (!opciones.length) return null;
    const o = rng.pick(opciones);
    const nom = modelo.recursos[0].name;
    const starts = c.ES.slice();
    starts[o.i] = o.s;
    const usoNuevo = perfil(red, starts, c.T)[0];
    return {
      modelo,
      enunciado: enunciadoBase(modelo, 'Todas empiezan en su comienzo temprano (ES), salvo la que muevas. Mover una actividad sin tocar las demás es posible mientras termine antes de que empiecen sus sucesoras.'),
      pregunta: `Si la actividad ${red.nombres[o.i]} empieza en el tiempo ${o.s} en vez de ${c.ES[o.i]} (las demás no cambian), ¿cuál es el nuevo pico de ${nom}?`,
      entrada: { tipo: 'numero' },
      respuesta: o.nuevo,
      explicacion: `Antes el pico era ${pico}. ${red.nombres[o.i]} pasa de los períodos ${c.ES[o.i] + 1} a ${c.EF[o.i]} a los períodos ${o.s + 1} a ${o.s + red.d[o.i]}; sigue terminando antes de que empiecen sus sucesoras, así que el proyecto dura lo mismo (${c.T}).`,
      solucionDetallada: `Nuevo consumo por período: ${usoNuevo.join(', ')}. El pico es ${o.nuevo}.`,
      extra: { act: o.i, s: o.s, picoAntes: pico },
    };
  },
  retraso(rng) {
    const modelo0 = redAleatoria(rng);
    const { red, c, pico } = preparar(modelo0);
    if (c.T < 6 || c.T > 12) return null;
    const mx = Math.max(...red.r.map((x) => x[0]));
    if (pico - mx < 2) return null;
    const limite = rng.int(mx, pico - 1);
    const regla = rng.pick(REGLAS);
    const modelo = conLimite(modelo0, limite);
    const redL = compilar(modelo);
    const r = asignar(redL, { regla: regla.id });
    if (!r.ok) return null;
    const p = r.log.find((e) => e.decisiones.some((d) => d.accion === 'retrasa'));
    if (!p) return null;
    const retr = p.decisiones.filter((d) => d.accion === 'retrasa');
    if (retr.length !== 1) return null;
    const claves = p.elegibles.map((i) => regla.clave(i, r.base, redL));
    if (new Set(claves).size !== claves.length) return null; // sin empates en la clave principal
    const nom = modelo.recursos[0].name;
    const quien = retr[0].act;
    const f = retr[0].falla;
    return {
      modelo,
      regla: regla.id,
      enunciado: enunciadoBase(modelo, `Hay ${limite} ${nom} disponibles. Se programa período a período con la regla «${regla.nombre.toLowerCase()}»: entre las actividades elegibles se atiende primero la de mayor prioridad y empieza solo si cabe. ${ORDEN_TEXTO}`),
      pregunta: 'En el primer período donde alguna actividad no cabe, ¿cuál es la actividad que se retrasa?',
      entrada: { tipo: 'opcion', opciones: red.nombres.slice() },
      respuesta: red.nombres[quien],
      explicacion: `Período ${p.periodo}: en curso ${lista(p.enCurso.map((i) => red.nombres[i]), 'ninguna')} (consumo ${p.usoInicial[0]}). Elegibles por prioridad: ${lista(p.elegibles.map((i) => `${red.nombres[i]} (${regla.corto} ${claveVisible(regla, i, r.base, redL)})`))}.`,
      solucionDetallada: `Al llegar a ${red.nombres[quien]}, el consumo es ${f.uso} y necesita ${f.req}: ${f.uso} + ${f.req} = ${f.uso + f.req} > ${limite}. Por eso se retrasa; las anteriores sí cabían.`,
      extra: { periodo: p.periodo, regla: regla.id },
    };
  },
  duracion(rng) {
    const modelo0 = redAleatoria(rng);
    const { red, c, pico } = preparar(modelo0);
    if (c.T < 6 || c.T > 12) return null;
    const mx = Math.max(...red.r.map((x) => x[0]));
    if (pico - mx < 2) return null;
    const limite = rng.int(mx, pico - 1);
    const regla = rng.pick(REGLAS);
    const modelo = conLimite(modelo0, limite);
    const redL = compilar(modelo);
    const r = asignar(redL, { regla: regla.id });
    if (!r.ok || r.T <= c.T || r.T - c.T > 4) return null;
    const nom = modelo.recursos[0].name;
    return {
      modelo,
      regla: regla.id,
      enunciado: enunciadoBase(modelo, `Hay ${limite} ${nom} disponibles. Se programa período a período con la regla «${regla.nombre.toLowerCase()}»: entre las actividades elegibles se atiende primero la de mayor prioridad y empieza solo si cabe; si no cabe, se retrasa. ${ORDEN_TEXTO}`),
      pregunta: '¿Cuál es la nueva duración del proyecto, en períodos?',
      entrada: { tipo: 'numero' },
      respuesta: r.T,
      explicacion: `Sin límite el proyecto dura ${c.T} períodos. Comienzos con el método: ${red.nombres.map((x, i) => `${x}=${r.starts[i]}`).join(', ')}.`,
      solucionDetallada: `La última actividad en terminar lo hace en el período ${r.T}. Actividades retrasadas: ${lista(r.retrasos.map((x) => `${red.nombres[x.act]} (de ${x.ES} a ${x.inicio})`), 'ninguna')}.`,
      extra: { Tcpm: c.T, regla: regla.id },
    };
  },
};

const MULT = { uso: 1, pico: 2, excede: 3, holgura: 4, desplazar: 5, retraso: 6, duracion: 7 };

export function generarEjercicio(tipo, semilla) {
  const f = CONSTRUCTORES[tipo];
  if (!f) throw new Error('Tipo de ejercicio desconocido: ' + tipo);
  const seed = Number(semilla) >>> 0;
  const rng = mulberry32((seed * 2654435761 + MULT[tipo] * 40503) >>> 0);
  for (let i = 0; i < INTENTOS; i++) {
    const e = f(rng);
    if (e) {
      return { id: `${tipo}-${seed}`, seed, tipo, titulo: ETIQUETAS[tipo], ...e };
    }
  }
  throw new Error(`No se pudo generar el ejercicio ${tipo} con la semilla ${seed}`);
}

/** Corrige la respuesta (número, o nombre de actividad en 'retraso'). */
export function corregir(ej, resp) {
  if (ej.entrada.tipo === 'opcion') {
    const ok = resp === ej.respuesta;
    return {
      correcta: ok,
      mensaje: ok ? `Correcto: se retrasa la actividad ${ej.respuesta}.` : `No: la actividad que se retrasa es ${ej.respuesta}, no ${resp}.`,
      detalle: ok ? null : ej.solucionDetallada,
    };
  }
  const ok = Number(resp) === ej.respuesta;
  if (ok) return { correcta: true, mensaje: `Correcto: ${ej.respuesta}.`, detalle: null };
  let pista = null;
  if (ej.tipo === 'duracion' && Number(resp) === ej.extra.Tcpm) pista = `Ese es el tiempo de la ruta crítica, sin límite de recursos; con el límite la duración cambia.`;
  else if (ej.tipo === 'excede' && Number(resp) === ej.extra.iguales && ej.extra.iguales !== ej.respuesta) pista = `Contaste también los períodos donde el consumo es igual al límite; solo cuentan los que lo superan.`;
  else if (ej.tipo === 'desplazar' && Number(resp) === ej.extra.picoAntes) pista = 'Ese es el pico antes de mover la actividad.';
  return { correcta: false, mensaje: `No: la respuesta correcta es ${ej.respuesta}.`, detalle: pista };
}

export { reglaPorId };
