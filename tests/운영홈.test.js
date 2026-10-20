'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const {
  section, inside, readDocument, trackItems, state,
  createServer, saveRuntime, runtime, cacheDirectory,
} = require('../tools/운영홈.js');

// Every company document below is synthetic and lives in a unique temporary tree.
function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ops-fixture-'));
  const root = path.join(base, 'SYNK-appsscript');
  fs.mkdirSync(root);
  const put = (name, content) => {
    const file = path.resolve(root, name);
    const relative = path.relative(base, file);
    assert.ok(relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, content, 'utf8');
    return file;
  };
  t.after(() => {
    const cache = cacheDirectory(root);
    const expectedCacheParent = path.join(os.tmpdir(), 'synk-operations-home');
    assert.equal(path.dirname(cache), expectedCacheParent);
    assert.equal(path.dirname(base), os.tmpdir());
    assert.ok(path.basename(base).startsWith('synk-ops-fixture-'));
    fs.rmSync(cache, {recursive: true, force: true});
    fs.rmSync(base, {recursive: true, force: true});
  });
  return {base, root, put};
}

function request(port, requestPath, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1', port, path: requestPath,
      method: options.method || 'GET',
      headers: {host: '127.0.0.1:' + port, ...options.headers},
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let body;
        try { body = JSON.parse(text); } catch { body = text; }
        resolve({status: res.statusCode, headers: res.headers, body, text});
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function serve(t, root) {
  const server = createServer({root, port: 0});
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  return server.address().port;
}

test('정확한 회사 절만 고르고 그 아래 비전과 서브텍스트를 함께 보존한다', () => {
  const source = '# 비전\r\n## SYNK LAB\r\nLAB 문장\r\n## SYNK\r\n### 전면 비전\r\n공식 문장\r\n### 서브텍스트\r\n부연 설명\r\n## SYNK SHIFT\r\nSHIFT 문장';
  const selected = section(source, 'SYNK');
  assert.match(selected, /공식 문장/);
  assert.match(selected, /부연 설명/);
  assert.doesNotMatch(selected, /LAB 문장|SHIFT 문장/);
  assert.throws(() => section(source, 'SYNK PULSE'));
});

test('문서 예제 코드에 든 제목을 실제 절 경계로 오인하지 않는다', () => {
  for (const fence of ['```', '~~~']) {
    const source = '# 원문\n## 선택한 절\n본문\n' + fence + 'md\n## 이것은 예제의 제목\n' + fence + '\n코드 뒤 설명\n## 다음 절\n다음 내용';
    const selected = section(source, '선택한 절');
    assert.match(selected, /코드 뒤 설명/);
    assert.doesNotMatch(selected, /다음 내용/);
    assert.throws(() => section(source, '이것은 예제의 제목'));
  }
});

test('담당자가 여럿인 미완료 일을 유지하고 다음 절에 원문 맥락을 누출하지 않는다', () => {
  const source = '## 브랜드 작업\n원문: [디자인](../DESIGN.md)\n- [기계 · 유호] 로고 표시 확인\n- [완료 · 09-18] 지난 로고 적용\n## 사업\n- [사람] 가격을 실측한다\n';
  const items = trackItems(source);
  assert.deepEqual(items.map(item => item.text), ['로고 표시 확인', '가격을 실측한다']);
  assert.equal(items[0].owner, '기계 · 유호');
  assert.match(items[0].context, /DESIGN/);
  assert.equal(items[1].context, '');
  assert.ok(items[0].panelIds.includes('brand'));
});

test('완료 표지가 담당자 뒤에 있어도 남은 일로 다시 등록하지 않는다', () => {
  const items = trackItems('## 브랜드\n- [기계 · 완료] 이미 적용한 로고\n- [유호 · 기계] 다음 로고 확인\n');
  assert.deepEqual(items.map(item => item.text), ['다음 로고 확인']);
});

test('현행 트랙의 굵은 제목과 다음 할 일을 읽고 예제 코드와 하위 항목을 별도 요청으로 만들지 않는다', () => {
  const source = '# 이어갈 작업\n## 1. 유호님 차례 — 한곳에 모음\n- **WORLD 실제 기기 확인:** 다음 확인\n  - 휴대폰에서 이어하기\n\n```md\n- **예제 항목:** 실행하면 안 됨\n```\n## 3. 앱·계정(WORLD)\n- **앱 연결:** 남은 동작\n## 완료한 작업\n- **지난 일:** 종료\n';
  const items = trackItems(source);
  assert.equal(items.length, 2);
  assert.equal(items[0].owner, '유호');
  assert.equal(items[0].title, 'WORLD 실제 기기 확인');
  assert.equal(items[0].line, 3);
  assert.match(items[0].text, /휴대폰에서 이어하기/);
  assert.doesNotMatch(items[0].text, /예제 항목/);
  assert.equal(items[1].owner, '작업');
});

test('작업 재개는 해당 대상의 미적용 카드와 현재 원문만 연결하고 카드 요청문을 실행하지 않는다', async t => {
  const {root, put} = fixture(t);
  put('docs/_ops/트랙.md', '# 이어갈 작업\n## 1. 유호님 차례\n- **WORLD 확인:** 실기기 확인 대기\n## 콘텐츠\n- **영상 인계:** 소리 확인\n');
  put('experiences/synk-world-app/README.md', '# WORLD\n현재 원문입니다.');
  const card = (title, target, status) => `---\n제목: ${title}\n대상: ${target}\n상태: ${status}\n언제: 그 작업 때\n공유일: 2026-10-17\n한줄: 이번에 참고할 경험\n---\n## 적용 요청문\n첫째 줄\n\n> 둘째 줄도 보존\n## 근거\n별도 근거\n`;
  put('docs/참고카드/카드/새카드.md', card('현재 카드', 'WORLD 앱 · 싱크타운', '새로'));
  put('docs/참고카드/카드/적용카드.md', card('이미 적용', 'WORLD 앱', '적용함 · 커밋 확인'));
  put('docs/참고카드/카드/영상카드.md', card('영상 카드', 'SNS·영상', '새로'));
  const port = await serve(t, root);
  const r = await request(port, '/api/resume?target=world');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.cards.map(c=>c.title), ['현재 카드']);
  assert.match(r.body.cards[0].request, /첫째 줄/);
  assert.match(r.body.cards[0].request, /둘째 줄도 보존/);
  assert.doesNotMatch(r.body.cards[0].request, /별도 근거/);
  assert.equal(r.body.pending.length, 1);
  assert.equal(r.body.pending[0].owner, '유호');
  const document = await request(port, '/api/document?id='+r.body.cards[0].id);
  assert.equal(document.status, 200);
  assert.equal(document.body.title, '현재 카드');
  assert.match(document.body.content, /둘째 줄도 보존/);
  assert.equal((await request(port, '/api/resume?target=..%2Fprivate')).status, 400);
  assert.equal(fs.readFileSync(path.join(root, 'experiences/synk-world-app/README.md'), 'utf8'), '# WORLD\n현재 원문입니다.');
});

test('작업 재개 Git 요약은 선택 경로의 실제 변경을 읽으며 다른 영역과 원격 조회를 섞지 않는다', t => {
  const {root, put} = fixture(t);
  const {execFileSync} = require('node:child_process');
  const git = args => execFileSync('git', args, {cwd:root,stdio:'pipe',windowsHide:true});
  put('experiences/synk-world-app/app.mjs', 'export const version = 1;\n');
  put('unrelated.txt', 'untouched\n');
  git(['init','-q']);git(['add','.']);
  git(['-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','Initial fixture']);
  put('experiences/synk-world-app/app.mjs', 'export const version = 2;\nexport const extra = true;\n');
  put('unrelated.txt', 'other work\n');
  const {gitSnapshot} = require('../tools/operations-home/resume');
  const result = gitSnapshot(root,['experiences/synk-world-app']);
  assert.equal(result.available,true);
  assert.equal(result.changeCount,1);
  assert.equal(result.changes[0].file,'experiences/synk-world-app/app.mjs');
  assert.equal(result.changes[0].added,2);
  assert.equal(result.changes[0].removed,1);
  assert.equal(result.commits.length,1);
  assert.equal(result.upstream,null);
});

test('원문이 같은 길이와 수정시각으로 바뀌어도 내용과 revision이 바뀐다', t => {
  const {root, put} = fixture(t);
  const file = put('docs/원문.md', '# 원문\n첫번째 문장\n');
  const definition = {id: 'fixture', file: 'docs/원문.md'};
  const first = readDocument(root, definition);
  const before = fs.statSync(file);
  put('docs/원문.md', '# 원문\n두번째 문장\n');
  fs.utimesSync(file, before.atime, before.mtime);
  const next = readDocument(root, definition);
  assert.equal(next.available, true);
  assert.match(next.content, /두번째 문장/);
  assert.notEqual(first.revision, next.revision);
});

test('정본의 삭제나 선택 절 누락을 마지막 성공 내용으로 숨기지 않는다', t => {
  const {root, put} = fixture(t);
  const file = put('docs/원문.md', '# 원문\n## 선택\n현재 기준\n');
  const definition = {id: 'fixture', file: 'docs/원문.md', section: '선택'};
  assert.equal(readDocument(root, definition).available, true);
  put('docs/원문.md', '# 원문\n## 다른 절\n대체하면 안 되는 내용\n');
  const missingSection = readDocument(root, definition);
  assert.equal(missingSection.available, false);
  assert.equal(missingSection.content, '');
  fs.unlinkSync(file);
  const missingFile = readDocument(root, definition);
  assert.equal(missingFile.available, false);
  assert.equal(missingFile.content, '');
  assert.equal(missingFile.revision, undefined);
});

test('상위 경로와 비슷한 이름의 다른 폴더는 정본으로 읽을 수 없다', t => {
  const {root, put} = fixture(t);
  const outside = put('../SYNK-appsscript-other/private.md', 'EXCLUDED_PRIVATE_FIXTURE');
  assert.throws(() => inside(root, outside));
  const result = readDocument(root, {id: 'outside', file: '../SYNK-appsscript-other/private.md'});
  assert.equal(result.available, false);
  assert.equal(result.content, '');
});

test('폴더 연결을 통해 허용한 정본 루트 밖으로 나갈 수 없다', t => {
  const {root, put} = fixture(t);
  const outside = put('../outside/private.md', 'EXCLUDED_LINK_FIXTURE');
  const link = path.join(root, 'linked');
  try {
    fs.symlinkSync(path.dirname(outside), link, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('이 실행 환경에서 폴더 연결을 만들 수 없음');
    throw error;
  }
  assert.equal(readDocument(root, {id: 'link', file: 'linked/private.md'}).available, false);
});

test('운영 홈 전체 revision도 원문 수정과 사라짐을 반영한다', t => {
  const {root, put} = fixture(t);
  const file = put('DESIGN.md', '# 디자인\n원래 기준');
  put('docs/_ops/트랙.md', '# 남은 일\n## 브랜드\n- [기계] 표시 확인');
  const first = state(root);
  put('DESIGN.md', '# 디자인\n새 기준');
  const next = state(root);
  assert.notEqual(first.revision, next.revision);
  fs.unlinkSync(file);
  const absent = state(root);
  assert.notEqual(next.revision, absent.revision);
  assert.equal(absent.documents.find(document => document.id === 'design').available, false);
});

test('공식 작업 조회는 회사 작업만 남기고 불명 상태를 진행 중으로 지어내지 않는다', t => {
  const {base, root} = fixture(t);
  const talk = path.join(base, 'SYNK-talk');
  const website = path.join(base, 'SYNK-website');
  const unrelated = path.join(base, 'SYNK-talk-copy');
  for (const directory of [talk, website, unrelated]) fs.mkdirSync(directory);
  const checkedAt = new Date().toISOString();
  const saved = saveRuntime(root, {checkedAt, tasks: [
    {id: 'root', title: '정본 작업', cwd: root, status: 'running'},
    {id: 'talk', title: '앱 작업', cwd: talk, status: 'needs_attention'},
    {id: 'website', title: '웹 작업', cwd: website, status: 'unrecognized-new-status'},
    {id: 'private', title: '다른 회사 자료', cwd: unrelated, status: 'running'},
    {id: 'missing', cwd: path.join(base, 'nonexistent'), status: 'running'},
  ]});
  assert.deepEqual(saved.tasks.map(task => task.id), ['root', 'talk', 'website']);
  assert.equal(saved.tasks.find(task => task.id === 'website').status, 'unknown');
  assert.equal(runtime(root).checkedAt, checkedAt);
  assert.equal(runtime(root).stale, false);
});

test('오래된 작업 조회와 미연결을 구분하고 잘못된 새 조회로 정상 기록을 덮지 않는다', t => {
  const {root} = fixture(t);
  assert.equal(runtime(root).connected, false);
  assert.equal(runtime(root).stale, true);
  const checkedAt = new Date(Date.now() - 46 * 60_000).toISOString();
  saveRuntime(root, {checkedAt, tasks: [{id: 'old', cwd: root, status: 'running'}]});
  assert.equal(runtime(root).connected, true);
  assert.equal(runtime(root).stale, true);
  assert.equal(runtime(root).tasks[0].id, 'old');
  assert.throws(() => saveRuntime(root, {checkedAt: 'not-a-date', tasks: []}));
  assert.throws(() => saveRuntime(root, {checkedAt: new Date(Date.now() + 120_000).toISOString(), tasks: []}));
  assert.throws(() => saveRuntime(root, {checkedAt, tasks: {}}));
  assert.equal(runtime(root).checkedAt, checkedAt);
  assert.equal(runtime(root).tasks[0].id, 'old');
});

test('HTTP는 임의 파일·임의 자산·POST·외부 Host와 Origin을 거절한다', async t => {
  const {root, put} = fixture(t);
  put('private.md', 'NOT_REGISTERED_FIXTURE');
  const port = await serve(t, root);
  for (const requestPath of ['/private.md', '/api/document?id=private.md', '/asset/private.md', '/asset/..%2Fprivate.md']) {
    const response = await request(port, requestPath);
    assert.equal(response.status, 404, requestPath);
    assert.doesNotMatch(response.text, /NOT_REGISTERED_FIXTURE/);
  }
  assert.equal((await request(port, '/api/health', {method: 'POST', body: '{}'})).status, 405);
  assert.equal((await request(port, '/api/health', {headers: {host: 'attacker.example'}})).status, 403);
  assert.equal((await request(port, '/api/health', {headers: {host: '127.0.0.1.attacker.example'}})).status, 403);
  assert.equal((await request(port, '/api/health', {headers: {origin: 'https://attacker.example'}})).status, 403);
  assert.equal((await request(port, '/app.js', {headers: {origin: 'http://127.0.0.1:'+port}})).status, 200);
  assert.equal((await request(port, '/app.js', {headers: {origin: 'http://127.0.0.1:1'}})).status, 403);
  assert.equal(fs.readFileSync(path.join(root, 'private.md'), 'utf8'), 'NOT_REGISTERED_FIXTURE');
});

test('HTTP 절 보기·전문 보기·검색은 같은 원문을 사용하며 요청마다 갱신한다', async t => {
  const {root, put} = fixture(t);
  const file = put('docs/비전_정본.md', '# 비전\n## SYNK\n회사 기준\n## SYNK LAB\nONLY_LAB_SEARCH_FIXTURE\n## SYNK SHIFT\nSHIFT 기준\n## SYNK PULSE\nPULSE 기준\n');
  const port = await serve(t, root);
  const excerpt = await request(port, '/api/document?id=vision');
  assert.equal(excerpt.status, 200);
  assert.match(excerpt.body.content, /회사 기준/);
  assert.doesNotMatch(excerpt.body.content, /ONLY_LAB_SEARCH_FIXTURE/);
  assert.equal(excerpt.headers['cache-control'], 'no-store');
  const full = await request(port, '/api/document?id=vision&full=1');
  assert.equal(full.status, 200);
  assert.match(full.body.content, /ONLY_LAB_SEARCH_FIXTURE/);
  const found = await request(port, '/api/search?q=only_lab_search_fixture');
  assert.equal(found.status, 200);
  assert.equal(found.body.length, 1, '한 원문을 여러 회사 패널에서 참조해도 검색 결과는 중복하지 않는다');
  assert.equal(found.body[0].file, 'docs/비전_정본.md');
  assert.deepEqual((await request(port, '/api/search?q=%20')).body, []);
  put('docs/비전_정본.md', '# 비전\n## SYNK\n변경된 회사 기준\n');
  const updated = await request(port, '/api/document?id=vision');
  assert.match(updated.body.content, /변경된 회사 기준/);
  assert.notEqual(excerpt.body.revision, updated.body.revision);
  fs.unlinkSync(file);
  const removed = await request(port, '/api/document?id=vision');
  assert.equal(removed.status, 503);
  assert.equal(removed.body.available, false);
  assert.equal(removed.body.content, '');
});
