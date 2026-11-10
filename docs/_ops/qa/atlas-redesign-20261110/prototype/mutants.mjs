// 임의 시험이 무디지 않은지 본다: 두뇌의 규칙을 하나씩 일부러 깬 사본을 만들어 fuzz.mjs · fuzz-session.mjs가 잡는지 확인한다.
// 잡지 못하는 변형이 있으면 시험이 그 규칙을 지키지 못한다는 뜻이다 — 두뇌가 아니라 시험을 먼저 고친다. 규칙을 더하거나 고칠 때는 그 규칙을 깬 변형을 함께 더한다.
// 변형은 네 번의 설계 검토와 구조 검토가 짚은 결함을 되살린 것과, 규칙마다 하나씩 깬 것이다.
// 쓰는 법: node mutants.mjs   (사본은 시스템 임시 폴더에 만들고 지운다)
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findFsrs } from './fsrs-path.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = readFileSync(path.join(here, 'brain.mjs'), 'utf8').replace(/\r\n/g, '\n');
const FOLD = 'fuzz.mjs', PLAY = 'fuzz-session.mjs';
const MUTANTS = [
  // ── 기억 · 능력의 뜻(§3-2 · §3-3) — 글을 옮긴 일괄 계산과 맞대어 잡는다 ──
  [FOLD, '기억', '「다시 배울래요」가 비운 시각을 남기지 않는다(3차)', "if (answer.say === 'relearn') return { empty: true, latestAt: answer.at };", "if (answer.say === 'relearn') return null;"],
  [FOLD, '기억', '「이미 알아요」 뒤 맞혔다가 같은 자리에서 놓치면 60일 안정도를 물려받는다(3차)', 'build(had.prev?.known ? null : had.prev, { at: had.open.at', 'build(had.prev, { at: had.open.at'],
  [FOLD, '기억', '「이미 알아요」 뒤 첫 놓침이 60일 안정도를 물려받는다(2차)', "if (miss) return build(null, { at: answer.at, grade: 'again' }, { ...counts, sittings: had.sittings + 1 });", "if (miss) return build({ stability: had.stability, difficulty: had.difficulty, lastAt: had.lastAt }, { at: answer.at, grade: 'again' }, { ...counts, sittings: had.sittings + 1 });"],
  [FOLD, '기억', '같은 자리 규칙이 없다 — 답마다 새 자리(1차)', 'if (answer.at - had.open.at < params.sittingHours * HOUR) {', 'if (false) {'],
  [FOLD, '기억', '한 자리의 결과가 마지막 답이다(놓친 뒤 맞히면 성공)', "if (!miss || had.open.grade === 'again') return { ...had, latestAt: answer.at };", "if (!miss && had.open.grade === 'again') return { ...build(had.prev?.known ? null : had.prev, { at: had.open.at, grade: answer.grade }, counts), latestAt: answer.at };\n      if (!miss) return { ...had, latestAt: answer.at };"],
  [FOLD, '기억', '고르는 꼴 정답을 Good 그대로 친다(약한 성공 없음 — 1차)', "const grade = sittingGrade === 'weak' && params.weakWeight >= 1 ? 'good' : sittingGrade;", "const grade = sittingGrade === 'weak' ? 'good' : sittingGrade;"],
  [FOLD, '기억', '안정도 60일 상한이 없다(1 · 2차)', 'stability: Math.min(s.stability, params.maxIntervalDays), difficulty', 'stability: s.stability, difficulty'],
  [FOLD, '기억', '답을 본 뒤 맞힌 것을 성공으로 친다', "if (!correct || answerShown) return 'again';", "if (!correct) return 'again';"],
  [FOLD, '기억', '실패를 늘 주 단위에 적는다(2차)', '[answer.target && units.includes(answer.target) ? answer.target : units[0]]', '[units[0]]'],
  [FOLD, '기억', '거둔 답이 근거 줄에 남는다', "const grade = event.kind === 'help' || gone.has(event.id) ? null :", "const grade = event.kind === 'help' ? null :"],
  [FOLD, '기억', '거둔 본인 말이 줄에 남는다', 'if (!gone.has(event.id)) push(rows, event.unit,', 'push(rows, event.unit,'],
  [FOLD, '능력', '힌트를 봐도 이어서 맞힌 수가 안 끊긴다(2차)', 'miss || !row.unaided ? 0 : skill.streak', 'miss ? 0 : skill.streak'],
  [FOLD, '능력', '능력 값이 답이 쌓여도 크게 움직인다', '(0.25 + 0.9 / (1 + ability.n / 4))', '(0.25 + 0.9 / (1 + ability.n / 40))'],
  [FOLD, '만남', '옮겨 온 장부에 든 계열의 답을 첫 만남으로 센다(3차)', "    if (event.kind === \'carry\') { for (const key of event.families) push(marks, key, { id: event.id, at: event.after ?? -Infinity, carried: true, grade: null, unaided: true, skillId: null }); continue; }", "    if (event.kind === \'carry\') continue;"],
  [FOLD, '만남', '나중에 옮긴 장부가 이미 옮긴 답의 자격을 거둔다(4차)', 'at: event.after ?? -Infinity, carried: true', 'at: -Infinity, carried: true'],
  [FOLD, '능력', '도움만 본 것이 이어서 맞힌 수를 끊지 않는다(4차)', 'if (mark.carried || (mark.grade == null && mark.unaided)) return;', 'if (mark.carried || mark.grade == null) return;'],
  [FOLD, '만남', '도움만 본 것을 만남으로 치지 않는다(구조 검토)', "if (event.kind !== 'answer' && event.kind !== 'help') continue;", "if (event.kind !== 'answer') continue;"],
  [FOLD, '만남', '판정 못 한 답 · 거둔 답을 만남으로 치지 않는다(2 · 3차)', 'push(marks, event.item.familyKey, markOf(event, grade));', 'if (grade != null) push(marks, event.item.familyKey, markOf(event, grade));'],
  [FOLD, '차례', '같은 시각의 차례를 받은 차례로 정한다', '(a.id != null && b.id != null && a.id !== b.id ? (a.id < b.id ? -1 : 1) : a.i - b.i)', '0'],
  // ── 기기 얹기(§5-4) — 서버가 모두 접은 값과 맞대어 잡는다 ──
  [FOLD, '얹기', '기기가 늦게 온 답도 그냥 이어 붙인다(1 · 3차)', 'const canAppend = (state, at) => !state || at > state.latestAt;', 'const canAppend = () => true;'],
  [FOLD, '얹기', '기기가 같은 시각의 답도 이어 붙인다', 'at > state.latestAt;', 'at >= state.latestAt;'],
  [FOLD, '얹기', '기기가 능력 줄보다 이른 답을 능력에 이어 붙인다(1차)', '|| !(event.at > skill.lastAt)) waitSkill(view, item.skillId);', ') waitSkill(view, item.skillId);'],
  [FOLD, '얹기', '첫 만남이 내 쪽으로 바뀌어도 능력 줄을 기다리지 않는다(구조 검토)', 'if (!lead && at <= known) for (const id of skills) waitSkill(view, id);', ''],
  [FOLD, '얹기', '내 답이 더 이른데 첫 만남 시각을 고치지 않는다', 'if (lead || at < known) view.met.set(family, at);', 'if (lead) view.met.set(family, at);'],
  [FOLD, '얹기', '거둔 내 답이 만남으로도 남지 않는다', "else if (event.kind === 'answer') applyOwn(view, { ...event, gone: true }, memory, params, index);", ';'],
  [FOLD, '얹기', '이미 접힌 사건의 제외를 얹은 척한다(3차)', 'const target = index?.lookup?.(event.ref), touched = target ? touchedBy(target) : event.touches;', 'const target = null, touched = { units: [], skills: [] };'],
  [FOLD, '얹기', '닿는 줄을 모르는 제외가 밀려 있어도 얹는다(4차)', 'if (!touched) { waitEverything(view); break; }', 'if (!touched) continue;'],
  [FOLD, '얹기', '기기가 도움만 본 것으로는 이어서 맞힌 수를 끊지 않는다(4차)', 'if (grade == null && mark.unaided) return { grade, lead };', 'if (grade == null) return { grade, lead };'],
  [FOLD, '얹기', '기다리는 줄을 요약 값으로 돌려놓지 않는다', 'const waitUnit = (view, unit) => { view.waitUnits.add(unit); restore(view.memory, unit, view.base?.memory); };', 'const waitUnit = (view, unit) => { view.waitUnits.add(unit); };'],
  [FOLD, '얹기', '옮겨 온 장부가 능력 줄을 기다리게 하지 않는다(3차)', 'meet(view, key, event.after ?? -Infinity, index?.familySkills?.get(key) || []);', 'meet(view, key, event.after ?? -Infinity, []);'],
  // ── 고르기에서 지켜야 할 것(§3-5 불변식) ──
  [PLAY, '고르기', '당겨 낸 다시가 겨눈 단위를 잃는다(3차)', 'waiting ? [5, waiting] :', 'waiting ? [4, null] :'],
  [PLAY, '고르기', '새 단위를 낼 때마다 하루 한도에 다시 센다(3차)', 'const brandNew = unseen.filter(unit => !learner.day.introduced.has(unit)), fresh = brandNew.length,', 'const brandNew = unseen, fresh = brandNew.length,'],
  [PLAY, '고르기', '앞 판에서 낸 기억 없는 단위를 이 판 한도에 세지 않는다(4차)', 'firstHere = unseen.filter(unit => !session.introduced.has(unit));', 'firstHere = brandNew;'],
  [PLAY, '고르기', '판정 못 한 문항의 계열 전체를 막는다(4차)', 'const blank = session.blank.has(item.id);', 'const blank = candidates.some(other => other.familyKey === item.familyKey && session.blank.has(other.id));'],
  [PLAY, '고르기', '기다리는 다시가 있어도 할 것 없다고 알린다(2차)', 'rows[0].idle = rows[0].tier >= 3 && !pending;', 'rows[0].idle = rows[0].tier >= 3;'],
  [PLAY, '고르기', '다시를 다 쓴 단위를 채우기로 낸다(2차)', 'const blocked = spent || over || held || blank;', 'const blocked = over || held || blank;'],
  [PLAY, '고르기', '한도를 돌아옴 층에는 걸지 않는다(2차)', 'const blocked = spent || over || held || blank;', 'const blocked = spent || (over && !due.length) || held || blank;'],
  [PLAY, '고르기', '상한에 걸려 미룬 것을 그대로 낸다(2차)', 'const blocked = spent || over || held || blank;', 'const blocked = spent || over || blank;'],
  [PLAY, '고르기', '판정 못 한 문항을 그 판에서 또 낸다(구조 검토 전 시험)', 'const blocked = spent || over || held || blank;', 'const blocked = spent || over || held;'],
  [PLAY, '고르기', '판정 못 한 문항을 적어 두지 않는다', 'if (grade == null) { session.blank.add(item.id); return { grade, first: lead }; }', 'if (grade == null) return { grade, first: lead };'],
  [PLAY, '고르기', '본인 말이 그 판의 다시를 거두지 않는다(3차)', "  learner.session?.retries.delete(unit); // 본인 말이 그 단위의 기억을 바꿨으므로 이 판의 「다시」도 거둔다\n", ''],
  [PLAY, '고르기', '돌아온 것으로 낸 수를 세지 않는다', 'if (row.tier === 1) { session.sinceNew += 1; learner.day.reviews += 1; }', 'if (row.tier === 1) { session.sinceNew += 1; }'],
  [PLAY, '고르기', '낼 것 없음을 알리지 않는다(2차)', 'rows[0].none = rows[0].tier === 9;', 'rows[0].none = false;'],
  [PLAY, '고르기', '채우기가 할 것보다 앞설 수 있다(2차)', 'const group = row => (row.tier <= 2 ? 0 : row.tier === 9 ? 2 : 1)', 'const group = row => (row.tier === 9 ? 2 : 0)'],
  [PLAY, '고르기', '다시를 끝없이 낸다(1차)', 'tries, pending: tries < params.retryMax });', 'tries, pending: true });'],
  [PLAY, '고르기', '능력 이유에 겨눈 단위를 싣지 않는다(3차)', "{ code: 'skill.up', slots: { skill: item.skillId, unit: target, streak:", "{ code: 'skill.up', slots: { skill: item.skillId, streak:"],
  [PLAY, '고르기', '새 단위를 낸 것을 하루 한도에 세지 않는다(1차)', '  for (const unit of row.brandNew) learner.day.introduced.add(unit); // 새 단위는 어느 층의 문항으로 만나든 하루에 한 번만 센다\n', ''],
  [PLAY, '고르기', '하루 한도를 기록에서 되살리지 않는다(다시 켜면 0부터 — 구조 검토)', 'today = learner.log.filter(entry => dayKey(entry.at, params) === key);', 'today = [];'],
  [PLAY, '고르기', '낸 것을 기록에 남기지 않는다', "  learner.log.push({ at: row.at, review: row.tier === 1, units: row.fresh ? [...row.brandNew] : [] });\n", ''],
  [PLAY, '고르기', '같은 자리 안에서도 돌아온 것으로 친다(2차)', 'isDue: (state, now) => has(state) && !inSitting(state, now) && retrievability', 'isDue: (state, now) => has(state) && retrievability'],
  [PLAY, '고르기', '이 판에서 만난 단위도 「따뜻하게」로 또 낸다', 'need = Math.max(...units.map((unit, i) => (session.met.has(unit) || memory.inSitting(states[i], now) ? 0 : 1 - memory.retrievability(states[i], now))));', 'need = Math.max(...units.map((unit, i) => 1 - memory.retrievability(states[i], now)));'],
  // ── 차례와 말(§3-5 차례의 속성 · §3-4 · §3-7) ──
  [PLAY, '차례', '놓친 것을 문항 둘이 지나기 전에 다시 낸다', 'const waiting = again.find(unit => learner.shown.length - retryOf(unit).position < params.retryGap);', 'const waiting = undefined;'],
  [PLAY, '차례', '다시를 놓친 순서대로 내지 않는다(4차)', ' - asked.position / 1e6;', ';'],
  [PLAY, '차례', '문항 안에서 먼저 놓친 단위를 겨누지 않는다(4차)', '.sort((a, b) => retryOf(a).position - retryOf(b).position); // 놓친 순서', '.sort((a, b) => retryOf(b).position - retryOf(a).position); // 놓친 순서'],
  [PLAY, '차례', '기억 없는 새것을 끼운 뒤에도 셋에 하나를 다시 세지 않는다(4차)', 'if (row.tier === 2 || row.firstHere.length) session.sinceNew = 0;', 'if (row.fresh) session.sinceNew = 0;'],
  [PLAY, '차례', '밀려도 급한 것부터 겨눈다(살릴 수 있는 것부터가 아님 — 1차)', '.sort((a, b) => (rescue ? b[2] - a[2] : a[2] - b[2]));', '.sort((a, b) => a[2] - b[2]);'],
  [PLAY, '차례', '밀린 판의 줄 세우기가 급한 순이다(1차)', 'need = rescue ? r : 1 - r / params.retention;', 'need = 1 - r / params.retention;'],
  [PLAY, '차례', '돌아온 것을 덜 급한 것부터 낸다', 'b.need - a.need || b.promote - a.promote || b.fit - a.fit);', 'a.need - b.need || b.promote - a.promote || b.fit - a.fit);'],
  [PLAY, '차례', '셋에 하나 새것을 끼우지 않는다(1차)', 'if (rows.length && rows[0].tier === 1 && session.sinceNew >= params.interleave) {', 'if (false) {'],
  [PLAY, '차례', '새것을 진도 순이 아니라 거꾸로 낸다', 'need = -(item.order ?? 0); // 새것은', 'need = (item.order ?? 0); // 새것은'],
  [PLAY, '차례', '숨 고르기가 잊혀 가는 단위도 「잘 아는」이라 한다(2차)', '&& memory.retrievability(states[i], now) >= params.retention);', ');'],
  [PLAY, '차례', '이어서 놓쳐도 숨 고르기를 내지 않는다', 'if (easy > 0) {', 'if (false) {'],
  [PLAY, '말', '0번 이어서 맞혀도 「한 단계 올려 볼게요」(1차)', "(ability?.streak || 0) >= 2 ? { code: 'skill.up'", "(ability?.streak || 0) >= 0 ? { code: 'skill.up'"],
  [PLAY, '말', '풀어 본 문항에도 능력 항을 곱한다(2차)', 'const skill = missing || !learner.met.has(item.familyKey) ? sigmoid(', 'const skill = true ? sigmoid('],
];

const dir = mkdtempSync(path.join(tmpdir(), 'atlas-mutants-'));
const env = { ...process.env, TS_FSRS: findFsrs() === 'ts-fsrs' ? 'ts-fsrs' : path.resolve(findFsrs()) };
const caughtBy = test => {
  const run = spawnSync(process.execPath, [path.join(dir, test), '1500', '1'], { encoding: 'utf8', env });
  const line = run.stdout.split('\n').find(text => /^(어긋난 것|지켜야 할 것과 차례의 속성을 어긴 것)/.test(text)) || '';
  return Number((line.match(/: (\d+)/) || [])[1]) > 0 || (run.status !== 0 && !line); // 멈춘 것도 잡은 것이다
};
const missed = [];
try {
  for (const file of [FOLD, PLAY, 'spec.mjs', 'fsrs-path.mjs']) copyFileSync(path.join(here, file), path.join(dir, file));
  for (const [test, kind, name, from, to] of MUTANTS) {
    if (!base.includes(from)) { missed.push(name); console.log(`바꿀 자리를 못 찾음 · ${kind} · ${name}`); continue; }
    writeFileSync(path.join(dir, 'brain.mjs'), base.replace(from, to));
    const other = test === FOLD ? PLAY : FOLD, by = caughtBy(test) ? test : caughtBy(other) ? other : null;
    if (!by) missed.push(name);
    console.log(`${by ? '잡음' : '못 잡음'} · ${kind} · ${name}${by && by !== test ? `(${by === FOLD ? '접기' : '고르기'} 시험이 잡음)` : ''}`);
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
const kinds = [...new Set(MUTANTS.map(m => m[1]))].map(kind => `${kind} ${MUTANTS.filter(m => m[1] === kind).length}`).join(' · ');
console.log(`변형 ${MUTANTS.length}개(${kinds}) 가운데 못 잡은 것: ${missed.length}`);
if (missed.length) process.exitCode = 1;
