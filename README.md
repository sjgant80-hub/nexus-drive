# Nexus Drive — a coupled-architecture bench

**Live: https://sjgant80-hub.github.io/nexus-drive/**

Gary Floyd's / Nexus propulsion architecture, built and interfaced as seven mutation-tested
modules. Press run on the live page: the bench reports whether the coupled architecture
**closes** — every subsystem internally coherent and every interface between them satisfied.

> **Architecture: Gary Floyd / Nexus. Modeling & gate: the estate.** This is a test of the
> architecture's *coherence*, not a claim that the exotic physics is real. If the coupled
> system does not even close, that is a finding before any lab spend. If it does, whether the
> physics is real is Gary's question — and the gap list says exactly where his equations
> replace our placeholders.

## The six subsystems + the bus

| # | subsystem | module | real vs. hypothesis |
|---|-----------|--------|---------------------|
| 1 | Distributed ERPC-Chua boundary control (the horizon-problem loop) | `boundary_control.mjs` | Chua dynamics + control law **real**; warp-bubble application is Gary's hypothesis |
| 2 | Entropy-surface energy density (negative density reframed) | `entropy_surface.mjs` | **placeholder** free-energy reframing — not a stress-energy tensor |
| 3 | Dual-nacelle differential steering | `nacelle_steering.mjs` | differential-drive kinematics **real** |
| 4 | Plasma → catalyzed fusion → nacelle power chain | `power_chain.mjs` | energy balance **real**; achievable fusion gain not claimed |
| 5 | Quasicrystal transducer / scale-bridge | `transducer.mjs` | cut-and-project + structure factor **real**; scale-transduction role is Gary's hypothesis |
| 6 | Barrier-reshaping molecular replication | `replication.mjs` | Arrhenius kinetics **real**; **placeholder** reshaping coupling |
| — | The interface layer (wires all six, runs the coupled system) | `bus.mjs` | reports `closes` + `openPorts` + the gap list |

## The interface (Gary's actual ask)

```
power_chain ──delivered──▶ scales(vs demand) ──▶ nacelle_steering (thrust + yaw)
entropy_surface ──neg-region depth──▶ transducer (scale bridge) ──▶ replication.reshape(barrier)
boundary_control ──held?──▶ (the horizon-problem loop stands or falls on its own)
```

The transducer is the **scale bridge**: if it fails, the field-scale entropy surface can no
longer reach the molecular-scale replication barrier, and replication opens too. The live
page lets you break an interface and watch that cascade.

## Correction carried from the first pass

- The Fibonacci **substitution** chain (L→LS) is a 1D teaching toy, **not the mechanism**.
  Real quasicrystals are built by **cut-and-project** — which is what `transducer.mjs` uses,
  with the slope as a free parameter (not wired to the golden mean).
- The quasicrystal is a **transducer / scale-bridge**, not the centrepiece.

## The gap list — where Gary's equations go

- `boundary_control.localControl` — a proportional consensus placeholder stands in for the **ERPC law**.
- `entropy_surface.effectiveDensity` — a free-energy reframing stands in for Gary's **entropy functional**.
- `replication.reshape` — a linear barrier-lowering stands in for Gary's **landscape functional**.

Each port keeps its signature, so dropping in the real equations changes nothing downstream.

## Proof

Every module carries its own mutation gate, CLEAN, re-run in CI on every push:

```
node --test           # all module tests
node tools/gate-all.mjs   # every module mutation-CLEAN (survivors killed or argued-equivalent in a baseline)
```

- `boundary_control` 25/25 · `nacelle_steering` 7/8 (+1 argued) · `power_chain` 8/8 ·
  `transducer` 19/20 (+1 argued) · `entropy_surface` 10/10 · `replication` 9/9 · `bus` 19/19.
- Two survivors are baselined with an argued reason (reviewed-equivalent mutants, not test-theatre);
  see `*.baseline.json`.
- `index.html` inlines the seven gated modules verbatim (`make-page.mjs`); CI regenerates and
  `git diff --exit-code`s the page, so the live demo cannot drift from the gated code.

MIT.
