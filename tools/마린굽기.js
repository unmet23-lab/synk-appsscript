#!/usr/bin/env node
/* 마린굽기 — 가이드 셋째 «마린»의 생김새 후보를 굽는다. (유호 지시 2026-09-05)
 *
 *   「마린을 gpt로 만들고있는데 아직 좀 맘에 안드는데 스파르타 선생님 우주해병 느낌을
 *    지금 이걸로 만들어봐줄수있어? 5장정도 구워줄래?」
 *
 * ■ 🔴 왜 이 파일은 «생명 금지» 규율에 안 걸리나
 *   `라디오무대굽기.js` 와 [[loom-baked-assets-only-for-ui]] 가 막는 것은
 *   **정본이 이미 있는 것을 AI 가 다시 그리는 일**이다(몽글·까몽 = `lib/마스코트자산.js`).
 *   마린은 아직 정본이 **없다** — 트랙 §0-라디오 가 「마린 오면」으로 기다리는 자리이고,
 *   가이드 정본은 성격·말투만 정했지 생김새를 안 정했다. ⇒ 여기서 굽는 것은 «후보»이고
 *   유호님이 하나를 고르시면 그때 정본이 선다. 정본이 선 뒤로는 이 파일로 다시 그리지 않는다.
 *
 * ■ 정본에서 가져온 것 (`docs/캐릭터/가이드_정본.md` §2)
 *   · 무표정 원칙주의자 · 최정예 해병 · 늘 진지 · **표정 불변**
 *   · **렌즈**가 눈이다 — 칭찬받으면 «아주 잠깐 밝아진다»(본인은 아니라고 한다)
 *   · 소리 결 = 헬멧 안 울림 · 통신 결 ⇒ **헬멧이 있다**
 *   · 속은 다정하다 — 꽃·작은 동물·칭찬에 약하다
 *   · ⚠ 성별로 안 가른다 — 「남자용」으로 보이면 목표형 여학생이 고르기 어색해진다
 *   · 크기: 까몽이 셋 중 제일 크다 ⇒ 마린은 그보다 작다
 *
 * ■ 형제로 보여야 한다 — 몽글이 «둥근 펠트 몸»이므로 마린도 같은 몸에서 출발한다.
 *   갑옷·헬멧을 «입은» 것이지 로봇이 아니다(로봇이 되면 펠트 형제에서 떨어져 나간다).
 *
 * ■ 색은 유호님이 고르실 자리 — 정본에 없다. 그래서 다섯 판이 서로 다른 색·차림이다.
 *
 * ⚠ 돈이 든다 — 1컷 ≈ 190원. 다섯이면 950원(구글 무료 크레딧에서 나간다).
 *
 * 쓰기:
 *   node tools/마린굽기.js              다섯 판 전부
 *   node tools/마린굽기.js --판 2       하나만
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { 키, 한컷, 배치게이트 } = require('./lib/이미지굽기');

const ROOT = path.resolve(__dirname, '..');
const 패치 = path.join(ROOT, 'docs/캐릭터/펠트패치_0815');
const 낼곳 = path.join(ROOT, 'docs/캐릭터/마린_후보');

/* ── 공통 지시 — 무대굽기와 같은 세 덩이(재질·카메라·금지)를 캐릭터용으로 고쳤다 ── */
const 재질 = `A handmade needle-felted wool character, a real miniature doll photographed on a table.
Made entirely of textile: felted merino wool, wet-felted sheets with visible scissor-cut edges,
embroidery floss, running stitch, french knots. Visible fibre fuzz and soft handmade
irregularity. Nothing is plastic, glass, metal or digital — even the armour plates are stiff
felt sheets, even the lens is a smooth felt disc with a stitched rim. Award-winning fibre art.`;

const 몸 = `BODY SHAPE: a small rounded felt character with a soft dome head flowing into a
rounded body with a gently scalloped bottom hem — the same family silhouette as a little felt
ghost. It is a soft doll wearing gear, NOT a robot and NOT a human figure. Short stubby arms.
Cute and huggable first, soldier second.`;

const 성격 = `EXPRESSION: completely deadpan and unreadable — this character never changes
expression. Instead of eyes it has ONE smooth round LENS set into the helmet visor, softly
glowing from within with a calm steady light. No mouth. Posture is perfectly upright,
disciplined, standing at attention. Serious, dutiful, quietly warm underneath.`;

const 카메라 = `Photographed with a 50mm macro lens, shallow depth of field, soft studio light
from the upper left, gentle rim light. The character stands centred, full body visible,
slight three-quarter turn. Plain seamless soft background in a neutral tone, softly out of
focus, no scenery. Square framing with generous empty space around the character.`;

const 금지 = `NO human face, no human skin, no eyes, no mouth, no nose, no hair.
No text, no letters, no numbers, no logo, no watermark, no weapons of any kind, no gun,
no blade, no blood, no menace. Nothing scary. Do not show the table edge or the studio.
Do not make it look male or female — it must read as neither.`;

/* ── 다섯 판 — 색과 차림을 갈라 유호님이 고르실 재료를 만든다 ── */
const 판들 = [
  {
    이름: '마린1_강철회색',
    참조: ['Stone.png', 'Ash.png', 'Chalk.png', 'Lapis.png'],
    옷: `Wearing sleek space-marine armour made of stiff pale steel-grey felt: a smooth domed
helmet covering the whole head with a wide dark visor band across it, one round pale-blue
glowing lens centred in that visor. Small rounded shoulder pauldrons of the same grey felt,
each edged in tidy cream running stitch. A narrow chest plate with three tiny french-knot
studs in a vertical row. Everything trim, clean, regulation-neat.`,
  },
  {
    이름: '마린2_올리브야전',
    참조: ['Meadow.png', 'MeadowDeep.png', 'Oat.png', 'Stitch.png'],
    옷: `Wearing a field-worn olive-green felt uniform: a soft rounded helmet of deep olive
felt with a single wide amber glowing lens across the front like a visor slit. A small
oatmeal-coloured utility harness across the chest with two tiny felt pouches, stitched
closed with cross stitches. The felt shows gentle wear and a few darker patches, as if it
has been on many missions. Practical, earthy, dependable.`,
  },
  {
    이름: '마린3_남색정예',
    참조: ['Lapis.png', 'LapisDeep.png', 'Chalk.png', 'Butter.png'],
    옷: `Wearing an elite deep-navy felt spacesuit: a smooth rounded helmet of dark navy felt
with a large round golden-white glowing lens filling most of the face, ringed by a tidy
cream stitched rim like a porthole. Crisp cream piping runs along the shoulders and down the
front. Two small round butter-yellow lights sit on the collar. Sharp, formal, ceremonial —
the dress uniform of a highly decorated unit.`,
  },
  {
    이름: '마린4_모래사막',
    참조: ['Oat.png', 'Butter.png', 'Stone.png', 'Coral.png'],
    옷: `Wearing desert-sand coloured felt gear: a rounded pale oatmeal helmet with a soft
coral-pink glowing lens set low and wide across the front. A light scarf of thin cream felt
is wrapped once around the neck and trails to one side as if in a breeze. Simple flat shoulder
plates in warm sand felt, edged with tiny blanket stitches. Warm, calm, sun-bleached.`,
  },
  {
    이름: '마린5_흰눈설원',
    참조: ['Chalk.png', 'Chalk3.png', 'AshWool.png', 'LapisSoft.png'],
    옷: `Wearing snow-white felt polar armour: a smooth rounded helmet of bright chalk-white
felt with a single wide pale-blue glowing lens, cool and clear like ice. A soft high collar
of thick white roving fluffs up around the neck. Pale silver-grey plates on the shoulders and
chest, quilted with fine diamond stitching. Clean, bright, serene — a guardian of a still
frozen place.`,
  },

  /* ── 09-05 2차 (유호 「오오 생각보다 좋은데? 많이 만들어줄래?」) ──────────────
   * 앞 다섯이 «색»으로 갈렸다면 이 여덟은 «형태와 소품»도 함께 흔든다 —
   * 렌즈 모양·헬멧 형태·망토·배낭처럼 실루엣을 바꾸는 것들이라 고를 폭이 넓어진다. */
  {
    이름: '마린6_코랄형제',
    참조: ['Coral.png', 'CoralWash.png', 'Chalk.png', 'Butter.png'],
    옷: `Wearing light coral-pink felt armour, the same warm family colour as its siblings:
a soft rounded helmet in coral felt with a single round cream-white glowing lens. Small
scalloped shoulder plates edged in cream blanket stitch. A tidy cream sash crosses the chest.
Warm, friendly, unmistakably part of the same felt family.`,
  },
  {
    이름: '마린7_먹색금장',
    참조: ['DeepWool.png', 'Butter.png', 'ButterDeep.png', 'Stone.png'],
    옷: `Wearing deep charcoal-black felt armour with gold trim: a rounded matte black helmet
with one narrow horizontal glowing lens slit in warm gold. Fine gold floss piping traces the
edges of the shoulder plates and the chest seam. Three small gold french-knot studs on the
collar. Understated, high-ranking, quietly imposing.`,
  },
  {
    이름: '마린8_구조대',
    참조: ['Chalk.png', 'Coral2.png', 'Butter.png', 'Stone.png'],
    옷: `Wearing white-and-red rescue felt gear: a bright white rounded helmet with a wide
warm-amber glowing lens and a small red felt cross patch stitched on the side. A red felt
harness across the chest holds a tiny coiled rope of twisted cream yarn at the hip. Reflective
cream stripes of satin stitch run around the arms. Reassuring, ready to help.`,
  },
  {
    이름: '마린9_보라우주',
    참조: ['Pop.png', 'PopDeep.png', 'PopSoft.png', 'Chalk.png'],
    옷: `Wearing a deep violet felt spacesuit: a large smooth bubble helmet of soft translucent
lilac felt sitting over the whole head, with one round white glowing lens floating inside it.
Rounded purple shoulder plates and a soft padded torso quilted in wide horizontal channels.
A few tiny star-shaped stitches scattered across the chest. Dreamy, cosmic, gentle.`,
  },
  {
    이름: '마린10_청록미래',
    참조: ['KCCoolBlue.png', 'Lapis.png', 'Chalk.png', 'Lime.png'],
    옷: `Wearing teal and cyan felt armour with a futuristic cut: an angular rounded helmet in
deep teal felt with a wide curved visor of darker felt, one long horizontal lens glowing pale
cyan across it. Thin lime-green light lines of glossy floss run down the sides of the arms and
along the chest seam. Sleek, clean, forward-looking.`,
  },
  {
    이름: '마린11_가죽베테랑',
    참조: ['Oat.png', 'Stone.png', 'DeepWool.png', 'Stitch.png'],
    옷: `Wearing worn brown leather-look felt gear, clearly veteran: a rounded tan felt helmet,
softened and slightly misshapen with age, one round warm-amber glowing lens. A wide brown belt
of thick felt across the body with a simple square buckle. Visible mending — three neat patches
stitched on in slightly mismatched thread. Every seam shows honest wear. Steady, experienced.`,
  },
  {
    이름: '마린12_망토지휘',
    참조: ['Lapis.png', 'LapisDeep.png', 'Chalk.png', 'Butter.png'],
    옷: `Wearing navy felt armour with a commander's cape: a rounded navy helmet with one wide
pale-gold glowing lens. A long cape of deep navy felt falls from the shoulders down behind,
its inner side a lighter cream felt that shows where it folds, hem finished in careful running
stitch. Simple shoulder plates clasped with two cream discs. Dignified, quietly commanding.`,
  },
  {
    이름: '마린13_배낭정찰',
    참조: ['Meadow.png', 'Oat.png', 'Stone.png', 'Butter.png'],
    옷: `Wearing light sage-green scout felt gear: a soft rounded helmet with a small round
lens glowing pale yellow, plus two tiny antenna threads standing up from the top, each tipped
with a bead. A chunky felt backpack sits on its back, its straps crossing the chest, with a
rolled bedroll of cream felt tied on top. Light, mobile, ready to go far.`,
  },
];

function 참조경로(파일들) {
  return 파일들.map((f) => {
    const p = path.join(패치, f);
    if (!fs.existsSync(p)) throw new Error(`참조 없음 — ${p}`);
    return p;
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const 하나 = argv.includes('--판') ? Number(argv[argv.indexOf('--판') + 1]) : null;
  const 대상 = 하나 ? 판들.filter((_, i) => i + 1 === 하나) : 판들;
  if (!대상.length) { console.error(`--판 은 1~${판들.length} 다`); process.exit(1); }

  const 게이트 = await 배치게이트({ 장수: 대상.length, 크기: '2K' });
  if (게이트 && 게이트.멈춤) { console.error(게이트.사유); process.exit(2); }

  fs.mkdirSync(낼곳, { recursive: true });
  const k = 키();
  let 구움 = 0, 건너뜀 = 0;
  const 다시 = argv.includes('--다시');
  const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

  for (const [i, 판] of 대상.entries()) {
    const 저장경로 = path.join(낼곳, `${판.이름}.png`);
    if (fs.existsSync(저장경로) && !다시) { 건너뜀 += 1; console.log(`⏭  ${판.이름} — 이미 있다(--다시 면 다시 굽는다)`); continue; }
    const 지시 = [재질, 몸, 성격, 판.옷, 카메라, 금지].join('\n\n');
    /* 🔴 09-05 실측 — 열 장을 연달아 던지자 넷째에서 `429 RESOURCE_EXHAUSTED` 가 났다.
     *   크레딧이 마른 것이 아니라 **분당 몫**에 걸린 것이다(그때 크레딧은 99.6% 남아 있었다).
     *   ⇒ 사이를 띄운다. 값이 아니라 «시간»을 쓰는 쪽이 싸다. */
    if (i > 0) await 잠깐(12_000);
    let 시도 = 0;
    for (;;) {
      try {
        const r = await 한컷({ 이름: 판.이름, 지시, 참조: 참조경로(판.참조), 비율: '1:1', 크기: '2K', 저장경로, k });
        console.log(`✅ ${판.이름} — ${r && r.초 ? r.초 + '초 · ' : ''}${저장경로}`);
        구움 += 1;
        break;
      } catch (e) {
        const 분당벽 = /429|RESOURCE_EXHAUSTED/.test(e.message);
        if (분당벽 && 시도 < 3) { 시도 += 1; console.log(`   ⏳ ${판.이름} 분당 벽 — ${30 * 시도}초 쉬고 다시(${시도}/3)`); await 잠깐(30_000 * 시도); continue; }
        console.error(`❌ ${판.이름} — ${e.message.slice(0, 160)}`);
        if (e.돈벽 && !분당벽) return 마무리();
        break;
      }
    }
  }
  function 마무리() { console.log(`\n[마린굽기] 구움 ${구움} · 건너뜀 ${건너뜀} · 든 돈 ≈ ${구움 * 190}원 · ${낼곳}`); }
  마무리();
  console.log('   판정 = 유호님 눈. 고르신 하나가 정본이 되고, 그 뒤로는 이 도구로 다시 그리지 않는다.');
}

if (require.main === module) main().catch((e) => { console.error('실행 오류:', e.message); process.exit(1); });
