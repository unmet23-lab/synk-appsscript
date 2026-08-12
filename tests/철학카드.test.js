/**
 * philosophy-card 회귀 — 「판단 정본이 세션에 실리는가」
 *
 * 왜 있나 (2026-08-10):
 *   메모리에 「판단 정본 = SYNK_철학.md 정독」이 적혀 있었지만 **발화 장치가 없어 안 돌았다.**
 *   장치를 달았으니 이 테스트가 그 장치의 세 가지 죽는 방식을 막는다:
 *     ① 등록층에서 샌다 — 훅 파일은 멀쩡한데 settings.json 에 없으면 안 돈다(F044·F053).
 *     ② 앵커가 낡는다 — 정본 절 구조가 바뀌면 카드가 조용히 비고, 「기준 없음」이 「통과」로 보인다.
 *     ③ 사본이 갈라진다 — 카드 문구를 훅에 베껴 두면 정본 개정 뒤에도 옛 기준으로 판정한다.
 *
 * ⚠ 탐지력은 **픽스처**가 진다(CLAUDE.md 신뢰성 — 버그가 아직 있을 것을 요구하는 회귀 금지).
 *   실저장소에는 거짓양성만 검사하고, 정본이 없는 환경(워크트리·CI 부분 체크아웃)은 fail 이 아니라 skip.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { 훅띄우기 } = require('./lib/훅띄우기');   // 날 spawnSync 금지 — 미실행이 「통과」로 번역된다

const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'philosophy-card.js');
const 정본 = path.join(ROOT, 'docs', 'SYNK_철학.md');
const { 뽑기, 상한적용, 자리상한 } = require(HOOK);

/* ── ① 탐지력 = 픽스처 ─────────────────────────────────────────── */

const 성한_정본 = [
  '<!-- 정본: v9.9 -->',
  '## Ⅰ. 내부·운영 철학',
  '',
  '**한 문장: 가치 문장이 여기 온다.**',
  '',
  '**3. 「똑똑하게」 — 세 가지 기준.**',
  '①**기본**: 게이트 본문이 여기 온다.',
  '',
].join('\n');

test('픽스처 — 앵커가 성하면 두 자리를 뽑는다', () => {
  assert.strictEqual(뽑기(성한_정본, /^\*\*한 문장:/, false), '한 문장: 가치 문장이 여기 온다.');
  assert.strictEqual(뽑기(성한_정본, /^\*\*3\. 「똑똑하게」/, true), '①기본: 게이트 본문이 여기 온다.');
});

test('픽스처 — 절 번호가 바뀌면 못 찾은 것으로 드러난다(조용한 빈 카드 금지)', () => {
  const 낡은 = 성한_정본.replace('**3. 「똑똑하게」', '**4. 「똑똑하게」');
  assert.strictEqual(뽑기(낡은, /^\*\*3\. 「똑똑하게」/, true), null);
});

test('픽스처 — 앵커는 있는데 본문이 비면 null(빈 줄을 기준으로 싣지 않는다)', () => {
  const 빈본문 = 성한_정본.replace('①**기본**: 게이트 본문이 여기 온다.', '');
  assert.strictEqual(뽑기(빈본문, /^\*\*3\. 「똑똑하게」/, true), null);
});

/* ── ①-b 반쪽 카드 — 「못 뽑음」보다 위험한 죽는 방식 (2026-08-12) ──────────────
 * 앵커를 찾으면 위의 실패 처리는 전부 비껴간다. 그래서 정본이 두 줄로 갈리면 훅은
 * **성공한 얼굴로 뒷줄을 버렸다.** 없는 카드는 시끄럽지만 반쪽 카드는 조용하다 —
 * 세션은 반쪽 기준으로 판정하면서 초록을 본다(F207 의 길이 축 재발). */

test('픽스처 — 본문이 여러 줄이면 전부 싣는다(한 줄만 집어 조용히 반쪽 되는 것 금지)', () => {
  const 여러줄 = 성한_정본.replace(
    '①**기본**: 게이트 본문이 여기 온다.',
    ['①**기본**: 첫째 줄.', '②**엔진**: 둘째 줄.', '③**운영**: 셋째 줄.'].join('\n'),
  );
  assert.strictEqual(
    뽑기(여러줄, /^\*\*3\. 「똑똑하게」/, true),
    '①기본: 첫째 줄. ②엔진: 둘째 줄. ③운영: 셋째 줄.',
    '뒷줄이 사라졌다 — 카드가 반쪽인데 훅은 성공으로 끝난다',
  );
});

test('픽스처 — 빈 줄 없이 다음 절이 붙어도 그 절을 먹지 않는다', () => {
  const 붙은절 = 성한_정본.replace(
    '①**기본**: 게이트 본문이 여기 온다.\n',
    '①**기본**: 게이트 본문이 여기 온다.\n**4. 시스템이 돌린다.**\n',
  );
  assert.strictEqual(뽑기(붙은절, /^\*\*3\. 「똑똑하게」/, true), '①기본: 게이트 본문이 여기 온다.');
});

test('픽스처 — 가치 자리도 여러 줄을 싣는다(다음줄=false 갈래도 같은 규칙)', () => {
  const 여러줄 = 성한_정본.replace(
    '**한 문장: 가치 문장이 여기 온다.**',
    '**한 문장: 가치 문장이 여기 온다.**\n그리고 이어지는 둘째 줄.',
  );
  assert.strictEqual(
    뽑기(여러줄, /^\*\*한 문장:/, false),
    '한 문장: 가치 문장이 여기 온다. 그리고 이어지는 둘째 줄.',
  );
});

test('상한 — 절이 길어지면 자르되 「잘렸다」가 카드에 박힌다(조용한 반쪽 금지)', () => {
  assert.strictEqual(상한적용('짧다', '게이트'), '짧다', '상한 안이면 손대지 않는다');
  const 긴 = 'ㄱ'.repeat(자리상한 + 500);
  const 결과 = 상한적용(긴, '게이트');
  assert.ok(결과.length < 긴.length, '상한을 넘었는데 안 잘렸다 — 상주 비용이 정본 전문으로 돌아간다');
  assert.ok(결과.includes('잘렸다'), '잘린 사실이 화면에 안 뜨면 반쪽인 줄 모른다');
  assert.ok(결과.includes('docs/SYNK_철학.md'), '어디를 열어야 하는지가 없다');
});

/* ── ② 등록층 — 훅이 있어도 등록이 없으면 안 돈다 ─────────────────── */

test('등록층 — SessionStart 에 등록돼 있고, 경로가 이식 가능한 표기다', () => {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const 줄 = JSON.stringify(s.hooks.SessionStart || []);
  assert.ok(줄.includes('philosophy-card.js'), 'SessionStart 에 philosophy-card 등록이 없다 — 훅은 안 돈다');
  const 항목 = (s.hooks.SessionStart || []).flatMap((e) => (e.hooks || []).map((h) => h.command))
    .filter((c) => c && c.includes('philosophy-card.js'));
  assert.strictEqual(항목.length, 1, '등록이 0건이거나 중복이다');
  // 로컬 절대경로로 박으면 다른 기계에서 통째로 죽는다(F044). 클라우드에선 이 변수가 비어 폴백이 일한다.
  assert.ok(항목[0].includes('${CLAUDE_PROJECT_DIR:-$PWD}'), '등록 경로가 이식 가능한 표기가 아니다');
  // 실행 불가는 조용한 통과가 아니라 드러나야 한다.
  assert.ok(/exit 1/.test(항목[0]), '실행 불가가 드러나지 않는다(조용히 넘어가면 기준 없이 돈다)');
});

/* ── ③ 실저장소 — 거짓양성만 검사(정본 없으면 skip) ────────────────── */

test('실저장소 — 현재 정본에서 카드가 실제로 나온다', (t) => {
  if (!fs.existsSync(정본)) return t.skip('docs/SYNK_철학.md 없음 — 이 환경에선 못 잰다(미실행을 통과로 세지 않는다)');
  // CLAUDE_PROJECT_DIR 를 비워 **폴백 경로**를 태운다 — 클라우드에선 실제로 그쪽이 일한다(F044).
  const r = 훅띄우기(HOOK, { encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: '' } });
  assert.match(r.stdout, /판단 정본/);
  assert.match(r.stdout, /【궁극 가치】/);
  assert.match(r.stdout, /【「똑똑하게」 3층/);
  assert.match(r.stdout, /docs\/SYNK_철학\.md v\d+\.\d+/, '정본 판 번호가 카드에 안 실렸다(낡은 카드를 못 알아본다)');
});

test('실저장소 — 카드는 정본에서 뽑은 것이지 훅에 베낀 사본이 아니다', (t) => {
  if (!fs.existsSync(정본)) return t.skip('docs/SYNK_철학.md 없음');
  const 훅소스 = fs.readFileSync(HOOK, 'utf8');
  // 게이트 본문의 특징 어절이 훅 소스에 박혀 있으면 그건 사본이다 — 정본이 바뀌어도 안 따라온다.
  for (const 어절 of ['하나라도 빠지면 미완성', '산출이 엔진에 닿는가']) {
    assert.ok(!훅소스.includes(어절), `훅 소스에 정본 문구가 베껴져 있다("${어절}") — 개정되면 갈라진다`);
  }
});

test('실저장소 — 카드가 전문을 통째로 싣지 않는다(상주 비용)', (t) => {
  if (!fs.existsSync(정본)) return t.skip('docs/SYNK_철학.md 없음');
  const r = 훅띄우기(HOOK, { encoding: 'utf8' });
  const 전문 = fs.readFileSync(정본, 'utf8').length;
  assert.ok(r.stdout.length < 전문 * 0.25,
    `카드가 정본의 25% 를 넘는다(${r.stdout.length}/${전문}) — 매 세션 상주 비용이 남은 턴 수만큼 곱해진다`);
});
