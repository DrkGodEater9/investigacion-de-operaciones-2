/**
 * Modelo del tema 3.4 (distribución de recursos).
 *
 *   modelo = {
 *     recursos: [{ name: 'Obreros', limite: 6 | null }],
 *     acts:     [{ name: 'A', d: 3, preds: ['B'], r: [4] }],   // r[k]: unidades del recurso k por período
 *   }
 *
 * Convenciones (fáciles de cambiar aquí):
 *  - Duraciones y requerimientos son enteros (períodos y unidades).
 *  - Una actividad que empieza en el tiempo s ocupa los períodos s+1, …, s+d (el período t es el intervalo (t−1, t]).
 *  - El límite puede quedar vacío (null): solo se pierde la detección de picos y la asignación.
 */
import { splitPreds } from '../../ruta-critica/domain/parser.js';

export const MAX_ACT = 30;
export const MAX_REC = 3;
export const MAX_DUR = 99;
export const MAX_REQ = 9999;
export const MAX_SUMA_DUR = 200; // la suma de duraciones acota la duración de cualquier cronograma

const quitarTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const PALABRAS_LIMITE = new Set(['disponible', 'disponibles', 'limite', 'limites', 'capacidad', 'maximo', 'max', 'disponibilidad']);

/** Entero no negativo en texto («3», «3,0»); null si no lo es. */
export function entero(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(',', '.');
  if (!/^\d+(\.0+)?$/.test(s)) return null;
  return Math.round(Number(s));
}

/** Detecta ciclos de dependencias; devuelve la lista de nombres del ciclo o null. */
function buscarCiclo(acts) {
  const preds = new Map(acts.map((a) => [a.name, a.preds]));
  const estado = new Map();
  const pila = [];
  const dfs = (n) => {
    estado.set(n, 1);
    pila.push(n);
    for (const p of preds.get(n) || []) {
      if (estado.get(p) === 1) return [...pila.slice(pila.indexOf(p)), p].reverse();
      if (!estado.get(p)) { const c = dfs(p); if (c) return c; }
    }
    pila.pop();
    estado.set(n, 2);
    return null;
  };
  for (const a of acts) if (!estado.get(a.name)) { const c = dfs(a.name); if (c) return c; }
  return null;
}

/** Valida un modelo ya armado. Devuelve la lista de errores (texto) y de avisos. */
export function validarModelo(modelo) {
  const errores = [];
  const avisos = [];
  const { acts, recursos } = modelo;
  if (!acts.length) errores.push('Agrega al menos una actividad.');
  if (acts.length > MAX_ACT) errores.push(`Hay ${acts.length} actividades; el máximo es ${MAX_ACT}.`);
  if (!recursos.length) errores.push('Agrega al menos un recurso.');
  if (recursos.length > MAX_REC) errores.push(`Hay ${recursos.length} recursos; el máximo es ${MAX_REC}.`);
  const nombresR = new Set();
  recursos.forEach((r) => {
    if (!r.name) errores.push('Hay un recurso sin nombre.');
    else if (nombresR.has(r.name)) errores.push(`El recurso "${r.name}" está repetido.`);
    nombresR.add(r.name);
  });
  const vistos = new Set();
  acts.forEach((a) => {
    if (vistos.has(a.name)) errores.push(`La actividad "${a.name}" está repetida.`);
    vistos.add(a.name);
  });
  acts.forEach((a) => {
    a.preds.forEach((p) => {
      if (p === a.name) errores.push(`"${a.name}" no puede depender de sí misma.`);
      else if (!vistos.has(p)) errores.push(`"${a.name}" depende de "${p}", que no existe en la tabla.`);
    });
  });
  if (!errores.length) {
    const ciclo = buscarCiclo(acts);
    if (ciclo) errores.push(`Hay un ciclo de dependencias: ${ciclo.join(' → ')}. Una red de proyecto no puede volver atrás.`);
  }
  if (!errores.length && acts.reduce((s, a) => s + a.d, 0) > MAX_SUMA_DUR) {
    errores.push(`La suma de las duraciones supera ${MAX_SUMA_DUR} períodos; reduce la escala (por ejemplo, usa semanas en vez de días).`);
  }
  if (!errores.length && recursos.some((r) => r.limite == null)) {
    avisos.push('Falta el límite de algún recurso: se calcula el histograma y la nivelación, pero no la detección de picos ni la asignación con recursos limitados.');
  }
  return { errores, avisos };
}

/* ---------------- Markdown / tabla ---------------- */

function celdas(linea) {
  let t = linea.trim();
  if (t.includes('|')) {
    t = t.replace(/^\|/, '').replace(/\|$/, '');
    return t.split('|').map((c) => c.trim());
  }
  if (t.includes('\t')) return t.split('\t').map((c) => c.trim());
  return null;
}
const esSeparador = (cs) => cs.every((c) => /^:?-{2,}:?$/.test(c) || c === '');

/**
 * Texto (tabla Markdown o pegada desde una hoja) → { modelo, errores, avisos }.
 * Encabezado: Actividad | Duración | Predecesoras | <recurso 1> | <recurso 2> …  (las columnas pueden ir en otro orden).
 * La fila cuya primera celda dice «Límite» (o «Disponible») trae el límite de cada recurso.
 */
export function parseMarkdown(texto) {
  const errores = [];
  const lineas = String(texto ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const filas = lineas.map(celdas).filter((c) => c && !esSeparador(c));
  if (!filas.length) return { modelo: null, errores: ['Escribe la tabla de actividades (con el encabezado Actividad | Duración | Predecesoras | recurso).'], avisos: [] };
  const enc = filas[0].map(quitarTildes);
  const cAct = enc.findIndex((h) => /^(actividad|tarea|act\.?)$/.test(h));
  const cDur = enc.findIndex((h) => /^(duracion|dur\.?|tiempo|d)$/.test(h));
  const cPred = enc.findIndex((h) => /^predece/.test(h) || /^(precedencia|dependencias?|predec\.?)$/.test(h));
  if (cAct < 0 || cDur < 0 || cPred < 0) {
    return { modelo: null, errores: ['El encabezado debe tener las columnas Actividad, Duración y Predecesoras, y una columna por recurso.'], avisos: [] };
  }
  const cols = [];
  filas[0].forEach((h, i) => { if (![cAct, cDur, cPred].includes(i) && h) cols.push(i); });
  const recursos = cols.map((i) => ({ name: filas[0][i].replace(/\s+/g, ' ').trim(), limite: null }));
  const acts = [];
  filas.slice(1).forEach((f, k) => {
    const fila = k + 1;
    const nombre = (f[cAct] ?? '').trim();
    if (PALABRAS_LIMITE.has(quitarTildes(nombre))) {
      cols.forEach((c, j) => {
        const v = (f[c] ?? '').trim();
        if (v === '' || v === '-') return;
        const n = entero(v);
        if (n == null) errores.push(`Límite de "${recursos[j].name}": "${v}" no es un entero no negativo.`);
        else recursos[j].limite = n;
      });
      return;
    }
    if (!nombre) { if (f.some((c) => c)) errores.push(`Fila ${fila}: falta el nombre de la actividad.`); return; }
    const d = entero(f[cDur]);
    if (d == null) errores.push(`Fila ${fila} (${nombre}): la duración debe ser un entero de períodos (escribiste "${f[cDur] ?? ''}").`);
    else if (d < 1) errores.push(`Fila ${fila} (${nombre}): la duración debe ser al menos 1 período.`);
    else if (d > MAX_DUR) errores.push(`Fila ${fila} (${nombre}): la duración máxima es ${MAX_DUR} períodos.`);
    const r = cols.map((c, j) => {
      const v = (f[c] ?? '').trim();
      if (v === '' || v === '-') return 0;
      const n = entero(v);
      if (n == null) { errores.push(`Fila ${fila} (${nombre}): el requerimiento de "${recursos[j].name}" debe ser un entero no negativo (escribiste "${v}").`); return 0; }
      if (n > MAX_REQ) { errores.push(`Fila ${fila} (${nombre}): el requerimiento de "${recursos[j].name}" es demasiado grande.`); return 0; }
      return n;
    });
    acts.push({ name: nombre, d: d ?? 1, preds: [...new Set(splitPreds(f[cPred]))], r });
  });
  const modelo = { recursos, acts };
  const v = validarModelo(modelo);
  errores.push(...v.errores);
  return { modelo: errores.length ? null : modelo, errores, avisos: v.avisos };
}

/** Modelo → tabla Markdown (la misma forma que lee parseMarkdown). */
export function modeloAMarkdown(modelo, titulo) {
  const enc = ['Actividad', 'Duración', 'Predecesoras', ...modelo.recursos.map((r) => r.name)];
  const linea = (cs) => '| ' + cs.join(' | ') + ' |';
  const filas = modelo.acts.map((a) => linea([a.name, a.d, a.preds.length ? a.preds.join(', ') : '-', ...a.r]));
  const lim = linea(['Límite', '', '', ...modelo.recursos.map((r) => (r.limite == null ? '' : r.limite))]);
  return [...(titulo ? [`# ${titulo}`] : []), linea(enc), '|' + enc.map(() => '---').join('|') + '|', ...filas, lim].join('\n');
}
