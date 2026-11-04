// 문항 AI 2중 검수의 원본(tools/topik-review.mjs 준비 … --기존 subway-rush): 근거로 세는 결정 · 만남의 변형 전체. 게임에는 싣지 않아도 되는 도구용 모듈이다.
// 열쇠 · 능력 · 난도는 게임과 같은 decisionMeta · meetingMeta. 대본은 앞서 들은 길 안내 + 답을 가르는 안내 — 목소리가 실제로 읽는 글(say)을 낸다.
import { reviewDecisions } from './journeys.mjs';
import { decisionMeta, meetingMeta } from './learning.mjs';
import { allMeetingItems } from './people.mjs';

const ROLE = { announcer: '안내방송', guide: '휴대폰 길 안내', worker: '옆자리 직장인', traveler: '여행객' };
const labelOf = (o) => o.exit != null ? `${o.exit}번 출구` : o.line ? `${o.line}호선 ${o.text.replace(/^\d호선 /, '')}` : o.text;

export function reviewItems() {
  const rows = reviewDecisions().map(({ decision: d, context, explanation }) => ({
    ...decisionMeta(d), source: 'subway-rush', question: QUESTION[d.kind],
    script: [...context.map((l) => ({ speaker: `앞서 들은 ${ROLE[l.role]}`, text: l.say })), { speaker: ROLE[d.line_.role], text: d.line_.say }],
    choices: d.options.map((o) => ({ id: `subway-rush.${d.id}.${o.id}`, label: labelOf(o) })),
    correctId: `subway-rush.${d.id}.${d.answer}`, explanation,
  }));
  for (const { item, lead, ask, replies, answer, explanation } of allMeetingItems()) {
    rows.push({ ...meetingMeta(item), source: 'subway-rush', question: '지하철에서 옆 사람이 말을 걸었어요. 어떻게 대답할까요?',
      script: [...(lead ? [{ speaker: ROLE.announcer, text: lead.say }] : []), { speaker: ROLE[ask.role], text: ask.say }],
      choices: replies.map((r) => ({ id: `subway-rush.${item.id}.${r.id}`, label: r.text })), correctId: `subway-rush.${item.id}.${answer}`, explanation });
  }
  return rows;
}
const QUESTION = { stop: '열차가 역에 섰어요. 어떻게 할까요?', fork: '어느 쪽으로 갈까요?', exit: '몇 번 출구로 나갈까요?', board: '승강장에서 어떻게 할까요?' };
