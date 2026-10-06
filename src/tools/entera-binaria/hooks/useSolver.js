import { useCallback, useEffect, useMemo, useState } from 'react';
import { MAX_VARS, parseMarkdown, modelToMarkdown } from '../domain/modelo.js';
import { enumerate, MAX_ENUM } from '../domain/enumerar.js';
import { balas } from '../domain/balas.js';
import { EJEMPLOS } from '../domain/ejemplos.js';

/** Número de variables a partir del cual la enumeración se calcula en el siguiente tick. */
const ENUM_LENTA = 16;
const ESPERA = 250;

const aTexto = (x) => String(x).replace('.', ',');
const limpiar = (s) => String(s ?? '').replace(/[|\r\n]+/g, ' ').trim();

/** Borrador editable: todo en texto para poder escribir «1,», «-» o «.5» sin que se pierda. */
export function borradorDeModelo(model) {
  return {
    sense: model.sense,
    names: model.names.slice(),
    c: model.c.map(aTexto),
    rows: model.constraints.map((r) => ({ name: r.name, a: r.a.map(aTexto), op: r.op, b: aTexto(r.b) })),
  };
}

const fila = (cs) => '| ' + cs.join(' | ') + ' |';

/** El borrador pasa por parseMarkdown: así la validación es una sola, la del dominio. */
export function borradorAMarkdown(d) {
  const n = d.names.length;
  const out = [
    fila(['Restricción', ...d.names.map(limpiar), 'Signo', 'b']),
    '|' + Array(n + 3).fill('---').join('|') + '|',
    fila([d.sense + ' Z', ...d.c.map(limpiar), '', '']),
  ];
  for (const r of d.rows) out.push(fila([limpiar(r.name), ...r.a.map(limpiar), r.op, limpiar(r.b)]));
  return out.join('\n');
}

const reemplazar = (arr, i, v) => arr.map((x, k) => (k === i ? v : x));

export function useSolver() {
  const [modo, setModo] = useState('tabla');
  const [draft, setDraft] = useState(() => borradorDeModelo(EJEMPLOS[0].model));
  const [md, setMd] = useState('');
  const [metodoPref, setMetodoPref] = useState('enumeracion');
  const [ejemploId, setEjemploId] = useState(EJEMPLOS[0].id);
  const [erroresModo, setErroresModo] = useState([]);

  const src = modo === 'tabla' ? borradorAMarkdown(draft) : md;
  const [srcEsperado, setSrcEsperado] = useState(src);
  useEffect(() => {
    const t = setTimeout(() => setSrcEsperado(src), ESPERA);
    return () => clearTimeout(t);
  }, [src]);

  const parsed = useMemo(() => parseMarkdown(srcEsperado), [srcEsperado]);
  const vivo = useMemo(() => (modo === 'markdown' ? parseMarkdown(md) : null), [modo, md]);
  const names = modo === 'tabla' ? draft.names : (vivo?.model?.names ?? parsed.model?.names ?? []);

  const model = parsed.model;
  const n = model ? model.names.length : names.length;
  const enumDisponible = n <= MAX_ENUM;
  const metodo = enumDisponible ? metodoPref : 'balas';

  const [res, setRes] = useState(null);
  useEffect(() => {
    if (!model) { setRes(null); return undefined; }
    let activo = true;
    const calcular = () => {
      try {
        const data = metodo === 'enumeracion' ? enumerate(model) : balas(model);
        if (activo) setRes({ model, metodo, data, error: null, calculando: false });
      } catch (e) {
        if (activo) setRes({ model, metodo, data: null, error: e.message, calculando: false });
      }
    };
    if (metodo === 'enumeracion' && model.names.length > ENUM_LENTA) {
      setRes({ model, metodo, data: null, error: null, calculando: true });
      const t = setTimeout(calcular, 30);
      return () => { activo = false; clearTimeout(t); };
    }
    calcular();
    return () => { activo = false; };
  }, [model, metodo]);

  /* ---- Edición de la tabla ---- */
  const upd = useCallback((f) => { setErroresModo([]); setDraft((d) => f(d)); }, []);
  const acciones = {
    setSense: (v) => upd((d) => ({ ...d, sense: v })),
    setNombre: (j, v) => upd((d) => ({ ...d, names: reemplazar(d.names, j, v) })),
    setC: (j, v) => upd((d) => ({ ...d, c: reemplazar(d.c, j, v) })),
    setNombreRestr: (i, v) => upd((d) => ({ ...d, rows: d.rows.map((r, k) => (k === i ? { ...r, name: v } : r)) })),
    setA: (i, j, v) => upd((d) => ({ ...d, rows: d.rows.map((r, k) => (k === i ? { ...r, a: reemplazar(r.a, j, v) } : r)) })),
    setOp: (i, v) => upd((d) => ({ ...d, rows: d.rows.map((r, k) => (k === i ? { ...r, op: v } : r)) })),
    setB: (i, v) => upd((d) => ({ ...d, rows: d.rows.map((r, k) => (k === i ? { ...r, b: v } : r)) })),
    agregarVariable: () => upd((d) => {
      if (d.names.length >= MAX_VARS) return d;
      let k = d.names.length + 1;
      while (d.names.includes('x' + k)) k += 1;
      return { ...d, names: [...d.names, 'x' + k], c: [...d.c, ''], rows: d.rows.map((r) => ({ ...r, a: [...r.a, ''] })) };
    }),
    quitarVariable: () => upd((d) => {
      if (d.names.length <= 1) return d;
      return { ...d, names: d.names.slice(0, -1), c: d.c.slice(0, -1), rows: d.rows.map((r) => ({ ...r, a: r.a.slice(0, -1) })) };
    }),
    agregarRestriccion: () => upd((d) => ({
      ...d,
      rows: [...d.rows, { name: 'R' + (d.rows.length + 1), a: d.names.map(() => ''), op: '<=', b: '' }],
    })),
    quitarRestriccion: (i) => upd((d) => ({ ...d, rows: d.rows.filter((_, k) => k !== i) })),
  };

  /** Agrega una restricción ya construida por restriccionLogica (en la tabla o al final del Markdown). */
  const agregarLogica = useCallback((r) => {
    setErroresModo([]);
    if (modo === 'tabla') {
      setDraft((d) => ({ ...d, rows: [...d.rows, { name: r.name, a: r.a.map(aTexto), op: r.op, b: aTexto(r.b) }] }));
    } else {
      setMd((t) => t.replace(/\s+$/, '') + '\n' + fila([limpiar(r.name), ...r.a.map(String), r.op, String(r.b)]));
    }
  }, [modo]);

  const cambiarModo = useCallback((nuevo) => {
    if (nuevo === modo) return;
    if (nuevo === 'markdown') {
      setMd(borradorAMarkdown(draft));
      setErroresModo([]);
      setModo('markdown');
      return;
    }
    const r = parseMarkdown(md);
    if (r.errors.length) { setErroresModo(r.errors); return; }
    setDraft(borradorDeModelo(r.model));
    setErroresModo([]);
    setModo('tabla');
  }, [modo, draft, md]);

  const cargarEjemplo = useCallback((id) => {
    const e = EJEMPLOS.find((x) => x.id === id);
    if (!e) return;
    setEjemploId(id);
    setErroresModo([]);
    setDraft(borradorDeModelo(e.model));
    setMd(modelToMarkdown(e.model));
  }, []);

  const errores = erroresModo.length ? erroresModo : parsed.errors;

  return {
    modo, cambiarModo, draft, acciones, md, src,
    setMd: (v) => { setErroresModo([]); setMd(v); },
    names, n, metodoPref, setMetodoPref, metodo, enumDisponible,
    ejemploId, cargarEjemplo, agregarLogica,
    errores, avisos: parsed.warnings, model, res,
    pendiente: src !== srcEsperado,
  };
}
