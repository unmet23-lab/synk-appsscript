// 레이스 화면(3D 해안도로 위)을 그린다 — 문제 카드, 차선 답 꼬리표, 정답 글자, 화면 읽기 안내.
// 언제 무엇을 보일지(흐름·판정)는 app.js가 정하고, 여기서는 종이 카드와 펠트 꼬리표에 글을 얹기만 한다.
import { $, el, esc, fitText } from './kit/lab.mjs';

const card = () => $('#question');
const lanes = () => $('#lane-choices');

/** 화면 읽기 프로그램에 한 줄 알린다(같은 글도 다시 읽히게 비웠다가 넣는다). */
export function announce(text) {
  const live = $('#sr-live');
  if (!live) return;
  live.textContent = '';
  requestAnimationFrame(() => { live.textContent = text; });
}

/* ── 문제 카드: 듣기(listening) → 고르기(choose) → 답(answer). 기울이지 않는 종이 카드 ── */
let answerTimer = 0;
export function showQuestion({ phase, tag, ask, passage = null, caption = null, help = '', expanded = false }) {
  clearTimeout(answerTimer);
  const box = card();
  box.hidden = false;
  box.dataset.phase = phase;
  delete box.dataset.result;
  $('#feedback-continue').hidden = true;
  $('#q-tag').textContent = tag;
  $('#prompt').textContent = ask;
  $('#question-passage').hidden = !passage;
  if (passage) $('#question-passage').textContent = passage;
  $('#voice-caption').hidden = !caption;
  if (caption) $('#voice-caption').textContent = caption;
  $('#question-help').textContent = help;
  const toggle = $('#question-toggle');
  toggle.hidden = false;
  toggle.textContent = expanded ? '접기' : '글로 보기';
  toggle.setAttribute('aria-expanded', String(expanded));
}

/** 판정 뒤: 맞으면 펠트 체크와 ‘맞았어요!’, 틀리면 종이 쪽지에 정답과 이유(빨간 X는 쓰지 않는다). 잠시 뒤 접는다. */
export function answerQuestion({ ok, word, why = '', hold = 4200 }) {
  const box = card();
  box.hidden = false;
  box.dataset.phase = 'answer';
  box.dataset.result = ok ? 'ok' : 'miss';
  box.classList.remove('narrating');
  $('#question-toggle').hidden = true;
  $('#prompt').innerHTML = ok ? `맞았어요! ${esc(word)}` : `정답: <b>${esc(word)}</b>`;
  $('#question-passage').hidden = true;
  $('#voice-caption').hidden = true;
  $('#question-help').textContent = why;
  clearTimeout(answerTimer);
  if (hold !== null) answerTimer = setTimeout(hideQuestion, hold);
  announce(`${ok ? '맞았어요' : '정답은'} ${word}. ${why}`);
}

export function hideQuestion() {
  clearTimeout(answerTimer);
  const box = card();
  box.hidden = true;
  $('#feedback-continue').hidden = true;
  box.dataset.phase = 'idle';
  delete box.dataset.result;
  box.classList.remove('narrating');
}

/* ── 차선 답 꼬리표: 크림 펠트 쿠션 셋(화면 왼쪽·가운데·오른쪽). 누르면 그 길을 고른다 ── */
let laneHold = 0, pendingLanes = null;
const DIRECTIONS = ['왼쪽 길', '가운데 길', '오른쪽 길'];

/** list는 화면 순서의 [{id, text}] 셋. 앞 문제의 판정 표시가 남아 있으면 그 표시가 끝난 뒤에 바꾼다. */
export function setLanes(list, { picture = false, onPick } = {}) {
  const render = () => {
    const box = lanes();
    box.hidden = true;
    box.classList.remove('judged');
    box.replaceChildren(...list.map(({ id, text }, i) => {
      const button = el('button', `lane-tag${picture ? ' picture' : ''}`);
      button.type = 'button';
      button.dataset.word = id;
      button.setAttribute('aria-label', `${DIRECTIONS[i]} · ${text}`);
      button.append(el('span', 'dir', DIRECTIONS[i]), el('span', 'say', text));
      button.addEventListener('click', () => onPick?.(id, button));
      return button;
    }));
  };
  if (laneHold) pendingLanes = render;
  else render();
}

/** 새 문제가 나오면 앞 문제의 판정 표시를 바로 거두고 새 꼬리표를 보인다. */
export function showLanes() {
  if (laneHold) endHold();
  const box = lanes();
  if (!box.children.length) return;
  box.hidden = false;
  fitLanes();
}
function endHold() {
  clearTimeout(laneHold);
  laneHold = 0;
  const box = lanes();
  box.hidden = true;
  box.classList.remove('judged');
  const next = pendingLanes;
  pendingLanes = null;
  next?.();
}

/** 고른 길에 크림 칼선, 맞는 길에 펠트 체크를 잠깐 남긴다. */
export function markLanes(chosenId, answerId, hold = 2200) {
  const box = lanes();
  box.classList.add('judged');
  for (const tag of box.children) {
    tag.classList.toggle('chosen', tag.dataset.word === chosenId);
    tag.classList.toggle('right', tag.dataset.word === answerId);
  }
  clearTimeout(laneHold);
  laneHold = setTimeout(endHold, hold);
}

export function chooseLane(id) {
  for (const tag of lanes().children) tag.classList.toggle('chosen', tag.dataset.word === id);
}

export function resetLanes() {
  clearTimeout(laneHold);
  laneHold = 0;
  pendingLanes = null;
  const box = lanes();
  box.hidden = true;
  box.classList.remove('judged');
  box.replaceChildren();
}

/** 긴 답(‘다음 주 수요일까지 돌려줘요’)은 두 줄로 고르게 접고, 그래도 넘치면 그 꼬리표만 글자를 줄인다(키트 fitText). */
export function fitLanes() {
  for (const tag of lanes().children) {
    const say = tag.querySelector('.say');
    if (say && !tag.classList.contains('picture')) fitText(say, { maxLines: 2, minPx: 11, commaBreak: false });
  }
}

/* ── 정답 글자: 차 위로 잠깐 떠올랐다 사라진다(움직임 줄이기에서는 제자리에서 보였다 사라진다) ── */
export function pop(text, combo = 1) {
  const node = $('#pop');
  node.textContent = text;
  node.hidden = false;
  node.dataset.tier = combo >= 6 ? '3' : combo >= 3 ? '2' : '1';
  node.classList.remove('go');
  void node.offsetWidth;
  node.classList.add('go');
  clearTimeout(pop.timer);
  pop.timer = setTimeout(() => { node.hidden = true; }, 900);
}

export function clearPop() {
  clearTimeout(pop.timer);
  $('#pop').hidden = true;
}
