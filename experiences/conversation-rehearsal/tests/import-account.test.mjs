import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createImportController } from '../storage.mjs';
import { createSession, appendTurn, archive, keepSessions, setPlan, setRealDate, MAX_SESSIONS } from '../domain.mjs';

// 실제 app.mjs의 저장·한 장 기록·화면 이동·계정 연결·가져오기 처리 코드를 그대로 잘라 vm에서 돌린다.
const source = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
function between(start, end) {
  const from = typeof start === 'string' ? source.indexOf(start) : source.search(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `app.mjs에서 ${start} ~ ${end} 구간을 찾지 못했어요.`);
  return source.slice(from, to);
}
const saveSource = between('function save()', 'function error(');
const captureSource = between('function captureTakeaway()', 'function setSaving(');
const accountSource = between(/notebook\s*=\s*createAccountNotebook\(/, 'void notebook.start();');
const changeSource = between("app.addEventListener('change', async", "document.addEventListener('click', async");
const clickSource = between("document.addEventListener('click', async", 'function paintTheme()');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function session() { let value = createSession({ scenario: 'refusal', counterpart: '합성 상대 A', goal: '합성 목표 A', id: 'synthetic-a' }); for (let i = 0; i < 3; i++) value = appendTurn(value, { answer: '계정 A가 적은 대답', review: 'stuck', focus: 'pressure' }); return value; }
// 새 화면에서 가져갈 한 장(#takeaway)은 결과 화면에만, 기록 파일 고르기(#import)와 합치기 단추는 기록 탭에만 있다.
function fixture({ page = 'records' } = {}) {
  const saved = [], notices = [], gate = deferred();
  const fileInput = () => ({ id: 'import', dataset: {}, isConnected: true, value: 'selected', files: [{ size: 200, text: () => gate.promise }] });
  let input = fileInput(), change, click;
  const current = session(), form = { elements: { firstSentence: { value: '계정 A의 첫 문장' }, takeaway: { value: '계정 A의 기억' }, ifThey: { value: '' }, iWill: { value: '' }, realAt: { value: '' } } };
  const c = {
    accountId: 'A', page, stage: 'answer', feedback: null, homeDraft: null, bookReturn: 'home', current, sessions: [current], saving: false, guestSaving: false, imports: createImportController(), imported: null,
    archive, keepSessions, setPlan, setRealDate, MAX_SESSIONS, toast: text => notices.push(text), error: text => notices.push(text), resetVoice() {}, paintAccount() {},
    document: { querySelector: () => null, addEventListener: (_name, callback) => { click = callback; } },
    app: { addEventListener: (_name, callback) => { change = callback; }, querySelector: selector => selector === '#takeaway' && c.page === 'results' ? form : null },
    createAccountNotebook: options => ({ options, active: true, canEdit: true, change: value => { saved.push({ owner: c.accountId, value: structuredClone(value) }); } }),
    // 다시 그리면 이전 가져오기가 무효가 되고, 화면의 파일 입력도 새것으로 바뀐다.
    render() { c.imports.invalidate(); input.isConnected = false; input = fileInput(); },
  };
  vm.createContext(c); vm.runInContext(saveSource + captureSource + accountSource + changeSource + clickSource, c);
  const tap = closest => click({ target: { closest }, preventDefault() {} });
  return {
    c, saved, notices, gate, get input() { return input; },
    read() { const target = input; return change({ target }).then(() => target); },
    // 결과 화면에서 기록 탭으로: 실제 사용자가 가져오기 단추에 닿는 길이다.
    openRecords: () => tap(selector => selector === '[data-nav]' ? { dataset: { nav: 'records' } } : null),
    confirmImport: () => tap(selector => selector === '[data-nav]' ? null : { tagName: 'BUTTON', dataset: { action: 'import-confirm' } }),
    switchOwner() { c.accountId = 'B'; c.notebook.options.onMode(true, { wasActive: true }); c.notebook.canEdit = false; },
  };
}

for (const reject of [false, true]) test(`old import ${reject ? 'failure' : 'completion'} after account switch cannot save account A into loading account B`, async () => {
  const f = fixture(), pending = f.read(); f.switchOwner();
  // Account B is still loading. A's old file input is still connected but inert.
  if (reject) f.gate.reject(new Error('old file read failure')); else f.gate.resolve(JSON.stringify(archive([])));
  await pending;
  assert.deepEqual(f.saved, []); assert.equal(f.c.imported, null); assert.deepEqual(f.notices, []);
  assert.equal(f.c.current.firstSentence, '');
});

test('a file finishing while the same account is being reverified cannot capture or save the old form', async () => {
  const f = fixture(), pending = f.read(); f.c.notebook.canEdit = false;
  f.gate.resolve(JSON.stringify(archive([]))); const input = await pending;
  assert.deepEqual(f.saved, []); assert.equal(f.c.imported, null); assert.equal(input.value, '');
  assert.equal(f.notices.length, 1); assert.match(f.notices[0], /계정|로그인/);
});

test('normal verified-account import still captures the current takeaway and offers the imported records', async () => {
  const f = fixture({ page: 'results' });
  await f.openRecords(); assert.equal(f.c.page, 'records');
  const pending = f.read(); f.gate.resolve(JSON.stringify(archive([]))); await pending;
  assert.equal(f.saved.length, 1); assert.equal(f.saved[0].owner, 'A');
  assert.equal(f.saved[0].value.sessions[0].firstSentence, '계정 A의 첫 문장');
  assert.equal(f.c.imported.sessions.length, 0);
});

test('a staged import does not merge or capture inputs until account editing is allowed again', async () => {
  const f = fixture({ page: 'results' });
  await f.openRecords(); const before = structuredClone(f.saved), current = structuredClone(f.c.current);
  f.c.imported = archive([]); f.c.notebook.canEdit = false;
  await f.confirmImport();
  assert.deepEqual(f.saved, before); assert.deepEqual(structuredClone(f.c.current), current); assert.equal(f.c.imported.sessions.length, 0);
  assert.match(f.notices.at(-1), /계정/);
  f.c.notebook.canEdit = true; await f.confirmImport();
  assert.equal(f.c.imported, null); assert.equal(f.saved.length, 2); assert.equal(f.saved[1].owner, 'A');
  assert.equal(f.saved[1].value.sessions[0].firstSentence, '계정 A의 첫 문장');
});
