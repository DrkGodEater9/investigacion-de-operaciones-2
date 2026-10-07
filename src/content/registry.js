import { lazy } from 'react';

/**
 * Qué piezas de cada tema ya están construidas.
 * Cada entrada apunta a un componente (export default) dentro de src/topics/<id>/.
 * Lo que falte aparece como «pendiente» con su plan (ver curriculum.js).
 *
 * Para terminar una pieza: crear el archivo y agregar aquí una línea.
 * Claves posibles: teoria | paso | resuelve | practica
 */
export const BUILT = {
  'redes-estructura': {
    teoria: lazy(() => import('../topics/redes-estructura/Teoria.jsx')),
    paso: lazy(() => import('../topics/redes-estructura/Paso.jsx')),
    resuelve: lazy(() => import('../topics/redes-estructura/Resuelve.jsx')),
    practica: lazy(() => import('../topics/redes-estructura/Practica.jsx')),
  },
  'redes-tiempos': {
    teoria: lazy(() => import('../topics/redes-tiempos/Teoria.jsx')),
    paso: lazy(() => import('../topics/redes-tiempos/Paso.jsx')),
    resuelve: lazy(() => import('../topics/redes-tiempos/Resuelve.jsx')),
    practica: lazy(() => import('../topics/redes-tiempos/Practica.jsx')),
  },
  'redes-costos': {
    teoria: lazy(() => import('../topics/redes-costos/Teoria.jsx')),
    paso: lazy(() => import('../topics/redes-costos/Paso.jsx')),
    resuelve: lazy(() => import('../topics/redes-costos/Resuelve.jsx')),
    practica: lazy(() => import('../topics/redes-costos/Practica.jsx')),
  },
  'redes-recursos': {
    teoria: lazy(() => import('../topics/redes-recursos/Teoria.jsx')),
    paso: lazy(() => import('../topics/redes-recursos/Paso.jsx')),
    resuelve: lazy(() => import('../topics/redes-recursos/Resuelve.jsx')),
    practica: lazy(() => import('../topics/redes-recursos/Practica.jsx')),
  },
  'entera-pura': {
    teoria: lazy(() => import('../topics/entera-pura/Teoria.jsx')),
    paso: lazy(() => import('../topics/entera-pura/Paso.jsx')),
    resuelve: lazy(() => import('../topics/entera-pura/Resuelve.jsx')),
    practica: lazy(() => import('../topics/entera-pura/Practica.jsx')),
  },
  'entera-mixta': {
    teoria: lazy(() => import('../topics/entera-mixta/Teoria.jsx')),
    paso: lazy(() => import('../topics/entera-mixta/Paso.jsx')),
    resuelve: lazy(() => import('../topics/entera-mixta/Resuelve.jsx')),
    practica: lazy(() => import('../topics/entera-mixta/Practica.jsx')),
  },
  'entera-binaria': {
    teoria: lazy(() => import('../topics/entera-binaria/Teoria.jsx')),
    paso: lazy(() => import('../topics/entera-binaria/Paso.jsx')),
    resuelve: lazy(() => import('../topics/entera-binaria/Resuelve.jsx')),
    practica: lazy(() => import('../topics/entera-binaria/Practica.jsx')),
  },
  'decision-bayes': {
    teoria: lazy(() => import('../topics/decision-bayes/Teoria.jsx')),
    paso: lazy(() => import('../topics/decision-bayes/Paso.jsx')),
    resuelve: lazy(() => import('../topics/decision-bayes/Resuelve.jsx')),
    practica: lazy(() => import('../topics/decision-bayes/Practica.jsx')),
  },
  'decision-arboles': {
    teoria: lazy(() => import('../topics/decision-arboles/Teoria.jsx')),
    paso: lazy(() => import('../topics/decision-arboles/Paso.jsx')),
    resuelve: lazy(() => import('../topics/decision-arboles/Resuelve.jsx')),
    practica: lazy(() => import('../topics/decision-arboles/Practica.jsx')),
  },
};

export const builtSlots = (topicId) => Object.keys(BUILT[topicId] || {});

/** 'completo' (las 4 partes), 'parcial' (alguna) o 'pendiente'. */
export function topicStatus(topicId) {
  const n = builtSlots(topicId).length;
  return n === 0 ? 'pendiente' : n === 4 ? 'completo' : 'parcial';
}
