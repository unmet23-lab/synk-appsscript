// 결함 다섯 고침의 나머지(번역 표 · 번역 시험 · 찰칵 낱말 시험 · 새 시험 둘)를 작업본에 넣는다. 첫 인자 = 저장소 뿌리.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const ROOT = process.argv[2];
function patch(rel, pairs) {
  const file = path.join(ROOT, rel); let text = fs.readFileSync(file, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  for (let [from, to] of pairs) {
    from = from.replace(/\n/g, eol); to = to.replace(/\n/g, eol);
    const at = text.indexOf(from);
    if (at < 0 || text.indexOf(from, at + 1) >= 0) throw new Error(`${rel}: 조각이 없거나 둘 이상 — ${from.slice(0, 90)}`);
    text = text.slice(0, at) + to + text.slice(at + from.length);
  }
  fs.writeFileSync(file, text); console.log('고침', rel, pairs.length);
}
// 번역 표: 정책판 5의 이유 문장 셋(atlas/vellum.js learningReason). 몽골어는 experiences/brand-opening/qa/mn-check-20261110-atlas5/.
const REVIEW = "'msg.vellum.review':{ko:'「{skill}」을(를) 다시 살펴볼 때예요.',en:'It’s time to look at ‘{skill}’ again.',mn:'«{skill}» чадварыг дахин харах цаг боллоо.'},\n";
patch('experiences/brand-opening/world-strings.mjs', [[REVIEW, REVIEW +
  " // 정책판 5(11-10, atlas/learning.js reasonStatus): 처음 칸이지만 앞 단계를 해냈거나 다른 응답 꼴로 한 기록이 있을 때, 처음 시도를 놓친 문항의 한 번 다시.\n" +
  " 'msg.vellum.step-up':{ko:'「{skill}」 앞 단계를 최근 혼자 해냈어요. 한 단계 올려 봐요.',en:'You recently did the previous step of ‘{skill}’ on your own. Let’s go up a step.',mn:'«{skill}» чадварын өмнөх шатны асуултад саяхан өөрөө зөв хариулсан. Нэг шат ахиулж үзье.'},\n" +
  " 'msg.vellum.new-format':{ko:'「{skill}」을(를) 다른 방식으로 확인해 봐요.',en:'Let’s check ‘{skill}’ in a different way.',mn:'«{skill}» чадварыг өөр хэлбэрээр шалгацгаая.'},\n" +
  " 'msg.vellum.retry':{ko:'「{skill}」에서 놓친 문제를 한 번 더 풀어 봐요.',en:'Let’s try the ‘{skill}’ question you missed once more.',mn:'«{skill}» чадварын алдсан асуултдаа дахин нэг удаа хариулж үзье.'},\n"]]);
patch('experiences/brand-opening/qa/world-lang.test.mjs', [
  ["const STATUSES=['unseen','checking','practice','supported','recent-independent','review'];",
   "// 정책판 5(11-10)의 이유 셋까지: 앞 단계 · 다른 방식 · 놓친 문제 한 번 더.\nconst STATUSES=['unseen','checking','practice','supported','recent-independent','review','step-up','new-format','retry'];"],
  ["test('Vellum 추천 이유는 여섯 꼴 × 18 항목 × 고른 목표 줄 있음·없음 모두 영어·몽골어로 바뀐다',()=>{",
   "test('Vellum 추천 이유는 아홉 꼴 × 18 항목 × 고른 목표 줄 있음·없음 모두 영어·몽골어로 바뀐다',()=>{"],
  [" assert.equal(count,18*11*2);", " assert.equal(count,18*17*2);"],
]);
patch('experiences/snap-words/learning.test.mjs', [
  ["import { itemMetadata, missionMetadata, missionCandidates, createLearning, GAME_ID } from './learning.mjs';",
   "import { itemMetadata, missionMetadata, missionCandidates, createLearning, GAME_ID, WORD_CONCEPT } from './learning.mjs';"],
  ["test('모든 낱말 · 꼴의 기록 칸이 맵과 맞다', () => {",
   "// 11-10 Atlas 검수 결함 4: 낱말 태그가 없어 Core가 어느 낱말을 틀렸는지 몰랐다.\n" +
   "test('낱말 태그는 TOPIK I 지도의 낱말 마디이고, 목록 안(A · B) 낱말은 모두 태그가 있다', () => {\n" +
   "  for (const [word, id] of Object.entries(WORD_CONCEPT)) { const node = map.getNode(id); assert.equal(node?.kind, 'word', `${word} ${id}`); assert.equal(node.label_ko, WORDS[word].ko, word); }\n" +
   "  for (const w of Object.values(WORDS)) assert.equal(Boolean(WORD_CONCEPT[w.id]), ['A', 'B'].includes(w.band), w.id);\n" +
   "  assert.deepEqual(itemMetadata('meaning', 'dorm').conceptIds, ['ko.word.w0743']); assert.deepEqual(itemMetadata('recall-word', 'store').conceptIds, []);\n" +
   "});\n\n" +
   "test('틀린 뜻 부탁의 낱말이 다음 판의 약한 낱말로 먼저 나온다(정책판 5 — 처음 시도를 놓친 문항의 한 번 다시)', () => {\n" +
   "  const g = game(), L = createLearning(() => g), place = PLACES.gate, words = missionCandidates(place).map((c) => c.word), missed = words.slice(0, 2);\n" +
   "  for (const word of words.slice(0, 4)) {\n" +
   "    const m = { kind: 'meaning', word }; L.present(m);\n" +
   "    if (missed.includes(word)) { L.answer(m, { correct: false, selected: words[5], attemptNo: 1 }); L.answer(m, { correct: true, selected: word, attemptNo: 2 }); }\n" +
   "    else L.answer(m, { correct: true, selected: word, attemptNo: 1 });\n" +
   "  }\n" +
   "  L.leave();\n" +
   "  assert.deepEqual([...L.weak(place)].sort(), [...missed].sort());\n" +
   "  const concepts = new Map((g.summary().concepts || []).map((c) => [c.id, c]));\n" +
   "  for (const word of missed) assert.equal(concepts.get(WORD_CONCEPT[word])?.formats['single-choice'].incorrect, 1, word);\n" +
   "});\n\n" +
   "test('모든 낱말 · 꼴의 기록 칸이 맵과 맞다', () => {"],
]);
// 새 시험 둘: 설계 검수 때의 초안에서 머리 줄(「초안: …」)만 뺀다.
for (const name of ['atlas-learning-priority-5', 'atlas-host-pages']) {
  const draft = fs.readFileSync(path.join(ROOT, `docs/_ops/qa/atlas-defects5-20261110/시험초안/${name}.초안.js`), 'utf8');
  const out = draft.replace(/^\/\/ 초안: [^\n]*\n/m, '');
  if (out === draft) throw Error(`${name}: 초안 머리 줄이 없다`);
  fs.writeFileSync(path.join(ROOT, `tests/${name}.test.js`), out); console.log('새 시험', `tests/${name}.test.js`);
}
