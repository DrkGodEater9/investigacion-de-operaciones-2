/**
 * Pasos para la pestaña «Paso a paso». Cada paso: { titulo, texto, calculo[], starts, resalta, periodo }
 *  - starts: cronograma que se dibuja en ese paso (null = actividad aún sin programar).
 *  - resalta: { índice de actividad: 'programa' | 'retrasa' | 'mueve' | 'foco' }.
 *  - periodo: período (desde 1) que se destaca en el histograma, o null.
 */
import { cpm } from './cpm.js';
import { resumen } from './perfil.js';
import { nivelar } from './nivelar.js';
import { asignar, reglaPorId, claveVisible } from './asignar.js';
import { lista, periodos, textoPeriodos, textoReq, rangoPeriodos } from './format.js';

function lineaCpm(red, c, i) {
  return `${red.nombres[i]}: d = ${red.d[i]}, ES = ${c.ES[i]}, EF = ${c.EF[i]}, LS = ${c.LS[i]}, LF = ${c.LF[i]}, holgura = ${c.H[i]}${c.critica[i] ? ' (crítica)' : ''}`;
}

function pasoInicial(red, c, tituloExtra) {
  const res = resumen(red, c.ES);
  const lineas = red.nombres.map((_, i) => lineaCpm(red, c, i));
  const pasos = [{
    titulo: 'Tiempos de cada actividad (ruta crítica)',
    texto: `Primero se calcula el cronograma sin límites: cada actividad empieza en su comienzo temprano (ES). El proyecto dura ${periodos(c.T)}. La holgura es LS − ES: cuántos períodos se puede retrasar una actividad sin alargar el proyecto. Las críticas (holgura 0) no se pueden mover.`,
    calculo: lineas,
    starts: c.ES.slice(),
    resalta: {},
    periodo: null,
  }];
  const partes = res.porRecurso.map((r) => {
    const base = `${r.nombre}: ${r.uso.join(', ')} (pico ${r.pico} en ${textoPeriodos(r.periodosPico)})`;
    if (r.limite == null) return base;
    return base + (r.excesos.length ? `. Límite ${r.limite}: lo supera en ${textoPeriodos(r.excesos.map((e) => e.periodo))}` : `. Límite ${r.limite}: no lo supera`);
  });
  pasos.push({
    titulo: tituloExtra || 'Histograma del cronograma temprano',
    texto: 'El histograma suma, período a período, lo que consumen las actividades que están en curso. Las barras que superan el límite (línea roja) son los picos: ahí no hay recurso para todo lo que el cronograma temprano exige.',
    calculo: ['Consumo por período (1, 2, 3, …):', ...partes],
    starts: c.ES.slice(),
    resalta: {},
    periodo: null,
  });
  return pasos;
}

/* ---------------- Nivelación ---------------- */

export function pasosNivelar(red) {
  const c = cpm(red);
  const r = nivelar(red);
  const pasos = pasoInicial(red, c);
  pasos[1].texto += ' La nivelación no mira el límite: busca que las barras queden lo más parejas posible moviendo actividades no críticas dentro de su holgura.';
  pasos.push({
    titulo: 'Cómo se nivela',
    texto: 'Se recorren las actividades de atrás hacia adelante. Cada una tiene una ventana de comienzos posibles: desde que terminan sus predecesoras hasta que sus sucesoras deben empezar (o hasta el final del proyecto). Se mide la carga que ya hay en los períodos que ocuparía y se coloca donde esa carga es menor. Solo se mueve si mejora; si empata, se queda (o se toma el comienzo más temprano).',
    calculo: [`Medida de lo parejo: Σ (consumo por período)² = ${r.objetivoAntes} al empezar. Mientras más baja, más parejo.`],
    starts: c.ES.slice(),
    resalta: {},
    periodo: null,
  });
  r.log.forEach((e, n) => {
    const nom = red.nombres[e.act];
    const mejorCosto = Math.min(...e.costos.map((x) => x.costo));
    pasos.push({
      titulo: `Pasada ${e.pasada}: actividad ${nom}`,
      texto: e.movio
        ? `${nom} puede empezar entre ${e.ventana[0]} y ${e.ventana[1]}. La carga más baja está en el comienzo ${e.elegido} (carga ${mejorCosto}), menor que la de su comienzo actual ${e.antes} (carga ${e.costos.find((x) => x.s === e.antes).costo}). Se mueve: pasa de ${rangoPeriodos(e.antes, red.d[e.act])} a ${rangoPeriodos(e.elegido, red.d[e.act])}.`
        : `${nom} puede empezar entre ${e.ventana[0]} y ${e.ventana[1]}, pero ningún comienzo tiene menos carga que el actual (${e.antes}). Se queda en ${rangoPeriodos(e.antes, red.d[e.act])}.`,
      calculo: [
        `Requiere ${textoReq(red, e.act)} durante ${periodos(red.d[e.act])}.`,
        ...e.costos.map((x) => `Comienzo ${x.s}: carga existente ${x.costo}${x.s === e.elegido ? '  ← elegido' : ''}${x.s === e.antes && x.s !== e.elegido ? '  (actual)' : ''}`),
      ],
      starts: e.starts,
      resalta: { [e.act]: e.movio ? 'mueve' : 'foco' },
      periodo: null,
      paso: n,
    });
  });
  const fin = resumen(red, r.starts, c.T);
  const antes = resumen(red, c.ES);
  const movidas = r.starts.map((s, i) => (s !== c.ES[i] ? `${red.nombres[i]} (${c.ES[i]} → ${s})` : null)).filter(Boolean);
  pasos.push({
    titulo: 'Resultado de la nivelación',
    texto: `Una pasada completa sin movimientos termina el método (${r.pasadas} ${r.pasadas === 1 ? 'pasada' : 'pasadas'}). El proyecto sigue durando ${periodos(r.T)}: ninguna actividad crítica se movió.`,
    calculo: [
      `Actividades movidas: ${movidas.length ? lista(movidas) : 'ninguna'}.`,
      ...fin.porRecurso.map((p, k) => `${p.nombre}: pico ${antes.porRecurso[k].pico} → ${p.pico}${p.limite != null ? (p.pico <= p.limite ? ` (cabe en el límite ${p.limite})` : ` (sigue superando el límite ${p.limite}: hace falta limitar recursos)`) : ''}`),
      `Σ consumo²: ${r.objetivoAntes} → ${r.objetivoDespues}`,
    ],
    starts: r.starts.slice(),
    resalta: {},
    periodo: null,
    final: true,
  });
  return pasos;
}

/* ---------------- Asignación con recursos limitados ---------------- */

/** Frase que explica por qué B va después de A en la lista de prioridad. */
function porQueOrden(red, regla, c, a, b) {
  const ka = regla.clave(a, c, red);
  const kb = regla.clave(b, c, red);
  if (ka !== kb) return null;
  if (c.LS[a] !== c.LS[b]) return `${red.nombres[a]} y ${red.nombres[b]} empatan en ${regla.corto}: se desempata por menor LS (${c.LS[a]} contra ${c.LS[b]})`;
  if (c.H[a] !== c.H[b]) return `${red.nombres[a]} y ${red.nombres[b]} empatan en ${regla.corto} y en LS: se desempata por menor holgura (${c.H[a]} contra ${c.H[b]})`;
  return `${red.nombres[a]} y ${red.nombres[b]} empatan en todo: se desempata por el orden de la tabla`;
}

export function pasosAsignar(red, reglaId) {
  const c = cpm(red);
  const regla = reglaPorId(reglaId);
  const r = asignar(red, { regla: regla.id });
  if (!r.ok) return { ok: false, mensaje: r.mensaje, pasos: [] };
  const pasos = pasoInicial(red, c);
  pasos.push({
    titulo: 'Cómo se asigna',
    texto: `Se avanza período por período. En cada uno, las actividades elegibles (todas sus predecesoras ya terminaron) se ordenan por la regla «${regla.nombre.toLowerCase()}». En ese orden, cada una empieza si cabe en todos los recursos junto con las que ya están en curso; si no cabe, se retrasa y se vuelve a intentar en el período siguiente. Si hay empate se usa, en este orden: menor LS, menor holgura y el orden de la tabla.`,
    calculo: red.recursos.map((nom, k) => `Límite de ${nom}: ${red.limites[k]}`),
    starts: red.nombres.map(() => null),
    resalta: {},
    periodo: null,
  });
  r.log.forEach((p) => {
    const orden = p.elegibles.map((i) => `${red.nombres[i]} (${regla.corto} ${claveVisible(regla, i, c, red)})`);
    const desempates = [];
    for (let j = 1; j < p.elegibles.length; j++) {
      const t = porQueOrden(red, regla, c, p.elegibles[j - 1], p.elegibles[j]);
      if (t) desempates.push(t);
    }
    const resalta = {};
    const lineas = [];
    p.decisiones.forEach((d) => {
      const nom = red.nombres[d.act];
      resalta[d.act] = d.accion;
      if (d.accion === 'programa') {
        lineas.push(`${nom} (${textoReq(red, d.act)}): cabe, empieza ahora (${rangoPeriodos(p.t, red.d[d.act])}).`);
      } else {
        const f = d.falla;
        lineas.push(`${nom} (${textoReq(red, d.act)}): ${red.recursos[f.k]} ${f.uso} + ${f.req} = ${f.uso + f.req} > ${f.limite}. No cabe: se retrasa.`);
      }
    });
    const retrasadas = p.decisiones.filter((d) => d.accion === 'retrasa').map((d) => red.nombres[d.act]);
    const programadas = p.decisiones.filter((d) => d.accion === 'programa').map((d) => red.nombres[d.act]);
    pasos.push({
      titulo: `Período ${p.periodo}`,
      texto: `En curso: ${lista(p.enCurso.map((i) => red.nombres[i]))}. Elegibles por prioridad: ${lista(orden)}.${desempates.length ? ' ' + desempates.join('; ') + '.' : ''} ${programadas.length ? 'Empiezan: ' + lista(programadas) + '.' : 'No empieza ninguna.'}${retrasadas.length ? ' Se retrasan: ' + lista(retrasadas) + '.' : ''}`,
      calculo: [
        `Consumo de las que ya están en curso: ${red.recursos.map((nom, k) => `${nom} ${p.usoInicial[k]}`).join(', ')}`,
        ...lineas,
        `Consumo del período ${p.periodo}: ${red.recursos.map((nom, k) => `${nom} ${p.usoFinal[k]} de ${red.limites[k]}`).join(', ')}`,
      ],
      starts: p.starts,
      resalta,
      periodo: p.periodo,
      retrasadas: p.decisiones.filter((d) => d.accion === 'retrasa').map((d) => d.act),
    });
  });
  const antes = resumen(red, c.ES);
  const despues = resumen(red, r.starts, r.T);
  pasos.push({
    titulo: 'Resultado: nueva duración',
    texto: r.T > c.T
      ? `Para no pasar el límite hubo que retrasar actividades. El proyecto pasa de ${periodos(c.T)} a ${periodos(r.T)}.`
      : `Todas las actividades quedaron en su comienzo temprano o dentro de su holgura: el proyecto sigue durando ${periodos(c.T)}.`,
    calculo: [
      r.retrasos.length ? `Actividades retrasadas: ${lista(r.retrasos.map((x) => `${red.nombres[x.act]} (+${x.retraso}: de ${x.ES} a ${x.inicio})`))}.` : 'Ninguna actividad se retrasó.',
      ...despues.porRecurso.map((p, k) => `${p.nombre}: pico ${antes.porRecurso[k].pico} → ${p.pico} (límite ${p.limite})`),
      `Cota inferior de la duración: ${r.cota} (la ruta crítica y el trabajo total entre el límite). El método no garantiza el mínimo; otra regla puede dar menos.`,
    ],
    starts: r.starts.slice(),
    resalta: {},
    periodo: null,
    final: true,
  });
  return { ok: true, pasos, resultado: r, base: c };
}
