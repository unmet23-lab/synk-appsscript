// 고르기를 임의의 판으로 확인한다(3차 설계 검토와 구조 검토 뒤 — 규칙끼리 만나는 모서리를 장면 하나씩이 아니라 기계로 훑는다).
// 임의의 문항 은행(단위 하나 · 여럿 · 태그 없음, 문항이 하나뿐인 단위) · 임의의 한도 · 임의의 답(맞음 · 틀림 · 힌트 · 판정 못 함)과 본인 말로
// 여러 날 · 여러 판을 돌리며, 문항을 낼 때마다 아래를 본다. 한도 · 자리 · 돌아옴은 시험이 따로 센 값으로 본다(두뇌가 센 값을 믿지 않는다).
//
// 지켜야 할 것(설계서 §3-5 「고르기의 불변식」)
//   가. 낼 것 없음(none)은 모든 후보가 「내지 않음」일 때만이다. 멈추지 않는다(던지지 않는다). 같은 상태에서 두 번 고르면 같은 것을 고른다.
//   나. 할 것(다시 · 돌아옴 · 새것)이 하나라도 있으면 채우기보다 먼저 낸다(숨 고르기 하나는 예외). idle이면 할 것도, 기다리는 다시도 없다.
//   다. 새 단위는 한 판 · 하루 한도를 넘지 않고(「더 배우기」 판은 예외), 처음 낸 단위는 꼭 세며, 한 번 센 단위를 다시 세지 않는다.
//       하루 한도는 오늘 처음 낸 단위로, 한 판 한도는 이 판에서 처음 낸 기억 없는 단위로 센다(앞 판에서 냈지만 아직 기억이 없는 단위도 이 판에는 센다).
//   라. 한 단위를 「다시」로 내는 것은 한 판에 두 번까지다. 세 번 놓친 단위가 든 문항은 그 판에서 어느 층으로도 내지 않는다.
//   마. 돌아온 것으로 내는 문항은 하루 상한을 넘지 않고, 이 판에서 이미 만난 단위를 돌아온 것으로 또 내지 않는다.
//   바. 다시 · 돌아옴 · 새것으로 낸 문항에는 겨눈 단위가 있고 그 문항이 묻는 단위다. 이유의 종류가 층과 맞는다. 놓치면 실패가 그 단위 하나에만 적힌다.
//   사. 층은 층 표 그대로다 — 문항마다 시험이 층 표(내지 않을 까닭 넷 → 기다리는 다시 → 다시 → 돌아옴 → 새것 → 따뜻하게 → 가볍게)를 따로 계산해 맞대 본다.
// 차례와 말(설계서 §3-5 「차례의 속성」)
//   아. 놓친 것은 다른 문항 둘이 지난 뒤에, 놓친 순서대로(다른 문항으로 낼 수 있는 것 먼저) 다시 낸다. 차례를 당겨 내는 것은 방금 본 것 말고는 낼 것이 없을 때뿐이다.
//   자. 돌아온 것은 급한 것(떠올릴 확률이 낮은 것)부터, 밀린 것이 많으면 살릴 수 있는 것(높은 것)부터 낸다.
//   차. 돌아온 것이 셋 이어지면 새것 하나를 끼운다. 새것은 제품이 정한 진도 순이다.
//   카. 숨 고르기는 이어서 놓친 뒤에만, 이 자리에서 아직 안 만난 잘 아는 단위(떠올릴 확률이 목표 이상)로만 낸다. 낼 수 있으면 건너뛰지 않는다.
//   타. 이유의 근거 칸은 기록과 같다(놓친 자리 수 · 만난 자리 수 · 며칠 만에 · 이어서 맞힌 수 · 난도가 실제로 오르내렸는가).
//   파. 예상 성공 확률은 식 그대로다(풀어 본 문항을 다시 만날 때는 능력 항을 곱하지 않는다).
// 쓰는 법: node fuzz-session.mjs [씨앗 수=1500] [첫 씨앗=1]
import { PARAMS, createMemory, createLearner, choose, present, record, say, startSession, unitsOf, dayKey } from './brain.mjs';
import { loadFsrs } from './fsrs-path.mjs';

const memory = createMemory(loadFsrs());
const DAY = 86400000, HOUR = 3600000, T0 = Date.parse('2026-12-01T09:00:00Z');
const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (r, list) => list[Math.floor(r() * list.length)];
const FORMATS = ['single-choice', 'binary-choice', 'cup-compose', 'spoken'];
const REASONS = { 0: ['unit.retry'], 5: ['unit.retry'], 1: ['unit.due', 'unit.shaky'], 2: ['unit.new', 'skill.up', 'skill.ease'] };
const near = (a, b) => Math.abs(a - b) < 1e-9;

function makeBank(r) {
  const units = Array.from({ length: 2 + Math.floor(r() * 12) }, (_, i) => `u${i}`), items = [];
  units.forEach((unit, i) => {
    const n = r() < 0.3 ? 1 : 2, variants = r() < 0.3; // 문항이 하나뿐인 단위도 있고(다른 문제로 다시 낼 수 없다), 두 문항이 같은 계열의 변형인 단위도 있다
    for (let k = 0; k < n; k += 1) items.push({ id: `${unit}.${k}`, familyKey: variants ? unit : `${unit}.${k}`, kcIds: [unit], skillId: `s${i % 2}`, difficulty: 1 + Math.floor(r() * 3), responseFormat: pick(r, FORMATS), order: i });
  });
  for (let k = 0, n = Math.floor(r() * 4); k < n && units.length >= 2; k += 1) {
    const size = 2 + Math.floor(r() * 2), chosen = [...new Set(Array.from({ length: size }, () => pick(r, units)))];
    if (chosen.length >= 2) items.push({ id: `m${k}`, familyKey: `m${k}`, kcIds: chosen, skillId: `s${k % 2}`, difficulty: 1 + Math.floor(r() * 3), responseFormat: pick(r, FORMATS), order: Math.floor(r() * units.length) });
  }
  for (let k = 0, n = Math.floor(r() * 3); k < n; k += 1) items.push({ id: `x${k}`, familyKey: `x${k}`, skillId: `s${k % 2}`, difficulty: 1 + Math.floor(r() * 3), responseFormat: pick(r, FORMATS), order: Math.floor(r() * units.length) });
  return items;
}

const count = Number(process.argv[2]) || 1500, first = Number(process.argv[3]) || 1;
const bad = [], tally = { sessions: 0, shown: 0, tiers: {}, none: 0, idle: 0, breather: 0, says: 0, capped: 0, more: 0, blank: 0, rescue: 0, weave: 0 };
const fail = (seed, step, rule, detail) => { if (bad.length < 400) bad.push({ seed, step, rule, detail }); };

for (let seed = first; seed < first + count; seed += 1) {
  const r = rng(seed), bank = makeBank(r), learner = createLearner();
  const P = { ...PARAMS, newPerSession: pick(r, [1, 2, 3, 6]), newPerDay: pick(r, [3, 8, 20]), reviewsPerDay: pick(r, [2, 10, 60]), backlog: pick(r, [1, 4, 20]) };
  const skillOf = pick(r, [0.15, 0.5, 0.75, 0.95]); // 이 학습자가 맞힐 확률
  let now = T0 + Math.floor(r() * 1000), step = 0, today = { key: null, more: false, units: new Set(), reviews: 0 };
  // 시험이 따로 재는 것: 기억이 있는가 · 떠올릴 확률 · 같은 자리 안인가 · 돌아왔는가(§3-2의 글 그대로)
  const mem = unit => learner.memory.get(unit), has = unit => memory.has(mem(unit)), recall = unit => memory.retrievability(mem(unit), now);
  const sitting = unit => has(unit) && mem(unit).open.grade !== 'known' && now - mem(unit).open.at < P.sittingHours * HOUR;
  const due = unit => has(unit) && !learner.session.met.has(unit) && !sitting(unit) && recall(unit) < P.retention;
  const days = 1 + Math.floor(r() * 4);
  for (let day = 0; day < days; day += 1) {
    const rounds = 1 + Math.floor(r() * 3);
    for (let round = 0; round < rounds; round += 1) {
      const more = r() < 0.12;
      if (today.key !== dayKey(now, P)) today = { key: dayKey(now, P), more: false, units: new Set(), reviews: 0 }; // 하루는 새벽 4시에 넘어간다
      today.more = today.more || more;
      learner.day = null; // 앱을 다시 켠 것처럼 — 하루의 한도는 「낸 것」 기록에서 다시 세어야 한다
      startSession(learner, now, P, { more });
      const session = learner.session, retried = new Map(), blanked = new Set();
      let sinceNew = 0, missStreak = 0; const sessionUnits = new Set(); // 이 판에서 낸 기억 없는 단위(한 판 한도는 이것으로 센다)
      tally.sessions += 1; if (more) tally.more += 1;
      // 시험이 따로 옮긴 층 표(§3-5): 내지 않을 까닭 넷 → 기다리는 다시 → 다시 → 돌아옴 → 새것 → 따뜻하게 → 가볍게
      const pendingAt = unit => (session.retries.get(unit)?.pending ? learner.shown.length - session.retries.get(unit).position : null);
      const blockedOf = item => {
        const us = unitsOf(item), fresh = us.filter(unit => !has(unit) && !today.units.has(unit)).length, here = us.filter(unit => !has(unit) && !sessionUnits.has(unit)).length;
        return us.some(unit => { const s = session.retries.get(unit); return s && !s.pending && s.tries >= P.retryMax; }) // 이 판의 다시를 다 쓴 단위
          || (!more && (sessionUnits.size + here > P.newPerSession || today.units.size + fresh > P.newPerDay)) // 한도를 넘는 새 단위(한 판: 이 판에서 처음 내는 기억 없는 단위 · 하루: 오늘 처음 내는 단위)
          || (today.reviews >= P.reviewsPerDay && us.some(due)) // 하루 상한에 걸린 날의 돌아온 단위
          || blanked.has(item.id); // 이 판에서 판정하지 못한 문항(같은 계열의 다른 문항은 막지 않는다)
      };
      const tierOf = item => {
        const us = unitsOf(item);
        if (blockedOf(item)) return 9;
        if (us.some(unit => pendingAt(unit) != null && pendingAt(unit) < P.retryGap)) return 5;
        if (us.some(unit => pendingAt(unit) != null)) return 0;
        if (us.some(due)) return 1;
        if (us.some(unit => !has(unit))) return 2;
        return us.some(unit => !session.met.has(unit) && !sitting(unit) && 1 - recall(unit) >= 0.03) ? 3 : 4;
      };
      for (let i = 0, length = 3 + Math.floor(r() * 30); i < length; i += 1) {
        step += 1;
        let rows;
        try { rows = choose(bank, learner, memory, now, { params: P }); } catch (error) { fail(seed, step, '가. 고르다 멈춤', String(error?.message || error)); break; }
        const top = rows[0];
        if (rows.length !== bank.length) fail(seed, step, '가. 후보 수', `${rows.length}/${bank.length}`);
        if (choose(bank, learner, memory, now, { params: P })[0].item.id !== top.item.id) fail(seed, step, '가. 같은 상태에서 다른 것을 고름', top.item.id);
        if (top.none !== rows.every(row => row.tier === 9)) fail(seed, step, '가. none', `none ${top.none} · 맨 앞 ${top.tier}층`);
        // 사. 층은 층 표 그대로
        for (const row of rows) { const want = tierOf(row.item); if (row.tier !== want) { fail(seed, step, '사. 층이 층 표와 다름', `${row.item.id} · 낸 층 ${row.tier} · 표 ${want}`); break; } }
        const todo = rows.some(row => row.tier <= 2), waiting = rows.some(row => row.tier === 5);
        if (todo && !top.breather && top.tier > 2) fail(seed, step, '나. 할 것이 있는데 채우기를 먼저 냄', `맨 앞 ${top.tier}층`);
        if (top.idle && (todo || waiting)) fail(seed, step, '나. idle인데 할 것 · 기다리는 다시가 있음', `할 것 ${todo} · 기다림 ${waiting}`);
        if (!top.idle && !top.none && !top.breather && !todo && !waiting) fail(seed, step, '나. 할 것이 없는데 idle이 아님', `맨 앞 ${top.tier}층`);
        if (top.none) { tally.none += 1; break; }
        if (top.idle) tally.idle += 1; if (top.breather) tally.breather += 1; if (top.capped) tally.capped += 1;
        const units = unitsOf(top.item), tier = top.breather ? 'b' : top.tier, plain = !top.breather;
        tally.tiers[tier] = (tally.tiers[tier] || 0) + 1; tally.shown += 1;
        // 라. 세 번 놓친 단위는 이 판에서 더 내지 않는다
        for (const unit of units) { const state = session.retries.get(unit); if (state && !state.pending && state.tries >= P.retryMax) fail(seed, step, '라. 다시를 다 쓴 단위를 또 냄', `${unit} · ${tier}층`); }
        // 바. 겨눈 단위와 이유
        if (plain && top.tier in REASONS) {
          if (!top.target || !units.includes(top.target)) fail(seed, step, '바. 겨눈 단위가 없거나 문항 밖', `${tier}층 · ${top.target}`);
          if (!REASONS[top.tier].includes(top.why.code)) fail(seed, step, '바. 이유가 층과 다름', `${tier}층 · ${top.why.code}`);
          if (top.why.slots.unit !== top.target) fail(seed, step, '바. 이유의 근거 칸에 겨눈 단위가 없음', `${top.why.code} · ${top.why.slots.unit} ≠ ${top.target}`);
        }
        if (plain && (top.tier === 0 || top.tier === 5)) {
          if (pendingAt(top.target) == null) fail(seed, step, '라. 기다리지 않는 단위를 다시로 냄', top.target);
          if (!has(top.target)) fail(seed, step, '라. 기억이 없는 단위를 다시로 냄(본인 말이 다시를 거두지 않음)', top.target);
          retried.set(top.target, (retried.get(top.target) || 0) + 1);
          if (retried.get(top.target) > P.retryMax) fail(seed, step, '라. 한 단위를 다시로 세 번 넘게 냄', `${top.target} ${retried.get(top.target)}번`);
          // 아. 다시의 간격
          if (top.tier === 0 && pendingAt(top.target) < P.retryGap) fail(seed, step, '아. 문항 둘이 지나기 전에 다시 냄', `${top.target} · ${pendingAt(top.target)}문항 뒤`);
          if (top.tier === 5 && rows.some(row => row.tier <= 4 && !row.repeat)) fail(seed, step, '아. 낼 것이 있는데 다시를 당겨 냄', top.item.id);
          // 문항 안에서는 가장 먼저 놓친 단위를 겨누고, 다시 낼 문항이 여럿이면 다른 문항으로 낼 수 있는 것 → 먼저 놓친 것 순이다
          const aimOf = item => { const pending = unitsOf(item).filter(unit => pendingAt(unit) != null).sort((a, b) => session.retries.get(a).position - session.retries.get(b).position); return pending.find(unit => pendingAt(unit) < P.retryGap) ?? pending[0]; };
          const rank = item => { const unit = aimOf(item), asked = session.retries.get(unit); return [item.familyKey !== asked.family ? 0 : 1, asked.position]; };
          if (aimOf(top.item) !== top.target) fail(seed, step, '아. 문항 안에서 먼저 놓친 단위를 겨누지 않음', `${top.target} ≠ ${aimOf(top.item)}`);
          const mine = rank(top.item);
          if (top.tier === 0 && rows.some(row => row !== top && row.tier === 0 && row.repeat === top.repeat && (rank(row.item)[0] < mine[0] || (rank(row.item)[0] === mine[0] && rank(row.item)[1] < mine[1])))) fail(seed, step, '아. 다시를 놓친 순서대로 내지 않음', top.item.id);
        }
        // 마. 돌아온 것: 이 판에서 만난 단위가 아니고, 정말 돌아왔고(같은 자리 밖 · 떠올릴 확률이 목표 아래), 하루 상한 안이다
        if (plain && top.tier === 1) {
          today.reviews += 1;
          if (session.met.has(top.target)) fail(seed, step, '마. 이 판에서 만난 단위를 돌아온 것으로 냄', top.target);
          if (!due(top.target)) fail(seed, step, '마. 돌아오지 않은 단위를 돌아온 것으로 냄', `${top.target} · 같은 자리 ${sitting(top.target)} · 확률 ${recall(top.target)?.toFixed(3)}`);
          // 자. 급한 것부터, 밀렸으면 살릴 수 있는 것부터
          let backlog = 0; for (const unit of learner.memory.keys()) if (due(unit)) backlog += 1;
          const rescue = backlog > P.backlog, edge = list => (rescue ? Math.max(...list) : Math.min(...list)), mine = recall(top.target);
          if (rescue) tally.rescue += 1;
          if (!near(mine, edge(units.filter(due).map(recall)))) fail(seed, step, '자. 문항 안에서 겨눈 단위가 차례와 다름', `${top.target} · 밀림 ${rescue}`);
          for (const row of rows) {
            if (row === top || row.tier !== 1 || row.repeat !== top.repeat) continue;
            const other = edge(unitsOf(row.item).filter(due).map(recall));
            if (rescue ? other > mine + 1e-9 : other < mine - 1e-9) { fail(seed, step, rescue ? '자. 밀렸는데 살릴 수 있는 것부터가 아님' : '자. 급한 것부터가 아님', `낸 것 ${mine.toFixed(4)} · 다른 후보 ${other.toFixed(4)}`); break; }
          }
          // 차. 셋에 하나 새것
          if (sinceNew >= P.interleave && rows.some(row => row.tier === 2 && !row.repeat)) fail(seed, step, '차. 돌아온 것이 셋 이어졌는데 새것을 끼우지 않음', `이어진 수 ${sinceNew}`);
          if (sinceNew >= P.interleave) tally.weave += 1;
        }
        // 차. 새것을 돌아온 것 앞에 끼우는 것은 차례가 됐을 때(돌아온 것이 셋 이어진 뒤)뿐이다 · 새것은 진도 순
        if (plain && top.tier === 2 && sinceNew < P.interleave && rows.some(row => row.tier === 1 && row.repeat <= top.repeat)) fail(seed, step, '차. 차례가 아닌데 새것을 돌아온 것 앞에 끼움', `이어진 수 ${sinceNew}`);
        if (plain && top.tier === 2 && rows.some(row => row.tier === 2 && row.repeat === top.repeat && (row.item.order ?? 0) < (top.item.order ?? 0))) fail(seed, step, '차. 새것이 진도 순이 아님', top.item.id);
        // 카. 숨 고르기의 자격, 그리고 낼 수 있으면 건너뛰지 않는다
        const rested = item => tierOf(item) !== 9 && unitsOf(item).every(unit => has(unit) && !session.met.has(unit) && !sitting(unit) && recall(unit) >= P.retention);
        if (top.breather && !(missStreak >= P.breatherAfter && rested(top.item))) fail(seed, step, '카. 숨 고르기의 자격이 없음', `${top.item.id} · 이어서 놓친 수 ${missStreak}`);
        if (plain && missStreak >= P.breatherAfter && (top.tier === 0 || top.tier === 2 || (top.tier === 1 && top.p < P.breatherSuccess)) && rows.some(row => !row.repeat && rested(row.item))) fail(seed, step, '카. 숨 고르기를 건너뜀', `${tier}층`);
        // 타. 이유의 근거 칸은 기록과 같다
        if (plain) {
          const s = top.why.slots, state = top.target ? mem(top.target) : null, ability = learner.ability.get(top.item.skillId), level = learner.level.get(top.item.skillId);
          const elapsed = state && has(top.target) ? Math.max(1, Math.round((now - state.lastAt) / DAY)) : null;
          const wrong = top.why.code === 'unit.retry' ? s.misses !== (state?.lapses ?? 0) || s.reviews !== (state?.sittings ?? 0) || s.other !== (top.item.familyKey !== session.retries.get(top.target)?.family)
            : top.why.code === 'unit.shaky' ? !(state.lapses > 0) || s.misses !== state.lapses || s.reviews !== state.sittings || s.days !== elapsed
            : top.why.code === 'unit.due' ? state.lapses !== 0 || s.days !== elapsed
            : top.why.code === 'skill.up' ? !(level != null && top.item.difficulty > level && ability?.streak >= 2 && s.streak === ability.streak && s.from === level && s.to === top.item.difficulty)
            : top.why.code === 'skill.ease' ? !(level != null && top.item.difficulty < level && ability?.n > 0 && ability.streak === 0 && s.from === level && s.to === top.item.difficulty)
            : top.why.code === 'unit.new' ? has(top.target) : false;
          if (wrong) fail(seed, step, '타. 이유의 근거 칸이 기록과 다름', `${top.why.code} ${JSON.stringify(s)}`);
        }
        // 파. 예상 성공 확률 = 찍기 바닥 + (1 − 찍기 바닥) × 기억 항 × 능력 항(처음 보는 계열이거나 처음 만나는 단위가 있을 때만)
        {
          const g = P.guess[top.item.responseFormat] ?? P.guess.unknown, known = units.filter(has);
          const ability = known.length < units.length || !learner.met.has(top.item.familyKey) ? 1 / (1 + Math.exp(-((learner.ability.get(top.item.skillId)?.theta ?? 0) - (P.difficultyLogit[top.item.difficulty] ?? 0)))) : 1;
          const want = g + (1 - g) * known.reduce((product, unit) => product * recall(unit), 1) * ability;
          if (!near(top.p, want)) fail(seed, step, '파. 예상 성공 확률이 식과 다름', `낸 값 ${top.p.toFixed(6)} · 식 ${want.toFixed(6)}`);
        }
        // 다. 새 단위 한도 — 시험이 따로 센다: 기억이 없고 오늘 아직 낸 적 없는 단위가 「처음 낸 단위」다
        const fresh = units.filter(unit => !has(unit) && !today.units.has(unit)), here = units.filter(unit => !has(unit) && !sessionUnits.has(unit));
        present(learner, top);
        for (const unit of fresh) today.units.add(unit);
        for (const unit of here) sessionUnits.add(unit);
        const sessionNew = sessionUnits.size;
        sinceNew = (plain && top.tier === 2) || here.length ? 0 : plain && top.tier === 1 ? sinceNew + 1 : sinceNew;
        if (!more && here.length && sessionNew > P.newPerSession) fail(seed, step, '다. 한 판 새 단위 한도를 넘김', `${sessionNew}/${P.newPerSession}`);
        if (!today.more && today.units.size > P.newPerDay) fail(seed, step, '다. 하루 새 단위 한도를 넘김', `${today.units.size}/${P.newPerDay}`);
        if (!more && fresh.length && today.units.size > P.newPerDay) fail(seed, step, '다. 한도가 찬 날에 새 단위를 더 냄', `${today.units.size}/${P.newPerDay}`);
        if (today.units.size !== learner.day.introduced.size || sessionNew !== session.introduced.size) fail(seed, step, '다. 두뇌가 센 새 단위 수가 시험이 센 것과 다름', `오늘 ${learner.day.introduced.size}/${today.units.size} · 이 판 ${session.introduced.size}/${sessionNew}`);
        if (today.reviews > P.reviewsPerDay) fail(seed, step, '마. 돌아온 것으로 낸 문항이 하루 상한을 넘음', `${today.reviews}/${P.reviewsPerDay}`);
        if (today.reviews !== learner.day.reviews) fail(seed, step, '마. 두뇌가 센 돌아온 것 수가 시험이 센 것과 다름', `${learner.day.reviews}/${today.reviews}`);
        // 답한다
        const q = r(), answer = q < 0.07 ? { correct: null, assessable: false } : { correct: r() < skillOf, assisted: r() < 0.1, answerShown: r() < 0.03 };
        if (blanked.has(top.item.id)) fail(seed, step, '사. 판정하지 못한 문항을 그 판에서 다시 냄', top.item.id);
        if (answer.assessable === false) { tally.blank += 1; blanked.add(top.item.id); }
        const lapses = new Map(units.map(unit => [unit, mem(unit)?.lapses ?? 0]));
        const result = record(learner, memory, top.item, { ...answer, target: top.target }, now, P);
        if (result.grade != null) missStreak = result.grade === 'again' ? missStreak + 1 : 0;
        if (result.grade === 'again') {
          const aim = top.target && units.includes(top.target) ? top.target : units[0];
          if (result.credited.length !== 1 || result.credited[0] !== aim) fail(seed, step, '바. 실패가 겨눈 단위가 아닌 곳에 적힘', `${result.credited} ≠ ${aim}`);
          for (const unit of units) if (unit !== aim && (mem(unit)?.lapses ?? 0) !== lapses.get(unit)) fail(seed, step, '바. 겨누지 않은 단위의 놓침이 늘어남', unit);
        }
        if (learner.waitUnits.size || learner.waitSkills.size) fail(seed, step, '가. 제 차례로 쓰는 기기에 기다리는 줄이 생김', `단위 ${[...learner.waitUnits]} · 능력 ${[...learner.waitSkills]}`);
        // 판정 못 한 답은 다시 낸 횟수에 세지 않고(다시 낼 차례가 그대로 남는다), 본인 말은 그 단위의 다시를 거둔다(다시 세기 시작한다).
        if (result.grade == null && plain && (top.tier === 0 || top.tier === 5)) retried.set(top.target, retried.get(top.target) - 1);
        if (r() < 0.05) { const unit = pick(r, units); say(learner, memory, unit, r() < 0.5 ? 'known' : 'relearn', now + 500); retried.delete(unit); tally.says += 1; }
        now += 15000 + Math.floor(r() * 30000);
      }
      now += pick(r, [60000, 20 * 60000, 3 * HOUR, 7 * HOUR]);
    }
    now = (Math.floor(now / DAY) + pick(r, [1, 1, 2, 5, 30, 70])) * DAY + Math.floor(r() * 12) * HOUR + Math.floor(r() * 1000);
  }
}
const tiers = Object.entries(tally.tiers).sort().map(([tier, n]) => `${tier === 'b' ? '숨 고르기' : tier + '층'} ${n}`).join(' · ');
console.log(`임의의 학습자 ${count}명(씨앗 ${first}~${first + count - 1}) — 판 ${tally.sessions}개(「더 배우기」 ${tally.more}) · 낸 문항 ${tally.shown}개(${tiers})`);
console.log(`그 가운데 할 것 없음(idle) ${tally.idle} · 하루 상한에 걸림 ${tally.capped} · 낼 것 없음으로 끝난 판 ${tally.none} · 판정 못 한 답 ${tally.blank} · 본인 말 ${tally.says} · 밀린 채 낸 돌아온 것 ${tally.rescue} · 새것을 끼울 차례 ${tally.weave}`);
const kinds = new Map(); for (const row of bad) kinds.set(row.rule, (kinds.get(row.rule) || 0) + 1);
console.log(`지켜야 할 것과 차례의 속성을 어긴 것: ${bad.length}${bad.length >= 400 ? '+' : ''}${kinds.size ? ' — ' + [...kinds].map(([rule, n]) => `${rule} ${n}`).join(' · ') : ''}`);
const seenRule = new Set();
for (const row of bad) { if (seenRule.has(row.rule)) continue; seenRule.add(row.rule); console.log(`   씨앗 ${row.seed} · ${row.step}번째 · ${row.rule}: ${row.detail}`); }
if (bad.length) process.exitCode = 1;
