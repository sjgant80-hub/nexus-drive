import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrheniusRate, reshape, replicates } from './replication.mjs';

test('arrheniusRate: zero barrier gives the prefactor; higher barrier lowers the rate', () => {
  assert.equal(arrheniusRate(0, 1, 1).rate, 1);                     // exp(0) = 1
  assert.ok(Math.abs(arrheniusRate(1, 1, 1).rate - Math.exp(-1)) < 1e-12);
  assert.ok(Math.abs(arrheniusRate(2, 2, 5).rate - 5 * Math.exp(-1)) < 1e-12);
  // rate is monotone decreasing in barrier
  assert.ok(arrheniusRate(3, 1, 1).rate < arrheniusRate(1, 1, 1).rate);
});

test('arrheniusRate: total on garbage, barrier >= 0, temp/prefactor > 0', () => {
  assert.equal(arrheniusRate(-1, 1, 1).ok, false);      // negative barrier
  assert.equal(arrheniusRate(0, 1, 1).ok, true);        // barrier 0 valid (kills < 0 → <= 0)
  assert.equal(arrheniusRate(1, Infinity, 1).ok, false);
  assert.equal(arrheniusRate(1, 0, 1).ok, false);       // temp 0 (kills > 0 → >= 0)
  assert.equal(arrheniusRate(1, 1, 0).ok, false);       // prefactor 0
  assert.equal(arrheniusRate('x', 1, 1).ok, false);
});

test('reshape: the entropy surface lowers the barrier, floored at zero', () => {
  const r = reshape(10, 5, 1);        // 10 - 1*5 = 5
  assert.equal(r.effective, 5);
  assert.equal(r.floored, false);
  assert.equal(r.dropped, 5);
  const f = reshape(10, 20, 1);       // 10 - 20 = -10 → floored to 0
  assert.equal(f.effective, 0);
  assert.equal(f.floored, true);
  assert.equal(f.dropped, 10);
  // exact-flatten boundary: lowered == 0 counts as floored (kills <= 0 → < 0)
  const e = reshape(10, 10, 1);       // 10 - 10 = 0
  assert.equal(e.effective, 0);
  assert.equal(e.floored, true);
  // |entropyGradient| is used (sign-independent)
  assert.equal(reshape(10, -5, 1).effective, 5);
});

test('reshape: total on garbage, barrier >= 0, coupling >= 0', () => {
  assert.equal(reshape(-1, 5, 1).ok, false);
  assert.equal(reshape(0, 5, 1).ok, true);              // barrier 0 valid (kills < 0 → <= 0)
  assert.equal(reshape(10, Infinity, 1).ok, false);
  assert.equal(reshape(10, 5, -1).ok, false);           // negative coupling
  assert.equal(reshape(10, 5, 0).ok, true);             // coupling 0 valid (kills < 0 → <= 0): no reshape
  assert.equal(reshape(10, 5, 0).effective, 10);
});

test('replicates: proceeds at or above threshold; the boundary is inclusive', () => {
  assert.equal(replicates(0.5, 0.3).replicates, true);
  assert.equal(replicates(0.3, 0.3).replicates, true);   // exactly threshold (kills >= → >)
  assert.equal(replicates(0.2, 0.3).replicates, false);
});

test('replicates: total on garbage, rate >= 0, threshold > 0', () => {
  assert.equal(replicates(-1, 0.3).ok, false);           // negative rate
  assert.equal(replicates(0, 0.3).ok, true);             // rate 0 valid (kills < 0 → <= 0)
  assert.equal(replicates(0.5, Infinity).ok, false);
  assert.equal(replicates(0.5, 0).ok, false);            // threshold 0 (kills > 0 → >= 0)
  assert.equal(replicates('x', 0.3).ok, false);
});

test('reshape + arrhenius compose: reshaping a high barrier lifts the rate over threshold', () => {
  const before = arrheniusRate(10, 1, 1).rate;           // tiny
  const eff = reshape(10, 9, 1).effective;               // 10 - 9 = 1
  const after = arrheniusRate(eff, 1, 1).rate;           // exp(-1), much larger
  assert.ok(after > before);
  assert.equal(replicates(before, 0.1).replicates, false);
  assert.equal(replicates(after, 0.1).replicates, true);
});
