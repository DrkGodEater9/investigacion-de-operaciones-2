import { useMemo } from 'react';
import { filtrar, propsNumero } from '@/shared/campos.js';
import Segmented from '@/ui/Segmented.jsx';
import { parseProb, fmtNum } from '../domain/format.js';
import { NOTACION } from '../domain/notacion.js';

const TIPOS = [
  { id: 'decision', label: NOTACION.decision },
  { id: 'azar', label: NOTACION.azar },
  { id: 'final', label: 'Final' },
];
const TIPOS_RAIZ = TIPOS.filter((t) => t.id !== 'final');

/** Suma de las probabilidades escritas (null si alguna no es un número). */
function sumaP(nodo) {
  let s = 0;
  for (const r of nodo.ramas) {
    const p = parseProb(r.p);
    if (p === null) return null;
    s += p;
  }
  return s;
}

function Rama({ nodo, rama, i, acc, marca, puedeQuitar, nivel }) {
  const clave = (campo) => marca.has(`${nodo.id}:${campo}:${rama.etiqueta.trim() || `Rama ${i + 1}`}`);
  return (
    <li className="ad-rama">
      <div className="ad-rama-fila">
        <input
          className="ad-in ad-in--etiqueta"
          value={rama.etiqueta}
          placeholder="Nombre de la rama"
          autoComplete="off"
          spellCheck={false}
          aria-label={`Nombre de la rama ${i + 1} de «${nodo.nombre || nodo.id}»`}
          onChange={(e) => acc.setRama(nodo.id, i, { etiqueta: filtrar.texto1(e.target.value, { max: 40 }) })}
        />
        {nodo.tipo === 'azar' && (
          <label className="ad-campo">
            <span>p</span>
            <input
              className="ad-in ad-in--num"
              {...propsNumero}
              value={rama.p ?? ''}
              placeholder="0,5"
              aria-label={`Probabilidad de la rama «${rama.etiqueta || i + 1}»`}
              aria-invalid={clave('p') || undefined}
              onChange={(e) => acc.setRama(nodo.id, i, { p: filtrar.porcentaje(e.target.value, { fraccion: true }) })}
            />
          </label>
        )}
        <label className="ad-campo">
          <span>{NOTACION.pago}</span>
          <input
            className="ad-in ad-in--num"
            {...propsNumero}
            value={rama.pago ?? ''}
            placeholder="0"
            aria-label={`Pago de la rama «${rama.etiqueta || i + 1}»`}
            aria-invalid={clave('pago') || undefined}
            onChange={(e) => acc.setRama(nodo.id, i, { pago: filtrar.decimal(e.target.value, { negativo: true, fraccion: true }) })}
          />
        </label>
        <button type="button" className="btn btn--sm ad-quitar" disabled={!puedeQuitar} onClick={() => acc.quitarRama(nodo.id, i)} aria-label={`Quitar la rama «${rama.etiqueta || i + 1}»`} title="Quitar la rama">
          Quitar
        </button>
      </div>
      <Nodo nodo={rama.hijo} acc={acc} marca={marca} nivel={nivel + 1} />
    </li>
  );
}

function Nodo({ nodo, acc, marca, nivel, raiz = false }) {
  const suma = nodo.tipo === 'azar' ? sumaP(nodo) : null;
  const sumaOk = suma !== null && Math.abs(suma - 1) <= 1e-6;
  const conError = marca.has(`${nodo.id}:*`);

  if (nodo.tipo === 'final') {
    return (
      <div className={'ad-nodo ad-nodo--final' + (conError ? ' is-error' : '')}>
        <Segmented size="sm" label="Tipo de nodo" value="final" onChange={(t) => acc.cambiarTipo(nodo.id, t)} options={TIPOS} />
        <label className="ad-campo">
          <span>Resultado final</span>
          <input
            className="ad-in ad-in--num"
            {...propsNumero}
            value={nodo.valor ?? ''}
            placeholder="valor"
            aria-label="Valor del resultado final"
            aria-invalid={marca.has(`${nodo.id}:valor`) || undefined}
            onChange={(e) => acc.setNodo(nodo.id, { valor: filtrar.decimal(e.target.value, { negativo: true, fraccion: true }) })}
          />
        </label>
      </div>
    );
  }

  return (
    <div className={'ad-nodo ad-nodo--' + nodo.tipo + (conError ? ' is-error' : '')}>
      <div className="ad-nodo-cab">
        <Segmented size="sm" label="Tipo de nodo" value={nodo.tipo} onChange={(t) => acc.cambiarTipo(nodo.id, t)} options={raiz ? TIPOS_RAIZ : TIPOS} />
        <input
          className="ad-in ad-in--nombre"
          value={nodo.nombre ?? ''}
          placeholder={nodo.tipo === 'decision' ? 'Nombre de la decisión' : 'Nombre del evento'}
          aria-label="Nombre del nodo"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => acc.setNodo(nodo.id, { nombre: filtrar.texto1(e.target.value, { max: 40 }) })}
        />
      </div>
      <ul className="ad-ramas">
        {nodo.ramas.map((r, i) => (
          <Rama key={i} nodo={nodo} rama={r} i={i} acc={acc} marca={marca} puedeQuitar={nodo.ramas.length > 1} nivel={nivel} />
        ))}
      </ul>
      <div className="ad-nodo-pie">
        <button type="button" className="btn btn--sm" onClick={() => acc.agregarRama(nodo.id)}>Agregar rama</button>
        {nodo.tipo === 'azar' && (
          <>
            <button type="button" className="btn btn--sm" onClick={() => acc.repartir(nodo.id)}>Repartir p por igual</button>
            <button type="button" className="btn btn--sm" onClick={() => acc.completar(nodo.id)} disabled={nodo.ramas.length < 2}>Completar la última</button>
            <span className={'ad-suma' + (suma === null || sumaOk ? '' : ' is-mal')} aria-live="polite">
              Suma de p: {suma === null ? '—' : fmtNum(suma)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/** Editor del árbol: bloques anidados (decisión, azar y resultados finales) que se ven bien en celular. */
export default function EditorArbol({ draft, acc, errores }) {
  const marca = useMemo(() => {
    const s = new Set();
    for (const e of errores || []) {
      if (!e.nodoId) continue;
      s.add(`${e.nodoId}:*`);
      const ultima = e.ruta ? e.ruta.split(' › ').pop() : '';
      s.add(`${e.nodoId}:${e.campo}:${ultima}`);
      s.add(`${e.nodoId}:${e.campo}`);
    }
    return s;
  }, [errores]);
  return (
    <div className="ad-editor" data-testid="editor-arbol">
      <Nodo nodo={draft.raiz} acc={acc} marca={marca} nivel={0} raiz />
    </div>
  );
}
