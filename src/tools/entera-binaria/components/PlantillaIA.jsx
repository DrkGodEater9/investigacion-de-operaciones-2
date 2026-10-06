import { copyText } from '@/shared/files.js';

export const PLANTILLA_IA = `Eres un asistente de investigación de operaciones. Convierte el enunciado en un modelo de programación entera binaria (todas las variables valen 0 o 1) y devuélvelo SOLO como una tabla en Markdown con este formato:
- Encabezado: | Restricción | x1 | x2 | ... | Signo | b |
- Primera fila: la función objetivo; en la primera celda escribe "max" o "min" y deja Signo y b vacíos.
- Una fila por restricción: nombre, coeficientes (0 si la variable no aparece), signo (<=, >= o =) y el valor de b.
- Usa punto o coma para decimales y no uses separadores de miles.
Después de la tabla escribe, en una línea, qué significa cada variable.
Enunciado: <pega aquí el enunciado>`;

export default function PlantillaIA({ notify }) {
  const copiar = async () => notify((await copyText(PLANTILLA_IA)) ? 'Plantilla copiada al portapapeles' : 'El navegador no permitió copiar.');
  return (
    <div className="eb-bloque">
      <p className="eb-nota">
        Copia este texto, pégalo en una inteligencia artificial (ChatGPT, Claude, etc.) y reemplaza el final por tu enunciado.
        Pega su tabla en el modo «Markdown» y el modelo se cargará solo.
      </p>
      <div className="eb-codigo">
        <div className="eb-codigo-cab">
          <span>Plantilla para IA</span>
          <button type="button" className="btn btn--sm btn--primary" onClick={copiar}>Copiar</button>
        </div>
        <pre className="eb-pre" data-testid="plantilla-ia">{PLANTILLA_IA}</pre>
      </div>
    </div>
  );
}
