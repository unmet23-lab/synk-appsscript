/**
 * 금액 도우미. 행사·관계·참석·장소/식사·지난번 받은 금액으로 참고 금액 2~3개와 이유를 낸다.
 * 정답을 정하지 않는다. 조사 수치는 출처와 함께 그대로 보여 주고,
 * 관계·참석별 후보는 SYNK가 정한 참고 기준임을 함께 밝힌다. 외부 호출·저장 없음.
 */
import { koreanDate } from './care-memorial.mjs';

export const CARE_AMOUNT_VERSION = 'care-amount-1';
export const AMOUNT_OCCASIONS = Object.freeze({ wedding: '결혼', funeral: '장례·조문', 'first-birthday': '돌잔치', 'milestone-birthday': '환갑·칠순 잔치', opening: '개업', housewarming: '집들이', hospital: '병문안' });
export const AMOUNT_RELATIONS = Object.freeze({ family: '가족', relative: '친척', 'close-friend': '친한 친구', coworker: '직장 동료', boss: '상사', acquaintance: '지인' });
export const AMOUNT_VENUES = Object.freeze({ hall: '일반 예식장·연회장', hotel: '호텔', none: '식사 없음' });
export const SURVEY = Object.freeze({
  wedding: '2026년 5월 성인 1,500명 조사에서 축의금 평균 97,900원, 10만 원이 65.3%',
  funeral: '2026년 5월 성인 1,500명 조사에서 조의금 평균 95,300원',
  venue: '2026년 5월 성인 1,500명 조사에서 65.8%가 장소·식사가 금액에 영향을 준다고 답함',
  venueSame: '같은 조사에서 65.8%가 장소·식사가 금액에 영향을 준다고 답함',
  source: '출처: 2026년 5월 성인 1,500명 경조사비 설문 보도 · v.daum.net/v/20260516003319431',
  url: 'https://v.daum.net/v/20260516003319431',
});
// 만 원 단위 사다리. 후보는 늘 이 칸 위에서만 고른다(5·10·15·20만 원 …).
const LADDER = [5, 10, 15, 20, 30, 50];
// 참석·일반 예식장 기준의 가운데 금액(만 원). SYNK 참고 기준이며 조사 결과가 아니다.
const BASE = Object.freeze({
  wedding: { acquaintance: 10, coworker: 10, boss: 10, 'close-friend': 15, relative: 20, family: 30 },
  funeral: { acquaintance: 5, coworker: 10, boss: 10, 'close-friend': 10, relative: 20, family: 30 },
  'first-birthday': { acquaintance: 5, coworker: 5, boss: 10, 'close-friend': 10, relative: 20, family: 30 },
  'milestone-birthday': { acquaintance: 5, coworker: 5, boss: 10, 'close-friend': 10, relative: 20, family: 50 },
  opening: { acquaintance: 5, coworker: 5, boss: 10, 'close-friend': 10, relative: 10, family: 20 },
  housewarming: { acquaintance: 5, coworker: 5, boss: 5, 'close-friend': 10, relative: 10, family: 10 },
  hospital: { acquaintance: 5, coworker: 5, boss: 10, 'close-friend': 10, relative: 10, family: 20 },
});
const VENUE_MATTERS = new Set(['wedding', 'first-birthday', 'milestone-birthday']);
const ATTEND_MATTERS = new Set(['wedding', 'first-birthday', 'milestone-birthday']);
const label = value => value % 10000 === 0 ? `${(value / 10000).toLocaleString('ko-KR')}만 원` : `${value.toLocaleString('ko-KR')}원`;
const step = (manwon, delta) => LADDER[Math.min(LADDER.length - 1, Math.max(0, LADDER.indexOf(manwon) + delta))];

function primaryReason(occasion, relation, attending) {
  const who = AMOUNT_RELATIONS[relation];
  if (occasion === 'wedding') return attending ? `${who} 결혼식에 참석할 때 많이 하는 금액이에요.` : `${who} 결혼식에 가지 못하고 마음만 보낼 때 많이 하는 금액이에요.`;
  if (occasion === 'funeral') return `${who} 조문에 많이 하는 금액이에요. 참석하지 못해도 같은 금액을 보내는 경우가 많아요.`;
  if (occasion === 'first-birthday') return attending ? `${who} 돌잔치에 갈 때 많이 하는 금액이에요.` : `${who} 돌잔치에 가지 못할 때 많이 하는 금액이에요.`;
  if (occasion === 'milestone-birthday') return relation === 'family' ? '가족의 환갑·칠순은 형편과 집안 기준에 따라 크게 달라요. 가운데쯤의 참고 금액이에요.' : `${who} 집안의 환갑·칠순 잔치에 많이 하는 금액이에요.`;
  if (occasion === 'opening') return `${who} 개업에 많이 하는 금액이에요.`;
  if (occasion === 'housewarming') return `${who} 집들이에 현금으로 할 때 많이 하는 금액이에요.`;
  return `${who} 병문안에 많이 하는 금액이에요.`;
}

/**
 * input: { occasion, relation, attending=true, venue='hall', receivedWon=null, receivedOn='' , now }
 * 돌려주는 값: { candidates: [{ amountWon, label, reason, kind, recommended }], basis, sourceNote, sourceUrl, cautions }
 *  kind: returned(받은 만큼) · returned-plus(받은 지 오래돼 한 칸 더) · typical(가운데) · lower · higher
 */
export function suggestAmounts({ occasion, relation, attending = true, venue = 'hall', receivedWon = null, receivedOn = '', now = new Date() } = {}) {
  if (!Object.hasOwn(AMOUNT_OCCASIONS, occasion)) throw new Error('어떤 자리인지 골라 주세요.');
  if (!Object.hasOwn(AMOUNT_RELATIONS, relation)) throw new Error('어떤 사이인지 골라 주세요.');
  if (typeof attending !== 'boolean') throw new Error('참석 여부를 골라 주세요.');
  if (!Object.hasOwn(AMOUNT_VENUES, venue)) throw new Error('장소·식사를 골라 주세요.');
  if (receivedWon !== null && (!Number.isSafeInteger(receivedWon) || receivedWon <= 0 || receivedWon > 100000000)) throw new Error('받은 금액은 1억 원 이하의 원 단위 숫자로 적어 주세요.');
  if (receivedOn && (!/^\d{4}-\d{2}-\d{2}$/.test(receivedOn) || receivedOn > koreanDate(now))) throw new Error('받은 날짜를 확인해 주세요.');
  const cautions = ['참고용이에요. 사이와 형편, 지역과 집안 기준에 맞게 정해 주세요.'];
  let middle = BASE[occasion][relation];
  const notes = [];
  if (ATTEND_MATTERS.has(occasion) && !attending) middle = step(middle, -1);
  if (VENUE_MATTERS.has(occasion) && attending && venue === 'hotel') { middle = step(middle, 1); notes.push('호텔은 식대가 높아 한 단계 올리는 경우가 많아요.'); }
  const typical = { amountWon: middle * 10000, kind: 'typical', reason: [primaryReason(occasion, relation, attending), ...notes].join(' ') };
  const lowerWon = step(middle, -1) * 10000, higherWon = step(middle, 1) * 10000;
  const lower = { amountWon: lowerWon, kind: 'lower', reason: VENUE_MATTERS.has(occasion) && attending && venue === 'none'
    ? '식사를 하지 않는다면 한 단계 낮추는 경우도 있어요.' : '조금 덜 가까운 사이라면 이 금액도 많이 해요.' };
  const higher = { amountWon: higherWon, kind: 'higher', reason: '더 가까운 사이거나 따로 고마운 일이 있었다면 이 금액도 해요.' };
  const list = [];
  const push = item => { if (item.amountWon > 0 && !list.some(other => other.amountWon === item.amountWon) && list.length < 3) list.push(item); };
  if (receivedWon !== null) {
    push({ amountWon: receivedWon, kind: 'returned', reason: `지난번 받은 금액(${label(receivedWon)})과 같아요. 같은 금액으로 돌려드리는 경우가 많아요.` });
    const years = receivedOn ? Number(koreanDate(now).slice(0, 4)) - Number(receivedOn.slice(0, 4)) : 0;
    if (years >= 3) {
      const plus = LADDER.find(value => value * 10000 > receivedWon);
      if (plus) push({ amountWon: plus * 10000, kind: 'returned-plus', reason: `받은 지 ${years}년이 지났다면 조금 더해 드리는 경우도 있어요.` });
    }
    push(typical);
  } else {
    push(typical);
    if (VENUE_MATTERS.has(occasion) && attending && venue === 'none') { push(lower); push(higher); }
    // 덜 가까운 사이는 낮은 쪽을, 가까운 사이는 높은 쪽을 먼저 보여 준다. 셋 다 보이므로 순서만 다르다.
    else if (relation === 'acquaintance' || relation === 'coworker') { push(lower); push(higher); }
    else { push(higher); push(lower); }
  }
  if (list.length < 2) push(lower.amountWon !== list[0].amountWon ? lower : higher);
  const candidates = list.map((item, index) => ({ ...item, label: label(item.amountWon), recommended: index === 0 }));
  const basis = [];
  if (occasion === 'wedding') basis.push(SURVEY.wedding);
  if (occasion === 'funeral') basis.push(SURVEY.funeral, '조의금은 3·5·7만 원처럼 홀수로 맞추는 집도 있어요. 10만 원은 예외로 많이 해요.');
  if (VENUE_MATTERS.has(occasion)) basis.push(occasion === 'wedding' ? SURVEY.venueSame : SURVEY.venue);
  if (occasion === 'opening' || occasion === 'housewarming') basis.push('현금 대신 필요한 물건이나 화분으로 하는 경우도 많아요.');
  if (relation === 'family' || relation === 'relative') basis.push('가족·친척은 집안에서 정한 기준이 있으면 그 기준을 먼저 따라요.');
  basis.push('관계·참석·장소별 후보는 SYNK가 정한 참고 기준이에요. 조사 결과 그 자체가 아니에요.');
  return {
    version: CARE_AMOUNT_VERSION, occasion, relation, attending, venue, receivedWon,
    headline: receivedWon !== null ? '같은 금액으로 돌려드리는 경우가 많아요' : '많이 하는 금액을 참고로 보여 드려요',
    candidates, basis, sourceNote: SURVEY.source, sourceUrl: SURVEY.url, cautions,
  };
}

/** 일정 종류 → 금액 도우미 자리. 생일·기념일·기일은 금액 도우미 대상이 아니라 null. */
export function amountOccasionFromEvent(eventType) {
  return { wedding: 'wedding', condolence: 'funeral' }[eventType] ?? null;
}
