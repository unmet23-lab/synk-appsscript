#!/usr/bin/env node
// PATH 유학 앱 공식 자료 만료 검사 — AI 없이 남은 날만 잰다(2026-11-22).
//
// 앱(synk.im/path/app/)은 확인한 지 90일이 넘은 자료에 「다시 확인하세요」를 띄운다.
//   글(channel-data.mjs POSTS): isStalePost가 한국 날짜로 센다 → 확인일 + 90일째까지 「확인됨」.
//   규칙(study-data.mjs RULES) · 실제 과정(PROGRAMS, example: false): staleItems가 시각으로 센다 → 확인일 + 90일째 09:00(KST)에 넘어간다.
//   내 길 서류(docs-data.mjs PROGRAM_DOCS · VISA_DOCS): 글과 같은 isStalePost로 센다.
//   그래서 하루 종일 「확인됨」인 마지막 날은 글 · 서류 = 확인일 + 90, 규칙 · 과정 = 확인일 + 89다.
// 실제 과정은 마지막 접수 차수(applyRounds, 없으면 applyCloses)가 끝나면 다음 요강으로 고쳐야 한다. 마지막 날 = 그 끝 날.
// 남은 날 = 마지막 날 − 오늘(KST). 문턱(14일) 이하이거나 음수면 걸린다.
//
// 기준은 공개본 app.mjs다. 공개 묶음(tools/prepare-path-app-public.mjs)이 원본 모양을 그대로 두어 같은 글 읽기로 된다.
// 항목 목록과 종류는 저장소 모듈에서 얻고, 저장소 글을 같은 방법으로 읽어 모듈 값과 맞는지 매번 확인한다.
// 공개본을 못 받거나 공개본에서 항목을 못 찾으면 저장소 값으로 잰다. 저장소 값이 공개본과 다르면 「공개 대기」를 붙인다.
//
//   node tools/path유학자료만료.mjs                     공개본 + 저장소(공용 작업본)
//   node tools/path유학자료만료.mjs --오늘 2027-02-10   오늘을 박아 본다
//   node tools/path유학자료만료.mjs --저장소만           공개본을 받지 않는다
//   node tools/path유학자료만료.mjs --뿌리 <폴더>        저장소 자료를 읽을 작업본(여럿이면 앞에서부터 읽히는 것)
//   node tools/path유학자료만료.mjs --json
//
// 예약 작업 「SYNK PATH 유학 자료 확인」(tools/크레딧작업/PATH유학자료확인.js)이 하루 한 번 부르고, 새로 걸린 항목만 텔레그램으로 알린다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { 날짜인가, 날더하기, 날차이, 오늘KST, 기본뿌리 } from './path자료만료.mjs';

export { 오늘KST, 기본뿌리 };
export const 기본문턱 = 14;
export const 공개주소 = 'https://synk.im/path/app/';
export const 마지막날더함 = Object.freeze({ 글: 90, 규칙: 89, 과정: 89, 서류: 90 });
const 자료폴더 = 'experiences/path-app';
const 자료파일 = Object.freeze({ channel: 'channel-data.mjs', study: 'study-data.mjs', docs: 'docs-data.mjs' });

const 이스케이프 = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const 날꼴 = `["'](\\d{4}-\\d{2}-\\d{2})["']`;

/** 모듈 값에서 검사할 항목: 손 글 · 규칙 · 실제 과정 · 내 길 서류 묶음. 예시 과정은 세지 않는다. */
export function 목록만들기({ POSTS = [], RULES = [], PROGRAMS = [], PROGRAM_DOCS = {}, VISA_DOCS = {} }) {
  const 짧게 = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);
  const 규칙이름 = (r) => (r.kind === 'finance' ? `재정 기준 ${r.visa} ${r.region === 'metro' ? '수도권' : '지방'}`
    : r.kind === 'finance-proof' ? `잔고 증명 방법 ${r.visa}` : r.kind === 'finance-waiver' ? '잔고 증명 면제 계획' : `규칙 ${r.kind}`);
  return [
    ...POSTS.map((p) => ({ 종류: '글', id: p.id, 이름: `글 「${짧게(p.title.ko, 22)}」`, checkedAt: p.checkedAt, 접수끝: null })),
    ...RULES.map((r) => ({ 종류: '규칙', id: r.id, 이름: 규칙이름(r), checkedAt: r.checkedAt, 접수끝: null })),
    ...PROGRAMS.filter((p) => !p.example).map((p) => ({
      종류: '과정', id: p.id, 이름: `${p.name.ko}${p.level === 'language' ? '' : ' 학부'}`, checkedAt: p.checkedAt, 접수끝: 접수끝날(p),
    })),
    ...Object.entries(PROGRAM_DOCS).map(([pid, d]) => {
      const p = PROGRAMS.find((x) => x.id === pid);
      return { 종류: '서류', id: d.id, 이름: `내 길 서류 ${p ? `${p.name.ko}${p.level === 'language' ? '' : ' 학부'}` : pid}`, checkedAt: d.checkedAt, 접수끝: null };
    }),
    ...Object.entries(VISA_DOCS).map(([visa, d]) => ({ 종류: '서류', id: d.id, 이름: `내 길 비자 서류 ${visa}`, checkedAt: d.checkedAt, 접수끝: null })),
  ];
}

/** 마지막 접수 차수의 끝 날. 차수가 없으면 applyCloses, 그것도 없으면 null. */
export function 접수끝날(p) {
  const 끝들 = Array.isArray(p.applyRounds) ? p.applyRounds.map((r) => r?.[1]).filter(날짜인가) : [];
  if (끝들.length) return 끝들.reduce((a, b) => (a > b ? a : b));
  return 날짜인가(p.applyCloses) ? p.applyCloses : null;
}

/**
 * 원본이나 공개 묶음의 글에서 항목마다 checkedAt과 마지막 접수 끝 날을 읽는다.
 * 항목의 몸은 `id: '<id>'`부터 다음 알려진 항목 id 앞까지다. id가 없거나 두 번 이상 나오면 그 항목은 못 읽은 것으로 둔다.
 */
export function 글에서읽기(글, ids) {
  const s = String(글);
  const 자리 = new Map();
  for (const id of ids) {
    const 찾음 = [...s.matchAll(new RegExp(`\\bid:\\s*["']${이스케이프(id)}["']`, 'g'))];
    if (찾음.length === 1) 자리.set(id, 찾음[0].index);
  }
  const 시작들 = [...자리.values()].sort((a, b) => a - b);
  const 읽음 = new Map();
  for (const [id, 시작] of 자리) {
    const 몸 = s.slice(시작, 시작들.find((x) => x > 시작) ?? s.length);
    const checkedAt = new RegExp(`\\bcheckedAt:\\s*${날꼴}`).exec(몸)?.[1] ?? null;
    const 차수 = /\bapplyRounds:\s*\[([\s\S]*?\])\s*\]/.exec(몸);
    const 차수끝들 = 차수 ? [...차수[1].matchAll(/\[\s*["'][\d-]+["']\s*,\s*["'](\d{4}-\d{2}-\d{2})["']\s*\]/g)].map((m) => m[1]) : [];
    const 닫음 = new RegExp(`\\bapplyCloses:\\s*${날꼴}`).exec(몸)?.[1] ?? null;
    읽음.set(id, { checkedAt, 접수끝: 차수끝들.length ? 차수끝들.reduce((a, b) => (a > b ? a : b)) : 닫음 });
  }
  return 읽음;
}

/** 항목마다 확인일 줄(모두)과 접수 줄(실제 과정)을 낸다. 공개 값이 있으면 그것이 기준이다. */
export function 항목셈(목록, { 공개 = null, 오늘, 문턱 = 기본문턱 }) {
  if (!날짜인가(오늘)) throw new Error(`오늘이 날짜가 아니다: ${오늘}`);
  const 줄들 = [];
  for (const 항목 of 목록) {
    const 공개값 = 공개?.get(항목.id) || null;
    const 공개에있음 = !!(공개값 && 날짜인가(공개값.checkedAt));
    const 기준 = 공개에있음 ? 공개값 : 항목;
    const 공개대기 = 공개에있음 && (공개값.checkedAt !== 항목.checkedAt || (항목.종류 === '과정' && 공개값.접수끝 !== 항목.접수끝));
    const 공통 = { 종류: 항목.종류, id: 항목.id, 이름: 항목.이름, 기준: 공개에있음 ? '공개본' : '저장소', 공개대기, 공개에없음: !!공개 && !공개에있음 };
    const 넣기 = (검사, 기준날, 마지막날) => {
      const 남은날 = 마지막날 ? 날차이(마지막날, 오늘) : null;
      const 걸림 = 남은날 !== null && 남은날 <= 문턱;
      const 단계 = !걸림 ? null : 남은날 < 0 ? '지남' : '곧';
      줄들.push({ ...공통, 검사, 기준날, 마지막날, 남은날, 걸림, 단계, 열쇠: 걸림 ? `${항목.종류}:${검사}:${항목.id}:${마지막날}:${단계}` : null });
    };
    if (!날짜인가(기준.checkedAt)) throw new Error(`${항목.id}의 checkedAt을 못 읽었다`);
    넣기('확인일', 기준.checkedAt, 날더하기(기준.checkedAt, 마지막날더함[항목.종류]));
    if (항목.종류 === '과정') 넣기('접수', 기준.접수끝, 기준.접수끝);
  }
  return 줄들.sort((a, b) => (a.남은날 ?? Infinity) - (b.남은날 ?? Infinity) || a.id.localeCompare(b.id));
}

/** 저장소 모듈을 읽고, 같은 작업본의 원본 글을 글 읽기로 읽어 모듈 값과 같은지 본다(공개본 읽기가 믿을 만한지의 근거). */
export async function 저장소자료(뿌리) {
  const 파일 = (이름) => path.join(뿌리, 자료폴더, 이름);
  const 채널 = await import(pathToFileURL(파일(자료파일.channel)).href);
  const 유학 = await import(pathToFileURL(파일(자료파일.study)).href);
  const 서류 = await import(pathToFileURL(파일(자료파일.docs)).href);
  const 목록 = 목록만들기({ POSTS: 채널.POSTS, RULES: 유학.RULES, PROGRAMS: 유학.PROGRAMS, PROGRAM_DOCS: 서류.PROGRAM_DOCS, VISA_DOCS: 서류.VISA_DOCS });
  const 글 = [자료파일.channel, 자료파일.study, 자료파일.docs].map((x) => fs.readFileSync(파일(x), 'utf8')).join('\n');
  const 읽음 = 글에서읽기(글, 목록.map((x) => x.id));
  for (const 항목 of 목록) {
    const r = 읽음.get(항목.id);
    if (!r || r.checkedAt !== 항목.checkedAt || (항목.종류 === '과정' && r.접수끝 !== 항목.접수끝)) {
      throw new Error(`자료 글 꼴이 바뀌어 ${항목.id}를 글로 읽은 값이 모듈 값과 다르다 — tools/path유학자료만료.mjs 글에서읽기를 고친다`);
    }
  }
  return { 뿌리, 목록 };
}

export async function 공개본글({ fetch = globalThis.fetch, 주소 = 공개주소, 시간 = 20000, 지금 = Date.now() } = {}) {
  const 끊기 = new AbortController();
  const 타이머 = setTimeout(() => 끊기.abort(), 시간);
  try {
    // CDN이 옛 판을 주지 않게 매번 다른 꼬리를 붙인다.
    const r = await fetch(`${주소}app.mjs?check=${+지금}`, { signal: 끊기.signal, headers: { 'cache-control': 'no-cache' } });
    if (!r.ok) throw new Error(`app.mjs HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(타이머); }
}

/** 저장소 목록과 공개본 값으로 항목마다 남은 날을 낸다. 저장소를 하나도 못 읽으면 예외. */
export async function 만료확인({ 뿌리들 = [기본뿌리()], 오늘 = 오늘KST(), 문턱 = 기본문턱, 공개본 = true, fetch, 주소, 지금 } = {}) {
  const 저장소 = [];
  for (const 뿌리 of 뿌리들) {
    try { 저장소.push(await 저장소자료(뿌리)); break; } catch (e) { 저장소.push({ 뿌리, 오류: e.message }); }
  }
  const 쓸저장소 = 저장소.find((x) => !x.오류);
  if (!쓸저장소) throw new Error(`저장소 자료를 못 읽었다 — ${저장소.map((x) => `${x.뿌리}: ${x.오류}`).join(' · ')}`);
  let 공개 = null, 공개오류 = null;
  if (공개본) {
    try { 공개 = 글에서읽기(await 공개본글({ fetch, 주소, 지금 }), 쓸저장소.목록.map((x) => x.id)); }
    catch (e) { 공개오류 = e.name === 'AbortError' ? '시간 초과' : e.message; }
  }
  const 줄들 = 항목셈(쓸저장소.목록, { 공개, 오늘, 문턱 });
  return {
    오늘, 문턱, 줄들, 걸림: 줄들.filter((x) => x.걸림),
    공개본: 공개본 ? (공개오류 ? { 오류: 공개오류 } : { 읽음: 공개.size }) : null,
    저장소: 저장소.map((x) => (x.오류 ? { 뿌리: x.뿌리, 오류: x.오류 } : { 뿌리: x.뿌리, 항목: x.목록.length })),
  };
}

const 남은글 = (n) => (n === null ? '날짜 없음' : n < 0 ? `${-n}일 지남` : n === 0 ? '오늘이 마지막 날' : `${n}일 남음`);
const 꼬리 = (x) => `${x.공개대기 ? ' · 저장소는 고쳐졌고 공개가 남음' : ''}${x.공개에없음 ? ' · 공개본에서 못 찾아 저장소 값으로 잼' : ''}`;

/** 한 항목의 사람용 한 줄. */
export function 항목글(x) {
  if (x.검사 === '접수') {
    if (x.마지막날 === null) return `${x.이름}(${x.id}): 접수 날짜가 자료에 없어요${꼬리(x)}.`;
    return `${x.이름}(${x.id}): 마지막 접수 차수가 ${x.마지막날}에 ${x.남은날 < 0 ? '끝났어요' : '끝나요'}(${남은글(x.남은날)}). 다음 요강으로 고쳐야 해요${꼬리(x)}.`;
  }
  return `${x.이름}(${x.id}): ${x.기준날}에 확인한 자료예요. ${x.마지막날}이 지나면 앱이 「다시 확인하세요」를 띄워요(${남은글(x.남은날)}). 출처를 다시 읽고 checkedAt을 고쳐야 해요${꼬리(x)}.`;
}

/** 새로 걸린 항목을 알리는 글(텔레그램 한 통). 접수는 과정마다 한 줄, 확인일은 같은 날 확인한 자료를 한 줄로 묶는다. */
export function 알림글(r, 새것) {
  const 접수 = 새것.filter((x) => x.검사 === '접수').map((x) => `· ${항목글(x)}`);
  const 묶음 = new Map();
  for (const x of 새것.filter((y) => y.검사 === '확인일')) 묶음.set(x.기준날, [...(묶음.get(x.기준날) || []), x]);
  const 확인 = [...묶음].map(([날, xs]) => {
    if (xs.length === 1) return `· ${항목글(xs[0])}`;
    const 먼저 = xs.reduce((a, b) => (a.남은날 <= b.남은날 ? a : b));
    const 셈 = ['글', '규칙', '과정', '서류'].map((k) => [k, xs.filter((x) => x.종류 === k).length]).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · ');
    const 대기 = xs.some((x) => x.공개대기) ? ' 일부는 저장소에서 고쳐졌고 공개가 남았어요.' : '';
    return `· ${날}에 확인한 자료 ${xs.length}건(${셈}): ${먼저.마지막날}이 지나면 앱이 「다시 확인하세요」를 띄워요(${남은글(먼저.남은날)}). 출처를 다시 읽고 checkedAt을 고쳐야 해요.${대기}`;
  });
  const 공개 = r.공개본?.오류 ? [`공개본(synk.im/path/app/)을 못 읽어 저장소 값으로 쟀어요 — ${r.공개본.오류}`] : [];
  return [
    `[PATH 유학] 공식 자료를 다시 확인할 항목이 새로 ${새것.length}건 생겼어요(오늘 ${r.오늘}, 문턱 ${r.문턱}일).${r.걸림.length > 새것.length ? ` 지금 걸린 항목은 모두 ${r.걸림.length}건이에요.` : ''}`,
    ...접수, ...확인, ...공개,
    '고칠 곳: experiences/path-app/channel-data.mjs · study-data.mjs · docs-data.mjs. 전체 목록: node tools/path유학자료만료.mjs',
  ].join('\n');
}

export function 표(r) {
  const 머리 = `PATH 유학 자료 — 오늘 ${r.오늘}(KST), 문턱 ${r.문턱}일, 걸림 ${r.걸림.length}건`;
  const 줄 = r.줄들.map((x) => `${x.걸림 ? '!' : ' '} ${남은글(x.남은날).padEnd(10)} ${x.검사 === '접수' ? '접수' : '확인'}  ${x.종류} ${x.id} — ${x.검사 === '접수' ? `마지막 차수 끝 ${x.마지막날 ?? '없음'}` : `확인일 ${x.기준날} · 마지막 날 ${x.마지막날}`} [${x.기준}]${꼬리(x)}`);
  const 끝 = [
    r.공개본 ? (r.공개본.오류 ? `공개본 못 읽음: ${r.공개본.오류}` : `공개본: 항목 ${r.공개본.읽음}개 읽음`) : '공개본: 받지 않음',
    ...r.저장소.map((s) => (s.오류 ? `저장소 ${s.뿌리}: 못 읽음 — ${s.오류}` : `저장소 ${s.뿌리}: 항목 ${s.항목}개`)),
  ];
  return [머리, ...줄, ...끝].join('\n');
}

async function 메인(argv) {
  const 값 = (이름) => { const i = argv.indexOf(이름); return i >= 0 ? argv[i + 1] : undefined; };
  const 뿌리들 = argv.flatMap((a, i) => (a === '--뿌리' && argv[i + 1] ? [path.resolve(argv[i + 1])] : []));
  const r = await 만료확인({
    뿌리들: 뿌리들.length ? 뿌리들 : [기본뿌리()], 오늘: 값('--오늘') || 오늘KST(), 문턱: 값('--문턱') ? Number(값('--문턱')) : 기본문턱,
    공개본: !argv.includes('--저장소만'),
  });
  console.log(argv.includes('--json') ? JSON.stringify(r, null, 1) : 표(r));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  메인(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exitCode = 1; });
}
