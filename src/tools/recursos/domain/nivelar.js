/**
 * Nivelación de recursos: se mueven actividades dentro de su holgura, sin alargar el proyecto,
 * para suavizar el histograma (heurística de momento mínimo, tipo Burgess).
 *
 * Método (todo explícito para poder cambiarlo):
 *  1. Se parte del cronograma temprano (cada actividad en su ES). La duración T no cambia nunca.
 *  2. Una pasada recorre las actividades de atrás hacia adelante: mayor EF primero; si empatan, la última de la tabla.
 *  3. Para cada actividad se calcula su ventana de comienzos posibles con el cronograma actual:
 *       lo = mayor terminación de sus predecesoras (0 si no tiene);
 *       hi = (menor comienzo de sus sucesoras) − d   (si no tiene sucesoras: T − d).
 *     Así ninguna precedencia se rompe y el proyecto sigue terminando en T.
 *  4. Para cada comienzo s de la ventana se mide la carga que ya existe donde la actividad quedaría:
 *       c(s) = Σ_k r_k · Σ_{t ocupado} uso_k(t)      (sin contar la propia actividad)
 *     La actividad se mueve al s de menor c(s) solo si es estrictamente menor que el c de su comienzo actual;
 *     si varios s empatan en el mínimo, se elige el más temprano. Si no mejora, se queda.
 *  5. Se repiten pasadas hasta que una no mueva nada. Cada movimiento baja Σ uso² (un entero), así que termina.
 */
import { cpm } from './cpm.js';
import { perfil, sumaCuadrados, finProyecto } from './perfil.js';

export function nivelar(red, opciones = {}) {
  const base = cpm(red);
  const { n, d, preds, succs } = red;
  const K = red.recursos.length;
  const starts = base.ES.slice();
  const T = base.T;
  const uso = perfil(red, starts, T);
  const inicial = starts.slice();
  const objetivoAntes = sumaCuadrados(uso);

  const orden = [...Array(n).keys()].sort((a, b) => base.EF[b] - base.EF[a] || b - a);
  const log = [];
  let pasadas = 0;
  let mueve = true;
  const topePasadas = opciones.maxPasadas ?? 200;
  while (mueve && pasadas < topePasadas) {
    mueve = false;
    pasadas += 1;
    for (const a of orden) {
      const lo = preds[a].length ? Math.max(...preds[a].map((p) => starts[p] + d[p])) : 0;
      const hi = (succs[a].length ? Math.min(...succs[a].map((q) => starts[q])) : T) - d[a];
      if (hi <= lo) continue;
      // se retira la actividad del histograma para medir la carga de los demás
      for (let t = starts[a]; t < starts[a] + d[a]; t++) for (let k = 0; k < K; k++) uso[k][t] -= red.r[a][k];
      const costos = [];
      for (let s = lo; s <= hi; s++) {
        let c = 0;
        for (let k = 0; k < K; k++) {
          let suma = 0;
          for (let t = s; t < s + d[a]; t++) suma += uso[k][t];
          c += red.r[a][k] * suma;
        }
        costos.push({ s, costo: c });
      }
      const actual = costos.find((x) => x.s === starts[a]).costo;
      let mejor = costos[0];
      for (const x of costos) if (x.costo < mejor.costo) mejor = x;
      const elegido = mejor.costo < actual ? mejor.s : starts[a];
      const antes = starts[a];
      starts[a] = elegido;
      for (let t = starts[a]; t < starts[a] + d[a]; t++) for (let k = 0; k < K; k++) uso[k][t] += red.r[a][k];
      if (elegido !== antes) mueve = true;
      log.push({ pasada: pasadas, act: a, ventana: [lo, hi], costos, antes, elegido, movio: elegido !== antes, starts: starts.slice() });
    }
  }
  return {
    starts,
    inicial,
    T: finProyecto(red, starts),
    objetivoAntes,
    objetivoDespues: sumaCuadrados(uso),
    pasadas,
    log,
    base,
  };
}
