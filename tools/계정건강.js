#!/usr/bin/env node
'use strict';
/* 계정 건강 진단 — 우리 계정의 숫자를 이미 쌓인 두 장부에서 읽어 건강 상태와 처방을 낸다(2026-11-19, AI 없음, 읽기만 한다).
 *
 *   node tools/계정건강.js                 계정마다 상태, 유형, 결론, 신호, 처방을 글로 보인다
 *   node tools/계정건강.js --json          솔리오 방의 꼴({ say, then, when, scope, rows })로 낸다
 *   node tools/계정건강.js --계정 <키>      한 계정만
 *   공통: --저장소 <폴더>(기본: 이 도구가 든 저장소) · --지금 <ISO 시각>(다시 보기 · 시험)
 *
 * 읽는 것: docs/_ops/게시성과.jsonl(게시물마다 24시간 · 72시간 · 7일 숫자와 화면에서 읽은 값) · docs/_ops/채널성과.jsonl(팔로워) · docs/마케팅/sns-계정.json(이름)
 * 판정 규칙과 기준 숫자는 lib/계정건강.js, 설계와 출처는 docs/디자인/솔리오_계정건강_20261119/README.md.
 * 아무 파일도 쓰지 않고 네트워크를 쓰지 않는다. 숫자를 새로 재려면 `node tools/채널성과.js --재기`와 게시 성과 예약이 먼저 돈다.
 */
const fs = require('node:fs');
const path = require('node:path');
const { 진단, 방 } = require('./lib/계정건강.js');

const LABEL = { youtube: '유튜브', instagram: '인스타그램', tiktok: '틱톡', facebook: '페이스북', threads: '스레드', telegram: '텔레그램', xiaohongshu: '샤오훙수', douyin: '더우인', linkedin: '링크드인', rutube: 'RUTUBE', vk: 'VK' };
const lines = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [])
  .map(l => { try { return l.trim() ? JSON.parse(l) : null; } catch { return null; } }).filter(Boolean);

/** 편 폴더 이름에서 사람이 읽는 제목만 남긴다: LAB_생신_mn_20261114 → 생신 */
function 제목(folder) {
  if (!folder) return null;
  const parts = String(folder).split('_').filter(p => !/^\d{8}$/.test(p) && !/^[a-z]{2}$/.test(p));
  return (parts.length > 1 ? parts.slice(1) : parts).join(' ') || null;
}

/** 두 장부에서 진단이 받는 꼴의 계정 목록을 만든다 */
function 계정들(repo) {
  const names = {};
  try {
    const { accounts } = JSON.parse(fs.readFileSync(path.join(repo, 'docs', '마케팅', 'sns-계정.json'), 'utf8'));
    for (const [key, a] of Object.entries(accounts || {})) names[key] = { platform: a.platform || '', name: `${LABEL[a.platform] || a.platform || ''} ${a.handle || ''}`.trim() || key };
  } catch { /* 이름이 없으면 키로 보인다 */ }
  const by = new Map();
  const get = (key, platform) => {
    if (!by.has(key)) by.set(key, { key, name: names[key]?.name || key, platform: names[key]?.platform || platform || '', followers: [], posts: new Map() });
    return by.get(key);
  };
  const post = (acc, id) => { if (!acc.posts.has(id)) acc.posts.set(id, { id, title: null, publishedAt: null, points: {}, screen: {} }); return acc.posts.get(id); };
  const owner = new Map(); // 게시물 → 계정(화면 줄에는 계정이 없다)
  const ledger = lines(path.join(repo, 'docs', '_ops', '게시성과.jsonl'));
  for (const r of ledger) {
    if (r.kind !== '판정' || !r.account || !r.post) continue;
    const acc = get(r.account, r.platform), p = post(acc, r.post);
    owner.set(r.post, acc);
    p.title = 제목(r.folder) || p.title; p.publishedAt = r.publishedAt || p.publishedAt;
    if (r.point) p.points[r.point] = { ...p.points[r.point], ...r.metrics }; // 같은 점의 뒤 줄이 앞 줄을 덮는다
  }
  for (const r of ledger) if (r.kind === '화면' && owner.has(r.post)) Object.assign(post(owner.get(r.post), r.post).screen, r.metrics);
  for (const r of lines(path.join(repo, 'docs', '_ops', '채널성과.jsonl'))) {
    if (r.kind !== 'account' || !r.account || typeof r.followers !== 'number') continue;
    const acc = get(r.account), views = r.postViews ?? r.views;
    acc.followers.push({ date: r.date, n: r.followers, ...(typeof views === 'number' ? { views } : {}) });
    const c = r.followersChange; // 서버가 준 7일 전과 14일 전의 값도 한 점씩으로 넣는다
    if (c && typeof c.delta === 'number' && c.since) {
      acc.followers.push({ date: c.since, n: r.followers - c.delta });
      if (typeof c.previous === 'number' && c.previousSince) acc.followers.push({ date: c.previousSince, n: r.followers - c.delta - c.previous });
    }
  }
  return [...by.values()].map(a => ({ ...a, posts: [...a.posts.values()].filter(p => p.publishedAt) }));
}

function 글(d) {
  const out = [`■ ${d.name} — ${d.상태} · ${d.유형}`, `  ${d.결론}`];
  for (const s of d.신호) out.push(`  [${s.판정}] ${s.이름}${s.값 ? ` (${s.값})` : ''}: ${s.글}`);
  d.처방.forEach((p, i) => out.push(`  할 일 ${i + 1}. ${p}`));
  return out.join('\n');
}

function main(argv) {
  const arg = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  const repo = path.resolve(arg('--저장소') || path.join(__dirname, '..'));
  const now = arg('--지금') ? Date.parse(arg('--지금')) : Date.now();
  if (!Number.isFinite(now)) { console.error('--지금 값이 시각이 아닙니다.'); return 2; }
  const only = arg('--계정');
  const list = 계정들(repo).filter(a => !only || a.key === only).map(a => 진단(a, now));
  const when = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const room = 방(list, { now, 모은때: `${when}에 장부에서 읽었습니다.` });
  if (argv.includes('--json')) { console.log(JSON.stringify(room, null, 1)); return 0; }
  console.log(`${room.say} ${room.then}\n(${room.scope})\n`);
  const order = new Map(room.rows.map((r, i) => [r.key, i]));
  for (const d of [...list].sort((a, b) => order.get(a.key) - order.get(b.key))) if (d.상태 !== '판단 이름' || only) console.log(글(d) + '\n');
  const early = list.filter(d => d.상태 === '판단 이름');
  if (early.length && !only) console.log(`아직 이른 계정 ${early.length}개: ${early.map(d => d.name).join(', ')}`);
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { 계정들, 제목 };
