#!/usr/bin/env node
// 서울행 「내 팬」 1차의 팬 한마디(experiences/seoul-arrival/팬설계.md §12-3). 공개 묶음은 experiences/seoul-arrival만 싣고 packages/는 싣지 않는다.
// 그래서 문장 원천인 Vellum(packages/atlas/src/vellum)의 render로 모든 칸을 미리 그려 서울행 폴더에 생성 파일 하나로 둔다(다른 게임의 atlas-learning.js와 같은 방식).
// 쓰기: node tools/build-seoul-fan-lines.mjs [--check]
//  · 칸: scene.lines {n: 1~10}(1화 대본의 학생 줄 수보다 넉넉하게), scene.step {take2 · transfer} × {done · wait}. 언어 ko · en · mn, 말하는 사람 fan, 눈높이 standard.
//  · Vellum이 어느 칸에 문장을 돌려주지 않으면(null) 멈춘다. 빈 칸을 구워 두지 않는다.
//  · 결과: experiences/seoul-arrival/fan-lines.mjs(생성물, 커밋). import가 없는 ES 모듈이다. 열쇠 차례는 위 칸 차례 그대로, 줄끝은 \n.
//  · --check: 디스크의 파일이 새로 그린 것과 다르면 1로 끝난다(시험 · CI).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGS, render } from '../packages/atlas/src/vellum/index.mjs';
import { SCENE_STATES, SCENE_STEPS } from '../packages/atlas/src/vellum/slots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DESTINATION = path.join(ROOT, 'experiences/seoul-arrival/fan-lines.mjs');
export const MAX_LINES = 10;

// 잠시 따로 두는 글(11-26): Vellum 몽골어 scene.lines는 줄 수를 횟수로 말해 사실과 다르다(Atlas 검수 atlas-53-fan-text-20261125 GA1). 원천은 talk 배포가 끝날 때까지
// 얼어 있어서(Atlas 4c 세션) 서울행에 내는 글만 여기서 바로잡는다. 수를 센 꼴은 채점에서 어색해 수를 뺐다. 원천을 같은 글로 고치면 이 칸을 비운다.
export const HOLD = Object.freeze({ mn: Object.freeze({ 'scene.lines': 'Та дүрийнхээ үгийг чангаар хэлж үзлээ.' }) });

// [열쇠, 이유] — 생성 파일의 fanLine이 같은 열쇠를 이유에서 다시 짓는다.
export function fanRows() {
 const rows = [];
 for (let n = 1; n <= MAX_LINES; n += 1) rows.push([`scene.lines:${n}`, { code: 'scene.lines', slots: { n } }]);
 for (const step of SCENE_STEPS) for (const state of SCENE_STATES) rows.push([`scene.step:${step}:${state}`, { code: 'scene.step', slots: { step, state } }]);
 return rows;
}

export function buildFanLines() {
 const out = {};
 for (const lang of LANGS) {
  out[lang] = {};
  for (const [key, why] of fanRows()) {
   const line = render(why, { lang, level: 'standard', speaker: 'fan' });
   if (typeof line !== 'string' || !line.trim()) throw new Error(`Vellum이 문장을 돌려주지 않았다: ${lang} ${key}`);
   out[lang][key] = HOLD[lang]?.[why.code] ?? line;
  }
 }
 return out;
}

// 생성 파일의 fanLine — Vellum render(speaker fan)의 칸 검사와 같은 뜻이다(칸이 빠지거나 더 오면 · 글자로 넘긴 수 · 모르는 단계 · 상태 · 1~10 밖의 n이면 null).
const RUNTIME = `const own = (object, key) => (typeof key === 'string' && Object.hasOwn(object, key) ? object[key] : undefined);
const plain = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const keyOf = why => {
  const slots = why?.slots;
  if (!plain(slots)) return null;
  const names = Object.keys(slots).sort().join(',');
  if (why.code === 'scene.lines' && names === 'n' && Number.isSafeInteger(slots.n)) return \`scene.lines:\${slots.n}\`;
  if (why.code === 'scene.step' && names === 'state,step' && typeof slots.step === 'string' && typeof slots.state === 'string')
    return \`scene.step:\${slots.step}:\${slots.state}\`;
  return null;
};

// why = { code, slots } → 팬 한마디 | null. 모르는 언어 · 칸이면 null이다(다른 언어로 물러서지 않는다).
export function fanLine(lang, why) {
  const table = own(FAN_LINES, lang);
  const key = table ? keyOf(why) : null;
  return key ? (own(table, key) ?? null) : null;
}
`;

export function serialize(table) {
 const out = ['// Generated from packages/atlas/src/vellum (scene.lines · scene.step, 말하는 사람 fan). Change the source; run node tools/build-seoul-fan-lines.mjs.', '', 'export const FAN_LINES = Object.freeze({'];
 for (const lang of LANGS) {
  out.push(`  ${lang}: Object.freeze({`);
  for (const [key] of fanRows()) out.push(`    ${JSON.stringify(key)}: ${JSON.stringify(table[lang][key])},`);
  out.push('  }),');
 }
 out.push('});', '', RUNTIME);
 return out.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const args = process.argv.slice(2);
 if (args.some((a) => a !== '--check')) throw new Error('Usage: node tools/build-seoul-fan-lines.mjs [--check]');
 const text = serialize(buildFanLines());
 const same = fs.existsSync(DESTINATION) && fs.readFileSync(DESTINATION, 'utf8').replace(/\r\n/g, '\n') === text;
 if (args.includes('--check')) { if (!same) { console.error(`낡음: ${path.relative(ROOT, DESTINATION)} — node tools/build-seoul-fan-lines.mjs`); process.exit(1); } }
 else if (!same) fs.writeFileSync(DESTINATION, text);
 console.log(`${args.includes('--check') ? 'verified' : same ? 'unchanged' : 'built'} ${path.relative(ROOT, DESTINATION).replace(/\\/g, '/')}`);
}
