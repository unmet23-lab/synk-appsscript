const __ROOT = require('node:path').resolve(__dirname, '../../../../../..').split(require('node:path').sep).join('/');
// Domain: an expired declaration hides newer, agreeing observed evidence; a required criterion then blocks every candidate.
const D = require((__ROOT + '/atlas/domain.js'));
const contract = { id: 'c', version: '1', purpose: 'p', fields: [{ id: 'food', kind: 'enum', values: ['local', 'fine'], maxAgeDays: 30 }],
  criteria: [{ id: 'food.fit', field: 'food', feature: 'food', weight: 1, required: true }] };
const scope = { domain: 'PATH', workspace: 'w', subject: 's' }, ref = { id: 'c', version: '1', purpose: 'p' };
const obs = (id, source, value, at, extra = {}) => ({ id, scope, contract: ref, field: 'food', value, source, at, ...extra });
const observations = [
  obs('d1', 'declared', 'local', '2026-09-01T00:00:00.000Z'),                                   // 40+ days old -> expired
  obs('o1', 'observed', 'fine', '2026-10-20T00:00:00.000Z', { independentKey: 'visit1' }),
  obs('o2', 'observed', 'fine', '2026-10-25T00:00:00.000Z', { independentKey: 'visit2' }),
  obs('o3', 'observed', 'fine', '2026-10-28T00:00:00.000Z', { independentKey: 'visit3' }),
];
const at = '2026-11-01T00:00:00.000Z';
const u = D.understand({ contract, scope, observations, at }).fields[0];
console.log('with expired declaration ->', { status: u.status, usable: u.usable, value: u.value, independent: u.independent });
const u2 = D.understand({ contract, scope, observations: observations.slice(1), at }).fields[0];
console.log('same observations, no declaration ->', { status: u2.status, usable: u2.usable, value: u2.value, independent: u2.independent });
const r = D.decide({ contract, scope, observations, at, candidates: [{ id: 'a', features: { food: 'fine' } }, { id: 'b', features: { food: 'local' } }] });
console.log('decide ->', r.status, JSON.stringify(r.excluded));
