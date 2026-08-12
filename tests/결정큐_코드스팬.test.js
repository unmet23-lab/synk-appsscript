// decision-queue 회귀 — 「기호를 쓰는 것」과 「기호를 말하는 것」을 가른다.
//
// 실사고(2026-08-04): 메모리에 이 도구의 결함을 회고한 문장이 있었다 —
//   "⚠첫 판은 23건이 가짜였다: `⏳`가 이 메모리에서 두 용법으로 쓰이는데…"
// stripMd가 백틱을 벗기자 ⏳ 앞 글자가 ':'(구분자)가 되어 항목으로 승격됐고,
// **자기 결함을 설명하는 문단이 결정으로 폰에 배달됐다.**
//
// 지키는 것: ①코드 스팬 안의 ⏳는 항목이 아니다 ②진짜 항목 뒤에 붙은 코드 스팬 인용은
// 텍스트에서 사라지지 않는다(마스킹은 판별용이지 삭제가 아니다) ③기존 두 용법 판별은 그대로.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Q = require('../tools/decision-queue.js');
const { memoryDir } = require('../tools/memory-graph.js');

/* [2026-08-04 · 내가 CI를 깨뜨린 자리] 메모리 정본은 **repo 밖**(`~/.claude/projects/…/memory`)에 산다.
 * 그래서 「실저장소 검사」는 이 머신에서만 성립하고 CI 러너에는 그 폴더가 아예 없다 —
 * 로컬 638 pass가 CI 초록의 증명이 못 됐다(08-04 CI 트랙의 「로컬에만 있는 환경에 기대면 CI가 검출한다」와 같은 계열).
 * 🔑그래서 **탐지 능력은 픽스처가 전부 지고**, 실저장소 검사는 **폴더가 있을 때만** 도는 보너스로 낮춘다.
 * 조용히 통과시키지 않고 skip으로 드러낸다 — 통과와 미실행은 같은 모양이면 안 된다. */
const MEM = memoryDir();
const HAS_MEMORY = fs.existsSync(MEM);

/* extract()는 디렉터리를 받으므로 픽스처 볼트를 만든다 —
 * 실저장소로 검사하면 「버그가 아직 있을 것」을 요구하는 회귀가 된다(guard-must-check-result). */
function withVault(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dq-codespan-'));
  try {
    for (const [name, body] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), body, 'utf8');
    }
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('코드 스팬 안의 ⏳는 항목이 아니다 — 기호를 설명하는 문장이 결정으로 배달되면 안 된다', () => {
  const items = withVault({
    'a.md': '- 🔑교훈: `⏳`가 두 용법으로 쓰이는데 안 갈라서 조각이 배달됐다.\n',
  }, (d) => Q.extract(d));
  assert.deepStrictEqual(items, [], `코드 스팬 인용을 항목으로 셌다: ${JSON.stringify(items)}`);
});

test('진짜 항목은 코드 스팬이 같은 줄에 있어도 살아남고, 인용 기호도 지워지지 않는다', () => {
  const items = withVault({
    'b.md': '- ⏳유호=폰으로 답한 뒤 `⏳` 표시를 지울지 결정\n',
  }, (d) => Q.extract(d));
  assert.strictEqual(items.length, 1, '진짜 항목이 마스킹에 쓸려나갔다');
  assert.ok(items[0].text.startsWith('⏳유호=폰으로'), items[0].text);
  assert.ok(items[0].text.includes('⏳ 표시를'), `마스킹이 되돌려지지 않았다: ${items[0].text}`);
});

test('기존 두 용법 판별은 그대로 — 본문 속 지시어는 여전히 항목이 아니다', () => {
  const items = withVault({
    'c.md': '위 ⏳3건 미결 상태에서 착수하면 안 된다.\n',
  }, (d) => Q.extract(d));
  assert.deepStrictEqual(items, []);
});

test('기존 두 용법 판별은 그대로 — 줄머리 표시는 여전히 항목이다', () => {
  const items = withVault({
    'd.md': '- ⏳ 유호님 몫: 개원일 확정\n',
  }, (d) => Q.extract(d));
  assert.strictEqual(items.length, 1);
  assert.ok(items[0].text.includes('개원일 확정'));
});

/* [충돌 병합 08-04] 옆 세션과 이 자리를 동시에 고쳤다. 두 안의 차이는 **무엇으로 「없음」을 아는가**였다:
 *   ⓐ(옆 세션) build()를 돌려보고 `e.code === 'ENOENT'`면 skip — 던져진 오류의 모양으로 판별
 *   ⓑ(이쪽)   돌리기 전에 폴더 존재를 확인해 skip — 상태를 먼저 판별
 * ⓑ를 택한다. 같은 커밋에서 `extract()`가 **안내 문구가 붙은 일반 Error**를 던지도록 바꿨으므로
 * ⓐ의 `code` 검사는 더 이상 안 걸리고 그대로 빨간불이 된다 — 「특정 형태에 앵커를 걸면 그 형태가
 * 바뀌는 순간 가드가 죽는다」([[worktree-version-collision]])의 교과서적 실례다.
 * ⓐ의 좋은 점(**다른 오류는 숨기지 않는다**)은 ⓑ가 애초에 아무것도 삼키지 않으므로 그대로 지켜진다. */
test('실저장소: 이 도구의 회고 문단이 큐에 없다(거짓양성만 검사)', {
  skip: HAS_MEMORY ? false : `메모리 정본이 이 머신에 없다(${MEM}) — repo 밖이라 CI에는 존재하지 않는다`,
}, () => {
  const q = Q.build({ count: 3 });
  const ghost = q.ranked.filter((it) => /두 용법으로 쓰이는데/.test(it.text));
  assert.deepStrictEqual(ghost, [], '자기 결함 회고가 다시 결정으로 올라왔다');
});

/* [2026-08-12 · 31b26852] 🔴 **이 파일이 있는데도 헤더 경로로 샜다.**
 * 위 검사 넷은 전부 «불릿»(항목 경로)만 태웠는데, 줄판정의 헤더 분기가 maskCodeSpans 보다
 * «앞»에 있어 원문을 봤다 → `## ✅ 종결 (위 `⏳` 는 실행됐다)` 가 「절 제목」으로 세어졌고
 * --절 이 그 파일을 「배달 0건」으로 계속 불렀다. **백틱을 씌워도 안 꺼진다** — 즉 도구가
 * 내미는 처방을 따를 수 없었다(F103).
 * 🔑 교훈 = 탐지 축이 「코드 스팬」이면 검사도 «코드 스팬이 나타나는 경로별»로 태워야 한다.
 *    픽스처를 불릿으로만 짜면 규칙이 안 걸리는 경로가 조용히 남는다(가드 맹점③). */
test('헤더도 같은 규칙을 지난다 — 기호를 «말하기만» 한 제목은 절 제목이 아니다', () => {
  const 판정 = Q.줄판정('## ✅ 종결 (2026-08-11 — 위 `⏳` 는 실행됐다)');
  assert.strictEqual(판정, null, `말하는 자리인 헤더를 「${판정 && 판정.사유}」로 셌다`);
});

test('헤더 판별이 죽지는 않았다 — 진짜 표식을 단 제목은 여전히 절 제목이다', () => {
  const 판정 = Q.줄판정('## ⏳ 유호 대기');
  assert.ok(판정 && 판정.절제목 === true, `진짜 절 제목을 놓쳤다: ${JSON.stringify(판정)}`);
});

test('extract 층까지 관통 — 말하기만 한 제목뿐인 파일은 「배달 0건」으로 안 불린다', () => {
  const 절뿐 = withVault({
    'e.md': '## ✅ 종결 (위 `⏳` 는 실행됐다)\n\n본문이 있다.\n',
  }, (d) => Q.extract(d).절뿐);
  assert.deepStrictEqual(절뿐, [], `따를 수 없는 처방이 다시 났다: ${JSON.stringify(절뿐)}`);
});

test('extract 층 — 진짜 절 제목만 걸고 항목이 없는 파일은 그대로 잡힌다', () => {
  const 절뿐 = withVault({
    'f.md': '## ⏳ 유호 대기\n\n- 신고 접수처 2칸을 정한다.\n',
  }, (d) => Q.extract(d).절뿐);
  assert.strictEqual(절뿐.length, 1, '절 제목만 걸린 파일을 놓쳤다 — 가드가 죽었다');
});

/* [2026-08-12 · 31b26852] **다섯 번째 배달 실패 모양 — frontmatter.**
 * `description:` 은 파일 전체 요약이라 ✅와 ⏳가 구조적으로 한 줄에 온다. 실측(design-docs-sweep-0811):
 * 그 줄이 항목으로 배달되며 아래 metadata 블록을 꼬리로 끌고 갔고, 「끝난 일이 미결로 안 간다」
 * 회귀(결정큐.test.js)를 상시 빨갛게 만들었다 — 주인 없는 적색은 남의 배포 게이트를 막는다. */
test('frontmatter 의 ⏳ 는 항목이 아니다 — description 은 파일 «에 대한» 메타다', () => {
  const items = withVault({
    'g.md': '---\nname: g\ndescription: 점검 — 기각 5 봉인·⏳유호 6(살아 있음)·✅반영 종결\nmetadata:\n  type: project\n---\n\n## 본문\n내용.\n',
  }, (d) => Q.extract(d));
  assert.deepStrictEqual([...items], [], `frontmatter 를 항목으로 셌다: ${JSON.stringify(items)}`);
});

test('frontmatter 는 조용히 사라지지 않는다 — 폐기함에 기록된다(F108)', () => {
  const 버려진 = withVault({
    'h.md': '---\ndescription: ⏳유호 6(살아 있음)\n---\n\n본문.\n',
  }, (d) => Q.extract(d).버려진);
  const 몫 = 버려진.filter((b) => b.사유 === '프론트매터로 판정');
  assert.strictEqual(몫.length, 1, `무기록으로 사라졌다: ${JSON.stringify(버려진)}`);
  assert.strictEqual(몫[0].line, 2, '줄 번호가 밀렸다 — 큐는 이 좌표로 다시 찾는다');
});

test('frontmatter 아래 본문의 ⏳ 는 그대로 산다 — 가드가 파일을 통째로 삼키지 않았다', () => {
  const items = withVault({
    'i.md': '---\ndescription: 요약 ⏳ 있음\n---\n\n- ⏳ 유호님 몫: 개원일 확정\n',
  }, (d) => Q.extract(d));
  assert.strictEqual(items.length, 1, '본문 항목까지 함께 버렸다');
  assert.ok(items[0].text.includes('개원일 확정'));
});

test('닫히지 않은 `---` 는 frontmatter 가 아니다 — 본문 수평선이 큐를 0건으로 만들면 안 된다', () => {
  const items = withVault({
    'j.md': '---\n\n- ⏳ 유호님 몫: 개원일 확정\n',
  }, (d) => Q.extract(d));
  assert.strictEqual(items.length, 1,
    '닫히지 않은 구분선을 frontmatter 로 읽어 파일 전체를 삼켰다 — 미실행과 통과가 같은 모양이 된다');
});

/* 위 검사를 skip으로 낮춘 대신, **그 상황 자체**를 픽스처로 못박는다 —
 * 「폴더가 없으면 조용히 0건」이 되면 클라우드 cron이 영영 침묵해도 아무도 모른다. */
test('메모리 폴더가 없으면 크게 실패한다 — 빈 큐로 위장하지 않는다', () => {
  const gone = path.join(os.tmpdir(), `dq-없는폴더-${process.pid}`);
  assert.ok(!fs.existsSync(gone));
  assert.throws(() => Q.extract(gone), /메모리 디렉터리를 못 찾음/,
    '경로를 못 찾은 것은 「미결 0건」과 같은 모양이면 안 된다');
});
