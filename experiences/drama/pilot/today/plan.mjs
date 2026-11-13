// 「오늘」 한 장(11-14, 깃발 ?today=1 뒤)의 얇은 한 겹 — 계정 학습 기록(Atlas 사건 목록)에서 오늘 할 것을 짓는다. 화면은 이 꼴만 읽는다:
//   today = { speaker, line: {code, text}, minutes, items: [{ kind: 'again'|'new'|'check', title, why: {code, text, evidence}, minutes, open }], empty, firstDay }
//   after = { changed: [{ what, before, after }], tomorrow: [{ kind, title, when }] }
// 뒤에 새 엔진의 「오늘 할 것」으로 갈아 끼워도 화면은 같은 꼴을 읽는다. 지키는 것:
//  · 모든 까닭 글은 기록의 사실(줄 · 날짜 · 판정 갈래 · 몇 번)에서만 짓는다. 근거가 없으면 그 줄을 내지 않는다.
//  · 드라마 기록과 게임 기록을 한 기록으로 합치지 않는다 — 드라마 줄은 drama-s1 사건에서, 입장 검사 줄은 입장 검사의 재방문 맞춤
//    (entry-check/learning.mjs missedPractice가 낸 문장 그대로)에서 읽는다. C 차례는 Atlas 지연 관측(기록기 delayedDue)이 정한다.
//  · 태오 한 줄(line)은 드라마 장면의 사실만 말한다 — 태오는 1화 장면에 있었다. 입장 검사 기록은 줄 글(앱 글)로만 둔다(말 걸기 설계 규칙 2).
//  · 평가어 · 재촉 · 「내일 봐요」 같은 말이 없다(말 걸기 설계 E절). 시간 낱말은 기기 날짜 차로 「어제」 · 「지난번」.
//  · 받아 적은 글 · 빠진 낱말은 기록에 없다 — 내가 한 말은 보이지 않고, 줄 · 노트 종류까지만 말한다.
import { AGAIN_PAIR, NEW_ORDER, poolItem, lineTail } from './content.mjs';

export const GAME_ID = 'drama-s1';
const NOTES = ['note-ending', 'note-length', 'note-missing'];
const JUDGED = new Set(['pass', ...NOTES]);
const NOTE_RANK = { 'note-ending': 0, 'note-length': 1, 'note-missing': 2 };
const DAY = 86400000;
export const MINUTES = Object.freeze({ situation: 1, retake: 1, scene: 3, entry: 3 });

// 기기 날짜(그 기기의 시간대). tzOffsetMin을 주면 그 차로(시험).
export function dayKey(ms, tzOffsetMin = null) {
 const d = new Date(tzOffsetMin == null ? ms : ms + tzOffsetMin * 60000);
 const [y, m, dd] = tzOffsetMin == null ? [d.getFullYear(), d.getMonth() + 1, d.getDate()] : [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
 return `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}
const dayNumber = (key) => Math.round(Date.parse(`${key}T00:00:00Z`) / DAY);
const daysBetween = (fromMs, toMs, tz) => dayNumber(dayKey(toMs, tz)) - dayNumber(dayKey(fromMs, tz));
// 말 걸기 설계 3절: 시간 낱말은 기기 날짜 차로 — 하루 전은 「어제」, 그 앞은 「지난번」.
const whenWord = (fromMs, nowMs, tz) => (daysBetween(fromMs, nowMs, tz) === 1 ? '어제' : '지난번');
const whenCode = (fromMs, nowMs, tz) => (daysBetween(fromMs, nowMs, tz) === 1 ? 'yesterday' : 'before');
// 받침으로 와/과 · 을/를 · 은/는.
function josa(word, pair) {
 const c = String(word).replace(/[^가-힣]/g, '').slice(-1);
 const has = c ? (c.charCodeAt(0) - 0xac00) % 28 !== 0 : false;
 const [a, b] = pair.split('/');
 return has ? a : b;
}

/** 계정 기록(모든 게임이 같이 쓰는 log)에서 드라마 차례를 읽는다. 차례 = 보임 하나(장면 줄 · 테이크 2 · 새 상황). */
export function readTurns(events, gameId = GAME_ID) {
 const list = Array.isArray(events) ? events : [];
 const excluded = new Set(list.filter((e) => e?.type === 'record.excluded').map((e) => e.targetId));
 const decisions = new Set(list.filter((e) => e?.type === 'decision.made' && e.experienceId === gameId && !excluded.has(e.id)).map((e) => e.id));
 const turns = new Map();
 for (const e of list) {
  if (e?.type !== 'practice.presented' || !decisions.has(e.decisionId) || excluded.has(e.id)) continue;
  const m = /^[a-zA-Z0-9_-]+\.(scene|retake|transfer)\.(.+)$/.exec(String(e.taskId || ''));
  if (!m) continue;
  turns.set(e.id, { id: e.id, phase: m[1], lineId: m[2], at: Date.parse(e.at), attempts: [], helps: new Set() });
 }
 for (const e of list) {
  const t = turns.get(e?.presentationId);
  if (!t || excluded.has(e.id)) continue;
  if (e.type === 'practice.helped') t.helps.add(e.helpId);
  else if (e.type === 'practice.attempted') t.attempts.push({ id: e.id, at: Date.parse(e.at), n: e.attemptNo, verdict: e.verdict, choice: e.choice?.selectedId || null });
 }
 const out = [...turns.values()].sort((a, b) => a.at - b.at);
 for (const t of out) t.attempts.sort((a, b) => a.at - b.at || a.n - b.n);
 return out;
}
const judgedOf = (turn) => turn.attempts.filter((a) => JUDGED.has(a.choice));
const lastJudged = (turns) => turns.flatMap((t) => judgedOf(t).map((a) => ({ ...a, turn: t }))).sort((a, b) => a.at - b.at).at(-1) || null;
const seenLine = (turns, lineId) => turns.some((t) => t.lineId === lineId);

/** 다시 만날 말: 장면 줄 가운데 마지막 판정이 노트인 줄(오늘 전 날). 코치 노트를 받은 줄 → 끝맺음 · 길이 · 빠진 말 → 늦은 노트 → 줄 차례. */
function againItem({ turns, scene, nowMs, tz, today }) {
 const cands = [];
 scene.forEach((line, order) => {
  const sceneTurns = turns.filter((t) => t.lineId === line.id && t.phase === 'scene');
  const last = lastJudged(sceneTurns);
  if (!last || !NOTES.includes(last.choice) || dayKey(last.at, tz) >= today) return;
  const noteAt = last.at;
  const coached = sceneTurns.some((t) => t.helps.has('explanation'));
  const retakePass = turns.some((t) => t.lineId === line.id && t.phase === 'retake' && t.at >= noteAt && judgedOf(t).at(-1)?.choice === 'pass');
  const notes = sceneTurns.flatMap((t) => judgedOf(t)).filter((a) => a.choice === last.choice).length;
  const pairId = AGAIN_PAIR[line.id] || null, pair = poolItem(pairId);
  const pairTurns = turns.filter((t) => t.lineId === pairId && t.phase === 'transfer' && t.at >= noteAt);
  const pairLast = lastJudged(pairTurns);
  let open;
  if (pair && !pairTurns.length) open = { type: 'situation', lineId: pairId };
  else if (pairLast?.choice === 'pass') return; // 처음 보는 상황에서 해냈다 — 다시 낼 까닭이 없다
  else if (pairTurns.length && pairTurns.every((t) => dayKey(t.at, tz) >= today)) return; // 오늘 이미 했다(결과는 끝 화면이 말한다)
  else {
   // 짝을 해 봤는데 아직이면 그 줄을 장면에서 한 번 더(테이크 2처럼). 짝 뒤에 다시 해서 통과했으면 끝.
   const since = pairTurns.at(-1)?.at ?? noteAt;
   const again = turns.filter((t) => t.lineId === line.id && t.phase === 'retake' && t.at > since);
   if (lastJudged(again)?.choice === 'pass') return;
   if (again.some((t) => dayKey(t.at, tz) >= today)) return;
   open = { type: 'retake', lineId: line.id };
  }
  cands.push({ line, order, last, noteAt, coached, retakePass, notes, open, pair });
 });
 cands.sort((a, b) => (b.coached - a.coached) || (NOTE_RANK[a.last.choice] - NOTE_RANK[b.last.choice]) || (b.noteAt - a.noteAt) || (a.order - b.order));
 const c = cands[0];
 if (!c) return null;
 const kind = c.last.choice.slice(5), when = whenWord(c.noteAt, nowMs, tz), tail = lineTail(c.line.text, c.line.id);
 const said = kind === 'ending' ? `끝 '요' 노트를 받았어요.` : kind === 'length' ? '말이 짧다는 노트를 받았어요.' : '꼭 들어갈 말이 빠졌다는 노트를 받았어요.';
 const text = `${when} 「…${tail}」에서 ${said}${c.retakePass ? ' 테이크 2에서는 통과했어요.' : ''}`;
 const situation = c.open.type === 'situation';
 return {
  kind: 'again',
  title: situation ? c.pair.title : '1화 장면에서 그 줄 한 번 더',
  why: { code: `again.${kind}${c.retakePass ? '.fixed' : ''}`, text,
   evidence: { lineId: c.line.id, choice: c.last.choice, at: new Date(c.noteAt).toISOString(), day: whenCode(c.noteAt, nowMs, tz), notes: c.notes, coached: c.coached, retakePass: c.retakePass, attemptId: c.last.id } },
  minutes: situation ? MINUTES.situation : MINUTES.retake,
  open: c.open,
  note: kind,
 };
}

/** 새로 할 것: 장면을 다 못 했으면 장면, 했으면 B, B도 했으면 아직 안 본 처음 보는 대사. */
function newItem({ turns, scene, lesson, nowMs, tz, skip }) {
 const seenScene = scene.filter((x) => seenLine(turns, x.id));
 if (seenScene.length < scene.length) {
  const lastAt = turns.filter((t) => scene.some((x) => x.id === t.lineId)).at(-1)?.at;
  if (lastAt == null) return null;
  return { kind: 'new', title: '1화 장면 끝까지', minutes: MINUTES.scene, open: { type: 'scene' },
   why: { code: 'new.scene', text: `${whenWord(lastAt, nowMs, tz)} 1화 장면에서 ${scene.length}줄 가운데 ${seenScene.length}줄까지 했어요.`, evidence: { seen: seenScene.map((x) => x.id), at: new Date(lastAt).toISOString() } } };
 }
 const B = lesson.transfer;
 if (B && !seenLine(turns, B.id) && B.id !== skip) {
  const ask = scene.find((x) => x.skill === B.skill) || null;
  const at = turns.filter((t) => t.lineId === ask?.id).at(-1)?.at;
  return { kind: 'new', title: '같은 과 다른 선배에게 길 묻기', minutes: MINUTES.situation, open: { type: 'situation', lineId: B.id, source: 'transfer' },
   why: { code: 'new.transfer', text: ask && at != null ? `${whenWord(at, nowMs, tz)} 1화에서 선배에게 위치를 물어봤어요. 이번엔 처음 보는 선배에게, 다른 곳을.` : '장면 뒤에 오는 새 상황을 아직 안 했어요.',
    evidence: { lineId: B.id, seen: false, like: ask?.id || null, likeAt: at != null ? new Date(at).toISOString() : null } } };
 }
 for (const id of NEW_ORDER) {
  if (id === skip || seenLine(turns, id) || id === lesson.delayed?.id) continue;
  const item = poolItem(id); if (!item) continue;
  const like = scene.find((x) => x.id === item.like) || null;
  const tail = like ? lineTail(like.text, like.id) : '';
  const text = like && seenLine(turns, like.id) ? `아직 안 해 본 상황이에요. 1화 「…${tail}」${josa(tail, '과/와')} 같은 말하기예요.` : '아직 안 해 본 상황이에요.';
  return { kind: 'new', title: item.title, minutes: MINUTES.situation, open: { type: 'situation', lineId: id },
   why: { code: like ? 'new.pool.like' : 'new.pool', text, evidence: { lineId: id, seen: false, like: like?.id || null } } };
 }
 return null;
}

/** 확인할 곳: C 차례(기록기 delayedDue — 지금 첫 화면 카드와 같은 조건) → 입장 검사 재방문 맞춤(문장 그대로). */
function checkItem({ turns, lesson, delayedDue, entry, nowMs, tz, today, entryToday, strings }) {
 const C = lesson.delayed;
 if (C && delayedDue === true && !seenLine(turns, C.id)) {
  const B = lesson.transfer;
  const solo = turns.filter((t) => t.lineId === B?.id && t.phase === 'transfer').flatMap((t) => t.attempts).find((a) => a.verdict === 'correct' || a.verdict === 'incorrect');
  return { kind: 'check', title: strings.delayedTitle, minutes: MINUTES.situation, open: { type: 'situation', lineId: C.id, source: 'delayed' },
   why: { code: 'check.delayed', text: strings.delayedLead, evidence: { lineId: B?.id || null, at: solo ? new Date(solo.at).toISOString() : null, days: solo ? daysBetween(solo.at, nowMs, tz) : null, followup: 'd7' } } };
 }
 if (entry && !entryToday) {
  const v = entry.venue || {};
  return { kind: 'check', title: v.name ? `입장 검사 · ${v.day}일차 ${v.name}` : '입장 검사 한 근무', minutes: MINUTES.entry, open: { type: 'game', game: 'entry', venueId: v.id || null },
   why: { code: `check.entry.${entry.patternId}`, text: entry.why, next: entry.next || null, evidence: { game: 'entry-check', patternId: entry.patternId, misses: entry.misses, seen: entry.seen, evidenceIds: entry.evidenceIds || [], targetId: entry.targetId || null, itemKey: entry.itemKey || null } } };
 }
 return null;
}

// 태오 한 줄 — 드라마 장면의 사실만(입장 검사는 말하지 않는다). 문장 틀은 정해 두고 빈칸이 없다(목소리를 미리 구울 수 있게).
export const TAEO_LINES = Object.freeze({
 'again.ending.yesterday': "어제 그 말, 끝에 '요'만 붙이면 돼요.",
 'again.ending.before': "지난번 그 말, 끝에 '요'만 붙이면 돼요.",
 'again.other.yesterday': '어제 그 말, 오늘 다른 데서 한 번 더 해요.',
 'again.other.before': '지난번 그 말, 오늘 다른 데서 한 번 더 해요.',
 'again.retake.yesterday': '어제 그 말, 오늘 한 번 더 해 봐요.',
 'again.retake.before': '지난번 그 말, 오늘 한 번 더 해 봐요.',
 'new.scene.yesterday': '어제 하던 데서 이어서 가요.',
 'new.scene.before': '지난번 하던 데서 이어서 가요.',
 'new.situation': '1화 끝까지 했죠? 오늘은 새 상황이에요.',
 'check.delayed': '지난번 그 말, 오늘은 처음 보는 데서 해요.',
 plain: '왔어요? 오늘은 짧게 가요.',
 empty: '오늘은 새로 할 게 없어요. 2화가 열리면 박람회부터예요.',
});
function taeoLine(items, nowMs, tz) {
 const first = items[0];
 let code = 'plain';
 if (!first) code = 'empty';
 else if (first.kind === 'again') code = `again.${first.open.type === 'retake' ? 'retake' : first.note === 'ending' ? 'ending' : 'other'}.${first.why.evidence.day}`;
 else if (first.kind === 'new') code = first.open.type === 'scene' ? `new.scene.${whenCode(Date.parse(first.why.evidence.at), nowMs, tz)}` : 'new.situation';
 else if (first.kind === 'check' && first.open.source === 'delayed') code = 'check.delayed';
 return { code, text: TAEO_LINES[code] };
}

/**
 * input: { events(계정 log), lesson(world-lesson.json의 lesson), now(ms), delayedDue(기록기 — true|false|null), entry(입장 검사 재방문 맞춤 | null),
 *          strings({delayedTitle, delayedLead} — 드라마 화면 글), tzOffsetMin? }
 */
export function buildToday({ events, lesson, now = Date.now(), delayedDue = null, entry = null, strings = {}, tzOffsetMin = null } = {}) {
 const tz = tzOffsetMin;
 const turns = readTurns(events);
 const scene = (lesson?.scene || []).filter((x) => x.type === 'student');
 const today = dayKey(now, tz);
 const before = turns.filter((t) => dayKey(t.at, tz) < today);
 const base = { speaker: 'taeo', asOf: new Date(now).toISOString() };
 // 첫날(오늘 전 드라마 기록이 없음)은 지금 흐름 그대로 — 「오늘」을 내지 않는다.
 if (!before.length) return { ...base, firstDay: true, line: null, minutes: 0, items: [], empty: null };
 const entryToday = (Array.isArray(events) ? events : []).some((e) => e?.type === 'decision.made' && e.experienceId === 'entry-check' && dayKey(Date.parse(e.at), tz) >= today);
 const items = [];
 const again = againItem({ turns, scene, nowMs: now, tz, today });
 if (again) items.push(again);
 const fresh = newItem({ turns, scene, lesson: lesson || {}, nowMs: now, tz, skip: again?.open.lineId });
 if (fresh) items.push(fresh);
 const check = checkItem({ turns, lesson: lesson || {}, delayedDue, entry, nowMs: now, tz, today, entryToday, strings });
 if (check) items.push(check);
 const line = taeoLine(items, now, tz);
 return { ...base, firstDay: false, line, minutes: items.reduce((s, x) => s + x.minutes, 0), items,
  empty: items.length ? null : { code: 'empty', text: '오늘 할 것은 다 했어요. 2화가 열리면 여기에 이어서 보여요.' } };
}

const NOTE_LABEL = { ending: "끝 '요'", length: '말 길이', missing: '꼭 들어갈 말' };
const PATTERN_LABEL = { detail: '세부 내용 맞추기', negation: '부정 표현 맞추기', condition: '조건 맞추기' };

/**
 * 끝난 뒤 「오늘의 기록」에 더할 것. start: 버튼을 누를 때의 today(그때 근거를 그대로 쓴다), startAt: 누른 시각.
 * entryAfter: 지금 다시 읽은 입장 검사 재방문 맞춤(내일 줄), entryTarget: { itemKey } — 약속한 손님(근무를 연 때 읽은 것).
 */
export function buildAfter({ events, lesson, start, startAt, now = Date.now(), delayedDue = null, entryAfter = null, entryTarget = null, strings = {}, tzOffsetMin = null } = {}) {
 const tz = tzOffsetMin;
 const turns = readTurns(events).filter((t) => t.at >= startAt);
 const changed = [];
 for (const item of start?.items || []) {
  if (item.open.type === 'situation' || item.open.type === 'retake') {
   const phase = item.open.type === 'retake' ? 'retake' : 'transfer';
   const last = lastJudged(turns.filter((t) => t.lineId === item.open.lineId && t.phase === phase));
   const tried = turns.some((t) => t.lineId === item.open.lineId && t.phase === phase && t.attempts.length);
   if (item.kind === 'again') {
    if (last?.choice !== 'pass') continue;
    const ev = item.why.evidence, scene = (lesson?.scene || []).find((x) => x.id === ev.lineId);
    changed.push({ what: NOTE_LABEL[item.note] || '그 줄', before: `${ev.day === 'yesterday' ? '어제' : '지난번'} 「…${lineTail(scene?.text, ev.lineId)}」 노트`, after: item.open.type === 'retake' ? '오늘 장면에서 해냄' : '오늘 처음 보는 상황에서 해냄' });
   } else if (item.kind === 'new' && tried) {
    changed.push({ what: item.title, before: '안 해 본 상황', after: last?.choice === 'pass' ? '처음 보는 상황에서 해냄' : '처음 보는 상황에서 말해 봄' });
   } else if (item.kind === 'check' && last?.choice === 'pass') {
    changed.push({ what: item.title, before: item.why.evidence.days != null ? `${item.why.evidence.days}일 전 새 상황` : '며칠 전 새 상황', after: '다른 곳에서도 해냄' });
   }
  } else if (item.open.type === 'scene') {
   const scene = (lesson?.scene || []).filter((x) => x.type === 'student');
   const done = scene.filter((x) => turns.some((t) => t.lineId === x.id && t.phase === 'scene')).length;
   if (done) changed.push({ what: '1화 장면', before: `${item.why.evidence.seen.length}줄까지`, after: '오늘 끝까지' });
  } else if (item.open.type === 'game' && item.open.game === 'entry' && entryTarget?.itemKey) {
   const hit = entryHit(events, entryTarget.itemKey, startAt);
   if (hit === true) changed.push({ what: PATTERN_LABEL[item.why.evidence.patternId] || '입장 검사', before: `지난 근무에서 ${item.why.evidence.misses}번 놓침`, after: '오늘 그런 손님을 맞힘' });
  }
 }
 // 내일 돌아올 것 = 같은 규칙을 내일 날짜로 다시 돌린 결과(지어내지 않는다) + 오늘 혼자 해 본 새 상황 B의 7일 뒤 확인.
 const next = buildToday({ events, lesson, now: now + DAY, delayedDue: null, entry: entryAfter, strings, tzOffsetMin: tz });
 const tomorrow = next.items.map((x) => ({ kind: x.kind, title: x.title, when: '내일' }));
 const B = lesson?.transfer;
 const soloB = B && turns.some((t) => t.lineId === B.id && t.phase === 'transfer' && t.attempts.some((a) => a.verdict === 'correct' || a.verdict === 'incorrect'));
 if (soloB && lesson?.delayed) tomorrow.push({ kind: 'check', title: strings.delayedTitle || '지난번 그 말, 다른 곳에서', when: '7일 뒤' });
 return { changed, tomorrow };
}

// 약속한 손님을 오늘 맞혔나: 그 손님(itemKey)의 보임 뒤 첫 시도의 판정. 없으면 null.
function entryHit(events, itemKey, startAt) {
 const list = Array.isArray(events) ? events : [];
 const shown = list.filter((e) => e?.type === 'practice.presented' && e.itemKey === itemKey && Date.parse(e.at) >= startAt).map((e) => e.id);
 const first = list.filter((e) => e?.type === 'practice.attempted' && shown.includes(e.presentationId)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];
 return first ? first.verdict === 'correct' : null;
}
