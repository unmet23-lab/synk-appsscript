// Puts the CI test keys (prefix ci/, no deleteFiles) into this repository's
// GitHub Actions secrets (STAGE1_DESIGN.md 4.11, approved 2026-11-12).
// Values go to `gh secret set` through stdin only; nothing is printed.
// The operator key and the measurement keys are never sent to Actions.
import { spawnSync } from 'node:child_process';
import * as store from './secret-store.mjs';

const REPO = 'unmet23-lab/synk-appsscript';
const bucket = store.get('bucket'); const w = store.get('keyCW'); const r = store.get('keyCR'); const seed = store.get('ciSeed', { json: false });
for (const k of [w, r]) if (k.capabilities.includes('deleteFiles') || k.namePrefix !== 'ci/') throw new Error('CI_KEY_SCOPE');
const values = {
  WORKBACKUP_CI_B2_ENDPOINT: bucket.s3ApiUrl, WORKBACKUP_CI_B2_REGION: bucket.region, WORKBACKUP_CI_B2_BUCKET: bucket.bucketName,
  WORKBACKUP_CI_B2_WRITE_KEY_ID: w.keyId, WORKBACKUP_CI_B2_WRITE_KEY: w.applicationKey,
  WORKBACKUP_CI_B2_READ_KEY_ID: r.keyId, WORKBACKUP_CI_B2_READ_KEY: r.applicationKey, WORKBACKUP_CI_SEED: seed,
};
for (const [name, value] of Object.entries(values)) {
  if (!value) throw new Error('CI_VALUE_MISSING:' + name);
  const res = spawnSync('gh', ['secret', 'set', name, '--repo', REPO], { input: value, encoding: 'utf8', windowsHide: true });
  console.log(name, res.status === 0 ? 'set' : `failed (${res.status})`);
  if (res.status !== 0) process.exitCode = 1;
}
