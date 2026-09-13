'use strict';
const experiment = JSON.parse(document.querySelector('#experiment-data').textContent);
const select = document.querySelector('#scenario');
const statusLabel = { held: '보류', accepted: '반영', excluded: '제외' };
const names = { 'e0:asr': '원음–전사 자료', 'e0:object': '처음의 조사 사용', 'e0:past': '별도 과거형 사용' };
const reasons = { 'applied-source-review': '제출된 확인 결과가 이 계약의 데이터 조건과 일치했습니다.', 'source-or-attempt-mismatch': '계약의 원음·시도와 실제 결과의 귀속이 다릅니다.', 'stale-revision': '계약을 만든 뒤 상태가 바뀌었습니다. 다시 계획해야 합니다.', 'review-range-insufficient': '제출된 확인 범위가 모든 후보 차이를 포함하지 못했습니다.' };
function render() {
  const index = Number(select.value), scene = experiment.scenarios[index];
  document.querySelector('#case-count').textContent = `${index + 1} / ${experiment.scenarios.length}`;
  document.querySelector('#case-title').textContent = scene.title;
  document.querySelector('#case-explain').textContent = scene.explain;
  const grid = document.querySelector('#result-cells'); grid.replaceChildren();
  for (const after of scene.after) {
    const before = scene.before.find(cell => cell.id === after.id), node = document.createElement('div'); node.className = 'result-cell'; node.dataset.after = after.status;
    const label = document.createElement('small'); label.textContent = names[after.id] || after.id;
    const result = document.createElement('b'); result.textContent = `${statusLabel[before.status]} → ${statusLabel[after.status]}`;
    const note = document.createElement('span'); note.textContent = after.value || (after.status === 'excluded' ? '먼저 받은 도움으로 독립 수행 조건 불충족' : '지금 자료만으로 확정하지 않음');
    node.append(label, result, note); grid.append(node);
  }
  document.querySelector('#decision-title').textContent = scene.applied ? '이 확인 결과를 적용했습니다' : '이 계약에는 적용하지 않았습니다';
  document.querySelector('#decision-reason').textContent = reasons[scene.outcome] || scene.outcome;
  document.querySelector('#contract-source').textContent = `처음 원음 A / ${scene.contract.source.epoch}`;
  document.querySelector('#contract-range').textContent = `${Math.round(scene.contract.range.startMs)}–${Math.round(scene.contract.range.endMs)} ms`;
  document.querySelector('#receipt-source').textContent = scene.receipt.source.epoch === 'e0' ? '처음 원음 A / e0' : '새 시도 / ' + scene.receipt.source.epoch;
  document.querySelector('#contract-json').textContent = JSON.stringify({ contract: scene.contract, actualReceipt: scene.receipt, result: scene.outcome }, null, 2);
}
select.addEventListener('change', render);
document.querySelector('#previous').addEventListener('click', () => { select.value = String((Number(select.value) + experiment.scenarios.length - 1) % experiment.scenarios.length); render(); });
document.querySelector('#next').addEventListener('click', () => { select.value = String((Number(select.value) + 1) % experiment.scenarios.length); render(); });
render();
