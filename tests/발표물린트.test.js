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
${o.extraCss || ''}
@page { size: A4 portrait; margin: 0; }
:root{ --midnight:${o.midnight || '#0F1730'}; }
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
  assert.match(v.out, /#0F1730/, '확정값(키트 Navy 2)을 알려주지 않으면 고칠 수가 없다');

  // 구 미드나잇도 키트 이관(08-04)으로 탈락 — 배포물 6종을 접던 값이라 부활 확률이 가장 높다
  const old = run(page({ midnight: '#0B1A2E' }));
  assert.strictEqual(old.code, 1, '구 미드나잇 #0B1A2E 를 통과시켰다 — 키트 v2.0 반전면은 Navy 2 다');
});

test('🔑 DM Mono 에 한글이 들어가면 잡는다 (글리프가 없어 인쇄에서 깨진다)', () => {
  const v = run(page({ monoText: 'DESTINATION · 한국 유학' }));
  assert.strictEqual(v.code, 1, 'DM Mono 안의 한글을 통과시켰다');
  assert.match(v.out, /DM Mono/);
});

test('🔑 DM Mono 를 .mono 밖 CSS 셀렉터로 입히면 잡는다 (01 덱 리허설표 실측 구멍)', () => {
  // class="mono" 내용 검사는 CSS font-family 경로를 못 본다 — 통로를 하나로 강제해야 완전해진다.
  const bad = run(page({ extraCss: ".reh td{ font-family:'DM Mono',monospace; }" }));
  assert.strictEqual(bad.code, 1, 'CSS 경로의 DM Mono 를 통과시켰다 — 내용 검사가 못 보는 통로다');
  assert.match(bad.out, /\.mono 통로 밖/);

  // ::before 는 마크업 클래스를 못 다는 대신 content 가 CSS 안에 있다 — 라틴이면 통과, 한글이면 실패
  const okC = run(page({ extraCss: ".mn::before{ content:'MN '; font-family:'DM Mono',monospace; }" }));
  assert.strictEqual(okC.code, 0, `한글 없는 content 의사요소를 잡았다(거짓양성):\n${okC.out}`);
  const badC = run(page({ extraCss: ".mn::before{ content:'몽골 '; font-family:'DM Mono',monospace; }" }));
  assert.strictEqual(badC.code, 1, 'content 속 한글을 놓쳤다 — 의사요소 예외가 탐지력까지 없앴다');

  // 세 번째 통로 — <code> 등 시맨틱 모노 태그의 한글은 브라우저 기본 모노가 굴림으로 폴백한다
  const badT = run(page({ extra: '<div>대본 = <code>08_설명회_스피치.txt</code></div>' }));
  assert.strictEqual(badT.code, 1, '<code> 속 한글을 통과시켰다 — 굴림 폴백이 인쇄에 그대로 나간다');
  const okT = run(page({ extra: '<div>파일 = <code>run.sh</code></div>' }));
  assert.strictEqual(okT.code, 0, `라틴 전용 <code> 를 잡았다(거짓양성):\n${okT.out}`);
});

/* 08-05 폰트 임베드 이관에서 이 검사가 6종 전부를 빨갛게 만들었다 — @font-face 는 폰트를
 * **정의**만 하고 어떤 요소에도 안 입히는데 「.mono 밖에서 입힌다」로 셌다.
 * 양방향으로 못박는다: 예외가 탐지력까지 없애면 통로 하나가 통째로 열린다. */
test('🔑 @font-face 의 DM Mono 선언은 「입히는 자리」가 아니다 (임베드 거짓양성)', () => {
  const face = "@font-face{font-family:'DM Mono';font-weight:400;src:url(data:font/woff2;base64,AAAA) format('woff2')}";
  const ok = run(page({ extraCss: face }));
  assert.strictEqual(ok.code, 0, `@font-face 선언을 위반으로 잡았다 — 임베드본이 통째로 빨개진다:\n${ok.out}`);

  // 탐지력 보존 — 같은 파일에 @font-face 가 있어도 진짜 위반은 그대로 잡아야 한다
  const still = run(page({ extraCss: `${face}\n.reh td{ font-family:'DM Mono',monospace; }` }));
  assert.strictEqual(still.code, 1, '@font-face 예외가 뒤따르는 진짜 위반까지 덮었다 — 통로가 열렸다');
  assert.match(still.out, /\.mono 통로 밖/);
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
  assert.strictEqual(run(page({ text: 'SYNK STUDIO 가 만듭니다' })).code, 1, '비노출 잠금을 통과시켰다');
  assert.strictEqual(run(page({ text: '6개월이면 3급' })).code, 1, '기간 약속을 통과시켰다');
});

// 철회는 「안 쓰기로 했다」로는 안 지켜진다 — 구 덱·구 문구를 재활용하는 순간 되살아난다.
// 유호님 확정 2026-08-16(조직계보 v1.4 부록 5) 을 기계로 못박는 자리.
test('철회된 제품 라인이 발표물에 되살아나면 잡는다 (2026-08-16)', () => {
  for (const 문구 of ['SYNK Wear (준비중)', 'SYNK Pantry 는 식품', 'SYNK LIFE 소개', '싱크 웨어 굿즈', '팬트리 간식']) {
    const v = run(page({ text: 문구 }));
    assert.strictEqual(v.code, 1, `철회된 제품 라인을 통과시켰다: ${문구}`);
    assert.match(v.out, /철회된 제품 라인/, `철회가 아닌 다른 사유로 걸렸다: ${문구}`);
  }
});

// 🔴 이 검사의 사고 모양은 「안 잡는다」가 아니라 **엉뚱한 걸 잡는다**이다.
// 첫 판이 부분 문자열이라 「소프트웨어」가 「웨어」에 걸렸다 — 에듀테크 발표물에
// 실제로 나올 낱말이라, 그 자리에서 차단 사유가 「철회된 제품 라인」으로 뜬다.
// 실저장소 전량 통과는 그때도 초록이었다(마침 그 낱말이 없었을 뿐) — 픽스처로 못박는다.
test('🔑 철회 검사가 흔한 합성어를 오탐하지 않는다 (거짓양성)', () => {
  for (const 문구 of ['소프트웨어 개발로 시작했습니다', '하드웨어 사양은 낮아도 됩니다', '미들웨어 없이 붙습니다']) {
    const v = run(page({ text: 문구 }));
    assert.doesNotMatch(v.out, /철회된 제품 라인/, `흔한 합성어를 철회로 오탐했다: ${문구}`);
  }
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

/* ══ 넘침 검사(--넘침) ═══════════════════════════════════════════════════════
 * 왜 있나(2026-08-10 실측): 학부모 안내문 앞면에 블록 하나를 더했더니 46px 이 `overflow:hidden`
 * 에 잘렸는데 **린트도 빌드도 전부 초록**이었다. 글자는 파일에 다 있으니 텍스트 검사는
 * 「있다」고 말하고, 사라지는 곳은 종이뿐이다.
 * 크롬이 없으면 **skip 이지 통과가 아니다**(미실행을 초록으로 읽지 않는다 · F207).
 */
function 크롬있나() {
  try { return !!require(path.join(ROOT, 'tools', '브랜드렌더린트.js')).findChrome(); }
  catch (_) { return false; }
}

/** 쪽 상자(고정 크기 + overflow:hidden)를 가진 최소 산출물. */
function 쪽페이지(o) {
  return page({
    extraCss: `.sheet{ width:100mm; height:60mm; overflow:hidden; display:flex; flex-direction:column;
      ${o.justify ? `justify-content:${o.justify};` : ''} padding:${o.pad || '5mm'}; }`,
    // ⚠ flex 자식은 기본이 shrink 1 이다 — 높이를 줘도 상자에 맞춰 **줄어들어** 안 넘친다.
    //   실제 산출물의 본문 블록은 안 줄어드는 자리라 픽스처도 flex:0 0 auto 로 못박는다.
    extra: `<div class="sheet"><h2>제목</h2><div style="height:${o.내용 || 20}mm;flex:0 0 auto">내용</div></div>`,
  });
}

/** --넘침 으로 돌린다. 크롬 호출이 있어 넉넉히 기다리고, **타임아웃은 fail 이 아니라 null** 이다(F296). */
function 넘침실행(html) {
  const f = path.join(dir, `o${n++}.html`);
  fs.writeFileSync(f, html);
  const r = spawnSync(process.execPath, [LINT, '--넘침', f], { encoding: 'utf8', timeout: 120000 });
  if (r.signal) return null;   // 부하로 잘렸다 — 판정하지 않는다
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

test('🔑 쪽이 넘쳐 잘리면 잡는다 — 텍스트 검사가 원리상 못 보는 층', (t) => {
  if (!크롬있나()) return t.skip('크롬 없음 — 넘침 검사를 안 돌렸다(통과 아님)');
  const v = 넘침실행(쪽페이지({ 내용: 90 }));
  if (!v) return t.skip('넘침 검사가 시간 안에 안 끝났다 — 판정 보류(F296)');
  assert.strictEqual(v.code, 1, `쪽이 넘쳤는데 통과시켰다:\n${v.out}`);
  assert.match(v.out, /넘쳐 잘린다/);
  assert.match(v.out, /밖으로 나간 것/, '무엇이 잘렸는지 안 알려주면 고칠 자리를 못 찾는다');
});

test('🔑 가운데 정렬 쪽은 **위로도** 잘린다 — 아래만 보면 절반을 놓친다', (t) => {
  if (!크롬있나()) return t.skip('크롬 없음 — 넘침 검사를 안 돌렸다(통과 아님)');
  const v = 넘침실행(쪽페이지({ 내용: 90, justify: 'center' }));
  if (!v) return t.skip('넘침 검사가 시간 안에 안 끝났다 — 판정 보류(F296)');
  assert.strictEqual(v.code, 1, `가운데 정렬 쪽의 넘침을 놓쳤다(위쪽으로 잘린다):\n${v.out}`);
});

test('🔑 거짓양성 — 아래 padding 이 scrollHeight 에 얹힌 것을 「넘쳤다」로 읽지 않는다', (t) => {
  if (!크롬있나()) return t.skip('크롬 없음 — 넘침 검사를 안 돌렸다(통과 아님)');
  // 실측: 02 안내문 hero 가 자식이 전부 상자 안에 있는데 scrollHeight 로는 22px 초과였다.
  // 거짓양성이 곧 「검사를 끄는 손버릇」이라 이 함정을 양방향으로 못박는다.
  const v = 넘침실행(page({
    extraCss: '.sheet{ width:100mm; height:60mm; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between; padding:5mm 5mm 12mm; }',
    extra: '<div class="sheet"><h2>제목</h2><div style="height:20mm;flex:0 0 auto">내용</div></div>',
  }));
  if (!v) return t.skip('넘침 검사가 시간 안에 안 끝났다 — 판정 보류(F296)');
  assert.strictEqual(v.code, 0, `안 잘린 쪽을 넘쳤다고 잡았다(거짓양성):\n${v.out}`);
  assert.match(v.out, /쪽 1개 실측/, '분모를 안 밝히면 0건과 「아무것도 안 봤다」가 같은 모양이다');
});

test('🔑 쪽 상자가 없는 문서는 「못 쟀다」가 아니라 「대상 아님」이다 (번역 작업본)', (t) => {
  if (!크롬있나()) return t.skip('크롬 없음 — 넘침 검사를 안 돌렸다(통과 아님)');
  const v = 넘침실행(page());   // overflow:hidden 상자가 하나도 없다
  if (!v) return t.skip('넘침 검사가 시간 안에 안 끝났다 — 판정 보류(F296)');
  assert.strictEqual(v.code, 0, `쪽 상자 없는 문서를 실패로 읽었다:\n${v.out}`);
  assert.match(v.out, /넘침 검사 대상 아님/);
  assert.match(v.out, /요소 \d+개는 떴다/, '빈 문서(로드 실패)와 가르는 근거를 안 내면 둘이 같은 모양이 된다');
});

test('🔑 활자가 앉은 뒤에 잰다 — `load` 시점은 폴백 활자라 같은 파일이 회차마다 갈렸다', (t) => {
  if (!크롬있나()) return t.skip('크롬 없음 — 넘침 검사를 안 돌렸다(통과 아님)');
  // 실측 2026-08-10: 02 안내문 kr 이 잰쪽 2·몸통 157 로 DOM 은 매 회차 같은데 넘침만
  // 0px ↔ 18px(=한 줄) 로 튀었다. 죽은 세션 둘이 정반대 결론을 적은 원인이 이것이다.
  // 그래서 측정기가 **활자 상태를 함께 낸다** — 안 앉았으면 결과를 아예 안 낸다(조용한 초록 금지).
  const { 넘침 } = require(LINT);
  const { findChrome } = require(path.join(ROOT, 'tools', '브랜드렌더린트.js'));
  const f = path.join(dir, `font${n++}.html`);
  fs.writeFileSync(f, 쪽페이지({ 내용: 20 }));
  let r;
  try { r = 넘침(f, findChrome()); } catch (e) { return t.skip(`측정기를 못 돌렸다: ${e.message}`); }
  assert.ok('폰트' in r, '활자 상태를 안 내면 「폴백으로 쟀다」와 「제대로 쟀다」가 같은 모양이 된다');
  assert.strictEqual(r.폰트, 'loaded', `활자가 안 앉은 채 판정이 나왔다(status=${r.폰트})`);
});

test('🔑 아직 안 구운 원본은 「대상 아님」이다 — 폴백 활자로 재면 거짓양성이 나온다', (t) => {
  if (!크롬있나()) return t.skip('크롬 없음 — 넘침 검사를 안 돌렸다(통과 아님)');
  const 활자주입 = require(path.join(ROOT, 'tools', 'lib', '활자주입.js'));
  // 넘치는 픽스처에 **마커만** 얹는다 — 조건 하나만 바뀐다.
  const 넘치는것 = 쪽페이지({ 내용: 90 });
  const v = 넘침실행(넘치는것.replace('<style>', `<style>\n${활자주입.마커}`));
  if (!v) return t.skip('넘침 검사가 시간 안에 안 끝났다 — 판정 보류(F296)');
  assert.strictEqual(v.code, 0, `안 구운 원본을 위반으로 잡았다(거짓양성):\n${v.out}`);
  assert.match(v.out, /활자 미주입 원본/, '무엇을 안 쟀는지 안 밝히면 통과와 같은 모양이다(F207)');
  // 🔑 그리고 마커만 없으면 **같은 픽스처를 다시 잡아야 한다** — 안 그러면 이 갈래가
  //    「넘침 검사를 끄는 스위치」가 된다(면제가 넓어지는 방향으로만 샌다).
  const w = 넘침실행(넘치는것);
  if (!w) return t.skip('대조 회차가 시간 안에 안 끝났다 — 판정 보류(F296)');
  assert.strictEqual(w.code, 1, `마커만 뗐는데도 넘침을 놓쳤다 — 면제가 검사를 통째로 껐다:\n${w.out}`);
});

test('🔑 활자 판정 두 갈래는 합치면 안 된다 — 합치는 순간 탐지가 꺼진다', () => {
  const { 주입됐나, 원본인가, 마커 } = require(path.join(ROOT, 'tools', 'lib', '활자주입.js'));
  const 구운것 = '<style>@font-face{font-family:X;src:url(data:font/woff2;base64,AA)}</style>';
  const 원본 = `<style>${마커}</style>`;
  const 반만 = `<style>${마커}@font-face{font-family:X;src:url(data:font/woff2;base64,AA)}</style>`;
  const 활자없음 = '<style>body{font-family:system-ui}</style>';   // 회귀 픽스처가 이 모양이다

  assert.strictEqual(주입됐나(구운것), true);
  assert.strictEqual(주입됐나(반만), false, '마커가 남았으면 치환이 반만 된 것이다');
  assert.strictEqual(주입됐나(활자없음), false);

  assert.strictEqual(원본인가(원본), true);
  assert.strictEqual(원본인가(구운것), false);
  // 급소: `주입됐나` 의 부정을 측정 게이트로 쓰면 이 줄이 true 가 되고 넘침 탐지가 통째로 꺼진다.
  assert.strictEqual(원본인가(활자없음), false,
    '활자를 아예 안 쓰는 문서는 원본이 아니다 — 여기가 true 가 되면 넘침 검사가 스스로 꺼진다');
});

test('실저장소의 발표물 전량이 넘침 없이 조판된다 (거짓양성 0)', (t) => {
  if (!크롬있나()) return t.skip('크롬 없음 — 넘침 검사를 안 돌렸다(통과 아님)');
  const dirPath = path.join(ROOT, 'docs', '발표물');
  if (!fs.existsSync(dirPath)) return t.skip('docs/발표물 없음');
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.html') && !f.startsWith('_'))
    .map((f) => path.join(dirPath, f));
  if (!files.length) return t.skip('발표물 HTML 0건');
  const r = spawnSync(process.execPath, [LINT, '--넘침', ...files], { encoding: 'utf8', timeout: 300000 });
  if (r.signal) return t.skip('넘침 검사가 시간 안에 안 끝났다 — 판정 보류(F296)');
  assert.strictEqual(r.status, 0, `실산출물이 잘린 채 나가고 있다(${files.length}종 검사):\n${r.stdout}${r.stderr}`);
});

test('🔴 발표물 **산출물만** -diff — 소스(_src_)는 그대로 읽혀야 한다 (F316)', (t) => {
  /* 산출물은 `발표물빌드.js` 가 브랜드 폰트를 base64 로 임베드해 굽기 때문에 `@font-face` 한 줄이
   * 최장 54,293자다. git 이 이것을 텍스트로 펼치면 커밋 한 번에 60만 토큰이 되어 세션이 죽는다
   * (실측 9개 연쇄 · `.gitattributes` 의 `-diff` 로 630,041B → 195B).
   *
   * 이 검사의 무게는 **뒤쪽**에 있다: 패턴을 `docs/발표물/*.html` 로 넓히면 `_src_` 까지 가려져
   * **리뷰의 옳은 자리가 통째로 안 보이게 된다** — 그 실패는 조용하다(diff 가 비면 「변경 없음」처럼 보인다). */
  const dir = path.join(ROOT, 'docs', '발표물');
  if (!fs.existsSync(dir)) return t.skip('docs/발표물 없음');
  const all = fs.readdirSync(dir);
  const 산출 = all.filter((f) => /^[0-9].*\.(html|pdf)$/.test(f));
  const 소스 = all.filter((f) => f.startsWith('_src_') && f.endsWith('.html'));
  // 분모 0 을 통과로 읽지 않는다 — 미실행은 초록과 같은 모양으로 온다.
  if (!산출.length || !소스.length) return t.skip(`분모 0 — 산출 ${산출.length}종 · 소스 ${소스.length}종`);

  const attr = (f) => {
    const r = spawnSync('git', ['check-attr', 'diff', '--', `docs/발표물/${f}`],
      { cwd: ROOT, encoding: 'utf8', timeout: 30000 });
    return r.signal ? null : String(r.stdout || '');
  };
  for (const f of 산출) {
    const a = attr(f);
    if (a === null) return t.skip('check-attr 가 시간 안에 안 끝났다 — 판정 보류(F296)');
    assert.match(a, /diff: unset/, `산출물에 -diff 가 안 걸렸다 — 커밋 한 번이 세션을 죽인다: ${f}`);
  }
  for (const f of 소스) {
    const a = attr(f);
    if (a === null) return t.skip('check-attr 가 시간 안에 안 끝났다 — 판정 보류(F296)');
    assert.doesNotMatch(a, /diff: unset/, `소스까지 -diff 가 걸렸다 — 리뷰할 자리가 사라진다: ${f}`);
  }
  console.log(`  (산출 ${산출.length}종 · 소스 ${소스.length}종 검사)`);
});

test('실저장소의 발표물 전량이 통과한다 (거짓양성 0)', (t) => {
  const dirPath = path.join(ROOT, 'docs', '발표물');
  if (!fs.existsSync(dirPath)) return t.skip('docs/발표물 없음 — 아직 산출물이 없다');
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.html')).map((f) => path.join(dirPath, f));
  if (!files.length) return t.skip('발표물 HTML 0건');
  const r = spawnSync(process.execPath, [LINT, ...files], { encoding: 'utf8', timeout: 30000 });
  assert.strictEqual(r.status, 0, `실산출물이 잠금값을 어겼다:\n${r.stdout}`);
});
