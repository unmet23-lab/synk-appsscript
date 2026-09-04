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

/* 🔑 09-05 — 유호님이 «큰 헬멧 + 작은 몸»(18번) 비율을 고르셨다(「비슷한 느낌으로 몇 개 더」).
 *   그래서 비율을 상수로 뽑아 고정하고, 아래 판들은 색·장비만 갈아 낸다.
 *   ⇒ 「비율은 같고 나머지만 다른」 그림이 나와야 유호님이 한 축만 보고 고르실 수 있다. */
const 큰헬멧몸 = `BODY SHAPE: exaggerated cute proportions — an OVERSIZED rounded helmet that
takes up nearly HALF of the whole figure, sitting on a SMALL compact rounded felt body with
tiny stubby arms and a short scalloped hem. The helmet looks almost too big for the body,
which is exactly what makes it endearing. Top-heavy chibi silhouette. It is a soft doll
wearing gear, NOT a robot and NOT a human figure. Cute and huggable first, soldier second.`;

const 성격 = `EXPRESSION: completely deadpan and unreadable — this character never changes
expression. Instead of eyes it has ONE smooth round LENS set into the helmet visor, softly
glowing from within with a calm steady light. No mouth. Posture is perfectly upright,
disciplined, standing at attention. Serious, dutiful, quietly warm underneath.`;

/* 🔑 09-05 — 유호님이 큰헬멧 A(남색)·B(회색)를 고르시고 「눈 두 개 버전도」를 부르셨다.
 *   위 상수가 «ONE lens» 를 못박고 있어서 그 자리를 갈아야 한다(문면 하나만 고치면 서로 싸운다). */
const 렌즈둘성격 = `EXPRESSION: completely deadpan and unreadable — this character never changes
expression. Instead of eyes it has TWO round LENSES side by side, set into the helmet visor
where eyes would be, both softly glowing from within with the same calm steady light.
They are simple glowing circles, not cartoon eyes — no pupils, no eyelids, no eyebrows,
no expression of any kind. The pair reads slightly warmer and more approachable than a single
lens while staying completely expressionless. No mouth. Posture perfectly upright,
disciplined, standing at attention. Serious, dutiful, quietly warm underneath.`;

const 카메라 = `Photographed with a 50mm macro lens, shallow depth of field, soft studio light
from the upper left, gentle rim light. The character stands centred, full body visible,
slight three-quarter turn. Plain seamless soft background in a neutral tone, softly out of
focus, no scenery. Square framing with generous empty space around the character.`;

/* 🔑 09-05 — 유호님이 «정면을 본 마린»을 부르셨다. 위 상수는 `three-quarter turn`(비스듬)이라
 *   그 자리를 갈아야 한다. 정면은 마스코트 기본판의 자세이기도 하다(앱 화면·카드가 정면을 쓴다). */
const 정면카메라 = `Photographed with a 50mm macro lens, shallow depth of field, soft studio
light from the upper left, gentle rim light. The character stands centred and faces the
camera DIRECTLY, perfectly straight on, fully frontal and symmetrical — both lenses level,
both tiny arms visible at its sides, no turn of the body at all. Full body visible.
Plain seamless soft background in a neutral tone, softly out of focus, no scenery.
Square framing with generous empty space around the character.`;

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

  /* ── 09-05 3차 (유호 「10장 더 그려줄래? 나쁘진않아 지금도」) ────────────────
   * 🔑 「나쁘진 않다」 = 아직 «이거다» 가 없다는 뜻으로 읽었다. 같은 결로 열 장을 더 하면
   *   비슷한 것만 나온다 ⇒ 이번엔 **소품·비율·머리 형태**를 크게 흔든다.
   * 🔑 정본에 있는데 안 쓴 단서 둘을 여기서 쓴다:
   *   ①「말 끝에 짧은 정지 · **끝나면 목록에 체크**」(§3 버릇 2) ⇒ 목록판이 소품이 된다
   *   ②유호님이 부르신 «스파르타 «선생님»» ⇒ 교관 결(호루라기·지휘봉)도 한 판씩 세운다 */
  {
    이름: '마린14_목록판체크',
    참조: ['Stone.png', 'Oat.png', 'Chalk.png', 'Lapis.png'],
    옷: `Wearing simple slate-grey felt armour with a rounded helmet and one calm white glowing
lens. In one stubby arm it holds a small felt clipboard — a rectangle of stiff oatmeal felt
with three short lines of running stitch on it and two tiny cream check marks already
stitched beside the first two. The other arm rests at its side. Dutiful, orderly, quietly
satisfied at having ticked something off.`,
  },
  {
    이름: '마린15_호루라기교관',
    참조: ['Meadow.png', 'Chalk.png', 'Butter.png', 'Stone.png'],
    옷: `A drill-instructor version: wearing crisp olive felt gear with a flat-topped rounded
cap of stiff felt instead of a full helmet, brim short and neat, one wide amber glowing lens
across where eyes would be. A small felt whistle on a cream cord hangs at the chest. Posture
bolt upright, chest out, absolutely regulation. Stern teacher energy, but the felt is soft
and the shapes are round — never harsh.`,
  },
  {
    이름: '마린16_렌즈둘',
    참조: ['Lapis.png', 'Chalk.png', 'Stone.png', 'KCCoolBlue.png'],
    옷: `Wearing pale blue-grey felt armour. Instead of one lens the helmet has TWO round
glowing lenses side by side where eyes would be, both softly lit in warm white, giving it a
calmer and slightly more approachable face while still showing no expression at all. Simple
rounded shoulder plates, a plain chest seam of running stitch. Clean and minimal.`,
  },
  {
    이름: '마린17_돔머리전체',
    참조: ['Chalk.png', 'LapisSoft.png', 'Stone.png', 'PopSoft.png'],
    옷: `Wearing a spacesuit where the ENTIRE head is one large smooth dome of pale translucent
felt, glowing gently from within with a soft inner light, with no visible face or lens at all
— just a luminous rounded head like a paper lantern. Below it a simple cream felt body with
small rounded shoulder pads. Mysterious, serene, quietly otherworldly.`,
  },
  {
    이름: '마린18_큰헬멧작은몸',
    참조: ['Stone.png', 'Lapis.png', 'Butter.png', 'Chalk.png'],
    옷: `Exaggerated cute proportions: an oversized rounded helmet that takes up nearly HALF the
whole figure, deep grey felt with one big round amber glowing lens filling most of the front,
sitting on a small compact body with tiny stubby arms and a short scalloped hem. The helmet
looks almost too big, which makes it endearing. Top-heavy, chibi, very huggable.`,
  },
  {
    이름: '마린19_후드형',
    참조: ['Oat.png', 'Stone.png', 'CoralSoft.png', 'Chalk.png'],
    옷: `Softer silhouette: instead of a hard helmet it wears a soft felt HOOD pulled up over
the head, the fabric falling in gentle folds around the face opening. Inside that shadowed
opening sits one round warm glowing lens. A simple wrap of cream felt crosses the body and
ties at the side. Quiet, monk-like, gentle but disciplined.`,
  },
  {
    이름: '마린20_미니멀띠하나',
    참조: ['Chalk.png', 'Stone.png', 'Lapis.png', 'Stitch.png'],
    옷: `Extremely minimal: a plain undecorated felt body in soft warm grey with NO armour
plates at all — only one single wide band of darker felt wrapped horizontally across where the
eyes would be, with one small glowing lens set into it. Nothing else. No shoulders, no chest
piece, no straps. Pure simple shape. Calm, modern, almost abstract.`,
  },
  {
    이름: '마린21_훈장계급',
    참조: ['LapisDeep.png', 'Butter.png', 'Coral.png', 'Chalk.png'],
    옷: `A highly decorated officer: deep navy felt uniform with a rounded helmet and one narrow
gold glowing lens. On the chest, a neat row of five tiny ribbon bars stitched in coral, cream,
gold and green felt, plus one small round medal hanging below on a short ribbon. Two thin gold
stripes on each shoulder. Formal, accomplished, wearing its history.`,
  },
  {
    이름: '마린22_바이저올림',
    참조: ['Stone.png', 'Butter.png', 'Chalk.png', 'Oat.png'],
    옷: `Caught in a rare off-duty moment: grey felt helmet with the visor FLIPPED UP, resting
on top of the head like a cap brim. The face opening below is empty and dark except for one
soft round glowing lens floating in it, warmer and brighter than usual — the light of someone
who has just been praised and is pretending not to be pleased. Shoulders slightly relaxed.`,
  },
  {
    이름: '마린23_군용무늬',
    참조: ['Meadow.png', 'MeadowDeep.png', 'Oat.png', 'Stone.png'],
    옷: `Wearing a felt body covered in a hand-stitched camouflage pattern — irregular patches
of sage, olive and sand felt appliquéd onto the body and sewn down with visible blanket stitch
around every edge, like a patchwork quilt. A plain rounded helmet in solid olive with one
white glowing lens, deliberately simple so the patterned body reads first. Crafty, textural,
one of a kind.`,
  },

  /* ── 09-05 4차 — «큰 헬멧 + 작은 몸» 비율 고정 (유호 픽 18번) ──────────────
   * 유호님이 셋(강철회색·남색정예·큰헬멧작은몸) 중 비율 쪽을 이어 보자고 하셨다.
   * ⇒ 아래 여덟은 전부 `큰헬멧몸` 을 쓴다. 갈리는 것은 색·장비·소품뿐이다. */
  {
    이름: '큰헬멧A_남색정예', 몸덮기: 큰헬멧몸,
    참조: ['Lapis.png', 'LapisDeep.png', 'Chalk.png', 'Butter.png'],
    옷: `Deep navy felt: the huge domed helmet is dark navy with one big round golden-white
glowing lens filling most of its front, ringed by a tidy cream stitched rim like a porthole.
Crisp cream piping along the tiny shoulder plates. Two small butter-yellow dots on the collar.`,
  },
  {
    이름: '큰헬멧B_강철회색', 몸덮기: 큰헬멧몸,
    참조: ['Stone.png', 'Ash.png', 'Chalk.png', 'Lapis.png'],
    옷: `Pale steel-grey felt: the huge helmet is smooth grey with a wide darker visor band and
one big round pale-blue glowing lens. Small rounded shoulder pauldrons edged in cream running
stitch. Three tiny french-knot studs down the little chest.`,
  },
  {
    이름: '큰헬멧C_코랄형제', 몸덮기: 큰헬멧몸,
    참조: ['Coral.png', 'CoralWash.png', 'Chalk.png', 'Butter.png'],
    옷: `Warm coral-pink felt, the same family colour as its siblings: the huge helmet is soft
coral with one big round cream-white glowing lens. Tiny scalloped shoulder plates edged in
cream blanket stitch, and a small cream sash across the little body.`,
  },
  {
    이름: '큰헬멧D_올리브야전', 몸덮기: 큰헬멧몸,
    참조: ['Meadow.png', 'MeadowDeep.png', 'Oat.png', 'Stitch.png'],
    옷: `Field olive felt: the huge helmet is deep olive with one wide amber glowing lens across
the front like a visor slit. A small oatmeal harness on the little body with two tiny pouches.
The felt shows gentle wear, as if it has been on many missions.`,
  },
  {
    이름: '큰헬멧E_목록판', 몸덮기: 큰헬멧몸,
    참조: ['Lapis.png', 'Oat.png', 'Chalk.png', 'Butter.png'],
    옷: `Navy felt with the huge helmet and one round white glowing lens. In one tiny stubby arm
it holds a small felt clipboard — stiff oatmeal felt with three short lines of running stitch
and two cream check marks already stitched beside the first two. The board looks big in its
little hand, which makes it even more endearing.`,
  },
  {
    이름: '큰헬멧F_흰눈설원', 몸덮기: 큰헬멧몸,
    참조: ['Chalk.png', 'Chalk3.png', 'AshWool.png', 'LapisSoft.png'],
    옷: `Snow-white felt: the huge helmet is bright chalk-white with one wide pale-blue glowing
lens, cool and clear like ice. A soft high collar of thick white roving fluffs up where the
helmet meets the small body. Fine diamond quilting on the tiny chest plate.`,
  },
  {
    이름: '큰헬멧G_큰렌즈', 몸덮기: 큰헬멧몸,
    참조: ['Lapis.png', 'Butter.png', 'Chalk.png', 'Stone.png'],
    옷: `Navy felt, but the LENS is enormous — one huge round glowing lens in warm amber takes
up almost the entire front of the oversized helmet, like a single great luminous eye, ringed
by a thick cream stitched rim. The tiny body below is plain and simple so the lens reads first.
Striking, gentle, unmistakable at any size.`,
  },
  {
    이름: '큰헬멧H_망토', 몸덮기: 큰헬멧몸,
    참조: ['LapisDeep.png', 'Chalk.png', 'Butter.png', 'Stone.png'],
    옷: `Deep navy felt with the huge helmet and one pale-gold glowing lens. A small cape of
navy felt falls from the tiny shoulders, its inner side cream where it folds, hem finished in
careful running stitch. The cape looks slightly oversized on the small body, adding to the
charm rather than the grandeur.`,
  },

  /* ── 09-05 5차 — 눈 «둘» (유호 「첫번째랑 두번째가 맘에 들긴 하는데 눈 두개 버전도」) ──
   * 고르신 둘(A 남색 · B 강철회색)에 렌즈만 둘로 바꾼다. 그리고 렌즈 «크기와 간격»을 갈라
   * 넷을 낸다 — 눈이 둘이 되면 그 둘의 사이가 인상을 크게 바꾸기 때문이다. */
  {
    이름: '눈둘A_남색', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Lapis.png', 'LapisDeep.png', 'Chalk.png', 'Butter.png'],
    옷: `Deep navy felt: the huge domed helmet is dark navy, its two round golden-white glowing
lenses set at a comfortable natural spacing, each ringed by a tidy cream stitched rim. Crisp
cream piping along the tiny shoulder plates. Two small butter-yellow dots on the collar.`,
  },
  {
    이름: '눈둘B_강철회색', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Stone.png', 'Ash.png', 'Chalk.png', 'Lapis.png'],
    옷: `Pale steel-grey felt: the huge helmet is smooth grey with a wide darker visor band
across it, two round pale-blue glowing lenses sitting in that band at a comfortable natural
spacing. Small rounded shoulder pauldrons edged in cream running stitch. Three tiny
french-knot studs down the little chest.`,
  },
  {
    이름: '눈둘C_남색_큰눈', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Lapis.png', 'LapisDeep.png', 'Butter.png', 'Chalk.png'],
    옷: `Deep navy felt with the huge helmet. The TWO glowing lenses are LARGE — each one big
and round, warm amber, taking up a generous part of the helmet front and set close together,
which reads noticeably softer and more endearing. Thick cream stitched rims around both.
The tiny body below stays plain so the two lights read first.`,
  },
  {
    이름: '눈둘D_회색_작은눈', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Stone.png', 'Chalk.png', 'Lapis.png', 'Ash.png'],
    옷: `Pale steel-grey felt with the huge helmet. The TWO glowing lenses are SMALL and set
wide apart near the outer edges of the visor band, cool white, which reads more precise and
machine-like while still being gentle. Neat grey plates, minimal trim, everything regulation
tidy.`,
  },

  /* ── 09-05 6차 — 판정 축이 «소유욕»으로 굳었다 (유호 09-05) ────────────────
   *   「지금 버전이 전 버전보다 훨씬 학생 입장에서 소유욕? 같은걸 자극할 것 같아」
   * 🔑 이 한 마디가 지금까지 나온 판정 중 가장 정확한 자다. 마린은 학생이 «고르는» 캐릭터이고,
   *   고른 뒤에는 몇 년을 함께 간다 ⇒ 「잘 만들었나」보다 **「내 것으로 삼고 싶은가」**가 이긴다.
   * ⇒ 굳은 축 둘(큰 헬멧 비율 · 눈 둘)은 이제 안 흔든다. 색과 «작은 디테일»만 갈아
   *   소유욕이 어디서 오는지 좁힌다 — 디테일은 «자세히 볼수록 발견이 있는» 자리다. */
  {
    이름: '소유A_크림', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Chalk.png', 'Oat.png', 'Butter.png', 'Stone.png'],
    옷: `Soft cream and ivory felt, the gentlest possible palette: the huge helmet is warm
cream with two round pale-gold glowing lenses. Everything is soft and low-contrast, the felt
looks especially thick and pettable. A single thin oat-coloured band around the middle.`,
  },
  {
    이름: '소유B_민트', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['MeadowSoft.png', 'Chalk.png', 'KCCoolBlue.png', 'Butter.png'],
    옷: `Fresh pale mint-green felt: the huge helmet is soft mint with two round cream-white
glowing lenses. Small rounded shoulder plates in a slightly deeper sage, edged in cream
blanket stitch. Light, fresh, spring-like.`,
  },
  {
    이름: '소유C_버터노랑', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Butter.png', 'ButterSoft.png', 'Oat.png', 'Chalk.png'],
    옷: `Warm butter-yellow felt: the huge helmet is soft golden yellow with two round
cream-white glowing lenses. Tiny cream shoulder plates and a small stitched band across the
little body. Sunny, warm, immediately cheerful.`,
  },
  {
    이름: '소유D_라벤더', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['PopSoft.png', 'LapisSoft.png', 'Chalk.png', 'Butter.png'],
    옷: `Soft lavender felt: the huge helmet is pale purple with two round warm-white glowing
lenses. Delicate cream piping traces the helmet rim. Everything soft-edged and dreamy.
Calm, gentle, a little magical.`,
  },
  {
    이름: '소유E_체리', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['체리.png', 'Coral.png', 'Chalk.png', 'Butter.png'],
    옷: `Deep cherry-red felt: the huge helmet is rich red with two round cream-white glowing
lenses. Crisp cream trim along the helmet edge and the tiny shoulder plates. Bold, confident,
the most eye-catching of the family.`,
  },
  {
    이름: '소유F_남색_목도리', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Lapis.png', 'Coral.png', 'Chalk.png', 'Butter.png'],
    옷: `Navy felt with the huge helmet and two golden-white glowing lenses. A small knitted
scarf of soft coral yarn is wrapped once around where the helmet meets the little body, its
fringed ends hanging down one side. The scarf is the only warm colour and it makes the whole
figure feel looked-after.`,
  },
  {
    이름: '소유G_회색_어깨배지', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Stone.png', 'Coral.png', 'Butter.png', 'Chalk.png'],
    옷: `Steel-grey felt with the huge helmet and two pale-blue glowing lenses. On one tiny
shoulder sits a small round felt badge — a simple coral circle with a cream star shape
stitched inside it, clearly hand-sewn and slightly off-centre. That one small imperfect badge
is the whole personality of the piece.`,
  },
  {
    이름: '소유H_남색_안테나', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Lapis.png', 'Butter.png', 'Chalk.png', 'Stone.png'],
    옷: `Navy felt with the huge helmet and two warm glowing lenses. Two slim antenna threads
stand up from the top of the helmet, each tipped with a tiny round butter-yellow bead that
catches the light. They wobble slightly, giving the still figure a hint of life.`,
  },
  {
    이름: '소유I_회색_세월자국', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Stone.png', 'Oat.png', 'Stitch.png', 'Chalk.png'],
    옷: `Steel-grey felt with the huge helmet and two soft white glowing lenses. The helmet
carries gentle marks of a long service — two small felt patches sewn on with visible stitches
in slightly mismatched thread, and one softly worn corner where the fibre has gone fuzzy.
Nothing damaged, just loved and used. It looks like it has a history.`,
  },
  {
    이름: '소유J_남색_작은주머니', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Lapis.png', 'Oat.png', 'Meadow.png', 'Chalk.png'],
    옷: `Navy felt with the huge helmet and two golden glowing lenses. On the front of the tiny
body sits one small oatmeal felt pouch with a rounded flap, closed with a single cream stitch,
and peeking out of the top is one tiny felt flower with a green stem — the soft spot the
character would never admit to. Everything else is regulation neat.`,
  },

  /* ── 09-05 7차 — 색이 «노랑·초록»으로 좁혀졌다 (유호 09-05) ────────────────
   *   「지금은 노란색 버터노랑이랑 그린색? 2번째꺼가 그나마 낫다」
   * ⇒ 남색·회색 계열은 접는다. 남은 축은 «그 두 색 안에서의 톤»과 «디테일» 둘뿐이다.
   * 🔑 오늘 정하기로 한 자리라 이번 열은 폭을 넓히지 않고 **좁혀서 촘촘히** 낸다. */
  {
    이름: '노랑1_진한골드', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['ButterDeep.png', 'Butter.png', 'Oat.png', 'Chalk.png'],
    옷: `Rich deep golden-yellow felt, noticeably warmer and more saturated than a pale butter:
the huge helmet is deep gold with two round cream-white glowing lenses. Small cream shoulder
plates edged in tidy running stitch. Confident, warm, autumnal.`,
  },
  {
    이름: '노랑2_연한크림노랑', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['ButterSoft.png', 'Chalk.png', 'Oat.png', 'Butter.png'],
    옷: `Very pale creamy yellow felt, soft and milky: the huge helmet is barely-there butter
with two round warm-white glowing lenses. Everything low-contrast and gentle, the felt looking
especially thick and soft. Quiet, tender, easy on the eye.`,
  },
  {
    이름: '노랑3_목도리', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Butter.png', 'Meadow.png', 'Chalk.png', 'Oat.png'],
    옷: `Warm butter-yellow felt with the huge helmet and two cream-white glowing lenses.
A small knitted scarf of soft sage-green yarn is wrapped once around where the helmet meets
the little body, its fringed ends hanging down one side. The green against the yellow feels
like someone chose it for them.`,
  },
  {
    이름: '노랑4_어깨배지', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Butter.png', 'Meadow.png', 'Chalk.png', 'Coral.png'],
    옷: `Warm butter-yellow felt with the huge helmet and two cream glowing lenses. On one tiny
shoulder sits a small round felt badge — a sage-green circle with a cream star stitched inside,
clearly hand-sewn and slightly off-centre. One imperfect little thing on an otherwise tidy
figure.`,
  },
  {
    이름: '노랑5_세월자국', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Butter.png', 'Oat.png', 'Stitch.png', 'Chalk.png'],
    옷: `Warm butter-yellow felt with the huge helmet and two cream glowing lenses. The helmet
carries gentle marks of long service — two small oat-coloured patches sewn on with visible
stitches in slightly mismatched thread, and one softly worn corner gone fuzzy. Nothing damaged,
just used and cared for. It looks like it has a history.`,
  },
  {
    이름: '초록1_진한세이지', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Meadow.png', 'MeadowDeep.png', 'Chalk.png', 'Butter.png'],
    옷: `Deeper sage-green felt, richer and more grounded than a pale mint: the huge helmet is
soft deep green with two round cream-white glowing lenses. Small shoulder plates in a lighter
sage, edged with cream blanket stitch. Calm, natural, quietly reassuring.`,
  },
  {
    이름: '초록2_아주연한민트', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['MeadowSoft.png', 'Chalk.png', 'Butter.png', 'KCCoolBlue.png'],
    옷: `Very pale mint felt, almost white with a breath of green: the huge helmet is the softest
mint with two round warm-white glowing lenses. Everything delicate and low-contrast, the felt
looking freshly brushed. Light, airy, spring morning.`,
  },
  {
    이름: '초록3_목도리', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['MeadowSoft.png', 'Butter.png', 'Chalk.png', 'Meadow.png'],
    옷: `Soft mint-green felt with the huge helmet and two cream-white glowing lenses. A small
knitted scarf of warm butter-yellow yarn is wrapped once around where the helmet meets the
little body, fringed ends hanging down one side. The yellow against the mint is the only warm
note and it makes the figure feel looked-after.`,
  },
  {
    이름: '초록4_어깨배지', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['MeadowSoft.png', 'Butter.png', 'Chalk.png', 'Coral.png'],
    옷: `Soft mint-green felt with the huge helmet and two cream glowing lenses. On one tiny
shoulder sits a small round felt badge — a butter-yellow circle with a cream star stitched
inside, hand-sewn and a little off-centre. That single imperfect badge carries the whole
personality.`,
  },
  {
    이름: '초록5_노랑조합', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Meadow.png', 'Butter.png', 'ButterSoft.png', 'Chalk.png'],
    옷: `Two-tone: the huge helmet is soft sage-green while the small body below is warm
butter-yellow, the two colours meeting in a clean stitched seam. Two round cream-white glowing
lenses. Tiny yellow shoulder plates on the green helmet side. The pairing is fresh and cheerful
without either colour winning.`,
  },

  /* ── 09-05 8차 — 남색을 도로 살린다 (유호 「아냐 남색계열도 좋아」) ──────────
   * 앞서 이미 나온 남색 판(눈둘A · 눈둘C · 소유F 목도리 · 소유H 안테나)과 안 겹치게
   * «톤»(더 짙게·더 옅게)과 «아직 안 붙인 디테일»로만 다섯을 낸다. */
  {
    이름: '남색1_아주짙게', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['LapisDeep.png', 'DeepWool.png', 'Chalk.png', 'Butter.png'],
    옷: `Very deep midnight navy felt, almost black but unmistakably blue: the huge helmet is
dark ink-navy with two round warm-gold glowing lenses that read especially bright against it.
Fine cream piping along the helmet rim. Deep, serious, night-sky.`,
  },
  {
    이름: '남색2_연한하늘', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['LapisSoft.png', 'Chalk.png', 'KCCoolBlue.png', 'Butter.png'],
    옷: `Soft pale blue felt, gentle and washed-out like a clear morning sky: the huge helmet is
light powder blue with two round cream-white glowing lenses. Everything low-contrast and calm,
the felt looking especially soft. Approachable, quiet, easy.`,
  },
  {
    이름: '남색3_노랑목도리', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Lapis.png', 'Butter.png', 'Chalk.png', 'Oat.png'],
    옷: `Navy felt with the huge helmet and two cream-white glowing lenses. A small knitted
scarf of warm butter-yellow yarn is wrapped once around where the helmet meets the little body,
fringed ends hanging down one side. The yellow is the only warm note against all that navy.`,
  },
  {
    이름: '남색4_어깨배지', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Lapis.png', 'Butter.png', 'Chalk.png', 'Coral.png'],
    옷: `Navy felt with the huge helmet and two golden glowing lenses. On one tiny shoulder sits
a small round felt badge — a butter-yellow circle with a cream star stitched inside, hand-sewn
and slightly off-centre. One small imperfect thing on an otherwise regulation-tidy figure.`,
  },
  {
    이름: '남색5_세월자국', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격,
    참조: ['Lapis.png', 'Stone.png', 'Stitch.png', 'Chalk.png'],
    옷: `Navy felt with the huge helmet and two soft white glowing lenses. The helmet carries
gentle marks of long service — two small grey-blue patches sewn on with visible stitches in
slightly mismatched thread, and one softly worn corner gone fuzzy. Nothing damaged, just used
and cared for over many years.`,
  },

  /* ── 09-05 9차 — 정면 · 목도리 없음 (유호 확정 09-05) ──────────────────────
   * 🔴 **목도리는 기본형에서 뺀다** — 「여름때 더워보여. 이게 기본이면 안돼」(결정.md 09-05).
   *   그래서 탑10 의 3·4번(목도리 판)은 목도리를 빼고 그 «색»만 가져온다.
   *   대신 노랑을 목도리 아닌 자리(테두리·배지·주머니·눈)에 점으로 넣어 밋밋해지지 않게 한다.
   * 🔑 카메라도 `정면카메라` 로 간다 — 유호님이 「정면을 본 마린」을 부르셨고,
   *   정면은 앱 화면·카드가 실제로 쓰는 기본 자세다. */

  // ㉠ 1번 결 — 남색 + 꽃 주머니 (정본의 반전을 소품으로 보여주는 판)
  {
    이름: '정면1a_꽃주머니', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['Lapis.png', 'Oat.png', 'Meadow.png', 'Chalk.png'],
    옷: `Navy felt with the huge helmet and two warm amber glowing lenses. On the front of the
tiny body sits one small oatmeal felt pouch with a rounded flap, and peeking out of it one
tiny felt flower with a green stem. Everything else regulation neat. No scarf.`,
  },
  {
    이름: '정면1b_꽃주머니_노랑꽃', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['Lapis.png', 'Butter.png', 'Oat.png', 'Chalk.png'],
    옷: `Navy felt with the huge helmet and two cream-white glowing lenses. A small cream felt
pouch on the front of the tiny body, with one tiny butter-yellow flower peeking out. Thin
cream piping along the helmet rim. No scarf.`,
  },
  {
    이름: '정면1c_꽃주머니_민트꽃', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['Lapis.png', 'MeadowSoft.png', 'Chalk.png', 'Butter.png'],
    옷: `Navy felt with the huge helmet and two soft golden glowing lenses. A small sage-green
felt pouch on the front of the tiny body with a tiny cream flower peeking out. Simple, tidy,
nothing else. No scarf.`,
  },
  {
    이름: '정면1d_꽃주머니_큰눈', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['Lapis.png', 'Butter.png', 'Meadow.png', 'Chalk.png'],
    옷: `Navy felt with the huge helmet. The two glowing lenses are LARGE and warm amber, taking
up a generous part of the helmet front, which reads especially soft. One small oatmeal pouch
with a tiny flower on the front of the tiny body. No scarf.`,
  },
  {
    이름: '정면1e_꽃주머니_짙은남색', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['LapisDeep.png', 'Butter.png', 'Oat.png', 'Chalk.png'],
    옷: `Very deep midnight navy felt, almost black but unmistakably blue, with the huge helmet
and two bright warm-gold glowing lenses that stand out strongly against it. One small cream
pouch with a tiny yellow flower on the tiny body. No scarf.`,
  },

  // ㉡ 3번 결 — 남색 (목도리를 뺀 자리에 노랑을 점으로)
  {
    이름: '정면3a_남색_민무늬', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['Lapis.png', 'Chalk.png', 'Butter.png', 'Stone.png'],
    옷: `Clean navy felt with the huge helmet and two cream-white glowing lenses. Absolutely
minimal — no badges, no pouches, no scarf, no trim except one fine cream running stitch along
the helmet rim. Pure simple shape.`,
  },
  {
    이름: '정면3b_남색_노랑테', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['Lapis.png', 'Butter.png', 'Chalk.png', 'Oat.png'],
    옷: `Navy felt with the huge helmet and two cream glowing lenses, each ringed by a thick
BUTTER-YELLOW stitched rim that makes the eyes pop warmly. A matching thin yellow line runs
along the bottom hem of the tiny body. No scarf.`,
  },
  {
    이름: '정면3c_남색_노랑배지', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['Lapis.png', 'Butter.png', 'Chalk.png', 'Coral.png'],
    옷: `Navy felt with the huge helmet and two golden glowing lenses. On one tiny shoulder a
small round butter-yellow felt badge with a cream star stitched inside, hand-sewn and slightly
off-centre. Nothing else. No scarf.`,
  },
  {
    이름: '정면3d_남색_노랑눈', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['Lapis.png', 'Butter.png', 'ButterDeep.png', 'Chalk.png'],
    옷: `Navy felt with the huge helmet. The two glowing lenses are a strong warm BUTTER-YELLOW,
bright and cheerful against the deep navy — the yellow lives entirely in the eyes. The body is
plain navy with one fine cream stitch line. No scarf.`,
  },
  {
    이름: '정면3e_남색_노랑어깨', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['Lapis.png', 'Butter.png', 'Chalk.png', 'Stone.png'],
    옷: `Navy felt with the huge helmet and two cream glowing lenses. Two small rounded shoulder
plates in warm butter-yellow felt sit on the tiny body, edged in cream blanket stitch —
the only warm colour. No scarf.`,
  },

  // ㉢ 4번 결 — 민트 (목도리를 뺀 자리에 노랑을 점으로)
  {
    이름: '정면4a_민트_민무늬', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['MeadowSoft.png', 'Chalk.png', 'Butter.png', 'Meadow.png'],
    옷: `Clean soft mint-green felt with the huge helmet and two cream-white glowing lenses.
Absolutely minimal — no badges, no pouches, no scarf, only one fine cream running stitch along
the helmet rim. Fresh and simple.`,
  },
  {
    이름: '정면4b_민트_노랑테', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['MeadowSoft.png', 'Butter.png', 'Chalk.png', 'Meadow.png'],
    옷: `Soft mint-green felt with the huge helmet and two cream glowing lenses, each ringed by
a thick BUTTER-YELLOW stitched rim. A matching thin yellow line along the bottom hem of the
tiny body. No scarf.`,
  },
  {
    이름: '정면4c_민트_노랑배지', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['MeadowSoft.png', 'Butter.png', 'Chalk.png', 'Coral.png'],
    옷: `Soft mint-green felt with the huge helmet and two cream glowing lenses. On one tiny
shoulder a small round butter-yellow felt badge with a cream star stitched inside, hand-sewn
and slightly off-centre. Nothing else. No scarf.`,
  },
  {
    이름: '정면4d_민트_꽃주머니', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['MeadowSoft.png', 'Butter.png', 'Oat.png', 'Chalk.png'],
    옷: `Soft mint-green felt with the huge helmet and two cream glowing lenses. On the front of
the tiny body one small cream felt pouch with a tiny butter-yellow flower peeking out —
the mint version of the flower-pouch idea. No scarf.`,
  },
  {
    이름: '정면4e_민트_진하게', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['Meadow.png', 'MeadowDeep.png', 'Butter.png', 'Chalk.png'],
    옷: `Deeper sage-green felt, richer and more grounded than a pale mint, with the huge helmet
and two warm butter-yellow glowing lenses that glow strongly against the green. Plain body,
one fine cream stitch line. No scarf.`,
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
  let 구움 = 0, 건너뜀 = 0, 연속실패 = 0;
  const 다시 = argv.includes('--다시');
  const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

  for (const [i, 판] of 대상.entries()) {
    const 저장경로 = path.join(낼곳, `${판.이름}.png`);
    if (fs.existsSync(저장경로) && !다시) { 건너뜀 += 1; console.log(`⏭  ${판.이름} — 이미 있다(--다시 면 다시 굽는다)`); continue; }
    const 지시 = [재질, 판.몸덮기 || 몸, 판.성격덮기 || 성격, 판.옷, 판.카메라덮기 || 카메라, 금지].join('\n\n');
    /* 🔴 09-05 실측 — 열 장을 연달아 던지자 넷째에서 `429 RESOURCE_EXHAUSTED` 가 났다.
     *   크레딧이 마른 것이 아니라 **분당 몫**에 걸린 것이다(그때 크레딧은 99.6% 남아 있었다).
     *   ⇒ 사이를 띄운다. 값이 아니라 «시간»을 쓰는 쪽이 싸다.
     * 🔴 09-05 둘째 실측 — 12초로도 모자랐다. 열다섯 중 하나만 나오고 열넷이 429 였다.
     *   더 아픈 것은 «벽에 대고 두드린 것»이다 — 실패한 요청도 몫을 먹으니 한 판에 4번씩,
     *   56발이 벽을 45분 동안 세워 뒀다. 그래서 둘을 같이 고친다:
     *     ⓐ 사이를 30초로 (분당 둘)
     *     ⓑ 막히면 길게 쉬고(2·5·8분) 두 번만, 그리고 «세 판이 잇달아» 막히면 그만둔다.
     *       벽이 오래 서 있는 것인데 계속 두드리면 벽을 내가 붙잡고 있는 셈이다. */
    if (i > 0) await 잠깐(30_000);
    let 시도 = 0;
    for (;;) {
      try {
        const r = await 한컷({ 이름: 판.이름, 지시, 참조: 참조경로(판.참조), 비율: '1:1', 크기: '2K', 저장경로, k });
        console.log(`✅ ${판.이름} — ${r && r.초 ? r.초 + '초 · ' : ''}${저장경로}`);
        구움 += 1; 연속실패 = 0;
        break;
      } catch (e) {
        const 분당벽 = /429|RESOURCE_EXHAUSTED/.test(e.message);
        const 쉼 = [120_000, 300_000, 480_000];
        if (분당벽 && 시도 < 2) { console.log(`   ⏳ ${판.이름} 몫 벽 — ${쉼[시도] / 60_000}분 쉬고 다시(${시도 + 1}/2)`); await 잠깐(쉼[시도]); 시도 += 1; continue; }
        console.error(`❌ ${판.이름} — ${e.message.slice(0, 160)}`);
        if (e.돈벽 && !분당벽) return 마무리();
        연속실패 += 1;
        if (연속실패 >= 3) { console.error(`\n🛑 세 판이 잇달아 막혔다 — 벽이 오래 서 있다. 여기서 멈춘다(두드릴수록 벽이 길어진다).`); return 마무리(); }
        break;
      }
    }
  }
  function 마무리() { console.log(`\n[마린굽기] 구움 ${구움} · 건너뜀 ${건너뜀} · 든 돈 ≈ ${구움 * 190}원 · ${낼곳}`); }
  마무리();
  console.log('   판정 = 유호님 눈. 고르신 하나가 정본이 되고, 그 뒤로는 이 도구로 다시 그리지 않는다.');
}

if (require.main === module) main().catch((e) => { console.error('실행 오류:', e.message); process.exit(1); });
