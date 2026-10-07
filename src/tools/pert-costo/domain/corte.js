/**
 * Corte de costo mínimo con cotas inferiores (Fulkerson / Phillips y Dessouky).
 *
 * Una flecha u→v tiene costo de acortarla `cap` (puede ser Infinity: no se puede acortar) y
 * reembolso `lo` si se alarga (0 si no hay). Un corte (S, T), con s en S y t en T, cuesta
 *     Σ cap de las flechas que van de S a T  −  Σ lo de las flechas que van de T a S.
 * Se halla el de menor costo con un flujo máximo con cotas inferiores:
 *   1) flujo factible (circulación con super-fuente y super-sumidero),
 *   2) se aumenta de s a t en la red residual,
 *   3) S = lo alcanzable desde s en la red residual.
 */

class Residual {
  constructor(n) {
    this.n = n;
    this.adj = Array.from({ length: n }, () => []);
    this.to = [];
    this.cap = [];
  }

  /** Agrega la flecha u→v y devuelve el índice de la flecha (la inversa es idx ^ 1). */
  add(u, v, c) {
    this.adj[u].push(this.to.length);
    this.to.push(v);
    this.cap.push(c);
    this.adj[v].push(this.to.length);
    this.to.push(u);
    this.cap.push(0);
    return this.to.length - 2;
  }

  /** Flujo máximo (Edmonds-Karp). */
  maxFlow(s, t, eps) {
    let total = 0;
    for (;;) {
      const prev = new Array(this.n).fill(-1);
      const visto = new Array(this.n).fill(false);
      visto[s] = true;
      const cola = [s];
      for (let h = 0; h < cola.length && !visto[t]; h++) {
        const u = cola[h];
        for (const e of this.adj[u]) {
          const v = this.to[e];
          if (!visto[v] && this.cap[e] > eps) { visto[v] = true; prev[v] = e; cola.push(v); }
        }
      }
      if (!visto[t]) return total;
      let f = Infinity;
      for (let v = t; v !== s; v = this.to[prev[v] ^ 1]) f = Math.min(f, this.cap[prev[v]]);
      for (let v = t; v !== s; v = this.to[prev[v] ^ 1]) { this.cap[prev[v]] -= f; this.cap[prev[v] ^ 1] += f; }
      total += f;
    }
  }

  alcanzables(s, eps) {
    const visto = new Array(this.n).fill(false);
    visto[s] = true;
    const pila = [s];
    while (pila.length) {
      const u = pila.pop();
      for (const e of this.adj[u]) if (!visto[this.to[e]] && this.cap[e] > eps) { visto[this.to[e]] = true; pila.push(this.to[e]); }
    }
    return visto;
  }
}

/**
 * n nodos, flechas [{ u, v, cap, lo }], fuente s y sumidero t.
 * Devuelve { lado: boolean[] (true = en S), costo, infinito }.
 * Lanza un error si no existe flujo factible (no debería pasar si la solución actual es óptima).
 */
export function corteMinimo(n, flechas, s, t) {
  let suma = 1;
  let mayor = 1;
  for (const a of flechas) {
    for (const x of [a.cap, a.lo]) if (Number.isFinite(x)) { suma += x; mayor = Math.max(mayor, x); }
  }
  const BIG = suma * 1e3;
  const eps = mayor * 1e-9;
  const SS = n;
  const TT = n + 1;
  const g = new Residual(n + 2);
  const exceso = new Array(n).fill(0);
  const ids = flechas.map((a) => {
    const cap = Number.isFinite(a.cap) ? a.cap : BIG;
    exceso[a.v] += a.lo;
    exceso[a.u] -= a.lo;
    return g.add(a.u, a.v, cap - a.lo);
  });
  const retorno = g.add(t, s, BIG * 10);
  let requerido = 0;
  for (let v = 0; v < n; v++) {
    if (exceso[v] > eps) { g.add(SS, v, exceso[v]); requerido += exceso[v]; }
    else if (exceso[v] < -eps) g.add(v, TT, -exceso[v]);
  }
  const f = g.maxFlow(SS, TT, eps);
  if (f < requerido - eps * 10) throw new Error('No hay flujo factible: la solución actual no es óptima para su duración.');
  // Se quita la flecha t→s y se aumenta el flujo de s a t
  g.cap[retorno] = 0;
  g.cap[retorno ^ 1] = 0;
  g.maxFlow(s, t, eps);
  const lado = g.alcanzables(s, eps);
  let costo = 0;
  let infinito = false;
  flechas.forEach((a) => {
    if (lado[a.u] && !lado[a.v]) {
      if (!Number.isFinite(a.cap)) infinito = true;
      else costo += a.cap;
    } else if (!lado[a.u] && lado[a.v]) costo -= a.lo;
  });
  return { lado: lado.slice(0, n), costo, infinito };
}

/** Búsqueda exhaustiva del mismo corte (solo para verificar en pruebas, hasta ~20 nodos). */
export function corteExhaustivo(n, flechas, s, t) {
  const libres = [];
  for (let v = 0; v < n; v++) if (v !== s && v !== t) libres.push(v);
  let mejor = Infinity;
  for (let mascara = 0; mascara < 2 ** libres.length; mascara++) {
    const lado = new Array(n).fill(false);
    lado[s] = true;
    libres.forEach((v, k) => { if ((mascara >> k) & 1) lado[v] = true; });
    let costo = 0;
    for (const a of flechas) {
      if (lado[a.u] && !lado[a.v]) costo += a.cap;
      else if (!lado[a.u] && lado[a.v]) costo -= a.lo;
    }
    if (costo < mejor) mejor = costo;
  }
  return mejor;
}
