import test from 'node:test';
import assert from 'node:assert/strict';
import { StoryGame } from './core.mjs';
import { EPISODE, INITIAL_SCENE, ACTOR_IDS, PROP_IDS, DESTINATION_IDS } from './story.mjs';
import { VOICE_LINES, VOICE_LINE_BY_ID, voiceForDialogue, voiceForMission } from './voice-lines.mjs';

function reachPlay(game) {
  let remaining = 100;
  while (game.phase !== 'play' && remaining-- > 0) assert.equal(game.advance(), true);
  assert.equal(game.phase, 'play');
  return game;
}
function place(game, mission, changes = {}) {
  assert.equal(game.selectActor(changes.actor ?? mission.actor), true);
  assert.equal(game.selectObject(changes.object ?? mission.object), true);
  return game.place(changes.destination ?? mission.destination);
}
function finishStory(game) {
  for (const act of EPISODE.acts) {
    reachPlay(game);
    assert.equal(game.currentAct.id, act.id);
    for (const mission of act.missions) assert.equal(place(game, mission).correct, true);
    assert.equal(game.phase, 'outro');
    while (game.phase === 'outro') game.advance();
  }
  assert.equal(game.phase, 'ending');
  return game;
}

test('authored items have valid scene IDs, one object each, and explicit existing sequence requirements', () => {
  const all = [...EPISODE.acts.flatMap(act => act.missions), ...EPISODE.review];
  assert.equal(new Set(all.map(mission => mission.id)).size, all.length);
  for (const group of [...EPISODE.acts.map(act => act.missions), EPISODE.review]) {
    assert.equal(new Set(group.map(mission => mission.object)).size, group.length);
    for (const mission of group) {
      assert.ok(ACTOR_IDS.includes(mission.actor));
      assert.ok(PROP_IDS.includes(mission.object));
      assert.ok(DESTINATION_IDS.includes(mission.destination));
      assert.ok(mission.text.length && mission.skill.length && mission.explanation.length);
      for (const required of mission.requires ?? []) assert.ok(group.some(item => item.id === required && item.id !== mission.id));
    }
  }
  assert.equal(EPISODE.acts.length, 3);
  assert.equal(EPISODE.review.length, 3);
});

test('dialogue cannot skip a play phase and independent tasks work in either order', () => {
  const game = reachPlay(new StoryGame());
  assert.equal(game.advance(), false);
  const [snacks, paper] = game.missions;
  assert.equal(place(game, paper).correct, true);
  assert.equal(game.phase, 'play');
  assert.equal(place(game, snacks).actComplete, true);
  assert.equal(game.phase, 'outro');
  assert.deepEqual(game.completedIds, [paper.id, snacks.id]);
});

test('wrong actor really moves the prop; undo preserves first failure and retry facts', () => {
  const game = reachPlay(new StoryGame());
  const mission = game.missions[0];
  const result = place(game, mission, { actor: 'kkamong' });
  assert.equal(result.kind, 'actor');
  assert.equal(result.correct, false);
  assert.equal(game.scene.snacks, 'box');
  assert.deepEqual(game.completedIds, []);
  assert.equal(game.records[0].firstCorrect, false);
  assert.equal(game.undo(), true);
  assert.equal(game.scene.snacks, 'table');
  assert.equal(game.records[0].attempts, 1);
  assert.equal(place(game, mission).correct, true);
  assert.equal(game.records[0].firstCorrect, false);
  assert.equal(game.records[0].attempts, 2);
  assert.equal(game.records[0].corrected, true);
});

test('paper thrown away has story feedback and can be retrieved by another move', () => {
  const game = reachPlay(new StoryGame());
  const mission = game.missions[1];
  const failure = place(game, mission, { destination: 'bin' });
  assert.match(failure.message, /잠깐/);
  assert.equal(game.scene.paper, 'bin');
  assert.equal(place(game, mission).correct, true);
  assert.equal(game.scene.paper, 'drawer');
  assert.equal(game.records[0].firstCorrect, false);
});

test('an unrelated object movement is reversible without diagnosing an arbitrary reading item', () => {
  const game = reachPlay(new StoryGame());
  const result = place(game, game.missions[0], { object: 'flowers', destination: 'bin' });
  assert.equal(result.kind, 'object');
  assert.equal(game.scene.flowers, 'bin');
  assert.equal(game.records.length, 0);
  assert.equal(game.events[0].type, 'extra-move');
  assert.equal(game.undo(), true);
  assert.equal(game.scene.flowers, INITIAL_SCENE.flowers);
});

test('sequence is checked from the text even when the final location is correct', () => {
  const game = reachPlay(new StoryGame());
  for (const mission of game.missions) place(game, mission);
  while (game.phase === 'outro') game.advance();
  reachPlay(game);
  const [flowers, letter] = game.missions;
  const result = place(game, letter);
  assert.equal(result.correct, false);
  assert.equal(result.kind, 'order');
  assert.equal(game.scene.letter, 'board');
  assert.match(result.message, /먼저.*꽃.*그다음.*편지/);
  assert.equal(game.records.find(record => record.id === letter.id).firstCorrect, false);
  assert.equal(place(game, flowers).correct, true);
  assert.equal(game.completedIds.includes(letter.id), false);
  assert.equal(game.records.find(record => record.id === letter.id).completed, false);
  assert.equal(game.phase, 'play');
  assert.equal(place(game, letter).actComplete, true);
});

test('help before the first answer is distinguishable from help after a first answer', () => {
  const game = reachPlay(new StoryGame());
  const [snacks, paper] = game.missions;
  assert.equal(game.help(snacks.id).kind, 'help');
  place(game, snacks);
  const first = game.records.find(record => record.id === snacks.id);
  assert.equal(first.firstCorrect, true);
  assert.equal(first.helpBeforeFirst, true);
  assert.equal(first.firstHelpUsed, true);
  place(game, paper, { destination: 'bin' });
  game.help(paper.id);
  place(game, paper);
  const second = game.records.find(record => record.id === paper.id);
  assert.equal(second.firstCorrect, false);
  assert.equal(second.helpBeforeFirst, false);
  assert.equal(second.firstHelpUsed, false);
  assert.equal(second.helpUsed, true);
  assert.equal(second.corrected, true);
});

test('undo of the last successful action reopens play while keeping its original first answer', () => {
  const game = reachPlay(new StoryGame());
  const [first, second] = game.missions;
  place(game, first);
  place(game, second);
  assert.equal(game.phase, 'outro');
  assert.equal(game.undo(), true);
  assert.equal(game.phase, 'play');
  assert.equal(game.completedIds.includes(second.id), false);
  const record = game.records.find(item => item.id === second.id);
  assert.equal(record.firstCorrect, true);
  assert.equal(record.completed, false);
  assert.equal(record.undoneCount, 1);
  place(game, second);
  assert.equal(record.attempts, 2);
  assert.equal(record.corrected, false);
});

test('a completed task moved wrongly reopens its completion and the correction is recorded', () => {
  const game = reachPlay(new StoryGame());
  const mission = game.missions[0];
  place(game, mission);
  const ignoredRepeat = place(game, mission);
  assert.equal(ignoredRepeat.kind, 'already');
  assert.equal(game.records[0].attempts, 1);
  place(game, mission, { destination: 'bin' });
  assert.equal(game.completedIds.includes(mission.id), false);
  assert.equal(game.records[0].completed, false);
  place(game, mission);
  assert.equal(game.records[0].firstCorrect, true);
  assert.equal(game.records[0].corrected, true);
});

test('the complete story leads to three new reading items and a separate review result', () => {
  const game = finishStory(new StoryGame());
  const endingScene = { ...game.scene };
  while (game.phase === 'ending') game.advance();
  assert.equal(game.phase, 'review');
  assert.deepEqual(game.scene, endingScene);
  const [snacks, paper, cake] = game.missions;
  assert.equal(game.currentAct.id, 'review');
  assert.equal(place(game, paper).correct, true);
  assert.equal(place(game, snacks).correct, true);
  assert.equal(place(game, cake).actComplete, true);
  assert.equal(game.phase, 'complete');
  assert.equal(game.records.filter(record => record.mode === 'story').length, 6);
  assert.equal(game.records.filter(record => record.mode === 'review').length, 3);
  assert.equal(game.advance(), false);
  assert.equal(game.undo(), true);
  assert.equal(game.phase, 'review');
});

test('new review text rejects the memorized actor or location from the first scene', () => {
  const game = finishStory(new StoryGame());
  game.startReview();
  const mission = game.missions[0];
  const oldMission = EPISODE.acts[0].missions[0];
  assert.notEqual(mission.actor, oldMission.actor);
  assert.notEqual(mission.destination, oldMission.destination);
  assert.equal(place(game, mission, { actor: oldMission.actor, destination: oldMission.destination }).correct, false);
  assert.equal(place(game, mission).correct, true);
  assert.equal(game.records.find(record => record.id === mission.id).firstCorrect, false);
});

test('serialized progress restores dialogue, help, wrong moves, selection, records and undo', () => {
  const game = reachPlay(new StoryGame());
  const mission = game.missions[0];
  game.help(mission.id);
  place(game, mission, { destination: 'bin' });
  game.selectObject('paper');
  const saved = JSON.parse(JSON.stringify(game.snapshot()));
  const restored = new StoryGame();
  assert.equal(restored.restore(saved), true);
  assert.deepEqual(restored.snapshot(), saved);
  assert.equal(restored.undo(), true);
  assert.equal(restored.scene.snacks, 'table');
  assert.equal(restored.records[0].firstCorrect, false);
  assert.equal(restored.records[0].helpBeforeFirst, true);
  restored.restart();
  assert.equal(restored.phase, 'opening');
  assert.equal(restored.actor, null);
  assert.equal(restored.held, null);
  assert.deepEqual(restored.scene, INITIAL_SCENE);
  assert.deepEqual(restored.records, []);
  assert.equal(restored.canUndo, false);
});

test('corrupt or incompatible saved state cannot erase valid live progress', () => {
  const game = reachPlay(new StoryGame());
  place(game, game.missions[0]);
  const before = game.snapshot();
  for (const mutate of [
    saved => { saved.storyVersion = 'old'; },
    saved => { saved.scene.snacks = 'unknown'; },
    saved => { saved.phase = 'complete'; },
    saved => { saved.records[0].firstCorrect = false; },
    saved => { saved.history[0].phase = 'opening'; },
    saved => { saved.records = []; },
    saved => { saved.records = [null]; },
    saved => { saved.history = [null]; },
  ]) {
    const saved = JSON.parse(JSON.stringify(before));
    mutate(saved);
    assert.equal(game.restore(saved), false);
    assert.deepEqual(game.snapshot(), before);
  }
});

test('every valid dialogue and action phase can be restored as local progress', () => {
  const game = new StoryGame();
  let step = 0;
  while (game.phase !== 'complete' && step++ < 150) {
    const restored = new StoryGame();
    assert.equal(restored.restore(game.snapshot()), true, `${game.phase}, act ${game.actIndex}, line ${game.dialogueIndex}`);
    assert.deepEqual(restored.snapshot(), game.snapshot());
    if (game.phase === 'play' || game.phase === 'review') {
      const mission = game.missions.find(item => !game.completedIds.includes(item.id));
      place(game, mission);
    } else game.advance();
  }
  assert.equal(game.phase, 'complete');
  const restored = new StoryGame();
  assert.equal(restored.restore(game.snapshot()), true);
  assert.deepEqual(restored.snapshot(), game.snapshot());
});

test('semantic speech before the first answer is separate from the written explanation help', () => {
  const game = reachPlay(new StoryGame());
  const mission = game.missions[0];
  assert.deepEqual(game.markAudioHelp(mission.id, { source: 'mission', voiceId: `mission-${mission.id}` }), [mission.id]);
  const record = game.records[0];
  assert.equal(record.helpUsed, false);
  assert.equal(record.helpBeforeFirst, false);
  assert.equal(record.audioBeforeFirst, true);
  assert.equal(place(game, mission).correct, true);
  assert.equal(record.firstCorrect, true);
  assert.equal(record.firstHelpUsed, false);
  assert.equal(record.firstAudioHelpUsed, true);
  assert.equal(record.responses[0].audioHelpUsed, true);
  assert.equal(record.responses[0].helpUsed, false);
  assert.deepEqual(record.audioHelps[0], { source: 'mission', voiceId: `mission-${mission.id}`, beforeFirst: true, afterAttempts: 0 });
});

test('speech after the first answer never retroactively changes that answer independence', () => {
  const game = reachPlay(new StoryGame());
  const mission = game.missions[0];
  place(game, mission);
  const record = game.records[0];
  game.markAudioHelp(mission.id, { source: 'feedback', voiceId: `feedback-${mission.id}-success` });
  assert.equal(record.audioHelpUsed, true);
  assert.equal(record.audioBeforeFirst, false);
  assert.equal(record.firstAudioHelpUsed, false);
  assert.equal(record.responses[0].audioHelpUsed, false);
  assert.equal(game.undo(), true);
  place(game, mission);
  assert.equal(record.responses[1].audioHelpUsed, true);
  assert.equal(record.firstAudioHelpUsed, false);
});

test('intro speech maps task clues, while an empty mapping cannot mark every visible item', () => {
  const game = new StoryGame();
  while (game.phase === 'opening') game.advance();
  game.advance();
  game.advance();
  assert.equal(game.phase, 'intro');
  const line = game.currentVoiceLine;
  assert.equal(line.id, 'dialogue-cleanup-intro-03');
  assert.deepEqual(line.assistanceMissionIds, ['cleanup-paper']);
  assert.deepEqual(game.markAudioHelp(line.assistanceMissionIds, { source: 'dialogue', voiceId: line.id }), ['cleanup-paper']);
  assert.equal(game.records[0].audioBeforeFirst, true);
  assert.equal(game.records.some(record => record.id === 'cleanup-snacks'), false);
  assert.deepEqual(game.markAudioHelp([], { source: 'dialogue' }), []);
  assert.deepEqual(game.markAudioHelp(['unknown'], { source: 'mission' }), []);
});

test('visible unfinished speech marking deduplicates IDs and preserves aid through save/undo/restart', () => {
  const game = reachPlay(new StoryGame());
  const [first, second] = game.missions;
  place(game, first);
  assert.deepEqual(game.markAudioHelp(), [second.id]);
  assert.deepEqual(game.markAudioHelp([second.id, second.id], { source: 'explanation', voiceId: `help-${second.id}` }), [second.id]);
  const record = game.records.find(item => item.id === second.id);
  assert.equal(record.audioHelpCount, 2);
  assert.equal(record.helpUsed, false);
  place(game, second, { destination: 'bin' });
  const restored = new StoryGame();
  assert.equal(restored.restore(game.snapshot()), true);
  assert.equal(restored.undo(), true);
  assert.equal(restored.records.find(item => item.id === second.id).audioBeforeFirst, true);
  restored.restart();
  assert.deepEqual(restored.records, []);
});

test('the fixed voice text catalogue covers every authored line and runtime feedback combination', () => {
  assert.equal(new Set(VOICE_LINES.map(line => line.id)).size, VOICE_LINES.length);
  assert.ok(VOICE_LINES.length <= 168);
  for (const [phase, actId, dialogue] of [
    ['opening', null, EPISODE.opening], ['ending', null, EPISODE.ending],
    ...EPISODE.acts.flatMap(act => [['intro', act.id, act.intro], ['outro', act.id, act.outro]]),
  ]) {
    dialogue.forEach((line, index) => {
      const spoken = voiceForDialogue(phase, actId, index);
      assert.equal(spoken.text, line.text);
      assert.equal(spoken.speaker, line.speaker);
    });
  }
  const validate = result => {
    const line = VOICE_LINE_BY_ID[result.voiceId];
    assert.ok(line, result.voiceId);
    assert.equal(result.message, line.text);
    assert.equal(result.speaker, line.speaker);
  };
  const game = new StoryGame();
  validate(game.place('box'));
  for (let group = 0; group < 4; group += 1) {
    if (group < 3) reachPlay(game);
    else while (game.phase === 'ending') game.advance();
    const snapshot = game.snapshot();
    validate(game.place('box'));
    validate(game.place('unknown'));
    for (const mission of game.missions) {
      assert.equal(voiceForMission(mission.id).text, mission.text);
      assert.equal(voiceForMission(mission.id, 'explanation').text, mission.explanation);
      validate(game.help(mission.id));
    }
    for (const actor of ACTOR_IDS) for (const object of PROP_IDS) for (const destination of DESTINATION_IDS) {
      const trial = new StoryGame();
      assert.equal(trial.restore(snapshot), true);
      trial.selectActor(actor);
      trial.selectObject(object);
      validate(trial.place(destination));
    }
    for (const mission of game.missions) validate(place(game, mission));
    if (group < 3) while (game.phase === 'outro') game.advance();
  }
  assert.equal(game.phase, 'complete');
});

test('character speech in the text master keeps the three distinct voices and removes broken syllables', () => {
  for (const line of VOICE_LINES) {
    assert.doesNotMatch(line.text, /[가-힣][ㄱ-ㅎ](?:…|$)/);
    if (line.speaker === 'marin') {
      assert.doesNotMatch(line.text, /[!?！？]/);
      assert.match(line.text, /보고|확인|완료|발견|…/);
    }
    if (line.speaker === 'mongle') assert.match(line.text, /[!?！？]/);
    if (line.speaker === 'kkamong') assert.match(line.text, /이 몸|내가|내 |나|…아니/);
  }
});
