import { fmtNum } from '../domain/formato.js';
import { tablaVerosimilitud } from '../domain/tablas.js';
import TablaDatos from './TablaDatos.jsx';

/** Interpreta un campo numérico: acepta punto o coma decimal y «−»; null si no es un número. */
export function parseNumero(t) {
  const s = String(t ?? '').trim().replace(/−/g, '-').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** ¿La respuesta guardada se puede revisar? */
export function respuestaLista(entrada, resp) {
  if (entrada.tipo === 'opcion') return Number.isInteger(resp);
  return parseNumero(resp) !== null;
}

/** Convierte la respuesta de pantalla a la que espera corregir(). */
export function respuestaParaCorregir(entrada, resp) {
  return entrada.tipo === 'numero' ? parseNumero(resp) : resp;
}

function ControlRespuesta({ ej, resp, onChange, bloqueado }) {
  const { entrada } = ej;
  const nombre = `bz-${ej.id}`;
  if (entrada.tipo === 'numero') {
    const invalido = resp !== undefined && resp !== '' && parseNumero(resp) === null;
    return (
      <div className="bz-pr-campo">
        <label htmlFor={`${nombre}-n`}>Tu respuesta (número{entrada.unidad === '%' ? ', en porcentaje' : entrada.unidad === 'probabilidad' ? ', decimal' : ''})</label>
        <input
          id={`${nombre}-n`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={resp ?? ''}
          disabled={bloqueado}
          aria-invalid={invalido || undefined}
          aria-describedby={invalido ? `${nombre}-ayuda` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {invalido && <span id={`${nombre}-ayuda`} className="bz-pr-ayuda">Escribe un número, por ejemplo 12 o 12,5.</span>}
      </div>
    );
  }
  return (
    <fieldset className="bz-pr-campo">
      <legend>Elige una opción</legend>
      <div className="bz-pr-opciones">
        {entrada.opciones.map((o, i) => (
          <label key={i}>
            <input type="radio" name={nombre} checked={resp === i} disabled={bloqueado} onChange={() => onChange(i)} />
            <span>{o}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Datos del ejercicio como tablas: pagos con la fila a priori y, si hay, la verosimilitud. */
export function DatosEjercicio({ problema: p }) {
  const pagos = {
    id: 'datos-pagos',
    titulo: 'Pagos y probabilidades a priori',
    headers: ['Alternativa', ...p.estados],
    rows: [...p.alternativas.map((alt, i) => [alt, ...p.pagos[i].map(fmtNum)]), ['Prob. a priori', ...p.priori.map(fmtNum)]],
    resaltar: [],
    totales: 1,
  };
  return (
    <>
      <TablaDatos tabla={pagos} />
      {p.indicadores && <TablaDatos tabla={{ ...tablaVerosimilitud(p), id: 'datos-verosimilitud' }} />}
    </>
  );
}

/** Tarjeta del ejercicio: título, enunciado, tablas, pregunta y control de respuesta. */
export default function Ejercicio({ ej, etiqueta, resp, onChange, bloqueado, onRevisar, puedeRevisar, children }) {
  return (
    <form className="bz-pr-card" onSubmit={(ev) => { ev.preventDefault(); if (puedeRevisar && !bloqueado) onRevisar(); }} noValidate>
      <div>
        <h3>{ej.titulo}</h3>
        <span className="bz-pr-semilla">Ejercicio #{ej.seed} · {etiqueta}</span>
      </div>
      <p className="bz-pr-enunciado">{ej.enunciado}</p>
      <DatosEjercicio problema={ej.problema} />
      <p className="bz-pr-pregunta">{ej.pregunta}</p>
      <ControlRespuesta ej={ej} resp={resp} onChange={onChange} bloqueado={bloqueado} />
      {children}
    </form>
  );
}
