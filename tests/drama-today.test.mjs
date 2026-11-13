// 「오늘」 한 장(깃발 ?today=1, 2026-11-14) — 계약 · 사실에서만 짓기 · 깃발 없으면 그대로.
// 기록은 실제 기록기(pilot/learning-entry.cjs createRecorder · 입장 검사 묶음 엔진)로 심는다(qa/오늘한장-20261114/심기.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { world, read, doToday } from '../experiences/drama/qa/오늘한장-20261114/뽑기.mjs';
import { buildToday, buildAfter, readTurns, TAEO_LINES, dayKey } from '../experiences/drama/pilot/today/plan.mjs';
import { POOL, AGAIN_PAIR, NEW_ORDER } from '../experiences/drama/pilot/today/content.mjs';
import { STR } from '../experiences/drama/pilot/strings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lesson = JSON.parse(fs.readFileSync(path.join(ROOT, 'experiences/drama/pilot/world-lesson.json'), 'utf8')).lesson;
// 오늘 아침 9시(기기 시각) — 심는 기록은 이보다 앞서고, 엔진 시계(지금)보다도 앞선다.
const morning = () => { const d = new Date(); d.setHours(9, 0, 0, 0); return Math.min(d.getTime(), Date.now() - 60000); };

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
 assert.equal(r.today.line.code, 'again.ending.yesterday');
 assert.equal(again.kind, 'again');
 assert.deepEqual(again.open, { type: 'situation', lineId: AGAIN_PAIR['s1e01-6'] });
 assert.equal(again.why.code, 'again.ending.fixed');
 assert.equal(again.why.evidence.lineId, 's1e01-6');
 assert.equal(again.why.evidence.notes, 3);
 assert.equal(again.why.evidence.coached, true);
 assert.equal(again.why.text, "어제 「…한참 헤맸어요」에서 끝 '요' 노트를 받았어요. 테이크 2에서는 통과했어요.");
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
 assert.equal(b.today.items[0].open.lineId, NEW_ORDER[0]);
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
 assert.equal(t1.items[0].why.code, 'again.ending');
 // 그 시도를 「제가 한 말과 달라요」로 뺐으면 노트가 없다 → 다시 만날 말이 없다.
 const t2 = buildToday({ events: [...base, ev('record.excluded', 'x1', { targetId: 'a1' })], lesson, now, tzOffsetMin: 540 });
 assert.ok(!t2.items.some((x) => x.kind === 'again'));
 // 다른 게임(입장 검사)의 기록만으로는 드라마 줄을 짓지 않는다.
 const other = base.map((e) => (e.type === 'decision.made' ? { ...e, experienceId: 'entry-check' } : e));
 assert.equal(buildToday({ events: other, lesson, now, tzOffsetMin: 540 }).firstDay, true);
 // 시간 낱말: 이틀 전이면 「지난번」.
 const t3 = buildToday({ events: base, lesson, now: now + 86400000, tzOffsetMin: 540 });
 assert.equal(t3.line.code, 'again.ending.before');
 assert.match(t3.items[0].why.text, /^지난번 /);
 assert.equal(dayKey(now, 540), '2026-11-15');
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
 assert.deepEqual(after.changed.map((c) => c.what), ["끝 '요'", '같은 과 다른 선배에게 길 묻기', '세부 내용 맞추기']);
 assert.equal(after.changed[0].before, '어제 「…한참 헤맸어요」 노트');
 const next = buildToday({ events: again.events, lesson, now: w.now + 86400000, entry: again.entry, strings: STR.ko });
 assert.deepEqual(after.tomorrow.filter((x) => x.when === '내일').map((x) => x.title), next.items.map((x) => x.title));
 assert.ok(after.tomorrow.some((x) => x.when === '7일 뒤'));
 // 오늘 할 것을 다 했으면 같은 날 다시 열어도 그 줄은 다시 나오지 않는다.
 const reopen = buildToday({ events: again.events, lesson, now: w.now, entry: again.entry, strings: STR.ko });
 assert.ok(!reopen.items.some((x) => r.today.items.some((y) => y.open.lineId && y.open.lineId === x.open.lineId)));
 assert.ok(!reopen.items.some((x) => x.open.type === 'game'));
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
