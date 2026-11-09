#!/usr/bin/env node
'use strict';
/* 그림 검사 — 그림을 굽자마자(영상에 얹기 전에) 제작 실수 다섯 가지와 나라 금기 소품을 장마다 한 번 본다(2026-11-10, LAB 하루 두 편 설계 15).
 *
 * 왜: 그림 왜곡이 영상을 다 만든 뒤 맹검에서야 잡혔다 — 공중에 뜬 그릇 탑, 펠트 장면 속 실사 생수병, 봉투 옆에 2초 넘게 떠 있는 은행잎,
 * 손 없이 볼에 붙은 붕어빵, 기둥 위에 뜬 마스코트, 손 없이 움직이는 연필, 뭉개진 진동벨(설계 검토 보낸설계 4절). 굽자마자 보면 다시 굽기만 하면 된다.
 *
 *   node tools/그림검사.js <그림>[::<그 그림 의도>] … --의도 "<장면 의도 한 줄>" [--나라 <코드,…>] [--금기 "<문장>"]… [--마스코트 몽글|없음]
 *        [--종류 그림|합성] [--눈 gpt|haiku] [--밖 <폴더>] [--이름 <작업 이름>] [--편 <편 폴더>] [--준비만]
 *   node tools/그림검사.js --받기 <작업 폴더> [--편 <편 폴더>]      haiku 하위 에이전트 답(답_haiku.json)을 받는다
 *
 *   다섯: ① 떠 있는 물건 ② 손 없는 움직임 ③ 실사 섞임(펠트 장면 속 실사 물건) ④ 그림 속 글자 ⑤ 마스코트 정본과 다른 곳 — 그리고 나라 금기 소품.
 *   · 장면 의도를 늘 붙인다: 관용구를 글자 그대로 그린 엉뚱함(「발이 넓다」를 발이 커다란 그림)은 일부러다 — 검사기가 실수로 적지 않게.
 *   · 몽글 정본 시트(tools/lib/마스코트자산.js 정면 · 3/4 둘을 흰 바탕 한 장)를 늘 첫 그림으로 붙인다 — 생김새 기준일 뿐 검사 대상이 아니다.
 *   · 나라 금기: --나라 코드면 C 묶음 나라 프로필(tools/lib/현지화프로필.js 「나라금기(코드)」 또는 docs/마케팅/현지화/나라프로필.json의
 *     그 나라 「금기」)을 읽고, 아직 없거나 더할 것은 --금기 "<문장>"으로 준다.
 *   · 눈: gpt(기본) — 도구가 GPT 그림 입력(구독 Codex · tools/codex계정.js, 돈 안 나감)을 그림마다 한 번 부른다.
 *         haiku — 하위 에이전트 재료(질문.md + 그림 경로)만 만든다(하위 에이전트는 세션만 띄운다). 세션이 Agent(model: haiku)에게
 *         질문.md를 주고 답을 답_haiku.json에 쓰게 한 뒤 --받기.
 *   · --종류 합성: tools/합성미리보기.js가 만든 첫 · 가운데 · 끝 프레임 시트 — 프레임 사이 움직임을 무엇이 일으키는지(손 · 몸)까지 본다.
 *   결과: <밖>/그림검사.json(그림마다 판정 「통과」 · 「다시 굽기」 · 「답 없음」, 걸린 칸 · 어디) — --편이면 그 편 게시/그림검사.json에도(저장소 상대 경로만).
 *   끝 코드: 0 모두 통과 · 1 다시 굽기 있음 · 2 답 없음 있음 · 4 재료만(haiku — 세션 차례).
 */
const fs = require('node:fs');
const path = require('node:path');
const { 공용작업본 } = require('./lib/공용작업본.js');
const { 마지막JSON } = require('./lib/그록호출.js');
const 그림눈 = require('./lib/그림눈.js');

const 뿌리 = path.resolve(__dirname, '..');
const 다섯 = [
  ['떠있음', '떠 있는 물건', '받침 없이 공중에 뜬 물건 · 인물(의도에 「난다 · 뜬다」가 없으면). 닿는 자리 · 그림자로 본다 — 탑처럼 쌓인 그릇 사이가 떠 있는 것, 기둥 위에 뜬 마스코트'],
  ['손없는움직임', '손 없는 움직임', '쓰이거나 움직이는 중인 물건인데 그것을 쥔 손 · 몸이 없다 — 혼자 글씨를 쓰는 연필, 손 없이 볼에 붙은 음식, 혼자 열리는 봉투'],
  ['실사섞임', '실사 섞임', '장면 바탕 재질(대개 니들펠트 양모)과 다른 재질이 섞인 물건 — 펠트 장면 속 실사 사진 같은 플라스틱 생수병 · 음식 · 매끈한 금속 · 유리. 장면 전체가 실사 · 종이 · 그림이면 섞임이 아니다'],
  ['글자', '그림 속 글자', '그림 안의 글자 · 숫자 · 기호(간판 · 책 표지 · 라벨 · 화면 포함) — 화면 글은 나중에 따로 얹으니 그림 속에는 없어야 한다. 뭉개진 가짜 글자도'],
  ['정본다름', '마스코트 정본과 다른 곳', '몽글(코랄색 펠트 · 검은 구슬 눈 둘 · 물결 밑단 · 크림색 바느질 선)이 정본 시트와 다른 곳 — 색 · 털결 · 눈 수 · 크기 비율 · 입 · 팔다리가 생김. 몽글이 없으면 false'],
];
const 판정들 = ['통과', '다시 굽기', '답 없음'];
const 맨글 = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const 자르기 = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function 인자(argv) {
  const o = { 그림: [], 의도: '', 나라: [], 금기: [], 마스코트: '몽글', 종류: '그림', 눈: 'gpt', 밖: null, 이름: null, 편: null, 준비만: false, 받기: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--의도') o.의도 = 맨글(argv[++i]);
    else if (a === '--나라') o.나라.push(...String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean));
    else if (a === '--금기') { const v = 맨글(argv[++i]); if (v) o.금기.push(v); }
    else if (a === '--마스코트') { o.마스코트 = String(argv[++i] || ''); if (!['몽글', '없음'].includes(o.마스코트)) throw new Error('--마스코트는 몽글 · 없음'); }
    else if (a === '--종류') { o.종류 = String(argv[++i] || ''); if (!['그림', '합성'].includes(o.종류)) throw new Error('--종류는 그림 · 합성'); }
    else if (a === '--눈') { o.눈 = String(argv[++i] || '').toLowerCase(); if (!['gpt', 'haiku'].includes(o.눈)) throw new Error('--눈은 gpt · haiku'); }
    else if (a === '--밖') o.밖 = argv[++i] || null;
    else if (a === '--이름') o.이름 = argv[++i] || null;
    else if (a === '--편') o.편 = argv[++i] || null;
    else if (a === '--준비만') o.준비만 = true;
    else if (a === '--받기') o.받기 = argv[++i] || null;
    else if (a.startsWith('--')) throw new Error(`모르는 인자: ${a}`);
    else { const [파일, ...의도] = a.split('::'); o.그림.push({ 파일, 의도: 맨글(의도.join('::')) }); }
  }
  if (o.받기) return o;
  if (!o.그림.length) throw new Error('그림이 없다 — node tools/그림검사.js <그림>[::<그 그림 의도>] … --의도 "<장면 의도 한 줄>"');
  if (!o.의도 && o.그림.some((g) => !g.의도)) throw new Error('--의도 "<장면 의도 한 줄>"이 없다 — 글자 그대로 그린 엉뚱함을 실수로 읽지 않게 장면 의도를 늘 준다(설계 15)');
  return o;
}

/**
 * 나라 금기 — C 묶음 나라 프로필에서 읽는다(없으면 빈 목록). 그림에 보이는 것만 묻는다: 프로필 모듈의 피할것(나라들) — 공통 + 나라마다
 * 「피할 소품 · 장면」(그림 지시문이 피하는 것과 같은 목록)이 먼저이고, 그 꼴이 없으면 나라(코드).금기 · 나라프로필.json의 그 나라 「금기」.
 */
function 나라금기(코드들, { 모듈 = null, 파일 = path.join(뿌리, 'docs', '마케팅', '현지화', '나라프로필.json') } = {}) {
  if (!코드들.length) return [];
  let m = 모듈;
  if (!m) { try { m = require('./lib/현지화프로필.js'); } catch { m = {}; } }
  if (typeof m.피할것 === 'function') {
    try {
      const { 소품 = [], 장면 = [] } = m.피할것(코드들) || {};
      const 줄 = (갈래) => (x) => `${x.나라?.length ? x.나라.join('/') : '공통'}: ${갈래} — ${x.ko || x.en || ''}`;
      const 나온 = [...소품.map(줄('소품')), ...장면.map(줄('장면'))].filter((t) => !/— $/.test(t));
      if (나온.length) return [...new Set(나온)];
    } catch { /* 아래 꼴로 */ }
  }
  const 한줄 = (x) => (typeof x === 'string' ? x : x && typeof x === 'object'
    ? (x.내용 ? `${x.갈래 ? `[${x.갈래}] ` : ''}${x.내용}` : [x.무엇 || x.소품 || x.항목 || x.이름, x.까닭 || x.왜].filter(Boolean).join(' — ')) : '');
  const 낱항목 = (v) => v && typeof v === 'object' && (v.내용 || v.무엇 || v.소품 || v.항목 || v.이름);
  const 펴기 = (v) => (Array.isArray(v) ? v.flatMap(펴기) : v && typeof v === 'object' && !낱항목(v) ? Object.values(v).flatMap(펴기) : [한줄(v)]).filter(Boolean);
  const 나온 = [];
  for (const 코드 of 코드들) {
    let 금기 = null;
    try {
      if (typeof m.나라금기 === 'function') 금기 = m.나라금기(코드);
      else if (typeof m.나라 === 'function') 금기 = m.나라(코드)?.금기;
    } catch { /* 모듈 꼴이 다르다 */ }
    if (금기 == null) {
      try {
        const j = JSON.parse(fs.readFileSync(파일, 'utf8'));
        const 나라 = j?.[코드] || j?.나라?.[코드] || (Array.isArray(j?.나라) ? j.나라.find((x) => x?.코드 === 코드) : null) || (Array.isArray(j) ? j.find((x) => x?.코드 === 코드) : null);
        금기 = 나라?.금기 ?? null;
      } catch { /* 프로필 파일이 아직 없다 */ }
    }
    for (const t of 펴기(금기 || [])) 나온.push(`${코드}: ${t}`);
  }
  return [...new Set(나온)];
}

/** 그림 한 장(또는 haiku 묶음)에 줄 질문. */
function 질문(o, { 그림의도 = '', 금기 = [], 여럿 = null } = {}) {
  const 의도 = [o.의도, 그림의도].filter(Boolean).join(' / ');
  return [
    '너는 펠트(니들펠트 양모) 그림의 제작 실수를 잡는 검수자다. 미학 품평이 아니라 아래 다섯 가지 실수와 나라 금기만 본다.',
    '',
    o.마스코트 === '몽글' ? '첫 그림은 몽글 정본 시트(정면 · 오른쪽 3/4 · 왼쪽 3/4)다 — 생김새 기준일 뿐 검사하지 않는다. 그다음 그림이 검사할 그림이다.' : '붙인 그림이 검사할 그림이다.',
    ...(o.종류 === '합성' ? ['검사할 그림은 같은 장면의 첫 · 가운데 · 끝 프레임을 나란히 붙인 시트다(칸 왼쪽 위 「A1 6.30s」는 칸 이름). 프레임 사이에 물건이 움직이면 그것을 움직이게 하는 손 · 몸 · 바람이 보이는지로 2번을, 프레임마다 받침 없이 같은 자리에 떠 있으면 1번을 본다. 이 시트는 화면 글(자막 · 제목 · 이름표 · 스티커 · 손글씨 효과)을 일부러 얹은 합성이다 — 4번은 그림 바탕 안에 구워진 뜻 없는 글자 · 뭉개진 글자만 본다.'] : []),
    '',
    `장면 의도: ${의도 || '(없음)'}`,
    '의도에 적힌 엉뚱함(관용구를 글자 그대로 그린 개그 — 예: 「발이 넓다」를 발이 커다란 그림, 「간이 크다」를 간이 커다란 그림)은 일부러다. 그것을 실수로 적지 말고, 의도와 상관없이 생긴 물리 · 재질 · 생김새 실수만 적는다.',
    '',
    '다섯 가지(걸리면 true, 어디는 그림의 어느 자리 · 무엇인지 한 줄):',
    ...다섯.map(([, 이름, 설명], i) => `${i + 1}. ${이름} — ${설명}`),
    `6. 나라 금기 — ${금기.length ? `아래 목록의 것이 그림에 보이면 true: ${금기.join(' · ')}` : '이번에는 목록이 없다(false로 둔다)'}`,
    '',
    '걸림은 확실할 때만 true — 애매하면 false로 두고 어디에 그 까닭을 적는다. 의도한 엉뚱함으로 본 것은 「의도한엉뚱함」에 적는다.',
    '',
    여럿
      ? `그림이 여럿이다. 답은 JSON 한 덩이만, 그림마다 한 칸: {"그림들":[${한칸('01')}]}`
      : `답은 JSON 한 덩이만, 앞뒤 설명 없이: ${한칸('01')}`,
  ].join('\n');
}
function 한칸(번호) {
  return `{"그림":"${번호}","몽글있음":false,"다섯":{${다섯.map(([k]) => `"${k}":{"걸림":false,"어디":""}`).join(',')}},"금기":{"걸림":false,"어디":"","까닭":""},"의도한엉뚱함":"","한줄":""}`;
}

/** 답 한 칸 → 판정. 다섯 · 금기 가운데 걸림이 하나라도 있으면 다시 굽기. */
function 판정하기(답, 번호) {
  if (!답 || typeof 답 !== 'object' || !답.다섯 || typeof 답.다섯 !== 'object') return { 번호, 판정: '답 없음', 걸림: [] };
  const 걸림 = [];
  const 다섯칸 = {};
  for (const [k, 이름] of 다섯) {
    const x = 답.다섯[k] || {};
    const 걸 = x.걸림 === true || x.걸림 === 'true';
    다섯칸[k] = { 걸림: 걸, 어디: 자르기(맨글(x.어디), 160) };
    if (걸) 걸림.push(`${이름}: ${다섯칸[k].어디 || '(자리 안 적음)'}`);
  }
  const 금기 = { 걸림: 답.금기?.걸림 === true || 답.금기?.걸림 === 'true', 어디: 자르기(맨글(답.금기?.어디), 160), 까닭: 자르기(맨글(답.금기?.까닭), 160) };
  if (금기.걸림) 걸림.push(`나라 금기: ${금기.어디 || ''}${금기.까닭 ? ` — ${금기.까닭}` : ''}`);
  return { 번호, 판정: 걸림.length ? '다시 굽기' : '통과', 걸림, 몽글있음: 답.몽글있음 === true, 다섯: 다섯칸, 금기, 의도한엉뚱함: 자르기(맨글(답.의도한엉뚱함), 160), 한줄: 자르기(맨글(답.한줄), 200) };
}

function 저장소경로(p) {
  const 절대 = path.resolve(String(p || ''));
  for (const 바탕 of [뿌리, 공용작업본(뿌리)]) {
    const r = path.relative(바탕, 절대);
    if (r && !r.startsWith('..') && !path.isAbsolute(r)) return r.split(path.sep).join('/');
  }
  return path.basename(절대);
}

const 끝코드 = (그림들) => (그림들.some((g) => g.판정 === '답 없음') ? 2 : 그림들.some((g) => g.판정 === '다시 굽기') ? 1 : 0);

function 결과쓰기(밖, o, 그림들, { 눈, 금기, 편 }) {
  const 기록 = { 판: 1, 만든때: new Date().toISOString(), 눈, 종류: o.종류, 의도: o.의도, 마스코트: o.마스코트, 금기,
    그림: 그림들.map((g) => ({ ...g, 파일: 저장소경로(g.파일) })),
    다시굽기: 그림들.filter((g) => g.판정 === '다시 굽기').length, 답없음: 그림들.filter((g) => g.판정 === '답 없음').length };
  fs.writeFileSync(path.join(밖, '그림검사.json'), `${JSON.stringify({ ...기록, 그림: 그림들 }, null, 1)}\n`);
  if (편) { const 게시 = path.join(path.resolve(편), '게시'); fs.mkdirSync(게시, { recursive: true }); fs.writeFileSync(path.join(게시, '그림검사.json'), `${JSON.stringify(기록, null, 1)}\n`); }
  for (const g of 그림들) console.log(`  ${g.번호} ${g.판정}${g.걸림?.length ? ` — ${g.걸림.join(' · ')}` : ''}  ${path.basename(g.파일)}`);
  const 셈 = 판정들.map((p) => `${p} ${그림들.filter((g) => g.판정 === p).length}`).join(' · ');
  console.log(`그림 검사(${눈}): ${셈} → ${path.join(밖, '그림검사.json')}`);
  return 끝코드(그림들);
}

async function main(argv, 손 = {}) {
  const o = 인자(argv);
  if (o.받기) return 받기(o);
  const 이름 = o.이름 || `검사-${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
  const 밖 = path.resolve(o.밖 || path.join(공용작업본(뿌리), '.tmp', '그림검사', 이름));
  fs.mkdirSync(밖, { recursive: true });
  const 금기 = [...new Set([...(손.나라금기 || 나라금기)(o.나라), ...o.금기])];
  if (o.나라.length && !금기.some((t) => o.나라.some((c) => t.startsWith(`${c}:`)))) console.log(`  (나라 프로필에서 ${o.나라.join(', ')} 금기를 못 찾았다 — C 묶음 프로필이 생기기 전에는 --금기 "<문장>"으로 준다)`);
  const 정본 = o.마스코트 === '몽글' ? (손.정본시트 || 그림눈.정본시트)(path.join(밖, '정본시트.jpg')) : null;
  const 그림들 = o.그림.map((g, i) => {
    const 파일 = path.resolve(g.파일); if (!fs.existsSync(파일)) throw new Error(`그림이 없다: ${g.파일}`);
    return { 번호: String(i + 1).padStart(2, '0'), 파일, 의도: g.의도 };
  });
  fs.writeFileSync(path.join(밖, '그림목록.json'), `${JSON.stringify({ 의도: o.의도, 마스코트: o.마스코트, 종류: o.종류, 금기, 정본, 편: o.편 ? path.resolve(o.편) : null, 그림: 그림들 }, null, 1)}\n`);
  console.log(`그림 검사 ${이름}: ${그림들.length}장 · 눈 ${o.눈} · 정본 시트 ${정본 ? '붙임' : '없음'} · 나라 금기 ${금기.length}줄 → ${밖}`);
  if (o.눈 === 'haiku') {
    const 답파일 = path.join(밖, '답_haiku.json');
    const 글 = [
      질문(o, { 금기, 여럿: true }),
      '',
      '그림 파일(Read 도구로 순서대로 연다):',
      ...(정본 ? [`0. 정본 시트(검사하지 않음): ${정본}`] : []),
      ...그림들.map((g) => `${g.번호}. ${g.파일}${g.의도 ? ` — 이 그림의 의도: ${g.의도}` : ''}`),
      '',
      `답 JSON을 Write 도구로 ${답파일}에 그대로 저장하고, 마지막 메시지에도 같은 JSON을 쓴다. 다른 파일은 읽거나 고치지 않는다.`,
    ].join('\n');
    fs.writeFileSync(path.join(밖, '질문.md'), `${글}\n`);
    console.log(`재료만 만들었다(세션 차례) — Agent(model: haiku)에게 ${path.join(밖, '질문.md')}를 그대로 주고 답을 ${답파일}에 쓰게 한 뒤:\n  node tools/그림검사.js --받기 ${밖}${o.편 ? ` --편 ${o.편}` : ''}`);
    return 4;
  }
  if (o.준비만) { fs.writeFileSync(path.join(밖, '질문_보기.md'), `${질문(o, { 그림의도: 그림들[0]?.의도, 금기 })}\n`); return 0; }
  const 묻기 = 손.GPT묻기 || 그림눈.GPT묻기;
  const 결과 = [];
  for (const g of 그림들) {
    const r = await 묻기({ 그림들: [...(정본 ? [정본] : []), g.파일], 글: 질문(o, { 그림의도: g.의도, 금기 }), 답파일: path.join(밖, `답_gpt_${g.번호}.md`) });
    const 답 = r.결과 === '받음' ? 마지막JSON(r.답) : null;
    const 판 = 판정하기(답, g.번호);
    결과.push({ ...판, 파일: g.파일, ...(r.결과 === '막힘' ? { 막힘: { 꼴: r.꼴, 첫줄: r.첫줄 } } : {}) });
    if (r.결과 === '막힘' && r.꼴 === '계정 없음') { for (const h of 그림들.slice(그림들.indexOf(g) + 1)) 결과.push({ 번호: h.번호, 파일: h.파일, 판정: '답 없음', 걸림: [], 막힘: { 꼴: r.꼴, 첫줄: r.첫줄 } }); console.error(`  GPT 굽기 계정이 모두 막혔다(${r.첫줄}) — 남은 그림은 --눈 haiku로`); break; }
  }
  return 결과쓰기(밖, o, 결과, { 눈: 'gpt', 금기, 편: o.편 });
}

/** haiku 답(답_haiku.json)을 받는다. */
function 받기(o) {
  const 밖 = path.resolve(o.받기);
  const 목록 = JSON.parse(fs.readFileSync(path.join(밖, '그림목록.json'), 'utf8'));
  let 답 = null; try { 답 = 마지막JSON(fs.readFileSync(path.join(밖, '답_haiku.json'), 'utf8')); } catch { /* 없다 */ }
  const 칸들 = Array.isArray(답?.그림들) ? 답.그림들 : Array.isArray(답) ? 답 : [];
  const 그림들 = 목록.그림.map((g) => ({ ...판정하기(칸들.find((x) => String(x?.그림 ?? '').padStart(2, '0') === g.번호), g.번호), 파일: g.파일 }));
  return 결과쓰기(밖, { 종류: 목록.종류, 의도: 목록.의도, 마스코트: 목록.마스코트 }, 그림들, { 눈: 'haiku', 금기: 목록.금기 || [], 편: o.편 || 목록.편 });
}

if (require.main === module) { main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { console.error(e.message); process.exitCode = 2; }); }

module.exports = { 인자, 나라금기, 질문, 한칸, 판정하기, 끝코드, 다섯, main, 받기 };
