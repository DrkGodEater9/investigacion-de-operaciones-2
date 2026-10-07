import { useMemo, useRef, useState, useCallback } from 'react';
import { TIPOS, TIPOS_ETIQUETA, generar, corregir, tipoDeMezcla } from '../domain/practicaMixta.js';
import { frac } from '../domain/fraction.js';
import { filtrar, propsNumero, propsEntero } from '@/shared/campos.js';
import Segmented from '@/ui/Segmented.jsx';
import StatusMark from '@/ui/StatusMark.jsx';
import Toast from '@/ui/Toast.jsx';
import { useProgress } from '@/app/ProgressContext.jsx';
import { hrefTopic } from '@/app/router.js';
import '../solver.css';
import '../practica-mixta.css';

const OPCIONES_TIPO = [
  ...TIPOS.map((t) => ({ id: t, label: TIPOS_ETIQUETA[t] })),
  { id: 'mezcla', label: 'Mezcla' },
];
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n) => String(n).replace(/\d/g, (d) => SUB[d]);
const semillaNueva = () => Math.floor(Math.random() * 9000) + 1000;
const dec = (t) => { const f = frac(t); return f.isInteger() ? f.toString() : f.toDecimal(2); };
const nombreVar = (n) => (/^x\d+$/.test(n) ? `x${sub(n.slice(1))}` : n);

function Enunciado({ ej }) {
  const e = ej.enunciado;
  if (ej.tipo === 'clasificar') {
    return <p style={{ margin: 0 }}>Tres variables de decisión de distintos problemas (abajo).</p>;
  }
  if (ej.tipo === 'ramificar') {
    return (
      <table className="mini-table">
        <thead><tr><th>Variable</th><th>Valor</th><th>Tipo</th></tr></thead>
        <tbody>
          {e.variables.map((v) => (
            <tr key={v.nombre}>
              <td><em>{nombreVar(v.nombre)}</em></td>
              <td>{v.valor}{v.valor.includes('/') ? ` (${dec(v.valor)})` : ''}</td>
              <td>{v.entera ? 'entera' : 'continua'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (ej.tipo === 'poda') {
    const n = e.nodo;
    return (
      <table className="mini-table">
        <tbody>
          <tr><th>Objetivo</th><td>{e.sentido === 'max' ? 'Maximizar' : 'Minimizar'}</td></tr>
          <tr><th>Incumbente z*</th><td>{e.incumbente === null ? 'aún no hay' : `${e.incumbente}${e.incumbente.includes('/') ? ` (${dec(e.incumbente)})` : ''}`}</td></tr>
          <tr><th>Nodo</th><td>{n.factible ? 'factible' : 'infactible'}</td></tr>
          {n.factible && <tr><th>Z del nodo</th><td>{n.z}{n.z.includes('/') ? ` (${dec(n.z)})` : ''}</td></tr>}
          {n.factible && <tr><th>Variables enteras</th><td>{n.enterasEnteras ? 'todas con valor entero' : 'alguna con valor fraccionario'}</td></tr>}
        </tbody>
      </table>
    );
  }
  if (ej.tipo === 'corte') {
    return (
      <div>
        <p style={{ margin: '0 0 6px' }}>
          Fila: <em>x</em><sub>B</sub>
          {e.noBasicas.map((v) => ` ${v.a.startsWith('-') ? '−' : '+'} (${v.a.replace('-', '')})${v.nombre}`).join('')} = {e.b}
          {e.b.includes('/') ? ` (${dec(e.b)})` : ''}
        </p>
        <table className="mini-table">
          <thead><tr><th>No básica</th><th>a</th><th>Tipo</th></tr></thead>
          <tbody>
            {e.noBasicas.map((v) => (
              <tr key={v.nombre}><td><em>{v.nombre}</em></td><td>{v.a}</td><td>{v.entera ? 'entera' : 'continua'}</td></tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: 0 }}>Tipo de corte: {e.tipoCorte}.</p>
      </div>
    );
  }
  // resolver
  const term = (a, i) => `${a === '1' ? '' : a}x${sub(i + 1)}`;
  const lin = (a) => a.map((t, i) => (t.startsWith('-') ? `− ${t === '-1' ? '' : t.slice(1)}x${sub(i + 1)}` : `${i ? '+ ' : ''}${term(t, i)}`)).join(' ');
  return (
    <div>
      <div>Maximizar <em>Z</em> = {lin(e.c)}</div>
      <div>sujeto a:</div>
      {e.restricciones.map((r, i) => <div key={i} style={{ paddingLeft: 16 }}>{lin(r.a)} ≤ {r.b}</div>)}
      <div style={{ paddingLeft: 16 }}><em>x</em>₁ ≥ 0 continua; <em>x</em>₂ ≥ 0 entera</div>
    </div>
  );
}

export default function PracticaMixta({ temaId = 'entera-mixta' }) {
  const { studied, toggle } = useProgress();
  const [modo, setModo] = useState('mezcla');
  const [semilla, setSemilla] = useState(semillaNueva);
  const [entradaSemilla, setEntradaSemilla] = useState('');
  const [resp, setResp] = useState({});
  const [resultado, setResultado] = useState(null);
  const [sesion, setSesion] = useState({ aciertos: 0, intentos: 0 });
  const [aviso, setAviso] = useState('');
  const marcado = useRef(false);
  const limpiarAviso = useCallback(() => setAviso(''), []);

  const tipo = modo === 'mezcla' ? tipoDeMezcla(semilla) : modo;
  const ej = useMemo(() => generar(tipo, semilla), [tipo, semilla]);

  const reiniciar = () => { setResp({}); setResultado(null); };
  const nuevo = (s = semillaNueva()) => { setSemilla(s); reiniciar(); };
  const cambiarModo = (m) => { setModo(m); reiniciar(); };

  const usarSemilla = (ev) => {
    ev.preventDefault();
    const s = Number(entradaSemilla.trim());
    if (!Number.isInteger(s) || s < 1 || s > 999999999) { setAviso('Escribe una semilla entera entre 1 y 999999999.'); return; }
    nuevo(s);
    setEntradaSemilla('');
  };

  const comprobar = (ev) => {
    ev.preventDefault();
    const r = corregir(ej, resp);
    setResultado(r);
    setSesion((p) => ({ aciertos: p.aciertos + (r.correcto ? 1 : 0), intentos: p.intentos + 1 }));
    if (r.correcto && !marcado.current) {
      marcado.current = true;
      if (!studied.has(temaId)) { toggle(temaId); setAviso('Tema marcado como estudiado.'); }
    }
  };

  const poner = (id, v) => setResp((p) => ({ ...p, [id]: v }));
  const porCampo = resultado ? Object.fromEntries(resultado.detalle.map((d) => [d.campo, d])) : {};

  return (
    <div className="pm">
      <div className="pm-tipos">
        <Segmented options={OPCIONES_TIPO} value={modo} onChange={cambiarModo} label="Tipo de ejercicio" />
      </div>

      <div className="pm-barra">
        <button type="button" className="btn" onClick={() => nuevo()}>Ejercicio nuevo</button>
        <form className="inline-field" onSubmit={usarSemilla}>
          <label htmlFor="pm-semilla">Repetir semilla</label>
          <input id="pm-semilla" {...propsEntero} value={entradaSemilla} onChange={(e) => setEntradaSemilla(filtrar.semilla(e.target.value))} placeholder="4821" />
          <button type="submit" className="btn btn--sm">Ir</button>
        </form>
        <span className="pm-sesion" aria-live="polite">Sesión: {sesion.aciertos} aciertos de {sesion.intentos} intentos</span>
      </div>

      <form className="pm-card" onSubmit={comprobar} noValidate>
        <div>
          <h3>{ej.titulo}</h3>
          <span className="pm-semilla">Ejercicio n.º {ej.semilla} · {TIPOS_ETIQUETA[ej.tipo]}</span>
        </div>
        <div className="pm-enunciado"><Enunciado ej={ej} /></div>
        <p style={{ margin: 0 }}>{ej.pregunta}</p>

        <div className="pm-campos">
          {ej.campos.map((c) => {
            const d = porCampo[c.id];
            return (
              <div key={c.id}>
                {c.tipo === 'opcion' ? (
                  <fieldset className="pm-campo">
                    <legend>{c.etiqueta}</legend>
                    <div className="pm-opciones">
                      {c.opciones.map((o) => (
                        <label key={o.id}>
                          <input type="radio" name={`${ej.tipo}-${ej.semilla}-${c.id}`} value={o.id} checked={resp[c.id] === o.id} onChange={() => poner(c.id, o.id)} />
                          {o.etiqueta}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : (
                  <div className="pm-campo">
                    <label htmlFor={`pm-${c.id}`}>{c.etiqueta}</label>
                    <input
                      id={`pm-${c.id}`}
                      type="text"
                      {...propsNumero}
                      inputMode={c.tipo === 'fraccion' ? 'text' : 'decimal'}

                      value={resp[c.id] ?? ''}
                      onChange={(e) => poner(c.id, filtrar.decimal(e.target.value, { negativo: true, fraccion: true }))}
                      aria-describedby={d ? `pm-res-${c.id}` : undefined}
                      aria-invalid={d ? !d.ok : undefined}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pm-acciones">
          <button type="submit" className="btn btn--primary">Corregir</button>
          {resultado && <button type="button" className="btn" onClick={reiniciar}>Intentar de nuevo</button>}
          {resultado && <button type="button" className="btn" onClick={() => nuevo()}>Siguiente</button>}
        </div>

        {resultado && (
          <div className={'pm-resultado' + (resultado.correcto ? '' : ' is-mal')} role="status">
            <h4>{resultado.correcto ? 'Correcto: todos los campos están bien.' : 'Hay campos por revisar.'}</h4>
            <ul className="pm-detalle">
              {resultado.detalle.map((d) => {
                const campo = ej.campos.find((c) => c.id === d.campo);
                return (
                  <li key={d.campo} id={`pm-res-${d.campo}`}>
                    <span aria-hidden="true"><StatusMark status={d.ok ? 'completo' : 'pendiente'} /></span>
                    <span>
                      <b>{campo.etiqueta}: {d.ok ? 'Correcto' : 'Revisa este valor'}</b>
                      {!d.ok && <> {d.mensaje.replace(/^Revisa este valor\.?\s*/, '')} Esperado: {d.esperado}.</>}
                    </span>
                  </li>
                );
              })}
            </ul>
            {resultado.errorComun && <p className="pm-error-comun" style={{ margin: 0 }}><b>Error frecuente.</b> {resultado.errorComun}</p>}
            <div>
              <b>Explicación</b>
              <ol className="pm-explicacion">{resultado.explicacion.map((t, i) => <li key={i}>{t}</li>)}</ol>
            </div>
            {!resultado.correcto && (
              <p className="pm-enlaces" style={{ margin: 0 }}>
                <span>Repasa el método:</span>
                <a href={hrefTopic(temaId, 'paso')}>Paso a paso</a>
                <a href={hrefTopic(temaId, 'resuelve')}>Resuelve el tuyo</a>
              </p>
            )}
          </div>
        )}
      </form>
      <Toast message={aviso} onDone={limpiarAviso} />
    </div>
  );
}
