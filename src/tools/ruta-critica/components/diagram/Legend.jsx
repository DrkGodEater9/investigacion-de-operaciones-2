import { SERIF } from './theme.js';

export default function Legend({ hasTimes }) {
  return (
    <div className="legend">
      <span className="legend-item">
      <svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true">
        <circle cx="32" cy="32" r="28" fill="#fff" stroke="#000" strokeWidth="1.4" />
        <line x1="4" y1="32" x2="60" y2="32" stroke="#000" strokeWidth="1.2" />
        <line x1="32" y1="32" x2="32" y2="60" stroke="#000" strokeWidth="1.2" />
        <text x="32" y="21" textAnchor="middle" fontFamily={SERIF} fontSize="16">i</text>
        <text x="19" y="49" textAnchor="middle" fontFamily={SERIF} fontSize="12">TE</text>
        <text x="45" y="49" textAnchor="middle" fontFamily={SERIF} fontSize="12">TL</text>
      </svg>
      <p>
        Arriba el número del evento. {hasTimes ? 'Abajo a la izquierda el tiempo más temprano (se va sumando) y a la derecha el más tardío (se va restando).' : 'Las mitades de abajo quedan para los tiempos.'}
      </p>
      </span>
      <span className="legend-item">
      <svg viewBox="0 0 60 14" width="48" height="12" aria-hidden="true">
        <line x1="2" y1="7" x2="50" y2="7" stroke="#000" strokeWidth="1.3" strokeDasharray="6 4" />
        <path d="M48,2 L58,7 L48,12 z" />
      </svg>
      <p>Ficticia: solo marca dependencia, dura 0.</p>
      </span>
      {hasTimes && (
        <span className="legend-item">
          <svg viewBox="0 0 60 14" width="48" height="12" aria-hidden="true">
            <line x1="2" y1="7" x2="50" y2="7" stroke="#000" strokeWidth="2.8" />
            <path d="M48,2 L58,7 L48,12 z" />
          </svg>
          <p>Trazo grueso: actividad crítica.</p>
        </span>
      )}
    </div>
  );
}
