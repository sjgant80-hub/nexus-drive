#!/usr/bin/env node
// gate-all.mjs — run the mutation gate over every module and require CLEAN. CI calls this.
import { execFileSync } from 'node:child_process';

const MODULES = [
  { src: 'boundary_control.mjs', test: 'boundary_control.test.mjs', timeout: 60000, cap: 200 },
  { src: 'nacelle_steering.mjs', test: 'nacelle_steering.test.mjs', timeout: 45000, cap: 160, baseline: 'nacelle_steering.baseline.json' },
  { src: 'power_chain.mjs', test: 'power_chain.test.mjs', timeout: 45000, cap: 160 },
  { src: 'transducer.mjs', test: 'transducer.test.mjs', timeout: 60000, cap: 220, baseline: 'transducer.baseline.json' },
  { src: 'entropy_surface.mjs', test: 'entropy_surface.test.mjs', timeout: 45000, cap: 180 },
  { src: 'replication.mjs', test: 'replication.test.mjs', timeout: 45000, cap: 180 },
  { src: 'bus.mjs', test: 'bus.test.mjs', timeout: 90000, cap: 300 },
];

let failed = false;
for (const m of MODULES) {
  const args = ['tools/witness.mjs', 'mutate', m.src, '--timeout', String(m.timeout), '--cap', String(m.cap)];
  if (m.baseline) args.push('--baseline', m.baseline);
  args.push('--test', 'node', '--test', m.test);
  let out = '';
  try { out = execFileSync('node', args, { encoding: 'utf8', maxBuffer: 1 << 26 }); }
  catch (e) { out = ((e.stdout || '') + (e.stderr || '')).toString(); }
  let verdict;
  try { verdict = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)); }
  catch { verdict = { clean: false, reason: 'could not parse gate output' }; }
  const ok = verdict.clean === true;
  console.log((ok ? 'CLEAN ' : 'DIRTY ') + m.src + ' — ' + (verdict.killed || 0) + '/' + (verdict.total || 0) +
    (verdict.ignored && verdict.ignored.length ? ' (+' + verdict.ignored.length + ' argued)' : '') +
    (ok ? '' : ' :: ' + (verdict.reason || 'survivors: ' + JSON.stringify((verdict.survived || []).map((s) => s.line)))));
  if (!ok) failed = true;
}
if (failed) { console.error('\nGATE FAILED — a module is not clean.'); process.exit(1); }
console.log('\nALL MODULES CLEAN.');
