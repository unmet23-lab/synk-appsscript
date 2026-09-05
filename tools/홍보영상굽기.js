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
const 낼곳 = path.join(뿌리, '영상', 'out', '홍보_4K');
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
 *    글자·로고는 편집에서 «진짜 서체»로 얹는다. */
const 컷들 = [
  {
    번호: 1, 이름: '아침',
    지시: 'Cinematic slow dolly-in through a quiet sunlit studio at dawn. Warm morning light rakes '
      + 'across a cream wool-felt wall, catching individual fibres. A single pale-wood desk holds a small '
      + 'felt notebook and a brass pen. Dust motes drift slowly through the light beam. Extremely shallow '
      + 'depth of field, anamorphic lens, muted warm palette, fine film grain, unhurried. '
      + 'Generous empty space. No text, no letters, no people.',
  },
  {
    번호: 2, 이름: '마스코트',
    그림: '본체',          // 정본 마스코트를 첫 프레임으로 넣는다
    지시: 'The camera slowly orbits a small coral wool-felt character resting on warm pale wood. '
      + 'Soft window light from the left. Fine needle-felted fibres catch the light along its edge. '
      + 'It breathes gently and blinks once, calm and still. Extremely shallow depth of field, '
      + 'cinematic, muted warm palette, fine film grain. No text, no letters.',
  },
  {
    번호: 3, 이름: '손길',
    지시: 'Macro shot of strands of coral and cream wool roving, a slim felting needle and a few small '
      + 'felt shapes arranged on natural linen. Warm raking side light. Very slow push-in. Extremely '
      + 'shallow depth of field, tactile and artisanal, muted warm palette, fine film grain. '
      + 'No text, no letters, no people, no hands.',
  },
  {
    번호: 4, 이름: '여백',
    지시: 'Slow pull-back from a calm minimal studio interior. Late afternoon light falls through a tall '
      + 'window across cream felt panels and pale wood. The room is quiet and almost empty, with generous '
      + 'negative space on the right side of the frame. Cinematic, muted warm palette, fine film grain, '
      + 'patient and expensive-looking. No text, no letters, no people.',
  },
];

const 잠깐 = (ms) => new Promise((s) => setTimeout(s, ms));
const 밑 = `https://${위치}-aiplatform.googleapis.com/v1/projects/${프로젝트}/locations/${위치}/publishers/google/models/${모델}`;

/** 마스코트 정본을 영상에 넣을 수 있는 크기로 줄인다(4096²·18MB 는 요청에 싣기엔 크다). */
function 그림준비(표정) {
  const 원본 = path.join(뿌리, 마스코트.경로(표정));
  const 사천 = path.join(뿌리, 'docs', '캐릭터', '정본_4K_후보', `몽글_${표정}.png`);
  const 쓸것 = fs.existsSync(사천) ? 사천 : 원본;   // 4K 판이 있으면 그쪽이 낫다
  const 줄인것 = path.join(os.tmpdir(), `synk_마스코트_${표정}_1440.png`);
  if (!fs.existsSync(줄인것)) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 쓸것, '-vf', 'scale=1440:-1', 줄인것]);
  }
  return { 파일: 줄인것, 출처: 쓸것 };
}

/* 🔑 토큰은 1시간짜리다. 4K 한 컷이 3~5분 걸리고 네 컷이면 20분이 넘어가므로,
 *   맨 앞에서 한 번 받아 들고 다니면 «폴링 도중에» 만료돼 401 이 난다(09-05 실측 — 220초에서 났다).
 *   부를 때마다 받는다 — 안에 캐시가 있어서 값이 안 든다. */
const 새토큰 = async () => (await 정책.제미나이헤더('돈')).authorization.slice(7);

/** 시작된 작업을 되찾아 받는다. 401 로 놓친 것도 이 이름만 있으면 다시 받을 수 있다(돈을 두 번 안 낸다). */
async function 받아내기(작업이름, 컷) {
  for (let i = 1; i <= 60; i++) {
    await 잠깐(10000);
    const t = await 새토큰();
    const p = await fetch(`${밑}:fetchPredictOperation`, {
      method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      body: JSON.stringify({ operationName: 작업이름 }),
    });
    const o = await p.json().catch(() => ({}));
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
  };
  const instance = { prompt: 컷.지시 };
  if (컷.그림) {
    const g = 그림준비(컷.그림);
    instance.image = { bytesBase64Encoded: fs.readFileSync(g.파일).toString('base64'), mimeType: 'image/png' };
    console.log(`   🧸 첫 프레임에 정본 마스코트를 넣는다: ${path.basename(g.출처)}`);
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
    console.log(`\n▶ 컷${컷.번호} ${컷.이름}`);
    const r = await 굽기(컷);
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
