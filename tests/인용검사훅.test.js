/**
 * citation-guard 발동 조건 회귀 (F350 처방의 훅 층)
 *
 * 왜 있나 — 2026-08-17 실측: 훅 29벌 가운데 회귀에서 **이름이 한 번도 안 나오는 것이 이 하나**였다
 *   (나머지 28벌은 4~92회). 등록층은 `훅이식성.test.js`·`훅등록.test.js` 가 settings.json 에서
 *   훅을 «열거»해 이미 덮고 있었지만, 그 열거는 「이식성·실패 방향·죽은 참조」만 본다 —
 *   **이 훅이 실제로 무엇에 발동하는지**는 아무도 안 봤다. 그 사각에서 결함이 살았다.
 *
 * 🔴 그 사각이 실제로 낳은 결함 — 훅이 저장소 «이름»을 문자열로 잘라 상대경로를 만들었다:
 *      rel.slice(rel.indexOf('/SYNK-appsscript/') + …)
 *   워크트리는 `…/SYNK-appsscript/.claude/worktrees/<가지>/` 아래라 첫 조각이 걸려
 *   `.claude/worktrees/<가지>/docs/_ops/보드/…` 가 나오고, 면제 목록은 `docs/_ops/보드/` 접두로
 *   재기 때문에 **면제가 통째로 죽었다.** 실측(훅 사본 고정 · 경로만 바꿈):
 *      메인훅 × 메인 보드파일 🟢 / 워크훅 × 워크 «같은» 보드파일 🔴 / 워크훅 × 워크 마찰신호 🔴
 *   CLAUDE.md 가 코드 트랙에 워크트리를 «의무»로 만든 뒤라, 보드·마찰신호·인계문을 고칠 때마다
 *   맞는 행동에 거짓 경고가 떴다 — 그건 무시를 정상 통로로 만든다(F103 축). 이 가드가 막으려던
 *   병이 「안 재고 적음」인데, 거짓 경고는 정확히 그 경고를 안 읽게 만든다.
 *
 * 이 파일이 지키는 것 넷:
 *  ① 이름 축(픽스처) — 저장소 이름이 무엇이든 면제가 먹는다. **탐지력은 여기가 진다.**
 *  ② 거짓양성(실저장소) — 역사 문서 4종은 조용하다. 워크트리 상대경로도 같은 문서로 읽는다.
 *  ③ 가드가 살아 있다(실저장소) — 거짓 인용에는 실제로 경고가 뜬다.
 *     훅은 통째로 try/catch 라 판정 모듈이 사라져도 **조용히 통과**한다 — 그 죽음을 이 검사가 잡는다.
 *  ④ 이름을 다시 박지 않는다(소스) — 되돌아오는 형태를 그 자리에서 막는다.
 *
 * ⚠ 대가(맞는 얼굴로 틀릴 자리) — ①은 `tools/` 를 **정션**으로 걸어 이름만 바꾼 픽스처다.
 *    정션을 못 만드는 환경(권한 없는 CI)에서는 통과가 아니라 **skip 으로 드러낸다**(F296·F207).
 *    그리고 ①은 면제 경로만 밟아 `색인만들기` 이전에 나가므로, 픽스처가 git 저장소가 아니어도 된다 —
 *    바꿔 말하면 ①은 «면제 판정»만 지키지 판정 본체를 안 지킨다. 본체는 `인용검사.test.js` 몫이다.
 * ⚠ 닫은 것 1개 — ③이 있기 전에는 `tools/인용검사.js` 를 지워도 스위트가 초록이었다(catch → exit 0).
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
/* 주석 제거는 통로가 하나다 — 지역 사본은 저마다 다르게 틀린다(F401·#Q114). */
const { 코드만 } = require('./lib/소스검사.js');
const { 훅띄우기 } = require('./lib/훅띄우기');

const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'citation-guard.js');

/* 일부러 틀린 `파일:줄` — 그 파일은 실재하지만 그 줄은 없다(면제가 안 먹으면 반드시 적색). */
const 거짓인용 = '실측: `tools/인용검사.js:999999` 가 그렇게 말한다.\n';

/** 훅을 띄우고 「경고가 떴나」만 돌려준다. 판정은 호출부 몫. */
function 경고떴나(file_path, content = 거짓인용) {
  const 입력 = JSON.stringify({ tool_name: 'Write', tool_input: { file_path, content } });
  const r = 훅띄우기(HOOK, { input: 입력, encoding: 'utf8' });
  return /인용검사/.test(String(r.stdout || ''));
}

/* ── ① 이름 축 (픽스처) — 탐지력은 여기가 진다 ───────────────────────────── */

test('① 저장소 이름이 무엇이든 면제가 먹는다 (픽스처 · 이름 하드코딩 금지)', (t) => {
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-인용훅-'));
  /* 이름에 `SYNK-appsscript` 가 **없다** — 옛 형태는 여기서 면제를 통째로 놓친다. */
  const 클론 = path.join(임시, '전혀-다른-이름');
  fs.mkdirSync(path.join(클론, '.claude', 'hooks'), { recursive: true });

  try {
    fs.symlinkSync(path.join(ROOT, 'tools'), path.join(클론, 'tools'), 'junction');
  } catch (e) {
    fs.rmSync(임시, { recursive: true, force: true });
    /* 못 만든 것을 통과로 세지 않는다 — 미실행은 초록과 같은 모양이다(F207). */
    t.skip(`정션을 못 만들었다 — 이 환경에선 이름 축을 못 잰다: ${e.code || e.message}`);
    return;
  }

  fs.copyFileSync(HOOK, path.join(클론, '.claude', 'hooks', 'citation-guard.js'));
  const 훅사본 = path.join(클론, '.claude', 'hooks', 'citation-guard.js');

  const 띄우기 = (fp) => {
    const 입력 = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: fp, content: 거짓인용 } });
    return /인용검사/.test(String(훅띄우기(훅사본, { input: 입력, encoding: 'utf8' }).stdout || ''));
  };

  try {
    for (const 면제문서 of ['docs/_ops/보드/aaaaaaaa.md', 'docs/_ops/마찰신호.md', 'docs/세션보드_아카이브.md']) {
      assert.strictEqual(
        띄우기(path.join(클론, 면제문서).replace(/\\/g, '/')), false,
        `이름이 다른 저장소에서 «${면제문서}» 가 면제를 못 받았다 — 상대경로를 저장소 이름으로 자르고 있다`,
      );
    }
  } finally {
    fs.rmSync(임시, { recursive: true, force: true });
  }
});

/* ── ② 거짓양성 (실저장소) ────────────────────────────────────────────────── */

test('② 역사 문서는 조용하다 — 실저장소·워크트리 상대경로 둘 다', () => {
  const 면제들 = [
    'docs/_ops/보드/aaaaaaaa.md',
    'docs/_ops/마찰신호.md',
    'docs/_ops/인계문.md',
    'docs/세션보드_아카이브.md',
    /* 메인 체크아웃의 훅이 워크트리 파일을 볼 때도 «같은 문서»다. */
    '.claude/worktrees/어떤가지/docs/_ops/보드/aaaaaaaa.md',
    '.claude/worktrees/어떤가지/docs/_ops/마찰신호.md',
  ];
  for (const 상대 of 면제들) {
    assert.strictEqual(
      경고떴나(path.join(ROOT, 상대).replace(/\\/g, '/')), false,
      `면제 문서 «${상대}» 에 거짓 경고가 떴다 — 맞는 행동에 뜨는 경고는 무시를 정상 통로로 만든다(F103)`,
    );
  }
});

test('② `.md` 가 아닌 파일에는 발동하지 않는다', () => {
  assert.strictEqual(경고떴나(path.join(ROOT, 'tools', '인용검사.js').replace(/\\/g, '/')), false);
});

/* ── ③ 가드가 살아 있다 (실저장소) ────────────────────────────────────────── */

test('③ 면제 아닌 문서의 거짓 인용에는 경고가 뜬다 — 조용한 죽음을 잡는다', () => {
  assert.strictEqual(
    경고떴나(path.join(ROOT, 'docs', '회귀용-없는문서.md').replace(/\\/g, '/')), true,
    '거짓 인용에 경고가 안 떴다 — 판정 모듈이 사라져도 훅은 catch 로 조용히 통과한다(그 죽음이 지금 상태다)',
  );
});

test('③ 맞는 인용에는 경고가 안 뜬다 — 탐지가 아무 데나 뜨는 것이 아니다', () => {
  /* 1줄은 어느 파일에나 있다 — 「무조건 적색」이면 이 검사가 빨개진다. */
  assert.strictEqual(
    경고떴나(path.join(ROOT, 'docs', '회귀용-없는문서.md').replace(/\\/g, '/'),
      '실측: `tools/인용검사.js:1` 이 그 자리다.\n'), false,
  );
});

/* ── ④ 소스 — 이름을 다시 박지 않는다 ────────────────────────────────────── */

test('④ 훅이 저장소 이름을 문자열로 박지 않는다', () => {
  const src = fs.readFileSync(HOOK, 'utf8');
  const 주석뺀 = 코드만(src);
  assert.ok(
    !/SYNK-appsscript/.test(주석뺀),
    '훅 코드에 저장소 이름이 다시 박혔다 — 상대경로는 `ROOT`(훅 파일 위치)에서 낸다',
  );
});
