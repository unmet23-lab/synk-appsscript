// 드라마 말하기 1화를 WORLD 안에서 여는 길(2026-11-02, 설계 experiences/drama/qa/WORLD올리기-20261102/설계.md):
// talk take 응답 → 화면 응답 꼴, 「혼자 해 봄」 규칙, 화면용 강의(world-lesson.json)가 원천 · talk 대사 은행과 같은지, 상황 카드에 답 말이 없는지,
// WORLD 통로(SYNKDramaHost)를 두고 지우는 자리, 공개 빌드가 싣는 것.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { newAttemptState, resetAttempts, beginTake, talkObservation, nextCount, settleTake, TAKE_COUNT_MAX } from '../experiences/drama/pilot/takes.mjs';
import PILOT from '../experiences/drama/pilot/content.mjs';
import { buildWorldLesson, serialize, DESTINATION } from '../tools/build-drama-world.mjs';
import { dramaLines, readEpisodes, linesHash } from '../tools/build-world-speaking-talk.mjs';
import { findIn, HIT } from '../tools/lib/드라마판정.mjs';

const require = createRequire(import.meta.url);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');

test('talk take → 화면 꼴: 노트 · 확실한 통과만 판정, 나머지는 보류 · 안 들림', () => {
  const note = { kind: 'ending', ending: 'plain' };
  assert.deepEqual(talkObservation({ status: 'ok', verdict: 'note', note, sure: true, heard: '헤맸어' }),
    { status: 'ok', transcript: '헤맸어', observation: { kind: 'note', note, sure: false } });
  assert.equal(talkObservation({ status: 'ok', verdict: 'pass', note: null, sure: true, heard: 'x' }).observation.kind, 'pass');
  assert.equal(talkObservation({ status: 'ok', verdict: 'pass', note: null, sure: false, heard: 'x' }).observation.kind, 'pending', '확신 없는 통과');
  assert.equal(talkObservation({ status: 'no_speech', heard: '' }).status, 'no_speech');
  for (const status of ['not_korean', 'too_fast', 'unclear']) assert.equal(talkObservation({ status, heard: 'hi' }).status, 'unclear', status);
  assert.equal(talkObservation(null).status, 'unclear');
});

test('talk에 알리는 앞 테이크 수는 0~20 안이다(talk readTake는 넘으면 400)', () => {
  let c = { judged: 0, unheard: 0 };
  for (let i = 0; i < 30; i++) c = nextCount(c, { status: 'ok', transcript: 'x' });
  assert.deepEqual(c, { judged: TAKE_COUNT_MAX, unheard: 0 });
  for (let i = 0; i < 30; i++) c = nextCount(c, { status: 'no_speech', transcript: '' });
  assert.deepEqual(c, { judged: TAKE_COUNT_MAX, unheard: TAKE_COUNT_MAX });
});

test('혼자 해 봄: 검수 통과 새 상황 · 모범 전 · 첫 판정만, 다시 시작해도 되살아나지 않는다', () => {
  const pass = talkObservation({ status: 'ok', verdict: 'pass', sure: true, heard: '선생님, 혹시 복사실이 어디에 있는지 아세요?' });
  const pending = talkObservation({ status: 'ok', verdict: 'pass', sure: false, heard: '복사실' });
  const go = (state, out, { phase = 'transfer', reviewed = true } = {}) => settleTake(state, { phase, out, reviewed, turn: beginTake(state, { lineId: 's1e01-t9', phase, requestId: 'r' }) }).trail;
  let st = newAttemptState();
  assert.deepEqual(go(st, pass), { correct: true, assessable: true });
  assert.deepEqual(go(st, pass), { correct: true, assessable: false }, '두 번째 판정');
  resetAttempts(st);
  assert.deepEqual(go(st, pass), { correct: true, assessable: false }, '판정 뒤 다시 시작');
  st = newAttemptState(); st.transferRevealed = true;
  assert.deepEqual(go(st, pass), { correct: true, assessable: false }, '모범을 본 뒤');
  st = newAttemptState();
  assert.deepEqual(go(st, pass, { reviewed: false }), { correct: true, assessable: false }, '검수 전 명세');
  st = newAttemptState();
  assert.deepEqual(go(st, pass, { phase: 'scene' }), { correct: true, assessable: false }, '장면 대사');
  st = newAttemptState();
  assert.deepEqual(go(st, pending), { correct: null, assessable: false }, '판정 보류');
  assert.deepEqual(go(st, talkObservation({ status: 'no_speech', heard: '' })), { correct: null, assessable: false, reason: 'unanswered' });
});

test('기록기: 혼자 해 봄은 그 차례의 첫 시도만(Trail은 앞 시도가 있으면 반복으로 본다)', () => {
  const Drama = require('../experiences/drama/pilot/learning-entry.cjs');
  const calls = [];
  const coach = { present: () => 'p1', help() {}, answer: (pid, r) => { calls.push(r); return { eventId: `e${calls.length}` }; }, exclude() {}, flush() {} };
  const recorder = Drama.createRecorder({ owner: { createGame: () => coach } });
  const turn = recorder.open({ lineId: 's1e01-t9', skillId: 'ko.speaking.ask', phase: 'transfer' });
  turn.take({ kind: 'unheard' });
  turn.take({ kind: 'result', data: { trail: { correct: true, assessable: true } } });
  assert.equal(calls[0].attemptNo, 1); assert.equal(calls[0].reason, 'unanswered');
  assert.deepEqual([calls[1].attemptNo, calls[1].assessable], [2, false]);
});

test('화면용 강의는 원천에서 다시 만든 것과 같고, 지문 · 녹음 상한이 talk 대사 은행과 같다', async () => {
  const built = await buildWorldLesson();
  assert.equal(fs.readFileSync(DESTINATION, 'utf8').replace(/\r\n/g, '\n'), serialize(built), 'node tools/build-drama-world.mjs');
  // 강의 지문은 원천 대사 은행(talk world-drama-lines를 만드는 같은 셈)과 같다. 운영 talk가 이 지문과 다르면 WORLD 화면은 받아쓰기를 켜지 않는다(스스로 확인) —
  // 11-03: 새 상황 t4 → t9. 운영 talk 대사 은행을 t9가 든 판(1b1afc801764882a)으로 배포한 뒤 이 강의를 공개한다 — 순서가 거꾸로면 받아쓰기가 꺼진다.
  assert.equal(built.linesVersion, linesHash(dramaLines(await readEpisodes())));
  const lines = new Map(dramaLines(await readEpisodes()).map((l) => [l.id, l]));
  for (const item of built.lesson.scene.filter((x) => x.type === 'student')) {
    assert.equal(item.answerSec, lines.get(item.id).answerSec, item.id); assert.equal(item.reviewed, true, item.id);
  }
  assert.equal(built.lesson.transfer.id, 's1e01-t9'); assert.equal(built.lesson.transfer.reviewed, true);
  assert.equal(lines.get('s1e01-t9').kind, 'unseen');
  // 판정 명세 · 정답 낱말 목록은 싣지 않는다. 새 상황 모범 글은 reveal 칸에만.
  const text = JSON.stringify(built.lesson);
  assert.doesNotMatch(text, /"(?:spec|keys|alts|variants)"/);
  assert.ok(!text.includes(PILOT.transfer.text));
  assert.equal(built.reveal.text, PILOT.transfer.text);
  assert.doesNotMatch(JSON.stringify(built), /"\/media\//, '미디어는 상대 주소');
});

test('상황 카드(한 · 영)에 새 상황의 핵심 말 · 허용 표현이 없다(기획 §3-5 B)', () => {
  const words = PILOT.transfer.spec.keys.flatMap((k) => [k.word, ...(k.alts || [])]);
  for (const card of [PILOT.transfer.prompt, PILOT.transfer.promptKo])
    for (const w of words) assert.ok(findIn(w, card) < HIT, `「${w}」가 카드에 있다: ${card}`);
});

test('WORLD 통로: 드라마 틀에만 마이크 · 통로를 두고, 패널을 닫거나 실패하면 지운다', () => {
  const shell = read('experiences/synk-world-app/app-shell.mjs');
  assert.match(shell, /drama:\{get title\(\)\{[^}]+\},path:'drama\/',microphone:true\}/);
  assert.match(shell, /allow="autoplay; fullscreen\$\{game\.microphone\?'; microphone':''\}"/);
  assert.match(shell, /dramaHost=id==='drama'\?mountDramaHost\(\):null;\n show\(game\.title/, '틀보다 먼저 둔다');
  assert.equal((shell.match(/dramaHost\?\.dispose\(\)/g) || []).length, 2, '패널 닫기 · 실패 둘 다');
  assert.match(shell, /function mountDramaHost\(\)\{\n if\(!operating\|\|!account\?\.supportsSpeaking\|\|!client\.snapshot\)return null;/);
  assert.match(shell, /payload\.action!=='take'/, '통로로는 take만');
  // 로그인은 전체 페이지 이동이라 바로가기를 이 탭에 남기고, 로그인한 상태로 들어왔을 때 비우며 연다.
  assert.match(shell, /get\('drama'\)==='1'\)sessionStorage\.setItem\(DRAMA_PENDING/);
  assert.ok(shell.includes("else if(dramaRequested){if(client.snapshot)try{sessionStorage.removeItem(DRAMA_PENDING);}catch{}void launchGame('drama');}"));
});

test('화면: WORLD 통로는 같은 출처 부모에서만 찾고, 받아쓰기 끄기는 판 바뀜(409)에만', () => {
  const js = read('experiences/drama/pilot/pilot.mjs');
  assert.match(js, /window\.parent\.location\.origin === location\.origin\) return window\.parent\.SYNKDramaHost/);
  assert.match(js, /error\?\.status === 409 && \['ITEM_CHANGED', 'ITEM_NOT_OPEN'\]\.includes\(error\.code\)/);
  assert.match(js, /consent: 'send-once'/);
  assert.match(js, /lines_version: W\.lesson\.linesVersion/);
  const html = read('experiences/drama/pilot/index.html');
  assert.match(html, /http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self';/);
  assert.doesNotMatch(html, /(?:src|href)="\//, '상대 주소만');
});

test('공개 빌드: drama/에 화면 · 강의 · 기록 묶음 · 재생 사본만 싣고 content.mjs · manifest는 싣지 않는다', () => {
  const build = read('tools/build-world-app-public.mjs');
  const list = build.match(/for\(const name of \['pilot\.css'[^\]]*\]\)copyFile\(path\.join\(dramaRoot,name\),'drama\/'\+name\)/)?.[0] + build.match(/write\('drama\/pilot\.mjs'[^;]*;/)?.[0] + build.match(/for\(const name of \['strings\.mjs','takes\.mjs','orbloom\.mjs'\]\)/)?.[0];
  assert.ok(list, '드라마 파일 목록');
  for (const name of ['drama/pilot.mjs', 'strings.mjs', 'takes.mjs', 'orbloom.mjs', 'atlas-learning.js', 'world-lesson.json']) assert.ok(list.includes(`'${name}'`), name);
  assert.ok(!list.includes('content.mjs') && !list.includes('manifest.json'));
  assert.match(build, /sha\(fs\.readFileSync\(source\)\)!==item\.sha256\)throw Error\('Drama media differs/);
  assert.match(build, /data-drama="world"/);
  assert.ok(build.includes('${name}?v=${tokens[name]}') && build.includes("'./${name}?v=${dramaToken(name)}'"), '공개본 드라마 문서 · 하위 모듈에 캐시 토큰');
});

test('강의 생성 도구 --check가 통과한다', () => {
  const r = spawnSync(process.execPath, ['tools/build-drama-world.mjs', '--check'], { cwd: REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

// C(설계 §17): 실제 Atlas 게임 + 메모리 저장소 + 시계를 밀어, t9 판정 뒤 d7 창(7~10일)에만 처음 보는 t6이 차례가 된다.
function delayedRig({ storage = true } = {}) {
  const Drama = require('../experiences/drama/pilot/learning-entry.cjs');
  const box = { now: Date.parse('2026-11-03T10:00:00Z') };
  const m = new Map();
  const mem = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const owner = { createGame: (meta, factory) => factory({ gameId: meta.gameId, clock: () => new Date(box.now).toISOString(), ...(storage ? { storage: mem } : {}) }) };
  return { box, recorder: Drama.createRecorder({ owner }), at: (days) => { box.now = Date.parse('2026-11-03T10:02:00Z') + days * 86400000; } };
}
const T6 = { lineId: 's1e01-t6', skillId: PILOT.delayed.skill };

test('C: t9 첫 판정 뒤 7~10일 창에서만 t6이 차례, 보인 뒤 · 창 밖 · 판정 없는 시도 · 저장 실패면 아니다', () => {
  assert.equal(PILOT.delayed.skill, PILOT.transfer.skill, '같은 능력이어야 같은 측정 칸');
  const r = delayedRig();
  const t9 = r.recorder.open({ lineId: PILOT.transfer.id, skillId: PILOT.transfer.skill, phase: 'transfer' });
  r.box.now += 60000; t9.take({ kind: 'result', data: { trail: { correct: false, assessable: true } } });
  for (const [days, want] of [[0.5, false], [6.9, false], [7.5, true], [9.9, true], [10.5, false]]) { r.at(days); assert.equal(r.recorder.delayedDue(T6), want, `${days}일`); }
  r.at(7.5);
  assert.equal(r.recorder.delayedDue({ lineId: 's1e01-t9', skillId: T6.skillId }), false, '이미 본 문항');
  const c = r.recorder.open({ ...T6, phase: 'transfer' });
  assert.equal(r.recorder.delayedDue(T6), false, '보인 뒤에는 다시 내지 않는다');
  r.box.now += 60000; c.take({ kind: 'result', data: { trail: { correct: true, assessable: true } } });
  assert.equal(r.recorder.delayedDue(T6), false);

  const off = delayedRig();
  off.recorder.open({ lineId: PILOT.transfer.id, skillId: PILOT.transfer.skill, phase: 'transfer' }).take({ kind: 'down' });
  off.at(7.5); assert.equal(off.recorder.delayedDue(T6), false, '받아쓰기 없는 연습 시도는 기준이 아니다');

  const bare = delayedRig({ storage: false });
  bare.recorder.open({ lineId: PILOT.transfer.id, skillId: PILOT.transfer.skill, phase: 'transfer' }).take({ kind: 'result', data: { trail: { correct: true, assessable: true } } });
  bare.at(7.5); assert.equal(bare.recorder.delayedDue(T6), null, '기록이 덜 모이면 모름(내보내지 않음)');
});

test('C: 상황 카드(한 · 영)에 t6 핵심 말 · 허용 표현이 없고, 강의에 같은 능력 · talk 은행 녹음 상한으로 실린다', async () => {
  const words = PILOT.delayed.spec.keys.flatMap((k) => [k.word, ...(k.alts || [])]);
  for (const card of [PILOT.delayed.prompt, PILOT.delayed.promptKo]) for (const w of words) assert.ok(findIn(w, card) < HIT, `「${w}」가 카드에 있다: ${card}`);
  const built = await buildWorldLesson();
  const line = dramaLines(await readEpisodes()).find((l) => l.id === 's1e01-t6');
  assert.deepEqual([built.lesson.delayed.id, built.lesson.delayed.reviewed, built.lesson.delayed.answerSec, line.kind], ['s1e01-t6', true, line.answerSec, 'unseen']);
  assert.ok(!JSON.stringify(built.lesson).includes(PILOT.delayed.text), '모범 글은 delayedReveal에만');
  assert.equal(built.delayedReveal.text, PILOT.delayed.text);
});

test('C는 판정된 첫 테이크에만 기록된다(lazy) — 받아쓰기 꺼짐 · 서버 사정 · 안 들림 · 보류는 t6을 쓰지 않고, 판정되면 d7 관측(설계 검토 P1)', () => {
  const r = delayedRig();
  r.recorder.open({ lineId: PILOT.transfer.id, skillId: PILOT.transfer.skill, phase: 'transfer' }).take({ kind: 'result', data: { trail: { correct: true, assessable: true } } });
  r.at(7.5);
  const c = r.recorder.open({ ...T6, phase: 'transfer', lazy: true });
  c.help('text'); c.help('text'); // 모범이 아닌 도움은 모아 두었다가 보일 때 남긴다
  for (const outcome of [{ kind: 'off' }, { kind: 'down' }, { kind: 'unheard' }, { kind: 'result', data: { trail: { correct: null, assessable: false } } }]) assert.equal(c.take(outcome), null);
  assert.equal(c.recorded, false);
  assert.equal(r.recorder.delayedDue(T6), true, '연습 시도만 있으면 카드가 남는다');
  r.box.now += 60000;
  const rec = c.take({ kind: 'result', data: { trail: { correct: true, assessable: false } } });
  assert.equal(rec.attemptNo, 1); assert.equal(c.recorded, true);
  assert.equal(r.recorder.delayedDue(T6), false);

  // 모범을 보면 판정 테이크 전이라도 그 자리에서 보임 · 도움을 남겨 t6을 쓴다(정답을 본 뒤 다른 날 「혼자 해 봄」으로 잡히지 않게, 아르곤 A2).
  const h = delayedRig();
  h.recorder.open({ lineId: PILOT.transfer.id, skillId: PILOT.transfer.skill, phase: 'transfer' }).take({ kind: 'result', data: { trail: { correct: true, assessable: true } } });
  h.at(7.5);
  const hc = h.recorder.open({ ...T6, phase: 'transfer', lazy: true });
  hc.help('answer');
  assert.equal(hc.recorded, true);
  assert.equal(h.recorder.delayedDue(T6), false);
});

test('C 상황 카드(한 · 영)에 모범 글의 어느 문장도 없다', () => {
  const sentences = PILOT.delayed.text.split(/(?<=[.?!])\s*/).map((x) => x.replace(/[.?!]$/, '').trim()).filter(Boolean);
  for (const card of [PILOT.delayed.prompt, PILOT.delayed.promptKo]) for (const line of sentences) assert.ok(findIn(line, card) < HIT, `「${line}」가 카드에 있다: ${card}`);
});
