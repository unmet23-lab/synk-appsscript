#!/usr/bin/env node
/**
 * 드라마 테이크 로컬 왕복(2026-10-31) — SYNK-talk world-speaking의 실제 코드(lib/world-speaking-runtime.js · voice-link.js · 드라마 두 사본)에
 * 진짜 OpenAI 받아 적기(gpt-transcribe)를 붙여 테이크 목록을 차례로 보내고, 판정 · 노트 종류가 기대와 같은지 본다.
 *   node experiences/drama/qa/리허설-20261031/로컬왕복.mjs --talk <SYNK-talk 작업본> [--목록 <takes.json>] [--결과 <파일>]
 * · 리허설 함수의 드라마 스위치를 켜기 전에도 「받아 적기 → 판정 → 노트 종류」를 같은 코드로 재려고 둔다. 원장(횟수 · 금액)과 로그인만
 *   가짜이고(기록만 남긴다), 받아 적기 · 판정 · 다음 걸음은 함수 그대로다. 리허설 함수 왕복은 talk tools/말하기피드백_왕복.js --드라마.
 * · 키는 tools/lib/오픈AI키.mjs 차례(결제 수단 없는 월 크레딧 조직)를 쓴다 — 한 테이크 받아 적기 약 0.01센트. 값은 찍지 않는다.
 * · 소리는 합성 음성만(모범 읽기 · Realtime 2.1로 구운 틀린 테이크). 결과 파일에는 합성 소리의 받아 적은 말을 남긴다(학생 녹음이 아니다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 키차례 } from '../../../../tools/lib/오픈AI키.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '../../../..');
const args = process.argv.slice(2);
const 값 = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fallback; };
const talk = 값('--talk');
if (!talk || !fs.existsSync(path.join(talk, 'lib/world-speaking-runtime.js'))) { console.error('[로컬왕복] --talk <SYNK-talk 작업본>을 준다'); process.exit(2); }
const 목록 = JSON.parse(fs.readFileSync(값('--목록', path.join(뿌리, '.tmp/drama-rehearsal-20261031/takes.json')), 'utf8'));
const 결과파일 = 값('--결과', path.join(뿌리, '.tmp/drama-rehearsal-20261031/local-results.json'));
const need = createRequire(path.join(talk, 'package.json'));
const runtime = need('./lib/world-speaking-runtime.js'), voiceLink = need('./lib/voice-link.js'), prices = need('./lib/ai-spend.js');
const LINES = need('./lib/world-drama-lines.js');
const spendConfig = prices.parseSpendConfig((name) => (name === 'SYNK_AI_PRICES' ? fs.readFileSync(path.join(talk, 'config/ai-prices-20261003.json'), 'utf8') : undefined));
const 키들 = 키차례().map((k) => fs.readFileSync(k.파일, 'utf8').replace(/^﻿/, '').trim()).filter((v) => /^sk-\S+$/.test(v));
if (!키들.length) { console.error('[로컬왕복] OpenAI 키가 없다'); process.exit(2); }

const 기록 = { usage: [], spend: [], logs: [] };
let serial = 0;
const service = runtime.createSpeakingService({
  verify: async () => ({ id: '11111111-1111-4111-8111-111111111111' }), eligibility: async () => ({ accountId: 'local-rehearsal' }),
  usage: { reserve: async (input) => { 기록.usage.push(['reserve', input.operation]); return { status: 'reserved', reservation_id: `u-${++serial}`, remaining: 29 }; },
    finish: async (...a) => { 기록.usage.push(['finish', ...a]); return {}; }, busySame: async () => false, used: async () => 0 },
  spend: { available: async () => ({ status: 'available', daily_remaining_micro_usd: 50000, monthly_remaining_micro_usd: 300000 }),
    reserve: async (input) => { 기록.spend.push(['reserve', input.operation, input.reserveMicroUsd]); return { status: 'reserved', reservationId: `s-${serial}` }; },
    dispatch: async () => ({ status: 'dispatched' }), settle: async (id, v) => { 기록.spend.push(['settle', id, v.actualMicroUsd]); return {}; },
    hold: async (id) => { 기록.spend.push(['hold', id]); return {}; }, cancel: async () => ({ status: 'cancelled' }) },
  prices, spendConfig,
  settings: runtime.readSettings((name) => ({ SYNK_WORLD_DRAMA_ENABLED: 'true', WORLD_SPEAKING_DRAFT_ITEMS: 'true' })[name]),
  voice: voiceLink.createVoiceLink({ keys: 키들, logger: (e) => 기록.logs.push(e), event: 'drama_local' }),
  claude: { available: () => false, count: async () => null, send: async () => ({ ok: false, status: 0, notSent: true }) },
  logger: (e) => 기록.logs.push(e),
});
const 보내기 = async (body) => {
  const r = await service(new Request('https://local.test/functions/v1/world-speaking/feedback', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-synk-contract': '1', 'x-synk-product': 'world', authorization: 'Bearer local' }, body: JSON.stringify(body) }));
  return { http: r.status, j: await r.json() };
};
const 같다 = (take, e) => (e.status ? take?.status === e.status : take?.status === 'ok' && take?.verdict === e.verdict && (take?.note?.kind ?? null) === (e.note ?? null) && (e.sure === undefined || take?.sure === e.sure));
const 결과 = [];
let 맞음수 = 0, 쓴돈 = 0;
for (const [i, t] of 목록.takes.entries()) {
  const body = { action: 'take', request_id: crypto.randomUUID(), consent: 'send-once', line_id: t.line, lines_version: LINES.LINES_HASH, lang: 'mn',
    audio: { mime: t.mime, data: fs.readFileSync(t.file).toString('base64') }, seconds: t.seconds, speech_seconds: t.speechSeconds ?? t.seconds, take: { judged: 0, unheard: 0 } };
  const started = Date.now();
  const res = await 보내기(body);
  const take = res.j?.take || null, 맞음 = res.j?.status === 'ok' && 같다(take, t.expect);
  const 돈 = 기록.spend.filter((x) => x[0] === 'settle').at(-1)?.[2] ?? null;
  if (Number.isFinite(돈)) 쓴돈 += 돈;
  if (맞음) 맞음수++;
  const 실제 = res.j?.status === 'ok' ? `${take.status === 'ok' ? take.verdict : take.status}${take.note ? `:${take.note.kind}` : ''}${take.sure ? '·확신' : ''}` : `${res.j?.status || res.j?.code}`;
  const 기대 = t.expect.status || `${t.expect.verdict}${t.expect.note ? `:${t.expect.note}` : ''}${t.expect.sure ? '·확신' : ''}`;
  console.log(`${맞음 ? '✅' : '❌'} ${String(i + 1).padStart(2)} ${t.line.padEnd(10)} ${t.name.padEnd(20)} ${실제}${맞음 ? '' : `  (기대 ${기대})`} · 다음 ${take?.next?.action ?? '-'} · ${Date.now() - started}ms`);
  결과.push({ i: i + 1, name: t.name, line: t.line, said: t.said ?? null, expect: t.expect, http: res.http, status: res.j?.status ?? res.j?.code ?? null,
    take, ms: Date.now() - started, microUsd: 돈, 맞음 });
}
fs.writeFileSync(결과파일, `${JSON.stringify({ at: new Date().toISOString(), linesVersion: LINES.LINES_HASH, 맞음: 맞음수, 전체: 결과.length, microUsd: 쓴돈, takes: 결과 }, null, 2)}\n`);
console.log(`· ${결과.length}개 중 ${맞음수} 기대와 같음 · 받아 적기 정산 합 ${쓴돈}µ$($${(쓴돈 / 1e6).toFixed(4)}) · 결과 → ${결과파일}`);
const 기록줄 = JSON.stringify(기록.logs);
const 새어나감 = 결과.filter((r) => r.take?.heard && r.take.heard.length > 3 && 기록줄.includes(r.take.heard));
console.log(`· 함수 기록에 받아 적은 말이 남은 테이크: ${새어나감.length}개`);
if (맞음수 !== 결과.length || 새어나감.length) process.exitCode = 1;
