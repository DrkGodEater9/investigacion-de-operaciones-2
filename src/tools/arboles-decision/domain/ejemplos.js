/** Ejemplos cargables (Resuelve el tuyo) y resueltos (Paso a paso). Todos son árboles válidos. */
import { normalizarOError } from './arbol.js';

const F = (valor) => ({ tipo: 'final', nombre: '', valor, ramas: [] });
const nodo = (tipo, nombre, ramas) => ({ tipo, nombre, ramas });
const D = (nombre, ...ramas) => nodo('decision', nombre, ramas);
const A = (nombre, ...ramas) => nodo('azar', nombre, ramas);
const R = (etiqueta, hijo, { p = '', pago = '' } = {}) => ({ etiqueta, p, pago, hijo: typeof hijo === 'number' ? F(hijo) : hijo });

/** Asigna los identificadores n1, n2… en preorden. */
function numerar(raiz) {
  let k = 0;
  (function rec(n) {
    n.id = `n${++k}`;
    n.ramas.forEach((r) => rec(r.hijo));
  })(raiz);
  return raiz;
}

const arbol = (sense, unidad, raiz) => ({ sense, unidad, raiz: numerar(raiz) });

export const EJEMPLOS = [
  {
    id: 'planta',
    titulo: 'Tamaño de una planta',
    enunciado: 'Una empresa decide si construye una planta grande, una pequeña o no construye. La demanda será alta con probabilidad 0,6 y baja con 0,4. Los pagos son el ingreso al terminar, en millones; construir cuesta 120 (grande) o 50 (pequeña).',
    arbol: arbol('max', 'millones de pesos', D(
      'Tamaño de la planta',
      R('Grande', A('Demanda', R('Alta', 300, { p: 0.6 }), R('Baja', 60, { p: 0.4 })), { pago: -120 }),
      R('Pequeña', A('Demanda', R('Alta', 150, { p: 0.6 }), R('Baja', 90, { p: 0.4 })), { pago: -50 }),
      R('No construir', 0),
    )),
  },
  {
    id: 'estudio',
    titulo: 'Estudio de mercado antes de lanzar',
    enunciado: 'Antes de lanzar un producto se puede pagar un estudio de mercado (5 millones). El estudio sale favorable con probabilidad 0,55. Si lanzas, ganas 200 con demanda alta y pierdes 80 con demanda baja. La probabilidad de demanda alta es 0,8 si el estudio es favorable, 0,2 si es desfavorable y 0,53 si no se hace el estudio.',
    arbol: arbol('max', 'millones de pesos', D(
      'Estudio de mercado',
      R('Hacer el estudio', A(
        'Resultado del estudio',
        R('Favorable', D('Lanzar (favorable)', R('Lanzar', A('Demanda', R('Alta', 200, { p: 0.8 }), R('Baja', -80, { p: 0.2 }))), R('No lanzar', 0)), { p: 0.55 }),
        R('Desfavorable', D('Lanzar (desfavorable)', R('Lanzar', A('Demanda', R('Alta', 200, { p: 0.2 }), R('Baja', -80, { p: 0.8 }))), R('No lanzar', 0)), { p: 0.45 }),
      ), { pago: -5 }),
      R('Sin estudio', D('Lanzar (sin estudio)', R('Lanzar', A('Demanda', R('Alta', 200, { p: 0.53 }), R('Baja', -80, { p: 0.47 }))), R('No lanzar', 0))),
    )),
  },
  {
    id: 'mantenimiento',
    titulo: 'Mantenimiento de una máquina (costos)',
    enunciado: 'Se quiere minimizar el costo esperado. Mantenimiento preventivo cuesta 40 y deja la probabilidad de falla en 0,1; no hacer nada deja la probabilidad de falla en 0,35; reemplazar la máquina cuesta 90 y elimina la falla. Una falla cuesta 100 si hubo mantenimiento y 180 si no lo hubo.',
    arbol: arbol('min', 'millones de pesos', D(
      'Política de mantenimiento',
      R('Preventivo', A('Falla', R('Falla', 100, { p: 0.1 }), R('No falla', 0, { p: 0.9 })), { pago: 40 }),
      R('Solo reparar', A('Falla', R('Falla', 180, { p: 0.35 }), R('No falla', 0, { p: 0.65 }))),
      R('Reemplazar', 0, { pago: 90 }),
    )),
  },
  {
    id: 'lanzamiento',
    titulo: 'Lanzamiento con expansión (dos decisiones)',
    enunciado: 'Lanzar un producto cuesta 30. Si la acogida es buena (0,4) se decide si se expande (cuesta 50): con expansión el mercado resulta alto (0,7) y deja 250, o bajo (0,3) y deja 80; sin expandir se obtiene 100. Si la acogida es regular (0,6) se obtiene 20. No lanzar deja 0.',
    arbol: arbol('max', 'millones de pesos', D(
      'Lanzar',
      R('Lanzar', A(
        'Acogida',
        R('Buena', D(
          'Expandir',
          R('Expandir', A('Mercado', R('Alto', 250, { p: 0.7 }), R('Bajo', 80, { p: 0.3 })), { pago: -50 }),
          R('No expandir', 100),
        ), { p: 0.4 }),
        R('Regular', 20, { p: 0.6 }),
      ), { pago: -30 }),
      R('No lanzar', 0),
    )),
  },
];

export const ejemploPorId = (id) => EJEMPLOS.find((e) => e.id === id);
/** Árbol normalizado del ejemplo (listo para evaluar). */
export const arbolDeEjemplo = (id) => normalizarOError(ejemploPorId(id).arbol);
