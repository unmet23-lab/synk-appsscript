import test from 'node:test';
import assert from 'node:assert/strict';
import { bizplanScene, bizplanLine, reasonText, privacyLine, countWord, iga, attachesBizplan } from '../renderer/office-bizplan-model.mjs';
import { createBizplanRoom } from '../renderer/office-bizplan-room.mjs';

const list = (o = {}) => ({ plan: { name: '사업계획서_v3.docx' }, data: [{ name: '영수증.csv' }], criteria: { mode: 'default', text: '' }, items: ['문제 인식', '실현 가능성', '성장 전략', '팀 구성'], ...o });
const read = (o = {}) => ({
  id: 'r1', at: 1000, status: 'ok', reason: null, provider: 'codex', failedChunks: 0, totalChunks: 1,
  plan: { name: '사업계획서_v3.docx', kind: 'docx', samePlan: true }, dataNames: ['영수증.csv'],
  paragraphs: [{ text: '지금까지 한 일', heading: true }, { text: '단골 손님 300명이 매달 다시 삽니다.' }, { text: '3년 뒤' }, { text: '매출 5억 원을 목표로 합니다.' }],
  sections: [{ id: 1, title: '지금까지 한 일', head: 0, paras: [1] }, { id: 2, title: '3년 뒤', head: 2, paras: [3] }],
  notes: [{ key: 'n0', kind: 'mismatch', para: 1, from: 0, to: 22, quote: '단골 손님 300명이 매달 다시 삽니다.', why: '영수증과 다릅니다.', evidence: '10월,112명', sourceName: '영수증.csv', fix: '10월에 다시 산 손님은 112명입니다.', canReplace: true, handoff: '', choice: null },
    { key: 'n1', kind: 'unsupported', para: 3, from: 0, to: 17, quote: '매출 5억 원을 목표로 합니다.', why: '건넨 자료에서 근거를 찾지 못했습니다.', evidence: '', sourceName: '', fix: '', canReplace: true, handoff: '계획서의 아래 문장…', choice: null }],
  items: [{ item: '성장 전략', secs: [2], thin: true, why: '새 손님을 어디서 만날지가 빠졌습니다.', asks: [{ q: '어디서?', opts: [{ label: '인스타그램', sentence: '인스타그램에서 만납니다.' }, { label: '지인', sentence: '지인 소개로 만납니다.' }] }] },
    { item: '문제 인식', secs: [1], thin: false, why: '', asks: [] }],
  ...o,
});
const snap = (o = {}) => ({ ok: true, list: list(), read: read(), drafts: {}, saved: null, planChanged: false, progress: null, ...o });
const depts = [{ id: 'plan01', name: '기획부' }, { id: 'dev001', name: '개발부' }];

test('맨 위 두 줄: 넣기 전, 기다림, 읽는 중, 메모 있음, 다 고름, 저장함, 메모 없음, 실패, 멈춤', () => {
  assert.deepEqual(bizplanScene(snap({ read: null }), null, {}).head, ['사업계획서 파일을 넣어 주세요.', '회사 자료와 견주어 다른 숫자와 빠진 내용을 짚고, 고친 문장을 새 파일로 저장합니다.']);
  assert.equal(bizplanScene(snap({ read: null }), { id: 't', status: 'queued', updatedAt: 2 }, {}, { deptName: '기획부' }).head[1], '앞에 맡긴 일이 끝나면 기획부 직원이 읽기 시작합니다.');
  const reading = bizplanScene(snap({ progress: { taskId: 't', part: 2, total: 3, title: '3년 뒤' } }), { id: 't', status: 'running', updatedAt: 2 }, {}, { deptName: '기획부' });
  assert.deepEqual(reading.head, ['기획부가 계획서를 읽고 있습니다.', '3번 가운데 2번째 · 3년 뒤']);
  assert.equal(reading.paper.secs[0].dim, false);assert.equal(reading.paper.secs[1].on, true);
  const notes = bizplanScene(snap(), null, { departmentId: 'plan01' }, { departments: depts });
  assert.deepEqual(notes.head, ['고칠 곳이 셋 있습니다.', '메모를 하나씩 보고 고치면 새 파일로 저장할 수 있습니다.']);
  assert.equal(notes.sel, 'n0');
  assert.deepEqual(notes.notes[0].acts.map(a => a[0]), ['고친 문장으로 바꾸기', '직접 고치기', '그대로 두기']);
  assert.deepEqual(notes.notes[1].acts.map(a => a[0]), ['직접 고치기', '만들어서 사실로 맡기기', '그대로 두기']);
  assert.equal(notes.notes[2].kind, 'thin');
  const r = read();
  r.notes[0].choice = { kind: 'fix' }; r.notes[1].choice = { kind: 'keep' };
  const chosen = bizplanScene(snap({ read: r, drafts: { '성장 전략': { answers: [0], text: '인스타그램에서 만납니다.' } } }), null, {});
  assert.deepEqual(chosen.head, ['고를 것을 다 골랐습니다.', '새 파일로 저장하면 원본 옆에 고친 판이 생깁니다.']);
  assert.equal(chosen.paper.secs[0].paras[0].text, '10월에 다시 산 손님은 112명입니다.');
  assert.equal(chosen.paper.secs[1].draft, '인스타그램에서 만납니다.');
  const saved = bizplanScene(snap({ read: r, saved: { name: '사업계획서_v3_솔리오고침_20261123-1502.docx', skipped: 1 } }), null, {});
  assert.deepEqual(saved.head, ['고친 계획서를 새 파일로 저장했습니다.', '원본은 그대로 두고 같은 폴더에 고친 판을 만들었습니다. 바꿀 수 없는 고침 하나는 빼고 저장했습니다.']);
  const clean = bizplanScene(snap({ read: read({ notes: [], items: [{ item: '문제 인식', secs: [1], thin: false, why: '', asks: [] }, { item: '팀 구성', secs: [2], thin: false, why: '', asks: [] }] }) }), null, {});
  assert.deepEqual(clean.head, ['회사 자료와 다른 숫자를 찾지 못했습니다.', '평가 항목 둘 모두 계획서에 있습니다.']);
  const partial = bizplanScene(snap({ read: read({ status: 'partial', failedChunks: 1, totalChunks: 5 }) }), null, {});
  assert.equal(partial.head[1], '묶음 다섯 가운데 하나는 읽지 못했습니다. 다시 읽으면 그 묶음도 봅니다.');
  const failed = bizplanScene(snap({ read: read({ status: 'failed', reason: 'CHUNKS', failedChunks: 3, totalChunks: 5 }) }), null, {});
  assert.deepEqual(failed.head, ['이번에는 읽지 못했습니다.', '묶음 다섯 가운데 셋을 읽지 못했습니다.']);
  assert.equal(bizplanScene(snap(), { id: 't', status: 'failed', reason: 'LOGIN', provider: 'claude', updatedAt: 9000 }, {}).head[1], '이 PC의 Claude Code에 로그인이 필요합니다.');
  assert.equal(bizplanScene(snap(), { id: 't', status: 'interrupted', reason: 'CANCELLED', updatedAt: 9000 }, {}).head[0], '읽기를 멈췄습니다.');
});

test('까닭 글, 개인정보 줄, 조사, 부서 줄', () => {
  assert.match(reasonText('PLAN_FORMAT'), /한글과 PDF는 아직 읽지 못합니다/);
  assert.match(reasonText('LIMIT'), /구독 사용량이 다 차서/);
  assert.match(privacyLine('codex'), /OpenAI로 가고 .* ChatGPT 구독/);
  assert.match(privacyLine('claude'), /SYNK로는 보내지 않습니다/);
  assert.deepEqual([countWord(1), countWord(3), countWord(12)], ['하나', '셋', '열둘']);
  assert.deepEqual([iga('기획부'), iga('기획팀')], ['기획부가', '기획팀이']);
  assert.equal(attachesBizplan({ name: '기획부' }), true);
  assert.equal(attachesBizplan({ name: '마케팅부' }), false);
  assert.deepEqual(bizplanLine(null), { line: '계획서를 넣으면 회사 자료와 견주어 고칠 곳을 짚어 드립니다', when: '시작' });
  assert.equal(bizplanLine({ status: 'completed', answer: '사업계획서에서 고칠 곳 3곳을 찾았습니다.', updatedAt: new Date(2026, 10, 23, 9, 2).getTime(), featureAlert: true }).line, '사업계획서에서 고칠 곳 3곳을 찾았습니다');
});

test('방: 열면 기능 판을 읽고, 단추는 정해 둔 동작과 칸만 보내며, 저장 안 한 고름이 있으면 다시 읽기를 한 번 묻는다', async () => {
  const sent = [];
  const api = {
    featureSnapshot: async (f, d) => { sent.push(['snap', f, d]); return snap({ read: (() => { const r = read(); r.notes[0].choice = { kind: 'fix' }; return r; })() }); },
    featureAction: async (f, d, action, args) => { sent.push(['act', action, args]); return { ok: true }; },
    taskAction: async (id, action) => { sent.push(['task', id, action]); return { ok: true }; },
  };
  let changes = 0;
  const room = createBizplanRoom({ api, changed: () => { changes++; }, setTimer: () => 0, clearTimer: () => {} });
  room.open('plan01');
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(sent[0], ['snap', 'bizplan', 'plan01']);
  room.scene(null, { departments: depts });
  await room.handle({ act: 'biz-choose', arg: 'n1|keep' });
  assert.deepEqual(sent.find(s => s[0] === 'act'), ['act', 'choose', { key: 'n1', kind: 'keep' }]);
  sent.length = 0;
  await room.handle({ act: 'biz-start' });
  assert.equal(sent.some(s => s[1] === 'start'), false, '첫 누름은 묻기만 한다');
  assert.match(room.state().live, /아직 저장되지 않았습니다/);
  await room.handle({ act: 'biz-start', arg: 'yes' });
  assert.deepEqual(sent.find(s => s[1] === 'start'), ['act', 'start', { provider: 'codex' }]);
  await room.handle({ act: 'biz-hand', arg: 'n1' });
  await room.handle({ act: 'biz-hand-send', fields: { extra: '급하지 않아요' } });
  assert.deepEqual(sent.find(s => s[1] === 'handoff'), ['act', 'handoff', { key: 'n1', departmentId: 'dev001', provider: 'claude', extra: '급하지 않아요' }]);
  await room.handle({ act: 'biz-cancel', arg: 't1' });
  assert.deepEqual(sent.find(s => s[0] === 'task'), ['task', 't1', 'cancel']);
  room.close();
  assert.equal(room.scene(null), null);
  assert.ok(changes > 0);
});
