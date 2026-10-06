/**
 * Generador y corrector de ejercicios de la pestaña «Práctica» del tema 1.3
 * (Programación entera binaria). Funciones puras, sin React ni DOM.
 *
 * Todo ejercicio es un objeto 100 % serializable a JSON y se regenera igual con la misma semilla:
 *
 *   {
 *     id: `${tipo}-${seed}`, tipo, seed, titulo, enunciado, pregunta, explicacion,
 *     contexto: string,            // nombre del contexto («Servidores», …)
 *     items: string[],             // nombre de cada variable (x₁ = items[0], …)
 *     modelo?: Model,              // no existe en 'modelar'
 *     entrada: { tipo: 'opcion'|'multi'|'numero', opciones?: [...] },
 *     solucion: {...}, solucionDetallada?: string,
 *     ...campos propios del tipo (ver abajo)
 *   }
 *
 * Campos que corregir() USA para recalcular (no confía en `solucion`, así los ejercicios
 * armados a mano solo necesitan estos campos):
 *   modelar     -> regla = { tipo, vars?, k?, a?, b? } (índices de variable desde 0), n (nº de ítems; si falta se
 *                  deduce de la primera opción), entrada.opciones = [{ texto, restriccion: {a, op, b} }].
 *                  Respuesta: índice de la opción. Es correcta si su restricción es equivalente a la regla.
 *   factible    -> modelo, datos = { x: [0|1,...] }. entrada.opciones = ['Es factible', 'No es factible: falla «R»', ...].
 *                  Respuesta: índice (0 = es factible; 1 + i = falla la restricción i).
 *   valorZ      -> modelo, datos = { x }. Respuesta: número (tolerancia 1e-6).
 *   enumeracion -> modelo (n = 3). entrada.opciones = ['000', ..., '111'] en orden binario.
 *                  Respuesta: arreglo de índices de las combinaciones factibles.
 *   optimo      -> modelo, entrada.opciones = ['1010', ...] (cadenas de bits). Respuesta: índice.
 *                  Es correcta si la combinación elegida es factible y óptima.
 *   trampa      -> modelo (minimización). Respuesta: número (costo mínimo).
 *   aditivo     -> modelo (minimizar, restricciones >=), version: 'taha'. entrada.opciones = una por variable.
 *                  Respuesta: índice de la variable que se fija primero (branchVar de la raíz de Balas).
 *
 * Variedad: el modelo se muestra aparte en la pantalla, por eso la prueba de variedad cuenta
 * enunciado + JSON del modelo (y de la regla en 'modelar').
 */
import { fmtNum, sub, restriccionTexto } from './format.js';
import { defaultNames } from './modelo.js';
import { evaluate } from './evaluar.js';
import { enumerate } from './enumerar.js';
import { balas } from './balas.js';

export const TIPOS = ['modelar', 'factible', 'valorZ', 'enumeracion', 'optimo', 'trampa', 'aditivo'];

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

// ───────────────────────── Contextos ─────────────────────────

const CONTEXTOS = [
  {
    nombre: 'Centros de distribución', noun: 'centros',
    items: ['Norte 1', 'Norte 2', 'Centro', 'Sur 1', 'Sur 2', 'Sur 3'],
    zona: 'zona norte',
    intro: (n) => `Una empresa evalúa ${n} ubicaciones para abrir centros de distribución.`,
  },
  {
    nombre: 'Torres de comunicación', noun: 'torres',
    items: ['Rural 1', 'Rural 2', 'Urbana 1', 'Urbana 2', 'Urbana 3', 'Urbana 4'],
    zona: 'zona rural',
    intro: (n) => `Un operador evalúa ${n} sitios para construir torres de comunicación.`,
  },
  {
    nombre: 'Servidores', noun: 'servidores',
    items: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
    zona: 'rack A',
    intro: (n) => `Un centro de datos puede encender hasta ${n} servidores.`,
  },
  {
    nombre: 'Proyectos de software', noun: 'proyectos',
    items: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
    zona: 'línea web',
    intro: (n) => `Una empresa de software considera ${n} proyectos.`,
  },
  {
    nombre: 'Módulos de software', noun: 'módulos',
    items: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'],
    zona: 'núcleo',
    intro: (n) => `Un equipo de desarrollo puede activar ${n} módulos de software.`,
  },
];

const RECURSOS = ['Memoria', 'Presupuesto', 'Capacidad', 'Personal', 'Energía', 'Tiempo'];

const bits = (x) => x.join('');
const trio = (x) => `(${x.join(', ')})`;
const OPS = { '<=': '≤', '>=': '≥', '=': '=' };

function leyenda(items) {
  return items.map((it, j) => `${sub('x' + (j + 1))} = ${it}`).join(', ') + '. Cada variable vale 1 si se elige y 0 si no.';
}

function nuevoContexto(rng, n) {
  const ctx = rng.pick(CONTEXTOS);
  return { ctx, items: ctx.items.slice(0, n) };
}

function combinaciones(n) {
  const out = [];
  for (let m = 0; m < 2 ** n; m++) out.push(Array.from({ length: n }, (_, j) => (m >> (n - 1 - j)) & 1));
  return out;
}


function satisface(r, x) {
  let s = 0;
  for (let j = 0; j < x.length; j++) s += (r.a[j] || 0) * x[j];
  if (r.op === '<=') return s <= r.b;
  if (r.op === '>=') return s >= r.b;
  return s === r.b;
}

// ───────────────────────── 1) modelar ─────────────────────────

function reglaCumple(regla, x, n) {
  const vars = regla.vars || Array.from({ length: n }, (_, j) => j);
  const suma = vars.reduce((t, j) => t + x[j], 0);
  switch (regla.tipo) {
    case 'aLoSumo': return suma <= regla.k;
    case 'alMenos': return suma >= regla.k;
    case 'exactamente': return suma === regla.k;
    case 'alMenosUno': return suma >= 1;
    case 'excluyentes': return suma <= 1;
    case 'requiere': return !(x[regla.a] === 1 && x[regla.b] === 0);
    case 'juntos': return x[regla.a] === x[regla.b];
    default: throw new Error('Regla desconocida: ' + regla.tipo);
  }
}

function restriccionDeRegla(regla, n) {
  const a = Array(n).fill(0);
  const vars = regla.vars || Array.from({ length: n }, (_, j) => j);
  switch (regla.tipo) {
    case 'aLoSumo': vars.forEach((j) => { a[j] = 1; }); return { a, op: '<=', b: regla.k };
    case 'alMenos': vars.forEach((j) => { a[j] = 1; }); return { a, op: '>=', b: regla.k };
    case 'exactamente': vars.forEach((j) => { a[j] = 1; }); return { a, op: '=', b: regla.k };
    case 'alMenosUno': vars.forEach((j) => { a[j] = 1; }); return { a, op: '>=', b: 1 };
    case 'excluyentes': vars.forEach((j) => { a[j] = 1; }); return { a, op: '<=', b: 1 };
    case 'requiere': a[regla.a] = 1; a[regla.b] = -1; return { a, op: '<=', b: 0 };
    case 'juntos': a[regla.a] = 1; a[regla.b] = -1; return { a, op: '=', b: 0 };
    default: throw new Error('Regla desconocida: ' + regla.tipo);
  }
}

function textoRestriccion(r, names) {
  return restriccionTexto({ names, constraints: [{ a: r.a, op: r.op, b: r.b }] }, 0);
}

function equivalente(regla, r, n) {
  return combinaciones(n).every((x) => reglaCumple(regla, x, n) === satisface(r, x));
}

function mutaciones(base, regla, n) {
  const out = [];
  for (const op of ['<=', '>=', '=']) if (op !== base.op) out.push({ a: base.a.slice(), op, b: base.b });
  for (const d of [-2, -1, 1, 2]) out.push({ a: base.a.slice(), op: base.op, b: base.b + d });
  for (let j = 0; j < n; j++) {
    if (base.a[j] !== 0) {
      const a = base.a.slice(); a[j] = 0;
      out.push({ a, op: base.op, b: base.b });
      const a2 = base.a.slice(); a2[j] = -a2[j];
      out.push({ a: a2, op: base.op, b: base.b });
    } else {
      const a = base.a.slice(); a[j] = 1;
      out.push({ a, op: base.op, b: base.b });
    }
  }
  if (regla.tipo === 'requiere' || regla.tipo === 'juntos') {
    const a = Array(n).fill(0); a[regla.a] = -1; a[regla.b] = 1; // intercambia a y b
    out.push({ a, op: base.op, b: base.b });
  }
  if (base.op !== '=') out.push({ a: base.a.slice(), op: '=', b: base.b });
  return out.filter((r) => r.a.some((v) => v !== 0));
}

function generarModelar(rng, seed) {
  const n = rng.int(4, 6);
  const { ctx, items } = nuevoContexto(rng, n);
  const tipo = rng.pick(['aLoSumo', 'alMenos', 'exactamente', 'alMenosUno', 'excluyentes', 'requiere', 'juntos']);
  const todos = Array.from({ length: n }, (_, j) => j);
  let regla;
  let texto;
  const nom = (j) => items[j];
  if (tipo === 'aLoSumo') {
    const k = rng.int(2, n - 2);
    regla = { tipo, vars: todos, k };
    texto = `No se pueden elegir más de ${k} de los ${n} ${ctx.noun}.`;
  } else if (tipo === 'alMenos') {
    const k = rng.int(2, n - 2);
    regla = { tipo, vars: todos, k };
    texto = `Se deben elegir al menos ${k} de los ${n} ${ctx.noun}.`;
  } else if (tipo === 'exactamente') {
    const k = rng.int(1, n - 1);
    regla = { tipo, vars: todos, k };
    texto = `Se deben elegir exactamente ${k} de los ${n} ${ctx.noun}.`;
  } else if (tipo === 'alMenosUno') {
    regla = { tipo, vars: [0, 1] };
    texto = `Al menos uno de ${nom(0)} o ${nom(1)} debe quedar elegido (${ctx.zona}).`;
  } else if (tipo === 'excluyentes') {
    const vars = rng.shuffle(todos).slice(0, rng.int(2, 3)).sort((p, q) => p - q);
    regla = { tipo, vars };
    const lista = vars.map(nom).join(', ');
    texto = `No se pueden elegir juntos ${lista}: a lo sumo uno de ${vars.length === 2 ? 'los dos' : 'los tres'}.`;
  } else {
    const [a, b] = rng.shuffle(todos).slice(0, 2);
    regla = { tipo, a, b };
    texto = tipo === 'requiere'
      ? `${nom(a)} solo puede elegirse si también se elige ${nom(b)}.`
      : `${nom(a)} y ${nom(b)} deben elegirse siempre juntos.`;
  }
  const base = restriccionDeRegla(regla, n);
  const names = defaultNames(n);
  const vistos = new Set([JSON.stringify(base)]);
  const distractores = [];
  for (const m of rng.shuffle(mutaciones(base, regla, n))) {
    const k = JSON.stringify(m);
    if (vistos.has(k) || equivalente(regla, m, n)) continue;
    if (vistos.has(textoRestriccion(m, names))) continue;
    vistos.add(k); vistos.add(textoRestriccion(m, names));
    distractores.push(m);
    if (distractores.length === 3) break;
  }
  const opciones = rng.shuffle([base, ...distractores]).map((r) => ({
    texto: textoRestriccion(r, names),
    restriccion: { a: r.a, op: r.op, b: r.b },
  }));
  const indice = opciones.findIndex((o) => JSON.stringify(o.restriccion) === JSON.stringify(base));
  return {
    id: `modelar-${seed}`, tipo: 'modelar', seed,
    titulo: 'Modelar una condición',
    contexto: ctx.nombre, items, n, regla,
    enunciado: `${ctx.intro(n)} Variables: ${leyenda(items)}\nCondición: ${texto}`,
    pregunta: '¿Cuál restricción expresa esta condición?',
    entrada: { tipo: 'opcion', opciones },
    solucion: { indice },
    explicacion: 'Para modelar una condición lógica con variables binarias se traduce cada frase a una suma: '
      + '«a lo sumo» es ≤, «al menos» es ≥, «exactamente» es =, y «si A entonces B» se escribe xA − xB ≤ 0.',
  };
}

// ───────────────────────── Modelos generales ─────────────────────────

/** Modelo con n variables y m restricciones (coeficientes 1..9) y costos 2..14. */
function modeloGeneral(rng, n, m, x, sense) {
  const nombres = rng.shuffle(RECURSOS).slice(0, m);
  const constraints = nombres.map((name) => {
    const a = Array.from({ length: n }, () => rng.int(1, 9));
    const op = rng.pick(['<=', '>=']);
    const s = a.reduce((t, v, j) => t + v * (x ? x[j] : rng.int(0, 1)), 0);
    const b = Math.max(1, s + rng.int(-4, 4));
    return { name, a, op, b };
  });
  return {
    sense,
    names: defaultNames(n),
    c: Array.from({ length: n }, () => rng.int(2, 14)),
    constraints,
  };
}

const violadas = (model, x) => model.constraints.map((r, i) => (satisface(r, x) ? -1 : i)).filter((i) => i >= 0);

// ───────────────────────── 2) factible ─────────────────────────

function generarFactible(rng, seed) {
  const n = rng.int(3, 5);
  const { ctx, items } = nuevoContexto(rng, n);
  let modelo; let x; let fallan;
  for (let i = 0; i < 500; i++) {
    x = Array.from({ length: n }, () => rng.int(0, 1));
    modelo = modeloGeneral(rng, n, rng.int(2, 3), x, rng.pick(['max', 'min']));
    fallan = violadas(modelo, x);
    if (fallan.length <= 1) break;
  }
  const indice = fallan.length === 0 ? 0 : 1 + fallan[0];
  return {
    id: `factible-${seed}`, tipo: 'factible', seed,
    titulo: '¿Es factible la combinación?',
    contexto: ctx.nombre, items, modelo, datos: { x },
    enunciado: `${ctx.intro(n)} Variables: ${leyenda(items)}\nSe propone la combinación x = ${trio(x)}.`,
    pregunta: `¿La combinación ${trio(x)} es factible?`,
    entrada: { tipo: 'opcion', opciones: ['Es factible', ...modelo.constraints.map((r) => `No es factible: falla «${r.name}»`)] },
    solucion: { indice },
    explicacion: 'Una combinación es factible si cumple TODAS las restricciones: se calcula el lado izquierdo de cada una con los valores de x y se compara con su lado derecho.',
  };
}

// ───────────────────────── 3) valorZ ─────────────────────────

function generarValorZ(rng, seed) {
  const n = rng.int(3, 5);
  const { ctx, items } = nuevoContexto(rng, n);
  const x = Array.from({ length: n }, () => rng.int(0, 1));
  const modelo = modeloGeneral(rng, n, rng.int(1, 2), x, rng.pick(['max', 'min']));
  const valor = evaluate(modelo, x).z;
  return {
    id: `valorZ-${seed}`, tipo: 'valorZ', seed,
    titulo: 'Calcular el valor de Z',
    contexto: ctx.nombre, items, modelo, datos: { x },
    enunciado: `${ctx.intro(n)} Variables: ${leyenda(items)}\nSe elige la combinación x = ${trio(x)}.`,
    pregunta: `¿Cuánto vale Z para x = ${trio(x)}?`,
    entrada: { tipo: 'numero' },
    solucion: { valor },
    explicacion: 'Z se calcula multiplicando cada coeficiente de la función objetivo por el valor de su variable (0 o 1) y sumando.',
  };
}

// ───────────────────────── 4) enumeracion ─────────────────────────

function generarEnumeracion(rng, seed) {
  const n = 3;
  const { ctx, items } = nuevoContexto(rng, n);
  let modelo; let factibles = [];
  const todas = combinaciones(n);
  for (let i = 0; i < 1000; i++) {
    modelo = modeloGeneral(rng, n, rng.int(1, 2), null, rng.pick(['max', 'min']));
    factibles = todas.map((x, k) => (violadas(modelo, x).length === 0 ? k : -1)).filter((k) => k >= 0);
    if (factibles.length >= 2 && factibles.length <= 6) break;
  }
  return {
    id: `enumeracion-${seed}`, tipo: 'enumeracion', seed,
    titulo: 'Combinaciones factibles',
    contexto: ctx.nombre, items, modelo,
    enunciado: `${ctx.intro(n)} Variables: ${leyenda(items)}\nCon 3 variables hay 2³ = 8 combinaciones.`,
    pregunta: 'Marca todas las combinaciones factibles.',
    entrada: { tipo: 'multi', opciones: todas.map(bits) },
    solucion: { indices: factibles },
    explicacion: 'Se prueba cada una de las 8 combinaciones en todas las restricciones; solo las que las cumplen todas son factibles.',
  };
}

// ───────────────────────── 5) optimo ─────────────────────────

function generarOptimo(rng, seed) {
  const n = 4;
  const { ctx, items } = nuevoContexto(rng, n);
  const todas = combinaciones(n);
  for (let intento = 0; intento < 2000; intento++) {
    const max = rng.next() < 0.5;
    const c = Array.from({ length: n }, () => rng.int(2, 12));
    const a = Array.from({ length: n }, () => rng.int(2, 12));
    const sa = a.reduce((t, v) => t + v, 0);
    const b = rng.int(Math.ceil(sa * 0.35), Math.floor(sa * 0.65));
    const modelo = {
      sense: max ? 'max' : 'min', names: defaultNames(n), c,
      constraints: [{ name: max ? 'Presupuesto' : 'Requisito mínimo', a, op: max ? '<=' : '>=', b }],
    };
    const ev = todas.map((x) => evaluate(modelo, x));
    const fact = ev.map((e, k) => (e.feasible ? k : -1)).filter((k) => k >= 0);
    if (!fact.length) continue;
    const mejor = fact.reduce((m, k) => (max ? ev[k].z > ev[m].z : ev[k].z < ev[m].z) ? k : m, fact[0]);
    if (fact.filter((k) => ev[k].z === ev[mejor].z).length !== 1) continue;
    const infact = todas.map((_, k) => k).filter((k) => !ev[k].feasible && k !== 0);
    const noOptimas = fact.filter((k) => k !== mejor && k !== 0);
    if (!infact.length || !noOptimas.length) continue;
    const mejores = infact.filter((k) => (max ? ev[k].z > ev[mejor].z : ev[k].z < ev[mejor].z));
    const kInf = rng.pick(mejores.length ? mejores : infact);
    const kNo = rng.pick(noOptimas);
    const otros = todas.map((_, k) => k).filter((k) => k !== 0 && ![mejor, kInf, kNo].includes(k));
    const kOtro = rng.pick(otros);
    const opciones = rng.shuffle([mejor, kInf, kNo, kOtro]).map((k) => bits(todas[k]));
    return {
      id: `optimo-${seed}`, tipo: 'optimo', seed,
      titulo: 'Elegir la combinación óptima',
      contexto: ctx.nombre, items, modelo,
      enunciado: `${ctx.intro(n)} Variables: ${leyenda(items)}\nSe busca ${max ? 'el mayor beneficio' : 'el menor costo'} cumpliendo la restricción.`,
      pregunta: `¿Cuál de estas combinaciones es la solución óptima?`,
      entrada: { tipo: 'opcion', opciones },
      solucion: { indice: opciones.indexOf(bits(todas[mejor])) },
      solucionDetallada: `x* = ${trio(todas[mejor])}, Z* = ${fmtNum(ev[mejor].z)}`,
      explicacion: 'La solución óptima es la mejor entre las factibles: una combinación no factible no cuenta, aunque su Z se vea mejor.',
    };
  }
  throw new Error('No se pudo generar el ejercicio óptimo');
}

// ───────────────────────── 6) trampa ─────────────────────────

function generarTrampa(rng, seed) {
  const n = rng.int(5, 6);
  const { ctx, items } = nuevoContexto(rng, n);
  const k = rng.int(3, 4);
  const extra = rng.next() < 0.5;
  const unos = Array(n).fill(1);
  const zona = Array(n).fill(0); zona[0] = 1; zona[1] = 1;
  const constraints = [
    { name: `Máximo ${k} ${ctx.noun}`, a: unos, op: '<=', b: k },
    { name: `Al menos uno de ${items[0]} o ${items[1]}`, a: zona, op: '>=', b: 1 },
  ];
  if (extra) constraints.push({ name: 'Al menos 2 en total', a: unos.slice(), op: '>=', b: 2 });
  const modelo = {
    sense: 'min', names: defaultNames(n),
    c: Array.from({ length: n }, () => rng.int(2, 14)), constraints,
  };
  const r = enumerate(modelo, { keepRows: false });
  return {
    id: `trampa-${seed}`, tipo: 'trampa', seed,
    titulo: 'El óptimo no llega al máximo permitido',
    contexto: ctx.nombre, items, modelo,
    enunciado: `${ctx.intro(n)} Variables: ${leyenda(items)}\nSe pueden elegir a lo sumo ${k}, debe quedar elegido al menos uno de ${items[0]} o ${items[1]}`
      + `${extra ? ' y se deben elegir al menos 2 en total' : ''}. Se busca el menor costo.`,
    pregunta: '¿Cuál es el costo mínimo?',
    entrada: { tipo: 'numero' },
    solucion: { valor: r.best.z },
    solucionDetallada: `x* = ${trio(r.best.solutions[0])}, Z* = ${fmtNum(r.best.z)}`,
    explicacion: 'Que una restricción diga «a lo sumo k» no obliga a elegir k elementos: en minimización con costos positivos conviene elegir los menos posibles que cumplan lo exigido.',
  };
}

// ───────────────────────── 7) aditivo ─────────────────────────

function generarAditivo(rng, seed) {
  const n = rng.int(3, 4);
  const { ctx, items } = nuevoContexto(rng, n);
  for (let intento = 0; intento < 5000; intento++) {
    const modelo = {
      sense: 'min', names: defaultNames(n),
      c: Array.from({ length: n }, () => rng.int(1, 9)),
      constraints: rng.shuffle(RECURSOS).slice(0, 2).map((name) => ({
        name, a: Array.from({ length: n }, () => rng.int(1, 5)), op: '>=', b: rng.int(3, 7),
      })),
    };
    if (enumerate(modelo, { keepRows: false }).status !== 'optimo') continue;
    const raiz = balas(modelo).trace[0];
    if (raiz.decision !== 'ramifica') continue;
    const valores = Object.values(raiz.Ij);
    const minimo = Math.min(...valores);
    if (valores.filter((v) => v === minimo).length !== 1) continue;
    return {
      id: `aditivo-${seed}`, tipo: 'aditivo', seed, version: 'taha',
      titulo: 'Primera variable del método aditivo',
      contexto: ctx.nombre, items, modelo,
      enunciado: `${ctx.intro(n)} Variables: ${leyenda(items)}\nSe resuelve el modelo con el método aditivo (enumeración implícita, versión de Taha), partiendo con todas las variables en 0.`,
      pregunta: 'Con todas las variables en 0, ¿cuál conviene fijar primero en 1?',
      entrada: { tipo: 'opcion', opciones: items.map((it, j) => `${sub('x' + (j + 1))} (${it})`) },
      solucion: { indice: raiz.branchVar },
      explicacion: 'En el método aditivo se fija en 1 la variable que más reduce la infactibilidad: se calcula la infactibilidad que quedaría con cada una y se elige la menor.',
    };
  }
  throw new Error('No se pudo generar el ejercicio aditivo');
}

// ───────────────────────── API ─────────────────────────

const GENERADORES = {
  modelar: generarModelar, factible: generarFactible, valorZ: generarValorZ,
  enumeracion: generarEnumeracion, optimo: generarOptimo, trampa: generarTrampa, aditivo: generarAditivo,
};

export function generarEjercicio(tipo, seed) {
  const idx = TIPOS.indexOf(tipo);
  if (idx < 0) throw new Error('Tipo de ejercicio desconocido: ' + tipo);
  const s = seed >>> 0;
  const rng = mulberry32(((s * 2654435761) ^ (idx * 40503 + 12345)) >>> 0);
  return GENERADORES[tipo](rng, s);
}

// ───────────────────────── Corrección ─────────────────────────

const res = (correcta, mensaje, detalle) => ({ correcta, mensaje, detalle });
const invalida = (txt) => res(false, 'Respuesta no válida.', txt);
const nombreVar = (ej, j) => (ej.items && ej.items[j] ? `${sub('x' + (j + 1))} (${ej.items[j]})` : sub((ej.modelo && ej.modelo.names[j]) || 'x' + (j + 1)));

/** «Memoria: 3 ≥ 4 → no se cumple» para cada restricción. */
function lineasRestricciones(modelo, x) {
  const e = evaluate(modelo, x);
  return modelo.constraints.map((r, i) => `${r.name}: ${fmtNum(e.lhs[i])} ${OPS[r.op]} ${fmtNum(r.b)} → ${e.satisfied[i] ? 'se cumple' : 'no se cumple'}`);
}

function corregirModelar(ej, resp) {
  const opciones = ej.entrada.opciones;
  if (!Number.isInteger(resp) || resp < 0 || resp >= opciones.length) return invalida('Elige una de las opciones.');
  const regla = ej.regla;
  const n = ej.n || opciones[0].restriccion.a.length;
  const r = opciones[resp].restriccion;
  const names = defaultNames(n);
  for (const x of combinaciones(n)) {
    const cumpleRegla = reglaCumple(regla, x, n);
    const cumpleTuya = satisface(r, x);
    if (cumpleRegla !== cumpleTuya) {
      return res(false, 'Esa restricción no expresa la condición.',
        `Con x = ${trio(x)}, la regla ${cumpleRegla ? 'se cumple' : 'no se cumple'} pero tu restricción «${textoRestriccion(r, names)}» ${cumpleTuya ? 'se cumple' : 'no se cumple'}.`);
    }
  }
  const correcta = textoRestriccion(restriccionDeRegla(regla, n), names);
  return res(true, '¡Correcto!', `La condición se escribe «${textoRestriccion(r, names)}» (forma estándar: ${correcta}) y coincide con la regla en las ${2 ** n} combinaciones.`);
}

function corregirFactible(ej, resp) {
  const opciones = ej.entrada.opciones;
  if (!Number.isInteger(resp) || resp < 0 || resp >= opciones.length) return invalida('Elige una de las opciones.');
  const x = ej.datos.x;
  const fallan = violadas(ej.modelo, x);
  const verdad = fallan.length === 0 ? 0 : 1 + fallan[0];
  const lineas = lineasRestricciones(ej.modelo, x).join('\n');
  if (resp === verdad) {
    return res(true, '¡Correcto!', `Para x = ${trio(x)}:\n${lineas}\n${fallan.length === 0 ? 'Cumple todas las restricciones, por eso es factible.' : `Falla «${ej.modelo.constraints[fallan[0]].name}», por eso no es factible.`}`);
  }
  return res(false, 'Revisa el cálculo de cada restricción.', `Para x = ${trio(x)}:\n${lineas}\n${fallan.length === 0 ? 'Cumple todas las restricciones: es factible.' : `Falla «${ej.modelo.constraints[fallan[0]].name}»: no es factible.`}`);
}

function corregirValorZ(ej, resp) {
  if (typeof resp !== 'number' || !Number.isFinite(resp)) return invalida('Escribe un número.');
  const x = ej.datos.x;
  const z = evaluate(ej.modelo, x).z;
  const suma = ej.modelo.c.map((c, j) => `${fmtNum(c)}·${x[j]}`).join(' + ');
  const detalle = `Z = ${suma} = ${fmtNum(z)}`;
  if (Math.abs(resp - z) <= 1e-6) return res(true, '¡Correcto!', `${detalle}. Solo suman los coeficientes de las variables que valen 1.`);
  return res(false, `No es ${fmtNum(resp)}.`, `${detalle}. Tu respuesta (${fmtNum(resp)}) difiere en ${fmtNum(Math.abs(resp - z))}.`);
}

function corregirEnumeracion(ej, resp) {
  if (!Array.isArray(resp) || !resp.every((i) => Number.isInteger(i) && i >= 0 && i < 8)) return invalida('Marca las combinaciones factibles.');
  const todas = combinaciones(3);
  const reales = todas.map((x, k) => (violadas(ej.modelo, x).length === 0 ? k : -1)).filter((k) => k >= 0);
  const marcadas = [...new Set(resp)].sort((p, q) => p - q);
  const faltaron = reales.filter((k) => !marcadas.includes(k));
  const sobraron = marcadas.filter((k) => !reales.includes(k));
  const lista = reales.map((k) => bits(todas[k])).join(', ');
  if (!faltaron.length && !sobraron.length) {
    return res(true, '¡Correcto!', `Son factibles ${reales.length} de 8 combinaciones: ${lista}.`);
  }
  const partes = [];
  if (faltaron.length) {
    partes.push('Faltaron:\n' + faltaron.map((k) => `${bits(todas[k])}: ${lineasRestricciones(ej.modelo, todas[k]).join('; ')}`).join('\n'));
  }
  if (sobraron.length) {
    partes.push('Sobraron:\n' + sobraron.map((k) => `${bits(todas[k])}: ${lineasRestricciones(ej.modelo, todas[k]).join('; ')}`).join('\n'));
  }
  partes.push(`Las factibles son: ${lista}.`);
  return res(false, `Tu marcación no coincide: faltaron ${faltaron.length} y sobraron ${sobraron.length}.`, partes.join('\n'));
}

/** Óptimo del modelo por enumeración. */
function optimoDe(modelo) {
  const r = enumerate(modelo, { keepRows: false });
  return r.best;
}

function corregirOptimo(ej, resp) {
  const opciones = ej.entrada.opciones;
  if (!Number.isInteger(resp) || resp < 0 || resp >= opciones.length) return invalida('Elige una de las opciones.');
  const best = optimoDe(ej.modelo);
  const x = opciones[resp].split('').map(Number);
  const e = evaluate(ej.modelo, x);
  const bestTxt = best.solutions.map(bits).join(' o ');
  const optTxt = `El óptimo es ${bestTxt}, con Z = ${fmtNum(best.z)}.`;
  if (e.feasible && Math.abs(e.z - best.z) <= 1e-9) {
    return res(true, '¡Correcto!', `La combinación ${bits(x)} es factible (${lineasRestricciones(ej.modelo, x).join('; ')}) y su Z = ${fmtNum(e.z)} es la mejor. ${optTxt}`);
  }
  if (!e.feasible) {
    return res(false, 'Esa combinación no es factible.',
      `La combinación ${bits(x)} no es factible (${lineasRestricciones(ej.modelo, x).join('; ')}); aunque su Z = ${fmtNum(e.z)}, no cuenta. ${optTxt}`);
  }
  return res(false, 'Es factible, pero no es la mejor.',
    `La combinación ${bits(x)} es factible (${lineasRestricciones(ej.modelo, x).join('; ')}) y tiene Z = ${fmtNum(e.z)}. ${optTxt}`);
}

function corregirTrampa(ej, resp) {
  if (typeof resp !== 'number' || !Number.isFinite(resp)) return invalida('Escribe un número.');
  const best = optimoDe(ej.modelo);
  const x = best.solutions[0];
  const elegidos = x.map((v, j) => (v ? j : -1)).filter((j) => j >= 0);
  const nombres = elegidos.map((j) => nombreVar(ej, j)).join(', ');
  const suma = elegidos.map((j) => fmtNum(ej.modelo.c[j])).join(' + ');
  const tope = ej.modelo.constraints.find((r) => r.op === '<=' && r.a.every((v) => v === 1));
  const k = tope ? tope.b : null;
  const base = `El conjunto óptimo es {${nombres}}: Z = ${suma} = ${fmtNum(best.z)}.`;
  if (Math.abs(resp - best.z) <= 1e-6) {
    return res(true, '¡Correcto!', `${base} Elegir menos elementos que el máximo permitido es válido cuando basta para cumplir las demás restricciones.`);
  }
  return res(false, `El costo mínimo no es ${fmtNum(resp)}.`,
    `${base} Tu respuesta (${fmtNum(resp)}) no coincide. Error típico: ${k === null ? 'elegir el máximo permitido' : `elegir ${k} elementos porque «a lo sumo ${k}» lo permite`}; elegir más elementos sube el costo sin necesidad.`);
}

function corregirAditivo(ej, resp) {
  const opciones = ej.entrada.opciones;
  if (!Number.isInteger(resp) || resp < 0 || resp >= opciones.length) return invalida('Elige una de las opciones.');
  const raiz = balas(ej.modelo).trace[0];
  const lista = Object.keys(raiz.Ij).map(Number).sort((p, q) => p - q)
    .map((j) => `${sub(ej.modelo.names[j])}: ${fmtNum(raiz.Ij[j])}`).join('; ');
  const detalle = `Infactibilidad inicial (todo en 0): ${fmtNum(raiz.I)}. Al fijar cada variable en 1 quedaría: ${lista}. Se elige la menor: ${sub(ej.modelo.names[raiz.branchVar])} con ${fmtNum(raiz.Ij[raiz.branchVar])}.`;
  if (resp === raiz.branchVar) return res(true, '¡Correcto!', detalle);
  const elegida = raiz.Ij[resp];
  return res(false, `Esa variable no es la que más reduce la infactibilidad.`,
    `${detalle} Elegiste ${sub(ej.modelo.names[resp])}, que dejaría ${elegida === undefined ? 'una infactibilidad no calculada' : fmtNum(elegida)}.`);
}

const CORRECTORES = {
  modelar: corregirModelar, factible: corregirFactible, valorZ: corregirValorZ,
  enumeracion: corregirEnumeracion, optimo: corregirOptimo, trampa: corregirTrampa, aditivo: corregirAditivo,
};

/** Corrige la respuesta (índice | arreglo de índices | número según ej.entrada.tipo). */
export function corregir(ej, respuesta) {
  const f = CORRECTORES[ej && ej.tipo];
  if (!f) throw new Error('Tipo de ejercicio desconocido');
  return f(ej, respuesta);
}
