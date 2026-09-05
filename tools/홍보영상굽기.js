#!/usr/bin/env node
/* SYNK 홍보영상 굽기 — 4K · 컷당 8초 · 소리 없음(음악은 따로 얹는다).
 *
 * ■ 왜 이 모양인가
 *   · 4K 는 «8초 고정»이다(구글 제약 — 720p 만 4·6·8초를 고른다). 그래서 길이는 «컷 수»로 만든다.
 *   · 소리를 컷마다 만들면 이어붙이는 자리마다 튄다. 명품 홍보물은 음악 하나가 흐르므로
 *     영상은 소리 없이 굽고(값도 $0.60→$0.40/초) 음악을 따로 얹는다.
 *   · 마스코트가 나오는 컷은 «그림 → 영상»으로 간다. 글로만 묘사하면 우리 마스코트가 아닌
 *     다른 것이 나온다(정본이 있는데 닮은 것을 새로 만드는 셈).
 *
 * ■ 값 (구글 공식 가격표 09-05 실측 · cloudbilling SKU)
 *   Veo 3 4k Video Generation = $0.40/초 ⇒ 8초 한 컷 $3.20 ≈ ₩4,646
 *
 * ■ 쓰기
 *   node tools/홍보영상굽기.js            — 전부
 *   node tools/홍보영상굽기.js --컷 2      — 그 컷만 (다시 굽기)
 *   node tools/홍보영상굽기.js --값만      — 0원. 얼마 드는지만 말한다
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const 정책 = require(path.join(__dirname, '모델정책.js'));
const 마스코트 = require(path.join(__dirname, 'lib', '마스코트자산.js'));

const 뿌리 = path.join(__dirname, '..');
const 낼곳 = path.join(뿌리, '영상', 'out', '홍보_4K_v2');
const 프로젝트 = process.env.SYNK_VERTEX_PROJECT || 'gen-lang-client-0106203750';
const 위치 = 'us-central1';
const 모델 = process.env.SYNK_VEO_MODEL || 'veo-3.1-generate-001';

/* 초당 달러 — 구글 공식 SKU 이름 그대로 적어 둔다(값이 어디서 왔는지 잃지 않게).
 * 「Veo 3 4k Video Generation」 = 4K · 소리 없음 · 표준 판. */
const 초당달러 = 0.40;
const 컷길이 = 8;              // 4K 는 8초 고정
const 환율 = 1452;             // ₩435,523 = $300 (크레딧 실측에서 나온 값)

/* ══════════ 컷 ══════════
 * 결의 기준 = 「누가 봐도 명품」(유호 09-05). 그래서 넷을 지킨다:
 *   ① 느린 카메라 하나만  ② 얕은 심도  ③ 따뜻한 자연광 하나  ④ 넉넉한 여백
 * 🚫 글자는 굽지 않는다 — AI 가 만든 한글은 깨진 자모가 섞이고, 그게 그대로 싸구려 신호다.
 *    글자·로고는 편집에서 «진짜 서체»로 얹는다.
 *
 * 🔴 v2 (유호 09-05 「몽글이 까몽이를 만드는 과정을 보여주면서 생명력을 불어넣는 느낌」)
 *   옛 판은 넷뿐이라 조각을 두 번씩 썼고 「똑같은 장면만 나온다」는 지적을 받았다.
 *   여덟으로 늘려 **한 장면도 두 번 쓰지 않는다.** 그리고 순서가 곧 이야기다:
 *     양모 → 찌르기 → 형태 → 눈(생명이 깃드는 순간) → 몽글 → 검은 양모 → 까몽 → 둘이 나란히
 *
 * 🔴 입을 못 만들게 막는다 — v1 에서 몽글이에게 없던 입이 생겼다.
 *   지시문의 「no mouth」만으로는 샜다. 그래서 negativePrompt 로 한 번 더 막는다(아래 굽기()). */
const 컷들 = [
  {
    번호: 1, 이름: '양모',
    지시: 'Extreme macro: a soft mound of coral-pink carded wool roving resting on natural linen. '
      + 'Warm raking morning light makes the loose fibres glow at the edges. Very slow push-in. '
      + 'Extremely shallow depth of field, tactile, muted warm palette, fine film grain. Nothing has been '
      + 'made yet — just raw material waiting.',
  },
  {
    번호: 2, 이름: '찌르기',
    지시: 'Macro, slow motion: a slim felting needle punches rhythmically down into a mound of coral wool. '
      + 'With each stroke the fibres compress and tangle a little tighter. Warm side light, dust of fibre '
      + 'in the air. Extremely shallow depth of field, patient and artisanal, fine film grain.',
  },
  {
    번호: 3, 이름: '형태',
    지시: 'Macro: a rounded dome of densely needle-felted coral wool slowly takes shape on linen as a '
      + 'felting needle smooths its surface. The form is completely blank — no eyes, no face, nothing on '
      + 'it yet. Slow rotation, warm light, extremely shallow depth of field, fine film grain.',
  },
  {
    번호: 4, 이름: '눈',
    지시: 'Extreme macro, slow motion: two tiny glossy black bead eyes are pressed one by one into a smooth '
      + 'coral wool-felt dome. Warm light catches the glass as each bead settles into the fibre. This is the '
      + 'moment it becomes alive. Only the two round black beads are added and nothing else. '
      + 'Extremely shallow depth of field, quiet and reverent, fine film grain.',
  },
  {
    번호: 5, 이름: '몽글',
    그림: '몽글_본체',
    /* 🔴 09-05 1차에서 「blinks once」를 넣었더니 눈을 감는 3~5초 구간에서 «검은 구슬이 사라지고
     *   볼록한 혹 두 개»가 됐다. 정본의 눈감음과 다른 얼굴이다. ⇒ 눈은 아예 안 감기게 못 박고,
     *   생명감은 «몸의 미세한 숨»과 «카메라»로 낸다. */
    지시: 'The small coral wool-felt character sits on warm pale wood. The camera drifts around it very '
      + 'slowly while it breathes almost imperceptibly, alive but perfectly composed. Its two glossy round '
      + 'black bead eyes stay wide open the entire time and never close, never blink. Its face has ONLY '
      + 'those two black bead eyes and smooth blank felt everywhere else. Soft window light from the left, '
      + 'extremely shallow depth of field, fine film grain.',
    막을것: 'blinking, closed eyes, eyelids, winking, eyes disappearing',
  },
  {
    번호: 6, 이름: '검은양모',
    지시: 'Extreme macro: a mound of charcoal-black carded wool roving on natural linen beside a felting '
      + 'needle. Warm raking light picks out individual dark fibres against the pale cloth. Very slow '
      + 'push-in. Extremely shallow depth of field, tactile, fine film grain. A second one is about to begin.',
  },
  {
    번호: 7, 이름: '까몽',
    /* 🔴 09-05 유호 「까몽이가 너무 무섭게 나왔어 · 웃고 있었으면 좋겠어」 — 동그란 눈 정본은
     *   영상에서 노려보는 얼굴로 읽혔다. 정본에 «웃는 눈» 판이 따로 있으므로 그것을 넣는다
     *   (표정을 만들라고 시키지 않는다 — 시키면 우리 얼굴이 아닌 것이 나온다). */
    그림: '까몽_눈웃음',
    /* 🔴 09-05 1차 — 「고개를 돌리고 꼬리를 흔든다」를 넣었더니 뒤로 갈수록 «진짜 고양이»가 됐다
     *   (긴 몸 · 앉은 자세 · 코와 입까지). 정본 까몽이는 둥근 털뭉치다. ⇒ 움직임을 카메라에만 주고
     *   형태를 바꾸지 말라고 못 박는다. */
    지시: 'The small charcoal wool-felt cat sits perfectly still on warm pale wood while the camera drifts '
      + 'around it very slowly. It stays exactly as it is: a small round ball of dark needle-felted wool '
      + 'with two happy curved green stitched eyes, small pointed ears and one slim tail. Its eyes stay '
      + 'curved and smiling the whole time and never open into round eyes. It looks warm and content. '
      + 'It does not change shape, does not stand up, does not become a realistic cat. Soft window light, '
      + 'extremely shallow depth of field.',
    막을것: 'realistic cat, real cat, cat nose, cat mouth, whiskers, elongated body, standing up, '
      + 'changing shape, morphing, round open eyes, staring, scary, menacing',
  },
  {
    번호: 8, 이름: '둘이',
    그림파일: path.join(__dirname, '..', '영상', 'out', '홍보_4K_v2', '_밑그림', '둘이나란히.png'),
    /* 🔴 09-05 1차 — 「카메라가 천천히 빠지며 여백을 드러낸다」를 넣었더니 둘이 화면의 15% 가 됐다.
     *   명품의 여백은 «주인공이 보이는» 여백이지 빈 화면이 아니다(결정.md 09-05 엔딩 문법 ⑤ 주석).
     *   ⇒ 카메라를 거의 세운다. */
    /* 🔴 유호 제안 09-05 「배경 뒤에 한국어 관련 오브제를 넣으면 간접적으로 명품느낌으로 어필」.
     *   밑그림에 실물 자수 글자 「가」를 넣어 두었으므로, 지시문은 그것을 «지키라»고만 말한다.
     *   🚫 글자를 만들라고 시키지 않는다 — 시키는 순간 깨진 자모가 나온다. */
    지시: 'The coral felt character and the charcoal felt cat rest side by side on warm pale wood in a '
      + 'sunlit room, filling the frame the way they already do. A small dark felt board leans against the '
      + 'wall behind them on the left; whatever is stitched on that board must stay pixel for pixel as it '
      + 'already is — do not redraw it, do not reinterpret its shape. The camera holds almost still, '
      + 'drifting only a hair. Everything stays as it is, breathing almost imperceptibly. Warm afternoon '
      + 'light, extremely shallow depth of field, muted warm palette.',
    /* 🔴 09-05 에 이 자리에서 두 번 넘어졌다.
     *   ① 「embroidered mark」·「adding letters」 → 구글 안전 필터가 통째로 막았다(돈은 안 나갔다).
     *   ② 「stitched **coral** pattern」 → 저쪽이 coral 을 «색»이 아니라 «산호»로 읽어 자수 「가」를
     *      산호 가지로 다시 그렸다. 🔑 우리 브랜드에서 coral 은 색 이름이지만 영어로는 산호다 —
     *      지시문에 브랜드 색 이름을 그대로 쓰지 않는다. */
    막을것: 'zooming out, pulling back, wide shot, characters shrinking, changing shape, '
      + 'coral, coral reef, branches, plant, tree, redrawing the stitched shape',
  },
];

const 잠깐 = (ms) => new Promise((s) => setTimeout(s, ms));
const 밑 = `https://${위치}-aiplatform.googleapis.com/v1/projects/${프로젝트}/locations/${위치}/publishers/google/models/${모델}`;

/** 첫 프레임에 넣을 그림을 영상이 받을 수 있는 크기로 줄인다(4096²·18MB 는 요청에 싣기엔 크다).
 *  이름(`몽글_본체`)이면 정본 4K 판을 찾아 쓰고, 통째 경로를 주면 그 파일을 쓴다. */
function 그림준비(이름, 경로직접) {
  let 쓸것 = 경로직접;
  if (!쓸것) {
    /* 🔴 09-05 오후에 옆 세션이 `정본_4K_후보` 를 `정본_4K` 로 승격시켰다. 둘 다 본다 —
     *   이름을 하나만 박으면 그날 이후로 조용히 옛 마스코트로 내려간다.
     * 🔴 `정본_4K/코없음` 이 맨 앞이다 — 까몽이 정본 일부에 «코»가 섞여 있고(유호 발견 09-05),
     *   코가 있으면 진짜 고양이에 가까워져 무섭게 읽힌다. 사본이 있으면 그것이 이긴다. */
    const 사천 = ['정본_4K/코없음', '정본_4K', '정본_4K_후보']
      .map((방) => path.join(뿌리, 'docs', '캐릭터', ...방.split('/'), `${이름}.png`))
      .find((p) => fs.existsSync(p));
    // 4K 판이 없으면 마스코트 창구가 아는 정본으로 내려간다(경로를 여기 새로 적지 않는다).
    쓸것 = 사천 || path.join(뿌리, 이름.startsWith('까몽') ? 마스코트.까몽경로('본체') : 마스코트.경로('본체'));
  }
  if (!fs.existsSync(쓸것)) throw new Error(`첫 프레임 그림이 없다: ${쓸것}`);
  /* 🔴 09-05 유호 「화면이 지지직거리는 느낌」 — 정사각 그림을 그대로 주면 저쪽이 16:9 화면에
   *   맞추면서 좌우 빈 자리의 «경계»를 세로선으로 남긴다(컷5·7·8 전부에 하나씩 있었다).
   *   ⇒ 여기서 16:9 판으로 만들어 준다. 바탕은 크림 단색이라 저쪽이 방으로 잘 채운다. */
  const 줄인것 = path.join(os.tmpdir(), `synk_첫프레임_${path.basename(쓸것, '.png')}_16x9.png`);
  if (!fs.existsSync(줄인것)) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 쓸것,
      '-vf', 'scale=-1:820,pad=1920:1080:(ow-iw)/2:(oh-ih)-90:color=0xE8DCC8', 줄인것]);
  }
  return { 파일: 줄인것, 출처: 쓸것 };
}

/* 🔑 토큰은 1시간짜리다. 4K 한 컷이 3~5분 걸리고 네 컷이면 20분이 넘어가므로,
 *   맨 앞에서 한 번 받아 들고 다니면 «폴링 도중에» 만료돼 401 이 난다(09-05 실측 — 220초에서 났다).
 *   부를 때마다 받는다 — 안에 캐시가 있어서 값이 안 든다. */
const 새토큰 = async () => (await 정책.제미나이헤더('돈')).authorization.slice(7);

/** 시작된 작업을 되찾아 받는다. 401 로 놓친 것도 이 이름만 있으면 다시 받을 수 있다(돈을 두 번 안 낸다). */
async function 받아내기(작업이름, 컷) {
  let 끊김 = 0;
  for (let i = 1; i <= 90; i++) {
    await 잠깐(10000);
    /* 🔴 09-05 실측 — 폴링 도중 `fetch failed`(망이 잠깐 끊김) 하나로 배치 전체가 죽었다.
     *   그때 컷1 은 이미 시작돼 값이 나간 뒤였다. 망 오류는 «그 컷의 실패»가 아니라 «잠깐»이므로
     *   여기서 삼키고 다시 묻는다. 연달아 6번(1분) 끊기면 그때 손을 든다. */
    let t; let p; let o;
    try {
      t = await 새토큰();
      p = await fetch(`${밑}:fetchPredictOperation`, {
        method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
        body: JSON.stringify({ operationName: 작업이름 }),
      });
      o = await p.json().catch(() => ({}));
      끊김 = 0;
    } catch (e) {
      끊김 += 1;
      process.stdout.write(`   …망이 끊겼다(${끊김}/6) 다시 묻는다\r`);
      if (끊김 >= 6) return { 실패: `망이 1분 넘게 끊겼다: ${e.message}`, 작업: 작업이름 };
      continue;
    }
    if (!p.ok) return { 실패: `폴링 ${p.status} ${(o.error && o.error.message || '').slice(0, 90)}`, 작업: 작업이름 };
    if (!o.done) { process.stdout.write(`   …${i * 10}초\r`); continue; }
    if (o.error) return { 실패: JSON.stringify(o.error).slice(0, 300), 작업: 작업이름 };

    const 영상들 = (o.response && (o.response.videos || o.response.generatedSamples)) || [];
    if (!영상들.length) return { 실패: `결과가 비었다: ${JSON.stringify(o.response || {}).slice(0, 300)}`, 작업: 작업이름 };
    const v = 영상들[0];
    const b64 = v.bytesBase64Encoded || (v.video && v.video.bytesBase64Encoded);
    if (!b64) return { 실패: `모양을 모르겠다: ${JSON.stringify(v).slice(0, 200)}`, 작업: 작업이름 };

    fs.mkdirSync(낼곳, { recursive: true });
    const 파일 = path.join(낼곳, `컷${컷.번호}_${컷.이름}.mp4`);
    fs.writeFileSync(파일, Buffer.from(b64, 'base64'));
    return { 파일, 메가: (fs.statSync(파일).size / 1024 / 1024).toFixed(2) };
  }
  return { 실패: '10분 안에 안 끝났다', 작업: 작업이름 };
}

async function 굽기(컷) {
  const t = await 새토큰();
  const parameters = {
    sampleCount: 1, durationSeconds: 컷길이, aspectRatio: '16:9',
    resolution: '4k', generateAudio: false, personGeneration: 'dont_allow',
    /* 🔴 v1 에서 몽글이에게 «없던 입»이 생겼다(유호 09-05 지적). 지시문의 no mouth 만으로는 샜다.
     *   여기서 한 번 더 막는다 — 얼굴에 눈 말고 아무것도 안 생기게. */
    negativePrompt: 'mouth, lips, teeth, smile, tongue, nose, nostrils, eyebrows, eyelashes, '
      + 'face features, text, letters, words, watermark, subtitles, logo'
      + (컷.막을것 ? `, ${컷.막을것}` : ''),   // 그 컷만의 금지 — 컷 정의 옆에 까닭을 적어 둔다
  };
  const instance = { prompt: 컷.지시 };
  if (컷.그림 || 컷.그림파일) {
    const g = 그림준비(컷.그림, 컷.그림파일);
    instance.image = { bytesBase64Encoded: fs.readFileSync(g.파일).toString('base64'), mimeType: 'image/png' };
    console.log(`   🧸 첫 프레임: ${path.basename(g.출처)}`);
  }

  const r = await fetch(`${밑}:predictLongRunning`, {
    method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
    body: JSON.stringify({ instances: [instance], parameters }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const 말 = (j.error && j.error.message || '').replace(/\s+/g, ' ');
    // 🔑 400 은 «이 장만의 실패»고 0원이다. 403·429 는 벽이라 그 자리에서 선다.
    if (r.status === 403 || r.status === 429) throw new Error(`벽 ${r.status}: ${말}`);
    return { 실패: `${r.status} ${말}` };
  }

  /* 🔑 시작하자마자 작업 이름을 적어 둔다 — 여기서 프로그램이 죽어도 이 이름만 있으면
   *   이미 «낸 돈»의 결과를 되찾을 수 있다(--되찾기). */
  const 장부 = path.join(낼곳, '작업장부.jsonl');
  fs.mkdirSync(낼곳, { recursive: true });
  fs.appendFileSync(장부, JSON.stringify({ 때: new Date().toISOString(), 컷: 컷.번호, 이름: 컷.이름, 작업: j.name }) + '\n');
  console.log(`   작업 ${j.name.split('/').pop()}`);

  return 받아내기(j.name, 컷);
}

(async () => {
  const 인자 = process.argv.slice(2);
  const 고른컷 = 인자.includes('--컷') ? Number(인자[인자.indexOf('--컷') + 1]) : null;
  const 굽을것 = 고른컷 ? 컷들.filter((c) => c.번호 === 고른컷) : 컷들;

  const 달러 = 초당달러 * 컷길이 * 굽을것.length;
  console.log(`■ 굽기 게이트 — ${굽을것.length}컷 × ${컷길이}초 × 4K`);
  console.log(`  ≈ $${달러.toFixed(2)} (약 ${Math.round(달러 * 환율).toLocaleString()}원) · 무료 크레딧에서 나간다`);
  console.log(`  모델 ${모델} · 소리 없음(음악은 따로 얹는다)`);
  if (인자.includes('--값만')) return;

  /* 이미 시작해 «돈이 나간» 작업의 결과를 다시 받아낸다 — 프로그램이 도중에 죽었을 때 쓴다. */
  if (인자.includes('--되찾기')) {
    const 장부 = path.join(낼곳, '작업장부.jsonl');
    if (!fs.existsSync(장부)) { console.log('🔴 장부가 없다 — 되찾을 작업이 없다.'); return; }
    const 줄들 = fs.readFileSync(장부, 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l));
    for (const 줄 of 줄들) {
      const 컷 = 컷들.find((c) => c.번호 === 줄.컷) || { 번호: 줄.컷, 이름: 줄.이름 };
      const 파일 = path.join(낼곳, `컷${컷.번호}_${컷.이름}.mp4`);
      if (fs.existsSync(파일)) { console.log(`  ✓ 컷${컷.번호} 이미 있다`); continue; }
      console.log(`▶ 되찾기 컷${컷.번호}`);
      const r = await 받아내기(줄.작업, 컷);
      console.log(r.파일 ? `   ✅ ${path.basename(r.파일)} (${r.메가} MB)` : `   🔴 ${r.실패}`);
    }
    return;
  }

  const 결과 = [];
  for (const 컷 of 굽을것) {
    /* 이미 구운 컷은 건너뛴다 — 죽은 배치를 다시 돌릴 때 «낸 돈을 또 내는» 것을 막는다. */
    const 이미 = path.join(낼곳, `컷${컷.번호}_${컷.이름}.mp4`);
    if (fs.existsSync(이미)) { console.log(`\n✓ 컷${컷.번호} ${컷.이름} — 이미 있다(안 굽는다)`); 결과.push({ 컷: 컷.번호, 파일: 이미 }); continue; }

    console.log(`\n▶ 컷${컷.번호} ${컷.이름}`);
    /* 한 컷이 망 때문에 죽어도 배치 전체를 세우지 않는다 — 남은 컷은 계속 굽는다. */
    let r;
    try { r = await 굽기(컷); } catch (e) { r = { 실패: e.message }; }
    if (r.실패) { console.log(`   🔴 ${r.실패}`); 결과.push({ 컷: 컷.번호, 실패: r.실패 }); continue; }
    console.log(`   ✅ ${path.basename(r.파일)}  (${r.메가} MB)`);
    결과.push({ 컷: 컷.번호, 파일: r.파일 });
  }

  const 된것 = 결과.filter((r) => r.파일);
  console.log(`\n■ ${된것.length}/${굽을것.length} 컷 · ${낼곳}`);
  if (된것.length < 굽을것.length) {
    console.log('  🔴 실패한 컷:', 결과.filter((r) => r.실패).map((r) => `컷${r.컷}`).join(' · '));
  }
})().catch((e) => { console.error('🔴', e.message); process.exit(1); });
