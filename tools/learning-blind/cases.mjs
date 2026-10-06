// Development cases for the existing product recommendation, never student-effect evidence.
// Pure local Atlas calls only. No account, provider, network or filesystem writes.
import Game from '../../atlas/game-learning.js';
import Strata from '../../strata/index.js';
import mapData from '../../strata/maps/topik-i.json' with { type: 'json' };
import { GAME_CONTENT, gameProfiles, gameItems } from '../../experiences/teacher-world/game-catalog.mjs';

const map = Strata.createMap(mapData);
const START = Date.parse('2026-10-06T03:00:00Z');
const DAY = 86400000;
const R = 'ko.reading.detail', L = 'ko.listening.detail', N = 'ko.reading.negation';
const copy = value => structuredClone(value);
const tuple = item => [item.skillId ?? item.skillIds[0], item.difficulty, item.responseFormat, item.modality].join('|');
const desired = [
  ['town-reading', R], ['town-reading', N], ['town-reading', 'ko.reading.sequence'],
  ['entry-reading', R], ['entry-reading', N],
  ['runner-listening', L], ['runner-listening', 'ko.listening.negation'], ['racing-listening', L],
];

function authoredCandidates() {
  return desired.map(([contentId, skillId]) => {
    const content = GAME_CONTENT.find(row => row.id === contentId);
    const profile = gameProfiles(content).find(row => row.skillIds[0] === skillId
      && row.difficulty === 1 && row.responseFormat === 'single-choice');
    if (!profile) throw new Error(`Missing authored candidate: ${contentId}/${skillId}`);
    const items = gameItems(content).filter(row => tuple(row) === tuple(profile));
    if (!items.length) throw new Error(`No authored items: ${profile.id}`);
    return { profile, items, label: `${content.title} · ${map.getNode(skillId).label_ko}` };
  });
}

function fixture(groupId) {
  let now = START;
  const values = new Map(), rows = [], presentations = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const coach = Game.createGame({ gameId: 'learning-blind', learnerKey: `development-${groupId}`,
    map, storage, fold: false, clock: () => new Date(now).toISOString() });
  const record = (pid, item, correct, attemptNo) => {
    now += 1000;
    const result = coach.answer(pid, { correct, assessable: true, attemptNo });
    rows.push({ item: copy(item), at: new Date(now).toISOString(), result: copy(result) });
    return result;
  };
  const answer = (item, correct, { help = false, audio = true } = {}) => {
    now += 1000;
    const pid = coach.present({ id: item.itemKey, ...item, audioRequired: item.modality === 'listening' });
    if (item.modality === 'listening') coach.delivery(pid, { audio: audio ? 'completed' : 'failed' });
    if (help) coach.help(pid, 'hint');
    presentations.set(pid, { item, attempts: 1 });
    record(pid, item, correct, 1);
    return pid;
  };
  const retry = (pid, correct) => {
    const presentation = presentations.get(pid);
    if (!presentation) throw new Error('Unknown local presentation');
    return record(pid, presentation.item, correct, ++presentation.attempts);
  };
  return { coach, rows, answer, retry, advance: () => { now += DAY; }, now: () => now };
}

function itemPool(authored, skillId) {
  const unique = new Map();
  for (const row of authored.flatMap(candidate => candidate.items).filter(item => item.skillId === skillId)) {
    if (!unique.has(row.familyKey)) unique.set(row.familyKey, row);
  }
  return [...unique.values()];
}

function observations(f, authored, audioAvailable) {
  const groups = new Map();
  for (const { profile } of authored) groups.set(tuple(profile), profile);
  const result = [...groups].map(([key, profile]) => {
    const rows = f.rows.filter(row => tuple(row.item) === key);
    const independent = rows.filter(row => row.result.independent);
    const latest = rows.at(-1)?.at ?? null, lastIndependent = independent.at(-1)?.at ?? null;
    return {
      id: `obs-${profile.skillIds[0]}-${profile.difficulty}-${profile.responseFormat}`,
      kind: 'language-item-summary', skillId: profile.skillIds[0], difficulty: profile.difficulty,
      responseFormat: profile.responseFormat, modality: profile.modality,
      firstIndependentAttempts: independent.length,
      independentCorrect: independent.filter(row => row.result.verdict === 'correct').length,
      independentIncorrect: independent.filter(row => row.result.verdict === 'incorrect').length,
      totalAttempts: rows.length,
      assistedCorrect: rows.filter(row => row.result.assisted === true && row.result.verdict === 'correct').length,
      assistedIncorrect: rows.filter(row => row.result.assisted === true && row.result.verdict === 'incorrect').length,
      knownUnassistedAttempts: rows.filter(row => row.result.assisted === false).length,
      unknownAssistanceAttempts: rows.filter(row => row.result.assisted == null).length,
      newExposureAttempts: rows.filter(row => row.result.exposure === 'new').length,
      unknownExposureAttempts: rows.filter(row => row.result.exposure === 'unknown' || row.result.exposure == null).length,
      repeatAttempts: rows.filter(row => row.result.attemptNo > 1 || row.result.exposure === 'repeat').length,
      repeatCorrect: rows.filter(row => (row.result.attemptNo > 1 || row.result.exposure === 'repeat') && row.result.verdict === 'correct').length,
      unassessedAttempts: rows.filter(row => row.result.verdict === 'unassessed').length,
      audioFailureAttempts: rows.filter(row => row.result.reason === 'audio').length,
      uniquePresentedFamilies: new Set(rows.map(row => row.item.familyKey)).size,
      firstAttemptAt: rows[0]?.at ?? null, lastAttemptAt: latest, lastIndependentAt: lastIndependent,
      daysSinceLastIndependent: lastIndependent === null ? null : Math.floor((f.now() - Date.parse(lastIndependent)) / DAY),
      coverage: rows.length ? 'recorded-local-synthetic-events' : 'no-observed-attempts',
      asOf: new Date(f.now()).toISOString(),
    };
  });
  result.push({ id: 'obs-current-audio', kind: 'current-setting', field: 'audioAvailable', value: audioAvailable,
    asOf: new Date(f.now()).toISOString(), scope: 'this-stage-only' });
  return result;
}

function publicCandidates(f, authored) {
  const seen = new Set(f.rows.map(row => row.item.familyKey));
  return authored.map(({ profile, items, label }) => {
    const families = [...new Set(items.map(item => item.familyKey))];
    const seenFamilyCount = families.filter(family => seen.has(family)).length;
    return { id: profile.id, label, contentId: profile.contentId, skillId: profile.skillIds[0],
      difficulty: profile.difficulty, responseFormat: profile.responseFormat, modality: profile.modality,
      audioRequired: profile.modality === 'listening', authoredItemCount: items.length,
      authoredFamilyCount: families.length, seenFamilyCount, unseenFamilyCount: families.length - seenFamilyCount,
      maxTaskItems: Math.min(3, families.length) };
  });
}

function makeCase(f, authored, groupId, stage, label, { audioAvailable = true, targetSkill = null, ambiguous = false, note } = {}) {
  const facts = observations(f, authored, audioAvailable), candidates = publicCandidates(f, authored);
  const plan = f.coach.recommend(authored.map(row => row.profile), { audioAvailable });
  if (!plan.selected || !candidates.some(candidate => candidate.id === plan.selected.id)) throw new Error('Invalid Core baseline');
  const selected = candidates.find(candidate => candidate.id === plan.selected.id);
  const supporting = facts.find(row => row.kind === 'language-item-summary' && row.skillId === selected.skillId
    && row.difficulty === selected.difficulty && row.responseFormat === selected.responseFormat && row.totalAttempts > 0);
  // This is a review reference, not a gold label. Never transmit baseline/rubric to a provider.
  const evidenceId = !audioAvailable ? 'obs-current-audio' : supporting?.id ?? 'none';
  const acceptable = ambiguous ? [] : candidates.filter(candidate => audioAvailable
    ? candidate.skillId === targetSkill : candidate.modality === 'reading').map(candidate => candidate.id);
  const forbidden = candidates.filter(candidate => !audioAvailable && candidate.audioRequired).map(candidate => candidate.id);
  return { id: `${groupId}-stage-${stage}`, groupId, stage, label,
    input: { observations: facts, context: { audioAvailable }, candidates },
    baseline: { candidateId: selected.id, evidenceId },
    rubric: { acceptableCandidateIds: acceptable, forbiddenCandidateIds: forbidden,
      note: `${ambiguous ? 'needs-human: 허용 정답을 확정하지 않은 개발 사례. ' : ''}${note}` } };
}

/** Six invented learner histories at three successive stages; development18, not a holdout. */
export function buildCases() {
  const authored = authoredCandidates(), reading = itemPool(authored, R), listening = itemPool(authored, L), negation = itemPool(authored, N);
  if (reading.length < 10 || listening.length < 5 || negation.length < 5) throw new Error('Development histories need enough real item families');
  const cases = [];
  const snapshot = (f, group, stage, label, options) => cases.push(makeCase(f, authored, group, stage, label, options));
  const add = (f, items, correct, options) => items.map(item => f.answer(item, correct, options));

  {
    const group = 'reading-need', f = fixture(group);
    add(f, listening.slice(0, 4), true); const errors = add(f, reading.slice(0, 3), false);
    snapshot(f, group, 0, '읽기 새 문항 오류가 관측됨', { targetSkill: R, note: '관측된 읽기 세부 정보 오류를 확인할 실제 읽기 후보 여럿을 허용한다.' });
    f.advance(); errors.forEach(pid => f.retry(pid, true));
    snapshot(f, group, 1, '같은 읽기 문항을 다시 맞힘', { targetSkill: R, note: '재응답 정답이 첫 독립 오류를 지우지 않는지 본다. 반복 성공을 숙달로 선언하지 않는다.' });
    f.advance(); add(f, reading.slice(3, 5), true, { help: true });
    snapshot(f, group, 2, '새 읽기 문항은 도움과 함께 수행', { targetSkill: R, note: '도움 받은 새 정답은 독립 정답이 아니다. 동일 항목의 확인 후보를 허용한다.' });
  }
  {
    const group = 'listening-need', f = fixture(group);
    add(f, reading.slice(0, 4), true); const errors = add(f, listening.slice(0, 3), false);
    snapshot(f, group, 0, '듣기 새 문항 오류가 관측됨', { targetSkill: L, note: '읽기 기록과 듣기 오류를 섞지 않고, 실제 듣기 세부 정보 후보 여럿을 허용한다.' });
    f.advance(); errors.forEach(pid => f.retry(pid, true));
    snapshot(f, group, 1, '같은 듣기 문항을 다시 맞힘', { targetSkill: L, note: '같은 문항 재정답만으로 듣기 확인을 끝냈다고 하지 않는다.' });
    f.advance(); add(f, listening.slice(3, 5), false);
    snapshot(f, group, 2, '다른 듣기 문항에서도 오류 관측', { targetSkill: L, note: '새 문항의 오류가 추가된 항목을 실제 들을 수 있는 후보로 확인한다.' });
  }
  {
    const group = 'assisted-only', f = fixture(group);
    snapshot(f, group, 0, '관측된 학습 응답 없음', { ambiguous: true, note: '미관측은 약점이 아니다. 어느 시작 후보가 최적인지는 사람이 평가한다.' });
    f.advance(); add(f, negation.slice(0, 2), true, { help: true });
    snapshot(f, group, 1, '읽기 부정 표현을 힌트로 해결', { targetSkill: N, note: '도움 받은 수행 이후의 확인 후보를 허용하며 독립 능력을 확정하지 않는다.' });
    f.advance(); add(f, negation.slice(2, 5), true, { help: true });
    snapshot(f, group, 2, '도움 받은 정답만 추가됨', { targetSkill: N, note: '정답 수가 늘어도 독립 응답은 0이다. 도움 선택 자체를 능력 부족으로 낙인찍지 않는다.' });
  }
  {
    const group = 'repeated-only', f = fixture(group);
    add(f, listening.slice(0, 4), true); const pid = f.answer(reading[0], false);
    snapshot(f, group, 0, '읽기 첫 문항 한 번 오류', { targetSkill: R, note: '한 문항으로 약점은 확정하지 않는다. 관련 새 문항으로 확인할 후보 여럿을 허용한다.' });
    f.advance(); for (let i = 0; i < 4; i++) f.retry(pid, true);
    snapshot(f, group, 1, '동일 문항 재정답 네 번', { targetSkill: R, note: '반복 정답 4개는 새 독립 정답 4개가 아니다.' });
    f.advance(); for (let i = 0; i < 4; i++) f.answer(reading[0], true);
    snapshot(f, group, 2, '동일 문항 재정답 여덟 번', { targetSkill: R,
      note: '같은 문항을 다시 제시한 응답도 반복이다. 도움 여부가 unknown인 응답을 도움 없음으로 치환하거나 총 응답 수로 첫 노출 수를 부풀리지 않는다.' });
  }
  {
    const group = 'recovered-new-items', f = fixture(group);
    add(f, listening.slice(0, 4), true); const errors = add(f, reading.slice(0, 2), false);
    snapshot(f, group, 0, '읽기 서로 다른 두 문항 오류', { targetSkill: R, note: '두 문항의 오류는 추가 확인의 근거다. 학생의 급수나 학습 효과를 확정하지 않는다.' });
    f.advance(); errors.forEach(pid => f.retry(pid, true));
    snapshot(f, group, 1, '오류 문항만 다시 해결', { targetSkill: R, note: '이미 본 두 문항의 재정답만으로 다른 새 문항의 수행을 대신하지 않는다.' });
    f.advance(); add(f, reading.slice(2, 10), true);
    snapshot(f, group, 2, '다른 실제 읽기 문항 여덟 개 독립 정답', { ambiguous: true,
      note: '새 독립 정답 증가 뒤에도 과거 오류에 영구 고정하지 않는지 검토한다. 다음 미관측 항목의 최적 순서는 독립 정답지로 확정하지 않았다.' });
  }
  {
    const group = 'audio-unavailable', f = fixture(group);
    add(f, reading.slice(0, 4), true); add(f, listening.slice(0, 3), false);
    snapshot(f, group, 0, '소리를 들을 수 있는 현재 환경', { targetSkill: L, note: '현재 소리 사용 가능과 실제 듣기 오류를 분리해 읽는다.' });
    f.advance();
    snapshot(f, group, 1, '같은 이력에서 현재 소리 사용 불가', { audioAvailable: false,
      note: '소리 환경 때문에 듣기 후보를 금지한다. 읽기 후보 여럿을 허용하고 듣기 실력이 바뀌었다고 하지 않는다.' });
    f.advance(); f.answer(listening[3], false, { audio: false });
    snapshot(f, group, 2, '재생 실패 기록이 추가된 소리 불가 환경', { audioAvailable: false,
      note: '재생 실패 응답은 미평가로 남으며 독립 듣기 오답에 합치지 않는다. 현재 실행 가능한 읽기 후보를 허용한다.' });
  }

  return { schemaVersion: 'learning-blind-v1', cases,
    sourceFiles: ['atlas/game-learning.js', 'atlas/learning.js', 'atlas/trail.js', 'strata/maps/topik-i.json',
      'experiences/teacher-world/game-catalog.mjs', 'experiences/teacher-world/targeted-learning.test.mjs'],
    evaluationSplit: 'development18', synthetic: true, learningEffectClaim: false,
    limitation: '공개 코드에서 구성한 개발 사례 18개. 독립 holdout, 모델 비교 결과, 실제 학생 학습 효과가 아니다.' };
}
