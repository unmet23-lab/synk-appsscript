/* 파생 굽기 — UI 오브젝트를 «형제»로 따로 굽지 않고 «기준 컷에 물려» 굽는다 (2026-08-14).
 *
 * 왜 있나(실측 08-14 · `docs/녹음오브_상태검수_0814.html`):
 *   녹음 오브 3상태를 각각 따로 호출해서 구웠더니 세 벌이 서로 다른 물건이 됐다 —
 *   크기 -14~-23% · 색상 ΔH 16 · 구체가 평면 렌즈·그릇으로. 명세에 「the same orb」라고
 *   적어도 **호출이 갈리면 모델이 재질을 매번 다시 해석한다.** 문장으로는 못 막는다.
 *   그래서 기준 컷을 **참조 이미지로 넣는다** — `재질굽기.js` 의 런타임참조가 마스코트 표정
 *   2컷을 그렇게 만들었고 그건 안 어긋났다.
 *
 * 물리는 방식이 둘이라 갈래도 둘이다(이름 하나로 뭉치면 검수 기준이 섞인다):
 *   ㉠ 상태 — «같은 물건»의 다른 순간(녹음중·처리중). 「이것에서 X «만» 바꿔라」.
 *      검수 = 크기·중심·색상·실루엣 전부 문다(`상태컷정합.py`).
 *   ㉡ 형제 — 같은 세계의 «다른 물건»(아이콘 4종). 모양은 달라야 하고 **재질·색·조명·배경만**
 *      같아야 한다. 검수 = 색만 문다(`상태컷정합.py --색만`) — 크기·중심을 물면 전부 빨개진다.
 *
 * 검수는 이 파일이 하지 않는다 — 굽는 쪽이 스스로 합격을 선언하면 그 초록은 아무것도 증명하지 못한다.
 *
 * ⚠ 산출물은 정본 이름을 덮지 않는다(`_파생` 꼬리) — 검수를 통과한 뒤에 사람이 바꿔 넣는다.
 * ⚠ 돈이 든다(1컷 ≈ 190원). 유호님 승인 없이 돌리지 않는다
 *   (이 묶음 = 유호 승인 08-14 「2컷 + 아이콘 4종 ~1,120원」).
 *
 * 사용법:
 *   node tools/파생굽기.js               # 전부
 *   node tools/파생굽기.js 녹음중         # 하나만
 *   node tools/파생굽기.js --갈래 아이콘   # 한 갈래만
 */
'use strict';
const fs = require('fs');
const path = require('path');

const 키경로 = process.env.GEMINI_KEY_PATH || 'C:/Users/q1212/SYNK_보안/제미나이.txt';
const REPO = path.resolve(__dirname, '..');
const 폴더 = path.join(REPO, 'docs/캐릭터/명품판_0814');
const 모델 = 'nano-banana-pro-preview';

/* ── 재질 슬롯 ─────────────────────────────────────────────────────────────
 * 유호 확정 08-14: **펠트**. 글래시 블록은 지우지 않는다 — 이미 구운 6컷의 출처이고,
 * 뒤집힐 때 되돌릴 자리이기도 하다(자산이 남아 있는 한 그 레시피도 남는다).
 *
 * 🔑**색 낱말을 여기 적지 않는다.** 색은 «참조 이미지»가 진다 —
 * 이 세션이 실측한 것이 정확히 그것이다: 문장으로 「the same orb」라고 못박아도 호출이 갈리면
 * 색이 갈렸고(ΔH 16), 참조에 물리자 붙었다(ΔH 1.8). 프롬프트의 색 낱말은 참조와 싸울 뿐이다.
 * 그래서 펠트 색이 아직 유호님 손에 있어도(코랄/체리핑크) 이 파일은 안 고친다 —
 * **기준컷만 갈아 끼우면 된다.**
 *
 * ⚠기준이 바뀌면 세트 전체를 다시 파생시킨다 — 세트의 «같음»은 기준 하나에서만 나온다. */
const 재질들 = {
  글래시: {
    // 정합 판정을 통과한 유일한 컷(구체 836×845 · 코어 rgb198,36,40).
    기준컷: path.join(폴더, '녹음오브_대기.png'),
    재질: 'translucent jelly glass, glossy wet surface with soft internal glow and small bright specular highlights',
  },
  펠트: {
    // A/B 대조 때 구운 펠트 오브(재질대조_0814). 색 확정이 나면 그 컷으로 갈아 끼운다.
    기준컷: path.join(REPO, 'docs/캐릭터/재질대조_0814/펠트_녹음오브.png'),
    재질: 'needle-felted wool, soft dense fuzzy fiber texture with delicate cream hand-stitched accents, warm artisanal craft quality',
  },
};

/* 「나머지는 그대로」를 매번 같은 문장으로 못박는다 — 이 문장이 흔들리면 파생이 형제로 돌아간다. */
const 불변 = `Everything else must be identical to the reference image: the same size in frame, the
same centered position, the same silhouette, the same material, the same color, the same studio
lighting from upper left, the same plain light gray background (#E6E4E2), no ground shadow.
No face, no eyes, no mouth, no text, no letters, no logo.`;

/* ㉡ 형제용 — 모양은 달라야 하니 「X 만 바꿔라」를 못 쓴다. 대신 «달라도 되는 것»과
 * «같아야 하는 것»을 갈라 못박는다. 이 문장이 흔들리면 아이콘이 제 세계에서 떨어져 나간다. */
const 세계 = (재질) => `Match the reference image exactly in material and rendering: the same
${재질}, the same color, the same studio lighting from the upper left, the same plain light gray
background (#E6E4E2), floating with no ground shadow, the same premium 3D render quality.
Only the SHAPE of the object is different. Center it and let it fill a similar portion of the frame
as the object in the reference. Keep it simple and rounded, in the friendly style of a 3D app icon.
No face, no eyes, no mouth, no text, no letters, no numbers, no logo.`;

/* 컷 명세는 «재질 독립»이다 — 물건이 무엇이고 무엇만 바뀌는지는 양모든 유리든 같다.
 * 재질 낱말이 명세에 섞이면 슬롯을 갈 때마다 여섯 군데를 고쳐야 하고, 하나를 빠뜨리면
 * 그 컷만 옛 재질로 나온다(그리고 그건 «통과»의 얼굴로 나온다). */
const 작업들 = (재질) => [
  {
    이름: '녹음중',
    /* 명세 §1: 「gently rippling, surface slightly wobbling ... inner glow pulsing brighter」.
     * 형태는 «안» 바뀐다 — 물결은 표면 위에서 일고, 밝아지는 것은 속빛뿐이다. */
    지시: `Take the orb in the reference image and change ONLY two things:
(1) its surface now shows gentle concentric ripples, as if it is reacting to sound waves,
(2) its inner glow pulses noticeably brighter from within the core.
The orb must remain a full round three-dimensional sphere with the same volume and depth —
do NOT flatten it into a disc or a lens. ${불변}`,
  },
  {
    이름: '처리중',
    /* 명세 §1: 「compressed into a soft squashed shape, as if thinking, inner glow swirling」.
     * 여기만 형태가 «명세대로» 바뀐다 — 그래서 검수도 `--변형 처리중` 으로 돌린다.
     * 단 부피는 보존한다: 눌린 만큼 옆으로 퍼져야 «같은 물건»으로 읽힌다(빠지면 그냥 작아진 오브다). */
    지시: `Take the orb in the reference image and change ONLY its shape and inner light:
squash it vertically into a soft rounded cushion shape, as if it is gently compressed while thinking,
and let the inner glow swirl slowly inside. It must stay a CLOSED solid orb — do NOT open the top,
do NOT turn it into a bowl, a cup or any vessel with an opening.
Conserve its volume: as it flattens vertically it must bulge wider horizontally, so it still reads as
the same object being squeezed — it must not simply become smaller. ${불변}`,
  },
  /* ── ㉡ 형제: 3D 미니 아이콘 4종(패키지 §3 · 토스 3D 아이콘 문법) ────────────────────
   * 유호 승인 08-14 로 「전 자산 확장은 픽 후」가 이 묶음에 한해 풀렸고, 글래시로 한 벌 구웠다.
   * 그 뒤 유호 확정 = **펠트** → 이 4종은 `--재질 펠트` 로 다시 굽는다(2배 비용 감수 확정 자리).
   * ⚠단 펠트 색이 아직 유호님 손에 있다(코랄/체리핑크) — 색이 앉기 전에 구우면 또 버린다. */
  { 갈래: '아이콘', 이름: '아이콘_숙제',
    지시: `A small closed notebook with a glowing bookmark ribbon. ${세계(재질)}` },
  { 갈래: '아이콘', 이름: '아이콘_기록',
    지시: `A small bar chart with three rounded rising bars, the tallest one glowing from within. ${세계(재질)}` },
  { 갈래: '아이콘', 이름: '아이콘_재생',
    지시: `A small rounded triangle play button, floating. ${세계(재질)}` },
  { 갈래: '아이콘', 이름: '아이콘_달력',
    지시: `A small calendar tile with one glowing rounded day cell. ${세계(재질)}` },
];

function 키() {
  const raw = fs.readFileSync(키경로, 'utf8');
  const m = raw.match(/AQ\.[A-Za-z0-9_\-.]+/) || raw.match(/AIza[A-Za-z0-9_\-]{20,}/);
  return m ? m[0] : raw.trim().split(/\r?\n/).filter(Boolean).pop();
}

async function 한컷(k, 작업, 슬롯, 재질이름) {
  const 기준컷 = 슬롯.기준컷;
  if (!fs.existsSync(기준컷)) throw new Error(`${재질이름} 기준 컷이 없다 — ${기준컷}`);
  const parts = [
    { text: 작업.지시 },
    { inline_data: { mime_type: 'image/png', data: fs.readFileSync(기준컷).toString('base64') } },
  ];
  const t0 = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${모델}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': k, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { imageSize: '1K', aspectRatio: '1:1' } },
    }),
  });
  const 초 = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) throw new Error(`${작업.이름} 거절 ${res.status} (${초}초) — ${(await res.text()).slice(0, 400)}`);
  const j = await res.json();
  const img = (j?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData || p.inline_data);
  if (!img) throw new Error(`${작업.이름} 이미지 없음 (${초}초) — ${JSON.stringify(j).slice(0, 400)}`);
  // 상태는 오브의 순간이라 오브 이름을 물려받고, 형제는 제 이름으로 선다.
  // 재질 꼬리를 붙여 «재질이 다른 같은 컷»이 서로를 덮지 않게 한다(글래시 한 벌은 되돌릴 자리다).
  const 기본 = 작업.갈래 === '아이콘' ? 작업.이름 : `녹음오브_${작업.이름}`;
  const 꼬리 = 재질이름 === '글래시' ? '파생' : `파생_${재질이름}`;
  const 저장 = path.join(폴더, `${기본}_${꼬리}.png`);
  fs.writeFileSync(저장, Buffer.from((img.inlineData || img.inline_data).data, 'base64'));
  console.log(`✅ ${작업.이름} — ${초}초 · ${(fs.statSync(저장).size / 1024).toFixed(0)}KB → ${path.relative(REPO, 저장)}`);
  return 저장;
}

(async () => {
  /* 재질은 «묻지 않고 고르지 않는다» — 기본값을 두면 픽이 뒤집힌 뒤에도 옛 재질이 조용히 나오고,
   * 그건 통과의 얼굴을 한다. 안 주면 돈 쓰기 전에 멈춘다. */
  const 재질i = process.argv.indexOf('--재질');
  const 재질이름 = 재질i >= 0 ? process.argv[재질i + 1] : null;
  if (!재질들[재질이름]) {
    console.error(`🔴 --재질 을 정해라(유호 확정 08-14 = 펠트) — 있는 것: ${Object.keys(재질들).join(', ')}`
      + `\n   예: node tools/파생굽기.js --재질 펠트`);
    process.exit(2);
  }
  const 슬롯 = 재질들[재질이름];

  const k = 키();
  const 갈래i = process.argv.indexOf('--갈래');
  const 고른갈래 = 갈래i >= 0 ? process.argv[갈래i + 1] : null;
  const 전부 = 작업들(슬롯.재질);
  const 이름인자 = process.argv.slice(2).find((a) => !a.startsWith('--') && a !== 재질이름 && a !== 고른갈래);
  const 대상 = 고른갈래
    ? 전부.filter((z) => (z.갈래 || '상태') === 고른갈래)
    : (이름인자 ? 전부.filter((z) => z.이름 === 이름인자) : 전부);
  if (!대상.length) {
    console.error(`🔴 고른 것에 맞는 컷이 없다(${고른갈래 ? `갈래 '${고른갈래}'` : `이름 '${이름인자}'`}) — `
      + `있는 것: ${전부.map((z) => `${z.이름}(${z.갈래 || '상태'})`).join(', ')}`);
    process.exit(2);
  }
  console.log(`▶ ${재질이름} · ${대상.length}컷을 굽는다 — 1컷 ≈ 190원이라 약 ${대상.length * 190}원.`);
  console.log(`   기준컷 = ${path.relative(REPO, 슬롯.기준컷)} (색은 이 그림이 진다)\n`);
  let 실패 = 0;
  for (const 작업 of 대상) {
    try { await 한컷(k, 작업, 슬롯, 재질이름); } catch (e) { 실패++; console.error(`🔴 ${e.message}`); }
  }
  console.log(`\n합계 = 시도 ${대상.length} = 성공 ${대상.length - 실패} + 실패 ${실패}`);
  console.log('▶ 이제 재본다(굽는 쪽이 스스로 합격을 선언하지 않는다):\n'
    + '  ㉠ 상태 — python tools/상태컷정합.py --기준 대기 --변형 처리중 \\\n'
    + '       docs/캐릭터/명품판_0814/녹음오브_{대기,녹음중_파생,처리중_파생}.png\n'
    + '  ㉡ 형제 — python tools/상태컷정합.py --기준 대기 --색만 \\\n'
    + '       docs/캐릭터/명품판_0814/녹음오브_대기.png docs/캐릭터/명품판_0814/아이콘_*_파생.png');
  process.exit(실패 ? 1 : 0);
})();
