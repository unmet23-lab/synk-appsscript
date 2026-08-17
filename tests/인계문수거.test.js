/* 인계문수거 회귀 — 죽은 세션의 인계문만 거두고, 살아있는 세션 것은 절대 안 거두는가 (F111).
 *
 * 왜 있나: 세션별 인계문은 「그 세션의 /close」만이 커밋하는데, /close 는 인계문을 커밋 뒤에
 *   쓰고(순서 결함) 죽은 세션은 /close 자체를 못 한다. 미추적 인계문은 목차 재생성 TTL 12h 가
 *   지우면 영영 유실이다(F025). 이 도구가 그 구멍을 기계로 막는다 — 대신 이 도구가 넓게 새면
 *   「살아있는 세션의 작업본을 거둬 가는」 F073 형태의 사고가 되므로, 여기서는 **거두는 쪽**과
 *   **안 거두는 쪽**을 같은 무게로 고정한다(통과 목록도 차단 목록과 같은 무게 — CLAUDE.md).
 *
 * 검사 방식 — 픽스처 저장소 + 픽스처 심장박동(SYNK_OWNER_ROOT · SYNK_CTXBUDGET_DIR 이음매).
 *   실저장소 검사는 없다 — 실저장소의 인계문 상태는 세션마다 달라 불안정 테스트가 된다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process'); // git 재현용 — node 자식은 아래 통로로 띄운다
const { 훅띄우기 } = require('./lib/훅띄우기');

const TOOL = path.resolve(__dirname, '..', 'tools', '인계문수거.js');
const store = require(path.resolve(__dirname, '..', '.claude', 'hooks', 'lib', 'handoff-store.js'));

const git있나 = (() => { const r = spawnSync('git', ['--version'], { encoding: 'utf8' }); return !r.error && r.status === 0; })();

const 폴더 = 'docs/_ops/인계문';
const 목차 = 'docs/_ops/인계문.md';

const 임시들 = [];
function 픽스처() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-handoff-repo-'));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-handoff-state-'));
  임시들.push(repo, state);
  const g = (...a) => spawnSync('git', ['-c', 'core.quotepath=false', ...a], { cwd: repo, encoding: 'utf8' });
  g('init', '-q');
  // 도구 내부의 commit 은 저장소 설정을 그대로 쓴다 — 픽스처에 신원을 심어 CI 에서도 돌게 한다.
  g('config', 'user.name', 't'); g('config', 'user.email', 't@t'); g('config', 'commit.gpgsign', 'false');
  fs.mkdirSync(path.join(repo, 폴더), { recursive: true });
  fs.writeFileSync(path.join(repo, 목차), '# 목차 seed\n');
  fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed\n');
  g('add', '-A'); g('commit', '-qm', 'seed');
  return { repo, state, g };
}
function 인계문두기(repo, sid8, 내용) {
  const p = path.join(repo, 폴더, `${sid8}.md`);
  fs.writeFileSync(p, 내용 || `<!-- at:1 -->\n## 세션 ${sid8}\n\n\`\`\`\n다음 할 일\n\`\`\`\n`);
  return p;
}
/** track-collision 과 같은 이름 규칙으로 심장박동을 놓는다(작업본소유자.test.js 와 같은 헬퍼). */
function 심장박동(state, repo, sid, 분전) {
  const p = path.join(state, `track-${store.projectKey(repo)}-${store.safeId(sid)}.json`);
  fs.writeFileSync(p, JSON.stringify({ baseline: 'x', lastHead: 'x', touched: [], warned: [] }));
  const t = new Date(Date.now() - 분전 * 60000);
  fs.utimesSync(p, t, t);
}
function 돌린다({ repo, state, 나, 인자 = [], env추가 = {} }) {
  const env = { ...process.env, SYNK_OWNER_ROOT: repo, SYNK_CTXBUDGET_DIR: state, ...env추가 };
  if (나 === undefined) delete env.CLAUDE_CODE_HOST_SESSION_ID; else env.CLAUDE_CODE_HOST_SESSION_ID = 나;
  // 통과코드 0·2 = 이 도구의 계약(0 정상 / 2 인자 오류). 그 밖은 안 떴거나 터진 것이라 결과가 아니다.
  return 훅띄우기([TOOL, ...인자], { encoding: 'utf8', env, 통과코드: [0, 2] });
}
function 커밋수(g) { const r = g('rev-list', '--count', 'HEAD'); return Number(String(r.stdout).trim()); }
function 마지막커밋파일들(g) {
  return String(g('show', '--name-only', '--format=', 'HEAD').stdout).split(/\r?\n/).filter(Boolean);
}

test.after(() => { for (const d of 임시들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} } });

test('🔴 죽은 세션의 미추적 인계문을 거둔다 — 내용이 이력에 실린다(F025 보호)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state, g } = 픽스처();
  인계문두기(repo, 'dead0001', '<!-- at:1 -->\n## 세션 dead0001\n\n유실되면 안 되는 본문\n');
  심장박동(state, repo, 'local_dead0001-aaaa-bbbb', 400);   // 끝난 지 오래
  const 전 = 커밋수(g);
  const r = 돌린다({ repo, state, 나: 'local_me000000', 인자: ['--실행'] });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(커밋수(g), 전 + 1, '수거 커밋이 안 생겼다');
  assert.ok(마지막커밋파일들(g).includes(`${폴더}/dead0001.md`), '죽은 세션 파일이 커밋에 없다');
  const 실린내용 = String(g('show', `HEAD:${폴더}/dead0001.md`).stdout);
  assert.ok(실린내용.includes('유실되면 안 되는 본문'), '내용이 이력에 안 실렸다 — 보호가 목적이다');
  assert.match(String(r.stdout), /커밋했다/);
});

test('🔴 심장박동이 아예 없는 세션(기록 소실)도 죽은 것으로 보고 거둔다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state, g } = 픽스처();
  인계문두기(repo, 'ghost001');
  const r = 돌린다({ repo, state, 나: 'local_me000000', 인자: ['--실행'] });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(마지막커밋파일들(g).includes(`${폴더}/ghost001.md`));
});

test('🔴 살아있는 세션의 인계문은 절대 안 거둔다 — 보류로 보고한다 (새는 방향이 곧 F073 이다)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state, g } = 픽스처();
  인계문두기(repo, 'alive001');
  심장박동(state, repo, 'local_alive001-cccc', 1);          // 지금 돌고 있다
  const 전 = 커밋수(g);
  const r = 돌린다({ repo, state, 나: 'local_me000000', 인자: ['--실행'] });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(커밋수(g), 전, '살아있는 세션 파일로 커밋이 생겼다 — 이 도구가 사고가 됐다');
  assert.match(String(r.stdout), /보류[\s\S]*alive001/, '왜 안 거뒀는지(보류)를 안 알려줬다');
  const st = String(g('status', '--porcelain', '-uall').stdout);
  assert.ok(st.includes('alive001.md'), '파일이 사라졌다 — 남겨야 한다');
});

test('내 세션 파일은 살아있어도 거둔다 — /close 6단계의 자기 인계문 커밋 자리', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state, g } = 픽스처();
  인계문두기(repo, 'me000000');
  심장박동(state, repo, 'local_me000000-dddd', 1);          // 나 자신 = 살아있음
  const r = 돌린다({ repo, state, 나: 'local_me000000-dddd', 인자: ['--실행'] });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(마지막커밋파일들(g).includes(`${폴더}/me000000.md`), '내 파일이 커밋에 없다');
});

test('🔴 범위 밖 방관자는 절대 안 실린다 — 남의 스테이징이 올라와 있어도(pathspec 이 못박는다)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state, g } = 픽스처();
  인계문두기(repo, 'dead0002');
  fs.writeFileSync(path.join(repo, '방관자.txt'), '남의 미커밋\n');
  fs.appendFileSync(path.join(repo, 'seed.txt'), '남의 수정\n');
  g('add', '--', '방관자.txt');                              // 남의 세션이 스테이징까지 해 둔 상황
  const r = 돌린다({ repo, state, 나: 'local_me000000', 인자: ['--실행'] });
  assert.strictEqual(r.status, 0, r.stderr);
  const 실림 = 마지막커밋파일들(g);
  assert.ok(실림.includes(`${폴더}/dead0002.md`));
  assert.ok(!실림.includes('방관자.txt') && !실림.includes('seed.txt'),
    `범위 밖이 커밋에 실렸다: ${실림.join(', ')}`);
  const st = String(g('status', '--porcelain', '-uall').stdout);
  assert.ok(st.includes('방관자.txt') && st.includes('seed.txt'), '방관자 미커밋이 보존되지 않았다');
});

test('세션 파일 꼴이 아닌 이름(한글·비 md)은 주인을 특정 못 하므로 스킵하고 보고한다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state, g } = 픽스처();
  fs.writeFileSync(path.join(repo, 폴더, '한글이름.md'), 'x\n');
  const 전 = 커밋수(g);
  const r = 돌린다({ repo, state, 나: 'local_me000000', 인자: ['--실행'] });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(커밋수(g), 전, '잡파일만으로 커밋이 생겼다');
  assert.match(String(r.stdout), /스킵[\s\S]*한글이름\.md/);
});

test('추적-수정·추적-삭제(TTL 청소 자국)도 주인이 죽었으면 거둔다 — 안 거두면 영영 더럽다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state, g } = 픽스처();
  const 수정 = 인계문두기(repo, 'dead0003');
  const 삭제 = 인계문두기(repo, 'dead0004');
  g('add', '-A'); g('commit', '-qm', '두 세션 파일이 이미 추적됨');
  fs.appendFileSync(수정, '재종료로 덧쓴 블록\n');
  fs.unlinkSync(삭제);                                       // 목차 재생성 TTL 이 지운 모양
  const r = 돌린다({ repo, state, 나: 'local_me000000', 인자: ['--실행'] });
  assert.strictEqual(r.status, 0, r.stderr);
  const 실림 = 마지막커밋파일들(g);
  assert.ok(실림.includes(`${폴더}/dead0003.md`) && 실림.includes(`${폴더}/dead0004.md`),
    `수정·삭제가 커밋에 없다: ${실림.join(', ')}`);
  const st = String(g('status', '--porcelain', '-uall', '--', 폴더).stdout).trim();
  assert.strictEqual(st, '', `수거 뒤에도 인계문 자리가 더럽다: ${st}`);
});

/* ── F257 — 「수거 N건」이 삭제를 그 수에 포함했다 ──────────────────────────
 * 실물: 40f763e 제목 「3건」 = 실제 보호 1 + 만료 2 · 64d6b9b 「6건」 = 1 + 5.
 * 손해는 이력 오독이다 — 커밋 목록만 보면 「N건을 보호했다」로 읽히는데, 그 중 일부는
 * 보호가 아니라 TTL 이 이미 지운 것의 정리다(반대 사건이 한 수에 합쳐져 있었다).
 * 🔑 **동작은 안 바꾼다** — 삭제도 그대로 커밋에 실어야 인계문 자리가 안 더럽다(위 회귀).
 *   가르는 것은 세는 이름뿐이라, 아래 두 단언은 **같은 커밋**을 두 각도로 잰다. */
test('🔴 [F257] 제목이 「보호」와 「만료 정리」를 따로 센다 — 합치면 삭제가 보호로 읽힌다',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo, state, g } = 픽스처();
    const 만료 = 인계문두기(repo, 'dead0007', '## 만료될 세션\n오래된 인계 블록\n');
    g('add', '-A'); g('commit', '-qm', '만료될 파일이 이미 추적됨');
    fs.unlinkSync(만료);              // TTL 12h 가 지운 자국 — 보호가 아니라 정리 대상이다
    /* 🔴 내용을 **일부러 다르게** 준다 — 기본 템플릿을 두 번 쓰면 두 파일이 거의 같아서
     *   git 이 삭제+추가를 `{dead0007.md => dead0008.md}` **이름 변경**으로 합친다.
     *   그러면 `--name-only` 에 새 이름만 나와, 도구가 삭제를 제대로 실었는데도 안 실은 것처럼
     *   보인다(실측 1회 — 재는 층이 값을 바꾼 자리다). 실물 인계문은 세션마다 내용이 달라 안 걸린다. */
    인계문두기(repo, 'dead0008', '## 살아 있던 세션의 인계\n전혀 다른 본문 · 유실되면 안 된다\n');

    const r = 돌린다({ repo, state, 나: 'local_me000000', 인자: ['--실행'] });
    assert.strictEqual(r.status, 0, r.stderr);

    const 제목 = String(g('log', '-1', '--format=%s').stdout).trim();
    assert.match(제목, /죽은 세션 1건/, `보호 건수가 틀렸다 — 삭제가 섞였다: ${제목}`);
    assert.match(제목, /만료 정리 1건/, `만료를 제목에서 안 밝혔다: ${제목}`);
    assert.doesNotMatch(제목, /죽은 세션 2건/, `삭제를 보호로 셌다 — F257 그대로다: ${제목}`);

    const 본문 = String(g('log', '-1', '--format=%b').stdout);
    assert.match(본문, /만료 정리[\s\S]*dead0007/, `만료가 어느 파일인지 본문에 없다:\n${본문}`);
    assert.match(본문, /수거: [^\n]*dead0008/, `수거 목록에 만료가 섞였거나 진짜 수거가 빠졌다:\n${본문}`);

    /* 동작 불변 — 둘 다 실려야 하고, 실린 뒤 그 자리는 깨끗해야 한다. */
    const 실림 = 마지막커밋파일들(g);
    assert.ok(실림.includes(`${폴더}/dead0007.md`) && 실림.includes(`${폴더}/dead0008.md`),
      `이름만 가르려다 커밋 범위가 좁아졌다: [${실림.join(', ')}]\n도구 출력:\n${r.stdout}`);
    assert.strictEqual(String(g('status', '--porcelain', '-uall', '--', 폴더).stdout).trim(), '');
  });

test('🔑 [F257] 만료만 있어도 거둔다 — 「거둘 것이 없다」로 접으면 그 자리가 영영 더럽다',
  { skip: !git있나 && 'git 없음' }, () => {
    /* 만료를 수거에서 뺀 순간 생기는 사각이다: 삭제 자국만 남은 판에서 도구가 빈손으로
     * 접으면 `git status` 가 계속 더럽고, 다음 세션마다 남의 것으로 보인다. */
    const { repo, state, g } = 픽스처();
    const 만료 = 인계문두기(repo, 'dead0009');
    g('add', '-A'); g('commit', '-qm', '추적됨');
    fs.unlinkSync(만료);

    const r = 돌린다({ repo, state, 나: 'local_me000000', 인자: ['--실행'] });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.match(String(g('log', '-1', '--format=%s').stdout), /만료 정리 1건/);
    assert.strictEqual(String(g('status', '--porcelain', '-uall', '--', 폴더).stdout).trim(), '',
      '만료만 있는 판을 안 거둬 자리가 더럽게 남았다');
  });

test('파생 목차는 세션 파일을 거둘 때만 동반 커밋한다 — 목차 홀로는 안 거둔다(소음 방지)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state, g } = 픽스처();
  fs.appendFileSync(path.join(repo, 목차), '목차 재생성 자국\n');
  const 전 = 커밋수(g);
  const 홀로 = 돌린다({ repo, state, 나: 'local_me000000', 인자: ['--실행'] });
  assert.strictEqual(홀로.status, 0, 홀로.stderr);
  assert.strictEqual(커밋수(g), 전, '목차 홀로 커밋됐다');
  인계문두기(repo, 'dead0005');
  const 동반 = 돌린다({ repo, state, 나: 'local_me000000', 인자: ['--실행'] });
  assert.strictEqual(동반.status, 0, 동반.stderr);
  const 실림 = 마지막커밋파일들(g);
  assert.ok(실림.includes(목차) && 실림.includes(`${폴더}/dead0005.md`), `동반이 안 됐다: ${실림.join(', ')}`);
});

test('진행 중인 git 작업(merge 등)에서는 거두지 않고 사유를 말한다 — 미실행과 통과를 가른다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state, g } = 픽스처();
  인계문두기(repo, 'dead0006');
  const gitdir = String(g('rev-parse', '--git-dir').stdout).trim();
  fs.writeFileSync(path.join(repo, gitdir, 'MERGE_HEAD'), '0'.repeat(40) + '\n');
  const 전 = 커밋수(g);
  const r = 돌린다({ repo, state, 나: 'local_me000000', 인자: ['--실행'] });
  assert.strictEqual(r.status, 2, '명시 실행의 실패가 조용히 0 으로 끝났다');
  assert.strictEqual(커밋수(g), 전, '진행 중 작업 위에 커밋했다');
  assert.match(String(r.stdout), /MERGE_HEAD|진행 중/);
});

test('--hook 은 빈손이면 침묵하고, 거둘 게 있으면 한 줄로 말한다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  const 빈손 = 돌린다({ repo, state, 나: 'local_me000000', 인자: ['--hook'] });
  assert.strictEqual(빈손.status, 0, 빈손.stderr);
  assert.strictEqual(String(빈손.stdout).trim(), '', '빈손인데 말했다 — 잔소리하는 장치는 읽히지 않게 된다');
  인계문두기(repo, 'dead0007');
  const 수거 = 돌린다({ repo, state, 나: 'local_me000000', 인자: ['--hook'] });
  assert.strictEqual(수거.status, 0, 수거.stderr);
  assert.match(String(수거.stdout), /1건.*커밋했다/);
});

test('기본 모드는 보고만 한다 — 커밋하지 않고 --실행 안내를 남긴다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state, g } = 픽스처();
  인계문두기(repo, 'dead0008');
  const 전 = 커밋수(g);
  const r = 돌린다({ repo, state, 나: 'local_me000000' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(커밋수(g), 전, '보고 모드가 커밋했다');
  assert.match(String(r.stdout), /--실행/);
});

test('🔑 생존 판정은 작업본소유자와 같은 손잡이 하나다 — SYNK_OWNER_ALIVE_MIN 을 함께 따른다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state, g } = 픽스처();
  인계문두기(repo, 'dead0009');
  심장박동(state, repo, 'local_dead0009-eeee', 400);
  const 전 = 커밋수(g);
  // 손잡이를 1000분으로 넓히면 400분 전 박동도 「살아있음」이어야 한다 — 판정층이 하나라는 증명.
  const r = 돌린다({ repo, state, 나: 'local_me000000', 인자: ['--실행'], env추가: { SYNK_OWNER_ALIVE_MIN: '1000' } });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(커밋수(g), 전, '수거했다 — 생존 판정이 작업본소유자와 갈라져 있다(판정층 이원화)');
  assert.match(String(r.stdout), /보류[\s\S]*dead0009/);
});

/* ── 경쟁 — 조사() 스냅샷과 add 사이에 딴 세션의 수거가 같은 경로를 먼저 커밋한다 ──────────
 * 08-07 실측: 15세션 동시 기동에서 87d2dfa 가 ba86eeb2 를 선점하자, 뒤진 세션의 수거는
 * pathspec fatal 하나로 「아직 거둘 수 있던 나머지」까지 통째로 0건이 됐다.
 * 그 창은 프로세스 안이라 CLI 로는 재현이 안 된다 — 낡은 스냅샷 r 을 직접 만들어
 * 실행() 에 넣는다(존재한 적 없는 경로 = 남이 먼저 거둬 사라진 경로와 같은 모양). */

function 실행만로드(repo) {
  const 이전 = process.env.SYNK_OWNER_ROOT;
  process.env.SYNK_OWNER_ROOT = repo; // 모듈이 로드 시점에 ROOT 를 굳히므로 캐시를 비우고 다시 든다
  for (const k of Object.keys(require.cache)) if (/(인계문수거|작업본소유자)\.js$/.test(k)) delete require.cache[k];
  const m = require(TOOL);
  return { 실행: m.실행, 복원() { if (이전 === undefined) delete process.env.SYNK_OWNER_ROOT; else process.env.SYNK_OWNER_ROOT = 이전; } };
}
function 낡은스냅샷(수거경로들) {
  return { 수거: 수거경로들.map((p) => ({ xy: '??', 경로: p })), 내것: [], 보류: [], 잡파일: [], 목차더러움: false };
}

test('🔴 경쟁: 먼저 거둬진 경로는 건너뛰고 나머지는 거둔다 — 한 경로가 전체 수거를 접지 않는다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, g } = 픽스처();
  인계문두기(repo, 'dead0010', '<!-- at:1 -->\n아직 안 거둬진 죽은 세션 본문\n');
  const { 실행, 복원 } = 실행만로드(repo);
  try {
    const r = 낡은스냅샷([`${폴더}/gone0001.md`, `${폴더}/dead0010.md`]);
    const 전 = 커밋수(g);
    const 결과 = 실행(r);
    assert.strictEqual(typeof 결과, 'string', `수거가 실패로 접혔다: ${JSON.stringify(결과)}`);
    assert.strictEqual(커밋수(g), 전 + 1, '수거 커밋이 안 생겼다');
    const 실림 = 마지막커밋파일들(g);
    assert.ok(실림.includes(`${폴더}/dead0010.md`), '거둘 수 있던 파일을 못 거뒀다 — 그게 오늘의 사고다');
    assert.ok(!실림.includes(`${폴더}/gone0001.md`), '사라진 경로가 커밋에 실렸다(있을 수 없는 상태)');
    assert.strictEqual(r.사라짐, 1, '건너뛴 수를 보고에 안 넘긴다 — 경쟁이 있었다는 사실이 숨는다');
  } finally { 복원(); }
});

test('경쟁: 전부 먼저 거둬졌으면 빈손과 같다 — 실패가 아니라 조용한 null(잃은 내용 0)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, g } = 픽스처();
  const { 실행, 복원 } = 실행만로드(repo);
  try {
    const 전 = 커밋수(g);
    assert.strictEqual(실행(낡은스냅샷([`${폴더}/gone0002.md`])), null,
      '전량 선점을 실패로 번역했다 — 세션 시작마다 「거두지 못했다」 헛경고가 뜬다');
    assert.strictEqual(커밋수(g), 전, '거둘 게 없는데 커밋이 생겼다');
  } finally { 복원(); }
});

test('경쟁 아님: 사라짐 밖의 add 실패(index.lock 등)는 전과 같이 전체를 접는다 — lock 을 「먼저 거둬짐」으로 안 읽는다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, g } = 픽스처();
  인계문두기(repo, 'dead0011');
  const gitdir = path.join(repo, String(g('rev-parse', '--git-dir').stdout).trim());
  fs.writeFileSync(path.join(gitdir, 'index.lock'), '');
  const { 실행, 복원 } = 실행만로드(repo);
  try {
    const 전 = 커밋수(g);
    const 결과 = 실행(낡은스냅샷([`${폴더}/dead0011.md`]));
    assert.ok(결과 && 결과.실패 && /git add 실패/.test(결과.실패),
      `lock 실패를 삼키거나 「사라짐」으로 접었다: ${JSON.stringify(결과)} — 파일이 있는데 안 거두고 지나가면 F025 유실로 간다`);
    assert.strictEqual(커밋수(g), 전);
  } finally { 복원(); fs.rmSync(path.join(gitdir, 'index.lock'), { force: true }); }
});

/* ── 스테이징된 삭제 — `add` 가 빈손인 **두 번째** 까닭 ────────────────────────────────
 * 08-15 실측: 만료 5건의 삭제가 **이미 인덱스에 올라간** 채 굳어 있었다. 그 경로는 작업본에도
 * index 에도 없어 `git add` 가 위 경쟁과 **똑같은** 「did not match any files」를 내는데,
 * 도구는 그 한 문장만 보고 선점으로 읽어 「5건 전부 딴 세션이 먼저 거뒀다 — 커밋 안 함(잃은
 * 내용 없음)」이라고 확신에 찬 얼굴로 거짓을 말했다. 실제로는 아무도 안 거뒀고, 다음 실행도
 * 같은 판정을 내리니 그 삭제는 공유 인덱스에 **영영** 남아 모든 세션의 「미커밋 0」 판독을
 * 흐린다. 선점과 갈라지는 자리는 하나뿐이다 — 선점은 HEAD 에도 없고, 이쪽은 HEAD 에 있다. */

test('🔴 「스테이징된 삭제」를 «남이 선점했다»로 읽지 않는다 — 도구가 영영 못 집던 자리', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, g } = 픽스처();
  const 경로 = `${폴더}/dead0012.md`;
  인계문두기(repo, 'dead0012', '<!-- at:1 -->\nTTL 이 지운 만료 자국\n');
  g('add', '--', 경로); g('commit', '-qm', 'dead0012 반입');   // ① HEAD 에 들어간다
  fs.rmSync(path.join(repo, 경로));                            // ② TTL 청소가 지운다
  g('add', '--', 경로);                                        // ③ 삭제를 **스테이징만** 해 둔다
  // 픽스처가 그 상태를 실제로 만들었는지부터 확인한다 — 아니면 이 검사는 아무것도 안 재고
  // 초록만 낸다(미실행과 통과가 같은 모양 · F207).
  assert.strictEqual(String(g('status', '--short', '--', 경로).stdout).slice(0, 2), 'D ',
    '픽스처가 「스테이징된 삭제」를 못 만들었다 — 이 검사는 그 상태에서만 뜻이 있다');

  const { 실행, 복원 } = 실행만로드(repo);
  try {
    const 전 = 커밋수(g);
    const r = { 수거: [], 만료: [{ xy: 'D ', 경로 }], 내것: [], 보류: [], 잡파일: [], 목차더러움: false };
    const 결과 = 실행(r);
    assert.strictEqual(typeof 결과, 'string',
      `선점으로 접었다: ${JSON.stringify(결과)} — 그 삭제는 공유 인덱스에 영영 남는다`);
    assert.strictEqual(커밋수(g), 전 + 1, '커밋이 안 생겼다');
    assert.ok(마지막커밋파일들(g).includes(경로),
      '삭제가 커밋에 안 실렸다 — add 가 빈손이어도 commit 의 pathspec 이 싣는 자리다');
    assert.strictEqual(r.사라짐, 0,
      '아무도 안 거둔 것을 「사라짐」으로 셌다 — 숫자가 아니라 보고 문장 자체가 거짓이 된다');
  } finally { 복원(); }
});

test('가르는 자는 HEAD 다 — HEAD 에도 없는 경로는 전과 같이 선점으로 건너뛴다(고쳐서 되레 넓히지 않았나)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, g } = 픽스처();
  인계문두기(repo, 'dead0013', '<!-- at:1 -->\n아직 안 거둬진 죽은 세션 본문\n');
  const { 실행, 복원 } = 실행만로드(repo);
  try {
    const r = 낡은스냅샷([`${폴더}/gone0003.md`, `${폴더}/dead0013.md`]);
    const 결과 = 실행(r);
    assert.strictEqual(typeof 결과, 'string', `수거가 실패로 접혔다: ${JSON.stringify(결과)}`);
    assert.ok(!마지막커밋파일들(g).includes(`${폴더}/gone0003.md`),
      'HEAD 에 없는 경로까지 범위에 남겼다 — pathspec fatal 로 수거 전체가 죽는다');
    assert.strictEqual(r.사라짐, 1, '선점 판정이 사라졌다 — 08-07 실측(F071)의 봉합이 풀린다');
  } finally { 복원(); }
});

/* ── 부분 적용 — add 가 죽어도 「미커밋 그대로」라고 말하던 자리 (2026-08-18 실물) ─────────
 * 🔴 세션 시작 실측: `git add` 가 **경로별로** 돌다 index.lock 에 걸렸고, 그 순간 만료 삭제
 *   22건 중 **앞 6건만** 인덱스에 앉은 알파벳 접두 절단이 남았다. 그런데 보고문은
 *   「미커밋 그대로, 다음 실행이 다시 시도한다」였다 — 안 도는 쪽이 아니라 **맞는 얼굴로 틀린
 *   값** 쪽으로 샌 것이다(CLAUDE.md 가드 맹점 ④). 옛 회귀(`:313`)는 실패«는» 봤지만
 *   인덱스가 어떤 꼴로 남는지는 한 줄도 안 쟀다.
 * 🔑 봉합은 둘이다 — ㉠원인: 원자 add 를 먼저 쳐서 잠금 실패에 부분 적용이 **못 생기게** 한다
 *   ㉡대가: 그래도 남을 수 있는 판(무시 경로 등)은 **재서** 말한다. ㉠만 하면 「이제 안 남는다」는
 *   단정이 되고, 그 단정이 틀리는 날 문장은 다시 거짓이 된다.
 * 탐지력은 **픽스처**가 진다(맹점 ②) — git 호출자를 갈아끼워 «호출 모양»을 못박는다. */

/** git 호출을 가짜로 세운다 — 무엇이 몇 번 불렸는지가 이 검사의 재료다. */
function 가짜git(응답) {
  const 부른것 = [];
  const 호출 = (args) => {
    부른것.push(args.join(' '));
    return 응답(args) || { ok: true, out: '', err: '' };
  };
  호출.부른것 = 부른것;
  호출.add호출 = () => 부른것.filter((c) => c.startsWith('add '));
  return 호출;
}

test('🔑 부분 적용의 원인을 없앤다 — 정상 판에서 add 는 «한 번»이다(경로별 루프를 안 돈다)', () => {
  const { add단계 } = require(TOOL);
  const 후보 = [`${폴더}/a.md`, `${폴더}/b.md`, `${폴더}/c.md`];
  const g = 가짜git(() => ({ ok: true, out: '', err: '' }));
  const r = add단계(g, () => false, 후보);
  assert.strictEqual(r.실패, undefined, `정상인데 실패로 접혔다: ${r.실패}`);
  assert.strictEqual(r.사라짐.size, 0);
  assert.deepStrictEqual(g.add호출(), [`add -- ${후보.join(' ')}`],
    'add 를 경로별로 나눠 쳤다 — 나눠 치는 순간 잠금이 루프 도중에 걸릴 창이 다시 열린다');
});

test('🔑 잠금 실패에는 경로별 루프를 «아예» 안 돈다 — 앞쪽 몇 건이 앉을 자리 자체가 없다', () => {
  /* 🔴 이것이 08-18 실물의 원인 봉합이다. 옛 판은 여기서 add 를 N 번 쳤고, 앞의 몇 번은
   *   성공한 뒤 인덱스에 남았다. 원자 add 는 잠금에서 0건을 앉힌다(같은 날 실측). */
  const { add단계 } = require(TOOL);
  const 후보 = [`${폴더}/a.md`, `${폴더}/b.md`, `${폴더}/c.md`];
  const g = 가짜git(() => ({ ok: false, out: '', err: "fatal: Unable to create '.git/index.lock': File exists." }));
  const r = add단계(g, () => false, 후보);
  assert.match(String(r.실패), /git add 실패/, '잠금을 실패로 안 번역했다 — 파일이 있는데 지나가면 F025 유실이다');
  assert.strictEqual(g.add호출().length, 1,
    `잠금인데 add 를 ${g.add호출().length}번 쳤다 — 경로별 루프에 들어간 순간 부분 적용이 되살아난다`);
});

test('경로가 사라진 판에서만 경로별로 되돈다 — F071 봉합을 원자 add 가 삼키지 않았다', () => {
  const { add단계 } = require(TOOL);
  const 사라진 = `${폴더}/gone.md`;
  const 산것 = `${폴더}/dead.md`;
  const g = 가짜git((args) => (args.includes(사라진)
    ? { ok: false, out: '', err: `fatal: pathspec '${사라진}' did not match any files` }
    : { ok: true, out: '', err: '' }));
  const r = add단계(g, () => false, [사라진, 산것]);   // HEAD 에도 없다 = ⓐ 선점
  assert.strictEqual(r.실패, undefined, `선점을 실패로 접었다: ${r.실패}`);
  assert.deepStrictEqual([...r.사라짐], [사라진], '선점 판정이 사라졌다 — 08-07 실측(F071)의 봉합이 풀린다');
  assert.strictEqual(g.add호출().length, 3, '원자 1회 + 경로별 2회여야 한다(되도는 자리를 안 밟았다)');
});

test('ⓑ 스테이징된 삭제는 원자 add 를 지나서도 «범위에 남는다» — HEAD 판별자가 살아 있다', () => {
  const { add단계 } = require(TOOL);
  const 삭제 = `${폴더}/staged-delete.md`;
  const g = 가짜git(() => ({ ok: false, out: '', err: `fatal: pathspec '${삭제}' did not match any files` }));
  const r = add단계(g, (p) => p === 삭제, [삭제]);      // HEAD 에는 있다 = ⓑ
  assert.strictEqual(r.실패, undefined);
  assert.strictEqual(r.사라짐.size, 0,
    '아무도 안 거둔 삭제를 「사라짐」으로 셌다 — 그 삭제는 공유 인덱스에 영영 남는다(F257 계열)');
});

test('🔑 「미커밋 그대로」는 0건을 «잰» 때만 쓴다 — 못 쟀으면 못 쟀다고 말한다(F207)', () => {
  const { 잔여문구 } = require(TOOL);
  assert.strictEqual(잔여문구(0), '미커밋 그대로');
  assert.match(잔여문구(6), /6건/, '남은 수를 안 말하면 읽는 사람은 「그대로」로 읽는다');
  assert.doesNotMatch(잔여문구(6), /미커밋 그대로/, '잔여가 있는데 「그대로」라고 말한다 — 08-18 그 거짓 그대로다');
  for (const 못잼 of [null, undefined]) {
    assert.doesNotMatch(잔여문구(못잼), /미커밋 그대로/, '못 잰 것을 0 으로 접었다 — 미실행과 통과가 같은 모양이다');
  }
});

test('🔴 실패 뒤 잔여를 «세어» 보고한다 — 루프가 앞 한 건을 앉히고 죽는 판', { skip: !git있나 && 'git 없음' }, () => {
  /* 잠금이 루프 **도중에** 잡히는 창은 프로세스 밖에서 못 만든다. 같은 코드 경로(=경로별 루프가
   * 앞 건을 앉힌 뒤 죽는다)를 결정적으로 재현하는 대역으로 **무시 경로**를 쓴다 — 08-18 실측:
   * `git add -- <무시 파일>` 은 `did not match` 가 아닌 다른 fatal 을 내고, 그때 앞 건은 앉는다.
   * ⚠ 이 모양은 실제 후보엔 안 온다(`status --porcelain` 이 무시 파일을 안 낸다) — 재현 장치다. */
  const { repo, g } = 픽스처();
  const 사라진 = `${폴더}/gone0004.md`;                    // 원자 add 를 «did not match» 로 떨궈 루프로 보낸다
  인계문두기(repo, 'dead0014', '<!-- at:1 -->\n앉을 파일\n');
  fs.writeFileSync(path.join(repo, '.gitignore'), '무시대상.md\n');
  g('add', '--', '.gitignore'); g('commit', '-qm', 'ignore 규칙');
  fs.writeFileSync(path.join(repo, '무시대상.md'), 'x\n');

  const { 실행, 복원 } = 실행만로드(repo);
  try {
    const 전 = 커밋수(g);
    const r = { 수거: [사라진, `${폴더}/dead0014.md`, '무시대상.md'].map((p) => ({ xy: '??', 경로: p })), 만료: [], 내것: [], 보류: [], 잡파일: [], 목차더러움: false };
    const 결과 = 실행(r);
    assert.ok(결과 && 결과.실패, `실패로 안 끝났다: ${JSON.stringify(결과)} — 이 픽스처가 무너지면 아래 잔여 검사는 장식이다`);
    assert.strictEqual(커밋수(g), 전, '실패인데 커밋이 생겼다');
    // 픽스처가 실제로 「부분 적용」을 만들었는지부터 확인한다(안 만들었으면 이 검사는 0 을 재고 초록이다 · F207).
    const 앉은것 = String(g('diff', '--cached', '--name-only').stdout).split(/\r?\n/).filter(Boolean);
    assert.deepStrictEqual(앉은것, [`${폴더}/dead0014.md`],
      '픽스처가 부분 적용을 못 만들었다 — 이 검사는 그 상태에서만 뜻이 있다');
    assert.strictEqual(결과.잔여, 1,
      `잔여를 ${결과.잔여} 로 냈다 — 「미커밋 그대로」가 다시 거짓으로 나간다(08-18 그 문장)`);
  } finally { 복원(); }
});

/* ── 등록층 — 가드·수거는 로직보다 등록층에서 샌다(CLAUDE.md 맹점 목록) ────────────────── */

test('등록: SessionStart 훅이 인계문수거 --hook 을 이식 가능한 꼴로 부른다', () => {
  const s = fs.readFileSync(path.resolve(__dirname, '..', '.claude', 'settings.json'), 'utf8');
  const j = JSON.parse(s);
  const 명령들 = (j.hooks.SessionStart || []).flatMap((e) => e.hooks.map((h) => h.command));
  const 내명령 = 명령들.filter((c) => c.includes('인계문수거.js'));
  assert.strictEqual(내명령.length, 1, `SessionStart 에 인계문수거 등록이 ${내명령.length}건이다(1건이어야 한다)`);
  assert.ok(내명령[0].includes('${CLAUDE_PROJECT_DIR:-$PWD}'), '로컬 절대경로 등록은 다른 기계에서 통째로 죽는다(F044)');
  assert.ok(내명령[0].includes('--hook'), '--hook 모드가 아니면 세션 시작마다 표를 쏟는다');
  assert.ok(/command -v node/.test(내명령[0]), 'node 부재를 침묵으로 넘기면 미실행과 통과가 같은 모양이 된다');
});

test('등록: /close 6단계가 인계문 작성 직후 --실행 을 부른다 — 순서 결함(쓰기가 커밋 뒤)의 봉합', () => {
  const skill = fs.readFileSync(path.resolve(__dirname, '..', '.claude', 'skills', 'close', 'SKILL.md'), 'utf8');
  const 쓰기 = skill.indexOf('tools/인계문.js');
  const 수거 = skill.indexOf('tools/인계문수거.js --실행');
  assert.ok(쓰기 >= 0, '/close 에서 인계문 쓰기 단계를 못 찾았다 — 전제가 바뀌었으면 이 회귀도 다시 본다');
  assert.ok(수거 > 쓰기, '/close 가 인계문을 쓴 「뒤」에 수거를 부르지 않는다 — 자기 인계문이 다시 고아가 된다');
});
