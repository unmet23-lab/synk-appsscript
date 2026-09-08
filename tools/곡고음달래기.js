#!/usr/bin/env node
/**
 * 곡의 «귀를 찌르는 순간»만 눌러 준다 — 2~8kHz 봉우리만 잡고 밝기는 안 깎는다.
 *
 * ■ 왜 있나 (2026-09-08 유호 지적 「고음이 튀는것같아 … 귀가 아파」)
 *   먼저 «평균»으로 재 봤더니 그 곡의 높은 쪽은 오히려 **다른 곡보다 조용했다**. 자를 바꾸니 보였다:
 *   「튄다」는 평균이 아니라 **순간의 봉우리**다.
 *
 *   | | 2~8kHz 평균 | 2~8kHz 최대 |
 *   |---|---|---|
 *   | 씨앗8888 | −28.7 | **−1.7** ← 여기 |
 *   | 다른 곡 여섯 | −26~−31 | −5.0 ~ −6.5 |
 *
 *   평균은 같은데 최대만 4~5dB 높다. 그 순간이 귀를 찌른다.
 *
 * ■ 어떻게
 *   소리를 세 칸(2kHz 아래 · 2~8kHz · 8kHz 위)으로 갈라 **가운데 칸에만 천장**을 두고 다시 합친다.
 *   `acrossover` 는 갈랐다 합쳐도 소리가 안 어긋나는 갈래(Linkwitz-Riley)라 이 일에 맞다.
 *   🔑 **누르는 자를 «압축»이 아니라 «천장»으로 골랐다** — 압축은 붙는 데 3ms 가 걸려 빠른 봉우리를
 *      놓친다(09-08 실측: 문턱을 셋으로 바꿔 봐도 −2.4 아래로 안 내려갔다).
 *
 * 쓰는 법:
 *   node tools/곡고음달래기.js <넣을곡> <나올파일.wav> [천장(0~1, 기본 0.53 = −5.5dB)]
 *   천장 값은 «다른 곡들의 2~8kHz 최대»에 맞춘다 — 재는 자는 아래 --재기.
 *   node tools/곡고음달래기.js --재기 <곡...>          # 2~8kHz 평균·최대만 잰다(고치지 않는다)
 */
'use strict';
const fs = require('fs');
const { spawnSync } = require('child_process');

const 인자 = process.argv.slice(2);

function 재기(f) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'highpass=f=2000,lowpass=f=8000,volumedetect', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const 글 = r.stderr || '';
  const 뽑 = (이름) => { const m = 글.match(new RegExp(이름 + ':\\s*(-?[\\d.]+) dB')); return m ? Number(m[1]) : null; };
  return { 평균: 뽑('mean_volume'), 최대: 뽑('max_volume') };
}

if (인자[0] === '--재기') {
  console.log('2~8kHz 만 남기고 잰 값 — 「최대」가 다른 곡보다 높으면 그 곡이 귀를 찌른다\n');
  console.log('평균     최대     곡');
  for (const f of 인자.slice(1)) {
    if (!fs.existsSync(f)) { console.log(`  (없다) ${f}`); continue; }
    const v = 재기(f);
    console.log(`${String(v.평균).padStart(7)}  ${String(v.최대).padStart(7)}  ${f.split(/[\\/]/).pop()}`);
  }
  process.exit(0);
}

const [넣을것, 낼것, 천장기본] = 인자;
if (!넣을것 || !낼것) {
  console.error('\n🔴 쓰는 법: node tools/곡고음달래기.js <넣을곡> <나올파일.wav> [천장 0~1]\n');
  process.exit(1);
}
if (!fs.existsSync(넣을것)) { console.error(`\n🔴 곡이 없다: ${넣을것}\n`); process.exit(1); }
const 천장 = Number(천장기본) > 0 ? Number(천장기본) : 0.53;

const 앞 = 재기(넣을것);
console.log(`전  2~8kHz 평균 ${앞.평균} · 최대 ${앞.최대}`);
console.log(`천장 ${천장} (${(20 * Math.log10(천장)).toFixed(1)}dB) 로 누른다`);

const 필터 = '[0:a]acrossover=split=2000 8000[lo][mi][hi];'
  + `[mi]alimiter=limit=${천장}:attack=1:release=60:level=disabled[mic];`
  + '[lo][mic][hi]amix=inputs=3:normalize=0[out]';
const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', 넣을것,
  '-filter_complex', 필터, '-map', '[out]', '-c:a', 'pcm_s24le', '-ar', '44100', '-ac', '2', 낼것],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
if (r.status !== 0) { console.error(`\n🔴 ffmpeg 실패\n${(r.stderr || '').slice(-1200)}\n`); process.exit(1); }

const 뒤 = 재기(낼것);
console.log(`후  2~8kHz 평균 ${뒤.평균} · 최대 ${뒤.최대}`);
console.log(`\n✅ ${낼것}`);
console.log(`   봉우리를 ${(앞.최대 - 뒤.최대).toFixed(1)}dB 낮췄다 · 평균은 ${(앞.평균 - 뒤.평균).toFixed(1)}dB 만 움직였다(밝기는 그대로)\n`);
