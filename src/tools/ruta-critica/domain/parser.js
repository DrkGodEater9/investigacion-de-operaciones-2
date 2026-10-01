// Convierte texto (Markdown, CSV, TSV, texto libre) u hojas de Excel en filas de actividades.

const NONE = new Set(['', '-', '--', '---', '—', '–', 'ninguna', 'ninguno', 'n/a', 'na', 'inicio', 'none', 'ning.']);

export function splitPreds(value) {
  if (value == null) return [];
  const str = String(value).trim();
  if (NONE.has(str.toLowerCase())) return [];
  return str
    .split(/[,;\s]+/)
    .map((t) => t.trim())
    .filter((t) => t && !NONE.has(t.toLowerCase()));
}

export function toNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value).trim().replace(',', '.');
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return null;
  return parseFloat(s);
}

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const RE = {
  name: /^(actividad(es)?|activity|tarea|act\.?|id|codigo)$/,
  nameLoose: /actividad|activity|tarea/,
  preds: /predece|dependen|prelaci|anterior|requisit|precede|predec|depende/,
  dur: /^(duracion|tiempo|dur\.?|d|t|te|t\s*\(.*\)|t\(.*\)|duracion.*|tiempo.*)$/,
  a: /^(a|to|optimista|t\.?\s*optimista|tiempo optimista|a\s*\(.*\)|a_?ij)$|optimis/,
  m: /^(m|tm|probable|mas probable|t\.?\s*probable|m\s*\(.*\)|m_?ij)$|probable/,
  b: /^(b|tp|pesimista|t\.?\s*pesimista|b\s*\(.*\)|b_?ij)$|pesimis/,
};

/** rows: matriz de celdas (string|number). Devuelve { activities, mode, notes } */
export function parseTable(rows) {
  const clean = rows.map((r) => (r || []).map((c) => (c == null ? '' : c)));
  let headerIdx = clean.findIndex((r) => r.some((c) => RE.name.test(norm(c))));
  if (headerIdx < 0) headerIdx = clean.findIndex((r) => r.some((c) => RE.nameLoose.test(norm(c)) && norm(c).length < 20));

  let nameCol = -1;
  let predCol = -1;
  const explicit = {};
  let dataRows;

  if (headerIdx >= 0) {
    const header = clean[headerIdx].map(norm);
    header.forEach((h, i) => {
      if (!h) return;
      if (nameCol < 0 && (RE.name.test(h) || RE.nameLoose.test(h))) nameCol = i;
      else if (predCol < 0 && RE.preds.test(h)) predCol = i;
      else if (explicit.a == null && RE.a.test(h)) explicit.a = i;
      else if (explicit.m == null && RE.m.test(h)) explicit.m = i;
      else if (explicit.b == null && RE.b.test(h)) explicit.b = i;
      else if (explicit.d == null && RE.dur.test(h)) explicit.d = i;
    });
    if (predCol < 0) predCol = nameCol + 1;
    dataRows = clean.slice(headerIdx + 1);
  } else {
    // Sin encabezado: primera columna con contenido es la actividad, la siguiente las predecesoras.
    const first = clean.find((r) => r.some((c) => String(c).trim() !== ''));
    nameCol = first ? first.findIndex((c) => String(c).trim() !== '') : 0;
    predCol = nameCol + 1;
    dataRows = clean;
  }

  const candidates = dataRows.filter((r) => {
    const name = String(r[nameCol] ?? '').trim();
    if (!name || name.length > 40) return false;
    const hasPred = String(r[predCol] ?? '').trim() !== '';
    const hasNum = r.some((c, i) => i !== nameCol && i !== predCol && toNumber(c) != null);
    return hasPred || hasNum;
  });

  const width = Math.max(0, ...candidates.map((r) => r.length));
  const numericCols = [];
  for (let c = 0; c < width; c++) {
    if (c === nameCol || c === predCol) continue;
    const count = candidates.filter((r) => toNumber(r[c]) != null).length;
    if (candidates.length && count / candidates.length >= 0.6) numericCols.push(c);
  }
  const isNumeric = (c) => c != null && numericCols.includes(c);

  let mode;
  let cols = {};
  if (isNumeric(explicit.a) && isNumeric(explicit.m) && isNumeric(explicit.b)) {
    mode = 'pert';
    cols = { a: explicit.a, m: explicit.m, b: explicit.b };
  } else if (isNumeric(explicit.d)) {
    mode = 'cpm';
    cols = { d: explicit.d };
  } else if (numericCols.length === 3) {
    mode = 'pert';
    cols = { a: numericCols[0], m: numericCols[1], b: numericCols[2] };
  } else if (numericCols.length >= 1) {
    mode = 'cpm';
    cols = { d: numericCols[0] };
  } else {
    mode = 'network';
  }

  const cell = (r, c) => (c == null ? '' : String(toNumber(r[c]) ?? ''));
  const activities = candidates.map((r) => ({
    name: String(r[nameCol]).trim(),
    preds: splitPreds(r[predCol]).join(','),
    d: cell(r, cols.d),
    a: cell(r, cols.a),
    m: cell(r, cols.m),
    b: cell(r, cols.b),
  }));
  return { activities, mode };
}

function splitCSVLine(line, delim) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** Texto libre → { title, activities, mode } */
export function parseText(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  let title = '';
  const body = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#{1,6}\s+/.test(line)) { if (!title) title = line.replace(/^#+\s+/, ''); continue; }
    body.push(raw);
  }

  let rows;
  const pipeLines = body.filter((l) => l.includes('|'));
  if (pipeLines.length >= 2) {
    rows = pipeLines
      .filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l))
      .map((l) => {
        const cells = l.trim().split('|').map((c) => c.trim());
        if (cells[0] === '') cells.shift();
        if (cells[cells.length - 1] === '') cells.pop();
        return cells;
      });
  } else if (body.some((l) => l.includes('\t'))) {
    rows = body.map((l) => l.split('\t').map((c) => c.trim()));
  } else if (body.some((l) => l.includes(';'))) {
    rows = body.map((l) => splitCSVLine(l, ';'));
  } else {
    const quoted = body.some((l) => l.includes('"'));
    if (quoted) rows = body.map((l) => splitCSVLine(l, ','));
    else {
      // Texto libre: "D  A,B  6"  o  "A - 2"
      rows = body.map((l) => l.trim().split(/\s+/));
    }
  }
  const parsed = parseTable(rows);
  return { title, ...parsed };
}
