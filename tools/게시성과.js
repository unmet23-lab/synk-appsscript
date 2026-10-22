#!/usr/bin/env node
'use strict';
/* 게시 성과 판정 — 등록된 모든 게시물을 24시간·72시간·7일에 판정한다(2026-10-21, AI 없음).
 *
 * 편마다 새로 만들던 일회용 판정 예약(앱 예약, 크롬으로 화면 읽기)을 대신한다. 숫자는 회사 서버가 이미 받는 것만 쓴다:
 *   24·72시간 = 게시 성과 등록의 체크포인트(작업실 「게시 주소로 추가」·자동 등록), 7일 = 서버가 하루 한 번 모으는 게시물 숫자.
 * 판정 규칙은 lib/게시성과판정.js(제작 방식 v2 §6 · 서버 publication-learning과 같은 「계정 안 상위 25%」), 평소 대비 배수는 lib/평소배수.js.
 * 화면에서만 읽히는 칸은 「화면 필요」로 모아 두고, 주 1회(금요일) 읽은 값을 --적기로 넣으면 72시간·7일 판정에 더한다.
 *
 *   node tools/게시성과.js                     미리 보기 — 서버를 읽고 판정해 바뀔 것만 보인다(아무것도 쓰지 않는다)
 *   node tools/게시성과.js --실행              편 폴더(게시/성과.json · 기획.md 끝 묶음)·장부·요약에 쓰고, 공용 작업본이면 그 경로만 origin에 올린다
 *   node tools/게시성과.js --적기 <게시 주소> 본비율=62.3 평균시청=11 … [--실행]
 *                                             화면에서 읽은 값을 장부에 적는다(이름: 본비율 3초유지율 평균시청 평균조회율 완주율 공유 저장 도달 조회 팔로우 구독증가 맞춤도구)
 *   node tools/게시성과.js --화면목록 [--json]  주 1회 읽을 칸 목록(요약의 「화면 필요」와 같다)
 *   node tools/게시성과.js --요약              장부만으로 요약을 다시 만든다(서버를 읽지 않는다)
 *   공통: --json · --캐시 <서버 읽기 JSON>(시험·다시 보기) · --저장소 <폴더>(기본: 이 도구가 든 저장소) · --쇼츠안읽음
 *
 * 장부 = docs/_ops/게시성과.jsonl (한 줄 = 판정 하나 또는 화면 읽기 하나 · 바뀐 판정만 덧붙인다 · 고치지 않는다)
 * 요약 = docs/마케팅/게시성과.md (07시 제작·월요일 스캔·금요일 판정이 읽는다 · 이 도구가 다시 만든다)
 * 정기 실행: Windows 작업 스케줄러 「SYNK 게시 성과 판정」이 3시간마다 --실행(tools/게시성과예약/install-task.ps1).
 * 읽기만 한다: 회사 서버는 읽기 전용 조회, 플랫폼은 유튜브 공개 목록(쇼츠 탭)만. 게시·댓글·설정 변경 없음.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const 판정 = require('./lib/게시성과판정.js');
const 편 = require('./lib/게시성과편.js');
const 배수 = require('./lib/평소배수.js');

const REPO_DEFAULT = path.resolve(__dirname, '..');
const LEDGER = 'docs/_ops/게시성과.jsonl';
const SUMMARY = 'docs/마케팅/게시성과.md';
const RECENT_DAYS = 14;
const SCREEN_NAMES = Object.freeze({
  본비율: 'stayedToWatchPct', '3초유지율': 'earlyRetention3sPct', 평균시청: 'averageWatchSeconds', 평균조회율: 'averageViewPct',
  완주율: 'completionRatePct', 공유: 'shares', 저장: 'saves', 도달: 'reach', 조회: 'views', 팔로우: 'follows',
  구독증가: 'subscribersGained', 구독취소: 'subscribersLost', 맞춤도구: 'toolVisits', 좋아요: 'likes', 댓글: 'comments',
});
const ROLE_METRIC = Object.freeze({
  유입: { label: '공유÷도달', of: m => ratio(m.shares, m.reach ?? m.views) },
  육성: { label: '댓글÷조회', of: m => ratio(m.comments, m.views) },
  권위: { label: '저장÷조회', of: m => ratio(m.saves, m.views) },
  전환: { label: '맞춤 도구 유입÷조회', of: m => ratio(m.toolVisits, m.views) },
});
const POINT_LABEL = Object.fromEntries(판정.POINTS.map(p => [p.key, p.label]));

function ratio(a, b) {
  return typeof a === 'number' && typeof b === 'number' && b > 0 ? (a / b) * 1000 : null;
}

// ── 시각·글 ────────────────────────────────────────────────────────────────

const kst = (t, withTime = true) => {
  const d = new Date(typeof t === 'number' ? t : Date.parse(t));
  if (Number.isNaN(d.getTime())) return '—';
  const s = new Date(d.getTime() + 9 * 3600_000).toISOString();
  return withTime ? `${s.slice(5, 10)} ${s.slice(11, 16)}` : s.slice(0, 10);
};
const cell = text => String(text ?? '—').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const 수 = v => (v === null || v === undefined ? '—' : Number(v).toLocaleString('ko-KR'));
const 배글 = v => (v === null || v === undefined ? '—' : `${v >= 10 ? Math.round(v) : (Math.round(v * 10) / 10).toFixed(1)}배`);
const 채널이름 = (platform, channel) => `${판정.PLATFORM_LABEL[platform] || platform} ${channel?.handle ? '@' + String(channel.handle).replace(/^@/, '') : channel?.name || ''}`.trim();

// ── 장부 ──────────────────────────────────────────────────────────────────

function readLedger(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l.trim()).map((l, i) => {
    try { return JSON.parse(l); } catch { throw new Error(`장부 ${i + 1}번째 줄이 JSON이 아니다`); }
  });
}

/*
 * 줄끝 — 공용 작업본은 core.autocrlf=true라 꺼낸 파일이 CRLF다. LF로 만든 글과 그대로 견주면 내용이 같아도 「바뀜」이 되어
 * 줄끝만 다른 파일을 다시 쓰고 미커밋으로 남긴다(10-22 12:34 회차, 올리기는 「올릴 것 없음」). 견줄 때는 줄끝을 맞추고,
 * 쓸 때·덧붙일 때는 그 파일이 쓰던 줄끝을 따른다.
 */
const eolOf = text => (/\r\n/.test(text || '') ? '\r\n' : '\n');
const withEol = (text, eol) => text.replace(/\r?\n/g, eol);

function appendLines(file, lines) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const eol = fs.existsSync(file) ? eolOf(fs.readFileSync(file, 'utf8').slice(0, 4096)) : '\n';
  fs.appendFileSync(file, lines.map(l => JSON.stringify(l)).join(eol) + eol, 'utf8');
}

/** 요약을 쓴다 — 줄끝만 다르면 쓰지 않는다. 바뀌었으면 true */
function writeSummary(file, text) {
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (before !== null && withEol(before, '\n') === withEol(text, '\n')) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', withEol(text, before === null ? '\n' : eolOf(before)), 'utf8');
  fs.renameSync(file + '.tmp', file);
  return true;
}

/** 화면 읽기 — post → {metrics(칸마다 가장 늦은 값), ageHours, at} */
function screensOf(ledger) {
  const out = new Map();
  for (const line of ledger.filter(l => l.kind === '화면').sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
    const prev = out.get(line.post) || { metrics: {}, ageHours: null, at: null };
    out.set(line.post, { metrics: { ...prev.metrics, ...line.metrics }, ageHours: line.ageHours ?? prev.ageHours, at: line.at });
  }
  return out;
}

/** 판정 줄마다 가장 늦은 것 — `${post}|${point}` → 줄 */
function latestJudgments(ledger) {
  const out = new Map();
  for (const line of ledger) if (line.kind === '판정') out.set(`${line.post}|${line.point}`, line);
  return out;
}

/** 바뀌었는지 볼 서명(시각 칸 빼고) */
function signature(line) {
  const { at, ...rest } = line;
  return JSON.stringify(rest);
}

// ── 판정 → 장부 줄 ─────────────────────────────────────────────────────────

function ledgerLine(item, j, meta, at) {
  const r = item.record;
  const standing = {};
  for (const f of j.facts) if (f.comparison.standing) standing[f.metric] = { label: f.comparison.standing.label, n: f.comparison.standing.sampleCount };
  const metrics = {};
  for (const f of j.facts) metrics[f.metric] = f.value;
  return {
    at, kind: '판정', post: r.postKey, point: j.point, url: r.url, channel: 채널이름(r.platform, item.channel), platform: r.platform, format: r.format,
    account: meta.account, brand: meta.brand, folder: meta.folder, role: meta.role, hook: meta.hook, hookSlot: meta.hookSlot,
    publishedAt: r.publishedAt, observedAt: j.observedAt === null ? null : new Date(j.observedAt).toISOString(), daily: j.daily,
    metrics, screenMetrics: j.facts.filter(f => f.screen).map(f => f.metric), standing,
    multiple: j.multiple ? { value: j.multiple.value, median: j.multiple.median === null ? null : Math.round(j.multiple.median * 10) / 10, n: j.multiple.n } : null,
    verdict: j.verdict.label, next: j.verdict.next, reason: j.verdict.reason, line: 판정.judgmentLine(j),
    screenNeeded: item.screenNeeded,
  };
}

/** 등록 게시물 → 편 폴더·계정·브랜드·역할·훅 */
function metaOf(item, index, accounts) {
  const r = item.record;
  const found = index.resolve(r.postKey);
  const handle = String(item.channel?.handle || '').replace(/^@/, '').toLowerCase();
  const byHandle = accounts.find(a => a.platform === r.platform && String(a.handle || '').replace(/^@/, '').toLowerCase() === handle && handle);
  const account = found?.account || byHandle?.key || null;
  const brandFromAccount = account ? (/^lab-/.test(account) ? 'LAB' : /^synkbrief-/.test(account) ? 'synkbrief' : /^yuhobuilds-/.test(account) ? 'yuhobuilds' : /^shift-/.test(account) ? 'SHIFT' : null) : null;
  if (!found || !found.info) return { folder: null, ambiguous: found?.ambiguous || null, account, brand: brandFromAccount, role: null, hook: null, hookSlot: null };
  const hook = 편.hookFor(found.info, { account, platform: r.platform });
  return { folder: found.info.folder, dir: found.info.dir, account, brand: found.info.brand || brandFromAccount, role: found.info.role || null, hook: hook.label, hookSlot: hook.slot };
}

function loadAccounts(repo) {
  try {
    const { accounts } = JSON.parse(fs.readFileSync(path.join(repo, 'docs', '마케팅', 'sns-계정.json'), 'utf8'));
    return Object.entries(accounts || {}).map(([key, a]) => ({ key, platform: a.platform, handle: a.handle || '' }));
  } catch { return []; }
}

// ── 유튜브 쇼츠 탭(형식 다시 가르기) ────────────────────────────────────────

async function shortsLists(data, { skip = false, token = null } = {}) {
  const out = new Map();
  if (skip) return out;
  const channelIds = new Set(data.entries.filter(e => data.channels.find(c => c.id === e.channelId)?.platform === 'youtube').map(e => e.channelId));
  if (!channelIds.size) return out;
  let bearer = token;
  try {
    if (!bearer) {
      const publisher = require('./lib/sns-publisher.js');
      const credential = publisher.readCredential('lab-youtube', { allowLegacy: true });
      if (!credential) return out;
      bearer = (await publisher.googleAccessToken(credential)).accessToken;
    }
  } catch { return out; }
  for (const id of channelIds) {
    const channel = data.channels.find(c => c.id === id);
    const target = channel.externalId && /^UC[\w-]{22}$/.test(channel.externalId) ? { kind: 'channel', id: channel.externalId }
      : channel.handle ? { kind: 'handle', handle: String(channel.handle).replace(/^@/, '') } : null;
    if (!target) continue;
    try {
      const tab = await 배수.youtubeShortsTab({ target, token: bearer, count: 50 });
      if (tab.how !== 'shorts-playlist') continue;
      const times = tab.items.map(i => Date.parse(i.publishedAt)).filter(Number.isFinite);
      out.set(id, { ids: new Set(tab.items.map(i => i.id)), coversAt: tab.items.length >= 50 ? Math.min(...times) : 0 });
    } catch { /* 못 읽으면 서버 형식 그대로 */ }
  }
  return out;
}

// ── git: 남의 미커밋 건드리지 않기 ─────────────────────────────────────────

function git(repo, args) {
  return spawnSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
}

/** 그 파일의 미커밋 변경이 이 도구 몫(기획.md 끝 묶음·성과.json 자동판정 칸)뿐인가. 미커밋이 없으면 true */
function onlyMine(repo, rel, kind) {
  const st = git(repo, ['status', '--porcelain', '--', rel]);
  if (st.status !== 0) return false;
  if (!st.stdout.trim()) return true;
  const head = git(repo, ['show', `HEAD:${rel}`]);
  const work = fs.existsSync(path.join(repo, rel)) ? fs.readFileSync(path.join(repo, rel), 'utf8') : null;
  if (work === null) return false;
  if (kind === 'json') {
    const strip = text => { try { const d = JSON.parse(String(text).replace(/^﻿/, '')); delete d.자동판정; return JSON.stringify(d); } catch { return null; } };
    if (head.status !== 0) return strip(work) === '{}';
    return strip(work) !== null && strip(work) === strip(head.stdout);
  }
  if (head.status !== 0) return false;
  const strip = text => {
    const s = text.indexOf(편.BLOCK_START), e = text.indexOf(편.BLOCK_END);
    return (s >= 0 && e > s ? text.slice(0, s) + text.slice(e + 편.BLOCK_END.length) : text).replace(/\s+$/, '');
  };
  return strip(work.replace(/\r\n/g, '\n')) === strip(head.stdout.replace(/\r\n/g, '\n'));
}

// ── 편 폴더에 쓸 것 ────────────────────────────────────────────────────────

function folderPayload(items) {
  const 판 = items.map(({ item, meta, lines }) => {
    const r = item.record;
    const 시점 = {};
    for (const line of lines) {
      시점[POINT_LABEL[line.point]] = {
        관측: line.observedAt, 지표: line.metrics, 평소대비: line.multiple ? { 배수: line.multiple.value, 중앙값: line.multiple.median, 편수: line.multiple.n } : null,
        위치: Object.fromEntries(Object.entries(line.standing).map(([m, s]) => [판정.METRICS[m]?.label || m, `${({ top25: '상위 25%', bottom25: '하위 25%', middle: '보통' })[s.label]} · ${s.n}편`])),
        판정: line.verdict, 다음: line.next, 까닭: line.reason,
      };
    }
    return {
      계정: meta.account, 채널: 채널이름(r.platform, item.channel), 주소: r.url, 형식: r.format, 게시: r.publishedAt,
      훅: meta.hook, 역할: meta.role, 시점, 화면필요: item.screenNeeded.map(m => 판정.METRICS[m]?.label || m),
      ...(r.screen ? { 화면: { 읽은때: r.screen.at, 지표: r.screen.metrics } } : {}),
    };
  });
  return { 설명: 'tools/게시성과.js가 회사 서버 기록으로 다시 쓴다(AI 없음). 판정 규칙과 칸 뜻은 docs/마케팅/게시성과.md', 판 };
}

function planLines(items) {
  const out = ['## 숫자 판정 (자동)', '', '회사 서버가 받은 24시간·72시간·7일 숫자로 `tools/게시성과.js`가 판정한다(v2 §6, 「상위 25%」는 같은 계정·형식 이전 4편부터 네 숫자로만). 전체 표는 [게시 성과](../게시성과.md).', ''];
  for (const { item, meta, lines } of items) {
    const name = `${채널이름(item.record.platform, item.channel)}${meta.hook ? ` · 훅 ${meta.hookSlot ? meta.hookSlot + ' ' : ''}${meta.hook}` : ''}`;
    for (const line of lines) out.push(`- ${name} ${POINT_LABEL[line.point]}(${kst(line.observedAt)}): ${line.line}`);
    if (item.screenNeeded.length) out.push(`- ${name} 화면 필요(금요일에 모아 읽음): ${item.screenNeeded.map(m => 판정.METRICS[m]?.label || m).join(' · ')}`);
  }
  return out;
}

// ── 요약 ──────────────────────────────────────────────────────────────────

function summarize({ ledger, now, unregistered = [], unmapped = [] }) {
  const latest = [...latestJudgments(ledger).values()];
  const recentCut = now - RECENT_DAYS * 86_400_000;
  const byPost = new Map();
  for (const l of latest) {
    if (!byPost.has(l.post)) byPost.set(l.post, []);
    byPost.get(l.post).push(l);
  }
  const order = { '24h': 0, '72h': 1, '7d': 2 };
  const main = [...byPost.values()].map(list => list.sort((a, b) => order[b.point] - order[a.point])[0]);
  const recent = main.filter(l => Date.parse(l.publishedAt) >= recentCut).sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const wins = recent.filter(l => l.verdict === '상위 25%');
  const losses = recent.filter(l => l.verdict === '하위 25%');
  const hot = recent.filter(l => l.multiple && l.multiple.value !== null && l.multiple.value >= 3);

  const at = (l, p) => latest.find(x => x.post === l.post && x.point === p);
  const tableBy = (keyOf) => {
    const groups = new Map();
    for (const l of main) {
      const key = keyOf(l);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(l);
    }
    return [...groups.entries()].map(([key, list]) => {
      const m72 = list.map(l => at(l, '72h')?.multiple?.value).filter(v => typeof v === 'number');
      const m7 = list.map(l => at(l, '7d')?.multiple?.value).filter(v => typeof v === 'number');
      const verdicts = { '상위 25%': 0, 보통: 0, '하위 25%': 0, 기타: 0 };
      for (const l of list) verdicts[['상위 25%', '보통', '하위 25%'].includes(l.verdict) ? l.verdict : '기타'] += 1;
      return { key, list, n: list.length, m72: 배수.median(m72), m72n: m72.length, m7: 배수.median(m7), m7n: m7.length, verdicts,
        brands: [...new Set(list.map(l => l.brand).filter(Boolean))] };
    }).sort((a, b) => (b.m72 ?? -1) - (a.m72 ?? -1) || b.n - a.n);
  };
  const hooks = tableBy(l => l.hook);
  const roles = tableBy(l => l.role);
  const noHook = main.filter(l => !l.hook).length;
  const noRole = main.filter(l => !l.role).length;
  const verdictText = v => `${v['상위 25%']}·${v.보통}·${v['하위 25%']}·${v.기타}`;
  const nameOf = l => (l.folder ? `[${l.folder}](${encodeURI(l.folder)}/)` : '편 폴더 못 찾음');
  const screenRows = main.filter(l => l.folder && l.screenNeeded && l.screenNeeded.length && Date.parse(l.publishedAt) >= recentCut)
    .sort((a, b) => String(a.publishedAt).localeCompare(String(b.publishedAt)));
  const lastAt = ledger.map(l => l.at).filter(Boolean).sort().pop();

  const lines = [
    '# 게시 성과 판정',
    '',
    `> \`node tools/게시성과.js\`가 장부(\`docs/_ops/게시성과.jsonl\`)에서 다시 만드는 요약이다. 손으로 고치지 않는다. 판정이 마지막으로 바뀐 때: ${lastAt ? kst(lastAt) + ' KST' : '—'}.`,
    '> 숫자는 회사 서버가 받은 값이다(24·72시간 = 게시 성과 체크포인트, 7일 = 하루 한 번 모은 게시물 숫자 가운데 게시 168시간에 가장 가까운 값). 빈칸은 못 받았다는 뜻이지 0이 아니다.',
    '> 판정 규칙(v2 §6): 「상위·하위 25%」는 같은 계정·형식 이전 4편부터, 네 숫자(초반 유지·평균 시청과 완주·보내기와 저장·맞춤 도구 유입)로만 가른다. 조회는 보이기만 한다. 「평소 대비」 = 이 편 조회 ÷ 그 시각 같은 계정·형식 최근 12편 조회의 중앙값(그 편도 12편에 든다).',
    '',
    '## 07시 제작이 먼저 볼 것',
    '',
    `- **이긴 편(최근 ${RECENT_DAYS}일 상위 25%)** → 같은 형식으로 세 편 더 · 다른 씨앗·국가 계정에 현지어판 · 맞춤 프로그램 편 설정: ${wins.length ? wins.map(l => `${nameOf(l)} ${l.channel} ${POINT_LABEL[l.point]}${l.hook ? `(훅 ${l.hook})` : ''}`).join(' · ') : '없음'}`,
    `- **하위 25%** → 훅을 바꾼 판을 다른 씨앗 계정에서 시험하거나 접기(같은 계정 재게시·본문 고치기 없음): ${losses.length ? losses.map(l => `${nameOf(l)} ${l.channel}${l.hook ? `(훅 ${l.hook})` : ''}`).join(' · ') : '없음'}`,
    `- **평소 대비 3배 넘은 편**(판정과 별개로 소재·훅을 다시 볼 편): ${hot.length ? hot.map(l => `${nameOf(l)} ${l.channel} ${POINT_LABEL[l.point]} ${배글(l.multiple.value)}`).join(' · ') : '없음'}`,
    `- **훅 이름표:** ${hooks.filter(h => h.m72n >= 2).length ? hooks.filter(h => h.m72n >= 2).map(h => `${h.key} ${배글(h.m72)}(${h.m72n}판)`).join(' · ') : '72시간 배수가 둘 이상 쌓인 이름표가 아직 없다'} — 판이 적은 이름표는 우연일 수 있다. 이름표·역할 없는 판 ${noHook}·${noRole}(10-21 전 편은 첫 줄에 이름표가 없다).`,
    '',
    '## 훅 이름표별',
    '',
    '| 이름표 | 판 | 72시간 배수 중앙값 | 7일 배수 중앙값 | 상위·보통·하위·그 밖 | 브랜드 |',
    '|---|---|---|---|---|---|',
    ...(hooks.length ? hooks.map(h => `| ${cell(h.key)} | ${h.n} | ${배글(h.m72)}${h.m72n ? ` (${h.m72n})` : ''} | ${배글(h.m7)}${h.m7n ? ` (${h.m7n})` : ''} | ${verdictText(h.verdicts)} | ${cell(h.brands.join('·') || '—')} |`)
      : ['| 아직 없음 | — | — | — | — | — |']),
    '',
    '배수는 판마다 그 시점 값의 중앙값이다(괄호는 값이 있는 판 수). 「그 밖」은 자료 부족·엇갈림. 이름표는 기획.md 첫 줄 「훅: A <이름표> · B <이름표>」(A는 인스타·페북·틱톡, B는 유튜브 — 준비.json 판마다 "훅"을 적으면 그것)에서 읽는다.',
    '',
    '## 역할별',
    '',
    '| 역할 | 판 | 72시간 배수 중앙값 | 역할 지표(72시간, ‰) | 상위·보통·하위·그 밖 |',
    '|---|---|---|---|---|',
    ...(roles.length ? roles.map(r => {
      const def = ROLE_METRIC[r.key];
      const vals = def ? r.list.map(l => def.of(at(l, '72h')?.metrics || {})).filter(v => typeof v === 'number') : [];
      const mid = 배수.median(vals);
      return `| ${cell(r.key)} | ${r.n} | ${배글(r.m72)}${r.m72n ? ` (${r.m72n})` : ''} | ${def ? `${def.label} ${mid === null ? '—' : Math.round(mid * 10) / 10}${vals.length ? ` (${vals.length})` : ''}` : '—'} | ${verdictText(r.verdicts)} |`;
    }) : ['| 아직 없음 | — | — | — | — |']),
    '',
    '역할 지표는 v2 §6 「한 주 역할」의 확인 숫자다 — 유입 = 공유÷도달(도달이 없으면 ÷조회), 육성 = 댓글÷조회, 권위 = 저장÷조회, 전환 = 맞춤 도구 유입÷조회(조회 천 회당). 역할은 준비.json "역할" → 기획.md 첫 줄 「역할 <유입|육성|권위|전환>」.',
    '',
    `## 최근 판정 (${RECENT_DAYS}일)`,
    '',
    '| 게시(KST) | 편 | 계정 | 시점 | 훅 · 역할 | 판정 줄 |',
    '|---|---|---|---|---|---|',
    ...(recent.length ? recent.map(l => `| ${kst(l.publishedAt)} | ${nameOf(l)} | ${cell(l.channel)} | ${POINT_LABEL[l.point]} | ${cell([l.hook, l.role].filter(Boolean).join(' · ') || '—')} | ${cell(l.line)} |`)
      : ['| — | — | — | — | — | 아직 없음 |']),
    '',
    '## 화면 필요 (금요일에 모아 읽는다)',
    '',
    '서버가 못 받는 칸이다 — 유튜브 본 비율(API 없음), 인스타 팔로우(API 없음), 통계 권한이 없는 계정의 조회·도달·공유·저장, 분석 권한이 없는 유튜브 채널의 평균 시청·평균 조회율·공유·구독(게시 6일째까지는 서버를 기다린다). 읽은 값은 `node tools/게시성과.js --적기 <게시 주소> 본비율=62.3 평균시청=11 --실행`으로 넣는다.',
    '',
    '| 게시(KST) | 편 | 계정 | 주소 | 읽을 칸 |',
    '|---|---|---|---|---|',
    ...(screenRows.length ? screenRows.map(l => `| ${kst(l.publishedAt)} | ${nameOf(l)} | ${cell(l.channel)} | ${cell(l.url)} | ${cell(l.screenNeeded.map(m => 판정.METRICS[m]?.label || m).join(' · '))} |`)
      : ['| — | — | — | — | 없음 |']),
    '',
    '## 서버에 등록되지 않은 게시',
    '',
    '편 폴더 게시결과.json에 「게시됨」으로 적혔는데 서버 게시 성과에 없는 주소다. 이 편은 판정이 쌓이지 않으니 작업실 「게시 주소로 추가」로 등록한다(24시간 창은 게시 + 30시간에 닫힌다).',
    '',
    ...(unregistered.length ? unregistered.map(u => `- ${kst(u.at)} ${u.folder} · ${u.account || '계정 모름'} · ${u.url}`) : ['- 없음']),
    '',
    ...(unmapped.length ? ['## 편 폴더를 못 찾은 등록', '', '서버 등록은 있는데 어느 편인지 못 찾았다(게시결과.json 판[].주소에 이 주소를 적으면 이어진다).', '',
      ...unmapped.map(u => `- ${kst(u.publishedAt)} ${u.channel} · ${u.url}${u.ambiguous ? ` (여러 폴더: ${u.ambiguous.join(', ')})` : ''}`), ''] : []),
  ];
  return lines.join('\n');
}

/** 게시결과.json에 「게시됨」인데 서버 등록에 없는 주소(최근 14일) */
function unregisteredOf(index, registeredKeys, now) {
  const out = [];
  for (const info of index.folders.values()) {
    for (const p of (info.result && Array.isArray(info.result.판) ? info.result.판 : [])) {
      if (!p || p.상태 !== '게시됨') continue;
      const id = 판정.postIdOf(p.주소);
      if (!id || registeredKeys.has(id.key)) continue;
      const at = Date.parse(p.시각);
      if (!Number.isFinite(at) || at < now - RECENT_DAYS * 86_400_000 || at > now) continue;
      out.push({ folder: info.folder, account: p.계정 || null, url: p.주소, at });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

// ── 실행 ──────────────────────────────────────────────────────────────────

function 인자(argv) {
  const o = { 실행: false, json: false, 캐시: null, 저장소: null, 적기: null, 값들: [], 화면목록: false, 요약: false, 쇼츠안읽음: false, 나이: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--실행') o.실행 = true;
    else if (a === '--json') o.json = true;
    else if (a === '--캐시') o.캐시 = argv[++i];
    else if (a === '--저장소') o.저장소 = argv[++i];
    else if (a === '--적기') o.적기 = argv[++i];
    else if (a === '--화면목록') o.화면목록 = true;
    else if (a === '--요약') o.요약 = true;
    else if (a === '--쇼츠안읽음') o.쇼츠안읽음 = true;
    else if (a === '--나이') o.나이 = Number(argv[++i]);
    else if (/^[^=\s-][^=\s]*=/.test(a)) o.값들.push(a);
    else if (a === '-h' || a === '--help') o.도움 = true;
    else throw new Error(`모르는 인자: ${a}`);
  }
  return o;
}

function 화면값(pairs) {
  const metrics = {};
  for (const pair of pairs) {
    const m = /^([^=]+)=([\d.,]+)%?$/.exec(pair);
    if (!m) throw new Error(`「${pair}」를 읽지 못했다. 「이름=숫자」 꼴로 적는다`);
    const key = SCREEN_NAMES[m[1]] || (판정.METRICS[m[1]] ? m[1] : null);
    if (!key) throw new Error(`「${m[1]}」는 칸 이름이 아니다. 쓸 수 있는 것: ${Object.keys(SCREEN_NAMES).join(' ')}`);
    const value = Number(m[2].replace(/,/g, ''));
    if (!판정.validValue(value, key)) throw new Error(`「${pair}」 값이 칸에 맞지 않는다`);
    metrics[key] = value;
  }
  if (!Object.keys(metrics).length) throw new Error('적을 값이 없다');
  return metrics;
}

async function 서버읽기(o) {
  if (o.캐시) return require('./lib/게시성과읽기.cjs').다듬기(JSON.parse(fs.readFileSync(o.캐시, 'utf8')));
  // 하루 숫자는 45일(굳히기 10일 + 7일 점 + 비교할 옛 편의 여유), 게시물은 채널마다 최신 80편(하루 여러 편 올리는 채널도 12편 기준이 남게)
  return require('./lib/게시성과읽기.cjs').읽기({ days: 45, perChannel: 80 });
}

/** 판정은 관측 10일 뒤에 굳힌다 — 서버가 옛 하루 숫자를 지우면(유튜브 공개 통계 연결은 30일) 비교 표본이 줄어 이미 낸 판정이 흔들리지 않게. */
const FREEZE_MS = 10 * 86_400_000;

async function run(o, { now = Date.now(), shorts = null, data = null } = {}) {
  const repo = path.resolve(o.저장소 || REPO_DEFAULT);
  const ledgerFile = path.join(repo, LEDGER);
  const summaryFile = path.join(repo, SUMMARY);
  const ledger = readLedger(ledgerFile);
  const report = { 결과: '미리 보기', 새판정: [], 편쓰기: [], 건너뜀: [], 올리기: null };

  if (o.요약) {
    const text = summarize({ ledger, now });
    if (o.실행) writeSummary(summaryFile, text + '\n');
    report.결과 = o.실행 ? '요약 다시 만듦' : '미리 보기';
    report.요약 = text;
    return report;
  }

  const server = data || await 서버읽기(o);
  const shortsByChannel = shorts || await shortsLists(server, { skip: o.쇼츠안읽음 });
  let screens = screensOf(ledger);

  if (o.적기) {
    const id = 판정.postIdOf(o.적기);
    if (!id) throw new Error('게시 주소를 읽지 못했다(유튜브·인스타·페북·틱톡)');
    const entry = server.entries.find(e => 판정.postIdOf(e.url)?.key === id.key);
    if (!entry) throw new Error('서버에 등록되지 않은 게시물이다 — 작업실 「게시 주소로 추가」로 먼저 등록한다');
    const ageHours = Number.isFinite(o.나이) ? o.나이 : Math.round((now - Date.parse(entry.publishedAt)) / 3_600_000);
    const line = { at: new Date(now).toISOString(), kind: '화면', post: id.key, url: entry.url, ageHours, metrics: 화면값(o.값들) };
    report.화면줄 = line;
    if (o.실행) appendLines(ledgerFile, [line]);
    // 미리 보기에서도 이 값이 들어간 판정을 보인다(장부 파일에는 --실행일 때만 쓴다)
    ledger.push(line);
    screens = screensOf(ledger);
  }

  const judged = 판정.judgeAll(server, { now, shortsByChannel, screens });
  const index = 편.buildIndex(path.join(repo, 'docs', '마케팅'));
  const accounts = loadAccounts(repo);
  const latest = latestJudgments(ledger);
  const at = new Date(now).toISOString();
  const byFolder = new Map();
  const unmapped = [];
  const newLines = [];
  const screenList = [];
  for (const item of judged) {
    const meta = metaOf(item, index, accounts);
    const lines = [];
    for (const j of Object.values(item.judgments)) {
      const line = ledgerLine(item, j, meta, at);
      const prev = latest.get(`${line.post}|${line.point}`);
      const observed = Date.parse(prev?.observedAt || prev?.at || '');
      if (prev && Number.isFinite(observed) && observed < now - FREEZE_MS) { lines.push(prev); continue; }
      if (!prev || signature(prev) !== signature(line)) newLines.push(line);
      lines.push(line);
    }
    if (meta.folder) {
      if (!byFolder.has(meta.folder)) byFolder.set(meta.folder, { dir: meta.dir, items: [] });
      byFolder.get(meta.folder).items.push({ item, meta, lines });
      // 주 1회 읽기 — 편 폴더가 있는 최근 14일 편만(시험 게시·남의 주소는 읽지 않는다)
      if (item.screenNeeded.length && Date.parse(item.record.publishedAt) >= now - RECENT_DAYS * 86_400_000) {
        screenList.push({ 편: meta.folder, 주소: item.record.url, 채널: 채널이름(item.record.platform, item.channel), 게시: item.record.publishedAt,
          칸: item.screenNeeded.map(m => 판정.METRICS[m]?.label || m), 적기이름: item.screenNeeded.map(m => Object.keys(SCREEN_NAMES).find(k => SCREEN_NAMES[k] === m) || m) });
      }
    } else unmapped.push({ publishedAt: item.record.publishedAt, channel: 채널이름(item.record.platform, item.channel), url: item.record.url, ambiguous: meta.ambiguous });
  }
  report.새판정 = newLines.map(l => `${l.channel} ${POINT_LABEL[l.point]} ${l.folder || '(편 폴더 없음)'}: ${l.verdict}${l.multiple?.value != null ? ` · ${배글(l.multiple.value)}` : ''}`);
  report.화면목록 = screenList.sort((a, b) => String(a.게시).localeCompare(String(b.게시)));
  const registeredKeys = new Set(judged.map(x => x.record.postKey));
  const unregistered = unregisteredOf(index, registeredKeys, now);
  report.미등록 = unregistered.map(u => `${u.folder} ${u.url}`);
  if (!o.실행) return report;

  // 쓰기 — 장부(바뀐 판정만) → 편 폴더 → 요약 → 올리기
  const written = new Set();
  if (newLines.length) {
    appendLines(ledgerFile, newLines);
    ledger.push(...newLines);
    written.add(LEDGER);
  }
  if (o.적기) written.add(LEDGER);
  for (const [folder, { dir, items }] of byFolder) {
    const order = { '24h': 0, '72h': 1, '7d': 2 };
    for (const x of items) x.lines.sort((a, b) => order[a.point] - order[b.point]);
    items.sort((a, b) => String(a.item.record.platform).localeCompare(String(b.item.record.platform)));
    if (!items.some(x => x.lines.length)) continue;
    const relJson = path.relative(repo, path.join(dir, '게시', '성과.json')).replace(/\\/g, '/');
    const relPlan = path.relative(repo, path.join(dir, '기획.md')).replace(/\\/g, '/');
    if (onlyMine(repo, relJson, 'json')) {
      const r = 편.writeResultJson(dir, folderPayload(items));
      if (r.changed) { written.add(relJson); report.편쓰기.push(relJson); } else if (r.skipped) report.건너뜀.push(`${relJson}: ${r.skipped}`);
    } else report.건너뜀.push(`${relJson}: 남의 미커밋이 있어 다음에 쓴다`);
    if (onlyMine(repo, relPlan, 'md')) {
      const r = 편.writePlanBlock(dir, planLines(items));
      if (r.changed) { written.add(relPlan); report.편쓰기.push(relPlan); } else if (r.skipped) report.건너뜀.push(`${relPlan}: ${r.skipped}`);
    } else report.건너뜀.push(`${relPlan}: 남의 미커밋이 있어 다음에 쓴다`);
  }
  if (writeSummary(summaryFile, summarize({ ledger, now, unregistered, unmapped }) + '\n')) written.add(SUMMARY);
  report.결과 = written.size ? '씀' : '바뀐 것 없음';
  report.쓴파일 = [...written];
  if (written.size) {
    const { 장부올리기, 장부올리기글 } = require('./lib/장부올리기.js');
    const r = await 장부올리기([...written], `chore(게시 성과): 판정 ${newLines.length}줄${o.적기 ? ' · 화면 값 적음' : ''} — ${[...new Set(newLines.map(l => l.folder).filter(Boolean))].slice(0, 4).join(', ') || '요약'}`, { 저장소: repo });
    report.올리기 = 장부올리기글(r, '게시 성과') || r.결과;
  }
  return report;
}

/** 공용 작업본이면 먼저 origin을 따라간다(실패해도 이어서 한다). 잠금으로 두 번 겹쳐 돌지 않는다. */
async function main(argv) {
  const o = 인자(argv);
  if (o.도움) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 22).join('\n')); return; }
  const repo = path.resolve(o.저장소 || REPO_DEFAULT);
  const lockDir = path.join(repo, 'output', '게시성과');
  const lock = path.join(lockDir, '잠금');
  const token = `${process.pid}:${Date.now()}`;
  if (o.실행) {
    fs.mkdirSync(lockDir, { recursive: true });
    // 잠금은 만들기(wx)로 잡는다. 이미 있으면 두 시간 넘은 것만 치우고 한 번 더 잡아 본다 — 못 잡으면 이번 회차는 건너뛴다.
    const take = () => { try { fs.writeFileSync(lock, token, { flag: 'wx' }); return true; } catch (e) { if (e.code === 'EEXIST') return false; throw e; } };
    let held = take();
    if (!held) {
      try { if (Date.now() - fs.statSync(lock).mtimeMs >= 2 * 3_600_000) { fs.unlinkSync(lock); held = take(); } } catch { /* 그새 다른 실행이 치웠다 */ }
    }
    if (!held) { console.log('다른 판정 실행이 돌고 있다(잠금) — 이번은 건너뛴다'); return; }
  }
  try {
    if (o.실행 && !o.캐시) {
      const { 공용작업본인가 } = require('./lib/장부올리기.js');
      if (공용작업본인가(repo)) {
        try { await require('./바로올리기.js').따라가기({ 저장소: repo, 실행: true }); } catch { /* 따라가지 못해도 지금 판으로 판정한다 */ }
      }
    }
    const report = await run(o);
    if (o.화면목록) {
      if (o.json) console.log(JSON.stringify(report.화면목록, null, 2));
      else {
        for (const x of report.화면목록) console.log(`${kst(x.게시)} ${x.편} · ${x.채널} ${x.주소} — ${x.칸.join(' · ')}\n    적기: node tools/게시성과.js --적기 ${x.주소} ${x.적기이름.map(n => `${n}=…`).join(' ')} --실행`);
        if (!report.화면목록.length) console.log('화면에서 읽을 칸이 없다');
      }
      return;
    }
    if (o.json) { console.log(JSON.stringify(report, null, 2)); return; }
    if (report.요약 && o.요약) { console.log(o.실행 ? `요약을 다시 만들었다: ${SUMMARY}` : report.요약); return; }
    console.log(`게시 성과 판정 · ${report.결과}`);
    if (report.화면줄) console.log(`  화면 값${o.실행 ? ' 적음' : '(미리 보기)'}: ${report.화면줄.post} ${JSON.stringify(report.화면줄.metrics)} · 게시 ${report.화면줄.ageHours}시간 뒤`);
    for (const l of report.새판정) console.log(`  + ${l}`);
    for (const f of report.편쓰기) console.log(`  쓴 곳: ${f}`);
    for (const s of report.건너뜀) console.log(`  건너뜀: ${s}`);
    for (const u of report.미등록 || []) console.log(`  ! 서버 미등록: ${u}`);
    if (report.올리기) console.log(`  ${report.올리기}`);
    if (!o.실행 && report.새판정.length) console.log('  (미리 보기 — --실행을 붙이면 쓴다)');
    const logFile = path.join(lockDir, '마지막실행.json');
    if (o.실행) fs.writeFileSync(logFile, JSON.stringify({ at: new Date().toISOString(), ...report }, null, 2), 'utf8');
  } finally {
    // 내가 잡은 잠금만 치운다
    if (o.실행) try { if (fs.readFileSync(lock, 'utf8') === token) fs.unlinkSync(lock); } catch {}
  }
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  main(argv).catch(error => {
    console.error(`❌ ${error.message}`);
    // 정기 실행(--실행)의 실패만 남긴다 — 미리 보기·인자 오타는 마지막 실행 기록을 덮지 않는다
    if (argv.includes('--실행')) try {
      const at = argv.indexOf('--저장소');
      const dir = path.join(path.resolve(at > -1 && argv[at + 1] ? argv[at + 1] : REPO_DEFAULT), 'output', '게시성과');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, '마지막실행.json'), JSON.stringify({ at: new Date().toISOString(), 결과: '실패', 이유: error.message }, null, 2), 'utf8');
    } catch {}
    process.exitCode = 1;
  });
}

module.exports = { 인자, 화면값, run, summarize, readLedger, screensOf, latestJudgments, signature, ledgerLine, metaOf, onlyMine, unregisteredOf, LEDGER, SUMMARY };
