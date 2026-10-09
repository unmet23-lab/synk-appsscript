// Optional classroom visibility is independent of personal Town progress and
// language evidence. An old learning consent never enables this switch.
export function validateTownMembership(value, {classId, learnerId} = {}) {
  const sharing = value?.townSharing;
  if (value?.mode !== 'account-linked' || value?.town?.kind !== 'academy'
      || typeof value.town.id !== 'string' || !value.town.id
      || value.town.classId !== classId || value.membership?.learnerId !== learnerId
      || typeof sharing?.enabled !== 'boolean' || !Number.isSafeInteger(sharing.revision)
      || sharing.revision < 1 || typeof sharing.blockedByLearningSharing !== 'boolean') {
    throw Object.assign(new Error('내 반의 마을 연결을 확인하지 못했어요.'), {code:'INVALID_RESPONSE'});
  }
  return value;
}

export function createTownSharingControl({root, client, classId, learnerId, guard,
  closeGame = () => {}, notice = () => {}, documentObject = document}) {
  let stopped = false, generation = 0, membership = null, busy = false;
  const node = (tag, text) => {const el = documentObject.createElement(tag); if (text) el.textContent = text; return el;};
  const active = version => {guard(); if (stopped || version !== generation) throw Object.assign(new Error('수업 연결이 바뀌었어요.'), {code:'ACCOUNT_CHANGED'});};
  const title = node('h3', '우리 반 마을과 활동 공유');
  const description = node('p', 'TOWN에서 방문한 활동과 생활 단계의 종류·횟수·최근 기록 시각을 이 반 담당 선생님에게 공유할 수 있어요. 대화 내용과 개인 취향은 공유하지 않으며, 생활 활동을 학습 성적으로 평가하지 않아요.');
  description.className = 'small';
  const status = node('p'); status.className = 'small'; status.setAttribute('role', 'status'); status.dataset.townSharingStatus = '';
  const label = node('label'); label.className = 'toggle wc-town-sharing-toggle';
  const input = node('input'); input.type = 'checkbox'; input.disabled = true; input.dataset.townSharing = '';
  label.append(input, node('span', '담당 선생님에게 TOWN 활동 요약 공유'));
  const retry = node('button', '마을 연결 다시 확인'); retry.type = 'button'; retry.className = 'plain'; retry.hidden = true;
  root.className = 'wc-town-sharing'; root.dataset.townSharingPanel = ''; root.replaceChildren(title, description, status, label, retry);

  function paint() {
    input.checked = membership?.townSharing.enabled === true;
    input.disabled = busy || !membership || membership.townSharing.blockedByLearningSharing;
    retry.disabled = busy;
    if (!membership) return;
    const shared = membership.townSharing;
    title.textContent = membership.town.name || '우리 반 마을';
    status.textContent = shared.blockedByLearningSharing
      ? '수업 기록 공유를 먼저 켜면 마을 활동 공유를 선택할 수 있어요.'
      : shared.enabled ? '활동 요약 공유 켜짐 · 지금부터 기록한 활동을 담당 선생님이 확인해요.'
        : '활동 요약 공유 꺼짐 · 마을 활동은 담당 선생님에게 보이지 않아요.';
  }
  async function load() {
    if (stopped || busy) return;
    const version = ++generation; busy = true; membership = null; status.textContent = '내 반의 마을 연결을 확인하고 있어요.'; retry.hidden = true; paint();
    try {
      active(version);
      const result = await client.townMembership(); active(version);
      membership = validateTownMembership(result, {classId, learnerId});
    } catch (error) {
      if (stopped || version !== generation || error.code === 'ACCOUNT_CHANGED') return;
      status.textContent = '마을 연결을 확인하지 못했어요. 활동 요약 공유 상태는 연결 후 확인할 수 있어요.';
      retry.hidden = false;
    } finally {
      if (!stopped && version === generation) {busy = false; paint();}
    }
  }
  input.onchange = async () => {
    if (busy || !membership || stopped) return;
    const version = ++generation, enabled = input.checked, revision = membership.townSharing.revision;
    busy = true; input.disabled = true; retry.hidden = true;
    // A captured Town host must stop immediately when visibility is revoked.
    closeGame();
    try {
      active(version); await client.townSharing({enabled, revision}); active(version);
      const result = await client.townMembership(); active(version);
      membership = validateTownMembership(result, {classId, learnerId});
      notice(membership.townSharing.enabled ? '이 반 선생님에게 앞으로의 TOWN 활동 요약을 공유해요.' : 'TOWN 활동 요약 공유를 껐어요.');
    } catch (error) {
      if (stopped || version !== generation || error.code === 'ACCOUNT_CHANGED') return;
      membership = null; input.checked = false; status.textContent = '공유 변경 결과를 확인하지 못했어요. 마을 연결을 다시 확인해 주세요.'; retry.hidden = false;
      notice('TOWN 활동 공유 상태를 다시 확인해 주세요.', true);
    } finally {if (!stopped && version === generation) {busy = false; paint();}}
  };
  retry.onclick = () => {void load();};
  return Object.freeze({load, stop() {stopped = true; generation++; input.onchange = null; retry.onclick = null; root.replaceChildren();}});
}
