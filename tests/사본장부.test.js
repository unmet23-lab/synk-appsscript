'use strict';

// 사본 장부 — 임시 git 저장소와 지어낸 앱 세션 기록으로만 본다. 실제 사본 · 앱 기록은 읽지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 장부도구 = require('../tools/사본장부.js');

const 하루 = 86400000;
const 고른 = (p) => p.replace(/\\/g, '/');
const g = (폴더, 인자) => {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', '-c', 'user.name=시험', '-c', 'user.email=t@example.invalid', ...인자], { cwd: 폴더, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`git ${인자.join(' ')} 실패: ${r.stderr}`);
  return r.stdout;
};
/** origin(맨 저장소) + 공용 작업본 + .claude/worktrees 아래 사본들 */
function 저장소만들기(이름, 사본이름들 = []) {
  const 방 = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `synk-copies-${이름}-`)));
  const origin = path.join(방, 'origin.git'), 공용 = path.join(방, 'main');
  g(방, ['init', '-q', '--bare', '-b', 'master', origin]);
  g(방, ['clone', '-q', origin, 공용]);
  fs.writeFileSync(path.join(공용, '.gitignore'), 'node_modules/\nout/\n.claude/\n');
  fs.writeFileSync(path.join(공용, 'a.txt'), '가\n');
  g(공용, ['add', '-A']); g(공용, ['commit', '-q', '-m', '처음']); g(공용, ['push', '-q', 'origin', 'HEAD:master']); g(공용, ['fetch', '-q', 'origin']);
  const 사본 = {};
  for (const n of 사본이름들) { 사본[n] = path.join(공용, '.claude', 'worktrees', n); g(공용, ['worktree', 'add', '-q', '--detach', 사본[n], 'origin/master']); }
  return { 방, 공용, 사본, 치우기: () => fs.rmSync(방, { recursive: true, force: true, maxRetries: 3 }) };
}
const 세션 = (id, 폴더, 더 = {}) => ({ id, cli: null, 폴더들: [고른(폴더).toLowerCase()], 제목: `제목 ${id}`, 보관: false, 마지막: 0, 예약: null, ...더 });
const 조용한옵션 = (s, 더 = {}) => ({ 저장소: s.공용, 장부폴더: path.join(s.방, '장부'), 명령줄들: () => '', 지금: Date.now() + 10 * 하루, ...더 });

test('갈래: 경로만 보고 자리를 나눈다', () => {
  const 뿌리 = 'C:/Users/me/Documents/SYNK-appsscript';
  const 집 = 고른(os.homedir());
  const 로컬 = 고른(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'));
  const 본 = (p, 첫째 = false) => 장부도구.갈래(p, 뿌리, 첫째);
  assert.equal(본(뿌리, true), '공용 작업본');
  assert.equal(본(`${뿌리}/.claude/worktrees/happy-nash`), 'Claude 사본');
  assert.equal(본('D:/SYNK-worktrees/SYNK-appsscript/funny-meitner'), 'Claude 사본');
  assert.equal(본(`${뿌리}/.codex/worktrees/atlas-core`), 'GPT 사본');
  assert.equal(본(`${집}/.codex/worktrees/path-live/SYNK-appsscript`), 'GPT 사본');
  assert.equal(본(`${집}/Documents/SYNK-worktrees/sns-agg`), 'GPT 사본');
  assert.equal(본(`${로컬}/synk/ops/SYNK-appsscript`), '운영 사본');
  assert.equal(본(`${로컬}/hermes/runtime/synk-tasks/synk-1/workspace`), '헤르메스');
  assert.equal(본(`${로컬}/Temp/claude/abc/11111111-2222-3333-4444-555555555555/scratchpad/rec-wt`), '세션 임시');
  assert.equal(본(`${로컬}/synk/기록닫기/wt-1`), '도구 임시');
  assert.equal(본('E:/어딘가/사본'), '그 밖');
});

test('세션 읽기 · 방 고르기: 가장 늦게 바뀐 방을 고르고, 못 읽은 기록은 다른 방에서 읽어 보고 그래도 안 되면 센다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-copies-room-'));
  try {
    const 옛방 = path.join(방, '계정1', '조직'), 새방 = path.join(방, '계정2', '조직');
    fs.mkdirSync(옛방, { recursive: true }); fs.mkdirSync(새방, { recursive: true });
    const 기록 = (폴더, 이름, 값, 때) => { const p = path.join(폴더, 이름); fs.writeFileSync(p, typeof 값 === 'string' ? 값 : JSON.stringify(값)); if (때) fs.utimesSync(p, new Date(때), new Date(때)); };
    기록(옛방, 'local_a.json', { sessionId: 'local_a', cwd: 'C:\\x\\Repo', title: '옛 판' }, Date.now() - 하루);
    기록(옛방, 'local_b.json', { sessionId: 'local_b', cwd: 'C:\\x\\Repo', title: '다른 방에서 읽은 기록' }, Date.now() - 하루);
    기록(새방, 'local_a.json', { sessionId: 'local_a', cliSessionId: 'cli-a', cwd: 'C:\\x\\Repo\\.claude\\worktrees\\One\\', worktreePath: 'D:\\wt\\one', shellFolders: ['C:\\x\\Repo', 'D:\\wt\\two\\docs', 7], title: '가 세션', isArchived: true, lastActivityAt: 1234, scheduledTaskId: 'sched-1' });
    기록(새방, 'local_b.json', '{쓰는 중이라 깨진');
    기록(새방, 'local_c.json', '{어느 방에도 멀쩡한 판이 없는');
    기록(새방, 'other.json', { sessionId: 'x' });
    assert.equal(장부도구.세션방고르기([옛방, 새방, path.join(방, '없는방')]), 새방);
    assert.equal(장부도구.세션방고르기([path.join(방, '없는방')]), null);
    const r = 장부도구.세션읽기(새방, [옛방, 새방]);
    assert.equal(r.못읽음, 1);
    assert.deepEqual(r.세션, [
      { id: 'local_a', cli: 'cli-a', 제폴더들: ['c:/x/repo/.claude/worktrees/one', 'd:/wt/one'], 폴더들: ['c:/x/repo/.claude/worktrees/one', 'd:/wt/one', 'c:/x/repo', 'd:/wt/two/docs'], 제목: '가 세션', 보관: true, 마지막: 1234, 예약: 'sched-1' },
      { id: 'local_b', cli: null, 제폴더들: ['c:/x/repo'], 폴더들: ['c:/x/repo'], 제목: '다른 방에서 읽은 기록', 보관: false, 마지막: 0, 예약: null },
    ]);
    assert.equal(장부도구.세션읽기(새방).못읽음, 2);
    assert.equal(장부도구.세션읽기(path.join(방, '없는방')), null);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('세션 잇기: 세션의 폴더가 사본이거나 그 아래면 붙고, 세션 임시 폴더는 경로 속 세션 id로 붙는다', () => {
  const 세션들 = [세션('s1', 'D:/wt/One'), 세션('s2', 'C:/main', { cli: '11111111-2222-3333-4444-555555555555' }), 세션('s3', 'C:/other'),
    세션('s4', 'C:/main', { 폴더들: ['c:/main', 'd:/wt/hand-made/docs/마케팅'] })];   // Fable 검수 P1 — 공용 작업본 세션이 셸로 들어가 일하는 손으로 만든 사본
  assert.deepEqual(장부도구.세션잇기('d:\\WT\\one\\', 세션들).map((s) => s.id), ['s1']);
  assert.deepEqual(장부도구.세션잇기('D:/wt/hand-made', 세션들).map((s) => s.id), ['s4']);
  assert.deepEqual(장부도구.세션잇기('D:/wt/hand', 세션들), [], '이름 앞부분만 같은 사본에는 안 붙는다');
  assert.deepEqual(장부도구.세션잇기('C:/Users/me/AppData/Local/Temp/claude/ab12/11111111-2222-3333-4444-555555555555/scratchpad/rec-wt', 세션들).map((s) => s.id), ['s2']);
  assert.deepEqual(장부도구.세션잇기('C:/nowhere', 세션들), []);
});

test('상태 읽기: 올리지 않은 것과, 다시 만들 수 없는 무시 파일을 나눈다', () => {
  const r = 장부도구.상태읽기([' M a.txt', '?? 새파일.md', '!! node_modules/', '!! out/영상.mp4', '!! 깊은/__pycache__/x.pyc', ''].join('\0'));
  assert.deepEqual(r, { 변경: 2, 살필무시: ['out/영상.mp4'] });
  assert.deepEqual(장부도구.상태읽기(''), { 변경: 0, 살필무시: [] });
});

test('관리 움직임: logs/HEAD는 수정 시각과 끝 줄에 적힌 시각 가운데 이른 쪽을 본다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-copies-admin-'));
  try {
    fs.mkdirSync(path.join(방, 'logs'));
    const 옛 = Date.now() - 9 * 하루, 적힌 = Math.floor((Date.now() - 6 * 하루) / 1000);
    fs.writeFileSync(path.join(방, 'HEAD'), 'x'); fs.utimesSync(path.join(방, 'HEAD'), new Date(옛), new Date(옛));
    fs.writeFileSync(path.join(방, 'logs', 'HEAD'), `0 1 이름 <a@b> ${적힌 - 100} +0900\tcheckout\n0 1 이름 <a@b> ${적힌} +0900\tcommit\n`);   // 수정 시각은 지금
    assert.equal(장부도구.관리움직임(방), 적힌 * 1000);
    assert.equal(장부도구.관리움직임(null), 0);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('판정: 잠김 · 프로세스 · 최근 움직임 · 올리지 않은 변경 · origin에 없는 커밋이면 조건이 안 찬다', () => {
  const s = 저장소만들기('verdict', ['clean', 'dirty', 'ahead', 'ignored']);
  try {
    const 지금 = Date.now();
    const 본 = (이름, 더 = {}, 환경 = {}) => 장부도구.판정({ 경로: 고른(s.사본[이름]), 머리: g(s.사본[이름], ['rev-parse', 'HEAD']).trim(), 잠김: false, 움직임: 지금 - 5 * 하루, ...더 }, { 뿌리: s.공용, 지금, 명령줄: '', ...환경 });
    assert.deepEqual(본('clean'), { 조건참: true, 까닭: '깨끗 · origin에 있음 · 3일 조용' });
    assert.match(본('clean', { 잠김: '입력으로 읽는 중' }).까닭, /잠겨 있다 — 입력으로 읽는 중/);
    assert.match(본('clean', {}, { 명령줄: `node ${고른(s.사본.clean).toLowerCase()}/tools/x.js` }).까닭, /쓰는 프로세스/);
    assert.match(본('clean', {}, { 명령줄: null }).까닭, /프로세스 목록을 못 읽었다/);
    assert.match(본('clean', { 움직임: 지금 - 하루 }).까닭, /3일 안에 움직였다/);
    assert.match(본('clean', { 경로: 고른(path.join(s.방, '없는사본')) }).까닭, /폴더가 없다/);
    fs.writeFileSync(path.join(s.사본.dirty, '새파일.txt'), 'x');
    assert.deepEqual(본('dirty'), { 조건참: false, 까닭: '올리지 않은 변경 1개' });
    fs.writeFileSync(path.join(s.사본.ahead, 'a.txt'), '나\n'); g(s.사본.ahead, ['commit', '-q', '-am', '안 올린 커밋']);
    assert.deepEqual(본('ahead'), { 조건참: false, 까닭: 'origin에 없는 커밋이 있다' });
    fs.mkdirSync(path.join(s.사본.ignored, 'node_modules')); fs.writeFileSync(path.join(s.사본.ignored, 'node_modules', 'm.js'), 'x');
    fs.mkdirSync(path.join(s.사본.ignored, 'out')); fs.writeFileSync(path.join(s.사본.ignored, 'out', '영상.mp4'), 'x');
    assert.deepEqual(본('ignored'), { 조건참: true, 까닭: '깨끗 · origin에 있음 · 3일 조용', 살필무시: ['out'] });
  } finally { s.치우기(); }
});

test('장부 만들기: 쓰는 중 · 치워도 됨(끝난 세션) · 임자 모름(기록에 없음) · 옮긴 뒤 치움(git 밖 파일) · 남김을 가른다', () => {
  const s = 저장소만들기('ledger', ['live', 'orphan', 'ended', 'busy', 'shell', 'media', 'visited', 'handmedia']);
  try {
    fs.writeFileSync(path.join(s.사본.busy, '새파일.txt'), 'x');
    for (const n of ['media', 'handmedia']) { fs.mkdirSync(path.join(s.사본[n], 'out')); fs.writeFileSync(path.join(s.사본[n], 'out', '영상.mp4'), 'x'); }
    const 공용키 = 고른(s.공용).toLowerCase();
    const 세션들 = [
      세션('local_1', s.사본.live, { 제목: '사는 세션', 마지막: Date.now() }),
      세션('local_2', s.사본.ended, { 제목: '끝난 세션', 보관: true, 마지막: Date.now() - 20 * 하루 }),
      세션('local_3', s.공용, { 제목: '공용에서 일하는 세션', 제폴더들: [공용키], 폴더들: [공용키, `${고른(s.사본.shell).toLowerCase()}/docs`] }),
      세션('local_4', s.사본.media, { 제목: '영상 만든 세션', 보관: true }),
      세션('local_5', s.공용, { 제목: '들르기만 한 끝난 세션', 보관: true, 제폴더들: [공용키], 폴더들: [공용키, 고른(s.사본.visited).toLowerCase()] }),
    ];
    const 장부 = 장부도구.장부만들기(조용한옵션(s, { 세션들 }));
    const 행 = Object.fromEntries(장부.사본.map((r) => [r.이름, r]));
    assert.deepEqual(Object.keys(행).sort(), ['busy', 'ended', 'handmedia', 'live', 'media', 'orphan', 'shell', 'visited']);
    // Fable 둘째 검수 — 끝난 세션이 셸로 들르기만 한 사본 · git 밖 파일이 있는 손 사본도 「임자 모름」이다(「치워도 됨」 · 「옮긴 뒤 치움」으로 빠지지 않는다)
    assert.equal(행.visited.상태, '임자 모름');
    assert.match(행.visited.까닭, /끝난 세션이 셸로 들르기만 한 사본/);
    assert.equal(행.visited.끝난세션, undefined);
    assert.deepEqual([행.handmedia.상태, 행.handmedia.살필무시], ['임자 모름', ['out']]);
    assert.match(행.handmedia.까닭, /git 밖 파일 1곳을 먼저 옮길 것 · 세션 기록에 없는 사본/);
    assert.equal(장부.사본.every((r) => r.갈래 === 'Claude 사본'), true);
    assert.deepEqual([행.live.상태, 행.live.까닭], ['쓰는 중', '세션 「사는 세션」']);
    assert.deepEqual([행.shell.상태, 행.shell.까닭], ['쓰는 중', '세션 「공용에서 일하는 세션」'], '셸로 들어가 쓰는 사본도 쓰는 중이다');
    assert.deepEqual([행.ended.상태, 행.ended.끝난세션], ['치워도 됨', '끝난 세션']);
    assert.equal(행.orphan.상태, '임자 모름');   // Fable 검수 P1 — 세션 기록에 없는 사본을 「치워도 됨」이라고 하지 않는다
    assert.match(행.orphan.까닭, /세션 기록에 없는 사본/);
    assert.deepEqual([행.media.상태, 행.media.살필무시], ['옮긴 뒤 치움', ['out']]);   // Fable 검수 P2 — 다시 못 만드는 파일이 있으면 같은 「치워도 됨」이 아니다
    assert.deepEqual([행.busy.상태, 행.busy.까닭], ['남김', '올리지 않은 변경 1개']);
    assert.equal(장부.요약.등록, 8);
    assert.equal(장부.요약.쓰는중.곳, 2);
    const m = 장부.요약.임자없음;
    assert.deepEqual([m.곳, m.치워도됨.곳, m.옮긴뒤치움.곳, m.임자모름.곳], [6, 1, 1, 3]);
    // 이 세션 것만
    assert.deepEqual(장부도구.내것만(장부, { CLAUDE_CODE_HOST_SESSION_ID: 'local_1' }).사본.map((r) => r.이름), ['live']);
    assert.deepEqual(장부도구.내것만(장부, { CLAUDE_CODE_HOST_SESSION_ID: 'local_3' }).사본.map((r) => r.이름), ['shell']);
    assert.deepEqual(장부도구.내것만(장부, {}).사본, []);
    // 글 · 날마다 한 줄
    const 글 = 장부도구.글로(장부);
    assert.match(글, /■ 세션이 쓰는 사본 2곳/);
    assert.match(글, /■ 세션이 안 붙은 Claude 사본 6곳/);
    assert.match(글, /치워도 되는 것 1곳.* · 옮긴 뒤 치울 것 1곳.* · 임자 모름\(조건은 참\) 3곳/);
    장부도구.적기(장부, path.join(s.방, '장부'));
    const 줄 = 장부도구.추이(path.join(s.방, '장부'));
    assert.equal(줄.length, 1);
    assert.deepEqual([줄[0].임자없음.치워도됨.곳, 줄[0].임자없음.임자모름.곳], [1, 3]);
    assert.match(장부도구.추이글(줄), /등록/);
  } finally { s.치우기(); }
});

test('장부 만들기: 세션 기록을 못 읽었거나 못 읽은 기록이 있으면 Claude 사본을 판정하지 않고 「세션 모름」으로 둔다', () => {
  const s = 저장소만들기('norecords', ['one']);
  try {
    const 없음 = 장부도구.장부만들기(조용한옵션(s, { 세션방: path.join(s.방, '없는방') }));
    assert.deepEqual([없음.사본[0].상태, 없음.세션수], ['세션 모름', null]);
    assert.match(장부도구.글로(없음), /앱 세션 기록을 못 읽음/);
    // 기록 하나가 깨져 있으면 — 그 세션이 이 사본을 쓰는 중일 수 있다
    const 방 = path.join(s.방, '세션방');
    fs.mkdirSync(방);
    fs.writeFileSync(path.join(방, 'local_ok.json'), JSON.stringify({ sessionId: 'local_ok', cwd: s.공용, title: '멀쩡한 기록' }));
    fs.writeFileSync(path.join(방, 'local_bad.json'), '{깨진');
    const 깨짐 = 장부도구.장부만들기(조용한옵션(s, { 세션방: 방 }));
    assert.deepEqual([깨짐.사본[0].상태, 깨짐.세션수, 깨짐.못읽은세션], ['세션 모름', 1, 1]);
    assert.match(깨짐.사본[0].까닭, /못 읽은 세션 기록이 1개/);
    const m = 깨짐.요약.임자없음;
    assert.deepEqual([m.치워도됨.곳, m.임자모름.곳], [0, 0]);
    assert.match(장부도구.글로(깨짐), /못 읽은 기록 1개/);
  } finally { s.치우기(); }
});

test('크기: 한도 안에서 재어 기억하고, 다음에는 기억한 값을 쓰고, 한도 0이면 아무것도 쓰지 않는다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-copies-size-'));
  try {
    const 가 = path.join(방, '가'), 나 = path.join(방, '나'), 장부 = path.join(방, '장부');
    for (const d of [가, 나]) { fs.mkdirSync(path.join(d, '안'), { recursive: true }); fs.writeFileSync(path.join(d, '안', 'f.bin'), Buffer.alloc(3 * 1024 * 1024)); }
    const 사본들 = (움직임 = 0) => [{ 경로: 고른(가), 움직임 }, { 경로: 고른(나), 움직임: 0 }, { 경로: 고른(path.join(방, '없는사본')), 움직임: 0 }];
    const 안잼 = 사본들(); 장부도구.크기붙이기(안잼, 장부, 0);
    assert.deepEqual(안잼.map((x) => x.GB), [null, null, null]);
    assert.equal(fs.existsSync(장부), false, '한도 0이면 장부 폴더도 만들지 않는다');
    const 잼 = 사본들(); 장부도구.크기붙이기(잼, 장부, 30);
    assert.deepEqual(잼.map((x) => x.GB), [0, 0, null]);   // 3MB는 0.00GB로 반올림된다
    const 기억읽기 = () => JSON.parse(fs.readFileSync(path.join(장부, '크기.json'), 'utf8'));
    assert.equal(기억읽기()[고른(가).toLowerCase()].바이트, 3 * 1024 * 1024);
    fs.writeFileSync(path.join(가, '안', 'g.bin'), Buffer.alloc(1024));
    const 기억 = 사본들(); 장부도구.크기붙이기(기억, 장부, 0);
    assert.equal(기억[0].잰때, 잼[0].잰때, '한도 0이면 다시 재지 않는다');
    // 잰 뒤에 움직인 사본만 다시 잰다
    const 다시 = 사본들(Date.now() + 1000); 장부도구.크기붙이기(다시, 장부, 30);
    assert.equal(기억읽기()[고른(가).toLowerCase()].바이트, 3 * 1024 * 1024 + 1024);
    assert.equal(다시[1].잰때, 잼[1].잰때);
    // 사라진 사본의 기억은 잴 때 지운다
    장부도구.크기붙이기([{ 경로: 고른(path.join(방, '다른사본')), 움직임: 0 }], 장부, 5);
    assert.deepEqual(Object.keys(기억읽기()), []);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('인자 읽기', () => {
  assert.deepEqual(장부도구.인자읽기(['--내것', '--크기', '--json']), { 내것: true, 전부: false, 크기초: 120, 적기: false, json: true, 추이: null, 저장소: undefined, 세션방: undefined });
  assert.equal(장부도구.인자읽기(['--크기', '600', '--적기', '--전부']).크기초, 600);
  assert.equal(장부도구.인자읽기(['--추이']).추이, 14);
  assert.throws(() => 장부도구.인자읽기(['--지워']), /모르는 선택지/);
});
