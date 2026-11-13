'use strict';

// PULSE 의뢰 확인 — 새 의뢰 알림이 Claude 메모와 따로, 의뢰 번호마다 한 번만 가는지(11-10 구매 점검 M5),
// 그리고 같은 의뢰를 끝없이 다시 돌리지 않는지(11-13 — 보관된 시험 의뢰 둘에 Claude가 209번 돌았다).
// 임시 폴더와 가짜 알림 · 가짜 작업실만 쓴다. 작업실 · 텔레그램 · Claude는 건드리지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 작업 = require('../tools/크레딧작업/PULSE의뢰확인.js');

const 방만들기 = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-order-alert-'));
const 알림모음 = (돌려줄 = { code: 0 }) => {
  const 보낸 = [];
  return { 보낸, 알림: (글) => { 보낸.push(글); return typeof 돌려줄 === 'function' ? 돌려줄(글) : 돌려줄; } };
};
const 줄 = (번호, 더 = {}) => ({ 번호, 상태: 'submitted', 단계: 'received', 제목: `${번호} 제목`, 메모: 0, ...더 });
const 거절 = (status, 글) => Object.assign(new Error(글), { status });
// 가짜 작업실: 목록은 주는 줄 그대로, 메모는 「메모」 함수가 정한다(던지면 실패). 부른 차례를 적는다.
function 가짜도구(줄들, 메모 = async () => {}) {
  const 부름 = [];
  return { 부름, 의뢰도구: {
    connect: async () => { 부름.push('connect'); return {}; },
    목록: async () => { 부름.push('목록'); return typeof 줄들 === 'function' ? 줄들() : 줄들; },
    받기: async (ws, 번호) => { 부름.push(`받기 ${번호}`); return { 방: path.join(os.tmpdir(), 'pulse-orders-fake', 번호), 파일: 0 }; },
    메모: async (ws, 번호, 메모글) => { 부름.push(`메모 ${번호}`); return 메모(번호, 메모글); },
  } };
}
const 답 = (o = {}) => ({ 글: JSON.stringify({ summary: '요약이에요.', lines: ['하나', '둘', '셋'], model: '유나 — 까닭', ref: '한 줄', risks: ['효능 표현'], ...o }) });
const 장부 = (방) => { try { return JSON.parse(fs.readFileSync(path.join(방, '메모시도.json'), 'utf8')); } catch { return {}; } };
const 대기있나 = (방, 번호) => fs.existsSync(path.join(방, '메모대기', `${번호}.json`));

test('새 의뢰는 번호마다 한 번만 알리고 장부에 남긴다', async () => {
  const 방 = 방만들기();
  const { 보낸, 알림 } = 알림모음();
  const ctx = { 방, 알림, 지금: '2026-11-10T05:00:00.000Z' };
  const 새것 = { 번호: 'P-1110-AB12', 제목: '  오미톡\n오미자   스파클링 ' };
  assert.equal(await 작업.새의뢰알림(ctx, 새것), true);
  assert.equal(await 작업.새의뢰알림(ctx, 새것), false);
  assert.equal(보낸.length, 1);
  assert.match(보낸[0], /^PULSE 새 의뢰 P-1110-AB12 · 오미톡 오미자 스파클링\n/);
  assert.doesNotMatch(보낸[0], /https?:|@/);
  const 알린 = JSON.parse(fs.readFileSync(path.join(방, '알린의뢰.json'), 'utf8'));
  assert.deepEqual(알린, { 'P-1110-AB12': '2026-11-10T05:00:00.000Z' });
  // 다른 번호는 따로 알린다.
  assert.equal(await 작업.새의뢰알림(ctx, { 번호: 'P-1110-CD34', 제목: '' }), true);
  assert.match(보낸[1], /^PULSE 새 의뢰 P-1110-CD34\n/);
});

test('보내지 못하면 장부에 적지 않아 다음 회차가 다시 보낸다', async () => {
  const 방 = 방만들기();
  const 새것 = { 번호: 'P-1110-EF56', 제목: '시험' };
  const 실패 = 알림모음({ code: 1, stderr: 'hermes down' });
  assert.equal(await 작업.새의뢰알림({ 방, 알림: 실패.알림 }, 새것), false);
  const 던짐 = 알림모음(() => { throw new Error('spawn failed'); });
  assert.equal(await 작업.새의뢰알림({ 방, 알림: 던짐.알림 }, 새것), false);
  assert.equal(fs.existsSync(path.join(방, '알린의뢰.json')), false);
  const 성공 = 알림모음({ code: 0, 건너뜀: true });
  assert.equal(await 작업.새의뢰알림({ 방, 알림: 성공.알림 }, 새것), true);
  assert.equal(성공.보낸.length, 1);
});

test('깨진 장부는 빈 장부로 읽고, 제목은 80자에서 자른다', async () => {
  const 방 = 방만들기();
  fs.writeFileSync(path.join(방, '알린의뢰.json'), '{깨짐');
  const { 보낸, 알림 } = 알림모음();
  assert.equal(await 작업.새의뢰알림({ 방, 알림 }, { 번호: 'P-1110-0A0B', 제목: '가'.repeat(200) }), true);
  const 첫줄 = 보낸[0].split('\n')[0];
  assert.equal(첫줄, `PULSE 새 의뢰 P-1110-0A0B · ${'가'.repeat(80)}`);
});

test('메모가 실패해도 새 의뢰 알림은 사전 확인에서 먼저 간다(내려받기보다 앞)', async () => {
  const 방 = 방만들기();
  const { 보낸, 알림 } = 알림모음();
  const 차례 = [];
  const { 의뢰도구 } = 가짜도구([줄('P-1113-0001')]);
  const 받기 = 의뢰도구.받기;
  의뢰도구.받기 = async (...a) => { 차례.push(`받기(알림 ${보낸.length})`); return 받기(...a); };
  const r = await 작업.사전확인({ 방, 알림, 의뢰도구 });
  assert.equal(r.할일, true);
  assert.deepEqual(차례, ['받기(알림 1)'], '내려받을 때 이미 알림이 갔다');
});

test('고르기 — 접수됐고 메모가 없는 의뢰만, 보관된 프로젝트 · 멈춘 의뢰 · 번호 꼴이 아닌 것은 고르지 않는다', () => {
  const 줄들 = [줄('P-1113-AAAA', { 단계: 'archived' }), 줄('P-1113-BBBB', { 메모: 1 }), 줄('P-1113-CCCC', { 상태: 'confirmed' }), 줄('../P-1113-DDDD'), 줄('P-1113-EEEE'), 줄('P-1113-FFFF')];
  assert.equal(작업.고르기(줄들).번호, 'P-1113-EEEE');
  assert.equal(작업.고르기(줄들, { 'P-1113-EEEE': { 포기: true } }).번호, 'P-1113-FFFF');
  assert.equal(작업.고르기(줄들, { 'P-1113-EEEE': { 포기: true }, 'P-1113-FFFF': { 포기: true } }), null);
  assert.equal(작업.고르기([줄('P-1111-E52F', { 단계: 'archived' }), 줄('P-1111-6715', { 단계: 'archived' })]), null, '11-13에 209번 돌던 두 의뢰의 꼴');
  assert.equal(작업.고르기([]), null);
  assert.equal(작업.고르기(null), null);
});

test('보관된 의뢰만 있으면 작업실만 읽고 끝난다 — 내려받지도 Claude를 부르지도 않는다', async () => {
  const 방 = 방만들기();
  const { 보낸, 알림 } = 알림모음();
  const { 부름, 의뢰도구 } = 가짜도구([줄('P-1111-E52F', { 단계: 'archived' }), 줄('P-1111-6715', { 단계: 'archived' })]);
  for (let 회 = 0; 회 < 3; 회++) assert.deepEqual(await 작업.사전확인({ 방, 알림, 의뢰도구 }), { 할일: false, 이유: '새 의뢰 없음' });
  assert.deepEqual(부름, ['connect', '목록', 'connect', '목록', 'connect', '목록']);
  assert.equal(보낸.length, 0);
});

test('메모가 올라가면 한 번 알리고 남긴 것 · 장부 줄을 지운다', async () => {
  const 방 = 방만들기();
  const { 보낸, 알림 } = 알림모음();
  const 올린 = [];
  const { 의뢰도구 } = 가짜도구([줄('P-1113-0002')], async (번호, 메모) => { 올린.push([번호, 메모]); });
  const ctx = { 방, 알림, 의뢰도구, 지금: '2026-11-13T09:00:00.000Z' };
  const 자료 = await 작업.사전확인(ctx);
  assert.deepEqual([자료.할일, 자료.번호, 자료.제목], [true, 'P-1113-0002', 'P-1113-0002 제목']);
  assert.deepEqual(await 작업.사후(답({ summary: '가'.repeat(1500), 엉뚱한칸: 'x' }), 자료, ctx), { 메모: true });
  assert.equal(올린.length, 1);
  assert.deepEqual(Object.keys(올린[0][1]), ['summary', 'lines', 'model', 'ref', 'risks'], '메모 칸만 옮긴다');
  assert.equal(올린[0][1].summary.length, 1000);
  assert.equal(대기있나(방, 'P-1113-0002'), false);
  assert.deepEqual(장부(방), {});
  assert.equal(보낸.length, 2);
  assert.match(보낸[1], /^PULSE 의뢰 P-1113-0002 · P-1113-0002 제목\n1차 확인 메모를 작업실에 남겼어요/);
  assert.doesNotMatch(보낸.join('\n'), /https?:|@/);
});

test('서버가 메모를 거절하면 Claude는 한 번만 돌고, 다음 회차는 남겨 둔 메모만 다시 올리다 세 번째에 멈추고 한 번 알린다', async () => {
  const 방 = 방만들기();
  const { 보낸, 알림 } = 알림모음();
  const { 부름, 의뢰도구 } = 가짜도구([줄('P-1113-0003'), 줄('P-1113-0004')], async (번호) => { if (번호 === 'P-1113-0003') throw 거절(409, 'request_note 실패(409): 보관된 프로젝트예요.'); });
  const ctx = { 방, 알림, 의뢰도구, 지금: '2026-11-13T09:00:00.000Z' };
  let Claude = 0;
  // 한 회차 = 실행기가 하는 일: 사전확인 → (할 일이 있으면) Claude → 사후
  const 한회차 = async () => {
    const 자료 = await 작업.사전확인(ctx);
    if (!자료.할일) return 자료.이유;
    Claude += 1;
    try { await 작업.사후(답(), 자료, ctx); return `끝 ${자료.번호}`; } catch (오류) { return `사후 실패 ${자료.번호}: ${오류.message.slice(0, 22)}`; }
  };
  assert.match(await 한회차(), /^사후 실패 P-1113-0003: 1차 확인 메모를 올리지 못했다/);
  assert.equal(대기있나(방, 'P-1113-0003'), true, '올리기 전에 남겨 둔다');
  assert.deepEqual([장부(방)['P-1113-0003'].돌림, 장부(방)['P-1113-0003'].실패], [1, 1]);
  assert.equal(await 한회차(), '남겨 둔 메모 올리기 실패');
  assert.equal(await 한회차(), '남겨 둔 메모 올리기 실패');
  assert.equal(Claude, 1, '거절된 의뢰에 Claude를 다시 부르지 않는다');
  assert.deepEqual([장부(방)['P-1113-0003'].실패, 장부(방)['P-1113-0003'].포기], [3, true]);
  const 멈춤알림 = 보낸.filter((글) => /1차 확인을 멈췄어요/.test(글));
  assert.equal(멈춤알림.length, 1);
  assert.match(멈춤알림[0], /^PULSE 의뢰 P-1113-0003 · 1차 확인을 멈췄어요 — 메모를 3번 올리지 못했어요\(409 request_note 실패\(409\): 보관된 프로젝트예요\.\)/);
  // 멈춘 의뢰는 건너뛰고 다음 의뢰로 간다 — 그 뒤로는 새 의뢰가 없다.
  assert.equal(await 한회차(), '끝 P-1113-0004');
  assert.equal(Claude, 2);
  의뢰도구.목록 = async () => [줄('P-1113-0003'), 줄('P-1113-0004', { 메모: 1 })];
  for (let 회 = 0; 회 < 5; 회++) assert.equal(await 한회차(), '새 의뢰 없음');
  assert.equal(Claude, 2, '열 번을 더 돌아도 Claude는 다시 돌지 않는다');
  assert.equal(보낸.filter((글) => /멈췄어요/.test(글)).length, 1, '멈춤 알림은 한 번');
  assert.equal(부름.filter((이름) => 이름 === '메모 P-1113-0003').length, 3);
});

test('지나가는 실패(로그인 · 한도 · 시간 넘김 · 서버 오류)는 세지 않고 남겨 둔 메모를 계속 다시 올린다 — 풀리면 AI 없이 올라간다', async () => {
  const 방 = 방만들기();
  const { 보낸, 알림 } = 알림모음();
  const 실패들 = [거절(401, '작업실 로그인 실패(401)'), 거절(429, '잠시 뒤에'), 거절(503, '서버 오류'), new Error('The operation was aborted due to timeout'), 거절(500, 'x'), 거절(408, 'x')];
  let 몇번째 = 0;
  const { 의뢰도구 } = 가짜도구([줄('P-1113-0005')], async () => { if (몇번째 < 실패들.length) throw 실패들[몇번째++]; });
  const ctx = { 방, 알림, 의뢰도구 };
  const 자료 = await 작업.사전확인(ctx);
  await assert.rejects(작업.사후(답(), 자료, ctx), /메모를 올리지 못했다/);
  for (let 회 = 0; 회 < 5; 회++) assert.deepEqual(await 작업.사전확인(ctx), { 할일: false, 이유: '남겨 둔 메모 올리기 실패' });
  assert.deepEqual([장부(방)['P-1113-0005'].실패, 장부(방)['P-1113-0005'].미룸, 장부(방)['P-1113-0005'].포기], [0, 6, undefined]);
  assert.deepEqual(await 작업.사전확인(ctx), { 할일: false, 이유: '남겨 둔 메모를 올림' });
  assert.equal(대기있나(방, 'P-1113-0005'), false);
  assert.deepEqual(장부(방), {});
  assert.equal(보낸.filter((글) => /멈췄어요/.test(글)).length, 0);
  assert.equal(보낸.filter((글) => /메모를 작업실에 남겼어요/.test(글)).length, 1);
});

test('Claude 답이 메모 꼴이 아니면 두 번까지만 돌고 멈춘다', async () => {
  const 방 = 방만들기();
  const { 보낸, 알림 } = 알림모음();
  const { 부름, 의뢰도구 } = 가짜도구([줄('P-1113-0006')]);
  const ctx = { 방, 알림, 의뢰도구 };
  for (let 회 = 0; 회 < 작업.최대돌림; 회++) {
    const 자료 = await 작업.사전확인(ctx);
    assert.equal(자료.할일, true);
    await assert.rejects(작업.사후({ 글: '죄송해요, 표로 드릴게요.' }, 자료, ctx), /JSON이 없다/);
  }
  assert.equal(장부(방)['P-1113-0006'].돌림, 2);
  assert.deepEqual(await 작업.사전확인(ctx), { 할일: false, 이유: '메모를 만들지 못해 멈춤' });
  assert.deepEqual(await 작업.사전확인(ctx), { 할일: false, 이유: '새 의뢰 없음' });
  assert.equal(보낸.filter((글) => /1차 확인을 멈췄어요 — Claude가 2번 돌았지만 메모를 만들지 못했어요/.test(글)).length, 1);
  assert.equal(부름.filter((이름) => 이름.startsWith('메모 ')).length, 0);
  assert.equal(부름.filter((이름) => 이름.startsWith('받기 ')).length, 2);
});

test('장부 · 남긴 메모가 깨져 있어도 멈추지 않는다, 알림이 실패해도 메모 올리기 결과는 그대로다', async () => {
  const 방 = 방만들기();
  fs.writeFileSync(path.join(방, '메모시도.json'), '[깨짐');
  fs.mkdirSync(path.join(방, '메모대기'), { recursive: true });
  fs.writeFileSync(path.join(방, '메모대기', 'P-1113-0007.json'), '{깨짐');
  const 던짐 = 알림모음(() => { throw new Error('hermes down'); });
  const { 의뢰도구 } = 가짜도구([줄('P-1113-0007')]);
  const ctx = { 방, 알림: 던짐.알림, 의뢰도구 };
  const 자료 = await 작업.사전확인(ctx);
  assert.equal(자료.할일, true, '깨진 남긴 메모는 없는 것으로 보고 Claude를 부른다');
  assert.deepEqual(await 작업.사후(답(), 자료, ctx), { 메모: true });
  assert.equal(대기있나(방, 'P-1113-0007'), false);
});
