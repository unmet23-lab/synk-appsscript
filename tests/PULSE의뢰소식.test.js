'use strict';

// PULSE 의뢰 도구의 「소식」(운영 조각 4 · 설계 S1): 제작 세션은 작업 소식을 초안까지만 올린다 — 손님에게 올리기는 늘 사람이 직원 화면에서.
// 임시 폴더에 띄운 회사 서버(합성 의뢰 하나)에 대고 돈다. 운영 작업실 · 자격 보관소는 건드리지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 도구 = require('../tools/PULSE의뢰.js');
const { Workspace } = require('../tools/작업실예약.js');
const 회사 = path.join(__dirname, '..', 'docs', '마케팅', '온라인마케팅지도', 'engagement', 'company');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const ANSWERS = { name: '오미톡 오미자 스파클링', kind: 'food', channels: ['shorts'], package: 's15', audience: '운동 끝나고 목마른 20대', oneThing: '한 캔에 맛이 다섯 번 바뀐다', action: 'buy', screenText: '다섯 가지 맛, 톡.', avoid: [], win: 'story', refs: [], models: [], modelChoice: 'ask', date: '', dateFree: true, approver: 'one', contactName: '김합성', company: '합성 음료', email: 'buyer@pulse-synthetic.test', phone: '', consent: true, rights: true, slots: {} };

test('소식 인자: --글 · --단계 · --영어는 값 하나, --그림은 다음 칸 전까지 여럿, 모르는 칸은 멈춘다', () => {
  assert.deepEqual(도구.소식인자(['--글', '편집 중이에요', '--그림', 'a.png', 'b.jpg', '--단계', 'make', '--영어', 'Editing now.']), { 글: '편집 중이에요', 단계: 'make', 그림: ['a.png', 'b.jpg'], 영어: 'Editing now.' });
  assert.throws(() => 도구.소식인자(['--공개']), /모르는 칸/);
  assert.throws(() => 도구.소식인자(['--글']), /값을 적어/);
});

test('소식: 실제 회사 서버에 초안으로만 올리고(그림은 소식 전용), 손님에게 올리는 동작은 보내지 않는다', async (t) => {
  const { createCompanyApp } = await import(path.join(회사, 'server.mjs').replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'));
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-progress-tool-'));
  const app = createCompanyApp({ dataDir: path.join(방, 'server'), clientIntakeDir: path.join(방, 'inbox'), host: '127.0.0.1', port: 0, origin: 'http://127.0.0.1:0', allowTestHost: true, schedule: false, workNotificationsEnabled: false, webPushEnabled: false, synkIdentityConfig: null, synkCustomerIdentityConfig: null, pulseRequestFreeBytes: async () => 100 * 1024 ** 3 });
  const address = await app.start(), base = 'http://127.0.0.1:' + address.port;
  t.after(async () => { await app.stop(); fs.rmSync(방, { recursive: true, force: true }); });
  const admin = app.store.createUser({ name: '관리자', email: 'founder@pulse-synthetic.test', role: 'admin' });
  const token = app.store.mint('session', admin.id, { csrfToken: 'staff-csrf' }, 120);
  // 손님 의뢰 하나(공개 길).
  const jar = [];
  const call = async (p, body, csrf = '') => { const r = await fetch(base + p, { method: 'POST', headers: { Origin: app.origin, 'Content-Type': 'application/json', ...(jar.length ? { Cookie: jar.join('; ') } : {}), ...(csrf ? { 'X-Pulse-CSRF': csrf } : {}) }, body: JSON.stringify(body) }); for (const line of r.headers.getSetCookie?.() || []) jar.push(line.split(';')[0]); return r.json(); };
  const draft = (await call('/pulse/api/request/start', {})).draft;
  const sent = await call('/pulse/api/request/submit', { answers: ANSWERS }, draft.csrf);
  // 도구가 보내는 것을 모두 적는다.
  const 보낸 = [];
  const ws = new Workspace(app.origin, { base, fetchImpl: async (url, init = {}) => { 보낸.push({ url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: typeof init.body === 'string' ? init.body : '' }); return fetch(url, init); } });
  await ws.useSession(token);
  const 그림 = path.join(방, '편집중.png');fs.writeFileSync(그림, png);
  const r = await 도구.소식(ws, sent.number, { 글: '2번 컷을 편집하고 있어요.', 단계: 'make', 그림: [그림], 영어: '' });
  assert.equal(r.그림, 1);assert.ok(r.초안);
  const row = app.store.get('clientProjects', sent.projectId), item = row.studio.progress.at(-1);
  assert.equal(item.state, 'draft', '초안까지만');assert.equal(item.text, '2번 컷을 편집하고 있어요.');assert.equal(item.stage, 'make');
  assert.equal(row.studio.assets.find((asset) => asset.id === item.assets[0]).purpose, 'progress', '소식 전용 그림');
  const upload = 보낸.find((call) => call.url.endsWith('/studio/media'));
  assert.equal(upload.headers['x-studio-purpose'], 'progress');
  const actions = 보낸.filter((call) => call.url.endsWith('/studio') && call.method === 'POST').map((call) => JSON.parse(call.body).action);
  assert.deepEqual(actions, ['progress_save'], '손님에게 올리기(progress_post)는 보내지 않는다');
  // 형식 · 길이는 서버에 닿기 전에 멈춘다.
  await assert.rejects(도구.소식(ws, sent.number, { 글: '그림', 그림: [path.join(방, 'a.gif')] }), /PNG · JPG/);
  await assert.rejects(도구.소식(ws, sent.number, { 글: '가'.repeat(601) }), /600자/);
  await assert.rejects(도구.소식(ws, sent.number, { 글: '' }), /--글/);
  await assert.rejects(도구.소식(ws, sent.number, { 글: '단계', 단계: 'publish' }), /단계는/);
  // --영어는 영어 프로젝트에만(한국어 프로젝트에서는 서버에 닿기 전에 멈춘다 — 끝 판 카본 검수 A2).
  const 전 = 보낸.length;
  await assert.rejects(도구.소식(ws, sent.number, { 글: '영어 칸', 영어: 'Editing now.' }), /영어 프로젝트가 아닙니다/);
  assert.ok(!보낸.slice(전).some((call) => call.method === 'POST'), '쓰기 요청을 보내지 않는다');
});
