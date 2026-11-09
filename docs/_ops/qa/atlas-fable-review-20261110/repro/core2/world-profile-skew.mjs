const __ROOT = (() => { let p = decodeURIComponent(new URL('../../../../../..', import.meta.url).pathname); if (p.endsWith('/')) p = p.slice(0, -1); return p.charAt(2) === ':' ? p.slice(1) : p; })();
// Repro: WORLD learning settings saved on device A (clock 2 min fast) cannot be changed on device B (accurate clock).
import { pathToFileURL } from 'node:url';
const W = await import(pathToFileURL((__ROOT + '/experiences/synk-world-app/world-learning-profile.mjs')).href);
const owner = 'acct-1', real = Date.parse('2026-12-01T03:00:00.000Z');
// device A: clock +120s. First save.
let stored = W.updateWorldLearningProfile(null, { owner, at: real + 120000, consent: true, expectedRevision: 0, values: { reasons: ['exam'], primaryReason: 'exam', support: 'step' } });
console.log('A saved, updatedAt', stored.profile.updatedAt, 'rev', stored.profile.revision);
// the record syncs to device B (accurate clock), 30 real seconds later the learner changes a setting there
try {
  const read = W.readWorldLearningProfile(stored, { owner, at: real + 30000 });
  console.log('B read ok, rev', read.profile.revision);
  stored = W.updateWorldLearningProfile(stored, { owner, at: real + 30000, expectedRevision: read.profile.revision, values: { support: 'independent' } });
  console.log('B saved');
} catch (e) { console.log('B save throws:', e.constructor.name, '|', e.code ?? '(no code)', '|', e.message); }
// same device, clock corrected backwards by 5 minutes (NTP / manual fix)
try { W.updateWorldLearningProfile(stored, { owner, at: real - 180000, expectedRevision: 1, values: { explanation: 'brief' } }); console.log('rollback saved'); }
catch (e) { console.log('after clock fix throws:', e.code ?? '(no code)', '|', e.message); }
