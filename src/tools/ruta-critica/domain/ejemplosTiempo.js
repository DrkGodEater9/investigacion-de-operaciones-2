// Ejemplos del tema 3.2 (Teoría y Paso a paso). Mismo formato de filas que «Resuelve el tuyo».
const cpm = (l) => l.map(([name, preds, d]) => ({ name, preds, d: String(d), a: '', m: '', b: '' }));
const pert = (l) => l.map(([name, preds, a, m, b]) => ({ name, preds, d: '', a: String(a), m: String(m), b: String(b) }));

export const EJEMPLOS_TIEMPO = [
  {
    id: 'cpm',
    etiqueta: 'CPM',
    modo: 'cpm',
    enunciado: 'Un proyecto de seis actividades, con duraciones en días. D solo necesita a B, pero C necesita a A y a B: por eso la red lleva una actividad ficticia.',
    rows: cpm([['A', '-', 3], ['B', '-', 1], ['C', 'A,B', 4], ['D', 'B', 5], ['E', 'C', 2], ['F', 'C,D', 3]]),
  },
  {
    id: 'cpm2',
    etiqueta: 'Dos rutas críticas',
    modo: 'cpm',
    enunciado: 'La misma red, pero con B de 2 días: ahora hay dos rutas con la misma duración y las dos son críticas.',
    rows: cpm([['A', '-', 3], ['B', '-', 2], ['C', 'A,B', 4], ['D', 'B', 5], ['E', 'C', 2], ['F', 'C,D', 3]]),
  },
  {
    id: 'pert',
    etiqueta: 'PERT',
    modo: 'pert',
    enunciado: 'La misma red con tres estimaciones por actividad (a optimista, m más probable, b pesimista), en días. Se quiere la probabilidad de terminar en 12 días o menos.',
    plazo: 12,
    rows: pert([['A', '-', 1, 3, 5], ['B', '-', 0, 1, 2], ['C', 'A,B', 2, 4, 6], ['D', 'B', 2, 5, 8], ['E', 'C', 1, 2, 3], ['F', 'C,D', 1, 2, 9]]),
  },
];

export const ejemploTiempoPorId = (id) => EJEMPLOS_TIEMPO.find((e) => e.id === id);
