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
const 몽글정본 = path.join(ROOT, 'docs/캐릭터/펠트코랄_0815');
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

/* ── 판들 ───────────────────────────────────────────────────────── */

const 판들 = [
  /* 몽글 5 */
  { 누구: '몽글', 이름: '몽글_본체',   카메라: 몽글카메라,          얼굴: 몽글눈뜸,   참조: '재염색_본체.png' },
  { 누구: '몽글', 이름: '몽글_눈감음', 카메라: 몽글카메라,          얼굴: 몽글눈감음, 참조: '재염색_눈감음.png' },
  { 누구: '몽글', 이름: '몽글_눈웃음', 카메라: 몽글카메라,          얼굴: 몽글눈웃음, 참조: '재염색_눈웃음.png' },
  { 누구: '몽글', 이름: '몽글_좌34',   카메라: 몽글카메라34('left'),  얼굴: 몽글눈뜸,   참조: '재염색_좌34.png' },
  { 누구: '몽글', 이름: '몽글_우34',   카메라: 몽글카메라34('right'), 얼굴: 몽글눈뜸,   참조: '재염색_우34.png' },
  /* 🔴 09-05 — 첫 배치에서 «빠뜨렸다». 옛 정본의 몽글 표정은 여섯인데(마스코트자산.js 의 `표정`)
   *   다섯만 구웠다. 그대로 정본을 갈면 `경로('놀람')` 이 없는 파일을 가리킨다.
   *   옛 놀람은 «합성물»이었다 — 본체의 구슬을 1.35배로 키워 얹은 판이라 배경판이 아예 없었다.
   *   이제는 그것도 제대로 굽는다. 그래서 이 자리부터 놀람이 «합성물이 아니게» 된다. */
  { 누구: '몽글', 이름: '몽글_놀람', 카메라: 몽글카메라, 참조: '재염색_본체.png',
    얼굴: `FACE: exactly two eyes and nothing else. Each eye is a perfectly round glossy BLACK
bead, smooth and shiny like polished glass with one tiny white highlight. STARTLED — the beads
are noticeably LARGER than usual, about one and a third times their normal size, which is what
makes the doll read as surprised. Nothing else about the face changes.
${눈박힘}
The two beads sit at exactly the same height, level with each other, in the upper third of the
doll. They are set WIDE APART — the gap between them is about one third of the doll's full
width. No mouth, no nose, no eyebrows, no blush, no cheeks, no other feature.` },

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
];

function 지시조립(판) {
  const 몸 = 판.누구 === '몽글' ? 몽글몸 : 까몽몸;
  const 빛 = 판.누구 === '몽글' ? 몽글빛 : 까몽빛;
  /* 🔴 09-05 실측 — 까몽_좌34 가 «회색 바닥에 그림자»로 나왔다. 견본 그림의 배경이 그렇기
   *   때문이다. 견본은 힘이 세서, 쓰라고 준 것 말고도 따라온다. ⇒ 무엇을 «안» 보는지 적는다. */
  const 같은것 = `Reproduce THIS EXACT character — the one in the reference image — at much
higher resolution. Same silhouette, same proportions, same colour. Not a similar character:
the same one. Only the expression is as described below.
🔴 Use the reference ONLY for the character's shape, colour and markings. IGNORE the
reference's background completely — ignore its surface, its floor, its wall, its grey tone and
its shadow. Those belong to the old photograph, not to this one.`;
  return [판.카메라, 배경, 같은것, 몸, 판.얼굴, 빛, 금지].join('\n\n');
}

function 참조경로(판) {
  const p = path.join(판.누구 === '몽글' ? 몽글정본 : 까몽정본, 판.참조);
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
  if (!대상.length) { console.error(`고를 판이 없다 — --누구 는 몽글·까몽 · --판 은 1~${판들.length}`); process.exit(1); }

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
