import { test } from 'node:test';
import assert from 'node:assert/strict';
import { differential, steer, steeringMode } from './nacelle_steering.mjs';

test('differential: balanced nacelles → pure forward, zero yaw', () => {
  const r = differential(10, 10, 2);
  assert.equal(r.ok, true);
  assert.equal(r.forward, 10);
  assert.equal(r.yawRate, 0);
});

test('differential: right stronger → positive yaw, scaled by baseline', () => {
  // (right-left)/baseline = (14-10)/2 = 2 ; forward = 12
  const r = differential(10, 14, 2);
  assert.equal(r.forward, 12);
  assert.equal(r.yawRate, 2);
  // wider baseline → gentler yaw for the same imbalance
  assert.equal(differential(10, 14, 4).yawRate, 1);
  // left stronger → negative yaw
  assert.equal(differential(14, 10, 2).yawRate, -2);
});

test('differential: total on garbage, each guard alone, baseline must be > 0', () => {
  assert.equal(differential('x', 10, 2).ok, false);
  assert.equal(differential(10, Infinity, 2).ok, false);
  assert.equal(differential(10, 10, NaN).ok, false);
  assert.equal(differential(10, 10, 0).ok, false);       // kills baseline > 0 → >= 0
  assert.equal(differential(10, 10, -2).ok, false);
});

test('steer: balanced drive moves straight along heading 0 (+x only)', () => {
  const r = steer({ x: 0, y: 0, heading: 0 }, 10, 10, 2, 0.1);
  assert.equal(r.ok, true);
  assert.equal(r.yawRate, 0);
  assert.equal(r.state.heading, 0);
  assert.ok(Math.abs(r.state.x - 1) < 1e-12);   // 10 * cos0 * 0.1 = 1
  assert.ok(Math.abs(r.state.y - 0) < 1e-12);   // 10 * sin0 * 0.1 = 0
});

test('steer: imbalance turns the heading, and the sign is correct', () => {
  const r = steer({ x: 0, y: 0, heading: 0 }, 8, 12, 2, 0.5);
  // yawRate = (12-8)/2 = 2 ; heading = 0 + 2*0.5 = 1 rad
  assert.ok(Math.abs(r.state.heading - 1) < 1e-12);
  // a mirror imbalance turns the other way by the same amount
  const l = steer({ x: 0, y: 0, heading: 0 }, 12, 8, 2, 0.5);
  assert.ok(Math.abs(l.state.heading + 1) < 1e-12);
});

test('steer: total on garbage, each guard alone', () => {
  assert.equal(steer(null, 10, 10, 2, 0.1).ok, false);
  assert.equal(steer([0, 0, 0], 10, 10, 2, 0.1).ok, false);
  assert.equal(steer({ x: 'a', y: 0, heading: 0 }, 10, 10, 2, 0.1).ok, false);
  assert.equal(steer({ x: 0, y: Infinity, heading: 0 }, 10, 10, 2, 0.1).ok, false);
  assert.equal(steer({ x: 0, y: 0, heading: NaN }, 10, 10, 2, 0.1).ok, false);
  assert.equal(steer({ x: 0, y: 0, heading: 0 }, 10, 10, 2, Infinity).ok, false);
  assert.equal(steer({ x: 0, y: 0, heading: 0 }, 10, 10, 2, 0).ok, false);   // dt = 0
  assert.equal(steer({ x: 0, y: 0, heading: 0 }, 'x', 10, 2, 0.1).ok, false); // bad nacelle
  assert.equal(steer({ x: 0, y: 0, heading: 0 }, 10, 10, 0, 0.1).ok, false);  // bad baseline
});

test('steeringMode: straight / port / starboard on the eps band', () => {
  assert.equal(steeringMode(10, 10, 0.5).mode, 'straight');
  assert.equal(steeringMode(10, 10.5, 0.5).mode, 'straight');  // exactly eps → straight (kills <= → <)
  assert.equal(steeringMode(10, 10.6, 0.5).mode, 'port');
  assert.equal(steeringMode(10.6, 10, 0.5).mode, 'starboard');
  assert.equal(steeringMode(10, 11, 0.5).diff, 1);
});

test('steeringMode: total on garbage, eps must be >= 0', () => {
  assert.equal(steeringMode('x', 10, 0.5).ok, false);
  assert.equal(steeringMode(10, Infinity, 0.5).ok, false);
  assert.equal(steeringMode(10, 10, NaN).ok, false);
  assert.equal(steeringMode(10, 10, -1).ok, false);
  assert.equal(steeringMode(10, 10, 0).ok, true);   // eps 0 is valid (kills >= 0 → > 0)
});
