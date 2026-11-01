// 답 은행 시험 — 이어 붙인 소리(2026-11-01, 유호님 「이어 붙인 소리 들어 봐」). 지금까지 들은 3판은 Kore가 대본을 한 번에 읽은 판이라,
// 실제 앱처럼 조각을 따로 구워 이어 붙이면 어떻게 들리는지를 처음으로 듣는다. 은행3길.json이 고른 답을 그대로 쓰므로 고르기 호출은 없다.
// 굽기: 조각마다 Gemini 3.8 Live Kore 세션을 새로 열어 한 번만 읽힌다(받아쓰기가 글과 다르면 다시). 다듬기는 앞뒤 무음 자르기 · 세기 맞춤 · 5ms 페이드만.
// 네 판(대화마다): 실시간(실제 지연) · 소리만(차례 사이 0.45초, 이음새만 듣기) · 지금속도(말 끝 뒤 3.4초 기다림) · 맞장구(1.2초에 맞장구, 첫 반응은 2.9초).
// 쓰는 법: node 이어붙이기.mjs <조각|굽기|엮기|점검|전부>   → .tmp/답은행시험-20261101/조각소리/ · 이음/*.mp3
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as 은행 from './은행3.mjs';
import { 팬사인회 } from '../../lib/장면.mjs';
import 듣기대본 from '../../../synk-world-app/qa/realtime-roleplay-20261029/듣기시험/대본.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 저장소 = path.resolve(여기, '../../../..');
const 작업 = path.join(저장소, '.tmp', '답은행시험-20261101');
const 소리폴더 = path.join(작업, '조각소리');
const 장부파일 = path.join(소리폴더, '장부.json');
const 이음폴더 = path.join(작업, '이음');
const 표본율 = 24000;
const 제미나이주소 = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));
const 대화들 = ['A', 'B'];
// 말 끝을 알아챈 순간 바로 트는 짧은 소리 — 뜻을 모르는 때라 어떤 말에도 어울리는 것만
export const 맞장구들 = ['아~', '음~', '네~']; // 「오~」는 다섯 번 구워도 받아쓰기가 비어 내용을 확인할 수 없어 뺐다
// 기다림(초) — 속도 시험의 중앙값: 말 끝 알아채기 1.18 + 글 마무리 0.37 + 고르기 1.84 · 흘려 받으면 첫 반응 1.39
const 말끝 = 1.18; const 첫반응까지 = 1.18 + 0.37 + 1.39; const 다고른뒤 = 1.18 + 0.37 + 1.84;
const 차례사이 = 0.45; const 조각사이 = 0.2;

const 길 = () => JSON.parse(fs.readFileSync(path.join(작업, '은행3길.json'), 'utf8'));
/** 대화의 차례마다 학습자 말과 답 조각 */
export function 차례들(대) {
  const d = 길()[대];
  return d.차례.filter((t) => !t.건너뜀).map((t, i) => {
    const 조각 = t.판단 === '고름' ? 은행.조립(t.순간, t.반응, i, t.들은것).조각 : [t.하온];
    if (조각.join(' ') !== t.하온) throw new Error(`조립이 녹음 때와 다르다: ${대} ${i} 「${조각.join(' ')}」 / 「${t.하온}」`);
    return { 번호: i, 말: t.말, 조각 };
  });
}
const 첫인사 = () => 길().A.첫인사;
const 필요한글 = () => [...new Set([첫인사(), ...대화들.flatMap((대) => 차례들(대).flatMap((t) => t.조각)), ...맞장구들])];
const 장부 = () => (fs.existsSync(장부파일) ? JSON.parse(fs.readFileSync(장부파일, 'utf8')) : {});
const 뼈대 = (s) => String(s).replace(/[\s.,!?~…'"「」·]/g, '');

function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(표본율, 24);
  h.writeUInt32LE(표본율 * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

function 소켓열기(주소, 머리) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(주소, { headers: 머리 });
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('error', () => rej(new Error('연결 실패')), { once: true });
    ws.addEventListener('open', () => res(ws), { once: true });
  });
}

/** 세션 하나로 줄 하나를 읽힌다 — 소리는 turnComplete까지 온다 */
async function 한줄굽기(글, 키값) {
  const ws = await 소켓열기(제미나이주소, { 'x-goog-api-key': 키값 });
  const 조각 = []; let 받아쓰기 = ''; let 끝남 = false; let 준비 = false; let 오류 = null; let 닫힘 = null;
  ws.addEventListener('message', (ev) => {
    const e = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'));
    if (e.error) 오류 = JSON.stringify(e.error).slice(0, 200);
    if (e.setupComplete) 준비 = true;
    const sc = e.serverContent; if (!sc) return;
    for (const p of sc.modelTurn?.parts || []) if (p.inlineData?.data) 조각.push(Buffer.from(p.inlineData.data, 'base64'));
    if (sc.outputTranscription?.text) 받아쓰기 += sc.outputTranscription.text;
    if (sc.turnComplete) 끝남 = true;
  });
  ws.addEventListener('close', (ev) => { 닫힘 = `${ev.code} ${ev.reason || ''}`.trim(); });
  try {
    // 대본 줄로 줘야 학습자 말로 받아 답하지 않는다(「저는 서울에서 왔어요!」가 그랬다). 시제품 지시문의 「천천히 또박또박」도 넣어 조각끼리 빠르기를 맞춘다
    const 지시 = `${듣기대본.공통지시}\n\n장면: 팬사인회. 너의 역할: 하온(가상 아이돌). 연기: ${팬사인회.상대.연기} 상대는 초보자라 천천히 또박또박 말한다.\n\n대본:\n상대역: ${글}`;
    ws.send(JSON.stringify({ setup: {
      model: 'models/gemini-3.8-live',
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 팬사인회.상대.목소리['gemini-live'] } } } },
      systemInstruction: { parts: [{ text: 지시 }] }, outputAudioTranscription: {},
    } }));
    for (const 기한 = performance.now() + 15000; !준비 && !오류 && !닫힘 && performance.now() < 기한;) await 쉼(20);
    if (!준비) throw new Error(`시작 안 됨: ${오류 || 닫힘 || '시간 초과'}`);
    ws.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text: `(상황극 시작) 지금 상대역 1번 줄을 글자 그대로 한 번만 말한다: 「${글}」${맞장구들.includes(글) ? ' 맞장구라 아주 짧게 말한다.' : ''} 그다음 학습자가 말할 때까지 기다린다.` }] }], turnComplete: true } }));
    for (const 기한 = performance.now() + 30000; !끝남 && !오류 && !닫힘 && performance.now() < 기한;) await 쉼(20);
    if (!끝남) throw new Error(`답 끝 없음: ${오류 || 닫힘 || '시간 초과'}`);
    return { pcm: Buffer.concat(조각), 받아쓰기: 받아쓰기.trim() };
  } finally { try { ws.close(); } catch {} }
}

async function 굽기() {
  const 키값 = createRequire(import.meta.url)(path.join(저장소, 'tools', '모델정책.js')).제미나이키('글');
  fs.mkdirSync(소리폴더, { recursive: true });
  const 책 = 장부();
  const 대상 = 필요한글().filter((g) => !책[g]);
  let 다음 = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (다음 < 대상.length) {
      const 글 = 대상[다음++]; let 가장 = null;
      for (let 회 = 1; 회 <= 5; 회++) {
        try {
          const r = await 한줄굽기(글, 키값);
          if (!r.pcm.length) throw new Error('소리 없음');
          const 맞음 = 뼈대(r.받아쓰기) === 뼈대(글);
          if (맞음 || !가장) 가장 = { ...r, 맞음 };
          if (맞음) break;
          console.log(`  다시 「${글}」 ← 「${r.받아쓰기}」`);
        } catch (e) { console.log(`  실패 「${글}」 ${회}회: ${e.message}`); await 쉼(회 * 8000); }
      }
      if (!가장) throw new Error(`못 구웠다: ${글}`);
      const 파일 = `${String(fs.readdirSync(소리폴더).filter((f) => f.endsWith('.wav')).length + 1).padStart(3, '0')}.wav`;
      fs.writeFileSync(path.join(소리폴더, 파일), wav(가장.pcm));
      책[글] = { 파일, 받아쓰기: 가장.받아쓰기, 맞음: 가장.맞음 };
      fs.writeFileSync(장부파일, JSON.stringify(책, null, 1));
      console.log(`구움 ${파일} 「${글}」 ${(가장.pcm.length / 2 / 표본율).toFixed(2)}초 ${가장.맞음 ? '' : `받아쓰기 다름: ${가장.받아쓰기}`}`);
    }
  }));
  console.log(`조각 ${Object.keys(책).length}개`);
}

// ── 소리 다듬기: 무음 자르기 · 세기 맞춤 · 5ms 페이드(그 밖의 손질 없음) ──
const 틀 = 표본율 / 100; // 10ms
function 틀세기(pcm) {
  const n = pcm.length >> 1; const 값 = [];
  for (let s = 0; s + 틀 <= n; s += 틀) { let e = 0; for (let j = s; j < s + 틀; j++) { const v = pcm.readInt16LE(j * 2) / 32768; e += v * v; } 값.push(Math.sqrt(e / 틀)); }
  return 값;
}
function 무음자르기(pcm, 앞여유ms = 20, 뒤여유ms = 50) {
  const 값 = 틀세기(pcm); const 큰값 = Math.max(...값, 1e-6); const 문턱 = Math.max(0.004, 큰값 * 0.06);
  let a = 값.findIndex((v) => v > 문턱); if (a < 0) a = 0;
  let b = 값.length - 1; while (b > a && 값[b] <= 문턱) b--;
  const 시작 = Math.max(0, a * 틀 - (표본율 * 앞여유ms) / 1000); const 끝 = Math.min(pcm.length >> 1, (b + 1) * 틀 + (표본율 * 뒤여유ms) / 1000);
  return pcm.subarray(시작 * 2, 끝 * 2);
}
const 말세기 = (pcm) => { const 값 = 틀세기(pcm); const 큰값 = Math.max(...값, 1e-6); const 말 = 값.filter((v) => v > 큰값 * 0.15); return Math.sqrt(말.reduce((s, v) => s + v * v, 0) / Math.max(1, 말.length)); };
function 세기맞춤(pcm, 목표 = 0.1) {
  const 배 = Math.min(6, 목표 / Math.max(말세기(pcm), 1e-6)); const n = pcm.length >> 1; const out = Buffer.alloc(pcm.length); const 페이드 = Math.round(표본율 * 0.005);
  for (let i = 0; i < n; i++) { const 창 = Math.min(1, i / 페이드, (n - 1 - i) / 페이드); const v = Math.round(pcm.readInt16LE(i * 2) * 배 * 창); out.writeInt16LE(Math.max(-32768, Math.min(32767, v)), i * 2); }
  return out;
}
const 무음 = (초) => Buffer.alloc(Math.round(표본율 * 초) * 2);
const 소리길이 = (pcm) => pcm.length / 2 / 표본율;
const 조각소리 = (() => { const 캐시 = new Map(); return (글) => { if (!캐시.has(글)) { const 항목 = 장부()[글]; if (!항목) throw new Error(`안 구운 조각: ${글}`); 캐시.set(글, 세기맞춤(무음자르기(fs.readFileSync(path.join(소리폴더, 항목.파일)).subarray(44)))); } return 캐시.get(글); }; })();
const 학습자소리 = (대, i) => 세기맞춤(무음자르기(fs.readFileSync(path.join(작업, '학습자', `${대}_${i + 1}.wav`)).subarray(44)));
function 답소리(조각) { const 칸 = []; 조각.forEach((g, i) => { if (i) 칸.push(무음(조각사이)); 칸.push(조각소리(g)); }); return Buffer.concat(칸); }

/** 판 하나 — 기다림(i) = { 소리: 앞에 까는 pcm들 } 꼴이 판마다 다르다 */
function 판만들기(판, 대) {
  const 차례 = 차례들(대);
  if (판 === '실시간') {
    const 실 = JSON.parse(fs.readFileSync(path.join(작업, '실시간판.json'), 'utf8'))[대].줄;
    const 하온 = (i) => 세기맞춤(무음자르기(fs.readFileSync(path.join(작업, '실시간', `${대}_${i}.wav`)).subarray(44)));
    const 칸 = [하온(0), 무음(차례사이)];
    for (let i = 0; i < 실.length - 1; i++) {
      칸.push(학습자소리(대, i));
      const 파일있음 = fs.existsSync(path.join(작업, '실시간', `${대}_${i + 1}.wav`));
      if (!파일있음) { 칸.push(무음(차례사이)); continue; }
      칸.push(무음((실[i + 1].지연ms || 1200) / 1000), 하온(i + 1), 무음(차례사이));
    }
    return Buffer.concat(칸);
  }
  const 칸 = [조각소리(첫인사()), 무음(차례사이)];
  차례.forEach((t, i) => {
    칸.push(학습자소리(대, t.번호));
    if (판 === '소리만') 칸.push(무음(차례사이));
    else if (판 === '지금속도') 칸.push(무음(다고른뒤));
    else {
      const 소리 = 조각소리(맞장구들[(i + (대 === 'B' ? 1 : 0)) % 맞장구들.length]);
      칸.push(무음(말끝), 소리, 무음(Math.max(0.15, 첫반응까지 - 말끝 - 소리길이(소리))));
    }
    칸.push(답소리(t.조각), 무음(차례사이));
  });
  return Buffer.concat(칸);
}
export const 판들 = ['실시간', '소리만', '지금속도', '맞장구'];
function 엮기() {
  fs.mkdirSync(이음폴더, { recursive: true });
  for (const 판 of 판들) for (const 대 of 대화들) {
    const pcm = 판만들기(판, 대); const 임시 = path.join(이음폴더, `${판}_${대}.wav`);
    fs.writeFileSync(임시, wav(pcm));
    const 나감 = path.join(이음폴더, `이음_${판}_${대}.mp3`);
    const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-i', 임시, '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '1', '-b:a', '96k', 나감], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`ffmpeg 실패 ${나감}\n${(r.stderr || '').slice(-500)}`);
    console.log(`엮음 ${path.basename(나감)} ${소리길이(pcm).toFixed(1)}초`);
  }
}

/** 재서 찾기 — 조각마다 길이 · 말 빠르기 · 원래 세기, 평균에서 벗어난 조각을 표시 */
function 점검() {
  const 책 = 장부();
  const 줄 = Object.entries(책).filter(([g]) => !맞장구들.includes(g)).map(([글, h]) => {
    const pcm = 무음자르기(fs.readFileSync(path.join(소리폴더, h.파일)).subarray(44));
    const 음절 = 뼈대(글).length; const 초 = 소리길이(pcm);
    return { 글, 파일: h.파일, 초: Number(초.toFixed(2)), 음절, 초당: Number((음절 / 초).toFixed(1)), 세기dB: Number((20 * Math.log10(말세기(pcm))).toFixed(1)), 맞음: h.맞음 };
  });
  const 빠르기 = 줄.map((r) => r.초당).sort((a, b) => a - b); const 중앙 = 빠르기[Math.floor(빠르기.length / 2)];
  const 세기 = 줄.map((r) => r.세기dB).sort((a, b) => a - b);
  for (const r of 줄) { r.벗어남 = r.음절 >= 5 && Math.abs(r.초당 - 중앙) / 중앙 > 0.3; console.log(`${r.파일} ${String(r.초).padStart(5)}초 ${String(r.초당).padStart(5)}음절/초 ${r.세기dB}dB ${r.맞음 ? '' : '받아쓰기 다름 '}${r.벗어남 ? '빠르기 벗어남 ' : ''}「${r.글}」`); }
  const 요약 = { 조각: 줄.length, 중앙음절초: 중앙, 세기범위dB: [세기[0], 세기.at(-1)], 벗어남: 줄.filter((r) => r.벗어남).map((r) => r.글), 받아쓰기다름: 줄.filter((r) => !r.맞음).map((r) => r.글), 줄 };
  fs.writeFileSync(path.join(이음폴더, '점검.json'), JSON.stringify(요약, null, 1));
  console.log(JSON.stringify({ ...요약, 줄: undefined }));
}

if (process.argv[1] && path.basename(process.argv[1]) === '이어붙이기.mjs') {
  const 명령 = process.argv[2];
  if (명령 === '조각') { const g = 필요한글(); console.log(g.length); console.log(g.join('\n')); }
  else if (명령 === '굽기') await 굽기();
  else if (명령 === '다시') { // 고른 조각만 지우고 다시 굽는다: node 이어붙이기.mjs 다시 "글" "글" …
    const 책 = 장부(); for (const 글 of process.argv.slice(3)) { if (!책[글]) throw new Error(`장부에 없다: ${글}`); 책[글].옛파일 = 책[글].파일; delete 책[글]; }
    fs.writeFileSync(장부파일, JSON.stringify(책, null, 1)); await 굽기();
  }
  else if (명령 === '엮기') 엮기();
  else if (명령 === '점검') 점검();
  else if (명령 === '전부') { await 굽기(); 엮기(); 점검(); }
  else { console.error('명령: 조각 | 굽기 | 엮기 | 점검 | 전부'); process.exit(1); }
}
