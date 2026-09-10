// replication.mjs — molecular replication by RESHAPING the activation barrier, not by force.
//
// Gary/Nexus architecture, subsystem 6. The spec's move: instead of pushing atoms together
// mechanically, reshape the energy landscape so the activation barrier drops and replication
// proceeds thermally on its own. The reaction rate is Arrhenius (canonical, real):
// k = A·exp(−Ea/T). "Reshaping" lowers the EFFECTIVE Ea by coupling to the entropy surface
// (subsystem 2) — the more entropy gradient the surface presents, the lower the barrier.
//
// REAL here: the Arrhenius rate and the threshold verdict. GARY'S HYPOTHESIS (labelled): that
// an entropy surface can reshape a real activation barrier. The barrier-lowering coupling is a
// PLACEHOLDER model — a linear reshape floored at zero (a barrier cannot go negative). GARY'S
// SPEC swaps in the real landscape functional; the ports stay the same.
//
// Pure and total; Number.isFinite guards, one condition per line.

const isFin = (v) => Number.isFinite(v);

// Arrhenius reaction rate k = prefactor · exp(−barrier / temperature), in kT units.
export function arrheniusRate(barrier, temperature, prefactor) {
  if (!isFin(barrier)) return { ok: false, why: 'barrier must be a finite number' };
  if (barrier < 0) return { ok: false, why: 'activation barrier cannot be negative' };
  if (!isFin(temperature)) return { ok: false, why: 'temperature must be a finite number' };
  if (!(temperature > 0)) return { ok: false, why: 'temperature must be positive' };
  if (!isFin(prefactor)) return { ok: false, why: 'prefactor must be a finite number' };
  if (!(prefactor > 0)) return { ok: false, why: 'prefactor must be positive' };
  const rate = prefactor * Math.exp(-barrier / temperature);
  return { ok: true, rate };
}

// Reshape the barrier: effective Ea = max(0, barrier − coupling·|entropyGradient|). The entropy
// surface lowers the barrier rather than force raising the reactants over it. Floored at 0 — a
// barrier cannot be negative, and `floored` reports when the surface has fully flattened it.
export function reshape(barrier, entropyGradient, coupling) {
  if (!isFin(barrier)) return { ok: false, why: 'barrier must be a finite number' };
  if (barrier < 0) return { ok: false, why: 'barrier cannot be negative' };
  if (!isFin(entropyGradient)) return { ok: false, why: 'entropyGradient must be a finite number' };
  if (!isFin(coupling)) return { ok: false, why: 'coupling must be a finite number' };
  if (coupling < 0) return { ok: false, why: 'coupling must be non-negative' };
  const lowered = barrier - coupling * Math.abs(entropyGradient);
  const effective = Math.max(0, lowered);
  const floored = lowered <= 0;
  return { ok: true, effective, floored, dropped: barrier - effective };
}

// Does the reaction proceed? rate at or above the threshold → replication.
export function replicates(rate, threshold) {
  if (!isFin(rate)) return { ok: false, why: 'rate must be a finite number' };
  if (rate < 0) return { ok: false, why: 'rate cannot be negative' };
  if (!isFin(threshold)) return { ok: false, why: 'threshold must be a finite number' };
  if (!(threshold > 0)) return { ok: false, why: 'threshold must be positive' };
  return { ok: true, replicates: rate >= threshold, rate, threshold };
}
