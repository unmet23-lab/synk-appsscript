// C4's authored preference scene (§12). Every choice is valid; none is a learning answer.
import { openDialogue, helpDialogue, dialogueLevel } from './dialogue.mjs';
const LEVELS = ['L1', 'L2', 'L3', 'L4'];
const rows = lines => Object.fromEntries(LEVELS.map((level, i) => [level, lines[i]]));
const turn = (lines, choices) => ({ lines: rows(lines), choices: choices.map(([id, labels]) => ({ id, labels: rows(labels) })) });
const SCRIPT = {
  offer: turn(['새 차 마셔 볼래요?', '새 차를 만들었는데 맛 좀 봐 줄래요?', '요즘 새 차를 만들고 있거든요. 손님한테 내기 전에 맛 좀 봐 줄래요?', '손님들한테 내놓기 전에 누가 먼저 맛을 봐 주면 좋겠다 싶었어요. 제 입에는 괜찮은데, 남이 마시면 또 다를 테니까요. 한 잔 드셔 볼래요?'], [
    ['sip', ['네, 좋아요', '네, 마셔 볼게요', '네, 한번 마셔 볼게요', '좋아요, 한 잔 마셔 볼게요']],
    ['smell', ['향 먼저요', '향부터 맡아 볼게요', '먼저 향부터 맡아 볼게요', '마시기 전에 향부터 맡아 봐도 돼요?']]]),
  taste: turn(['너무 달아요?', '꿀을 많이 넣었는데 너무 달아요?', '맛이 어때요? 꿀을 좀 많이 넣은 것 같기도 해서요.', '솔직하게 말해 줘요. 단맛이 강하면 향이 묻힐 텐데, 그렇지는 않아요?'], [
    ['less', ['달아요', '조금 달아요', '조금 단 것 같아요', '단맛이 조금 센 것 같아요']],
    ['same', ['좋아요', '딱 좋아요', '이대로 딱 좋아요', '저는 이대로가 딱 좋아요']],
    ['aroma', ['향이 좋아요', '향이 좋아요', '향이 정말 좋아요', '향이 먼저 느껴져서 좋아요']]]),
  less: turn(['꿀을 조금만 넣을게요.', '달면 꿀을 반만 넣어 볼게요.', '역시 그렇죠? 다들 단 걸 좋아한다고 해서 많이 넣었거든요. 꿀을 반만 넣어 볼게요.', '역시 제 입에만 괜찮았던 거네요. 꿀을 반으로 줄이면 향이 먼저 올라올 텐데, 그렇게 해 볼게요.'], [
    ['agree', ['좋아요', '좋아요', '네, 그게 좋겠어요', '네, 그렇게 하면 좋겠어요']],
    ['pour', ['제가 넣을게요', '제가 넣어 봐도 돼요?', '제가 한번 넣어 볼게요', '꿀은 제가 직접 넣어 봐도 될까요?']]]),
  same: turn(['차림표에 쓸게요.', '괜찮으면 차림표에 올릴게요.', '아, 다행이에요. 맛있다고 하니까 바로 차림표에 올려야겠어요.', '다행이에요. 사실 손님들이 좋아할지 걱정이었거든요. 이 맛 그대로 올려도 괜찮을 텐데, 어때요?'], [
    ['menu', ['네, 좋아요', '네, 좋아요', '네, 올려요', '네, 손님들도 좋아할 거예요']],
    ['serve', ['손님한테 줄래요', '제가 손님한테 내 볼게요', '첫 잔은 제가 손님한테 낼게요', '첫 손님한테는 제가 내 봐도 될까요?']]]),
  aroma: turn(['향이 좋죠?', '처음 따를 때 향이 제일 좋아요.', '그렇죠? 처음 따를 때 향이 제일 좋거든요. 그걸 살리고 싶었어요.', '알아봐 줘서 고마워요. 처음 따를 때 올라오는 향은 금방 사라지기는 하지만, 그 순간을 살리고 싶었거든요.'], [
    ['more', ['한 잔 더 주세요', '한 잔 더 주세요', '한 잔 더 마셔도 돼요?', '한 잔 더 마셔도 될까요?']],
    ['thanks', ['잘 마셨어요', '잘 마셨어요', '잘 마셨어요', '덕분에 잘 마셨어요']]])
};
const SMELL = rows(['향 먼저, 좋아요.', '향부터 맡으면 더 좋아요.', '향부터 맡는 손님은 처음이에요. 좋네요.', '향부터 맡아 주는 손님은 드문데, 그렇게 마셔 주면 고맙죠.']);
const RESULT = rows(['차림표에 썼어요.', '함께 고른 맛으로 차림표에 올렸어요.', '맛을 봐 줘서 고마워요. 함께 고른 맛으로 차림표에 올렸어요.', '혼자서는 정하기 어려웠는데 함께 맛을 봐 줘서 고마워요. 고른 맛 그대로 차림표에 올렸어요.']);
export const goodbye = level => rows(['네, 또 와요.', '그래요, 또 와요.', '괜찮아요. 생각나면 또 와요.', '괜찮아요. 언제든 생각나면 들러요.'])[level] || '그래요, 또 와요.';
const keyOf = state => state.turn === 0 ? 'offer' : state.turn === 1 ? 'taste' : state.taste;
export function startNewTea(level) {
  return { turn: 0, first: null, taste: null, final: null, honey: null, manual: false, done: false, lastHelp: null,
    dialogue: openDialogue({ id: 'cafe-alley.day.new-tea', level }) };
}
export function validNewTea(state) {
  const d = state?.dialogue;
  return !!state && [0, 1, 2].includes(state.turn) && [null, 'sip', 'smell'].includes(state.first)
    && [null, 'less', 'same', 'aroma'].includes(state.taste) && [null, 'agree', 'pour', 'menu', 'serve', 'more', 'thanks'].includes(state.final)
    && [null, 0, 1, 2].includes(state.honey) && typeof state.manual === 'boolean' && typeof state.done === 'boolean'
    && (state.turn === 0 ? state.first === null && state.taste === null : state.first !== null)
    && (state.turn < 2 ? state.taste === null && state.final === null && !state.done && !state.manual : state.taste !== null)
    && (!state.manual || state.taste === 'less' && state.final === 'pour') && (!state.done || state.final !== null && state.honey !== null)
    && [null, 'repeat', 'slower', 'meaning'].includes(state.lastHelp) && d?.id === 'cafe-alley.day.new-tea'
    && LEVELS.includes(d.level) && LEVELS.includes(d.sceneLevel) && Number.isSafeInteger(d.lowerRetells) && d.lowerRetells >= 0
    && d.help && ['meaning', 'repeat', 'slower', 'reopen'].every(k => Number.isSafeInteger(d.help[k]) && d.help[k] >= 0 && d.help[k] <= 1000)
    && typeof d.stopped === 'boolean' && d.turns && !Array.isArray(d.turns)
    && Object.entries(d.turns).every(([key, t]) => ['offer', 'taste', 'less', 'same', 'aroma'].includes(key)
      && LEVELS.includes(t.level) && Number.isSafeInteger(t.repeats) && t.repeats >= 0 && t.repeats <= 1000);
}
export function newTeaView(state) {
  const key = keyOf(state), level = dialogueLevel(state.dialogue, key), page = SCRIPT[key];
  const choices = state.manual ? [0, 1, 2].map(n => ({ id: `honey-${n}`, label: ['꿀 없이', '꿀 한 숟가락', '꿀 두 숟가락'][n] }))
    : page.choices.map(c => ({ id: c.id, label: c.labels[level] }));
  return { turn: key, level, line: state.done ? RESULT[level] : state.manual ? '꿀을 얼마나 넣을까요?' : page.lines[level],
    aside: state.turn === 1 && state.first === 'smell' ? SMELL[level] : null,
    choices: state.done ? [] : choices, help: state.lastHelp, manual: state.manual, done: state.done,
    picture: level === 'L1' && state.lastHelp === 'meaning' ? (key === 'offer' ? 'cup' : key === 'aroma' ? 'leaf' : 'honey') : null };
}
export function helpNewTea(state, kind) {
  if (state.done || !['repeat', 'slower', 'meaning'].includes(kind) || state.dialogue.help[kind] >= 1000) throw new TypeError('Invalid new tea help');
  return { ...state, lastHelp: kind, dialogue: helpDialogue(state.dialogue, keyOf(state), kind) };
}
export function chooseNewTea(state, choice) {
  if (state.done || !newTeaView(state).choices.some(c => c.id === choice)) throw new TypeError('Invalid new tea choice');
  const next = structuredClone(state); next.lastHelp = null;
  if (state.manual) { next.honey = Number(choice.slice(-1)); next.done = true; }
  else if (state.turn === 0) { next.first = choice; next.turn = 1; }
  else if (state.turn === 1) { next.taste = choice; next.turn = 2; }
  else { next.final = choice; next.manual = choice === 'pour'; next.honey = state.taste === 'less' ? 1 : 2; next.done = !next.manual; }
  return next;
}
