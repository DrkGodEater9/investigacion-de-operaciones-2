/** Texto de una opción: en 'modelar' son objetos { texto }, en los demás tipos cadenas. */
const textoOpcion = (o) => (o && typeof o === 'object' ? o.texto : o);

/** Interpreta un campo numérico: acepta punto o coma decimal; null si no es un número. */
export function parseNumero(t) {
  const s = String(t ?? '').trim().replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** ¿La respuesta guardada se puede revisar? */
export function respuestaLista(entrada, resp) {
  if (entrada.tipo === 'opcion') return Number.isInteger(resp);
  if (entrada.tipo === 'multi') return Array.isArray(resp) && resp.length > 0;
  return parseNumero(resp) !== null;
}

/** Convierte la respuesta de pantalla a la que espera corregir(). */
export function respuestaParaCorregir(entrada, resp) {
  return entrada.tipo === 'numero' ? parseNumero(resp) : resp;
}

export default function ControlRespuesta({ ej, resp, onChange, bloqueado }) {
  const { entrada } = ej;
  const nombre = `eb-${ej.id}`;

  if (entrada.tipo === 'numero') {
    const invalido = resp !== undefined && resp !== '' && parseNumero(resp) === null;
    return (
      <div className="pb-campo">
        <label htmlFor={`${nombre}-n`}>Tu respuesta (número)</label>
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
        {invalido && <span id={`${nombre}-ayuda`} className="pb-ayuda">Escribe un número, por ejemplo 12 o 12,5.</span>}
      </div>
    );
  }

  if (entrada.tipo === 'multi') {
    const marcadas = Array.isArray(resp) ? resp : [];
    const alternar = (i) => onChange(marcadas.includes(i) ? marcadas.filter((k) => k !== i) : [...marcadas, i].sort((a, b) => a - b));
    return (
      <fieldset className="pb-campo">
        <legend>Marca todas las que apliquen</legend>
        <div className="pb-opciones pb-opciones--filas">
          {entrada.opciones.map((o, i) => (
            <label key={i}>
              <input type="checkbox" checked={marcadas.includes(i)} disabled={bloqueado} onChange={() => alternar(i)} />
              <span className="pb-bits">{textoOpcion(o)}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <fieldset className="pb-campo">
      <legend>Elige una opción</legend>
      <div className="pb-opciones">
        {entrada.opciones.map((o, i) => (
          <label key={i}>
            <input type="radio" name={nombre} checked={resp === i} disabled={bloqueado} onChange={() => onChange(i)} />
            <span className={ej.tipo === 'optimo' ? 'pb-bits' : undefined}>{textoOpcion(o)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
