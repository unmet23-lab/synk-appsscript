// 「오늘」 한 장(11-14, 깃발 ?today=1 뒤)의 얇은 한 겹 — 계정 학습 기록(Atlas 사건 목록)에서 오늘 할 것을 짓는다. 화면은 이 꼴만 읽는다:
//   today = { speaker, line: {code, text}, minutes, items: [{ kind: 'again'|'new'|'check', title, why: {code, text, evidence}, minutes, open }], empty, firstDay }
//   after = { changed: [{ what, before, after }], tomorrow: [{ kind, title, when }] }
// 뒤에 새 엔진의 「오늘 할 것」으로 갈아 끼워도 화면은 같은 꼴을 읽는다. 지키는 것:
//  · 모든 까닭 글은 기록의 사실(줄 · 날짜 · 판정 갈래 · 몇 번)에서만 짓는다. 근거가 없으면 그 줄을 내지 않는다.
//  · 드라마 기록과 게임 기록을 한 기록으로 합치지 않는다 — 드라마 줄은 drama-s1 사건에서, 입장 검사 줄은 입장 검사의 재방문 맞춤
//    (entry-check/learning.mjs missedPractice가 낸 문장 그대로)에서 읽는다. C 차례는 Atlas 지연 관측(기록기 delayedDue)이 정한다.
//  · 태오 한 줄(line)은 드라마 장면의 사실만 말한다 — 태오는 1화 장면에 있었다. 입장 검사 기록은 줄 글(앱 글)로만 둔다(말 걸기 설계 규칙 2).
//  · 평가어 · 재촉 · 「내일 봐요」 같은 말이 없다(말 걸기 설계 E절). 시간 낱말은 학습일 차로 「어제」 · 「지난번」 — 학습일은 새벽 4시에
//    바뀐다(새 엔진과 같다 — 밤 12시를 넘겨 공부해도 30분 만에 「어제」가 되지 않게).
//  · 「했어요 · 물어봤어요 · 끝까지 했죠?」는 말한 기록(시도가 있는 차례)으로만 센다. 카드만 열고 나간 줄은 한 것이 아니다.
//  · 화면 글에 「테이크 2 · 통과 · 노트」 같은 촬영장 말을 쓰지 않는다 — 기록이 뜻하는 것을 쉬운 말로(설계 세션 11-14).
//  · 받아 적은 글 · 빠진 낱말은 기록에 없다 — 내가 한 말은 보이지 않고, 줄 · 무엇이 걸렸는지까지만 말한다.
import { AGAIN_PAIR, NEW_ORDER, YO_LINES, TAEO_CALL, TAEO_MEDIA, poolItem, lineTail } from './content.mjs';

export const GAME_ID = 'drama-s1';
const NOTES = ['note-ending', 'note-length', 'note-missing'];
const JUDGED = new Set(['pass', ...NOTES]);
const NOTE_RANK = { 'note-ending': 0, 'note-length': 1, 'note-missing': 2 };
const DAY = 86400000;
export const DAY_START_HOUR = 4;
export const MINUTES = Object.freeze({ situation: 1, retake: 1, scene: 3, entry: 3 });

// 학습일(그 기기의 시간대에서 새벽 4시에 바뀜). tzOffsetMin을 주면 그 차로(시험).
export function dayKey(ms, tzOffsetMin = null) {
 const t = ms - DAY_START_HOUR * 3600000;
 const d = new Date(tzOffsetMin == null ? t : t + tzOffsetMin * 60000);
 const [y, m, dd] = tzOffsetMin == null ? [d.getFullYear(), d.getMonth() + 1, d.getDate()] : [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
 return `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}
// 그 학습일이 시작한 시각(기기 시간대 새벽 4시) — 시험 · 시연 기록을 학습일 기준으로 심을 때.
export function dayStart(ms) { const d = new Date(ms - DAY_START_HOUR * 3600000); d.setHours(DAY_START_HOUR, 0, 0, 0); return d.getTime(); }
const dayNumber = (key) => Math.round(Date.parse(`${key}T00:00:00Z`) / DAY);
const daysBetween = (fromMs, toMs, tz) => dayNumber(dayKey(toMs, tz)) - dayNumber(dayKey(fromMs, tz));
// 말 걸기 설계 3절: 시간 낱말은 학습일 차로 — 하루 전은 「어제」, 그 앞은 「지난번」.
// 같은 학습일이면 「오늘」 — 같은 날 다시 열었을 때 오늘 한 일을 「지난번」이라 하지 않게.
const whenWord = (fromMs, nowMs, tz) => { const d = daysBetween(fromMs, nowMs, tz); return d <= 0 ? '오늘' : d === 1 ? '어제' : '지난번'; };
const whenCode = (fromMs, nowMs, tz) => { const d = daysBetween(fromMs, nowMs, tz); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : 'before'; };
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
// 말한 줄 = 시도가 하나라도 있는 차례(「했어요」의 근거). phase를 주면 그 차례만.
const spokenTurns = (turns, lineId, phase = null) => turns.filter((t) => t.lineId === lineId && (!phase || t.phase === phase) && t.attempts.length);
const spokeLine = (turns, lineId, phase = null) => spokenTurns(turns, lineId, phase).length > 0;
// 걸린 것을 쉬운 말로 — 끝맺음을 「반말 · '요'」로 부르는 것은 내용 표에 '요' 줄로 적은 줄(YO_LINES)에서만.
const isYo = (lineId) => YO_LINES.includes(lineId);
function noteSaid(kind, lineId) {
 if (kind === 'ending') return isYo(lineId) ? '라고 할 때 끝이 반말처럼 들렸어요.' : '라고 할 때 끝맺음이 대사와 다르게 들렸어요.';
 if (kind === 'length') return '라고 할 때 말이 짧게 끝났어요.';
 return '라고 할 때 꼭 들어가야 할 말이 하나 빠졌어요.';
}

/** 복습: 장면 줄 가운데 마지막 판정이 노트인 줄(오늘 전 날). 코치 노트를 받은 줄 → 끝맺음 · 길이 · 빠진 말 → 늦은 노트 → 줄 차례. */
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
 const yo = kind === 'ending' && isYo(c.line.id);
 const text = `${when} 「${tail}」${noteSaid(kind, c.line.id)}${c.retakePass ? ' 그 자리에서 다시 해서 고쳤어요.' : ''}`;
 const situation = c.open.type === 'situation';
 return {
  kind: 'again',
  title: situation ? c.pair.title : '1화에서 그 대사 한 번 더',
  why: { code: `again.${kind}${yo ? '.yo' : ''}${c.retakePass ? '.fixed' : ''}`, text,
   evidence: { lineId: c.line.id, skill: c.line.skill || null, choice: c.last.choice, at: new Date(c.noteAt).toISOString(), day: whenCode(c.noteAt, nowMs, tz), notes: c.notes, coached: c.coached, retakePass: c.retakePass, yo, attemptId: c.last.id } },
  minutes: situation ? MINUTES.situation : MINUTES.retake,
  open: c.open,
  note: kind,
  skills: [c.line.skill, situation && c.pair ? c.pair.skill : null].filter(Boolean),
 };
}

/**
 * 오늘 공부: 장면 학생 줄을 다 말하지 않았으면 장면, 다 했으면 B, B도 했으면 아직 안 해 본 처음 보는 대사.
 * 같은 날 같은 말하기가 둘 서지 않게 — 「복습」과 같은 능력(avoid)은 건너뛰고 다른 말하기를 고른다. 다른 것이 없으면 줄을 내지 않는다.
 */
function newItem({ turns, scene, lesson, nowMs, tz, skip, avoid = [] }) {
 const spokenScene = scene.filter((x) => spokeLine(turns, x.id, 'scene'));
 if (spokenScene.length < scene.length) {
  const sceneTurns = turns.filter((t) => t.phase === 'scene' && scene.some((x) => x.id === t.lineId));
  const lastAt = (sceneTurns.filter((t) => t.attempts.length).at(-1) || sceneTurns.at(-1))?.at;
  if (lastAt == null) return null;
  const when = whenWord(lastAt, nowMs, tz);
  const text = spokenScene.length ? `${when} 1화에서 내 대사 ${scene.length}개 중 ${spokenScene.length}개까지 했어요.` : `${when} 1화를 열어 보기만 했어요.`;
  return { kind: 'new', title: '1화 이어서 하기', minutes: MINUTES.scene, open: { type: 'scene' },
   why: { code: spokenScene.length ? 'new.scene' : 'new.scene.opened', text, evidence: { spoken: spokenScene.map((x) => x.id), at: new Date(lastAt).toISOString() } } };
 }
 const avoidSet = new Set(avoid);
 const B = lesson.transfer;
 if (B && !spokeLine(turns, B.id) && B.id !== skip && !avoidSet.has(B.skill)) {
  const ask = scene.find((x) => x.skill === B.skill) || null;
  const at = ask ? spokenTurns(turns, ask.id, 'scene').at(-1)?.at : null;
  return { kind: 'new', title: '같은 과 다른 선배에게 길 묻기', minutes: MINUTES.situation, open: { type: 'situation', lineId: B.id, source: 'transfer' },
   why: { code: 'new.transfer', text: at != null ? `${whenWord(at, nowMs, tz)} 1화에서 선배에게 도서관이 어디 있는지 물어봤죠. 오늘은 처음 보는 선배에게 다른 곳을 물어봐요.` : '1화 다음에 이어지는 새 상황이에요.',
    evidence: { lineId: B.id, spoken: false, skill: B.skill || null, like: ask?.id || null, likeAt: at != null ? new Date(at).toISOString() : null } } };
 }
 for (const id of NEW_ORDER) {
  if (id === skip || spokeLine(turns, id) || id === lesson.delayed?.id) continue;
  const item = poolItem(id); if (!item || avoidSet.has(item.skill)) continue;
  const like = scene.find((x) => x.id === item.like) || null;
  const tail = like ? lineTail(like.text, like.id) : '';
  const said = Boolean(like) && spokeLine(turns, like.id, 'scene');
  const text = said ? `처음 해 보는 상황이에요. 1화의 「${tail}」${josa(tail, '과/와')} 비슷한 말이에요.` : '처음 해 보는 상황이에요.';
  return { kind: 'new', title: item.title, minutes: MINUTES.situation, open: { type: 'situation', lineId: id },
   why: { code: said ? 'new.pool.like' : 'new.pool', text, evidence: { lineId: id, spoken: false, skill: item.skill, like: said ? like.id : null } } };
 }
 return null;
}

/** 점검: C 차례(기록기 delayedDue — 지금 첫 화면 카드와 같은 조건) → 입장 검사 재방문 맞춤(문장 그대로). */
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
  return { kind: 'check', title: v.name ? `입장 검사 게임 · ${v.name} 근무` : '입장 검사 게임 한 판', minutes: MINUTES.entry, open: { type: 'game', game: 'entry', venueId: v.id || null },
   why: { code: `check.entry.${entry.patternId}`, text: entry.why, next: entry.next || null, evidence: { game: 'entry-check', patternId: entry.patternId, misses: entry.misses, seen: entry.seen, evidenceIds: entry.evidenceIds || [], targetId: entry.targetId || null, itemKey: entry.itemKey || null } } };
 }
 return null;
}

// 태오 한 줄 — 드라마 장면의 사실만(입장 검사는 말하지 않는다). 사람이 나를 기억하고 말 거는 맛이 나게, 복습 줄은 그 장면의 일을
// 되부른다(그 줄을 말한 기록이 있을 때만 — 복습 줄은 늘 판정된 시도가 있다). 틀은 정해 두고 빈칸이 없다(목소리 · 입 맞는 영상을 틀마다 미리 굽게).
export const TAEO_LINES = Object.freeze({
 ...Object.fromEntries(Object.entries(TAEO_CALL).flatMap(([id, call]) => [[`again.call.${id}`, call.text], [`again.call.${id}.yo`, `${call.text} 이번엔 끝에 '요'까지 붙여서요.`]])),
 'again.other': '그때 했던 말, 오늘은 다른 곳에서 한 번 더 해 봐요.',
 'again.retake': '그때 했던 대사, 오늘 한 번 더 해 봐요.',
 'new.scene': '하던 데서 이어서 해요.',
 'new.situation': '1화는 끝까지 했죠? 오늘은 새로운 상황이에요.',
 'check.delayed': '며칠 전에 했던 말, 오늘은 처음 보는 곳에서 해 봐요.',
 plain: '왔어요? 오늘은 짧게 해요.',
 empty: '오늘은 새로 할 게 없어요. 2화가 열리면 동아리 박람회부터 해요.',
});
function taeoLine(items) {
 const first = items[0];
 let code = 'plain';
 if (!first) code = 'empty';
 else if (first.kind === 'again') {
  const id = first.why.evidence.lineId;
  if (first.open.type === 'retake') code = 'again.retake';
  else if (TAEO_CALL[id]) code = `again.call.${id}${first.why.evidence.yo ? '.yo' : ''}`;
  else code = 'again.other';
 } else if (first.kind === 'new') code = first.open.type === 'scene' ? 'new.scene' : 'new.situation';
 else if (first.kind === 'check' && first.open.source === 'delayed') code = 'check.delayed';
 // 목소리 · 입 맞는 영상을 끼울 자리 — 구운 틀만 content.mjs TAEO_MEDIA에 적힌다(없으면 듣는 고리 영상 + 글).
 return { code, text: TAEO_LINES[code], media: TAEO_MEDIA[code] || null };
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
 const fresh = newItem({ turns, scene, lesson: lesson || {}, nowMs: now, tz, skip: again?.open.lineId, avoid: again?.skills || [] });
 if (fresh) items.push(fresh);
 const check = checkItem({ turns, lesson: lesson || {}, delayedDue, entry, nowMs: now, tz, today, entryToday, strings });
 if (check) items.push(check);
 const line = taeoLine(items);
 return { ...base, firstDay: false, line, minutes: items.reduce((s, x) => s + x.minutes, 0), items,
  empty: items.length ? null : { code: 'empty', text: '오늘 할 것은 다 했어요. 2화가 열리면 여기에 이어서 나와요.' } };
}

// 끝 화면 — 무엇이 · 어땠는데(전) → 오늘(후). 촬영장 말(노트 · 테이크) 없이.
const NOTE_LABEL = { ending: '끝맺음', length: '말 길이', missing: '빠진 말' };
const NOTE_BEFORE = { ending: '의 끝맺음이 다르게 들렸어요', length: '라고 할 때 말이 짧게 끝났어요', missing: '라고 할 때 빠진 말이 있었어요' };
const PATTERN_LABEL = { detail: '표와 짐의 세부 내용 확인', negation: '안내문의 부정 표현 확인', condition: '안내문의 조건 확인' };

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
    const yo = item.note === 'ending' && ev.yo;
    changed.push({ what: yo ? "끝에 '요' 붙이기" : NOTE_LABEL[item.note] || '그 대사', before: `${ev.day === 'yesterday' ? '어제는' : '지난번엔'} 「${lineTail(scene?.text, ev.lineId)}」${yo ? '의 끝이 반말처럼 들렸어요' : NOTE_BEFORE[item.note] || ''}`, after: item.open.type === 'retake' ? '오늘은 장면에서 해냈어요' : '오늘은 처음 보는 상황에서 해냈어요' });
   } else if (item.kind === 'new' && tried) {
    changed.push({ what: item.title, before: '아직 안 해 본 상황이었어요', after: last?.choice === 'pass' ? '처음 보는 상황에서 해냈어요' : '처음 보는 상황에서 말해 봤어요' });
   } else if (item.kind === 'check' && last?.choice === 'pass') {
    changed.push({ what: item.title, before: item.why.evidence.days != null ? `${item.why.evidence.days}일 전에 새 상황에서 처음 해 봤어요` : '며칠 전에 새 상황에서 처음 해 봤어요', after: '오늘은 다른 곳에서도 해냈어요' });
   }
  } else if (item.open.type === 'scene') {
   // 오늘 말한 장면 줄이 있으면: 그 전까지 말한 줄 → 지금까지 말한 줄(모두면 「끝까지」).
   const scene = (lesson?.scene || []).filter((x) => x.type === 'student');
   const prior = item.why.evidence.spoken || [];
   const todaySpoken = scene.filter((x) => spokeLine(turns, x.id, 'scene')).map((x) => x.id);
   if (todaySpoken.length) {
    const all = new Set([...prior, ...todaySpoken]).size;
    changed.push({ what: '1화', before: prior.length ? `내 대사 ${scene.length}개 중 ${prior.length}개까지 했어요` : '열어 보기만 했어요', after: all >= scene.length ? '오늘 끝까지 했어요' : `오늘 ${all}개까지 했어요` });
   }
  } else if (item.open.type === 'game' && item.open.game === 'entry' && entryTarget?.itemKey) {
   const hit = entryHit(events, entryTarget.itemKey, startAt);
   // 그 놓침이 한 근무 안이라는 근거는 없다 — 근거 그대로 「최근 몇 번 가운데 몇 번」(설계 세션 11-14).
   if (hit === true) changed.push({ what: PATTERN_LABEL[item.why.evidence.patternId] || '입장 검사 게임', before: `최근 ${item.why.evidence.seen}번 중 ${item.why.evidence.misses}번 놓쳤어요`, after: '오늘은 그런 손님을 맞혔어요' });
  }
 }
 // 내일 할 것 = 같은 규칙을 내일 날짜로 다시 돌린 결과(지어내지 않는다) + 오늘 혼자 해 본 새 상황 B의 나중 확인.
 // 나중 확인이 며칠 뒤인지는 쓰지 않는다 — 유호님이 11-14 「3일로」 정해 다른 세션이 바꾸는 중이라, 숫자를 적으면 곧 틀린 말이 된다.
 const next = buildToday({ events, lesson, now: now + DAY, delayedDue: null, entry: entryAfter, strings, tzOffsetMin: tz });
 const tomorrow = next.items.map((x) => ({ kind: x.kind, title: x.title, when: '내일' }));
 const B = lesson?.transfer;
 const soloB = B && turns.some((t) => t.lineId === B.id && t.phase === 'transfer' && t.attempts.some((a) => a.verdict === 'correct' || a.verdict === 'incorrect'));
 if (soloB && lesson?.delayed) tomorrow.push({ kind: 'check', title: strings.delayedTitle || '지난번 그 말, 다른 곳에서', when: '며칠 뒤' });
 return { changed, tomorrow };
}

// 카드를 누르면 펼쳐지는 근거 — 앱이 기록에서 본 것을 평범한 문장으로. 시각은 기기 시간대.
const NOTE_PROOF = { ending: '끝맺음이 다르게 들린 적이', length: '말이 짧게 끝난 적이', missing: '빠진 말이 있었던 적이' };
export function proofLine(it) {
 const e = it.why.evidence;
 const at = (iso) => { const d = new Date(iso); const hh = d.getHours(); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hh < 12 ? '오전' : hh < 18 ? '오후' : '밤'} ${hh % 12 || 12}시`; };
 const nth = (id) => String(id).split('-').pop();
 if (it.kind === 'again') {
  const after = e.coached && e.retakePass ? ' 코치가 짚어 줬고, 그 자리에서 다시 해서 고쳤어요.' : e.coached ? ' 코치가 짚어 줬어요.' : e.retakePass ? ' 그 자리에서 다시 해서 고쳤어요.' : '';
  return `${at(e.at)}, 1화 ${nth(e.lineId)}번째 대사에서 ${e.yo ? '끝이 반말처럼 들린 적이' : NOTE_PROOF[it.note] || '걸린 적이'} ${e.notes}번 있어요.${after}`;
 }
 if (it.why.code === 'new.transfer') return e.likeAt ? `${at(e.likeAt)}에 1화 ${nth(e.like)}번째 대사에서 길을 물어봤어요. 이 상황은 아직 안 해 봤어요.` : '이 상황은 아직 안 해 봤어요.';
 if (it.why.code.startsWith('new.scene')) return `${at(e.at)}까지 내 대사 ${e.spoken.length}개를 말했어요.`;
 if (it.why.code.startsWith('new.pool')) return '이 상황은 아직 안 해 봤어요.';
 if (it.why.code === 'check.delayed') return e.days != null ? `${e.days}일 전에 새 상황을 혼자 해 봤어요. 이 확인은 한 번만 나와요.` : '이 확인은 한 번만 나와요.';
 if (it.why.code.startsWith('check.entry')) return `입장 검사 게임에서 최근 ${e.seen}번 중 ${e.misses}번 놓쳤어요. 오늘 근무에 그런 손님이 한 명 와요.`;
 return '';
}

// 약속한 손님을 오늘 맞혔나: 그 손님(itemKey)의 보임 뒤 첫 시도의 판정. 없으면 null.
function entryHit(events, itemKey, startAt) {
 const list = Array.isArray(events) ? events : [];
 const shown = list.filter((e) => e?.type === 'practice.presented' && e.itemKey === itemKey && Date.parse(e.at) >= startAt).map((e) => e.id);
 const first = list.filter((e) => e?.type === 'practice.attempted' && shown.includes(e.presentationId)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];
 return first ? first.verdict === 'correct' : null;
}
