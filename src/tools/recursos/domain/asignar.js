/**
 * Asignación con recursos limitados: método por períodos (programación paralela).
 *
 * Se avanza período a período (t = 0, 1, 2, …; el período t+1 es el que empieza en t):
 *  1. Elegibles: actividades sin programar cuyas predecesoras ya terminaron (EF programado ≤ t).
 *  2. Se ordenan por la regla de prioridad. Cadena de desempate fija: clave de la regla, luego menor LS,
 *     luego menor holgura total, luego el orden de la tabla. Los tiempos LS y la holgura son los del CPM sin límites.
 *  3. Una por una, en ese orden: si con el uso de las que ya están en curso (más las programadas en este mismo
 *     período) cabe en TODOS los recursos, empieza en t; si no, se retrasa y vuelve a ser elegible en t+1.
 *  4. La duración resultante es la mayor terminación.
 * Si una actividad sola excede un límite, el problema es infactible (nunca cabría): se avisa con claridad.
 */
import { cpm } from './cpm.js';
import { finProyecto, cotaInferior } from './perfil.js';

/** Reglas de prioridad. `clave(i, info)`: menor clave = se atiende antes. Fácil de ampliar. */
export const REGLAS = [
  { id: 'holgura', nombre: 'Menor holgura total', corto: 'holgura', clave: (i, c) => c.H[i] },
  { id: 'ls', nombre: 'Menor comienzo tardío (LS)', corto: 'LS', clave: (i, c) => c.LS[i] },
  { id: 'lf', nombre: 'Menor terminación tardía (LF)', corto: 'LF', clave: (i, c) => c.LF[i] },
  { id: 'duracion', nombre: 'Mayor duración', corto: 'duración', clave: (i, c, red) => -red.d[i] },
  { id: 'demanda', nombre: 'Mayor demanda total de recursos', corto: 'demanda', clave: (i, c, red) => -red.r[i].reduce((s, x) => s + x, 0) },
];
export const reglaPorId = (id) => REGLAS.find((r) => r.id === id) || REGLAS[0];

/** Valor de la clave principal que se muestra al estudiante (positivo). */
export function claveVisible(regla, i, c, red) {
  const v = regla.clave(i, c, red);
  return regla.id === 'duracion' || regla.id === 'demanda' ? -v : v;
}

/** Actividades que por sí solas exceden el límite de algún recurso. */
export function culpables(red) {
  const out = [];
  red.nombres.forEach((nombre, i) => red.recursos.forEach((rec, k) => {
    const lim = red.limites[k];
    if (lim != null && red.r[i][k] > lim) out.push({ act: i, nombre, recurso: k, recursoNombre: rec, req: red.r[i][k], limite: lim });
  }));
  return out;
}

export function textoInfactible(c) {
  return `La actividad ${c.nombre} necesita ${c.req} de ${c.recursoNombre} y el límite es ${c.limite}: aunque se programe sola no cabe. Sube el límite o baja el requerimiento.`;
}

/** Comparador de la cadena de prioridad. */
function comparador(regla, c, red) {
  return (a, b) => regla.clave(a, c, red) - regla.clave(b, c, red) || c.LS[a] - c.LS[b] || c.H[a] - c.H[b] || a - b;
}

export function asignar(red, { regla: reglaId = 'holgura' } = {}) {
  const regla = reglaPorId(reglaId);
  if (red.limites.some((l) => l == null)) return { ok: false, motivo: 'sinLimite', mensaje: 'Escribe el límite disponible de cada recurso para poder asignar.' };
  const malos = culpables(red);
  if (malos.length) return { ok: false, motivo: 'infactible', culpables: malos, mensaje: malos.map(textoInfactible).join(' ') };

  const c = cpm(red);
  const { n, d } = red;
  const K = red.recursos.length;
  const starts = new Array(n).fill(null);
  const cmp = comparador(regla, c, red);
  const log = [];
  let programadas = 0;
  let t = 0;
  const tope = d.reduce((s, x) => s + x, 0) + 1; // ningún cronograma serial dura más que la suma de duraciones
  while (programadas < n && t <= tope) {
    const enCurso = [];
    const uso = new Array(K).fill(0);
    for (let i = 0; i < n; i++) if (starts[i] != null && starts[i] <= t && t < starts[i] + d[i]) {
      enCurso.push(i);
      for (let k = 0; k < K; k++) uso[k] += red.r[i][k];
    }
    const elegibles = [];
    for (let i = 0; i < n; i++) {
      if (starts[i] != null) continue;
      if (red.preds[i].every((p) => starts[p] != null && starts[p] + d[p] <= t)) elegibles.push(i);
    }
    if (elegibles.length) {
      elegibles.sort(cmp);
      const usoInicial = uso.slice();
      const decisiones = [];
      for (const i of elegibles) {
        let falla = null;
        for (let k = 0; k < K; k++) if (uso[k] + red.r[i][k] > red.limites[k]) { falla = { k, uso: uso[k], req: red.r[i][k], limite: red.limites[k] }; break; }
        if (!falla) {
          starts[i] = t;
          programadas += 1;
          for (let k = 0; k < K; k++) uso[k] += red.r[i][k];
          decisiones.push({ act: i, accion: 'programa', usoDespues: uso.slice() });
        } else {
          decisiones.push({ act: i, accion: 'retrasa', falla });
        }
      }
      log.push({
        t,
        periodo: t + 1,
        enCurso,
        usoInicial,
        elegibles: elegibles.slice(),
        decisiones,
        usoFinal: uso.slice(),
        starts: starts.slice(),
      });
    }
    t += 1;
  }
  const T = finProyecto(red, starts);
  const retrasos = starts.map((s, i) => ({ act: i, ES: c.ES[i], inicio: s, retraso: s - c.ES[i] })).filter((x) => x.retraso > 0);
  return {
    ok: true,
    regla,
    starts,
    T,
    Tsinlimite: c.T,
    cota: cotaInferior(red, c.T),
    retrasos,
    log,
    base: c,
  };
}
