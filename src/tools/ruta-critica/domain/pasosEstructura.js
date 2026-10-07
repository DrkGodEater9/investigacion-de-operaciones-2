// Paso a paso del tema 3.1: construcción de la red actividad por actividad.
// Función pura: de la tabla de actividades y predecesoras sale la lista de pasos (texto, cálculo y red que se dibuja).
import { buildNetwork } from './network.js';
import { computeLayout } from './layout.js';
import { alcanceEventos, verificarRed, contarFicticias, nombresOrdenados } from './dependenciasRed.js';

const FANTASMA = '\u0001';

const lista = (xs) => {
  const a = [...xs];
  if (a.length <= 1) return a.join('');
  return a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1];
};
const pl = (xs, a, b) => (xs.length > 1 ? b : a);
const conj = (xs) => (xs.length ? '{' + xs.join(', ') + '}' : '{ }');

/** Orden en que se agregan las actividades: el de la tabla, aplazando las que aún no tienen todas sus predecesoras. */
export function ordenConstruccion(acts) {
  const hechas = new Set();
  const pendientes = acts.map((a) => a.name);
  const byName = new Map(acts.map((a) => [a.name, a]));
  const orden = [];
  while (pendientes.length) {
    const i = pendientes.findIndex((nm) => byName.get(nm).preds.every((p) => hechas.has(p)));
    if (i < 0) throw new Error('La tabla tiene un ciclo de dependencias.');
    const [nm] = pendientes.splice(i, 1);
    hechas.add(nm);
    orden.push(nm);
  }
  return orden;
}

/**
 * Red de las primeras actividades. Cada actividad sin sucesoras recibe temporalmente una actividad "fantasma"
 * para que sus extremos no se junten antes de tiempo; luego se quitan y quedan como flechas abiertas.
 * Con todas las actividades se devuelve la red completa (con evento final).
 */
export function redParcial(acts, completa = false) {
  if (completa) return buildNetwork(acts);
  const conSucesora = new Set(acts.flatMap((a) => a.preds));
  const fant = acts.filter((a) => !conSucesora.has(a.name)).map((a) => ({ name: FANTASMA + a.name, preds: [a.name] }));
  const net = buildNetwork([...acts, ...fant]);
  const edges = net.edges.filter((e) => !(e.kind === 'activity' && e.act.startsWith(FANTASMA)));
  const usados = new Set([net.start, ...edges.flatMap((e) => [e.from, e.to])]);
  return { ...net, edges, nodes: net.nodes.filter((v) => usados.has(v)), end: null };
}

/** Por qué existe cada ficticia de la red: [{ id, tipo, texto, desde, hasta }]. */
export function explicarFicticias(net) {
  const reach = alcanceEventos(net);
  const actsIn = (v) => net.edges.filter((e) => e.to === v && e.kind === 'activity').map((e) => e.act);
  const actsOut = (v) => net.edges.filter((e) => e.from === v && e.kind === 'activity').map((e) => e.act);
  const donde = (v) => (actsIn(v).length ? `donde termina${actsIn(v).length > 1 ? 'n' : ''} ${lista(actsIn(v))}` : 'inicial');
  const out = [];
  for (const d of net.edges.filter((e) => e.kind === 'dummy')) {
    const RU = nombresOrdenados(reach.get(d.from));
    const RV = nombresOrdenados(reach.get(d.to));
    const sale = actsOut(d.from);
    const salenV = actsOut(d.to);
    const entrada = net.edges.find((e) => e.to === d.from && e.kind === 'activity');
    const hermana = entrada && net.edges.find((e) => e !== entrada && e.kind === 'activity' && e.from === entrada.from && e.to === d.to);
    let tipo;
    let texto;
    if (!sale.length && hermana) {
      tipo = 'paralela';
      texto = `${hermana.act} y ${entrada.act} saldrían del mismo evento y llegarían al mismo evento, y dos actividades no pueden compartir sus dos extremos. Por eso ${entrada.act} termina en un evento propio y se une con una ficticia.`;
    } else if (sale.length) {
      const extra = RV.filter((x) => !RU.includes(x));
      tipo = 'dependencia';
      const alDest = salenV.length ? `de él ${pl(salenV, 'sale', 'salen')} ${lista(salenV)}, que ${pl(salenV, 'espera', 'esperan')} ${conj(RV)}` : `lo que sigue espera ${conj(RV)}`;
      texto = `Del evento ${donde(d.from)} ${pl(sale, 'sale', 'salen')} ${lista(sale)}, que solo ${pl(sale, 'espera', 'esperan')} ${conj(RU)}. El evento siguiente espera además a ${conj(extra)} y ${alDest}. Si ${lista(actsIn(d.from))} terminara en el mismo evento que ${lista(extra)}, ${lista(sale)} tendría que esperar también a ${conj(extra)}; la ficticia evita ese retraso falso.`;
    } else {
      tipo = 'union';
      texto = `Une el evento ${donde(d.from)} con el evento ${donde(d.to)} para que se cumplan las dependencias.`;
    }
    out.push({ id: d.id, tipo, texto, desde: d.from, hasta: d.to });
  }
  return out;
}

const firma = (reach, d) => nombresOrdenados(reach.get(d.from)).join(',') + '>' + nombresOrdenados(reach.get(d.to)).join(',');

/** Pasos de la construcción. Cada paso: { tipo, titulo, texto, calculo[], net, resaltar:Set<edgeId>, numeros?: Map }. */
export function pasosConstruccion(acts) {
  const total = acts.length;
  const byName = new Map(acts.map((a) => [a.name, a]));
  const orden = ordenConstruccion(acts);
  const redes = [];
  for (let k = 1; k <= total; k++) {
    const sub = orden.slice(0, k).map((nm) => byName.get(nm));
    redes.push(redParcial(sub, k === total));
  }
  const final = redes[total - 1];
  const pasos = [];
  pasos.push({
    tipo: 'inicio',
    titulo: 'Punto de partida',
    texto: `Se parte de un solo evento, el inicial. La tabla tiene ${total} actividades; se agregan de a una, de modo que cada una se dibuja cuando ya están dibujadas sus predecesoras.`,
    calculo: [`Orden de construcción: ${orden.join(', ')}`],
    net: { nodes: ['n0'], edges: [], start: 'n0', end: null },
    resaltar: new Set(),
  });

  let prevFirmas = new Set();
  let prevCount = 0;
  let prevTipos = new Map();
  for (let k = 1; k <= total; k++) {
    const nm = orden[k - 1];
    const a = byName.get(nm);
    const sub = orden.slice(0, k).map((x) => byName.get(x));
    const net = redes[k - 1];
    const reach = alcanceEventos(net);
    const notas = buildNetwork(sub).notes.filter((n) => n.activity === nm);
    const dums = net.edges.filter((e) => e.kind === 'dummy');
    const firmas = new Set(dums.map((d) => firma(reach, d)));
    const nuevas = dums.filter((d) => !prevFirmas.has(firma(reach, d)));
    const razones = explicarFicticias(net);
    const resaltar = new Set();
    net.edges.forEach((e) => {
      if (e.kind === 'activity' && e.act === nm) resaltar.add(e.id);
    });
    nuevas.forEach((d) => resaltar.add(d.id));

    let texto;
    if (!a.preds.length) texto = `${nm} no tiene predecesoras: puede empezar de inmediato, así que sale del evento inicial.`;
    else if (a.preds.length === 1) texto = `${nm} solo espera a ${a.preds[0]}: sale del evento donde termina ${a.preds[0]}.`;
    else texto = `${nm} espera a ${lista(a.preds)}: sale de un evento al que llegan todas esas actividades, y solo ellas.`;
    for (const n of notas) {
      texto += ` ${nm} figura como dependiente de ${n.removed} y de ${n.via}, pero ${n.via} ya depende de ${n.removed}; basta con esperar a ${n.via}.`;
    }
    const calculo = [`Predecesoras de ${nm}: ${a.preds.length ? lista(a.preds) : 'ninguna'}`];
    if (nuevas.length) {
      texto += ' Aquí hace falta una actividad ficticia. ' + nuevas.map((d) => razones.find((x) => x.id === d.id).texto).join(' ');
      calculo.push(`Ficticias nuevas: ${nuevas.length}; en total hay ${dums.length}.`);
    } else if (dums.length < prevCount) {
      texto += ' Con esta actividad la red se reorganiza y ya no hace falta una de las ficticias anteriores.';
      calculo.push(`Ficticias en total: ${dums.length} (antes ${prevCount}).`);
    } else {
      texto += ' No hace falta ninguna ficticia nueva.';
      calculo.push(`Ficticias en total: ${dums.length}.`);
    }
    // Una ficticia que ya estaba puede pasar a ser indispensable por una razón distinta (p. ej. de separar paralelas a respetar una dependencia).
    for (const d of dums) {
      const f = firma(reach, d);
      const r = razones.find((x) => x.id === d.id);
      if (prevTipos.get(f) === 'paralela' && r.tipo === 'dependencia') {
        texto += ` La ficticia que ya estaba dibujada ahora cumple otro papel, y es indispensable: ${r.texto}`;
      }
    }
    calculo.push(`Actividades dibujadas: ${k} de ${total}.`);
    pasos.push({ tipo: 'actividad', actividad: nm, titulo: `Agregar la actividad ${nm}`, texto, calculo, net, resaltar });
    prevFirmas = firmas;
    prevTipos = new Map(dums.map((d) => [firma(reach, d), razones.find((x) => x.id === d.id).tipo]));
    prevCount = dums.length;
  }

  // Comprobación de dependencias
  const ver = verificarRed(acts, final);
  const reachF = alcanceEventos(final);
  const cal = acts.map((a) => {
    const e = final.edges.find((x) => x.kind === 'activity' && x.act === a.name);
    return `${a.name}: la red la hace esperar a ${conj(nombresOrdenados(reachF.get(e.from)))}`;
  });
  pasos.push({
    tipo: 'verificacion',
    titulo: 'Comprobar las dependencias',
    texto: ver.ok
      ? 'Para cada actividad se mira qué actividades deben terminar para llegar a su evento de inicio (siguiendo flechas y ficticias). Coincide con la tabla, contando las predecesoras de las predecesoras: ninguna espera de más ni de menos.'
      : 'La red no coincide con la tabla.',
    calculo: cal,
    net: final,
    resaltar: new Set(final.edges.filter((e) => e.kind === 'dummy').map((e) => e.id)),
    ok: ver.ok,
  });

  // Numeración
  const layout = computeLayout(final);
  const n = layout.numbered.length;
  for (let k = 1; k <= n; k++) {
    const v = layout.numbered[k - 1];
    const entradas = final.edges.filter((e) => e.to === v);
    const prev = [...new Set(entradas.map((e) => layout.number[e.from]))].sort((x, y) => x - y);
    let texto;
    if (!entradas.length) texto = 'Evento inicial: no le llega ninguna flecha, así que recibe el número 1.';
    else {
      texto = `Al evento ${prev.length > 1 ? 'le llegan flechas desde' : 'le llega una flecha desde'} ${lista(prev.map((x) => `el ${x}`))}, que ${prev.length > 1 ? 'ya están numerados' : 'ya está numerado'}. Recibe el ${k}, mayor que ${prev.length > 1 ? 'todos ellos' : 'él'}.`;
      if (k === n) texto += ' Es el evento final: no sale ninguna flecha de él.';
    }
    pasos.push({
      tipo: 'numeracion',
      titulo: `Numerar el evento ${k}`,
      texto,
      calculo: [
        entradas.length
          ? `Flechas que llegan: ${entradas.map((e) => `${e.kind === 'dummy' ? 'ficticia' : e.act} (${layout.number[e.from]}, ${k})`).join(', ')}`
          : 'Flechas que llegan: ninguna',
      ],
      net: final,
      resaltar: new Set(entradas.map((e) => e.id)),
      numeros: new Map(layout.numbered.slice(0, k).map((u) => [u, layout.number[u]])),
    });
  }
  const nf = contarFicticias(final);
  pasos.push({
    tipo: 'resumen',
    titulo: 'Red terminada',
    texto: `La red tiene ${n} eventos y ${nf} ${nf === 1 ? 'ficticia' : 'ficticias'}. Todas las flechas van de un número menor a uno mayor (i < j): el evento inicial es el 1 y el final es el ${n}.`,
    calculo: [`Eventos: ${n}`, `Actividades: ${total}`, `Ficticias: ${nf}`],
    net: final,
    resaltar: new Set(),
    numeros: new Map(layout.numbered.map((u) => [u, layout.number[u]])),
  });
  return { pasos, orden, red: final, layout };
}
