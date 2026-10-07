import { copyText } from '@/shared/files.js';

export const PLANTILLA_IA = `Eres un asistente de investigación de operaciones. Convierte el enunciado en la tabla de un proyecto con recursos y devuélvelo SOLO como una tabla en Markdown con este formato:
- Encabezado: | Actividad | Duración | Predecesoras | <recurso 1> | <recurso 2> | ... |  (una columna por tipo de recurso, con su nombre).
- Una fila por actividad: nombre, duración en períodos (entero), predecesoras separadas por coma ("-" si no tiene) y, en cada columna de recurso, las unidades que la actividad usa en CADA período que dura (entero; 0 si no lo usa).
- Última fila: en la primera celda escribe "Límite" y, en cada columna de recurso, las unidades disponibles por período.
- Usa períodos enteros: si el enunciado trae otras unidades, conviértelas (por ejemplo, días a semanas) y dilo en una línea aparte.
Después de la tabla escribe, en una línea, la unidad de cada recurso.
Enunciado: <pega aquí el enunciado>`;

export default function PlantillaIA({ notify }) {
  const copiar = async () => notify((await copyText(PLANTILLA_IA)) ? 'Plantilla copiada al portapapeles' : 'El navegador no permitió copiar.');
  return (
    <div className="rc-bloque">
      <p className="rc-nota">
        Copia este texto, pégalo en una inteligencia artificial (ChatGPT, Claude, etc.) y reemplaza el final por tu enunciado.
        Pega su tabla en el modo «Markdown» y el proyecto se cargará solo.
      </p>
      <div className="rc-codigo">
        <div className="rc-codigo-cab">
          <span>Plantilla para IA</span>
          <button type="button" className="btn btn--sm btn--primary" onClick={copiar}>Copiar</button>
        </div>
        <pre className="rc-pre" data-testid="plantilla-ia">{PLANTILLA_IA}</pre>
      </div>
    </div>
  );
}
