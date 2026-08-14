/* 상태 컷 파생 굽기 — 상태 세트를 «형제»가 아니라 «기준 컷의 자식»으로 굽는다 (2026-08-14).
 *
 * 왜 있나(실측 08-14 · `docs/녹음오브_상태검수_0814.html`):
 *   녹음 오브 3상태를 각각 따로 호출해서 구웠더니 세 벌이 서로 다른 물건이 됐다 —
 *   크기 -14~-23% · 색상 ΔH 16 · 구체가 평면 렌즈·그릇으로. 명세에 「the same orb」라고
 *   적어도 **호출이 갈리면 모델이 재질을 매번 다시 해석한다.** 문장으로는 못 막는다.
 *   그래서 기준 컷을 **참조 이미지로 넣고** 「이것에서 X «만» 바꿔라」로 파생시킨다 —
 *   `재질굽기.js` 의 런타임참조가 마스코트 표정 2컷을 그렇게 만들었고 그건 안 어긋났다.
 *
 * 검수는 이 파일이 하지 않는다 — 구운 뒤 `tools/상태컷정합.py` 가 숫자로 문다(굽기와 재기를 나눈다:
 * 굽는 쪽이 스스로 합격을 선언하면 그 초록은 아무것도 증명하지 못한다).
 *
 * ⚠ 산출물은 정본 이름을 덮지 않는다(`_파생` 꼬리) — 검수를 통과한 뒤에 사람이 바꿔 넣는다.
 * ⚠ 돈이 든다(1컷 ≈ 190원). 유호님 승인 없이 돌리지 않는다.
 *
 * 사용법:
 *   node tools/상태굽기.js               # 세트 전부
 *   node tools/상태굽기.js 녹음중         # 한 상태만
 */
'use strict';
const fs = require('fs');
const path = require('path');

const 키경로 = process.env.GEMINI_KEY_PATH || 'C:/Users/q1212/SYNK_보안/제미나이.txt';
const REPO = path.resolve(__dirname, '..');
const 폴더 = path.join(REPO, 'docs/캐릭터/명품판_0814');
const 모델 = 'nano-banana-pro-preview';

/* 기준 = 유일하게 정합 판정을 통과한 컷(구체·836×845·코어 rgb198,36,40).
 * 기준이 바뀌면 세트 전체를 다시 파생시킨다 — 세트의 «같음»은 기준 하나에서만 나온다. */
const 기준컷 = path.join(폴더, '녹음오브_대기.png');

/* 「나머지는 그대로」를 매번 같은 문장으로 못박는다 — 이 문장이 흔들리면 파생이 형제로 돌아간다. */
const 불변 = `Everything else must be identical to the reference image: the same size in frame, the
same centered position, the same silhouette, the same cherry-red translucent jelly glass material,
the same color, the same studio lighting from upper left, the same plain light gray background
(#E6E4E2), no ground shadow. No face, no eyes, no mouth, no text, no letters, no logo.`;

const 작업들 = [
  {
    이름: '녹음중',
    /* 명세 §1: 「gently rippling, surface slightly wobbling ... inner glow pulsing brighter」.
     * 형태는 «안» 바뀐다 — 물결은 표면 위에서 일고, 밝아지는 것은 속빛뿐이다. */
    지시: `Take the jelly glass orb in the reference image and change ONLY two things:
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
    지시: `Take the jelly glass orb in the reference image and change ONLY its shape and inner light:
squash it vertically into a soft rounded cushion shape, as if it is gently compressed while thinking,
and let the inner glow swirl slowly inside. It must stay a CLOSED solid orb — do NOT open the top,
do NOT turn it into a bowl, a cup or any vessel with an opening.
Conserve its volume: as it flattens vertically it must bulge wider horizontally, so it still reads as
the same object being squeezed — it must not simply become smaller. ${불변}`,
  },
];

function 키() {
  const raw = fs.readFileSync(키경로, 'utf8');
  const m = raw.match(/AQ\.[A-Za-z0-9_\-.]+/) || raw.match(/AIza[A-Za-z0-9_\-]{20,}/);
  return m ? m[0] : raw.trim().split(/\r?\n/).filter(Boolean).pop();
}

async function 한컷(k, 작업) {
  if (!fs.existsSync(기준컷)) throw new Error(`기준 컷이 없다 — ${기준컷}`);
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
  const 저장 = path.join(폴더, `녹음오브_${작업.이름}_파생.png`);
  fs.writeFileSync(저장, Buffer.from((img.inlineData || img.inline_data).data, 'base64'));
  console.log(`✅ ${작업.이름} — ${초}초 · ${(fs.statSync(저장).size / 1024).toFixed(0)}KB → ${path.relative(REPO, 저장)}`);
  return 저장;
}

(async () => {
  const k = 키();
  const 대상 = process.argv[2] ? 작업들.filter((z) => z.이름 === process.argv[2]) : 작업들;
  if (!대상.length) {
    console.error(`🔴 모르는 상태 '${process.argv[2]}' — 있는 것: ${작업들.map((z) => z.이름).join(', ')}`);
    process.exit(2);
  }
  let 실패 = 0;
  for (const 작업 of 대상) {
    try { await 한컷(k, 작업); } catch (e) { 실패++; console.error(`🔴 ${e.message}`); }
  }
  console.log(`\n합계 = 시도 ${대상.length} = 성공 ${대상.length - 실패} + 실패 ${실패}`);
  console.log('▶ 이제 재본다(굽는 쪽이 스스로 합격을 선언하지 않는다):\n'
    + '  python tools/상태컷정합.py --기준 대기 --변형 처리중 \\\n'
    + '    docs/캐릭터/명품판_0814/녹음오브_대기.png \\\n'
    + '    docs/캐릭터/명품판_0814/녹음오브_녹음중_파생.png \\\n'
    + '    docs/캐릭터/명품판_0814/녹음오브_처리중_파생.png');
  process.exit(실패 ? 1 : 0);
})();
