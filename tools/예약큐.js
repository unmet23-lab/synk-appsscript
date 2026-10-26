#!/usr/bin/env node
'use strict';
/* 1일 1편 예약 큐 (2026-10-20). 읽기만 한다(--알림의 텔레그램 한 통 말고는 아무것도 바꾸지 않는다).
 *
 * 브랜드마다 앞으로 며칠이 예약으로 채워져 있는지를 편 폴더의 게시/준비.json·게시/게시결과.json에서 모아 보여 준다.
 * 유호님 10-20 「1일 1편 업로드가 기준인데 만약이란게 있는거잖아 … 4일치를 미리 만들어서 업로드 예약을 걸어놓는거」.
 *
 *   node tools/예약큐.js [--일수 5] [--json] [--폴더 <편 폴더들이 있는 곳, 기본 docs/마케팅>] [--오늘 YYYY-MM-DD(시험용)]
 *   node tools/예약큐.js --서버읽기 [--알림]   회사 서버를 읽기 전용으로 읽어 캐시에 두고 대조한다(AI 없는 정기 작업이 부른다).
 *                                           --알림이면 대조 경고·작업실 승인 대기 계정·검사 「고칠 것」 편이 있을 때만 텔레그램 한 통
 *                                           (같은 날 같은 내용은 한 번)
 *   공통: --서버캐시 <파일>(기본 %LOCALAPPDATA%\synk\예약큐\서버.json)
 *
 * 준비.json(편 폴더 게시/): {"브랜드","날짜"(만든 날),"슬롯"(올릴 날 YYYY-MM-DD),"성격":"시의성"|"상시",
 *   "역할"(10-21~22 옛 편에만 — 편 줄에 보이기만 한다),"시한"(시의성이면 늦어도 올릴 날),"상태","제목","판":[{"계정","파일","시각"}],
 *   "검사":{"결과","파일":[{"경로","바이트","수정"}]}(tools/올리기전검사.js가 남긴다)}
 * 게시결과.json(같은 폴더): {"판":[{"계정","상태":"승인 대기"|"예약됨"|"게시됨"|"실패"|"보류","시각","주소","방법":"작업실"?,"작업"?}]}
 * 한 편은 판이 모두 예약됨·게시됨이면 「채움」, 일부만이면 「일부」, 하나도 없으면 「승인 대기」다. 작업실 판의 「승인 대기」(유호님이 검토 링크를
 * 누르기 전)는 서버가 보내지 않으니 채움이 아니다. 올리기 전 검사가 「고칠 것」이거나 검사 뒤 영상이 바뀐 편은 「고칠 것」(✗)으로 보인다.
 * 비축 일수는 내일부터 이어서 「채움」인 날 수다. SYNK SHIFT는 판 계정이 shift- 로 시작하는 것을 따로 센다. 계정별 줄은 판 계정마다 같은 셈이다.
 * 서버 대조(10-21): 작업실(회사 서버) 캐시가 있으면 ① 작업실로 건 판은 서버 예약 작업의 실제 상태(승인 대기·예약됨·게시됨·실패)로 바꿔 보고,
 * 게시결과에는 있는데 서버에 그 작업이 없으면 「예약됨인데 서버에 없음」 ② 크롬으로 건 판은 슬롯 시각 2시간 뒤에도 채널 수집기가 본 공개 게시물
 * (그 계정 채널, 시각 ±6시간)이 없으면 「슬롯이 지났는데 나가지 않음」을 띄운다. 크롬 예약은 공개 전에는 API로 볼 수 없어 슬롯 전에는 대조하지 않는다.
 * 10-23 한 주 역할 없앰(결정 10-23): 역할 수를 한 주 목표(옛 3-1-2-1)와 견주지 않는다. 옛 편 준비.json의 「역할」은 편 줄에 그대로 보인다.
 * --json에서 roleGoal·roles·roleIssues는 빠졌다(저장소 안에서 읽는 곳 없음, 10-23 확인).
 * 10-26 매일 판 · 비축 목표 4일(유호님 「하루에 모든 계정에 하나씩 … 며칠 전에 이미 예약으로 준비해 둬야 해」, 결정 10-26):
 * sns-계정.json 계정의 dailyLine(07시가 하루 한 편을 만드는 「줄」)·dailyBlocked(막혀 셈에서 뺌)·dailyOff(매일 판 밖)를 읽어
 * 줄 표를 낸다. 줄의 비축 = 내일부터 그 줄의 (막힘 아닌) 모든 계정이 예약·게시인 날 수, 맨 위 비축은 줄 비축의 최솟값이다.
 * 블로그 판(naver-blog·tistory)은 쇼츠 주소가 공개 뒤에야 생겨 영상 뒤에 거니, 같은 편의 영상 판이 예약·게시면 채움으로 센다.
 * --알림은 21시 뒤 하루 한 번 비축이 4일보다 모자라면 빈 칸을 한 통으로 보내고(10-23 「비축 모자람 알리지 않음」을 되돌림),
 * 같은 날 같은 계정에 두 편 · 작업실 검토 링크가 승인 전에 만료되거나 24시간 안에 만료되면 경고에 넣는다(링크 자체는 읽지도 적지도 않는다).
 *   node tools/예약큐.js --계정표   계정 전수 표(계정 · 매일 무엇이 · 올리는 길 · 며칠 앞서 · 막힌 것)를 마크다운으로
 *   시험용: --지금 <YYYY-MM-DDTHH:MM+09:00>(지금 시각과 오늘을 함께 정한다)
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const argValue = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const ROOT = argValue('--폴더') ? path.resolve(argValue('--폴더')) : path.join(REPO, 'docs', '마케팅');
const BRANDS = ['LAB', 'synkbrief', 'yuhobuilds', 'SHIFT'];
const DONE = new Set(['예약됨', '게시됨']);
const STATE_DIR = process.env.SYNK_QUEUE_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'synk', '예약큐');
// --폴더로 다른 곳(시험 등)을 보면 이 PC의 작업실 캐시는 그 편들과 상관없으니, --서버캐시를 따로 줄 때만 읽는다.
const CACHE = argValue('--서버캐시') ? path.resolve(argValue('--서버캐시')) : argValue('--폴더') ? null : path.join(STATE_DIR, '서버.json');
const GRACE_MS = 2 * 3600000;
const WINDOW_MS = 6 * 3600000;
const LOOKBACK_DAYS = 3;
const LEAD = 4; // 비축 목표(일) — 07시가 D+4 편을 만든다(제작 절차 0)
const RESERVE_ALERT_HOUR = 21; // 비축 알림은 그날 슬롯이 나간 뒤 한 번
const BLOG = new Set(['naver-blog', 'tistory']);
const LINE_ORDER = ['LAB 영어', 'LAB 몽골', 'LAB 두 채널', 'synkbrief', 'yuhobuilds'];
// 작업실 검토 링크 기록(tools/작업실예약.js LOCAL_DIR). 만료 시각과 편 이름만 읽는다. --폴더로 다른 곳을 보면 따로 줄 때만.
const LINK_DIR = process.env.SYNK_WORKSPACE_LINK_DIR
  || (argValue('--폴더') ? null : path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'synk', '작업실예약'));
// 시험은 SYNK_HERMES_EXE=file:<경로>로 보내는 대신 파일에 적는다.
const HERMES = process.env.SYNK_HERMES_EXE || path.join(process.env.LOCALAPPDATA || '', 'hermes', 'bin', 'hermes.exe');
const TELEGRAM = 'telegram:6017495834';

function kstDate(ms = Date.now()) {
  return new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function addDays(day, n) {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function isDay(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; }
}

function slotOf(prep) {
  if (prep.슬롯) return String(prep.슬롯).slice(0, 10);
  const first = (prep.판 || []).map((p) => p.시각).filter(Boolean).sort()[0];
  return first ? kstDate(Date.parse(first)) : null;
}

// 올리기 전 검사 기록과 지금 영상이 같은지. 검사 기록의 경로는 그 편이 든 저장소 기준이다.
function checkOf(prep) {
  const record = prep.검사;
  if (!record) return { result: '검사 전', stale: false };
  const repo = path.resolve(ROOT, '..', '..');
  // 영상은 git 밖이라 다른 작업본(워크트리)에서는 없을 수 있다 — 없으면 모른다고 보고, 있는데 다를 때만 「다시 검사」.
  const stale = (record.파일 || []).some((f) => {
    try {
      const stat = fs.statSync(path.join(repo, f.경로));
      return stat.size !== f.바이트 || new Date(stat.mtimeMs).toISOString() !== f.수정;
    } catch { return false; }
  });
  return { result: record.결과 || '검사 전', stale };
}

const { handleOf } = require('./lib/게시묶음.js');
const 헤르메스 = require('./lib/헤르메스보내기.js');

// 판 계정 키(sns-계정.json) → 서버 채널 id들. 핸들이나 유튜브 채널 ID로 맞춘다.
function channelsFor(account, accounts, server) {
  const a = accounts[account];
  if (!a || !server) return [];
  const want = handleOf(a.handle || a.expectedHandle);
  return server.channels.filter((c) => c.platform === a.platform && ((a.expectedChannelId && c.externalId === a.expectedChannelId)
    || (want && [c.handle, c.name, c.url].some((v) => handleOf(v) === want)))).map((c) => c.id);
}

function serverState(job) {
  if (job.status === 'scheduled') return job.reviewWaiting ? '승인 대기' : '예약됨';
  if (['publishing', 'accepted', 'processing'].includes(job.status)) return '예약됨';
  if (job.status === 'published') return '게시됨';
  if (job.status === 'unknown') return '확인 필요';
  if (job.status === 'manual') return '손으로';
  return '실패';
}

function collect(server, accounts, now) {
  const items = [];
  for (const dir of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const base = path.join(ROOT, dir.name, '게시');
    const prep = readJson(path.join(base, '준비.json'));
    if (!prep || !prep.브랜드) continue;
    const result = readJson(path.join(base, '게시결과.json')) || {};
    const done = new Map();
    for (const p of result.판 || []) if (p.계정) done.set(p.계정, p);
    const check = checkOf(prep);
    const groups = { [prep.브랜드]: [], SHIFT: [] };
    for (const p of prep.판 || []) (String(p.계정 || '').startsWith('shift-') ? groups.SHIFT : groups[prep.브랜드]).push(p);
    for (const [brand, plates] of Object.entries(groups)) {
      if (!plates.length) continue;
      const warnings = [];
      const states = plates.map((p) => {
        const local = done.get(p.계정) || {};
        const at = Date.parse(p.시각 || local.시각 || '');
        let state = local.상태;
        let url = local.주소 || null;
        if (server && local.방법 === '작업실') {
          const job = server.jobs.find((j) => j.id === local.작업);
          if (job) { state = serverState(job); url = job.publicationUrl || url; }
          else if (['승인 대기', '예약됨'].includes(local.상태)) {
            warnings.push(`예약됨인데 서버에 없음: ${p.계정} · ${dir.name}`);
            state = '서버에 없음';
          }
        } else if (server && state === '예약됨' && Number.isFinite(at) && at + GRACE_MS < now) {
          const ids = channelsFor(p.계정, accounts, server);
          const seen = ids.length ? server.posts.find((post) => ids.includes(post.channelId) && Math.abs(Date.parse(post.publishedAt) - at) <= WINDOW_MS) : null;
          if (seen) { state = '게시됨'; url = url || seen.url; } else if (ids.length) warnings.push(`슬롯이 지났는데 나가지 않음: ${p.계정} · ${kstDate(at)} · ${dir.name}`);
        }
        if (Number.isFinite(at) && at + GRACE_MS < now && at > now - LOOKBACK_DAYS * 86400000 && !DONE.has(state) && state !== '보류') {
          warnings.push(`슬롯이 지났는데 예약도 게시도 안 됨: ${p.계정} · ${kstDate(at)} · ${dir.name}`);
        }
        return { account: p.계정, platform: accounts[p.계정]?.platform || null, time: p.시각 || null, state: state || null, method: local.방법 || null, url };
      });
      const filled = states.filter((s) => DONE.has(s.state)).length;
      const held = states.filter((s) => s.state === '보류').length;
      items.push({
        brand, folder: dir.name, title: prep.제목 || dir.name, slot: slotOf(prep),
        kind: prep.성격 || null, role: prep.역할 || null, deadline: prep.시한 || null,
        state: filled === plates.length ? '채움' : filled ? '일부' : held === plates.length ? '보류' : '승인 대기',
        failed: states.filter((s) => s.state === '실패').length,
        check: check.stale ? '다시 검사' : check.result,
        plates: states, warnings,
      });
    }
  }
  return items;
}

const fixNeeded = (x) => x.state !== '채움' && ['고칠 것', '다시 검사'].includes(x.check);
const dayOf = (plate, item) => (plate.time && Number.isFinite(Date.parse(plate.time)) ? kstDate(Date.parse(plate.time)) : item.slot);

// 매일 판의 줄(sns-계정.json dailyLine). 막힌 계정(dailyBlocked)은 줄에 적되 셈에서 뺀다.
function dailyLines(accounts) {
  const lines = new Map();
  for (const [key, a] of Object.entries(accounts)) {
    if (!a.dailyLine) continue;
    if (!lines.has(a.dailyLine)) lines.set(a.dailyLine, { line: a.dailyLine, accounts: [], blocked: [] });
    if (a.dailyBlocked) lines.get(a.dailyLine).blocked.push({ account: key, reason: a.dailyBlocked });
    else lines.get(a.dailyLine).accounts.push(key);
  }
  const rank = (l) => (LINE_ORDER.includes(l) ? LINE_ORDER.indexOf(l) : LINE_ORDER.length);
  return [...lines.values()].sort((x, y) => rank(x.line) - rank(y.line) || x.line.localeCompare(y.line));
}
const blockedAccounts = (accounts) => dailyLines(accounts).flatMap((l) => l.blocked.map((b) => ({ ...b, line: l.line })));

// 계정별: 판 계정마다 그 날 판이 예약·게시됐는지. 매일 판 계정은 비어 있어도 줄을 낸다.
function accountRows(items, range, accounts = {}) {
  const rows = new Map();
  const rowOf = (account, brand) => {
    if (!rows.has(account)) rows.set(account, { account, brand, line: accounts[account]?.dailyLine || null, byDay: Object.fromEntries(range.map((d) => [d, []])) });
    return rows.get(account);
  };
  // 블로그 판은 영상이 공개된 뒤 쇼츠 주소를 넣어 거니, 같은 편(폴더)의 영상 판이 예약·게시면 그 블로그 칸도 채움으로 본다(10-26).
  // SHIFT 블로그 판은 collect가 따로 떼어 SHIFT 줄로 두니 편 폴더로 맞춘다.
  const videoDone = new Set(items.flatMap((x) => (x.plates.some((p) => !BLOG.has(p.platform) && DONE.has(p.state)) ? [x.folder] : [])));
  for (const item of items) {
    for (const plate of item.plates) {
      if (!plate.account) continue;
      const day = dayOf(plate, item);
      if (!day || !range.includes(day)) continue;
      const done = DONE.has(plate.state) || (BLOG.has(plate.platform) && videoDone.has(item.folder));
      rowOf(plate.account, item.brand).byDay[day].push({ state: plate.state, done, folder: item.folder, fix: fixNeeded(item) });
    }
  }
  for (const [key, a] of Object.entries(accounts)) if (a.dailyLine && !a.dailyBlocked) rowOf(key, a.dailyLine.startsWith('LAB') ? 'LAB' : a.dailyLine);
  for (const row of rows.values()) {
    row.reserve = 0;
    for (const d of range.slice(1)) { if (row.byDay[d].some((p) => p.done)) row.reserve += 1; else break; }
  }
  const order = (r) => (r.line ? LINE_ORDER.indexOf(r.line) + 1 || LINE_ORDER.length + 1 : LINE_ORDER.length + 2);
  return [...rows.values()].sort((a, b) => order(a) - order(b) || BRANDS.indexOf(a.brand) - BRANDS.indexOf(b.brand) || a.account.localeCompare(b.account));
}

// 한 계정 한 날 — 채움(예약·게시) · 만듦(올릴 준비·승인 대기 등) · 고칠 것 · 보류뿐 · 빔
function cellState(list) {
  if (!list.length) return '빔';
  if (list.some((p) => p.done)) return '채움';
  if (list.every((p) => p.state === '보류')) return '보류';
  if (list.some((p) => p.fix)) return '고칠 것';
  return '만듦';
}

// 줄 표: 줄마다 날짜별로 그 줄 계정들이 어떤지, 비축(내일부터 모든 계정 채움인 날 수), 만듦(내일부터 모든 계정에 편이 있는 날 수).
function lineRows(accountList, range, accounts) {
  const byAccount = new Map(accountList.map((r) => [r.account, r]));
  // 막힌 계정만 있는 줄은 셈하지 않는다(막힘 목록에만 보인다).
  return dailyLines(accounts).filter((l) => l.accounts.length).map((l) => {
    const byDay = {};
    for (const d of range) {
      const cells = Object.fromEntries(l.accounts.map((a) => [a, cellState(byAccount.get(a)?.byDay[d] || [])]));
      const states = Object.values(cells);
      const mark = !states.length ? '·' : states.every((s) => s === '채움') ? '●' : states.some((s) => s === '고칠 것') ? '✗'
        : states.every((s) => s === '빔') ? '·' : states.every((s) => s === '보류') ? '×' : states.every((s) => s !== '빔') ? '○' : '◐';
      byDay[d] = { mark, cells };
    }
    const run = (ok) => { let n = 0; for (const d of range.slice(1)) { if (ok(byDay[d])) n += 1; else break; } return n; };
    return { line: l.line, accounts: l.accounts, byDay,
      reserve: run((x) => x.mark === '●'), made: run((x) => Object.values(x.cells).every((s) => s === '채움' || s === '만듦')) };
  });
}

// 같은 날 같은 계정에 두 편(블로그 · 보류 판은 뺀다) — 계정마다 하루 한 편(결정 10-23 ①).
function doubleBookings(accountList) {
  const out = [];
  for (const row of accountList) {
    for (const [day, list] of Object.entries(row.byDay)) {
      const folders = [...new Set(list.filter((p) => p.state !== '보류').map((p) => p.folder))];
      if (folders.length > 1 && !/(naverblog|tistory)$/.test(row.account)) out.push(`같은 날 두 편: ${row.account} · ${day} · ${folders.join(', ')}`);
    }
  }
  return out;
}

// 작업실 검토 링크가 승인 전에 만료됐거나 24시간 안에 만료되는 편. 링크 기록에서 편 이름과 만료 시각만 읽는다.
function linkWarnings(items, now) {
  if (!LINK_DIR) return [];
  let names = [];
  try { names = fs.readdirSync(LINK_DIR).filter((n) => n.endsWith('.json')); } catch { return []; }
  const out = [];
  for (const name of names) {
    const record = readJson(path.join(LINK_DIR, name));
    const until = Date.parse(record?.만료 || '');
    if (!record?.편 || !Number.isFinite(until)) continue;
    const waiting = items.some((x) => x.folder === record.편 && x.plates.some((p) => p.method === '작업실' && p.state === '승인 대기'));
    if (!waiting) continue;
    if (until <= now) out.push(`검토 링크가 승인 전에 만료: ${record.편} — 14시 게시 작업이 \`node tools/작업실예약.js 취소\` 뒤 다시 등록`);
    else if (until - now < 24 * 3600000) out.push(`검토 링크가 24시간 안에 만료(${new Date(until + 9 * 3600000).toISOString().slice(5, 16).replace('T', ' ')}): ${record.편}`);
  }
  return out;
}

async function loadServer(live) {
  if (live) {
    const 읽기 = require('./lib/작업실읽기.cjs');
    const data = await 읽기.읽기();
    const file = CACHE || path.join(STATE_DIR, '서버.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ version: 1, ...data }));
    return data;
  }
  if (!CACHE) return null;
  const cached = readJson(CACHE);
  if (!cached) return null;
  try { return require('./lib/작업실읽기.cjs').다듬기(cached); } catch { return null; }
}

function build(today, days, server, accounts, now) {
  const range = Array.from({ length: days }, (_, k) => addDays(today, k));
  const items = collect(server, accounts, now);
  const report = { today, range, brands: {}, unslotted: items.filter((x) => !x.slot) };
  for (const brand of BRANDS) {
    const mine = items.filter((x) => x.brand === brand && x.slot);
    const byDay = Object.fromEntries(range.map((d) => [d, mine.filter((x) => x.slot === d)]));
    let reserve = 0;
    for (const d of range.slice(1)) {
      if (byDay[d].some((x) => x.state === '채움')) reserve += 1; else break;
    }
    const late = mine.filter((x) => x.deadline && x.state !== '채움' && x.deadline < (x.slot || today));
    report.brands[brand] = { reserve, byDay, late };
  }
  report.accounts = accountRows(items, range, accounts);
  report.lead = LEAD;
  report.lines = lineRows(report.accounts, range, accounts);
  report.blocked = blockedAccounts(accounts);
  report.reserve = report.lines.length ? Math.min(...report.lines.map((l) => l.reserve)) : null;
  // 보류 편은 나가지 않으니 검사가 「고칠 것」이어도 세지 않는다(10-23 — 알림이 고칠 것 하나만으로도 나가게 되면서).
  report.fix = items.filter((x) => fixNeeded(x) && x.state !== '보류' && x.slot && x.slot >= today);
  report.warnings = [...new Set([...items.flatMap((x) => x.warnings), ...doubleBookings(report.accounts), ...linkWarnings(items, now)])];
  report.server = server ? { checkedAt: server.checkedAt, ageHours: server.checkedAt ? Math.round((now - Date.parse(server.checkedAt)) / 360000) / 10 : null } : null;
  return report;
}

function mark(list) {
  if (!list.length) return '·';
  if (list.some((x) => x.state === '채움')) return '●';
  if (list.some((x) => x.state === '일부')) return '◐';
  if (list.every((x) => x.state === '보류')) return '×';
  if (list.some(fixNeeded)) return '✗';
  return '○';
}

function accountMark(list) {
  if (!list.length) return '·';
  if (list.some((p) => p.done)) return '●';
  if (list.every((p) => p.state === '보류')) return '×';
  if (list.some((p) => p.fix)) return '✗';
  return '○';
}

const WHY = { 빔: '만든 편 없음', 만듦: '승인·예약 전', '고칠 것': '검사 고칠 것', 보류: '보류' };

// 줄마다 내일~D+4에서 채움이 아닌 칸 — 「10-29 만든 편 없음 · 10-30 lab-tiktok 승인·예약 전」
function gapsOf(line, range) {
  const out = [];
  for (const d of range.slice(1, LEAD + 1)) {
    const cells = line.byDay[d]?.cells || {};
    const notDone = Object.entries(cells).filter(([, s]) => s !== '채움');
    if (!notDone.length) continue;
    const kinds = [...new Set(notDone.map(([, s]) => s))];
    const whole = notDone.length === Object.keys(cells).length && kinds.length === 1;
    out.push(`${d.slice(5)} ${whole ? WHY[kinds[0]] : notDone.map(([a, s]) => `${a} ${WHY[s]}`).join(', ')}`);
  }
  return out;
}

function print(report) {
  const { range } = report;
  if (report.lines.length) {
    console.log(`비축 ${report.reserve}일 / 목표 ${report.lead}일 · 매일 판 줄 · ● 모든 계정 예약·게시  ○ 모든 계정에 편(승인·예약 전 있음)  ◐ 빈 계정 있음  ✗ 고칠 것  · 빔`);
    console.log('줄'.padEnd(12) + range.map((d) => d.slice(5)).join('  ') + '  비축  만듦');
    for (const l of report.lines) console.log(l.line.padEnd(12) + range.map((d) => l.byDay[d].mark.padEnd(5)).join('  ') + `  ${l.reserve}일   ${l.made}일`);
    for (const l of report.lines) { const gaps = gapsOf(l, range); if (gaps.length) console.log(`  ${l.line} 빈 칸: ${gaps.join(' · ')}`); }
  }
  if (report.blocked.length) console.log(`  막혀 셈에서 뺀 계정: ${report.blocked.map((b) => `${b.account}(${b.reason})`).join(' · ')}`);
  console.log(`예약 큐 · 오늘 ${report.today} · ● 채움  ◐ 일부  ○ 승인 대기  ✗ 고칠 것(검사)  × 보류(게시결과 「보류」)  · 빔`);
  console.log('브랜드'.padEnd(12) + range.map((d) => d.slice(5)).join('  ') + '  비축');
  for (const brand of BRANDS) {
    const b = report.brands[brand];
    console.log(brand.padEnd(12) + range.map((d) => mark(b.byDay[d]).padEnd(5)).join('  ') + `  ${b.reserve}일`);
  }
  if (report.accounts.length) {
    console.log(`계정별 · ● 예약·게시  ○ 승인 대기·준비  ✗ 고칠 것  · 빔`);
    for (const row of report.accounts) console.log(row.account.slice(0, 22).padEnd(23) + range.map((d) => accountMark(row.byDay[d]).padEnd(5)).join('  ') + `  ${row.reserve}일`);
  }
  for (const brand of BRANDS) {
    for (const d of range) for (const x of report.brands[brand].byDay[d]) {
      const plates = x.plates.filter((p) => p.method === '작업실' || p.state === '승인 대기' || p.state === '서버에 없음');
      console.log(`  ${d} ${brand} ${x.state}${x.failed ? ` (실패 ${x.failed})` : ''} · ${x.title} · ${x.kind || '성격 없음'}${x.role ? ` · 역할 ${x.role}` : ''}${x.deadline ? ` · 시한 ${x.deadline}` : ''} · ${x.folder}`
        + `${{ 통과: '', '검사 전': ' · 검사 전', '다시 검사': ' · 검사 뒤 영상 바뀜(다시 검사)' }[x.check] ?? ` · 검사 ${x.check}`}${plates.length ? ` · ${plates.map((p) => `${p.account} ${p.state || '—'}`).join(', ')}` : ''}`);
    }
    for (const x of report.brands[brand].late) console.log(`  ! ${brand} 시한 넘김: ${x.title}(시한 ${x.deadline}, 슬롯 ${x.slot})`);
  }
  for (const x of report.unslotted) console.log(`  ? 슬롯 없음: ${x.brand} · ${x.title} · ${x.folder}`);
  for (const w of report.warnings) console.log(`  ! ${w}`);
  console.log(report.server ? `서버 대조: ${report.server.checkedAt ? report.server.checkedAt.replace('T', ' ').slice(0, 16) + 'Z' : '시각 모름'} 읽음(${report.server.ageHours}시간 전)`
    : '서버 대조 없음 — 작업실 캐시가 없다(정기 작업 「SYNK 예약큐」가 node tools/예약큐.js --서버읽기 --알림으로 채운다)');
}

function send(text) {
  if (HERMES.startsWith('file:')) { fs.appendFileSync(HERMES.slice(5), text + '\n---\n'); return; }
  const r = 헤르메스.보내기(HERMES, TELEGRAM, text);
  if (!r.ok) throw new Error('텔레그램 보내기 실패: ' + r.error);
  if (r.note) console.error(r.note);
}

// 비축이 목표(4일)보다 모자라면 21시 뒤 하루 한 번 빈 칸을 한 통으로(10-26 — 10-23 「비축 모자람 알리지 않음」을 되돌림).
function reserveAlert(report, now) {
  if (!report.lines.length) return { sent: false, reason: 'no-lines' };
  if (report.reserve >= report.lead) return { sent: false, reason: 'enough' };
  if (Number(new Date(now + 9 * 3600000).toISOString().slice(11, 13)) < RESERVE_ALERT_HOUR) return { sent: false, reason: 'before-hour' };
  const stateFile = path.join(STATE_DIR, '비축알림.json');
  if ((readJson(stateFile) || {}).day === report.today) return { sent: false, reason: 'same-today' };
  const text = [`[비축] ${report.today} · 목표 ${report.lead}일 · 지금 ${report.reserve}일`,
    ...report.lines.filter((l) => l.reserve < report.lead).map((l) => `${l.line} ${l.reserve}일 — ${gapsOf(l, report.range).join(' · ') || '--일수가 짧아 내일부터 칸을 못 봄'}`),
    '「만든 편 없음」은 19:30 후보에서 번호를 골라 주시면 07시가 만들고, 「승인·예약 전」은 검토 링크 승인이나 14시 「올려」로 채워져요'].join('\n');
  send(text);
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({ day: report.today, sentAt: new Date(now).toISOString() }));
  return { sent: true, text };
}

// 대조 경고·작업실 승인 대기 계정·검사 「고칠 것」 편이 있을 때만 텔레그램으로. 같은 날 같은 내용은 다시 보내지 않는다(AI 없음).
// 비축 모자람은 reserveAlert가 따로 하루 한 번 보낸다.
function alert(report) {
  const waiting = report.accounts.filter((row) => Object.values(row.byDay).flat().some((p) => p.state === '승인 대기')).map((row) => row.account);
  // SHIFT 판을 품은 편은 브랜드 줄과 SHIFT 줄 두 번 나오니 폴더로 한 번만 적는다.
  const fix = [...new Set(report.fix.map((x) => x.folder))];
  if (!report.warnings.length && !waiting.length && !fix.length) return { sent: false, reason: 'nothing' };
  const lines = [
    `[게시 큐] ${report.today}`,
    ...(waiting.length ? [`작업실 승인 대기 계정: ${waiting.join(' · ')} — 텔레그램으로 받은 검토 링크를 누르면 예약이 걸려요`] : []),
    ...report.warnings.slice(0, 8).map((w) => `! ${w}`),
    ...(fix.length ? [`검사 「고칠 것」 편: ${fix.join(' · ')}`] : []),
  ];
  const text = lines.join('\n');
  const stateFile = path.join(STATE_DIR, '알림.json');
  const last = readJson(stateFile) || {};
  const key = `${report.today}|${text}`;
  // 그날 보낸 내용을 모두 기억한다 — 마지막 하나만 두면 A → A·B → A처럼 내용이 바뀌었다 돌아올 때 A가 다시 나간다(10-23 GPT 검수).
  const sentToday = last.day === report.today && Array.isArray(last.keys) ? last.keys : (last.key ? [last.key] : []);
  if (sentToday.includes(key)) return { sent: false, reason: 'same-today' };
  send(text);
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const keys = [...sentToday.filter((k) => k.startsWith(`${report.today}|`)), key];
  fs.writeFileSync(stateFile, JSON.stringify({ day: report.today, key, keys, sentAt: new Date().toISOString() }));
  return { sent: true, text };
}

// ── 계정 전수 표(--계정표) ──
// 작업실(회사 서버)이 자동 게시로 올리는 판 — tools/작업실예약.js 머리말의 여섯 계정.
const WORKSPACE_PUBLISH = new Set(['lab-youtube', 'lab-instagram', 'synkbrief-instagram', 'synkbrief-youtube', 'yuhobuilds-instagram', 'yuhobuilds-youtube']);
// 플랫폼마다 올리는 길과 며칠 앞서 예약되는지(10-26 확인: 틱톡·샤오훙수·비즈니스 스위트는 바깥 정리 기준 — 첫 D+4 예약 때 화면으로 본다).
const ROUTE = {
  workspace: ['작업실 자동(검토 링크 승인 뒤 서버가 올림)', '7일(링크 수명 = 슬롯+24시간, 최대 168시간)'],
  youtube: ['유튜브 스튜디오 예약 또는 tools/sns-발행.js', '제한 없음'],
  instagram: ['Meta Business Suite 예약(ego)', '75일'],
  facebook: ['Meta Business Suite 예약(ego)', '75일'],
  tiktok: ['TikTok Studio 예약(그 계정 ego 프로필)', '10일'],
  xiaohongshu: ['크리에이터 센터 定时发布(ego)', '14일'],
  'naver-blog': ['네이버 예약 발행(Aside) — 첫 예약 확인 전, 막히면 붙여넣기 판', '확인 전'],
  tistory: ['티스토리 예약 발행(Aside)', '확인 전'],
  telegram: ['텔레그램 웹 예약 메시지(ego)', '첫 예약 때 확인'],
  threads: ['스레드 웹 예약(ego)', '로그인 뒤 확인'],
  x: ['X 웹 예약(ego)', '로그인 뒤 확인'],
  linkedin: ['링크드인 웹 예약(ego)', '로그인 뒤 확인'],
  'naver-clip': ['네이버 클립 — 웹 올리기 확인 전', '확인 전'],
  rutube: ['러튜브 스튜디오(손)', '확인 전'],
};
const LINE_WHAT = { 'LAB 영어': 'LAB 영어 편', 'LAB 몽골': 'LAB 몽골 편', synkbrief: 'synkbrief 편', yuhobuilds: 'yuhobuilds 편' };

function accountTable(accounts) {
  const what = (key, a) => {
    if (a.dailyLine === 'LAB 두 채널') return a.platform === 'xiaohongshu' ? 'LAB 두 채널 판(간체)' : 'LAB 두 채널 판(버마어)';
    const base = LINE_WHAT[a.dailyLine] || a.dailyLine;
    return BLOG.has(a.platform) ? `${base}의 블로그 글` : base;
  };
  const rows = Object.entries(accounts).map(([key, a]) => {
    const [route, ahead] = WORKSPACE_PUBLISH.has(key) ? ROUTE.workspace : (ROUTE[a.platform] || ['—', '—']);
    const handle = String(a.handle || a.expectedHandle || '').replace(/\|/g, '/');
    if (a.dailyLine) return { key, order: 0, cells: [key, handle, what(key, a), route, ahead, a.dailyBlocked ? `막힘 — ${a.dailyBlocked}` : '—'] };
    return { key, order: 1, cells: [key, handle, '매일 판 밖', route, ahead, a.dailyOff || '정하지 않음'] };
  });
  const lineRank = (key) => { const l = accounts[key].dailyLine; return l ? (LINE_ORDER.indexOf(l) + 1 || 99) : 100; };
  rows.sort((x, y) => x.order - y.order || lineRank(x.key) - lineRank(y.key) || x.key.localeCompare(y.key));
  const daily = rows.filter((r) => r.order === 0);
  return [`계정 ${rows.length}개 · 매일 판 ${daily.filter((r) => r.cells[5] === '—').length} · 막힘 ${daily.filter((r) => r.cells[5] !== '—').length} · 매일 판 밖 ${rows.length - daily.length}`, '',
    '| 계정 | 핸들 | 매일 무엇이 | 올리는 길 | 며칠 앞서 | 막힌 것 · 까닭 |', '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.cells.join(' | ')} |`)].join('\n');
}

async function main() {
  const days = Math.max(1, Number(argValue('--일수') || 5) || 5);
  const accounts = (readJson(path.join(ROOT, 'sns-계정.json')) || {}).accounts || {};
  if (process.argv.includes('--계정표')) { console.log(accountTable(accounts)); return; }
  // 시험용 --지금은 시각까지, --오늘은 그날 정오(한국 시각)를 지금으로 본다.
  const given = argValue('--지금') ? Date.parse(argValue('--지금')) : NaN;
  if (argValue('--지금') && !Number.isFinite(given)) { console.error('--지금은 YYYY-MM-DDTHH:MM+09:00 꼴로 준다'); process.exit(2); }
  const today = argValue('--오늘') || (Number.isFinite(given) ? kstDate(given) : kstDate());
  if (!isDay(today)) { console.error('--오늘은 실제 있는 날짜를 YYYY-MM-DD로 준다'); process.exit(2); }
  const now = Number.isFinite(given) ? given : argValue('--오늘') ? Date.parse(`${today}T12:00:00+09:00`) : Date.now();
  let server = null;
  try { server = await loadServer(process.argv.includes('--서버읽기')); } catch (error) {
    if (process.argv.includes('--서버읽기')) { console.error(`서버 읽기 실패: ${error.message}`); process.exitCode = 1; }
  }
  const report = build(today, days, server, accounts, now);
  if (process.argv.includes('--알림')) { report.alert = alert(report); report.reserveAlert = reserveAlert(report, now); }
  if (process.argv.includes('--json')) { console.log(JSON.stringify(report, null, 2)); return; }
  print(report);
  if (report.alert?.sent || report.reserveAlert?.sent) console.log('텔레그램으로 알렸다');
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
