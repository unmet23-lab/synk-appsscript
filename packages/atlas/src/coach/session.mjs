// 코치 하나의 판(단계 4 계획 §3-3 · §3-7). 두뇌(src/select)를 그대로 돌리고, 사건은 호스트의 기록부에 쓴다.
//   평소: present · answer · tell이 두뇌의 present · record · say로 학습자를 바로 고친다 — 저장이 다 되는 동안 결정은
//         두뇌만 돌린 것과 한 글자도 다르지 않다.
//   두뇌에 넘기는 답 · 문항은 그 제시의 사건 묶음을 기록의 어댑터(foldEventsOf)로 바꾼 접기 사건에서 꺼낸다(기기 얹기 · 서버 접기와 같은 값).
//   판 일지: 판을 열 때의 옵션 · 시각 · 보기 사본과, 그 뒤의 present · answer · tell. 바깥이 바뀌면(저장 실패 · 제외 · 다른 탭 ·
//         같은 문서 다른 코치의 쓰기 · 서버 요약 · 옛 기록 옮기기) 기억 · 능력 · 만남은 호스트 보기로 바꿔 끼우고, 판 상태(shown · session ·
//         day · log)는 실패 · 제외한 사건을 뺀 일지를 다시 돌려 세운다. 「낸 것」(log)은 그때마다 호스트의 것 전부를 다시 받고 다시 돌릴 내
//         제시만 사건 번호로 뺀다(계획 §16 ①). 판 열기는 일지가 빈 다시 세우기다. 보기가 아무것도 얹지 못하는 동안(waitAll — 판 묶음이 다른
//         요약 등)은 판을 열 때의 보기 사본 위에 일지를 통째로 다시 돌린다 — 이 판의 내 답은 판 안의 고르기에서 늘 본 것이다(Fable 설계 P2-2 가).
//   판 수명(Fable 설계 P2-1): set은 한 판에 한 번 — 문항이 나간 판에 같은 뜻의 set이 또 오면 무시한다(「더 배우기」는 more로 새 판).
//         판 없이 연 기본 판은 날이 바뀌거나 오래 쉬면 새로 연다. 본인 말(tell)은 판을 열지 않는다.
import { applyOwn } from '../fold/device.mjs';
import { unitsOf } from '../fold/units.mjs';
import { foldEventsOf } from '../record/adapt.mjs';
import { EVENT_TYPES } from '../record/events.mjs';
import { choose } from '../select/choose.mjs';
import { filterCandidates } from '../select/filter.mjs';
import { dayKey, present, record, say, startSession } from '../select/session.mjs';
import { hostRow, presentedFields } from './fields.mjs';

export const learnerOf = view => ({
  ...view,
  shown: [],
  log: [],
  day: null,
  session: null,
  seq: 0,
});
// 판을 열 때의 보기 사본 — 두뇌가 학습자의 표(Map)를 고치므로 표만 새로 뜬다(줄 값은 늘 새 객체로 바뀐다).
// 판 안의 사본은 아무것도 얹지 못하는 보기(waitAll)에서 떠도 내 답을 얹는다 — 이 판의 내 답은 판 안의 고르기에서 늘 본 것이다
// (Fable 설계 P2-2 가). 두뇌의 applyOwn은 waitAll이면 얹지 않으므로 사본에서는 끈다(줄마다 기다림은 그대로 지킨다, 단계 2 GPT GA1).
const copyView = view => ({
  ...view,
  waitAll: false,
  memory: new Map(view.memory),
  ability: new Map(view.ability),
  met: new Map(view.met),
  waitUnits: new Set(view.waitUnits ?? []),
  waitSkills: new Set(view.waitSkills ?? []),
  mine: new Set(view.mine ?? []),
});
const entryOf = event => ({ event, key: event.id, atMs: Date.parse(event.at) });
// 판 없이 연 기본 판이 이만큼 쉬면 새 판이다(날이 바뀌어도 새 판).
export const DEFAULT_SET_IDLE_MS = 30 * 60_000;
// 같은 뜻의 판 옵션인가 — 길이 · 새것 한도 · 연습 수준.
const setSign = set =>
  JSON.stringify([
    set?.length ?? null,
    set?.newLimit ?? null,
    set?.level?.min ?? null,
    set?.level?.max ?? null,
  ]);
// 제품이 후보를 좁힌 까닭(recommend의 pool — 예: 'unseen' 처음 보는 문항만). 고른 줄의 근거 칸에 그대로 실려 단계 5가 제품이 좁힌
// 측정 문항과 엔진의 보통 채우기를 가른다(조율 11-11). 회차(arm)는 바꾸지 않는다 — 좁힌 묶음 안에서는 엔진이 골랐다.
const POOL = /^[a-z][a-z0-9-]{0,23}$/;
const pooled = (row, pool) =>
  row && typeof pool === 'string' && POOL.test(pool)
    ? { ...row, why: { ...row.why, evidence: { ...row.why.evidence, pool } } }
    : row;
// 본인 말이 그 줄에 남긴 때 — 「다시 배울래요」는 빈 줄, 「이미 알아요」는 열린 자리가 known이다.
const saidAt = line =>
  line?.empty ? line.latestAt : line?.open?.grade === 'known' ? line.open.at : null;
const issuedOf = row => event => ({
  id: event.id,
  at: Date.parse(event.at),
  review: row.tier === 1,
  units: [...row.brandNew],
});
// 판 번호의 코치 꼬리 — 같은 경험 이름의 코치 둘이 같은 밀리초에 판을 열어도 번호가 갈린다(Fable 5.2 D9).
const coachTag = () =>
  Array.from(
    { length: 6 },
    () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)],
  ).join('');

const HELP_LEVELS = { answer: 'answer', explanation: 'explanation' };
const HELP_KINDS = ['text', 'hint', 'answer', 'replay', 'explanation'];
const REASONS = ['motor', 'audio', 'unanswered', 'demo', 'visual', 'storage'];
const OPTION = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;

export function verdictOf(result, item) {
  if (!result || ![true, false, null].includes(result.correct ?? null))
    throw new TypeError('Atlas coach: 답은 correct(true · false · null)를 싣는다');
  if (result.unknown === true) {
    if (!item.unknownOption)
      throw new TypeError('Atlas coach: 「모르겠어요」를 두지 않은 문항이다');
    return 'unknown';
  }
  if (typeof result.assessable !== 'boolean')
    throw new TypeError('Atlas coach: 답은 판정할 수 있는가(assessable)를 싣는다');
  if (!result.assessable) return 'unassessed';
  if (result.correct == null) return 'skipped';
  return result.correct ? 'correct' : 'incorrect';
}

function attemptFields(pid, attemptNo, verdict, result) {
  const choice = result.choice;
  // 정규식 test는 null · 수 · 참거짓을 글자로 바꿔 통과시킨다 — 글자일 때만(카본 끝 판 D).
  const option = id => typeof id === 'string' && OPTION.test(id);
  const choiceOk = choice && option(choice.selectedId) && option(choice.correctId);
  return {
    presentationId: pid,
    attemptNo,
    verdict,
    errorTags: [],
    ...(REASONS.includes(result.reason) ? { reason: result.reason } : {}),
    ...(choiceOk ? { choice: { selectedId: choice.selectedId, correctId: choice.correctId } } : {}),
  };
}

// 그 제시의 묶음(제시 + 전달 · 도움 · 답)에서 이 사건이 더하는 접기 사건들 — 그 사건까지 접은 것에서 그 사건 앞까지 접은 것을 뺀다(어댑터
// foldEventsOf — 기기 얹기 · 서버 접기와 같은 값). 이 사건이 그 제시의 첫 만남이면 제품이 「처음이 아니다」라고 한 제시의 장부 만남(어댑터
// priorOf)이 그 앞에 든다 — 그것을 버려 판 안의 학습자만 그 답을 첫 만남으로 세던 것(카본 끝 판 둘째 E). 도움 둘째 · 첫 답 뒤 도움 · 전달은
// 접기 사건이 없다(빈 목록).
// 거름 둘(marks): failed — 저장이 실패한 사건 번호. 기록부에 없는 사건이라 묶음에서 뺀다(그 도움 · 전달은 없던 것, 아르곤 끝 판 C6).
// excluded — 제외된 사건 번호 → 그 제외 사건. 기록부에 든 사건이라 빼지 않고 제외로 넘겨 어댑터가 뜻대로 접는다 — 제외된 도움도 도움이고
// (만남 · 도움 표시 그대로 — 설계 §5-2 「제외는 만났다는 사실을 지우지 않는다」), 제외된 전달 뒤의 소리는 「아직」이다(Fable 5.2 끝 판 둘째
// 넘친 #16 — 둘을 한 표로 「없던 것」으로 접어 답을 낼 때 이미 기록부와 갈렸다). 판 일지를 다시 돌릴 때도 지금 거름으로 이것을 다시
// 부른다 — 처음 접은 값(도움 · 답을 봤나 · 판정할 수 있나)은 그 뒤 앞 자식이 실패 · 제외되면 낡는다(GPT · 카본 끝 판 둘째 E). 제외 접기
// 사건(exclude)은 내지 않는다 — 제외된 답 · 제시는 판 일지에서 빠진다(kept).
function foldsOf(group, event, index, { failed, excluded }) {
  const at = group.children.findIndex(entry => entry.event.id === event.id);
  const before = (at < 0 ? group.children : group.children.slice(0, at)).filter(
    entry => !failed.has(entry.event.id),
  );
  const members = new Set([
    group.source.event.id,
    event.id,
    ...before.map(entry => entry.event.id),
  ]);
  const exclusions = [...excluded.values()].filter(entry => members.has(entry.event.targetId));
  const fold = children => foldEventsOf({ source: group.source, children, exclusions }, index);
  const had = new Set(fold(before).map(made => made.id));
  return fold([...before, entryOf(event)]).filter(
    made => !had.has(made.id) && made.kind !== 'exclude',
  );
}

// 닫은 판의 기록 자리가 아직 기록하지 않았고 지금 쓰는 중도 아닌가 — 같은 판을 두 번 기록하지 않는다(아르곤 끝 판 C7 · GPT 최종 GC2).
const unrecorded = slot => Boolean(slot) && !slot.recorded && !slot.writing;

export function createSession({ host, gameId, seed, dayOffset, mapItem }) {
  const params = host.params;
  const memory = host.memory;
  const s = {
    learner: null,
    open: null,
    journal: [],
    failed: new Set(), // 저장이 실패한 사건 번호
    excluded: new Map(), // 제외된 내 사건 번호 → 그 제외 사건(기록부가 든 것)
    setId: null,
    setSeq: 0,
    chosen: new Map(),
    groups: new Map(),
    own: new Set(), // 이 코치가 쓴 사건 번호 — 같은 문서 다른 코치의 쓰기만 다시 세우기를 부른다
    closed: null, // 닫은 판의 기록 자리 { setId, recorded, writing, decision }
    lastAt: 0,
    tag: coachTag(),
  };

  // 판을 연다. fallback: 판 없이 부른 메서드가 연 기본 판(판 옵션 없음). 판 열기는 일지가 빈 다시 세우기다(Fable 5.2 권고 — 두 길이
  // 갈릴 자리를 없앤다). 판을 열 때 남기는 것은 시각 · 옵션과, 보기가 아무것도 얹지 못할 때 일지를 다시 돌릴 바탕(base)뿐이다.
  function openSet(options = {}, { fallback = false } = {}) {
    const now = host.now();
    s.open = {
      now,
      opts: { ...options, dayOffset },
      base: host.view(),
      fallback,
      sign: setSign(options),
    };
    s.journal = [];
    s.failed.clear();
    s.excluded.clear();
    s.chosen.clear();
    s.groups.clear(); // 앞 판의 제시 번호는 이 판에서 받지 않는다(GPT GC4)
    s.lastAt = now;
    s.setSeq += 1;
    s.setId = `set.${gameId}.${now}.${s.tag}.${s.setSeq}`;
    build();
    return s.learner;
  }

  // 판이 낡았나 — 날이 바뀌었거나 오래 쉬었다. 기본 판은 이때 새로 열고(제품이 판을 닫지 않는 길에서 어제의 한도를 들지 않게),
  // 같은 뜻의 set도 이때는 새 판이다.
  const aged = now =>
    dayKey(now, params, dayOffset) !== s.learner.day.key || now - s.lastAt >= DEFAULT_SET_IDLE_MS;
  const stale = now => Boolean(s.open?.fallback) && aged(now);
  // 이 판에 낸 수 — 저장에 실패했거나 제외된 제시는 판 상태(build)에서 빠지므로 여기서도 세지 않는다(카본 끝 판 둘째 E — 판 길이를 다
  // 채우기 전에 새 판이 열리던 것).
  const served = () => s.journal.filter(op => op.kind === 'present' && kept(op)).length;

  const ensure = () => {
    const now = host.now();
    const learner = s.learner?.session && !stale(now) ? s.learner : openSet({}, { fallback: true });
    s.lastAt = now;
    return learner;
  };
  // 문항이 나간 판에 같은 뜻의 set이 또 왔다 — 그 판이 아직 안 끝났으면 다시 열지 않는다(문항마다 set을 넘기는 제품이 「다시」 · 한도 ·
  // 판 번호를 잃지 않게). 판의 끝은 코치가 스스로 안다 — 판 길이만큼 문항이 나갔거나, 오래 쉬었거나 날이 바뀌었으면 새 판이다
  // (판을 닫지 않는 제품의 다음 판이 앞 판에 이어 붙어 새것이 굶지 않게 — Fable 다시 확인 N1).
  const repeated = set => {
    if (!s.learner?.session || s.open.fallback || set.more || s.open.sign !== setSign(set))
      return false;
    const count = served();
    const length = Number.isInteger(set.length) && set.length > 0 ? set.length : Infinity;
    return count > 0 && count < length && !aged(host.now());
  };

  // 일지 한 줄을 판 상태에 다시 돌린다(기억은 버리는 사본이라 두 번 얹혀도 상관없다 — 기억은 호스트 보기에서 온다). 답 · 도움은 지금 거름
  // (실패 · 제외)으로 그 제시 묶음을 다시 접어 돌린다(foldsOf — 장부 만남 · 앞 도움이 빠져 첫 도움이 된 도움까지).
  function replay(tmp, op) {
    if (op.kind === 'present') present(tmp, op.row, params);
    else if (op.kind === 'say') say(tmp, memory, op.unit, op.say, op.at, params);
    else if (op.kind === 'answer' || op.kind === 'help') {
      const group = s.groups.get(op.parent);
      const event = group?.children.find(entry => entry.event.id === op.eventId)?.event;
      if (event) for (const fold of foldsOf(group, event, host.index, s)) apply(tmp, fold);
    }
  }
  // 접기 사건 하나를 학습자에 얹는다 — 답은 두뇌의 record(판의 「다시」 · 만난 단위까지), 도움 만남 · 장부 만남은 기기 얹기 그대로.
  function apply(learner, fold) {
    if (fold.kind === 'answer')
      return record(learner, memory, fold.item, { ...fold.answer, id: fold.id }, fold.at, params);
    applyOwn(learner, fold, memory, params, host.index);
    return null;
  }

  // 판 일지에 남는 줄 — 저장이 실패한 줄과 그 자식은 빠진다. 제외된 답 · 제시(제시면 그 답까지) · 본인 말도 빠진다(계획 §3-7 「제외도
  // 같다」). 도움은 제외돼도 남는다 — 기록부가 도움으로 세는 만남이다(foldsOf의 거름).
  const kept = op => {
    if (s.failed.has(op.eventId) || s.failed.has(op.parent)) return false;
    if (op.kind === 'help') return true;
    return !s.excluded.has(op.eventId) && !s.excluded.has(op.parent);
  };

  // 제외된 사건 — 어느 코치 · 탭이 제외했든(기록부가 든 제외 사건의 대상, GPT GC2). 다시 세울 때마다 기록부에서 새로 읽는다(저장이 실패한
  // 제외는 없던 것).
  function markExcluded() {
    s.excluded.clear();
    for (const event of host.trail.heldEvents())
      if (
        event.type === EVENT_TYPES.excluded &&
        s.own.has(event.targetId) &&
        !s.failed.has(event.id) &&
        !s.excluded.has(event.targetId)
      )
        s.excluded.set(event.targetId, entryOf(event));
  }

  // 판의 「낸 것」(하루 한도 · 새것 몫 — 계획 §16 ①). 다시 세울 때마다 지금 호스트의 것 전부를 다시 받고(서버 요약으로 온 다른 기기 줄 ·
  // 다른 탭 · 다른 코치 · 판 열기 전의 내 줄이 한 규칙으로 든다), 이 판 일지에서 다시 돌릴 내 제시만 사건 번호로 뺀다 — 그 줄은 일지를
  // 다시 돌리며 더한다. 시각을 견주지 않는다(탭 · 기기마다 시계가 다르고 서버는 시각을 누른다). 빼는 것은 실패도 제외도 아닌 내 제시뿐이다
  // (Fable 5.2 D7) — 저장에 실패한 제시는 기록부에 줄이 없어 빠지고, 제외된 제시는 기록부 · 서버의 「낸 것」에 남으므로 여기서도 센다.
  function issuedLog() {
    const replayed = new Set(
      s.journal.filter(op => op.kind === 'present' && kept(op)).map(op => op.eventId),
    );
    return host.issued().filter(row => !replayed.has(row.id));
  }

  // 놓친 답 — 틀림 · 「모르겠어요」(건너뜀 · 판정 못 한 답은 「다시」를 만들지 않는다 — 아르곤 끝 판 C8 ②).
  const missed = op => op.answer.correct === false || op.answer.unknown === true;

  // 고른 줄을 지금 학습자 상태로 새로 잰다 — recommend 뒤 present 전에 판이 다시 서면(다른 코치의 쓰기 · 본인 말) 낡은 처음 낸 단위 ·
  // 층으로 제시를 적지 않게(C8 ③). 층이 같으면 이유 · 회차(좁힌 까닭 포함)는 그대로 둔다.
  function refreshChosen() {
    for (const [key, row] of s.chosen) {
      const now = choose([row.item], s.learner, memory, host.now(), { params, seed })[0];
      // 다시 세운 줄이 낼 수 없는 줄(층 9 · none)이면 고른 줄에서 뺀다 — 제품이 그래도 내면 제품 순서 줄(hostRow)로 겨눈 단위를 채운다
      // (층 9 줄 그대로 내면 겨눈 단위 없이 제시 사건이 섰다, 카본 끝 판 B2).
      if (!now || now.none) s.chosen.delete(key);
      else s.chosen.set(key, now.tier === row.tier ? { ...now, why: row.why, arm: row.arm } : now);
    }
  }

  // 다른 탭 · 다른 코치 · 다른 기기의 본인 말이 이 판에서 놓친 뒤에 왔으면 그 단위의 「다시」를 거둔다(설계 §3-2 — 본인 말은 다시를 거둔다).
  function dropStated(session, fresh) {
    for (const unit of [...session.retries.keys()]) {
      const at = saidAt(fresh.memory.get(unit));
      if (at == null) continue;
      const missedAt = Math.max(
        ...s.journal
          .filter(
            op => op.kind === 'answer' && kept(op) && missed(op) && unitsOf(op.item).includes(unit),
          )
          .map(op => op.at),
      );
      if (at > missedAt) session.retries.delete(unit);
    }
  }

  // 판 상태를 세운다 — 판을 열 때(일지가 빈) · 바깥이 바뀔 때 같은 길이다.
  function build() {
    const fresh = host.view();
    // 보기가 아무것도 얹지 못하는 동안은 판을 열 때의 사본 위에 일지를 통째로(기억까지) 다시 돌린다.
    const waiting = fresh.waitAll === true;
    markExcluded();
    const tmp = learnerOf(copyView(waiting ? s.open.base : fresh));
    tmp.log = issuedLog();
    startSession(tmp, s.open.now, params, s.open.opts);
    for (const op of s.journal) if (kept(op)) replay(tmp, op);
    dropStated(tmp.session, fresh);
    s.learner = {
      ...(waiting ? tmp : fresh),
      shown: tmp.shown,
      log: tmp.log,
      day: tmp.day,
      session: tmp.session,
      seq: tmp.seq,
      dayOffset: tmp.dayOffset,
    };
    refreshChosen();
  }
  // 열린 판을 다시 세운다(저장 실패 · 제외 · 다른 탭 · 같은 문서 다른 코치의 쓰기 · 서버 요약 · 옛 기록 옮기기).
  function rebuild() {
    if (s.open && s.learner?.session) build();
  }

  // 다시 세우기가 던지면 앞 상태를 두고 계기에 남긴다 — 듣는 함수가 던져 그 판이 뒤의 소식(저장 실패 등)을 못 듣는 일이 없게(N2).
  const unsubscribe = host.subscribe(note => {
    if (note.kind === 'failed') s.failed.add(note.id);
    // 같은 문서 다른 코치의 쓰기만 — 내 쓰기는 이미 판에 들었다.
    if (note.kind === 'written' && s.own.has(note.id)) return;
    if (note.kind === 'offline') return;
    try {
      rebuild();
    } catch {
      host.health?.note('recommend', { ok: false, code: 'REBUILD_FAILED' });
    }
  });
  // 이 코치의 쓰기(호스트에 넘기고 번호를 적어 둔다).
  const write = (type, fields, extra) => {
    const made = host.write(type, fields, extra);
    s.own.add(made.event.id);
    return made;
  };

  function pairsOf(candidates, { audio, notNow } = {}) {
    const pairs = candidates
      .map(product => ({ product, item: mapItem(product) }))
      .filter(pair => pair.item);
    const kept = new Set(
      filterCandidates(
        pairs.map(pair => pair.item),
        { audio, notNow },
      ),
    );
    return pairs.filter(pair => kept.has(pair.item));
  }

  // 판이 일찍 끝날 때 제품이 사실대로 말하려고 — 새것이 한도에 걸려 남았나, 복습 상한 · 끈질긴 단위 몫에 걸렸나, 이 판에서 돌아온 것을 냈나.
  function factsOf(rows) {
    const session = s.learner.session;
    const limited = rows.some(
      row =>
        row.tier === 9 &&
        row.held == null &&
        row.firstHere.length > 0 &&
        !session.blank.has(row.item.itemKey),
    );
    const held = rows.find(row => row.held)?.held ?? null;
    const servedDue = s.journal.some(op => op.kind === 'present' && kept(op) && op.row.tier === 1);
    return { limited, held, servedDue };
  }

  return {
    get learner() {
      return s.learner;
    },
    get setId() {
      return s.setId;
    },
    openSet,
    ensure,
    rebuild,
    choose(candidates, options = {}) {
      if (options.set && !repeated(options.set)) openSet(options.set);
      else ensure();
      const pairs = pairsOf(candidates, options);
      const products = new Map(pairs.map(pair => [pair.item.itemKey, pair.product]));
      const rows = choose(
        pairs.map(pair => pair.item),
        s.learner,
        memory,
        host.now(),
        { params, seed },
      );
      if (rows[0]) rows[0] = pooled(rows[0], options.pool);
      s.chosen.clear();
      if (rows[0] && !rows[0].none) s.chosen.set(rows[0].item.itemKey, rows[0]);
      return { rows, products, facts: factsOf(rows) };
    },

    present(product, { firstExposure, seen } = {}) {
      ensure();
      const item = mapItem(product);
      if (!item) throw new TypeError('Atlas coach: 지도 · 계약에 맞지 않거나 은퇴한 문항이다');
      const now = host.now();
      const picked = s.chosen.get(item.itemKey);
      s.chosen.clear();
      const chosenRow =
        picked ??
        hostRow(
          choose([item], s.learner, memory, now, { params, seed })[0],
          s.learner,
          memory,
          now,
          params,
        );
      const fields = presentedFields({
        row: chosenRow,
        product,
        setId: s.setId,
        editions: { ...params.editions, index: host.index.edition },
        firstExposure:
          firstExposure === false || seen === true ? false : seen === false ? true : null,
      });
      const { event } = write(EVENT_TYPES.presented, fields, { issued: issuedOf(chosenRow) });
      const row = { ...chosenRow, at: Date.parse(event.at) };
      present(s.learner, row, params);
      s.journal.push({ kind: 'present', eventId: event.id, row });
      s.groups.set(event.id, { source: entryOf(event), children: [], item, row, attempts: 0 });
      return event.id;
    },

    group(pid) {
      const group = s.groups.get(pid);
      if (!group) throw new Error('Atlas coach: 끝났거나 모르는 제시다');
      return group;
    },

    help(pid, kind) {
      const group = this.group(pid);
      if (!HELP_KINDS.includes(kind)) throw new TypeError('Atlas coach: 도움의 종류가 아니다');
      const fields = {
        presentationId: pid,
        helpId: kind,
        level: HELP_LEVELS[kind] ?? 'cue',
        contentRef: `${gameId}.${kind}`,
      };
      // 저장에 실패한 도움은 없던 일 — 그 뒤의 도움이 첫 도움이다(접기와 같은 거름, 카본 끝 판 B3). 제외된 도움은 도움이다(기록부와 같게 —
      // 넘친 #16). 첫 답 뒤에 본 도움(되짚기) · 둘째 도움은 접기 사건이 없다 — 어댑터가 도움 만남을 세우지 않는다(설계 §3-3 · Fable 5.2 최종 F1).
      let folds = [];
      const { event, stored } = write(EVENT_TYPES.helped, fields, {
        fold: made => {
          folds = foldsOf(group, made, host.index, s);
          return folds.length ? folds : null;
        },
      });
      for (const fold of folds) apply(s.learner, fold);
      // 판 일지에는 도움마다 — 보기가 아무것도 얹지 못하는 동안 다시 세워도(일지를 판을 열 때의 사본에 다시 돌림) 이 도움의 만남 · 능력이
      // 사라지지 않고(카본 끝 판 D), 앞 도움이 실패하면 이 도움이 첫 도움으로 선다(카본 끝 판 둘째 E). 이 도움이 실패하면 다른 줄처럼
      // 빠진다(kept).
      s.journal.push({ kind: 'help', eventId: event.id, parent: pid });
      group.children.push(entryOf(event));
      return { event, stored };
    },

    delivery(pid, { audio }) {
      const group = this.group(pid);
      const { event, stored } = write(EVENT_TYPES.delivery, { presentationId: pid, audio });
      group.children.push(entryOf(event));
      return { event, stored };
    },

    answer(pid, result) {
      const group = this.group(pid);
      const attemptNo = result?.attemptNo ?? group.attempts + 1;
      if (attemptNo !== group.attempts + 1)
        throw new TypeError('Atlas coach: 같은 제시의 답은 차례대로다');
      const verdict = verdictOf(result, group.item);
      const fields = attemptFields(pid, attemptNo, verdict, result);
      let folds = [];
      const made = write(EVENT_TYPES.attempted, fields, {
        fold: event => {
          folds = foldsOf(group, event, host.index, s);
          return folds;
        },
      });
      group.children.push(entryOf(made.event));
      group.attempts += 1;
      const fold = folds.find(one => one.id === made.event.id);
      // 장부 만남(제품이 「처음이 아니다」라고 한 제시의 첫 만남)을 답보다 먼저 얹는다 — 기록부 · 서버 접기와 같은 첫 만남(카본 끝 판 둘째 E).
      for (const prior of folds) if (prior !== fold) apply(s.learner, prior);
      const answer = { ...fold.answer, id: fold.id };
      const out = apply(s.learner, fold);
      s.journal.push({
        kind: 'answer',
        eventId: made.event.id,
        parent: pid,
        item: fold.item,
        answer,
        at: fold.at,
      });
      return { event: made.event, verdict, fold, grade: out.grade, stored: made.stored, group };
    },

    // 본인 말 — 판을 열지 않는다(「나」 화면은 판이 아니다). 열린 판이 있으면 그 판의 「다시」도 거둔다.
    tell(unit, kind) {
      let fold = null;
      const made = write(
        EVENT_TYPES.stated,
        { unit, say: kind },
        {
          fold: event => {
            fold = { kind: 'say', id: event.id, at: Date.parse(event.at), unit, say: kind };
            return fold;
          },
        },
      );
      if (s.learner?.session) {
        say(s.learner, memory, unit, kind, fold.at, params);
        s.journal.push({ kind: 'say', eventId: made.event.id, unit, say: kind, at: fold.at });
        refreshChosen();
      }
      return made;
    },

    // 제외 — 저장되면 그 사건(제시면 그 제시의 답까지)은 판 상태에서도 없던 것이다(다시 세우기가 기록부의 제외 사건을 읽는다).
    exclude(targetId) {
      const made = write(EVENT_TYPES.excluded, { targetId });
      made.stored.then(ok => {
        if (ok) rebuild();
      });
      return made;
    },

    close() {
      // 닫은 판 — 판 기록(finishSet)은 그 판 번호로 한 번만 남는다(아르곤 끝 판 C7).
      if (s.open) s.closed = { setId: s.setId, recorded: false, writing: false, decision: null };
      s.open = null;
      if (s.learner) s.learner.session = null;
      s.chosen.clear();
      s.groups.clear(); // 닫은 판의 제시에는 답을 받지 않는다(GPT GC4)
    },
    get isOpen() {
      return Boolean(s.open && s.learner?.session);
    },
    // 판 기록을 남길 판 — 열린 판, 아니면 닫혔지만 아직 기록하지 않은(쓰는 중도 아닌) 판. 없으면 null.
    recordable() {
      if (s.open && s.learner?.session) return s.setId;
      return unrecorded(s.closed) ? s.closed.setId : null;
    },
    // 닫은 판의 기록 자리를 잡는다(finishSet이 판을 닫은 뒤) — 저장이 끝날 때까지 「쓰는 중」이라 같은 판을 또 쓰지 않는다. 앞 시도에서
    // 저장된 결정이 있으면 자리에 남아 있다(decision — 다시 쓸 때 마침만 단다, GPT 최종 GC2). 그 판(setId)의 자리가 아니면 null.
    claimRecord(setId) {
      if (!unrecorded(s.closed) || s.closed.setId !== setId) return null;
      s.closed.writing = true;
      return s.closed;
    },
    // 판 기록의 저장 결과 — 결정 · 마침이 다 저장됐으면 기록 끝, 아니면 자리를 풀어 다음 finishSet이 다시 쓴다(저장된 결정은 남긴다).
    settleRecord(slot, { decision, ok }) {
      slot.writing = false;
      if (decision) slot.decision = decision;
      slot.recorded = ok;
      return ok;
    },
    dispose() {
      unsubscribe();
      s.groups.clear();
    },
  };
}
