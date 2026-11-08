'use strict';

// ⑲ 배경음 층(11-08 유호님 「백그라운드 뮤직은 뭘 사용한거야? 중간중간 좀 빠져있는데 의도한거야?」 → 「다음 편부터 고쳐」) —
// 섞인 소리의 음량 · 무음(④ · ⑰)은 다 통과해도 음악만 1~3초씩 빠진다. LAB 춥다차갑다(11-08 21:00)는 찬바람에 일부러 낮춘 음악이
// 0.5초 돌아오자마자 곡(보유곡 밝은_052) 안의 빈 마디에 다시 꺼져 3.5초가 비었고, 음악 바닥이 전체보다 13dB 작았다.
// tools/음악층.js가 편의 Remotion 사본에서 음악 말고 모든 소리를 무음으로 바꿔 음악만 렌더해 게시/음악층.json에 잰 값을 남기고,
// 이 판정을 올리기 전 검사가 쓴다. 측정 · 판정을 한곳에 둔다(시험은 tests/음악층.test.js).
const fs = require('node:fs');
const path = require('node:path');
const { FIX, LOOK } = require('./게시글규칙.js');

const 칸 = 0.25; // 초
// 꺼짐 = 가운데보다 꺼짐dB 넘게 낮은 칸이 꺼짐초 넘게 이어지고(이음초 안으로 돌아온 것은 이어서) 그 안에 깊은dB 넘게 꺼진 칸이 있는 자리.
// 10dB만 보면 춥다차갑다 13초 곡 빈 마디(7~13dB) · 17초 끝 얼음 · 잘하고있어 6~8초가 빠졌다 — 유호님이 들은 자리를 다 잡는 값(11-08 실측)
const 기준 = Object.freeze({ 꺼짐dB: 6, 깊은dB: 10, 꺼짐초: 0.75, 이음초: 0.75, 처음빼기: 0.5, 끝빼기: 0.75, 낮음dB: 6, 낮음초: 1.5, 바닥dB: 12 });
const LAYER_FROM = '20261109'; // 이 날부터 만든 편(폴더 이름 끝 날짜)은 음악층.json이 있어야 한다 — 유호님 「다음 편부터」

const 가운데 = (xs) => { const s = xs.filter((v) => v > -60).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : -99; };

// 0.25초 칸 dB 줄 → 음악 가운데보다 꺼짐dB 넘게 낮은 칸이 이어진 자리. 이음초 안으로 잠깐 돌아왔다 다시 꺼지면 한 자리로 잇는다
// (춥다차갑다 10.5~12.4초 낮춤 → 12.5초 0.5초 돌아옴 → 13~13.75초 곡 안 빈 마디: 들으면 한 번에 3.5초 빈다).
// 곡의 조용한 마디처럼 얕게만 낮은 자리는 빼려고, 그 안에 깊은dB 넘게 꺼진 칸이 있어야 꺼짐으로 친다. 깊이는 dB(소리가 아예 없으면 99)
function 꺼짐찾기(bins, o = {}) {
  const k = { ...기준, ...o };
  const 중 = o.가운데 ?? 가운데(bins);
  const 길이 = bins.length * 칸;
  const 낮은 = bins.map((v, i) => i * 칸 >= k.처음빼기 && (i + 1) * 칸 <= 길이 - k.끝빼기 && v < 중 - k.꺼짐dB);
  const 자리 = [];
  낮은.forEach((on, i) => {
    if (!on) return;
    const 앞 = 자리[자리.length - 1];
    if (앞 && (i - 앞.끝) * 칸 <= k.이음초) { 앞.끝 = i + 1; 앞.최저 = Math.min(앞.최저, bins[i]); }
    else 자리.push({ 시작: i, 끝: i + 1, 최저: bins[i] });
  });
  return 자리.filter((z) => (z.끝 - z.시작) * 칸 >= k.꺼짐초 && z.최저 < 중 - k.깊은dB)
    .map((z) => ({ 시작: z.시작 * 칸, 끝: z.끝 * 칸, 깊이: Math.min(99, Math.round(중 - z.최저)) }));
}

// 1초 이동 평균(에너지)이 가운데보다 낮음dB 넘게 낮은 채 낮음초 넘게 이어진 자리 — 꺼짐까지는 아니어도 음악이 얇아져 「빠진 듯」 들린다
function 낮음찾기(bins, o = {}) {
  const k = { ...기준, ...o };
  const 중 = o.가운데 ?? 가운데(bins);
  const w = Math.round(1 / 칸);
  const 평균 = bins.map((_, i) => {
    const a = bins.slice(Math.max(0, i - Math.floor(w / 2)), Math.min(bins.length, i + Math.ceil(w / 2)));
    return 10 * Math.log10(a.reduce((s, v) => s + 10 ** (v / 10), 0) / a.length);
  });
  const 길이 = bins.length * 칸;
  const 자리 = [];
  평균.forEach((v, i) => {
    const t = i * 칸;
    if (t < k.처음빼기 || t + 칸 > 길이 - k.끝빼기 || v >= 중 - k.낮음dB) return;
    const 앞 = 자리[자리.length - 1];
    if (앞 && 앞.끝 === i) 앞.끝 = i + 1; else 자리.push({ 시작: i, 끝: i + 1 });
  });
  return 자리.filter((z) => (z.끝 - z.시작) * 칸 >= k.낮음초).map((z) => ({ 시작: z.시작 * 칸, 끝: z.끝 * 칸 }));
}

// 음악만 칸 · 전체 칸 → 음악층.json에 남길 값
function 재기(음악칸, 전체칸) {
  const 음악가운데 = 가운데(음악칸), 전체가운데 = 가운데(전체칸);
  return {
    길이: 음악칸.length * 칸,
    음악가운데: Math.round(음악가운데 * 10) / 10,
    전체가운데: Math.round(전체가운데 * 10) / 10,
    꺼짐: 꺼짐찾기(음악칸, { 가운데: 음악가운데 }),
    낮음: 낮음찾기(음악칸, { 가운데: 음악가운데 }),
    바닥차: Math.round((전체가운데 - 음악가운데) * 10) / 10,
  };
}

// 이 편이 음악층 대상인가 — Remotion 프로젝트에 음악 파일(bgm.*)이 하나
function 음악파일(편폴더) {
  const pub = path.join(편폴더, 'remotion', 'public');
  if (!fs.existsSync(pub)) return null;
  const 찾은 = [];
  const 돌기 = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) 돌기(p); else if (/^bgm\.(wav|mp3|m4a)$/i.test(e.name)) 찾은.push(p); } };
  try { 돌기(pub); } catch { return null; }
  return 찾은.length === 1 ? 찾은[0] : null;
}

const 초글 = (z) => `${z.시작.toFixed(2)}~${z.끝.toFixed(2)}초`;

// ⑲ 올리기 전 검사 — bundle = { dir, name, prep }, videoFiles = 그 편 영상 판(재고 나서 다시 렌더했는지 본다)
function musicLayerFindings(bundle, videoFiles) {
  const findings = [];
  const add = (level, code, message) => findings.push({ level, code, where: '배경음 층', message });
  if (!음악파일(bundle.dir)) return findings; // Remotion 음악 파일이 없는 편(진행자 편 · 그림 편)은 묻지 않는다
  const 글칸 = (k) => (typeof bundle.prep[k] === 'string' ? bundle.prep[k].trim() : '');
  const 판단 = 글칸('음악꺼짐판단'), 못함 = 글칸('음악층못함');
  const file = path.join(bundle.dir, '게시', '음악층.json');
  let r = null;
  try { r = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* 없다 */ }
  if (!r) {
    const day = (String(bundle.name || path.basename(bundle.dir)).match(/_(\d{8})$/) || [])[1];
    if (못함) add(LOOK, 'music-layer-skipped', `음악층을 못 쟀다 — 「음악층못함」: ${못함}`);
    else if (day && day >= LAYER_FROM) add(FIX, 'music-layer-missing', '음악만 잰 기록이 없다(11-09부터 만든 편) — node tools/음악층.js --편 <편 폴더>. 못 재면 준비.json 「음악층못함」에 까닭');
    return findings;
  }
  const 만든때 = Date.parse(r.만든때 || '') || 0;
  const 새영상 = videoFiles.filter((v) => { try { return fs.statSync(v).mtimeMs > 만든때 + 1000; } catch { return false; } });
  if (새영상.length) add(FIX, 'music-layer-stale', `음악층을 잰 뒤 영상이 바뀌었다(${새영상.map((v) => path.basename(v)).join(', ')}) — 다시 잰다`);
  const 꺼짐 = Array.isArray(r.꺼짐) ? r.꺼짐 : [];
  if (꺼짐.length) {
    const 글 = 꺼짐.map((z) => `${초글(z)} ${z.깊이}dB`).join(' · ');
    add(판단 ? LOOK : FIX, 'music-layer-drop', `음악이 꺼지는 자리 ${꺼짐.length}곳 — ${글}${판단 ? ` · 「음악꺼짐판단」: ${판단}` : ' — 일부러 낮춘 자리면 절반(−6dB)보다 깊게 1초 넘게 내리지 말고 그 밑에 바탕 소리(바람 · 초침 · 방 소리)를 깐다. 곡 안 빈 마디면 다른 구간을 쓴다. 그래도 둘 까닭은 준비.json 「음악꺼짐판단」'}`);
  }
  const 낮음 = (Array.isArray(r.낮음) ? r.낮음 : []).filter((z) => !꺼짐.some((x) => z.시작 < x.끝 && x.시작 < z.끝));
  if (낮음.length) add(LOOK, 'music-layer-dip', `음악이 얇아지는 자리(1초 평균이 가운데보다 ${기준.낮음dB}dB 넘게 낮음) — ${낮음.map(초글).join(' · ')}`);
  if (Number(r.바닥차) > 기준.바닥dB) add(LOOK, 'music-layer-low', `음악이 전체 소리보다 ${r.바닥차}dB 작게 깔렸다 — 말 없는 자리가 빈 듯 들린다(목소리보다 ${기준.바닥dB}dB 안쪽으로)`);
  return findings;
}

module.exports = { 꺼짐찾기, 낮음찾기, 재기, 음악파일, musicLayerFindings, 가운데, 기준, LAYER_FROM, 칸 };
