export default function Toggle({ checked, onChange, children, disabled }) {
  return (
    <label className={'toggle' + (disabled ? ' is-disabled' : '')}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-box" aria-hidden="true" />
      <span>{children}</span>
    </label>
  );
}
