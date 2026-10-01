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
  return [
    `# ${title}`,
    `Sentido: ${senseLabel}`,
    '',
    formatRow(headers),
    formatRow(separator),
    ...rows.map(formatRow),
  ].join('\n');
}

/**
 * Parsea un texto o tabla Markdown hacia el modelo de programación entera.
 */
export function parseModelFromMarkdown(text) {
  if (!text || typeof text !== 'string') return null;

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  let sense = 'max';
  for (const l of lines) {
    const low = l.toLowerCase();
    if (low.includes('min') || low.includes('minimizar')) {
      sense = 'min';
      break;
    }
    if (low.includes('max') || low.includes('maximizar')) {
      sense = 'max';
      break;
    }
  }

  // Filtrar filas de tabla Markdown (las que empiezan y terminan con |)
  const tableLines = lines.filter((l) => l.startsWith('|') && l.endsWith('|'));
  if (tableLines.length >= 2) {
    // Primera fila con encabezados
    const headerCells = tableLines[0]
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);

    // Detectar columnas de variables x1, x2...
    const varIndices = [];
    let opIndex = -1;
    let bIndex = -1;

    headerCells.forEach((h, idx) => {
      const low = h.toLowerCase();
      if (/^x\d+$/i.test(low)) {
        varIndices.push({ name: low, col: idx });
      } else if (low === 'op' || low === 'signo') {
        opIndex = idx;
      } else if (low === 'b' || low === 'rhs') {
        bIndex = idx;
      }
    });

    // Si no se nombraron explícitamente como x1..xn, asumir columnas del medio
    if (varIndices.length === 0) {
      // Formato: [Tipo, c1, c2, ..., Op, b]
      const nVars = Math.max(2, headerCells.length - 3);
      for (let j = 0; j < nVars; j++) {
        varIndices.push({ name: `x${j + 1}`, col: j + 1 });
      }
      opIndex = headerCells.length - 2;
      bIndex = headerCells.length - 1;
    }

    const numVars = Math.min(4, Math.max(2, varIndices.length));
    let c = Array(numVars).fill('0');
    const constraints = [];

    // Recorrer filas de datos (saltando separador |---|)
    for (let r = 1; r < tableLines.length; r++) {
      const rowLine = tableLines[r];
      if (/^\|[\s\-:|]+\|$/.test(rowLine)) continue; // línea de guiones

      const cells = rowLine
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);

      if (cells.length < 2) continue;

      const type = cells[0].toLowerCase();
      if (type.includes('fo') || type.includes('z') || type.includes('obj')) {
        // Función objetivo
        for (let j = 0; j < numVars; j++) {
          const colIdx = varIndices[j].col;
          c[j] = cells[colIdx] || '0';
        }
      } else {
        // Restricción
        const a = [];
        for (let j = 0; j < numVars; j++) {
          const colIdx = varIndices[j].col;
          a.push(cells[colIdx] || '0');
        }
        let op = '<=';
        if (opIndex >= 0 && cells[opIndex]) {
          const rawOp = cells[opIndex].trim();
          if (rawOp.includes('<=') || rawOp.includes('≤') || rawOp === '<') op = '<=';
          else if (rawOp.includes('>=') || rawOp.includes('≥') || rawOp === '>') op = '>=';
          else if (rawOp.includes('=')) op = '=';
        }
        const b = (bIndex >= 0 && cells[bIndex]) ? cells[bIndex] : '0';
        constraints.push({ a, op, b });
      }
    }

    return {
      sense,
      numVars,
      c,
      constraints: constraints.length > 0 ? constraints : [
        { a: Array(numVars).fill('1'), op: '<=', b: '10' }
      ],
      integer: Array(numVars).fill(true),
    };
  }

  return null;
}
