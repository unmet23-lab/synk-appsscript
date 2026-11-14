// 「오늘」 한 장(깃발 ?today=1, 2026-11-14) — 계약 · 사실에서만 짓기 · 깃발 없으면 그대로.
// 기록은 실제 기록기(pilot/learning-entry.cjs createRecorder · 입장 검사 묶음 엔진)로 심는다(qa/오늘한장-20261114/심기.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { world, read, doToday } from '../experiences/drama/qa/오늘한장-20261114/뽑기.mjs';
import { buildToday, buildAfter, readTurns, TAEO_LINES, dayKey, dayStart } from '../experiences/drama/pilot/today/plan.mjs';
import { POOL, AGAIN_PAIR, NEW_ORDER, YO_LINES, TAEO_CALL } from '../experiences/drama/pilot/today/content.mjs';
import { STR } from '../experiences/drama/pilot/strings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lesson = JSON.parse(fs.readFileSync(path.join(ROOT, 'experiences/drama/pilot/world-lesson.json'), 'utf8')).lesson;
// 오늘 학습일 아침 9시(기기 시각) — 심는 기록은 이보다 앞서고, 엔진 시계(지금)보다도 앞선다. 학습일이 막 바뀐 때(새벽 4시 뒤 40분 안)면
// 그 앞 학습일 끝으로 물러난다(끝 화면 시험은 31분 전에 누른 것으로 짓는다 — 둘이 한 학습일에 들게).
const morning = () => { const now = Date.now(), s = dayStart(now); return now - s < 40 * 60000 ? s - 60000 : Math.min(s + 5 * 3600000, now - 60000); };
// 화면에 나가는 글에는 촬영장 말이 없다(설계 세션 11-14 — 스토리형 앱, 처음 보는 사람이 못 알아듣는다).
const STUDIO = /테이크|통과|노트/;
function visible(today, after = null) {
 const out = [today.line?.text, today.empty?.text, ...today.items.flatMap((x) => [x.title, x.why.text, x.why.next])];
 if (after) out.push(...after.changed.flatMap((c) => [c.what, c.before, c.after]), ...after.tomorrow.flatMap((x) => [x.title, x.when]));
 return out.filter(Boolean);
}

function contract(today) {
 assert.equal(today.speaker, 'taeo');
 assert.ok(Array.isArray(today.items) && today.items.length <= 3);
 assert.equal(today.minutes, today.items.reduce((s, x) => s + x.minutes, 0));
 for (const it of today.items) {
  assert.ok(['again', 'new', 'check'].includes(it.kind));
  assert.ok(it.title && it.why?.code && it.why.text && it.why.evidence && typeof it.why.evidence === 'object');
  assert.ok(it.open?.type);
 }
 const order = today.items.map((x) => x.kind);
 assert.deepEqual(order, [...order].sort((a, b) => ['again', 'new', 'check'].indexOf(a) - ['again', 'new', 'check'].indexOf(b)));
 if (today.items.length) { assert.ok(TAEO_LINES[today.line.code]); assert.equal(today.line.text, TAEO_LINES[today.line.code]); assert.equal(today.empty, null); }
}

test('기록 A(어제 6번 줄 끝맺음 노트 · B 안 함 · 입장 검사 세부 두 번 놓침) → 세 줄, 문장은 기록과 입장 검사 문장 그대로', async () => {
 const w = await world({ scenario: 'A', now: morning() });
 const r = await read(w, lesson);
 contract(r.today);
 const [again, fresh, check] = r.today.items;
 // 태오는 그 장면의 일을 되부른다 — 6번 줄은 '요' 줄이라 끝맺음이면 「끝에 '요'까지요」가 붙는다.
 assert.equal(r.today.line.code, 'again.call.s1e01-6.yo');
 assert.equal(r.today.line.text, "길 잃어서 헤맸다고 했죠? 오늘은 요즘 지내는 얘기를 해 봐요. 이번엔 끝에 '요'까지 붙여서요.");
 assert.equal(r.today.line.media, null);
 assert.equal(again.kind, 'again');
 assert.deepEqual(again.open, { type: 'situation', lineId: AGAIN_PAIR['s1e01-6'] });
 assert.equal(again.why.code, 'again.ending.yo.fixed');
 assert.equal(again.why.evidence.lineId, 's1e01-6');
 assert.equal(again.why.evidence.notes, 3);
 assert.equal(again.why.evidence.coached, true);
 assert.equal(again.why.text, '어제 「한참 헤맸어요」라고 할 때 끝이 반말처럼 들렸어요. 그 자리에서는 다시 해서 고쳤어요. 대사를 안 보고도 되는지 오늘 다른 상황에서 확인해요.');
 for (const t of visible(r.today)) assert.ok(!STUDIO.test(t), t);
 // 근거 시각이 실제 기록의 마지막 노트 시도와 같다.
 const turns = readTurns(r.events).filter((t) => t.lineId === 's1e01-6' && t.phase === 'scene');
 assert.equal(Date.parse(again.why.evidence.at), turns.at(-1).attempts.at(-1).at);
 assert.equal(fresh.why.code, 'new.transfer');
 assert.deepEqual(fresh.open, { type: 'situation', lineId: 's1e01-t9', source: 'transfer' });
 const { RETURN_PATTERNS } = await import('../experiences/entry-check/learning.mjs');
 assert.equal(check.why.code, 'check.entry.detail');
 assert.equal(check.why.text, RETURN_PATTERNS.detail.why);
 assert.equal(check.why.next, RETURN_PATTERNS.detail.next);
 assert.equal(check.open.game, 'entry');
 assert.equal(check.why.evidence.misses, 2);
});

test('기록 B(8일 전 장면 · B 혼자 해냄) → 새 대사 + C, 기록 F(오늘이 첫날) → 「오늘」 없음', async () => {
 const b = await read(await world({ scenario: 'B', now: morning() }), lesson);
 contract(b.today);
 assert.equal(b.delayedDue, true);
 assert.deepEqual(b.today.items.map((x) => x.why.code), ['new.pool.like', 'check.delayed']);
 // 「오늘 공부」는 한국어 상황 글만으로 서는 줄(t7 · t3)이 앞이다.
 assert.deepEqual(NEW_ORDER.slice(0, 2), ['s1e01-t7', 's1e01-t3']);
 assert.equal(b.today.items[0].open.lineId, NEW_ORDER[0]);
 assert.equal(b.today.line.code, 'new.situation');
 for (const t of visible(b.today)) assert.ok(!STUDIO.test(t), t);
 assert.equal(b.today.items[1].why.text, STR.ko.delayedLead);
 assert.equal(b.today.items[1].why.evidence.days, 8);
 const f = await read(await world({ scenario: 'F', now: morning() }), lesson);
 assert.equal(f.today.firstDay, true);
 assert.equal(f.today.items.length, 0);
});

test('근거가 없으면 줄을 내지 않는다 — 기록 없음 · 다른 게임 기록뿐 · 뺀 시도', () => {
 assert.equal(buildToday({ events: [], lesson }).firstDay, true);
 const now = Date.parse('2026-11-15T09:00:00+09:00');
 const at = (h) => new Date(Date.parse('2026-11-14T00:00:00+09:00') + h * 3600000).toISOString();
 const ev = (type, id, extra) => ({ type, id, at: at(21), ...extra });
 const base = [
  ev('decision.made', 'd1', { experienceId: 'drama-s1' }),
  ev('practice.presented', 'p1', { decisionId: 'd1', taskId: 'drama-s1.scene.s1e01-6', itemKey: 's1e01-6' }),
  ev('practice.attempted', 'a1', { presentationId: 'p1', attemptNo: 1, verdict: 'unassessed', choice: { selectedId: 'note-ending', correctId: 'pass' } }),
 ];
 const t1 = buildToday({ events: base, lesson, now, tzOffsetMin: 540 });
 assert.equal(t1.items[0].why.code, 'again.ending.yo');
 // 그 시도를 「제가 한 말과 달라요」로 뺐으면 노트가 없다 → 복습 줄이 없다.
 const t2 = buildToday({ events: [...base, ev('record.excluded', 'x1', { targetId: 'a1' })], lesson, now, tzOffsetMin: 540 });
 assert.ok(!t2.items.some((x) => x.kind === 'again'));
 // 다른 게임(입장 검사)의 기록만으로는 드라마 줄을 짓지 않는다.
 const other = base.map((e) => (e.type === 'decision.made' ? { ...e, experienceId: 'entry-check' } : e));
 assert.equal(buildToday({ events: other, lesson, now, tzOffsetMin: 540 }).firstDay, true);
 // 시간 낱말: 이틀 전이면 「지난번」. 태오 한 줄은 시간 낱말 없이 장면을 되부른다.
 const t3 = buildToday({ events: base, lesson, now: now + 86400000, tzOffsetMin: 540 });
 assert.equal(t3.line.code, 'again.call.s1e01-6.yo');
 assert.match(t3.items[0].why.text, /^지난번 /);
 assert.equal(dayKey(now, 540), '2026-11-15');
});

// 손으로 짓는 사건 목록(서울 시각) — 차례마다 보임 하나, 시도는 판정 갈래로.
function events(spec) {
 const out = [{ type: 'decision.made', id: 'd1', experienceId: 'drama-s1', at: spec[0].at }];
 spec.forEach((x, i) => {
  out.push({ type: 'practice.presented', id: `p${i}`, decisionId: 'd1', taskId: `drama-s1.${x.phase}.${x.line}`, itemKey: x.line, at: x.at });
  (x.tries || []).forEach((c, j) => out.push({ type: 'practice.attempted', id: `a${i}.${j}`, presentationId: `p${i}`, attemptNo: j + 1, verdict: 'unassessed', choice: { selectedId: c, correctId: 'pass' }, at: new Date(Date.parse(x.at) + (j + 1) * 1000).toISOString() }));
 });
 return out;
}
const kst = (s) => new Date(Date.parse(`${s}+09:00`)).toISOString();

test('학습일은 새벽 4시에 바뀐다 — 밤 1시 반 기록은 3시엔 「오늘」, 4시 반엔 「어제」', () => {
 const ev = events([{ phase: 'scene', line: 's1e01-6', at: kst('2026-11-15T01:30:00'), tries: ['note-ending'] }]);
 assert.equal(dayKey(Date.parse(kst('2026-11-15T03:59:00')), 540), '2026-11-14');
 assert.equal(dayKey(Date.parse(kst('2026-11-15T04:00:00')), 540), '2026-11-15');
 assert.equal(buildToday({ events: ev, lesson, now: Date.parse(kst('2026-11-15T03:00:00')), tzOffsetMin: 540 }).firstDay, true);
 const t = buildToday({ events: ev, lesson, now: Date.parse(kst('2026-11-15T04:30:00')), tzOffsetMin: 540 });
 assert.equal(t.firstDay, false);
 assert.match(t.items[0].why.text, /^어제 /);
});

test('「했어요」는 말한 기록으로만 센다 — 카드만 열고 나간 줄은 한 것이 아니다', () => {
 const now = Date.parse(kst('2026-11-15T09:00:00'));
 // 6번 줄만 말하고 7번 줄은 열기만 했다 → 「3줄 가운데 1줄까지」.
 const one = buildToday({ events: events([
  { phase: 'scene', line: 's1e01-6', at: kst('2026-11-14T21:00:00'), tries: ['pass'] },
  { phase: 'scene', line: 's1e01-7', at: kst('2026-11-14T21:02:00') },
 ]), lesson, now, tzOffsetMin: 540 });
 const scene = one.items.find((x) => x.open.type === 'scene');
 assert.equal(scene.why.code, 'new.scene');
 assert.equal(scene.why.text, '어제 1화에서 내 대사 3개 중 1개까지 했어요.');
 assert.deepEqual(scene.why.evidence.spoken, ['s1e01-6']);
 assert.equal(one.line.code, 'new.scene');
 // 아무 줄도 말하지 않고 열기만 했다 → 「열었어요」(한 줄 수를 말하지 않는다).
 const none = buildToday({ events: events([{ phase: 'scene', line: 's1e01-6', at: kst('2026-11-14T21:00:00') }]), lesson, now, tzOffsetMin: 540 });
 assert.equal(none.items[0].why.code, 'new.scene.opened');
 assert.equal(none.items[0].why.text, '어제 1화를 열어 보기만 했어요.');
 // 장면 줄 셋을 다 말했고 B는 열기만 했다 → B는 아직 안 한 것(다시 권한다).
 const allSaid = [
  { phase: 'scene', line: 's1e01-6', at: kst('2026-11-14T21:00:00'), tries: ['pass'] },
  { phase: 'scene', line: 's1e01-7', at: kst('2026-11-14T21:01:00'), tries: ['pass'] },
  { phase: 'scene', line: 's1e01-8', at: kst('2026-11-14T21:02:00'), tries: ['pass'] },
 ];
 const b = buildToday({ events: events([...allSaid, { phase: 'transfer', line: 's1e01-t9', at: kst('2026-11-14T21:05:00') }]), lesson, now, tzOffsetMin: 540 });
 assert.equal(b.items[0].why.code, 'new.transfer');
 assert.equal(b.line.code, 'new.situation');
});

test('같은 날 같은 말하기가 둘 서지 않는다 — 7번(묻기)이 복습이면 오늘 공부는 묻기가 아닌 줄', () => {
 const now = Date.parse(kst('2026-11-15T09:00:00'));
 const t = buildToday({ events: events([
  { phase: 'scene', line: 's1e01-6', at: kst('2026-11-14T21:00:00'), tries: ['pass'] },
  { phase: 'scene', line: 's1e01-7', at: kst('2026-11-14T21:01:00'), tries: ['note-missing'] },
  { phase: 'scene', line: 's1e01-8', at: kst('2026-11-14T21:02:00'), tries: ['pass'] },
 ]), lesson, now, tzOffsetMin: 540 });
 const [again, fresh] = t.items;
 assert.equal(again.open.lineId, AGAIN_PAIR['s1e01-7']);
 assert.equal(again.why.text, '어제 「어디에 있는지 아세요」라고 할 때 꼭 들어가야 할 말이 하나 빠졌어요.');
 // 끝맺음이 아니면 「'요'」 변형이 붙지 않는다.
 assert.equal(t.line.code, 'again.call.s1e01-7');
 const ask = lesson.scene.find((x) => x.id === 's1e01-7').skill;
 assert.notEqual(fresh.open.lineId, lesson.transfer.id);
 assert.notEqual(POOL.find((x) => x.id === fresh.open.lineId)?.skill, ask);
 for (const x of visible(t)) assert.ok(!STUDIO.test(x), x);
});

test("「'요'」 말은 내용 표에서 '요' 줄로 적은 줄에만 — 그 밖의 줄은 일반 문장", () => {
 const now = Date.parse(kst('2026-11-15T09:00:00'));
 const extra = { id: 's1e01-x', type: 'student', skill: 'ko.speaking.explain', text: '저는 몽골에서 왔습니다.' };
 assert.ok(!YO_LINES.includes(extra.id));
 const L = { ...lesson, scene: [...lesson.scene, extra] };
 const t = buildToday({ events: events([{ phase: 'scene', line: extra.id, at: kst('2026-11-14T21:00:00'), tries: ['note-ending'] }]), lesson: L, now, tzOffsetMin: 540 });
 const again = t.items.find((x) => x.kind === 'again');
 assert.equal(again.why.code, 'again.ending');
 assert.match(again.why.text, /라고 할 때 끝맺음이 대사와 다르게 들렸어요\.$/);
 assert.ok(!/'요'|반말/.test(again.why.text));
 assert.equal(t.line.code, 'again.retake');
 assert.ok(!/'요'/.test(t.line.text));
});

test('끝 화면: 오늘 해낸 것만 전후로, 내일은 같은 규칙을 내일 날짜로 돌린 결과', async () => {
 const startAt = morning() - 31 * 60000;
 const w = await world({ scenario: 'A', now: startAt });
 w.lesson = lesson;
 const r = await read(w, lesson);
 w.now = morning();
 const done = await doToday(w, r.today, { minutesAgo: 30 });
 const again = await read(w, lesson);
 const after = buildAfter({ events: again.events, lesson, start: r.today, startAt: done.startAt, now: w.now, entryAfter: again.entry, entryTarget: done.entryTarget, strings: STR.ko });
 assert.deepEqual(after.changed.map((c) => c.what), ["끝에 '요' 붙이기", '같은 과 다른 선배에게 길 묻기', '표와 짐의 세부 내용 확인']);
 assert.equal(after.changed[0].before, '어제는 「한참 헤맸어요」의 끝이 반말처럼 들렸어요');
 // 입장 검사 전 글은 근거 그대로(그 놓침이 한 근무 안이라는 근거는 없다).
 const entry = r.today.items.find((x) => x.open.type === 'game').why.evidence;
 assert.equal(after.changed[2].before, `최근 ${entry.seen}번 중 ${entry.misses}번 놓쳤어요`);
 for (const t of visible(r.today, after)) assert.ok(!STUDIO.test(t), t);
 const next = buildToday({ events: again.events, lesson, now: w.now + 86400000, entry: again.entry, strings: STR.ko });
 assert.deepEqual(after.tomorrow.filter((x) => x.when === '내일').map((x) => x.title), next.items.map((x) => x.title));
 assert.ok(after.tomorrow.some((x) => x.when === '며칠 뒤'));
 // 나중 확인 날짜는 바뀌는 중이라 숫자로 적지 않는다(「7일」과 「3일」이 같이 보이지 않게).
 for (const t of visible(r.today, after)) assert.ok(!/7일|7~10일/.test(t), t);
 // 오늘 할 것을 다 했으면 같은 날 다시 열어도 그 줄은 다시 나오지 않는다.
 const reopen = buildToday({ events: again.events, lesson, now: w.now, entry: again.entry, strings: STR.ko });
 assert.ok(!reopen.items.some((x) => r.today.items.some((y) => y.open.lineId && y.open.lineId === x.open.lineId)));
 assert.ok(!reopen.items.some((x) => x.open.type === 'game'));
});

test('태오가 떠올리는 말은 그 줄이 여는 짝 상황에 맞춰 썼고, 짝 상황의 답 낱말이 없고, 말하는 길이가 6초 안이다', async () => {
 const { dramaLines, readEpisodes } = await import('../tools/build-world-speaking-talk.mjs');
 const lines = new Map(dramaLines(await readEpisodes()).map((l) => [l.id, l]));
 for (const [id, call] of Object.entries(TAEO_CALL)) {
  assert.equal(call.pair, AGAIN_PAIR[id], `${id}: 짝이 바뀌었다 — 태오 문장도 새 짝에 맞춰 고친다`);
  const words = (lines.get(call.pair)?.spec?.keys || []).flatMap((k) => [k.word, ...(k.alts || [])]).filter((w) => w && w.length >= 2);
  for (const w of words) assert.ok(!call.text.includes(w), `${id}: 짝 상황의 답 낱말 「${w}」가 태오 말에 있다`);
  // 한국어 대화 빠르기 초당 6음절 안팎으로 어림 — 「이번엔 끝에 '요'까지 붙여서요.」를 붙여도 6초 안.
  const syl = (`${call.text} 이번엔 끝에 요까지 붙여서요.`.match(/[가-힣]/g) || []).length;
  assert.ok(syl / 6 <= 6, `${id}: ${syl}음절 — 6초를 넘는다`);
 }
});

test('처음 보는 대사 표는 원고와 같고, 제목 · 한국어 상황 글에 답 낱말이 없다', async () => {
 const { dramaLines, readEpisodes } = await import('../tools/build-world-speaking-talk.mjs');
 const lines = new Map(dramaLines(await readEpisodes()).map((l) => [l.id, l]));
 for (const item of POOL) {
  const l = lines.get(item.id);
  assert.ok(l, item.id);
  assert.equal(l.line, item.text, item.id);
  assert.equal(l.review.status, 'passed', item.id);
  assert.equal(l.answerSec, item.answerSec, item.id);
  assert.equal(l.spec.to, item.to, item.id);
  const words = (l.spec.keys || []).flatMap((k) => [k.word, ...(k.alts || [])]).filter((w) => w && w.length >= 2);
  for (const w of words) for (const shown of [item.title, item.situation]) assert.ok(!shown.includes(w), `${item.id}: 「${w}」가 화면 글에 있다`);
 }
 for (const id of [...Object.values(AGAIN_PAIR), ...NEW_ORDER]) assert.ok(POOL.some((x) => x.id === id), id);
 assert.ok(!Object.values(AGAIN_PAIR).includes(lesson.transfer.id) && !Object.values(AGAIN_PAIR).includes(lesson.delayed.id));
});

test('깃발이 없으면 드라마는 그대로 — 「오늘」 모듈은 ?today=1일 때만 불러오고, 공개 빌드는 싣지 않는다', () => {
 const src = fs.readFileSync(path.join(ROOT, 'experiences/drama/pilot/pilot.mjs'), 'utf8');
 // 정적 import에 today가 없다(깃발 없이 받는 바이트 · 실행에 들지 않는다).
 for (const m of src.matchAll(/^import .+ from '([^']+)';$/gm)) assert.ok(!m[1].includes('today'), m[1]);
 // 깃발은 주소의 today=1 하나이고, 「오늘」로 가는 길은 그 깃발 뒤에만 있다.
 assert.ok(/const TODAY = .*get\('today'\) === '1'/.test(src), '깃발 줄이 없다');
 const loads = src.split('\n').filter((l) => /import\(/.test(l) && /today\//.test(l));
 assert.ok(loads.length >= 1);
 for (const l of loads) assert.ok(/if \(TODAY\)/.test(l), `「오늘」 모듈은 깃발 검사 안에서만 부른다: ${l.trim()}`);
 // 깃발이 없으면 S.today가 생기지 않는다 — S.today에 값을 넣는 곳은 today/ 모듈뿐(pilot.mjs는 비우기만).
 assert.ok(!/S\.today\s*=(?!=)\s*(?!null\b)\S/.test(src), 'pilot.mjs가 S.today를 세운다');
 // 공개 빌드가 드라마에서 싣는 파일 목록에 today/가 없다.
 const build = fs.readFileSync(path.join(ROOT, 'tools/build-world-app-public.mjs'), 'utf8');
 assert.ok(!/drama[^\n]*today/.test(build));
});
