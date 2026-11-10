// 검수 GPT(11-03 pulse-models21-app-20261103-backend-r2 GA1): 목소리를 뺀 판(사슬 49)이 나가도 그 전 판에서 끝낸 고객 변경 검토가 풀리지 않는지,
// 그 전 판(867ebd346)의 해시 식을 여기서 따로 다시 세어 지금 코드의 changeKey와 견준다. 그 전 판의 currentOf는 strategyView 그대로(모델이 있을 때
// 저장된 목소리 A · B · C를 읽음)였고, 키는 sha256(JSON({baseline, current:{strategyRevision, strategy, dueDate, terms, sources}, scenes}))였다.
// 해시 입력에 칸을 더하거나 목소리 읽기를 바꾸면 여기서 깨진다(회사 폴더 시험은 지금 코드로 기록하고 지금 코드로 읽어 그 차이를 못 본다).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const company = '../docs/마케팅/온라인마케팅지도/engagement/company/';
const { emptyStrategyData, applyStrategyAction, strategyView } = await import(company + 'pulse-strategy.mjs');
const { buildClientChanges, applyClientChangesAction } = await import(company + 'client-changes.mjs');

const at = '2026-10-12T03:00:00.000Z';
const sha = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function row(voice) {
  const data = { ...emptyStrategyData(), objective: 'sales', product: '서비스', audience: '신규 고객', primaryPromise: '쉬운 시작', evidence1: '세 단계 사용 장면', memoryHook: '한 장면', desiredAction: '자료 다 받기', channels: ['website'], durationSeconds: 30, castingSelection: { ...emptyStrategyData().castingSelection, modelId: 'F01', hair: 'wave' } };
  let value = { id: '00000000-0000-4000-8000-000000000001', title: '합성 변경 프로젝트', stage: 'producing', terms: '영상 1편', dueDate: '2026-10-22', revision: 1, versions: [], messages: [], history: [], studio: { schemaVersion: 1, preferences: {}, strategy: { revision: 1, data, confirmation: { strategyRevision: 1 } }, assets: [], references: [], scenes: [] }, changeControl: { enabled: true } };
  value.studio.strategy.data.castingSelection.voice = voice;
  value = { ...value, changeControl: applyClientChangesAction(value, { action: 'capture', confirmed: true }, { actor: 'STAFF', at }) };
  value = structuredClone(value);
  value.studio.strategy = applyStrategyAction(value.studio.strategy, { action: 'save_strategy', strategy: { ...value.studio.strategy.data, durationSeconds: 60 } }, { author: 'staff', authorId: 'STAFF', authorName: '합성', at });
  // 그 전 판의 저장은 고른 목소리를 그대로 남겼다(지금 판은 저장할 때 비운다).
  value.studio.strategy.data.castingSelection.voice = voice;
  value.studio.strategy.confirmation = { strategyRevision: value.studio.strategy.revision, author: 'customer', at };
  return value;
}
// 11-10 옷 칸(castingSelection.outfit)을 더했다. 그 전 판(cadf0e303a까지)의 strategyView에는 이 키가 없었으므로 그 판의 식은 이 키를 빼고 센다.
function legacyKey(value) {
  const view = strategyView(value.studio.strategy), stored = value.studio.strategy.data.castingSelection.voice;
  const { outfit, ...before } = view.data.castingSelection;
  const cast = { ...before, voice: view.data.castingSelection.modelId && ['A', 'B', 'C'].includes(stored) ? stored : '' };
  return sha({ baseline: value.changeControl.baseline.id, current: { strategyRevision: view.revision, strategy: { ...view.data, castingSelection: cast }, dueDate: value.dueDate, terms: value.terms, sources: [] }, scenes: [] });
}

test('그 전 판에서 목소리를 고른 채 끝낸 변경 검토의 키가 지금 코드에서도 같다', () => {
  for (const voice of ['B', 'A', 'C', '']) {
    const value = row(voice), report = buildClientChanges(value, { canEdit: true, now: at });
    assert.equal(report.changes.length, 1, voice + ': 영상 길이 하나만 바뀜');
    assert.equal(report.changeKey, legacyKey(value), voice + ': 그 전 판의 해시 식과 같은 키');
  }
  const withVoice = buildClientChanges(row('B'), { canEdit: true, now: at }).changeKey, without = buildClientChanges(row(''), { canEdit: true, now: at }).changeKey;
  assert.notEqual(withVoice, without, '모델이 있을 때 저장된 목소리는 그 전 판처럼 키에 들어간다');
});

test('옷 칸을 더한 배포만으로는 키가 바뀌지 않고, 실제로 옷을 고르면 바뀐다', () => {
  const plain = row(''), report = buildClientChanges(plain, { canEdit: true, now: at });
  assert.equal(strategyView(plain.studio.strategy).data.castingSelection.outfit, '', '지금 보기에는 빈 옷 칸이 있다');
  assert.equal(report.changeKey, legacyKey(plain), '고르지 않은 옷은 키에서 빠져 그 전 판의 키와 같다');
  const dressed = row('');
  dressed.studio.strategy.data.castingSelection.outfit = 'look-1';
  const chosen = buildClientChanges(dressed, { canEdit: true, now: at });
  assert.notEqual(chosen.changeKey, report.changeKey, '고른 옷은 키에 들어간다');
  const cast = chosen.changes.find(change => change.id === 'strategy:castingSelection');
  assert.match(cast?.after || '', /옷: 슬립 드레스/, '바뀐 내용 보고에 그 모델의 옷 이름(F01 룩 1)이 있다');
  assert.match(cast?.before || '', /옷: 미정/, '앞 글과 뒤 글이 달라 무엇이 바뀌었는지 보인다');
});
