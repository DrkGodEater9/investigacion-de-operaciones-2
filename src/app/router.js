import { useEffect, useState } from 'react';

/** Rutas con hash (funcionan en cualquier hosting y con el botón «atrás»):
 *   #/            portada
 *   #/t/<tema>    tema (pestaña por defecto)
 *   #/t/<tema>/<pestaña>
 */
function parse() {
  const [a, b, c] = location.hash.replace(/^#\/?/, '').split('/');
  if (!a) return { page: 'home' };
  if (a === 't' && b) return { page: 'topic', id: b, tab: c || null };
  return { page: 'notfound' };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const hrefHome = () => '#/';
export const hrefTopic = (id, tab) => `#/t/${id}${tab ? '/' + tab : ''}`;
