// 코치의 순간 맞춤 · 오늘 · 표시 설정(단계 4 계획 §23-4). 옛 겉(atlas/game-flow.js createLive)의 메서드 이름 · 결과 꼴을 그대로 내고,
// 알고리즘은 src/flow(옛 Flow를 옮긴 것)다. 다른 점:
//   - 문항 난도는 두뇌가 고른다 — pick(후보, 옵션)은 recommend와 같고, Flow는 낸 문항의 난도를 관찰만 한다(items는 손잡이가 아니다).
//   - 판 정한 값을 제시 사건에 싣지 않는다 — 2판 제시 사건에 그 칸이 없다(Fable F2 · 설계 주인 11-19 밤). 값은 trace와 내용 기억에만 있다.
//   - 한 제시는 Flow를 한 번만 움직인다 — 그 제시의 첫 판정 답, 또는 게임이 flow.outcome(시간 초과 등)을 준 관찰 가운데 먼저 온 하나.
//     다시 서빙(같은 제시의 뒤 답)은 움직이지 않는다(23-5와 같은 뜻 — 옛 판과 다른 자리, 대조 시험은 「의도한 차이」로 단언).
//   - 「모르겠어요」(unknown — 접기가 놓침으로 매긴 답, §3-2)는 실패로 관찰하고 그 제시의 한 번을 쓴다. 옛 겉은 void로 보냈다 — 옛 겉은 답마다
//     Flow를 움직였지만, 여기서는 그 제시가 열린 채 남아 뒤 답의 맞힘이 첫 성공으로 섰다(5-3 ① 엔진 d 카본 B).
//   - 도움 여부(assisted)는 그 답의 접기 값, 다시 본 문항(repeat)은 제시할 때 동기에 정한다(Fable F5 · 카본 A6 · 카본 다시 검토 A1).
//   - 앞선 값(옛 priorFromSummary)은 쓰지 않는다 — 내용 기억이 없으면 내용의 시작값에서 연다.
// 오늘 · 표시 설정은 셸이 넘기는 읽개(host.prefs.today · .presentation)를 읽는다. 바꾸기는 지금처럼 WORLD 화면이 한다.
import { CONDITIONS, declaredFrom, defineContent, PRESENTATION, start } from '../flow/index.mjs';
import { line as flowLine, stuckFor, supportStep } from '../flow/lines.mjs';

const object = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
// 표시 설정의 낱말 안에서 고른 값만(null은 고르지 않음) — 낱말 밖이면 없는 것으로 읽는다.
const presentationOf = value =>
  object(value) &&
  Object.keys(value).length > 0 &&
  Object.entries(value).every(
    ([key, choice]) =>
      Object.hasOwn(PRESENTATION, key) && (choice === null || PRESENTATION[key].includes(choice)),
  );
const JUDGED = { correct: 'success', incorrect: 'fail', unknown: 'fail' };
// Flow의 근거가 되는 결과 — 이것만 그 제시의 한 번을 쓴다. void · skip은 관찰해도 몫을 쓰지 않는다(소리를 다 듣기 전에 서빙한 주문 뒤의
// 첫 판정 답이 막히지 않게, GPT 다시 검토 GA3).
const EVIDENCE = new Set(['success', 'fail', 'timeout']);

function readPref(prefs, name) {
  try {
    return typeof prefs?.[name] === 'function' ? prefs[name]() : null;
  } catch {
    return null;
  }
}

// 셸이 넘긴 오늘 컨디션(기기 하루) — 낱말 밖이면 null.
export function todayOf(prefs) {
  const value = readPref(prefs, 'today');
  return CONDITIONS.includes(value) ? value : null;
}

// 셸이 넘긴 표시 설정 — 낱말 밖이면 null.
export function presentationFrom(prefs) {
  const value = readPref(prefs, 'presentation');
  return presentationOf(value) ? { ...value } : null;
}

// live 겉 하나를 만든다. coach: { recommend, present, answer(pid, result) → { recorded, assisted }, metBefore(item) }.
// memory: createFlowMemory의 것. clock(): ISO 시각.
export function createLive({ coach, memory, prefs, clock }) {
  return function live(input, options = {}) {
    const { arm = 'adapted', condition, level = 'standard', words = {} } = options;
    let { declared = {}, presentation } = options;
    const spec = defineContent(input);
    // 본인이 고른 표시 설정이 도움과 선언 손잡이를 잡는다 — 이 내용이 스스로 건 잠금(declared.knobs)이 이긴다. 게임이 값을 주지 않으면
    // 셸이 넘긴 표시 설정이고, null이면 이번 판에는 없다.
    if (presentation === undefined) presentation = presentationFrom(prefs);
    if (presentation != null) {
      const knobs = { ...declaredFrom(spec, presentation).knobs, ...declared?.knobs };
      if (Object.keys(knobs).length) declared = { ...declared, knobs };
    }
    const since = memory.since();
    const run = start({
      spec,
      memory: memory.memory(spec.id),
      prior: null,
      declared,
      condition: condition === undefined ? todayOf(prefs) : condition,
      arm,
      now: clock(),
    });
    const say = event => flowLine(event, { level, words });
    const save = () => memory.save(spec.id, run.memory(clock()), since);
    const shown = new Map(); // 제시 번호 → { level, repeat }
    const moved = new Set(); // Flow를 이미 움직인 제시 번호
    const result = observed => ({
      ...observed,
      line: observed.change ? say(observed.change) : null,
    });
    const still = recorded => ({
      recorded,
      change: null,
      settings: run.settings(),
      evidence: false,
      line: null,
    });
    // 이 답(또는 게임이 준 관찰)이 Flow를 움직일 결과 — 없으면 null.
    // 게임이 결과를 주지 않으면 접기가 판정한 답(grade)만 움직인다 — 소리 전달이 안 된 답은 게임이 맞음이라 해도 몫을 쓰지 않는다(GPT 끝 판 D3).
    const outcomeOf = (pid, { verdict, grade }, flow) => {
      if (moved.has(pid)) return null;
      return flow.outcome ?? (grade == null ? null : (JUDGED[verdict] ?? null));
    };
    return Object.freeze({
      spec,
      settings: run.settings,
      intro() {
        const intro = run.intro();
        return { ...intro, line: say(intro) };
      },
      // 문항 단계는 두뇌가 고른다 — Flow가 원하는 문항 단계는 없다.
      level: () => null,
      pick(candidates, pickOptions = {}) {
        const { within: _within, ...rest } = pickOptions;
        return coach.recommend(candidates, rest);
      },
      // 다시 본 문항은 제시할 때 정한다 — 제품이 「처음이 아니다」라고 했거나 제시하기 전 만남 표에 있으면. 답할 때 보면 이 제시의 첫 도움이
      // 만남으로 들고, 「처음이 아니다」 제시의 장부 만남은 답할 때에야 선다(카본 다시 검토 A1).
      present(item, presentOptions) {
        const repeat = presentOptions?.firstExposure === false || coach.metBefore(item) === true;
        const pid = coach.present(item, presentOptions);
        const levels = spec.items?.levels;
        shown.set(pid, {
          level: levels?.includes(item?.difficulty) ? item.difficulty : null,
          repeat,
        });
        return pid;
      },
      // 기록 먼저(코치의 답), 그다음 같은 응답이 Flow를 움직인다 — 한 제시에 한 번만. flow: { outcome, pressure, latencyMs, assisted, repeat }.
      answer(pid, response, flow = {}) {
        const { recorded, assisted } = coach.answer(pid, response);
        const outcome = outcomeOf(pid, recorded, flow);
        if (!outcome) return still(recorded);
        if (EVIDENCE.has(outcome)) moved.add(pid);
        const seen = shown.get(pid);
        const observed = run.observe({
          outcome,
          assisted: flow.assisted ?? assisted === true,
          repeat: flow.repeat ?? seen?.repeat === true,
          pressure: flow.pressure ?? null,
          latencyMs: flow.latencyMs ?? null,
          level: seen?.level ?? null,
        });
        save();
        return { recorded, ...result(observed) };
      },
      // 문항이 아닌 응답(게임 동작 · 떠난 손님). pid를 주면 그 제시의 한 번 몫을 쓴다(그 뒤 첫 판정 답은 움직이지 않는다).
      // 제시가 있는 관찰(오답 뒤 떠난 손님의 시간 초과)은 그 제시 번호를 준다 — 답과 같은 한 번을 나눠 쓴다(GPT 다시 검토 GA3).
      observe(input, pid = null) {
        if (pid != null) {
          if (moved.has(pid))
            return { change: null, settings: run.settings(), evidence: false, line: null };
          if (EVIDENCE.has(input?.outcome)) moved.add(pid);
        }
        const observed = run.observe(input);
        save();
        return result(observed);
      },
      stuck: base => stuckFor({ latencies: run.latencies(), ...(base ? { base } : {}) }),
      offerLessHelp() {
        const support = spec.knobs.find(
          knob => knob.kind === 'support' && knob.follows !== 'declared',
        );
        if (!support || !run.settings().adaptive) return { offer: false, reason: 'not-available' };
        const step = supportStep({
          at: run.settings().indices[support.id],
          last: support.values.length - 1,
          streak: run.quietStreak(),
          steady: run.steadyStreak(),
          declared: Object.hasOwn(declared.knobs || {}, support.id),
          declinedAt: memory.declined(spec.id),
          now: clock(),
        });
        // 방금 바뀐 것 위에 겹쳐 내지 않는다 — 더 차분한 때에 낸다.
        return step.offer && !run.lessHelpAllowed() ? { offer: false, reason: 'not-now' } : step;
      },
      acceptLessHelp() {
        const change = run.acceptLessHelp();
        save();
        return change && { ...change, line: say(change) };
      },
      declineLessHelp: () => memory.decline(spec.id, clock(), since),
      floor: run.floor,
      end() {
        save();
        return { settings: run.settings(), changes: run.changes(), floor: run.floor() };
      },
      trace: run.trace,
    });
  };
}
