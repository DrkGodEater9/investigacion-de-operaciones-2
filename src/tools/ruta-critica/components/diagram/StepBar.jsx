import { useEffect } from 'react';

const PHASE = { forward: 'Pase hacia adelante', backward: 'Pase hacia atrás', critical: 'Ruta crítica' };

export default function StepBar({ steps, index, setIndex, playing, setPlaying }) {
  const total = steps.length;
  useEffect(() => {
    if (!playing) return undefined;
    if (index >= total) { setPlaying(false); return undefined; }
    const t = setTimeout(() => setIndex(index + 1), 1100);
    return () => clearTimeout(t);
  }, [playing, index, total, setIndex, setPlaying]);

  const step = index > 0 ? steps[index - 1] : null;
  return (
    <div className="step-bar">
      <div className="step-controls">
        <button type="button" className="icon-btn" onClick={() => { setPlaying(false); setIndex(0); }} disabled={index === 0} title="Al inicio">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3v10M12 3L6 8l6 5z" /></svg>
          <span className="sr-only">Al inicio</span>
        </button>
        <button type="button" className="icon-btn" onClick={() => { setPlaying(false); setIndex(Math.max(0, index - 1)); }} disabled={index === 0} title="Paso anterior">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 3L5 8l6 5z" /></svg>
          <span className="sr-only">Paso anterior</span>
        </button>
        <button type="button" className="btn btn--sm btn--primary step-play" onClick={() => { if (index >= total) setIndex(0); setPlaying(!playing); }}>
          {playing ? 'Pausar' : index >= total ? 'Repetir' : 'Reproducir'}
        </button>
        <button type="button" className="icon-btn" onClick={() => { setPlaying(false); setIndex(Math.min(total, index + 1)); }} disabled={index >= total} title="Paso siguiente">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l6 5-6 5z" /></svg>
          <span className="sr-only">Paso siguiente</span>
        </button>
        <button type="button" className="icon-btn" onClick={() => { setPlaying(false); setIndex(total); }} disabled={index >= total} title="Al final">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12 3v10M4 3l6 5-6 5z" /></svg>
          <span className="sr-only">Al final</span>
        </button>
        <span className="step-count">
          {index} / {total}
        </span>
      </div>
      <input
        type="range"
        className="step-range"
        min="0"
        max={total}
        value={index}
        onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }}
        aria-label="Paso de la solución"
      />
      <p className="step-text" aria-live="polite">
        {step ? (
          <>
            <span className="step-phase">{PHASE[step.phase]}.</span> {step.text}
          </>
        ) : (
          'La red está armada. Avanza para calcular los tiempos más tempranos evento por evento.'
        )}
      </p>
    </div>
  );
}
