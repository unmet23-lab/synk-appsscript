#!/usr/bin/env node
// 「오늘」 한 장 시연 · 리허설 판(2026-11-14) — WORLD 대역 부모 창 위에서 드라마 틀을 ?today=1로 연다. 운영 계정 · talk · DB를 건드리지 않는다.
//   node experiences/drama/qa/오늘한장-20261114/오늘시험.mjs [--port 8798]
//   http://127.0.0.1:8798/?s=A   기록 A(어제 1화 6번 줄 끝 '요' 노트 · 새 상황 안 함 · 입장 검사 세부 내용 두 번 놓침)
//   http://127.0.0.1:8798/?s=B   기록 B(8일 전 1화와 새 상황을 혼자 해냄 → 「지난번 그 말, 다른 곳에서」)
//   http://127.0.0.1:8798/?s=F   첫날(오늘 기록뿐 → 지금 첫 화면 그대로) · ?s=none 기록 없음 · &keep=1 지난 기록을 지우지 않고 이어서
//   &miss=1 「오늘」 줄을 처음 테이크에서 놓치게(끝 화면에 「해냄」이 안 뜨는지 보기)
// 틀시험(../WORLD올리기-20261102/틀시험.mjs)과 같은 꼴의 부모: 합성 계정 학습 호스트(SYNKLearningHost — 이 창 localStorage, 서버로 안 보냄) · 드라마 통로
// (SYNKDramaHost — talk와 같은 판정기 · 대사 은행, 받아 적은 글만 아래 차례로 정해 둔다)에 더해:
//  · 기록 심기: 실제 기록기 호출로 지난날 기록을 남긴다(심기.mjs) — 드라마는 DramaLearning, 입장 검사는 그 게임 묶음 SynkLearning.
//  · 놀이 호스트(SYNKPlayHost) 대역: 입장 검사 진도(열린 근무지 · 연수)를 이 창 localStorage에 둔다.
//  · 「오늘」 통로(SYNKTodayHost): 드라마 틀이 입장 검사 근무를 열어 달라고 하면 같은 자리에 그 게임을 열고, 「오늘로 돌아가기」로 드라마 「오늘」에 돌아온다.
//    WORLD app-shell에는 아직 이 통로가 없다(공개 결정 때 잇는다).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { judgeLine, nextTake } from '../../../../tools/lib/드라마판정.mjs';
import { dramaLines, readEpisodes, linesHash } from '../../../../tools/build-world-speaking-talk.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const PILOT = path.join(ROOT, 'experiences/drama/pilot');
const ENTRY = path.join(ROOT, 'experiences/entry-check');
const args = process.argv.slice(2);
const port = Number(args.includes('--port') ? args[args.indexOf('--port') + 1] : 8798);
const lines = dramaLines(await readEpisodes());
const LINES_HASH = linesHash(lines);
const byId = new Map(lines.map((l) => [l.id, l]));
// 받아 적힌 글(테이크마다 하나씩, 다 쓰면 마지막을 되풀이). 「오늘」 줄은 처음 보는 상황에서 혼자 한 말 그대로 — 판정은 talk와 같은 판정기가 한다.
const TRANSCRIPTS = {
 's1e01-6': ['네, 맞아요. 길을 잃어서 한참 헤맸어', '네, 맞아요. 길을 잃어서 한참 헤맸어', '네, 맞아요. 길을 잃어서 한참 헤맸어요'],
 's1e01-7': ['네 선배님 그런데 혹시 도서관이 어디에 있는지 아세요'],
 's1e01-8': ['정말요? 선배님 덕분에 살았어요'],
 's1e01-t3': ['처음엔 힘들었지만 이제 조금씩 익숙해지고 있어요'],
 's1e01-t4': ['선생님, 혹시 복사실이 어디에 있는지 아세요?'],
 's1e01-t7': ['선생님 덕분에 살았어요. 정말 감사합니다'],
 's1e01-t8': ['교수님, 과제를 어디에 내야 하는지 여쭤봐도 될까요?'],
 's1e01-t9': ['선배님, 혹시 편의점이 어디에 있는지 아세요?'],
 's1e01-t6': ['길을 잃었어요. 새솔대 정문이 어디에 있는지 아세요?'],
};
// &miss=1: 「오늘」 줄의 첫 테이크를 끝맺음 노트로(반말 끝).
const MISS = { 's1e01-t3': '처음엔 힘들었지만 이제 조금씩 익숙해지고 있어', 's1e01-t9': '선배, 편의점 어디 있어', 's1e01-t8': '교수님, 과제 어디에 내야 돼', 's1e01-t6': '정문 어디야' };
const used = new Map();
const log = [];
const TYPES = new Map([['.html', 'text/html; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json'],
 ['.mp3', 'audio/mpeg'], ['.mp4', 'video/mp4'], ['.webp', 'image/webp'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.svg', 'image/svg+xml'], ['.woff2', 'font/woff2'], ['.m4a', 'audio/mp4'], ['.ogg', 'audio/ogg']]);

const PARENT = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>WORLD 대역 · 오늘 한 장</title><style>html,body{margin:0;height:100%;background:#09090b}iframe{border:0;width:100%;height:100%;display:block}
.back{position:fixed;z-index:9;left:max(12px,env(safe-area-inset-left));top:max(12px,env(safe-area-inset-top));display:none;align-items:center;gap:8px;height:40px;padding:0 16px 0 14px;border:0;border-radius:999px;
 background:rgba(20,20,24,.82);color:#f4f5f8;font:700 14px/1 system-ui,sans-serif;letter-spacing:-.01em;box-shadow:0 0 0 1px rgba(255,255,255,.18),0 12px 30px -12px rgba(0,0,0,.6);backdrop-filter:blur(14px);cursor:pointer}
.back.on{display:flex}.back::before{content:'';width:8px;height:8px;border:solid #f4f5f8;border-width:0 0 2px 2px;transform:rotate(45deg)}</style>
<script src="/drama/atlas-learning.js"></script><script src="/entry-check/atlas-learning.js"></script></head><body>
<button type="button" class="back" id="back">오늘로 돌아가기</button>
<script type="module">
const q = new URLSearchParams(location.search);
const scenario = q.get('s') || 'A';
window.__posts = [];
// 합성 계정 기록(이 창 localStorage, 리허설 계정 앞이름) — 열 때마다 비우고 시나리오를 다시 심는다(&keep=1이면 이어서).
const keep = q.get('keep') === '1';
if (!keep) {
 for (const k of Object.keys(localStorage)) if (k.startsWith('synk.drama.rehearsal.') || k === 'synk.entry-check.v1' || k.startsWith('synk.drama.today.')) localStorage.removeItem(k);
 for (const k of Object.keys(sessionStorage)) if (k.startsWith('synk.drama.today.')) sessionStorage.removeItem(k);
}
const learnHost = DramaLearning.createRehearsalHost({ accountKey: 'synthetic-today-1', revision: 1, connected: false, storage: localStorage, transport: null });
// 놀이 호스트 대역: 입장 검사 진도 · 코인을 이 창 localStorage에 둔다(WORLD의 놀이 계정 기록 자리).
const playStore = { getItem: (k) => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v), removeItem: (k) => localStorage.removeItem(k), key: (i) => localStorage.key(i), get length() { return localStorage.length; } };
window.SYNKPlayHost = Object.freeze({ ready: async () => {}, status: () => ({ phase: 'synced', pending: 0, message: '' }), storage: () => playStore,
 snapshot: () => ({ state: { records: Object.fromEntries(['synk.entry-check.v1'].map((k) => [k, localStorage.getItem(k)])) } }), subscribe: (fn) => { fn({ phase: 'synced', pending: 0, message: '' }); return () => {}; },
 wallet: async () => ({ ok: true, coins: 0 }), retry: async () => {} });
const call = (body) => fetch('/fake/' + body.action + location.search, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => { const d = await r.json(); if (!r.ok) throw Object.assign(Error(d.code), { code: d.code, status: r.status }); return d; });
window.SYNKDramaHost = Object.freeze({ status: () => call({ action: 'status' }), take: (p) => call(p) });
await learnHost.ready();
for (let i = 0; i < 50 && learnHost.status().complete !== true; i++) await new Promise((r) => setTimeout(r, 100));
if (!keep && scenario !== 'none') {
 const { seed } = await import('/qa/심기.mjs');
 const entryLearning = await import('/entry-check/learning.mjs');
 const { VENUES } = await import('/entry-check/content.mjs');
 // 기록 잠금(Web Lock)을 받은 뒤에 남긴다(틀시험 ?c=1과 같은 까닭).
 await seed({ host: learnHost, drama: DramaLearning, entry: SynkLearning, entryLearning, VENUES, playStorage: localStorage, scenario, now: Date.now(), settle: () => new Promise((r) => setTimeout(r, 120)) });
}
const frame = document.createElement('iframe'); frame.className = 'game-frame'; frame.allow = 'autoplay; fullscreen; microphone';
const drama = () => { frame.title = '드라마 말하기 · 1화'; frame.src = '/drama/?today=1'; document.getElementById('back').classList.remove('on'); };
// 「오늘」 통로: 드라마 틀이 다른 게임을 열어 달라고 한다(app-shell launchGame 자리). 돌아오면 드라마 「오늘」이 끝 화면을 잇는다.
window.SYNKTodayHost = Object.freeze({
 open({ game } = {}) {
  if (game !== 'entry') return false;
  frame.title = '입장 검사'; frame.src = '/entry-check/';
  document.getElementById('back').classList.add('on');
  return true;
 },
});
document.getElementById('back').onclick = drama;
drama();
document.body.append(frame);
</script></body></html>`;

function reply(res, status, value) { const b = Buffer.from(JSON.stringify(value)); res.writeHead(status, { 'content-type': 'application/json', 'content-length': b.length, 'cache-control': 'no-store' }); res.end(b); }
function file(res, base, rel, transform = null) {
 if (!rel || rel.endsWith('/')) rel += 'index.html';
 if (rel.split(/[\\/]/).includes('..')) return reply(res, 404, {});
 const f = path.join(base, rel);
 if (!fs.existsSync(f) || !fs.statSync(f).isFile() || !TYPES.has(path.extname(f))) return reply(res, 404, {});
 let bytes = fs.readFileSync(f);
 if (transform) bytes = transform(rel, bytes);
 res.writeHead(200, { 'content-type': TYPES.get(path.extname(f)), 'content-length': bytes.length, 'cache-control': 'no-store', 'accept-ranges': 'none' });
 return res.end(bytes);
}
const server = http.createServer(async (req, res) => {
 const url = new URL(req.url, `http://127.0.0.1:${port}`);
 try {
  if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end(PARENT); }
  if (url.pathname === '/log') return reply(res, 200, log);
  if (url.pathname.startsWith('/fake/')) {
   let raw = ''; for await (const c of req) raw += c;
   const body = JSON.parse(raw || '{}');
   if (body.action === 'status') return reply(res, 200, { ok: true, accountId: 'synthetic-today-1', dramaEnabled: true, dramaLimit: 30, dramaRemaining: 30, linesVersion: LINES_HASH });
   if (body.action !== 'take') return reply(res, 400, { code: 'INVALID_ACTION' });
   if (body.lines_version !== LINES_HASH) return reply(res, 409, { code: 'ITEM_CHANGED' });
   const line = byId.get(body.line_id);
   if (!line) return reply(res, 409, { code: 'ITEM_CHANGED' });
   if (body.seconds > line.answerSec + 5) return reply(res, 200, { ok: true, status: 'too_long' });
   const n = used.get(line.id) || 0; used.set(line.id, n + 1);
   const list = url.searchParams.get('miss') === '1' && MISS[line.id] && n === 0 ? [MISS[line.id]] : TRANSCRIPTS[line.id] || [line.line];
   const transcript = list[Math.min(n, list.length - 1)];
   const result = judgeLine(line.spec, { transcript, seconds: body.seconds, speechSeconds: body.seconds, language: '' });
   const gated = result.status !== 'ok';
   const next = nextTake({ result, attempt: body.take.judged + (gated ? 0 : 1), unheard: gated ? body.take.unheard + 1 : 0 });
   log.push({ line: line.id, status: result.status, verdict: result.verdict, note: result.note?.kind ?? null, sure: result.sure });
   return reply(res, 200, { ok: true, accountId: 'synthetic-today-1', status: 'ok', take: { lineId: line.id, lineKind: line.kind, status: result.status, verdict: result.verdict, note: result.note, sure: result.sure, next, heard: transcript } });
  }
  if (url.pathname === '/drama' || url.pathname === '/entry-check') { res.writeHead(301, { location: url.pathname + '/' }); return res.end(); }
  if (url.pathname.startsWith('/drama/')) {
   const rel = decodeURIComponent(url.pathname.slice('/drama/'.length));
   if (rel === 'content.mjs' || rel.startsWith('media/manifest')) return reply(res, 404, {});
   return file(res, PILOT, rel, (r, b) => (r === 'index.html' ? Buffer.from(b.toString('utf8').replace('<html lang="ko">', '<html lang="ko" data-drama="world">')) : b));
  }
  if (url.pathname.startsWith('/entry-check/')) return file(res, ENTRY, decodeURIComponent(url.pathname.slice('/entry-check/'.length)));
  if (url.pathname.startsWith('/qa/')) { const rel = decodeURIComponent(url.pathname.slice(4)); if (!/^[^/\\]+\.mjs$/.test(rel)) return reply(res, 404, {}); return file(res, HERE, rel); }
  reply(res, 404, {});
 } catch (error) { reply(res, 500, { code: 'internal', message: String(error?.message || error) }); }
});
server.listen(port, '127.0.0.1', () => console.log(`오늘 한 장: http://127.0.0.1:${port}/?s=A · 대사 은행 ${LINES_HASH}`));
