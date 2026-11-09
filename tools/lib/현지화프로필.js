'use strict';
/* 현지화 프로필 읽기(2026-11-10 LAB 하루 두 편 · 39계정 — 설계 6 · 10, docs/마케팅/LAB_하루두편_설계_20261110/README.md).
 *
 * docs/마케팅/현지화/의 세 파일을 읽는다. 읽기만 한다.
 *   언어프로필.json — 21개 언어(계정 원장 language 코드): 글꼴 · 문자 · 줄바꿈 · 문장부호 · 결합 문자 · 낱말 경계 · 읽기 속도
 *   나라프로필.json — 25개 나라(countryCode): 금기(국기 · 지도 · 손짓 · 음식 · 종교 · 동물 · 정치)와 그림 지시문이 피할 소품 · 장면
 *   관용구대응표.json — 퀴즈 관용구 → 언어마다 비슷한 현지 관용구(같은 그림 · 같은 뜻이면 오답 딱지 경고)
 * 쓰는 곳: tools/글자검사.js(렌더 전 규칙) · tools/현지어대조.js(「이 나라에서 불편한 표현 · 그림」 칸) · tools/뜻검사.js · 그림 지시문.
 * 금기는 언어가 아니라 나라 단위다. 원본 그림은 모든 나라에 나가니 원본금기문장()이 공통 + 모든 LAB 나라를 합친다.
 */
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const 폴더 = process.env.SYNK_LOCALIZATION_DIR || path.join(REPO, 'docs', '마케팅', '현지화');
const 원장경로 = path.join(REPO, 'docs', '마케팅', 'sns-계정.json');
const 갈래들 = ['국기', '지도', '손짓', '음식', '종교', '동물', '정치', '숫자색', '그밖'];
const 확실값 = new Set(['확실', '어림']);

const cache = {};
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
function load(name) {
  const file = path.join(폴더, name);
  if (!cache[file]) cache[file] = readJson(file);
  return cache[file];
}
const 언어파일 = () => load('언어프로필.json');
const 나라파일 = () => load('나라프로필.json');
const 관용구파일 = () => load('관용구대응표.json');
function 비우기() { for (const k of Object.keys(cache)) delete cache[k]; }

const 맞춤 = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/[\s()·_-]/g, '');

/** 코드 · 한국어 이름 · 다른 이름(태국어 · Thai · zhs …)으로 언어 프로필을 찾는다. 없으면 null. */
function 언어(이름) {
  if (!이름) return null;
  const 언어들 = 언어파일().언어;
  if (언어들[이름]) return { 코드: 이름, ...언어들[이름] };
  const want = 맞춤(이름);
  for (const [code, p] of Object.entries(언어들)) {
    if (맞춤(code) === want || 맞춤(p.이름) === want || (p.다른이름 || []).some((n) => 맞춤(n) === want)) return { 코드: code, ...p };
  }
  return null;
}
function 나라(cc) {
  if (!cc) return null;
  const p = 나라파일().나라[String(cc).toUpperCase()];
  return p ? { 코드: String(cc).toUpperCase(), ...p } : null;
}
const 언어목록 = () => Object.keys(언어파일().언어);
const 나라목록 = () => Object.keys(나라파일().나라);

/** 「%WINDIR%/Fonts/x.ttc#1」 · 저장소 상대 경로 → { 파일(절대), 번호 } */
function 경로풀기(값) {
  const [p, idx] = String(값).split('#');
  const windir = process.env.WINDIR || process.env.SystemRoot || 'C:/Windows';
  const 풀린 = p.replace(/%WINDIR%/gi, windir.replace(/\\/g, '/'));
  return { 파일: path.isAbsolute(풀린) || /^[A-Za-z]:\//.test(풀린) ? 풀린 : path.join(REPO, 풀린), 번호: idx ? Number(idx) : 0 };
}

/** 글꼴 이름 · 굵기 → 파일. 그 굵기가 없으면 가장 가까운 굵기(같으면 굵은 쪽). 등록 안 된 이름이면 null. */
function 글꼴파일(이름, 굵기 = 400) {
  const g = 언어파일().글꼴[String(이름).replace(/^['"]|['"]$/g, '').trim()];
  if (!g) return null;
  const 굵기들 = Object.keys(g.파일).map(Number).sort((a, b) => a - b);
  const w = Number(굵기) || 400;
  const 고른 = 굵기들.reduce((best, x) => (Math.abs(x - w) < Math.abs(best - w) || (Math.abs(x - w) === Math.abs(best - w) && x > best) ? x : best), 굵기들[0]);
  return { 이름: String(이름).replace(/^['"]|['"]$/g, '').trim(), ...경로풀기(g.파일[String(고른)]), 굵기: 고른 };
}

const 일반글꼴 = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'emoji', 'math']);
/** CSS 글꼴 줄 → 이름 목록(따옴표 · 일반 이름 뺌). var(--x, a, b)는 기본값 쪽을 읽는다. */
function 글꼴줄이름(줄) {
  let s = String(줄 || '').trim();
  const v = s.match(/^var\(\s*--[\w-]+\s*,\s*([\s\S]*)\)$/);
  if (v) s = v[1];
  return s.split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')).filter((x) => x && !일반글꼴.has(x.toLowerCase()));
}
/** CSS 글꼴 줄 → 글꼴파일 목록(등록된 것만) + 등록 안 된 이름 */
function 글꼴줄파일(줄, 굵기 = 400) {
  const 파일 = [];
  const 모름 = [];
  for (const n of 글꼴줄이름(줄)) {
    const f = 글꼴파일(n, 굵기);
    if (f) 파일.push(f); else 모름.push(n);
  }
  return { 파일, 모름 };
}

function 원장(경로 = 원장경로) {
  return readJson(경로);
}

/** 계정 키 → 언어 · 나라 프로필과 판본 키(rotationVersion → countryCode). lab-youtube(@synkkorean)처럼 판본 키가 나라 코드가 아니면
 *  그 언어의 나라 전부를 시청자 나라로 본다(원장 countryCode MN은 채널 등록 나라라서). */
function 계정(키, { 원장: led = null } = {}) {
  const a = (led || 원장()).accounts?.[키];
  if (!a) return null;
  const 언어프로필 = 언어(a.language);
  const 판본키 = a.rotationVersion || a.countryCode || null;
  let 나라들 = a.countryCode ? [a.countryCode] : [];
  let 나라설명 = null;
  if (a.rotationVersion && !나라(a.rotationVersion) && 언어프로필) {
    나라들 = [...언어프로필.나라];
    나라설명 = `판본 키 ${a.rotationVersion}는 나라 코드가 아니다 — ${언어프로필.이름} 나라 전부(${나라들.join(' · ')})를 시청자로 본다`;
  }
  return {
    키, 플랫폼: a.platform, 언어코드: a.language || null, 판본키, 나라코드: 나라들,
    언어: 언어프로필, 나라: 나라들.map(나라).filter(Boolean), 나라설명,
  };
}

/** LAB 계정의 나라 전부(원장 기준, 없으면 프로필의 25개) */
function LAB나라(led = null) {
  try {
    const out = new Set();
    for (const [키, a] of Object.entries((led || 원장()).accounts || {})) {
      if (a.brand !== 'LAB') continue;
      for (const cc of 계정(키, { 원장: led || 원장() })?.나라코드 || []) out.add(cc);
    }
    if (out.size) return [...out];
  } catch { /* 원장이 없으면 프로필 전부 */ }
  return 나라목록();
}

/** 나라들의 금기(공통 한 번 + 나라마다). 같은 내용은 나라를 모아 한 줄로. */
function 금기(나라들, { 공통 = true } = {}) {
  const f = 나라파일();
  const 모음 = new Map();
  const 넣기 = (cc, x) => {
    const k = `${x.갈래}|${x.내용}`;
    if (!모음.has(k)) 모음.set(k, { ...x, 나라: [] });
    if (cc) 모음.get(k).나라.push(cc);
  };
  if (공통) for (const x of f.공통.금기) 넣기(null, x);
  for (const cc of [].concat(나라들 || [])) {
    const p = 나라(cc);
    if (!p) continue;
    for (const x of p.금기 || []) 넣기(p.코드, x);
  }
  return [...모음.values()];
}

/** 나라들의 피할 소품 · 장면(공통 포함, 겹친 것 하나로) */
function 피할것(나라들, { 공통 = true } = {}) {
  const f = 나라파일();
  const 소품 = new Map();
  const 장면 = new Map();
  const 넣기 = (map, x, cc) => {
    const k = x.en || x.ko;
    if (!map.has(k)) map.set(k, { ...x, 나라: [] });
    if (cc) map.get(k).나라.push(cc);
  };
  if (공통) {
    for (const x of f.공통.피할소품) 넣기(소품, x, null);
    for (const x of f.공통.피할장면) 넣기(장면, x, null);
  }
  for (const cc of [].concat(나라들 || [])) {
    const p = 나라(cc);
    if (!p) continue;
    for (const x of p.피할소품 || []) 넣기(소품, x, p.코드);
    for (const x of p.피할장면 || []) 넣기(장면, x, p.코드);
  }
  return { 소품: [...소품.values()], 장면: [...장면.values()] };
}

/** 그림 지시문 끝에 붙일 금기 문장. 말 'en'이면 영어(그림 모델용), 'ko'면 한국어(검수 질문용). */
function 금기문장(나라들, { 말 = 'en', 공통 = true } = {}) {
  const { 소품, 장면 } = 피할것(나라들, { 공통 });
  const 이름 = [].concat(나라들 || []).map((cc) => 나라(cc)?.이름).filter(Boolean);
  if (말 === 'ko') {
    const 줄 = [`이 그림은 ${이름.length ? 이름.join(' · ') : '모든 LAB 나라'} 계정에 나간다. 다음을 그리지 않는다:`];
    if (소품.length) 줄.push(`- 소품: ${소품.map((x) => x.ko).join(', ')}`);
    if (장면.length) 줄.push(`- 장면: ${장면.map((x) => x.ko).join(', ')}`);
    return 줄.join('\n');
  }
  const parts = [];
  if (소품.length) parts.push(`Do not include: ${소품.map((x) => x.en).join(', ')}.`);
  if (장면.length) parts.push(`Do not depict: ${장면.map((x) => x.en).join(', ')}.`);
  return parts.join(' ');
}

/** 원본(모든 LAB 나라에 나가는 그림)의 금기 문장 */
function 원본금기문장({ 말 = 'en', 원장: led = null } = {}) {
  return 금기문장(LAB나라(led), { 말 });
}

/** 현지어대조 · 뜻검사 질문에 넣는 「이 나라에서 피할 것」 줄 — 금기 내용과 근거를 짧게 */
function 금기요약(나라들, { 공통 = true, 최대 = 40 } = {}) {
  return 금기(나라들, { 공통 }).slice(0, 최대)
    .map((x) => `- [${x.갈래}${x.나라.length ? ' · ' + x.나라.join('/') : ' · 공통'}] ${x.내용}`).join('\n');
}

/** 관용구 → 그 언어의 대응. { 확인: 있음 | 없음 | 모름, … } */
function 관용구대응(관용구, 언어코드) {
  const 키 = 맞춤(관용구);
  const 항 = 관용구파일().관용구.find((x) => 맞춤(x.관용구) === 키);
  if (!항) return { 확인: '모름', 까닭: '대응표에 없는 관용구' };
  if (!(언어코드 in (항.언어 || {}))) return { 확인: '모름', 관용구: 항.관용구, 설명: 항.모름설명?.[언어코드] || null };
  const v = 항.언어[언어코드];
  if (v === null) return { 확인: '없음', 관용구: 항.관용구, 설명: 항.없음설명?.[언어코드] || null };
  return { 확인: '있음', 한국어: 항.관용구, ...v };
}

/** 퀴즈 오답 딱지 경고 — 그 언어에 같은(비슷한) 그림의 굳은 말이 있으면.
 *  그림 같음 + 뜻 같음 → 딱지가 그 나라 말로 정답이 된다(고칠 것). 그림 비슷 + 뜻 같음 → 딱지가 정답처럼 읽힐 수 있다(확인할 것).
 *  그림 같음 · 비슷 + 뜻 다름 → 그 나라 사람에게는 다른 뜻으로 읽히는 함정(확인할 것). */
function 오답딱지경고(관용구, 언어코드) {
  const d = 관용구대응(관용구, 언어코드);
  if (d.확인 !== '있음' || !['같음', '비슷'].includes(d.같은그림)) return null;
  const 이름 = 언어(언어코드)?.이름 || 언어코드;
  if (d.같은뜻 === '같음' && d.같은그림 === '같음') {
    return { 수준: '고칠 것', 말: `「${관용구}」의 글자 그대로 오답 딱지가 ${이름}로는 정답이 된다 — 그 말에 「${d.관용구}」(${d.뜻})가 있다(${d.확실}). 딱지를 다른 엉뚱한 그림으로 바꾸거나 게시글에서 「너희 말에도 있지?」로 살린다`, 대응: d };
  }
  if (d.같은뜻 === '같음') {
    return { 수준: '확인할 것', 말: `「${관용구}」와 그림이 비슷한 ${이름} 굳은 말 「${d.관용구}」(${d.뜻})가 같은 뜻이다 — 오답 딱지가 정답처럼 읽히지 않는지 본다(${d.확실})`, 대응: d };
  }
  return { 수준: '확인할 것', 말: `「${관용구}」와 그림이 ${d.같은그림 === '같음' ? '같은' : '비슷한'} ${이름} 굳은 말 「${d.관용구}」의 뜻이 다르다(${d.뜻}) — 함정 보기로 쓰거나, 오답 딱지가 그 뜻으로 읽히지 않는지 본다(${d.확실})`, 대응: d };
}

/** 세 파일의 꼴 검사 — 시험이 부른다. 문제 목록(빈 배열이면 통과). */
function 검증({ 원장: led = null } = {}) {
  const 문제 = [];
  const L = 언어파일();
  const N = 나라파일();
  const I = 관용구파일();
  for (const [name, g] of Object.entries(L.글꼴 || {})) {
    if (!g.파일 || !Object.keys(g.파일).length) 문제.push(`글꼴 ${name}: 파일 칸이 비었다`);
  }
  for (const [code, p] of Object.entries(L.언어 || {})) {
    for (const k of ['이름', '나라', '문자', '글꼴', '글꼴줄', '낱말경계', '결합문자', '줄머리금지', '문장부호', '읽기속도', '글자폭', '줄최대글자', '글자인식']) {
      if (p[k] === undefined) 문제.push(`언어 ${code}: ${k} 칸이 없다`);
    }
    if (!['띄어쓰기', 'Intl.Segmenter', '글자'].includes(p.낱말경계)) 문제.push(`언어 ${code}: 낱말경계 ${p.낱말경계}`);
    if (!L.글꼴[p.글꼴]) 문제.push(`언어 ${code}: 글꼴 ${p.글꼴}가 글꼴 표에 없다`);
    for (const n of 글꼴줄이름(p.글꼴줄)) if (!L.글꼴[n]) 문제.push(`언어 ${code}: 글꼴줄의 ${n}가 글꼴 표에 없다`);
    if (!(p.읽기속도?.초당글자 > 0)) 문제.push(`언어 ${code}: 읽기속도.초당글자`);
    for (const cc of p.나라 || []) if (!N.나라[cc]) 문제.push(`언어 ${code}: 나라 ${cc}가 나라 프로필에 없다`);
    for (const r of p.문장부호?.틀린꼴 || []) {
      try { new RegExp(r.찾기, 'u'); } catch (e) { 문제.push(`언어 ${code}: 틀린꼴 정규식 ${r.찾기} — ${e.message}`); }
      if (!['고칠 것', '확인할 것'].includes(r.수준)) 문제.push(`언어 ${code}: 틀린꼴 수준 ${r.수준}`);
    }
    if (p.결합문자?.있음 && !(p.결합문자.범위 || []).length) 문제.push(`언어 ${code}: 결합문자 범위가 없다`);
  }
  const 금기검사 = (곳, list) => {
    for (const x of list || []) {
      if (!갈래들.includes(x.갈래)) 문제.push(`${곳}: 갈래 ${x.갈래}`);
      if (!x.내용 || !x.근거) 문제.push(`${곳}: 내용 · 근거가 비었다`);
      if (!확실값.has(x.확실)) 문제.push(`${곳}: 확실 ${x.확실}`);
    }
  };
  금기검사('공통', N.공통?.금기);
  for (const [cc, p] of Object.entries(N.나라 || {})) {
    for (const k of ['이름', '언어', '금기', '모름', '피할소품', '피할장면']) if (p[k] === undefined) 문제.push(`나라 ${cc}: ${k} 칸이 없다`);
    for (const code of p.언어 || []) if (!L.언어[code]) 문제.push(`나라 ${cc}: 언어 ${code}가 언어 프로필에 없다`);
    금기검사(`나라 ${cc}`, p.금기);
    for (const x of [...(p.피할소품 || []), ...(p.피할장면 || [])]) if (!x.ko || !x.en) 문제.push(`나라 ${cc}: 피할 것에 ko · en이 다 있어야 한다`);
  }
  for (const 항 of I.관용구 || []) {
    if (!항.관용구 || !항.뜻) 문제.push(`관용구: 관용구 · 뜻이 비었다`);
    for (const [code, v] of Object.entries(항.언어 || {})) {
      if (!L.언어[code]) 문제.push(`관용구 ${항.관용구}: 언어 ${code}가 언어 프로필에 없다`);
      if (v === null) continue;
      for (const k of ['관용구', '뜻', '같은그림', '같은뜻', '출처', '확실']) if (v[k] === undefined) 문제.push(`관용구 ${항.관용구} · ${code}: ${k} 칸이 없다`);
      if (!['같음', '비슷', '다름'].includes(v.같은그림) || !['같음', '비슷', '다름'].includes(v.같은뜻)) 문제.push(`관용구 ${항.관용구} · ${code}: 같은그림 · 같은뜻 값`);
      if (!['우리검수', '어림'].includes(v.확실)) 문제.push(`관용구 ${항.관용구} · ${code}: 확실 ${v.확실}`);
    }
  }
  // 원장과 맞나 — LAB 계정의 언어 · 나라가 프로필에 다 있어야 한다
  let ledger = led;
  if (!ledger) { try { ledger = 원장(); } catch { ledger = null; } }
  if (ledger) {
    for (const [키, a] of Object.entries(ledger.accounts || {})) {
      if (a.brand !== 'LAB') continue;
      if (a.language && !L.언어[a.language]) 문제.push(`원장 ${키}: 언어 ${a.language}가 언어 프로필에 없다`);
      if (a.countryCode && !N.나라[a.countryCode]) 문제.push(`원장 ${키}: 나라 ${a.countryCode}가 나라 프로필에 없다`);
    }
  }
  return 문제;
}

/* 명령줄 — 그림 지시문에 붙일 금기 문장 · 꼴 검사
 *   node tools/lib/현지화프로필.js 금기문장 원본 [--말 ko]      ← 원본 그림(모든 LAB 나라)
 *   node tools/lib/현지화프로필.js 금기문장 MY ID [--말 ko]     ← 나라별 카드 · 썸네일
 *   node tools/lib/현지화프로필.js 계정 lab-th-youtube           ← 계정의 언어 · 나라 · 판본 키
 *   node tools/lib/현지화프로필.js 검증                           ← 세 파일 꼴 + 원장 대조(문제 있으면 종료 1) */
if (require.main === module) {
  const argv = process.argv.slice(2);
  const 말 = argv.includes('--말') ? argv[argv.indexOf('--말') + 1] : 'en';
  const 위치 = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--말');
  if (위치[0] === '금기문장') {
    console.log(위치[1] === '원본' ? 원본금기문장({ 말 }) : 금기문장(위치.slice(1), { 말 }));
  } else if (위치[0] === '계정' && 위치[1]) {
    const a = 계정(위치[1]);
    console.log(a ? JSON.stringify({ 키: a.키, 플랫폼: a.플랫폼, 언어: a.언어코드, 나라: a.나라코드, 판본키: a.판본키, 나라설명: a.나라설명 }, null, 2) : `원장에 없는 계정: ${위치[1]}`);
    if (!a) process.exitCode = 1;
  } else if (위치[0] === '검증') {
    const 문제 = 검증();
    console.log(문제.length ? 문제.map((x) => `✗ ${x}`).join('\n') : `통과 — 언어 ${언어목록().length} · 나라 ${나라목록().length} · 관용구 ${관용구파일().관용구.length}`);
    if (문제.length) process.exitCode = 1;
  } else {
    console.error('쓰는 법: node tools/lib/현지화프로필.js 금기문장 원본|<나라…> [--말 ko] | 계정 <계정 키> | 검증');
    process.exitCode = 2;
  }
}

module.exports = {
  폴더, 언어, 나라, 언어목록, 나라목록, 언어파일, 나라파일, 관용구파일, 비우기,
  글꼴파일, 글꼴줄이름, 글꼴줄파일, 경로풀기, 계정, 원장, LAB나라,
  금기, 피할것, 금기문장, 원본금기문장, 금기요약, 관용구대응, 오답딱지경고, 검증, 갈래들,
};
