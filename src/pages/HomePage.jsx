import { COURSE, MODULES, SLOTS } from '@/content/curriculum.js';
import { topicStatus } from '@/content/registry.js';
import StatusMark from '@/ui/StatusMark.jsx';
import { hrefTopic } from '@/app/router.js';
import { useProgress } from '@/app/ProgressContext.jsx';

export default function HomePage() {
  const { studied } = useProgress();
  const all = MODULES.flatMap((m) => m.topics);
  const withTools = all.filter((t) => topicStatus(t.id) !== 'pendiente').length;

  return (
    <div className="home">
      <header className="home-head">
        <p className="eyebrow">{COURSE.program}</p>
        <h1>{COURSE.title}</h1>
        <p className="lead-lg">{COURSE.intro}</p>
        <p className="home-stats">
          {all.length} temas en {MODULES.length} módulos. {withTools === 0 ? 'Todos en construcción.' : `${withTools} ya tienen herramientas disponibles.`}
          {studied.size > 0 && ` Llevas ${studied.size} marcados como estudiados.`}
        </p>
      </header>

      <section aria-labelledby="idx">
        <h2 id="idx" className="section-rule">Contenido</h2>
        <div className="module-list">
          {MODULES.map((m) => (
            <div key={m.id} className="module-card">
              <div className="module-card-head">
                <span className="module-num">{m.number}</span>
                <div>
                  <h3>{m.title}</h3>
                  <p>{m.summary}</p>
                </div>
              </div>
              <ul className="toc">
                {m.topics.map((t) => (
                  <li key={t.id}>
                    <a href={hrefTopic(t.id)}>
                      <StatusMark status={topicStatus(t.id)} />
                      <span className="toc-num">{t.number}</span>
                      <span className="toc-title">{t.title}</span>
                      <span className="toc-dots" aria-hidden="true" />
                      <span className="toc-state">{studied.has(t.id) ? 'Estudiado ✓' : { pendiente: 'En construcción', parcial: 'Con herramientas', completo: 'Completo' }[topicStatus(t.id)]}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="section-rule">Cómo está armado cada tema</h2>
        <ol className="how-list">
          {SLOTS.map((s, i) => (
            <li key={s.id}>
              <span className="how-num">{i + 1}</span>
              <div>
                <strong>{s.label}</strong>
                <p>{s.hint}.</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="home-note">
        Material de estudio hecho por estudiantes, sin carácter oficial. La referencia del curso es el programa (syllabus) y la bibliografía: Taha, <em>Investigación de operaciones</em>, y Hillier y Lieberman, <em>Introducción a la investigación de operaciones</em>.
      </p>
    </div>
  );
}
