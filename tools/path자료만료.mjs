#!/usr/bin/env node
// 서울 하루 장소 자료 만료 검사 — AI 없이 남은 날만 잰다(2026-11-07).
//
// 엔진(experiences/path-travel/real-conditions.mjs `freshIssue`)은 확인일부터 30일째 되는 날까지만 운영 안내를 「확인됨」으로 보고,
// 공휴일 달력(REAL_CONDITION_CALENDAR)은 through 날까지만 읽는다. 그 뒤로는 모든 곳이 「확인 필요」가 되고 휴관 판정도 잃는다
// (11-08 월요일 휴관 운현궁이 일정에 들어간 사고). 그래서
//   마지막 날 = min(확인일 + 30일, 달력 끝),  남은 날 = 마지막 날 − 오늘(KST)
// 0이면 오늘이 마지막 날, 음수면 이미 만료다. 확인일은 places-v2.mjs `const checkedAt`과 세 자료 파일의 verifiedAt 가운데 가장 오랜 날이다.
//
// 만료되는 것은 공개 앱(synk.im/try/travel/)이므로 기준은 공개본이다. 공개본을 못 받으면 저장소 자료로 잰다.
// 저장소만 새롭고 공개본이 옛 판이면(고치고 공개를 못 한 회차) 공개본 쪽 남은 날로 깨운다.
//
//   node tools/path자료만료.mjs                     공개본 + 저장소(공용 작업본)
//   node tools/path자료만료.mjs --오늘 2026-11-28   오늘을 박아 본다
//   node tools/path자료만료.mjs --저장소만           공개본을 받지 않는다
//   node tools/path자료만료.mjs --뿌리 <폴더>        저장소 자료를 읽을 작업본(여럿이면 가장 새 확인일)
//   node tools/path자료만료.mjs --json
//
// 예약 작업 「SYNK 서울 하루 자료 재확인」(tools/크레딧작업/서울하루재확인.js)이 하루 한 번 부르고, 남은 날이 문턱(9일) 이하면 Claude를 깨운다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const 이폴더 = path.dirname(fileURLToPath(import.meta.url));

export const 유효일수 = 30; // real-conditions.mjs REAL_CONDITION_MAX_AGE_DAYS — 시험이 같은 값인지 본다
export const 기본문턱 = 9;
export const 공개주소 = 'https://synk.im/try/travel/';
export const 자료파일 = Object.freeze({ places: 'places-v2.mjs', real: 'real-places.mjs', course: 'real-course-data.mjs' });
const 자료폴더 = 'experiences/path-travel';
const 하루 = 86400000;

const 날짜꼴 = /^\d{4}-\d{2}-\d{2}$/;
export function 날짜인가(값) {
  return typeof 값 === 'string' && 날짜꼴.test(값) && new Date(`${값}T00:00:00Z`).toISOString().slice(0, 10) === 값;
}
const 날 = (값) => Date.parse(`${값}T00:00:00Z`) / 하루;
export const 날더하기 = (값, n) => new Date(Date.parse(`${값}T00:00:00Z`) + n * 하루).toISOString().slice(0, 10);
export const 날차이 = (뒤, 앞) => Math.round(날(뒤) - 날(앞));
export const 오늘KST = (지금 = new Date()) => new Date(+new Date(지금) + 9 * 3600000).toISOString().slice(0, 10);

/** 세 자료 파일의 글에서 확인일 · 달력 끝을 읽는다. 공개본은 원본 바이트 그대로라 같은 읽기로 된다. */
export function 자료날짜({ places, real, course = '' }) {
  const checkedAt = /\bconst\s+checkedAt\s*=\s*['"](\d{4}-\d{2}-\d{2})['"]/.exec(String(places))?.[1];
  const 달력자리 = String(real).indexOf('REAL_CONDITION_CALENDAR');
  const 달력 = 달력자리 < 0 ? '' : String(real).slice(달력자리, 달력자리 + 2000);
  const through = /["']?through["']?\s*:\s*["'](\d{4}-\d{2}-\d{2})["']/.exec(달력)?.[1];
  const 확인일들 = [...`${real}\n${course}`.matchAll(/["']?verifiedAt["']?\s*:\s*["'](\d{4}-\d{2}-\d{2})["']/g)].map((m) => m[1]).filter(날짜인가);
  if (!날짜인가(checkedAt)) throw new Error('places-v2.mjs에서 const checkedAt을 못 읽었다');
  if (!날짜인가(through)) throw new Error('real-places.mjs에서 REAL_CONDITION_CALENDAR.through를 못 읽었다');
  const 가장오랜 = 확인일들.length ? 확인일들.reduce((a, b) => (a < b ? a : b)) : checkedAt;
  return { checkedAt, through, 가장오랜확인일: 가장오랜, 확인일: checkedAt < 가장오랜 ? checkedAt : 가장오랜 };
}

/** 남은 날 = min(확인일 + 30, 달력 끝) − 오늘. */
export function 남은날계산({ 확인일, 달력끝, 오늘, 문턱 = 기본문턱 }) {
  for (const [이름, 값] of [['확인일', 확인일], ['달력끝', 달력끝], ['오늘', 오늘]]) if (!날짜인가(값)) throw new Error(`${이름}이 날짜가 아니다: ${값}`);
  const 확인만료 = 날더하기(확인일, 유효일수);
  const 마지막날 = 확인만료 < 달력끝 ? 확인만료 : 달력끝;
  const 남은날 = 날차이(마지막날, 오늘);
  return { 확인일, 달력끝, 확인만료, 마지막날, 오늘, 남은날, 문턱, 깨울까: 남은날 <= 문턱 };
}

export function 저장소자료(뿌리) {
  const 읽기 = (이름) => fs.readFileSync(path.join(뿌리, 자료폴더, 이름), 'utf8');
  return { 뿌리, ...자료날짜({ places: 읽기(자료파일.places), real: 읽기(자료파일.real), course: 읽기(자료파일.course) }) };
}

export async function 공개본자료({ fetch = globalThis.fetch, 주소 = 공개주소, 시간 = 20000, 지금 = Date.now() } = {}) {
  const 받기 = async (이름) => {
    const 끊기 = new AbortController();
    const 타이머 = setTimeout(() => 끊기.abort(), 시간);
    try {
      // CDN이 옛 판을 주지 않게 매번 다른 꼬리를 붙인다.
      const r = await fetch(`${주소}${이름}?check=${+지금}`, { signal: 끊기.signal, headers: { 'cache-control': 'no-cache' } });
      if (!r.ok) throw new Error(`${이름} HTTP ${r.status}`);
      return await r.text();
    } finally { clearTimeout(타이머); }
  };
  const [places, real, course] = await Promise.all([받기(자료파일.places), 받기(자료파일.real), 받기(자료파일.course)]);
  return { 주소, ...자료날짜({ places, real, course }) };
}

/** 공개본(기본) · 저장소 자료를 읽어 남은 날을 낸다. 어느 쪽도 못 읽으면 예외. */
export async function 만료확인({ 뿌리들 = [기본뿌리()], 오늘 = 오늘KST(), 문턱 = 기본문턱, 공개본 = true, fetch, 주소, 지금 } = {}) {
  const 저장소 = 뿌리들.map((뿌리) => { try { return 저장소자료(뿌리); } catch (e) { return { 뿌리, 오류: e.message }; } });
  const 읽은저장소 = 저장소.filter((x) => !x.오류).sort((a, b) => (a.확인일 < b.확인일 ? 1 : -1));
  let 공개 = null;
  if (공개본) { try { 공개 = await 공개본자료({ fetch, 주소, 지금 }); } catch (e) { 공개 = { 주소: 주소 || 공개주소, 오류: e.name === 'AbortError' ? '시간 초과' : e.message }; } }
  const 기준값 = 공개 && !공개.오류 ? 공개 : 읽은저장소[0];
  if (!기준값) throw new Error(`자료를 못 읽었다 — ${[공개?.오류, ...저장소.map((x) => x.오류)].filter(Boolean).join(' · ')}`);
  const 셈 = 남은날계산({ 확인일: 기준값.확인일, 달력끝: 기준값.through, 오늘, 문턱 });
  return { ...셈, 기준: 기준값 === 공개 ? '공개본' : '저장소', 공개본: 공개, 저장소, 저장소확인일: 읽은저장소[0]?.확인일 ?? null };
}

export function 기본뿌리() {
  try { return require('./lib/공용작업본.js').공용작업본(path.resolve(이폴더, '..')); } catch { return path.resolve(이폴더, '..'); }
}

export function 한줄(r) {
  const 상태 = r.남은날 < 0 ? `만료 ${-r.남은날}일 지남` : r.남은날 === 0 ? '오늘이 마지막 날' : `남은 날 ${r.남은날}일`;
  return `${상태} — ${r.기준} 확인일 ${r.확인일} · 달력 끝 ${r.달력끝} · 마지막 날 ${r.마지막날}(오늘 ${r.오늘} KST, 문턱 ${r.문턱}일 ${r.깨울까 ? '이하 → 재확인' : '초과 → 할 일 없음'})`;
}

async function 메인(argv) {
  const 값 = (이름) => { const i = argv.indexOf(이름); return i >= 0 ? argv[i + 1] : undefined; };
  const 뿌리들 = argv.flatMap((a, i) => (a === '--뿌리' && argv[i + 1] ? [path.resolve(argv[i + 1])] : []));
  const r = await 만료확인({
    뿌리들: 뿌리들.length ? 뿌리들 : [기본뿌리()], 오늘: 값('--오늘') || 오늘KST(), 문턱: 값('--문턱') ? Number(값('--문턱')) : 기본문턱,
    공개본: !argv.includes('--저장소만'),
  });
  if (argv.includes('--json')) { console.log(JSON.stringify(r, null, 1)); return; }
  console.log(한줄(r));
  if (r.공개본?.오류) console.log(`공개본 못 읽음: ${r.공개본.오류}`);
  for (const s of r.저장소) console.log(s.오류 ? `저장소 ${s.뿌리}: 못 읽음 — ${s.오류}` : `저장소 ${s.뿌리}: 확인일 ${s.확인일} · 달력 끝 ${s.through}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  메인(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exitCode = 1; });
}
