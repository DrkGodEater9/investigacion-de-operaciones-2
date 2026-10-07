/**
 * Entrada de texto: tabla Markdown (o TSV / CSV) con las actividades y líneas de costo indirecto.
 *
 *   # Título
 *   Costo indirecto por unidad de tiempo: 50
 *   Costo indirecto fijo: 0
 *   | Actividad | Predecesoras | Duración normal | Costo normal | Duración límite | Costo límite |
 *   |---|---|---|---|---|---|
 *   | A | - | 4 | 100 | 2 | 160 |
 */
import { splitPreds, toNumber } from '../../ruta-critica/domain/parser.js';
import { NOTACION } from './notacion.js';

const quita = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const RE = {
  name: /^(actividad(es)?|activity|tarea|act\.?|id|codigo)$/,
  preds: /predece|dependen|prelaci|anterior|requisit|precede/,
  dn: /^(dn|tn|d\.?\s*n|t\.?\s*n)$|(duracion|tiempo|dur\.?).*normal|normal.*(duracion|tiempo)/,
  cn: /^(cn|c\.?\s*n)$|costo.*normal|normal.*costo/,
  dl: /^(dl|tl|tc|d\.?\s*l|d\.?\s*c)$|(duracion|tiempo|dur\.?).*(limite|crash|acelerad|minim|comprim)|(limite|crash|acelerad|minim).*(duracion|tiempo)/,
  cl: /^(cl|cc|c\.?\s*l|c\.?\s*c)$|costo.*(limite|crash|acelerad|comprim)|(limite|crash|acelerad).*costo/,
};

function cortaCSV(linea, delim) {
  const out = [];
  let cur = '';
  let comillas = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (comillas) {
      if (ch === '"' && linea[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') comillas = false;
      else cur += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

const NADA = new Set(['', '-', '--', '---', '—', '–', 'ninguna', 'ninguno', 'n/a', 'na', 'inicio', 'none']);
const celda = (c) => (NADA.has(quita(c)) ? '' : String(c).trim());
const numero = (c) => {
  const t = celda(c);
  if (t === '') return '';
  const n = toNumber(t);
  return n == null ? t : String(n);
};

/** Texto → { titulo, ci, fijo, filas, notas }. Nunca lanza error: lo que no se entiende se deja para la validación. */
export function leerTexto(texto) {
  const notas = [];
  let titulo = '';
  let ci = '';
  let fijo = '';
  const cuerpo = [];
  for (const cruda of String(texto ?? '').replace(/\r/g, '').split('\n')) {
    const linea = cruda.trim();
    if (!linea) continue;
    if (/^#{1,6}\s+/.test(linea)) { if (!titulo) titulo = linea.replace(/^#+\s+/, ''); continue; }
    const q = quita(linea);
    const m = q.match(/^(?:[-*]\s*)?costos?\s+indirectos?\s*(fijos?|por\s+(?:unidad|dia|semana|mes|periodo|dia)[^:=]*|\/\s*\w+)?\s*[:=]\s*\$?\s*([-+]?[\d.,]+)/);
    if (m && !linea.includes('|')) {
      const valor = String(toNumber(m[2]) ?? m[2]);
      if (m[1] && /^fij/.test(m[1])) fijo = valor; else ci = valor;
      continue;
    }
    cuerpo.push(cruda);
  }

  let filas;
  const conBarras = cuerpo.filter((l) => l.includes('|'));
  if (conBarras.length >= 2) {
    filas = conBarras
      .filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l))
      .map((l) => {
        const celdas = l.trim().split('|').map((c) => c.trim());
        if (celdas[0] === '') celdas.shift();
        if (celdas[celdas.length - 1] === '') celdas.pop();
        return celdas;
      });
  } else if (cuerpo.some((l) => l.includes('\t'))) filas = cuerpo.map((l) => l.split('\t').map((c) => c.trim()));
  else if (cuerpo.some((l) => l.includes(';'))) filas = cuerpo.map((l) => cortaCSV(l, ';'));
  else filas = cuerpo.map((l) => cortaCSV(l, ','));

  // Encabezado: la primera fila que nombre la actividad
  const hIdx = filas.findIndex((r) => r.some((c) => RE.name.test(quita(c))));
  let cols = null;
  if (hIdx >= 0) {
    cols = {};
    filas[hIdx].forEach((c, i) => {
      const h = quita(c);
      if (!h) return;
      for (const k of ['name', 'preds', 'dn', 'cn', 'dl', 'cl']) {
        if (cols[k] == null && RE[k].test(h)) { cols[k] = i; break; }
      }
    });
    const faltan = NOTACION.columnas.filter((k) => cols[k] == null && k !== 'preds');
    if (faltan.length) {
      notas.push(`No se reconocieron las columnas: ${faltan.map((k) => NOTACION.nombre[k]).join(', ')}. Se usó el orden de las columnas.`);
      NOTACION.columnas.forEach((k, i) => { if (cols[k] == null) cols[k] = i; });
    }
    if (cols.preds == null) cols.preds = NOTACION.columnas.indexOf('preds');
    filas = filas.slice(hIdx + 1);
  } else {
    cols = Object.fromEntries(NOTACION.columnas.map((k, i) => [k, i]));
  }
  const salida = filas
    .filter((r) => r.some((c) => String(c).trim() !== ''))
    .map((r) => ({
      name: String(r[cols.name] ?? '').trim(),
      preds: splitPreds(r[cols.preds]).join(','),
      dn: numero(r[cols.dn]),
      cn: numero(r[cols.cn]),
      dl: numero(r[cols.dl]),
      cl: numero(r[cols.cl]),
    }));
  return { titulo, ci, fijo, filas: salida, notas };
}

/** Proyecto editable → texto Markdown con la misma forma que acepta leerTexto. */
export function aMarkdown({ titulo, ci, fijo, filas }) {
  const cab = NOTACION.columnas.map((c) => NOTACION.nombre[c]);
  const linea = (celdas) => '| ' + celdas.join(' | ') + ' |';
  const cuerpo = filas
    .filter((f) => String(f.name).trim())
    .map((f) => linea(NOTACION.columnas.map((c) => (c === 'preds' ? String(f.preds || '').trim() || '-' : String(f[c] ?? '')))));
  const partes = [`# ${titulo}`];
  if (String(ci).trim() !== '') partes.push(`${NOTACION.lineaIndirecto}: ${ci}`);
  if (String(fijo).trim() !== '') partes.push(`${NOTACION.lineaFijo}: ${fijo}`);
  partes.push(linea(cab), '|' + cab.map(() => '---').join('|') + '|', ...cuerpo);
  return partes.join('\n');
}
