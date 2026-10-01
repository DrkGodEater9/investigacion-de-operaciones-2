export default function TopBar({ open, onToggle }) {
  return (
    <header className="site-topbar">
      <button type="button" className="icon-btn menu-btn" onClick={onToggle} aria-expanded={open} aria-controls="site-nav" title={open ? 'Ocultar el menú' : 'Mostrar el menú'}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" /></svg>
        <span className="sr-only">{open ? 'Ocultar el menú' : 'Mostrar el menú'}</span>
      </button>
      <span className="topbar-title">Investigación de operaciones II</span>
      <span className="topbar-note">Material de estudio no oficial</span>
    </header>
  );
}
