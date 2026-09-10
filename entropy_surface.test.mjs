import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradient, effectiveDensity, negativeRegion } from './entropy_surface.mjs';

test('gradient: one-sided ends, central interior, pinned', () => {
  const r = gradient([0, 1, 2, 3]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.gradient, [1, 1, 1, 1]);       // end 1-0, central (2-0)/2=1, (3-1)/2=1, end 3-2
  const r2 = gradient([0, 0, 4]);                   // g0=0, g1=(4-0)/2=2, g2=4-0... = 4-0? no: field[2]-field[1]=4-0=4
  assert.deepEqual(r2.gradient, [0, 2, 4]);
});

test('gradient: total on garbage, needs >= 2 samples', () => {
  assert.equal(gradient('x').ok, false);
  assert.equal(gradient([1]).ok, false);            // < 2 samples
  assert.equal(gradient([1, 2]).ok, true);          // exactly 2 valid (kills < 2 → <= 2)
  assert.equal(gradient([0, Infinity, 2]).ok, false);
});

test('effectiveDensity: u_eff = 0.5 g^2 - T|g|, goes negative for |g| < 2T', () => {
  // constant gradient 1. T=1 → u = 0.5 - 1 = -0.5 (negative everywhere)
  const hot = effectiveDensity([0, 1, 2, 3], 1);
  assert.equal(hot.density.every((u) => Math.abs(u + 0.5) < 1e-12), true);
  // T=0.25 → u = 0.5 - 0.25 = 0.25 (positive everywhere)
  const cold = effectiveDensity([0, 1, 2, 3], 0.25);
  assert.equal(cold.density.every((u) => Math.abs(u - 0.25) < 1e-12), true);
  // T=0.5 → u = 0.5 - 0.5 = 0 exactly (the boundary: NOT negative)
  const edge = effectiveDensity([0, 1, 2, 3], 0.5);
  assert.equal(edge.density.every((u) => Math.abs(u) < 1e-12), true);
});

test('effectiveDensity: total on garbage, temperature >= 0', () => {
  assert.equal(effectiveDensity([0, 1], Infinity).ok, false);
  assert.equal(effectiveDensity([0, 1], -1).ok, false);        // negative temperature
  assert.equal(effectiveDensity([0, 1], 0).ok, true);          // T=0 valid (kills < 0 → <= 0): u = 0.5 g^2 >= 0
  assert.equal(effectiveDensity('x', 1).ok, false);
  assert.equal(effectiveDensity([1], 1).ok, false);
});

test('negativeRegion: finds the negative band and its fraction; boundary at 0 is NOT negative', () => {
  const r = negativeRegion([-0.5, -0.5, 0.25, 0.25]);
  assert.deepEqual(r.indices, [0, 1]);
  assert.equal(r.fraction, 0.5);
  assert.equal(r.min, -0.5);
  // exactly zero is not counted as negative (kills < 0 → <= 0)
  const z = negativeRegion([0, 0, 1]);
  assert.equal(z.indices.length, 0);
  assert.equal(z.fraction, 0);
});

test('negativeRegion: total on garbage', () => {
  assert.equal(negativeRegion('x').ok, false);
  assert.equal(negativeRegion([]).ok, false);
  assert.equal(negativeRegion([0, Infinity]).ok, false);
});

test('effectiveDensity + negativeRegion compose: a gentle ramp yields a negative band', () => {
  // field with small gradient (|g| < 2T) → negative; T=1 needs |g|<2
  const d = effectiveDensity([0, 0.5, 1, 1.5, 2], 1);   // gradient 0.5 everywhere → u = 0.125 - 0.5 = -0.375
  const neg = negativeRegion(d.density);
  assert.equal(neg.fraction, 1);
  assert.ok(neg.min < 0);
});
