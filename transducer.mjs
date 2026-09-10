// transducer.mjs — the quasicrystal as SCALE-BRIDGE / transducer (not the main event).
//
// Gary/Nexus architecture, subsystem 5, and the correction to our first spec. Two things
// that first pass got wrong, fixed here:
//
//   1. The Fibonacci substitution chain (L -> LS) is a 1D teaching toy, NOT the mechanism.
//      The real construction of a quasicrystal is CUT-AND-PROJECT: take a periodic lattice in
//      a higher dimension, keep the points that fall in a strip of IRRATIONAL slope, and
//      project them down. cutAndProject() below does exactly that. The slope is a PARAMETER
//      (it sets the symmetry class); it is not wired to the golden mean.
//   2. The quasicrystal is not the centrepiece — it is a TRANSDUCER. Aperiodic order gives a
//      dense set of structure-factor peaks (many spatial frequencies couple at once) rather
//      than the single Bragg peak of a periodic lattice. That BROADBAND coupling is what lets
//      it bridge between two scales/frequencies instead of resonating at one — its whole job
//      in the architecture.
//
// REAL here: the cut-and-project construction and the structure factor are standard solid-state
// physics. GARY'S HYPOTHESIS: that this element transduces between the molecular scale
// (subsystem 6) and the field scale (subsystems 1-2). The bench tests the coupling is broadband.
//
// Pure and total; Number.isFinite guards, one condition per line.

const isFin = (v) => Number.isFinite(v);

// 1D cut-and-project, in its closed (Sturmian/Beatty) form — the same model set the strip
// projection produces, computed directly and deterministically. The Sturmian word
// s_k = floor((k+1)α) − floor(kα) ∈ {0,1} (α = slope/(1+slope), irrational when the slope is)
// selects between two gap lengths, a long L = windowWidth and a short S = α·windowWidth. The
// result is a genuine 1D quasicrystal: exactly two gaps, arranged aperiodically, with the
// gap ratio fixed by the slope. This is the mechanism; the Fibonacci SUBSTITUTION string was
// only the 1D teaching toy.
export function cutAndProject(count, slope, windowWidth) {
  if (!Number.isInteger(count)) return { ok: false, why: 'count must be an integer' };
  if (count < 1) return { ok: false, why: 'count must be at least 1' };
  if (!isFin(slope)) return { ok: false, why: 'slope must be a finite number' };
  if (!(slope > 0)) return { ok: false, why: 'slope must be positive' };
  if (!isFin(windowWidth)) return { ok: false, why: 'windowWidth must be a finite number' };
  if (!(windowWidth > 0)) return { ok: false, why: 'windowWidth must be positive' };
  const alpha = slope / (1 + slope);         // irrational density in (0,1)
  const L = windowWidth;
  const S = alpha * windowWidth;
  const sites = [0];
  let pos = 0;
  for (let k = 0; k < count - 1; k++) {
    const long = (Math.floor((k + 1) * alpha) - Math.floor(k * alpha)) > 0;   // Sturmian bit
    pos += long ? L : S;
    sites.push(pos);
  }
  return { ok: true, sites };
}

// Aperiodicity test: the sequence of GAPS between consecutive sites has no periodic repeat.
// For each candidate period p (1..floor(k/2)) check whether gaps[i] == gaps[i+p] for all i;
// if some p makes the gap sequence repeat, it is periodic. Aperiodic = no such p.
export function isAperiodic(sites, tol) {
  if (!Array.isArray(sites)) return { ok: false, why: 'sites must be an array' };
  if (sites.length < 4) return { ok: false, why: 'need at least 4 sites to see a repeat' };
  if (!sites.every(isFin)) return { ok: false, why: 'every site must be a finite number' };
  if (!isFin(tol)) return { ok: false, why: 'tol must be a finite number' };
  if (!(tol > 0)) return { ok: false, why: 'tol must be positive' };
  const gaps = [];
  for (let i = 1; i < sites.length; i++) gaps.push(sites[i] - sites[i - 1]);
  const distinct = [];
  for (const g of gaps) {
    if (!distinct.some((d) => Math.abs(d - g) <= tol)) distinct.push(g);
  }
  let periodic = false;
  for (let p = 1; p <= Math.floor(gaps.length / 2); p++) {
    let repeats = true;
    for (let i = 0; i + p < gaps.length; i++) {
      if (Math.abs(gaps[i] - gaps[i + p]) > tol) { repeats = false; break; }
    }
    if (repeats) { periodic = true; break; }
  }
  return { ok: true, aperiodic: !periodic, distinctGaps: distinct.length };
}

// Structure-factor magnitude at one spatial frequency f: |(1/N) Σ exp(2πi f x_j)|, in [0,1].
// A periodic lattice peaks at integer f (a single Bragg line); an aperiodic set spreads its
// peaks across many f — the broadband signature that makes it a transducer.
export function structureFactor(sites, f) {
  if (!Array.isArray(sites)) return { ok: false, why: 'sites must be an array' };
  if (sites.length === 0) return { ok: false, why: 'sites must be non-empty' };
  if (!sites.every(isFin)) return { ok: false, why: 'every site must be a finite number' };
  if (!isFin(f)) return { ok: false, why: 'f must be a finite number' };
  let re = 0;
  let im = 0;
  for (const x of sites) {
    const ph = 2 * Math.PI * f * x;
    re += Math.cos(ph);
    im += Math.sin(ph);
  }
  const mag = Math.sqrt(re * re + im * im) / sites.length;
  return { ok: true, magnitude: mag };
}

// Coupling bandwidth: over a frequency grid, the FRACTION of frequencies whose structure
// factor exceeds `threshold`. Broadband (many coupled frequencies) => a good transducer.
export function couplingBandwidth(sites, freqs, threshold) {
  if (!Array.isArray(sites)) return { ok: false, why: 'sites must be an array' };
  if (sites.length === 0) return { ok: false, why: 'sites must be non-empty' };
  if (!Array.isArray(freqs)) return { ok: false, why: 'freqs must be an array' };
  if (freqs.length === 0) return { ok: false, why: 'freqs must be non-empty' };
  if (!isFin(threshold)) return { ok: false, why: 'threshold must be a finite number' };
  if (threshold < 0) return { ok: false, why: 'threshold must be non-negative' };
  let above = 0;
  for (const f of freqs) {
    const sf = structureFactor(sites, f);
    if (!sf.ok) return { ok: false, why: sf.why };
    if (sf.magnitude >= threshold) above++;
  }
  return { ok: true, fraction: above / freqs.length, coupled: above, total: freqs.length };
}
