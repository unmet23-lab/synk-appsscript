'use strict';
// Callable workflow with injected API, also used by the offline tests. No network
// and no credential access occur merely by importing this module.
const { CLIENTS } = require('./registry.cjs');
const { buildProvisionPlan, canonicalMap, digest, clientName, matchesClient, validateOnly } = require('./provision-plan.cjs');
const { buildConfigPlan } = require('./public-config.cjs');
const copy = value => JSON.parse(JSON.stringify(value));
const fail = message => { throw new Error(message); };
function recoverBindings(environment, clients, bindings, results = {}, only) {
  const result = { ...bindings };
  for (const wanted of CLIENTS) {
    if (only && wanted.id !== only) continue;
    if (result[wanted.id] || wanted.knownIds?.[environment] || wanted.connection === 'pending-adapter') continue;
    const returnedId = results[wanted.id]?.clientId;
    if (returnedId) {
      const returned = clients.find(client => client.client_id === returnedId);
      if (returned && !matchesClient(wanted, returned)) fail('등록 응답 ID의 현재 콜백이 달라요. 공급자 등록을 확인해 주세요.');
      if (returned) { result[wanted.id] = returnedId; continue; }
    }
    const matchingName = clients.filter(client => client.client_name === clientName(wanted.id, environment));
    if (matchingName.length > 1 || matchingName.length === 1 && !matchesClient(wanted, matchingName[0])) fail('이전 등록 시도의 이름이 중복되거나 콜백이 달라요. 등록 목록을 확인해 주세요.');
    if (matchingName.length === 1) result[wanted.id] = matchingName[0].client_id;
  }
  return result;
}
function preserveLegacy(environment, mapping) {
  for (const [id, product] of Object.entries(canonicalMap(environment))) if (mapping[id] !== product) fail('기존 WORLD·맞춤 도구 제품 매핑을 보존해야 해요.');
}
async function provision({ environment, api, apply = false, existingMapping, bindings = {}, journal = null, saveJournal = async () => {}, publicSettings, writeConfigs = async () => [], retryConfirmedAbsent = null, only }) {
  validateOnly(only);
  if (only && journal?.pendingMapping) {
    const id = journal.bindings?.[only], pending = journal.pendingMapping, previous = journal.mapping ?? {};
    if (!id || pending[id] !== CLIENTS.find(row => row.id === only).product
      || [...new Set([...Object.keys(previous), ...Object.keys(pending)])].some(key => key !== id && previous[key] !== pending[key]))
      fail('다른 제품 매핑 적용 기록이 진행 중이에요. 원래 작업에서 확인한 뒤 범위를 지정해 주세요.');
  }
  if (only && retryConfirmedAbsent && retryConfirmedAbsent !== only) fail('--only와 재시도 등록 이름이 달라요.');
  const inScope = row => !only || row.id === only;
  if (!['production', 'rehearsal'].includes(environment)) fail('대상 환경을 확인해 주세요.');
  if (journal && (journal.version !== 1 || journal.environment !== environment || !journal.mapping || !journal.bindings || !Array.isArray(journal.attempted))) fail('이 환경의 적용 기록이 아니에요.');
  const state = journal ? copy(journal) : { version: 1, environment, mapping: existingMapping || canonicalMap(environment), bindings: {}, attempted: [], pendingMapping: null };
  state.attemptResults ||= {};
  if (retryConfirmedAbsent && (!apply || !journal || !state.attempted.includes(retryConfirmedAbsent) || !CLIENTS.some(client => client.id === retryConfirmedAbsent))) fail('재시도는 적용 기록에 남은 등록 하나를 --apply와 함께 명시해야 해요.');
  if (existingMapping && digest(existingMapping) !== digest(state.mapping)) fail('입력 원본과 적용 기록의 제품 매핑이 달라요.');
  for (const [registration, id] of Object.entries(bindings)) { if (state.bindings[registration] && state.bindings[registration] !== id) fail('이전 적용 기록과 입력의 client ID가 달라요.'); state.bindings[registration] = id; }
  let remoteDigest = await api.readDigest();
  if (state.pendingMapping && remoteDigest === digest(state.pendingMapping)) { state.mapping = state.pendingMapping; state.pendingMapping = null; }
  if (remoteDigest !== digest(state.mapping)) fail('원격 제품 매핑 지문이 달라졌어요. 현재 원본을 확인하기 전에는 적용하지 않아요.');
  preserveLegacy(environment, state.mapping);
  let clients = await api.listClients(); state.bindings = recoverBindings(environment, clients, state.bindings, state.attemptResults, only);
  if (api.verifyFortuneBindings) await api.verifyFortuneBindings(state.bindings);
  let plan = buildProvisionPlan({ environment, clients, secretDigest: remoteDigest, existingMapping: state.mapping, bindings: state.bindings, only });
  const summary = current => ({ environment, mode: apply ? 'apply' : 'dry-run', registered: current.registrations.filter(inScope).filter(item => item.clientId).length, pending: current.registrations.filter(inScope).filter(item => item.status === 'pending-adapter').map(item => item.id), bindingRequired: current.registrations.filter(inScope).filter(item => item.status === 'binding-required').map(item => item.id), registrationsNeeded: current.actions.filter(item => item.action === 'register-public-client').map(item => item.registration), mappingVerified: true,
    ...(only ? { only, deferredRegistrations: current.registrations.filter(item => !inScope(item) && ['registration-needed', 'binding-required', 'mapping-needed'].includes(item.status)).map(item => item.id), localConfigWriteDeferred: true } : {}) });
  if (!apply) return summary(plan);
  if (!publicSettings) fail('로컬 설정 생성에 사용할 공개 설정 파일이 필요해요.');
  // Validate public settings before the first mutation, excluding provider rows
  // unrelated to this registry (confidential third-party clients are preserved).
  buildConfigPlan({ ...publicSettings, version: 1, environment, clients: [], bindings: {} });
  if (plan.registrations.some(item => inScope(item) && item.status === 'binding-required')) fail('같은 콜백의 기존 등록이 있어요. 명시한 binding을 확인한 뒤 실행해 주세요.');
  await saveJournal(copy(state));
  const fresh = async () => { const observed = await api.readDigest(); if (observed !== digest(state.mapping)) fail('적용 도중 제품 매핑이 바뀌어 중단했어요. 기존 설정은 덮지 않았어요.'); return observed; };
  for (const action of plan.actions.filter(item => item.action === 'register-public-client')) {
    await fresh(); clients = await api.listClients(); state.bindings = recoverBindings(environment, clients, state.bindings, state.attemptResults, only);
    const wanted = CLIENTS.find(item => item.id === action.registration);
    if (state.bindings[wanted.id]) { await saveJournal(copy(state)); continue; }
    if (clients.some(client => matchesClient(wanted, client))) fail('적용 도중 같은 콜백 등록이 생겼어요. 중복 등록하지 않고 중단했어요.');
    if (state.attempted.includes(wanted.id)) {
      if (retryConfirmedAbsent !== wanted.id || state.attemptResults[wanted.id]?.clientId) fail('이전 등록 요청의 결과가 아직 확인되지 않아요. 요청 종료와 공급자 미등록을 직접 확인한 뒤 --retry-confirmed-absent 등록이름으로 재시도해 주세요.');
      // The operator explicitly confirms the previous request is no longer in
      // flight. The fresh provider list above must also contain no match.
      state.retryHistory ||= [];
      state.retryHistory.push({ registration: wanted.id, at: new Date().toISOString(), previous: state.attemptResults[wanted.id] || null });
    } else state.attempted.push(wanted.id);
    state.attemptResults[wanted.id] = { outcome: 'pending', at: new Date().toISOString() }; await saveJournal(copy(state));
    let returned;
    try {
      returned = await api.createClient(action.body);
      state.attemptResults[wanted.id] = { outcome: 'response', at: new Date().toISOString(), ...(/^[A-Za-z0-9_-]{1,256}$/.test(returned?.client_id || '') ? { clientId: returned.client_id } : {}) };
    } catch (error) {
      state.attemptResults[wanted.id] = { outcome: 'unconfirmed', at: new Date().toISOString(), ...(Number.isInteger(error.status) ? { httpStatus: error.status } : {}) };
    }
    await saveJournal(copy(state));
    clients = await api.listClients(); state.bindings = recoverBindings(environment, clients, state.bindings, state.attemptResults, only);
    const actual = state.bindings[wanted.id] && clients.find(client => client.client_id === state.bindings[wanted.id]);
    if (!actual || !matchesClient(wanted, actual) || returned && returned.client_id !== actual.client_id) fail('등록 응답과 실제 공급자 목록을 대조하지 못했어요. 새 등록 없이 결과 확인 후 재실행해 주세요.');
    await saveJournal(copy(state));
  }
  await fresh(); clients = await api.listClients(); state.bindings = recoverBindings(environment, clients, state.bindings, state.attemptResults, only);
  plan = buildProvisionPlan({ environment, clients, secretDigest: digest(state.mapping), existingMapping: state.mapping, bindings: state.bindings, only });
  if (plan.actions.some(action => action.action === 'register-public-client') || plan.registrations.some(item => inScope(item) && item.status === 'binding-required')) fail('모든 등록 결과를 확인하지 못해 제품 매핑을 쓰지 않았어요.');
  const merge = plan.actions.find(action => action.action === 'merge-product-mapping');
  if (merge) {
    preserveLegacy(environment, merge.value); state.pendingMapping = merge.value; await saveJournal(copy(state));
    await fresh(); // Provider secret API has no conditional write/CAS. Read immediately before POST and verify immediately after it.
    try { await api.writeMapping(merge.value); } catch { /* An unknown write result must be checked; never blindly POST again. */ }
    remoteDigest = await api.readDigest();
    if (remoteDigest !== digest(merge.value)) fail('제품 매핑 적용 결과를 확인하지 못했어요. 현재 값을 확인한 뒤 이어 주세요.');
    state.mapping = merge.value; state.pendingMapping = null; await saveJournal(copy(state));
  }
  await fresh(); clients = await api.listClients();
  const selected = CLIENTS.flatMap(wanted => { const id = state.bindings[wanted.id] || wanted.knownIds?.[environment]; if (!id) return []; const row = clients.find(client => client.client_id === id); if (!row || !matchesClient(wanted, row)) fail('설정 생성 전에 등록 상태가 바뀌었어요.'); return [{ registration: wanted.id, client_id: row.client_id, client_type: row.client_type, redirect_uris: [...row.redirect_uris] }]; });
  const configPlan = buildConfigPlan({ ...publicSettings, version: 1, environment, clients: selected, bindings: {} });
  // A scoped registration must not rewrite the three shared runtime configs.
  // Its public config is prepared separately after exact callback verification.
  const files = only ? [] : await writeConfigs(configPlan);
  state.completedAt = new Date().toISOString(); await saveJournal(copy(state));
  return { ...summary(buildProvisionPlan({ environment, clients, secretDigest: digest(state.mapping), existingMapping: state.mapping, bindings: state.bindings, only })), mappingEntries: Object.keys(state.mapping).length, files, liveLoginVerified: false };
}
module.exports = { provision, recoverBindings };
