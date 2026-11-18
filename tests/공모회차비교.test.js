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
    수신: (_config, known) => ({ receipts: 1, failures: [], reports: known.includes(morning) ? [] : [grok([])] }),
    웹갱신: () => ({ status: 'deferred', reset: 'fixture' }),
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

test('카본은 원문이 있는 불일치만 받고 근거 없는 판정은 보류하며 같은 근거를 재사용한다', async t => {
  const { trial } = fixture(t);
  const text = '가상 영상 공모전. 제작 때 AI 표시가 필수입니다. 이 문장은 주최사가 공지하였습니다.';
  const page = async url => ({ 됨: true, 끝주소: url, 글: '<p>' + text + '</p>' });
  let calls = 0;
  const carbon = async ({ model, thinking, prompt }) => {
    assert.equal(model, 'gemini-4-carbon'); assert.equal(thinking, 'high'); calls++;
    const batch = JSON.parse(prompt.slice(prompt.indexOf('\n') + 1));
    assert.equal(batch.length, 1);
    return { selectedModel: 'gemini-4-carbon-high', text: JSON.stringify({ cases: batch.map(row => ({
      id: row.id, findings: row.fields.map(field => ({ field, value: '조건부 허용', url: notice.officialUrl,
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
  await runTrial(trial, options);
  assert.equal(report().rounds[0].notices[0].map.sameFields, true);
  assert.equal(report().closed, true);
  assert.equal((await runTrial(trial, options)).status, 'closed');
});
