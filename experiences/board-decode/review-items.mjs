// 문항 AI 2중 검수의 원본(tools/topik-review.mjs 준비 … --기존 board-decode): 칸마다 갈림 양쪽, 정정 전부. 게임에는 싣지 않는 도구용 모듈이다.
// 지문에 공지 전체 · 태오 말을, 해설에 쉬운 뜻 · 단서 · 틀린 보기 뒤 장면을 넣어 학생이 보는 한국어를 한 번에 본다. 글을 고치면 지문이 달라져 review.test.mjs가 잡는다.
import { ROUNDS, WORDS } from './content.mjs';
import { noticeLines, patchOf, isRight, sayOf } from './core.mjs';

const FORMAT = '게임 꼴(판 하나 약 2분, 칸 3개, 시간 제한 없음 · 아래 해설은 학생이 읽는 글이 아니라 검수자에게 근거와 화면 글을 모아 보이는 요약이다. 학생은 단서 카드와 장면으로 본다): TOPIK II 3→4급 학습자가 캠퍼스 공지를 읽고 친근한 선배(해요체)의 메시지에 답장을 고른다. 공지의 낱말 하나가 다른 판(예: 보관 ↔ 폐기)에서는 답이 뒤집힌다 — 그래서 [공지]의 밑줄 말 〔…〕이 답을 가른다. 보기는 뜻풀이가 아니라 행동이다. 볼 것: ① 공지가 실제 한국 대학 공지처럼 자연스러운가, 그 낱말이 그 자리에 실제로 쓰이는가(뒤집으려고 지어낸 티가 없는가) ② 공지만으로 정답이 하나로 확정되는가 ③ 미끼 보기가 공지의 정보로 그럴듯한가 ④ 단서 문장이 그 낱말의 뜻을 다른 낱말과 가를 수 있는가 ⑤ 쉬운 뜻 · 태오 말 · 장면 글의 한국어. 시험 자리는 TOPIK II 읽기 안내문(9~12)을 게임으로 옮긴 것이다.';
// 칸의 답이 앞 칸의 낱말까지 기대는 곳: 게임에는 안 보이고 검수자에게만 근거를 밝힌다.
const CHAIN = { 'laundry.f2': (fork) => `앞 칸의 〔${fork.f1}〕로 태오의 세탁기 층은 점검 대상이다. 점검이 오전 9시에 시작했고 태오 말에 지금이 10시이므로 빨래는 세탁기에 남아 있지 않다 — 그래서 「세탁기 안에 그대로」는 틀리고, 어디로 갔는지를 이 칸의 낱말이 가른다.` };
const plain = (t) => String(t).replace(/\[\[([^\]]+)\]\]/g, '〔$1〕');
const wordNote = (w) => `${w} = ${WORDS[w].easy} (연필 메모의 틀린 뜻 후보: ${WORDS[w].decoy || WORDS[WORDS[w].twin].easy}). 단서 카드(문항 지문이 아니라 누르면 나오는 도움): ${WORDS[w].clues.map(plain).join(' ／ ')}`;
const sceneNote = (opts) => opts.filter((o) => o.title).map((o) => `「${o.t}」를 고르면 → ${o.title}: ${o.line}`).join(' | ');

function noticeText(round, fork, { patch = null } = {}) {
  return round.notices.map((n) => {
    const rows = noticeLines(round, fork, n).map((l) => {
      if (typeof l === 'string') return plain(l);
      if (l.big) return l.big;
      if (patch && l.key === patch.after) return `[정정 쪽지] ${plain(patch.line)}`;
      return plain(l.text);
    });
    return `[${n.org}] ${n.title}\n${rows.join('\n')}`;
  }).join('\n\n');
}
const pairedFork = (round, key, word) => { const fork = {}; for (const [k, pair] of Object.entries(round.forks)) fork[k] = k === key ? word : pair[0]; return fork; };

export function reviewItems() {
  const out = [];
  for (const round of ROUNDS) {
    round.slots.forEach((slot) => {
      for (const word of round.forks[slot.fork]) {
        const fork = pairedFork(round, slot.fork, word);
        const key = `${round.id}.${slot.fork}.${word}`;
        out.push({ source: 'board-decode', itemKey: `board-decode.${key}`, familyKey: `board-decode.${round.id}.${slot.fork}`, skillId: 'ko2.reading.detail', difficulty: 1, format: FORMAT,
          prompt: `[공지]\n${noticeText(round, fork)}\n\n[태오 선배 메시지] ${sayOf(slot, fork)}`, question: '뭐라고 답할까요?',
          choices: slot.opts.map((o, i) => ({ id: `${key}.${i}`, label: o.t })), correctId: `${key}.${slot.opts.findIndex((o) => isRight(slot, fork, o))}`,
          explanation: `근거는 공지의 〔${fork[slot.fork]}〕 줄이다. ${CHAIN[`${round.id}.${slot.fork}`]?.(fork) ?? ''} ${slot.keys.map((k) => fork[k] || k).map(wordNote).join(' · ')} — 틀린 보기 뒤 장면: ${sceneNote(slot.opts.filter((o) => !isRight(slot, fork, o)))}` });
      }
    });
    for (const [word, patch] of Object.entries(round.patches)) {
      const lastFork = round.slots.at(-1).fork;
      const fork = pairedFork(round, lastFork, word);
      if (patchOf(round, fork) !== patch) throw new Error(`정정 짝 어긋남: ${round.id} ${word}`);
      const key = `${round.id}.patch.${word}`;
      out.push({ source: 'board-decode', itemKey: `board-decode.${key}`, familyKey: `board-decode.${round.id}.patch`, skillId: 'ko2.reading.detail', difficulty: 1, format: FORMAT,
        prompt: `[공지]\n${noticeText(round, fork, { patch })}\n\n[태오 선배 메시지] ${patch.say}`, question: '정정 쪽지를 읽고 뭐라고 답할까요?',
        choices: patch.opts.map((o, i) => ({ id: `${key}.${i}`, label: o.t })), correctId: `${key}.${patch.opts.findIndex((o) => o.ok)}`,
        explanation: `근거는 [정정 쪽지] 줄이다. ${wordNote(patch.key)} — 맞히면 끝 글: ${patch.win}. ${patch.react} 틀린 보기 뒤 장면: ${sceneNote(patch.opts)}` });
    }
  }
  return out;
}
