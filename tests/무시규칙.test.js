/* 무시규칙 회귀 — 「git 밖에 두기로 한 것」이 **다른 기계에서도** 밖에 있는가.
 *
 * 왜 있나 (F079 · 2026-08-04):
 *   `.claude/worktrees/` 를 가리는 규칙이 `.git/info/exclude` 에만 있었다. 그건 **커밋되지 않는
 *   로컬 파일**이라 클론한 기계(폰 클라우드 세션·다른 PC·CI)에는 아예 없다. 즉 이 저장소에서만
 *   안전했고 다른 곳에선 무방비였는데, `git status` 로는 그 차이가 절대 안 보인다.
 *   그리고 그 폴더는 저장소 **안**에 있다 — 「저장소 안인데 무시되는 파일이 가장 위험하다」.
 *
 * 🔑 그래서 이 검사는 **`.gitignore` 만 놓고** 본다. 실저장소에서 `git check-ignore` 를 부르면
 *   `info/exclude` 가 같이 먹혀서 **로컬에서만 초록**이 된다 — 재는 층이 틀리면 결과는
 *   「지켜진다」로 나오고, 그게 정확히 F079 를 못 본 이유다. 픽스처 저장소에 `.gitignore` 만
 *   복사해 넣으면 그게 곧 클론한 기계다.
 *
 * ⚠ 두 방향을 같은 무게로 본다. 무시돼야 할 것이 안 무시되면 **사고**고,
 *   무시되면 안 될 것이 무시되면 **소스가 조용히 사라진다**(더 나쁘다 — 커밋했다고 믿게 된다).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
// SYNK_TEST_GITIGNORE = 변이 실험용 이음매. 로직을 끄지 않고 **보는 파일만** 바꾼다
// (실 .gitignore 를 건드리지 않고 탐지력을 재려면 이 자리가 필요하다 · SYNK_TRACK_ROOT 와 같은 패턴).
const 무시파일 = process.env.SYNK_TEST_GITIGNORE || path.join(ROOT, '.gitignore');

const 있나 = (() => {
  const r = spawnSync('git', ['--version'], { encoding: 'utf8' });
  return !r.error && r.status === 0;
})();

const 임시들 = [];
test.after(() => { for (const d of 임시들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* 진행 */ } } });

/** `.gitignore` **만** 든 빈 저장소 = 클론한 기계. info/exclude 도 전역 설정도 없다. */
function 클론한기계() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ignore-'));
  임시들.push(dir);
  spawnSync('git', ['init', '-q'], { cwd: dir, encoding: 'utf8' });
  fs.copyFileSync(무시파일, path.join(dir, '.gitignore'));
  return dir;
}

/** 이 경로가 무시되는가 — 파일이 없어도 경로만으로 묻는다(--no-index). */
function 무시되나(dir, p) {
  const r = spawnSync('git', ['-c', 'core.excludesFile=', 'check-ignore', '--no-index', '-q', '--', p],
    { cwd: dir, encoding: 'utf8' });
  return r.status === 0;
}

test('.gitignore 가 있고 읽힌다 (없으면 아래 검사가 전부 무의미해진다)', () => {
  assert.ok(fs.existsSync(무시파일), '.gitignore 가 없다');
  assert.ok(fs.readFileSync(무시파일, 'utf8').trim().length > 0, '.gitignore 가 비었다');
});

test('🔴 반드시 밖에 있어야 하는 것 — **`.gitignore` 만으로** 지켜진다 (F079)', (t) => {
  if (!있나) return t.skip('git 없음 — 픽스처를 못 만든다');
  const dir = 클론한기계();

  const 밖에있어야 = [
    // ── F079 의 본체. 이게 info/exclude 에만 있어서 다른 기계에선 무방비였다.
    ['.claude/worktrees/elated-bhaskara-3adfc6/Code.js', '워크트리 — 저장소 안인데 git 눈 밖이라 가장 위험하다'],
    ['.claude/checkpoints/x.json', 'Claude Code 런타임'],
    ['.claude/mailbox/x.json', 'Claude Code 런타임'],
    ['.claude/scheduled_tasks.json', 'Claude Code 런타임'],
    ['.claude/agent-registry.json', 'Claude Code 런타임'],
    // ── 자격증명. 여기가 뚫리면 git 이력은 영구적이고 repo 는 복제·공유된다.
    ['.env', '자격증명'],
    ['.env.local', '자격증명'],
    ['.clasprc.json', 'clasp 자격증명'],
    ['어딘가/.clasprc.json', 'clasp 자격증명(하위 경로)'],
    ['로그인.txt', '자격증명 — 재유입 방지 영구 가드'],
    ['docs/로그인.txt', '자격증명(하위 경로)'],
    ['secrets/x.json', '자격증명'],
    // ── 실사고 이력이 있는 것들
    ['사업문서 (git 관리).lnk', '2026-08-03 실사고: git add -A 가 담아 push 까지 갔다'],
    ['.claude/settings.local.json', '로컬 전용'],
    ['.claude/state/rot-check.json', '기기별 스로틀'],
    ['ARC-AGI-3-Agents/x.py', '중첩 저장소'],
    ['tools/bench/_fixture_recordings/x.json', '실행마다 새로 생기는 픽스처'],
    ['tools/notebooklm-drive.log', '실행 로그'],
  ];

  for (const [p, 왜] of 밖에있어야) {
    assert.ok(무시되나(dir, p),
      `\`${p}\` 이(가) **클론한 기계에서 노출된다** — ${왜}\n`
      + '   로컬에선 `.git/info/exclude` 가 가려 초록으로 보인다. 그게 F079 를 못 본 층이다.');
  }
});

test('🔴 반대 방향 — 소스가 조용히 사라지지 않는다 (무시가 과하면 커밋했다고 믿게 된다)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 클론한기계();

  const 안에있어야 = [
    'Code.js',
    '엔진_수집.js',
    'contents_상담AI.js',
    'appsscript.json',
    '.claude/settings.json',                 // ⚠ settings.local.json 만 밖이다 — 한 글자 차이로 갈린다
    '.claude/hooks/code-edit-guard.js',
    '.claude/hooks/lib/worktrees.js',
    '.claude/skills/deploy/SKILL.md',
    'tests/무시규칙.test.js',
    'docs/세션보드.md',
    'docs/정본/SYNK LAB/자료/등록서.html',   // 공백·한글이 든 실제 모양
    'tools/friction.js',
    '.github/workflows/deploy-live.yml',
    'crewcard/크루카드.js',
  ];

  for (const p of 안에있어야) {
    assert.ok(!무시되나(dir, p),
      `\`${p}\` 이(가) 무시된다 — 커밋한 줄 알았는데 안 들어가는 자리다(증상은 「조용함」뿐).`);
  }
});

test('실저장소: 추적 중인데 무시 규칙에 걸리는 파일이 없다 (모순이면 규칙이 안 먹는다)', (t) => {
  if (!있나) return t.skip('git 없음');
  const r = spawnSync('git', ['-c', 'core.quotepath=false', 'ls-files', '-i', '-c', '--exclude-standard'],
    { cwd: ROOT, encoding: 'utf8' });
  if (r.error || r.status !== 0) return t.skip('실저장소를 못 읽었다');
  const 걸린것 = String(r.stdout || '').split(/\r?\n/).filter(Boolean);
  assert.deepStrictEqual(걸린것, [],
    `이미 추적 중이라 무시 규칙이 안 먹는 파일이 있다 — 규칙이 있는데 지켜지지 않는 상태다:\n  ${걸린것.join('\n  ')}`);
});

test('synk-talk/ 임시 격리 규칙은 스캐폴드 실물과 함께만 산다 (삭제 커밋에서 규칙도 걷는다)', (t) => {
  /* [2026-08-05] repo 안 synk-talk/(순정 Expo 스캐폴드·유호님 삭제 승인 대기)를 .gitignore 로
   * 임시 격리했다. 위험은 **삭제 뒤에도 규칙이 남는 것** — 그러면 다음 오붙여넣기
   * (`npx create-expo-app synk-talk`)가 영원히 조용해진다(F079 가 경고한 재발 형태).
   * 그래서 규칙의 수명을 실물에 묶는다: 실물이 없는데 규칙이 있으면 빨강. */
  const 규칙있나 = fs.readFileSync(무시파일, 'utf8').split(/\r?\n/).some((s) => s.trim() === 'synk-talk/');
  if (!규칙있나) return; // 규칙을 이미 걷었다 — 이 검사의 임무 종료(스캐폴드 재유입은 위 「반드시 밖」 목록 대상이 아니다: 격리는 임시였다)
  const 실물있나 = fs.existsSync(path.join(ROOT, 'synk-talk'));
  if (!실물있나 && process.env.CI) return t.skip('CI 클론엔 미추적 스캐폴드가 없다 — 이 검사는 스캐폴드가 사는 기계(로컬)에서만 유효');
  assert.ok(실물있나,
    '.gitignore 에 synk-talk/ 규칙이 있는데 그 디렉터리가 없다 — 스캐폴드를 지운 커밋에서 이 규칙도 함께 걷어라\n'
    + '   (남겨두면 다음 synk-talk/ 오생성이 영원히 git 눈 밖이 된다 — 격리는 삭제 승인까지의 임시였다).');
});

test('`info/exclude` 에만 있는 규칙이 남지 않았다 (있으면 그건 이 기계에서만 안전하다)', (t) => {
  if (!있나) return t.skip('git 없음');
  /* ⚠ 이 파일은 **커밋되지 않는다** — CI·클론에는 없다. 그러니 없으면 skip 으로 **드러낸다**.
   *   통과와 미실행이 같은 모양이면 안 된다(CLAUDE.md). */
  const p = path.join(ROOT, '.git', 'info', 'exclude');
  if (!fs.existsSync(p)) return t.skip('info/exclude 가 없다 — 클론한 기계다(검사 대상 자체가 없음)');

  const dir = 클론한기계();
  const 놓친것 = [];
  for (const 줄 of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const s = 줄.trim();
    if (!s || s.startsWith('#') || s.startsWith('!')) continue;
    // 패턴을 그대로는 못 묻는다 — 대표 경로 하나로 바꿔서 묻는다.
    const 대표 = s.replace(/^\*\*\//, '').replace(/\/$/, '/샘플');
    if (!무시되나(dir, 대표)) 놓친것.push(`${s}  → ${대표}`);
  }
  assert.deepStrictEqual(놓친것, [],
    '아래 규칙이 `.git/info/exclude` 에만 있다. 그건 커밋되지 않는 로컬 파일이라\n'
    + '**다른 기계에선 이것들이 통째로 커밋 후보가 된다**(F079 가 정확히 그 형태였다).\n'
    + `.gitignore 로 옮겨라:\n  ${놓친것.join('\n  ')}`);
});
