#!/usr/bin/env node
/**
 * 드라마 말하기 리허설 왕복용 테이크 목록(2026-10-31) — talk `tools/말하기피드백_왕복.js --드라마 <목록>`에 넣는다.
 *   node experiences/drama/qa/리허설-20261031/테이크목록.mjs [--굽기]
 * · 통과해야 하는 테이크: 1화 학생 줄의 모범 읽기(일레븐 v4 Hana, experiences/drama/s1/소리/ep01-model-NN.mp3 — 결정 표 10-30).
 * · 일부러 틀린 테이크: 기존 목소리 판(OpenAI Realtime 2.1, 결제 수단 없는 월 크레딧 키 — tools/lib/오픈AI키.mjs)으로 글자 그대로 읽힌다.
 *   끝맺음 「요」 빠짐 · 반말 덩어리 · 한 낱말로 끝냄 · 핵심 말 빠짐 · 한국어 아님, 그리고 확신이 없어 노트가 없어야 하는 것 둘(「-야」로 끝낸 말,
 *   비슷한 소리의 핵심 말). 기대는 판정 모듈(tools/lib/드라마판정.mjs)이 그 글을 그대로 받았을 때의 결과다 — 굽기 전에 이 스크립트가 다시 확인한다.
 * · `--굽기`가 없으면 이미 구운 소리로 목록만 쓴다. 소리 · 목록은 git 밖(.tmp/drama-rehearsal-20261031/)에 둔다(합성 소리 — 학생 녹음이 아니다).
 * · 힉스필드는 쓰지 않는다. 키 값은 찍지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 키차례 } from '../../../../tools/lib/오픈AI키.mjs';
import { judgeLine } from '../../../../tools/lib/드라마판정.mjs';
import ep01 from '../../s1/ep01.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '../../../..');
const 밖 = path.join(뿌리, '.tmp/drama-rehearsal-20261031');
const 굽기 = process.argv.includes('--굽기');
const 멈춤 = (말) => { console.error(`[테이크목록] ${말}`); process.exit(1); };

// 대본의 학생 줄 · 처음 보는 대사 — 판정 명세는 대본 그대로(talk 은행과 같은 꼴: {id, line, ...명세}).
const 줄들 = new Map();
for (const day of ep01.촬영일) for (const row of day.줄 || []) if (row.누가 === '학생') 줄들.set(row.id, row);
for (const row of ep01.처음보는대사) 줄들.set(row.id, row);
const 명세 = (id) => { const row = 줄들.get(id); if (!row) 멈춤(`대본에 없는 대사 ${id}`); return { id, line: row.말, ...row.명세 }; };

// 일부러 틀린 테이크 — 이름 · 대사 · 읽힐 글 · 기대.
const 틀린 = [
  { name: '요 빠짐', line: 's1e01-2', say: '아직 낯설지만 조금씩 익숙해지고 있어.', expect: { verdict: 'note', note: 'ending' } },
  { name: '요 빠짐', line: 's1e01-6', say: '응, 맞아. 길을 잃어서 한참 헤맸어.', expect: { verdict: 'note', note: 'ending' } },
  { name: '요 빠짐', line: 's1e01-4', say: '제출 기한이 언제까지인지 궁금해서.', expect: { verdict: 'note', note: 'ending' } },
  { name: '반말 덩어리', line: 's1e01-5', say: '응, 알았어. 고마워.', expect: { verdict: 'note', note: 'ending' } },
  { name: '한 낱말', line: 's1e01-1', say: '안녕하세요.', expect: { verdict: 'note', note: 'length' } },
  { name: '한 낱말', line: 's1e01-3', say: '과제요.', expect: { verdict: 'note', note: 'length' } },
  { name: '핵심 말 빠짐', line: 's1e01-7', say: '네, 선배님! 그런데 혹시 화장실이 어디에 있는지 아세요?', expect: { verdict: 'note', note: 'missing' } },
  { name: '처음 보는 대사 — 맞게', line: 's1e01-t1', say: '수강 신청에 대해 여쭤볼 게 있어서 왔어요.', expect: { verdict: 'pass', sure: true } },
  { name: '확신 없음 — 「-야」로 끝냄', line: 's1e01-t5', say: '이번 학기에 새로 온 유학생이야. 잘 부탁해.', expect: { verdict: 'pass', sure: false } },
  { name: '확신 없음 — 비슷한 핵심 말', line: 's1e01-t4', say: '선생님, 혹시 화장실이 어디에 있는지 아세요?', expect: { verdict: 'pass', sure: false } },
  { name: '한국어 아님', line: 's1e01-1', say: 'Hello professor, I am a new international student this semester.', expect: { status: 'not_korean' } },
];
// 굽기 전에 글 그대로의 판정이 기대와 같은지 본다(글이 기대를 못 내면 소리로도 못 낸다).
for (const t of 틀린) {
  if (t.expect.status) continue;
  const r = judgeLine(명세(t.line), { transcript: t.say, seconds: 8 });
  const 같음 = r.verdict === t.expect.verdict && (r.note?.kind ?? null) === (t.expect.note ?? null) && (t.expect.sure === undefined || r.sure === t.expect.sure);
  if (!같음) 멈춤(`${t.line} ${t.name}: 글 그대로의 판정이 기대와 다르다 — ${JSON.stringify({ verdict: r.verdict, note: r.note?.kind, sure: r.sure })}`);
}

// ── OpenAI Realtime 2.1(목소리 후보 굽기.mjs와 같은 길) ──
const 표본율 = 24000;
function 키읽기({ 이름, 파일 }) {
  if (!fs.existsSync(파일)) 멈춤(`키 파일이 없다(${이름})`);
  const 값 = fs.readFileSync(파일, 'utf8').replace(/^﻿/, '').trim();
  if (!/^sk-\S+$/.test(값)) 멈춤(`키 파일에 sk- 로 시작하는 값이 없다(${이름})`);
  return 값;
}
function 읽히기(키, 목소리, 지시, 글들) {
  return new Promise((풀림, 거절) => {
    const ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1', { headers: { Authorization: `Bearer ${키}` } });
    const 소리들 = [], 사용 = [];
    let 지금 = [], 차례 = -1;
    const 다음 = () => {
      차례 += 1;
      if (차례 >= 글들.length) { ws.close(); 풀림({ 소리들, 사용 }); return; }
      지금 = [];
      ws.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: `대사(글자 그대로, 한 번만): ${글들[차례]}` }] } }));
      ws.send(JSON.stringify({ type: 'response.create' }));
    };
    const 시한 = setTimeout(() => { ws.close(); 거절(new Error('3분 안에 끝나지 않았다')); }, 3 * 60 * 1000);
    ws.onmessage = (m) => {
      const e = JSON.parse(m.data);
      if (e.type === 'session.created') ws.send(JSON.stringify({ type: 'session.update', session: { type: 'realtime', instructions: 지시, output_modalities: ['audio'], audio: { output: { format: { type: 'audio/pcm', rate: 표본율 }, voice: 목소리 } } } }));
      else if (e.type === 'session.updated') { if (차례 < 0) 다음(); }
      else if (e.type === 'response.output_audio.delta') 지금.push(Buffer.from(e.delta, 'base64'));
      else if (e.type === 'response.done') { 사용.push(e.response?.usage || null); 소리들.push(Buffer.concat(지금)); 다음(); }
      else if (e.type === 'error') { clearTimeout(시한); ws.close(); 거절(new Error(`${e.error?.code} ${e.error?.message}`)); }
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

fs.mkdirSync(밖, { recursive: true });
const 소리파일 = (i) => path.join(밖, `wrong-${String(i + 1).padStart(2, '0')}.wav`);
if (굽기) {
  const 지시 = '너는 한국 드라마 촬영장의 외국인 유학생 배우다. 매번 받은 「대사」를 글자 그대로 한 번만 또박또박 말하고 멈춘다. 대사를 고치거나 높임을 바꾸거나 말을 붙이지 않는다. 영어 대사는 영어로 말한다.';
  let 답 = null, 쓴키 = null;
  for (const k of 키차례()) {
    try { 답 = await 읽히기(키읽기(k), 'marin', 지시, 틀린.map((t) => t.say)); 쓴키 = k.이름; break; }
    catch (e) { console.error(`[테이크목록] ${k.이름}: ${e.message}`); if (!/credit|quota|auth|key|permission|401|403/i.test(e.message)) break; }
  }
  if (!답) 멈춤('틀린 테이크를 굽지 못했다');
  답.소리들.forEach((pcm, i) => fs.writeFileSync(소리파일(i), wav(pcm)));
  fs.writeFileSync(path.join(밖, 'wrong-usage.json'), `${JSON.stringify({ at: new Date().toISOString(), model: 'gpt-realtime-2.1', voice: 'marin', key: 쓴키, usage: 답.사용 }, null, 2)}\n`);
  console.log(`[테이크목록] 틀린 테이크 ${답.소리들.length}개를 구웠다(키 ${쓴키})`);
}
const 초 = (file) => { const b = fs.readFileSync(file); return Number((((b.length - 44) / 2) / 표본율).toFixed(2)); };
// 모범 읽기 mp3의 길이는 받아 적기 JSON(ep01-model.json)의 줄 초를 쓴다 — 없으면 대사 음절로 어림.
const 모범표 = JSON.parse(fs.readFileSync(path.join(뿌리, 'experiences/drama/s1/소리/ep01-model.json'), 'utf8'));
const 학생줄 = [...줄들.values()].filter((row) => !row.id.includes('-t'));
const 모범 = 학생줄.map((row, i) => {
  const file = path.join(뿌리, `experiences/drama/s1/소리/ep01-model-${String(i + 1).padStart(2, '0')}.mp3`);
  if (!fs.existsSync(file)) 멈춤(`모범 읽기 소리가 없다: ${file}`);
  const 줄 = (모범표.줄 || 모범표.lines || [])[i];
  const 길이 = Number(줄?.초 ?? 줄?.seconds ?? 줄?.길이);
  return { name: '모범 읽기(Hana)', line: row.id, file, mime: 'audio/mpeg', seconds: Number.isFinite(길이) && 길이 > 0 ? 길이 : 6, expect: { verdict: 'pass' } };
});
const 틀림 = 틀린.map((t, i) => {
  if (!fs.existsSync(소리파일(i))) 멈춤(`구운 소리가 없다 — --굽기로 먼저 굽는다: ${소리파일(i)}`);
  return { name: t.name, line: t.line, file: 소리파일(i), mime: 'audio/wav', seconds: Math.max(1, 초(소리파일(i))), expect: t.expect, said: t.say };
});
const 목록 = path.join(밖, 'takes.json');
fs.writeFileSync(목록, `${JSON.stringify({ at: new Date().toISOString(), takes: [...모범, ...틀림] }, null, 2)}\n`);
console.log(`[테이크목록] ${모범.length + 틀림.length}개 → ${목록}`);
