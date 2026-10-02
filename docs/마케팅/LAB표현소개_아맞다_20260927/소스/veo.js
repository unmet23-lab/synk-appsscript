'use strict';
/* LAB 표현소개 EP01 · 펠트 상황 장면(우산·비) 한 컷 — Veo 3.1 · 9:16 · 8초 · 1080p · 소리 없음.
 * 인증·프로젝트는 tools/모델정책.js 하나가 쥔다(유료 문 = SYNK_ALLOW_PAID_API=1 명시). */
const fs = require('fs'); const path = require('path');
const 정책 = require('C:/Users/q1212/Documents/SYNK-appsscript/tools/모델정책.js');
const 낼곳 = __dirname + '/veo';
const 프로젝트 = 정책.벌텍스프로젝트();
const 위치 = 'us-central1';
const 모델 = process.env.SYNK_VEO_MODEL || 'veo-3.1-generate-001';
const 밑 = `https://${위치}-aiplatform.googleapis.com/v1/projects/${프로젝트}/locations/${위치}/publishers/google/models/${모델}`;
const 새토큰 = async () => (await 정책.제미나이헤더('돈')).authorization.slice(7);
const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));
const 이름 = process.argv[2] || 'umbrella';
const 지시 = {
  umbrella: 'Handmade needle-felted wool miniature diorama, stop-motion craft aesthetic. A small coral-pink felt umbrella leans against a cream felt wall beside a tiny felt front door. Through a round felt window, soft rain made of tiny white wool drops drifts down slowly. Warm soft studio light, tactile wool fibers, shallow depth of field, clean white paper backdrop. Camera completely static and locked off, no zoom, no pan. Only very gentle motion: rain drops drifting, a soft light shimmer. No people, no animals, no text, no letters, no logos. The umbrella and door are centered in the frame.',
};
async function 받아내기(작업이름) {
  for (let i = 1; i <= 90; i++) {
    await 잠깐(10000);
    let p, o;
    try {
      const t = await 새토큰();
      p = await fetch(`${밑}:fetchPredictOperation`, { method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: JSON.stringify({ operationName: 작업이름 }) });
      o = await p.json().catch(() => ({}));
    } catch (e) { console.log(`망 끊김 ${e.message}`); continue; }
    if (!p.ok) return { 실패: `폴링 ${p.status} ${(o.error && o.error.message || '').slice(0, 200)}` };
    if (!o.done) { console.log(`…${i * 10}초`); continue; }
    if (o.error) return { 실패: JSON.stringify(o.error).slice(0, 400) };
    const 영상들 = (o.response && (o.response.videos || o.response.generatedSamples)) || [];
    if (!영상들.length) return { 실패: `결과 비었음: ${JSON.stringify(o.response || {}).slice(0, 400)}` };
    const v = 영상들[0];
    const b64 = v.bytesBase64Encoded || (v.video && v.video.bytesBase64Encoded);
    if (!b64) return { 실패: `모양 모름: ${JSON.stringify(v).slice(0, 300)}` };
    fs.mkdirSync(낼곳, { recursive: true });
    const 파일 = path.join(낼곳, `${이름}.mp4`);
    fs.writeFileSync(파일, Buffer.from(b64, 'base64'));
    return { 파일, 메가: (fs.statSync(파일).size / 1048576).toFixed(2) };
  }
  return { 실패: '15분 안에 안 끝났다' };
}
(async () => {
  console.log(`■ Veo 굽기 ${이름} · ${모델} · 9:16 · 8초 · 1080p · 소리 없음 · 프로젝트 ${프로젝트}`);
  console.log('  값 ≈ 8초 × $0.20(소리 없음 기준) ≈ $1.6 · 무료 크레딧에서 나간다');
  const t = await 새토큰();
  const parameters = { sampleCount: 1, durationSeconds: 8, aspectRatio: '9:16', resolution: '1080p', generateAudio: false, personGeneration: 'dont_allow',
    negativePrompt: 'people, person, hands, face, animals, text, letters, words, watermark, logo, subtitles, camera movement, zoom, pan, shaking, fast motion, motion blur, dark, gloomy' };
  const r = await fetch(`${밑}:predictLongRunning`, { method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: JSON.stringify({ instances: [{ prompt: 지시[이름] }], parameters }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.log(`🔴 시작 실패 ${r.status} ${(j.error && j.error.message || '').slice(0, 400)}`); process.exit(2); }
  fs.mkdirSync(낼곳, { recursive: true });
  fs.appendFileSync(path.join(낼곳, '작업장부.jsonl'), JSON.stringify({ 때: new Date().toISOString(), 이름, 모델, 작업: j.name }) + '\n');
  console.log(`  작업 ${j.name.split('/').pop()}`);
  const 결과 = await 받아내기(j.name);
  console.log(결과.파일 ? `✅ ${결과.파일} (${결과.메가} MB)` : `🔴 ${결과.실패}`);
  process.exit(결과.파일 ? 0 : 3);
})().catch((e) => { console.log('🔴 ' + (e.message || e)); process.exit(4); });
