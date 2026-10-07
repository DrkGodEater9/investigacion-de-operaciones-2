/**
 * Reducción de la duración paso a paso (PERT/COSTO) con duraciones enteras.
 *
 * En cada unidad de tiempo que se recorta se busca el corte de costo mínimo de la red crítica:
 *   - una sola actividad crítica cuando todas las rutas críticas pasan por ella,
 *   - un conjunto de actividades cuando hay varias rutas críticas simultáneas (una por ruta, como un corte),
 *   - y, si conviene, se alarga una actividad que ya se había acortado (se recupera su costo).
 * Es el método de Fulkerson / Phillips y Dessouky: da el costo directo mínimo para cada duración entera.
 * Las unidades consecutivas con el mismo corte y las mismas actividades críticas se juntan en un solo paso.
 */
import { tiempos, rutasCriticas, ordenTopologico } from './calculo.js';
import { costoDirecto, MAX_UNIDADES } from './modelo.js';
import { corteMinimo, corteExhaustivo } from './corte.js';

const FUENTE = 0;
const SUMIDERO = 1;
const nodoInicio = (j) => 2 + 2 * j;
const nodoFin = (j) => 3 + 2 * j;

/** Red crítica (nodos partidos inicio/fin por actividad) y su corte de costo mínimo para las duraciones d. */
export function cortarRedCritica(m, d, tm, verificar = false) {
  const n = 2 + 2 * m.n;
  const E = new Array(n);
  const L = new Array(n);
  E[FUENTE] = 0; L[FUENTE] = 0; E[SUMIDERO] = tm.T; L[SUMIDERO] = tm.T;
  for (let j = 0; j < m.n; j++) {
    E[nodoInicio(j)] = tm.es[j]; L[nodoInicio(j)] = tm.ls[j];
    E[nodoFin(j)] = tm.ef[j]; L[nodoFin(j)] = tm.lf[j];
  }
  const flechas = [];
  const agrega = (u, v, len, act) => {
    if (E[u] === L[u] && E[v] === L[v] && E[u] + len === E[v]) {
      let cap = Infinity;
      let lo = 0;
      if (act != null && m.pend[act] != null) {
        if (d[act] > m.dl[act]) cap = m.pend[act];
        if (d[act] < m.dn[act]) lo = m.pend[act];
      }
      flechas.push({ u, v, cap, lo, act });
    }
  };
  for (let j = 0; j < m.n; j++) {
    if (!m.preds[j].length) agrega(FUENTE, nodoInicio(j), 0, null);
    agrega(nodoInicio(j), nodoFin(j), d[j], j);
    for (const i of m.preds[j]) agrega(nodoFin(i), nodoInicio(j), 0, null);
    if (!m.succs[j].length) agrega(nodoFin(j), SUMIDERO, 0, null);
  }
  const corte = corteMinimo(n, flechas, FUENTE, SUMIDERO);
  if (verificar) {
    const criticos = new Set([FUENTE, SUMIDERO]);
    flechas.forEach((a) => { criticos.add(a.u); criticos.add(a.v); });
    if (criticos.size <= 20) {
      // Se compacta a los nodos críticos y se compara con la búsqueda exhaustiva
      const lista = [...criticos];
      const pos = new Map(lista.map((v, i) => [v, i]));
      const ex = corteExhaustivo(lista.length, flechas.map((a) => ({ ...a, u: pos.get(a.u), v: pos.get(a.v) })), pos.get(FUENTE), pos.get(SUMIDERO));
      const tol = 1e-7 * Math.max(1, Math.abs(ex));
      if (Number.isFinite(ex) ? Math.abs(ex - corte.costo) > tol || corte.infinito : !corte.infinito) {
        throw new Error(`El corte por flujo (${corte.costo}) no coincide con la búsqueda exhaustiva (${ex}).`);
      }
    }
  }
  return { corte, flechas };
}

/**
 * Resuelve el problema completo. m viene de armarModelo(). Devuelve:
 *   T0 (duración normal), Tmin (duración límite), estados (uno por unidad, de T0 a Tmin),
 *   pasos (reducciones agrupadas), optimo {T, total, empates}, normal, limite.
 */
export function resolver(m, { verificar = false } = {}) {
  const orden = ordenTopologico(m);
  const dNormal = m.dn.slice();
  const tmNormal = tiempos(m, dNormal, orden);
  const Tmin = tiempos(m, m.dl, orden).T;
  const T0 = tmNormal.T;
  if (T0 - Tmin > MAX_UNIDADES) throw new Error(`La duración normal (${T0}) supera el máximo de ${MAX_UNIDADES} unidades; usa una unidad de tiempo mayor.`);

  const indirecto = (T) => m.ci * T + m.fijo;
  const estado = (T, d) => {
    const directo = costoDirecto(m, d);
    return { T, d: d.slice(), directo, indirecto: indirecto(T), total: directo + indirecto(T) };
  };

  let d = dNormal.slice();
  let tm = tmNormal;
  const estados = [estado(T0, d)];
  const unidades = []; // un registro por unidad de tiempo recortada
  while (tm.T > Tmin) {
    const { corte } = cortarRedCritica(m, d, tm, verificar);
    if (corte.infinito) throw new Error('No se puede acortar más aunque la duración límite no se haya alcanzado (error interno).');
    const acorta = [];
    const alarga = [];
    for (let j = 0; j < m.n; j++) {
      if (!tm.critica[j]) continue;
      const u = nodoInicio(j);
      const v = nodoFin(j);
      // Solo cuentan las actividades cuya flecha crítica está en la red (siempre lo está si es crítica)
      if (corte.lado[u] && !corte.lado[v] && tm.es[j] + d[j] === tm.ef[j]) acorta.push(j);
      else if (!corte.lado[u] && corte.lado[v] && m.pend[j] != null && d[j] < m.dn[j]) alarga.push(j);
    }
    const antes = { d: d.slice(), critica: tm.critica.slice(), T: tm.T };
    for (const j of acorta) d[j] -= 1;
    for (const j of alarga) d[j] += 1;
    const nuevo = tiempos(m, d, orden);
    if (nuevo.T !== tm.T - 1) {
      throw new Error(`La reducción no bajó la duración exactamente en 1 (de ${tm.T} a ${nuevo.T}).`);
    }
    unidades.push({ acorta, alarga, antes, pendiente: acorta.reduce((s, j) => s + m.pend[j], 0) - alarga.reduce((s, j) => s + m.pend[j], 0) });
    tm = nuevo;
    estados.push(estado(tm.T, d));
  }

  // Agrupa unidades consecutivas con el mismo corte y las mismas actividades críticas
  const firma = (u) => `${u.acorta.join(',')}|${u.alarga.join(',')}|${u.antes.critica.map((c) => (c ? 1 : 0)).join('')}`;
  const grupos = [];
  for (const u of unidades) {
    const ult = grupos[grupos.length - 1];
    if (ult && firma(ult.primera) === firma(u)) { ult.cuenta += 1; ult.ultima = u; }
    else grupos.push({ primera: u, ultima: u, cuenta: 1 });
  }
  const nombres = (idx) => idx.map((j) => m.names[j]);
  let T = T0;
  const pasos = grupos.map((g, k) => {
    const u = g.primera;
    const desde = T;
    const hasta = T - g.cuenta;
    const est = estados[T0 - hasta];
    const tmDespues = tiempos(m, est.d, orden);
    const rutasAntes = rutasCriticas(m, tiempos(m, u.antes.d, orden));
    const rutasDespues = rutasCriticas(m, tmDespues);
    const criticasAntes = nombres(u.antes.critica.map((c, j) => (c ? j : -1)).filter((j) => j >= 0));
    const criticasDespues = nombres(tmDespues.critica.map((c, j) => (c ? j : -1)).filter((j) => j >= 0));
    const tipo = u.alarga.length ? 'con-alargue' : u.acorta.length === 1 ? 'una' : 'conjunto';
    const llegaLimite = u.acorta.filter((j) => est.d[j] === m.dl[j]);
    const termina = hasta === Tmin ? 'fin' : llegaLimite.length ? 'limite' : 'ruta';
    T = hasta;
    return {
      n: k + 1,
      desde,
      hasta,
      unidades: g.cuenta,
      tipo,
      acortan: u.acorta.map((j) => ({ j, nombre: m.names[j], pend: m.pend[j], unidades: g.cuenta })),
      alargan: u.alarga.map((j) => ({ j, nombre: m.names[j], pend: m.pend[j], unidades: g.cuenta })),
      pendiente: u.pendiente,
      costoAdicional: u.pendiente * g.cuenta,
      criticasAntes,
      rutasAntes: rutasAntes.rutas,
      rutasAntesTruncado: rutasAntes.truncado,
      candidatas: u.antes.critica
        .map((c, j) => (c ? j : -1)).filter((j) => j >= 0)
        .map((j) => ({ j, nombre: m.names[j], pend: m.pend[j], d: u.antes.d[j], dl: m.dl[j], reducible: m.pend[j] != null && u.antes.d[j] > m.dl[j] })),
      criticasDespues,
      rutasDespues: rutasDespues.rutas,
      rutasDespuesTruncado: rutasDespues.truncado,
      termina,
      llegaLimite: nombres(llegaLimite),
      d: est.d,
      directo: est.directo,
      indirecto: est.indirecto,
      total: est.total,
      conviene: u.pendiente < m.ci - 1e-9 * Math.max(1, Math.abs(m.ci)),
      empata: Math.abs(u.pendiente - m.ci) <= 1e-9 * Math.max(1, Math.abs(m.ci)),
    };
  });

  // Duración de costo total mínimo (si hay empates se informa la más larga: menos trabajo para el mismo costo)
  const minimo = Math.min(...estados.map((e) => e.total));
  const tol = 1e-9 * Math.max(1, Math.abs(minimo));
  const empates = estados.filter((e) => e.total <= minimo + tol).map((e) => e.T);
  const optimo = { T: Math.max(...empates), total: minimo, empates };

  return {
    T0,
    Tmin,
    estados,
    pasos,
    optimo,
    normal: { ...estado(T0, dNormal), tiempos: tmNormal, rutas: rutasCriticas(m, tmNormal) },
    limite: estado(Tmin, m.dl),
    estadoEn: (t) => estados[T0 - t],
  };
}

/** Pendiente de la curva entre dos duraciones consecutivas (costo directo extra por unidad que se recorta). */
export function pendienteTramo(res, t) {
  const a = res.estadoEn(t);
  const b = res.estadoEn(t - 1);
  return b ? b.directo - a.directo : null;
}
