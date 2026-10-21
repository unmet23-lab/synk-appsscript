#!/usr/bin/env node
'use strict';
/* 평소 대비 배수 계산기 (2026-10-21, 제작 방식 v2 §1·§6).
 *
 *   node tools/평소배수.js <유튜브 채널·영상 주소 | @핸들 | UC…> [더…] [--편수 12] [--롱폼] [--json]
 *
 * 채널을 주면 쇼츠 탭(--롱폼이면 동영상 탭) 맨 앞 12편과 그 중앙값, 편마다 배수(그 편 조회 ÷ 중앙값)를 보이고 3배 이상에 ★를 붙인다.
 * 영상을 주면 그 영상 채널의 12편 중앙값과 그 영상의 배수를 보인다(그 영상이 12편 안에 있어도 빼지 않는다).
 * 숫자는 YouTube Data API 공개 통계다(LAB YouTube 자격으로 읽기만 — 다른 채널도 같은 공개 숫자를 읽는다). 못 읽은 채널은 「못 잼」.
 * 우리 계정의 게시 판정 배수는 tools/게시성과.js가 회사 서버 기록으로 따로 잰다(같은 정의).
 * 인스타·틱톡은 공개 API가 없어 이 도구로 재지 않는다 — 화면의 최근 12편 조회수를 읽어 --손 으로 넣는다:
 *   node tools/평소배수.js --손 1200 340 560 … [--이편 4100]
 */
const lib = require('./lib/평소배수.js');

function 인자(argv) {
  const args = [...argv];
  const opts = { 편수: lib.KEEP, json: false, 손: null, 이편: null, 대상: [], 탭: 'shorts' };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--편수') opts.편수 = Math.max(1, Math.min(50, Number(args[++i]) || lib.KEEP));
    else if (a === '--json') opts.json = true;
    else if (a === '--롱폼') opts.탭 = 'videos';
    else if (a === '--손') { opts.손 = []; while (args[i + 1] !== undefined && /^\d[\d,]*$/.test(args[i + 1])) opts.손.push(Number(args[++i].replace(/,/g, ''))); }
    else if (a === '--이편') opts.이편 = Number(String(args[++i] || '').replace(/,/g, ''));
    else if (a === '-h' || a === '--help') opts.도움 = true;
    else opts.대상.push(a);
  }
  return opts;
}

const 수 = v => (v === null || v === undefined ? '—' : Number(v).toLocaleString('ko-KR'));
const 배 = v => (v === null || v === undefined ? '못 잼' : `${v.toFixed(v >= 10 ? 0 : 1)}배`);

async function 토큰() {
  const publisher = require('./lib/sns-publisher.js');
  const credential = publisher.readCredential('lab-youtube', { allowLegacy: true });
  if (!credential) throw new Error('LAB YouTube 자격이 없어 읽지 못했다(tools/sns-자격.ps1)');
  return (await publisher.googleAccessToken(credential)).accessToken;
}

async function 재기(opts, { token, fetchImpl = fetch } = {}) {
  const results = [];
  for (const text of opts.대상) {
    const target = lib.youtubeTarget(text);
    if (!target) { results.push({ 입력: text, 오류: '유튜브 채널·영상 주소로 읽지 못했다' }); continue; }
    try {
      const tab = await lib.youtubeShortsTab({ target, token, fetchImpl, count: opts.편수, tab: opts.탭 });
      const row = { 입력: text, 채널: tab.channel, 기준: tab.how, 중앙값: tab.median, 편수: tab.n,
        편: tab.items.map(i => ({ ...i, 배수: lib.multiple(i.views, tab.median) })) };
      if (target.kind === 'video') {
        const mine = tab.items.find(i => i.id === target.id) || await lib.youtubeVideo({ id: target.id, token, fetchImpl });
        row.이편 = mine ? { ...mine, 배수: lib.multiple(mine.views, tab.median), 열둘안: tab.items.some(i => i.id === target.id) } : null;
      }
      results.push(row);
    } catch (error) {
      results.push({ 입력: text, 오류: error.message });
    }
  }
  return results;
}

function 보이기(results) {
  for (const r of results) {
    if (r.오류) { console.log(`✗ ${r.입력}: ${r.오류} — 못 잼`); continue; }
    const 이름 = `${r.채널.title}${r.채널.handle ? ` (${r.채널.handle})` : ''}`;
    const 기준 = { 'shorts-playlist': '쇼츠 탭', 'videos-playlist': '동영상 탭', 'uploads-3min': '업로드 가운데 3분 이하(쇼츠 목록을 못 읽음)', 'uploads-long': '업로드 가운데 3분 넘는 영상(동영상 목록을 못 읽음)' }[r.기준] || r.기준;
    console.log(`\n${이름} — ${기준} 맨 앞 ${r.편수}편 중앙값 ${수(r.중앙값)}`);
    if (r.이편) {
      console.log(`  이 편 ${r.이편.id} · 조회 ${수(r.이편.views)} · ${배(r.이편.배수)}${r.이편.열둘안 ? '' : ' (12편 밖)'}${r.이편.배수 >= 3 ? ' ★' : ''}`);
    }
    for (const p of r.편) {
      console.log(`  ${p.배수 !== null && p.배수 >= 3 ? '★' : ' '} ${String(p.publishedAt || '').slice(0, 10)} ${p.id} 조회 ${수(p.views).padStart(9)} · ${배(p.배수).padStart(6)} · ${p.title.slice(0, 50)}`);
    }
  }
}

async function main(argv) {
  const opts = 인자(argv);
  if (opts.손) {
    const middle = lib.median(opts.손);
    const out = { 중앙값: middle, 편수: opts.손.length, 이편: Number.isFinite(opts.이편) ? { 조회: opts.이편, 배수: lib.multiple(opts.이편, middle) } : null };
    if (opts.json) console.log(JSON.stringify(out, null, 2));
    else console.log(`손으로 넣은 ${out.편수}편 중앙값 ${수(middle)}${out.이편 ? ` · 이 편 ${수(out.이편.조회)} → ${배(out.이편.배수)}${out.이편.배수 >= 3 ? ' ★' : ''}` : ''}`);
    return;
  }
  if (opts.도움 || !opts.대상.length) {
    console.log('쓰는 법: node tools/평소배수.js <유튜브 채널·영상 주소 | @핸들> [더…] [--편수 12] [--롱폼] [--json]\n        node tools/평소배수.js --손 <조회수 12개…> [--이편 <조회수>]');
    return;
  }
  const results = await 재기(opts, { token: await 토큰() });
  if (opts.json) console.log(JSON.stringify(results, null, 2));
  else 보이기(results);
  if (results.every(r => r.오류)) process.exitCode = 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(error => { console.error(`❌ ${error.message}`); process.exitCode = 1; });
}

module.exports = { 인자, 재기 };
