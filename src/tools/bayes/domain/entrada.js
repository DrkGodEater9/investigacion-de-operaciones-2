/**
 * Entrada del problema como texto: tablas en Markdown y borrador editable de la pantalla.
 *
 * Formato Markdown (la línea «Objetivo» es opcional; por defecto se maximiza):
 *
 *   Objetivo: maximizar
 *   | Alternativa | Petróleo | Seco |
 *   |---|---|---|
 *   | Perforar | 500 | -100 |
 *   | Vender | 60 | 60 |
 *   | Prob. a priori | 0,3 | 0,7 |
 *
 *   | Estado | Favorable | Desfavorable |
 *   |---|---|---|
 *   | Petróleo | 0,8 | 0,2 |
 *   | Seco | 0,3 | 0,7 |
 *
 * La primera tabla trae los pagos y, en su última fila, las probabilidades a priori (la fila empieza por «Prob»).
 * La segunda tabla (opcional) trae la verosimilitud P(indicador | estado): una fila por estado, en el mismo orden.
 */
import { validarProblema } from './bayes.js';

/** Fila de probabilidades a priori: «Prob.», «Prob», «Probabilidad(es)…»; no «Probar sensor». */
const ESTILO_PRIORI = /^prob(\.|abilidad(es)?\b|\b)/i;
const MILES = /^[+-]?[1-9]\d{0,2}([.,]\d{3})+$/;
const NUMERO = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/** → { valor } o { error }. Con esProb acepta «25 %» y «1/4». */
export function leerNumero(texto, esProb = false) {
  const original = String(texto ?? '').trim();
  const t = original.replace(/[−–—]/g, '-').replace(/\s+/g, '');
  if (t === '') return { error: 'está vacío' };
  if (esProb) {
    const pct = /^([+-]?[\d.,]+)%$/.exec(t);
    if (pct) {
      const u = pct[1].replace(',', '.');
      if (!NUMERO.test(u)) return { error: `«${original}» no es un número` };
      return { valor: Number(u) / 100 };
    }
    const fr = /^(\d+)\/(\d+)$/.exec(t);
    if (fr) {
      if (Number(fr[2]) === 0) return { error: `«${original}» divide entre cero` };
      return { valor: Number(fr[1]) / Number(fr[2]) };
    }
  } else if (MILES.test(t)) {
    return { error: `«${original}» parece un separador de miles; escribe ${t.replace(/[.,]/g, '')} sin puntos` };
  }
  const u = t.replace(',', '.');
  if (!NUMERO.test(u)) return { error: `«${original}» no es un número` };
  return { valor: Number(u) };
}

function celdas(linea) {
  let t = linea.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}
const esSeparador = (cs) => cs.length > 0 && cs.every((c) => /^:?-{1,}:?$/.test(c));

/** → { problema, errores: string[], avisos: string[] } */
export function parseMarkdown(texto) {
  const errores = [];
  const avisos = [];
  const lineas = String(texto ?? '').split(/\r?\n/);
  let objetivo = 'max';
  const bloques = [];
  let actual = null;
  for (const l of lineas) {
    const t = l.trim();
    if (t.startsWith('|')) {
      if (!actual) { actual = []; bloques.push(actual); }
      actual.push(t);
    } else {
      actual = null;
      const m = /^objetivo\s*:\s*(.+)$/i.exec(t);
      if (m) {
        const v = m[1].trim().toLowerCase();
        if (/^(max|máx|maximizar|maximiza|utilidad|utilidades|ganancia|ganancias|beneficio)/.test(v)) objetivo = 'max';
        else if (/^(min|mín|minimizar|minimiza|costo|costos|coste|pérdida|perdida)/.test(v)) objetivo = 'min';
        else errores.push(`Objetivo: «${m[1].trim()}» no se entiende; escribe «maximizar» (utilidades) o «minimizar» (costos).`);
      }
    }
  }
  if (bloques.length === 0) return { problema: null, errores: [...errores, 'Escribe la tabla de pagos (una fila por alternativa y una columna por estado).'], avisos };
  if (bloques.length > 2) errores.push('Solo se leen dos tablas: la de pagos y, después, la de verosimilitud. Sobran tablas.');

  /* Tabla 1: pagos y probabilidades a priori */
  const t1 = bloques[0].map(celdas).filter((cs, i) => !(i === 1 && esSeparador(cs)));
  const enc = t1[0];
  if (enc.length < 3) {
    return { problema: null, errores: [...errores, 'El encabezado de la tabla de pagos debe ser | Alternativa | Estado 1 | Estado 2 | … | (al menos dos estados).'], avisos };
  }
  const estados = enc.slice(1);
  const n = estados.length;
  const alternativas = [];
  const pagos = [];
  let priori = null;
  t1.slice(1).forEach((cs, idx) => {
    const esPriori = ESTILO_PRIORI.test(cs[0] || '');
    const etiqueta = cs[0] || `fila ${idx + 1}`;
    if (cs.length !== n + 1) {
      errores.push(`Tabla de pagos, fila «${etiqueta}»: se esperaban ${n + 1} columnas y llegaron ${cs.length}.`);
      return;
    }
    const vals = [];
    let ok = true;
    for (let j = 0; j < n; j++) {
      const r = leerNumero(cs[1 + j], esPriori);
      if (r.error) {
        errores.push(`Tabla de pagos, fila «${etiqueta}», columna «${estados[j]}»: ${r.error}.`);
        ok = false;
      } else vals.push(r.valor);
    }
    if (!ok) return;
    if (esPriori) {
      if (priori) errores.push('Hay dos filas de probabilidades a priori; deja solo una.');
      priori = vals;
    } else {
      alternativas.push(cs[0]);
      pagos.push(vals);
    }
  });
  if (!priori && errores.length === 0) {
    errores.push('Falta la fila de probabilidades a priori: la última fila de la tabla de pagos debe empezar por «Prob.» (por ejemplo «Prob. a priori»).');
  }

  /* Tabla 2: verosimilitud (opcional) */
  let indicadores;
  let verosimilitud;
  if (bloques.length >= 2) {
    const t2 = bloques[1].map(celdas).filter((cs, i) => !(i === 1 && esSeparador(cs)));
    const enc2 = t2[0];
    if (enc2.length < 3) {
      errores.push('El encabezado de la tabla de verosimilitud debe ser | Estado | Indicador 1 | Indicador 2 | … | (al menos dos resultados).');
    } else {
      indicadores = enc2.slice(1);
      const K = indicadores.length;
      const filas = t2.slice(1);
      if (filas.length !== n) {
        errores.push(`La tabla de verosimilitud necesita una fila por estado (${n}) y tiene ${filas.length}.`);
      } else {
        verosimilitud = [];
        filas.forEach((cs, j) => {
          const etiqueta = cs[0] || `fila ${j + 1}`;
          if (cs.length !== K + 1) { errores.push(`Tabla de verosimilitud, fila «${etiqueta}»: se esperaban ${K + 1} columnas y llegaron ${cs.length}.`); return; }
          if (cs[0] && estados[j] && cs[0].trim() !== estados[j].trim()) {
            avisos.push(`Verosimilitud: la fila ${j + 1} se llama «${cs[0]}» pero el estado ${j + 1} es «${estados[j]}»; se usa el orden de las filas.`);
          }
          const vals = [];
          let ok = true;
          for (let k = 0; k < K; k++) {
            const r = leerNumero(cs[1 + k], true);
            if (r.error) { errores.push(`Tabla de verosimilitud, fila «${etiqueta}», columna «${indicadores[k]}»: ${r.error}.`); ok = false; } else vals.push(r.valor);
          }
          if (ok) verosimilitud.push(vals);
        });
      }
    }
  }
  if (errores.length) return { problema: null, errores, avisos };

  const crudo = { objetivo, alternativas, estados, pagos, priori };
  if (indicadores) { crudo.indicadores = indicadores; crudo.verosimilitud = verosimilitud; }
  const v = validarProblema(crudo);
  return { problema: v.problema, errores: v.errores, avisos: [...avisos, ...v.avisos] };
}

/* ---------------------------------------------------------------- Borrador editable */

const aTexto = (x) => String(x).replace('.', ',');
const limpiar = (s) => String(s ?? '').replace(/[|\r\n]+/g, ' ').trim();

/** Borrador: todo en texto, para poder escribir «0,», «-» o «.5» sin que se pierda. */
export function borradorDeProblema(p) {
  const conInfo = Array.isArray(p.indicadores);
  return {
    objetivo: p.objetivo,
    alts: p.alternativas.slice(),
    estados: p.estados.slice(),
    pagos: p.pagos.map((f) => f.map(aTexto)),
    priori: p.priori.map(aTexto),
    conInfo,
    inds: conInfo ? p.indicadores.slice() : ['Positivo', 'Negativo'],
    lik: conInfo ? p.verosimilitud.map((f) => f.map(aTexto)) : p.estados.map(() => ['', '']),
  };
}

const fila = (cs) => '| ' + cs.join(' | ') + ' |';
const sep = (n) => '|' + Array(n).fill('---').join('|') + '|';

/** El borrador pasa por parseMarkdown: así la validación es una sola. */
export function borradorAMarkdown(d) {
  const out = [`Objetivo: ${d.objetivo === 'max' ? 'maximizar' : 'minimizar'}`];
  out.push(fila(['Alternativa', ...d.estados.map(limpiar)]), sep(d.estados.length + 1));
  d.alts.forEach((a, i) => out.push(fila([limpiar(a), ...d.pagos[i].map(limpiar)])));
  out.push(fila(['Prob. a priori', ...d.priori.map(limpiar)]));
  if (d.conInfo) {
    out.push('', fila(['Estado', ...d.inds.map(limpiar)]), sep(d.inds.length + 1));
    d.estados.forEach((e, j) => out.push(fila([limpiar(e), ...d.lik[j].map(limpiar)])));
  }
  return out.join('\n');
}

/** Markdown de un problema ya validado (coma decimal). */
export function problemaAMarkdown(p) {
  return borradorAMarkdown(borradorDeProblema(p));
}
