import { useEffect, useRef, useState } from 'react';
import Toggle from '@/ui/Toggle.jsx';

export default function DiagramToolbar({ options, setOption, hasTimes, stepMode, setStepMode, onZoom, onFit, onFitAll, onRelayout, onExport }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div className="diagram-toolbar">
      <div className="tool-group" aria-label="Vista">
        <button type="button" className="icon-btn" onClick={() => onZoom(1 / 1.25)} title="Acercar">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
          <span className="sr-only">Acercar</span>
        </button>
        <button type="button" className="icon-btn" onClick={() => onZoom(1.25)} title="Alejar">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" /></svg>
          <span className="sr-only">Alejar</span>
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={onFit}>
          Ajustar
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={onFitAll}>
          Ver todo
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={onRelayout} title="Devuelve los eventos a su posición calculada">
          Reordenar
        </button>
      </div>

      <div className="tool-group tool-toggles">
        {hasTimes && (
          <>
            <Toggle checked={stepMode} onChange={setStepMode}>
              Paso a paso
            </Toggle>
            <Toggle checked={options.showCritical} onChange={(v) => setOption('showCritical', v)}>
              Ruta crítica
            </Toggle>
            <Toggle checked={options.colorCritical} disabled={!options.showCritical} onChange={(v) => setOption('colorCritical', v)}>
              En rojo
            </Toggle>
            <Toggle checked={options.showDurations} onChange={(v) => setOption('showDurations', v)}>
              Duraciones
            </Toggle>
          </>
        )}
        <Toggle checked={options.labelDummies} onChange={(v) => setOption('labelDummies', v)}>
          Nombrar ficticias
        </Toggle>
      </div>

      <div className="tool-group export-menu" ref={menuRef}>
        <button type="button" className="btn btn--sm btn--primary" onClick={() => onExport('pdf')}>
          Descargar PDF
        </button>
        <button type="button" className="btn btn--sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          Más formatos
        </button>
        {open && (
          <div className="menu" role="menu">
            {[
              ['pdf', 'PDF con diagrama y tablas'],
              ['png', 'Imagen PNG del diagrama'],
              ['svg', 'Vector SVG del diagrama'],
              ['print', 'Imprimir'],
            ].map(([k, label]) => (
              <button key={k} type="button" role="menuitem" onClick={() => { setOpen(false); onExport(k); }}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
