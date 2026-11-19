'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openTrial, runTrial, compareSlot, extractReports, save } = require('../tools/lib/contest-pilot.cjs');
const { settleDisputes } = require('../tools/lib/contest-carbon.cjs');
const { 지도동기화 } = require('../tools/공모지도동기화.cjs');

const morning = '2026-11-19_0830', afternoon = '2026-11-19_1430';
const at = '2026-11-19T09:05:00+09:00';
const notice = { title: '가상 영상 공모전', organizer: '예시 기관', noticeId: 'one', officialUrl: 'https://example.com/contest/one',
  ai: { status: 'conditional', quote: '제작 때 AI 표시가 필수입니다.' },
  deadline: { date: '2026-12-01', kst: '2026-12-01T18:00+09:00' },
  deliverables: { items: ['MP4', '동의서'] } };
const grok = (items, slot = morning) => ({ schema: 'synk-grok-contests-v1', reportId: slot, reports: ['주최사 공고 목록'], items });
const gemini = (items, slot = morning) => ({ schema: 'synk-contest-pilot-v1', source: 'gemini', slot,
  checkedAt: slot === morning ? at : '2026-11-19T14:50:00+09:00', reports: ['주최사 공고 목록'], unavailable: [], items });

function fixture(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'contest-pilot-test-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const dir = path.join(folder, 'Gemini공모전비교');
  save(path.join(dir, '연결.json'), { startDate: '2026-11-19', profileId: 'Default', account: 'tester@example.com',
    threadUrl: 'https://gemini.google.com/app/abcdef12' });
  return { folder, trial: openTrial(folder), report: () => JSON.parse(fs.readFileSync(path.join(dir, '비교현황.json'), 'utf8')) };
}

test('공고가 같은 회차에서만 짝을 이루며 접근 실패, 미도착, 정상 0건을 구분한다', async t => {
  const { trial, report } = fixture(t);
  let calls = 0;
  const settle = () => { calls++; };
  const before = await runTrial(trial, { now: new Date('2026-11-19T08:29:59+09:00'), receive: () => assert.fail(), settle });
  assert.equal(before.due, 0);
  assert.equal(report().rounds[0].status, 'scheduled');
  const first = await runTrial(trial, { now: new Date(at), rawGrok: [grok([])], receive: () => [], settle });
  assert.equal(first.paired, 0);
  assert.equal(report().rounds[0].gemini.status, 'pending');
  await runTrial(trial, { now: new Date(at), receive: () => [{ ...gemini([]), reports: [], unavailable: ['연결 실패'] }], settle });
  assert.equal(report().rounds[0].gemini.status, 'unavailable');
  await runTrial(trial, { now: new Date(at), receive: () => [gemini([])], settle });
  assert.equal(report().rounds[0].status, 'paired');
  assert.equal(report().rounds[0].notices.length, 0);
  const later = await runTrial(trial, { now: new Date('2026-11-19T15:00:00+09:00'),
    rawGrok: [grok([notice], afternoon)], receive: () => [gemini([notice], morning)], settle });
  assert.equal(later.paired, 1);
  assert.equal(report().rounds[1].gemini.status, 'pending');
  assert.equal(calls, 1); // 오전의 수정본에서만 한쪽 발견. 다른 시간의 그록 공고로 메우지 않는다.
  assert.equal(report().rounds[0].notices[0].fields[0], 'presence');
});

test('시간대·순서·단순 중복은 걸러내고 AI 조건, 마감, 제출물과 한쪽 발견만 분류한다', () => {
  const equivalent = { ...notice, deadline: { ...notice.deadline, kst: '2026-12-01T09:00:00Z' },
    deliverables: { items: ['동의서', 'mp4', 'MP4'] } };
  let [result] = compareSlot(grok([notice, notice]), gemini([equivalent]));
  assert.deepEqual(result.fields, []);
  assert.deepEqual(result.duplicates, { grok: 1, gemini: 0 });
  [result] = compareSlot(grok([notice]), gemini([{ ...notice, ai: { status: 'conditional', quote: '사전 승인이 필요합니다.' },
    deadline: { date: '2026-12-01' }, deliverables: { items: ['MP4'] } }]));
  assert.deepEqual(result.fields, ['ai', 'deadline', 'deliverables']);
  assert.deepEqual(compareSlot(grok([]), gemini([notice]))[0].fields, ['presence']);
});

test('다른 회차가 전날 번호를 써도 원본을 보존하고 올바른 다음날 결과를 대조한다', async t => {
  const { trial, report } = fixture(t);
  const nextMorning = trial.slots[3], evening = trial.slots[2];
  const original = gemini([notice]);
  const opts = { now: new Date('2026-11-20T09:00:00+09:00'), rawGrok: [grok([notice]), grok([], nextMorning), grok([], evening)],
    receive: () => [original], settle: () => assert.fail('다른 회차 결과로 카본을 호출했습니다.') };
  await runTrial(trial, opts);
  opts.receive = () => [
    { ...gemini([]), checkedAt: '2026-11-19T14:15:00+09:00' },
    { ...gemini([]), checkedAt: '2026-11-20T08:31:00+09:00' },
    { ...gemini([], evening), checkedAt: '2026-11-19T23:50:00+09:00' },
    { ...gemini([], evening), checkedAt: '2026-11-20T08:15:00+09:00' },
    { ...gemini([], nextMorning), checkedAt: '2026-11-20T08:31:00+09:00' },
  ];
  const pass = await runTrial(trial, opts);
  assert.equal(pass.errors.length, 3);
  assert.equal(pass.paired, 3);
  assert.deepEqual(report().rounds[0].notices[0].fields, []);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(trial.dir, '회차원본', morning + '.gemini.json'), 'utf8')), original);
  assert.equal(fs.existsSync(path.join(trial.dir, '이전원본')), false);
});

test('같은 주최사 게시판에 올라온 다른 공고는 구분하고 글번호가 같은 상세 공고는 합친다', () => {
  const a = { ...notice, title: '어린이 영상 공모전', noticeId: '', officialUrl: 'https://example.com/notice/list.do?page=1' };
  const b = { ...a, title: '대학생 음악 창작 공모전' };
  assert.equal(compareSlot(grok([a]), gemini([b])).length, 2);
  const link = a.officialUrl + '&nttId=71';
  assert.equal(compareSlot(grok([{ ...a, officialUrl: link }]), gemini([{ ...b, officialUrl: link }])).length, 1);
});

test('예약 답변의 예시와 다른 시간·출처·손상된 JSON은 실제 영수증이 될 수 없다', async t => {
  const { trial, report } = fixture(t);
  const real = gemini([]), example = { ...real, slot: 'YYYY-MM-DD_HHmm' };
  assert.deepEqual(extractReports('등록했습니다. ' + JSON.stringify(example) + '\nJSON\n' + JSON.stringify(real)), [example, real]);
  assert.deepEqual(extractReports('결과 ' + JSON.stringify({ ...real, source: 'other' }) + '\n{not JSON}'), []);
  const bad = await runTrial(trial, { now: new Date(at), receive: () => [example, { ...real, checkedAt: '2026-11-17T10:00:00+09:00' }] });
  assert.equal(bad.paired, 0);
  assert.equal(bad.errors.length, 1);
  assert.equal(report().rounds[0].gemini.status, 'pending');
});

test('실제 예약 진입점에서 지도 게시가 보류되어도 같은 회차를 처리한다. 재실행은 중복 검증하지 않는다', async t => {
  const { folder, report } = fixture(t);
  save(path.join(folder, '신청현황.json'), { items: [] });
  save(path.join(folder, '통합목록.json'), { items: [] });
  let calls = 0, receives = 0;
  const options = {
    수신: (_config, known, missing) => {
      assert.deepEqual(missing, known.includes(morning) ? [] : [morning]);
      return { receipts: 1, failures: [], reports: known.includes(morning) ? [] : [grok([])] };
    },
    웹갱신: () => {
      assert.equal(report().rounds[0].status, 'paired');
      assert.equal(report().mapCheck, 'pending');
      return { status: 'deferred', reset: 'fixture' };
    },
    비교옵션: { now: new Date(at), receive: () => { receives++; return [gemini([notice])]; },
      settle: (_dir, groups) => { calls++; assert.deepEqual(groups.map(g => g.fields), [['presence']]);
        groups[0].carbon = { status: 'confirmed' }; } },
  };
  const one = await 지도동기화(folder, { artifact_sync: {} }, options);
  const two = await 지도동기화(folder, { artifact_sync: {} }, options);
  assert.equal(one.exitCode, 2);
  assert.equal(two.pilot.paired, 1);
  assert.equal(calls, 1); assert.equal(receives, 1);
  assert.deepEqual(report().rounds[0].notices[0].map, { pcMatches: 0, webMatches: null });
  assert.equal(report().maps.web, 'deferred');
});

test('모음 기사 한 편에 실린 서로 다른 주최사의 공고는 별도 카드와 별도 검증 대상이 된다', () => {
  const { 합치기 } = require('../tools/lib/grok-contests.cjs');
  const discoveryUrl = 'https://example.com/features/december-film-festivals';
  const first = { ...notice, title: '첫 번째 국제 AI 영화제', organizer: '주최사 하나', noticeId: '', discoveryUrl,
    officialUrl: 'https://first.example.com/' };
  const second = { ...first, title: '다른 영상 챌린지', organizer: '주최사 둘', officialUrl: 'https://second.example.com/challenge' };
  const raw = grok([first, second, first]);
  const results = compareSlot(raw, gemini([]));
  assert.deepEqual(results.map(g => g.duplicates.grok), [1, 0]);
  assert.deepEqual(합치기({ items: [] }, [raw]).items.map(c => c.title), [first.title, second.title]);
});

test('카본은 원문이 있는 불일치만 받고 근거 없는 판정은 보류하며 같은 근거를 재사용한다', async t => {
  const { trial } = fixture(t);
  const text = '가상 영상 공모전. 제작 때 AI 표시가 필수입니다. 이 문장은 주최사가 공지하였습니다.';
  let visits = 0;
  const page = async url => ({ 됨: true, 끝주소: url + ';jsessionid=' + (++visits), 글: '<p>' + text + '</p>' });
  let calls = 0;
  const carbon = async ({ model, thinking, prompt }) => {
    assert.equal(model, 'gemini-4-carbon'); assert.equal(thinking, 'high'); calls++;
    const batch = JSON.parse(prompt.slice(prompt.indexOf('\n') + 1));
    assert.equal(batch.length, 1);
    return { selectedModel: 'gemini-4-carbon-high', text: JSON.stringify({ cases: batch.map(row => ({
      id: row.id, findings: row.fields.map(field => ({ field, value: '조건부 허용', code: 'conditional', url: notice.officialUrl,
        quote: field === 'ai' ? notice.ai.quote : '본문에 실제로 없는 인용문입니다.' })),
    })) }) };
  };
  const changed = { ...notice, ai: { status: 'allowed' }, deadline: {} };
  const [group] = compareSlot(grok([notice]), gemini([changed]));
  const [agree] = compareSlot(grok([notice]), gemini([notice]));
  const unknown = { ...notice, officialUrl: '', discoveryUrl: 'https://wevity.com/notice' };
  const [noSource] = compareSlot(grok([]), gemini([unknown]));
  await settleDisputes(trial.dir, [group, agree, noSource], { fetchPage: page, carbon });
  await settleDisputes(trial.dir, [group], { fetchPage: page, carbon });
  assert.equal(calls, 1); assert.equal(agree.carbon, undefined);
  assert.equal(noSource.carbon.status, 'needs-official-source');
  assert.equal(group.carbon.status, 'needs-evidence');
  assert.deepEqual(group.carbon.findings[1], { field: 'deadline', value: '확인 필요' });
  assert.equal(group.carbon.findings[0].quote, notice.ai.quote);
  assert.equal(group.carbon.findings[0].url, notice.officialUrl);
});

test('아홉 쌍 모두 일치하면 카본을 부르지 않고 같은 공고가 다른 날 나와도 회차 중복으로 세지 않는다', async t => {
  const { folder, trial, report } = fixture(t);
  const map = path.join(folder, '공모지도.html');
  const data = { 열린: [{ 이름: notice.title, 주소: notice.officialUrl, AI허용: '조건부 허용', 제출물: ['영상'] }], 진행: [] };
  fs.writeFileSync(map, 'const 자료 = ' + JSON.stringify(data) + ';');
  const records = trial.slots.map(slot => ({ ...gemini([notice], slot), checkedAt: slot.slice(0, 10) + 'T' +
    slot.slice(11, 13) + ':' + slot.slice(13) + ':00+09:00' }));
  const now = new Date('2026-11-21T21:05:00+09:00');
  const options = { now, rawGrok: trial.slots.map(slot => grok([notice], slot)), receive: () => records,
    settle: () => assert.fail('일치한 공고의 카본 호출'), map: { pc: 'rendered', map, artifact: { status: 'deferred' } },
    remoteMap: { version: 'old', html: 'const 자료 = ' + JSON.stringify({ 열린: [], 진행: [] }) + ';' } };
  const all = await runTrial(trial, options);
  assert.equal(all.paired, 9); assert.equal(all.disputes, 0);
  assert.deepEqual(report().coverage, { grokOnly: 0, geminiOnly: 0, grokDuplicates: 0, geminiDuplicates: 0 });
  assert.deepEqual(report().rounds[0].notices[0].map, { pcMatches: 1, webMatches: 0 });
  assert.equal(report().closed, false);
  options.map.artifact.status = 'updated';
  options.remoteMap.html = fs.readFileSync(map, 'utf8');
  options.map.pc = 'error';
  await runTrial(trial, options);
  assert.equal(report().closed, false);
  options.map.pc = 'rendered';
  options.map.failedReports = [morning];
  await runTrial(trial, options);
  assert.equal(report().closed, false);
  options.map.failedReports = [];
  const duplicate = 'const 자료 = ' + JSON.stringify({ 열린: [data.열린[0], data.열린[0]], 진행: [] }) + ';';
  fs.writeFileSync(map, duplicate);
  options.remoteMap.html = duplicate;
  await runTrial(trial, options);
  assert.equal(report().rounds[0].notices[0].map.pcMatches, 2);
  assert.equal(report().maps.cardsChecked, false);
  assert.equal(report().closed, false);
  fs.writeFileSync(map, 'const 자료 = ' + JSON.stringify(data) + ';');
  options.remoteMap.html = fs.readFileSync(map, 'utf8');
  await runTrial(trial, options);
  assert.equal(report().rounds[0].notices[0].map.sameFields, true);
  assert.equal(report().closed, true);
  assert.equal((await runTrial(trial, options)).status, 'closed');
});

test('카본의 잘못된 항목 하나만 한 번 다시 묻고 다른 공고와 맞는 항목은 보존한다', async t => {
  const { trial } = fixture(t);
  const names = ['first', 'second', 'third'];
  const rows = names.map(id => ({ ...notice, title: '가상 공모전 ' + id, noticeId: id, officialUrl: 'https://example.com/' + id }));
  const groups = compareSlot(grok(rows), gemini(rows.map(r => ({ ...r, ai: { status: 'allowed' }, deadline: {} }))));
  const calls = [];
  const quote = '이 공고는 AI 표시가 필요하며 12월 1일까지 접수합니다.';
  let visits = 0;
  const opts = { fetchPage: async url => ({ 됨: true, 끝주소: url, 글: '조회 ' + (++visits) + ' ' + quote }),
    carbon: async ({ prompt }) => {
      const batch = JSON.parse(prompt.slice(prompt.indexOf('\n') + 1));
      calls.push(batch.map(item => [item.grok[0].noticeId, item.fields]));
      const cases = batch.filter(item => item.grok[0].noticeId !== 'third').map(item => ({
        id: item.id, findings: item.fields.filter(f => !(calls.length === 1 && item.grok[0].noticeId === 'first' && f === 'deadline'))
          .map(field => ({ field, quote, url: item.sources[0].url, value: '확인', code: 'conditional', date: '2026-12-01', kst: '' })),
      }));
      return { selectedModel: 'gemini-4-carbon-high', text: JSON.stringify({ cases }) };
    } };
  await assert.rejects(settleDisputes(trial.dir, groups, opts), /2건/);
  assert.equal(groups[1].carbon.status, 'confirmed');
  await settleDisputes(trial.dir, groups, opts);
  await settleDisputes(trial.dir, groups, opts);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], [['first', ['deadline']], ['third', ['ai', 'deadline']]]);
  assert.equal(groups[0].carbon.findings[0].code, 'conditional');
  assert.equal(groups[0].carbon.status, 'confirmed');
  assert.equal(groups[2].carbon.status, 'needs-evidence');
  assert.equal(groups[2].carbon.attempts, 2);
});

test('이전 카본 인용 자체가 원문에서 사라지면 같은 회차 요건도 다시 확인한다', async t => {
  const { trial } = fixture(t);
  const [group] = compareSlot(grok([notice]), gemini([{ ...notice, ai: { status: 'allowed' } }]));
  let quote = 'AI 활용에는 명시가 필요합니다.', calls = 0;
  const opts = { fetchPage: async url => ({ 됨: true, 끝주소: url, 글: '주최사 공모전 ' + quote }),
    carbon: async ({ prompt }) => { calls++;
      const [entry] = JSON.parse(prompt.slice(prompt.indexOf('\n') + 1));
      return { selectedModel: 'gemini-4-carbon-high', text: JSON.stringify({ cases: [{ id: entry.id,
        findings: [{ field: 'ai', code: 'conditional', value: '조건부', url: notice.officialUrl, quote }] }] }) };
    } };
  await settleDisputes(trial.dir, [group], opts);
  quote = 'AI 활용에는 사전 심사도 필요합니다.';
  await settleDisputes(trial.dir, [group], opts);
  assert.equal(calls, 2); assert.equal(group.carbon.findings[0].quote, quote);
});

test('최종 회수에서 접속이 끊겨도 다음날 도착한 실제 아홉 번째 결과를 회수한다', async t => {
  const { trial, report, folder } = fixture(t);
  const map = path.join(folder, '공모지도.html');
  fs.writeFileSync(map, 'const 자료 = {"열린":[],"진행":[]};');
  const all = trial.slots.map(slot => ({ ...gemini([], slot), checkedAt: slot.slice(0, 10) + 'T' +
    slot.slice(11, 13) + ':' + slot.slice(13) + ':00+09:00' }));
  const opts = { now: new Date('2026-11-21T21:00+09:00'), rawGrok: trial.slots.map(slot => grok([], slot)),
    receive: () => all.slice(0, -1), map: { pc: 'rendered', map, artifact: { status: 'current' } } };
  await runTrial(trial, opts);
  opts.now = new Date('2026-11-25T15:00+09:00'); opts.rawGrok = [];
  opts.receive = () => { throw Error('일시적인 수신 오류'); };
  await runTrial(trial, opts);
  assert.equal(report().collectionClosed, false); assert.equal(report().rounds.at(-1).gemini.status, 'access-error');
  opts.now = new Date('2026-11-26T15:00+09:00'); opts.receive = () => all;
  await runTrial(trial, opts);
  assert.equal(report().closed, true); assert.equal(report().paired, 9);
});

test('늦게 켠 PC도 회수 기회를 갖고 마지막까지 오지 않은 결과는 미대조로 마감한다', async t => {
  const { trial, report, folder } = fixture(t);
  const map = path.join(folder, '공모지도.html');
  fs.writeFileSync(map, 'const 자료 = {"열린":[],"진행":[]};');
  const unavailable = trial.slots.at(-1);
  const records = trial.slots.map(slot => ({ ...gemini([], slot), checkedAt: slot.slice(0, 10) + 'T' +
    slot.slice(11, 13) + ':' + slot.slice(13) + ':00+09:00', ...(slot === unavailable && { reports: [], unavailable: ['접근 실패'] }) }));
  let calls = 0;
  const opts = { now: new Date('2026-12-02T11:00+09:00'), rawGrok: trial.slots.map(slot => grok([], slot)),
    receive: () => { calls++; return records; }, map: { pc: 'rendered', map, artifact: { status: 'deferred' } } };
  await runTrial(trial, opts);
  assert.equal(report().collectionClosed, false);
  opts.now = new Date('2026-12-03T11:00+09:00'); opts.rawGrok = [];
  await runTrial(trial, opts);
  assert.equal(report().unpaired, 1); assert.equal(report().paired, 8);
  assert.equal(report().closed, false);
  opts.map.artifact.status = 'current';
  await runTrial(trial, opts);
  assert.equal(report().closed, true);
  assert.equal(report().rounds.at(-1).status, 'unpaired');
  assert.equal(calls, 2);
});

test('손상된 한 회차가 다른 공고를 막지 않고 정상 원본을 받으면 깨진 바이트도 보존한다', async t => {
  const { trial, report } = fixture(t);
  const dir = path.join(trial.dir, '회차원본');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, morning + '.gemini.json'), '{broken');
  const opts = { now: new Date('2026-11-19T15:12:00+09:00'), rawGrok: [grok([]), grok([], afternoon)],
    receive: () => [gemini([], afternoon)] };
  await runTrial(trial, opts);
  assert.equal(report().paired, 1);
  assert.equal(report().rounds[0].gemini.status, 'invalid');
  opts.receive = () => [gemini([])];
  await runTrial(trial, opts);
  assert.equal(report().paired, 2);
  const backups = fs.readdirSync(path.join(trial.dir, '이전원본'));
  assert.equal(backups.length, 1); assert.equal(fs.readFileSync(path.join(trial.dir, '이전원본', backups[0]), 'utf8'), '{broken');
});

test('주최사 원문과 카본이 확인한 Gemini 단독 공고가 PC와 웹에 같은 카드 한 장으로 반영된다', async t => {
  const { folder, trial, report } = fixture(t);
  save(path.join(folder, '신청현황.json'), { items: [] });
  save(path.join(folder, '통합목록.json'), { items: [] });
  const data = { ...notice, video: true };
  const quote = '가상 영상 공모전은 접수 중이며 AI 표시가 필요합니다. 2099년 12월 1일까지 MP4와 동의서를 제출합니다.';
  let calls = 0;
  const known = { presence: { code: 'open' }, ai: { code: 'conditional' }, deadline: { date: '2099-12-01', kst: '' },
    deliverables: { items: ['MP4', '동의서'] } };
  const opts = { 수신: () => ({ receipts: 1, reports: [grok([])], failures: [] }),
    비교옵션: { now: new Date(at), receive: () => [gemini([data])], settle: (dir, groups) => settleDisputes(dir, groups, {
      fetchPage: async url => ({ 됨: true, 끝주소: url, 글: quote }), carbon: async ({ prompt }) => {
        calls++;
        const [input] = JSON.parse(prompt.slice(prompt.indexOf('\n') + 1));
        return { selectedModel: 'gemini-4-carbon-high', text: JSON.stringify({ cases: [{ id: input.id,
          findings: input.fields.map(field => ({ field, url: data.officialUrl, quote, value: '공고에서 확인', ...known[field] })) }] }) };
      } }) }, 웹갱신: (_config, file, observe) => {
      const html = fs.readFileSync(file, 'utf8'), parsed = JSON.parse(/^const 자료 = (.+);$/m.exec(html)[1]);
      assert.equal(parsed.열린.length, 1); const [card] = parsed.열린;
      assert.equal(card.그록, false); assert.equal(card.AI허용, '조건부 허용'); assert.equal(card.마감, '2099-12-01');
      assert.deepEqual(card.제출물, ['MP4', '동의서']); assert.equal(card.AI주소, data.officialUrl);
      observe(html, 'fixture'); return { status: 'current' };
    } };
  for (let i = 0; i < 2; i++) {
    const result = await 지도동기화(folder, { artifact_sync: {} }, opts);
    assert.equal(result.exitCode, 0, JSON.stringify(result));
    assert.deepEqual(report().rounds[0].notices[0].map, { pcMatches: 1, webMatches: 1, sameFields: true });
  }
  assert.equal(calls, 1);
  assert.equal(fs.readdirSync(path.join(trial.dir, '지도반영')).length, 1);
});

test('같은 지도 소유자의 확정 주간 한도만 재사용하고 초기화 시각에는 즉시 조회한다', async t => {
  const { folder } = fixture(t);
  const { 게시한도확인 } = require('../tools/lib/공모지도-클로드.cjs');
  const cache = path.join(folder, 'quota.json');
  let calls = 0;
  const query = () => { calls++; return { status: 'deferred', reset: 'Nov 23, 12pm (Asia/Seoul)' }; };
  const check = (owner, time) => 게시한도확인(cache, owner, query, +new Date(time));
  await check('owner-one', '2026-11-23T08:00+09:00');
  assert.equal((await check('owner-one', '2026-11-23T11:59+09:00')).usageCheck, 'cached');
  await check('separate-target', '2026-11-23T11:59+09:00');
  assert.equal(calls, 2);
  await check('separate-target', '2026-11-23T12:00+09:00');
  assert.equal(calls, 3);
});
