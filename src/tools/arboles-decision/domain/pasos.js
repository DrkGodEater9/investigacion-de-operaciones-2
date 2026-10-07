/**
 * Pasos de la inducción hacia atrás para la pestaña «Paso a paso».
 * Cada paso: { titulo, texto, calculo: string[], estado: { resueltos: string[], actual: string|null, final: boolean } }.
 * El dibujo muestra el valor de los nodos que están en `resueltos` y tacha las ramas descartadas de esas decisiones.
 */
import { evaluar, estrategiaTexto } from './evaluar.js';
import { fmtNum } from './format.js';
import { NOTACION } from './notacion.js';
import { listaNodos } from './arbol.js';

export function pasosInduccion(arbol, evPrevia) {
  const ev = evPrevia || evaluar(arbol);
  const maximiza = arbol.sense === 'max';
  const nodos = Object.fromEntries(listaNodos(arbol).map((n) => [n.id, n]));
  const pasos = [];
  const nDec = Object.values(nodos).filter((n) => n.tipo === 'decision').length;
  const nAzar = Object.values(nodos).filter((n) => n.tipo === 'azar').length;
  const nHojas = Object.values(nodos).filter((n) => n.tipo === 'final').length;

  pasos.push({
    titulo: 'El árbol planteado',
    texto: `El árbol tiene ${nDec} nodo${nDec === 1 ? '' : 's'} de decisión (${nDec === 1 ? 'cuadrado' : 'cuadrados'}), ${nAzar} de azar (${nAzar === 1 ? 'círculo' : 'círculos'}) y ${nHojas} resultado${nHojas === 1 ? '' : 's'} final${nHojas === 1 ? '' : 'es'}. `
      + `Se lee de izquierda a derecha para entender la situación y se resuelve de derecha a izquierda: primero los nodos que están justo antes de los resultados.`
      + ` Objetivo: ${maximiza ? NOTACION.max : NOTACION.min}.`,
    calculo: [
      `Valor de una rama = ${NOTACION.pago} de la rama + valor del nodo al que llega.`,
      `Nodo de azar: ${NOTACION.valorEsperado} = suma de (probabilidad × valor de la rama).`,
      `Nodo de decisión: se elige la rama con el ${maximiza ? 'mayor' : 'menor'} valor.`,
    ],
    estado: { resueltos: [], actual: null, final: false },
  });

  const hechos = [];
  ev.orden.forEach((id, k) => {
    const n = nodos[id];
    const info = ev.porNodo[id];
    hechos.push(id);
    const esAzar = n.tipo === 'azar';
    pasos.push({
      titulo: esAzar ? `Nodo de azar «${n.nombre}»: valor esperado` : `Nodo de decisión «${n.nombre}»: mejor rama`,
      texto: esAzar
        ? `Se pondera el valor de cada rama por su probabilidad y se suman los resultados. Este nodo vale ${fmtNum(info.valor)}.`
        : `Se calcula el valor de cada rama y se elige la ${maximiza ? 'mayor' : 'menor'}; las otras se descartan (doble raya). Este nodo vale ${fmtNum(info.valor)}.`,
      calculo: info.lineas,
      estado: { resueltos: hechos.slice(), actual: id, final: false, orden: k + 1 },
    });
  });

  pasos.push({
    titulo: 'Camino óptimo y estrategia',
    texto: `El valor del árbol es ${fmtNum(ev.valor)}${arbol.unidad ? ' ' + arbol.unidad : ''}. Siguiendo las ramas elegidas desde la raíz se obtiene la estrategia óptima (en azul).`,
    calculo: [`Valor ${maximiza ? 'máximo esperado' : 'mínimo esperado'} = ${fmtNum(ev.valor)}`, ...estrategiaTexto(ev)],
    estado: { resueltos: ev.orden.slice(), actual: null, final: true },
  });
  return pasos;
}
