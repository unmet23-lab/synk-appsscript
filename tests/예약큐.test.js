'use strict';
// 1일 1편 예약 큐의 한 주 역할 세기(10-21, v2 §6 「한 주 역할」)를 본다. 임시 폴더의 가짜 편 폴더만 읽고 docs/마케팅은 건드리지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const tool = path.resolve(__dirname, '..', 'tools', '예약큐.js');
const root = fs.mkdtempSync(path.join(os.tmpdir(), '예약큐-'));
const 연말 = fs.mkdtempSync(path.join(os.tmpdir(), '예약큐-연말-'));
test.after(() => { for (const dir of [root, 연말]) fs.rmSync(dir, { recursive: true, force: true }); });

function 편(name, prep, result, base = root) {
  const dir = path.join(base, name, '게시');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '준비.json'), JSON.stringify(prep));
  if (result) fs.writeFileSync(path.join(dir, '게시결과.json'), JSON.stringify(result));
}

function 돌리기(base, ...args) {
  return spawnSync(process.execPath, [tool, '--폴더', base, ...args], { encoding: 'utf8' });
}

function 큐(...args) {
  const r = 돌리기(root, ...args);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

const 판 = (brand, slot, 역할) => ({ 브랜드: brand, 슬롯: slot, 성격: '상시', 역할, 제목: `${brand} ${slot}`,
  판: [{ 계정: `${brand.toLowerCase()}-youtube`, 시각: `${slot}T21:00+09:00` }] });
// LAB 이번 주(10-19~10-25): 권위(게시됨) · 유입 · 권위 · 전환(보류) · 역할 없음 · 넷 밖의 값, 다음 주: 육성
편('lab-a', 판('LAB', '2026-10-20', '권위'), { 판: [{ 계정: 'lab-youtube', 상태: '게시됨' }] });
편('lab-b', 판('LAB', '2026-10-21', '유입'));
편('lab-c', 판('LAB', '2026-10-22', '권위'));
편('lab-e', 판('LAB', '2026-10-23', '전환'), { 판: [{ 계정: 'lab-youtube', 상태: '보류' }] });
편('lab-d', 판('LAB', '2026-10-24'));
편('lab-g', 판('LAB', '2026-10-25', '유입편'));
편('lab-f', 판('LAB', '2026-10-27', '육성'));
// synkbrief 편은 SHIFT 블로그 판을 함께 품는다 — 역할은 synkbrief에서만 센다
편('brief-a', { ...판('synkbrief', '2026-10-21', '전환'), 판: [{ 계정: 'synkbrief-instagram' }, { 계정: 'shift-naverblog' }] });
// yuhobuilds 이번 주는 권위가 하나 넘치고 전환이 비고, 다음 주는 목표 그대로다
['유입', '유입', '유입', '육성', '권위', '권위', '권위'].forEach((r, k) => 편(`yuho-${k}`, 판('yuhobuilds', `2026-10-${19 + k}`, r)));
const 다음주 = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
['유입', '유입', '유입', '육성', '권위', '권위', '전환'].forEach((r, k) => 편(`yuho-next-${k}`, 판('yuhobuilds', 다음주[k], r)));
// 연말 주(12-28~01-03): 한 날 두 편(하나는 판 하나만 예약된 「일부」), 해를 넘긴 슬롯, 슬롯 없는 편
편('a', { ...판('LAB', '2026-12-30', '유입'), 판: [{ 계정: 'lab-youtube' }, { 계정: 'lab-instagram' }] },
  { 판: [{ 계정: 'lab-youtube', 상태: '예약됨' }] }, 연말);
편('b', 판('LAB', '2026-12-30', '권위'), null, 연말);
편('c', 판('LAB', '2027-01-02', '전환'), null, 연말);
편('d', { 브랜드: 'LAB', 성격: '상시', 역할: '육성', 제목: '슬롯 없음', 판: [{ 계정: 'lab-youtube' }] }, null, 연말);

test('이번 주·다음 주(월~일 슬롯) 역할 수와 빈 역할·빈 날을 센다 — 보류 편은 빼고 역할 없음은 따로', () => {
  const r = JSON.parse(큐('--오늘', '2026-10-21', '--json'));
  assert.deepEqual(r.roleGoal, { 유입: 3, 육성: 1, 권위: 2, 전환: 1 });
  const [이번, 다음] = r.roles.LAB;
  assert.deepEqual([이번.from, 이번.to, 다음.from, 다음.to], ['2026-10-19', '2026-10-25', '2026-10-26', '2026-11-01']);
  assert.deepEqual(이번.count, { 유입: 1, 육성: 0, 권위: 2, 전환: 0 });
  assert.equal(이번.none, 2);
  assert.deepEqual(이번.short, { 유입: 2, 육성: 1, 전환: 1 });
  assert.deepEqual(이번.over, {});
  assert.equal(이번.open, 1, '10-21~10-25 가운데 보류 편만 있는 10-23');
  assert.deepEqual(다음.count, { 유입: 0, 육성: 1, 권위: 0, 전환: 0 });
  assert.equal(다음.open, 6);
  assert.deepEqual(r.roles.synkbrief[0].count, { 유입: 0, 육성: 0, 권위: 0, 전환: 1 });
  assert.equal(Object.hasOwn(r.roles, 'SHIFT'), false);
  assert.deepEqual(r.roleIssues.map((x) => [x.brand, x.role]), [['LAB', '유입편']]);
  assert.deepEqual(r.roles.yuhobuilds[0].short, { 전환: 1 });
  assert.deepEqual(r.roles.yuhobuilds[0].over, { 권위: 1 });
  assert.deepEqual([r.roles.yuhobuilds[1].short, r.roles.yuhobuilds[1].over, r.roles.yuhobuilds[1].open], [{}, {}, 0]);
});

test('글 출력에 브랜드별 이번 주·다음 주 줄, 편 줄의 역할, 역할 값 확인이 나온다', () => {
  const out = 큐('--오늘', '2026-10-21');
  assert.match(out, /^역할 · 한 주 목표 유입 3 · 육성 1 · 권위 2 · 전환 1/m);
  assert.match(out, /^LAB {9}이번 주 10-19~10-25 {2}유입 1 · 육성 0 · 권위 2 · 전환 0 · 역할 없음 2 · 빈 날 1 {2}→ 빈 역할 유입 2 · 육성 1 · 전환 1\(역할 없음 2편을 빼기 전\)$/m);
  assert.match(out, /^ {12}다음 주 10-26~11-01 {2}유입 0 · 육성 1 · 권위 0 · 전환 0 · 빈 날 6 {2}→ 빈 역할 유입 3 · 권위 2 · 전환 1$/m);
  assert.match(out, /^yuhobuilds {2}이번 주 .* → 빈 역할 전환 1 · 넘침 권위 \+1$/m);
  assert.match(out, /다음 주 10-26~11-01 {2}유입 3 · 육성 1 · 권위 2 · 전환 1 · 빈 날 0 {2}→ 빈 역할 없음$/m);
  assert.match(out, /2026-10-21 LAB 승인 대기 · LAB 2026-10-21 · 상시 · 역할 유입 · lab-b/);
  assert.match(out, /2026-10-24 LAB 승인 대기 · LAB 2026-10-24 · 상시 · lab-d/);
  assert.match(out, /\? 역할 값 확인: LAB · LAB 2026-10-25 · 「유입편」/);
  assert.doesNotMatch(out, /^SHIFT +이번 주/m);
});

test('일요일까지가 이번 주이고 월요일에 다음 주로 넘어간다', () => {
  const 일 = JSON.parse(큐('--오늘', '2026-10-25', '--json')).roles.LAB;
  assert.deepEqual([일[0].from, 일[0].to, 일[0].open, 일[1].from], ['2026-10-19', '2026-10-25', 0, '2026-10-26']);
  const 월 = JSON.parse(큐('--오늘', '2026-10-26', '--json')).roles.LAB;
  assert.deepEqual([월[0].from, 월[0].open, 월[1].from, 월[1].open], ['2026-10-26', 6, '2026-11-02', 7]);
});

test('해를 넘기는 주, 한 날 두 편, 「일부」 편을 세고 슬롯 없는 편은 역할 수에 넣지 않는다', () => {
  const r = 돌리기(연말, '--오늘', '2026-12-31', '--json');
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  const [이번, 다음] = j.roles.LAB;
  assert.deepEqual([이번.from, 이번.to, 다음.from], ['2026-12-28', '2027-01-03', '2027-01-04']);
  assert.deepEqual(이번.count, { 유입: 1, 육성: 0, 권위: 1, 전환: 1 });
  assert.equal(이번.open, 3, '12-31 · 01-01 · 01-03');
  assert.deepEqual(j.unslotted.map((x) => x.title), ['슬롯 없음']);
  assert.equal(j.brands.LAB.byDay['2027-01-02'].length, 1);
});

test('비축 일수는 그대로 내일부터 이어진 「채움」만 센다', () => {
  assert.equal(JSON.parse(큐('--오늘', '2026-10-19', '--json')).brands.LAB.reserve, 1);
});

test('--오늘 값이 실제 있는 날짜가 아니면 멈춘다', () => {
  for (const day of ['1026', '2026-13-45', '2026-02-29']) assert.equal(돌리기(root, '--오늘', day).status, 2, day);
});

// ── 서버 대조·계정별 칸·알림(10-21) ──
// 작업실 캐시(tools/lib/작업실읽기.cjs 모양)를 임시 파일로 넣어 대조를 본다. 텔레그램은 SYNK_HERMES_EXE=file:로 파일에 적는다.
const 대조 = fs.mkdtempSync(path.join(os.tmpdir(), '예약큐-대조-'));
test.after(() => fs.rmSync(대조, { recursive: true, force: true }));
fs.writeFileSync(path.join(대조, 'sns-계정.json'), JSON.stringify({ accounts: {
  'yuhobuilds-instagram': { platform: 'instagram', handle: '@yuhobuilds' }, 'yuhobuilds-youtube': { platform: 'youtube', handle: '@yuhobuilds' },
  'lab-youtube': { platform: 'youtube', handle: '@synkkorean', expectedChannelId: 'UClab' } } }));
const 서버 = { checkedAt: '2026-10-21T02:00:00Z', channels: [
  { id: 'ch-ig', platform: 'instagram', handle: 'yuhobuilds' }, { id: 'ch-yt', platform: 'youtube', handle: '@yuhobuilds' },
  { id: 'ch-lab', platform: 'youtube', handle: '@synkkorean', externalId: 'UClab' }],
jobs: [
  { id: 'job-ig', channelId: 'ch-ig', status: 'scheduled', reviewWaiting: true, scheduledAt: '2026-10-22T12:00:00Z' },
  { id: 'job-yt', channelId: 'ch-yt', status: 'scheduled', reviewWaiting: false, scheduledAt: '2026-10-22T12:00:00Z' }],
posts: [{ channelId: 'ch-lab', url: 'https://www.youtube.com/shorts/seen', publishedAt: '2026-10-19T12:05:00Z' }] };
const 캐시 = path.join(대조, '서버.json');
fs.writeFileSync(캐시, JSON.stringify(서버));
// 작업실로 건 편(인스타는 유호님 승인 전, 유튜브는 승인 뒤) · 서버에서 사라진 작업 · 크롬으로 건 편 둘(하나는 실제로 나갔고 하나는 안 나감) · 검사 「고칠 것」
편('yuho-server', { 브랜드: 'yuhobuilds', 슬롯: '2026-10-22', 성격: '상시', 역할: '권위', 제목: '작업실 편', 판: [
  { 계정: 'yuhobuilds-instagram', 시각: '2026-10-22T21:00+09:00' }, { 계정: 'yuhobuilds-youtube', 시각: '2026-10-22T21:00+09:00' }] },
{ 판: [{ 계정: 'yuhobuilds-instagram', 상태: '승인 대기', 방법: '작업실', 작업: 'job-ig' }, { 계정: 'yuhobuilds-youtube', 상태: '승인 대기', 방법: '작업실', 작업: 'job-yt' }] }, 대조);
편('yuho-gone', { 브랜드: 'yuhobuilds', 슬롯: '2026-10-23', 성격: '상시', 제목: '사라진 예약', 판: [{ 계정: 'yuhobuilds-youtube', 시각: '2026-10-23T21:00+09:00' }] },
  { 판: [{ 계정: 'yuhobuilds-youtube', 상태: '예약됨', 방법: '작업실', 작업: 'job-없음' }] }, 대조);
편('lab-seen', { 브랜드: 'LAB', 슬롯: '2026-10-19', 성격: '상시', 제목: '나간 편', 판: [{ 계정: 'lab-youtube', 시각: '2026-10-19T21:00+09:00' }] },
  { 판: [{ 계정: 'lab-youtube', 상태: '예약됨' }] }, 대조);
편('lab-missing', { 브랜드: 'LAB', 슬롯: '2026-10-20', 성격: '상시', 제목: '안 나간 편', 판: [{ 계정: 'lab-youtube', 시각: '2026-10-20T21:00+09:00' }] },
  { 판: [{ 계정: 'lab-youtube', 상태: '예약됨' }] }, 대조);
편('lab-fix', { 브랜드: 'LAB', 슬롯: '2026-10-23', 성격: '상시', 제목: '고칠 편', 판: [{ 계정: 'lab-youtube', 시각: '2026-10-23T21:00+09:00' }], 검사: { 결과: '고칠 것', 파일: [] } }, null, 대조);

function 대조큐(...args) {
  const r = spawnSync(process.execPath, [tool, '--폴더', 대조, '--서버캐시', 캐시, '--오늘', '2026-10-21', ...args],
    { encoding: 'utf8', env: { ...process.env, SYNK_QUEUE_DIR: path.join(대조, '상태'), SYNK_HERMES_EXE: 'file:' + path.join(대조, '보낸글.txt') } });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

test('작업실 판은 서버 작업 상태로 — 유호님 승인 전은 채움이 아니고, 서버에서 사라진 예약은 경고', () => {
  const r = JSON.parse(대조큐('--json'));
  const day = r.brands.yuhobuilds.byDay['2026-10-22'][0];
  assert.deepEqual(day.plates.map((p) => [p.account, p.state]), [['yuhobuilds-instagram', '승인 대기'], ['yuhobuilds-youtube', '예약됨']]);
  assert.equal(day.state, '일부');
  assert.equal(r.brands.yuhobuilds.byDay['2026-10-23'][0].plates[0].state, '서버에 없음');
  assert.ok(r.warnings.some((w) => w.startsWith('예약됨인데 서버에 없음: yuhobuilds-youtube · yuho-gone')));
  assert.equal(r.server.checkedAt, '2026-10-21T02:00:00.000Z');
});

test('크롬으로 건 판은 슬롯 2시간 뒤 실제 공개 게시물로 대조한다 — 있으면 게시됨, 없으면 「슬롯이 지났는데 나가지 않음」', () => {
  const r = JSON.parse(대조큐('--json', '--일수', '3'));
  assert.ok(r.warnings.some((w) => w.startsWith('슬롯이 지났는데 나가지 않음: lab-youtube · 2026-10-20 · lab-missing')));
  assert.ok(!r.warnings.some((w) => w.includes('lab-seen')));
});

test('계정별 줄·검사 「고칠 것」 표시', () => {
  const r = JSON.parse(대조큐('--json'));
  const yt = r.accounts.find((a) => a.account === 'yuhobuilds-youtube');
  assert.deepEqual(yt.byDay['2026-10-22'].map((p) => p.state), ['예약됨']);
  assert.equal(yt.reserve, 1, '내일(10-22) 예약됨, 10-23은 서버에 없음');
  assert.equal(r.accounts.find((a) => a.account === 'yuhobuilds-instagram').reserve, 0);
  assert.deepEqual(r.fix.map((x) => x.folder), ['lab-fix']);
  const out = 대조큐();
  assert.match(out, /^LAB {9}· {6}· {6}✗/m, '10-23 LAB 칸이 ✗');
  assert.match(out, /^yuhobuilds-youtube +· +● +○ +· +· +1일$/m);
  assert.match(out, /lab-fix · 검사 고칠 것/);
  assert.match(out, /! 예약됨인데 서버에 없음/);
});

test('--알림은 비축 2일 아래·대조 문제를 텔레그램 한 통으로, 같은 날 같은 내용은 다시 보내지 않는다', () => {
  const sentFile = path.join(대조, '보낸글.txt');
  fs.rmSync(sentFile, { force: true });
  fs.rmSync(path.join(대조, '상태'), { recursive: true, force: true });
  const first = JSON.parse(대조큐('--json', '--알림'));
  assert.equal(first.alert.sent, true);
  const text = fs.readFileSync(sentFile, 'utf8');
  // 브랜드 비축은 그 편의 판이 모두 예약돼야 센다 — 10-22 yuhobuilds는 인스타가 유호님 승인 전이라 0일
  assert.match(text, /^\[예약 비축\] 2026-10-21 · LAB 0일 · synkbrief 0일 · yuhobuilds 0일 \(목표 4일\)/);
  assert.match(text, /비축 부족: LAB · synkbrief · yuhobuilds/);
  assert.match(text, /작업실 승인 대기 계정: yuhobuilds-instagram/);
  assert.match(text, /! 예약됨인데 서버에 없음/);
  const again = JSON.parse(대조큐('--json', '--알림'));
  assert.deepEqual(again.alert, { sent: false, reason: 'same-today' });
  assert.equal(fs.readFileSync(sentFile, 'utf8').split('---').length, 2, '한 통만');
});
