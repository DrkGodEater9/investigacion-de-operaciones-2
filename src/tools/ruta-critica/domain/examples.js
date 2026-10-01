// Ejercicios de los archivos RUTA_CRITICA.xlsx y RUTA_CRITICA_CON_EXCEL.xlsx
const rowsCPM = (list) =>
  list.map(([name, preds, d]) => ({ name, preds, d: String(d), a: '', m: '', b: '' }));
const rowsPERT = (list) =>
  list.map(([name, preds, a, m, b]) => ({ name, preds, d: '', a: String(a), m: String(m), b: String(b) }));

export const EXAMPLES = [
  {
    id: 'ej1',
    title: 'Ejercicio 1',
    mode: 'cpm',
    activities: rowsCPM([
      ['A', '-', 2], ['B', '-', 5], ['C', '-', 1], ['D', 'A', 6], ['E', 'A', 7], ['F', 'A', 3],
      ['G', 'B,F', 2], ['H', 'B,F', 4], ['I', 'C', 7], ['J', 'D,E,G', 2], ['K', 'E,G', 8], ['L', 'H,I', 10],
    ]),
  },
  {
    id: 'ej2',
    title: 'Ejercicio 2 (PERT)',
    mode: 'pert',
    activities: rowsPERT([
      ['A', '-', 18, 28, 32], ['B', '-', 18, 22, 38], ['C', '-', 20, 25, 30], ['D', 'A,B', 15, 19, 29],
      ['E', 'B', 18, 23, 28], ['F', 'B,C', 16, 20, 30], ['G', 'D,E', 10, 14, 24], ['H', 'E', 15, 16, 23],
      ['I', 'E,F', 10, 20, 24], ['J', 'G,H', 8, 12, 22], ['K', 'G,H', 9, 14, 25], ['L', 'H,I', 10, 15, 26],
      ['M', 'H,I', 10, 16, 28], ['N', 'J,K', 15, 19, 23], ['O', 'J,K', 13, 20, 33], ['P', 'J,K,L,M', 19, 26, 27],
      ['Q', 'L,M', 18, 22, 32], ['R', 'L,M', 12, 21, 24], ['S', 'N,O,P', 18, 27, 36], ['T', 'N,O,P', 18, 31, 38],
      ['U', 'O,P,Q', 13, 22, 25], ['V', 'P,Q,R', 17, 24, 31], ['W', 'P,Q,R', 16, 27, 32], ['X', 'S', 10, 17, 24],
      ['Y', 'S,T', 8, 15, 22], ['Z', 'S,T,U', 7, 12, 23], ['α', 'S,T,U,V', 6, 11, 22], ['β', 'S,T,U,V,W', 9, 19, 23],
      ['γ', 'X,Y,Z', 12, 25, 32], ['δ', 'X,Y,Z', 24, 29, 40], ['λ', 'Z,α,β', 13, 27, 35], ['ρ', 'Z,α,β', 14, 25, 30],
    ]),
  },
  {
    id: 'ej3',
    title: 'Ejercicio 3',
    mode: 'cpm',
    activities: rowsCPM([
      ['A', '-', 20], ['B', '-', 22], ['C', '-', 25], ['D', 'A', 25], ['E', 'A,B,C', 24], ['F', 'C', 30],
      ['G', 'D,E', 15], ['H', 'E', 20], ['I', 'E,F', 25], ['J', 'G,H,I', 18], ['K', 'G,H', 13], ['L', 'G', 22],
      ['M', 'J,K', 24], ['N', 'J,K', 13], ['O', 'K,L', 17], ['P', 'K,L', 21],
    ]),
  },
  {
    id: 'ej4',
    title: 'Ejercicio 4',
    mode: 'cpm',
    activities: rowsCPM([
      ['A', '-', 6], ['B', '-', 3], ['C', 'B,D', 3], ['D', '-', 10], ['E', '-', 4], ['F', 'A', 4],
      ['G', 'A', 8], ['H', 'C', 4], ['I', 'A,E,B', 12], ['J', 'I,H', 2], ['K', 'F,G', 4], ['L', 'G,I', 6],
    ]),
  },
  {
    id: 'ej5',
    title: 'Ejercicio 5 (solo red)',
    mode: 'network',
    activities: rowsCPM([
      ['A', '-', 3], ['B', '-', 2], ['C', 'B,D', 1], ['D', '-', 6], ['E', '-', 2], ['F', 'A', 2],
      ['G', 'A', 4], ['H', 'C', 2], ['I', 'A,E,B', 8], ['J', 'I,H', 1], ['K', 'F,G', 2], ['L', 'G,I', 4],
    ]),
  },
  {
    id: 'clase',
    title: 'Ejercicio en clase',
    mode: 'cpm',
    activities: rowsCPM([
      ['A', '--', 20], ['B', '--', 22], ['C', '--', 25], ['D', 'A', 25], ['E', 'A,B,C', 24], ['F', 'C', 30],
      ['G', 'D,E', 15], ['H', 'E', 20], ['I', 'E,F', 25], ['J', 'G,H,I', 18], ['K', 'G,H', 13], ['L', 'G', 22],
      ['M', 'J,K', 24], ['N', 'J,K', 13], ['O', 'K,L', 17], ['P', 'K,L', 21],
    ]),
  },
];
