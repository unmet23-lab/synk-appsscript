'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { inventory, safeRead, maskCode, localLinks } = require('../tools/lib/knowledge-files');
const { inspectText, query, 상태읽기 } = require('../tools/문서상태');
const { build, parseEdgesFull, canonVersion } = require('../tools/doc-graph');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-knowledge-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^GIT_/i.test(k)) delete env[k];
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { env, windowsHide: true, stdio: 'pipe' });
  git('init', '-q');
  function write(file, text) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return { root, git, write };
}

test('현행 안내·기준·정본 선언은 명시 확정과 구분한다', () => {
  assert.equal(inspectText('# 문서\n> 현행 기준 · 오늘').declaration.상태, '현행 기준 표기');
  assert.equal(inspectText('# 문서\n> 회사별 채널의 현행 진입점.').declaration.상태, '현행 안내 표기');
  assert.equal(inspectText('<!-- 정본: v1.2 -->').declaration.상태, '정본 선언');
  assert.equal(inspectText('# 정본 v1\n본문에 현행 기준을 인용한다').declaration, null);
  assert.equal(inspectText('> 현행 기준 · 초안 검토중').declaration.상태, '초안·검토 표기');
  assert.equal(inspectText('> 이 문서는 현행 기준이 아니다.').declaration, null);
  assert.equal(inspectText('> 현행 기준은 [운영 원칙](AI_운영원칙.md)을 참고한다.').declaration, null);
  assert.equal(inspectText('> 현행 기준 · 규칙을 복제하지 않는다.').declaration.상태, '현행 기준 표기');
});

test('옛 명시 상태와 별표 변형은 호환한다', (t) => {
  const f = fixture(t);
  for (const s of ['✅**확정**', '**✅ 확정**', '✅확정']) {
    f.write('doc.md', `# 문서\n> **상태**: ${s} · 적용 범위는 본문`);
    assert.equal(상태읽기(path.join(f.root, 'doc.md')).상태, '✅확정');
  }
});

test('코드 펜스·인라인·닫히지 않은 예시는 선언이 아니다', () => {
  for (const fence of ['```', '~~~~']) {
    const text = `${fence}\n> 상태: ✅확정\n<!-- 파생: docs/정본.md@v1 -->\n${fence}\n## 실제 절`;
    assert.equal(inspectText(text).declaration, null);
    assert.deepEqual(parseEdgesFull(text), []);
    assert.equal(inspectText(text).headings[0].line, 5);
    assert.equal(inspectText(`${fence}\n> 현행 기준`).declaration, null);
  }
  assert.equal(maskCode('앞 `<!-- 정본 -->` 뒤').length, '앞 `<!-- 정본 -->` 뒤'.length);
  assert.equal(inspectText(Array(12).fill('').join('\n') + '\n> 상태: ✅확정').declaration, null);
  assert.equal(inspectText('> ```md\n> 상태: ✅확정\n> ```').declaration, null);
  assert.equal(inspectText('    > 상태: ✅확정').declaration, null);
  assert.deepEqual(parseEdgesFull('> ```md\n> example\n\n<!-- 파생: docs/source.md@v1 -->'), [{ target: 'docs/source.md', version: 'v1' }]);
  assert.equal(canonVersion('# 문서\n<!-- 정본 -->\n```text\nv9\n```'), null);
});

test('일반 파일 링크는 코드·이미지·외부·주석·범위 밖 링크와 구별한다', () => {
  const text = '[현재](../기준%20정본.md#제목)\n[각도](<../공백 정본.md>)\n![그림](missing.png)\n`[예](bad.md)`\n<!-- [예](bad.md) -->\n[밖](https://example.com/a.md) [상위](../../../outside.md)';
  assert.deepEqual(localLinks(text, 'docs/자료/지도.md').map((l) => l.target), ['docs/기준 정본.md', 'docs/공백 정본.md']);
  assert.deepEqual(localLinks('\\[예시](bad.md)', 'docs/지도.md'), []);
  const refs = '[예시_정본][source]\n[source][] [source]\n![이미지][source]\n[source]: 예시_정본.md';
  assert.equal(localLinks(refs, 'docs/reader.md').length, 3);
  assert.ok(localLinks(refs, 'docs/reader.md').every((l) => l.target === 'docs/예시_정본.md'));
});

test('Git 무시 자료는 읽지 않고 작업 중 문서는 구별한다', (t) => {
  const f = fixture(t);
  f.write('.gitignore', 'docs/private/\n');
  f.write('docs/현행.md', '> 현행 기준');
  f.write('docs/초안.md', '> 초안');
  f.write('docs/private/비공개.md', '> 상태: ✅확정');
  f.git('add', '--', '.gitignore', 'docs/현행.md');
  const result = query({ root: f.root, all: true });
  assert.equal(result.errors.length, 0);
  assert.equal(result.documents.length, 2);
  assert.equal(result.documents.find((d) => d.file === 'docs/초안.md').tracked, false);
  assert.ok(!inventory(f.root).files.some((r) => r.includes('private')));
  assert.equal(query({ root: f.root, file: 'docs/private/비공개.md' }).errors.length, 1);
});

test('검색은 이름·절 제목을 찾고 원문 줄 위치를 반환한다', (t) => {
  const f = fixture(t);
  f.write('docs/큰문서.md', '# 문서\n\n## 엔진 계약\n검색되지 않는 본문\n```\n## 가짜 절\n```');
  const r = query({ root: f.root, search: '엔진' });
  assert.deepEqual(r.documents[0].matches, [{ line: 3, level: 2, title: '엔진 계약' }]);
  assert.equal(query({ root: f.root, search: '검색되지' }).documents.length, 0);
  assert.equal(query({ root: f.root, file: '../outside.md' }).errors.length, 1);
});

test('실패·삭제·너무 큰 파일은 빈 성공이 아니다', (t) => {
  const f = fixture(t);
  f.write('docs/삭제.md', '# 문서');
  f.git('add', '--', 'docs/삭제.md');
  fs.unlinkSync(path.join(f.root, 'docs/삭제.md'));
  assert.equal(query({ root: f.root }).errors.length, 1);
  assert.equal(build({ root: f.root }).scanErrors.length, 1);
  assert.equal(inventory(path.join(f.root, '없는폴더')).errors.length, 1);
  f.write('big.md', '12345');
  assert.throws(() => safeRead(f.root, 'big.md', 4), /document-too-large/);
  assert.throws(() => safeRead(f.root, '../outside.md'), /unsafe-path/);
});

test('디렉터리 심볼릭 링크를 따라 저장소 밖 자료를 읽지 않는다', (t) => {
  const f = fixture(t);
  const other = fixture(t);
  other.write('secret.md', '비공개');
  fs.symlinkSync(other.root, path.join(f.root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => safeRead(f.root, 'linked/secret.md'), /not-regular-file/);
});

test('그래프는 단순 링크·이름 언급·명시 파생·작업 중 색인을 분리한다', (t) => {
  const f = fixture(t);
  f.write('docs/문서_지도.md', '# 지도\n[기준](기준_정본.md)\n[보고](보고.md)');
  f.write('docs/기준_정본.md', '<!-- 정본: v2 -->');
  f.write('docs/보고.md', '[기준을 찾아보기](기준_정본.md)');
  f.git('add', '--', 'docs');
  f.write('docs/작업.md', '기준_정본 이름 언급');
  f.write('docs/파생.html', '<!-- 파생: docs/기준_정본.md@v1 -->');
  const g = build({ root: f.root });
  assert.equal(g.references.length, 3);
  assert.deepEqual(g.candidates, [{ doc: 'docs/작업.md', canon: 'docs/기준_정본.md' }]);
  assert.equal(g.candidateDocuments, 1);
  assert.equal(g.stale.length, 1);
  assert.deepEqual(g.mapGaps.missing, []);
  assert.deepEqual(g.workingMapGaps, ['docs/작업.md']);
});

test('버전 미기입은 최신으로 바뀌지 않으며 틸드 예시의 엣지는 세지 않는다', (t) => {
  const f = fixture(t);
  f.write('docs/기준_정본.md', '<!-- 정본: v2 -->');
  f.write('docs/파생.md', '<!-- 파생: docs/기준_정본.md -->\n~~~\n<!-- 파생: docs/없는.md@v1 -->\n~~~');
  const g = build({ root: f.root });
  assert.equal(g.unversioned.length, 1);
  assert.equal(g.stale.length, 0);
  assert.equal(g.broken.length, 0);
});

test('큰 HTML 이미지 검색 생략은 문서 머리의 줄 위치를 바꾸지 않는다', (t) => {
  const f = fixture(t);
  f.write('docs/standalone.html', '<!doctype html>\n<img src="data:image/png;base64,' + Array(14).fill('AAAA').join('\n') + '">\n<!-- 정본: v9 -->\n');
  const g = build({ root: f.root });
  assert.equal(g.docs.get('docs/standalone.html').canon, false);
  assert.equal(g.mapGaps.noMap, true);
});

test('실제 Git 제외 규칙은 확인된 브라우저 프로필만 가리고 원본·렌더 결과는 남긴다', (t) => {
  const f = fixture(t);
  f.write('.gitignore', fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8'));
  const base = 'docs/홍보물/첫게시물_20260910/_검토/01-표정편집엔딩/render-temp/';
  f.write(base + 'puppeteer_dev_chrome_profile-fixture/Default/Cookies', 'fixture');
  f.write(base + 'result.png', 'fixture');
  f.write('tmp/unknown-original.md', '# 원본');
  const files = inventory(f.root).files;
  assert.ok(!files.some((r) => r.includes('Cookies')));
  assert.ok(files.includes(base + 'result.png'));
  assert.ok(files.includes('tmp/unknown-original.md'));
});
