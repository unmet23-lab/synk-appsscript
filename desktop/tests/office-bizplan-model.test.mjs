import test from 'node:test';
import assert from 'node:assert/strict';
import { bizplanScene, bizplanLine, reasonText, privacyLine, countWord, iga, attachesBizplan, nextWrite, revealPlan, satOut, seatedFor } from '../renderer/office-bizplan-model.mjs';
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
  assert.deepEqual(bizplanScene(snap({ read: null, list: list({ plan: null, data: [] }) }), null, {}).head, ['사업계획서 파일을 넣어 주세요.', '회사 자료와 견주어 다른 숫자와 빠진 내용을 짚고, 고친 문장을 새 파일로 저장합니다.']);
  assert.deepEqual(bizplanScene(snap({ read: null }), null, {}).head, ['준비가 끝났습니다.', '직원이 계획서를 회사 자료 하나와 견주어 다른 숫자와 빠진 내용을 찾습니다. 몇 분 걸립니다.'], '계획서를 고른 뒤에는 다음에 누를 것을 말한다');
  assert.match(bizplanScene(snap({ read: null, list: list({ data: [] }) }), null, {}).head[0], /회사 자료를 더하면/);
  assert.match(bizplanScene(snap({ read: null, list: list({ data: [{ name: 'a.csv' }, { name: 'b.csv' }] }) }), null, {}).head[1], /회사 자료 둘과 견주어/);
  assert.equal(bizplanScene(snap({ read: null }), { id: 't', status: 'queued', updatedAt: 2 }, {}, { deptName: '기획부' }).head[1], '앞에 맡긴 일이 끝나면 기획부 직원이 읽기 시작합니다.');
  const reading = bizplanScene(snap({ progress: { taskId: 't', part: 2, total: 3, title: '3년 뒤' } }), { id: 't', status: 'running', updatedAt: 2 }, {}, { deptName: '기획부' });
  assert.deepEqual(reading.head, ['기획부가 계획서를 읽고 있습니다.', '3번 가운데 2번째 · 3년 뒤']);
  assert.equal(reading.paper.secs[0].dim, false);assert.equal(reading.paper.secs[1].on, true);
  const notes = bizplanScene(snap(), null, { departmentId: 'plan01' }, { departments: depts });
  assert.deepEqual(notes.head, ['고칠 곳이 셋 있습니다.', '메모를 하나씩 보고 고치면 새 파일로 저장할 수 있습니다.']);
  assert.equal(notes.sel, 'n0');
  assert.deepEqual(notes.notes[0].acts.map(a => a[0]), ['고친 문장으로 바꾸기', '직접 고치기', '그대로 두기']);
  assert.deepEqual(notes.notes[1].acts.map(a => a[0]), ['직접 고치기', '개발부에 만들어 달라기', '그대로 두기']);
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
  assert.match(privacyLine('codex'), /ChatGPT를 만든 회사로 가고, 사용량은 그 구독/);
  assert.match(privacyLine('claude'), /솔리오 서버로는 보내지 않습니다/);
  assert.doesNotMatch(privacyLine('claude') + privacyLine('codex'), /Claude Code|Anthropic|OpenAI|SYNK/);
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
  await room.handle({ act: 'biz-start', arg: '' });
  assert.deepEqual(sent.find(s => s[1] === 'start'), ['act', 'start', { provider: 'codex' }], '화면이 보내는 두 번째 누름(빈 arg)이 다시 읽는다');
  await room.handle({ act: 'biz-hand', arg: 'n1' });
  await room.handle({ act: 'biz-hand-send', fields: { extra: '급하지 않아요' } });
  assert.deepEqual(sent.find(s => s[1] === 'handoff'), ['act', 'handoff', { key: 'n1', departmentId: 'dev001', provider: 'claude', extra: '급하지 않아요' }]);
  await room.handle({ act: 'biz-cancel', arg: 't1' });
  assert.deepEqual(sent.find(s => s[0] === 'task'), ['task', 't1', 'cancel']);
  room.close();
  assert.equal(room.scene(null), null);
  assert.ok(changes > 0);
});

test('앱 창이 가려진 동안은 읽는 진행을 다시 묻지 않고, 다시 보이면 묻는다', async () => {
  let reads = 0, hidden = false;
  const timers = [];
  const room = createBizplanRoom({ api: { featureSnapshot: async () => { reads++; return snap({ read: null }); } }, hidden: () => hidden, setTimer: fn => timers.push(fn), clearTimer: () => {} });
  const task = { id: 't1', status: 'running', updatedAt: 1 };
  room.open('plan01');
  await new Promise(r => setTimeout(r, 0));
  room.scene(task, { departments: depts });
  await new Promise(r => setTimeout(r, 0));
  const before = reads;
  assert.equal(timers.length, 1);
  hidden = true;
  timers[0]();
  room.scene(task, { departments: depts });
  await new Promise(r => setTimeout(r, 0));
  assert.equal(reads, before, '걸어 둔 물음도 가려졌으면 보내지 않는다');
  assert.equal(timers.length, 1);
  hidden = false;
  room.scene(task, { departments: depts });
  assert.equal(timers.length, 2);
  timers[1]();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(reads, before + 1);
});

test('코드 검수: 저장 안 한 평가 항목을 먼저 저장하고 읽으며, 기능 판을 못 읽으면 기록 지우기를 보인다', async () => {
  const sent = [];
  const api = {
    featureSnapshot: async () => snap({ read: null }),
    featureAction: async (f, d, action, args) => { sent.push([action, args]); return { ok: true }; },
  };
  const room = createBizplanRoom({ api, changed: () => {}, setTimer: () => 0, clearTimer: () => {} });
  room.open('plan01');
  await new Promise(r => setTimeout(r, 0));
  room.scene(null, { departments: depts });
  await room.handle({ act: 'biz-criteria', arg: 'pasted' });
  await room.handle({ act: 'biz-start', arg: '', fields: { criteria: '시장성\n기술성' } });
  assert.deepEqual(sent.map(s => s[0]), ['criteria', 'start']);
  assert.deepEqual(sent[0][1], { mode: 'pasted', text: '시장성\n기술성' });
  const sc = bizplanScene({ ok: false, code: 'BROKEN' }, {}, { departments: depts });
  assert.equal(sc.stage, 'error');
  assert.match(sc.head[1], /기록 지우기/);
});

test('앱 창 확인: 근거 없는 문장도 고친 문장이 있으면 넣는 단추가 있고, 맡길 부서가 없으면 맡기기를 숨긴다', () => {
  const r = read();
  r.notes[1] = { ...r.notes[1], fix: '홈페이지에서 판매하고 있습니다.' };
  const only = bizplanScene(snap({ read: r }), null, { departmentId: 'plan01', sel: 'n1' }, { departments: [depts[0]] });
  const n = only.notes.find(x => x.key === 'n1');
  assert.deepEqual(n.acts.map(a => a[0]), ['고친 문장으로 바꾸기', '직접 고치기', '그대로 두기']);
  const two = bizplanScene(snap({ read: r }), null, { departmentId: 'plan01' }, { departments: depts });
  assert.ok(two.notes.find(x => x.key === 'n1').acts.some(a => a[1] === 'biz-hand'));
});

test('앱 창 확인: 빈약한 평가 항목이 걸린 절도 종이에 짚고, 그 항목을 고르면 절에 막대를 세운다', () => {
  const r = read();
  r.items = [{ item: '성장 전략', secs: [r.sections[0].id], thin: true, why: '방법이 빠졌습니다.', asks: [] }];
  const sc = bizplanScene(snap({ read: r }), null, { sel: 'i:성장 전략' }, { departments: depts });
  const sec = sc.paper.secs.find(s => s.id === r.sections[0].id);
  assert.equal(sec.has, true);
  assert.equal(sec.pick, true);
  const other = bizplanScene(snap({ read: r }), null, { sel: 'n0' }, { departments: depts });
  assert.equal(other.paper.secs.find(s => s.id === r.sections[0].id).pick, false);
});

test('한 장씩(14.1): 장마다 장 이름과 앞뒤 문장, 고르면 고친 문장, 다 고르면 고른 장이 없고 바뀐 것을 모은다', () => {
  const long = '가'.repeat(10) + ' ' + '나'.repeat(200) + ' ';
  const r = read();
  r.paragraphs[1] = { text: long + '단골 손님 300명이 매달 다시 삽니다.' + ' 다음 문장' + ' 라'.repeat(120) };
  r.notes[0] = { ...r.notes[0], from: long.length, to: long.length + 22 };
  const sc = bizplanScene(snap({ read: r }), null, {}, { departments: depts });
  const p = sc.notes[0].place;
  assert.equal(p.title, '지금까지 한 일');
  assert.equal(p.mark, '단골 손님 300명이 매달 다시 삽니다.');
  assert.ok(p.before.startsWith('… ') && p.before.length <= 153, '앞이 길면 낱말 경계에서 줄인다');
  assert.ok(p.after.endsWith(' …') && p.after.length <= 153);
  assert.equal(p.changed, false);
  assert.equal(sc.notes[2].place.title, '3년 뒤', '빈약한 항목은 걸린 절 이름');
  assert.deepEqual([sc.sel, sc.at, sc.open], ['n0', 0, 3]);
  r.notes[0].choice = { kind: 'fix' };
  const one = bizplanScene(snap({ read: r }), null, { sel: 'n0' }, { departments: depts });
  assert.equal(one.notes[0].place.mark, '10월에 다시 산 손님은 112명입니다.');
  assert.equal(one.notes[0].place.changed, true);
  assert.equal(bizplanScene(snap({ read: r }), null, {}, { departments: depts }).sel, 'n1', '고른 뒤에는 다음 고칠 곳이 앞에 선다');
  r.notes[1].choice = { kind: 'handed', departmentId: 'dev001' };
  const done = bizplanScene(snap({ read: r, drafts: { '성장 전략': { answers: [0], text: '인스타그램에서 만납니다.' } } }), null, {}, { departments: depts });
  assert.equal(done.sel, null, '다 고르면 끝 화면');
  assert.deepEqual(done.changed, [
    { text: '10월에 다시 산 손님은 112명입니다.', tag: '' },
    { text: '매출 5억 원을 목표로 합니다.', tag: '개발부에 맡김', hand: true },
    { text: '인스타그램에서 만납니다.', tag: '「성장 전략」에 넣음' },
  ]);
  assert.equal(bizplanScene(snap({ read: r }), null, { sel: 'n0' }, { departments: depts }).sel, 'n0', '「다시 보기」로 고른 장은 보인다');
});

test('한 장씩(14.1): 고르면 되돌리기 알림이 뜨고 장이 넘어가며, 되돌리면 그 장으로 돌아온다. 메뉴와 전체 보기는 하나씩 연다', async () => {
  const sent = [];
  const timers = [];
  const api = { featureSnapshot: async () => snap(), featureAction: async (f, d, action, args) => { sent.push([action, args]); return { ok: true }; } };
  const room = createBizplanRoom({ api, changed: () => {}, setTimer: fn => { timers.push(fn); return timers.length; }, clearTimer: () => {} });
  room.open('plan01');
  await new Promise(r => setTimeout(r, 0));
  await room.handle({ act: 'biz-choose', arg: 'n0|fix' });
  assert.deepEqual(room.state().toast, { text: '고쳤습니다.', key: 'n0' });
  assert.equal(room.state().sel, null);
  await room.handle({ act: 'biz-choose', arg: 'n0|undo' });
  assert.deepEqual(sent.at(-1), ['choose', { key: 'n0', kind: 'undo' }]);
  assert.equal(room.state().toast, null);
  assert.equal(room.state().sel, 'n0', '되돌리면 그 장');
  await room.handle({ act: 'biz-choose', arg: 'n1|keep' });
  assert.equal(room.state().toast.text, '그대로 두었습니다.');
  timers.at(-1)();
  assert.equal(room.state().toast, null, '잠시 뒤 사라진다');
  await room.handle({ act: 'biz-menu', arg: 'staff' });
  assert.equal(room.state().menu, 'staff');
  assert.equal(bizplanScene(snap({ read: null }), null, { menu: 'staff' }).menu, 'staff', '넣기 전 화면에서도 메뉴가 열린다');
  await room.handle({ act: 'biz-menu', arg: 'crit' });
  assert.equal(room.state().menu, 'crit', '다른 메뉴를 열면 앞 메뉴는 닫힌다');
  await room.handle({ act: 'biz-menu', arg: 'nope' });
  assert.equal(room.state().menu, null);
  await room.handle({ act: 'biz-menu', arg: 'staff' });
  await room.handle({ act: 'biz-provider', arg: 'codex' });
  assert.deepEqual([room.state().provider, room.state().menu], ['codex', null], '고르면 메뉴를 닫는다');
  await room.handle({ act: 'biz-sheet' });
  assert.equal(room.state().sheet, true);
  await room.handle({ act: 'biz-go', arg: 'i:성장 전략' });
  assert.deepEqual([room.state().sel, room.state().sheet], ['i:성장 전략', false]);
  room.close();
  assert.equal(room.state().toast, null);
});

test('카본 검수 반영: 「끝으로」는 남은 장이 있어도 끝 화면, 같이 쓰기 답을 다시 고르고, 바쁜 동안은 고르기 · 장 옮기기를 받지 않으며, 고른 결과를 알림 자리에 읽는다', async () => {
  assert.equal(bizplanScene(snap(), null, { sel: '' }, { departments: depts }).sel, null, '「끝으로」(biz-go \'\')');
  assert.equal(bizplanScene(snap(), null, { sel: null }, { departments: depts }).sel, 'n0');
  let release;
  const api = {
    featureSnapshot: async () => snap({ drafts: { '성장 전략': { answers: [1], text: '지인 소개로 만납니다.' } } }),
    featureAction: async () => { await new Promise(r => { release = r; }); return { ok: true }; },
  };
  const room = createBizplanRoom({ api, changed: () => {}, setTimer: () => 0, clearTimer: () => {} });
  room.open('plan01');
  await new Promise(r => setTimeout(r, 0));
  await room.handle({ act: 'biz-reanswer', arg: '성장 전략|0' });
  assert.deepEqual(room.state().answers['성장 전략'], [], '넣은 초안의 답도 그 물음부터 다시 고른다');
  const pending = room.handle({ act: 'biz-choose', arg: 'n0|fix' });
  await new Promise(r => setTimeout(r, 0));
  assert.equal(room.state().busy, 'choose');
  await room.handle({ act: 'biz-go', arg: 'n1' });
  await room.handle({ act: 'biz-choose', arg: 'n1|keep' });
  assert.equal(room.state().sel, 'n0', '바쁜 동안 옮기거나 고르지 않는다');
  release();
  await pending;
  assert.equal(room.state().sel, null);
  assert.equal(room.state().live, '고쳤습니다.', '알림 자리에도 읽는다');
});

test('Opus 대체 검수 반영: 다시 읽은 결과는 첫 고칠 곳부터, 같은 문단의 앞 고침은 고친 대로 보인다', async () => {
  let snapNow = snap();
  const api = { featureSnapshot: async () => snapNow, featureAction: async () => ({ ok: true }) };
  const room = createBizplanRoom({ api, changed: () => {}, setTimer: () => 0, clearTimer: () => {} });
  room.open('plan01');
  await new Promise(r => setTimeout(r, 0));
  await room.handle({ act: 'biz-go', arg: '' });
  assert.equal(room.scene(null, { departments: depts }).sel, null, '「끝으로」 뒤 끝 화면');
  snapNow = snap({ read: read({ id: 'r2' }) });
  await room.handle({ act: 'biz-start', arg: '' });
  assert.equal(room.scene(null, { departments: depts }).sel, 'n0', '새 읽기 결과는 첫 고칠 곳부터');
  const r = read();
  r.paragraphs[1] = { text: '매출은 10억 원입니다. 단골 손님 300명이 매달 다시 삽니다.' };
  const t = r.paragraphs[1].text, qa = '매출은 10억 원입니다.', qb = '단골 손님 300명이 매달 다시 삽니다.';
  r.notes = [{ ...r.notes[0], key: 'a', para: 1, from: 0, to: qa.length, quote: qa, fix: '매출은 3억 원입니다.', choice: { kind: 'fix' } },
    { ...r.notes[0], key: 'b', para: 1, from: t.indexOf(qb), to: t.indexOf(qb) + qb.length, quote: qb, choice: null }];
  const sc = bizplanScene(snap({ read: r }), null, { sel: 'b' }, { departments: depts });
  assert.equal(sc.notes.find(n => n.key === 'b').place.before, '매출은 3억 원입니다. ');
});

test('직접 쓰기(14.2): 한 장에 물음 하나, 건너뛴 장은 넘기고, 다 쓰면 초안을 만들어 계획서로 세운다. 빈 장은 「직접 쓰기」 장이 된다', async () => {
  const draft = { chapters: ['바쁜 직장인은 아침을 거르기 쉽습니다.', '', '', '', '', '', ''], skipped: [2], isPlan: false };
  const noPlan = o => snap({ read: null, list: list({ plan: null, data: [] }), draft, ...o });
  const w = bizplanScene(noPlan(), null, { write: 1 }, { departments: depts });
  assert.equal(w.stage, 'write');
  assert.equal(w.chapter.name, '해결책');
  assert.deepEqual(w.segs.map(s => s.state), ['ok', 'on', 'skip', '', '', '', '']);
  assert.equal(w.last, false);
  assert.equal(bizplanScene(noPlan(), null, { write: 6 }, { departments: depts }).last, true);
  { const w = bizplanScene(noPlan(), null, {}, { departments: depts }).writing; assert.deepEqual({ written: w.written, resume: w.resume, isPlan: w.isPlan, edited: w.edited }, { written: 1, resume: 1, isPlan: false, edited: false }); }
  const ready = bizplanScene(snap({ read: null, list: list({ plan: { name: '사업계획서_초안_20261127-0100.md' } }), draft: { ...draft, isPlan: true } }), null, {}, { departments: depts });
  assert.equal(ready.draftReady, true);
  assert.equal(ready.head[0], '사업계획서 초안이 생겼습니다.');
  assert.equal(ready.chapters[0].first, '바쁜 직장인은 아침을 거르기 쉽습니다.');
  // 빈 장: 본체가 세운 empty를 「직접 쓰기」 장으로
  const r = read({ fromDraft: true, empty: [{ chapter: 3, name: '경쟁과 차별점', sec: 2 }] });
  const sc = bizplanScene(snap({ read: r, draft }), null, { sel: 'e:3' }, { departments: depts });
  const e = sc.notes.find(n => n.key === 'e:3');
  assert.equal(e.kind, 'empty');
  assert.deepEqual(e.acts, [['직접 쓰기', 'biz-write-open', 3, 'main']]);
  assert.equal(e.place.title, '04 경쟁과 차별점');
  const wrote = { ...draft, chapters: draft.chapters.map((t, k) => (k === 3 ? '마트보다 설탕이 절반입니다.' : t)) };
  assert.equal(bizplanScene(snap({ read: r, draft: wrote }), null, {}, { departments: depts }).notes.find(n => n.key === 'e:3').state, 'open', '「나중에 쓰기」만 하면 계획서 파일은 그대로라 아직 빈 장(카본 A2)');
  const filled = bizplanScene(snap({ read: r, draft: wrote, planChanged: true }), null, {}, { departments: depts });
  assert.equal(filled.notes.find(n => n.key === 'e:3').state, 'done');
  // 방: 「다음」은 장마다 남기고 건너뛴 장을 넘기며, 마지막에 초안을 만든다
  const sent = [];
  let now = noPlan();
  const api = {
    featureSnapshot: async () => now,
    featureAction: async (f, d, action, args) => { sent.push([action, args]); if (action === 'write-save') { now = noPlan({ draft: { ...now.draft, chapters: now.draft.chapters.map((t, k) => (k === args.chapter ? args.text : t)) } }); } return { ok: true }; },
  };
  const room = createBizplanRoom({ api, changed: () => {}, setTimer: () => 0, clearTimer: () => {} });
  room.open('plan01');
  await new Promise(res => setTimeout(res, 0));
  await room.handle({ act: 'biz-write-open', arg: '1' });
  assert.equal(room.state().write, 1);
  await room.handle({ act: 'biz-write-next', fields: { 'answer-1': '설탕을 절반으로 줄여 굽습니다.' } });
  assert.deepEqual(sent.at(-1), ['write-save', { chapter: 1, text: '설탕을 절반으로 줄여 굽습니다.' }]);
  assert.equal(room.state().write, 3, '건너뛴 셋째 장(2)은 넘긴다');
  await room.handle({ act: 'biz-write-go', arg: '5', fields: { 'answer-3': '아직 쓰는 중' } });
  assert.equal(room.state().writeText[3], '아직 쓰는 중', '막대로 옮겨도 쓰던 글은 화면에 남는다');
  assert.equal(sent.length, 1, '막대로 옮길 때는 본체에 보내지 않는다');
  await room.handle({ act: 'biz-write-skip', fields: { 'answer-5': '' } });
  assert.deepEqual(sent.at(-1), ['write-save', { chapter: 5, text: '', skipped: true }]);
  await room.handle({ act: 'biz-write-next', fields: { 'answer-6': '3년 뒤 매출 5억 원을 목표로 합니다.' } });
  assert.deepEqual(sent.map(s => s[0]).slice(-2), ['write-save', 'write-done'], '마지막 장 뒤에 초안을 만든다');
  assert.equal(room.state().write, null);
  assert.ok(sent.some(s => s[0] === 'write-save' && s[1].chapter === 3 && s[1].text === '아직 쓰는 중'), '막대로 옮기며 쓴 장도 초안을 만들기 전에 남긴다(카본 A1)');
  assert.ok(sent.findIndex(s => s[1]?.chapter === 3) < sent.findIndex(s => s[0] === 'write-done'));
  await room.handle({ act: 'biz-write-open', arg: '2' });
  await room.handle({ act: 'biz-write-go', arg: '4', fields: { 'answer-2': '반쯤' } });
  await room.handle({ act: 'biz-write-later', fields: { 'answer-4': '넷째 장' } });
  assert.deepEqual(sent.slice(-2).map(s => s[1]), [{ chapter: 4, text: '넷째 장' }, { chapter: 2, text: '반쯤' }], '나중에 쓰기도 막대로 옮기며 쓴 장까지 남긴다');
  assert.equal(room.state().write, null, '나중에 쓰기는 남기고 닫는다');
});

test('Opus 대체 검수(쓰기 화면): 쓰는 글은 방에 남고, 닫아도 쓰던 장을 남기며, 고른 고침이 있으면 빈 장 쓰기 전에 한 번 묻는다', async () => {
  const draft = { chapters: ['첫 장', '', '', '', '', '', ''], skipped: [], isPlan: true };
  const sent = [];
  let now = snap({ draft, read: read({ fromDraft: true, empty: [{ chapter: 3, name: '경쟁과 차별점', sec: 2 }], notes: read().notes.map((n, i) => (i === 0 ? { ...n, choice: { kind: 'fix' } } : n)) }) });
  const api = { featureSnapshot: async () => now, featureAction: async (f, d, action, args) => { sent.push([action, args]); return action === 'write-done' ? { ok: false, code: 'WRITE_EMPTY' } : { ok: true }; } };
  const room = createBizplanRoom({ api, changed: () => {}, setTimer: () => 0, clearTimer: () => {} });
  room.open('plan01');
  await new Promise(res => setTimeout(res, 0));
  const sc = room.scene(null, { departments: depts });
  assert.equal(sc.notes[0].kind, 'empty', '빈 장이 고칠 곳 앞에 선다');
  assert.equal(sc.notes[0].place.before, '이미 있는 것과 무엇이 다른가요?');
  await room.handle({ act: 'biz-write-open', arg: '3' });
  assert.equal(room.state().write, null, '첫 누름은 묻기만 한다');
  assert.match(room.state().live, /고른 고침 1개는/);
  await room.handle({ act: 'biz-write-open', arg: '3' });
  assert.equal(room.state().write, 3);
  await room.handle({ act: 'biz-write-type', arg: '3', fields: { 'answer-3': '마트보다 설탕이 절반입니다.' } });
  assert.equal(room.scene(null, { departments: depts }).text, '마트보다 설탕이 절반입니다.', '다시 그려도 쓰던 글이 남는다');
  assert.equal(sent.length, 0, '쓰는 동안은 본체에 보내지 않는다');
  room.close({ fields: { 'answer-3': '마트보다 설탕이 절반이고 그날 굽습니다.' } });
  await new Promise(res => setTimeout(res, 0));
  assert.deepEqual(sent, [['write-save', { chapter: 3, text: '마트보다 설탕이 절반이고 그날 굽습니다.' }]], '「← 사무실」로 닫아도 쓰던 장을 남긴다');
  // 일곱 장을 다 건너뛰면 까닭을 바로 말한다
  now = snap({ read: null, list: list({ plan: null, data: [] }), draft: { chapters: ['', '', '', '', '', '', ''], skipped: [0, 1, 2, 3, 4, 5], isPlan: false } });
  const r2 = createBizplanRoom({ api, changed: () => {}, setTimer: () => 0, clearTimer: () => {} });
  r2.open('plan01');
  await new Promise(res => setTimeout(res, 0));
  await r2.handle({ act: 'biz-write-open', arg: '6' });
  await r2.handle({ act: 'biz-write-skip', fields: { 'answer-6': '' } });
  assert.equal(r2.state().live, '한 장 이상 써야 초안을 만들 수 있습니다.');
});

test('Opus 대체 다시 검수(쓰기 화면): 읽은 뒤 초안을 다시 만들면 바로 다시 읽고(FA3), 막대로 쓴 장이 깨진 기록에 막혀도 같은 안내(FA1), 빈 장 카드는 한 말투(FA2)', async () => {
  const draft = { chapters: ['첫 장', '', '', '', '', '', ''], skipped: [1, 2, 4, 5, 6], isPlan: true };
  const sent = [];
  let now = snap({ draft, read: read({ fromDraft: true, provider: 'codex', empty: [{ chapter: 3, name: '경쟁과 차별점', sec: 2 }] }) });
  let brokenAt = null;
  const api = {
    featureSnapshot: async () => now,
    featureAction: async (f, d, action, args) => {
      sent.push([action, args]);
      if (action === 'write-save' && args.chapter === brokenAt) { now = { ...now, draft: { ...now.draft, broken: true } }; return { ok: false, code: 'BROKEN' }; }
      if (action === 'write-save') now = { ...now, draft: { ...now.draft, chapters: now.draft.chapters.map((t, k) => (k === args.chapter ? args.text : t)) } };
      if (action === 'write-done') return { ok: true, name: '사업계획서_초안_20261127-0300-2.md', changed: true, kept: '사업계획서_초안_20261127-0300.md' };
      return { ok: true };
    },
  };
  const room = createBizplanRoom({ api, changed: () => {}, setTimer: () => 0, clearTimer: () => {} });
  room.open('plan01');
  await new Promise(res => setTimeout(res, 0));
  await room.handle({ act: 'biz-write-open', arg: '3' });
  await room.handle({ act: 'biz-write-next', fields: { 'answer-3': '마트보다 설탕이 절반입니다.' } });
  assert.deepEqual(sent.map(s => s[0]), ['write-save', 'write-done', 'start'], '앞 읽기의 고칠 곳은 바뀐 파일에 저장할 수 없어 바로 다시 읽는다');
  assert.deepEqual(sent.at(-1)[1], { provider: 'codex' });
  assert.match(room.state().live, /앞 초안 파일은 그대로 두었습니다/);
  // 막대로 옮겨 쓴 다른 장이 깨진 기록에 막히면 쓰기를 닫고 「기록 지우기」를 가리킨다
  sent.length = 0; brokenAt = 0;
  await room.handle({ act: 'biz-write-open', arg: '3' });
  await room.handle({ act: 'biz-write-go', arg: '0', fields: { 'answer-3': '마트보다 설탕이 절반입니다.' } });
  await room.handle({ act: 'biz-write-go', arg: '3', fields: { 'answer-0': '첫 장을 고침' } });
  await room.handle({ act: 'biz-write-next', fields: { 'answer-3': '마트보다 설탕이 절반이고 그날 굽습니다.' } });
  assert.equal(room.state().write, null);
  assert.match(room.state().live, /「기록 지우기」로 지운 뒤/);
  const sc = room.scene(null, { departments: depts });
  assert.equal(sc.broken, true, '고칠 곳 화면도 「기록 지우기」를 보인다');
  // 빈 장 카드의 두 글은 같은 말투
  const filled = bizplanScene(snap({ read: read({ fromDraft: true, empty: [{ chapter: 3, name: '경쟁과 차별점', sec: 2 }] }), draft: { ...draft, chapters: draft.chapters.map((t, k) => (k === 3 ? '글' : t)) }, planChanged: true }), null, {}, { departments: depts });
  assert.equal(filled.notes.find(n => n.key === 'e:3').done, '「경쟁과 차별점」 장을 썼어요. 다시 읽으면 반영돼요.');
});

test('Opus 대체 검수 r3: 빈 장이 둘 이상이면 「다음」이 건너뛴 빈 장과 앞쪽 빈 장에도 들러 한 번에 다시 읽는다', () => {
  const dr = { chapters: ['첫 장', '둘째', '', '', '다섯째', '여섯째', ''], skipped: [2, 6] };
  assert.equal(nextWrite(3, dr, { 3: '넷째' }, [2, 3, 6]), 6, '건너뛴 장도 읽은 뒤 빈 장이면 들른다');
  assert.equal(nextWrite(6, dr, { 3: '넷째', 6: '일곱째' }, [2, 3, 6]), 2, '앞쪽 빈 장으로 돌아간다');
  assert.equal(nextWrite(2, dr, { 2: '셋째', 3: '넷째', 6: '일곱째' }, [2, 3, 6]), -1);
  assert.equal(nextWrite(3, dr, { 3: '넷째' }, []), -1, '읽기 전 처음 쓰기는 건너뛴 장을 다시 묻지 않는다');
  const r = read({ fromDraft: true, empty: [{ chapter: 3, name: '경쟁과 차별점', sec: 2 }, { chapter: 6, name: '실행 계획과 자금', sec: 5 }] });
  const sc = bizplanScene(snap({ read: r, draft: { ...dr, isPlan: true } }), null, { write: 3, writeText: { 3: '넷째' } }, { departments: depts });
  assert.equal(sc.last, false, '6장이 비어 있으면 3장 단추는 「다 썼습니다」가 아니다');
});

test('GPT 다시 검수 r3 GA2: 잠시 읽지 못한 기록(STORAGE)은 쓰기 화면을 닫거나 「기록 지우기」를 가리키지 않는다', async () => {
  const api = { featureSnapshot: async () => snap({ read: null, list: list({ plan: null, data: [] }), draft: { chapters: ['', '', '', '', '', '', ''], skipped: [], isPlan: false } }), featureAction: async (f, d, action) => (action === 'write-save' ? { ok: false, code: 'STORAGE' } : { ok: true }) };
  const room = createBizplanRoom({ api, changed: () => {}, setTimer: () => 0, clearTimer: () => {} });
  room.open('plan01');
  await new Promise(res => setTimeout(res, 0));
  await room.handle({ act: 'biz-write-open', arg: '1' });
  await room.handle({ act: 'biz-write-next', fields: { 'answer-1': '설탕을 줄여 굽습니다.' } });
  assert.equal(room.state().write, 1, '쓰기 화면이 그대로');
  assert.equal(room.state().writeText[1], '설탕을 줄여 굽습니다.');
  assert.match(room.state().live, /잠시 뒤 다시 눌러/);
  assert.doesNotMatch(room.state().live, /기록 지우기/);
});

test('Opus 설계 검토(bizplan-write-design 지적 2 · 3): 파일에서 고친 초안을 화면이 알리고, 창이 가려지면 쓰던 장을 남긴다', async () => {
  const dr = { chapters: ['첫 장', '', '', '', '', '', ''], skipped: [], isPlan: true, edited: true, name: '사업계획서_초안_20261127-0300.md' };
  const start = bizplanScene(snap({ read: null, list: list({ plan: { name: dr.name } }), draft: dr }), null, {}, { departments: depts });
  assert.equal(start.writing.edited, true);
  assert.equal(start.writing.name, dr.name);
  const w = bizplanScene(snap({ read: null, list: list({ plan: { name: dr.name } }), draft: dr }), null, { write: 1 }, { departments: depts });
  assert.equal(w.edited, true);
  const sent = [];
  const api = { featureSnapshot: async () => snap({ read: null, list: list({ plan: null, data: [] }), draft: { ...dr, isPlan: false, edited: false } }), featureAction: async (f, d, action, args) => { sent.push([action, args]); return { ok: true }; } };
  const room = createBizplanRoom({ api, changed: () => {}, setTimer: () => 0, clearTimer: () => {} });
  room.open('plan01');
  await new Promise(res => setTimeout(res, 0));
  await room.handle({ act: 'biz-write-open', arg: '1' });
  await room.handle({ act: 'biz-write-type', arg: '1', fields: { 'answer-1': '설탕을 줄여 굽습니다.' } });
  room.flush();
  await new Promise(res => setTimeout(res, 0));
  assert.deepEqual(sent, [['write-save', { chapter: 1, text: '설탕을 줄여 굽습니다.' }]]);
  assert.equal(room.state().write, 1, '쓰기 화면은 그대로');
});

test('Opus 대체 다시 검수 r4: 빈 장 둘에서 건너뛰기만 눌러도 오가지 않고 끝에 닿으며(P1), 파일 이름 뒤 조사가 맞고, 실패한 읽기에는 「다시 읽은 뒤 저장」 띠가 없다', async () => {
  const draft = { chapters: ['첫 장', '둘째', '', '넷째', '다섯째', '여섯째', ''], skipped: [], isPlan: true };
  const sent = [];
  let now = snap({ draft, read: read({ fromDraft: true, empty: [{ chapter: 2, name: '고객과 시장', sec: 3 }, { chapter: 6, name: '실행 계획과 자금', sec: 7 }] }) });
  const api = {
    featureSnapshot: async () => now,
    featureAction: async (f, d, action, args) => {
      sent.push([action, args]);
      if (action === 'write-save' && args.skipped) now = { ...now, draft: { ...now.draft, skipped: [...new Set([...now.draft.skipped, args.chapter])] } };
      return action === 'write-done' ? { ok: false, code: 'WRITE_EMPTY' } : { ok: true };
    },
  };
  const room = createBizplanRoom({ api, changed: () => {}, setTimer: () => 0, clearTimer: () => {} });
  room.open('plan01');
  await new Promise(res => setTimeout(res, 0));
  await room.handle({ act: 'biz-write-open', arg: '2' });
  await room.handle({ act: 'biz-write-skip', fields: { 'answer-2': '' } });
  assert.equal(room.state().write, 6);
  assert.equal(room.scene(null, { departments: depts }).last, true, '6장에서는 「다 썼습니다」');
  await room.handle({ act: 'biz-write-skip', fields: { 'answer-6': '' } });
  assert.equal(sent.at(-1)[0], 'write-done', '2장으로 돌아가지 않고 끝에 닿는다');
  // 조사
  const dr = { ...draft, edited: true, name: '사업계획서_초안_20261127-0300.md' };
  const sc = bizplanScene(snap({ read: null, list: list({ plan: { name: dr.name } }), draft: dr }), null, {}, { departments: depts });
  assert.match(sc.writing.note, /0300\.md는 그대로 둡니다/);
  // 실패한 읽기
  const failed = bizplanScene(snap({ read: read({ status: 'failed', reason: 'LIMIT' }), planChanged: true }), null, {}, { departments: depts });
  assert.equal(failed.planChanged, false);
});

/* ── 심사위원 셋의 점수와 무대(사업계획서_설계.md 14.3) ── */
const CRIT = ['문제 인식', '현실성', '신뢰성', '시장성', '수익 구조', '팀 역량'];
const marks = (pts, o = {}) => CRIT.map((crit, i) => ({ crit, score: pts[i], strong: false, why: `${crit}의 까닭입니다.`, para: 0, quote: '', ...(o[crit] || {}) }));
const RUBRIC = [{ crit: '신뢰성', x: '숫자와 주장에 근거가 없다', t: '근거가 일부에만 있다', o: '모든 숫자에 출처나 셈이 있다', v: '출처가 공공 자료나 직접 잰 기록이다' }];
// Opus와 Sonnet이 고르고 Sol은 한도로 쉬었다. ○ 5 · △ 4 · ✕ 3(네 단계는 ✓ 1 · ○ 4), 가장 약한 곳은 신뢰성(✕ 둘), 팀 역량은 ○와 ✕로 갈린다
const scoresOf = (o = {}) => ({
  at: 5000, kind: 'read', status: 'partial', criteria: CRIT, rubric: RUBRIC, prev: null, prevSum: null,
  sum: { tally: { v: 1, o: 4, t: 4, x: 3 }, weakest: { crit: '신뢰성', sev: 4 } },
  judges: [
    { id: 'opus', name: 'Opus', provider: 'claude', status: 'ok', reason: null, line: '숫자를 믿을 수 있어야 투자를 봅니다.', actualModel: '',
      scores: marks([3, 2, 1, 2, 3, 3], { '문제 인식': { strong: true }, '신뢰성': { why: '단골 수의 근거가 없습니다.', para: 2, quote: '단골 손님 300명' } }),
      reacts: [{ sec: 2, kind: 'hmm', say: '5억 원 근거는요?' }, { sec: 1, kind: 'oh', say: '단골이 있네요.' }] },
    { id: 'sol', name: 'Sol', provider: 'codex', status: 'failed', reason: 'LIMIT', scores: null, line: '', reacts: [], actualModel: '' },
    { id: 'sonnet', name: 'Sonnet', provider: 'claude', status: 'ok', reason: null, line: '근거 없는 숫자가 걸립니다.', actualModel: '',
      scores: marks([2, 2, 1, 3, 3, 1], { '신뢰성': { why: '「신뢰성」 표시의 까닭을 확인하지 못했습니다.' } }), reacts: [{ sec: 1, kind: 'hmm', say: '몇 명이 다시 사나요?' }] },
  ],
  ...o,
});
// 앞 표시: {심사위원: {항목: {score, strong}}}
const prevOf = (opus, sonnet) => ({ opus: Object.fromEntries(CRIT.map((c, i) => [c, { score: opus[i], strong: false }])), sonnet: Object.fromEntries(CRIT.map((c, i) => [c, { score: sonnet[i], strong: false }])) });
const runTask = (o = {}) => ({ id: 't9', status: 'running', featureKind: 'read', provider: 'claude', others: false, updatedAt: 2, createdAt: 1, ...o });
const prog = title => ({ taskId: 't9', part: 4, total: 6, title });

test('심사 무대(14.3): 업무 줄의 「심사 · 이름」 차례만 보이고, 앉은 수와 다시 심사에 맞춰 맨 위 문장이 바뀐다', () => {
  assert.deepEqual([seatedFor('claude'), seatedFor('codex'), seatedFor('claude', true)], [['opus', 'sonnet'], ['sol'], ['opus', 'sol', 'sonnet']]);
  const two = bizplanScene(snap({ progress: prog('심사 · Sonnet') }), runTask(), {}, { departments: depts });
  assert.equal(two.stage, 'judging');
  assert.deepEqual(two.head, ['심사위원 둘이 읽고 있습니다.', '심사위원마다 1~2분 걸립니다.']);
  assert.deepEqual(two.show.judges.map(j => [j.state, j.status]), [['passed', '차례를 마쳤습니다'], ['off', '이번에는 쉽니다'], ['read', '읽는 중']]);
  assert.deepEqual(two.show.judges.map(j => j.seated), [true, false, true], '앉지 않은 심사위원은 무대에 없다');
  assert.deepEqual(two.show.judges[2].bubble, { kind: 'dots', say: '' }, '읽는 심사위원 위에만 생각하는 점 셋');
  assert.equal(two.show.judges[0].bubble, null);
  assert.deepEqual(two.show.cap, [['Sonnet', true], [' 심사위원이 계획서를 읽고 있습니다.', false]]);
  assert.equal(two.show.presenter, 'nervous');
  assert.deepEqual([two.show.judges[0].co, two.show.judges[0].eye], ['Claude', '투자자의 눈']);
  const gpt = bizplanScene(snap({ progress: prog('심사 · Sol') }), runTask({ provider: 'codex' }), {}, { departments: depts });
  assert.equal(gpt.head[0], 'GPT 심사위원이 읽고 있습니다.');
  assert.deepEqual(gpt.show.judges.map(j => j.state), ['off', 'read', 'off']);
  const three = bizplanScene(snap({ progress: prog('심사 · Opus') }), runTask({ others: true }), {}, { departments: depts });
  assert.equal(three.head[0], '심사위원 셋이 읽고 있습니다.');
  assert.deepEqual(three.show.judges.map(j => j.state), ['read', 'wait', 'wait']);
  assert.equal(three.show.key, two.show.key, '같은 업무 줄이면 같은 무대(다시 그려도 처음부터 틀지 않는다)');
  const again = bizplanScene(snap(), runTask({ featureKind: 'score' }), {}, { departments: depts });
  assert.equal(again.stage, 'judging', '다시 심사는 차례가 오기 전에도 무대');
  assert.equal(again.head[0], '고친 계획서로 다시 심사받습니다.');
  assert.deepEqual(again.show.judges.map(j => j.state), ['wait', 'off', 'wait']);
  assert.deepEqual(again.show.cap, [['심사위원이 자리에 앉았습니다.', false]]);
  assert.equal(bizplanScene(snap({ progress: prog('3년 뒤') }), runTask(), {}, { departments: depts }).stage, 'reading', '읽는 차례는 그대로 읽는 화면');
  assert.equal(bizplanScene(snap(), runTask({ featureKind: 'score', status: 'queued' }), {}, { departments: depts }).head[0], '자리가 비면 다시 심사합니다.');
});

test('점수 결과(14.3): ○ △ ✕의 수, 가장 약한 항목과 한마디 하나, 의견이 갈림, 쉬어 간 심사위원, 인용의 묶음 이름, 채점 기준', () => {
  const sc = bizplanScene(snap({ scores: scoresOf() }), null, { results: 5000 }, { departments: depts });
  assert.equal(sc.stage, 'score');
  const v = sc.score;
  assert.equal(v.marks, 3, '기본은 세 단계');
  assert.deepEqual(v.tally, [['o', 5], ['t', 4], ['x', 3]], '세 단계는 ✓를 ○에 합친다');
  assert.equal(v.lab, '두 심사위원의 표시 12개');
  assert.equal(v.was, '');
  assert.equal(v.avg, undefined, '숫자 평균은 없다');
  assert.deepEqual(v.head, ['신뢰성이 가장 약합니다.', '단골 수의 근거가 없습니다.'], '한마디는 가장 낮은 표시를 준 심사위원의 글, 정해진 글은 건너뛴다');
  assert.deepEqual(v.cols, ['Opus', 'Sonnet'], '쉬어 간 심사위원은 표에 없다');
  const row = c => v.rows.find(r => r.crit === c);
  assert.deepEqual([row('신뢰성').weak, row('신뢰성').open, row('신뢰성').cells], [true, true, [{ mark: 'x', up: false }, { mark: 'x', up: false }]], '가장 약한 항목이 처음부터 펼쳐진다');
  assert.equal(row('팀 역량').split, true, '○와 ✕가 함께면 의견이 갈림');
  assert.equal(row('현실성').split, false, '△끼리는 갈리지 않는다');
  assert.equal(row('문제 인식').split, false);
  assert.equal(row('신뢰성').fixed, false);
  assert.deepEqual(row('신뢰성').more[0], { name: 'Opus', mark: 'x', why: '단골 수의 근거가 없습니다.', held: false, quote: '단골 손님 300명', where: '01 지금까지 한 일' });
  assert.equal(row('신뢰성').more[1].where, '', '인용이 없으면 묶음 이름도 없다');
  assert.deepEqual(row('신뢰성').rubric, [['o', '모든 숫자에 출처나 셈이 있다'], ['t', '근거가 일부에만 있다'], ['x', '숫자와 주장에 근거가 없다']], '채점 기준은 고른 표시 방식대로');
  assert.deepEqual(row('현실성').rubric, [], '채점표가 없는 항목은 비운다');
  assert.deepEqual(v.judges.map(j => [j.name, j.tally, j.rest]), [['Opus', [['o', 3], ['t', 2], ['x', 1]], false], ['Sol', [], true], ['Sonnet', [['o', 2], ['t', 2], ['x', 2]], false]]);
  assert.equal(v.judges[1].line, '이번 주 사용량을 다 써서 이번에는 쉬었습니다.');
  assert.deepEqual([satOut('LOGIN'), satOut('PROVIDER'), satOut('ANSWER')], ['로그인이 풀려 이번에는 쉬었습니다.', '답을 받지 못해 이번에는 쉬었습니다.', '답을 받지 못해 이번에는 쉬었습니다.']);
  assert.deepEqual(v.pick.options.map(o => [o.value, o.label, o.marks.join(''), o.on]), [[3, '세 단계', 'otx', true], [4, '네 단계', 'votx', false]]);
  assert.equal(v.title, '항목별 표시 · 항목을 누르면 심사위원의 한마디와 근거 문장');
  assert.equal(v.go, '고칠 곳 셋 보기');
  assert.match(v.fine, /^연습 심사입니다\. 실제 지원사업의 결과를 미리 알려 주지 않습니다\. 심사는 앉은 심사위원 수만큼 구독 사용량을 씁니다\.$/);
  assert.equal(bizplanScene(snap({ scores: scoresOf() }), null, { results: 5000, scoreRow: '팀 역량' }, { departments: depts }).score.rows.filter(r => r.open).map(r => r.crit).join(), '팀 역량');
  assert.equal(bizplanScene(snap({ scores: scoresOf() }), null, { results: 5000, scoreRow: null }, { departments: depts }).score.rows.some(r => r.open), false);
  // 네 단계: 강점인 ○는 ✓, 나머지 ○는 그대로. 손님 설정이나 방이 먼저 든 값(ui.marks)을 따른다
  const four = bizplanScene(snap({ list: list({ settings: { marks: 4 } }), scores: scoresOf() }), null, { results: 5000 }, { departments: depts }).score;
  assert.deepEqual([four.marks, four.tally], [4, [['v', 1], ['o', 4], ['t', 4], ['x', 3]]]);
  assert.deepEqual(four.rows.find(r => r.crit === '문제 인식').cells.map(c => c.mark), ['v', 't']);
  assert.deepEqual(four.rows.find(r => r.crit === '신뢰성').rubric.map(x => x[0]), ['v', 'o', 't', 'x']);
  assert.equal(four.lab, '두 심사위원의 표시 12개');
  assert.deepEqual(four.pick.options.map(o => o.on), [false, true]);
  assert.equal(bizplanScene(snap({ list: list({ settings: { marks: 4 } }), scores: scoresOf() }), null, { results: 5000, marks: 3 }, { departments: depts }).score.marks, 3);
  assert.equal(bizplanScene(snap({ list: list({ settings: { marks: 7 } }), scores: scoresOf() }), null, { results: 5000 }, { departments: depts }).score.marks, 3, '모르는 값은 세 단계');
  // 다시 심사: 시장성의 Opus ✕가 △로 나아졌다
  const re = bizplanScene(snap({ scores: scoresOf({ kind: 'score', prev: prevOf([3, 2, 1, 1, 3, 3], [2, 2, 1, 3, 3, 1]) }) }), null, { results: 5000 }, { departments: depts }).score;
  assert.deepEqual(re.head, ['✕가 4개에서 3개로 줄었습니다.', '가장 많이 나아진 것은 시장성입니다. 지금 가장 약한 것은 신뢰성입니다.']);
  assert.deepEqual([re.was, re.raised], ['고치기 전 ○ 5 · △ 3 · ✕ 4', true]);
  assert.deepEqual(re.rows.find(r => r.crit === '시장성').cells.map(c => c.up), [true, false]);
  assert.equal(re.rows.find(r => r.crit === '시장성').fixed, true);
  assert.equal(re.rows.find(r => r.crit === '팀 역량').fixed, false);
  // ○가 늘었다(✕는 그대로) · 그대로 · 나빠졌다
  assert.equal(bizplanScene(snap({ scores: scoresOf({ kind: 'score', prev: prevOf([3, 2, 1, 2, 2, 3], [2, 2, 1, 3, 3, 1]) }) }), null, { results: 5000 }, { departments: depts }).score.head[0], '○가 4개에서 5개로 늘었습니다.');
  const same = bizplanScene(snap({ scores: scoresOf({ kind: 'score', prev: prevOf([3, 2, 1, 2, 3, 3], [2, 2, 1, 3, 3, 1]) }) }), null, { results: 5000 }, { departments: depts }).score;
  assert.deepEqual([same.head[0], same.raised, same.was], ['표시가 그대로입니다.', false, '']);
  assert.equal(bizplanScene(snap({ scores: scoresOf({ kind: 'score', prev: prevOf([3, 2, 2, 2, 3, 3], [2, 2, 1, 3, 3, 1]) }) }), null, { results: 5000 }, { departments: depts }).score.head[0], '✕가 2개에서 3개로 늘었습니다.');
  // 네 단계에서는 「✓와 ○」로 센다
  assert.equal(bizplanScene(snap({ list: list({ settings: { marks: 4 } }), scores: scoresOf({ kind: 'score', prev: prevOf([3, 2, 1, 2, 2, 3], [2, 2, 1, 3, 3, 1]) }) }), null, { results: 5000 }, { departments: depts }).score.head[0], '✓와 ○가 4개에서 5개로 늘었습니다.');
  // 모두 쉬었으면 표 없이 까닭만
  const none = bizplanScene(snap({ scores: scoresOf({ status: 'failed', sum: null, judges: scoresOf().judges.map(j => ({ ...j, status: 'failed', reason: 'LOGIN', scores: null })) }) }), null, { results: 5000 }, { departments: depts }).score;
  assert.equal(none.head[0], '이번에는 심사하지 못했습니다.');
  assert.deepEqual([none.tally, none.lab, none.cols.length], [[], '', 0]);
  assert.equal(revealPlan(scoresOf({ sum: null, judges: [] }), read()), null, '점수가 없으면 무대도 없다');
  // 모두 ○면 가장 약한 항목이 없다
  const fine = scoresOf({ sum: { tally: { v: 0, o: 12, t: 0, x: 0 }, weakest: null }, judges: scoresOf().judges.map(j => (j.scores ? { ...j, scores: marks([3, 3, 3, 3, 3, 3]) } : j)) });
  const all = bizplanScene(snap({ scores: fine }), null, { results: 5000 }, { departments: depts }).score;
  assert.deepEqual([all.head[0], all.rows.some(r => r.open || r.weak)], ['모든 항목을 갖췄습니다.', false]);
});

test('점수 무대(14.3): 받은 혼잣말 셋까지, 묶음 차례로, 채점판 · 표시 수 순서이고 12초 안에 끝난다', () => {
  const s = scoresOf(), plan = revealPlan(s, read());
  assert.deepEqual(plan.beats.map(b => b.kind), ['sit', 'react', 'react', 'react', 'paddle', 'paddle', 'total', 'end']);
  assert.deepEqual(plan.beats.filter(b => b.kind === 'react').map(b => [b.judge, b.sec]), [['sonnet', 1], ['opus', 1], ['opus', 2]]);
  assert.ok(plan.beats.at(-1).at <= 12000, 'end ' + plan.beats.at(-1).at);
  const at = (step, ui = {}, sc = s, settings = {}) => bizplanScene(snap({ list: list({ settings }), scores: sc }), null, { reveal: { at: 5000, step }, ...ui }, { departments: depts });
  const first = at(1);
  assert.equal(first.stage, 'reveal');
  assert.deepEqual(first.show.judges[2].bubble, { kind: 'hmm', say: '몇 명이 다시 사나요?' });
  assert.deepEqual([first.show.sign.top, first.show.sign.title], ['01 / 02', '지금까지 한 일'], '말한 묶음의 이름이 이젤에 선다');
  assert.equal(first.show.judges[1].state, 'rest', '쉬어 간 심사위원');
  assert.equal(first.show.judges[0].status, '표시를 마쳤습니다');
  assert.equal(first.show.total, null);
  const pad = at(4);
  assert.deepEqual(pad.show.judges[0].paddle, { tally: [['o', 3], ['t', 2], ['x', 1]], name: 'Opus' });
  assert.equal(pad.show.judges[2].paddle, null);
  assert.equal(pad.show.judges[0].status, '○ 3 · △ 2 · ✕ 1');
  assert.deepEqual(pad.show.cap, [['심사위원이 채점판을 듭니다.', false]]);
  const end = at(6);
  assert.deepEqual(end.show.total, { tally: [['o', 5], ['t', 4], ['x', 3]], small: '두 심사위원의 표시', was: '' });
  assert.deepEqual(end.show.cap, [['심사가 끝났습니다. ✕가 나온 항목이 ', false], ['둘', true], ['이고, 가장 약한 곳은 신뢰성입니다.', false]], '✕ 표시 셋이 아니라 ✕가 나온 항목 둘(F3)');
  assert.equal(end.show.key, first.show.key);
  assert.equal(end.head[0], '심사위원 둘의 표시가 나왔습니다.', '쉬어 간 심사위원은 세지 않는다');
  // 네 단계
  const four = at(6, {}, s, { marks: 4 });
  assert.deepEqual([four.show.marks, four.show.total.tally], [4, [['v', 1], ['o', 4], ['t', 4], ['x', 3]]]);
  // 다시 심사: 줄어든 ✕와 고치기 전
  const again = at(6, {}, scoresOf({ kind: 'score', prev: prevOf([3, 2, 1, 1, 3, 3], [2, 2, 1, 3, 3, 1]) }));
  assert.deepEqual(again.show.cap, [['심사가 끝났습니다. ✕가 4개에서 ', false], ['3개', true], ['로 줄었습니다.', false]]);
  assert.deepEqual([again.show.total.was, again.show.presenter, again.head[0]], ['고치기 전 ○ 5 · △ 3 · ✕ 4', 'happy', '다시 심사한 표시가 나왔습니다.']);
  // 빠진 곳이 없으면
  const noX = scoresOf({ sum: { tally: { v: 0, o: 8, t: 4, x: 0 }, weakest: { crit: '현실성', sev: 2 } }, judges: scoresOf().judges.map(j => (j.scores ? { ...j, scores: marks([3, 2, 2, 3, 3, 3]) } : j)) });
  assert.deepEqual(at(6, {}, noX).show.cap, [['심사가 끝났습니다. ✕가 나온 항목은 없고, 가장 약한 곳은 ', false], ['현실성', true], ['입니다.', false]]);
});

test('고칠 곳(14.3): 점수 보기와, 고른 고침이 있고 계획서가 그대로일 때만 다시 심사받기', () => {
  const r = read();
  r.notes[0].choice = { kind: 'fix' };
  const withFix = bizplanScene(snap({ read: r, scores: scoresOf() }), null, { sel: '' }, { departments: depts });
  assert.equal(withFix.stage, 'notes');
  assert.deepEqual(withFix.scoreLink, { tally: '○ 5 · △ 4 · ✕ 3' });
  assert.equal(withFix.rescore, true);
  assert.equal(bizplanScene(snap({ read: r, scores: scoresOf(), planChanged: true }), null, {}, { departments: depts }).rescore, false, '계획서가 바뀌었으면 다시 읽어야 한다');
  assert.equal(bizplanScene(snap({ scores: scoresOf() }), null, {}, { departments: depts }).rescore, false, '고른 고침이 없으면 다시 심사하지 않는다');
  assert.equal(bizplanScene(snap(), null, {}, { departments: depts }).scoreLink, null);
  // 다시 심사를 멈추거나 못 해도 고칠 곳은 그대로다
  const stopped = bizplanScene(snap({ read: r, scores: scoresOf() }), { id: 't9', status: 'interrupted', featureKind: 'score', reason: 'CANCELLED', createdAt: 8000, updatedAt: 9000 }, {}, { departments: depts });
  assert.deepEqual([stopped.stage, stopped.notice], ['notes', '다시 심사를 멈췄습니다.']);
  assert.deepEqual(bizplanLine({ status: 'running', featureKind: 'score' }), { line: '고친 계획서로 다시 심사받고 있습니다', when: '심사 중' });
});

test('손님 설정(14.7): 다른 회사 심사위원도 부르기는 기본 끔이고, 켜면 개인정보 줄이 다른 회사로도 간다고 말한다', () => {
  assert.equal(bizplanScene(snap(), null, {}, { departments: depts }).others.on, false);
  const on = bizplanScene(snap({ list: list({ settings: { others: true } }) }), null, { provider: 'claude' }, { departments: depts });
  assert.equal(on.others.on, true);
  assert.equal(on.others.label, '다른 회사 심사위원도 부르기');
  assert.match(on.privacy, /심사에는 GPT를 만든 회사로도 계획서가 가고/);
  assert.match(privacyLine('codex', true), /심사에는 Claude를 만든 회사로도 계획서가 가고/);
  assert.doesNotMatch(privacyLine('claude') + privacyLine('codex'), /심사에는/);
  assert.doesNotMatch(privacyLine('claude', true) + privacyLine('codex', true), /Claude Code|Anthropic|OpenAI|SYNK/);
});

test('방(14.3): 새 점수는 무대를 한 번 틀고, 다시 그려도 처음부터 틀지 않으며, 건너뛰기 · 결과 열고 닫기 · 다시 심사 · 설정을 보낸다', async () => {
  const sent = [];
  let current = snap({ scores: scoresOf() });
  const api = { featureSnapshot: async () => current, featureAction: async (f, d, action, args) => { sent.push([action, args]); return { ok: true }; } };
  const timers = new Map();
  let id = 0;
  const seen = new Map();
  const make = (o = {}) => createBizplanRoom({ api, changed: () => {}, setTimer: (fn, ms) => { timers.set(++id, [fn, ms]); return id; }, clearTimer: k => timers.delete(k), seen, ...o });
  const fire = () => { const [k, [fn]] = [...timers.entries()].at(-1); timers.delete(k); fn(); };
  const room = make();
  room.open('plan01');
  await new Promise(r => setTimeout(r, 0));
  const done = { id: 't9', status: 'completed', featureKind: 'read', provider: 'codex', answer: '', updatedAt: 6000, createdAt: 1 };
  assert.equal(room.scene(done, { departments: depts }).stage, 'reveal');
  assert.equal(timers.size, 1);
  room.scene(done, { departments: depts });
  assert.deepEqual([room.state().reveal.step, timers.size], [0, 1], '다시 그려도 처음부터 틀지 않는다');
  fire();
  assert.equal(room.state().reveal.step, 1);
  assert.ok(room.scene(done, { departments: depts }).show.judges.some(j => j.bubble));
  await room.handle({ act: 'biz-score-skip' });
  assert.deepEqual([room.state().reveal, room.state().results, timers.size, seen.get('plan01')], [null, 5000, 0, 5000]);
  assert.equal(room.scene(done, { departments: depts }).stage, 'score');
  await room.handle({ act: 'biz-score-row', arg: '팀 역량' });
  assert.equal(room.scene(done, { departments: depts }).score.rows.find(r => r.open).crit, '팀 역량');
  await room.handle({ act: 'biz-score-row', arg: '팀 역량' });
  assert.equal(room.scene(done, { departments: depts }).score.rows.some(r => r.open), false);
  await room.handle({ act: 'biz-score-close' });
  assert.equal(room.scene(done, { departments: depts }).stage, 'notes', '「고칠 곳 n 보기」');
  assert.equal(room.scene(done, { departments: depts }).stage, 'notes', '본 점수는 다시 틀지 않는다');
  await room.handle({ act: 'biz-score-open' });
  assert.equal(room.scene(done, { departments: depts }).stage, 'score', '「점수 보기」');
  // 무대를 끝까지 보면 결과가 열린다
  current = snap({ scores: scoresOf({ at: 7000 }) });
  await room.handle({ act: 'biz-score-close' });
  await room.handle({ act: 'biz-rescore' });
  assert.deepEqual(sent.at(-1), ['rescore', { provider: 'codex' }]);
  assert.equal(room.scene(done, { departments: depts }).stage, 'reveal');
  while (room.state().reveal) fire();
  assert.equal(room.scene(done, { departments: depts }).stage, 'score');
  assert.equal(seen.get('plan01'), 7000);
  // 설정
  await room.handle({ act: 'biz-menu', arg: 'staff' });
  await room.handle({ act: 'biz-others' });
  assert.deepEqual(sent.at(-1), ['setting', { name: 'others', value: true }]);
  assert.equal(room.state().menu, 'staff', '설정을 바꿔도 메뉴는 열어 둔다');
  room.close();
  // 다시 열어도 본 점수는 다시 틀지 않는다. 읽는 동안은 틀지 않는다. 움직임을 줄였으면 바로 결과
  const again = make();
  again.open('plan01');
  await new Promise(r => setTimeout(r, 0));
  assert.equal(again.scene(done, { departments: depts }).stage, 'notes');
  current = snap({ scores: scoresOf({ at: 9000 }) });
  const busy = make();
  busy.open('plan01');
  await new Promise(r => setTimeout(r, 0));
  assert.equal(busy.scene({ ...done, status: 'running' }, { departments: depts }).stage, 'reading');
  assert.equal(busy.state().reveal, null);
  const calm = make({ reducedMotion: () => true });
  calm.open('plan01');
  await new Promise(r => setTimeout(r, 0));
  assert.equal(calm.scene(done, { departments: depts }).stage, 'score');
  assert.equal(calm.state().reveal, null);
});

test('카본 화면 검수 A1 · A2 · A5 · A7, 설계 검토 D5 · D7 · D8: 끝난 첫 판은 새 기록을 읽을 때까지 무대를 두고, 점수 보기로 본 점수는 다시 틀지 않는다', async () => {
  const tick = () => new Promise(r => setTimeout(r, 0));
  // A2: 업무가 끝난 첫 판은 끝난 뒤의 기록을 읽을 때까지 심사 무대를 둔다(4초까지)
  let current = snap({ progress: prog('심사 · Opus') }), clock = 1000, gate = null;
  const api = { featureSnapshot: async () => { if (gate) await gate; return current; }, featureAction: async (f, d, action) => (action === 'rescore' ? { ok: false, code: 'PANEL_CLAUDE' } : { ok: true }) };
  const room = createBizplanRoom({ api, changed: () => {}, now: () => clock, setTimer: () => 0, clearTimer: () => {}, seen: new Map(), reducedMotion: () => true });
  room.open('plan01'); await tick();
  assert.equal(room.scene(runTask(), { departments: depts }).stage, 'judging');
  let open; gate = new Promise(r => { open = r; });
  current = snap({ scores: scoresOf({ at: 2100 }) });
  clock = 2500;
  const done = runTask({ status: 'completed', updatedAt: 2000, answer: '' });
  assert.equal(room.scene(done, { departments: depts }).stage, 'judging', '옛 기록으로 다른 화면을 세우지 않는다');
  clock = 3000; gate = null; open(); await tick(); await tick();
  assert.equal(room.scene(done, { departments: depts }).stage, 'score', '새 기록을 읽은 뒤에는 결과');
  // D5: 심사단의 회사가 아닌 직원으로 다시 심사하면 알린다
  await room.handle({ act: 'biz-rescore' });
  assert.equal(room.state().live, '처음 심사한 심사위원은 Claude 직원으로 다시 심사합니다. 직원을 Claude로 바꿔 주세요.');
  // A1: 창이 가려져 무대를 건너뛴 점수를 「점수 보기」로 보고 닫으면 다시 틀지 않는다
  const seen = new Map();
  let hidden = true;
  const r2 = createBizplanRoom({ api: { featureSnapshot: async () => snap({ scores: scoresOf({ at: 8000 }) }) }, changed: () => {}, hidden: () => hidden, setTimer: () => 0, clearTimer: () => {}, seen });
  r2.open('plan01'); await tick();
  const fin = runTask({ status: 'completed', updatedAt: 1, answer: '' });
  assert.equal(r2.scene(fin, { departments: depts }).stage, 'notes');
  hidden = false;
  await r2.handle({ act: 'biz-score-open' });
  assert.equal(seen.get('plan01'), 8000);
  await r2.handle({ act: 'biz-score-close' });
  assert.equal(r2.scene(fin, { departments: depts }).stage, 'notes', '본 점수의 무대를 다시 틀지 않는다');
  // A5: 본체가 가장 약한 항목이 없다고 하면 펼친 줄 없이 열고, 누르면 펴고 다시 누르면 접힌다
  const r3 = createBizplanRoom({ api: { featureSnapshot: async () => snap({ scores: scoresOf({ at: 8000, sum: { tally: { v: 0, o: 12, t: 0, x: 0 }, weakest: null } }) }) }, changed: () => {}, setTimer: () => 0, clearTimer: () => {}, seen: new Map([['plan01', 8000]]) });
  r3.open('plan01'); await tick();
  await r3.handle({ act: 'biz-score-open' });
  assert.equal(r3.scene(fin, { departments: depts }).score.rows.some(r => r.open), false);
  await r3.handle({ act: 'biz-score-row', arg: '신뢰성' });
  assert.equal(r3.scene(fin, { departments: depts }).score.rows.find(r => r.open)?.crit, '신뢰성');
  await r3.handle({ act: 'biz-score-row', arg: '신뢰성' });
  assert.equal(r3.scene(fin, { departments: depts }).score.rows.some(r => r.open), false);
  // A7: 항목 점수가 없어도 자막에 null을 쓰지 않는다
  const bare = scoresOf({ criteria: [], sum: { tally: { v: 0, o: 0, t: 0, x: 0 }, weakest: null } });
  const end = bizplanScene(snap({ scores: bare }), null, { reveal: { at: 5000, step: 99 } }, { departments: depts });
  assert.doesNotMatch(end.show.cap.map(x => x[0]).join(''), /null/);
  // D7: 부르지 않은 자리, D8: 켜는 글의 범위, 다시 심사 무대는 첫 심사단만
  assert.equal(satOut('OFF'), '다른 회사 심사위원 부르기가 꺼져 있어 이번에는 쉬었습니다.');
  assert.match(bizplanScene(snap(), null, { provider: 'claude' }, { departments: depts }).others.small, /켜 두는 동안 이 부서에서 심사하는 계획서는 모두 GPT를 만든 회사로도 갑니다/);
  const judging = bizplanScene(snap({ scores: scoresOf({ judges: scoresOf().judges.filter(j => j.id !== 'sol') }), progress: prog('심사 · Opus') }), runTask({ featureKind: 'score', others: true }), {}, { departments: depts });
  assert.deepEqual(judging.show.judges.filter(j => j.seated).map(j => j.id), ['opus', 'sonnet']);
});

test('표시 방식(14.3): 결과 화면 표 위에서 세 단계 · 네 단계를 고르면 먼저 바꿔 보이고 손님 설정으로 남긴다. 남기지 못하면 되돌린다', async () => {
  const tick = () => new Promise(r => setTimeout(r, 0));
  let settings = { others: false, marks: 3 }, okSave = true;
  const sent = [];
  const api = {
    featureSnapshot: async () => snap({ list: list({ settings }), scores: scoresOf() }),
    featureAction: async (f, d, action, args) => { sent.push([action, args]); if (!okSave) return { ok: false, code: 'VALUE' }; settings = { ...settings, [args.name]: args.value }; return { ok: true }; },
  };
  const room = createBizplanRoom({ api, changed: () => {}, setTimer: () => 0, clearTimer: () => {}, seen: new Map([['plan01', 5000]]), reducedMotion: () => true });
  room.open('plan01'); await tick();
  const fin = runTask({ status: 'completed', updatedAt: 1, answer: '' });
  await room.handle({ act: 'biz-score-open' });
  assert.equal(room.scene(fin, { departments: depts }).score.marks, 3);
  const pending = room.handle({ act: 'biz-marks', arg: '4' });
  assert.equal(room.scene(fin, { departments: depts }).score.marks, 4, '누르자마자 바꿔 보인다');
  await pending;
  assert.deepEqual(sent.at(-1), ['setting', { name: 'marks', value: 4 }]);
  const v = room.scene(fin, { departments: depts }).score;
  assert.deepEqual([v.marks, v.tally.map(x => x[0])], [4, ['v', 'o', 't', 'x']]);
  assert.equal(room.state().marks, undefined, '남긴 뒤에는 손님 설정을 따른다');
  const n = sent.length;
  await room.handle({ act: 'biz-marks', arg: '4' });
  assert.equal(sent.length, n, '고른 칸을 다시 누르면 보내지 않는다');
  okSave = false;
  await room.handle({ act: 'biz-marks', arg: '3' });
  assert.equal(room.scene(fin, { departments: depts }).score.marks, 4, '남기지 못하면 손님 설정대로 되돌린다');
});

test('Opus 대체 화면 검수 P1: 심사 중에 멈추거나 못 해도 이 업무가 쓴 읽은 기록의 고칠 곳은 보이고, 사무실 줄은 다시 읽으라고 하지 않는다', () => {
  const own = read({ id: '20261127T000000Z-t9', at: 1000 });
  const stopped = bizplanScene(snap({ read: own }), runTask({ status: 'interrupted', reason: 'CANCELLED', updatedAt: 200000 }), {}, { departments: depts });
  assert.equal(stopped.stage, 'notes');
  assert.ok(stopped.notes.length > 0);
  assert.equal(stopped.notice, '심사를 멈췄습니다. 찾은 고칠 곳은 그대로 봅니다.');
  const failed = bizplanScene(snap({ read: own }), runTask({ status: 'failed', reason: 'LIMIT', updatedAt: 200000 }), {}, { departments: depts });
  assert.equal(failed.stage, 'notes');
  assert.equal(failed.notice, '심사는 하지 못했습니다. 찾은 고칠 곳은 그대로 봅니다.');
  // 앞 읽기의 기록이면 이 업무는 읽기 전에 멈춘 것이다
  const other = bizplanScene(snap({ read: read({ id: '20261126T000000Z-t1', at: 1000 }) }), runTask({ status: 'interrupted', updatedAt: 200000 }), {}, { departments: depts });
  assert.equal(other.stage, 'stopped');
  assert.deepEqual(bizplanLine(runTask({ status: 'interrupted' })), { line: '읽기를 멈췄습니다', when: '열어 보기' });
});
