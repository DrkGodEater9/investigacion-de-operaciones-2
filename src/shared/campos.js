/**
 * Filtros de entrada para los campos del sitio: dejan escribir solo lo que el campo admite
 * (también al pegar). Se usan en el onChange; el valor ya filtrado es el que se guarda.
 *
 *   <input value={v} onChange={(e) => setV(filtrar.decimal(e.target.value, { negativo: true }))} />
 *   o  onChange={alCambiar(filtrar.entero, setV)}
 *
 * Son funciones puras (se prueban con Node). No validan rangos: eso lo hace el dominio.
 */

const MAX_NUM = 14; // caracteres de un número escrito
const MAX_NOMBRE = 24;
const MAX_TEXTO = 80;

const quitarControl = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '');
const normalizarMenos = (s) => s.replace(/[−–—]/g, '-');

/**
 * Número decimal: dígitos, una sola coma o punto decimal y, si se permite, un «-» inicial.
 * Con `fraccion: true` admite además un «/» (p. ej. 3/2) y un segundo número tras él.
 * Con `porcentaje: true` ignora un «%» final.
 */
function decimal(texto, { negativo = false, fraccion = false, max = MAX_NUM } = {}) {
  let s = normalizarMenos(quitarControl(texto)).replace(/\s+/g, '');
  const partes = fraccion ? s.split('/') : [s];
  const salida = [];
  for (let k = 0; k < Math.min(partes.length, 2); k++) {
    let p = partes[k].replace(/[^0-9.,\-]/g, '');
    const neg = negativo && p.startsWith('-');
    p = p.replace(/-/g, '');
    let visto = false;
    let q = '';
    for (const ch of p) {
      if (ch === '.' || ch === ',') {
        if (visto) continue;
        visto = true;
      }
      q += ch;
    }
    salida.push((neg ? '-' : '') + q);
  }
  s = salida.join('/');
  if (fraccion && partes.length > 1 && !s.includes('/')) s += '/';
  return s.slice(0, max);
}

/** Entero: solo dígitos (y «-» inicial si se permite). */
function entero(texto, { negativo = false, max = 9 } = {}) {
  const s = normalizarMenos(quitarControl(texto)).replace(/\s+/g, '');
  const neg = negativo && s.startsWith('-');
  return ((neg ? '-' : '') + s.replace(/[^0-9]/g, '')).slice(0, max);
}

/**
 * Nombre corto (variable, actividad, estado…): letras (con tildes y ñ), dígitos, guion bajo,
 * punto y guion; sin espacios, comas, barras ni punto y coma.
 */
function nombre(texto, { max = MAX_NOMBRE } = {}) {
  return quitarControl(texto)
    .replace(/[^\p{L}\p{N}_.\-′']/gu, '')
    .slice(0, max);
}

/** Lista de nombres separados por coma (predecesoras): como `nombre` pero deja comas y un espacio tras ellas. */
function listaNombres(texto, { max = 60 } = {}) {
  return quitarControl(texto)
    .replace(/[^\p{L}\p{N}_.\-,\s′']/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/^[\s,]+/, '')
    .replace(/,\s*,+/g, ',')
    .slice(0, max);
}

/** Texto libre de una línea (etiquetas, nombres de restricción): sin saltos, `|` ni caracteres de control. */
function texto1(texto, { max = MAX_TEXTO } = {}) {
  return quitarControl(texto).replace(/[|<>]/g, '').replace(/\s{2,}/g, ' ').slice(0, max);
}

/** Semilla de ejercicio: entero positivo de hasta 9 dígitos. */
const semilla = (t) => entero(t, { negativo: false, max: 9 });

/** Porcentaje: número decimal que puede terminar en «%». */
function porcentaje(texto, opts = {}) {
  const s = String(texto ?? '').trim();
  const pct = s.endsWith('%');
  const n = decimal(pct ? s.slice(0, -1) : s, { negativo: false, ...opts });
  return pct && n ? n + ' %' : n;
}

export const filtrar = { decimal, entero, nombre, listaNombres, texto1, semilla, porcentaje };

/** Envuelve un filtro y un setter en un manejador onChange de <input>. */
export const alCambiar = (filtro, set, opciones) => (ev) => set(filtro(ev.target.value, opciones));

/** inputMode/autoComplete/spellCheck comunes para campos numéricos. */
export const propsNumero = { inputMode: 'decimal', autoComplete: 'off', spellCheck: false };
export const propsEntero = { inputMode: 'numeric', autoComplete: 'off', spellCheck: false };

/** Nombre con espacios simples (p. ej. «Mano de obra», «Recurso 2»): letras, dígitos, espacio, `_`, `.`, `-`; sin `|`, comas ni símbolos. */
export function nombreEspacios(texto, { max = MAX_NOMBRE } = {}) {
  return quitarControl(texto)
    .replace(/[^\p{L}\p{N}_.\-′'\s]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/, '')
    .slice(0, max);
}

/**
 * Probabilidad escrita como decimal (0,25), fracción (1/4) o porcentaje (25 %): sin negativos;
 * el «%» solo puede ir al final y no se combina con la fracción.
 */
export function probabilidad(texto, { max = MAX_NUM } = {}) {
  const s = String(texto ?? '').trim();
  const pct = s.endsWith('%');
  const n = decimal(pct ? s.slice(0, -1) : s, { negativo: false, fraccion: !pct, max });
  if (!pct) return n;
  return n && !n.includes('/') ? n + ' %' : n.replace('/', '');
}

/** Restricción de una variable («x1 <= 3», «3 >= x1», «x₁ ≤ 7/2»): letras x, dígitos, comparadores, «-», «/», «.», «,», «_» y subíndices ₁₂. */
export function restriccionSimple(texto, { max = 24 } = {}) {
  return String(texto ?? '')
    .replace(/[≤]/g, '<=')
    .replace(/[≥]/g, '>=')
    .replace(/[−–—]/g, '-')
    .replace(/[^xX0-9<>=\-/.,_₁₂ ]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+/, '')
    .slice(0, max);
}

/**
 * Etiqueta corta con espacios (nombre de alternativa, estado o resultado): letras, dígitos,
 * espacios y . _ - ( ) / % ′ '; sin barras verticales, <>, punto y coma ni símbolos raros.
 */
export function etiqueta(texto, { max = MAX_NOMBRE } = {}) {
  return quitarControl(texto)
    .replace(/[^\p{L}\p{N}\s_.\-()/%′']/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/, '')
    .slice(0, max);
}
