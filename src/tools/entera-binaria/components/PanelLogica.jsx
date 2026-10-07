import { filtrar } from '@/shared/campos.js';
import { useState } from 'react';
import { restriccionLogica, TIPOS_LOGICA } from '../domain/logica.js';
import { sub } from '../domain/format.js';

/** Constructor de condiciones lógicas: genera la restricción con el dominio y la entrega a onAgregar. */
export default function PanelLogica({ names, onAgregar }) {
  const [tipo, setTipo] = useState('aLoSumo');
  const [sel, setSel] = useState([]);
  const [k, setK] = useState('1');
  const [a, setA] = useState(0);
  const [b, setB] = useState(1);
  const [error, setError] = useState('');
  const def = TIPOS_LOGICA.find((t) => t.id === tipo);
  const n = names.length;

  const alternar = (j) => {
    setError('');
    setSel((s) => (s.includes(j) ? s.filter((x) => x !== j) : [...s, j].sort((p, q) => p - q)));
  };

  const agregar = () => {
    try {
      const params = def.usaPar
        ? { a: Math.min(a, n - 1), b: Math.min(b, n - 1) }
        : { vars: sel.filter((j) => j < n), k: def.usaK ? Number(k.trim().replace(',', '.')) : undefined };
      if (def.usaK && k.trim() === '') throw new Error('Escribe el valor de k.');
      onAgregar(restriccionLogica(tipo, params, names));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <details className="eb-logica">
      <summary>Condiciones lógicas</summary>
      <div className="eb-logica-cuerpo">
        <div className="eb-fila">
          <label className="inline-field">
            Tipo
            <select value={tipo} onChange={(e) => { setTipo(e.target.value); setError(''); }} aria-label="Tipo de condición lógica">
              {TIPOS_LOGICA.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          {def.usaK && (
            <label className="inline-field">
              k
              <input className="eb-in eb-in--k" inputMode="numeric" autoComplete="off" spellCheck={false} value={k} onChange={(e) => { setK(filtrar.entero(e.target.value, { max: 3 })); setError(''); }} aria-label="Valor de k" />
            </label>
          )}
        </div>
        {def.usaPar ? (
          <div className="eb-fila">
            <label className="inline-field">
              A
              <select value={Math.min(a, n - 1)} onChange={(e) => setA(Number(e.target.value))} aria-label="Variable A">
                {names.map((nm, j) => <option key={j} value={j}>{sub(nm)}</option>)}
              </select>
            </label>
            <label className="inline-field">
              B
              <select value={Math.min(b, n - 1)} onChange={(e) => setB(Number(e.target.value))} aria-label="Variable B">
                {names.map((nm, j) => <option key={j} value={j}>{sub(nm)}</option>)}
              </select>
            </label>
          </div>
        ) : (
          <fieldset className="eb-vars">
            <legend>Variables del grupo</legend>
            {names.map((nm, j) => (
              <label key={j} className="eb-check">
                <input type="checkbox" checked={sel.includes(j)} onChange={() => alternar(j)} />
                <span>{sub(nm)}</span>
              </label>
            ))}
          </fieldset>
        )}
        <div className="eb-fila">
          <button type="button" className="btn btn--sm btn--primary" onClick={agregar}>Agregar</button>
          {error && <span className="eb-error" role="alert">{error}</span>}
        </div>
      </div>
    </details>
  );
}
