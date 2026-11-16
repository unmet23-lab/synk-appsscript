// 솔리오 「방문자 분석」(2026-11-17)의 결론 한 문장과 다섯 줄을 요약 한 장에서 만든다. DOM이 없다.
// 요약은 이 PC의 모으기 도구(tools/사이트방문/모으기.js)가 쓰고 desktop/src/site-visits.cjs가 읽는다. 꼴은 tools/사이트방문/요약.js 머리 주석.
// 무엇을 보일지는 docs/마케팅/사이트방문_분석/설계.md 6절이 정한다. 모습(오브제와 방)은 검정 구 시안이 정한다.
// 화면 글은 처음 읽는 사람이 한 번에 알아듣게 쓰고, GEO · SEO 같은 말을 쓰지 않는다.
import { josa } from './solio-today.mjs';

export const SITE_VISITS_NAME = '방문자 분석';
const STOP_DAYS = 3; // 마지막 방문 기록이 이보다 오래면 결론에서 「끊겼다」를 먼저 말한다
const DAY = 864e5;

const num = n => Number(n || 0).toLocaleString('ko-KR');
const pct = r => (r == null ? null : `${Math.round(r * 100)}%`);
/** 'M월 D일'(이 PC의 시각) */
export function monthDay(iso) {
  const d = new Date(iso);
  return Number.isFinite(+d) ? `${d.getMonth() + 1}월 ${d.getDate()}일` : '';
}
/** 'M월 D일 HH:MM' */
export function stamp(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(+d)) return '';
  return `${monthDay(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
/** 지난 기간 대비: 「지난주보다 3번 늘었습니다」 */
function versus(now, before, unit = '번', word = '지난주') {
  if (before == null) return null;
  const d = now - before;
  if (d === 0) return `${josa(word, ['과', '와'])} 같습니다`;
  return `${word}보다 ${num(Math.abs(d))}${unit} ${d > 0 ? '늘었습니다' : '줄었습니다'}`;
}
const ready = section => section && section.상태 === '됨';
/** 칸이 「됨」이 아닐 때 줄에 보일 상태와 한 줄 */
function notReady(section, fallback) {
  const state = ['측정 전', '등록 전', '권한 기다림'].includes(section?.상태) ? 'before' : 'unread';
  return { state, value: section?.상태 || '확인 안 함', note: section?.까닭 || fallback };
}

function visitsLine(s) {
  const v = s.방문;
  const base = { key: 'from', title: '어디서 왔나' };
  if (!ready(v)) return { ...base, ...notReady(v, '방문 기록을 아직 읽지 못했습니다.'), detail: [], daily: [] };
  const groups = v.갈래.map(g => `${g.이름} ${num(g.수)}`).join(' · ');
  const detail = [`들어온 곳 갈래: ${groups}`];
  if (v.들어온곳?.length) detail.push(`들어온 곳: ${v.들어온곳.map(x => `${x.이름} ${num(x.수)}`).join(', ')}`);
  if (v.첫쪽?.length) detail.push(`처음 연 쪽: ${v.첫쪽.map(x => `${x.이름} ${num(x.수)}`).join(', ')}`);
  if (ready(s.목적) && s.목적.고른칸?.length) detail.push(`홈에서 고른 사업: ${s.목적.고른칸.map(x => `${x.이름} ${num(x.수)}`).join(', ')}`);
  detail.push('구글 AI 모드와 네이버 AI 브리핑에서 온 방문은 들어온 주소가 검색과 같아 「검색」으로 셉니다.');
  if (v.까닭) detail.push(v.까닭); // 낡은 값이거나 켠 지 7일이 안 됐다는 한 줄
  return { ...base, state: v.낡음 ? 'stale' : 'ok', value: `사람 방문 ${num(v.사람)}번`, note: versus(v.사람, v.앞사람), detail, daily: (v.날마다 || []).map(d => d.수) };
}

function pagesLine(s) {
  const p = s.쪽;
  const base = { key: 'pages', title: '어디를 보고 어디서 나갔나' };
  if (!ready(p)) return { ...base, ...notReady(p, '방문 기록을 아직 읽지 못했습니다.'), detail: [] };
  if (!p.쪽들?.length) return { ...base, state: 'ok', value: '본 쪽이 없습니다', note: null, detail: [] };
  const detail = p.쪽들.map(x => {
    const parts = [`${num(x.본수)}번 봄`];
    if (x.머문시간) parts.push(`머문 시간은 대개 ${x.머문시간}`);
    if (x.끝까지 != null) parts.push(`끝까지 내린 비율 ${pct(x.끝까지)}`);
    if (x.떠남비율 != null) parts.push(`여기서 사이트를 떠난 비율 ${pct(x.떠남비율)}`);
    if (x.떠남비율 == null && x.떠남수 < 5) parts.push('떠난 기록이 적어 비율은 아직 셈하지 않습니다');
    return `${x.이름}: ${parts.join(', ')}`;
  });
  return { ...base, state: p.낡음 ? 'stale' : 'ok', value: p.쪽들.slice(0, 3).map(x => x.이름).join(' · '), note: null, detail };
}

function actionsLine(s) {
  const a = s.행동;
  const base = { key: 'actions', title: '문의와 앱 받기' };
  if (!ready(a)) return { ...base, ...notReady(a, '방문 기록을 아직 읽지 못했습니다.'), detail: [] };
  const split = group => group.나눔.filter(x => x.수 > 0).map(x => `${x.이름.replace(/^앱 받기\((.+)\)$/, '$1')} ${num(x.수)}`).join(', ');
  const detail = [];
  if (a.문의.합) detail.push(`문의: ${split(a.문의)}`);
  if (a.앱받기.합) detail.push(`앱 받기: ${split(a.앱받기)}`);
  if (a.문의비율 != null && a.문의.합) detail.push(`사람 방문 대비 문의 ${pct(a.문의비율)}`);
  if (a.앱받기비율 != null && a.앱받기.합) detail.push(`사람 방문 대비 앱 받기 ${pct(a.앱받기비율)}`);
  for (const x of a.처음들어온곳별 || []) detail.push(`${josa(x.갈래, ['으로', '로'])} 들어온 방문에서 문의 ${num(x.문의)}번, 앱 받기 ${num(x.앱받기)}번`);
  detail.push('누른 수입니다. 문의가 실제로 접수됐는지는 이 숫자에 들어 있지 않습니다.');
  return { ...base, state: a.낡음 ? 'stale' : 'ok', value: `문의 ${num(a.문의.합)}번 · 앱 받기 ${num(a.앱받기.합)}번`, note: null, detail };
}

function searchLine(s) {
  const g = s.검색.구글, n = s.검색.네이버;
  const base = { key: 'search', title: '검색에 나오는 정도' };
  const naver = n.상태 === '등록됨' ? '네이버: 등록돼 있습니다. 노출 숫자는 네이버가 내보내지 않아 아직 재지 않습니다.' : `네이버: ${n.까닭 || n.상태}`;
  if (!ready(g)) return { ...base, ...notReady(g, '구글 서치콘솔을 아직 읽지 못했습니다.'), detail: [naver] };
  const detail = [`구글: ${monthDay(g.시작 + 'T00:00:00')}부터 ${monthDay(g.끝 + 'T00:00:00')}까지(검색 숫자는 2~3일 늦게 들어옵니다)`];
  if (g.평균순위 != null) detail.push(`평균 순위 ${g.평균순위}위${g.앞?.평균순위 != null ? `(그 앞 28일 ${g.앞.평균순위}위)` : ''}`);
  if (g.검색어?.length) detail.push(`많이 나온 검색어: ${g.검색어.map(x => `${x.말} ${num(x.노출)}번`).join(', ')}`);
  if (g.쪽?.length) detail.push(`많이 나온 쪽: ${g.쪽.map(x => `${x.쪽} ${num(x.노출)}번`).join(', ')}`);
  detail.push(naver);
  if (g.낡음) detail.push(g.까닭);
  return { ...base, state: g.낡음 ? 'stale' : 'ok', value: `구글 노출 ${num(g.노출)}번 · 클릭 ${num(g.클릭)}번`, note: versus(g.클릭, g.앞?.클릭, '번', '그 앞 28일'), detail };
}

function aiLine(s) {
  const a = s.AI;
  const base = { key: 'ai', title: 'AI에게 물으면' };
  if (!ready(a)) return { ...base, ...notReady(a, '첫 회차를 아직 재지 않았습니다.'), detail: [] };
  const before = name => a.앞회차?.서비스?.find(x => x.이름 === name) || null;
  const detail = a.서비스.map(x => {
    const prev = before(x.이름);
    const head = `${x.이름}${x.설명 ? `(${x.설명})` : ''}`;
    const main = `일반 질문 ${num(x.답받음)}개 가운데 ${num(x.언급)}개에서 SYNK를 말했고, synk.im을 출처로 단 답은 ${num(x.인용)}개입니다.`;
    return `${head}: ${main}${prev ? ` 지난 회차에는 ${num(prev.언급)}개였습니다.` : ''}`;
  });
  const brand = a.서비스.filter(x => x.브랜드답받음).map(x => `${x.이름} ${num(x.브랜드인용)}/${num(x.브랜드답받음)}`);
  if (brand.length) detail.push(`SYNK를 직접 물은 질문에서 synk.im을 출처로 단 답: ${brand.join(', ')}`);
  if (a.AI방문 != null) detail.push(`지난 7일 AI 답변에서 온 사람 방문 ${num(a.AI방문)}번`);
  for (const [name] of Object.entries(a.멈춤 || {})) detail.push(`${josa(name, ['은', '는'])} 이번 회차 중간에 막혀 일부 질문만 물었습니다.`);
  detail.push(`${monthDay(a.회차날 + 'T00:00:00')}에 물은 값입니다. AI 앱 화면에서 사람이 물을 때와 다를 수 있습니다.`);
  // 두 서비스는 재는 길이 달라(Claude는 웹 검색, Gemini는 검색 없이 기억) 합치지 않고 따로 보인다.
  return { ...base, state: 'ok', value: `SYNK가 나온 답 ${a.서비스.map(x => `${x.이름} ${num(x.언급)}/${num(x.답받음)}`).join(' · ')}`, note: null, detail };
}

/** 결론 한 문장 */
function conclusion(s, now) {
  const v = s.방문, a = s.행동, g = s.검색.구글;
  if (ready(v)) {
    const last = Date.parse(v.마지막기록 || '');
    if (!Number.isFinite(last) || now - last > STOP_DAYS * DAY) {
      return Number.isFinite(last)
        ? `방문 기록이 ${monthDay(v.마지막기록)} 뒤로 끊겼습니다. 사이트의 방문 세기가 멈췄는지 확인이 필요합니다.`
        : '방문 기록이 아직 한 줄도 없습니다. 사이트의 방문 세기가 도는지 확인이 필요합니다.';
    }
    if (!v.사람) return '지난 7일 동안 사이트에 들어온 사람이 없습니다.';
    const acts = ready(a) ? [a.문의.합 ? `문의를 ${num(a.문의.합)}번` : null, a.앱받기.합 ? `앱 받기를 ${num(a.앱받기.합)}번` : null].filter(Boolean) : [];
    if (acts.length) return `지난 7일 동안 사람이 ${num(v.사람)}번 들어왔고, ${acts.join(', ')} 눌렀습니다.`;
    const quiet = v.갈래.filter(x => (x.이름 === '검색' || x.이름 === 'AI 답변') && x.수 === 0).map(x => x.이름);
    return `지난 7일 동안 사람이 ${num(v.사람)}번 들어왔고, 문의와 앱 받기는 아직 없습니다.${quiet.length === 2 ? ' 검색과 AI 답변으로는 아직 오지 않습니다.' : ''}`;
  }
  if (ready(g)) return `사이트 방문은 아직 ${v?.상태 === '측정 전' ? '재기 전' : '읽지 못했'}입니다. 구글 검색에는 최근 28일 동안 ${num(g.노출)}번 보였고 ${num(g.클릭)}번 눌렸습니다.`;
  const ai = s.AI;
  if (ready(ai) && ai.서비스?.length) {
    const web = ai.서비스.find(x => x.이름 === 'Claude') || ai.서비스[0];
    return `사이트 방문 숫자는 아직 없습니다. 웹 검색을 켠 ${web.이름}에게 일반 질문 ${num(web.답받음)}개를 물었더니 SYNK를 말한 답은 ${num(web.언급)}개였습니다.`;
  }
  return '아직 모은 숫자가 없습니다. 아래 줄마다 까닭을 적었습니다.';
}

/**
 * 요약 → 화면에 보일 것.
 * @param result desktop/src/site-visits.cjs snapshot()의 답
 * @returns { visible, conclusion, lines[{key,title,state:'ok'|'stale'|'before'|'unread',value,note,detail[],daily?}], collectedAt, stale, problem }
 */
export function siteVisitsView(result, now = Date.now()) {
  if (!result || result.available !== true) return { visible: false };
  if (!result.ok || !result.summary) {
    return { visible: true, conclusion: '모은 숫자를 읽지 못했습니다. 모으기 도구가 다시 쓰면 저절로 보입니다.', lines: [], collectedAt: '', stale: false, problem: result?.code || 'UNREADABLE' };
  }
  const s = result.summary;
  const made = Date.parse(s.만든때);
  const stale = !Number.isFinite(made) || now - made > 2 * DAY;
  let head = conclusion(s, now);
  if (stale && Number.isFinite(made)) head = `${monthDay(s.만든때)} 뒤로 숫자를 새로 모으지 못했습니다. ${head}`;
  return {
    visible: true,
    conclusion: head,
    lines: [visitsLine(s), pagesLine(s), actionsLine(s), searchLine(s), aiLine(s)],
    collectedAt: stamp(s.만든때),
    stale,
    problem: null,
  };
}

/** 화면 읽기 프로그램용 한 줄 */
export function lineSpeech(line) {
  return [line.title, line.value, line.note].filter(Boolean).join(', ');
}
