'use strict';
/* 편 요약(2026-10-24) — 저장소만 아는 편 기록을 회사 작업실 SNS·마케팅 화면(오늘·성과·계정)이 읽을 한 장으로 줄인다.
 *
 * 서버는 자기 예약 작업(작업실 예약)과 수집한 공개 게시물만 안다. Meta Business Suite·스튜디오·크롬으로 건 예약, 10-22 보류 편,
 * 슬롯만 잡힌 「예약 전」 편, 어느 판들이 한 편인지, 평소 대비 배수(판정 장부)는 저장소에만 있다. 그것을 v1 모양 하나로 묶는다.
 *   준비.json·게시결과.json(docs/마케팅/<편>/게시/) · 계정 장부(docs/마케팅/sns-계정.json) · 판정 장부(docs/_ops/게시성과.jsonl)
 * 넣는 것은 공개 게시물의 제목·주소·계정 핸들·시각·상태와 배수뿐이다. 게시결과의 「방법」 원문(유호님 말·작업 메모)과 검토 링크는 넣지 않고
 * 방법은 네 갈래 이름으로만 줄인다. 읽기만 한다 — 보내기는 tools/편요약.js.
 */
const fs = require('node:fs');
const path = require('node:path');

const VERSION = 1;
const KST = 9 * 3600e3;
const SOCIAL = new Set(['youtube', 'instagram', 'facebook', 'tiktok']);
const STATES = new Set(['승인 대기', '예약됨', '게시됨', '실패', '보류']);
const EXCLUDED_GROUPS = { 운영시험: '운영시험', 작품: '작품', 공개확인대기: '공개확인대기' };
// 오늘 화면은 어제~사흘 뒤, 성과는 7일 전부터 본다 — 30분마다 보내도 한국 자정 직후 셋째 날이 비지 않게 앞뒤로 여유를 둔다.
const PAST_DAYS = 8;
const AHEAD_DAYS = 5;
const LIMITS = { episodes: 120, plates: 24, judgments: 400, accounts: 120, excludedUrls: 200, text: 300, url: 600 };

const kstDay = (ms) => new Date(ms + KST).toISOString().slice(0, 10);
const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
// \uC5C6\uB294 \uD30C\uC77C\uC740 null, \uC788\uB294\uB370 \uBABB \uC77D\uAC70\uB098 \uAE68\uC9C4 \uD30C\uC77C\uC740 \uBA48\uCD98\uB2E4 \u2014 \uAE68\uC9C4 \uC6D0\uCC9C\uC73C\uB85C \uB9CC\uB4E0 \uBE48 \uC694\uC57D\uC774 \uC11C\uBC84\uC758 \uC9C0\uAE08 \uC694\uC57D\uC744 \uB36E\uC9C0 \uC54A\uAC8C.
function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch (error) { throw new Error(`\uD3B8 \uC694\uC57D \uC6D0\uCC9C\uC744 \uC77D\uC9C0 \uBABB\uD588\uB2E4: ${file} \u2014 ${error.message}`); }
}
const clip = (value, max = LIMITS.text) => { const s = String(value ?? '').replace(/\s+/g, ' ').trim(); return s.length > max ? s.slice(0, max - 1) + '…' : s; };
const GENERIC_PATH = new Set(['watch', 'shorts', 'reel', 'reels', 'p', 'tv', 'video', 'videos', 'posts', 'story', 'photo', 'photos', 'permalink', 'share', 'home']);
// 게시물 열쇠 — 플랫폼:게시물 번호(유튜브 v= · 그 밖은 주소 끝 칸). 회사 서버 social-simple.mjs postKey와 같은 규칙이다.
function postKeyOf(platform, url) {
  if (!platform || !url) return null;
  let u; try { u = new URL(String(url)); } catch { return null; }
  const id = u.searchParams.get('v') || u.searchParams.get('story_fbid') || u.searchParams.get('fbid') || u.pathname.split('/').filter(Boolean).at(-1) || '';
  // 게시물 번호가 없는 주소(permalink.php?id=… · /reel/ 처럼 끝이 공통 이름)는 열쇠를 만들지 않는다 — 다른 게시물끼리 합쳐진다.
  if (/\.(php|html?|aspx?)$/i.test(id) || GENERIC_PATH.has(id.toLowerCase())) return null;
  return /^[\w.-]{3,}$/.test(id) ? platform + ':' + id : null;
}
// 플랫폼 칸이 빠진 옛 연결 줄은 주소의 호스트로 플랫폼을 정한다(회사 서버 social-simple.mjs guessPlatform과 같다).
function platformOfUrl(url) {
  try { const h = new URL(String(url)).hostname.replace(/^www\./, ''); return /youtube|youtu\.be/.test(h) ? 'youtube' : /instagram/.test(h) ? 'instagram' : /facebook/.test(h) ? 'facebook' : /tiktok/.test(h) ? 'tiktok' : null; } catch { return null; }
}
const idOf = (value) => (typeof value === 'string' && /^[\w-]{1,100}$/.test(value) ? value : null);
const httpsUrl = (value) => { try { const u = new URL(String(value)); return u.protocol === 'https:' && String(value).length <= LIMITS.url ? u.href : null; } catch { return null; } };
// 시각 원문은 '+09:00' 붙은 ISO가 대부분이고, 오프셋이 없으면 한국 시각으로 본다.
function isoOf(value) {
  if (!value) return null;
  const s = String(value).trim();
  const ms = Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(s) ? s : s.replace(' ', 'T').slice(0, 16) + ':00+09:00');
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function brandOfKey(key) {
  const k = String(key || '');
  return k.startsWith('yuhobuilds') || k.startsWith('yuho-') ? '유호' : k.startsWith('synkbrief') ? '브리핑' : k.startsWith('lab') || k.startsWith('synklab') ? 'LAB' : '회사';
}
function brandOfFolder(folder) {
  return folder.startsWith('yuhobuilds') ? '유호' : folder.startsWith('synkbrief') ? '브리핑' : folder.startsWith('LAB') ? 'LAB' : '회사';
}
// 게시결과의 「방법」은 긴 작업 메모다 — 이름 하나로만 줄인다.
function methodOf(text) {
  const s = String(text || '');
  if (!s) return null;
  if (s.trim() === '작업실') return '작업실';
  if (/Business Suite/i.test(s)) return 'Meta 예약';
  if (/sns-발행\.js|API/.test(s)) return 'API 예약';
  if (/유호님 직접/.test(s)) return '유호님 직접';
  if (/크롬|ego|브라우저|스튜디오|Studio|인스타 웹|creator\./i.test(s)) return '직접 예약';
  return null;
}
const handleOf = (account) => {
  const h = String(account?.handle || '').trim();
  if (!h) return '';
  return ['facebook', 'linkedin'].includes(account.platform) ? h.replace(/^@/, '').replace(/^.*facebook\.com\//, '') : (h.startsWith('@') ? h : '@' + h);
};
// README·기획 머리 「LAB · 관용구 퀴즈 #2 「…」 (10-17, 원고 초안)」 → 「관용구 퀴즈 #2 「…」」
const tidy = (t) => t.trim().replace(/^(LAB|synkbrief|yuhobuilds|SYNK)\s*·\s*/, '').replace(/\s*\((\d{1,2}-\d{1,2})[^)]*\)\s*$/, '');
function titleOf(dir, prep) {
  if (prep?.제목) return { title: clip(prep.제목), from: 'prep' };
  for (const name of ['README.md', '기획.md']) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;
    const h = fs.readFileSync(file, 'utf8').match(/^#\s+(.+)$/m);
    if (h) return { title: clip(tidy(h[1])), from: 'readme' };
  }
  return { title: clip(path.basename(dir)), from: 'folder' };
}

/** 계정 장부 → [{key, platform, handle, brand}] (SNS 네 곳만). 장부의 countryCode는 본 계정에도 붙어 있어(lab-youtube = MN) 「나라별 부계정」으로 쓰지 않는다. */
function accountsOf(book) {
  return Object.entries(book?.accounts || {})
    .filter(([, v]) => SOCIAL.has(v?.platform))
    .slice(0, LIMITS.accounts)
    .map(([key, v]) => ({ key, platform: v.platform, handle: handleOf(v), brand: brandOfKey(key) }));
}

/** 판정 장부 → 최근 판정 줄(게시물·지점마다 마지막) + 비교에서 뺀 주소 */
function ledgerOf(lines, sinceMs) {
  const latest = new Map();
  const groups = new Map();
  for (const l of lines) {
    if (l?.kind === '게시연결' && l.url) groups.set(String(l.url), { group: l.group || '콘텐츠', key: postKeyOf(l.platform || platformOfUrl(l.url), l.url) });
    if (l?.kind !== '판정' || !['24h', '72h'].includes(l.point) || !l.url) continue;
    if (!(Date.parse(l.publishedAt) >= sinceMs)) continue;
    latest.set(`${l.post}|${l.point}`, l);
  }
  const judgments = [...latest.values()].slice(-LIMITS.judgments).map((l) => {
    const m = l.multiple;
    return {
      url: httpsUrl(l.url), point: l.point, folder: l.folder || null, account: l.account || null, platform: l.platform || null, publishedAt: l.publishedAt || null,
      multiple: m && Number.isFinite(m.value) ? { value: m.value, median: Number.isFinite(m.median) ? m.median : null, n: Number.isInteger(m.n) ? m.n : 0 } : null,
      verdict: l.verdict ? clip(l.verdict, 40) : null, observedAt: l.observedAt || null,
    };
  }).filter((j) => j.url);
  const excluded = { 운영시험: 0, 작품: 0, urls: [] };
  const excludedKeys = new Set();
  for (const [url, { group, key }] of groups) {
    if (!EXCLUDED_GROUPS[group]) continue;
    if (key) excludedKeys.add(key);
    if (group in excluded) excluded[group] += 1;
    const safe = httpsUrl(url); if (safe && excluded.urls.length < LIMITS.excludedUrls) excluded.urls.push(safe);
  }
  return { judgments, excluded, excludedKeys };
}

// 게시결과에는 같은 판이 「예약됨(주소 없음)」 줄과 「게시됨(주소)」 줄로 두 번 적히기도 한다 — 같은 게시물 열쇠는 하나로,
// 주소 없는 줄은 같은 계정의 주소 있는 줄이 앞뒤 90분 안에 있으면 그 줄에 합친다(방법·작업 ID는 옮긴다).
const RANK = { 게시됨: 4, 예약됨: 3, '승인 대기': 2, 실패: 1, 보류: 0 };
// 겹친 두 줄을 하나로: 더 나아간 상태(게시됨 > 예약됨 > 승인 대기)와 그 시각을 남기고, 방법·작업·원고 ID는 빈 쪽을 채운다.
function merge(kept, other) {
  if ((RANK[other.state] ?? -1) > (RANK[kept.state] ?? -1)) { kept.state = other.state; kept.at = other.at; }
  kept.url = kept.url || other.url; kept.method = kept.method || other.method; kept.jobId = kept.jobId || other.jobId; kept.postId = kept.postId || other.postId;
}
function dedupe(plates) {
  const seen = new Map();
  for (let i = plates.length - 1; i >= 0; i -= 1) {
    const p = plates[i], key = p.url ? postKeyOf(p.platform, p.url) : null;
    if (!key) continue;
    const kept = seen.get(key);
    if (kept) { merge(kept, p); plates.splice(i, 1); }
    else seen.set(key, p);
  }
  for (let i = plates.length - 1; i >= 0; i -= 1) {
    const p = plates[i];
    if (p.url) continue;
    const twin = plates.find((q) => q !== p && q.url && q.account === p.account && Math.abs(Date.parse(q.at) - Date.parse(p.at)) <= 90 * 60000);
    if (twin) { merge(twin, p); plates.splice(i, 1); }
  }
  return plates;
}

/**
 * 편 요약 v1을 만든다.
 *   repo: 저장소 뿌리 · now: 지금(Date|ms) · commit: 원천 커밋(있으면)
 * → { v, generatedAt, today, source, accounts, episodes, judgments, excluded }
 */
function build({ repo, now = Date.now(), commit = null } = {}) {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const today = kstDay(nowMs);
  const from = addDays(today, -PAST_DAYS);
  const to = addDays(today, AHEAD_DAYS);
  const marketing = path.join(repo, 'docs', '마케팅');
  if (!fs.existsSync(marketing)) throw new Error(`편 폴더 뿌리가 없다: ${marketing}`);
  const book = readJson(path.join(marketing, 'sns-계정.json'));
  const accounts = accountsOf(book);
  if (!accounts.length) throw new Error('계정 장부(docs/마케팅/sns-계정.json)에 SNS 계정이 없다 — 요약을 만들지 않는다');
  const byKey = new Map(accounts.map((a) => [a.key, a]));
  const ledgerFile = path.join(repo, 'docs', '_ops', '게시성과.jsonl');
  const lines = fs.existsSync(ledgerFile) ? fs.readFileSync(ledgerFile, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
  const ledger = ledgerOf(lines, Date.parse(from + 'T00:00:00+09:00'));

  const episodes = [];
  // 편 폴더 = 게시 기록이 있는 폴더 + 판정 장부가 이은 폴더(게시/ 기록 없이 브라우저로 올린 옛 편)
  const ledgerFolders = new Set(ledger.judgments.map((j) => j.folder).filter(Boolean));
  const folders = fs.readdirSync(marketing).filter((d) => /_20\d{6}$/.test(d)).sort();
  for (const folder of folders) {
    const dir = path.join(marketing, folder);
    const prep = readJson(path.join(dir, '게시', '준비.json'));
    const result = readJson(path.join(dir, '게시', '게시결과.json'));
    if (!prep && !result && !ledgerFolders.has(folder)) continue;
    const plates = [];
    for (const p of result?.판 || []) {
      const account = byKey.get(p.계정);
      if (!account) continue; // SNS 네 곳 밖(블로그·샤오훙수 등)
      const at = isoOf(p.시각);
      if (!at) continue;
      const day = kstDay(Date.parse(at));
      if (day < from || day > to) continue;
      const url = httpsUrl(p.주소);
      if (url && ledger.excludedKeys.has(postKeyOf(account.platform, url))) continue;
      // 작업실 판은 서버 예약 작업 ID(「작업」)·원고 ID로 서버와 짝을 맞춘다 — 시각은 서버에서 다시 잡힐 수 있다.
      plates.push({ account: account.key, platform: account.platform, handle: account.handle, at, state: STATES.has(p.상태) ? p.상태 : null, method: methodOf(p.방법), url, jobId: idOf(p.작업), postId: idOf(p.원고ID) });
    }
    // 판정 장부가 이 편에 이은 주소(브라우저로 올려 게시결과에 주소가 없던 판)도 게시됨 판으로 더한다.
    for (const j of ledger.judgments) {
      if (j.folder !== folder || ledger.excludedKeys.has(postKeyOf(j.platform, j.url)) || plates.some((p) => p.url && postKeyOf(p.platform, p.url) === postKeyOf(j.platform, j.url))) continue;
      const account = byKey.get(j.account);
      if (!account || !j.publishedAt) continue;
      plates.push({ account: account.key, platform: account.platform, handle: account.handle, at: new Date(Date.parse(j.publishedAt)).toISOString(), state: '게시됨', method: null, url: j.url, jobId: null, postId: null });
    }
    dedupe(plates);
    const slot = typeof prep?.슬롯 === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(prep.슬롯) ? prep.슬롯 : null;
    const waiting = !plates.length && slot && slot >= today && slot <= to && prep?.상태 === '올릴 준비';
    if (!plates.length && !waiting) continue;
    const named = titleOf(dir, prep);
    episodes.push({
      key: folder, title: named.title, titleFrom: named.from, brand: brandOfFolder(folder), slot, prepState: prep?.상태 ? clip(prep.상태, 40) : null,
      planned: waiting ? (prep.판 || []).map((x) => byKey.get(x.계정)).filter(Boolean).slice(0, LIMITS.plates).map((a) => ({ account: a.key, platform: a.platform, handle: a.handle })) : [],
      plates: plates.slice(0, LIMITS.plates),
    });
  }
  return {
    v: VERSION, generatedAt: new Date(nowMs).toISOString(), today, source: { tool: '편요약', commit: commit && /^[0-9a-f]{7,40}$/.test(commit) ? commit : null },
    accounts, episodes: episodes.slice(-LIMITS.episodes),
    judgments: ledger.judgments.map(({ folder, account, ...rest }) => ({ ...rest, account })), excluded: ledger.excluded,
  };
}

module.exports = { build, postKeyOf, dedupe, methodOf, isoOf, brandOfKey, brandOfFolder, accountsOf, ledgerOf, VERSION, LIMITS };
