import { useMemo, useState } from 'react';
import { nodosAzar, nodosLigados, conProbabilidad } from '../domain/sensibilidad.js';
import { evaluar, estrategiaTexto } from '../domain/evaluar.js';
import { fmtNum } from '../domain/format.js';
import GraficaSensibilidad from './GraficaSensibilidad.jsx';

/** Selecciona un nodo de azar y una de sus ramas; muestra el barrido de su probabilidad. */
export default function Sensibilidad({ arbol, sel, onSel, ligar, onLigar, sens, unidad, svgRef }) {
  const nodos = useMemo(() => nodosAzar(arbol), [arbol]);
  const [pLibre, setPLibre] = useState(null);

  const nodo = nodos.find((n) => n.id === sel.nodoId) || nodos[0];
  const rama = nodo ? Math.min(sel.rama, nodo.ramas.length - 1) : 0;
  const p0 = nodo ? nodo.ramas[rama].p : 0;
  const p = pLibre ?? p0;
  const ligados = useMemo(() => (nodo ? nodosLigados(arbol, nodo.id) : []), [arbol, nodo]);
  const juntos = ligar && ligados.length > 1 ? ligados : [];
  const ev = useMemo(() => (nodo ? evaluar(conProbabilidad(arbol, nodo.id, rama, p, juntos)) : null), [arbol, nodo, rama, p, juntos]);

  if (!nodo) {
    return <p className="ad-nota">El árbol no tiene nodos de azar: no hay probabilidades que variar.</p>;
  }

  return (
    <div className="ad-sens" data-testid="sensibilidad">
      <p className="ad-nota">
        Se hace variar la probabilidad de una rama entre 0 y 1; las otras ramas del mismo nodo se reparten lo que queda en la misma proporción que tenían.
      </p>
      <div className="ad-fila">
        <label className="inline-field">
          Nodo de azar
          <select value={nodo.id} aria-label="Nodo de azar" onChange={(e) => { onSel({ nodoId: e.target.value, rama: 0 }); setPLibre(null); }}>
            {nodos.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
          </select>
        </label>
        <label className="inline-field">
          Rama
          <select value={rama} aria-label="Rama cuya probabilidad varía" onChange={(e) => { onSel({ nodoId: nodo.id, rama: Number(e.target.value) }); setPLibre(null); }}>
            {nodo.ramas.map((r, i) => <option key={i} value={i}>{r.etiqueta} (p = {fmtNum(r.p)})</option>)}
          </select>
        </label>
      </div>

      {ligados.length > 1 && (
        <label className="ad-check">
          <input type="checkbox" checked={ligar} onChange={(e) => onLigar(e.target.checked)} />
          <span>Variar juntos los {ligados.length} nodos «{nodo.nombre}» (es el mismo evento y tienen las mismas probabilidades)</span>
        </label>
      )}

      {sens && (
        <>
          <div className="ad-figura" data-testid="grafica-sens">
            <div className="ad-scroll">
              <GraficaSensibilidad ref={svgRef} datos={sens} p={p} unidad={unidad} />
            </div>
          </div>
          <p className="ad-leyenda">Azul: valor óptimo del árbol. Negro: valor de cada alternativa de la primera decisión. Rojo: donde cambia la decisión.</p>

          {sens.cortes.length === 0 ? (
            <p className="ad-aviso" role="note">
              La decisión óptima no cambia aunque la probabilidad de «{sens.etiqueta}» tome cualquier valor entre 0 y 1: {sens.tramos[0].estrategia}.
            </p>
          ) : (
            <div className="ad-aviso" role="note" data-testid="indiferencia">
              {sens.cortes.map((c, i) => (
                <p key={i}>
                  Punto de indiferencia: p* = <strong>{fmtNum(c.p, 4)}</strong> (valor {fmtNum(c.valor)}). Con p menor conviene {c.antes}; con p mayor, {c.despues}.
                </p>
              ))}
            </div>
          )}

          <div className="ad-scroll">
            <table className="ad-tabla ad-tabla--izq">
              <thead><tr><th>Desde p</th><th>Hasta p</th><th>Estrategia óptima</th></tr></thead>
              <tbody>
                {sens.tramos.map((t, i) => (
                  <tr key={i}><td>{fmtNum(t.desde, 4)}</td><td>{fmtNum(t.hasta, 4)}</td><td>{t.estrategia}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ad-quesi">
            <label className="ad-quesi-fila">
              <span>¿Y si p fuera <strong>{fmtNum(p, 2)}</strong>?</span>
              <input type="range" min="0" max="1" step="0.01" value={p} aria-label="Valor de p para probar" onChange={(e) => setPLibre(Number(e.target.value))} />
            </label>
            <p className="ad-nota">
              Con p = {fmtNum(p, 2)} el árbol vale <strong>{fmtNum(ev.valor)}</strong>. {estrategiaTexto(ev).join(' ')}
              {pLibre !== null && <> <button type="button" className="btn btn--sm btn--ghost" onClick={() => setPLibre(null)}>Volver a p = {fmtNum(p0)}</button></>}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
