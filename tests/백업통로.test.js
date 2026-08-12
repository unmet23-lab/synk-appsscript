/* 백업 통로 회귀 — `tools/백업.js`.
 *
 * 이 파일이 지키는 건 **되찾을 수 있는가** 하나다. 백업 도구의 실패는 조용하다 —
 * 안 담긴 걸 아는 날은 노트북이 이미 없는 날이라, 담기는 자리에서 기계가 지어야 한다.
 *
 * 실측으로 잡은 결함 둘을 못박는다 (2026-08-10, 첫 실행에서 둘 다 터졌다):
 *   ① **하나가 실패하면 전체가 죽었다** — `Documents\My Music` 은 정션이라 copyFile 이 EPERM 을
 *      던졌고, 그 한 건이 백업 전체를 중단시켰다. 29건 중 0건이 담긴 채 「오류」만 남는다.
 *   ② **읽는 층이 값을 깨뜨렸다** — `git status --porcelain` 출력에 `.trim()` 을 걸어 첫 줄
 *      상태 칸의 **앞 공백**(` M path`)이 깎였고, 경로가 한 글자씩 밀려(`docs/…`→`ocs/…`)
 *      그 파일이 ENOENT 로 안 담겼다. 원본은 멀쩡한데 재는 층이 틀린 형태라 조용하다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { 상태줄경로, 파일복사, 클라우드루트, 큰파일한계 } = require('../tools/백업.js');

/* ── ② porcelain 파서: 앞 공백이 값이다 ───────────────────────── */

test('상태줄경로: 세 칸 규약 — 앞 공백은 상태의 일부지 여백이 아니다', () => {
  assert.strictEqual(상태줄경로(' M docs/_ops/검수기록.jsonl'), 'docs/_ops/검수기록.jsonl');
  assert.strictEqual(상태줄경로('?? tools/새파일.js'), 'tools/새파일.js');
  assert.strictEqual(상태줄경로('MM Code.js'), 'Code.js');
  assert.strictEqual(상태줄경로('A  docs/추가.md'), 'docs/추가.md');
});

test('🔴 앞이 깎인 줄은 경로를 한 글자 먹는다 — trim 을 걸면 안 되는 이유', () => {
  /* 실측 그 자체: `.trim()` 이 첫 줄의 ` M ` 을 `M ` 으로 만들면 아래처럼 밀린다.
   * 파서를 「똑똑하게」 고쳐 이걸 흡수하면 안 된다 — 그러면 진짜 원인(읽는 층)이 숨는다.
   * 파서는 규약대로 3칸을 자르고, 앞 공백을 지키는 책임은 읽는 쪽(git 호출)이 진다. */
  assert.strictEqual(상태줄경로('M docs/_ops/검수기록.jsonl'), 'ocs/_ops/검수기록.jsonl');
});

test('상태줄경로: 이름 바뀜은 새 이름이 실물이다', () => {
  assert.strictEqual(상태줄경로('R  docs/옛이름.md -> docs/새이름.md'), 'docs/새이름.md');
});

test('상태줄경로: 지워진 파일은 복사할 실물이 없다', () => {
  assert.strictEqual(상태줄경로(' D docs/사라진.md'), null);
  assert.strictEqual(상태줄경로('D  docs/사라진.md'), null);
});

test('상태줄경로: 따옴표로 감싼 경로를 벗긴다(공백·특수문자가 든 이름)', () => {
  assert.strictEqual(상태줄경로('?? "docs/이름에 공백.md"'), 'docs/이름에 공백.md');
});

test('상태줄경로: 빈 줄·짧은 줄은 조용히 null', () => {
  assert.strictEqual(상태줄경로(''), null);
  assert.strictEqual(상태줄경로(null), null);
  assert.strictEqual(상태줄경로(' M'), null);
});

/* ── ① 실패 격리: 하나가 막혀도 나머지를 담는다 ──────────────── */

test('파일복사: 없는 파일에 던지지 않고 실패를 값으로 돌려준다', () => {
  const r = 파일복사(path.join(os.tmpdir(), '없는파일-백업회귀.txt'), path.join(os.tmpdir(), '어디든.txt'));
  assert.ok(r.실패, '던지면 이 한 건이 백업 전체를 죽인다');
});

test('파일복사: 폴더·정션은 실물이 아니라고 말한다(My Music 이 그 자리였다)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '백업회귀-'));
  try {
    const r = 파일복사(tmp, path.join(tmp, '목적'));
    assert.ok(r.실패, '폴더를 파일처럼 복사하려 하면 EPERM 이 난다');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('파일복사: 실제로 담기고, 목적지 폴더가 없으면 만든다', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '백업회귀-'));
  try {
    const 원본 = path.join(tmp, '원본.txt');
    fs.writeFileSync(원본, '내용', 'utf8');
    const 목적 = path.join(tmp, '깊은', '경로', '원본.txt'); // 중간 폴더가 아직 없다
    const r = 파일복사(원본, 목적);
    assert.ok(!r.실패, `담기지 않았다: ${r.실패}`);
    assert.strictEqual(fs.readFileSync(목적, 'utf8'), '내용');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('큰파일한계는 값이 있고, 넘는 건 조용히 버리지 않고 건너뜀으로 드러난다', () => {
  assert.ok(큰파일한계 > 0);
  // 한계 자체를 실물 파일로 재면 100MB 를 써야 한다 — 계약만 못박고 실측은 실행 보고가 진다
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '백업회귀-'));
  try {
    const 원본 = path.join(tmp, '작은.txt');
    fs.writeFileSync(원본, 'x', 'utf8');
    const r = 파일복사(원본, path.join(tmp, '나온.txt'));
    assert.strictEqual(r.건너뜀, undefined, '한계 아래는 건너뛰지 않는다');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

/* ── repo 밖 환경: 재지 못하는 것은 skip 으로 드러낸다 ────────── */

test('이 기계의 클라우드 루트를 찾는다', (t) => {
  if (process.platform !== 'win32' || !process.env.OneDrive) {
    t.skip('win32/OneDrive 없음(CI) — 동기화 루트는 실기계에서만 검증된다');
    return;
  }
  const 루트 = 클라우드루트();
  assert.ok(루트 && fs.existsSync(루트), `클라우드 루트를 못 찾았다: ${루트}`);
});

/* ── ③ 메모리 동기화(`tools/memory-push.cmd`) ──────────────────────
 * 같은 축이라 여기 둔다 — **되찾을 수 있는가**. `SYNK_MemoryPush`(1시간마다)가 08-08~08-12
 * 사이 12번 실패했고 그동안 메모리 정본은 클라우드로 안 올라갔는데, 아무도 몰랐다.
 * 2026-08-12 실측으로 두 결함을 갈랐다:
 *   ① 이 저장소엔 세션이 ~19개 붙어 메모리 파일을 **계속** 쓴다. `add`→`commit` 과 `pull`
 *      사이 몇 초에 새 편집이 내려앉고, 더러운 작업본에서 rebase 는 **시작 자체를 거부**한다.
 *      (인증·네트워크 정상 · 교착 없음 · 로컬이 정확히 1커밋 앞 — 충돌할 것 자체가 없었다.)
 *   ② 실패 핸들러가 **자기 문장만** 적고 git 의 실제 오류를 버렸다. 그래서 로그엔 나흘 내내
 *      "possible conflict" 라는 **추측**만 쌓였고, 그게 틀린 방향이라 아무도 못 고쳤다.
 * 처방이 문자열이라 회귀도 문자열로 진다 — 두 줄 중 하나만 빠져도 같은 침묵이 돌아온다. */
const 동기화cmd = () => fs.readFileSync(path.join(path.resolve(__dirname, '..'), 'tools', 'memory-push.cmd'), 'utf8');

test('🔑 memory-push: pull --rebase 는 --autostash 와 함께 간다 — 세션이 계속 쓰는 폴더다', () => {
  const 줄 = 동기화cmd().split('\n').find((s) => /^\s*git pull --rebase/.test(s));
  assert.ok(줄, 'pull --rebase 줄이 없어졌다 — 대상이 사라지면 이 회귀는 아무것도 안 지킨다');
  assert.match(줄, /--autostash/,
    '--autostash 가 빠졌다 — 다른 세션이 파일 하나만 써도 rebase 가 거부되고 백업이 조용히 멈춘다');
});

test('🔑 memory-push: 실패 로그에 git 의 실제 오류가 남는다 — 자기 문구만 쓰면 원인이 영영 안 남는다', () => {
  const 소스 = 동기화cmd();
  assert.match(소스, /2>\s*"%ERR%"/, 'git stderr 를 안 받는다 — 다음 실패도 원인 없이 한 줄만 남는다');
  assert.match(소스, /type "%ERR%" >> "%LOG%"/, '받아 놓고 로그에 안 붙이면 받은 적 없는 것과 같다');
  /* `rem` 을 걷어내고 본다 — 이 검사를 처음 쓴 자리에서 **주석의 역사 인용**을 잡았다.
   * 축은 「독자를 조항으로 보내 행동을 정하는가」다: 실행 줄의 그 문구는 로그에 추측을 쓰지만,
   * 주석의 그것은 왜 뺐는지를 남기는 기록이라 지우면 다음 사람이 같은 문장을 되살린다. */
  const 실행줄 = 소스.split('\n').filter((s) => !/^\s*rem\b/i.test(s)).join('\n');
  assert.doesNotMatch(실행줄, /possible conflict/,
    '추측 문구가 실행 줄에 살아 있다 — 나흘 동안 틀린 방향을 가리킨 그 문장이다');
});
