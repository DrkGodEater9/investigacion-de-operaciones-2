/**
 * Estructura del árbol (serializable a JSON) y su validación.
 *
 *   Arbol = { sense: 'max' | 'min', unidad: string, raiz: Nodo }
 *   Nodo  = { id, tipo: 'decision' | 'azar' | 'final', nombre, valor?, ramas: Rama[] }
 *   Rama  = { etiqueta, p?, pago, hijo: Nodo }
 *
 * - 'final' es una hoja: tiene `valor` (lo que se obtiene al terminar) y no tiene ramas.
 * - Los pagos de las ramas (inversiones, costos de un estudio…) se acumulan con el valor del nodo siguiente.
 * - `p` solo se usa en las ramas que salen de un nodo de azar.
 * - Los números pueden venir como texto (lo que escribe la persona): normalizar() los convierte.
 */
import { fmtNum, parseNumero, parseProb, vacio } from './format.js';
import { REGLAS } from './notacion.js';

export const MAX_NODOS = 400;
const MAX_PROF = 40;

export const crearFinal = (id, valor = 0) => ({ id, tipo: 'final', nombre: '', valor, ramas: [] });

/** Recorre el árbol (preorden). f(nodo, { padre, rama, idx, ruta }) */
export function recorrer(nodo, f, ctx = { padre: null, rama: null, idx: -1, ruta: [] }) {
  f(nodo, ctx);
  (nodo.ramas || []).forEach((r, i) => {
    if (r.hijo) recorrer(r.hijo, f, { padre: nodo, rama: r, idx: i, ruta: [...ctx.ruta, r.etiqueta] });
  });
}

export function listaNodos(arbol) {
  const out = [];
  recorrer(arbol.raiz, (n) => out.push(n));
  return out;
}

export const contarNodos = (arbol) => listaNodos(arbol).length;
export const hojas = (arbol) => listaNodos(arbol).filter((n) => n.tipo === 'final');
export function profundidad(nodo) {
  return (nodo.ramas || []).reduce((m, r) => Math.max(m, 1 + profundidad(r.hijo)), 0);
}

const comillas = (s) => `«${s}»`;

/**
 * Valida y convierte a números. Devuelve { arbol, errores, avisos, nodos }:
 *  - arbol: el árbol normalizado (todo numérico, sin textos vacíos) o null si hay errores;
 *  - errores: [{ nodoId, ruta, campo, mensaje }] con mensajes en español que dicen dónde está el problema;
 *  - avisos: observaciones que no impiden calcular.
 */
export function normalizar(entrada) {
  const errores = [];
  const avisos = [];
  const err = (nodoId, ruta, campo, mensaje) => errores.push({ nodoId, ruta: ruta.join(' › '), campo, mensaje });

  if (!entrada || typeof entrada !== 'object' || !entrada.raiz || typeof entrada.raiz !== 'object') {
    err(null, [], 'raiz', 'El árbol está vacío: agrega un nodo de decisión o de azar.');
    return { arbol: null, errores, avisos, nodos: 0 };
  }
  if (entrada.sense != null && entrada.sense !== 'max' && entrada.sense !== 'min') {
    err(null, [], 'sense', 'El objetivo debe ser maximizar o minimizar.');
  }
  const sense = entrada.sense === 'min' ? 'min' : 'max';

  const vistosObj = new Set();
  const ids = new Set();
  let total = 0;
  let desbordado = false;
  let cD = 0;
  let cA = 0;
  let auto = 0;
  const idLibre = () => {
    auto += 1;
    return `auto${auto}`;
  };
  const ultima = (ruta) => (ruta.length ? comillas(ruta[ruta.length - 1]) : 'el árbol');

  /** `rutaNodo` son las etiquetas de las ramas desde la raíz; `ramaPadre` la rama que llega al nodo. */
  function rec(n, rutaNodo, prof, ramaPadre) {
    const stub = { id: idLibre(), tipo: 'final', nombre: '', valor: 0, ramas: [] };
    if (!n || typeof n !== 'object') {
      err(null, rutaNodo, 'hijo', `La rama ${ultima(rutaNodo)} no llega a ningún nodo.`);
      return stub;
    }
    if (vistosObj.has(n)) {
      err(n.id ?? null, rutaNodo, 'id', `El nodo ${comillas(n.nombre || n.id || '?')} aparece más de una vez: el árbol no puede tener ciclos ni nodos repetidos.`);
      return stub;
    }
    vistosObj.add(n);
    total += 1;
    if (total > MAX_NODOS) {
      if (!desbordado) err(null, rutaNodo, 'tamano', `El árbol tiene más de ${MAX_NODOS} nodos; reduce su tamaño.`);
      desbordado = true;
      return stub;
    }
    if (prof > MAX_PROF) {
      err(n.id ?? null, rutaNodo, 'prof', `El árbol es demasiado profundo (más de ${MAX_PROF} niveles).`);
      return stub;
    }
    let id = n.id;
    if (vacio(id)) id = idLibre();
    id = String(id);
    if (ids.has(id)) err(id, rutaNodo, 'id', `Hay dos nodos con el mismo identificador (${comillas(id)}).`);
    ids.add(id);

    const tipo = n.tipo;
    if (tipo !== 'decision' && tipo !== 'azar' && tipo !== 'final') {
      err(id, rutaNodo, 'tipo', `El tipo del nodo ${comillas(id)} debe ser decision, azar o final.`);
      return { ...stub, id };
    }
    let nombre = String(n.nombre ?? '').trim();
    if (!nombre && tipo === 'decision') nombre = `Decisión ${++cD}`;
    if (!nombre && tipo === 'azar') nombre = `Azar ${++cA}`;
    const nom = nombre || id;

    if (tipo === 'final') {
      let valor = parseNumero(n.valor);
      if (valor === null) {
        const conPago = ramaPadre && !vacio(ramaPadre.pago);
        if (vacio(n.valor) && conPago) valor = 0;
        else if (vacio(n.valor)) {
          err(id, rutaNodo, 'valor', `Falta el valor del resultado al final de ${ultima(rutaNodo)}: escribe el pago final (puede ser 0).`);
          valor = 0;
        } else {
          err(id, rutaNodo, 'valor', `El valor final ${comillas(String(n.valor).trim())} de ${ultima(rutaNodo)} no es un número.`);
          valor = 0;
        }
      }
      return { id, tipo, nombre, valor, ramas: [] };
    }

    const ramasIn = Array.isArray(n.ramas) ? n.ramas : [];
    const clase = tipo === 'decision' ? 'de decisión' : 'de azar';
    if (ramasIn.length === 0) {
      err(id, rutaNodo, 'ramas', `El nodo ${clase} ${comillas(nom)} no tiene ramas: agrégale al menos dos o conviértelo en un resultado final.`);
      return { id, tipo, nombre, ramas: [] };
    }
    if (ramasIn.length === 1) {
      avisos.push(tipo === 'decision'
        ? `El nodo ${comillas(nom)} tiene una sola rama: no hay nada que decidir.`
        : `El nodo ${comillas(nom)} tiene una sola rama (probabilidad 1).`);
    }
    const etiquetas = new Set();
    let suma = 0;
    let todasValidas = true;
    const ramas = ramasIn.map((r, i) => {
      const et = String(r?.etiqueta ?? '').trim() || `Rama ${i + 1}`;
      const rutaR = [...rutaNodo, et];
      if (etiquetas.has(et)) avisos.push(`El nodo ${comillas(nom)} tiene dos ramas con el mismo nombre (${comillas(et)}).`);
      etiquetas.add(et);
      let pago = 0;
      if (!vacio(r?.pago)) {
        pago = parseNumero(r.pago);
        if (pago === null) {
          err(id, rutaR, 'pago', `El pago de la rama ${comillas(et)} (${comillas(String(r.pago).trim())}) no es un número.`);
          pago = 0;
        }
      }
      let p = null;
      if (tipo === 'azar') {
        if (vacio(r?.p)) {
          err(id, rutaR, 'p', `Falta la probabilidad de la rama ${comillas(et)} del nodo de azar ${comillas(nom)}.`);
          todasValidas = false;
        } else {
          p = parseProb(r.p);
          if (p === null) {
            err(id, rutaR, 'p', `La probabilidad de ${comillas(et)} (${comillas(String(r.p).trim())}) no es un número.`);
            todasValidas = false;
          } else if (p < 0 || p > 1) {
            err(id, rutaR, 'p', `La probabilidad de ${comillas(et)} debe estar entre 0 y 1 (escribiste ${fmtNum(p)}).`);
            todasValidas = false;
          } else suma += p;
        }
      }
      const hijo = rec(r?.hijo, rutaR, prof + 1, r);
      return { etiqueta: et, p, pago, hijo };
    });
    if (tipo === 'azar' && todasValidas && Math.abs(suma - 1) > REGLAS.toleranciaProb) {
      const dif = 1 - suma;
      err(id, rutaNodo, 'suma', `Las probabilidades del nodo ${comillas(nom)} suman ${fmtNum(suma)} y deben sumar 1 (${dif > 0 ? 'faltan' : 'sobran'} ${fmtNum(Math.abs(dif))}).`);
    }
    return { id, tipo, nombre, ramas };
  }

  const raiz = rec(entrada.raiz, [], 0, null);
  if (raiz.tipo === 'final' && errores.length === 0) {
    err(raiz.id, [], 'raiz', 'El árbol necesita al menos un nodo de decisión o de azar; ahora solo tiene un resultado.');
  }
  const unidad = String(entrada.unidad ?? '').trim();
  return {
    arbol: errores.length ? null : { sense, unidad, raiz },
    errores,
    avisos,
    nodos: total,
  };
}

/** Atajo para las pruebas y los ejemplos: lanza si el árbol no es válido. */
export function normalizarOError(entrada) {
  const r = normalizar(entrada);
  if (!r.arbol) throw new Error(r.errores.map((e) => e.mensaje).join(' '));
  return r.arbol;
}
