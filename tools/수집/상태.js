#!/usr/bin/env node
'use strict';
/**
 * 수집 상태 한 장 — tools/수집/목록.json의 일마다 마지막으로 돈 때 · 결과 · 다음 차례를 한 화면에 보인다(2026-11-25).
 *
 *   node tools/수집/상태.js                 상태 한 장
 *   node tools/수집/상태.js --찾은수 [14]    최근 N일(기본 14) 공모 지도에 처음 들어온 공고를 AI마다 세고, 혼자만 찾은 수를 보인다
 *   node tools/수집/상태.js --표 [--쓰기]    관문 · 자동화 한 장에 싣는 표(목록에서 만든다). --쓰기는 그 문서의 표 자리만 바꾼다
 *
 * 마지막 칸은 목록의 「마지막」 꼴로 읽는다: 수집기록(돌리기 기록) · 윈도예약(작업 스케줄러) · 최근파일 · 엑스기록 · 보고서(공모 보고서의 finder).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 공용작업본 } = require('../lib/공용작업본.js');
const 돌 = require('./돌리기.js');

const 뿌리 = path.resolve(__dirname, '..', '..');
const 공용 = () => 공용작업본(뿌리);
const 보관함 = () => process.env.SYNK_GRANTS_DIR || path.join(os.homedir(), 'Documents', 'SYNK-보관함', '지원사업');
const 서울 = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const 표시이름 = { opus: 'Opus', sol: 'Sol', gemini: 'Gemini', grok: '그록', mail: '메일' };
const 관문문서 = path.join(뿌리, 'docs', '_ops', '관문_자동화.md');
const 표시작 = '<!-- 수집목록 시작: node tools/수집/상태.js --표 --쓰기 가 만든다. 손으로 고치지 말고 tools/수집/목록.json을 고친다 -->';
const 표끝 = '<!-- 수집목록 끝 -->';

function 윈도예약들(이름들) {
  if (!이름들.length || process.platform !== 'win32') return {};
  const 목록 = 이름들.map((n) => `'${n.replace(/'/g, "''")}'`).join(',');
  const 명령 = `$o=@{}; foreach($n in @(${목록})){ try { $i=Get-ScheduledTaskInfo -TaskName $n -ErrorAction Stop; $o[$n]=@{ 마지막=$i.LastRunTime.ToString('o'); 결과=$i.LastTaskResult; 다음=$(if($i.NextRunTime){$i.NextRunTime.ToString('o')}else{''}) } } catch { $o[$n]=@{ 없음=$true } } }; [Console]::OutputEncoding=[Text.Encoding]::UTF8; $o | ConvertTo-Json -Depth 3 -Compress`;
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', 명령], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
  try { return JSON.parse(r.stdout.trim() || '{}'); } catch { return {}; }
}

function 최근파일(설정) {
  const 폴더 = path.join(뿌리, 설정.폴더);
  try {
    const 꼴 = new RegExp(설정.꼴);
    const f = fs.readdirSync(폴더).filter((x) => 꼴.test(x)).sort().pop();
    return f ? { 글: f } : { 글: '파일 없음' };
  } catch { return { 글: '폴더 없음' }; }
}

function 엑스기록() {
  const 폴더 = path.join(공용(), '.tmp', '수요스캔');
  let 날짜들 = [];
  try { 날짜들 = fs.readdirSync(폴더).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse().slice(0, 6); } catch { return { 글: '기록 없음' }; }
  let 부름 = null, 이어 = null;
  for (const d of 날짜들) {
    let 줄들 = [];
    try { 줄들 = fs.readFileSync(path.join(폴더, d, '기록.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((j) => j?.도구 === '엑스'); } catch { continue; }
    for (const j of 줄들) {
      const t = Date.parse(j.때);
      if (j.이어씀) { if (!이어 || t > 이어) 이어 = t; } else if (!부름 || t > 부름) 부름 = t;
    }
  }
  return { 글: `그록 부름 ${부름 ? 서울(부름) : '없음'}${이어 ? ` · 이어 씀 ${서울(이어)}` : ''}` };
}

function 보고서들() {
  try { return require('../lib/grok-contests.cjs').보고서읽기(보관함()); } catch { return []; }
}

function 마지막보고서(finder, 보고) {
  const 내것 = 보고.filter((r) => (r.finder || 'grok') === finder);
  const r = 내것[내것.length - 1];
  return r ? { 글: `${서울(Date.parse(r.importedAt))} 받음 · 공고 ${r.items.length}` } : { 글: '받은 보고서 없음' };
}

function 수집기록(id, 기록) {
  const r = 기록.filter((x) => x.id === id).pop();
  if (!r) return { 글: '아직 안 돎' };
  const s = r.요약 || {};
  const 더 = r.결과 === '받음' ? ` · 찾음 ${s.찾음 ?? '?'} · 원문 확인 ${s.원문확인 ?? '?'} · 새 공고 ${s.새공고 ?? '?'}` : s.막힘 ? `(${s.막힘})` : r.까닭 ? ` — ${r.까닭}` : '';
  return { 글: `${서울(Date.parse(r.시작))} ${r.결과}${더}`, 나쁨: r.결과 !== '받음' };
}

/** 수집 예약의 다음 차례(한국 시각 글). */
function 다음차례(일, 기록, 지금 = Date.now()) {
  if (일.돌리는곳?.종류 !== '수집 예약' || 일.켜짐 === false) return '';
  for (let 날 = 0; 날 < 4; 날 += 1) {
    const 회차 = 돌.오늘회차(일, 지금 + 날 * 864e5);
    if (!회차) return '';
    if (돌.때인가(일, 기록, Math.max(회차.때ms, 지금)).돌림) return 회차.때ms > 지금 ? 서울(회차.때ms) : '지금(다음 돌리기 때)';
  }
  return '';
}

function 상태(목록, 기록, 지금 = Date.now()) {
  const 윈도 = 윈도예약들(목록.map((x) => x.마지막?.윈도예약).filter(Boolean));
  const 보고 = 목록.some((x) => x.마지막?.보고서) ? 보고서들() : [];
  return 목록.map((일) => {
    const m = 일.마지막 || {};
    let 마지막 = { 글: '기록 없음(앱이나 봇 대화에서 본다)' }, 다음 = '';
    if (m.수집기록) { 마지막 = 수집기록(m.수집기록, 기록); 다음 = 다음차례(일, 기록, 지금); }
    else if (m.윈도예약) {
      const w = 윈도[m.윈도예약] || {};
      마지막 = w.없음 ? { 글: '예약 없음', 나쁨: true } : { 글: w.마지막 ? `${서울(Date.parse(w.마지막))} · 결과 ${w.결과}` : '모름', 나쁨: w.결과 != null && w.결과 !== 0 && w.결과 !== 267009 };
      다음 = w.다음 ? 서울(Date.parse(w.다음)) : '';
    } else if (m.최근파일) 마지막 = 최근파일(m.최근파일);
    else if (m.엑스기록) 마지막 = 엑스기록();
    else if (m.보고서) 마지막 = 마지막보고서(m.보고서, 보고);
    return { id: 일.id, 이름: 일.이름, 누가: 일.누가, 언제: 일.주기?.글 || (일.주기?.매일 ? `매일 ${일.주기.매일}` : 일.주기?.간격일 ? `${일.주기.간격일}일마다 ${일.주기.시각}` : ''), 마지막: 마지막.글, 나쁨: !!마지막.나쁨, 다음 };
  });
}

/** 최근 N일 공모 지도에 처음 들어온 공고를 AI마다 센다. 혼자 = 그 AI만 찾은 공고. */
function 찾은수(일수 = 14, 지금 = Date.now()) {
  const 그록 = require('../lib/grok-contests.cjs');
  let 통합 = { items: [] };
  try { 통합 = JSON.parse(fs.readFileSync(path.join(보관함(), '통합목록.json'), 'utf8')); } catch { /* 빈 목록 */ }
  const 합 = 그록.합치기(통합, 그록.보고서읽기(보관함()));
  const 기준 = new Date(지금 - 일수 * 864e5 + 9 * 3600e3).toISOString().slice(0, 10);
  // 같은 영화제가 이름 · 주소만 조금 달라 따로 남은 줄은 지도 카드처럼 합쳐 센다(제목 열쇠가 서로를 품거나 공식 주소가 같으면 한 공고).
  const { 제목열쇠 } = require('../공모지도.js');
  const 묶음 = [];
  for (const o of 합.items) {
    const by = o.grok_contest?.foundBy;
    if (!by?.length || !o.grok_first_seen || o.grok_first_seen < 기준) continue;
    const k = 제목열쇠(o.title || ''), 주소 = o.grok_contest.officialUrl || '', 마감 = o.grok_contest.deadline?.date || '';
    const 같음 = 묶음.find((g) => (주소 && g.주소.has(주소))
      || g.줄.some((j) => k.length >= 5 && j.k.length >= 5 && (k.includes(j.k) || j.k.includes(k)) && (!마감 || !j.마감 || 마감 === j.마감)));
    if (같음) { for (const f of by) 같음.by.add(f); 같음.줄.push({ k, 마감 }); if (주소) 같음.주소.add(주소); }
    else 묶음.push({ by: new Set(by), 줄: [{ k, 마감 }], 주소: new Set(주소 ? [주소] : []) });
  }
  const 셈 = {};
  for (const g of 묶음) {
    const by = [...g.by];
    for (const f of by) {
      셈[f] ||= { 찾음: 0, 혼자: 0 };
      셈[f].찾음 += 1;
      if (by.length === 1) 셈[f].혼자 += 1;
    }
  }
  return { 기준, 셈 };
}

function 칸(s) { return String(s || '').replace(/\|/g, '/').replace(/\r?\n/g, ' '); }

function 관문표(목록) {
  const 줄 = ['| 수집 | 누가 | 언제 | 돌리는 곳 | 결과 | 읽는 곳 |', '|---|---|---|---|---|---|'];
  for (const 일 of 목록) {
    const 언제 = 일.주기?.글 || (일.주기?.매일 ? `매일 ${일.주기.매일}` : `${일.주기?.간격일}일마다 ${일.주기?.시각}`);
    const 곳 = 일.돌리는곳?.종류 === '수집 예약' ? '「SYNK 수집」(`tools/수집/돌리기.js`)' : `${일.돌리는곳?.종류} ${일.돌리는곳?.이름 ? `「${일.돌리는곳.이름}」` : ''}`.trim();
    줄.push(`| ${칸(일.이름)} | ${칸(일.누가)} | ${칸(언제)} | ${칸(곳)} | ${칸(일.결과)} | ${칸(일.읽는곳)} |`);
  }
  return 줄.join('\n');
}

function 표쓰기(목록, 파일 = 관문문서) {
  const s = fs.readFileSync(파일, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  const i = s.indexOf(표시작), j = s.indexOf(표끝);
  if (i < 0 || j < i) throw new Error(`${path.basename(파일)}에 수집목록 표 자리(${표끝})가 없다`);
  const 새 = s.slice(0, i) + 표시작 + nl + 관문표(목록).replace(/\n/g, nl) + nl + s.slice(j);
  if (새 !== s) fs.writeFileSync(파일, 새);
  return 새 !== s;
}

function main(argv) {
  const 목록 = 돌.목록읽기();
  if (argv.includes('--표')) {
    if (argv.includes('--쓰기')) { console.log(표쓰기(목록) ? '관문 표를 고쳤다' : '관문 표가 이미 같다'); return 0; }
    console.log(관문표(목록)); return 0;
  }
  if (argv.includes('--찾은수')) {
    const n = Number(argv[argv.indexOf('--찾은수') + 1]) || 14;
    const { 기준, 셈 } = 찾은수(n);
    console.log(`${기준}부터 공모 지도에 처음 들어온 공고 — AI마다 찾은 수(혼자만 찾은 수)`);
    for (const [f, v] of Object.entries(셈).sort((a, b) => b[1].혼자 - a[1].혼자)) console.log(`  ${표시이름[f] || f}: ${v.찾음}(혼자 ${v.혼자})`);
    if (!Object.keys(셈).length) console.log('  아직 없다');
    return 0;
  }
  const 줄들 = 상태(목록, 돌.기록읽기());
  console.log(`수집 상태 · ${서울(Date.now())} 한국 시각 · 정본 tools/수집/목록.json`);
  for (const r of 줄들) {
    console.log(`${r.나쁨 ? '!' : '·'} ${r.이름} — ${r.누가}`);
    console.log(`    언제 ${r.언제}${r.다음 ? ` · 다음 ${r.다음}` : ''}`);
    console.log(`    마지막 ${r.마지막}`);
  }
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { 상태, 찾은수, 관문표, 표쓰기, 다음차례, 표시작, 표끝 };
