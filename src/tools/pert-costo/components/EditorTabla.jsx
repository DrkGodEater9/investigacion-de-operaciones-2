import { filtrar } from '@/shared/campos.js';
import { NOTACION } from '../domain/notacion.js';

const CAMPOS = [
  { id: 'name', clase: 'pc-in--nombre', modo: 'text', filtro: (t) => filtrar.nombre(t) },
  { id: 'preds', clase: 'pc-in--preds', modo: 'text', filtro: (t) => filtrar.listaNombres(t) },
  { id: 'dn', clase: 'pc-in--num', modo: 'numeric', filtro: (t) => filtrar.entero(t) },
  { id: 'cn', clase: 'pc-in--num', modo: 'decimal', filtro: (t) => filtrar.decimal(t) },
  { id: 'dl', clase: 'pc-in--num', modo: 'numeric', filtro: (t) => filtrar.entero(t) },
  { id: 'cl', clase: 'pc-in--num', modo: 'decimal', filtro: (t) => filtrar.decimal(t) },
];

/** Tabla editable de actividades. `filasConError` = Set de índices de fila con error. */
export default function EditorTabla({ filas, acciones, filasConError }) {
  return (
    <div className="pc-editor">
      <div className="pc-tabla-caja pc-tabla-caja--editor" role="region" aria-label="Tabla de actividades" tabIndex={0}>
        <table className="pc-tabla pc-tabla--editor">
          <thead>
            <tr>
              {NOTACION.columnas.map((c) => <th key={c} scope="col">{NOTACION.nombre[c]}</th>)}
              <th scope="col"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.id} className={filasConError.has(i) ? 'is-error' : undefined}>
                {CAMPOS.map((c) => (
                  <td key={c.id}>
                    <input
                      className={'pc-in ' + c.clase}
                      value={f[c.id]}
                      inputMode={c.modo}
                      autoComplete="off"
                      spellCheck={false}
                      aria-label={`${NOTACION.nombre[c.id]}, fila ${i + 1}`}
                      aria-invalid={filasConError.has(i) || undefined}
                      placeholder={c.id === 'preds' ? '-' : undefined}
                      onChange={(e) => acciones.actualizar(f.id, c.id, c.filtro(e.target.value))}
                    />
                  </td>
                ))}
                <td className="pc-celda-acc">
                  <button type="button" className="icon-btn pc-icono" onClick={() => acciones.mover(f.id, -1)} disabled={i === 0} aria-label={`Subir la fila ${i + 1}`} title="Subir">
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 10l5-5 5 5" /></svg>
                  </button>
                  <button type="button" className="icon-btn pc-icono" onClick={() => acciones.mover(f.id, 1)} disabled={i === filas.length - 1} aria-label={`Bajar la fila ${i + 1}`} title="Bajar">
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6l5 5 5-5" /></svg>
                  </button>
                  <button type="button" className="icon-btn pc-icono" onClick={() => acciones.quitar(f.id)} disabled={filas.length <= 1} aria-label={`Quitar la fila ${i + 1}`} title="Quitar">
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pc-fila">
        <button type="button" className="btn btn--sm" onClick={acciones.agregar}>Agregar actividad</button>
        <button type="button" className="btn btn--sm" onClick={acciones.nuevo}>Tabla en blanco</button>
        <span className="pc-nota">Si una actividad no se puede acortar, deja vacías su duración límite y su costo límite.</span>
      </div>
    </div>
  );
}
