import { EPISODE, STORY_VERSION } from './story.mjs';

/** Text master only. Audio files and playback are the host's responsibility. */
export const VOICE_TEXT_VERSION = `${STORY_VERSION}-voice-2`;
const allMissions = [...EPISODE.acts.flatMap(act => act.missions), ...EPISODE.review];

// 부탁마다 그 장면에 맞춘 반응(2026-10-08 다시 씀 — 같은 틀을 아홉 번 되풀이하지 않는다).
// 말하는 사람: 맞음 = 옮긴 친구 · 친구가 틀림 = 그 일을 맡은 친구 · 놓을 곳이 틀림 = 몽글
// · 쓰레기통 = 종이는 선생님, 나머지는 까몽 · 순서가 틀림 = 마린. 말투는 docs/캐릭터/가이드_정본.md §2-0~2-3.
const FEEDBACK = {
  'cleanup-snacks': {
    success: '임무 완료. 과자, 상자 안에 보관. …흘린 과자 없음.',
    actor: '확인. 부탁에는 마린이라고 적혀 있다. …과자는 마린 담당.',
    destination: '어? 과자는 상자 안에 넣으라고 했어! 같이 다시 넣어 볼까?',
    bin: '히익, 과자를 버리면 어떡해! 이 몸이 얼른 꺼낼게. 부탁을 다시 읽어 봐.',
  },
  'cleanup-paper': {
    success: '훗, 이 몸이 넣으니까 딱 맞지. 종이는 서랍 안에 쏙.',
    actor: '어이, 그 종이는 이 몸 담당이야. 부탁을 다시 봐.',
    destination: '어? 종이는 서랍 안에 넣으라고 했어! 우리 다시 넣어 보자!',
    bin: '잠깐! 그 종이는 버리면 안 돼. 까몽이 서랍 안에 넣어야 해.',
  },
  'clue-flowers': {
    success: '임무 완료. 꽃, 책상 위에 도착. …교실이 밝아졌다.',
    actor: '확인. 꽃 운반은 마린 담당. …꽃은 내가 옮긴다.',
    destination: '어? 꽃은 책상 위에 놓으라고 했어! 같이 옮겨 볼까?',
    bin: '히익, 꽃을 버리면 안 되지! 이 몸이 구해 줄게. 놓을 곳을 다시 읽어 봐.',
  },
  'clue-letter': {
    success: '훗, 이 몸이 붙인 편지, 반듯하지? …손이 조금 떨렸지만.',
    actor: '그 편지는 이 몸이 붙여야 해. 부탁을 다시 읽어 봐.',
    destination: '어? 편지는 칠판에 붙이라고 했어! 다시 붙여 보자!',
    bin: '그 편지는 이 몸이… 아니, 누가 정성껏 쓴 편지야. 버리면 안 돼.',
    order: '순서 확인. 먼저 꽃. 그다음 편지. …꽃부터 놓는다.',
  },
  'surprise-cake': {
    success: '훗, 이 몸이 지킨 케이크, 무사히 도착. …한 입도 안 먹었어. 진짜야.',
    actor: '그 케이크는 이 몸이 지켜 온 거야. 옮기는 것도 이 몸 몫이지.',
    destination: '우와, 케이크다! 그런데 책상 위에 놓으라고 했어! 같이 옮기자!',
    bin: '히익! 케이크를 버리다니! 이 몸이 끝까지 지켰는데… 놓을 곳을 다시 읽어 봐.',
  },
  'surprise-ribbon': {
    success: '임무 완료. 리본, 칠판에 부착. …보기 좋다.',
    actor: '확인. 리본은 마린 담당. …내가 붙인다.',
    destination: '어? 리본은 칠판에 붙이라고 했어! 같이 다시 해 볼까?',
    bin: '리본을 버리면 파티가 심심해지잖아. 이 몸이 꺼내 줄게. 놓을 곳을 다시 봐.',
    order: '순서 확인. 먼저 케이크. 그다음 리본. …케이크부터 놓는다.',
  },
  'review-snacks': {
    success: '훗, 과자는 선반 위에. 이 몸은 바뀐 부탁도 한 번에 읽지.',
    actor: '이번 과자는 이 몸 담당이야. 부탁을 다시 읽어 봐.',
    destination: '어? 이번에는 선반 위라고 했어! 아까랑 달라! 같이 다시 놓아 볼까?',
    bin: '히익, 과자를 또 버리면 어떡해! 이 몸이 꺼낼게. 이번 부탁을 다시 읽어 봐.',
  },
  'review-paper': {
    success: '임무 완료. 종이, 상자 안에 보관. …서랍이 아니라 상자. 확인.',
    actor: '확인. 이번 종이 담당은 마린. …내가 넣는다.',
    destination: '어? 이번에는 서랍이 아니라 상자라고 했어! 같이 다시 넣자!',
    bin: '잠깐! 종이는 버리면 안 돼. 이번에는 마린이 상자 안에 넣어야 해.',
  },
  'review-cake': {
    success: '임무 완료. 케이크, 선반 위에 도착. …마지막 정리, 끝.',
    actor: '확인. 이번 케이크는 마린 담당. …내가 옮긴다.',
    destination: '어? 케이크는 선반 위에 놓으라고 했어! 같이 다시 올려 볼까?',
    bin: '히익! 케이크는 버리면 안 돼! 이 몸이 구할게. 놓을 곳을 다시 읽어 봐.',
    order: '순서 확인. 먼저 과자. 그다음 케이크. …과자부터 옮긴다.',
  },
};
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

add('feedback-unavailable-story', 'teacher', '이야기를 먼저 읽어 볼까요?', 'feedback');
add('feedback-invalid-destination', 'teacher', '이 물건은 어디에 놓을까요? 놓을 곳을 눌러 주세요.', 'feedback');
add('feedback-selection', 'teacher', '누가 옮길지, 무엇을 옮길지 먼저 골라 주세요.', 'feedback');
add('feedback-extra-object', 'mongle', '어? 그건 부탁에 없는 물건이야! 부탁을 같이 다시 읽어 볼까?', 'feedback');
add('feedback-help-unavailable', 'teacher', '이 장면은 정리가 다 끝났어요.', 'feedback');
add('feedback-already-marin', 'marin', '확인. 그 임무는 이미 완료.', 'feedback');
add('feedback-already-kkamong', 'kkamong', '그건 이 몸이 벌써 끝냈지.', 'feedback');

for (const mission of allMissions) {
  const ids = [mission.id];
  const extra = { missionId: mission.id, mode: EPISODE.review.some(item => item.id === mission.id) ? 'review' : 'story' };
  const say = FEEDBACK[mission.id];
  if (!say || ['success', 'actor', 'destination', 'bin'].some(kind => !say[kind]) || Boolean(mission.requires?.length) !== Boolean(say.order)) {
    throw new Error(`Feedback lines missing for mission: ${mission.id}`);
  }
  add(`mission-${mission.id}`, 'teacher', mission.text, 'mission', ids, extra);
  add(`help-${mission.id}`, 'teacher', mission.explanation, 'explanation', ids, extra);
  add(`feedback-${mission.id}-success`, mission.actor, say.success, 'feedback', ids, extra);
  add(`feedback-${mission.id}-actor`, mission.actor, say.actor, 'feedback', ids, extra);
  add(`feedback-${mission.id}-destination`, 'mongle', say.destination, 'feedback', ids, extra);
  add(`feedback-${mission.id}-bin`, mission.object === 'paper' ? 'teacher' : 'kkamong', say.bin, 'feedback', ids, extra);
  if (say.order) add(`feedback-${mission.id}-order`, 'marin', say.order, 'feedback', ids, extra);
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
