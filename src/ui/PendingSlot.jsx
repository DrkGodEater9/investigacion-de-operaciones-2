/** Lo que se muestra en una pestaña que todavía no está construida. */
export default function PendingSlot({ slot, topic }) {
  const items = {
    teoria: {
      title: 'La teoría de este tema está por escribirse',
      body: topic.subtopics.length
        ? 'Aquí va una explicación corta, con dibujos, de lo que pide el programa del curso:'
        : 'Aquí va una explicación corta, con dibujos y ejemplos. Tema:',
      list: topic.subtopics,
      fallback: topic.summary,
    },
    paso: { title: 'El paso a paso está por construirse', body: 'Aquí va un ejemplo resuelto que avanza de a un paso:', list: [], fallback: topic.plan.paso },
    resuelve: { title: 'La calculadora está por construirse', body: 'Aquí ingresarás tu propio ejercicio:', list: [], fallback: topic.plan.resuelve },
    practica: { title: 'Los ejercicios están por construirse', body: 'Aquí practicarás con corrección:', list: [], fallback: topic.plan.practica },
  }[slot.id];

  return (
    <div className="pending">
      <svg className="pending-mark" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="28" fill="#fff" stroke="#000" strokeWidth="1.6" strokeDasharray="5 4" />
        <line x1="4" y1="32" x2="60" y2="32" stroke="#000" strokeWidth="1.2" strokeDasharray="5 4" />
        <line x1="32" y1="32" x2="32" y2="60" stroke="#000" strokeWidth="1.2" strokeDasharray="5 4" />
      </svg>
      <div>
        <h3>{items.title}</h3>
        <p>{items.body}</p>
        {items.list.length > 0 ? (
          <ul>{items.list.map((s) => <li key={s}>{s}</li>)}</ul>
        ) : (
          <p className="pending-plan">{items.fallback}</p>
        )}
      </div>
    </div>
  );
}
