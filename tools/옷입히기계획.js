#!/usr/bin/env node
/**
 * 옷입히기 계획 — 「마스코트에게 무엇을 입혀 굽는가」의 씨앗 목록 (2026-09-05 밤 신설).
 *
 * 이 도구는 **굽지 않는다.** 계획(`docs/공방/계획.json`)에 묶음 둘을 넣기만 한다.
 * 굽는 것은 늘 쓰던 두 배치가 한다 — 그래야 값·게이트·40초 사이·뒤처리가 한 벌로 돈다.
 *   낮: `node tools/공방굽기.js --묶음 "옷입히기"`
 *   밤: `node tools/밤굽기.js  --묶음 "옷입히기" --돈 30000`
 *
 * ■ 왜 이 파일이 있나
 *   옷은 «마스코트에게 씌운 채» 굽는다(유호 확정 09-05 밤 「씌운 채가 정말 자연스럽고 좋아」).
 *   그래서 항목마다 **참조 그림**(그 마스코트의 정본)과 **그 마스코트만의 지키는 문장**이 붙는다.
 *   같은 옷이라도 몽글·까몽·마린이 서로 다른 문장을 받아야 해서, 23벌을 손으로 69번 적는 대신
 *   여기서 «옷 설명 × 마스코트 셋»으로 펴 낸다. 펴 낸 결과가 계획에 들어가면 그때부터
 *   **정본은 계획.json** 이다(이 파일은 씨앗이지 주인이 아니다).
 *
 * ■ 설계 정본 = `docs/옷입히기_설계_v1.md` · 인계문 = `docs/_ops/인계_옷입히기_0905.md`
 *   촬영 규격 「입힘」 = `tools/lib/공방규격.js`(급소·재는 자가 그 주석에 있다)
 *
 * 쓰는 법:
 *   node tools/옷입히기계획.js            # 목록만 본다(아무것도 안 바꾼다)
 *   node tools/옷입히기계획.js --넣기      # 계획.json 에 넣는다
 *   node tools/옷입히기계획.js --넣기 --그래도   # 굽기가 도는 중이어도 넣는다(권하지 않는다)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const 루트 = path.resolve(__dirname, '..');
const 계획경로 = path.join(루트, 'docs/공방/계획.json');
const 마스코트 = require('./lib/마스코트자산.js');

/* ── 마스코트 셋 — 참조 그림과 «그 아이만의 표식» ────────────────────────────
 *
 * 🔴 지키는 문장을 셋으로 가른 까닭(09-05 밤 실측): 시험 지시문에 몽글의 표식
 *   («가리비 밑단의 옅은 노랑 홈질»)이 통째로 박혀 있었다. 그대로 까몽·마린에 쓰면
 *   **없는 밑단을 그리라고 시키는 셈**이라 몸이 딴것이 된다.
 *   ⇒ 공통(눈 자리·실루엣·다시 그리지 마라)은 규격 「입힘」이 들고,
 *     아래는 «그 아이에게만 있는 것» + «옷이 어디에 앉나»만 든다.
 *
 * ⚠ 「어디에 앉나」가 왜 필요한가 — 셋의 몸이 서로 다르다.
 *   몽글은 팔·다리가 없어 가방을 «들» 수 없고(어깨에 두르는 끈으로 앉힌다),
 *   마린은 키의 3/4 가 헬멧이라 모자·왕관이 «헬멧 위»에 앉으며,
 *   까몽은 위에서 내려다본 컷이라 옷이 «등 쪽에서» 보인다. */
const 마스코트들 = [
  {
    이름: '몽글',
    참조: 마스코트.경로('본체'),
    표식:
      /* 🔴 09-06 실측으로 세 줄이 늘었다 — 겨울 델 시험에서 팔이 생기고 머리가 작아졌다.
       *   「팔이 없다」만으로는 부족했다: «종 하나»라는 실루엣과 «그래서 옷을 어떻게 짓나»를
       *   같이 말해야 모델이 몸을 다시 짜지 않는다. */
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
    표식:
      'The character is a very small round creature of long soft charcoal-brown fur, with two ' +
      'short triangular ears, two small dark front paws reaching out to the sides, and a slim ' +
      'tail ending in a coral paddle with four tiny cream dots. Its eyes are large and round ' +
      'with a bright apple-green iris ring around a glossy black pupil, both equally bright. ' +
      'It is photographed from DIRECTLY ABOVE, lying spread out flat — keep that top-down view, ' +
      'so the garment is seen from above, lying over its back and around its neck, and the fur ' +
      'still fluffs out around every edge of it. ',
  },
  {
    이름: '마린',
    참조: 마스코트.마린경로('본체'),
    표식:
      'The character is a tiny felt astronaut doll: a smooth deep navy helmet taking up about ' +
      'three quarters of its height, with two big round butter-yellow glowing lenses set low ' +
      'and level instead of eyes, over a very small oatmeal-cream body with a scalloped hem, ' +
      'stubby arms and two round feet. ' +
      /* ⚠ 「렌즈를 아무것도 안 가린다」로 쓰면 안경·선글라스와 부딪힌다(그 둘은 렌즈 «앞»에 선다).
       *   그래서 막는 것은 «가림»이 아니라 «어두워짐»이다 — 두 렌즈는 늘 또렷하고 똑같이 밝다. */
      'Because the helmet is most of the character, head pieces sit ON the helmet and body ' +
      'garments fit the small body below it. The two lenses stay clearly visible and equally ' +
      'bright — nothing dims them, darkens them or hides one of them. ',
  },
];

/* ── 옷 스물세 벌 ─────────────────────────────────────────────────────────
 * 목록의 주인 = `docs/옷입히기_설계_v1.md` §4-1(동전 옷 16)·§4-2(성과 옷 7).
 * 유호 확정 09-05 — 동전 옷 열여섯은 초안대로 · 성과 옷은 일곱.
 *
 * 🔴 «가림» 칸은 급소의 자다 — 가리는 넓이가 늘수록 마스코트가 더 다시 그려진다(09-05 실측).
 *   작음 = 꽃핀·선글라스 급(거의 안 무너진다) · 큼 = 목도리 급(눈이 뚜렷이 커진다) ·
 *   아주큼 = 몸을 통째로 덮는 것(안 재봤다). 시험을 «아주큼»부터 던져야 값이 싸게 나온다.
 */
const 옷들 = [
  /* ① 기본 넷 */
  { 이름: '목도리', 라인: '기본', 가림: '큼', 설명:
    'A chunky hand-knitted scarf in cream and coral stripes is wrapped once around its neck and ' +
    'crossed at the front, the two ends hanging down with short tassels. The wool is thick so the ' +
    'ribbing stands out, and the scarf presses softly into the body where it wraps.' },
  { 이름: '털모자', 라인: '기본', 가림: '작음', 설명:
    'A small knitted bobble hat in warm oatmeal cream sits on its head, the ribbed brim turned up ' +
    'once and a soft cream pom-pom on top. The hat follows the curve of the head underneath.' },
  { 이름: '앞치마', 라인: '기본', 가림: '큼', 설명:
    'A little linen apron in natural oat colour is tied over the front of its body, one cream ' +
    'strap going up and around, a narrow coral trim along the bottom edge and one small patch ' +
    'pocket. The apron hangs flat and follows the swell of the body under it.' },
  { 이름: '안경', 라인: '기본', 가림: '작음', 설명:
    'A pair of small round spectacles rests in front of its eyes, the thin frame made of coral ' +
    'felt cord curving around the head, the lenses clear glass so the eyes show fully through them.' },

  /* ② 델(몽골) 넷 */
  { 이름: '여름 델', 라인: '델', 가림: '아주큼', 설명:
    'It wears a summer Mongolian deel: a light wrap robe of pale sky-blue felt crossing right ' +
    'over left at the chest, fastened at the shoulder with three small cream knot buttons, with ' +
    'a narrow cream band edging the collar and the front opening. The robe follows the body and ' +
    'falls in soft folds.' },
  { 이름: '겨울 델', 라인: '델', 가림: '아주큼', 설명:
    'It wears a winter Mongolian deel: a thick padded wrap robe of deep lapis-blue felt crossing ' +
    'right over left, with a wide band of cream lambswool trimming the collar and the front ' +
    'edge, and three coral knot buttons at the shoulder. The padding gives it real weight ' +
    'and the folds are deep and soft.' },
  { 이름: '허리띠', 라인: '델', 가림: '큼', 설명:
    'A wide Mongolian sash (bus) of butter-yellow felt is wound twice around its waist and knotted ' +
    'at the side, one end hanging down. The sash pulls in gently where it wraps, so the body ' +
    'gathers a little above and below it.' },
  { 이름: '몽골 모자', 라인: '델', 가림: '작음', 설명:
    'A small pointed Mongolian hat sits on its head — deep lapis-blue felt with an upturned brim ' +
    'of cream lambswool and a tiny coral knot at the very top. It follows the curve of the head.' },

  /* ③ 한복 넷 */
  { 이름: '저고리', 라인: '한복', 가림: '큼', 설명:
    'It wears a hanbok jeogori jacket: short, cut from soft chalk-white felt, crossing at the ' +
    'front with a wide coral collar band (git) and a long coral ribbon (goreum) tied in one loose ' +
    'bow that hangs down. It is short and softly rounded, ending high on the body.' },
  { 이름: '치마', 라인: '한복', 가림: '아주큼', 설명:
    'It wears a hanbok chima skirt: a full high-waisted wrap skirt of soft lapis-blue felt ' +
    'gathered into a wide cream band across the chest, falling in many soft vertical folds all ' +
    'the way down and flaring gently at the bottom.' },
  { 이름: '조끼', 라인: '한복', 가림: '큼', 설명:
    'It wears a short sleeveless hanbok vest (baeja) of deep coral felt over its body, open at ' +
    'the front, edged all round with a narrow cream band and closed with one small cream knot ' +
    'button at the chest.' },
  { 이름: '댕기', 라인: '한복', 가림: '작음', 설명:
    'A long hanbok daenggi ribbon of deep coral silk-felt is tied at the back of its head in a ' +
    'wide flat bow, the two ends hanging down behind and just visible at the sides, with one row ' +
    'of tiny cream embroidered dots along each end.' },

  /* ④ 학원 넷 */
  { 이름: 'SYNK 후드', 라인: '학원', 가림: '아주큼', 설명:
    'It wears a small hoodie of soft oatmeal-cream felt with a lapis-blue drawstring hood pushed ' +
    'back on its shoulders, a kangaroo pocket across the front, and the four letters S Y N K ' +
    'embroidered small and neat in lapis-blue thread on the chest. The hoodie is soft and ' +
    'slightly oversized.' },
  { 이름: '학생 가방', 라인: '학원', 가림: '큼', 설명:
    'A small satchel of butter-yellow felt hangs at its side from one cream strap that crosses ' +
    'over the body, the flap closed with a tiny coral button and one row of cream running stitch ' +
    'along the flap edge. The strap presses very slightly into the wool where it crosses.' },
  { 이름: '이름표 와펜', 라인: '학원', 가림: '작음', 설명:
    'A small rounded name patch is stitched onto the front of its body — a chalk-white felt oval ' +
    'edged in coral blanket stitch with two blank coral embroidered lines across it where a name ' +
    'would go. No readable letters.' },
  { 이름: '펠트 헤드폰', 라인: '학원', 가림: '작음', 설명:
    'A pair of soft felt headphones sits over its head — two round coral ear cups joined by a ' +
    'padded cream headband that follows the curve of the head, with one line of cream running ' +
    'stitch around each cup.' },

  /* ⑤ 성과 옷 일곱 (§4-2 · 못 사고 못 준다 — 「한 일」로만 열린다) */
  { 이름: '1급 배지 코트', 라인: '성과', 가림: '아주큼', 설명:
    'It wears a short open coat of soft chalk-white felt with a rounded collar and a narrow ' +
    'lapis-blue band along the front edges. On the left chest is one small round badge of coral ' +
    'felt with a single cream embroidered bar across it. Quiet and neat, not military.' },
  { 이름: '2급 배지 코트', 라인: '성과', 가림: '아주큼', 설명:
    'It wears a short open coat of soft chalk-white felt with a rounded collar and a wider ' +
    'lapis-blue band along the front edges and around the bottom hem. On the left chest is one small round ' +
    'badge of coral felt with two cream embroidered bars across it. Quiet and neat, not military.' },
  { 이름: '3급 왕관', 라인: '성과', 가림: '작음', 설명:
    'A small soft crown of butter-yellow felt sits on its head — five rounded points, each tipped ' +
    'with a tiny cream bead, and one line of cream running stitch around the band. The crown is ' +
    'soft and slightly squashy, clearly hand-sewn, not metal.' },
  /* ✅ 출석 셋의 생김새 = **자라는 식물 한 줄**(유호 확정 09-06 「자라는 식물로 가자」).
   *   출석은 «쌓임»이라 자라는 것이 결에 맞고, 셋이 서로 다른 자리(가슴·어깨·머리)에 앉아 겹치지 않는다. */
  { 이름: '한 달 출석 새싹', 라인: '성과', 가림: '작음', 설명:
    'One small brooch is pinned on the front of its body — a single green felt sprout with two ' +
    'tiny rounded leaves rising from a chalk-white felt disc, edged in cream blanket stitch.' },
  { 이름: '3개월 출석 잎망토', 라인: '성과', 가림: '큼', 설명:
    'It wears a short shoulder cape of soft meadow-green felt fastened at the throat with one ' +
    'cream cord, its lower edge cut into three broad rounded leaf shapes, each with one line of ' +
    'cream running stitch down its middle like a leaf vein.' },
  { 이름: '6개월 출석 화관', 라인: '성과', 가림: '작음', 설명:
    'A soft flower crown rests on its head — a ring of meadow-green felt leaves with five small ' +
    'open flowers worked in coral and butter-yellow felt, each with a centre of tiny cream beads. ' +
    'The ring follows the curve of the head.' },
  { 이름: '첫 목소리 목도리', 라인: '성과', 가림: '큼', 설명:
    'A soft narrow scarf of chalk-white felt is looped once around its neck, the two ends hanging ' +
    'short and straight, with one small coral musical note embroidered near the end of the left ' +
    'side. Plainer and lighter than a winter scarf.' },
];

/* ── 옷 가게 물건 셋 — 참조 없이 굽는다(마스코트가 안 나온다) ──────────────
 * 🔴 상인 «아주머니» 표정 셋은 여기 «없다.** 새 캐릭터라 생김새를 유호님이 고르셔야 한다
 *   (마린이 후보 넷을 놓고 골랐던 그 자리와 같다). 설계 §10 의 「75장」 중 이 셋이 빠져
 *   지금 굽을 수 있는 것은 72장이다 — 숨기지 않고 여기에 적는다. */
const 가게물건 = [
  { 이름: '옷 가게 좌판', 규격: '장면', 설명:
    'A small market stall counter made of wool felt: a low wooden-felt table draped with an ' +
    'oatmeal linen cloth that hangs over the front edge in soft folds, empty and ready for goods ' +
    'to be laid on it, with one narrow coral band running along the cloth edge.' },
  { 이름: '펠트 주머니', 설명:
    'A small drawstring pouch of oatmeal-cream felt, gathered at the top by a coral cord tied in ' +
    'a bow, its body rounded and slightly full as if a few small things sit inside, with one line ' +
    'of cream running stitch around the base.' },
  { 이름: '펠트 동전', 설명:
    'A single round coin of butter-yellow felt, flat like a large button, its edge worked in cream ' +
    'blanket stitch, with one small coral circle stitched in the centre. No letters and no numbers ' +
    'anywhere on it.' },
];

/* ── 펴 내기 ───────────────────────────────────────────────────────────── */

/** 파일 이름에 쓸 쇠 — 공백만 걷는다(한글은 그대로 · 다른 공방 자산과 같은 규율). */
const 쇠로 = (s) => s.replace(/\s+/g, '');

function 옷항목들() {
  const 것들 = [];
  for (const m of 마스코트들) {
    for (const 옷 of 옷들) {
      것들.push({
        이름: `${m.이름} ${옷.이름}`,
        상태: '아직',
        쇠: `공방_옷_${m.이름}_${쇠로(옷.이름)}`,
        규격: '입힘',
        지시: m.표식 + 옷.설명,
        참조: [m.참조],
      });
    }
  }
  return 것들;
}

function 가게항목들() {
  return 가게물건.map((x) => ({
    이름: x.이름,
    상태: '아직',
    쇠: `공방_${쇠로(x.이름)}`,
    규격: x.규격 || '부품',
    지시: x.설명,
  }));
}

const 묶음들 = () => [
  {
    이름: '옷입히기',
    '쓰는 곳': '학생 앱 옷장·옷 가게 · 라디오 무대 차림 · 시즌 책 · 졸업 카드',
    상태: `0/${옷들.length * 마스코트들.length}`,
    것들: 옷항목들(),
  },
  {
    이름: '옷 가게 물건',
    '쓰는 곳': '옷 가게 화면 · 주머니(동전 잔액) 화면',
    상태: `0/${가게물건.length}`,
    것들: 가게항목들(),
  },
];

/* ── 굽기가 도는 중인가 ────────────────────────────────────────────────────
 * 🔴 도는 중에 계획을 고치면 내 줄이 사라진다 — 배치가 장마다 «자기 기억의 계획»을 통째로
 *   다시 쓰기 때문이다(트랙 §0-공방). 그래서 넣기 전에 물어보고, 돌면 물러난다.
 * ⚠ tasklist 는 안 쓴다(트랙 규약) — Win32_Process 로 명령줄까지 본다. */
function 굽는중() {
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
    "(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | " +
    "Where-Object { $_.CommandLine -match '굽기\\.js' } | " +
    'Select-Object -ExpandProperty ProcessId) -join ","'], { encoding: 'utf8' });
  if (r.status !== 0) return null;                       // 못 재봤다 — 「없다」로 읽지 않는다
  const 줄 = String(r.stdout || '').trim();
  return 줄 ? 줄.split(',').filter(Boolean) : [];
}

/* 🔑 시험 굽기가 «같은 문장»을 쓰게 창구를 낸다 — 지시문을 시험 쪽에 다시 적으면
 *   그 순간 두 곳이 한 값을 알게 되고, 시험에서 통과한 문장과 실제로 굽는 문장이 갈린다
 *   (기억 constant-known-in-two-places). 계획에 넣기 «전»에도 이 창구로 꺼내 쓴다. */
module.exports = { 묶음들, 옷들, 마스코트들, 가게물건 };

/* ── 실행 ─────────────────────────────────────────────────────────────── */

if (require.main !== module) return;

const 인자 = process.argv.slice(2);
const 넣나 = 인자.includes('--넣기');
const 그래도 = 인자.includes('--그래도');

const 새묶음 = 묶음들();
const 총장수 = 새묶음.reduce((n, b) => n + b.것들.length, 0);

if (!넣나) {
  console.log(`\n■ 옷입히기 계획 씨앗 — ${새묶음.length}묶음 · ${총장수}장`);
  for (const b of 새묶음) {
    console.log(`\n  [${b.이름}] ${b.것들.length}장 — ${b['쓰는 곳']}`);
    for (const 것 of b.것들) {
      console.log(`     ${것.메모 ? '✎' : '·'} ${것.이름}${것.참조 ? ` (참조 ${path.basename(것.참조[0])})` : ''}`);
    }
  }
  const 가림별 = {};
  for (const 옷 of 옷들) 가림별[옷.가림] = (가림별[옷.가림] || 0) + 1;
  console.log(`\n  가림 넓이 — ${Object.entries(가림별).map(([k, v]) => `${k} ${v}벌`).join(' · ')}`);
  console.log('  🔴 「아주큼」은 아직 한 장도 안 재봤다 — 시험은 거기서 시작한다(목도리보다 더 무너질 수 있다).');
  console.log('\n  넣으려면: node tools/옷입히기계획.js --넣기');
  console.log('  넣고 굽기: node tools/공방굽기.js --묶음 "옷입히기" --것 "겨울 델"\n');
  process.exit(0);
}

const 도는것 = 굽는중();
if (도는것 === null) {
  console.error('\n🔴 굽기가 도는지 «못 재봤다»(Win32_Process 조회 실패). 재보고 다시 온다.\n');
  process.exit(1);
}
if (도는것.length && !그래도) {
  console.error(`\n🔴 굽기가 돌고 있다(pid ${도는것.join(', ')}). 지금 계획을 고치면 이 줄이 사라진다 —`
    + '\n   배치가 장마다 자기 기억의 계획을 통째로 다시 쓴다(트랙 §0-공방).'
    + '\n   배치가 끝난 뒤에 다시 온다. 정말 지금이면 --그래도 를 붙인다.\n');
  process.exit(1);
}

const 계획 = JSON.parse(fs.readFileSync(계획경로, 'utf8'));
const 있는것 = new Set(계획.제미나이.묶음.map((b) => b.이름));
const 넣은것 = [];
for (const b of 새묶음) {
  if (있는것.has(b.이름)) { console.log(`⏭ [${b.이름}] 이미 계획에 있다 — 손대지 않는다(덮어쓰면 구운 상태가 지워진다).`); continue; }
  계획.제미나이.묶음.push(b);
  넣은것.push(`${b.이름} ${b.것들.length}장`);
}
if (!넣은것.length) { console.log('\n■ 넣을 것이 없다 — 계획은 그대로다.\n'); process.exit(0); }

fs.writeFileSync(계획경로, JSON.stringify(계획, null, 2) + '\n');
console.log(`\n✅ 계획에 넣었다 — ${넣은것.join(' · ')}`);
console.log('   다음: node tools/공방지면.js (고르는 판 다시 굽기) → 커밋\n');
