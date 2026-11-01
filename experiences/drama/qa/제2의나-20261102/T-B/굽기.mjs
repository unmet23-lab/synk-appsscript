#!/usr/bin/env node
/**
 * 「제2의 나」 T-B 이름 부르기 굽기 · 맞추기 · 받아 적기 · 표(2026-11-02). 줄은 줄.mjs(이름 10개 × 선배 Julian · 교수 Elena = 20줄).
 *
 *   node 굽기.mjs 줄                       20줄을 찍는다(네트워크 없음)
 *   node 굽기.mjs 견적 [작업]               줄마다 힉스필드 견적(generate cost, 크레딧 안 나감)을 <작업>/기록.json에 둔다
 *   node 굽기.mjs 굽기 [작업] [--하나] [--상한 40]
 *                                          아직 안 받은 줄을 한 줄씩 접수 → 기다림 → 받기. 줄마다 실제로 빠진 크레딧을 거래 목록에서 찾아 적는다.
 *                                          --하나: 한 줄만 굽고 멈춘다(첫 줄로 실제 값을 본 뒤 나머지를 굽는다).
 *                                          이미 쓴 크레딧 + 다음 줄 견적이 상한(기본 40)을 넘으면 접수하지 않고 멈춘다.
 *   node 굽기.mjs 맞추기 [작업]             받은 소리를 1화 승인 녹음(같은 역)의 평균 크기(LUFS)로 맞춘 사본 → <작업>/맞춘/
 *   node 굽기.mjs 받아쓰기 [작업]           맞춘 사본을 OpenAI gpt-transcribe로 받아 적는다(tools/lib/오픈AI키.mjs 월 크레딧 키 차례, 현금 안 나감).
 *                                          드라마 받아 적기와 같이 prompt · 언어 힌트를 주지 않는다 — 이름을 미리 알려 주지 않는 시험.
 *   node 굽기.mjs 표 [작업]                 기록 · 받아쓰기 · 듣기재기.py의 재기.json을 모아 <작업>/표.md · 표.json
 *
 * 작업 폴더 기본값: 공용 작업본의 .tmp/me2-20261102/T-B(git 밖).
 * 힉스필드는 1화 목소리 후보 때와 같은 길 — founder 계정 CLI(HOME · USERPROFILE = ~/.ai-accounts/higgsfield-founder), `elevenlabs_v4`
 * `--dialogue '[{text:"[꼬리표] 말", voice_id, voice_type:"preset"}]' --stability 0.5`(experiences/drama/qa/목소리후보-20261030/굽기.mjs).
 * 접수는 --wait 없이 하고 generate wait로 따로 기다린다(현장노트 영상 「타입캐스트 내레이션이 AI티 심함」). 받은 파일은 다시 굽지 않는다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { 차례로부르기, 바탕주소 } from '../../../../../tools/lib/오픈AI키.mjs';
import { 줄목록, 대화, 목소리, 안정도, 이름부분 } from './줄.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '../../../../..');
const 인자 = process.argv.slice(2);
const 명령 = 인자[0];
const 작업 = path.resolve(인자[1] && !인자[1].startsWith('--') ? 인자[1] : path.join(뿌리, '.tmp/me2-20261102/T-B'));
const 깃발 = (이름) => 인자.includes(이름);
const 값 = (이름, 기본) => { const i = 인자.indexOf(이름); return i >= 0 ? 인자[i + 1] : 기본; };
const 기록파일 = path.join(작업, '기록.json');
const 기록 = fs.existsSync(기록파일) ? JSON.parse(fs.readFileSync(기록파일, 'utf8')) : { 줄: {} };
const 저장 = () => { fs.mkdirSync(작업, { recursive: true }); fs.writeFileSync(기록파일, JSON.stringify(기록, null, 1)); };
const 멈춤 = (말) => { console.error(`[T-B] ${말}`); process.exit(1); };
const 줄 = 줄목록();

// ── 힉스필드 founder CLI ──
const 힉스집 = path.join(os.homedir(), '.ai-accounts', 'higgsfield-founder');
const 힉스실행 = path.join(process.env.APPDATA || '', 'npm', 'higgsfield');
function 힉스(인자들, { json = true } = {}) {
 const r = spawnSync(힉스실행, json ? [...인자들, '--json'] : 인자들, { encoding: 'utf8', env: { ...process.env, HOME: 힉스집, USERPROFILE: 힉스집 }, timeout: 15 * 60 * 1000 });
 if (r.error) 멈춤(`힉스필드 CLI를 못 불렀다: ${r.error.message}`);
 const 글 = (r.stdout || '').trim();
 if (!json) return 글;
 try { return JSON.parse(글); } catch { 멈춤(`JSON이 아닌 답(${인자들.slice(0, 3).join(' ')}): ${(글 || r.stderr || '').slice(0, 400)}`); }
}
const 잔액 = () => { const 글 = 힉스(['account', 'status'], { json: false }); const m = 글.match(/([\d.]+) credits/); return { 글, 값: m ? Number(m[1]) : null }; };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const 번호찾기 = (o) => { if (!o || typeof o !== 'object') return null; for (const k of ['id', 'job_id', 'jobId']) if (typeof o[k] === 'string' && UUID.test(o[k])) return o[k]; for (const v of Object.values(o)) { const x = 번호찾기(v); if (x) return x; } return null; };
const 주소찾기 = (o) => { if (!o || typeof o !== 'object') return null; if (typeof o.result_url === 'string') return o.result_url; if (Array.isArray(o.results) && typeof o.results[0]?.url === 'string') return o.results[0].url; for (const v of Object.values(o)) { const x = 주소찾기(v); if (x) return x; } return null; };
const 받은파일 = (l) => path.join(작업, '받은', `${l.파일머리}.mp3`);
const 맞춘파일 = (l) => path.join(작업, '맞춘', `${l.파일머리}.mp3`);
const 쓴합 = () => Object.values(기록.줄).reduce((n, r) => n + (Number.isFinite(r.크레딧) ? r.크레딧 : r.견적 ?? 0), 0);

/** 접수 시각 뒤 「Eleven v4」 지출 가운데 아직 어느 줄에도 안 붙은 가장 이른 것 */
function 거래찾기(이후) {
 const 붙은 = new Set(Object.values(기록.줄).map((r) => r.거래시각).filter(Boolean));
 for (let 번 = 0; 번 < 6; 번 += 1) {
  const 답 = 힉스(['account', 'transactions', '--size', '20']);
  const 후보 = (답.items || []).filter((t) => t.action === 'spend' && /eleven/i.test(t.display_name || '') && Date.parse(t.created_at) >= 이후 - 3000 && !붙은.has(t.created_at))
   .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  if (후보.length) return { 크레딧: Math.abs(후보[0].credits), 거래시각: 후보[0].created_at, 같은때다른지출: 후보.length - 1 };
  spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},3000)']);
 }
 return null;
}

async function 굽기() {
 fs.mkdirSync(path.join(작업, '받은'), { recursive: true });
 const 상한 = Number(값('--상한', '40'));
 const 이번상한 = Number(값('--이번상한', 'Infinity')); // 이번 실행에서 쓸 몫(2판은 2크레딧)
 const 시작합 = 쓴합();
 기록.잔액전 ??= 잔액().글;
 저장();
 console.log(`[T-B] 잔액(시작 기록): ${기록.잔액전} · 이미 쓴 ${시작합.toFixed(2)} · 상한 ${상한} · 이번 몫 ${이번상한}`);
 let 구운수 = 0;
 for (const l of 줄) {
  const 열쇠 = l.파일머리;
  const r = (기록.줄[열쇠] ??= { 번호: l.번호, 역: l.역, 이름: l.이름, 말: l.말 });
  if (r.파일 && fs.existsSync(path.join(작업, r.파일))) continue;
  if (!r.작업) {
   const 견적 = Number(r.견적 ?? 힉스(['generate', 'cost', 'elevenlabs_v4', '--dialogue', 대화(l), '--stability', 안정도])?.credits);
   if (!Number.isFinite(견적)) 멈춤(`견적을 못 받았다: ${열쇠}`);
   r.견적 = 견적;
   if (쓴합() - 시작합 > 이번상한) { 저장(); 멈춤(`이번에 쓴 ${(쓴합() - 시작합 - 견적).toFixed(2)} + 이 줄 견적 ${견적} 이 이번 몫 ${이번상한}을 넘는다 — 멈추고 여쭌다`); }
   if (쓴합() > 상한) { 저장(); 멈춤(`이미 쓴 ${(쓴합() - 견적).toFixed(2)} + 이 줄 견적 ${견적} 이 상한 ${상한}을 넘는다 — 멈추고 여쭌다`); }
   const 이전 = Date.now();
   const 앞잔액 = 잔액().값;
   const 답 = 힉스(['generate', 'create', 'elevenlabs_v4', '--dialogue', 대화(l), '--stability', 안정도]);
   let id = 번호찾기(답);
   if (!id) {
    const 목록 = 힉스(['generate', 'list', '--size', '5']);
    const a = Array.isArray(목록) ? 목록 : 목록.jobs || 목록.items || 목록.data || [];
    id = a.find((x) => x.job_type === 'elevenlabs_v4' && Date.parse(x.created_at) >= 이전 - 5000)?.id || null;
    if (id) r.메모 = '접수 답에서 번호를 못 읽어 목록으로 찾음';
   }
   if (!id) { 저장(); 멈춤(`접수 번호를 못 받았다(${열쇠}) — 거래 목록 · generate list로 실제 접수 여부를 먼저 본다`); }
   Object.assign(r, { 작업: id, 접수: new Date(이전).toISOString(), 앞잔액 });
   저장();
   console.log(`[T-B] 접수 ${열쇠} → ${id} (견적 ${견적})`);
  }
  const 기다림 = 힉스(['generate', 'wait', r.작업]);
  const 주소 = 주소찾기(기다림);
  if (!주소) { 저장(); 멈춤(`결과 주소가 없다(${열쇠}): ${JSON.stringify(기다림).slice(0, 400)}`); }
  const res = await fetch(주소);
  if (!res.ok) 멈춤(`받기 실패 ${res.status}: ${주소}`);
  fs.writeFileSync(받은파일(l), Buffer.from(await res.arrayBuffer()));
  r.파일 = path.relative(작업, 받은파일(l)).replaceAll('\\', '/');
  const 거래 = 거래찾기(Date.parse(r.접수));
  if (거래) Object.assign(r, 거래); else r.크레딧메모 = '거래 목록에서 못 찾음 — 견적으로 셈';
  r.뒤잔액 = 잔액().값;
  저장();
  구운수 += 1;
  console.log(`[T-B] 받음 ${r.파일} · 크레딧 ${r.크레딧 ?? `(견적 ${r.견적})`} · 잔액 ${r.앞잔액} → ${r.뒤잔액} · 쓴 합 ${쓴합().toFixed(2)}`);
  if (깃발('--하나')) break;
 }
 기록.잔액뒤 = 잔액().글;
 저장();
 console.log(`[T-B] 이번에 ${구운수}줄 · 쓴 합 ${쓴합().toFixed(2)} · 잔액 ${기록.잔액뒤}`);
}

function 견적() {
 기록.견적 = {};
 for (const l of 줄) {
  const c = 힉스(['generate', 'cost', 'elevenlabs_v4', '--dialogue', 대화(l), '--stability', 안정도])?.credits;
  기록.견적[l.파일머리] = c;
  console.log(`${l.번호} ${l.파일머리} ${c}`);
 }
 const 합 = Object.values(기록.견적).reduce((n, c) => n + Number(c), 0);
 기록.견적합 = Number(합.toFixed(2));
 저장();
 console.log(`합 ${합.toFixed(2)}크레딧`);
}

// ── 크기 맞추기 ──
function 크기재기(파일) {
 const 잼 = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', 파일, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
 const I = Number((잼.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop()?.match(/-?[\d.]+/)?.[0]);
 const 봉 = Number((잼.match(/Peak:\s+(-?[\d.]+) dBFS/g) || []).pop()?.match(/-?[\d.]+/)?.[0]);
 return { I, 봉 };
}
const 길이 = (파일) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 파일], { encoding: 'utf8' }).stdout.trim());

function 맞추기() {
 const 소리 = path.join(뿌리, 'experiences/drama/s1/소리');
 기록.승인크기 = {};
 for (const [역, v] of Object.entries(목소리)) {
  const 파일들 = fs.readdirSync(소리).filter((f) => f.startsWith(`${v.승인}-`) && f.endsWith('.mp3'));
  const 잰 = 파일들.map((f) => 크기재기(path.join(소리, f)).I).filter(Number.isFinite);
  기록.승인크기[역] = { 목소리: v.이름, 파일수: 잰.length, 평균: Number((잰.reduce((a, b) => a + b, 0) / 잰.length).toFixed(1)), 범위: [Math.min(...잰), Math.max(...잰)] };
  console.log(`[T-B] 승인 ${v.승인} ${잰.length}개 평균 ${기록.승인크기[역].평균} LUFS (${기록.승인크기[역].범위.join(' ~ ')})`);
 }
 fs.mkdirSync(path.join(작업, '맞춘'), { recursive: true });
 for (const l of 줄) {
  const r = 기록.줄[l.파일머리];
  if (!r?.파일) continue;
  const 목표 = 기록.승인크기[l.역].평균;
  const 들 = path.join(작업, r.파일), 날 = 맞춘파일(l);
  // 1화 한줄굽기.mjs와 같은 다듬기(앞뒤 −45dB 무음 덜기 · 끝 0.3초 여유) 뒤 두 번 재는 loudnorm(짧은 줄은 한 번 재기가 빗나간다).
  const 다듬기 = 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.3';
  const 첫 = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', 들, '-af', `${다듬기},loudnorm=I=${목표}:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const m = JSON.parse(첫.slice(첫.lastIndexOf('{'), 첫.lastIndexOf('}') + 1));
  const 둘 = `${다듬기},loudnorm=I=${목표}:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const 결과 = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', 들, '-af', 둘, '-ar', '24000', '-ac', '1', '-b:a', '96k', 날], { encoding: 'utf8' });
  if (결과.status !== 0) 멈춤(`ffmpeg 실패(${l.파일머리}): ${결과.stderr.slice(0, 300)}`);
  const 잰 = 크기재기(날);
  Object.assign(r, { 맞춘: path.relative(작업, 날).replaceAll('\\', '/'), 원본초: Number(길이(들).toFixed(2)), 맞춘초: Number(길이(날).toFixed(2)), 맞춘크기: 잰.I, 맞춘봉우리: 잰.봉, 목표크기: 목표 });
  console.log(`[T-B] ${l.파일머리} ${r.원본초}s → ${r.맞춘초}s · ${잰.I} LUFS (목표 ${목표}) · 봉우리 ${잰.봉}`);
 }
 저장();
}

// ── OpenAI 받아 적기 ──
async function 받아쓰기() {
 const 파일 = path.join(작업, '받아쓰기.json');
 const 결과 = fs.existsSync(파일) ? JSON.parse(fs.readFileSync(파일, 'utf8')) : {};
 for (const l of 줄) {
  const r = 기록.줄[l.파일머리];
  if (!r?.맞춘 || 결과[l.파일머리]?.글 != null) continue;
  const 소리 = fs.readFileSync(path.join(작업, r.맞춘));
  let 받음;
  try {
   받음 = await 차례로부르기(() => {
    const form = new FormData();
    form.set('file', new Blob([소리], { type: 'audio/mpeg' }), 'call.mp3');
    form.set('model', 'gpt-transcribe');
    form.set('response_format', 'json');
    return { 주소: `${바탕주소()}/audio/transcriptions`, 몸: form };
   }, { 용도: '말하기', 제한ms: 60_000, 알림: (말) => console.log(`[T-B] ${말}`) });
  } catch (e) {
   // 코드 3 = 키 차례 전부 월 크레딧 바닥 — 돈 드는 길로 돌리지 않고 멈춘다(표는 로컬 받아쓰기를 주 귀로 쓴다)
   if (e.코드 === 3) { 결과.막힘 = `${new Date().toISOString()} 키 차례 전부 429 credit_balance_exhausted — 로컬 받아쓰기로 대신함`; fs.writeFileSync(파일, JSON.stringify(결과, null, 1)); 멈춤(e.message); }
   throw e;
  }
  const { 답, 요청, 쓴키 } = 받음;
  결과[l.파일머리] = { 글: 답.text ?? '', 언어: 답.languages ?? null, 사용: 답.usage ?? null, 요청, 쓴키 };
  fs.writeFileSync(파일, JSON.stringify(결과, null, 1));
  console.log(`[T-B] ${l.파일머리}: ${답.text}`);
 }
}

// ── 표 ──
const 정규 = (s) => (s || '').normalize('NFC').replace(/[^가-힣A-Za-z0-9]/g, '');
/** 「이름+아」를 소리 나는 대로(받침이 다음 「아」의 첫소리로 넘어감) — 「오윤아」 ↔ 「오유나」 */
function 연음(글) {
 const 끝 = 글.codePointAt(글.length - 2) - 0xac00;
 if (!글.endsWith('아') || 끝 < 0 || 끝 >= 11172 || 끝 % 28 === 0) return 글;
 const 받침 = 끝 % 28;
 const 첫 = { 1: 0, 4: 2, 7: 3, 8: 5, 16: 6, 17: 7, 19: 9, 21: 11, 22: 12, 23: 14, 24: 15, 25: 16, 26: 17, 27: 18 }[받침];
 if (첫 === undefined || 받침 === 21) return 글; // ㅇ받침은 넘어가지 않는다
 return 글.slice(0, -2) + String.fromCodePoint(0xac00 + 끝 - 받침) + String.fromCodePoint(0xac00 + 첫 * 588);
}
/**
 * 서울말에서 소리가 같은 표기를 하나로 — 받아쓰기는 소리만 듣고 철자를 고르므로 철자 차이를 「틀림」으로 세지 않는다.
 * ㅐ ↔ ㅔ · ㅒ ↔ ㅖ · ㅙ ↔ ㅚ ↔ ㅞ(모음 합류), 「ㅣ」 뒤 「아 · 어」 ↔ 「야 · 여」(반모음 덧남 — 「프리아」 = 「프리야」).
 */
function 소리꼴(글) {
 const 칸 = [...글].map((c) => { const k = c.codePointAt(0) - 0xac00; return k >= 0 && k < 11172 ? [Math.floor(k / 588), Math.floor((k % 588) / 28), k % 28] : c; });
 const 모음 = { 1: 5, 3: 7, 10: 15, 11: 15 };
 for (let i = 0; i < 칸.length; i += 1) {
  if (!Array.isArray(칸[i])) continue;
  칸[i][1] = 모음[칸[i][1]] ?? 칸[i][1];
  const 앞 = 칸[i - 1];
  if (Array.isArray(앞) && 앞[1] === 20 && 앞[2] === 0 && 칸[i][0] === 11 && (칸[i][1] === 0 || 칸[i][1] === 4)) 칸[i][1] += 2;
 }
 return 칸.map((x) => (Array.isArray(x) ? String.fromCodePoint(0xac00 + x[0] * 588 + x[1] * 28 + x[2]) : x)).join('');
}
function 판정(l, 글) {
 const g = 정규(글);
 const 이름 = 정규(l.이름);
 const 부름 = 정규(이름부분(l.말));
 const 후보 = l.역 === '선배' ? [[부름, '이름+꼬리 그대로'], [연음(부름), `소리 나는 대로(${연음(부름)})`], [이름, '이름 그대로(꼬리는 다르게 적힘)']] : [[이름, '이름 그대로']];
 for (const [꼴, 근거] of 후보) if (g.includes(꼴)) return { 판정: '맞음', 근거 };
 for (const [꼴, 근거] of 후보) if (소리꼴(g).includes(소리꼴(꼴))) return { 판정: '맞음', 근거: `소리 같음(${근거.replace(/\(.*\)/, '')} · 적힌 철자만 다름)` };
 return { 판정: '틀림', 근거: '이름이 다른 소리로 들림' };
}
function 나머지맞음(l, 글) {
 const 꼬리 = 정규(l.역 === '선배' ? '여기야' : '잠깐 이야기 좀 할 수 있어요');
 return 정규(글).includes(꼬리);
}

function 표() {
 const 오픈 = fs.existsSync(path.join(작업, '받아쓰기.json')) ? JSON.parse(fs.readFileSync(path.join(작업, '받아쓰기.json'), 'utf8')) : {};
 const 재기 = fs.existsSync(path.join(작업, '재기.json')) ? JSON.parse(fs.readFileSync(path.join(작업, '재기.json'), 'utf8')) : {};
 // 주 귀: OpenAI gpt-transcribe(드라마 받아 적기 길)가 받아 적었으면 그것, 아니면 로컬 faster-whisper large-v3-turbo. 다른 귀: medium.
 const 오픈씀 = 줄.some((l) => 오픈[l.파일머리]?.글 != null);
 const 주귀이름 = 오픈씀 ? 'gpt-transcribe' : 'whisper large-v3-turbo';
 const 행 = 줄.map((l) => {
  const r = 기록.줄[l.파일머리] || {};
  const w = 재기[l.파일머리];
  const 주 = 오픈씀 ? 오픈[l.파일머리]?.글 : w?.글;
  const 둘 = 오픈씀 ? w?.글 : w?.글2;
  const 판 = 주 != null ? 판정(l, 주) : null;
  const 판2 = 둘 != null ? 판정(l, 둘) : null;
  const 의심 = [...(w?.의심 || [])];
  if (판 && 판2) {
   if (판.판정 === '틀림' && 판2.판정 === '틀림') 의심.unshift('두 귀 모두 이름이 다르게 들림');
   else if (판.판정 !== 판2.판정) 의심.unshift('귀마다 갈림(경계)');
  }
  return { 번호: l.번호, 판: l.판, 파일머리: l.파일머리, 견줄: l.견줄 ?? null, 꼬리표: l.꼬리표, 역: `${l.역}(${목소리[l.역].이름})`, 나라: l.나라, 이름: l.이름, 말: l.말, 들린글: 주 ?? null, 판정: 판?.판정 ?? null, 근거: 판?.근거 ?? null, 나머지: 주 != null ? 나머지맞음(l, 주) : null,
   다른귀: 둘 ?? null, 다른귀판정: 판2?.판정 ?? null, 다른귀근거: 판2?.근거 ?? null, 길이: r.맞춘초 ?? r.원본초 ?? null, 말초: w?.말초 ?? null, 크기: r.맞춘크기 ?? null, 크레딧: r.크레딧 ?? null, 견적: r.견적 ?? null, 작업: r.작업 ?? null,
   의심, 재기: w ? { 말초: w.말초, 음절초: w.음절초, 이름음절초: w.이름음절초, 쉼: w.쉼, 이름끝: w.이름끝, 음높이: w.음높이 } : null, 파일: r.맞춘 ? `.tmp/me2-20261102/T-B/${r.맞춘}` : null, 원본: r.파일 ? `.tmp/me2-20261102/T-B/${r.파일}` : null };
 });
 // 첫 판 요약 · 표는 기본 20줄만, 2판(이름만)은 아래 견줌 표로
 return 표쓰기(행.filter((x) => x.판 === '기본'), 견줌행(행), { 주귀이름, 오픈, 재기 });
}

/** 2판 줄마다 같은 이름의 첫 판 선배 줄과 짝 — [{이름, 아야, 이름만}] (각 칸은 표 행 + 음높이 폭 · 이름 빠르기 · 쉼표 쉼) */
function 견줌행(행) {
 const 칸 = (x) => x && { ...x, 폭반음: x.재기?.음높이?.전체?.폭p10p90반음 ?? null, 폭끝끝반음: x.재기?.음높이?.전체?.폭반음 ?? null, 낮은Hz: x.재기?.음높이?.전체?.p10Hz ?? null, 중앙Hz: x.재기?.음높이?.전체?.중앙Hz ?? null, 높은Hz: x.재기?.음높이?.전체?.p90Hz ?? null, 이름음절초: x.재기?.이름음절초 ?? null, 쉼표쉼: x.재기?.쉼?.[0] ? Number((x.재기.쉼[0][1] - x.재기.쉼[0][0]).toFixed(2)) : null };
 return 행.filter((x) => x.판 === '이름만').map((x) => ({ 이름: x.이름, 아야: 칸(행.find((y) => y.파일머리 === x.견줄)), 이름만: 칸(x) }));
}
const 판글 = (x) => (x ? `${x.판정 ?? '—'}${x.판정 === '맞음' && /소리|연음|나는 대로/.test(x.근거) ? `(${x.근거.replace(/\(.*$/, '').trim()})` : ''}` : '—');
function 견줌md(견줌, 주귀이름) {
 if (!견줌.length) return '';
 const 줄들 = ['', '## 2판 — 「아/야」 판 ↔ 이름만 판(선배 Julian)', '', `| 이름 | 판 | 꼬리표 · 대사 | 들린 글(${주귀이름}) | 맞음 | 다른 귀(medium) | 음높이 폭(10~90%) · Hz 낮음/중앙/높음 | 이름 빠르기 | 쉼표 쉼 | 말 길이 | 크레딧 | 파일 |`, '|---|---|---|---|---|---|---|---|---|---|---|---|'];
 for (const g of 견줌) for (const [판, x] of [['아/야', g.아야], ['이름만', g.이름만]]) {
  if (!x) continue;
  줄들.push(`| ${g.이름} | ${판} | ${x.꼬리표} ${x.말} | ${x.들린글 ?? '—'} | ${판글(x)} | ${x.다른귀 ?? '—'}${x.다른귀판정 ? ` (${x.다른귀판정})` : ''} | ${x.폭반음 ?? '—'}반음 · ${x.낮은Hz}/${x.중앙Hz}/${x.높은Hz}Hz | ${x.이름음절초 ?? '—'}음절/초 | ${x.쉼표쉼 ?? '—'}초 | ${x.말초 ?? '—'}초 | ${x.크레딧 ?? `견적 ${x.견적}`} | \`${x.파일 ?? '—'}\` |`);
 }
 const 맞음 = (k) => 견줌.filter((g) => g[k]?.판정 === '맞음').length;
 const 하나라도 = (k) => 견줌.filter((g) => g[k]?.판정 === '맞음' || g[k]?.다른귀판정 === '맞음').length;
 const 쓴 = 견줌.reduce((n, g) => n + (g.이름만?.크레딧 ?? 0), 0);
 줄들.push('', `- 맞게 들림(주 귀): 아/야 판 ${맞음('아야')}/${견줌.length} → 이름만 판 ${맞음('이름만')}/${견줌.length} · 두 귀 중 하나라도: ${하나라도('아야')}/${견줌.length} → ${하나라도('이름만')}/${견줌.length}`, `- 2판 크레딧: ${쓴.toFixed(2)}`, '- 꼬리표(friendly → cheerful)와 「아/야」를 함께 바꾼 판이라 둘 중 무엇이 차이를 냈는지는 가르지 못한다.', '');
 return 줄들.join('\n');
}
function 견줌html(견줌, 싸기) {
 if (!견줌.length) return '';
 const 줄 = (판, x) => `<tr class="${x.판정 === '틀림' ? '틀림' : ''}"><td>${싸기(판)}</td><td><b>${싸기(`${x.꼬리표} ${x.말}`)}</b><br><audio controls preload="none" src="${싸기(x.파일.replace('.tmp/me2-20261102/T-B/', ''))}"></audio></td><td>${싸기(x.들린글)}<br><small>다른 귀: ${싸기(x.다른귀)}</small></td><td>${싸기(x.판정)}</td><td>${x.폭반음}반음<br><small>${x.낮은Hz}/${x.중앙Hz}/${x.높은Hz}Hz</small></td><td>${x.말초}초</td></tr>`;
 return `<h2>2판 — 「아/야」 판 ↔ 이름만 판(선배)</h2>\n<p><small>꼬리표(friendly → cheerful)와 「아/야」를 함께 바꾼 판 — 둘 중 무엇이 차이를 냈는지는 가르지 못한다.</small></p>\n<table>${견줌.map((g) => `<tr><td colspan="6"><b>${싸기(g.이름)}</b></td></tr>${g.아야 ? 줄('아/야', g.아야) : ''}${g.이름만 ? 줄('이름만', g.이름만) : ''}`).join('\n')}</table>`;
}

function 표쓰기(행, 견줌, { 주귀이름, 오픈, 재기 }) {
 const 맞은줄 = 행.filter((x) => x.판정 === '맞음').length;
 const 이름별 = Object.values(Object.groupBy(행, (x) => x.이름)).map((g) => ({ 이름: g[0].이름, 둘다: g.every((x) => x.판정 === '맞음'), 귀하나라도: g.every((x) => x.판정 === '맞음' || x.다른귀판정 === '맞음') }));
 const 쓴 = 행.reduce((n, x) => n + (x.크레딧 ?? 0), 0);
 const 요약 = { 줄수: 행.length, 주귀: 주귀이름, 맞은줄, 다른귀맞은줄: 행.filter((x) => x.다른귀판정 === '맞음').length, 하나라도맞은줄: 행.filter((x) => x.판정 === '맞음' || x.다른귀판정 === '맞음').length,
  두귀모두틀린줄: 행.filter((x) => x.판정 === '틀림' && x.다른귀판정 === '틀림').map((x) => x.번호), 이름둘다맞음: 이름별.filter((x) => x.둘다).length, 이름귀하나라도: 이름별.filter((x) => x.귀하나라도).length,
  쓴크레딧: Number(쓴.toFixed(2)), 줄당: Number((쓴 / 행.length).toFixed(3)), 잔액전: 기록.잔액전, 잔액뒤: 기록.잔액뒤, 승인크기: 기록.승인크기, 기준: 재기.기준 ?? null,
  오픈막힘: 오픈.막힘 ?? null };
 fs.writeFileSync(path.join(작업, '표.json'), JSON.stringify({ 요약, 이름별, 행, 견줌 }, null, 1));
 const 줄들 = [`| # | 역 | 나라 · 이름 | 대사 | 들린 글(${주귀이름}) | 맞음 | 다른 귀(whisper medium) | 길이 | 크레딧 | 의심 | 파일 |`, '|---|---|---|---|---|---|---|---|---|---|---|'];
 for (const x of 행) 줄들.push(`| ${x.번호} | ${x.역} | ${x.나라} ${x.이름} | ${x.말} | ${x.들린글 ?? '—'} | ${x.판정 ?? '—'}${x.판정 === '맞음' && /소리|연음|나는 대로/.test(x.근거) ? `(${x.근거.replace(/\(.*$/, '').trim()})` : ''}${x.나머지 === false ? ' · 뒷말 다름' : ''} | ${x.다른귀 ?? '—'}${x.다른귀판정 ? ` (${x.다른귀판정})` : ''} | ${x.길이 ?? '—'}초 (말 ${x.말초 ?? '—'}) | ${x.크레딧 ?? `견적 ${x.견적}`} | ${x.의심.join('; ') || '—'} | \`${x.파일 ?? '—'}\` |`);
 const 머리 = `# T-B 이름 부르기 표\n\n- 주 귀(${주귀이름}) 맞게 들린 줄: ${맞은줄}/${행.length} · 다른 귀(medium) ${요약.다른귀맞은줄}/${행.length} · 두 귀 중 하나라도 ${요약.하나라도맞은줄}/${행.length} · 두 귀 모두 틀린 줄: ${요약.두귀모두틀린줄.join(', ') || '없음'}\n- 이름(두 줄 모두 맞음): 주 귀 ${요약.이름둘다맞음}/10 · 두 귀 중 하나라도 ${요약.이름귀하나라도}/10 — 통과 기준 8/10(설계 8절)\n- 크레딧(첫 판 20줄): ${요약.쓴크레딧} (줄당 ${요약.줄당}) · founder 잔액 ${기록.잔액전?.match(/[\d.]+ credits/)?.[0]} → ${기록.잔액뒤?.match(/[\d.]+ credits/)?.[0]}${견줌.length ? '(2판 포함)' : ''}\n- 크기: 승인 녹음 평균 선배 ${기록.승인크기?.선배?.평균} · 교수 ${기록.승인크기?.교수?.평균} LUFS에 맞춤${오픈.막힘 ? `\n- OpenAI gpt-transcribe: ${오픈.막힘}` : ''}\n\n`;
 const 견줌글 = 견줌md(견줌, 주귀이름);
 fs.writeFileSync(path.join(작업, '표.md'), 머리 + 줄들.join('\n') + '\n' + 견줌글);
 console.log(머리 + 줄들.join('\n') + '\n' + 견줌글);
 // 귀로 듣기 쪽(로컬 파일, 공개하지 않음) — 이름마다 선배 · 교수 두 줄과 1화 승인 녹음 견본을 나란히
 const 견본 = path.relative(작업, path.join(뿌리, 'experiences/drama/s1/소리')).replaceAll('\\', '/');
 const 싸기 = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
 const 칸 = 행.map((x) => `<tr class="${x.판정 === '틀림' ? '틀림' : ''}"><td>${x.번호}</td><td>${싸기(x.역)}<br><small>${싸기(x.나라)}</small></td><td><b>${싸기(x.말)}</b><br><audio controls preload="none" src="${싸기(x.파일.replace('.tmp/me2-20261102/T-B/', ''))}"></audio></td><td>${싸기(x.들린글)}<br><small>다른 귀: ${싸기(x.다른귀)}</small></td><td>${싸기(x.판정)}</td><td>${x.말초}초</td><td><small>${싸기(x.의심.join(' · ') || '—')}</small></td></tr>`).join('\n');
 fs.writeFileSync(path.join(작업, '듣기.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>T-B 이름 부르기</title>
<style>body{font-family:system-ui,sans-serif;margin:16px;background:#fff;color:#111}table{border-collapse:collapse;width:100%}td{border-top:1px solid #ddd;padding:8px 6px;vertical-align:top}tr.틀림 td{background:#fff3f0}audio{width:260px;margin-top:4px}small{color:#666}</style></head><body>
<h1>T-B 이름 부르기 — 20줄${견줌.length ? ` + 2판 ${견줌.length}줄` : ''}</h1>
<p>1화 승인 녹음 견본(같은 크기): 선배 <audio controls preload="none" src="${견본}/ep01-senior-01.mp3"></audio> 교수 <audio controls preload="none" src="${견본}/ep01-professor-02.mp3"></audio></p>
<p>${싸기(머리.split('\n').filter((l) => l.startsWith('- ')).join(' / '))}</p>
<table>${칸}</table>
${견줌html(견줌, 싸기)}</body></html>\n`);
}

if (명령 === '줄') for (const l of 줄) console.log(`${l.번호} ${l.파일머리} ${l.꼬리표} ${l.말}`);
else if (명령 === '견적') 견적();
else if (명령 === '굽기') await 굽기();
else if (명령 === '맞추기') 맞추기();
else if (명령 === '받아쓰기') await 받아쓰기();
else if (명령 === '표') 표();
else 멈춤('쓰는 법: node 굽기.mjs 줄|견적|굽기|맞추기|받아쓰기|표 [작업 폴더] [--하나] [--상한 40]');
