#!/usr/bin/env node
/* 까몽 «용 되기» 굽기 — 「용인데 고양이 같다」를 고치는 후보를 굽는다. (유호 지시 2026-09-05)
 *
 *   「지금 용처럼 만들고싶은데 고양이같다고하더라고 우리 까몽이가 ㅠㅠ
 *    투슬리스느낌으로 몇장 만들어봐줄래?」
 *
 * ■ 🔴 왜 이 파일이 «생명 금지» 규율에 안 걸리나
 *   [[loom-baked-assets-only-for-ui]] 와 `라디오무대굽기.js` 가 막는 것은
 *   **정본이 이미 있는 것을 AI 가 말없이 다시 그려 옛 정본을 밀어내는 일**이다.
 *   여기 것은 유호님이 «업그레이드»로 직접 부르신 후보이고, 낼 곳도 정본 폴더가 아닌
 *   `까몽_용후보/` 다 — `lib/마스코트자산.js` 가 가리키는 정본은 한 글자도 안 건드린다.
 *   마린굽기와 같은 통로다: 유호님이 하나를 고르시면 그때 정본이 서고, 그 뒤로는 안 그린다.
 *
 * ■ 진단 — 지금 까몽이(친구공방_0825/까몽_본체.png)에서 «고양이»를 만드는 것 넷
 *   ① **뾰족한 삼각 귀 두 개** — 이것 하나가 제일 크다. 고양이 귀 그 자체다.
 *   ② **길고 복슬한 털** — 윤곽이 솜뭉치라 파충류 결이 0이다.
 *   ③ **주둥이가 없다** — 평평한 얼굴에 눈만 있다(용은 코앞이 앞으로 나온다).
 *   ④ **날개·뿔·등지느러미 0** — 용 표지가 꼬리 끝 산호색 지느러미 «하나»뿐이다.
 *   ⇒ 아래 여덟 판은 이 넷을 «하나씩 늘려 가며» 뒤집는다. 그래야 유호님이
 *     「어디까지 바꿔야 용으로 읽히나」를 한 축으로 보고 고르실 수 있다.
 *     1·2번은 최소 변화(형제 결 유지), 5~8번은 풀세트다.
 *
 * ■ 🔴 참조 사진의 두 얼굴 — 이 도구의 핵심 함정
 *   까몽 본체 사진을 참조로 넣는 까닭은 «같은 아이»여야 하기 때문이다(색·눈·꼬리 지느러미).
 *   그런데 그 사진이 바로 «고양이 형태»의 출처다 — 그냥 넣으면 모델이 그 실루엣을 따라 그린다.
 *   ⇒ 지시문에 **가져올 것과 버릴 것을 갈라 적는다**(아래 `참조지시`). 갈라 적지 않으면
 *     참조가 지시를 이긴다 — 마린 정면판에서 「앞의 말이 이긴다」로 이미 실측한 무늬다.
 *
 * ■ 조립 순서 = 카메라 맨 앞 (마린 09-05 실측을 그대로 물려받는다)
 *   재질을 앞에 두면 그 장면이 먼저 서고 뒤의 각도 지시가 그 위에 얹힌다(「왜 정면을 안 보지?」).
 *
 * ⚠ 돈 — 4K 한 장 $0.24 ≈ 336원. 여덟이면 ≈ 2,690원(구글 무료 크레딧에서 나간다).
 *   4K 인 까닭 = 유호 확정 09-05 「제미나이로 굽는 것은 전부 4K · 2K 를 고르지 않는다」.
 *
 * 쓰기:
 *   node tools/까몽용굽기.js            여덟 판 전부
 *   node tools/까몽용굽기.js --판 3     하나만
 *   node tools/까몽용굽기.js --다시     이미 있어도 다시
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { 키, 한컷, 배치게이트 } = require('./lib/이미지굽기');

const ROOT = path.resolve(__dirname, '..');
const 패치 = path.join(ROOT, 'docs/캐릭터/펠트패치_0815');
/* 🔴 09-05 저녁 — 옛 세트(친구공방_0825)를 지우면서 현행 정본으로 옮겼다.
 *   경로를 여기 손으로 적지 않고 주인(`lib/마스코트자산.js`)에게 묻는다. */
const 까몽사진 = path.join(ROOT, require('./lib/마스코트자산.js').까몽경로('본체', { 누끼: true }));
const 낼곳 = path.join(ROOT, 'docs/캐릭터/까몽_용후보');

/* ── ① 카메라 — 맨 앞에 선다 ───────────────────────────────────────────── */
const 카메라 = `CAMERA AND POSE — THIS IS THE MOST IMPORTANT INSTRUCTION:
A dead-on, perfectly frontal portrait of one small handmade creature. The camera sits exactly
at the creature's own height, exactly on its centre line. It faces the lens straight on. The
picture is bilaterally symmetrical: mirror the left half onto the right and it matches. Both
eyes are the SAME size, at the SAME height, equally far from the centre. We see the FRONT of
the body only — no side of the body, no cheek, no shoulder turned towards us.
Photographed with a 50mm macro lens against a plain seamless backdrop of soft pale-cream felt,
shallow depth of field, soft studio light from the upper left, gentle rim light along the
edges of the body. Full body visible, centred, with generous empty space around it.
Square framing.`;

/* ── ② 재질 — 펠트가 브랜드다. 용이 되어도 여기서 벗어나지 않는다 ────────── */
const 재질 = `A handmade needle-felted wool creature — a real miniature doll photographed on a
table, not a drawing and not a 3D render. Made entirely of textile: felted merino wool,
wet-felted sheets with visible scissor-cut edges, embroidery floss, running stitch, french
knots. Soft handmade irregularity everywhere. Nothing is plastic, glass, metal or digital.
Award-winning fibre art, museum-quality craft photography.`;

/* ── ③ 누구인가 — 여덟 판이 공유하는 까몽의 정체성 ─────────────────────────
 *   🔑 정본(`docs/캐릭터/가이드_정본.md` §2)에서 온 것만 적는다:
 *     · 정체 = **용**(유호 확정 08-28 「그래도 용인데」 · 귀여워도 몸에 묵직함이 있다)
 *     · 이름 = 까몽(까맣다 + 몽글의 몽) ⇒ 숯빛 검정이 몸 색이다
 *     · 성격 = 허세쟁이 겁쟁이 · 셋 중 제일 크다 · 기쁘면 꼬리가 먼저 흔들린다
 *     · 눈 = 크고 둥근 초록 (지금 판의 유일한 «잘 서 있는» 자리 — 그대로 가져간다) */
const 정체 = `WHO THIS IS: a small round charcoal-black felt DRAGON, chest-high to a teacup,
soft and huggable. Its eyes are large, round and bright leaf-green, each with a wide dark
pupil and one tiny white highlight — warm, expressive, slightly proud. Short stubby arms held
close to the body. A slim tail curls out to one side, and the very TIP of that tail is a
coral-pink fin — a flat rounded fan of coral felt sewn directly onto the end of the tail,
with fine cream stitched ribs across it, clearly part of the creature's own body and touching
it. Rounded belly, plump and stable, sitting or standing
upright. It is boastful and secretly timid — a small dragon who is very sure it is magnificent.
Cute first, dragon second, but unmistakably a DRAGON.`;

/* ── ④ 참조 사진을 어떻게 쓰나 — 가져올 것과 버릴 것을 «갈라» 적는다 ────────
 *   🔴 이 덩이가 없으면 참조가 지시를 이긴다(머리말 ■참조 사진의 두 얼굴). */
const 참조지시 = `USING THE REFERENCE PHOTOS: the first photo shows the SAME character in its
old design. Take from it ONLY these: the charcoal-black wool colour, the green eye colour and
eye shape, the coral-pink fin at the tail tip, the soft cream backdrop, the lighting. The
other photos are felt swatches — take colour and fibre texture from those.
DO NOT copy the old head shape, DO NOT copy the pointed triangular ears, DO NOT copy the long
shaggy fur, DO NOT copy the flat faceless muzzle. Those are exactly what is being redesigned.
Follow the written instructions below for the shape, not the reference photo.`;

/* ── ⑤ 금지 — «고양이 아님»을 여기서 못 박는다 ─────────────────────────────
 *   금지 덩어리가 실제로 먹는다는 것은 마린 60장 전량에서 확인됐다(얼굴·무기 0건). */
const 금지 = `WHAT THIS MUST NOT BE — READ THIS TWICE:
NOT A CAT. This must not read as a cat, a kitten, a black cat or any feline.
NO pointed triangular cat ears standing up on top of the head. NO whiskers. NO cat muzzle,
NO cat nose, NO fluffy cat cheeks, NO long shaggy fur that makes a round fur ball silhouette.
Not a bear, not an owl, not a bat, not a plush kitten toy.
Also: no human face, no human skin, no hair, no clothes.
No text, no letters, no numbers, no logo, no watermark.
Nothing scary — no bared fangs, no visible teeth, no claws, no fire, no smoke, no menace,
no glowing red, no dark or gothic mood. This is a friendly children's character.
Do not show a wooden table edge, a floor, a room, a wall or any scenery.
NO separate props lying on the ground — no loose felt leaves, no petals, no scattered objects
next to the creature. The coral fin belongs ON THE TIP OF ITS TAIL, attached to its body.
Nothing at all beside the creature; the background is completely empty.`;

/* ── ⑥ 여덟 판 — ①귀 ②주둥이 ③털 ④날개 를 «하나씩 늘려» 뒤집는다 ─────────── */
const 판들 = [
  {
    이름: '용1_귀날개만',
    참조: ['DeepWool.png', 'Ash.png', 'Meadow.png', 'CoralSoft.png'],
    형태: `MINIMAL CHANGE — change ONLY the ears. Everything else stays as soft and round as
before. Remove the two pointed triangular ears completely. In their place, give it two flat
EARFLAPS of dark felt that lie back along the sides and top of the head like a swimmer's
folded fins — wide at the base, tapering to a soft rounded tip, angled backwards rather than
standing up. Each earflap is a single stiff felt sheet with a slightly darker felt edge and a
line of fine running stitch along it. Behind them, two much smaller flaps sit lower down.
The body keeps its soft felted fuzz. No wings yet, no snout yet — just the head reads
differently now.`,
  },
  {
    이름: '용2_귀날개_주둥이',
    참조: ['DeepWool.png', 'Ash.png', 'Meadow.png', 'CoralSoft.png'],
    형태: `Two changes from the old design. FIRST, the ears: no pointed triangular ears at all;
instead two flat dark EARFLAPS lie back along the head like folded fins, wide at the base and
softly rounded at the tip, each edged with fine running stitch, with two smaller flaps below.
SECOND, the face: the head now has a short blunt SNOUT pushing forward — a rounded muzzle
about as long as it is wide, gently squared off at the front, with two small stitched nostril
dots on the flat front of it. The mouth is one simple closed curved stitch line, calm and
slightly smug, with no teeth showing at all. The big green eyes sit high and wide on either
side of the snout base. The body still keeps its soft fuzz.`,
  },
  {
    이름: '용3_매끈한몸',
    참조: ['DeepWool.png', 'AshWool.png', 'Meadow.png', 'Stone.png'],
    형태: `The fur goes. This dragon's body is now DENSELY FELTED AND SMOOTH — tightly packed
charcoal wool with a fine even nap like moleskin or a well-worn felt hat, so the silhouette is
clean and sleek instead of fluffy. You can still see it is wool: a faint fibre haze catches the
rim light along the edges, and the surface has the subtle unevenness of hand-felting. Head has
flat dark EARFLAPS lying back instead of pointed ears, and a short blunt rounded SNOUT with two
stitched nostril dots and one closed curved mouth stitch. Slim strong neck, rounded chest,
compact haunches — a small sleek creature, not a ball of fluff. Still no wings.`,
  },
  {
    이름: '용4_날개편판',
    참조: ['DeepWool.png', 'Ash.png', 'Meadow.png', 'Stone.png'],
    형태: `Now it has WINGS and it is showing them off. Two large wings of dark charcoal felt
spread open behind and to the sides — each wing is one broad stiff felt sheet with three
slender darker felt ribs stitched across it fanning out from the shoulder, and the outer edge
is gently scalloped between the ribs. Held up and open, they are almost as wide as the body is
tall, and light glows faintly through the thinner felt near the edges. Head has flat EARFLAPS
lying back instead of pointed ears, and a short blunt SNOUT with stitched nostrils. Body is
smooth densely-felted charcoal. The posture is proud, chest out, chin slightly up — a small
dragon absolutely certain it looks magnificent.`,
  },
  {
    이름: '용5_풀세트',
    참조: ['DeepWool.png', 'AshWool.png', 'Meadow.png', 'CoralSoft.png'],
    형태: `THE FULL DRAGON — every dragon feature at once, still soft and cuddly.
Head: a short blunt rounded SNOUT with two stitched nostril dots and one calm closed mouth
stitch; flat dark EARFLAPS lying back along the head like folded fins, two smaller flaps
below them; big round green eyes set high and wide.
Body: smooth densely-felted charcoal wool, sleek silhouette, rounded belly.
Back: a row of small soft felt SPINES runs from between the shoulders down the back and along
the tail — little rounded triangles of slightly darker felt, each stitched on at the base,
getting smaller towards the tail.
Wings: two broad charcoal felt wings folded neatly against the sides, their ribbed edges
visible along the back.
Tail: long and tapering, curling round to one side, ending in the coral-pink leaf-shaped fin
with cream stitched ribs. Standing upright on two short sturdy legs. Proud, warm, huggable.`,
  },
  {
    이름: '용6_허세포즈',
    참조: ['DeepWool.png', 'Ash.png', 'Meadow.png', 'Butter.png'],
    형태: `THE FULL DRAGON, caught mid-boast. Same build: short blunt SNOUT with stitched
nostrils, flat EARFLAPS lying back instead of pointed ears, smooth densely-felted charcoal
body, a row of small felt spines down the back, folded ribbed wings, long tail ending in the
coral-pink fin.
THE POSE IS THE POINT: it stands with its two stubby arms FOLDED across its chest, chin lifted,
eyes half-lidded and looking down its snout at the viewer with enormous self-satisfaction —
the face of someone who has just said "of course I knew that". One eyebrow ridge of stitched
felt sits a little higher than the other. But the tail behind it is caught mid-wag, curled
happily upward, giving away that it is delighted. Still no teeth, nothing fierce — the joke is
that this tiny soft thing thinks it is enormous.`,
  },
  {
    이름: '용7_아기비율',
    참조: ['DeepWool.png', 'AshWool.png', 'Meadow.png', 'CoralSoft.png'],
    형태: `THE FULL DRAGON in baby proportions — maximum cuteness. The head is BIG, nearly half
the whole figure, sitting on a small round body with short stubby limbs. Everything dragon is
still there but scaled down and softened: a very short stubby SNOUT with two tiny stitched
nostrils, plump EARFLAPS lying back along the oversized head, a row of tiny soft felt spines
down the back, small stubby wings folded against the sides that look slightly too little to
fly with, and a short tail with the coral-pink fin. Smooth densely-felted charcoal wool. The
huge green eyes take up much of the face. Sitting down, looking straight up at the camera.
A hatchling that is very proud of being a dragon.`,
  },
  {
    이름: '용8_자수비늘',
    참조: ['DeepWool.png', 'Ash.png', 'Meadow.png', 'Stone.png'],
    형태: `THE FULL DRAGON, showing off the craft. Same build — short blunt SNOUT with stitched
nostrils, flat EARFLAPS lying back, smooth densely-felted charcoal body, small felt spines down
the back, folded ribbed wings, long tail with the coral-pink fin.
THE SURFACE IS THE POINT: across the chest, the shoulders and the top of the tail, rows of
overlapping SCALES are hand-embroidered into the felt — small rounded scallop stitches in
charcoal thread only a shade lighter than the wool, so they catch the light and disappear
again as the form turns. Belly is smooth undecorated pale-charcoal felt with a few horizontal
stitch lines like soft plates. The scales never look hard or reptilian-cold — they read as
loving needlework on a soft toy. Warm, tactile, obviously handmade by someone patient.`,
  },
];

function 참조경로(파일들) {
  const 목록 = [까몽사진];                    // 🔑 첫 장이 «지금 까몽» — 참조지시가 이것을 가리킨다
  for (const f of 파일들) {
    const p = path.join(패치, f);
    if (!fs.existsSync(p)) throw new Error(`참조 없음 — ${p}`);
    목록.push(p);
  }
  return 목록;
}

async function main() {
  const argv = process.argv.slice(2);
  /* 🔴 `--판 0`·`--판 abc`·값 없는 `--판` 을 «옵션 없음»과 같게 보면 후보 여덟이 전부 유료로 나간다
     (0·NaN 이 falsy 라서다). 돈이 나가는 자리라 조용히 넘기지 않고 여기서 멈춘다(09-06 검수). */
  let 하나 = null;
  if (argv.includes('--판')) {
    하나 = Number(argv[argv.indexOf('--판') + 1]);
    if (!Number.isInteger(하나) || 하나 < 1 || 하나 > 판들.length) {
      console.error(`🔴 --판 은 1~${판들.length} 사이 정수라야 한다 (받은 것: ${argv[argv.indexOf('--판') + 1]})`);
      process.exit(1);
    }
  }
  const 대상 = 하나 ? 판들.filter((_, i) => i + 1 === 하나) : 판들;
  if (!대상.length) { console.error(`--판 은 1~${판들.length} 다`); process.exit(1); }
  if (!fs.existsSync(까몽사진)) { console.error(`🔴 까몽 본체 사진이 없다 — ${까몽사진}`); process.exit(1); }

  /* 게이트는 «자리 인자»다(장수, 크기) — 꾸러미로 주면 $NaN 이 찍히고 막힌 적이 없어진다(마린 09-05 사고). */
  if (!(await 배치게이트(대상.length, '4K'))) { process.exitCode = 3; return; }

  fs.mkdirSync(낼곳, { recursive: true });
  const k = 키();
  let 구움 = 0, 건너뜀 = 0, 연속실패 = 0;
  const 다시 = argv.includes('--다시');
  const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

  for (const [i, 판] of 대상.entries()) {
    const 저장경로 = path.join(낼곳, `${판.이름}.png`);
    if (fs.existsSync(저장경로) && !다시) { 건너뜀 += 1; console.log(`⏭  ${판.이름} — 이미 있다(--다시 면 다시 굽는다)`); continue; }
    const 지시 = [카메라, 재질, 정체, 판.형태, 참조지시, 금지].join('\n\n');
    /* 429 는 «분당 몫»이 대부분이다 — 사이를 30초 두고, 막히면 길게 쉬고 두 번만,
     * 세 판이 잇달아 막히면 그만둔다(두드릴수록 벽이 길어진다 · 09-05 실측). */
    if (i > 0) await 잠깐(30_000);
    let 시도 = 0;
    for (;;) {
      try {
        await 한컷({ 이름: 판.이름, 지시, 참조: 참조경로(판.참조), 비율: '1:1', 크기: '4K', 저장경로, k });
        구움 += 1; 연속실패 = 0;
        break;
      } catch (e) {
        /* 🔴 돈 벽을 «먼저» 본다 (09-06 검수). 크레딧이 바닥난 429 도 `/429/` 에 걸려 분당 벽으로
           분류되면, 다시 열릴 리 없는 벽 앞에서 2분·5분을 기다린 뒤에야 멈춘다. 즉시 멈출 자리다. */
        if (e.돈벽) { console.error(`❌ ${판.이름} — 돈 벽 · ${e.message.slice(0, 160)}`); return 마무리(); }
        const 분당벽 = /429|RESOURCE_EXHAUSTED/.test(e.message);
        const 쉼 = [120_000, 300_000, 480_000];
        if (분당벽 && 시도 < 2) { console.log(`   ⏳ ${판.이름} 몫 벽 — ${쉼[시도] / 60_000}분 쉬고 다시(${시도 + 1}/2)`); await 잠깐(쉼[시도]); 시도 += 1; continue; }
        console.error(`❌ ${판.이름} — ${e.message.slice(0, 200)}`);
        연속실패 += 1;
        if (연속실패 >= 3) { console.error(`\n🛑 세 판이 잇달아 막혔다 — 벽이 오래 서 있다. 여기서 멈춘다.`); return 마무리(); }
        break;
      }
    }
  }
  function 마무리() { console.log(`\n[까몽용굽기] 구움 ${구움} · 건너뜀 ${건너뜀} · 든 돈 ≈ ${구움 * 336}원 · ${낼곳}`); }
  마무리();
  console.log('   판정 = 유호님 눈. 고르신 하나가 정본이 되고, 그때 `lib/마스코트자산.js` 가 그쪽을 가리킨다.');
}

if (require.main === module) main().catch((e) => { console.error('실행 오류:', e.message); process.exit(1); });
