import test from 'node:test';
import assert from 'node:assert/strict';
import { filtrar } from '../campos.js';

test('decimal', () => {
  assert.equal(filtrar.decimal('12abc,5.6'), '12,56');
  assert.equal(filtrar.decimal('-3'), '3');
  assert.equal(filtrar.decimal('-3', { negativo: true }), '-3');
  assert.equal(filtrar.decimal('3-4', { negativo: true }), '34');
  assert.equal(filtrar.decimal('−2,5', { negativo: true }), '-2,5');
  assert.equal(filtrar.decimal('1 000'), '1000');
  assert.equal(filtrar.decimal('@#$%^&*'), '');
  assert.equal(filtrar.decimal('3/2', { fraccion: true }), '3/2');
  assert.equal(filtrar.decimal('3/2/5', { fraccion: true }), '3/2');
  assert.equal(filtrar.decimal('3/2'), '32');
  assert.equal(filtrar.decimal('-3/-2', { negativo: true, fraccion: true }), '-3/-2'.replace('/-2', '/-2'));
  assert.equal(filtrar.decimal('1'.repeat(30)).length, 14);
});
test('entero y semilla', () => {
  assert.equal(filtrar.entero('12.5'), '125');
  assert.equal(filtrar.entero('-4', { negativo: true }), '-4');
  assert.equal(filtrar.entero('a1b2'), '12');
  assert.equal(filtrar.semilla('48 21x'), '4821');
  assert.equal(filtrar.semilla('1234567890123'), '123456789');
});
test('nombre y listas', () => {
  assert.equal(filtrar.nombre('Ñandú 1|2;3,4'), 'Ñandú1234');
  assert.equal(filtrar.nombre("x1′"), 'x1′');
  assert.equal(filtrar.listaNombres('A,B ,  C;D'), 'A, B, CD');
  assert.equal(filtrar.listaNombres(',,A'), 'A');
});
test('texto1 y porcentaje', () => {
  assert.equal(filtrar.texto1('a|b\nc  d<e>'), 'abc de');
  assert.equal(filtrar.porcentaje('53,3%'), '53,3 %');
  assert.equal(filtrar.porcentaje('5x3'), '53');
});
test('probabilidad', async () => {
  const { probabilidad } = await import('../campos.js');
  assert.equal(probabilidad('0,25'), '0,25');
  assert.equal(probabilidad('1/4'), '1/4');
  assert.equal(probabilidad('25%'), '25 %');
  assert.equal(probabilidad('-0.5abc'), '0.5');
  assert.equal(probabilidad('1/2/3'), '1/2');
  assert.equal(probabilidad('1/2%'), '12 %');
  assert.equal(probabilidad(''), '');
});
test('nombreEspacios', async () => {
  const { nombreEspacios } = await import('../campos.js');
  assert.equal(nombreEspacios('Mano  de|obra,;<> 2'), 'Mano deobra 2');
  assert.equal(nombreEspacios(' Recurso 2'), 'Recurso 2');
});
test('restriccionSimple', async () => {
  const { restriccionSimple } = await import('../campos.js');
  assert.equal(restriccionSimple('x1 <= 3'), 'x1 <= 3');
  assert.equal(restriccionSimple('x₁ ≥ 7/2'), 'x₁ >= 7/2');
  assert.equal(restriccionSimple('a<b>;|"x1=-3\n'), '<>x1=-3');
});
test('etiqueta', async () => {
  const { etiqueta } = await import('../campos.js');
  assert.equal(etiqueta('  Demanda  alta|<x>;@'), 'Demanda altax');
  assert.equal(etiqueta('Ñandú1 (S/.)'), 'Ñandú1 (S/.)');
  assert.equal(etiqueta('a'.repeat(50), { max: 10 }).length, 10);
});
