#!/usr/bin/env node
/**
 * 라디오24 무대를 «움직이는 영상»으로 굽는다 — 유호 확정 09-06 「a 한다음에 c로 가자」.
 *
 * ■ 왜 필요한가
 *   지금 방송 화면은 정지 그림이다(`-loop 1` + `-tune stillimage`). 유호님 지적:
 *   「라디오 배경이 정적이라 별로라서 반복으로 움직이게하자」.
 *   ⇒ 무대를 8초짜리 영상으로 굽고 «왕복»으로 이어 붙여 끊김 없이 반복시킨다.
 *
 * ■ 🔴 무대에는 생명이 없다 (기존 규율 그대로 · 결정 09-02)
 *   마스코트를 «생성»시키지 않는다. 모델이 그리면 「닮았지만 다른 것」이 24시간 걸린다.
 *   무대만 움직이고, 정본 마스코트는 그 위에 **정지로** 합성한다.
 *   ⇒ 지시문과 negativePrompt 양쪽에서 생명을 막는다.
 *
 * ■ 🔑 끊김 없는 반복 — **첫 장면과 끝 장면을 같은 그림으로 못 박는다**(`lastFrame`)
 *   🔴 09-06 1차 실패: 첫 장면만 주고 「카메라 고정」을 지시문·금지목록 양쪽에 넣었는데
 *     **모델이 카메라를 앞으로 밀고 들어갔다**(4초에 다가오고 8초에 더 다가옴 · 안개도 짙어짐).
 *     그러면 ⓐ반복할 때 툭 튀고 ⓑ마스코트 앉힐 자리가 계속 변한다.
 *   ✅ 처방 = `instance.lastFrame` 에 **첫 그림과 같은 것**을 넣는다(09-06 실측 200).
 *     끝이 시작과 같아야 하므로 카메라가 제자리로 돌아오고, 이음매가 저절로 사라진다.
 *     왕복(역재생)으로 억지로 잇지 않아도 된다.
 *
 * ■ 값 (구글 공식 SKU · 09-05 실측)
 *   4K = $0.40/초. 720p 는 그보다 싸고 4·6·8초를 고를 수 있다(4K 는 8초 고정).
 *   방송이 720p 라 **720p 로 굽는다** — 4K 를 구워도 어차피 720p 로 줄여 나간다.
 *
 * 쓰는 법:
 *   node tools/라디오무대영상.js --값만            0원. 얼마 드는지만 센다
 *   node tools/라디오무대영상.js --무대 house      한 장만(시험)
 *   node tools/라디오무대영상.js                   일곱 무대 전부
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const 무대방 = path.join(ROOT, 'docs', '라디오', '무대');
const 낼곳 = path.join(ROOT, 'docs', '라디오', '무대영상');
const 모델 = process.env.SYNK_VEO_MODEL || 'veo-3.1-generate-001';
const 컷길이 = 8;
const 해상도 = '720p';
const 초당달러 = 0.40;      // 4K SKU 값 — 720p 는 이보다 싸므로 이 값은 «넉넉히 잡은» 상한이다
const 환율 = 1452;

/* 무대마다 «무엇이 움직이나»를 적는다. 구조는 그대로 두고 결만 흔든다.
 * 🔑 공통 규율 = 카메라 고정 · 구조 불변 · 생명 없음. 그래야 반복해도 티가 안 나고 정본이 안 흔들린다. */
const 무대들 = {
  citypop: { 이름: '시티팝 노을 휴양지', 움직임: 'palm fronds sway gently in a warm breeze, slow ocean ripples catch the low sun, thin clouds drift slowly' },
  calm:    { 이름: '차분 달빛 호수',     움직임: 'still water ripples very slowly under moonlight, faint mist drifts low, reeds sway barely' },
  /* 🔴 09-06 1차에서 안개(haze)가 불빛을 덮었다 — 유호 지적 「바람이 부는것보다 창문에있는 불이
   *   깜빡거려야지」. 안개·연기를 빼고 «창문 불빛 하나씩»만 남긴다. 도시는 미동도 않는다. */
  house:   { 이름: '전자 밤 도시',       움직임: 'ONLY the small window lights change: a few windows dim and brighten softly, one at a time, at different moments. The buildings, the ground and the air are completely still. No fog, no haze, no smoke, no drifting particles' },
  city:    { 이름: '도시 밤 골목',       움직임: 'string lights sway slightly, warm window glow flickers, thin smoke drifts from a rooftop' },
  dream_sky:   { 이름: '드림 하늘',      움직임: 'pastel clouds drift slowly, soft light shifts across the steps, tiny sparkles float upward' },
  dream_water: { 이름: '드림 물결',      움직임: 'water surface ripples slowly, soft reflections shimmer, gentle mist drifts' },
  dream_field: { 이름: '드림 들판',      움직임: 'grass and flowers sway in a soft breeze, clouds drift slowly, light shifts gently' },
};

const 공통 = 'Handmade needle-felted wool miniature scene, macro photograph, shallow depth of field. '
  + 'Locked-off tripod shot: the framing is identical from first to last frame. The set does not change shape. '
  + 'Only the described motion happens, very gently, and it returns to where it started. ';
const 막을것 = 'character, creature, mascot, doll, toy figure, person, people, human, face, eyes, animal, '
  + 'camera movement, zoom, pan, cut, transition, text, letters, watermark, logo, subtitles, '
  /* 🔴 09-06: 안개가 불빛을 덮었다 — 지시문만으로는 샌다. 여기서 한 번 더 막는다. */
  + 'fog, haze, smoke, mist, drifting particles, dust';

const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

async function 토큰() {
  const 자격 = process.env.SYNK_VERTEX_OAUTH || path.join(os.homedir(), '.synk-vertex-oauth.json');
  const j = JSON.parse(fs.readFileSync(fs.existsSync(자격) ? 자격 : path.join(os.homedir(), '.clasprc.json'), 'utf8'));
  const t = (j.tokens && j.tokens.default) || j;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: t.client_id, client_secret: t.client_secret, refresh_token: t.refresh_token, grant_type: 'refresh_token' }),
  });
  const 답 = await r.json().catch(() => ({}));
  if (!답.access_token) throw new Error(`토큰 갱신 실패 ${r.status}`);
  return { tok: 답.access_token, 프로: j.프로젝트 || 'gen-lang-client-0106203750' };
}

async function 한무대(키, tok, 프로) {
  const 무대 = 무대들[키];
  const 그림 = path.join(무대방, `${키}.png`);
  if (!fs.existsSync(그림)) return { 실패: `무대 그림이 없다: ${키}.png` };

  const 밑 = `https://us-central1-aiplatform.googleapis.com/v1/projects/${프로}/locations/us-central1/publishers/google/models/${모델}`;
  const b64 = fs.readFileSync(그림).toString('base64');
  const instance = {
    prompt: 공통 + 무대.움직임 + '. No living creature appears.',
    image: { bytesBase64Encoded: b64, mimeType: 'image/png' },
    /* 🔑 끝을 시작과 같게 못 박는다 — 이것이 카메라를 붙잡고 이음매를 없앤다(09-06 실측) */
    lastFrame: { bytesBase64Encoded: b64, mimeType: 'image/png' },
  };
  const parameters = {
    sampleCount: 1, durationSeconds: 컷길이, aspectRatio: '16:9',
    resolution: 해상도, generateAudio: false, personGeneration: 'dont_allow',
    negativePrompt: 막을것,
  };

  const r = await fetch(`${밑}:predictLongRunning`, {
    method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: JSON.stringify({ instances: [instance], parameters }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const 말 = ((j.error && j.error.message) || '').replace(/\s+/g, ' ');
    if (r.status === 403 || r.status === 429) throw new Error(`벽 ${r.status}: ${말}`);
    return { 실패: `${r.status} ${말}` };
  }

  // 낸 돈의 결과를 잃지 않게 작업 이름을 먼저 적는다
  fs.mkdirSync(낼곳, { recursive: true });
  fs.appendFileSync(path.join(낼곳, '작업장부.jsonl'),
    JSON.stringify({ 때: new Date().toISOString(), 무대: 키, 작업: j.name }) + '\n');
  console.log(`   작업 ${j.name.split('/').pop()} — 기다린다`);

  // 폴링 — 토큰은 부를 때마다 새로 받는다(도중에 만료되면 401)
  for (let i = 0; i < 90; i++) {
    await 잠깐(10000);
    const { tok: t2 } = await 토큰();
    const p = await fetch(`${밑}:fetchPredictOperation`, {
      method: 'POST', headers: { authorization: `Bearer ${t2}`, 'content-type': 'application/json' },
      body: JSON.stringify({ operationName: j.name }),
    });
    const pj = await p.json().catch(() => ({}));
    if (!pj.done) { if (i % 6 === 5) console.log(`   …${(i + 1) * 10}초`); continue; }
    if (pj.error) return { 실패: `작업 실패: ${pj.error.message || ''}` };
    const v = pj.response?.videos?.[0] || pj.response?.generatedSamples?.[0]?.video;
    const b64 = v?.bytesBase64Encoded;
    if (!b64) return { 실패: `영상이 안 왔다: ${JSON.stringify(pj.response || {}).slice(0, 200)}` };
    const 파일 = path.join(낼곳, `${키}.mp4`);
    fs.writeFileSync(파일, Buffer.from(b64, 'base64'));
    return { 파일, 크기: fs.statSync(파일).size };
  }
  return { 실패: '15분을 기다려도 안 끝났다' };
}

(async () => {
  const i = process.argv.indexOf('--무대');
  const 하나 = i > -1 ? process.argv[i + 1] : null;
  const 할것 = 하나 ? [하나] : Object.keys(무대들);
  const 값 = 할것.length * 컷길이 * 초당달러;

  console.log(`\n🎬 라디오 무대 영상 — ${할것.length}개 · ${컷길이}초 · ${해상도} · 소리 없음`);
  console.log(`   값 ≈ $${값.toFixed(2)} ≈ ₩${Math.round(값 * 환율).toLocaleString()} (4K 단가로 넉넉히 잡은 상한)`);
  console.log(`   🔴 무대에는 생명을 안 그린다 — 마스코트는 뒤에 정지로 합성한다\n`);
  if (process.argv.includes('--값만')) { console.log('   (값만 셌다 · 0원)\n'); return; }

  const { tok, 프로 } = await 토큰();
  const 결과 = [];
  for (const 키 of 할것) {
    if (!무대들[키]) { console.log(`⚠ 모르는 무대: ${키}`); continue; }
    console.log(`[${무대들[키].이름}] ${키}`);
    const r = await 한무대(키, tok, 프로);
    if (r.실패) { console.log(`   🔴 ${r.실패}`); 결과.push({ 키, 실패: r.실패 }); }
    else { console.log(`   ✅ ${(r.크기 / 1024 / 1024).toFixed(2)}MB → docs/라디오/무대영상/${키}.mp4`); 결과.push({ 키, 크기: r.크기 }); }
  }
  const 성공 = 결과.filter((x) => !x.실패).length;
  console.log(`\n합계: 성공 ${성공} / ${결과.length}`);
  결과.filter((x) => x.실패).forEach((x) => console.log(`  🔴 ${x.키} — ${x.실패}`));
  console.log(`\n다음: 왕복으로 이어 붙여 끊김 없는 반복을 만든다(ffmpeg · 0원)\n`);
})().catch((e) => { console.error(`\n🔴 ${e.message}\n`); process.exit(1); });
