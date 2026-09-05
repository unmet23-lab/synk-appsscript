#!/usr/bin/env node
/* 홍보영상에 얹을 음악 — Lyria(구글 곡 만드는 모델)로 굽는다.
 *
 * ■ 왜 컷마다 소리를 안 넣고 여기서 따로 굽나
 *   컷마다 소리를 만들면 이어붙이는 자리마다 소리가 «툭» 끊긴다. 그 끊김이 그대로 싸구려 신호다.
 *   명품 홍보물은 음악 하나가 처음부터 끝까지 흐른다. 그래서 영상은 소리 없이 굽고 여기서 한 벌을 만든다.
 *
 * ■ 값 (구글 공식 가격표 09-05 실측)
 *   「Count of samples for Lyria2 music generation model」 = $0.06/벌 ≈ ₩87
 *   ⇒ 여러 벌 굽고 고르는 것이 값의 문제가 아니다. 결이 문제다.
 *
 * ■ 쓰기
 *   node tools/홍보음악굽기.js           — 결 셋을 굽고 고르게 한다
 *   node tools/홍보음악굽기.js --결 1     — 그 결만
 */
'use strict';

const fs = require('fs');
const path = require('path');
const 정책 = require(path.join(__dirname, '모델정책.js'));

const 뿌리 = path.join(__dirname, '..');
const 낼곳 = path.join(뿌리, '영상', 'out', '홍보_4K', '음악');
const 프로젝트 = 정책.벌텍스프로젝트(); // 🔑 정본은 모델정책.js 하나 — 계정을 옮기면 거기 한 곳만 바뀐다
const 위치 = 'us-central1';
const 모델 = 'lyria-002';
const 벌당달러 = 0.06;
const 환율 = 1452;

/* 결 셋 — 「누가 봐도 명품」을 소리로 옮기면 이렇게 갈린다.
 * 공통으로 지키는 것: 느린 박자 · 악기 적게 · 큰 소리 없음 · 다 채우지 않는다(소리에도 여백). */
const 결들 = [
  {
    번호: 1, 이름: '피아노',
    지시: 'Sparse solo piano, very slow tempo, warm felt-muted upright piano, single sustained notes with '
      + 'long decay, gentle room reverb, no drums, no bass, no percussion. Intimate, patient, expensive, '
      + 'like a quiet gallery at opening hour. Minimal and unhurried.',
  },
  {
    번호: 2, 이름: '현악',
    지시: 'Slow warm string ensemble, soft sustained cello and viola, very gentle swell, no percussion, '
      + 'no drums, no brass. Refined, calm and dignified, subtle and understated, with plenty of space '
      + 'between phrases. Cinematic but restrained, luxurious and quiet.',
  },
  {
    번호: 3, 이름: '피아노와공기',
    지시: 'Minimal ambient piece: a few soft piano notes over a warm analogue pad, faint airy texture, '
      + 'very slow, no drums, no percussion, no melody hook. Meditative and elegant, understated luxury, '
      + 'like morning light moving across a wall.',
  },
];

(async () => {
  const 인자 = process.argv.slice(2);
  const 고른 = 인자.includes('--결') ? Number(인자[인자.indexOf('--결') + 1]) : null;
  const 굽을것 = 고른 ? 결들.filter((r) => r.번호 === 고른) : 결들;

  const 달러 = 벌당달러 * 굽을것.length;
  console.log(`■ 굽기 게이트 — 음악 ${굽을것.length}벌 ≈ $${달러.toFixed(2)} (약 ${Math.round(달러 * 환율).toLocaleString()}원)`);

  const 밑 = `https://${위치}-aiplatform.googleapis.com/v1/projects/${프로젝트}/locations/${위치}`
    + `/publishers/google/models/${모델}`;
  fs.mkdirSync(낼곳, { recursive: true });

  for (const 결 of 굽을것) {
    const t = (await 정책.제미나이헤더('돈')).authorization.slice(7);   // 매번 새로 — 토큰은 1시간짜리다
    console.log(`\n▶ 결${결.번호} ${결.이름}`);
    const r = await fetch(`${밑}:predict`, {
      method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        instances: [{
          prompt: 결.지시,
          negative_prompt: 'drums, percussion, beat, vocals, singing, voice, loud, distorted, cheerful pop',
        }],
        parameters: { sample_count: 1 },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.log(`   🔴 ${r.status} ${(j.error && j.error.message || '').replace(/\s+/g, ' ').slice(0, 160)}`);
      continue;
    }
    const p = (j.predictions || [])[0];
    const b64 = p && (p.bytesBase64Encoded || p.audioContent);
    if (!b64) { console.log(`   ❔ 모양을 모르겠다: ${JSON.stringify(j).slice(0, 250)}`); continue; }
    const 파일 = path.join(낼곳, `결${결.번호}_${결.이름}.wav`);
    fs.writeFileSync(파일, Buffer.from(b64, 'base64'));
    console.log(`   ✅ ${path.basename(파일)}  (${(fs.statSync(파일).size / 1024 / 1024).toFixed(2)} MB)`);
  }
  console.log(`\n■ ${낼곳}`);
})().catch((e) => { console.error('🔴', e.message); process.exit(1); });
