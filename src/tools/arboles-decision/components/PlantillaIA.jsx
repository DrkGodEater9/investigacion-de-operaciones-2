import { copyText } from '@/shared/files.js';

export const PLANTILLA_IA = `Eres un asistente de investigación de operaciones. Convierte el enunciado en un árbol de decisión y devuélvelo SOLO como una lista indentada en Markdown con este formato:
- Primera línea: "objetivo: max" (si se maximiza utilidad o ganancia) o "objetivo: min" (si se minimiza costo). Opcional: una línea "unidad: millones de pesos".
- Cada nodo en su propia línea: "[D] nombre" para un nodo de decisión (cuadrado) y "[A] nombre" para un nodo de azar (círculo). Solo hay un nodo raíz.
- Cada rama que sale de un nodo va en una línea con más sangría (2 espacios), que empieza por "- " y tiene sus campos separados por "|": nombre de la rama | p 0,6 (solo en las ramas de un nodo de azar; probabilidad entre 0 y 1) | pago -120 (opcional: lo que cuesta o deja esa rama; 0 si no se escribe).
- Si la rama termina ahí, agrega al final "| valor 300" (el resultado final, en la misma unidad). Si la rama llega a otro nodo, deja el nodo en la línea siguiente con más sangría y no escribas valor.
- Las probabilidades de las ramas de un nodo de azar deben sumar 1. Usa coma o punto decimal y no uses separadores de miles.
Ejemplo:
objetivo: max
- [D] Tamaño de la planta
  - Grande | pago -120
    - [A] Demanda
      - Alta | p 0,6 | valor 300
      - Baja | p 0,4 | valor 60
  - No construir | valor 0
Después del árbol escribe, en una línea, qué unidad usaste.
Enunciado: <pega aquí el enunciado>`;

export default function PlantillaIA({ notify }) {
  const copiar = async () => notify((await copyText(PLANTILLA_IA)) ? 'Plantilla copiada al portapapeles' : 'El navegador no permitió copiar.');
  return (
    <div className="ad-bloque">
      <p className="ad-nota">
        Copia este texto, pégalo en una inteligencia artificial (ChatGPT, Claude, etc.) y reemplaza el final por tu enunciado.
        Pega su respuesta en el modo «Texto» y el árbol se cargará solo.
      </p>
      <div className="ad-codigo">
        <div className="ad-codigo-cab">
          <span>Plantilla para IA</span>
          <button type="button" className="btn btn--sm btn--primary" onClick={copiar}>Copiar</button>
        </div>
        <pre className="ad-pre" data-testid="plantilla-ia">{PLANTILLA_IA}</pre>
      </div>
    </div>
  );
}
