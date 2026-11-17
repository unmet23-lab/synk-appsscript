// 솔리오 「방문자 분석」(2026-11-17)의 결론과 다섯 줄을 요약 한 장에서 만든다. DOM이 없다.
// 요약은 이 PC의 모으기 도구(tools/사이트방문/모으기.js)가 쓰고 desktop/src/site-visits.cjs가 읽는다. 꼴은 tools/사이트방문/요약.js 머리 주석.
// 무엇을 보일지는 docs/마케팅/사이트방문_분석/설계.md 6절, 모습은 검정 구 시안(docs/디자인/플랫폼_클라이언트_검정구_20261116/검정구.html의 VIS · buildVis)이 정한다.
// 돌려주는 꼴은 시안의 VIS와 같다: { say, then, when, scope, rows:[{ key, nm, mid, val, when, now?, unread?, more:[['say',글] | ['row',이름,가운데,큰 숫자,앞 기간] | ['week',이름,[7],큰 숫자] | ['note',글]] }] }.
// 여기서 나오는 글에는 요약에서 온 글(구글 검색어, 까닭 문장)이 섞인다. 화면은 모두 textContent로만 넣는다 — innerHTML에 넣지 않는다(11-17 Fable 설계 검토 P2-5).
// 화면 글은 처음 읽는 사람이 한 번에 알아듣게 쓰고, GEO · SEO 같은 말을 쓰지 않는다.
import { josa } from './solio-today.mjs';

export const SITE_VISITS_NAME = '방문자 분석';
export const SUPPORTED_SUMMARY = 1;
const STOP_DAYS = 3; // 마지막 방문 기록이 이보다 오래면 결론에서 「끊겼다」를 먼저 말한다
const STALE_DAYS = 2; // 요약이 이보다 오래면 결론 앞에 그것을 말한다
const DAY = 864e5;
const BEFORE = new Set(['측정 전', '등록 전', '권한 기다림']);
const PAGE_NAMES = { '/': '홈', '/lab/': 'LAB', '/shift/': 'SHIFT', '/pulse/': 'PULSE', '/path/': 'PATH', '/atlas/': '아틀라스', '/founder/': '창업자', '/mn/': '몽골어 홈', '/en/': '영어 홈' };

const num = n => Number(n || 0).toLocaleString('ko-KR');
const pct = r => (r == null || !Number.isFinite(r) ? null : `${Math.round(r * 100)}%`);
/** 요약에서 온 글 — 보이지 않는 글자를 빼고 길이를 줄인다. 화면은 이 글을 글자로만 넣는다. */
const clean = (s, max = 60) => String(s ?? '').replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, '').slice(0, max);
/** 「으로」·「로」만 돌려준다 — 받침이 없거나 ㄹ이면 「로」. 영문은 m · n으로 끝나면, 숫자는 0 · 3 · 6이면 「으로」(검색어 · 갈래 뒤, PC 0.4.96 카본). */
export function ro(word) {
  const last = String(word ?? '').replace(/[^가-힣A-Za-z0-9]+$/, '').slice(-1);
  if (/[가-힣]/.test(last)) { const b = (last.charCodeAt(0) - 0xac00) % 28; return b === 0 || b === 8 ? '로' : '으로'; }
  return /[mnMN036]/.test(last) ? '으로' : '로';
}
const list = (items, f) => (items || []).map(f).filter(Boolean).join(' · ');
const pageName = p => PAGE_NAMES[p] || (typeof p === 'string' && p.startsWith('/en/') && PAGE_NAMES[p.slice(3)] ? `영어 ${PAGE_NAMES[p.slice(3)]}` : clean(p, 40));

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
const dateOnly = ymd => (typeof ymd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일` : '');
const ready = section => section && section.상태 === '됨';
/** 숫자가 아직 없는 칸의 까닭 — 'wait'(읽을 권한을 기다림), 'before'(아직 세기 전 · 등록 전), 'unread'(고장 · 건너뜀) */
const notYet = state => state === '권한 기다림' ? 'wait' : BEFORE.has(state) || !state ? 'before' : 'unread';
/** 줄의 큰 숫자가 되는 칸이 숫자가 아니면 막는다 — safeRow가 그 줄을 「못 읽음」으로 둔다. 빠진 값을 0으로 보이지 않는다(설계 검토 2차 P3-4). */
const isCount = x => typeof x === 'number' && Number.isFinite(x);
function need(...values) { for (const x of values) if (!isCount(x)) throw new Error('MISSING'); }

/** 아직 숫자가 없는 줄 — 숨기지 않고, 큰 숫자 자리에 「측정 전」(고장이면 「못 읽음」), 가운데에 까닭 한 줄 */
function notReadyRow(key, nm, section, fallback, note) {
  const state = section?.상태;
  return { key, nm, mid: clean(section?.까닭 || fallback, 120), val: BEFORE.has(state) || !state ? '측정 전' : '못 읽음', when: '', unread: 1, more: note ? [['note', note]] : [] };
}

const LIMIT_FROM = '4초 안에 떠난 방문, 개인정보 신호(GPC)를 켠 브라우저, 아직 세지 않는 쪽으로 들어온 방문은 세지 않습니다. 「직접」에는 메신저, 메일, 앱 안 브라우저처럼 들어온 주소가 비는 링크가 모두 들어갑니다. 구글과 네이버의 AI 요약에서 온 방문은 검색으로, 들어온 주소를 주지 않는 AI 앱에서 온 방문은 직접으로 잡힙니다.';

function fromRow(s) {
  const v = s.방문, nm = '어디서 왔나';
  if (!ready(v)) return notReadyRow('from', nm, v, '방문 기록을 아직 읽지 못했습니다.', '사이트 전체 방문 기록을 켠 날부터 들어온 곳을 셉니다. 그 앞에는 홈 첫 화면에서 고른 사업만 셌습니다.');
  need(v.사람);
  const groups = [...(v.갈래 || [])].sort((a, b) => b.수 - a.수);
  const more = [];
  const top = (v.들어온곳 || [])[0];
  more.push(['say', top ? `${josa(clean(top.이름, 20), ['에서', '에서'])} 가장 많이 왔습니다. 같은 사람이 여러 번 오면 여러 번으로 셉니다.` : '아직 들어온 사람이 없습니다.']);
  if (v.들어온곳?.length) more.push(['row', '들어온 곳', list(v.들어온곳, x => `${clean(x.이름, 20)} ${num(x.수)}`), '', '']);
  if (v.첫쪽?.length) more.push(['row', '처음 연 쪽', list(v.첫쪽, x => `${pageName(x.쪽)} ${num(x.수)}`), '', '']);
  const days = (v.날마다 || []).map(d => Number(d.수) || 0);
  if (days.length) more.push(['week', '날마다', days, `하루 평균 ${num(Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10)}번`]);
  if (ready(s.목적) && s.목적.고른칸?.length) more.push(['row', '홈에서 고른 사업', list(s.목적.고른칸, x => `${clean(x.이름, 30).replace(/ · .*$/, '')} ${num(x.수)}`), `${num(s.목적.고른방문)}번`, '']);
  const notes = [LIMIT_FROM, '「지난 7일」은 엿새와 오늘 모은 시각까지이고, 「그 앞 7일」도 같은 길이로 셉니다. 날마다 막대의 마지막 칸(오늘)은 하루가 덜 찼습니다.'];
  if (v.다시연쪽) notes.push(`새로 고침이나 뒤로 가기로 다시 연 ${num(v.다시연쪽)}번은 사람 방문에서 뺐습니다.`);
  if (v.버림) notes.push(`목록에 없는 값이 든 기록 ${num(v.버림)}줄은 버렸습니다.`);
  if (v.까닭) notes.push(clean(v.까닭, 120));
  more.push(['note', notes.join(' ')]);
  return { key: 'from', nm, mid: list(groups, g => `${g.이름} ${num(g.수)}`), val: `${num(v.사람)}번`, when: v.앞사람 != null ? `그 앞 7일 ${num(v.앞사람)}번` : '', more };
}

function pagesRow(s) {
  const p = s.쪽, v = s.방문, nm = '어디를 봤나';
  if (!ready(p)) return notReadyRow('pages', nm, p, '방문 기록을 아직 읽지 못했습니다.', '쪽마다 머문 시간과 내려 본 정도는 떠날 때의 기록이 5개 이상 쌓인 쪽부터 보입니다.');
  const pages = p.쪽들 || [];
  const seen = ready(v) ? v.본쪽 : pages.reduce((a, x) => a + (x.본수 || 0), 0);
  need(seen);
  const withRatio = pages.find(x => x.끝까지 != null);
  const more = [['say', withRatio ? `${pageName(withRatio.쪽)}에서는 ${pct(withRatio.끝까지)}가 끝까지 내려 봤고, ${pct(withRatio.떠남비율)}가 여기서 사이트를 떠났습니다.` : '쪽마다 비율은 떠날 때의 기록이 5개 이상 쌓인 쪽부터 보입니다.']];
  for (const x of pages) {
    const has = x.끝까지 != null;
    more.push(['row', pageName(x.쪽), has ? `머문 시간 ${clean(x.머문시간, 20)} · 끝까지 내림 ${pct(x.끝까지)}` : '떠날 때의 기록이 적어 아직 비율을 셈하지 않습니다', `${num(x.본수)}쪽`, has ? `여기서 나감 ${pct(x.떠남비율)}` : '']);
  }
  more.push(['note', '떠날 때의 기록이 5개 안 되는 쪽은 비율을 보이지 않습니다. 머문 시간은 쪽이 처음 가려질 때(다른 탭으로 옮길 때 포함)까지입니다. 앱 안 브라우저는 닫을 때 신호가 없어 여기서 나간 비율이 낮게 잡힐 수 있습니다.']);
  const per = ready(v) && v.사람 > 0 ? `사람 한 번에 ${num(Math.round((seen / v.사람) * 10) / 10)}쪽` : '';
  return { key: 'pages', nm, mid: pages.length ? list(pages.slice(0, 3), x => `${pageName(x.쪽)} ${num(x.본수)}`) : '본 쪽이 없습니다', val: `${num(seen)}쪽`, when: per, more };
}

function actsRow(s) {
  const a = s.행동, nm = '문의와 앱 받기';
  if (!ready(a)) return notReadyRow('acts', nm, a, '방문 기록을 아직 읽지 못했습니다.', '문의 메일, 문의 양식, 광고 의뢰, 앱 받기 단추를 누른 수를 셉니다.');
  const count = (group, name) => group.나눔?.find(x => x.이름 === name)?.수 || 0;
  need(a.문의?.합, a.앱받기?.합);
  const q = a.문의, d = a.앱받기;
  const firstBy = (a.처음들어온곳별 || []);
  const topQ = [...firstBy].sort((x, y) => y.문의 - x.문의)[0];
  const topD = [...firstBy].sort((x, y) => y.앱받기 - x.앱받기)[0];
  const more = [];
  if (!q.합 && !d.합) more.push(['say', '아직 누른 사람이 없습니다.']);
  else {
    const parts = [];
    // 가장 많은 갈래 하나만 말하므로, 전체 가운데 몇 번인지 함께 말한다(합처럼 읽히지 않게, PC 0.4.96 카본)
    const part = (what, total, top, n) => n === total ? `${what} ${num(total)}번은 모두 ${top}${ro(top)} 들어온 방문에서` : `${what} ${num(total)}번 가운데 ${num(n)}번은 ${top}${ro(top)} 들어온 방문에서`;
    if (topQ?.문의) parts.push(part('문의', q.합, clean(topQ.갈래, 20), topQ.문의));
    if (topD?.앱받기) parts.push(part('앱 받기', d.합, clean(topD.갈래, 20), topD.앱받기));
    more.push(['say', parts.length ? `${parts.join(', ')} 눌렀습니다.` : '누른 방문의 처음 들어온 곳은 아직 갈래가 없습니다.']);
  }
  more.push(['row', '문의', `메일 ${num(count(q, '문의 메일'))} · 주소 복사 ${num(count(q, '문의 메일 주소 복사'))} · 양식 ${num(count(q, '문의 양식'))} · 광고 의뢰 ${num(count(q, '광고 의뢰'))}`, `${num(q.합)}번`, topQ?.문의 ? `${topQ.갈래}에서 ${num(topQ.문의)}` : '']);
  more.push(['row', '앱 받기', `Windows ${num(count(d, '앱 받기(Windows)'))} · Mac ${num(count(d, '앱 받기(Mac)'))}`, `${num(d.합)}번`, topD?.앱받기 ? `${topD.갈래}에서 ${num(topD.앱받기)}` : '']);
  more.push(['note', '누른 수입니다. 한 사람이 여러 번 누르면 여러 번으로 셉니다. 실제로 접수된 문의의 수는 여기서 세지 않습니다. 사람 방문 대비 비율은 사람 방문이 30번 이상일 때부터 보입니다.']);
  const ratio = a.문의비율 != null && a.앱받기비율 != null ? `사람 방문의 ${pct(a.문의비율 + a.앱받기비율)}` : '';
  return { key: 'acts', nm, mid: `문의 ${num(q.합)} · 앱 받기 ${num(d.합)}`, val: `${num(q.합 + d.합)}번`, when: ratio, more };
}

function searchRow(s) {
  const g = s.검색?.구글, n = s.검색?.네이버, nm = '검색에 나오나';
  const naverDone = n?.상태 === '등록됨';
  const naverRow = ['row', '네이버', naverDone ? '등록돼 있습니다. 노출 숫자는 네이버가 내보내지 않아 재지 않습니다.' : '서치어드바이저에 등록하면 등록 상태가 보입니다. 숫자는 네이버가 내보내지 않습니다.', naverDone ? '등록됨' : '등록 전', ''];
  if (!ready(g)) {
    const r = notReadyRow('search', nm, g, '구글 서치콘솔을 아직 읽지 못했습니다.', '구글은 읽기 전용 계정을 이으면 보입니다. 네이버는 서치어드바이저에 등록한 뒤 등록 상태만 보입니다.');
    r.more.unshift(naverRow);
    return r;
  }
  need(g.노출, g.클릭);
  const words = g.검색어 || [], pages = g.쪽 || [];
  const more = [['say', `${words[0] ? `구글에서는 「${clean(words[0].말, 40)}」${ro(clean(words[0].말, 40))} 가장 많이 보였습니다.` : '구글에서 많이 보인 검색어는 아직 없습니다.'} 네이버는 ${naverDone ? '등록돼 있습니다' : '아직 등록 전입니다'}.`]];
  if (words.length) more.push(['row', '많이 보인 검색어', list(words, x => `${clean(x.말, 40)} ${num(x.노출)}`), '', '']);
  if (pages.length) more.push(['row', '많이 보인 쪽', list(pages, x => `${pageName(x.쪽)} ${num(x.노출)}`), '', '']);
  more.push(naverRow);
  const span = dateOnly(g.시작) && dateOnly(g.끝) ? ` ${dateOnly(g.시작)}부터 ${dateOnly(g.끝)}까지입니다.` : '';
  more.push(['note', `검색 숫자는 2~3일 늦게 들어옵니다.${span}${g.낡음 && g.까닭 ? ` ${clean(g.까닭, 120)}` : ''}`]);
  const rank = g.평균순위 != null ? ` · 평균 ${num(Math.round(g.평균순위))}번째` : '';
  return { key: 'search', nm, mid: `구글 지난 28일 · ${num(g.노출)}번 보임${rank}`, val: `${num(g.클릭)}번 눌림`, when: g.앞?.클릭 != null ? `그 앞 28일 ${num(g.앞.클릭)}번` : '', more };
}

function aiRow(s) {
  const a = s.AI, nm = 'AI에게 물으면';
  if (!ready(a) || !a.서비스?.length) return notReadyRow('ai', nm, a, '첫 회차를 아직 재지 않았습니다.', '주 1회 웹 검색을 켠 Claude에게 일반 질문 24개와 SYNK를 묻는 질문 6개를 묻습니다.');
  // 머리 숫자는 웹 검색을 켠 Claude만 — Gemini는 검색 없이 기억으로 답한 값이라 재는 길이 달라 합치지 않는다(검토 P2-11)
  const web = a.서비스.find(x => x.이름 === 'Claude') || a.서비스[0];
  const others = a.서비스.filter(x => x !== web);
  need(web.답받음, web.언급);
  const prev = a.앞회차?.서비스?.find(x => x.이름 === web.이름);
  const prevDay = dateOnly(a.앞회차?.날);
  const prevWhen = prev && prev.답받음 > 0 ? `지난 회차${prevDay ? `(${prevDay})` : ''} ${num(prev.언급)}번` : prev ? '지난 회차도 묻지 못했습니다' : '첫 정기 회차';
  // 머리 숫자를 내는 서비스가 답을 하나도 받지 못했으면(크레딧 · 한도 막힘) 0으로 보이지 않고 「못 물음」으로 둔다(설계 검토 2차 P2-3)
  const asked = web.답받음 > 0;
  const more = [['say', asked ? `웹 검색을 켠 ${josa(web.이름, ['이', '가'])} SYNK를 말한 답은 ${num(web.언급)}번이고, AI 답변을 보고 들어온 사람은 ${a.AI방문 != null ? `${num(a.AI방문)}번` : '아직 세기 전'}입니다.` : `이번 회차에는 웹 검색을 켠 ${web.이름}에게 묻지 못했습니다. 아래 숫자는 다른 길로 물은 값과 지난 회차입니다.`]];
  // 묻지 못한 회차의 출처 줄을 0건처럼 보이지 않는다(PC 0.4.96 Fable 다시 검수 P2)
  const brand = web.브랜드답받음 > 0 ? `SYNK를 묻는 질문 ${num(web.브랜드답받음)}개 가운데 ${num(web.브랜드인용)}` : '';
  more.push(['row', 'synk.im을 출처로 단 답', asked ? `일반 질문 ${num(web.인용)} · ${brand || 'SYNK를 묻는 질문은 묻지 못했습니다'}` : brand ? `일반 질문은 묻지 못했습니다 · ${brand}` : '이번 회차에는 묻지 못했습니다', '', '']);
  for (const x of others) more.push(['row', clean(x.이름, 20), x.답받음 > 0 ? `${clean(x.설명 || '다른 길로 물은 값', 40)} · 일반 질문 ${num(x.답받음)}개 가운데 ${num(x.언급)}개에서 SYNK를 말했습니다` : '이번 회차에는 묻지 못했습니다', '', '']);
  more.push(['row', 'AI 답변에서 온 방문', '지난 7일', a.AI방문 != null ? `${num(a.AI방문)}번` : '측정 전', '']);
  const stopped = Object.keys(a.멈춤 || {}).map(name => `${josa(clean(name, 20), ['은', '는'])} 이번 회차 중간에 막혀 일부 질문만 물었습니다.`);
  more.push(['note', [`${dateOnly(a.회차날)} 회차입니다. 공식 API로 물은 값이라 AI 앱 화면에서 사람이 물을 때와 다를 수 있습니다. 구글과 네이버의 AI 요약에서 온 방문은 검색으로 잡힙니다.`, ...stopped].join(' ')]);
  const otherMid = others.length ? list(others, x => `${clean(x.이름, 20)}(기억) ${x.답받음 > 0 ? num(x.언급) : '못 물음'}`) : '';
  const mid = asked ? `일반 질문 ${num(web.답받음)}개 가운데 ${web.이름} ${num(web.언급)}${otherMid ? ` · ${otherMid}` : ''}` : `${dateOnly(a.회차날)} 회차에 ${web.이름}에게 묻지 못했습니다${otherMid ? ` · ${otherMid}` : ''}`;
  return { key: 'ai', nm, mid, val: asked ? `${num(web.언급)}번 나옴` : '못 물음', when: prevWhen, more };
}

/** 결론 두 마디(say와 흐린 then) */
function conclusion(s, now) {
  const v = s.방문, a = s.행동, g = s.검색?.구글, ai = s.AI;
  const fallback = () => {
    if (ready(g) && isCount(g.노출) && isCount(g.클릭)) return `구글 검색에는 최근 28일 동안 ${num(g.노출)}번 보였고 ${num(g.클릭)}번 눌렸습니다.`;
    const web = ready(ai) && ai.서비스?.length ? ai.서비스.find(x => x.이름 === 'Claude') || ai.서비스[0] : null;
    if (web && web.답받음 > 0) return `웹 검색을 켠 ${web.이름}에게 일반 질문 ${num(web.답받음)}개를 물었더니 SYNK를 말한 답은 ${num(web.언급)}개였습니다.`;
    return '아래 줄마다 까닭을 적었습니다.';
  };
  // 숫자가 없는 칸은 기다리는 것(세기 전 · 권한 기다림)과 고장(못 읽음)을 섞지 않고, 0건처럼 말하지 않는다(PC 0.4.96 원천 검수 B1 · B2)
  if (!ready(v)) return { say: { before: '사이트 방문은 아직 세기 전입니다.', wait: '사이트 방문 기록을 읽을 권한을 기다리는 중입니다.', unread: '사이트 방문 숫자를 아직 읽지 못했습니다.' }[notYet(v?.상태)], then: fallback() };
  if (!isCount(v.사람)) return { say: '사이트 방문 숫자를 아직 읽지 못했습니다.', then: fallback() };
  if (v.급증) {
    // 장부에 남은 급증(처음 본 날이 이번 날과 다름)은 처음 본 날부터 이어진다고 말한다 — 사람이 풀기 전까지 첫 문장에 둔다(설계 검토 3차 P2)
    const since = v.급증.처음날 && v.급증.처음날 !== v.급증.날 ? dateOnly(v.급증.처음날) : '';
    const usual = num(v.급증.평소 ?? v.급증.앞평균);
    return { say: since ? `${since}부터 방문 기록이 평소(하루 ${usual}줄)보다 크게 늘어 있습니다.` : `${dateOnly(v.급증.날) || '오늘'} 방문 기록이 ${num(v.급증.줄)}줄로 평소(하루 ${usual}줄)보다 크게 늘었습니다.`, then: '공개 설문지에 남이 넣은 줄일 수 있어, 숫자를 그대로 믿기 전에 확인이 필요합니다.' };
  }
  const last = Date.parse(v.마지막기록 || '');
  const started = v.켠날 ? Date.parse(`${v.켠날}T00:00:00+09:00`) : NaN;
  if (Number.isFinite(started) && now - started < DAY && !v.사람) return { say: `방문 기록을 ${dateOnly(v.켠날)}부터 모으기 시작했습니다.`, then: '숫자는 하루가 지나면 이 자리에 보입니다.' };
  if (!Number.isFinite(last)) return { say: '방문 기록이 아직 한 줄도 없습니다.', then: '사이트의 방문 세기가 도는지 확인이 필요합니다.' };
  if (now - last > STOP_DAYS * DAY) return { say: `방문 기록이 ${monthDay(v.마지막기록)} 뒤로 끊겼습니다.`, then: '아무도 오지 않았거나 사이트의 방문 세기가 멈췄을 수 있어 확인이 필요합니다.' };
  if (!v.사람) return { say: '지난 7일 동안 사이트에 들어온 사람이 없습니다.', then: fallback() };
  const acts = ready(a) ? [a.문의?.합 ? `문의를 ${num(a.문의.합)}번` : null, a.앱받기?.합 ? `앱 받기를 ${num(a.앱받기.합)}번` : null].filter(Boolean) : [];
  const actsRead = ready(a) && isCount(a.문의?.합) && isCount(a.앱받기?.합);
  const actsMissing = actsRead ? '' : { before: '아직 세기 전입니다', wait: '읽을 권한을 기다리는 중입니다', unread: '아직 읽지 못했습니다' }[ready(a) ? 'unread' : notYet(a?.상태)];
  const say = actsMissing ? `지난 7일 동안 사람이 ${num(v.사람)}번 들어왔고, 문의와 앱 받기 숫자는 ${actsMissing}.`
    : acts.length ? `지난 7일 동안 사람이 ${num(v.사람)}번 들어왔고, ${acts.join(', ')} 눌렀습니다.` : `지난 7일 동안 사람이 ${num(v.사람)}번 들어왔고, 문의와 앱 받기는 아직 없습니다.`;
  const quiet = (v.갈래 || []).filter(x => (x.이름 === '검색' || x.이름 === 'AI 답변') && x.수 === 0).length === 2;
  const top = (v.들어온곳 || [])[0];
  const then = v.까닭 ? clean(v.까닭, 120) : quiet ? '검색과 AI 답변으로는 아직 거의 오지 않습니다.' : top ? `${josa(clean(top.이름, 20), ['에서', '에서'])} 가장 많이 왔습니다.` : '';
  return { say, then };
}

/** 한 줄을 만들다 요약이 덜 차서 막히면, 그 줄만 「못 읽음」으로 둔다(검토 P2-6) */
function safeRow(build, key, nm, s) {
  try { return build(s); } catch { return { key, nm, mid: '요약의 이 칸을 읽지 못했습니다.', val: '못 읽음', when: '', unread: 1, more: [] }; }
}

/**
 * 요약 → 화면에 보일 것.
 * @param result desktop/src/site-visits.cjs snapshot()의 답
 * @returns {visible:false} | { visible:true, say, then, when, scope, rows[], stale, problem }
 */
export function siteVisitsView(result, now = Date.now()) {
  if (!result || result.available !== true) return { visible: false };
  if (!result.ok || !result.summary) {
    const newer = result?.code === 'VERSION' && Number.isInteger(result.version) && result.version > (result.supported ?? SUPPORTED_SUMMARY);
    const older = result?.code === 'VERSION' && Number.isInteger(result.version) && result.version < (result.supported ?? SUPPORTED_SUMMARY);
    return {
      visible: true, say: '모은 숫자를 읽지 못했습니다.',
      then: newer ? '모으기 도구가 새 꼴로 썼습니다. 앱을 업데이트하면 보입니다.' : older ? '모으기 도구가 옛 꼴로 썼습니다. 다음에 모을 때 새 꼴로 쓰면 보입니다.' : '모으기 도구가 다시 쓰면 저절로 보입니다.',
      when: '', scope: '', rows: [], stale: false, problem: result?.code || 'UNREADABLE',
    };
  }
  const s = result.summary;
  const made = Date.parse(s.만든때);
  const stale = !Number.isFinite(made) || now - made > STALE_DAYS * DAY;
  let head;
  try { head = conclusion(s, now); } catch { head = { say: '모은 숫자의 일부를 읽지 못했습니다.', then: '아래 줄마다 읽은 만큼 보입니다.' }; }
  if (stale && Number.isFinite(made)) head = { say: `${monthDay(s.만든때)} 뒤로 숫자를 새로 모으지 못했습니다.`, then: [head.say, head.then].filter(Boolean).join(' ') };
  const rows = [
    safeRow(fromRow, 'from', '어디서 왔나', s), safeRow(pagesRow, 'pages', '어디를 봤나', s), safeRow(actsRow, 'acts', '문의와 앱 받기', s),
    safeRow(searchRow, 'search', '검색에 나오나', s), safeRow(aiRow, 'ai', 'AI에게 물으면', s),
  ];
  const first = rows.find(r => !r.unread);
  if (first) first.now = 1;
  const counted = Array.isArray(s.세는쪽) ? s.세는쪽.length : 0, notCounted = Array.isArray(s.안세는쪽) ? s.안세는쪽.length : 0;
  return {
    visible: true, say: head.say, then: head.then,
    when: Number.isFinite(made) ? `${stamp(s.만든때)}에 모았습니다. 하루에 한 번 모읍니다.` : '아직 모은 적이 없습니다. 하루에 한 번 모읍니다.',
    scope: `세는 쪽 ${num(counted)} · 아직 세지 않는 쪽 ${num(notCounted)}`,
    rows, stale, problem: null,
  };
}

/** 화면 읽기 프로그램용 한 줄 */
export function rowSpeech(row) {
  return [row.nm, row.val, row.mid, row.when].filter(Boolean).join(', ');
}
