/**
 * Texto y estado de cada paso de la pestaña «Paso a paso». Todo sale de resolver(): aquí solo se redacta.
 *
 * Paso: { id, fase: 'datos'|'reduccion'|'conclusion', titulo, texto, calculo: string[],
 *         d, T, directo, indirecto, total, acortadas: string[], alargadas: string[],
 *         criticas: string[], rutas: string[][], hasta: T (hasta dónde llega la curva) }
 */
import { cortesPosibles } from './alternativas.js';
import { NOTACION } from './notacion.js';
import { num, lista } from './formato.js';

const seAcorta = (k) => (k === 1 ? 'Se acorta 1 unidad' : `Se acortan ${k} unidades`);

const SIGNO = { '<': '<', '=': '=', '>': '>' };

export function textoRuta(ruta, nombres) {
  const corto = nombres.every((n) => n.length === 1);
  return ruta.join(corto ? '–' : ' → ');
}

const textoRutas = (rutas, nombres) => rutas.map((r) => textoRuta(r, nombres)).join(' y ');

const MAX_LISTADAS = 12;

/** «Hay 2 rutas críticas simultáneas (A–B y A–C)»; con muchas rutas (o truncadas) solo se cuenta y se ejemplifica. */
export function hayRutas(rutas, truncado, nombres) {
  if (!truncado && rutas.length <= MAX_LISTADAS) return `Hay ${rutas.length} rutas críticas simultáneas (${textoRutas(rutas, nombres)})`;
  return `Hay ${truncado ? 'más de ' : ''}${rutas.length} rutas críticas simultáneas (por ejemplo ${textoRutas(rutas.slice(0, 2), nombres)})`;
}

/** Pasos del ejemplo resuelto. m = modelo, res = resolver(m). */
export function explicarPasos(m, res) {
  const nombres = m.names;
  const ci = m.ci;
  const pasos = [];
  const n = NOTACION;

  // 1. Pendientes
  pasos.push({
    id: 'pendientes',
    fase: 'datos',
    titulo: 'Pendiente de costo de cada actividad',
    texto: `Primero se calcula cuánto cuesta acortar cada actividad una unidad de tiempo: ${n.formulaPendiente}. Una actividad con duración normal igual a la límite no se puede acortar.`,
    calculo: m.names.map((nom, j) => (m.pend[j] == null
      ? `${nom}: no se puede acortar (${n.dn} = ${n.dl} = ${num(m.dn[j])})`
      : `${nom}: (${num(m.cl[j])} − ${num(m.cn[j])}) / (${num(m.dn[j])} − ${num(m.dl[j])}) = ${num(m.pend[j])}`)),
    d: m.dn.slice(),
    T: res.T0,
    directo: res.normal.directo,
    indirecto: res.normal.indirecto,
    total: res.normal.total,
    acortadas: [],
    alargadas: [],
    criticas: [],
    rutas: [],
    hasta: res.T0,
  });

  // 2. Duración normal
  const rn = res.normal.rutas.rutas;
  pasos.push({
    id: 'normal',
    fase: 'datos',
    titulo: 'Proyecto con duraciones normales',
    texto: `Con todas las actividades en su duración normal el proyecto dura ${res.T0}. ${rn.length === 1 ? `La ruta crítica es ${textoRutas(rn, nombres)}` : `${hayRutas(rn, res.normal.rutas.truncado, nombres)}`}. El costo directo es la suma de los costos normales; el costo indirecto es ${n.ci} por la duración.`,
    calculo: [
      `Duración normal = ${res.T0}`,
      `Costo directo = Σ ${n.cn} = ${num(res.normal.directo)}`,
      `Costo indirecto = ${num(ci)} × ${res.T0}${m.fijo ? ` + ${num(m.fijo)}` : ''} = ${num(res.normal.indirecto)}`,
      `Costo total = ${num(res.normal.directo)} + ${num(res.normal.indirecto)} = ${num(res.normal.total)}`,
    ],
    d: m.dn.slice(),
    T: res.T0,
    directo: res.normal.directo,
    indirecto: res.normal.indirecto,
    total: res.normal.total,
    acortadas: [],
    alargadas: [],
    criticas: nombres.filter((_, j) => res.normal.tiempos.critica[j]),
    rutas: rn,
    hasta: res.T0,
  });

  // 3. Reducciones
  res.pasos.forEach((p) => {
    const antes = res.estadoEn(p.desde);
    const acort = p.acortan.map((a) => a.nombre);
    const alar = p.alargan.map((a) => a.nombre);
    const rutasA = p.rutasAntes;
    const irreducibles = p.candidatas.filter((c) => !c.reducible && !alar.includes(c.nombre)).map((c) => c.nombre);
    const cand = p.candidatas.filter((c) => c.reducible);
    const candTxt = cand.map((c) => `${c.nombre} ${num(c.pend)}`).join(', ');
    let que;
    if (p.tipo === 'una') {
      if (rutasA.length > 1) {
        que = `${hayRutas(rutasA, p.rutasAntesTruncado, nombres)}, así que hay que acortar al menos una actividad en cada ruta. ${acort[0]} está en todas: acortarla baja la duración de todas a la vez y es la opción más barata (pendiente ${num(p.pendiente)}).`;
      } else if (cand.length === 1) {
        que = `La ruta crítica es ${textoRutas(rutasA, nombres)}. Se acorta ${acort[0]}, la única actividad crítica que todavía se puede acortar.`;
      } else {
        que = `La ruta crítica es ${textoRutas(rutasA, nombres)}. Se acorta ${acort[0]}, la actividad crítica con menor pendiente (${candTxt}).`;
      }
    } else if (p.tipo === 'conjunto') {
      que = `${hayRutas(rutasA, p.rutasAntesTruncado, nombres)}. Acortar una sola actividad no basta: hay que acortar al menos una en cada ruta crítica, y el conjunto de menor costo por unidad es ${lista(acort)} (${p.acortan.map((a) => num(a.pend)).join(' + ')} = ${num(p.pendiente)}).`;
    } else {
      que = `${hayRutas(rutasA, p.rutasAntesTruncado, nombres)}. El corte más barato acorta ${lista(acort)} y alarga ${lista(alar)}: ${alar.length === 1 ? 'esa actividad ya se había acortado antes' : 'esas actividades ya se habían acortado antes'}, y devolverle${alar.length === 1 ? '' : 's'} una unidad recupera su costo (${p.alargan.map((a) => num(a.pend)).join(' + ')}). Costo neto por unidad: ${p.acortan.map((a) => num(a.pend)).join(' + ')} − ${p.alargan.map((a) => num(a.pend)).join(' − ')} = ${num(p.pendiente)}.`;
    }
    if (irreducibles.length) que += ` ${lista(irreducibles)} ${irreducibles.length === 1 ? 'ya está' : 'ya están'} en ${irreducibles.length === 1 ? 'su límite y no se puede' : 'su límite y no se pueden'} acortar más.`;

    const corte = p.tipo === 'con-alargue' ? null : cortesPosibles(m, antes.d, 4);
    if (p.tipo === 'con-alargue') {
      const sin = cortesPosibles(m, antes.d, 1);
      const mejor = sin && sin.cortes[0];
      if (!sin) que += ' Solo acortar actividades (sin devolver tiempo) no alcanzaría para bajar la duración.';
      else if (!mejor) que += ' Sin devolver tiempo a ninguna actividad no hay forma de bajar la duración.';
      else if (mejor.costo > p.pendiente + 1e-9) que += ` Si solo se acortara (sin devolver tiempo), lo más barato desde aquí sería ${lista(mejor.actividades)} (${num(mejor.costo)} por unidad), que cuesta más: por eso aquí el procedimiento de solo acortar no da el costo mínimo.`;
    }
    if (corte && p.tipo === 'conjunto') {
      const otras = corte.cortes.filter((c) => c.actividades.join() !== acort.join()).slice(0, 3);
      if (otras.length) que += ` Otras opciones que cortan todas las rutas: ${otras.map((c) => `${lista(c.actividades)} (${num(c.costo)})`).join('; ')}.`;
    }

    const cuanto = p.termina === 'fin'
      ? `${seAcorta(p.unidades)}, hasta llegar a la duración mínima posible (${res.Tmin}).`
      : p.termina === 'limite'
        ? `${seAcorta(p.unidades)} porque ${lista(p.llegaLimite)} ${p.llegaLimite.length === 1 ? 'llega' : 'llegan'} a su duración límite.`
        : p.criticasAntes.join() === p.criticasDespues.join()
          ? `${seAcorta(p.unidades)}; con una más el corte más barato cambia (las actividades críticas son las mismas, pero lo que ya se acortó modifica las opciones).`
          : `${seAcorta(p.unidades)}; con una más cambian las actividades críticas (otra ruta se vuelve crítica) y cambia el corte.`;

    const cmp = p.empata ? '=' : p.conviene ? '<' : '>';
    const veredicto = p.empata
      ? `Cada unidad cuesta ${num(p.pendiente)}, igual que lo que ahorra en costos indirectos (${num(ci)}): da lo mismo reducir o no.`
      : p.conviene
        ? `Cada unidad cuesta ${num(p.pendiente)} y ahorra ${num(ci)} en costos indirectos: conviene.`
        : `Cada unidad cuesta ${num(p.pendiente)} y solo ahorra ${num(ci)} en costos indirectos: ya no conviene reducir.`;

    const sumaCorte = p.acortan.map((a) => num(a.pend)).join(' + ') + p.alargan.map((a) => ` − ${num(a.pend)}`).join('');
    const lineaPend = p.tipo === 'una'
      ? `Pendiente de ${acort[0]} = ${num(p.pendiente)} por unidad`
      : `Pendiente del corte ${p.tipo === 'conjunto' ? `{${acort.join(', ')}}` : ''} = ${sumaCorte} = ${num(p.pendiente)} por unidad`.replace('corte  =', 'corte =');
    pasos.push({
      id: 'red' + p.n,
      fase: 'reduccion',
      n: p.n,
      conviene: p.conviene,
      empata: p.empata,
      titulo: `Reducción ${p.n}: de ${p.desde} a ${p.hasta}`,
      texto: `${que} ${cuanto} ${veredicto}`,
      calculo: [
        lineaPend,
        `Costo directo = ${num(antes.directo)} + ${num(p.pendiente)} × ${p.unidades} = ${num(p.directo)}`,
        `Costo indirecto = ${num(ci)} × ${p.hasta}${m.fijo ? ` + ${num(m.fijo)}` : ''} = ${num(p.indirecto)}`,
        `Costo total = ${num(p.directo)} + ${num(p.indirecto)} = ${num(p.total)}`,
        `Pendiente ${num(p.pendiente)} ${SIGNO[cmp]} ${n.ci} ${num(ci)}`,
      ],
      d: p.d,
      T: p.hasta,
      directo: p.directo,
      indirecto: p.indirecto,
      total: p.total,
      acortadas: acort,
      alargadas: alar,
      criticas: p.criticasDespues,
      rutas: p.rutasDespues,
      hasta: p.hasta,
    });
  });

  // 4. Conclusión
  const o = res.optimo;
  const e = res.estadoEn(o.T);
  const primeraNo = res.pasos.find((p) => !p.conviene);
  let porque;
  if (!res.pasos.length) porque = 'Ninguna actividad se puede acortar, así que el proyecto solo puede durar su duración normal.';
  else if (!primeraNo) porque = 'Todas las reducciones convienen, así que se llega hasta la duración límite del proyecto.';
  else if (primeraNo.desde === res.T0 && !primeraNo.empata) porque = `La primera reducción ya cuesta más de lo que ahorra (${num(primeraNo.pendiente)} > ${num(ci)}), así que no conviene acortar nada.`;
  else porque = `Se acorta mientras la pendiente sea menor que el costo indirecto por unidad (${num(ci)}). La reducción ${primeraNo.n} cuesta ${num(primeraNo.pendiente)} ${primeraNo.empata ? '(igual)' : '(más)'}, así que se detiene en ${primeraNo.desde}.`;
  const empates = o.empates.length > 1 ? ` Hay empate de costo total en las duraciones ${o.empates.join(', ')}; se informa la más larga porque da el mismo costo con menos esfuerzo.` : '';
  pasos.push({
    id: 'optimo',
    fase: 'conclusion',
    titulo: `Duración de costo mínimo: ${o.T}`,
    texto: `${porque}${empates}`,
    calculo: [
      `Duración óptima = ${o.T}`,
      `Costo directo = ${num(e.directo)}`,
      `Costo indirecto = ${num(e.indirecto)}`,
      `Costo total mínimo = ${num(o.total)}`,
    ],
    d: e.d,
    T: o.T,
    directo: e.directo,
    indirecto: e.indirecto,
    total: e.total,
    acortadas: [],
    alargadas: [],
    criticas: [],
    rutas: [],
    hasta: res.Tmin,
    optimo: true,
  });
  return pasos;
}
