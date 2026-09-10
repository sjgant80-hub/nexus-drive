import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, defaultConfig, GAP_LIST, offIntegerGrid } from './bus.mjs';

test('offIntegerGrid: clean off-resonance probes, first at 0.3 (kills k + o → k - o)', () => {
  const g = offIntegerGrid();
  assert.equal(g.length, 60);            // 20 bands × 3 offsets
  assert.equal(g[0], 0.3);
  assert.equal(g.every((f) => Math.abs(f - Math.round(f)) > 0.05), true);   // all off-integer
});

test('the default architecture CLOSES — all six subsystems coherent, no open ports', () => {
  const r = run(defaultConfig());
  assert.equal(r.ok, true);
  assert.equal(r.closes, true);
  for (const k of ['power', 'steering', 'entropy', 'boundary', 'transducer', 'replication']) {
    assert.equal(r.subsystems[k].coherent, true, k + ': ' + (r.subsystems[k].why || ''));
  }
  assert.deepEqual(r.openPorts, []);
});

test('the gap list travels with every run (the placeholders needing Gary\'s equations)', () => {
  assert.equal(GAP_LIST.length, 3);
  const r = run(defaultConfig());
  assert.equal(r.gapList.length, 3);
  assert.deepEqual(r.gapList.map((g) => g.module).sort(), ['boundary_control', 'entropy_surface', 'replication']);
});

test('under-powered: delivered < demand opens the power port and the architecture does not close', () => {
  const c = defaultConfig();
  c.power.demand = 10000;                 // far above the 180 delivered
  const r = run(c);
  assert.equal(r.closes, false);
  assert.equal(r.subsystems.power.coherent, false);
  assert.ok(r.openPorts.includes('power'));
});

test('zero net thrust opens the steering port (kills forward > 0 → >= 0)', () => {
  const c = defaultConfig();
  c.nacelle.left = 0;
  c.nacelle.right = 0;                    // forward = 0, not > 0
  const r = run(c);
  assert.equal(r.subsystems.steering.coherent, false);
  assert.equal(r.closes, false);
});

test('steering still turns when the nacelles are imbalanced', () => {
  const c = defaultConfig();
  c.nacelle.left = 40;
  c.nacelle.right = 80;                   // forward 60 > 0 (coherent), yawRate (80-40)/4 = 10
  const r = run(c);
  assert.equal(r.subsystems.steering.coherent, true);
  assert.equal(r.subsystems.steering.yawRate, 10);
});

test('THE INTERFACE IS REAL: a broken transducer bridge cascades to replication', () => {
  // a bad slope makes cutAndProject fail → the transducer cannot bridge the scales → the
  // entropy surface never reaches the barrier (gradIn = 0) → the 10-unit barrier is unreshaped
  // → the rate falls below threshold → replication opens too. The molecular scale depends on
  // the bridge, exactly as the architecture claims.
  const c = defaultConfig();
  c.transducer.slope = -1;                // invalid → transducer incoherent
  const r = run(c);
  assert.equal(r.subsystems.transducer.coherent, false);
  assert.equal(r.subsystems.replication.coherent, false);
  assert.equal(r.subsystems.replication.viaBridge, false);
  assert.equal(r.closes, false);
});

test('a boundary that cannot hold (too large a step) opens the boundary port', () => {
  const c = defaultConfig();
  c.boundary.dt = 0.01;                   // well past the stability limit
  c.boundary.steps = 400;
  const r = run(c);
  assert.equal(r.subsystems.boundary.coherent, false);
  assert.ok(r.openPorts.includes('boundary'));
});

test('run: total on garbage config', () => {
  assert.equal(run(null).ok, false);
  assert.equal(run([]).ok, false);
  assert.equal(run('x').ok, false);
  assert.equal(run(42).ok, false);
});

test('no negative-energy region opens the entropy port (kills fraction > 0 → >= 0)', () => {
  const c = defaultConfig();
  c.field = Array.from({ length: 10 }, (_, i) => i * 100);   // steep ramp → |g| >> 2T → no negative band
  c.temperature = 1;
  const r = run(c);
  assert.equal(r.subsystems.entropy.coherent, false);
  assert.equal(r.subsystems.entropy.negativeFraction, 0);
  assert.equal(r.closes, false);
});

test('a saturating threshold makes quasi and periodic tie → not bridged (kills > → >= and && → ||)', () => {
  const c = defaultConfig();
  c.transducer.threshold = 0.99;             // neither set couples this hard → both fractions 0
  const r = run(c);
  assert.equal(r.subsystems.transducer.aperiodic, true);
  assert.equal(r.subsystems.transducer.coupledFraction, 0);
  assert.equal(r.subsystems.transducer.periodicFraction, 0);
  assert.equal(r.subsystems.transducer.coherent, false);     // 0 > 0 is false
});

test('degenerate transducer inputs hit the right sequential branch', () => {
  const c1 = defaultConfig();
  c1.transducer.count = 3;                   // too few sites for aperiodicity
  assert.match(run(c1).subsystems.transducer.why, /4 sites/);
  const c2 = defaultConfig();
  c2.transducer.freqs = [];                  // empty frequency grid
  assert.match(run(c2).subsystems.transducer.why, /freqs/);
});

test('each boundary guard fires with its own reason', () => {
  const bad = (patch) => { const c = defaultConfig(); Object.assign(c.boundary, patch); return run(c).subsystems.boundary; };
  assert.match(bad({ cells: 'x' }).why, /cells must be an array/);
  assert.match(bad({ steps: 1.5 }).why, /steps must be an integer/);
  assert.match(bad({ steps: 0 }).why, /steps must be positive/);   // kills steps > 0 → >= 0
});

test('run: a subsystem with a malformed sub-config is reported incoherent, never thrown', () => {
  const c = defaultConfig();
  c.power = { source: 'x', gains: [1], demand: 5 };   // bad source
  const r = run(c);
  assert.equal(r.ok, true);                            // the bus itself did not throw
  assert.equal(r.subsystems.power.coherent, false);
  assert.match(r.subsystems.power.why, /power chain/);
});
