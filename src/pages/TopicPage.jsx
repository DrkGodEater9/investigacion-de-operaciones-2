import { Suspense, useEffect, useRef, useState } from 'react';
import { SLOTS, topicById, neighbors, moduleById } from '@/content/curriculum.js';
import { BUILT, builtSlots, topicStatus } from '@/content/registry.js';
import Tabs from '@/ui/Tabs.jsx';
import PendingSlot from '@/ui/PendingSlot.jsx';
import StatusMark from '@/ui/StatusMark.jsx';
import Toggle from '@/ui/Toggle.jsx';
import { hrefHome, hrefTopic } from '@/app/router.js';
import { useProgress } from '@/app/ProgressContext.jsx';

const STATUS_TEXT = { pendiente: 'En construcción', parcial: 'Con herramientas disponibles', completo: 'Completo' };

export default function TopicPage({ id, tab }) {
  const topic = topicById(id);
  const { studied, toggle } = useProgress();
  const headingRef = useRef(null);
  const built = builtSlots(id);
  const defaultTab = SLOTS.find((s) => built.includes(s.id))?.id || 'teoria';
  const current = SLOTS.some((s) => s.id === tab) ? tab : defaultTab;

  // Las pestañas ya visitadas quedan montadas (ocultas) para no perder lo que se escribió en una calculadora.
  const [visited, setVisited] = useState(() => new Set([current]));
  useEffect(() => { setVisited((v) => (v.has(current) ? v : new Set(v).add(current))); }, [current]);

  useEffect(() => {
    window.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, [id]);

  if (!topic) return <NotFound />;
  const mod = moduleById(topic.moduleId);
  const { prev, next } = neighbors(id);
  const status = topicStatus(id);

  return (
    <div className="topic">
      <header className="topic-head">
        <nav className="crumbs" aria-label="Ruta">
          <a href={hrefHome()}>Inicio</a>
          <span aria-hidden="true">/</span>
          <span>Módulo {mod.number}. {mod.title}</span>
        </nav>
        <div className="topic-title-row">
          <h1 ref={headingRef} tabIndex={-1}>
            <span className="topic-num">{topic.number}</span> {topic.title}
          </h1>
          <div className="topic-meta">
            <span className="status-pill"><StatusMark status={status} size={13} /> {STATUS_TEXT[status]}</span>
            <Toggle checked={studied.has(id)} onChange={() => toggle(id)}>Marcar como estudiado</Toggle>
          </div>
        </div>
        <p className="topic-summary">{topic.summary}</p>
      </header>

      <Tabs
        label={`Partes del tema ${topic.number}`}
        value={current}
        onChange={(t) => { location.hash = hrefTopic(id, t).slice(1); }}
        tabs={SLOTS.map((s) => ({ id: s.id, label: s.label, badge: built.includes(s.id) ? null : 'pronto' }))}
      />

      <div className="topic-body">
        {SLOTS.map((slot) => {
          if (!visited.has(slot.id)) return null;
          const Piece = BUILT[id]?.[slot.id];
          return (
            <div key={slot.id} role="tabpanel" hidden={slot.id !== current} className={'slot slot--' + slot.id}>
              {Piece ? (
                <Suspense fallback={<p className="loading">Cargando…</p>}>
                  <Piece />
                </Suspense>
              ) : (
                <PendingSlot slot={slot} topic={topic} />
              )}
            </div>
          );
        })}
      </div>

      <footer className="topic-foot">
        {prev ? (
          <a className="foot-link" href={hrefTopic(prev.id)}><small>Anterior</small><span>{prev.number} {prev.title}</span></a>
        ) : <span />}
        {next ? (
          <a className="foot-link foot-link--next" href={hrefTopic(next.id)}><small>Siguiente</small><span>{next.number} {next.title}</span></a>
        ) : <span />}
      </footer>
    </div>
  );
}

function NotFound() {
  return (
    <div className="topic">
      <h1>No encontré ese tema</h1>
      <p><a href={hrefHome()}>Volver al inicio</a></p>
    </div>
  );
}
