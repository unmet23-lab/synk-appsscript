// 「오늘」 한 장(11-14, 깃발 ?today=1 뒤)의 얇은 한 겹 — 계정 학습 기록(Atlas 사건 목록)에서 오늘 할 것을 짓는다. 화면은 이 꼴만 읽는다:
//   today = { speaker, line: {code, text}, minutes, items: [{ kind: 'again'|'new'|'check', title, why: {code, text, evidence}, minutes, open }], empty, firstDay }
//   after = { changed: [{ what, before, after }], line: { code: 'done', text, media }, tomorrow: [{ kind, title, name, when, date: { year, month, day, weekday } }] } — date는 일력의 다음 장 번호(11-16),
//     name은 오늘 장면 판과 같은 이름 { place, who, action }(content.mjs nameFor, 11-18 — 모르는 꼴이면 null이고 화면은 title을 쓴다)
// 뒤에 새 엔진의 「오늘 할 것」으로 갈아 끼워도 화면은 같은 꼴을 읽는다. 지키는 것:
//  · 모든 까닭 글은 기록의 사실(줄 · 날짜 · 판정 갈래 · 몇 번)에서만 짓는다. 근거가 없으면 그 줄을 내지 않는다.
//  · 드라마 기록과 게임 기록을 한 기록으로 합치지 않는다 — 드라마 줄은 drama-s1 사건에서, 입장 검사 줄은 입장 검사의 재방문 맞춤
//    (entry-check/learning.mjs missedPractice가 낸 문장 그대로)에서 읽는다.
//  · 복습과 나중 확인(C)은 드라마 첫 화면과 같은 3일 규칙으로 정한다(11-15, 결정 11-14 「3일로」 · 드라마 설계 §18). 기록기 review()가 읽은
//    재료를 첫 화면과 같은 함수(takes.mjs planRevisit)에 넣는다. 틀린 대사는 장면과 복습의 첫 판정으로 세고, 테이크 2는 세지 않는다.
//    복습 줄은 첫 화면의 「틀린 장면 복습」(pilot.mjs runReview — 빈칸 카드와 튜터 근거)을 연다. 그래서 「오늘」에서 한 복습도 3일 규칙에 같이 센다.
//  · 태오 한 줄(line)은 드라마 장면의 사실만 말한다 — 태오는 1화 장면에 있었다. 입장 검사 기록은 줄 글(앱 글)로만 둔다(말 걸기 설계 규칙 2).
//  · 평가어 · 재촉 · 「내일 봐요」 같은 말이 없다(말 걸기 설계 E절). 시간 낱말은 학습일 차로 「어제」 · 「지난번」 — 학습일은 새벽 4시에
//    바뀐다(새 엔진과 같다 — 밤 12시를 넘겨 공부해도 30분 만에 「어제」가 되지 않게).
//  · 「했어요 · 물어봤어요 · 끝까지 했죠?」는 말한 기록(시도가 있는 차례)으로만 센다. 카드만 열고 나간 줄은 한 것이 아니다.
//  · 화면 글에 「테이크 2 · 통과 · 노트」 같은 촬영장 말을 쓰지 않는다 — 기록이 뜻하는 것을 쉬운 말로(설계 세션 11-14).
//  · 받아 적은 글 · 빠진 낱말은 기록에 없다 — 내가 한 말은 보이지 않고, 줄 · 무엇이 걸렸는지까지만 말한다.
import { NEW_ORDER, YO_LINES, TAEO_CALL, TAEO_MEDIA, poolItem, lineTail, nameFor } from './content.mjs';
import { planRevisit, learningDate, REVISIT_DAYS, DAY_START_HOUR } from '../takes.mjs';

export { DAY_START_HOUR };
export const GAME_ID = 'drama-s1';
const NOTES = ['note-ending', 'note-length', 'note-missing'];
const JUDGED = new Set(['pass', ...NOTES]);
const DAY = 86400000;
export const MINUTES = Object.freeze({ situation: 1, review: 1, scene: 3, entry: 3 });
const pad = (n) => String(n).padStart(2, '0');
const iso = (ms) => new Date(ms).toISOString();

// 학습일(그 기기의 시간대에서 새벽 4시에 바뀜) — 첫 화면의 3일 규칙과 같은 자(takes.mjs learningDate: 현지 4시 전이면 전날).
// tzOffsetMin을 주면 그 시간대로(시험).
export function dayKey(ms, tzOffsetMin = null) {
 if (tzOffsetMin == null) { const d = learningDate(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
 const d = new Date(ms + tzOffsetMin * 60000 - DAY_START_HOUR * 3600000);
 return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
// 그 학습일이 시작한 시각(기기 시간대 새벽 4시) — 시험 · 시연 기록을 학습일 기준으로 심을 때.
export function dayStart(ms) { const d = learningDate(ms); d.setHours(DAY_START_HOUR, 0, 0, 0); return d.getTime(); }
// 그 학습일에서 n일 뒤의 날짜(「11월 17일」) — 끝 화면이 3일 규칙으로 다시 나오는 날을 말할 때.
export function dayParts(ms, plus, tz) {
 const [y, m, d] = dayKey(ms, tz).split('-').map(Number);
 const x = new Date(Date.UTC(y, m - 1, d + plus));
 return { year: x.getUTCFullYear(), month: x.getUTCMonth() + 1, day: x.getUTCDate(), weekday: x.getUTCDay() };
}
function dayLabel(ms, plus, tz) { const p = dayParts(ms, plus, tz); return `${p.month}월 ${p.day}일`; }
const revisitDays = (lesson) => lesson?.revisit?.days || REVISIT_DAYS;
// 1화 학생 줄의 차례. 목표 줄이 맨 앞이다(pilot.mjs lineRank와 같다 — 첫 화면과 같은 실수를 앞에 둔다).
function rankOf(scene) {
 const goal = scene.find((x) => x.goal) || scene.find((x) => x.id === 's1e01-7') || scene[0];
 return (id) => { const k = scene.findIndex((x) => x.id === id); return scene[k] === goal ? -1 : k; };
}
/**
 * 3일 규칙을 돌린다. 첫 화면과 같은 함수(takes.mjs planRevisit)다. facts: 기록기 review()의 돌려줌(null이면 모름 → null).
 * planRevisit은 기기 시계로 학습일을 센다. 시험이 시간대(tzOffsetMin)를 주면 그 시간대의 학습일을 기기 시계의 같은 날짜 낮(12~18시)으로
 * 옮겨 넘긴다. planRevisit은 학습일의 차와 시각의 순서만 쓰므로 답이 같고, 낮 시각이라 기기의 서머타임 전환(밤에 생긴다)에 걸리지 않는다
 * (11-15 Fable 검수 P2-2 — 벽시계를 그대로 옮기면 뉴욕 기기에서 전환 주간에 하루가 어긋나고 두 시각이 한 값으로 겹쳤다).
 * 돌려받은 실수의 시각은 같은 줄 같은 자리의 원래 시각으로 되돌린다.
 */
export function revisitPlan(facts, { lesson, now = Date.now(), tz = null } = {}) {
 const scene = (lesson?.scene || []).filter((x) => x.type === 'student');
 const opts = { days: revisitDays(lesson), rank: rankOf(scene) };
 if (tz == null) return planRevisit(facts, { ...opts, now });
 if (!facts || !facts.history || typeof facts.history !== 'object') return null;
 const sh = (ms) => {
  if (!Number.isFinite(ms)) return ms;
  const [y, m, d] = dayKey(ms, tz).split('-').map(Number);
  const start = Date.UTC(y, m - 1, d, DAY_START_HOUR) - tz * 60000; // 그 시간대 학습일이 시작한 시각(새벽 4시)
  return new Date(y, m - 1, d, 12).getTime() + Math.floor((ms - start) / 4); // 하루(24시간)를 낮 6시간에 순서대로 담는다
 };
 const history = Object.fromEntries(Object.entries(facts.history).map(([id, list]) => [id, (Array.isArray(list) ? list : []).map((r) => ({ ...r, at: sh(r?.at) }))]));
 const plan = planRevisit({ ...facts, history, transferAt: facts.transferAt === undefined ? undefined : sh(facts.transferAt) }, { ...opts, now: sh(now) });
 if (plan) for (const m of plan.mistakes) { const k = history[m.lineId].findIndex((r) => r.at === m.at); if (k >= 0) m.at = facts.history[m.lineId][k].at; }
 return plan;
}
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

/** 계정 기록(모든 게임이 같이 쓰는 log)에서 드라마 차례를 읽는다. 차례 = 보임 하나(장면 줄 · 테이크 2 · 새 상황 · 틀린 장면 복습). */
export function readTurns(events, gameId = GAME_ID) {
 const list = Array.isArray(events) ? events : [];
 const excluded = new Set(list.filter((e) => e?.type === 'record.excluded').map((e) => e.targetId));
 const decisions = new Set(list.filter((e) => e?.type === 'decision.made' && e.experienceId === gameId && !excluded.has(e.id)).map((e) => e.id));
 const turns = new Map();
 for (const e of list) {
  if (e?.type !== 'practice.presented' || !decisions.has(e.decisionId) || excluded.has(e.id)) continue;
  const m = /^[a-zA-Z0-9_-]+\.(scene|retake|transfer|review)\.(.+)$/.exec(String(e.taskId || ''));
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

/**
 * 복습: 3일 규칙의 틀린 대사(planRevisit — 첫 화면 「지난번 틀린 장면」과 같은 목록, 같은 차례) 하나를 첫 화면의 「틀린 장면 복습」으로 연다.
 * 3일째가 된 실수(첫 화면의 다시 만나기 카드)가 먼저다. 없으면 오늘 전 날의 실수 가운데 아직 고쳐 보지 않은 것이다.
 * 3일째 전에 고쳐 본 줄은 내지 않는다 — 3일째에 다시 나온다. 오늘 그 줄을 이미 복습했으면 다시 내지 않는다(결과는 끝 화면이 말한다).
 */
function againItem({ turns, scene, plan, nowMs, tz, today, days }) {
 if (!plan) return null;
 const reviewedToday = (id) => turns.some((t) => t.lineId === id && t.phase === 'review' && t.attempts.length && dayKey(t.at, tz) >= today);
 const open = plan.mistakes.filter((m) => scene.some((x) => x.id === m.lineId) && !reviewedToday(m.lineId));
 const m = open.find((x) => x.due) || open.find((x) => !x.fixed && x.ago >= 1);
 if (!m) return null;
 const line = scene.find((x) => x.id === m.lineId);
 const choice = `note-${m.kind}`;
 const mine = turns.filter((t) => t.lineId === line.id && (t.phase === 'scene' || t.phase === 'review'));
 const coached = mine.some((t) => t.helps.has('explanation'));
 // 그 자리에서 고쳤는지(3일 규칙은 세지 않지만 기록의 사실이다): 그 실수를 낸 차례의 뒤 시도나, 같은 학습일의 테이크 2가 해냈다.
 const opening = mine.find((t) => judgedOf(t)[0]?.at === m.at);
 const sameDay = (t) => dayKey(t.at, tz) === dayKey(m.at, tz);
 const retakePass = (opening ? judgedOf(opening).slice(1).some((a) => a.choice === 'pass') : false)
  || turns.some((t) => t.lineId === line.id && t.phase === 'retake' && t.at >= m.at && sameDay(t) && judgedOf(t).some((a) => a.choice === 'pass'));
 const notes = mine.filter((t) => dayKey(t.at, tz) < today).flatMap((t) => judgedOf(t)).filter((a) => a.choice === choice && a.at >= m.at).length;
 const kind = m.kind, tail = lineTail(line.text, line.id), yo = kind === 'ending' && isYo(line.id);
 const when = m.ago <= 0 ? '오늘' : m.ago === 1 ? '어제' : '지난번';
 const parts = [`${when} 「${tail}」${noteSaid(kind, line.id)}`];
 if (retakePass) parts.push('그 자리에서는 다시 해서 고쳤어요.');
 if (m.due && m.fixed) parts.push('그 뒤에 한 번 고쳐 봤어요.');
 // 오늘 무엇을 확인하는지까지 말한다(11-14 설계 세션 검수 — 이미 고쳤는데 왜 또 하는지가 비어 보였다).
 // 복습 화면은 대사를 빈칸으로 보인다. 그래서 「대사를 안 보고」가 사실이다(빈칸을 열면 도움으로 남고, 3일 규칙은 그 통과로 닫지 않는다).
 parts.push(m.due ? '기억에 남았는지 오늘 대사를 안 보고 확인해요.' : '오늘은 대사를 안 보고 해 봐요.');
 return {
  kind: 'again',
  title: '1화에서 그 대사 한 번 더',
  why: { code: `again.${kind}${yo ? '.yo' : ''}${retakePass ? '.retake' : ''}${m.due ? (m.fixed ? '.due.tried' : '.due') : ''}`, text: parts.join(' '), lead: parts[0],
   evidence: { lineId: line.id, skill: line.skill || null, choice, at: iso(m.at), day: m.ago === 1 ? 'yesterday' : 'before', ago: m.ago, due: m.due, tried: m.fixed,
    notes, coached, retakePass, yo, days } },
  minutes: MINUTES.review,
  open: { type: 'review', lineId: line.id },
  note: kind,
  // 복습 화면(pilot.mjs runReview)이 「지난번: 끝맺음 · 어제 · 11월 14일」과 3일째 전 고침의 말을 짓는 재료 — 첫 화면 카드의 실수와 같은 꼴.
  mistake: { lineId: line.id, kind, at: m.at, fixed: m.fixed, ago: m.ago, due: m.due },
  skills: [line.skill].filter(Boolean),
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
   why: { code: spokenScene.length ? 'new.scene' : 'new.scene.opened', text, lead: text, evidence: { spoken: spokenScene.map((x) => x.id), at: new Date(lastAt).toISOString() } } };
 }
 const avoidSet = new Set(avoid);
 const B = lesson.transfer;
 if (B && !spokeLine(turns, B.id) && B.id !== skip && !avoidSet.has(B.skill)) {
  const ask = scene.find((x) => x.skill === B.skill) || null;
  const at = ask ? spokenTurns(turns, ask.id, 'scene').at(-1)?.at : null;
  return { kind: 'new', title: '같은 과 다른 선배에게 길 묻기', minutes: MINUTES.situation, open: { type: 'situation', lineId: B.id, source: 'transfer' },
   // 까닭 글에도 이 새 상황의 답 낱말(어디 있는지 · 위치 · 가는 길 …)을 쓰지 않는다 — 오늘 화면에서 사진을 누르면 첫 제출 전에 보인다(11-19 카본 B4).
   why: { code: 'new.transfer', text: at != null ? `${whenWord(at, nowMs, tz)} 1화에서 도서관을 찾느라 선배에게 길을 물어봤죠. 오늘은 처음 보는 선배에게 다른 곳을 물어봐요.` : '1화 다음에 이어지는 새 상황이에요.',
    lead: at != null ? `${whenWord(at, nowMs, tz)} 1화에서 도서관을 찾느라 선배에게 길을 물어봤죠.` : '1화 다음에 이어지는 새 상황이에요.',
    evidence: { lineId: B.id, spoken: false, skill: B.skill || null, like: ask?.id || null, likeAt: at != null ? new Date(at).toISOString() : null } } };
 }
 for (const id of NEW_ORDER) {
  if (id === skip || spokeLine(turns, id) || id === lesson.delayed?.id) continue;
  const item = poolItem(id); if (!item || avoidSet.has(item.skill)) continue;
  const like = scene.find((x) => x.id === item.like) || null;
  const tail = like ? lineTail(like.text, like.id) : '';
  const said = Boolean(like) && spokeLine(turns, like.id, 'scene');
  const lead = said ? `1화의 「${tail}」${josa(tail, '과/와')} 비슷한 말이에요.` : '처음 해 보는 상황이에요.';
  const text = said ? `처음 해 보는 상황이에요. ${lead}` : lead;
  return { kind: 'new', title: item.title, minutes: MINUTES.situation, open: { type: 'situation', lineId: id },
   why: { code: said ? 'new.pool.like' : 'new.pool', text, lead, evidence: { lineId: id, spoken: false, skill: item.skill, like: said ? like.id : null } } };
 }
 return null;
}

/**
 * 점검: 나중 확인(C) → 입장 검사 재방문 맞춤(문장 그대로). C는 첫 화면 카드와 같은 3일 규칙이다(planRevisit().delayed — B를 처음 판정한
 * 학습일부터 3일째이고 C를 본 적이 없다). 실수와 따로 정하고, 차례만 복습 뒤다(설계 §18-2).
 */
// 목록 줄에 보이는 한 문장(lead) — 마침표 · 물음표 · 느낌표 뒤 첫 띄어쓰기에서 자른다.
const firstSentence = (t) => String(t || '').split(/(?<=[.?!])\s+/)[0];

function checkItem({ turns, lesson, plan, facts, entry, nowMs, tz, entryToday, strings, days }) {
 const C = lesson.delayed;
 if (C && plan?.delayed === true && !seenLine(turns, C.id)) {
  const at = facts?.transferAt;
  return { kind: 'check', title: strings.delayedTitle, minutes: MINUTES.situation, open: { type: 'situation', lineId: C.id, source: 'delayed' },
   why: { code: 'check.delayed', text: strings.delayedLead, lead: firstSentence(strings.delayedLead), evidence: { lineId: lesson.transfer?.id || null, at: Number.isFinite(at) ? iso(at) : null, days: Number.isFinite(at) ? daysBetween(at, nowMs, tz) : null, revisitDays: days } } };
 }
 if (entry && !entryToday) {
  const v = entry.venue || {};
  return { kind: 'check', title: v.name ? `입장 검사 게임 · ${v.name} 근무` : '입장 검사 게임 한 판', minutes: MINUTES.entry, open: { type: 'game', game: 'entry', venueId: v.id || null, venueName: v.name || null },
   why: { code: `check.entry.${entry.patternId}`, text: entry.why, lead: entry.why, next: entry.next || null, evidence: { game: 'entry-check', patternId: entry.patternId, misses: entry.misses, seen: entry.seen, evidenceIds: entry.evidenceIds || [], targetId: entry.targetId || null, itemKey: entry.itemKey || null } } };
 }
 return null;
}

// 태오 한 줄 — 드라마 장면의 사실만(입장 검사는 말하지 않는다). 사람이 나를 기억하고 말 거는 맛이 나게, 복습 줄은 그 장면의 일을
// 되부른다(그 줄을 말한 기록이 있을 때만 — 복습 줄은 늘 판정된 시도가 있다). 틀은 정해 두고 빈칸이 없다(목소리 · 입 맞는 영상을 틀마다 미리 굽게).
export const TAEO_LINES = Object.freeze({
 ...Object.fromEntries(Object.entries(TAEO_CALL).flatMap(([id, call]) => [[`again.call.${id}`, call.text], [`again.call.${id}.yo`, `${call.text} 이번엔 끝에 '요'까지 붙여서요.`]])),
 'again.review': '그때 했던 대사, 오늘 한 번 더 해 봐요.',
 'new.scene': '하던 데서 이어서 해요.',
 'new.situation': '1화는 끝까지 했죠? 오늘은 새로운 상황이에요.',
 'check.delayed': '며칠 전에 했던 말, 오늘은 처음 보는 곳에서 해 봐요.',
 plain: '왔어요? 오늘은 짧게 해요.',
 empty: '오늘은 새로 할 게 없어요. 2화가 열리면 동아리 박람회부터 해요.',
 // 다 하고 장을 뜯은 뒤 다음 장에서(11-16 일력 판 — 카본: 뜯은 뒤 장이 텅 비어 만들다 만 화면 같았다).
 done: '오늘 잘했어요. 내일 또 봐요.',
});
function taeoLine(items) {
 const first = items[0];
 let code = 'plain';
 if (!first) code = 'empty';
 else if (first.kind === 'again') {
  const id = first.why.evidence.lineId;
  code = TAEO_CALL[id] ? `again.call.${id}${first.why.evidence.yo ? '.yo' : ''}` : 'again.review';
 } else if (first.kind === 'new') code = first.open.type === 'scene' ? 'new.scene' : 'new.situation';
 else if (first.kind === 'check' && first.open.source === 'delayed') code = 'check.delayed';
 // 목소리 · 입 맞는 영상을 끼울 자리 — 구운 틀만 content.mjs TAEO_MEDIA에 적힌다(없으면 듣는 고리 영상 + 글).
 return { code, text: TAEO_LINES[code], media: TAEO_MEDIA[code] || null };
}

/**
 * input: { events(계정 log), lesson(world-lesson.json의 lesson), now(ms), revisit(기록기 review()의 돌려줌 — 3일 규칙의 재료, null이면 모름),
 *          entry(입장 검사 재방문 맞춤 | null), strings({delayedTitle, delayedLead} — 드라마 화면 글), tzOffsetMin? }
 * revisit이 null(기록이 덜 모임)이면 복습과 나중 확인 줄을 내지 않는다 — 모르는 것을 지어내지 않는다.
 */
export function buildToday({ events, lesson, now = Date.now(), revisit = null, entry = null, strings = {}, tzOffsetMin = null } = {}) {
 const tz = tzOffsetMin;
 const turns = readTurns(events);
 const scene = (lesson?.scene || []).filter((x) => x.type === 'student');
 const today = dayKey(now, tz);
 const before = turns.filter((t) => dayKey(t.at, tz) < today);
 const base = { speaker: 'taeo', asOf: new Date(now).toISOString() };
 // 첫날(오늘 전 드라마 기록이 없음)은 지금 흐름 그대로 — 「오늘」을 내지 않는다.
 if (!before.length) return { ...base, firstDay: true, line: null, minutes: 0, items: [], empty: null };
 const entryToday = (Array.isArray(events) ? events : []).some((e) => e?.type === 'decision.made' && e.experienceId === 'entry-check' && dayKey(Date.parse(e.at), tz) >= today);
 const days = revisitDays(lesson);
 const plan = revisitPlan(revisit, { lesson, now, tz });
 const items = [];
 const again = againItem({ turns, scene, plan, nowMs: now, tz, today, days });
 if (again) items.push(again);
 const fresh = newItem({ turns, scene, lesson: lesson || {}, nowMs: now, tz, avoid: again?.skills || [] });
 if (fresh) items.push(fresh);
 const check = checkItem({ turns, lesson: lesson || {}, plan, facts: revisit, entry, nowMs: now, tz, entryToday, strings, days });
 if (check) items.push(check);
 const line = taeoLine(items);
 return { ...base, firstDay: false, line, minutes: items.reduce((s, x) => s + x.minutes, 0), items,
  empty: items.length ? null : { code: 'empty', text: '오늘 할 것은 다 했어요. 2화가 열리면 여기에 이어서 나와요.' } };
}

// 끝 화면 — 무엇이 · 어땠는데(전) → 오늘(후). 촬영장 말(노트 · 테이크) 없이.
const NOTE_LABEL = { ending: '끝맺음', length: '말 길이', missing: '빠진 말' };
// 「오늘 달라진 것」의 새 상황 줄 이름 — 오늘 장면 판 카드의 누구 · 할 일(「같은 과 다른 선배 · 길 묻기」, 11-18 Opus 대체 검수 F2).
const whatOf = (item, lesson) => { const n = nameFor(item, lesson); return n ? `${n.who} · ${n.action}` : item.title; };
const NOTE_BEFORE = { ending: '의 끝맺음이 다르게 들렸어요', length: '라고 할 때 말이 짧게 끝났어요', missing: '라고 할 때 빠진 말이 있었어요' };
const PATTERN_LABEL = { detail: '표와 짐의 세부 내용 확인', negation: '안내문의 부정 표현 확인', condition: '안내문의 조건 확인' };

/**
 * 끝난 뒤 「오늘의 기록」에 더할 것. start: 버튼을 누를 때의 today(그때 근거를 그대로 쓴다), startAt: 누른 시각.
 * entryAfter: 지금 다시 읽은 입장 검사 재방문 맞춤(내일 줄), entryTarget: { itemKey } — 약속한 손님(근무를 연 때 읽은 것).
 * revisit: 지금 다시 읽은 기록기 review()의 돌려줌 — 복습이 3일 규칙으로 닫혔는지, 다시 나오는 날이 언제인지를 같은 규칙으로 센다.
 */
export function buildAfter({ events, lesson, start, startAt, now = Date.now(), revisit = null, entryAfter = null, entryTarget = null, strings = {}, tzOffsetMin = null } = {}) {
 const tz = tzOffsetMin;
 const turns = readTurns(events).filter((t) => t.at >= startAt);
 const days = revisitDays(lesson);
 const plan = revisitPlan(revisit, { lesson, now, tz });
 const changed = [];
 for (const item of start?.items || []) {
  if (item.open.type === 'review') {
   // 3일 규칙과 같은 기준으로 말한다 — 규칙은 복습 보임마다 첫 판정만 센다(「다시 해 보기」는 같은 보임의 뒤 시도라 세지 않는다).
   //  · 규칙으로 닫혔으면(3일째에 빈칸을 열지 않고 첫 시도에 해냄) 「대사를 안 보고 해냈어요」.
   //  · 첫 시도에 해냈지만 아직 열려 있으면, 3일째 전이면 「고쳐 봤어요」(3일째에 다시 나온다), 3일째면 빈칸을 열고 한 것이라 「대사를 보고 해냈어요」.
   //  · 첫 시도는 놓쳤고 다시 해서 해냈으면 「다시 해서 해냈어요」(규칙은 고친 것으로 세지 않는다 — 다음에 다시 나온다).
   // 규칙을 모르면(기록이 덜 모임) 말하지 않는다(11-15 Fable 검수 P2-1).
   const ev = item.why.evidence;
   const mine = turns.filter((t) => t.lineId === ev.lineId && t.phase === 'review');
   const first = mine.map((t) => judgedOf(t)[0]).find(Boolean) || null;
   if (!plan || !first) continue; // 오늘 판정된 복습 시도가 없으면 달라진 것이 없다
   const passed = mine.some((t) => judgedOf(t).some((a) => a.choice === 'pass'));
   const closed = !plan.mistakes.some((m) => m.lineId === ev.lineId);
   const after = closed ? '오늘은 대사를 안 보고 해냈어요' : first?.choice === 'pass' ? (ev.due ? '오늘은 대사를 보고 해냈어요' : '오늘은 고쳐 봤어요')
    : passed ? '오늘은 다시 해서 해냈어요' : null;
   if (!after) continue;
   const scene = (lesson?.scene || []).find((x) => x.id === ev.lineId);
   const yo = item.note === 'ending' && ev.yo;
   changed.push({ what: yo ? "끝에 '요' 붙이기" : NOTE_LABEL[item.note] || '그 대사', before: `${ev.day === 'yesterday' ? '어제는' : '지난번엔'} 「${lineTail(scene?.text, ev.lineId)}」${yo ? '의 끝이 반말처럼 들렸어요' : NOTE_BEFORE[item.note] || ''}`, after });
  } else if (item.open.type === 'situation') {
   const last = lastJudged(turns.filter((t) => t.lineId === item.open.lineId && t.phase === 'transfer'));
   const tried = turns.some((t) => t.lineId === item.open.lineId && t.phase === 'transfer' && t.attempts.length);
   if (item.kind === 'new' && tried) {
    changed.push({ what: whatOf(item, lesson), before: '아직 안 해 본 상황이었어요', after: last?.choice === 'pass' ? '처음 보는 상황에서 해냈어요' : '처음 보는 상황에서 말해 봤어요' });
   } else if (item.kind === 'check' && last?.choice === 'pass') {
    // 전 글은 그날 실제로 한 일(B — 캠퍼스에서 같은 과 다른 선배)로 — 줄 이름이 오늘의 C(지나가는 어른)라서, 「며칠 전에 처음 해 봤어요」만 두면
    // 그 어른께 며칠 전에 물은 것처럼 읽혔다(11-18 Opus 대체 검수 drama-today-names-1118 F2).
    const b = lesson?.transfer ? nameFor({ kind: 'new', open: { type: 'situation', lineId: lesson.transfer.id, source: 'transfer' } }, lesson) : null;
    const ago = item.why.evidence.days != null ? `${item.why.evidence.days}일 전에는` : '며칠 전에는';
    changed.push({ what: whatOf(item, lesson), before: b ? `${ago} ${b.place}에서 ${b.who}에게 처음 해 봤어요` : `${ago} 새 상황에서 처음 해 봤어요`, after: '오늘은 다른 곳에서도 해냈어요' });
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
   if (hit === true) changed.push({ what: PATTERN_LABEL[item.why.evidence.patternId] || '입장 검사 게임', before: `최근 ${item.why.evidence.seen}번 중 ${item.why.evidence.misses}번 놓쳤어요`, after: '오늘은 그런 손님을 알아봤어요' });
  }
 }
 // 다음에 할 것 = 같은 규칙을 내일 날짜로 다시 돌린 결과(지어내지 않는다) + 3일 규칙으로 다시 나오는 날.
 //  · 오늘 복습한 줄이 아직 열려 있고 내일 줄에 없으면 그 실수의 3일째 날짜.
 //  · 오늘 새 상황 B를 처음 해 봤으면 나중 확인(C)의 날짜 — B를 처음 판정한 학습일부터 3일째(첫 화면 카드와 같은 날).
 const next = buildToday({ events, lesson, now: now + DAY, revisit, entry: entryAfter, strings, tzOffsetMin: tz });
 const tomorrow = next.items.map((x) => ({ kind: x.kind, title: x.title, name: nameFor(x, lesson), when: '내일', date: dayParts(now, 1, tz) }));
 const soon = (id) => next.items.some((x) => x.open.lineId === id);
 for (const item of (start?.items || []).filter((x) => x.open.type === 'review')) {
  const m = plan?.mistakes.find((x) => x.lineId === item.open.lineId);
  if (m && !m.due && !soon(m.lineId)) tomorrow.push({ kind: 'again', title: item.title, name: nameFor(item, lesson), when: dayLabel(m.at, days, tz), date: dayParts(m.at, days, tz) });
 }
 const B = lesson?.transfer, C = lesson?.delayed;
 const soloAt = B ? turns.filter((t) => t.lineId === B.id && t.phase === 'transfer').flatMap(judgedOf).map((a) => a.at).sort((a, b) => a - b)[0] : undefined;
 // C를 본 적이 있으면(접힌 기록에만 남아 사건 목록에 보임이 없어도 기록기가 안다) 다시 나오지 않으니 날짜를 약속하지 않는다(11-15 Fable 검수 P3).
 if (C && soloAt != null && revisit?.delayedSeen !== true && !seenLine(readTurns(events), C.id) && !soon(C.id)) {
  const at = Number.isFinite(revisit?.transferAt) ? revisit.transferAt : soloAt;
  tomorrow.push({ kind: 'check', title: strings.delayedTitle || '지난번 그 말, 다른 곳에서', name: nameFor({ kind: 'check', open: { type: 'situation', lineId: C.id, source: 'delayed' } }, lesson), when: dayLabel(at, days, tz), date: dayParts(at, days, tz) });
 }
 return { changed, tomorrow, line: { code: 'done', text: TAEO_LINES.done, media: TAEO_MEDIA.done || null } };
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
