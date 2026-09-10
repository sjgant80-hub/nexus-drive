// power_chain.mjs — the continuous plasma -> catalyzed fusion -> nacelle power path.
//
// Gary/Nexus architecture, subsystem 4. Power is produced in stages, each with a gain
// (a fraction < 1 for a lossy conversion, or > 1 for a net-energy-gain stage such as
// catalyzed fusion with Q > 1). The chain folds an input source through the stages; the
// question the bench answers is whether the final delivered power meets the nacelles' demand.
//
// REAL here: the energy-balance arithmetic and the scaling verdict. GARY'S HYPOTHESIS: that a
// plasma feedstock through a catalyzed-fusion stage can be scaled to drive the nacelles. The
// bench does not claim the fusion gain is achievable — it tests whether the chain BALANCES:
// given each stage's gain, does supply reach demand, and where is the margin lost.
//
// Pure and total; Number.isFinite guards, one condition per line.

const isFin = (v) => Number.isFinite(v);

// One stage: output = input * gain. gain > 0 (a stage never inverts power); gain < 1 is a
// loss, gain > 1 is a net-gain stage (e.g. Q>1 fusion).
export function stage(input, gain) {
  if (!isFin(input)) return { ok: false, why: 'input power must be a finite number' };
  if (input < 0) return { ok: false, why: 'input power cannot be negative' };
  if (!isFin(gain)) return { ok: false, why: 'gain must be a finite number' };
  if (!(gain > 0)) return { ok: false, why: 'gain must be positive' };
  return { ok: true, output: input * gain };
}

// Fold a source through an ordered list of stage gains. Returns the delivered power and the
// running power after each stage (so a lossy stage is visible in the trace).
export function chain(source, gains) {
  if (!isFin(source)) return { ok: false, why: 'source power must be a finite number' };
  if (source < 0) return { ok: false, why: 'source power cannot be negative' };
  if (!Array.isArray(gains)) return { ok: false, why: 'gains must be an array' };
  if (gains.length === 0) return { ok: false, why: 'gains must be a non-empty stage list' };
  const trace = [];
  let power = source;
  for (let i = 0; i < gains.length; i++) {
    const s = stage(power, gains[i]);
    if (!s.ok) return { ok: false, why: 'stage ' + i + ': ' + s.why };
    power = s.output;
    trace.push(power);
  }
  return { ok: true, delivered: power, trace };
}

// Does the delivered power meet the nacelles' demand? margin = supply - demand; scales when
// margin >= 0. ratio = supply/demand (headroom factor).
export function scales(supply, demand) {
  if (!isFin(supply)) return { ok: false, why: 'supply must be a finite number' };
  if (supply < 0) return { ok: false, why: 'supply cannot be negative' };
  if (!isFin(demand)) return { ok: false, why: 'demand must be a finite number' };
  if (!(demand > 0)) return { ok: false, why: 'demand must be positive' };
  const margin = supply - demand;
  const ratio = supply / demand;
  const meets = margin >= 0;
  return { ok: true, meets, margin, ratio };
}
