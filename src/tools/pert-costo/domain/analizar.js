/** Tubería completa: filas editables → modelo, solución, red y tablas. La usan la interfaz y las exportaciones. */
import { normalizar, armarModelo } from './modelo.js';
import { resolver } from './reducir.js';
import { construirRed } from './red.js';
import { explicarPasos, textoRuta } from './pasos.js';
import { NOTACION } from './notacion.js';
import { num, lista } from './formato.js';

export function analizar({ filas, ci, fijo, objetivo = '' }) {
  const nor = normalizar(filas, { ci, fijo });
  if (nor.errores.length) return { ok: false, errores: nor.errores, avisos: nor.avisos };
  try {
    const m = armarModelo(nor.actividades, { ci: nor.ci, fijo: nor.fijo });
    const res = resolver(m);
    const red = construirRed(m);
    const pasos = explicarPasos(m, res);
    return { ok: true, errores: [], avisos: nor.avisos, m, res, red, pasos, objetivo: evaluarObjetivo(res, objetivo) };
  } catch (err) {
    return { ok: false, errores: [{ fila: null, msg: 'No se pudo resolver con estos datos: ' + err.message }], avisos: nor.avisos };
  }
}

/** ¿Cuánto cuesta terminar en la duración T objetivo? (null si el campo está vacío o no es un número). */
export function evaluarObjetivo(res, texto) {
  const t = String(texto ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const T = Number(t);
  if (!Number.isInteger(T) || T < 0) return { T: t, error: 'La duración objetivo debe ser un número entero no negativo.' };
  if (T < res.Tmin) return { T, imposible: true, mensaje: `No se puede terminar en ${T}: aun con todas las actividades en su límite el proyecto dura ${res.Tmin}.` };
  if (T >= res.T0) return { T, estado: res.estadoEn(res.T0), mensaje: `Con las duraciones normales ya se termina en ${res.T0}, que cumple ${T}.` };
  const e = res.estadoEn(T);
  return { T, estado: e, mensaje: `Para terminar en ${T}: costo directo ${num(e.directo)}, indirecto ${num(e.indirecto)}, total ${num(e.total)}.` };
}

export function resumen(a) {
  const { res, m } = a;
  const o = res.optimo;
  const e = res.estadoEn(o.T);
  return [
    `Duración normal: ${res.T0} (costo total ${num(res.normal.total)}).`,
    `Duración límite: ${res.Tmin} (costo total ${num(res.limite.total)}).`,
    `Duración de costo mínimo: ${o.T}, con costo directo ${num(e.directo)}, indirecto ${num(e.indirecto)} y total ${num(o.total)}.`,
    ...(o.empates.length > 1 ? [`Empate de costo total en las duraciones ${o.empates.join(', ')}.`] : []),
    `Rutas críticas con duraciones normales: ${res.normal.rutas.rutas.map((r) => textoRuta(r, m.names)).join('; ')}.`,
  ];
}

/** Tabla de actividades con pendiente. */
export function tablaActividades(a) {
  const { m, res } = a;
  const crit = new Set(res.normal.rutas.rutas.flat());
  const headers = [...NOTACION.columnas.map((c) => NOTACION.nombre[c]), NOTACION.pendiente, 'Crítica (normal)'];
  const rows = m.names.map((nom, j) => [
    nom,
    m.actividades[j].preds.join(', ') || '-',
    num(m.dn[j]), num(m.cn[j]), num(m.dl[j]), num(m.cl[j]),
    m.pend[j] == null ? 'No se acorta' : num(m.pend[j]),
    crit.has(nom) ? 'Sí' : 'No',
  ]);
  return { headers, rows, criticas: m.names.map((n) => crit.has(n)) };
}

/** Tabla de reducciones paso a paso. */
export function tablaReducciones(a) {
  const { res, m } = a;
  const headers = ['Paso', 'De → a', 'Acortan', 'Alargan', 'Pendiente del corte', 'Costo directo', 'Costo indirecto', 'Costo total', '¿Conviene?'];
  const rows = res.pasos.map((p) => [
    String(p.n),
    `${p.desde} → ${p.hasta}`,
    lista(p.acortan.map((x) => `${x.nombre} (${p.unidades})`)),
    p.alargan.length ? lista(p.alargan.map((x) => `${x.nombre} (${p.unidades})`)) : '-',
    num(p.pendiente),
    num(p.directo), num(p.indirecto), num(p.total),
    p.empata ? 'Indiferente' : p.conviene ? 'Sí' : 'No',
  ]);
  return { headers, rows, optimas: res.pasos.map((p) => p.hasta === res.optimo.T), m };
}

/** Curva costo-duración: una fila por duración entera. */
export function tablaCurva(a) {
  const { res } = a;
  const headers = ['Duración', 'Costo directo', 'Costo indirecto', 'Costo total', 'Óptima'];
  const rows = res.estados.map((e) => [
    String(e.T), num(e.directo), num(e.indirecto), num(e.total),
    e.T === res.optimo.T ? 'Sí' : res.optimo.empates.includes(e.T) ? 'Empate' : '',
  ]);
  return { headers, rows, optimas: res.estados.map((e) => e.T === res.optimo.T) };
}

/** Duraciones de cada actividad en la duración óptima. */
export function tablaDuracionOptima(a) {
  const { m, res } = a;
  const e = res.estadoEn(res.optimo.T);
  const headers = ['Actividad', 'Duración normal', 'Duración en el óptimo', 'Acortada en', 'Costo en el óptimo'];
  const rows = m.names.map((nom, j) => {
    const costo = m.cn[j] + (m.pend[j] == null ? 0 : m.pend[j] * (m.dn[j] - e.d[j]));
    return [nom, num(m.dn[j]), num(e.d[j]), num(m.dn[j] - e.d[j]), num(costo)];
  });
  return { headers, rows, cambiadas: m.names.map((_, j) => e.d[j] !== m.dn[j]) };
}
