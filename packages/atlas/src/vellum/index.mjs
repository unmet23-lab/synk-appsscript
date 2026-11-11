// Vellum 문장 표(설계 §7 「문장 표 한 곳」 · 단계 4 계획 §4). 이유 { code, slots }를 화면 언어 · 눈높이 · 말하는 사람에 맞는 문장으로 그린다.
//   표: 종류(code) → 화면 언어 → 눈높이 → 말하는 사람 → 문장 틀들. 실행 중에 모델을 부르지 않는다 — 문장은 미리 쓰고 빈칸만 끼운다.
//   물러서기: 말하는 사람 → default, 눈높이 → 같은 언어의 standard. **언어는 물러서지 않는다** — 그 언어 줄이 없으면 null
//            (제품은 이유 줄을 비운다. 한국어를 못 읽는 사람에게 한국어 문장을 보이지 않는다).
//   이름: 문장이 가리키는 단위 · 능력 · 주제의 화면 이름은 제품이 label(id)로 준다. 이름이 있어야 하는 문장에 이름이 없으면 null.
//   고르기: 틀이 여럿이면 (날짜 열쇠, 가리키는 id)로 정한다 — 같은 날 같은 것에는 같은 말, 기기 언어 · 시각 순서를 타지 않는다.
import { EN } from './en.mjs';
import { josa } from './josa.mjs';
import { KO } from './ko.mjs';
import { MN } from './mn.mjs';

export const LANGS = Object.freeze(['ko', 'en', 'mn']);
export const LEVELS = Object.freeze(['word', 'easy', 'standard']);
export const SPEAKERS = Object.freeze(['default', 'marin', 'kkamong', 'mongle']);

// 언어마다 줄 묶음. 영어 · 몽골어는 그 화면이 열릴 때 세 겹 대조를 거쳐 들어온다(단계 4 계획 §4) — 영어는 WORLD 짧은 연습(4-1)의 종류부터.
const TABLE = Object.freeze({ ko: KO, en: EN, mn: MN });

// 문장이 가리키는 것의 id가 든 근거 칸.
const SUBJECT_SLOT = Object.freeze({
  'skill.up': 'skill',
  'skill.ease': 'skill',
  'goal.match': 'topic',
  'host.homework': 'skill',
});
const NAMELESS = new Set([
  'idle',
  'day.capped',
  'pace.stubborn',
  'host.resume',
  'host.prerequisite',
  'host.form',
  'host.recheck',
  'host.start',
  'host.next',
]);

export const subjectOf = why => why.slots?.[SUBJECT_SLOT[why.code] ?? 'unit'] ?? null;

const hash = text => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

function templatesOf(code, { lang, level, speaker }) {
  const row = TABLE[lang]?.[code];
  if (!row) return null;
  const byLevel = row[level] ?? row.standard;
  if (!byLevel) return null;
  const list = byLevel[speaker] ?? byLevel.default;
  return list?.length ? list : null;
}

function nameOf(why, label) {
  if (NAMELESS.has(why.code)) return '';
  const id = subjectOf(why);
  if (id == null) return null;
  const name = label(id);
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

// why = { code, slots } → 문장 | null.
export function render(
  why,
  { lang = 'ko', level = 'standard', speaker = 'default', label = id => id, day = 0 } = {},
) {
  if (!why?.code) return null;
  const list = templatesOf(why.code, { lang, level, speaker });
  if (!list) return null;
  const name = nameOf(why, label);
  if (name === null) return null;
  const pick = list.length === 1 ? 0 : hash(`${day}|${subjectOf(why) ?? ''}`) % list.length;
  return list[pick](why.slots ?? {}, name, josa);
}
