// PATH 공개 미디어 버킷의 월 한도 자동 차단(Cloud Functions 2세대, Pub/Sub 예산 알림으로 깨어난다).
//
// Google Cloud 예산은 알림만 보낸다. 그래서 예산 알림이 오면 이번 달 비용(costAmount)과 한도(budgetAmount)를 보고
// - 한도 이상이면 라벨 budget-capped=yes를 먼저 달고 버킷의 allUsers 읽기를 빼서 공개 전송을 멈춘다.
// - 한도 아래인데 이 함수가 닫아 둔 버킷이면(새 달 · 한도 올림) allUsers를 먼저 돌려놓고 라벨을 뗀다.
//   이 순서라야 중간에 실패해 같은 알림이 다시 와도 끝까지 간다. 라벨 없이 닫힌 버킷(손으로 닫은 것)은 열지 않는다.
// - 지난 결제 기간의 알림과, 마지막으로 상태를 바꾼 알림보다 먼저 보낸 알림(재시도·순서 뒤바뀜)은 무시한다.
// 버킷이 닫히면 면접실은 synk.im에 함께 둔 영상·모델로 받는다(페이지가 시작 때 버킷을 확인한다).
// 배포: node tools/path-media-cap/deploy.mjs
const functions = require('@google-cloud/functions-framework');

const BUCKET = process.env.BUCKET || 'synk-path-media';
const API = `https://storage.googleapis.com/storage/v1/b/${BUCKET}`;

async function token() {
  const response = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', { headers: { 'Metadata-Flavor': 'Google' } });
  if (!response.ok) throw new Error('metadata token ' + response.status);
  return (await response.json()).access_token;
}

async function gcs(method, suffix, body) {
  const response = await fetch(API + suffix, { method, headers: { Authorization: `Bearer ${await token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${suffix || '/'} ${response.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

// 결제 기간(달)은 미국 태평양 시간 자정에 시작한다(1일 07:00 또는 08:00 UTC). 서머타임까지 맞추려고 태평양 시간의 달로 비교한다.
const PACIFIC = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric' });
function pacificMonth(ms) {
  const parts = Object.fromEntries(PACIFIC.formatToParts(ms).map((part) => [part.type, part.value]));
  return Number(parts.year) * 12 + Number(parts.month);
}

functions.cloudEvent('cap', async (event) => {
  const text = Buffer.from(event?.data?.message?.data || '', 'base64').toString('utf8');
  let note;
  try { note = JSON.parse(text); } catch { console.log(JSON.stringify({ action: 'ignored', reason: 'not json' })); return; }
  const cost = Number(note.costAmount), budget = Number(note.budgetAmount);
  if (!Number.isFinite(cost) || !Number.isFinite(budget) || budget <= 0) { console.log(JSON.stringify({ action: 'ignored', reason: 'no cost or budget' })); return; }
  const detail = { cost, budget, currency: note.currencyCode || null, periodStart: note.costIntervalStart || null };
  const periodStart = Date.parse(note.costIntervalStart);
  if (Number.isFinite(periodStart) && pacificMonth(periodStart) < pacificMonth(Date.now())) { console.log(JSON.stringify({ action: 'ignored', reason: 'previous period', ...detail })); return; }
  const sentAt = Date.parse(event?.data?.message?.publishTime || event?.time || '');
  const policy = await gcs('GET', '/iam?optionsRequestedPolicyVersion=3');
  const bindings = policy.bindings || [];
  const viewer = bindings.find((binding) => binding.role === 'roles/storage.objectViewer' && !binding.condition);
  const isPublic = Boolean(viewer?.members?.includes('allUsers'));
  const labels = (await gcs('GET', '?fields=labels')).labels || {};
  const capped = labels['budget-capped'] === 'yes';
  if (Number.isFinite(sentAt) && sentAt < (Number(labels['budget-acted-at']) || 0)) { console.log(JSON.stringify({ action: 'ignored', reason: 'older than the last change', ...detail })); return; }
  const acted = String(Number.isFinite(sentAt) ? sentAt : Date.now());
  if (cost >= budget && isPublic) {
    await gcs('PATCH', '?fields=labels', { labels: { 'budget-capped': 'yes', 'budget-acted-at': acted } });
    // A label change moves the bucket metageneration and with it the IAM etag (PUT would answer 412), so read it again.
    const fresh = await gcs('GET', '/iam?optionsRequestedPolicyVersion=3');
    const remaining = (fresh.bindings || [])
      .map((binding) => binding.role === 'roles/storage.objectViewer' && !binding.condition ? { ...binding, members: binding.members.filter((member) => member !== 'allUsers') } : binding)
      .filter((binding) => binding.members?.length);
    await gcs('PUT', '/iam', { ...fresh, bindings: remaining });
    console.log(JSON.stringify({ action: 'closed', ...detail }));
  } else if (cost < budget && !isPublic && capped) {
    if (viewer) viewer.members.push('allUsers'); else bindings.push({ role: 'roles/storage.objectViewer', members: ['allUsers'] });
    await gcs('PUT', '/iam', { ...policy, bindings });
    await gcs('PATCH', '?fields=labels', { labels: { 'budget-capped': null, 'budget-acted-at': acted } });
    console.log(JSON.stringify({ action: 'reopened', ...detail }));
  } else if (cost < budget && isPublic && capped) {
    // 다시 열고 라벨을 떼기 전에 멈췄던 경우: 남은 라벨만 정리한다.
    await gcs('PATCH', '?fields=labels', { labels: { 'budget-capped': null, 'budget-acted-at': acted } });
    console.log(JSON.stringify({ action: 'label-cleared', ...detail }));
  } else {
    console.log(JSON.stringify({ action: 'none', public: isPublic, capped, ...detail }));
  }
});
