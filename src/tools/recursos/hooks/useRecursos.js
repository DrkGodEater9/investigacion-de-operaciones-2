import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseMarkdown, modeloAMarkdown, MAX_ACT, MAX_REC } from '../domain/modelo.js';
import { compilar, cpm } from '../domain/cpm.js';
import { resumen } from '../domain/perfil.js';
import { nivelar } from '../domain/nivelar.js';
import { asignar } from '../domain/asignar.js';
import { EJEMPLOS } from '../domain/ejemplos.js';

const ESPERA = 250;
const limpiar = (s) => String(s ?? '').replace(/[|\r\n]+/g, ' ').trim();

/** Borrador editable: todo en texto para poder escribir cifras a medias sin que se pierdan. */
export function borradorDeModelo(modelo) {
  return {
    recursos: modelo.recursos.map((r) => ({ name: r.name, limite: r.limite == null ? '' : String(r.limite) })),
    rows: modelo.acts.map((a) => ({ name: a.name, d: String(a.d), preds: a.preds.join(', '), r: a.r.map(String) })),
  };
}

const fila = (cs) => '| ' + cs.join(' | ') + ' |';

/** El borrador pasa por parseMarkdown: la validación es una sola, la del dominio. */
export function borradorAMarkdown(d) {
  const enc = ['Actividad', 'Duración', 'Predecesoras', ...d.recursos.map((r) => limpiar(r.name) || '(sin nombre)')];
  return [
    fila(enc),
    '|' + enc.map(() => '---').join('|') + '|',
    ...d.rows.map((r) => fila([limpiar(r.name), limpiar(r.d), limpiar(r.preds) || '-', ...r.r.map(limpiar)])),
    fila(['Límite', '', '', ...d.recursos.map((r) => limpiar(r.limite))]),
  ].join('\n');
}

const reemplazar = (arr, i, v) => arr.map((x, k) => (k === i ? v : x));
const siguienteNombre = (rows) => {
  const usados = new Set(rows.map((r) => r.name));
  for (let c = 65; c < 91; c++) if (!usados.has(String.fromCharCode(c))) return String.fromCharCode(c);
  let k = 1;
  while (usados.has('X' + k)) k += 1;
  return 'X' + k;
};

export function useRecursos() {
  const [modo, setModo] = useState('tabla');
  const [draft, setDraft] = useState(() => borradorDeModelo(EJEMPLOS[1].modelo));
  const [md, setMd] = useState('');
  const [ejemploId, setEjemploId] = useState(EJEMPLOS[1].id);
  const [metodo, setMetodo] = useState('asignar'); // 'nivelar' | 'asignar'
  const [regla, setRegla] = useState('holgura');
  const [erroresModo, setErroresModo] = useState([]);

  const src = modo === 'tabla' ? borradorAMarkdown(draft) : md;
  const [srcEsperado, setSrcEsperado] = useState(src);
  useEffect(() => {
    const t = setTimeout(() => setSrcEsperado(src), ESPERA);
    return () => clearTimeout(t);
  }, [src]);

  const parsed = useMemo(() => parseMarkdown(srcEsperado), [srcEsperado]);
  const modelo = parsed.modelo;

  const analisis = useMemo(() => {
    if (!modelo) return null;
    const red = compilar(modelo);
    const base = cpm(red);
    const antes = resumen(red, base.ES);
    let despues = null;
    let error = null;
    let detalle = null;
    if (metodo === 'nivelar') {
      const r = nivelar(red);
      despues = { starts: r.starts, T: r.T, resumen: resumen(red, r.starts, Math.max(base.T, r.T)), detalle: r };
    } else {
      const r = asignar(red, { regla });
      if (!r.ok) error = r.mensaje;
      else {
        detalle = r;
        despues = { starts: r.starts, T: r.T, resumen: resumen(red, r.starts), detalle: r };
      }
    }
    const horizonte = Math.max(base.T, despues ? despues.T : 0);
    return { red, base, antes, despues, error, horizonte, metodo, regla, detalle };
  }, [modelo, metodo, regla]);

  /* ---- Edición de la tabla ---- */
  const upd = useCallback((f) => { setErroresModo([]); setDraft((d) => f(d)); }, []);
  const acciones = {
    setActNombre: (i, v) => upd((d) => ({ ...d, rows: d.rows.map((r, k) => (k === i ? { ...r, name: v } : r)) })),
    setDur: (i, v) => upd((d) => ({ ...d, rows: d.rows.map((r, k) => (k === i ? { ...r, d: v } : r)) })),
    setPreds: (i, v) => upd((d) => ({ ...d, rows: d.rows.map((r, k) => (k === i ? { ...r, preds: v } : r)) })),
    setReq: (i, k, v) => upd((d) => ({ ...d, rows: d.rows.map((r, j) => (j === i ? { ...r, r: reemplazar(r.r, k, v) } : r)) })),
    setRecNombre: (k, v) => upd((d) => ({ ...d, recursos: d.recursos.map((r, j) => (j === k ? { ...r, name: v } : r)) })),
    setLimite: (k, v) => upd((d) => ({ ...d, recursos: d.recursos.map((r, j) => (j === k ? { ...r, limite: v } : r)) })),
    agregarActividad: () => upd((d) => (d.rows.length >= MAX_ACT ? d : {
      ...d, rows: [...d.rows, { name: siguienteNombre(d.rows), d: '1', preds: '', r: d.recursos.map(() => '0') }],
    })),
    quitarActividad: (i) => upd((d) => ({ ...d, rows: d.rows.filter((_, k) => k !== i) })),
    agregarRecurso: () => upd((d) => (d.recursos.length >= MAX_REC ? d : {
      recursos: [...d.recursos, { name: 'Recurso ' + (d.recursos.length + 1), limite: '' }],
      rows: d.rows.map((r) => ({ ...r, r: [...r.r, '0'] })),
    })),
    quitarRecurso: () => upd((d) => (d.recursos.length <= 1 ? d : {
      recursos: d.recursos.slice(0, -1), rows: d.rows.map((r) => ({ ...r, r: r.r.slice(0, -1) })),
    })),
  };

  const cambiarModo = useCallback((nuevo) => {
    if (nuevo === modo) return;
    if (nuevo === 'markdown') {
      setMd(borradorAMarkdown(draft));
      setErroresModo([]);
      setModo('markdown');
      return;
    }
    const r = parseMarkdown(md);
    if (r.errores.length) { setErroresModo(r.errores); return; }
    setDraft(borradorDeModelo(r.modelo));
    setErroresModo([]);
    setModo('tabla');
  }, [modo, draft, md]);

  const cargarEjemplo = useCallback((id) => {
    const e = EJEMPLOS.find((x) => x.id === id);
    if (!e) return;
    setEjemploId(id);
    setErroresModo([]);
    setDraft(borradorDeModelo(e.modelo));
    setMd(modeloAMarkdown(e.modelo));
  }, []);

  const errores = erroresModo.length ? erroresModo : parsed.errores;

  return {
    modo, cambiarModo, draft, acciones, md, src,
    setMd: (v) => { setErroresModo([]); setMd(v); },
    ejemploId, cargarEjemplo, metodo, setMetodo, regla, setRegla,
    errores, avisos: parsed.avisos, modelo, analisis,
    pendiente: src !== srcEsperado,
  };
}
