/**
 * Histograma de recursos. uso[k][t] es el consumo del recurso k en el período t+1
 * (la actividad i que empieza en starts[i] ocupa los períodos starts[i]+1 … starts[i]+d[i]).
 */

export const finProyecto = (red, starts) => starts.reduce((m, s, i) => (s == null ? m : Math.max(m, s + red.d[i])), 0);

/** Consumo por período de cada recurso. `horizonte` fuerza la longitud (para comparar dos cronogramas). */
export function perfil(red, starts, horizonte) {
  const H = Math.max(horizonte ?? 0, finProyecto(red, starts));
  const uso = red.recursos.map(() => new Array(H).fill(0));
  starts.forEach((s, i) => {
    if (s == null) return;
    for (let t = s; t < s + red.d[i]; t++) red.recursos.forEach((_, k) => { uso[k][t] += red.r[i][k]; });
  });
  return uso;
}

/** Períodos (desde 1) donde el consumo supera el límite del recurso. */
export function picos(uso, limite) {
  if (limite == null) return [];
  const out = [];
  uso.forEach((u, t) => { if (u > limite) out.push({ periodo: t + 1, uso: u, exceso: u - limite }); });
  return out;
}

/** Σ_k Σ_t uso² : el criterio que minimiza la nivelación. */
export function sumaCuadrados(uso) {
  let s = 0;
  uso.forEach((u) => u.forEach((x) => { s += x * x; }));
  return s;
}

/** Resumen de un cronograma: duración, consumo, pico máximo y períodos que exceden el límite, por recurso. */
export function resumen(red, starts, horizonte) {
  const uso = perfil(red, starts, horizonte);
  const porRecurso = red.recursos.map((nombre, k) => {
    const limite = red.limites[k];
    const pico = Math.max(0, ...uso[k]);
    return {
      nombre,
      limite,
      uso: uso[k],
      pico,
      periodosPico: pico > 0 ? uso[k].map((u, t) => (u === pico ? t + 1 : 0)).filter(Boolean) : [],
      excesos: picos(uso[k], limite),
    };
  });
  return { T: finProyecto(red, starts), uso, porRecurso, cuadrados: sumaCuadrados(uso) };
}

/** Lista de violaciones de precedencia y de límite; vacía si el cronograma es factible. */
export function violaciones(red, starts) {
  const out = [];
  starts.forEach((s, i) => {
    if (s == null || s < 0) out.push(`${red.nombres[i]} no tiene un comienzo válido`);
    else red.preds[i].forEach((p) => { if (s < starts[p] + red.d[p]) out.push(`${red.nombres[i]} empieza antes de que termine ${red.nombres[p]}`); });
  });
  const uso = perfil(red, starts);
  red.recursos.forEach((nom, k) => picos(uso[k], red.limites[k]).forEach((p) => out.push(`${nom} supera el límite en el período ${p.periodo}`)));
  return out;
}

/** Cota inferior de la duración con recursos limitados: la ruta crítica y el trabajo total entre el límite. */
export function cotaInferior(red, T) {
  let cota = T;
  red.recursos.forEach((_, k) => {
    const lim = red.limites[k];
    if (lim == null || lim <= 0) return;
    const trabajo = red.d.reduce((s, d, i) => s + d * red.r[i][k], 0);
    cota = Math.max(cota, Math.ceil(trabajo / lim));
  });
  return cota;
}
