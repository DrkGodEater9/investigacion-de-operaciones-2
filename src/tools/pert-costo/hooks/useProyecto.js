import { useCallback, useEffect, useMemo, useState } from 'react';
import { EJEMPLOS, ejemploPorId } from '../domain/ejemplos.js';
import { analizar } from '../domain/analizar.js';
import { leerTexto, aMarkdown } from '../domain/entrada.js';

const ESPERA = 250;
let seq = 0;
const uid = () => 'p' + ++seq;
const conId = (filas) => filas.map((f) => ({ name: '', preds: '', dn: '', cn: '', dl: '', cl: '', ...f, preds: f.preds === '-' ? '' : f.preds, id: uid() }));
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function siguienteNombre(filas) {
  const usados = new Set(filas.map((f) => f.name));
  for (const ch of LETRAS) if (!usados.has(ch)) return ch;
  let k = 1;
  while (usados.has('A' + k)) k++;
  return 'A' + k;
}

/** Estado del proyecto que escribe el estudiante (tabla o Markdown) y su análisis. */
export function useProyecto(inicio = 'obra') {
  const base = ejemploPorId(inicio);
  const [ejemploId, setEjemploId] = useState(base.id);
  const [modo, setModo] = useState('tabla');
  const [titulo, setTitulo] = useState(base.titulo);
  const [ci, setCi] = useState(base.ci);
  const [fijo, setFijo] = useState(base.fijo);
  const [objetivo, setObjetivo] = useState('');
  const [filas, setFilas] = useState(() => conId(base.filas));
  const [md, setMd] = useState('');

  const lectura = useMemo(() => (modo === 'markdown' ? leerTexto(md) : null), [modo, md]);
  const entrada = useMemo(
    () => (lectura ? { filas: lectura.filas, ci: lectura.ci, fijo: lectura.fijo } : { filas, ci, fijo }),
    [lectura, filas, ci, fijo],
  );
  const tituloVivo = lectura ? lectura.titulo || 'Ejercicio sin título' : titulo;

  // Se espera un momento después de escribir antes de recalcular
  const [aplicada, setAplicada] = useState(entrada);
  useEffect(() => {
    const t = setTimeout(() => setAplicada(entrada), ESPERA);
    return () => clearTimeout(t);
  }, [entrada]);
  const pendiente = aplicada !== entrada;

  const analisis = useMemo(() => analizar({ ...aplicada, objetivo }), [aplicada, objetivo]);

  const cargarEjemplo = useCallback((id) => {
    const e = ejemploPorId(id);
    setEjemploId(e.id);
    setTitulo(e.titulo);
    setCi(e.ci);
    setFijo(e.fijo);
    setFilas(conId(e.filas));
    setObjetivo('');
    setMd(aMarkdown({ titulo: e.titulo, ci: e.ci, fijo: e.fijo, filas: e.filas }));
  }, []);

  const cambiarModo = useCallback((nuevo) => {
    if (nuevo === modo) return;
    if (nuevo === 'markdown') setMd(aMarkdown({ titulo, ci, fijo, filas }));
    else {
      const l = leerTexto(md);
      setFilas(conId(l.filas.length ? l.filas : [{}]));
      setCi(l.ci);
      setFijo(l.fijo);
      if (l.titulo) setTitulo(l.titulo);
    }
    setModo(nuevo);
  }, [modo, titulo, ci, fijo, filas, md]);

  const acciones = useMemo(() => ({
    actualizar: (id, campo, valor) => setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, [campo]: valor } : f))),
    agregar: () => setFilas((fs) => [...fs, ...conId([{ name: siguienteNombre(fs) }])]),
    quitar: (id) => setFilas((fs) => (fs.length > 1 ? fs.filter((f) => f.id !== id) : fs)),
    mover: (id, delta) => setFilas((fs) => {
      const i = fs.findIndex((f) => f.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= fs.length) return fs;
      const copia = fs.slice();
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    }),
    nuevo: () => { setFilas(conId([{ name: 'A' }])); setTitulo('Mi proyecto'); setCi(''); setFijo('0'); setObjetivo(''); setEjemploId(''); },
  }), []);

  return {
    ejemplos: EJEMPLOS, ejemploId, modo, titulo: tituloVivo, setTitulo, ci, setCi, fijo, setFijo, objetivo, setObjetivo,
    filas, md, setMd, lectura, entrada, pendiente, analisis, cargarEjemplo, cambiarModo, acciones,
  };
}
