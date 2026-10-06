import { objetivoTexto, restriccionTexto, sub } from '../domain/format.js';
import ControlRespuesta from './ControlRespuesta.jsx';

/** Tarjeta del ejercicio: título, enunciado, modelo matemático, pregunta y control. */
export default function Ejercicio({ ej, etiqueta, resp, onChange, bloqueado, onRevisar, puedeRevisar, children }) {
  const m = ej.modelo;
  return (
    <form className="pb-card" onSubmit={(ev) => { ev.preventDefault(); if (puedeRevisar && !bloqueado) onRevisar(); }} noValidate>
      <div>
        <h3>{ej.titulo}</h3>
        <span className="pb-semilla">Ejercicio #{ej.seed} · {etiqueta}</span>
      </div>
      <p className="pb-enunciado">{ej.enunciado}</p>
      {m && (
        <div className="pb-modelo" role="group" aria-label="Modelo">
          <div>{objetivoTexto(m)}</div>
          <div>sujeto a:</div>
          {m.constraints.map((_, i) => <div key={i} className="pb-rest">{restriccionTexto(m, i)}</div>)}
          <div className="pb-rest">{m.names.map(sub).join(', ')} ∈ {'{0, 1}'}</div>
        </div>
      )}
      <p className="pb-pregunta">{ej.pregunta}</p>
      <ControlRespuesta ej={ej} resp={resp} onChange={onChange} bloqueado={bloqueado} />
      {children}
    </form>
  );
}
