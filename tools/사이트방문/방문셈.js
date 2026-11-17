'use strict';
/**
 * 방문 기록 시트의 줄을 센다(네트워크 없음). 숫자는 이 코드만 센다.
 *
 *  - 시트를 읽을 때 날짜는 일련번호(valueRenderOption=UNFORMATTED_VALUE · dateTimeRenderOption=SERIAL_NUMBER)로 받는다.
 *    일련번호는 시트 시간대(한국)의 벽시계라서 시간대분(기본 540분)을 빼야 실제 시각이 된다.
 *  - 「사람 방문」은 들어옴 줄 가운데 들어온 곳이 「SYNK 안」이 아니고 「다시 연 쪽」(새로 고침 · 뒤로·앞으로)이 아닌 줄이다(사이트에 들어온 횟수).
 *  - 설문지 주소와 칸 번호는 공개 코드에 있어 누구나 줄을 넣을 수 있다. 그래서 읽을 때 칸마다 허용 목록으로 다시 거르고,
 *    목록 밖 줄은 버린 수만 센다(11-17 Fable 설계 검토 P2-4). 하루 줄 수가 갑자기 뛰면 「급증」으로 알린다.
 *  - 「지난 7일」은 한국 날짜 7칸(오늘 포함)이다. 합과 날마다 막대가 같은 줄을 센다.
 *    같은 사람이 여러 번 오면 여러 번이다 — 사람을 잇는 번호를 보내지 않는다.
 *  - 「본 쪽」은 들어옴 줄 전부다.
 * 설계: docs/마케팅/사이트방문_분석/설계.md 5절.
 */
const 값 = require('./값.js');

const 하루 = 24 * 60 * 60 * 1000;

/** 시트 일련번호(또는 「2026. 11. 16 오후 10:40:40」 꼴 글)를 실제 시각(ms)으로. 못 읽으면 null. */
function 시각읽기(v, 시간대분 = 540) {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round((v - 25569) * 하루) - 시간대분 * 60000;
  const s = String(v || '').trim();
  const m = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s+(오전|오후)\s+(\d{1,2}):(\d{2}):(\d{2})$/.exec(s);
  if (m) {
    let h = Number(m[5]) % 12;
    if (m[4] === '오후') h += 12;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], h, +m[6], +m[7]) - 시간대분 * 60000;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

/** 실제 시각 → 한국 날짜 'YYYY-MM-DD' */
function 한국날(ms, 시간대분 = 540) {
  return new Date(ms + 시간대분 * 60000).toISOString().slice(0, 10);
}

/** 시트 값(2차원 배열, 첫 줄이 머리) → 머리 이름을 열쇠로 한 줄들 */
function 줄들읽기(values) {
  const rows = Array.isArray(values) ? values : [];
  if (!rows.length) return [];
  // 설문지에 이은 시트의 첫 칸은 「타임스탬프」다. 머리 글이 비어 오면(gviz 따위) 그 이름으로 읽는다.
  const 머리 = rows[0].map((h, i) => String(h || '').trim() || (i === 0 ? '타임스탬프' : ''));
  return rows.slice(1).map((r) => Object.fromEntries(머리.map((h, i) => [h, r[i] == null ? '' : r[i]])));
}

const 글 = (v) => String(v == null ? '' : v).trim();

/** 방문 기록 칸(「기록」)에 든 JSON 한 줄의 열쇠 — 사이트 쪽 세기 코드(site-v10/visit-count.js)와 같다 */
const 열쇠들 = Object.freeze(['판', '기록', '쪽', '쪽 언어', '들어온 곳', '들어온 곳 이름', '처음 들어온 곳', '기기', '꼬리표', '머문 시간', '내려 본 곳', '다음', '누른 것', '다시 연 쪽']);
const 판들 = Object.freeze(['visit-v1']);

/**
 * 방문 기록 시트의 한 줄 → 정리한 줄. 셀 줄이 아니면 null, 허용 목록 밖이면 { 버림: 까닭 }.
 * 설문지에는 질문이 「기록」 하나뿐이고 값은 JSON 한 줄이다(칸을 더해도 설문지를 고치지 않게 — 보기 글이 다르면 설문지가 조용히 버리는 일을 피한다).
 * 시트 줄은 { 타임스탬프, 기록: '{"판":"visit-v1","기록":"들어옴",…}', 빼기? }.
 * @param 옵션.세는쪽 이 목록이 있으면 쪽이 그 안이어야 한다
 */
function 방문줄(r, 시간대분 = 540, 옵션 = {}) {
  if (글(r['빼기'])) return null;
  let j;
  try { j = JSON.parse(글(r['기록'])); } catch { return { 버림: 'JSON이 아님' }; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return { 버림: 'JSON이 아님' };
  const 값읽기 = (k) => (typeof j[k] === 'string' ? j[k] : '');
  const 판 = 값읽기('판');
  if (!판들.includes(판)) return { 버림: '판' };
  const 꼬리표 = 값읽기('꼬리표');
  if (꼬리표 && !값.꼬리표꼴.test(꼬리표)) return { 버림: '꼬리표' };
  if (값.뺄꼬리표.includes(꼬리표)) return null;
  const 시각 = 시각읽기(r['타임스탬프'], 시간대분);
  if (시각 == null) return { 버림: '시각' };
  const 줄 = {
    시각, 판, 꼬리표,
    기록: 값읽기('기록'),
    쪽: 값읽기('쪽'),
    쪽언어: 값읽기('쪽 언어'),
    들어온곳: 값읽기('들어온 곳'),
    들어온곳이름: 값읽기('들어온 곳 이름'),
    처음들어온곳: 값읽기('처음 들어온 곳') || 값읽기('들어온 곳'),
    기기: 값읽기('기기'),
    머문시간: 값읽기('머문 시간'),
    내려본곳: 값읽기('내려 본 곳'),
    다음: 값읽기('다음'),
    누른것: 값읽기('누른 것'),
    다시연쪽: 값읽기('다시 연 쪽'),
  };
  const 안 = (v, 목록, 빈칸 = false) => (빈칸 && v === '') || 목록.includes(v);
  const 들어온곳들 = Object.keys(값.갈래표);
  if (!Object.values(값.기록).includes(줄.기록)) return { 버림: '기록' };
  if (옵션.세는쪽 ? !옵션.세는쪽.includes(줄.쪽) : !/^\/[a-z0-9/_.-]{0,79}$/.test(줄.쪽)) return { 버림: '쪽' };
  if (!안(줄.쪽언어, 값.쪽언어)) return { 버림: '쪽 언어' };
  if (!안(줄.들어온곳, 들어온곳들)) return { 버림: '들어온 곳' };
  if (!안(줄.들어온곳이름, 값.들어온곳이름, true)) return { 버림: '들어온 곳 이름' };
  if (!안(줄.처음들어온곳, 들어온곳들)) return { 버림: '처음 들어온 곳' };
  if (!안(줄.기기, 값.기기)) return { 버림: '기기' };
  if (!안(줄.다시연쪽, 값.다시연쪽, true)) return { 버림: '다시 연 쪽' };
  if (줄.기록 === 값.기록.떠남 && !(값.머문시간.includes(줄.머문시간) && 값.내려본곳.includes(줄.내려본곳) && Object.values(값.다음).includes(줄.다음))) return { 버림: '떠남 칸' };
  if (줄.기록 === 값.기록.누름 && !값.누른것.includes(줄.누른것)) return { 버림: '누른 것' };
  return 줄;
}

/** 시트의 줄들 → { 줄들, 버림(목록 밖 줄 수), 버림까닭 } */
function 방문줄들(rows, 시간대분 = 540, 옵션 = {}) {
  const 줄들 = [], 까닭 = new Map();
  for (const r of rows) {
    const x = 방문줄(r, 시간대분, 옵션);
    if (!x) continue;
    if (x.버림) { 까닭.set(x.버림, (까닭.get(x.버림) || 0) + 1); continue; }
    줄들.push(x);
  }
  return { 줄들, 버림: [...까닭.values()].reduce((a, b) => a + b, 0), 버림까닭: Object.fromEntries(까닭) };
}

function 세기(목록, 열쇠) {
  const m = new Map();
  for (const x of 목록) { const k = 열쇠(x); if (k == null || k === '') continue; m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].map(([이름, 수]) => ({ 이름, 수 })).sort((a, b) => b.수 - a.수 || String(a.이름).localeCompare(String(b.이름)));
}

/** 차례 있는 구간들의 가운데 구간(떠남 줄 수가 짝수면 아래쪽 가운데). 없으면 null. */
function 가운데구간(목록, 차례) {
  const 순 = 목록.map((v) => 차례.indexOf(v)).filter((i) => i >= 0).sort((a, b) => a - b);
  if (!순.length) return null;
  return 차례[순[Math.floor((순.length - 1) / 2)]];
}

const 비율 = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 1000 : null);

/** 사람 방문인가 — 들어옴 줄이고, 사이트 안에서 옮겨 온 것도 새로 고침 · 뒤로 가기로 다시 연 것도 아니다 */
const 사람방문인가 = (r) => r.기록 === 값.기록.들어옴 && r.들어온곳 && r.들어온곳 !== 'SYNK 안' && !r.다시연쪽;

/** 들어온 곳 줄 → 솔리오에 보일 들어온 곳 이름(검색 · AI는 서비스 이름, 나머지는 들어온 곳 그대로) */
function 들어온곳표시(r) {
  if ((r.들어온곳 === '검색' || r.들어온곳 === 'AI 답변') && r.들어온곳이름) return r.들어온곳이름;
  return r.들어온곳;
}

/**
 * 방문 기록 줄(방문줄로 정리한 것)들 → 요약의 방문 · 쪽 · 행동 칸.
 * @param 옵션.지금 Date · 옵션.날수(기본 7) · 옵션.시간대분(기본 540) · 옵션.켠날 · 옵션.버림(목록 밖이라 버린 줄 수)
 */
function 방문셈(줄들, 옵션 = {}) {
  const 지금 = +(옵션.지금 || new Date());
  const 날수 = 옵션.날수 || 7;
  const 시간대분 = 옵션.시간대분 ?? 540;
  // 한국 날짜로 자른다: 오늘 0시(한국)에서 날수-1일 앞이 시작이다. 그 앞 같은 길이가 앞 기간이다.
  const 오늘0시 = Date.parse(`${한국날(지금, 시간대분)}T00:00:00Z`) - 시간대분 * 60000;
  const 끝 = 지금, 시작 = 오늘0시 - (날수 - 1) * 하루, 앞시작 = 시작 - 날수 * 하루;
  const 이번 = 줄들.filter((r) => r.시각 >= 시작 && r.시각 < 끝);
  const 앞 = 줄들.filter((r) => r.시각 >= 앞시작 && r.시각 < 시작);
  const 마지막 = 줄들.reduce((m, r) => Math.max(m, r.시각), 0);

  const 사람 = 이번.filter(사람방문인가);
  const 갈래수 = new Map(값.갈래차례.map((g) => [g, 0]));
  for (const r of 사람) { const g = 값.갈래표[r.들어온곳]; if (g) 갈래수.set(g, 갈래수.get(g) + 1); }

  const 날마다 = [];
  for (let i = 날수 - 1; i >= 0; i--) {
    const 날 = 한국날(지금 - i * 하루, 시간대분);
    날마다.push({ 날, 수: 사람.filter((r) => 한국날(r.시각, 시간대분) === 날).length });
  }

  // 하루 줄 수가 앞 7일 평균의 5배(그리고 20줄)를 넘으면 급증 — 남이 공개 설문지에 줄을 넣었을 수 있다
  const 하루줄 = (날) => 줄들.filter((r) => 한국날(r.시각, 시간대분) === 날).length;
  const 오늘 = 한국날(지금, 시간대분);
  const 앞날들 = Array.from({ length: 7 }, (_, i) => 하루줄(한국날(지금 - (i + 1) * 하루, 시간대분)));
  const 앞평균 = 앞날들.reduce((a, b) => a + b, 0) / 7;
  const 오늘줄 = 하루줄(오늘);
  const 급증 = 오늘줄 > Math.max(20, 앞평균 * 5) ? { 날: 오늘, 줄: 오늘줄, 앞평균: Math.round(앞평균 * 10) / 10 } : null;

  // 켠 지 7일이 안 됐으면 그 앞은 센 적이 없다 — 앞 7일과 견주지 않고, 화면에 켠 날을 밝힌다
  const 켠때 = 옵션.켠날 ? Date.parse(`${옵션.켠날}T00:00:00+09:00`) : null;
  const 덜참 = 켠때 != null && 켠때 > 시작;
  const 방문 = {
    상태: '됨', 까닭: 덜참 ? `방문 기록은 ${Number(옵션.켠날.slice(5, 7))}월 ${Number(옵션.켠날.slice(8, 10))}일에 켰습니다. 그 앞은 세지 않았습니다.` : null,
    켠날: 옵션.켠날 || null,
    마지막기록: 마지막 ? new Date(마지막).toISOString() : null,
    사람: 사람.length,
    앞사람: 켠때 != null && 켠때 > 앞시작 ? null : 앞.filter(사람방문인가).length,
    본쪽: 이번.filter((r) => r.기록 === 값.기록.들어옴).length,
    갈래: 값.갈래차례.map((이름) => ({ 이름, 수: 갈래수.get(이름) })),
    들어온곳: 세기(사람, 들어온곳표시).slice(0, 6),
    첫쪽: 세기(사람, (r) => r.쪽).slice(0, 3).map(({ 이름, 수 }) => ({ 쪽: 이름, 이름: 값.쪽이름(이름), 수 })),
    날마다,
    AI방문: 갈래수.get('AI 답변'),
    다시연쪽: 이번.filter((r) => r.기록 === 값.기록.들어옴 && r.다시연쪽).length,
    버림: 옵션.버림 || 0,
    급증,
  };

  // 쪽: 본 수 많은 차례로 다섯. 비율은 떠남 줄이 5개 넘는 쪽만.
  const 들어옴 = 이번.filter((r) => r.기록 === 값.기록.들어옴);
  const 떠남 = 이번.filter((r) => r.기록 === 값.기록.떠남);
  const 쪽들 = 세기(들어옴, (r) => r.쪽).slice(0, 5).map(({ 이름: 쪽, 수: 본수 }) => {
    const 이쪽떠남 = 떠남.filter((r) => r.쪽 === 쪽);
    const 충분 = 이쪽떠남.length >= 5;
    return {
      쪽, 이름: 값.쪽이름(쪽), 본수, 떠남수: 이쪽떠남.length,
      머문시간: 충분 ? 가운데구간(이쪽떠남.map((r) => r.머문시간), 값.머문시간) : null,
      끝까지: 충분 ? 비율(이쪽떠남.filter((r) => r.내려본곳 === '끝까지').length, 이쪽떠남.length) : null,
      떠남비율: 충분 ? 비율(이쪽떠남.filter((r) => r.다음 && r.다음 !== 값.다음.안).length, 이쪽떠남.length) : null,
    };
  });
  const 쪽 = { 상태: '됨', 까닭: null, 쪽들 };

  // 행동: 누름 줄을 뜻 묶음으로
  const 누름 = 이번.filter((r) => r.기록 === 값.기록.누름 && 값.누른것.includes(r.누른것));
  const 묶음 = (이름들) => {
    const 줄 = 누름.filter((r) => 이름들.includes(r.누른것));
    return { 합: 줄.length, 나눔: 이름들.map((이름) => ({ 이름, 수: 줄.filter((r) => r.누른것 === 이름).length })) };
  };
  const 문의 = 묶음(값.문의묶음), 앱받기 = 묶음(값.앱받기묶음);
  const 처음들어온곳별 = 값.갈래차례.map((갈래) => {
    const 이갈래 = (r) => 값.갈래표[r.처음들어온곳] === 갈래;
    return {
      갈래,
      문의: 누름.filter((r) => 이갈래(r) && 값.문의묶음.includes(r.누른것)).length,
      앱받기: 누름.filter((r) => 이갈래(r) && 값.앱받기묶음.includes(r.누른것)).length,
    };
  }).filter((x) => x.문의 || x.앱받기);
  const 행동 = {
    상태: '됨', 까닭: null, 문의, 앱받기,
    // 비율은 사람 방문이 기준을 넘을 때만 — 분자는 누른 횟수라 방문이 적으면 한 사람의 손놀림이 큰 비율로 보인다
    문의비율: 사람.length >= 값.비율기준 ? 비율(문의.합, 사람.length) : null,
    앱받기비율: 사람.length >= 값.비율기준 ? 비율(앱받기.합, 사람.length) : null,
    처음들어온곳별,
  };
  return { 방문, 쪽, 행동 };
}

/**
 * 홈 「어떤 일로 오셨어요?」 시트(설문지 「synk.im 방문 목적(익명)」)의 줄 → 요약의 목적 칸.
 * 셈은 시트 「요약」 탭과 같다: 방문 = 칸을 고름 + 고르지 않고 내려감, 고른 방문 = 칸을 고름 + 내려갔다가 칸을 고름.
 * 꼬리표 qa · launch-check · self와 「빼기」 칸에 글이 있는 줄은 뺀다.
 */
function 목적셈(줄들, 옵션 = {}) {
  const 지금 = +(옵션.지금 || new Date());
  const 날수 = 옵션.날수 || 7;
  const 시간대분 = 옵션.시간대분 ?? 540;
  const 시작 = 지금 - 날수 * 하루;
  const 줄 = 줄들.map((r) => ({ 시각: 시각읽기(r['타임스탬프'], 시간대분), 결정: 글(r['결정']), 칸: 글(r['고른 칸']), 꼬리표: 글(r['링크 꼬리표']).toLowerCase(), 빼기: 글(r['빼기']) }))
    .filter((r) => r.시각 != null && r.시각 >= 시작 && r.시각 < 지금 && !r.빼기 && !값.뺄꼬리표.includes(r.꼬리표));
  const 방문 = 줄.filter((r) => r.결정 === '칸을 고름' || r.결정 === '고르지 않고 내려감').length;
  const 고른 = 줄.filter((r) => (r.결정 === '칸을 고름' || r.결정 === '내려갔다가 칸을 고름') && r.칸);
  return { 상태: '됨', 까닭: null, 방문, 고른방문: 고른.length, 고른칸: 세기(고른, (r) => r.칸) };
}

module.exports = { 하루, 열쇠들, 판들, 시각읽기, 한국날, 줄들읽기, 방문줄, 방문줄들, 방문셈, 목적셈, 가운데구간, 세기, 비율 };
