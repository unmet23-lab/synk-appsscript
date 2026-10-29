#!/usr/bin/env node
/**
 * 1화 두 역(교수 · 선배) 목소리 후보 굽기(2026-10-30). 줄은 줄만들기.mjs가 쓴 <작업>/<역>_*.json · <역>_inworld.txt를 쓴다.
 *
 *   node 굽기.mjs 힉스필드 <작업>      일레븐 v4(역마다 셋) · Inworld 한국어(역마다 둘)를 founder 계정으로 접수 → 기다림 → 받기
 *   node 굽기.mjs openai <작업>        Realtime 2.1(교수 marin · 선배 cedar)에 줄마다 글로 지시해 받은 소리를 0.6초 쉼으로 잇는다
 *   node 굽기.mjs 맞추기 <작업>        받은 소리를 모두 −18 LUFS · 24kHz 모노 mp3로 맞춰 <작업>/판/에 둔다(비교는 같은 크기로)
 *
 * - 힉스필드 CLI는 셸을 거치지 않고 인자 배열로 부른다(대사 JSON의 따옴표가 셸에서 깨지지 않게). 계정은 HOME · USERPROFILE을
 *   ~/.ai-accounts/higgsfield-founder로 바꿔 고른다(현장노트 higgsfield 「계정」). 접수는 --wait 없이 하고 generate wait로 따로 기다린다
 *   (현장노트 영상 「타입캐스트 내레이션이 AI티 심함」 — --wait가 300초 넘게 말이 없으면 접수 자체가 안 된 것).
 * - OpenAI 키는 tools/lib/오픈AI키.mjs의 차례(결제 수단 없는 월 크레딧 조직)를 쓴다. 값은 찍지 않는다.
 * - 이미 받은 파일은 다시 굽지 않는다(크레딧을 두 번 쓰지 않게). 받은 작업 번호 · 크레딧 · 길이는 <작업>/기록.json.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { 키차례 } from '../../../../tools/lib/오픈AI키.mjs';
import { 후보, 인물말 } from './후보.mjs';

const [명령, 작업, 역인자] = process.argv.slice(2);
if (!명령 || !작업) { console.error('쓰는 법: node 굽기.mjs 힉스필드|openai|맞추기 <작업 폴더> [역,역…(기본 모두)]'); process.exit(2); }
const 역들 = 역인자 ? 역인자.split(',') : Object.keys(후보);
for (const 역 of 역들) if (!후보[역]) { console.error(`모르는 역: ${역}`); process.exit(2); }
const 기록파일 = path.join(작업, '기록.json');
const 기록 = fs.existsSync(기록파일) ? JSON.parse(fs.readFileSync(기록파일, 'utf8')) : { 판: {} };
const 저장 = () => fs.writeFileSync(기록파일, JSON.stringify(기록, null, 1));
const 멈춤 = (말) => { console.error(`[굽기] ${말}`); process.exit(1); };

// ── 힉스필드 ──
const 힉스집 = path.join(os.homedir(), '.ai-accounts', 'higgsfield-founder');
function 힉스(인자) {
 const r = spawnSync(path.join(process.env.APPDATA, 'npm', 'higgsfield'), [...인자, '--json'], { encoding: 'utf8', env: { ...process.env, HOME: 힉스집, USERPROFILE: 힉스집 }, timeout: 15 * 60 * 1000 });
 if (r.error) 멈춤(`힉스필드 CLI를 못 불렀다: ${r.error.message}`);
 const 글 = (r.stdout || '').trim();
 try { return JSON.parse(글); } catch { 멈춤(`JSON이 아닌 답(${인자.slice(0, 3).join(' ')}): ${(글 || r.stderr || '').slice(0, 400)}`); }
}
// 접수 답의 꼴이 정해져 있지 않다(10-30 첫 접수에서 id 칸을 못 찾았는데 작업은 만들어졌다) — 답 안의 id 꼴 칸을 모두 뒤지고,
// 그래도 없으면 접수 직전 이후에 만들어진 같은 종류의 가장 새 작업을 목록에서 찾는다(같은 판을 두 번 내지 않게).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function 번호찾기(o) {
 if (!o || typeof o !== 'object') return null;
 for (const k of ['id', 'job_id', 'jobId']) if (typeof o[k] === 'string' && UUID.test(o[k])) return o[k];
 for (const v of Object.values(o)) { const x = 번호찾기(v); if (x) return x; }
 return null;
}
function 작업번호(답, 종류, 이전) {
 const id = 번호찾기(답);
 if (id) return id;
 const 목록 = 힉스(['generate', 'list', '--size', '5']);
 const a = Array.isArray(목록) ? 목록 : 목록.jobs || 목록.items || 목록.data || [];
 return a.find((x) => x.job_type === 종류 && Date.parse(x.created_at) >= 이전 - 5000)?.id || null;
}
const 결과주소 = (답) => { const a = Array.isArray(답) ? 답 : 답.jobs || 답.data || [답]; const o = a.find((x) => x && (x.result_url || x.results)); return o?.result_url || o?.results?.[0]?.url || null; };
async function 받기(주소, 파일) {
 const res = await fetch(주소);
 if (!res.ok) 멈춤(`받기 실패 ${res.status}: ${주소}`);
 fs.writeFileSync(파일, Buffer.from(await res.arrayBuffer()));
}
function 잔액() {
 const r = spawnSync(path.join(process.env.APPDATA, 'npm', 'higgsfield'), ['account', 'status'], { encoding: 'utf8', env: { ...process.env, HOME: 힉스집, USERPROFILE: 힉스집 } });
 return (r.stdout || '').trim();
}

async function 힉스필드() {
 기록.잔액전 ??= 잔액();
 console.log(`[굽기] 시작 잔액: ${기록.잔액전}`);
 const 할일 = [];
 for (const 역 of 역들) {
  for (const 이름 of Object.keys(후보[역].eleven)) 할일.push({ 역, 엔진: 'eleven', 이름, 인자: ['generate', 'create', 'elevenlabs_v4', '--dialogue', fs.readFileSync(path.join(작업, `${역}_eleven_${이름}.json`), 'utf8'), '--stability', '0.5'] });
  for (const 목소리 of 후보[역].inworld) 할일.push({ 역, 엔진: 'inworld', 이름: 목소리.replace(/ \(ko\)$/, ''), 인자: ['generate', 'create', 'inworld_text_to_speech', '--prompt', fs.readFileSync(path.join(작업, `${역}_inworld.txt`), 'utf8'), '--voice', 목소리] });
 }
 // 접수 — 이미 번호가 있는 판은 다시 내지 않는다.
 for (const 일 of 할일) {
  const 열쇠 = `${일.역}_${일.엔진}_${일.이름}`;
  if (기록.판[열쇠]?.작업) continue;
  const 이전 = Date.now();
  const id = 작업번호(힉스(일.인자), 일.인자[2], 이전);
  if (!id) 멈춤(`접수 번호를 못 받았다: ${열쇠}`);
  기록.판[열쇠] = { 역: 일.역, 엔진: 일.엔진, 이름: 일.이름, 작업: id };
  저장();
  console.log(`[굽기] 접수 ${열쇠} → ${id}`);
 }
 // 기다림 · 받기
 for (const [열쇠, 판] of Object.entries(기록.판).filter(([, p]) => p.엔진 !== 'openai')) {
  if (판.파일 && fs.existsSync(path.join(작업, 판.파일))) continue;
  const 답 = 힉스(['generate', 'wait', 판.작업]);
  const 주소 = 결과주소(답);
  if (!주소) 멈춤(`결과 주소가 없다(${열쇠}): ${JSON.stringify(답).slice(0, 400)}`);
  판.파일 = `${열쇠}${path.extname(new URL(주소).pathname) || '.mp3'}`;
  await 받기(주소, path.join(작업, 판.파일));
  저장();
  console.log(`[굽기] 받음 ${판.파일}`);
 }
 기록.잔액뒤 = 잔액();
 저장();
 console.log(`[굽기] 끝 잔액: ${기록.잔액뒤}`);
}

// ── OpenAI Realtime 2.1 ──
const 표본율 = 24000;
function 키읽기({ 이름, 파일 }) {
 if (!fs.existsSync(파일)) 멈춤(`키 파일이 없다(${이름}): ${파일}`);
 const 값 = fs.readFileSync(파일, 'utf8').replace(/^﻿/, '').trim();
 if (!/^sk-\S+$/.test(값)) 멈춤(`키 파일에 sk- 로 시작하는 값이 없다(${이름})`);
 return 값;
}
function 줄말하기(키, 목소리, 지시, 줄) {
 return new Promise((풀림, 거절) => {
  const ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1', { headers: { Authorization: `Bearer ${키}` } });
  const 소리들 = [];
  let 지금 = [];
  let 차례 = -1;
  let 사용 = [];
  const 다음 = () => {
   차례 += 1;
   if (차례 >= 줄.length) { ws.close(); 풀림({ 소리들, 사용 }); return; }
   const l = 줄[차례];
   지금 = [];
   ws.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: `연기 지시: ${l.지문}\n대사(글자 그대로, 한 번만): ${l.소리}` }] } }));
   ws.send(JSON.stringify({ type: 'response.create' }));
  };
  const 시한 = setTimeout(() => { ws.close(); 거절(new Error('3분 안에 끝나지 않았다')); }, 3 * 60 * 1000);
  ws.onmessage = (m) => {
   const e = JSON.parse(m.data);
   if (e.type === 'session.created') {
    ws.send(JSON.stringify({ type: 'session.update', session: { type: 'realtime', instructions: 지시, output_modalities: ['audio'], audio: { output: { format: { type: 'audio/pcm', rate: 표본율 }, voice: 목소리 } } } }));
   } else if (e.type === 'session.updated') {
    if (차례 < 0) 다음();
   } else if (e.type === 'response.output_audio.delta') {
    지금.push(Buffer.from(e.delta, 'base64'));
   } else if (e.type === 'response.done') {
    사용.push(e.response?.usage || null);
    소리들.push(Buffer.concat(지금));
    다음();
   } else if (e.type === 'error') {
    clearTimeout(시한); ws.close(); 거절(new Error(`${e.error?.code} ${e.error?.message}`));
   }
  };
  ws.onclose = () => clearTimeout(시한);
  ws.onerror = (e) => { clearTimeout(시한); 거절(new Error(`연결 오류: ${e.message || e.type}`)); };
 });
}
function wav(pcm) {
 const h = Buffer.alloc(44);
 h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
 h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(표본율, 24);
 h.writeUInt32LE(표본율 * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
 return Buffer.concat([h, pcm]);
}
async function openai() {
 const 키들 = 키차례();
 for (const 역 of 역들) {
  const 줄 = JSON.parse(fs.readFileSync(path.join(작업, `${역}_줄.json`), 'utf8'));
  const 지시 = `너는 한국 드라마의 성우다. 배역: ${인물말[역]} 매번 받은 「대사」를 지문대로 연기해 글자 그대로 한 번만 말하고 멈춘다. 대사에 없는 말·인사·설명을 붙이지 않는다. 자연스러운 서울말 입말로.`;
  for (const 목소리 of 후보[역].openai) {
   const 열쇠 = `${역}_openai_${목소리}`;
   if (기록.판[열쇠]?.파일 && fs.existsSync(path.join(작업, 기록.판[열쇠].파일))) continue;
   let 답 = null;
   for (const k of 키들) {
    try { 답 = await 줄말하기(키읽기(k), 목소리, 지시, 줄); 기록.판[열쇠] = { 역, 엔진: 'openai', 이름: 목소리, 쓴키: k.이름 }; break; }
    catch (e) { console.error(`[굽기] ${열쇠} ${k.이름}: ${e.message}`); if (!/credit|quota|auth|key|permission|401|403/i.test(e.message)) break; }
   }
   if (!답) 멈춤(`${열쇠}를 굽지 못했다`);
   const 쉼 = Buffer.alloc(Math.round(표본율 * 0.6) * 2);
   const pcm = Buffer.concat(답.소리들.flatMap((s, i) => (i ? [쉼, s] : [s])));
   기록.판[열쇠].파일 = `${열쇠}.wav`;
   기록.판[열쇠].줄초 = 답.소리들.map((s) => Number((s.length / 2 / 표본율).toFixed(2)));
   기록.판[열쇠].사용 = 답.사용;
   fs.writeFileSync(path.join(작업, 기록.판[열쇠].파일), wav(pcm));
   저장();
   console.log(`[굽기] 받음 ${열쇠} · 줄 ${답.소리들.length}개 · ${(pcm.length / 2 / 표본율).toFixed(1)}초`);
  }
 }
}

// ── 크기 맞추기 ──
function 맞추기() {
 const 판폴더 = path.join(작업, '판');
 fs.mkdirSync(판폴더, { recursive: true });
 for (const [열쇠, 판] of Object.entries(기록.판)) {
  if (!판.파일) continue;
  const 들 = path.join(작업, 판.파일), 날 = path.join(판폴더, `${열쇠}.mp3`);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', 들, '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11', '-ar', '24000', '-ac', '1', '-b:a', '96k', 날], { encoding: 'utf8' });
  if (r.status !== 0) 멈춤(`ffmpeg 실패(${열쇠}): ${r.stderr.slice(0, 300)}`);
  const 길이 = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 날], { encoding: 'utf8' }).stdout.trim();
  판.판 = `판/${열쇠}.mp3`;
  판.초 = Number(Number(길이).toFixed(1));
  console.log(`[굽기] ${열쇠} · ${판.초}초`);
 }
 저장();
}

if (명령 === '힉스필드') await 힉스필드();
else if (명령 === 'openai') await openai();
else if (명령 === '맞추기') 맞추기();
else 멈춤(`모르는 명령: ${명령}`);
