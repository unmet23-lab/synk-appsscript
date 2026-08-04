/* DESIGN.md(루트 진입로) ↔ 디자인 정본 동기화 가드 — 2026-08-05 신설.
 *
 * 왜: DESIGN.md 는 요약+진입로라 정본의 값(HEX·폰트 스택)을 인용한다. 정본이 개정되면
 *   요약이 낡는데, 「정본 개정이 파생 문서에 전파 안 된다」는 이미 실측된 실패 형태다
 *   (doc-audit 2026-07-28 · F092 계열). 사람 눈 대신 여기서 기계로 잡는다.
 *
 * 무엇을 지키나:
 *   ① DESIGN.md 가 인용한 HEX 전수는 DESIGN.md 가 링크한 정본 문서 중 하나에 실존한다.
 *   ② 폰트 스택(--synk-font*)은 브랜드_폰트_정본.md 의 스택과 문자 그대로 일치한다.
 *   ③ DESIGN.md 가 링크·인용한 repo 경로는 전부 실존한다 — 검사 목록은 손 목록이 아니라
 *      DESIGN.md 본문에서 파생한다(F080: 손 목록 둘은 갈라진다 / 경로 리터럴 인질 방지).
 *   ④ 반입한 외부 스킬 3종은 SKILL.md + LICENSE(MIT 고지 보존 의무)를 갖춘다.
 *
 * 탐지력은 픽스처로 못박는다 — 실저장소가 초록이어도 「잡을 수 있는 눈」인지는 가짜
 * 입력으로 증명한다(가드의 두 맹점 ②: 버그가 아직 있길 요구하는 회귀 금지).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DESIGN = path.join(ROOT, 'DESIGN.md');
const read = (p) => fs.readFileSync(p, 'utf8');

/** 6자리 HEX 인용을 뽑는다(대문자 정규화·중복 제거). */
const extractHexes = (src) => [...new Set((src.match(/#[0-9A-Fa-f]{6}\b/g) || []).map((h) => h.toUpperCase()))];

/** 본문이 링크·인용한 repo 상대 경로 — 마크다운 링크의 docs/*.md 와 백틱 인용의 tools/*.js·tests/*.js. */
const extractPaths = (src) => {
  const md = [...src.matchAll(/\((docs\/[^)]+?\.md)\)/g)].map((m) => m[1]);
  const code = [...src.matchAll(/`((?:tools|tests)\/[^`\s]+?\.js)`/g)].map((m) => m[1]);
  return [...new Set([...md, ...code])];
};

/** --synk-font* 스택 선언을 뽑아 공백을 접는다(정렬 스페이스 차이는 동일로 본다). */
const extractStacks = (src) =>
  (src.match(/--synk-font[\w-]*\s*:[^;]+;/g) || []).map((s) => s.replace(/\s+/g, ' ').trim()).sort();

/** ① 의 판정기: design 이 인용한 HEX 중 canon 연합에 없는 것을 돌려준다. */
const missingHexes = (designSrc, canonSrc) => {
  const canon = new Set(extractHexes(canonSrc));
  return extractHexes(designSrc).filter((h) => !canon.has(h));
};

// ── 탐지력 픽스처 ──────────────────────────────────────────────────────────
test('픽스처: 정본에 없는 HEX 는 잡히고, 있는 HEX 는 통과한다', () => {
  const canon = '표 | Coral | `#FF6B5C` | 와 Paper `#FBF7EE`';
  assert.deepEqual(missingHexes('신호 `#FF6B5C`', canon), []);
  assert.deepEqual(missingHexes('낡은 값 `#123ABC` 와 `#ff6b5c`', canon), ['#123ABC']);
});

test('픽스처: 스택 추출은 정렬 공백 차이를 무시하고, 순서 변조는 다른 값으로 본다', () => {
  const a = extractStacks("--synk-font:      'Inter Tight','SUIT Variable',sans-serif;");
  const b = extractStacks("--synk-font: 'Inter Tight','SUIT Variable',sans-serif;");
  assert.deepEqual(a, b);
  const flipped = extractStacks("--synk-font: 'SUIT Variable','Inter Tight',sans-serif;");
  assert.notDeepEqual(a, flipped);
});

// ── 실저장소 검사 ──────────────────────────────────────────────────────────
test('DESIGN.md 가 존재하고 정본 링크를 가진다', () => {
  assert.ok(fs.existsSync(DESIGN), 'repo 루트에 DESIGN.md 가 없다');
  const links = extractPaths(read(DESIGN)).filter((p) => p.endsWith('.md'));
  assert.ok(links.length >= 3, `정본 링크가 3개 미만이다(발견 ${links.length}) — 진입로가 진입로가 아니게 됐다`);
});

test('① DESIGN.md 인용 HEX 전수가 링크된 정본 중 하나에 실존한다', () => {
  const design = read(DESIGN);
  const canonUnion = extractPaths(design)
    .filter((p) => p.endsWith('.md') && fs.existsSync(path.join(ROOT, p)))
    .map((p) => read(path.join(ROOT, p)))
    .join('\n');
  const missing = missingHexes(design, canonUnion);
  assert.deepEqual(missing, [], `정본 어디에도 없는 HEX 인용: ${missing.join(', ')} — 정본이 개정됐거나 오타다`);
});

test('② 폰트 스택이 브랜드_폰트_정본.md 와 문자 그대로 일치한다', () => {
  const design = extractStacks(read(DESIGN));
  const canon = extractStacks(read(path.join(ROOT, 'docs', '브랜드_폰트_정본.md')));
  assert.ok(design.length >= 2, `DESIGN.md 에서 --synk-font 스택을 ${design.length}개만 찾았다(2개여야 한다)`);
  for (const s of design) assert.ok(canon.includes(s), `정본에 없는 스택 인용: ${s}`);
});

test('③ DESIGN.md 가 링크·인용한 경로 전수가 실존한다(목록은 본문에서 파생)', () => {
  const paths = extractPaths(read(DESIGN));
  assert.ok(paths.length >= 5, `파생된 경로가 ${paths.length}개뿐이다 — 추출 정규식이 죽었는지 의심`);
  const gone = paths.filter((p) => !fs.existsSync(path.join(ROOT, p)));
  assert.deepEqual(gone, [], `DESIGN.md 가 가리키는데 없는 경로: ${gone.join(', ')}`);
});

test('④ 반입 스킬 3종 + synk-design 이 SKILL.md 를, 외부 3종은 LICENSE(MIT)까지 갖춘다', () => {
  const SKILLS = path.join(ROOT, '.claude', 'skills');
  for (const name of ['synk-design', 'make-interfaces-feel-better', 'emil-design-eng', 'review-animations']) {
    assert.ok(fs.existsSync(path.join(SKILLS, name, 'SKILL.md')), `${name}/SKILL.md 가 없다`);
  }
  for (const name of ['make-interfaces-feel-better', 'emil-design-eng', 'review-animations']) {
    const lic = path.join(SKILLS, name, 'LICENSE');
    assert.ok(fs.existsSync(lic), `${name}/LICENSE 가 없다 — MIT 고지 보존 의무`);
    assert.match(read(lic), /MIT License/, `${name}/LICENSE 가 MIT 고지가 아니다`);
  }
});
