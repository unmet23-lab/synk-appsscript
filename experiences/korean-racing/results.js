// 레이싱 결과 화면 — 맞힌 문제·메달 별·순위, 공통 코인 줄, 문제 목록(다시 듣기), 보상과 기록, 다음 레이스.
// 무엇을 보일지는 app.js의 finish()가 정해 summary로 준다. 다음 코스 단추의 상태는 finish()가 직접 정한다.
import { $, el } from './kit/lab.mjs';

/**
 * summary: { kicker, demo, correct, total, medal, passed, rank, bestCombo, collisions, coinText,
 *   questions:[{prompt, answer, chosen, correct, why}], rewards:[{label, coins, unlock}], plain:[글], learning, nextReason, listen(i) }
 */
export function renderResults(s) {
  $('#r-kicker').textContent = s.kicker;
  $('#r-title').textContent = s.demo ? '시연 완주!' : s.correct === s.total ? '완벽해요!' : s.passed ? '코스 통과!' : '완주!';
  $('#r-correct').textContent = String(s.correct);
  $('#r-total').textContent = String(s.total);
  $('#r-stars').replaceChildren(...[1, 2, 3].map((i) => el('i', i <= s.medal ? 'on' : '')));
  $('#r-stars').setAttribute('aria-label', s.demo ? '자동 시연은 메달을 남기지 않아요' : `학습 메달 3개 중 ${s.medal}개`);
  $('#r-stats').replaceChildren(
    pill('순위', `${s.rank}위`),
    pill('부스터', `${s.correct}번`),
    pill('최고 콤보', String(s.bestCombo)),
    pill('접촉', s.collisions ? `${s.collisions}번` : '없음'),
  );
  $('#r-note').textContent = s.note;
  $('#r-coins').textContent = s.coinText;
  $('#r-mongle').src = s.passed ? 'kit/brand/mongle-cheer.webp' : 'kit/brand/mongle-smile.webp';

  const log = $('#r-log');
  log.replaceChildren(...s.questions.map((q, i) => {
    const li = el('li', q.correct ? 'ok' : 'ko');
    const mark = el('span', 'mark', q.correct ? '' : String(i + 1));
    mark.setAttribute('aria-label', q.correct ? '맞힘' : '다시 볼 문제');
    const body = el('span', 'body');
    body.append(el('span', 'q', q.prompt));
    const answer = el('span', 'a', '정답');
    answer.append(el('b', '', q.answer));
    if (!q.correct && q.chosen) answer.append(` · 고른 답 ‘${q.chosen}’`);
    body.append(answer);
    if (q.why) body.append(el('span', 'why', q.why));
    li.append(mark, body);
    const listen = el('button', 'chip-btn say-again', '다시 듣기');
    listen.type = 'button';
    listen.setAttribute('aria-label', `${q.answer} 정답과 해설 다시 듣기`);
    listen.addEventListener('click', () => s.listen(i));
    li.append(listen);
    return li;
  }));

  const rewards = $('#r-rewards');
  rewards.replaceChildren(
    ...s.rewards.map((r) => { const li = el('li', r.unlock ? 'unlock' : ''); li.append(el('span', '', r.label), el('b', '', r.unlock ? '새 꾸미기' : `+${r.coins}`)); return li; }),
    ...s.plain.map((text) => el('li', 'plain', text)),
  );
  $('#r-learning').textContent = s.learning;
  $('#r-next-reason').textContent = s.nextReason;
}

function pill(label, value) {
  const node = el('span', 'pill');
  node.append(el('small', '', label), el('b', '', value));
  return node;
}
