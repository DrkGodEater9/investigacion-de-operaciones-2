/**
 * Generador y corrector de ejercicios de la pestaña «Práctica» del tema 2.2 (Árboles de decisión).
 * Funciones puras, sin React ni DOM. Con la misma semilla se obtiene siempre el mismo ejercicio.
 *
 * Ejercicio (100 % serializable a JSON):
 *   { id: `${tipo}-${seed}`, tipo, seed, titulo, enunciado, pregunta, explicacion, solucionDetallada,
 *     arbol?: Arbol normalizado (se dibuja tal cual; en 'completar' e 'indiferencia' hay probabilidades desconocidas),
 *     tabla?: { alternativas, estados, p, pagos },     // solo 'veip'
 *     datos: {...},                                    // lo que corregir() usa para recalcular
 *     entrada: { tipo: 'numero' | 'opcion', opciones?, tolerancia?, ayuda? },
 *     solucion: valor | índice }
 *
 * corregir() NO confía en `solucion`: recalcula a partir de `arbol` / `datos`.
 */
import { mulberry32 } from './rng.js';
import { evaluar } from './evaluar.js';
import { fmtNum, fmtPar } from './format.js';
import { NOTACION } from './notacion.js';

export const TIPOS = ['valorEsperado', 'completar', 'alternativa', 'secuencial', 'estrategia', 'indiferencia', 'veip', 'riesgo'];

export const ETIQUETAS = {
  valorEsperado: 'Valor esperado',
  completar: 'Completar el árbol',
  alternativa: 'Elegir alternativa',
  secuencial: 'Árbol secuencial',
  estrategia: 'Estrategia óptima',
  indiferencia: 'Punto de indiferencia',
  veip: 'Valor de la información perfecta',
  riesgo: 'Riesgo',
};

const CONTEXTOS = [
  { sujeto: 'Una constructora', unidad: 'millones de pesos', alts: ['Edificio de oficinas', 'Conjunto de casas', 'Centro comercial'], asunto: 'el estado de la economía', e2: ['Economía fuerte', 'Economía débil'], e3: ['Fuerte', 'Normal', 'Débil'], producto: 'el proyecto' },
  { sujeto: 'Una empresa de software', unidad: 'millones de pesos', alts: ['Desarrollo propio', 'Comprar licencia', 'Contratar a un tercero'], asunto: 'la acogida del producto', e2: ['Buena acogida', 'Mala acogida'], e3: ['Alta', 'Media', 'Baja'], producto: 'el producto' },
  { sujeto: 'Un agricultor', unidad: 'millones de pesos', alts: ['Sembrar café', 'Sembrar maíz', 'Sembrar aguacate'], asunto: 'el clima de la temporada', e2: ['Clima favorable', 'Clima adverso'], e3: ['Lluvioso', 'Normal', 'Seco'], producto: 'la cosecha' },
  { sujeto: 'Una cadena de tiendas', unidad: 'millones de pesos', alts: ['Abrir tienda grande', 'Abrir tienda pequeña', 'Vender por internet'], asunto: 'la demanda', e2: ['Demanda alta', 'Demanda baja'], e3: ['Alta', 'Media', 'Baja'], producto: 'el negocio' },
  { sujeto: 'Una fábrica', unidad: 'millones de pesos', alts: ['Ampliar la planta', 'Modernizar la maquinaria', 'Mantener la planta'], asunto: 'los pedidos del próximo año', e2: ['Muchos pedidos', 'Pocos pedidos'], e3: ['Muchos', 'Regulares', 'Pocos'], producto: 'la inversión' },
];

const num = fmtNum;

/* ---------- constructores de árbol (forma normalizada) ---------- */
const F = (valor) => ({ id: '', tipo: 'final', nombre: '', valor, ramas: [] });
const nodo = (tipo, nombre, ramas) => ({ id: '', tipo, nombre, ramas });
const D = (nombre, ramas) => nodo('decision', nombre, ramas);
const A = (nombre, ramas) => nodo('azar', nombre, ramas);
const R = (etiqueta, hijo, { p = null, pago = 0 } = {}) => ({ etiqueta, p, pago, hijo: typeof hijo === 'number' ? F(hijo) : hijo });
function arbolDe(sense, unidad, raiz) {
  let k = 0;
  (function rec(n) { k += 1; n.id = `n${k}`; n.ramas.forEach((r) => rec(r.hijo)); })(raiz);
  return { sense, unidad, raiz };
}

/* ---------- datos aleatorios ---------- */
/** Probabilidades en múltiplos de 0,05 que suman 1. */
function probs(rng, n) {
  if (n === 2) {
    const u = rng.int(3, 17);
    return [u / 20, (20 - u) / 20];
  }
  for (;;) {
    const a = rng.int(3, 10);
    const b = rng.int(3, 10);
    const c = 20 - a - b;
    if (c >= 3) return [a / 20, b / 20, c / 20];
  }
}
const paso10 = (rng, lo, hi) => rng.int(lo / 10, hi / 10) * 10;
const pasoN = (rng, lo, hi, k) => rng.int(Math.ceil(lo / k), Math.floor(hi / k)) * k;

/** Mejor valor y su posición, con el criterio del árbol. */
const mejor = (sense, xs) => {
  const v = sense === 'max' ? Math.max(...xs) : Math.min(...xs);
  return { v, i: xs.indexOf(v), unico: xs.filter((x) => Math.abs(x - v) < 1e-9).length === 1 };
};

/* ---------- tipos ---------- */

function valorEsperado(rng, ctx) {
  const p = probs(rng, 3);
  const valores = rng.shuffle([-40, -20, 0, 20, 40, 60, 80, 100, 120, 160, 200]).slice(0, 3).sort((a, b) => b - a);
  const arbol = arbolDe('max', ctx.unidad, A(`Resultado de ${ctx.producto}`, ctx.e3.map((e, i) => R(e, valores[i], { p: p[i] }))));
  const ve = p.reduce((s, x, i) => s + x * valores[i], 0);
  const terminos = p.map((x, i) => `${num(x)} × ${fmtPar(valores[i])}`).join(' + ');
  return {
    titulo: 'Valor esperado de un nodo de azar',
    enunciado: `${ctx.sujeto} evalúa ${ctx.producto}. Su resultado, en ${ctx.unidad}, depende de ${ctx.asunto}, como muestra el árbol.`,
    pregunta: `¿Cuál es el valor esperado de ${ctx.producto}?`,
    arbol,
    datos: { p, valores },
    entrada: { tipo: 'numero', tolerancia: 0.01, ayuda: 'Puedes usar decimales con coma o punto.' },
    solucion: ve,
    explicacion: `En un nodo de azar el valor esperado es la suma de cada probabilidad por el valor de su rama: ${NOTACION.valorEsperado} = ${terminos} = ${num(ve)}.`,
    solucionDetallada: p.map((x, i) => `${ctx.e3[i]}: ${num(x)} × ${fmtPar(valores[i])} = ${num(x * valores[i])}`).join('\n') + `\nSuma: ${num(ve)}`,
  };
}

function completar(rng, ctx) {
  const p = probs(rng, 3);
  const valores = rng.shuffle([-40, -20, 0, 20, 40, 60, 80, 100, 120, 160, 200]).slice(0, 3).sort((a, b) => b - a);
  const falta = rng.int(0, 2);
  const arbol = arbolDe('max', ctx.unidad, A(`Resultado de ${ctx.producto}`, ctx.e3.map((e, i) => R(e, valores[i], { p: i === falta ? null : p[i] }))));
  const conocidas = p.filter((_, i) => i !== falta);
  const suma = conocidas.reduce((s, x) => s + x, 0);
  const ve = p.reduce((s, x, i) => s + x * valores[i], 0);
  return {
    titulo: 'Árbol con una probabilidad por deducir',
    enunciado: `${ctx.sujeto} evalúa ${ctx.producto}, cuyo resultado (en ${ctx.unidad}) depende de ${ctx.asunto}. En el árbol falta la probabilidad de «${ctx.e3[falta]}».`,
    pregunta: 'Deduce la probabilidad que falta y calcula el valor esperado.',
    arbol,
    datos: { p: p.map((x, i) => (i === falta ? null : x)), valores, falta },
    entrada: { tipo: 'numero', tolerancia: 0.01 },
    solucion: ve,
    explicacion: `Las probabilidades de un nodo de azar suman 1: p(${ctx.e3[falta]}) = 1 − ${conocidas.map((x) => num(x)).join(' − ')} = ${num(1 - suma)}. Después ${NOTACION.valorEsperado} = ${p.map((x, i) => `${num(x)} × ${fmtPar(valores[i])}`).join(' + ')} = ${num(ve)}.`,
    solucionDetallada: `p(${ctx.e3[falta]}) = 1 − ${num(suma)} = ${num(1 - suma)}\n${NOTACION.valorEsperado} = ${num(ve)}`,
  };
}

function alternativa(rng, ctx) {
  const sense = rng.next() < 0.7 ? 'max' : 'min';
  for (let intento = 0; intento < 200; intento++) {
    const hijos = ctx.alts.map((nombre, k) => {
      const segura = k === 2 && rng.next() < 0.4;
      const pago = sense === 'max' ? -paso10(rng, 20, 120) : paso10(rng, 20, 100);
      if (segura) {
        const v = sense === 'max' ? paso10(rng, 100, 260) : paso10(rng, 0, 40);
        return R(nombre, v, { pago });
      }
      const p = probs(rng, 2);
      const a = sense === 'max' ? paso10(rng, 150, 400) : paso10(rng, 80, 220);
      const b = sense === 'max' ? paso10(rng, 0, 120) : paso10(rng, 0, 30);
      return R(nombre, A(ctx.asunto.replace(/^./, (c) => c.toUpperCase()), [R(ctx.e2[0], a, { p: p[0] }), R(ctx.e2[1], b, { p: p[1] })]), { pago });
    });
    const arbol = arbolDe(sense, ctx.unidad, D('Alternativa', hijos));
    const ev = evaluar(arbol);
    const tot = ev.porNodo.n1.ramas.map((r) => r.total);
    const m = mejor(sense, tot);
    const orden = [...tot].sort((x, y) => (sense === 'max' ? y - x : x - y));
    if (!m.unico || Math.abs(orden[0] - orden[1]) < 2) continue;
    const extremo = sense === 'max' ? 'mayor utilidad' : 'menor costo';
    return {
      titulo: sense === 'max' ? 'Elegir la alternativa de mayor utilidad esperada' : 'Elegir la alternativa de menor costo esperado',
      enunciado: sense === 'max'
        ? `${ctx.sujeto} puede escoger una de tres alternativas. Cada rama muestra el pago inmediato (inversión) y los resultados finales, en ${ctx.unidad}, según ${ctx.asunto}.`
        : `${ctx.sujeto} puede escoger una de tres alternativas y quiere minimizar el costo esperado. Cada rama muestra el costo inmediato y los costos finales, en ${ctx.unidad}, según ${ctx.asunto}.`,
      pregunta: `¿Qué alternativa tiene ${extremo} esperada?`,
      arbol,
      datos: {},
      entrada: { tipo: 'opcion', opciones: ctx.alts.slice() },
      solucion: m.i,
      explicacion: `Se calcula el valor de cada alternativa (pago de la rama + valor esperado de su nodo) y se elige ${sense === 'max' ? 'el mayor' : 'el menor'}. ${ctx.alts.map((a, i) => `${a}: ${num(tot[i])}`).join('; ')}. Conviene «${ctx.alts[m.i]}» (${num(m.v)}).`,
      solucionDetallada: ev.porNodo.n1.lineas.concat(ev.orden.filter((id) => id !== 'n1').map((id) => ev.porNodo[id].lineas[0])).join('\n'),
    };
  }
  throw new Error('No se pudo generar la alternativa');
}

/** Árbol de dos etapas: invertir → resultado (bueno / regular) → expandir o no. */
function arbolSecuencial(rng, ctx) {
  for (let intento = 0; intento < 200; intento++) {
    const c = paso10(rng, 20, 60);
    const e = paso10(rng, 30, 80);
    const p = probs(rng, 2);
    const q = probs(rng, 2);
    const va = paso10(rng, 200, 320);
    const vb = paso10(rng, 40, 120);
    const vn = paso10(rng, 80, 180);
    const vr = paso10(rng, 0, 80);
    const arbol = arbolDe('max', ctx.unidad, D('Invertir', [
      R('Invertir', A('Resultado', [
        R('Bueno', D('Expandir', [
          R('Expandir', A('Mercado', [R('Alto', va, { p: q[0] }), R('Bajo', vb, { p: q[1] })]), { pago: -e }),
          R('No expandir', vn),
        ]), { p: p[0] }),
        R('Regular', vr, { p: p[1] }),
      ]), { pago: -c }),
      R('No invertir', 0),
    ]));
    const ev = evaluar(arbol);
    const exp = ev.porNodo[expandirDe(arbol).id];
    const raiz = ev.porNodo[arbol.raiz.id];
    // se piden árboles donde ninguna decisión empata y la segunda es interesante
    if (exp.empates.length !== 1 || raiz.empates.length !== 1) continue;
    if (Math.abs(exp.ramas[0].total - exp.ramas[1].total) < 4) continue;
    if (Math.abs(raiz.ramas[0].total - raiz.ramas[1].total) < 3) continue;
    return { arbol, ev, c, e, p, q, va, vb, vn, vr };
  }
  throw new Error('No se pudo generar el árbol secuencial');
}

/** Nodo «Expandir» del árbol secuencial (primera rama de «Invertir» → «Bueno»). */
const expandirDe = (arbol) => arbol.raiz.ramas[0].hijo.ramas[0].hijo;

function secuencial(rng, ctx) {
  const s = arbolSecuencial(rng, ctx);
  const { ev } = s;
  const lineas = ev.orden.map((id) => ev.porNodo[id]).map((n) => `${n.nombre}: ${n.lineas.join('\n  ')}`);
  return {
    titulo: 'Inducción hacia atrás en un árbol de dos decisiones',
    enunciado: `${ctx.sujeto} puede invertir (costo inicial ${s.c} ${ctx.unidad}) o no hacerlo. Si invierte y el resultado es bueno, decide si expande (costo ${s.e}) o no. Los pagos de las hojas son los resultados finales en ${ctx.unidad}; los costos de invertir y de expandir están en las ramas.`,
    pregunta: 'Resuelve el árbol hacia atrás: ¿cuál es el valor esperado de la mejor estrategia?',
    arbol: s.arbol,
    datos: {},
    entrada: { tipo: 'numero', tolerancia: 0.01 },
    solucion: ev.valor,
    explicacion: `Se empieza por la derecha: primero el nodo «Mercado» (valor esperado), luego «Expandir» (mejor de sus dos ramas), después «Resultado» (valor esperado) y por último la decisión inicial. El valor del árbol es ${num(ev.valor)}.`,
    solucionDetallada: lineas.join('\n') + `\nValor del árbol: ${num(ev.valor)}`,
  };
}

function estrategia(rng, ctx) {
  const s = arbolSecuencial(rng, ctx);
  const { ev } = s;
  const opciones = ['No invertir', 'Invertir y, si el resultado es bueno, expandir', 'Invertir y, si el resultado es bueno, no expandir'];
  const raiz = ev.porNodo[s.arbol.raiz.id];
  const exp = ev.porNodo[expandirDe(s.arbol).id];
  const idx = raiz.elegida === 1 ? 0 : exp.elegida === 0 ? 1 : 2;
  return {
    titulo: 'Estrategia óptima en un árbol de dos decisiones',
    enunciado: `${ctx.sujeto} puede invertir (costo ${s.c} ${ctx.unidad}) o no. Si invierte y el resultado es bueno, decide si expande (costo ${s.e}). Los pagos de las hojas son los resultados finales en ${ctx.unidad}.`,
    pregunta: '¿Cuál es la estrategia óptima (la que maximiza el valor esperado)?',
    arbol: s.arbol,
    datos: {},
    entrada: { tipo: 'opcion', opciones },
    solucion: idx,
    explicacion: `Hacia atrás: en «Expandir» se compara ${num(exp.ramas[0].total)} (expandir) con ${num(exp.ramas[1].total)} (no expandir). Con eso, invertir vale ${num(raiz.ramas[0].total)} y no invertir ${num(raiz.ramas[1].total)}. La mejor estrategia es: ${opciones[idx]}.`,
    solucionDetallada: ev.orden.map((id) => `${ev.porNodo[id].nombre}: ${ev.porNodo[id].lineas.join('\n  ')}`).join('\n'),
  };
}

function indiferencia(rng, ctx) {
  // p* en múltiplos de 0,05 y diferencias múltiplo de 20 para que K sea entero
  const pStar = rng.int(3, 17) / 20;
  const d = pasoN(rng, 80, 240, 20);
  const b = paso10(rng, -60, 40);
  const a = b + d;
  const K = b + pStar * d;
  const arbol = arbolDe('max', ctx.unidad, D('Decisión', [
    R('Proyecto riesgoso', A('Resultado', [R('Éxito', a, { p: 'p' }), R('Fracaso', b, { p: '1 − p' })])),
    R('Alternativa segura', K),
  ]));
  return {
    titulo: 'Punto de indiferencia de una probabilidad',
    enunciado: `${ctx.sujeto} compara un proyecto riesgoso, que deja ${a} ${ctx.unidad} si tiene éxito (probabilidad p) y ${num(b)} si fracasa, con una alternativa segura que deja ${num(K)}.`,
    pregunta: '¿Para qué valor de p dan lo mismo las dos opciones? (redondea a dos decimales)',
    arbol,
    datos: { a, b, K },
    entrada: { tipo: 'numero', tolerancia: 0.006, ayuda: 'Escribe p como decimal, por ejemplo 0,35.' },
    solucion: pStar,
    explicacion: `El valor esperado del proyecto es p × ${fmtPar(a)} + (1 − p) × ${fmtPar(b)}. Se iguala al de la alternativa segura (${num(K)}): p = (${num(K)} − ${fmtPar(b)}) / (${fmtPar(a)} − ${fmtPar(b)}) = ${num(pStar)}. Con p mayor conviene el proyecto; con p menor, la alternativa segura.`,
    solucionDetallada: `p·${fmtPar(a)} + (1 − p)·${fmtPar(b)} = ${num(K)}\np = ${num(K - b)} / ${num(d)} = ${num(pStar)}`,
  };
}

function veip(rng, ctx) {
  for (let intento = 0; intento < 200; intento++) {
    const p = probs(rng, 3);
    const pagos = ctx.alts.map(() => ctx.e3.map(() => paso10(rng, -40, 200)));
    const ve = pagos.map((fila) => fila.reduce((s, x, j) => s + x * p[j], 0));
    const conInfo = ctx.e3.reduce((s, _, j) => s + p[j] * Math.max(...pagos.map((f) => f[j])), 0);
    const sin = Math.max(...ve);
    if (conInfo - sin < 2 || ve.filter((v) => Math.abs(v - sin) < 1e-9).length !== 1) continue;
    const maxes = ctx.e3.map((_, j) => Math.max(...pagos.map((f) => f[j])));
    return {
      titulo: 'Valor esperado de la información perfecta',
      enunciado: `${ctx.sujeto} elige entre tres alternativas. La tabla da el pago (en ${ctx.unidad}) de cada una según ${ctx.asunto}, con las probabilidades de cada estado.`,
      pregunta: '¿Cuál es el valor esperado de la información perfecta (VEIP)?',
      tabla: { alternativas: ctx.alts.slice(), estados: ctx.e3.slice(), p, pagos },
      datos: {},
      entrada: { tipo: 'numero', tolerancia: 0.01 },
      solucion: conInfo - sin,
      explicacion: `Sin información se elige la mejor alternativa por valor esperado: ${ctx.alts.map((a, i) => `${a} ${num(ve[i])}`).join('; ')}; el mejor es ${num(sin)}. Con información perfecta, en cada estado se elige la mejor: ${num(conInfo)}. VEIP = ${num(conInfo)} − ${num(sin)} = ${num(conInfo - sin)}.`,
      solucionDetallada: `Con información perfecta: ${ctx.e3.map((e, j) => `${num(p[j])} × ${num(maxes[j])}`).join(' + ')} = ${num(conInfo)}\nSin información: ${num(sin)}\nVEIP = ${num(conInfo - sin)}`,
    };
  }
  throw new Error('No se pudo generar el VEIP');
}

function riesgo(rng, ctx) {
  for (let intento = 0; intento < 200; intento++) {
    const p = (() => {
      const u = [];
      let resto = 20;
      for (let i = 0; i < 3; i++) { const x = rng.int(2, Math.min(8, resto - 2 * (3 - i))); u.push(x); resto -= x; }
      u.push(resto);
      return u.map((x) => x / 20);
    })();
    const valores = rng.shuffle([-80, -40, -20, 0, 20, 40, 60, 100, 150, 200]).slice(0, 4);
    const negs = valores.filter((v) => v < 0).length;
    if (negs === 0 || negs === 4) continue;
    const pNeg = p.reduce((s, x, i) => s + (valores[i] < 0 ? x : 0), 0);
    if (pNeg < 0.1 || pNeg > 0.9) continue;
    const etiquetas = ['Escenario 1', 'Escenario 2', 'Escenario 3', 'Escenario 4'];
    const arbol = arbolDe('max', ctx.unidad, A(`Resultado de ${ctx.producto}`, etiquetas.map((e, i) => R(e, valores[i], { p: p[i] }))));
    const ve = p.reduce((s, x, i) => s + x * valores[i], 0);
    return {
      titulo: 'Probabilidad de perder (perfil de riesgo)',
      enunciado: `${ctx.sujeto} decidió llevar adelante ${ctx.producto}. Los pagos finales, en ${ctx.unidad}, y sus probabilidades se ven en el árbol. Interesa el riesgo, no solo el valor esperado (${num(ve)}).`,
      pregunta: '¿Cuál es la probabilidad de que el resultado sea negativo (pérdida)? Escríbela como decimal, por ejemplo 0,35.',
      arbol,
      datos: { p, valores },
      entrada: { tipo: 'numero', tolerancia: 0.006 },
      solucion: pNeg,
      explicacion: `El perfil de riesgo lista cada resultado con su probabilidad. Los escenarios con pago negativo son ${valores.map((v, i) => (v < 0 ? `${etiquetas[i]} (${num(v)}, p = ${num(p[i])})` : null)).filter(Boolean).join(' y ')}; se suman sus probabilidades: ${num(pNeg)}.`,
      solucionDetallada: valores.map((v, i) => `${etiquetas[i]}: valor ${num(v)}, p = ${num(p[i])}${v < 0 ? ' (pérdida)' : ''}`).join('\n') + `\nP(pérdida) = ${num(pNeg)}`,
    };
  }
  throw new Error('No se pudo generar el ejercicio de riesgo');
}

const GENERADORES = { valorEsperado, completar, alternativa, secuencial, estrategia, indiferencia, veip, riesgo };

/** Ejercicio del tipo dado, siempre igual para la misma semilla. */
export function generarEjercicio(tipo, seed) {
  if (!GENERADORES[tipo]) throw new Error(`Tipo de ejercicio desconocido: ${tipo}`);
  const s = (Math.floor(Number(seed)) || 1) >>> 0;
  const rng = mulberry32(s * 2654435761 + TIPOS.indexOf(tipo) * 97 + 13);
  const ctx = rng.pick(CONTEXTOS);
  const ej = GENERADORES[tipo](rng, ctx);
  return { id: `${tipo}-${s}`, tipo, seed: s, ...ej };
}

/* ---------- corrección ---------- */

/** Respuesta correcta recalculada desde los datos del ejercicio (no usa ej.solucion). */
export function solucionDe(ej) {
  switch (ej.tipo) {
    case 'valorEsperado':
      return ej.arbol.raiz.ramas.reduce((s, r) => s + r.p * r.hijo.valor, 0);
    case 'completar': {
      const ps = ej.arbol.raiz.ramas.map((r) => r.p);
      const conocida = ps.filter((x) => x != null).reduce((s, x) => s + x, 0);
      return ej.arbol.raiz.ramas.reduce((s, r) => s + (r.p == null ? 1 - conocida : r.p) * r.hijo.valor, 0);
    }
    case 'alternativa': {
      const ev = evaluar(ej.arbol);
      return ev.porNodo[ej.arbol.raiz.id].elegida;
    }
    case 'secuencial':
      return evaluar(ej.arbol).valor;
    case 'estrategia': {
      const ev = evaluar(ej.arbol);
      const raiz = ev.porNodo[ej.arbol.raiz.id];
      if (raiz.elegida === 1) return 0;
      return ev.porNodo[expandirDe(ej.arbol).id].elegida === 0 ? 1 : 2;
    }
    case 'indiferencia':
      return (ej.datos.K - ej.datos.b) / (ej.datos.a - ej.datos.b);
    case 'veip': {
      const { p, pagos } = ej.tabla;
      const sin = Math.max(...pagos.map((f) => f.reduce((s, x, j) => s + x * p[j], 0)));
      const con = p.reduce((s, x, j) => s + x * Math.max(...pagos.map((f) => f[j])), 0);
      return con - sin;
    }
    case 'riesgo':
      return ej.arbol.raiz.ramas.reduce((s, r) => s + (r.hijo.valor < 0 ? r.p : 0), 0);
    default:
      throw new Error(`Tipo de ejercicio desconocido: ${ej.tipo}`);
  }
}

/** Errores típicos: si la respuesta coincide con uno, se explica qué pudo pasar. */
function errorProbable(ej, resp) {
  const cerca = (a, b) => Math.abs(a - b) <= (ej.entrada.tolerancia || 0.01) + 1e-9;
  const candidatos = [];
  if (ej.tipo === 'valorEsperado') {
    const v = ej.arbol.raiz.ramas.map((r) => r.hijo.valor);
    candidatos.push([v.reduce((s, x) => s + x, 0) / v.length, 'Parece que promediaste los pagos sin ponderar por las probabilidades.']);
    candidatos.push([v.reduce((s, x) => s + x, 0), 'Parece que sumaste los pagos sin multiplicarlos por las probabilidades.']);
  } else if (ej.tipo === 'completar') {
    const rs = ej.arbol.raiz.ramas;
    candidatos.push([rs.reduce((s, r) => s + (r.p == null ? 0 : r.p * r.hijo.valor), 0), 'Parece que dejaste por fuera la rama de la probabilidad que faltaba (su aporte no es 0: su probabilidad es 1 menos la suma de las otras).']);
    const v = rs.map((r) => r.hijo.valor);
    candidatos.push([v.reduce((s, x) => s + x, 0) / v.length, 'Parece que promediaste los pagos sin ponderar.']);
  } else if (ej.tipo === 'secuencial') {
    const ev = evaluar(ej.arbol);
    const inf = ev.porNodo[expandirDe(ej.arbol).id];
    // si siempre se expande, sin comparar con «No expandir»
    const alto = inf.ramas[0].total;
    const res = ej.arbol.raiz.ramas[0].hijo;
    const buena = res.ramas[0];
    const reg = res.ramas[1];
    const sinElegir = ej.arbol.raiz.ramas[0].pago + buena.p * (buena.pago + alto) + reg.p * reg.hijo.valor;
    candidatos.push([sinElegir, 'Parece que en «Expandir» no comparaste con «No expandir» (en una decisión se elige la mejor rama, no siempre la misma).']);
    candidatos.push([ev.valor - ej.arbol.raiz.ramas[0].pago, 'Parece que no restaste el costo inicial de invertir.']);
  } else if (ej.tipo === 'indiferencia') {
    const p = (ej.datos.K - ej.datos.b) / (ej.datos.a - ej.datos.b);
    candidatos.push([1 - p, 'Parece que diste 1 − p: revisa cuál probabilidad se pide (la de éxito).']);
  } else if (ej.tipo === 'veip') {
    const { p, pagos } = ej.tabla;
    const sin = Math.max(...pagos.map((f) => f.reduce((s, x, j) => s + x * p[j], 0)));
    const con = p.reduce((s, x, j) => s + x * Math.max(...pagos.map((f) => f[j])), 0);
    candidatos.push([con, 'Ese es el valor esperado CON información perfecta; falta restarle el mejor valor esperado sin información.']);
    candidatos.push([sin, 'Ese es el mejor valor esperado SIN información; el VEIP es la diferencia con el valor esperado con información perfecta.']);
  } else if (ej.tipo === 'riesgo') {
    candidatos.push([1 - solucionDe(ej), 'Parece que diste la probabilidad de NO perder (el complemento).']);
  }
  const hit = candidatos.find(([v]) => cerca(resp, v));
  return hit ? hit[1] : null;
}

/** corregir(ej, resp): resp es un número (entrada 'numero') o un índice (entrada 'opcion'). */
export function corregir(ej, resp) {
  const correcta = solucionDe(ej);
  if (ej.entrada.tipo === 'opcion') {
    const ok = resp === correcta;
    return {
      correcta: ok,
      mensaje: ok ? `Correcto: «${ej.entrada.opciones[correcta]}».` : `No es esa. La respuesta correcta es «${ej.entrada.opciones[correcta]}».`,
      detalle: ok || !Number.isInteger(resp) ? '' : `Elegiste «${ej.entrada.opciones[resp]}».`,
    };
  }
  const tol = ej.entrada.tolerancia ?? 0.01;
  const ok = typeof resp === 'number' && Math.abs(resp - correcta) <= tol + 1e-9;
  if (ok) return { correcta: true, mensaje: `Correcto: ${num(correcta)}.`, detalle: '' };
  const hint = typeof resp === 'number' ? errorProbable(ej, resp) : null;
  return {
    correcta: false,
    mensaje: `No coincide. La respuesta es ${num(correcta)}${typeof resp === 'number' ? ` (escribiste ${num(resp)})` : ''}.`,
    detalle: hint || '',
  };
}
