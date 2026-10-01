export default function Segmented({ options, value, onChange, label, size }) {
  return (
    <div className={'segmented' + (size ? ' segmented--' + size : '')} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          title={o.hint}
          className={value === o.id ? 'is-on' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
