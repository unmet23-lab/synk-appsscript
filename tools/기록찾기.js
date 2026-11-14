#!/usr/bin/env node
'use strict';
/**
 * 기록 찾기 — 앞선 결정, 남은 일, 관문, 함정, 메모를 낱말로 한 번에 찾는다(2026-11-14).
 *
 * 왜: 결정 표(약 1MB), 트랙(약 0.5MB), 두 보관, 관문 표는 통째로 읽히지 않아서 찾아서 읽는다. 그런데 한 줄이 1~4KB라
 *   `rg`로 찾으면 「드라마」 한 낱말에 145KB가 나왔다. 도구가 한 번에 보여 주는 양은 약 3만 자라 뒤쪽 줄이 말없이 잘렸다.
 *   잘린 줄에 앞선 결정이 있었으면 그 세션의 작업은 통째로 헛일이 된다(11-14 유호님 「작업중에 하나라도 빠지면 아예 시간낭비」).
 *   그래서 찾은 줄을 한 줄씩으로 줄여 모두 보이고, 다 못 보일 때는 몇 줄이 더 있는지를 꼭 말한다.
 *   메모 목록도 함께 본다. 하네스는 메모 목록의 앞 200줄과 25KB까지만 싣고 넘는 뒤쪽은 말없이 버린다.
 *
 *   node tools/기록찾기.js <낱말> [낱말…]        낱말이 모두 든 줄을 찾는다(영문 대소문자는 가리지 않는다)
 *   node tools/기록찾기.js --또는 <낱말…>        낱말 가운데 하나라도 든 줄
 *   node tools/기록찾기.js --곳 결정,트랙 <낱말…>  찾을 곳을 고른다(결정 · 트랙 · 관문 · 현장 · 메모, 기본은 전부)
 *   node tools/기록찾기.js --줄 docs/_ops/결정.md:123 [더…]   그 줄을 통째로 본다
 *   node tools/기록찾기.js --메모점검            메모 목록이 한도 안인지, 목록과 파일이 맞는지, 메모가 가리키는 저장소 파일이 있는지
 *   공통: --모두(출력 한도 없이 다 보인다) · --json
 *
 * 종료 코드: 찾기는 늘 0. --메모점검은 메모 목록이 잘리거나 목록과 파일이 어긋나면 1.
 * 시험: node --test tests/기록찾기.test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { 인자게이트 } = require('./lib/인자게이트.js');
const { 칸나누기 } = require('./lib/표.js');
const { 공용작업본 } = require('./lib/공용작업본.js');

const 뿌리 = path.resolve(process.env.SYNK_기록뿌리 || path.join(__dirname, '..'));
/** Claude 메모 폴더 — 하네스는 워크트리 세션에도 공용 작업본의 메모를 싣는다. 폴더 이름은 그 경로의 글자·숫자 밖을 `-`로 바꾼 것이다. */
const 메모폴더 = () => process.env.SYNK_MEMORY_DIR
  || path.join(os.homedir(), '.claude', 'projects', 공용작업본(뿌리).replace(/[^A-Za-z0-9]/g, '-'), 'memory');

const 줄폭 = 150;          // 찾은 줄 하나에 보이는 글자
const 출력한도 = 24000;     // 도구 출력이 잘리는 선(약 3만 자)보다 아래
// 하네스가 세션에 싣는 메모 목록의 한도(공식 문서: 앞 200줄 또는 25KB, 먼저 닿는 쪽). 넘는 뒤쪽은 말없이 버려진다.
// 25KB가 바이트인지 글자인지는 문서에 없다. 11-14에 28,212바이트(15,008자) 목록이 끝까지 실린 것을 확인했으니 글자로 잰다.
const 메모한도 = { 줄: 200, 글자: 25000 };
const 메모알림 = { 줄: 180, 글자: 22000 };
const 곳이름 = ['결정', '트랙', '관문', '현장', '메모'];

const 읽기 = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const 상대 = (p) => path.relative(뿌리, p).split(path.sep).join('/');
const 줄임 = (s, n = 줄폭) => { const t = String(s).replace(/\s+/g, ' ').trim(); const g = [...t]; return g.length > n ? `${g.slice(0, n - 1).join('')}…` : t; };

function 파일들() {
  const ops = path.join(뿌리, 'docs', '_ops');
  const 보관 = path.join(ops, '보관');
  const 달 = (머리) => { try { return fs.readdirSync(보관).filter((f) => f.startsWith(`${머리}_`) && f.endsWith('.md')).sort().reverse().map((f) => path.join(보관, f)); } catch { return []; } };
  const 현장폴더 = path.join(뿌리, 'docs', '현장노트');
  let 현장 = [];
  try { 현장 = fs.readdirSync(현장폴더).filter((f) => f.endsWith('.md')).sort().map((f) => path.join(현장폴더, f)); } catch { 현장 = []; }
  const 있는 = (목록) => 목록.filter((p) => fs.existsSync(p));
  return { 결정: 있는([path.join(ops, '결정.md'), ...달('결정')]), 트랙: 있는([path.join(ops, '트랙.md'), ...달('트랙')]), 관문: 있는([path.join(ops, '관문_자동화.md')]), 현장 };
}

/** 낱말들로 줄을 고르는 판정. */
function 판정만들기(낱말들, 또는) {
  const 낱 = 낱말들.map((w) => w.toLowerCase());
  return (글) => { const t = 글.toLowerCase(); return 또는 ? 낱.some((w) => t.includes(w)) : 낱.every((w) => t.includes(w)); };
}

/** 한 곳에서 찾은 줄들 — { 파일, 줄, 요약 }. 결정 표는 날짜 · 성격 · 결정 칸을, 현장 노트는 그 줄이 든 항목의 제목을 보인다. */
function 한곳찾기(곳, 길들, 맞나) {
  const 찾음 = [];
  for (const p of 길들) {
    const 줄들 = 읽기(p).split('\n');
    const 파일 = 상대(p);
    if (곳 === '현장') {
      let 제목 = null;   // 가장 가까운 ### 또는 ## 머리
      const 모음 = new Map();
      줄들.forEach((l, i) => {
        if (/^#{2,3} /.test(l)) 제목 = { 줄: i + 1, 글: l };
        if (!l.trim() || !맞나(l)) return;
        const 자리 = 제목 || { 줄: i + 1, 글: l };
        const 칸 = 모음.get(자리.줄) || { 파일, 줄: 자리.줄, 요약: 자리.글, 수: 0 };
        칸.수 += 1; 모음.set(자리.줄, 칸);
      });
      for (const 칸 of 모음.values()) 찾음.push({ 파일: 칸.파일, 줄: 칸.줄, 요약: 칸.수 > 1 ? `${칸.요약} (${칸.수}줄)` : 칸.요약 });
      continue;
    }
    줄들.forEach((l, i) => {
      if (!l.trim() || /^\|[-:| ]+\|$/.test(l.trim()) || !맞나(l)) return;
      let 요약 = l;
      if (곳 === '결정' && /^\|\s*20\d\d-\d\d-\d\d\s*\|/.test(l)) { const 칸 = 칸나누기(l); 요약 = `${칸[0]} ${칸[1]} ${칸[2] || ''}`; }
      else if (곳 === '관문' && l.startsWith('|')) 요약 = 칸나누기(l).slice(0, 2).join(' — ');
      찾음.push({ 파일, 줄: i + 1, 요약 });
    });
  }
  return 찾음;
}

const 길머리 = '(?:tools|docs|tests|experiences|desktop|packages|\\.claude)\\/';
const 자리표시 = /[<>*…{}$]/;
/**
 * 메모가 가리키는 이 저장소의 길 — 백틱 안에서 tools/ · docs/ 같은 머리로 시작하는 것만 본다.
 * 빼는 것: 꺾쇠 · 별표 · 말줄임이 든 자리 표시, 바로 뒤에 「없다」고 적은 길(없어진 것을 알고 적은 기록).
 * 다른 저장소의 길은 `SYNK-talk/tools/…`처럼 저장소 이름을 앞에 붙여 적으면 보지 않는다.
 */
function 저장소길들(글) {
  const 길 = new Set();
  for (const m of 글.matchAll(/`([^`\n]+)`/g)) {
    if (/없다|지웠다/.test(글.slice(m.index + m[0].length, m.index + m[0].length + 24))) continue;
    const 안 = m[1].trim();
    // 띄어쓰기가 든 파일 이름(「컴퓨터를 잃어버렸을 때.md」)은 백틱 안 전체가 길이다.
    if (new RegExp(`^${길머리}`).test(안) && !자리표시.test(안) && /\.[A-Za-z0-9]{1,5}$/.test(안) && / /.test(안)) { 길.add(안); continue; }
    for (const k of 안.matchAll(new RegExp(`(?:^|\\s)(${길머리}[^\\s'"<>*…{}$,)(·]+)(.?)`, 'g'))) {
      if (자리표시.test(k[2])) continue;   // `docs/마케팅/LAB_*`처럼 뒤가 자리 표시로 이어지는 머리
      const p = k[1].replace(/#.*$/, '').replace(/:\d+(?:[-~]\d+)?$/, '').replace(/[.:;]+$/, '');
      if (p) 길.add(p);
    }
  }
  return [...길];
}

/** 메모 목록과 메모 파일의 상태. 메모 폴더가 없는 곳(CI, 다른 PC, GPT 세션)에서는 { 있음: false }. */
function 메모점검() {
  const 폴더 = 메모폴더();
  const 목록길 = path.join(폴더, 'MEMORY.md');
  if (!fs.existsSync(목록길)) return { 있음: false, 폴더, 문제: [], 알림: [] };
  const 글 = 읽기(목록길);
  const 줄수 = 글.replace(/\n+$/, '').split('\n').length;
  const 항목 = [...글.matchAll(/^- \[(.+?)\]\(([^)\s]+\.md)\)(.*)$/gm)].map((m) => ({ 제목: m[1], 파일: m[2], 뒤: m[3] }));
  const 있는파일 = fs.readdirSync(폴더).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md');
  const 목록에없음 = 있는파일.filter((f) => !항목.some((x) => x.파일 === f));
  const 파일없음 = 항목.filter((x) => !있는파일.includes(x.파일)).map((x) => x.파일);
  const 공용 = 공용작업본(뿌리);
  const 없는길 = [];
  const 본문 = new Map();
  for (const f of 있는파일) {
    const t = 읽기(path.join(폴더, f));
    본문.set(f, t);
    for (const 길 of 저장소길들(t)) if (!fs.existsSync(path.join(뿌리, 길)) && !fs.existsSync(path.join(공용, 길))) 없는길.push({ 메모: f, 길 });
  }
  const 문제 = [], 알림 = [];
  if (줄수 > 메모한도.줄) 문제.push(`메모 목록이 ${줄수}줄이다. 하네스는 앞 ${메모한도.줄}줄만 싣는다 — 뒤 ${줄수 - 메모한도.줄}줄의 메모는 세션에 보이지 않는다`);
  else if (줄수 >= 메모알림.줄) 알림.push(`메모 목록이 ${줄수}줄이다(한도 ${메모한도.줄}줄). 겹치는 메모를 합치거나 빈 줄을 줄인다`);
  if (글.length > 메모한도.글자) 문제.push(`메모 목록이 ${글.length.toLocaleString('en-US')}자다. 하네스는 앞 25KB만 싣는다 — 뒤쪽 메모는 세션에 보이지 않는다`);
  else if (글.length >= 메모알림.글자) 알림.push(`메모 목록이 ${글.length.toLocaleString('en-US')}자다(한도 ${메모한도.글자.toLocaleString('en-US')}자)`);
  if (파일없음.length) 문제.push(`목록이 가리키는 메모 파일이 없다: ${파일없음.join(', ')}`);
  if (목록에없음.length) 문제.push(`목록에 없는 메모 파일이 있다(세션이 이 메모를 모른다): ${목록에없음.join(', ')}`);
  if (없는길.length) 알림.push(`메모가 가리키는 저장소 파일 ${없는길.length}개가 없다: ${없는길.slice(0, 8).map((x) => `${x.메모} → ${x.길}`).join(' · ')}${없는길.length > 8 ? ' …' : ''}`);
  return { 있음: true, 폴더, 줄: 줄수, 글자: 글.length, 바이트: Buffer.byteLength(글), 항목, 파일수: 있는파일.length, 목록에없음, 파일없음, 없는길, 본문, 문제, 알림 };
}

function 메모찾기(점검, 맞나) {
  if (!점검.있음) return [];
  const 찾음 = [];
  for (const x of 점검.항목) {
    const 글 = `${x.제목} ${x.뒤}\n${점검.본문.get(x.파일) || ''}`;
    if (맞나(글)) 찾음.push({ 파일: x.파일, 줄: null, 요약: `${x.제목}${x.뒤}` });
  }
  for (const f of 점검.목록에없음) if (맞나(점검.본문.get(f) || '')) 찾음.push({ 파일: f, 줄: null, 요약: '(목록에 없는 메모 파일)' });
  return 찾음;
}

/** 낱말로 찾는다 — { 곳: { 찾음: [...] } }. */
function 찾기(낱말들, { 또는 = false, 곳 = 곳이름 } = {}) {
  const 맞나 = 판정만들기(낱말들, 또는);
  const 길 = 파일들();
  const 점검 = 메모점검();
  const 결과 = {};
  for (const 이름 of 곳이름) {
    if (!곳.includes(이름)) continue;
    결과[이름] = 이름 === '메모' ? 메모찾기(점검, 맞나) : 한곳찾기(이름, 길[이름], 맞나);
  }
  return { 결과, 점검 };
}

/** 곳마다 보일 줄 수 — 한도 안에서 적게 나온 곳부터 다 보이고, 남는 몫을 많이 나온 곳에 준다. */
function 몫나누기(수들, 한도) {
  const 몫 = 수들.map(() => 0);
  let 남음 = 한도;
  let 열린 = 수들.map((n, i) => i).filter((i) => 수들[i] > 0);
  while (열린.length && 남음 > 0) {
    const 한몫 = Math.max(1, Math.floor(남음 / 열린.length));
    const 다음 = [];
    for (const i of 열린) {
      const 줌 = Math.min(한몫, 수들[i] - 몫[i], 남음);
      몫[i] += 줌; 남음 -= 줌;
      if (몫[i] < 수들[i]) 다음.push(i);
    }
    if (다음.length === 열린.length && 한몫 === 0) break;
    열린 = 다음;
  }
  return 몫;
}

const 곳제목 = { 결정: '결정 표와 보관', 트랙: '트랙과 보관', 관문: '관문 · 자동화 한 장', 현장: '현장 노트', 메모: 'Claude 메모' };

function 화면(낱말들, { 결과, 점검 }, { 또는 = false, 모두 = false } = {}) {
  const 이름들 = Object.keys(결과);
  const 수들 = 이름들.map((n) => 결과[n].length);
  const 전체 = 수들.reduce((a, b) => a + b, 0);
  const 몫 = 모두 ? 수들 : 몫나누기(수들, Math.floor(출력한도 / (줄폭 + 12)));
  const 줄 = [`「${낱말들.join(또는 ? '」 또는 「' : '」 「')}」 — ${이름들.map((n, i) => `${n} ${수들[i]}`).join(' · ')}`];
  let 못보임 = 0;
  이름들.forEach((이름, i) => {
    if (!수들[i]) return;
    줄.push('', `■ ${곳제목[이름]} ${수들[i]}줄${이름 === '메모' ? ` — ${점검.폴더}` : ''}`);
    let 앞파일 = null;
    for (const x of 결과[이름].slice(0, 몫[i])) {
      if (이름 === '메모') { 줄.push(`  ${x.파일}  ${줄임(x.요약, 줄폭 - x.파일.length)}`); continue; }
      if (x.파일 !== 앞파일) { 줄.push(x.파일); 앞파일 = x.파일; }
      줄.push(`${String(x.줄).padStart(6)}  ${줄임(x.요약)}`);
    }
    if (몫[i] < 수들[i]) { 줄.push(`        … ${수들[i] - 몫[i]}줄 더 있다`); 못보임 += 수들[i] - 몫[i]; }
  });
  줄.push('');
  if (!전체) 줄.push('찾은 줄이 없다. 낱말을 줄이거나 다른 말(기능, 편, 도구 이름)로 다시 찾는다.');
  else 줄.push('줄 전체 보기: node tools/기록찾기.js --줄 <파일>:<줄번호> [더…]');
  if (못보임) 줄.push(`다 보이지 못한 줄이 ${못보임}줄 있다. 낱말을 더해 좁히거나 --곳으로 고른다. 그대로 다 보려면 --모두.`);
  for (const 글 of 점검.문제) 줄.push(`⚠ ${글} (node tools/기록찾기.js --메모점검)`);
  return 줄.join('\n');
}

function 줄보기(자리들) {
  const 줄 = [];
  for (const 자리 of 자리들) {
    const m = /^(.+):(\d+)$/.exec(자리);
    if (!m) { 줄.push(`✗ ${자리} — <파일>:<줄번호> 꼴로 적는다`); continue; }
    const p = path.resolve(뿌리, m[1]);
    if (path.relative(뿌리, p).startsWith('..') || !fs.existsSync(p)) { 줄.push(`✗ ${m[1]} — 이 저장소에 없는 파일이다`); continue; }
    const 글 = 읽기(p).split('\n')[Number(m[2]) - 1];
    줄.push(`── ${m[1]}:${m[2]}`, 글 == null ? '(그 줄이 없다)' : 글, '');
  }
  return 줄.join('\n');
}

function 메모점검화면(점검) {
  if (!점검.있음) return `메모 폴더가 없다 — ${점검.폴더}\n(Claude 메모가 없는 곳에서는 볼 것이 없다.)`;
  const 줄 = [
    `메모 목록 — ${점검.폴더}`,
    `  줄 ${점검.줄} / ${메모한도.줄} · 글자 ${점검.글자.toLocaleString('en-US')} / ${메모한도.글자.toLocaleString('en-US')} · 바이트 ${점검.바이트.toLocaleString('en-US')}`,
    `  목록의 메모 ${점검.항목.length}개 · 메모 파일 ${점검.파일수}개`,
  ];
  for (const 글 of 점검.문제) 줄.push(`✗ ${글}`);
  for (const 글 of 점검.알림) 줄.push(`· ${글}`);
  if (!점검.문제.length && !점검.알림.length) 줄.push('  걸린 것이 없다. 목록이 끝까지 실리고, 목록과 파일이 맞고, 메모가 가리키는 저장소 파일이 모두 있다.');
  return 줄.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const 오류 = 인자게이트('기록찾기', args, ['--또는', '--곳', '--줄', '--메모점검', '--모두', '--json']);
  if (오류) { console.error(오류); process.exit(2); }
  const json = args.includes('--json');
  if (args.includes('--메모점검')) {
    const 점검 = 메모점검();
    if (json) { const { 본문, ...나머지 } = 점검; console.log(JSON.stringify(나머지, null, 2)); } else console.log(메모점검화면(점검));
    process.exit(점검.문제.length ? 1 : 0);
  }
  if (args.includes('--줄')) { console.log(줄보기(args.filter((a) => !a.startsWith('--')))); return; }
  let 곳 = 곳이름;
  const i = args.indexOf('--곳');
  let 곳값 = null;
  if (i >= 0) {
    곳값 = args[i + 1];
    곳 = String(곳값 || '').split(',').map((s) => s.trim()).filter(Boolean);
    const 모름 = 곳.filter((n) => !곳이름.includes(n));
    if (!곳.length || 모름.length) { console.error(`--곳에는 ${곳이름.join(' · ')} 가운데에서 쉼표로 적는다${모름.length ? ` (모르는 이름: ${모름.join(', ')})` : ''}`); process.exit(2); }
  }
  const 낱말들 = args.filter((a, k) => !a.startsWith('--') && !(i >= 0 && k === i + 1));
  if (!낱말들.length) { console.error('찾을 낱말을 적는다 — node tools/기록찾기.js <낱말> [낱말…]'); process.exit(2); }
  const 옵션 = { 또는: args.includes('--또는'), 곳, 모두: args.includes('--모두') };
  const 찾은 = 찾기(낱말들, 옵션);
  if (json) { const { 본문, ...점검 } = 찾은.점검; console.log(JSON.stringify({ 낱말: 낱말들, 결과: 찾은.결과, 메모목록: { 문제: 점검.문제, 알림: 점검.알림 } }, null, 2)); return; }
  console.log(화면(낱말들, 찾은, 옵션));
}

if (require.main === module) main();
module.exports = { 찾기, 화면, 메모점검, 메모점검화면, 줄보기, 몫나누기, 저장소길들, 메모한도, 출력한도 };
