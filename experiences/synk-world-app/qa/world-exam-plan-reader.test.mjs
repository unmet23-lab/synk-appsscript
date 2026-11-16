// 이번 주 계획의 능력 읽개(Atlas 재설계 단계 4-4b — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §21-6 · 검토 D2)의 관문.
// world-exam-plan.mjs는 지금 판이 쓰는 모듈이고 11-19 ~ 11-30 시범이 이 함수로 돈다. 그래서 읽개를 넘기지 않은 호출은 고치기 전 함수
// (e7d2bdea5 — qa/world-exam-plan-before-reader.mjs)와 결과가 깊이 같아야 한다. 입력은 지금 시험 묶음의 꼴(옛 Core · Trail 코치로 지은
// 합성 학생 — qa/topik-personalization.test.mjs와 같은 길)과 임의 입력을 둘 다 쓴다. 하나라도 어긋나면 올리지 않고 시범이 끝난 11-30 뒤로
// 미룬다(설계 주인 11-15).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { PACKS, LESSONS } from '../life-content.mjs';
import { createLifeProgress } from '../life-progress.mjs';
import { DIAGNOSTIC_ITEMS } from '../world-diagnostic-items.mjs';
import * as before from './world-exam-plan-before-reader.mjs';
import { pathToFileURL } from 'node:url';
// 변형 시험(qa/plan-mutants.mjs)은 깬 계획 사본을 SYNK_EXAM_PLAN_MODULE로 넘긴다. 그 밖에는 원본이다.
const exam = await import(process.env.SYNK_EXAM_PLAN_MODULE ? pathToFileURL(process.env.SYNK_EXAM_PLAN_MODULE).href : '../world-exam-plan.mjs');
import * as position from '../world-position.mjs';
import * as practice from '../world-reading-practice.mjs';

const require = createRequire(import.meta.url);
const browser = require('../../../atlas/game-browser.js');

const DAY = 86400000;
const START = Date.UTC(2026, 9, 19, 0);
const memory = () => {
  const values = new Map();
  return {
    get length() {
      return values.size;
    },
    key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
};
const VERDICTS = {
  version: 'topik-existing-verdicts-1',
  items: DIAGNOSTIC_ITEMS.filter(item => item.modality === 'reading').map(item => ({
    itemKey: item.itemKey,
    verdict: 'pass',
    skillId: item.skillId,
    difficulty: item.difficulty,
    responseFormat: item.responseFormat ?? 'unknown',
    familyKey: item.familyKey || item.itemKey,
  })),
};
const POOL = practice.practicePool({ items: DIAGNOSTIC_ITEMS, verdicts: VERDICTS });

// 합성 학생(qa/topik-personalization.test.mjs의 student · diagnose와 같은 길) — 홈 코치(짧은 진단)와 읽기 짧은 연습 코치가 기기 기록장을 함께 쓴다.
function student({ start = START, owner = 'synthetic' } = {}) {
  const storage = memory();
  let clock = start;
  let n = 0;
  const at = () => new Date(clock).toISOString();
  const coach = browser.engine.createGame({ gameId: 'world-home', storage, clock: at });
  const drill = browser.engine.createGame({ gameId: 'world-practice', storage, clock: at });
  const life = createLifeProgress({ storage, owner, now: () => clock, uuid: () => `${owner}-${++n}` });
  life.summary(PACKS, LESSONS);
  return { coach, drill, life, now: () => clock, tick: () => (clock += 1000), advance: ms => (clock += ms) };
}
function diagnose(s, { wrong = () => false, audio = true } = {}) {
  const plan = position.selectDiagnostic({
    summary: s.coach.summary(),
    items: DIAGNOSTIC_ITEMS,
    seen: item => s.coach.exposure(item).seen,
    audioAvailable: audio,
  });
  const session = position.createDiagnosticSession({ coach: s.coach, items: plan.items });
  for (let current = session.next(); current; current = session.next()) {
    s.tick();
    if (current.audio === 'pending') session.delivery('completed');
    const item = current.item;
    session.answer(wrong(item) ? item.choices.find(choice => choice.id !== item.correctId).id : item.correctId);
  }
}

// 결정적인 난수(씨앗마다 같은 입력)
function rng(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];
const SKILL_IDS = [
  'ko.listening.word',
  'ko.listening.sequence',
  'ko.listening.detail',
  'ko.reading.vocabulary',
  'ko.reading.detail',
  'ko.reading.grammar',
  'ko.reading.negation',
  'ko2.listening.detail',
  'ko2.listening.inference',
  'ko2.reading.detail',
  'ko2.reading.argument',
  'ko2.writing.argument',
  'ko2.writing.graph',
  'ko.writing.x',
  'other.thing',
  '',
];
const STATUSES = ['unseen', 'practice', 'supported', 'review', 'checking', 'recent-independent', 'confirmed', undefined];
function randomSummary(r) {
  if (r() < 0.08) return pick(r, [null, undefined, {}, { skills: null }, []]);
  const skills = [];
  const count = Math.floor(r() * 14);
  for (let i = 0; i < count; i += 1) {
    if (r() < 0.04) {
      skills.push(pick(r, [null, 7, 'x', {}]));
      continue;
    }
    const id = pick(r, SKILL_IDS);
    skills.push({
      id,
      domain: r() < 0.9 ? id.split('.')[1] : pick(r, ['listening', 'reading', 'writing', undefined]),
      status: pick(r, STATUSES),
      ...(r() < 0.8 ? { n: Math.floor(r() * 9) } : {}),
      ...(r() < 0.6 ? { incorrect: Math.floor(r() * 4) } : {}),
      ...(r() < 0.7 ? { priority: Math.floor(r() * 7) - 1 } : {}),
    });
  }
  return { evidenceComplete: r() < 0.8 ? true : pick(r, [false, undefined, 'yes']), skills };
}
function randomDate(r, now) {
  if (r() < 0.2) return null;
  const at = new Date(now + Math.floor((r() * 70 - 6) * 7) * DAY);
  const month = `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
  return r() < 0.5 ? month : `${month}-${String(Math.min(28, at.getUTCDate())).padStart(2, '0')}`;
}
function randomInput(seed) {
  const r = rng(seed);
  const now = START + Math.floor(r() * 400 * DAY) + Math.floor(r() * DAY);
  const type = pick(r, ['topik1', 'topik2', 'unknown', null]);
  const info = r() < 0.05 ? pick(r, [null, 'x']) : {
    type,
    grade: type === 'topik1' ? pick(r, [1, 2, null]) : type === 'topik2' ? pick(r, [3, 4, 5, 6, null]) : null,
    date: randomDate(r, now),
    mode: pick(r, ['pbt', 'ibt', 'unknown', null]),
    weeklyMinutes: pick(r, [30, 60, 120, 180, null]),
    ...(r() < 0.3 ? { speaking: r() < 0.7 } : {}),
  };
  const ids = SKILL_IDS.filter(id => id && r() < 0.4);
  const supply = Object.fromEntries(ids.map(id => [id, Math.floor(r() * 4)]));
  const available = {
    ...(r() < 0.7 ? { practice: supply } : r() < 0.5 ? { reading: supply } : {}),
    ...(r() < 0.5 ? { listening: Object.fromEntries(ids.filter(id => id.includes('listening')).map(id => [id, r() < 0.5 ? ['world.play.runner'] : []])) } : {}),
    ...(r() < 0.8 ? { recheck: pick(r, [0, 3, 15, 1.5, undefined]) } : {}),
    ...(r() < 0.8 ? { life: r() < 0.8 } : {}),
    ...(r() < 0.5 ? { writing: [{ id: 'topik2-writing-54', routeId: 'writing:54', skillIds: ['ko2.writing.argument'] }, ...(r() < 0.3 ? [{ id: 'w53', routeId: 'writing:53', skillIds: [] }] : [])] } : {}),
    ...(r() < 0.5 ? { topik2: { listening: r() < 0.5, reading: r() < 0.5 } } : {}),
    ...(r() < 0.4 ? { speaking: [{ id: 'speaking-3', route: 'speaking:3' }, ...(r() < 0.5 ? [{ id: 'speaking-5', route: 'speaking:5' }] : [])] } : {}),
  };
  const classwork = r() < 0.4 ? Array.from({ length: Math.floor(r() * 4) }, () => ({ kind: pick(r, ['reading', 'writing', 'listening']), done: r() < 0.5, ...(r() < 0.5 ? { title: '과제' } : {}) })) : [];
  const done = r() < 0.6 ? { listening: Math.floor(r() * 3), reading: Math.floor(r() * 3), writing: Math.floor(r() * 2), recheck: Math.floor(r() * 2), life: Math.floor(r() * 3), speaking: Math.floor(r() * 2) } : null;
  const examSkills = r() < 0.4 ? null : r() < 0.5 ? new Set(ids) : ids;
  return {
    exam: info,
    summary: randomSummary(r),
    now,
    done,
    available,
    classwork,
    audioAvailable: r() < 0.8,
    lastCheckAt: r() < 0.5 ? null : now - Math.floor(r() * 60) * DAY,
    speakingNeeds: r() < 0.5 ? null : Math.floor(r() * 3),
    examSkills,
  };
}

const same = (input, label) => {
  let old;
  let next;
  try {
    old = { value: before.buildExamPlan(structuredClone(input)) };
  } catch (error) {
    old = { error: error?.message };
  }
  try {
    next = { value: exam.buildExamPlan(structuredClone(input)) };
  } catch (error) {
    next = { error: error?.message };
  }
  assert.deepStrictEqual(next, old, label);
};

test('읽개 없이 부른 이번 주 계획은 고치기 전 함수와 깊이 같다 — 임의 입력 3,000개', () => {
  for (let seed = 1; seed <= 3000; seed += 1) same(randomInput(seed), `씨앗 ${seed}`);
});

test('읽개 없이 부른 이번 주 계획은 고치기 전 함수와 깊이 같다 — 지금 시험 묶음의 꼴(옛 Core · Trail 코치로 지은 합성 학생)', () => {
  const fresh = student();
  const diagnosed = student({ owner: 'diagnosed' });
  diagnose(diagnosed, { wrong: item => item.skillId?.includes('reading') && item.difficulty > 1 });
  const mixed = student({ owner: 'mixed' });
  diagnose(mixed, { wrong: (() => { let k = 0; return () => (k += 1) % 3 === 0; })() });
  mixed.advance(9 * DAY);
  for (const s of [fresh, diagnosed, mixed]) {
    for (const examType of ['topik1', 'topik2', 'unknown']) {
      for (const date of [null, '2027-01', '2026-11-30', '2026-09']) {
        for (const weekly of [30, 60, 120, 180, null]) {
          const info = exam.examInfo({ reasons: ['exam'], primaryReason: 'exam', examType, examDate: date ?? undefined, weeklyMinutes: weekly ?? undefined, targetGrade: examType === 'topik2' ? 4 : 2 });
          const summary = s.coach.summary();
          const events = s.coach.events();
          const week = exam.examWeek(s.now());
          for (const audio of [true, false]) {
            same(
              {
                exam: info,
                summary,
                now: s.now(),
                audioAvailable: audio,
                done: exam.weekActivity({ events, progress: s.life.exportSnapshot(), week }),
                lastCheckAt: exam.lastRecheck({ events, before: week.start }),
                examSkills: exam.examEvidenceSkills(events),
                available: {
                  practice: practice.practiceSupply({ pool: POOL, seen: item => s.drill.exposure(item).seen, audioAvailable: audio }),
                  listening: {},
                  recheck: 15,
                  life: true,
                  ...(examType === 'topik2' ? { writing: [{ id: 'topik2-writing-54', routeId: 'writing:54', skillIds: ['ko2.writing.argument'] }], topik2: { listening: false, reading: true } } : {}),
                },
              },
              `${examType} · ${date} · ${weekly} · 소리 ${audio}`,
            );
          }
        }
      }
    }
  }
});
