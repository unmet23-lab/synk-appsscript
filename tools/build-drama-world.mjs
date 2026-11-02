#!/usr/bin/env node
// 드라마 말하기 1화 시범판을 WORLD 안에서 여는 화면용 강의(2026-11-02, 설계 experiences/drama/qa/WORLD올리기-20261102/설계.md).
// 쓰기: node tools/build-drama-world.mjs [--check]
//  · 원천은 이PC 시범 서버와 같은 experiences/drama/pilot/content.mjs(PILOT). 서버가 /api/bootstrap으로 내던 것(publicLesson)에
//    talk 대사 은행 지문(linesVersion — talk world-drama-lines의 LINES_HASH와 같은 셈)과 대사마다 녹음 상한(answerSec — talk가
//    answerSec + 5초를 넘으면 too_long)을 더한다. 새 상황의 판정 명세는 싣지 않는다(판정은 talk가 한다).
//  · 새 상황의 모범 글(reveal)은 「모범 보기」를 누를 때만 화면에 보이지만 정적 파일이라 처음부터 받을 수 있다 — 코호트 시범의 알려진 한계(설계 §5).
//  · 미디어 주소는 문서 기준 상대 주소(media/…)로 — 시범 서버(/)와 WORLD(/world/drama/) 둘 다에서 풀린다.
//  · 결과: experiences/drama/pilot/world-lesson.json(생성물, 커밋). 미디어 파일 목록은 넣지 않는다(공개 빌드가 manifest.json으로 싣는다).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PILOT from '../experiences/drama/pilot/content.mjs';
import { publicLesson } from './lib/drama-pilot-service.mjs';
import { dramaLines, readEpisodes, linesHash } from './build-world-speaking-talk.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DESTINATION = path.join(ROOT, 'experiences/drama/pilot/world-lesson.json');
export const WORLD_LESSON_VERSION = 'drama-world-1';

const relative = (value) => (typeof value === 'string' && value.startsWith('/media/') ? value.slice(1) : value);
function relativize(value) {
 if (Array.isArray(value)) return value.map(relativize);
 if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, relativize(v)]));
 return relative(value);
}

export async function buildWorldLesson(pilot = PILOT) {
 const lines = dramaLines(await readEpisodes());
 const byId = new Map(lines.map((l) => [l.id, l]));
 const bank = (id) => {
  const l = byId.get(id);
  if (!l) throw new Error(`talk 대사 은행에 없는 줄: ${id}`);
  const text = id === pilot.transfer.id ? pilot.transfer.text : id === pilot.delayed?.id ? pilot.delayed.text : pilot.scene.find((x) => x.id === id)?.text;
  if (l.line !== text) throw new Error(`대사 글이 talk 은행과 다르다: ${id}`);
  return l;
 };
 const lesson = relativize(publicLesson(pilot));
 for (const item of lesson.scene) if (item.type === 'student') {
  const l = bank(item.id);
  item.answerSec = l.answerSec;
  item.reviewed = l.review.status === 'passed';
 }
 const unseen = (key) => {
  const t = bank(pilot[key].id);
  if (t.kind !== 'unseen') throw new Error(`${key}는 처음 보는 대사여야 한다`);
  if (lesson[key].reviewed !== (t.review.status === 'passed')) throw new Error(`${key} 검수 여부가 talk 은행과 다르다`);
  lesson[key] = { ...lesson[key], answerSec: t.answerSec };
 };
 unseen('transfer');
 // 7~10일 뒤 문항(설계 §17)은 새 상황과 다른 처음 보는 문항이고 같은 능력이어야 한다 — Atlas 측정 칸이 같아야 지연 관측으로 이어진다.
 if (pilot.delayed) {
  if (pilot.delayed.id === pilot.transfer.id || pilot.delayed.skill !== pilot.transfer.skill) throw new Error('지연 문항은 새 상황과 다른 문항 · 같은 능력이어야 한다');
  unseen('delayed');
 }
 return {
  version: WORLD_LESSON_VERSION,
  linesVersion: linesHash(lines),
  lesson,
  // 「모범 보기」 뒤에만 그린다. 승인 모범 녹음이 없어 글만.
  reveal: { lineId: pilot.transfer.id, text: pilot.transfer.text, modelAudio: relative(pilot.transfer.modelAudio || null) },
  ...(pilot.delayed ? { delayedReveal: { lineId: pilot.delayed.id, text: pilot.delayed.text, modelAudio: relative(pilot.delayed.modelAudio || null) } } : {}),
 };
}
export const serialize = (value) => `${JSON.stringify(value, null, 1)}\n`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const args = process.argv.slice(2);
 if (args.some((a) => a !== '--check')) throw new Error('Usage: node tools/build-drama-world.mjs [--check]');
 const text = serialize(await buildWorldLesson());
 const same = fs.existsSync(DESTINATION) && fs.readFileSync(DESTINATION, 'utf8').replace(/\r\n/g, '\n') === text;
 if (args.includes('--check')) { if (!same) { console.error(`낡음: ${path.relative(ROOT, DESTINATION)} — node tools/build-drama-world.mjs`); process.exit(1); } }
 else if (!same) fs.writeFileSync(DESTINATION, text);
 console.log(`${args.includes('--check') ? 'verified' : same ? 'unchanged' : 'built'} ${path.relative(ROOT, DESTINATION)}`);
}
