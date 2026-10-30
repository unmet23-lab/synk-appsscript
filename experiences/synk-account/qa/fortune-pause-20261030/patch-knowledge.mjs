// 무료 운세 잠시 내림(2026-10-30) — 홈페이지 질문창 지식(knowledge.json · en/knowledge.json)에서 운세를 「잠시 쉬는 중」으로 바꾼다.
// 원고는 SYNK-website site-v10/knowledge/{ko,en}.mjs이고, 공개본은 그 빌드를 JSON.stringify(…, null, 2)로 쓴 꼴이라 읽고 다시 써도 바이트가 같다.
// 질문창 엔진은 답의 문단마다 같은 글의 근거 문단(docs.paragraphs)이 있어야 열므로, 문장 고침은 답과 근거에 똑같이 하고 뺀 문단은 둘 다에서 뺀다.
// 쉬는 중 안내는 회원 혜택 답의 첫 문단에 둔다(질문창은 첫 문단만 펼쳐 보인다). 예시 질문·낱말 '운세'는 남겨 그 질문이 이 답으로 오게 한다.
// 쓰기: node patch-knowledge.mjs <ko|en> <knowledge.json> <출력>
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const KNOWLEDGE_SWAPS = {
  ko: [
    ['회원 혜택 가운데 플레저·무료 운세입니다.', '회원 혜택 가운데 플레저입니다.'],
    ['플레저, 무료 운세가 있고 SYNK ID 회원이면 모두 무료입니다.', '플레저가 있고 SYNK ID 회원이면 모두 무료입니다.'],
    ['내 성향 확인하기, AI 구독 계정판, 플레저, 무료 운세 넷이고 모두 무료입니다. 플레저와 운세는 가입 없이도 씁니다.', '내 성향 확인하기, AI 구독 계정판, 플레저 셋이고 모두 무료입니다. 플레저는 가입 없이도 씁니다. 무료 운세는 다시 손보는 동안 잠시 쉬고 있고, 저장해 둔 운세 기록은 지우지 않았습니다.'],
  ],
  en: [
    ['two member benefits, Pleasure and the free horoscope.', 'one member benefit, Pleasure.'],
    ['the AI subscription board (PC app), Pleasure and a free horoscope, all free for SYNK ID members.', 'the AI subscription board (PC app) and Pleasure, all free for SYNK ID members.'],
    ['The SYNK platform has four member benefits, all free: My learning profile, the AI subscription board, Pleasure and a free horoscope. Pleasure and the horoscope need no account, and all four are in Korean.', 'The SYNK platform has three member benefits, all free: My learning profile, the AI subscription board and Pleasure. Pleasure needs no account, and all three are in Korean. The free horoscope is paused while we rework it, and any horoscope records you saved have not been deleted.'],
  ],
};
export const KNOWLEDGE_DROPPED_PARAGRAPH = {
  ko: '무료 운세 — 별자리와 한국 사주로 오늘의 기운부터 궁합·이번 달·올해까지 봅니다. 광고나 잠금이 없고, 풀이는 가볍게 즐기는 참고용입니다.',
  en: 'Free horoscope — your day by star sign and Korean saju, plus compatibility, the month and the year. No ads and nothing locked; the readings are for light fun.',
};
export const REVIEWED_AT = '2026-10-30';

export function patchKnowledge(lang, knowledge) {
  const swaps = KNOWLEDGE_SWAPS[lang], drop = KNOWLEDGE_DROPPED_PARAGRAPH[lang], hits = swaps.map(() => 0);
  const swap = text => swaps.reduce((value, [from, to], index) => { const n = value.split(from).length - 1; hits[index] += n; return n ? value.split(from).join(to) : value; }, text);
  const next = JSON.parse(JSON.stringify(knowledge));
  let droppedAnswers = 0, droppedParagraphs = 0;
  const changed = [];
  for (const record of next.records) {
    const before = record.answer;
    const paragraphs = record.answer.split('\n\n'), kept = paragraphs.filter(paragraph => paragraph !== drop);
    droppedAnswers += paragraphs.length - kept.length;
    record.answer = swap(kept.join('\n\n'));
    for (const key of ['title']) if (typeof record[key] === 'string') record[key] = swap(record[key]);
    if (record.answer !== before) { record.reviewedAt = REVIEWED_AT; changed.push(record.id); }
  }
  for (const doc of next.docs) {
    const kept = doc.paragraphs.filter(paragraph => paragraph !== drop);
    droppedParagraphs += doc.paragraphs.length - kept.length;
    doc.paragraphs = kept.map(swap);
  }
  next.updatedAt = REVIEWED_AT;
  // 엔진이 여는 조건: 바꾼 답의 문단이 근거 문단에 모두 있어야 한다.
  const grounded = new Set(next.docs.flatMap(doc => doc.paragraphs));
  const ungrounded = changed.flatMap(id => next.records.find(record => record.id === id).answer.split('\n\n').filter(paragraph => !grounded.has(paragraph)).map(paragraph => `${id}: ${paragraph.slice(0, 40)}`));
  return { next, hits, droppedAnswers, droppedParagraphs, changed, ungrounded };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [lang, input, output] = process.argv.slice(2);
  if (!KNOWLEDGE_SWAPS[lang] || !output) { console.error('쓰기: node patch-knowledge.mjs <ko|en> <knowledge.json> <출력>'); process.exit(2); }
  const raw = fs.readFileSync(input, 'utf8');
  if (JSON.stringify(JSON.parse(raw), null, 2) + '\n' !== raw) { console.error('멈춤: 다시 써도 같은 꼴이 아니다'); process.exit(1); }
  const result = patchKnowledge(lang, JSON.parse(raw));
  // 공개본 판(10-30)은 각 문장이 답과 근거 문단에 한 번씩, 두 번 나온다.
  if (result.hits.some(n => n !== 2) || result.droppedAnswers !== 1 || result.droppedParagraphs !== 1 || result.ungrounded.length) {
    console.error('멈춤: 맞은 수가 예상과 다르거나 근거 없는 문단이 있다', result.hits, result.droppedAnswers, result.droppedParagraphs, result.ungrounded); process.exit(1);
  }
  const text = JSON.stringify(result.next, null, 2) + '\n';
  fs.writeFileSync(output, text);
  console.log(JSON.stringify({ lang, hits: result.hits, 뺀문단: [result.droppedAnswers, result.droppedParagraphs], 바꾼기록: result.changed }));
}
