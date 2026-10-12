#!/usr/bin/env node
// PATH 공개 미디어의 월 한도와 자동 차단을 세운다(여러 번 돌려도 같다).
//   예산: 결제 계정 01864D-0E650C-40F3CB의 synk-path-media 프로젝트 전체 비용(크레딧 빼기 전), 매달, 한도 KRW 10,000.
//         50%·90%·100%(실제)와 100%(예상)에 결제 관리자 메일 + Pub/Sub 토픽 path-media-budget.
//   차단: 그 토픽으로 깨는 Cloud Functions 2세대 path-media-cap(index.js). 한도 이상이면 버킷 공개를 닫고, 새 달에 다시 연다.
// 사용: node tools/path-media-cap/deploy.mjs [--amount 10000]
// 토큰은 tools/모델정책.js가 붙인 unmet27 계정을 쓰고 출력하지 않는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const policy = require(path.join(ROOT, 'tools/모델정책.js'));
const PROJECT = 'synk-path-media', REGION = 'asia-northeast3', BUCKET = 'synk-path-media', BILLING = '01864D-0E650C-40F3CB';
const TOPIC = `projects/${PROJECT}/topics/path-media-budget`, FUNCTION = 'path-media-cap';
const amountIndex = process.argv.indexOf('--amount');
const AMOUNT = amountIndex > 0 ? String(Number(process.argv[amountIndex + 1])) : '10000';
const RUNTIME_SA = `path-media-cap@${PROJECT}.iam.gserviceaccount.com`, BUILD_SA = `path-media-build@${PROJECT}.iam.gserviceaccount.com`;

async function call(method, url, body, headers = {}) {
  const binary = body instanceof Uint8Array;
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${await policy.벌텍스토큰()}`, 'x-goog-user-project': PROJECT, ...(body && !binary ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: binary ? body : body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 300) }; }
  return { status: response.status, json };
}
const must = (r, what) => { if (r.status < 200 || r.status >= 300) throw new Error(`${what} ${r.status}: ${JSON.stringify(r.json).slice(0, 400)}`); return r.json; };
async function wait(url, limitMs = 900000) {
  const until = Date.now() + limitMs;
  for (;;) {
    const r = must(await call('GET', url), 'operation');
    if (r.done) { if (r.error) throw new Error('operation failed: ' + JSON.stringify(r.error).slice(0, 600)); return r; }
    if (Date.now() > until) throw new Error('operation timeout ' + url);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
async function ensureServiceAccount(email, displayName) {
  const id = email.split('@')[0];
  const got = await call('GET', `https://iam.googleapis.com/v1/projects/${PROJECT}/serviceAccounts/${email}`);
  if (got.status === 200) return;
  must(await call('POST', `https://iam.googleapis.com/v1/projects/${PROJECT}/serviceAccounts`, { accountId: id, serviceAccount: { displayName } }), 'create service account');
  console.log('created service account', email);
  await new Promise((resolve) => setTimeout(resolve, 8000)); // 새 계정이 IAM에 퍼지는 동안
}
// kind: project(이 프로젝트) · bucket(버킷) · run(Cloud Run 서비스). API마다 읽기·쓰기 모양이 다르다.
const IAM = {
  project: (id) => ({ get: ['POST', `https://cloudresourcemanager.googleapis.com/v1/projects/${id}:getIamPolicy`, { options: { requestedPolicyVersion: 3 } }], set: (policy) => ['POST', `https://cloudresourcemanager.googleapis.com/v1/projects/${id}:setIamPolicy`, { policy }] }),
  bucket: (id) => ({ get: ['GET', `https://storage.googleapis.com/storage/v1/b/${id}/iam?optionsRequestedPolicyVersion=3`], set: (policy) => ['PUT', `https://storage.googleapis.com/storage/v1/b/${id}/iam`, policy] }),
  run: (id) => ({ get: ['GET', `https://run.googleapis.com/v2/${id}:getIamPolicy`], set: (policy) => ['POST', `https://run.googleapis.com/v2/${id}:setIamPolicy`, { policy }] }),
};
async function changeBinding(kind, id, role, member, present = true) {
  const api = IAM[kind](id);
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = must(await call(...api.get), `get iam ${kind}`);
    let bindings = current.bindings || [];
    const binding = bindings.find((b) => b.role === role && !b.condition);
    if (Boolean(binding?.members?.includes(member)) === present) return;
    if (!present) { binding.members = binding.members.filter((m) => m !== member); bindings = bindings.filter((b) => b.members.length); }
    else if (binding) binding.members.push(member); else bindings.push({ role, members: [member] });
    const set = await call(...api.set({ ...current, bindings }));
    if (set.status === 200) { console.log(present ? 'granted' : 'removed', role, 'on', kind); return; }
    if (set.status !== 409 && set.status !== 400 && set.status !== 412) throw new Error(`set iam ${kind} ${set.status}: ${JSON.stringify(set.json).slice(0, 300)}`);
    await new Promise((resolve) => setTimeout(resolve, 8000)); // 새 계정이 아직 안 보이거나 동시 변경(etag)
  }
  throw new Error(`set iam retries exhausted for ${role} on ${kind}`);
}
const addBinding = (kind, id, role, member) => changeBinding(kind, id, role, member, true);
// 차단 함수에 필요한 것: 버킷 읽기(라벨)·수정(라벨)·IAM 읽기·쓰기. 객체나 버킷을 지울 권한은 주지 않는다.
const CAP_ROLE_ID = 'pathMediaCap', CAP_ROLE = `projects/${PROJECT}/roles/${CAP_ROLE_ID}`;
const CAP_PERMISSIONS = ['storage.buckets.get', 'storage.buckets.getIamPolicy', 'storage.buckets.setIamPolicy', 'storage.buckets.update'];
async function ensureCapRole() {
  const role = { title: 'PATH media budget cap', description: 'Read and change only the PATH media bucket labels and IAM policy.', includedPermissions: CAP_PERMISSIONS, stage: 'GA' };
  const got = await call('GET', `https://iam.googleapis.com/v1/${CAP_ROLE}`);
  if (got.status === 404) { must(await call('POST', `https://iam.googleapis.com/v1/projects/${PROJECT}/roles`, { roleId: CAP_ROLE_ID, role }), 'create role'); console.log('created role', CAP_ROLE); return; }
  const current = must(got, 'read role');
  if (current.deleted) must(await call('POST', `https://iam.googleapis.com/v1/${CAP_ROLE}:undelete`, { etag: current.etag }), 'undelete role');
  if ([...(current.includedPermissions || [])].sort().join() !== CAP_PERMISSIONS.join()) {
    must(await call('PATCH', `https://iam.googleapis.com/v1/${CAP_ROLE}?updateMask=includedPermissions,title,description`, { ...role, etag: current.etag }), 'update role');
    console.log('updated role', CAP_ROLE);
  }
}

// 1. 서비스 계정: 함수 실행·트리거용, 빌드용
await ensureServiceAccount(RUNTIME_SA, 'PATH media budget cap');
await ensureServiceAccount(BUILD_SA, 'PATH media cap build');
// 2. 빌드 계정 권한(이 전용 프로젝트 안에서만)
for (const role of ['roles/cloudbuild.builds.builder', 'roles/logging.logWriter', 'roles/artifactregistry.writer', 'roles/storage.objectViewer'])
  await addBinding('project', PROJECT, role, `serviceAccount:${BUILD_SA}`);
// 3. 차단 함수는 이 버킷의 공개 설정·라벨만 바꾼다(사용자 역할 pathMediaCap). 처음 배포 때 준 storage.admin은 걷는다.
//    트리거로 이벤트를 받는 권한은 이 프로젝트 안에서만.
await ensureCapRole();
await addBinding('bucket', BUCKET, CAP_ROLE, `serviceAccount:${RUNTIME_SA}`);
await changeBinding('bucket', BUCKET, 'roles/storage.admin', `serviceAccount:${RUNTIME_SA}`, false);
await addBinding('project', PROJECT, 'roles/eventarc.eventReceiver', `serviceAccount:${RUNTIME_SA}`);
// 4. 예산 알림 토픽
const topic = await call('GET', `https://pubsub.googleapis.com/v1/${TOPIC}`);
if (topic.status === 404) { must(await call('PUT', `https://pubsub.googleapis.com/v1/${TOPIC}`, {}), 'create topic'); console.log('created topic', TOPIC); }
// 5. 함수 원본 묶기·올리기·배포
const zip = path.join(os.tmpdir(), `path-media-cap-${process.pid}.zip`);
execFileSync('python', ['-c', 'import sys,zipfile\nz=zipfile.ZipFile(sys.argv[1],"w",zipfile.ZIP_DEFLATED)\nfor n in ("index.js","package.json"): z.write(sys.argv[2]+"/"+n, n)\nz.close()', zip, HERE]);
const upload = must(await call('POST', `https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/functions:generateUploadUrl`, {}), 'upload url');
const put = await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/zip' }, body: fs.readFileSync(zip) });
if (!put.ok) throw new Error('source upload ' + put.status);
fs.unlinkSync(zip);
const spec = {
  description: 'PATH media bucket budget cap: closes public access when the monthly budget is exceeded, reopens it in the next period.',
  buildConfig: { runtime: 'nodejs22', entryPoint: 'cap', source: { storageSource: upload.storageSource }, serviceAccount: `projects/${PROJECT}/serviceAccounts/${BUILD_SA}` },
  serviceConfig: { maxInstanceCount: 1, availableMemory: '256M', timeoutSeconds: 60, serviceAccountEmail: RUNTIME_SA, environmentVariables: { BUCKET } },
  eventTrigger: { eventType: 'google.cloud.pubsub.topic.v1.messagePublished', pubsubTopic: TOPIC, retryPolicy: 'RETRY_POLICY_RETRY', serviceAccountEmail: RUNTIME_SA, triggerRegion: REGION },
};
const fnUrl = `https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/functions/${FUNCTION}`;
const exists = (await call('GET', fnUrl)).status === 200;
const op = exists
  ? must(await call('PATCH', `${fnUrl}?updateMask=buildConfig,serviceConfig,eventTrigger,description`, spec), 'update function')
  : must(await call('POST', `https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/functions?functionId=${FUNCTION}`, spec), 'create function');
console.log(exists ? 'updating function…' : 'creating function…');
await wait(`https://cloudfunctions.googleapis.com/v2/${op.name}`);
const fn = must(await call('GET', fnUrl), 'read function');
console.log('function', fn.state, fn.serviceConfig?.service);
// 6. 트리거 계정이 함수(Cloud Run 서비스)를 부를 수 있게
const service = fn.serviceConfig.service; // projects/…/locations/…/services/…
await addBinding('run', service, 'roles/run.invoker', `serviceAccount:${RUNTIME_SA}`);
// 7. 예산(이미 있으면 한도·규칙만 맞춘다)
const projectNumber = must(await call('GET', `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}`), 'project').projectNumber;
const budget = {
  displayName: 'PATH 공개 미디어 월 한도',
  budgetFilter: { projects: [`projects/${projectNumber}`], creditTypesTreatment: 'EXCLUDE_ALL_CREDITS', calendarPeriod: 'MONTH' },
  amount: { specifiedAmount: { currencyCode: 'KRW', units: AMOUNT } },
  thresholdRules: [{ thresholdPercent: 0.5 }, { thresholdPercent: 0.9 }, { thresholdPercent: 1.0 }, { thresholdPercent: 1.0, spendBasis: 'FORECASTED_SPEND' }],
  notificationsRule: { pubsubTopic: TOPIC, schemaVersion: '1.0', disableDefaultIamRecipients: false },
};
const list = must(await call('GET', `https://billingbudgets.googleapis.com/v1/billingAccounts/${BILLING}/budgets?pageSize=100`), 'list budgets');
const found = (list.budgets || []).find((b) => b.displayName === budget.displayName);
// The API refuses budgetFilter in an update (400), so an existing budget must already watch this project only.
if (found && (JSON.stringify(found.budgetFilter?.projects) !== JSON.stringify(budget.budgetFilter.projects) || found.budgetFilter?.creditTypesTreatment !== budget.budgetFilter.creditTypesTreatment || found.budgetFilter?.calendarPeriod !== budget.budgetFilter.calendarPeriod))
  throw new Error('existing budget watches something else; fix its filter in the console: ' + JSON.stringify(found.budgetFilter));
const saved = found
  ? must(await call('PATCH', `https://billingbudgets.googleapis.com/v1/${found.name}?updateMask=amount,thresholdRules,notificationsRule`, budget), 'update budget')
  : must(await call('POST', `https://billingbudgets.googleapis.com/v1/billingAccounts/${BILLING}/budgets`, budget), 'create budget');
console.log(JSON.stringify({ budget: saved.name, amount: saved.amount, topic: saved.notificationsRule?.pubsubTopic, function: fn.name, state: fn.state }));
