'use strict';
// 1일 1편 예약 큐(tools/예약큐.js)의 표·편 줄·서버 대조·알림을 본다 — 10-23 한 주 역할을 없앤 뒤의 동작(결정 10-23)과
// 10-26 매일 판 줄 · 비축 목표 4일 · 21시 비축 알림(결정 10-26, 맨 아래 절).
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

// 11-08부터 걸 판이 남은 편은 미학 맹검(⑱)을 통과해야 한다 — 시험 편은 「그대로 냄」 맹검 기록을 기본으로 둔다(⑱ 자체는 맨 아래 시험, 맹검 = null이면 기록 없음).
const 통과맹검 = { 낱장: [{ 번호: '01', 판정: '그대로 냄', 점수: 8 }], 빠짐: [] };
function 편(name, prep, result, base = root, 맹검 = 통과맹검) {
  const dir = path.join(base, name, '게시');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '준비.json'), JSON.stringify(prep));
  if (result) fs.writeFileSync(path.join(dir, '게시결과.json'), JSON.stringify(result));
  if (맹검) fs.writeFileSync(path.join(dir, '미학맹검.json'), JSON.stringify(맹검));
}
// 11-12부터 ⑱ 기본은 권고(막지 않음, tools/lib/미학관문.js) — 옛 막음으로 「고칠 것」을 보는 시험만 SYNK_미학관문=막음을 켠다(도구 자식 프로세스가 물려받는다)
function 미학막음(t) {
  const 앞 = process.env.SYNK_미학관문;
  process.env.SYNK_미학관문 = '막음';
  t.after(() => { if (앞 === undefined) delete process.env.SYNK_미학관문; else process.env.SYNK_미학관문 = 앞; });
}

function 돌리기(base, ...args) {
  return spawnSync(process.execPath, [tool, '--폴더', base, ...args], { encoding: 'utf8' });
}

function 큐(...args) {
  const r = 돌리기(root, ...args);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

test('예약 큐는 옛 영상의 오디오 실측을 재검사로 표시하고 미달과 정상 파일을 구분한다', t => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), '예약큐-오디오-')), base = path.join(repo, 'docs', '마케팅');
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  for (const [name, rate] of [['old', null], ['low', 308462], ['changed', 308462], ['good', 333421]]) {
    const nameOnDisk = name + '.mp4';
    fs.writeFileSync(path.join(repo, nameOnDisk), 'test');
    const stat = fs.statSync(path.join(repo, nameOnDisk));
    const file = { 경로: nameOnDisk, 바이트: name === 'changed' ? 1 : stat.size, 수정: new Date(stat.mtimeMs).toISOString(),
      ...(rate && { sha256: '1'.repeat(64), 오디오비트레이트: [{ channels: 2, actualBps: rate }] }) };
    편(name, { ...판('synkbrief', '2026-11-06'), 검사: { 결과: '확인할 것', 파일: [file] } }, null, base);
  }
  const result = 돌리기(base, '--오늘', '2026-11-05', '--json');
  assert.equal(result.status, 0, result.stderr);
  const fixes = JSON.parse(result.stdout).fix;
  assert.deepEqual(Object.fromEntries(fixes.map(f => [f.folder, f.check])), { old: '다시 검사', low: '고칠 것', changed: '다시 검사' });
});

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

test('--알림은 대조 경고·검사 「고칠 것」을 비축 목표 없이 한 통으로(승인 대기 줄은 10-30부터 넣지 않음), 같은 날 같은 내용은 다시 보내지 않는다', () => {
  const sentFile = path.join(대조, '보낸글.txt');
  fs.rmSync(sentFile, { force: true });
  fs.rmSync(path.join(대조, '상태'), { recursive: true, force: true });
  const first = JSON.parse(대조큐('--json', '--알림'));
  assert.equal(first.alert.sent, true);
  const text = fs.readFileSync(sentFile, 'utf8');
  assert.match(text, /^\[게시 큐\] 2026-10-21\n/);
  assert.doesNotMatch(text, /비축|목표/);
  assert.doesNotMatch(text, /승인 대기|검토 링크/);
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

test('--알림은 작업실 승인 대기만 있으면 보내지 않고(10-30 「텔레그램으로 검수승인 안해도 돼」), 검사 「고칠 것」 하나만 있어도 보낸다', () => {
  const wait = path.join(조용, '승인대기');
  편('wait', 판('yuhobuilds', '2026-10-22'), { 판: [{ 계정: 'yuhobuilds-youtube', 상태: '승인 대기', 방법: '작업실', 작업: 'job-1' }] }, wait);
  const w = 알림만(wait, '2026-10-21');
  assert.deepEqual([w.report.alert, w.sent], [{ sent: false, reason: 'nothing' }, null]);
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

// ── 매일 판 줄 · 비축 목표 4일(10-26 유호님 「하루에 모든 계정에 하나씩 … 며칠 전에 이미 예약으로 준비해 둬야 해」) ──
// sns-계정.json의 dailyLine · dailyBlocked · dailyOff로 줄 표를 내고, 21시 뒤 하루 한 번 비축이 4일보다 모자라면 알린다.
const 매일 = fs.mkdtempSync(path.join(os.tmpdir(), '예약큐-매일-'));
test.after(() => fs.rmSync(매일, { recursive: true, force: true }));
const 매일계정 = { accounts: {
  'lab-youtube': { brand: 'LAB', platform: 'youtube', dailyLine: 'LAB 영어' },
  'lab-instagram': { brand: 'LAB', platform: 'instagram', dailyLine: 'LAB 몽골' },
  'lab-tiktok': { brand: 'LAB', platform: 'tiktok', dailyLine: 'LAB 몽골' },
  'synkbrief-youtube': { brand: 'SHIFT', platform: 'youtube', dailyLine: 'synkbrief' },
  'shift-naverblog': { brand: 'SHIFT', platform: 'naver-blog', dailyLine: 'synkbrief' },
  'yuhobuilds-x': { brand: 'SHIFT', platform: 'x', dailyLine: 'yuhobuilds', dailyBlocked: 'ego 로그아웃 — 유호님 로그인' },
  'lab-us-youtube': { brand: 'LAB', platform: 'youtube', dailyOff: '나라별 LAB — 유호님 답 전' } } };

function 매일판(name, files) {
  const base = path.join(매일, name);
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, 'sns-계정.json'), JSON.stringify(매일계정));
  for (const [folder, prep, result] of files) 편(folder, prep, result, base);
  return base;
}

function 매일큐(base, args, env = {}) {
  const r = spawnSync(process.execPath, [tool, '--폴더', base, '--json', ...args],
    { encoding: 'utf8', env: { ...process.env, SYNK_QUEUE_DIR: path.join(base, '상태'), SYNK_HERMES_EXE: 'file:' + path.join(base, '보낸글.txt'), ...env } });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const 한편 = (brand, slot, plates) => ({ 브랜드: brand, 슬롯: slot, 성격: '상시', 제목: `${brand} ${slot}`, 판: plates.map((계정) => ({ 계정, 시각: `${slot}T21:00+09:00` })) });
const 결과 = (rows) => ({ 판: rows.map(([계정, 상태]) => ({ 계정, 상태 })) });
const 기본편 = [
  // LAB 영어: 10-22·10-23 예약됨, 10-24 승인 대기 → 비축 2 · 만듦 3
  ['en-22', 한편('LAB', '2026-10-22', ['lab-youtube']), 결과([['lab-youtube', '예약됨']])],
  ['en-23', 한편('LAB', '2026-10-23', ['lab-youtube']), 결과([['lab-youtube', '예약됨']])],
  ['en-24', 한편('LAB', '2026-10-24', ['lab-youtube']), 결과([['lab-youtube', '승인 대기']])],
  // LAB 몽골: 10-22 두 계정 다 예약됨, 10-23 여러 장 편이라 인스타만 → 틱톡 칸이 비어 비축 1
  ['mn-22', 한편('LAB', '2026-10-22', ['lab-instagram', 'lab-tiktok']), 결과([['lab-instagram', '예약됨'], ['lab-tiktok', '예약됨']])],
  ['mn-23', 한편('LAB', '2026-10-23', ['lab-instagram']), 결과([['lab-instagram', '예약됨']])],
  // synkbrief: 블로그 판은 영상 판이 예약·게시면 채움 — 10-22는 ●, 10-23은 영상이 승인 대기라 ○
  ['brief-22', 한편('synkbrief', '2026-10-22', ['synkbrief-youtube', 'shift-naverblog']), 결과([['synkbrief-youtube', '예약됨']])],
  ['brief-23', 한편('synkbrief', '2026-10-23', ['synkbrief-youtube', 'shift-naverblog']), 결과([['synkbrief-youtube', '승인 대기']])],
];

test('매일 판 줄 표 — 줄 비축은 그 줄의 모든 계정이 예약·게시인 날, 블로그는 영상 판을 따르고, 막힌 계정은 셈에서 빠진다', () => {
  const r = 매일큐(매일판('줄', 기본편), ['--오늘', '2026-10-21']);
  assert.equal(r.lead, 4);
  assert.deepEqual(r.lines.map((l) => [l.line, l.reserve, l.made]), [['LAB 영어', 2, 3], ['LAB 몽골', 1, 1], ['synkbrief', 1, 2]]);
  const mn = r.lines.find((l) => l.line === 'LAB 몽골');
  assert.deepEqual([mn.byDay['2026-10-22'].mark, mn.byDay['2026-10-23'].mark, mn.byDay['2026-10-24'].mark], ['●', '◐', '·']);
  assert.deepEqual(mn.byDay['2026-10-23'].cells, { 'lab-instagram': '채움', 'lab-tiktok': '빔' });
  const brief = r.lines.find((l) => l.line === 'synkbrief');
  assert.deepEqual([brief.byDay['2026-10-22'].mark, brief.byDay['2026-10-23'].mark], ['●', '○']);
  assert.equal(r.reserve, 1, '맨 위 비축은 줄 비축의 최솟값');
  assert.deepEqual(r.blocked, [{ account: 'yuhobuilds-x', reason: 'ego 로그아웃 — 유호님 로그인', line: 'yuhobuilds' }]);
  assert.equal(r.lines.some((l) => l.line === 'yuhobuilds'), false, '막힌 계정만 있는 줄은 셈하지 않는다');
  // 매일 판 계정은 편이 없어도 계정별 줄이 있고, 매일 판 밖 계정은 편이 없으면 나오지 않는다
  const accounts = r.accounts.map((x) => x.account);
  assert.ok(accounts.includes('lab-tiktok') && !accounts.includes('lab-us-youtube') && !accounts.includes('yuhobuilds-x'));
  const out = spawnSync(process.execPath, [tool, '--폴더', path.join(매일, '줄'), '--오늘', '2026-10-21'], { encoding: 'utf8' }).stdout;
  assert.match(out, /^비축 1일 \/ 목표 4일\(LAB 줄 5일\) · 매일 판 줄/m);
  assert.match(out, /^ {2}LAB 몽골 빈 칸: 10-23 lab-tiktok 만든 편 없음 · 10-24 만든 편 없음 · 10-25 만든 편 없음$/m);
  assert.match(out, /^ {2}막혀 셈에서 뺀 계정: yuhobuilds-x\(ego 로그아웃 — 유호님 로그인\)$/m);
});

test('비축 알림은 21시 뒤 하루 한 번, 그 줄 목표(LAB 5일 · 그 밖 4일)보다 모자랄 때만 줄마다 빈 칸을 보낸다', () => {
  const base = 매일판('알림', 기본편);
  const sent = () => (fs.existsSync(path.join(base, '보낸글.txt')) ? fs.readFileSync(path.join(base, '보낸글.txt'), 'utf8') : '');
  assert.deepEqual(매일큐(base, ['--지금', '2026-10-21T20:59+09:00', '--알림']).reserveAlert, { sent: false, reason: 'before-hour' });
  const first = 매일큐(base, ['--지금', '2026-10-21T21:30+09:00', '--알림']).reserveAlert;
  assert.equal(first.sent, true);
  assert.equal(first.text, [
    '[비축] 2026-10-21 · 목표 4일(LAB 줄 5일) · 지금 1일',
    'LAB 영어 2일 — 10-24 승인·예약 전 · 10-25 만든 편 없음 · 10-26 만든 편 없음',
    'LAB 몽골 1일 — 10-23 lab-tiktok 만든 편 없음 · 10-24 만든 편 없음 · 10-25 만든 편 없음 · 10-26 만든 편 없음',
    'synkbrief 1일 — 10-23 승인·예약 전 · 10-24 만든 편 없음 · 10-25 만든 편 없음',
    '「만든 편 없음」은 19:30 후보에서 번호를 골라 주시면 07시가 만들고, 「승인·예약 전」은 검토 링크 승인이나 14시 「올려」로 채워져요'].join('\n'));
  assert.ok(sent().includes('[비축] 2026-10-21'));
  assert.deepEqual(매일큐(base, ['--지금', '2026-10-21T23:00+09:00', '--알림']).reserveAlert, { sent: false, reason: 'same-today' });
  // 다음 날 21시 뒤에는 다시 본다
  assert.equal(매일큐(base, ['--지금', '2026-10-22T21:10+09:00', '--알림']).reserveAlert.sent, true);
  // 나흘이 찼으면 4일 목표 줄(synkbrief)은 조용하고, LAB 줄(11-10부터 5일 목표)만 닷새째 빈 칸을 보낸다
  const days = (list) => list.flatMap((d) => [
    [`en-${d}`, 한편('LAB', `2026-10-${d}`, ['lab-youtube']), 결과([['lab-youtube', '게시됨']])],
    [`mn-${d}`, 한편('LAB', `2026-10-${d}`, ['lab-instagram', 'lab-tiktok']), 결과([['lab-instagram', '예약됨'], ['lab-tiktok', '예약됨']])],
    [`brief-${d}`, 한편('synkbrief', `2026-10-${d}`, ['synkbrief-youtube', 'shift-naverblog']), 결과([['synkbrief-youtube', '예약됨']])]]);
  const four = 매일큐(매일판('나흘', days(['22', '23', '24', '25'])), ['--지금', '2026-10-21T21:30+09:00', '--알림']);
  assert.equal(four.reserve, 4);
  assert.equal(four.reserveAlert.sent, true);
  assert.equal(four.reserveAlert.text.split('\n').slice(0, 3).join('\n'), ['[비축] 2026-10-21 · 목표 4일(LAB 줄 5일) · 지금 4일', 'LAB 영어 4일 — 10-26 만든 편 없음', 'LAB 몽골 4일 — 10-26 만든 편 없음'].join('\n'));
  assert.equal(four.reserveAlert.text.includes('synkbrief'), false);
  // 닷새가 찼으면 보내지 않는다(--알림은 --일수를 안 줘도 오늘 + 5일을 본다)
  const r = 매일큐(매일판('가득', days(['22', '23', '24', '25', '26'])), ['--지금', '2026-10-21T21:30+09:00', '--알림']);
  assert.equal(r.reserve, 5);
  assert.equal(r.range.length, 6);
  assert.deepEqual(r.reserveAlert, { sent: false, reason: 'enough' });
});

test('보류 판(버린 편)의 옛 검사 「고칠 것」은 같은 날 다른 편 칸을 막지 않는다 — 10-30 B2 보류 + B15', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), '예약큐-보류칸-'));
  try {
    편('held', { ...판('synkbrief', '2026-10-30'), 검사: { 결과: '고칠 것', 파일: [] } }, { 판: [{ 계정: 'synkbrief-youtube', 상태: '보류' }] }, base);
    편('next', 판('synkbrief', '2026-10-30'), null, base);
    const r = 돌리기(base, '--오늘', '2026-10-30');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^synkbrief +○/m, '브랜드 줄은 승인 대기(○)');
    assert.match(r.stdout, /^synkbrief-youtube +○/m, '계정 줄도 ○');
    assert.doesNotMatch(r.stdout, /^synkbrief +✗/m);
    // 보류 판만 남으면 그날은 ×(새 편 칸)
    fs.rmSync(path.join(base, 'next'), { recursive: true, force: true });
    assert.match(돌리기(base, '--오늘', '2026-10-30').stdout, /^synkbrief +×/m);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('걸린 줄 뒤에 보류를 덧붙인 판(취소됨 → 예약됨 → 보류 — 11-09 「11월 14일까지 전부 삭제」)은 거둔 칸이다 — 채움(●)이 아니라 새 편 칸(11-11 Fable 5.2 검수 P1-2)', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), '예약큐-거둔칸-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  편('pulled', 판('synkbrief', '2026-11-11'), { 판: [
    { 계정: 'synkbrief-youtube', 상태: '취소됨', 작업: 'job-1' },
    { 계정: 'synkbrief-youtube', 상태: '예약됨', 시각: '2026-11-11T21:00+09:00' },
    { 계정: 'synkbrief-youtube', 상태: '보류', 보류: '예약을 거뒀다' }] }, base);
  const r = 돌리기(base, '--오늘', '2026-11-11');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^synkbrief-youtube +×/m, '거둔 칸은 새 편 칸 — 「예약됨」으로 읽으면 그날 새 편이 안 걸린다');
  assert.doesNotMatch(r.stdout, /^synkbrief-youtube +●/m);
});

test('⑱ 돌림 원본 — 씨앗 판이 나간 뒤 다시 검사해 기록에 판본 영상만 남아도, 씨앗 영상을 맹검한 기록은 「맹검 뒤 영상 바뀜」으로 헛막지 않는다(11-11 Fable 5.2 검수 P1-1 「화날때」)', (t) => {
  미학막음(t);
  // 저장소 꼴 임시 마당 — 검사 기록의 경로는 --폴더의 두 단계 위 기준이라(checkOf), docs/마케팅 아래에 편을 두고 실제 파일 값을 적는다.
  // 그러지 않으면 「다시 검사」로 빠져 ⑱ 까닭이 늘 비고, 이 시험이 옛 코드에서도 통과한다(11-11 Fable 5.2 다시 검수 P2-2).
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), '예약큐-돌림맹검-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const base = path.join(repo, 'docs', '마케팅');
  fs.mkdirSync(path.join(repo, 'tools'), { recursive: true }); // 게시묶음.repoOf가 이 마당을 저장소 뿌리로 잡게
  const 맹검of = (영상) => ({ 만든때: new Date(Date.now() + 5000).toISOString(), 영상: [영상], 낱장: [{ 번호: '01', 판정: '그대로 냄', 점수: 8 }], 빠짐: [] });
  const 원본 = (name, 맹검영상) => {
    const dir = path.join(base, name, '게시');
    fs.mkdirSync(path.join(dir, 'seed'), { recursive: true });
    fs.mkdirSync(path.join(dir, '판본', 'MX'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'seed', 'video.mp4'), 'seed');
    const mx = path.join(dir, '판본', 'MX', 'video.mp4');
    fs.writeFileSync(mx, 'mx');
    const st = fs.statSync(mx);
    const prep = { 브랜드: 'LAB', 슬롯: '2026-11-12', 성격: '상시', 제목: name,
      판: [{ 계정: 'lab-instagram', 시각: '2026-11-05T21:00+09:00', 파일: 'seed/video.mp4' },
        { 계정: 'lab-mx-youtube', 시각: '2026-11-12T13:00:00-06:00', 파일: '판본/MX/video.mp4', 돌림: true }],
      돌림: { 판본: { MX: { 파일: '게시/판본/MX/video.mp4' } } },
      // 돌림 판을 단 뒤 다시 검사한 기록 — 이미 나간 씨앗 판은 다시 재지 않아 판본 영상만 남는다(지금 파일과 맞는 값)
      검사: { 결과: '확인할 것', 파일: [{ 경로: `docs/마케팅/${name}/게시/판본/MX/video.mp4`, 바이트: st.size, 수정: new Date(st.mtimeMs).toISOString(),
        sha256: '1'.repeat(64), 오디오비트레이트: [{ channels: 2, actualBps: 333421 }] }] } };
    편(name, prep, { 판: [{ 계정: 'lab-instagram', 상태: '게시됨' }] }, base, 맹검of(맹검영상));
  };
  // 씨앗 영상으로 맹검받은 원본 — 막히면 안 된다
  원본('LAB_원본', { 이름: 'video.mp4', 파일: '게시/seed/video.mp4' });
  // 견줌: 이 편의 어느 판 영상도 아닌 영상으로 맹검받은 원본 — 이쪽은 막혀야 ⑱이 실제로 돈 것이다
  원본('LAB_다른영상', { 이름: 'other.mp4', 파일: '게시/other.mp4' });
  const r = 돌리기(base, '--오늘', '2026-11-11', '--일수', '7', '--json');
  assert.equal(r.status, 0, r.stderr);
  const fix = Object.fromEntries(JSON.parse(r.stdout).fix.map((x) => [x.folder, `${x.check}:${x.checkWhy}`]));
  assert.deepEqual(fix, { LAB_다른영상: '고칠 것:맹검 뒤 영상 바뀜' }, '씨앗 영상을 맹검한 원본은 안 막고, 다른 영상을 맹검한 편만 막는다');
});
test('오늘 빈 계정 — 오늘 칸이 예약·게시 전인 계정을 줄로 보이고, 알림은 17시 · 21시 뒤 한 번씩, 다 차면 보내지 않는다', () => {
  // 10-23: LAB 영어 예약됨(채움) · LAB 몽골 인스타만 예약됨(틱톡 빔) · synkbrief 영상 승인 대기(블로그도 영상을 따라 승인·예약 전)
  const base = 매일판('오늘빈계정', 기본편);
  const r = 매일큐(base, ['--오늘', '2026-10-23']);
  assert.deepEqual(r.todayGaps.map((g) => [g.line, g.account, g.why]), [
    ['LAB 몽골', 'lab-tiktok', '만든 편 없음'],
    ['synkbrief', 'synkbrief-youtube', '승인·예약 전'],
    ['synkbrief', 'shift-naverblog', '승인·예약 전']]);
  const out = spawnSync(process.execPath, [tool, '--폴더', base, '--오늘', '2026-10-23'], { encoding: 'utf8' }).stdout;
  assert.match(out, /^ {2}오늘\(10-23\) 빈 계정: LAB 몽골 — lab-tiktok 만든 편 없음 · synkbrief — synkbrief-youtube 승인·예약 전, shift-naverblog 승인·예약 전$/m);
  assert.deepEqual(매일큐(base, ['--지금', '2026-10-23T16:59+09:00', '--알림']).todayAlert, { sent: false, reason: 'before-hour' });
  const first = 매일큐(base, ['--지금', '2026-10-23T17:30+09:00', '--알림']).todayAlert;
  assert.equal(first.sent, true);
  assert.equal(first.text, [
    '[오늘 빈 계정] 2026-10-23 · 3곳이 아직 예약·게시 전',
    'LAB 몽골 — lab-tiktok 만든 편 없음',
    'synkbrief — synkbrief-youtube 승인·예약 전, shift-naverblog 승인·예약 전',
    '막혀 못 올리는 계정: yuhobuilds-x(ego 로그아웃 — 유호님 로그인)',
    '오늘 안에 채워요 — 관문을 못 넘은 칸은 가장 나은 판으로(제작 절차 「매일 한 편」), 「승인·예약 전」은 검토 링크 승인이나 「올려」로'].join('\n'));
  assert.deepEqual(매일큐(base, ['--지금', '2026-10-23T18:00+09:00', '--알림']).todayAlert, { sent: false, reason: 'same-window' });
  assert.equal(매일큐(base, ['--지금', '2026-10-23T21:05+09:00', '--알림']).todayAlert.sent, true, '21시 뒤 한 번 더');
  assert.deepEqual(매일큐(base, ['--지금', '2026-10-23T23:30+09:00', '--알림']).todayAlert, { sent: false, reason: 'same-window' });
  // 10-22는 모든 줄이 예약 · 게시라 보내지 않고 줄도 없다
  const full = 매일큐(base, ['--지금', '2026-10-22T21:30+09:00', '--알림']);
  assert.deepEqual(full.todayGaps, []);
  assert.deepEqual(full.todayAlert, { sent: false, reason: 'filled' });
});

test('dailyDays 계정은 그 요일에만 — 다른 요일 빈 칸은 쉼(–)으로 비축에 들고 빈 칸이 아니며, 쉬는 날에 편이 있으면 그 편대로 센다', () => {
  const base = path.join(매일, '요일');
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, 'sns-계정.json'), JSON.stringify({ accounts: {
    'yuhobuilds-youtube': { brand: 'yuhobuilds', platform: 'youtube', dailyLine: 'yuhobuilds', dailyDays: '월수금' },
    'yuhobuilds-instagram': { brand: 'yuhobuilds', platform: 'instagram', dailyLine: 'yuhobuilds', dailyDays: '월수금' } } }));
  // 오늘 10-28(수) · 10-29 목 쉼 · 10-30 금 두 계정 예약됨 · 10-31 토 유튜브만 승인 대기 · 11-01 일 쉼
  편('y-30', 한편('yuhobuilds', '2026-10-30', ['yuhobuilds-youtube', 'yuhobuilds-instagram']), 결과([['yuhobuilds-youtube', '예약됨'], ['yuhobuilds-instagram', '예약됨']]), base);
  편('y-31', 한편('yuhobuilds', '2026-10-31', ['yuhobuilds-youtube']), 결과([['yuhobuilds-youtube', '승인 대기']]), base);
  // 쉬는 날(일)의 보류 판은 나가지도 채울 것도 없으니 쉼 — 「새 편 칸」으로 올라가지 않는다
  편('y-01', 한편('yuhobuilds', '2026-11-01', ['yuhobuilds-youtube']), 결과([['yuhobuilds-youtube', '보류']]), base);
  const r = 매일큐(base, ['--오늘', '2026-10-28']);
  const y = r.lines.find((l) => l.line === 'yuhobuilds');
  assert.deepEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'].map((d) => y.byDay[d].mark), ['–', '●', '○', '–']);
  assert.deepEqual(y.byDay['2026-10-31'].cells, { 'yuhobuilds-youtube': '만듦', 'yuhobuilds-instagram': '쉼' });
  assert.deepEqual([y.reserve, y.made], [2, 4]);
  assert.equal(r.brands.yuhobuilds.reserve, 2);
  const row = (a) => r.accounts.find((x) => x.account === a);
  assert.deepEqual([row('yuhobuilds-youtube').reserve, row('yuhobuilds-instagram').reserve], [2, 4]);
  const out = spawnSync(process.execPath, [tool, '--폴더', base, '--오늘', '2026-10-28'], { encoding: 'utf8' }).stdout;
  assert.match(out, /^ {2}yuhobuilds 빈 칸: 10-31 승인·예약 전$/m, '쉬는 요일은 빈 칸에 나오지 않는다');
  assert.match(out, /^yuhobuilds-instagram +· +– +● +– +– +4일$/m);
  assert.match(out, /^yuhobuilds +· +– +● +○ +– +2일$/m, '브랜드 표도 쉬는 날은 –');
  assert.match(spawnSync(process.execPath, [tool, '--폴더', base, '--계정표'], { encoding: 'utf8' }).stdout, /\| yuhobuilds-youtube \|[^|]*\| yuhobuilds 편\(월 · 수 · 금\) \|/);
  // 요일 글자가 아닌 값은 모든 날을 쉼으로 만들어 줄이 조용히 멈추니 막는다
  const bad = path.join(매일, '요일-틀림');
  fs.mkdirSync(bad, { recursive: true });
  fs.writeFileSync(path.join(bad, 'sns-계정.json'), JSON.stringify({ accounts: { 'yuhobuilds-youtube': { brand: 'yuhobuilds', platform: 'youtube', dailyLine: 'yuhobuilds', dailyDays: 'MWF' } } }));
  const refused = spawnSync(process.execPath, [tool, '--폴더', bad, '--오늘', '2026-10-28'], { encoding: 'utf8' });
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /dailyDays는 요일 글자로만/);
});

test('같은 날 같은 계정에 두 편이면 경고(블로그는 빼고), 작업실 검토 링크가 승인 전에 만료되거나 24시간 안이면 경고 — 링크 글자는 읽지도 적지도 않는다', () => {
  const base = 매일판('겹침', [
    ['en-a', 한편('LAB', '2026-10-23', ['lab-youtube']), null],
    ['en-b', 한편('LAB', '2026-10-23', ['lab-youtube']), null],
    ['brief-a', 한편('synkbrief', '2026-10-23', ['synkbrief-youtube', 'shift-naverblog']), null],
    ['brief-b', 한편('synkbrief', '2026-10-23', ['shift-naverblog']), null],
    ['wait-soon', 한편('LAB', '2026-10-22', ['lab-instagram']), { 판: [{ 계정: 'lab-instagram', 상태: '승인 대기', 방법: '작업실', 작업: 'job-1' }] }],
    ['wait-gone', 한편('LAB', '2026-10-24', ['lab-instagram']), { 판: [{ 계정: 'lab-instagram', 상태: '승인 대기', 방법: '작업실', 작업: 'job-2' }] }],
    ['approved', 한편('LAB', '2026-10-25', ['lab-instagram']), { 판: [{ 계정: 'lab-instagram', 상태: '예약됨', 방법: '작업실', 작업: 'job-3' }] }]]);
  const links = path.join(base, '링크');
  fs.mkdirSync(links);
  const 링크 = (편, 만료) => fs.writeFileSync(path.join(links, `${편}.json`), JSON.stringify({ 편, 만료, 링크: 'https://workspace.example/social-review#token=비밀열쇠', 보냄: true }));
  링크('wait-soon', '2026-10-22T10:00:00+09:00');
  링크('wait-gone', '2026-10-21T20:00:00+09:00');
  링크('approved', '2026-10-21T20:00:00+09:00');
  const r = 매일큐(base, ['--지금', '2026-10-21T21:30+09:00'], { SYNK_WORKSPACE_LINK_DIR: links });
  assert.ok(r.warnings.includes('같은 날 두 편: lab-youtube · 2026-10-23 · en-a, en-b'), r.warnings.join('\n'));
  assert.equal(r.warnings.some((w) => /shift-naverblog/.test(w)), false, '블로그는 겹쳐도 경고하지 않는다');
  assert.ok(r.warnings.includes('검토 링크가 24시간 안에 만료(10-22 10:00): wait-soon'), r.warnings.join('\n'));
  assert.ok(r.warnings.includes('검토 링크가 승인 전에 만료: wait-gone — 14시 게시 작업이 `node tools/작업실예약.js 취소` 뒤 다시 등록'));
  assert.equal(r.warnings.some((w) => /approved/.test(w)), false, '승인된 편은 링크가 만료돼도 괜찮다');
  assert.equal(JSON.stringify(r).includes('비밀열쇠'), false);
  // --폴더만 주면 이 PC의 링크 기록은 읽지 않는다
  assert.equal(매일큐(base, ['--지금', '2026-10-21T21:30+09:00']).warnings.some((w) => /검토 링크/.test(w)), false);
});

test('--계정표는 계정 전수 표를 마크다운으로 — 매일 판 · 막힘 · 밖과 까닭', () => {
  const base = 매일판('표', []);
  const out = spawnSync(process.execPath, [tool, '--폴더', base, '--계정표'], { encoding: 'utf8' }).stdout;
  assert.match(out, /^계정 7개 · 매일 판 5 · 막힘 1 · 매일 판 밖 1$/m);
  assert.match(out, /^\| 계정 \| 핸들 \| 매일 무엇이 \| 올리는 길 \| 며칠 앞서 \| 막힌 것 · 까닭 \|$/m);
  assert.match(out, /^\| lab-youtube \| {2}\| LAB 영어 편 \| 작업실 자동/m);
  assert.match(out, /^\| shift-naverblog \| {2}\| synkbrief 편의 블로그 글 \| 네이버 예약 발행/m);
  assert.match(out, /^\| yuhobuilds-x \| {2}\| yuhobuilds 편 \| X 웹 예약\(ego\) \| 로그인 뒤 확인 \| 막힘 — ego 로그아웃 — 유호님 로그인 \|$/m);
  assert.match(out, /^\| lab-us-youtube \| {2}\| 매일 판 밖 \| .* \| 나라별 LAB — 유호님 답 전 \|$/m);
});

test('실제 sns-계정.json — 모든 계정이 매일 판 줄 · 매일 판 밖 가운데 하나이고, 줄 이름은 정해진 여섯 가운데 하나다', () => {
  const real = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'docs', '마케팅', 'sns-계정.json'), 'utf8').replace(/^﻿/, '')).accounts;
  const lines = new Set(['LAB 영어', 'LAB 몽골', 'LAB 두 채널', 'LAB 나라별', 'synkbrief', 'yuhobuilds']);
  for (const [key, a] of Object.entries(real)) {
    assert.equal(Boolean(a.dailyLine) !== Boolean(a.dailyOff), true, `${key}: dailyLine과 dailyOff 가운데 하나만`);
    if (a.dailyLine) assert.ok(lines.has(a.dailyLine), `${key}: 줄 이름 ${a.dailyLine}`);
    if (a.dailyDays !== undefined) assert.match(String(a.dailyDays), /^[일월화수목금토]+$/, `${key}: dailyDays는 요일 글자로만`);
  }
});

// 11-10 LAB 하루 두 편 · 39계정(설계 1): LAB 모든 계정에 줄 · 현지 칸 · IANA 시간대 · 언어 · 나라 · 예약 경로가 있다 — 예약큐 · 검사 ⑩ · ⑫ · ⑯ · 돌림표가 읽는다.
test('실제 sns-계정.json — LAB 39곳 모두 줄 · 현지 칸(13:00 이야기 · 21:00 노래, 텔레그램은 21:00 노래 하나 — 11-10 밤 퀴즈에서 노래로) · 시간대 · 언어 · 경로', () => {
  const T = require('../tools/lib/계정시간.js');
  const real = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'docs', '마케팅', 'sns-계정.json'), 'utf8').replace(/^﻿/, '')).accounts;
  const lab = Object.entries(real).filter(([, a]) => a.brand === 'LAB');
  assert.equal(lab.length, 39);
  for (const [key, a] of lab) {
    assert.ok(a.dailyLine, `${key}: 줄`);
    assert.ok(T.validZone(a.timeZone) && /\//.test(a.timeZone), `${key}: IANA 시간대 ${a.timeZone}`);
    assert.match(String(a.language), /^[a-z]{2,3}(-[A-Za-z]+)?$/, `${key}: 언어`);
    // 겨누는 나라는 하나 — 나라 코드, 아니면 「전 세계」(audience global · 판본 키). 둘 다이거나 둘 다 없으면 안 된다(유호님 11-10 「국가타겟을 정해서 헷갈리면 절대 안 돼」)
    if (a.audience === 'global') { assert.equal(a.countryCode, undefined, `${key}: 전 세계 계정은 나라 칸을 비운다`); assert.ok(a.rotationVersion, `${key}: 전 세계 계정의 판본 키`); }
    else assert.match(String(a.countryCode), /^[A-Z]{2}$/, `${key}: 나라`);
    assert.ok(a.postRoute, `${key}: 예약 경로`);
    assert.equal(a.dailyTimes.length, a.dailyFormats.length, `${key}: 칸 시각과 형식 수`);
    assert.ok(a.dailyTimes.every(T.isTime), `${key}: 칸 시각 꼴`);
    if (a.platform === 'telegram') assert.deepEqual(a.dailyFormats, ['노래'], `${key}: 텔레그램은 하루 한 편(21:00 노래)`);
    else assert.deepEqual(a.dailyFormats, ['이야기', '노래'], `${key}: 13:00 이야기 · 21:00 노래`);
    if (a.dailyFormatsFrom) assert.equal('퀴즈' in a.dailyFormatsFrom, false, `${key}: 닫아 둔 칸 열쇠도 노래다(퀴즈 열쇠가 남으면 21:00 칸이 열린다)`);
    // 현지 시각: 몽골 네 계정은 11-09 결정 시각(한국 13:00 · 21:00) 그대로, 나머지는 현지 13:00 · 21:00
    const korea = a.dailyTimes.map((t) => T.localTime(T.zonedMs('2026-11-20', t, a.timeZone), 'Asia/Seoul'));
    if (a.countryCode === 'MN' && a.dailyLine === 'LAB 몽골') assert.deepEqual(korea, a.platform === 'telegram' ? ['21:00'] : ['13:00', '21:00'], `${key}: 몽골은 한국 시각 그대로`);
    else assert.deepEqual(a.dailyTimes, a.platform === 'telegram' ? ['21:00'] : ['13:00', '21:00'], `${key}: 현지 13:00 · 21:00`);
    // 시작은 5일치 비축을 건 날(그 전엔 「미정」)
    if (a.dailyLine === 'LAB 나라별') assert.ok(a.dailyFrom === '미정' || /^\d{4}-\d{2}-\d{2}$/.test(a.dailyFrom), `${key}: dailyFrom ${a.dailyFrom}`);
  }
  assert.equal(new Set(lab.map(([, a]) => a.language)).size, 21);
  assert.equal(new Set(lab.map(([, a]) => a.countryCode).filter(Boolean)).size, 25);
  assert.deepEqual(lab.filter(([, a]) => a.audience === 'global').map(([key]) => key), ['lab-youtube'], '전 세계 계정은 @synkkorean 하나');
  // 같은 나라 · 같은 플랫폼에 계정이 둘이면 안 된다(나라를 헷갈려 같은 영상이 두 번 나간다)
  const spots = lab.map(([, a]) => `${a.platform}|${a.countryCode || a.audience}`);
  assert.equal(new Set(spots).size, spots.length, '같은 나라 · 같은 플랫폼 계정 겹침');
  // 같은 언어 묶음(같은 플랫폼 · 같은 말 — languageGroup, 없으면 language): 유튜브 영어 여섯(필리핀은 판이 필리핀어, 검사만 함께) · 유튜브 스페인어 둘뿐
  const 돌림 = require('../tools/lib/돌림.js');
  const bundles = 돌림.bundlesOf(Object.fromEntries(lab));
  assert.deepEqual(bundles.map((b) => `${b.platform}|${b.group}|${[...b.accounts].sort().join(',')}`), [
    'youtube|en|lab-au-youtube,lab-ca-youtube,lab-nz-youtube,lab-ph-youtube,lab-us-youtube,lab-youtube',
    'youtube|es|lab-mx-youtube,lab-py-youtube',
  ]);
  // 묶음 안에서 판본 키를 둘이 쓰지 않는다(같은 키면 같은 파일이 두 계정에 간다)
  for (const b of bundles) { const keys = b.accounts.map((k) => real[k].rotationVersion || real[k].countryCode); assert.equal(new Set(keys).size, keys.length, `${b.platform} ${b.group}: 판본 키 ${keys.join(' · ')}`); }
});

test('슬롯을 놓쳐 다른 날 손으로 올린 판은 게시결과의 실제 시각 날로 센다(작업실 판은 그대로)', () => {
  const base = 매일판('늦게', [
    ['late-xhs', 한편('LAB', '2026-10-22', ['lab-youtube']), { 판: [{ 계정: 'lab-youtube', 상태: '게시됨', 시각: '2026-10-23T01:14:00+09:00', 방법: '슬롯을 놓쳐 다음 날 손으로' }] }],
    ['ws', 한편('LAB', '2026-10-24', ['lab-youtube']), { 판: [{ 계정: 'lab-youtube', 상태: '예약됨', 시각: '2026-10-25T09:00:00+09:00', 방법: '작업실', 작업: 'job-x' }] }],
  ]);
  const r = 매일큐(base, ['--오늘', '2026-10-21']);
  const row = r.accounts.find((x) => x.account === 'lab-youtube');
  assert.deepEqual(['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map((d) => row.byDay[d].length), [0, 1, 1, 0]);
});

test('게시물 ID까지 적힌 「게시됨」 작업실 판은 서버가 「확인 필요」로 내려도 게시됨이고, 보류 칸은 「새 편 칸」으로 보인다', () => {
  const base = 매일판('확인됨', [
    ['ws-seen', 한편('LAB', '2026-10-20', ['lab-youtube']), { 판: [{ 계정: 'lab-youtube', 상태: '게시됨', 방법: '작업실', 작업: 'job-u', 게시물ID: 'abc' }] }],
    ['ws-unknown', 한편('LAB', '2026-10-19', ['lab-youtube']), { 판: [{ 계정: 'lab-youtube', 상태: '예약됨', 방법: '작업실', 작업: 'job-v' }] }],
    ['held', 한편('LAB', '2026-10-22', ['lab-youtube']), { 판: [{ 계정: 'lab-youtube', 상태: '보류' }] }],
  ]);
  const cache = path.join(base, '서버.json');
  fs.writeFileSync(cache, JSON.stringify({ checkedAt: '2026-10-21T02:00:00Z', channels: [{ id: 'x', platform: 'youtube' }], posts: [],
    jobs: [{ id: 'job-u', channelId: 'x', status: 'unknown', scheduledAt: '2026-10-20T12:00:00Z' }, { id: 'job-v', channelId: 'x', status: 'unknown', scheduledAt: '2026-10-19T12:00:00Z' }] }));
  const r = 매일큐(base, ['--오늘', '2026-10-21', '--서버캐시', cache]);
  assert.ok(!r.warnings.some((w) => w.includes('ws-seen')), r.warnings.join('\n'));
  // 게시물 ID가 없는 판은 서버 상태를 그대로 따른다
  assert.ok(r.warnings.some((w) => w.includes('ws-unknown')));
  const t = spawnSync(process.execPath, [tool, '--폴더', base, '--서버캐시', cache, '--오늘', '2026-10-21'],
    { encoding: 'utf8', env: { ...process.env, SYNK_QUEUE_DIR: path.join(base, '상태') } });
  assert.equal(t.status, 0, t.stderr);
  assert.match(t.stdout, /10-22 보류 — 나가지 않아 새 편 칸/);
});

test('작업실 검토 링크를 승인한 판(게시결과 「예약됨」 + 「승인」)은 서버가 아직 reviewWaiting이어도 예약됨으로 센다', () => {
  const base = 매일판('승인함', [
    ['ok', 한편('LAB', '2026-10-22', ['lab-youtube']), { 판: [{ 계정: 'lab-youtube', 상태: '예약됨', 승인: '유호님 승인 → 링크 승인', 방법: '작업실', 작업: 'job-a' }] }],
    ['wait', 한편('LAB', '2026-10-23', ['lab-youtube']), { 판: [{ 계정: 'lab-youtube', 상태: '승인 대기', 방법: '작업실', 작업: 'job-b' }] }],
  ]);
  const cache = path.join(base, '서버.json');
  fs.writeFileSync(cache, JSON.stringify({ checkedAt: '2026-10-21T02:00:00Z', channels: [{ id: 'x', platform: 'youtube' }], posts: [],
    jobs: [{ id: 'job-a', channelId: 'x', status: 'scheduled', reviewWaiting: true, scheduledAt: '2026-10-22T12:00:00Z' }, { id: 'job-b', channelId: 'x', status: 'scheduled', reviewWaiting: true, scheduledAt: '2026-10-23T12:00:00Z' }] }));
  const r = 매일큐(base, ['--오늘', '2026-10-21', '--서버캐시', cache]);
  const row = r.accounts.find((x) => x.account === 'lab-youtube');
  assert.equal(row.byDay['2026-10-22'][0].state, '예약됨');
  assert.equal(row.byDay['2026-10-23'][0].state, '승인 대기');
});

test('⑱ 미학 맹검 — 옛 검사 기록이 「확인할 것」이어도 걸 판이 남은 편은 맹검이 없거나 기각이면 고칠 것(까닭 함께), 기각의 맹검판단은 그대로, 맹검못함 글만이면 고칠 것(11-10 설계 18), 다 건 편은 묻지 않는다', t => {
  미학막음(t);
  const base =fs.mkdtempSync(path.join(os.tmpdir(), '예약큐-맹검-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const 검사 = { 결과: '확인할 것', 파일: [] };
  const 기각 = { 낱장: [{ 번호: '01', 판정: '기각', 점수: 3, 약점: ['[K6] 끝 마침표'] }], 빠짐: [] };
  편('없음', { ...판('LAB', '2026-11-10'), 검사 }, null, base, null);
  편('기각', { ...판('LAB', '2026-11-11'), 검사 }, null, base, 기각);
  편('판단', { ...판('LAB', '2026-11-12'), 검사, 맹검판단: '빈 날 없음 — 같은 편 다른 판이 이미 예약됨' }, null, base, 기각);
  편('못함', { ...판('LAB', '2026-11-13'), 검사, 맹검못함: '아르곤 웹 줄 꺼짐' }, null, base, null);
  편('다건', { ...판('LAB', '2026-11-14'), 검사 }, { 판: [{ 계정: 'lab-youtube', 상태: '예약됨' }] }, base, null);
  const r = 돌리기(base, '--오늘', '2026-11-08', '--일수', '7', '--json');
  assert.equal(r.status, 0, r.stderr);
  const fix = Object.fromEntries(JSON.parse(r.stdout).fix.map((x) => [x.folder, `${x.check}:${x.checkWhy}`]));
  assert.deepEqual(fix, { 없음: '고칠 것:미학 맹검 없음', 기각: '고칠 것:맹검 기각', 못함: '고칠 것:맹검 막힘 · 대체 맹검 없음' });
  const 글 = 돌리기(base, '--오늘', '2026-11-08', '--일수', '7').stdout;
  assert.match(글, /없음 · 검사 고칠 것\(미학 맹검 없음\)/, '편 줄에 까닭이 보여 14시 회차가 옛 기록만 믿고 걸지 않는다');
  assert.match(글, /판단 · 검사 확인할 것/);
  // 11-12 권고(기본): 같은 편들이 ⑱ 때문에 「고칠 것」이 되지 않는다 — 검사 기록(확인할 것) 그대로 걸 편에 든다
  delete process.env.SYNK_미학관문;
  const 권고 = 돌리기(base, '--오늘', '2026-11-08', '--일수', '7', '--json');
  assert.equal(권고.status, 0, 권고.stderr);
  assert.deepEqual(JSON.parse(권고.stdout).fix, []);
});

test('하루 두 칸 계정(LAB 몽골 12:00 · 21:00, 11-09 유호님 「두 편으로」) — 칸마다 따로 세고, 열리기 전 날은 앞 칸이 쉼, 같은 칸 두 편만 경고', () => {
  const base = path.join(매일, '두칸');
  fs.mkdirSync(base, { recursive: true });
  const 두칸 = { dailyTimes: ['12:00', '21:00'], dailyTimesFrom: '2026-11-12' };
  fs.writeFileSync(path.join(base, 'sns-계정.json'), JSON.stringify({ accounts: {
    'lab-instagram': { brand: 'LAB', platform: 'instagram', dailyLine: 'LAB 몽골', ...두칸 },
    'lab-tiktok': { brand: 'LAB', platform: 'tiktok', dailyLine: 'LAB 몽골', ...두칸 } } }));
  const 판 = (slot, 시각, 계정들) => ({ 브랜드: 'LAB', 슬롯: slot, 성격: '상시', 제목: `몽골 ${slot} ${시각}`, 판: 계정들.map((계정) => ({ 계정, 시각: `${slot}T${시각}+09:00` })) });
  const 둘다 = (상태) => 결과([['lab-instagram', 상태], ['lab-tiktok', 상태]]);
  const 계정 = ['lab-instagram', 'lab-tiktok'];
  편('mn-11-밤', 판('2026-11-11', '21:00', 계정), 둘다('예약됨'), base);
  편('mn-12-밤', 판('2026-11-12', '21:00', 계정), 둘다('예약됨'), base);
  편('mn-13-낮', 판('2026-11-13', '12:00', 계정), 둘다('예약됨'), base);
  편('mn-13-밤', 판('2026-11-13', '21:00', 계정), 둘다('예약됨'), base);
  편('mn-14-가', 판('2026-11-14', '21:00', ['lab-instagram']), 결과([['lab-instagram', '예약됨']]), base);
  편('mn-14-나', 판('2026-11-14', '21:00', ['lab-instagram']), 결과([['lab-instagram', '예약됨']]), base);
  const r = 매일큐(base, ['--오늘', '2026-11-11']);
  const mn = r.lines.find((l) => l.line === 'LAB 몽골');
  assert.deepEqual(Object.keys(mn.byDay['2026-11-12'].cells), ['lab-instagram 12시', 'lab-instagram', 'lab-tiktok 12시', 'lab-tiktok']);
  assert.equal(mn.byDay['2026-11-11'].mark, '●', '열리기 전 날은 12시 칸이 쉼이라 밤 칸만 채우면 채움');
  assert.equal(mn.byDay['2026-11-11'].cells['lab-instagram 12시'], '쉼');
  assert.deepEqual([mn.byDay['2026-11-12'].mark, mn.byDay['2026-11-12'].cells['lab-instagram 12시'], mn.byDay['2026-11-12'].cells['lab-instagram']], ['◐', '빔', '채움']);
  assert.equal(mn.byDay['2026-11-13'].mark, '●', '12:00 판과 21:00 판이 제 칸에 든다');
  assert.equal(mn.reserve, 0, "내일(11-12) 12시 칸이 비어 비축 0");
  const noon = r.accounts.find((x) => x.account === 'lab-instagram 12시');
  assert.deepEqual([noon.base, noon.slot], ['lab-instagram', '12:00']);
  assert.ok(noon.off.includes('2026-11-11') && !noon.off.includes('2026-11-12'));
  assert.ok(r.warnings.includes('같은 칸(21:00) 두 편: lab-instagram · 2026-11-14 · mn-14-가, mn-14-나'));
  assert.equal(r.warnings.some((w) => w.includes('2026-11-13')), false, '12:00 · 21:00 두 편은 경고가 아니다');
  const out = spawnSync(process.execPath, [tool, '--폴더', base, '--오늘', '2026-11-11'], { encoding: 'utf8' }).stdout;
  assert.match(out, /LAB 몽골 빈 칸: 11-12 lab-instagram 12시 만든 편 없음, lab-tiktok 12시 만든 편 없음 · /);
  assert.match(out, / · 11-15 만든 편 없음\(12:00 · 21:00 칸마다 한 편\)$/m, '통째로 빈 날은 칸마다 한 편이 든다고 적는다');
  const table = spawnSync(process.execPath, [tool, '--폴더', base, '--계정표'], { encoding: 'utf8' }).stdout;
  assert.match(table, /\| lab-instagram \| [^|]*\| LAB 몽골 편 하루 2편\(12:00 · 21:00 · 11-12부터\) \|/);
  // 칸에 형식이 있으면 형식 이름으로 적되 「노래」 칸은 시각으로 적는다 — 「노래 칸마다 한 편」은 제작 회차에 노래를 만들라는 말로 읽힌다(11-11).
  // 계정표는 칸 이름 그대로(12:00 이야기 · 21:00 노래) 보인다
  const ledgerFile = path.join(base, 'sns-계정.json');
  const led = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  for (const a of Object.values(led.accounts)) a.dailyFormats = ['이야기', '노래'];
  fs.writeFileSync(ledgerFile, JSON.stringify(led));
  const out2 = spawnSync(process.execPath, [tool, '--폴더', base, '--오늘', '2026-11-11'], { encoding: 'utf8' }).stdout;
  assert.match(out2, / · 11-15 만든 편 없음\(이야기 · 21:00 칸마다 한 편\)$/m);
  assert.doesNotMatch(out2, /노래 칸마다/);
  assert.match(spawnSync(process.execPath, [tool, '--폴더', base, '--계정표'], { encoding: 'utf8' }).stdout, /LAB 몽골 편 하루 2편\(12:00 이야기 · 21:00 노래 · 11-12부터\)/);
});

test('한 계정에 줄이 여럿이면 걸려 있는 줄로 읽는다 — 예약됨 뒤에 다른 작업의 취소됨이 와도 빈 칸이 아니다(11-10 게시 장부 rowOf와 같은 읽기)', () => {
  const base = 매일판('여러줄', [
    ['en-22', 한편('LAB', '2026-10-22', ['lab-youtube']), { 판: [{ 계정: 'lab-youtube', 상태: '예약됨', 방법: '작업실', 작업: 'job-a' }, { 계정: 'lab-youtube', 상태: '취소됨', 방법: '작업실', 작업: 'job-b' }] }],
    ['en-23', 한편('LAB', '2026-10-23', ['lab-youtube']), { 판: [{ 계정: 'lab-youtube', 상태: '취소됨', 방법: '작업실', 작업: 'job-c' }, { 계정: 'lab-youtube', 상태: '취소됨', 방법: '작업실', 작업: 'job-d' }, { 계정: 'lab-youtube', 상태: '예약됨', 방법: '작업실', 작업: 'job-e' }] }],
    ['en-24', 한편('LAB', '2026-10-24', ['lab-youtube']), { 판: [{ 계정: 'lab-youtube', 상태: '취소됨', 방법: '작업실', 작업: 'job-f' }, { 계정: 'lab-youtube', 상태: '취소됨', 방법: '작업실', 작업: 'job-g' }] }],
  ]);
  const r = 매일큐(base, ['--오늘', '2026-10-21']);
  const line = r.lines.find((l) => l.line === 'LAB 영어');
  assert.deepEqual(['2026-10-22', '2026-10-23', '2026-10-24'].map((d) => line.byDay[d].cells['lab-youtube']), ['채움', '채움', '만듦']);
  assert.equal(line.reserve, 2);
});

test('나라별 계정(11-10) — 퀴즈 칸을 닫아 두면 그 줄은 쉼이고, 첫 판 시험 계정은 판이 달린 날만 칸이다(확인해 true로 바꾸면 빈 칸으로 보인다)', () => {
  const base = path.join(매일, '나라별');
  fs.mkdirSync(base, { recursive: true });
  const 나라 = (extra) => ({ brand: 'LAB', platform: 'youtube', dailyLine: 'LAB 나라별', timeZone: 'Asia/Seoul', dailyTimes: ['13:00', '21:00'], dailyFormats: ['이야기', '퀴즈'],
    dailyFrom: '2026-11-12', dailyFormatsFrom: { 퀴즈: '미정' }, ...extra });
  const 원장 = (state) => fs.writeFileSync(path.join(base, 'sns-계정.json'), JSON.stringify({ accounts: { 'lab-th-youtube': 나라({ postRouteVerified: state }) } }));
  편('story-13', { 브랜드: 'LAB', 슬롯: '2026-11-13', 성격: '상시', 제목: '이야기', 판: [{ 계정: 'lab-th-youtube', 시각: '2026-11-13T13:00:00+09:00', 돌림: true }] }, 결과([['lab-th-youtube', '예약됨']]), base);
  const cells = (state) => {
    원장(state);
    const line = 매일큐(base, ['--오늘', '2026-11-11', '--일수', '5']).lines.find((l) => l.line === 'LAB 나라별');
    return { reserve: line.reserve, days: ['2026-11-12', '2026-11-13', '2026-11-14'].map((d) => `${line.byDay[d].cells['lab-th-youtube 이야기']}/${line.byDay[d].cells['lab-th-youtube']}`) };
  };
  // 첫 판 시험: 판이 달린 11-13만 칸(채움), 나머지 이야기 칸과 퀴즈 칸은 쉼 — 빈 칸으로 알리지 않는다. 그 계정만 있는 줄의 비축은
  // 쉼이 이어져 「다 찼다」로 나오니 세지 않는다(null — 11-11 Fable 5.2 검수 P2-9, 판 0인 15곳이 「LAB 나라별 – – – – – 5일」로 보였다)
  assert.deepEqual(cells('첫판'), { reserve: null, days: ['쉼/쉼', '채움/쉼', '쉼/쉼'] });
  // 확인해 true로 바꾸면 이야기 칸의 빈 날이 보인다(퀴즈 칸은 그대로 쉼)
  assert.deepEqual(cells(true), { reserve: 0, days: ['빔/쉼', '채움/쉼', '빔/쉼'] });
});

// ── 11-11 Fable 5.2 끝 판 검수 P2-9 · P3-9 — 돌림 판 · 나라별 계정 표기 ──
const 나라계정 = (tz, extra = {}) => ({ brand: 'LAB', platform: 'youtube', dailyLine: 'LAB 나라별', timeZone: tz, dailyTimes: ['13:00', '21:00'],
  dailyFormats: ['이야기', '노래'], dailyFrom: '2026-11-12', dailyFormatsFrom: { 노래: '미정' }, postRouteVerified: true, publicProfileComplete: true, ...extra });

// 돌림 원본 한 편이 든 임시 저장소(docs/마케팅) — 씨앗은 11-02에 나갔고, 멕시코(현지 11-12) · 파라과이(현지 11-13) 돌림 판이 달렸다.
// 검사 기록에는 recorded(판본 키 → 그 영상을 쓴 판 계정)의 영상만 적는다 — 크기 · 수정 · 지문 · 오디오 실측까지 지금 파일과 맞는 기록.
function 돌림원본(t, { recorded = { MX: ['lab-mx-youtube'], PY: ['lab-py-youtube'] }, 맹검 = 통과맹검 } = {}) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), '예약큐-돌림판-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const base = path.join(repo, 'docs', '마케팅');
  const dir = path.join(base, 'LAB_원본', '게시');
  for (const rel of ['seed/video.mp4', '판본/MX/video.mp4', '판본/PY/video.mp4']) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), rel);
  }
  fs.writeFileSync(path.join(base, 'sns-계정.json'), JSON.stringify({ accounts: {
    'lab-instagram': { brand: 'LAB', platform: 'instagram', dailyLine: 'LAB 몽골', timeZone: 'Asia/Ulaanbaatar', rotationSeed: true },
    'lab-mx-youtube': 나라계정('America/Mexico_City'), 'lab-py-youtube': 나라계정('America/Asuncion') } }));
  const entry = (key, 판) => {
    const rel = `docs/마케팅/LAB_원본/게시/판본/${key}/video.mp4`;
    const st = fs.statSync(path.join(repo, rel));
    return { 경로: rel, 판, 바이트: st.size, 수정: new Date(st.mtimeMs).toISOString(), sha256: '1'.repeat(64), 오디오비트레이트: [{ channels: 2, actualBps: 333421 }] };
  };
  편('LAB_원본', { 브랜드: 'LAB', 슬롯: '2026-11-02', 성격: '상시', 제목: '돌림 원본',
    돌림: { 판본: { MX: { 파일: '게시/판본/MX/video.mp4' }, PY: { 파일: '게시/판본/PY/video.mp4' } } },
    판: [{ 계정: 'lab-instagram', 시각: '2026-11-02T20:00:00+08:00', 파일: 'seed/video.mp4' },
      { 계정: 'lab-mx-youtube', 시각: '2026-11-12T13:00:00-06:00', 파일: '판본/MX/video.mp4', 돌림: true },
      { 계정: 'lab-py-youtube', 시각: '2026-11-13T13:00:00-03:00', 파일: '판본/PY/video.mp4', 돌림: true }],
    검사: { 결과: '확인할 것', 파일: Object.entries(recorded).map(([k, 판]) => entry(k, 판)) } },
  { 판: [{ 계정: 'lab-instagram', 상태: '게시됨' }] }, base, 맹검);
  return base;
}
function 돌림큐(base, args) {
  const sentFile = path.join(base, '보낸글.txt');
  const r = spawnSync(process.execPath, [tool, '--폴더', base, ...args],
    { encoding: 'utf8', env: { ...process.env, SYNK_QUEUE_DIR: path.join(base, '상태'), SYNK_HERMES_EXE: 'file:' + sentFile } });
  assert.equal(r.status, 0, r.stderr);
  return { out: r.stdout, sent: fs.existsSync(sentFile) ? fs.readFileSync(sentFile, 'utf8') : '' };
}

test('P2-9 ⓐ 돌림 원본(슬롯 = 씨앗이 나간 옛 날)의 돌림 판이 「고칠 것」이면 판이 든 날(계정 현지 날짜)에 편 줄 · 까닭이 찍히고 fix · 알림에 든다 — 브랜드 표는 그대로 슬롯으로', (t) => {
  미학막음(t); // 「고칠 것」 편을 만드는 데 옛 ⑱ 막음(맹검 없음)을 쓴다
  const base = 돌림원본(t, { 맹검: null });
  const j = JSON.parse(돌림큐(base, ['--오늘', '2026-11-11', '--일수', '5', '--json']).out);
  // fix: 슬롯(11-02)은 지났어도 아직 걸 판이 11-12 · 11-13(현지)에 있다
  assert.deepEqual(j.fix.map((x) => [x.folder, x.check, x.checkWhy, x.days]), [['LAB_원본', '고칠 것', '미학 맹검 없음', ['2026-11-12', '2026-11-13']]]);
  // 판 날: 그날 판만 추려 그 판들의 상태로 — 브랜드 표(byDay)는 슬롯으로 세니 비어 있다
  assert.deepEqual(j.brands.LAB.byDay['2026-11-12'], []);
  const day = j.brands.LAB.plateDays['2026-11-12'];
  assert.deepEqual(day.map((x) => [x.folder, x.state, x.plateDay, x.plates.map((p) => [p.account, p.rotation])]), [['LAB_원본', '승인 대기', true, [['lab-mx-youtube', true]]]]);
  assert.deepEqual(j.brands.LAB.plateDays['2026-11-11'], [], '씨앗 판(11-02)은 범위 밖');
  const { out } = 돌림큐(base, ['--오늘', '2026-11-11', '--일수', '5']);
  assert.match(out, /^ {2}2026-11-12 LAB 승인 대기 · 돌림 원본 · 상시 · LAB_원본 · 검사 고칠 것\(미학 맹검 없음\) · 이날 판\(슬롯 2026-11-02\): lab-mx-youtube\(돌림\) —$/m);
  assert.match(out, /^ {2}2026-11-13 LAB 승인 대기 · 돌림 원본 · 상시 · LAB_원본 · 검사 고칠 것\(미학 맹검 없음\) · 이날 판\(슬롯 2026-11-02\): lab-py-youtube\(돌림\) —$/m);
  assert.match(out, /^LAB {9}· {6}· {6}· {6}· {6}· {6}0일$/m, '브랜드 표는 슬롯으로 센다');
  // 알림: 어느 편 · 무슨 까닭 · 판 날
  const { sent } = 돌림큐(base, ['--오늘', '2026-11-11', '--json', '--알림']);
  assert.match(sent, /^검사 「고칠 것」 편: LAB_원본\(미학 맹검 없음 · 판 11-12, 11-13\)$/m);
  // 다 걸린 돌림 원본은 고칠 것 목록에 들지 않는다(편 줄은 채움으로 남는다)
  fs.writeFileSync(path.join(base, 'LAB_원본', '게시', '게시결과.json'), JSON.stringify({ 판: [{ 계정: 'lab-instagram', 상태: '게시됨' },
    { 계정: 'lab-mx-youtube', 상태: '예약됨' }, { 계정: 'lab-py-youtube', 상태: '예약됨' }] }));
  const done = JSON.parse(돌림큐(base, ['--오늘', '2026-11-11', '--일수', '5', '--json']).out);
  assert.deepEqual([done.fix, done.brands.LAB.plateDays['2026-11-12'][0].state], [[], '채움']);
});

test('P2-9 ⓑ 검사 기록에 없는 판 영상(또는 기록 줄 「판」에 없는 계정)이 아직 걸 판이면 「검사 뒤 판이 더해짐 — 다시 검사」, 다시 검사한 기록 · 이미 나간 씨앗 판은 아니다', (t) => {
  const fixOf = (base) => JSON.parse(돌림큐(base, ['--오늘', '2026-11-11', '--일수', '5', '--json']).out).fix.map((x) => [x.folder, x.check, x.checkWhy, x.added]);
  // 파라과이 판을 단 뒤 다시 검사하지 않았다 — 씨앗 영상은 이미 나가 기록에 없어도 된다
  const added = 돌림원본(t, { recorded: { MX: ['lab-mx-youtube'] } });
  assert.deepEqual(fixOf(added), [['LAB_원본', '다시 검사', '검사 뒤 판이 더해짐(lab-py-youtube)', ['lab-py-youtube']]]);
  const { out, sent } = 돌림큐(added, ['--오늘', '2026-11-11', '--일수', '5']);
  assert.match(out, /^ {2}2026-11-13 LAB 승인 대기 · 돌림 원본 · 상시 · LAB_원본 · 검사 뒤 판이 더해짐\(lab-py-youtube\) — 다시 검사 · 이날 판\(슬롯 2026-11-02\): lab-py-youtube\(돌림\) —$/m);
  assert.equal(sent, '');
  assert.match(돌림큐(added, ['--오늘', '2026-11-11', '--json', '--알림']).sent, /^검사 「고칠 것」 편: LAB_원본\(검사 뒤 판이 더해짐\(lab-py-youtube\) — 다시 검사 · 판 11-12, 11-13\)$/m);
  // 같은 영상 파일이 기록에 있어도 그 줄의 「판」에 이 계정이 없으면 이 판의 글 · 언어는 검사 밖이다
  assert.deepEqual(fixOf(돌림원본(t, { recorded: { MX: ['lab-mx-youtube'], PY: ['lab-cl-youtube'] } })), [['LAB_원본', '다시 검사', '검사 뒤 판이 더해짐(lab-py-youtube)', ['lab-py-youtube']]]);
  // 판을 단 뒤 다시 검사한 기록(두 판본 다)은 통과 — 옛 기록(「판」 목록 없음)도 영상만 맞으면 통과
  assert.deepEqual(fixOf(돌림원본(t)), []);
  assert.deepEqual(fixOf(돌림원본(t, { recorded: { MX: undefined, PY: undefined } })), []);
  // 판본 파일을 아직 안 만든 채 판만 단 원본도 판 「파일」로 맞춰 본다 — 기록에 있으면 「판이 더해짐」이 아니다(영상이 없으니 다시 검사)
  const missing = 돌림원본(t);
  fs.rmSync(path.join(missing, 'LAB_원본', '게시', '판본', 'PY', 'video.mp4'));
  assert.deepEqual(fixOf(missing), [['LAB_원본', '다시 검사', null, undefined]]);
});

test('P2-9 ⓒ 첫 판 시험 계정(원장 「첫판」) — 한 줄(판 없음 · 걸림 · 나감)로 보이고, 그 계정만 있는 줄 · 계정 줄 비축은 세지 않으며, 첫 판이 나갔는데 원장이 그대로면 경고', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), '예약큐-첫판-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  fs.writeFileSync(path.join(base, 'sns-계정.json'), JSON.stringify({ accounts: {
    'lab-youtube': { brand: 'LAB', platform: 'youtube', dailyLine: 'LAB 영어' },
    'lab-mx-youtube': 나라계정('America/Mexico_City', { postRouteVerified: '첫판' }),
    'lab-us-youtube': 나라계정('America/New_York', { postRouteVerified: '첫판' }),
    'lab-ca-youtube': 나라계정('America/Toronto', { postRouteVerified: '첫판', dailyFrom: '2026-11-09' }) } }));
  편('원본가', { 브랜드: 'LAB', 슬롯: '2026-11-02', 성격: '상시', 제목: '원본 가', 판: [
    { 계정: 'lab-us-youtube', 시각: '2026-11-12T13:00:00-05:00', 돌림: true }, { 계정: 'lab-ca-youtube', 시각: '2026-11-10T13:00:00-05:00', 돌림: true }] },
  결과([['lab-us-youtube', '예약됨'], ['lab-ca-youtube', '게시됨']]), base);
  const { out: json, sent } = 돌림큐(base, ['--지금', '2026-11-11T21:30+09:00', '--json', '--알림']);
  const j = JSON.parse(json);
  assert.deepEqual(j.trial.map((x) => [x.account, x.state, x.day || null, x.folder || null]), [
    ['lab-ca-youtube', '나감', '2026-11-10', '원본가'], ['lab-mx-youtube', '판 없음', null, null], ['lab-us-youtube', '걸림', '2026-11-12', '원본가']]);
  const 나라별 = j.lines.find((l) => l.line === 'LAB 나라별');
  assert.deepEqual([나라별.trial, 나라별.reserve, 나라별.made], [true, null, null]);
  assert.equal(j.reserve, j.lines.find((l) => l.line === 'LAB 영어').reserve, '맨 위 비축은 셈하는 줄로만');
  assert.ok(j.accounts.filter((r) => r.base === 'lab-mx-youtube' || r.account === 'lab-mx-youtube').every((r) => r.trial && r.reserve === null));
  assert.equal(j.lines.find((l) => l.line === 'LAB 영어').reserve, 0);
  assert.equal(j.reserveAlert.sent, true);
  assert.doesNotMatch(j.reserveAlert.text, /LAB 나라별/, '첫 판 시험 줄은 비축 알림 밖');
  const warning = '첫 판이 나갔는데 원장이 아직 「첫판」: lab-ca-youtube · 2026-11-10 · 원본가 — 공개 글을 로그인 없이 확인하고 sns-계정.json postRouteVerified를 true로';
  assert.ok(j.warnings.includes(warning), j.warnings.join('\n'));
  assert.ok(sent.includes(`! ${warning}`), '게시 큐 알림에도');
  const { out } = 돌림큐(base, ['--지금', '2026-11-11T21:30+09:00']);
  assert.match(out, /^LAB 나라별 {5}–.* {2}첫 판 시험\(비축 셈 밖\)$/m);
  assert.match(out, /^lab-mx-youtube\s.*\s{2}첫판$/m);
  assert.match(out, /^ {2}첫 판 시험 3곳\(원장 postRouteVerified 「첫판」 — 판 하나만 걸고, 나간 판을 확인하면 true로\) — 판 없음 1 · 걸림\(예약됨\) 1 · 나감\(게시됨 — 확인하고 원장을 true로\) 1 — 판 없음: lab-mx-youtube · 걸림: lab-us-youtube\(11-12 원본가\) · 나감: lab-ca-youtube\(11-10 원본가\)$/m);
  // 걸린 첫 판의 시각이 지나면 공개를 확인하라고 덧붙이고, 판만 달리고 안 걸린 계정은 「판 달림(걸기 전)」
  편('원본나', { 브랜드: 'LAB', 슬롯: '2026-11-02', 성격: '상시', 제목: '원본 나', 판: [{ 계정: 'lab-mx-youtube', 시각: '2026-11-14T13:00:00-06:00', 돌림: true }] }, null, base);
  assert.match(돌림큐(base, ['--지금', '2026-11-13T06:00+09:00']).out,
    /— 판 없음 0 · 판 달림\(걸기 전\) 1 · 걸림\(예약됨\) 1 · 나감\(게시됨 — 확인하고 원장을 true로\) 1 — 걸기 전: lab-mx-youtube\(11-14 원본나\) · 걸림: lab-us-youtube\(11-12 원본가 · 시각 지남 — 공개 확인\) · 나감: /);
});

test('P3-9 ⓐ 보류 칸(버린 편 — 새 편 칸)이 낀 날은 ○가 아니라 ◐, 나갈 편만 있는 날은 그대로 ○', () => {
  const base = 매일판('보류낀날', [
    ['mn-22', 한편('LAB', '2026-10-22', ['lab-instagram', 'lab-tiktok']), 결과([['lab-instagram', '예약됨'], ['lab-tiktok', '보류']])],
    ['mn-23', 한편('LAB', '2026-10-23', ['lab-instagram', 'lab-tiktok']), 결과([['lab-instagram', '예약됨']])]]);
  const mn = 매일큐(base, ['--오늘', '2026-10-21']).lines.find((l) => l.line === 'LAB 몽골');
  assert.deepEqual(mn.byDay['2026-10-22'].cells, { 'lab-instagram': '채움', 'lab-tiktok': '보류' });
  assert.deepEqual([mn.byDay['2026-10-22'].mark, mn.byDay['2026-10-23'].mark], ['◐', '○']);
  const out = spawnSync(process.execPath, [tool, '--폴더', base, '--오늘', '2026-10-21'], { encoding: 'utf8' }).stdout;
  assert.match(out, /^LAB 몽골 {6}· {6}◐ {6}○/m);
  assert.match(out, /LAB 몽골 빈 칸: 10-22 lab-tiktok 보류 — 나가지 않아 새 편 칸 · 10-23 lab-tiktok 승인·예약 전/);
});

test('P3-9 ⓑ · ⓒ 경고 날짜는 그 계정 현지 날짜(한국 날짜와 다르면 한국 시각 덧붙임), 오늘 칸 가운데 그 계정 현지 시각으로 이미 지난 칸은 「오늘 빈 계정」이 아니라 「오늘 지난 빈 칸」', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), '예약큐-현지오늘-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  fs.writeFileSync(path.join(base, 'sns-계정.json'), JSON.stringify({ accounts: {
    'lab-youtube': { brand: 'LAB', platform: 'youtube', dailyLine: 'LAB 영어' },
    'lab-instagram': { brand: 'LAB', platform: 'instagram', dailyLine: 'LAB 몽골', timeZone: 'Asia/Ulaanbaatar', dailyTimes: ['12:00', '20:00'],
      dailyFormats: ['이야기', '노래'], dailyTimesFrom: '2026-11-01', rotationSeed: true },
    'lab-nz-youtube': 나라계정('Pacific/Auckland'), 'lab-mx-youtube': 나라계정('America/Mexico_City') } }));
  // 멕시코 현지 11-11 13:00(= 한국 11-12 04:00) 판이 안 걸린 채 지났다 · 한국 시각 판(lab-youtube 11-11 21:00)도 안 걸린 채 지났다
  편('놓친판', { 브랜드: 'LAB', 슬롯: '2026-11-05', 성격: '상시', 제목: '놓친 판', 판: [{ 계정: 'lab-mx-youtube', 시각: '2026-11-11T13:00:00-06:00', 돌림: true }] }, null, base);
  편('놓친한국', 한편('LAB', '2026-11-11', ['lab-youtube']), null, base);
  // 한국 14:00 — 뉴질랜드는 18:00이라 현지 13:00 이야기 칸이 지났다(17:00부터는 판이 21:00 칸에 든다). 멕시코는 아직 11-11 밤, 몽골은 13:00
  const at14 = JSON.parse(돌림큐(base, ['--지금', '2026-11-12T14:00+09:00', '--json']).out);
  assert.ok(at14.warnings.includes('슬롯이 지났는데 예약도 게시도 안 됨: lab-mx-youtube · 2026-11-11(현지 날짜, 한국 11-12 04:00) · 놓친판'), at14.warnings.join('\n'));
  assert.ok(at14.warnings.includes('슬롯이 지났는데 예약도 게시도 안 됨: lab-youtube · 2026-11-11 · 놓친한국'), '한국 시각 계정은 예전 글 그대로');
  assert.deepEqual(at14.todayGaps.map((g) => g.account), ['lab-youtube', 'lab-instagram 이야기', 'lab-instagram', 'lab-mx-youtube 이야기']);
  assert.deepEqual(at14.todayPassed.map((g) => [g.line, g.account, g.why]), [['LAB 나라별', 'lab-nz-youtube 이야기', '만든 편 없음']]);
  const out = 돌림큐(base, ['--지금', '2026-11-12T14:00+09:00']).out;
  assert.match(out, /^ {2}오늘\(11-12\) 빈 계정: LAB 영어 — lab-youtube 만든 편 없음 · LAB 몽골 — lab-instagram 이야기 만든 편 없음, lab-instagram 만든 편 없음 · LAB 나라별 — lab-mx-youtube 이야기 만든 편 없음$/m);
  assert.match(out, /^ {2}오늘\(11-12\) 지난 빈 칸\(그 계정 현지 시각으로 칸이 지나 채울 수 없음\): LAB 나라별 — lab-nz-youtube 이야기 만든 편 없음$/m);
  // 한국 17:30 — 몽골 16:30이라 12:00 이야기 칸도 지났다(가운데 16:00부터는 판이 20:00 칸에 든다). 알림은 채울 칸과 놓친 칸을 나눠 적는다
  const at1730 = JSON.parse(돌림큐(base, ['--지금', '2026-11-12T17:30+09:00', '--json', '--알림']).out);
  assert.equal(at1730.todayAlert.text, [
    '[오늘 빈 계정] 2026-11-12 · 3곳이 아직 예약·게시 전 · 현지 시각이 지난 빈 칸 2곳',
    'LAB 영어 — lab-youtube 만든 편 없음',
    'LAB 몽골 — lab-instagram 만든 편 없음',
    'LAB 나라별 — lab-mx-youtube 이야기 만든 편 없음',
    '현지 시각이 지나 채울 수 없는 칸(놓침): LAB 몽골 — lab-instagram 이야기 만든 편 없음 · LAB 나라별 — lab-nz-youtube 이야기 만든 편 없음',
    '오늘 안에 채워요 — 관문을 못 넘은 칸은 가장 나은 판으로(제작 절차 「매일 한 편」), 「승인·예약 전」은 검토 링크 승인이나 「올려」로'].join('\n'));
  // 한국 23:30 — 한국 시각 · 몽골(22:30) 끝 칸은 자정까지 채울 수 있다. 뉴질랜드는 현지 11-13 03:30이라 11-12 칸이 모두 지났다
  const late = JSON.parse(돌림큐(base, ['--지금', '2026-11-12T23:30+09:00', '--json']).out);
  assert.deepEqual(late.todayGaps.map((g) => g.account), ['lab-youtube', 'lab-instagram', 'lab-mx-youtube 이야기']);
});

// ── 11-11 Fable 5.2 다시 검수(9074b14e7) P3-3 · P3-4 · P3-6 ──

test('「지움」(공개한 판을 지움)도 거둔 판이다 — 걸 판 · 「슬롯이 지났는데 예약도 게시도 안 됨」에 들지 않고 보류 칸으로 보인다(P3-3)', () => {
  const base = 매일판('지움', [
    ['gone', 한편('LAB', '2026-10-20', ['lab-youtube']), { 판: [{ 계정: 'lab-youtube', 상태: '게시됨', 시각: '2026-10-20T21:00:00+09:00' }, { 계정: 'lab-youtube', 상태: '지움' }] }],
    ['missed', 한편('LAB', '2026-10-19', ['lab-youtube']), { 판: [] }],
    ['gone2', 한편('LAB', '2026-10-22', ['lab-youtube']), { 판: [{ 계정: 'lab-youtube', 상태: '예약됨' }, { 계정: 'lab-youtube', 상태: '지움' }] }],
  ]);
  const r = 매일큐(base, ['--오늘', '2026-10-21']);
  assert.ok(r.warnings.some((w) => /슬롯이 지났는데 예약도 게시도 안 됨/.test(w) && w.includes('missed')), '대조 — 걸지 않고 지나간 판은 알린다');
  assert.ok(!r.warnings.some((w) => w.includes('gone')), r.warnings.join('\n'));
  assert.equal(r.accounts.find((x) => x.account === 'lab-youtube').byDay['2026-10-22'][0].state, '보류', '칸에서는 보류와 같이 새 편 칸');
});

test('작업실 줄 뒤에 보류를 덧붙였는데 그 작업이 서버에 살아 있으면 서버 상태로 보이고 알린다 — 죽은 작업이면 보류 그대로(P3-4)', () => {
  const base = 매일판('거둠서버', [
    ['alive', 한편('LAB', '2026-10-22', ['lab-youtube']), { 판: [{ 계정: 'lab-youtube', 상태: '예약됨', 방법: '작업실', 작업: 'job-a' }, { 계정: 'lab-youtube', 상태: '보류', 보류: '거둠' }] }],
    ['dead', 한편('LAB', '2026-10-23', ['lab-youtube']), { 판: [{ 계정: 'lab-youtube', 상태: '예약됨', 방법: '작업실', 작업: 'job-b' }, { 계정: 'lab-youtube', 상태: '보류', 보류: '거둠' }] }],
    ['nojob', 한편('LAB', '2026-10-24', ['lab-youtube']), { 판: [{ 계정: 'lab-youtube', 상태: '예약됨', 방법: '작업실', 작업: 'job-x' }, { 계정: 'lab-youtube', 상태: '보류', 보류: '거둠' }] }],
  ]);
  const cache = path.join(base, '서버.json');
  fs.writeFileSync(cache, JSON.stringify({ checkedAt: '2026-10-21T02:00:00Z', channels: [{ id: 'x', platform: 'youtube' }], posts: [],
    jobs: [{ id: 'job-a', channelId: 'x', status: 'scheduled', scheduledAt: '2026-10-22T12:00:00Z' }, { id: 'job-b', channelId: 'x', status: 'cancelled', scheduledAt: '2026-10-23T12:00:00Z' }] }));
  const r = 매일큐(base, ['--오늘', '2026-10-21', '--서버캐시', cache]);
  const row = r.accounts.find((x) => x.account === 'lab-youtube');
  assert.equal(row.byDay['2026-10-22'][0].state, '예약됨', '장부는 거뒀는데 서버에는 걸려 있다 — 글이 나간다');
  assert.ok(r.warnings.some((w) => /거둔 판\(보류\)인데 작업실 서버에는 예약됨/.test(w) && w.includes('alive')), r.warnings.join('\n'));
  assert.equal(row.byDay['2026-10-23'][0].state, '보류');
  assert.equal(row.byDay['2026-10-24'][0].state, '보류');
  assert.ok(!r.warnings.some((w) => w.includes('dead') || w.includes('nojob')), r.warnings.join('\n'));
  // 서버를 안 읽으면(캐시 없음) 보류 그대로
  assert.equal(매일큐(base, ['--오늘', '2026-10-21']).accounts.find((x) => x.account === 'lab-youtube').byDay['2026-10-22'][0].state, '보류');
});

test('⑱ --폴더가 저장소 꼴이 아니어서(옆에 tools 폴더 없음) 묶음이 판 영상을 못 찾으면 검사 기록의 영상으로 본다 — 맹검한 영상을 헛막지 않는다(P3-6)', (t) => {
  미학막음(t);
  const repo =fs.mkdtempSync(path.join(os.tmpdir(), '예약큐-꼴아님-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const base = path.join(repo, 'docs', '마케팅'); // tools 폴더를 두지 않는다 — 게시묶음.repoOf가 도구의 저장소로 떨어진다
  const 원본 = (name, 맹검영상) => {
    const dir = path.join(base, name, '게시');
    fs.mkdirSync(path.join(dir, 'seed'), { recursive: true });
    const seed = path.join(dir, 'seed', 'video.mp4');
    fs.writeFileSync(seed, 'seed');
    const st = fs.statSync(seed);
    const 경로 = `docs/마케팅/${name}/게시/seed/video.mp4`;
    const prep = { 브랜드: 'LAB', 슬롯: '2026-11-12', 성격: '상시', 제목: name,
      판: [{ 계정: 'lab-instagram', 시각: '2026-11-12T21:00+09:00', 파일: 경로 }], // 판 경로가 저장소 기준(docs/마케팅/…)이다
      검사: { 결과: '확인할 것', 파일: [{ 경로, 바이트: st.size, 수정: new Date(st.mtimeMs).toISOString(), sha256: '1'.repeat(64), 오디오비트레이트: [{ channels: 2, actualBps: 333421 }] }] } };
    편(name, prep, null, base, { 만든때: new Date(Date.now() + 5000).toISOString(), 영상: [맹검영상], 낱장: [{ 번호: '01', 판정: '그대로 냄', 점수: 8 }], 빠짐: [] });
  };
  원본('LAB_씨앗맹검', { 이름: 'video.mp4', 파일: '게시/seed/video.mp4' });
  원본('LAB_다른영상', { 이름: 'other.mp4', 파일: '게시/other.mp4' }); // 견줌 — 이쪽은 막혀야 ⑱이 실제로 돈 것이다
  const r = 돌리기(base, '--오늘', '2026-11-11', '--일수', '7', '--json');
  assert.equal(r.status, 0, r.stderr);
  const fix = Object.fromEntries(JSON.parse(r.stdout).fix.map((x) => [x.folder, `${x.check}:${x.checkWhy}`]));
  assert.deepEqual(fix, { LAB_다른영상: '고칠 것:맹검 뒤 영상 바뀜' });
});

// ── 걸린 판의 판본이 걸린 뒤 무효가 됨(11-11 — 시험관 넷으로 다시 받은 뜻 검사에서 걸린 판 셋이 떨어졌는데 아무 도구도 알리지 않았다) ──

test('걸린(공개 전) 돌림 판의 판본이 걸린 뒤 검수 무효가 되거나 다시 구워지면 경고로 알린다 — 나간 판 · 그대로인 판은 조용하고, 텔레그램에는 넣지 않는다', (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), '예약큐-걸린판-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const base = path.join(repo, 'docs', '마케팅');
  const dir = path.join(base, 'LAB_걸린', '게시');
  fs.mkdirSync(path.join(dir, '판본', 'MX'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'tools'), { recursive: true });
  const video = path.join(dir, '판본', 'MX', 'video.mp4'), text = path.join(dir, '판본', 'MX', '글.json');
  fs.writeFileSync(video, 'mx-1');
  fs.writeFileSync(text, '{"줄":[]}');
  const sha = (f) => require('node:crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  fs.writeFileSync(path.join(base, 'sns-계정.json'), JSON.stringify({ accounts: { 'lab-mx-youtube': 나라계정('America/Mexico_City', { countryCode: 'MX' }) } }));
  const booked = sha(video);
  const 통과 = () => ({ 뜻: { 결과: '통과', 지문: sha(text) }, 글자: { 결과: '통과', 지문: sha(video) } });
  const 쓰기 = (검수, 상태 = '예약됨') => 편('LAB_걸린', { 브랜드: 'LAB', 슬롯: '2026-11-02', 성격: '상시', 제목: '걸린 판',
    돌림: { 형식: '이야기', 판본: { MX: { 언어: 'es', 파일: '게시/판본/MX/video.mp4', 글: '게시/판본/MX/글.json', 검수 } } },
    판: [{ 계정: 'lab-mx-youtube', 시각: '2026-11-12T13:00:00-06:00', 파일: '판본/MX/video.mp4', 돌림: true, 지문: booked }] },
  { 판: [{ 계정: 'lab-mx-youtube', 상태, 시각: '2026-11-12T13:00:00-06:00', 지문: booked }] }, base);
  const 큐 = () => 돌림큐(base, ['--오늘', '2026-11-11', '--일수', '6', '--알림']);
  // 가) 검수가 그대로 맞으면 조용하다
  쓰기(통과());
  assert.doesNotMatch(큐().out, /걸린 돌림 판/);
  // 나) 건 뒤 다시 받은 뜻 검사에서 떨어졌다 — 다 걸린 편이라 「검사 고칠 것」에는 안 잡히고 이 경고가 알린다
  쓰기({ ...통과(), 뜻: { 결과: '고칠 것', 지문: sha(text) } });
  const b = 큐();
  assert.match(b.out, /! 걸린 돌림 판의 판본이 걸린 뒤 바뀜: lab-mx-youtube · LAB_걸린 · 공개 2026-11-12\(현지 날짜, 한국 11-13 04:00\) — 판본 MX: 뜻 검수 고칠 것/);
  assert.doesNotMatch(b.sent, /걸린 돌림 판/, '텔레그램에는 넣지 않는다(세션 · 14시 회차가 예약 큐에서 본다)');
  // 다) 이미 나간 판은 알리지 않는다
  쓰기({ ...통과(), 뜻: { 결과: '고칠 것', 지문: sha(text) } }, '게시됨');
  assert.doesNotMatch(큐().out, /걸린 돌림 판/);
  // 라) 건 뒤 판본 영상을 다시 굽고 검수까지 다시 받았다 — 걸린 영상은 옛 판이다
  fs.writeFileSync(video, 'mx-2');
  쓰기(통과());
  assert.match(큐().out, /걸린 돌림 판의 판본이 걸린 뒤 바뀜: lab-mx-youtube .* 판본 MX: 건 뒤에 판본 영상을 다시 구웠다/);
  // 마) 글자 검수를 다시 안 받았으면 까닭이 그것이다
  쓰기({ 뜻: { 결과: '통과', 지문: sha(text) }, 글자: { 결과: '통과', 지문: booked } });
  assert.match(큐().out, /판본 MX: 글자 검수 뒤 영상이 바뀜/);
});

test('걸린(공개 전) 돌림 판의 게시글만 건 뒤에 고쳤으면 판본 검수가 다시 서도 경고가 남는다 — 걸 때 줄에 적은 게시글 지문과 견준다(11-11 밤 P1-팔1)', (t) => {
  const 장부 = require('../tools/게시장부.js');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), '예약큐-걸린글-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const base = path.join(repo, 'docs', '마케팅');
  const 편폴더 = path.join(base, 'LAB_걸린글');
  const dir = path.join(편폴더, '게시');
  fs.mkdirSync(path.join(dir, '판본', 'MX'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'tools'), { recursive: true });
  const video = path.join(dir, '판본', 'MX', 'video.mp4'), text = path.join(dir, '판본', 'MX', '글.json'), 원고 = path.join(dir, '판본', 'MX', '원고_youtube.json');
  fs.writeFileSync(video, 'mx-1');
  fs.writeFileSync(text, '{"줄":[]}');
  const 원고쓰기 = (title) => fs.writeFileSync(원고, JSON.stringify({ brand: 'LAB', platform: 'youtube', language: 'es', title, caption: 'Una frase coreana para decir con calma.' }));
  원고쓰기('Di esto con calma');
  const sha = (f) => require('node:crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  fs.writeFileSync(path.join(base, 'sns-계정.json'), JSON.stringify({ accounts: { 'lab-mx-youtube': 나라계정('America/Mexico_City', { countryCode: 'MX' }) } }));
  const 판 = { 계정: 'lab-mx-youtube', 시각: '2026-11-12T13:00:00-06:00', 파일: '게시/판본/MX/video.mp4', 원고: '게시/판본/MX/원고_youtube.json', 돌림: true, 지문: sha(video) };
  const 쓰기 = (줄) => 편('LAB_걸린글', { 브랜드: 'LAB', 슬롯: '2026-11-02', 성격: '상시', 제목: '걸린 글',
    돌림: { 형식: '이야기', 판본: { MX: { 언어: 'es', 파일: '게시/판본/MX/video.mp4', 글: '게시/판본/MX/글.json', 원고: { youtube: '게시/판본/MX/원고_youtube.json' },
      검수: { 뜻: { 결과: '통과', 지문: sha(text) }, 글자: { 결과: '통과', 지문: sha(video) } } } } },
    판: [판] }, { 판: [줄] }, base);
  쓰기({ 계정: 'lab-mx-youtube', 상태: '실패' }); // 준비.json부터 있어야 게시글을 읽는다
  const 걸때 = 장부.postTextSha(편폴더, 'lab-mx-youtube');
  assert.match(걸때, /^[0-9a-f]{64}$/);
  const 걸린줄 = (extra = {}) => ({ 계정: 'lab-mx-youtube', 상태: '예약됨', 시각: 판.시각, 지문: 판.지문, 게시글지문: 걸때, ...extra });
  const 큐 = () => 돌림큐(base, ['--오늘', '2026-11-11', '--일수', '6', '--알림']);
  쓰기(걸린줄());
  assert.doesNotMatch(큐().out, /걸린 돌림 판/, '게시글이 걸 때 그대로');
  // 건 뒤 제목만 고쳤다 — 판본 검수(뜻 · 글자)는 서 있고 영상도 그대로다. 고치기 전에는 여기서 경고가 없었다
  원고쓰기('Dilo con calma');
  const r = 큐();
  assert.match(r.out, /! 걸린 돌림 판의 판본이 걸린 뒤 바뀜: lab-mx-youtube · LAB_걸린글 · 공개 2026-11-12\(현지 날짜, 한국 11-13 04:00\) — 판본 MX: 건 뒤에 게시글\(제목 · 본문 · 댓글\)을 고쳤다\(예약에는 옛 글이 걸려 있다\)/);
  // 걸 때 지문을 안 적은 옛 줄 · 이미 나간 판은 조용하다
  쓰기(걸린줄({ 게시글지문: undefined }));
  assert.doesNotMatch(큐().out, /걸린 돌림 판/);
  쓰기(걸린줄({ 상태: '게시됨' }));
  assert.doesNotMatch(큐().out, /걸린 돌림 판/);
});

test('걸린 돌림 판의 게시글 지문은 그 계정 판의 글만 읽는다 — 다른 판 원고가 안 읽혀도 조용하고, 제 원고를 못 읽으면 「걸린 뒤 바뀜」(내리는 걸음)이 아닌 다른 줄로 파일 이름과 함께 알린다(다시 검수 3 P1-지1)', (t) => {
  const 장부 = require('../tools/게시장부.js');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), '예약큐-못읽음-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const base = path.join(repo, 'docs', '마케팅');
  const 편폴더 = path.join(base, 'LAB_못읽음');
  const dir = path.join(편폴더, '게시');
  fs.mkdirSync(path.join(dir, '판본', 'MX'), { recursive: true });
  fs.mkdirSync(path.join(dir, '판본', 'US'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'tools'), { recursive: true });
  const video = path.join(dir, '판본', 'MX', 'video.mp4'), text = path.join(dir, '판본', 'MX', '글.json'), 원고 = path.join(dir, '판본', 'MX', '원고_youtube.json');
  const 남의원고 = path.join(dir, '판본', 'US', '원고_youtube.json');
  fs.writeFileSync(video, 'mx-1');
  fs.writeFileSync(path.join(dir, '판본', 'US', 'video.mp4'), 'us-1');
  fs.writeFileSync(text, '{"줄":[]}');
  const 좋은 = JSON.stringify({ brand: 'LAB', platform: 'youtube', language: 'es', title: 'Di esto con calma', caption: 'Una frase coreana para decir con calma.' });
  fs.writeFileSync(원고, 좋은);
  fs.writeFileSync(남의원고, JSON.stringify({ brand: 'LAB', platform: 'youtube', language: 'en', title: 'Say it calmly', caption: 'A Korean line to say calmly.' }));
  const sha = (f) => require('node:crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  fs.writeFileSync(path.join(base, 'sns-계정.json'), JSON.stringify({ accounts: { 'lab-mx-youtube': 나라계정('America/Mexico_City', { countryCode: 'MX' }), 'lab-us-youtube': 나라계정('America/New_York', { countryCode: 'US' }) } }));
  const 판 = { 계정: 'lab-mx-youtube', 시각: '2026-11-12T13:00:00-06:00', 파일: '게시/판본/MX/video.mp4', 원고: '게시/판본/MX/원고_youtube.json', 돌림: true, 지문: sha(video) };
  // 이미 나간 다른 판(미국판) — 같은 편의 준비.json에 남아 있다
  const 남의판 = { 계정: 'lab-us-youtube', 시각: '2026-11-09T13:00:00-05:00', 파일: '게시/판본/US/video.mp4', 원고: '게시/판본/US/원고_youtube.json', 돌림: true };
  let 판본원고 = { 원고: { youtube: '게시/판본/MX/원고_youtube.json' } };
  const 쓰기 = (줄) => 편('LAB_못읽음', { 브랜드: 'LAB', 슬롯: '2026-11-02', 성격: '상시', 제목: '못 읽는 원고',
    돌림: { 형식: '이야기', 판본: { MX: { 언어: 'es', 파일: '게시/판본/MX/video.mp4', 글: '게시/판본/MX/글.json', ...판본원고,
      검수: { 뜻: { 결과: '통과', 지문: sha(text) }, 글자: { 결과: '통과', 지문: sha(video) } } } } },
    판: [남의판, 판] }, { 판: [{ 계정: 'lab-us-youtube', 상태: '게시됨', 시각: 남의판.시각 }, 줄] }, base);
  쓰기({ 계정: 'lab-mx-youtube', 상태: '실패' });
  const 걸때 = 장부.postTextSha(편폴더, 'lab-mx-youtube');
  const 걸린줄 = { 계정: 'lab-mx-youtube', 상태: '예약됨', 시각: 판.시각, 지문: 판.지문, 게시글지문: 걸때 };
  쓰기(걸린줄);
  const 큐 = () => 돌림큐(base, ['--오늘', '2026-11-11', '--일수', '6', '--알림']);
  assert.doesNotMatch(큐().out, /걸린 돌림 판/);
  // 가) 이미 나간 다른 판의 원고에 병합 충돌 표식 한 줄 — 걸린 멕시코판의 글은 그대로다. 고치기 전에는 「걸린 뒤 바뀜 … 예약을 내리고」가 떴다(헛내림)
  const 깨진 = (s) => `<<<<<<< HEAD\n${s}`;
  fs.writeFileSync(남의원고, 깨진(fs.readFileSync(남의원고, 'utf8')));
  assert.equal(장부.postTextSha(편폴더, 'lab-mx-youtube'), 걸때, '다른 판 원고가 안 읽혀도 이 판의 지문은 읽힌다');
  assert.doesNotMatch(큐().out, /걸린 돌림 판/, '다른 판 원고가 안 읽히는 것은 이 판의 일이 아니다');
  // 나) 걸린 판 제 원고가 안 읽힌다 — 견줄 수 없다는 줄이 따로 뜨고(못 읽은 파일 이름), 「걸린 뒤 바뀜」 · 「예약을 내리고」는 뜨지 않는다
  fs.writeFileSync(원고, 깨진(좋은));
  // 나-1) 판본 「원고」 지도에 든 원고 — 판본 상태(원고 고칠 것)가 먼저 못 읽는다: 고치기 전에는 이것도 「걸린 뒤 바뀜 … 예약을 내리고」였다
  const s = 큐();
  assert.match(s.out, /! 걸린 돌림 판의 판본 상태를 읽지 못함: lab-mx-youtube · LAB_못읽음 · 공개 2026-11-12\(현지 날짜, 한국 11-13 04:00\) — 판본 MX: 원고 고칠 것 — youtube: 원고를 못 읽는다\(게시\/판본\/MX\/원고_youtube\.json\)\. 예약은 내리지 않는다/);
  assert.doesNotMatch(s.out, /판본이 걸린 뒤 바뀜:/);
  assert.doesNotMatch(s.out, /예약을 내리고/);
  // 나-2) 판에만 적힌 원고(판본 지도에 없음) — 판본 상태는 서 있고 게시글 지문 견줌이 못 읽는다
  판본원고 = {};
  쓰기(걸린줄);
  const r = 큐();
  assert.match(r.out, /! 걸린 돌림 판의 게시글을 읽지 못함: lab-mx-youtube · LAB_못읽음 · 공개 2026-11-12\(현지 날짜, 한국 11-13 04:00\) — 판본 MX: 건 뒤의 게시글을 읽지 못해 걸 때 글과 견줄 수 없다\(못 읽은 파일 게시\/판본\/MX\/원고_youtube\.json — /);
  assert.match(r.out, /예약은 내리지 않는다 — 게시\/판본\/MX\/원고_youtube\.json을\(를\) 읽히게 고친 뒤/);
  assert.doesNotMatch(r.out, /판본이 걸린 뒤 바뀜:/);
  assert.doesNotMatch(r.out, /예약을 내리고/);
  assert.doesNotMatch(r.sent, /걸린 돌림 판/, '텔레그램에는 넣지 않는다');
  // 다) 읽히게 고치면 조용하고, 읽힌 글이 걸 때와 다르면 그때 「걸린 뒤 바뀜」이다
  fs.writeFileSync(원고, 좋은);
  assert.doesNotMatch(큐().out, /걸린 돌림 판/);
  fs.writeFileSync(원고, 좋은.replace('Di esto', 'Dilo'));
  assert.match(큐().out, /! 걸린 돌림 판의 판본이 걸린 뒤 바뀜: lab-mx-youtube .*건 뒤에 게시글\(제목 · 본문 · 댓글\)을 고쳤다/);
});
