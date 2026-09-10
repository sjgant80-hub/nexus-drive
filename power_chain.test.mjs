import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stage, chain, scales } from './power_chain.mjs';

test('stage: gain scales the input; loss and net-gain both work', () => {
  assert.equal(stage(100, 0.5).output, 50);   // lossy
  assert.equal(stage(100, 3).output, 300);    // net-gain (Q>1)
  assert.equal(stage(0, 5).output, 0);        // zero input stays zero (kills input < 0 → <= 0 boundary)
});

test('stage: total on garbage, gain must be > 0, input >= 0', () => {
  assert.equal(stage('x', 1).ok, false);
  assert.equal(stage(-1, 1).ok, false);        // negative input
  assert.equal(stage(100, Infinity).ok, false);
  assert.equal(stage(100, 0).ok, false);       // gain 0 (kills > 0 → >= 0)
  assert.equal(stage(100, -1).ok, false);
});

test('chain: folds source through the stages in order', () => {
  // 10 -> *2 -> *0.5 -> *4  = 10*2=20, *0.5=10, *4=40
  const r = chain(10, [2, 0.5, 4]);
  assert.equal(r.ok, true);
  assert.equal(r.delivered, 40);
  assert.deepEqual(r.trace, [20, 10, 40]);
});

test('chain: a single stage and a lossy chain', () => {
  assert.equal(chain(100, [0.9]).delivered, 90);
  assert.equal(chain(100, [0.9]).trace.length, 1);
  // plasma(50) -> fusion gain 5 -> transmission 0.8 -> coupling 0.9
  const r = chain(50, [5, 0.8, 0.9]);
  assert.ok(Math.abs(r.delivered - 180) < 1e-9);   // 50*5*0.8*0.9 = 180
  // zero source is valid (kills source < 0 → <= 0): stays zero through every stage
  const z = chain(0, [2, 3]);
  assert.equal(z.ok, true);
  assert.equal(z.delivered, 0);
});

test('chain: total on garbage, order-sensitive stage error', () => {
  assert.equal(chain('x', [1]).ok, false);
  assert.equal(chain(-1, [1]).ok, false);
  assert.equal(chain(10, 'x').ok, false);
  assert.equal(chain(10, []).ok, false);           // empty stage list
  assert.equal(chain(10, [2, 0, 4]).ok, false);    // a bad stage in the middle
  assert.match(chain(10, [2, 0, 4]).why, /stage 1/);
});

test('scales: supply meeting demand, the margin boundary is inclusive', () => {
  assert.equal(scales(180, 100).meets, true);
  assert.equal(scales(180, 100).margin, 80);
  assert.equal(scales(100, 100).meets, true);      // exactly meets (kills margin >= 0 → > 0)
  assert.equal(scales(100, 100).margin, 0);
  assert.equal(scales(80, 100).meets, false);      // under-powered
  assert.equal(scales(80, 100).margin, -20);
  assert.equal(scales(200, 100).ratio, 2);
  // zero supply is valid input (kills supply < 0 → <= 0): meets false, margin -demand
  const z = scales(0, 100);
  assert.equal(z.ok, true);
  assert.equal(z.meets, false);
  assert.equal(z.margin, -100);
});

test('scales: total on garbage, demand must be > 0', () => {
  assert.equal(scales('x', 100).ok, false);
  assert.equal(scales(-1, 100).ok, false);
  assert.equal(scales(100, Infinity).ok, false);
  assert.equal(scales(100, 0).ok, false);          // zero demand undefined ratio
  assert.equal(scales(100, -1).ok, false);
});
