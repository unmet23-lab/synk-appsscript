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
 *   그 자리를 갈아야 한다. 정면은 마스코트 기본판의 자세이기도 하다(앱 화면·카드가 정면을 쓴다).
 * 🔴 09-05 첫 판 실패 — 유호님이 「왜 정면을 안 보고 있지?」로 잡으셨다. 까닭은 문면 «순서»다.
 *   조립이 [재질 … 카메라 … ] 라서 맨 앞 `재질`(“photographed on a table”)이 장면을 먼저
 *   세우고, 다섯째에 온 정면 지시가 그 장면에 얹혔다. 증거 = 「배경은 민무늬」라고 썼는데도
 *   나무 탁자가 그대로 나왔다. ⇒ 야자수 때와 같은 규율(「하나만, 세게, 맨 앞에」)을 건다:
 *     ⓐ 카메라를 맨 «앞»으로 (아래 조립에서 카메라덮기가 있으면 선두)
 *     ⓑ 탁자를 부르는 `재질` 을 정면판에서는 `정면재질` 로 갈아 낸다(두 장면이 안 싸우게)
 *     ⓒ 비스듬을 «금지»로도 못 박는다 — 금지 덩어리는 이미 잘 먹는 것이 확인됐다. */
const 정면카메라 = `CAMERA AND POSE — THIS IS THE MOST IMPORTANT INSTRUCTION:
A dead-on, perfectly frontal portrait. The camera is exactly at the character's own height,
exactly on its centre line. The character faces the lens straight on, square to the camera.
The picture is bilaterally symmetrical: mirror the left half onto the right half and it
matches. Both lenses are the SAME size, at the SAME height, equally far from the centre.
Both stubby arms hang at the sides, equally visible, equally foreshortened. We see the FRONT
of the body only — no side of the body, no side of the helmet, no cheek, no shoulder turned
towards us. The head does not tilt and does not rotate.
Photographed with a 50mm macro lens on a plain seamless studio backdrop in a soft neutral
tone, shallow depth of field, soft even light from the front with a gentle rim light.
Full body visible, standing upright, centred. Square framing with generous empty space.`;

/* 정면판 전용 재질 — 위 `재질` 과 한 글자만 다르다: “on a table” → 이음매 없는 배경천.
 *   같은 말을 두 곳이 다르게 하면 «앞의 것»이 이긴다는 것을 09-05 에 실측했다. */
const 정면재질 = `A handmade needle-felted wool character, a real miniature doll photographed
against a plain seamless studio backdrop. Made entirely of textile: felted merino wool,
wet-felted sheets with visible scissor-cut edges, embroidery floss, running stitch, french
knots. Visible fibre fuzz and soft handmade irregularity. Nothing is plastic, glass, metal or
digital — even the armour plates are stiff felt sheets, even the lens is a smooth felt disc
with a stitched rim. Award-winning fibre art.`;

const 금지 = `NO human face, no human skin, no eyes, no mouth, no nose, no hair.
No text, no letters, no numbers, no logo, no watermark, no weapons of any kind, no gun,
no blade, no blood, no menace. Nothing scary. Do not show the table edge or the studio.
Do not make it look male or female — it must read as neither.`;

/* ══ 확정 묶음(09-05) — 여기서부터는 «후보 놀이»가 아니라 정본을 고르는 판이다 ═══════════
 *
 * 무엇이 이미 정해졌나(더 안 묻는다):
 *   큰 헬멧 + 작은 몸 · 렌즈 둘 · 정면 · 목도리 없음 · 몸은 남색(청금석) · 렌즈는 버터 노랑.
 *   남색은 유호 확정 09-05(결정 원장) — 까몽이 무채 자리를 가져갔으므로 마린까지 회색이면
 *   셋 중 둘이 같은 축에 선다. 버터 렌즈도 같은 결정에 함께 섰다.
 *
 * 그래서 이 스물은 «아직 안 정한 둘»만 격자로 가른다 — 헬멧 모양 5 × 몸 장식 4.
 * 축이 둘뿐이라 유호님이 「3번 헬멧에 2번 장식」으로 고르실 수 있다.
 *
 * 🔑 규격을 몽글·까몽 정본에 맞춘다(09-05 그날 정본이 4K 로 섰다):
 *   4K · 순백 바닥 · 그림자 0 · 떠 있음 ⇒ `흰배경걷기` 로 투명하게 만들고 `마스코트틀맞추기`
 *   로 같은 틀에 넣으면 셋이 나란히 선다. 마린만 2K 에 나무 탁자면 그게 안 된다. */

const 확정재질 = `A handmade needle-felted wool character, a real miniature doll photographed
against a plain seamless studio backdrop. Made entirely of textile: felted merino wool,
wet-felted sheets with visible scissor-cut edges, embroidery floss, running stitch, french
knots. Visible fibre fuzz and soft handmade irregularity, with fine stray hairs catching the
light along the top edge. Nothing is plastic, glass, metal or digital — even the armour plates
are stiff felt sheets, even the lenses are smooth felt discs with stitched rims.
Museum-quality fibre-art photography, extremely high detail in the wool fibres and stitching.`;

const 확정카메라 = `CAMERA AND POSE — THIS IS THE MOST IMPORTANT INSTRUCTION:
A dead-on, perfectly frontal product photograph. The camera sits exactly at the doll's own
height and exactly on its centre line. The doll faces the lens straight on, square to the
camera. The picture is bilaterally symmetrical: mirror the left half onto the right half and
it matches. Both lenses are the SAME size, at the SAME height, equally far from the centre.
Both stubby arms hang at the sides, equally visible. We see the FRONT of the body only — no
side of the body, no side of the helmet, no turn, no tilt, no rotation.
The doll FLOATS in mid air, weightless, with nothing under it — no table, no surface, no
ground, and NO CAST SHADOW anywhere in the frame.
Photographed with a 50mm macro lens, soft even light from the front with a gentle rim light
along the top edge. Full body visible, standing upright, centred, with generous empty space.

BACKGROUND: one single flat PURE WHITE field filling the entire frame edge to edge, perfectly
even. No gradient, no vignette, no panels, no rectangles, no patches, no seams, no texture,
no scenery, no shadow. Nothing but white behind and around the doll.`;

/* 🔴 09-05 유호 교정 「옆모습 보면 눈이 너무 튀어나왔어」는 몽글·까몽에서 나왔지만 마린도 같다 —
 *   렌즈가 헬멧 «위에 얹힌 단추»가 되면 안 된다. 몽글·까몽에 먹힌 문면을 그대로 가져온다. */
const 확정얼굴 = `EXPRESSION: completely deadpan and unreadable — this character never changes
expression. Instead of eyes it has TWO round LENSES side by side, set into the front of the
helmet where eyes would be, both glowing from within with the same calm warm BUTTER-YELLOW
light (#F5C445 — soft golden, not orange and not lemon). They are simple glowing circles, not
cartoon eyes — no pupils, no eyelids, no eyebrows, no expression of any kind. No mouth.

SIZE: each lens is about ONE QUARTER of the helmet's width. The two lenses plus the gap
between them span roughly THREE QUARTERS of the helmet's width. Big and calm.

HOW THE LENS SITS — read this carefully: each lens is SET DEEP INTO the felt of the helmet,
not glued on top of it. It is sunk in so that LESS THAN HALF of its curve shows — a shallow
disc, not a bead. The felt rises in a soft stitched ring right up against its rim, slightly
overlapping the edge all the way around. 🔴 THE LENS NEVER BREAKS THE OUTLINE OF THE HELMET —
at every angle its silhouette stays well inside the helmet's silhouette, never bulging out
past the edge, never reading as a button stuck on the side.

BOTH LENSES GLOW THE SAME: equally bright, equally wide, equally saturated. Neither falls into
shadow. Posture perfectly upright, disciplined, standing at attention. Serious, dutiful,
quietly warm underneath.`;

const 확정금지 = `NO human face, no human skin, no eyes, no mouth, no nose, no hair.
No text, no letters, no numbers, no logo, no watermark, no weapons of any kind, no gun,
no blade, no blood, no menace. Nothing scary. No scarf of any kind.
NO three-quarter view, NO side view, NO angled view, NO turned body, NO tilted head,
NO twisted torso, NO profile. Not a casual snapshot — a straight catalogue front view.
The helmet COVERS THE WHOLE HEAD like a smooth closed dome. Nothing of a head shows below
it — no face, no chin, no cheeks, no jaw, no neck, no stitch or mark that could read as a
mouth or a nose. The ONLY features anywhere on this character are the two glowing lenses.
Do not show a table, a tabletop, a wooden surface, a floor, a room, a wall or any scenery.
Do not make it look male or female — it must read as neither.`;

/* 헬멧 다섯 — 실루엣만 가른다(색·렌즈·비율은 위에서 고정됐다). */
const 헬멧들 = {
  민돔: 'The helmet is one perfectly smooth unbroken dome of navy felt, seamless, with no seam line, no rim, no brim and no rivets. Absolutely clean.',
  이음선: 'The helmet is a navy felt dome with ONE fine cream running-stitch seam running from the crown straight down the centre front, like a hand-sewn cap. Nothing else on the helmet.',
  땀테두리: 'The helmet is a navy felt dome edged all the way around its bottom rim with a neat line of cream blanket stitch, the kind that finishes a piece of hand-cut felt. No brim, no seam on top.',
  짧은챙: 'The helmet is a navy felt dome with a SHORT stiff brim of the same navy felt curving out over the lenses, like a small cap peak. Just wide enough to read, not a wide hat.',
  목덜미: 'The helmet is a navy felt dome whose back and sides come down a little longer, softly covering where a neck would be, so the head reads as one continuous rounded shape. Front stays open and clean.',
};

/* 몸 장식 넷 — 유호님이 좋게 보신 «꽃 주머니»를 축 하나로 살린다. */
const 장식들 = {
  민무늬: 'The small navy body is completely plain — no pockets, no badges, no piping. Only one fine cream running stitch along the scalloped bottom hem.',
  꽃주머니: 'On the front of the small navy body sits ONE small oatmeal felt pouch with a rounded flap, and peeking out of it one tiny cream felt flower with a green stem. Everything else regulation neat.',
  어깨배지: 'ONE small round butter-yellow felt badge is stitched onto the shoulder of the small navy body, the only mark of rank anywhere. Everything else plain.',
  가슴선: 'ONE clean horizontal line of cream running stitch crosses the chest of the small navy body, like a sewn-on strap. Nothing else — no pockets, no badges.',
};

/* 정면판 전용 금지 — 위 금지에 «비스듬 금지»를 얹는다. 금지 덩어리는 얼굴·무기를 실제로
 *   막아 왔으니(60장 전량) 각도도 여기에 걸면 먹는다. 탁자 금지도 여기서 한 번 더 못 박는다. */
const 정면금지 = `NO human face, no human skin, no eyes, no mouth, no nose, no hair.
No text, no letters, no numbers, no logo, no watermark, no weapons of any kind, no gun,
no blade, no blood, no menace. Nothing scary.
NO three-quarter view, NO side view, NO angled view, NO turned body, NO tilted head,
NO twisted torso, NO profile. Not a casual snapshot — a straight catalogue front view.
The helmet COVERS THE WHOLE HEAD like a smooth closed dome. Nothing of a head shows below
it — no face, no chin, no cheeks, no jaw, no neck, no stitch or mark that could read as a
mouth or a nose. The ONLY features anywhere on this character are the two glowing lenses
set into the helmet itself.
Do not show a table, a tabletop, a wooden surface, a floor, a room, a wall or any scenery.
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

  /* 🔑 09-05 — 유호님이 「우리가 쓰는 버터 노란색으로도」를 부르셨다(전체 20장).
   *   위 두 결(남색·민트)은 «노랑»을 악센트로 다섯 자리에 넣어 물었다. 몸이 버터가 되면 그
   *   물음이 성립하지 않는다(노랑 위의 노랑은 안 보인다). ⇒ 악센트 자리를 «남색»이 맡는다.
   *   그러면 다섯 갈래(없음·눈테·배지·주머니·진하게)는 그대로라 줄끼리 견줄 수 있다.
   *   킷 값 = Butter #F5C445 · Soft #FFEBB0 · Deep #7E5A10(DESIGN.md 보상 실). */
  {
    이름: '정면5a_버터_민무늬', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['Butter.png', 'ButterSoft.png', 'Chalk.png', 'Lapis.png'],
    옷: `Warm butter-yellow felt, the colour of soft golden custard, with the huge helmet and
two cool pale-blue glowing lenses that read clearly against the yellow. Absolutely minimal —
no badges, no pouches, no scarf, only one fine cream running stitch along the helmet rim.`,
  },
  {
    이름: '정면5b_버터_남색테', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['Butter.png', 'Lapis.png', 'Chalk.png', 'ButterSoft.png'],
    옷: `Warm butter-yellow felt with the huge helmet and two cream-white glowing lenses, each
ringed by a thick DEEP NAVY stitched rim. A matching thin navy line along the bottom hem of
the tiny body. No scarf.`,
  },
  {
    이름: '정면5c_버터_남색배지', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['Butter.png', 'LapisDeep.png', 'Chalk.png', 'ButterSoft.png'],
    옷: `Warm butter-yellow felt with the huge helmet and two cool pale-blue glowing lenses.
One small round DEEP NAVY felt badge stitched onto the shoulder of the tiny body, the only
mark of rank anywhere. Everything else plain. No scarf.`,
  },
  {
    이름: '정면5d_버터_꽃주머니', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['Butter.png', 'Chalk.png', 'Meadow.png', 'ButterSoft.png'],
    옷: `Warm butter-yellow felt with the huge helmet and two cream-white glowing lenses. On the
front of the tiny body sits one small cream felt pouch with a rounded flap, and peeking out of
it one tiny felt flower with a green stem. Everything else regulation neat. No scarf.`,
  },
  {
    이름: '정면5e_버터_진하게', 몸덮기: 큰헬멧몸, 성격덮기: 렌즈둘성격, 카메라덮기: 정면카메라,
    참조: ['ButterDeep.png', 'Butter.png', 'Chalk.png', 'Lapis.png'],
    옷: `Deeper honey-gold felt, richer and more grounded than a pale butter, with the huge
helmet and two cream-white glowing lenses that glow strongly against the gold. Plain body,
one fine cream stitch line. No scarf.`,
  },

  /* ── 확정 격자 20 (헬멧 5 × 장식 4) — 위 §확정 묶음 머리말 참조 ───────────────────── */
  ...Object.entries(헬멧들).flatMap(([헬멧이름, 헬멧], hi) =>
    Object.entries(장식들).map(([장식이름, 장식], di) => ({
      이름: `확정${hi + 1}${'abcd'[di]}_${헬멧이름}_${장식이름}`,
      확정: true, 크기: '4K',
      몸덮기: 큰헬멧몸, 성격덮기: 확정얼굴, 카메라덮기: 확정카메라,
      참조: ['Lapis.png', 'LapisDeep.png', 'Butter.png', 'Chalk.png'],
      옷: `Deep NAVY felt throughout (kit Lapis #3D6BC9 — a true deep blue, not black and not
purple), with the oversized helmet and two glowing butter-yellow lenses.
HELMET: ${헬멧}
BODY: ${장식}`,
    })),
  ),

  /* ── 확정 덧판 3 (09-05) — 유호님이 «옛 2K 판» 셋을 짚으셨다(「이 나머지도 하나씩 띄워줘」).
   *   그 셋은 탁자·베이지 배경이라 배경을 못 걷어 정본 규격이 아니다. 같은 생김새를 확정 규격
   *   (4K · 순백 · 그림자 0)으로 옮겨 심는다 — 고르시면 그대로 정본이 되도록. */
  {
    이름: '확정6a_두색_밝은파랑', 확정: true, 크기: '4K',
    몸덮기: 큰헬멧몸, 성격덮기: 확정얼굴, 카메라덮기: 확정카메라,
    참조: ['Lapis.png', 'Oat.png', 'Chalk.png', 'Butter.png'],
    옷: `TWO-TONE — this one is not navy all over. The oversized helmet is a BRIGHT MID-BLUE
felt (kit Lapis #3D6BC9, clearly lighter than navy), with one fine seam running over the crown
and a line of cream running stitch around its lower rim. The small body underneath is a warm
OATMEAL cream felt, a completely different colour from the helmet, with visible cream stitching
down its sides. On the front of that oatmeal body sits one oatmeal pouch with a rounded flap,
and peeking out of it one tiny white felt flower with a green stem.`,
  },
  {
    이름: '확정6b_어깨끈주머니', 확정: true, 크기: '4K',
    몸덮기: 큰헬멧몸, 성격덮기: 확정얼굴, 카메라덮기: 확정카메라,
    참조: ['LapisDeep.png', 'Lapis.png', 'Oat.png', 'Butter.png'],
    옷: `Deep NAVY felt throughout, with one perfectly smooth unbroken helmet dome — no seam,
no rim, no stitching anywhere on the helmet.
LENSES sit FLUSH in the felt with NO stitched rim around them — just two clean glowing discs.
BODY: a small oatmeal felt satchel hangs on the front from a thin oatmeal SHOULDER STRAP that
crosses the chest, with a rounded flap and a tiny stitched knot; one small white felt flower
with a green stem peeks out beside it.`,
  },
  {
    이름: '확정6c_노랑테_크림렌즈', 확정: true, 크기: '4K',
    몸덮기: 큰헬멧몸, 성격덮기: 확정얼굴, 카메라덮기: 확정카메라,
    참조: ['LapisDeep.png', 'Butter.png', 'Chalk.png', 'Lapis.png'],
    옷: `Deep NAVY felt throughout, with the oversized helmet coming down at the sides so it
frames the lens area like a hood.
LENSES — override the colour above: each lens is a soft CREAM-WHITE felt disc, and each is
ringed by a thick BUTTER-YELLOW blanket stitch that goes all the way around. The cream centre
and the yellow ring are what make this one different.
BODY: plain navy, with one thin butter-yellow line of stitching across the very bottom of each
foot. Nothing else.`,
  },
  /* 🔑 09-05 — 확정6a(두 색)가 «몸과 머리가 갈려» 작게 줄여도 안 뭉개진다는 것이 견줌에서
   *   드러났다. 다만 헬멧이 밝은 파랑이라 코랄·검정과의 대비가 남색보다 약하다(색 판정의 근거).
   *   ⇒ 둘을 다 가지는 판 = «짙은 남색 헬멧 + 크림 몸». 격자에 없던 자리다. */
  {
    이름: '확정7_남색헬멧_크림몸', 확정: true, 크기: '4K',
    몸덮기: 큰헬멧몸, 성격덮기: 확정얼굴, 카메라덮기: 확정카메라,
    참조: ['LapisDeep.png', 'Oat.png', 'Chalk.png', 'Butter.png'],
    옷: `TWO-TONE — this one is not one colour all over. The oversized helmet is DEEP NAVY felt
(kit Lapis Deep #24448C — a dark, serious blue, clearly darker than a mid blue), with one fine
seam running over the crown and a line of cream running stitch around its lower rim. The small
body underneath is a warm OATMEAL cream felt, a completely different and much lighter colour
than the helmet, with visible cream stitching down its sides — so the head and the body read as
two clearly separate blocks even at a very small size. On the front of that oatmeal body sits
one oatmeal pouch with a rounded flap, and peeking out of it one tiny white felt flower with a
green stem.`,
  },

  /* 🏭 09-05 유호 지시 「공장에서 발주넣기 편하도록 자수를 최소화 해보는거 어때?」
   *   봉제 공장에서 값을 올리는 것은 셋이고 결이 다르다:
   *     · 자수(선) = «스티치 개수»로 값이 매겨진다 ⇒ 선이 길수록 그대로 비싸진다
   *     · 재단(색면) = 조각을 잘라 꿰매는 것이라 «싸다» ⇒ 두 색은 값이 거의 안 오른다
   *     · 작은 부품(꽃·주머니) = 기계가 못 해서 «사람이 손으로» 붙인다 ⇒ 제일 비싸다
   *   그래서 두 단계로 걷어 견준다 — 선만 뺀 판(부품은 남김)과 선·부품 다 뺀 판. */
  {
    이름: '확정8a_두색_선없음', 확정: true, 크기: '4K',
    몸덮기: 큰헬멧몸, 성격덮기: 확정얼굴, 카메라덮기: 확정카메라,
    참조: ['LapisDeep.png', 'Oat.png', 'Chalk.png', 'Butter.png'],
    옷: `TWO-TONE, and DELIBERATELY FREE OF STITCHING. The oversized helmet is DEEP NAVY felt
(kit Lapis Deep #24448C), one perfectly smooth unbroken dome — no seam over the crown, no
stitched rim, no blanket stitch, no running stitch, no visible thread anywhere on the helmet.
The small body underneath is warm OATMEAL cream felt, a completely different and much lighter
colour, also with NO stitching down its sides. The two colours meet in one clean edge — the
colour change alone separates head from body, no thread is needed to mark it.
On the front of the oatmeal body sits one oatmeal pouch with a rounded flap and one tiny white
felt flower with a green stem. The pouch has NO stitched outline either — it is a clean cut
shape of felt laid on.`,
  },
  {
    이름: '확정8b_두색_선없음_민몸', 확정: true, 크기: '4K',
    몸덮기: 큰헬멧몸, 성격덮기: 확정얼굴, 카메라덮기: 확정카메라,
    참조: ['LapisDeep.png', 'Oat.png', 'Chalk.png', 'Butter.png'],
    옷: `TWO-TONE, and as SIMPLE AS IT CAN POSSIBLY BE. The oversized helmet is DEEP NAVY felt
(kit Lapis Deep #24448C), one perfectly smooth unbroken dome — no seam, no rim, no stitching,
no visible thread anywhere. The small body underneath is warm OATMEAL cream felt, a completely
different and much lighter colour, also perfectly plain. The two colours meet in one clean
edge and that is the only division on the whole figure.
NO pouch, NO flower, NO badge, NO pocket, NO strap, NO stitching of any kind. Nothing is laid
on top of anything. The entire character is exactly three shapes: a navy helmet, a cream body
with two little arms and two little feet, and two glowing lenses.`,
  },

  /* 🍼 09-05 유호 지시 「가운데 버전을 조금 더 귀엽게 만들어줄수있어?」
   *   「귀엽게」를 손잡이로 바꾼다 — 형용사는 안 서기 때문이다(오늘 세 번 밟았다).
   *   아기처럼 보이게 하는 것은 정해져 있다(아기 도식):
   *     ⓐ 눈이 얼굴 «아래쪽»에 있다 — 지금 판은 눈이 헬멧 위쪽에 붙어 있다
   *     ⓑ 눈이 크다 · ⓒ 머리가 몸에 비해 크다 · ⓓ 팔다리가 짧고 뭉툭하다
   *   축을 둘로 갈라 굽고(눈 · 몸), 합친 판과 더 센 판을 붙여 네 단계로 견준다. */
  {
    이름: '귀엽1_눈크게아래로', 확정: true, 크기: '4K',
    몸덮기: 큰헬멧몸, 카메라덮기: 확정카메라,
    참조: ['LapisDeep.png', 'Oat.png', 'Chalk.png', 'Butter.png'],
    성격덮기: `EXPRESSION: completely deadpan and unreadable. Instead of eyes it has TWO round
LENSES side by side, glowing with a calm warm BUTTER-YELLOW light (#F5C445). Simple glowing
circles — no pupils, no eyelids, no eyebrows, no mouth, no expression of any kind.

SIZE AND PLACEMENT — this is what makes it read as a baby:
· Each lens is about ONE THIRD of the helmet's width. They are BIG.
· They sit LOW on the helmet — their centres are about TWO THIRDS of the way down the helmet's
  height, close to its bottom edge, not up in the middle. A baby's eyes sit low in its face.
· They are set wide: the two lenses plus the gap between them span most of the helmet's width.
· Both are exactly level, exactly the same size, equally bright.

Each lens is SET INTO the felt, sunk so LESS THAN HALF of its curve shows, with the felt
rising softly against its rim. 🔴 The lens never breaks the outline of the helmet.
Posture upright, standing at attention. Serious and dutiful, quietly warm underneath.`,
    옷: `TWO-TONE and FREE OF STITCHING. The oversized helmet is DEEP NAVY felt (kit Lapis Deep
#24448C), one perfectly smooth unbroken dome — no seam, no rim, no visible thread anywhere.
The small body underneath is warm OATMEAL cream felt, much lighter, also unstitched; the two
colours meet in one clean edge. On the front of the body sits one oatmeal pouch with a rounded
flap (no stitched outline) and one tiny white felt flower with a green stem.`,
  },
  {
    이름: '귀엽2_머리더크게', 확정: true, 크기: '4K',
    성격덮기: 확정얼굴, 카메라덮기: 확정카메라,
    참조: ['LapisDeep.png', 'Oat.png', 'Chalk.png', 'Butter.png'],
    몸덮기: `BODY SHAPE — exaggerated baby proportions, pushed further than usual:
The rounded helmet takes up nearly TWO THIRDS of the whole figure's height. Under it the body
is very SMALL, SHORT and ROUND — a squat little dumpling, wider than it is tall, with a gently
scalloped hem. The two arms are very short and stubby, like little mittens, barely longer than
they are wide. The two feet are small and round and set close together. Nothing about the body
is long or slim. It is a soft doll wearing gear, NOT a robot and NOT a human figure.
Cute and huggable first, soldier second.`,
    옷: `TWO-TONE and FREE OF STITCHING. The oversized helmet is DEEP NAVY felt (kit Lapis Deep
#24448C), one perfectly smooth unbroken dome — no seam, no rim, no visible thread anywhere.
The small body underneath is warm OATMEAL cream felt, much lighter, also unstitched; the two
colours meet in one clean edge. On the front of the body sits one oatmeal pouch with a rounded
flap (no stitched outline) and one tiny white felt flower with a green stem.`,
  },
];

/* 셋째·넷째는 위 둘을 합친 것이라 «같은 문면»을 다시 안 쓴다 — 두 곳이 같은 말을 들면 갈린다. */
판들.push(
  {
    이름: '귀엽3_둘다', 확정: true, 크기: '4K',
    카메라덮기: 확정카메라,
    참조: ['LapisDeep.png', 'Oat.png', 'Chalk.png', 'Butter.png'],
    성격덮기: 판들.find((p) => p.이름 === '귀엽1_눈크게아래로').성격덮기,
    몸덮기: 판들.find((p) => p.이름 === '귀엽2_머리더크게').몸덮기,
    옷: 판들.find((p) => p.이름 === '귀엽1_눈크게아래로').옷,
  },
  {
    이름: '귀엽4_더세게', 확정: true, 크기: '4K',
    카메라덮기: 확정카메라,
    참조: ['LapisDeep.png', 'Oat.png', 'Chalk.png', 'Butter.png'],
    성격덮기: `EXPRESSION: completely deadpan and unreadable. Instead of eyes it has TWO round
LENSES side by side, glowing with a calm warm BUTTER-YELLOW light (#F5C445). Simple glowing
circles — no pupils, no eyelids, no eyebrows, no mouth, no expression of any kind.

SIZE AND PLACEMENT — pushed as far as it can go while staying tasteful:
· Each lens is about TWO FIFTHS of the helmet's width. They are very big and take over the face.
· They sit LOW — their centres are about THREE QUARTERS of the way down the helmet's height,
  almost at its bottom edge.
· Together with the gap they span almost the whole width of the helmet, leaving only a thin
  navy margin at each side.
· Both exactly level, exactly the same size, equally bright.

Each lens is SET INTO the felt, sunk so LESS THAN HALF of its curve shows.
🔴 The lens never breaks the outline of the helmet.
Posture upright, standing at attention. Serious and dutiful, quietly warm underneath.`,
    몸덮기: `BODY SHAPE — the most exaggerated baby proportions of all:
The rounded helmet takes up nearly THREE QUARTERS of the whole figure's height, so the doll is
almost all head. Under it peeks a tiny SHORT ROUND body, clearly wider than it is tall, with a
softly scalloped hem. The arms are tiny stubs. The feet are two small round bumps set close
together, barely showing. Nothing is long or slim anywhere. It is a soft doll wearing gear,
NOT a robot and NOT a human figure. Cute and huggable first, soldier second.`,
    옷: 판들.find((p) => p.이름 === '귀엽1_눈크게아래로').옷,
  },
);

/* 😠 09-05 유호 지시 「눈을 좀 무섭게 해보는건 어떨까? 반전매력으로 꽃이 있어서 괜찮을것같은데」
 *   결을 고른다 — 마린은 «무표정한 다정이»(가이드_정본 §성격)라 «화난» 눈이 아니라 «엄격한»
 *   눈이어야 한다. 처음 결(스파르타 선생님 · 우주해병)과도 그쪽이 이어진다.
 *   🔴 학생 접점이라 상한이 있다: 위협이 아니라 «규율»까지. 그래서 금지 문면의
 *      「nothing scary」는 「stern, never threatening」으로 낮춰 갈아 낀다(빼지 않는다).
 *   몸·주머니·꽃은 «그대로» 둔다 — 반전이 성립하려면 무서운 눈 옆에 꽃이 있어야 한다. */
const 엄격금지 = 확정금지
  .replace('no blade, no blood, no menace. Nothing scary.',
    'no blade, no blood. The look is STERN and disciplined — never threatening, never cruel, never evil; a strict teacher, not a villain.');

const 무섭바탕 = {
  확정: true, 크기: '4K', 카메라덮기: 확정카메라, 금지덮기: 엄격금지,
  참조: ['LapisDeep.png', 'Oat.png', 'Chalk.png', 'Butter.png'],
  몸덮기: 판들.find((p) => p.이름 === '귀엽2_머리더크게').몸덮기,
  옷: 판들.find((p) => p.이름 === '귀엽1_눈크게아래로').옷,
};

const 엄격얼굴 = (모양) => `EXPRESSION: completely deadpan and unreadable, but STERN.
Instead of eyes it has TWO LENSES side by side, glowing with a warm BUTTER-YELLOW light
(#F5C445). No pupils, no eyelids, no eyebrows, no mouth.

SHAPE — this is the whole point of this version: ${모양}

PLACEMENT: the two lenses sit LOW on the helmet, their centres about two thirds of the way
down its height, set wide apart, exactly level with each other and exactly the same size and
brightness. Together they span most of the helmet's width.

Each lens is SET INTO the felt, sunk so LESS THAN HALF of its curve shows, with the felt
rising softly against its rim. 🔴 The lens never breaks the outline of the helmet.
Posture upright, standing at attention. Strict and dutiful, quietly warm underneath.`;

판들.push(
  { ...무섭바탕, 이름: '엄격1_눈꼬리', 성격덮기: 엄격얼굴(
    `each lens is a rounded shape whose OUTER top corner is drawn UP into a soft point, like an
almond tilted upward — the inner edge stays low and round, the outer edge lifts. The pair
therefore slants outward and upward, which reads as a firm, no-nonsense look. The felt of the
helmet is cut in that same tilted shape around each lens.`) },
  { ...무섭바탕, 이름: '엄격2_가로슬릿', 성격덮기: 엄격얼굴(
    `each lens is a NARROW HORIZONTAL SLIT — a long thin capsule shape with rounded ends, about
three times wider than it is tall, like a visor slot. Calm, machine-like and unreadable. The
felt is cut in that same long thin shape around each slit.`) },
  { ...무섭바탕, 이름: '엄격3_내려보는눈', 성격덮기: 엄격얼굴(
    `each lens has a FLAT, straight TOP edge and a fully ROUND bottom — a half-moon lying with
its flat side up, as if the eye were half-lidded and looking down at you. Steady and appraising.
The felt is cut in that same half-moon shape around each lens.`) },
  { ...무섭바탕, 이름: '엄격4_살짝만', 성격덮기: 엄격얼굴(
    `each lens is still basically ROUND and big, but its top edge is very slightly flattened and
its outer corner lifts just a little — barely enough to notice. Almost the friendly round eye,
with one degree of firmness added. This is the gentlest version.`) },
);

/* 🟦 09-05 유호 지시 「엄격한 버전을 여러개 만들어줘 아까 하늘색?파란색 느낌도 예쁘던데
 *   여러버전으로 10개 만드러줘」
 *   색 5 × 눈 2 = 10. 색을 넉넉히 두는 까닭 = 유호님 관심이 그쪽이다(「하늘색?파란색」).
 *   눈은 앞 네 결 중 살아남은 둘만 쓴다 — 반달(단단하되 안 무섭다)과 눈꼬리 약하게. */
const 헬멧색들 = {
  짙은남색: 'a DEEP NAVY felt (kit Lapis Deep #24448C) — dark, serious, almost the colour of a night sky',
  진한파랑: 'a RICH DARK BLUE felt, clearly lighter than navy but still deep — the blue of well-worn denim',
  청금석: 'a CLEAR MID BLUE felt (kit Lapis #3D6BC9) — a bright, confident cornflower blue',
  연한하늘: 'a SOFT LIGHT SKY-BLUE felt, gentle and pale, clearly lighter than a mid blue but still obviously blue against the cream body',
  아주연한: 'a VERY PALE POWDER-BLUE felt (kit Lapis Soft #C5D6F5) — the palest blue that still reads as blue, almost a tint',
};
const 엄격눈들 = {
  반달: `each lens has a FLAT, straight TOP edge and a fully ROUND bottom — a half-moon lying
with its flat side up, as if the eye were half-lidded and looking down at you. Steady and
appraising. The felt is cut in that same half-moon shape around each lens.`,
  눈꼬리: `each lens is a rounded shape whose OUTER top corner lifts into a soft point — an
almond tilted gently upward, with the inner edge staying low and round. Just enough slant to
read as firm; not angry, not a scowl. The felt is cut in that same tilted shape around it.`,
};

판들.push(
  ...Object.entries(헬멧색들).flatMap(([색이름, 색], ci) =>
    Object.entries(엄격눈들).map(([눈이름, 눈], ei) => ({
      ...무섭바탕,
      이름: `색눈${ci + 1}${'ab'[ei]}_${색이름}_${눈이름}`,
      성격덮기: 엄격얼굴(눈),
      옷: `TWO-TONE and FREE OF STITCHING. The oversized helmet is ${색}, one perfectly smooth
unbroken dome — no seam, no rim, no stitched edge, no visible thread anywhere on it.
The small body underneath is warm OATMEAL cream felt, clearly lighter and warmer than the
helmet, also completely unstitched; the two colours meet in one clean edge, and that colour
change alone separates head from body.
On the front of the body sits one oatmeal pouch with a rounded flap (no stitched outline) and
one tiny white felt flower with a green stem peeking out of it.`,
    })),
  ),
);

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
  const 확정만 = argv.includes('--확정');   // 정본을 고르는 스무 판만 (4K)
  const 대상 = 하나 ? 판들.filter((_, i) => i + 1 === 하나)
    : 확정만 ? 판들.filter((p) => p.확정)
      : 판들;
  if (!대상.length) { console.error(`--판 은 1~${판들.length} 다`); process.exit(1); }

  /* 🔴 09-05 — 이 두 줄이 «양쪽 다» 어긋나 있었다. 옆 셋(공방·라디오무대·펠트색)은 맞게 부른다.
   *   ⓐ `배치게이트(장수, 크기)` 는 자리 인자인데 꾸러미를 줘서 장수가 객체로 들어갔다
   *      ⇒ 값 안내가 `[object Object]장 × 1K ≈ $NaN` 으로 찍혔다(크기 '2K' 도 안 먹었다).
   *   ⓑ 게이트는 참/거짓을 돌려주는데 `.멈춤` 을 봤다 ⇒ 언제나 undefined 라 **막힌 적이 없다.**
   *      게이트가 「한 장도 안 굽는다(0원)」를 찍어도 그대로 구우러 갔다. 거짓 초록의 그 무늬다. */
  /* 판마다 크기가 다를 수 있다(확정 묶음은 4K). 값은 «비싼 쪽»으로 알린다 — 게이트가 덜 부르면
   *   그건 안심시키는 거짓말이 된다. */
  const 큰크기 = 대상.some((p) => p.크기 === '4K') ? '4K' : '2K';
  if (!(await 배치게이트(대상.length, 큰크기))) { process.exitCode = 3; return; }

  fs.mkdirSync(낼곳, { recursive: true });
  const k = 키();
  let 구움 = 0, 건너뜀 = 0, 연속실패 = 0;
  const 다시 = argv.includes('--다시');
  const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

  for (const [i, 판] of 대상.entries()) {
    const 저장경로 = path.join(낼곳, `${판.이름}.png`);
    if (fs.existsSync(저장경로) && !다시) { 건너뜀 += 1; console.log(`⏭  ${판.이름} — 이미 있다(--다시 면 다시 굽는다)`); continue; }
    /* 🔴 09-05 — 「카메라덮기」가 있는 판(= 정면판)은 조립 «순서»가 다르다. 카메라가 맨 앞에
     *   서야 장면이 그 말대로 세워진다. 뒤에 두면 앞의 `재질`(탁자)이 이긴다는 것을 실측했다.
     *   그 판은 재질·금지도 정면 전용으로 갈아 낀다(같은 말을 두 곳이 다르게 하지 않도록). */
    const 지시 = 판.확정
      ? [확정카메라, 확정재질, 판.몸덮기, 판.성격덮기, 판.옷, 판.금지덮기 || 확정금지].join('\n\n')
      : 판.카메라덮기
        ? [판.카메라덮기, 정면재질, 판.몸덮기 || 몸, 판.성격덮기 || 성격, 판.옷, 정면금지].join('\n\n')
        : [재질, 판.몸덮기 || 몸, 판.성격덮기 || 성격, 판.옷, 카메라, 금지].join('\n\n');
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
        const r = await 한컷({ 이름: 판.이름, 지시, 참조: 참조경로(판.참조), 비율: '1:1', 크기: 판.크기 || '2K', 저장경로, k });
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
