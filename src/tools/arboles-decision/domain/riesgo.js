/**
 * Perfil de riesgo de la estrategia óptima: distribución de los resultados finales
 * (suma de pagos de las ramas del camino + valor de la hoja) cuando se sigue esa estrategia.
 */
const EPS = 1e-9;

export function perfilRiesgo(arbol, ev) {
  const caminos = [];
  (function dfs(n, p, acum, ruta) {
    if (n.tipo === 'final') {
      caminos.push({ p, valor: acum + n.valor, ruta });
      return;
    }
    n.ramas.forEach((r, i) => {
      if (!ev.politica[`${n.id}:${i}`]) return;
      dfs(r.hijo, n.tipo === 'azar' ? p * r.p : p, acum + r.pago, [...ruta, r.etiqueta]);
    });
  })(arbol.raiz, 1, 0, []);

  const puntos = [];
  [...caminos].sort((a, b) => a.valor - b.valor).forEach((c) => {
    const u = puntos[puntos.length - 1];
    if (u && Math.abs(u.valor - c.valor) <= EPS * Math.max(1, Math.abs(c.valor))) {
      u.p += c.p;
      u.caminos.push(c.ruta.join(' › '));
    } else puntos.push({ valor: c.valor, p: c.p, caminos: [c.ruta.join(' › ')] });
  });
  const esperado = puntos.reduce((s, x) => s + x.p * x.valor, 0);
  const varianza = puntos.reduce((s, x) => s + x.p * (x.valor - esperado) ** 2, 0);
  const prob = (f) => puntos.filter((x) => f(x.valor)).reduce((s, x) => s + x.p, 0);
  return {
    puntos,
    esperado,
    varianza,
    desviacion: Math.sqrt(varianza),
    minimo: puntos.length ? puntos[0].valor : null,
    maximo: puntos.length ? puntos[puntos.length - 1].valor : null,
    pNegativo: prob((v) => v < 0),
    pAlMenos: (umbral) => prob((v) => v >= umbral - EPS),
  };
}
