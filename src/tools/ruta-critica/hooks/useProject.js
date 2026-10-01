import { useReducer } from 'react';
import { EXAMPLES } from '../domain/examples.js';
import { expectedTime } from '../domain/pert.js';
import { toNumber } from '../domain/parser.js';

let seq = 0;
const uid = () => 'r' + ++seq;
const emptyRow = (name = '') => ({ id: uid(), name, preds: '', d: '', a: '', m: '', b: '' });
const withIds = (rows) => rows.map((r) => ({ ...emptyRow(), ...r, id: uid() }));

export function projectFrom({ title, mode, activities }) {
  return { title: title || 'Ejercicio sin título', mode: mode || 'cpm', rows: withIds(activities), decimals: 2, version: Date.now() + Math.random() };
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function nextName(rows) {
  const used = new Set(rows.map((r) => r.name));
  for (const ch of ALPHABET) if (!used.has(ch)) return ch;
  let i = 1;
  while (used.has('A' + i)) i++;
  return 'A' + i;
}

function reducer(state, action) {
  switch (action.type) {
    case 'load':
      return projectFrom(action.project);
    case 'replace':
      // Edición en vivo desde el Markdown: no cambia la versión para no reescribir el texto.
      return { ...state, title: action.project.title || state.title, mode: action.project.mode, rows: withIds(action.project.activities) };
    case 'new':
      return projectFrom({ title: 'Nuevo ejercicio', mode: state.mode, activities: [{ name: 'A', preds: '-' }] });
    case 'title':
      return { ...state, title: action.value };
    case 'decimals':
      return { ...state, decimals: action.value };
    case 'mode': {
      let rows = state.rows;
      if (action.value === 'cpm' && state.mode === 'pert') {
        rows = rows.map((r) => {
          const [a, m, b] = [toNumber(r.a), toNumber(r.m), toNumber(r.b)];
          if (r.d || a == null || m == null || b == null) return r;
          return { ...r, d: String(Math.round(expectedTime(a, m, b) * 100) / 100) };
        });
      }
      return { ...state, mode: action.value, rows };
    }
    case 'update':
      return { ...state, rows: state.rows.map((r) => (r.id === action.id ? { ...r, [action.field]: action.value } : r)) };
    case 'add': {
      const row = emptyRow(nextName(state.rows));
      const at = action.afterId ? state.rows.findIndex((r) => r.id === action.afterId) + 1 : state.rows.length;
      const rows = [...state.rows];
      rows.splice(at, 0, row);
      return { ...state, rows, lastAdded: row.id };
    }
    case 'remove':
      return { ...state, rows: state.rows.filter((r) => r.id !== action.id) };
    case 'move': {
      const i = state.rows.findIndex((r) => r.id === action.id);
      const j = i + action.delta;
      if (i < 0 || j < 0 || j >= state.rows.length) return state;
      const rows = [...state.rows];
      [rows[i], rows[j]] = [rows[j], rows[i]];
      return { ...state, rows };
    }
    default:
      return state;
  }
}

export function useProject(startId = 'ej1') {
  return useReducer(reducer, startId, (id) => projectFrom(EXAMPLES.find((x) => x.id === id) || EXAMPLES[0]));
}
