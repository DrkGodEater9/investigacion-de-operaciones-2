import { useCallback, useEffect, useState } from 'react';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import { ProgressProvider } from './ProgressContext.jsx';
import { useRoute, hrefHome } from './router.js';
import { topicById } from '@/content/curriculum.js';
import HomePage from '@/pages/HomePage.jsx';
import TopicPage from '@/pages/TopicPage.jsx';

const isNarrow = () => window.matchMedia('(max-width: 1000px)').matches;

export default function App() {
  const route = useRoute();
  // El título de la pestaña del navegador sigue al tema abierto.
  useEffect(() => {
    const topic = route.page === 'topic' ? topicById(route.id) : null;
    document.title = (topic ? `${topic.number} ${topic.title} · ` : '') + 'Investigación de operaciones II';
  }, [route]);

  const [open, setOpen] = useState(() => !isNarrow());

  // En pantallas angostas el menú es un cajón: se cierra al elegir un tema.
  const onNavigate = useCallback(() => { if (isNarrow()) setOpen(false); }, []);
  useEffect(() => { if (isNarrow()) setOpen(false); }, [route]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && isNarrow()) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <ProgressProvider>
      <div className="site" data-nav={open ? 'open' : 'closed'}>
        <a className="skip-link" href="#contenido" onClick={(e) => { e.preventDefault(); document.getElementById('contenido')?.focus(); }}>Saltar al contenido</a>
        <div id="site-nav" className="site-nav">
          <Sidebar activeTopicId={route.page === 'topic' ? route.id : null} atHome={route.page === 'home'} onNavigate={onNavigate} />
        </div>
        <button type="button" className="site-scrim" aria-label="Cerrar el menú" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
        <div className="site-main">
          <TopBar open={open} onToggle={() => setOpen((o) => !o)} />
          <main id="contenido" tabIndex={-1} className="site-content">
            {route.page === 'topic' ? <TopicPage key={route.id} id={route.id} tab={route.tab} /> : route.page === 'home' ? <HomePage /> : (
              <div><h1>Página no encontrada</h1><p><a href={hrefHome()}>Volver al inicio</a></p></div>
            )}
          </main>
        </div>
      </div>
    </ProgressProvider>
  );
}
