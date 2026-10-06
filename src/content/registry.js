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
    resuelve: lazy(() => import('../topics/redes-estructura/Resuelve.jsx')),
  },
  'redes-tiempos': {
    resuelve: lazy(() => import('../topics/redes-tiempos/Resuelve.jsx')),
  },
  'entera-pura': {
    teoria: lazy(() => import('../topics/entera-pura/Teoria.jsx')),
    paso: lazy(() => import('../topics/entera-pura/Paso.jsx')),
    resuelve: lazy(() => import('../topics/entera-pura/Resuelve.jsx')),
    practica: lazy(() => import('../topics/entera-pura/Practica.jsx')),
  },
  'entera-binaria': {
    teoria: lazy(() => import('../topics/entera-binaria/Teoria.jsx')),
    paso: lazy(() => import('../topics/entera-binaria/Paso.jsx')),
    resuelve: lazy(() => import('../topics/entera-binaria/Resuelve.jsx')),
    practica: lazy(() => import('../topics/entera-binaria/Practica.jsx')),
  },
  'entera-mixta': {
    teoria: lazy(() => import('../topics/entera-mixta/Teoria.jsx')),
    paso: lazy(() => import('../topics/entera-mixta/Paso.jsx')),
    resuelve: lazy(() => import('../topics/entera-mixta/Resuelve.jsx')),
    practica: lazy(() => import('../topics/entera-mixta/Practica.jsx')),
  },
};

export const builtSlots = (topicId) => Object.keys(BUILT[topicId] || {});

/** 'completo' (las 4 partes), 'parcial' (alguna) o 'pendiente'. */
export function topicStatus(topicId) {
  const n = builtSlots(topicId).length;
  return n === 0 ? 'pendiente' : n === 4 ? 'completo' : 'parcial';
}
