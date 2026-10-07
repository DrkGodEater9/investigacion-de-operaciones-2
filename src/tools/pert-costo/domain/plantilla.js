import { NOTACION } from './notacion.js';

const cab = NOTACION.columnas.map((c) => NOTACION.nombre[c]);

/** Texto que el estudiante copia y pega en una IA para convertir un enunciado en la tabla que lee la herramienta. */
export const PLANTILLA_IA = `Eres un asistente de investigación de operaciones. Convierte el enunciado en los datos de un problema PERT/COSTO y devuélvelo SOLO en este formato Markdown, sin explicaciones:

# Título corto del proyecto
${NOTACION.lineaIndirecto}: <número>
${NOTACION.lineaFijo}: <número, 0 si no hay>
| ${cab.join(' | ')} |
|${cab.map(() => '---').join('|')}|
| A | - | 4 | 100 | 2 | 160 |

Reglas:
- Una fila por actividad. En ${NOTACION.nombre.preds} pon los nombres separados por comas, o "-" si no tiene.
- ${NOTACION.nombre.dn} y ${NOTACION.nombre.dl} deben ser números enteros (si el enunciado trae decimales, cambia la unidad de tiempo, por ejemplo de semanas a días).
- ${NOTACION.nombre.cn} y ${NOTACION.nombre.cl} son el costo con la duración normal y con la duración límite (acelerada).
- Si una actividad no se puede acortar, deja vacías (o escribe "-") su duración límite y su costo límite.
- Usa punto o coma para los decimales y no uses separadores de miles.
Enunciado: <pega aquí el enunciado>`;
