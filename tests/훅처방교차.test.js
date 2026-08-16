'use strict';
/* 훅 처방 교차 검사 — 「한 훅이 낸 처방을 **다른** 가드가 막는다」 (F212).
 *
 * 왜 기존 검사로는 안 잡히나: CLAUDE.md 가드 맹점 ③(자기 처방을 되먹여 통과하는지)도,
 *   tests/git범위가드.test.js 의 F103 계열도 **한 훅 안**만 본다. 실사고는 층이 갈렸다 —
 *   2026-08-07 19:20 실측: repo-staleness 가 autostash 잔재 처방으로 준
 *   `git stash show -p stash@{0}` 을 git-scope-guard 가 deny 했다. 처방을 낸 쪽과 막는 쪽이
 *   서로 달라 그 검사로는 **원리상** 안 잡힌다. 따를 수 없는 처방은 GIT_SCOPE_BYPASS 를
 *   정상 통로로 만들고, 그 순간 가드가 통째로 꺼진다(F103 과 같은 병, 층만 다르다).
 *
 * 🔑 소스를 긁지 않는다 — 훅의 **메시지 빌더를 실제로 불러** 나온 텍스트에서만 명령을 뽑는다.
 *   소스 수확은 실측으로 기각됐다(77건 중 태반이 가드가 「이건 막는다」고 인용한 금지 명령이라
 *   거짓양성 공장이 된다 · 화살표 줄로 좁혀도 10건·3훅에 산문이 섞였다).
 *
 * 🔑 더러운 트리는 **픽스처**가 만든다. 실저장소에 기대면 CI 는 깨끗한 트리라 stash 규칙의
 *   발화 조건 자체가 안 서고, 그 초록은 통과가 아니라 미실행이다.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { 훅띄우기 } = require('./lib/훅띄우기');   // 훅은 이 통로로만 띄운다 — 미실행이 「통과」가 되는 자리

const ROOT = path.resolve(__dirname, '..');
const 훅방 = path.join(ROOT, '.claude', 'hooks');
const 있나 = spawnSync('git', ['--version']).status === 0;

const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} → ${r.stderr || r.stdout}`);
  return (r.stdout || '').trim();
};

/** 훅이 실제로 뿜은 텍스트에서 명령을 뽑는다 — 이 저장소의 두 표기: 백틱 인용 · 들여쓴 줄. */
function 명령뽑기(텍스트) {
  const 것들 = [];
  for (const m of String(텍스트).matchAll(/`(git\s[^`\n]+)`/g)) 것들.push(m[1].trim());
  for (const 줄 of String(텍스트).split('\n')) {
    const t = 줄.trim();
    if (/^git\s/.test(t)) 것들.push(t);
  }
  return [...new Set(것들)];
}

/** repo-staleness 의 세 갈래 알림 — 세 빌더 전부에서 뽑는다(한 갈래만 재면 통과가 우연이다). */
function 처방수확() {
  const s = require(path.join(훅방, 'repo-staleness.js'));
  return [...new Set([
    ...명령뽑기(s.본문({ 뒤: 7, 나이분: 40, 보드변경: 3 })),
    ...명령뽑기(s.진행중본문('rebase')),
    ...명령뽑기(s.잔재본문([{ 해시: 'a'.repeat(40), ref: 'stash@{0}', 제목: 'autostash' }])),
  ])];
}

/** Bash 명령을 보는 가드 전부 — 목록을 손으로 들지 않는다(새 가드가 조용히 빠지는 자리다). */
function 가드목록() {
  return fs.readdirSync(훅방)
    .filter((n) => n.endsWith('.js'))
    .filter((n) => {
      const s = fs.readFileSync(path.join(훅방, n), 'utf8');
      return /permissionDecision/.test(s) && /tool_input/.test(s);
    });
}

/** deny 면 그 출력을, 아니면 null. gitCwd 는 payload 가 아니라 **프로세스 cwd** 에서 나온다.
 *  훅이 안 뜨면 `훅띄우기` 가 던진다 — 여기서 조용히 null 이 되면 이 검사 전체가 「막힌 것 없음」이 된다. */
function 판정(가드, cmd, cwd) {
  const r = 훅띄우기(path.join(훅방, 가드), {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: cmd }, cwd }),
    encoding: 'utf8', cwd, timeout: 30000,
  });
  const 출력 = (r.stdout || '') + (r.stderr || '');
  return /"permissionDecision"\s*:\s*"deny"/.test(출력) ? 출력 : null;
}

/** 미커밋 수정이 있는 트리 — F212 가 발화한 그 상태(깨끗하면 stash 규칙이 조용하다). */
function 더러운픽스처() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '훅처방-'));
  git(d, 'init', '-q', '-b', 'master');
  fs.writeFileSync(path.join(d, 'a.txt'), '0\n');
  git(d, 'add', '--', 'a.txt');
  git(d, 'commit', '-q', '-m', 'seed');
  fs.writeFileSync(path.join(d, 'a.txt'), '1\n');
  return d;
}

test('🔑 미측정 방어 — 처방이 실제로 수확된다 (0건이면 아래 검사가 통째로 공회전한다)', () => {
  const 처방 = 처방수확();
  assert.ok(처방.length >= 4, `처방 ${처방.length}건만 수확됐다 — 표기가 바뀌었으면 명령뽑기를 넓혀라:\n  ${처방.join('\n  ')}`);
  /* 글자가 아니라 **갈래**로 못 박는다 — F212 가 난 자리는 stash 계열이고, 그 문구는 남의 훅 소유라
   * 바뀐다(실측: `show -p` → `show --stat` + `drop` 추가). 글자로 박으면 남의 정당한 개정이 내 적색이 된다. */
  assert.ok(처방.some((c) => /^git stash\b/.test(c)),
    `stash 계열 처방이 하나도 없다 — F212 가 난 갈래가 통째로 빠졌다:\n  ${처방.join('\n  ')}`);
});

test('🔑 미측정 방어 — Bash 를 보는 가드가 실제로 잡힌다', () => {
  const 가드 = 가드목록();
  assert.ok(가드.length >= 3, `가드 ${가드.length}개만 잡혔다 — 판별 조건이 실제 훅 표기를 놓쳤다: ${가드.join(' ')}`);
  assert.ok(가드.includes('git-scope-guard.js'), `F212 를 낸 그 가드가 목록에 없다: ${가드.join(' ')}`);
});

test('🔑 탐지력 — 하네스가 deny 를 실제로 본다 (픽스처가 진다)', { skip: !있나 }, () => {
  const d = 더러운픽스처();
  try {
    /* 경로 없는 stash = F066 그 형태. 여기서 null 이 나오면 위 검사의 초록은 미실행이다. */
    assert.ok(판정('git-scope-guard.js', 'git ' + 'stash', d), '더러운 트리의 맨 stash 가 안 막혔다 — 하네스가 가드를 못 띄우고 있다');
    assert.strictEqual(판정('git-scope-guard.js', 'git status --short', d), null, '조회를 막으면 거짓양성이다');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('🔴 훅이 낸 처방은 어느 가드에도 막히지 않는다 (F212)', { skip: !있나 }, () => {
  const d = 더러운픽스처();
  try {
    const 막힌것 = [];
    for (const cmd of 처방수확()) {
      for (const g of 가드목록()) {
        const 출력 = 판정(g, cmd, d);
        if (출력) 막힌것.push(`  ${g} 가 막음 ← repo-staleness 의 처방\n    ${cmd}\n    ${출력.replace(/\s+/g, ' ').slice(0, 200)}`);
      }
    }
    assert.deepStrictEqual(막힌것, [],
      '훅이 시키는 명령을 다른 가드가 막는다 — 따를 수 없는 처방은 BYPASS 를 정상 통로로 만들고\n'
      + '그 순간 가드가 통째로 꺼진다(F212 · 2026-08-07 실측).\n'
      + '고치는 쪽은 **가드**다 — 처방 문구를 바꿔 피하면 다음 처방이 같은 자리에서 또 막힌다.\n'
      + 막힌것.join('\n'));
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

/* ── 축 ② — 처방이 «아예 없다» ─────────────────────────────────────────────
 * 위 F212 축은 「처방을 **다른 가드가 막는다**」였다. 같은 F103 병에 실패 모드가 하나 더 있다 —
 * 훅이 **자기에게 없는 탈출구**를 시키는 것이다. 막히지 않으니 F212 검사로는 원리상 안 잡히고,
 * 세션은 시킨 대로 해도 통과하지 못한 채 훅 소스를 직접 열어야 출구를 찾는다.
 *
 * 실측 2026-08-16: `credential-guard` 규칙①이 `CRED_GUARD_BYPASS=1` 을 시켰는데 그 훅에 그 문자열을
 *   보는 자리가 **어디에도 없었다**. 게다가 같은 파일 머리말이 「MCP 도구엔 명령 앞에 `BYPASS=1` 을
 *   붙일 자리가 없다」고 이미 적어 뒀다 — 훅이 자기가 부정한 것을 시키고 있었다(같은 판정을 두 곳에
 *   적으면 갈라진다 · CLAUDE.md 신뢰성 ④). 규칙②·③은 `--allow-next` 로 옳게 안내했으므로
 *   **한 훅 안에서 처방이 갈린 것**이고, 그래서 사람 눈으로는 세 갈래를 다 읽어야만 보였다.
 *
 * 🔑 밑줄 접두어가 있는 것만 «처방»으로 센다 — 산문의 맨 `BYPASS=1` 은 설명이지 명령이 아니다.
 * 🔑 소비는 **판정 문맥**에서만 인정한다: 셸 가드는 `process.env` 가 아니라 «명령 문자열»에서 찾는다
 *    (그 넷을 env 로만 재면 전부 거짓양성이 된다 — 실측으로 갈랐다). */

/** 훅 소스가 «시키는» 탈출구 환경변수. */
function 탈출구수확(src) {
  return [...new Set([...String(src).matchAll(/\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)=1/g)].map((m) => m[1]))];
}

/** 그 훅이 그 탈출구를 실제로 «소비»하나 — 네 표기 전부(정규식 리터럴·문자열 포함·env 두 형태). */
function 소비하나(src, v) {
  const e = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`/${e}=1/|['"\`]${e}=1['"\`]|env\\.${e}\\b|env\\[['"\`]${e}`).test(String(src));
}

test('🔑 탐지력 — 「처방만 있고 소비 없음」을 판정기가 잡는다 (픽스처가 진다)', () => {
  assert.ok(탈출구수확('… 의도적 예외라면 FOO_BAR_BYPASS=1 을 붙인다.').includes('FOO_BAR_BYPASS'),
    '처방을 수확 못 한다 — 이 판정기의 초록은 전부 미실행이다');
  assert.ok(!소비하나('… 예외라면 FOO_BAR_BYPASS=1 을 붙인다.', 'FOO_BAR_BYPASS'),
    '사유문에 적힌 것을 «소비»로 셌다 — 그러면 깨진 처방이 영영 초록이다');
  for (const 성한것 of [
    'if (/FOO_BAR_BYPASS=1/.test(cmd)) process.exit(0);',
    "if (cmd.includes('FOO_BAR_BYPASS=1')) process.exit(0);",
    'if (process.env.FOO_BAR_BYPASS) process.exit(0);',
    "if (process.env['FOO_BAR_BYPASS']) process.exit(0);",
  ]) {
    assert.ok(소비하나(성한것, 'FOO_BAR_BYPASS'), `성한 소비를 못 봤다 — 거짓양성 공장이 된다:\n  ${성한것}`);
  }
  assert.deepStrictEqual(탈출구수확('MCP 도구에는 `BYPASS=1` 을 붙일 자리가 없다'), [],
    '밑줄 없는 산문의 BYPASS=1 을 처방으로 셌다 — 설명문이 적색이 된다');
});

test('🔑 미측정 방어 — 실저장소에서 탈출구가 실제로 수확된다', () => {
  const 전부 = fs.readdirSync(훅방).filter((n) => n.endsWith('.js'))
    .flatMap((n) => 탈출구수확(fs.readFileSync(path.join(훅방, n), 'utf8')));
  assert.ok(new Set(전부).size >= 4,
    `탈출구 ${new Set(전부).size}종만 수확됐다 — 표기가 바뀌었으면 탈출구수확을 넓혀라: ${[...new Set(전부)].join(' ')}`);
});

test('🔴 훅이 시키는 탈출구는 그 훅에 실재한다 (F103 · 2026-08-16 실측)', () => {
  const 깨진것 = [];
  for (const n of fs.readdirSync(훅방).filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(훅방, n), 'utf8');
    for (const v of 탈출구수확(src)) if (!소비하나(src, v)) 깨진것.push(`  ${n} 가 ${v}=1 을 시키는데 그 훅에 보는 자리가 0`);
  }
  assert.deepStrictEqual(깨진것, [],
    '훅이 «자기에게 없는» 탈출구를 처방한다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103).\n'
    + '고치는 쪽은 둘 중 하나다: 처방을 실재하는 통로로 바꾸거나(권장), 그 탈출구를 실제로 구현하거나.\n'
    + '⚠ 검사를 좁혀서 통과시키지 않는다 — 그러면 이 회귀가 미실행이 된다.\n'
    + 깨진것.join('\n'));
});
