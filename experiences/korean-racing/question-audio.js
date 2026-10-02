export const LANE_AUDIO = ['lane-left', 'lane-center', 'lane-right'];
const directions = ['왼쪽 길', '가운데 길', '오른쪽 길'];

// The chase camera looks toward +Z. World +X is the left side of the screen.
export function questionNarration(question, worldOrder, choicesById) {
  const screenOrder = [...worldOrder].reverse();
  const ids = [...(question.audio || [question.mode === 'picture' ? 'cue-picture' : 'cue-listen', question.answer])];
  const options = screenOrder.map((id, i) => {
    ids.push(LANE_AUDIO[i], id);
    return `${directions[i]}은 ${choicesById[id].word}.`;
  });
  return { ids, text: `${question.spoken} ${options.join(' ')}` };
}
