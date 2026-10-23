'use strict';
// 1일 1편 예약 큐(tools/예약큐.js)의 표·편 줄·서버 대조·알림을 본다 — 10-23 한 주 역할 · 비축 목표를 없앤 뒤의 동작(결정 10-23).
// 임시 폴더의 가짜 편 폴더만 읽고 docs/마케팅은 건드리지 않는다. 알림은 SYNK_HERMES_EXE=file:로 파일에만 적는다.
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
// 10-21~22에 만든 옛 편처럼 준비.json에 「역할」이 남아 있다 — 넷 안의 값 · 없음 · 넷 밖의 값. 10-23부터 세지 않고 편 줄에 보이기만 한다.
편('lab-a', 판('LAB', '2026-10-20', '권위'), { 판: [{ 계정: 'lab-youtube', 상태: '게시됨' }] });
편('lab-b', 판('LAB', '2026-10-21', '유입'));
편('lab-c', 판('LAB', '2026-10-22', '권위'));
편('lab-e', 판('LAB', '2026-10-23', '전환'), { 판: [{ 계정: 'lab-youtube', 상태: '보류' }] });
편('lab-d', 판('LAB', '2026-10-24'));
편('lab-g', 판('LAB', '2026-10-25', '유입편'));
// synkbrief 편은 SHIFT 블로그 판을 함께 품는다 — synkbrief 줄과 SHIFT 줄 둘로 나온다
편('brief-a', { ...판('synkbrief', '2026-10-21', '전환'), 판: [{ 계정: 'synkbrief-instagram' }, { 계정: 'shift-naverblog' }] });
// 연말: 한 날 두 편(하나는 판 하나만 예약된 「일부」), 해를 넘긴 슬롯, 슬롯 없는 편
편('a', { ...판('LAB', '2026-12-30', '유입'), 판: [{ 계정: 'lab-youtube' }, { 계정: 'lab-instagram' }] },
  { 판: [{ 계정: 'lab-youtube', 상태: '예약됨' }] }, 연말);
편('b', 판('LAB', '2026-12-30', '권위'), null, 연말);
편('c', 판('LAB', '2027-01-02', '전환'), null, 연말);
편('d', { 브랜드: 'LAB', 성격: '상시', 역할: '육성', 제목: '슬롯 없음', 판: [{ 계정: 'lab-youtube' }] }, null, 연말);

test('--json에 한 주 역할 칸(roleGoal·roles·roleIssues)이 없고, 옛 편 준비.json의 역할은 편마다 그대로 남는다', () => {
  const r = JSON.parse(큐('--오늘', '2026-10-21', '--json'));
  for (const key of ['roleGoal', 'roles', 'roleIssues']) assert.equal(Object.hasOwn(r, key), false, key);
  const roles = (brand) => Object.fromEntries(Object.values(r.brands[brand].byDay).flat().map((x) => [x.folder, x.role]));
  assert.deepEqual(roles('LAB'), { 'lab-b': '유입', 'lab-c': '권위', 'lab-e': '전환', 'lab-d': null, 'lab-g': '유입편' });
  assert.deepEqual([roles('synkbrief'), roles('SHIFT')], [{ 'brief-a': '전환' }, { 'brief-a': '전환' }]);
});

test('글 출력에 한 주 목표·이번 주·다음 주·빈 역할·역할 값 확인 줄이 없고, 편 줄은 준비.json의 역할을 그대로 보인다', () => {
  const out = 큐('--오늘', '2026-10-21');
  assert.doesNotMatch(out, /목표|이번 주|다음 주|빈 역할|역할 없음|역할 값 확인/);
  assert.match(out, /^브랜드 +10-21 {2}10-22 {2}10-23 {2}10-24 {2}10-25 {2}비축$/m);
  assert.match(out, /2026-10-21 LAB 승인 대기 · LAB 2026-10-21 · 상시 · 역할 유입 · lab-b/);
  assert.match(out, /2026-10-24 LAB 승인 대기 · LAB 2026-10-24 · 상시 · lab-d/);
  assert.match(out, /2026-10-25 LAB 승인 대기 · LAB 2026-10-25 · 상시 · 역할 유입편 · lab-g/);
});

test('해를 넘기는 날짜, 한 날 두 편(「일부」 하나), 슬롯 없는 편', () => {
  const r = 돌리기(연말, '--오늘', '2026-12-29', '--json');
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.deepEqual(j.range, ['2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  assert.deepEqual(j.brands.LAB.byDay['2026-12-30'].map((x) => x.state).sort(), ['승인 대기', '일부']);
  assert.equal(j.brands.LAB.byDay['2027-01-02'].length, 1);
  assert.equal(j.brands.LAB.reserve, 0, '12-30은 「일부」라 채움이 아니다');
  assert.deepEqual(j.unslotted.map((x) => x.title), ['슬롯 없음']);
  assert.match(돌리기(연말, '--오늘', '2026-12-29').stdout, /^LAB {9}· {6}◐ {6}· {6}· {6}○ {6}0일$/m);
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

test('--알림은 대조 경고·작업실 승인 대기·검사 「고칠 것」을 비축 목표 없이 한 통으로, 같은 날 같은 내용은 다시 보내지 않는다', () => {
  const sentFile = path.join(대조, '보낸글.txt');
  fs.rmSync(sentFile, { force: true });
  fs.rmSync(path.join(대조, '상태'), { recursive: true, force: true });
  const first = JSON.parse(대조큐('--json', '--알림'));
  assert.equal(first.alert.sent, true);
  const text = fs.readFileSync(sentFile, 'utf8');
  assert.match(text, /^\[게시 큐\] 2026-10-21\n/);
  assert.doesNotMatch(text, /비축|목표/);
  assert.match(text, /^작업실 승인 대기 계정: yuhobuilds-instagram — /m);
  assert.match(text, /^! 예약됨인데 서버에 없음: yuhobuilds-youtube · yuho-gone$/m);
  assert.match(text, /^! 슬롯이 지났는데 나가지 않음: lab-youtube · 2026-10-20 · lab-missing$/m);
  assert.match(text, /^검사 「고칠 것」 편: lab-fix$/m);
  const again = JSON.parse(대조큐('--json', '--알림'));
  assert.deepEqual(again.alert, { sent: false, reason: 'same-today' });
  assert.equal(fs.readFileSync(sentFile, 'utf8').split('---').length, 2, '한 통만');
});

// ── 비축 목표 없앰(10-23): 비축이 0일이어도 알릴 것이 없으면 보내지 않는다. 서버 캐시 없이(--폴더만) 돌린다. ──
const 조용 = fs.mkdtempSync(path.join(os.tmpdir(), '예약큐-조용-'));
test.after(() => fs.rmSync(조용, { recursive: true, force: true }));

function 알림만(base, today) {
  const sentFile = path.join(base, '보낸글.txt');
  const r = spawnSync(process.execPath, [tool, '--폴더', base, '--오늘', today, '--json', '--알림'],
    { encoding: 'utf8', env: { ...process.env, SYNK_QUEUE_DIR: path.join(base, '상태'), SYNK_HERMES_EXE: 'file:' + sentFile } });
  assert.equal(r.status, 0, r.stderr);
  return { report: JSON.parse(r.stdout), sent: fs.existsSync(sentFile) ? fs.readFileSync(sentFile, 'utf8') : null };
}

test('--알림은 비축이 0일이어도 경고·승인 대기·고칠 것이 없으면 보내지 않고, 경고가 생기면 보낸다 — 보류 편은 검사가 「고칠 것」이어도 세지 않는다', () => {
  const base = path.join(조용, '비축0');
  // 슬롯이 아직 안 온 LAB 편(게시결과 없음, 옛 역할 칸 그대로) · 보류한 synkbrief 편(검사 「고칠 것」)
  편('quiet-lab', 판('LAB', '2026-10-20', '유입'), null, base);
  편('quiet-held', { ...판('synkbrief', '2026-10-21'), 검사: { 결과: '고칠 것', 파일: [] } }, { 판: [{ 계정: 'synkbrief-youtube', 상태: '보류' }] }, base);
  const quiet = 알림만(base, '2026-10-19');
  assert.deepEqual(['LAB', 'synkbrief', 'yuhobuilds'].map((b) => quiet.report.brands[b].reserve), [0, 0, 0]);
  assert.deepEqual([quiet.report.warnings, quiet.report.fix, quiet.report.alert], [[], [], { sent: false, reason: 'nothing' }]);
  assert.equal(quiet.sent, null, '보내지 않았다');
  // 이틀 뒤에는 10-20 슬롯이 지났는데 예약도 게시도 안 된 LAB 편이 경고가 된다(보류한 편은 경고도 고칠 것도 아니다)
  const late = 알림만(base, '2026-10-21');
  assert.equal(late.report.alert.sent, true);
  assert.equal(late.sent, '[게시 큐] 2026-10-21\n! 슬롯이 지났는데 예약도 게시도 안 됨: lab-youtube · 2026-10-20 · quiet-lab\n---\n');
});

test('--알림은 작업실 승인 대기나 검사 「고칠 것」 하나만 있어도 보낸다', () => {
  const wait = path.join(조용, '승인대기');
  편('wait', 판('yuhobuilds', '2026-10-22'), { 판: [{ 계정: 'yuhobuilds-youtube', 상태: '승인 대기', 방법: '작업실', 작업: 'job-1' }] }, wait);
  assert.equal(알림만(wait, '2026-10-21').sent,
    '[게시 큐] 2026-10-21\n작업실 승인 대기 계정: yuhobuilds-youtube — 텔레그램으로 받은 검토 링크를 누르면 예약이 걸려요\n---\n');
  // 고칠 것 편이 SHIFT 블로그 판을 품으면 synkbrief 줄과 SHIFT 줄 둘로 잡히지만 알림에는 한 번만 적는다
  const fix = path.join(조용, '고칠것');
  편('fix', { ...판('synkbrief', '2026-10-22'), 판: [{ 계정: 'synkbrief-instagram' }, { 계정: 'shift-naverblog' }], 검사: { 결과: '고칠 것', 파일: [] } }, null, fix);
  const r = 알림만(fix, '2026-10-21');
  assert.deepEqual(r.report.fix.map((x) => x.brand).sort(), ['SHIFT', 'synkbrief']);
  assert.equal(r.sent, '[게시 큐] 2026-10-21\n검사 「고칠 것」 편: fix\n---\n');
});

test('--알림은 같은 날 내용이 A → A·B → A로 바뀌었다 돌아와도 A를 다시 보내지 않는다(10-23 GPT 검수)', () => {
  const base = path.join(조용, '되돌아옴');
  편('late-a', 판('LAB', '2026-10-20'), null, base);
  assert.equal(알림만(base, '2026-10-21').report.alert.sent, true, 'A 처음');
  편('late-b', 판('yuhobuilds', '2026-10-20'), null, base);
  assert.equal(알림만(base, '2026-10-21').report.alert.sent, true, 'A·B 처음');
  fs.rmSync(path.join(base, 'late-b'), { recursive: true, force: true });
  const back = 알림만(base, '2026-10-21');
  assert.deepEqual(back.report.alert, { sent: false, reason: 'same-today' }, 'A로 돌아온 같은 날');
  assert.equal(back.sent.split('\n---\n').filter(Boolean).length, 2, '보낸 글은 두 통');
  // 다음 날에는 같은 A도 새로 보낸다
  assert.equal(알림만(base, '2026-10-22').report.alert.sent, true, '다음 날 A');
});
