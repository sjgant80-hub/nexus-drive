// entropy_surface.mjs — the entropy-surface reframing of negative energy density.
//
// Gary/Nexus architecture, subsystem 2. The Alcubierre-class problem is that the metric needs
// regions of NEGATIVE energy density (exotic matter). The spec's move is to reframe that
// thermodynamically: an effective energy density built as a FREE ENERGY, u_eff = elastic − T·s,
// where a steep entropy surface (the s term, scaled by an effective temperature T) drives the
// effective density negative in a bounded region — no exotic matter posited, a free-energy
// balance instead.
//
// ⚑ THIS IS A PLACEHOLDER / REFRAMING MODEL, clearly labelled. It does NOT compute a
// stress-energy tensor and it does NOT claim the reframing is physically valid. It computes a
// concrete, honest free-energy field so the ARCHITECTURE can be wired and its behaviour seen:
// given a field profile and an effective temperature, where does u_eff go negative, and how
// much of the surface does that region cover? GARY'S SPEC swaps in the real entropy functional.
//
// Pure and total; Number.isFinite guards, one condition per line.

const isFin = (v) => Number.isFinite(v);

// Discrete spatial gradient of a 1D field: central differences inside, one-sided at the ends.
export function gradient(field) {
  if (!Array.isArray(field)) return { ok: false, why: 'field must be an array' };
  if (field.length < 2) return { ok: false, why: 'field needs at least 2 samples for a gradient' };
  if (!field.every(isFin)) return { ok: false, why: 'every field sample must be a finite number' };
  const n = field.length;
  const g = new Array(n);
  g[0] = field[1] - field[0];
  g[n - 1] = field[n - 1] - field[n - 2];
  for (let i = 1; i < n - 1; i++) g[i] = (field[i + 1] - field[i - 1]) / 2;
  return { ok: true, gradient: g };
}

// Effective energy density as a free energy: u_eff = ½(∇φ)² − T·|∇φ|. The elastic term is the
// gradient energy; the entropy-surface term (here |∇φ|, the surface measure, scaled by the
// effective temperature T) can pull u_eff below zero. For a point with gradient g ≠ 0,
// u_eff < 0 exactly when |g| < 2T — a bounded "negative" band, not a runaway.
export function effectiveDensity(field, temperature) {
  if (!isFin(temperature)) return { ok: false, why: 'temperature must be a finite number' };
  if (temperature < 0) return { ok: false, why: 'temperature cannot be negative' };
  const gr = gradient(field);
  if (!gr.ok) return { ok: false, why: gr.why };
  const density = gr.gradient.map((g) => {
    const elastic = 0.5 * g * g;
    const entropy = Math.abs(g);
    return elastic - temperature * entropy;
  });
  return { ok: true, density };
}

// Where does the effective density go negative, and over what fraction of the surface?
export function negativeRegion(density) {
  if (!Array.isArray(density)) return { ok: false, why: 'density must be an array' };
  if (density.length === 0) return { ok: false, why: 'density must be non-empty' };
  if (!density.every(isFin)) return { ok: false, why: 'every density sample must be a finite number' };
  // forEach, not a for(;i<len;) loop — a bounded loop's `<` has an equivalent `<=` mutant
  // (the extra pass reads density[len] = undefined, and `undefined < 0` is false → a no-op).
  const indices = [];
  density.forEach((v, i) => { if (v < 0) indices.push(i); });
  return { ok: true, indices, fraction: indices.length / density.length, min: Math.min(...density) };
}
