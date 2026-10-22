#!/usr/bin/env node
'use strict';
/* 1일 1편 예약 큐 (2026-10-20). 읽기만 한다(--알림의 텔레그램 한 통 말고는 아무것도 바꾸지 않는다).
 *
 * 브랜드마다 앞으로 며칠이 예약으로 채워져 있는지를 편 폴더의 게시/준비.json·게시/게시결과.json에서 모아 보여 준다.
 * 유호님 10-20 「1일 1편 업로드가 기준인데 만약이란게 있는거잖아 … 4일치를 미리 만들어서 업로드 예약을 걸어놓는거」.
 *
 *   node tools/예약큐.js [--일수 5] [--json] [--폴더 <편 폴더들이 있는 곳, 기본 docs/마케팅>] [--오늘 YYYY-MM-DD(시험용)]
 *   node tools/예약큐.js --서버읽기 [--알림]   회사 서버를 읽기 전용으로 읽어 캐시에 두고 대조한다(AI 없는 정기 작업이 부른다).
 *                                           --알림이면 비축 2일 아래 브랜드나 대조 문제가 있을 때 텔레그램 한 통(같은 날 같은 내용은 한 번)
 *   공통: --서버캐시 <파일>(기본 %LOCALAPPDATA%\synk\예약큐\서버.json)
 *
 * 준비.json(편 폴더 게시/): {"브랜드","날짜"(만든 날),"슬롯"(올릴 날 YYYY-MM-DD),"성격":"시의성"|"상시",
 *   "역할":"유입"|"육성"|"권위"|"전환"(10-21~),"시한"(시의성이면 늦어도 올릴 날),"상태","제목","판":[{"계정","파일","시각"}],
 *   "검사":{"결과","파일":[{"경로","바이트","수정"}]}(tools/올리기전검사.js가 남긴다)}
 * 게시결과.json(같은 폴더): {"판":[{"계정","상태":"승인 대기"|"예약됨"|"게시됨"|"실패"|"보류","시각","주소","방법":"작업실"?,"작업"?}]}
 * 한 편은 판이 모두 예약됨·게시됨이면 「채움」, 일부만이면 「일부」, 하나도 없으면 「승인 대기」다. 작업실 판의 「승인 대기」(유호님이 검토 링크를
 * 누르기 전)는 서버가 보내지 않으니 채움이 아니다. 올리기 전 검사가 「고칠 것」이거나 검사 뒤 영상이 바뀐 편은 「고칠 것」(✗)으로 보인다.
 * 비축 일수는 내일부터 이어서 「채움」인 날 수다. SYNK SHIFT는 판 계정이 shift- 로 시작하는 것을 따로 센다. 계정별 줄은 판 계정마다 같은 셈이다.
 * 서버 대조(10-21): 작업실(회사 서버) 캐시가 있으면 ① 작업실로 건 판은 서버 예약 작업의 실제 상태(승인 대기·예약됨·게시됨·실패)로 바꿔 보고,
 * 게시결과에는 있는데 서버에 그 작업이 없으면 「예약됨인데 서버에 없음」 ② 크롬으로 건 판은 슬롯 시각 2시간 뒤에도 채널 수집기가 본 공개 게시물
 * (그 계정 채널, 시각 ±6시간)이 없으면 「슬롯이 지났는데 나가지 않음」을 띄운다. 크롬 예약은 공개 전에는 API로 볼 수 없어 슬롯 전에는 대조하지 않는다.
 * 역할(10-21, 가설 — v2 §6 「한 주 역할」 · 팁 장부 21행): 브랜드마다 이번 주·다음 주(월~일 슬롯)의 역할 수를 한 주 목표
 * 유입 3 · 육성 1 · 권위 2 · 전환 1과 견줘 빈 역할과 그 주에 남은 빈 날(오늘부터 보류 아닌 편이 없는 날)을 보인다.
 * 보류 편은 세지 않고, SHIFT는 synkbrief·yuhobuilds 편을 푼 블로그 글이라 따로 세지 않는다. 역할이 없거나 넷 밖의 값이면 「역할 없음」으로 센다.
 * --json의 roles.<브랜드>는 [이번 주, 다음 주]다.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const argValue = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const ROOT = argValue('--폴더') ? path.resolve(argValue('--폴더')) : path.join(REPO, 'docs', '마케팅');
const BRANDS = ['LAB', 'synkbrief', 'yuhobuilds', 'SHIFT'];
const DONE = new Set(['예약됨', '게시됨']);
const ROLE_GOAL = { 유입: 3, 육성: 1, 권위: 2, 전환: 1 };
const ROLES = Object.keys(ROLE_GOAL);
const ROLE_BRANDS = ['LAB', 'synkbrief', 'yuhobuilds'];
const STATE_DIR = process.env.SYNK_QUEUE_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'synk', '예약큐');
// --폴더로 다른 곳(시험 등)을 보면 이 PC의 작업실 캐시는 그 편들과 상관없으니, --서버캐시를 따로 줄 때만 읽는다.
const CACHE = argValue('--서버캐시') ? path.resolve(argValue('--서버캐시')) : argValue('--폴더') ? null : path.join(STATE_DIR, '서버.json');
const GRACE_MS = 2 * 3600000;
const WINDOW_MS = 6 * 3600000;
const LOOKBACK_DAYS = 3;
const LOW_RESERVE = 2;
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

function mondayOf(day) {
  return addDays(day, -((new Date(day + 'T00:00:00Z').getUTCDay() + 6) % 7));
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
        return { account: p.계정, time: p.시각 || null, state: state || null, method: local.방법 || null, url };
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

function roleWeek(items, brand, from, today) {
  const to = addDays(from, 6);
  const mine = items.filter((x) => x.brand === brand && x.slot && x.slot >= from && x.slot <= to && x.state !== '보류');
  const count = Object.fromEntries(ROLES.map((r) => [r, mine.filter((x) => x.role === r).length]));
  const short = Object.fromEntries(ROLES.filter((r) => count[r] < ROLE_GOAL[r]).map((r) => [r, ROLE_GOAL[r] - count[r]]));
  const over = Object.fromEntries(ROLES.filter((r) => count[r] > ROLE_GOAL[r]).map((r) => [r, count[r] - ROLE_GOAL[r]]));
  let open = 0;
  for (let d = today > from ? today : from; d <= to; d = addDays(d, 1)) if (!mine.some((x) => x.slot === d)) open += 1;
  return { from, to, count, none: mine.filter((x) => !ROLES.includes(x.role)).length, short, over, open };
}

const fixNeeded = (x) => x.state !== '채움' && ['고칠 것', '다시 검사'].includes(x.check);

// 계정별: 판 계정마다 그 날 판이 예약·게시됐는지. 비축은 브랜드와 같은 셈.
function accountRows(items, range) {
  const rows = new Map();
  for (const item of items) {
    for (const plate of item.plates) {
      if (!plate.account) continue;
      const day = plate.time && Number.isFinite(Date.parse(plate.time)) ? kstDate(Date.parse(plate.time)) : item.slot;
      if (!day || !range.includes(day)) continue;
      if (!rows.has(plate.account)) rows.set(plate.account, { account: plate.account, brand: item.brand, byDay: Object.fromEntries(range.map((d) => [d, []])) });
      rows.get(plate.account).byDay[day].push({ state: plate.state, folder: item.folder, fix: fixNeeded(item) });
    }
  }
  for (const row of rows.values()) {
    row.reserve = 0;
    for (const d of range.slice(1)) { if (row.byDay[d].some((p) => DONE.has(p.state))) row.reserve += 1; else break; }
  }
  return [...rows.values()].sort((a, b) => BRANDS.indexOf(a.brand) - BRANDS.indexOf(b.brand) || a.account.localeCompare(b.account));
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
  const monday = mondayOf(today);
  report.roleGoal = ROLE_GOAL;
  report.roles = Object.fromEntries(ROLE_BRANDS.map((b) => [b, [roleWeek(items, b, monday, today), roleWeek(items, b, addDays(monday, 7), today)]]));
  report.roleIssues = items.filter((x) => ROLE_BRANDS.includes(x.brand) && x.role && !ROLES.includes(x.role));
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
  report.accounts = accountRows(items, range);
  report.fix = items.filter((x) => fixNeeded(x) && x.slot && x.slot >= today);
  report.warnings = [...new Set(items.flatMap((x) => x.warnings))];
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
  if (list.some((p) => DONE.has(p.state))) return '●';
  if (list.every((p) => p.state === '보류')) return '×';
  if (list.some((p) => p.fix)) return '✗';
  return '○';
}

function print(report) {
  const { range } = report;
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
  const roleText = (c) => ROLES.map((r) => `${r} ${c[r]}`).join(' · ');
  console.log(`역할 · 한 주 목표 ${roleText(ROLE_GOAL)}(가설, v2 §6 「한 주 역할」) · 빈 날 = 오늘부터 그 주에 보류 아닌 편이 없는 날`);
  for (const brand of ROLE_BRANDS) report.roles[brand].forEach((w, k) => {
    const short = Object.entries(w.short).map(([r, n]) => `${r} ${n}`).join(' · ');
    const over = Object.entries(w.over).map(([r, n]) => `${r} +${n}`).join(' · ');
    console.log((k ? '' : brand).padEnd(12) + `${k ? '다음 주' : '이번 주'} ${w.from.slice(5)}~${w.to.slice(5)}  ${roleText(w.count)}`
      + `${w.none ? ` · 역할 없음 ${w.none}` : ''} · 빈 날 ${w.open}  → ${short ? `빈 역할 ${short}` : '빈 역할 없음'}`
      + `${w.none && short ? `(역할 없음 ${w.none}편을 빼기 전)` : ''}${over ? ` · 넘침 ${over}` : ''}`);
  });
  for (const brand of BRANDS) {
    for (const d of range) for (const x of report.brands[brand].byDay[d]) {
      const plates = x.plates.filter((p) => p.method === '작업실' || p.state === '승인 대기' || p.state === '서버에 없음');
      console.log(`  ${d} ${brand} ${x.state}${x.failed ? ` (실패 ${x.failed})` : ''} · ${x.title} · ${x.kind || '성격 없음'}${x.role ? ` · 역할 ${x.role}` : ''}${x.deadline ? ` · 시한 ${x.deadline}` : ''} · ${x.folder}`
        + `${{ 통과: '', '검사 전': ' · 검사 전', '다시 검사': ' · 검사 뒤 영상 바뀜(다시 검사)' }[x.check] ?? ` · 검사 ${x.check}`}${plates.length ? ` · ${plates.map((p) => `${p.account} ${p.state || '—'}`).join(', ')}` : ''}`);
    }
    for (const x of report.brands[brand].late) console.log(`  ! ${brand} 시한 넘김: ${x.title}(시한 ${x.deadline}, 슬롯 ${x.slot})`);
  }
  for (const x of report.unslotted) console.log(`  ? 슬롯 없음: ${x.brand} · ${x.title} · ${x.folder}`);
  for (const x of report.roleIssues) console.log(`  ? 역할 값 확인: ${x.brand} · ${x.title} · 「${x.role}」(유입·육성·권위·전환 가운데 하나) · ${x.folder}`);
  for (const w of report.warnings) console.log(`  ! ${w}`);
  console.log(report.server ? `서버 대조: ${report.server.checkedAt ? report.server.checkedAt.replace('T', ' ').slice(0, 16) + 'Z' : '시각 모름'} 읽음(${report.server.ageHours}시간 전)`
    : '서버 대조 없음 — 작업실 캐시가 없다(정기 작업 「SYNK 예약큐」가 node tools/예약큐.js --서버읽기 --알림으로 채운다)');
}

// 비축 2일 아래 브랜드·대조 문제를 텔레그램으로. 같은 날 같은 내용은 다시 보내지 않는다(AI 없음).
function alert(report) {
  const low = ROLE_BRANDS.filter((b) => report.brands[b].reserve < LOW_RESERVE);
  if (!low.length && !report.warnings.length) return { sent: false, reason: 'nothing' };
  const waiting = report.accounts.filter((row) => Object.values(row.byDay).flat().some((p) => p.state === '승인 대기')).map((row) => row.account);
  const lines = [
    `[예약 비축] ${report.today} · ${ROLE_BRANDS.map((b) => `${b} ${report.brands[b].reserve}일`).join(' · ')} (목표 4일)`,
    ...(low.length ? [`비축 부족: ${low.join(' · ')}`] : []),
    ...(waiting.length ? [`작업실 승인 대기 계정: ${waiting.join(' · ')} — 텔레그램으로 받은 검토 링크를 누르면 예약이 걸려요`] : []),
    ...report.warnings.slice(0, 8).map((w) => `! ${w}`),
    ...(report.fix.length ? [`검사 「고칠 것」 편: ${report.fix.map((x) => x.folder).join(' · ')}`] : []),
  ];
  const text = lines.join('\n');
  const stateFile = path.join(STATE_DIR, '알림.json');
  const last = readJson(stateFile) || {};
  const key = `${report.today}|${text}`;
  if (last.key === key) return { sent: false, reason: 'same-today' };
  if (HERMES.startsWith('file:')) fs.appendFileSync(HERMES.slice(5), text + '\n---\n');
  else {
    const file = path.join(os.tmpdir(), `예약큐-알림-${Date.now()}.txt`);
    fs.writeFileSync(file, text);
    try {
      const r = spawnSync(HERMES, ['send', '-t', TELEGRAM, '-f', file], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
      if (r.status !== 0) throw new Error('텔레그램 보내기 실패: ' + String(r.stderr || r.stdout || r.status).trim().slice(0, 200));
    } finally { fs.rmSync(file, { force: true }); }
  }
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({ key, sentAt: new Date().toISOString() }));
  return { sent: true, text };
}

async function main() {
  const days = Math.max(1, Number(argValue('--일수') || 5) || 5);
  const today = argValue('--오늘') || kstDate();
  if (!isDay(today)) { console.error('--오늘은 실제 있는 날짜를 YYYY-MM-DD로 준다'); process.exit(2); }
  // 시험에서 --오늘을 주면 그날 정오(한국 시각)를 지금으로 본다.
  const now = argValue('--오늘') ? Date.parse(`${today}T12:00:00+09:00`) : Date.now();
  const accounts = (readJson(path.join(ROOT, 'sns-계정.json')) || {}).accounts || {};
  let server = null;
  try { server = await loadServer(process.argv.includes('--서버읽기')); } catch (error) {
    if (process.argv.includes('--서버읽기')) { console.error(`서버 읽기 실패: ${error.message}`); process.exitCode = 1; }
  }
  const report = build(today, days, server, accounts, now);
  if (process.argv.includes('--알림')) report.alert = alert(report);
  if (process.argv.includes('--json')) { console.log(JSON.stringify(report, null, 2)); return; }
  print(report);
  if (report.alert?.sent) console.log('텔레그램으로 알렸다');
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
