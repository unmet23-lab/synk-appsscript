#!/usr/bin/env node
// SYNK_RELEASE_POLICY on one talk project, checked with talk's own parser before it is set.
// Rehearsal opens learning storage and account recovery to SYNK account clients 0.2.0+; production
// opens learning storage only (account recovery has no user yet). AI coaching is written out as it is
// today, because a feature missing from the policy is switched off. Shows the decision per feature
// first; sets it only with --적용 (production also needs --운영). The policy is not a secret.
// After setting it, restart synk-account, synk-learning and release-policy (talk tools/원격배포.js).
'use strict';
const path = require('node:path');
const { target, management, projectName, TALK_ROOT } = require('./lib.js');
const release = require(path.join(TALK_ROOT, 'lib', 'release-policy.js'));

const t = target();
const POLICY = {
  version: 1,
  revision: t.production ? 'account-learning-on-20261003' : 'account-learning-rehearsal-20261002',
  features: {
    accountRecovery: { enabled: !t.production, percent: t.production ? 0 : 100, minContract: 1, minAppVersion: '0.2.0' },
    learningSync: { enabled: true, percent: 100, minContract: 1, minAppVersion: '0.2.0' },
    aiCoaching: { enabled: true, percent: 100, minContract: 16 },
  },
};
const parsed = release.parsePolicy(JSON.stringify(POLICY)), today = release.parsePolicy(null);
const decide = (policy, feature, appVersion) => release.featureDecision(policy, { feature, subject: 'check-subject', appVersion,
  contract: policy.features[feature].contractFamily === 'account' ? '1' : 'c16' }).reason;
console.log(`${t.name} policy ${parsed.revision}`);
for (const feature of release.FEATURES) console.log(`  ${feature}: app 0.2.0 → ${decide(parsed, feature, '0.2.0')} (no policy: ${decide(today, feature, '0.2.0')}), app 0.1.9 → ${decide(parsed, feature, '0.1.9')}`);
if (!t.apply) { console.log('(not set; add --적용)'); process.exit(0); }
(async () => {
  console.log(`target ▸ ${await projectName(t.ref)} (${t.ref})`);
  const res = await management(t.ref, '/secrets', { method: 'POST', body: JSON.stringify([{ name: 'SYNK_RELEASE_POLICY', value: JSON.stringify(POLICY) }]) });
  console.log('set SYNK_RELEASE_POLICY: HTTP', res.status);
  process.exitCode = res.ok ? 0 : 1;
})().catch(e => { console.error(String(e.message || e)); process.exitCode = 1; });
