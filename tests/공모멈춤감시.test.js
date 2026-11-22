'use strict';
// 공모 마감 직전 멈춘 작업 감시 시험(2026-11-20, 유호님 「다섯 개 다 해」 가운데 첫째).
const test = require('node:test');
const assert = require('node:assert');
const 감시 = require('../tools/공모멈춤감시.js');

const A = 'local_aaaaaaaa-0000-0000-0000-000000000001';
const B = 'local_bbbbbbbb-0000-0000-0000-000000000002';
const 현황 = { items: [
  { id: '1', name: '가 공모', stage: '준비 중', deadline: '2026-11-21T23:59', owner_session: A },
  { id: '2', name: '나 공모', stage: '제작 중', deadline: '2026-11-21T09:00', owner_session: [B] },
  { id: '3', name: '다 공모', stage: '준비 중', deadline: '2026-11-30T23:59', owner_session: A },
  { id: '4', name: '라 공모', stage: '결과 기다림', deadline: '2026-11-21T23:59' },
  { id: '5', name: '마 공모', stage: '준비 중', deadline: '2026-11-21T06:00' },
] };
const 지금 = new Date('2026-11-20T21:00:00+09:00');

test('마감 시각은 시간대가 없으면 한국 시각, 날짜만 있으면 그날 23:59다', () => {
  assert.strictEqual(감시.마감시각('2026-11-23T23:59'), Date.parse('2026-11-23T23:59+09:00'));
  assert.strictEqual(감시.마감시각('2026-11-30'), Date.parse('2026-11-30T23:59+09:00'));
  assert.ok(Number.isNaN(감시.마감시각('미정')));
});

test('준비 중 · 제작 중이고 7일 안쪽인 공고만 보고, 문턱은 12시간 안쪽 60분 · 48시간 안쪽 120분 · 그 밖 720분이다', () => {
  const 볼 = 감시.볼것(현황, 지금);
  assert.deepStrictEqual(볼.map(x => x.이름), ['마 공모', '나 공모', '가 공모']);
  const 멀리 = 감시.볼것({ items: [{ id: '6', name: '바 공모', stage: '제작 중', deadline: '2026-11-25T23:59', owner_session: A }] }, 지금);
  assert.strictEqual(멀리[0].문턱분, 720);
  assert.strictEqual(감시.볼것({ items: [{ id: '7', name: '사 공모', stage: '제작 중', deadline: '2026-11-28T23:59' }] }, 지금).length, 0, '7일 밖은 보지 않는다');
  assert.strictEqual(볼.find(x => x.이름 === '나 공모').문턱분, 60);
  assert.strictEqual(볼.find(x => x.이름 === '가 공모').문턱분, 120);
});

test('쉬는 세션의 끝글이 문턱 넘게 그대로면 깨우고, 깨운 뒤에는 문턱 동안 다시 깨우지 않는다', () => {
  const 볼 = 감시.볼것(현황, 지금);
  const 상태 = { sessions: {} };
  const 본 = [{ session_id: B, 상태: 'idle', 끝글: '굽기를 걸었다. 받으면 확인한다.', 판단: '멈춤' }];
  assert.strictEqual(감시.판정(상태, 본, 볼, 지금)[0].할일, '기다리기', '처음 본 글은 잰다');
  const 한시간뒤 = new Date(+지금 + 61 * 6e4);
  assert.strictEqual(감시.판정(상태, 본, 볼, 한시간뒤)[0].할일, '깨우기');
  상태.sessions[B].깨운때 = 한시간뒤.toISOString();
  assert.strictEqual(감시.판정(상태, 본, 볼, new Date(+한시간뒤 + 30 * 6e4))[0].할일, '기다리기');
  // 글이 바뀌면 다시 잰다.
  const 바뀜 = [{ ...본[0], 끝글: '받았다. 다음 컷을 굽는다.' }];
  assert.strictEqual(감시.판정(상태, 바뀜, 볼, new Date(+한시간뒤 + 90 * 6e4))[0].할일, '기다리기');
});

test('유호님 답을 기다리면 알리고, 일하는 중이면 기다린다', () => {
  const 볼 = 감시.볼것(현황, 지금);
  const 상태 = { sessions: {} };
  const 본 = [{ session_id: A, 상태: 'idle', 끝글: '제출 단추 앞입니다. 내도 될까요?', 판단: '답기다림' }];
  감시.판정(상태, 본, 볼, 지금);
  const r = 감시.판정(상태, 본, 볼, new Date(+지금 + 121 * 6e4));
  assert.strictEqual(r[0].할일, '알리기');
  assert.deepStrictEqual(r[0].공고, ['가 공모'], '48시간 밖 공고는 넣지 않는다');
  const 일함 = 감시.판정({ sessions: {} }, [{ session_id: A, 상태: 'running', 끝글: 'x', 판단: '일함' }], 볼, 지금);
  assert.strictEqual(일함[0].할일, '기다리기');
});

test('주인 세션이 없고 24시간 안쪽이면 알린다', () => {
  const 볼 = 감시.볼것(현황, 지금);
  const r = 감시.판정({ sessions: {} }, [], 볼, 지금);
  assert.deepStrictEqual(r.map(x => [x.할일, x.공고[0]]), [['알리기', '마 공모']]);
});

test('사용 한도로 멈춘 세션은 깨우지 않고 알린다', () => {
  const 볼 = 감시.볼것(현황, 지금);
  const 상태 = { sessions: {} };
  const 본 = [{ session_id: B, 상태: 'idle', 끝글: "You've hit your Fable limit · resets Nov 26, 9pm", 판단: '한도' }];
  감시.판정(상태, 본, 볼, 지금);
  const r = 감시.판정(상태, 본, 볼, new Date(+지금 + 61 * 6e4));
  assert.strictEqual(r[0].할일, '알리기');
  assert.match(r[0].까닭, /사용 한도/);
});

// 주인 없는 급한 공고(2026-11-23, 유호님 「이거 왜 체크가 자동으로 안되지?」 → 「지금 고쳐」).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 열린 = [
  { id: 'c1', 이름: '세라믹', 전체이름: '세라믹 AI 영상 공모전', 값: 'AI 영상', 마감: '2026-11-23', 마감글: '2026-11-23 17:00 KST', 자격: '됨', 주소: 'https://example.org/c1', 공고조건: { 상금합계만원: 600, 작품수상한: 1 } },
  { id: 'c2', 이름: '광명역', 값: 'AI 영상', 마감: '2026-11-24', 마감글: '2026-11-24 18:00 KST', 자격: '됨' },
  { id: 'c3', 이름: '서울 숏폼', 값: 'AI 영상', 마감: '2026-11-27', 마감글: '2026-11-27', 자격: '확인 필요', AI허용: '조건부 허용' },
  { id: 'c4', 이름: '식중독', 값: '영상', 마감: '2026-11-23', 마감글: '2026-11-23 23:59 KST', 자격: '됨' },
  { id: 'c5', 이름: '먼 공모', 값: 'AI 영상', 마감: '2026-12-10', 마감글: '2026-12-10', 자격: '됨' },
  { id: 'c6', 이름: '지난 공모', 값: 'AI 영상', 마감: '2026-11-23', 마감글: '2026-11-23 05:00 KST', 자격: '됨' },
];
const 새벽 = new Date('2026-11-23T06:00:00+09:00');

test('급한 공고: AI 영상이고 마감 7일 안쪽인 것만, 마감 시각 순으로, 7일 · 3일 · 1일 단계를 단다', () => {
  const r = 감시.급한공고(열린, { sessions: {} }, 새벽);
  assert.deepStrictEqual(r.map(x => [x.id, x.단계]), [['c1', '1일'], ['c2', '3일'], ['c3', '7일']]);
  assert.strictEqual(r[0].마감시각, '2026-11-23T08:00:00.000Z', '마감글의 17:00을 쓴다');
  assert.strictEqual(r[2].마감시각, '2026-11-27T14:59:00.000Z', '시각이 없으면 그날 23:59');
  assert.ok(r[2].AI조건부);
});

test('급한 공고: 같은 단계는 한 번만, 더 급한 단계에 들어서면 다시 낸다', () => {
  const 상태 = { sessions: { '급한공고:c1': { 알린단계: '1일' }, '급한공고:c2': { 알린단계: '7일' }, '급한공고:c3': { 알린단계: '7일' } } };
  assert.deepStrictEqual(감시.급한공고(열린, 상태, 새벽).map(x => [x.id, x.단계]), [['c2', '3일']]);
  const 다음날 = new Date('2026-11-24T00:00:00+09:00');
  상태.sessions['급한공고:c2'].알린단계 = '3일';
  assert.deepStrictEqual(감시.급한공고(열린, 상태, 다음날).map(x => [x.id, x.단계]), [['c2', '1일']]);
});

test('급한 공고 글: 건수, 마감 · 남은 시간, 상금 · 작품 수 · 조건, 열두 건 넘으면 지도로 넘긴다', () => {
  const r = 감시.급한공고(열린, { sessions: {} }, 새벽);
  const 글 = 감시.급한글(r, 'https://claude.ai/artifact/map');
  assert.match(글, /AI 영상 공모가 3건 있습니다/);
  assert.match(글, /11-23\(월\) 17:00 마감 · 11시간 남음/);
  assert.match(글, /세라믹 AI 영상 공모전 \(총상금 600만 원, 1인 1작품\)/);
  assert.match(글, /서울 숏폼 \(AI는 조건부 허용이라 조건 확인 필요, 자격 확인 필요\)/);
  assert.match(글, /공모 지도: https:\/\/claude\.ai\/artifact\/map/);
  const 많음 = Array.from({ length: 14 }, (_, i) => ({ ...r[1], id: 'm' + i, 이름: '공모 ' + i }));
  assert.match(감시.급한글(많음), /나머지 2건은 공모 지도에 있습니다/);
});

test('알리기 가운데 마감 48시간 안쪽과 주인 없는 공고는 텔레그램으로도 보낸다', () => {
  const 볼 = 감시.볼것(현황, 지금);
  const 상태 = { sessions: {} };
  const 본 = [{ session_id: A, 상태: 'idle', 끝글: '회원가입은 유호님이 하셔야 합니다.', 판단: '답기다림' }];
  감시.판정(상태, 본, 볼, 지금);
  const r = 감시.판정(상태, 본, 볼, new Date(+지금 + 121 * 6e4));
  assert.strictEqual(r.find(x => x.session_id === A).텔레그램, true);
  assert.strictEqual(r.find(x => x.session_id.startsWith('주인없음:')).텔레그램, true);
  const 멀리 = 감시.볼것({ items: [{ id: '9', name: '먼 공모', stage: '준비 중', deadline: '2026-11-26T23:59', owner_session: A }] }, 지금);
  const s2 = { sessions: {} };
  감시.판정(s2, 본, 멀리, 지금);
  assert.strictEqual(감시.판정(s2, 본, 멀리, new Date(+지금 + 721 * 6e4))[0].텔레그램, false);
});

test('명령줄 --급한공고알림: 한 통 보내고 알린 단계를 적어, 다음 회차에는 다시 보내지 않는다', (t) => {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), '공모멈춤-'));
  const 보낸곳 = path.join(폴더, '텔레그램');
  t.after(() => fs.rmSync(폴더, { recursive: true, force: true }));
  fs.writeFileSync(path.join(폴더, '신청현황.json'), JSON.stringify({ items: [{ id: 'k', name: '경산 AI 공모전', stage: '준비 중', deadline: '2026-11-23T23:59', owner_session: A }] }));
  fs.writeFileSync(path.join(폴더, '통합목록.json'), JSON.stringify({ items: [
    { id: 'k', title: '경산 AI 공모전', calendar_20261110: { end: '2026-11-23' }, ai_video: { value: 'AI 영상' } },
    { id: 'n', title: '국세청 장려금 숏폼 AI 공모전', calendar_20261110: { end: '2026-11-25' }, ai_video: { value: 'AI 영상' }, latest_review: { url: 'https://example.org/n' } },
    { id: 'v', title: '그냥 영상 공모전', calendar_20261110: { end: '2026-11-24' }, ai_video: { value: '영상' } },
  ] }));
  fs.writeFileSync(path.join(폴더, '공모지도.json'), JSON.stringify({ artifact_url: 'https://claude.ai/artifact/map' }));
  const 돌림 = () => {
    const 앞 = process.env.SYNK_TG_DRYRUN_DIR;
    process.env.SYNK_TG_DRYRUN_DIR = 보낸곳;
    const 찍음 = []; const 원래 = console.log; console.log = (s) => 찍음.push(String(s));
    try { return { code: 감시.main(['--급한공고알림', '--보관함', 폴더, '--지금', '2026-11-23T06:00:00+09:00']), out: 찍음.join('\n') }; }
    finally { console.log = 원래; if (앞 === undefined) delete process.env.SYNK_TG_DRYRUN_DIR; else process.env.SYNK_TG_DRYRUN_DIR = 앞; }
  };
  const 첫 = 돌림();
  assert.strictEqual(첫.code, 0, 첫.out);
  const 통 = fs.readdirSync(보낸곳);
  assert.strictEqual(통.length, 1);
  const 글 = fs.readFileSync(path.join(보낸곳, 통[0]), 'utf8');
  assert.match(글, /국세청 장려금 숏폼 AI 공모전/);
  assert.doesNotMatch(글, /경산/, '신청현황에 있는 공모는 알리지 않는다');
  assert.doesNotMatch(글, /그냥 영상/, 'AI 허용을 모르는 영상 공모는 알리지 않는다');
  const 상태 = JSON.parse(fs.readFileSync(path.join(폴더, '멈춤감시.json'), 'utf8'));
  assert.strictEqual(상태.sessions['급한공고:n'].알린단계, '3일');
  const 둘째 = 돌림();
  assert.match(둘째.out, /"보냄":0/);
  assert.strictEqual(fs.readdirSync(보낸곳).length, 1);
});
