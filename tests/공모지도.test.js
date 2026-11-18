'use strict';
// 공모 지도(tools/공모지도.js)가 장부의 단계 칸을 빠짐없이 읽고, 빠진 칸을 알리고, 낼 수 있는 AI 영상 공모를 바르게 고르는지 본다(2026-11-18).
// 왜: 지도는 장부를 그대로 그리는 것이라, 단계가 비거나 마감이 빠진 건은 조용히 사라지기 쉽다. 이미 낸 공모가 「낼 수 있는 공모」에 다시 뜨면 헷갈린다.
// 실제 보관함은 읽지 않는다(임시 폴더에 만든 것만 읽는다).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const 지도 = require('../tools/공모지도.js');
const { 지도동기화 } = require('../tools/공모지도동기화.cjs');

const 도구 = path.join(__dirname, '..', 'tools', '공모지도.js');

test('수신이 끊겨도 장부를 그리고, 잘못된 회차 뒤의 정상 회차는 한 번만 저장한다', async t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-contest-sync-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const 현황 = 장부();
  현황.items[0].name = '장부에서 수정한 공모';
  fs.writeFileSync(path.join(folder, '신청현황.json'), JSON.stringify(현황));
  fs.writeFileSync(path.join(folder, '통합목록.json'), JSON.stringify(목록()));
  const config = { artifact_sync: {} };
  const 웹갱신 = (_config, map) => {
    assert.match(fs.readFileSync(map, 'utf8'), /장부에서 수정한 공모/);
    return { status: 'current', version: 7 };
  };
  const offline = await 지도동기화(folder, config, { 수신: () => { throw Error('수신 실패'); }, 웹갱신 });
  assert.equal(offline.grokError, '수신 실패');
  assert.equal(offline.exitCode, 1);
  assert.equal(offline.pc, 'rendered');
  assert.equal(offline.artifactSource, 'rendered-pc-map');
  assert.equal(offline.artifact.status, 'current');
  for (const error of [new Error(), undefined]) {
    const emptyError = await 지도동기화(folder, config, { 수신: () => Promise.reject(error), 웹갱신 });
    assert.equal(emptyError.pc, 'rendered');
    assert.equal(emptyError.artifact.status, 'current');
    assert.equal(emptyError.grokError, '그록 회차를 읽지 못했습니다.');
    assert.equal(emptyError.exitCode, 1);
  }

  const report = { schema: 'synk-grok-contests-v1', reportId: 'good', reports: ['fixture.md'], items: [] };
  const feed = { receipts: 3, reports: [{ reportId: 'bad' }, report], failures: ['download'] };
  const partial = await 지도동기화(folder, config, { 수신: () => feed, 웹갱신 });
  assert.deepEqual(partial.failedReports, ['download', 'bad']);
  assert.equal(partial.importErrors[0].reportId, 'bad');
  assert.equal(partial.imported, 1);
  assert.equal(partial.exitCode, 1);
  assert.equal(partial.pc, 'rendered');
  assert.equal(partial.artifact.status, 'current');
  const retry = await 지도동기화(folder, config, { 수신: (_source, ids) => {
    assert.deepEqual(ids, ['good']);
    return { receipts: 1, reports: [report] };
  }, 웹갱신 });
  assert.deepEqual(retry.failedReports, []);
  assert.equal(retry.imported, 0);
  assert.equal(retry.exitCode, 0);
  const waiting = await 지도동기화(folder, config, { 수신: () => ({ receipts: 1, reports: [] }),
    웹갱신: () => ({ status: 'deferred', reset: '다음 회차' }) });
  assert.equal(waiting.exitCode, 2);
  assert.equal(waiting.pc, 'rendered');

  const map = retry.map, saved = fs.readFileSync(map);
  fs.writeFileSync(path.join(folder, '신청현황.json'), '{');
  const prior = await 지도동기화(folder, config, { 수신: () => feed, 웹갱신 });
  assert.equal(prior.pc, 'error');
  assert.equal(prior.artifactSource, 'previous-pc-map');
  assert.equal(prior.artifact.status, 'current');
  assert.equal(prior.exitCode, 1);
  assert.deepEqual(fs.readFileSync(map), saved);
  fs.unlinkSync(map);
  const missing = await 지도동기화(folder, config, { 수신: () => feed, 웹갱신 });
  assert.equal(missing.artifact.status, 'skipped');
  assert.equal(missing.exitCode, 1);
});

function 장부() {
  return {
    items: [
      { id: 'a', name: '경산 AI 공모전(경산시 공고 제1호)', stage: '준비 중', kind: '공모전', ai_video: true, deadline: '2026-11-23T23:59', owner: '곁 세션' },
      { id: 'b', name: '화성 AI CF', stage: '결과 기다림', kind: '공모전', ai_video: true, result: { date: '2026-11-19' } },
      { id: 'c', name: '재도전 사업계획서', stage: '결과 기다림', kind: '지원사업', ai_video: false, result: { text: '발표일 모름' } },
      { id: 'd', name: '의왕 e-Room', stage: '선정', kind: '공모전', ai_video: false, next_event: { date: '2026-11-25', text: '발표 자료' } },
      { id: 'e', name: '서울로 네이처', stage: '안 됨', kind: '공모전', ai_video: true, result: { text: '미선정' } },
    ],
  };
}

function 목록() {
  return {
    meta: {},
    items: [
      { id: 'a', title: '경산 AI 공모전', calendar_20261110: { end: '2026-11-23' }, ai_video: { value: 'AI 영상', basis: 'AI 활용' } },
      { id: 'x', title: '문경시 관광 AI 영상 공모전', calendar_20261110: { end: '2026-11-30' }, ai_video: { value: 'AI 영상', basis: 'AI 생성 필수' }, latest_review: { url: 'https://example.org/mungyeong' } },
      { id: 'y', title: '실손24 영상 공모전', calendar_20261110: { end: '2026-11-30' }, ai_video: { value: '영상', basis: 'AI 확인 필요' } },
      { id: 'z', title: '지난 AI 영상 공모', calendar_20261110: { end: '2026-11-01' }, ai_video: { value: 'AI 영상' } },
      { id: 'w', title: '정책 아이디어 공모', calendar_20261110: { end: '2026-12-01' }, ai_video: { value: '아님' } },
      { id: 'g', title: 'Higgsfield Talent Contest', grok_20261117: { end: '2026-11-26', deadline_text: '2026-11-27 04:00 KST' }, ai_video: { value: 'AI 영상' } },
      { id: 'h', title: '화성 AI CF 숏폼 CM송 공모', calendar_20261110: { end: '2026-12-31' }, ai_video: { value: 'AI 영상' } },
    ],
  };
}

const 지금 = new Date('2026-11-17T16:00:00Z'); // 한국 시각 11-18 01:00

test('한국 시각으로 오늘을 센다', () => {
  assert.strictEqual(지도.오늘(지금), '2026-11-18');
});

test('끝의 괄호 설명을 걷어 짧은 이름을 만든다', () => {
  assert.strictEqual(지도.짧은이름('경산 AI 공모전(경산시 공고 제1호)'), '경산 AI 공모전');
  assert.strictEqual(지도.짧은이름('2026 진주시 영상 공모전 — 숏폼 분야(진주시 공고 제2026-1623호)'), '2026 진주시 영상 공모전 — 숏폼 분야');
  assert.strictEqual(지도.짧은이름('KCTI 연구아이디어 3건'), 'KCTI 연구아이디어 3건');
});

test('장부의 단계와 칸을 카드로 옮긴다', () => {
  const 자료 = 지도.자료만들기(장부(), 목록(), 지금);
  assert.strictEqual(자료.진행.length, 5);
  const a = 자료.진행.find((o) => o.id === 'a');
  assert.deepStrictEqual([a.단계, a.ai영상, a.마감, a.맡은곳, a.이름], ['준비 중', true, '2026-11-23T23:59', '곁 세션', '경산 AI 공모전']);
  assert.strictEqual(자료.진행.find((o) => o.id === 'c').갈래, '지원사업');
});

test('낼 수 있는 영상 공모는 마감이 안 지났고 장부에 없는 것만 고른다', () => {
  const 열린 = 지도.열린영상(목록(), 장부(), '2026-11-18');
  const ids = 열린.map((o) => o.id);
  assert.ok(!ids.includes('a'), '장부에 있는 공모(id가 같음)는 뺀다');
  assert.ok(!ids.includes('h'), '장부에 있는 공모(이름이 같음)는 뺀다');
  assert.ok(!ids.includes('z'), '마감이 지난 공모는 뺀다');
  assert.ok(!ids.includes('w'), '영상이 아닌 공모는 뺀다');
  assert.deepStrictEqual(ids, ['g', 'x', 'y'], '마감 순서로 늘어놓는다');
  const g = 열린.find((o) => o.id === 'g');
  assert.strictEqual(g.원문확인안함, true);
  assert.strictEqual(g.마감글, '2026-11-27 04:00 KST');
  assert.strictEqual(열린.find((o) => o.id === 'x').주소, 'https://example.org/mungyeong');
});

test('빠진 칸을 하나씩 알린다', () => {
  const s = 장부();
  s.items.push({ id: 'p', name: '마감 없는 준비', stage: '준비 중', ai_video: true });
  s.items.push({ id: 'q', name: '단계 없는 건', ai_video: false });
  s.items.push({ id: 'r', name: '결과 칸 없는 건', stage: '결과 기다림' });
  const 문제 = 지도.검사(s);
  assert.ok(문제.some((p) => p.includes('마감 없는 준비') && p.includes('deadline')));
  assert.ok(문제.some((p) => p.includes('마감 없는 준비') && p.includes('owner')));
  assert.ok(문제.some((p) => p.includes('단계 없는 건') && p.includes('stage')));
  assert.ok(문제.some((p) => p.includes('결과 칸 없는 건') && p.includes('result')));
  assert.ok(문제.some((p) => p.includes('결과 칸 없는 건') && p.includes('ai_video')));
  assert.deepStrictEqual(지도.검사(장부()), []);
});

test('페이지는 자료를 안전하게 싣고 제목과 테마 토큰을 갖춘다', () => {
  const s = 장부();
  s.items[0].name = '꺾쇠 </script><b>공모</b>';
  const html = 지도.페이지(지도.자료만들기(s, 목록(), 지금));
  assert.match(html, /^<title>공모 지도<\/title>/);
  assert.ok(!html.includes('</script><b>'), '자료 안의 꺾쇠가 스크립트를 닫지 않는다');
  assert.match(html, /@media \(prefers-color-scheme: light\)/);
  assert.match(html, /:root\[data-theme="light"\]/);
});

test('명령줄: --검사는 빠진 칸이 있으면 1로 끝나고, 만들기는 파일을 쓴다', (t) => {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), '공모지도-'));
  t.after(() => fs.rmSync(폴더, { recursive: true, force: true }));
  const s = 장부();
  s.items.push({ id: 'p', name: '마감 없는 준비', stage: '준비 중', ai_video: true });
  fs.writeFileSync(path.join(폴더, '신청현황.json'), JSON.stringify(s));
  fs.writeFileSync(path.join(폴더, '통합목록.json'), JSON.stringify(목록()));
  const 검 = spawnSync(process.execPath, [도구, '--검사', '--보관함', 폴더], { encoding: 'utf8' });
  assert.strictEqual(검.status, 1, 검.stdout + 검.stderr);
  assert.match(검.stdout, /마감 없는 준비/);
});


test('그록 보고서 두 회차를 공고와 대조하고 확인된 원문의 세 칸만 지도에 싣는다', async (t) => {
  const 그록 = require('../tools/lib/grok-contests.cjs');
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'grok-contests-'));
  t.after(() => fs.rmSync(폴더, { recursive: true, force: true }));
  const 주소 = 'https://example.org/notice?no=42';
  const 원문 = '생성형 AI 활용을 허용합니다. 마감은 2026-11-30 18:00입니다. 작품 영상과 참가신청서를 제출하세요.';
  const 한건 = {
    title: '우리 지역 AI 공모',
    organizer: '지역문화원',
    edition: '2026',
    noticeId: '2026-42',
    video: true,
    discoveryUrl: 'https://example.net/open/42',
    officialUrl: 주소 + '&utm_source=round1',
    ai: { status: 'allowed', url: 주소, quote: '생성형 AI 활용을 허용합니다.' },
    deadline: { date: '2026-11-30', kst: '2026-11-30T18:00+09:00', url: 주소, quote: '마감은 2026-11-30 18:00입니다.' },
    deliverables: { items: ['작품 영상', '참가신청서'], url: 주소, quote: '작품 영상과 참가신청서를 제출하세요.' },
  };
  const 보고서 = (reportId, items) => ({ schema: 'synk-grok-contests-v1', reportId, reports: ['fixture.md'], items });
  let 받은주소 = [];
  const 읽기 = async (url) => {
    받은주소.push(url);
    return { 됨: true, 끝주소: url, 글: 원문 };
  };
  const 앞 = 보고서('morning', [한건]);
  assert.equal((await 그록.가져오기(폴더, 앞, 읽기)).already, false);
  assert.equal((await 그록.가져오기(폴더, 앞, 읽기)).already, true);
  assert.deepEqual(받은주소, [주소]);
  const 뒤 = 보고서('evening', [{
    ...한건, title: '우리 지역 AI 공모전', organizer: '지역문화원 공모 사업단', noticeId: '', officialUrl: 주소,
    ai: { status: 'allowed', url: 주소, quote: '다른 대회의 원문 문장입니다.' },
  }]);
  await 그록.가져오기(폴더, 뒤, 읽기);

  const base = { items: [{ id: 'already', title: 한건.title, latest_review: { url: 주소 }, ai_video: { value: '영상' } }] };
  const combined = 그록.합치기(base, 그록.보고서읽기(폴더));
  assert.equal(combined.items.length, 1);
  assert.equal(combined.items[0].id, 'already');
  assert.equal(base.items[0].grok_contest, undefined);
  const row = 지도.자료만들기({ items: [] }, combined, 지금).열린[0];
  assert.equal(row.AI허용, '허용');
  assert.equal(row.마감글, '2026-11-30 18:00 KST');
  assert.deepEqual(row.제출물, ['작품 영상', '참가신청서']);
  assert.equal(row.제출물주소, 주소);
  assert.equal(지도.자료만들기({ items: [] }, combined, new Date('2026-11-30T09:00:00Z')).열린.length, 0);
  assert.equal(그록.동일공고(한건, { ...한건, edition: '2027', organizer: '다른 주최자' }), false);
  assert.equal(그록.동일공고(한건, { ...한건, edition: '2027' }), false);
  assert.equal(그록.동일공고(한건, { ...한건, noticeId: '2026-43' }), false);
});

test('이전 회차가 늦게 들어와도 더 최근에 확인한 공모 조건이 남는다', async (t) => {
  const 그록 = require('../tools/lib/grok-contests.cjs');
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'grok-contests-'));
  t.after(() => fs.rmSync(폴더, { recursive: true, force: true }));
  const url = 'https://example.org/notice/42';
  const 보고서 = (reportId, status, quote) => ({
    schema: 'synk-grok-contests-v1', reportId, reports: ['fixture.md'], items: [{
      title: '창의적인 소재 공모전', officialUrl: url, ai: { status, url, quote },
    }],
  });
  const 원문 = async () => ({ 됨: true, 끝주소: url, 글: 'AI는 제한하여 허용합니다. AI를 허용합니다.' });
  await 그록.가져오기(폴더, 보고서('2026-11-18_1430', 'conditional', 'AI는 제한하여 허용합니다.'), 원문);
  await 그록.가져오기(폴더, 보고서('2026-11-18_0830', 'allowed', 'AI를 허용합니다.'), 원문);
  const combined = 그록.합치기({ items: [] }, 그록.보고서읽기(폴더));
  assert.equal(combined.items[0].grok_contest.ai.status, 'conditional');

  const reports = 그록.보고서읽기(폴더);
  const later = reports.at(-1).items[0];
  const original = { id: 'existing', title: '크리에이티브 소재 공모' };
  const linked = 그록.합치기({ items: [original] }, [
    { items: [later] },
    { items: [{ ...later, title: original.title, ai: { status: 'unconfirmed' } }] },
  ]);
  assert.deepEqual(linked.items.map((item) => item.id), [original.id]);
  assert.equal(linked.items[0].grok_contest.ai.status, 'conditional');
});

test('공식 문구가 모음 사이트에만 있거나 원문을 못 읽으면 세 칸을 확인 필요로 둔다', async (t) => {
  const 그록 = require('../tools/lib/grok-contests.cjs');
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'grok-contests-'));
  t.after(() => fs.rmSync(폴더, { recursive: true, force: true }));
  const discoveryUrl = 'https://www.contestkorea.com/list/42';
  const 보고서 = {
    schema: 'synk-grok-contests-v1', reportId: 'afternoon', reports: ['fixture.md'], items: [{
      title: '소재 창작 대회', video: false, officialUrl: discoveryUrl,
      ai: { status: 'allowed', url: discoveryUrl, quote: 'AI 활용을 허용한다' },
      deadline: { date: '2026-11-30', url: discoveryUrl, quote: '11월 30일 마감' },
      deliverables: { items: ['영상'], url: discoveryUrl, quote: '제출물은 공모 영상 한 편이다' },
    }],
  };
  const result = await 그록.가져오기(폴더, 보고서, async () => assert.fail('모음 사이트는 공식 원문으로 읽지 않는다'));
  assert.equal(result.items[0].ai.status, 'unconfirmed');
  const combined = 그록.합치기({ items: [] }, 그록.보고서읽기(폴더));
  const row = 지도.자료만들기({ items: [] }, combined, 지금).열린[0];
  assert.equal(row.값, '기타 공모');
  assert.equal(row.AI허용, '확인 필요');
  assert.equal(row.마감, '');
  assert.deepEqual(row.제출물, []);
  assert.equal(row.주소, discoveryUrl);
});

test('공식 원문에서 AI 금지가 확인된 공모는 열린 목록에 나타나지 않는다', async (t) => {
  const 그록 = require('../tools/lib/grok-contests.cjs');
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'grok-contests-'));
  t.after(() => fs.rmSync(폴더, { recursive: true, force: true }));
  const url = 'https://example.org/notice/ai-ban';
  await 그록.가져오기(폴더, {
    schema: 'synk-grok-contests-v1', reportId: 'one', reports: ['fixture.md'], items: [{
      title: '창작 영상 공모전', video: true, officialUrl: url, organizer: '시민문화원',
      ai: { status: 'prohibited', url, quote: '생성형 AI를 이용한 창작물은 제출할 수 없습니다.' },
    }],
  }, async (address) => ({ 됨: true, 끝주소: address, 글: '<strong>생성형 AI를 이용한 창작물은 제출할 수 없습니다.</strong>' }));
  const base = { items: [{ id: 'existing', title: '창작 영상 공모전', ai_video: { value: 'AI 영상' } }] };
  const combined = 그록.합치기(base, 그록.보고서읽기(폴더));
  assert.deepEqual(지도.자료만들기({ items: [] }, combined, 지금).열린, []);
});

test('Claude 지도 예약은 같은 비공개 주소와 생성된 파일에 한해서만 읽기와 게시를 허용한다', () => {
  const 실행기 = path.join(__dirname, '..', 'tools', 'lib', '공모지도-클로드.cjs');
  const url = 'https://claude.ai/artifact/example';
  const map = path.join(os.tmpdir(), '공모지도.html');
  const env = { ...process.env, SYNK_CONTEST_ARTIFACT_URL: url, SYNK_CONTEST_ARTIFACT_HTML: map };
  const 게시 = { action: 'publish', url, file_path: map };
  const 입력과판정 = [
    [{ action: 'read', url }, 'allow'],
    [게시, 'allow'],
    [{ ...게시, force: true }, 'deny'],
    [{ ...게시, url: 'https://claude.ai/artifact/other' }, 'deny'],
    [{ ...게시, file_path: path.join(os.tmpdir(), '다른자료.html') }, 'deny'],
    [{ action: 'publish', file_path: map }, 'deny'],
    [{ action: 'delete', url }, 'deny'],
  ];
  for (const [tool_input, 판정] of 입력과판정) {
    const result = spawnSync(process.execPath, [실행기, '--artifact-permission'], {
      input: JSON.stringify({ tool_name: 'Artifact', tool_input }), env, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 판정);
  }
});
