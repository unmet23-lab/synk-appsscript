#!/usr/bin/env node
/**
 * 주문 폭주 WORLD 캠퍼스 판 — 손님 여섯의 주문 음성 굽기(2026-11-04). 손님 × 주문 26 = 156개. 글자는 주문 그대로(qa/voice-bank.json).
 * 주문마다 한 번씩 따로 굽는다: 주문은 서로 이어지는 말이 아니라 저마다 처음부터 말하는 한 번이고, 줄마다 값 · 다시 굽기 · 받아쓰기가 깨끗하다.
 * 받은 파일은 공용 작업본 .tmp/order-rush-voices-20261104/받음/<손님>/<주문>.mp3 — 이미 받은 줄은 다시 사지 않는다.
 *
 *   node 손님목소리.mjs 줄                      손님 · 줄 수 · 글자 수(돈 안 듦)
 *   node 손님목소리.mjs 공식 [손님…]            일레븐랩스 공식 eleven_v4로 굽는다(CAST에서 engine 'official'인 손님, 키는 ~/SYNK_보안/elevenlabs.txt)
 *   node 손님목소리.mjs 일레븐계획              힉스필드 일레븐 v4 작업 파일을 쓴다(CAST에서 engine 'v4'인 손님) → bash 손님목소리내기.sh
 *   python -I -X utf8 손님목소리맞추기.py [손님…]  앞뒤 무음 · 크기(−22.5 LUFS) · mp3 · 받아쓰기 · 기록(qa/world-voices.json)
 *   python -I -X utf8 목소리포락선.py            목소리 막대 포락선
 *
 * 다시 굽기: 받음/ 아래 그 줄 파일을 지우고 다시 돌린다(작업 번호 .job도 함께).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 게임 = path.resolve(여기, '..', '..');
const 뿌리 = path.resolve(게임, '..', '..');
const { 공용작업본 } = createRequire(import.meta.url)(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const 작업 = path.join(공용작업본(뿌리), '.tmp', 'order-rush-voices-20261104');
const 받음 = path.join(작업, '받음');
const 줄들 = JSON.parse(fs.readFileSync(path.join(게임, 'qa', 'voice-bank.json'), 'utf8'));

// 손님마다 목소리 하나(qa/world-voice-cast.json — 이 실행 폴더의 json은 git 밖이라 밖에 둔다). engine: official = 일레븐랩스 공식, v4 = 힉스필드 일레븐 v4 프리셋.
// 11-04 유호님이 가린 견본에서 니트 카디건 · 과잠 · 조교를 모두 v4로 고르셨고, 「10%만 빠르게 · 발음 아주 약간 더」로 꼬리표를 [slowly, …] → [carefully, …], 안정도 0.5 → 0.75로 바꿨다.
export const CAST = JSON.parse(fs.readFileSync(path.join(게임, 'qa', 'world-voice-cast.json'), 'utf8'));

const 명령 = process.argv[2];
if (명령 === '줄') {
  const 글자 = 줄들.reduce((n, l) => n + [...l.text].length, 0);
  console.log(`주문 ${줄들.length} · 글자 ${글자}`);
  for (const [g, c] of Object.entries(CAST)) console.log(g, c.name, c.engine, c.voice, c.tag ?? `speed ${c.speed}`);
} else if (명령 === '일레븐계획') {
  // 셸에서 부를 작업 파일: node에서 힉스필드 CLI를 부르면 「No workspace selected」로 멈추는 일이 있다(현장노트 higgsfield)
  const 계획 = path.join(작업, '일레븐계획');
  fs.mkdirSync(계획, { recursive: true });
  let n = 0;
  for (const [g, c] of Object.entries(CAST)) {
    if (c.engine !== 'v4') continue;
    fs.mkdirSync(path.join(받음, g), { recursive: true });
    for (const l of 줄들) {
      if (fs.existsSync(path.join(받음, g, `${l.id}.mp3`))) continue;
      fs.writeFileSync(path.join(계획, `${g}-${l.id}.json`), JSON.stringify([{ text: `${c.tag} ${l.text}`, voice_id: c.id, voice_type: 'preset' }]));
      n += 1;
    }
  }
  console.log(`낼 줄 ${n} → ${계획}`);
} else if (명령 === '공식') {
  // 일레븐랩스 공식 API(eleven_v4). 키는 ~/SYNK_보안/elevenlabs.txt에서 메모리로만. 받은 줄은 다시 사지 않는다. 쓴 크레딧은 응답의 character-cost를 더한다.
  const 키 = fs.readFileSync(path.join(os.homedir(), 'SYNK_보안', 'elevenlabs.txt'), 'utf8').trim();
  const 고른 = process.argv.slice(3);
  let 받은 = 0, 값 = 0;
  for (const [g, c] of Object.entries(CAST)) {
    if (c.engine !== 'official' || (고른.length && !고른.includes(g))) continue;
    fs.mkdirSync(path.join(받음, g), { recursive: true });
    for (const l of 줄들) {
      const 끝 = path.join(받음, g, `${l.id}.mp3`);
      if (fs.existsSync(끝)) continue;
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${c.id}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': 키, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `${c.tag} ${l.text}`, model_id: 'eleven_v4', language_code: 'ko', voice_settings: { stability: c.stability ?? 0.75 } }) });
      const b = Buffer.from(await r.arrayBuffer());
      if (!r.ok) throw Error(`${g}/${l.id} 실패 ${r.status}: ${b.toString('utf8').slice(0, 200)}`);
      fs.writeFileSync(끝, b);
      받은 += 1; 값 += Number(r.headers.get('character-cost') || 0);
      console.log('받음', g, l.id, b.length);
    }
  }
  console.log(`새로 받은 줄 ${받은} · 쓴 크레딧 ${값}`);
} else if (명령 === '둘째귀') {
  // 첫 받아쓰기(로컬 Whisper)와 글자가 다른 줄만 공식 Scribe v2로 한 번 더 듣는다(qa/world-voices.json에 heard2 · match2). 둘 다 다르면 그 줄을 다시 굽는다.
  const 키 = fs.readFileSync(path.join(os.homedir(), 'SYNK_보안', 'elevenlabs.txt'), 'utf8').trim();
  const 기록파일 = path.join(게임, 'qa', 'world-voices.json');
  const 기록 = JSON.parse(fs.readFileSync(기록파일, 'utf8'));
  const norm = (s) => s.replace(/[^가-힣0-9]/g, '').replace(/[1-4]/g, (d) => ({ 1: '한', 2: '두', 3: '세', 4: '네' })[d]).replace(/라떼/g, '라테');
  const 같음 = (a, b) => { a = norm(a); b = norm(b); if (a === b) return 1; const n = Math.max(a.length, b.length); let hit = 0; const used = new Set(); for (let i = 0; i < a.length; i += 1) for (let j = 0; j < b.length; j += 1) if (!used.has(j) && a[i] === b[j] && Math.abs(i - j) <= 2) { used.add(j); hit += 1; break; } return Math.round((hit / n) * 1000) / 1000; };
  let 다시 = [];
  for (const [key, c] of Object.entries(기록.clips)) {
    if (norm(c.text) === norm(c.heard) || c.heard2) continue;
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(path.join(게임, 'assets', 'world', 'voice', `${key}.mp3`))], { type: 'audio/mpeg' }), `${key.replace('/', '-')}.mp3`);
    form.append('model_id', 'scribe_v2'); form.append('language_code', 'kor');
    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': 키 }, body: form });
    if (!r.ok) throw Error(`${key} 둘째 귀 실패 ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    c.heard2 = j.text; c.match2 = 같음(c.text, j.text);
    console.log(key, '첫 귀', c.heard, '| 둘째 귀', c.heard2, '|', c.match2);
  }
  for (const [key, c] of Object.entries(기록.clips)) if (norm(c.text) !== norm(c.heard) && c.heard2 && norm(c.text) !== norm(c.heard2)) 다시.push(key);
  fs.writeFileSync(기록파일, `${JSON.stringify(기록, null, 1)}\n`);
  console.log('두 귀 모두 다른 줄:', 다시.length ? 다시.join(' ') : '없음');
} else {
  console.error('명령: 줄 | 공식 [손님…] | 일레븐계획 | 둘째귀');
  process.exit(2);
}
