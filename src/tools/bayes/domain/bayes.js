/**
 * Teoría bayesiana de la decisión (tema 2.1). Funciones puras, sin React ni DOM.
 *
 * Problema:
 *   {
 *     objetivo: 'max' | 'min',            // los pagos son utilidades (max) o costos (min)
 *     alternativas: string[],             // m
 *     estados: string[],                  // n
 *     pagos: number[m][n],                // pagos[i][j]: alternativa i si ocurre el estado j
 *     priori: number[n],                  // probabilidades a priori, suman 1
 *     indicadores?: string[],             // K resultados de la información muestral (opcional)
 *     verosimilitud?: number[n][K],       // verosimilitud[j][k] = P(indicador k | estado j); cada fila suma 1
 *   }
 */

export const EPS = 1e-9;
export const MAX_ALT = 10;
export const MAX_EST = 10;
export const MAX_IND = 10;
/** Diferencia máxima con 1 que se perdona al sumar probabilidades (3 decimales redondeados); se normaliza y se avisa. */
export const TOL_SUMA = 0.005;
const CERO_P = 1e-12;

const igual = (a, b) => Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));
export const mejorQue = (objetivo, a, b) => !igual(a, b) && (objetivo === 'max' ? a > b : a < b);
const limpio = (x) => (Math.abs(x) < 1e-12 ? 0 : x);

/** Mejor valor de una lista (según el objetivo) y los índices que lo alcanzan (empates). */
export function optimos(objetivo, valores) {
  let mejor = valores[0];
  for (const v of valores) if (mejorQue(objetivo, v, mejor)) mejor = v;
  const indices = [];
  valores.forEach((v, i) => { if (igual(v, mejor)) indices.push(i); });
  return { valor: mejor, indices };
}

export const valorEsperado = (fila, probs) => fila.reduce((s, v, j) => s + v * probs[j], 0);

/* ---------------------------------------------------------------- Validación */

const esNum = (v) => typeof v === 'number' && Number.isFinite(v);

const ETQ = {
  alternativa: { uno: 'La alternativa', varios: 'las alternativas', plural: 'alternativas', falta: 'una alternativa' },
  estado: { uno: 'La columna de estado', varios: 'los estados', plural: 'estados', falta: 'un estado' },
  indicador: { uno: 'La columna de indicador', varios: 'los resultados del indicador', plural: 'resultados del indicador', falta: 'un resultado del indicador' },
};

function nombresErrores(lista, tipo, errores, max) {
  const e = ETQ[tipo];
  if (!Array.isArray(lista) || lista.length < 1) { errores.push(`Falta al menos ${e.falta}.`); return; }
  if (lista.length > max) errores.push(`Hay demasiados: el máximo es ${max} ${e.plural}.`);
  const vistos = new Set();
  lista.forEach((nm, i) => {
    const t = String(nm ?? '').trim();
    if (t === '') errores.push(`${e.uno} ${i + 1} no tiene nombre.`);
    else if (vistos.has(t)) errores.push(`El nombre «${t}» está repetido entre ${e.varios}; usa nombres distintos.`);
    vistos.add(t);
  });
}

/** Revisa que un vector de probabilidades sea válido; devuelve el vector normalizado (o null). */
function revisarProbs(v, n, descripcion, errores, avisos) {
  if (!Array.isArray(v) || v.length !== n) { errores.push(`${descripcion}: debe tener ${n} valores.`); return null; }
  let ok = true;
  v.forEach((p, j) => {
    if (!esNum(p)) { errores.push(`${descripcion}: el valor ${j + 1} no es un número.`); ok = false; }
    else if (p < 0 || p > 1) { errores.push(`${descripcion}: el valor ${j + 1} es ${fmtP(p)} y una probabilidad debe estar entre 0 y 1.`); ok = false; }
  });
  if (!ok) return null;
  const s = v.reduce((a, b) => a + b, 0);
  if (Math.abs(s - 1) > TOL_SUMA) {
    errores.push(`${descripcion}: las probabilidades suman ${fmtP(s)} y deben sumar 1.`);
    return null;
  }
  if (Math.abs(s - 1) > 1e-9) {
    avisos.push(`${descripcion}: sumaban ${fmtP(s)}; se ajustaron proporcionalmente para que sumen 1.`);
    return v.map((p) => p / s);
  }
  return v.slice();
}

const fmtP = (x) => String(Math.round(x * 1e6) / 1e6).replace('.', ',');

/**
 * → { errores: string[], avisos: string[], problema: Problema normalizado | null }.
 * Las probabilidades que suman 1 ± TOL_SUMA se normalizan con un aviso.
 */
export function validarProblema(p) {
  const errores = [];
  const avisos = [];
  if (!p || typeof p !== 'object') return { errores: ['No hay problema.'], avisos, problema: null };
  if (p.objetivo !== 'max' && p.objetivo !== 'min') errores.push('El objetivo debe ser maximizar (utilidades) o minimizar (costos).');
  nombresErrores(p.alternativas, 'alternativa', errores, MAX_ALT);
  nombresErrores(p.estados, 'estado', errores, MAX_EST);
  const m = Array.isArray(p.alternativas) ? p.alternativas.length : 0;
  const n = Array.isArray(p.estados) ? p.estados.length : 0;
  if (m === 1) errores.push('Necesitas al menos 2 alternativas para tener una decisión.');
  if (n === 1) errores.push('Necesitas al menos 2 estados de la naturaleza.');

  let pagos = null;
  if (m > 0 && n > 0) {
    if (!Array.isArray(p.pagos) || p.pagos.length !== m) errores.push(`La matriz de pagos debe tener ${m} filas.`);
    else {
      let ok = true;
      p.pagos.forEach((f, i) => {
        if (!Array.isArray(f) || f.length !== n) { errores.push(`Pagos de «${p.alternativas[i]}»: debe tener ${n} valores.`); ok = false; return; }
        f.forEach((v, j) => { if (!esNum(v)) { errores.push(`Pago de «${p.alternativas[i]}» con el estado «${p.estados[j]}»: no es un número.`); ok = false; } });
      });
      if (ok) pagos = p.pagos.map((f) => f.slice());
    }
  }
  const priori = n > 0 ? revisarProbs(p.priori, n, 'Probabilidades a priori', errores, avisos) : null;

  let indicadores;
  let verosimilitud;
  const hayInfo = p.indicadores !== undefined && p.indicadores !== null;
  if (hayInfo) {
    nombresErrores(p.indicadores, 'indicador', errores, MAX_IND);
    const K = Array.isArray(p.indicadores) ? p.indicadores.length : 0;
    if (K === 1) errores.push('El indicador necesita al menos 2 resultados posibles.');
    if (K > 0 && n > 0) {
      if (!Array.isArray(p.verosimilitud) || p.verosimilitud.length !== n) errores.push(`La tabla de verosimilitudes debe tener ${n} filas (una por estado).`);
      else {
        const filas = p.verosimilitud.map((f, j) => revisarProbs(f, K, `Verosimilitud del estado «${p.estados[j]}» (la fila debe sumar 1)`, errores, avisos));
        if (filas.every(Boolean)) { verosimilitud = filas; indicadores = p.indicadores.map((s) => String(s).trim()); }
      }
    }
  }
  if (errores.length) return { errores, avisos, problema: null };
  const problema = {
    objetivo: p.objetivo,
    alternativas: p.alternativas.map((s) => String(s).trim()),
    estados: p.estados.map((s) => String(s).trim()),
    pagos,
    priori,
  };
  if (hayInfo) { problema.indicadores = indicadores; problema.verosimilitud = verosimilitud; }
  return { errores, avisos, problema };
}

/* ---------------------------------------------------------------- Sin información */

/** VE de cada alternativa con las probabilidades a priori y la decisión de Bayes. */
export function analisisSinInformacion(p) {
  const ve = p.pagos.map((f) => valorEsperado(f, p.priori));
  const o = optimos(p.objetivo, ve);
  return { ve, valor: o.valor, optimas: o.indices };
}

/** VEcIP y VEIP: con información perfecta se elige la mejor alternativa de cada estado. */
export function informacionPerfecta(p) {
  const sin = analisisSinInformacion(p);
  const porEstado = p.estados.map((_, j) => {
    const o = optimos(p.objetivo, p.pagos.map((f) => f[j]));
    return { valor: o.valor, alts: o.indices };
  });
  const vecip = porEstado.reduce((s, e, j) => s + p.priori[j] * e.valor, 0);
  const veip = limpio(p.objetivo === 'max' ? vecip - sin.valor : sin.valor - vecip);
  return { porEstado, vecip, vesi: sin.valor, veip };
}

/* ---------------------------------------------------------------- Información muestral */

/** Conjuntas, marginales, posteriores, decisión por indicador, VEcIM, VEIM y eficiencia. */
export function analisisMuestral(p) {
  const n = p.estados.length;
  const K = p.indicadores.length;
  const conjunta = p.estados.map((_, j) => p.indicadores.map((__, k) => p.priori[j] * p.verosimilitud[j][k]));
  const marginal = p.indicadores.map((_, k) => conjunta.reduce((s, f) => s + f[k], 0));
  const posterior = p.estados.map((_, j) => p.indicadores.map((__, k) => (marginal[k] > CERO_P ? conjunta[j][k] / marginal[k] : null)));
  const porIndicador = p.indicadores.map((_, k) => {
    const posible = marginal[k] > CERO_P;
    if (!posible) return { k, posible, ve: null, optimas: [], valor: null };
    const probs = p.estados.map((__, j) => posterior[j][k]);
    const ve = p.pagos.map((f) => valorEsperado(f, probs));
    const o = optimos(p.objetivo, ve);
    return { k, posible, ve, optimas: o.indices, valor: o.valor };
  });
  const vecim = porIndicador.reduce((s, d, k) => (d.posible ? s + marginal[k] * d.valor : s), 0);
  const sin = analisisSinInformacion(p);
  const perfecta = informacionPerfecta(p);
  const veim = limpio(p.objetivo === 'max' ? vecim - sin.valor : sin.valor - vecim);
  const eficiencia = perfecta.veip > CERO_P ? veim / perfecta.veip : null;
  return { n, K, conjunta, marginal, posterior, porIndicador, vecim, veim, eficiencia };
}

/* ---------------------------------------------------------------- Criterios sin probabilidades */

/**
 * Criterios que no usan las probabilidades (pesimista, optimista, Laplace, arrepentimiento de Savage),
 * más máxima verosimilitud y Bayes. Con costos, «pesimista» es el minimax y «optimista» el minimin.
 */
export function criteriosSinProbabilidades(p) {
  const { objetivo, pagos } = p;
  const m = pagos.length;
  const n = p.estados.length;
  const peor = pagos.map((f) => (objetivo === 'max' ? Math.min(...f) : Math.max(...f)));
  const mejor = pagos.map((f) => (objetivo === 'max' ? Math.max(...f) : Math.min(...f)));
  const promedio = pagos.map((f) => f.reduce((s, v) => s + v, 0) / n);
  const mejorEstado = p.estados.map((_, j) => optimos(objetivo, pagos.map((f) => f[j])).valor);
  const arrepentimiento = pagos.map((f) => f.map((v, j) => Math.abs(mejorEstado[j] - v)));
  const arrepMax = arrepentimiento.map((f) => Math.max(...f));

  const masProbable = optimos('max', p.priori);
  const enEstado = optimos(objetivo, pagos.map((f) => f[masProbable.indices[0]]));
  const sin = analisisSinInformacion(p);
  return {
    peor, mejor, promedio, arrepentimiento, arrepMax,
    pesimista: optimos(objetivo, peor),
    optimista: optimos(objetivo, mejor),
    laplace: optimos(objetivo, promedio),
    savage: optimos('min', arrepMax),
    verosimilitud: { estados: masProbable.indices, empate: masProbable.indices.length > 1, valor: enEstado.valor, indices: enEstado.indices },
    bayes: { valor: sin.valor, indices: sin.optimas },
    m,
  };
}

/** Todo el análisis de un problema ya validado. */
export function analizar(p) {
  const sinInfo = analisisSinInformacion(p);
  const perfecta = informacionPerfecta(p);
  const muestral = p.indicadores ? analisisMuestral(p) : null;
  const criterios = criteriosSinProbabilidades(p);
  return { sinInfo, perfecta, muestral, criterios };
}

/**
 * Verosimilitud a partir de una fiabilidad r: la señal «correcta» del estado j (el indicador j) sale con
 * probabilidad r y el resto se reparte en partes iguales. Los estados sin indicador propio reparten por igual.
 */
export function verosimilitudPorFiabilidad(n, K, r) {
  return Array.from({ length: n }, (_, j) => Array.from({ length: K }, (__, k) => {
    if (j >= K) return 1 / K;
    return k === j ? r : (1 - r) / (K - 1);
  }));
}
