/**
 * 옷 목록 — 마스코트 셋에게 «각자» 스무 벌씩 (2026-09-06 · 유호 지시 「각 마스코트당 의상
 * (악세사리포함) 20개씩 · 최대한 다양하게 각각의 고유의 개성을 표시할수있는 악세사리나
 * 고유의 체형에 맞는 옷 · 버려지는거 없도록」).
 *
 * ■ 왜 셋으로 갈랐나 (09-06 실측)
 *   같은 문장을 셋에게 똑같이 먹이면 몸이 다른 만큼 버려진다.
 *   겨울 델의 「소맷부리」 한 마디가 몽글에게 «없던 팔»을 만들었는데, 마린은 원래 뭉툭한 팔이
 *   있어 같은 말이 아무 문제가 아니었다. 그래서 목록도 문장도 몸마다 다르다.
 *   그리고 그 몸에 안 서는 옷은 «아예 안 굽는다» — 굽고 버리면 그게 낭비다:
 *     · 까몽은 위에서 내려다본 컷이라 치마·저고리처럼 «아래»에 걸리는 옷이 거의 안 보인다
 *     · 몽글은 허리가 없어 허리띠가 걸릴 자리가 없다
 *     · 댕기는 뒤통수에 매는 것이라 정면 컷에서 몫을 못 한다(셋 다 뺐다)
 *
 * ■ 입는 규칙 (유호 확정 09-06)
 *   의상 최대 1 + 악세 최대 2 = 한 번에 셋까지. 그래서 항목마다 `갈래`가 붙는다.
 *
 * ■ 고유 항목은 지어내지 않았다
 *   가이드 정본(`docs/캐릭터/가이드_정본.md`) §3-1 ⑦ 「내 물건 셋」에서 그대로 왔다:
 *     몽글 = 주머니 속 이상한 돌 · 까몽 = 담요 · 「전설의 까몽」 삐뚤한 팻말
 *     마린 = 주머니의 흰 꽃 · 체크 목록
 *
 * ■ 성과 옷 일곱은 셋 다 갖는다 (유호 확정 09-05 · 해낸 기록이라 마스코트를 안 가린다)
 */
'use strict';

/* ── 마스코트 셋 — 참조 그림 · 그 아이만의 표식 · 옷을 어떻게 짓나 ─────────── */
const 마스코트 = require('./마스코트자산.js');

const 마스코트들 = [
  {
    이름: '몽글',
    참조: 마스코트.경로('본체'),
    눈: '검정',
    표식:
      'The character is a coral needle-felted wool ghost doll. Its whole silhouette is ONE ' +
      'continuous bell falling from the top of the head all the way to the hem: no neck, no ' +
      'shoulders, no waist, no arms and no legs anywhere. The head is a smooth dome and it is ' +
      'about half of the doll\'s whole height. The bottom hem is scalloped into five soft ' +
      'scallops with one line of cream running stitch along it, and the face has exactly two ' +
      'small round glossy black bead eyes set wide apart. ' +
      'Because it has no arms, its clothes are cut WITHOUT sleeves and without trouser legs — ' +
      'they are wraps and covers that follow the bell. No sleeve, no cuff, no hand and no foot ' +
      'appears anywhere in the picture. Anything carried hangs from a strap over the body. ' +
      'Head pieces sit on the top curve of the dome. ',
  },
  {
    이름: '까몽',
    참조: 마스코트.까몽경로('본체'),
    눈: '검정',
    표식:
      'The character is a very small round creature of long soft charcoal-brown fur, with two ' +
      'short triangular ears, two small dark front paws reaching out to the sides, and a slim ' +
      'tail ending in a coral paddle with four tiny cream dots. Its eyes are large and round ' +
      'with a bright apple-green iris ring around a glossy black pupil, both equally bright. ' +
      'It is photographed from DIRECTLY ABOVE, lying spread out flat — keep that top-down view. ' +
      'So the garment is seen from above: it lies over its back and around its neck, and the ' +
      'long fur still fluffs out around every edge of it. ' +
      'The two ears, the two front paws and the coral tail paddle are never covered or hidden — ' +
      'they always stay fully visible, because they are what makes it this creature. ',
  },
  {
    이름: '마린',
    참조: 마스코트.마린경로('본체'),
    눈: '버터',
    표식:
      'The character is a tiny felt astronaut doll: a smooth deep navy helmet taking up about ' +
      'three quarters of its height, with two big round butter-yellow glowing lenses set low ' +
      'and level instead of eyes, over a very small oatmeal-cream body with a scalloped hem, ' +
      'stubby arms and two round feet. ' +
      'Because the helmet is most of the character, head pieces sit ON the helmet and body ' +
      'garments fit the small body below it, which means body garments are small and short. ' +
      'The two lenses stay clearly visible and equally bright — nothing dims them, darkens them ' +
      'or hides one of them. ',
  },
];

/* ── 공용 열셋 — 셋 다 입는 것 ────────────────────────────────────────────
 * 🔑 문장에 «소매·소맷부리»를 안 쓴다. 그 낱말이 팔 없는 몽글에게 팔을 만든다(09-06 실측).
 *   소매가 필요한지는 문장이 아니라 마스코트의 «표식»이 정한다.
 */
const 공용 = [
  { 이름: '목도리', 갈래: '악세', 설명:
    'A chunky hand-knitted scarf in cream and coral stripes is wrapped once around its neck and ' +
    'crossed at the front, the two ends hanging down with short tassels. The wool is thick so the ' +
    'ribbing stands out, and the scarf presses softly into the body where it wraps.' },
  { 이름: '털모자', 갈래: '악세', 설명:
    'A small knitted bobble hat in warm oatmeal cream sits on its head, the ribbed brim turned up ' +
    'once and a soft cream pom-pom on top. The hat follows the curve of the head underneath.' },
  { 이름: '몽골 모자', 갈래: '악세', 설명:
    'A small pointed Mongolian hat sits on its head — deep lapis-blue felt with an upturned brim ' +
    'of cream lambswool and a tiny coral knot at the very top. It follows the curve of the head.' },
  { 이름: '안경', 갈래: '악세', 설명:
    'A pair of small round spectacles rests in front of its eyes, the thin frame made of coral ' +
    'felt cord curving around the head, the lenses clear glass so the eyes show fully through them.' },
  { 이름: '학생 가방', 갈래: '악세', 설명:
    'A small satchel of butter-yellow felt hangs at its side from one cream strap that crosses ' +
    'over the body, the flap closed with a tiny coral button and one row of cream running stitch ' +
    'along the flap edge. The strap presses very slightly into the wool where it crosses.' },
  { 이름: '펠트 헤드폰', 갈래: '악세', 설명:
    'A pair of soft felt headphones sits over its head — two round coral ear cups joined by a ' +
    'padded cream headband that follows the curve of the head, with one line of cream running ' +
    'stitch around each cup.' },
  { 이름: '앞치마', 갈래: '의상', 설명:
    'A little linen apron in natural oat colour is tied over the front of its body, one cream ' +
    'strap going up and around, a narrow coral trim along the bottom edge and one small patch ' +
    'pocket. The apron hangs flat and follows the swell of the body under it.' },
  { 이름: '여름 델', 갈래: '의상', 설명:
    'It wears a summer Mongolian deel: a light wrap robe of pale sky-blue felt crossing right ' +
    'over left at the chest, fastened at the shoulder with three small cream knot buttons, with ' +
    'a narrow cream band edging the collar and the front opening. The robe follows the body and ' +
    'falls in soft folds.' },
  { 이름: '겨울 델', 갈래: '의상', 설명:
    'It wears a winter Mongolian deel: a thick padded wrap robe of deep lapis-blue felt crossing ' +
    'right over left, with a wide band of cream lambswool trimming the collar and the front ' +
    'edge, and three coral knot buttons at the shoulder. The padding gives it real weight and ' +
    'the folds are deep and soft.' },
  { 이름: 'SYNK 후드', 갈래: '의상', 설명:
    'It wears a small hoodie of soft oatmeal-cream felt. The lapis-blue lined hood is pushed ' +
    'BACK off the head and lies folded on its shoulders, so the whole face stays uncovered. ' +
    'There is a kangaroo pocket across the front and the four letters S Y N K embroidered small ' +
    'and neat in lapis-blue thread on the chest. The hoodie is soft and slightly oversized.' },
  { 이름: '1급 배지 코트', 갈래: '의상', 성과: true, 설명:
    'It wears a short open coat of soft chalk-white felt with a rounded collar and a narrow ' +
    'lapis-blue band along the front edges. On the left chest is one small round badge of coral ' +
    'felt with a single cream embroidered bar across it. Quiet and neat, not military.' },
  { 이름: '2급 배지 코트', 갈래: '의상', 성과: true, 설명:
    'It wears a short open coat of soft chalk-white felt with a rounded collar and a wider ' +
    'lapis-blue band along the front edges and around the bottom hem. On the left chest is one ' +
    'small round badge of coral felt with two cream embroidered bars across it. Quiet and neat.' },
  { 이름: '3급 왕관', 갈래: '악세', 성과: true, 설명:
    'A small soft crown of butter-yellow felt sits on its head — five rounded points, each tipped ' +
    'with a tiny cream bead, and one line of cream running stitch around the band. The crown is ' +
    'soft and slightly squashy, clearly hand-sewn, not metal.' },
];

/* ── 성과 옷 넷 더 — 출석 셋 + 첫 목소리 (유호 확정 09-06 「자라는 식물로 가자」) ──── */
const 성과더 = [
  { 이름: '한 달 출석 새싹', 갈래: '악세', 성과: true, 설명:
    'One small brooch is pinned on the front of its body — a single green felt sprout with two ' +
    'tiny rounded leaves rising from a chalk-white felt disc, edged in cream blanket stitch.' },
  { 이름: '3개월 출석 잎망토', 갈래: '의상', 성과: true, 설명:
    'It wears a short shoulder cape of soft meadow-green felt fastened at the throat with one ' +
    'cream cord, its lower edge cut into three broad rounded leaf shapes, each with one line of ' +
    'cream running stitch down its middle like a leaf vein.' },
  { 이름: '6개월 출석 화관', 갈래: '악세', 성과: true, 설명:
    'A soft flower crown rests on its head — a ring of meadow-green felt leaves with five small ' +
    'open flowers worked in coral and butter-yellow felt, each with a centre of tiny cream beads. ' +
    'The ring follows the curve of the head.' },
  { 이름: '첫 목소리 목도리', 갈래: '악세', 성과: true, 설명:
    'A soft narrow scarf of chalk-white felt is looped once around its neck, the two ends hanging ' +
    'short and straight, with one small coral musical note embroidered near the end of the left ' +
    'side. Plainer and lighter than a winter scarf.' },
];

/* ── 그 아이만의 것 — 가이드 정본 §3-1 ⑦ 「내 물건 셋」에서 왔다 ───────────── */
const 고유 = {
  몽글: [
    { 이름: '저고리', 갈래: '의상', 설명:
      'It wears a hanbok jeogori jacket: short, cut from soft chalk-white felt, crossing at the ' +
      'front with a wide coral collar band (git) and a long coral ribbon (goreum) tied in one ' +
      'loose bow that hangs down. It is short and softly rounded, ending high on the body.' },
    { 이름: '치마', 갈래: '의상', 설명:
      'It wears a hanbok chima skirt: a full high-waisted wrap skirt of soft lapis-blue felt ' +
      'gathered into a wide cream band across the upper body, falling in many soft vertical ' +
      'folds all the way down and flaring gently at the bottom.' },
    /* §3-1 ⑦ — 「주머니 속 이상한 돌 여럿(예쁜 건 마린에게 준다)」 */
    { 이름: '돌 주머니', 갈래: '악세', 고유: true, 설명:
      'A small open pouch of oat linen hangs against its body from one cream strap over the ' +
      'shoulder, and three little smooth pebbles peek out of the top — one grey, one speckled ' +
      'cream, one with a pale stripe. The pouch is a bit too full and bulges softly.' },
    /* §3 ① — 「햇빛 드는 자리」를 좋아한다 */
    { 이름: '창가 밀짚모자', 갈래: '악세', 고유: true, 설명:
      'A small soft straw-coloured felt sun hat with a wide floppy brim sits on its head, a thin ' +
      'coral ribbon band around the crown tied in a small bow at the side, the brim dipping ' +
      'gently at the front the way a well-worn hat does.' },
  ],
  까몽: [
    { 이름: '조끼', 갈래: '의상', 설명:
      'It wears a short sleeveless hanbok vest (baeja) of deep coral felt over its back and ' +
      'shoulders, open at the front, edged all round with a narrow cream band and closed with ' +
      'one small cream knot button.' },
    /* §3-1 ⑦ — 「담요(무서운 날용 — 「추워서」라고 한다)」 */
    { 이름: '담요 망토', 갈래: '의상', 고유: true, 설명:
      'A small thick blanket of soft butter-yellow felt with a cream checked border is draped ' +
      'over its back and shoulders like a cape, one corner pulled up near the neck, the wool ' +
      'thick and heavy so it folds in deep soft creases.' },
    /* §3-1 ⑦ — 「「전설의 까몽」이라 쓴 삐뚤한 팻말(본인 글씨)」 */
    { 이름: '전설의 팻말', 갈래: '악세', 고유: true, 설명:
      'A small hand-made wooden-felt signboard hangs on its chest from a cream cord around the ' +
      'neck — an oat-coloured felt rectangle with a slightly crooked coral border stitched by ' +
      'hand, the whole thing hanging a little askew. There is no writing on it, only the border.' },
    /* §3 ① — 「반짝이는 것」을 좋아한다 */
    { 이름: '반짝이 목걸이', 갈래: '악세', 고유: true, 설명:
      'A short necklace of round felt beads sits around its neck — cream, butter-yellow and ' +
      'coral beads alternating, with one slightly larger butter-yellow bead hanging at the ' +
      'front, each bead a tiny tight ball of felted wool.' },
  ],
  마린: [
    { 이름: '조끼', 갈래: '의상', 설명:
      'It wears a short sleeveless vest of deep coral felt over its small body, open at the ' +
      'front, edged all round with a narrow cream band and closed with one small cream knot ' +
      'button at the chest.' },
    /* 마린 몸에 맞는 «작은 몸» 의상 — 헬멧이 키의 3/4 이라 몸 옷은 짧다 */
    { 이름: '임무 조끼', 갈래: '의상', 고유: true, 설명:
      'It wears a small utility vest of oat-coloured felt over its little body, with two square ' +
      'patch pockets on the front, each closed by a flap with one tiny cream button, and one ' +
      'narrow lapis-blue band running along the bottom edge. Tidy and exactly symmetrical.' },
    /* §3-1 ⑦ — 「주머니의 흰 꽃(어디서 났는지는 안 말한다)」 */
    { 이름: '흰 꽃 한 송이', 갈래: '악세', 고유: true, 설명:
      'One small white felt flower with five rounded petals and a tiny butter-yellow centre is ' +
      'tucked into the front of its body, its short green stem slipping down out of sight. It ' +
      'sits slightly off-centre, as if put there quickly and not adjusted since.' },
    /* §3-1 ⑦ — 「체크 목록(매일 새로)」 · §3 ③ 「끝나면 목록에 체크」 */
    { 이름: '체크 목록 걸이', 갈래: '악세', 고유: true, 설명:
      'A small clipboard of oat felt hangs at its side from a cream cord — a rounded rectangle ' +
      'with a coral felt clip at the top holding one chalk-white felt sheet, and three tiny ' +
      'coral stitched check marks down the sheet. No letters anywhere.' },
  ],
};

/** 마스코트별 스무 벌 — 공용 13 + 성과더 4 + 고유 4 (고유 중 하나는 공용 자리를 대신한다). */
function 목록(이름) {
  const m = 마스코트들.find((x) => x.이름 === 이름);
  if (!m) throw new Error(`모르는 마스코트: ${이름}`);
  const 것들 = [...공용, ...성과더, ...고유[이름]];
  /* 🔑 스무 벌 «이상»인지 그 자리에서 센다 — 유호 09-06 「20개씩은 준비되었으면 해」.
     모자라면 조용히 넘어가지 않는다. 지금은 13 + 4 + 4 = 21 이다.
     ⚠ 이름이 겹치면 한 벌을 두 번 굽는 셈이니 그것도 여기서 운다. */
  const 이름들 = new Set(것들.map((x) => x.이름));
  if (이름들.size !== 것들.length) {
    throw new Error(`${이름}: 같은 이름이 둘 있다 — ${것들.length}벌 중 ${이름들.size}가지`);
  }
  if (것들.length < 20) {
    throw new Error(`${이름}: ${것들.length}벌뿐이다 — 유호 확정은 스무 벌 이상이다`);
  }
  return 것들.map((x) => ({ ...x, 마스코트: m }));
}

module.exports = { 마스코트들, 공용, 성과더, 고유, 목록 };
