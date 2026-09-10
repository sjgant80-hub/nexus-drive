import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cutAndProject, isAperiodic, structureFactor, couplingBandwidth } from './transducer.mjs';

const PHI_INV = 0.618033988749895;               // 1/φ, a standard quasicrystal slope
const qc = () => cutAndProject(60, PHI_INV, 1.0).sites;
const periodic = (n) => { const a = []; for (let i = 0; i < n; i++) a.push(i); return a; };

test('cutAndProject: deterministic Sturmian sites, exactly two gap lengths', () => {
  const r = cutAndProject(30, PHI_INV, 1.0);
  assert.equal(r.ok, true);
  assert.equal(r.sites.length, 30);            // exactly count sites (kills loop k < count-1 mutants)
  assert.equal(r.sites[0], 0);
  // α = 0.618/1.618 = 0.381966… ; first gap is SHORT (S = α), so site 1 = S, not L=1
  assert.ok(Math.abs(r.sites[1] - 0.3819660112501051) < 1e-12, 'first gap is S (kills Sturmian-bit > 0 → >= 0): ' + r.sites[1]);
  // strictly increasing
  for (let i = 1; i < r.sites.length; i++) assert.ok(r.sites[i] > r.sites[i - 1]);
  // exactly two distinct gap lengths (L and S) — the quasicrystal signature
  const gaps = [];
  for (let i = 1; i < r.sites.length; i++) gaps.push(Math.round((r.sites[i] - r.sites[i - 1]) * 1e6) / 1e6);
  assert.equal(new Set(gaps).size, 2);
});

test('cutAndProject: total on garbage, count integer >= 1, slope/window > 0', () => {
  assert.equal(cutAndProject(1.5, PHI_INV, 1).ok, false);   // non-integer count
  assert.equal(cutAndProject(0, PHI_INV, 1).ok, false);     // count < 1
  assert.equal(cutAndProject(1, PHI_INV, 1).ok, true);      // count exactly 1 valid (kills < 1 → <= 1)
  assert.equal(cutAndProject(10, Infinity, 1).ok, false);
  assert.equal(cutAndProject(10, 0, 1).ok, false);          // slope 0 (kills > 0 → >= 0)
  assert.equal(cutAndProject(10, PHI_INV, 0).ok, false);    // window 0
  assert.equal(cutAndProject(10, PHI_INV, -1).ok, false);
});

test('isAperiodic: a cut-and-project set is aperiodic; a lattice is not', () => {
  assert.equal(isAperiodic(qc(), 1e-6).aperiodic, true);
  const p = isAperiodic(periodic(30), 1e-9);
  assert.equal(p.aperiodic, false);
  assert.equal(p.distinctGaps, 1);            // a lattice has one gap length
});

test('isAperiodic: catches a period exactly at floor(len/2) (kills p <= .. → p < ..)', () => {
  // sites [0,1,3,4,6] → gaps [1,2,1,2], period 2 = floor(4/2). Must be flagged periodic.
  assert.equal(isAperiodic([0, 1, 3, 4, 6], 1e-9).aperiodic, false);
  // an actually aperiodic short set: gaps [1,2,1,3] has no repeat
  assert.equal(isAperiodic([0, 1, 3, 4, 7], 1e-9).aperiodic, true);
});

test('isAperiodic: the tol boundaries are exact and inclusive (integer-exact, kills both tol mutants)', () => {
  // sites [0,2,5,8] → gaps [2,3,3]. With tol=1, gaps 2 and 3 differ by EXACTLY tol.
  // gap-match uses > tol (matching when within tol): period-1 holds → periodic (aperiodic false);
  //   mutating to >= tol would break at the exactly-tol pair → wrongly aperiodic.
  assert.equal(isAperiodic([0, 2, 5, 8], 1).aperiodic, false);
  // distinct-gap merge uses <= tol (2 and 3 merge as one) → ONE distinct gap;
  //   mutating to < tol would count them separately → two.
  assert.equal(isAperiodic([0, 2, 5, 8], 1).distinctGaps, 1);
});

test('isAperiodic: total on garbage, needs >= 4 sites, tol > 0', () => {
  assert.equal(isAperiodic('x', 1e-6).ok, false);
  assert.equal(isAperiodic([0, 1, 2], 1e-6).ok, false);          // < 4 sites
  assert.equal(isAperiodic([0, 1, 2, 3], 1e-6).ok, true);        // exactly 4 valid (kills < 4 → <= 4)
  assert.equal(isAperiodic([0, 1, Infinity, 3], 1e-6).ok, false);
  assert.equal(isAperiodic([0, 1, 2, 3], 0).ok, false);          // tol not positive
});

test('structureFactor: DC is 1, a periodic lattice has a spectral GAP the quasicrystal fills', () => {
  // f = 0: every phase is 0 → magnitude exactly 1, for any set
  assert.ok(Math.abs(structureFactor(periodic(10), 0).magnitude - 1) < 1e-12);
  assert.ok(Math.abs(structureFactor(qc(), 0).magnitude - 1) < 1e-12);
  // f = 0.5 on an even-length unit lattice: Σ(-1)^k = 0 → exact spectral gap
  assert.ok(Math.abs(structureFactor([0, 1, 2, 3], 0.5).magnitude) < 1e-12);
  // the quasicrystal has real coupling at that same mid-gap frequency
  assert.ok(structureFactor(qc(), 0.5).magnitude > 0.02, 'quasicrystal should fill the gap at f=0.5');
});

test('structureFactor: total on garbage', () => {
  assert.equal(structureFactor('x', 1).ok, false);
  assert.equal(structureFactor([], 1).ok, false);
  assert.equal(structureFactor([0, Infinity], 1).ok, false);
  assert.equal(structureFactor([0, 1], NaN).ok, false);
});

test('couplingBandwidth: the quasicrystal couples across the gaps far more than the lattice', () => {
  // off-integer grid = the frequencies BETWEEN a unit lattice's Bragg lines
  const freqs = [];
  for (let k = 1; k < 200; k++) { const f = k * 0.02; if (Math.abs(f - Math.round(f)) > 0.1) freqs.push(f); }
  const q = couplingBandwidth(qc(), freqs, 0.15);
  const p = couplingBandwidth(periodic(60), freqs, 0.15);
  assert.equal(q.ok, true);
  assert.equal(q.total, freqs.length);
  assert.ok(q.fraction > p.fraction, 'quasi ' + q.fraction + ' should exceed periodic ' + p.fraction);
  assert.ok(p.fraction < 0.001, 'the lattice barely couples off-resonance: ' + p.fraction);
});

test('couplingBandwidth: total on garbage, threshold >= 0', () => {
  assert.equal(couplingBandwidth('x', [1], 0.5).ok, false);
  assert.equal(couplingBandwidth([], [1], 0.5).ok, false);
  assert.equal(couplingBandwidth([0, 1], 'x', 0.5).ok, false);
  assert.equal(couplingBandwidth([0, 1], [], 0.5).ok, false);
  assert.equal(couplingBandwidth([0, 1], [1], Infinity).ok, false);
  assert.equal(couplingBandwidth([0, 1], [1], -1).ok, false);
  assert.equal(couplingBandwidth([0, 1], [0], 0).ok, true);      // threshold 0 valid (kills < 0 → <= 0); f=0 → mag 1 >= 0
});

test('couplingBandwidth: the threshold boundary is inclusive (kills magnitude >= t → > t)', () => {
  // f = 0 gives structure factor exactly 1; threshold 1 → 1 >= 1 counts it (fraction 1),
  // whereas > 1 would drop it (fraction 0).
  const r = couplingBandwidth([0, 1, 2], [0], 1);
  assert.equal(r.ok, true);
  assert.equal(r.fraction, 1);
  assert.equal(r.coupled, 1);
});
