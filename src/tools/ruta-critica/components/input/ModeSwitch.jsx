import Segmented from '@/ui/Segmented.jsx';

export const MODES = [
  { id: 'network', label: 'Solo la red', hint: 'Construir el diagrama sin tiempos' },
  { id: 'cpm', label: 'CPM', hint: 'Una duración por actividad' },
  { id: 'pert', label: 'PERT', hint: 'Tres tiempos: optimista, más probable y pesimista' },
];

export default function ModeSwitch({ mode, decimals, dispatch }) {
  return (
    <div className="mode-row">
      <Segmented label="Tipo de ejercicio" options={MODES} value={mode} onChange={(v) => dispatch({ type: 'mode', value: v })} />
      {mode === 'pert' && (
        <label className="inline-field">
          Decimales
          <select value={decimals} onChange={(e) => dispatch({ type: 'decimals', value: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
