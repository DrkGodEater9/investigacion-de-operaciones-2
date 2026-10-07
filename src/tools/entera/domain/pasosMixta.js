import { ZERO, ONE, frac } from './fraction.js';
import { bmATexto } from './tablero.js';
import { planosDeCorte } from './cortes.js';
import { solveIP, canUseFloorPruning } from './branchAndBound.js';
import { get2DFeasibleRegion } from './geometry.js';

/**
 * Pasos didácticos del tema 1.2 «Programación entera mixta».
 * Funciones puras: todo el texto sale de los valores calculados por
 * planosDeCorte / solveIP / tablero; nada de números escritos a mano.
 *
 * Paso = {
 *   id, titulo, queHago, porQue, calculo:[string],
 *   vista: {tipo:'tablero', tablero, pivote:{fila,col}|null, razones?, titulo?}
 *        | {tipo:'arbol', hastaId, activoId}
 *        | {tipo:'texto'},
 *   grafica?: { integer:[bool,bool], relajacion?, optimo?, puntos?, rectas?, franjas? },
 *   etiqueta?, continuacion?
 * }
 * razones (vista tablero) = { filas?: (string|null)[], columnas?: (string|null)[] }
 */

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------
const t = (v) => frac(v).toString();
const dec = (v, d = 3) => frac(v).toDecimal(d);
const par = (v) => (frac(v).isInteger() && !frac(v).lt(ZERO) ? t(v) : `(${t(v)})`);
const vec = (arr) => `(${arr.map(t).join(', ')})`;
const vecBM = (arr) => `(${arr.map(bmATexto).join(', ')})`;
const sentidoTxt = (s) => (s === 'min' ? 'Minimizar' : 'Maximizar');

function terminos(coefs, nombres) {
  const out = [];
  coefs.forEach((c0, j) => {
    const c = frac(c0);
    if (c.isZero()) return;
    out.push({ neg: c.lt(ZERO), abs: c.abs(), nombre: nombres[j] });
  });
  return out;
}

/** «-x1 + 3x2», «7/22·x3 + 1/22·x4». */
function expr(coefs, nombres) {
  const ts = terminos(coefs, nombres);
  if (ts.length === 0) return '0';
  return ts
    .map((q, i) => {
      const cuerpo = q.abs.eq(ONE) ? q.nombre : q.abs.isInteger() ? `${q.abs}${q.nombre}` : `${q.abs}·${q.nombre}`;
      if (i === 0) return q.neg ? `-${cuerpo}` : cuerpo;
      return `${q.neg ? '-' : '+'} ${cuerpo}`;
    })
    .join(' ');
}

const opTxt = (op) => (op === '<=' ? '≤' : op === '>=' ? '≥' : '=');
const nombresOrig = (n) => Array.from({ length: n }, (_, j) => `x${j + 1}`);
const flagsInt = (m) =>
  m.c.map((_, j) => (m.integer && m.integer[j] !== undefined ? !!m.integer[j] : true));

function textoModelo(m) {
  const nom = nombresOrig(m.c.length);
  const lineas = [`${sentidoTxt(m.sense || 'max')} Z = ${expr(m.c, nom)}`, 'sujeto a:'];
  m.constraints.forEach((r) => lineas.push(`  ${expr(r.a, nom)} ${opTxt(r.op)} ${t(r.b)}`));
  return lineas;
}

const nombreBase = (tab) => tab.base.map((j) => tab.cols[j].nombre);

/** Lecturas del tablero: variables básicas, Z, Zj y Cj−Zj. */
function lineasTablero(tab) {
  const bas = tab.base.map((j, i) => `${tab.cols[j].nombre} = ${t(tab.b[i])}`).join(', ');
  const nombres = tab.cols.map((c) => c.nombre).join(', ');
  return [
    `Básicas: ${bas}; Z = ${bmATexto(tab.zval)}`,
    `Zj = ${vecBM(tab.zj)} en (${nombres})`,
    `Cj−Zj = ${vecBM(tab.cz)} en (${nombres})`,
  ];
}

function textoEcuacionFila(tab, i) {
  const nom = tab.cols.map((c) => c.nombre);
  return `${expr(tab.A[i], nom)} = ${t(tab.b[i])}`;
}

// ---------------------------------------------------------------------------
// Geometría (exacta) para las gráficas de 2 variables
// ---------------------------------------------------------------------------
function recortar(poly, a1, a2, b, mantener) {
  const val = (p) => a1.mul(p.x1).add(a2.mul(p.x2));
  const dentro = (p) => (mantener === '<=' ? val(p).lte(b) : val(p).gte(b));
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const dp = dentro(p);
    const dq = dentro(q);
    if (dp) out.push(p);
    if (dp !== dq) {
      const vp = val(p);
      const vq = val(q);
      const s = b.sub(vp).div(vq.sub(vp));
      out.push({ x1: p.x1.add(s.mul(q.x1.sub(p.x1))), x2: p.x2.add(s.mul(q.x2.sub(p.x2))) });
    }
  }
  return out;
}

function regionBase(m) {
  if (m.c.length !== 2) return null;
  const r = get2DFeasibleRegion(m.constraints);
  if (r.status !== 'ok' || r.vertices.length < 3) return null;
  return r.vertices;
}

/** Región ∩ semiplanos previos, y la franja que elimina `corte` (el semiplano opuesto). */
function franjaDeCorte(m, previos, corte) {
  let poly = regionBase(m);
  if (!poly) return null;
  for (const p of previos) {
    poly = recortar(poly, p.a[0], p.a[1], p.b, p.op);
    if (poly.length < 3) return null;
  }
  const f = recortar(poly, corte.a[0], corte.a[1], corte.b, corte.op === '<=' ? '>=' : '<=');
  return f.length >= 3 ? f : null;
}

function rectaDeCorte(c, nombres) {
  // c = enOriginales {coefs, op, rhs}
  const a = c.coefs.map(frac);
  return { a, op: c.op, b: frac(c.rhs), etiqueta: `${expr(a, nombres)} ${opTxt(c.op)} ${t(c.rhs)}` };
}

const puntoDe = (x, etiqueta, tipo) => ({ x: x.map(frac), etiqueta, tipo });

// ---------------------------------------------------------------------------
// PLANOS DE CORTE
// ---------------------------------------------------------------------------
function pasoTablero({ titulo, queHago, porQue, calculo, tablero, pivote = null, razones = null, grafica, ...resto }) {
  return { titulo, queHago, porQue, calculo, vista: { tipo: 'tablero', tablero, pivote, razones }, grafica, ...resto };
}

export function pasosCortes(modelo, { conContinuacionPura = false } = {}) {
  const m = modelo;
  const n = m.c.length;
  const isMax = (m.sense || 'max') === 'max';
  const flags = flagsInt(m);
  const nom = nombresOrig(n);
  const dosVars = n === 2;

  const res = planosDeCorte(m, { tipo: 'mixto' });
  if (!res.lp || res.lp.estado !== 'optimo') {
    const estLp = res.lp ? res.lp.estado : res.estado;
    return [
      {
        id: 1,
        titulo: '1. Sin solución para la relajación',
        queHago: 'Se resuelve la relajación lineal con el simplex.',
        porQue: 'Si la relajación no tiene óptimo, el problema entero tampoco lo tiene por este camino.',
        calculo: [`Estado de la relajación: ${estLp === 'infactible' ? 'infactible (región factible vacía)' : estLp === 'no_acotado' ? 'no acotada' : estLp}`],
        vista: { tipo: 'texto' },
      },
    ];
  }

  const lp = res.lp;
  const ti = res.tableroInicial;
  const intNombres = flags.map((f, j) => (f ? nom[j] : null)).filter(Boolean);
  const contNombres = flags.map((f, j) => (!f ? nom[j] : null)).filter(Boolean);
  const pasos = [];

  const rectasPrev = []; // semiplanos de cortes ya aplicados (para la gráfica)
  const g = (extra = {}) => (dosVars ? { integer: flags, ...extra } : undefined);

  // 1 Planteamiento
  pasos.push({
    titulo: 'Planteamiento',
    queHago: `Se plantea el modelo y se marca qué variables deben ser enteras (${intNombres.join(', ') || 'ninguna'}) y cuáles son continuas (${contNombres.join(', ') || 'ninguna'}). La relajación es el mismo modelo ignorando la condición entera.`,
    porQue:
      'En la programación entera mixta solo las variables marcadas deben ser enteras; las continuas pueden tomar cualquier valor, incluso una fracción. Por eso se parte de la relajación lineal y se corta lo que sobra.',
    calculo: [...textoModelo(m), `${intNombres.join(', ')} entera${intNombres.length > 1 ? 's' : ''}; ${nom.join(', ')} ≥ 0`],
    vista: { tipo: 'texto' },
    grafica: g(),
  });

  // 2 Forma estándar
  const nomT = ti.cols.map((c) => c.nombre);
  pasos.push({
    titulo: 'Forma estándar',
    queHago: 'Se convierte cada restricción en una igualdad sumando una variable de holgura (o restando una de exceso y sumando una artificial).',
    porQue: 'El simplex trabaja con igualdades; las holguras dan además una base inicial con la que arrancar el tablero.',
    calculo: ti.A.map((_, i) => textoEcuacionFila(ti, i)),
    vista: { tipo: 'texto' },
    grafica: g(),
  });

  // 3.. Simplex primal de la relajación
  lp.iteraciones.forEach((it, i) => {
    const a = it.antes;
    const nEntra = a.cols[it.entra].nombre;
    const nSale = a.cols[a.base[it.sale]].nombre;
    const calc = [...lineasTablero(a)];
    calc.push(`Entra ${nEntra}: ${isMax ? 'mayor' : 'menor'} Cj−Zj = ${bmATexto(a.cz[it.entra])}`);
    a.A.forEach((f, r) => {
      const nr = a.cols[a.base[r]].nombre;
      if (f[it.entra].gt(ZERO)) calc.push(`Razón de la fila ${nr}: ${t(a.b[r])}/${par(f[it.entra])} = ${t(a.b[r].div(f[it.entra]))}`);
      else calc.push(`Fila ${nr}: coeficiente ${t(f[it.entra])} ≤ 0, no cuenta`);
    });
    calc.push(`Sale ${nSale}; pivote = ${t(it.pivote)}`);
    pasos.push(
      pasoTablero({
        titulo: i === 0 ? 'Tablero inicial' : `Tablero ${i + 1}`,
        queHago: `Entra ${nEntra} porque tiene el ${isMax ? 'mayor' : 'menor'} Cj−Zj. Se dividen los bj entre los coeficientes positivos de su columna y sale ${nSale}, con la menor razón. Se pivotea sobre ${t(it.pivote)}.`,
        porQue: `El Cj−Zj indica cuánto ${isMax ? 'aumenta' : 'disminuye'} Z por cada unidad de ${nEntra}; la menor razón es hasta dónde se puede subir ${nEntra} sin que otra variable se vuelva negativa.`,
        calculo: calc,
        tablero: a,
        pivote: { fila: it.sale, col: it.entra },
        razones: { filas: it.razones.map((r) => (r === null ? null : t(r))) },
        grafica: g(),
      })
    );
  });

  // Tablero óptimo de la relajación
  const tOpt = lp.tablero;
  pasos.push(
    pasoTablero({
      titulo: 'Tablero óptimo de la relajación',
      queHago: `Ningún Cj−Zj mejora el objetivo, así que este tablero es óptimo para la relajación: ${lp.x.map((v, j) => `${nom[j]} = ${t(v)}`).join(', ')} con Z = ${t(lp.z)}.`,
      porQue: `Es la mejor solución cuando se ignora la condición entera, así que Z = ${t(lp.z)} es una cota ${isMax ? 'superior' : 'inferior'} para el óptimo del problema mixto.`,
      calculo: lineasTablero(tOpt),
      tablero: tOpt,
      grafica: g({ relajacion: puntoDe(lp.x, `Relajación (${lp.x.map((v) => dec(v, 2)).join('; ')})`, 'relajacion') }),
    })
  );

  const nCortes = res.cortes.length;
  if (nCortes === 0) {
    pasos.push({
      titulo: '¿Cumple lo entero?',
      queHago: 'Se revisa que las variables enteras tengan valor entero en la relajación.',
      porQue: 'Si ya lo cumplen, la solución de la relajación es el óptimo mixto y no hace falta cortar.',
      calculo: [`x = ${vec(lp.x)}`, `Z = ${t(lp.z)}`],
      vista: { tipo: 'texto' },
      grafica: g({ optimo: puntoDe(lp.x, 'Óptimo mixto', 'optimo') }),
    });
    return pasos.map((p, i) => ({ id: i + 1, ...p, titulo: `${i + 1}. ${p.titulo}` }));
  }

  // Primer corte (el que se detalla)
  const c1 = res.cortes[0];
  const tFuente = c1.tableroAntes;
  const filaIdx = tFuente.base.indexOf(c1.colFuente);
  const nombreFuente = tFuente.cols[c1.colFuente].nombre;
  const valFuente = tFuente.b[filaIdx];

  const fracc = tFuente.base
    .map((j, i) => ({ j, i }))
    .filter(({ j, i }) => tFuente.cols[j].entera && !tFuente.b[i].fractionalPart().isZero());
  const ignoradas = tFuente.base
    .map((j, i) => ({ j, i }))
    .filter(({ j, i }) => !tFuente.cols[j].entera && !tFuente.b[i].fractionalPart().isZero());

  // 6 ¿Cumple lo entero?
  pasos.push({
    titulo: '¿Cumple lo entero?',
    queHago: `Se revisa cada variable entera en la solución: ${fracc.map(({ j, i }) => `${tFuente.cols[j].nombre} = ${t(tFuente.b[i])} no es entera`).join('; ')}.${ignoradas.length ? ` ${ignoradas.map(({ j }) => tFuente.cols[j].nombre).join(', ')} es continua, así que su fracción no importa.` : ''} Se corta la fila de ${nombreFuente}.`,
    porQue: 'Una variable entera con valor fraccionario hace inadmisible la solución. Solo las variables enteras obligan a cortar; las continuas pueden quedar fraccionarias.',
    calculo: [
      ...fracc.map(({ j, i }) => `${tFuente.cols[j].nombre} = ${t(tFuente.b[i])} → parte fraccionaria ${t(tFuente.b[i].fractionalPart())}`),
      ...(fracc.length > 1 ? ['Se elige la mayor parte fraccionaria; en empate, la fila que aparece primero en el tablero.'] : []),
      `Fila fuente: ${nombreFuente}`,
    ],
    vista: { tipo: 'texto' },
    grafica: g({ relajacion: puntoDe(lp.x, `Relajación (${lp.x.map((v) => dec(v, 2)).join('; ')})`, 'relajacion') }),
  });

  // 7 La fila
  pasos.push({
    titulo: `La fila de ${nombreFuente}`,
    queHago: `Se toma la fila de ${nombreFuente} del tablero óptimo y se escribe como ecuación con solo las variables no básicas.`,
    porQue: 'De esa ecuación sale el corte: es la información que el tablero tiene sobre la variable que debería ser entera.',
    calculo: [`${expr([ONE, ...c1.filaFuente.coefs.map((q) => q.a)], [nombreFuente, ...c1.filaFuente.coefs.map((q) => q.nombre)])} = ${t(valFuente)}`],
    vista: { tipo: 'tablero', tablero: tFuente, pivote: null, razones: null },
    grafica: g(),
  });

  // 8 Parte entera y fracción
  const lineas8 = [`f0 = parte fraccionaria de ${t(valFuente)} = ${t(c1.f0)}`];
  c1.filaFuente.coefs.forEach((q, i) => {
    const cf = c1.coefs[i].valor;
    if (!q.entera) {
      lineas8.push(
        q.a.gt(ZERO)
          ? `${q.nombre} es continua y su coeficiente ${t(q.a)} > 0 → coeficiente del corte: ${t(cf)}`
          : `${q.nombre} es continua y su coeficiente ${t(q.a)} < 0 → coeficiente del corte: f0/(1−f0)·(${t(q.a.neg())}) = ${t(cf)}`
      );
    } else {
      lineas8.push(`${q.nombre} es entera, f = ${t(q.a.fractionalPart())} → coeficiente del corte: ${t(cf)}`);
    }
  });
  const cortePlano = `${expr(c1.coefs.map((q) => q.valor), c1.coefs.map((q) => q.nombre))} ≥ ${t(c1.rhs)}`;
  lineas8.push(`Corte: ${cortePlano}`);
  pasos.push({
    titulo: 'Parte entera y fracción',
    queHago: `Se separa el lado derecho en parte entera y fracción: f0 = ${t(c1.f0)}. Cada variable no básica aporta un coeficiente al corte según sea continua o entera y según su signo. El corte queda ${cortePlano}.`,
    porQue: 'Toda solución con la variable entera cumple este corte, pero la solución fraccionaria actual (con las no básicas en 0) no lo cumple: el corte la elimina sin perder ningún punto entero.',
    calculo: lineas8,
    vista: { tipo: 'texto' },
    grafica: g(),
  });

  // 9 En las variables originales
  const enOr = c1.enOriginales;
  const rec1 = dosVars ? rectaDeCorte(enOr, nom) : null;
  const colsNB = c1.coefs.map((q) => tFuente.cols.findIndex((c) => c.nombre === q.nombre));
  const sustit = colsNB
    .map((j) => {
      const col = tFuente.cols[j];
      const r = col.restr !== undefined ? tFuente.info.restr[col.restr] : null;
      if (!r || (col.tipo !== 'holgura' && col.tipo !== 'exceso')) return null;
      const sig = col.tipo === 'holgura' ? -1 : 1;
      const cs = r.a.map((v) => (sig < 0 ? v.neg() : v));
      const k0 = sig < 0 ? r.b : r.b.neg();
      const resto = expr(cs, nom);
      return `${col.nombre} = ${t(k0)}${resto === '0' ? '' : resto.startsWith('-') ? ` - ${resto.slice(1)}` : ` + ${resto}`}`;
    })
    .filter(Boolean);
  const franja1 = dosVars ? franjaDeCorte(m, [], rec1 && { a: rec1.a, op: rec1.op, b: rec1.b }) : null;
  const eliminaTxt = dosVars && rec1 ? ` Queda eliminada la zona del otro lado de la recta, que no contiene puntos admisibles de ${intNombres.join(', ')}.` : '';
  pasos.push({
    titulo: 'El corte en las variables originales',
    queHago: `Se sustituyen las variables de holgura por su expresión en x. El corte equivale a ${rec1 ? rec1.etiqueta : `${expr(enOr.coefs, nom)} ${opTxt(enOr.op)} ${t(enOr.rhs)}`}.${eliminaTxt}`,
    porQue: 'Escrito en x1, x2 el corte es una desigualdad común: se ve como una recta que recorta la región factible justo donde no hay soluciones válidas.',
    calculo: [
      ...sustit,
      `Corte en las originales: ${expr(enOr.coefs, nom)} ${opTxt(enOr.op)} ${t(enOr.rhs)}`,
    ],
    vista: { tipo: 'texto' },
    grafica: dosVars && rec1
      ? g({
          relajacion: puntoDe(lp.x, `Relajación (${lp.x.map((v) => dec(v, 2)).join('; ')})`, 'relajacion'),
          rectas: [rec1],
          franjas: franja1 ? [franja1] : [],
        })
      : undefined,
  });
  if (rec1) rectasPrev.push({ a: rec1.a, op: rec1.op, b: rec1.b });

  // 10 Corte como ecuación
  const tcc = c1.tableroConCorte;
  const ultima = tcc.A.length - 1;
  const nombreS = tcc.cols[tcc.base[ultima]].nombre;
  pasos.push(
    pasoTablero({
      titulo: 'Se agrega el corte al tablero',
      queHago: `El corte se escribe como ecuación con una variable ${nombreS}: ${textoEcuacionFila(tcc, ultima)}. Se agrega como una fila nueva con ${nombreS} básica y b = ${t(tcc.b[ultima])}.`,
      porQue: `Como b = ${t(tcc.b[ultima])} es negativo, la solución actual no es factible en el primal, pero los Cj−Zj siguen siendo de signo óptimo; por eso se usa el simplex dual.`,
      calculo: [textoEcuacionFila(tcc, ultima), ...lineasTablero(tcc)],
      tablero: tcc,
      grafica: g({ rectas: rec1 ? [rec1] : [], franjas: franja1 ? [franja1] : [] }),
    })
  );

  // 11.. Simplex dual
  const d = c1.dual;
  d.iteraciones.forEach((it, i) => {
    const a = it.antes;
    const nSale = a.cols[a.base[it.sale]].nombre;
    const nEntra = a.cols[it.entra].nombre;
    const calc = [`Sale ${nSale}: b = ${t(a.b[it.sale])} es el más negativo`];
    a.cols.forEach((col, j) => {
      const aij = a.A[it.sale][j];
      if (aij.lt(ZERO)) {
        calc.push(`${col.nombre}: |(${bmATexto(a.cz[j])})/(${t(aij)})| = ${t(a.cz[j].a.div(aij).abs())}`);
      }
    });
    calc.push(`Entra ${nEntra}; pivote = ${t(it.pivote)}`);
    pasos.push(
      pasoTablero({
        titulo: i === 0 ? 'Simplex dual' : `Simplex dual (iteración ${i + 1})`,
        queHago: `Sale ${nSale}, la variable con b negativo. Entre las columnas con coeficiente negativo en su fila se calcula |Cj−Zj / a| y entra ${nEntra}, la de menor razón.`,
        porQue: 'El dual primero elige quién sale (el que viola la factibilidad) y luego quién entra, de modo que los Cj−Zj sigan con signo óptimo mientras b se vuelve no negativo.',
        calculo: calc,
        tablero: a,
        pivote: { fila: it.sale, col: it.entra },
        razones: { columnas: it.razones.map((r) => (r === null ? null : t(r.valor))) },
        grafica: g({ rectas: rec1 ? [rec1] : [], franjas: franja1 ? [franja1] : [] }),
      })
    );
  });

  // 12 Tablero tras el dual
  const tDual = d.tableroDespues;
  const solD = tDual.cols.slice(0, n).map((_, j) => {
    const i = tDual.base.indexOf(j);
    return i === -1 ? ZERO : tDual.b[i];
  });
  pasos.push(
    pasoTablero({
      titulo: d.estado === 'infactible' ? 'El dual no tiene columna de entrada' : 'Tablero tras la iteración dual',
      queHago:
        d.estado === 'infactible'
          ? `Queda una fila con b negativo (${tDual.base.map((j, i) => (tDual.b[i].lt(ZERO) ? `${tDual.cols[j].nombre} = ${t(tDual.b[i])}` : null)).filter(Boolean).join(', ')}) y ninguna columna con coeficiente negativo en esa fila: no hay variable que pueda entrar.`
          : `Ya no hay b negativos: ${tDual.base.map((j, i) => `${tDual.cols[j].nombre} = ${t(tDual.b[i])}`).join(', ')}; Z = ${bmATexto(tDual.zval)}.`,
      porQue:
        d.estado === 'infactible'
          ? 'Una fila con b negativo cuyos coeficientes no son negativos dice que una suma de términos ≥ 0 es igual a un número negativo, lo cual es imposible: el problema con el corte es infactible.'
          : 'Con todos los b no negativos y los Cj−Zj de signo óptimo, el tablero es óptimo para el problema con el corte.',
      calculo: lineasTablero(tDual),
      tablero: tDual,
      grafica: g({ rectas: rec1 ? [rec1] : [], franjas: franja1 ? [franja1] : [], relajacion: undefined, optimo: puntoDe(solD, `(${solD.map((v) => dec(v, 2)).join('; ')})`, 'nodo') }),
    })
  );

  // 13 Conclusión (óptimo mixto)
  const mixto = res; // tras cortar todo lo necesario
  if (res.estado === 'infactible' || res.estado === 'limite_de_cortes') {
    const inf = res.estado === 'infactible';
    pasos.push({
      titulo: 'Conclusión',
      queHago: inf
        ? `Tras ${nCortes} corte${nCortes > 1 ? 's' : ''} el simplex dual no encuentra columna para entrar: la fila con b negativo no tiene coeficientes negativos. El problema con los cortes es infactible, así que el problema entero no tiene solución.`
        : `Se llegó al límite de ${nCortes} cortes sin que las variables enteras quedaran enteras; no se puede afirmar el óptimo.`,
      porQue: inf
        ? 'Cada corte conserva todos los puntos admisibles del problema mixto; si el problema con cortes queda sin solución, no había ningún punto admisible.'
        : 'El método de Gomory no siempre termina rápido; en la práctica se limita el número de cortes.',
      calculo: [`Estado: ${inf ? 'infactible' : 'límite de cortes'}`, `Cortes aplicados: ${nCortes}`],
      vista: { tipo: 'texto' },
      grafica: g({ rectas: rec1 ? [rec1] : [], franjas: franja1 ? [franja1] : [] }),
    });
    return pasos.map((p, i) => ({ id: i + 1, ...p, titulo: `${i + 1}. ${p.titulo}` }));
  }
  const xFin = mixto.x;
  const intFracFin = xFin.map((v, j) => flags[j] && !v.isInteger());
  if (nCortes === 1 && !intFracFin.some(Boolean)) {
    pasos.push({
      titulo: 'Conclusión',
      queHago: `Las variables enteras ya son enteras: ${xFin.map((v, j) => `${nom[j]} = ${t(v)}${!flags[j] && !v.isInteger() ? ` ≈ ${dec(v)}` : ''}`).join(', ')}. El óptimo mixto es Z = ${t(mixto.z)}.`,
      porQue: `Las variables continuas pueden quedar fraccionarias. Z pasó de ${t(lp.z)} a ${t(mixto.z)} (${isMax ? 'no puede subir' : 'no puede bajar'}) por haber exigido la condición entera, que restringe la relajación.`,
      calculo: [`x = ${vec(xFin)}`, `Z = ${t(mixto.z)}`, ...xFin.map((v, j) => (!flags[j] && !v.isInteger() ? `${nom[j]} ≈ ${dec(v)}` : null)).filter(Boolean)],
      vista: { tipo: 'texto' },
      grafica: g({ rectas: rec1 ? [rec1] : [], franjas: franja1 ? [franja1] : [], optimo: puntoDe(xFin, `Óptimo mixto (${xFin.map((v) => dec(v, 2)).join('; ')})`, 'optimo') }),
    });
  } else {
    pasos.push({
      titulo: 'Conclusión',
      queHago: `Se repite el procedimiento (${nCortes} cortes en total) hasta que las variables enteras quedan enteras. Óptimo mixto: ${xFin.map((v, j) => `${nom[j]} = ${t(v)}`).join(', ')}, Z = ${t(mixto.z)}.`,
      porQue: 'Cada corte elimina una zona sin puntos admisibles; cuando ya no hay fracciones en las variables enteras, el tablero es el óptimo del problema mixto.',
      calculo: [`x = ${vec(xFin)}`, `Z = ${t(mixto.z)}`, `Cortes aplicados: ${nCortes}`],
      vista: { tipo: 'texto' },
      grafica: g({ optimo: puntoDe(xFin, 'Óptimo mixto', 'optimo') }),
    });
  }

  // Continuación a entera pura
  if (conContinuacionPura) {
    const mPura = { ...m, integer: m.c.map(() => true) };
    let pura = null;
    try {
      pura = planosDeCorte(mPura, { tipo: 'fraccional' });
    } catch {
      pura = null;
    }
    const etiqueta = `No aplica a la mixta: ${contNombres.join(', ') || 'las variables'} ${contNombres.length > 1 ? 'son continuas' : 'es continua'}`;
    if (pura && pura.cortes.length >= 2) {
      const c2 = pura.cortes[1];
      const tA = c2.tableroAntes;
      const cands = tA.base
        .map((j, i) => ({ j, i, f: tA.b[i].fractionalPart() }))
        .filter(({ j, f }) => tA.cols[j].entera && !f.isZero());
      const nomA = tA.cols.map((c) => c.nombre);
      const fuente2 = tA.cols[c2.colFuente].nombre;
      const fila2 = tA.base.indexOf(c2.colFuente);
      const enOr2 = c2.enOriginales;
      const rec2 = dosVars ? rectaDeCorte(enOr2, nom) : null;
      const franja2 = dosVars && rec2 ? franjaDeCorte(mPura, rectasPrev, { a: rec2.a, op: rec2.op, b: rec2.b }) : null;
      const gPura = (extra = {}) => (dosVars ? { integer: mPura.integer, ...extra } : undefined);
      const rectasAmbas = [rec1, rec2].filter(Boolean);
      const base = { continuacion: true, etiqueta };

      pasos.push({
        ...base,
        titulo: `Si ${contNombres.join(', ') || 'la variable continua'} también fuera entera`,
        queHago: `${cands.map(({ j, i }) => `${tA.cols[j].nombre} = ${t(tA.b[i])}`).join(' y ')} ${cands.length > 1 ? 'son fraccionarios' : 'es fraccionario'} (parte ${cands.every(({ f }) => f.eq(cands[0].f)) && cands.length > 1 ? `${t(cands[0].f)} ${cands.length === 2 ? 'las dos' : 'todas'}` : cands.map(({ f }) => t(f)).join(', ')}). ${cands.length > 1 ? 'Hay empate: se corta la fila que aparece primero en el tablero, ' : 'Se corta por '}${fuente2}.`,
        porQue: 'Si todas las variables fueran enteras habría que seguir cortando mientras alguna quede fraccionaria. Esto solo ilustra la entera pura: en la mixta con la variable continua el proceso ya terminó.',
        calculo: [
          ...cands.map(({ j, i, f }) => `${tA.cols[j].nombre} = ${t(tA.b[i])} → parte fraccionaria ${t(f)}`),
          `Fila fuente: ${fuente2}`,
        ],
        vista: { tipo: 'tablero', tablero: tA, pivote: null, razones: null },
        grafica: gPura({ rectas: rec1 ? [rec1] : [], optimo: puntoDe(solD, `(${solD.map((v) => dec(v, 2)).join('; ')})`, 'nodo') }),
      });

      const corte2 = `${expr(c2.coefs.map((q) => q.valor), c2.coefs.map((q) => q.nombre))} ≥ ${t(c2.rhs)}`;
      const tCC2 = c2.tableroConCorte;
      const ult2 = tCC2.A.length - 1;
      pasos.push(
        pasoTablero({
          ...base,
          titulo: 'Segundo corte',
          queHago: `Con la fórmula fraccional (todas las variables enteras) el corte es ${corte2}. En las originales: ${expr(enOr2.coefs, nom)} ${opTxt(enOr2.op)} ${t(enOr2.rhs)}. Como ecuación: ${textoEcuacionFila(tCC2, ult2)}.`,
          porQue: 'En la entera pura cada coeficiente del corte es la parte fraccionaria del coeficiente de la fila; así el corte elimina el punto fraccionario sin quitar ningún punto entero.',
          calculo: [
            `Fila: ${expr([ONE, ...c2.filaFuente.coefs.map((q) => q.a)], [fuente2, ...c2.filaFuente.coefs.map((q) => q.nombre)])} = ${t(tA.b[fila2])}`,
            `f0 = ${t(c2.f0)}`,
            `Corte: ${corte2}`,
            `En las originales: ${expr(enOr2.coefs, nom)} ${opTxt(enOr2.op)} ${t(enOr2.rhs)}`,
            `Ecuación: ${textoEcuacionFila(tCC2, ult2)}`,
          ],
          tablero: tCC2,
          grafica: gPura({ rectas: rectasAmbas, franjas: franja2 ? [franja2] : [] }),
        })
      );

      c2.dual.iteraciones.forEach((it, i) => {
        const a = it.antes;
        const nSale = a.cols[a.base[it.sale]].nombre;
        const nEntra = a.cols[it.entra].nombre;
        const calc = [`Sale ${nSale}: b = ${t(a.b[it.sale])}`];
        a.cols.forEach((col, j) => {
          const aij = a.A[it.sale][j];
          if (aij.lt(ZERO)) calc.push(`${col.nombre}: |(${bmATexto(a.cz[j])})/(${t(aij)})| = ${t(a.cz[j].a.div(aij).abs())}`);
        });
        calc.push(`Entra ${nEntra}; pivote = ${t(it.pivote)}`);
        pasos.push(
          pasoTablero({
            ...base,
            titulo: i === 0 ? 'Simplex dual del segundo corte' : `Simplex dual del segundo corte (iteración ${i + 1})`,
            queHago: `Sale ${nSale} (b negativo). Se calcula |Cj−Zj / a| en las columnas con coeficiente negativo y entra ${nEntra}.`,
            porQue: 'Igual que antes: el dual recupera la factibilidad sin perder el signo óptimo de los Cj−Zj.',
            calculo: calc,
            tablero: a,
            pivote: { fila: it.sale, col: it.entra },
            razones: { columnas: it.razones.map((r) => (r === null ? null : t(r.valor))) },
            grafica: gPura({ rectas: rectasAmbas, franjas: franja2 ? [franja2] : [] }),
          })
        );
      });

      const tF = pura.tableroFinal;
      const xP = pura.x;
      const extra = pura.cortes.length > 2 ? [`Hicieron falta ${pura.cortes.length} cortes en total.`] : [];
      pasos.push(
        pasoTablero({
          ...base,
          titulo: 'Resultado de la entera pura',
          queHago: `Todas las variables quedan enteras: ${tF.base.map((j, i) => `${tF.cols[j].nombre} = ${t(tF.b[i])}`).join(', ')}; Z = ${t(pura.z)}.`,
          porQue: `Exigir que también ${contNombres.join(', ') || 'la variable continua'} sea entera restringe más el problema, por eso Z ${isMax ? 'no sube' : 'no baja'} respecto del óptimo mixto.`,
          calculo: [
            ...lineasTablero(tF),
            ...extra,
            'Nota: en el material del profesor la última fila de Zj y Cj−Zj aparece sin actualizar; aquí están recalculadas.',
          ],
          tablero: tF,
          grafica: gPura({ rectas: rectasAmbas, franjas: franja2 ? [franja2] : [], optimo: puntoDe(xP, `Óptimo entero (${xP.map(t).join('; ')})`, 'optimo') }),
        })
      );
    }
  }

  return pasos.map((p, i) => ({ id: i + 1, ...p, titulo: `${i + 1}. ${p.titulo}` }));
}

// ---------------------------------------------------------------------------
// RAMIFICACIÓN Y ACOTAMIENTO
// ---------------------------------------------------------------------------
function rectaDeRama(node, n, nombres) {
  const a = Array.from({ length: n }, () => ZERO);
  a[node.branchVar] = ONE;
  return { a, op: node.branchOp, b: node.branchBound, etiqueta: `${nombres[node.branchVar]} ${opTxt(node.branchOp)} ${t(node.branchBound)}` };
}

/** Si el nodo es infactible por una rama con 2 variables, explica por qué (con las otras restricciones). */
function explicacionInfactible(m, node) {
  const n = m.c.length;
  if (n !== 2 || node.branchVar == null) return null;
  const k = node.branchVar;
  const o = 1 - k;
  // La rama pide x_k ≥ B (o ≤ B). Mirar solo x_k = B demuestra la infactibilidad únicamente si alejarse de B
  // nunca ayuda a ninguna restricción; si no, se omite la explicación en vez de afirmar algo sin prueba.
  const dir = node.branchOp === '>=' ? 1 : -1;
  for (const ct of m.constraints) {
    const efecto = frac(ct.a[k]).mul(dir);
    const ayuda = ct.op === '=' ? !efecto.isZero() : ct.op === '<=' ? efecto.lt(ZERO) : efecto.gt(ZERO);
    if (ayuda) return null;
  }
  const nom = nombresOrig(n);
  let lo = null;
  let hi = null;
  const lineas = [];
  for (const ct of m.constraints) {
    const ak = frac(ct.a[k]);
    const ao = frac(ct.a[o]);
    if (ao.isZero()) continue;
    const resto = frac(ct.b).sub(ak.mul(node.branchBound));
    const v = resto.div(ao);
    const cota = ct.op === '=' ? 'ambas' : (ct.op === '<=') === ao.gt(ZERO) ? 'sup' : 'inf';
    const txt = `${expr(ct.a.map((_, j) => (j === o ? ao : ZERO)), nom)} ${opTxt(ct.op)} ${t(ct.b)} - ${par(ak)}·${t(node.branchBound)} = ${t(resto)}`;
    if (cota === 'sup' || cota === 'ambas') {
      if (hi === null || v.lt(hi.v)) hi = { v, txt };
    }
    if (cota === 'inf' || cota === 'ambas') {
      if (lo === null || v.gt(lo.v)) lo = { v, txt };
    }
  }
  if (lo && hi && lo.v.gt(hi.v)) {
    lineas.push(`Con ${nom[k]} = ${t(node.branchBound)}: ${lo.txt} → ${nom[o]} ≥ ${t(lo.v)}`);
    lineas.push(`Con ${nom[k]} = ${t(node.branchBound)}: ${hi.txt} → ${nom[o]} ≤ ${t(hi.v)}`);
    lineas.push(`${t(lo.v)} > ${t(hi.v)}: no existe ${nom[o]} que cumpla ambas`);
    return lineas;
  }
  return null;
}

export function pasosRamificacion(modelo) {
  const m = modelo;
  const n = m.c.length;
  const isMax = (m.sense || 'max') === 'max';
  const flags = flagsInt(m);
  const nom = nombresOrig(n);
  const dosVars = n === 2;
  const intNombres = flags.map((f, j) => (f ? nom[j] : null)).filter(Boolean);
  const contNombres = flags.map((f, j) => (!f ? nom[j] : null)).filter(Boolean);
  const r = solveIP({ ...m, integer: flags });
  const nodes = r.nodes || [];
  const usaPiso = canUseFloorPruning(m.c, flags, !m.options || m.options.pruneWithFloor !== false);
  const g = (extra = {}) => (dosVars ? { integer: flags, ...extra } : undefined);
  const pasos = [];

  pasos.push({
    titulo: 'Planteamiento',
    queHago: `Se plantea el modelo con ${intNombres.join(', ') || 'ninguna variable'} entera${intNombres.length > 1 ? 's' : ''}${contNombres.length ? ` y ${contNombres.join(', ')} continua${contNombres.length > 1 ? 's' : ''}` : ''}. Solo se ramifica en las variables enteras.`,
    porQue: 'La ramificación y acotamiento resuelve una serie de problemas lineales más simples; las variables continuas nunca se ramifican porque pueden tomar cualquier valor.',
    calculo: [...textoModelo(m), `${intNombres.join(', ')} entera${intNombres.length > 1 ? 's' : ''}; ${nom.join(', ')} ≥ 0`],
    vista: { tipo: 'texto' },
    grafica: g(),
  });

  if (r.status === 'unbounded' || !r.relaxation) {
    pasos.push({
      titulo: 'Conclusión',
      queHago: r.status === 'unbounded' ? `La relajación no tiene ${isMax ? 'máximo' : 'mínimo'} finito.` : 'La relajación es infactible.',
      porQue: 'Si la relajación no tiene solución, el problema entero tampoco.',
      calculo: [`Estado: ${r.status}`],
      vista: { tipo: 'texto' },
    });
    return pasos.map((p, i) => ({ id: i + 1, ...p, titulo: `${i + 1}. ${p.titulo}` }));
  }

  const root = nodes[0];
  const rel = r.relaxation;
  pasos.push({
    titulo: 'Relajación lineal',
    queHago: `Se resuelve la relajación (sin la condición entera): ${rel.x.map((v, j) => `${nom[j]} = ${t(v)}`).join(', ')} con Z = ${t(rel.z)}.`,
    porQue: `Z = ${t(rel.z)} es una cota ${isMax ? 'superior' : 'inferior'}: ningún punto con variables enteras puede dar un Z ${isMax ? 'mayor' : 'menor'}.`,
    calculo: [`x = ${vec(rel.x)}`, `Z = ${t(rel.z)}`, `Cota ${isMax ? 'superior' : 'inferior'}: Z ${isMax ? '≤' : '≥'} ${t(rel.z)}`],
    vista: { tipo: 'arbol', hastaId: root.id, activoId: root.id },
    grafica: g({ relajacion: puntoDe(rel.x, `Relajación (${rel.x.map((v) => dec(v, 2)).join('; ')})`, 'relajacion') }),
  });

  const hijos = nodes.filter((q) => q.parentId === root.id);
  if (root.status === 'integer' || hijos.length === 0) {
    pasos.push({
      titulo: 'Conclusión',
      queHago: `La relajación ya cumple la condición entera: el óptimo es x = ${vec(rel.x)} con Z = ${t(rel.z)}.`,
      porQue: 'No hace falta ramificar cuando la solución de la relajación ya es admisible para el problema entero.',
      calculo: [`x = ${vec(rel.x)}`, `Z = ${t(rel.z)}`],
      vista: { tipo: 'arbol', hastaId: root.id, activoId: root.id },
      grafica: g({ optimo: puntoDe(rel.x, 'Óptimo', 'optimo') }),
    });
    return pasos.map((p, i) => ({ id: i + 1, ...p, titulo: `${i + 1}. ${p.titulo}` }));
  }

  const k = hijos[0].branchVar;
  const izq = hijos.find((q) => q.branchOp === '<=');
  const der = hijos.find((q) => q.branchOp === '>=');
  const ignor = rel.x.map((v, j) => (!flags[j] && !v.isInteger() ? nom[j] : null)).filter(Boolean);

  pasos.push({
    titulo: 'Variable a ramificar',
    queHago: `${nom[k]} = ${t(rel.x[k])} debe ser entera y no lo es: se ramifica en ${nom[k]}.${ignor.length ? ` ${ignor.join(', ')} es continua y se ignora aunque sea fraccionaria.` : ''}`,
    porQue: 'Se elige una variable entera con valor fraccionario; las fracciones en las continuas son admisibles y no obligan a ramificar.',
    calculo: [
      `${nom[k]} = ${t(rel.x[k])} → piso = ${t(izq.branchBound)}, techo = ${t(der.branchBound)}`,
      ...ignor.map((s) => `${s} es continua: no importa su valor`),
    ],
    vista: { tipo: 'arbol', hastaId: root.id, activoId: root.id },
    grafica: g({ relajacion: puntoDe(rel.x, `Relajación (${rel.x.map((v) => dec(v, 2)).join('; ')})`, 'relajacion') }),
  });

  const rIzq = dosVars ? rectaDeRama(izq, n, nom) : null;
  const rDer = dosVars ? rectaDeRama(der, n, nom) : null;
  let franja = null;
  if (dosVars) {
    let poly = regionBase(m);
    if (poly) {
      poly = recortar(poly, rIzq.a[0], rIzq.a[1], rIzq.b, '>=');
      if (poly.length >= 3) poly = recortar(poly, rDer.a[0], rDer.a[1], rDer.b, '<=');
      franja = poly.length >= 3 ? poly : null;
    }
  }
  pasos.push({
    titulo: 'Las dos ramas',
    queHago: `Se parte el problema en dos: ${nom[k]} ≤ ${t(izq.branchBound)} y ${nom[k]} ≥ ${t(der.branchBound)}. Entre ${t(izq.branchBound)} y ${t(der.branchBound)} no hay enteros, así que no se pierde ninguna solución válida.`,
    porQue: 'Toda solución con la variable entera cumple una de las dos ramas. La franja entre ellas solo tiene valores fraccionarios de esa variable, y queda eliminada.',
    calculo: [`Rama izquierda: ${nom[k]} ≤ ${t(izq.branchBound)}`, `Rama derecha: ${nom[k]} ≥ ${t(der.branchBound)}`],
    vista: { tipo: 'arbol', hastaId: root.id, activoId: root.id },
    grafica: g({ rectas: dosVars ? [rIzq, rDer] : [], franjas: franja ? [franja] : [], relajacion: puntoDe(rel.x, `Relajación (${rel.x.map((v) => dec(v, 2)).join('; ')})`, 'relajacion') }),
  });

  // Un paso por cada nodo no raíz, en orden de creación
  let incumbente = null;
  nodes.forEach((nd) => {
    if (nd.id === root.id) return;
    const etq = `${nd.label} (${nom[nd.branchVar]} ${opTxt(nd.branchOp)} ${t(nd.branchBound)})`;
    const rectas = dosVars ? nd.addedConstraints.map((c) => {
      const a = c.a.map(frac);
      const j = a.findIndex((v) => !v.isZero());
      return { a, op: c.op, b: frac(c.b), etiqueta: `${nom[j]} ${opTxt(c.op)} ${t(c.b)}` };
    }) : [];
    const base = { vista: { tipo: 'arbol', hastaId: nd.id, activoId: nd.id } };
    if (nd.status === 'infeasible' || nd.status === 'unbounded' || !nd.x) {
      const why = explicacionInfactible(m, nd);
      pasos.push({
        titulo: `Rama ${etq}, infactible`,
        queHago: `Al resolver la relajación de esta rama no hay ningún punto que cumpla todas las restricciones: la rama se descarta.${why ? ` ${why[why.length - 1]}.` : ''}`,
        porQue: 'Un subproblema sin región factible no puede contener soluciones enteras; no vale la pena ramificarlo.',
        calculo: why || [`${etq}: sin solución factible`],
        ...base,
        grafica: g({ rectas }),
      });
      return;
    }
    const xTxt = vec(nd.x);
    if (nd.action === 'incumbent') {
      incumbente = nd;
      pasos.push({
        titulo: `Rama ${etq}, incumbente`,
        queHago: `La relajación de esta rama da x = ${xTxt} con Z = ${t(nd.z)}. ${intNombres.join(', ')} ${intNombres.length > 1 ? 'son enteras' : 'es entera'}, así que es admisible y pasa a ser el incumbente.`,
        porQue: `Un punto admisible fija una cota real: de aquí en adelante solo interesan ramas con Z ${isMax ? 'mayor' : 'menor'} que ${t(nd.z)}.`,
        calculo: [`x = ${xTxt}`, `Z = ${t(nd.z)}`, ...nd.x.map((v, j) => (!flags[j] && !v.isInteger() ? `${nom[j]} ≈ ${dec(v)} (continua: puede ser fracción)` : null)).filter(Boolean)],
        ...base,
        grafica: g({ rectas, optimo: puntoDe(nd.x, `Incumbente (${nd.x.map((v) => dec(v, 2)).join('; ')})`, 'optimo') }),
      });
    } else if (nd.action === 'pruned-bound') {
      const inc = nd.incumbentAfter;
      const yaNoMejora = inc && (isMax ? nd.z.lte(inc) : nd.z.gte(inc));
      const zEnt = isMax ? nd.z.floor() : nd.z.ceil();
      const conPiso = inc && usaPiso && !yaNoMejora;
      pasos.push({
        titulo: `Rama ${etq}, podada por cota`,
        queHago: conPiso
          ? `La relajación da x = ${xTxt} con Z = ${t(nd.z)}. Como Z solo toma valores enteros en esta rama, su mejor valor posible es ${isMax ? '⌊Z⌋' : '⌈Z⌉'} = ${zEnt}, que no mejora el incumbente Z = ${t(inc)}. Se poda.`
          : `La relajación da x = ${xTxt} con Z = ${t(nd.z)}${inc ? `, que no mejora el incumbente Z = ${t(inc)}` : ''}. Se poda.`,
        porQue: `Como la relajación es una cota, ningún punto entero de esta rama puede ${isMax ? 'superar' : 'bajar de'} Z = ${t(nd.z)}; si eso no mejora el incumbente, ramificar más es inútil.`,
        calculo: [`x = ${xTxt}`, `Z = ${t(nd.z)}`, ...(inc ? [`Incumbente: Z = ${t(inc)}`] : [])],
        ...base,
        grafica: g({ rectas, puntos: [puntoDe(nd.x, `(${nd.x.map((v) => dec(v, 2)).join('; ')})`, 'nodo')] }),
      });
    } else {
      const sub = nodes.filter((q) => q.parentId === nd.id);
      pasos.push({
        titulo: `Rama ${etq}, se ramifica`,
        queHago: `La relajación da x = ${xTxt} con Z = ${t(nd.z)}, con una variable entera fraccionaria${sub.length ? `: se ramifica en ${nom[sub[0].branchVar]}` : ''}.`,
        porQue: 'Como la rama aún puede contener soluciones mejores que el incumbente, se sigue dividiendo.',
        calculo: [`x = ${xTxt}`, `Z = ${t(nd.z)}`],
        ...base,
        grafica: g({ rectas, puntos: [puntoDe(nd.x, `(${nd.x.map((v) => dec(v, 2)).join('; ')})`, 'nodo')] }),
      });
    }
  });

  // Conclusión
  const best = r.best;
  let obs = null;
  try {
    const cuts = planosDeCorte(m, { tipo: 'mixto' });
    const c = cuts.cortes[0];
    if (c) {
      const e = c.enOriginales;
      const unit = e.coefs.every((v, j) => (j === k ? v.eq(ONE) : v.isZero()));
      if (unit && e.op === izq.branchOp && e.rhs.eq(izq.branchBound)) {
        obs = `La rama ${nom[k]} ≤ ${t(izq.branchBound)} es exactamente el corte de Gomory del otro método.`;
      }
    }
  } catch {
    obs = null;
  }
  const ultimoId = nodes.length ? nodes[nodes.length - 1].id : root.id;
  if (best) {
    pasos.push({
      titulo: 'Conclusión',
      queHago: r.status === 'nodeLimit'
        ? `Se alcanzó el límite de nodos y quedaron ramas abiertas. La mejor solución hallada es Z = ${t(best.z)} con x = ${vec(best.x)}; no está probado que sea el óptimo.`
        : `No quedan ramas abiertas. El óptimo del problema mixto es Z = ${t(best.z)} con x = ${vec(best.x)}.${obs ? ` ${obs}` : ''}`,
      porQue: r.status === 'nodeLimit'
        ? 'Con ramas sin explorar, el mejor incumbente es solo una cota del óptimo, no el óptimo.'
        : 'Todas las ramas terminaron podadas o con solución admisible; el mejor incumbente es el óptimo.',
      calculo: [`x = ${vec(best.x)}`, `Z = ${t(best.z)}`, ...best.x.map((v, j) => (!flags[j] && !v.isInteger() ? `${nom[j]} ≈ ${dec(v)}` : null)).filter(Boolean), ...(obs ? [obs] : [])],
      vista: { tipo: 'arbol', hastaId: ultimoId, activoId: incumbente ? incumbente.id : root.id },
      grafica: g({ optimo: puntoDe(best.x, `Óptimo (${best.x.map((v) => dec(v, 2)).join('; ')})`, 'optimo') }),
    });
  } else {
    pasos.push({
      titulo: 'Conclusión',
        queHago: r.status === 'nodeLimit'
          ? 'Se alcanzó el límite de nodos sin hallar ninguna solución admisible.'
          : 'No existe ninguna solución admisible para el problema mixto: aunque la relajación tiene solución, todas las ramas terminaron infactibles.',
      porQue: r.status === 'nodeLimit' ? 'Sin incumbente no se puede afirmar nada sobre el óptimo.' : 'Cada rama conserva todos los puntos admisibles; si todas quedan sin región factible, no había ninguno.',
      calculo: [`Estado: ${r.status}`],
      vista: { tipo: 'arbol', hastaId: ultimoId, activoId: root.id },
    });
  }

  return pasos.map((p, i) => ({ id: i + 1, ...p, titulo: `${i + 1}. ${p.titulo}` }));
}
