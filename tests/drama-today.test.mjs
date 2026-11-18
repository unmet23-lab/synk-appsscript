// 「오늘」 한 장(깃발 ?today=1, 2026-11-14) — 계약 · 사실에서만 짓기 · 깃발 없으면 그대로.
// 기록은 실제 기록기(pilot/learning-entry.cjs createRecorder · 입장 검사 묶음 엔진)로 심는다(qa/오늘한장-20261114/심기.mjs).
// 11-15부터 복습과 나중 확인(C)은 드라마 첫 화면과 같은 3일 규칙(takes.mjs planRevisit)으로 정한다 — 두 화면이 같은 답을 내는지도 본다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { world, read, doToday } from '../experiences/drama/qa/오늘한장-20261114/뽑기.mjs';
import { buildToday, buildAfter, readTurns, revisitPlan, TAEO_LINES, dayKey, dayStart, dayParts } from '../experiences/drama/pilot/today/plan.mjs';
import { POOL, NEW_ORDER, YO_LINES, TAEO_CALL, TAEO_MEDIA, SCENES, VENUE_IDS, sceneFor, nameFor } from '../experiences/drama/pilot/today/content.mjs';
import { planRevisit, REVISIT_DAYS } from '../experiences/drama/pilot/takes.mjs';
import { STR } from '../experiences/drama/pilot/strings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const D = require(path.join(ROOT, 'experiences/drama/pilot/learning-entry.cjs'));
const lesson = JSON.parse(fs.readFileSync(path.join(ROOT, 'experiences/drama/pilot/world-lesson.json'), 'utf8')).lesson;
const DAYS = lesson.revisit?.days || REVISIT_DAYS;
// 오늘 학습일 아침 9시(기기 시각) — 심는 기록은 이보다 앞서고, 엔진 시계(지금)보다도 앞선다. 학습일이 막 바뀐 때(새벽 4시 뒤 40분 안)면
// 그 앞 학습일 끝으로 물러난다(끝 화면 시험은 31분 전에 누른 것으로 짓는다 — 둘이 한 학습일에 들게).
const morning = () => { const now = Date.now(), s = dayStart(now); return now - s < 40 * 60000 ? s - 60000 : Math.min(s + 5 * 3600000, now - 60000); };
// 화면에 나가는 글에는 촬영장 말이 없다(설계 세션 11-14 — 스토리형 앱, 처음 보는 사람이 못 알아듣는다).
const STUDIO = /테이크|통과|노트/;
function visible(today, after = null) {
 const out = [today.line?.text, today.empty?.text, ...today.items.flatMap((x) => [x.title, x.why.text, x.why.next])];
 if (after) out.push(...after.changed.flatMap((c) => [c.what, c.before, c.after]), ...after.tomorrow.flatMap((x) => [x.title, x.when, x.name?.place, x.name?.who, x.name?.action]));
 return out.filter(Boolean);
}
// 첫 화면(pilot.mjs cardsNow)이 같은 기록으로 내는 3일 규칙의 답 — 차례(rank)도 첫 화면과 같게 목표 줄을 맨 앞에 둔다.
function firstScreen(facts, now = Date.now()) {
 const items = lesson.scene.filter((x) => x.type === 'student');
 const goal = items.find((x) => x.goal) || items.find((x) => x.id === 's1e01-7') || items[0];
 return planRevisit(facts, { now, days: DAYS, rank: (id) => { const k = items.findIndex((x) => x.id === id); return items[k] === goal ? -1 : k; } });
}
// 그 학습일에서 n일 뒤의 「11월 17일」(기기 시간대).
const label = (ms, plus) => { const d = new Date(dayStart(ms)); d.setDate(d.getDate() + plus); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };

function contract(today) {
 assert.equal(today.speaker, 'taeo');
 assert.ok(Array.isArray(today.items) && today.items.length <= 3);
 assert.equal(today.minutes, today.items.reduce((s, x) => s + x.minutes, 0));
 for (const it of today.items) {
  assert.ok(['again', 'new', 'check'].includes(it.kind));
  assert.ok(it.title && it.why?.code && it.why.text && it.why.evidence && typeof it.why.evidence === 'object');
  // 목록 줄에 보이는 한 문장(11-16 일력 판 — 카본: 줄마다 두 문장이면 학습지처럼 빽빽하다). 까닭 글 안의 한 문장이고, 나머지는 펼치면 보인다.
  assert.ok(it.why.lead && it.why.text.includes(it.why.lead), `${it.why.code}: ${it.why.lead}`);
  assert.equal(it.why.lead.split(/(?<=[.?!])\s+/).length, 1, it.why.lead);
  assert.ok(it.open?.type);
 }
 const order = today.items.map((x) => x.kind);
 assert.deepEqual(order, [...order].sort((a, b) => ['again', 'new', 'check'].indexOf(a) - ['again', 'new', 'check'].indexOf(b)));
 if (today.items.length) { assert.ok(TAEO_LINES[today.line.code]); assert.equal(today.line.text, TAEO_LINES[today.line.code]); assert.equal(today.empty, null); }
}

test('기록 A(어제 6번 줄 끝맺음 노트 · B 안 함 · 입장 검사 세부 두 번 놓침) → 세 줄, 복습은 첫 화면과 같은 틀린 장면 복습', async () => {
 const w = await world({ scenario: 'A', now: morning() });
 const r = await read(w, lesson);
 contract(r.today);
 const [again, fresh, check] = r.today.items;
 // 태오는 그 장면의 때와 곳만 떠올린다 — 6번 줄은 '요' 줄이라 끝맺음이면 「끝에 '요'까지요」가 붙는다.
 assert.equal(r.today.line.code, 'again.call.s1e01-6.yo');
 assert.equal(r.today.line.text, "식당에서 처음 만났죠? 그 장면, 오늘 한 번 더 해요. 이번엔 끝에 '요'까지 붙여서요.");
 // 11-16 처음 구운 태오 한마디(동그라미 영상) — 자리가 채워진 틀만 영상을 받는다.
 assert.deepEqual(r.today.line.media, { video: 'media/today-taeo-6yo.mp4' });
 assert.equal(again.kind, 'again');
 assert.deepEqual(again.open, { type: 'review', lineId: 's1e01-6' });
 assert.equal(again.why.code, 'again.ending.yo.retake');
 assert.equal(again.why.evidence.lineId, 's1e01-6');
 assert.equal(again.why.evidence.notes, 3);
 assert.equal(again.why.evidence.coached, true);
 assert.equal(again.why.evidence.due, false);
 assert.equal(again.why.text, '어제 「한참 헤맸어요」라고 할 때 끝이 반말처럼 들렸어요. 그 자리에서는 다시 해서 고쳤어요. 오늘은 대사를 안 보고 해 봐요.');
 for (const t of visible(r.today)) assert.ok(!STUDIO.test(t), t);
 // 근거 시각은 그 실수를 연 첫 판정 시도다(3일 규칙이 세는 시각 — 테이크 2는 세지 않는다).
 const turns = readTurns(r.events).filter((t) => t.lineId === 's1e01-6' && t.phase === 'scene');
 assert.equal(Date.parse(again.why.evidence.at), turns[0].attempts[0].at);
 // 첫 화면도 같은 실수를 같은 시각 · 같은 날 수로 본다(복습 화면은 이 꼴을 S.review.mistake로 읽는다).
 const first = firstScreen(r.revisit, w.now);
 assert.deepEqual(first.mistakes.map((m) => ({ lineId: m.lineId, kind: m.kind, at: m.at, fixed: m.fixed, ago: m.ago, due: m.due })), [again.mistake]);
 assert.equal(first.due, null);
 assert.equal(fresh.why.code, 'new.transfer');
 assert.deepEqual(fresh.open, { type: 'situation', lineId: 's1e01-t9', source: 'transfer' });
 const { RETURN_PATTERNS } = await import('../experiences/entry-check/learning.mjs');
 assert.equal(check.why.code, 'check.entry.detail');
 assert.equal(check.why.text, RETURN_PATTERNS.detail.why);
 assert.equal(check.why.next, RETURN_PATTERNS.detail.next);
 assert.equal(check.open.game, 'entry');
 assert.equal(check.why.evidence.misses, 2);
});

test('기록 B(8일 전 장면 · 8번 줄 첫 판정 길이 · B 혼자 해냄) → 3일째 복습 + 새 대사 + C, 첫 화면과 같은 판단 · 기록 F(첫날) → 「오늘」 없음', async () => {
 const w = await world({ scenario: 'B', now: morning() });
 const b = await read(w, lesson);
 contract(b.today);
 assert.deepEqual(b.today.items.map((x) => x.why.code), ['again.length.retake.due', 'new.pool.like', 'check.delayed']);
 const [again, fresh, check] = b.today.items;
 // 첫 화면은 다시 만나기 카드(3일째가 된 맨 앞 실수)와 C 자격을 같은 기록에서 같게 본다.
 const first = firstScreen(b.revisit, w.now);
 assert.equal(first.due.lineId, again.open.lineId);
 assert.equal(first.delayed, true);
 assert.deepEqual(again.open, { type: 'review', lineId: 's1e01-8' });
 assert.equal(again.why.evidence.due, true);
 assert.equal(again.why.text, '지난번 「덕분에 살았어요」라고 할 때 말이 짧게 끝났어요. 그 자리에서는 다시 해서 고쳤어요. 기억에 남았는지 오늘 대사를 안 보고 확인해요.');
 assert.equal(b.today.line.code, 'again.call.s1e01-8');
 // 「오늘 공부」는 한국어 상황 글만으로 서는 줄(t7 · t3)이 앞이다. 복습이 고마움(8번)이라 고마움인 t7은 건너뛰고 t3이다.
 assert.deepEqual(NEW_ORDER.slice(0, 2), ['s1e01-t7', 's1e01-t3']);
 assert.equal(POOL.find((x) => x.id === NEW_ORDER[0]).skill, again.skills[0]);
 assert.equal(fresh.open.lineId, NEW_ORDER[1]);
 for (const t of visible(b.today)) assert.ok(!STUDIO.test(t), t);
 assert.equal(check.why.text, STR.ko.delayedLead);
 assert.equal(check.why.evidence.days, 8);
 assert.equal(check.why.evidence.revisitDays, DAYS);
 const f = await read(await world({ scenario: 'F', now: morning() }), lesson);
 assert.equal(f.today.firstDay, true);
 assert.equal(f.today.items.length, 0);
});

// 손으로 짓는 사건 목록(서울 시각) — 차례마다 보임 하나, 시도는 판정 갈래로. answer: 첫 시도 전에 빈칸을 열었다(도움 answer).
function events(spec) {
 const out = [{ type: 'decision.made', id: 'd1', experienceId: 'drama-s1', at: spec[0].at }];
 spec.forEach((x, i) => {
  out.push({ type: 'practice.presented', id: `p${i}`, decisionId: 'd1', taskId: `drama-s1.${x.phase}.${x.line}`, itemKey: x.line, at: x.at });
  if (x.answer) out.push({ type: 'practice.helped', id: `h${i}`, presentationId: `p${i}`, helpId: 'answer', level: 'answer', at: x.at });
  (x.tries || []).forEach((c, j) => out.push({ type: 'practice.attempted', id: `a${i}.${j}`, presentationId: `p${i}`, attemptNo: j + 1, verdict: 'unassessed', choice: { selectedId: c, correctId: 'pass' }, at: new Date(Date.parse(x.at) + (j + 1) * 1000).toISOString() }));
 });
 return out;
}
const kst = (s) => new Date(Date.parse(`${s}+09:00`)).toISOString();
// 기록기 review()가 그 사건 목록에서 읽을 재료 — 같은 읽기 함수(learning-entry.cjs revisitFacts)로 짓는다. C는 보인 적이 있을 때만 본 것.
function facts(ev, L = lesson) {
 const lineIds = L.scene.filter((x) => x.type === 'student').map((x) => x.id);
 const f = D.revisitFacts(ev, { lineIds, transferId: L.transfer.id });
 return { history: f.history, unknown: [], transferAt: f.transferAt, delayedSeen: ev.some((e) => e.itemKey === L.delayed.id) };
}

test('근거가 없으면 줄을 내지 않는다 — 기록 없음 · 다른 게임 기록뿐 · 뺀 시도 · 3일 규칙을 모름', () => {
 assert.equal(buildToday({ events: [], lesson }).firstDay, true);
 const now = Date.parse('2026-11-15T09:00:00+09:00');
 const at = (h) => new Date(Date.parse('2026-11-14T00:00:00+09:00') + h * 3600000).toISOString();
 const ev = (type, id, extra) => ({ type, id, at: at(21), ...extra });
 const base = [
  ev('decision.made', 'd1', { experienceId: 'drama-s1' }),
  ev('practice.presented', 'p1', { decisionId: 'd1', taskId: 'drama-s1.scene.s1e01-6', itemKey: 's1e01-6' }),
  ev('practice.attempted', 'a1', { presentationId: 'p1', attemptNo: 1, verdict: 'unassessed', choice: { selectedId: 'note-ending', correctId: 'pass' } }),
 ];
 const t1 = buildToday({ events: base, lesson, now, revisit: facts(base), tzOffsetMin: 540 });
 assert.equal(t1.items[0].why.code, 'again.ending.yo');
 // 3일 규칙의 재료를 모르면(기록이 덜 모임) 복습 줄을 짓지 않는다.
 assert.ok(!buildToday({ events: base, lesson, now, revisit: null, tzOffsetMin: 540 }).items.some((x) => x.kind === 'again'));
 // 그 시도를 「제가 한 말과 달라요」로 뺐으면 실수가 없다 → 복습 줄이 없다.
 const gone = [...base, ev('record.excluded', 'x1', { targetId: 'a1' })];
 assert.ok(!buildToday({ events: gone, lesson, now, revisit: facts(gone), tzOffsetMin: 540 }).items.some((x) => x.kind === 'again'));
 // 다른 게임(입장 검사)의 기록만으로는 드라마 줄을 짓지 않는다.
 const other = base.map((e) => (e.type === 'decision.made' ? { ...e, experienceId: 'entry-check' } : e));
 assert.equal(buildToday({ events: other, lesson, now, revisit: facts(other), tzOffsetMin: 540 }).firstDay, true);
 // 시간 낱말: 이틀 전이면 「지난번」. 태오 한 줄은 시간 낱말 없이 장면을 되부른다.
 const t3 = buildToday({ events: base, lesson, now: now + 86400000, revisit: facts(base), tzOffsetMin: 540 });
 assert.equal(t3.line.code, 'again.call.s1e01-6.yo');
 assert.match(t3.items[0].why.text, /^지난번 /);
 assert.equal(dayKey(now, 540), '2026-11-15');
});

test('학습일은 새벽 4시에 바뀐다 — 밤 1시 반 기록은 3시엔 「오늘」, 4시 반엔 「어제」', () => {
 const ev = events([{ phase: 'scene', line: 's1e01-6', at: kst('2026-11-15T01:30:00'), tries: ['note-ending'] }]);
 assert.equal(dayKey(Date.parse(kst('2026-11-15T03:59:00')), 540), '2026-11-14');
 assert.equal(dayKey(Date.parse(kst('2026-11-15T04:00:00')), 540), '2026-11-15');
 assert.equal(buildToday({ events: ev, lesson, now: Date.parse(kst('2026-11-15T03:00:00')), revisit: facts(ev), tzOffsetMin: 540 }).firstDay, true);
 const t = buildToday({ events: ev, lesson, now: Date.parse(kst('2026-11-15T04:30:00')), revisit: facts(ev), tzOffsetMin: 540 });
 assert.equal(t.firstDay, false);
 assert.match(t.items[0].why.text, /^어제 /);
});

test('3일 규칙: 3일째 전에 고쳐 본 줄은 내지 않고, 3일째에 다시 만나기로 낸다 · 오늘 복습한 줄은 다시 내지 않는다', () => {
 const spec = [
  { phase: 'scene', line: 's1e01-6', at: kst('2026-11-12T21:00:00'), tries: ['pass'] },
  { phase: 'scene', line: 's1e01-7', at: kst('2026-11-12T21:01:00'), tries: ['note-missing'] },
  { phase: 'scene', line: 's1e01-8', at: kst('2026-11-12T21:02:00'), tries: ['pass'] },
  // 이튿날 스스로 복습해서 고쳐 봤다(3일째 전 — 고침 표시만, 다시 만나기는 그대로).
  { phase: 'review', line: 's1e01-7', at: kst('2026-11-13T20:00:00'), tries: ['pass'] },
 ];
 const ev = events(spec);
 const on = (s) => buildToday({ events: ev, lesson, now: Date.parse(kst(s)), revisit: facts(ev), tzOffsetMin: 540 });
 assert.ok(!on('2026-11-14T09:00:00').items.some((x) => x.kind === 'again'), '이틀째(고쳐 본 줄)는 복습 줄이 없다');
 const due = on('2026-11-15T09:00:00').items[0];
 assert.equal(due.why.code, 'again.missing.due.tried');
 assert.equal(due.why.text, '지난번 「어디에 있는지 아세요」라고 할 때 꼭 들어가야 할 말이 하나 빠졌어요. 그 뒤에 한 번 고쳐 봤어요. 기억에 남았는지 오늘 대사를 안 보고 확인해요.');
 assert.deepEqual(due.open, { type: 'review', lineId: 's1e01-7' });
 // 3일째에 빈칸 카드로 첫 시도에 해냈으면 닫힌다 — 그날 다시 열어도, 다음 날에도 복습 줄이 없다.
 const closed = events([...spec, { phase: 'review', line: 's1e01-7', at: kst('2026-11-15T09:10:00'), tries: ['pass'] }]);
 for (const s of ['2026-11-15T10:00:00', '2026-11-16T09:00:00']) {
  assert.ok(!buildToday({ events: closed, lesson, now: Date.parse(kst(s)), revisit: facts(closed), tzOffsetMin: 540 }).items.some((x) => x.kind === 'again'), s);
 }
});

test('끝 화면의 복습 줄은 3일 규칙과 같은 기준(보임마다 첫 판정) — 「다시 해 보기」는 고친 것으로 세지 않는다', () => {
 // 7번 줄을 빠진 말로 틀렸다. 어제(3일째 전)와 3일 전(3일째) 두 경우에, 오늘 「오늘」에서 연 복습 한 바퀴의 시도를 바꿔 본다(11-15 Fable 검수 P2-1).
 const scene = (day) => [
  { phase: 'scene', line: 's1e01-6', at: kst(`${day}T21:00:00`), tries: ['pass'] },
  { phase: 'scene', line: 's1e01-7', at: kst(`${day}T21:01:00`), tries: ['note-missing'] },
  { phase: 'scene', line: 's1e01-8', at: kst(`${day}T21:02:00`), tries: ['pass'] },
 ];
 const startAt = Date.parse(kst('2026-11-15T09:00:00')), now = Date.parse(kst('2026-11-15T09:30:00'));
 const end = (day, review) => {
  const before = scene(day), all = events([...before, { phase: 'review', line: 's1e01-7', at: kst('2026-11-15T09:05:00'), ...review }]);
  const start = buildToday({ events: events(before), lesson, now: startAt, revisit: facts(events(before)), tzOffsetMin: 540 });
  assert.deepEqual(start.items[0].open, { type: 'review', lineId: 's1e01-7' });
  const after = buildAfter({ events: all, lesson, start, startAt, now, revisit: facts(all), strings: STR.ko, tzOffsetMin: 540 });
  return { line: after.changed.find((c) => c.what === '빠진 말')?.after || null, again: after.tomorrow.find((x) => x.kind === 'again')?.when || null };
 };
 // 3일째 전: 첫 시도에 해내면 고침 표시(3일째 11월 17일에 다시), 첫 시도를 놓치고 다시 해서 해내면 고친 것이 아니다(내일 다시).
 assert.deepEqual(end('2026-11-14', { tries: ['pass'] }), { line: '오늘은 고쳐 봤어요', again: '11월 17일' });
 assert.deepEqual(end('2026-11-14', { tries: ['pass', 'note-missing'] }), { line: '오늘은 고쳐 봤어요', again: '11월 17일' });
 assert.deepEqual(end('2026-11-14', { tries: ['note-missing', 'pass'] }), { line: '오늘은 다시 해서 해냈어요', again: '내일' });
 assert.deepEqual(end('2026-11-14', { tries: ['note-missing'] }), { line: null, again: '내일' });
 // 3일째: 빈칸을 열지 않고 첫 시도에 해내면 닫힌다(뒤 시도를 놓쳐도). 빈칸을 열고 해내면 「대사를 보고」이고 내일 다시 나온다.
 assert.deepEqual(end('2026-11-12', { tries: ['pass'] }), { line: '오늘은 대사를 안 보고 해냈어요', again: null });
 assert.deepEqual(end('2026-11-12', { tries: ['pass', 'note-missing'] }), { line: '오늘은 대사를 안 보고 해냈어요', again: null });
 assert.deepEqual(end('2026-11-12', { tries: ['pass'], answer: true }), { line: '오늘은 대사를 보고 해냈어요', again: '내일' });
 // 3일째에 첫 시도를 놓치면 그 시각부터 다시 3일 — 다시 해서 해내도 고친 것이 아니고, 내일은 스스로 복습할 줄로 나온다.
 assert.deepEqual(end('2026-11-12', { tries: ['note-missing', 'pass'] }), { line: '오늘은 다시 해서 해냈어요', again: '내일' });
});

test('시험의 시간대 경로는 기기의 서머타임에 흔들리지 않는다 — 뉴욕 기기에서도 서울 기기와 같은 날 수 · 같은 시각', () => {
 // 11-15 Fable 검수 P2-2: 벽시계를 기기 시계로 그대로 옮기면 뉴욕 기기에서 서머타임 전환 주간에 하루가 어긋나고 두 시각이 한 값으로 겹쳤다.
 const code = `
  import fs from 'node:fs';
  const { revisitPlan } = await import(${JSON.stringify(new URL('../experiences/drama/pilot/today/plan.mjs', import.meta.url).href)});
  const lesson = JSON.parse(fs.readFileSync(${JSON.stringify(path.join(ROOT, 'experiences/drama/pilot/world-lesson.json'))}, 'utf8')).lesson;
  const at = (s) => Date.parse(s);
  const one = revisitPlan({ history: { 's1e01-6': [{ at: at('2026-10-31T19:30:00Z'), choice: 'note-ending', helped: false }] }, transferAt: null, unknown: [], delayedSeen: false },
   { lesson, now: at('2026-11-02T20:00:00Z'), tz: 540 }).mistakes[0];
  const two = revisitPlan({ history: { 's1e01-6': [{ at: at('2026-03-08T06:30:00Z'), choice: 'note-ending', helped: false }], 's1e01-8': [{ at: at('2026-03-08T07:30:00Z'), choice: 'note-ending', helped: false }] },
   transferAt: null, unknown: [], delayedSeen: false }, { lesson, now: at('2026-03-09T03:00:00Z'), tz: 540 }).mistakes;
  console.log(JSON.stringify({ one: { ago: one.ago, due: one.due, at: one.at }, two: two.map((m) => [m.lineId, m.at, m.ago]) }));`;
 const run = (TZ) => JSON.parse(spawnSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, TZ }, encoding: 'utf8' }).stdout);
 const seoul = run('Asia/Seoul');
 // 한국 11월 1일 새벽 4시 반에 틀렸고 지금은 한국 11월 3일 새벽 5시 — 학습일로 이틀, 아직 3일째가 아니다.
 assert.deepEqual(seoul.one, { ago: 2, due: false, at: Date.parse('2026-10-31T19:30:00Z') });
 // 한국 3월 8일 오후 3시 반과 4시 반(뉴욕은 그날 새벽 서머타임 전환)에 틀렸고 지금은 한국 3월 9일 낮 — 하루 전이고, 두 시각이 겹치지 않는다.
 assert.deepEqual(seoul.two, [['s1e01-6', Date.parse('2026-03-08T06:30:00Z'), 1], ['s1e01-8', Date.parse('2026-03-08T07:30:00Z'), 1]]);
 for (const TZ of ['America/New_York', 'UTC', 'Europe/Helsinki']) assert.deepEqual(run(TZ), seoul, TZ);
});

test('「했어요」는 말한 기록으로만 센다 — 카드만 열고 나간 줄은 한 것이 아니다', () => {
 const now = Date.parse(kst('2026-11-15T09:00:00'));
 // 6번 줄만 말하고 7번 줄은 열기만 했다 → 「3줄 가운데 1줄까지」.
 const oneEv = events([
  { phase: 'scene', line: 's1e01-6', at: kst('2026-11-14T21:00:00'), tries: ['pass'] },
  { phase: 'scene', line: 's1e01-7', at: kst('2026-11-14T21:02:00') },
 ]);
 const one = buildToday({ events: oneEv, lesson, now, revisit: facts(oneEv), tzOffsetMin: 540 });
 const scene = one.items.find((x) => x.open.type === 'scene');
 assert.equal(scene.why.code, 'new.scene');
 assert.equal(scene.why.text, '어제 1화에서 내 대사 3개 중 1개까지 했어요.');
 assert.deepEqual(scene.why.evidence.spoken, ['s1e01-6']);
 assert.equal(one.line.code, 'new.scene');
 // 아무 줄도 말하지 않고 열기만 했다 → 「열었어요」(한 줄 수를 말하지 않는다).
 const noneEv = events([{ phase: 'scene', line: 's1e01-6', at: kst('2026-11-14T21:00:00') }]);
 const none = buildToday({ events: noneEv, lesson, now, revisit: facts(noneEv), tzOffsetMin: 540 });
 assert.equal(none.items[0].why.code, 'new.scene.opened');
 assert.equal(none.items[0].why.text, '어제 1화를 열어 보기만 했어요.');
 // 장면 줄 셋을 다 말했고 B는 열기만 했다 → B는 아직 안 한 것(다시 권한다).
 const allSaid = [
  { phase: 'scene', line: 's1e01-6', at: kst('2026-11-14T21:00:00'), tries: ['pass'] },
  { phase: 'scene', line: 's1e01-7', at: kst('2026-11-14T21:01:00'), tries: ['pass'] },
  { phase: 'scene', line: 's1e01-8', at: kst('2026-11-14T21:02:00'), tries: ['pass'] },
 ];
 const bEv = events([...allSaid, { phase: 'transfer', line: 's1e01-t9', at: kst('2026-11-14T21:05:00') }]);
 const b = buildToday({ events: bEv, lesson, now, revisit: facts(bEv), tzOffsetMin: 540 });
 assert.equal(b.items[0].why.code, 'new.transfer');
 assert.equal(b.line.code, 'new.situation');
});

test('같은 날 같은 말하기가 둘 서지 않는다 — 7번(묻기)이 복습이면 오늘 공부는 묻기가 아닌 줄', () => {
 const now = Date.parse(kst('2026-11-15T09:00:00'));
 const ev = events([
  { phase: 'scene', line: 's1e01-6', at: kst('2026-11-14T21:00:00'), tries: ['pass'] },
  { phase: 'scene', line: 's1e01-7', at: kst('2026-11-14T21:01:00'), tries: ['note-missing'] },
  { phase: 'scene', line: 's1e01-8', at: kst('2026-11-14T21:02:00'), tries: ['pass'] },
 ]);
 const t = buildToday({ events: ev, lesson, now, revisit: facts(ev), tzOffsetMin: 540 });
 const [again, fresh] = t.items;
 assert.deepEqual(again.open, { type: 'review', lineId: 's1e01-7' });
 assert.equal(again.why.text, '어제 「어디에 있는지 아세요」라고 할 때 꼭 들어가야 할 말이 하나 빠졌어요. 오늘은 대사를 안 보고 해 봐요.');
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
 const ev = events([{ phase: 'scene', line: extra.id, at: kst('2026-11-14T21:00:00'), tries: ['note-ending'] }]);
 const t = buildToday({ events: ev, lesson: L, now, revisit: facts(ev, L), tzOffsetMin: 540 });
 const again = t.items.find((x) => x.kind === 'again');
 assert.equal(again.why.code, 'again.ending');
 assert.match(again.why.text, /라고 할 때 끝맺음이 대사와 다르게 들렸어요\. /);
 assert.ok(!/'요'|반말/.test(again.why.text));
 assert.equal(t.line.code, 'again.review');
 assert.ok(!/'요'/.test(t.line.text));
});

test('끝 화면: 오늘 해낸 것만 전후로, 다음에 할 것은 같은 규칙의 내일과 3일째 날짜', async () => {
 const startAt = morning() - 31 * 60000;
 const w = await world({ scenario: 'A', now: startAt });
 w.lesson = lesson;
 const r = await read(w, lesson);
 w.now = morning();
 const done = await doToday(w, r.today, { minutesAgo: 30 });
 const again = await read(w, lesson);
 const after = buildAfter({ events: again.events, lesson, start: r.today, startAt: done.startAt, now: w.now, revisit: again.revisit, entryAfter: again.entry, entryTarget: done.entryTarget, strings: STR.ko });
 // 새 상황 줄은 오늘 장면 판 카드와 같은 누구 · 할 일로 부른다(11-18 유호님 「네, 맞춰」 — 그 전에는 계약 제목 「같은 과 다른 선배에게 길 묻기」).
 assert.deepEqual(after.changed.map((c) => c.what), ["끝에 '요' 붙이기", '같은 과 다른 선배 · 길 묻기', '표와 짐의 세부 내용 확인']);
 assert.equal(after.changed[0].before, '어제는 「한참 헤맸어요」의 끝이 반말처럼 들렸어요');
 // 3일째 전에 해낸 복습은 닫히지 않는다 — 「고쳐 봤어요」이고, 첫 화면도 고침 표시만 한다.
 assert.equal(after.changed[0].after, '오늘은 고쳐 봤어요');
 assert.equal(firstScreen(again.revisit, w.now).mistakes.find((m) => m.lineId === 's1e01-6')?.fixed, true);
 // 입장 검사 전 글은 근거 그대로(그 놓침이 한 근무 안이라는 근거는 없다).
 const entry = r.today.items.find((x) => x.open.type === 'game').why.evidence;
 assert.equal(after.changed[2].before, `최근 ${entry.seen}번 중 ${entry.misses}번 놓쳤어요`);
 for (const t of visible(r.today, after)) assert.ok(!STUDIO.test(t), t);
 const next = buildToday({ events: again.events, lesson, now: w.now + 86400000, revisit: again.revisit, entry: again.entry, strings: STR.ko });
 assert.deepEqual(after.tomorrow.filter((x) => x.when === '내일').map((x) => x.title), next.items.map((x) => x.title));
 // 다음에 할 것의 이름은 그날 오늘 화면 카드의 머리글(어디 · 누구)과 같고, 할 일은 때(어제 · 지난번) 없이 — 복습은 그 대사로(11-18 Opus 대체 검수 F2).
 for (const [x, it] of after.tomorrow.filter((y) => y.when === '내일').map((y, i) => [y, next.items[i]])) {
  const card = sceneFor(it, lesson);
  assert.deepEqual([x.name.place, x.name.who], [card.scene.place, card.scene.who], x.title);
  if (it.kind !== 'again') assert.equal(x.name.action, card.action, x.title);
 }
 for (const x of after.tomorrow) assert.ok(x.name?.action && !/어제|지난번|오늘/.test(x.name.action), `${x.title}: ${x.name?.action}`);
 assert.equal(after.tomorrow.find((x) => x.kind === 'again').name.action, '「한참 헤맸어요」 다시 하기');
 assert.deepEqual(after.tomorrow.find((x) => x.kind === 'check' && x.when !== '내일').name, { place: '학교 앞 버스 정류장', who: '지나가는 어른', action: '처음 보는 분께 길 묻기' });
 // 6번 줄은 처음 틀린 날부터 3일째에, 나중 확인(C)은 오늘 처음 해 본 B부터 3일째에 나온다 — 첫 화면 카드와 같은 날.
 const r6 = r.today.items.find((x) => x.kind === 'again');
 assert.equal(after.tomorrow.find((x) => x.kind === 'again')?.when, label(Date.parse(r6.why.evidence.at), DAYS));
 assert.equal(after.tomorrow.find((x) => x.kind === 'check')?.when, label(w.now, DAYS));
 // 일력의 다음 장 번호(11-16) — 「내일」이면 다음 날, 「11월 18일」이면 그 날의 숫자 · 요일.
 for (const x of after.tomorrow) {
  const d = new Date(dayStart(w.now)); if (x.when === '내일') d.setDate(d.getDate() + 1); else { const [, m, dd] = /(\d+)월 (\d+)일/.exec(x.when); d.setMonth(+m - 1, +dd); }
  assert.deepEqual(x.date, { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), weekday: d.getDay() }, x.when);
 }
 // 옛 Atlas 7일 짝의 말이 남지 않는다.
 for (const t of visible(r.today, after)) assert.ok(!/7~10일|며칠 뒤|\b7일 (뒤|전)/.test(t), t);
 // 오늘 할 것을 다 했으면 같은 날 다시 열어도 그 줄은 다시 나오지 않는다.
 const reopen = buildToday({ events: again.events, lesson, now: w.now, revisit: again.revisit, entry: again.entry, strings: STR.ko });
 assert.ok(!reopen.items.some((x) => r.today.items.some((y) => y.open.lineId && y.open.lineId === x.open.lineId)));
 assert.ok(!reopen.items.some((x) => x.open.type === 'game'));
});

test('끝 화면: 3일째 복습을 빈칸 카드로 첫 시도에 해내면 닫히고, 놓치면 내일 다시 나온다', async () => {
 const run = async (results) => {
  const startAt = morning() - 31 * 60000;
  const w = await world({ scenario: 'B', now: startAt });
  w.lesson = lesson;
  const r = await read(w, lesson);
  w.now = morning();
  const done = await doToday(w, r.today, { minutesAgo: 30, results });
  const again = await read(w, lesson);
  return { r, w, again, after: buildAfter({ events: again.events, lesson, start: r.today, startAt: done.startAt, now: w.now, revisit: again.revisit, entryAfter: again.entry, entryTarget: done.entryTarget, strings: STR.ko }) };
 };
 const ok = await run({});
 assert.deepEqual(ok.after.changed[0], { what: '말 길이', before: '지난번엔 「덕분에 살았어요」라고 할 때 말이 짧게 끝났어요', after: '오늘은 대사를 안 보고 해냈어요' });
 // 나중 확인(C) 줄 — 이름은 오늘 카드(지나가는 어른)이고, 전 글은 그날 실제로 한 B(캠퍼스 · 같은 과 다른 선배)를 말한다(11-18 Opus 대체 검수 F2).
 const c = ok.after.changed.find((x) => x.after === '오늘은 다른 곳에서도 해냈어요');
 assert.deepEqual(c, { what: '지나가는 어른 · 처음 보는 분께 길 묻기', before: `${ok.r.today.items.find((x) => x.open.source === 'delayed').why.evidence.days}일 전에는 캠퍼스에서 같은 과 다른 선배에게 처음 해 봤어요`, after: '오늘은 다른 곳에서도 해냈어요' });
 assert.ok(!firstScreen(ok.again.revisit, ok.w.now).mistakes.some((m) => m.lineId === 's1e01-8'), '첫 화면에서도 닫혔다');
 assert.ok(!ok.after.tomorrow.some((x) => x.kind === 'again'));
 const miss = await run({ 's1e01-8': 'note-length' });
 assert.ok(!miss.after.changed.some((c) => c.what === '말 길이'), '놓친 복습은 「해냈어요」가 없다');
 // 3일째에 다시 놓치면 그 시각부터 다시 3일 — 내일은 스스로 복습할 줄로 다시 나온다.
 const m8 = firstScreen(miss.again.revisit, miss.w.now).mistakes.find((m) => m.lineId === 's1e01-8');
 assert.equal(m8?.due, false);
 assert.ok(miss.after.tomorrow.some((x) => x.kind === 'again' && x.when === '내일'));
});

test('태오가 떠올리는 말에는 그 장면 대사의 답 낱말이 없고, 말하는 길이가 6초 안이다', async () => {
 const { dramaLines, readEpisodes } = await import('../tools/build-world-speaking-talk.mjs');
 const lines = new Map(dramaLines(await readEpisodes()).map((l) => [l.id, l]));
 for (const [id, call] of Object.entries(TAEO_CALL)) {
  assert.ok(lesson.scene.some((x) => x.id === id && x.type === 'student'), `${id}: 1화 학생 줄이 아니다`);
  // 복습은 그 대사를 빈칸 카드로 다시 하는 일이다 — 태오가 답 낱말을 먼저 말하면 빈칸이 뜻을 잃는다.
  const words = (lines.get(id)?.spec?.keys || []).flatMap((k) => [k.word, ...(k.alts || [])]).filter((w) => w && w.length >= 2);
  assert.ok(words.length, `${id}: 답 낱말을 못 읽었다`);
  for (const w of words) assert.ok(!call.text.includes(w), `${id}: 그 대사의 답 낱말 「${w}」가 태오 말에 있다`);
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
 for (const id of NEW_ORDER) assert.ok(POOL.some((x) => x.id === id), id);
 assert.ok(!NEW_ORDER.includes(lesson.transfer.id) && !NEW_ORDER.includes(lesson.delayed.id));
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

test('일력의 다음 장 번호는 해를 넘긴다 — 12월 31일의 내일은 다음 해 1월 1일(11-16 GPT 검수 GA1)', () => {
 const eve = new Date(2026, 11, 31, 9).getTime();
 assert.deepEqual(dayParts(eve, 1, null), { year: 2027, month: 1, day: 1, weekday: new Date(2027, 0, 1).getDay() });
 assert.deepEqual(dayParts(eve, 3, 540), { year: 2027, month: 1, day: 3, weekday: new Date(2027, 0, 3).getDay() });
});

test('태오 한마디 영상 자리는 있는 틀에만, 정해 둔 이름으로 — 다음 장의 끝인사도 틀이 있다(11-16)', () => {
 for (const [code, m] of Object.entries(TAEO_MEDIA)) {
  assert.ok(TAEO_LINES[code], code);
  assert.match(m.video, /^media\/today-taeo-[a-z0-9]+\.mp4$/, code);
 }
 assert.ok(TAEO_LINES.done && !/'요'/.test(TAEO_LINES.done));
});

test('태오 한마디의 줄바꿈 덩이 — 문장마다 새 줄, 12자 이하 마디는 한 덩이(11-18 Fable · 이유 문장의 「자세히」 묶음은 장면 판에서 빠졌다)', async () => {
 const { words } = await import('../experiences/drama/pilot/today/screen.mjs');
 const text = (h) => h.replace(/<[^>]+>/g, '');
 const count = (h, re) => (h.match(re) || []).length;
 // 문장 둘 → 새 줄 둘. 「식당에서 처음 만났죠?」(12자) · 「그 장면,」 · 「오늘 한 번 더 해요.」(12자)는 모두 한 덩이로 넘어간다.
 const a = words('식당에서 처음 만났죠? 그 장면, 오늘 한 번 더 해요.');
 assert.equal(count(a, /<span class="s">/g), 2);
 assert.equal(count(a, /<span class="cl">/g), 3);
 assert.equal(text(a).replace(/\s+/g, ' '), '식당에서 처음 만났죠? 그 장면, 오늘 한 번 더 해요.');
 // 낱말이 떠오르는 차례는 문장을 넘어서도 이어진다.
 const delays = [...a.matchAll(/animation-delay:(\d+)ms/g)].map((m) => Number(m[1]));
 assert.deepEqual(delays, delays.map((_, i) => 160 + i * 60));
 // 12자와 13자 경계 — 13자 마디는 덩이로 묶지 않아 칸 안에서 줄을 바꾼다.
 assert.equal(count(words('가나다라마바사아자차카타'), /<span class="cl">/g), 1);
 assert.equal(count(words('가나다라마바사아자차카타파'), /<span class="cl">/g), 0);
 // 띄어쓰기 없는 문장은 낱말 하나 · 덩이 하나.
 const one = words('안녕하세요.');
 assert.equal(count(one, /class="w"/g), 1);
 assert.equal(count(one, /<span class="cl">/g), 1);
 // 따옴표 속 '요'는 낫표로 묶이고, 긴 문장(18자)은 덩이로 묶지 않는다.
 const yo = words("이번엔 끝에 '요'까지 붙여서요.");
 assert.match(yo, /<em class="td-yo">「요」<\/em>까지/);
 assert.equal(count(yo, /<span class="cl">/g), 0);
});

test('장면 판(11-18 유호님 「앱에 옮겨」): 할 일마다 장면 그림 · 곳 · 사람 · 할 일 · 한 줄이 서고, 촬영장 말과 답 낱말이 없다', async () => {
 const { dramaLines, readEpisodes } = await import('../tools/build-world-speaking-talk.mjs');
 const lines = new Map(dramaLines(await readEpisodes()).map((l) => [l.id, l]));
 const keys = (id) => (lines.get(id)?.spec?.keys || []).flatMap((k) => [k.word, ...(k.alts || [])]).filter((w) => w && w.length >= 2);
 // 기록 A · B가 내는 여섯 줄(복습 둘 · 전이 · 오늘 공부 · 입장 검사 · 나중 확인)과 오늘 공부 표의 모든 줄, 첫날의 1화 이어서 하기.
 const items = [];
 for (const s of ['A', 'B']) items.push(...(await read(await world({ scenario: s, now: morning() }), lesson)).today.items);
 assert.deepEqual(items.map((x) => x.open.source || x.open.type), ['review', 'transfer', 'game', 'review', 'situation', 'delayed']);
 for (const p of POOL) items.push({ kind: 'new', title: p.title, open: { type: 'situation', lineId: p.id } });
 items.push({ kind: 'new', title: '1화 처음부터', open: { type: 'scene' }, why: { lead: '태오 선배와 학생 식당에서 처음 만나요.' } });
 for (const it of items) {
  const c = sceneFor(it, lesson);
  const tag = `${it.kind} ${it.open.lineId || it.open.type}`;
  assert.ok(c && c.scene?.img && c.scene.place && c.scene.who && c.action && c.say, `${tag}: ${JSON.stringify(c)}`);
  for (const t of [c.scene.place, c.scene.who, c.action, c.say]) assert.ok(!STUDIO.test(t), `${tag}: ${t}`);
  // 처음 해 보는 말하기(전이 · 오늘 공부 · 나중 확인)는 첫 제출 전에 답을 보이지 않는다 — 장면 칸의 글에도 그 줄의 답 낱말이 없다.
  if (it.kind !== 'again' && it.open.lineId) for (const w of keys(it.open.lineId)) for (const t of [c.scene.place, c.scene.who, c.action, c.say]) assert.ok(!t.includes(w), `${tag}: 「${w}」가 「${t}」에 있다`);
 }
 // 장면 그림은 정해 둔 칸 이름으로만, 오늘 공부 표의 장면 칸은 모두 있는 칸이다. 입장 검사는 그 근무지의 게임 그림을 쓴다.
 for (const [k, s] of Object.entries(SCENES)) assert.equal(s.img, `media/today-scene-${k}.webp`);
 for (const p of POOL) assert.ok(SCENES[p.scene], `${p.id}: 장면 칸 ${p.scene}이 없다`);
 const game = items.find((x) => x.open.type === 'game');
 assert.ok(VENUE_IDS.includes(game.open.venueId), game.open.venueId);
 assert.equal(sceneFor(game, lesson).scene.img, `media/today-venue-${game.open.venueId}.webp`);
 assert.equal(sceneFor({ ...game, open: { ...game.open, venueId: 'nowhere' } }, lesson).scene.img, null);
 // 날 수를 모르는 복습은 「오늘」이 아니라 「지난번」(null <= 0이 참이다 — 11-18 카본 A4).
 const again = items[0];
 // 복습 한 줄의 꼬리는 그 대사 글에서 — 내용 표(TAILS)에 없는 줄도 끝 두 어절로 서고, 글이 없으면 빈 낫표 없이 일반 문장(11-18 Opus 대체 검수 F3).
 const extra = { ...lesson, scene: [...lesson.scene, { id: 's1e01-x', type: 'student', text: '오늘 처음 왔어요.' }] };
 const at = (lineId, L) => sceneFor({ ...again, note: 'ending', why: { ...again.why, evidence: { ...again.why.evidence, lineId, yo: false } } }, L).say;
 assert.equal(at('s1e01-x', extra), '「처음 왔어요」 끝맺음을 대사대로');
 assert.equal(at('s1e01-zz', lesson), '그 대사를 끝까지 또렷하게');
 // 입장 검사 칸의 머리글 둘째 자리는 말 거는 사람이 아니라 게임 이름이다(F5).
 assert.equal(sceneFor(game, lesson).scene.who, '입장 검사 게임');
 for (const [ago, when] of [[0, '오늘'], [1, '어제'], [3, '지난번'], [null, '지난번'], [undefined, '지난번']]) assert.equal(sceneFor({ ...again, why: { ...again.why, evidence: { ...again.why.evidence, ago } } }, lesson).action, `${when} 한 말 다시 하기`);
});
