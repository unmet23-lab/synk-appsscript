/** A scene keeps its start L. Only a learner's help can lower an in-flight turn (§3-3). */
import { onHelp, authoredLevel } from './town/language-ladder.mjs';
export function openDialogue({ id, level, channel = 'reading', versions = ['L1', 'L2', 'L3', 'L4'], responseFormat = 'single-choice' }) {
  const chosen = authoredLevel(level, versions);
  return { id, level: chosen, sceneLevel: chosen, channel, responseFormat, lowerRetells: 0,
    help: { meaning: 0, repeat: 0, slower: 0, reopen: 0 }, turns: {}, stopped: false };
}
export function helpDialogue(current, turnId, help) {
  const scene = structuredClone(current);
  if (help === 'stop') { scene.stopped = true; return scene; }
  if (!Object.hasOwn(scene.help, help)) throw new TypeError('Unknown scene help');
  scene.help[help]++;
  const turn = scene.turns[turnId] ||= { level: scene.sceneLevel, repeats: 0 };
  if (help === 'repeat') turn.repeats++;
  const next = onHelp({ sceneLevel: scene.sceneLevel, lineLevel: turn.level, help,
    repeatsOnLine: turn.repeats, lowerRetellsInScene: scene.lowerRetells });
  turn.level = next.lineLevel; scene.sceneLevel = next.sceneLevel; scene.lowerRetells = next.lowerRetellsInScene;
  return scene;
}
export const dialogueLevel = (scene, turnId) => scene.turns[turnId]?.level || scene.sceneLevel;
export function dialogueOutcome(scene) {
  return scene.stopped ? 'stopped' : scene.lowerRetells >= 2 ? 'eased' : scene.lowerRetells === 1 ? 'helped-once' : 'smooth';
}
export const closeDialogue = scene => ({ sceneId: scene.id, level: scene.level, channel: scene.channel,
  help: { meaning: scene.help.meaning, repeat: scene.help.repeat, slower: scene.help.slower },
  outcome: dialogueOutcome(scene), answerMode: scene.responseFormat });
