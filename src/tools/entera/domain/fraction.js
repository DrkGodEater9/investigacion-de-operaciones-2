/**
 * Aritmética exacta con fracciones usando BigInt para numerador y denominador.
 * Todo cálculo en el simplex y en el árbol de ramificación y acotamiento
 * es 100% exacto, sin pérdida por redondeo de coma flotante.
 */

function gcdBigInt(a, b) {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

export class Fraction {
  constructor(n, d = 1n) {
    let num = typeof n === 'bigint' ? n : BigInt(n);
    let den = typeof d === 'bigint' ? d : BigInt(d);

    if (den === 0n) {
      throw new Error('División por cero en fracción');
    }
    if (den < 0n) {
      num = -num;
      den = -den;
    }

    const g = gcdBigInt(num, den);
    this.n = num / g;
    this.d = den / g;
  }

  add(other) {
    const b = frac(other);
    return new Fraction(this.n * b.d + b.n * this.d, this.d * b.d);
  }

  sub(other) {
    const b = frac(other);
    return new Fraction(this.n * b.d - b.n * this.d, this.d * b.d);
  }

  mul(other) {
    const b = frac(other);
    return new Fraction(this.n * b.n, this.d * b.d);
  }

  div(other) {
    const b = frac(other);
    if (b.n === 0n) throw new Error('División por cero');
    return new Fraction(this.n * b.d, this.d * b.n);
  }

  neg() {
    return new Fraction(-this.n, this.d);
  }

  abs() {
    return this.n < 0n ? new Fraction(-this.n, this.d) : this;
  }

  cmp(other) {
    const b = frac(other);
    const diff = this.n * b.d - b.n * this.d;
    if (diff < 0n) return -1;
    if (diff > 0n) return 1;
    return 0;
  }

  eq(other) { return this.cmp(other) === 0; }
  lt(other) { return this.cmp(other) < 0; }
  lte(other) { return this.cmp(other) <= 0; }
  gt(other) { return this.cmp(other) > 0; }
  gte(other) { return this.cmp(other) >= 0; }
  isZero() { return this.n === 0n; }

  isInteger() {
    return this.d === 1n;
  }

  floor() {
    if (this.d === 1n) return this.n;
    if (this.n >= 0n) {
      return this.n / this.d;
    }
    // Negativo con residuo: redondeo hacia -infinito
    return (this.n / this.d) - 1n;
  }

  ceil() {
    if (this.d === 1n) return this.n;
    if (this.n >= 0n) {
      return (this.n / this.d) + 1n;
    }
    return this.n / this.d;
  }

  /** Parte fraccionaria: v - floor(v). Siempre en [0, 1). */
  fractionalPart() {
    const fl = this.floor();
    return this.sub(new Fraction(fl, 1n));
  }

  toNumber() {
    return Number(this.n) / Number(this.d);
  }

  toString() {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }

  toDecimal(decimals = 2) {
    const num = Number(this.n);
    const den = Number(this.d);
    const val = num / den;
    if (Number.isInteger(val)) return val.toString();
    const s = val.toFixed(decimals);
    // Eliminar ceros sobrantes al final pero conservar formato
    const cleaned = s.replace(/\.?0+$/, '');
    return cleaned.replace('.', ',');
  }

  /**
   * Muestra fracción y decimal. Si es entero, solo el entero.
   * Ej: "23,33 (70/3)" o "23".
   */
  toDual(decimals = 2) {
    if (this.isInteger()) {
      return this.n.toString();
    }
    return `${this.toDecimal(decimals)} (${this.toString()})`;
  }
}

export const ZERO = new Fraction(0n, 1n);
export const ONE = new Fraction(1n, 1n);

/**
 * Convierte cualquier número, string o Fraction a un objeto Fraction irreducible.
 */
export function frac(val, den = 1n) {
  if (val instanceof Fraction) return val;
  if (typeof val === 'bigint') return new Fraction(val, den);
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) throw new Error('Número no finito');
    if (Number.isInteger(val)) return new Fraction(BigInt(val), 1n);
    // Conversión exacta de decimal string
    return parseFraction(val.toString());
  }
  if (typeof val === 'string') {
    return parseFraction(val);
  }
  throw new Error(`No se puede convertir a fracción: ${val}`);
}

/**
 * Parsea strings como "3/4", "-5", "3.75", "3,75", "  - 2 / 5 ".
 */
export function parseFraction(str) {
  if (!str) return ZERO;
  let s = str.trim().replace(/\s+/g, '');
  if (!s) return ZERO;

  // Fracción tipo a/b
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length !== 2) throw new Error(`Formato de fracción inválido: ${str}`);
    const num = parseFraction(parts[0]);
    const den = parseFraction(parts[1]);
    return num.div(den);
  }

  // Decimal con punto o coma
  s = s.replace(',', '.');
  if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length !== 2) throw new Error(`Formato decimal inválido: ${str}`);
    const [intPart, decPart] = parts;
    const isNeg = intPart.startsWith('-');
    const cleanInt = intPart.replace('-', '');
    const numStr = cleanInt + decPart;
    const denBig = 10n ** BigInt(decPart.length);
    const numBig = BigInt(numStr);
    return new Fraction(isNeg ? -numBig : numBig, denBig);
  }

  // Entero
  return new Fraction(BigInt(s), 1n);
}
