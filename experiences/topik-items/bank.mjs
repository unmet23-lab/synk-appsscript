// TOPIK 연습 문항 묶음을 읽는 곳(화면·도구 공용, 브라우저에서도 돈다). 문항 원천은 items/*.json,
// 그 목록은 tools/topik-items.mjs --묶기가 만드는 bank-files.mjs다. 화면은 PUBLISHED(검수 통과)만 낸다.
import { ITEM_FILES } from './bank-files.mjs';
import existing from './review/existing-verdicts.json' with { type: 'json' };
import {isHeldout} from './holdout.mjs';

export const ALL_ITEMS = Object.freeze(ITEM_FILES.flatMap(file => file.items.map(item => Object.freeze({ ...item, batch: file.batch }))));
// AI 2중 검수(1차 Claude Opus · 2차 아르곤)를 지금 내용으로 통과한 문항만. 판정 근거는 각 문항의 review 줄이다.
export const REVIEWED_ITEMS = Object.freeze(ALL_ITEMS.filter(item => item.reviewStatus === 'ai-reviewed'));
export const PUBLISHED = Object.freeze(REVIEWED_ITEMS.filter(item => !isHeldout(item)));
// 기존 게임·진단 문항의 판정(허용 목록). verdict "pass"만 연습에 낸다.
export const EXISTING_VERDICTS = existing;
export const EXISTING_PASS = Object.freeze(new Map((existing.items || []).filter(row => row.verdict === 'pass').map(row => [row.itemKey, row])));

export const itemKeyOf = item => `topik-items.${item.id}.v${item.rev}`;
export const familyKeyOf = item => `topik-items.${item.family}`;

// Core(atlas/learning.js) 후보 메타 — WORLD 진단·연습이 다른 게임 문항과 같은 칸에 기록한다.
export function itemMeta(item) {
  return { id: item.id, itemKey: itemKeyOf(item), familyKey: familyKeyOf(item), skillId: item.skillId, difficulty: item.difficulty,
    modality: item.section, responseFormat: item.responseFormat, audioRequired: item.section === 'listening', confounded: false,
    conceptIds: [...(item.conceptIds || [])], source: 'topik-items', exam: item.exam, officialType: item.officialType,
    setId: item.set?.id || null };
}

// 화면이 바로 쓰는 꼴(world-diagnostic-items.mjs의 문항과 같은 이름의 칸). 보기 id는 itemKey.option-N, 해설은 화면 언어별.
export function practiceItem(item) {
  const meta = itemMeta(item), ids = item.choices.map((_, index) => `${meta.itemKey}.option-${index}`);
  return { ...meta, audio: item.audio ? `topik-items/${item.audio.file}` : null, plays: item.audio?.plays ?? null,
    prompt: item.passage ?? null, script: item.script ?? null, question: item.question,
    choices: item.choices.map((label, index) => ({ id: ids[index], label })), correctId: ids[item.answer],
    explanation: { ...item.explanation }, choiceNotes: [...item.choiceNotes], label: item.question };
}
