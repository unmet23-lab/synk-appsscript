// 올해와 월별 읽을거리.
// 사주: 그해 이름(2026 병오)의 천간 오행과 내 일간 오행의 관계로 한 해를, 달마다 월건(그달 15일에 걸린 절기 월주)의
//       천간 오행과 일간의 관계(+월지와 내 일지의 합·충)로 월별 기운을 정한다. 1월은 아직 앞해의 축월이다.
// 별자리: 별자리 원소와 해마다 바뀌는 주제로 한 해를, 달마다 그달 15일의 태양 별자리 원소와의 관계로 월별 기운을 정한다.
// 미래를 예측하지 않는 읽을거리다.
import { WESTERN_ZODIAC } from './core.mjs';
import { getZodiacProfile, suggestZodiac } from './insights.mjs';
import {
  deepFreeze, mod, clamp, yearPillar, monthPillar, elementRelation, branchRelation, sajuShape, signElement, westernRelation,
} from './fortune-base.mjs';

const SAJU_YEAR = {
  supported: [
    { headline: '든든한 바람을 등에 업는 해', keywords: ['배움', '도움', '충전'],
      message: '올해의 기운이 내 일간을 살려 주는 흐름이라 배움과 도움이 자연스럽게 모여요. 새로 익히고 싶은 것을 하나 정해 꾸준히 이어 가 보세요.' },
    { headline: '배우고 채우는 해', keywords: ['성장', '조언', '여유'],
      message: '올해는 서두르기보다 안을 채울수록 힘이 붙는 해예요. 좋은 조언을 귀담아듣고 쉬는 시간도 넉넉히 챙겨 보세요.' },
  ],
  same: [
    { headline: '내 색깔이 또렷해지는 해', keywords: ['자신감', '동료', '꾸준함'],
      message: '올해의 기운이 내 일간과 같은 결이라 나다운 선택에 힘이 실려요. 하던 일을 꾸준히 밀고 가면 보람이 커져요.' },
    { headline: '함께 걸어갈 사람을 만나는 해', keywords: ['협력', '독립', '중심'],
      message: '비슷한 생각을 가진 사람들과 손발이 잘 맞는 해예요. 혼자 애쓰기보다 함께 나눌 때 일이 수월해져요.' },
  ],
  expressing: [
    { headline: '표현하고 펼쳐 보이는 해', keywords: ['표현', '창작', '나눔'],
      message: '내 일간이 올해의 기운을 키워 주는 흐름이라 생각과 재능을 밖으로 꺼내기 좋아요. 만들고 나누는 일을 하나 시작해 보세요.' },
    { headline: '재능이 꽃피는 해', keywords: ['재능', '도전', '즐거움'],
      message: '하고 싶던 일을 작게라도 시도해 보기 좋은 해예요. 결과보다 즐거움을 기준으로 고르면 한 해가 가볍게 흘러가요.' },
  ],
  organizing: [
    { headline: '실속을 거두는 해', keywords: ['성과', '정리', '실속'],
      message: '내 일간이 올해의 기운을 다스리는 흐름이라 계획한 일을 손에 쥐기 좋아요. 목표를 작게 나눠 하나씩 마무리해 보세요.' },
    { headline: '계획이 결실로 이어지는 해', keywords: ['계획', '결실', '살림'],
      message: '정리하고 챙기는 만큼 남는 것이 많은 해예요. 일정과 살림을 한 번씩 다듬어 두면 든든해져요.' },
  ],
  balancing: [
    { headline: '단단하게 다져지는 해', keywords: ['기본', '책임', '성장'],
      message: '올해의 기운이 내 일간을 다듬어 주는 흐름이라 기본을 챙길수록 단단해져요. 무리한 속도보다 꾸준한 걸음이 잘 어울려요.' },
    { headline: '책임감이 빛나는 해', keywords: ['신뢰', '약속', '인내'],
      message: '맡은 일을 차근차근 해내는 모습이 믿음으로 돌아오는 해예요. 힘에 부칠 때는 일을 덜어 내고 쉬어 가도 괜찮아요.' },
  ],
};
const SAJU_MONTH_LINES = {
  supported: ['도움과 배움이 자연스럽게 모이는 달이에요.', '새로 익힌 것이 오래 남는 달이에요. 배우고 싶던 걸 시작해 보세요.',
    '쉬어 가며 힘을 채우기 좋은 달이에요.', '좋은 조언을 만나기 쉬운 달이에요. 물어보는 걸 망설이지 마세요.'],
  same: ['내 속도대로 밀고 나가기 좋은 달이에요.', '친구나 동료와 힘을 모으면 일이 수월해지는 달이에요.',
    '나다운 선택에 자신감이 붙는 달이에요.', '하던 일을 꾸준히 이어 가면 보람이 큰 달이에요.'],
  expressing: ['아이디어와 표현이 잘 풀리는 달이에요.', '만들고 나누는 재미가 커지는 달이에요.',
    '새로운 시도가 즐거운 달이에요. 작게 하나 해 보세요.', '말과 글로 마음을 전하기 좋은 달이에요.'],
  organizing: ['정리한 만큼 실속이 남는 달이에요.', '계획을 세우면 그대로 진행되기 쉬운 달이에요.',
    '미뤄 둔 일을 마무리하기 좋은 달이에요.', '살림과 일정을 다듬기 좋은 달이에요.'],
  balancing: ['속도를 조금 늦추고 기본을 다지면 좋은 달이에요.', '맡은 일에 집중하면 믿음이 쌓이는 달이에요.',
    '빡빡한 일정은 덜어 내고 여유를 챙기면 좋은 달이에요.', '차근차근 확인하며 가면 편안한 달이에요.'],
};
const SAJU_LEVEL = { supported: 5, same: 4, expressing: 4, organizing: 4, balancing: 3 };

const WESTERN_YEAR = {
  fire: [
    { headline: '용기를 내는 만큼 넓어지는 해', keywords: ['시작', '용기', '무대'],
      message: '새로운 무대에 서 보는 해예요. 하고 싶던 일을 작게라도 시작하면 한 해가 즐겁게 흘러가요.' },
    { headline: '열정을 오래 지키는 해', keywords: ['꾸준함', '열정', '목표'],
      message: '타오르는 마음을 꾸준함으로 이어 가는 해예요. 한 가지 목표를 정해 끝까지 함께해 보세요.' },
    { headline: '함께 빛나는 해', keywords: ['협력', '표현', '축하'],
      message: '혼자보다 함께일 때 더 크게 빛나는 해예요. 마음이 맞는 사람과 작은 일을 함께 꾸려 보세요.' },
  ],
  earth: [
    { headline: '차곡차곡 쌓아 올리는 해', keywords: ['기반', '습관', '실속'],
      message: '작은 습관이 단단한 기반이 되는 해예요. 매일 조금씩 이어 갈 일을 하나 정해 보세요.' },
    { headline: '나를 아끼는 법을 배우는 해', keywords: ['휴식', '감각', '균형'],
      message: '일만큼 쉼도 소중히 챙기는 해예요. 나를 편안하게 하는 시간과 공간을 넉넉히 마련해 보세요.' },
    { headline: '결실을 거두는 해', keywords: ['결실', '계획', '안정'],
      message: '그동안 쌓아 온 것이 모양을 갖추는 해예요. 계획을 차분히 다듬으며 한 걸음씩 나아가 보세요.' },
  ],
  air: [
    { headline: '새로운 연결이 열리는 해', keywords: ['연결', '대화', '배움'],
      message: '새로운 사람과 생각을 만나며 시야가 넓어지는 해예요. 관심 가는 모임이나 수업에 가볍게 들어가 보세요.' },
    { headline: '생각을 현실로 옮기는 해', keywords: ['아이디어', '실행', '정리'],
      message: '머릿속 아이디어를 하나씩 현실로 옮겨 보는 해예요. 떠오른 생각을 적어 두고 가장 쉬운 것부터 해 보세요.' },
    { headline: '가볍게 떠나 보는 해', keywords: ['여행', '호기심', '변화'],
      message: '익숙한 곳을 벗어나 새로운 바람을 쐬기 좋은 해예요. 짧은 여행이나 새로운 동네 산책도 충분해요.' },
  ],
  water: [
    { headline: '마음이 깊어지는 해', keywords: ['공감', '회복', '관계'],
      message: '가까운 사람과 마음을 깊이 나누는 해예요. 고마운 사람에게 마음을 자주 표현해 보세요.' },
    { headline: '상상이 모양을 갖추는 해', keywords: ['상상', '창작', '직감'],
      message: '마음속 상상을 글이나 그림으로 꺼내 보기 좋은 해예요. 직감이 이끄는 취미를 하나 시작해 보세요.' },
    { headline: '편안한 자리를 찾는 해', keywords: ['안식', '가족', '정리'],
      message: '나에게 편안한 자리와 사람을 다시 살피는 해예요. 머무는 공간을 아늑하게 가꿔 보세요.' },
  ],
};
const WESTERN_MONTH_LINES = {
  same: ['같은 원소의 계절이라 마음먹은 일이 잘 맞물리는 달이에요.', '내 장점이 자연스럽게 드러나는 달이에요.',
    '익숙한 리듬으로 밀고 나가기 좋은 달이에요.', '자신감이 붙어 새 계획을 세우기 좋은 달이에요.'],
  complement: ['주변의 응원이 힘이 되는 달이에요.', '대화와 협력이 잘 풀리는 달이에요.',
    '부족한 부분을 채워 주는 사람을 만나기 좋은 달이에요.', '하던 일에 새 바람이 드는 달이에요.'],
  neutral: ['무난하게 흐르는 달이에요. 하던 일을 차분히 이어 가 보세요.', '작은 변화 하나로 기분을 바꾸기 좋은 달이에요.',
    '일과 쉼의 균형을 맞추기 좋은 달이에요.', '새로운 취미를 가볍게 시험해 보기 좋은 달이에요.'],
  challenging: ['속도를 조금 늦추고 기본을 챙기면 편안한 달이에요.', '다른 생각을 가진 사람에게서 배울 점이 많은 달이에요.',
    '빡빡한 약속은 덜어 내고 여유를 남겨 두면 좋은 달이에요.', '천천히 확인하며 가면 든든한 달이에요.'],
  season: '내 별자리 시즌이에요. 나다운 모습이 가장 빛나는 달이에요.',
};
const WESTERN_LEVEL = { same: 5, complement: 4, neutral: 4, challenging: 3 };

export const YEAR_TEXT = deepFreeze({ korean: { year: SAJU_YEAR, months: SAJU_MONTH_LINES }, western: { year: WESTERN_YEAR, months: WESTERN_MONTH_LINES } });

function readYear(year) {
  yearPillar(year);
  return year;
}

/** 그해 이름(예 2026 → { hangul: '병오', hanja: '丙午', element: '화', animal: '말' }). */
export function yearGanji(year) {
  const pillar = yearPillar(year);
  return { hangul: pillar.hangul, hanja: pillar.hanja, element: pillar.stem.element, branch: pillar.branch.hangul };
}

/**
 * @param {{ saju: object, year: number }} options
 * @returns 한 해 읽을거리(얼림). 일간이 유보되면 null.
 */
export function getYearReading({ saju, year } = {}) {
  readYear(year);
  const shape = sajuShape(saju);
  if (!shape) return null;
  const pillar = yearPillar(year);
  const relation = elementRelation(shape.stem.element, pillar.stem.element);
  const text = SAJU_YEAR[relation][shape.stem.yang === pillar.stem.yang ? 0 : 1];
  const seen = {};
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1, monthly = monthPillar(year, month);
    const monthRelation = elementRelation(shape.stem.element, monthly.stem.element);
    const branch = branchRelation(shape.branch, monthly.branch);
    const shift = branch === 'sixHarmony' || branch === 'threeHarmony' ? 1 : branch === 'clash' ? -1 : 0;
    const occurrence = seen[monthRelation] = (seen[monthRelation] ?? -1) + 1;
    const lines = SAJU_MONTH_LINES[monthRelation];
    return { month, level: clamp(SAJU_LEVEL[monthRelation] + shift, 2, 5), relation: monthRelation,
      line: lines[mod(occurrence + year, lines.length)], ganji: monthly.hangul, ganjiHanja: monthly.hanja };
  });
  return deepFreeze({
    year, mode: 'korean', ganji: pillar.hangul, ganjiHanja: pillar.hanja, relation,
    headline: text.headline,
    message: `${year}년은 ${pillar.hangul}년, ${pillar.stem.element} 기운의 해예요. ${text.message}`,
    keywords: [...text.keywords], months,
    note: '월별 기운은 그달 15일에 걸린 절기 월건으로 봤어요(1월은 앞해의 축월). 한 해의 일을 예측하지 않는 읽을거리예요.',
  });
}

/**
 * @param {{ signId: string, year: number }} options
 * @returns 별자리 한 해 읽을거리(얼림).
 */
export function getZodiacYear({ signId, year } = {}) {
  readYear(year);
  const profile = getZodiacProfile(signId);
  const own = signElement(signId);
  const signIndex = WESTERN_ZODIAC.findIndex(item => item.id === signId);
  const text = WESTERN_YEAR[own.id][mod(year + signIndex, 3)];
  const seen = {};
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const sun = suggestZodiac(`${year}-${String(month).padStart(2, '0')}-15`);
    const sunElement = signElement(sun.signId);
    const relation = westernRelation(own.id, sunElement.id);
    const occurrence = seen[relation] = (seen[relation] ?? -1) + 1;
    const lines = WESTERN_MONTH_LINES[relation];
    const season = sun.signId === signId;
    return { month, level: season ? 5 : WESTERN_LEVEL[relation], relation, sunSign: sun.label,
      line: season ? WESTERN_MONTH_LINES.season : lines[mod(occurrence + year, lines.length)] };
  });
  return deepFreeze({
    year, mode: 'western', signId, signLabel: profile.label, headline: text.headline,
    message: `${own.label} 별자리인 ${profile.label}에게 ${year}년은 ${text.message}`,
    keywords: [...text.keywords], months,
    note: '월별 기운은 그달 15일의 태양 별자리 원소와 내 별자리 원소의 관계로 고른 창작 읽을거리예요. 실제 천체 위치를 계산하지 않아요.',
  });
}

