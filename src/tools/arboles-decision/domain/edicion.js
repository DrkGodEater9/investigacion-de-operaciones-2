/**
 * Operaciones del editor sobre el árbol (borrador). Todas son puras: devuelven un árbol nuevo
 * y no tocan el que reciben. Los campos de texto (p, pago, valor) se guardan tal como se escriben.
 */
import { listaNodos } from './arbol.js';
import { parseProb } from './format.js';

const clonar = (x) => JSON.parse(JSON.stringify(x));

/** Siguiente identificador libre «n<k>». */
export function idNuevo(arbol) {
  let max = 0;
  listaNodos(arbol).forEach((n) => {
    const m = /^n(\d+)$/.exec(String(n.id));
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `n${max + 1}`;
}

const buscar = (arbol, id) => listaNodos(arbol).find((n) => n.id === id);

function sobre(arbol, id, f) {
  const copia = clonar(arbol);
  const n = buscar(copia, id);
  if (n) f(n, copia);
  return copia;
}

const hojaNueva = (arbol) => ({ id: idNuevo(arbol), tipo: 'final', nombre: '', valor: '', ramas: [] });

export const actualizarArbol = (arbol, cambios) => ({ ...clonar(arbol), ...cambios });

export const actualizarNodo = (arbol, id, cambios) => sobre(arbol, id, (n) => Object.assign(n, cambios));

export const actualizarRama = (arbol, id, idx, cambios) => sobre(arbol, id, (n) => {
  if (n.ramas[idx]) Object.assign(n.ramas[idx], cambios);
});

/** Agrega una rama que termina en un resultado final. */
export function agregarRama(arbol, id) {
  const copia = clonar(arbol);
  const n = buscar(copia, id);
  if (!n || n.tipo === 'final') return copia;
  const hijo = hojaNueva(copia);
  n.ramas.push({ etiqueta: `Rama ${n.ramas.length + 1}`, p: '', pago: '', hijo });
  return copia;
}

export const quitarRama = (arbol, id, idx) => sobre(arbol, id, (n) => { n.ramas.splice(idx, 1); });

/**
 * Cambia el tipo de un nodo. De resultado final a decisión o azar crea dos ramas nuevas; de decisión o azar
 * a resultado final se borran sus ramas (y todo lo que colgaba de ellas); entre decisión y azar se conservan.
 */
export function cambiarTipo(arbol, id, tipo) {
  const copia = clonar(arbol);
  const n = buscar(copia, id);
  if (!n || n.tipo === tipo) return copia;
  if (tipo === 'final') {
    n.tipo = 'final';
    n.ramas = [];
    n.valor = '';
    return copia;
  }
  if (n.tipo === 'final') {
    n.tipo = tipo;
    delete n.valor;
    n.ramas = [];
    ['Rama 1', 'Rama 2'].forEach((et) => {
      n.ramas.push({ etiqueta: et, p: '', pago: '', hijo: hojaNueva(copia) });
    });
    return copia;
  }
  n.tipo = tipo;
  return copia;
}

/** Reparte la probabilidad en partes iguales entre las ramas de un nodo de azar (la suma queda exactamente en 1). */
export function repartirProbabilidades(arbol, id) {
  return sobre(arbol, id, (n) => {
    const k = n.ramas.length;
    if (!k) return;
    const base = Math.floor((1 / k) * 1e4) / 1e4;
    n.ramas.forEach((r, i) => {
      const v = i === k - 1 ? Math.round((1 - base * (k - 1)) * 1e10) / 1e10 : base;
      r.p = String(v).replace('.', ',');
    });
  });
}

/** Deja la última rama con lo que falta para sumar 1 (si las demás probabilidades son números válidos). */
export function completarUltima(arbol, id) {
  return sobre(arbol, id, (n) => {
    const k = n.ramas.length;
    if (k < 2) return;
    let s = 0;
    for (let i = 0; i < k - 1; i++) {
      const p = parseProb(n.ramas[i].p);
      if (p === null) return;
      s += p;
    }
    const v = Math.round((1 - s) * 1e10) / 1e10;
    if (v < 0) return;
    n.ramas[k - 1].p = String(v).replace('.', ',');
  });
}

/** Árbol inicial del editor: una decisión con dos resultados. */
export function arbolVacio() {
  return {
    sense: 'max',
    unidad: '',
    raiz: {
      id: 'n1', tipo: 'decision', nombre: 'Decisión', ramas: [
        { etiqueta: 'Opción A', p: '', pago: '', hijo: { id: 'n2', tipo: 'final', nombre: '', valor: '', ramas: [] } },
        { etiqueta: 'Opción B', p: '', pago: '', hijo: { id: 'n3', tipo: 'final', nombre: '', valor: '', ramas: [] } },
      ],
    },
  };
}
