import { useCallback, useMemo, useState } from 'react';
import { normalizar } from '../domain/arbol.js';
import { evaluar } from '../domain/evaluar.js';
import { perfilRiesgo } from '../domain/riesgo.js';
import { parsearTexto, arbolATexto } from '../domain/texto.js';
import * as ed from '../domain/edicion.js';
import { EJEMPLOS } from '../domain/ejemplos.js';

const clonar = (x) => JSON.parse(JSON.stringify(x));

/** Cambia (o agrega al principio) una línea «clave: valor» del texto del árbol. */
function ponerCampo(texto, clave, valor) {
  const re = new RegExp(`^(\\s*(?:[-*+]\\s+)?)${clave}\\s*[:=].*$`, 'im');
  if (re.test(texto)) return texto.replace(re, (_, pre) => `${pre}${clave}: ${valor}`);
  return `${clave}: ${valor}\n${texto}`;
}

/** Estado de «Resuelve el tuyo»: el borrador (editor) o el texto, y todo lo que se calcula de él. */
export function useArbol() {
  const [modo, setModo] = useState('editor');
  const [draft, setDraft] = useState(() => clonar(EJEMPLOS[0].arbol));
  const [texto, setTexto] = useState('');
  const [ejemploId, setEjemploId] = useState(EJEMPLOS[0].id);
  const [erroresModo, setErroresModo] = useState([]);

  const parseo = useMemo(() => (modo === 'texto' ? parsearTexto(texto) : null), [modo, texto]);
  const entrada = modo === 'editor' ? draft : parseo.arbol;
  const norm = useMemo(() => (entrada ? normalizar(entrada) : null), [entrada]);
  const ev = useMemo(() => (norm?.arbol ? evaluar(norm.arbol) : null), [norm]);
  const riesgo = useMemo(() => (norm?.arbol && ev ? perfilRiesgo(norm.arbol, ev) : null), [norm, ev]);

  const errores = erroresModo.length
    ? erroresModo
    : modo === 'texto' && parseo.errores.length
      ? parseo.errores.map((e) => ({ mensaje: e.mensaje }))
      : (norm?.errores || []);

  const upd = useCallback((f) => { setErroresModo([]); setDraft((d) => f(d)); }, []);
  const acciones = {
    setSense: (v) => (modo === 'texto' ? setTexto((t) => ponerCampo(t, 'objetivo', v)) : upd((d) => ed.actualizarArbol(d, { sense: v }))),
    setUnidad: (v) => (modo === 'texto' ? setTexto((t) => ponerCampo(t, 'unidad', v)) : upd((d) => ed.actualizarArbol(d, { unidad: v }))),
    setNodo: (id, cambios) => upd((d) => ed.actualizarNodo(d, id, cambios)),
    setRama: (id, i, cambios) => upd((d) => ed.actualizarRama(d, id, i, cambios)),
    agregarRama: (id) => upd((d) => ed.agregarRama(d, id)),
    quitarRama: (id, i) => upd((d) => ed.quitarRama(d, id, i)),
    cambiarTipo: (id, t) => upd((d) => ed.cambiarTipo(d, id, t)),
    repartir: (id) => upd((d) => ed.repartirProbabilidades(d, id)),
    completar: (id) => upd((d) => ed.completarUltima(d, id)),
  };

  const cargarEjemplo = useCallback((id) => {
    const e = EJEMPLOS.find((x) => x.id === id);
    if (!e) return;
    setEjemploId(id);
    setErroresModo([]);
    setDraft(clonar(e.arbol));
    setTexto(arbolATexto(e.arbol));
  }, []);

  const limpiar = useCallback(() => {
    setErroresModo([]);
    setEjemploId('');
    const v = ed.arbolVacio();
    setDraft(v);
    setTexto(arbolATexto(v));
  }, []);

  const cambiarModo = useCallback((nuevo) => {
    if (nuevo === modo) return;
    if (nuevo === 'texto') {
      setTexto(arbolATexto(draft));
      setErroresModo([]);
      setModo('texto');
      return;
    }
    const r = parsearTexto(texto);
    if (!r.arbol) {
      setErroresModo(r.errores.map((e) => ({ mensaje: e.mensaje })));
      return;
    }
    setDraft(r.arbol);
    setErroresModo([]);
    setModo('editor');
  }, [modo, draft, texto]);

  return {
    modo, cambiarModo, draft, acciones, texto, setTexto: (v) => { setErroresModo([]); setTexto(v); },
    ejemploId, cargarEjemplo, limpiar, errores, avisos: norm?.avisos || [],
    arbol: norm?.arbol || null, ev, riesgo, sense: entrada?.sense || 'max', unidad: entrada?.unidad || '',
    erroresNorm: norm?.errores || [],
  };
}
