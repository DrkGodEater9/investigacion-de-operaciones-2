/**
 * Utilidades de prueba, escritas por otro camino que el dominio:
 *  - cpmIndep: relajación tipo Bellman-Ford hasta que nada cambie (el dominio usa un orden topológico).
 *  - verificar: revisa precedencias y límites período por período con bucles simples.
 *  - asignarIndep: el mismo método por períodos, pero guardando la ocupación futura y revisando TODA la ventana
 *    de la actividad (el dominio solo mira el primer período, porque la ocupación futura nunca crece).
 */
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

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Modelo aleatorio acíclico; la tabla sale en orden mezclado (las predecesoras pueden venir después). */
export function modeloAleatorio(rng, { conLimite = 'auto' } = {}) {
  const n = rng.int(2, 12);
  const K = rng.int(1, 2);
  const nombres = Array.from({ length: n }, (_, i) => LETRAS[i]);
  const acts = nombres.map((name, i) => {
    const preds = [];
    for (let j = 0; j < i; j++) if (rng.next() < 0.3) preds.push(nombres[j]);
    return { name, d: rng.int(1, 5), preds, r: Array.from({ length: K }, () => rng.int(0, 6)) };
  });
  // mezcla de filas (Fisher-Yates con el rng)
  for (let i = acts.length - 1; i > 0; i--) { const j = rng.int(0, i); [acts[i], acts[j]] = [acts[j], acts[i]]; }
  const recursos = Array.from({ length: K }, (_, k) => {
    const maxReq = Math.max(0, ...acts.map((a) => a.r[k]));
    let limite;
    if (conLimite === 'factible') limite = rng.int(Math.max(1, maxReq), maxReq + 6);
    else limite = rng.int(Math.max(0, maxReq - 1), maxReq + 6);
    return { name: 'R' + (k + 1), limite };
  });
  return { recursos, acts };
}

/** CPM por relajación: ES/EF y LS/LF sobre nombres. */
export function cpmIndep(modelo) {
  const acts = modelo.acts;
  const es = {};
  acts.forEach((a) => { es[a.name] = 0; });
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const a of acts) for (const p of a.preds) {
      const pa = acts.find((x) => x.name === p);
      if (es[a.name] < es[p] + pa.d) { es[a.name] = es[p] + pa.d; cambio = true; }
    }
  }
  let T = 0;
  acts.forEach((a) => { T = Math.max(T, es[a.name] + a.d); });
  const lf = {};
  acts.forEach((a) => { lf[a.name] = T; });
  cambio = true;
  while (cambio) {
    cambio = false;
    for (const a of acts) for (const p of a.preds) {
      const limite = lf[a.name] - a.d; // p debe terminar antes del comienzo tardío de a
      if (lf[p] > limite) { lf[p] = limite; cambio = true; }
    }
  }
  const out = { T, ES: {}, LS: {}, H: {} };
  acts.forEach((a) => {
    out.ES[a.name] = es[a.name];
    out.LS[a.name] = lf[a.name] - a.d;
    out.H[a.name] = out.LS[a.name] - es[a.name];
  });
  return out;
}

/** Lista de violaciones de un cronograma {nombre: inicio}. */
export function verificar(modelo, inicio) {
  const err = [];
  for (const a of modelo.acts) {
    if (!Number.isInteger(inicio[a.name]) || inicio[a.name] < 0) err.push('inicio inválido ' + a.name);
    for (const p of a.preds) {
      const pa = modelo.acts.find((x) => x.name === p);
      if (inicio[a.name] < inicio[p] + pa.d) err.push(`precedencia ${p}->${a.name}`);
    }
  }
  const T = Math.max(0, ...modelo.acts.map((a) => inicio[a.name] + a.d));
  for (let t = 1; t <= T; t++) {
    modelo.recursos.forEach((rec, k) => {
      let u = 0;
      for (const a of modelo.acts) if (inicio[a.name] < t && t <= inicio[a.name] + a.d) u += a.r[k];
      if (rec.limite != null && u > rec.limite) err.push(`límite ${rec.name} en ${t}: ${u}`);
    });
  }
  return err;
}

export function usoEnPeriodo(modelo, inicio, k, t) {
  let u = 0;
  for (const a of modelo.acts) if (inicio[a.name] < t && t <= inicio[a.name] + a.d) u += a.r[k];
  return u;
}

/** Método por períodos con ocupación futura explícita. Devuelve {nombre: inicio} o null si infactible. */
export function asignarIndep(modelo, regla) {
  const K = modelo.recursos.length;
  for (const a of modelo.acts) for (let k = 0; k < K; k++) if (a.r[k] > modelo.recursos[k].limite) return null;
  const c = cpmIndep(modelo);
  const idx = (nm) => modelo.acts.findIndex((a) => a.name === nm);
  const clave = {
    holgura: (a) => c.H[a.name],
    ls: (a) => c.LS[a.name],
    lf: (a) => c.LS[a.name] + a.d,
    duracion: (a) => -a.d,
    demanda: (a) => -a.r.reduce((s, x) => s + x, 0),
  }[regla];
  const ocupa = modelo.recursos.map(() => new Array(400).fill(0)); // ocupa[k][t]: uso del período t+1
  const inicio = {};
  let t = 0;
  while (Object.keys(inicio).length < modelo.acts.length) {
    const el = modelo.acts.filter((a) => !(a.name in inicio) && a.preds.every((p) => p in inicio && inicio[p] + modelo.acts[idx(p)].d <= t));
    el.sort((a, b) => {
      for (const f of [clave, (x) => c.LS[x.name], (x) => c.H[x.name], (x) => idx(x.name)]) {
        const df = f(a) - f(b);
        if (df !== 0) return df;
      }
      return 0;
    });
    for (const a of el) {
      let cabe = true;
      for (let k = 0; k < K && cabe; k++) for (let u = t; u < t + a.d; u++) if (ocupa[k][u] + a.r[k] > modelo.recursos[k].limite) { cabe = false; break; }
      if (cabe) {
        inicio[a.name] = t;
        for (let k = 0; k < K; k++) for (let u = t; u < t + a.d; u++) ocupa[k][u] += a.r[k];
      }
    }
    t += 1;
    if (t > 399) throw new Error('no termina');
  }
  return inicio;
}

export const aMapa = (red, starts) => Object.fromEntries(red.nombres.map((nm, i) => [nm, starts[i]]));
