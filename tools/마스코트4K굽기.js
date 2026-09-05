#!/usr/bin/env node
/**
 * 마스코트4K굽기 — 몽글·까몽 정본을 4K 로 «다시» 굽는다 (2026-09-05).
 *
 * 왜 있나 (유호 지시 09-05):
 *   「우리가 쓰던 까몽이랑 몽글이랑 전부 제미나이 버전으로 4K 로 다시 만들자.
 *    저번에 무슨 양식이 달라서 몽글이는 어렵다고 했었거든. 반대로 까몽이는 된다고 했었고.
 *    지금 그거 해결할 겸 해상도도 키워서 활용성을 훨씬 더 키우자는 거야.
 *    나중에 되돌리면 훨씬 어려우니까」
 *
 * 🔑 **해상도는 곁가지다 — 진짜 값은 «양식을 하나로 만드는 것»이다.**
 *   지금 두 정본은 만들어진 방식이 다르다:
 *     · 까몽 = 블렌더 렌더 ⇒ 표정을 새로 «렌더»하면 얼마든지 나온다
 *     · 몽글 = 펠트 실물 «사진» ⇒ 새 표정은 실물을 다시 만들어 다시 찍어야 한다
 *   그래서 앱의 표정 컷이 몽글 5 · 까몽 9 로 «주연이 조연보다 밋밋한» 역전이 났다
 *   (결정 원장 09-02 의 그 자리). 둘 다 제미나이로 옮기면 그 벽이 사라진다.
 *
 * 🔴 이것은 «확대»가 아니라 «새 정본»이다. 픽셀이 같지 않다(09-05 시험 실측 — 같은
 *   캐릭터로 읽히되 눈 높이·보풀 양이 달랐다). 그래서 이 도구가 내는 것은 후보이고,
 *   정본 교체는 유호님이 보시고 승인하신 «뒤에» 별도로 한다(마스코트자산.js·토큰).
 *
 * 🔑 문면 순서 규율 (09-05 마린·몽글에서 두 번 실측):
 *   **맨 앞에 선 덩어리가 장면을 정한다.** 카메라·자세를 뒤에 두면 앞의 재질 문장이
 *   이긴다. 그래서 카메라가 언제나 첫째다.
 *
 * ⚠ 돈이 든다 — 4K 한 장 ≈ 336원. 15장 ≈ 5,040원. `배치게이트` 가 굽기 «전»에 총액을 찍는다.
 * ⚠ 분당 한도(429)가 있다. 벽에 대고 두드리면 벽이 «길어지므로»(09-05 실측) 사이를 30초 두고,
 *   막히면 길게 쉬고 두 번만, 세 판이 잇달아 막히면 멈춘다.
 * ⚠ 흰 배경이 붙어 나온다 — 굽고 나서 `python tools/흰배경걷기.py <파일>` 로 걷는다.
 *   (이 도구가 자동으로 부르지 않는다: 원본을 남겨 두어야 다른 임계로 다시 걷을 수 있다.)
 *
 * 사용:
 *   node tools/마스코트4K굽기.js                 전량(15장)
 *   node tools/마스코트4K굽기.js --누구 몽글      몽글만(5장)
 *   node tools/마스코트4K굽기.js --판 3          셋째 하나만
 *   node tools/마스코트4K굽기.js --다시          이미 있는 것도 다시
 */
const fs = require('fs');
const path = require('path');
const { 키, 한컷, 배치게이트 } = require('./lib/이미지굽기');

const ROOT = path.join(__dirname, '..');
/* 🔴 09-05 저녁 — 몽글 참조를 «옛 세대»에서 정본_4K 로 옮겼다(유호 「몽글이 표정 넷도 만들어줘」).
 *   그전에는 `펠트코랄_0815`(사진 세대)를 참조로 삼았는데, 그 판은 그날 정본에서 내려갔다.
 *   옛 몸을 참조로 새 표정을 구우면 «옛 몸에 새 얼굴»이 나오고, 그것이 정본에 서면 같은
 *   캐릭터가 두 몸을 갖는다. 마린이 처음부터 정본_4K 를 참조하는 것과 같은 규율이다.
 *   ⚠ 까몽은 아직 옛 폴더를 본다 — 까몽 10컷이 이미 다 서 있어 다시 구울 일이 없어서
 *     건드리지 않았다. 까몽을 다시 구울 날이 오면 여기도 같이 옮긴다. */
const 몽글정본 = path.join(ROOT, 'docs/캐릭터/정본_4K');
const 까몽정본 = path.join(ROOT, 'docs/캐릭터/친구공방_0825');
const 낼곳 = path.join(ROOT, 'docs/캐릭터/정본_4K_후보');

/* ── 어디에서나 같은 것 ─────────────────────────────────────────── */

const 배경 = `BACKGROUND: one single flat PURE WHITE field filling the entire frame edge to
edge, perfectly even. No gradient, no vignette, no panels, no rectangles, no patches, no
seams, no texture, no scenery, and NO CAST SHADOW anywhere in the frame. The character floats
in mid air, weightless, with nothing under it — no table, no floor, no wall, no surface.`;

const 금지 = `No text, no letters, no numbers, no logo, no watermark, no props, no hands,
no second object, no border, no frame. Nothing scary.`;

/* 🔴 09-05 유호 교정 「전체적으로 옆모습 보면 눈이 너무 튀어나왔어 몽글이든 까몽이든」.
 *   첫 판 실측: 돌아간 판에서 «먼 쪽» 눈이 머리 윤곽 «밖»으로 삐져나왔다 — 머리에 구슬을
 *   붙여 놓은 꼴이다. 까닭 = 「박아 넣는다」고만 쓰고 «얼마나 깊이»를 안 적었다.
 *   ⇒ 셋을 숫자와 규칙으로 못 박는다:
 *     ⓐ 구의 «절반 아래»만 보인다(반구가 아니라 그보다 얕게)
 *     ⓑ 윤곽을 «절대» 깨지 않는다 — 이것이 판정 규칙이다
 *     ⓒ 돌아가면 먼 쪽 눈은 «타원»이 된다(튀어나온 공은 각도가 변해도 원으로 남는다) */
const 눈박힘 = `HOW THE EYE SITS — read this carefully, the first attempt got it wrong:
The eye is SET DEEP INTO the surface, not glued on top of it. It is sunk in so that LESS THAN
HALF of the sphere shows — a shallow cap, not a ball. The surrounding material rises in a soft
ring right up against its rim, slightly overlapping the edge of the eye all the way around.
🔴 THE EYE NEVER BREAKS THE OUTLINE OF THE HEAD. At every angle its silhouette stays well
inside the silhouette of the body — it must never bulge out past the edge, never stick out
sideways, never read as a bead stuck onto the side. When the character is turned, the far eye
is FORESHORTENED by the curve of the head and reads as a narrow ELLIPSE, squeezed horizontally
— it is NOT a full circle. A protruding ball would stay circular; this one must not.`;

/* ── 몽글 ───────────────────────────────────────────────────────── */

const 몽글카메라 = `CAMERA AND POSE — THIS IS THE MOST IMPORTANT INSTRUCTION:
A dead-on, perfectly frontal product photograph. The camera sits exactly at the doll's own
height and exactly on its centre line. The doll faces the lens straight on, square to the
camera. The picture is bilaterally symmetrical: mirror the left half onto the right half and
it matches. We see the FRONT only — no side of the body, no turn, no tilt, no rotation.`;

/* 좌34·우34 는 «살짝만» 돌린다 — 정본의 두 판도 거의 정면에 가깝다(09-05 실측). */
const 몽글카메라34 = (쪽) => `CAMERA AND POSE — THIS IS THE MOST IMPORTANT INSTRUCTION:
A three-quarter product photograph, turned only SLIGHTLY. The doll turns about 20 degrees to
its own ${쪽}, no more — this is a gentle turn, not a side view. The camera stays at the doll's
own height. Both eyes stay clearly visible and the far eye sits a little closer to the edge of
the body. No tilt of the head, no rotation of the picture.`;

const 몽글몸 = `WHAT IT IS: a handmade needle-felted wool doll shaped like a tiny ghost.
A smooth rounded dome head flows without a neck into a bell-shaped body that widens to a
scalloped bottom hem of five soft rounded scallops. There are no arms and no legs — the
silhouette is one continuous bell.

MATERIAL: felted merino wool in a warm CORAL colour (#F96859 — a soft warm red-orange, not
salmon pink and not scarlet), softly heathered so paler and deeper coral fibres mix. Dense
visible fibre fuzz over the whole surface, with fine stray hairs catching the light along the
top edge. One line of cream running stitch in real embroidery floss follows the scalloped hem
around every curve.`;

const 몽글빛 = `LIGHT: soft even studio light from the upper left with a gentle rim light along
the top edge. Shallow depth of field so the fibre detail on the front of the doll is razor
sharp. Museum-quality fibre-art photography, extremely high detail in the wool fibres and the
stitching.`;

/* 몽글용 «설명을 끼우는» 얼굴 틀 (2026-09-05 · 감정 여섯을 넣으면서 지었다).
 *   까몽에는 `까몽눈뜸(설명)`·`까몽눈선(설명)` 이, 마린에는 `마린얼굴(설명)` 이 있었는데
 *   몽글만 «상수 셋»뿐이라 새 표정마다 긴 문면을 통째로 다시 써야 했다. 셋이 같은 규율을 쓰게 한다.
 * ⚠ 아래 상수 셋(눈뜸·눈감음·눈웃음)은 «부르는 자리가 이미 여럿»이라 그대로 둔다 — 함수로 바꾸면
 *   그 자리가 전부 깨진다(한 값을 두 곳이 아는 병을 피하려다 더 큰 것을 부순다). */
const 몽글눈 = (설명) => `FACE: exactly two eyes and nothing else. ${설명}
${눈박힘}
The two sit at exactly the same height, level with each other, in the upper third of the doll,
set WIDE APART — the gap between them is about one third of the doll's full width.
No mouth, no nose, no eyebrows, no blush, no cheeks, no other feature.`;

const 몽글눈뜸 = `FACE: exactly two eyes and nothing else. Each eye is a small perfectly round
glossy BLACK bead, smooth and shiny like polished glass with one tiny white highlight.
${눈박힘}
The two beads sit at exactly the same height, level with each other, in the upper third of the
doll. They are set WIDE APART — the gap between them is about one third of the doll's full
width. No mouth, no nose, no eyebrows, no blush, no cheeks, no other feature.`;

const 몽글눈감음 = `FACE: exactly two closed eyes and nothing else. Each eye is a single curved
line of dark brown embroidery thread, stitched into the felt, curving gently DOWNWARD like a
shallow smile lying on its back — the shape of a sleeping eye. The two curves sit at exactly
the same height, level with each other, in the upper third of the doll, set wide apart with a
gap of about one third of the doll's width. No beads anywhere. No mouth, no nose, no eyebrows,
no blush, no other feature.`;

const 몽글눈웃음 = `FACE: exactly two happy closed eyes and nothing else. Each eye is a single
line of dark brown embroidery thread stitched into the felt in a clean UPWARD peak, like the
letter A without its crossbar, or a caret ^ — two straight strokes meeting at a point on top.
The two peaks sit at exactly the same height, level with each other, in the upper third of the
doll, set wide apart with a gap of about one third of the doll's width. No beads anywhere.
No mouth, no nose, no eyebrows, no blush, no other feature.`;

/* ── 까몽 ───────────────────────────────────────────────────────── */

const 까몽카메라 = `CAMERA AND POSE — THIS IS THE MOST IMPORTANT INSTRUCTION:
Photographed from DIRECTLY ABOVE, looking straight down. The creature lies spread out flat and
faces the camera, its whole body and face visible from this top-down view. It is centred and
symmetrical left to right: both front paws reach out to the sides at the same height, both
ears point up at the same angle. The head does not tilt and the picture is not rotated.`;

const 까몽카메라34 = (쪽) => `CAMERA AND POSE — THIS IS THE MOST IMPORTANT INSTRUCTION:
Photographed from DIRECTLY ABOVE, looking straight down, with the creature turned only
SLIGHTLY — about 20 degrees to its own ${쪽}, no more. Its whole body and face stay visible.
Both eyes stay clearly visible. The picture itself is not rotated and the head does not tilt.`;

const 까몽몸 = `WHAT IT IS: a very small, extremely fluffy creature like a round kitten,
made of dense soft dark fur. Its body is one rounded fluffy mass with two short triangular
ears on top and two small dark front paws reaching out to the sides. A slim dark tail curls
out from the lower right and ends in a rounded coral-pink paddle shape, like a small leaf or
fin, with a row of four tiny cream dots along it. There are no wings and no horns.

MATERIAL: very long soft charcoal-brown fur, almost black in the deep parts and warm grey
where the light catches the tips, so soft it looks like smoke at the edges. Thousands of fine
individual hairs stand out around the whole silhouette. The paws are darker and smoother than
the body fur. The coral tail-paddle is smooth matte felt.`;

const 까몽빛 = `LIGHT: soft even studio light from above with a gentle warm rim light picking
out the fur tips around the whole outline. Shallow depth of field so the fur detail on the
face is razor sharp while the outermost hairs go softly out of focus. Museum-quality creature
photography, extremely high detail in every individual hair.`;

/* 🔴 09-05 실측 — 본체·좌34·우34 에서 눈이 «작아졌다». 까몽의 표식은 큰 동그란 눈인데
 *   「large」라는 낱말만으로는 크기가 안 선다. ⇒ 머리 너비에 대한 «비율»로 못 박는다. */
const 까몽눈뜸 = (설명) => `FACE: exactly two eyes and nothing else. Each eye is a LARGE round
eye with a bright APPLE-GREEN iris ring around a big glossy black pupil, and one small round
white highlight in the upper left of the pupil.
SIZE — the first attempt made them too small: each eye is about ONE QUARTER of the head's
width. The two eyes plus the gap between them span roughly THREE QUARTERS of the head's width.
These are big, storybook-cute eyes that dominate the face.
🔴 BOTH EYES GLOW THE SAME: the apple-green iris ring is equally bright, equally saturated and
equally wide on the LEFT eye and on the RIGHT eye. Neither eye falls into shadow, neither
turns dark or loses its green. The reference photograph has one eye dimmer than the other —
that is a flaw in the old picture, do not copy it. Light the two eyes evenly.
${눈박힘}
${설명} There is only the faintest hint of a dark nose in the fur. No mouth, no whiskers,
no eyebrows, no blush, no other feature.`;

const 까몽눈선 = (설명) => `FACE: exactly two closed eyes and nothing else. Each eye is a single
curved line of bright APPLE-GREEN thread stitched into the fur. ${설명} No black pupils anywhere.
There is only the faintest hint of a dark nose in the fur. No mouth, no whiskers, no eyebrows,
no blush, no other feature.`;

/* ── 마린 (2026-09-05 신설) ──────────────────────────────────────────
 *
 * 🔑 생김새는 «이미 정해졌다» — 유호 확정 09-05 「이거로 가자」(결정 원장). 그래서 여기서는
 *   생김새를 다시 묻지 않고 «표정만» 만든다. 고르는 일은 `tools/마린굽기.js` 가 했고 그 문은
 *   닫혔다. 참조는 언제나 정본(`docs/캐릭터/정본_4K/마린_본체.png`) 하나다.
 *
 * 🔑 마린은 눈이 «렌즈»라 감기지 않는다. 그래서 표정을 «빛과 모양»으로 낸다 —
 *   가이드_정본 440줄이 그렇게 세워 두었다(「렌즈 밝기 2단 · 몰래 기쁨(렌즈 잔반짝)」).
 *   그 자리를 여기서 실물로 채운다. */
const 마린정본 = path.join(ROOT, 'docs/캐릭터/정본_4K');

const 마린카메라 = 몽글카메라;          // 정면 규칙이 같다 — 한 값을 두 곳이 들지 않는다
const 마린카메라34 = 몽글카메라34;

const 마린몸 = `WHAT IT IS: a handmade needle-felted wool doll — a tiny soldier in an oversized
helmet. The DEEP NAVY felt helmet is a smooth rounded dome that takes up about SIX TENTHS of
the whole figure's height, coming down at the sides to wrap around the eye area; one fine seam
runs over its crown and there is no other stitching on it. Under the helmet is a SMALL, SHORT,
ROUND body of warm OATMEAL cream felt — wider than it is tall, with two very short stubby arms
like little mittens and two small round feet set close together. An oatmeal pouch with a
rounded flap hangs on a thin shoulder strap across the front, and one tiny white felt flower
with a green stem peeks out of it. The body has no stitching.

MATERIAL: felted merino wool with visible fibre fuzz and fine stray hairs. Nothing is plastic,
glass, metal or digital — the lenses are smooth felt discs. No scarf of any kind.`;

const 마린빛 = 몽글빛;

/* 렌즈 하나만 갈아 낀다 — 나머지는 위에서 고정됐다. */
const 마린얼굴 = (렌즈) => `FACE: exactly two LENSES and nothing else — no pupils, no eyelids,
no eyebrows, no mouth, no nose. They sit LOW on the helmet, wide apart, exactly level with each
other and exactly the same size and brightness, and the navy felt of the helmet wraps around
each one in a raised ring. Each lens is SET INTO the felt, sunk so LESS THAN HALF of its curve
shows; 🔴 it never breaks the outline of the helmet.

THE LENSES THIS TIME: ${렌즈}`;

/* ── 판들 ───────────────────────────────────────────────────────── */

const 판들 = [
  /* 몽글 5 */
  { 누구: '몽글', 이름: '몽글_본체',   카메라: 몽글카메라,          얼굴: 몽글눈뜸,   참조: '몽글_본체.png' },
  { 누구: '몽글', 이름: '몽글_눈감음', 카메라: 몽글카메라,          얼굴: 몽글눈감음, 참조: '몽글_눈감음.png' },
  { 누구: '몽글', 이름: '몽글_눈웃음', 카메라: 몽글카메라,          얼굴: 몽글눈웃음, 참조: '몽글_눈웃음.png' },
  { 누구: '몽글', 이름: '몽글_좌34',   카메라: 몽글카메라34('left'),  얼굴: 몽글눈뜸,   참조: '몽글_좌34.png' },
  { 누구: '몽글', 이름: '몽글_우34',   카메라: 몽글카메라34('right'), 얼굴: 몽글눈뜸,   참조: '몽글_우34.png' },
  /* 🔴 09-05 — 첫 배치에서 «빠뜨렸다». 옛 정본의 몽글 표정은 여섯인데(마스코트자산.js 의 `표정`)
   *   다섯만 구웠다. 그대로 정본을 갈면 `경로('놀람')` 이 없는 파일을 가리킨다.
   *   옛 놀람은 «합성물»이었다 — 본체의 구슬을 1.35배로 키워 얹은 판이라 배경판이 아예 없었다.
   *   이제는 그것도 제대로 굽는다. 그래서 이 자리부터 놀람이 «합성물이 아니게» 된다. */
  { 누구: '몽글', 이름: '몽글_놀람', 카메라: 몽글카메라, 참조: '몽글_본체.png',
    얼굴: `FACE: exactly two eyes and nothing else. Each eye is a perfectly round glossy BLACK
bead, smooth and shiny like polished glass with one tiny white highlight. STARTLED — the beads
are noticeably LARGER than usual, about one and a third times their normal size, which is what
makes the doll read as surprised. Nothing else about the face changes.
${눈박힘}
The two beads sit at exactly the same height, level with each other, in the upper third of the
doll. They are set WIDE APART — the gap between them is about one third of the doll's full
width. No mouth, no nose, no eyebrows, no blush, no cheeks, no other feature.` },

  /* 🔴 몽글 표정 넷 (09-05 저녁 신설 · 유호 「몽글이 표정 넷도 만들어줘」)
   *
   * 왜 늦었나: 몽글은 «펠트 실물 사진» 세대라 새 표정을 만들려면 실물을 다시 만들어 다시
   *   찍어야 했다. 그래서 앱 표정이 몽글 5 · 까몽 9 로 갈렸고, 학생이 주인공(몽글)을 고르면
   *   반응이 제일 얇았다. 09-05 판올림으로 몽글도 굽는 세대가 되어 그 벽이 사라졌다.
   *
   * 🔑 넷은 까몽의 같은 표정과 «짝»이 되게 지었다 — 어휘만 몽글 것으로 옮긴다:
   *   까몽은 초록 실선·초록 홍채, 몽글은 **짙은 갈색 자수실**과 **검은 구슬**이다.
   * ⚠ 으쓱은 옛 워프 통로에서 «변화가 안 읽힌다»로 한 번 반려됐다(유호 09-0x). 그래서
   *   졸림과 «서로» 다르게 못 박는다 — 으쓱은 짧고 평평, 졸림은 길고 낮다. 그 대비를
   *   지시문 안에서 직접 말한다(하나만 보고 지으면 둘이 같아진다).
   * 🔑 넷 다 `얼굴먼저` 다 — 참조가 본체(구슬 눈)라, 얼굴을 뒤에 두면 「참조와 같게」가
   *   이겨서 눈이 안 바뀐다(마린 표정에서 실측한 자리). */
  { 누구: '몽글', 이름: '몽글_윙크', 카메라: 몽글카메라, 참조: '몽글_본체.png', 얼굴먼저: true,
    얼굴: `FACE: exactly two eyes and nothing else, and they do NOT match. The doll's RIGHT eye
(on the LEFT side of the picture as we look at it) is CLOSED — a single curved line of dark
brown embroidery thread stitched into the felt, curving gently DOWNWARD. The OTHER eye is fully
OPEN — a small perfectly round glossy BLACK bead, smooth and shiny like polished glass with one
tiny white highlight. A wink.
${눈박힘}
The two sit at exactly the same height, level with each other, in the upper third of the doll,
set wide apart with a gap of about one third of the doll's width.
No mouth, no nose, no eyebrows, no blush, no cheeks, no other feature.` },

  { 누구: '몽글', 이름: '몽글_으쓱', 카메라: 몽글카메라, 참조: '몽글_본체.png', 얼굴먼저: true,
    얼굴: `FACE: exactly two closed eyes and nothing else. Each eye is a SHORT, nearly FLAT line
of dark brown embroidery thread stitched into the felt — almost a straight dash, with only the
slightest downward tilt at its outer end. A breezy "who, me?" shrug.
🔴 These lines must read as clearly DIFFERENT from the other closed-eye faces: they are much
SHORTER than a sleepy eye and much FLATTER than a sleeping curve — nearly horizontal dashes,
not arcs. Do not draw a smile, do not draw a caret ^, do not draw a deep curve.
The two sit at exactly the same height, level with each other, in the upper third of the doll,
set wide apart with a gap of about one third of the doll's width. No beads anywhere.
No mouth, no nose, no eyebrows, no blush, no cheeks, no other feature.` },

  { 누구: '몽글', 이름: '몽글_졸림', 카메라: 몽글카메라, 참조: '몽글_본체.png', 얼굴먼저: true,
    얼굴: `FACE: exactly two closed eyes and nothing else. Each eye is a LONG, LOW, almost
straight line of dark brown embroidery thread with only the faintest downward sag in the middle
— heavy-lidded and sleepy.
🔴 These lines are noticeably LONGER than a shrug dash and sit LOWER on the face, closer to the
middle of the head. They are long and drooping, not short and crisp.
The two sit at exactly the same height, level with each other, set wide apart with a gap of
about one third of the doll's width. No beads anywhere.
No mouth, no nose, no eyebrows, no blush, no cheeks, no other feature.` },

  { 누구: '몽글', 이름: '몽글_민망', 카메라: 몽글카메라, 참조: '몽글_본체.png', 얼굴먼저: true,
    얼굴: `FACE: exactly two eyes and nothing else, and they do NOT match. One eye is fully OPEN
— a small perfectly round glossy BLACK bead with one tiny white highlight. The OTHER eye is
SQUEEZED SMALLER — a short, tight curve of dark brown embroidery thread, pinched as if caught
out and looking away. Embarrassed, flustered.
${눈박힘}
The two sit at exactly the same height, level with each other, in the upper third of the doll,
set wide apart with a gap of about one third of the doll's width.
No mouth, no nose, no eyebrows, no blush, no cheeks, no other feature.` },

  /* 까몽 10 */
  { 누구: '까몽', 이름: '까몽_본체', 카메라: 까몽카메라, 참조: '까몽_본체.png',
    얼굴: 까몽눈뜸('Both eyes are the same size, wide open, calm and steady, set level with each other.') },
  { 누구: '까몽', 이름: '까몽_눈감음', 카메라: 까몽카메라, 참조: '까몽_눈감음.png',
    얼굴: 까몽눈선('Both curve gently DOWNWARD like a shallow bowl turned over — the shape of a sleeping eye. They sit level with each other.') },
  { 누구: '까몽', 이름: '까몽_눈웃음', 카메라: 까몽카메라, 참조: '까몽_눈웃음.png',
    얼굴: 까몽눈선('Both curve UPWARD into a happy arc, like two smiles — the shape of an eye laughing. They sit level with each other.') },
  { 누구: '까몽', 이름: '까몽_좌34', 카메라: 까몽카메라34('left'), 참조: '까몽_좌34.png',
    얼굴: 까몽눈뜸('Both eyes are wide open and calm; the far eye reads slightly narrower because of the turn.') },
  { 누구: '까몽', 이름: '까몽_우34', 카메라: 까몽카메라34('right'), 참조: '까몽_우34.png',
    얼굴: 까몽눈뜸('Both eyes are wide open and calm; the far eye reads slightly narrower because of the turn.') },
  { 누구: '까몽', 이름: '까몽_놀람', 카메라: 까몽카메라, 참조: '까몽_놀람.png',
    얼굴: 까몽눈뜸('Both eyes are stretched WIDE OPEN, much rounder and larger than usual, with the green iris ring showing all the way around — startled. They sit level with each other.') },
  { 누구: '까몽', 이름: '까몽_민망', 카메라: 까몽카메라, 참조: '까몽_민망.png',
    얼굴: 까몽눈뜸('The eyes are uneven — one is open and round, the other is squeezed smaller, as if caught out and looking away. Embarrassed.') },
  { 누구: '까몽', 이름: '까몽_윙크', 카메라: 까몽카메라, 참조: '까몽_윙크.png',
    얼굴: `FACE: exactly two eyes and nothing else, and they do NOT match. The creature's RIGHT
eye (on the LEFT side of the picture as we look at it) is CLOSED — a single curved line of
bright apple-green thread arcing gently downward. The other eye is fully OPEN — a LARGE round
eye with a bright apple-green iris ring, a big glossy black pupil, and one small white
highlight; it is about one quarter of the head's width. A wink.
${눈박힘}
There is only the faintest hint of a dark nose in the fur. No mouth, no whiskers, no eyebrows,
no blush, no other feature.` },
  { 누구: '까몽', 이름: '까몽_으쓱', 카메라: 까몽카메라, 참조: '까몽_으쓱.png',
    얼굴: 까몽눈선('Both are short, nearly flat, slightly downturned green lines — a breezy "who, me?" shrug. They sit level with each other.') },
  { 누구: '까몽', 이름: '까몽_졸림', 카메라: 까몽카메라, 참조: '까몽_졸림.png',
    얼굴: 까몽눈선('Both are long, low, almost straight green lines with only the faintest downward sag — heavy-lidded and sleepy. They sit level with each other.') },

  /* 마린 9 — 본체는 이미 정본으로 서 있으므로 굽지 않는다(참조로만 쓴다). */
  { 누구: '마린', 이름: '마린_눈감음', 카메라: 마린카메라, 참조: '마린_본체.png',
    얼굴: 마린얼굴(`both are SWITCHED OFF and dark — two flat matte NAVY felt discs, the same
navy as the helmet, with no glow at all. Only the raised felt ring shows where each lens is.
The character is asleep or powered down.`) },
  /* 🔴 09-05 유호 교정 「마린은 웃는걸 저렇게 하는게 아니라 다른 방법을 찾아줘. 지금 버전은
   *   이상하다」. 첫 판은 «렌즈의 아래 반만 켰다» — 그러니 웃는 게 아니라 «반쯤 꺼진» 것으로
   *   읽혔고 졸림과도 헷갈렸다. 렌즈로 웃음을 내는 길을 넷으로 갈라 견준다.
   *   ⚠ 고를 때까지 `마린_눈웃음` 은 «비워 둔다» — 이상한 판을 정본에 세워 두면 그것이
   *     다음 사고다(조용한 폴백 금지와 같은 규율). */
  { 누구: '마린', 이름: '마린_웃음a_곡선뜸', 카메라: 마린카메라, 참조: '마린_본체.png',
    얼굴: 마린얼굴(`the round lens glass itself has gone DARK — and inside each one, a single
bright BUTTER-YELLOW CURVE has lit up: a smooth arc bending UPWARD at its ends, like the
letter U, drawn in light. Think of a screen showing a smiling eye. The curve is thick, clean
and glowing; everything else inside the lens is dark. Both curves match exactly.`) },
  /* 🔴 09-05 재시도 — 첫 b 는 문면대로 안 나왔다. 「아치 덩어리」를 부탁했는데 «노란 면에 곡선이
   *   파인» 판이 나와서, 갈라 놓으려던 a 와 거의 같아졌다(유호님이 그 어긋남을 짚으셨다).
   *   까닭 = 「arch」라는 낱말만으로는 «덩어리»가 안 선다. 모델이 «면 + 무늬»로 읽었다.
   *   ⇒ ⓐ 얼굴을 맨 앞으로(얼굴먼저) ⓑ «구멍 없는 통짜»를 못 박고 «무늬·선·구멍 금지»를 적는다
   *     ⓒ 무엇과 닮았는지를 실물로 준다(무지개 조각 · 다리 놓은 모양). */
  { 누구: '마린', 이름: '마린_웃음b2_통짜아치', 카메라: 마린카메라, 참조: '마린_본체.png', 얼굴먼저: true,
    얼굴: `FACE — THIS IS WHAT THE WHOLE PICTURE IS ABOUT:
Two glowing BUTTER-YELLOW shapes where the eyes are, and each one is a SOLID ARCH.

🔴 What "arch" means here — read it as a shape cut from felt, not as a pattern:
Take a thick rainbow band. Lay it down so it curves UPWARD in the middle and its two ends
point down. That whole band is one solid piece of glowing butter-yellow felt. That is the eye.
It is a bridge, a croissant, a smile drawn with a fat brush — one continuous stroke of yellow,
thick in the middle, tapering slightly at the two ends.

🔴 What it must NOT be: NOT a yellow panel with a line or curve drawn inside it. NOT a yellow
square, circle or rounded rectangle with a groove, notch or dark mark on it. NOT an outline.
There is NO hole, NO cut-out, NO dark shape anywhere inside the yellow. The yellow is one
unbroken solid mass and the navy is simply everywhere the yellow is not.

Both arches are identical, level with each other, set wide apart, and glow evenly.
No pupils, no eyelids, no eyebrows, no mouth. Nothing else on the face.
The navy felt is cut in that same arch outline around each one, rising softly against its edge.` },
  /* 🔴 09-05 셋째 판 — 유호님이 「웃음을 조금 더 다른 느낌으로」를 부르셨다. 앞의 넷은
   *   «아치 계열»에서만 갈렸다(곡선 파임 · 통짜 아치 · 눌린 타원 · 별). 결을 아예 다른 데서
   *   찾는다: 몽글이 쓰는 ∧ 문법 · 물결 · 빛이 하나 더 뜨는 것 · 꽃(마린의 반전). */
  { 누구: '마린', 이름: '마린_웃음e_갈매기', 카메라: 마린카메라, 참조: '마린_본체.png', 얼굴먼저: true,
    얼굴: `FACE — THIS IS WHAT THE WHOLE PICTURE IS ABOUT:
Two glowing BUTTER-YELLOW shapes where the eyes are, and each is a CARET — the letter A
without its crossbar, or a rooftop: two straight thick strokes of solid yellow felt meeting at
a point on top, open at the bottom. Sharp, simple, cheerful.
🔴 Solid yellow throughout — no hole, no dark line, no groove inside the yellow.
This is the exact shape the coral ghost mascot uses for its happy eyes, so the two characters
read as made by the same hand. Both carets identical, level, wide apart.
No pupils, no eyelids, no eyebrows, no mouth. The navy felt is cut in that same caret outline
around each one.` },
  { 누구: '마린', 이름: '마린_웃음f_물결', 카메라: 마린카메라, 참조: '마린_본체.png', 얼굴먼저: true,
    얼굴: `FACE — THIS IS WHAT THE WHOLE PICTURE IS ABOUT:
Two glowing BUTTER-YELLOW shapes where the eyes are, and each is a thick WAVY LINE — a tilde ~
drawn with a fat brush: it rises, dips, and rises again, one continuous solid stroke of yellow
felt lying horizontally. Playful and relaxed, the way a cartoon draws a contented eye.
🔴 Solid yellow throughout — no hole, no dark line inside it. Both waves identical, level,
wide apart, and they wave in the same direction.
No pupils, no eyelids, no eyebrows, no mouth. The navy felt is cut in that same wavy outline.` },
  { 누구: '마린', 이름: '마린_웃음g_아래빛', 카메라: 마린카메라, 참조: '마린_본체.png', 얼굴먼저: true,
    얼굴: `FACE — THIS IS WHAT THE WHOLE PICTURE IS ABOUT:
The two lenses are still FULL ROUND circles of glowing butter-yellow, exactly as at rest — but
BELOW each one, on the navy felt, a small separate crescent of the same butter-yellow light has
appeared, curving upward like the fold that forms under a smiling eye.
So each eye is TWO pieces: the round lens above, and a smaller thin crescent below it, with a
band of navy between them. The crescent is clearly smaller than the lens, about one third as
tall. Both eyes match exactly.
🔴 Both pieces are solid yellow — no holes, no dark lines inside them.
No pupils, no eyelids, no eyebrows, no mouth.` },
  { 누구: '마린', 이름: '마린_웃음h_꽃눈', 카메라: 마린카메라, 참조: '마린_본체.png', 얼굴먼저: true,
    얼굴: `FACE — THIS IS WHAT THE WHOLE PICTURE IS ABOUT:
Each lens has bloomed into a small FLOWER of glowing butter-yellow felt — five soft rounded
petals around a slightly deeper golden centre, like a daisy cut from felt. Roughly the same
overall size as a resting lens, so the face does not grow.
This is the one expression where the character's soft spot shows: it carries a flower in its
pouch, and when it is truly delighted the flower turns up in its eyes too.
🔴 Solid felt petals — no outline drawing, no dark lines, no stamens, no leaves.
Both flowers identical, level, wide apart. No pupils, no eyelids, no eyebrows, no mouth.` },
  { 누구: '마린', 이름: '마린_웃음c_눌린타원', 카메라: 마린카메라, 참조: '마린_본체.png',
    얼굴: 마린얼굴(`each lens has been SQUASHED vertically into a wide flat ellipse, about half
as tall as it is wide, and the whole ellipse curves gently upward at its outer end — the shape
a real eye makes when someone smiles hard. They glow BRIGHTER than usual, a warm happy
butter-yellow. Both match exactly.`) },
  { 누구: '마린', 이름: '마린_웃음d_별반짝', 카메라: 마린카메라, 참조: '마린_본체.png',
    얼굴: 마린얼굴(`each lens is still round but noticeably SMALLER than usual, and blazing
BRIGHT butter-yellow, with a clear four-pointed star of light flaring out from its centre and a
warm halo spilling onto the navy felt around it. The eyes have crinkled small with delight.
Both match exactly.`) },
  { 누구: '마린', 이름: '마린_좌34', 카메라: 마린카메라34('left'), 참조: '마린_본체.png',
    얼굴: 마린얼굴('both are full round butter-yellow circles, calm and steady, evenly bright; the far lens reads as a slightly narrower ellipse because of the turn.') },
  { 누구: '마린', 이름: '마린_우34', 카메라: 마린카메라34('right'), 참조: '마린_본체.png',
    얼굴: 마린얼굴('both are full round butter-yellow circles, calm and steady, evenly bright; the far lens reads as a slightly narrower ellipse because of the turn.') },
  /* 🔴 09-05 실측 — 첫 판의 «놀람»이 «몰래기쁨»과 거의 같아 보였다. 둘 다 «밝아지는» 판이라
   *   빛만으로는 안 갈린다. ⇒ 놀람은 «크기»로, 몰래기쁨은 «빛»으로 갈래를 나눈다.
   *   놀람은 렌즈가 두 배 가까이 커져 헬멧을 거의 채우고, 몰래기쁨은 크기를 «절대» 안 바꾼다. */
  { 누구: '마린', 이름: '마린_놀람', 카메라: 마린카메라, 참조: '마린_본체.png', 얼굴먼저: true,
    얼굴: `FACE — THIS IS WHAT THE WHOLE PICTURE IS ABOUT:
Two glowing BUTTER-YELLOW lenses, and they have BLOWN WIDE OPEN in shock.
🔴 SIZE — push this as far as it goes. Each lens is a HUGE dome, more than half the helmet's
width, and the two of them TAKE OVER THE WHOLE FACE: they run from just inside one edge of the
helmet to just inside the other, and from near its top down to near its bottom. What is left of
the navy is only a narrow outline around them and a thin bridge between them — the helmet reads
as two giant glowing eyes with a little navy frame, nothing else.
They are far bigger than any other expression this character has. Put this picture beside the
reference and the eyes must be the FIRST thing anyone notices. Bigger is right here; if you are
unsure, make them bigger still.
They glow hot and bright, spilling light onto the navy felt around them.
No pupils, no eyelids, no eyebrows, no mouth. Both exactly level, exactly the same size.
Each lens is still SET INTO the felt with the navy rising against its rim, and 🔴 even at this
size it never breaks the outline of the helmet.` },
  { 누구: '마린', 이름: '마린_집중', 카메라: 마린카메라, 참조: '마린_본체.png',
    얼굴: 마린얼굴(`each has narrowed into a NARROW HORIZONTAL SLIT — a long thin capsule with
rounded ends, about three times wider than it is tall, still glowing butter-yellow but focused
and hard. Both identical. This is the look it wears when it is being strict.`) },
  { 누구: '마린', 이름: '마린_몰래기쁨', 카메라: 마린카메라, 참조: '마린_본체.png',
    얼굴: 마린얼굴(`both are still full round circles but glowing ONE STEP BRIGHTER than usual —
warmer, softer, with a faint halo of light on the navy felt around each. The shape has not
changed at all; only the light has. A quiet, secret happiness that the face itself never admits
to.`) },
  /* 🔴 09-05 실측 — 첫 판의 «민망»은 두 렌즈가 거의 같게 나왔다. 「two thirds」로는 안 섰다.
   *   ⇒ 차이를 «절반»으로 벌리고, 어느 쪽이 작아지는지를 그림 기준으로 못 박는다. */
  { 누구: '마린', 이름: '마린_민망', 카메라: 마린카메라, 참조: '마린_본체.png',
    얼굴: 마린얼굴(`they must NOT match, and the difference has to be obvious at a glance.
The lens on the LEFT side of the picture is a full round butter-yellow circle at normal size.
The lens on the RIGHT side has shrunk to HALF that diameter and dimmed to a dull ochre, as if
it were flinching away and looking aside. One big and bright, one small and dim — caught out
and embarrassed.`) },
  { 누구: '마린', 이름: '마린_졸림', 카메라: 마린카메라, 참조: '마린_본체.png',
    얼굴: 마린얼굴(`each is only HALF lit — the lower half of the circle glows a dim, tired
butter-yellow while the upper half has gone dark navy, as if a lid had come halfway down. Both
match. Heavy and sleepy, about to switch off.`) },

  /* ── 감정 여섯 · 워프를 실물 컷으로 (2026-09-05 · 유호 지시 「남은 여섯도 굽자」) ──────
   * 🔑 왜 굽나 — 토큰이 직접 말한다: 「몽글에서는 컷이 없어 «워프»(2D 변형)로 내던 감정이다.
   *   마린은 렌즈가 가로로 가늘어지는 실물 컷을 가진 첫 캐릭터다.」 워프는 한 얼굴을 비틀어
   *   다른 감정인 척하는 임시 방편이라, 학생에게는 같은 얼굴이 조금씩 일그러진 것으로 읽힌다.
   * 🔑 **몸짓은 이미 서 있다** — `docs/캐릭터/캐릭터_생명감_설계.md` 가 집중=전부 정지,
   *   응원=몸 기울여 앞으로, 감동=몸 떨림, 뾰로통=팔짱꼴 기울기로 못 박아 뒀다.
   *   여기서 채우는 것은 그 몸짓이 «쓸 얼굴»이다. 둘이 만나야 살아 있는 자리가 된다.
   * 🔑 셋 다 눈만으로 감정을 가른다(입·눈썹이 없다) — 그래서 여섯을 «눈의 형태»로 갈랐다:
   *   집중=가로 슬릿 · 응원=위로 크게 뜬 기대 · 감동=크고 촉촉 · 뾰로통=옆으로 미끄러짐 ·
   *   궁금함=좌우 크기 다름 · 안도=힘 풀린 얕은 호. 잠자는 «눈감음»과 «안도»가 겹치지 않게,
   *   안도는 호를 얕게 두고 살짝 벌어진 채로 둔다.
   * ⚠ 마린 집중은 이미 위에 있어 여기서 뺀다(17장). */

  { 누구: '몽글', 이름: '몽글_집중', 카메라: 몽글카메라, 참조: '몽글_본체.png',
    얼굴: 몽글눈(`Each eye is a NARROW HORIZONTAL SLIT of dark brown embroidery thread — a long
thin capsule with rounded ends, about three times wider than it is tall. Both identical.
Narrowed in concentration, watching one thing closely.`) },
  { 누구: '몽글', 이름: '몽글_응원', 카메라: 몽글카메라, 참조: '몽글_본체.png',
    얼굴: 몽글눈(`Each eye is a LARGE perfectly round glossy black bead, noticeably bigger than
usual and opened wide, each with TWO white highlights instead of one — bright, expectant,
leaning into the moment. Both identical.`) },
  { 누구: '몽글', 이름: '몽글_감동', 카메라: 몽글카메라, 참조: '몽글_본체.png',
    얼굴: 몽글눈(`Each eye is a large round glossy black bead with a WIDE soft white highlight
across the upper half and a faint wet glimmer pooling along the lower rim, as if brimming.
Both identical. Moved, on the edge of tears but not crying.`) },
  { 누구: '몽글', 이름: '몽글_뾰로통', 카메라: 몽글카메라, 참조: '몽글_본체.png',
    얼굴: 몽글눈(`Each eye is a round glossy black bead pushed to ONE SIDE — both beads sit
against the left edge of where an eye would be, looking away to the side, and both sit slightly
LOWER than usual. Sulking in a playful way, not sad.`) },
  { 누구: '몽글', 이름: '몽글_궁금함', 카메라: 몽글카메라, 참조: '몽글_본체.png',
    얼굴: 몽글눈(`The two eyes do NOT match in size. One is a large round glossy black bead
opened wide; the other is clearly smaller, the same round bead shrunk. Curious, head-tilting
interest. Both are open beads — neither is closed.`) },
  { 누구: '몽글', 이름: '몽글_안도', 카메라: 몽글카메라, 참조: '몽글_본체.png',
    얼굴: 몽글눈(`Each eye is a single SHALLOW curved line of dark brown thread arcing gently
downward — much flatter and softer than a sleeping eye, the tension gone out of it, and each
line stops a little short so a sliver of gap remains at both ends. Relieved, letting the breath
out. Both identical.`) },

  { 누구: '까몽', 이름: '까몽_집중', 카메라: 까몽카메라, 참조: '까몽_본체.png',
    얼굴: 까몽눈선('Each is a NARROW HORIZONTAL SLIT rather than a curve — a long thin capsule with rounded ends, about three times wider than tall, still bright apple-green. Narrowed in concentration, watching one thing closely.') },
  { 누구: '까몽', 이름: '까몽_응원', 카메라: 까몽카메라, 참조: '까몽_본체.png',
    얼굴: 까몽눈뜸('Both are opened WIDER than usual and slightly larger, each with two white highlights instead of one — bright and expectant, leaning into the moment.') },
  { 누구: '까몽', 이름: '까몽_감동', 카메라: 까몽카메라, 참조: '까몽_본체.png',
    얼굴: 까몽눈뜸('Both are wide open with a broad soft white highlight across the upper half and a faint wet glimmer pooling along the lower rim, as if brimming. Moved, on the edge of tears but not crying.') },
  { 누구: '까몽', 이름: '까몽_뾰로통', 카메라: 까몽카메라, 참조: '까몽_본체.png',
    얼굴: 까몽눈뜸('Both pupils are pushed to ONE SIDE — looking away to the left — and both eyes sit slightly lower than usual. Sulking in a playful way, not sad.') },
  { 누구: '까몽', 이름: '까몽_궁금함', 카메라: 까몽카메라, 참조: '까몽_본체.png',
    얼굴: 까몽눈뜸('The two do NOT match in size — one is opened wide and large, the other is clearly smaller. Curious, head-tilting interest. Both are open, neither closed.') },
  { 누구: '까몽', 이름: '까몽_안도', 카메라: 까몽카메라, 참조: '까몽_본체.png',
    얼굴: 까몽눈선('Each is a SHALLOW curve arcing gently downward — much flatter and softer than a sleeping eye, the tension gone out of it, each line stopping a little short so a sliver of gap remains at both ends. Relieved, letting the breath out.') },

  { 누구: '마린', 이름: '마린_응원', 카메라: 마린카메라, 참조: '마린_본체.png',
    얼굴: 마린얼굴(`each is opened WIDE and glowing a brighter butter-yellow than usual, with two
small white glints instead of one. Both match. Bright and expectant, leaning into the moment.`) },
  { 누구: '마린', 이름: '마린_감동', 카메라: 마린카메라, 참조: '마린_본체.png',
    얼굴: 마린얼굴(`each glows warm butter-yellow with a WIDE soft sheen across the upper half and
a faint wet shimmer gathering along the lower rim, as if the lens were brimming. Both match.
Moved, on the edge of tears but not crying.`) },
  { 누구: '마린', 이름: '마린_뾰로통', 카메라: 마린카메라, 참조: '마린_본체.png',
    얼굴: 마린얼굴(`each glow is pushed to ONE SIDE of the lens — the bright core sits against the
left edge of both circles, looking away — and both sit slightly lower than usual. Sulking in a
playful way, not sad.`) },
  { 누구: '마린', 이름: '마린_궁금함', 카메라: 마린카메라, 참조: '마린_본체.png',
    얼굴: 마린얼굴(`the two do NOT match in size — one lens is opened wide and large, the other is
clearly smaller, both still glowing butter-yellow. Curious, head-tilting interest.`) },
  { 누구: '마린', 이름: '마린_안도', 카메라: 마린카메라, 참조: '마린_본체.png',
    얼굴: 마린얼굴(`each has softened into a WIDE SHALLOW arc of dim butter-yellow light, flatter
and gentler than the sleepy half-lit look, with the tension gone out of it. Both match.
Relieved, letting the breath out.`) },
];

const 몸들 = { 몽글: 몽글몸, 까몽: 까몽몸, 마린: 마린몸 };
const 빛들 = { 몽글: 몽글빛, 까몽: 까몽빛, 마린: 마린빛 };
const 정본폴더들 = { 몽글: 몽글정본, 까몽: 까몽정본, 마린: 마린정본 };

function 지시조립(판) {
  const 몸 = 몸들[판.누구];
  const 빛 = 빛들[판.누구];
  /* 🔴 09-05 실측 — 까몽_좌34 가 «회색 바닥에 그림자»로 나왔다. 견본 그림의 배경이 그렇기
   *   때문이다. 견본은 힘이 세서, 쓰라고 준 것 말고도 따라온다. ⇒ 무엇을 «안» 보는지 적는다. */
  const 같은것 = `Reproduce THIS EXACT character — the one in the reference image — at much
higher resolution. Same silhouette, same proportions, same colour. Not a similar character:
the same one. Only the expression is as described below.
🔴 Use the reference ONLY for the character's shape, colour and markings. IGNORE the
reference's background completely — ignore its surface, its floor, its wall, its grey tone and
its shadow. Those belong to the old photograph, not to this one.`;
  /* 🔴 09-05 — 「맨 앞에 선 덩어리가 장면을 정한다」를 얼굴에도 쓴다. 눈 «크기»가 요점인 판
   *   (놀람)에서 얼굴이 다섯째에 있으면, 앞의 「참조와 같게」가 이겨서 크기가 안 변한다.
   *   실측: 「두 배 가까이 키워라」고 썼는데 렌즈 몫이 15.68% → 16.62% 로 6%만 늘었다.
   *   ⇒ `얼굴먼저` 인 판은 얼굴을 카메라 바로 뒤로 올리고, 참조에게 «얼굴만은 따르지 마라»를
   *     같이 못 박는다. 참조는 힘이 세서 시키지 않은 것까지 데려온다(배경·조명에서 두 번 겪었다). */
  if (판.얼굴먼저) {
    const 얼굴빼고같게 = 같은것 + `\n🔴 ONE EXCEPTION: do NOT copy the EYES from the reference.
The reference shows this character's resting face; this picture needs the face described above,
and the difference in the eyes must be obvious at a glance. Body, colour and silhouette follow
the reference exactly — the eyes do not.`;
    return [판.카메라, 판.얼굴, 배경, 얼굴빼고같게, 몸, 빛, 금지].join('\n\n');
  }
  return [판.카메라, 배경, 같은것, 몸, 판.얼굴, 빛, 금지].join('\n\n');
}

function 참조경로(판) {
  const p = path.join(정본폴더들[판.누구], 판.참조);
  if (!fs.existsSync(p)) throw new Error(`참조 없음 — ${p}`);
  return [p];
}

async function main() {
  const argv = process.argv.slice(2);
  const 누구 = argv.includes('--누구') ? argv[argv.indexOf('--누구') + 1] : null;
  const 하나 = argv.includes('--판') ? Number(argv[argv.indexOf('--판') + 1]) : null;
  const 다시 = argv.includes('--다시');

  let 대상 = 판들;
  if (누구) 대상 = 대상.filter((p) => p.누구 === 누구);
  if (하나) 대상 = 판들.filter((_, i) => i + 1 === 하나);
  if (!대상.length) { console.error(`고를 판이 없다 — --누구 는 몽글·까몽·마린 · --판 은 1~${판들.length}`); process.exit(1); }

  if (!(await 배치게이트(대상.length, '4K'))) { process.exitCode = 3; return; }

  fs.mkdirSync(낼곳, { recursive: true });
  const k = 키();
  const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));
  let 구움 = 0, 건너뜀 = 0, 연속실패 = 0;

  for (const [i, 판] of 대상.entries()) {
    const 저장경로 = path.join(낼곳, `${판.이름}.png`);
    if (fs.existsSync(저장경로) && !다시) { 건너뜀 += 1; console.log(`⏭  ${판.이름} — 이미 있다(--다시 면 다시 굽는다)`); continue; }
    if (i > 0) await 잠깐(30_000);
    let 시도 = 0;
    for (;;) {
      try {
        const r = await 한컷({ 이름: 판.이름, 지시: 지시조립(판), 참조: 참조경로(판), 비율: '1:1', 크기: '4K', 저장경로, k });
        console.log(`✅ ${판.이름} — ${r && r.초 ? r.초 + '초 · ' : ''}${저장경로}`);
        구움 += 1; 연속실패 = 0;
        break;
      } catch (e) {
        const 몫벽 = /429|RESOURCE_EXHAUSTED/.test(e.message);
        const 쉼 = [120_000, 300_000];
        if (몫벽 && 시도 < 2) { console.log(`   ⏳ ${판.이름} 몫 벽 — ${쉼[시도] / 60_000}분 쉬고 다시(${시도 + 1}/2)`); await 잠깐(쉼[시도]); 시도 += 1; continue; }
        console.error(`❌ ${판.이름} — ${e.message.slice(0, 160)}`);
        if (e.돈벽 && !몫벽) return 마무리();
        연속실패 += 1;
        if (연속실패 >= 3) { console.error('\n🛑 세 판이 잇달아 막혔다 — 벽이 오래 서 있다. 여기서 멈춘다(두드릴수록 벽이 길어진다).'); return 마무리(); }
        break;
      }
    }
  }
  function 마무리() {
    console.log(`\n[마스코트4K굽기] 구움 ${구움} · 건너뜀 ${건너뜀} · 든 돈 ≈ ${구움 * 336}원 · ${낼곳}`);
    console.log('   다음 = 흰 배경 걷기(python tools/흰배경걷기.py <파일>) · 그 뒤 유호님 판정.');
    console.log('   🔴 정본 교체는 승인 «뒤에» 별도로 한다 — 이 도구는 후보만 낸다.');
  }
  마무리();
}

if (require.main === module) main().catch((e) => { console.error('실행 오류:', e.message); process.exit(1); });
