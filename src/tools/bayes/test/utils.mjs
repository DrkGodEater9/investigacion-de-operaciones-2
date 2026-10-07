/**
 * Utilidades de prueba: generador con semilla, aritmética exacta con fracciones (BigInt) y un cálculo
 * bayesiano de referencia escrito por otro camino (fracciones + enumeración de TODAS las reglas de decisión),
 * sin usar bayes.js.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  return { next, int, pick: (arr) => arr[int(0, arr.length - 1)] };
}

/* ---------- Fracciones ---------- */
const mcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
export const F = (n, d = 1n) => {
  n = BigInt(n); d = BigInt(d);
  if (d < 0n) { n = -n; d = -d; }
  const g = mcd(n, d) || 1n;
  return { n: n / g, d: d / g };
};
export const sumaF = (x, y) => F(x.n * y.d + y.n * x.d, x.d * y.d);
export const mulF = (x, y) => F(x.n * y.n, x.d * y.d);
export const divF = (x, y) => F(x.n * y.d, x.d * y.n);
export const restaF = (x, y) => F(x.n * y.d - y.n * x.d, x.d * y.d);
export const cmpF = (x, y) => { const v = x.n * y.d - y.n * x.d; return v < 0n ? -1 : v > 0n ? 1 : 0; };
export const aNum = (x) => Number(x.n) / Number(x.d);
export const CERO = F(0);

/** Problema con probabilidades enteras sobre D: { pagos enteros, prioriN, likN, D } → problema (float) y su gemelo exacto. */
export function problemaAleatorio(rng, { conInfo = true, objetivo, ceros = false } = {}) {
  const m = rng.int(2, 4);
  const n = rng.int(2, 4);
  const K = conInfo ? rng.int(2, 4) : 0;
  const D = rng.pick([10, 20, 100, 1000]);
  const compos = (total, cuantos) => {
    const r = Array(cuantos).fill(0);
    for (let i = 0; i < total; i++) r[rng.int(0, cuantos - 1)] += 1;
    return r;
  };
  const prioriN = compos(D, n);
  if (ceros && n > 2) { prioriN[0] += prioriN[n - 1]; prioriN[n - 1] = 0; }
  const likN = Array.from({ length: n }, () => compos(D, K || 1));
  if (ceros && K > 2) likN.forEach((f) => { f[0] += f[K - 1]; f[K - 1] = 0; }); // el último indicador nunca ocurre
  const obj = objetivo || rng.pick(['max', 'min']);
  const pagos = Array.from({ length: m }, () => Array.from({ length: n }, () => rng.int(-50, 200)));
  const p = {
    objetivo: obj,
    alternativas: Array.from({ length: m }, (_, i) => 'A' + (i + 1)),
    estados: Array.from({ length: n }, (_, j) => 'E' + (j + 1)),
    pagos,
    priori: prioriN.map((x) => x / D),
  };
  if (K) {
    p.indicadores = Array.from({ length: K }, (_, k) => 'Z' + (k + 1));
    p.verosimilitud = likN.map((f) => f.map((x) => x / D));
  }
  return { p, exacto: { D, prioriN, likN, pagos } };
}

/** Referencia exacta: todo con fracciones; VEcIM por enumeración de todas las reglas k → alternativa. */
export function referencia(p, ex) {
  const { D, prioriN, likN, pagos } = ex;
  const m = pagos.length;
  const n = prioriN.length;
  const max = p.objetivo === 'max';
  const mejorQue = (x, y) => (max ? cmpF(x, y) > 0 : cmpF(x, y) < 0);
  const pri = prioriN.map((x) => F(x, D));
  const ve = pagos.map((fila) => fila.reduce((s, v, j) => sumaF(s, mulF(F(v), pri[j])), CERO));
  let vesi = ve[0];
  ve.forEach((v) => { if (mejorQue(v, vesi)) vesi = v; });
  const optimas = ve.map((v, i) => (cmpF(v, vesi) === 0 ? i : -1)).filter((i) => i >= 0);
  let vecip = CERO;
  for (let j = 0; j < n; j++) {
    let b = F(pagos[0][j]);
    for (let i = 1; i < m; i++) if (mejorQue(F(pagos[i][j]), b)) b = F(pagos[i][j]);
    vecip = sumaF(vecip, mulF(pri[j], b));
  }
  const veip = max ? restaF(vecip, vesi) : restaF(vesi, vecip);
  const out = { ve, vesi, optimas, vecip, veip };
  if (likN[0].length > 1 || p.indicadores) {
    const K = likN[0].length;
    const conj = pri.map((pj, j) => likN[j].map((l) => mulF(pj, F(l, D))));
    const marg = Array.from({ length: K }, (_, k) => conj.reduce((s, f) => sumaF(s, f[k]), CERO));
    const post = conj.map((f) => f.map((c, k) => (marg[k].n === 0n ? null : divF(c, marg[k]))));
    // Mejor regla de decisión: s[k] = alternativa; valor = Σ_j π_j Σ_k L_jk pago[s[k]][j]
    let mejor = null;
    const s = Array(K).fill(0);
    const rec = (k) => {
      if (k === K) {
        let v = CERO;
        for (let j = 0; j < n; j++) for (let kk = 0; kk < K; kk++) v = sumaF(v, mulF(conj[j][kk], F(pagos[s[kk]][j])));
        if (mejor === null || mejorQue(v, mejor)) mejor = v;
        return;
      }
      for (let i = 0; i < m; i++) { s[k] = i; rec(k + 1); }
    };
    rec(0);
    out.conj = conj; out.marg = marg; out.post = post; out.vecim = mejor;
    out.veim = max ? restaF(mejor, vesi) : restaF(vesi, mejor);
    out.eficiencia = out.veip.n === 0n ? null : divF(out.veim, out.veip);
  }
  return out;
}

export const cerca = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
