/**
 * Inducción hacia atrás.
 *  - Hoja: su valor.
 *  - Rama: pago de la rama + valor del nodo al que llega.
 *  - Nodo de azar: valor esperado = suma de p × valor de la rama.
 *  - Nodo de decisión: el mejor valor de sus ramas (máximo si se maximiza, mínimo si se minimiza).
 */
import { fmtNum, fmtPar } from './format.js';
import { NOTACION, REGLAS } from './notacion.js';

const cerca = (a, b) => Math.abs(a - b) <= REGLAS.tolerancia * Math.max(1, Math.abs(a), Math.abs(b));

/** Texto de «pago + valor» de una rama. */
const sumaRama = (r) => (r.pago === 0 ? fmtNum(r.valorHijo) : `${fmtNum(r.pago)} + ${fmtPar(r.valorHijo)}`);

export function evaluar(arbol) {
  const maximiza = arbol.sense === 'max';
  const porNodo = {};
  const orden = [];

  function rec(n) {
    if (n.tipo === 'final') {
      porNodo[n.id] = { id: n.id, tipo: 'final', nombre: n.nombre, valor: n.valor, ramas: [], elegida: null, empates: [], lineas: [`Resultado final: ${fmtNum(n.valor)}`] };
      return n.valor;
    }
    const hijos = n.ramas.map((r) => rec(r.hijo));
    const ramas = n.ramas.map((r, i) => ({
      etiqueta: r.etiqueta, p: r.p, pago: r.pago, hijoId: r.hijo.id, valorHijo: hijos[i], total: r.pago + hijos[i],
      optima: false, elegida: false,
    }));
    let valor;
    let elegida = null;
    let empates = [];
    const lineas = [];
    if (n.tipo === 'azar') {
      valor = ramas.reduce((s, r) => s + r.p * r.total, 0);
      const terminos = ramas.map((r) => `${fmtNum(r.p)} × ${r.pago === 0 ? fmtPar(r.valorHijo) : `(${sumaRama(r)})`}`);
      lineas.push(`${NOTACION.valorEsperado}(${n.nombre}) = ${terminos.join(' + ')} = ${fmtNum(valor)}`);
      ramas.forEach((r) => { r.elegida = true; });
    } else {
      const tot = ramas.map((r) => r.total);
      valor = maximiza ? Math.max(...tot) : Math.min(...tot);
      empates = ramas.map((r, i) => (cerca(r.total, valor) ? i : -1)).filter((i) => i >= 0);
      elegida = empates[0];
      ramas.forEach((r, i) => {
        r.optima = empates.includes(i);
        r.elegida = i === elegida;
        const calc = r.pago === 0 ? '' : ` (${sumaRama(r)})`;
        lineas.push(`${r.etiqueta}: ${fmtNum(r.total)}${calc}`);
      });
      lineas.push(`Se elige ${maximiza ? 'el máximo' : 'el mínimo'}: «${ramas[elegida].etiqueta}» con ${fmtNum(valor)}.`
        + (empates.length > 1 ? ` Hay empate con ${empates.slice(1).map((i) => `«${ramas[i].etiqueta}»`).join(', ')}; se toma la primera.` : ''));
    }
    porNodo[n.id] = { id: n.id, tipo: n.tipo, nombre: n.nombre, valor, ramas, elegida, empates, lineas };
    orden.push(n.id);
    return valor;
  }
  const valor = rec(arbol.raiz);

  // Política óptima: en cada decisión alcanzada, la rama elegida; en cada azar, las ramas con probabilidad > 0.
  const politica = {};
  const alcanzados = {};
  const estrategia = [];
  (function marcar(n, ruta) {
    alcanzados[n.id] = true;
    if (n.tipo === 'final') return;
    const ev = porNodo[n.id];
    if (n.tipo === 'decision') {
      estrategia.push({ nodoId: n.id, nombre: n.nombre, idx: ev.elegida, eleccion: n.ramas[ev.elegida].etiqueta, ruta, empate: ev.empates.length > 1 });
    }
    n.ramas.forEach((r, i) => {
      const sigue = n.tipo === 'azar' ? r.p > 0 : i === ev.elegida;
      if (!sigue) return;
      politica[`${n.id}:${i}`] = true;
      marcar(r.hijo, [...ruta, r.etiqueta]);
    });
  })(arbol.raiz, []);

  return { sense: arbol.sense, unidad: arbol.unidad, valor, raizId: arbol.raiz.id, porNodo, orden, politica, alcanzados, estrategia };
}

/** Líneas de texto de la estrategia óptima (una por decisión alcanzada, de la raíz hacia las hojas). */
export function estrategiaTexto(ev) {
  if (ev.estrategia.length === 0) return ['No hay decisiones en el árbol: solo se calcula el valor esperado.'];
  return ev.estrategia.map((e) => {
    const donde = e.ruta.length ? ` (si ${e.ruta.map((r) => `«${r}»`).join(' y luego ')})` : '';
    return `En «${e.nombre}»${donde}: elegir «${e.eleccion}»${e.empate ? ' (empata con otra rama)' : ''}.`;
  });
}

/** Firma de la estrategia (para detectar cambios de decisión al variar un dato). */
export const firmaEstrategia = (ev) => ev.estrategia.map((e) => `${e.nodoId}:${e.idx}`).join('|');
