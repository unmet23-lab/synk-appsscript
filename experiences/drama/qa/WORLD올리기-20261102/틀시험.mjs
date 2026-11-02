#!/usr/bin/env node
// 드라마를 WORLD 게임 틀 안에서 여는 길의 브라우저 리허설(2026-11-02). 운영 계정 · talk · DB를 건드리지 않는다.
//   node experiences/drama/qa/WORLD올리기-20261102/틀시험.mjs [--port 8797] [--후보 <공개 후보 폴더 …/world>]
// · / = 부모 창(WORLD 대역): 합성 계정의 학습 호스트(SYNKLearningHost — 드라마 묶음의 createRehearsalHost, 서버 대신 이 창 메모리)와
//   드라마 통로(SYNKDramaHost)를 세운 뒤 /drama/를 같은 출처 게임 틀로 연다(app-shell launchGame과 같은 allow).
// · 드라마 통로의 take는 /fake/take로 간다: talk와 같은 판정기(tools/lib/드라마판정.mjs judgeLine · nextTake)와 같은 대사 은행(dramaLines)으로
//   판정하고, 받아 적은 글만 아래 TRANSCRIPTS 차례로 정해 둔다(받아쓰기 흉내 — 소리는 보지 않는다). 응답 꼴은 talk world-speaking take 그대로.
// · /drama/는 공개 빌드처럼 index.html에 data-drama="world"를 단다. ?limit=1이면 status가 오늘 횟수 0, ?off=1이면 드라마 스위치 꺼짐, ?down=1이면 take가 unavailable(받아 적기 실패), ?c=1이면 7.5일 전 t9 판정을 미리 남겨 C 카드를 본다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { judgeLine, nextTake } from '../../../../tools/lib/드라마판정.mjs';
import { dramaLines, readEpisodes, linesHash } from '../../../../tools/build-world-speaking-talk.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const PILOT = path.join(ROOT, 'experiences/drama/pilot');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const port = Number(opt('--port') || 8797);
const CANDIDATE = opt('--후보') ? path.resolve(opt('--후보')) : null; // 공개 후보 폴더(…/world) — ?world=live에서 공개본 위에 얹는다
const lines = dramaLines(await readEpisodes());
const LINES_HASH = linesHash(lines);
const byId = new Map(lines.map((l) => [l.id, l]));
// 대사마다 받아 적힌 글의 차례(테이크마다 하나씩 꺼낸다 — 다 쓰면 마지막 것을 되풀이).
const TRANSCRIPTS = {
 's1e01-6': ['네, 맞아요. 길을 잃어서 한참 헤맸어', '네, 맞아요. 길을 잃어서 한참 헤맸어', '네, 맞아요. 길을 잃어서 한참 헤맸어요'],
 's1e01-7': ['네 선배님 그런데 혹시 도서관이 어디에 있는지 아세요'],
 's1e01-8': ['정말요? 선배님 덕분에 살았어요'],
 's1e01-t4': ['선생님, 혹시 복사실이 어디에 있는지 아세요?'],
 's1e01-t9': ['선배님, 혹시 편의점이 어디에 있는지 아세요?'], // 11-03 새 상황 t4 → t9
 's1e01-t6': ['길을 잃었어요. 새솔대 정문이 어디에 있는지 아세요?'], // 11-03 C(7~10일 뒤 문항, 설계 §17)
};
const used = new Map();
const log = [];
const TYPES = new Map([['.html', 'text/html; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json'],
 ['.mp3', 'audio/mpeg'], ['.mp4', 'video/mp4'], ['.webp', 'image/webp'], ['.woff2', 'font/woff2']]);

const PARENT = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>WORLD 대역 · 드라마 틀 시험</title><style>html,body{margin:0;height:100%;background:#111}iframe{border:0;width:100%;height:100%;display:block}</style>
<script src="/drama/atlas-learning.js"></script></head><body><script type="module">
const q = new URLSearchParams(location.search);
// 합성 계정의 학습 호스트 — 서버로 보낼 사건을 이 창 메모리(window.__posts)에 쌓는다.
window.__posts = [];
// 기기 저장은 이 창 localStorage(리허설 계정 앞이름으로만) — 열 때마다 비운다.
for (const k of Object.keys(localStorage)) if (k.startsWith('synk.drama.rehearsal.')) localStorage.removeItem(k);
const storage = localStorage;
// ?world=1: 부모 창 호스트를 WORLD 계정 묶음(master 판 world-account.bundle.mjs)의 createLocalWorldLearningHost로 세우고, WORLD 학습 화면처럼
// 부모 창이 먼저 자기 엔진으로 게임 하나(world-speaking)를 연다 — 서로 다른 Atlas 사본(부모 · 틀)이 같은 기록 잠금을 다투는지 본다.
// ?world=live: 공개본 WORLD(synk.im/world)에 공개 후보(--후보 <폴더>)를 얹은 판 — /live/ 아래로 낸다.
if (q.get('world') === '1' || q.get('world') === 'live') {
 const W = await import(q.get('world') === 'live' ? '/live/world-account.bundle.mjs' : '/x/synk-world-app/world-account.bundle.mjs');
 for (const k of Object.keys(localStorage)) if (k.includes('local:synthetic-world')) localStorage.removeItem(k);
 W.createLocalWorldLearningHost({ owner: 'synthetic-world', target: window, storage: localStorage });
 window.__parentGame = window.SYNKLearningHost.createGame({ gameId: 'world-speaking' }, W.worldLearning.engine.createGame, W.worldLearning.createLearningSync);
 await new Promise((r) => setTimeout(r, 300));
}
const learnHost = window.SYNKLearningHost || DramaLearning.createRehearsalHost({ accountKey: 'synthetic-world-1', revision: 1, connected: q.get('consent') !== 'off', storage,
 transport: { get: async ({ revision }) => ({ ok: true, events: [], cursor: 0, hasMore: false, revision }),
  post: async ({ revision, events }) => { window.__posts.push(...events); return { ok: true, revision, accepted: events.map((e) => e.id) }; } } });
const call = (body) => fetch('/fake/' + body.action + location.search, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => { const d = await r.json(); if (!r.ok) throw Object.assign(Error(d.code), { code: d.code, status: r.status }); return d; });
window.SYNKDramaHost = Object.freeze({ status: () => call({ action: 'status' }), take: (p) => call(p) });
// WORLD prepareGame처럼 호스트가 준비된 뒤에 틀을 연다.
await learnHost.ready();
// ?c=1(설계 §17): 7.5일 전 시계로 t9 새 상황 첫 판정(혼자 해 봄 · 맞음)을 미리 남겨 두면 틀의 첫 화면에 C(t6) 카드가 나와야 한다.
if (q.get('c') === '1') {
 // 계정 기록이 다 모인 뒤에 남겨야 첫 노출이 확정돼 판정된 첫 시도(혼자 해 봄)가 된다 — 실제로도 t9는 동기화가 끝난 화면에서 낸다.
 for (let i = 0; i < 50 && learnHost.status().complete !== true; i++) await new Promise((r) => setTimeout(r, 100));
 const past = () => new Date(Date.now() - 7.5 * 86400000).toISOString();
 const g = learnHost.createGame({ gameId: 'drama-s1', clock: past }, DramaLearning.engine.createGame, DramaLearning.engine.createLearningSync);
 await new Promise((r) => setTimeout(r, 400)); // 기록 잠금(Web Lock)을 받은 뒤에 남긴다 — 받기 전이면 reason storage(판정 없음)
 const pid = g.present({ id: 'drama-s1.transfer.s1e01-t9', itemKey: 's1e01-t9', familyKey: 's1e01-t9', skillId: 'ko.speaking.ask', modality: 'speaking', difficulty: 2, responseFormat: 'spoken', audioRequired: false });
 g.answer(pid, { correct: true, assessable: true, attemptNo: 1 });
 await g.flush(); g.dispose();
}
const f = document.createElement('iframe'); f.className = 'game-frame'; f.title = '드라마 말하기 · 1화'; f.allow = 'autoplay; fullscreen; microphone'; f.src = (q.get('world') === 'live' ? '/live/drama/' : '/drama/') + (q.get('nowebgl') === '1' ? '?nowebgl=1' : '');
document.body.append(f);
</script></body></html>`;

function reply(res, status, value) { const b = Buffer.from(JSON.stringify(value)); res.writeHead(status, { 'content-type': 'application/json', 'content-length': b.length, 'cache-control': 'no-store' }); res.end(b); }
const server = http.createServer(async (req, res) => {
 const url = new URL(req.url, `http://127.0.0.1:${port}`);
 try {
  if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end(PARENT); }
  if (url.pathname === '/log') return reply(res, 200, log);
  if (url.pathname.startsWith('/fake/')) {
   let raw = ''; for await (const c of req) raw += c;
   const body = JSON.parse(raw || '{}');
   if (body.action === 'status') return reply(res, 200, { ok: true, accountId: 'synthetic-world-1', dramaEnabled: url.searchParams.get('off') !== '1', dramaLimit: 30, dramaRemaining: url.searchParams.get('limit') === '1' ? 0 : 30, linesVersion: LINES_HASH });
   if (body.action !== 'take') return reply(res, 400, { code: 'INVALID_ACTION' });
   // talk readRequest와 같은 형식 검사(UUID · 동의 · 언어 · 소리 꼴 · 초 · 앞 테이크 수 0~20).
   if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.request_id || '')) return reply(res, 400, { code: 'INVALID_REQUEST_ID' });
   if (body.consent !== 'send-once') return reply(res, 400, { code: 'CONSENT_REQUIRED' });
   if (!['ko', 'en', 'mn'].includes(body.lang)) return reply(res, 400, { code: 'INVALID_LANGUAGE' });
   if (!['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/mpeg'].includes(body.audio?.mime) || typeof body.audio?.data !== 'string' || !body.audio.data || body.audio.data.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.audio.data)) return reply(res, 400, { code: 'INVALID_AUDIO' });
   if (typeof body.seconds !== 'number' || !(body.seconds > 0)) return reply(res, 400, { code: 'INVALID_SECONDS' });
   const ok = (n) => Number.isInteger(n) && n >= 0 && n <= 20;
   if (!body.take || !ok(body.take.judged) || !ok(body.take.unheard)) return reply(res, 400, { code: 'INVALID_TAKE' });
   if (body.lines_version !== LINES_HASH) return reply(res, 409, { code: 'ITEM_CHANGED' });
   const line = byId.get(body.line_id);
   if (!line) return reply(res, 409, { code: 'ITEM_CHANGED' });
   if (body.seconds > line.answerSec + 5) { log.push({ line: line.id, status: 'too_long', seconds: body.seconds }); return reply(res, 200, { ok: true, status: 'too_long' }); }
   // ?down=1: status는 켜짐인데 받아 적기가 실패(운영 11-01~ OpenAI 429와 같은 꼴) — 화면은 「지금은 받아쓰기를 못 해요」.
   if (url.searchParams.get('down') === '1') { log.push({ line: line.id, status: 'unavailable' }); return reply(res, 200, { ok: true, status: 'unavailable' }); }
   const list = TRANSCRIPTS[line.id] || [line.line], n = used.get(line.id) || 0; used.set(line.id, n + 1);
   const transcript = list[Math.min(n, list.length - 1)];
   const result = judgeLine(line.spec, { transcript, seconds: body.seconds, speechSeconds: body.seconds, language: '' });
   const gated = result.status !== 'ok';
   const next = nextTake({ result, attempt: body.take.judged + (gated ? 0 : 1), unheard: gated ? body.take.unheard + 1 : 0 });
   log.push({ line: line.id, take: body.take, seconds: body.seconds, mime: body.audio.mime, lang: body.lang, status: result.status, verdict: result.verdict, note: result.note?.kind ?? null, sure: result.sure });
   return reply(res, 200, { ok: true, accountId: 'synthetic-world-1', status: 'ok', take: { lineId: line.id, lineKind: line.kind, status: result.status, verdict: result.verdict, note: result.note, sure: result.sure, next, heard: transcript } });
  }
  // ?world=1이 부르는 WORLD 묶음과 그 옆 모듈(experiences/ 아래 읽기 전용 · 코드와 데이터만).
  if (url.pathname.startsWith('/live/')) {
   let rel = decodeURIComponent(url.pathname.slice(6)); if (!rel || rel.endsWith('/')) rel += 'index.html';
   if (rel.includes('..')) return reply(res, 404, {});
   const local = CANDIDATE && path.join(CANDIDATE, rel);
   let bytes;
   if (local && fs.existsSync(local)) bytes = fs.readFileSync(local);
   else { const r = await fetch(`https://synk.im/world/${rel}`); if (!r.ok) return reply(res, r.status, {}); bytes = Buffer.from(await r.arrayBuffer()); }
   res.writeHead(200, { 'content-type': TYPES.get(path.extname(rel)) || 'application/octet-stream', 'cache-control': 'no-store' }); return res.end(bytes);
  }
  if (url.pathname.startsWith('/x/')) { const rel = decodeURIComponent(url.pathname.slice(3)); const file = path.join(ROOT, 'experiences', rel);
   if (rel.includes('..') || !/\.(?:mjs|js|cjs|json)$/.test(rel) || !fs.existsSync(file)) return reply(res, 404, {});
   res.writeHead(200, { 'content-type': rel.endsWith('.json') ? 'application/json' : 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }); return res.end(fs.readFileSync(file)); }
  if (url.pathname === '/drama' ) { res.writeHead(301, { location: '/drama/' }); return res.end(); }
  if (url.pathname === '/drama/__nowebgl.js') { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
   return res.end("(()=>{const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return /webgl/i.test(String(t))?null:g.call(this,t,...a);};window.__noWebGL=true;})();"); }
  if (url.pathname.startsWith('/drama/')) {
   let rel = decodeURIComponent(url.pathname.slice('/drama/'.length)) || 'index.html';
   if (rel.includes('..') || rel === 'content.mjs' || rel.startsWith('media/manifest')) return reply(res, 404, {});
   const file = path.join(PILOT, rel);
   if (!fs.existsSync(file) || !fs.statSync(file).isFile() || !TYPES.has(path.extname(file))) return reply(res, 404, {});
   let bytes = fs.readFileSync(file);
   if (rel === 'index.html') bytes = Buffer.from(bytes.toString('utf8').replace('<html lang="ko">', '<html lang="ko" data-drama="world">'));
   // ?nowebgl=1: WebGL이 없는 브라우저 흉내 — 다른 스크립트보다 먼저 canvas의 webgl 문맥을 막는다(CSP상 인라인이 안 돼 파일로 낸다).
   if (rel === 'index.html' && url.searchParams.get('nowebgl') === '1') bytes = Buffer.from(bytes.toString('utf8').replace('<link rel="stylesheet"', '<script src="__nowebgl.js"></script>\n<link rel="stylesheet"'));
   res.writeHead(200, { 'content-type': TYPES.get(path.extname(file)), 'content-length': bytes.length, 'cache-control': 'no-store', 'accept-ranges': 'none' });
   return res.end(bytes);
  }
  reply(res, 404, {});
 } catch (error) { reply(res, 500, { code: 'internal', message: String(error?.message || error) }); }
});
server.listen(port, '127.0.0.1', () => console.log(`틀 시험: http://127.0.0.1:${port}/ · 직접 열기: /drama/ · 대사 은행 ${LINES_HASH}`));
