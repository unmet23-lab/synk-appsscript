'use strict';
// 계정 통계 루틴: 작은 합성 HTML과 가짜 fetch로만 시험한다(실제 네트워크·운영 상태를 건드리지 않음).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const R = require('../tools/계정통계루틴.cjs');
const { spawnSync } = require('node:child_process');

const CATALOG = { statuses: ['operating', 'operating-contact', 'confirmed-expansion'], accounts: [
  { id: 'demo-telegram', platform: 'telegram', handle: '@demo_chan', accountStatus: 'operating' },
  { id: 'person-telegram', platform: 'telegram', handle: '@person_contact', accountStatus: 'operating-contact' },
  { id: 'demo-youtube', platform: 'youtube', handle: '@demo_video', accountStatus: 'operating' }] };
const BASE = 'https://t.me/s/demo_chan';
const FAST = { ...R.LIMITS, maxPages: 3, timeoutMs: 50 };
const msg = (id, o = {}) => `<div class="tgme_widget_message_wrap"><div class="tgme_widget_message js-widget_message${o.service ? ' service_message' : ''}" data-post="${o.ch || 'demo_chan'}/${id}">`
  + `<div class="tgme_widget_message_text">글 ${id}</div>`
  + (o.views === null ? '' : `<span class="tgme_widget_message_views">${o.views ?? id * 10}</span>`)
  + `<a class="tgme_widget_message_date" href="#">${o.time === null ? '' : `<time datetime="${o.time || '2026-11-01T00:00:00+00:00'}">t</time>`}</a></div></div>`;
// 실제 t.me/s 쪽처럼 채널 확인 표시(@이름)와 글 목록 구역(tgme_channel_history)을 둔다. 둘 중 하나라도 없으면 그 쪽은 믿지 않는다.
const shell = (inner, handle = 'demo_chan') => `<html><body><div class="tgme_channel_info"><div class="tgme_channel_info_header_username"><a href="https://t.me/${handle}">@${handle}</a></div></div>`
  + `<section class="tgme_channel_history js-message_history">${inner}</section><script>var s = 'tgme_widget_message';</script></body></html>`;
const page = (ids, before, opts = {}) => shell((before ? `<a class="tme_messages_more js-messages_more" data-before="${before}" href="/s/demo_chan?before=${before}"></a>` : '')
  + ids.map(id => msg(id, opts[id])).join(''));
const LF = String.fromCharCode(10);
const sha = data => require('node:crypto').createHash('sha256').update(data).digest('hex');
// 공식 수집기 대역: 받은 매니페스트 이름과 실제로 읽은 바이트의 해시를 seen.txt에 남기고, 이름이 fail-로 시작하면 실패로 끝낸다.
// 상태 폴더에 hook.cjs가 있으면 먼저 부른다(제출하는 동안 다른 수신함 파일이 바뀌는 경우).
function fakeIngester(dir) {
  const file = path.join(dir, 'fake-ingester.cjs');
  fs.writeFileSync(file, [`const fs = require('fs'), path = require('path'), crypto = require('crypto');`,
    `const manifest = process.argv[3], name = path.basename(manifest), hook = path.join(__dirname, 'hook.cjs');`,
    `if (fs.existsSync(hook)) require(hook)(manifest);`,
    `const hash = crypto.createHash('sha256').update(fs.readFileSync(manifest)).digest('hex');`,
    `fs.appendFileSync(path.join(__dirname, 'seen.txt'), name + ' ' + hash + String.fromCharCode(10));`,
    `process.exit(name.startsWith('fail-') ? 1 : 0);`].join(LF));
  return file;
}
function setup(t, config = { version: 1 }) {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'acct-routine-')), inbox = path.join(state, 'inbox'), logs = [];
  t.after(() => fs.rmSync(state, { recursive: true, force: true }));
  fs.mkdirSync(inbox);
  fs.writeFileSync(path.join(state, 'config.json'), JSON.stringify(config));
  return { state, inbox, logs, deps: { stateDir: state, ingester: fakeIngester(state), loadCatalog: async () => CATALOG, fetchImpl: fakeFetch({}), pauseMs: 0, log: line => logs.push(line) } };
}
// 공식 내보내기 매니페스트와 그 증거(evidence/<이름>.xlsx)를 둔다.
function writeOfficial(inbox, name, year = '2025', sourceType = 'official-export') {
  fs.mkdirSync(path.join(inbox, 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(inbox, 'evidence', `${name}.xlsx`), `xlsx bytes of ${name}`);
  const file = path.join(inbox, `${name}.manifest.json`);
  fs.writeFileSync(file, JSON.stringify({ version: 1, batches: [{ accountId: 'demo-naver', evidenceFile: `evidence/${name}.xlsx`,
    envelope: { sourceType, observedAt: `${year}-11-14T06:24:52+09:00`, observations: [] } }] }));
  return file;
}
function seen(state) {
  const file = path.join(state, 'seen.txt');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(LF).filter(Boolean).map(line => line.split(' ')) : [];
}
function successReceipts(state) {
  const dir = path.join(state, 'receipts');
  return fs.readdirSync(dir).filter(n => /^inbox-[0-9a-f]{40}[.]json$/.test(n)).map(n => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')));
}
function lastSummary(s) {
  const { runId } = JSON.parse(s.logs.at(-1));
  return JSON.parse(fs.readFileSync(path.join(s.state, 'runs', runId, 'run-summary.json'), 'utf8'));
}
const respond = (url, html) => ({ status: 200, url, headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }), body: new Response(html).body });
const fakeFetch = pages => async url => { if (!(url in pages)) throw new Error(`예상 밖 주소 ${url}`); return respond(url, pages[url]); };
const scan = (fetchImpl, limits = FAST) => R.scanTelegram('demo_chan', { fetchImpl, limits, pauseMs: 0 });

test('설정은 카탈로그의 텔레그램 방송 채널만 받고 개인 연락 계정은 거부한다', () => {
  const dir = path.join(os.tmpdir(), 'acct-routine-config');
  const ok = R.validateConfig({ version: 1, telegram: [{ accountId: 'demo-telegram', handle: '@demo_chan' }] }, CATALOG, dir);
  assert.deepEqual(ok, { telegram: [{ accountId: 'demo-telegram', handle: 'demo_chan' }], inbox: path.join(dir, 'inbox') });
  for (const [config, pattern] of [
    [{ version: 1, telegram: [{ accountId: 'demo-telegram', handle: 'other_chan' }] }, /카탈로그/],
    [{ version: 1, telegram: [{ accountId: 'person-telegram', handle: 'person_contact' }] }, /개인 연락/],
    [{ version: 1, telegram: [{ accountId: 'demo-youtube', handle: 'demo_video' }] }, /카탈로그/],
    [{ version: 1, telegram: [{ accountId: 'demo-telegram', handle: 'demo_chan', command: 'x' }] }, /accountId·handle/],
    [{ version: 1, origin: 'https://example.com' }, /모르는 키/],
    [{ version: 1, inbox: '../elsewhere' }, /inbox/],
  ]) assert.throws(() => R.validateConfig(config, CATALOG, dir), pattern);
});

test('쪽 해석: 서비스 글만 건너뛰고, 줄인 조회수·빠진 조회수는 0이 아닌 모름으로 남긴다', async () => {
  const p = await R.parseTelegramPage(page([5, 6, 7, 8], null, { 5: { service: true }, 6: { views: '1.2K' }, 7: { views: null } }), 'demo_chan');
  assert.deepEqual(p.errors, []);
  assert.deepEqual(p.skipped, [5]);
  assert.deepEqual(p.rows.map(r => [r.id, r.views, r.viewsNote]), [[6, null, 'abbreviated'], [7, null, 'missing'], [8, 80, null]]);
  assert.equal(p.rows[2].publishedAt, '2026-11-01T00:00:00.000Z');
  assert.equal(p.before, null);
});

test('쪽 해석: 다른 채널 글과 게시 시각이 없는 글은 오류다', async () => {
  const p = await R.parseTelegramPage(page([1, 2], null, { 1: { ch: 'other_chan' }, 2: { time: null } }), 'demo_chan');
  assert.equal(p.errors.length, 2);
  assert.match(p.errors[0], /다른 채널/);
});

test('끝까지 읽고 쪽 사이에 겹친 글은 한 번만 남긴다', async () => {
  const s = await scan(fakeFetch({ [BASE]: page([10, 11, 12], 10), [`${BASE}?before=10`]: page([8, 9, 10], 8), [`${BASE}?before=8`]: page([7, 8], null) }));
  assert.equal(s.complete, true);
  assert.deepEqual(s.rows.map(r => r.id), [7, 8, 9, 10, 11, 12]);
  assert.deepEqual(s.pages.map(p => p.before), [10, 8, null]);
});

test('쪽 넘김 불일치·경계 밖 글·끝을 못 본 부분 결과·시간 초과·다른 주소는 버린다', async () => {
  await assert.rejects(scan(fakeFetch({ [BASE]: page([10, 11], 9) })), /쪽 넘김/);
  await assert.rejects(scan(fakeFetch({ [BASE]: page([10, 11], 10), [`${BASE}?before=10`]: page([9, 13], null) })), /경계/);
  await assert.rejects(scan(fakeFetch({ [BASE]: page([30], 30), [`${BASE}?before=30`]: page([20], 20), [`${BASE}?before=20`]: page([10], 10) })), /부분 결과/);
  await assert.rejects(scan((url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)))), /timeout/i);
  await assert.rejects(scan(async () => respond('https://example.com/s/demo_chan', page([1], null))), /최종 주소/);
});

test('매니페스트는 증거 하나에 한 묶음(200개까지)만 만들고, 넘치면 거부하며, 조회수를 모르는 글은 넣지 않는다', () => {
  const rows = n => Array.from({ length: n }, (_, i) => ({ id: i + 1, externalId: String(i + 1), url: 'u', publishedAt: 'p', title: null, views: i === 0 ? null : i }));
  const build = n => R.buildManifest({ accountId: 'demo-telegram', handle: 'demo_chan', observedAt: 'o', evidenceFile: 'e.json', rows: rows(n) });
  const m = build(201);
  assert.equal(m.batches.length, 1);
  assert.equal(m.batches[0].evidenceFile, 'e.json');
  assert.equal(m.batches[0].envelope.identity.handle, '@demo_chan');
  assert.deepEqual(m.batches[0].envelope.observations.map(o => o.post.externalId), Array.from({ length: 200 }, (_, i) => String(i + 2)));
  assert.throws(() => build(202), /한 묶음 한도 200개/);
  assert.deepEqual(build(1).batches, []);
});

test('--실행: 새 증거로 제출하고, 하나가 실패해도 다음으로 넘어가며, 잠금은 빼앗지 않는다', async () => {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'acct-routine-'));
  try {
    const inbox = path.join(state, 'inbox');
    fs.mkdirSync(inbox);
    fs.writeFileSync(path.join(state, 'config.json'), JSON.stringify({ version: 1, telegram: [{ accountId: 'demo-telegram', handle: 'demo_chan' }] }));
    for (const name of ['a-good', 'b-bad']) writeOfficial(inbox, name);
    fs.writeFileSync(path.join(inbox, 'note.json'), '{}');
    const ingester = path.join(state, 'fake-ingester.cjs');
    fs.writeFileSync(ingester, "console.log('token=abc123'); process.exit(require('path').basename(process.argv[3]).startsWith('b-') ? 1 : 0);");
    const deps = { stateDir: state, ingester, loadCatalog: async () => CATALOG, fetchImpl: fakeFetch({ [BASE]: page([1, 2], null) }), pauseMs: 0, log: () => {} };
    assert.equal(await R.main([], deps), 0);
    assert.equal(fs.existsSync(path.join(state, 'runs')), false);
    assert.equal(await R.main(['--실행'], deps), 1);
    const [runId] = fs.readdirSync(path.join(state, 'runs'));
    const read = name => JSON.parse(fs.readFileSync(path.join(state, 'runs', runId, name), 'utf8'));
    assert.equal(read('demo-telegram.evidence.json').pagination.complete, true);
    assert.equal(read('demo-telegram.manifest.json').batches[0].envelope.observations.length, 2);
    assert.deepEqual(read('run-summary.json').results.map(r => r.status), ['submitted', 'submitted', 'failed']);
    const receipts = fs.readdirSync(path.join(state, 'receipts'));
    assert.ok(receipts.includes('demo-telegram.last-success.json'));
    assert.equal(receipts.filter(n => /^inbox-[0-9a-f]{40}[.]json$/.test(n)).length, 1);
    assert.equal(receipts.filter(n => n.startsWith('inbox-failed-')).length, 1);
    for (const log of fs.readdirSync(path.join(state, 'logs'))) assert.doesNotMatch(fs.readFileSync(path.join(state, 'logs', log), 'utf8'), /abc123/);
    assert.ok(fs.existsSync(path.join(inbox, 'a-good.manifest.json')));
    fs.mkdirSync(path.join(state, 'runner.lock'));
    assert.equal(await R.main(['--실행'], deps), 3);
    assert.ok(fs.existsSync(path.join(state, 'runner.lock')));
  } finally { fs.rmSync(state, { recursive: true, force: true }); }
});

// 공식 수집기 대역은 불리면 표시 파일(called)을 남긴다. 그 파일이 없으면 제출하지 않은 것이다.
async function runOnce({ pages, limits, inbox = false }) {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'acct-routine-'));
  fs.writeFileSync(path.join(state, 'config.json'), JSON.stringify({ version: 1, telegram: [{ accountId: 'demo-telegram', handle: 'demo_chan' }] }));
  if (inbox) {
    fs.mkdirSync(path.join(state, 'inbox'));
    writeOfficial(path.join(state, 'inbox'), 'a');
  }
  const ingester = path.join(state, 'fake-ingester.cjs');
  fs.writeFileSync(ingester, "require('fs').writeFileSync(require('path').join(__dirname, 'called'), '');");
  const code = await R.main(['--실행'], { stateDir: state, ingester, limits, loadCatalog: async () => CATALOG, fetchImpl: fakeFetch(pages), pauseMs: 0, log: () => {} });
  const [runId] = fs.readdirSync(path.join(state, 'runs'));
  const runDir = path.join(state, 'runs', runId);
  const summary = JSON.parse(fs.readFileSync(path.join(runDir, 'run-summary.json'), 'utf8'));
  return { state, code, summary, runDir, cleanup: () => fs.rmSync(state, { recursive: true, force: true }) };
}

test('한 묶음 한도를 넘으면 제출 전에 실패로 닫고 증거는 남긴다', async () => {
  const r = await runOnce({ pages: { [BASE]: page([1, 2, 3], null) }, limits: { ...R.LIMITS, batch: 2 } });
  try {
    assert.equal(r.code, 1);
    assert.equal(r.summary.results[0].status, 'failed');
    assert.match(r.summary.results[0].error, /한 묶음 한도 2개/);
    assert.ok(fs.existsSync(path.join(r.runDir, 'demo-telegram.evidence.json')));
    assert.equal(fs.existsSync(path.join(r.runDir, 'demo-telegram.manifest.json')), false);
    assert.equal(fs.existsSync(path.join(r.state, 'called')), false);
  } finally { r.cleanup(); }
});

test('예산이 모자라 미룬 제출은 0으로 끝나지 않고 성공 영수증도 쓰지 않는다', async () => {
  const r = await runOnce({ pages: { [BASE]: page([1, 2], null) }, limits: { ...R.LIMITS, budgetMs: 4900 }, inbox: true });
  try {
    assert.equal(r.code, 1);
    assert.deepEqual(r.summary.results.map(x => x.status), ['deferred', 'deferred']);
    assert.equal(r.summary.deferred, 2);
    assert.equal(r.summary.complete, false);
    assert.deepEqual(fs.readdirSync(path.join(r.state, 'receipts')), []);
    assert.equal(fs.existsSync(path.join(r.state, 'called')), false);
    assert.ok(fs.existsSync(path.join(r.state, 'inbox', 'a.manifest.json')));
  } finally { r.cleanup(); }
});

test('글이 없는 공개 채널은 실패가 아니다', async () => {
  const r = await runOnce({ pages: { [BASE]: page([], null) } });
  try {
    assert.equal(r.code, 0);
    assert.equal(r.summary.results[0].status, 'empty');
    assert.equal(fs.existsSync(path.join(r.state, 'called')), false);
  } finally { r.cleanup(); }
});

test('끝 판정: 커서 없는 쪽 넘김 링크·확인 안 된 이전 쪽 링크·같은 글만 다시 준 이전 쪽·빈 200 쪽·다른 채널 표시는 끝으로 보지 않는다', async () => {
  await assert.rejects(scan(fakeFetch({ [BASE]: shell(`<a class="tme_messages_more js-messages_more" href="/s/demo_chan?before=25"></a>${msg(25)}`) })), /쪽 넘김 링크/);
  await assert.rejects(scan(fakeFetch({ [BASE]: shell(`<a href="/s/demo_chan?before=25">older</a>${msg(25)}`) })), /이전 쪽 링크/);
  await assert.rejects(scan(fakeFetch({ [BASE]: page([30], 30).replace('href="/s/demo_chan?before=30"', '') })), /커서/);
  await assert.rejects(scan(fakeFetch({ [BASE]: page([25, 26], 25), [`${BASE}?before=25`]: page([25], null) })), /더 오래된 글/);
  for (const blank of ['<html></html>', '<html><body></body></html>', '<html><body><section class="tgme_channel_history"></section></body></html>'])
    await assert.rejects(scan(fakeFetch({ [BASE]: blank })), /채널 확인|글 목록/);
  await assert.rejects(scan(fakeFetch({ [BASE]: shell(msg(1), 'other_chan') })), /채널 확인/);
  const empty = await scan(fakeFetch({ [BASE]: page([], null) }));
  assert.deepEqual([empty.complete, empty.rows.length, empty.pages.length], [true, 0, 1]);
});

test('실제로 읽은 끝 쪽 꼴: synkmn 17글 2쪽(둘째 쪽에 서비스 글), synklab_uz 1글 1쪽을 끝까지 읽은 것으로 받는다', async () => {
  const real = (handle, ids, before, service = []) => shell((before ? `<a class="tme_messages_more js-messages_more" data-before="${before}" href="/s/${handle}?before=${before}"></a>` : '')
    + ids.map(id => msg(id, { ch: handle, service: service.includes(id) })).join(''), handle);
  const mn = 'https://t.me/s/synkmn', uz = 'https://t.me/s/synklab_uz', first = Array.from({ length: 15 }, (_, i) => i + 5);
  const a = await R.scanTelegram('synkmn', { fetchImpl: fakeFetch({ [mn]: real('synkmn', first, 5), [`${mn}?before=5`]: real('synkmn', [1, 2, 3, 4], null, [1, 2]) }), limits: FAST, pauseMs: 0 });
  assert.deepEqual([a.complete, a.pages.length, a.rows.length, a.skipped], [true, 2, 17, [1, 2]]);
  const b = await R.scanTelegram('synklab_uz', { fetchImpl: fakeFetch({ [uz]: real('synklab_uz', [1], null) }), limits: FAST, pauseMs: 0 });
  assert.deepEqual([b.complete, b.pages.length, b.rows.length], [true, 1, 1]);
});

test('쪽 넘김: data-after 링크는 속성의 커서와 주소가 같은 다음 쪽이어야 하고, 이전 쪽·다른 채널·모르는 경로·다른 커서·섞인 커서·여러 개는 끝으로 보지 않는다', async () => {
  const after = (n, href, extra = '') => `<a class="tme_messages_more js-messages_more" data-after="${n}"${extra} href="${href}"></a>`;
  for (const [link, why] of [[after(25, '/s/demo_chan?before=25'), /다음 쪽 링크 주소/], [after(25, '/s/other_chan?after=25'), /다음 쪽 링크 주소/],
    [after(25, '/demo_chan?after=25'), /다음 쪽 링크 주소/], [after(25, '/s/demo_chan?after=26'), /다음 쪽 링크 주소/],
    [after(25, '/s/demo_chan?after=25', ' data-before="25"'), /하나로 읽을 수 없음/], [after('025', '/s/demo_chan?after=025'), /하나로 읽을 수 없음/],
    [after(25, '/s/demo_chan?after=25') + after(26, '/s/demo_chan?after=26'), /다음 쪽 링크가 여럿/]])
    await assert.rejects(scan(fakeFetch({ [BASE]: shell(msg(25) + link) })), why, link);
  const next = await scan(fakeFetch({ [BASE]: page([30], 30), [`${BASE}?before=30`]: shell(msg(28) + msg(29) + after(29, '/s/demo_chan?after=29')) }));
  assert.deepEqual([next.complete, next.rows.map(r => r.id)], [true, [28, 29, 30]]);
});

test('관측 시각은 공개 쪽을 다 받은 뒤에 정해, 수집 중에 올라온 글보다 앞서지 않는다', async t => {
  const s = setup(t, { version: 1, telegram: [{ accountId: 'demo-telegram', handle: 'demo_chan' }] });
  s.deps.fetchImpl = async url => {
    const posted = new Date(Date.now() + 5).toISOString();
    await new Promise(resolve => setTimeout(resolve, 30));
    return respond(url, page([1], null, { 1: { time: posted } }));
  };
  assert.equal(await R.main(['--실행'], s.deps), 0);
  const runDir = path.join(s.state, 'runs', lastSummary(s).runId);
  const envelope = JSON.parse(fs.readFileSync(path.join(runDir, 'demo-telegram.manifest.json'), 'utf8')).batches[0].envelope;
  const evidence = JSON.parse(fs.readFileSync(path.join(runDir, 'demo-telegram.evidence.json'), 'utf8'));
  assert.ok(Date.parse(envelope.observedAt) >= Date.parse(envelope.observations[0].post.publishedAt));
  assert.ok(Date.parse(evidence.observedAt) >= Date.parse(evidence.pagination.pages.at(-1).fetchedAt));
  assert.equal(envelope.evidenceSha256, sha(fs.readFileSync(path.join(runDir, 'demo-telegram.evidence.json'))), '봉투의 증거 해시는 방금 쓴 증거 바이트의 해시다');
});

// 로그 가림 시험은 합성 비밀(SAMPLE)만 쓴다. 가린 결과의 글 모양을 베끼지 않고, 비밀 조각이 남지 않는지와 진단 칸이 JSON으로 다시 읽히는지를 본다.
const CR = String.fromCharCode(13), BACKSLASH = String.fromCharCode(92);
const LINE_ENDS = [LF, CR, CR + LF, String.fromCharCode(0x2028), String.fromCharCode(0x2029)];
const noSample = (text, label) => assert.equal(String(text).includes('SAMPLE'), false, `${label}: ${String(text).slice(0, 300)}`);

test('로그 가림(JSON): 한 줄과 LF·CR·CRLF 들여쓰기 JSON 모두 민감한 키의 값을 형식과 상관없이 가리고, 진단 칸은 JSON으로 다시 읽힌다', () => {
  const doc = { password: 'SAMPLE-pw', access_token: 'SAMPLE-at', 'x-csrf-token': 'SAMPLE-csrf', synk_company_session: 'SAMPLE-sess',
    authorization: 'Basic SAMPLE-basic', 'set-cookie': ['sid=SAMPLE-cookie'], passwd: '', clientSecret: { inner: 'SAMPLE-obj' }, userPwd: 'SAMPLE-camel',
    apiKey: 9876543, status: 401, ok: false, count: 3, accountId: 'demo-telegram' };
  const secretKeys = ['password', 'access_token', 'x-csrf-token', 'synk_company_session', 'authorization', 'set-cookie', 'passwd', 'clientSecret', 'userPwd', 'apiKey'];
  const compact = JSON.stringify(doc), pretty = JSON.stringify(doc, null, 2);
  const inputs = [compact, ...[LF, CR, CR + LF].map(end => pretty.split(LF).join(end)), compact.replace('"password"', `"${BACKSLASH}u0070assword"`)];
  for (const input of inputs) {
    const label = JSON.stringify(input.slice(0, 24)), clean = R.sanitize(input), parsed = JSON.parse(clean);
    noSample(clean, label);
    assert.equal(clean.includes('9876543'), false, label);
    assert.deepEqual([parsed.status, parsed.ok, parsed.count, parsed.accountId], [401, false, 3, 'demo-telegram'], label);
    for (const key of secretKeys) assert.equal(parsed[key], '[가림]', `${label} ${key}`);
  }
  // GPT 재현: 키와 값이 서로 다른 줄에 놓인 들여쓰기 JSON, 값 안에 자격 꼴 글자가 든 JSON
  for (const end of [LF, CR, CR + LF]) {
    const clean = R.sanitize(['{', '  "password":', '    "SAMPLE-split",', '  "status": 401', '}'].join(end));
    noSample(clean, JSON.stringify(end));
    assert.deepEqual(JSON.parse(clean), { password: '[가림]', status: 401 });
  }
  assert.deepEqual(JSON.parse(R.sanitize(JSON.stringify({ password: 'MyToken=', status: 401 }))), { password: '[가림]', status: 401 });
});

test('로그 가림(JSON): 문자열 안의 줄 끝(U+2028·U+2029 포함), 문자열에 든 JSON과 깨진 JSON, 중복 키에서도 비밀이 남지 않고 바깥 진단 칸은 남는다', () => {
  for (const end of LINE_ENDS) {
    const label = JSON.stringify(end);
    const a = R.sanitize(JSON.stringify({ password: `partA${end}SAMPLE-a`, status: 401 }));
    noSample(a, label);
    assert.deepEqual(JSON.parse(a), { password: '[가림]', status: 401 }, label);
    const b = R.sanitize(JSON.stringify({ err: `err password=partA${end}SAMPLE-b`, status: 401, note: `ok${end}next` }));
    noSample(b, label);
    assert.deepEqual(JSON.parse(b), { err: '[가림]', status: 401, note: `ok${end}next` }, label);
  }
  const nested = JSON.parse(R.sanitize(JSON.stringify({ detail: JSON.stringify({ password: 'SAMPLE-n', innerOk: 1, deeper: JSON.stringify([{ token: 'SAMPLE-d' }, 'ok']) }), status: 502 })));
  const inner = JSON.parse(nested.detail);
  assert.deepEqual([nested.status, inner.password, inner.innerOk, JSON.parse(inner.deeper)], [502, '[가림]', 1, [{ token: '[가림]' }, 'ok']]);
  const broken = R.sanitize(JSON.stringify({ detail: '{"password":"SAMPLE-broken"', status: 502 }));
  noSample(broken, 'broken');
  assert.deepEqual(JSON.parse(broken), { detail: '[가림]', status: 502 });
  const dup = R.sanitize('{"note":"password=SAMPLE-dup","note":"ok","status":401}');
  noSample(dup, 'dup');
  assert.deepEqual(JSON.parse(dup), { note: 'ok', status: 401 });
  const plain = { status: 502, message: 'upstream 3f2a', rows: [1, 2], nested: { ok: true, at: null } };
  assert.deepEqual(JSON.parse(R.sanitize(JSON.stringify(plain))), plain, '자격 꼴이 없는 JSON은 칸과 값이 그대로 다시 읽힌다');
});

test('로그 가림(JSON): __proto__·constructor 키는 프로토타입을 바꾸지 않고 그 안쪽도 가리며, 비밀을 품은 키는 기록 전체를 가린다', () => {
  const clean = R.sanitize('{"__proto__":{"polluted":"yes","token":"SAMPLE-proto"},"constructor":{"prototype":{"polluted":"yes"}},"status":1}');
  assert.equal(({}).polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
  noSample(clean, 'proto');
  const parsed = JSON.parse(clean);
  assert.equal(parsed.status, 1);
  assert.deepEqual(Object.getOwnPropertyDescriptor(parsed, '__proto__').value, { polluted: 'yes', token: '[가림]' });
  const keyed = [{ 'password=SAMPLE-k': 1, status: 401 }, { 'Bearer SAMPLE-k': 1 }, { 'https://user:SAMPLE-k@example.com': 1 },
    { 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.SAMPLE-k': 1 }, { ok: { '%70assword=SAMPLE-k': 1 } }, { detail: JSON.stringify({ 'token=SAMPLE-k': 1 }), status: 1 }];
  for (const input of [...keyed.map(o => JSON.stringify(o)), `[{"tok${BACKSLASH}u0065n:SAMPLE-k":1}]`]) assert.equal(R.sanitize(input), '[가림]', input);
});

test('로그 가림(JSON 아님): 자격 표식이 있으면 줄 끝·따옴표·홀수 역슬래시·이스케이프 표기와 상관없이 줄바꿈까지 기록 전체를 가린다', () => {
  const fixed = ['password=Password= status=401', 'password=SAMPLE', 'secret="unclosed SAMPLE', "secret='two words SAMPLE", 'Authorization: Basic SAMPLE',
    'Bearer SAMPLE', 'Cookie: LANG=en; SID=SAMPLE', 'jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.SAMPLE', 'https://user:SAMPLE@example.com/x', 'redis://:SAMPLE@localhost:6379',
    `{"${BACKSLASH}u0070assword":"SAMPLE"`, '%70assword=SAMPLE', `${BACKSLASH}x70assword=SAMPLE`, '%255Cu0070assword=SAMPLE', 'DB_PASS=SAMPLE', 'userPwd=SAMPLE'];
  const matrix = [];
  for (const end of LINE_ENDS) for (const q of ['"', "'"]) for (const tail of ['', BACKSLASH, BACKSLASH.repeat(3)]) {
    matrix.push(`secret=${q}abc${tail}${end}password=${q}SAMPLE${q}${end}ok=1`, `ok=1${end}token=${q}SAMPLE${tail}${end}evidence 3f2a ok`,
      `{${q}password${q}:${end}${q}SAMPLE${q}`, `Authorization: Bearer SAMPLE${tail}${end}ok=1`);
  }
  for (const input of [...fixed, ...matrix]) assert.equal(R.sanitize(input), '[가림]', JSON.stringify(input));
});

test('로그 가림: 자격 표식이 없는 일반 진단(한국어 오류·경로·공개 주소·여러 줄)은 그대로 남는다', () => {
  for (const text of ['evidence 3f2a ok', 'https://t.me/s/demo_chan: 채널 확인 표시가 @demo_chan 하나가 아님', 'https://t.me/s/demo_chan?before=30: HTTP 500',
    `C:${BACKSLASH}Users${BACKSLASH}abcd${BACKSLASH}tools${BACKSLASH}계정통계루틴.cjs`, 'ENOSPC: 디스크 공간 없음', '공식 내보내기(official-export) 묶음만 받음',
    `수집기 종료 1${LF}다음 줄 진단${String.fromCharCode(0x2028)}끝`, '3 passed, 0 failed, bypass basically'])
    assert.equal(R.sanitize(text), text, text);
});

test('로그 가림: 크기·깊이·노드 수 한도를 넘거나 문자열로 바꿀 수 없으면 일부를 남기지 않고 전체를 가린다', () => {
  const { bytes, depth, nodes } = R.LOG_LIMITS;
  assert.equal(R.sanitize('evidence ok '.repeat(Math.ceil(bytes / 12) + 1)), '[가림]');
  assert.equal(R.sanitize('가'.repeat(Math.floor(bytes / 3) + 1)), '[가림]', '글자 수가 아니라 UTF-8 바이트로 잰다');
  assert.equal(R.sanitize(JSON.stringify({ status: 1, big: 'x'.repeat(bytes) })), '[가림]');
  const arrays = (n, leaf) => `${'['.repeat(n)}${leaf}${']'.repeat(n)}`;
  const inString = k => { let v = 0; for (let i = 0; i < k; i++) v = JSON.stringify([v]); return JSON.stringify(v); };
  assert.notEqual(R.sanitize(arrays(depth - 4, '0')), '[가림]');
  assert.notEqual(R.sanitize(inString(3)), '[가림]');
  assert.equal(R.sanitize(arrays(depth - 4, inString(3))), '[가림]', '문자열 안 JSON의 깊이도 바깥 깊이와 합쳐 센다');
  assert.equal(R.sanitize(arrays(depth * 4, '0')), '[가림]');
  assert.notEqual(R.sanitize(JSON.stringify(Array(nodes - 10).fill(0))), '[가림]');
  assert.equal(R.sanitize(JSON.stringify(Array(nodes + 10).fill(0))), '[가림]');
  for (const odd of [Object.create(null), { toString() { throw new Error('SAMPLE'); } }]) assert.equal(R.sanitize(odd), '[가림]');
});

// 11-15 Carbon 검수 재현: JSON 한 글자 이스케이프 뒤에 숨은 표식(NDJSON·머리말 붙은 JSON·깨진 내부 JSON)과 대문자 약어 낱말. 비밀은 합성 값(SAMPLE)만 쓴다.
test('로그 가림(JSON 아님): 한 글자 이스케이프(줄바꿈·탭·빗금 등) 바로 뒤에 붙은 표식과 빗금을 이스케이프한 주소도 찾고, 표식 없는 이스케이프 글은 남긴다', () => {
  const E = BACKSLASH;
  const vectors = { 'ndjson-bearer': `{"ok":1}${LF}{"err":"HTTP 401${E}r${E}nbearer SAMPLE"}`, 'ndjson-pwd': `{"ok":1}${LF}{"err":"fail${E}npwd=SAMPLE"}`,
    'escaped-url': `{"ok":1}${LF}{"url":"https:${E}/${E}/user:SAMPLE@example.com"}`, 'error-prefix-json': `업로드 실패: {"detail":"fail${E}tpass=SAMPLE"}`,
    'backspace-sig': `{"ok":1}${LF}{"err":"x${E}bsig=SAMPLE"}`, 'formfeed-auth': `{"ok":1}${LF}{"err":"x${E}fauth=SAMPLE"}`,
    'actual-newline': `fail${LF}pwd=SAMPLE`, 'literal-newline': `fail${E}npwd=SAMPLE` };
  for (const [name, input] of Object.entries(vectors)) assert.equal(R.sanitize(input), '[가림]', name);
  const broken = R.sanitize(JSON.stringify({ detail: `{"url":"https:${E}/${E}/user:SAMPLE@example.com`, status: 502 }));
  noSample(broken, 'broken-inner-json');
  assert.deepEqual(JSON.parse(broken), { detail: '[가림]', status: 502 });
  for (const text of [`line1${E}nline2${E}tdone 3f2a`, `https:${E}/${E}/t.me${E}/s${E}/demo_chan: HTTP 500`, `C:${E}${E}new${E}${E}tools${E}${E}report.json`])
    assert.equal(R.sanitize(text), text, text);
});

test('로그 가림: 역슬래시 짝수·홀수와 여러 겹 이스케이프를 한 겹씩 풀어 찾고, 풀기 한도까지 풀어도 계속 바뀌는 글은 통째로 가린다', () => {
  const { decodeRounds } = R.LOG_LIMITS, E = BACKSLASH;
  for (let n = 1; n <= 2 ** decodeRounds + 1; n++) {
    assert.equal(R.sanitize(`fail${E.repeat(n)}npwd=SAMPLE`), '[가림]', `n ${n}`);
    assert.equal(R.sanitize(`https:${`${E.repeat(n)}/`.repeat(2)}user:SAMPLE@example.com`), '[가림]', `/ ${n}`);
  }
  // 한 겹마다 역슬래시를 먼저 두 배로 하고 빗금·CR·LF를 이스케이프한다. 한도 안의 겹은 풀어서 찾고, 한도를 넘는 겹은 끝까지 바뀌므로 가린다.
  const layer = s => s.split(E).join(E + E).split('/').join(`${E}/`).split(CR).join(`${E}r`).split(LF).join(`${E}n`);
  for (const carrier of ['https://user:SAMPLE@example.com/x', `HTTP 401${CR}${LF}bearer SAMPLE`, `fail${LF}pwd=SAMPLE`]) {
    let text = carrier;
    for (let level = 0; level <= decodeRounds + 2; level++, text = layer(text)) assert.equal(R.sanitize(text), '[가림]', `${JSON.stringify(carrier)} ${level}`);
  }
  const plain = n => `evidence${E.repeat(n)} 3f2a ok`;
  assert.equal(R.sanitize(plain(2 ** decodeRounds)), plain(2 ** decodeRounds), '한도 안에서 더 바뀌지 않는 보통 글은 남긴다');
  assert.equal(R.sanitize(plain(2 ** (decodeRounds + 1))), '[가림]', '한도까지 풀어도 계속 바뀌는 글은 가린다');
});

test('로그 가림: 대문자 약어 뒤에 붙은 짧은 자격 낱말(DBPass·HTTPAuth·APIPwd·HMACSig)도 나눠 가리고, OAuth처럼 대문자 한 글자 앞머리는 그대로 둔다', () => {
  const clean = R.sanitize(JSON.stringify({ DBPass: 'SAMPLE', HTTPAuth: 'SAMPLE', APIPwd: 'SAMPLE', HMACSig: 'SAMPLE', status: 401 }));
  noSample(clean, 'acronym');
  assert.deepEqual(JSON.parse(clean), { DBPass: '[가림]', HTTPAuth: '[가림]', APIPwd: '[가림]', HMACSig: '[가림]', status: 401 });
  for (const input of ['DBPass=SAMPLE', 'getHTTPAuth SAMPLE', 'myAPIPwd: SAMPLE']) assert.equal(R.sanitize(input), '[가림]', input);
  for (const text of ['OAuth 연결 확인 3f2a', 'IPAddress 10.0.0.1 HTTPServer ok']) assert.equal(R.sanitize(text), text, text);
});

// 11-15 재현: 바깥 JSON 이스케이프(빗금)와 안쪽 주소 퍼센트 인코딩(%40·%2F·%20)이 섞인 사용자 정보. %HH는 풀지 않고 보이기만 하면 그 글을 가린다.
test('로그 가림: 퍼센트 바이트 이스케이프(%HH)는 풀지 않고, 원문이나 역슬래시를 푼 단계에서 보이면 그 글 전체를 가린다', () => {
  const E = BACKSLASH, slash = `${E}/${E}/`;
  const vectors = { 'encoded-user': `{"ok":1}${LF}{"url":"https:${slash}bot%40corp.com:SAMPLE@example.com"}`,
    'encoded-password-slash': `{"ok":1}${LF}{"url":"https:${slash}user:S%2FAMPLE@example.com"}`,
    'encoded-password-space': `업로드 실패: {"url":"https:${slash}user:S%20AMPLE@example.com"}`,
    'encoded-password-at': `{"ok":1}${LF}{"url":"https:${slash}user:%40SAMPLE@example.com"}`,
    'double-escaped-slash': `{"ok":1}${LF}{"url":"https:${E}${E}/${E}${E}/bot%40corp.com:SAMPLE@example.com"}`,
    'encoded-separators': 'https%3A%2F%2Fuser%3ASAMPLE%40example.com', 'after-unicode-escape': `user id bot${E}u002540corp.com SAMPLE`,
    'after-hex-escape': `user id bot${E}x2540corp.com SAMPLE`, 'after-escaped-backslash': `user id bot${E}${E}u002540corp.com SAMPLE`,
    'encoded-percent': 'user id bot%252540corp.com SAMPLE' };
  for (const [name, input] of Object.entries(vectors)) assert.equal(R.sanitize(input), '[가림]', name);
  const broken = R.sanitize(JSON.stringify({ detail: `{"url":"https:${slash}bot%40corp.com:SAMPLE@example.com`, status: 502, count: 3 }));
  noSample(broken, 'broken-json');
  assert.deepEqual(JSON.parse(broken), { detail: '[가림]', status: 502, count: 3 });
  const valid = R.sanitize(JSON.stringify({ status: 401, count: 2, ok: false, url: 'https://bot%40corp.com:SAMPLE@example.com/x', note: 'name%2Fpart', message: '진행 95% 완료' }));
  noSample(valid, 'valid-json');
  assert.deepEqual(JSON.parse(valid), { status: 401, count: 2, ok: false, url: '[가림]', note: '[가림]', message: '진행 95% 완료' });
  assert.equal(R.sanitize('https://t.me/s/demo_chan?q=%EA%B0%80: HTTP 500'), '[가림]', '퍼센트 인코딩이 든 진단 주소도 함께 가리는 손실을 받아들인다');
  for (const text of ['CPU 95% 사용, 100% 완료', '진행률 50%', 'rate 7%, done 3f2a', '%g1 그대로', `C:${E}Users${E}abcd 100%`])
    assert.equal(R.sanitize(text), text, text);
});

// 수집기 대역: 정한 바이트를 정한 갈래(stdout·stderr)에 차례로 쓰고, 쓸 때마다 잠시 쉬어 부모가 따로 된 청크로 받게 한다.
function stagedIngester(file, steps) {
  const plan = steps.map(([name, data]) => [name, Buffer.from(data).toString('base64')]);
  fs.writeFileSync(file, [`const plan = ${JSON.stringify(plan)};`,
    "const next = i => { if (i < plan.length) process[plan[i][0]].write(Buffer.from(plan[i][1], 'base64'), () => setTimeout(next, 80, i + 1)); };",
    'next(0);'].join(LF));
}
function onlyLog(s) {
  const names = fs.readdirSync(path.join(s.state, 'logs'));
  assert.equal(names.length, 1, names.join(', '));
  return fs.readFileSync(path.join(s.state, 'logs', names[0]), 'utf8');
}

test('수집기 출력: 갈래마다 바이트로 모아 한 번에 풀고 가리므로 청크에 나뉜 자격 낱말·JSON 비밀·한글 바이트가 새지 않고, 진단 칸과 종료 코드는 남는다', async t => {
  const s = setup(t), hangul = Buffer.from('진단');
  writeOfficial(s.inbox, 'naver');
  stagedIngester(s.deps.ingester, [['stdout', '{"password":"SAM'], ['stderr', 'pass'], ['stdout', Buffer.concat([Buffer.from('PLE-json","note":"'), hangul.subarray(0, 2)])],
    ['stderr', 'word=SAMPLE-split'], ['stdout', Buffer.concat([hangul.subarray(2), Buffer.from(`","status":401}${LF}`)])]]);
  assert.equal(await R.main(['--실행'], s.deps), 0);
  const log = onlyLog(s);
  for (const piece of ['SAM', 'PLE-json', 'word=', String.fromCharCode(0xfffd)]) assert.equal(log.includes(piece), false, `${JSON.stringify(piece)}: ${log}`);
  assert.deepEqual(JSON.parse(log.slice(log.indexOf('{'), log.lastIndexOf('}') + 1)), { password: '[가림]', note: '진단', status: 401 });
  assert.match(log, /종료 0/);
});

test('수집기 출력: 한 갈래가 크기 한도를 넘으면 앞부분을 잘라 남기지 않고 그 갈래 전체를 가리며, 다른 갈래와 종료 코드는 남긴다', async t => {
  const s = setup(t);
  writeOfficial(s.inbox, 'naver');
  fs.writeFileSync(s.deps.ingester, `process.stdout.write('evidence ok '.repeat(${Math.ceil(R.LOG_LIMITS.bytes / 12) + 100}) + 'password=SAMPLE-over', () => process.stderr.write('끝 진단 3f2a'));`);
  assert.equal(await R.main(['--실행'], s.deps), 0);
  const log = onlyLog(s);
  noSample(log, 'overflow');
  assert.equal(log.includes('evidence ok'), false, '넘친 갈래는 앞부분도 남기지 않는다');
  assert.ok(log.includes('끝 진단 3f2a'), log.slice(0, 300));
  assert.match(log, /종료 0/);
});

test('설정 오류와 미리 보기의 수신함 오류도 같은 가림을 거치고, 길이는 가린 뒤에 자른다', async t => {
  const s = setup(t);
  fs.writeFileSync(path.join(s.state, 'config.json'), JSON.stringify({ version: 1, telegram: [{ accountId: 'SAMPLE-config password=x', handle: 'demo_chan' }] }));
  assert.equal(await R.main([], s.deps), 2);
  assert.match(s.logs.at(-1), /^설정 오류: /);
  noSample(s.logs.at(-1), 'config');
  fs.writeFileSync(path.join(s.state, 'config.json'), JSON.stringify({ version: 1 }));
  fs.writeFileSync(path.join(s.inbox, 'odd.manifest.json'), JSON.stringify({ version: 1, batches: [{ accountId: 'demo-naver',
    evidenceFile: `../SAMPLE-${'x'.repeat(200)}-token`, envelope: { sourceType: 'official-export', observations: [] } }] }));
  assert.equal(await R.main([], s.deps), 0);
  noSample(s.logs.at(-1), 'preview');
  assert.deepEqual(JSON.parse(s.logs.at(-1)).수신함.map(i => [i.name, i.status]), [['odd.manifest.json', 'invalid']]);
});

test('이름·크기·수정 시각이 같아도 매니페스트나 증거 바이트가 바뀌면 다시 내고, 그대로면 다시 내지 않는다', async t => {
  const s = setup(t), file = writeOfficial(s.inbox, 'naver');
  fs.utimesSync(file, 1700000000, 1700000000);
  assert.equal(await R.main(['--실행'], s.deps), 0);
  assert.equal(await R.main(['--실행'], s.deps), 0);
  assert.equal(seen(s.state).length, 1, '그대로인 파일은 다시 내지 않는다');
  const size = fs.statSync(file).size;
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('2025-11-14', '2026-11-14'));
  fs.utimesSync(file, 1700000000, 1700000000);
  assert.equal(fs.statSync(file).size, size);
  assert.equal(await R.main(['--실행'], s.deps), 0);
  fs.writeFileSync(path.join(s.inbox, 'evidence', 'naver.xlsx'), 'xlsx bytes of navex');
  assert.equal(await R.main(['--실행'], s.deps), 0);
  assert.deepEqual(seen(s.state).map(([name]) => name), Array(3).fill('naver.manifest.json'));
  assert.equal(successReceipts(s.state).length, 3);
});

test('수신함 제출본은 목록 때 읽은 바이트로 고정하고, 그 사이 바뀐 파일은 미뤘다가 다음 회차에 새 내용으로 낸다', async t => {
  const s = setup(t);
  const a = writeOfficial(s.inbox, 'a-first'), b = writeOfficial(s.inbox, 'b-second');
  const oldText = fs.readFileSync(b, 'utf8'), newText = oldText.replace('2025-11-14', '2026-11-14');
  fs.writeFileSync(path.join(s.state, 'hook.cjs'), `module.exports = m => { if (require('path').basename(m).startsWith('a-')) require('fs').writeFileSync(${JSON.stringify(b)}, ${JSON.stringify(newText)}); };`);
  assert.equal(await R.main(['--실행'], s.deps), 1);
  assert.deepEqual(lastSummary(s).results.map(r => [r.name, r.status]), [['a-first.manifest.json', 'submitted'], ['b-second.manifest.json', 'deferred']]);
  fs.rmSync(path.join(s.state, 'hook.cjs'));
  assert.equal(await R.main(['--실행'], s.deps), 0);
  const read = seen(s.state);
  assert.deepEqual(read, [['a-first.manifest.json', sha(fs.readFileSync(a))], ['b-second.manifest.json', sha(newText)]]);
  for (const receipt of successReceipts(s.state)) assert.ok(read.some(([name, hash]) => name === receipt.name && hash === receipt.manifestSha256), receipt.name);
  assert.equal(successReceipts(s.state).some(receipt => receipt.manifestSha256 === sha(oldText)), false);
});

test('한도 밖에 남은 정상 매니페스트가 있으면 미완료(종료 1)로 남기고 다음 회차가 이어서 낸다', async t => {
  const s = setup(t);
  s.deps.limits = { ...R.LIMITS, inboxFiles: 2 };
  for (const name of ['a', 'b', 'c']) writeOfficial(s.inbox, name);
  assert.equal(await R.main(['--실행'], s.deps), 1);
  const first = lastSummary(s);
  assert.deepEqual([first.complete, first.deferred, first.inboxMore, seen(s.state).length], [false, 1, 1, 2]);
  assert.equal(await R.main(['--실행'], s.deps), 0);
  assert.deepEqual([lastSummary(s).complete, seen(s.state).length, successReceipts(s.state).length], [true, 3, 3]);
});

test('잘못된 파일은 제출 자리를 차지하지 않고, 거듭 실패한 항목은 뒤로 밀려 다른 정상 파일이 차례를 얻는다', async t => {
  const s = setup(t);
  s.deps.limits = { ...R.LIMITS, inboxFiles: 1 };
  for (const name of ['a1', 'a2', 'a3']) fs.writeFileSync(path.join(s.inbox, `${name}.manifest.json`), '{not json');
  writeOfficial(s.inbox, 'fail-first');
  writeOfficial(s.inbox, 'z-good');
  assert.equal(await R.main(['--실행'], s.deps), 1);
  assert.deepEqual(seen(s.state).map(([name]) => name), ['fail-first.manifest.json']);
  assert.equal(await R.main(['--실행'], s.deps), 1);
  assert.deepEqual(seen(s.state).map(([name]) => name), ['fail-first.manifest.json', 'z-good.manifest.json']);
  assert.equal(fs.readdirSync(path.join(s.state, 'receipts')).filter(n => n.startsWith('inbox-failed-')).length, 1);
});

test('수신함은 공식 내보내기 매니페스트만 내고 공개 화면 매니페스트는 내지 않는다', async t => {
  const s = setup(t);
  writeOfficial(s.inbox, 'page', '2025', 'public-page');
  writeOfficial(s.inbox, 'export');
  assert.equal(await R.main(['--실행'], s.deps), 1);
  assert.deepEqual(seen(s.state).map(([name]) => name), ['export.manifest.json']);
  assert.match(lastSummary(s).results.find(r => r.name === 'page.manifest.json').error, /official-export/);
});

test('수신함 자체나 그 아래 증거가 연결(정션·심볼릭 링크)로 상태 폴더 밖을 가리키면 읽지도 내지도 않는다', async t => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'acct-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  writeOfficial(outside, 'outside');
  const s = setup(t);
  fs.rmSync(s.inbox, { recursive: true });
  try { fs.symlinkSync(outside, s.inbox, 'junction'); } catch { t.skip('연결 폴더를 만들 수 없는 환경'); return; }
  const listed = R.listInbox(s.inbox, s.state);
  assert.deepEqual(listed.items, []);
  assert.match(String(listed.error), /연결|밖/);
  assert.equal(await R.main(['--실행'], s.deps), 1);
  assert.equal(seen(s.state).length, 0);
  assert.ok(fs.existsSync(path.join(outside, 'outside.manifest.json')));
  const s2 = setup(t);
  fs.symlinkSync(path.join(outside, 'evidence'), path.join(s2.inbox, 'evidence'), 'junction');
  fs.writeFileSync(path.join(s2.inbox, 'leak.manifest.json'), JSON.stringify({ version: 1, batches: [{ accountId: 'demo-naver', evidenceFile: 'evidence/outside.xlsx',
    envelope: { sourceType: 'official-export', observedAt: '2025-11-14T06:24:52+09:00', observations: [] } }] }));
  const leaked = R.listInbox(s2.inbox, s2.state);
  assert.deepEqual(leaked.items.map(i => [i.name, i.status]), [['leak.manifest.json', 'invalid']]);
  assert.match(leaked.items[0].error, /연결|밖/);
});

test('목록을 읽은 직후 사라진 파일은 건너뛰고 나머지를 계속 낸다', async t => {
  const s = setup(t), original = fs.readdirSync;
  for (const name of ['a', 'b', 'c']) writeOfficial(s.inbox, name);
  let removed = false;
  fs.readdirSync = function (dir, options) {
    const list = original.call(fs, dir, options);
    if (!removed && options && options.withFileTypes && path.resolve(String(dir)) === fs.realpathSync(s.inbox)) { removed = true; fs.rmSync(path.join(s.inbox, 'b.manifest.json')); }
    return list;
  };
  try { assert.equal(await R.main(['--실행'], s.deps), 0); } finally { fs.readdirSync = original; }
  assert.deepEqual(seen(s.state).map(([name]) => name), ['a.manifest.json', 'c.manifest.json']);
  assert.equal(lastSummary(s).inboxVanished, 1);
});

test('잠금 주인 파일을 못 쓰면 방금 만든 잠금을 치우고 오류로 끝내 다음 회차를 막지 않는다', async t => {
  const s = setup(t), original = fs.writeFileSync, owner = path.join('runner.lock', 'owner.json');
  fs.writeFileSync = function (file, ...rest) {
    if (String(file).endsWith(owner)) throw Object.assign(new Error('ENOSPC: 디스크 공간 없음'), { code: 'ENOSPC' });
    return original.call(fs, file, ...rest);
  };
  try { await assert.rejects(R.main(['--실행'], s.deps), /ENOSPC/); } finally { fs.writeFileSync = original; }
  assert.equal(fs.existsSync(path.join(s.state, 'runner.lock')), false);
  assert.equal(await R.main(['--실행'], s.deps), 0);
});

// 11-14 GPT D 검수 재현: 수집기 끝 코드 4(GD4) · 예약 설치의 작업 소유 확인(GD5) · 예약 입구의 시작 실패 기록(GD7). 실제 작업 등록·삭제나 node 실행은 하지 않는다.
test('수집기가 끝 코드 4(올린 뒤 로그아웃 실패)로 끝나면 성공으로 적지 않고 까닭을 남기며 다음 회차가 다시 낸다', async t => {
  const s = setup(t);
  writeOfficial(s.inbox, 'naver');
  fs.writeFileSync(s.deps.ingester, 'process.exit(4);');
  assert.equal(await R.main(['--실행'], s.deps), 1);
  const first = lastSummary(s);
  assert.deepEqual([first.complete, first.results[0].status], [false, 'failed']);
  assert.match(first.results[0].error, /종료 4 [(]올린 뒤 로그아웃 실패/);
  assert.equal(successReceipts(s.state).length, 0);
  fakeIngester(s.state);
  assert.equal(await R.main(['--실행'], s.deps), 0);
  assert.equal(successReceipts(s.state).length, 1);
});

test('runs가 연결(정션)로 상태 폴더 밖을 가리키면 수신함 원본 사본·증거를 쓰기 전에 멈추고 밖에는 아무것도 만들지 않는다', async t => {
  const s = setup(t), outside = fs.mkdtempSync(path.join(os.tmpdir(), 'acct-public-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  writeOfficial(s.inbox, 'naver');
  try { fs.symlinkSync(outside, path.join(s.state, 'runs'), 'junction'); } catch { t.skip('연결 폴더를 만들 수 없는 환경'); return; }
  await assert.rejects(R.main(['--실행'], s.deps), /연결/);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.deepEqual(seen(s.state), []);
  assert.equal(fs.existsSync(path.join(s.state, 'runner.lock')), false);
});

const WINDOWS_ONLY = process.platform !== 'win32' && 'Windows 전용';
const PS51 = path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
test('예약 설치: 뿌리 작업 폴더의 같은 이름·같은 런처라도 관리 표식·실행 계정 SID·작업 폴더·실행 위치가 다르면 내 작업으로 보지 않는다(가짜 작업 객체로 읽기만)', { skip: WINDOWS_ONLY }, () => {
  const script = path.join(__dirname, '..', 'tools', '계정통계예약', 'install-task.ps1'), raw = fs.readFileSync(script, 'utf8'), text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  assert.equal([...text].some(ch => ch.charCodeAt(0) > 127), false, 'Windows PowerShell 5.1은 BOM 없는 파일을 ANSI로 읽으므로 ASCII만 쓴다');
  for (const call of ['@(Get-ScheduledTask -TaskPath $TaskFolder -TaskName $TaskName ', '{ Unregister-ScheduledTask -TaskPath $TaskFolder -TaskName $TaskName ', 'Register-ScheduledTask -TaskPath $TaskFolder -TaskName $TaskName -InputObject'])
    assert.ok(text.includes(call), call);
  assert.equal(/ScheduledTask -TaskName/.test(text), false, '뿌리 작업 폴더 없이 이름만으로 찾거나 바꾸지 않는다');
  const command = `. '${script.replace(/'/g, "''")}'
$me = [Security.Principal.WindowsIdentity]::GetCurrent()
$exe = 'C:/py/pythonw.exe'; $arg = '-X utf8 -B run-hidden.py'; $wd = 'C:/ops'; $name = 'SYNK account metrics routine'; $mark = 'SYNK account metrics routine. ' + $Marker
function Fake($Folder, $Text, $UserId, $List) { [pscustomobject]@{ TaskPath = $Folder; TaskName = $name; Description = $Text; Principal = [pscustomobject]@{ UserId = $UserId }; Actions = $List } }
$act = [pscustomobject]@{ Execute = $exe; Arguments = $arg; WorkingDirectory = $wd }
$cases = [ordered]@{
  owned = Fake $TaskFolder $mark $me.Name @($act)
  bySid = Fake $TaskFolder $mark $me.User.Value @($act)
  otherAccount = Fake $TaskFolder $mark 'S-1-5-18' @($act)
  noUser = Fake $TaskFolder $mark '' @($act)
  noMarker = Fake $TaskFolder 'SYNK account metrics routine.' $me.Name @($act)
  otherFolder = Fake '/Other/' $mark $me.Name @($act)
  otherDirectory = Fake $TaskFolder $mark $me.Name @([pscustomobject]@{ Execute = $exe; Arguments = $arg; WorkingDirectory = 'C:/elsewhere' })
  twoActions = Fake $TaskFolder $mark $me.Name @($act, $act)
}
$out = [ordered]@{}
foreach ($key in $cases.Keys) { $out[$key] = Get-TaskOwnership -Task $cases[$key] -Name $name -Execute $exe -Arguments $arg -WorkingDirectory $wd -UserSid $me.User.Value }
$out['folder'] = [string]$TaskFolder
$out | ConvertTo-Json -Compress`;
  const r = spawnSync(PS51, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(command, 'utf16le').toString('base64')], { encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout.trim()), { owned: 'owned', bySid: 'owned', otherAccount: 'other-account', noUser: 'other-account', noMarker: 'no-marker',
    otherFolder: 'other-folder-or-name', otherDirectory: 'other-action', twoActions: 'other-action', folder: String.fromCharCode(92) });
});

function findPython() {
  const local = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Python', 'pythoncore-3.14-64', 'python.exe');
  for (const command of [local, 'python', 'py'].filter(Boolean)) {
    const r = spawnSync(command, ['-c', 'import sys; print(sys.version_info[0])'], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
    if (r.status === 0 && r.stdout.trim() === '3') return command;
  }
  return null;
}
// 예약 입구를 모듈로 불러 subprocess.run만 바꿔 끼운다(node·루틴을 실제로 띄우지 않음).
const HIDDEN_DRIVER = `import importlib.util, pathlib, subprocess, sys
spec = importlib.util.spec_from_file_location('run_hidden', sys.argv[1])
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
m.LOG, m.NODE, m.ROUTINE = pathlib.Path(sys.argv[2]), pathlib.Path(sys.executable), pathlib.Path(sys.argv[1])
class Done:
    returncode, stdout, stderr = 0, b'routine ok', b''
def start_fails(*args, **kwargs):
    raise PermissionError(13, 'access denied (synthetic)')
subprocess.run = start_fails if sys.argv[3] == 'oserror' else (lambda *args, **kwargs: Done())
sys.exit(m.main())
`;
test('예약 입구: node를 띄우지 못한 OSError도 이번 회차 시각과 원인을 남기고 0이 아닌 코드로 끝내며, 보통 끝에도 회차 시각을 적는다', { skip: WINDOWS_ONLY }, t => {
  const python = findPython();
  if (!python) { t.skip('python 3을 찾지 못함'); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acct-hidden-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const driver = path.join(dir, 'driver.py'), log = path.join(dir, 'logs', '예약실행.log'), script = path.join(__dirname, '..', 'tools', '계정통계예약', 'run-hidden.py');
  fs.writeFileSync(driver, HIDDEN_DRIVER);
  const go = mode => spawnSync(python, ['-X', 'utf8', '-B', '-I', driver, script, log, mode], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
  const failed = go('oserror');
  assert.equal(failed.status, 2, failed.stderr);
  const text = fs.readFileSync(log, 'utf8');
  assert.match(text, /^--- 회차 [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2} ---/);
  assert.match(text, /PermissionError: .*access denied [(]synthetic[)]/);
  assert.match(text, /--- 시작 못 함 · 종료 2 · [0-9]{4}-/);
  const done = go('ok');
  assert.equal(done.status, 0, done.stderr);
  const ok = fs.readFileSync(log, 'utf8');
  assert.match(ok, /^--- 회차 [0-9]{4}-/);
  assert.match(ok, /routine ok/);
  assert.match(ok, /--- 종료 0 · [0-9]{4}-/);
});
