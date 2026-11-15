#!/usr/bin/env node
'use strict';
/**
 * 계정 통계 루틴 — AI 없이 하루 두 번(작업 스케줄러 09:20·21:20, tools/계정통계예약) 도는 수집 입구.
 *   node tools/계정통계루틴.cjs                 미리 보기: 설정·카탈로그 대조·수신함 상태만 본다(네트워크·파일 변경 없음)
 *   node tools/계정통계루틴.cjs --수집미리보기  공개 텔레그램 쪽을 읽고 세기만 한다(쓰기·제출 없음)
 *   node tools/계정통계루틴.cjs --실행          새로 읽어 증거·매니페스트를 새 파일로 쓰고 공식 수집기로 넣는다
 * 상태는 저장소 밖 ~/.synk/account-metrics(config.json · inbox/ · runs/ · logs/ · receipts/). 비밀번호·쿠키·토큰은 읽지 않는다.
 * 텔레그램은 https://t.me/s/<채널> HTML만 Node fetch로 받는다. 실제 브라우저는 쓰지 않는다(웹 스크립트가 우리 조회를 셀 수 있음).
 * 공식 내보내기(official-export 묶음만)는 inbox 바로 아래 *.manifest.json과 그 증거를 회차 폴더에 새 파일로 떠서(목록 때 읽은 바이트와 같은지 확인)
 * 그 사본을 tools/계정통계수집.cjs --입력 <사본> --실행 으로 넘긴다. 원본은 지우거나 고치지 않고, 같은 일인지는 이름·시각이 아니라 내용 해시로 가린다.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const STATE_DIR = path.join(os.homedir(), '.synk', 'account-metrics');
const CATALOG_MODULE = path.join(ROOT, 'docs', '마케팅', '온라인마케팅지도', 'engagement', 'company', 'account-catalog.mjs');
const INGESTER = path.join(ROOT, 'tools', '계정통계수집.cjs');
const LIMITS = Object.freeze({ timeoutMs: 15000, maxPages: 15, pageBytes: 2 * 1024 * 1024, batch: 200, inboxFiles: 20,
  rawBytes: 10 * 1024 * 1024 - 1, ingestMs: 120000, budgetMs: 15 * 60000, telegram: 2 });
const HANDLE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
const ISO = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/;
const SKIP = new Set(['script', 'style', 'template', 'noscript']);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const telegramUrl = (handle, before = null) => `https://t.me/s/${handle}${before === null ? '' : `?before=${before}`}`;
const isInside = (base, p) => { const rel = path.relative(base, p); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };
// 로그 가림. 기록 하나(오류 메시지 하나, 또는 수집기 출력의 한 갈래)를 통째로 보고 두 길 중 하나로 낸다.
// 전체가 유효한 JSON이면 JSON.parse로 읽은 값을 새 나무로 옮겨 다시 직렬화한다. 원문을 잘라 붙이지 않으므로 이스케이프, 중복 키,
// 문자열 안의 줄 끝(U+2028·U+2029 포함)이 가림 경계를 흔들지 못한다. 민감한 이름의 키는 값의 형식과 상관없이 값을 '[가림]'으로 바꾼다.
// 다른 문자열 값은 안에 객체나 배열 JSON이 있으면 같은 규칙으로 다시 쓰고, 아니면 표식이 있을 때 그 값만 가린다. 키 자체에 비밀 꼴이 있으면 기록 전체를 가린다.
// JSON이 아니면 원문과, 역슬래시 이스케이프(\uXXXX·\xXX와 JSON 한 글자 이스케이프)를 한 겹씩 푼 사본에서 표식(민감한 낱말, Bearer·Basic, JWT 꼴, 주소 안의 사용자 정보)을 찾는다.
// 퍼센트 인코딩(%HH)은 풀지 않는다. 원문이나 푼 단계 어디에서든 %와 16진수 두 자리가 보이면 그 글 전체를 표식이 있는 것으로 본다.
// 표식이 하나라도 있으면 줄 끝까지 포함한 입력 전체를 '[가림]'으로 바꾸고, 없으면 일반 진단으로 보고 그대로 둔다.
// 크기·깊이·노드 수 한도를 넘거나 문자열로 바꾸지 못하면 일부를 잘라 남기지 않고 전체를 '[가림]'으로 낸다. 길이를 자르는 곳은 언제나 가린 뒤에 자른다.
const HIDDEN = '[가림]';
const LOG_LIMITS = Object.freeze({ bytes: 256 * 1024, depth: 40, nodes: 20000, decodeRounds: 3 });
const SENSITIVE_PART = /authorization|cookie|token|secret|passw(?:or)?d|passphrase|credential|api[-_ ]?key|private[-_ ]?key|session|csrf|xsrf|signature/i;
// 짧은 낱말 표식은 camelCase·snake_case·kebab-case와 대문자 약어 뒤 경계로 낱말을 나눈 뒤 낱말 전체가 같을 때만 본다(userPwd·DB_PASS·DBPass·HTTPAuth는 잡고 bypass·basically·OAuth는 잡지 않는다).
const SENSITIVE_WORDS = new Set(['bearer', 'basic', 'pwd', 'pass', 'auth', 'sig']);
const NAME_KEY = /^[A-Za-z0-9_.-]{1,64}$/;
const USERINFO = /\/\/[^\/\s:@]*:[^\/\s@]+@/;
// 이스케이프는 왼쪽부터 한 단위씩 한 겹만 푼다. 역슬래시 두 개는 먼저 역슬래시 하나로 묶이므로, 짝수 개 역슬래시 뒤의 글자는 다음 겹에서 풀린다.
// JSON 한 글자 이스케이프(따옴표, 역슬래시, 빗금, b·f·n·r·t)까지 풀어야 줄바꿈 이스케이프 바로 뒤의 pwd나 빗금을 이스케이프한 주소 같은 표식이 숨지 않는다.
const ESCAPED = /\\(?:u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|(["\\\/bfnrt]))/g;
const SHORT_ESCAPES = { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
const unescapeOnce = t => t.replace(ESCAPED, (_, u, x, c) => (c ? SHORT_ESCAPES[c] || c : String.fromCharCode(parseInt(u || x, 16))));
// %HH를 역슬래시 이스케이프와 함께 풀면 바깥 JSON 이스케이프와 안쪽 주소 인코딩이 한 단계에서 섞여 주소 모양이 깨질 수 있다. 그래서 풀지 않고, 보이기만 하면 가린다.
// 퍼센트 인코딩이 든 진단 주소도 함께 가려지는 손실은 받아들인다. %와 16진수 두 자리가 아닌 보통 퍼센트(95%, 100% 완료)는 그대로 남는다.
const PERCENT_BYTE = /%[0-9a-fA-F]{2}/;
// 낱말은 소문자·숫자 뒤 대문자에서, 그리고 두 글자 이상 대문자 약어와 뒤따르는 대문자+소문자 낱말 사이(DB|Pass, HTTP|Auth)에서 나눈다.
// 대문자 한 글자 뒤(OAuth)는 나누지 않는다. 두 규칙 모두 앞뒤 한두 글자만 보므로 입력 길이에 비례해 끝난다.
const words = t => t.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/(?<=[A-Z])([A-Z])(?=[A-Z][a-z])/g, '$1 ').toLowerCase().split(/[^a-z0-9]+/);
const sensitiveName = t => SENSITIVE_PART.test(t) || words(t).some(w => SENSITIVE_WORDS.has(w));
// JWT 꼴은 eyJ 뒤로 5글자 넘게 이어진 마디 다음에 점과 5글자 넘는 마디가 오는 것이다. 정규식이 되돌아가며 느려지지 않게 낱말과 마디로 나눠 본다.
function jwtLike(t) {
  if (!t.includes('eyJ')) return false;
  for (const word of t.split(/[^A-Za-z0-9_+\/=.-]+/)) {
    const parts = word.split('.');
    for (let i = 0; i + 1 < parts.length; i++) {
      const at = parts[i].indexOf('eyJ');
      if (at !== -1 && parts[i].length - at >= 8 && parts[i + 1].length >= 5) return true;
    }
  }
  return false;
}
// 표식은 원문에서 찾고, 이스케이프를 한 겹씩 풀며 다시 찾는다. 정한 횟수만큼 풀어도 글이 계속 바뀌면 모호하므로 표식이 있는 것으로 본다.
function hasMarker(text) {
  let t = text;
  for (let round = 0; round <= LOG_LIMITS.decodeRounds; round++) {
    if (PERCENT_BYTE.test(t) || sensitiveName(t) || jwtLike(t) || USERINFO.test(t)) return true;
    const next = unescapeOnce(t);
    if (next === t) return false;
    t = next;
  }
  return true;
}
const HIDE_RECORD = Symbol('기록 전체 가림');
// 객체는 프로토타입 없는 새 객체로 옮긴다. 그래서 __proto__ 키도 보통 칸으로 남고 프로토타입을 바꾸지 못한다.
// 깊이와 노드 수는 문자열 안에 든 JSON까지 한 예산으로 센다.
function cleanJson(value, budget, depth) {
  if (++budget.nodes > LOG_LIMITS.nodes || depth > LOG_LIMITS.depth) throw HIDE_RECORD;
  if (typeof value === 'string') return cleanString(value, budget, depth);
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => cleanJson(item, budget, depth + 1));
  const out = Object.create(null);
  for (const key of Object.keys(value)) {
    if (jwtLike(key) || (!NAME_KEY.test(key) && hasMarker(key))) throw HIDE_RECORD;
    out[key] = sensitiveName(key) ? HIDDEN : cleanJson(value[key], budget, depth + 1);
  }
  return out;
}
function cleanString(s, budget, depth) {
  const head = s.trimStart()[0];
  if (head === '{' || head === '[') {
    let inner = null;
    try { inner = JSON.parse(s); } catch { /* 깨진 JSON은 아래에서 보통 문자열로 본다 */ }
    if (inner !== null && typeof inner === 'object') return JSON.stringify(cleanJson(inner, budget, depth + 1));
  }
  return hasMarker(s) ? HIDDEN : s;
}
function sanitize(input) {
  try {
    const text = typeof input === 'string' ? input : String(input);
    if (text.length > LOG_LIMITS.bytes || Buffer.byteLength(text) > LOG_LIMITS.bytes) return HIDDEN;
    let value;
    try { value = JSON.parse(text); } catch { return hasMarker(text) ? HIDDEN : text; }
    const out = JSON.stringify(cleanJson(value, { nodes: 0 }, 0), null, /[\r\n]/.test(text.trim()) ? 2 : undefined);
    return Buffer.byteLength(out) > LOG_LIMITS.bytes ? HIDDEN : out;
  } catch { return HIDDEN; }
}

// 공개 쪽 해석: parse5 DOM 나무만 따라가고 내장 스크립트·스타일 안으로는 들어가지 않는다.
const attr = (n, name) => (n.attrs || []).find(a => a.name === name)?.value;
const hasClass = (n, c) => String(attr(n, 'class') || '').split(/\s+/).includes(c);
function walk(root, visit) {
  const stack = [...(root.childNodes || [])].reverse();
  while (stack.length) {
    const n = stack.pop();
    if (SKIP.has(n.nodeName) || visit(n) === false) continue;
    for (let i = (n.childNodes || []).length - 1; i >= 0; i--) stack.push(n.childNodes[i]);
  }
}
const findAll = (root, pred) => { const out = []; walk(root, n => { if (pred(n)) out.push(n); }); return out; };
const textOf = n => { let s = ''; walk(n, c => { if (c.nodeName === '#text') s += c.value; }); return s.replace(/\s+/g, ' ').trim(); };

function parseViews(raw) {
  const s = String(raw ?? '').trim();
  if (/^[0-9]{1,12}$/.test(s)) return { views: Number(s), note: null };
  if (!s) return { views: null, note: 'missing' };
  return { views: null, note: /^[0-9]+(?:[.,][0-9]+)?\s*[KMB]$/i.test(s) ? 'abbreviated' : 'unrecognized' };
}

function parseMessage(n, handle) {
  const post = attr(n, 'data-post') || '';
  const m = /^([A-Za-z0-9_]{1,64})\/([1-9][0-9]{0,11})$/.exec(post);
  if (!m) return { error: `글 번호 형식이 다름(${post.slice(0, 80)})` };
  const id = Number(m[2]);
  if (m[1] !== handle) return { id, error: `다른 채널 글(${post})` };
  if (hasClass(n, 'service_message') || findAll(n, x => hasClass(x, 'tgme_widget_message_service')).length) return { id, service: true };
  const times = findAll(n, x => hasClass(x, 'tgme_widget_message_date'))
    .flatMap(d => findAll(d, x => x.nodeName === 'time' && attr(x, 'datetime') !== undefined));
  const iso = times.length === 1 ? attr(times[0], 'datetime') : '';
  if (!ISO.test(iso) || !Number.isFinite(Date.parse(iso))) return { id, error: `${post}: 게시 시각이 없거나 형식이 다름` };
  const viewNodes = findAll(n, x => hasClass(x, 'tgme_widget_message_views'));
  const v = viewNodes.length === 1 ? parseViews(textOf(viewNodes[0])) : { views: null, note: viewNodes.length ? 'multiple' : 'missing' };
  const body = findAll(n, x => hasClass(x, 'tgme_widget_message_text'))[0];
  const title = body ? textOf(body).slice(0, 80) : '';
  return { id, row: { id, externalId: String(id), url: `https://t.me/${handle}/${id}`, publishedAt: new Date(iso).toISOString(),
    title: title || null, views: v.views, viewsNote: v.note } };
}

let parse5Promise = null;
// 쪽이 이 채널의 공식 공개 화면인지(채널 확인 표시 @이름 하나·글 목록 구역 하나)와 쪽 넘김 링크의 커서를 함께 본다.
// 커서를 읽지 못한 쪽 넘김 링크, 이 채널의 이전 쪽을 가리키는데 확인되지 않은 링크, 확인 표시가 없는 빈 200 쪽은 오류다.
async function parseTelegramPage(html, handle) {
  const { parse } = await (parse5Promise ||= import('parse5'));
  const page = { rows: [], skipped: [], ids: [], before: null, errors: [] };
  const more = [], owners = [];
  let history = 0;
  const olderLink = href => {
    try { const u = new URL(href, 'https://t.me'); return u.hostname === 't.me' && u.pathname.toLowerCase() === `/s/${handle.toLowerCase()}` && u.searchParams.has('before'); } catch { return false; }
  };
  walk(parse(html), n => {
    if (hasClass(n, 'tgme_channel_history')) history++;
    if (hasClass(n, 'tgme_channel_info_header_username')) owners.push(textOf(n));
    if (n.nodeName === 'a' && hasClass(n, 'tme_messages_more')) { more.push(n); return false; }
    if (n.nodeName === 'a' && olderLink(attr(n, 'href') || '')) { page.errors.push('커서를 확인할 수 없는 이전 쪽 링크가 있음'); return false; }
    if (!hasClass(n, 'tgme_widget_message')) return true;
    const r = parseMessage(n, handle);
    if (r.id !== undefined) page.ids.push(r.id);
    if (r.error) page.errors.push(r.error); else if (r.service) page.skipped.push(r.id); else page.rows.push(r.row);
    return false;
  });
  if (history !== 1) page.errors.push(`글 목록 구역(tgme_channel_history)이 하나가 아님(${history}개)`);
  if (owners.length !== 1 || owners[0].toLowerCase() !== `@${handle}`.toLowerCase()) page.errors.push(`채널 확인 표시가 @${handle} 하나가 아님`);
  const befores = [], afters = [];
  for (const a of more) {
    const b = attr(a, 'data-before'), after = attr(a, 'data-after');
    if (b !== undefined && after === undefined) befores.push(a);
    else if (after !== undefined && b === undefined && /^[1-9][0-9]{0,11}$/.test(after)) afters.push(a);
    else page.errors.push('쪽 넘김 링크의 번호(data-before·data-after)를 하나로 읽을 수 없음');
  }
  if (befores.length > 1) page.errors.push('이전 쪽 링크가 여럿');
  if (afters.length > 1) page.errors.push('다음 쪽 링크가 여럿');
  // 다음 쪽(더 새 글) 링크도 속성의 커서와 주소가 같아야 한다. data-after인데 주소가 이전 쪽(before)·다른 채널·모르는 경로·다른 커서면 끝을 숨길 수 있어 오류다.
  for (const a of afters) {
    const n = attr(a, 'data-after'), href = attr(a, 'href');
    if (href !== `/s/${handle}?after=${n}` && href !== `https://t.me/s/${handle}?after=${n}`) page.errors.push('다음 쪽 링크 주소가 커서와 다름');
  }
  if (befores.length === 1) {
    const b = attr(befores[0], 'data-before'), href = attr(befores[0], 'href');
    if (!/^[1-9][0-9]{0,11}$/.test(b)) page.errors.push('이전 쪽 번호 형식이 다름');
    else if (href !== `/s/${handle}?before=${b}` && href !== `https://t.me/s/${handle}?before=${b}`) page.errors.push('이전 쪽 링크 주소가 커서와 다름');
    else page.before = Number(b);
  }
  return page;
}

async function fetchPage(url, fetchImpl, limits) {
  const res = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(limits.timeoutMs),
    headers: { accept: 'text/html', 'accept-language': 'en', 'user-agent': 'account-metrics-reader/1.0' } });
  if (res.url !== url) throw new Error(`${url}: 최종 주소가 요청 주소와 다름`);
  if (res.status !== 200) throw new Error(`${url}: HTTP ${res.status}`);
  if (!/^text\/html/i.test(res.headers.get('content-type') || '')) throw new Error(`${url}: HTML이 아님`);
  if (Number(res.headers.get('content-length') || 0) > limits.pageBytes) throw new Error(`${url}: 쪽 크기 한도 초과`);
  const reader = res.body.getReader(), chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limits.pageBytes) { await reader.cancel().catch(() => {}); throw new Error(`${url}: 쪽 크기 한도 초과`); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

// 한 계정을 최신 쪽부터 하나씩 읽는다. 끝은 채널 확인 표시가 있는 쪽에 확인된 이전 쪽 링크도, 커서 없는 쪽 넘김 링크도 없고
// (첫 쪽이 아니면) 이전 쪽 요청이 더 오래된 글을 실제로 준 때만 인정한다. 끝을 못 보면 부분 결과를 버린다.
async function scanTelegram(handle, { fetchImpl = fetch, limits = LIMITS, pauseMs = 1000, deadline = Infinity } = {}) {
  if (!HANDLE.test(handle)) throw new Error('채널 이름 형식이 다름');
  const rows = new Map(), skipped = new Set(), pages = [];
  let before = null;
  for (let i = 0; i < limits.maxPages; i++) {
    if (Date.now() > deadline) throw new Error('시간 예산을 넘어 멈춤(부분 결과는 버림)');
    if (i && pauseMs) await sleep(pauseMs);
    const url = telegramUrl(handle, before);
    const buf = await fetchPage(url, fetchImpl, limits);
    const page = await parseTelegramPage(buf.toString('utf8'), handle);
    if (page.errors.length) throw new Error(`${url}: ${page.errors.slice(0, 5).join('; ')}`);
    if (before !== null && page.ids.some(id => id >= before && !rows.has(id) && !skipped.has(id))) throw new Error(`${url}: 이전 쪽 경계(${before})보다 새 글이 섞임`);
    if (before !== null && !page.ids.some(id => id < before)) throw new Error(`${url}: 이전 쪽 요청(before=${before})이 더 오래된 글을 하나도 주지 않아 끝으로 볼 수 없음`);
    if (page.before !== null && (page.before !== Math.min(...page.ids) || (before !== null && page.before >= before))) {
      throw new Error(`${url}: 쪽 넘김 번호(${page.before})가 이 쪽의 가장 오래된 글과 맞지 않음`);
    }
    for (const r of page.rows) if (!rows.has(r.id)) rows.set(r.id, r);
    for (const id of page.skipped) skipped.add(id);
    pages.push({ url, fetchedAt: new Date().toISOString(), bytes: buf.length, sha256: sha256(buf), postIds: page.ids, before: page.before });
    if (page.before === null) {
      return { complete: true, pages, rows: [...rows.values()].sort((a, b) => a.id - b.id), skipped: [...skipped].sort((a, b) => a - b) };
    }
    before = page.before;
  }
  throw new Error(`${limits.maxPages}쪽 안에 끝(더 오래된 링크 없음)을 보지 못해 부분 결과를 버림`);
}

// evidenceSha256은 방금 쓴 증거 파일 바이트의 SHA-256이다. 수집기는 비어 있으면 지금 파일 해시로 채우지 않고 거절한다.
function buildManifest({ accountId, handle, observedAt, evidenceFile, evidenceSha256 = null, rows, batch = LIMITS.batch }) {
  const observations = rows.filter(r => Number.isSafeInteger(r.views)).map(r => ({ kind: 'post-lifetime',
    post: { externalId: r.externalId, url: r.url, publishedAt: r.publishedAt, title: r.title }, metrics: { views: r.views } }));
  // 증거 파일 하나는 묶음 하나에만 쓴다(수집기·서버가 같은 증거 해시의 다음 묶음을 거부함). 넘치면 제출 전에 멈추고 증거만 남긴다.
  if (observations.length > batch) throw new Error(`조회수를 아는 글 ${observations.length}개가 한 묶음 한도 ${batch}개를 넘어 제출하지 않음(증거는 남김)`);
  if (!observations.length) return { version: 1, batches: [] };
  return { version: 1, batches: [{ accountId, evidenceFile, envelope: { sourceType: 'public-page', sourceUrl: telegramUrl(handle), observedAt, evidenceSha256,
    identity: { accountId, handle: `@${handle}` }, observations } }] };
}

// 개인 설정: 카탈로그의 텔레그램 방송 채널(id·handle 정확히 일치)만 받는다. 명령·주소 같은 다른 키는 받지 않는다.
function validateConfig(config, catalog, stateDir = STATE_DIR) {
  if (!config || typeof config !== 'object' || config.version !== 1) throw new Error('설정은 version 1이어야 함');
  const extra = Object.keys(config).filter(k => !['version', 'telegram', 'inbox'].includes(k));
  if (extra.length) throw new Error(`설정에 모르는 키: ${extra.join(', ')}`);
  const list = config.telegram === undefined ? [] : config.telegram;
  if (!Array.isArray(list) || list.length > LIMITS.telegram) throw new Error(`telegram은 ${LIMITS.telegram}개 이하 배열이어야 함`);
  const accounts = (catalog && catalog.accounts) || [], statuses = (catalog && catalog.statuses) || [], used = new Set();
  const telegram = list.map(item => {
    if (!item || typeof item !== 'object' || Object.keys(item).some(k => k !== 'accountId' && k !== 'handle')) throw new Error('telegram 항목은 accountId·handle만 가짐');
    const handle = String(item.handle || '').replace(/^@/, '');
    const entry = accounts.find(a => a.id === item.accountId);
    if (!HANDLE.test(handle) || !entry || entry.platform !== 'telegram' || String(entry.handle || '').replace(/^@/, '') !== handle) {
      throw new Error(`카탈로그의 텔레그램 계정과 맞지 않음: ${item.accountId}`);
    }
    if (entry.accountStatus === 'operating-contact') throw new Error(`개인 연락 계정이라 방송 채널로 읽지 않음: ${entry.id}`);
    if (!statuses.includes(entry.accountStatus)) throw new Error(`관리 계정 상태가 아님: ${entry.id}`);
    if (used.has(`id:${entry.id}`) || used.has(`handle:${handle.toLowerCase()}`)) throw new Error(`겹친 항목: ${entry.id}`);
    used.add(`id:${entry.id}`).add(`handle:${handle.toLowerCase()}`);
    return { accountId: entry.id, handle };
  });
  const base = path.join(stateDir, 'inbox');
  const inbox = config.inbox === undefined ? base : path.resolve(stateDir, String(config.inbox));
  if (!isInside(base, inbox)) throw new Error('inbox는 상태 폴더의 inbox 안이어야 함');
  return { telegram, inbox };
}

async function loadCatalog() {
  const mod = await import(pathToFileURL(CATALOG_MODULE).href);
  return { accounts: mod.accountCatalog.accounts, statuses: [...mod.MANAGED_ACCOUNT_STATUSES] };
}

function readConfig(stateDir) {
  const file = path.join(stateDir, 'config.json');
  if (!fs.existsSync(file)) throw new Error(`설정 파일 없음: ${file}`);
  if (fs.statSync(file).size > 64 * 1024) throw new Error('설정 파일이 너무 큼');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// 수신함: 바로 아래 *.manifest.json만 본다(하위 폴더·연결 제외). 공식 내보내기(official-export) 묶음만 받는다 — 텔레그램은 이 루틴의 공개 화면 길로만 낸다.
// 같은 일인지는 이름·크기·수정 시각이 아니라 내용으로 가린다: 수신함 기준 이름 + 매니페스트 바이트 해시 + 참조 증거(경로·바이트 해시)가
// 모두 같은 성공 영수증이 있을 때만 건너뛴다. 원본은 지우거나 고치지 않는다. 잘못된 파일은 제출 자리를 차지하지 않고,
// 실패 기록이 많은 항목일수록 뒤로 보내 한도 안의 자리가 다른 정상 파일에도 돌아가게 한다.
function readBounded(file, max = LIMITS.rawBytes) {
  const fd = fs.openSync(file, 'r');
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile() || st.size > max) throw new Error(`${path.basename(file)}: 보통 파일이 아니거나 크기 한도 초과`);
    const buf = Buffer.alloc(st.size);
    let n = 0;
    while (n < buf.length) { const k = fs.readSync(fd, buf, n, buf.length - n, n); if (!k) break; n += k; }
    if (n !== st.size) throw new Error(`${path.basename(file)}: 읽는 동안 크기가 바뀜`);
    return buf;
  } finally { fs.closeSync(fd); }
}
// 상태 폴더부터 수신함까지 한 칸씩 연결(정션·심볼릭 링크)이 없어야 하고, 실제 위치도 상태 폴더의 inbox 안이어야 한다.
function checkedInbox(inbox, stateDir) {
  if (!fs.existsSync(inbox)) return null;
  let at = stateDir;
  for (const part of path.relative(stateDir, inbox).split(path.sep).filter(Boolean)) {
    at = path.join(at, part);
    if (fs.lstatSync(at).isSymbolicLink()) throw new Error(`수신함 경로에 연결(정션·심볼릭 링크)이 있어 읽지 않음: ${part}`);
  }
  const real = fs.realpathSync(inbox);
  if (!isInside(path.join(fs.realpathSync(stateDir), 'inbox'), real) || !fs.statSync(real).isDirectory()) throw new Error('수신함의 실제 위치가 상태 폴더의 inbox 밖이거나 폴더가 아님');
  return real;
}
function readInboxItem(root, name) {
  const file = path.join(root, name);
  if (path.dirname(fs.realpathSync(file)) !== root) throw new Error('연결 파일은 읽지 않음');
  const buf = readBounded(file);
  let m;
  try { const text = buf.toString('utf8'); m = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text); } catch { throw new Error('JSON이 아님'); }
  if (!m || m.version !== 1 || !Array.isArray(m.batches) || !m.batches.length || m.batches.length > 50) throw new Error('version 1 매니페스트가 아님');
  const evidence = new Map();
  for (const b of m.batches) {
    if (!b || typeof b !== 'object' || !b.envelope || b.envelope.sourceType !== 'official-export') throw new Error('공식 내보내기(official-export) 묶음만 받음');
    const rel = b.evidenceFile;
    if (typeof rel !== 'string' || !rel || rel.length > 300 || rel.includes(':') || rel.includes(String.fromCharCode(0)) || path.isAbsolute(rel)) throw new Error('증거 경로는 수신함 기준 상대 경로여야 함');
    const abs = path.resolve(root, rel);
    if (abs === root || !isInside(root, abs)) throw new Error(`증거 경로가 수신함 밖임: ${rel}`);
    let real, bytes;
    try { real = fs.realpathSync(abs); } catch { throw new Error(`증거 파일이 없음: ${rel}`); }
    if (real === root || !isInside(root, real)) throw new Error(`증거 파일이 연결로 수신함 밖을 가리킴: ${rel}`);
    const key = path.relative(root, abs);
    if (evidence.has(key)) continue;
    try { bytes = readBounded(real); } catch (e) { throw new Error(`증거 파일을 읽지 못함: ${rel} (${e.code || e.message})`); }
    evidence.set(key, { rel: key, file: real, sha256: sha256(bytes) });
  }
  const list = [...evidence.values()].sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0)), manifestSha256 = sha256(buf);
  return { file, manifestSha256, evidence: list, key: sha256(JSON.stringify(['inbox-v2', name, manifestSha256, list.map(e => [e.rel, e.sha256])])).slice(0, 40) };
}
function receiptState(item) {
  let r;
  try { r = JSON.parse(fs.readFileSync(item.receipt, 'utf8')); } catch (e) { return e.code === 'ENOENT' ? 'none' : 'mismatch'; }
  const same = !!r && r.name === item.name && r.manifestSha256 === item.manifestSha256 && JSON.stringify(r.evidence) === JSON.stringify(item.evidence.map(e => [e.rel, e.sha256]));
  return same ? 'done' : 'mismatch';
}
function listInbox(inbox, stateDir, limit = LIMITS.inboxFiles) {
  const out = { items: [], more: 0, vanished: 0, error: null };
  let root, names;
  try {
    root = checkedInbox(inbox, stateDir);
    if (!root) return out;
    names = fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isFile() && d.name.endsWith('.manifest.json')).map(d => d.name).sort();
  } catch (e) { out.error = sanitize(e.message).slice(0, 200); return out; }
  const receipts = path.join(stateDir, 'receipts');
  let past = [];
  try { past = fs.readdirSync(receipts); } catch { /* 영수증 폴더가 아직 없음 */ }
  const invalid = [], ready = [];
  for (const name of names) {
    const item = { name, status: 'ready' };
    try {
      Object.assign(item, readInboxItem(root, name));
      item.receipt = path.join(receipts, `inbox-${item.key}.json`);
      const state = receiptState(item);
      if (state === 'done') continue;
      if (state === 'mismatch') throw new Error('같은 내용 열쇠의 영수증이 내용과 맞지 않아 사람이 확인해야 함');
      item.failures = past.filter(n => n.startsWith(`inbox-failed-${item.key}-`)).length;
      ready.push(item);
    } catch (e) {
      if (e.code === 'ENOENT') { out.vanished++; continue; }
      invalid.push(Object.assign(item, { status: 'invalid', error: sanitize(e.message).slice(0, 200) }));
    }
  }
  ready.sort((a, b) => a.failures - b.failures || (a.name < b.name ? -1 : 1));
  out.items = [...invalid, ...ready.slice(0, limit)];
  out.more = Math.max(0, ready.length - limit);
  return out;
}
// 쓰기 전에 상태 폴더에서 그 폴더까지 한 칸씩 만들며, 칸마다 연결(정션·심볼릭 링크)이 아닌 진짜 폴더이고 실제 위치가 상태 폴더 안의 그 자리인지 확인한다.
// 비공개 원본 사본·증거·기록은 이렇게 확인한 폴더에만 쓴다(runs·logs·receipts가 공개 작업본 같은 밖으로 이어진 연결이면 쓰기 전에 멈춘다).
function safeDir(stateDir, dir) {
  const rel = path.relative(stateDir, dir);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error(`상태 폴더 밖에는 쓰지 않음: ${dir}`);
  let at = stateDir, real = fs.realpathSync(stateDir);
  for (const part of rel.split(path.sep).filter(Boolean)) {
    at = path.join(at, part);
    real = path.join(real, part);
    try { fs.mkdirSync(at); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    const st = fs.lstatSync(at);
    if (st.isSymbolicLink() || !st.isDirectory() || fs.realpathSync(at) !== real) throw new Error(`상태 폴더 아래 ${path.relative(stateDir, at)}가 연결(정션·심볼릭 링크)이거나 진짜 폴더가 아니어서 쓰지 않음`);
  }
  return dir;
}
// 제출 직전: 목록 때 읽은 바이트와 같은지 다시 보고 회차 폴더에 새 파일로만 뜬다. 수집기는 이 사본만 읽고, 성공 영수증은 이 사본의 해시로 쓴다.
// 그 사이 바뀌거나 사라졌으면 null(이번에는 미루고 다음 회차가 새 내용으로 다시 본다).
function snapshotInbox(item, dir, stateDir) {
  const read = file => { try { return readBounded(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };
  const manifest = read(item.file);
  if (!manifest || sha256(manifest) !== item.manifestSha256) return null;
  const files = [[path.join(dir, item.name), manifest, item.manifestSha256]];
  for (const e of item.evidence) {
    const bytes = read(e.file);
    if (!bytes || sha256(bytes) !== e.sha256) return null;
    files.push([path.join(dir, e.rel), bytes, e.sha256]);
  }
  for (const [file, bytes] of files) { safeDir(stateDir, path.dirname(file)); fs.writeFileSync(file, bytes, { flag: 'wx' }); }
  return { manifest: files[0][0], files: files.map(([file, , hash]) => [file, hash]) };
}
const snapshotIntact = snap => snap.files.every(([file, hash]) => { try { return sha256(readBounded(file)) === hash; } catch { return false; } });

// 수집기 끝 코드의 뜻(tools/계정통계수집.cjs 머리). 0만 제출 성공이다 — 4(올린 뒤 로그아웃 실패)도 실행 미완료라 성공 영수증을 쓰지 않고 다음 회차가 다시 낸다(서버는 같은 증거로 기록을 늘리지 않음).
const INGEST_EXIT = Object.freeze({ 1: '거절·실패 묶음 있음', 2: '목록·인자 오류', 3: '수집기 잠금 있음', 4: '올린 뒤 로그아웃 실패 — 실행 미완료' });
// 공식 수집기를 한 번에 하나씩 셸 없이 띄운다. 출력은 가려서 개인 회차 기록에만 남긴다(화면에 원문을 다시 찍지 않음).
// stdout과 stderr는 갈래마다 받은 바이트를 따로 모으고, 끝난 뒤 한 번에 UTF-8로 풀어 갈래 전체를 sanitize에 넘긴다.
// 그래서 청크 경계에서 자격 낱말이나 한글 바이트가 나뉘어도 가림을 비켜 가지 못한다. 갈래 이름표와 종료 코드는 가린 본문 바깥에 붙인다.
// 한 갈래가 크기 한도를 넘으면 앞부분을 잘라 남기지 않고 그 갈래 전체를 가린다. 넘친 뒤에도 계속 읽어서 버리므로 수집기가 막히지 않는다.
function runIngester(manifest, { ingester, logFile, timeoutMs }) {
  if (!fs.existsSync(ingester)) return Promise.resolve({ status: 'failed', error: '공식 수집기 파일이 아직 없음' });
  if (!(timeoutMs >= 5000)) return Promise.resolve({ status: 'deferred' });
  return new Promise(resolve => {
    let timedOut = false, settled = false;
    const child = spawn(process.execPath, [ingester, '--입력', manifest, '--실행'],
      { cwd: ROOT, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const streams = [['out', child.stdout], ['err', child.stderr]].map(([tag, stream]) => {
      const kept = { tag, bytes: 0, chunks: [] };
      stream.on('data', chunk => {
        kept.bytes += chunk.length;
        if (kept.bytes > LOG_LIMITS.bytes) kept.chunks = null; else kept.chunks.push(chunk);
      });
      return kept;
    });
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    const finish = (code, err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const body = streams.filter(kept => kept.bytes).map(kept => `[${kept.tag}]\n${kept.chunks ? sanitize(Buffer.concat(kept.chunks).toString('utf8'))
        : `${HIDDEN} (${kept.bytes}바이트로 한도를 넘어 이 갈래 전체를 가림)`}\n`).join('');
      const tail = `--- 종료 ${code}${timedOut ? ' (시간 초과)' : ''}${err ? ` ${sanitize(err.message)}` : ''} ---`;
      try { fs.writeFileSync(logFile, `${body}${tail}\n`, { flag: 'wx' }); } catch { /* 기록 실패가 제출 결과를 바꾸지 않음 */ }
      const log = path.basename(logFile);
      resolve(code === 0 && !timedOut && !err ? { status: 'submitted', log }
        : { status: 'failed', error: timedOut ? '수집기 시간 초과' : `수집기 종료 ${code === null ? (err && err.code) : code}${INGEST_EXIT[code] ? ` (${INGEST_EXIT[code]})` : ''}`, log });
    };
    child.on('error', e => finish(null, e));
    child.on('close', code => finish(code));
  });
}

// 회차 잠금: 폴더 만들기로 잡고, 남이 잡은 잠금은 오래돼도 빼앗지 않는다.
function acquireLock(stateDir) {
  const dir = path.join(stateDir, 'runner.lock'), token = crypto.randomUUID();
  try { fs.mkdirSync(dir); } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let owner = '주인 정보 없음';
    try { owner = fs.readFileSync(path.join(dir, 'owner.json'), 'utf8').slice(0, 300); } catch { /* 주인 파일이 없을 수 있음 */ }
    return { ok: false, dir, owner };
  }
  try { fs.writeFileSync(path.join(dir, 'owner.json'), JSON.stringify({ pid: process.pid, token, startedAt: new Date().toISOString() }), { flag: 'wx' }); } catch (e) {
    // 주인 파일을 못 쓰면 방금 만든 이 잠금을 치운다(남기면 실제 실행이 없어도 다음 회차가 계속 잠금으로 멈춘다).
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 못 치우면 다음 회차가 주인 없는 잠금으로 알린다 */ }
    throw e;
  }
  return { ok: true, dir, token };
}
function releaseLock(lock) {
  try {
    if (JSON.parse(fs.readFileSync(path.join(lock.dir, 'owner.json'), 'utf8')).token === lock.token) fs.rmSync(lock.dir, { recursive: true, force: true });
  } catch { /* 내 것이 아니거나 이미 없으면 그대로 둔다 */ }
}

function writeNew(file, text, max = LIMITS.rawBytes) {
  if (Buffer.byteLength(text) > max) throw new Error(`${path.basename(file)} 크기 한도 초과`);
  fs.writeFileSync(file, text, { flag: 'wx' });
}

async function execute(cfg, { stateDir, ingester, limits, scanOpts, out }) {
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
  const runDir = path.join(stateDir, 'runs', runId), logDir = path.join(stateDir, 'logs'), receipts = path.join(stateDir, 'receipts');
  // 회차 폴더(원본 사본·증거)·기록·영수증 폴더는 상태 폴더에서 한 칸씩 연결이 아닌지 확인한 뒤에만 쓴다.
  for (const dir of [runDir, logDir, receipts]) safeDir(stateDir, dir);
  const results = [];
  const submit = (manifest, label) => runIngester(manifest, { ingester, timeoutMs: Math.min(limits.ingestMs, scanOpts.deadline - Date.now()),
    logFile: path.join(logDir, `${runId}-${results.length + 1}-${label}.log`) });
  for (const t of cfg.telegram) {
    const r = { kind: 'telegram', accountId: t.accountId };
    try {
      const scan = await scanTelegram(t.handle, scanOpts);
      // 관측 시각은 마지막 쪽까지 다 받은 뒤에 정한다. 먼저 정하면 수집 중에 올라온 글이 관측보다 늦게 게시된 것으로 남는다.
      const observedAt = new Date().toISOString();
      const evidenceFile = `${t.accountId}.evidence.json`;
      const evidenceText = JSON.stringify({ version: 1, sourceType: 'public-page', accountId: t.accountId,
        handle: `@${t.handle}`, sourceUrl: telegramUrl(t.handle), observedAt, collector: 'tools/계정통계루틴.cjs',
        pagination: { complete: scan.complete, pages: scan.pages }, skippedServicePostIds: scan.skipped, rows: scan.rows }, null, 2);
      writeNew(path.join(runDir, evidenceFile), evidenceText, limits.rawBytes);
      // 봉투에는 방금 쓴 증거 바이트의 해시를 넣는다(수집기가 실제 파일과 정확히 대조한다).
      const manifest = buildManifest({ accountId: t.accountId, handle: t.handle, observedAt, evidenceFile, evidenceSha256: sha256(evidenceText), rows: scan.rows, batch: limits.batch });
      Object.assign(r, { rows: scan.rows.length, unknownViews: scan.rows.filter(x => x.views === null).length });
      if (!manifest.batches.length) {
        if (scan.rows.length) throw new Error('조회수를 하나도 정확히 읽지 못함');
        r.status = 'empty';
      } else {
        const file = path.join(runDir, `${t.accountId}.manifest.json`);
        writeNew(file, JSON.stringify(manifest, null, 2), limits.rawBytes);
        Object.assign(r, await submit(file, t.accountId));
        if (r.status === 'submitted') {
          const last = path.join(receipts, `${t.accountId}.last-success.json`), tmp = `${last}.${process.pid}.${crypto.randomUUID()}.tmp`;
          fs.writeFileSync(tmp, JSON.stringify({ runId, observedAt, rows: r.rows, manifest: file }, null, 2), { flag: 'wx' });
          fs.renameSync(tmp, last);
        }
      }
    } catch (e) { Object.assign(r, { status: 'failed', error: sanitize(e.message).slice(0, 500) }); }
    results.push(r);
  }
  const inbox = listInbox(cfg.inbox, stateDir, limits.inboxFiles);
  if (inbox.error) results.push({ kind: 'inbox', name: null, status: 'failed', error: sanitize(inbox.error) });
  for (const item of inbox.items) {
    const r = { kind: 'inbox', name: item.name };
    try {
      if (item.status === 'invalid') throw new Error(item.error);
      const snap = snapshotInbox(item, path.join(runDir, 'inbox', String(results.length + 1).padStart(3, '0')), stateDir);
      if (!snap) Object.assign(r, { status: 'deferred', reason: '목록을 만든 뒤 내용이 바뀌거나 사라져 다음 회차에 다시 봄' });
      else {
        Object.assign(r, await submit(snap.manifest, 'inbox'));
        if (r.status === 'submitted' && !snapshotIntact(snap)) Object.assign(r, { status: 'failed', error: '제출하는 동안 사본 바이트가 바뀌어 성공으로 받지 않음' });
        const at = new Date().toISOString();
        if (r.status === 'submitted') writeNew(item.receipt, JSON.stringify({ version: 2, runId, name: item.name, manifestSha256: item.manifestSha256,
          evidence: item.evidence.map(e => [e.rel, e.sha256]), snapshot: path.relative(stateDir, snap.manifest), log: r.log || null, at }, null, 2));
        if (r.status === 'failed') writeNew(path.join(receipts, `inbox-failed-${item.key}-${runId}.json`), JSON.stringify({ runId, name: item.name,
          manifestSha256: item.manifestSha256, error: r.error, log: r.log || null, at }, null, 2));
      }
    } catch (e) { Object.assign(r, { status: 'failed', error: sanitize(e.message).slice(0, 500) }); }
    results.push(r);
  }
  // 미룬 제출(예산·내용 바뀜)과 한도 밖에 남은 정상 파일도 끝나지 않은 일이라 0으로 끝내지 않는다. 영수증이 없으니 다음 회차가 다시 집는다.
  const failed = results.filter(x => x.status === 'failed').length;
  const deferred = results.filter(x => x.status === 'deferred').length + inbox.more;
  writeNew(path.join(runDir, 'run-summary.json'), JSON.stringify({ runId, failed, deferred, inboxMore: inbox.more, inboxVanished: inbox.vanished,
    complete: !failed && !deferred, results }, null, 2));
  out(JSON.stringify({ runId, failed, deferred, inboxMore: inbox.more, results }, null, 2));
  return failed || deferred ? 1 : 0;
}

async function main(argv = process.argv.slice(2), deps = {}) {
  const out = deps.log || (line => console.log(line));
  const run = argv.includes('--실행'), probe = argv.includes('--수집미리보기');
  if (argv.some(a => a !== '--실행' && a !== '--수집미리보기') || (run && probe)) {
    out('쓰는 법: node tools/계정통계루틴.cjs [--수집미리보기 | --실행]');
    return 2;
  }
  const stateDir = deps.stateDir || STATE_DIR, ingester = deps.ingester || INGESTER, limits = deps.limits || LIMITS;
  const scanOpts = { fetchImpl: deps.fetchImpl || fetch, limits, pauseMs: deps.pauseMs ?? 1000, deadline: Date.now() + limits.budgetMs };
  let cfg;
  try { cfg = validateConfig(readConfig(stateDir), await (deps.loadCatalog || loadCatalog)(), stateDir); } catch (e) {
    out(`설정 오류: ${sanitize(e.message)}`);
    return 2;
  }
  if (!run && !probe) {
    const inbox = listInbox(cfg.inbox, stateDir, limits.inboxFiles);
    out(JSON.stringify({ 모드: '미리 보기(바꾸는 것 없음)', 텔레그램: cfg.telegram.map(t => ({ ...t, 주소: telegramUrl(t.handle) })),
      수신함: inbox.items.map(({ name, status, error }) => ({ name, status, error })), 수신함오류: inbox.error, 사라짐: inbox.vanished,
      다음회차로: inbox.more, 공식수집기: fs.existsSync(ingester) }, null, 2));
    return 0;
  }
  if (probe) {
    let failed = 0;
    for (const t of cfg.telegram) {
      try {
        const s = await scanTelegram(t.handle, scanOpts);
        out(JSON.stringify({ accountId: t.accountId, 쪽: s.pages.length, 글: s.rows.length, 조회수모름: s.rows.filter(r => r.views === null).length, 서비스글: s.skipped.length }));
      } catch (e) { failed++; out(`${t.accountId} 실패: ${sanitize(e.message)}`); }
    }
    return failed ? 1 : 0;
  }
  fs.mkdirSync(stateDir, { recursive: true });
  const lock = acquireLock(stateDir);
  if (!lock.ok) { out(`다른 실행이 잠금을 쥐고 있어 이번 회차를 건너뜀(오래된 잠금도 빼앗지 않음, 주인 확인 뒤 사람이 지움): ${lock.dir} ${lock.owner}`); return 3; }
  try { return await execute(cfg, { stateDir, ingester, limits, scanOpts, out }); } finally { releaseLock(lock); }
}

module.exports = { LIMITS, LOG_LIMITS, STATE_DIR, telegramUrl, parseViews, parseTelegramPage, scanTelegram, buildManifest, validateConfig, listInbox, sanitize, main };

if (require.main === module) {
  main().then(code => { process.exitCode = code; }, e => { console.error(sanitize(e && e.stack ? e.stack : e)); process.exitCode = 1; });
}
