import { WESTERN_ZODIAC, getFortune, seoulDateKey, validateDateKey } from './core.mjs';
import { getSaju, SAJU_MIN_DATE, SAJU_MAX_DATE } from './saju-core.mjs';
import { josa } from './kit/josa.mjs';

function deepFreeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') deepFreeze(child);
  return Object.freeze(value);
}

export const INSIGHT_SOURCES = deepFreeze([
  { label: '별자리의 일반 생일 구간', url: 'https://astrostyle.com/astrology/zodiac-sign-dates/' },
  { label: '서양 점성술의 네 원소', url: 'https://www.astrology.com/elements' },
  { label: '서양 점성술의 세 양상', url: 'https://astrostyle.com/astrology/cardinal-mutable-fixed-signs/' },
  { label: '한국민족문화대백과사전 · 사주', url: 'https://encykorea.aks.ac.kr/Article/E0025957' },
]);

const westernElements = {
  fire: { id: 'fire', label: '불', english: 'Fire', description: '불은 열의와 표현, 새롭게 움직이는 힘의 상징으로 쓰여요.' },
  earth: { id: 'earth', label: '흙', english: 'Earth', description: '흙은 구체적인 경험과 기반, 꾸준히 가꾸는 과정의 상징으로 쓰여요.' },
  air: { id: 'air', label: '공기', english: 'Air', description: '공기는 생각과 대화, 서로 다른 관점을 연결하는 상징으로 쓰여요.' },
  water: { id: 'water', label: '물', english: 'Water', description: '물은 감정과 상상, 마음의 흐름을 살피는 상징으로 쓰여요.' },
};
const westernModalities = {
  cardinal: { id: 'cardinal', label: '활동궁', english: 'Cardinal', description: '계절의 시작에 놓인 네 별자리로, 시작하고 방향을 잡는 모습에 빗대요.' },
  fixed: { id: 'fixed', label: '고정궁', english: 'Fixed', description: '계절의 가운데에 놓인 네 별자리로, 유지하고 깊게 가꾸는 모습에 빗대요.' },
  mutable: { id: 'mutable', label: '변통궁', english: 'Mutable', description: '계절의 끝에 놓인 네 별자리로, 조정하고 다음 변화로 이어 가는 모습에 빗대요.' },
};
const profileRows = [
  ['aries', 'fire', 'cardinal', ['시작', '용기', '솔직함'], '양자리는 먼저 한 발을 내딛는 장면에 자주 빗대요.', '준비가 덜 되어도 작게 시작해 볼 수 있는 것은 무엇인가요?'],
  ['taurus', 'earth', 'fixed', ['감각', '꾸준함', '안정'], '황소자리는 손에 닿는 즐거움을 알고 차근차근 가꾸는 장면에 빗대요.', '내 하루를 편안하게 해 주는 작은 습관은 무엇인가요?'],
  ['gemini', 'air', 'mutable', ['호기심', '대화', '관점'], '쌍둥이자리는 질문을 주고받으며 여러 관점을 오가는 장면에 빗대요.', '익숙한 일에 새롭게 던져 보고 싶은 질문이 있나요?'],
  ['cancer', 'water', 'cardinal', ['돌봄', '기억', '안식처'], '게자리는 마음이 편히 머무를 자리를 만들고 살피는 장면에 빗대요.', '오늘 나와 주변 사람에게 어떤 편안함을 더할 수 있을까요?'],
  ['leo', 'fire', 'fixed', ['표현', '창작', '온기'], '사자자리는 자신의 색을 드러내고 함께 즐기는 장면에 빗대요.', '잘하려는 마음을 내려놓고 표현해 보고 싶은 것은 무엇인가요?'],
  ['virgo', 'earth', 'mutable', ['관찰', '정돈', '보살핌'], '처녀자리는 작은 차이를 발견하고 쓰임을 다듬는 장면에 빗대요.', '지금 조금만 바꾸면 더 편해질 부분이 있나요?'],
  ['libra', 'air', 'cardinal', ['균형', '대화', '조화'], '천칭자리는 서로의 관점을 나란히 놓고 접점을 찾는 장면에 빗대요.', '내가 원하는 것과 상대가 원하는 것을 각각 들어 보았나요?'],
  ['scorpio', 'water', 'fixed', ['깊이', '몰입', '신뢰'], '전갈자리는 겉으로 드러난 말 너머의 의미를 깊이 살피는 장면에 빗대요.', '오래 마음에 남아 있는 질문 하나에 시간을 줄 수 있을까요?'],
  ['sagittarius', 'fire', 'mutable', ['탐색', '배움', '시야'], '사수자리는 익숙한 울타리 밖을 바라보고 배우는 장면에 빗대요.', '최근 내 생각을 넓혀 준 경험은 무엇이었나요?'],
  ['capricorn', 'earth', 'cardinal', ['기반', '계획', '책임'], '염소자리는 긴 길을 작은 단계로 나누고 기반을 세우는 장면에 빗대요.', '내가 정한 목표에서 오늘 남길 수 있는 작은 발자국은 무엇인가요?'],
  ['aquarius', 'air', 'fixed', ['새 관점', '연결', '독립'], '물병자리는 당연한 방식을 다시 묻고 새로운 연결을 만드는 장면에 빗대요.', '늘 하던 방식에서 한 가지만 바꾼다면 무엇을 고를까요?'],
  ['pisces', 'water', 'mutable', ['상상', '공감', '여백'], '물고기자리는 상상과 감정의 흐름에 귀 기울이는 장면에 빗대요.', '말로 정리하기 전, 그대로 느껴 보아도 괜찮은 마음이 있나요?'],
];

export const ZODIAC_PROFILES = deepFreeze(profileRows.map(([signId, elementId, modalityId, keywords, description, question]) => {
  const sign = WESTERN_ZODIAC.find(item => item.id === signId);
  return { signId, label: sign.label, english: sign.english, range: sign.range,
    element: { ...westernElements[elementId] }, modality: { ...westernModalities[modalityId] }, keywords, description, question,
    note: '서양 점성술에서 쓰는 문화적 상징을 소개해요. 이 설명이 개인의 성격이나 미래를 정하지 않아요.' };
}));

export function getZodiacProfile(signId) {
  const profile = ZODIAC_PROFILES.find(item => item.signId === signId);
  if (!profile) throw new TypeError('12가지 별자리 중 하나를 골라 주세요.');
  return profile;
}

function addDays(date, amount) {
  validateDateKey(date);
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + amount * 86_400_000).toISOString().slice(0, 10);
}

function monthDayNumber(date) {
  return Number(date.slice(5, 7)) * 100 + Number(date.slice(8, 10));
}

export function suggestZodiac(birthDate) {
  validateDateKey(birthDate);
  const monthDay = monthDayNumber(birthDate);
  const index = WESTERN_ZODIAC.findIndex(sign => {
    const [start, end] = sign.range.split('–').map(part => {
      const [month, day] = part.split('.').map(Number);
      return month * 100 + day;
    });
    return start <= end ? monthDay >= start && monthDay <= end : monthDay >= start || monthDay <= end;
  });
  const sign = WESTERN_ZODIAC[index];
  const [start, end] = sign.range.split('–').map(part => {
    const [month, day] = part.split('.').map(Number);
    return month * 100 + day;
  });
  const isBoundaryDay = monthDay === start || monthDay === end;
  // A leap-year reference makes the one-day neighbourhood correct even for Feb 29.
  const canonicalDate = `2000-${birthDate.slice(5)}`;
  const neighbours = [-1, 0, 1].map(offset => monthDayNumber(addDays(canonicalDate, offset)));
  const nearBoundary = neighbours.includes(start) || neighbours.includes(end);
  const adjacent = monthDay === start ? WESTERN_ZODIAC[(index + 11) % 12] : monthDay === end ? WESTERN_ZODIAC[(index + 1) % 12] : null;
  return deepFreeze({
    signId: sign.id, label: sign.label, english: sign.english, range: sign.range, isBoundaryDay, nearBoundary,
    adjacentSign: adjacent ? { signId: adjacent.id, label: adjacent.label, english: adjacent.english } : null,
    note: isBoundaryDay
      ? '일반 생일 구간의 경계일이에요. 실제 태양 별자리는 출생 연도·시각에 따라 이웃 별자리일 수 있으니, 알고 있는 별자리가 있다면 직접 골라 주세요.'
      : nearBoundary
        ? '별자리가 바뀌는 날짜와 가까워요. 일반적인 양력 생일 구간으로 추천했으며, 정확한 경계는 출생 연도·시각에 따라 달라져요.'
        : '일반적인 양력 생일 구간으로 추천했어요. 정밀한 출생 차트 계산은 아니며 별자리를 직접 바꿀 수 있어요.',
  });
}

export function getActionCard(fortune) {
  if (!fortune || !['korean', 'western'].includes(fortune.mode) || typeof fortune.action !== 'string' || !fortune.action.trim()) {
    throw new TypeError('운세 결과를 먼저 만들어 주세요.');
  }
  validateDateKey(fortune.date);
  const isSaju = fortune.mode === 'korean' && fortune.signId === 'saju';
  const profileKey = isSaju
    ? fortune.pillars.map(item => item.known ? item.hanja : '_').join('-')
    : fortune.signId;
  if (typeof profileKey !== 'string' || !profileKey) throw new TypeError('선택한 운세 정보를 확인해 주세요.');
  return deepFreeze({
    key: `${fortune.mode}:${fortune.date}:${profileKey}`, date: fortune.date, mode: fortune.mode,
    text: fortune.action, reflectionPrompt: '해 보니 어땠나요? 해낸 점이나 다음에 바꿔 보고 싶은 점을 한 줄로 남겨 보세요.',
    completed: false, reflection: '',
  });
}

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

export function getReadingSeries(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('운세 방식과 날짜를 골라 주세요.');
  const { mode, signId, birthDate, birthTime = null, period = 'today', date = seoulDateKey() } = options;
  validateDateKey(date);
  if (date < SAJU_MIN_DATE || date > SAJU_MAX_DATE) throw new RangeError('지원하는 날짜 범위는 1900년부터 2100년까지예요.');
  if (!['today', 'week'].includes(period)) throw new TypeError('오늘과 이번 주 중 하나를 골라 주세요.');
  if (!['korean', 'western'].includes(mode)) throw new TypeError('한국 사주와 별자리 운세 중 하나를 골라 주세요.');
  const readingAt = day => mode === 'korean' ? getSaju({ birthDate, birthTime }, day) : getFortune(signId, day, 'western');
  const anchor = readingAt(date); // Validate the selected profile even when early week days are unavailable.
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  const startDate = period === 'today' ? date : addDays(date, -((dayOfWeek + 6) % 7));
  const endDate = period === 'today' ? date : addDays(startDate, 6);
  const items = Array.from({ length: period === 'today' ? 1 : 7 }, (_, index) => {
    const day = addDays(startDate, index);
    const unavailableReason = day < SAJU_MIN_DATE || day > SAJU_MAX_DATE
      ? '계산 지원 범위 밖의 날짜예요.'
      : mode === 'korean' && day < birthDate ? '출생일 이전 날짜예요.' : null;
    const fortune = unavailableReason ? null : day === date ? anchor : readingAt(day);
    return { date: day, weekday: weekdays[new Date(`${day}T00:00:00Z`).getUTCDay()], isToday: day === date,
      fortune, action: fortune ? getActionCard(fortune) : null, unavailableReason };
  });
  return deepFreeze({ period, label: period === 'today' ? '오늘의 읽을거리' : '이번 주의 하루 한 가지',
    startDate, endDate, referenceDate: date, items,
    note: '날짜마다 제공하는 짧은 읽을거리와 행동 제안이에요. 한 주의 사건이나 길흉을 예측하지 않아요.' });
}

const pillarGuide = {
  year: { title: '태어난 해의 기둥', description: '연주는 태어난 해를 천간·지지 두 글자로 나타내요. 이 계산에서는 입춘의 절입 시각을 새해 경계로 삼아요.' },
  month: { title: '태어난 절기의 기둥', description: '월주는 태어난 때의 계절 구간을 나타내요. 입춘·경칩처럼 한 달을 여는 12절의 절입 시각마다 다음 월주로 넘어가요.' },
  day: { title: '태어난 날의 기둥', description: '일주는 날짜에 대응하는 60간지예요. 위 글자인 천간을 일간이라 부르며 사주를 읽을 때 기준점으로 삼아요. 이 화면에서는 00시에 일주가 바뀌어요.' },
  hour: { title: '태어난 시각의 기둥', description: '시주는 하루를 약 두 시간씩 나눈 구간을 나타내요. 자시는 23시부터 01시 전까지이며, 천간은 일간과 시간 규칙을 함께 적용해 정해요.' },
};
const elementGuides = {
  목: { symbol: '성장과 시작', description: '목은 자라고 뻗어나가는 모습에 빗대는 전통적 상징이에요.', question: '지금 작게 시작하거나 가꾸어 보고 싶은 것은 무엇인가요?' },
  화: { symbol: '표현과 온기', description: '화는 빛과 열처럼 드러나고 나누어지는 모습에 빗대는 전통적 상징이에요.', question: '오늘 어떤 생각이나 고마움을 밖으로 표현해 볼까요?' },
  토: { symbol: '기반과 돌봄', description: '토는 담아 주고 기댈 바탕을 만드는 모습에 빗대는 전통적 상징이에요.', question: '내 일상을 받쳐 주는 작은 습관을 하나 챙길 수 있을까요?' },
  금: { symbol: '정리와 기준', description: '금은 형태를 다듬고 구분하는 모습에 빗대는 전통적 상징이에요.', question: '오늘 편해지기 위해 정리하거나 정해 둘 기준은 무엇인가요?' },
  수: { symbol: '흐름과 배움', description: '수는 흐르며 이어지고 머무르는 모습에 빗대는 전통적 상징이에요.', question: '급히 결론 내리기보다 더 듣거나 배워 볼 부분이 있나요?' },
};

export function getSajuGuide(result) {
  if (!result || result.signId !== 'saju' || !Array.isArray(result.pillars) || result.pillars.length !== 4
    || !result.dayMaster || !Array.isArray(result.elements) || result.elements.length !== 5) {
    throw new TypeError('생년월일로 계산한 사주 결과가 필요해요.');
  }
  const countedCharacters = result.elements.reduce((sum, element) => sum + element.count, 0);
  const dayElement = elementGuides[result.dayMaster.element];
  return deepFreeze({
    intro: '사주는 태어난 연·월·일·시를 네 기둥으로, 각 기둥을 위의 천간과 아래의 지지 두 글자로 나타낸 전통적인 시간 표기예요. 네 기둥이 모두 확인되면 여덟 글자, 사주팔자가 돼요.',
    pillars: result.pillars.map(item => {
      const guide = pillarGuide[item.id];
      return { id: item.id, label: item.label, title: guide.title, description: guide.description, known: item.known,
        reading: item.known
          ? `${item.hanja}(${item.hangul})${josa(item.hangul, '이에요', '예요')}. 천간 ${item.stem.hanja}(${item.stem.hangul})${josa(item.stem.hangul, '은', '는')} ${item.stem.element}, 지지 ${item.branch.hanja}(${item.branch.hangul})${josa(item.branch.hangul, '은', '는')} 대표 오행 ${item.branch.element}${josa(item.branch.element, '으로', '로')} 셌어요.`
          : `아직 확정하지 않았어요. ${item.reason || '추가 출생 정보가 필요해요.'}` };
    }),
    dayMaster: { ...result.dayMaster, title: `${result.dayMaster.hanja}(${result.dayMaster.hangul}) · ${result.dayMaster.element} 일간`,
      description: `일간은 일주의 첫 글자예요. 명리에서 다른 글자와의 관계를 읽는 기준으로 쓰지만, 한 글자만으로 사람 전체를 설명할 수는 없어요. ${dayElement.description}`,
      question: dayElement.question },
    countedCharacters,
    elements: result.elements.map(item => ({ ...item, ...elementGuides[item.label],
      reading: item.count === 0 ? '확인된 겉글자에는 0개예요. 이 상징이나 능력이 없다는 뜻은 아니에요.'
        : `확인된 겉글자 ${countedCharacters}개 중 ${item.count}개예요. 개수만으로 오행의 강약을 정하지 않아요.` })),
    limits: [
      '겉글자 오행은 천간·지지의 대표 오행을 각 한 번씩 센 단순 집계예요. 지지 안의 지장간과 계절에 따른 힘은 합산하지 않았어요.',
      '합·충, 신강·신약, 용신, 대운을 판단하지 않아요. 오행 개수가 많거나 적다고 성격·재능·길흉이 정해지지는 않아요.',
      '출생 시간이나 절입 전후를 모르면 해당 기둥은 비워 두어요. 모르는 글자는 오행 집계에도 넣지 않아요.',
      '양력·고정 한국표준시(UTC+9)를 사용해요. 해외 현지시각, 진태양시, 과거 표준시·서머타임은 자동 보정하지 않아요.',
      '일주는 00시 변경, 자시는 23시 시작으로 구분해요. 23시대 시간의 천간은 다음 날 자시 규칙을 사용하므로 다른 관례의 만세력과 다를 수 있어요.',
      '풀이 문구는 전통적 상징을 활용한 질문과 읽을거리예요. 실제 성격 판정이나 미래 예측으로 사용하지 않아요.',
    ],
  });
}
