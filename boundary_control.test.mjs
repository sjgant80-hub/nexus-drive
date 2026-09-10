import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chuaNonlinearity, chuaStep, localControl, distributedHold, isHeld } from './boundary_control.mjs';

const P = { alpha: 9, beta: 14.28, m0: -1.143, m1: -0.714 };

test('chua nonlinearity: pinned values on both slopes and the corner', () => {
  // |x|<=1: f = m0*x. f(0) = 0 (compared by magnitude so -0 counts).
  assert.ok(Math.abs(chuaNonlinearity(0, -1.143, -0.714).f) < 1e-12);
  // at x=1: 0.5*(m0-m1)*(|2|-|0|) + m1*1 = (m0-m1)*1 + m1 = m0
  assert.ok(Math.abs(chuaNonlinearity(1, -1.143, -0.714).f - (-1.143)) < 1e-12);
  // at x=2 (outer segment): m1*2 + 0.5*(m0-m1)*(3-1) = 2*m1 + (m0-m1) = m1 + m0
  assert.ok(Math.abs(chuaNonlinearity(2, -1.143, -0.714).f - (-0.714 + -1.143)) < 1e-12);
  assert.equal(chuaNonlinearity('x', 1, 1).ok, false);
  assert.equal(chuaNonlinearity(Infinity, 1, 1).ok, false);
});

test('chuaStep: one Euler step moves the state by dt*derivative, control on z', () => {
  const s = { x: 0.1, y: 0, z: 0 };
  const r = chuaStep(s, P, 0, 0.01);
  assert.equal(r.ok, true);
  // dz = -beta*y + u = 0 at y=0,u=0, so z stays 0 this step
  assert.equal(r.state.z, 0);
  // control input shifts z: dz gains u*dt
  const r2 = chuaStep(s, P, 5, 0.01);
  assert.ok(Math.abs(r2.state.z - 0.05) < 1e-12);
});

test('chuaStep: total on every malformed argument, each guard alone', () => {
  assert.equal(chuaStep(null, P, 0, 0.01).ok, false);                  // null state
  assert.equal(chuaStep([0, 0, 0], P, 0, 0.01).ok, false);             // array state
  assert.equal(chuaStep({ x: 0, y: 0 }, P, 0, 0.01).ok, false);        // missing z
  assert.equal(chuaStep({ x: 0, y: 0, z: 'a' }, P, 0, 0.01).ok, false);
  assert.equal(chuaStep({ x: 0, y: 0, z: 0 }, null, 0, 0.01).ok, false);      // null params
  assert.equal(chuaStep({ x: 0, y: 0, z: 0 }, { alpha: 9, beta: 14.28, m0: -1.143, m1: Infinity }, 0, 0.01).ok, false);
  assert.equal(chuaStep({ x: 0, y: 0, z: 0 }, P, 'u', 0.01).ok, false); // bad u
  assert.equal(chuaStep({ x: 0, y: 0, z: 0 }, P, 0, Infinity).ok, false); // non-finite dt
  assert.equal(chuaStep({ x: 0, y: 0, z: 0 }, P, 0, 0).ok, false);     // dt = 0 (kills > → >=)
  assert.equal(chuaStep({ x: 0, y: 0, z: 0 }, P, 0, -1).ok, false);    // dt < 0
});

test('chuaNonlinearity: each argument guard alone', () => {
  assert.equal(chuaNonlinearity(Infinity, 1, 1).ok, false);
  assert.equal(chuaNonlinearity(0, Infinity, 1).ok, false);
  assert.equal(chuaNonlinearity(0, 1, 'x').ok, false);
});

test('localControl: pulls toward neighbour consensus and the seeded target', () => {
  // self below both neighbours and target → positive push
  const r = localControl(0, [2, 2], 4, 1);
  // u = 1*((2-0) + 0.5*(4-0)) = 2 + 2 = 4
  assert.equal(r.u, 4);
  // at consensus and on target → zero control
  assert.equal(localControl(3, [3, 3], 3, 2).u, 0);
  // gain scales
  assert.equal(localControl(0, [2, 2], 0, 0.5).u, 0.5 * 2);
});

test('localControl: total on garbage, each guard alone', () => {
  assert.equal(localControl('x', [1], 0, 1).ok, false);      // selfZ not finite
  assert.equal(localControl(Infinity, [1], 0, 1).ok, false);
  assert.equal(localControl(0, 'x', 0, 1).ok, false);        // neighbours not an array
  assert.equal(localControl(0, [], 0, 1).ok, false);         // neighbours empty
  assert.equal(localControl(0, [1, 'y'], 0, 1).ok, false);   // a neighbour not finite
  assert.equal(localControl(0, [1], NaN, 1).ok, false);      // target not finite
  assert.equal(localControl(0, [1], 0, Infinity).ok, false); // gain not finite
  assert.equal(localControl(0, [1], 0, -1).ok, false);       // gain negative
});

test('localControl: gain of exactly 0 is valid and gives zero control (kills < → <=)', () => {
  const r = localControl(0, [2, 2], 4, 0);
  assert.equal(r.ok, true);
  assert.equal(r.u, 0);
});

test('distributedHold: a ring steps and reports max boundary error', () => {
  const cells = [{ x: 0.1, y: 0, z: 0 }, { x: -0.1, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }, { x: 0.05, y: 0, z: 0.5 }];
  const r = distributedHold(cells, 0, P, 0.5, 0.01);
  assert.equal(r.ok, true);
  assert.equal(r.cells.length, 4);
  assert.ok(r.maxErr >= 0);
  // a ring of exactly 3 is valid (kills length < 3 → <= 3)
  assert.equal(distributedHold([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }], 0, P, 0.5, 0.01).ok, true);
  // fewer than 3 refused, non-array refused, bad cell refused, bad target refused
  assert.equal(distributedHold([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], 0, P, 0.5, 0.01).ok, false);
  assert.equal(distributedHold('x', 0, P, 0.5, 0.01).ok, false);
  assert.equal(distributedHold([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 'a' }], 0, P, 0.5, 0.01).ok, false);
  assert.equal(distributedHold([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], Infinity, P, 0.5, 0.01).ok, false);
  // maxErr is the max deviation, exact on a static ring: z = {0,3,-1} vs target 0 → max |z| grows from dynamics, but at least the largest seed dominates round 1
  const stat = distributedHold([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: -1 }], 0, P, 0.5, 0.0001);
  assert.ok(stat.maxErr >= 1, 'maxErr should reflect the largest deviation: ' + stat.maxErr);
  // a null cell inside the ring is refused (kills the object-guard || → &&)
  assert.equal(distributedHold([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, null], 0, P, 0.5, 0.01).ok, false);
});

test('distributedHold: each cell reads its TWO distinct neighbours (kills left-index -1 → +1)', () => {
  // ring z = [0, 10, -10], all y=0, target 0. cell 0 neighbours are cell 2 (left) and cell 1 (right):
  // mean = (-10 + 10)/2 = 0, self 0 → u = 0 → z0 stays 0. If left were mis-indexed to +1 (= right),
  // both neighbours become cell 1 (z=10), mean = 10, u = 10·gain → z0 moves off 0.
  const r = distributedHold([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: -10 }], 0, P, 1, 0.001);
  assert.equal(r.ok, true);
  assert.ok(Math.abs(r.cells[0].z) < 1e-9, 'cell 0 should stay at 0 with balanced neighbours: ' + r.cells[0].z);
});

// helper: run the ring and return its error history
function ringRun(gain, dt, steps) {
  let cells = [{ x: 0.2, y: 0.1, z: 2 }, { x: -0.2, y: -0.1, z: -2 }, { x: 0.1, y: 0, z: 1.5 }, { x: -0.1, y: 0, z: -1.5 }, { x: 0, y: 0, z: 0.5 }];
  const hist = [];
  for (let i = 0; i < steps; i++) {
    const r = distributedHold(cells, 0, P, gain, dt);
    if (!r.ok) return { blew: true, why: r.why };
    cells = r.cells;
    hist.push(r.maxErr);
  }
  return { hist };
}

test('distributedHold: local-only control HOLDS the boundary to a bounded residual', () => {
  // stiff gain + small step: the ring settles to a bounded residual (subsystem-1 coherence).
  // A proportional controller against a persistent Chua disturbance holds to a nonzero floor,
  // not to zero — this is real P-control behaviour, honestly tested, not a claim of perfection.
  const { hist, blew } = ringRun(120, 0.001, 1500);
  assert.equal(blew, undefined);
  const v = isHeld(hist, 0.25);
  assert.equal(v.held, true, 'worstTail=' + v.worstTail);
  assert.equal(v.diverging, false);
});

test('distributedHold: the residual TIGHTENS as control stiffens (more gain, same step)', () => {
  const soft = isHeld(ringRun(20, 0.002, 800).hist, 0.25).worstTail;
  const stiff = isHeld(ringRun(80, 0.002, 800).hist, 0.25).worstTail;
  assert.ok(stiff < soft, 'stiffer gain should hold tighter: ' + soft + ' -> ' + stiff);
});

test('distributedHold: too large a step breaks the hold — a real stability limit', () => {
  // same gain, ten-fold larger step: the explicit-Euler loop loses the boundary.
  const small = isHeld(ringRun(80, 0.002, 800).hist, 0.5);
  const large = isHeld(ringRun(80, 0.005, 800).hist, 0.5);
  assert.equal(small.held, true);
  assert.equal(large.held, false, 'large-step worstTail=' + large.worstTail);
});

test('isHeld: settled history is held, exploding history is diverging', () => {
  const settled = [5, 3, 1, 0.4, 0.1, 0.05, 0.04, 0.03];
  const h = isHeld(settled, 0.1);
  assert.equal(h.held, true);
  assert.equal(h.verdict, 'held');
  const blowing = [0.1, 1, 5, 20, 80, 300];
  const d = isHeld(blowing, 0.1);
  assert.equal(d.held, false);
  assert.equal(d.diverging, true);
  assert.equal(d.verdict, 'diverging');
  const stuck = [5, 5, 5, 5];       // neither settled below tol nor 10x-exploded
  assert.equal(isHeld(stuck, 0.1).verdict, 'unsettled');
});

test('isHeld: total on garbage, each guard alone', () => {
  assert.equal(isHeld('x', 0.1).ok, false);           // not an array
  assert.equal(isHeld([1], 0.1).ok, false);           // < 2 samples
  assert.equal(isHeld([1, Infinity], 0.1).ok, false); // non-finite sample
  assert.equal(isHeld([1, -1], 0.1).ok, false);       // negative magnitude
  assert.equal(isHeld([1, 2], Infinity).ok, false);   // non-finite tol
  assert.equal(isHeld([1, 2], 0).ok, false);          // tol not positive (kills > → >=)
});

test('isHeld: exactly 2 samples is valid, and zero-error samples are valid (kills the two < → <=)', () => {
  assert.equal(isHeld([1, 2], 1).ok, true);            // length exactly 2 is enough
  const perfect = isHeld([0, 0, 0, 0], 1);             // 0 is a valid magnitude (perfect hold)
  assert.equal(perfect.ok, true);
  assert.equal(perfect.held, true);
  assert.equal(perfect.worstTail, 0);
});

test('isHeld: the tol boundary is inclusive (kills <= → <)', () => {
  // worstTail exactly equals tol → held, because the bound is <=. tail = last quarter.
  const hist = [5, 4, 3, 0.1]; // tailLen = ceil(4/4)=1 → tail [0.1], worstTail 0.1
  assert.equal(isHeld(hist, 0.1).worstTail, 0.1);
  assert.equal(isHeld(hist, 0.1).held, true);
  assert.equal(isHeld(hist, 0.099).held, false);
});

test('isHeld: the diverging factor is exactly 10x and not held (kills >/*10 mutants)', () => {
  // not held, last = 10*first exactly → NOT diverging (strict >), verdict unsettled.
  const h10 = [1, 2, 3, 10]; // worstTail 10 > tol; last 10, first 1; 10 > 10 is false
  assert.equal(isHeld(h10, 0.5).held, false);
  assert.equal(isHeld(h10, 0.5).diverging, false);
  assert.equal(isHeld(h10, 0.5).verdict, 'unsettled');
  // last between first*10(=20) and first+10(=12): only true divergence via *10 stays false here
  const hplus = [2, 5, 9, 15]; // 15 > 2*10=20 false → unsettled (kills + and / mutants of *10)
  assert.equal(isHeld(hplus, 0.5).verdict, 'unsettled');
  // genuinely diverging
  const hdiv = [1, 5, 40, 300];
  assert.equal(isHeld(hdiv, 0.5).diverging, true);
  assert.equal(isHeld(hdiv, 0.5).verdict, 'diverging');
});
