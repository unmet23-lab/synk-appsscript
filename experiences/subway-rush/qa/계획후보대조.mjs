// 공개 후보의 계정 묶음(라이브 판 + 끼운 계획 후보)이 원본 world-learning-plan.mjs와 같은 후보를 내는지 잰다(11-05). 공개후보.cjs가 부른다.
//   node experiences/subway-rush/qa/계획후보대조.mjs <후보 world-account.bundle.mjs> <원본 world-learning-plan.mjs>
// 묶음 전체는 브라우저 없이 못 읽을 수 있어, 묶음에서 후보를 만드는 함수 글자만 꺼내 실제 입력으로 돌린다.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const [bundlePath, sourcePath] = process.argv.slice(2);
const { PACKS } = await import(pathToFileURL(sourcePath.replace(/world-learning-plan\.mjs$/, 'life-content.mjs')).href);
const { buildWorldLearningCandidates: source } = await import(pathToFileURL(sourcePath).href);
const text = fs.readFileSync(bundlePath, 'utf8');
const pick = (start, end) => { const a = text.indexOf(start), b = text.indexOf(end, a); if (a < 0 || b < 0) throw Error(`묶음에서 못 찾음: ${start}`); return text.slice(a, b); };
const helper = pick('var SUBWAY_PLAN_ITEMS=', 'function buildWorldLearningCandidates(');
const box = {};
vm.createContext(box);
vm.runInContext(`${helper};globalThis.push=pushSubwayPlan;`, box);
const candidate = (progress, settings, openGames) => {
  const out = [], access = (id) => !Array.isArray(openGames) || openGames.includes(id) ? {} : { available: false, accountRequired: true };
  const finished = PACKS.flatMap((pack) => pack.lessons).filter((lesson) => Number.isFinite(progress.lessons?.[lesson.id]?.completedAt)).length;
  box.push(out, settings, access, 'PRESENTATION', finished);
  return JSON.parse(JSON.stringify(out[0] ?? null));
};
const NOW = Date.parse('2026-11-05T00:00:00Z');
const done = { lessons: { [PACKS[0].lessons[0].id]: { completedAt: NOW - 1000 } } };
const cases = [
  ['기록 없음', {}, {}, null],
  ['레슨 하나', done, {}, null],
  ['3급 목표', done, { examType: 'topik2', targetGrade: 3 }, null],
  ['2급 목표', done, { examType: 'topik1', targetGrade: 2 }, null],
  ['손님', done, {}, ['hangul']],
];
for (const [name, progress, settings, openGames] of cases) {
  const want = source({ progress, settings, now: NOW, openGames }).find((c) => c.gameId === 'subway') ?? null;
  const got = candidate(progress, settings, openGames);
  if (!want) { assert.equal(got, null, name); continue; }
  const { presentation, ...rest } = JSON.parse(JSON.stringify(want));
  const { presentation: ours, ...mine } = got;
  assert.deepEqual(mine, rest, name);
}
console.log(`계획 후보 대조: ${cases.length}경우 같음 · 문항 ${candidate(done, { targetGrade: 3 }, null).targets.length}개`);
