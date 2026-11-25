// PATH 서류 점검 시험. 이름 · 학교 · 번호는 모두 지어낸 값이다(실제 학생 자료를 넣지 않는다).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOC_CHECKS, docCheckItems, docCheckKind, sentences, selfChecks, validateDocCheckRequest, checkDocCheckOutput, validateDocCheckReply, docCheckRows, MAX_FOUND_LINES, DOC_CHECK_STATUSES } from './doc-check.mjs';
import { renderDocCheck, dcCanSend, dcMarkKey, DC_ERROR_TEXT, itemMn } from './doc-check-ui.mjs';
import { PROGRAM_DOCS, VISA_DOCS, docsFor } from './docs-data.mjs';
import { programById, PROGRAMS } from './study-data.mjs';

const RID = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b';
const consent = { v: 1, age: 'adult', guardian: false, lang: 'ko' };
const LINES = ['ДҮНГИЙН ХУУДАС', '10 дугаар анги: Математик 85', '11 дүгээр анги: Математик 90', 'Улаанбаатар хотын 99 дүгээр сургууль'];
const body = (extra = {}) => ({ action: 'doc_check', request_id: RID, doc: 'jbnu-ug-transcript', lines: LINES, consent, ...extra });
const good = [{ key: 'title', lines: [0] }, { key: 'g10', lines: [1] }, { key: 'g11', lines: [2] }, { key: 'g12', lines: [] }, { key: 'school', lines: [3] }, { key: 'issuer', lines: [] }];

test('여는 서류: 대학에 내는 졸업 · 성적증명서뿐이고, 비자 서류와 다른 서류는 열지 않는다', () => {
  const program = new Set(Object.values(PROGRAM_DOCS).flatMap((s) => s.docs.map((d) => d.id)));
  for (const id of Object.keys(DOC_CHECKS)) {
    assert.ok(program.has(id), `${id}는 대학 서류 줄에 있다`);
    assert.match(id, /-(grad|transcript)$/);
    assert.equal(docCheckKind(id), id.endsWith('transcript') ? 'transcript' : 'grad');
    const keys = docCheckItems(id).map((it) => it.key);
    assert.equal(new Set(keys).size, keys.length, `${id}의 칸 열쇠는 겹치지 않는다`);
    for (const it of docCheckItems(id)) { assert.ok(it.label.ko && it.label.en && it.ask); assert.ok(itemMn(id, it.key), `${id} ${it.key}의 몽골어 이름`); }
  }
  for (const s of Object.values(VISA_DOCS)) for (const d of s.docs) assert.equal(docCheckItems(d.id), null, d.id);
  assert.equal(docCheckItems('jbnu-ug-bank'), null, '은행 서류의 글은 받지 않는다');
  assert.equal(docCheckItems('toString'), null);
});

test('점검 줄: 요강 글을 문장으로만 나누고 글자는 바꾸지 않는다. 두 가지로 읽히는 곳은 넣지 않는다', () => {
  assert.deepEqual(sentences('원본이에요. 30일 안에 발급해요.  1,600만 원 이상이에요'), ['원본이에요.', '30일 안에 발급해요.', '1,600만 원 이상이에요']);
  assert.deepEqual(sentences(null), []);
  for (const set of Object.values(PROGRAM_DOCS)) {
    for (const d of set.docs) {
      for (const pick of [(o) => o.ko, (o) => o.en]) {
        const { own, rules } = selfChecks(d, set.rules, pick);
        const source = [d.when, d.note].filter(Boolean).map(pick).join(' ');
        assert.equal(own.join(' '), source.split(/\s+/).join(' '), `${d.id}: 문장을 이으면 요강 글과 같다`);
        assert.equal(rules.join(' '), (set.rules || []).map(pick).join(' ').split(/\s+/).join(' '));
        if (d.unclear) for (const line of [...own, ...rules]) assert.ok(!sentences(pick(d.unclear)).includes(line), `${d.id}: 갈리는 글은 점검 줄이 아니다`);
      }
    }
  }
});

test('요청 몸: 정한 열쇠만, 정한 서류만, 나이와 보호자 확인이 맞아야 한다', () => {
  assert.deepEqual(validateDocCheckRequest(body()), body());
  assert.equal(validateDocCheckRequest(body({ request_id: RID.toUpperCase() })).request_id, RID);
  const bad = [
    body({ doc: 'visa-d2-school' }), body({ doc: 'jbnu-ug-bank' }), body({ doc: '__proto__' }), body({ action: 'translate' }), body({ request_id: 'x' }),
    body({ lines: [] }), body({ lines: ['짧음'] }), body({ lines: Array(81).fill('줄 하나에 글이 있어요') }), body({ lines: ['가'.repeat(301)] }), body({ lines: ['탭\t있는 줄이라 받지 않아요 스무 글자 넘게 적어요'] }),
    body({ consent: { ...consent, age: 'under14' } }), body({ consent: { ...consent, age: 'teen' } }), body({ consent: { ...consent, guardian: true } }), body({ consent: { ...consent, v: 2 } }), body({ consent: { ...consent, extra: 1 } }),
    { ...body(), extra: 1 }, null, []
  ];
  for (const b of bad) assert.throws(() => validateDocCheckRequest(b), { code: 'INVALID_DOC_CHECK_REQUEST' });
  assert.equal(validateDocCheckRequest(body({ consent: { ...consent, age: 'teen', guardian: true } })).consent.age, 'teen');
  assert.ok(validateDocCheckRequest(body({ lines: ['Graduation certificate of a made-up school'] })), '영어 글도 받는다');
});

test('모델 출력: 칸의 차례와 열쇠가 같고 줄 번호가 글 안에 있어야 한다. 한 칸은 다섯 줄까지 보인다', () => {
  assert.deepEqual(checkDocCheckOutput({ items: good }, 'jbnu-ug-transcript', 4), good);
  const many = good.map((e) => (e.key === 'g10' ? { key: 'g10', lines: [9, 3, 3, 1, 2, 0, 5, 7] } : e));
  assert.deepEqual(checkDocCheckOutput({ items: many }, 'jbnu-ug-transcript', 10)[1].lines, [0, 1, 2, 3, 5]);
  assert.equal(MAX_FOUND_LINES, 5);
  const replace = (i, v) => good.map((e, k) => (k === i ? v : e));
  for (const items of [good.slice(1), [...good].reverse(), replace(0, { key: 'title', lines: [4] }), replace(0, { key: 'title', lines: [-1] }), replace(0, { key: 'title', lines: ['0'] }), replace(0, { key: 'title', lines: [0.5] }), replace(0, { key: 'title', lines: 0 }), replace(0, { key: 'title', lines: [0], ok: true }), replace(0, null)]) {
    assert.equal(checkDocCheckOutput({ items }, 'jbnu-ug-transcript', 4), null);
  }
  assert.equal(checkDocCheckOutput({ items: good, verdict: 'pass' }, 'jbnu-ug-transcript', 4), null);
  assert.equal(checkDocCheckOutput({ items: good }, 'jbnu-ug-bank', 4), null);
});

test('답: done이 아니면 칸이 비어 있어야 하고, 화면 줄은 학생이 붙여 넣은 글 그대로다', () => {
  const reply = { ok: true, scope: 'synk-path', action: 'doc_check', prompt: 'path-doc-check-v1', status: 'done', remaining: 9, items: good };
  const r = validateDocCheckReply(reply, 'jbnu-ug-transcript', 4);
  const rows = docCheckRows('jbnu-ug-transcript', r.items, LINES);
  assert.deepEqual(rows.map((x) => x.lines), [[LINES[0]], [LINES[1]], [LINES[2]], [], [LINES[3]], []]);
  for (const status of DOC_CHECK_STATUSES.filter((s) => s !== 'done')) {
    assert.deepEqual(validateDocCheckReply({ ...reply, status, remaining: null, items: [] }, 'jbnu-ug-transcript', 4).items, []);
    assert.throws(() => validateDocCheckReply({ ...reply, status }, 'jbnu-ug-transcript', 4), { code: 'INVALID_DOC_CHECK_REPLY' });
  }
  for (const b of [{ ...reply, ok: false }, { ...reply, scope: 'x' }, { ...reply, action: 'translate' }, { ...reply, status: 'pass' }, { ...reply, remaining: -1 }, { ...reply, items: good.slice(1) }, { ...reply, prompt: 1 }, null]) {
    assert.throws(() => validateDocCheckReply(b, 'jbnu-ug-transcript', 4), { code: 'INVALID_DOC_CHECK_REPLY' });
  }
});

/* ── 화면 ── */
const real = PROGRAMS.filter((p) => !p.example);
function view(docId, extra = {}) {
  const programId = Object.keys(PROGRAM_DOCS).find((k) => PROGRAM_DOCS[k].docs.some((d) => d.id === docId));
  const program = programById(real, programId);
  const set = docsFor(program, {});
  return { lang: 'ko', signedIn: true, now: new Date('2026-11-26T00:00:00Z'), doc: set.all.find((d) => d.id === docId), src: set.program, programName: program.name, dc: { text: '', age: null, guardian: false, agree: false, phase: 'edit', marks: new Set() }, ...extra };
}
const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('화면: 요강 출처 · 확인일 · 기준 학기 · 대학 확인이 아니라는 말을 두 언어에 늘 보인다', () => {
  for (const [programId, set] of Object.entries(PROGRAM_DOCS)) {
    for (const d of set.docs) {
      for (const lang of ['ko', 'en']) {
        const html = renderDocCheck(view(d.id, { lang }));
        const text = plain(html);
        assert.match(text, lang === 'ko' ? /대학이나 비자신청센터\(KVAC\)의 확인이 아니에요\. 마지막 판단은 대학이 해요/ : /not a check by the university or the visa center/);
        assert.ok(html.includes(set.source.url.replace(/&/g, '&amp;')) && text.includes(set.checkedAt), `${programId} ${d.id} 출처`);
        if (set.term) assert.ok(text.includes(set.term[lang]));
        if (set.status) assert.ok(text.includes(set.status[lang]), `${d.id}: 바뀔 수 있다는 표시`);
        if (d.unclear) assert.ok(plain(html).includes(lang === 'ko' ? '대학에 먼저 물어보세요' : 'Ask the university first'));
        assert.equal(html.includes('data-action="dcSend"'), !!docCheckItems(d.id), `${d.id}: 글을 받는 서류만 보내기 단추가 있다`);
        assert.doesNotMatch(text, /통과했|합격했|합격이에요|충족했|you pass(ed)?\b|you meet/i);
        assert.ok(!/ style=| on[a-z]+=/.test(html));
      }
    }
  }
});

test('화면: 갈리는 글은 누를 수 없고, 누르는 줄은 요강 문장 수와 같다', () => {
  const v = view('wku-ug-grad');
  const html = renderDocCheck(v);
  const { own, rules } = selfChecks(v.doc, v.src.rules, (o) => o.ko);
  assert.equal((html.match(/data-action="dcMark"/g) || []).length, own.length + rules.length);
  const marked = renderDocCheck({ ...v, dc: { ...v.dc, marks: new Set([dcMarkKey('ko', 1)]) } });
  assert.doesNotMatch(renderDocCheck({ ...v, lang: 'en', dc: { ...v.dc, marks: new Set([dcMarkKey('ko', 1)]) } }), /type="checkbox"[^>]* checked/, '한국어 줄의 표시를 영어의 다른 줄로 옮기지 않는다');
  assert.match(marked, /id="dc-m-1" data-action="dcMark" data-value="1" checked/);
  assert.doesNotMatch(marked, /id="dc-m-0"[^>]* checked/);
});

test('화면: 손님은 로그인 안내만, 만 14세 미만은 보내지 못한다', () => {
  const guest = renderDocCheck(view('wku-ug-grad', { signedIn: false }));
  assert.match(plain(guest), /SYNK ID로 로그인하면 글에서 찾기를 쓸 수 있어요/);
  assert.ok(!guest.includes('id="dc-text"'));
  const base = { text: '글', age: 'adult', guardian: false, agree: true, phase: 'edit' };
  assert.equal(dcCanSend(base), true);
  for (const patch of [{ age: null }, { age: 'under14' }, { age: 'teen' }, { agree: false }, { text: '  ' }, { phase: 'sending' }]) assert.equal(dcCanSend({ ...base, ...patch }), false, JSON.stringify(patch));
  assert.equal(dcCanSend({ ...base, age: 'teen', guardian: true }), true);
  const under = renderDocCheck(view('wku-ug-grad', { dc: { ...base, age: 'under14', marks: new Set() } }));
  assert.match(plain(under), /만 14세 미만은 이 기능을 쓸 수 없어요/);
  assert.ok(!under.includes('id="dc-agree"'));
});

test('화면: 동의 문장에 보내는 것 · 받는 곳 · 저장 · 거부가 있고 Google은 없다', () => {
  const text = plain(renderDocCheck(view('jj-ug-transcript')));
  for (const re of [/등록번호는 보내기 전에 가려요/, /Anthropic\(미국\)의 Claude/, /Supabase, 싱가포르/, /저장하지 않아요/, /AI 학습에는 쓰지 않아요/, /보내지 않아도 돼요/, /몽골 밖으로/]) assert.match(text, re);
  assert.doesNotMatch(text, /Google|Gemini/);
});

test('화면: 찾은 줄과 못 찾은 칸을 나눠 보이고, 붙여 넣은 글은 글자로만 보인다', () => {
  const rows = docCheckRows('wku-ug-grad', [{ key: 'title', lines: [0] }, { key: 'done', lines: [] }, { key: 'school', lines: [1] }, { key: 'issuer', lines: [] }], ['<img src=x onerror=alert(1)>', '지어낸 학교']);
  const html = renderDocCheck(view('wku-ug-grad', { dc: { text: 'x', phase: 'done', rows, remaining: 7, marks: new Set() } }));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;') && !html.includes('<img src=x'));
  assert.equal((html.match(/글에 이 내용이 보여요/g) || []).length, 2);
  assert.equal((html.match(/서류에 없다는 뜻이 아니에요/g) || []).length, 2);
  assert.match(plain(html), /오늘 7번 더 찾을 수 있어요/);
  assert.equal((html.match(/마지막 판단은 대학이 해요/g) || []).length, 2, '결과 위에도 다시 적는다');
  assert.ok(!html.includes('id="dc-text"'), '결과를 보일 때는 붙여 넣기 칸을 접는다');
  for (const t of Object.values(DC_ERROR_TEXT)) assert.equal(t.length, 3);
});
