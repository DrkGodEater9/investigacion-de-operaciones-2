/**
 * Módulo de importación y exportación de modelos en Markdown y texto.
 */

/**
 * Convierte el modelo de datos a una tabla Markdown limpia.
 */
export function modelToMarkdown(model, title = 'Modelo de Programación Entera') {
  const n = model.numVars;
  const varHeaders = Array.from({ length: n }, (_, j) => `x${j + 1}`);
  const headers = ['Tipo', ...varHeaders, 'Op', 'b'];
  const separator = headers.map(() => '---');

  const rows = [];
  // Fila de Función Objetivo
  rows.push(['FO', ...model.c.map((v) => v || '0'), '', '']);

  // Filas de Restricciones
  model.constraints.forEach((ct, i) => {
    const aVals = Array.from({ length: n }, (_, j) => ct.a[j] || '0');
    rows.push([`R${i + 1}`, ...aVals, ct.op || '<=', ct.b || '0']);
  });

  const formatRow = (r) => `| ${r.join(' | ')} |`;

  const senseLabel = model.sense === 'min' ? 'Minimizar' : 'Maximizar';
  // Si hay variables continuas (modelo mixto), se declara cuáles son enteras.
  const integer = Array.isArray(model.integer) ? model.integer : [];
  const mixto = Array.from({ length: n }, (_, j) => integer[j] !== false).some((v) => !v);
  const enteras = varHeaders.filter((_, j) => integer[j] !== false);
  const lineaEnteras = mixto ? [`Enteras: ${enteras.length ? enteras.join(', ') : 'ninguna'}`] : [];
  return [
    `# ${title}`,
    `Sentido: ${senseLabel}`,
    ...lineaEnteras,
    '',
    formatRow(headers),
    formatRow(separator),
    ...rows.map(formatRow),
  ].join('\n');
}

/** Máximo de variables que admite la herramienta. */
export const MAX_VARS_PARSER = 4;

/** Celdas de una fila de tabla Markdown, conservando las vacías (así no se corren las columnas). */
const celdasDe = (linea) => linea.split('|').slice(1, -1).map((c) => c.trim());

/** Detecta el sentido: primero la línea «Sentido: …»; si no, la primera línea de texto (no título ni tabla) que lo nombre. */
function detectarSentido(lines) {
  const palabra = (txt) => {
    const low = txt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/\b(minimizar|minimiza|minimo|min)\b/.test(low)) return 'min';
    if (/\b(maximizar|maximiza|maximo|max)\b/.test(low)) return 'max';
    return null;
  };
  for (const l of lines) {
    const m = /^sentido\s*:\s*(.*)$/i.exec(l);
    if (m) {
      const r = palabra(m[1]);
      if (r) return r;
    }
  }
  for (const l of lines) {
    if (l.startsWith('#') || l.startsWith('|') || /^enteras?\s*:/i.test(l)) continue;
    const r = palabra(l);
    if (r) return r;
  }
  return 'max';
}

function leerOperador(raw) {
  const r = raw.trim();
  if (r.includes('<=') || r.includes('≤') || r.includes('=<') || r === '<') return '<=';
  if (r.includes('>=') || r.includes('≥') || r.includes('=>') || r === '>') return '>=';
  if (r.includes('=')) return '=';
  return '<=';
}

/**
 * Parsea un texto o tabla Markdown hacia el modelo de programación entera.
 * Devuelve null si no hay una tabla utilizable, si hay más de ${MAX_VARS_PARSER} variables o si no hay restricciones.
 */
export function parseModelFromMarkdown(text) {
  if (!text || typeof text !== 'string') return null;

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const sense = detectarSentido(lines);

  // Línea opcional «Enteras: x1, x3» (el resto son continuas). Sin ella, todas son enteras.
  let enterasDeclaradas = null;
  for (const l of lines) {
    const m = /^enteras?\s*:\s*(.*)$/i.exec(l);
    if (m) {
      enterasDeclaradas = new Set((m[1].toLowerCase().match(/x\d+/g) || []));
      break;
    }
  }

  // Filtrar filas de tabla Markdown (las que empiezan y terminan con |)
  const tableLines = lines.filter((l) => l.startsWith('|') && l.endsWith('|') && l.length > 1);
  if (tableLines.length < 2) return null;

  // Encabezado: la primera fila con celdas x1..xn, Op o b. Sin encabezado, todas las filas son datos.
  const esEncabezado = (cells) => cells.some((h) => /^(x\d+|op|signo|b|rhs)$/i.test(h));
  const hayEncabezado = esEncabezado(celdasDe(tableLines[0]));
  const headerCells = hayEncabezado ? celdasDe(tableLines[0]) : [];

  const varIndices = [];
  let opIndex = -1;
  let bIndex = -1;
  headerCells.forEach((h, idx) => {
    const low = h.toLowerCase();
    if (/^x\d+$/.test(low)) varIndices.push({ name: low, col: idx });
    else if (low === 'op' || low === 'signo') opIndex = idx;
    else if (low === 'b' || low === 'rhs') bIndex = idx;
  });

  const filasDatos = tableLines.slice(hayEncabezado ? 1 : 0).filter((l) => !/^\|[\s\-:|]+\|$/.test(l));

  // Sin nombres x1..xn: formato [Tipo, c1, ..., cn, Op, b]
  if (varIndices.length === 0) {
    const anchoMax = Math.max(0, ...filasDatos.map((l) => celdasDe(l).length));
    const nVars = Math.max(1, (hayEncabezado ? headerCells.length : anchoMax) - 3);
    for (let j = 0; j < nVars; j++) varIndices.push({ name: `x${j + 1}`, col: j + 1 });
    const ancho = hayEncabezado ? headerCells.length : anchoMax;
    opIndex = ancho - 2;
    bIndex = ancho - 1;
  }

  if (varIndices.length > MAX_VARS_PARSER) return null;
  const numVars = Math.max(2, varIndices.length);
  const celda = (cells, j) => {
    const v = varIndices[j] ? cells[varIndices[j].col] : undefined;
    return v ? v : '0';
  };

  let c = Array(numVars).fill('0');
  const constraints = [];

  for (const rowLine of filasDatos) {
    const cells = celdasDe(rowLine);
    if (cells.length < 2) continue;

    const type = cells[0].toLowerCase();
    if (type.includes('fo') || type.includes('z') || type.includes('obj')) {
      c = Array.from({ length: numVars }, (_, j) => celda(cells, j));
    } else {
      const a = Array.from({ length: numVars }, (_, j) => celda(cells, j));
      const op = opIndex >= 0 && cells[opIndex] ? leerOperador(cells[opIndex]) : '<=';
      const b = bIndex >= 0 && cells[bIndex] ? cells[bIndex] : '0';
      constraints.push({ a, op, b });
    }
  }

  if (constraints.length === 0) return null;

  return {
    sense,
    numVars,
    c,
    constraints,
    integer: Array.from({ length: numVars }, (_, j) =>
      enterasDeclaradas ? enterasDeclaradas.has(`x${j + 1}`) : true
    ),
  };
}
