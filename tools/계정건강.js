#!/usr/bin/env node
'use strict';
/* 계정 건강 진단 — 우리 계정의 숫자를 이미 쌓인 두 장부에서 읽어 건강 상태와 처방을 낸다(2026-11-19, AI 없음, 읽기만 한다).
 *
 *   node tools/계정건강.js                 계정마다 상태, 유형, 결론, 신호, 처방을 글로 보인다
 *   node tools/계정건강.js --json          솔리오 방의 꼴({ say, then, when, scope, rows })로 낸다
 *   node tools/계정건강.js --계정 <키>      한 계정만
 *   node tools/계정건강.js --요약쓰기        PC 앱 솔리오가 읽는 요약 한 장을 쓴다(--자리 <파일>로 자리를 바꾼다).
 *                                          장부를 덜 읽었거나 계정 줄이 절반 아래로 줄었으면 앞 요약을 그대로 둔다(--줄어도 로 넘긴다)
 *   공통: --저장소 <폴더>(기본: 이 도구가 든 저장소) · --지금 <ISO 시각>(다시 보기 · 시험)
 *
 * 읽는 것: docs/_ops/게시성과.jsonl(게시물마다 24시간 · 72시간 · 7일 숫자와 화면에서 읽은 값) · docs/_ops/채널성과.jsonl(팔로워) · docs/마케팅/sns-계정.json(이름)
 * 판정 규칙과 기준 숫자는 lib/계정건강.js, 설계와 출처는 docs/디자인/솔리오_계정건강_20261119/README.md.
 * 네트워크를 쓰지 않는다. --요약쓰기일 때만 파일 하나를 쓴다: %LOCALAPPDATA%\synk\sns-health\summary.json(저장소 밖,
 * desktop/src/sns-health.cjs가 같은 자리를 읽는다. 꼴은 같은 폴더 문서 PC앱_구현설계.md 5절). 게시 성과 예약이 판정 뒤에 부른다.
 * 숫자를 새로 재려면 `node tools/채널성과.js --재기`와 게시 성과 예약이 먼저 돈다.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { 진단, 방 } = require('./lib/계정건강.js');

/** 요약의 판. 읽는 쪽(PC 앱)이 깨지게 꼴을 바꿀 때만 올린다. 줄 꼴을 더하는 것은 올리지 않는다 */
const 요약판 = 1;
function 요약자리(env = process.env) {
  if (env.SYNK_SNS_HEALTH_SUMMARY) return env.SYNK_SNS_HEALTH_SUMMARY;
  return path.join(env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'synk', 'sns-health', 'summary.json');
}
/** 요약이 이보다 크면 쓰지 않는다. 앱은 512KB를 넘는 요약을 읽지 않는다(desktop/src/sns-health.cjs) */
const 요약한도 = 400 * 1024;
/**
 * 방 → 요약. 「모은 때」 글은 싣지 않는다(앱이 만든다).
 * 숫자: 진단에 쓴 숫자를 마지막으로 잰 때다. 만든때는 요약을 쓴 때라 숫자가 새것인지는 말하지 못한다(11-19 설계 검토 P2-1).
 *   게시 = 게시 성과 장부의 마지막 판정 시각(ISO), 팔로워 = 채널 성과 장부의 마지막 잰 날(YYYY-MM-DD). 없으면 null
 */
function 요약(room, now, 숫자 = {}) {
  const { when, ...rest } = room;
  return { 판: 요약판, 만든때: new Date(now).toISOString(), 숫자: { 게시: 숫자.게시 || null, 팔로워: 숫자.팔로워 || null }, 방: rest };
}
/** 장부 한 장을 엄하게 읽는다: 줄들과 깨진 줄 수. 파일이 없으면 null */
function 장부(file) {
  if (!fs.existsSync(file)) return null;
  let 깨짐 = 0;
  const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch { 깨짐 += 1; return null; } }).filter(Boolean);
  return { rows, 깨짐 };
}
/**
 * 요약을 써도 되는가. 덜 읽은 장부로 지은 요약이 좋은 요약을 덮지 않게 한다(11-19 설계 검토 P2-2) —
 * 운영 사본이 origin을 따라가는 중이거나 합치다 만 자국이 남으면 장부의 일부만 읽힌다.
 * @returns {{ 까닭: string|null, 숫자: { 게시, 팔로워 } }}
 */
function 쓸수있나(repo) {
  const 게시 = 장부(path.join(repo, 'docs', '_ops', '게시성과.jsonl')), 채널 = 장부(path.join(repo, 'docs', '_ops', '채널성과.jsonl'));
  const 숫자 = { 게시: null, 팔로워: null };
  if (!게시 || !게시.rows.some(r => r.kind === '판정')) return { 까닭: '게시 성과 장부(docs/_ops/게시성과.jsonl)에 판정 줄이 없습니다.', 숫자 };
  if (!채널 || !채널.rows.some(r => r.kind === 'account')) return { 까닭: '채널 성과 장부(docs/_ops/채널성과.jsonl)에 계정 줄이 없습니다.', 숫자 };
  if (게시.깨짐 || 채널.깨짐) return { 까닭: `장부에 읽지 못한 줄이 있습니다(게시 성과 ${게시.깨짐}줄, 채널 성과 ${채널.깨짐}줄).`, 숫자 };
  try { JSON.parse(fs.readFileSync(path.join(repo, 'docs', '마케팅', 'sns-계정.json'), 'utf8')); } catch { return { 까닭: '계정 목록(docs/마케팅/sns-계정.json)을 읽지 못했습니다.', 숫자 }; }
  const 끝 = list => list.filter(Boolean).sort().at(-1) || null;
  숫자.게시 = 끝(게시.rows.filter(r => r.kind === '판정' && typeof r.at === 'string' && Number.isFinite(Date.parse(r.at))).map(r => new Date(Date.parse(r.at)).toISOString()));
  숫자.팔로워 = 끝(채널.rows.filter(r => r.kind === 'account' && typeof r.followers === 'number' && /^\d{4}-\d{2}-\d{2}$/.test(r.date || '')).map(r => r.date));
  return { 까닭: null, 숫자 };
}
/** 앞 요약의 계정 줄 수. 없거나 못 읽으면 0 */
function 앞줄수(자리) {
  try { const n = JSON.parse(fs.readFileSync(자리, 'utf8'))?.방?.rows?.length; return Number.isInteger(n) ? n : 0; } catch { return 0; }
}
/** 임시 파일에 쓰고 이름을 바꿔 덮는다. 쓰다 멈춰도 앞 요약이 남는다 */
function 요약쓰기(자리, body) {
  fs.mkdirSync(path.dirname(자리), { recursive: true });
  const 임시 = `${자리}.${process.pid}.tmp`;
  try { fs.writeFileSync(임시, JSON.stringify(body, null, 1)); fs.renameSync(임시, 자리); } catch (e) { try { fs.unlinkSync(임시); } catch { /* 없으면 둔다 */ } throw e; }
}

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
    if (r.role) p.group = r.role; // 우리 편의 갈래는 기획 장부의 구실(유입 · 권위 · 육성 · 전환)이다
    if (r.format) p.format = r.format; // 쇼츠와 긴 영상, 릴스와 사진은 따로 본다
    // 같은 점의 뒤 줄이 앞 줄을 덮는다. 유튜브의 「구독 늘어남」은 진단의 팔로우 칸으로 옮긴다
    if (r.point) p.points[r.point] = { ...p.points[r.point], ...r.metrics, ...(typeof r.metrics?.subscribersGained === 'number' ? { follows: r.metrics.subscribersGained } : {}) };
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
  const x = d.세부;
  if (x?.강점) out.push(`  잘하고 있는 것: ${x.강점}`);
  if (x?.길.length) out.push(`  조회 1,000번이 가는 길: ${x.길.map(s => `${s.이름}[${s.판정}] ${s.글}`).join(' → ')}`, `    ${[x.새는곳.글, x.고름].filter(Boolean).join(' ')}`);
  if (x?.대조) out.push(`  잘된 편과 안 된 편: ${[x.대조.글, x.갈래].filter(Boolean).join(' ')}`);
  for (const s of d.신호) out.push(`  [${s.판정}] ${s.이름}${s.값 ? ` (${s.값})` : ''}: ${s.글}`);
  d.처방.forEach((p, i) => out.push(`  할 일 ${i + 1}. ${p}`));
  if (x?.목표) out.push(`  ${x.목표}`);
  return out.join('\n');
}

function main(argv) {
  const arg = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  const repo = path.resolve(arg('--저장소') || path.join(__dirname, '..'));
  const now = arg('--지금') ? Date.parse(arg('--지금')) : Date.now();
  if (!Number.isFinite(now)) { console.error('--지금 값이 시각이 아닙니다.'); return 2; }
  const only = arg('--계정');
  const write = argv.includes('--요약쓰기');
  let 숫자 = null;
  if (write) {
    // 한 계정만 든 요약이나 덜 읽은 장부로 지은 요약이 앞 요약을 덮지 않게 한다
    if (only) { console.error('--요약쓰기는 --계정과 함께 쓰지 않습니다.'); return 2; }
    const ok = 쓸수있나(repo);
    if (ok.까닭) { console.error(`${ok.까닭} 요약은 그대로 둡니다.`); return 1; }
    숫자 = ok.숫자;
  }
  const list = 계정들(repo).filter(a => !only || a.key === only).map(a => 진단(a, now));
  const when = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const room = 방(list, { now, 모은때: `${when}에 장부에서 읽었습니다.` });
  if (write) {
    const 자리 = path.resolve(arg('--자리') || 요약자리()), body = 요약(room, now, 숫자);
    const 크기 = Buffer.byteLength(JSON.stringify(body, null, 1)), 앞 = 앞줄수(자리);
    if (크기 > 요약한도) { console.error(`요약이 ${Math.round(크기 / 1024)}KB라 앱이 읽는 한도에 가깝습니다. 요약은 그대로 둡니다.`); return 1; }
    // 계정 줄이 앞 요약의 절반 아래로 줄었으면 장부를 덜 읽은 것일 수 있다. 정말 줄었으면 --줄어도 를 붙여 쓴다
    if (room.rows.length * 2 < 앞 && !argv.includes('--줄어도')) { console.error(`계정 줄이 ${앞}개에서 ${room.rows.length}개로 줄었습니다. 요약은 그대로 둡니다(맞으면 --줄어도).`); return 1; }
    요약쓰기(자리, body);
    console.log(`요약을 썼습니다: ${자리} (계정 줄 ${room.rows.length}개, ${room.say} 게시 숫자 ${숫자.게시 || '없음'} · 팔로워 ${숫자.팔로워 || '없음'})`);
    return 0;
  }
  if (argv.includes('--json')) { console.log(JSON.stringify(room, null, 1)); return 0; }
  console.log(`${room.say} ${room.then}\n(${room.scope})\n`);
  const order = new Map(room.rows.map((r, i) => [r.key, i]));
  for (const d of [...list].sort((a, b) => order.get(a.key) - order.get(b.key))) if (d.상태 !== '판단 이름' || only) console.log(글(d) + '\n');
  const early = list.filter(d => d.상태 === '판단 이름');
  if (early.length && !only) console.log(`아직 이른 계정 ${early.length}개: ${early.map(d => d.name).join(', ')}`);
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { 계정들, 제목, 요약, 요약쓰기, 요약자리, 요약판, 요약한도, 쓸수있나, main };
