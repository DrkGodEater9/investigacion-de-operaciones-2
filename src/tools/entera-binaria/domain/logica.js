/** Constructores de restricciones lógicas con variables binarias. */
import { sub } from './format.js';

function chequearVars(vars, n, nombre = 'vars') {
  if (!Array.isArray(vars) || vars.length === 0) throw new Error(`Elige al menos una variable (${nombre} está vacío).`);
  const vistos = new Set();
  for (const j of vars) {
    if (!Number.isInteger(j) || j < 0 || j >= n) throw new Error(`La variable ${j} no existe: los índices van de 0 a ${n - 1}.`);
    if (vistos.has(j)) throw new Error(`La variable ${sub('x' + (j + 1))} está repetida.`);
    vistos.add(j);
  }
}
function chequearK(k, tope) {
  if (!Number.isInteger(k)) throw new Error('k debe ser un número entero.');
  if (k < 0 || k > tope) throw new Error(`k debe estar entre 0 y ${tope}.`);
}
function chequearPar(a, b, n) {
  chequearVars([a], n, 'a');
  chequearVars([b], n, 'b');
  if (a === b) throw new Error('Elige dos variables distintas.');
}
const lista = (vars, names) => vars.map((j) => sub(names[j])).join(', ');
const vector = (n, vars, v = 1) => {
  const a = Array(n).fill(0);
  vars.forEach((j) => { a[j] = v; });
  return a;
};

/** restriccionLogica(tipo, params, names) → { name, a, op, b } */
export function restriccionLogica(tipo, params, names) {
  const n = names.length;
  const p = params || {};
  switch (tipo) {
    case 'aLoSumo':
    case 'alMenos':
    case 'exactamente': {
      chequearVars(p.vars, n);
      chequearK(p.k, p.vars.length);
      const [op, txt] = { aLoSumo: ['<=', 'A lo sumo'], alMenos: ['>=', 'Al menos'], exactamente: ['=', 'Exactamente'] }[tipo];
      return { name: `${txt} ${p.k} de (${lista(p.vars, names)})`, a: vector(n, p.vars), op, b: p.k };
    }
    case 'excluyentes':
      chequearVars(p.vars, n);
      return { name: `A lo sumo uno de (${lista(p.vars, names)})`, a: vector(n, p.vars), op: '<=', b: 1 };
    case 'alMenosUno':
      chequearVars(p.vars, n);
      return { name: `Al menos uno de (${lista(p.vars, names)})`, a: vector(n, p.vars), op: '>=', b: 1 };
    case 'requiere': {
      chequearPar(p.a, p.b, n);
      const a = Array(n).fill(0);
      a[p.a] = 1;
      a[p.b] = -1;
      return { name: `${sub(names[p.a])} solo si ${sub(names[p.b])}`, a, op: '<=', b: 0 };
    }
    case 'juntos': {
      chequearPar(p.a, p.b, n);
      const a = Array(n).fill(0);
      a[p.a] = 1;
      a[p.b] = -1;
      return { name: `${sub(names[p.a])} y ${sub(names[p.b])} juntos`, a, op: '=', b: 0 };
    }
    default:
      throw new Error(`Tipo de condición desconocido: ${tipo}`);
  }
}

/** Lista para el panel «Condiciones lógicas» de la pantalla. */
export const TIPOS_LOGICA = [
  { id: 'aLoSumo', label: 'A lo sumo k de …', usaK: true, usaPar: false },
  { id: 'alMenos', label: 'Al menos k de …', usaK: true, usaPar: false },
  { id: 'exactamente', label: 'Exactamente k de …', usaK: true, usaPar: false },
  { id: 'excluyentes', label: 'A lo sumo uno (excluyentes)', usaK: false, usaPar: false },
  { id: 'alMenosUno', label: 'Al menos uno de un grupo', usaK: false, usaPar: false },
  { id: 'requiere', label: 'A solo si B', usaK: false, usaPar: true },
  { id: 'juntos', label: 'A y B van juntos', usaK: false, usaPar: true },
];
