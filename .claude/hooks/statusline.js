#!/usr/bin/env node
// SYNK 상태줄 — 유호님이 아무것도 치지 않아도 늘 보이는 두 줄.
//
//  1줄 「이 창이 어느 나무인가」 = 모델 · 생각깊이 · 저장소⑂레인 · 가지 · 미커밋 · 안 민 것
//  2줄 「지금 얼마나 쓰고 있나」 = 맥락 막대 · 앞부분 재활용 성적 · 한도 · 이번 세션 값
//
// 2줄이 왜 붙었나 (전부 실제로 밟았거나 손으로 재던 자리다):
//  · 맥락 막대  — 「effort 를 낮추는 것보다 세션을 끊는 것이 언제나 크다」(08-08 실측).
//                 그 손잡이가 눈에 없으면 못 쥔다.
//  · 재활용     — /cost 를 쳐야 보이던 숫자다(하네스 2.1.251 부터 상태줄에도 온다).
//                 「캐시읽기 96.7% 를 빼면 숫자가 30분의 1」을 손으로 재던 자리(memory usage-measurement-path).
//  · 한도       — Fable 을 켤지는 유호님이 한도를 보고 정하신다(모델 픽은 유호님 몫).
//  · 생각깊이   — 코드 작업 기본은 xhigh 다(유호 확인 08-10). 그 아래로 내려가 있으면 노랗게 뜬다.
//  · 모델 이름  — 09-03 실책: 인계문이 Fable 로 돌았다고 적혀 있는데 Opus 로 이어 돌렸다.
//
// 자: git rev-parse(경로 3값) + git status --porcelain -b · 호출 2번 · 나머지는 하네스가 주는 JSON.
// 입력 형식 = code.claude.com/docs/en/statusline
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');

let d = {};
try { d = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { /* 입력이 없어도 죽지 않는다 */ }

const cwd = (d.workspace && d.workspace.current_dir) || d.cwd || process.cwd();
const model = (d.model && d.model.display_name) || '?';

const dim = s => `\x1b[2m${s}\x1b[0m`;
const cyan = s => `\x1b[36m${s}\x1b[0m`;
const mag = s => `\x1b[35m${s}\x1b[0m`;
const yel = s => `\x1b[33m${s}\x1b[0m`;
const red = s => `\x1b[31m${s}\x1b[0m`;
const grn = s => `\x1b[32m${s}\x1b[0m`;
const bold = s => `\x1b[1m${s}\x1b[0m`;

// 긴 이름은 «꼬리»를 남긴다 — 앞이 아니라 뒤가 그 레인을 가른다
function cut(s, n) { return s.length <= n ? s : '…' + s.slice(-(n - 1)); }

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8', timeout: 2000 }).trim();
  } catch { return ''; }
}

// ── 1줄: 이 창이 어느 나무인가 ─────────────────────────────────────────
const parts = [dim(model)];

// 생각깊이 — xhigh·max 는 조용히, 그 아래는 눈에 띄게(내려간 줄 모르고 일하면 진단이 얕아진다)
const effort = d.effort && d.effort.level;
if (effort) parts.push((effort === 'xhigh' || effort === 'max') ? dim(effort) : yel(effort));
if (d.thinking && d.thinking.enabled === false) parts.push(yel('생각끔'));

// 경로 3값을 한 번에 — toplevel / git-dir / git-common-dir
const paths = git('rev-parse --show-toplevel --git-dir --git-common-dir').split('\n').map(s => s.trim());
const top = paths[0] && !paths[0].startsWith('fatal') ? paths[0] : '';

if (top) {
  const isWorktree = paths.length >= 3 && paths[1] && paths[2] && paths[1] !== paths[2];
  const here = top.split(/[\\/]/).pop();
  if (isWorktree) {
    // 어느 저장소의 어느 레인인가 — 둘 다 보여야 창을 안 헷갈린다
    const repo = paths[2].replace(/[\\/]\.git.*$/, '').split(/[\\/]/).pop();
    parts.push(cyan(repo) + dim('⑂') + cyan(cut(here, 18)));
  } else {
    parts.push(cyan(here));
  }

  // 브랜치 + ahead/behind + 미커밋 을 한 번에
  const st = git('status --porcelain -b').split('\n');
  const head = st[0] || '';
  const dirty = st.slice(1).filter(Boolean).length;

  const mBranch = head.match(/^## (?:No commits yet on )?([^.\s]+)/);
  parts.push(mag(cut(mBranch ? mBranch[1] : 'HEAD', 24)));

  if (dirty) parts.push(yel(`✎${dirty}`));

  const mAhead = head.match(/ahead (\d+)/);
  const mBehind = head.match(/behind (\d+)/);
  if (mAhead) parts.push(red(`↑${mAhead[1]}`));   // 안 민 것 = 이 기계에만 있다
  if (mBehind) parts.push(dim(`↓${mBehind[1]}`));
} else {
  parts.push(cwd.split(/[\\/]/).pop());
}

// ── 2줄: 지금 얼마나 쓰고 있나 ─────────────────────────────────────────
const 아래 = [];

// 맥락 — 낮으면 초록, 70%부터 노랑, 85%부터 빨강 + 「끊을 때」
if (d.context_window) {
  const pct = Math.round(d.context_window.used_percentage || 0);
  const 칸 = 10;
  const 찬 = Math.max(0, Math.min(칸, Math.round((pct / 100) * 칸)));
  const 막대 = '█'.repeat(찬) + '░'.repeat(칸 - 찬);
  const 칠 = pct >= 85 ? red : pct >= 70 ? yel : grn;
  아래.push(칠(`${막대} ${pct}%`) + (pct >= 85 ? ' ' + red(bold('끊을 때')) : ''));
}

// 앞부분 재활용 — 적중률은 높을수록 좋다(색 방향이 맥락과 반대다)
const pc = d.prompt_cache;
if (pc && pc.caching_observed) {
  const 적중 = Math.round((pc.hit_ratio || 0) * 100);
  const 칠 = 적중 >= 80 ? grn : 적중 >= 50 ? yel : red;
  let 칸 = dim('재활용') + ' ' + 칠(`${적중}%`) + (pc.ttl ? dim(`/${pc.ttl}`) : '');
  if (pc.warm === false) {
    // 식었다 = 다음 요청이 앞머리를 통째로 다시 만든다. 그 값을 숫자로 보여준다.
    const 다시 = pc.recache_tokens_if_cold;
    칸 += ' ' + yel(`식음${다시 ? `(${Math.round(다시 / 1000)}k 재생성)` : ''}`);
  }
  아래.push(칸);
} else if (pc) {
  아래.push(red('재활용 안 걸림'));
}

// 한도 — 5시간·7일·지출. 60%부터 노랑, 80%부터 빨강
for (const [열쇠, 이름] of [['five_hour', '5시간'], ['seven_day', '7일'], ['spend_limit', '지출']]) {
  const 값 = d.rate_limits && d.rate_limits[열쇠] && d.rate_limits[열쇠].used_percentage;
  if (typeof 값 !== 'number') continue;
  const n = Math.round(값);
  아래.push(dim(이름) + ' ' + (n >= 80 ? red : n >= 60 ? yel : grn)(`${n}%`));
}

const 돈 = d.cost && d.cost.total_cost_usd;
if (typeof 돈 === 'number' && 돈 > 0) 아래.push(dim(`$${돈.toFixed(2)}`));

process.stdout.write(parts.join(' · '));
if (아래.length) process.stdout.write('\n' + 아래.join(dim(' · ')));
