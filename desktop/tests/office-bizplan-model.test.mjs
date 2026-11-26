import test from 'node:test';
import assert from 'node:assert/strict';
import { bizplanScene, bizplanLine, reasonText, privacyLine, countWord, iga, attachesBizplan, nextWrite } from '../renderer/office-bizplan-model.mjs';
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
