'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findMapGaps, DOC_MAP } = require('../tools/doc-graph.js');

const INDEX = 'docs/자료안내/상세_색인.md';
const LINK = '[상세 문서 색인](자료안내/상세_색인.md)';
const makeDocs = entries => new Map(entries.map(([rel, text = '']) => [rel, { rel, text }]));

test('기존 지도: 본문 파일명 표기와 정렬된 누락 결과를 유지한다', () => {
  const docs = makeDocs([
    [DOC_MAP, '| **제품방향.md** | `SYNK_철학.md` |'],
    ['docs/제품방향.md'], ['docs/SYNK_철학.md'], ['docs/나중.md'], ['docs/가장.md'],
  ]);
  assert.deepEqual(findMapGaps(docs), { noMap: false, missing: ['docs/가장.md', 'docs/나중.md'] });
});

test('명시적으로 연결한 상세 색인은 지도와 합쳐 읽는다', () => {
  const docs = makeDocs([
    [DOC_MAP, '제품방향.md\n' + LINK],
    [INDEX, '[철학](../SYNK_철학.md)'],
    ['docs/제품방향.md'], ['docs/SYNK_철학.md'], ['docs/아직없음.md'],
  ]);
  assert.deepEqual(findMapGaps(docs), { noMap: false, missing: ['docs/아직없음.md'] });
});

test('상세 색인이 존재해도 지도에서 연결하지 않으면 누락을 숨기지 않는다', () => {
  const docs = makeDocs([[DOC_MAP, '# 지도'], [INDEX, '제품방향.md'], ['docs/제품방향.md']]);
  assert.deepEqual(findMapGaps(docs), { noMap: false, missing: ['docs/제품방향.md'] });
});

test('상세 색인 링크만 있고 읽힌 색인 파일이 없으면 누락을 유지한다', () => {
  const docs = makeDocs([[DOC_MAP, LINK], ['docs/제품방향.md']]);
  assert.deepEqual(findMapGaps(docs), { noMap: false, missing: ['docs/제품방향.md'] });
});

test('지도 자체가 없으면 상세 색인으로 대신 통과시키지 않는다', () => {
  const docs = makeDocs([[INDEX, '제품방향.md'], ['docs/제품방향.md']]);
  assert.deepEqual(findMapGaps(docs), { noMap: true, missing: [] });
});

test('누락 검사 범위는 기존 최상위 docs/*.md이며 다른 확장자·하위 폴더는 넓히지 않는다', () => {
  const docs = makeDocs([
    [DOC_MAP, LINK], [INDEX, '제품방향.md'], ['docs/제품방향.md'], ['docs/누락.md'],
    ['docs/아래/하위.md'], ['docs/_archive/옛문서.md'], ['docs/본문.html'], ['docs/본문.txt'],
    ['docs/대문자.MD'], ['다른곳/문서.md'], ['tools/도구.js'],
  ]);
  assert.deepEqual(findMapGaps(docs), { noMap: false, missing: ['docs/누락.md'] });
});

test('동일 위치의 ./ 상대경로 링크도 상세 색인으로 인정한다', () => {
  const docs = makeDocs([
    [DOC_MAP, '[상세 문서 색인](./자료안내/상세_색인.md)'], [INDEX, '제품방향.md'], ['docs/제품방향.md'],
  ]);
  assert.deepEqual(findMapGaps(docs), { noMap: false, missing: [] });
});

for (const target of [
  '자료안내/상세_색인.txt', '자료안내/다른_색인.md', '../자료안내/상세_색인.md',
  '/자료안내/상세_색인.md', 'https://example.invalid/자료안내/상세_색인.md',
]) {
  test('허용한 상세 색인 상대경로 밖의 링크는 따라가지 않는다: ' + target, () => {
    const docs = makeDocs([
      [DOC_MAP, '[상세 문서 색인](' + target + ')'], [INDEX, '제품방향.md'], ['docs/제품방향.md'],
    ]);
    assert.deepEqual(findMapGaps(docs), { noMap: false, missing: ['docs/제품방향.md'] });
  });
}

test('상세 색인이 다시 가리킨 다른 문서·옛 보관 색인은 재귀로 읽지 않는다', () => {
  const docs = makeDocs([
    [DOC_MAP, LINK], [INDEX, '[옛 색인](../_archive/옛_색인.md)'],
    ['docs/_archive/옛_색인.md', '제품방향.md'], ['docs/제품방향.md'],
  ]);
  assert.deepEqual(findMapGaps(docs), { noMap: false, missing: ['docs/제품방향.md'] });
});

for (const example of ['`' + LINK + '`', '```md\n' + LINK + '\n```', '<!-- ' + LINK + ' -->']) {
  test('코드 예시·주석 속 링크는 실제 연결로 오인하지 않는다: ' + example.slice(0, 8), () => {
    const docs = makeDocs([[DOC_MAP, example], [INDEX, '제품방향.md'], ['docs/제품방향.md']]);
    assert.deepEqual(findMapGaps(docs), { noMap: false, missing: ['docs/제품방향.md'] });
  });
}

for (const example of ['!' + LINK, '\\' + LINK]) {
  test('이미지 표기·이스케이프된 텍스트는 문서 링크로 인정하지 않는다: ' + example.slice(0, 8), () => {
    const docs = makeDocs([[DOC_MAP, example], [INDEX, '제품방향.md'], ['docs/제품방향.md']]);
    assert.deepEqual(findMapGaps(docs), { noMap: false, missing: ['docs/제품방향.md'] });
  });
}
