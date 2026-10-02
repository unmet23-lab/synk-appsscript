import { EPISODE, STORY_VERSION } from './story.mjs';

/** Text master only. Audio files and playback are the host's responsibility. */
export const VOICE_TEXT_VERSION = `${STORY_VERSION}-voice-1`;
const allMissions = [...EPISODE.acts.flatMap(act => act.missions), ...EPISODE.review];
const labels = {
  marin: '마린', kkamong: '까몽', snacks: '과자', paper: '종이', cake: '케이크',
  ribbon: '리본', flowers: '꽃', letter: '편지', box: '상자', drawer: '서랍',
  table: '책상', bin: '쓰레기통', shelf: '선반', board: '칠판',
};
const actorSubjects = { marin: '마린이', kkamong: '까몽이' };
const objectSubjects = { snacks: '과자는', paper: '종이는', cake: '케이크는', ribbon: '리본은', flowers: '꽃은', letter: '편지는' };
const lines = [];
const byId = Object.create(null);

function add(id, speaker, text, category, assistanceMissionIds = [], extra = {}) {
  if (byId[id]) throw new Error(`Duplicate voice text ID: ${id}`);
  const line = Object.freeze({ id, speaker, text, category, assistanceMissionIds: Object.freeze([...assistanceMissionIds]), ...extra });
  lines.push(line);
  byId[id] = line;
  return line;
}

// Spoken scene information with a direct actor/object or negative-task clue is aid.
// General arrival, emotions, and party narration do not reveal a requested action.
const dialogueAssistance = {
  'dialogue-cleanup-intro-03': ['cleanup-paper'],
  'dialogue-clue-intro-02': ['clue-flowers'],
  'dialogue-surprise-intro-03': ['surprise-cake'],
};
function addDialogue(phase, actId, dialogue) {
  dialogue.forEach((line, index) => {
    const id = ['dialogue', ...(actId ? [actId] : []), phase, String(index + 1).padStart(2, '0')].join('-');
    add(id, line.speaker, line.text, line.speaker === 'narrator' ? 'narration' : 'dialogue', dialogueAssistance[id] ?? [], { phase, actId: actId ?? null, index });
  });
}
addDialogue('opening', null, EPISODE.opening);
for (const act of EPISODE.acts) {
  addDialogue('intro', act.id, act.intro);
  addDialogue('outro', act.id, act.outro);
}
addDialogue('ending', null, EPISODE.ending);

add('feedback-unavailable-story', 'teacher', '먼저 이야기를 읽어 주세요.', 'feedback');
add('feedback-invalid-destination', 'teacher', '물건을 놓을 곳을 골라 주세요.', 'feedback');
add('feedback-selection', 'teacher', '친구와 물건을 먼저 골라 주세요.', 'feedback');
add('feedback-extra-object', 'mongle', '어? 지금 글에는 이 물건이 없네! 맡은 일을 다시 같이 보자!', 'feedback');
add('feedback-help-unavailable', 'teacher', '이 막의 정리가 끝났어요.', 'feedback');
add('feedback-already-marin', 'marin', '확인. 이미 완료한 임무.', 'feedback');
add('feedback-already-kkamong', 'kkamong', '내가 벌써 해 놓았지.', 'feedback');

for (const mission of allMissions) {
  const ids = [mission.id];
  const extra = { missionId: mission.id, mode: EPISODE.review.some(item => item.id === mission.id) ? 'review' : 'story' };
  add(`mission-${mission.id}`, 'teacher', mission.text, 'mission', ids, extra);
  add(`help-${mission.id}`, 'teacher', mission.explanation, 'explanation', ids, extra);
  add(`feedback-${mission.id}-success`, mission.actor,
    mission.actor === 'marin'
      ? `임무 완료. ${labels[mission.object]}, ${labels[mission.destination]}에 도착.`
      : `훗. 내가 해냈지! ${labels[mission.object]}도 제자리를 찾았어.`, 'feedback', ids, extra);
  add(`feedback-${mission.id}-actor`, 'kkamong',
    `내가 다 하려고 했는데… 이번에는 ${labels[mission.actor]} 차례네! 글에서 친구 이름을 다시 찾아봐.`, 'feedback', ids, extra);
  add(`feedback-${mission.id}-destination`, 'mongle',
    `어? ${labels[mission.destination]}에 놓으라고 했네! 글을 다시 보고 같이 옮겨 보자!`, 'feedback', ids, extra);
  add(`feedback-${mission.id}-bin`, mission.object === 'paper' ? 'teacher' : 'kkamong',
    mission.object === 'paper'
      ? `잠깐! 종이는 버릴 물건이 아니야. 이번 글에서는 ${actorSubjects[mission.actor]} 종이를 ${labels[mission.destination]}에 넣어.`
      : `내가 구할게! ${objectSubjects[mission.object]} 버릴 물건이 아니야. 글에서 놓을 곳을 다시 찾아봐.`, 'feedback', ids, extra);
  if (mission.requires?.length) {
    const first = allMissions.find(item => item.id === mission.requires[0]);
    add(`feedback-${mission.id}-order`, 'marin', `순서 확인. 먼저 ${labels[first.object]}부터. 그다음 ${labels[mission.object]}.`, 'feedback', ids, extra);
  }
}

export const VOICE_LINES = Object.freeze(lines);
export const VOICE_LINE_BY_ID = Object.freeze(byId);
export function voiceForDialogue(phase, actId, index) {
  const id = ['dialogue', ...(['intro', 'outro'].includes(phase) ? [actId] : []), phase, String(index + 1).padStart(2, '0')].join('-');
  return VOICE_LINE_BY_ID[id] ?? null;
}
export function voiceForMission(missionId, category = 'mission') {
  const prefix = category === 'explanation' || category === 'help' ? 'help' : 'mission';
  return VOICE_LINE_BY_ID[`${prefix}-${missionId}`] ?? null;
}
export function voiceForFeedback(mission, kind, destination) {
  if (kind === 'already') return VOICE_LINE_BY_ID[`feedback-already-${mission.actor}`];
  if (kind === 'help') return voiceForMission(mission.id, 'explanation');
  const suffix = kind === 'correct' ? 'success'
    : destination === 'bin' && mission.object === 'paper' ? 'bin'
      : kind === 'actor' ? 'actor'
        : kind === 'order' ? 'order'
          : destination === 'bin' ? 'bin' : 'destination';
  return VOICE_LINE_BY_ID[`feedback-${mission.id}-${suffix}`] ?? null;
}
