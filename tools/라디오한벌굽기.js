#!/usr/bin/env node
/**
 * 곡 여럿을 «이음매 없는 한 벌»로 굽는다 — 곡과 곡 사이도, 한 바퀴 도는 자리도 안 끊긴다.
 *
 * ■ 왜 있나 (2026-09-08 유호 지적 「노래 전환할때 약간 끊기거든」 · 「각곡당 다 하나씩만」)
 *   재 보니 끊김의 까닭이 셋이었다.
 *   ① **곡 파일 하나가 같은 노래를 세 번 이어 붙인 것이었다.** 원본 156초짜리가 방송판에서 492초다.
 *      그래서 한 곡이 세 번 반복해 들렸다.
 *   ② **곡 자체가 제 발로 안 끝난다.** 수노 시티팝 셋의 «마지막 1초 낮아짐»이 1.9·8.0·5.0dB 였다
 *      (문턱 20). 소리가 살아 있는 채로 잘린다.
 *   ③ **이어 붙이는 자리에 틈이 난다.** 낱개 파일을 `-c copy` 로 이으면 AAC 의 앞머리 여백이 그대로 남는다.
 *
 *   셋을 한 번에 없애는 길 = **곡 사이를 겹쳐 넘기며(크로스페이드) 한 파일로 굽는다.**
 *   ②는 겹치는 구간이 덮어 주고, ③은 이을 자리가 아예 없어지고, ①은 원본을 한 번씩만 쓰면 끝난다.
 *
 * ■ 한 바퀴 도는 자리(파일 끝 → 파일 처음)도 잇는다
 *   그냥 이어 붙이면 마지막 곡이 끝나고 첫 곡이 시작할 때 한 번 툭 끊긴다. 그래서 «솔기»를 굽는다:
 *     사슬 C(길이 L)를 만든 뒤 → 가운데(d~L-d) 뒤에 «꼬리(L-d~L)와 머리(0~d)를 겹친 구간»을 붙인다.
 *   그러면 파일이 끝나는 소리가 파일이 «d초 지점»의 소리와 이어지고, 되감으면 거기서 이어진다.
 *
 * ■ 규격을 맞춘다
 *   방송이 `-c:a copy` 로 그대로 흘리므로 이미 있는 파일과 **같은 규격**이라야 한다:
 *   AAC(ADTS) · 44100Hz · 2ch · 192k. 소리 크기는 2패스 loudnorm I=-14:TP=-1.5:LRA=11.
 *
 * 쓰는 법:
 *   node tools/라디오한벌굽기.js --낼 <나올파일.aac> --겹침 6 -- <곡1> <곡2> ...
 *   node tools/라디오한벌굽기.js --목록 <곡목록.txt> --낼 <나올파일.aac>
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const 인자 = process.argv.slice(2);
const 값 = (이름, 기본) => { const i = 인자.indexOf(이름); return i > -1 ? 인자[i + 1] : 기본; };
const 낼길 = 값('--낼', '');
const 겹침 = Number(값('--겹침', '6'));
const 목록길 = 값('--목록', '');
const 임시방 = 값('--임시', path.join(os.tmpdir(), 'synk-한벌'));

let 곡들 = [];
if (목록길) {
  곡들 = fs.readFileSync(목록길, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
} else {
  const i = 인자.indexOf('--');
  if (i > -1) 곡들 = 인자.slice(i + 1);
}
if (!낼길 || 곡들.length < 2) {
  console.error('\n🔴 쓰는 법: node tools/라디오한벌굽기.js --낼 <나올파일.aac> [--겹침 6] -- <곡1> <곡2> ...\n');
  process.exit(1);
}
for (const f of 곡들) if (!fs.existsSync(f)) { console.error(`\n🔴 곡이 없다: ${f}\n`); process.exit(1); }
fs.mkdirSync(임시방, { recursive: true });

const 달리기 = (인수, 조용히) => {
  const r = spawnSync('ffmpeg', 인수, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error(`\n🔴 ffmpeg 실패 (${r.status})\n${(r.stderr || '').slice(-1500)}\n`);
    process.exit(1);
  }
  return 조용히 ? '' : (r.stderr || '');
};
const 길이재기 = (f) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' });
  return Number((r.stdout || '').trim());
};

/* ── ① 사슬 — 곡과 곡 사이를 겹쳐 넘긴다 ─────────────────────────── */
console.log(`① 곡 ${곡들.length}벌을 ${겹침}초씩 겹쳐 잇는다`);
곡들.forEach((f, i) => console.log(`   ${i + 1}. ${path.basename(f)} (${길이재기(f).toFixed(0)}초)`));

const 사슬길 = path.join(임시방, '사슬.wav');
{
  const 앞 = ['-hide_banner', '-loglevel', 'error', '-y'];
  곡들.forEach((f) => 앞.push('-i', f));
  const 필터 = [];
  /* 규격을 먼저 맞춘다 — 표본율·채널이 곡마다 다르면 acrossfade 가 조용히 어긋난다. */
  곡들.forEach((_, i) => 필터.push(`[${i}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asetpts=N/SR/TB[a${i}]`));
  let 앞칸 = 'a0';
  for (let i = 1; i < 곡들.length; i++) {
    const 뒤칸 = i === 곡들.length - 1 ? 'chain' : `x${i}`;
    필터.push(`[${앞칸}][a${i}]acrossfade=d=${겹침}:c1=tri:c2=tri[${뒤칸}]`);
    앞칸 = 뒤칸;
  }
  달리기([...앞, '-filter_complex', 필터.join(';'), '-map', '[chain]', '-c:a', 'pcm_s24le', '-ar', '44100', '-ac', '2', 사슬길], true);
}
const 사슬초 = 길이재기(사슬길);
console.log(`   사슬 ${(사슬초 / 60).toFixed(1)}분`);

/* ── ② 솔기 — 한 바퀴 도는 자리를 잇는다 ──────────────────────────── */
console.log(`② 되감기는 자리를 ${겹침}초 겹쳐 잇는다(안 하면 마지막 곡 → 첫 곡에서 한 번 끊긴다)`);
const 솔기길 = path.join(임시방, '솔기.wav');
{
  const 필터 = [
    '[0:a]asplit=3[h][m][t]',
    `[h]atrim=0:${겹침},asetpts=N/SR/TB[head]`,
    `[m]atrim=${겹침}:${(사슬초 - 겹침).toFixed(3)},asetpts=N/SR/TB[mid]`,
    `[t]atrim=start=${(사슬초 - 겹침).toFixed(3)},asetpts=N/SR/TB[tail]`,
    `[tail][head]acrossfade=d=${겹침}:c1=tri:c2=tri[seam]`,
    '[mid][seam]concat=n=2:v=0:a=1[out]',
  ];
  달리기(['-hide_banner', '-loglevel', 'error', '-y', '-i', 사슬길,
    '-filter_complex', 필터.join(';'), '-map', '[out]', '-c:a', 'pcm_s24le', '-ar', '44100', '-ac', '2', 솔기길], true);
}
console.log(`   ${(길이재기(솔기길) / 60).toFixed(1)}분`);

/* ── ③ 소리 크기 — 2패스 loudnorm ──────────────────────────────── */
console.log('③ 소리 크기를 맞춘다(2패스 loudnorm I=-14:TP=-1.5:LRA=11)');
const 잰것 = 달리기(['-hide_banner', '-i', 솔기길, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
const 몸 = 잰것.slice(잰것.lastIndexOf('{'), 잰것.lastIndexOf('}') + 1);
let 잰값 = null;
try { 잰값 = JSON.parse(몸); } catch (e) { console.log('   ⚠ 1패스 값을 못 읽었다 — 1패스로만 간다'); }
const 소리자 = 잰값
  ? `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${잰값.input_i}:measured_TP=${잰값.input_tp}:measured_LRA=${잰값.input_lra}:measured_thresh=${잰값.input_thresh}:offset=${잰값.target_offset}:linear=true`
  : 'loudnorm=I=-14:TP=-1.5:LRA=11';
if (잰값) console.log(`   잰 값 I=${잰값.input_i} TP=${잰값.input_tp} LRA=${잰값.input_lra}`);

/* ── ④ 방송 규격으로 굽는다 ────────────────────────────────────── */
console.log('④ 방송 규격으로 굽는다(AAC ADTS · 44100 · 2ch · 192k)');
fs.mkdirSync(path.dirname(path.resolve(낼길)), { recursive: true });
/* 🔴 09-08 실측 — loudnorm 의 TP=-1.5 를 걸었는데도 다 굽고 나면 봉우리가 +0.1dBFS 였다.
   AAC 로 누르는 과정에서 표본과 표본 «사이»의 봉우리가 올라오기 때문이다. 0 을 넘으면 재생기에 따라
   깎여서 지직거리므로, 누르기 «직전»에 천장을 한 번 더 단다(-1.0dBFS = 0.891). */
달리기(['-hide_banner', '-loglevel', 'error', '-y', '-i', 솔기길,
  '-af', `${소리자},alimiter=limit=0.891:attack=1:release=40:level=disabled`,
  '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2', '-f', 'adts', 낼길], true);

const 낸초 = 길이재기(낼길);
console.log(`\n✅ ${낼길}`);
console.log(`   ${(fs.statSync(낼길).size / 1024 / 1024).toFixed(1)}MB · ${(낸초 / 60).toFixed(1)}분 · 곡 ${곡들.length}벌이 한 번씩`);
console.log('   ⚠ ADTS 는 ffprobe 가 길이를 넉넉히 어림한다 — 정확한 길이는 실제 재생으로 잰다.\n');
