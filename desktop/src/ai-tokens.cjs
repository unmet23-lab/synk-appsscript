'use strict';
// 솔리오 → AI 구독 관리 「모델별 토큰」(2026-11-15 유호님 「각 llm 모델마다 토큰 출력량 확인할수있는 시스템 솔리오에 추가해줘」).
// 이 PC의 AI 도구가 스스로 남기는 대화 기록에서 응답마다의 모델 이름과 토큰 수만 꺼내 날짜 · 모델별로 더한다.
//  · 대화 내용은 꺼내 두지도 밖으로 보내지도 않는다. 이 파일이 남기는 것은 날짜 · 도구 · 모델 이름 · 토큰 수 · 파일 위치와 읽은 자리뿐이다.
//  · 자격(로그인 토큰) 파일은 열지 않는다. 읽는 곳은 아래 SOURCES의 기록 폴더뿐이다.
//  · 회원이 켰을 때만 읽는다(기본은 꺼짐). 끄면 모은 숫자도 지운다.
// 도구마다 기록의 짜임이 다르다(2026-11-15 이 PC에서 확인).
//  · Claude Code: <설정 폴더>/projects/**/*.jsonl. 응답 하나(message.id)의 생각 · 글 · 도구 호출 블록이 줄마다 따로 적히고 줄마다 같은 usage가 붙는다.
//    그래서 message.id마다 한 번만 센다(현장 노트 AI_CLI 「원문 jsonl의 줄마다 더하면 두세 배로 부푼다」). output_tokens에는 생각 토큰이 들어 있다.
//    세션이 워크트리로 옮겨지거나 이어 쓰이면 같은 응답이 다른 파일에도 적혀(11-15 이 PC 14,696개), 응답 id를 파일을 가로질러 한 번만 센다.
//  · Codex(GPT): <CODEX_HOME>/sessions/**/rollout-*.jsonl, 일주일쯤 지나 옮겨지는 archived_sessions, 그리고 압축된 rollout-*.jsonl.zst(11-15 이 PC 579개 중 445개).
//    파일은 경로가 아니라 rollout 이름으로 알아본다(옮기거나 압축해도 한 세션). 응답마다의 token_usage_record로 세고, 그 기록이 처음 나오기 전의 응답(옛 판)만 token_count 사건으로 센다.
//    모델은 바로 앞 turn_context의 model이다. input_tokens에 캐시 읽기가 들어 있어 빼서 둔다.
//  · Grok CLI: ~/.grok/sessions/<폴더>/<세션>/usage.json. 회차(turns)마다 끝난 때와 모델별 토큰이 있다. 파일이 통째로 다시 쓰여 바뀌면 다시 읽는다.
// 다른 도구와 같은 자로 보이게 칸을 맞춘다: in = 캐시가 아닌 입력, out = 출력(생각 포함), cr = 캐시 읽기, cw = 캐시 쓰기, rs = 출력 가운데 생각, n = 응답 수.
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');

const SCHEMA = 3; // 3: Codex 이어 쓴 세션의 앞 사건을 함께 센다(11-15 검수 지적) — 2까지 모은 숫자는 처음부터 다시 센다.
const DAY = 864e5;
const KEEP_DAYS = 400; // 이보다 오래된 날의 숫자는 버린다.
const SHOW_DAYS = 35; // 화면에 넘기는 날 수(오늘 · 7일 · 30일을 세고 남는 여유).
const CHUNK = 4 << 20; // 한 번에 읽는 덩이(4MB).
const PARALLEL = 6; // 함께 읽는 파일 수.
const RECENT_IDS = 12; // 이어 읽을 때 앞 회차 끝의 응답이 다시 세지지 않게 남기는 마지막 id 수.
const RECENT_FRESH = 3 * DAY; // 마지막 응답 몇 개는 사흘 안에 바뀐 파일만 남긴다(저장 파일이 커지지 않게).
const GONE_KEEP = 40 * DAY; // 원래 파일이 지워진 뒤 그 파일의 응답 id와 읽은 자리를 들고 있는 기간. 그 뒤로는 숫자만 「지워진 기록」에 합친다.
const AUTO_EVERY = 3 * 3600e3; // 화면을 열지 않아도 켜져 있으면 이만큼마다 뒤에서 센다(Claude Code가 오래된 기록을 지우기 전에).
// 실시간 지켜보기(11-16 유호님 「실시간으로 나오게 하고싶은데」): 화면이 열려 있는 동안 기록 폴더를 운영체제에 지켜봐 달라고 맡기고, 알림이 온 파일만 읽은 자리부터 읽는다.
// 11-16 이 PC: Claude Code · Codex 기록이 바뀐 지 1초 안에 알림이 왔고(70초에 187번, 파일 15개), 그때 stat 크기는 이미 늘어 있었다.
const LIVE_LEASE = 3 * 60e3; // 화면이 1분마다 다시 부탁한다. 이만큼 소식이 없으면(창을 닫음 · 화면을 떠남 · 화면이 죽음) 지켜보기를 멈춘다.
const LIVE_SETTLE = 500; // 알림이 멎은 뒤 이만큼 기다렸다 읽는다 — 응답 하나가 줄 여럿으로 잇달아 적힌다.
// 알림이 쉬지 않고 와도 이만큼마다는 읽는다. 여러 세션이 함께 쓰면 알림이 멎지 않아 대부분 이것으로 읽는다(11-16 이 PC 2.5초일 때 알림→판 중간값 2.5초).
// 판 하나를 만드는 데 20ms(17KB)라 1.5초마다여도 부담이 없다.
const LIVE_MAX_WAIT = 1500;
const LIVE_SAFETY = 15 * 60e3; // 지켜보는 동안 다 훑는 다시 세기 간격 — 놓친 알림(알림 넘침 · 지켜보기 전에 바뀐 파일)을 메운다. 지켜보지 않을 때는 5분.
const LIVE_SAVE = 30e3; // 지켜보며 더한 숫자를 저장해 두는 간격(그 사이 앱이 꺼지면 저장된 자리부터 다시 읽어 같은 숫자가 된다).
const FIELDS = ['in', 'out', 'cr', 'cw', 'rs', 'n'];
const SERVICES = Object.freeze(['claude', 'gpt', 'grok']);

const count = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : 0);
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const cleanModel = m => String(m || '').trim().slice(0, 80);

// 한 응답을 날짜 · 도구 · 모델 칸에 더한다. agg: { '날짜|도구|모델': [in, out, cr, cw, rs, n] }
// use.n: 응답 수(기본 1). 같은 응답의 모자랐던 값을 메우는 줄은 0이다.
function addUse(agg, service, use) {
  if (!use || !Number.isFinite(use.t) || !use.model) return;
  const key = `${dayKey(use.t)}|${service}|${use.model}`;
  const cell = agg[key] || (agg[key] = [0, 0, 0, 0, 0, 0]);
  cell[0] += count(use.in); cell[1] += count(use.out); cell[2] += count(use.cr); cell[3] += count(use.cw); cell[4] += count(use.rs);
  cell[5] += use.n === undefined ? 1 : count(use.n);
}

/* ---------- 줄 읽기(도구마다) ---------- */
// 줄은 바이트(Buffer)로 받는다. 이 PC의 Claude Code 기록은 68GB였고(11-15) 대부분이 도구 결과 · 첨부 줄이라,
// 줄을 글자로 풀기 전에 바이트로 먼저 거른다. 문자열을 넘겨도 된다(시험).
const asBuf = line => (typeof line === 'string' ? Buffer.from(line, 'utf8') : line);
const TAIL = 1200;
const B = s => Buffer.from(s, 'utf8');
const ASSISTANT_TOP = B('"type":"assistant","uuid":"'), ASSISTANT = B('"type":"assistant"'), MESSAGE = B('"message":{'), USAGE = B('"usage":{');
// 짝이 맞는 } 자리(문자열 안의 괄호와 \" 는 건너뛴다). 못 찾으면 -1.
function objectEnd(buf, start) {
  let depth = 0, inStr = false;
  for (let i = start; i < buf.length; i++) {
    const c = buf[i];
    if (inStr) { if (c === 0x5c) i++; else if (c === 0x22) inStr = false; continue; }
    if (c === 0x22) inStr = true;
    else if (c === 0x7b) depth++;
    else if (c === 0x7d && --depth === 0) return i;
  }
  return -1;
}
// Claude 응답 줄의 칸을 빨리 꺼낸다: 맨 위 type은 줄 끝 가까이에, message의 첫 열쇠가 model · id, usage는 content 뒤에 있다(11-15 이 PC 기록, Claude Code 2.1.325).
// 모양이 다르면 null을 돌려 줄 전체를 JSON으로 읽게 한다.
function claudeFast(buf) {
  const tail = buf.length > TAIL ? buf.subarray(buf.length - TAIL) : buf;
  if (!tail.includes(ASSISTANT_TOP)) return null;
  const msg = buf.indexOf(MESSAGE);
  if (msg < 0 || msg > 4000) return null;
  const head = buf.toString('utf8', msg, Math.min(buf.length, msg + 600));
  const model = /^"message":\{"model":"([^"\\]{1,80})","id":"([^"\\]{1,160})"/.exec(head);
  const at = buf.lastIndexOf(USAGE);
  if (!model || at < 0) return null;
  const end = objectEnd(buf, at + USAGE.length - 1);
  if (end < 0) return null;
  let u; try { u = JSON.parse(buf.toString('utf8', at + USAGE.length - 1, end + 1)); } catch { return null; }
  // 응답 시각은 맨 위 type 표식 뒤에서만 찾는다 — 줄 끝 가까이의 도구 입력에 같은 이름의 칸이 있어도 그것을 읽지 않게(검수 지적).
  const ts = /"timestamp":"([^"\\]{10,40})"/.exec(tail.toString('utf8', tail.lastIndexOf(ASSISTANT_TOP)));
  if (!u || typeof u !== 'object' || !('output_tokens' in u) || !ts || !Number.isFinite(Date.parse(ts[1]))) return null;
  return { model: model[1], id: model[2], usage: u, timestamp: ts[1] };
}
function claudeSlow(buf) {
  let o; try { o = JSON.parse(buf.toString('utf8')); } catch { return null; }
  if (o?.type !== 'assistant' || !o.message?.usage || typeof o.message.model !== 'string') return null;
  const id = typeof o.message.id === 'string' ? o.message.id : typeof o.requestId === 'string' ? o.requestId : null;
  return { model: o.message.model, id, usage: o.message.usage, timestamp: o.timestamp };
}
// Claude Code 한 줄. 같은 응답(message.id)의 줄이 여럿이면 처음 줄은 세고, 뒤 줄은 값이 더 큰 칸의 차이만 더한다.
// 앞 줄에 스트리밍 중간값(출력 2처럼)이 적히는 일이 있어 첫 줄만 남기면 출력을 적게 센다(ccusage #888).
// st.seen: 이번 회차에 본 응답(id → 센 값), st.recent: 앞 회차 끝의 응답 몇 개(이어 읽을 때 같은 응답의 뒤 줄을 다시 세지 않게).
const CLAUDE_KEYS = ['in', 'out', 'cr', 'cw', 'rs'];
function claudeLine(line, st) {
  const buf = asBuf(line);
  const tail = buf.length > TAIL ? buf.subarray(buf.length - TAIL) : buf;
  // 도구 결과 · 첨부 · 기록 줄은 건너뛴다. 다른 판이 type을 줄 앞쪽에 적어도 놓치지 않게 머리 600바이트도 본다.
  if (!tail.includes(ASSISTANT) && !(buf.length > TAIL ? buf.subarray(0, 600) : buf).includes(ASSISTANT)) return null;
  const r = claudeFast(buf) || claudeSlow(buf);
  if (!r || r.model === '<synthetic>') return null;
  const u = r.usage;
  const use = { t: Date.parse(r.timestamp), model: cleanModel(r.model), in: count(u.input_tokens), out: count(u.output_tokens), cr: count(u.cache_read_input_tokens), cw: count(u.cache_creation_input_tokens), rs: count(u.output_tokens_details?.thinking_tokens) };
  // 시각을 못 읽은 응답은 세지도 응답 id를 잡지도 않는다(잡으면 그 응답이 다른 파일에서도 영영 빠진다).
  if (!Number.isFinite(use.t)) return null;
  const id = r.id;
  if (!id) return use;
  const before = st.seen.get(id) || st.recent.find(r => r.id === id);
  if (!before) {
    // 다른 파일(옮겨진 세션의 사본 · 이어 쓴 세션 · 곁 질문이 다시 적은 앞 대화)이 이미 센 응답이면 세지 않는다.
    // 11-15 이 PC 전체 기록에서 파일 사이에 겹친 응답이 14,696개였고, 파일 안에서만 거르면 출력이 2.6% 부풀었다(ccusage #913과 같은 병).
    let ci;
    if (st.owners) {
      const h = idHash(id);
      // 이번 회차에 다른 파일이 먼저 잡은 응답이면, 이 줄의 값이 더 큰 칸의 차이만 더한다 — 사본이 스트리밍 중간값(출력 2)만 가진 채 먼저 읽혀도
      // 원래 파일의 최종값을 버리지 않게(검수 지적). 앞 회차에 잡은 응답은 원래 파일이 먼저 있어 이미 최종값으로 세었으니 세지 않는다.
      if (st.owners.has(h)) return st.claimed ? st.claimed.grow(h, use) : null;
      st.owners.set(h, st.file); st.mine.push(h);
      if (st.claimed) ci = st.claimed.add(h, use);
    }
    const entry = { id, t: use.t, model: use.model, ci, ...Object.fromEntries(CLAUDE_KEYS.map(k => [k, use[k]])) };
    st.seen.set(id, entry); st.recent.push(entry); if (st.recent.length > RECENT_IDS) st.recent.shift();
    return use;
  }
  // 이번 회차에 잡은 응답은 파일을 가로지른 큰 값과 견준다 — 다른 파일이 먼저 최종값을 받았으면 여기서 또 더하지 않게.
  if (before.ci !== undefined && st.claimed) {
    for (const k of CLAUDE_KEYS) before[k] = Math.max(before[k], use[k]);
    return st.claimed.growAt(before.ci, use, before.t, before.model);
  }
  const more = { t: before.t, model: before.model, n: 0 };
  let grew = false;
  for (const k of CLAUDE_KEYS) { more[k] = Math.max(0, use[k] - before[k]); if (more[k]) { grew = true; before[k] = use[k]; } }
  return grew ? more : null;
}

// 이번 회차에 잡은 응답의 센 값(칸 다섯)을 둔다 — 같은 응답이 다른 파일에 더 큰 값으로 적혀 있으면 그 차이만 받으려고.
// 첫 세기에 55만 개쯤이라 객체 대신 수 배열에 담는다(지도 하나 + 응답마다 40바이트).
function claimStore() {
  const idx = new Map();
  let vals = new Float64Array(5 * 4096), n = 0;
  const put = (i, src) => { for (let j = 0; j < 5; j++) vals[i * 5 + j] = src[CLAUDE_KEYS[j]] || 0; };
  return {
    add(h, use) {
      if ((n + 1) * 5 > vals.length) { const v = new Float64Array(vals.length * 2); v.set(vals); vals = v; }
      const i = n++; idx.set(h, i); put(i, use); return i;
    },
    grow(h, use) { const i = idx.get(h); return i === undefined ? null : this.growAt(i, use, use.t, use.model); },
    growAt(i, use, t, model) {
      const more = { t, model, n: 0 };
      let grew = false;
      for (let j = 0; j < 5; j++) { const k = CLAUDE_KEYS[j], d = (use[k] || 0) - vals[i * 5 + j]; more[k] = d > 0 ? d : 0; if (d > 0) { grew = true; vals[i * 5 + j] = use[k]; } }
      return grew ? more : null;
    },
  };
}

// 응답 id를 53비트 수로 줄인다(파일 사이 중복 거르기용 — 55만 개에서 겹칠 확률은 10만분의 3쯤).
function idHash(s) {
  let a = 0x811c9dc5, b = 0x9747b28c;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 0x5bd1e995); b ^= b >>> 15; }
  return (a >>> 0) * 2097152 + ((b >>> 0) & 0x1fffff);
}
// 파일마다 센 응답 id 수를 저장 파일에 짧게(Float64 → base64) 둔다.
const packIds = list => Buffer.from(new Float64Array(list).buffer).toString('base64');
const unpackIds = text => { if (typeof text !== 'string' || !text) return []; const b = Buffer.from(text, 'base64'); return Array.from(new Float64Array(b.buffer, b.byteOffset, Math.floor(b.length / 8))); };

// Codex 한 줄. st.model: 지금 회차의 모델.
// 응답 기록(token_usage_record — 응답 id와 그 응답 하나의 usage)이 있으면 그것으로 센다. 이 PC 134개 파일 가운데 129개에 있었고,
// token_count 사건으로 세면 출력이 10.6% 적게 잡혔다(11-15: 2,394만 대 2,141만 — 사건 사이에 응답이 여럿 끼면 last_token_usage가 하나만 담는다).
// 응답 기록이 없는 옛 파일만 token_count 사건(alt)으로 센다. st.total: 앞 token_count의 누적 total_tokens(되풀이된 사건을 거른다).
// 세 종류 모두 줄 머리(240바이트 안)에 종류가 적힌다: {"timestamp":…,"type":"turn_context"…} · {…"type":"token_usage_record"…} · {…"type":"event_msg","payload":{"type":"token_count"…}
const TURN_CONTEXT = B('"type":"turn_context"'), TOKEN_COUNT = B('"type":"token_count"'), USAGE_RECORD = B('"type":"token_usage_record"');
function codexUse(o, u, st) {
  const input = count(u.input_tokens), cached = Math.min(input, count(u.cached_input_tokens));
  // 모델을 적기 전의 응답(아주 옛 기록)은 「?」로 둔다 — 화면이 「모델 기록 없음」으로 보인다.
  return { t: Date.parse(o.timestamp), model: st.model || '?', in: input - cached, out: u.output_tokens, cr: cached, cw: u.cache_write_input_tokens, rs: u.reasoning_output_tokens };
}
function codexLine(line, st) {
  const buf = asBuf(line), head = buf.length > 240 ? buf.subarray(0, 240) : buf;
  if (head.includes(TURN_CONTEXT)) {
    let o; try { o = JSON.parse(buf.toString('utf8')); } catch { return null; }
    if (o?.type === 'turn_context' && typeof o.payload?.model === 'string') st.model = cleanModel(o.payload.model);
    return null;
  }
  if (head.includes(USAGE_RECORD)) {
    let o; try { o = JSON.parse(buf.toString('utf8')); } catch { return null; }
    const u = o?.type === 'token_usage_record' ? o.payload?.usage : null;
    if (!u || typeof u !== 'object') return null;
    st.rec = true;
    return codexUse(o, u, st);
  }
  if (!head.includes(TOKEN_COUNT)) return null;
  let o; try { o = JSON.parse(buf.toString('utf8')); } catch { return null; }
  if (o?.type !== 'event_msg' || o.payload?.type !== 'token_count') return null;
  const info = o.payload.info, total = info?.total_token_usage, last = info?.last_token_usage;
  if (!total && !last) return null;
  const sum = total ? count(total.total_tokens) : null;
  if (sum !== null && st.total !== null && sum === st.total) return null;
  // last가 없는 옛 기록은 누적의 늘어난 만큼을 한 응답으로 본다.
  let use = last;
  if (!use && total) { const p = st.prev || {}; use = Object.fromEntries(['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens'].map(k => [k, Math.max(0, count(total[k]) - count(p[k]))])); }
  if (sum !== null) { st.total = sum; st.prev = { input_tokens: total.input_tokens, cached_input_tokens: total.cached_input_tokens, output_tokens: total.output_tokens, reasoning_output_tokens: total.reasoning_output_tokens }; }
  return { ...codexUse(o, use, st), alt: true };
}

// Grok usage.json 통째로. 회차마다 끝난 때와 모델별 토큰.
function grokFile(text) {
  let o; try { o = JSON.parse(text); } catch { return []; }
  const out = [];
  for (const turn of Array.isArray(o?.turns) ? o.turns : []) {
    const t = Date.parse(turn?.endedAt);
    for (const [model, u] of Object.entries(turn?.modelUsage || {})) {
      const input = count(u?.inputTokens), cached = Math.min(input, count(u?.cachedReadTokens));
      const calls = Math.max(1, count(u?.modelCalls));
      out.push({ t, model: cleanModel(model), in: input - cached, out: u?.outputTokens, cr: cached, cw: u?.cacheCreationTokens, rs: u?.reasoningTokens, calls });
    }
  }
  return out;
}

// Gemini CLI 세션 파일 통째로(옛 .json 한 덩이 또는 새 .jsonl의 줄마다 메시지 · $set). 메시지 id마다 마지막 값.
function geminiFile(text) {
  const messages = new Map();
  const take = m => { if (m && typeof m === 'object' && m.tokens && typeof m.model === 'string') messages.set(m.id || `${m.timestamp}|${messages.size}`, m); };
  const takeAll = o => { if (Array.isArray(o?.messages)) o.messages.forEach(take); if (Array.isArray(o?.$set?.messages)) o.$set.messages.forEach(take); take(o); };
  let whole = null; try { whole = JSON.parse(text); } catch { /* jsonl */ }
  if (whole) takeAll(whole);
  else for (const line of text.split('\n')) { if (!line.includes('"tokens"')) continue; try { takeAll(JSON.parse(line)); } catch { /* 깨진 줄 */ } }
  return [...messages.values()].map(m => {
    const k = m.tokens, input = count(k.input), cached = Math.min(input, count(k.cached));
    return { t: Date.parse(m.timestamp), model: cleanModel(m.model), in: input - cached, out: count(k.output) + count(k.thoughts), cr: cached, cw: 0, rs: k.thoughts };
  });
}

/* ---------- 기록 폴더 ---------- */
// 기록 파일을 알아보는 열쇠. Codex는 옮기거나 압축해도 같은 세션이라 rollout 이름(.zst 뗀 것)으로, 나머지는 경로로.
const codexKey = name => 'gpt:' + path.basename(name).replace(/\.zst$/i, '');
function sourceRoots({ home, env, claudeDirs = [] }) {
  const claude = [env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'), ...claudeDirs].filter(Boolean);
  const codex = env.CODEX_HOME || path.join(home, '.codex');
  const codexMatch = n => /^rollout-.+\.jsonl(\.zst)?$/i.test(n);
  const codexSrc = dir => ({ dir, match: codexMatch, key: codexKey, mode: name => (/\.zst$/i.test(name) ? 'zst' : 'lines'), parse: codexLine });
  return {
    claude: [...new Set(claude.map(d => path.resolve(d)))].map(d => ({ dir: path.join(d, 'projects'), match: n => n.endsWith('.jsonl'), key: name => name, mode: () => 'lines', parse: claudeLine, ids: true })),
    gpt: [codexSrc(path.join(codex, 'sessions')), codexSrc(path.join(codex, 'archived_sessions'))],
    grok: [{ dir: path.join(home, '.grok', 'sessions'), match: n => n === 'usage.json', key: name => name, mode: () => 'whole', parse: grokFile }],
  };
}

// 폴더 안 파일을 끝까지 찾는다(심볼릭 링크는 따라가지 않는다). 없으면 빈 목록.
async function listFiles(dir, match, limit = 200000) {
  const out = [], stack = [dir];
  while (stack.length && out.length < limit) {
    const cur = stack.pop();
    let entries; try { entries = await fsp.readdir(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && match(e.name, path.relative(dir, full))) out.push(full);
    }
  }
  return out;
}

// 줄 파일을 offset부터 마지막 줄바꿈까지 읽는다. 아직 쓰는 중인 마지막 조각은 다음 회차에 읽는다.
// onLine은 바이트 조각(읽기 버퍼를 다시 쓰므로 그 자리에서만 쓴다)을 받는다. 덩이를 읽을 때마다 await라 앱의 다른 일이 사이사이 돈다.
// stop: 덩이마다 묻는다. 참이면 그 파일을 버리고 STOPPED로 던진다 — 읽은 몫은 끝까지 읽은 뒤에만 합치니 버려도 숫자가 상하지 않는다
// (0.4.93 검수 F1: 처음 세는 도중 끄면 읽던 큰 파일이 끝날 때까지 끄기가 끝나지 않아 화면 단추가 잠겼다).
const stoppedError = () => Object.assign(new Error('stopped'), { code: 'STOPPED' });
async function readLines(file, from, size, onLine, stop) {
  const handle = await fsp.open(file, 'r');
  try {
    let pos = from, end = from;
    let pieces = [], piecesLen = 0; // 덩이를 넘는 긴 줄의 앞부분(복사본)
    const buf = Buffer.allocUnsafe(CHUNK);
    while (pos < size) {
      if (stop && stop()) throw stoppedError();
      const { bytesRead } = await handle.read(buf, 0, Math.min(CHUNK, size - pos), pos);
      if (!bytesRead) break;
      const data = buf.subarray(0, bytesRead);
      pos += bytesRead;
      let at = 0;
      for (let nl = data.indexOf(10, at); nl >= 0; nl = data.indexOf(10, at)) {
        if (piecesLen) { const line = Buffer.concat([...pieces, data.subarray(at, nl)]); pieces = []; piecesLen = 0; if (line.length) onLine(line); }
        else if (nl > at) onLine(data.subarray(at, nl));
        at = nl + 1;
        end = pos - bytesRead + at;
      }
      if (at < bytesRead) { const rest = Buffer.from(data.subarray(at)); pieces.push(rest); piecesLen += rest.length; }
    }
    return end;
  } finally { await handle.close(); }
}
// 압축된 줄 파일(Codex 보관 기록)을 풀어 줄마다 넘긴다. 다 쓴 파일이라 마지막 줄바꿈이 없어도 마지막 줄을 읽는다.
// Electron 44의 Node 24.21에 zstd가 있다(11-15 확인). 없으면 그 파일만 못 읽은 것으로 센다.
const zlib = require('node:zlib');
// 통째로 풀면 큰 세션(수백 MB)에서 줄을 한 번에 도느라 앱이 2.6초까지 멈췄다(11-15 이 PC 실측) — 흘려 풀며 덩이마다 줄을 넘긴다.
async function readZstLines(file, onLine, stop) {
  if (typeof zlib.createZstdDecompress !== 'function') throw Object.assign(new Error('zstd unavailable'), { code: 'NO_ZSTD' });
  // pipe()는 읽기 쪽 오류(잠김 · 지워짐)를 넘기지 않아 본체가 처리 안 된 오류로 멈출 수 있다 — pipeline으로 이어 어느 쪽 오류든 이 반복에서 던지고 둘 다 닫는다(검수 지적).
  const stream = require('node:stream').pipeline(fs.createReadStream(file), zlib.createZstdDecompress(), () => {});
  let pieces = [];
  for await (const data of stream) {
    // 반복을 던져 나가면 흐름도 닫힌다.
    if (stop && stop()) throw stoppedError();
    let at = 0;
    for (let nl = data.indexOf(10, at); nl >= 0; nl = data.indexOf(10, at)) {
      const line = pieces.length ? Buffer.concat([...pieces, data.subarray(at, nl)]) : data.subarray(at, nl);
      pieces = [];
      if (line.length) onLine(line);
      at = nl + 1;
    }
    if (at < data.length) pieces.push(Buffer.from(data.subarray(at)));
    // 덩이 사이에 앱의 다른 일이 돌게 한 번 쉰다.
    await new Promise(resolve => setImmediate(resolve));
  }
  if (pieces.length) { const line = Buffer.concat(pieces); if (line.length) onLine(line); }
}

/* ---------- 칸 더하기 ---------- */
const mergeAgg = (to, from) => { for (const [key, cell] of Object.entries(from || {})) { const t = to[key] || (to[key] = [0, 0, 0, 0, 0, 0]); for (let i = 0; i < 6; i++) t[i] += cell[i]; } return to; };
// 파일 하나가 화면에 내는 칸들: Codex는 응답 기록(agg)과, 그 파일에 응답 기록이 처음 나오기 전까지의 token_count 사건(alt)을 함께 센다.
// 옛 판으로 쓴 세션을 새 판으로 이어 쓰면 앞 응답은 사건으로만, 뒤 응답은 둘 다로 적힌다 — 뒤쪽 사건은 읽을 때 빼서 겹치지 않는다(검수 지적: 이어 쓴 앞 숫자가 빠졌다).
const fileAggs = f => (f.service === 'gpt' ? [f.agg, f.alt] : [f.agg]).filter(Boolean);

/* ---------- 본체 ---------- */
// root: 이 PC 앱 데이터 폴더(AiSubscriptions). claudeDirs: 계정판이 연결한 Claude 계정 설정 폴더들(함수 — 그때그때 읽는다).
// 저장 파일(token-usage.json): files[열쇠] = { service, path, mode, size, mtime, offset, agg, alt?, rec?, st?, ids?(Claude 응답 id 수 묶음), gone?(못 본 날) },
//  goneAgg = 원래 파일이 지워진 지 40일이 지난 파일들의 숫자 합. 대화 글은 들어가지 않는다.
// liveTiming: 실시간 지켜보기의 시간(시험이 줄여 쓴다) — { lease, settle, maxWait, save }.
function createTokenUsage({ root, home, env = process.env, now = () => Date.now(), claudeDirs = () => [], onChange = () => {}, epoch = Date.now(), liveTiming = {} } = {}) {
  if (!root) throw new TypeError('root is required');
  home = home || env.USERPROFILE || env.HOME || '';
  const file = path.join(root, 'token-usage.json');
  const timing = { lease: LIVE_LEASE, settle: LIVE_SETTLE, maxWait: LIVE_MAX_WAIT, save: LIVE_SAVE, ...liveTiming };
  let data = null, scanning = null, progress = null, lastError = null, stopping = false, disabling = false, stateSeq = 0;
  // tracker: 알림 모으기(지켜보기 · 바뀐 파일 목록 · 실시간 동안의 응답 id 주인표), liveUntil: 화면이 실시간을 부탁한 기한,
  // flushing: 목록의 파일을 읽는 중의 약속, liveAt: 실시간으로 마지막으로 더한 때.
  let tracker = null, liveUntil = 0, flushing = null, liveAt = null, saveTimer = null, enabling = Promise.resolve();
  const dirsNow = () => { try { return claudeDirs() || []; } catch { return []; } };
  const empty = () => ({ enabled: false, scannedAt: null, enabledAt: null, files: {}, goneAgg: {}, tools: {}, failed: 0 });

  function load() {
    if (data) return data;
    try {
      const o = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (o?.schemaVersion === SCHEMA && o.files && typeof o.files === 'object') data = { ...empty(), enabled: o.enabled === true, scannedAt: Number(o.scannedAt) || null, enabledAt: Number(o.enabledAt) || null, files: o.files, goneAgg: o.goneAgg || {}, tools: o.tools || {}, failed: Number(o.failed) || 0 };
      // 옛 판(schema 1)의 숫자는 Codex를 덜 세고 Claude를 겹쳐 셌다 — 켠 상태만 잇고 처음부터 다시 센다.
      else if (o?.enabled === true) data = { ...empty(), enabled: true, enabledAt: Number(o.enabledAt) || null };
    } catch { /* 처음 */ }
    if (!data) data = empty();
    // 저장하다 앱이 꺼져 남은 임시 파일을 치운다.
    try { for (const n of fs.readdirSync(root)) if (n.startsWith('token-usage.json.') && n.endsWith('.tmp')) fs.rmSync(path.join(root, n), { force: true }); } catch { /* 폴더 없음 */ }
    return data;
  }
  // 저장은 바뀐 것이 있을 때만, 비동기로(직렬화만 그 자리에서). 같은 때 두 번 쓰지 않게 차례로.
  let saving = Promise.resolve(), saveSeq = 0;
  function persist() {
    const d = load();
    const text = JSON.stringify({ schemaVersion: SCHEMA, kind: 'synk-token-usage', ...d });
    const tmp = `${file}.${process.pid}.${++saveSeq}.tmp`;
    saving = saving.catch(() => {}).then(async () => {
      await fsp.mkdir(root, { recursive: true });
      await fsp.writeFile(tmp, text);
      await fsp.rename(tmp, file);
    });
    return saving;
  }

  // 못 본 지 40일이 지난 파일은 숫자만 goneAgg에 합치고 항목을 지운다. 오래된 날(400일)은 버린다.
  function prune(d, at) {
    const oldest = dayKey(at - KEEP_DAYS * DAY), goneBefore = dayKey(at - GONE_KEEP);
    let n = 0;
    for (const [key, f] of Object.entries(d.files)) {
      if (f.gone && f.gone < goneBefore) { for (const agg of fileAggs(f)) mergeAgg(d.goneAgg, agg); delete d.files[key]; n++; continue; }
      for (const agg of [f.agg, f.alt]) for (const k of Object.keys(agg || {})) if (k.slice(0, 10) < oldest) { delete agg[k]; n++; }
    }
    for (const k of Object.keys(d.goneAgg)) if (k.slice(0, 10) < oldest) { delete d.goneAgg[k]; n++; }
    return n;
  }

  // 파일 하나. owners: 이번 회차의 Claude 응답 id 수 → 그것을 센 파일 열쇠(파일을 가로질러 한 번만 세기).
  async function scanFile(job, stat, d, owners, claimed) {
    const { service, src, name, key } = job, mode = src.mode(name);
    const prev = d.files[key];
    const same = prev && prev.service === service && prev.size === stat.size && prev.mtime === stat.mtimeMs;
    if (same) { prev.path = name; if (prev.gone) delete prev.gone; return false; }
    if (mode === 'whole') {
      const text = await fsp.readFile(name, 'utf8');
      const agg = {};
      // Grok은 회차 한 줄에 응답 여럿(modelCalls)이 모여 있다 — 응답 수는 그만큼 센다.
      for (const use of src.parse(text)) if (Number.isFinite(use.t)) addUse(agg, service, { ...use, n: Math.max(1, count(use.calls)) });
      d.files[key] = { service, path: name, mode, size: stat.size, mtime: stat.mtimeMs, agg };
      return true;
    }
    // 줄 파일: 앞 회차에 읽은 자리에서 잇는다. 파일이 줄었거나(새로 쓴 파일) 압축본으로 바뀌었으면 처음부터.
    // 이번에 읽은 몫은 따로 모아 끝까지 읽은 뒤에만 합친다 — 읽다 멈춘 파일(잠김 · 지워짐)의 앞부분이 다음 회차에 두 번 세지지 않게.
    const known = !!prev && prev.service === service;
    const resume = known && mode === 'lines' && prev.mode !== 'zst' && stat.size >= (prev.offset || 0);
    // Claude 파일이 줄었거나 바뀌었으면 앞에서 센 숫자와 응답 id는 그대로 두고 처음부터 읽으며 새 응답만 더한다.
    // 제 응답 id를 놓아주면 같은 응답을 가진 다른 파일(바뀌지 않아 다시 읽히지 않는다)의 몫이 빠진다.
    const keep = known && !resume && !!src.ids;
    const f = resume || keep ? prev : { service, offset: 0, agg: {}, st: {} };
    const ownIds = src.ids && known ? unpackIds(prev.ids) : [];
    const recent = Array.isArray(f.st?.recent) ? f.st.recent.filter(r => r && typeof r.id === 'string').slice(-RECENT_IDS).map(({ ci, ...r }) => r) : [];
    const st = { recent, seen: new Map(), model: f.st?.model || null, total: Number.isFinite(f.st?.total) ? f.st.total : null, prev: f.st?.prev || null, rec: !!f.rec, owners: src.ids ? owners : null, claimed: src.ids ? claimed : null, file: key, mine: [] };
    const add = {}, alt = {};
    // Codex: 응답 기록(token_usage_record)이 한 번 나온 뒤의 token_count 사건은 같은 응답을 또 적은 것이라 세지 않는다
    // (새 판은 응답마다 기록을 먼저, 사건을 뒤에 적는다 — 11-15 이 PC 기록).
    const onLine = line => { const use = src.parse(line, st); if (!use || !Number.isFinite(use.t)) return; if (use.alt && st.rec) return; addUse(use.alt ? alt : add, service, use); };
    let offset;
    const stop = () => stopping;
    try {
      if (mode === 'zst') { await readZstLines(name, onLine, stop); offset = stat.size; }
      else offset = await readLines(name, resume ? f.offset || 0 : 0, stat.size, onLine, stop);
    } catch (error) { for (const h of st.mine) if (owners.get(h) === key) owners.delete(h); throw error; }
    mergeAgg(f.agg, add);
    if (Object.keys(alt).length) mergeAgg(f.alt || (f.alt = {}), alt);
    if (st.rec) f.rec = true;
    if (src.ids) f.ids = packIds([...ownIds, ...st.mine]);
    Object.assign(f, { service, path: name, mode, offset, size: stat.size, mtime: stat.mtimeMs });
    delete f.gone;
    // 이어 읽기에 필요한 것만 남긴다: Claude는 마지막 응답 몇 개(사흘 안에 바뀐 파일만), Codex는 지금 모델과 앞 누적값.
    f.st = service === 'claude' ? (now() - stat.mtimeMs < RECENT_FRESH ? { recent: st.recent.map(({ ci, ...r }) => r) } : {}) : { model: st.model, total: st.total, prev: st.prev };
    d.files[key] = f;
    return true;
  }

  async function runScan() {
    const d = load();
    if (!d.enabled) return publicState();
    // 알림 모으기를 훑기 전에 연다 — 이 뒤 바뀐 파일은 목록에 모이고, 그 앞은 이 훑기가 센다. 앞서 모인 목록은 이 훑기가 다 읽으니 비운다.
    startTracking().dirty.clear();
    const roots = sourceRoots({ home, env, claudeDirs: dirsNow() });
    const tools = {}, byKey = new Map();
    for (const service of SERVICES) for (const src of roots[service]) {
      for (const name of await listFiles(src.dir, src.match)) {
        const key = src.key(name), was = byKey.get(key);
        // 같은 Codex 세션이 두 곳(옮기는 중 · 압축 전후)에 있으면 이어 읽을 수 있는 압축 안 된 쪽 하나만 센다.
        if (was && !(/\.zst$/i.test(was.name) && !/\.zst$/i.test(name))) continue;
        if (!was) tools[service] = (tools[service] || 0) + 1;
        byKey.set(key, { service, src, name, key });
      }
    }
    const jobs = [...byKey.values()];
    // 찾은 파일 수는 세기 전에 판에 올린다 — 처음 세는 몇 분 동안 화면이 「기록을 찾지 못했어요」로 읽지 않게(검수 지적).
    const tools2 = Object.fromEntries(SERVICES.map(s => [s, tools[s] || 0]));
    const toolsBefore = JSON.stringify(d.tools);
    d.tools = tools2;
    progress = { done: 0, total: jobs.length };
    onChange(publicState());
    // 응답 id 주인표는 세는 동안에만 메모리에 둔다(이 PC 55만 개쯤).
    const owners = new Map(), claimed = claimStore();
    for (const [key, f] of Object.entries(d.files)) if (f.ids) for (const h of unpackIds(f.ids)) owners.set(h, key);
    // 파일 여럿을 함께 읽는다. 조금씩 이어 쓴 기록 파일은 디스크에 조각나 있어, 한 파일씩 읽으면 디스크를 기다리는 시간이 대부분이었다(11-15 이 PC: CPU 16% · 초당 102MB, 6개씩 316MB).
    // 다 읽은 파일은 1분마다 저장해 둔다 — 첫 세기 중에 앱을 꺼도 다음에 그 파일들은 건너뛴다.
    let next = 0, changed = 0, failed = 0, lastTick = Date.now(), lastSave = Date.now();
    const worker = async () => {
      while (next < jobs.length && !stopping) {
        const job = jobs[next++];
        // 끄는 중에 버린 파일은 읽지 못한 파일로 세지 않는다.
        try { const stat = await fsp.stat(job.name); if (await scanFile(job, stat, d, owners, claimed)) changed++; } catch { if (!stopping) failed++; }
        progress.done++;
        // 화면의 진행 수는 0.5초에 한 번만 알린다.
        if (Date.now() - lastTick > 500) { lastTick = Date.now(); onChange(publicState()); }
        if (changed && Date.now() - lastSave > 60e3) { lastSave = Date.now(); persist().catch(() => {}); }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, jobs.length) }, worker));
    if (stopping) { progress = null; return publicState(); }
    // 이번에 못 본 파일: 못 본 날을 적고 이어 읽기용 마지막 응답은 버린다(다시 나타나면 그 자리에서 잇고, 40일 뒤에는 숫자만 남긴다).
    const today = dayKey(now());
    for (const [key, f] of Object.entries(d.files)) if (!byKey.has(key) && !f.gone) { f.gone = today; if (f.st?.recent) delete f.st.recent; changed++; }
    if (JSON.stringify(tools2) !== toolsBefore || failed !== d.failed) changed++;
    d.scannedAt = now();
    d.failed = failed;
    changed += prune(d, d.scannedAt);
    progress = null;
    // 실시간이면 이 회차의 응답 id 주인표를 넘겨준다(저장 파일에서 다시 만들지 않게). 아니면 남아 있던 옛 표를 버린다 —
    // 이 회차가 새로 센 응답이 옛 표에 없어, 다음 실시간에 그 응답의 사본을 한 번 더 셌다(최종 검수 지적).
    if (tracker) tracker.owners = isLive() ? owners : null;
    // 바뀐 것이 없으면 저장하지 않는다(마지막으로 센 때는 다음 저장 때 함께 남는다).
    try { if (changed) await persist(); lastError = null; } catch { lastError = 'SAVE_FAILED'; }
    // 돌려주는 판은 다 센 뒤의 것이다(약속이 풀리기 전이라 scanning이 아직 서 있어도 「세는 중」으로 내지 않는다).
    return { ...publicState(), scanning: false, changed, failed };
  }

  // force가 아니면 마지막으로 센 지 maxAge가 지났을 때만 센다. 세는 중이면 그 약속을 돌려준다.
  // 알림을 모으는 중에는 바뀐 파일이 목록에 있으니, 다 훑는 세기는 놓친 알림을 메우는 만큼만(15분) 한다.
  function scan({ force = false, maxAge = 5 * 60e3 } = {}) {
    const d = load();
    if (!d.enabled || disabling) return Promise.resolve(publicState());
    if (scanning) return scanning;
    const age = tracker ? Math.max(maxAge, LIVE_SAFETY) : maxAge;
    if (!force && d.scannedAt && now() - d.scannedAt < age) return Promise.resolve(publicState());
    // 알림 온 파일을 읽는 중이면 그것이 끝난 뒤에 훑는다(같은 파일을 두 곳에서 이어 읽어 두 번 더하지 않게).
    scanning = Promise.resolve(flushing).then(() => runScan()).catch(() => { lastError = 'SCAN_FAILED'; progress = null; return publicState(); }).finally(() => { scanning = null; onChange(publicState()); if (tracker?.dirty.size && isLive()) settleLive(tracker); });
    onChange(publicState());
    return scanning;
  }

  /* ---------- 실시간 지켜보기 ---------- */
  // 둘로 나눈다(11-16 검수 지적: 창을 내렸다 올리면 그 사이 바뀐 기록을 15분 동안 읽지 않았고, 나중에 생긴 기록 폴더는 지켜보지 않았다).
  //  · 알림 모으기(tracker): 다 훑는 세기가 시작할 때 열고, 켜 둔 동안 계속 둔다. 기록 폴더마다 운영체제의 지켜보기 하나(fs.watch recursive)와 바뀐 파일 목록뿐이다.
  //    세기가 그 앞을 세고 그 뒤 바뀐 파일은 모두 목록에 모이므로, 목록만 읽으면 숫자가 빠지지 않는다. 30초마다 없던 기록 폴더를 다시 찾아 연다.
  //  · 실시간(live): 화면이 1분마다 live(true)로 부탁하는 동안(3분 동안 부탁이 없으면 내린다)만 목록을 곧바로 읽어(scanFile과 같은 길) 판을 알린다.
  //    응답 id 주인표(이 PC 56만 개 · 40MB)는 실시간 동안만 든다. 화면을 닫은 동안 모인 목록은 다시 열 때 곧바로 읽는다.
  const isLive = () => liveUntil > Date.now();
  function live(on) {
    const d = load();
    if (on !== true || !d.enabled || disabling) {
      if (liveUntil) { liveUntil = 0; if (tracker) tracker.owners = null; onChange(publicState()); }
      return publicState();
    }
    const was = isLive();
    liveUntil = Date.now() + timing.lease;
    // 실시간을 새로 켤 때는 주인표를 저장 파일에서 다시 만든다(기한이 지나 남은 옛 표를 쓰지 않게).
    if (!was && tracker) tracker.owners = null;
    // 이 일꾼에서 아직 다 훑지 않았으면(알림 모으기가 없으면) 지금 훑는다 — 훑기가 시작할 때 알림 모으기를 연다.
    if (!tracker) void scan({ force: true });
    else if (tracker.dirty.size) settleLive(tracker);
    if (!was) onChange(publicState());
    return publicState();
  }
  function startTracking() {
    if (tracker) return tracker;
    // ids: 지켜보기를 열 때 그 폴더의 파일 번호(지워졌다 다시 생긴 폴더를 알아본다).
    const T = { watchers: new Map(), ids: new Map(), dirty: new Map(), timer: null, firstAt: 0, owners: null, check: null };
    tracker = T;
    attachRoots(T, false);
    T.check = setInterval(() => tick(T), Math.max(20, Math.min(30e3, Math.round(timing.lease / 3))));
    T.check.unref?.();
    return T;
  }
  // 기록 폴더마다 지켜보기를 연다. 나중에 연 폴더(처음 쓰는 도구 · 새로 연결한 Claude 계정 · 지워졌다 다시 생긴 폴더)는
  // 그 폴더의 기록 파일을 모두 목록에 넣는다 — 열기 전에 적힌 응답을 놓치지 않게(이미 센 파일은 크기와 수정 시각이 같아 열지 않는다).
  function attachRoots(T, late) {
    const roots = sourceRoots({ home, env, claudeDirs: dirsNow() });
    for (const service of SERVICES) for (const src of roots[service]) {
      if (T.watchers.has(src.dir)) continue;
      let w;
      try {
        w = fs.watch(src.dir, { recursive: true, persistent: false }, (type, rel) => {
          // Windows: 지켜보던 폴더가 지워지면 그 폴더 경로(절대 경로)로 「rename」 알림이 끝없이 와 일꾼이 쉬지 못한다(11-16 이 PC: 6초에 64MB).
          // 계정판에서 Claude 계정을 지우면 그 폴더가 지워진다. 그 표시가 보이면 바로 닫고, 다시 생기면 30초 확인에서 연다.
          if (type === 'rename' && rel && (path.isAbsolute(String(rel)) || !fs.existsSync(src.dir))) return void drop(T, src.dir, w);
          if (rel) noticed(T, service, src, String(rel));
        });
      } catch { continue; } // 아직 없는 폴더
      w.on('error', () => drop(T, src.dir, w));
      T.watchers.set(src.dir, w); T.ids.set(src.dir, folderId(src.dir));
      if (late) void listFiles(src.dir, src.match).then(names => { for (const name of names) noticed(T, service, src, path.relative(src.dir, name)); }, () => {});
    }
  }
  function folderId(dir) { try { const st = fs.statSync(dir); return st.isDirectory() ? `${st.ino}:${st.birthtimeMs}` : null; } catch { return null; } }
  function drop(T, dir, w) {
    try { w.close(); } catch { /* 이미 닫힘 */ }
    if (T.watchers.get(dir) === w) { T.watchers.delete(dir); T.ids.delete(dir); }
  }
  function tick(T) {
    if (tracker !== T) return;
    // 지켜보는 폴더가 없어졌거나 같은 이름으로 새로 생겼으면(파일 번호가 다르면) 옛 지켜보기를 닫는다 — 지워질 때의 알림을 놓쳐도(바쁠 때)
    // 옛 폴더를 쥔 채 새 폴더의 알림을 영영 못 받지 않게. 아래 attachRoots가 다시 열고 안의 파일을 목록에 넣는다.
    for (const [dir, w] of [...T.watchers]) if (folderId(dir) !== T.ids.get(dir)) drop(T, dir, w);
    attachRoots(T, true);
    // 화면의 부탁이 끊기면 실시간만 내린다(알림은 계속 모은다).
    if (liveUntil && !isLive()) { liveUntil = 0; T.owners = null; onChange(publicState()); }
  }
  function stopTracking() {
    const T = tracker;
    if (!T) return false;
    tracker = null;
    clearTimeout(T.timer); clearInterval(T.check);
    for (const w of T.watchers.values()) { try { w.close(); } catch { /* 이미 닫힘 */ } }
    T.watchers.clear(); T.ids.clear(); T.dirty.clear(); T.owners = null;
    return true;
  }
  // 알림: 기록 파일이면 목록에 넣고, 실시간이면 알림이 멎은 뒤(또는 1.5초마다) 읽는다.
  function noticed(T, service, src, rel) {
    if (tracker !== T) return;
    const name = path.join(src.dir, rel);
    if (!src.match(path.basename(name), rel)) return;
    const key = src.key(name);
    T.dirty.set(key, { service, src, name, key });
    if (isLive()) settleLive(T);
  }
  function settleLive(T) {
    if (!T.firstAt) T.firstAt = Date.now();
    clearTimeout(T.timer);
    T.timer = setTimeout(() => flushLive(T), Math.max(0, Math.min(timing.settle, T.firstAt + timing.maxWait - Date.now())));
    T.timer.unref?.();
  }
  function flushLive(T) {
    if (tracker !== T) return;
    T.timer = null;
    if (!isLive()) { T.firstAt = 0; return; } // 화면이 닫혔다 — 목록은 다시 열 때 읽는다.
    // 다 훑는 세기나 앞 읽기가 도는 중이면 그것이 끝난 뒤에 읽는다(끝날 때 다시 부른다).
    if (scanning || flushing) return;
    const d = load();
    if (!d.enabled || disabling || !T.dirty.size) return;
    T.firstAt = 0;
    const jobs = [...T.dirty.values()];
    T.dirty.clear();
    flushing = (async () => {
      // 응답 id 주인표: 실시간을 켠 뒤 처음 읽을 때 저장 파일에서 한 번 만든다. 다 훑는 세기가 끝나면 그 회차의 표로 바뀐다.
      if (!T.owners) { const owners = new Map(); for (const [key, f] of Object.entries(d.files)) if (f.ids) for (const h of unpackIds(f.ids)) owners.set(h, key); T.owners = owners; }
      const owners = T.owners, claimed = claimStore();
      let changed = 0;
      for (const job of jobs) {
        if (stopping || tracker !== T) break;
        let stat = null;
        try {
          stat = await fsp.stat(job.name);
          if (!stat.isFile()) continue;
          const isNew = !d.files[job.key];
          if (await scanFile(job, stat, d, owners, claimed)) { changed++; if (isNew) d.tools[job.service] = (d.tools[job.service] || 0) + 1; }
        } catch {
          // 파일은 있는데 읽기만 실패했으면(다른 프로그램이 잠깐 잡음 · 백신 검사) 목록에 되돌려 두 번까지 다시 읽는다 —
          // 세션의 마지막 응답이면 다음 알림이 오지 않아 15분 세기까지 빠져 있었다(최종 검수 지적). 지워진 파일은 다시 세기가 다룬다.
          const tries = (job.tries || 0) + 1;
          if (stat && tries <= 2 && !stopping && !T.dirty.has(job.key)) T.dirty.set(job.key, { ...job, tries });
        }
      }
      if (changed && !stopping) { liveAt = now(); saveSoon(); onChange(publicState()); }
    })().catch(() => {}).finally(() => { flushing = null; if (tracker?.dirty.size && isLive()) settleLive(tracker); });
  }
  // 실시간으로 더한 숫자는 30초에 한 번 저장한다.
  function saveSoon() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => { saveTimer = null; if (load().enabled && !disabling) persist().catch(() => { /* 다음 저장이나 다시 세기에서 */ }); }, timing.save);
    saveTimer.unref?.();
  }

  // 화면에 넘길 판: 최근 SHOW_DAYS일의 날짜 · 도구 · 모델 칸(파일을 가로질러 합친 것).
  function cells(at = now()) {
    const d = load(), from = dayKey(at - (SHOW_DAYS - 1) * DAY), merged = {};
    const take = agg => { for (const [key, cell] of Object.entries(agg)) if (key.slice(0, 10) >= from) { const m = merged[key] || (merged[key] = [0, 0, 0, 0, 0, 0]); for (let i = 0; i < 6; i++) m[i] += cell[i]; } };
    for (const f of Object.values(d.files)) for (const agg of fileAggs(f)) take(agg);
    take(d.goneAgg);
    return Object.entries(merged).map(([key, cell]) => { const [day, service, ...rest] = key.split('|'); return [day, service, rest.join('|'), ...cell]; }).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : b[4] - a[4]));
  }
  // 도구마다 가장 이른 기록 날(화면이 「GPT 기록은 n일부터」를 도구마다 말한다).
  function sinceBy() {
    const d = load(), first = {};
    const take = agg => { for (const key of Object.keys(agg)) { const day = key.slice(0, 10), service = key.slice(11, key.indexOf('|', 11)); if (!first[service] || day < first[service]) first[service] = day; } };
    for (const f of Object.values(d.files)) for (const agg of fileAggs(f)) take(agg);
    take(d.goneAgg);
    return first;
  }
  // 판마다 순서 번호를 붙인다(epoch: 이 본체의 세대 — 일꾼은 감싸개가 띄울 때마다 늘리는 번호, 직접 만들면 만든 때 · seq: 판을 낸 차례). 알림과 응답은 화면에 따로 닿아 순서가 바뀔 수 있어
  // 화면이 늦게 온 옛 판(「세는 중」)으로 새 판(다 셈)을 덮지 않게 한다(최종 검수 지적).
  function publicState() {
    const d = load(), order = { epoch, seq: ++stateSeq };
    if (!d.enabled) return { ok: true, enabled: false, ...order };
    const by = sinceBy(), days = Object.values(by).sort();
    // live: 화면이 실시간을 부탁했고 지켜보는 기록 폴더가 하나라도 있는지(폴더가 하나도 없으면 「실시간」이라 하지 않는다 — 검수 지적),
    // liveAt: 실시간으로 마지막으로 더한 때(화면의 「마지막으로 센 때」는 scannedAt과 이것 중 늦은 것).
    return { ok: true, enabled: true, ...order, scanning: !!scanning || !!progress, progress: progress ? { ...progress } : null, scannedAt: d.scannedAt, enabledAt: d.enabledAt, live: isLive() && tracker?.watchers.size > 0, liveAt, since: days[0] || null, sinceBy: by, tools: Object.fromEntries(SERVICES.map(service => [service, d.tools[service] || 0])), failed: d.failed || 0, error: lastError, fields: FIELDS, cells: cells() };
  }

  // 켜기 · 끄기는 차례로 한다 — 끄는 동안(읽던 파일을 그만 읽기를 기다리는 동안) 온 켜기가 끄기에 묻히지 않게(0.4.93 검수 B1).
  function setEnabled(on) {
    const run = enabling.then(() => setEnabledNow(on));
    enabling = run.catch(() => {});
    return run;
  }
  // 켜기 · 끄기. 끄면 모은 숫자와 읽은 자리를 모두 지운다(다시 켜면 처음부터 다시 센다).
  async function setEnabledNow(on) {
    const d = load();
    if (on === true) {
      if (!d.enabled) { d.enabled = true; d.enabledAt = now(); d.scannedAt = null; try { await persist(); } catch { d.enabled = false; return { ok: false, code: 'SAVE_FAILED' }; } }
      void scan({ force: true });
      return publicState();
    }
    // 세는 중이면 남은 파일을 그만 읽게 하고 끝나기를 기다린 뒤 지운다.
    // 기다리는 동안 1분 · 2분 타이머가 새로 세기를 시작하지 않게, 켜짐을 먼저 내리고 끄는 중 표시를 세운다(검수 지적).
    d.enabled = false;
    disabling = true; stopping = true;
    // 알림 모으기를 먼저 닫는다(끄는 동안 알림이 새로 읽기를 시작하지 않게). 읽던 파일은 덩이 사이에서 그만 읽는다(stopping).
    stopTracking(); liveUntil = 0;
    clearTimeout(saveTimer); saveTimer = null;
    let removed = false;
    try {
      if (scanning) await scanning.catch(() => {});
      if (flushing) await flushing;
      await saving.catch(() => {});
      // 지우지 못하면(잠김 · 권한) 빈 꺼짐 판으로 덮는다. 그것도 못 하면 실패로 알린다 — 지운 것처럼 말하고 다음 실행에 다시 켜지지 않게(검수 지적).
      try { fs.rmSync(file, { force: true }); removed = true; } catch {
        try { fs.writeFileSync(file, JSON.stringify({ schemaVersion: SCHEMA, kind: 'synk-token-usage', ...empty() })); removed = true; } catch { /* 아래에서 알린다 */ }
      }
      // 둘 다 못 했으면 켜진 채로 둔다(화면도 켜짐 판으로 돌아가 다시 끌 수 있다).
      if (removed) { data = empty(); liveAt = null; } else d.enabled = true;
    } finally { stopping = false; disabling = false; }
    onChange(publicState());
    return removed ? publicState() : { ok: false, code: 'DELETE_FAILED' };
  }

  return {
    state: publicState,
    scan,
    // 앱이 켜져 있는 동안 뒤에서(본체의 2분 틱): 켜져 있고 마지막으로 센 지 3시간이 지났을 때만.
    auto: () => (load().enabled ? scan({ maxAge: AUTO_EVERY }) : Promise.resolve(publicState())),
    setEnabled,
    // 실시간 지켜보기: 화면이 열려 있는 동안 1분마다 live(true), 떠나면 live(false). 3분 동안 부탁이 없으면 저절로 멈춘다.
    live,
    cells,
    dispose: () => { stopping = true; stopTracking(); liveUntil = 0; clearTimeout(saveTimer); saveTimer = null; },
  };
}

/* ---------- 일꾼 스레드 ---------- */
// 앱(Electron 주 프로세스)은 세기를 일꾼 스레드에서 돌린다. 첫 세기에 큰 기록(이 PC 68GB)을 읽는 동안 쓰레기 치우기(GC)와 저장 직렬화가
// 주 프로세스를 1초 넘게 멈췄다(11-15 이 PC 실측 최대 1.6초 — 창 끌기와 다른 화면의 요청이 그동안 섰다). 일꾼은 제 힙을 따로 가져 주 프로세스는 서지 않는다.
// 일꾼은 이 파일의 소스를 eval로 띄운다 — 앱 묶음(asar) 안의 파일 경로를 일꾼이 열지 않게. 이 파일은 node 내장 모듈만 쓴다.
// 고르기는 같은 createTokenUsage이고, 여기서는 부르기와 알림만 잇는다. claudeDirs는 함수라 넘길 수 없어 부를 때마다 그때 값을 함께 보낸다.
function createTokenUsageWorker({ root, home, env = process.env, claudeDirs = () => [], onChange = () => {} } = {}) {
  if (!root) throw new TypeError('root is required');
  const { Worker } = require('node:worker_threads');
  const source = fs.readFileSync(__filename, 'utf8');
  const file = path.join(root, 'token-usage.json');
  // 켠 적이 없는 회원(저장 파일 없음)에게는 일꾼을 띄우지 않고 꺼짐을 바로 돌려준다(최종 검수 지적 — 계정판을 쓰는 모든 회원이 스레드를 들고 있었다).
  // 순서 번호 0은 일꾼이 낸 어느 판보다 앞이라, 화면이 이미 받은 판을 이 판으로 덮지 않는다.
  const OFF = { ok: true, enabled: false, epoch: 0, seq: 0 };
  const STOPPED = { ok: false, code: 'TOKENS_WORKER_STOPPED' };
  // generation: 일꾼을 띄울 때마다 늘리는 세대 번호 — 판의 epoch로 쓴다(벽시계는 뒤로 갈 수 있다 — 다시 검수 지적).
  let current = null, seq = 0, closed = false, last = null, generation = 0;
  const newer = (a, b) => !b || a.epoch > b.epoch || (a.epoch === b.epoch && a.seq >= b.seq);
  const keep = state => { if (state?.ok && state.epoch && newer(state, last)) last = state; };
  const dirs = () => { try { return (claudeDirs() || []).filter(d => typeof d === 'string'); } catch { return []; } };
  // 일꾼마다 제 기다림 목록을 가진다 — 내린 일꾼이 늦게 끝나도 새 일꾼의 부르기를 건드리지 않게.
  function start() {
    if (current) return current;
    const run = { worker: new Worker(source, { eval: true, workerData: { synkTokenWorker: true, root, home, env: { ...env }, epoch: ++generation } }), waits: new Map(), retiring: false };
    run.worker.unref();
    run.worker.on('message', m => {
      // 마지막 판은 더 새 판일 때만 바꾼다(늦게 닿은 「세는 중」 응답이 끝 알림을 덮지 않게 — 다시 검수 지적).
      if (m?.type === 'change') { keep(m.state); try { onChange(m.state); } catch { /* 화면 쪽 실패는 세기와 상관없다 */ } return; }
      keep(m?.result);
      const w = run.waits.get(m?.id);
      if (w) { run.waits.delete(m.id); w(m.result); }
    });
    // 일꾼이 죽으면 기다리던 부르기는 실패로 돌려주고, 다음 부르기에서 새로 띄운다(저장 파일은 다 쓴 뒤에만 바꿔 끼워 앞 판이 남는다).
    run.worker.on('error', () => {});
    run.worker.on('exit', () => {
      for (const w of run.waits.values()) w({ ...STOPPED });
      run.waits.clear();
      if (current !== run) return;
      current = null;
      // 세는 도중 일꾼이 죽으면 화면이 「세는 중」에 머물지 않게 멈춘 판을 알린다(다음 부르기에서 새 일꾼이 저장 파일부터 잇는다).
      // 지켜보던 중이면 「실시간」 표시도 내린다(화면의 다음 부탁이 새 일꾼에서 다시 지켜본다).
      if (!closed && !run.retiring && last?.enabled && (last.scanning || last.live)) { last = { ...last, scanning: false, progress: null, live: false, error: last.scanning ? 'SCAN_FAILED' : last.error, seq: last.seq + 1 }; try { onChange(last); } catch { /* 화면 쪽 실패 */ } }
    });
    current = run;
    return run;
  }
  const call = (method, args) => new Promise(resolve => {
    if (closed) return resolve({ ...STOPPED });
    if (!(method === 'setEnabled' && args === true) && !current && !fs.existsSync(file)) return resolve({ ...OFF });
    const id = ++seq;
    let run;
    try { run = start(); run.waits.set(id, resolve); run.worker.postMessage({ id, method, args, claudeDirs: dirs() }); }
    catch { run?.waits.delete(id); resolve({ ...STOPPED }); }
  });
  // 끈 뒤에는 일꾼을 내린다(저장 파일이 없으니 다시 켤 때까지 띄우지 않는다).
  const retire = () => { const run = current; if (!run) return; current = null; run.retiring = true; void run.worker.terminate(); };
  let want = null; // 마지막으로 부탁받은 켜기(true) · 끄기(false)
  return {
    state: () => call('state'),
    scan: options => call('scan', options),
    auto: () => call('auto'),
    // 끄기가 끝나는 사이 다시 켜 달라는 부탁이 왔거나 일꾼에 다른 부르기가 남아 있으면 일꾼을 내리지 않는다(0.4.93 검수 B1 — 내리면 그 켜기가 풀렸다).
    setEnabled: async on => { want = on === true; const r = await call('setEnabled', want); if (on !== true && r?.ok && want === false && !current?.waits.size) retire(); return r; },
    live: on => call('live', on === true),
    dispose: () => { closed = true; retire(); },
    // 시험용: 일꾼이 세다 죽은 경우를 만든다.
    __crashForTest: () => current?.worker.terminate(),
  };
}

// 일꾼 쪽: 같은 본체를 만들고 부르기를 받아 답한다.
(function workerSide() {
  let wt;
  try { wt = require('node:worker_threads'); } catch { return; }
  if (wt.isMainThread || !wt.workerData?.synkTokenWorker) return;
  const { root, home, env, epoch } = wt.workerData;
  let dirs = [];
  const usage = createTokenUsage({ root, home, env, epoch, claudeDirs: () => dirs, onChange: state => wt.parentPort.postMessage({ type: 'change', state }) });
  wt.parentPort.on('message', async m => {
    if (Array.isArray(m?.claudeDirs)) dirs = m.claudeDirs;
    let result;
    try {
      if (m.method === 'state') result = usage.state();
      else if (m.method === 'scan') result = await usage.scan(m.args || {});
      else if (m.method === 'auto') result = await usage.auto();
      else if (m.method === 'setEnabled') result = await usage.setEnabled(m.args === true);
      else if (m.method === 'live') result = usage.live(m.args === true);
      else result = { ok: false, code: 'UNKNOWN_CALL' };
    } catch { result = { ok: false, code: 'SCAN_FAILED' }; }
    wt.parentPort.postMessage({ type: 'reply', id: m.id, result });
  });
})();

module.exports = { createTokenUsage, createTokenUsageWorker, claudeLine, codexLine, grokFile, geminiFile, addUse, dayKey, sourceRoots, readLines, readZstLines, idHash, codexKey, FIELDS, SERVICES };
