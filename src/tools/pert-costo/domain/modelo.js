/**
 * Modelo PERT/COSTO: validación de filas editables y estructura interna.
 *
 * Fila editable: { name, preds, dn, dl, cn, cl }  (texto o número)
 *   dn, cn = duración y costo normales; dl, cl = duración y costo límite (crash).
 *   Si dl y cl están vacíos, la actividad no se puede acortar.
 * Parámetros del proyecto: ci = costo indirecto por unidad de tiempo, fijo = costo indirecto fijo.
 */
import { splitPreds, toNumber } from '../../ruta-critica/domain/parser.js';

export const MAX_ACTIVIDADES = 60;
export const MAX_UNIDADES = 3000; // tope de la duración normal del proyecto, para no bloquear la página

const vacio = (v) => v == null || String(v).trim() === '';

/** Pendiente de costo = (CL − CN) / (DN − DL); null si la actividad no se puede acortar. */
export function pendiente(a) {
  return a.dn > a.dl ? (a.cl - a.cn) / (a.dn - a.dl) : null;
}

function buscarCiclo(acts) {
  const preds = new Map(acts.map((a) => [a.name, a.preds]));
  const estado = new Map();
  const pila = [];
  const visita = (n) => {
    estado.set(n, 1);
    pila.push(n);
    for (const p of preds.get(n) || []) {
      if (estado.get(p) === 1) return [...pila.slice(pila.indexOf(p)), p].reverse();
      if (!estado.get(p)) {
        const c = visita(p);
        if (c) return c;
      }
    }
    pila.pop();
    estado.set(n, 2);
    return null;
  };
  for (const a of acts) {
    if (!estado.get(a.name)) {
      const c = visita(a.name);
      if (c) return c;
    }
  }
  return null;
}

/**
 * Normaliza filas y parámetros. Devuelve { actividades, errores, avisos, ci, fijo }.
 * errores = [{ fila, msg }] (fila empieza en 0; null si es general).
 */
export function normalizar(filas, { ci = '', fijo = '' } = {}) {
  const errores = [];
  const avisos = [];
  const actividades = [];
  const vistos = new Map();

  filas.forEach((r, i) => {
    const name = String(r.name ?? '').trim();
    const contenido = name || ['preds', 'dn', 'dl', 'cn', 'cl'].some((k) => !vacio(r[k]));
    if (!name) {
      if (contenido) errores.push({ fila: i, msg: `La fila ${i + 1} no tiene nombre de actividad.` });
      return;
    }
    if (vistos.has(name)) {
      errores.push({ fila: i, msg: `La actividad "${name}" está repetida (filas ${vistos.get(name) + 1} y ${i + 1}).` });
      return;
    }
    vistos.set(name, i);

    const dn = toNumber(r.dn);
    const cn = toNumber(r.cn);
    let dl = vacio(r.dl) ? null : toNumber(r.dl);
    let cl = vacio(r.cl) ? null : toNumber(r.cl);
    let bien = true;
    const err = (m) => { errores.push({ fila: i, msg: m }); bien = false; };

    if (dn == null) err(vacio(r.dn) ? `Falta la duración normal de "${name}" (fila ${i + 1}).` : `La duración normal de "${name}" no es un número.`);
    else if (dn < 0 || !Number.isInteger(dn)) err(`La duración normal de "${name}" debe ser un entero no negativo (usa una unidad menor, por ejemplo días en vez de semanas).`);
    if (cn == null) err(vacio(r.cn) ? `Falta el costo normal de "${name}" (fila ${i + 1}).` : `El costo normal de "${name}" no es un número.`);
    else if (cn < 0) err(`El costo normal de "${name}" no puede ser negativo.`);
    if (!vacio(r.dl) && dl == null) err(`La duración límite de "${name}" no es un número.`);
    if (!vacio(r.cl) && cl == null) err(`El costo límite de "${name}" no es un número.`);
    if (dl != null && (dl < 0 || !Number.isInteger(dl))) err(`La duración límite de "${name}" debe ser un entero no negativo.`);
    if ((vacio(r.dl) !== vacio(r.cl))) {
      err(`"${name}": escribe la duración límite y el costo límite juntos, o deja los dos vacíos si no se puede acortar.`);
    }
    if (bien && dl != null && cl != null) {
      if (dl > dn) err(`En "${name}" la duración límite (${dl}) no puede ser mayor que la normal (${dn}).`);
      else if (cl < cn) err(`En "${name}" el costo límite (${cl}) no puede ser menor que el normal (${cn}).`);
      else if (dl === dn && cl !== cn) {
        avisos.push(`"${name}" tiene la misma duración normal y límite: no se puede acortar, así que se ignora su costo límite.`);
        cl = cn;
      }
    }
    if (bien && dl == null) { dl = dn; cl = cn; }
    actividades.push({
      name,
      preds: [...new Set(splitPreds(r.preds))],
      dn, dl, cn, cl,
      fila: i,
    });
  });

  for (const a of actividades) {
    for (const p of a.preds) {
      if (p === a.name) errores.push({ fila: a.fila, msg: `"${a.name}" no puede depender de sí misma.` });
      else if (!vistos.has(p)) errores.push({ fila: a.fila, msg: `"${a.name}" depende de "${p}", que no existe en la tabla.${[...vistos.keys()].some((n) => /[\s,;]/.test(n)) ? ' Los nombres de actividad no deben llevar espacios, comas ni punto y coma si otras actividades dependen de ellas.' : ''}` });
    }
  }
  if (!errores.length) {
    const c = buscarCiclo(actividades);
    if (c) errores.push({ fila: null, msg: `Hay un ciclo de dependencias: ${c.join(' → ')}. Una red de proyecto no puede volver atrás.` });
  }
  if (!actividades.length && !errores.length) errores.push({ fila: null, msg: 'Agrega al menos una actividad.' });
  if (actividades.length > MAX_ACTIVIDADES) errores.push({ fila: null, msg: `Se aceptan hasta ${MAX_ACTIVIDADES} actividades.` });

  let ciN = 0;
  if (!vacio(ci)) {
    ciN = toNumber(ci);
    if (ciN == null || ciN < 0) { errores.push({ fila: null, msg: 'El costo indirecto por unidad de tiempo debe ser un número no negativo.' }); ciN = 0; }
  } else errores.push({ fila: null, msg: 'Escribe el costo indirecto por unidad de tiempo (puede ser 0).' });
  let fijoN = 0;
  if (!vacio(fijo)) {
    fijoN = toNumber(fijo);
    if (fijoN == null || fijoN < 0) { errores.push({ fila: null, msg: 'El costo indirecto fijo debe ser un número no negativo.' }); fijoN = 0; }
  }
  return { actividades, errores, avisos, ci: ciN, fijo: fijoN };
}

/** Estructura interna por índices (lo que usan los algoritmos). */
export function armarModelo(actividades, { ci = 0, fijo = 0 } = {}) {
  const n = actividades.length;
  const idx = new Map(actividades.map((a, i) => [a.name, i]));
  const preds = actividades.map((a) => a.preds.map((p) => idx.get(p)));
  const succs = Array.from({ length: n }, () => []);
  preds.forEach((ps, j) => ps.forEach((i) => succs[i].push(j)));
  return {
    n,
    ci,
    fijo,
    names: actividades.map((a) => a.name),
    preds,
    succs,
    dn: actividades.map((a) => a.dn),
    dl: actividades.map((a) => a.dl),
    cn: actividades.map((a) => a.cn),
    cl: actividades.map((a) => a.cl),
    pend: actividades.map(pendiente),
    actividades,
  };
}

/** Costo directo con duraciones d (lineal entre normal y límite). */
export function costoDirecto(m, d) {
  let c = 0;
  for (let j = 0; j < m.n; j++) c += m.cn[j] + (m.pend[j] == null ? 0 : m.pend[j] * (m.dn[j] - d[j]));
  return c;
}
