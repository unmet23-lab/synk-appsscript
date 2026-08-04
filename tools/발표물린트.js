#!/usr/bin/env node
// 발표물린트 — 인쇄물 HTML이 정본 잠금값을 지키는지 기계로 검사한다.
//
// 왜 있나: 발표물 10종은 전부 「자립형 HTML 1파일」이라 공통 CSS를 뺄 수 없다.
//   즉 색·서체·인쇄 규격이 파일마다 복사된다 — 복사본은 언젠가 갈라진다.
//   갈라지는 방향은 언제나 조용하다(화면은 멀쩡해 보이고 종이에서만 틀린다).
//   그래서 「사람이 눈으로 확인」 대신 이 린트가 진다.
//
// 사용법:
//   node tools/발표물린트.js docs/발표물/05_커리큘럼_로드맵_A3.html
//   node tools/발표물린트.js docs/발표물/*.html
//
// 종료 코드: 위반이 있으면 1. CI·/deploy 에서 그대로 쓸 수 있다.
'use strict';
const fs = require('fs');

// 정본 = docs/정본/SYNK/SYNK 발표물 제작 프롬프트 v1.txt [공통 블록] ■2
//
// ⚠ 「졌다」·「늦었다」는 **단독 낱말일 때만** 금칙어다. 한글 음절 뒤에 붙으면 전혀 다른 말이 된다
//   — 「즐거워졌다」·「좋아졌다」·「나아졌다」는 정반대 뜻인데 부분일치로 잡으면 다 걸린다
//   (실측: 상담 브로셔의 핀란드 인용문 「학교가 더 즐거워졌다」가 금칙어로 잡혔다).
//   가드가 실작업을 벌주면 사람이 가드를 끈다. 그래서 앞 글자가 한글이면 통과시킨다.
const BANNED = ['패배', '실패', '불운', '하락', '부족', '안 됨'];
const BANNED_STANDALONE = ['졌다', '늦었다'];

// 폐기 표기 — 되살아나면 그 산출물은 폐기다(정본 ■3·■5·■7·■9)
const DEAD = [
  'Define', 'Build', 'Execute',          // 구 사이클 (현행 = Learn→Plan→Experience→Record)
  '다음 필살기',                          // 확정 표기는 「내일의 필살기」
  '감응력', '협응력', '공감능력',           // 구 역량 표현 — 대외물 금지
  'Pretendard', 'Noto Sans KR', 'KoPubWorld', // 구 서체 (현행 = SUIT·Inter Tight·DM Mono)
  '원어민급 지향',                        // TOPIK 6급 전제 표현 — 상한 5급 확정으로 폐기
];

/**
 * 반전면 색. #101528 은 **탈락한 값**이다(디자인 컨셉 정본 v1.2) —
 * 채도 43%라 축소하면 순검정과 구별되지 않아 인스타 썸네일·저가 안드로이드에서 색조가 죽는다.
 * #0B1A2E(구 미드나잇)도 2026-08-04 브랜드 키트 이관(_브랜드킷.md v2.0)으로 탈락 —
 * 반전면 확정값은 키트의 Navy 2 다.
 */
const MIDNIGHT_OK = '#0F1730';
const MIDNIGHT_DEAD = ['#101528', '#08080B', '#0B1A2E'];

function lint(file) {
  const html = fs.readFileSync(file, 'utf8');
  // 인쇄면에 실제로 찍히는 텍스트만 본다 — 주석·CSS 안의 말은 종이에 안 나온다.
  const body = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  // ⚠ CSS 주석도 걷어낸다. 안 걷으면 「#101528 은 탈락값이다」라고 적어 둔 주석 자체를
  //   위반으로 잡는다(실측 — 이 린트가 처음 돈 날 자기 주석에 걸렸다).
  //   가드는 「실제로 렌더에 쓰이는 표기」만 봐야 한다.
  // ⚠ `<style>` 태그 자체를 떼고 본다. 안 떼면 **첫 규칙의 셀렉터에 `<style>` 이 붙어**
  //   `@font-face` 가 `<style>\n@font-face` 로 읽힌다(08-05 픽스처가 잡았다). 지금껏 안 물린 건
  //   첫 규칙이 늘 `.mono`·`@page` 라 우연히 통과했을 뿐이다 — 셀렉터 기준 판정 전부의 이음매다.
  const css = (html.match(/<style[\s\S]*?<\/style>/g) || []).join('\n')
    .replace(/<\/?style[^>]*>/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  const bad = [];
  const info = [];
  const hit = (list) => list.filter((w) => text.includes(w));

  const banned = hit(BANNED).concat(
    BANNED_STANDALONE.filter((w) => new RegExp(`(^|[^가-힣])${w}`).test(text))
  );
  if (banned.length) bad.push(`금칙어 8종: ${banned.join(', ')}`);

  const dead = hit(DEAD);
  if (dead.length) bad.push(`폐기 표기: ${dead.join(', ')}`);

  // 자립형 1파일 — 외부 자원이 하나라도 있으면 유호님 환경에서 깨진다
  const ext = [...body.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith('#'));
  if (ext.length) bad.push(`외부 자원: ${ext.join(', ')}`);
  if (/@import/.test(html) || /url\(\s*['"]?https?:/.test(html)) bad.push('@import 또는 CDN url()');

  // 기간 약속 금지 — 승급은 도달제다(정본 ■7)
  if (/(\d+)\s*(개월|주|년)\s*이?면\s*\d*\s*급/.test(text)) bad.push('기간 약속(「N개월이면 N급」)');

  // 비노출 잠금 — 고객 대면물에서 SYNK STUDIO·Wear·Pantry 는 언급하지 않는다(정본 ■8)
  const hidden = ['STUDIO', 'Wear', 'Pantry'].filter((w) => text.includes(w));
  if (hidden.length) bad.push(`비노출 잠금 위반: ${hidden.join(', ')}`);

  // 소개·안내물에 가격 수치를 넣지 않는다(정본 ■8)
  if (/\d[\d,]*\s*만?₮|\d[\d,]*\s*원(?![가-힣])/.test(text)) bad.push('가격 수치');

  // 🚫 DM Mono 에 한글·키릴 — 글리프가 없어 인쇄하는 순간 깨진다(정본 ■9 금칙①)
  const monoBad = [...body.matchAll(/class="[^"]*\bmono\b[^"]*"[^>]*>([^<]*)</g)]
    .map((m) => m[1]).filter((t) => /[ㄱ-힣Ѐ-ӿ]/.test(t));
  if (monoBad.length) bad.push(`DM Mono 에 한글·키릴: ${monoBad.join(' | ')}`);

  // 🔑 DM Mono 는 .mono 클래스 통로로만 입힌다 — CSS 가 다른 셀렉터로 입히면 위의 내용
  //   검사(class="mono" 기준)가 그 자리를 영영 못 본다. 실측: 01 덱 리허설표가
  //   `.reh td.c{font-family:'DM Mono'…}` 로 한글 셀을 mono 에 태웠는데 린트는 초록이었다.
  //   라우팅은 검사보다 넓어야 한다 — 통로를 하나로 강제해야 내용 검사가 완전해진다.
  //   예외: ::before/::after 는 마크업 클래스를 못 다는 대신 content 가 CSS 안에 있으니 그걸 직접 검사한다.
  const monoRoute = [];
  for (const chunk of css.split('}')) {
    const parts = chunk.split('{');
    if (parts.length < 2) continue;
    const decls = parts.pop();
    const sel = (parts.pop() || '').trim();
    if (!/DM Mono/i.test(decls)) continue;
    // ⚠ @font-face 는 폰트를 **정의**할 뿐 어떤 요소에도 **입히지 않는다.** 이 검사의 표적은
    //   「입히는 자리」라 선언 블록을 잡으면 거짓양성이다(08-05 임베드 이관에서 6종 전부 빨개졌다).
    //   같은 함정을 인쇄물_키트검사가 먼저 밟았다 — 「선언을 읽고 사용을 안 읽었다」.
    //   ⚠ @media 는 제외 대상이 아니다: 위 파싱이 중첩 안쪽 셀렉터를 뽑으므로 그대로 검사된다.
    if (/^@font-face\b/i.test(sel)) continue;
    const content = decls.match(/content\s*:\s*['"]([^'"]*)['"]/);
    if (content) {
      if (/[ㄱ-힣Ѐ-ӿ]/.test(content[1])) monoRoute.push(`${sel} (content "${content[1]}" 에 한글·키릴)`);
      continue;
    }
    const badSel = sel.split(',').map((s) => s.trim()).filter((s) => s && !/\.mono\b/.test(s));
    if (badSel.length) monoRoute.push(badSel.join(', '));
  }
  if (monoRoute.length) bad.push(`DM Mono 를 .mono 통로 밖에서 입힌다(내용 검사가 못 보는 자리): ${monoRoute.join(' · ')}`);

  // 세 번째 모노 통로 — 시맨틱 태그(code·kbd·tt)는 브라우저 기본 모노스페이스라
  //   한글이 들어가면 굴림체로 폴백한다(01 덱의 <code>08_설명회_…</code> 실측 — PDF 폰트
  //   덤프에서 GulimChe 가 한글 잉크를 그리고 있었다). 라틴 파일명·코드는 무방하다.
  const semMono = [...body.matchAll(/<(code|kbd|tt)\b[^>]*>([^<]*)</g)]
    .map((m) => m[2]).filter((t) => /[ㄱ-힣Ѐ-ӿ]/.test(t));
  if (semMono.length) bad.push(`시맨틱 모노 태그(code·kbd·tt)에 한글·키릴 — 굴림 폴백: ${semMono.join(' | ')}`);

  // 이모지를 그대로 인쇄하지 않는다(정본 ■9) — 단색 라인 아이콘으로 치환한다.
  //
  // ⚠ 범위로 잡으면 안 된다. 처음 코드포인트 구간(2600–27BF)으로 검사했더니
  //   ☐(체크박스)·→(화살표)·▷ 같은 **활자**까지 잡아 멀쩡한 산출물 3개가 빨개졌다.
  //   가드가 실작업을 벌주면 사람이 가드를 끈다. 유니코드 속성으로 「그림문자」만 고른다.
  //   Extended_Pictographic = 그림으로 렌더되는 문자(📷 ✂ ⛔). ☐ → ▷ · 는 여기 안 든다.
  const emoji = [...new Set(body.match(/\p{Extended_Pictographic}/gu) || [])];
  if (emoji.length) bad.push(`인쇄면에 이모지: ${emoji.join(' ')} (단색 라인 아이콘으로 바꿀 것)`);

  // 구 서체가 CSS 스택에 남아 있는지도 본다(본문 텍스트엔 안 보이지만 렌더는 바뀐다)
  const deadFont = ['Pretendard', 'Noto Sans KR', 'KoPubWorld'].filter((f) => css.includes(f));
  if (deadFont.length) bad.push(`CSS 스택에 구 서체: ${deadFont.join(', ')}`);

  // 반전면 색 — 탈락값이 되살아나면 막는다
  const revived = MIDNIGHT_DEAD.filter((c) => new RegExp(c, 'i').test(css));
  if (revived.length) bad.push(`반전면에 탈락한 색 ${revived.join(', ')} (확정값은 ${MIDNIGHT_OK})`);

  // 인쇄 규격
  const size = (css.match(/@page\s*\{[^}]*size:\s*([^;]+);/) || [])[1];
  if (!size) bad.push('@page 용지 선언 없음');
  if (!/@page\s*\{[^}]*margin:\s*0/.test(css)) bad.push('@page 여백 0 잠금 없음(크롬이 머리글을 찍는다)');
  if (!/print-color-adjust:\s*exact/.test(css)) bad.push('print-color-adjust: exact 없음(배경이 인쇄에서 날아간다)');

  info.push(`용지 ${size ? size.trim() : '?'}`);
  info.push(`「____」 빈칸 ${(text.match(/_{4,}/g) || []).length}개`);
  // 교재를 언급한 산출물만 진행 상태를 함께 적어야 한다(정본 ■7)
  if (/시냅스 코어|코어 \d권|교재/.test(text) && !text.includes('검수를 앞두고')) {
    bad.push('교재를 언급하면서 진행 상태(원어민 검수를 앞두고 있음)를 안 밝혔다');
  }
  return { bad, info };
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('사용법: node tools/발표물린트.js <html...>');
  process.exit(2);
}
let fail = 0;
for (const f of files) {
  const { bad, info } = lint(f);
  if (bad.length) {
    fail++;
    console.log(`🔴 ${f}  (${info.join(' · ')})`);
    bad.forEach((b) => console.log(`   - ${b}`));
  } else {
    console.log(`✅ ${f}  (${info.join(' · ')})`);
  }
}
process.exit(fail ? 1 : 0);
