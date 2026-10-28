'use strict';
/**
 * 수요 스캔 — 계산만 하는 부분(네트워크·파일 없음). tests/수요스캔.test.js가 이 파일을 그대로 부른다.
 *
 * 튄 편(10-22 규칙, docs/마케팅/시청자수요조사_20261022.md 머리말):
 *   A — 그 채널 최근 쇼츠 조회 중앙값(쇼츠 탭 맨 앞 30편)의 3배 이상이고 조회가 브랜드 하한 이상
 *   B — 작은 채널(구독 3만 이하)에서 조회 ≥ 구독(그리고 하한 이상)
 *   두 규칙 모두 쇼츠가 5편 이상 있어야 잰다(평소가 없으면 「못 잼」). 중앙값·배수 계산은 tools/lib/평소배수.js를 그대로 쓴다.
 *   우리 계정 판정(tools/게시성과.js)의 배수는 최근 12편 기준이다 — 남의 채널 수요 스캔은 10-22 조사와 같게 30편이다.
 *
 * 누적(tools/수요스캔/누적/수요_<브랜드>.json)에는 채널·편 ID·숫자·날짜만 둔다. 제목·댓글·설명은 넣지 않는다.
 */
const { median, multiple } = require('../lib/평소배수.js');

const 브랜드목록 = ['lab-en', 'lab-mn', 'synkbrief', 'yuhobuilds'];
const 누적판 = 1;
const 하루 = 86_400_000;

const 기본 = Object.freeze({
  판정: Object.freeze({ 배수: 3, 최소조회: 3000, 작은채널구독상한: 30000, 작은채널최소조회: 3000, 기준편수: 30, 최소편수: 5 }),
  틱톡판정: Object.freeze({ 배수: 3, 최소조회: 10000, 기준편수: 30, 최소편수: 5 }),
  검색: Object.freeze({ 회차당: 6, 필터: '', 붙임: '', 결과수: 20, 찾기상한: 5, 찾은채널상한: 30 }),
  창: 28, // 이 날수 안에 올라온 편을 판정한다(지난 회차에 평소 수준이던 편이 이번에 3배를 넘으면 그것도 새 튄 편)
  여유: 7, // 누적은 창 + 여유 날수만 기억한다 — 창보다 옛 편은 다시 후보가 될 수 없어서(누적을 작게)
  보관일: 35, // 누적에 편 날짜를 기억하는 날수(창 + 여유)
  // 쇼츠 탭(기준선·구독·최근 30편 조회)을 다시 읽는 간격. 정책(2차 검수 GA4): 매 회차(7일) 읽는다. 탭을 건너뛰는 주에는 RSS(최신
  // 15편) 밖으로 밀린 편의 조회가 안 바뀌어 뒤늦게 튄 편을 놓친다 — 튄 편 찾기의 핵심이라 호출 하나를 아끼지 않는다. 10-23에 탭
  // 읽기는 16번 모두 됐다. 막힘이 잦으면 --기준선 14로 늘린다(그때 최신 15편 밖의 늦게 튄 편은 탭을 읽는 주에만 본다).
  기준선갱신일: 7,
  쇼츠상한초: 180, // 이보다 긴 영상은 튄 편으로 싣지 않는다(검색·영상 정보·틱톡 모두, 재확인 B5)
  댓글편수: 5,
  댓글개수: 30,
  우리댓글편수: 6, // 우리 유튜브 계정의 창 안 최근 편 가운데 댓글을 읽을 편 수(10-28 — 기획 근거 A의 재료)
  상세상한: 40, // 영상 정보(길이·날짜·좋아요)를 읽는 편 수. 넘친 편은 길이 없이 보이고 다음 회차에 다시 나온다
  요약표상한: 40, // 요약.md 표에 보이는 줄 수(요약.json에는 다 있다)
});

/** 유튜브 검색 필터(sp). 10-23 실측: 「이번 주·이번 달」 거르기는 조회 수십 회짜리 새 영상만 주고, 조회순 정렬은 더는 듣지 않는다
 * — 그래서 기본은 거르기 없는 관련순(10-22 lab-en rel 방식)이다. 쇼츠 유형(EgIQCQ)은 10-23에 결과 0건이었다. */
const 검색필터 = Object.freeze({
  '': '',
  관련순: '',
  이번주: 'EgQIAxAB',
  이번주짧은: 'EgYIAxABGAE%3D',
  이번달: 'EgQIBBAB',
  이번달짧은: 'EgYIBBABGAE%3D',
});

const 숫자인가 = v => typeof v === 'number' && Number.isFinite(v);
const 날짜만 = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

/** Date·밀리초 → UTC 날짜 'YYYY-MM-DD'(영상 날짜는 yt-dlp upload_date처럼 UTC로 적는다) */
function utc날짜(at) {
  const d = at instanceof Date ? at : new Date(at);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** 서울 날짜 'YYYY-MM-DD'(회차 폴더·잰날) */
function 서울날짜(at = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(at);
}

function 날짜빼기(날짜, 일수) {
  const t = Date.parse(날짜 + 'T00:00:00Z');
  return utc날짜(t - 일수 * 하루);
}

function 날수차(앞, 뒤) {
  const a = Date.parse(String(앞).slice(0, 10) + 'T00:00:00Z');
  const b = Date.parse(String(뒤).slice(0, 10) + 'T00:00:00Z');
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 하루) : null;
}

// ── 설정 ────────────────────────────────────────────────────────────

function 정규식(글, 이름, 오류) {
  if (글 === undefined || 글 === null || 글 === '') return null;
  if (typeof 글 !== 'string') { 오류.push(`${이름}은 글자여야 한다`); return null; }
  try { return new RegExp(글, 'iu'); } catch (e) { 오류.push(`${이름} 정규식이 틀렸다: ${e.message}`); return null; }
}

function 판정값(raw, 바탕, 이름, 오류) {
  const 값 = { ...바탕, ...(raw || {}) };
  for (const [k, v] of Object.entries(값)) {
    if (!(k in 바탕)) 오류.push(`${이름}.${k}는 모르는 칸이다`);
    else if (!숫자인가(v) || v < 0) 오류.push(`${이름}.${k}는 0 이상의 숫자여야 한다`);
  }
  if (!(값.배수 > 0)) 오류.push(`${이름}.배수는 0보다 커야 한다`);
  if (!Number.isInteger(값.기준편수) || !Number.isInteger(값.최소편수) || 값.최소편수 < 1 || 값.기준편수 < 값.최소편수) {
    오류.push(`${이름}.기준편수·최소편수는 1 이상의 정수이고 기준편수 ≥ 최소편수`);
  }
  return 값;
}

/**
 * 브랜드 설정을 검사하고 기본값을 채운다 → {설정, 오류:[...]}. 오류가 하나라도 있으면 스캔하지 않는다.
 */
function 설정검사(raw, 파일브랜드) {
  const 오류 = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { 설정: null, 오류: ['설정이 JSON 객체가 아니다'] };
  const 브랜드 = raw.브랜드;
  if (!브랜드목록.includes(브랜드)) 오류.push(`브랜드 「${브랜드}」는 ${브랜드목록.join('·')} 가운데 하나여야 한다`);
  if (파일브랜드 && 브랜드 !== 파일브랜드) 오류.push(`파일 이름(${파일브랜드})과 브랜드(${브랜드})가 다르다`);
  if (typeof raw.이름 !== 'string' || !raw.이름.trim()) 오류.push('이름이 비었다');
  const 판정 = 판정값(raw.판정, 기본.판정, '판정', 오류);
  const 틱톡판정 = 판정값(raw.틱톡판정, 기본.틱톡판정, '틱톡판정', 오류);

  const 유튜브 = [];
  const 본 = new Set();
  if (!Array.isArray(raw.유튜브) || !raw.유튜브.length) 오류.push('유튜브 채널 목록이 비었다');
  for (const [i, c] of (Array.isArray(raw.유튜브) ? raw.유튜브 : []).entries()) {
    const 자리 = `유튜브[${i}]`;
    if (!c || typeof c !== 'object') { 오류.push(`${자리}가 객체가 아니다`); continue; }
    const id = c.id === undefined ? null : c.id;
    const 핸들 = c.핸들 === undefined ? null : c.핸들;
    if (id !== null && !/^UC[\w-]{22}$/.test(id)) 오류.push(`${자리}.id 「${id}」가 채널 ID 꼴(UC + 22자)이 아니다`);
    if (핸들 !== null && !/^@[^\s/?#@]{2,}$/u.test(핸들)) 오류.push(`${자리}.핸들 「${핸들}」가 @핸들 꼴이 아니다`);
    if (id === null && 핸들 === null) 오류.push(`${자리}에 id도 핸들도 없다`);
    if (c.우리 !== undefined && typeof c.우리 !== 'boolean') 오류.push(`${자리}.우리는 true/false`);
    for (const 키 of [id, 핸들 && 핸들.toLowerCase()].filter(Boolean)) {
      if (본.has(키)) 오류.push(`${자리} 「${키}」가 두 번 나온다`);
      본.add(키);
    }
    유튜브.push({ id, 핸들, 이름: typeof c.이름 === 'string' ? c.이름 : (핸들 || id), 우리: c.우리 === true });
  }

  const 틱톡 = [];
  const 본틱톡 = new Set();
  for (const [i, t] of (Array.isArray(raw.틱톡) ? raw.틱톡 : []).entries()) {
    const 핸들 = typeof t?.핸들 === 'string' ? t.핸들.replace(/^@/, '') : '';
    if (!/^[A-Za-z0-9._]{2,24}$/.test(핸들)) { 오류.push(`틱톡[${i}].핸들 「${t?.핸들}」가 틱톡 핸들 꼴이 아니다`); continue; }
    if (본틱톡.has(핸들.toLowerCase())) 오류.push(`틱톡 「${핸들}」가 두 번 나온다`);
    본틱톡.add(핸들.toLowerCase());
    틱톡.push({ 핸들, 우리: t.우리 === true });
  }
  if (raw.틱톡 !== undefined && !Array.isArray(raw.틱톡)) 오류.push('틱톡은 목록이어야 한다');

  const rs = raw.검색 || {};
  const 어 = Array.isArray(rs.어) ? rs.어 : [];
  if (!어.length) 오류.push('검색.어가 비었다');
  const 본어 = new Set();
  for (const q of 어) {
    if (typeof q !== 'string' || !q.trim()) { 오류.push('검색.어에 빈 글자가 있다'); continue; }
    if (본어.has(q.trim().toLowerCase())) 오류.push(`검색어 「${q}」가 두 번 나온다`);
    본어.add(q.trim().toLowerCase());
  }
  const 필터글 = rs.필터 === undefined ? 기본.검색.필터 : rs.필터;
  let 필터 = null;
  if (typeof 필터글 !== 'string') 오류.push('검색.필터는 글자여야 한다');
  else if (Object.prototype.hasOwnProperty.call(검색필터, 필터글)) 필터 = 검색필터[필터글];
  else if (/^[A-Za-z0-9%_-]{4,40}$/.test(필터글)) 필터 = 필터글;
  else 오류.push(`검색.필터 「${필터글}」를 모른다(${Object.keys(검색필터).filter(Boolean).join('·')} 또는 sp 값)`);
  const 정수칸 = (k, 아래, 위) => {
    const v = rs[k] === undefined ? 기본.검색[k] : rs[k];
    if (!Number.isInteger(v) || v < 아래 || v > 위) 오류.push(`검색.${k}는 ${아래}~${위} 정수`);
    return v;
  };
  const 검색 = {
    어: 어.map(q => String(q).trim()).filter(Boolean),
    필터,
    붙임: typeof rs.붙임 === 'string' ? rs.붙임 : 기본.검색.붙임,
    회차당: 정수칸('회차당', 0, 50),
    결과수: 정수칸('결과수', 1, 50),
    찾기상한: 정수칸('찾기상한', 0, 50),
    찾은채널상한: 정수칸('찾은채널상한', 0, 500),
    주제: 정규식(rs.주제, '검색.주제', 오류),
    제외: 정규식(rs.제외, '검색.제외', 오류),
  };

  // 인스타 릴스 계정(10-28, tools/수요스캔/릴스.js가 ego에서 읽는다) — 핸들만. 판정은 「릴스판정」, 없으면 틱톡판정과 같다
  const 인스타 = [];
  const 본인스타 = new Set();
  if (raw.인스타 !== undefined && !Array.isArray(raw.인스타)) 오류.push('인스타는 목록이어야 한다');
  for (const [i, t] of (Array.isArray(raw.인스타) ? raw.인스타 : []).entries()) {
    const 핸들 = typeof t?.핸들 === 'string' ? t.핸들.replace(/^@/, '') : '';
    if (!/^[A-Za-z0-9._]{1,30}$/.test(핸들)) { 오류.push(`인스타[${i}].핸들 「${t?.핸들}」가 인스타 핸들 꼴이 아니다`); continue; }
    if (본인스타.has(핸들.toLowerCase())) 오류.push(`인스타 「${핸들}」가 두 번 나온다`);
    본인스타.add(핸들.toLowerCase());
    인스타.push({ 핸들 });
  }
  const 릴스판정 = raw.릴스판정 === undefined ? null : 판정값(raw.릴스판정, 기본.틱톡판정, '릴스판정', 오류);

  const 못잼 = [];
  for (const [i, m] of (Array.isArray(raw.못잼) ? raw.못잼 : []).entries()) {
    if (!m || typeof m.곳 !== 'string' || typeof m.계정 !== 'string' || typeof m.까닭 !== 'string') { 오류.push(`못잼[${i}]에 곳·계정·까닭이 다 있어야 한다`); continue; }
    못잼.push({ 곳: m.곳, 계정: m.계정, 까닭: m.까닭 });
  }

  const 설정 = { 브랜드, 이름: raw.이름, 근거: raw.근거 || '', 판정, 틱톡판정, 유튜브, 틱톡, 인스타, ...(릴스판정 ? { 릴스판정 } : {}), 검색, 못잼 };
  return { 설정: 오류.length ? null : 설정, 오류 };
}

// ── 기준선과 튄 편 ──────────────────────────────────────────────────

/** 쇼츠 탭 맨 앞(최신순) 조회수 목록 → {중앙값, 편수}. 숫자가 있는 편만 앞에서 기준편수만큼 쓴다(10-22 views[:30]). */
function 기준선(조회들, 판정 = 기본.판정) {
  const 쓸것 = (조회들 || []).filter(숫자인가).slice(0, 판정.기준편수);
  return { 중앙값: 쓸것.length >= 판정.최소편수 ? median(쓸것) : null, 편수: 쓸것.length };
}

/**
 * 튄 편인가 → null | {규칙:'A'|'B'|'AB', 배수}
 *   기준 = {중앙값, 편수, 구독}. 구독을 모르면(숨김·틱톡) B는 보지 않는다.
 */
function 튄편판정(조회, 기준, 판정 = 기본.판정) {
  if (!숫자인가(조회) || !기준 || !(기준.편수 >= 판정.최소편수)) return null;
  const 배수 = multiple(조회, 기준.중앙값);
  const A = 배수 !== null && 조회 >= 판정.배수 * 기준.중앙값 && 조회 >= 판정.최소조회;
  const 구독 = 기준.구독;
  const B = 숫자인가(구독) && 구독 >= 0 && 구독 <= 판정.작은채널구독상한 && 조회 >= Math.max(구독, 판정.작은채널최소조회);
  if (!A && !B) return null;
  return { 규칙: (A ? 'A' : '') + (B ? 'B' : ''), 배수 };
}

/** 누적의 편 값은 올린 날 하나다(조회는 매주 바뀌어 diff만 키우니 넣지 않는다). 옛 꼴 [날짜, 조회]도 읽는다 */
const 편날짜 = v => 날짜만(Array.isArray(v) ? v[0] : v);

/**
 * 누적에 남길 편 날짜.
 *   쇼츠 탭을 읽은 주(지킬 = 이번 탭의 편 ID): 탭에 아직 있는 편은 모두 남긴다(탭에 남은 옛 히트가 「날짜 모름」 후보로 되살아나
 *   영상 정보를 헛되이 읽지 않게 — 탭은 30편이라 많아야 30개). 그 밖에는 창 + 여유 안의 편만, 새 편부터 최대 개까지(2차 검수 A5:
 *   상한이 탭 속 옛 히트를 먼저 자르지 않게 둘을 따로 센다).
 *   탭을 안 읽은 주(지킬 없음): 덜어 내지 않는다 — 지난 탭 주에 지킨 옛 편을 잃지 않게. 새로 붙는 것은 RSS 편뿐이라 한 주에 15개까지다.
 */
function 편정리(편들, 오늘, 보관일, 지킬 = null, 최대 = 60) {
  const 모두 = Object.entries(편들 || {}).map(([id, v]) => [id, 편날짜(v)]).filter(([, 날짜]) => 날짜);
  const 순 = (a, b) => b[1].localeCompare(a[1]) || a[0].localeCompare(b[0]);
  if (!지킬) return Object.fromEntries(모두.sort(순));
  const 바닥 = 날짜빼기(오늘, 보관일);
  const 탭편 = 모두.filter(([id]) => 지킬.has(id));
  const 창편 = 모두.filter(([id, 날짜]) => !지킬.has(id) && 날짜 >= 바닥).sort(순).slice(0, 최대);
  return Object.fromEntries([...탭편, ...창편].sort(순));
}

/**
 * 유튜브 채널 하나의 증분 판정(계산만). 부르는 쪽이 이번에 읽은 쇼츠 탭·RSS를 넘긴다.
 *   이전: 누적의 그 채널 칸(없으면 undefined)
 *   탭: null(안 읽음·못 읽음) | {구독, 핸들, 편:[{id, 제목, 조회}]}(최신순)
 *   rss: null | {전체수, 편:[{id, 제목, 날짜(ISO), 쇼츠, 조회}]}
 *   튄편: 누적의 이미 보고한 튄 편 {id: …}
 * → {상태, 후보:[{id, 제목, 조회, 날짜|null, 규칙, 배수}], 기준:{중앙값, 편수, 구독, 출처}|null, 창안, 창안편, 본편}
 * 후보는 「창 안(또는 날짜 모름)이고 아직 보고하지 않은 튄 편」이다. 날짜 모름은 부르는 쪽이 영상 정보로 날짜를 확인한다.
 */
function 채널정리({ 이전, 탭, rss, 튄편 = {}, 오늘, 판정 = 기본.판정, 창 = 기본.창, 보관일 = 기본.보관일 }) {
  let 기준 = null;
  const 상태 = { ...(이전 || {}) };
  if (탭 && Array.isArray(탭.편)) {
    const b = 기준선(탭.편.map(p => p.조회), 판정);
    const 구독 = 숫자인가(탭.구독) ? 탭.구독 : (숫자인가(이전?.구독) ? 이전.구독 : null);
    기준 = { 중앙값: b.중앙값, 편수: b.편수, 구독, 출처: '이번' };
    Object.assign(상태, { 구독, 중앙값: b.중앙값, 편수: b.편수, 기준선잰날: 오늘 });
    if (탭.핸들) 상태.핸들 = 탭.핸들;
  } else if (이전 && 숫자인가(이전.편수)) {
    기준 = { 중앙값: 이전.중앙값 ?? null, 편수: 이전.편수, 구독: 숫자인가(이전.구독) ? 이전.구독 : null, 출처: `지난(${이전.기준선잰날 || '?'})` };
  }

  // 조회: 쇼츠 탭은 「26만」 같은 반올림 수, RSS는 정확한 수다. 정확한 수가 있으면 그것을 쓴다 — 큰 쪽을 고르면 반올림으로
  // 3배·최소 조회를 턱걸이로 넘은 편이 튄 편으로 잘못 잡힌다(2차 검수 A1·GA1).
  const 편 = new Map();
  const 넣기 = (id, 값, 정확) => {
    if (typeof id !== 'string' || !id) return;
    const 옛 = 편.get(id) || { id, 제목: '', 조회: null, 정확: false, 날짜: null };
    let { 조회 } = 옛;
    let 이번정확 = 옛.정확;
    if (숫자인가(값.조회)) {
      if (정확 && !옛.정확) { 조회 = 값.조회; 이번정확 = true; }
      else if (정확 === 옛.정확) 조회 = 숫자인가(옛.조회) ? Math.max(옛.조회, 값.조회) : 값.조회;
    }
    편.set(id, { id, 제목: 옛.제목 || 값.제목 || '', 조회, 정확: 이번정확, 날짜: 옛.날짜 || 날짜만(값.날짜) });
  };
  for (const p of (탭?.편 || [])) 넣기(p.id, p, false);
  const rss쇼츠 = (rss?.편 || []).filter(p => p.쇼츠 !== false);
  for (const p of rss쇼츠) 넣기(p.id, p, true);
  const 옛편 = 이전?.편 || {};
  for (const v of 편.values()) {
    if (!v.날짜 && 옛편[v.id]) v.날짜 = 편날짜(옛편[v.id]);
  }

  const 창시작 = 날짜빼기(오늘, 창);
  const rss날짜 = rss쇼츠.map(p => 날짜만(p.날짜)).filter(Boolean).sort();
  // RSS는 최신 15편만 준다. 15편이 다 안 찼거나 가장 옛 편이 창보다 앞이면, RSS에 없는 탭의 편은 모두 창 밖이다.
  const rss덮음 = !!rss && ((rss.전체수 ?? rss쇼츠.length) < 15 || (rss날짜.length > 0 && rss날짜[0] < 창시작));

  const 후보 = [];
  const 창안편 = [];
  let 창안 = 0;
  for (const v of 편.values()) {
    if (v.날짜) {
      if (v.날짜 < 창시작) continue;
      창안 += 1;
      창안편.push({ id: v.id, 날짜: v.날짜, 조회: v.조회 });
    } else if (rss덮음) {
      continue; // 날짜를 모르지만 RSS가 창을 덮었다 — RSS에 없는 편은 창보다 옛 편이다
    }
    // RSS를 못 읽었으면 날짜 모르는 튄 편은 탭의 어느 자리든 날짜 확인 후보다(2차 검수 GA5 — 첫 스캔이면 탭 16번째 뒤도 창 안일 수
    // 있다). 영상 정보로 날짜를 알면 그 편이 탭에 있는 동안 누적이 기억해(편정리) 다음 회차에 다시 묻지 않는다.
    if (Object.prototype.hasOwnProperty.call(튄편, v.id)) continue;
    const 결과 = 튄편판정(v.조회, 기준, 판정);
    // 정확: 조회가 RSS의 정확한 수인가(아니면 탭 반올림 수) — 부르는 쪽이 댓글을 같이 부를지 정할 때 본다(재확인 B3)
    if (결과) 후보.push({ id: v.id, 제목: v.제목, 조회: v.조회, 날짜: v.날짜, 정확: v.정확, ...결과 });
  }

  const 새편 = { ...옛편 };
  for (const v of 편.values()) if (v.날짜) 새편[v.id] = v.날짜;
  상태.편 = 편정리(새편, 오늘, 보관일, 탭 && Array.isArray(탭.편) ? new Set(탭.편.map(p => p.id)) : null);
  후보.sort((a, b) => (b.조회 || 0) - (a.조회 || 0) || a.id.localeCompare(b.id));
  창안편.sort((a, b) => b.날짜.localeCompare(a.날짜) || a.id.localeCompare(b.id));
  return { 상태, 후보, 기준, 창안, 창안편, 본편: 편.size };
}

/**
 * 틱톡 계정 하나(공개 프로필 목록은 편마다 날짜·숫자가 다 있다) → {상태, 후보, 기준, 창안, 창안편, 본편}
 *   목록: [{id, 제목, 조회, 날짜, 길이, 좋아요, 댓글수, 저장, 공유}] — 고정된 옛 편이 앞에 올 수 있어 날짜순으로 다시 세운다.
 */
function 틱톡정리({ 이전, 목록, 튄편 = {}, 오늘, 판정 = 기본.틱톡판정, 창 = 기본.창, 보관일 = 기본.보관일 }) {
  const 편 = (목록 || []).filter(p => p && typeof p.id === 'string' && 날짜만(p.날짜));
  편.sort((a, b) => b.날짜.localeCompare(a.날짜) || a.id.localeCompare(b.id));
  const b = 기준선(편.map(p => p.조회), 판정);
  const 기준 = { 중앙값: b.중앙값, 편수: b.편수, 구독: null, 출처: '이번' };
  const 창시작 = 날짜빼기(오늘, 창);
  const 후보 = [];
  const 창안편 = [];
  let 창안 = 0;
  for (const p of 편) {
    if (p.날짜 < 창시작) continue;
    창안 += 1;
    창안편.push({ id: p.id, 날짜: 날짜만(p.날짜), 조회: 숫자인가(p.조회) ? p.조회 : null });
    if (Object.prototype.hasOwnProperty.call(튄편, p.id)) continue;
    if (숫자인가(p.길이) && p.길이 > 기본.쇼츠상한초) continue; // 3분 넘는 영상은 짧은 영상 수요가 아니다(기준선에는 넣는다)
    const 결과 = 튄편판정(p.조회, 기준, 판정);
    if (결과) 후보.push({ ...p, 날짜: 날짜만(p.날짜), ...결과 });
  }
  // 틱톡 목록은 편마다 날짜가 있어 편 날짜를 기억할 까닭이 없다 — 기준선만 둔다
  const 상태 = { 중앙값: b.중앙값, 편수: b.편수, 잰날: 오늘 };
  후보.sort((a, b2) => (b2.조회 || 0) - (a.조회 || 0) || a.id.localeCompare(b2.id));
  return { 상태, 후보, 기준, 창안, 창안편, 본편: 편.length };
}

/**
 * 시청자가 갈려야 하는 브랜드 짝(10-28 유호님 「반영해」). 10-27까지 synkbrief · yuhobuilds 시드 채널 22곳이 겹쳐 synkbrief 튄 편
 * 145건 가운데 93건이 두 브랜드 공용 채널에서 나왔고, 두 브랜드 후보가 같은 「AI한테 'X' 한 줄」 꼴로 모였다. 한 채널은 한 브랜드의
 * 시드만 되고, 짝 브랜드의 시드 · 찾은 채널은 검색으로 찾아도 들이지 않는다.
 */
const 나눌짝 = Object.freeze({ synkbrief: 'yuhobuilds', yuhobuilds: 'synkbrief' });

const 채널키 = c => [c.id, c.핸들 && String(c.핸들).toLowerCase()].filter(Boolean);

/** 두 설정의 (우리 계정이 아닌) 시드 가운데 겹치는 채널 이름 — 유튜브 ID · 핸들, 틱톡 핸들로 본다 */
function 시드겹침(가, 나) {
  const 나키 = new Set(나.유튜브.filter(c => !c.우리).flatMap(채널키));
  const 나틱톡 = new Set(나.틱톡.filter(t => !t.우리).map(t => t.핸들.toLowerCase()));
  return [
    ...가.유튜브.filter(c => !c.우리 && 채널키(c).some(k => 나키.has(k))).map(c => c.이름 || c.핸들 || c.id),
    ...가.틱톡.filter(t => !t.우리 && 나틱톡.has(t.핸들.toLowerCase())).map(t => `틱톡 @${t.핸들}`),
  ];
}

/** 짝 브랜드가 쥔 유튜브 채널 ID — 짝 설정의 시드(ID, 핸들은 짝 누적에서 ID로) · 짝 누적의 찾은 채널 */
function 남의채널(짝설정, 짝누적) {
  const 나 = new Set();
  if (!짝설정) return 나;
  const 핸들들 = new Set(짝설정.유튜브.map(c => c.핸들 && c.핸들.toLowerCase()).filter(Boolean));
  for (const c of 짝설정.유튜브) if (c.id) 나.add(c.id);
  for (const [id, v] of Object.entries(짝누적?.채널 || {})) if (v?.핸들 && 핸들들.has(String(v.핸들).toLowerCase())) 나.add(id);
  for (const id of Object.keys(짝누적?.찾은채널 || {})) 나.add(id);
  return 나;
}

/** 우리 계정 비교 줄 — 창 안 최근 편과 그 배수(판정은 하지 않는다) */
function 우리줄(곳, 계정, 기준, 창안편, 몇 = 6) {
  return {
    곳, 계정, 기준,
    편: (창안편 || []).slice(0, 몇).map(p => ({ id: p.id, 날짜: p.날짜, 조회: p.조회, 배수: 기준 ? multiple(p.조회, 기준.중앙값) : null })),
  };
}

/** 쇼츠 탭을 이번에 다시 읽어야 하는가 — 기준선(중앙값)이 없거나 갱신일이 지났다. 쇼츠가 5편 안 돼 중앙값을 못 만든 채널도
 * 다음 회차에 다시 읽는다(2차 검수 A2·GA6 — 그사이 5편이 차면 바로 잰다) */
function 탭다시읽기(이전, 오늘, 기준선갱신일 = 기본.기준선갱신일) {
  if (!이전 || !숫자인가(이전.편수) || !숫자인가(이전.중앙값) || !이전.기준선잰날) return true;
  if (기준선갱신일 <= 0) return true;
  const 지난 = 날수차(이전.기준선잰날, 오늘);
  return 지난 === null || 지난 >= 기준선갱신일;
}

/** 영상 정보(상세)를 후보에 덧입힌다 → {줄} | {밖:true}(창 밖으로 드러남) | {아님:true, 까닭}(정확한 숫자·길이로 다시 보니 튄 편이 아님) */
function 상세반영(후보, 상세, 기준, 판정, 창시작) {
  const 날짜 = 날짜만(상세?.날짜) || 후보.날짜 || null;
  if (날짜 && 날짜 < 창시작) return { 밖: true, 날짜 };
  // 3분 넘는 영상은 쇼츠가 아니다 — 쇼츠 RSS가 막혀 채널 RSS로 돌았을 때 일반 영상이 섞일 수 있다(재확인 B5).
  // Data API 길이는 1초 올림이라(꼭 3분인 쇼츠가 181초로 온다) 1초 봐준다(10-25)
  const 상한 = 기본.쇼츠상한초 + (상세?.길이출처 === 'api' ? 1 : 0);
  if (숫자인가(상세?.길이) && 상세.길이 > 상한) return { 아님: true, 날짜, 까닭: `${상세.길이}초 — 쇼츠가 아니다` };
  // 영상 정보의 조회가 정확한 수다 — 있으면 그것으로 다시 판정한다(탭 반올림 수와 큰 쪽을 고르지 않는다, 2차 검수 A1·GA1)
  const 조회 = 숫자인가(상세?.조회) ? 상세.조회 : (숫자인가(후보.조회) ? 후보.조회 : null);
  const 구독 = 숫자인가(상세?.구독) ? 상세.구독 : 기준?.구독;
  const 결과 = 튄편판정(조회, { ...기준, 구독 }, 판정);
  if (!결과) return { 아님: true, 날짜, 까닭: `정확한 조회 ${짧은수(조회)}로 다시 보니 기준 미달` };
  return {
    줄: {
      id: 후보.id, 제목: 상세?.제목 || 후보.제목 || '', 조회, 날짜, 길이: 숫자인가(상세?.길이) ? 상세.길이 : null,
      좋아요: 숫자인가(상세?.좋아요) ? 상세.좋아요 : null, 댓글수: 숫자인가(상세?.댓글수) ? 상세.댓글수 : null,
      구독: 숫자인가(구독) ? 구독 : null, 규칙: 결과.규칙, 배수: 결과.배수,
    },
  };
}

// ── 검색으로 새 채널 찾기 ───────────────────────────────────────────

/** 이번 회차에 돌 검색어(돌려 가며) → {이번:[…], 다음차례} */
function 검색차례(어, 차례, 몇) {
  if (!어.length || !(몇 > 0)) return { 이번: [], 다음차례: 차례 || 0 };
  const 시작 = ((차례 || 0) % 어.length + 어.length) % 어.length;
  const 이번 = [];
  for (let i = 0; i < Math.min(몇, 어.length); i += 1) 이번.push(어[(시작 + i) % 어.length]);
  return { 이번, 다음차례: (시작 + 이번.length) % 어.length };
}

/** 검색어에 붙임말(예: " shorts")을 붙인다 — 이미 그 낱말이 있으면 그대로 */
function 검색글(어, 붙임) {
  const 말 = String(붙임 || '').trim();
  if (!말 || 어.toLowerCase().includes(말.toLowerCase())) return 어;
  return `${어} ${말}`;
}

/**
 * 검색 결과에서 아직 모르는 채널을 고른다 → [{채널id, 채널이름, 최고조회, 영상:[…], 검색어}](최고조회 큰 순, 찾기상한까지)
 *   결과: [{id, 제목, 조회, 길이, 채널id, 채널이름, 검색어}]
 *   쇼츠(3분 이하)이고 조회가 하한 이상인 편이 있는 채널만. 주제(제목)·제외(채널 이름) 정규식을 건다.
 */
function 새채널고르기(결과, 아는채널, 검색, 판정) {
  const 모음 = new Map();
  for (const r of 결과 || []) {
    if (!r || !r.채널id || 아는채널.has(r.채널id)) continue;
    if (!숫자인가(r.길이) || r.길이 > 기본.쇼츠상한초 || !숫자인가(r.조회) || r.조회 < 판정.최소조회) continue;
    if (검색.주제 && !검색.주제.test(r.제목 || '')) continue;
    if (검색.제외 && 검색.제외.test(r.채널이름 || '')) continue;
    const c = 모음.get(r.채널id) || { 채널id: r.채널id, 채널이름: r.채널이름 || '', 최고조회: 0, 영상: [], 검색어: r.검색어 };
    c.최고조회 = Math.max(c.최고조회, r.조회);
    if (!c.영상.some(v => v.id === r.id)) c.영상.push({ id: r.id, 조회: r.조회, 길이: r.길이 });
    모음.set(r.채널id, c);
  }
  return [...모음.values()].sort((a, b) => b.최고조회 - a.최고조회 || a.채널id.localeCompare(b.채널id)).slice(0, 검색.찾기상한);
}

/** 찾은 채널 목록을 상한 안으로(최근에 튄 편이 난 채널·최근에 찾은 채널을 남긴다) */
function 찾은채널정리(찾은, 상한) {
  const 줄 = Object.entries(찾은 || {});
  if (줄.length <= 상한) return { ...(찾은 || {}) };
  줄.sort((a, b) => String(b[1].마지막튐 || '').localeCompare(String(a[1].마지막튐 || ''))
    || String(b[1].찾은날 || '').localeCompare(String(a[1].찾은날 || '')) || a[0].localeCompare(b[0]));
  return Object.fromEntries(줄.slice(0, 상한));
}

/** 보고한 튄 편 기록을 덜어 낸다 — 올린 날이 창 + 여유보다 옛 편은 다시 후보가 될 수 없으니 기억할 까닭이 없다(날짜가 없으면 잡은날로) */
function 튄편정리(튄편, 오늘, 보관일 = 기본.보관일) {
  const 바닥 = 날짜빼기(오늘, 보관일);
  return Object.fromEntries(Object.entries(튄편 || {}).filter(([, v]) => (v.날짜 || v.잡은날 || '') >= 바닥));
}

/**
 * 보고와 다시 보기(재확인 B2·GB3):
 *   새 튄 편은 날짜가 확정된 때 한 번만 싣고 그때 「보고한 편」(누적.튄편)으로 적는다 — 다음 회차에 새 튄 편으로 또 내지 않는다.
 *   그때 길이를 못 읽었으면(상한·막힘·응답에 길이 없음) 튄편 칸에 「보충」을 달고, 다음 회차에 영상 정보를 마저 읽어 요약의
 *   「보충」에 적는다(보충후보). 날짜를 모르는 편은 보고하지 않고 「다시볼」에만 둔다(다시볼정리·다시볼후보) — 날짜가 확인되면
 *   그때 처음 새 튄 편으로 싣는다.
 *
 * 다시볼정리 — 이번 회차의 날짜 모름 유튜브 후보 → {id: {채널, 조회, 날짜:null, 남긴날}}. 처음 남긴 지 보관일이 지나면 버린다.
 */
function 다시볼정리(줄들, 이전, 오늘, 보관일 = 21) {
  const 바닥 = 날짜빼기(오늘, 보관일);
  const 새 = {};
  for (const r of 줄들 || []) {
    if (r.곳 !== '유튜브' || r.날짜 || !r.채널id) continue;
    const 남긴날 = 이전?.[r.id]?.남긴날 || 오늘;
    if (남긴날 < 바닥) continue;
    새[r.id] = { 채널: r.채널id, 조회: 숫자인가(r.조회) ? r.조회 : null, 날짜: null, 남긴날 };
  }
  return 새;
}

/** 보고는 했지만 길이를 못 읽은 편(튄편의 「보충」) → 이번 회차에 영상 정보를 마저 읽을 후보(창 안·채널 기준선 있음, 조회 많은 순) */
function 보충후보(튄편, 채널들, 창시작) {
  const 후보 = [];
  for (const [id, v] of Object.entries(튄편 || {})) {
    if (v.곳 !== '유튜브' || !v.보충 || !v.날짜 || v.날짜 < 창시작) continue;
    const 칸 = (채널들 || {})[v.채널];
    if (!칸 || !숫자인가(칸.편수)) continue;
    const 기준 = { 중앙값: 칸.중앙값 ?? null, 편수: 칸.편수, 구독: 숫자인가(칸.구독) ? 칸.구독 : null, 출처: `지난(${칸.기준선잰날 || '?'})` };
    후보.push({ id, 제목: '', 조회: 숫자인가(v.조회) ? v.조회 : null, 날짜: v.날짜, 정확: false, 채널id: v.채널, 핸들: 칸.핸들 || null, 기준, 보고한날: v.잡은날 || null });
  }
  return 후보.sort((a, b) => (b.조회 || 0) - (a.조회 || 0) || a.id.localeCompare(b.id));
}

/** 다시볼 목록 → 이번 회차 후보(누적의 그 채널 기준선으로 다시 판정, 창 밖·튄 편 아님·이미 보고한 편은 뺀다) */
function 다시볼후보(다시볼, 채널들, 튄편, 판정 = 기본.판정, 창시작) {
  const 후보 = [];
  for (const [id, d] of Object.entries(다시볼 || {})) {
    if (Object.prototype.hasOwnProperty.call(튄편 || {}, id)) continue;
    const 칸 = (채널들 || {})[d.채널];
    if (!칸 || !숫자인가(칸.편수)) continue;
    const 날짜 = 편날짜(칸.편?.[id]) || d.날짜 || null;
    if (날짜 && 날짜 < 창시작) continue;
    const 조회 = 숫자인가(d.조회) ? d.조회 : null;
    const 기준 = { 중앙값: 칸.중앙값 ?? null, 편수: 칸.편수, 구독: 숫자인가(칸.구독) ? 칸.구독 : null, 출처: `지난(${칸.기준선잰날 || '?'})` };
    const 결과 = 튄편판정(조회, 기준, 판정);
    if (결과) 후보.push({ id, 제목: '', 조회, 날짜, 정확: false, ...결과, 채널id: d.채널, 핸들: 칸.핸들 || null, 기준 });
  }
  return 후보;
}

// ── 댓글 ────────────────────────────────────────────────────────────

// 전화번호 꼴: 2~4자리 묶음을 공백·점·하이픈으로 이은 것(국가 번호·괄호 지역 번호 가능) 또는 붙여 쓴 9~15자리.
// 숫자가 9~15자리일 때만 가린다 — 날짜(2026.10.23)·소수·천 단위 수(1,234,567)는 그대로 둔다(2차 검수 GA3).
const 전화꼴 = /(?<![\w.])(?:\+\d{1,3}[ .-]?)?(?:\(\d{1,4}\)[ .-]?)?\d{2,4}(?:[ .-]\d{2,4}){1,4}(?!\w)|(?<![\w.])\+?\d{9,15}(?!\w)/g;

/** 남의 이름·연락처가 섞이지 않게 가린다 — 메일, 링크, @언급(앞 글자가 한글·키릴이어도, 2차 검수 A4), 전화번호 꼴 */
function 가리기(글) {
  return String(글 || '')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[메일]')
    .replace(/https?:\/\/\S+/gi, '[링크]')
    .replace(/@[\p{L}\p{N}_.\-·]{2,}/gu, '@…')
    .replace(전화꼴, m => { const 수 = m.replace(/\D/g, '').length; return 수 >= 9 && 수 <= 15 ? '[번호]' : m; })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * yt-dlp 댓글 → 본문만 남긴 목록(좋아요 많은 순). 쓴 사람 이름·아이디·사진·주소와 댓글 ID는 담지 않는다.
 *   → [{글, 좋아요, 고정, 채널주인}]  (답글은 뺀다)
 */
function 댓글줄이기(댓글들, 개수 = 기본.댓글개수) {
  const 줄 = [];
  for (const c of 댓글들 || []) {
    if (!c || (c.parent !== undefined && c.parent !== null && c.parent !== 'root')) continue;
    const 글 = 가리기(c.text).slice(0, 500);
    if (!글) continue;
    줄.push({ 글, 좋아요: 숫자인가(c.like_count) ? c.like_count : 0, 고정: c.is_pinned === true, 채널주인: c.author_is_uploader === true });
  }
  줄.sort((a, b) => Number(b.고정) - Number(a.고정) || b.좋아요 - a.좋아요);
  return 줄.slice(0, 개수);
}

// ── 글로 보이기 ─────────────────────────────────────────────────────

/** 10-22 보고서 꼴의 짧은 수 — 697 · 2.6천 · 4.7만 · 1,102만 · 1.2억 */
function 짧은수(n) {
  if (!숫자인가(n)) return '—';
  const 떼기 = x => x.toFixed(1).replace(/\.0$/, '');
  if (n < 1000) return String(Math.round(n));
  if (n < 10000) return `${떼기(n / 1000)}천`;
  if (n < 1e8) {
    const 만 = n / 1e4;
    return 만 >= 100 ? `${Math.round(만).toLocaleString('en-US')}만` : `${떼기(만)}만`;
  }
  return `${떼기(n / 1e8)}억`;
}

function 배수글(v) {
  return 숫자인가(v) ? `×${v.toFixed(v >= 10 ? 0 : 1)}` : '—';
}

/** 기획 근거로 바로 옮겨 적는 한 줄 — 「7Sakz7p-ERY(1,102만 · ×93 · 2026-09-20 · 13초)」 */
function 인용글(줄) {
  const 칸 = [짧은수(줄.조회)];
  if (숫자인가(줄.배수)) 칸.push(배수글(줄.배수));
  if (String(줄.규칙 || '').includes('B') && 숫자인가(줄.구독)) 칸.push(`구독 ${짧은수(줄.구독)}`);
  if (숫자인가(줄.저장)) 칸.push(`저장 ${짧은수(줄.저장)}`);
  칸.push(줄.날짜 || '날짜 못 잼');
  칸.push(숫자인가(줄.길이) ? `${줄.길이}초` : '길이 못 잼');
  return `${줄.id}(${칸.join(' · ')})`;
}

const 표칸 = s => String(s ?? '').replace(/\|/g, '｜').replace(/\s+/g, ' ').trim();

/** 요약.md에 보일 제목 — 해시태그를 걷고 60자까지(요약.json에는 원래 제목 그대로) */
function 제목다듬기(제목, 길이 = 60) {
  const t = 표칸(String(제목 ?? '').replace(/#[^\s#]+/gu, ' '));
  const 글자 = [...t];
  return 글자.length > 길이 ? `${글자.slice(0, 길이 - 1).join('').trim()}…` : t;
}

function 표(머리, 줄들) {
  return [
    `| ${머리.join(' | ')} |`,
    `|${머리.map(() => '---').join('|')}|`,
    ...줄들.map(칸 => `| ${칸.map(표칸).join(' | ')} |`),
  ].join('\n');
}

/** 요약.json → 사람이 읽는 요약.md */
function 요약글(요약) {
  const 글 = [];
  글.push(`# 수요 스캔 · ${요약.날짜}`);
  글.push('');
  글.push(`> **튄 편** = ${요약.규칙}`);
  글.push(`> 숫자는 ${요약.날짜}(서울)에 읽은 값이다. 읽기만 했다(로그인·게시·좋아요·댓글·구독 없음, 영상 파일 받지 않음). 댓글은 본문만 모았고 쓴 사람은 적지 않았다.`);
  글.push('> 근거로 옮길 때는 「인용」 줄을 그대로 쓴다(영상 ID · 조회 · 배수 · 게시 날짜 · 길이).');
  for (const b of 요약.브랜드순 || Object.keys(요약.브랜드 || {})) {
    const s = 요약.브랜드[b];
    if (!s) continue;
    글.push('');
    글.push(`## ${s.이름}`);
    글.push('');
    const p = s.표본 || {};
    const 유 = p.유튜브 || {};
    const 틱 = p.틱톡 || {};
    const 검 = p.검색 || {};
    글.push(`창 ${s.창.부터} ~ ${s.창.까지}${s.지난스캔 ? ` · 지난 스캔 ${String(s.지난스캔).slice(0, 10)}` : ' · 첫 스캔'} · 유튜브 ${유.읽음 ?? 0}/${유.대상 ?? 0}채널(쇼츠 ${유.편 ?? 0}편, 창 안 ${유.창안 ?? 0}편${유.api ? `, Data API로 ${유.api}곳` : ''}${유.지난기준선 ? `, 지난 기준선 ${유.지난기준선}곳` : ''}${유.rss멈춤 ? ', RSS가 막혀 일부는 쇼츠 탭으로만' : ''}) · 틱톡 ${틱.읽음 ?? 0}/${틱.대상 ?? 0}계정(${틱.편 ?? 0}편) · 검색 ${(검.어 || []).length}개(쇼츠 ${검.쇼츠 ?? 0}편, 새 채널 ${검.새채널 ?? 0}곳)`);
    if (s.누적) 글.push(`\n누적: ${s.누적}.`);
    if (s.회차 > 1) 글.push(`\n같은 날 ${s.회차}번째 회차다 — 앞 회차에 실은 새 튄 편·보충은 합쳐 두었고, 표본·못 잰 곳은 이번 회차 것이다.`);
    const 새 = s.새튄편 || [];
    const 보임 = 새.slice(0, 기본.요약표상한);
    const 하한 = s.하한 ? ` · 최소 조회 유튜브 ${짧은수(s.하한.유튜브)}(작은 채널 ${짧은수(s.하한.작은채널)}) · 틱톡 ${짧은수(s.하한.틱톡)}` : '';
    글.push('');
    글.push(`### 새 튄 편 ${새.length}편${하한}`);
    글.push('');
    if (!새.length) 글.push('이번 창에는 새로 튄 편이 없다.');
    else {
      글.push(표(['곳', '영상 ID', '날짜', '조회', '배수', '길이', '채널(구독)', '제목'], 보임.map(r => [
        r.곳, r.id, r.날짜 || '못 잼', 짧은수(r.조회), r.규칙 === 'B' && !숫자인가(r.배수) ? '작은 채널' : 배수글(r.배수) + (r.규칙 === 'B' ? '(B)' : ''),
        숫자인가(r.길이) ? `${r.길이}초` : (r.상세 === '상한' ? '—' : '못 잼'), `${표칸(r.채널)}(${짧은수(r.구독)})`, 제목다듬기(r.제목),
      ])));
      if (새.length > 보임.length) 글.push(`\n나머지 ${새.length - 보임.length}편은 요약.json에 있다(조회 순으로 ${보임.length}편만 보였다).`);
      const 알림 = [];
      if (보임.some(r => r.규칙 === 'B')) 알림.push('(B) = 작은 채널(구독 3만 이하)에서 조회가 구독보다 많아 튄 편으로 본 것');
      if (보임.some(r => !숫자인가(r.길이) && r.상세 === '상한')) 알림.push('길이 「—」 = 영상 정보 상한을 넘어 이번에 안 읽은 편(다음 회차에 길이를 읽어 「보충」에 적는다)');
      if (보임.some(r => !숫자인가(r.길이) && r.상세 !== '상한')) 알림.push('길이 「못 잼」 = 영상 정보를 못 읽었거나 길이가 없던 편(다음 회차에 다시 읽어 「보충」에 적는다)');
      if (알림.length) 글.push(`\n${알림.join(' · ')}.`);
      글.push('');
      글.push('인용:');
      for (const r of 보임) 글.push(`- ${r.인용} — ${표칸(r.채널)} 「${제목다듬기(r.제목)}」 ${r.주소}`);
    }
    const 보충 = s.보충 || [];
    if (보충.length) {
      글.push('');
      글.push(`### 지난 목록 보충 ${보충.length}편(앞 회차에 길이 없이 실은 편 — 새로 뜬 편이 아니다)`);
      for (const r of 보충) {
        글.push(r.고침
          ? `- ${r.id} — ${r.고침}(처음 실은 날 ${r.보고한날 || '?'}) · 근거에서 뺀다`
          : `- ${r.인용} — ${표칸(r.채널)} · 처음 실은 날 ${r.보고한날 || '?'}`);
      }
    }
    const 댓 = 새.filter(r => r.댓글 && r.댓글.읽은수 > 0);
    if (댓.length) {
      글.push('');
      글.push('### 좋아요 많은 댓글(본문만)');
      for (const r of 댓) {
        글.push('');
        글.push(`- **${r.id}** ${제목다듬기(r.제목, 40)} — 댓글 ${숫자인가(r.댓글수) ? `${짧은수(r.댓글수)}개 중 ` : ''}${r.댓글.읽은수}개 읽음 · \`${r.댓글.파일}\``);
        for (const c of r.댓글.위 || []) 글.push(`  - (${짧은수(c.좋아요)}${c.고정 ? ' · 고정' : ''}${c.채널주인 ? ' · 채널 주인' : ''}) ${c.글.slice(0, 140)}`);
      }
    }
    if ((s.날짜모름 || []).length) {
      글.push('');
      글.push('### 날짜를 확인 못 한 후보(근거로 쓰지 않는다 — 다음 회차에 다시 본다)');
      for (const r of s.날짜모름) 글.push(`- ${r.곳} ${r.id} · 조회 ${짧은수(r.조회)} · ${배수글(r.배수)} · ${표칸(r.채널)} — ${r.까닭}`);
    }
    if ((s.우리 || []).length) {
      글.push('');
      글.push('### 우리 계정(비교용 — 판정은 tools/게시성과.js)');
      for (const u of s.우리) {
        const 편들 = (u.편 || []).map(x => `${x.id} ${x.날짜} ${짧은수(x.조회)}(${배수글(x.배수)})`).join(' · ');
        글.push(`- ${u.곳} ${u.계정} — ${u.기준 ? `최근 ${u.기준.편수}편 중앙 ${짧은수(u.기준.중앙값)}` : '기준 못 잼'}${편들 ? ` · 창 안 ${편들}` : ''}${u.까닭 ? ` · ${u.까닭}` : ''}`);
        for (const d of u.댓글 || []) {
          글.push(`  - 우리 편 댓글 **${d.id}** — ${숫자인가(d.댓글수) ? `${짧은수(d.댓글수)}개 중 ` : ''}${d.읽은수}개 읽음 · \`${d.파일}\``);
          for (const c of d.위 || []) 글.push(`    - (${짧은수(c.좋아요)}${c.고정 ? ' · 고정' : ''}${c.채널주인 ? ' · 채널 주인' : ''}) ${c.글.slice(0, 140)}`);
        }
      }
    }
    if ((s.못잼 || []).length) {
      글.push('');
      글.push(`### 못 잰 곳 ${s.못잼.length}`);
      for (const m of s.못잼) 글.push(`- ${m.곳} ${m.계정} — ${m.까닭}`);
    }
  }
  글.push('');
  return 글.join('\n');
}

/**
 * 같은 날 회차를 브랜드마다 나눠 돌려도 요약 하나로 모은다. 같은 날 같은 브랜드를 다시 돌리면 앞 회차에 실은 새 튄 편·보충을
 * 지키고 이번 것을 더한다(재확인 GB1 — 앞 회차에 실은 편은 보고한 편이라 다음 회차에 다시 안 나오니, 바꿔 끼우면 영영 사라진다).
 * 표본·못 잰 곳·우리 계정은 이번 회차 것으로 둔다.
 */
function 요약합치기(이전, 새것) {
  const 브랜드 = { ...(이전?.브랜드 || {}) };
  const 같은날 = Boolean(이전?.날짜) && 이전.날짜 === 새것.날짜;
  const 합 = (가, 나) => {
    const m = new Map();
    for (const r of [...(가 || []), ...(나 || [])]) if (r && r.id) m.set(r.id, { ...(m.get(r.id) || {}), ...r });
    return [...m.values()].sort((a, b) => (b.조회 || 0) - (a.조회 || 0) || String(a.id).localeCompare(String(b.id)));
  };
  for (const [b, s] of Object.entries(새것.브랜드 || {})) {
    const 옛 = 브랜드[b];
    if (!같은날 || !옛) { 브랜드[b] = s; continue; }
    const 새튄편 = 합(옛.새튄편, s.새튄편);
    const 실린 = new Set(새튄편.map(r => r.id));
    브랜드[b] = { ...s, 새튄편, 보충: 합(옛.보충, s.보충), 날짜모름: (s.날짜모름 || []).filter(r => !실린.has(r.id)), 회차: (옛.회차 || 1) + 1 };
  }
  return { ...새것, 브랜드, 브랜드순: 브랜드목록.filter(b => b in 브랜드) };
}

// ── 누적 파일 쓰기 ──────────────────────────────────────────────────

/** 사람이 diff로 볼 수 있게 — 숫자·글만 든 작은 배열·객체는 한 줄로 */
function 줄맞춰(값, 들여 = 0) {
  const 칸 = ' '.repeat(들여 + 2);
  const 끝 = ' '.repeat(들여);
  const 원시 = v => v === null || ['string', 'number', 'boolean'].includes(typeof v);
  if (원시(값)) return JSON.stringify(값);
  if (Array.isArray(값)) {
    if (!값.length) return '[]';
    const 한줄 = `[${값.map(v => JSON.stringify(v)).join(', ')}]`;
    if (값.every(원시) && 한줄.length <= 160) return 한줄;
    return `[\n${값.map(v => 칸 + 줄맞춰(v, 들여 + 2)).join(',\n')}\n${끝}]`;
  }
  const 줄 = Object.entries(값).filter(([, v]) => v !== undefined);
  if (!줄.length) return '{}';
  const 한줄 = `{ ${줄.map(([k, v]) => `${JSON.stringify(k)}: ${줄맞춰(v, 들여 + 2)}`).join(', ')} }`;
  if (줄.every(([, v]) => 원시(v) || (Array.isArray(v) && v.every(원시))) && 한줄.length <= 160) return 한줄;
  return `{\n${줄.map(([k, v]) => `${칸}${JSON.stringify(k)}: ${줄맞춰(v, 들여 + 2)}`).join(',\n')}\n${끝}}`;
}

function 빈누적(브랜드) {
  return { 판: 누적판, 브랜드, 마지막스캔: null, 검색차례: 0, 채널: {}, 틱톡: {}, 찾은채널: {}, 튄편: {}, 다시볼: {} };
}

/** 읽은 누적을 검사한다 — 판이 다르거나 꼴이 틀리면 빈 누적으로(덮지 않고 부르는 쪽이 알린다) */
function 누적검사(raw, 브랜드) {
  if (!raw || typeof raw !== 'object' || raw.판 !== 누적판 || raw.브랜드 !== 브랜드) return { 누적: 빈누적(브랜드), 새로: true };
  const 누적 = { ...빈누적(브랜드), ...raw };
  for (const k of ['채널', '틱톡', '찾은채널', '튄편', '다시볼']) if (!누적[k] || typeof 누적[k] !== 'object' || Array.isArray(누적[k])) 누적[k] = {};
  return { 누적, 새로: false };
}

module.exports = {
  브랜드목록, 기본, 검색필터, 누적판,
  설정검사, 기준선, 튄편판정, 채널정리, 틱톡정리, 우리줄, 탭다시읽기, 상세반영, 나눌짝, 시드겹침, 남의채널,
  검색차례, 검색글, 새채널고르기, 찾은채널정리, 튄편정리, 다시볼정리, 다시볼후보, 보충후보,
  가리기, 댓글줄이기, 짧은수, 배수글, 인용글, 제목다듬기, 요약글, 요약합치기,
  줄맞춰, 빈누적, 누적검사, utc날짜, 서울날짜, 날짜빼기, 날수차,
};
