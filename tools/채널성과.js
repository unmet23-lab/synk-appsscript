#!/usr/bin/env node
'use strict';
/* 채널 성과 — 계정마다 공개 숫자(팔로워·게시물·조회)를 날짜와 함께 장부에 쌓고, 사람이 읽는 요약 한 장을 다시 만든다.
 *
 * 장부 = docs/_ops/채널성과.jsonl (한 줄 = 한 번 잰 값 · 고치지 않고 쌓는다)
 * 요약 = docs/마케팅/채널성과.md (운영 홈 「온라인 마케팅」 칸이 읽는다 · 이 도구가 다시 만든다)
 * 계정 목록 = docs/마케팅/sns-계정.json
 *
 * 자동: YouTube(기존 LAB YouTube 인증으로 공개 통계 조회) · Telegram 공개 채널(t.me 공개 페이지)
 * 손: 그 밖의 계정, 그리고 상담 신청의 인지채널별 수(상담시트에서 센다 · KPI 보고 한 줄은 상위 다섯뿐이다)
 * 게시·수정·메시지 발송을 하지 않는다. 자격 값은 출력하지 않는다.
 */
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ACCOUNTS_FILE = path.join(REPO_ROOT, 'docs', '마케팅', 'sns-계정.json');
const LEDGER_FILE = path.join(REPO_ROOT, 'docs', '_ops', '채널성과.jsonl');
const SUMMARY_FILE = path.join(REPO_ROOT, 'docs', '마케팅', '채널성과.md');

// 상담 폼의 인지채널 선택지 — 엔진_폼리포트.js 의 인지채널 문항과 같은 열 칸(2026-09-18 유튜브·텔레그램 추가).
const CONSULT_BUCKETS = ['페이스북', '인스타', '틱톡', '유튜브', '텔레그램', '추천', '오픈데이', '학교제휴', '워크인', '기타'];
// 폼 선택지는 아니지만 KPI 집계가 따로 세는 칸 — 인지채널이 빈 상담(엔진_운영배치.js computeKpiMetrics).
const CONSULT_COLUMNS = [...CONSULT_BUCKETS, '미기입'];
const METRICS = { 팔로워: 'followers', 게시물: 'posts', 조회: 'views' };
const PLATFORM_LABEL = {
  youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', threads: 'Threads',
  linkedin: 'LinkedIn', telegram: 'Telegram', substack: 'Substack', 'naver-blog': '네이버 블로그',
  'kakao-channel': '카카오 채널', tistory: 'Tistory', pinterest: 'Pinterest', x: 'X', behance: 'Behance',
  'naver-clip': '네이버 클립',
};
const AUTO_PLATFORMS = new Set(['youtube', 'telegram']);
const DAY = 86_400_000;

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

// 적지 않은 칸은 «모름»으로 남긴다. KPI 보고 한 줄은 상위 채널만 보여 주므로 0으로 확정하지 않는다.
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

const number = value => (value === null || value === undefined ? '—' : Number(value).toLocaleString('ko-KR'));
const cell = text => String(text).replace(/\|/g, '\\|');

function followerChange(entries) {
  const withFollowers = entries.filter(e => Number.isFinite(e.followers));
  const latest = withFollowers[withFollowers.length - 1];
  if (!latest) return '—';
  const limit = Date.parse(latest.date) - 7 * DAY;
  const base = [...withFollowers].reverse().find(e => Date.parse(e.date) <= limit);
  if (!base) return '—';
  const diff = latest.followers - base.followers;
  return `${diff > 0 ? '+' : ''}${diff.toLocaleString('ko-KR')} (${base.date.slice(5)} 대비)`;
}

function latestValue(entries, field) {
  for (let i = entries.length - 1; i >= 0; i -= 1) if (entries[i][field] !== undefined) return entries[i][field];
  return undefined;
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
    const how = account.platform === 'telegram' ? '자동(공개 채널만)' : AUTO_PLATFORMS.has(account.platform) ? '자동' : '손';
    const name = `${PLATFORM_LABEL[account.platform] || account.platform} ${account.handle}`.trim();
    if (!last) return `| ${cell(account.brand)} | ${cell(name)} | 아직 안 잼 | — | — | — | — | ${how} · \`${account.key}\` |`;
    return `| ${cell(account.brand)} | ${cell(name)} | ${number(latestValue(entries, 'followers'))} | ${followerChange(entries)} | ${number(latestValue(entries, 'posts'))} | ${number(latestValue(entries, 'views'))} | ${last.date} | ${how} · \`${account.key}\` |`;
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
    '## 상담 신청 — 어디서 알게 됐나',
    '',
    '상담시트 인지채널별 상담 수를 옮겨 적은 값이다. 계정 숫자가 올라도 이 표가 그대로면 사람이 넘어오지 않은 것이다. 「—」는 적지 않아 모르는 칸이고, 그런 칸이 있으면 합에 「이상」이 붙는다. 앱 KPI 보고 한 줄은 상위 다섯 채널만 보여 주므로 나머지는 상담시트에서 센다. 유튜브·텔레그램 칸은 2026-09-18에 더했다. 두 칸이 폼에 반영되기 전 기간에는 두 곳에서 온 문의가 다른 칸에 섞여 있다.',
    '',
    ...(consultRows.length
      ? [`| 기간 | ${CONSULT_COLUMNS.join(' | ')} | 합 |`, `|---|${CONSULT_COLUMNS.map(() => '---|').join('')}---|`, ...consultRows]
      : ['아직 적은 기간이 없다.']),
    '',
    '## 재는 법',
    '',
    '- 자동으로 잴 수 있는 것(YouTube 셋 · Telegram 공개 채널): `node tools/채널성과.js --재기`',
    '- 그 밖의 계정: 앱이나 웹에서 숫자를 보고 `node tools/채널성과.js --적기 <키> 팔로워=N 게시물=N`',
    '- 상담 신청: 상담시트 인지채널을 세어 `node tools/채널성과.js --상담 2026-09-01~2026-09-30 페이스북=N 인스타=N` (모든 칸을 셌으면 끝에 `--전부`를 붙여 나머지를 0으로 채운다)',
    '- 장부만으로 이 요약을 다시 만들기: `node tools/채널성과.js --요약`',
    '',
    '## 아직 못 재는 것',
    '',
    '- Instagram·TikTok·Facebook·LinkedIn 등은 API 연결 전이라 손으로 적는다(연결 상태는 `sns-계정.json`).',
    '',
  ].join('\n');
}

function writeSummary(text, file = SUMMARY_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', text, 'utf8');
  fs.renameSync(file + '.tmp', file);
}

function usage() {
  console.log(`
채널 성과 장부

  node tools/채널성과.js --재기
      YouTube·Telegram 공개 숫자를 재서 장부에 쌓고 요약을 다시 만든다
  node tools/채널성과.js --적기 <계정키> 팔로워=N [게시물=N] [조회=N] [--날짜 YYYY-MM-DD]
      API가 없는 계정의 숫자를 손으로 적는다
  node tools/채널성과.js --상담 <기간> 페이스북=N 인스타=N ... [--전부]
      상담시트 인지채널별 수를 적는다 (기간 예: 2026-09-01~2026-09-30)
      적지 않은 칸은 «모름»으로 남는다. 모든 칸을 셌으면 --전부로 나머지를 0으로 채운다
  node tools/채널성과.js --요약      장부에서 요약만 다시 만든다 (네트워크 안 씀)
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
    return;
  }
  if (args[0] === '--상담') {
    const complete = args.includes('--전부');
    const rest = args.filter(a => a !== '--전부');
    const entry = consultEntry(rest[1], rest.slice(2), { complete });
    appendLedger([entry]);
    writeSummary(summarize({ accounts, ledger: readLedger() }));
    console.log(`적었습니다: 상담 ${entry.period} · 합 ${Object.values(entry.counts).reduce((s, n) => s + n, 0)}`);
    return;
  }
  if (args[0] === '--요약') {
    writeSummary(summarize({ accounts, ledger: readLedger() }));
    console.log('요약을 다시 만들었습니다: docs/마케팅/채널성과.md');
    return;
  }
  if (args[0] === '--재기') {
    const { results, entries } = await measureAll(accounts);
    appendLedger(entries);
    writeSummary(summarize({ accounts, ledger: readLedger() }));
    for (const r of results) {
      if (r.error) console.log(`✗ ${r.account}: ${r.error}`);
      else if (r.skipped) console.log(`· ${r.account}: ${r.skipped}`);
      else console.log(`✓ ${r.account}: 팔로워 ${number(r.followers)}${r.posts !== undefined ? ` · 게시물 ${number(r.posts)} · 조회 ${number(r.views)}` : ''}`);
    }
    console.log(`장부에 ${entries.length}줄을 더했습니다. 요약: docs/마케팅/채널성과.md`);
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
};
