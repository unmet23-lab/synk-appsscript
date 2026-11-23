'use strict';
// ㉓ 화면 글 머묾 · 새 낱말(2026-11-23) — 최종 영상을 만든 Remotion 원본을 다시 그려 화면 글이 읽을 만큼 머무는지, 가르치는 낱말이 너무 많지 않은지 잰다
// (tools/화면글검사.js · 판정과 문턱 근거 tools/lib/화면글판정.js). 규칙 원문은 제작 절차 「화면 글은 읽을 만큼」(docs/마케팅/기획장부/제작절차.md#text-dwell).
// 왜: 11-14에 나간 LAB 몽골 「물개」 v8이 17.8초에 한국어 낱말 아홉 개, 0.5초마다 바뀌는 글, 1~2초짜리 답으로 나갔다 — 유호님 11-15 「너무 전환이 빨라서
//   이해가 어려운데」. 이해 시험은 떨어졌지만 기계 관문이 없어 「가장 나은 판」으로 올라갔다. 고친 v11~v14(글 1.2초 넘게, 답 2.5초 넘게, 낱말 넷)는 통과한다.
// 누구에게: LAB · synkbrief · yuhobuilds 편 가운데 슬롯이나 판 시각이 FROM 뒤인 편. 판이 쓰는 원본 영상(최종본 · 판 영상, 나라 판본은 뺌)마다 잰다.
// 등급:
//   고칠 것 — LAB 편 가운데 편 폴더 날짜가 FIX_FROM 이후인 편의 「심함」 걸림: 새 글이 5/6초도 안 머묾(넷플릭스가 모국어 자막에도 두지 않는 짧음),
//             답 · 뜻풀이가 1.5초도 안 머묾, 가르치는 낱말이 일곱 개 넘음. 원본에서 시간만 늘리면 되는 고침이라 그림을 다시 굽지 않는다.
//             일부러 둔 자리는 준비.json 「화면글판단」: {"머묾@9.5": "까닭"} · {"새낱말": "까닭"} — 고칠 것이 확인할 것으로 내려간다. 한 카드로 모은 줄은
//             그 카드에서 심한 줄의 시각마다 까닭이 있어야 내려간다.
//   확인할 것 — 그 밖의 걸림 전부(읽기 시간은 언어마다 어림이고, 새 글 사이(바뀜)는 심함이 없다), 그 앞에 만든 편과 synkbrief · yuhobuilds(목소리가 이끄는 모국어 자막)의 걸림,
//             못 잰 영상(원본 없음 · 원본을 다시 그린 그림이 영상과 다름 · 렌더 실패). 올리기 전 검사 전체를 멈추지 않는다.
// 이해 시험 전에도 같은 등급을 쓴다(아래 시험전검사 — tools/낯선이시험.js가 LAB 새 편의 질문을 만들기 전에 부르고, 고칠 것이 있으면 재료를 만들지 않는다).
// 잰 값은 게시/화면글검사.json에 영상 내용 해시(sha1) · 도구 지문 · 원본 지문 · 판정 조건(브랜드 · 판의 말)과 함께 둔다 — 넷이 같으면 다시 재지 않는다(한 편 1~2분).
//   해시는 재기 전에 구해 두고, 재는 사이 영상이 바뀌었으면 그 결과를 쓰지도 남기지도 않고 못 잰 것으로 알린다. 기록을 못 쓰면 확인할 것 한 줄로 알린다.
//   못 잰 결과는 다시 재도 같은 것만 남긴다(원본 없음 · 길이가 같은 composition 없음 · 원본과 영상이 다름 · 글을 하나도 못 읽음).
//   렌더 멈춤 · 글 기록 빠짐 · 주입 오류처럼 한 번 일어난 일일 수 있는 것은 다음에 다시 잰다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { FIX, LOOK } = require('./게시글규칙.js');
const 최종본 = require('./최종본관문.js');
const 묶음 = require('./게시묶음.js');

const FROM = '2026-11-24';
const FIX_FROM = '20261124';
const BRANDS = new Set(['LAB', 'synkbrief', 'yuhobuilds']);
const HARD = new Set(['머묾', '핵심', '새낱말']);
// 다시 재도 같은 못잼만 기록에 남긴다 — 그 밖(렌더 멈춤 · 글 기록 빠짐 · 주입 오류 · 부품 · 영상 파일 없음)은 다음에 다시 잰다(GPT 검수 다시 GA7)
const 남길못잼 = /^(Remotion 원본\(remotion\/src\/index\.\*\)이 없다|영상 길이 [\d.]+초와 같은 composition이 없다|원본을 다시 그린 그림이 영상과 안 맞는다|원본에서 화면 글을 하나도 못 읽었다)/;
const TOOL = path.join(__dirname, '..', '화면글검사.js');
// 도구 지문 — 판정에 쓰는 초당 글자가 언어 프로필에서 오니 그것도 넣는다(설계 검토 6)
const PARTS = [TOOL, path.join(__dirname, '화면글판정.js'), path.join(__dirname, '화면글주입.js'), path.join(__dirname, '현지화프로필.js'), path.join(__dirname, '..', '..', 'docs', '마케팅', '현지화', '언어프로필.json')];
const HOW = {
  머묾: '그 글을 1.2초 넘게 두거나, 앞 글과 한 카드로 같이 띄운다(물개 v8 0.5초 → v11 1.2초 넘게)',
  읽기: '글을 줄이거나 더 오래 둔다',
  바뀜: '앞 글을 읽을 틈(0.83초 넘게)을 두고 띄우거나, 같은 카드면 함께 띄운다',
  핵심: '답 · 뜻풀이는 2.5초 넘게 둔다 — 반전 뒤 바로 다음 장면으로 넘기지 않는다(물개 v8 «САЛЮТ» 1.1초 → v11 답 2.5초 넘게)',
  새낱말: '한 편에 가르치는 낱말을 넷 안으로 줄인다 — 둘째 세트는 다음 편으로 보낸다(물개 v8 아홉 개 → v11 넷)',
};

const 편날짜 = (name) => (String(name).match(/_(\d{8})$/) || [])[1] || null;

function applies(bundle) {
  const prep = bundle.prep || {};
  if (!BRANDS.has(prep.브랜드)) return false;
  return 최종본.inWindow(prep, FROM);
}

let toolStamp = null;
function stamp() {
  if (toolStamp) return toolStamp;
  const h = crypto.createHash('sha1');
  for (const f of PARTS) { try { h.update(fs.readFileSync(f)); } catch { h.update('없음'); } }
  toolStamp = h.digest('hex').slice(0, 12);
  return toolStamp;
}

// 원본 지문 — 화면글검사.js와 같은 셈(코드 내용 + public 이름 · 크기). 원본만 고치고 영상을 다시 안 뽑은 편을 다시 재게 한다
function sourceStamp(dir) {
  try { return require(TOOL).원본지문(require(TOOL).원본찾기(dir)); } catch { return null; }
}

// 판정 조건 — 판정이 브랜드(LAB이면 배우는 말 · 낱말 셈)와 판의 말(초당 글자 · composition 고르기)을 따르니 둘이 바뀌면 다시 잰다(GPT 검수 GA6)
function 조건지문(prep) {
  const 판 = [].concat(prep.판 || []).map((p) => [p && (p.원본 || p.파일), p && p.언어]);
  return crypto.createHash('sha1').update(JSON.stringify([prep.브랜드 || '', 판])).digest('hex').slice(0, 12);
}

// 영상 내용 해시 — 크기 · 수정 시각이 같은 바꿔치기도 가른다(GPT 검수 다시 GA8). 25MB 영상 하나에 0.1초 안팎
function statOf(file) {
  try { const st = fs.statSync(file); return { 바이트: st.size, 해시: crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex') }; } catch { return null; }
}
const 같은영상 = (a, b) => !!a && !!b && a.바이트 === b.바이트 && a.해시 === b.해시;

function cached(cacheFile, key, stat, src, cond) {
  try {
    const row = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))[key];
    if (row && 같은영상(row, stat) && row.도구 === stamp() && row.원본 === src && row.조건 === cond) return row.결과;
  } catch { /* 없다 */ }
  return null;
}

// stat은 재기 전에 구한 값이다. 쓰기가 막혀도 던지지 않고 false를 돌려준다(GA4 · 다시 GA5는 부르는 쪽이 알린다)
function remember(cacheFile, key, stat, src, cond, result) {
  try {
    let all = {};
    try { all = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { /* 처음 */ }
    all[key] = { ...stat, 도구: stamp(), 원본: src, 조건: cond, 잰때: new Date().toISOString(), 결과: result };
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(all, null, 2) + '\n');
    return true;
  } catch { return false; }
}

function runTool(dir, files, extra = []) {
  const args = [TOOL, dir, ...files.flatMap((f) => ['--영상', f]), ...extra, '--json'];
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true, timeout: 20 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  const line = String(r.stdout || '').trim().split(/\r?\n/).filter((l) => l.startsWith('{')).pop();
  if (!line) throw Error((r.stderr || '').trim().split(/\r?\n/).pop() || `끝 코드 ${r.status}`);
  return JSON.parse(line);
}

// 까닭을 물을 시각 — 심한 카드는 그 안의 심한 줄 시각만(이미 확인할 것인 줄이 심한 줄의 까닭을 무르지 않게, GPT 검수 다시 GA2), 아니면 모든 줄
const 물을때 = (hit) => [...new Set(hit.심함 && hit.심한초들 && hit.심한초들.length ? hit.심한초들 : [].concat(hit.초들 || [hit.초]))];

// 까닭 — 항목 통째(「새낱말」)이거나, 한 카드로 모은 줄의 물을 시각마다 「항목@초」 까닭이 다 있어야 한다(GPT 검수 GA7)
function reasonFor(prep, hit) {
  const table = prep.화면글판단 && typeof prep.화면글판단 === 'object' ? prep.화면글판단 : {};
  const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  const whole = text(table[hit.항목]);
  if (whole) return whole;
  const 때 = 물을때(hit);
  const 까닭 = 때.map((t) => text(table[`${hit.항목}@${t}`]));
  return 까닭.every(Boolean) ? [...new Set(까닭)].join(' · ') : '';
}

// 같은 때 같은 항목으로 걸린 줄(한 카드의 한국어 · 읽는 법 · 뜻)은 한 줄로 모은다 — 시간표가 1/10초 표본이라 한 표본 차이까지 같은 때로 본다
function 모으기(걸림) {
  const out = [];
  for (const h of 걸림) {
    const same = out.find((x) => x.항목 === h.항목 && x.항목 !== '새낱말' && Math.abs(x.초 - h.초) <= 0.11 && Math.abs(x.잰값 - h.잰값) < 0.05);
    if (same) { same.글들.push(h.글); same.초들.push(h.초); if (h.심함) same.심한초들.push(h.초); same.심함 = same.심함 || h.심함; } else out.push({ ...h, 글들: [h.글], 초들: [h.초], 심한초들: h.심함 ? [h.초] : [] });
  }
  return out;
}

function 줄글(h) {
  if (h.글들.length < 2) return h.설명;
  const 카드 = h.글들.map((g) => `「${g}」`).join(' · ');
  if (h.항목 === '머묾') return `${h.초.toFixed(1)}초에 뜬 카드 ${카드}가 ${h.잰값.toFixed(1)}초만 있다(새 글은 ${h.필요.toFixed(1)}초 넘게)`;
  if (h.항목 === '핵심') return `답 · 뜻풀이 ${카드}가 ${h.잰값.toFixed(1)}초만 있다(${h.필요}초 넘게)`;
  return `${h.설명}(같은 때 ${카드})`;
}

// bundle: 게시묶음 · videoFiles: 판이 쓰는 원본 영상 · run: 시험에서 바꿔 끼운다 · save: false면 기록을 쓰지 않는다
function screenTextFindings(bundle, videoFiles, opts = {}) {
  try { return screenTextFindingsInner(bundle, videoFiles, opts); } catch (error) {
    // 이 관문이 무엇으로 깨져도 올리기 전 검사의 뒤 검사는 돈다
    return [{ level: LOOK, code: 'screen-text-failed', where: '화면 글', message: `화면 글 관문이 멈췄다(${String(error && error.message).slice(0, 200)}) — node tools/화면글검사.js <편 폴더>로 직접 돌려 본다` }];
  }
}

function screenTextFindingsInner(bundle, videoFiles, { run = runTool, save = true } = {}) {
  const findings = [];
  const prep = bundle.prep || {};
  if (!applies(bundle)) return findings;
  const hardOk = prep.브랜드 === 'LAB' && (편날짜(bundle.name) || '') >= FIX_FROM;
  const cacheFile = path.join(bundle.dir, '게시', '화면글검사.json');
  const src = sourceStamp(bundle.dir);
  const cond = 조건지문(prep);
  const files = 최종본.targets(bundle, videoFiles);
  const results = new Map();
  const stats = new Map(files.map((f) => [f, statOf(f)]));
  const keyOf = (f) => 묶음.rel(bundle, f) || path.basename(f);
  const need = [];
  for (const file of files) {
    const hit = cached(cacheFile, keyOf(file), stats.get(file), src, cond);
    if (hit) results.set(file, hit); else need.push(file);
  }
  if (need.length) {
    let out = null;
    let 실패 = null;
    try { out = run(bundle.dir, need); } catch (error) { 실패 = String(error && error.message).slice(0, 200); }
    let 기록못씀 = false;
    const 뒤원본 = sourceStamp(bundle.dir); // 재는 사이 원본을 고쳤으면 그 결과는 기록에 남기지 않는다
    for (const r of (out && out.결과) || []) {
      const file = need.find((f) => (묶음.rel(bundle, f) || '') === r.영상 || path.resolve(bundle.repo, r.영상 || '') === path.resolve(f));
      if (!file) continue;
      // 재는 사이 영상이 바뀌었으면 그 결과는 지금 영상의 것이 아니다 — 쓰지도 남기지도 않는다(GPT 검수 GA3 · 다시 GA8)
      if (!같은영상(stats.get(file), statOf(file))) { results.set(file, { 못잼: '재는 사이 영상 파일이 바뀌었다 — 올리기 전 검사를 다시 돌린다' }); continue; }
      results.set(file, r);
      // 재는 사이 원본이 바뀌었으면(도구가 낸 원본 지문이 재기 전과 다름) 기록에 남기지 않는다(설계 검토 6)
      if ((out.원본지문 && out.원본지문 !== src) || 뒤원본 !== src) continue;
      if (save && (!r.못잼 || 남길못잼.test(r.못잼)) && !remember(cacheFile, keyOf(file), stats.get(file), src, cond, r)) 기록못씀 = true;
    }
    // 기록에서 읽은 영상도 그사이 바뀌었으면 그 결과를 쓰지 않는다(GPT 다시 검수 3회차 GA11)
    for (const file of files) if (results.has(file) && !need.includes(file) && !같은영상(stats.get(file), statOf(file))) results.set(file, { 못잼: '재는 사이 영상 파일이 바뀌었다 — 올리기 전 검사를 다시 돌린다' });
    if (기록못씀) findings.push({ level: LOOK, code: 'screen-text-cache', where: '화면 글', message: `잰 값을 ${path.relative(bundle.dir, cacheFile)}에 못 남겼다 — 올리기 전 검사를 돌릴 때마다 다시 잰다(한 편 1~2분). 그 파일의 쓰기 권한을 본다` });
    // 도구가 그 영상의 답을 안 냈으면(실패 · 빠짐) 조용히 넘기지 않는다
    for (const file of need) {
      if (results.has(file)) continue;
      findings.push({ level: LOOK, code: 'screen-text-failed', where: `화면 글 ${path.basename(path.dirname(file))}/${path.basename(file)}`, message: `화면 글 검사를 못 했다(${실패 || '도구가 이 영상의 결과를 내지 않았다'}) — node tools/화면글검사.js <편 폴더>로 직접 돌려 보거나, 글마다 머무는 시간을 1/10초 띠로 눈으로 본다` });
    }
  }
  for (const file of files) {
    const r = results.get(file);
    if (r) findings.push(...결과줄(r, prep, hardOk, `화면 글 ${path.basename(path.dirname(file))}/${path.basename(file)}`));
  }
  return findings;
}

// 영상 하나의 결과 → 걸림 줄. 올리기 전 검사 ㉓과 이해 시험 전 검사가 같은 등급을 쓴다
function 결과줄(r, prep, hardOk, where) {
  if (r.못잼) return [{ level: LOOK, code: 'screen-text-unmeasured', where, message: `화면 글 시간을 못 쟀다 — ${r.못잼}` }];
  return 모으기(r.걸림 || []).map((h) => {
    const why = reasonFor(prep, h);
    const hard = hardOk && h.심함 && HARD.has(h.항목) && !why;
    const 열쇠 = h.항목 === '새낱말' ? [`"새낱말": "까닭"`] : 물을때(h).map((t) => `"${h.항목}@${t}": "까닭"`);
    const tail = why ? ` · 「화면글판단」: ${why}` : ` — ${HOW[h.항목] || '눈으로 본다'}${hardOk && h.심함 && HARD.has(h.항목) ? `. 일부러 둔 자리면 준비.json 「화면글판단」 {${열쇠.join(', ')}}` : ''}`;
    return { level: hard ? FIX : LOOK, code: `screen-text-${h.항목}`, where, message: `${줄글(h)}${tail}` };
  });
}

// ── 이해 시험 전(11-23 유호님 「2번: 렌더 직후 먼저」) ──
// tools/낯선이시험.js가 질문을 만들기 전에 부른다. 렌더한 영상의 화면 글 시간을 먼저 고쳐, 이해 시험이 시간을 고친 판을 보게 한다.
// 이해 시험에 떨어진 편을 「가장 나은 판」으로 내는 규칙은 그대로다 — 그 판이 올리기 전 검사 ㉓에서 막히지 않게 앞에서 고친다.
// 누구에게: LAB 새 편(docs/마케팅/LAB_…_날짜 폴더, 날짜가 FIX_FROM부터) — 고칠 것이 생길 수 있는 편이다. 준비.json이 아직 없어도 폴더 이름으로 본다.
//   synkbrief · yuhobuilds는 확인할 것만 나와 올리기 전 검사 ㉓에 맡긴다(시험마다 1~3분 렌더를 더하지 않는다).
// 등급은 ㉓과 같다. 일부러 둔 자리는 준비.json 「화면글판단」(있으면 읽는다). 잰 값은 .tmp/화면글시험전/<편>.json에 둔다 — 편 폴더에 쓰지 않는다.
const REPO = path.resolve(__dirname, '..', '..');
const 시험전기록 = path.join(REPO, '.tmp', '화면글시험전');
const 빗금 = (p) => p.split(path.sep).join('/');

// 영상이 든 편 폴더 — 부모 이름이 「마케팅」인 가장 가까운 윗 폴더
function 편폴더(file) {
  let d = path.dirname(path.resolve(file));
  for (;;) {
    if (path.basename(path.dirname(d)) === '마케팅') return d;
    const up = path.dirname(d);
    if (up === d) return null;
    d = up;
  }
}

// → { 대상: false } 이거나 { 대상: true, 편, 줄: [{ level, code, where, message }] } — 던지지 않는다(못 잰 것은 확인할 것 한 줄)
function 시험전검사(file, { 언어 = null, run = runTool, 기록폴더 = 시험전기록, 알림 = () => {} } = {}) {
  const 편 = 편폴더(file);
  if (!편) return { 대상: false, 까닭: '편 폴더(docs/마케팅/<편>) 밖 영상이라 재지 않았다 — 올리기 전 검사 ㉓이 다시 본다' };
  const name = path.basename(편);
  if (!/^LAB_/.test(name) || (편날짜(name) || '') < FIX_FROM) return { 대상: false };
  const where = `화면 글 ${path.basename(path.dirname(file))}/${path.basename(file)}`;
  try {
    let prep = {};
    try { prep = JSON.parse(fs.readFileSync(path.join(편, '게시', '준비.json'), 'utf8').replace(/^﻿/, '')); } catch { /* 게시 묶음 전 */ }
    const stat = statOf(file);
    if (!stat) return { 대상: true, 편, 줄: [{ level: LOOK, code: 'screen-text-failed', where, message: '영상 파일을 못 읽었다' }] };
    const src = sourceStamp(편);
    const cond = crypto.createHash('sha1').update(JSON.stringify(['시험전', 언어 || ''])).digest('hex').slice(0, 12);
    const cacheFile = path.join(기록폴더, `${name}.json`);
    const key = 빗금(path.relative(REPO, path.resolve(file)));
    let r = cached(cacheFile, key, stat, src, cond);
    if (!r) {
      알림();
      const out = run(편,[path.resolve(file)], 언어 ? ['--언어', 언어] : []);
      r = ((out && out.결과) || []).find((x) => x.영상 === key || path.resolve(REPO, x.영상 || '') === path.resolve(file)) || null;
      if (!r) return { 대상: true, 편, 줄: [{ level: LOOK, code: 'screen-text-failed', where, message: '화면 글 검사가 이 영상의 결과를 내지 않았다 — node tools/화면글검사.js <편 폴더> --영상 <영상>으로 직접 돌려 본다' }] };
      if (!같은영상(stat, statOf(file))) return { 대상: true, 편, 줄: [{ level: LOOK, code: 'screen-text-unmeasured', where, message: '재는 사이 영상 파일이 바뀌었다 — 이해 시험을 다시 돌린다' }] };
      const 원본같음 = (!out.원본지문 || out.원본지문 === src) && sourceStamp(편) === src;
      if (원본같음 && (!r.못잼 || 남길못잼.test(r.못잼))) remember(cacheFile, key, stat, src, cond, r);
    }
    return { 대상: true, 편, 줄: 결과줄(r, prep, true, where) };
  } catch (error) {
    return { 대상: true, 편, 줄: [{ level: LOOK, code: 'screen-text-failed', where, message: `화면 글 검사가 멈췄다(${String(error && error.message).slice(0, 200)}) — 올리기 전 검사 ㉓이 다시 본다` }] };
  }
}

module.exports = { screenTextFindings, applies, reasonFor, 모으기, 결과줄, 편폴더, 시험전검사, FROM, FIX_FROM, BRANDS, HARD, 남길못잼 };
