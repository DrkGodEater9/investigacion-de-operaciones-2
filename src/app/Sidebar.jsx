import { useEffect, useState } from 'react';
import { MODULES } from '@/content/curriculum.js';
import { topicStatus } from '@/content/registry.js';
import StatusMark from '@/ui/StatusMark.jsx';
import { hrefHome, hrefTopic } from './router.js';
import { useProgress } from './ProgressContext.jsx';

/** Menú del curso: módulos que se despliegan en sus temas. */
export default function Sidebar({ activeTopicId, atHome, onNavigate }) {
  const { studied } = useProgress();
  const activeModule = MODULES.find((m) => m.topics.some((t) => t.id === activeTopicId))?.id;
  const [open, setOpen] = useState(() => new Set(MODULES.map((m) => m.id)));

  // Al llegar a un tema, su módulo se despliega.
  useEffect(() => {
    if (activeModule) setOpen((o) => (o.has(activeModule) ? o : new Set(o).add(activeModule)));
  }, [activeModule]);

  const toggle = (id) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <nav className="site-sidebar" aria-label="Contenido del curso">
      <a className="sb-home" href={hrefHome()} aria-current={atHome ? 'page' : undefined} onClick={onNavigate}>
        <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true">
          <circle cx="20" cy="20" r="17" fill="#fff" stroke="#000" strokeWidth="2" />
          <line x1="3" y1="20" x2="37" y2="20" stroke="#000" strokeWidth="2" />
          <line x1="20" y1="20" x2="20" y2="37" stroke="#000" strokeWidth="2" />
        </svg>
        <span>
          <strong>Investigación de operaciones II</strong>
          <small>Material de estudio</small>
        </span>
      </a>

      <ul className="sb-modules">
        {MODULES.map((m) => {
          const isOpen = open.has(m.id);
          return (
            <li key={m.id} className="sb-module">
              <button type="button" className="sb-module-btn" aria-expanded={isOpen} onClick={() => toggle(m.id)}>
                <span className="sb-num">{m.number}</span>
                <span className="sb-title">{m.title}</span>
                <svg className="sb-chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {isOpen && (
                <ul className="sb-topics">
                  {m.topics.map((t) => (
                    <li key={t.id}>
                      <a href={hrefTopic(t.id)} className={'sb-topic' + (t.id === activeTopicId ? ' is-active' : '')} aria-current={t.id === activeTopicId ? 'page' : undefined} onClick={onNavigate}>
                        <StatusMark status={topicStatus(t.id)} />
                        <span className="sb-topic-num">{t.number}</span>
                        <span className="sb-topic-title">{t.title}</span>
                        {studied.has(t.id) && <span className="sb-check" title="Estudiado">✓</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="sb-legend" aria-label="Significado de los círculos">
        <span><StatusMark status="completo" size={12} /> Completo</span>
        <span><StatusMark status="parcial" size={12} /> Con herramientas</span>
        <span><StatusMark status="pendiente" size={12} /> En construcción</span>
      </div>
    </nav>
  );
}
