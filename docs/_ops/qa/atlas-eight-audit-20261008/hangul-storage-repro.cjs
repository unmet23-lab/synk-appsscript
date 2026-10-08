'use strict';
// No real browser storage, network calls or source edits: one in-memory device store.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../../..');
const { createGame } = require(path.join(root, 'atlas/game-learning'));
const { createMap } = require(path.join(root, 'strata'));
const disk = new Map();
const storage = { getItem: key => disk.get(key) ?? null, setItem: (key, value) => disk.set(key, value) };
const map = createMap(require(path.join(root, 'strata/maps/topik-i.json')));
const current = createGame({ gameId: 'entry-check', map, storage });
const pid = current.present({ id: 'audit-item', itemKey: 'audit-item', skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, audioRequired: false });
current.answer(pid, { correct: false, assessable: true, choice: { selectedId: 'option-2', correctId: 'option-1' } });
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(root, 'experiences/hangul-stage/atlas-learning.js'), 'utf8'), context);
const hangul = context.SynkLearning.createGame({ gameId: 'hangul-stage', storage });
const evidence = {
  current: current.summary().storage,
  hangul: hangul.summary().storage,
  key: 'synk.atlas.learning.v1.device',
  storedChoice: JSON.parse(disk.get('synk.atlas.learning.v1.device')).events.find(event => event.type === 'practice.attempted').choice,
  reproduction: current.summary().storage.available === true && hangul.summary().storage.available === false,
};
console.log(JSON.stringify(evidence, null, 2));
fs.writeFileSync(path.join(__dirname, 'hangul-storage-repro.json'), JSON.stringify(evidence, null, 2) + '\n');
if (!evidence.reproduction) process.exitCode = 1;
