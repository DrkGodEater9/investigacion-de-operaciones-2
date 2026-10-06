/** Utilidades de prueba: generador con semilla y fuerza bruta independiente del dominio. */
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

/** Modelo aleatorio con n entre 2 y 8, 1 a 4 restricciones, coeficientes −5…9 y b −3…15. */
export function modeloAleatorio(rng) {
  const n = rng.int(2, 8);
  const m = rng.int(1, 4);
  return {
    sense: rng.pick(['max', 'min']),
    names: Array.from({ length: n }, (_, j) => 'x' + (j + 1)),
    c: Array.from({ length: n }, () => rng.int(-5, 9)),
    constraints: Array.from({ length: m }, (_, i) => ({
      name: 'R' + (i + 1),
      a: Array.from({ length: n }, () => rng.int(-5, 9)),
      op: rng.pick(['<=', '>=', '=']),
      b: rng.int(-3, 15),
    })),
  };
}

/**
 * Fuerza bruta por otro camino: recursión que arma el vector variable por variable
 * y evalúa con bucles simples (no usa evaluate ni enumerate).
 */
export function fuerzaBruta(model) {
  const n = model.names.length;
  const x = [];
  let factibles = 0;
  let mejor = null;
  let sols = [];
  function rec(j) {
    if (j === n) {
      let ok = true;
      for (const r of model.constraints) {
        let s = 0;
        for (let k = 0; k < n; k++) s += r.a[k] * x[k];
        if (r.op === '<=' && s > r.b) ok = false;
        if (r.op === '>=' && s < r.b) ok = false;
        if (r.op === '=' && s !== r.b) ok = false;
      }
      if (!ok) return;
      let z = 0;
      for (let k = 0; k < n; k++) z += model.c[k] * x[k];
      factibles += 1;
      const mejora = mejor === null || (model.sense === 'max' ? z > mejor : z < mejor);
      if (mejora) { mejor = z; sols = [x.slice()]; } else if (z === mejor) sols.push(x.slice());
      return;
    }
    for (const v of [0, 1]) { x[j] = v; rec(j + 1); }
  }
  rec(0);
  return { status: factibles ? 'optimo' : 'infactible', z: mejor, factibles, sols };
}

export const clave = (xs) => xs.map((x) => x.join('')).sort().join('|');
