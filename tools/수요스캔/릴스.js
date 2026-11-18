#!/usr/bin/env node
'use strict';
/* 수요 스캔 · 인스타 릴스(2026-10-28) — 설정 「인스타」 계정의 릴스 재생 수를 ego(로그인된 인스타)에서 읽기만 해 튄 편을 고르고,
 * 오마주 원본으로 고른 릴스의 mp4를 받는다(컷 재기용, git 밖). 유튜브 · 틱톡은 스캔.js가 읽는다 — 인스타 · 페이스북은 로그인 벽이라
 * 「못 잼」이었고, 그래서 LAB 몽골(시청자가 인스타 · 페이스북에 있다)은 10-24~28 닷새 동안 튄 편이 0편이었다.
 *
 *   node tools/수요스캔/릴스.js 읽기 <lab-en|lab-mn|synkbrief|yuhobuilds|전부> [--날짜 YYYY-MM-DD] [--출력 <폴더>] [--내림 8]
 *   node tools/수요스캔/릴스.js 받기 <릴스 주소|code>   → <공용 작업본>/.tmp/오마주/ig_<code>/원본.mp4
 *
 * 판정은 틱톡과 같다(tools/수요스캔/수요판정.js 틱톡정리 — 그 계정 최근 릴스 30편 재생 중앙값의 3배 이상, 브랜드 틱톡 최소 조회 이상,
 * 창 28일 안). 설정 「릴스판정」이 있으면 그것으로. 누적은 쓰지 않아 회차마다 창 안 튄 편을 다시 싣는다 — 장부에 이미 있는 편인지는 스캔
 * 세션이 본다. 결과: <출력>/릴스.json · 릴스.md(git 밖). 계정 보호 확인 · 로그인 화면이 뜨면 그 자리에서 멈추고 「막힘」으로 적는다(유호님 손).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const 판정 = require('./수요판정.js');
const 스캔 = require('./스캔.js');
const { 공용작업본 } = require('../lib/공용작업본.js');

const 저장소 = path.resolve(__dirname, '..', '..');

function 돌리기(job) {
  const body = fs.readFileSync(path.join(__dirname, '릴스읽기.mjs'), 'utf8');
  const r = spawnSync('ego-browser nodejs', { input: `globalThis.JOB = ${JSON.stringify(job)};\n${body}`, encoding: 'utf8', windowsHide: true, shell: true, timeout: 40 * 60_000 });
  if (r.status !== 0) throw new Error('ego 실행 실패: ' + String(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' '));
  return JSON.parse(fs.readFileSync(job.out, 'utf8'));
}

// 릴스 code는 미디어 번호를 64진법으로 적은 것이고, 그 번호의 앞 41비트가 올린 시각이다(밀리초, 2011-08-24 기준).
// 릴스 탭 응답에 taken_at이 실리지 않아도 올린 때를 잴 수 있다(2026-11-18 — 우리 릴스 셋의 예약 시각과 초까지 맞았다).
const 코드글자 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const 인스타기준 = 1314220021721n;
function 코드올린때(code) {
  if (typeof code !== 'string' || !/^[\w-]{9,12}$/.test(code)) return null;
  let 번호 = 0n;
  for (const 글자 of code) 번호 = 번호 * 64n + BigInt(코드글자.indexOf(글자));
  const 밀리초 = Number((번호 >> 23n) + 인스타기준);
  // 인스타가 연 2010-10부터 지금 하루 뒤까지만 믿는다. 그 밖이면 code 꼴이 달라진 것이다.
  return 밀리초 >= Date.UTC(2010, 9, 1) && 밀리초 <= Date.now() + 86_400_000 ? Math.floor(밀리초 / 1000) : null;
}

// ego 결과(계정 하나) → 틱톡정리와 같은 꼴의 판정
function 계정판정(rec, { 오늘, 기준값, 창 = 판정.기본.창 }) {
  if (rec.상태 !== '됨') return { 핸들: rec.핸들, 상태: rec.상태, 까닭: rec.까닭 || null, 후보: [] };
  // 올린 때가 응답에 없으면 code에서 잰다. 11-18까지는 그런 편을 말없이 버려, 릴스를 80편 넘게 읽고도 「릴스 0편 · 튄 편 0」이었다.
  const 받은 = (rec.릴스 || []).filter((x) => x && x.code).map((x) => ({ ...x, 올린때: Number.isFinite(x.올린때) ? x.올린때 : 코드올린때(x.code) }));
  const 날짜없음 = 받은.filter((x) => !Number.isFinite(x.올린때)).length;
  const 목록 = 받은.filter((x) => Number.isFinite(x.올린때)).map((x) => ({
    id: x.code, 날짜: new Date(x.올린때 * 1000).toISOString(), 조회: Number.isFinite(x.재생) ? x.재생 : null,
    길이: Number.isFinite(x.길이) ? Math.round(x.길이) : null, 좋아요: x.좋아요 ?? null, 댓글수: x.댓글 ?? null,
  }));
  const r = 판정.틱톡정리({ 목록, 오늘, 판정: { ...판정.기본.틱톡판정, ...(기준값 || {}) }, 창 });
  const 가장새편 = 목록.reduce((m, p) => (!m || p.날짜 > m ? p.날짜 : m), null);
  return {
    핸들: rec.핸들, 상태: '됨', 읽은편: 목록.length, 날짜없음, 창안: r.창안, 가장새편: 가장새편 ? 가장새편.slice(0, 10) : null,
    기준: r.기준.중앙값 === null ? null : { 중앙값: r.기준.중앙값, 편수: r.기준.편수 },
    후보: r.후보.map((p) => ({ id: p.id, 날짜: p.날짜, 조회: p.조회, 배수: p.배수, 길이: p.길이, 좋아요: p.좋아요, 댓글수: p.댓글수, 주소: `https://www.instagram.com/reel/${p.id}/` })),
  };
}

const 짧은수 = (n) => (!Number.isFinite(n) ? '—' : n >= 1e4 ? `${Math.round(n / 1e3) / 10}만` : n >= 1e3 ? `${Math.round(n / 100) / 10}천` : String(n));

function 글(결과, 날짜, { 내용표 = false } = {}) {
  const 줄 = [`# 인스타 릴스 · ${날짜}`, '', '> 설정 「인스타」 계정의 릴스 탭을 ego에서 읽기만 했다. 튄 편 = 그 계정 최근 릴스 재생 중앙값의 3배 이상(틱톡 기준과 같음), 창 28일 안. 누적은 쓰지 않아 지난 회차에 실린 편도 다시 나온다.'];
  // 같은 폴더에 사람이 튄 편을 열어 본 표(주제 · 사람 · 몇 마디 · 첫 화면 글)가 있으면 후보를 고를 때 함께 본다(11-18).
  if (내용표) 줄.push('>', '> 튄 편을 열어 본 내용 표가 같은 폴더 `릴스_내용.md`에 있다. 후보를 고를 때 함께 본다.');
  for (const [b, s] of Object.entries(결과)) {
    줄.push('', `## ${b}`, '');
    if (s.막힘) 줄.push(`**막힘 — ${s.막힘}.** 남은 계정은 부르지 않았다(유호님 손 — 확인 창은 누르지 않는다).`, '');
    for (const a of s.계정) {
      if (a.상태 !== '됨') { 줄.push(`- @${a.핸들} — ${a.상태}${a.까닭 ? `(${a.까닭})` : ''}`); continue; }
      // 창 안에 새 릴스가 없으면 멈춘 계정일 수 있다(11-18: 넷 가운데 셋이 5~6월에 멈춘 채 19일 동안 목록에 남았다)
      const 멈춤 = a.창안 === 0 && a.읽은편 > 0 ? ` · **28일 안 새 릴스 없음(가장 새 편 ${a.가장새편}) — 멈춘 계정이면 설정 「인스타」에서 바꾼다**` : '';
      줄.push(`- @${a.핸들} — 릴스 ${a.읽은편}편${Number.isInteger(a.창안) ? ` · 창 안 ${a.창안}편` : ''} · 중앙 ${a.기준 ? 짧은수(a.기준.중앙값) : '못 잼(5편 안 됨)'} · 튄 편 ${a.후보.length}${멈춤}${a.날짜없음 ? ` · **올린 때를 못 읽어 판정에서 빠진 편 ${a.날짜없음}** — 0편이 아니라 못 잰 것이다(릴스읽기.mjs의 taken_at · code 꼴을 본다)` : ''}`);
      for (const p of a.후보) 줄.push(`  - ${p.id}(${짧은수(p.조회)} · ×${p.배수 ?? '—'} · ${String(p.날짜).slice(0, 10)} · ${p.길이 ?? '—'}초 · 좋아요 ${짧은수(p.좋아요)} · 댓글 ${짧은수(p.댓글수)}) ${p.주소}`);
    }
  }
  return 줄.join('\n') + '\n';
}

function 읽기(브랜드들, o = {}) {
  const 오늘 = o.날짜 || 판정.서울날짜();
  const 출력 = o.출력 || path.join(공용작업본(저장소), '.tmp', '수요스캔', 오늘);
  fs.mkdirSync(출력, { recursive: true });
  const 결과 = {};
  let 막힘 = null;
  for (const b of 브랜드들) {
    const { 설정, 오류 } = 스캔.설정읽기(b);
    if (오류.length) throw new Error(`${b} 설정: ${오류.join(' · ')}`);
    const 계정 = (설정.인스타 || []).map((x) => x.핸들);
    if (!계정.length) continue;
    if (막힘) { 결과[b] = { 막힘, 계정: [] }; continue; }
    const raw = (o.돌리기 || 돌리기)({ 일: '계정', 계정, 내림: o.내림 || 8, out: path.join(출력, `릴스원자료_${b}.json`).replace(/\\/g, '/') });
    const 계정판정들 = raw.결과.map((rec) => 계정판정(rec, { 오늘, 기준값: 설정.릴스판정 || 설정.틱톡판정 }));
    const 막 = raw.결과.find((r) => r.상태 === '막힘');
    if (막) 막힘 = 막.까닭;
    결과[b] = { 막힘: 막 ? 막.까닭 : null, 계정: 계정판정들 };
  }
  fs.writeFileSync(path.join(출력, '릴스.json'), JSON.stringify({ 날짜: 오늘, 브랜드: 결과 }, null, 1) + '\n');
  fs.writeFileSync(path.join(출력, '릴스.md'), 글(결과, 오늘, { 내용표: fs.existsSync(path.join(출력, '릴스_내용.md')) }));
  return { 출력, 결과, 막힘 };
}

function 받기(arg) {
  const code = (String(arg).match(/instagram\.com\/(?:reel|reels|p)\/([\w-]+)/) || [])[1] || (/^[\w-]{6,}$/.test(arg) ? arg : null);
  if (!code) throw new Error(`릴스 주소나 code가 아니다: ${arg}`);
  const dir = path.join(공용작업본(저장소), '.tmp', '오마주', `ig_${code}`);
  fs.mkdirSync(dir, { recursive: true });
  const saveAs = path.join(dir, '원본.mp4').replace(/\\/g, '/');
  const raw = 돌리기({ 일: '받기', code, saveAs, out: path.join(dir, '받기.json').replace(/\\/g, '/') });
  const rec = raw.결과[0] || {};
  if (rec.상태 !== '됨') throw new Error(`못 받았다 — ${rec.상태}${rec.까닭 ? `(${rec.까닭})` : ''}`);
  return { file: saveAs, 주소: `https://www.instagram.com/reel/${code}/`, rec };
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const o = {};
  const 대상 = [];
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === '--날짜' || a === '--출력' || a === '--내림') { o[a.slice(2)] = a === '--내림' ? Number(rest[++i]) : rest[++i]; continue; }
    if (a === '전부') 대상.push(...판정.브랜드목록); else 대상.push(a);
  }
  if (o.출력) o.출력 = path.resolve(o.출력);
  if (cmd === '읽기' && 대상.length) {
    const 몰라 = 대상.filter((b) => !판정.브랜드목록.includes(b));
    if (몰라.length) throw new Error(`모르는 브랜드: ${몰라.join(' · ')}`);
    const r = 읽기(대상, o);
    for (const [b, s] of Object.entries(r.결과)) console.log(`[${b}] ${s.막힘 ? `막힘 — ${s.막힘}` : `계정 ${s.계정.length} · 튄 편 ${s.계정.reduce((n, a) => n + a.후보.length, 0)}`}`);
    console.log(`→ ${path.join(r.출력, '릴스.md')}`);
    return r.막힘 ? 3 : 0;
  }
  if (cmd === '받기' && 대상[0]) {
    const r = 받기(대상[0]);
    console.log(`받음: ${r.file}(git 밖)\n다음: node tools/오마주.js 분해 ${r.file} --주소 ${r.주소} --편 <편 폴더>`);
    return 0;
  }
  console.error('사용: node tools/수요스캔/릴스.js 읽기 <브랜드|전부> [--날짜 YYYY-MM-DD] [--출력 <폴더>] [--내림 8]\n      node tools/수요스캔/릴스.js 받기 <릴스 주소|code>');
  return 2;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (error) { console.error(`❌ ${error.message}`); process.exitCode = 1; }
}

module.exports = { 계정판정, 읽기, 글, 코드올린때 };
