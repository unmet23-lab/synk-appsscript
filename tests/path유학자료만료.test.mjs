// PATH 유학 앱 공식 자료 만료 검사(tools/path유학자료만료.mjs)와 알림 예약 작업(tools/크레딧작업/PATH유학자료확인.js).
// 공개본은 가짜 fetch로 대신한다. 실제 텔레그램 · 기록 폴더 · 네트워크는 건드리지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as 만료 from '../tools/path유학자료만료.mjs';
import { POSTS, STALE_DAYS, isStalePost } from '../experiences/path-app/channel-data.mjs';
import { RULES, PROGRAMS, staleItems } from '../experiences/path-app/study-data.mjs';

const require = createRequire(import.meta.url);
const 뿌리 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 작업 = require('../tools/크레딧작업/PATH유학자료확인.js');
const 실행기 = require('../tools/크레딧실행.js');
const 자료 = (이름) => fs.readFileSync(path.join(뿌리, 'experiences/path-app', 이름), 'utf8');
const 원본글 = () => `${자료('channel-data.mjs')}\n${자료('study-data.mjs')}`;
const 목록 = 만료.목록만들기({ POSTS, RULES, PROGRAMS });
const KST2359 = (날) => new Date(`${날}T14:59:00.000Z`);
const 하루뒤 = (날) => new Date(Date.parse(`${날}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

/** 공개본 가짜: 원본 글을 고쳐 app.mjs로 준다. 죽음이면 네트워크 오류. */
function 가짜공개본(고치기 = (s) => s, { 죽음 = false } = {}) {
  const 받은 = [];
  return {
    받은,
    fetch: async (주소) => {
      받은.push(주소);
      if (죽음) throw new Error('getaddrinfo ENOTFOUND synk.im');
      return { ok: true, status: 200, text: async () => 고치기(원본글()) };
    },
  };
}

test('목록: 손 글 · 규칙 · 실제 과정만 세고 예시 과정은 뺀다', () => {
  const 실제 = PROGRAMS.filter((p) => !p.example);
  assert.equal(목록.length, POSTS.length + RULES.length + 실제.length);
  assert.ok(!목록.some((x) => x.id.startsWith('example-')));
});

test('마지막 날이 앱의 「다시 확인하세요」 판정과 맞다(그날 밤까지 확인됨, 다음 날 밤에는 낡음)', () => {
  assert.equal(STALE_DAYS, 90);
  assert.equal(만료.마지막날더함.글, STALE_DAYS);
  const 줄들 = 만료.항목셈(목록, { 오늘: '2026-11-22' }).filter((x) => x.검사 === '확인일');
  assert.equal(줄들.length, 목록.length);
  for (const x of 줄들) {
    const 낡음 = (날) => (x.종류 === '글'
      ? isStalePost(POSTS.find((p) => p.id === x.id), KST2359(날))
      : staleItems(RULES, PROGRAMS, KST2359(날)).some((s) => s.id === x.id));
    assert.equal(낡음(x.마지막날), false, `${x.id} 마지막 날 ${x.마지막날}에는 아직 확인됨`);
    assert.equal(낡음(하루뒤(x.마지막날)), true, `${x.id} 다음 날에는 낡음`);
  }
});

test('접수 끝 날: 마지막 차수의 끝, 차수가 없으면 applyCloses, 둘 다 없으면 없음', () => {
  assert.equal(만료.접수끝날({ applyRounds: [['2026-09-21', '2026-10-02'], ['2026-11-09', '2026-11-20']] }), '2026-11-20');
  assert.equal(만료.접수끝날({ applyOpens: '2027-01-02', applyCloses: '2027-01-20' }), '2027-01-20');
  assert.equal(만료.접수끝날({ applyOpens: null }), null);
  const 없음 = 만료.항목셈([{ 종류: '과정', id: 'x', 이름: 'x', checkedAt: '2026-11-21', 접수끝: null }], { 오늘: '2026-11-22' });
  assert.deepEqual(없음.find((x) => x.검사 === '접수'), { ...없음.find((x) => x.검사 === '접수'), 마지막날: null, 남은날: null, 걸림: false });
});

test('문턱: 15일은 그대로, 14일 · 오늘 · 지난 날은 걸린다(단계 곧 · 지남)', () => {
  const 항목 = [{ 종류: '과정', id: 'p', 이름: 'p', checkedAt: '2026-11-21', 접수끝: '2026-12-31' }];
  const 접수 = (오늘) => 만료.항목셈(항목, { 오늘 }).find((x) => x.검사 === '접수');
  assert.deepEqual([접수('2026-12-16').남은날, 접수('2026-12-16').걸림], [15, false]);
  assert.deepEqual([접수('2026-12-17').남은날, 접수('2026-12-17').단계], [14, '곧']);
  assert.deepEqual([접수('2026-12-31').남은날, 접수('2026-12-31').단계], [0, '곧']);
  assert.deepEqual([접수('2027-01-01').남은날, 접수('2027-01-01').단계, 접수('2027-01-01').열쇠], [-1, '지남', '과정:접수:p:2026-12-31:지남']);
});

test('글 읽기: 저장소 원본과 공개 묶음(esbuild) 모두에서 모듈과 같은 값을 읽는다', async () => {
  const 기대 = new Map(목록.map((x) => [x.id, { checkedAt: x.checkedAt, 접수끝: x.종류 === '과정' ? x.접수끝 : null }]));
  const 비교 = (읽음, 출처) => {
    for (const [id, 값] of 기대) {
      const r = 읽음.get(id);
      assert.ok(r, `${출처}에서 ${id}를 못 찾음`);
      assert.equal(r.checkedAt, 값.checkedAt, `${출처} ${id} checkedAt`);
      if (값.접수끝) assert.equal(r.접수끝, 값.접수끝, `${출처} ${id} 접수끝`);
    }
  };
  비교(만료.글에서읽기(원본글(), [...기대.keys()]), '원본');
  await assert.doesNotReject(만료.저장소자료(뿌리));
  const esbuild = require(require.resolve('esbuild', { paths: [path.join(뿌리, 'experiences/synk-account')] }));
  // tools/prepare-path-app-public.mjs와 같은 묶음 설정(축소 없음).
  const 묶음 = await esbuild.build({
    stdin: { contents: "export * from './channel-data.mjs';\nexport { RULES, PROGRAMS } from './study-data.mjs';", resolveDir: path.join(뿌리, 'experiences/path-app'), loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', charset: 'utf8', logLevel: 'silent',
  });
  비교(만료.글에서읽기(묶음.outputFiles[0].text, [...기대.keys()]), '공개 묶음');
});

test('글 읽기: id가 두 번 나오면 그 항목은 못 읽은 것으로 둔다', () => {
  const 글 = "{ id: 'a', checkedAt: '2026-11-21' }\n{ id: 'a', checkedAt: '2026-10-01' }\n{ id: 'b', checkedAt: '2026-11-01' }";
  const 읽음 = 만료.글에서읽기(글, ['a', 'b']);
  assert.equal(읽음.has('a'), false);
  assert.equal(읽음.get('b').checkedAt, '2026-11-01');
});

test('만료확인: 공개본이 기준이고, 저장소만 고쳐졌으면 공개 대기 · 공개본을 못 받으면 저장소로 잰다', async () => {
  // 공개본의 전북대 학부가 옛 확인일을 갖고 있다(저장소만 고쳐진 회차).
  const 옛공개 = 가짜공개본((s) => s.replace(/(id: 'jbnu-ug'[\s\S]*?checkedAt: )'2026-11-21'/, "$1'2026-09-01'"));
  const r = await 만료.만료확인({ 뿌리들: [뿌리], 오늘: '2026-11-22', fetch: 옛공개.fetch, 지금: 1 });
  assert.match(옛공개.받은[0], /^https:\/\/synk\.im\/path\/app\/app\.mjs\?check=1$/);
  const 확인 = r.줄들.find((x) => x.id === 'jbnu-ug' && x.검사 === '확인일');
  assert.deepEqual([확인.기준, 확인.기준날, 확인.공개대기], ['공개본', '2026-09-01', true]);
  assert.equal(r.줄들.find((x) => x.id === 'wku-ug' && x.검사 === '확인일').공개대기, false);

  const 죽은 = await 만료.만료확인({ 뿌리들: [뿌리], 오늘: '2026-11-22', fetch: 가짜공개본(undefined, { 죽음: true }).fetch });
  assert.match(죽은.공개본.오류, /ENOTFOUND/);
  assert.ok(죽은.줄들.every((x) => x.기준 === '저장소'));
  await assert.rejects(만료.만료확인({ 뿌리들: [path.join(os.tmpdir(), '없는-작업본-xyz')], 공개본: false }), /저장소 자료를 못 읽었다/);
});

function 방만들기() {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-path-study-expiry-'));
  const 알림 = [];
  let 답 = { code: 0 };
  return {
    방, 알림,
    실패로: () => { 답 = { code: 1 }; },
    성공으로: () => { 답 = { code: 0 }; },
    돌기: (오늘, { 공개 = 가짜공개본(), 뿌리들 = [뿌리] } = {}) => 작업.만들기({ fetch: 공개.fetch, 지금고정: new Date(`${오늘}T01:40:00.000Z`), 뿌리들 })
      .사전확인({ 루트: 뿌리, 방, 알림: (s) => { 알림.push(s); return 답; } }),
    기록: () => JSON.parse(fs.readFileSync(path.join(방, '알린항목.json'), 'utf8')),
    지우기: () => fs.rmSync(방, { recursive: true, force: true }),
  };
}

test('사전 확인: 지난 접수 차수를 한 번 알리고, 같은 날 다시 돌면 조용하다 · 모델은 부르지 않는다', async () => {
  const t = 방만들기();
  try {
    const 첫 = await t.돌기('2026-11-22');
    assert.equal(첫.할일, false);
    assert.equal(t.알림.length, 1);
    assert.match(t.알림[0], /^\[PATH 유학\] .*새로 1건/);
    assert.match(t.알림[0], /전북대학교 학부\(jbnu-ug\): 마지막 접수 차수가 2026-11-20에 끝났어요\(2일 지남\)/);
    assert.deepEqual(Object.keys(t.기록().알린), ['과정:접수:jbnu-ug:2026-11-20:지남']);
    const 둘째 = await t.돌기('2026-11-23');
    assert.equal(t.알림.length, 1, '같은 항목 · 같은 단계는 다시 알리지 않는다');
    assert.match(둘째.이유, /걸림 1건\(새로 0건\)/);
  } finally { t.지우기(); }
});

test('지난 날을 넣으면 확인일이 문턱 안인 자료가 새로 걸려 알린다 · 같은 날 확인한 자료는 한 줄로 묶는다', async () => {
  const t = 방만들기();
  try {
    await t.돌기('2026-11-22');
    await t.돌기('2027-02-10');
    assert.equal(t.알림.length, 2);
    const 글 = t.알림[1];
    assert.match(글, /새로 25건 생겼어요\(오늘 2027-02-10, 문턱 14일\)\. 지금 걸린 항목은 모두 26건이에요\./);
    assert.match(글, /2026-11-21에 확인한 자료 21건\(글 9 · 규칙 7 · 과정 5\): 2027-02-18이 지나면 앱이 「다시 확인하세요」를 띄워요\(8일 남음\)/);
    assert.doesNotMatch(글, /jbnu-ug\): 마지막 접수/, '이미 알린 항목은 다시 싣지 않는다');
    assert.equal(t.기록().걸림.length, 26);
  } finally { t.지우기(); }
});

test('자료를 고쳐 풀린 항목은 기록에서 빠지고, 다시 걸리면 다시 알린다 · 알림을 못 보내면 다음 회차에 다시 보낸다', async () => {
  const t = 방만들기();
  const 새차수 = 가짜공개본((s) => s.replace("applyRounds: [['2026-09-21', '2026-10-02'], ['2026-11-09', '2026-11-20']]", "applyRounds: [['2027-05-01', '2027-05-20']]"));
  try {
    t.실패로();
    await t.돌기('2026-11-22');
    assert.equal(t.알림.length, 1);
    assert.deepEqual(t.기록().알린, {}, '못 보낸 알림은 알린 것으로 적지 않는다');
    t.성공으로();
    await t.돌기('2026-11-22');
    assert.equal(t.알림.length, 2);
    assert.equal(Object.keys(t.기록().알린).length, 1);
    await t.돌기('2026-11-23', { 공개: 새차수 });
    assert.equal(t.알림.length, 2);
    assert.deepEqual(t.기록().알린, {});
    assert.deepEqual(t.기록().걸림, []);
    await t.돌기('2026-11-24');
    assert.equal(t.알림.length, 3, '옛 값으로 되돌아가면 다시 알린다');
  } finally { t.지우기(); }
});

test('저장소 자료를 못 읽으면 하루 한 번만 알린다', async () => {
  const t = 방만들기();
  const 없는 = [path.join(os.tmpdir(), '없는-작업본-xyz')];
  try {
    const r = await t.돌기('2026-11-22', { 뿌리들: 없는 });
    assert.match(r.이유, /자료 못 읽음/);
    await t.돌기('2026-11-22', { 뿌리들: 없는 });
    assert.equal(t.알림.length, 1);
    assert.match(t.알림[0], /자료를 못 읽었어요/);
    await t.돌기('2026-11-23', { 뿌리들: 없는 });
    assert.equal(t.알림.length, 2);
  } finally { t.지우기(); }
});

test('실행기 길: 「할 일 없음」으로 끝나고 마지막확인에 걸린 수를 남긴다', async () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-path-study-runner-'));
  const 알림 = [];
  try {
    const r = await 실행기.작업돌리기('PATH유학자료확인', {
      작업: 작업.만들기({ fetch: 가짜공개본().fetch, 지금고정: new Date('2026-11-22T01:40:00.000Z'), 뿌리들: [뿌리] }),
      방, 알림: (s) => { 알림.push(s); return { code: 0 }; }, 지금: new Date('2026-11-22T01:40:00.000Z'),
    });
    assert.equal(r.상태, '할일없음');
    assert.match(r.이유, /걸림 1건\(새로 1건\)/);
    assert.equal(알림.length, 1);
    assert.equal(JSON.parse(fs.readFileSync(path.join(방, '마지막확인.json'), 'utf8')).상태, '할일없음');
    assert.equal(fs.existsSync(path.join(방, '잠금')), false);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});
