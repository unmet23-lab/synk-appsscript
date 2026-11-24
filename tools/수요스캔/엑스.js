#!/usr/bin/env node
'use strict';
/* X 실시간 반응 — 브랜드마다 최근 N시간(기본 72) 안 X(옛 트위터)에서 반응이 큰 글을 그록에게 찾게 해 수요 스캔의 X 칸으로 둔다(2026-11-07).
 *
 * 유호님 11-07 「그록만이 잘하는 장점을 살려보자」. 수요 스캔은 유튜브 · 틱톡 · 인스타 릴스를 읽지만 X는 로그인 벽이라 비어 있었고,
 * 그록은 X를 실시간으로 검색한다. 통로는 tools/lib/그록호출.js(구독 로그인 · 빈 폴더 · 파일 · 셸 도구 막음 · 웹 검색만 엶).
 *
 *   node tools/수요스캔/엑스.js [전부 | lab-en lab-mn synkbrief yuhobuilds pulse …] [--시간 72] [--개수 8] [--사이 72] [--날짜 YYYY-MM-DD] [--출력 <폴더>] [--프롬프트만]
 *
 * 그록이 지어낸 글을 걸러 내는 문: 글 주소는 x.com/…/status/<번호> 꼴만 받고, 번호에 박힌 올린 시각(X 글 번호의 앞 비트)이
 * 창 밖이면 버린다(그록이 적은 날짜보다 번호를 믿는다). 숫자는 0 이상 정수나 null만. 남은 글도 「그록 보고 · 주소 안 열어 봄」으로 싣는다.
 * 주소는 작성자 아이디가 빠진 x.com/i/status/<번호>로 바꿔 적는다(공개 저장소 규칙 — 남의 이름 · 아이디를 남기지 않는다).
 * 결과: <공용 작업본>/.tmp/수요스캔/<날짜>/엑스.md · 엑스.json(git 밖), 같은 폴더 기록.jsonl에 브랜드마다 한 줄(걸린 시간 · 비용 · 받은 · 버린 수).
 * 읽기만 한다(로그인 · 좋아요 · 게시 없음). 한 브랜드가 막혀도(한도 · 로그인) 「못 잼」으로 적고 다음 브랜드로 간다.
 *
 * 지켜볼 계정 · 우리 계정 반응(2026-11-24 유호님 「응, 바꿔」): 그록봇의 「X 경쟁 계정 주간 감시」와 「SYNK PULSE X 반응 모으기」는
 * 결과가 봇 컴퓨터에만 남아 읽는 곳이 없었다. 그 두 일을 이 회차로 옮겨 19:30 수요 스캔이 읽게 한다.
 * 설정의 「엑스.지켜볼계정」이 있으면 그 계정들의 새 작업과 튄 글을 「계정글」로, 「엑스.우리계정」이 있으면 그 계정을 부른 글과
 * 답글을 「우리반응」(갈래 · 일 문의 먼저)으로 받는다. pulse는 수요 스캔(스캔.js) 브랜드가 아니라 설정을 엑스_pulse.json에 따로 둔다.
 * 우리반응은 처음 본 글 번호를 <공용 작업본>/.tmp/수요스캔/엑스_우리반응.json에 남겨, 다음 회차부터 「새」가 아닌 것으로 적는다.
 *
 * 사흘에 한 번(2026-11-25 유호님 「그록은 x 오케이 니 말대로 사흘에 하나만 수집」): --사이 <시간>을 주면 브랜드마다 마지막으로
 * 실제로 부른 회차가 (사이 − 6)시간 안이면 그록을 부르지 않고 그 회차 결과를 오늘 파일에 「이어씀」으로 싣는다. 창이 72시간이라
 * 사흘마다 부르면 빈 날 없이 이어진다. 6시간은 매일 19:30 회차의 시작 시각이 밀리는 몫이다. 이어 쓴 우리반응은 「새」를 떼어
 * 같은 일 문의를 두 번 알리지 않는다. 설정의 「엑스.전부에서뺌」이 있는 브랜드는 「전부」에 넣지 않는다(lab-mn — 11-22~24 내리 0건).
 */
const fs = require('node:fs');
const path = require('node:path');
const { 공용작업본 } = require('../lib/공용작업본.js');
const 그록 = require('../lib/그록호출.js');

const 여기 = __dirname;
const 브랜드들 = ['lab-en', 'lab-mn', 'synkbrief', 'yuhobuilds', 'pulse'];
const 설정파일 = 브랜드 => path.join(여기, '설정', 브랜드 === 'pulse' ? '엑스_pulse.json' : `수요_${브랜드}.json`);
const 아이디꼴 = /^[A-Za-z0-9_]{1,15}$/;
const 반응갈래 = ['일 문의', '질문', '칭찬', '비판', '협업 제안', '광고나 스팸'];
const X시작ms = 1288834974657; // X(트위터) 글 번호(snowflake) 시각의 기준점
const 서울날짜 = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const 밀림시간 = 6;

/** 「전부」에 넣는 브랜드 — 설정의 엑스.전부에서뺌이 있으면 뺀다. */
function 전부브랜드(파일 = 설정파일) {
  return 브랜드들.filter(b => {
    try { return !JSON.parse(fs.readFileSync(파일(b), 'utf8'))?.엑스?.전부에서뺌; } catch { return true; }
  });
}

function 인자(argv) {
  const o = { 브랜드: [], 시간: 72, 개수: 8, 사이: null, 날짜: null, 출력: null, 프롬프트만: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const 수 = () => { const v = Number(argv[++i]); if (!Number.isFinite(v) || v <= 0) throw new Error(`${a} 뒤에 0보다 큰 수`); return v; };
    if (a === '--시간') o.시간 = 수();
    else if (a === '--개수') o.개수 = Math.min(20, Math.round(수()));
    else if (a === '--사이') o.사이 = 수();
    else if (a === '--날짜') o.날짜 = argv[++i];
    else if (a === '--출력') o.출력 = argv[++i];
    else if (a === '--프롬프트만') o.프롬프트만 = true;
    else if (a === '전부') o.브랜드.push(...전부브랜드());
    else if (브랜드들.includes(a)) o.브랜드.push(a);
    else throw new Error(`모르는 인자: ${a}`);
  }
  if (!o.브랜드.length) o.브랜드 = 전부브랜드();
  o.브랜드 = [...new Set(o.브랜드)];
  return o;
}

function 설정(브랜드, 파일 = 설정파일(브랜드)) {
  const j = JSON.parse(fs.readFileSync(파일, 'utf8'));
  const 어 = Array.isArray(j?.검색?.어) ? j.검색.어.filter(s => typeof s === 'string' && s.trim()) : [];
  const 엑 = j?.엑스 && typeof j.엑스 === 'object' ? j.엑스 : {};
  const 아이디 = v => String(v || '').trim().replace(/^@/, '');
  const 계정 = (Array.isArray(엑.지켜볼계정) ? 엑.지켜볼계정 : [])
    .map(a => (typeof a === 'string' ? { 아이디: a } : a))
    .map(a => ({ 아이디: 아이디(a?.아이디), 소개: 한줄(a?.소개, 80) }))
    .filter(a => 아이디꼴.test(a.아이디));
  const 우리 = 아이디꼴.test(아이디(엑.우리계정)) ? 아이디(엑.우리계정) : null;
  return { 이름: typeof j.이름 === 'string' ? j.이름 : 브랜드, 근거: typeof j.근거 === 'string' ? j.근거 : '', 어, 계정, 우리 };
}

/** 회차마다 검색어 열 개를 날짜로 돌려 가며 고른다(같은 낱말만 보지 않게). */
function 고른어(어, 날짜, 몇 = 10) {
  if (어.length <= 몇) return 어;
  const 날 = Math.floor(Date.parse(`${날짜}T00:00:00Z`) / 86400e3);
  const 시작 = (날 * 몇) % 어.length;
  return Array.from({ length: 몇 }, (_, k) => 어[(시작 + k) % 어.length]);
}

function 프롬프트(브랜드, s, o, 날짜) {
  const 계정 = s.계정 || [], 우리 = s.우리 || null;
  const 할일 = [
    `1. X를 실시간으로 검색해 위 주제에서 좋아요 · 리포스트 · 조회가 그 계정 평소보다 크게 튄 글을 찾는다. 광고 · 홍보 글, 실제 아이돌 · 연예인 사진 위주 글은 뺀다.`,
    `2. 반응이 큰 순서로 많아야 ${o.개수}개. 못 찾으면 적게 내도 된다 — 지어내지 마라. 글 주소는 네가 실제로 본 글의 주소만 적는다.`,
    `3. 지금 이 주제로 X에서 도는 이야기(흐름) 셋 이하를 한 줄씩.`,
  ];
  if (계정.length) 할일.push(`${할일.length + 1}. 「지켜볼 계정」마다 같은 기간에 올린 새 작업(새 영상, 새 광고, 새 강의, 새 상품 · 서비스 발표)과 그 계정 평소보다 반응이 크게 튄 글만 「계정글」에 적는다. 주소는 그 계정의 실제 글 주소(x.com/<아이디>/status/<번호>)로 적는다. 없으면 빈 배열.`);
  if (우리) 할일.push(`${할일.length + 1}. 같은 기간에 @${우리}를 부른 글과 @${우리} 글에 달린 답글을 모두 「우리반응」에 적는다. @${우리} 자신이 쓴 글은 넣지 않는다. 갈래는 ${반응갈래.join(' · ')} 가운데 하나다. 일 문의는 광고주 · 대행사 · 제작사가 일이나 값, 일정을 물어 온 글만이다. 팬 인사, 도구를 팔려는 글, 스팸은 일 문의가 아니다. 없으면 빈 배열.`);
  const 꼴 = [`"글":[{"주소":"https://x.com/<아이디>/status/<번호>","올린때":"ISO 8601","좋아요":0,"리포스트":0,"답글":0,"조회":null,"형식":"영상|사진|글|스레드","요지":"무슨 글인지 우리 말로 한 줄(원문을 길게 옮기지 말 것)","왜뜨나":"한 줄","가져갈점":"이 브랜드 짧은 영상이 가져갈 점 한 줄"}]`];
  if (계정.length) 꼴.push(`"계정글":[{"계정":"<지켜볼 계정 아이디>","주소":"https://x.com/<아이디>/status/<번호>","올린때":"ISO 8601","좋아요":0,"리포스트":0,"답글":0,"조회":null,"형식":"영상|사진|글|스레드","요지":"한 줄","왜뜨나":"한 줄","가져갈점":"한 줄"}]`);
  if (우리) 꼴.push(`"우리반응":[{"주소":"https://x.com/<아이디>/status/<번호>","올린때":"ISO 8601","갈래":"${반응갈래.join('|')}","요지":"한 줄"}]`);
  꼴.push(`"흐름":["한 줄"]`, `"못찾음":"찾기 어려웠던 까닭(없으면 빈 글)"`);
  return [
    `너는 SYNK의 SNS 기획 조사원이다. X(옛 트위터)에서 지금 반응이 큰 글을 찾아 숫자와 함께 보고한다.`,
    ``,
    `## 대상`,
    `- 브랜드와 시청자: ${s.이름}`,
    `- 주제 낱말(이 낱말 그대로가 아니어도 같은 시청자 · 같은 주제면 된다): ${고른어(s.어, 날짜).join(' · ')}`,
    `- 기간: 지금부터 거슬러 ${o.시간}시간 안에 올라온 글만.`,
    ...(계정.length ? [`- 지켜볼 계정(같은 시청자를 노리는 계정): ${계정.map(a => `@${a.아이디}${a.소개 ? `(${a.소개})` : ''}`).join(' · ')}`] : []),
    ...(우리 ? [`- 우리 계정: @${우리}`] : []),
    ``,
    `## 할 일`,
    ...할일,
    ``,
    `## 답 꼴 — JSON 한 덩이만, 앞뒤 설명 없이`,
    '```json',
    `{${꼴.join(',')}}`,
    '```',
    `숫자를 모르면 null. 사람 이름 · 아이디는 주소${계정.length ? ' · 「계정」 칸' : ''} 말고는 적지 않는다.`,
  ].join('\n');
}

/** 그록 답 글에서 읽히는 JSON 덩이 가운데 마지막 것(답이 두 번 이어 붙어 와도). */
const JSON꺼내기 = 글 => 그록.마지막JSON(글);

/** X 글 번호에 박힌 올린 시각(ms). 번호 꼴이 아니면 null. */
function 번호시각(번호) {
  if (!/^\d{8,20}$/.test(String(번호))) return null;
  try { const ms = Number((BigInt(번호) >> 22n) + BigInt(X시작ms)); return Number.isFinite(ms) ? ms : null; } catch { return null; }
}

const 정수 = v => (Number.isSafeInteger(v) && v >= 0 ? v : null);
const 한줄 = (v, n = 160) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');

/** 글 주소 하나를 잰다 — 꼴 · 겹침 · 번호 시각(미래 · 창 밖). 통과하면 { 번호, 때, 아이디(주소에 있으면) }, 아니면 { 까닭 }. */
function 주소재기(주소, { 시간, 지금 }, 본번호) {
  const m = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/(i|[A-Za-z0-9_]{1,15})\/status\/(\d{8,20})(?:[/?#].*)?$/.exec(String(주소 || '').trim());
  if (!m) return { 까닭: '주소 꼴 아님', 주소: 한줄(주소, 80) };
  const 번호 = m[2];
  if (본번호.has(번호)) return { 까닭: '같은 글 두 번', 번호 };
  const 때 = 번호시각(번호);
  if (때 === null || 때 > 지금 + 3600e3) return { 까닭: '번호 시각이 미래 · 꼴 아님', 번호 };
  if (때 < 지금 - (시간 + 24) * 3600e3) return { 까닭: `창 밖(번호 시각 ${new Date(때).toISOString().slice(0, 10)})`, 번호 };
  본번호.add(번호);
  return { 번호, 때, 아이디: m[1] === 'i' ? null : m[1] };
}

function 글칸(g, { 번호, 때 }) {
  const 적은때 = Date.parse(g?.올린때);
  return {
    주소: `https://x.com/i/status/${번호}`,
    올린때: new Date(때).toISOString(),
    날짜어긋남: Number.isFinite(적은때) && Math.abs(적은때 - 때) > 36 * 3600e3,
    좋아요: 정수(g?.좋아요), 리포스트: 정수(g?.리포스트), 답글: 정수(g?.답글), 조회: 정수(g?.조회),
    형식: ['영상', '사진', '글', '스레드'].includes(g?.형식) ? g.형식 : null,
    요지: 한줄(g?.요지), 왜뜨나: 한줄(g?.왜뜨나), 가져갈점: 한줄(g?.가져갈점),
  };
}

/**
 * 그록 답 → 받은 글 · 지켜볼 계정 글 · 우리 계정 반응 · 버린 까닭. 지금 시각과 창(시간)으로 번호 시각을 잰다.
 * 계정글은 주소(없으면 「계정」 칸)의 아이디가 지켜볼 계정일 때만 받는다. 우리반응은 우리 계정이 쓴 글을 빼고 일 문의를 앞에 둔다.
 */
function 거르기(답, { 시간, 개수, 지금 = Date.now(), 계정 = [], 우리 = null }) {
  const 창 = { 시간, 지금 };
  const 받음 = [], 버림 = [], 본번호 = new Set();
  for (const g of Array.isArray(답?.글) ? 답.글 : []) {
    const r = 주소재기(g?.주소, 창, 본번호);
    if (r.까닭) { 버림.push(r); continue; }
    받음.push(글칸(g, r));
    if (받음.length >= 개수) break;
  }
  const 아는 = new Map(계정.map(a => [a.아이디.toLowerCase(), a.아이디]));
  const 계정글 = [], 계정본 = new Set();
  if (아는.size) for (const g of Array.isArray(답?.계정글) ? 답.계정글 : []) {
    const r = 주소재기(g?.주소, 창, 계정본);
    if (r.까닭) { 버림.push({ ...r, 칸: '계정글' }); continue; }
    const 이름 = 아는.get(String(r.아이디 || g?.계정 || '').trim().replace(/^@/, '').toLowerCase());
    if (!이름) { 버림.push({ 까닭: '지켜볼 계정 밖', 번호: r.번호, 칸: '계정글' }); continue; }
    계정글.push({ 계정: 이름, ...글칸(g, r) });
    if (계정글.length >= 개수 * 2) break;
  }
  const 우리반응 = [], 우리본 = new Set();
  if (우리) for (const g of Array.isArray(답?.우리반응) ? 답.우리반응 : []) {
    const r = 주소재기(g?.주소, 창, 우리본);
    if (r.까닭) { 버림.push({ ...r, 칸: '우리반응' }); continue; }
    if (r.아이디 && r.아이디.toLowerCase() === 우리.toLowerCase()) { 버림.push({ 까닭: '우리 계정이 쓴 글', 번호: r.번호, 칸: '우리반응' }); continue; }
    우리반응.push({ 주소: `https://x.com/i/status/${r.번호}`, 번호: r.번호, 올린때: new Date(r.때).toISOString(), 갈래: 반응갈래.includes(g?.갈래) ? g.갈래 : '확인 필요', 요지: 한줄(g?.요지) });
    if (우리반응.length >= 30) break;
  }
  우리반응.sort((a, b) => (a.갈래 === '일 문의' ? 0 : 1) - (b.갈래 === '일 문의' ? 0 : 1));
  const 흐름 = (Array.isArray(답?.흐름) ? 답.흐름 : []).map(s => 한줄(s)).filter(Boolean).slice(0, 3);
  return { 받음, 계정글, 우리반응, 버림, 흐름, 못찾음: 한줄(답?.못찾음, 300) };
}

/** 우리반응에 「새」를 단다 — 앞 회차에 본 글 번호는 새가 아니다. 본 장부(번호 → 처음 본 날)를 고쳐 돌려준다. */
function 새표시(우리반응, 본, 날짜) {
  const 장부 = { ...(본 && typeof 본 === 'object' ? 본 : {}) };
  for (const g of 우리반응) {
    g.새 = !장부[g.번호];
    if (g.새) 장부[g.번호] = 날짜;
  }
  return 장부;
}

/** 브랜드마다 마지막으로 그록을 실제로 불러 결과를 받은 회차 — { 때(ms), 날짜, 결과 } 또는 null. 뿌리는 .tmp/수요스캔. */
function 지난회차(브랜드, 뿌리) {
  let 날짜들 = [];
  try { 날짜들 = fs.readdirSync(뿌리).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse(); } catch { return null; }
  for (const d of 날짜들) {
    let 줄들 = [];
    try { 줄들 = fs.readFileSync(path.join(뿌리, d, '기록.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean); } catch { continue; }
    const 맞음 = 줄들.map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(j => j && j.도구 === '엑스' && j.브랜드 === 브랜드 && !j.못잼 && !j.이어씀 && Date.parse(j.때));
    if (!맞음.length) continue;
    const 때 = Math.max(...맞음.map(j => Date.parse(j.때)));
    let 결과 = null;
    try { 결과 = (JSON.parse(fs.readFileSync(path.join(뿌리, d, '엑스.json'), 'utf8')).결과 || []).find(r => r.브랜드 === 브랜드 && !r.못잼 && !r.이어씀) || null; } catch { /* 파일 없음 */ }
    return 결과 ? { 때, 날짜: d, 결과 } : null;
  }
  return null;
}

/** 이번 회차에 그록을 부르지 않아도 되는지 — 마지막 회차가 (사이 − 밀림)시간 안이면 그 결과를 이어 쓴다. */
function 이어쓸까(지난, 사이, 지금 = Date.now()) {
  if (!사이 || !지난) return false;
  return 지금 - 지난.때 < Math.max(0, 사이 - 밀림시간) * 3600e3;
}

function 이어쓴결과(지난) {
  const r = JSON.parse(JSON.stringify(지난.결과));
  r.이어씀 = 지난.날짜;
  for (const g of r.우리반응 || []) g.새 = false;
  return r;
}

const 숫자 = v => (v === null || v === undefined ? '—' : Number(v).toLocaleString('ko-KR'));

function 마크다운(날짜, o, 결과) {
  const 줄 = [`# X 실시간 반응 · ${날짜}`, '', `최근 ${o.시간}시간 · 그록 실시간 검색(그록 보고 — 글 주소는 열어 보지 않았다, 번호 시각으로 창 밖 글은 버렸다). 원문 · 작성자는 옮기지 않는다.`, ''];
  for (const r of 결과) {
    줄.push(`## ${r.이름} (${r.브랜드})`, '');
    if (r.못잼) { 줄.push(`못 잼 — ${r.못잼}`, ''); continue; }
    if (r.이어씀) 줄.push(`이번에는 그록을 부르지 않았다 — ${r.이어씀} 회차 결과를 그대로 싣는다(사흘에 한 번 부른다).`, '');
    if (r.흐름.length) { 줄.push('흐름', ...r.흐름.map(s => `- ${s}`), ''); }
    if (!r.받음.length) 줄.push(`받은 글 없음${r.못찾음 ? ` — ${r.못찾음}` : ''}`, '');
    else {
      줄.push('| 올린 때 | 좋아요 | 리포스트 | 조회 | 형식 | 요지 | 왜 뜨나 | 가져갈 점 | 주소 |', '|---|---|---|---|---|---|---|---|---|');
      for (const g of r.받음) 줄.push(`| ${g.올린때.slice(0, 16).replace('T', ' ')}${g.날짜어긋남 ? ' ⚠' : ''} | ${숫자(g.좋아요)} | ${숫자(g.리포스트)} | ${숫자(g.조회)} | ${g.형식 || '—'} | ${g.요지.replace(/\|/g, '/')} | ${g.왜뜨나.replace(/\|/g, '/')} | ${g.가져갈점.replace(/\|/g, '/')} | ${g.주소} |`);
      줄.push('');
    }
    if (r.계정수) {
      줄.push(`### 지켜볼 계정의 새 글 (${r.계정수}곳)`, '');
      if (!r.계정글?.length) 줄.push('새 글 없음', '');
      else {
        줄.push('| 올린 때 | 계정 | 좋아요 | 리포스트 | 조회 | 형식 | 요지 | 가져갈 점 | 주소 |', '|---|---|---|---|---|---|---|---|---|');
        for (const g of r.계정글) 줄.push(`| ${g.올린때.slice(0, 16).replace('T', ' ')}${g.날짜어긋남 ? ' ⚠' : ''} | @${g.계정} | ${숫자(g.좋아요)} | ${숫자(g.리포스트)} | ${숫자(g.조회)} | ${g.형식 || '—'} | ${g.요지.replace(/\|/g, '/')} | ${g.가져갈점.replace(/\|/g, '/')} | ${g.주소} |`);
        줄.push('');
      }
    }
    if (r.우리) {
      const 새문의 = (r.우리반응 || []).filter(g => g.갈래 === '일 문의' && g.새);
      줄.push(`### 우리 계정 반응 (@${r.우리})`, '');
      if (!r.우리반응?.length) 줄.push('반응 없음', '');
      else {
        줄.push(새문의.length ? `**새 일 문의 ${새문의.length}건**` : '새 일 문의 없음', '');
        줄.push('| 올린 때 | 갈래 | 새 | 요지 | 주소 |', '|---|---|---|---|---|');
        for (const g of r.우리반응) 줄.push(`| ${g.올린때.slice(0, 16).replace('T', ' ')} | ${g.갈래} | ${g.새 ? '새' : '앞 회차에 봄'} | ${g.요지.replace(/\|/g, '/')} | ${g.주소} |`);
        줄.push('');
      }
    }
    if (r.버림.length) 줄.push(`버림 ${r.버림.length} — ${r.버림.map(b => b.까닭).join(' · ')}`, '');
    줄.push(`걸린 시간 ${Math.round((r.걸린ms || 0) / 1000)}초${r.비용USD !== null && r.비용USD !== undefined ? ` · 그록이 적은 값 $${r.비용USD}(구독 몫)` : ''}`, '');
  }
  return 줄.join('\n');
}

async function main(argv) {
  const o = 인자(argv);
  const 날짜 = o.날짜 || 서울날짜();
  const 출력 = o.출력 || path.join(공용작업본(path.resolve(여기, '..', '..')), '.tmp', '수요스캔', 날짜);
  if (o.프롬프트만) { for (const b of o.브랜드) console.log(`===== ${b}\n${프롬프트(b, 설정(b), o, 날짜)}\n`); return 0; }
  const 상태 = 그록.점검();
  if (!상태.ok) { console.error(`그록을 못 부른다(${상태.code}) — ${상태.안내}`); return 3; }
  fs.mkdirSync(출력, { recursive: true });
  const 본파일 = path.join(path.dirname(출력), '엑스_우리반응.json');
  const 결과 = [], 기록 = [];
  for (const b of o.브랜드) {
    const 지난 = o.사이 ? 지난회차(b, path.dirname(출력)) : null;
    if (이어쓸까(지난, o.사이)) {
      결과.push(이어쓴결과(지난));
      기록.push({ 도구: '엑스', 브랜드: b, 때: new Date().toISOString(), 이어씀: 지난.날짜 });
      console.log(`${b}: 그록을 부르지 않음 — ${지난.날짜} 회차 결과를 이어 씀(다음 회차는 그 뒤 ${o.사이}시간쯤)`);
      continue;
    }
    const s = 설정(b);
    const r = { 브랜드: b, 이름: s.이름, 계정수: s.계정.length, 우리: s.우리, 받음: [], 계정글: [], 우리반응: [], 버림: [], 흐름: [], 못찾음: '', 못잼: null, 걸린ms: null, 비용USD: null };
    const 더 = s.계정.length || s.우리;
    try {
      const 답 = await 그록.부르기({ 프롬프트: 프롬프트(b, s, o, 날짜), 웹: true, 턴: 더 ? 18 : 12, 시간초: 더 ? 900 : 600 });
      r.걸린ms = 답.걸린ms; r.비용USD = 답.비용USD;
      const j = JSON꺼내기(답.글);
      if (!j) r.못잼 = '답이 JSON 꼴이 아님';
      else Object.assign(r, 거르기(j, { 시간: o.시간, 개수: o.개수, 계정: s.계정, 우리: s.우리 }));
    } catch (e) {
      r.못잼 = `${e.code || 'ERROR'} — ${String(e.message).slice(0, 200)}`;
      if (e.code === 'NEEDS_LOGIN' || e.code === 'NOT_INSTALLED') { 결과.push(r); break; }
    }
    if (r.우리반응.length) {
      let 본 = {};
      try { 본 = JSON.parse(fs.readFileSync(본파일, 'utf8')); } catch { /* 첫 회차 */ }
      fs.writeFileSync(본파일, JSON.stringify(새표시(r.우리반응, 본, 날짜), null, 1));
    }
    결과.push(r);
    const 새문의 = r.우리반응.filter(g => g.갈래 === '일 문의' && g.새).length;
    기록.push({ 도구: '엑스', 브랜드: b, 때: new Date().toISOString(), 걸린ms: r.걸린ms, 비용USD: r.비용USD, 받음: r.받음.length, 계정글: r.계정글.length, 우리반응: r.우리반응.length, 새일문의: 새문의, 버림: r.버림.length, 못잼: r.못잼 });
    console.log(`${b}: 받음 ${r.받음.length}${s.계정.length ? ` · 계정글 ${r.계정글.length}` : ''}${s.우리 ? ` · 우리 반응 ${r.우리반응.length}(새 일 문의 ${새문의})` : ''} · 버림 ${r.버림.length}${r.못잼 ? ` · 못 잼(${r.못잼})` : ''}`);
  }
  fs.writeFileSync(path.join(출력, '엑스.json'), JSON.stringify({ 날짜, 시간: o.시간, 결과 }, null, 1));
  fs.writeFileSync(path.join(출력, '엑스.md'), 마크다운(날짜, o, 결과));
  fs.appendFileSync(path.join(출력, '기록.jsonl'), 기록.map(j => JSON.stringify(j)).join('\n') + (기록.length ? '\n' : ''));
  console.log(`결과: ${path.join(출력, '엑스.md')}`);
  return 결과.every(r => r.못잼) ? 1 : 0;
}

if (require.main === module) main(process.argv.slice(2)).then(c => { process.exitCode = c; }, e => { console.error(e.message); process.exitCode = 2; });

module.exports = { 인자, 설정, 프롬프트, 거르기, 새표시, 번호시각, JSON꺼내기, 고른어, 마크다운, 브랜드들, 전부브랜드, 지난회차, 이어쓸까, 이어쓴결과 };
