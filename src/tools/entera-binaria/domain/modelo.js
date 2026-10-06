/** Modelo de PEB: validación, lectura y escritura en tabla Markdown. */

export const EPS = 1e-9;
export const MAX_VARS = 30;

export const defaultNames = (n) => Array.from({ length: n }, (_, j) => 'x' + (j + 1));

const OPS = ['<=', '>=', '='];
const err = (fila, campo, mensaje) => ({ fila, campo, mensaje });
const esNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Devuelve la lista de errores del modelo (vacía si es válido). */
export function validateModel(model) {
  const e = [];
  if (!model || typeof model !== 'object') return [err(null, null, 'No hay modelo.')];
  if (model.sense !== 'max' && model.sense !== 'min') e.push(err(1, null, 'El objetivo debe ser maximizar o minimizar.'));
  const names = Array.isArray(model.names) ? model.names : [];
  const n = names.length;
  if (n < 1) e.push(err(null, null, 'El modelo necesita al menos una variable.'));
  if (n > MAX_VARS) e.push(err(null, null, `El modelo puede tener como máximo ${MAX_VARS} variables (tiene ${n}).`));
  const vistos = new Set();
  names.forEach((nm, j) => {
    const t = String(nm ?? '');
    if (t.trim() === '') e.push(err(null, null, `La variable ${j + 1} no tiene nombre.`));
    else if (/\s/.test(t)) e.push(err(null, t, `El nombre de variable «${t}» no puede tener espacios.`));
    else if (vistos.has(t)) e.push(err(null, t, `El nombre de variable «${t}» está repetido.`));
    vistos.add(t);
  });
  if (!Array.isArray(model.c) || model.c.length !== n) {
    e.push(err(1, null, `La función objetivo debe tener ${n} coeficientes.`));
  } else {
    model.c.forEach((v, j) => {
      if (!esNum(v)) e.push(err(1, names[j], `El coeficiente de ${names[j]} en el objetivo no es un número válido.`));
    });
  }
  const cons = Array.isArray(model.constraints) ? model.constraints : [];
  cons.forEach((r, i) => {
    const fila = i + 2;
    if (!Array.isArray(r.a) || r.a.length !== n) {
      e.push(err(fila, null, `Fila ${fila}: la restricción debe tener ${n} coeficientes.`));
    } else {
      r.a.forEach((v, j) => {
        if (!esNum(v)) e.push(err(fila, names[j], `Fila ${fila}: el coeficiente de ${names[j]} no es un número válido.`));
      });
    }
    if (!OPS.includes(r.op)) e.push(err(fila, 'signo', `Fila ${fila}: el signo debe ser ≤, ≥ o =.`));
    if (!esNum(r.b)) e.push(err(fila, 'b', `Fila ${fila}: el valor de b no es un número válido.`));
  });
  return e;
}

/* ---------- Lectura de la tabla Markdown ---------- */

const SIGNOS = { '<=': '<=', '≤': '<=', '>=': '>=', '≥': '>=', '=': '=', '==': '=' };
const MILES = /^[+-]?[1-9]\d{0,2}([.,]\d{3})+$/;
const NUMERO = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/** → { valor } o { error } */
function leerNumero(texto) {
  const t = texto.trim().replace(/−/g, '-');
  if (MILES.test(t)) {
    return { error: `«${texto.trim()}» parece un separador de miles; escribe ${t.replace(/[.,]/g, '')} sin puntos` };
  }
  if (/^[+-]?\d{1,3}(\.\d{3})+,\d+$/.test(t)) {
    return { error: `«${texto.trim()}» mezcla punto de miles y coma decimal; escribe ${t.replace(/\./g, '')} (sin puntos de miles)` };
  }
  const u = t.replace(',', '.');
  if (!NUMERO.test(u)) return { error: `«${texto.trim()}» no es un número` };
  return { valor: Number(u) };
}

function celdas(linea) {
  let t = linea.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

const esSeparador = (cs) => cs.length > 0 && cs.every((c) => /^:?-{1,}:?$/.test(c));

export function parseMarkdown(texto) {
  const errors = [];
  const warnings = [];
  const lineas = String(texto ?? '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lineas.length === 0) return { model: null, errors: [err(null, null, 'Escribe la tabla del modelo.')], warnings };

  const enc = celdas(lineas[0]);
  if (enc.length < 4) {
    return {
      model: null,
      errors: [err(null, null, 'El encabezado debe tener la forma | Restricción | x1 | … | Signo | b | (al menos una variable).')],
      warnings,
    };
  }
  const names = enc.slice(1, -2);
  const n = names.length;
  const esperadas = enc.length;

  let filaN = 0;
  let sense = null;
  let c = null;
  const constraints = [];
  for (let k = 1; k < lineas.length; k++) {
    const cs = celdas(lineas[k]);
    if (k === 1 && esSeparador(cs)) continue;
    filaN += 1;
    const esObj = filaN === 1;
    let fila = cs;
    if (esObj && fila.length < esperadas && fila.length >= n + 1) {
      fila = fila.concat(Array(esperadas - fila.length).fill(''));
    }
    if (esObj) {
      const m = /^(max|min|máx|mín)/i.exec(fila[0] || '');
      if (!m) {
        errors.push(err(1, null, 'Fila 1: la primera fila debe ser el objetivo y su primera celda debe empezar por max o min (por ejemplo «max Z»).'));
      } else sense = /^m[aá]x/i.test(m[1]) ? 'max' : 'min';
    }
    if (fila.length !== esperadas) {
      errors.push(err(filaN, null, `Fila ${filaN}: se esperaban ${esperadas} columnas y llegaron ${fila.length}.`));
      continue;
    }
    const coefs = [];
    let ok = true;
    for (let j = 0; j < n; j++) {
      const celda = fila[1 + j];
      if (celda === '') { coefs.push(0); continue; }
      const r = leerNumero(celda);
      if (r.error) {
        errors.push(err(filaN, names[j], `Fila ${filaN}, variable ${names[j]}: ${r.error}.`));
        ok = false;
        coefs.push(0);
      } else coefs.push(r.valor);
    }
    if (esObj) {
      if (ok) c = coefs;
      continue;
    }
    const nombre = fila[0] !== '' ? fila[0] : 'R' + (filaN - 1);
    const signoTxt = fila[esperadas - 2];
    const op = SIGNOS[signoTxt];
    if (!op) {
      errors.push(err(filaN, 'signo', `Fila ${filaN}: el signo «${signoTxt}» no es válido; usa <=, >= o =.`));
      ok = false;
    }
    let b = 0;
    const bTxt = fila[esperadas - 1];
    if (bTxt === '') {
      errors.push(err(filaN, 'b', `Fila ${filaN}: falta el valor de b.`));
      ok = false;
    } else {
      const r = leerNumero(bTxt);
      if (r.error) {
        errors.push(err(filaN, 'b', `Fila ${filaN}, b: ${r.error}.`));
        ok = false;
      } else b = r.valor;
    }
    if (ok) constraints.push({ name: nombre, a: coefs, op, b });
  }
  if (filaN === 0) errors.push(err(null, null, 'Falta la fila del objetivo (max o min).'));
  if (errors.length === 0) {
    const model = { sense, names, c, constraints };
    const ev = validateModel(model);
    if (ev.length) return { model: null, errors: ev, warnings };
    if (constraints.length === 0) warnings.push('El modelo no tiene restricciones: toda combinación es factible.');
    return { model, errors, warnings };
  }
  return { model: null, errors, warnings };
}

export function modelToMarkdown(model) {
  const fila = (cs) => '| ' + cs.join(' | ') + ' |';
  const num = (x) => String(x);
  const txt = (s) => String(s).replace(/\|/g, '/');
  const out = [
    fila(['Restricción', ...model.names.map(txt), 'Signo', 'b']),
    '|' + Array(model.names.length + 3).fill('---').join('|') + '|',
    fila([model.sense + ' Z', ...model.c.map(num), '', '']),
  ];
  for (const r of model.constraints) out.push(fila([txt(r.name), ...r.a.map(num), r.op, num(r.b)]));
  return out.join('\n');
}
