/** Ejemplos cargables (Resuelve el tuyo, Paso a paso y Teoría). Los números del ejemplo B1 se verifican a mano en las pruebas. */

export const EJEMPLOS = [
  {
    id: 'B1',
    titulo: 'Terreno petrolero (utilidades)',
    enunciado:
      'Una empresa es dueña de un terreno que puede tener petróleo (30 %) o estar seco (70 %). Puede perforar o vender el terreno. '
      + 'Antes de decidir puede pagar un estudio sísmico, que sale favorable el 80 % de las veces si hay petróleo y el 30 % de las veces si el terreno está seco. Los pagos están en millones.',
    problema: {
      objetivo: 'max',
      alternativas: ['Perforar', 'Vender'],
      estados: ['Petróleo', 'Seco'],
      pagos: [[500, -100], [60, 60]],
      priori: [0.3, 0.7],
      indicadores: ['Favorable', 'Desfavorable'],
      verosimilitud: [[0.8, 0.2], [0.3, 0.7]],
    },
  },
  {
    id: 'B2',
    titulo: 'Mantenimiento de una máquina (costos)',
    enunciado:
      'Una planta decide cómo tratar una máquina cuyo desgaste puede ser leve (60 %) o grave (40 %). Los pagos son costos en millones y se quiere el menor costo esperado. '
      + 'Una prueba de vibración sale «Normal» con probabilidad 0,85 si el desgaste es leve y 0,2 si es grave.',
    problema: {
      objetivo: 'min',
      alternativas: ['Esperar a la falla', 'Reparar ahora', 'Reemplazar'],
      estados: ['Desgaste leve', 'Desgaste grave'],
      pagos: [[10, 200], [50, 80], [100, 100]],
      priori: [0.6, 0.4],
      indicadores: ['Normal', 'Alta'],
      verosimilitud: [[0.85, 0.15], [0.2, 0.8]],
    },
  },
  {
    id: 'B3',
    titulo: 'Lanzamiento de un producto (3 estados y 3 resultados)',
    enunciado:
      'Una empresa evalúa lanzar un producto a nivel nacional, solo en una región o no lanzarlo. La demanda puede ser alta (30 %), media (50 %) o baja (20 %). '
      + 'Una encuesta de mercado resulta «Buena», «Regular» o «Mala» con las probabilidades de la tabla de verosimilitud. Pagos en millones.',
    problema: {
      objetivo: 'max',
      alternativas: ['Lanzamiento nacional', 'Lanzamiento regional', 'No lanzar'],
      estados: ['Demanda alta', 'Demanda media', 'Demanda baja'],
      pagos: [[900, 300, -400], [400, 250, -50], [0, 0, 0]],
      priori: [0.3, 0.5, 0.2],
      indicadores: ['Buena', 'Regular', 'Mala'],
      verosimilitud: [[0.7, 0.2, 0.1], [0.25, 0.5, 0.25], [0.1, 0.3, 0.6]],
    },
  },
  {
    id: 'B4',
    titulo: 'Pedido de inventario (costos, sin información muestral)',
    enunciado:
      'Una tienda decide cuántas unidades pedir (100, 200 o 300) sin saber si la demanda será de 100 (30 %), 200 (40 %) o 300 (30 %). Los pagos son costos totales (pedido más faltantes). '
      + 'No hay estudio previo: solo se puede calcular el valor esperado y el valor de la información perfecta.',
    problema: {
      objetivo: 'min',
      alternativas: ['Pedir 100', 'Pedir 200', 'Pedir 300'],
      estados: ['Demanda 100', 'Demanda 200', 'Demanda 300'],
      pagos: [[500, 900, 1300], [700, 700, 1100], [900, 900, 900]],
      priori: [0.3, 0.4, 0.3],
    },
  },
];

export const ejemploPorId = (id) => EJEMPLOS.find((e) => e.id === id);
