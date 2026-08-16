// 장부 「이 세션이 고쳤을 법한 행」 회귀 — F496 (2026-08-16)
//
// 무엇을 지키나: 세션이 **고쳐놓고 장부를 안 닫은 채 끝나는 것**을 끝나는 자리에서 잡는다.
//   실측(08-16): 열림 6건 중 3건이 이미 고쳐진 것이었고, 그중 둘은 같은 세션이 같은 날
//   고치고 둘 다 안 닫았다(`e20ff91c`·`3ccb4642`). `friction-close-guard` 는 커밋 메시지의
//   `F\d{3}` 으로만 행을 찾아서, **번호를 안 단 커밋에는 원리상 눈이 먼다.**
//
// ⚠ 탐지력은 전부 **픽스처**가 진다(CLAUDE.md 가드 맹점 ②) — 실저장소 검사는 거짓양성만 본다.
//   실장부(docs/_ops/마찰신호.md)는 건드리지 않는다.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const TOOL = path.join(__dirname, '..', 'tools', 'friction.js');
const 장부 = require(TOOL);
const SID = 'local_deadbeef-0000-0000-0000-000000000000';

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr || r.stdout}`);
  return r.stdout;
}

/** 픽스처 저장소 — 「내 세션이 `tools/게이트.js` 를 고쳤다」를 커밋 트레일러로 재현한다. */
function 픽스처({ 행들, 번호를단다 = false, 커밋한다 = true }) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'friction-sess-'));
  git(repo, ['init', '-q']);
  git(repo, ['config', 'user.email', 'test@synk.local']);
  git(repo, ['config', 'user.name', 'test']);

  const 장부경로 = path.join(repo, 'docs', '_ops', '마찰신호.md');
  fs.mkdirSync(path.dirname(장부경로), { recursive: true });
  fs.writeFileSync(장부경로, ['# 마찰 신호 장부', '', '| ID | 날짜 | 종류 | 신호 | 해소 |',
    '|---|---|---|---|---|', ...행들, ''].join('\n'), 'utf8');

  // 「고친 것」 — 장부 밖 실물 파일. 첫 커밋은 트레일러 없이(남의 커밋 역할).
  fs.mkdirSync(path.join(repo, 'tools'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'tools', '게이트.js'), '// v1\n', 'utf8');
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'chore: 초기']);

  if (커밋한다) {
    fs.writeFileSync(path.join(repo, 'tools', '게이트.js'), '// v2 — 고쳤다\n', 'utf8');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-q', '-m',
      `fix: 여는 길이 422 로 죽어 있었다${번호를단다 ? ' (F901)' : ''}\n\nSession-Id: ${SID}`]);
  }
  return { repo, 장부경로 };
}

function 돌린다({ repo, 장부경로 }, sid = SID) {
  const r = spawnSync(process.execPath, [TOOL, '--이세션'], {
    encoding: 'utf8', stdio: 'pipe',
    env: {
      ...process.env,
      SYNK_FRICTION_ROOT: repo,
      SYNK_FRICTION_LEDGER: 장부경로,
      CLAUDE_CODE_HOST_SESSION_ID: sid,
    },
  });
  return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
}

const 열린행 = (id, 신호) => `| ${id} | 2026-08-16 | 실수 | ${신호} | |`;

// ── 언급된파일 — 순수 함수 ───────────────────────────────────────────────────

test('신고문이 경로로 적든 파일명만 적든 같은 이름으로 잡힌다', () => {
  const a = 장부.언급된파일('tools/게이트.js 의 규칙 몸통이 두 곳에 적혔다');
  assert.ok(a.has('게이트.js'), '경로꼴을 놓쳤다: ' + [...a]);
  /* 실측: 신고문은 경로를 자주 생략한다(F451 = 「…(마스코트모션.py 08-15)」). 파일명만
     남기는 것이 이 통로의 설계이고, 그 대가(동명이인 거짓양성)는 머리말에 적혀 있다. */
  const b = 장부.언급된파일('수리=검출이탈→상대 강등(마스코트모션.py 08-15)');
  assert.ok(b.has('마스코트모션.py'), '파일명꼴을 놓쳤다: ' + [...b]);
  const c = 장부.언급된파일('회귀 2(tests/변이통로.test.js) 를 신설했다');
  assert.ok(c.has('변이통로.test.js'), '점이 둘인 이름을 놓쳤다: ' + [...c]);
});

test('파일을 하나도 안 적은 신고문은 빈 집합이다 — 「못 잡는다」가 조용해지면 안 된다', () => {
  const s = 장부.언급된파일('유호님이 「왕관이 뭔지 도저히 이해가 안 간다」로 교정했다');
  assert.equal(s.size, 0, '없는 파일을 지어냈다: ' + [...s]);
});

// ── 기록물 거르기 — 이게 없으면 살아있는 행 전부가 매번 걸린다 ────────────────

test('장부·보드·인계문은 기록물이라 «고친 파일»에서 빠진다', () => {
  for (const 이름 of ['마찰신호.md', 'F490.md', '7563cbed.md', '인계문.md', '세션보드_아카이브.md']) {
    assert.equal(장부.기록물이름(이름), true, `${이름} 이 기록물로 안 걸렸다`);
  }
  for (const 이름 of ['게이트.js', '변이.js', 'Code.js', '마스코트모션.py']) {
    assert.equal(장부.기록물이름(이름), false, `${이름} 이 기록물로 잘못 걸렸다 — 진짜 수리가 안 보인다`);
  }
});

// ── CLI — 종료코드 셋이 갈린다(0=없음 · 1=판정할 것 · 2=못 쟀다 · F207) ────────

test('🔴 커밋에 번호가 없어도 잡는다 — friction-close-guard 가 원리상 눈머는 자리(F491)', () => {
  const fx = 픽스처({ 행들: [열린행('F901', 'tools/게이트.js 의 몸통이 두 곳에 적혀 PUT 이 422 로 죽었다')],
    번호를단다: false });
  const { code, out } = 돌린다(fx);
  assert.equal(code, 1, '겹치는 행을 못 찾았다(exit 1 이어야 한다):\n' + out);
  assert.match(out, /F901/, '행 번호를 안 냈다:\n' + out);
  assert.match(out, /게이트\.js/, '어느 파일이 겹쳤는지 안 냈다:\n' + out);
  assert.match(out, /resolve F901/, '따를 수 있는 처방을 안 냈다(F103):\n' + out);
});

test('번호를 단 커밋도 같은 자리에서 잡힌다 (F490)', () => {
  const fx = 픽스처({ 행들: [열린행('F901', '`tools/게이트.js` 가 죽었다')], 번호를단다: true });
  assert.equal(돌린다(fx).code, 1);
});

test('보류(⏸)도 낸다 — 「판정됐다」와 「고쳐졌다」는 다른 축이다(F092)', () => {
  const fx = 픽스처({ 행들: ['| F901 | 2026-08-16 | 실수 | tools/게이트.js 가 죽었다 | ⏸ 나중에 본다 |'] });
  const { code, out } = 돌린다(fx);
  assert.equal(code, 1, '보류 행을 통째로 빠뜨렸다:\n' + out);
  assert.match(out, /보류/, '상태 라벨을 안 갈랐다 — 요구가 두 갈래인데 문장이 하나면 둘 다 안 한다:\n' + out);
});

test('해소된 행은 안 낸다 — 닫힌 것을 다시 물으면 그게 소음이다', () => {
  const fx = 픽스처({ 행들: ['| F901 | 2026-08-16 | 실수 | tools/게이트.js 가 죽었다 | 고쳤다 |'] });
  const { code, out } = 돌린다(fx);
  assert.equal(code, 0, '해소된 행을 다시 냈다:\n' + out);
});

test('내 커밋이 안 만진 파일을 지목한 행은 안 낸다 — 남의 일감까지 물으면 꺼진다', () => {
  const fx = 픽스처({ 행들: [열린행('F901', 'tools/전혀다른것.js 가 죽었다')] });
  assert.equal(돌린다(fx).code, 0);
});

test('이 세션 커밋이 0건이면 침묵하되 «왜»를 말한다', () => {
  const fx = 픽스처({ 행들: [열린행('F901', 'tools/게이트.js 가 죽었다')], 커밋한다: false });
  const { code, out } = 돌린다(fx);
  assert.equal(code, 0);
  assert.match(out, /커밋이 0건/, '침묵의 이유를 안 밝혔다:\n' + out);
});

test('0건도 분모와 함께 낸다 — 「안 걸렸다」와 「안 쟀다」가 같은 모양이면 안 된다(F207)', () => {
  const fx = 픽스처({
    행들: [열린행('F901', 'tools/전혀다른것.js'), 열린행('F902', '파일을 안 적은 신고문이다')],
  });
  const { out } = 돌린다(fx);
  assert.match(out, /분모/, '분모를 안 냈다:\n' + out);
  assert.match(out, /안 지목한 1/, '「파일을 안 적어 원리상 못 잡는 행」의 수를 안 냈다:\n' + out);
});

test('git 을 못 부르면 «못 쟀다»(exit 2) — 0건으로 접지 않는다', () => {
  const 빈곳 = fs.mkdtempSync(path.join(os.tmpdir(), 'friction-nogit-'));
  const 장부경로 = path.join(빈곳, '마찰신호.md');
  fs.writeFileSync(장부경로, ['| ID | 날짜 | 종류 | 신호 | 해소 |', '|---|---|---|---|---|',
    열린행('F901', 'tools/게이트.js')].join('\n'), 'utf8');
  const { code, out } = 돌린다({ repo: 빈곳, 장부경로 });
  assert.equal(code, 2, 'git 저장소가 아닌데 0/1 로 답했다:\n' + out);
  assert.match(out, /못 쟀다/, '「못 쟀다」를 말로 안 냈다:\n' + out);
});

// ── 실저장소 — 거짓양성 검문만 ────────────────────────────────────────────────

test('실저장소 — 통로가 로드되고 공개 면이 그대로 있다', () => {
  for (const k of ['언급된파일', '기록물이름', '이세션분']) {
    assert.equal(typeof 장부[k], 'function', `${k} 가 공개 면에서 사라졌다 — /close 5-c 가 죽는다`);
  }
});

test('실저장소 — 실장부의 살아있는 행에서 파일 추출이 터지지 않는다(거짓양성 검문)', () => {
  const rows = 장부.read().rows.filter(장부.살아있나);
  let 지목 = 0;
  for (const r of rows) {
    const s = 장부.언급된파일(r.signal);
    assert.ok(s instanceof Set, `${r.id} 에서 집합이 아닌 값이 나왔다`);
    if (s.size) 지목++;
  }
  /* 분모를 검사에 적지 않는다 — 장부는 매일 자란다. 여기서 보는 것은 「터지지 않는다」와
     「전부 0건은 아니다」뿐이다(전부 0이면 정규식이 죽은 것이라 그건 조용한 미측정이다). */
  assert.ok(rows.length === 0 || 지목 > 0, '살아있는 행 전부에서 파일을 하나도 못 뽑았다 — 정규식이 죽었다');
});

test('실저장소 — /close 가 이 통로를 실제로 부른다(스스로 발화하지 않는 장치는 안 돈다)', () => {
  /* ⚠ 파일명은 **`SKILL.md`(대문자)** 다 — Windows 는 대소문자를 무시해서 소문자로 적어도
     여기선 통하지만 CI(리눅스)에서는 그 순간 터진다(F296 계열: repo 밖 환경에 기대는 검사).
     실측 08-16: 이 줄을 `skill.md` 로 처음 썼고 `git commit -- <경로>` 가 pathspec 으로 잡았다. */
  const skill = fs.readFileSync(path.join(__dirname, '..', '.claude', 'skills', 'close', 'SKILL.md'), 'utf8');
  assert.match(skill, /friction\.js --이세션/,
    '/close 에 호출이 없다 — 장치와 그 발동 조건은 같은 커밋에서 정한다(CLAUDE.md 신뢰성)');
});
