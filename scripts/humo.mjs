// Prueba de humo de la interfaz: renderiza en el servidor cada pestaña de cada tema y la portada.
// Detecta componentes que revientan al montarse (imports rotos, datos faltantes, errores de render).
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';

// Los componentes pueden tocar window/localStorage; en Node se simulan vacíos.
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.location = { hash: '' };

const raiz = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ root: raiz, appType: 'custom', server: { middlewareMode: true }, logLevel: 'error' });
let fallos = 0, total = 0;
try {
  const { BUILT } = await vite.ssrLoadModule('/src/content/registry.js');
  const { ProgressProvider } = await vite.ssrLoadModule('/src/app/ProgressContext.jsx');
  const Home = (await vite.ssrLoadModule('/src/pages/HomePage.jsx')).default;
  const Sidebar = (await vite.ssrLoadModule('/src/app/Sidebar.jsx')).default;

  const probar = async (nombre, fabricar) => {
    total++;
    try {
      const html = renderToString(React.createElement(ProgressProvider, null, await fabricar()));
      if (html.length < 50) throw new Error('render casi vacío');
      console.log('✔', nombre);
    } catch (e) { fallos++; console.error('✖', nombre, '→', e.message); }
  };

  await probar('portada', () => React.createElement(Home));
  await probar('menú', () => React.createElement(Sidebar, { activeTopicId: null, atHome: true, onNavigate() {} }));
  for (const [tema, piezas] of Object.entries(BUILT)) {
    for (const clave of Object.keys(piezas)) {
      const mod = await vite.ssrLoadModule(`/src/topics/${tema}/${{ teoria: 'Teoria', paso: 'Paso', resuelve: 'Resuelve', practica: 'Practica' }[clave]}.jsx`);
      await probar(`${tema} / ${clave}`, () => React.createElement(mod.default));
    }
  }
} finally { await vite.close(); }
console.log(fallos ? `\n✖ ${fallos} de ${total} fallaron` : `\n✔ ${total} vistas renderizan sin errores`);
process.exit(fallos ? 1 : 0);
