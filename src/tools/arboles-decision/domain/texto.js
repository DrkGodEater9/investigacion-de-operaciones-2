/**
 * Entrada alternativa por texto indentado (lista de Markdown).
 *
 *   objetivo: max            (o min; opcional, por defecto max)
 *   unidad: millones de pesos (opcional)
 *   - [D] Tamaño de la planta          nodo de decisión   ([A] = nodo de azar; también □ y ○)
 *     - Grande | pago -120             rama que sale del nodo; campos separados por «|»
 *       - [A] Demanda
 *         - Alta | p 0,6 | valor 300   rama que termina en un resultado (valor)
 *         - Baja | p 0,4 | valor 60
 *     - No construir | valor 0
 *
 * Campos de una rama: p (probabilidad: 0,6 · 60 % · 3/5), pago (flujo de la rama, por defecto 0) y valor
 * (resultado final si la rama termina ahí). La jerarquía la da la sangría; los guiones iniciales son opcionales.
 */
import { fmtTexto } from './format.js';

const RE_NODO = /^(\[D\]|\[A\]|□|○)\s*[:\-]?\s*(.*)$/i;
const RE_OBJETIVO = /^(?:objetivo|sentido)\s*[:=]\s*(.+)$/i;
const RE_UNIDAD = /^unidad\s*[:=]\s*(.*)$/i;
const RE_CAMPO = /^(probabilidad|prob|pago|valor|p)\b\s*[:=]?\s*(.+)$/i;

function sentidoDe(t) {
  const s = t.trim().toLowerCase();
  if (/^(max|maximizar|maximiza|maximo|máximo|utilidad|ganancia)$/.test(s)) return 'max';
  if (/^(min|minimizar|minimiza|minimo|mínimo|costo|costos)$/.test(s)) return 'min';
  return null;
}

export function parsearTexto(src) {
  const errores = [];
  const falla = (linea, mensaje) => errores.push({ linea, mensaje: `Línea ${linea}: ${mensaje}` });
  let sense = 'max';
  let unidad = '';
  let raiz = null;
  let k = 0;
  const nuevoId = () => `n${++k}`;
  const pila = []; // { indent, obj, tipo: 'nodo' | 'rama' }

  String(src ?? '').split(/\r?\n/).forEach((linea0, i) => {
    const nl = i + 1;
    const linea = linea0.replace(/\t/g, '    ');
    if (/^\s*$/.test(linea) || /^\s*(#|\/\/)/.test(linea)) return;
    const m = /^(\s*)(?:[-*+]\s+)?(.*)$/.exec(linea);
    const indent = m[1].length;
    const c = m[2].trim();

    const sol = sentidoDe(c);
    const mo = RE_OBJETIVO.exec(c);
    const mu = RE_UNIDAD.exec(c);
    if (sol && !raiz) { sense = sol; return; }
    if (mo) {
      const s = sentidoDe(mo[1]);
      if (!s) falla(nl, `no entiendo el objetivo «${mo[1].trim()}»; escribe max o min.`);
      else sense = s;
      return;
    }
    if (mu) { unidad = mu[1].trim(); return; }

    while (pila.length && pila[pila.length - 1].indent >= indent) pila.pop();
    const tope = pila[pila.length - 1];

    const mn = RE_NODO.exec(c);
    if (mn) {
      const tipo = /^(\[D\]|□)$/i.test(mn[1]) ? 'decision' : 'azar';
      const nodo = { id: nuevoId(), tipo, nombre: mn[2].trim(), ramas: [] };
      if (!tope) {
        if (raiz) { falla(nl, 'solo puede haber un nodo raíz; los demás nodos van dentro de una rama (con más sangría).'); return; }
        raiz = nodo;
      } else if (tope.tipo === 'rama') {
        if (tope.obj.hijo) { falla(nl, `la rama «${tope.obj.etiqueta}» ya tiene un nodo; una rama llega a un solo nodo.`); return; }
        if (tope.obj._valor !== undefined) { falla(nl, `la rama «${tope.obj.etiqueta}» ya termina en un valor; no puede llevar además un nodo.`); return; }
        tope.obj.hijo = nodo;
      } else {
        falla(nl, 'un nodo va dentro de una rama; escribe primero la rama y baja el nodo con más sangría.');
        return;
      }
      pila.push({ indent, obj: nodo, tipo: 'nodo' });
      return;
    }

    // rama
    if (!tope || tope.tipo !== 'nodo') {
      falla(nl, raiz ? 'una rama debe ir dentro de un nodo [D] o [A] (con más sangría que el nodo).' : 'el árbol debe empezar con un nodo, por ejemplo «[D] Mi decisión» o «[A] Demanda».');
      return;
    }
    const campos = c.split('|').map((s) => s.trim());
    const etiqueta = campos[0];
    if (!etiqueta) { falla(nl, 'la rama no tiene nombre.'); return; }
    const rama = { etiqueta, p: '', pago: '', hijo: null };
    campos.slice(1).forEach((f) => {
      if (!f) return;
      const mc = RE_CAMPO.exec(f);
      if (!mc) { falla(nl, `no entiendo el campo «${f}»; usa p, pago o valor (por ejemplo «p 0,6»).`); return; }
      const clave = mc[1].toLowerCase();
      if (clave === 'pago') rama.pago = mc[2].trim();
      else if (clave === 'valor') rama._valor = mc[2].trim();
      else rama.p = mc[2].trim();
    });
    tope.obj.ramas.push(rama);
    pila.push({ indent, obj: rama, tipo: 'rama' });
  });

  if (!raiz && errores.length === 0) errores.push({ linea: 0, mensaje: 'Escribe el árbol: la primera línea con contenido debe ser un nodo como «[D] Mi decisión».' });

  // Las ramas sin nodo terminan en un resultado final.
  const cierra = (n) => {
    n.ramas.forEach((r) => {
      if (!r.hijo) r.hijo = { id: nuevoId(), tipo: 'final', nombre: '', valor: r._valor !== undefined ? r._valor : '', ramas: [] };
      else cierra(r.hijo);
      delete r._valor;
    });
  };
  if (raiz) cierra(raiz);
  return { arbol: raiz && errores.length === 0 ? { sense, unidad, raiz } : null, errores };
}

const nombreTxt = (n) => (n.nombre ? ` ${n.nombre}` : '');
const num = (v) => (typeof v === 'number' ? fmtTexto(v) : String(v ?? '').trim());
const vacioTxt = (v) => v === undefined || v === null || String(v).trim() === '';

/** Árbol (normalizado o borrador) en el texto indentado que lee parsearTexto. */
export function arbolATexto(arbol) {
  const out = [`objetivo: ${arbol.sense === 'min' ? 'min' : 'max'}`];
  if (arbol.unidad) out.push(`unidad: ${arbol.unidad}`);
  const nodo = (n, nivel) => {
    const pad = '  '.repeat(nivel);
    out.push(`${pad}- [${n.tipo === 'azar' ? 'A' : 'D'}]${nombreTxt(n)}`);
    n.ramas.forEach((r) => {
      const campos = [r.etiqueta];
      if (n.tipo === 'azar' && !vacioTxt(r.p)) campos.push(`p ${num(r.p)}`);
      const pagoCero = !vacioTxt(r.pago) && Number(String(r.pago).replace(',', '.')) === 0;
      const conPago = !vacioTxt(r.pago) && (!pagoCero || (r.hijo?.tipo === 'final' && vacioTxt(r.hijo.valor)));
      if (conPago) campos.push(`pago ${num(r.pago)}`);
      if (r.hijo && r.hijo.tipo === 'final') {
        const sinValor = vacioTxt(r.hijo.valor);
        const cero = !sinValor && Number(String(r.hijo.valor).replace(',', '.')) === 0;
        if (!sinValor && !(cero && conPago)) campos.push(`valor ${num(r.hijo.valor)}`);
        out.push(`${pad}  - ${campos.join(' | ')}`);
      } else {
        out.push(`${pad}  - ${campos.join(' | ')}`);
        if (r.hijo) nodo(r.hijo, nivel + 2);
      }
    });
  };
  if (arbol.raiz.tipo === 'final') out.push(`- [D]`);
  else nodo(arbol.raiz, 0);
  return out.join('\n');
}
