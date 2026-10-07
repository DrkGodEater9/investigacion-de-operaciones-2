import { useCallback, useEffect, useMemo, useState } from 'react';
import { MAX_ALT, MAX_EST, MAX_IND, analizar, verosimilitudPorFiabilidad } from '../domain/bayes.js';
import { parseMarkdown, borradorDeProblema, borradorAMarkdown } from '../domain/entrada.js';
import { EJEMPLOS } from '../domain/ejemplos.js';

const ESPERA = 250;
const aTexto = (x) => String(x).replace('.', ',');
const reemplazar = (arr, i, v) => arr.map((x, k) => (k === i ? v : x));

export function useSolver() {
  const [modo, setModo] = useState('tabla');
  const [draft, setDraft] = useState(() => borradorDeProblema(EJEMPLOS[0].problema));
  const [md, setMd] = useState('');
  const [ejemploId, setEjemploId] = useState(EJEMPLOS[0].id);
  const [erroresModo, setErroresModo] = useState([]);

  const src = modo === 'tabla' ? borradorAMarkdown(draft) : md;
  const [srcEsperado, setSrcEsperado] = useState(src);
  useEffect(() => {
    const t = setTimeout(() => setSrcEsperado(src), ESPERA);
    return () => clearTimeout(t);
  }, [src]);

  const parsed = useMemo(() => parseMarkdown(srcEsperado), [srcEsperado]);
  const problema = parsed.problema;
  const analisis = useMemo(() => (problema ? analizar(problema) : null), [problema]);

  const upd = useCallback((f) => { setErroresModo([]); setDraft((d) => f(d)); }, []);
  const acciones = {
    setObjetivo: (v) => upd((d) => ({ ...d, objetivo: v })),
    setAlt: (i, v) => upd((d) => ({ ...d, alts: reemplazar(d.alts, i, v) })),
    setEstado: (j, v) => upd((d) => ({ ...d, estados: reemplazar(d.estados, j, v) })),
    setPago: (i, j, v) => upd((d) => ({ ...d, pagos: d.pagos.map((f, k) => (k === i ? reemplazar(f, j, v) : f)) })),
    setPriori: (j, v) => upd((d) => ({ ...d, priori: reemplazar(d.priori, j, v) })),
    agregarAlt: () => upd((d) => (d.alts.length >= MAX_ALT ? d : { ...d, alts: [...d.alts, `Alternativa ${d.alts.length + 1}`], pagos: [...d.pagos, d.estados.map(() => '')] })),
    quitarAlt: () => upd((d) => (d.alts.length <= 2 ? d : { ...d, alts: d.alts.slice(0, -1), pagos: d.pagos.slice(0, -1) })),
    agregarEstado: () => upd((d) => (d.estados.length >= MAX_EST ? d : {
      ...d,
      estados: [...d.estados, `Estado ${d.estados.length + 1}`],
      pagos: d.pagos.map((f) => [...f, '']),
      priori: [...d.priori, ''],
      lik: [...d.lik, d.inds.map(() => '')],
    })),
    quitarEstado: () => upd((d) => (d.estados.length <= 2 ? d : {
      ...d, estados: d.estados.slice(0, -1), pagos: d.pagos.map((f) => f.slice(0, -1)), priori: d.priori.slice(0, -1), lik: d.lik.slice(0, -1),
    })),
    setConInfo: (v) => upd((d) => ({ ...d, conInfo: v })),
    setInd: (k, v) => upd((d) => ({ ...d, inds: reemplazar(d.inds, k, v) })),
    setLik: (j, k, v) => upd((d) => ({ ...d, lik: d.lik.map((f, q) => (q === j ? reemplazar(f, k, v) : f)) })),
    agregarInd: () => upd((d) => (d.inds.length >= MAX_IND ? d : { ...d, inds: [...d.inds, `Resultado ${d.inds.length + 1}`], lik: d.lik.map((f) => [...f, '']) })),
    quitarInd: () => upd((d) => (d.inds.length <= 2 ? d : { ...d, inds: d.inds.slice(0, -1), lik: d.lik.map((f) => f.slice(0, -1)) })),
    /** Llena la verosimilitud a partir de una fiabilidad r (0 a 1): la señal «correcta» sale con probabilidad r. */
    fiabilidad: (r) => upd((d) => ({ ...d, lik: verosimilitudPorFiabilidad(d.estados.length, d.inds.length, r).map((f) => f.map((x) => aTexto(Math.round(x * 1e6) / 1e6))) })),
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
    setDraft(borradorDeProblema(r.problema));
    setErroresModo([]);
    setModo('tabla');
  }, [modo, draft, md]);

  const cargarEjemplo = useCallback((id) => {
    const e = EJEMPLOS.find((x) => x.id === id);
    if (!e) return;
    setEjemploId(id);
    setErroresModo([]);
    const d = borradorDeProblema(e.problema);
    setDraft(d);
    setMd(borradorAMarkdown(d));
  }, []);

  const errores = erroresModo.length ? erroresModo : parsed.errores;

  return {
    modo, cambiarModo, draft, acciones, md, src,
    setMd: (v) => { setErroresModo([]); setMd(v); },
    ejemploId, cargarEjemplo,
    errores, avisos: parsed.avisos, problema, analisis,
    pendiente: src !== srcEsperado,
  };
}
