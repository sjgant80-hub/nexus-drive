// nacelle_steering.mjs — dual nacelle differential steering.
//
// Gary/Nexus architecture, subsystem 3. Two nacelles; you steer by the DIFFERENCE in their
// output, not by a rudder. This is real differential-drive kinematics (the same maths that
// steers a two-track vehicle) applied to the drive's two field sources: equal output = pure
// forward, unequal output = a turn whose rate is set by the imbalance over the nacelle spacing.
//
// REAL here: the kinematics. GARY'S HYPOTHESIS: that the two "nacelles" are field emitters whose
// differential reshapes the bubble's heading. The bench tests that the steering law is coherent —
// balanced → straight, imbalanced → a proportional, correctly-signed turn.
//
// Pure and total; guards use Number.isFinite and are one-condition-per-line.

const isFin = (v) => Number.isFinite(v);

// Net forward thrust and yaw rate from left/right nacelle outputs over a baseline (spacing).
// forward = mean of the two; yawRate = (right − left) / baseline (right stronger → turn left,
// i.e. positive yaw = counter-clockwise, the standard convention).
export function differential(left, right, baseline) {
  if (!isFin(left)) return { ok: false, why: 'left nacelle output must be a finite number' };
  if (!isFin(right)) return { ok: false, why: 'right nacelle output must be a finite number' };
  if (!isFin(baseline)) return { ok: false, why: 'baseline (nacelle spacing) must be a finite number' };
  if (!(baseline > 0)) return { ok: false, why: 'baseline must be positive' };
  const forward = (left + right) / 2;
  const yawRate = (right - left) / baseline;
  return { ok: true, forward, yawRate };
}

// One kinematic step. state = { x, y, heading } (heading in radians). left/right nacelle
// outputs, baseline, dt. Advances heading by yawRate·dt and position by forward·dt along the
// (new) heading. Returns the new pose plus the forward/yaw that produced it.
export function steer(state, left, right, baseline, dt) {
  if (typeof state !== 'object' || state === null) return { ok: false, why: 'state is { x, y, heading }' };
  if (Array.isArray(state)) return { ok: false, why: 'state is { x, y, heading }, not an array' };
  if (!isFin(state.x)) return { ok: false, why: 'state.x must be a finite number' };
  if (!isFin(state.y)) return { ok: false, why: 'state.y must be a finite number' };
  if (!isFin(state.heading)) return { ok: false, why: 'state.heading must be a finite number' };
  if (!isFin(dt)) return { ok: false, why: 'dt must be a finite number' };
  if (!(dt > 0)) return { ok: false, why: 'dt must be positive' };
  const d = differential(left, right, baseline);
  if (!d.ok) return { ok: false, why: d.why };
  const heading = state.heading + d.yawRate * dt;
  const x = state.x + d.forward * Math.cos(heading) * dt;
  const y = state.y + d.forward * Math.sin(heading) * dt;
  return { ok: true, state: { x, y, heading }, forward: d.forward, yawRate: d.yawRate };
}

// Verdict: given a commanded left/right, does the drive steer as intended? balanced within
// eps → 'straight'; right>left → 'port' (positive yaw); left>right → 'starboard'.
export function steeringMode(left, right, eps) {
  if (!isFin(left)) return { ok: false, why: 'left must be a finite number' };
  if (!isFin(right)) return { ok: false, why: 'right must be a finite number' };
  if (!isFin(eps)) return { ok: false, why: 'eps must be a finite number' };
  if (!(eps >= 0)) return { ok: false, why: 'eps must be non-negative' };
  const diff = right - left;
  if (Math.abs(diff) <= eps) return { ok: true, mode: 'straight', diff };
  if (diff > 0) return { ok: true, mode: 'port', diff };
  return { ok: true, mode: 'starboard', diff };
}
