import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateJob, jobClipIds, jobFiles, jobTexts, FORBIDDEN_RECORD_WORDS } from '../workday/engine/job-schema.mjs';
import { createWorkdaySession, sceneSayIds } from '../workday/engine/session.mjs';
import { buildRecord, recordLines, recordSerial, RECORD_NOTICE, RECORD_LIMITS } from '../workday/engine/record.mjs';
import { planRecordSheet, paintRecordSheet, wrapText, SHEET } from '../workday/engine/record-sheet.mjs';
import { imagePdf } from '../workday/engine/pdf.mjs';
import { questScenePlan, createSilenceGate, clipHoldsStill, QUEST_LIMIT_MINUTES } from '../workday/engine/comfort.mjs';
import { hudRows } from '../workday/engine/hud.mjs';
import { publicFiles, workdayJobFiles } from '../server.mjs';

const WORKDAY = fileURLToPath(new URL('../workday/', import.meta.url));
const JOBS = path.join(WORKDAY, 'jobs');
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const careHome = await readJson(path.join(JOBS, 'care-home', 'job.json'));
const fresh = () => structuredClone(careHome);

/** Plays one scene to its end, choosing by `picks` (say id → option id, report → item ids). */
function playScene(session, sceneId, picks = {}, mode = 'text') {
  let state = session.startScene(sceneId);
  assert.notEqual(state.phase, 'idle', `${sceneId} opens`);
  for (let guard = 0; guard < 200 && state.phase !== 'scene-end'; guard++) {
    if (state.phase === 'line' || state.phase === 'note') state = session.advance();
    else if (state.phase === 'tour') state = session.finishTour();
    else if (state.phase === 'say' && state.say.kind === 'work') state = session.choose(picks[state.say.id] || state.say.options[0].id);
    else if (state.phase === 'say') {
      if (state.say.kind === 'fork') session.choose(picks[state.say.id] || state.say.options[0].id);
      if (state.say.kind === 'report') for (const id of picks[state.say.id] || [state.say.items[0].id]) session.toggleItem(id);
      state = session.submitSay({ mode, text: '네, 알겠습니다.' });
    } else throw new Error(`unexpected phase ${state.phase}`);
  }
  assert.equal(state.phase, 'scene-end', `${sceneId} reaches its end`);
  return state;
}
function playAll(session, job, picks = {}, mode = 'text') {
  for (const scene of job.scenes) playScene(session, scene.id, picks, mode);
}

/** A second occupation written only as data, to prove the engine holds no care-home knowledge. */
function factoryJob() {
  const hint = { en: 'hint' };
  const line = (clip, text, extra = {}) => ({ type: 'line', clip, who: 'lead', text, hint, ...extra });
  return {
    schemaVersion: 1, id: 'factory-test', edition: '시험판 0.1', title: '공장의 하루', role: '제조 현장', summary: '안전 표지를 읽고 작업 지시를 들어요.', minutes: 4, hintLanguages: ['en'],
    cast: { lead: { name: '박 반장', role: '작업반장' } },
    places: {
      gate: { name: '작업장 입구', photo: 'places/gate.jpg', alt: '작업장 입구에 안전 표지가 붙어 있다.', points: [{ id: 'helmet-sign', x: 0.3, y: 0.3, label: '안전모 착용', hint }] },
      line: { name: '조립 라인', photo: 'places/line.jpg', alt: '조립 라인 앞에 작업반장이 서 있다.', live: [0.3, 0.1, 0.7, 1], points: [] },
    },
    notes: {},
    scenes: [
      { id: 'gate', title: '입구', minutes: 2, place: 'gate', steps: [
        line('lead-hello', '안전모부터 써요.'),
        { type: 'tour', home: 'gate', board: ['line'], prompt: '표지를 둘러봐요.', hint },
        { type: 'say', id: 'order', prompt: '지시를 다 알아듣지 못했어요. 어떻게 할까요?', hint, options: [
          { id: 'ask', label: '한 번 더 말해 달라고 한다', example: '죄송하지만 한 번 더 말씀해 주세요.', hint, then: [line('lead-again', '좋아요. 다시 말할게요.')] },
          { id: 'nod', label: '바빠 보이니 일단 고개를 끄덕인다', example: '네.', hint, then: [line('lead-go', '그럼 시작해요.')] },
        ] },
        line('lead-check', '아까 지시는 이해했어요?', { when: { order: 'nod' } }),
      ] },
      { id: 'wrap', title: '보고', minutes: 2, place: 'line', requires: ['gate'], steps: [
        { type: 'report', id: 'report', prompt: '반장에게 보고해요.', hint, items: [
          { id: 'jam', key: true, text: '기계가 한 번 멈췄습니다.', hint },
          { id: 'order', when: { order: 'ask' }, text: '지시를 한 번 더 여쭸습니다.', hint },
          { id: 'order', when: { order: ['nod'] }, text: '지시를 다 알아듣지 못했습니다.', hint },
        ], record: { included: '기계가 멈춘 일을 보고에 넣는다', omitted: '기계가 멈춘 일을 보고에 넣지 않는다' },
          then: { included: [line('lead-thanks', '말해 줘서 고마워요.')], omitted: [line('lead-jam', '기계가 멈췄다면서요.')] } },
      ] },
    ],
    closing: {
      place: 'gate', lead: '맞고 틀린 답을 가리는 자리가 아니에요.',
      principles: [{ id: 'safe', title: '모르면 멈추고 묻는다', body: '알아듣지 못한 지시로 기계를 만지지 않아요.' }],
      forks: [
        { id: 'order', scene: '입구', principle: 'safe', mine: { ask: '한 번 더 여쭸어요.', nod: '일단 고개를 끄덕였어요.' }, say: '죄송하지만 한 번 더 말씀해 주세요.' },
        { id: 'report', scene: '보고', principle: 'safe', mine: { included: '멈춘 일을 보고했어요.', omitted: '멈춘 일을 보고하지 않았어요.' }, say: '기계가 한 번 멈췄습니다.' },
      ],
      conditions: { lead: '이 일의 실제 조건이에요.', items: [{ title: '서서 하는 일', body: '오래 서서 일해요.' }] },
      reflection: { hardLabel: '힘들 것 같은 점', decisionLabel: '오늘 해 보니', decisions: [{ id: 'more', label: '더 알아보겠다' }, { id: 'unsure', label: '아직 모르겠다' }, { id: 'not-me', label: '나와 맞지 않는다' }] },
      ladder: { lead: '준비한 것을 본인이 적어요.', items: [{ id: 'topik', label: 'TOPIK 급수' }] },
    },
  };
}

/** A 2D context that measures text by a fixed advance: 1 em for wide letters, 0.55 em otherwise. */
function measuringContext() {
  const calls = [];
  return { calls, font: '', fillStyle: '', textBaseline: '', textAlign: '',
    measureText(value) { const px = Number(/(\d+)px/.exec(this.font)?.[1] || 16); let width = 0; for (const letter of String(value)) width += /[ᄀ-ᇿ⺀-꓏가-힣＀-￯]/u.test(letter) ? px : px * 0.55; return { width }; },
    fillRect(...box) { calls.push(['rect', ...box]); }, fillText(value, x, y) { calls.push(['text', value, x, y]); } };
}

test('every job in the catalogue passes the scene-table checks and matches its manifest', async () => {
  const index = await readJson(path.join(JOBS, 'index.json'));
  assert.equal(index.schemaVersion, 1);
  const folders = (await readdir(JOBS, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  for (const entry of index.jobs) {
    assert.match(entry.id, /^[a-z0-9-]+$/);
    assert.ok(['open', 'making'].includes(entry.status), `${entry.id} status`);
    if (entry.status !== 'open') continue;
    assert.ok(folders.includes(entry.id), `${entry.id} has a folder`);
    const job = await readJson(path.join(JOBS, entry.id, 'job.json'));
    const manifest = await readJson(path.join(JOBS, entry.id, 'manifest.json'));
    const result = validateJob(job, manifest);
    assert.deepEqual(result.errors, [], `${entry.id} scene table`);
    // The catalogue card repeats four facts; they must be the scene table's own.
    assert.deepEqual({ id: entry.id, title: entry.title, role: entry.role, minutes: entry.minutes, scenes: entry.scenes }, { id: job.id, title: job.title, role: job.role, minutes: job.minutes, scenes: job.scenes.length });
    assert.ok(job.scenes.reduce((sum, scene) => sum + scene.minutes, 0) <= job.minutes, `${entry.id}: scene minutes fit the stated length`);
    const known = new Set(jobClipIds(job));
    for (const clip of manifest.clips) assert.ok(known.has(clip.id), `${entry.id}: manifest clip ${clip.id} is used by a step`);
    // Every file the table names exists, and the poster is one of them.
    const files = jobFiles(job, manifest);
    // Films are not kept in git (*.mp4 is ignored); the publish bundle is what insists they are there.
    for (const file of files.filter((name) => !/\.(?:mp4|webm)$/.test(name))) assert.ok((await stat(path.join(JOBS, entry.id, file))).isFile(), `${entry.id}/${file} exists`);
    assert.ok(files.includes(entry.poster.slice(entry.id.length + 1)), `${entry.id}: poster is a place photograph`);
    // A name on the look-around is heard from its own recording: no job leaves it to the device's voice.
    for (const [place, value] of Object.entries(job.places)) for (const point of value.points) assert.equal(point.audio, `audio/${place}-${point.id}.mp3`, `${entry.id}: ${place}/${point.id} has its recording`);
  }
});

test('a broken scene table is refused with a reason for each fault', () => {
  const cases = [
    ['unknown step type', (job) => { job.scenes[0].steps[0].type = 'jump'; }, /모르는 걸음/],
    ['missing place', (job) => { job.scenes[1].place = 'roof'; }, /자리 roof/],
    ['missing hint language', (job) => { delete job.scenes[0].steps[0].hint.vi; }, /힌트 언어 vi/],
    ['point outside the picture', (job) => { job.places.room.points[0].x = 1.2; }, /좌표/],
    ['single-option fork', (job) => { job.scenes[1].steps[2].options.length = 1; }, /2~3개/],
    ['fork without a following step', (job) => { job.scenes[1].steps[2].options[0].then = []; }, /이어질 걸음/],
    ['when names an unknown option', (job) => { job.scenes[4].steps[1].items[0].when = { wake: 'never' }; }, /보기 wake=never/],
    ['when on a step names an unknown option', (job) => { job.scenes[4].steps[0].when = { wake: 'latr' }; }, /보기 wake=latr/],
    ['when on a step names a fork that comes later', (job) => { job.scenes[0].steps[0].when = { wake: 'later' }; }, /앞에 없어요/],
    ['when uses another scene without requiring it', (job) => { job.scenes[4].requires = ['afternoon']; }, /requires에 morning/],
    ['requires names a later scene', (job) => { job.scenes[0].requires = ['evening']; }, /앞에 있는 장면/],
    ['alternatives do not cover every option', (job) => { job.scenes[4].steps[1].items[1].when = { wake: 'later' }; }, /보기마다 꼭 한 항목/],
    ['empty screen review note', (job) => { job.reviewNoteScreen = ' '; }, /화면에 보일 검토 상태 글/],
    ['screen review note without the record note', (job) => { delete job.reviewNote; }, /reviewNote를 함께/],
    ['an alternative without a condition', (job) => { delete job.scenes[4].steps[1].items[1].when; }, /같은 갈림길 하나/],
    ['fork missing from the closing', (job) => { job.closing.forks.pop(); }, /맺음에 없어요/],
    ['closing forks written as an object', (job) => { job.closing.forks = { handover: {} }; }, /배열이에요/],
    ['closing sentence missing for an option', (job) => { delete job.closing.forks[0].mine.pass; }, /오늘 나는/],
    ['closing without the model sentence', (job) => { delete job.closing.forks[0].say; }, /이렇게 말해요/],
    ['recommendation wording in a turn name', (job) => { job.scenes[0].steps[1].record = '이 일에 적합하다'; }, /「적합」/],
    ['grade wording anywhere a learner reads', (job) => { job.closing.lead = '오늘 점수는 합격입니다.'; }, /「점수」/],
    ['photo outside the job folder', (job) => { job.places.room.photo = '../../secret.jpg'; }, /사진/],
    ['live rectangle out of order', (job) => { job.places.office.live = [0.6, 0, 0.2, 1]; }, /live는/],
    ['action that is not a boolean', (job) => { job.scenes[3].steps[3].action = 'yes'; }, /action은/],
    ['scene without minutes', (job) => { delete job.scenes[2].minutes; }, /예상 분/],
    ['external next link', (job) => { job.closing.next.href = 'https://example.com/'; }, /상대 주소/],
    ['next link hidden behind a space', (job) => { job.closing.next.href = ' //example.com/'; }, /상대 주소/],
    ['photo path hidden behind a space', (job) => { job.places.room.photo = ' https://example.com/a.jpg'; }, /사진/],
    ['duplicate say id', (job) => { job.scenes[2].steps[1].id = 'handover'; }, /겹쳐요/],
    ['line by an unknown person', (job) => { job.scenes[0].steps[0].who = 'stranger'; }, /인물 stranger/],
    ['steps that are not a list', (job) => { job.scenes[0].steps = { a: 1 }; }, /걸음이 없어요/],
    ['options written as an object', (job) => { job.scenes[1].steps[2].options = { ask: {} }; }, /2~3개/],
    // A key that usually names an id can also key a learner's sentence: the word check still reads it.
    ['guarded word in a closing sentence keyed by an option id', (job) => { job.closing.forks.find((fork) => fork.mine?.listen).mine.listen = '이 선택을 추천해요.'; }, /「추천」/],
    ['guarded word in the edition', (job) => { job.edition = '등급판 1.0'; }, /「등급」/],
    ['duplicate principle id', (job) => { job.closing.principles.push({ ...job.closing.principles[0] }); }, /같은 id/],
    ['duplicate ladder item id', (job) => { job.closing.ladder.items.push({ ...job.closing.ladder.items[0] }); }, /같은 id/],
    ['duplicate decision id', (job) => { job.closing.reflection.decisions[2].id = job.closing.reflection.decisions[0].id; }, /같은 id/],
  ];
  for (const [name, breakIt, expected] of cases) {
    const job = fresh(); breakIt(job);
    const result = validateJob(job);
    assert.equal(result.ok, false, name);
    assert.ok(result.errors.some((error) => expected.test(error)), `${name}: ${result.errors.join(' | ')}`);
  }
  assert.equal(validateJob(null).ok, false);
  // A workplace term that contains a guarded word is allowed only when the job lists it whole.
  const term = fresh(); term.notes.bath.body.push('장기요양 등급은 어르신마다 달라요.');
  assert.equal(validateJob(term).ok, false);
  term.allowedTerms = ['장기요양 등급'];
  assert.deepEqual(validateJob(term).errors, []);
});

test('a clip of the wrong kind is refused, and a missing clip is allowed', () => {
  const ids = jobClipIds(careHome);
  assert.ok(ids.includes('senior-welcome') && ids.includes('senior-listen-office') && ids.includes('senior-ask-stumble'));
  assert.equal(ids.length, 28);
  assert.equal(validateJob(fresh(), { clips: [] }).ok, true);
  const wrong = validateJob(fresh(), { clips: [{ id: 'senior-welcome', kind: 'listening' }] });
  assert.ok(wrong.errors.some((error) => /senior-welcome/.test(error)));
});

test('every combination of choices reaches the end and the closing', () => {
  const forks = careHome.scenes.flatMap((scene) => scene.steps.filter((step) => step.type === 'say' && step.options).map((step) => [step.id, step.options.map((option) => option.id)]));
  const reports = [['stumble', 'home'], ['home']];
  let combinations = 0;
  const walk = (index, picks) => {
    if (index < forks.length) { for (const option of forks[index][1]) walk(index + 1, { ...picks, [forks[index][0]]: option }); return; }
    for (const report of reports) {
      const session = createWorkdaySession(careHome);
      playAll(session, careHome, { ...picks, report });
      const state = session.nextScene();
      assert.equal(state.phase, 'closing');
      const data = session.serialize();
      for (const [id] of forks) assert.equal(data.forks[id], picks[id]);
      assert.equal(data.forks.report, report.includes('stumble') ? 'included' : 'omitted');
      combinations++;
    }
  };
  walk(0, {});
  assert.equal(combinations, 3 * 2 * 2 * 2 * 2);
});

test('a fork changes the next line, and the evening report follows the morning choices', () => {
  const session = createWorkdaySession(careHome);
  playScene(session, 'arrival');
  let state = session.startScene('handover');
  state = session.advance(); state = session.advance();
  assert.equal(state.phase, 'say');
  assert.equal(state.say.kind, 'fork');
  assert.equal(state.say.example, null, 'the sentence for a choice waits for the choice');
  assert.equal(session.canSubmit('text', '네, 알겠습니다.'), false, 'a fork needs a choice first');
  state = session.choose('ask');
  assert.match(state.say.example, /다진 식/);
  state = session.submitSay({ mode: 'text', text: '다진 식이 무엇입니까?' });
  assert.equal(state.phase, 'line');
  assert.equal(state.line.clip, 'night-explain');
  assert.equal(session.advance().phase, 'scene-end');

  playScene(session, 'morning', { wake: 'now', meal: 'feed' });
  playScene(session, 'afternoon', { home: 'block' });
  state = session.startScene('evening');
  state = session.advance();
  assert.equal(state.say.kind, 'report');
  const texts = state.say.items.map((item) => item.text);
  assert.equal(state.say.items.length, 4, 'one sentence per event');
  assert.ok(texts.some((text) => /일어나시게 했습니다/.test(text)) && texts.some((text) => /떠 드렸습니다/.test(text)));
  assert.ok(texts.some((text) => /어지럽다고 하셨고/.test(text)), 'the report repeats what the resident said');
  assert.equal(session.canSubmit('text', '보고합니다'), false, 'a report needs at least one item');
  session.toggleItem('home');
  state = session.submitSay({ mode: 'text', text: '집에 가고 싶다고 하셨습니다.' });
  assert.equal(state.line.clip, 'senior-ask-stumble', 'leaving the stumble out changes the senior line');
  assert.match(state.line.text, /그 자리에서 바로/);
});

test('a scene waits for the scenes it depends on, and the next scene skips a locked one', () => {
  const session = createWorkdaySession(careHome);
  const evening = () => session.snapshot().progress.scenes.find((scene) => scene.id === 'evening');
  assert.deepEqual(evening().waitsFor, ['아침 인사와 식사', '오후']);
  assert.equal(session.startScene('evening').phase, 'idle', 'the report cannot open before the day it reports');
  playScene(session, 'morning');
  assert.deepEqual(evening().waitsFor, ['오후']);
  playScene(session, 'afternoon');
  assert.deepEqual(evening().waitsFor, []);
  assert.equal(session.nextScene().scene.id, 'evening');
  session.leave();
  // Running a required scene again reopens it; the report waits until it is finished again.
  session.startScene('morning'); session.leave();
  assert.deepEqual(evening().waitsFor, ['아침 인사와 식사']);
  assert.equal(session.startScene('evening').phase, 'idle');
});

test('moves change the place without a walking step, and the tour returns home', () => {
  const session = createWorkdaySession(careHome);
  let state = session.startScene('arrival');
  assert.equal(state.place, 'office');
  const serial = state.placeSerial;
  state = session.advance();
  state = session.submitSay({ mode: 'text', text: '안녕하세요. 저는 바트입니다.' });
  state = session.advance();
  assert.equal(state.phase, 'tour');
  assert.deepEqual(state.tour.board.map((item) => item.id), ['room', 'dining', 'nurse', 'bath-door']);
  state = session.goTo('room');
  assert.equal(state.place, 'room');
  assert.equal(state.placeCaption, careHome.places.room.name);
  assert.ok(state.placeSerial > serial);
  state = session.hear('call-bell');
  assert.equal(state.tour.openPoint.label, '호출 벨');
  assert.equal(state.tour.points.find((point) => point.id === 'call-bell').heard, true);
  state = session.goTo('bath-door');
  state = session.hear('bath-plan');
  assert.equal(state.tour.openPoint.note.title, '선배의 말');
  assert.equal(session.goTo('roof').place, 'bath-door', 'only board places can be visited');
  state = session.finishTour();
  assert.equal(state.place, 'office');
  assert.equal(state.phase, 'scene-end');

  state = session.startScene('morning');
  assert.equal(state.place, 'room-bed');
  state = session.advance(); session.choose('later');
  state = session.submitSay({ mode: 'voice', text: '조금 뒤에 다시 올게요' });
  assert.equal(state.line.clip, 'soonja-thanks');
  state = session.advance();
  assert.equal(state.place, 'room-table', 'the move step is applied before the next line');
  assert.equal(state.placeCaption, '아침 식사');
  assert.equal(state.line.clip, 'soonja-slow');
});

test('help is counted once per step, also after a reload, and an example answer is its own kind', () => {
  const session = createWorkdaySession(careHome);
  let state = session.startScene('arrival');
  session.openHint(); session.openHint();
  assert.equal(session.snapshot().counts.hints, 1);
  assert.equal(session.replay(), 'senior-welcome');
  state = session.advance();
  assert.equal(session.replay(), 'senior-welcome', 'the last line can be heard again while answering');
  session.openExample(); session.openExample();
  state = session.submitSay({ mode: 'example' });
  assert.equal(state.phase, 'line');
  const data = session.serialize();
  assert.deepEqual(data.counts, { replays: 2, hints: 1, examples: 1 });
  assert.deepEqual(data.says.intro, { scene: 'arrival', produced: 'example', helped: true });
  assert.equal(session.canSubmit('text', ' . '), false);
  // The same hint opened again after a reload is still one hint.
  const again = createWorkdaySession(careHome, { saved: JSON.parse(JSON.stringify(data)) });
  again.startScene('arrival'); again.openHint();
  assert.equal(again.snapshot().counts.hints, 1);
});

test('speech the device could not make out moves on without counting against the learner', () => {
  const session = createWorkdaySession(careHome);
  session.startScene('arrival'); session.advance();
  assert.equal(session.canSubmit('voice', ''), false, 'an empty recognition is not a spoken answer');
  assert.equal(session.canSubmit('unheard'), true);
  // One Korean syllable is a whole answer (「네」); one stray mark or letter is not.
  assert.equal(session.canSubmit('text', '네.'), true);
  assert.equal(session.canSubmit('voice', '네'), true);
  assert.equal(session.canSubmit('text', 'a'), false);
  assert.equal(session.canSubmit('text', '…'), false);
  session.submitSay({ mode: 'unheard' });
  session.advance(); session.finishTour();
  playScene(session, 'handover', { handover: 'confirm' }, 'unheard');
  // A report sent without speaking is its own tally: a report has no example sentence (Fable F3).
  playScene(session, 'morning'); playScene(session, 'afternoon');
  playScene(session, 'evening', { report: ['stumble'] }, 'example');
  const data = session.serialize();
  assert.equal(data.says.intro.produced, 'unheard');
  assert.equal(data.counts.examples, 1);
  const record = buildRecord(careHome, data, { serial: 'PW-20261130-AAAAAA', date: new Date(2026, 10, 30) });
  assert.deepEqual({ voice: record.korean.voice, text: record.korean.text, example: record.korean.example, reported: record.korean.reported }, { voice: 0, text: 4, example: 0, reported: 1 });
  assert.equal(record.choices.at(-1).how, '고른 일만 보고함');
  assert.ok(JSON.stringify(recordLines(record).sections[1].rows).includes('고른 일만 보고한 것 1번'));
  assert.deepEqual(record.korean.turns, ['비틀거리신 어르신께 말을 건네는 차례 · 글로 답함'], 'an unheard turn is not listed at all');
  assert.equal(record.choices[0].text, '들은 것을 다시 말해 확인한다');
  assert.equal(record.choices[0].how, '', 'the choice is kept; how it was said is left blank');
  const body = JSON.stringify(recordLines(record).sections);
  assert.ok(!/가운데|못해|unheard/.test(body), 'no fraction and no trace of the failed recognition');
  // When every turn went unheard, the sheet does not claim the learner never answered.
  const quiet = createWorkdaySession(careHome);
  quiet.startScene('arrival'); quiet.advance(); quiet.submitSay({ mode: 'unheard' }); quiet.advance(); quiet.finishTour();
  while (quiet.snapshot().phase !== 'scene-end') quiet.advance();
  const quietLines = recordLines(buildRecord(careHome, quiet.serialize(), { serial: 'PW-20261130-AAAAAA', date: new Date(2026, 10, 30) }));
  const korean = quietLines.sections.find((section) => section.title.includes('한국어로 한 일'));
  assert.ok(korean.rows.includes('이 기록에 적힌 답이 없습니다.') && !JSON.stringify(korean).includes('아직'), JSON.stringify(korean));
});

test('pause holds the scene, leaving drops it, and a scene run again replaces its record', () => {
  const session = createWorkdaySession(careHome);
  session.startScene('handover');
  session.pause();
  assert.equal(session.advance().phase, 'line', 'nothing advances while paused');
  session.addActiveMs(4000);
  session.resume(); session.addActiveMs(4000); session.addActiveMs(60_000);
  assert.equal(session.serialize().scenes.handover.activeMs, 9000, 'idle gaps are capped');
  assert.equal(session.leave().phase, 'idle');
  assert.equal(session.serialize().scenes.handover.done, false);
  playScene(session, 'handover', { handover: 'pass' });
  playScene(session, 'handover', { handover: 'confirm' });
  const data = session.serialize();
  assert.equal(data.forks.handover, 'confirm');
  assert.equal(data.scenes.handover.runs, 3);
  assert.equal(data.scenes.handover.finishes, 2, 'a stop half way is not a finish');
  // A scene stopped half way and then finished once is not 「다시 한 장면」.
  const once = createWorkdaySession(careHome);
  playScene(once, 'arrival'); once.startScene('handover'); once.leave(); playScene(once, 'handover', { handover: 'confirm' });
  const onceLines = recordLines(buildRecord(careHome, once.serialize(), { serial: 'PW-20261130-AAAAAA', date: new Date(2026, 10, 30) }));
  assert.ok(!JSON.stringify(onceLines).includes('다시 한 장면'), JSON.stringify(onceLines.sections[0]));
  // Without any film there was nothing to hear again, so the sheet does not count replays.
  const silent = recordLines(buildRecord(careHome, once.serialize(), { serial: 'PW-20261130-AAAAAA', date: new Date(2026, 10, 30), films: false }));
  assert.ok(!JSON.stringify(silent).includes('다시 듣기') && JSON.stringify(silent).includes('힌트 0번'));
  assert.equal(session.snapshot().progress.anyDone, true);
  assert.equal(session.snapshot().progress.allDone, false);
});

test('saved progress is restored only for the same job and edition, and holds no words of the learner', () => {
  const first = createWorkdaySession(careHome);
  playScene(first, 'arrival'); playScene(first, 'handover', { handover: 'ask' });
  const saved = first.serialize();
  assert.ok(!JSON.stringify(saved).includes('알겠습니다'), 'the answer text is never part of the saved data');
  assert.deepEqual(Object.keys(saved).sort(), ['counts', 'edition', 'forkScene', 'forks', 'hinted', 'job', 'says', 'scenes', 'tour', 'v', 'works']);
  const again = createWorkdaySession(careHome, { saved: JSON.parse(JSON.stringify(saved)) });
  assert.deepEqual(again.snapshot().progress.scenes.map((scene) => scene.done), [true, true, false, false, false]);
  assert.equal(again.serialize().forks.handover, 'ask');
  const other = createWorkdaySession(careHome, { saved: { ...saved, edition: '표준판 0.9' } });
  assert.equal(other.snapshot().progress.anyDone, false);
  const tampered = createWorkdaySession(careHome, { saved: { ...saved, says: { intro: { scene: 'nowhere', produced: 'voice' } }, scenes: { ...saved.scenes, ghost: { done: true } } } });
  assert.deepEqual(Object.keys(tampered.serialize().says), []);
  assert.equal(tampered.serialize().scenes.ghost, undefined);
  assert.equal(first.reset().progress.anyDone, false);
});

test('the record lists what happened and never a score, grade or recommendation', () => {
  const session = createWorkdaySession(careHome);
  playAll(session, careHome, { handover: 'ask', wake: 'later', meal: 'wait', home: 'listen', report: ['stumble', 'home'] }, 'voice');
  const serial = recordSerial(new Date(2026, 10, 30), [1, 2, 3, 4, 5, 250]);
  assert.match(serial, /^PW-20261130-[2-9A-HJ-NP-Z]{6}$/);
  assert.throws(() => recordSerial(new Date(), [1, 2]), RangeError);
  const record = buildRecord(careHome, session.serialize(), { name: '  바트  에르덴 ', reasons: { wake: '어르신이 피곤해 보이셨다' }, hard: 'Шөнийн ээлж хэцүү байх', decision: 'unsure', ladder: { topik: '3급, 2026년 10월', visa: '' }, view: 'quest', date: new Date(2026, 10, 30), serial });
  assert.equal(record.name, '바트 에르덴');
  assert.equal(record.view, 'Quest');
  assert.equal(record.speak, '음성');
  assert.deepEqual(record.completed, { scenes: 5, of: 5, minutes: 0, replayedScenes: 0 });
  assert.equal(careHome.scenes.reduce((sum, scene) => sum + sceneSayIds(scene).length, 0), 7);
  assert.deepEqual({ voice: record.korean.voice, text: record.korean.text, example: record.korean.example, unaided: record.korean.unaided }, { voice: 7, text: 0, example: 0, unaided: 7 });
  assert.deepEqual(record.korean.turns, ['자기소개 차례 · 말로 답함', '비틀거리신 어르신께 말을 건네는 차례 · 말로 답함']);
  assert.deepEqual(record.choices.map((choice) => choice.scene), ['아침 인계', '아침 인사', '아침 식사', '오후', '저녁 인계']);
  // A choice is written in the option's own words and how the turn was answered — not as a claim about what was said.
  assert.deepEqual(record.choices.map((choice) => choice.text), ['모르는 말을 되묻는다', '까닭을 여쭙고 조금 뒤에 다시 온다', '스스로 드시게 곁에서 기다린다', '마음을 받아 주고 이야기를 듣는다', '비틀거리신 일을 보고에 넣는다']);
  assert.equal(record.choices[1].reason, '어르신이 피곤해 보이셨다');
  assert.equal(record.reflection.decision, '아직 모르겠다');
  assert.deepEqual(record.ladder, [{ label: 'TOPIK 급수와 성적 날짜', value: '3급, 2026년 10월' }]);
  const lines = recordLines(record);
  assert.equal(lines.sections.length, 5);
  assert.equal(lines.heading, '체험 기록 — 요양보호사의 하루');
  // The second line names the service and the job, not the scene table's edition.
  assert.equal(lines.edition, 'PATH 일터 체험 · 요양보호사');
  assert.equal(lines.sections[1].rows[0], '말로 답한 것 7번');
  assert.match(lines.serial, /^기록 번호\(본인 기기에서 만듦\) PW-/);
  const everything = JSON.stringify(lines);
  for (const word of FORBIDDEN_RECORD_WORDS) assert.ok(!everything.includes(word), `the sheet avoids 「${word}」`);
  assert.ok(!/가운데|여쭸다|되물었다|발급/.test(everything), 'no fraction, no unconfirmed claim, no word that sounds issued by SYNK');
  assert.deepEqual(lines.notice, [...RECORD_NOTICE, careHome.reviewNote]);
  assert.throws(() => buildRecord(careHome, session.serialize(), {}), TypeError);
});

test('a partial run and example answers are shown as they are', () => {
  const session = createWorkdaySession(careHome);
  playScene(session, 'arrival', {}, 'example');
  playScene(session, 'handover', { handover: 'pass' }, 'text');
  session.addActiveMs(1);
  const record = buildRecord(careHome, session.serialize(), { serial: 'PW-20261130-AAAAAA', date: new Date(2026, 10, 30) });
  assert.equal(record.completed.scenes, 2);
  assert.equal(record.speak, '글');
  assert.deepEqual(record.korean.turns, ['자기소개 차례 · 예시 문장을 고름']);
  assert.deepEqual(record.choices.map((choice) => `${choice.text} · ${choice.how}`), ["인계가 바쁘니 일단 '네' 하고 넘어간다 · 글로 답함"]);
  const lines = recordLines(record);
  assert.equal(lines.sections.length, 3, 'empty sections are left out');
  assert.equal(lines.sections[0].rows[0], '마친 장면 2개(모두 5개)');
  assert.equal(lines.sections[1].rows[0], '글로 답한 것 1번 · 예시 문장으로 답한 것 1번');
});

test('the sheet stays one page for a usual record and continues on a second when the learner writes a lot', () => {
  const session = createWorkdaySession(careHome);
  playAll(session, careHome, { report: ['stumble', 'home', 'sleep', 'meal'] }, 'voice');
  const base = { serial: 'PW-20261130-AAAAAA', date: new Date(2026, 10, 30), name: '바트 에르덴', decision: 'more' };
  const usual = recordLines(buildRecord(careHome, session.serialize(), { ...base, hard: '밤 근무가 힘들 것 같아요.', ladder: { topik: '3급, 2026년 10월', visa: 'D-2' } }));
  const context = measuringContext();
  const plan = planRecordSheet(context, usual);
  assert.equal(plan.pages.length, 1, 'a usual record is one sheet');
  const long = '가'.repeat(400);
  const reasons = Object.fromEntries(careHome.closing.forks.map((fork) => [fork.id, long]));
  const ladder = Object.fromEntries(careHome.closing.ladder.items.map((item) => [item.id, long]));
  const full = recordLines(buildRecord(careHome, session.serialize(), { ...base, name: long, reasons, hard: long, ladder }));
  assert.ok(JSON.stringify(full).length < JSON.stringify(usual).length + (RECORD_LIMITS.reason * 5 + RECORD_LIMITS.hard + RECORD_LIMITS.ladder * 4 + RECORD_LIMITS.name) * 3 + 200, 'typed fields are cut at their limits');
  const fullPlan = planRecordSheet(context, full);
  assert.ok(fullPlan.pages.length >= 2 && fullPlan.pages.length <= 3, `continues on another sheet (${fullPlan.pages.length})`);
  assert.ok(fullPlan.scale >= 0.85, 'the text is never shrunk below a readable size');
  for (const [index, page] of fullPlan.pages.entries()) {
    for (const item of page) if (item.text !== undefined) assert.ok(item.y + 10 < fullPlan.limit, `sheet ${index + 1}: no row runs into the notice`);
    context.calls.length = 0;
    paintRecordSheet(context, fullPlan, full, index);
    const drawn = context.calls.filter((call) => call[0] === 'text');
    assert.ok(drawn.every(([, , x, y]) => x >= SHEET.margin - 1 && x <= SHEET.width - SHEET.margin + 1 && y < SHEET.height - SHEET.margin), 'everything stays inside the margins');
    assert.ok(drawn.some(([, value]) => value.startsWith('기록 번호')), 'each sheet carries the record number');
  }
  assert.deepEqual(wrapText(context, 'é'.repeat(3), 1), ['é', 'é', 'é'], 'a combining mark stays with its letter');
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = new TextDecoder('latin1').decode(imagePdf({ pages: [{ jpeg, width: 4, height: 4 }, { jpeg, width: 4, height: 4 }], title: '체험 기록', date: new Date(0) }));
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /\/Count 2 /);
  assert.equal(pdf.match(/\/Type \/Page /g).length, 2);
  assert.ok(pdf.trimEnd().endsWith('%%EOF'));
  assert.throws(() => imagePdf({ pages: [] }), RangeError);
});

test('a second occupation runs on data alone', async () => {
  const job = factoryJob();
  assert.deepEqual(validateJob(job, { clips: [] }).errors, []);
  const session = createWorkdaySession(job);
  assert.equal(session.startScene('wrap').phase, 'idle', 'the report waits for the scene it reports');
  let state = session.startScene('gate');
  state = session.advance(); state = session.goTo('line'); state = session.finishTour();
  session.choose('nod'); state = session.submitSay({ mode: 'voice', text: '네 알겠습니다' });
  assert.equal(state.line.clip, 'lead-go');
  state = session.advance();
  assert.equal(state.line.clip, 'lead-check', 'a step with a matching condition is played');
  assert.equal(session.advance().phase, 'scene-end');
  state = session.nextScene();
  assert.deepEqual(state.say.items.map((item) => item.text), ['기계가 한 번 멈췄습니다.', '지시를 다 알아듣지 못했습니다.']);
  session.leave();
  playScene(session, 'gate', { order: 'ask' });
  playScene(session, 'wrap', { report: ['jam'] });
  const lines = recordLines(buildRecord(job, session.serialize(), { serial: 'PW-20261130-AAAAAA', date: new Date(2026, 10, 30) }));
  assert.deepEqual(lines.sections[2].rows, ['입구: 한 번 더 말해 달라고 한다 · 글로 답함', '보고: 기계가 멈춘 일을 보고에 넣는다 · 글로 답함']);
  // A condition that does not match removes the step: asking again skips the check-back line.
  const asked = createWorkdaySession(job);
  asked.startScene('gate'); asked.advance(); asked.finishTour(); asked.choose('ask');
  assert.equal(asked.submitSay({ mode: 'example' }).line.clip, 'lead-again');
  assert.equal(asked.advance().phase, 'scene-end');
  // Nothing in the engine or the pages names an occupation.
  const sources = ['engine/job-schema.mjs', 'engine/session.mjs', 'engine/record.mjs', 'engine/record-sheet.mjs', 'engine/pdf.mjs', 'engine/hud.mjs', 'engine/place-stage.mjs', 'engine/comfort.mjs', 'play.mjs', 'play.html', 'hub.mjs', 'closing-steps.mjs', 'index.html'];
  for (const file of sources) assert.ok(!/어르신|요양|돌봄|간호|공장/.test(await readFile(path.join(WORKDAY, file), 'utf8')), `${file} holds no occupation word`);
});

test('a headset visit stays inside ten minutes and a first visit is one scene', () => {
  assert.equal(QUEST_LIMIT_MINUTES, 10);
  assert.deepEqual(questScenePlan({ insideMs: 0, sceneMinutes: 3 }), { open: true, reason: '' });
  assert.deepEqual(questScenePlan({ insideMs: 7 * 60000, sceneMinutes: 3 }), { open: true, reason: '' });
  assert.deepEqual(questScenePlan({ insideMs: 7 * 60000 + 1, sceneMinutes: 3 }), { open: false, reason: 'time' });
  assert.deepEqual(questScenePlan({ insideMs: 60000, sceneMinutes: 2, firstVisit: true, scenesThisVisit: 1 }), { open: false, reason: 'first-visit' });
  assert.equal(questScenePlan({ insideMs: 0, sceneMinutes: 2, firstVisit: true, scenesThisVisit: 0 }).open, true);
  // Whatever order the care-home scenes are taken in, the plan never lets a visit pass the limit.
  let inside = 0, opened = 0;
  for (const scene of careHome.scenes) { if (!questScenePlan({ insideMs: inside, sceneMinutes: scene.minutes }).open) break; inside += scene.minutes * 60000; opened++; }
  assert.ok(opened >= 1 && inside <= QUEST_LIMIT_MINUTES * 60000, `${opened} scenes, ${inside / 60000} minutes`);
});

test('a turn ends on quiet after speech, without needing recognised words', () => {
  const gate = createSilenceGate({ threshold: 0.02, minSpeechMs: 400, quietMs: 1800, maxMs: 30000 });
  let now = 0, state = 'waiting';
  const feed = (level, ms) => { for (let passed = 0; passed < ms; passed += 50) { now += 50; state = gate.push(level, now); } return state; };
  assert.equal(feed(0.001, 5000), 'waiting', 'quiet before any speech never ends the turn');
  assert.equal(gate.heardSpeech(), false);
  assert.equal(feed(0.2, 1500), 'speaking');
  assert.equal(feed(0.001, 1700), 'speaking', 'a short pause is not the end');
  assert.equal(feed(0.2, 300), 'speaking');
  assert.equal(feed(0.001, 1800), 'done');
  assert.equal(gate.heardSpeech(), true);
  gate.reset(); now = 0;
  assert.equal(feed(0.001, 30100), 'done', 'a turn with no speech still ends at the cap');
  assert.equal(gate.heardSpeech(), false);
  assert.equal(clipHoldsStill({ outside: 3, shift: 1 }), true);
  assert.equal(clipHoldsStill({ outside: 9, shift: 1 }), false);
  assert.equal(clipHoldsStill({}), false, 'an unmeasured clip is not trusted in a headset');
});

test('only files the catalogue points at are served, and the styles keep still', async () => {
  const served = new Set(await publicFiles());
  const jobFilesServed = await workdayJobFiles();
  assert.ok(jobFilesServed.includes('workday/jobs/care-home/job.json') && jobFilesServed.includes('workday/jobs/care-home/places/office-senior.jpg'));
  assert.ok(jobFilesServed.every((file) => !/\/production\//.test(file) && !/\.txt$/.test(file)), 'working notes are never public');
  for (const file of ['workday/index.html', 'workday/play.html', 'workday/play.mjs', 'workday/closing-steps.mjs', 'workday/engine/comfort.mjs', 'workday/jobs/index.json']) assert.ok(served.has(file), `${file} is served`);
  assert.ok(![...served].some((file) => file.startsWith('workday/docs/') || file.includes('/production/')));
  // Every module the pages import is on the allow-list.
  for (const page of ['play.mjs', 'hub.mjs', 'closing-steps.mjs', ...(await readdir(path.join(WORKDAY, 'engine'))).map((name) => `engine/${name}`)]) {
    const source = await readFile(path.join(WORKDAY, page), 'utf8');
    for (const [, target] of source.matchAll(/from '(\.{1,2}\/[^']+)'/g)) {
      const resolved = path.posix.normalize(path.posix.join('workday', path.posix.dirname(page), target));
      assert.ok(served.has(resolved), `${page} imports ${resolved}, which must be served`);
    }
  }
  // No self-running motion and no hollow ring: the only movement is a fade the learner triggers.
  const css = await readFile(path.join(WORKDAY, 'workday.css'), 'utf8');
  assert.ok(!/@keyframes|animation\s*:/.test(css), 'no keyframe animation');
  assert.ok(!/border-radius:\s*50%[^}]*background:\s*(?:transparent|none)/.test(css), 'no hollow circle');
  // Learner-facing words of the pages themselves.
  for (const file of ['index.html', 'play.html', 'play.mjs', 'hub.mjs', 'closing-steps.mjs']) {
    const source = await readFile(path.join(WORKDAY, file), 'utf8');
    for (const word of FORBIDDEN_RECORD_WORDS.filter((item) => !['점수', '등급'].includes(item))) assert.ok(!source.includes(word), `${file} avoids 「${word}」`);
  }
  assert.ok(jobTexts(careHome).length > 200);
  assert.ok(!jobTexts(careHome).some((value) => /^[a-z0-9-]+$/.test(value) && ['senior', 'office', 'room'].includes(value)), 'plain ids stay out of the text list');
});

test('a tool step and a relay step run on data alone, and the sheet lists the tool without right or wrong', async () => {
  const hint = { mn: 'туслах', vi: 'gợi ý', en: 'hint' };
  const job = fresh();
  job.cast.guest = { name: '바트', role: '손님' };
  const tool = { type: 'work', id: 'find-room', record: '예약 화면에서 방 번호를 찾는 차례', prompt: '손님의 방 번호를 골라요.', hint,
    tool: { kind: 'screen', title: '예약 조회', rows: [['손님', 'BAT / 바트'], ['객실', '302 · 트윈']], note: '조식 포함' },
    options: [{ id: 'r302', label: '302호', hint, then: [{ type: 'line', who: 'senior', clip: 'room-right', hint, text: '네, 302호 맞아요.' }] }, { id: 'r320', label: '320호', hint, then: [{ type: 'line', who: 'senior', clip: 'room-again', hint, text: '한 번 더 볼래요? 숫자 순서가 달라요.' }] }] };
  const relay = { type: 'relay', id: 'guest-relay', record: '손님의 말을 한국어로 전하는 차례', who: 'guest', hint,
    foreign: { mn: 'Нэмэлт хөнжил авч болох уу?', vi: 'Cho tôi thêm một cái chăn được không?', en: 'Could I have one more blanket?' },
    meaning: '담요를 하나 더 받고 싶대요.', prompt: '손님의 말을 선배에게 한국어로 전해요.', example: '선배님, 손님이 담요를 하나 더 받고 싶으시대요.' };
  job.scenes[0].steps.splice(1, 0, tool, relay);
  relay.listen = 'guest-listen';
  // The clip tool plans the guest's listening film too, so it is trimmed and listed like any other.
  const { clipPlan } = await import('../../../tools/prepare-workday-clips.mjs');
  assert.equal(clipPlan(job).get('guest-listen')?.kind, 'listening');
  // The day goes on from the pick: a later line appears only after the other room number was picked.
  job.scenes[0].steps.push({ type: 'line', who: 'senior', channel: 'phone', clip: 'room-call', hint, text: '아까 방 번호는 다시 확인했어요.', when: { 'find-room': 'r320' } });
  assert.deepEqual(validateJob(job).errors, [], 'a tool pick is not a value fork, so the closing does not list it');
  assert.ok(jobClipIds(job).length > 0);

  const session = createWorkdaySession(job);
  let state = session.startScene('arrival');
  state = session.advance();
  assert.equal(state.say.kind, 'work');
  assert.equal(state.say.tool.title, '예약 조회');
  assert.equal(state.say.example, null);
  assert.equal(session.canSubmit('text', '302호'), false, 'a tool step ends on the pick, not on an answer');
  state = session.choose('r320');
  assert.equal(state.phase, 'line');
  assert.equal(state.line.text, '한 번 더 볼래요? 숫자 순서가 달라요.');
  state = session.advance();
  assert.equal(state.say.kind, 'relay');
  assert.equal(state.say.foreign.text.vi, 'Cho tôi thêm một cái chăn được không?');
  assert.equal(state.say.foreign.name, '바트');
  assert.equal(state.say.example, '선배님, 손님이 담요를 하나 더 받고 싶으시대요.');
  state = session.submitSay({ mode: 'text', text: '손님이 담요를 원하세요.' });
  const seen = [];
  for (let guard = 0; guard < 200 && state.phase !== 'scene-end'; guard++) {
    if (state.phase === 'line') { seen.push(state.line); state = session.advance(); }
    else if (state.phase === 'note') state = session.advance();
    else if (state.phase === 'tour') state = session.finishTour();
    else if (state.phase === 'say') state = session.submitSay({ mode: 'text', text: '네, 알겠습니다.' });
  }
  const phoneLine = seen.find((line) => line.text === '아까 방 번호는 다시 확인했어요.');
  assert.ok(phoneLine, 'the later line follows the earlier pick');
  assert.equal(phoneLine.channel, 'phone');
  const data = session.serialize();
  assert.deepEqual(data.works, { 'find-room': { scene: 'arrival' } });
  const lines = recordLines(buildRecord(job, data, { serial: 'PW-20261130-AAAAAA', date: new Date(2026, 10, 30) }));
  const tools = lines.sections.find((section) => section.title.includes('일터의 도구를 다룬 것'));
  assert.deepEqual(tools.rows, ['예약 화면에서 방 번호를 찾는 차례']);
  assert.ok(!/맞힘|틀림|정답|오답/.test(JSON.stringify(lines)), 'the sheet never says whether a tool was used rightly');
  const korean = lines.sections.find((section) => section.title.includes('한국어로 한 일'));
  assert.ok(korean.rows.includes('손님의 말을 한국어로 전하는 차례 · 글로 답함'));

  // A run again replaces the tool record of that scene.
  playScene(session, 'arrival');
  assert.equal(session.serialize().forks['find-room'], 'r302', 'a run again replaces the earlier pick');

  const broken = [
    ['tool of an unknown kind', (copy) => { copy.scenes[0].steps[1].tool.kind = 'fax'; }, /tool은 kind/],
    ['tool with nothing to read', (copy) => { delete copy.scenes[0].steps[1].tool.rows; }, /rows나 lines/],
    ['tool with one option', (copy) => { copy.scenes[0].steps[1].options.length = 1; }, /2~4개/],
    ['relay without English', (copy) => { delete copy.scenes[0].steps[2].foreign.en; }, /foreign의 en/],
    ['relay by an unknown person', (copy) => { copy.scenes[0].steps[2].who = 'nobody'; }, /인물 nobody/],
    ['a line on an unknown channel', (copy) => { copy.scenes[0].steps.at(-1).channel = 'radio'; }, /channel은 phone/],
    ['when naming a tool option that does not exist', (copy) => { copy.scenes[0].steps.at(-1).when = { 'find-room': 'r999' }; }, /보기 find-room=r999/],
  ];
  for (const [name, breakIt, expected] of broken) {
    const copy = structuredClone(job); breakIt(copy);
    const result = validateJob(copy);
    assert.ok(result.errors.some((error) => expected.test(error)), `${name}: ${result.errors.join(' | ')}`);
  }
});

test('a guest has a name per language, speaks in the learner\'s language, and hears Korean said on in it', () => {
  const hint = { mn: 'туслах', vi: 'gợi ý', en: 'hint' };
  const job = fresh();
  job.cast.guest = { name: '손님', role: '1208호 손님', names: { mn: 'Батбаяр', vi: 'Nguyễn Văn An', en: 'Batbayar' } };
  const tool = { type: 'work', id: 'find-room', record: '예약 화면에서 방 번호를 찾는 차례', prompt: '손님의 방 번호를 골라요.', hint,
    tool: { kind: 'screen', title: '예약 조회', rows: [['손님', { mn: 'БАТБАЯР', vi: 'NGUYEN VAN AN', en: 'BATBAYAR' }], ['객실', '1208']], lines: [{ mn: 'Өглөөний цай орсон', vi: 'Có bữa sáng', en: 'Breakfast included' }] },
    options: [{ id: 'r1208', label: '1208호', hint, then: [{ type: 'line', who: 'senior', hint, text: '네, 1208호 맞아요.' }] }, { id: 'r1280', label: '1280호', hint, then: [{ type: 'line', who: 'senior', hint, text: '한 번 더 볼래요?' }] }] };
  const call = { type: 'line', who: 'guest', channel: 'phone', text: '방이 너무 추워요. 난방이 안 돼요.',
    foreign: { mn: 'Өрөө маш хүйтэн байна. Халаалт ажиллахгүй байна.', vi: 'Phòng lạnh quá. Máy sưởi không chạy.', en: 'The room is very cold. The heating does not work.' } };
  const chat = { type: 'line', who: 'senior', channel: 'chat', hint, text: '시설팀에 보냈어요.' };
  const back = { type: 'relay', direction: 'out', channel: 'phone', id: 'tell-guest', who: 'guest', record: '선배의 답을 손님께 모국어로 전하는 차례', hint,
    meaning: '십 분 안에 직원이 방으로 가서 난방을 봐 드린대요.', prompt: '선배의 답을 손님께 내 나라 말로 전해요.',
    foreign: { mn: 'Арван минутын дотор ажилтан өрөөнд тань очиж халаалтыг шалгана.', vi: 'Trong mười phút nhân viên sẽ đến phòng để kiểm tra máy sưởi.', en: 'A staff member will come to your room within ten minutes to check the heating.' } };
  job.scenes[0].steps.splice(1, 0, tool, call, chat, back);
  assert.deepEqual(validateJob(job).errors, [], 'a line may have no clip, and a guest name or tool cell may be written per language');
  assert.ok(!jobClipIds(job).includes(undefined));

  const session = createWorkdaySession(job);
  let state = session.startScene('arrival');
  state = session.advance();
  assert.equal(state.say.tool.rows[0][1].vi, 'NGUYEN VAN AN');
  state = session.choose('r1208');
  assert.equal(state.line.clip, undefined, 'a colleague can answer on the photograph and caption');
  // A line without a clip counts its hint once, and the next clip-less line is a step of its own.
  session.openHint(); session.openHint();
  state = session.advance();
  assert.equal(state.line.channel, 'phone');
  assert.equal(state.line.foreign.mn, 'Өрөө маш хүйтэн байна. Халаалт ажиллахгүй байна.');
  assert.deepEqual(state.line.names, { mn: 'Батбаяр', vi: 'Nguyễn Văn An', en: 'Batbayar' });
  session.openHint();
  assert.equal(session.snapshot().counts.hints, 2);
  state = session.advance();
  assert.equal(state.line.channel, 'chat');
  state = session.advance();
  assert.equal(state.say.kind, 'relay');
  assert.equal(state.say.direction, 'out');
  assert.equal(state.say.channel, 'phone');
  assert.equal(state.say.meaning, '십 분 안에 직원이 방으로 가서 난방을 봐 드린대요.');
  assert.equal(state.say.example, null, 'the example of an out turn is its foreign text, in the learner\'s language');
  assert.equal(session.canSubmit('voice', '십 분 안에 와요'), false, 'Korean speech is not this turn');
  assert.equal(session.canSubmit('own-text', 'A'), false);
  assert.equal(session.canSubmit('own-text', 'Арван минут'), true, 'any letters');
  assert.equal(session.canSubmit('own-voice'), true, 'said aloud, never transcribed');
  state = session.submitSay({ mode: 'own-voice' });
  for (let guard = 0; guard < 200 && state.phase !== 'scene-end'; guard++) {
    if (state.phase === 'line' || state.phase === 'note') state = session.advance();
    else if (state.phase === 'tour') state = session.finishTour();
    else if (state.phase === 'say') state = session.submitSay({ mode: 'text', text: '네, 알겠습니다.' });
  }
  const data = session.serialize();
  assert.equal(data.says['tell-guest'].produced, 'own-voice');
  const record = buildRecord(job, data, { serial: 'PW-20261130-AAAAAA', date: new Date(2026, 10, 30) });
  assert.deepEqual(record.own, ['선배의 답을 손님께 모국어로 전하는 차례 · 모국어로 말함']);
  const lines = recordLines(record);
  const own = lines.sections.find((section) => section.title.includes('모국어로 전한 것'));
  assert.deepEqual(own.rows, ['선배의 답을 손님께 모국어로 전하는 차례 · 모국어로 말함']);
  const korean = lines.sections.find((section) => section.title.includes('한국어로 한 일'));
  assert.ok(!korean.rows.some((row) => row.includes('모국어')), 'a turn in the learner\'s own language is not Korean');
  assert.equal(record.korean.voice, 0);

  const broken = [
    ['a name without English', (copy) => { delete copy.cast.guest.names.en; }, /names에는 mn, vi, en/],
    ['a tool cell missing a language', (copy) => { delete copy.scenes[0].steps[1].tool.rows[0][1].vi; }, /tool\.rows는/],
    ['a chat line with a film', (copy) => { copy.scenes[0].steps[3].clip = 'senior-chat'; }, /채팅 줄에는 영상이 없어요/],
    ['a line in the guest\'s words without one language', (copy) => { delete copy.scenes[0].steps[2].foreign.vi; }, /foreign에는 mn, vi, en/],
    ['a line in Korean without a hint', (copy) => { delete copy.scenes[0].steps[3].hint; }, /힌트가 없어요/],
    ['an out turn with a Korean example', (copy) => { copy.scenes[0].steps[4].example = '십 분 안에 와요.'; }, /out의 예시는 foreign/],
    ['a turn going sideways', (copy) => { copy.scenes[0].steps[4].direction = 'across'; }, /direction은 in이나 out/],
    ['a relay on a chat channel', (copy) => { copy.scenes[0].steps[4].channel = 'chat'; }, /relay의 channel은 phone/],
  ];
  for (const [name, breakIt, expected] of broken) {
    const copy = structuredClone(job); breakIt(copy);
    const result = validateJob(copy);
    assert.ok(result.errors.some((error) => expected.test(error)), `${name}: ${result.errors.join(' | ')}`);
  }
});

test('a guest who speaks English to every learner is written once in English and recorded as English', () => {
  const hint = { mn: 'туслах', vi: 'gợi ý', en: 'hint' };
  const job = fresh();
  job.cast.tourist = { name: 'Emma Clarke', role: '체크아웃 손님', language: 'en' };
  const asks = { type: 'line', who: 'tourist', text: '짐을 오후 네 시까지 맡길 수 있을까요?', foreign: { en: 'Could you keep my luggage until four?' } };
  const answer = { type: 'relay', direction: 'out', id: 'tell-tourist', who: 'tourist', record: '선배의 답을 손님께 영어로 전하는 차례', hint,
    meaning: '네 시까지 맡아 드리고 번호표를 드린대요.', prompt: '선배의 답을 손님께 영어로 전해요.', foreign: { en: 'We can keep it until four. Here is your tag.' } };
  job.scenes[0].steps.splice(1, 0, asks, answer);
  assert.deepEqual(validateJob(job).errors, [], 'one language is enough for a person who speaks one language');

  const session = createWorkdaySession(job);
  session.startScene('arrival');
  let state = session.advance();
  assert.equal(state.line.language, 'en');
  state = session.advance();
  assert.equal(state.say.foreign.language, 'en');
  state = session.submitSay({ mode: 'own-text', text: 'We keep it until four.' });
  for (let guard = 0; guard < 200 && state.phase !== 'scene-end'; guard++) {
    if (state.phase === 'line' || state.phase === 'note') state = session.advance();
    else if (state.phase === 'tour') state = session.finishTour();
    else if (state.phase === 'say') state = session.submitSay({ mode: 'text', text: '네, 알겠습니다.' });
  }
  const lines = recordLines(buildRecord(job, session.serialize(), { serial: 'PW-20261130-AAAAAA', date: new Date(2026, 10, 30) }));
  const own = lines.sections.find((section) => section.title.includes('모국어나 외국어로 전한 것'));
  assert.deepEqual(own.rows, ['선배의 답을 손님께 영어로 전하는 차례 · 영어로 씀']);

  const broken = [
    ['a language the page cannot name', (copy) => { copy.cast.tourist.language = 'xx'; }, /language는/],
    ['a name per language for a one-language person', (copy) => { copy.cast.tourist.names = { mn: 'a', vi: 'b', en: 'c' }; }, /names를 쓰지 않아요/],
    ['their words missing their language', (copy) => { copy.scenes[0].steps[1].foreign = { mn: 'x' }; }, /foreign에는 en를 모두/],
  ];
  for (const [name, breakIt, expected] of broken) {
    const copy = structuredClone(job); breakIt(copy);
    const result = validateJob(copy);
    assert.ok(result.errors.some((error) => expected.test(error)), `${name}: ${result.errors.join(' | ')}`);
  }
});

test('scene-table holes found in review are closed, and an own-language answer survives a reload', () => {
  const broken = [
    ['a forbidden word allowed on its own', (copy) => { copy.allowedTerms = ['등급']; }, /allowedTerms: 「등급」/],
    ['allowed terms that are not a list of words', (copy) => { copy.allowedTerms = '요양등급'; }, /allowedTerms: 허용하는 낱말은/],
    ['a next link through a backslash', (copy) => { copy.closing.next = { label: '다음', href: '/\\evil.com' }; }, /closing\.next/],
    ['a next link with a hidden scheme', (copy) => { copy.closing.next = { label: '다음', href: 'java\tscript:alert(1)' }; }, /closing\.next/],
    ['an empty note', (copy) => { copy.notes = { ...copy.notes, empty: { title: '빈 글', body: [] } }; }, /notes\.empty: body는 글이 한 줄 이상/],
    ['notes that are not an object', (copy) => { copy.notes = []; }, /notes: 알림 글 목록은/],
    ['a condition item id of the wrong form', (copy) => { copy.closing.conditions.items[0].id = 'Pay Day'; }, /closing\.conditions\.items\[0\]: id는/],
  ];
  for (const [name, breakIt, expected] of broken) {
    const copy = fresh(); breakIt(copy);
    const result = validateJob(copy);
    assert.ok(result.errors.some((error) => expected.test(error)), `${name}: ${result.errors.join(' | ')}`);
  }
  // A report keeps two items whatever was chosen before: a lone conditional item does not count.
  const report = fresh(), step = report.scenes.flatMap((scene) => scene.steps).find((item) => item.type === 'report');
  const key = step.items.find((item) => item.key === true && item.when === undefined);
  const fork = Object.keys(step.items.find((item) => item.when)?.when || {})[0];
  assert.ok(key && fork, 'the care-home report has a key item and a conditional one');
  const option = step.items.find((item) => item.when)?.when[fork];
  step.items = [key, { id: 'extra', text: '더 한 일', hint: key.hint, when: { [fork]: Array.isArray(option) ? option[0] : option } }];
  assert.ok(validateJob(report).errors.some((error) => /늘 보이는 보고할 일이 둘 이상/.test(error)));

  // relay out: an answer in the learner's own language is kept when the page is opened again.
  const job = fresh();
  job.cast.guest = { name: '바트', role: '손님' };
  const hint = { mn: 'туслах', vi: 'gợi ý', en: 'hint' };
  job.scenes[0].steps.splice(1, 0, { type: 'relay', direction: 'out', id: 'tell-guest', who: 'guest', record: '손님께 전하는 차례', hint,
    meaning: '십 분 안에 간대요.', prompt: '손님께 내 나라 말로 전해요.', foreign: { mn: 'Арван минутад ирнэ.', vi: 'Mười phút nữa sẽ đến.', en: 'Someone will come in ten minutes.' } });
  assert.deepEqual(validateJob(job).errors, []);
  const first = createWorkdaySession(job);
  first.startScene('arrival'); first.advance();
  first.submitSay({ mode: 'own-voice' });
  const again = createWorkdaySession(job, { saved: first.serialize() });
  assert.equal(again.serialize().says['tell-guest']?.produced, 'own-voice');
});

test('a tool pick off the mark comes back for another try, and closing items carry hints', () => {
  const hint = { mn: 'туслах', vi: 'gợi ý', en: 'hint' };
  const job = fresh();
  const tool = { type: 'work', id: 'find-room', record: '예약 화면에서 방 번호를 찾는 차례', prompt: '손님의 방 번호를 골라요.', hint,
    tool: { kind: 'screen', title: '예약 조회', rows: [['객실', '1208']] },
    options: [
      { id: 'r1280', label: '1280호', hint, retry: true, then: [{ type: 'line', who: 'senior', hint, text: '객실 칸을 한 번 더 볼래요?' }] },
      { id: 'r1208', label: '1208호', hint, then: [{ type: 'line', who: 'senior', hint, text: '네, 1208호 맞아요.' }] },
    ] };
  job.scenes[0].steps.splice(1, 0, tool);
  job.closing.conditions.items[0].hint = hint;
  job.closing.principles[0].hint = hint;
  job.closing.ladder.items[0].hint = hint;
  job.closing.reflection.decisions[0].hint = hint;
  assert.deepEqual(validateJob(job).errors, []);

  const session = createWorkdaySession(job);
  session.startScene('arrival');
  let state = session.advance();
  assert.equal(state.say.kind, 'work');
  state = session.choose('r1280');
  assert.equal(state.line.text, '객실 칸을 한 번 더 볼래요?');
  state = session.advance();
  assert.equal(state.say.id, 'find-room', 'the same tool comes back');
  assert.deepEqual(state.say.options.map((option) => option.tried), [true, false]);
  assert.equal(session.choose('r1280').say?.id, 'find-room', 'an option already tried cannot be picked again');
  state = session.choose('r1208');
  assert.equal(state.line.text, '네, 1208호 맞아요.');
  assert.equal(session.serialize().forks['find-room'], 'r1208', 'when sees the last pick');
  // A run again starts with every option open.
  session.leave();
  session.startScene('arrival');
  assert.deepEqual(session.advance().say.options.map((option) => option.tried), [false, false]);

  const broken = [
    ['every option a retry', (copy) => { copy.scenes[0].steps[1].options[1].retry = true; }, /retry가 없는 보기/],
    ['retry that is not true or false', (copy) => { copy.scenes[0].steps[1].options[0].retry = 'yes'; }, /retry는 true나 false/],
    ['a closing hint missing a language', (copy) => { delete copy.closing.conditions.items[0].hint.vi; }, /closing\.conditions\.items\[0\].*힌트 언어 vi/],
    ['a ladder hint missing a language', (copy) => { delete copy.closing.ladder.items[0].hint.mn; }, /closing\.ladder\.items.*힌트 언어 mn/],
  ];
  for (const [name, breakIt, expected] of broken) {
    const copy = structuredClone(job); breakIt(copy);
    const result = validateJob(copy);
    assert.ok(result.errors.some((error) => expected.test(error)), `${name}: ${result.errors.join(' | ')}`);
  }
});

test('a tour sets its home as the place, a replay counts only a clip, a retry pick is not a later choice, and the stillness shift is the best one', async () => {
  // A tour whose home is not where the previous step left the stage: the place follows the tour home before its points are drawn.
  const toured = factoryJob(); toured.scenes[0].steps.splice(1, 0, { type: 'move', place: 'line' });
  const touring = createWorkdaySession(toured);
  let state = touring.startScene('gate');
  state = touring.advance();
  assert.equal(state.phase, 'tour');
  assert.equal(state.place, 'gate', 'the tour starts at its home');
  // A move leaves the line behind: at the next place no speaker or words stay on the stage, and nothing is heard again.
  const moved = factoryJob(); moved.scenes[0].steps.splice(1, 1, { type: 'move', place: 'line', caption: '오전 11시, 조립 라인' }, { type: 'say', id: 'ready', prompt: '준비됐다고 말해요.', hint: { en: 'hint' } });
  const walking = createWorkdaySession(moved); walking.startScene('gate');
  state = walking.advance();
  assert.equal(state.phase, 'say');
  assert.equal(state.line, null);
  assert.equal(walking.replay(), null);
  // A line without a clip has nothing to hear again, so it is not counted as a replay.
  const quiet = factoryJob(); delete quiet.scenes[0].steps[0].clip;
  const listening = createWorkdaySession(quiet); listening.startScene('gate');
  assert.equal(listening.replay(), null);
  assert.equal(listening.serialize().counts.replays, 0);
  // A later when that names a retry pick can never match, so the check refuses it.
  const retrying = factoryJob();
  retrying.scenes[0].steps.splice(1, 0, { type: 'work', id: 'check', prompt: '표지를 봐요.', hint: { en: 'hint' }, tool: { kind: 'paper', title: '표지', lines: ['안전모'] }, options: [
    { id: 'off', label: '다른 곳을 본다', hint: { en: 'hint' }, retry: true, then: [] }, { id: 'on', label: '안전모 표지를 본다', hint: { en: 'hint' }, then: [] }] });
  retrying.scenes[0].steps.push({ type: 'note', id: 'late', when: { check: 'off' }, title: '다시 봐요', body: ['다시 봐요.'] });
  assert.ok(validateJob(retrying).errors.some((error) => /check=off/.test(error)), validateJob(retrying).errors.join(' | '));
  // The reviewer's case: the nearer offset lowers the running best first, but the true best is the farther one.
  const { pickShift } = await import('../../../tools/prepare-workday-clips.mjs');
  const line = [-6, -4, -2, 0, 2, 4, 6].map((dx) => ({ dx, dy: 0, value: dx === 0 ? 2.98 : 2.66 + 0.02 * (dx - 4) ** 2 }));
  assert.equal(pickShift(2.98, line), 4);
  assert.equal(pickShift(2.98, [{ dx: 0, dy: 0, value: 2.98 }, { dx: 1, dy: 0, value: 2.9 }]), 0, 'a shift must beat standing still by 0.15');
});

test('a job still being made, or one that fails the check, is not served', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'workday-jobs-'));
  try {
    const jobs = path.join(root, 'workday', 'jobs');
    const put = async (id, job) => { await mkdir(path.join(jobs, id), { recursive: true }); await writeFile(path.join(jobs, id, 'job.json'), JSON.stringify(job)); };
    const broken = fresh(); broken.closing.lead = '오늘 점수는 합격입니다.';
    await put('open-ok', { ...fresh(), id: 'open-ok' });
    await put('making', { ...fresh(), id: 'making' });
    await put('open-broken', { ...broken, id: 'open-broken' });
    await writeFile(path.join(jobs, 'index.json'), JSON.stringify({ jobs: [
      { id: 'open-ok', status: 'open' }, { id: 'making', status: 'making' }, { id: 'open-broken', status: 'open' },
    ] }));
    assert.deepEqual(await workdayJobFiles(root), ['workday/jobs/open-ok/job.json']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a report key may be alternatives under one id, one per option of a fork, and the id decides the report', () => {
  const job = factoryJob();
  const report = job.scenes[1].steps[0];
  report.items = [
    { id: 'jam', key: true, when: { order: 'ask' }, text: '기계가 멈춰서 한 번 더 여쭸습니다.', hint: { en: 'hint' } },
    { id: 'jam', key: true, when: { order: 'nod' }, text: '기계가 멈췄는데 지시는 다 못 알아들었습니다.', hint: { en: 'hint' } },
    { id: 'shift', text: '교대 시간을 지켰습니다.', hint: { en: 'hint' } },
  ];
  assert.deepEqual(validateJob(job).errors, []);
  for (const [order, picked, outcome, clip] of [['ask', ['jam'], 'included', 'lead-thanks'], ['nod', ['shift'], 'omitted', 'lead-jam']]) {
    const session = createWorkdaySession(job);
    playScene(session, 'gate', { order });
    let state = session.startScene('wrap');
    assert.equal(state.say.items.filter((item) => item.id === 'jam').length, 1, 'one alternative is shown');
    for (const id of picked) session.toggleItem(id);
    state = session.submitSay({ mode: 'text', text: '보고합니다.' });
    assert.equal(session.serialize().forks.report, outcome);
    assert.equal(state.line.clip, clip);
  }
  const broken = factoryJob();
  broken.scenes[1].steps[0].items = [
    { id: 'jam', key: true, when: { order: 'ask' }, text: '기계가 멈췄습니다.', hint: { en: 'hint' } },
    { id: 'jam', when: { order: 'nod' }, text: '기계가 멈췄습니다.', hint: { en: 'hint' } },
    { id: 'shift', text: '교대 시간을 지켰습니다.', hint: { en: 'hint' } },
  ];
  assert.ok(validateJob(broken).errors.some((error) => /모두 key/.test(error.message || error)), 'a key group is key throughout');
  const lone = factoryJob();
  lone.scenes[1].steps[0].items[0].when = { order: 'ask' };
  assert.ok(validateJob(lone).errors.some((error) => /늘 보여야/.test(error.message || error)), 'a lone key with a condition can be missing');
});

test('the desk panel cuts by whole letters and the cut row with its mark still fits', () => {
  const graphemes = (value) => Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value), (part) => part.segment);
  const context = { measureText: (value) => ({ width: graphemes(value).length * 10 }) };
  // Vietnamese written with combining marks, and an emoji made of two code units.
  const text = 'Cụ ăn chậm lắm, em chờ cụ nhé 🙂 rồi báo cho chị hướng dẫn.'.normalize('NFD');
  const rows = hudRows(context, text, 120, 2);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => context.measureText(row).width <= 120), rows.join(' | '));
  assert.ok(rows[1].endsWith('…'));
  for (const row of rows) assert.ok(!/^\p{M}/u.test(row), 'no row starts with a lone combining mark');
  assert.ok(text.startsWith(rows[0] + rows[1].slice(0, -1)), 'rows keep the text in order');
  assert.deepEqual(hudRows(context, '짧은 글', 120, 2), ['짧은 글']);
  assert.deepEqual(hudRows(context, '첫 줄\n둘째 줄', 120, 2), ['첫 줄', '둘째 줄']);
});

test('the publish bundle holds only approved workday files, with the page policy written in', async () => {
  const { prepareWorkdayPages, verifyWorkdayPages, references, publicIndex, WORKDAY_OUTPUT } = await import('../../../tools/package-path-workday.mjs');
  // Its own folder: .tmp/path-workday-pages may hold the candidate a job session reviewed and is about to publish.
  const output = await mkdtemp(path.join(tmpdir(), 'workday-pages-'));
  const candidate = await stat(path.join(WORKDAY_OUTPUT, 'workday-pages-manifest.json')).then((info) => info.mtimeMs, () => null);
  try {
    // Only the jobs named for publishing ship; another open job (open for a local test) becomes a card.
    await assert.rejects(prepareWorkdayPages({ output }), /Name the jobs to publish/);
    await assert.rejects(prepareWorkdayPages({ jobs: ['no-such-job'], output }), /Not an open job: no-such-job/);
    const index = { schemaVersion: 1, jobs: [{ id: 'care-home', status: 'open', title: 'A', role: 'B', minutes: 15, poster: 'care-home/x.jpg' }, { id: 'hotel-front', status: 'open', title: 'C', role: 'D', summary: 'E', minutes: 15, poster: 'hotel-front/y.jpg', posterAlt: 'Y' }, { id: 'duty-free', status: 'making', title: 'F', role: 'G', summary: 'H' }] };
    assert.deepEqual(publicIndex(index, new Set(['care-home'])).jobs, [index.jobs[0], { id: 'hotel-front', status: 'making', title: 'C', role: 'D', summary: 'E', poster: 'hotel-front/y.jpg', posterAlt: 'Y' }, index.jobs[2]]);
    assert.deepEqual(references('workday/play.mjs', "import a from './engine/a.mjs'; import('../interview/b.mjs'); new URL('./jobs/index.json', import.meta.url);").sort(), ['interview/b.mjs', 'workday/engine/a.mjs', 'workday/jobs/index.json']);
    assert.deepEqual(references('workday/index.html', '<a href="../">x</a><link href="./workday.css?v=1"><img src="../assets/logo.webp">').sort(), ['./', 'assets/logo.webp', 'workday/workday.css']);
    // Films are outside git (*.mp4). Where the reviewed ones are not on this computer (a new copy, CI), the bundle
    // must refuse rather than ship a page that silently falls back to photographs; the rest is checked where they are.
    const careManifest = JSON.parse(await readFile(path.join(JOBS, 'care-home', 'manifest.json'), 'utf8'));
    const films = careManifest.clips.filter((clip) => clip.reviewed === true).map((clip) => path.join(JOBS, 'care-home', clip.file));
    const present = await Promise.all(films.map((file) => stat(file).then(() => true, () => false)));
    if (present.includes(false)) {
      await assert.rejects(prepareWorkdayPages({ jobs: ['care-home'], output }), /Reviewed film is missing from the bundle/);
      return;
    }
    const built = await prepareWorkdayPages({ jobs: ['care-home'], output });
    assert.deepEqual(built.jobs, ['care-home']);
    assert.ok(built.files >= 20);
    assert.ok(built.outside.includes('interview/film-player.mjs') && built.outside.every((file) => !file.startsWith('workday/')));
    assert.equal(built.directory, output);
    assert.deepEqual(await verifyWorkdayPages({ output }), { files: built.files, outside: built.outside.length, live: false });
    const report = JSON.parse(await readFile(path.join(output, 'workday-pages-manifest.json'), 'utf8'));
    const names = report.files.map((row) => row.file);
    assert.ok(names.includes('workday/index.html') && names.includes('workday/jobs/care-home/job.json') && names.includes('workday/engine/comfort.mjs'));
    assert.ok(names.every((file) => file.startsWith('workday/') && !/production|docs|\.txt$|\.md$/.test(file)));
    // A job still being made ships only its card photograph, never its scene table.
    assert.ok(names.includes('workday/jobs/medical-coordinator/places/desk-senior.jpg') && !names.some((file) => file.startsWith('workday/jobs/medical-coordinator/') && !file.endsWith('/places/desk-senior.jpg')));
    const page = await readFile(path.join(output, 'public/path/workday/play.html'), 'utf8');
    assert.match(page, /<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'self';/);
    assert.match(page, /<meta name="referrer" content="no-referrer">/);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
  assert.equal(await stat(path.join(WORKDAY_OUTPUT, 'workday-pages-manifest.json')).then((info) => info.mtimeMs, () => null), candidate, 'the publish candidate is left as it was');
});
