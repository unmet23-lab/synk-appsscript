/**
 * 발표물린트 회귀 — 인쇄물 잠금값 검사기가 실제로 잡는지
 *
 * 탐지 능력은 **픽스처가 진다**. 실저장소 파일에는 「거짓양성이 없는지」만 묻는다
 * (CLAUDE.md — 버그가 아직 있을 것을 요구하는 회귀 금지).
 *
 * 이 린트가 처음 돈 날 **자기 CSS 주석에 걸렸다** — 「#101528 은 탈락값이다」라고
 * 적어 둔 설명문을 위반으로 잡았다. 그래서 주석 제거가 여기 픽스처로 못박혀 있다.
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const LINT = path.join(ROOT, 'tools', '발표물린트.js');

let dir;
test.before(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-print-lint-')); });
test.after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* 무해 */ } });

/** 규격을 전부 지키는 최소 산출물. 각 테스트는 여기서 한 군데만 망가뜨린다. */
function page(opts) {
  const o = opts || {};
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>t</title>
<style>
${o.cssComment || ''}
@page { size: A4 portrait; margin: 0; }
:root{ --midnight:${o.midnight || '#0B1A2E'}; }
html,body{ font-family:${o.font || "'Inter Tight','SUIT Variable'"},sans-serif; print-color-adjust:exact; }
.mono{ font-family:'DM Mono',ui-monospace,monospace; }
</style></head><body>
<div class="mono">${o.monoText || 'SEASON 01'}</div>
<div>${o.text || '승급은 도달제입니다.'}</div>
${o.extra || ''}
</body></html>`;
}

let n = 0;
function run(html) {
  const f = path.join(dir, `p${n++}.html`);
  fs.writeFileSync(f, html);
  const r = spawnSync(process.execPath, [LINT, f], { encoding: 'utf8', timeout: 20000 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

test('규격을 지킨 페이지는 통과한다 (거짓양성 0)', () => {
  const v = run(page());
  assert.strictEqual(v.code, 0, `멀쩡한 페이지를 잡았다:\n${v.out}`);
  assert.match(v.out, /✅/);
});

test('🔑 CSS 주석 안의 폐기값을 위반으로 잡지 않는다 (자기 주석에 걸린 실측 결함)', () => {
  const v = run(page({ cssComment: '/* #101528 은 탈락값이다. 확정값은 #0B1A2E */' }));
  assert.strictEqual(v.code, 0,
    `주석에 적은 설명을 위반으로 잡았다 — 가드는 렌더에 쓰이는 표기만 봐야 한다:\n${v.out}`);
});

test('반전면에 탈락한 색이 되살아나면 잡는다', () => {
  const v = run(page({ midnight: '#101528' }));
  assert.strictEqual(v.code, 1, '탈락값 #101528 을 그냥 통과시켰다');
  assert.match(v.out, /탈락한 색/);
  assert.match(v.out, /#0B1A2E/, '확정값을 알려주지 않으면 고칠 수가 없다');
});

test('🔑 DM Mono 에 한글이 들어가면 잡는다 (글리프가 없어 인쇄에서 깨진다)', () => {
  const v = run(page({ monoText: 'DESTINATION · 한국 유학' }));
  assert.strictEqual(v.code, 1, 'DM Mono 안의 한글을 통과시켰다');
  assert.match(v.out, /DM Mono/);
});

test('🔑 「졌다」는 단독 낱말일 때만 잡는다 — 「즐거워졌다」를 벌주지 않는다', () => {
  // 실측: 상담 브로셔의 핀란드 인용문 「학교가 더 즐거워졌다」가 부분일치로 금칙어에 걸렸다.
  // 가드가 실작업을 벌주면 사람이 가드를 끈다. 탐지력은 유지하고 거짓양성만 없앤다.
  const ok = run(page({ text: '학생들이 “학교가 더 즐거워졌다”고 응답했습니다. 성적도 좋아졌다고 합니다.' }));
  assert.strictEqual(ok.code, 0, `정상 표현을 금칙어로 잡았다:\n${ok.out}`);

  const bad = run(page({ text: '지난 시합에서 졌다.' }));
  assert.strictEqual(bad.code, 1, '진짜 금칙어를 놓쳤다 — 거짓양성을 없애다 탐지력까지 없애면 안 된다');
  assert.match(bad.out, /졌다/);

  assert.strictEqual(run(page({ text: '이미 늦었다.' })).code, 1, '「늦었다」를 놓쳤다');
  assert.strictEqual(run(page({ text: '준비가 깊어졌다.' })).code, 0, '「깊어졌다」를 잡았다');
});

test('금칙어 8종과 폐기 표기를 잡는다', () => {
  assert.strictEqual(run(page({ text: '실패해도 괜찮습니다' })).code, 1, '금칙어를 통과시켰다');
  assert.strictEqual(run(page({ text: 'Define → Build → Execute 사이클' })).code, 1, '폐기 사이클을 통과시켰다');
  assert.strictEqual(run(page({ text: '원어민급 지향 수준까지' })).code, 1, '6급 전제 표기를 통과시켰다');
});

test('자립형이 깨지면 잡는다 — 외부 자원·CDN', () => {
  assert.strictEqual(run(page({ extra: '<img src="https://x.test/a.png">' })).code, 1, '외부 이미지를 통과시켰다');
  assert.strictEqual(run(page({ cssComment: '@import url("https://f.test/x.css");' })).code, 1, '@import 를 통과시켰다');
});

test('인쇄면의 이모지를 잡는다 — 단, 화살표·기호 활자는 벌주지 않는다', () => {
  // 정본 ■9: 이모지를 그대로 인쇄하지 않고 단색 라인 아이콘으로 치환한다.
  // 실측: 설명회 덱의 「사진 자리」에 📷 를 넣었다가 걸렸다.
  const bad = run(page({ text: '📷 사진 자리 — 워밍업 장면' }));
  assert.strictEqual(bad.code, 1, '이모지를 통과시켰다 — 인쇄하면 그림문자가 그대로 찍힌다');
  assert.match(bad.out, /이모지/);

  assert.strictEqual(run(page({ text: '✂ 잘라서 보관하세요' })).code, 1,
    '가위(✂)는 색 이모지로 렌더된다 — 인쇄면에서는 라인 아이콘이어야 한다');

  // 🔑 활자로 쓰는 기호는 벌주지 않는다. 범위(2600–27BF)로 검사했을 때
  //   ☐·→·▷ 까지 잡혀 멀쩡한 산출물 3개가 빨개졌다 — 그래서 유니코드 속성으로 좁혔다.
  const ok = run(page({ text: '☐ 첫 수업 날 확인 · 기획 → 도전 → 완성 · ▷ 통역 지점 · 1시즌 = 8주' }));
  assert.strictEqual(ok.code, 0, `활자 기호(☐ → ▷)를 이모지로 잡았다:\n${ok.out}`);
});

test('구 서체가 CSS 스택에만 남아도 잡는다 (본문 텍스트엔 안 보인다)', () => {
  const v = run(page({ font: "'Pretendard'" }));
  assert.strictEqual(v.code, 1, 'CSS 안의 구 서체를 통과시켰다 — 화면은 멀쩡해 보이고 렌더만 바뀐다');
  assert.match(v.out, /구 서체/);
});

test('가격 수치·비노출 잠금·기간 약속을 잡는다', () => {
  assert.strictEqual(run(page({ text: '월 55만₮ 입니다' })).code, 1, '가격 수치를 통과시켰다');
  assert.strictEqual(run(page({ text: 'SYNK Wear 도 준비 중' })).code, 1, '비노출 잠금을 통과시켰다');
  assert.strictEqual(run(page({ text: '6개월이면 3급' })).code, 1, '기간 약속을 통과시켰다');
});

test('인쇄 규격 누락을 잡는다 — 여백 0·배경 인쇄', () => {
  const noMargin = page().replace('margin: 0;', 'margin: 10mm;');
  assert.strictEqual(run(noMargin).code, 1, '여백 0 잠금이 빠졌는데 통과시켰다');
  const noBg = page().replace('print-color-adjust:exact;', '');
  assert.strictEqual(run(noBg).code, 1, '배경 인쇄 설정이 빠졌는데 통과시켰다');
});

test('교재를 언급하면 진행 상태를 함께 밝히게 한다 (과장 금지)', () => {
  const v = run(page({ text: '시냅스 코어 6권으로 완주합니다' }));
  assert.strictEqual(v.code, 1, '교재만 말하고 진행 상태를 안 밝혔는데 통과시켰다');
  const okPage = run(page({ text: '시냅스 코어 6권으로 완주합니다. 1권은 원어민 검수를 앞두고 있습니다.' }));
  assert.strictEqual(okPage.code, 0, `진행 상태를 밝혔는데도 잡았다:\n${okPage.out}`);
});

test('실저장소의 발표물 전량이 통과한다 (거짓양성 0)', (t) => {
  const dirPath = path.join(ROOT, 'docs', '발표물');
  if (!fs.existsSync(dirPath)) return t.skip('docs/발표물 없음 — 아직 산출물이 없다');
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.html')).map((f) => path.join(dirPath, f));
  if (!files.length) return t.skip('발표물 HTML 0건');
  const r = spawnSync(process.execPath, [LINT, ...files], { encoding: 'utf8', timeout: 30000 });
  assert.strictEqual(r.status, 0, `실산출물이 잠금값을 어겼다:\n${r.stdout}`);
});
