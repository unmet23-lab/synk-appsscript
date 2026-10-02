const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dir = __dirname;
const source = path.join(dir, '공간과_편의시설_좌표_6안.json');
const bytes = fs.readFileSync(source);
const prior = JSON.parse(bytes);
const unit = 400 / 121;
const a = prior.rooms.find(r => r.id === 'A');
const b = prior.rooms.find(r => r.id === 'B');
const base = prior.outline.w * prior.outline.h - a.w * a.h - b.w * b.h;
const desks = [];
for (let row = 0; row < 4; row++) {
  for (let col = 0; col < 4; col++) {
    desks.push({id: `A-${row * 4 + col + 1}`, room: 'A', x: 2.3 + row * 1.4, y: [1.4, 3.1, 6.4, 8.1][col], w: 0.45, h: 0.6, facing: 'west', chair: {x: 2.85 + row * 1.4, y: [1.5, 3.2, 6.5, 8.2][col], w: 0.4, h: 0.4}});
    desks.push({id: `B-${row * 4 + col + 1}`, room: 'B', x: [8.8, 9.55, 11.1, 11.85][col], y: 1.8 + row * 1.4, w: 0.6, h: 0.45, facing: 'north', chair: {x: [8.9, 9.65, 11.2, 11.95][col], y: 2.35 + row * 1.4, w: 0.4, h: 0.4}});
  }
}
const students = Array.from({length: 25}, (_, i) => ({id: i + 1, x: 3 + Math.floor(i / 5) * 2, y: 1.5 + (i % 5) * 2}));
const model = {
  date: '2026-10-02', status: 'candidate-not-measured-not-construction-not-approved-capacity', units: 'm',
  source: {file: path.basename(source), sha256: crypto.createHash('sha256').update(bytes).digest('hex'), revision: prior.revision},
  confirmed: ['25 students by application per dance session', 'develop A+B operable-partition alternative', 'four classrooms when closed if speech separation verified'],
  proposedNotConfirmed: ['no overlapping Korean lessons during initial dance sessions', 'manual operable partition with plain finish', 'one example after last regular lesson'],
  envelope: {w: 13.2, h: 11, area: 145.2, pyeong: 145.2 / unit},
  roomsClosed: [{id: 'A', x: 0, y: 0, w: 8.4, h: 11, area: 92.4}, {id: 'B', x: 8.52, y: 0, w: 4.68, h: 11, area: 51.48}],
  partition: {x: 8.4, y: 0, w: 0.12, h: 11, thicknessAssumed: true, supportAndPocketUnverified: true, length: 11, pocketInsideEnvelope: false, note: 'Panel parking to be designed outside clear dance rectangle; pocket area is not yet added or located.'},
  dance: {students: 25, teacherCount: 1, teacher: {x: 1, y: 5.5}, studentZone: {x: 2, y: 0.5, w: 10, h: 10}, assumedPitch: 2, studentPositions: students, instructorZone: {x: 0, y: 0, w: 2, h: 11}, rearCandidate: {x: 12, y: 0, w: 1.2, h: 11}, note: '2 m pitch and 0.5 m side allowances are comparison assumptions, not choreography or egress approval.'},
  lecture: {desks, seatsA: 16, seatsB: 16, totalMovableDesks: 32, totalMovableChairs: 32, note: 'Chair pullout, teacher movement, aisle and views require real product and occupied-seat tests.'},
  mirror: {wall: 'west', length: 11, curtain: true},
  displays: [{room: 'A', x: 0.3, y: 5.5, facing: 'east', kind: 'mobile-screen', stowedExternallyForDance: true}, {room: 'B', x: 10.86, y: 0.12, facing: 'south', kind: 'wall-screen', clearancesUnverified: true}],
  doorCandidates: [{room: 'A', side: 'south', start: 6.7, width: 1.1}, {room: 'B', side: 'south', start: 10.2, width: 1.1}],
  cameraCandidates: [{room: 'A', x: 6.6, y: 5.5, facing: 'west'}, {room: 'B', x: 10.86, y: 7.6, facing: 'north'}],
  externalStorage: {areaRange: [12, 16], productsAndFitUnverified: true, content: ['32 folding desks', '32 stacking chairs', 'A mobile screen', 'access and turning'], note: 'Does not establish a fit. Panel pocket and coats/equipment may need extra area.'},
  areaComparison: {existingOutlineArea: 267.9, oldA: 66, oldB: 27.39, otherIncludingOldSharedWall: base, oldSharedWallArea: 0.15 * 6.6, combinedEnvelopeArea: 145.2, externalStorageArea: [12, 16], additionalWallsCirculationArea: [4, 8], totalBeforeSharedWallCorrection: [base + 145.2 + 12 + 4, base + 145.2 + 16 + 8], totalAfterSharedWallCorrection: [base - 0.99 + 145.2 + 12 + 4, base - 0.99 + 145.2 + 16 + 8], pyeongAfterSharedWallCorrection: [(base - 0.99 + 145.2 + 12 + 4) / unit, (base - 0.99 + 145.2 + 16 + 8) / unit], reportedApproximateRange: '102-104 pyeong comparison only; actual pocket, outer footprint and site unverified'},
  scheduleExample: [
    {start: '18:00', end: '19:30', phase: 'Korean', rooms: 'A/B/C/D', minutes: 90},
    {start: '19:30', end: '19:50', phase: 'Prepare A+B', rooms: 'A+B; C/D supervised waiting only after release', minutes: 20},
    {start: '19:50', end: '20:30', phase: 'Dance', rooms: 'A+B; no Korean lessons', minutes: 40},
    {start: '20:30', end: '21:00', phase: 'Restore and handoff', rooms: 'A+B', minutes: 30}
  ],
  occupancyScenarios: {sameStudents: {regularPeakStudents: 64, dancersRemain: 25, depart: 39}, newStudentsOverlap: {regular: 64, incomingDance: 25, students: 89}, staffAndVisitorsExcluded: true},
  implementationLimits: ['not a replacement whole-building plan', 'partition support/pocket unverified', 'no windows/HVAC/egress/toilet fixture adequacy approval', 'no sound/impact tests or local quotes', 'current 6th concept 3D and budget preserved as history', 'no app reservation implementation']
};
fs.writeFileSync(path.join(dir, '가변교실_구획과_운영_초안_20261002.json'), JSON.stringify(model, null, 2) + '\n');
const visualPath = process.argv[2];
if (visualPath) {
  const visual = fs.readFileSync(visualPath, 'utf8');
  const updated = visual.replace(/(<script type="application\/json" data-plan>)[\s\S]*?(<\/script>)/, `$1\n${JSON.stringify(model)}\n  $2`);
  if (updated === visual && !visual.includes(JSON.stringify(model))) throw new Error('Visual data marker not found');
  fs.writeFileSync(visualPath, updated);
}
console.log(JSON.stringify({envelope: model.envelope, classroomSeats: [16,16], danceStudents: 25, totalAreaRange: model.areaComparison.pyeongAfterSharedWallCorrection}, null, 2));
