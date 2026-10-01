/** Círculo partido (el mismo de los eventos de la red): vacío, medio lleno o lleno. */
export default function StatusMark({ status, size = 14 }) {
  const label = { pendiente: 'En construcción', parcial: 'Con herramientas disponibles', completo: 'Completo' }[status];
  return (
    <svg className={'status-mark status-mark--' + status} width={size} height={size} viewBox="0 0 16 16" role="img" aria-label={label}>
      <title>{label}</title>
      <circle cx="8" cy="8" r="6.6" fill="#fff" stroke="#000" strokeWidth="1.4" />
      {status === 'parcial' && <path d="M1.4 8a6.6 6.6 0 0 0 13.2 0z" fill="#000" />}
      {status === 'completo' && <circle cx="8" cy="8" r="6.6" fill="#000" />}
    </svg>
  );
}
