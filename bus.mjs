// bus.mjs — the interface layer. Gary's actual ask: wire the six subsystems together through
// defined ports and run the coupled architecture, so we can SEE whether it closes.
//
// The wiring (ports named, so a subsystem can be swapped without touching the others):
//
//   power_chain ──delivered──▶ scales(vs nacelle demand) ──▶ nacelle_steering (thrust + yaw)
//   entropy_surface ──neg-region depth──▶ transducer(scale bridge) ──▶ replication.reshape(barrier)
//   boundary_control ──held?──▶ (the horizon-problem loop stands or falls on its own)
//
// The transducer is the SCALE BRIDGE, not the centrepiece: its broadband coupling is what lets
// the field-scale entropy surface reshape the molecular-scale replication barrier at all.
//
// "closes" = every subsystem is internally coherent AND every interface between them is
// satisfied. It is a test of the ARCHITECTURE's coherence, never a claim the physics is real.
// A subsystem that returns ok:false is reported as incoherent with its own reason — the bus
// never throws.

import { distributedHold, isHeld } from './boundary_control.mjs';
import { effectiveDensity, negativeRegion } from './entropy_surface.mjs';
import { differential } from './nacelle_steering.mjs';
import { chain, scales } from './power_chain.mjs';
import { cutAndProject, isAperiodic, couplingBandwidth, structureFactor } from './transducer.mjs';
import { reshape, arrheniusRate, replicates } from './replication.mjs';

// modules whose dynamics are honest PLACEHOLDERS awaiting Gary's real equations — reported so
// the gap list travels with every run.
export const GAP_LIST = Object.freeze([
  { module: 'boundary_control', port: 'localControl', needs: "Gary's ERPC law (this stands in a proportional consensus placeholder)" },
  { module: 'entropy_surface', port: 'effectiveDensity', needs: "Gary's real entropy functional (this is a free-energy reframing model, not a stress-energy tensor)" },
  { module: 'replication', port: 'reshape', needs: "Gary's real landscape functional (this is a linear barrier-lowering placeholder)" },
]);

// off-integer frequency grid: three probes strictly BETWEEN each pair of a unit lattice's
// Bragg lines (the spectral gaps). Built explicitly (no floating-point "distance from integer"
// filter, which is unkillable-by-construction), so every frequency is cleanly off-resonance.
export function offIntegerGrid() {
  const offsets = [0.3, 0.5, 0.7];
  return Array.from({ length: 20 }, (_, k) => k).flatMap((k) => offsets.map((o) => k + o));
}

export function defaultConfig() {
  // Array.from, not index loops — a bounded loop's `<` carries an equivalent `<=` mutant.
  const field = Array.from({ length: 24 }, (_, i) => i * 0.5);      // a gentle ramp (small gradient → a negative band)
  const cells = Array.from({ length: 5 }, (_, i) => ({ x: 0.1 * (i - 2), y: 0, z: 2 - i }));
  const freqs = offIntegerGrid();
  return {
    power: { source: 50, gains: [5, 0.8, 0.9], demand: 120 },  // plasma → fusion×5 → losses; 180 delivered vs 120 demand
    nacelle: { left: 60, right: 60, baseline: 4 },
    field, temperature: 1,
    boundary: { cells, target: 0, gain: 120, dt: 0.001, steps: 1500, tol: 0.25 },
    transducer: { count: 60, slope: 0.618033988749895, window: 1, freqs, threshold: 0.15 },
    replication: { barrier: 10, coupling: 12, temperature: 1, prefactor: 1, rateThreshold: 0.1 },
  };
}

function num(v) { return Number.isFinite(v); }

export function run(config) {
  if (typeof config !== 'object' || config === null) return { ok: false, why: 'config must be an object (try defaultConfig())' };
  if (Array.isArray(config)) return { ok: false, why: 'config must be an object, not an array' };
  const subsystems = {};

  // 1 · POWER CHAIN → does delivered power meet the nacelle demand?
  const p = config.power || {};
  const ch = chain(p.source, p.gains);
  if (!ch.ok) subsystems.power = { coherent: false, why: 'power chain: ' + ch.why };
  else {
    const sc = scales(ch.delivered, p.demand);
    if (!sc.ok) subsystems.power = { coherent: false, why: 'power scaling: ' + sc.why };
    else subsystems.power = { coherent: sc.meets, delivered: ch.delivered, demand: p.demand, margin: sc.margin, ratio: sc.ratio };
  }

  // 2 · NACELLE STEERING → does the differential produce forward thrust (and steer when asked)?
  const nc = config.nacelle || {};
  const df = differential(nc.left, nc.right, nc.baseline);
  if (!df.ok) subsystems.steering = { coherent: false, why: 'steering: ' + df.why };
  else subsystems.steering = { coherent: df.forward > 0, forward: df.forward, yawRate: df.yawRate };

  // 3 · ENTROPY SURFACE → does the reframing produce a negative-energy region?
  const ed = effectiveDensity(config.field, config.temperature);
  let negDepth = 0;
  if (!ed.ok) subsystems.entropy = { coherent: false, why: 'entropy surface: ' + ed.why };
  else {
    const nr = negativeRegion(ed.density);
    if (!nr.ok) subsystems.entropy = { coherent: false, why: 'negative region: ' + nr.why };
    else {
      negDepth = num(nr.min) ? Math.abs(Math.min(0, nr.min)) : 0;
      subsystems.entropy = { coherent: nr.fraction > 0, negativeFraction: nr.fraction, depth: negDepth };
    }
  }

  // 4 · BOUNDARY CONTROL → does the distributed loop hold the boundary (horizon problem)?
  // Sequential guards (each individually killable), then Array.from over the step count so the
  // loop has no `<` bound to carry an equivalent `<=` mutant.
  const b = config.boundary || {};
  if (!Array.isArray(b.cells)) subsystems.boundary = { coherent: false, why: 'boundary: cells must be an array' };
  else if (!Number.isInteger(b.steps)) subsystems.boundary = { coherent: false, why: 'boundary: steps must be an integer' };
  else if (!(b.steps > 0)) subsystems.boundary = { coherent: false, why: 'boundary: steps must be positive' };
  else {
    let cells = b.cells;
    let bad = null;
    const hist = [];
    Array.from({ length: b.steps }).forEach(() => {
      if (bad !== null) return;
      const r = distributedHold(cells, b.target, { alpha: 9, beta: 14.28, m0: -1.143, m1: -0.714 }, b.gain, b.dt);
      if (!r.ok) { bad = r.why; return; }
      cells = r.cells;
      hist.push(r.maxErr);
    });
    if (bad !== null) subsystems.boundary = { coherent: false, why: 'boundary: ' + bad };
    else {
      const held = isHeld(hist, b.tol);
      subsystems.boundary = held.ok ? { coherent: held.held, verdict: held.verdict, worstTail: held.worstTail } : { coherent: false, why: held.why };
    }
  }

  // 5 · TRANSDUCER (SCALE BRIDGE) → aperiodic + broadband coupling beyond a periodic lattice?
  const t = config.transducer || {};
  const qc = cutAndProject(t.count, t.slope, t.window);
  let bridged = false;
  if (!qc.ok) subsystems.transducer = { coherent: false, why: 'transducer: ' + qc.why };
  else {
    const ap = isAperiodic(qc.sites, 1e-9);
    const qb = couplingBandwidth(qc.sites, t.freqs, t.threshold);
    const per = Array.from({ length: t.count }, (_, i) => i);       // periodic control lattice
    const pb = couplingBandwidth(per, t.freqs, t.threshold);
    // sequential checks — each result individually reportable and killable.
    if (!ap.ok) subsystems.transducer = { coherent: false, why: 'transducer: ' + ap.why };
    else if (!qb.ok) subsystems.transducer = { coherent: false, why: 'transducer: ' + qb.why };
    else if (!pb.ok) subsystems.transducer = { coherent: false, why: 'transducer: ' + pb.why };
    else {
      bridged = ap.aperiodic && qb.fraction > pb.fraction;
      subsystems.transducer = { coherent: bridged, aperiodic: ap.aperiodic, coupledFraction: qb.fraction, periodicFraction: pb.fraction };
    }
  }

  // 6 · REPLICATION → the entropy surface (via the bridge) reshapes the barrier over threshold?
  // INTERFACE: the entropy-surface depth feeds the reshape ONLY IF the transducer bridges the
  // scales — otherwise the field-scale surface cannot reach the molecular-scale barrier.
  const rp = config.replication || {};
  const gradIn = bridged ? negDepth * 10 : 0;                 // the bridge carries the surface depth to the barrier
  const rs = reshape(rp.barrier, gradIn, rp.coupling);
  if (!rs.ok) subsystems.replication = { coherent: false, why: 'reshape: ' + rs.why };
  else {
    const kr = arrheniusRate(rs.effective, rp.temperature, rp.prefactor);
    if (!kr.ok) subsystems.replication = { coherent: false, why: 'rate: ' + kr.why };
    else {
      const rep = replicates(kr.rate, rp.rateThreshold);
      subsystems.replication = rep.ok
        ? { coherent: rep.replicates, effectiveBarrier: rs.effective, rate: kr.rate, viaBridge: bridged }
        : { coherent: false, why: 'replicates: ' + rep.why };
    }
  }

  const order = ['power', 'steering', 'entropy', 'boundary', 'transducer', 'replication'];
  const closes = order.every((k) => subsystems[k] && subsystems[k].coherent === true);
  const openPorts = order.filter((k) => !(subsystems[k] && subsystems[k].coherent === true));
  return { ok: true, closes, subsystems, openPorts, gapList: GAP_LIST };
}
