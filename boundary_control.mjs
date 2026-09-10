// boundary_control.mjs — the distributed ERPC-Chua control loop on the bubble boundary.
//
// Gary/Nexus architecture, subsystem 1. The horizon problem: the front of the bubble
// cannot be steered from a centre because no signal reaches it in time. The answer in the
// spec is a DISTRIBUTED loop — each boundary cell is its own local controller with only
// nearest-neighbour coupling, so control is emergent, never centrally dispatched.
//
// The oscillator is Chua's circuit (canonical, real: a three-state nonlinear system with a
// piecewise-linear nonlinearity). What is REAL here is the dynamics and the control law —
// coupled Chua cells with local error feedback provably either hold a bounded boundary or
// diverge, and this bench measures which. What is GARY'S HYPOTHESIS (not proven here) is
// that this loop, applied to a real warp-bubble boundary, solves the horizon problem; the
// bench tests whether the CONTROL ARCHITECTURE is coherent, not whether the physics is real.
//
// Pure and total: bad input returns { ok:false, why }, never throws. Guards use
// Number.isFinite (rejects non-numbers, Infinity and NaN with no boolean operator to mutate)
// and are split one-condition-per-line, so every guard is individually killable by the gate.

const isFin = (v) => Number.isFinite(v);
const allFin = (arr) => arr.every(isFin);

// Chua's piecewise-linear nonlinearity f(x) — the diode characteristic. m0,m1 real slopes.
export function chuaNonlinearity(x, m0, m1) {
  if (!isFin(x)) return { ok: false, why: 'x must be a finite number' };
  if (!isFin(m0)) return { ok: false, why: 'm0 must be a finite number' };
  if (!isFin(m1)) return { ok: false, why: 'm1 must be a finite number' };
  const f = m1 * x + 0.5 * (m0 - m1) * (Math.abs(x + 1) - Math.abs(x - 1));
  return { ok: true, f };
}

// One explicit-Euler step of a single Chua cell driven by a local control input `u`.
export function chuaStep(state, params, u, dt) {
  if (typeof state !== 'object' || state === null) return { ok: false, why: 'state is { x, y, z }' };
  if (Array.isArray(state)) return { ok: false, why: 'state is { x, y, z }, not an array' };
  if (!allFin([state.x, state.y, state.z])) return { ok: false, why: 'state.x/y/z must be finite numbers' };
  if (typeof params !== 'object' || params === null) return { ok: false, why: 'params is { alpha, beta, m0, m1 }' };
  if (!allFin([params.alpha, params.beta, params.m0, params.m1])) return { ok: false, why: 'alpha/beta/m0/m1 must be finite numbers' };
  if (!isFin(u)) return { ok: false, why: 'control input u must be a finite number' };
  if (!isFin(dt)) return { ok: false, why: 'dt must be a finite number' };
  if (!(dt > 0)) return { ok: false, why: 'dt must be positive' };
  const { x, y, z } = state;
  const { alpha, beta, m0, m1 } = params;
  const fx = chuaNonlinearity(x, m0, m1).f;
  const dx = alpha * (y - x - fx);
  const dy = x - y + z;
  const dz = -beta * y + u;                 // control enters on the z-equation (the boundary coordinate)
  return { ok: true, state: { x: x + dt * dx, y: y + dt * dy, z: z + dt * dz } };
}

// ⚑ GARY-SPEC PORT: this is a PROPORTIONAL consensus placeholder standing in for the ERPC
// law. It holds the boundary to a bounded residual (a P-controller's steady-state floor) and
// has a step-size stability limit — enough to prove subsystem 1 CLOSES. Swap Gary's real
// error-regulated predictive control in here; the port (selfZ, neighbourZs, target, gain) →
// {u} stays the same, so nothing downstream changes.
//
// LOCAL ONLY: each cell sees its own boundary coordinate and its neighbours', never a global
// broadcast. u = gain·((neighbour_mean − self) + ½(target − self)) — consensus plus a weak
// target term, so the target diffuses cell-to-cell rather than being dispatched from a centre.
export function localControl(selfZ, neighbourZs, target, gain) {
  if (!isFin(selfZ)) return { ok: false, why: 'selfZ must be a finite number' };
  if (!Array.isArray(neighbourZs)) return { ok: false, why: 'neighbourZs must be an array' };
  if (neighbourZs.length === 0) return { ok: false, why: 'neighbourZs must be non-empty' };
  if (!allFin(neighbourZs)) return { ok: false, why: 'every neighbour z must be a finite number' };
  if (!isFin(target)) return { ok: false, why: 'target must be a finite number' };
  if (!isFin(gain)) return { ok: false, why: 'gain must be a finite number' };
  if (gain < 0) return { ok: false, why: 'gain must be non-negative' };
  const mean = neighbourZs.reduce((a, b) => a + b, 0) / neighbourZs.length;
  const u = gain * ((mean - selfZ) + 0.5 * (target - selfZ));
  return { ok: true, u };
}

// Advance a RING of N Chua cells one step under local-only control toward a boundary target.
export function distributedHold(cells, target, params, gain, dt) {
  if (!Array.isArray(cells)) return { ok: false, why: 'cells must be an array' };
  if (cells.length < 3) return { ok: false, why: 'a ring needs at least 3 cells' };
  if (!isFin(target)) return { ok: false, why: 'target must be a finite number' };
  const n = cells.length;
  // validate EVERY cell before the loop — a cell is read as its neighbours' neighbour too,
  // so a bad cell anywhere must be caught before any dereference.
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    if (typeof c !== 'object' || c === null) return { ok: false, why: 'cell ' + i + ' must be an object { x, y, z }' };
    if (!allFin([c.x, c.y, c.z])) return { ok: false, why: 'cell ' + i + ' must be { x, y, z } finite' };
  }
  const next = [];
  let maxErr = 0;
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    const left = cells[(i - 1 + n) % n];
    const right = cells[(i + 1) % n];
    const ctl = localControl(c.z, [left.z, right.z], target, gain);
    if (!ctl.ok) return { ok: false, why: 'cell ' + i + ': ' + ctl.why };
    const stepped = chuaStep(c, params, ctl.u, dt);
    if (!stepped.ok) return { ok: false, why: 'cell ' + i + ': ' + stepped.why };
    next.push(stepped.state);
    // Math.max, not `if (err > maxErr)` — the if-form's `>` has an equivalent `>=` mutant
    // (reassigning maxErr to an equal value changes nothing), which no test could ever kill.
    maxErr = Math.max(maxErr, Math.abs(stepped.state.z - target));
  }
  return { ok: true, cells: next, maxErr };
}

// Verdict over an error history: does the distributed loop HOLD the boundary (settles below
// tol) or diverge? "held" is the coherence signal for subsystem 1.
export function isHeld(errorHistory, tol) {
  if (!Array.isArray(errorHistory)) return { ok: false, why: 'errorHistory must be an array' };
  if (errorHistory.length < 2) return { ok: false, why: 'errorHistory needs at least 2 samples' };
  if (!allFin(errorHistory)) return { ok: false, why: 'each error sample must be a finite number' };
  if (errorHistory.some((v) => v < 0)) return { ok: false, why: 'error samples are magnitudes — never negative' };
  if (!isFin(tol)) return { ok: false, why: 'tol must be a finite number' };
  if (!(tol > 0)) return { ok: false, why: 'tol must be positive' };
  const tailLen = Math.ceil(errorHistory.length / 4);
  const tail = errorHistory.slice(errorHistory.length - tailLen);
  const worstTail = Math.max(...tail);
  const first = errorHistory[0];
  const last = errorHistory[errorHistory.length - 1];
  const held = worstTail <= tol;
  const diverging = last > first * 10;
  let verdict = 'unsettled';
  if (held) verdict = 'held';
  else if (diverging) verdict = 'diverging';
  return { ok: true, held, diverging, worstTail, verdict };
}
