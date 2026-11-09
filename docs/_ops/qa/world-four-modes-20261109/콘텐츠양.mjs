// 맞춤 연습이 고를 수 있는 콘텐츠가 얼마나 있나 — 실제 파일에서 센다(읽기 전용).
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const ROOT = process.argv[2];
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const require = createRequire(pathToFileURL(path.join(ROOT, 'package.json')).href);
const out = {};

const life = await imp('experiences/synk-world-app/life-content.mjs');
const LESSONS = life.LESSONS, PACKS = life.PACKS;
const qs = LESSONS.flatMap(l => l.questions || []);
const mins = LESSONS.reduce((n, l) => n + (l.id === 'cafe-compose' ? 4 : l.type === 'story' ? 3 : 2), 0);
out.life = {packs: PACKS.map(p => `${p.id}:${p.lessons.length}`).join(' '), lessons: LESSONS.length, questions: qs.length, minutes: mins,
  skills: [...new Set(qs.map(q => q.skillId))].length};

const {LISTENING_CHECKS} = await imp('experiences/korean-runner/listening-check.mjs');
out.runner = LISTENING_CHECKS.length;
const {RHYTHM_CANDIDATES} = await imp('experiences/korean-rhythm/personalization.mjs');
out.rhythm = RHYTHM_CANDIDATES.length;
const {PLAN_ITEMS} = await imp('experiences/subway-rush/plan-items.mjs');
out.subway = PLAN_ITEMS.length;

const j = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const try_ = (name, fn) => { try { out[name] = fn(); } catch (e) { out[name] = '못 읽음: ' + e.message.slice(0, 80); } };
try_('writingItems', () => { const b = j('experiences/synk-world-app/world-writing-items.json'); const items = b.items || b; const passed = items.filter(i => i?.review?.status === 'passed'); const by = {}; for (const i of passed) by[i.type] = (by[i.type] || 0) + 1; return {total: items.length, passed: passed.length, byType: by}; });
try_('speakingItems', () => { const b = j('experiences/synk-world-app/world-speaking-items.json'); const items = b.items || b; return {total: items.length}; });
try_('topikItems', () => { const b = j('experiences/synk-world-app/world-topik-items.json'); const items = b.items || b; const by = {}; for (const i of items) { const k = `${i.exam || i.level || i.grade || '?'}|${i.domain || i.section || i.skillId?.split('.')[1] || '?'}`; by[k] = (by[k] || 0) + 1; } return {total: items.length, by}; });

console.log(JSON.stringify(out, null, 1));
