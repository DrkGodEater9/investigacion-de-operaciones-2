/**
 * Pasos de la pestaña «Paso a paso» del tema 3.2 (análisis del tiempo). Funciones puras.
 *
 * pasosTiempo({ rows, modo: 'cpm' | 'pert', plazo }) →
 *   { ok, analysis, filas, res, pasos, pert }
 *
 * Cada paso: { fase, titulo, texto, calculo: [líneas], estado }
 *   estado = {
 *     actual:  nombre de la actividad que se calcula (o null),
 *     early:   ids de eventos con tiempo más temprano ya calculado,
 *     late:    ids de eventos con tiempo más tardío ya calculado,
 *     cols:    { te, tic, til, ht, hl, crit } → nombres de actividades cuya columna ya se muestra,
 *     rutas:   null | [[nombres]] rutas críticas que se resaltan,
 *     campana: null | { Te, sd, T, z, p },
 *   }
 * Los números de los pasos salen de tiempos.js (cálculo sobre la tabla); los eventos del dibujo,
 * de la red de analyze(). Las pruebas comparan ambos.
 */
import { analyze } from './analyze.js';
import { calcularTiempos, calcularPERT } from './tiempos.js';
import { phi } from './normal.js';
import { fmt } from './format.js';
import { NOT } from './notacion.js';

const f = (x) => fmt(x, 2).replace('-', '−');
const f4 = (x) => fmt(x, 4).replace('-', '−');
const lista = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

function eventosTempranos(net, hechas) {
  const sab = new Set([net.start]);
  for (let cambio = true; cambio; ) {
    cambio = false;
    for (const v of net.nodes) {
      if (sab.has(v)) continue;
      const inc = net.edges.filter((e) => e.to === v);
      if (inc.length && inc.every((e) => (e.kind === 'dummy' ? sab.has(e.from) : hechas.has(e.act)))) { sab.add(v); cambio = true; }
    }
  }
  return [...sab];
}
function eventosTardios(net, hechas) {
  const sab = new Set([net.end]);
  for (let cambio = true; cambio; ) {
    cambio = false;
    for (const v of net.nodes) {
      if (sab.has(v)) continue;
      const out = net.edges.filter((e) => e.from === v);
      if (out.length && out.every((e) => (e.kind === 'dummy' ? sab.has(e.to) : hechas.has(e.act)))) { sab.add(v); cambio = true; }
    }
  }
  return [...sab];
}

export function pasosTiempo({ rows, modo = 'cpm', plazo = null }) {
  const analysis = analyze({ rows, mode: modo, decimals: 2 });
  if (!analysis.ok) return { ok: false, errors: analysis.errors };
  const { net, activities } = analysis;
  const acts = activities.map((a) => ({ name: a.name, preds: a.preds, a: a.a, m: a.m, b: a.b }));
  const pert = modo === 'pert';
  const res = pert ? calcularPERT(acts) : calcularTiempos(acts, (n) => activities.find((a) => a.name === n).d);
  const T = res.T;
  const F = res.fila;
  const orden = [...res.orden];
  // Desempate del orden para que el dibujo avance de izquierda a derecha cuando se puede.
  const numero = analysis.layout.number;
  const evDe = new Map(net.edges.filter((e) => e.kind === 'activity').map((e) => [e.act, e]));
  const rank = new Map(orden.map((n, i) => [n, i]));
  const profundidad = {};
  orden.forEach((n) => { profundidad[n] = F[n].preds.length ? 1 + Math.max(...F[n].preds.map((p) => profundidad[p])) : 0; });
  orden.sort((x, y) => profundidad[x] - profundidad[y] || numero[evDe.get(x).from] - numero[evDe.get(y).from] || rank.get(x) - rank.get(y));

  const d = pert ? NOT.te : 'duración';
  const dur = (n) => f(F[n].d);

  const hechasF = new Set();
  const hechasB = new Set();
  const cols = { te: new Set(), tic: new Set(), til: new Set(), ht: new Set(), hl: new Set(), crit: new Set() };
  let early = [net.start];
  let late = [net.end];
  const pasos = [];
  const push = (fase, titulo, texto, calculo, extra = {}) => {
    const c = {};
    Object.keys(cols).forEach((k) => { c[k] = [...cols[k]]; });
    pasos.push({
      fase, titulo, texto, calculo,
      estado: { actual: null, early: [...early], late: [...late], cols: c, rutas: null, campana: null, ...extra },
    });
  };

  push(
    'inicio',
    'La red y la tabla',
    pert
      ? 'Se tienen tres estimaciones por actividad. Primero se resume cada una en un tiempo esperado; después se calcula la red como en CPM, usando esos tiempos.'
      : 'Cada actividad tiene una duración y unas predecesoras. Se calcula primero hacia adelante (los tiempos más cercanos), luego hacia atrás (los más lejanos) y con ambos las holguras.',
    [`Las actividades son ${lista(acts.map((a) => a.name))}.`],
  );

  if (pert) {
    for (const a of acts) {
      const n = a.name;
      const p = res.por.get(n);
      cols.te.add(n);
      push(
        'pert-te',
        `Actividad ${n}: ${NOT.te} y ${NOT.v}`,
        'El tiempo esperado pondera la estimación más probable cuatro veces. La varianza mide la dispersión: el rango (b − a) dividido entre 6, al cuadrado.',
        [
          `${NOT.te}(${n}) = (a + 4m + b) / 6 = (${f(a.a)} + 4·${f(a.m)} + ${f(a.b)}) / 6 = ${f(p.te)}`,
          `${NOT.v}(${n}) = ((b − a) / 6)² = ((${f(a.b)} − ${f(a.a)}) / 6)² = ${f4(p.v)}`,
        ],
        { actual: n },
      );
    }
  }

  // Pase hacia adelante
  for (const n of orden) {
    const x = F[n];
    hechasF.add(n);
    cols.tic.add(n);
    early = eventosTempranos(net, hechasF);
    let texto;
    let c1;
    if (!x.preds.length) {
      texto = `${n} no tiene predecesoras, así que puede empezar al inicio del proyecto.`;
      c1 = `${NOT.tic}(${n}) = 0`;
    } else if (x.preds.length === 1) {
      texto = `${n} empieza apenas termina su predecesora ${x.preds[0]}.`;
      c1 = `${NOT.tic}(${n}) = ${NOT.tfc}(${x.preds[0]}) = ${f(F[x.preds[0]].tfc)}`;
    } else {
      texto = `${n} necesita que terminen todas sus predecesoras (${lista(x.preds)}): empieza cuando termina la última, es decir, el mayor ${NOT.tfc}.`;
      c1 = `${NOT.tic}(${n}) = máx[ ${x.preds.map((p) => `${NOT.tfc}(${p}) = ${f(F[p].tfc)}`).join(', ')} ] = ${f(x.tic)}`;
    }
    push('adelante', `Pase hacia adelante, actividad ${n}`, texto, [c1, `${NOT.tfc}(${n}) = ${NOT.tic} + ${d} = ${f(x.tic)} + ${dur(n)} = ${f(x.tfc)}`], { actual: n });
  }

  const finales = orden.filter((n) => !F[n].sucs.length);
  push(
    'duracion',
    'Duración del proyecto',
    'El proyecto termina cuando termina la última actividad: la duración es el mayor TFC de las actividades sin sucesoras.',
    [`${NOT.T} = máx[ ${finales.map((n) => `${NOT.tfc}(${n}) = ${f(F[n].tfc)}`).join(', ')} ] = ${f(T)}`],
  );

  // Pase hacia atrás
  for (const n of [...orden].reverse()) {
    const x = F[n];
    hechasB.add(n);
    cols.til.add(n);
    late = eventosTardios(net, hechasB);
    let texto;
    let c1;
    if (!x.sucs.length) {
      texto = `${n} no tiene sucesoras: puede terminar, a lo más tarde, cuando termina el proyecto.`;
      c1 = `${NOT.tfl}(${n}) = ${NOT.T} = ${f(T)}`;
    } else if (x.sucs.length === 1) {
      texto = `${n} debe terminar a tiempo para que su sucesora ${x.sucs[0]} empiece en su ${NOT.til}.`;
      c1 = `${NOT.tfl}(${n}) = ${NOT.til}(${x.sucs[0]}) = ${f(F[x.sucs[0]].til)}`;
    } else {
      texto = `${n} debe terminar a tiempo para todas sus sucesoras (${lista(x.sucs)}): se toma el menor ${NOT.til}.`;
      c1 = `${NOT.tfl}(${n}) = mín[ ${x.sucs.map((s) => `${NOT.til}(${s}) = ${f(F[s].til)}`).join(', ')} ] = ${f(x.tfl)}`;
    }
    push('atras', `Pase hacia atrás, actividad ${n}`, texto, [c1, `${NOT.til}(${n}) = ${NOT.tfl} − ${d} = ${f(x.tfl)} − ${dur(n)} = ${f(x.til)}`], { actual: n });
  }

  // Holguras
  for (const n of orden) {
    const x = F[n];
    cols.ht.add(n);
    cols.hl.add(n);
    const hl = x.sucs.length
      ? `${NOT.hl}(${n}) = mín ${NOT.tic} de las sucesoras − ${NOT.tfc} = mín[ ${x.sucs.map((s) => `${NOT.tic}(${s}) = ${f(F[s].tic)}`).join(', ')} ] − ${f(x.tfc)} = ${f(x.hl)}`
      : `${NOT.hl}(${n}) = ${NOT.T} − ${NOT.tfc} = ${f(T)} − ${f(x.tfc)} = ${f(x.hl)}`;
    push(
      'holguras',
      `Holguras, actividad ${n}`,
      `La holgura total es cuánto se puede atrasar ${n} sin atrasar el proyecto. La libre, cuánto se puede atrasar sin mover a ninguna sucesora.`,
      [`${NOT.ht}(${n}) = ${NOT.til} − ${NOT.tic} = ${f(x.til)} − ${f(x.tic)} = ${f(x.ht)}`, hl],
      { actual: n },
    );
  }

  // Ruta crítica
  orden.forEach((n) => cols.crit.add(n));
  const rutas = res.rutasCriticas;
  const lineaRuta = (r) => `${r.join(' → ')}: ${r.map((n) => dur(n)).join(' + ')} = ${f(r.reduce((s, n) => s + F[n].d, 0))}`;
  push(
    'critica',
    'Actividades críticas y ruta crítica',
    rutas.length > 1
      ? `Son críticas las actividades con ${NOT.ht} = 0: ${lista(res.criticas)}. Hay ${rutas.length} rutas críticas: todas duran ${f(T)} y un atraso en cualquiera de ellas atrasa el proyecto.`
      : `Son críticas las actividades con ${NOT.ht} = 0: ${lista(res.criticas)}. Encadenadas, forman la ruta crítica, cuya duración es la del proyecto.`,
    rutas.map(lineaRuta),
    { rutas },
  );

  if (pert) {
    const ruta = res.ruta;
    const sumas = ruta.map((n) => f4(res.por.get(n).v)).join(' + ');
    if (res.opciones.length > 1) {
      push(
        'pert-ruta',
        'Qué ruta crítica usar',
        'Con varias rutas críticas se toma la de mayor varianza, que es la más incierta y la que más pesa en el riesgo.',
        res.opciones.map((o) => `${o.ruta.join(' → ')}: ${NOT.v} = ${f4(o.varianza)}`),
        { rutas: [ruta] },
      );
    }
    push(
      'pert-var',
      'Varianza y desviación del proyecto',
      'Se suman las varianzas de las actividades de la ruta crítica (solo de ellas) y se saca la raíz.',
      [
        `${NOT.v}(proyecto) = ${sumas} = ${f4(res.varianza)}`,
        `${NOT.sd} = √${f4(res.varianza)} = ${f4(res.sd)}`,
        `${NOT.Te} = ${f(T)}`,
      ],
      { rutas: [ruta] },
    );
    const objetivo = plazo ?? Math.round(T);
    const sd = res.sd;
    const z = sd > 0 ? (objetivo - T) / sd : objetivo >= T ? Infinity : -Infinity;
    const p = sd > 0 ? phi(z) : objetivo >= T ? 1 : 0;
    push(
      'pert-prob',
      `Probabilidad de terminar en ${f(objetivo)} o menos`,
      'Se estandariza el plazo con la normal: Z cuenta cuántas desviaciones separan el plazo de la duración esperada, y Φ(Z) es la probabilidad acumulada.',
      sd > 0
        ? [
            `Z = (T − ${NOT.Te}) / ${NOT.sd} = (${f(objetivo)} − ${f(T)}) / ${f4(sd)} = ${f4(z)}`,
            `P(T ≤ ${f(objetivo)}) = Φ(${f4(z)}) = ${f4(p)}  →  ${fmt(p * 100, 2)} %`,
          ]
        : [`${NOT.sd} = 0: no hay incertidumbre, el plazo ${objetivo >= T ? 'se cumple' : 'no se cumple'} con certeza.`],
      { rutas: [ruta], campana: { Te: T, sd, T: objetivo, z, p } },
    );
  }

  const filas = acts.map((a) => ({ ...F[a.name], ...(pert ? { te: res.por.get(a.name).te, v: res.por.get(a.name).v, a: a.a, m: a.m, b: a.b } : {}) }));
  return { ok: true, analysis, filas, res, pasos, pert };
}
