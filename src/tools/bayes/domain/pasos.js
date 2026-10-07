/**
 * Lista de pasos del ejemplo resuelto (pestaña «Paso a paso» del tema 2.1).
 * Cada paso: { titulo, texto, calculo: string[], estado } donde `estado` dice qué partes de las tablas
 * ya se llenaron (la pantalla solo dibuja; todo el cálculo viene de analizar()).
 *
 *   estado = { ve, decision, perfecta (false | 'mejor' | 'veip'), lik, conj, marg, post (columnas), dec (columnas),
 *              vecim, veim, efic, col (columna activa o null), final }
 */
import { analizar } from './bayes.js';
import { fmtNum, fmtFactor, fmtPct, listaTexto } from './formato.js';
import { NOTACION, palabrasObjetivo } from './notacion.js';

const ESTADO_INICIAL = {
  ve: false, decision: false, perfecta: false, lik: false, conj: false, marg: false,
  post: 0, dec: 0, vecim: false, veim: false, efic: false, col: null, final: false,
};

const suma = (partes) => partes.join(' + ');
const prod = (a, b) => `${fmtNum(a)}·${fmtFactor(b)}`;

export function pasosBayes(p, analisis = analizar(p)) {
  const o = palabrasObjetivo(p.objetivo);
  const a = analisis;
  const m = a.muestral;
  const pasos = [];
  const est = { ...ESTADO_INICIAL };
  const nombresAlt = (idx) => listaTexto(idx.map((i) => p.alternativas[i]));
  const REGLA = o.regla === 'máximo' ? 'Máximo' : 'Mínimo';
  const empujar = (titulo, texto, calculo, cambios = {}) => {
    Object.assign(est, cambios);
    pasos.push({ titulo, texto, calculo, estado: { ...est } });
  };

  empujar(
    'Planteamiento',
    `Hay ${p.alternativas.length} alternativas y ${p.estados.length} estados de la naturaleza. Los pagos son ${o.pagos}, así que se busca el ${o.mejor} valor esperado.`,
    [
      `Alternativas: ${p.alternativas.join(', ')}`,
      `Estados: ${p.estados.join(', ')}`,
      `Probabilidades a priori: ${p.estados.map((e, j) => `P(${e}) = ${fmtNum(p.priori[j])}`).join('; ')}`,
      `Suma = ${fmtNum(p.priori.reduce((s, v) => s + v, 0))}`,
    ],
  );

  empujar(
    'Valor esperado de cada alternativa',
    'El valor esperado de una alternativa es la suma de cada pago por la probabilidad a priori de su estado.',
    p.alternativas.map((alt, i) => `VE(${alt}) = ${suma(p.estados.map((_, j) => prod(p.priori[j], p.pagos[i][j])))} = ${fmtNum(a.sinInfo.ve[i])}`),
    { ve: true },
  );

  empujar(
    'Decisión sin información (criterio de Bayes)',
    `Se escoge la alternativa con ${o.mejor} valor esperado.`,
    [
      `${REGLA} de {${a.sinInfo.ve.map(fmtNum).join('; ')}} = ${fmtNum(a.sinInfo.valor)}`,
      a.sinInfo.optimas.length > 1 ? `Empate entre ${nombresAlt(a.sinInfo.optimas)}: cualquiera sirve.` : `Decisión: ${nombresAlt(a.sinInfo.optimas)}`,
    ],
    { decision: true },
  );

  empujar(
    'Mejor alternativa en cada estado',
    'Con información perfecta sabrías qué estado ocurre antes de decidir y elegirías la mejor alternativa de cada estado. Su valor esperado se pondera con las probabilidades a priori.',
    [
      ...p.estados.map((e, j) => `Si ocurre ${e}: ${o.mejor} pago = ${fmtNum(a.perfecta.porEstado[j].valor)} (${nombresAlt(a.perfecta.porEstado[j].alts)})`),
      `${NOTACION.vecip} = ${suma(p.estados.map((_, j) => prod(p.priori[j], a.perfecta.porEstado[j].valor)))} = ${fmtNum(a.perfecta.vecip)}`,
    ],
    { perfecta: 'mejor' },
  );

  empujar(
    `${NOTACION.veip}: lo máximo que vale la información`,
    `Es lo que se ${p.objetivo === 'max' ? 'gana' : 'ahorra'} en promedio al saber el estado antes de decidir. Ninguna información, perfecta o no, puede valer más que esto.`,
    [
      p.objetivo === 'max'
        ? `${NOTACION.veip} = ${NOTACION.vecip} − ${NOTACION.vesi} = ${fmtNum(a.perfecta.vecip)} − ${fmtFactor(a.sinInfo.valor)} = ${fmtNum(a.perfecta.veip)}`
        : `${NOTACION.veip} = ${NOTACION.vesi} − ${NOTACION.vecip} = ${fmtNum(a.sinInfo.valor)} − ${fmtFactor(a.perfecta.vecip)} = ${fmtNum(a.perfecta.veip)}`,
    ],
    { perfecta: 'veip' },
  );

  if (!m) {
    empujar(
      'Conclusión',
      'Este problema no trae información muestral.',
      [
        `Sin información conviene ${nombresAlt(a.sinInfo.optimas)} (VE = ${fmtNum(a.sinInfo.valor)}).`,
        `Pagar por saber el estado solo conviene si cuesta menos de ${fmtNum(a.perfecta.veip)}.`,
      ],
      { final: true },
    );
    return pasos;
  }

  empujar(
    'Verosimilitud de la información',
    'La información imperfecta (estudio, prueba, encuesta) no revela el estado con certeza. La verosimilitud P(indicador | estado) dice qué tan probable es cada resultado en cada estado; cada fila suma 1.',
    p.estados.map((e, j) => `Si el estado es ${e}: ${p.indicadores.map((z, k) => `P(${z}) = ${fmtNum(p.verosimilitud[j][k])}`).join('; ')} (suman ${fmtNum(p.verosimilitud[j].reduce((s, v) => s + v, 0))})`),
    { lik: true },
  );

  empujar(
    'Probabilidades conjuntas',
    'Se multiplica la probabilidad a priori del estado por la verosimilitud: P(estado y resultado) = P(estado)·P(resultado | estado).',
    p.estados.flatMap((e, j) => p.indicadores.map((z, k) => `P(${e} y ${z}) = ${prod(p.priori[j], p.verosimilitud[j][k])} = ${fmtNum(m.conjunta[j][k])}`)),
    { conj: true },
  );

  empujar(
    'Probabilidades marginales del resultado',
    'La marginal de cada resultado es la suma de su columna de conjuntas: P(resultado) = Σ P(estado y resultado). Las marginales suman 1.',
    [
      ...p.indicadores.map((z, k) => `P(${z}) = ${suma(p.estados.map((_, j) => fmtNum(m.conjunta[j][k])))} = ${fmtNum(m.marginal[k])}`),
      `Suma de marginales = ${fmtNum(m.marginal.reduce((s, v) => s + v, 0))}`,
    ],
    { marg: true },
  );

  p.indicadores.forEach((z, k) => {
    const d = m.porIndicador[k];
    if (!d.posible) {
      empujar(
        `Posteriores si el resultado es ${z}`,
        'Este resultado tiene probabilidad 0: nunca ocurre, así que no hay posteriores ni decisión que tomar para él.',
        [`P(${z}) = 0`],
        { post: k + 1, col: k },
      );
      return;
    }
    empujar(
      `Posteriores si el resultado es ${z}`,
      'Teorema de Bayes: P(estado | resultado) = P(estado y resultado) / P(resultado). Las posteriores de un mismo resultado suman 1.',
      [
        ...p.estados.map((e, j) => `P(${e} | ${z}) = ${fmtNum(m.conjunta[j][k])} / ${fmtNum(m.marginal[k])} = ${fmtNum(m.posterior[j][k])}`),
        `Suma = ${fmtNum(p.estados.reduce((s, _, j) => s + m.posterior[j][k], 0))}`,
      ],
      { post: k + 1, col: k },
    );
  });

  p.indicadores.forEach((z, k) => {
    const d = m.porIndicador[k];
    if (!d.posible) {
      empujar(`Decisión si el resultado es ${z}`, 'No se decide nada para un resultado imposible.', [`P(${z}) = 0`], { dec: k + 1, col: k });
      return;
    }
    empujar(
      `Decisión si el resultado es ${z}`,
      `Se repite el valor esperado, pero con las probabilidades posteriores en lugar de las a priori.${k === 0 ? ' (Las cuentas usan los valores exactos; al redondear a 4 decimales el último dígito puede variar.)' : ''}`,
      [
        ...p.alternativas.map((alt, i) => `VE(${alt} | ${z}) = ${suma(p.estados.map((_, j) => prod(m.posterior[j][k], p.pagos[i][j])))} = ${fmtNum(d.ve[i])}`),
        d.optimas.length > 1
          ? `Empate entre ${nombresAlt(d.optimas)} con VE = ${fmtNum(d.valor)}.`
          : `Decisión si sale ${z}: ${nombresAlt(d.optimas)} (VE = ${fmtNum(d.valor)})`,
      ],
      { dec: k + 1, col: k },
    );
  });

  const posibles = p.indicadores.map((_, k) => k).filter((k) => m.porIndicador[k].posible);
  empujar(
    `Valor esperado con información muestral (${NOTACION.vecim})`,
    'Se pondera el mejor valor esperado de cada resultado con la probabilidad de que ese resultado ocurra.',
    [`${NOTACION.vecim} = ${suma(posibles.map((k) => prod(m.marginal[k], m.porIndicador[k].valor)))} = ${fmtNum(m.vecim)}`],
    { vecim: true, col: null },
  );

  empujar(
    `Valor de la información muestral (${NOTACION.veim})`,
    `Es lo que se ${p.objetivo === 'max' ? 'gana' : 'ahorra'} en promedio por usar la información, comparado con decidir sin ella. Es el tope de lo que conviene pagar por el estudio.`,
    [
      p.objetivo === 'max'
        ? `${NOTACION.veim} = ${NOTACION.vecim} − ${NOTACION.vesi} = ${fmtNum(m.vecim)} − ${fmtFactor(a.sinInfo.valor)} = ${fmtNum(m.veim)}`
        : `${NOTACION.veim} = ${NOTACION.vesi} − ${NOTACION.vecim} = ${fmtNum(a.sinInfo.valor)} − ${fmtFactor(m.vecim)} = ${fmtNum(m.veim)}`,
      `Comprobación: ${NOTACION.veim} ≤ ${NOTACION.veip} (${fmtNum(m.veim)} ≤ ${fmtNum(a.perfecta.veip)})`,
    ],
    { veim: true },
  );

  empujar(
    'Eficiencia de la información',
    `Compara lo que aporta la información muestral con lo máximo posible (la perfecta): ${NOTACION.veim} / ${NOTACION.veip}. Va de 0 % (inútil) a 100 % (equivale a información perfecta).`,
    [m.eficiencia === null
      ? `${NOTACION.veip} = 0: la información perfecta no aporta nada, así que la eficiencia no está definida.`
      : `${NOTACION.eficiencia} = ${fmtNum(m.veim)} / ${fmtNum(a.perfecta.veip)} = ${fmtPct(m.eficiencia)}`],
    { efic: true },
  );

  empujar(
    'Conclusión',
    'La decisión óptima con la información es una regla: qué hacer según el resultado que salga.',
    [
      `Sin información: ${nombresAlt(a.sinInfo.optimas)} (VE = ${fmtNum(a.sinInfo.valor)}).`,
      ...p.indicadores.map((z, k) => (m.porIndicador[k].posible ? `Si sale ${z}: ${nombresAlt(m.porIndicador[k].optimas)}.` : `Si sale ${z}: no ocurre.`)),
      `Valor esperado con la información: ${fmtNum(m.vecim)}. Conviene pagar por ella si cuesta menos de ${fmtNum(m.veim)}.`,
    ],
    { final: true },
  );
  return pasos;
}
