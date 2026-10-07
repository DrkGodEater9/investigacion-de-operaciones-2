import { useState } from 'react';
import { MAX_ALT, MAX_EST, MAX_IND } from '../domain/bayes.js';
import { leerNumero } from '../domain/entrada.js';
import { fmtNum } from '../domain/formato.js';
import { etiqueta, filtrar, probabilidad, propsNumero } from '@/shared/campos.js';

const NOMBRE = { max: 40 };

/** Suma de una fila de probabilidades escritas como texto; null si alguna no se puede leer. */
function sumaTexto(fila) {
  let s = 0;
  for (const t of fila) {
    const r = leerNumero(t, true);
    if (r.error) return null;
    s += r.valor;
  }
  return s;
}

function Suma({ valor }) {
  if (valor === null) return <td className="bz-celda-nota">—</td>;
  const ok = Math.abs(valor - 1) < 1e-9;
  return <td className={ok ? undefined : 'is-mal'}>{fmtNum(Math.round(valor * 1e6) / 1e6)}</td>;
}

/** Tablas editables del problema. Todo el estado vive en useSolver; aquí solo se muestra. */
export default function EditorProblema({ draft, acciones: a }) {
  const m = draft.alts.length;
  const n = draft.estados.length;
  const K = draft.inds.length;
  const [fia, setFia] = useState('0,8');
  const aplicarFia = () => {
    const r = leerNumero(fia, true);
    if (!r.error && r.valor > 0 && r.valor < 1) a.fiabilidad(r.valor);
  };
  const fiaValida = (() => { const r = leerNumero(fia, true); return !r.error && r.valor > 0 && r.valor < 1; })();

  return (
    <div className="bz-bloque">
      <div className="bz-fila">
        <label className="inline-field">
          Los pagos son
          <select className="bz-sel" value={draft.objetivo} onChange={(e) => a.setObjetivo(e.target.value)} aria-label="Tipo de pagos">
            <option value="max">Utilidades (se maximiza)</option>
            <option value="min">Costos (se minimiza)</option>
          </select>
        </label>
      </div>

      <h4 className="bz-titulo-tabla">Matriz de pagos y probabilidades a priori</h4>
      <div className="bz-scroll">
        <table className="bz-tabla bz-tabla--editor">
          <thead>
            <tr>
              <th scope="col">Alternativa</th>
              {draft.estados.map((e, j) => (
                <th scope="col" key={j}>
                  <input className="bz-in bz-in--nombre" value={e} autoComplete="off" spellCheck={false} aria-label={`Nombre del estado ${j + 1}`} onChange={(ev) => a.setEstado(j, etiqueta(ev.target.value, NOMBRE))} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.alts.map((alt, i) => (
              <tr key={i}>
                <td>
                  <input className="bz-in bz-in--fila" value={alt} autoComplete="off" spellCheck={false} aria-label={`Nombre de la alternativa ${i + 1}`} onChange={(ev) => a.setAlt(i, etiqueta(ev.target.value, NOMBRE))} />
                </td>
                {draft.pagos[i].map((v, j) => (
                  <td key={j}>
                    <input className="bz-in bz-in--num" {...propsNumero} value={v} placeholder="0" aria-label={`Pago de ${alt || 'alternativa ' + (i + 1)} con ${draft.estados[j] || 'estado ' + (j + 1)}`} onChange={(ev) => a.setPago(i, j, filtrar.decimal(ev.target.value, { negativo: true }))} />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="is-total">
              <td className="bz-celda-nota">Prob. a priori</td>
              {draft.priori.map((v, j) => (
                <td key={j}>
                  <input className="bz-in bz-in--num" {...propsNumero} value={v} placeholder="0,5" aria-label={`Probabilidad a priori de ${draft.estados[j] || 'estado ' + (j + 1)}`} onChange={(ev) => a.setPriori(j, probabilidad(ev.target.value))} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="bz-fila">
        <button type="button" className="btn btn--sm" onClick={a.agregarAlt} disabled={m >= MAX_ALT}>Agregar alternativa</button>
        <button type="button" className="btn btn--sm" onClick={a.quitarAlt} disabled={m <= 2}>Quitar alternativa</button>
        <button type="button" className="btn btn--sm" onClick={a.agregarEstado} disabled={n >= MAX_EST}>Agregar estado</button>
        <button type="button" className="btn btn--sm" onClick={a.quitarEstado} disabled={n <= 2}>Quitar estado</button>
        <span className="bz-nota" data-testid="suma-priori">
          Suma de las a priori: {sumaTexto(draft.priori) === null ? '—' : fmtNum(Math.round(sumaTexto(draft.priori) * 1e6) / 1e6)} (debe ser 1)
        </span>
      </div>

      <label className="bz-check">
        <input type="checkbox" checked={draft.conInfo} onChange={(e) => a.setConInfo(e.target.checked)} />
        Tengo información muestral (estudio, prueba o encuesta)
      </label>

      {draft.conInfo && (
        <>
          <h4 className="bz-titulo-tabla">Verosimilitud P(resultado | estado)</h4>
          <div className="bz-scroll">
            <table className="bz-tabla bz-tabla--editor">
              <thead>
                <tr>
                  <th scope="col">Estado</th>
                  {draft.inds.map((z, k) => (
                    <th scope="col" key={k}>
                      <input className="bz-in bz-in--nombre" value={z} autoComplete="off" spellCheck={false} aria-label={`Nombre del resultado ${k + 1} del indicador`} onChange={(ev) => a.setInd(k, etiqueta(ev.target.value, NOMBRE))} />
                    </th>
                  ))}
                  <th scope="col">Suma</th>
                </tr>
              </thead>
              <tbody>
                {draft.estados.map((e, j) => (
                  <tr key={j}>
                    <td className="bz-celda-nota" style={{ textAlign: 'left' }}>{e || `Estado ${j + 1}`}</td>
                    {draft.lik[j].map((v, k) => (
                      <td key={k}>
                        <input className="bz-in bz-in--num" {...propsNumero} value={v} placeholder="0" aria-label={`Probabilidad de ${draft.inds[k] || 'resultado ' + (k + 1)} si el estado es ${e || j + 1}`} onChange={(ev) => a.setLik(j, k, probabilidad(ev.target.value))} />
                      </td>
                    ))}
                    <Suma valor={sumaTexto(draft.lik[j])} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bz-fila">
            <button type="button" className="btn btn--sm" onClick={a.agregarInd} disabled={K >= MAX_IND}>Agregar resultado</button>
            <button type="button" className="btn btn--sm" onClick={a.quitarInd} disabled={K <= 2}>Quitar resultado</button>
            <label className="inline-field">
              Fiabilidad
              <input className="bz-in bz-in--fia" {...propsNumero} value={fia} onChange={(e) => setFia(probabilidad(e.target.value))} aria-label="Fiabilidad del indicador" />
            </label>
            <button type="button" className="btn btn--sm" onClick={aplicarFia} disabled={!fiaValida}>Llenar con fiabilidad</button>
          </div>
          <p className="bz-nota">
            La fiabilidad r llena la tabla suponiendo que el resultado «correcto» de cada estado (el de su misma columna) sale con probabilidad r y el resto se reparte en partes iguales. Puedes corregir cualquier celda después.
          </p>
        </>
      )}
    </div>
  );
}
