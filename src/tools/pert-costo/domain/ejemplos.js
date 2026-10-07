/**
 * Ejemplos cargables (propios, con datos inventados). Cada fila: [actividad, predecesoras, DN, CN, DL, CL].
 * Una duración límite vacía significa que la actividad no se puede acortar.
 */
const filas = (lista) => lista.map(([name, preds, dn, cn, dl, cl]) => ({
  name, preds, dn: String(dn), cn: String(cn), dl: dl === '' ? '' : String(dl), cl: cl === '' ? '' : String(cl),
}));

export const EJEMPLOS = [
  {
    id: 'rombo',
    titulo: 'Rombo de cuatro actividades',
    corto: 'Rombo',
    enunciado: 'Un proyecto pequeño: A va primero; B y C se hacen en paralelo después de A; D cierra el proyecto. D no se puede acortar. Cada día de proyecto cuesta 12 en costos indirectos.',
    ci: '12',
    fijo: '0',
    filas: filas([
      ['A', '-', 4, 10, 2, 30],
      ['B', 'A', 5, 20, 3, 60],
      ['C', 'A', 5, 20, 3, 40],
      ['D', 'B,C', 3, 15, '', ''],
    ]),
  },
  {
    id: 'cadena',
    titulo: 'Ruta única con una actividad barata fuera de la ruta',
    corto: 'Ruta única',
    enunciado: 'Una sola ruta crítica (A, B, C, E). D es la actividad más barata de acortar, pero no es crítica: acortarla no baja la duración del proyecto. Costo indirecto: 30 por día.',
    ci: '30',
    fijo: '0',
    filas: filas([
      ['A', '-', 4, 100, 2, 140],
      ['B', 'A', 6, 200, 4, 270],
      ['C', 'B', 5, 150, 2, 225],
      ['D', 'A', 3, 80, 1, 90],
      ['E', 'C,D', 3, 120, 2, 160],
    ]),
  },
  {
    id: 'obra',
    titulo: 'Obra con varias rutas críticas (7 actividades)',
    corto: 'Varias rutas',
    enunciado: 'E y F se ejecutan en paralelo después de C, así que hay dos rutas críticas simultáneas: para bajar la duración hay que acortar una actividad en cada ruta. Costo indirecto: 40 por día.',
    ci: '40',
    fijo: '0',
    filas: filas([
      ['A', '-', 3, 40, 1, 80],
      ['B', 'A', 8, 20, 4, 100],
      ['C', 'B', 5, 110, 3, 230],
      ['D', '-', 4, 150, '', ''],
      ['E', 'A,C', 6, 150, 2, 170],
      ['F', 'C', 6, 60, 4, 120],
      ['G', 'D,E,F', 6, 90, 2, 150],
    ]),
  },
  {
    id: 'puente',
    titulo: 'Red en puente: se alarga una actividad ya acortada',
    corto: 'Con alargue',
    enunciado: 'Red con el patrón en puente (D y E no dependen de lo mismo). En el último tramo la forma más barata de bajar es acortar A y E y volver a alargar C, que ya se había acortado. Costo indirecto: 60 por día.',
    ci: '60',
    fijo: '0',
    filas: filas([
      ['A', '-', 4, 30, 1, 180],
      ['B', '-', 4, 150, '', ''],
      ['C', 'A', 3, 130, 1, 200],
      ['D', 'A', 9, 90, 6, 165],
      ['E', 'B,C', 8, 60, 6, 180],
      ['F', 'D,E', 3, 90, 1, 140],
    ]),
  },
];

export const ejemploPorId = (id) => EJEMPLOS.find((e) => e.id === id) || EJEMPLOS[0];
