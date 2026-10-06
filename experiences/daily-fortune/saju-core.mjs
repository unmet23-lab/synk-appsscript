import { Solar, LunarUtil } from './vendor/lunar-javascript-1.7.7/lunar.mjs';
import { seoulDateKey, validateDateKey } from './core.mjs';

export const SAJU_MIN_DATE = '1900-01-01';
export const SAJU_MAX_DATE = '2100-12-31';
export const SAJU_CONVENTION = Object.freeze({
  timezone: 'UTC+09:00', calendar: '양력', yearBoundary: '입춘 절입 시각', monthBoundary: '12절 절입 시각',
  dayBoundary: '00:00', ziHourStart: '23:00', sect: 2, trueSolarTime: false, historicalTimezoneCorrection: false,
});

const elementRows = [
  ['wood', '목', '木', '성장과 시작'], ['fire', '화', '火', '표현과 온기'], ['earth', '토', '土', '돌봄과 기반'],
  ['metal', '금', '金', '정리와 기준'], ['water', '수', '水', '흐름과 배움'],
];
const elementByHanja = Object.fromEntries(elementRows.map(([id, label, hanja, symbol]) => [hanja, { id, label, hanja, symbol }]));
const stemNames = Object.fromEntries([...('甲乙丙丁戊己庚辛壬癸')].map((hanja, i) => [hanja, ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'][i]]));
const branchNames = Object.fromEntries([...('子丑寅卯辰巳午未申酉戌亥')].map((hanja, i) => [hanja, ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'][i]]));

function deepFreeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') deepFreeze(child);
  return Object.freeze(value);
}

function pillar(id, label, pair) {
  const [gan, zhi] = [...pair];
  const stemElement = elementByHanja[LunarUtil.WU_XING_GAN[gan]];
  const branchElement = elementByHanja[LunarUtil.WU_XING_ZHI[zhi]];
  if (!stemElement || !branchElement) throw new Error('사주 간지를 계산하지 못했습니다.');
  const stem = { hanja: gan, hangul: stemNames[gan], element: stemElement.label };
  const branch = { hanja: zhi, hangul: branchNames[zhi], element: branchElement.label };
  return { id, label, known: true, hanja: pair, hangul: stem.hangul + branch.hangul, stem, branch };
}

function unknownPillar(id, label, reason) {
  return { id, label, known: false, hanja: '', hangul: '', stem: null, branch: null, reason };
}

function solarAt(date, time = '12:00', second = 0) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return Solar.fromYmdHms(year, month, day, hour, minute, second);
}

function termChartAtKst(date, time, second = 0) {
  // lunar-javascript's ShouXingUtil.qiAccurate adds ONE_THIRD day: its terms are UTC+8.
  // Compare the SAME INSTANT in UTC+8, while day/hour pillars below keep the KST clock.
  // Fixed offset arithmetic is intentional: no host timezone, historical DST, or true solar time.
  const instant = new Date(`${date}T${time}:${String(second).padStart(2, '0')}+09:00`).getTime();
  const chinaClock = new Date(instant + 8 * 3_600_000);
  return Solar.fromYmdHms(chinaClock.getUTCFullYear(), chinaClock.getUTCMonth() + 1, chinaClock.getUTCDate(),
    chinaClock.getUTCHours(), chinaClock.getUTCMinutes(), chinaClock.getUTCSeconds()).getLunar().getEightChar();
}

function validateInput(input, today) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('생년월일과 태어난 시간을 입력해 주세요.');
  validateDateKey(today);
  if (today < SAJU_MIN_DATE || today > SAJU_MAX_DATE) throw new RangeError('지원하는 날짜 범위는 1900년부터 2100년까지예요.');
  validateDateKey(input.birthDate);
  if (input.birthDate < SAJU_MIN_DATE || input.birthDate > today || input.birthDate > SAJU_MAX_DATE) {
    throw new RangeError('생년월일은 1900년 1월 1일부터 오늘까지 입력해 주세요.');
  }
  const birthTime = input.birthTime ?? null;
  if (birthTime !== null && (typeof birthTime !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(birthTime))) {
    throw new TypeError('태어난 시간은 00:00부터 23:59까지 입력하거나 시간 모름을 선택해 주세요.');
  }
  return { birthDate: input.birthDate, birthTime };
}

// The familiar generating/control cycles provide a transparent creative prompt, not a prediction.
// No strength, hidden stems, combinations/clashes, luck periods, or useful-god judgement is inferred.
const readings = {
  same: {
    phrase: '내 리듬을 돌아봐요', relation: '같은 오행이 만나는 비화의 상징',
    relationship: '비슷한 점을 찾으려 애쓰기보다 서로 지금 원하는 것을 하나씩 나눠 보세요. 같아도 달라도 괜찮아요.',
    focus: '내가 편하게 해 온 방법 하나를 떠올려 보세요. 오늘도 도움이 될지 작은 일에서 시험해 봐요.',
    action: '지금 내게 필요한 여유를 한 단어로 적어 보세요.',
  },
  supported: {
    phrase: '배울 여유를 남겨요', relation: '오늘의 오행이 일간의 오행을 생하는 상생의 상징',
    relationship: '도움이 필요하다면 필요한 부분을 구체적으로 말해 보세요. 도움을 주고받는 범위도 편안하게 정해요.',
    focus: '바로 답을 내려 하기보다 참고할 자료 한 가지를 골라 읽어 보세요. 새롭게 알게 된 한 줄이면 충분해요.',
    action: '최근 배운 작은 요령 하나를 기록해 보세요.',
  },
  expressing: {
    phrase: '생각을 작게 표현해요', relation: '일간의 오행이 오늘의 오행을 생하는 상생의 상징',
    relationship: '떠오른 생각을 완성된 답처럼 말할 필요는 없어요. 가벼운 제안으로 나누고 상대의 생각도 들어 보세요.',
    focus: '머릿속 아이디어를 한 문장이나 작은 그림으로 꺼내 보세요. 다듬는 일은 그다음에 해도 괜찮아요.',
    action: '나누고 싶은 생각 하나를 한 문장으로 적어 보세요.',
  },
  organizing: {
    phrase: '내 기준을 정리해요', relation: '일간의 오행이 오늘의 오행을 제어하는 상극의 상징',
    relationship: '무엇이 가능한지와 어려운지를 부드럽게 구분해 말해 보세요. 서로의 경계를 아는 것도 대화예요.',
    focus: '벌여 놓은 일 가운데 오늘 손볼 수 있는 하나만 골라 보세요. 작은 기준부터 정하면 시작하기 쉬워요.',
    action: '오늘 꼭 할 일 한 가지와 미뤄도 될 일 한 가지를 나눠 적어 보세요.',
  },
  balancing: {
    phrase: '기준과 여유를 함께 챙겨요', relation: '오늘의 오행이 일간의 오행을 제어하는 상극의 상징',
    relationship: '약속이나 기대가 부담스럽다면 조정할 부분을 차분히 말해 보세요. 혼자 짐작해서 모두 떠맡지 않아도 돼요.',
    focus: '따라야 하는 기준을 짧게 적고 그 안에서 편하게 할 방법을 찾아보세요. 기준이 곧 나의 가치는 아니에요.',
    action: '오늘 일정 사이에 쉬어 갈 짧은 틈 하나를 표시해 보세요.',
  },
};

function relationKey(dayElement, todayElement) {
  const self = elementRows.findIndex(row => row[1] === dayElement);
  const other = elementRows.findIndex(row => row[1] === todayElement);
  if (self === other) return 'same';
  if ((other + 1) % 5 === self) return 'supported';
  if ((self + 1) % 5 === other) return 'expressing';
  if ((self + 2) % 5 === other) return 'organizing';
  return 'balancing';
}

export function getSaju(input, today = seoulDateKey()) {
  const { birthDate, birthTime } = validateInput(input, today);
  const timeKnown = birthTime !== null;
  const clockChart = solarAt(birthDate, birthTime ?? '12:00').getLunar().getEightChar();
  clockChart.setSect(2); // Day changes at 00:00. 23:00 starts Zi hour with next day's hour stem.
  const termChart = termChartAtKst(birthDate, birthTime ?? '12:00');
  const pillars = [pillar('year', '연주', termChart.getYear()), pillar('month', '월주', termChart.getMonth()),
    pillar('day', '일주', clockChart.getDay()),
    timeKnown ? pillar('hour', '시주', clockChart.getTime()) : unknownPillar('hour', '시주', '출생 시간 모름')];
  const notes = [
    '양력·고정 한국표준시(UTC+9) 기준이에요. 해외 현지시각, 진태양시, 과거 표준시·서머타임은 자동 보정하지 않아요.',
    '연주는 입춘의 절입 시각, 월주는 12절의 절입 시각에 바뀌어요.',
    '일주는 00시에 바뀌는 야자시 구분법을 써요. 23시부터 자시이며, 23시대 시주의 천간은 다음 날 자시 규칙을 적용해요.',
    '오행은 확인된 천간·지지의 대표 오행 개수예요. 지장간·합충·신강신약·용신·대운을 풀이하지 않으며 개수가 성격이나 강약을 확정하지 않아요.',
    '오늘의 문구는 일간과 오늘 일간의 오행 관계에서 만든 상징적 읽을거리예요. 미래의 길흉이나 실제 사건을 예측하지 않아요.',
  ];
  if (!timeKnown) {
    notes.push('출생 시간이 없어 시주는 비워 두었어요. 시주를 임의로 채우지 않고 확인된 기둥만 오행에 셌어요.');
    const start = termChartAtKst(birthDate, '00:00');
    const end = termChartAtKst(birthDate, '23:59', 59);
    for (const [index, method] of [[0, 'getYear'], [1, 'getMonth']]) {
      if (start[method]() !== end[method]()) {
        const { id, label } = pillars[index];
        pillars[index] = unknownPillar(id, label, '절입 당일 · 출생 시간 필요');
        notes.push(`태어난 날에 절기가 바뀌어 ${label}를 확정할 수 없어요. 출생 시간을 알면 절입 전후를 구분할 수 있어요.`);
      }
    }
  }
  const elements = elementRows.map(([id, label, hanja]) => ({ id, label, hanja,
    count: pillars.reduce((sum, item) => sum + (item.known ? Number(item.stem.element === label) + Number(item.branch.element === label) : 0), 0) }));
  const dayMaster = { ...pillars[2].stem };
  const todayChart = solarAt(today).getLunar().getEightChar();
  todayChart.setSect(2);
  const todayPillar = pillar('today', '오늘의 일진', todayChart.getDay());
  const key = relationKey(dayMaster.element, todayPillar.stem.element);
  const reading = readings[key];
  const symbol = elementRows.find(row => row[1] === dayMaster.element)[3];
  return deepFreeze({
    date: today, mode: 'korean', modeLabel: '한국 사주', signId: 'saju', signLabel: `${dayMaster.hangul}${dayMaster.element} 일간`,
    birthDate, birthTime, timeKnown, pillars, elements, dayMaster, todayPillar, notes, convention: { ...SAJU_CONVENTION },
    title: `${todayPillar.hangul}일, ${reading.phrase}`,
    overall: `일간은 ${dayMaster.hanja}(${dayMaster.hangul}), 오행은 ${dayMaster.element}에 해당해요. 전통에서 ${dayMaster.element} 오행은 ${symbol}의 상징으로 읽어요. 오늘 일간 ${todayPillar.stem.hanja}(${todayPillar.stem.hangul})의 ${todayPillar.stem.element} 오행과 함께 ${reading.relation}을 가볍게 떠올려 보세요. 이 관계만으로 성격이나 길흉을 판단하지 않아요.`,
    relationship: reading.relationship, focus: reading.focus, action: reading.action,
  });
}

export function sajuText(result) {
  return [
    `SYNK 무료 운세 · 한국 사주 · ${result.date}`, result.title, '',
    ...result.pillars.map(item => `${item.label} | ${item.known ? `${item.hanja} (${item.hangul})` : `미확정 · ${item.reason}`}`),
    `일간 | ${result.dayMaster.hanja} (${result.dayMaster.hangul}) · ${result.dayMaster.element}`,
    `겉글자 오행 | ${result.elements.map(item => `${item.label} ${item.count}`).join(' · ')}`, '',
    `오늘의 읽을거리 | ${result.overall}`, `관계 | ${result.relationship}`, `일상과 집중 | ${result.focus}`, '',
    `오늘의 작은 행동 | ${result.action}`, '', ...result.notes,
  ].join('\n');
}
