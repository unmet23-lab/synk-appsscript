/* 인용검사 회귀 ② — **한글 경로 문서가 과녁에 들어오나** (2026-08-17 신설 · F527 분모 세기 중 발각).
 *
 * 왜 따로 있나 — `인용검사.test.js` 는 판정 로직을 «가상 파일»로 전수 검사한다. 그래서 그 층은
 * 처음부터 초록이었는데, 정작 **과녁을 모으는 층**(`작업본문서들` → `git`)이 통째로 눈이 멀어 있었다.
 * git 기본값(`core.quotepath=true`)은 비ASCII 경로를 `"docs/\354\...md"` 로 **따옴표까지 붙여** 뱉고,
 * 그러면 `rel.endsWith('.md')` 가 영원히 거짓이라 그 문서는 아예 안 걸린다.
 *
 * 🔴 실측 2026-08-17 — 멀었던 것은 **자동으로 도는 과녁뿐**이다: `작업본문서들`(기본 + `--스테이징`,
 *   즉 pre-commit 이 부르는 길)이 한글 경로 .md 8벌 중 **0벌**을 봤다. `--전량` 은 `readdirSync` 라
 *   원래 멀쩡했고, 그래서 손으로 확인하는 통로가 늘 맞는 수를 내 의심이 한 번도 안 갔다(맹점 ④).
 *   면제를 뺀 과녁 168벌 중 143벌이 비ASCII 경로다 — 그 문서를 건드린 커밋은 전부 그냥 통과했다.
 *
 * 무엇을 지키나:
 *   ① **행동으로 잰다**(F526 축) — 「소스에 quotepath 가 적혀 있나」를 안 본다. 그건 표기 검사고,
 *      표기 검사는 헬퍼가 바뀌면 조용히 죽는다. 여기선 진짜 git 저장소를 세워 **결과 수**를 본다.
 *   ② **탐지력을 픽스처가 진다**(맹점 ②) — ASCII 문서(대조군)와 한글 문서(과녁)를 같은 판에 두고,
 *      한글 쪽이 «세어지는지»를 못박는다. 버그가 아직 있기를 요구하지 않는다.
 *   ③ git 이 없거나 못 돌면 **skip 으로 드러낸다**(F296·F207) — fail 도 통과도 아니다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 저장소뿌리 = path.resolve(__dirname, '..');

function git(cwd, args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

/** 진짜 git 저장소를 하나 세우고, 그 안에 인용검사를 그대로 옮겨 심는다. */
function 픽스처() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-인용-'));
  if (git(dir, ['init', '-q']).status !== 0) return null;
  git(dir, ['config', 'user.email', 't@t.t']);
  git(dir, ['config', 'user.name', 't']);
  /* 🔑 `core.quotepath` 를 **일부러 안 만진다** — 기본값 그대로여야 이 회귀가 실물을 잰다. */

  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  /* 인용검사가 실제로 끌어오는 사슬 전부 — 하나라도 빠지면 도구가 안 서고, 그러면 이 회귀는
   * 「사각이 있다」가 아니라 「못 쟀다」를 재게 된다(그 둘은 화면에서 같은 모양이다 · F207). */
  const 옮길것 = [
    'tools/인용검사.js', 'tools/lib/보드낡음.js', 'tools/lib/표.js', 'tools/lib/보드.js',
    '.claude/hooks/lib/board-id.js',
  ];
  for (const rel of 옮길것) {
    const 원본 = path.join(저장소뿌리, rel);
    if (!fs.existsSync(원본)) return null;   // 사슬이 바뀌었다 — skip 으로 드러낸다
    const 목적 = path.join(dir, rel);
    fs.mkdirSync(path.dirname(목적), { recursive: true });
    fs.copyFileSync(원본, 목적);
  }

  /* 인용이 가리킬 실물 — 3행에 이름이 있다. */
  fs.writeFileSync(path.join(dir, '대상.js'), ['// 1', '// 2', 'function 몽글쨈() {}', '// 4', ''].join('\n'));

  git(dir, ['add', '-A']);
  if (git(dir, ['commit', '-qm', 'base']).status !== 0) return null;
  return dir;
}

/** 인용검사를 돌리고 「문서 N벌」의 N 을 뽑는다. null = 못 쟀다. */
function 문서수(dir) {
  const r = spawnSync(process.execPath, [path.join(dir, 'tools', '인용검사.js')], { cwd: dir, encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const m = /문서\s+(\d+)\s*벌/.exec(out);
  return m ? { 수: Number(m[1]), 출력: out } : { 수: null, 출력: out };
}

test('한글 경로 문서가 인용검사 과녁에 들어온다 (quotepath 사각)', (t) => {
  const dir = 픽스처();
  if (!dir) return t.skip('git 을 못 돌렸다 — 검사를 **안 돌렸다**(통과 아님)');
  try {
    /* 대조군: ASCII 이름 — 사각과 무관하게 늘 보이던 쪽이다. */
    fs.writeFileSync(path.join(dir, 'docs', 'ascii-doc.md'), '자리는 `대상.js:3` 이다.\n');
    const 대조 = 문서수(dir);
    assert.equal(대조.수, 1, `ASCII 문서조차 안 세어졌다 — 픽스처가 잘못 섰다.\n${대조.출력}`);

    /* 과녁: 한글 경로 — 기본값 git 이 통째로 이스케이프해 뱉는 쪽이다. */
    fs.rmSync(path.join(dir, 'docs', 'ascii-doc.md'));
    fs.writeFileSync(path.join(dir, 'docs', '한글문서.md'), '자리는 `대상.js:3` 이다.\n');
    const 한글 = 문서수(dir);
    assert.equal(한글.수, 1,
      '한글 경로 문서가 과녁에서 빠졌다 — `git` 헬퍼가 `-c core.quotepath=false` 를 안 걸었다.\n'
      + `실측 08-17 에 이 사각이 과녁 168벌 중 143벌이었다.\n${한글.출력}`);

    /* 섞여 있어도 둘 다 센다 — 한쪽만 보던 것이 원래 결함이다. */
    fs.writeFileSync(path.join(dir, 'docs', 'ascii-doc.md'), '자리는 `대상.js:3` 이다.\n');
    const 둘다 = 문서수(dir);
    assert.equal(둘다.수, 2, `한글·ASCII 를 섞으니 한쪽이 샜다.\n${둘다.출력}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
