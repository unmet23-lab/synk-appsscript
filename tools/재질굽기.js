/* 재질 대조 6컷 두벌 — 유호 승인 08-14 「재질당 3컷·지출 승인」.
 * 구조 = 재질 슬롯: 같은 컷 명세가 재질 블록만 갈아끼워 두 벌을 탄다(픽 후 전 자산 확장의 뼈대).
 * 신규 4컷만 굽는다 — 글래시 본체·녹음오브는 확정 정본/기존 산출물 재사용(재생성 금지 조항).
 * 순서 의존: 펠트 앱화면은 펠트 본체·오브 산출물을 참조로 받는다 → 직렬.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));

const 키경로 = process.env.GEMINI_KEY_PATH || 'C:/Users/q1212/SYNK_보안/제미나이.txt';
const REPO = 'C:/Users/q1212/Documents/SYNK-appsscript';
const 출력 = path.join(REPO, 'docs/캐릭터/재질대조_0814');
const 모델 = 'nano-banana-pro-preview';

/* ⚠본체 참조는 «정본»이다 — `마스코트_렌더/본체.png`(08-13)는 비율 확정 전 판이라
 * 쓰면 긴 몸통이 나온다(08-14 실사고: 유호님이 「왜 예전 버전이냐」로 잡았다).
 * 정본 = 유호 확정 「③으로 통일」(비율 강 0.925 + 속수리) · `tools/마스코트정본.py` 산출. */
const 참조들 = {
  글래시본체: path.join(REPO, 'docs/캐릭터/마스코트_정본/본체.png'),
  글래시오브: path.join(REPO, 'docs/캐릭터/명품판_0814/녹음오브_대기.png'),
  펠트장면: path.join(REPO, 'docs/캐릭터/명품판_0814/펠트장면.jpg'),
};

/* ── 재질 슬롯 ── */
const 재질 = {
  글래시: `Premium 3D render, translucent cherry-red jelly glass material, glossy wet surface
with soft internal glow, small bright specular highlights`,
  펠트: `Premium handcrafted needle-felted wool material, soft dense coral-red wool with visible
fuzzy fiber texture, delicate cream hand-stitched accents, warm artisanal quality`,
};
const 공통스튜디오 = `studio product photography lighting from upper left, floating object with
no ground shadow, centered on a plain light gray background (#E6E4E2), ultra high resolution,
clean minimal luxury aesthetic. No text, no letters, no logo.`;

/* ── 컷 명세 (재질 독립) ── */
const 앱화면 = (소재문장) => `A premium mobile app screen concept, portrait format, deep navy dark
background with a very subtle warm light from upper left. ${소재문장} Composition: the small mascot
character from the first reference image floats in the upper third of the screen, kept exactly as it
looks in the reference. In the center, the orb from the second reference image floats large,
surrounded by a single thin elegant dial ring with tiny tick marks. Near the bottom, one horizontal
row of exactly three small beads of the same material as the orb, the middle one warmer and brighter
than the others. Generous empty space, quiet luxury, restrained composition.
Strictly no text, no letters, no numbers, no words, no UI labels, no logo.`;

const 작업들 = [
  {
    이름: '펠트_본체',
    비율: '1:1',
    참조: [참조들.글래시본체, 참조들.펠트장면],
    지시: `Recreate the ghost-shaped mascot from the first reference image as a needle-felted wool
figurine, in the craft style of the second reference image: keep the exact same silhouette (rounded
dome head, wavy flowing bottom edge), same proportions, same camera angle and same centered
composition as the first reference. ${재질.펠트}, with two small round glossy black bead eyes
exactly where the reference has them. No mouth, no other facial features. ${공통스튜디오}`,
  },
  {
    이름: '펠트_녹음오브',
    비율: '1:1',
    참조: [참조들.글래시오브, 참조들.펠트장면],
    지시: `Recreate the orb from the first reference image as a needle-felted wool ball in the craft
style of the second reference image: same size in frame, same camera angle, same centered
composition. ${재질.펠트}, a single ring of delicate cream hand-stitching around the ball, one soft
warm highlight from upper left. No face, no eyes, no mouth. ${공통스튜디오}`,
  },
  /* 표정 2컷 — 모션 데모용(깜빡임·눈웃음). 「입은 아낀다」 확정이라 웃음은 «눈»으로만 낸다.
   * 실루엣·색·조명이 기본 컷과 1픽셀이라도 어긋나면 교대할 때 튀므로 참조를 기본 컷 하나로 묶는다. */
  {
    이름: '펠트_눈감음',
    비율: '1:1',
    참조: [],
    런타임참조: ['펠트_본체'],
    지시: `Take the felted mascot in the reference image and change ONLY the eyes: replace the two
round black bead eyes with closed eyes — two short, gentle downward-curved stitched lines in dark
thread, as if peacefully blinking. Everything else must be pixel-identical to the reference: same
silhouette, same wool texture, same color, same lighting, same size, same position, same background.
No mouth, no other change. ${공통스튜디오}`,
  },
  {
    이름: '펠트_눈웃음',
    비율: '1:1',
    참조: [],
    런타임참조: ['펠트_본체'],
    지시: `Take the felted mascot in the reference image and change ONLY the eyes: replace the two
round black bead eyes with happy smiling eyes — two upward-curved arcs (^ ^) in dark stitched
thread, the classic warm eye-smile. Everything else must be pixel-identical to the reference: same
silhouette, same wool texture, same color, same lighting, same size, same position, same background.
Absolutely no mouth. ${공통스튜디오}`,
  },
  /* 색 시안 3컷 — 유호 지시 08-14 「마스코트 색상을 다시 정해보자」(재질=펠트 확정 후).
   * 본체를 참조로 «색만» 갈아입힌다 — 실루엣·질감·조명이 같아야 색만 대조된다. */
  {
    이름: '펠트_색_체리핑크',
    비율: '1:1',
    참조: [],
    런타임참조: ['펠트_본체'],
    지시: `Take the felted mascot in the reference image and change ONLY the wool color: recolor the
wool to a soft cherry pink (#FB7A87), a milky sweet pink like cherry blossom candy. Keep everything
else pixel-identical to the reference: same silhouette, same fuzzy wool fiber texture, same two round
glossy black bead eyes, same cream hand-stitched accents, same lighting, same size, same position,
same plain light gray background. No mouth. ${공통스튜디오}`,
  },
  {
    이름: '펠트_색_딥체리',
    비율: '1:1',
    참조: [],
    런타임참조: ['펠트_본체'],
    지시: `Take the felted mascot in the reference image and change ONLY the wool color: recolor the
wool to a rich deep cherry red (#C2273D), like ripe dark cherries, saturated and warm. Keep everything
else pixel-identical to the reference: same silhouette, same fuzzy wool fiber texture, same two round
glossy black bead eyes, same cream hand-stitched accents, same lighting, same size, same position,
same plain light gray background. No mouth. ${공통스튜디오}`,
  },
  {
    이름: '펠트_색_크림',
    비율: '1:1',
    참조: [],
    런타임참조: ['펠트_본체'],
    지시: `Take the felted mascot in the reference image and change ONLY the wool color: recolor the
wool to a natural undyed cream oatmeal, like raw sheep wool, and change the hand-stitched accents to
warm coral-red thread for contrast. Keep everything else pixel-identical to the reference: same
silhouette, same fuzzy wool fiber texture, same two round glossy black bead eyes, same lighting, same
size, same position, same plain light gray background. No mouth. ${공통스튜디오}`,
  },
  /* ── 모션 1단계 컷 6 — 유호 확정 08-14 「코랄·체리핑크 둘 다 · 1단계 2단계」 ──
   * ¾ 측면 2장(부자연 원인 ① 회전감)은 코랄 본체에서 굽고, 체리핑크는 그 산출물을
   * «색만» 갈아입힌다(색 시안과 같은 통로) — 독립 생성이면 색마다 포즈가 갈린다.
   * 방향은 «보는 사람 기준»으로 못박는다 — 모델이 캐릭터 기준 좌우를 뒤집은 실측이 있다. */
  {
    이름: '펠트_좌34',
    비율: '1:1',
    참조: [],
    런타임참조: ['펠트_본체'],
    지시: `Rotate the felted mascot from the reference image into a three-quarter view: the character
is turned about 35 degrees so it now faces toward the VIEWER'S LEFT. Both round glossy black bead
eyes remain visible, the far eye slightly foreshortened near the edge of the face. Keep everything
else identical to the reference: same needle-felted wool material and exact same wool color, same
cream hand-stitched accents, same lighting from upper left, same total height in frame, same centered
composition, same plain light gray background. This is the same character, same proportions —
rounded dome head, wavy flowing bottom edge. No mouth. ${공통스튜디오}`,
  },
  {
    이름: '펠트_우34',
    비율: '1:1',
    참조: [],
    런타임참조: ['펠트_본체'],
    지시: `Rotate the felted mascot from the reference image into a three-quarter view: the character
is turned about 35 degrees so it now faces toward the VIEWER'S RIGHT. Both round glossy black bead
eyes remain visible, the far eye slightly foreshortened near the edge of the face. Keep everything
else identical to the reference: same needle-felted wool material and exact same wool color, same
cream hand-stitched accents, same lighting from upper left, same total height in frame, same centered
composition, same plain light gray background. This is the same character, same proportions —
rounded dome head, wavy flowing bottom edge. No mouth. ${공통스튜디오}`,
  },
  {
    이름: '펠트체리_눈감음',
    비율: '1:1',
    참조: [],
    런타임참조: ['펠트_눈감음'],
    지시: `Take the felted mascot in the reference image and change ONLY the wool color: recolor the
wool to a soft cherry pink (#FB7A87), a milky sweet pink like cherry blossom candy. Keep everything
else pixel-identical to the reference: same silhouette, same fuzzy wool fiber texture, same closed
eyes (two short gentle downward-curved stitched lines), same cream hand-stitched accents, same
lighting, same size, same position, same plain light gray background. No mouth. ${공통스튜디오}`,
  },
  {
    이름: '펠트체리_눈웃음',
    비율: '1:1',
    참조: [],
    런타임참조: ['펠트_눈웃음'],
    지시: `Take the felted mascot in the reference image and change ONLY the wool color: recolor the
wool to a soft cherry pink (#FB7A87), a milky sweet pink like cherry blossom candy. Keep everything
else pixel-identical to the reference: same silhouette, same fuzzy wool fiber texture, same happy
smiling eyes (two upward-curved arcs in dark stitched thread), same cream hand-stitched accents, same
lighting, same size, same position, same plain light gray background. No mouth. ${공통스튜디오}`,
  },
  {
    이름: '펠트체리_좌34',
    비율: '1:1',
    참조: [],
    런타임참조: ['펠트_좌34'],
    지시: `Take the felted mascot in the reference image and change ONLY the wool color: recolor the
wool to a soft cherry pink (#FB7A87), a milky sweet pink like cherry blossom candy. Keep everything
else pixel-identical to the reference: same three-quarter turned pose, same silhouette, same fuzzy
wool fiber texture, same two round glossy black bead eyes, same cream hand-stitched accents, same
lighting, same size, same position, same plain light gray background. No mouth. ${공통스튜디오}`,
  },
  {
    이름: '펠트체리_우34',
    비율: '1:1',
    참조: [],
    런타임참조: ['펠트_우34'],
    지시: `Take the felted mascot in the reference image and change ONLY the wool color: recolor the
wool to a soft cherry pink (#FB7A87), a milky sweet pink like cherry blossom candy. Keep everything
else pixel-identical to the reference: same three-quarter turned pose, same silhouette, same fuzzy
wool fiber texture, same two round glossy black bead eyes, same cream hand-stitched accents, same
lighting, same size, same position, same plain light gray background. No mouth. ${공통스튜디오}`,
  },
  {
    이름: '글래시_앱화면',
    비율: '9:16',
    참조: [참조들.글래시본체, 참조들.글래시오브],
    지시: 앱화면(`All objects are made of ${재질.글래시}.`),
  },
  {
    이름: '펠트_앱화면',
    비율: '9:16',
    참조: [], // 앞 두 컷 산출물을 런타임에 넣는다
    지시: 앱화면(`All objects are made of ${재질.펠트}.`),
    런타임참조: ['펠트_본체', '펠트_녹음오브'],
  },
];

function 키() {
  const raw = fs.readFileSync(키경로, 'utf8');
  const m = raw.match(/AQ\.[A-Za-z0-9_\-.]+/) || raw.match(/AIza[A-Za-z0-9_\-]{20,}/);
  return m ? m[0] : raw.trim().split(/\r?\n/).filter(Boolean).pop();
}
const mime = (p) => (p.toLowerCase().endsWith('.jpg') || p.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 'image/png');

async function 한컷(k, 작업, 결과경로들) {
  // 런타임참조는 같은 실행의 산출물이 1순위, 없으면 디스크에 이미 구워둔 것(단독 재실행 통로).
  const 앞선것 = (n) => 결과경로들[n] || path.join(출력, `${n}.png`);
  const refs = [...작업.참조, ...(작업.런타임참조 || []).map(앞선것)];
  for (const r of refs) if (!fs.existsSync(r)) throw new Error(`${작업.이름} 참조 없음 — ${r}`);
  const parts = [{ text: 작업.지시 }];
  for (const r of refs) parts.push({ inline_data: { mime_type: mime(r), data: fs.readFileSync(r).toString('base64') } });
  const t0 = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${모델}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': k, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { imageSize: '1K', aspectRatio: 작업.비율 } },
    }),
  });
  const 초 = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) throw new Error(`${작업.이름} 거절 ${res.status} (${초}초) — ${(await res.text()).slice(0, 400)}`);
  const j = await res.json();
  const img = (j?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData || p.inline_data);
  if (!img) throw new Error(`${작업.이름} 이미지 없음 (${초}초) — ${JSON.stringify(j).slice(0, 400)}`);
  const 저장 = path.join(출력, `${작업.이름}.png`);
  fs.writeFileSync(저장, Buffer.from((img.inlineData || img.inline_data).data, 'base64'));
  const tok = j?.usageMetadata?.totalTokenCount ?? '?';
  console.log(`✅ ${작업.이름} — ${초}초 · ${(fs.statSync(저장).size / 1024).toFixed(0)}KB · 토큰 ${tok}`);
  return 저장;
}

(async () => {
  /* 🔑 위치 인자(작업 이름)만 받는다 — 그래도 모르는 `--` 낱말은 막는다.
   * 🔴 **굽기(=돈이 드는 호출) 앞**에 판정한다. */
  const 아는플래그 = [];
  const 플래그오류 = 인자게이트('재질굽기', process.argv.slice(2), 아는플래그);
  if (플래그오류) { console.error(`\n🔴 ${플래그오류}\n`); process.exit(1); }
  fs.mkdirSync(출력, { recursive: true });
  const k = 키();
  const 결과경로들 = {};
  const 대상 = process.argv[2] ? 작업들.filter((z) => z.이름 === process.argv[2]) : 작업들;
  let 실패 = 0;
  for (const 작업 of 대상) {
    try {
      결과경로들[작업.이름] = await 한컷(k, 작업, 결과경로들);
    } catch (e) {
      실패++;
      console.error(`🔴 ${e.message}`);
      if ((작업.런타임참조 || []).some((n) => !결과경로들[n])) {
        console.error('   ↳ 선행 컷이 없어 이 컷은 건너뜀 — 선행부터 다시.');
      }
    }
  }
  console.log(`\n합계 = 시도 ${대상.length} = 성공 ${대상.length - 실패} + 실패 ${실패}`);
  process.exit(실패 ? 1 : 0);
})();
