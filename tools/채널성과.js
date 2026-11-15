#!/usr/bin/env node
'use strict';
/* 채널 성과 — 계정마다 공개 숫자(팔로워·게시물·조회)를 날짜와 함께 장부에 쌓고, 사람이 읽는 요약 한 장을 다시 만든다.
 *
 * 장부 = docs/_ops/채널성과.jsonl (한 줄 = 한 번 잰 값 · 고치지 않고 쌓는다)
 * 요약 = docs/마케팅/채널성과.md (운영 홈 「온라인 마케팅」 칸이 읽는다 · 이 도구가 다시 만든다)
 * 계정 목록 = docs/마케팅/sns-계정.json
 *
 * 자동: YouTube(기존 LAB YouTube 인증으로 공개 통계 조회) · Telegram 공개 채널(t.me 공개 페이지)
 *       · 회사 서버(작업실)가 공식 API로 날마다 모으는 Instagram·TikTok·Facebook 값(11-16 — 요약이 몽골 주력 세 계정을
 *         「아직 안 잼」으로 보여, 서버에만 있던 숫자를 「잰 적 없다」로 오해할 뻔했다). 서버는 tools/계정성과점검.js의 읽기로
 *         자기 세션에 로그인해 GET만 하고 그 세션을 닫는다.
 * 손: 그 밖의 계정. 과거 상담 구분은 별도로 확인된 수치가 있을 때만 수동으로 보존한다.
 * 게시·수정·메시지 발송·서버 설정 변경을 하지 않는다. 자격 값은 출력하지 않는다.
 * 공용 작업본에서 돌면 장부·요약을 쓴 뒤 그 두 파일만 곧바로 origin에 올린다(lib/장부올리기.js · 10-21 — 예약 판정 작업이 쓰고
 * 커밋하지 않은 23줄이 공용 작업본에 남아 따라가기를 막았다). 워크트리에서는 그 세션 커밋에 같이 올린다.
 */
const fs = require('node:fs');
const path = require('node:path');
const { 장부올리기, 장부올리기글 } = require('./lib/장부올리기.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const ACCOUNTS_FILE = path.join(REPO_ROOT, 'docs', '마케팅', 'sns-계정.json');
const LEDGER_FILE = path.join(REPO_ROOT, 'docs', '_ops', '채널성과.jsonl');
const SUMMARY_FILE = path.join(REPO_ROOT, 'docs', '마케팅', '채널성과.md');

// 2026-09-18 당시 상담 집계의 역사적 분류. 현재 Google Form에는 이 문항·연결 시트가 없다.
const CONSULT_BUCKETS = ['페이스북', '인스타', '틱톡', '유튜브', '텔레그램', '추천', '오픈데이', '학교제휴', '워크인', '기타'];
// 과거에 인지채널이 빈 상담을 표시하던 칸이다.
const CONSULT_COLUMNS = [...CONSULT_BUCKETS, '미기입'];
const METRICS = { 팔로워: 'followers', 게시물: 'posts', 조회: 'views' };
const PLATFORM_LABEL = {
  youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', threads: 'Threads',
  linkedin: 'LinkedIn', telegram: 'Telegram', substack: 'Substack', 'naver-blog': '네이버 블로그',
  'kakao-channel': '카카오 채널', tistory: 'Tistory', pinterest: 'Pinterest', x: 'X', behance: 'Behance',
  'naver-clip': '네이버 클립',
};
const AUTO_PLATFORMS = new Set(['youtube', 'telegram']);
const SERVER_SOURCE = 'company-server';
const SERVER_HOW = '자동(회사 서버 · 공식 API)';
const DAY = 86_400_000;
const finite = n => typeof n === 'number' && Number.isFinite(n);
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

function localDate(at = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(at);
}

function loadAccounts(file = ACCOUNTS_FILE) {
  const { accounts } = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!accounts || typeof accounts !== 'object') throw new Error('계정 목록에 accounts가 없습니다.');
  return Object.entries(accounts)
    .filter(([, a]) => !/do-not-expand/.test(String(a.connection || '')))
    .map(([key, a]) => ({
      key, brand: a.brand || '', platform: a.platform || '', handle: a.handle || '',
      ...(a.expectedChannelId ? { expectedChannelId: a.expectedChannelId } : {}),
    }));
}

function readLedger(file = LEDGER_FILE) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(line => line.trim()).map((line, i) => {
    try { return JSON.parse(line); } catch { throw new Error(`장부 ${i + 1}번째 줄이 JSON이 아닙니다.`); }
  });
}

function appendLedger(entries, file = LEDGER_FILE) {
  if (!entries.length) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, entries.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf8');
}

function toCount(text) {
  const raw = String(text).trim().replace(/ /g, ' ');
  const short = /^([\d.]+)\s*([KM])$/i.exec(raw);
  if (short) return Math.round(Number(short[1]) * (short[2].toUpperCase() === 'K' ? 1e3 : 1e6));
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

// t.me 공개 페이지의 «N subscribers»(채널) 또는 «N members»(그룹)를 읽는다. 개인 프로필이면 null.
function parseTelegramPage(html) {
  const m = /class="tgme_page_extra"[^>]*>\s*([\d][\d\s,. ]*[KM]?)\s+(subscribers?|members?)/i.exec(String(html));
  if (!m) return null;
  return { followers: toCount(m[1]), kind: /subscriber/i.test(m[2]) ? 'channel' : 'group' };
}

function parsePairs(args, allowed, label) {
  const values = {};
  for (const arg of args) {
    const m = /^([^=\s]+)=(\d+)$/.exec(arg);
    if (!m) throw new Error(`「${arg}」를 읽지 못했습니다. 「이름=숫자」 꼴로 적어 주세요.`);
    if (!allowed.includes(m[1])) throw new Error(`「${m[1]}」는 ${label}에 없습니다. 쓸 수 있는 것: ${allowed.join(', ')}`);
    values[m[1]] = Number(m[2]);
  }
  if (!Object.keys(values).length) throw new Error(`${label} 값을 하나 이상 적어 주세요.`);
  return values;
}

function handEntry(accountKey, args, { accounts, date, at = new Date() }) {
  if (!accounts.some(a => a.key === accountKey)) throw new Error(`계정 키 「${accountKey}」가 목록에 없습니다. --계정 으로 확인하세요.`);
  const values = parsePairs(args, Object.keys(METRICS), '계정 지표');
  const entry = { at: at.toISOString(), date: date || localDate(at), kind: 'account', account: accountKey, source: 'hand' };
  for (const [name, value] of Object.entries(values)) entry[METRICS[name]] = value;
  return entry;
}

// 적지 않은 칸은 «모름»으로 남긴다. 현재 자동 완료 원천이 없으므로 0으로 확정하지 않는다.
// 모든 칸을 셌을 때만 complete 로 나머지를 0으로 채운다.
function consultEntry(period, args, { at = new Date(), complete = false } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}~\d{4}-\d{2}-\d{2}$/.test(String(period))) {
    throw new Error('기간은 「2026-09-08~2026-09-14」 꼴로 적어 주세요.');
  }
  const counts = parsePairs(args, CONSULT_COLUMNS, '상담 인지채널 집계');
  if (complete) for (const column of CONSULT_COLUMNS) if (counts[column] === undefined) counts[column] = 0;
  return { at: at.toISOString(), date: localDate(at), kind: 'consult', period, counts, source: 'hand' };
}

async function measureYoutube(accounts, { fetchImpl = fetch, credential } = {}) {
  if (!accounts.length) return [];
  const publisher = require('./lib/sns-publisher.js');
  const cred = credential !== undefined ? credential : publisher.readCredential('lab-youtube', { allowLegacy: true });
  if (!cred) return accounts.map(a => ({ account: a.key, error: 'LAB YouTube 인증이 없어 조회하지 못했습니다' }));
  let token;
  try { token = await publisher.googleAccessToken(cred, fetchImpl); }
  catch (error) { return accounts.map(a => ({ account: a.key, error: error.message })); }
  const results = [];
  for (const account of accounts) {
    const handle = String(account.handle).replace(/^@/, '');
    try {
      const url = 'https://www.googleapis.com/youtube/v3/channels?part=id,statistics&forHandle=' + encodeURIComponent(handle);
      const response = await fetchImpl(url, { headers: { authorization: 'Bearer ' + token.accessToken } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`YouTube ${response.status}: ${body?.error?.message || '응답 오류'}`);
      const channel = body.items?.[0];
      const stats = channel?.statistics;
      if (!stats) throw new Error('핸들로 채널을 찾지 못했습니다');
      if (account.expectedChannelId && channel.id !== account.expectedChannelId) {
        throw new Error(`핸들이 다른 채널(${channel.id})을 가리킵니다`);
      }
      results.push({
        account: account.key,
        followers: stats.hiddenSubscriberCount ? null : Number(stats.subscriberCount),
        posts: Number(stats.videoCount),
        views: Number(stats.viewCount),
        source: 'youtube-api',
      });
    } catch (error) {
      results.push({ account: account.key, error: error.message });
    }
  }
  return results;
}

async function measureTelegram(account, { fetchImpl = fetch } = {}) {
  const name = String(account.handle).replace(/^https?:\/\//, '').replace(/^t\.me\//, '').replace(/^@/, '').split(/[/?#]/)[0];
  if (!/^[A-Za-z0-9_]{4,}$/.test(name)) return { account: account.key, error: 'Telegram 주소를 읽지 못했습니다' };
  try {
    const response = await fetchImpl('https://t.me/' + name, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!response.ok) return { account: account.key, error: `t.me ${response.status}` };
    const parsed = parseTelegramPage(await response.text());
    if (!parsed) return { account: account.key, skipped: '공개 페이지에 구독자 수가 없습니다(개인 프로필이거나 비공개)' };
    return { account: account.key, followers: parsed.followers, source: 'telegram-public-page' };
  } catch (error) {
    return { account: account.key, error: error.message };
  }
}

async function measureAll(accounts, { fetchImpl = fetch, credential, at = new Date() } = {}) {
  const youtube = await measureYoutube(accounts.filter(a => a.platform === 'youtube'), { fetchImpl, credential });
  const telegram = [];
  for (const account of accounts.filter(a => a.platform === 'telegram')) telegram.push(await measureTelegram(account, { fetchImpl }));
  const results = [...youtube, ...telegram];
  const entries = results.filter(r => !r.error && !r.skipped).map(r => ({
    at: at.toISOString(), date: localDate(at), kind: 'account', account: r.account,
    ...(r.followers !== undefined ? { followers: r.followers } : {}),
    ...(r.posts !== undefined ? { posts: r.posts } : {}),
    ...(r.views !== undefined ? { views: r.views } : {}),
    source: r.source,
  }));
  return { results, entries };
}

// 회사 서버의 계정 대조 결과(tools/계정성과점검.js의 audit 모양) → 장부 줄.
// - 서버에 연결됐고(connected) 계정 목록에 있는 계정만 옮긴다. 이 도구가 따로 재는 YouTube·Telegram은 옮기지 않는다
//   (같은 칸에 뜻이 다른 출처 둘이 번갈아 들어오지 않게).
// - 팔로워는 계정 단위 공식 값이다. 7일 변화는 서버가 기준일 관측과 비교해 complete로 낸 값만 붙인다(역산하지 않는다).
// - 서버의 조회는 관측한 게시물 누적 조회의 합이다(플랫폼이 계정 전체 조회를 주지 않는다). 그래서 views가 아니라 postViews에 둔다.
// - 잰 날(date)은 서버 집계의 마지막 날(보고 end)이다.
function serverEntries(result, { accounts }) {
  if (!result || !Array.isArray(result.accounts)) throw new Error('회사 서버 결과에 accounts가 없습니다(계정성과점검.json 모양이 아닙니다).');
  const keys = new Set(accounts.map(a => a.key));
  const at = Number.isFinite(Date.parse(result.checkedAt)) ? new Date(result.checkedAt).toISOString() : new Date().toISOString();
  const entries = [];
  for (const a of result.accounts) {
    if (!a || !keys.has(a.id) || AUTO_PLATFORMS.has(a.platform) || a.connected !== true) continue;
    const period = a.periods?.[7];
    const metrics = period?.metrics || {};
    const followers = finite(metrics.followers?.latest) ? metrics.followers.latest : undefined;
    const postViews = finite(metrics.views?.latest) ? metrics.views.latest : undefined;
    if (followers === undefined && postViews === undefined) continue;
    const entry = { at, date: isDate(period?.end) ? period.end : localDate(new Date(at)), kind: 'account', account: a.id };
    if (followers !== undefined) {
      entry.followers = followers;
      const c = metrics.followers.comparison;
      if (c?.complete === true && finite(metrics.followers.increase) && isDate(c.baseDate)) {
        entry.followersChange = { delta: metrics.followers.increase, since: c.baseDate,
          ...(finite(c.previous) && isDate(c.previousBaseDate) ? { previous: c.previous, previousSince: c.previousBaseDate } : {}) };
      }
    }
    if (postViews !== undefined) entry.postViews = postViews;
    entry.source = SERVER_SOURCE;
    entries.push(entry);
  }
  return entries;
}

// 같은 계정·같은 잰 날의 서버 값이 이미 장부에 있으면 다시 쌓지 않는다(같은 날 여러 번 돌려도 한 줄).
function unseenServerEntries(entries, ledger) {
  const seen = new Set(ledger.filter(e => e.kind === 'account' && e.source === SERVER_SOURCE).map(e => `${e.account}|${e.date}`));
  return entries.filter(e => !seen.has(`${e.account}|${e.date}`));
}

// 기본 읽기: 계정성과점검의 읽기(자기 세션 로그인 · GET만 · 그 세션 로그아웃)로 7일 보고 하나만 받는다.
const readServer = () => require('./계정성과점검.js').읽기({ days: [7] });

async function measureServer(accounts, { read = readServer } = {}) {
  try {
    const result = await read();
    return { entries: serverEntries(result, { accounts }), checkedAt: result.checkedAt };
  } catch (error) {
    return { error: error.message, entries: [] };
  }
}

const number = value => (value === null || value === undefined ? '—' : Number(value).toLocaleString('ko-KR'));
const cell = text => String(text).replace(/\|/g, '\\|');

const signed = n => `${n > 0 ? '+' : ''}${n.toLocaleString('ko-KR')}`;

function followerChange(entries) {
  const withFollowers = entries.filter(e => Number.isFinite(e.followers));
  const latest = withFollowers[withFollowers.length - 1];
  if (!latest) return '—';
  // 서버가 기준일 관측과 비교해 낸 7일 변화가 있으면 그것을 쓴다(그 전 7일 변화도 함께).
  const given = latest.followersChange;
  if (given && finite(given.delta) && isDate(given.since)) {
    return `${signed(given.delta)} (${given.since.slice(5)} 대비)${finite(given.previous) ? ` · 그 전 7일 ${signed(given.previous)}` : ''}`;
  }
  const limit = Date.parse(latest.date) - 7 * DAY;
  const base = [...withFollowers].reverse().find(e => Date.parse(e.date) <= limit);
  if (!base) return '—';
  return `${signed(latest.followers - base.followers)} (${base.date.slice(5)} 대비)`;
}

function latestValue(entries, field) {
  for (let i = entries.length - 1; i >= 0; i -= 1) if (entries[i][field] !== undefined) return entries[i][field];
  return undefined;
}

// 조회 칸: 가장 늦게 잰 조회 값을 쓴다. 회사 서버의 게시물 누적 조회 합(postViews)이면 그렇다고 붙인다.
function viewsCell(entries) {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i].views !== undefined) return number(entries[i].views);
    if (entries[i].postViews !== undefined) return `${number(entries[i].postViews)} (게시물 합)`;
  }
  return '—';
}

function howMeasured(account, last) {
  if (last?.source === SERVER_SOURCE) return SERVER_HOW;
  if (account.platform === 'telegram') return '자동(공개 채널만)';
  return AUTO_PLATFORMS.has(account.platform) ? '자동' : '손';
}

// 측정 날짜가 먼저다. 지난 날짜의 값을 나중에 적어도 최신값을 덮지 않는다. 같은 날 안에서만 적은 순서를 본다.
const byMeasured = (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.at).localeCompare(String(b.at));

function summarize({ accounts, ledger, today = localDate() }) {
  const byAccount = new Map();
  for (const entry of ledger.filter(e => e.kind === 'account')) {
    if (!byAccount.has(entry.account)) byAccount.set(entry.account, []);
    byAccount.get(entry.account).push(entry);
  }
  for (const list of byAccount.values()) list.sort(byMeasured);

  const rows = accounts.map(account => {
    const entries = byAccount.get(account.key) || [];
    const last = entries[entries.length - 1];
    const how = howMeasured(account, last);
    const name = `${PLATFORM_LABEL[account.platform] || account.platform} ${account.handle}`.trim();
    if (!last) return `| ${cell(account.brand)} | ${cell(name)} | 아직 안 잼 | — | — | — | — | ${how} · \`${account.key}\` |`;
    return `| ${cell(account.brand)} | ${cell(name)} | ${number(latestValue(entries, 'followers'))} | ${followerChange(entries)} | ${number(latestValue(entries, 'posts'))} | ${viewsCell(entries)} | ${last.date} | ${how} · \`${account.key}\` |`;
  });

  // 같은 기간을 다시 적으면 나중에 적은 값이 고친 값이다. 표는 기간 순서로 최근 여섯.
  const byPeriod = new Map();
  for (const c of ledger.filter(e => e.kind === 'consult').sort((a, b) => String(a.at).localeCompare(String(b.at)))) byPeriod.set(c.period, c);
  const consults = [...byPeriod.values()].sort((a, b) => String(a.period).localeCompare(String(b.period))).slice(-6);
  const consultRows = consults.map(c => {
    const counts = c.counts || {};
    const values = CONSULT_COLUMNS.map(b => number(counts[b]));
    const total = CONSULT_COLUMNS.reduce((sum, b) => sum + (counts[b] || 0), 0);
    const whole = CONSULT_COLUMNS.every(b => counts[b] !== undefined);
    return `| ${c.period} | ${values.join(' | ')} | ${number(total)}${whole ? '' : ' 이상'} |`;
  });

  return [
    '# 채널 성과',
    '',
    `> \`node tools/채널성과.js\`가 장부(\`docs/_ops/채널성과.jsonl\`)에서 다시 만드는 요약이다. 손으로 고치지 않는다. 마지막으로 만든 날: ${today}.`,
    '> 숫자는 잰 날의 값이다. 비어 있는 칸은 잰 적이 없다는 뜻이지 0이 아니다.',
    '',
    '## 계정별 최근 값',
    '',
    '| 브랜드 | 계정 | 팔로워 | 7일 이상 전보다 | 게시물 | 조회 | 잰 날 | 재는 법 · 키 |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    `재는 법이 「${SERVER_HOW}」인 줄은 회사 서버가 플랫폼 공식 API로 날마다 모은 값을 옮겨 적은 것이다. 잰 날은 서버 집계의 마지막 날이다. 팔로워 변화는 서버가 7일 전 관측과 비교한 값이고, 「그 전 7일」은 그보다 앞선 7일 동안의 변화다. 조회 칸의 「게시물 합」은 서버가 관측한 게시물의 누적 조회를 더한 값이다. 플랫폼이 계정 전체 조회를 주지 않아서 계정 전체 조회와 다를 수 있다.`,
    '',
    '## 상담 신청 — 어디서 알게 됐나',
    '',
    '이 표는 별도 근거로 확인해 수동 기록한 과거 상담 수만 보여 준다. 2026-10-02에 옛 상담시트/KPI가 폐기됐고 현재 홈페이지 Google Form에는 연결 시트·인지채널 필드·게시물 식별자가 없어 신청 완료를 자동으로 셀 수 없다. 빈 표는 유입이나 신청이 0건이라는 뜻이 아니다. 「—」는 미확인이고, 그런 칸이 있으면 합에 「이상」이 붙는다. 유튜브·텔레그램 칸은 2026-09-18에 더한 역사적 분류다.',
    '',
    ...(consultRows.length
      ? [`| 기간 | ${CONSULT_COLUMNS.join(' | ')} | 합 |`, `|---|${CONSULT_COLUMNS.map(() => '---|').join('')}---|`, ...consultRows]
      : ['아직 적은 기간이 없다.']),
    '',
    '## 재는 법',
    '',
    '- 자동으로 잴 수 있는 것(YouTube · Telegram 공개 채널 · 회사 서버에 연결된 계정): `node tools/채널성과.js --재기`',
    '- 회사 서버 값만 다시 옮기기: `node tools/채널성과.js --서버`. 작업실에 자기 세션으로 로그인해 읽기만 하고 그 세션을 닫는다. 이미 받은 점검 결과가 있으면 `node tools/채널성과.js --서버 <계정성과점검.json>`으로 네트워크 없이 옮긴다. 같은 계정의 같은 잰 날 값은 한 번만 쌓인다.',
    '- 그 밖의 계정: 앱이나 웹에서 숫자를 보고 `node tools/채널성과.js --적기 <키> 팔로워=N 게시물=N`',
    '- 상담 신청: 확인 가능한 원본과 기간별 분류를 별도로 확보한 경우에만 `node tools/채널성과.js --상담 2026-09-01~2026-09-30 페이스북=N 인스타=N`으로 과거 수치를 수동 기록한다. 모든 칸을 실제 확인한 경우에만 `--전부`를 붙인다.',
    '- 장부만으로 이 요약을 다시 만들기: `node tools/채널성과.js --요약`',
    '',
    '## 아직 못 재는 것',
    '',
    '- 회사 서버에 연결되지 않은 Instagram · TikTok · Facebook 계정과 LinkedIn · Threads 등은 손으로 적는다. 서버 연결 상태는 `node tools/계정성과점검.js`로 본다.',
    '',
  ].join('\n');
}

function writeSummary(text, file = SUMMARY_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', text, 'utf8');
  fs.renameSync(file + '.tmp', file);
}

/** 장부·요약을 쓴 뒤 그 두 파일만 origin에 올린다(공용 작업본에서만 · 못 올려도 실패로 치지 않는다). */
async function 올리기(설명) {
  const 경로 = [LEDGER_FILE, SUMMARY_FILE].map(f => path.relative(REPO_ROOT, f).replace(/\\/g, '/'));
  const 줄 = 장부올리기글(await 장부올리기(경로, `chore(장부): 채널 성과 — ${설명}`), '채널 성과 장부·요약');
  if (줄) console.log(줄);
}

function printServer(entries, added) {
  const fresh = new Set(added);
  for (const e of entries) {
    const parts = [];
    if (e.followers !== undefined) parts.push(`팔로워 ${number(e.followers)}${e.followersChange ? `, 7일 변화 ${followerChange([e])}` : ''}`);
    if (e.postViews !== undefined) parts.push(`게시물 조회 합 ${number(e.postViews)}`);
    console.log(`${fresh.has(e) ? '✓' : '·'} ${e.account}: ${parts.join(' · ')} — 회사 서버 ${e.date}${fresh.has(e) ? '' : ' (이미 장부에 있음)'}`);
  }
  if (!entries.length) console.log('· 회사 서버: 옮길 계정이 없습니다(연결된 Instagram·TikTok·Facebook 값 없음)');
}

function usage() {
  console.log(`
채널 성과 장부

  node tools/채널성과.js --재기
      YouTube·Telegram 공개 숫자와 회사 서버 값을 재서 장부에 쌓고 요약을 다시 만든다
  node tools/채널성과.js --서버 [계정성과점검.json]
      회사 서버에 연결된 Instagram·TikTok·Facebook의 팔로워·게시물 조회 합만 옮긴다
      (파일을 주면 네트워크 없이 그 결과를, 안 주면 작업실에 자기 세션으로 들어가 GET만 하고 닫는다)
  node tools/채널성과.js --적기 <계정키> 팔로워=N [게시물=N] [조회=N] [--날짜 YYYY-MM-DD]
      API가 없는 계정의 숫자를 손으로 적는다
  node tools/채널성과.js --상담 <기간> 페이스북=N 인스타=N ... [--전부]
      별도 근거로 확인된 과거 인지채널별 수만 적는다 (현재 폼·완료 API는 미연결)
      적지 않은 칸은 «모름»으로 남는다. 모든 칸을 셌으면 --전부로 나머지를 0으로 채운다
  node tools/채널성과.js --요약      장부에서 요약만 다시 만든다 (네트워크 안 씀)
  node tools/채널성과.js --현재      기존 Hermes 수집 사본의 계정·게시 관측 JSON을 읽는다 (파일·장부 변경 없음)
  node tools/채널성과.js --계정      계정 키 목록

인지채널 칸: ${CONSULT_COLUMNS.join(', ')}
`);
}

async function main(argv) {
  const args = [...argv];
  const take = flag => {
    const i = args.indexOf(flag);
    if (i < 0) return null;
    const value = args[i + 1];
    args.splice(i, 2);
    return value;
  };
  if(args[0] === '--현재'){
    const os=require('node:os'),{readCachedPerformance}=require('./operations-home/performance-summary.cjs');
    const file=take('--사본')||path.join(process.env.LOCALAPPDATA||os.homedir(),'hermes','runtime','synk-overview','sns-cache.json');
    const result=readCachedPerformance(file);console.log(JSON.stringify(result,null,2));
    if(!result.available)process.exitCode=1;
    return;
  }
  const accounts = loadAccounts();

  if (args[0] === '--계정') {
    for (const a of accounts) console.log(`${a.key.padEnd(24)} ${a.brand.padEnd(6)} ${PLATFORM_LABEL[a.platform] || a.platform} ${a.handle}${AUTO_PLATFORMS.has(a.platform) ? ' (자동)' : ''}`);
    return;
  }
  if (args[0] === '--적기') {
    const date = take('--날짜');
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('--날짜는 YYYY-MM-DD 꼴로 적어 주세요.');
    const entry = handEntry(args[1], args.slice(2), { accounts, date });
    appendLedger([entry]);
    writeSummary(summarize({ accounts, ledger: readLedger() }));
    console.log(`적었습니다: ${entry.account} ${Object.entries(METRICS).filter(([, f]) => entry[f] !== undefined).map(([n, f]) => `${n} ${entry[f]}`).join(' · ')}`);
    await 올리기(`${entry.account} 손으로 적음`);
    return;
  }
  if (args[0] === '--상담') {
    const complete = args.includes('--전부');
    const rest = args.filter(a => a !== '--전부');
    const entry = consultEntry(rest[1], rest.slice(2), { complete });
    appendLedger([entry]);
    writeSummary(summarize({ accounts, ledger: readLedger() }));
    console.log(`적었습니다: 상담 ${entry.period} · 합 ${Object.values(entry.counts).reduce((s, n) => s + n, 0)}`);
    await 올리기(`상담 ${entry.period}`);
    return;
  }
  if (args[0] === '--요약') {
    writeSummary(summarize({ accounts, ledger: readLedger() }));
    console.log('요약을 다시 만들었습니다: docs/마케팅/채널성과.md');
    await 올리기('요약 다시 만듦');
    return;
  }
  if (args[0] === '--서버') {
    const file = args[1];
    const server = file
      ? { entries: serverEntries(JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')), { accounts }) }
      : await measureServer(accounts);
    if (server.error) throw new Error(`회사 서버를 읽지 못했습니다: ${server.error}`);
    const added = unseenServerEntries(server.entries, readLedger());
    appendLedger(added);
    writeSummary(summarize({ accounts, ledger: readLedger() }));
    printServer(server.entries, added);
    await 올리기(`회사 서버 값 ${added.length}줄`);
    return;
  }
  if (args[0] === '--재기') {
    const { results, entries } = await measureAll(accounts);
    const server = await measureServer(accounts);
    const added = unseenServerEntries(server.entries, readLedger());
    appendLedger([...entries, ...added]);
    writeSummary(summarize({ accounts, ledger: readLedger() }));
    for (const r of results) {
      if (r.error) console.log(`✗ ${r.account}: ${r.error}`);
      else if (r.skipped) console.log(`· ${r.account}: ${r.skipped}`);
      else console.log(`✓ ${r.account}: 팔로워 ${number(r.followers)}${r.posts !== undefined ? ` · 게시물 ${number(r.posts)} · 조회 ${number(r.views)}` : ''}`);
    }
    if (server.error) console.log(`✗ 회사 서버: ${server.error}`);
    else printServer(server.entries, added);
    console.log(`장부에 ${entries.length + added.length}줄을 더했습니다. 요약: docs/마케팅/채널성과.md`);
    await 올리기(`공개 숫자 ${entries.length}줄 · 회사 서버 값 ${added.length}줄`);
    return;
  }
  usage();
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(error => {
    console.error(`\n❌ ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  CONSULT_BUCKETS, CONSULT_COLUMNS, loadAccounts, readLedger, appendLedger, parseTelegramPage, toCount, handEntry,
  consultEntry, measureYoutube, measureTelegram, measureAll, summarize, followerChange, localDate,
  SERVER_SOURCE, serverEntries, unseenServerEntries, measureServer,
};
