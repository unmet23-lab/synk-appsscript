#!/usr/bin/env node
/**
 * 라디오의 «소리 목록»과 «무대 차례»를 만든다 (2026-09-08 · 0원).
 *
 * ■ 왜 있나
 *   유호 지시 09-08 「장면만 20분마다 바꾸는 테스트 해보자」.
 *   그전에는 무대 그림이 곡 파일 안에 박혀 있어서 «곡이 바뀌어야 장면이 바뀌었다».
 *   이제 소리와 무대를 따로 흘리려면 목록이 둘 필요하다 — 이 도구가 그 둘을 만든다.
 *
 * ■ 무엇을 만드나
 *   ① 소리 목록 (`소리/playlist.txt`)  — 곡 aac 들을 적은 concat 목록
 *   ② 무대 차례 (`무대차례/목록.txt`)  — 60초 되풀이 영상을 «한 무대당 <분>분어치» 늘어놓은 concat 목록
 *      (60초짜리를 스무 번 적으면 20분이다. ffmpeg 이 그 목록을 통째로 되풀이한다.)
 *
 * ■ 지키는 것
 *   · 목록에 적는 길은 «목록 파일이 있는 곳 기준»이라 서버 어디에 두어도 깨지지 않는다.
 *   · 소리 파일의 규격(코덱·표본율·채널)이 하나라도 다르면 멈춘다 — 이어 붙일 때 소리가 튄다.
 *   · 무대 영상의 규격(크기·픽셀꼴)이 다르면 멈춘다 — 같은 까닭이다.
 *
 * ■ 쓰기 (서버에서)
 *   node 라디오장면차례.js --소리 /opt/synk-radio/소리 --무대 /opt/synk-radio/무대차례 --분 20 \
 *        --차례 층_house.mp4,층_citypop.mp4,층_calm.mp4
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const 인자 = process.argv.slice(2);
const 값 = (k, d) => { const i = 인자.indexOf(k); return i >= 0 && 인자[i + 1] != null ? 인자[i + 1] : d; };
const 소리방 = 값('--소리', '');
const 무대방 = 값('--무대', '');
const 분 = Number(값('--분', '20'));
const 차례 = String(값('--차례', '')).split(',').map((s) => s.trim()).filter(Boolean);
const 곡차례 = String(값('--곡차례', '')).split(',').map((s) => s.trim()).filter(Boolean);
if (!소리방 || !무대방 || !차례.length) {
  console.error('쓰기: node 라디오장면차례.js --소리 <폴더> --무대 <폴더> --분 20 --차례 <mp4,mp4,…> [--곡차례 <aac,aac,…>]');
  process.exit(2);
}
const 재기 = (길, 항목) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 항목[0] === 'v' ? 'v:0' : 'a:0',
  '-show_entries', `stream=${항목.slice(2)}`, '-of', 'csv=p=0', 길], { encoding: 'utf8' }).trim();

// ── ① 소리 목록
const 곡들 = 곡차례.length ? 곡차례 : fs.readdirSync(소리방).filter((f) => f.endsWith('.aac')).sort();
if (!곡들.length) { console.error(`🔴 소리 파일이 없다: ${소리방}`); process.exit(1); }
const 소리규격 = new Set();
let 소리초 = 0;
for (const f of 곡들) {
  const 길 = path.join(소리방, f);
  if (!fs.existsSync(길)) { console.error(`🔴 없는 곡: ${길}`); process.exit(1); }
  소리규격.add(재기(길, 'a:codec_name,sample_rate,channels'));
  소리초 += Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 길], { encoding: 'utf8' }).trim()) || 0;
}
if (소리규격.size > 1) { console.error(`🔴 소리 규격이 갈렸다(이어 붙이면 소리가 튄다): ${[...소리규격].join(' / ')}`); process.exit(1); }
fs.writeFileSync(path.join(소리방, 'playlist.txt'),
  'ffconcat version 1.0\n' + 곡들.map((f) => `file '${f}'\n`).join(''), 'utf8');

// ── ② 무대 차례
const 무대규격 = new Set();
const 한판초 = [];
for (const f of 차례) {
  const 길 = path.join(무대방, f);
  if (!fs.existsSync(길)) { console.error(`🔴 없는 무대: ${길}`); process.exit(1); }
  무대규격.add(재기(길, 'v:codec_name,width,height,pix_fmt'));
  한판초.push(Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 길], { encoding: 'utf8' }).trim()) || 0);
}
if (무대규격.size > 1) { console.error(`🔴 무대 규격이 갈렸다(이어 붙이면 화면이 튄다): ${[...무대규격].join(' / ')}`); process.exit(1); }
let 줄 = 'ffconcat version 1.0\n';
차례.forEach((f, i) => {
  const 몇번 = Math.max(1, Math.round((분 * 60) / (한판초[i] || 60)));
  for (let k = 0; k < 몇번; k++) 줄 += `file '${f}'\n`;
});
fs.writeFileSync(path.join(무대방, '목록.txt'), 줄, 'utf8');

// ── ③ 낸 것을 셈해서 보여 준다
const 시 = (s) => `${Math.floor(s / 60)}분 ${Math.round(s % 60)}초`;
console.log(`✅ 소리 목록 ${곡들.length}곡 · 한 바퀴 ${시(소리초)} → ${path.join(소리방, 'playlist.txt')}`);
곡들.forEach((f, i) => console.log(`   ${String(i + 1).padStart(2)} ${f}`));
console.log(`✅ 무대 차례 ${차례.length}판 × ${분}분 · 한 바퀴 ${시(차례.length * 분 * 60)} → ${path.join(무대방, '목록.txt')}`);
차례.forEach((f, i) => console.log(`   ${i + 1} ${f} (${Math.round(한판초[i])}초짜리를 ${Math.round((분 * 60) / (한판초[i] || 60))}번)`));
console.log(`🔑 두 바퀴가 서로 안 나누어떨어지므로(소리 ${시(소리초)} · 무대 ${시(차례.length * 분 * 60)}) 같은 곡이 늘 같은 무대에서 나오지는 않는다 — 그게 이 시험의 뜻이다.`);
