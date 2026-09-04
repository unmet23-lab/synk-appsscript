#!/usr/bin/env node
/* 라디오무대굽기 — 24시간 라디오 화면의 «있을 곳»을 굽는다. (유호 지시 2026-09-02)
 *
 *   「배경이 너무 허전해서 휴양지나 정말 아름다운 자연이나 드림코어형식의 배경으로
 *    디테일하고 트렌디하게 만들어줘」
 *
 * ■ 왜 «굽나» — CSS 로는 못 만든다.
 *   첫 판(09-02 새벽)은 양모천 한 장 + 마스코트였다. 24시간 켜 두면 제품 사진이지 «장소»가 아니다.
 *   그렇다고 그라디언트로 바다·노을을 흉내내면 킷 ①「CSS 흉내 금지」에 그 자리에서 걸린다
 *   ([[loom-baked-assets-only-for-ui]] · F498 「너무 싸구려 AI처럼」). 히어로는 «사진»이어야 한다.
 *
 * ■ 🔴 무대에 «생명»을 넣지 않는다 — 이 파일의 제1 규칙이다.
 *   몽글·까몽은 정본 자산이다(`lib/마스코트자산.js`). 생성 모델에게 캐릭터를 그리게 하면
 *   그 순간 «닮았지만 다른 것»이 태어나고, 그게 24시간 방송에 걸린다. 그래서 여기서 굽는 것은
 *   **빈 무대뿐**이고, 정본 마스코트는 `라디오배경굽기.js` 가 그 위에 올린다.
 *   ⇒ 프롬프트에 NO characters 를 세 갈래로 못박는다(생물·얼굴·사람).
 *
 * ■ 색은 «낱말»이 아니라 «참조»로 준다 — `펠트색굽기.js` 머리말의 실측이 근거다.
 *   문장에 hex 를 적으면 참조와 싸워 색이 갈린다(ΔE 7.9). 킷 색은 펠트패치 타일로 물린다.
 *
 * ■ 왜 재질이 «펠트»인가 — 마스코트가 펠트라서다.
 *   사진 같은 해변 위에 누끼 딴 펠트 인형을 얹으면 **스티커**가 된다(룸장면 §3-4 ③ 「뒤」).
 *   무대도 같은 실로 짜여야 마스코트가 그 안에 «산다». 유호님이 부르신 셋(휴양지·자연·드림코어)은
 *   펠트 디오라마로 전부 성립한다 — 오히려 미니어처 공예 쪽이 지금 더 트렌디하다.
 *   덤: 명백한 «공예»라 유튜브 합성 콘텐츠 라벨 쟁점에서도 멀다(09-02 라벨 끔 확정과 같은 방향).
 *
 * ■ 자리 비움 — 가운데는 비운다.
 *   마스코트가 설 자리(가운데 위)와 로고 자리(아래 가운데)를 프롬프트가 «구도»로 비워 둔다.
 *   안 비우면 주인공 뒤가 시끄러워 둘 다 안 읽힌다.
 *
 * ⚠ 돈이 든다 — 1컷 ≈ 190원(2K). 장르 둘이면 380원. 실패 재굽기까지 세도 1천원 안쪽이다.
 * ⚠ 우하단 생성 표식(sparkle)이 붙는다 — 합성 쪽(`라디오배경굽기.js`)이 **잘라서** 떨군다.
 *   비가시 SynthID 는 그대로 둔다(🚫지우려는 시도).
 *
 * 쓰기:
 *   node tools/라디오무대굽기.js                  안 구운 것만
 *   node tools/라디오무대굽기.js --장르 citypop    하나만
 *   node tools/라디오무대굽기.js --다시            있어도 다시(옛 판은 _이전 로 밀어 둔다)
 *   출력 = docs/라디오/무대/<장르>.png (2K · 16:9)
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { 키, 한컷, 배치게이트 } = require('./lib/이미지굽기');

const ROOT = path.resolve(__dirname, '..');
const 낼곳 = path.join(ROOT, 'docs/라디오/무대');
const 패치 = path.join(ROOT, 'docs/캐릭터/펠트패치_0815');

/* ── 공통 지시 ───────────────────────────────────────────────────────────────
 * 세 덩이로 나눈다: ①무엇으로 만들었나(재질) ②어떻게 찍었나(카메라) ③무엇을 넣지 마라(금지).
 * 🔑 ③이 가장 길다 — 생성 모델은 «비우라»는 말을 가장 잘 잊는다. 구도까지 말로 못박는다. */
const 재질 = `A handmade needle-felted wool diorama, built as a real miniature set on a table.
Every single element is made of textile: felted merino wool roving, wet-felted sheets with
visible scissor-cut edges, embroidery floss, running stitch in cotton thread, french knots.
Visible fibre fuzz and soft handmade irregularity everywhere. Nothing is plastic, glass, metal
or digital. It looks like an award-winning fibre-art piece photographed for a craft magazine.`;

const 카메라 = `Photographed with a 50mm macro lens on a real camera, shallow depth of field:
the near foreground and the far background fall softly out of focus while the middle distance
stays sharp. Gentle atmospheric haze and a soft dreamy bloom around the light source.
Calm, nostalgic, quietly beautiful. Wide 16:9 cinematic landscape, horizon slightly low.`;

/* 🔴 구도 — 가운데를 비우게 하는 문장. 주인공(정본 마스코트)과 로고가 그 자리에 온다. */
const 구도 = `COMPOSITION IS CRITICAL: the centre of the frame must stay open and empty.
Place every object at the left edge, the right edge, the far horizon, or the very bottom edge,
so that they frame a large calm empty middle. The lower-centre strip must stay quiet and
uncluttered. Do not put anything in the middle of the picture.`;

const 금지 = `ABSOLUTELY NO living things: no people, no person, no human, no face, no figure,
no animal, no bird, no fish, no insect, no creature, no character, no mascot, no doll, no toy.
The set is completely empty of inhabitants. Also no text, no letters, no numbers, no signage,
no logo, no watermark, no frame, no border, no vignette drawn into the image.
The landscape must run all the way to every edge of the picture: do NOT show the table, desk,
floor or studio the diorama sits on, and do not show the cut edge of the felt base or backdrop.`;

/* ── 장르별 무대 ──────────────────────────────────────────────────────────────
 * 유호님이 부르신 셋을 갈라 앉혔다: citypop = 휴양지 · calm = 아름다운 자연/드림코어.
 * (house = 마린 대기라 여기서도 안 굽는다 — 얼굴이 없는 무대만 있어도 못 켠다.)
 * 참조 = 그 장르의 «주연 실 + 조연 실»(킷 철칙 ④). 색을 낱말로 안 준다. */
const 무대들 = {
  citypop: {
    이름: '시티팝 — 노을 휴양지',
    참조: ['CoralWash.png', 'Coral.png', 'Oat.png', 'Stitch.png'],
    장면: `A tiny felt tropical resort coastline at golden hour, seen from the beach.
A calm felt sea fills the middle distance, layered wool in warm peach and soft coral, its
wavelets picked out in long horizontal running stitches of cream thread. A pale oatmeal wool
shore runs along the bottom edge with a few tiny felted pebbles and a shell. Two felt palm
trees lean in from the far left and far right edges, fronds cut from stiff felt sheet with
visible scissor edges, their trunks wrapped in twisted yarn. A small striped parasol and a
rolled towel sit low at the right edge. A big soft sun of pale butter wool rests low on the
horizon behind a veil of haze, throwing a long shimmering stitch-path across the water.
The sky is a graded field of warm peach, apricot and cream wool with four or five small
clouds of loose white roving. Warm low evening light, long soft shadows on the sand.`,
  },
  calm: {
    이름: '차분 — 밤의 호수',
    참조: ['DeepWool.png', 'Stone.png', 'AshWool.png', 'Chalk.png'],
    /* 🔑 재굽기 09-02 — 첫 판은 어두운 언덕이 화면 «가운데»를 차지해서 까몽(검은 털)이 설 자리가
     *   없었다. 밤 장면의 급소는 「무엇이 밝은가」다: 주인공이 검으면 그 뒤가 밝아야 실루엣이 산다.
     *   ⇒ 수평선을 내리고, 달빛 받은 물·안개 띠를 아래 절반에 «넓고 환하게» 깐다. */
    장면: `A tiny felt night landscape by a wide, still, moonlit lake. The horizon sits LOW,
in the upper third: the lower HALF of the picture is all water and pale moonlit shore.
That lower half is the brightest part of the whole image — smooth pale silver-grey felt,
luminous with reflected moonlight, embroidered with long horizontal running stitches of cream
thread and drifting sheets of white roving mist lying over it. Behind it, far away and small,
low rolling hills of deep warm charcoal-brown wool are layered front to back, each further
ridge softer and hazier than the last. A round moon of cream wool hangs high toward the right,
hazy and glowing, with one thin wisp of roving cloud crossing it. A cluster of small simplified
felt pine trees stands far off along the left edge and a few more at the far right, small and
almost silhouettes, well away from the centre.
THE SKY: a rich WARM DEEP BROWN felt — the colour of dark chocolate and coffee, never grey,
never blue, never black — densely embroidered with MANY stars: dozens of tiny cream french
knots plus a scattering of larger six-armed star stitches, thickest near the top of the frame.
The warm brown sky and the cool glowing water are the two halves of this picture.`,
  },

  /* ── 09-05 신설 (유호 지시) ────────────────────────────────────────────────
   * 「전자도 한번 구워줘 · 새 해변 배경이랑 차분도 · 도시느낌의 배경도 하나 ·
   *  전부 아름다운느낌이면 좋겠어 그리고 드림코어느낌의 정말 아름답고 황홀한 느낌으로도 몇장」
   * 🔑 드림코어는 결 하나가 아니라 «셋»으로 나눴다 — 같은 낱말로 세 번 부르면 비슷한 것만 나온다.
   *   하늘/물/들판으로 장면을 갈라야 세 장이 서로 다른 아름다움을 낸다. */

  house: {
    이름: '전자 — 밤의 네온 항구',
    참조: ['Lapis.png', 'LapisDeep.png', 'Pop.png', 'DeepWool.png'],
    장면: `A tiny felt night harbour seen across still black water, lit by neon.
The horizon sits LOW in the upper third; the lower HALF is calm dark water of deep indigo
wool, glassy and smooth, carrying long vertical reflections of coloured light stitched in
glossy floss — magenta, cyan and warm amber streaks running down toward the viewer.
Far away along the horizon, a low skyline of simple felt blocks in deep navy and charcoal,
each tiny window a single bright french knot. A few slim felt light poles stand at the far
left and far right edges, each topped with a glowing bead of pale wool wrapped in a halo of
loose roving. Thin ribbons of magenta and cyan roving drift low over the water as neon haze.
THE SKY: deep midnight indigo felt graded to warm violet near the horizon, with a soft
electric glow rising off the distant city. Cool, sleek, quietly euphoric night mood.`,
  },

  city: {
    이름: '도시 — 비 갠 저녁의 골목 옥상',
    참조: ['Stone.png', 'Ash.png', 'Butter.png', 'Lapis.png'],
    장면: `A tiny felt city rooftop view at blue hour, just after rain.
The lower edge is a low felt parapet wall of textured grey stone-coloured wool, running
along the very bottom of the frame. Beyond and below it, layered rows of small felt rooftops
and building blocks recede into the distance at the far left and far right, built from
grey, ash and soft slate wool, each lit window a warm butter-yellow french knot, hundreds of
them scattered like embers. A few slim felt antennas and a water tank sit at the extreme left
edge; a string of tiny bulb lights is strung across the top right corner on a thread.
Wet rooftops catch light in long soft stitched highlights. Thin sheets of white roving mist
lie between the building layers, making each row further away paler than the last.
THE SKY: a deep dusky blue felt washed with warm amber near the low horizon where the sun
just left, one or two long clouds of loose roving. Melancholy, warm, beautiful city calm.`,
  },

  dream_sky: {
    이름: '드림코어 — 구름 위의 계단',
    참조: ['LapisSoft.png', 'CoralSoft.png', 'ButterSoft.png', 'Chalk.png'],
    장면: `A tiny surreal felt dreamscape floating in an endless pastel sky.
The whole frame is filled with soft billowing clouds of white and pale pink wool roving,
piled thick along the bottom edge like a sea of fleece and thinning to open sky above.
At the far left edge, a short flight of pale felt steps rises out of the cloud and simply
ends in mid-air. At the far right, a single doorway frame of cream felt stands free with
nothing behind it, its opening filled with a softer, brighter light than the sky around.
Small pale spheres of wool drift weightlessly at different depths, some near and blurred,
some far and tiny. Long thin stitches of iridescent floss arc between them like faint threads.
THE SKY: an impossibly beautiful gradient of pale lilac, peach, mint and cream felt, glowing
from within, with a soft halo bloom near the upper right. Weightless, nostalgic, euphoric —
the feeling of a half-remembered dream you did not want to leave.`,
  },

  dream_water: {
    이름: '드림코어 — 끝없는 거울 물',
    참조: ['LapisSoft.png', 'Chalk.png', 'PopSoft.png', 'Stone.png'],
    장면: `A tiny surreal felt dreamscape: an endless shallow mirror of water under a vast sky.
The lower two thirds is perfectly still pale water — smooth felt in soft lilac-grey, so calm
it doubles everything above it in a soft blurred reflection, its surface marked only by a few
faint concentric ripple rings of running stitch. The horizon is a single clean line very low
in the frame. Scattered far along that horizon, at the left and right edges only, stand a few
tall thin felt arches and one lone rounded doorway, small and pale, each mirrored below.
Two or three soft glowing orbs of cream wool hover above the water near the edges, each with
a gentle bloom and a faint reflected twin. Thin veils of white roving mist lie on the water.
THE SKY: an enormous gradient of pale rose, periwinkle and cream felt with a low soft sun
of butter wool near the horizon, its light spilling across the mirror in a long stitched path.
Silent, vast, achingly beautiful — stillness that feels like it goes on forever.`,
  },

  dream_field: {
    이름: '드림코어 — 빛나는 들판',
    참조: ['MeadowSoft.png', 'CoralSoft.png', 'ButterSoft.png', 'Chalk.png'],
    장면: `A tiny surreal felt dreamscape: a rolling meadow glowing at the last light of day.
The lower half is soft rolling ground of pale sage and mint wool, its surface embroidered all
over with thousands of tiny stitches suggesting grass, and dotted with small pale flowers made
of french knots in cream and blush. Fireflies — dozens of tiny glowing beads of butter wool
with soft halos — drift at every depth, thickest near the left and right edges, sparse in the
middle. A few slender felt stems and seed heads lean in from the very bottom edge, close to
the lens and softly out of focus. Far away on the low horizon, a line of small simplified
felt trees, hazy and pale. Long sheets of golden roving haze lie across the field.
THE SKY: a breathtaking gradient of warm apricot, blush pink and pale gold felt rising into
soft lavender, with the sun just below the horizon throwing a glow up through the haze.
Warm, golden, overwhelmingly beautiful — the last perfect minute of a summer evening.`,
  },
};

function 참조경로(파일들) {
  return 파일들.map((f) => {
    const p = path.join(패치, f);
    if (!fs.existsSync(p)) throw new Error(`참조 없음 — ${p}`);
    return p;
  });
}

function 지시(키이름) {
  const a = 무대들[키이름];
  /* 참조 타일이 «무엇»인지 안 말해 주면 모델이 그것을 그림의 일부로 베낀다.
   * (펠트색굽기가 견본을 물릴 때 쓰는 것과 같은 문법 — 참조는 색표지 소재가 아니다.) */
  return `${재질}

SCENE: ${a.장면}

${카메라}

${구도}

${금지}

The attached images are SWATCHES of the exact wool felt palette to use — they are colour and
texture references only. Do not copy their square shape or composition into the picture.`;
}

function main() {
  const argv = process.argv.slice(2);
  const 아는것 = ['--장르', '--다시'];
  const 모름 = argv.filter((x) => x.startsWith('--') && !아는것.includes(x));
  if (모름.length) { console.error(`[라디오무대굽기] 모르는 플래그 ${모름.join(' ')} — 아는 것 = ${아는것.join(' · ')}`); process.exit(1); }
  const i = argv.indexOf('--장르');
  const 하나 = i >= 0 ? argv[i + 1] : null;
  const 다시 = argv.indexOf('--다시') >= 0;
  if (하나 && !무대들[하나]) throw new Error(`모르는 장르: ${하나} (있는 것: ${Object.keys(무대들).join(' · ')})`);

  fs.mkdirSync(낼곳, { recursive: true });
  const k = 키();
  const 목록 = 하나 ? [하나] : Object.keys(무대들);

  (async () => {
    /* 돈 게이트 — 굽기 «전»에 얼마인지 말하고, 크레딧이 죽었으면 0원에 선다(09-03 · 유호 확정).
     * 목록 길이는 «최대»다(아래에서 이미 있는 장은 건너뛴다) — 게이트는 상한선을 말한다. */
    if (!(await 배치게이트(목록.length, '2K'))) { process.exitCode = 3; return; }
    /* 🔑 «합계 = 갈래 + 갈래»로 적는다 — 끝줄에 「2장」만 적으면 **굽지 않고 건너뛴 실행도
     *   구운 것처럼 읽힌다**(돈이 드는 도구라 그 오독의 값이 크다). */
    let 구움 = 0, 건너뜀 = 0;
    for (const 키이름 of 목록) {
      const 저장경로 = path.join(낼곳, `${키이름}.png`);
      if (fs.existsSync(저장경로) && !다시) { 건너뜀 += 1; console.log(`⏭  ${키이름} — 이미 있다(--다시 면 다시 굽는다)`); continue; }
      /* 옛 판을 덮기 전에 한 칸 옆으로 민다 — 눈으로 고르는 일이라 «직전 것»이 있어야 견준다.
       * 🔑 **저장소 «밖»으로 민다**(os.tmpdir). 09-02 에 저장소 안에 뒀다가 커밋에 섞일 뻔했다 —
       *   CLAUDE.md 「사본·아카이브를 새로 만들지 않는다 · 보존은 git 이력이 한다」. 이건 보존이
       *   아니라 «굽는 동안의 대조»라 세션이 끝나면 없어도 되는 물건이다. */
      if (fs.existsSync(저장경로)) {
        const 대조방 = path.join(os.tmpdir(), 'synk-무대대조');
        fs.mkdirSync(대조방, { recursive: true });
        const 옛 = path.join(대조방, `이전_${키이름}.png`);
        fs.renameSync(저장경로, 옛);
        console.log(`   ↩ 직전 판 = ${옛} (대조용 · 저장소 밖)`);
      }
      await 한컷({
        이름: `무대_${키이름}`,
        지시: 지시(키이름),
        참조: 참조경로(무대들[키이름].참조),
        비율: '16:9',
        크기: '2K',
        저장경로,
        k,
      });
      구움 += 1;
      console.log(`   ↳ ${무대들[키이름].이름}`);
    }
    console.log(`\n[라디오무대굽기] 대상 ${목록.length} = 구움 ${구움} + 건너뜀 ${건너뜀}`
      + ` · 든 돈 ≈ ${구움 * 190}원 · ${path.relative(ROOT, 낼곳)}`);
    console.log('   다음: node tools/라디오배경굽기.js — 무대 위에 정본 마스코트를 올려 1280×720 을 낸다.');
  })().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
}

if (require.main === module) main();
module.exports = { 무대들, 낼곳 };
