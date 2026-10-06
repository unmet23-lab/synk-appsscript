export const ZODIAC = Object.freeze([
  ['rat', '쥐띠'], ['ox', '소띠'], ['tiger', '호랑이띠'], ['rabbit', '토끼띠'],
  ['dragon', '용띠'], ['snake', '뱀띠'], ['horse', '말띠'], ['sheep', '양띠'],
  ['monkey', '원숭이띠'], ['rooster', '닭띠'], ['dog', '개띠'], ['pig', '돼지띠'],
].map(([id, label]) => Object.freeze({ id, label })));

// 일반적인 서양 12궁 생일 구간이며, 경계일의 정밀 출생 차트를 계산하지 않는다.
// https://astrostyle.com/astrology/zodiac-sign-dates/
export const WESTERN_ZODIAC = Object.freeze([
  ['aries', '양자리', 'Aries', '3.21–4.19'],
  ['taurus', '황소자리', 'Taurus', '4.20–5.20'],
  ['gemini', '쌍둥이자리', 'Gemini', '5.21–6.20'],
  ['cancer', '게자리', 'Cancer', '6.21–7.22'],
  ['leo', '사자자리', 'Leo', '7.23–8.22'],
  ['virgo', '처녀자리', 'Virgo', '8.23–9.22'],
  ['libra', '천칭자리', 'Libra', '9.23–10.22'],
  ['scorpio', '전갈자리', 'Scorpio', '10.23–11.21'],
  ['sagittarius', '사수자리', 'Sagittarius', '11.22–12.21'],
  ['capricorn', '염소자리', 'Capricorn', '12.22–1.19'],
  ['aquarius', '물병자리', 'Aquarius', '1.20–2.18'],
  ['pisces', '물고기자리', 'Pisces', '2.19–3.20'],
].map(([id, label, english, range]) => Object.freeze({ id, label, english, range })));

export const FORTUNE_MODES = Object.freeze([
  Object.freeze({ id: 'korean', label: '한국 사주', english: 'Korean Saju' }),
  Object.freeze({ id: 'western', label: '별자리 운세', english: 'Horoscope' }),
]);

export function getSigns(mode = 'korean') {
  if (mode === 'korean') return ZODIAC;
  if (mode === 'western') return WESTERN_ZODIAC;
  throw new TypeError('한국 운세와 별자리 운세 중 하나를 골라 주세요.');
}

const seoul = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function seoulDateKey(now = Date.now()) {
  const parts = Object.fromEntries(seoul.formatToParts(new Date(now)).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function validateDateKey(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TypeError('날짜 형식이 올바르지 않습니다.');
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new TypeError('존재하지 않는 날짜입니다.');
  return date;
}

export function displayDate(date) {
  validateDateKey(date);
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'long' })
    .format(new Date(`${date}T00:00:00+09:00`));
}

// 한국은 현재 일광절약시간을 쓰지 않는다. 다음 한국 자정을 UTC로 환산한다.
export function millisecondsUntilNextSeoulDay(now = Date.now()) {
  const instant = new Date(now).getTime();
  const date = seoulDateKey(instant);
  return new Date(`${date}T00:00:00+09:00`).getTime() + 86_400_000 - instant;
}

const themes = [
  ['작은 시작이 반가운 날', '크게 준비하기보다 손에 잡히는 일 하나로 시작해 보세요. 첫걸음의 가벼움을 즐겨도 좋아요.'],
  ['내 속도를 찾아가는 날', '주변의 속도보다 지금 내 리듬에 귀를 기울여 보세요. 천천히 마친 한 가지도 충분히 괜찮아요.'],
  ['익숙함 속 발견이 있는 날', '늘 보던 풍경을 한 번 더 바라보세요. 평범한 순간에서 마음에 드는 장면을 찾는 재미가 있어요.'],
  ['마음을 가볍게 비우는 날', '모든 일을 한꺼번에 해결하려 애쓰지 않아도 돼요. 오늘 필요한 한 가지부터 골라 보세요.'],
  ['다정한 말이 어울리는 날', '작은 고마움도 말로 꺼내 보세요. 다정한 한마디를 건네는 즐거움을 챙기는 날로 만들어 봐요.'],
  ['호기심을 따라가 보는 날', '문득 궁금한 것이 있다면 짧게 알아보세요. 정답을 찾기보다 새로 알게 되는 즐거움에 집중해 봐요.'],
  ['차근차근 쌓아 가는 날', '이미 해 온 일에서 다음 한 칸을 찾아보세요. 작은 마무리 하나를 오늘의 기분 좋은 기록으로 남겨요.'],
  ['기분 좋은 틈을 만드는 날', '빈 시간을 전부 채우지 않아도 괜찮아요. 좋아하는 노래 한 곡만큼 여유를 남겨 보세요.'],
  ['내 취향을 챙기는 날', '남들이 좋아하는 것보다 내가 좋아하는 작은 것을 떠올려 보세요. 익숙한 즐거움도 새삼 반가울 수 있어요.'],
  ['정돈하고 새로 보는 날', '눈앞의 한 곳만 가볍게 정리해 보세요. 비워 낸 자리에 무엇을 두고 싶은지 생각해 봐도 좋아요.'],
  ['함께하는 재미를 찾는 날', '거창한 약속 없이도 취향 하나를 나눌 수 있어요. 서로 좋아하는 것을 하나씩 물어보세요.'],
  ['나를 응원해 주는 날', '오늘 해낸 작은 일을 그냥 지나치지 마세요. 스스로에게 수고했다는 말을 한 번 건네 보세요.'],
  ['새로운 순서를 시도하는 날', '익숙한 일의 순서를 조금 바꿔 보세요. 나에게 더 편한 방법을 찾는 작은 실험이면 충분해요.'],
  ['좋은 장면을 모으는 날', '마음에 드는 색이나 문장을 발견하면 잠깐 기억해 두세요. 오늘의 반가운 순간을 하나 모아 봐요.'],
  ['어깨의 힘을 내려놓는 날', '완벽해야 한다는 마음을 잠깐 내려놓아도 돼요. 지금 할 수 있는 만큼만 해 보는 날로 정해 봐요.'],
  ['마무리가 기분 좋은 날', '길게 남겨 둔 일 가운데 아주 작은 것 하나만 끝내 보세요. 끝냈다는 기분을 충분히 누려도 좋아요.'],
];
const relationships = [
  '답을 서두르기보다 상대의 말을 끝까지 들어 보세요. 몰랐던 마음을 알아가는 대화가 될 수 있어요.',
  '최근 고마웠던 사람을 떠올려 보세요. 부담 없는 한 줄로 마음을 전해도 충분해요.',
  '먼저 가벼운 안부를 건네 보세요. 답장의 속도에 의미를 붙이지 않고 편하게 기다려도 좋아요.',
  '취향이 다른 점을 틀린 것으로 여기지 않아도 돼요. 좋아하는 이유를 한 번 물어보세요.',
  '오늘은 듣고 싶은 말을 먼저 다정하게 건네 보세요. 억지로 분위기를 바꿀 필요는 없어요.',
  '혼자 쉬고 싶다면 그 마음도 존중해 주세요. 다음에 이야기하자는 편안한 한마디면 괜찮아요.',
  '칭찬은 작은 장면을 구체적으로 짚어 보세요. 무엇이 고마웠는지 말하면 마음이 더 잘 전해져요.',
  '친숙한 사람에게도 새로운 질문 하나를 던져 보세요. 요즘 즐기는 것부터 물어봐도 좋아요.',
  '추측으로 마음을 정하기보다 차분히 물어보세요. 모르는 것은 모르는 채로 두어도 괜찮아요.',
  '함께 웃었던 기억 하나를 떠올려 보세요. 반가운 추억을 짧게 나누는 것도 좋은 대화예요.',
  '약속을 더하기 전에 내 여유를 먼저 살펴보세요. 편안한 범위를 솔직하게 말해도 좋아요.',
  '내 이야기를 조금 나누고 상대의 이야기도 초대해 보세요. 대화의 빈틈을 급히 채우지 않아도 돼요.',
];
const focus = [
  '해야 할 일을 세 개 안으로 적고 가장 짧은 것부터 시작해 보세요.',
  '시작하기 전에 필요한 물건만 가까이 두어 보세요. 준비를 작게 마치는 것도 시작이에요.',
  '한 번에 여러 일을 하기보다 지금 하는 일 하나에 잠깐 머물러 보세요.',
  '오래 멈춰 있던 일은 첫 단계만 적어 보세요. 오늘은 그 단계까지만 해도 괜찮아요.',
  '메모를 한 곳에 모아 보세요. 지금 필요한 것과 나중에 볼 것을 나누면 찾기 쉬워져요.',
  '할 일 사이에 짧은 여백을 넣어 보세요. 창밖을 보는 시간도 하루의 일부예요.',
  '이미 끝낸 일을 하나 표시해 보세요. 남은 목록만큼 해낸 목록도 살펴봐요.',
  '집중이 잘되는 자리를 떠올려 보세요. 빛이나 소리 한 가지만 편하게 바꿔 봐도 좋아요.',
  '머릿속에 맴도는 생각을 한 줄로 적어 보세요. 지금 해결하지 않아도 기록해 둘 수 있어요.',
  '완료의 기준을 작게 정해 보세요. 어느 정도면 오늘은 충분한지 먼저 정하면 편해져요.',
  '자주 쓰는 파일이나 물건 하나만 정리해 보세요. 다음에 쉽게 찾을 수 있는 자리를 골라요.',
  '오늘 잘 맞았던 방법 하나를 기억해 두세요. 내일도 써 보고 싶은 작은 요령이면 좋아요.',
];
const actions = [
  '지금 눈에 보이는 것 중 마음에 드는 색 하나를 찾아보세요.',
  '좋아하는 노래 한 곡을 골라 끝까지 들어 보세요.',
  '오늘 고마웠던 일 하나를 한 문장으로 적어 보세요.',
  '책상 위 물건 세 개를 제자리로 돌려놓아 보세요.',
  '친구에게 요즘 즐겨 듣는 노래를 물어보세요.',
  '창밖 풍경을 잠깐 바라보고 눈에 들어온 것 하나를 기억해 보세요.',
  '오늘 해낸 일 하나에 작은 체크를 남겨 보세요.',
  '읽고 싶었던 책의 첫 페이지를 펼쳐 보세요.',
  '나중에 하고 싶은 작은 즐거움 하나를 메모해 보세요.',
  '지금의 기분을 한 단어로 적고 그대로 인정해 주세요.',
  '가까운 사람에게 구체적인 고마움 한 가지를 전해 보세요.',
  '내일의 나에게 짧은 응원 한 줄을 남겨 보세요.',
];
const colors = ['버터 옐로', '맑은 파랑', '산뜻한 초록', '부드러운 코랄', '포근한 크림', '연한 보라'];

// 별자리 모드는 별도의 창작 문구를 쓴다. 실제 천체 이동이나 출생 차트 해석이 아니다.
const westernThemes = [
  ['작은 용기에 불을 켜는 날', '마음속에만 두었던 아이디어를 밖으로 꺼내 보세요. 오늘의 모험은 거창할 필요 없이 첫 문장 하나면 충분해요.'],
  ['오감으로 하루를 즐기는 날', '좋아하는 향과 색, 편안한 촉감을 가까이 두어 보세요. 나에게 잘 맞는 감각을 발견하는 데서 오늘의 즐거움이 시작돼요.'],
  ['새로운 이야기가 궁금한 날', '평소 고르지 않던 주제를 잠깐 들여다보세요. 낯선 생각과 익숙한 생각이 만나는 지점을 메모해 봐도 좋아요.'],
  ['마음의 안식처를 찾는 날', '편안함을 느끼는 장소나 사람을 떠올려 보세요. 바깥의 소식에서 잠시 떨어져 내 마음을 돌보는 시간을 가져요.'],
  ['내 색깔을 드러내는 날', '오늘은 마음에 드는 취향을 숨기지 않아도 좋아요. 좋아하는 옷이나 음악으로 나다운 장면을 하나 만들어 보세요.'],
  ['작은 디테일이 빛나는 날', '지나치기 쉬운 부분 하나에 애정을 들여 보세요. 완벽하게 고치려는 마음보다 조금 더 편해지는 변화면 충분해요.'],
  ['균형을 다시 맞추는 날', '내가 원하는 것과 함께할 수 있는 것을 나란히 놓아 보세요. 둘 중 하나를 급히 고르기보다 편안한 접점을 찾아봐요.'],
  ['한 가지를 깊이 보는 날', '여러 가지를 얕게 훑기보다 궁금한 것 하나에 머물러 보세요. 다 알지 못해도 나만의 질문이 생겼다면 괜찮아요.'],
  ['시야를 넓혀 보는 날', '가 보고 싶은 곳이나 배워 보고 싶은 것을 떠올려 보세요. 오늘 바로 떠나지 않아도 작은 계획을 상상하는 재미가 있어요.'],
  ['나만의 목표를 세우는 날', '남들이 정한 성공보다 내가 기뻐할 마무리를 골라 보세요. 목표를 작게 나누면 오늘 남길 발자국도 또렷해져요.'],
  ['다른 각도로 생각하는 날', '늘 당연하게 여기던 방식에 가벼운 질문을 던져 보세요. 엉뚱해 보이는 발상도 메모해 두면 즐거운 실험이 될 수 있어요.'],
  ['상상에 여백을 주는 날', '마음에 떠오르는 장면을 그림이나 단어로 남겨 보세요. 잘 표현하려 애쓰지 않고 상상 자체를 즐겨도 좋아요.'],
  ['우연한 연결을 즐기는 날', '서로 관계없어 보이는 관심사 두 가지를 붙여 보세요. 새로운 답보다 예상하지 못한 질문을 발견하는 날로 만들어 봐요.'],
  ['나의 반짝임을 알아보는 날', '오늘 자연스럽게 잘했던 순간을 떠올려 보세요. 다른 사람의 평가를 기다리지 않고 그 장점을 스스로 알아줘도 좋아요.'],
  ['마음의 방향을 살피는 날', '무엇을 더 해야 할지보다 어디에 마음이 가는지 살펴보세요. 지금의 관심사를 한 단어로 적어 두는 것부터 시작해 봐요.'],
  ['새로운 가능성을 그리는 날', '같은 하루를 조금 다르게 보낼 방법을 상상해 보세요. 익숙한 선택 하나를 바꾸는 것만으로도 작은 모험이 돼요.'],
];
const westernRelationships = [
  '상대에게 요즘 가장 설레는 일이 무엇인지 물어보세요. 서로의 관심사가 달라도 즐겁게 들을 수 있어요.',
  '함께하고 싶은 작은 경험을 하나 제안해 보세요. 일정이 맞지 않아도 제안한 마음은 가볍게 남겨 둬요.',
  '대화에서 내 취향을 한 가지 더 보여 주세요. 같은 점을 찾는 만큼 다른 점을 알아가는 재미도 있어요.',
  '마음에 남은 말을 혼자 해석하기보다 뜻을 물어보세요. 편하게 확인하는 대화가 오해를 줄여 줘요.',
  '가까운 사람의 새로운 모습을 발견했다면 말로 전해 보세요. 언제나 알던 사이라고 생각하지 않아도 돼요.',
  '함께 결정할 때 각자가 원하는 것을 하나씩 꺼내 보세요. 모든 의견을 바로 하나로 맞출 필요는 없어요.',
  '오늘의 에너지가 적다면 짧고 따뜻한 인사만 건네도 좋아요. 관계에도 내 리듬을 지킬 자리가 있어요.',
  '말로 설명하기 어려운 취향은 노래나 사진으로 나눠 보세요. 한 장면이 대화의 시작이 될 수 있어요.',
];
const westernFocus = [
  '아이디어를 평가하기 전에 세 가지 적어 보세요. 그중 가장 궁금한 하나를 골라 작은 실험을 시작해요.',
  '막힌 일은 질문의 방향을 바꿔 보세요. 더 쉽게 할 수 있는 방법이 무엇인지 한 줄로 적어 봐요.',
  '마음에 드는 작업 환경을 한 가지 만들어 보세요. 좋아하는 색의 메모 한 장도 작은 계기가 돼요.',
  '오늘의 목표에 내가 좋아하는 요소를 더해 보세요. 해야 하는 일 속에서도 즐길 부분을 찾아봐요.',
  '넓게 펼친 생각 중 연결되는 두 개를 골라 보세요. 완성된 답이 없어도 연결선을 그려 보는 것으로 충분해요.',
  '혼자 오래 고민한 일은 다른 관점의 질문을 적어 보세요. 보는 위치를 바꾸는 연습부터 해도 좋아요.',
  '새로운 방법을 시험할 시간을 짧게 정해 보세요. 맞지 않으면 원래 방식으로 돌아와도 괜찮아요.',
  '마지막에 돌아볼 기록을 한 줄 남겨 보세요. 오늘 처음 알게 된 것이 무엇인지 적어 봐요.',
];

function hash(value) {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619) >>> 0;
  return result;
}

export function getFortune(signId, date = seoulDateKey(), mode = 'korean') {
  const signs = getSigns(mode);
  const index = signs.findIndex(sign => sign.id === signId);
  if (index < 0) throw new TypeError(mode === 'western' ? '12가지 별자리 중 하나를 골라 주세요.' : '12가지 띠 중 하나를 골라 주세요.');
  validateDateKey(date);
  const western = mode === 'western';
  // Legacy 12-animal results remain available without being relabeled as birth-based saju.
  const modeLabel = western ? FORTUNE_MODES.find(item => item.id === mode).label : '한국 운세 · 띠별';
  const day = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86_400_000);
  const themePool = western ? westernThemes : themes;
  const theme = themePool[((day + index * 5) % themePool.length + themePool.length) % themePool.length];
  // 기존 한국 운세의 날짜별 결과는 유지하고 별자리의 추첨 키만 분리한다.
  const seed = western ? `${date}/${mode}/${signId}` : `${date}/${signId}`;
  const pick = (category, choices) => choices[hash(`${seed}/${category}`) % choices.length];
  return Object.freeze({
    date, mode, modeLabel, signId, signLabel: signs[index].label, title: theme[0], overall: theme[1],
    relationship: pick('relationship', western ? westernRelationships : relationships),
    focus: pick('focus', western ? westernFocus : focus), action: pick('action', actions),
    color: pick('color', colors), number: hash(`${seed}/number`) % 9 + 1,
  });
}

export function fortuneText(fortune) {
  return [
    `SYNK 무료 운세 · ${fortune.date} · ${fortune.modeLabel || '한국 운세 · 띠별'} · ${fortune.signLabel}`, fortune.title, '',
    `총운 | ${fortune.overall}`, `관계 | ${fortune.relationship}`, `일상과 집중 | ${fortune.focus}`, '',
    `오늘의 작은 행동 | ${fortune.action}`, `행운의 색 | ${fortune.color}`, `행운의 숫자 | ${fortune.number}`, '',
    '가볍게 읽는 재미용 운세예요. 미래를 예측하지 않아요.',
    fortune.mode === 'western' ? '일반적인 12궁을 바탕으로 한 창작 운세이며, 정밀 천체 계산을 하지 않아요.' : '12띠로 보는 운세이며, 생년월일시로 풀이하는 사주는 아니에요.',
  ].join('\n');
}
