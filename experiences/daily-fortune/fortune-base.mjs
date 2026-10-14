// 무료 운세 계산 모듈(daily·flow·compat·tarot·year·me)이 함께 쓰는 순수 함수 모음.
// 외부 호출·호스트 시간대·Math.random을 쓰지 않는다. 같은 입력은 언제나 같은 값을 돌려준다.
import { Solar } from './vendor/lunar-javascript-1.7.7/lunar.mjs';
import { validateDateKey } from './core.mjs';
import { SAJU_MIN_DATE, SAJU_MAX_DATE } from './saju-core.mjs';
import { getZodiacProfile } from './insights.mjs';

export function deepFreeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object' && !Object.isFrozen(child)) deepFreeze(child);
  return Object.freeze(value);
}

export const mod = (value, size) => ((value % size) + size) % size;
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// FNV-1a 32비트. core.mjs의 운세 해시와 같은 방식이다.
export function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619) >>> 0;
  return result;
}

function generator(seed) {
  let state = hash(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0..size-1을 seed로 섞은 순서. */
export function shuffledOrder(size, seed) {
  const order = Array.from({ length: size }, (_, index) => index);
  const next = generator(seed);
  for (let index = size - 1; index > 0; index--) {
    const other = Math.floor(next() * (index + 1));
    [order[index], order[other]] = [order[other], order[index]];
  }
  return order;
}

/**
 * 같은 계열 문장에서 k번째로 쓰일 문장을 고른다. 사람마다 문장 순서를 한 번 섞고 k로 돌린다.
 * 연속한 k 값 pool.length개는 언제나 서로 다르다(같은 문장은 pool.length번째 뒤에야 돌아온다).
 */
export function rotationPick(pool, seed, k) {
  const order = shuffledOrder(pool.length, `${seed}/order`);
  return pool[order[mod(k + hash(`${seed}/offset`), pool.length)]];
}

export function dayNumber(date) {
  validateDateKey(date);
  return Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

export function addDays(date, amount) {
  return new Date((dayNumber(date) + amount) * 86_400_000).toISOString().slice(0, 10);
}

export function weekdayOf(date) {
  return ['일', '월', '화', '수', '목', '금', '토'][new Date(dayNumber(date) * 86_400_000).getUTCDay()];
}

export function assertSupportedDate(date) {
  validateDateKey(date);
  if (date < SAJU_MIN_DATE || date > SAJU_MAX_DATE) throw new RangeError('지원하는 날짜 범위는 1900년부터 2100년까지예요.');
  return date;
}

export const ELEMENTS = deepFreeze([
  { id: 'wood', label: '목', hanja: '木' }, { id: 'fire', label: '화', hanja: '火' }, { id: 'earth', label: '토', hanja: '土' },
  { id: 'metal', label: '금', hanja: '金' }, { id: 'water', label: '수', hanja: '水' },
]);
const elementIndex = label => ELEMENTS.findIndex(item => item.label === label);

export const STEMS = deepFreeze([
  ['甲', '갑', '목', '큰 나무'], ['乙', '을', '목', '풀과 꽃'], ['丙', '병', '화', '태양'], ['丁', '정', '화', '촛불'],
  ['戊', '무', '토', '큰 산'], ['己', '기', '토', '너른 들'], ['庚', '경', '금', '바위'], ['辛', '신', '금', '보석'],
  ['壬', '임', '수', '큰 바다'], ['癸', '계', '수', '단비'],
].map(([hanja, hangul, element, image], index) => ({ index, hanja, hangul, element, name: hangul + element, image, yang: index % 2 === 0 })));

export const BRANCHES = deepFreeze([
  ['子', '자', '수', 'rat'], ['丑', '축', '토', 'ox'], ['寅', '인', '목', 'tiger'], ['卯', '묘', '목', 'rabbit'],
  ['辰', '진', '토', 'dragon'], ['巳', '사', '화', 'snake'], ['午', '오', '화', 'horse'], ['未', '미', '토', 'sheep'],
  ['申', '신', '금', 'monkey'], ['酉', '유', '금', 'rooster'], ['戌', '술', '토', 'dog'], ['亥', '해', '수', 'pig'],
].map(([hanja, hangul, element, animalId], index) => ({ index, hanja, hangul, element, animalId })));

export const stemByHanja = hanja => STEMS.find(item => item.hanja === hanja) || null;
export const branchByHanja = hanja => BRANCHES.find(item => item.hanja === hanja) || null;

function pillarFromIndex(index) {
  const stem = STEMS[index % 10], branch = BRANCHES[index % 12];
  return { index, stem, branch, hangul: stem.hangul + branch.hangul, hanja: stem.hanja + branch.hanja };
}

// 1970-01-01은 辛巳일(60갑자 17번). 일주는 자정에 바뀌므로(saju-core의 sect 2) 날짜만으로 정해진다.
const DAY_GANZHI_OFFSET = 17;
export function dayPillar(date) {
  return pillarFromIndex(mod(dayNumber(date) + DAY_GANZHI_OFFSET, 60));
}

/** 그해 이름(예 2026 → 병오). 띠·연주의 입춘 경계와 달리 양력 연도 이름이다. */
export function yearPillar(year) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new RangeError('1900년부터 2100년까지의 연도를 골라 주세요.');
  return pillarFromIndex(mod(year - 4, 60));
}

/** 양력 year년 month월 15일 한국 정오에 걸린 절기 월주(월건). 절입일(4~8일)과 겹치지 않는 날로 고정한다. */
export function monthPillar(year, month) {
  yearPillar(year);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError('1월부터 12월까지 골라 주세요.');
  // lunar-javascript의 절기 시각은 UTC+8이므로 한국 정오는 그 시계로 11시다. 15일은 어느 절입과도 하루 이상 떨어져 있다.
  const pair = Solar.fromYmdHms(year, month, 15, 11, 0, 0).getLunar().getEightChar().getMonth();
  const stem = stemByHanja(pair[0]), branch = branchByHanja(pair[1]);
  return { index: findIndex(stem, branch), stem, branch, hangul: stem.hangul + branch.hangul, hanja: pair };
}

function findIndex(stem, branch) {
  for (let index = 0; index < 60; index++) if (index % 10 === stem.index && index % 12 === branch.index) return index;
  throw new Error('간지를 계산하지 못했어요.');
}

/**
 * 내 오행(self)과 상대 오행(other)의 관계. saju-core의 오늘 풀이와 같은 이름을 쓴다.
 * same 비화 · supported 피생(상대가 나를 생함) · expressing 생(내가 상대를 생함)
 * organizing 극(내가 상대를 극함) · balancing 피극(상대가 나를 극함)
 */
export function elementRelation(self, other) {
  const a = elementIndex(self), b = elementIndex(other);
  if (a < 0 || b < 0) throw new TypeError('오행을 확인하지 못했어요.');
  if (a === b) return 'same';
  if (mod(b + 1, 5) === a) return 'supported';
  if (mod(a + 1, 5) === b) return 'expressing';
  if (mod(a + 2, 5) === b) return 'organizing';
  return 'balancing';
}

/** 오행 생극 순서에서 label을 생하는 오행·label이 생하는 오행. */
export const generatingOf = label => ELEMENTS[mod(elementIndex(label) - 1, 5)].label;
export const generatedBy = label => ELEMENTS[mod(elementIndex(label) + 1, 5)].label;

// 지지 관계. 형·해·파는 쓰지 않는다.
const WONJIN = new Set(['0-7', '1-6', '2-9', '3-8', '4-11', '5-10']);
export function branchRelation(a, b) {
  const x = typeof a === 'number' ? a : a.index, y = typeof b === 'number' ? b : b.index;
  if (x === y) return 'same';
  if (Math.abs(x - y) === 6) return 'clash';
  if (mod(x + y, 12) === 1) return 'sixHarmony';
  if (x % 4 === y % 4) return 'threeHarmony';
  if (WONJIN.has(`${Math.min(x, y)}-${Math.max(x, y)}`)) return 'wonjin';
  return 'none';
}

const THREE_HARMONY_NAMES = ['신자진', '사유축', '인오술', '해묘미'];
export const threeHarmonyName = index => THREE_HARMONY_NAMES[index % 4];

export const WESTERN_ELEMENTS = deepFreeze({
  fire: { id: 'fire', label: '불' }, earth: { id: 'earth', label: '흙' }, air: { id: 'air', label: '바람' }, water: { id: 'water', label: '물' },
});
export const WESTERN_ELEMENT_IDS = Object.freeze(['fire', 'earth', 'air', 'water']);

export function signElement(signId) {
  return WESTERN_ELEMENTS[getZodiacProfile(signId).element.id];
}

/** 별자리 원소 궁합의 통상 구분: 같은 원소 · 불↔바람/흙↔물 보완 · 불↔흙/바람↔물 무난 · 불↔물/흙↔바람 다름. */
export function westernRelation(a, b) {
  if (a === b) return 'same';
  const pair = [a, b].sort().join('-');
  if (pair === 'air-fire' || pair === 'earth-water') return 'complement';
  if (pair === 'earth-fire' || pair === 'air-water') return 'neutral';
  return 'challenging';
}

export function sajuShape(saju) {
  if (!saju || saju.signId !== 'saju' || !Array.isArray(saju.pillars) || saju.pillars.length !== 4) {
    throw new TypeError('생년월일로 계산한 사주 결과가 필요해요.');
  }
  const day = saju.pillars[2];
  if (!day?.known || !saju.dayMaster?.hanja) return null;
  const stem = stemByHanja(saju.dayMaster.hanja), branch = branchByHanja(day.branch?.hanja);
  if (!stem || !branch) return null;
  const year = saju.pillars[0]?.known ? branchByHanja(saju.pillars[0].branch.hanja) : null;
  return { stem, branch, yearBranch: year, birthDate: saju.birthDate, birthTime: saju.birthTime ?? null };
}

// 금지어 검사용. 사주 용어(간지·일간 이름)와 별자리 이름에 들어간 글자는 문장 단어가 아니다.
export const NAME_TOKENS = Object.freeze([
  ...Array.from({ length: 60 }, (_, index) => pillarFromIndex(index).hangul),
  ...STEMS.map(item => item.name), '물병자리',
]);
