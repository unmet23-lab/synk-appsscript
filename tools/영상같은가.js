#!/usr/bin/env node
'use strict';
/* 영상이 같은가(2026-11-13 LAB 하루 두 편 · 39계정 — 유호님 「이어서 만들기」). 틀을 고친 뒤 구운 영상이 고치기 전 영상과
 * 프레임 · 소리까지 같은지 잰다. 읽기만 한다(임시 폴더에 ffmpeg 통계 파일 하나를 쓰고 지운다).
 *
 *   node tools/영상같은가.js <기준 영상> <견줄 영상> [--평균 50] [--최저 45] [--잔차 -60] [--json]
 *
 * 쓰는 곳: 이야기 편을 판본 틀로 옮길 때(docs/마케팅/기획장부/제작절차.md 「새 원본 올리기」) — 옮기기 전 렌더와 옮긴 뒤 렌더를
 *   **같은 렌더 옵션**으로 구워 견준다. 이미 나간 게시 파일과 견주지 않는다(음량 마감 · 다시 담기를 거쳤고, 소스가 그 뒤 바뀐 편이 있다).
 * 재는 것:
 *   화면 — 크기 · 프레임 수 · 프레임마다 PSNR(ffmpeg psnr 필터의 프레임별 MSE).
 *   소리 — 첫 소리 줄기를 16비트 PCM으로 풀어 표본을 맞대 본다. 다르면 두 소리를 뺀 잔차의 가장 큰 값(dBFS)을 적는다.
 * 같음: 크기 · 프레임 수가 같고, 평균 PSNR ≥ 50dB · 가장 낮은 프레임 ≥ 45dB(모든 프레임 MSE 0이면 「같은 화소」),
 *   소리는 표본이 같거나 길이가 같고 잔차 봉우리 ≤ −60dBFS. 선을 낮춰 넘기지 않는다 — 다르면 어느 프레임인지 보고 원인을 고친다.
 * 종료: 0 같음 · 1 다름 · 2 쓰는 법이 틀렸거나 재지 못함.
 * 시험: node --test tests/영상같은가.test.js (ffmpeg 없이 도는 시험 — 실제 ffmpeg 줄은 11-13 형오빠 편에서 돌려 봤다)
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 기본선 = Object.freeze({ 평균: 50, 최저: 45, 잔차: -60 });

function 기본실행(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { windowsHide: true, maxBuffer: 1024 * 1024 * 1024, ...opts });
}

// ffmpeg psnr 필터의 stats_file → 프레임별 [{ n, mse }]
function 통계읽기(text) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const n = line.match(/(?:^|\s)n:(\d+)/);
    const mse = line.match(/(?:^|\s)mse_avg:([0-9.eE+-]+|inf|nan)/);
    if (n && mse) out.push({ n: Number(n[1]), mse: Number(mse[1]) });
  }
  return out;
}

const psnr = (mse) => (mse > 0 ? 10 * Math.log10((255 * 255) / mse) : Infinity);

function 화면셈(프레임들) {
  if (!프레임들.length) return null;
  let 합 = 0;
  let 가장큰 = 프레임들[0];
  for (const f of 프레임들) {
    if (!Number.isFinite(f.mse)) return { 평균: NaN, 최저: NaN, 최저프레임: f.n, 다른프레임: NaN, 프레임: 프레임들.length };
    합 += f.mse;
    if (f.mse > 가장큰.mse) 가장큰 = f;
  }
  return { 평균: psnr(합 / 프레임들.length), 최저: psnr(가장큰.mse), 최저프레임: 가장큰.n, 다른프레임: 프레임들.filter((f) => f.mse > 0).length, 프레임: 프레임들.length };
}

// 16비트 PCM 두 벌 → { 같은표본, 길이같음, 잔차dB }
function 소리셈(a, b) {
  if (a.length === b.length && a.equals(b)) return { 같은표본: true, 길이같음: true, 잔차dB: -Infinity, 표본: a.length >> 1 };
  const n = Math.min(a.length, b.length) >> 1;
  let 가장큰 = 0;
  for (let i = 0; i < n; i += 1) {
    const d = Math.abs(a.readInt16LE(i * 2) - b.readInt16LE(i * 2));
    if (d > 가장큰) 가장큰 = d;
  }
  return { 같은표본: false, 길이같음: a.length === b.length, 잔차dB: 가장큰 > 0 ? 20 * Math.log10(가장큰 / 32768) : -Infinity, 표본: n, 표본차: Math.abs(a.length - b.length) >> 1 };
}

function 판정(m, 선 = 기본선) {
  const 까닭 = [];
  if (m.기준.폭 !== m.견줄.폭 || m.기준.높이 !== m.견줄.높이) 까닭.push(`화면 크기가 다르다(${m.기준.폭}×${m.기준.높이} ↔ ${m.견줄.폭}×${m.견줄.높이})`);
  if (m.기준.프레임 !== m.견줄.프레임) 까닭.push(`프레임 수가 다르다(${m.기준.프레임} ↔ ${m.견줄.프레임})`);
  if (m.화면) {
    if (!(m.화면.평균 >= 선.평균)) 까닭.push(`평균 PSNR ${dB(m.화면.평균)} < ${선.평균}dB`);
    if (!(m.화면.최저 >= 선.최저)) 까닭.push(`가장 낮은 프레임 PSNR ${dB(m.화면.최저)} < ${선.최저}dB(${m.화면.최저프레임}번째)`);
  } else if (!까닭.length) 까닭.push('화면을 재지 못했다');
  if (m.기준.소리 !== m.견줄.소리) 까닭.push(`소리 줄기가 한쪽에만 있다(기준 ${m.기준.소리 ? '있음' : '없음'} · 견줄 ${m.견줄.소리 ? '있음' : '없음'})`);
  else if (m.소리 && !m.소리.같은표본) {
    if (!m.소리.길이같음) 까닭.push(`소리 길이가 다르다(표본 ${m.소리.표본차}개 차이)`);
    else if (!(m.소리.잔차dB <= 선.잔차)) 까닭.push(`소리 잔차 봉우리 ${dB(m.소리.잔차dB)}FS > ${dB(선.잔차)}FS`);
  }
  return { 같음: 까닭.length === 0, 까닭 };
}

const dB = (v) => (v === Infinity ? '∞dB' : v === -Infinity ? '−∞dB' : Number.isNaN(v) ? '?dB' : `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}dB`);

function 살피기(file, 실행) {
  const r = 실행('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,width,height,nb_read_frames,r_frame_rate:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffprobe 실패: ${file} — ${String(r.stderr || (r.error && r.error.message) || '').trim().split('\n').pop()}`);
  const j = JSON.parse(r.stdout);
  const v = (j.streams || []).find((s) => s.codec_type === 'video');
  if (!v) throw new Error(`영상 줄기가 없다: ${file}`);
  const [분자, 분모] = String(v.r_frame_rate || '0/1').split('/').map(Number);
  return {
    파일: file, 폭: v.width, 높이: v.height, 프레임: Number(v.nb_read_frames), fps: 분모 ? 분자 / 분모 : 0,
    길이: Number((j.format || {}).duration) || 0, 소리: (j.streams || []).some((s) => s.codec_type === 'audio'),
  };
}

function 소리풀기(file, 실행) {
  const r = 실행('ffmpeg', ['-hide_banner', '-v', 'error', '-i', file, '-map', '0:a:0', '-c:a', 'pcm_s16le', '-f', 's16le', '-']);
  if (r.status !== 0) throw new Error(`소리 풀기 실패: ${file} — ${String(r.stderr || '').trim().split('\n').pop()}`);
  return Buffer.isBuffer(r.stdout) ? r.stdout : Buffer.from(r.stdout || '');
}

function 재기(기준파일, 견줄파일, { 실행 = 기본실행 } = {}) {
  const 기준 = 살피기(기준파일, 실행);
  const 견줄 = 살피기(견줄파일, 실행);
  const m = { 기준, 견줄, 화면: null, 소리: null };
  if (기준.폭 === 견줄.폭 && 기준.높이 === 견줄.높이) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '영상같은가-'));
    try {
      // stats_file은 상대 이름으로 준다(윈도우 경로의 쌍점이 필터 글에서 갈라지지 않게) — 그래서 임시 폴더에서 돌린다
      const r = 실행('ffmpeg', ['-hide_banner', '-nostats', '-v', 'error', '-i', path.resolve(기준파일), '-i', path.resolve(견줄파일), '-lavfi', '[0:v][1:v]psnr=stats_file=psnr.log', '-an', '-f', 'null', '-'], { cwd: tmp, encoding: 'utf8' });
      if (r.status !== 0) throw new Error(`ffmpeg psnr 실패 — ${String(r.stderr || '').trim().split('\n').pop()}`);
      const log = path.join(tmp, 'psnr.log');
      m.화면 = 화면셈(통계읽기(fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : ''));
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  if (기준.소리 && 견줄.소리) m.소리 = 소리셈(소리풀기(기준파일, 실행), 소리풀기(견줄파일, 실행));
  return m;
}

function 보이기(m, v) {
  const 줄 = (이름, x) => `${이름}  ${x.파일} — ${x.폭}×${x.높이} · ${x.프레임}프레임 · ${x.길이.toFixed(2)}초 · 소리 ${x.소리 ? '있음' : '없음'}`;
  const out = [줄('기준', m.기준), 줄('견줄', m.견줄)];
  if (m.화면) {
    const 초 = m.견줄.fps ? ` · ${((m.화면.최저프레임 - 1) / m.견줄.fps).toFixed(2)}초` : '';
    out.push(m.화면.다른프레임 === 0 ? `화면  같은 화소(${m.화면.프레임}프레임 모두 MSE 0)` : `화면  평균 ${dB(m.화면.평균)} · 가장 낮은 프레임 ${dB(m.화면.최저)}(${m.화면.최저프레임}번째${초}) · 다른 프레임 ${m.화면.다른프레임}/${m.화면.프레임}`);
  } else out.push('화면  재지 않음(크기가 다르다)');
  if (m.소리) out.push(m.소리.같은표본 ? `소리  같은 표본(${m.소리.표본}개)` : `소리  잔차 봉우리 ${dB(m.소리.잔차dB)}FS${m.소리.길이같음 ? '' : ` · 길이가 표본 ${m.소리.표본차}개 다름`}`);
  else out.push(`소리  ${m.기준.소리 || m.견줄.소리 ? '한쪽에만 있다' : '둘 다 없다'}`);
  out.push(v.같음 ? '→ 같음' : `→ 다름: ${v.까닭.join(' · ')}`);
  return out.join('\n');
}

function main(argv, { 실행 = 기본실행 } = {}) {
  const 값 = {}, 위치 = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') 값.json = true;
    else if (['--평균', '--최저', '--잔차'].includes(a)) 값[a.slice(2)] = Number(argv[++i]);
    else if (a.startsWith('--')) { console.error(`모르는 인자: ${a}`); return 2; }
    else 위치.push(a);
  }
  if (위치.length !== 2) { console.error('쓰는 법: node tools/영상같은가.js <기준 영상> <견줄 영상> [--평균 50] [--최저 45] [--잔차 -60] [--json]'); return 2; }
  for (const f of 위치) if (!fs.existsSync(f)) { console.error(`파일이 없다: ${f}`); return 2; }
  const 선 = { ...기본선 };
  for (const k of Object.keys(기본선)) if (k in 값) { if (!Number.isFinite(값[k])) { console.error(`--${k}는 숫자`); return 2; } 선[k] = 값[k]; }
  let m;
  try { m = 재기(위치[0], 위치[1], { 실행 }); } catch (e) { console.error(`못 쟀다: ${e.message}`); return 2; }
  const v = 판정(m, 선);
  console.log(값.json ? JSON.stringify({ ...m, 선, ...v }, (k, x) => (x === Infinity ? 'inf' : x === -Infinity ? '-inf' : x), 1) : 보이기(m, v));
  return v.같음 ? 0 : 1;
}

module.exports = { 재기, 판정, 통계읽기, 화면셈, 소리셈, 보이기, main, 기본선 };
if (require.main === module) process.exitCode = main(process.argv.slice(2));
