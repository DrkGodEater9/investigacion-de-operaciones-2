/** Texto que se copia para pedirle a una IA el problema en el formato de entrada (ver entrada.js). */
export const PLANTILLA_IA = `Eres un asistente de investigación de operaciones. Convierte el enunciado en un problema de decisión bayesiana y devuélvelo SOLO como tablas en Markdown con este formato exacto:

Objetivo: maximizar   (si los pagos son utilidades) o   Objetivo: minimizar   (si los pagos son costos)
| Alternativa | <estado 1> | <estado 2> | ... |
|---|---|---|---|
| <alternativa 1> | pago | pago | ... |
| <alternativa 2> | pago | pago | ... |
| Prob. a priori | p1 | p2 | ... |

Si el enunciado trae información muestral (estudio, prueba, encuesta), agrega una segunda tabla, separada por una línea en blanco, con la verosimilitud P(resultado | estado): una fila por estado, en el mismo orden, y cada fila debe sumar 1:
| Estado | <resultado 1> | <resultado 2> | ... |
|---|---|---|---|
| <estado 1> | P(r1 dado e1) | P(r2 dado e1) | ... |
| <estado 2> | P(r1 dado e2) | P(r2 dado e2) | ... |

Reglas: la última fila de la primera tabla se llama «Prob. a priori» y sus valores suman 1; usa coma o punto para decimales y no uses separadores de miles; los nombres no deben repetirse ni llevar el símbolo |. Después de las tablas escribe una línea con las unidades de los pagos.
Enunciado: <pega aquí el enunciado>`;
