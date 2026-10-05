import { frac, ZERO, ONE } from './fraction.js';
import { solveIP } from './branchAndBound.js';
import { solveLP } from './simplex.js';
import { cortePlanoDeFila } from './cortes.js';
import { createPRNG } from './ejercicios.js';

/**
 * Práctica del tema 1.2 (entera mixta): ejercicios con corrección.
 * Dominio puro: todo el azar sale de createPRNG (Mulberry32) con semilla.
 * Los datos del enunciado y de la solución viajan como texto («7/2») para que
 * sean comparables y serializables.
 */

export const TIPOS = ['clasificar', 'ramificar', 'poda', 'corte', 'resolver'];

export const TIPOS_ETIQUETA = {
  clasificar: 'Clasificar',
  ramificar: 'Ramificar',
  poda: 'Poda',
  corte: 'Corte',
  resolver: 'Resolver',
};

export const TOLERANCIA = 0.01;

/** Con «Mezcla», el tipo sale de la semilla (determinista). */
export const tipoDeMezcla = (semilla) => TIPOS[Math.abs(Math.floor(semilla)) % TIPOS.length];

// --------------------------------------------------------------------------
// Utilidades
// --------------------------------------------------------------------------

const rngDe = (tipo, semilla) => {
  const idx = TIPOS.indexOf(tipo);
  if (idx < 0) throw new Error(`Tipo de ejercicio desconocido: ${tipo}`);
  return createPRNG((((Math.floor(semilla) >>> 0) * 31) + (idx + 1) * 7919) >>> 0);
};
const entre = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const elegir = (rng, arr) => arr[Math.floor(rng() * arr.length)];
function barajar(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const num = (f) => frac(f).toString();
/** Fracción con su decimal: «3,5 (7/2)». */
const dual = (f) => frac(f).toDual(2);
const sub = (i) => String(i).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]);
const xs = (i) => `x${sub(i)}`;

/** Convierte lo que escribió el estudiante a Fraction, o null si no se entiende. */
export function leerNumero(texto) {
  if (texto === undefined || texto === null) return null;
  const s = String(texto).trim().replace(/\s+/g, '').replace(/^\+/, '');
  if (!s) return null;
  if (!/^-?(\d+([.,]\d+)?|[.,]\d+)(\/\d+([.,]\d+)?)?$/.test(s)) return null;
  try {
    return frac(s.replace(/^(-?)([.,])/, '$10$2'));
  } catch {
    return null;
  }
}
const MSG_ILEGIBLE = 'No entendí este valor: escribe un número como 3, 2,5 o 7/2.';

// --------------------------------------------------------------------------
// 1. Clasificar
// --------------------------------------------------------------------------

const BANCO_CLASIFICAR = [
  { texto: 'Número de camiones que se despachan', tipo: 'entera' },
  { texto: 'Litros de jugo producidos', tipo: 'continua' },
  { texto: 'Número de operarios que se contratan', tipo: 'entera' },
  { texto: 'Kilogramos de harina que se compran', tipo: 'continua' },
  { texto: 'Metros cuadrados de vidrio que se instalan', tipo: 'continua' },
  { texto: 'Número de máquinas que se compran', tipo: 'entera' },
  { texto: 'Horas de trabajo asignadas a un proceso', tipo: 'continua' },
  { texto: 'Número de cubículos que se construyen', tipo: 'entera' },
];

function generarClasificar(rng) {
  const enteras = barajar(rng, BANCO_CLASIFICAR.filter((s) => s.tipo === 'entera'));
  const continuas = barajar(rng, BANCO_CLASIFICAR.filter((s) => s.tipo === 'continua'));
  const sel = [enteras[0], continuas[0]];
  const resto = barajar(rng, [...enteras.slice(1), ...continuas.slice(1)]);
  sel.push(resto[0]);
  const situaciones = barajar(rng, sel);
  return armarClasificar(situaciones);
}

export function armarClasificar(situaciones) {
  const campos = situaciones.map((s, i) => ({
    id: `s${i}`,
    etiqueta: `${i + 1}. ${s.texto}`,
    tipo: 'opcion',
    opciones: [
      { id: 'entera', etiqueta: 'Entera' },
      { id: 'continua', etiqueta: 'Continua' },
    ],
  }));
  const solucion = Object.fromEntries(situaciones.map((s, i) => [`s${i}`, s.tipo]));
  const explicacion = situaciones.map((s, i) =>
    s.tipo === 'entera'
      ? `${i + 1}. «${s.texto}» se cuenta en unidades que no se pueden partir: variable entera.`
      : `${i + 1}. «${s.texto}» se mide en una cantidad que admite fracciones: variable continua.`
  );
  explicacion.push(
    'Solo las variables enteras se ramifican o se cortan; las continuas pueden quedar fraccionarias en el óptimo.'
  );
  return {
    tipo: 'clasificar',
    titulo: 'Clasificar variables',
    enunciado: { situaciones: situaciones.map((s) => s.texto) },
    pregunta: 'Para cada situación, decide si la variable de decisión debe ser entera o continua.',
    campos,
    solucion,
    explicacion,
  };
}

// --------------------------------------------------------------------------
// 2. Ramificar
// --------------------------------------------------------------------------

function valorFraccionario(rng) {
  const d = elegir(rng, [2, 3, 4]);
  let k;
  do k = entre(rng, d, 8 * d); while (k % d === 0);
  return frac(k).div(d);
}

function generarRamificar(rng) {
  const n = rng() < 0.5 ? 3 : 4;
  const roles = ['enteraFrac', 'continuaFrac'];
  const reserva = ['enteraFrac', 'enteraEntera', 'enteraEntera', 'continuaEntera', 'continuaFrac'];
  while (roles.length < n) roles.push(elegir(rng, reserva));
  const variables = barajar(rng, roles).map((r) => ({
    valor: r.endsWith('Frac') ? valorFraccionario(rng) : frac(entre(rng, 0, 8)),
    entera: r.startsWith('entera'),
  }));
  return armarRamificar(variables);
}

/** variables: [{valor, entera}] en orden x1..xn. */
export function armarRamificar(variables) {
  const vars = variables.map((v, i) => ({ nombre: `x${i + 1}`, valor: frac(v.valor), entera: !!v.entera }));
  const validas = vars.filter((v) => v.entera && !v.valor.isInteger());
  if (validas.length === 0) throw new Error('Debe haber al menos una variable entera fraccionaria.');
  const limites = {};
  vars.forEach((v) => {
    limites[v.nombre] = { piso: num(v.valor.floor()), techo: num(v.valor.ceil()) };
  });
  const canonica = validas[0].nombre;
  const nombreBonito = (nm) => xs(Number(nm.slice(1)));
  const lista = (arr) => arr.map((v) => `${nombreBonito(v.nombre)} = ${num(v.valor)}`).join(', ');
  const explicacion = [
    `Variables enteras: ${vars.filter((v) => v.entera).map((v) => nombreBonito(v.nombre)).join(', ')}. Continuas: ${
      vars.filter((v) => !v.entera).map((v) => nombreBonito(v.nombre)).join(', ') || 'ninguna'
    }.`,
    `Candidatas a ramificar (enteras con valor fraccionario): ${lista(validas)}. Sirve cualquiera de ellas.`,
  ];
  vars.filter((v) => !v.entera && !v.valor.isInteger()).forEach((v) =>
    explicacion.push(`${nombreBonito(v.nombre)} = ${num(v.valor)} es fraccionaria, pero es continua: las continuas no se ramifican.`)
  );
  vars.filter((v) => v.entera && v.valor.isInteger()).forEach((v) =>
    explicacion.push(`${nombreBonito(v.nombre)} = ${num(v.valor)} ya es entera: no hace falta ramificarla.`)
  );
  validas.forEach((v) => {
    const l = limites[v.nombre];
    explicacion.push(
      `Si ramificas por ${nombreBonito(v.nombre)} = ${num(v.valor)}: ${nombreBonito(v.nombre)} ≤ ⌊${num(v.valor)}⌋ = ${l.piso} y ${nombreBonito(v.nombre)} ≥ ⌈${num(v.valor)}⌉ = ${l.techo}. Entre ${l.piso} y ${l.techo} no hay enteros.`
    );
  });
  return {
    tipo: 'ramificar',
    titulo: 'Elegir la variable de ramificación',
    enunciado: { variables: vars.map((v) => ({ nombre: v.nombre, valor: num(v.valor), entera: v.entera })) },
    pregunta:
      'Esta es la solución óptima de la relajación de un nodo. Elige la variable por la que ramificar y escribe las cotas de las dos ramas (xₖ ≤ cota inferior y xₖ ≥ cota superior).',
    campos: [
      {
        id: 'variable',
        etiqueta: 'Variable por la que ramificar',
        tipo: 'opcion',
        opciones: [
          ...vars.map((v) => ({ id: v.nombre, etiqueta: nombreBonito(v.nombre) })),
          { id: 'ninguna', etiqueta: 'Ninguna: ya es óptimo' },
        ],
      },
      { id: 'cotaInf', etiqueta: 'Rama de abajo: la variable es ≤', tipo: 'numero' },
      { id: 'cotaSup', etiqueta: 'Rama de arriba: la variable es ≥', tipo: 'numero' },
    ],
    solucion: { validas: validas.map((v) => v.nombre), limites, canonica },
    explicacion,
  };
}

// --------------------------------------------------------------------------
// 3. Poda
// --------------------------------------------------------------------------

export const ACCIONES_PODA = [
  { id: 'infactibilidad', etiqueta: 'Podar por infactibilidad' },
  { id: 'cota', etiqueta: 'Podar por cota' },
  { id: 'incumbente', etiqueta: 'Actualizar el incumbente (solución entera)' },
  { id: 'ramificar', etiqueta: 'Ramificar' },
];

/** Regla de poda, en este orden. nodo = {factible, z?, enterasEnteras?}. */
export function decidirPoda({ sentido, incumbente, nodo }) {
  if (!nodo.factible) return 'infactibilidad';
  if (incumbente !== null && incumbente !== undefined) {
    const z = frac(nodo.z);
    const zs = frac(incumbente);
    if (sentido === 'max' ? z.lte(zs) : z.gte(zs)) return 'cota';
  }
  return nodo.enterasEnteras ? 'incumbente' : 'ramificar';
}

function valorCuartos(rng, a, b) {
  return frac(entre(rng, a * 4, b * 4)).div(4);
}

function generarPoda(rng) {
  const sentido = rng() < 0.5 ? 'max' : 'min';
  const objetivo = ACCIONES_PODA[Math.floor(rng() * 4)].id;
  const conInc = objetivo === 'cota' ? true : rng() < 0.6;
  const zs = rng() < 0.5 ? frac(entre(rng, 30, 150)) : valorCuartos(rng, 30, 150);
  const incumbente = conInc ? zs : null;
  const peor = (d) => (sentido === 'max' ? zs.sub(d) : zs.add(d));
  const mejor = (d) => (sentido === 'max' ? zs.add(d) : zs.sub(d));
  const dif = () => (rng() < 0.5 ? frac(entre(rng, 1, 20)) : valorCuartos(rng, 0, 20).add(frac(1).div(4)));
  const libre = () => (rng() < 0.5 ? frac(entre(rng, 20, 200)) : valorCuartos(rng, 20, 200));
  let nodo;
  if (objetivo === 'infactibilidad') {
    nodo = { factible: false };
  } else if (objetivo === 'cota') {
    const d = rng() < 0.25 ? ZERO : dif();
    nodo = { factible: true, z: num(peor(d)), enterasEnteras: rng() < 0.5 };
  } else {
    const z = conInc ? mejor(dif()) : libre();
    nodo = { factible: true, z: num(z), enterasEnteras: objetivo === 'incumbente' };
  }
  return armarPoda({ sentido, incumbente: incumbente ? num(incumbente) : null, nodo });
}

export function armarPoda({ sentido, incumbente = null, nodo }) {
  const inc = incumbente === null || incumbente === undefined ? null : num(incumbente);
  const nd = nodo.factible
    ? { factible: true, z: num(nodo.z), enterasEnteras: !!nodo.enterasEnteras }
    : { factible: false };
  const accion = decidirPoda({ sentido, incumbente: inc, nodo: nd });
  const verbo = sentido === 'max' ? 'maximizar' : 'minimizar';
  const explicacion = [];
  if (accion === 'infactibilidad') {
    explicacion.push('El nodo es infactible: ninguna solución cumple las restricciones y las cotas de esta rama. Se poda por infactibilidad.');
  } else if (accion === 'cota') {
    const cmp = sentido === 'max' ? '≤' : '≥';
    const iguales = frac(nd.z).eq(inc);
    explicacion.push(
      `Hay incumbente z* = ${dual(inc)} y se quiere ${verbo}. Cota del nodo Z = ${dual(nd.z)}, y ${dual(nd.z)} ${cmp} ${dual(inc)}: ningún descendiente puede ${iguales ? 'mejorar' : 'superar'} el incumbente. Se poda por cota.`
    );
    if (iguales) explicacion.push('La igualdad también poda: con la misma Z no se mejora el incumbente.');
  } else if (accion === 'incumbente') {
    explicacion.push(
      inc === null
        ? `Aún no hay incumbente y el nodo es factible con las variables enteras en valores enteros (Z = ${dual(nd.z)}). Es una solución entera: se vuelve el incumbente.`
        : `El nodo es factible, su Z = ${dual(nd.z)} mejora el incumbente z* = ${dual(inc)} (no se poda por cota) y las enteras salen enteras. Se actualiza el incumbente.`
    );
  } else {
    explicacion.push(
      inc === null
        ? `Aún no hay incumbente, así que no se puede podar por cota. El nodo es factible (Z = ${dual(nd.z)}) pero alguna variable entera sale fraccionaria. Hay que ramificar.`
        : `Z = ${dual(nd.z)} mejora el incumbente z* = ${dual(inc)}, así que no se poda por cota, pero alguna variable entera sale fraccionaria. Hay que ramificar.`
    );
  }
  explicacion.push(
    'Regla, en este orden: infactible → podar por infactibilidad; con incumbente y Z que no mejora (≤ en max, ≥ en min) → podar por cota; enteras enteras → actualizar el incumbente; si no → ramificar.'
  );
  return {
    tipo: 'poda',
    titulo: 'Decidir qué hacer con el nodo',
    enunciado: { sentido, incumbente: inc, nodo: nd },
    pregunta: 'Con estos datos del nodo que acabas de resolver, ¿qué se hace?',
    campos: [{ id: 'accion', etiqueta: 'Decisión', tipo: 'opcion', opciones: ACCIONES_PODA.map((a) => ({ ...a })) }],
    solucion: { accion },
    explicacion,
  };
}

// --------------------------------------------------------------------------
// 4. Corte
// --------------------------------------------------------------------------

const DENOMS = [2, 3, 4, 5, 10];
function fraccionesPropias() {
  const m = new Map();
  DENOMS.forEach((q) => {
    for (let p = 1; p < q; p++) {
      const f = frac(p).div(q);
      m.set(f.toString(), f);
    }
  });
  return [...m.values()];
}
const PROPIAS = fraccionesPropias();
const F0S = [...new Set(['1/5', '1/4', '1/3', '2/5', '1/2', '3/5', '2/3', '3/4', '4/5'])].map((s) => frac(s));

function coefDeCategoria(rng, cat, f0) {
  if (cat === 'enteraLe' || cat === 'enteraGt') {
    const cands = PROPIAS.filter((f) => (cat === 'enteraLe' ? f.lte(f0) : f.gt(f0)));
    return { a: elegir(rng, cands).add(entre(rng, -2, 2)), entera: true };
  }
  const cands = PROPIAS.filter((f) => f.lte(frac(3)));
  const mag = elegir(rng, cands).add(entre(rng, 0, 2));
  return { a: cat === 'continuaPos' ? mag : mag.neg(), entera: false };
}

function generarCorte(rng) {
  const f0 = elegir(rng, F0S);
  const b = f0.add(entre(rng, 1, 5));
  const n = entre(rng, 3, 5);
  const fraccional = rng() < 0.25;
  const CATS = ['enteraLe', 'enteraGt', 'continuaPos', 'continuaNeg'];
  let cats;
  if (fraccional) {
    cats = ['enteraLe', 'enteraGt'];
    while (cats.length < n) cats.push(elegir(rng, ['enteraLe', 'enteraGt']));
  } else {
    cats = barajar(rng, CATS).slice(0, Math.min(n, 4));
    while (cats.length < n) cats.push(elegir(rng, CATS));
  }
  cats = barajar(rng, cats);
  let ci = 0;
  let ei = 0;
  const noBasicas = cats.map((cat) => {
    const c = coefDeCategoria(rng, cat, f0);
    const nombre = c.entera ? `y${++ei}` : `s${++ci}`;
    return { nombre, a: c.a, entera: c.entera };
  });
  return armarCorte({ b, noBasicas, tipo: fraccional ? 'fraccional' : 'mixto' });
}

/** noBasicas: [{nombre, a, entera}]. La solución sale de cortePlanoDeFila. */
export function armarCorte({ b, noBasicas, tipo = 'mixto' }) {
  const bf = frac(b);
  const fila = { b: bf, coefs: noBasicas.map((v) => ({ a: frac(v.a), entera: !!v.entera })) };
  const corte = cortePlanoDeFila(fila, { tipo });
  const coefs = {};
  noBasicas.forEach((v, i) => {
    coefs[`c_${v.nombre}`] = num(corte.coefs[i]);
  });
  const f0 = corte.f0;
  const explicacion = [
    `f₀ = parte fraccionaria de ${num(bf)} = ${num(f0)}.`,
  ];
  noBasicas.forEach((v, i) => {
    const a = frac(v.a);
    const c = corte.coefs[i];
    const aTxt = `${v.nombre} (a = ${num(a)}, ${v.entera ? 'entera' : 'continua'})`;
    if (tipo === 'fraccional') {
      explicacion.push(`${aTxt}: corte fraccional, coeficiente = f = parte fraccionaria de ${num(a)} = ${num(c)}.`);
    } else if (v.entera) {
      const fj = a.fractionalPart();
      explicacion.push(
        fj.lte(f0)
          ? `${aTxt}: f = ${num(fj)} ≤ f₀ = ${num(f0)}, así que el coeficiente es f = ${num(c)}.`
          : `${aTxt}: f = ${num(fj)} > f₀ = ${num(f0)}, así que el coeficiente es f₀(1 − f)/(1 − f₀) = ${num(c)}.`
      );
    } else {
      explicacion.push(
        a.gt(ZERO)
          ? `${aTxt}: continua con a > 0, el coeficiente es a = ${num(c)}.`
          : `${aTxt}: continua con a < 0, el coeficiente es f₀(−a)/(1 − f₀) = ${num(c)}.`
      );
    }
  });
  explicacion.push(`Lado derecho = f₀ = ${num(corte.rhs)}. El corte es Σ coef·x ≥ ${num(corte.rhs)}.`);
  return {
    tipo: 'corte',
    titulo: 'Corte de Gomory',
    enunciado: {
      b: num(bf),
      tipoCorte: tipo,
      noBasicas: noBasicas.map((v) => ({ nombre: v.nombre, a: num(v.a), entera: !!v.entera })),
    },
    pregunta:
      `De la fila óptima del tablero (x_B + Σ aⱼ·xⱼ = b) deduce el corte de Gomory ${tipo} en la forma Σ coefⱼ·xⱼ ≥ rhs. Escribe f₀, el coeficiente de cada no básica y el lado derecho (fracciones, como 2/5).`,
    campos: [
      { id: 'f0', etiqueta: 'f₀ (parte fraccionaria de b)', tipo: 'fraccion' },
      ...noBasicas.map((v) => ({
        id: `c_${v.nombre}`,
        etiqueta: `Coeficiente de ${v.nombre} en el corte`,
        tipo: 'fraccion',
      })),
      { id: 'rhs', etiqueta: 'Lado derecho del corte', tipo: 'fraccion' },
    ],
    solucion: { f0: num(f0), coefs, rhs: num(corte.rhs) },
    explicacion,
  };
}

// --------------------------------------------------------------------------
// 5. Resolver
// --------------------------------------------------------------------------

const INTEGER_MIXTO = [false, true];

function resolverMixto(modelo) {
  const constraints = modelo.restricciones.map((r) => ({ a: r.a.map((v) => frac(v)), op: '<=', b: frac(r.b) }));
  const c = modelo.c.map((v) => frac(v));
  const res = solveIP({ sense: 'max', c, constraints, integer: INTEGER_MIXTO });
  return { c, constraints, res };
}

function generarResolver(rng) {
  for (let intento = 0; intento < 200; intento++) {
    const m = entre(rng, 2, 3);
    const modelo = {
      c: [entre(rng, 2, 9), entre(rng, 2, 9)],
      restricciones: Array.from({ length: m }, () => ({
        a: [entre(rng, 1, 9), entre(rng, 1, 9)],
        b: entre(rng, 12, 60),
      })),
    };
    const { c, constraints, res } = resolverMixto(modelo);
    if (res.status !== 'optimal' || !res.relaxation || !res.best) continue;
    if (res.relaxation.x[1].isInteger()) continue;
    if (res.best.z.eq(res.relaxation.z)) continue;
    // Descarta empates entre valores distintos de x2 (la respuesta no sería única).
    const x2 = res.best.x[1];
    const otro = (a, b) => solveLP({ sense: 'max', c, constraints: [...constraints, { a, op: '<=', b }] });
    const otraRama = (r) => r.status === 'optimal' && r.z.eq(res.best.z);
    if (otraRama(otro([ZERO, ONE], x2.sub(1))) || otraRama(otro([ZERO, frac(-1)], x2.add(1).neg()))) continue;
    return armarResolver(modelo);
  }
  return armarResolver({ c: [7, 9], restricciones: [{ a: [-1, 3], b: 6 }, { a: [7, 1], b: 35 }] });
}

/** modelo: {c:[c1,c2], restricciones:[{a:[a1,a2], b}]}  (max, ≤, x1 continua, x2 entera). */
export function armarResolver(modelo) {
  const { c, constraints, res } = resolverMixto(modelo);
  if (res.status !== 'optimal' || !res.relaxation) throw new Error('El modelo no tiene óptimo mixto.');
  const rel = res.relaxation;
  const best = res.best;
  const v = rel.x[1];
  const fmtX = (x) => `(${x.map((t) => num(t)).join('; ')})`;
  const explicacion = [
    `Relajación (x₂ continua): x = ${fmtX(rel.x)}, Z = ${dual(rel.z)}.`,
  ];
  if (v.isInteger()) {
    explicacion.push(`x₂ = ${num(v)} ya es entera: la relajación es el óptimo mixto.`);
  } else {
    const dosRamas = [
      { txt: `x₂ ≤ ${num(v.floor())}`, extra: { a: [ZERO, ONE], op: '<=', b: frac(v.floor()) } },
      { txt: `x₂ ≥ ${num(v.ceil())}`, extra: { a: [ZERO, ONE], op: '>=', b: frac(v.ceil()) } },
    ];
    explicacion.push(`x₂ = ${num(v)} es fraccionaria y debe ser entera: se ramifica en x₂ ≤ ${num(v.floor())} y x₂ ≥ ${num(v.ceil())}.`);
    let mejor = null;
    dosRamas.forEach((r) => {
      const s = solveLP({ sense: 'max', c, constraints: [...constraints, r.extra] });
      if (s.status === 'optimal') {
        explicacion.push(`Rama ${r.txt}: x₁ continua se ajusta, x = ${fmtX(s.x)}, Z = ${dual(s.z)}.`);
        if (!mejor || s.z.gt(mejor.z)) mejor = { ...s, txt: r.txt };
      } else {
        explicacion.push(`Rama ${r.txt}: infactible.`);
      }
    });
    explicacion.push(
      `Como x₁ es continua, en cada rama basta resolver la relajación. Gana la rama con mayor Z (${mejor ? mejor.txt : '—'}): óptimo mixto x = ${fmtX(best.x)}, Z = ${dual(best.z)}; x₂ = ${num(best.x[1])}.`
    );
  }
  return {
    tipo: 'resolver',
    titulo: 'Resolver un modelo mixto',
    enunciado: {
      c: modelo.c.map((t) => num(t)),
      restricciones: modelo.restricciones.map((r) => ({ a: r.a.map((t) => num(t)), b: num(r.b) })),
    },
    pregunta:
      'Resuelve el modelo (máximo; x₁ continua y x₂ entera, ambas ≥ 0). Escribe el Z de la relajación, el valor de x₂ en el óptimo mixto y el Z del óptimo mixto. Acepto fracciones o decimales con error de 0,01.',
    campos: [
      { id: 'zRelajacion', etiqueta: 'Z de la relajación', tipo: 'numero' },
      { id: 'x2', etiqueta: 'x₂ en el óptimo mixto', tipo: 'numero' },
      { id: 'zMixto', etiqueta: 'Z del óptimo mixto', tipo: 'numero' },
    ],
    solucion: { zRelajacion: num(rel.z), x2: num(best.x[1]), zMixto: num(best.z) },
    explicacion,
  };
}

// --------------------------------------------------------------------------
// API
// --------------------------------------------------------------------------

const GENERADORES = {
  clasificar: generarClasificar,
  ramificar: generarRamificar,
  poda: generarPoda,
  corte: generarCorte,
  resolver: generarResolver,
};

export function generar(tipo, semilla) {
  const rng = rngDe(tipo, semilla);
  return { ...GENERADORES[tipo](rng), semilla };
}

export function respuestaCorrecta(ej) {
  const s = ej.solucion;
  switch (ej.tipo) {
    case 'clasificar':
      return { ...s };
    case 'ramificar':
      return { variable: s.canonica, cotaInf: s.limites[s.canonica].piso, cotaSup: s.limites[s.canonica].techo };
    case 'poda':
      return { accion: s.accion };
    case 'corte':
      return { f0: s.f0, ...s.coefs, rhs: s.rhs };
    case 'resolver':
      return { ...s };
    default:
      throw new Error(`Tipo desconocido: ${ej.tipo}`);
  }
}

const OK = 'Correcto.';
const REVISA = 'Revisa este valor.';

function evaluarNumero(campo, texto, esperado) {
  const v = leerNumero(texto);
  const esp = frac(esperado);
  if (v === null) return { ok: false, mensaje: MSG_ILEGIBLE, esperado: num(esp), valor: null };
  const ok =
    campo.tipo === 'fraccion' ? v.eq(esp) : Math.abs(v.toNumber() - esp.toNumber()) <= TOLERANCIA + 1e-9;
  return { ok, valor: v, esperado: num(esp) };
}

const etiquetaOpcion = (campo, id) => (campo.opciones || []).find((o) => o.id === id)?.etiqueta ?? id;

function corregirCampos(ej, resp, calcular) {
  return ej.campos.map((campo) => {
    const r = calcular(campo, resp[campo.id]);
    const esperado = r.esperadoTxt ?? r.esperado;
    let mensaje;
    if (r.mensaje && r.valor === null) mensaje = r.mensaje;
    else if (r.ok) mensaje = OK;
    else mensaje = `${REVISA}${r.nota ? ' ' + r.nota : ''}`;
    return { campo: campo.id, ok: !!r.ok, esperado, mensaje };
  });
}

function textoOpcion(campo, texto) {
  const t = texto === undefined || texto === null ? '' : String(texto).trim();
  return t;
}

export function corregir(ej, respuesta) {
  const resp = respuesta || {};
  const s = ej.solucion;
  let errorComun;
  let detalle;

  switch (ej.tipo) {
    case 'clasificar': {
      detalle = corregirCampos(ej, resp, (campo, t) => {
        const v = textoOpcion(campo, t);
        const esp = s[campo.id];
        if (!v) return { ok: false, esperado: etiquetaOpcion(campo, esp), nota: 'Elige una opción.' };
        return { ok: v === esp, esperado: etiquetaOpcion(campo, esp) };
      });
      break;
    }
    case 'ramificar': {
      const v = textoOpcion(null, resp.variable);
      const validaElegida = s.validas.includes(v);
      const nombreEl = validaElegida ? v : s.canonica;
      const lim = s.limites[nombreEl];
      const esperadas = { cotaInf: lim.piso, cotaSup: lim.techo };
      const info = ej.enunciado.variables.find((x) => x.nombre === v);
      detalle = corregirCampos(ej, resp, (campo, t) => {
        if (campo.id === 'variable') {
          const esp = `${s.validas.map((n) => etiquetaOpcion(campo, n)).join(' o ')} (enteras con valor fraccionario)`;
          if (!v) return { ok: false, esperado: esp, nota: 'Elige una opción.' };
          return { ok: validaElegida, esperado: esp };
        }
        const r = evaluarNumero(campo, t, esperadas[campo.id]);
        return { ...r, esperadoTxt: `${r.esperado} (con ${etiquetaOpcion(ej.campos[0], nombreEl)})` };
      });
      const lo = leerNumero(resp.cotaInf);
      const hi = leerNumero(resp.cotaSup);
      if (info && !info.entera) errorComun = 'Elegiste una variable continua: las continuas no se ramifican, solo las enteras con valor fraccionario.';
      else if (info && info.entera && !validaElegida) errorComun = `Esa variable entera ya tiene valor entero (${info.valor}): no hace falta ramificarla.`;
      else if (v === 'ninguna') errorComun = 'Hay variables enteras con valor fraccionario, así que la solución todavía no es entera: hay que ramificar.';
      else if (lo && hi && lo.eq(hi)) errorComun = 'Pusiste la misma cota en las dos ramas. Entre ⌊v⌋ y ⌈v⌉ no hay enteros: las ramas son ≤ ⌊v⌋ y ≥ ⌈v⌉.';
      else if (validaElegida && lo && hi && !detalle[1].ok && !detalle[2].ok) {
        const val = frac(info.valor);
        const r = Math.round(val.toNumber());
        if (lo.eq(r) || hi.eq(r)) errorComun = 'Parece que redondeaste. Las cotas no se redondean: usa el piso ⌊v⌋ para ≤ y el techo ⌈v⌉ para ≥.';
      }
      break;
    }
    case 'poda': {
      const v = textoOpcion(null, resp.accion);
      const campo = ej.campos[0];
      detalle = corregirCampos(ej, resp, () =>
        v ? { ok: v === s.accion, esperado: etiquetaOpcion(campo, s.accion) } : { ok: false, esperado: etiquetaOpcion(campo, s.accion), nota: 'Elige una opción.' }
      );
      if (v && v !== s.accion) {
        if (s.accion === 'cota' && frac(ej.enunciado.nodo.z).eq(ej.enunciado.incumbente)) {
          errorComun = 'La igualdad también poda: si la Z del nodo es igual al incumbente, no lo mejora.';
        } else if (s.accion === 'cota') {
          errorComun = 'Antes de ramificar o actualizar, compara la Z del nodo con el incumbente: si no lo mejora, se poda por cota.';
        } else if (v === 'cota' && ej.enunciado.incumbente === null) {
          errorComun = 'Sin incumbente no hay con qué comparar: no se puede podar por cota.';
        }
      }
      break;
    }
    case 'corte': {
      const f0 = frac(s.f0);
      const filaDe = (nombre) => ej.enunciado.noBasicas.find((v) => `c_${v.nombre}` === nombre);
      detalle = corregirCampos(ej, resp, (campo, t) => {
        if (campo.id === 'f0') return evaluarNumero(campo, t, s.f0);
        if (campo.id === 'rhs') return evaluarNumero(campo, t, s.rhs);
        return evaluarNumero(campo, t, s.coefs[campo.id]);
      });
      const tipo = ej.enunciado.tipoCorte;
      for (const d of detalle) {
        if (d.ok || d.campo === 'f0' || d.campo === 'rhs') continue;
        const v = filaDe(d.campo);
        const dado = leerNumero(resp[d.campo]);
        if (!v || dado === null) continue;
        const a = frac(v.a);
        const fj = a.fractionalPart();
        // Variantes de error calculadas con el mismo dominio.
        const comoEntera = cortePlanoDeFila({ b: frac(ej.enunciado.b), coefs: [{ a, entera: true }] }, { tipo: 'mixto' }).coefs[0];
        const conAbs = cortePlanoDeFila({ b: frac(ej.enunciado.b), coefs: [{ a: a.abs(), entera: v.entera }] }, { tipo: 'mixto' }).coefs[0];
        if (!v.entera && tipo === 'mixto' && (dado.eq(fj) || dado.eq(comoEntera))) {
          errorComun = 'Usaste la parte fraccionaria f en una variable continua. En continuas con a > 0 el coeficiente es a; con a < 0 es f₀·(−a)/(1 − f₀).';
          break;
        }
        if (v.entera && tipo === 'mixto' && fj.gt(f0) && dado.eq(fj)) {
          errorComun = 'Cuando f > f₀ en una entera no se usa f: el coeficiente es f₀(1 − f)/(1 − f₀).';
          break;
        }
        if (v.entera && a.lt(ZERO) && !fj.isZero() && !a.abs().fractionalPart().eq(fj) && dado.eq(conAbs)) {
          errorComun = 'Revisa la parte fraccionaria de un negativo: −1/2 = −1 + 1/2, así que f = 1/2. Siempre es f = a − ⌊a⌋, entre 0 y 1.';
          break;
        }
      }
      break;
    }
    case 'resolver': {
      detalle = corregirCampos(ej, resp, (campo, t) => evaluarNumero(campo, t, s[campo.id]));
      const zm = leerNumero(resp.zMixto);
      const x2 = leerNumero(resp.x2);
      if (zm && !detalle[2].ok && Math.abs(zm.toNumber() - frac(s.zRelajacion).toNumber()) <= TOLERANCIA + 1e-9) {
        errorComun = 'Ese Z es el de la relajación. El óptimo mixto exige x₂ entera, así que su Z es menor.';
      } else if (x2 && !detalle[1].ok && x2.isInteger() === false) {
        errorComun = 'x₂ debe ser entera en el óptimo mixto; la que es fraccionaria es solo la de la relajación.';
      }
      break;
    }
    default:
      throw new Error(`Tipo desconocido: ${ej.tipo}`);
  }

  return {
    correcto: detalle.every((d) => d.ok),
    detalle,
    explicacion: ej.explicacion,
    ...(errorComun ? { errorComun } : {}),
  };
}
