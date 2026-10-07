/**
 * Generador y corrector de ejercicios de la pestaña «Práctica» del tema 2.1 (Teoría bayesiana de la decisión).
 * Funciones puras, sin React ni DOM. Todo ejercicio es JSON puro y se regenera igual con la misma semilla.
 *
 *   {
 *     id: `${tipo}-${seed}`, tipo, seed, titulo, enunciado, pregunta, explicacion, solucionDetallada,
 *     contexto: string, unidad: string,
 *     problema: Problema,            // ver bayes.js (con indicadores solo en los tipos que los usan)
 *     datos: {...},                  // lo que pregunta el tipo (índices)
 *     entrada: { tipo: 'numero'|'opcion', unidad?, opciones? },
 *     solucion: ...                  // número o índice (corregir() NO confía en él: recalcula con bayes.js)
 *   }
 *
 * Tipos: valorEsperado, decision, veip, posterior, marginal, decisionIndicador, veim, eficiencia, criterio.
 */
import { analizar } from './bayes.js';
import { fmtNum, fmtFactor, fmtPct } from './formato.js';
import { NOTACION, palabrasObjetivo } from './notacion.js';

export const TIPOS = ['valorEsperado', 'decision', 'veip', 'posterior', 'marginal', 'decisionIndicador', 'veim', 'eficiencia', 'criterio'];
const USA_INFO = new Set(['posterior', 'marginal', 'decisionIndicador', 'veim', 'eficiencia']);
const CRITERIOS = ['pesimista', 'optimista', 'laplace', 'savage'];

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

/* ---------------------------------------------------------------- Contextos */

const CONTEXTOS = [
  {
    nombre: 'Terreno petrolero', objetivo: 'max', unidad: 'millones de pesos',
    intro: 'Una empresa debe decidir qué hacer con un terreno cuyo subsuelo no conoce.',
    alternativas: ['Perforar', 'Vender el terreno', 'Arrendar el terreno'],
    estados: { 2: ['Hay petróleo', 'Terreno seco'], 3: ['Petróleo abundante', 'Petróleo escaso', 'Terreno seco'] },
    indicadores: { 2: ['Estudio favorable', 'Estudio desfavorable'], 3: ['Estudio favorable', 'Estudio dudoso', 'Estudio desfavorable'] },
    medio: 'un estudio sísmico',
  },
  {
    nombre: 'Lanzamiento de un producto', objetivo: 'max', unidad: 'millones de pesos',
    intro: 'Una empresa decide cómo lanzar un producto nuevo.',
    alternativas: ['Lanzar a nivel nacional', 'Lanzar en una región', 'Aplazar el lanzamiento'],
    estados: { 2: ['Demanda alta', 'Demanda baja'], 3: ['Demanda alta', 'Demanda media', 'Demanda baja'] },
    indicadores: { 2: ['Encuesta favorable', 'Encuesta desfavorable'], 3: ['Encuesta buena', 'Encuesta regular', 'Encuesta mala'] },
    medio: 'una encuesta de mercado',
  },
  {
    nombre: 'Inversión', objetivo: 'max', unidad: 'millones de pesos',
    intro: 'Un inversionista reparte su dinero según cómo espera que se comporte la economía.',
    alternativas: ['Acciones', 'Bonos', 'Cuenta de ahorros'],
    estados: { 2: ['Economía en expansión', 'Economía en recesión'], 3: ['Economía en expansión', 'Economía estable', 'Economía en recesión'] },
    indicadores: { 2: ['Pronóstico optimista', 'Pronóstico pesimista'], 3: ['Pronóstico optimista', 'Pronóstico neutro', 'Pronóstico pesimista'] },
    medio: 'el pronóstico de una firma analista',
  },
  {
    nombre: 'Mantenimiento de una máquina', objetivo: 'min', unidad: 'millones de pesos (costos)',
    intro: 'Una planta decide cómo tratar una máquina crítica; los pagos son costos y se busca el menor costo esperado.',
    alternativas: ['Reparar ahora', 'Reemplazar la máquina', 'Esperar a la falla'],
    estados: { 2: ['Desgaste leve', 'Desgaste grave'], 3: ['Desgaste leve', 'Desgaste moderado', 'Desgaste grave'] },
    indicadores: { 2: ['Vibración normal', 'Vibración alta'], 3: ['Vibración normal', 'Vibración media', 'Vibración alta'] },
    medio: 'una prueba de vibración',
  },
  {
    nombre: 'Inventario', objetivo: 'min', unidad: 'miles de pesos (costos)',
    intro: 'Una tienda decide cuánta mercancía pedir; los pagos son costos totales y se busca el menor costo esperado.',
    alternativas: ['Pedir poco', 'Pedir una cantidad media', 'Pedir mucho'],
    estados: { 2: ['Demanda baja', 'Demanda alta'], 3: ['Demanda baja', 'Demanda media', 'Demanda alta'] },
    indicadores: { 2: ['Pronóstico bajo', 'Pronóstico alto'], 3: ['Pronóstico bajo', 'Pronóstico medio', 'Pronóstico alto'] },
    medio: 'un pronóstico de ventas',
  },
];

/* ---------------------------------------------------------------- Datos aleatorios */

/** n enteros ≥ minimo que suman total. */
function composicion(rng, total, n, minimo) {
  const r = Array(n).fill(minimo);
  let resto = total - minimo * n;
  while (resto > 0) { r[rng.int(0, n - 1)] += 1; resto -= 1; }
  return r;
}
const unidades = (v) => v.map((u) => u / 20); // múltiplos de 0,05

function generarVerosimilitud(rng, n, K) {
  return Array.from({ length: n }, (_, j) => {
    if (j < K) {
      const diag = rng.int(9, 17);
      const otros = composicion(rng, 20 - diag, K - 1, 1);
      const fila = [];
      let o = 0;
      for (let k = 0; k < K; k++) fila.push(k === j ? diag : otros[o++]);
      return unidades(fila);
    }
    return unidades(composicion(rng, 20, K, 2));
  });
}

function intentarProblema(rng, ctx, conInfo) {
  const m = rng.int(2, 3);
  const n = rng.int(2, 3);
  const K = conInfo ? rng.int(2, 3) : 0;
  const lo = ctx.objetivo === 'max' ? -20 : 5;
  const hi = ctx.objetivo === 'max' ? 80 : 60;
  const p = {
    objetivo: ctx.objetivo,
    alternativas: ctx.alternativas.slice(0, m),
    estados: ctx.estados[n].slice(),
    pagos: Array.from({ length: m }, () => Array.from({ length: n }, () => 10 * rng.int(lo, hi))),
    priori: unidades(composicion(rng, 20, n, 3)),
  };
  if (K) {
    p.indicadores = ctx.indicadores[K].slice();
    p.verosimilitud = generarVerosimilitud(rng, n, K);
  }
  return p;
}

/** ¿El problema sirve para un ejercicio con respuesta única y que enseñe algo? */
function esBueno(p, conInfo) {
  const a = analizar(p);
  const ve = a.sinInfo.ve;
  if (a.sinInfo.optimas.length !== 1) return false;
  const orden = ve.slice().sort((x, y) => (p.objetivo === 'max' ? y - x : x - y));
  if (Math.abs(orden[0] - orden[1]) < 2) return false;
  if (a.perfecta.veip < 5) return false;
  if (!conInfo) return true;
  const m = a.muestral;
  for (const d of m.porIndicador) {
    if (!d.posible || d.optimas.length !== 1) return false;
    const o = d.ve.slice().sort((x, y) => (p.objetivo === 'max' ? y - x : x - y));
    if (Math.abs(o[0] - o[1]) < 2) return false;
  }
  return m.veim >= 2 && m.veim <= a.perfecta.veip - 1 && m.eficiencia > 0.1 && m.eficiencia < 0.95;
}

const FALLBACK = {
  objetivo: 'max',
  alternativas: ['Perforar', 'Vender el terreno'],
  estados: ['Hay petróleo', 'Terreno seco'],
  pagos: [[500, -100], [60, 60]],
  priori: [0.3, 0.7],
  indicadores: ['Estudio favorable', 'Estudio desfavorable'],
  verosimilitud: [[0.8, 0.2], [0.3, 0.7]],
};

function generarProblema(rng, conInfo, extra) {
  for (let t = 0; t < 600; t++) {
    const ctx = rng.pick(CONTEXTOS);
    const p = intentarProblema(rng, ctx, conInfo);
    if (esBueno(p, conInfo) && (!extra || extra(p))) return { ctx, p };
  }
  return { ctx: CONTEXTOS[0], p: JSON.parse(JSON.stringify(FALLBACK)), fallback: true };
}

/* ---------------------------------------------------------------- Textos de cálculo */

const suma = (partes) => partes.join(' + ');
const prod = (a, b) => `${fmtNum(a)}·${fmtFactor(b)}`;

function lineaVE(p, probs, i, cond) {
  const nombre = cond ? `VE(${p.alternativas[i]} | ${cond})` : `VE(${p.alternativas[i]})`;
  const ve = p.pagos[i].reduce((s, v, j) => s + v * probs[j], 0);
  return `${nombre} = ${suma(p.estados.map((_, j) => prod(probs[j], p.pagos[i][j])))} = ${fmtNum(ve)}`;
}

/* ---------------------------------------------------------------- Soluciones (se recalculan al corregir) */

/** Solución de un ejercicio a partir de problema + datos (independiente de lo guardado en ej.solucion). */
export function solucionDe(ej) {
  const p = ej.problema;
  const a = analizar(p);
  const d = ej.datos || {};
  switch (ej.tipo) {
    case 'valorEsperado': return { valor: a.sinInfo.ve[d.i] };
    case 'decision': return { indice: a.sinInfo.optimas[0], valores: a.sinInfo.ve };
    case 'veip': return { valor: a.perfecta.veip };
    case 'posterior': return { valor: a.muestral.posterior[d.j][d.k] };
    case 'marginal': return { valor: a.muestral.marginal[d.k] };
    case 'decisionIndicador': return { indice: a.muestral.porIndicador[d.k].optimas[0], valores: a.muestral.porIndicador[d.k].ve };
    case 'veim': return { valor: a.muestral.veim };
    case 'eficiencia': return { valor: a.muestral.eficiencia * 100 };
    case 'criterio': {
      const c = a.criterios[d.criterio];
      const indice = c.indices[0];
      const valores = d.criterio === 'pesimista' ? a.criterios.peor : d.criterio === 'optimista' ? a.criterios.mejor : d.criterio === 'laplace' ? a.criterios.promedio : a.criterios.arrepMax;
      return { indice, valores };
    }
    default: throw new Error('Tipo de ejercicio desconocido: ' + ej.tipo);
  }
}

const NOMBRE_CRITERIO = {
  pesimista: (o) => (o.regla === 'máximo' ? 'pesimista (maximin)' : 'pesimista (minimax)'),
  optimista: (o) => (o.regla === 'máximo' ? 'optimista (maximax)' : 'optimista (minimin)'),
  laplace: () => 'de Laplace (probabilidades iguales)',
  savage: () => 'de arrepentimiento mínimo (Savage)',
};

function detalleCriterio(p, a, criterio) {
  const o = palabrasObjetivo(p.objetivo);
  const c = a.criterios;
  if (criterio === 'pesimista') {
    return [`Peor pago de cada alternativa (${o.peor === 'menor' ? 'el menor' : 'el mayor'} de su fila):`, ...p.alternativas.map((x, i) => `${x}: ${fmtNum(c.peor[i])}`), `Se elige la alternativa con el ${o.mejor} de esos peores pagos: ${p.alternativas[c.pesimista.indices[0]]}.`];
  }
  if (criterio === 'optimista') {
    return [`Mejor pago de cada alternativa:`, ...p.alternativas.map((x, i) => `${x}: ${fmtNum(c.mejor[i])}`), `Se elige la alternativa con el ${o.mejor} de esos mejores pagos: ${p.alternativas[c.optimista.indices[0]]}.`];
  }
  if (criterio === 'laplace') {
    return [`Promedio simple de cada fila (todos los estados con la misma probabilidad):`, ...p.alternativas.map((x, i) => `${x}: ${fmtNum(c.promedio[i])}`), `Se elige el ${o.mejor} promedio: ${p.alternativas[c.laplace.indices[0]]}.`];
  }
  return [
    `Arrepentimiento = diferencia entre el mejor pago del estado y el pago obtenido. Máximo arrepentimiento por alternativa:`,
    ...p.alternativas.map((x, i) => `${x}: ${fmtNum(c.arrepMax[i])}`),
    `Se elige el menor de los máximos arrepentimientos: ${p.alternativas[c.savage.indices[0]]}.`,
  ];
}

/* ---------------------------------------------------------------- Construcción del ejercicio */

const bloqueTipo = (tipo) => TIPOS.indexOf(tipo) + 1;

export function generarEjercicio(tipo, seed) {
  if (!TIPOS.includes(tipo)) throw new Error('Tipo de ejercicio desconocido: ' + tipo);
  const s = Number.isInteger(seed) && seed > 0 ? seed : 1;
  const rng = mulberry32(s * 7919 + bloqueTipo(tipo) * 104729);
  const conInfo = USA_INFO.has(tipo);

  let criterio;
  const extra = tipo === 'criterio'
    ? (p) => {
      const a = analizar(p);
      const c = a.criterios[criterio];
      const v = { pesimista: a.criterios.peor, optimista: a.criterios.mejor, laplace: a.criterios.promedio, savage: a.criterios.arrepMax }[criterio];
      if (c.indices.length !== 1) return false;
      const ord = v.slice().sort((x, y) => (criterio === 'savage' || p.objetivo === 'min' ? x - y : y - x));
      return Math.abs(ord[0] - ord[1]) >= 2;
    }
    : null;
  if (tipo === 'criterio') criterio = rng.pick(CRITERIOS);
  const { ctx, p } = generarProblema(rng, conInfo, extra);
  const o = palabrasObjetivo(p.objetivo);
  const a = analizar(p);
  const m = a.muestral;

  const ej = {
    id: `${tipo}-${s}`, tipo, seed: s, contexto: ctx.nombre, unidad: ctx.unidad, problema: p, datos: {},
    titulo: ctx.nombre,
    enunciado: `${ctx.intro} Los pagos están en ${ctx.unidad}. La tabla trae los pagos de cada alternativa en cada estado y las probabilidades a priori.`
      + (p.indicadores ? ` Antes de decidir se puede usar ${ctx.medio}; la segunda tabla da su verosimilitud P(resultado | estado).` : ''),
  };

  switch (tipo) {
    case 'valorEsperado': {
      const i = rng.int(0, p.alternativas.length - 1);
      ej.datos = { i };
      ej.pregunta = `Con las probabilidades a priori, ¿cuál es el valor esperado de «${p.alternativas[i]}»? (en ${ctx.unidad})`;
      ej.entrada = { tipo: 'numero', unidad: ctx.unidad };
      ej.solucion = a.sinInfo.ve[i];
      ej.explicacion = 'El valor esperado pondera cada pago con la probabilidad a priori de su estado y suma: VE = Σ P(estado)·pago.';
      ej.solucionDetallada = lineaVE(p, p.priori, i);
      break;
    }
    case 'decision': {
      ej.pregunta = `Con el criterio de Bayes (sin información adicional), ¿qué alternativa se escoge? Se busca el ${o.mejor} valor esperado.`;
      ej.entrada = { tipo: 'opcion', opciones: p.alternativas.slice() };
      ej.solucion = a.sinInfo.optimas[0];
      ej.explicacion = `Se calcula el valor esperado de cada alternativa con las probabilidades a priori y se escoge el ${o.mejor}.`;
      ej.solucionDetallada = [...p.alternativas.map((_, i) => lineaVE(p, p.priori, i)), `Decisión: ${p.alternativas[a.sinInfo.optimas[0]]} (VE = ${fmtNum(a.sinInfo.valor)}).`].join('\n');
      break;
    }
    case 'veip': {
      ej.pregunta = `¿Cuál es el valor esperado de la información perfecta (${NOTACION.veip})? (en ${ctx.unidad})`;
      ej.entrada = { tipo: 'numero', unidad: ctx.unidad };
      ej.solucion = a.perfecta.veip;
      ej.explicacion = `${NOTACION.veip} = ${NOTACION.vecip} − ${NOTACION.vesi} si los pagos son utilidades, y ${NOTACION.vesi} − ${NOTACION.vecip} si son costos. Con información perfecta se elige la mejor alternativa de cada estado.`;
      ej.solucionDetallada = [
        ...p.estados.map((e, j) => `Si ocurre ${e}: ${o.mejor} pago = ${fmtNum(a.perfecta.porEstado[j].valor)}`),
        `${NOTACION.vecip} = ${suma(p.estados.map((_, j) => prod(p.priori[j], a.perfecta.porEstado[j].valor)))} = ${fmtNum(a.perfecta.vecip)}`,
        `${NOTACION.vesi} = ${fmtNum(a.sinInfo.valor)}`,
        `${NOTACION.veip} = ${p.objetivo === 'max' ? `${fmtNum(a.perfecta.vecip)} − ${fmtFactor(a.sinInfo.valor)}` : `${fmtNum(a.sinInfo.valor)} − ${fmtFactor(a.perfecta.vecip)}`} = ${fmtNum(a.perfecta.veip)}`,
      ].join('\n');
      break;
    }
    case 'posterior': {
      const j = rng.int(0, p.estados.length - 1);
      const k = rng.int(0, p.indicadores.length - 1);
      ej.datos = { j, k };
      ej.pregunta = `Si el resultado es «${p.indicadores[k]}», ¿cuál es la probabilidad posterior de «${p.estados[j]}»? Escríbela como decimal (por ejemplo 0,4286).`;
      ej.entrada = { tipo: 'numero', unidad: 'probabilidad' };
      ej.solucion = m.posterior[j][k];
      ej.explicacion = 'Teorema de Bayes: P(estado | resultado) = P(estado)·P(resultado | estado) / P(resultado), con P(resultado) = Σ P(estado)·P(resultado | estado).';
      ej.solucionDetallada = [
        `P(${p.estados[j]} y ${p.indicadores[k]}) = ${prod(p.priori[j], p.verosimilitud[j][k])} = ${fmtNum(m.conjunta[j][k])}`,
        `P(${p.indicadores[k]}) = ${suma(p.estados.map((_, q) => fmtNum(m.conjunta[q][k])))} = ${fmtNum(m.marginal[k])}`,
        `P(${p.estados[j]} | ${p.indicadores[k]}) = ${fmtNum(m.conjunta[j][k])} / ${fmtNum(m.marginal[k])} = ${fmtNum(m.posterior[j][k])}`,
      ].join('\n');
      break;
    }
    case 'marginal': {
      const k = rng.int(0, p.indicadores.length - 1);
      ej.datos = { k };
      ej.pregunta = `¿Cuál es la probabilidad de que el resultado sea «${p.indicadores[k]}», P(${p.indicadores[k]})? Escríbela como decimal.`;
      ej.entrada = { tipo: 'numero', unidad: 'probabilidad' };
      ej.solucion = m.marginal[k];
      ej.explicacion = 'La probabilidad marginal de un resultado suma, sobre todos los estados, la probabilidad a priori por la verosimilitud: P(z) = Σ P(estado)·P(z | estado).';
      ej.solucionDetallada = [
        ...p.estados.map((e, j) => `P(${e} y ${p.indicadores[k]}) = ${prod(p.priori[j], p.verosimilitud[j][k])} = ${fmtNum(m.conjunta[j][k])}`),
        `P(${p.indicadores[k]}) = ${suma(p.estados.map((_, j) => fmtNum(m.conjunta[j][k])))} = ${fmtNum(m.marginal[k])}`,
      ].join('\n');
      break;
    }
    case 'decisionIndicador': {
      const k = rng.int(0, p.indicadores.length - 1);
      ej.datos = { k };
      ej.pregunta = `Si el resultado es «${p.indicadores[k]}», ¿qué alternativa conviene? Usa las probabilidades posteriores y busca el ${o.mejor} valor esperado.`;
      ej.entrada = { tipo: 'opcion', opciones: p.alternativas.slice() };
      const d = m.porIndicador[k];
      ej.solucion = d.optimas[0];
      ej.explicacion = 'Con el resultado conocido se reemplazan las probabilidades a priori por las posteriores y se vuelve a calcular el valor esperado de cada alternativa.';
      ej.solucionDetallada = [
        ...p.estados.map((e, j) => `P(${e} | ${p.indicadores[k]}) = ${fmtNum(m.conjunta[j][k])} / ${fmtNum(m.marginal[k])} = ${fmtNum(m.posterior[j][k])}`),
        ...p.alternativas.map((_, i) => lineaVE(p, p.estados.map((__, j) => m.posterior[j][k]), i, p.indicadores[k])),
        `Decisión: ${p.alternativas[d.optimas[0]]} (VE = ${fmtNum(d.valor)}).`,
      ].join('\n');
      break;
    }
    case 'veim': {
      ej.pregunta = `¿Cuál es el valor esperado de la información muestral (${NOTACION.veim})? (en ${ctx.unidad})`;
      ej.entrada = { tipo: 'numero', unidad: ctx.unidad };
      ej.solucion = m.veim;
      ej.explicacion = `${NOTACION.veim} = ${NOTACION.vecim} − ${NOTACION.vesi} si los pagos son utilidades, y ${NOTACION.vesi} − ${NOTACION.vecim} si son costos. ${NOTACION.vecim} = Σ P(resultado)·(mejor VE con las posteriores).`;
      ej.solucionDetallada = [
        ...m.porIndicador.map((d, k) => `Si ${p.indicadores[k]} (prob. ${fmtNum(m.marginal[k])}): ${p.alternativas[d.optimas[0]]} con VE = ${fmtNum(d.valor)}`),
        `${NOTACION.vecim} = ${suma(m.porIndicador.map((d, k) => prod(m.marginal[k], d.valor)))} = ${fmtNum(m.vecim)}`,
        `${NOTACION.vesi} = ${fmtNum(a.sinInfo.valor)}`,
        `${NOTACION.veim} = ${p.objetivo === 'max' ? `${fmtNum(m.vecim)} − ${fmtFactor(a.sinInfo.valor)}` : `${fmtNum(a.sinInfo.valor)} − ${fmtFactor(m.vecim)}`} = ${fmtNum(m.veim)}`,
      ].join('\n');
      break;
    }
    case 'eficiencia': {
      ej.pregunta = `¿Cuál es la eficiencia de la información muestral (${NOTACION.veim} / ${NOTACION.veip}), en porcentaje?`;
      ej.entrada = { tipo: 'numero', unidad: '%' };
      ej.solucion = m.eficiencia * 100;
      ej.explicacion = `La eficiencia compara lo que aporta la información muestral con lo que aportaría la perfecta: ${NOTACION.veim} / ${NOTACION.veip}.`;
      ej.solucionDetallada = [
        `${NOTACION.vecip} = ${fmtNum(a.perfecta.vecip)}; ${NOTACION.vesi} = ${fmtNum(a.sinInfo.valor)}; ${NOTACION.veip} = ${fmtNum(a.perfecta.veip)}`,
        `${NOTACION.vecim} = ${fmtNum(m.vecim)}; ${NOTACION.veim} = ${fmtNum(m.veim)}`,
        `${NOTACION.eficiencia} = ${fmtNum(m.veim)} / ${fmtNum(a.perfecta.veip)} = ${fmtPct(m.eficiencia)}`,
      ].join('\n');
      break;
    }
    case 'criterio': {
      ej.datos = { criterio };
      ej.pregunta = `Sin usar las probabilidades, ¿qué alternativa escoge el criterio ${NOMBRE_CRITERIO[criterio](o)}?`;
      ej.entrada = { tipo: 'opcion', opciones: p.alternativas.slice() };
      ej.solucion = a.criterios[criterio].indices[0];
      ej.explicacion = {
        pesimista: 'El criterio pesimista mira el peor pago de cada alternativa y escoge la que deja el mejor de los peores.',
        optimista: 'El criterio optimista mira el mejor pago de cada alternativa y escoge la que deja el mejor de los mejores.',
        laplace: 'El criterio de Laplace supone todos los estados igual de probables y promedia los pagos de cada alternativa.',
        savage: 'El criterio de Savage calcula el arrepentimiento (cuánto se deja de ganar o se paga de más frente al mejor pago de cada estado) y escoge la alternativa de menor arrepentimiento máximo.',
      }[criterio];
      ej.solucionDetallada = detalleCriterio(p, a, criterio).join('\n');
      break;
    }
    default: break;
  }
  return ej;
}

/* ---------------------------------------------------------------- Corrección */

const cerca = (x, y, tol) => Math.abs(x - y) <= tol;
const tolDe = (tipo, sol) => {
  if (tipo === 'posterior' || tipo === 'marginal') return 0.0051;
  if (tipo === 'eficiencia') return 1;
  // VEIM: absorbe posteriores redondeadas a 3-4 decimales, pero sin llegar a 0,5 (otra respuesta distinta).
  if (tipo === 'veim') return Math.min(0.3, Math.max(0.2, 0.005 * Math.abs(sol)));
  // valorEsperado y veip son múltiplos exactos de 0,5: la tolerancia no puede llegar a 0,5 o aceptaría una respuesta distinta.
  return Math.max(0.06, Math.min(0.002 * Math.abs(sol), 0.2));
};

/** Pista de qué error cometió la persona, a partir de cifras típicas con las que su respuesta coincide. */
function diagnosticoNumerico(ej, resp, a, tol) {
  const p = ej.problema;
  const d = ej.datos || {};
  const m = a.muestral;
  const pistas = [];
  const es = (v) => v !== null && v !== undefined && Number.isFinite(v) && cerca(resp, v, tol);
  if ((ej.tipo === 'posterior' || ej.tipo === 'marginal') && resp > 1 && resp <= 100) {
    const sol = ej.tipo === 'posterior' ? m.posterior[d.j][d.k] : m.marginal[d.k];
    if (cerca(resp / 100, sol, tol)) pistas.push(`Parece que lo escribiste como porcentaje (${fmtNum(resp)} %). Se pide el decimal: ${fmtNum(sol)}.`);
  }
  switch (ej.tipo) {
    case 'valorEsperado': {
      const prom = p.pagos[d.i].reduce((s, v) => s + v, 0) / p.estados.length;
      if (es(prom)) pistas.push(`Esa cifra es el promedio simple de los pagos de la fila (${fmtNum(prom)}). El valor esperado pondera cada pago con su probabilidad a priori.`);
      a.sinInfo.ve.forEach((v, i) => { if (i !== d.i && es(v)) pistas.push(`Esa cifra es el valor esperado de «${p.alternativas[i]}», no el de «${p.alternativas[d.i]}».`); });
      break;
    }
    case 'veip':
      if (es(a.perfecta.vecip)) pistas.push(`Esa cifra es el ${NOTACION.vecip} (${fmtNum(a.perfecta.vecip)}). Falta compararlo con el valor esperado sin información (${fmtNum(a.sinInfo.valor)}).`);
      if (es(a.sinInfo.valor)) pistas.push(`Esa cifra es el valor esperado sin información. El ${NOTACION.veip} es la diferencia con el ${NOTACION.vecip} (${fmtNum(a.perfecta.vecip)}).`);
      if (a.perfecta.veip > 0 && es(-a.perfecta.veip)) pistas.push(`El signo está al revés: el ${NOTACION.veip} nunca es negativo. ${p.objetivo === 'max' ? 'Con utilidades se resta VE sin información al VEcIP.' : 'Con costos se resta el VEcIP al VE sin información.'}`);
      break;
    case 'posterior': {
      if (es(m.conjunta[d.j][d.k])) pistas.push(`Esa cifra es la probabilidad conjunta P(${p.estados[d.j]} y ${p.indicadores[d.k]}) = ${fmtNum(m.conjunta[d.j][d.k])}. Falta dividir entre la marginal P(${p.indicadores[d.k]}) = ${fmtNum(m.marginal[d.k])}.`);
      if (es(p.verosimilitud[d.j][d.k])) pistas.push(`Esa cifra es la verosimilitud P(${p.indicadores[d.k]} | ${p.estados[d.j]}). La posterior es P(${p.estados[d.j]} | ${p.indicadores[d.k]}), que se obtiene con el teorema de Bayes.`);
      if (es(p.priori[d.j])) pistas.push(`Esa cifra es la probabilidad a priori de «${p.estados[d.j]}»; el resultado debe actualizarla.`);
      for (let q = 0; q < p.estados.length; q++) if (q !== d.j && es(m.posterior[q][d.k])) pistas.push(`Esa cifra es la posterior de «${p.estados[q]}», no la de «${p.estados[d.j]}».`);
      break;
    }
    case 'marginal': {
      const prom = p.verosimilitud.reduce((s, f) => s + f[d.k], 0) / p.estados.length;
      if (es(prom)) pistas.push(`Esa cifra es el promedio simple de la columna de verosimilitudes (${fmtNum(prom)}). Hay que ponderar con las probabilidades a priori: P = Σ P(estado)·P(${p.indicadores[d.k]} | estado).`);
      p.estados.forEach((e, j) => { if (es(m.conjunta[j][d.k])) pistas.push(`Esa cifra es solo la conjunta con «${e}». La marginal suma las conjuntas de todos los estados.`); });
      break;
    }
    case 'veim':
      if (es(m.vecim)) pistas.push(`Esa cifra es el ${NOTACION.vecim} (${fmtNum(m.vecim)}). Falta compararlo con el valor esperado sin información (${fmtNum(a.sinInfo.valor)}).`);
      if (es(a.perfecta.veip)) pistas.push(`Esa cifra es el ${NOTACION.veip} (información perfecta). El ${NOTACION.veim} usa la información muestral, con las posteriores.`);
      if (es(a.sinInfo.valor)) pistas.push('Esa cifra es el valor esperado sin información.');
      break;
    case 'eficiencia':
      if (es(m.veim)) pistas.push(`Esa cifra es el ${NOTACION.veim} (${fmtNum(m.veim)}); falta dividirlo entre el ${NOTACION.veip} (${fmtNum(a.perfecta.veip)}).`);
      if (m.veim > 0 && es((a.perfecta.veip / m.veim) * 100)) pistas.push(`Dividiste al revés: la eficiencia es ${NOTACION.veim} / ${NOTACION.veip}, no ${NOTACION.veip} / ${NOTACION.veim}.`);
      break;
    default: break;
  }
  return pistas;
}

/**
 * Corrige una respuesta (número u índice de opción) recalculando todo con bayes.js.
 * → { correcta, mensaje, detalle }
 */
export function corregir(ej, resp) {
  const p = ej.problema;
  const a = analizar(p);
  const sol = solucionDe(ej);

  if (ej.entrada.tipo === 'opcion') {
    const elegida = resp;
    if (!Number.isInteger(elegida) || elegida < 0 || elegida >= p.alternativas.length) {
      return { correcta: false, mensaje: 'Elige una de las opciones.', detalle: '' };
    }
    const ok = elegida === sol.indice;
    const cual = (i) => p.alternativas[i];
    const o = palabrasObjetivo(p.objetivo);
    if (ej.tipo === 'criterio') {
      const crit = ej.datos.criterio;
      const etiqueta = { pesimista: 'peor pago', optimista: 'mejor pago', laplace: 'promedio', savage: 'arrepentimiento máximo' }[crit];
      const lista = sol.valores.map((v, i) => `${cual(i)}: ${fmtNum(v)}`).join('; ');
      return ok
        ? { correcta: true, mensaje: `Correcto: ${cual(sol.indice)}.`, detalle: `${etiqueta[0].toUpperCase() + etiqueta.slice(1)} por alternativa: ${lista}.` }
        : {
          correcta: false,
          mensaje: `Incorrecto. La respuesta es ${cual(sol.indice)}.`,
          detalle: `Elegiste ${cual(elegida)}. ${etiqueta[0].toUpperCase() + etiqueta.slice(1)} por alternativa: ${lista}. El criterio ${NOMBRE_CRITERIO[crit](o)} no usa las probabilidades; mira la otra explicación en Teoría.`,
        };
    }
    const lista = sol.valores.map((v, i) => `VE(${cual(i)}) = ${fmtNum(v)}`).join('; ');
    if (ok) return { correcta: true, mensaje: `Correcto: ${cual(sol.indice)}.`, detalle: lista + '.' };
    let extra = '';
    if (ej.tipo === 'decisionIndicador') {
      const prior = a.sinInfo.optimas[0];
      if (elegida === prior) extra = ` Elegiste la mejor alternativa sin información (a priori); con el resultado «${p.indicadores[ej.datos.k]}» las probabilidades cambian y hay que usar las posteriores.`;
    }
    return {
      correcta: false,
      mensaje: `Incorrecto. La respuesta es ${cual(sol.indice)}.`,
      detalle: `Elegiste ${cual(elegida)} (VE = ${fmtNum(sol.valores[elegida])}), pero ${cual(sol.indice)} tiene el ${o.mejor} valor esperado (${fmtNum(sol.valores[sol.indice])}). ${lista}.${extra}`,
    };
  }

  /* Numérica */
  if (typeof resp !== 'number' || !Number.isFinite(resp)) return { correcta: false, mensaje: 'Escribe un número.', detalle: '' };
  const tol = tolDe(ej.tipo, sol.valor);
  const esperado = ej.tipo === 'eficiencia' ? fmtPct(sol.valor / 100) : fmtNum(sol.valor);
  if (cerca(resp, sol.valor, tol)) return { correcta: true, mensaje: `Correcto: ${esperado}.`, detalle: '' };
  if (ej.tipo === 'eficiencia' && resp > 0 && resp <= 1.5 && cerca(resp * 100, sol.valor, tol)) {
    return { correcta: true, mensaje: `Correcto: ${esperado}.`, detalle: 'Lo escribiste como fracción; también vale. Pedimos porcentaje, así que sería ' + esperado + '.' };
  }
  const pistas = diagnosticoNumerico(ej, resp, a, tol);
  const unidad = ej.tipo === 'eficiencia' ? '' : '';
  return {
    correcta: false,
    mensaje: `Incorrecto. La respuesta es ${esperado}${unidad}. Escribiste ${fmtNum(resp)}.`,
    detalle: pistas.length ? pistas.join(' ') : 'Revisa el cálculo paso a paso en la solución detallada.',
  };
}
