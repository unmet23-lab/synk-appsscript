'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { syncVisionSources } = require('../tools/비전동기화.js');
const { loadVisions, withVisionBlock, sourcePath } = require('../tools/lib/비전정본.js');

// 2026-10-02 GAS 상담 지식(contents_상담AI.js)은 상담 AI와 함께 지웠다. 비전을 옮겨 적는 곳은 대외 FAQ 하나다.
function fixture(t, faqEnd = '<!-- synk-vision:faq:end -->') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-vision-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'docs/정본/SYNK'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/정본/SYNK/SYNK FAQ.txt'), [
    '앞의 상품 조건 그대로', '<!-- synk-vision:faq:start -->', '이전 문장', faqEnd, '뒤의 안내 그대로',
  ].join('\r\n'));
  return root;
}

test('대외 FAQ가 지금 비전 정본과 같다', () => {
  assert.deepEqual(syncVisionSources({ check: true }).changed, []);
});

test('10-02 개인화 엔진 기업 비전과 09-18 사업 역할을 파생 소개에 전달한다', () => {
  const visions = loadVisions();
  assert.equal(visions.synk.headline, '누구에게나 확실히 도움이 되는 개인화 엔진을 만듭니다.');
  assert.equal(visions.synk.subtext, 'SYNK는 개인화 엔진 아틀라스를 만드는 기업입니다. 20대부터 60대까지 남녀노소 누구든 게임을 하거나 배우고 공부할 때, 컨설팅을 받을 때 그 사람의 목표와 상황에 맞는 도움을 받게 합니다. 한국어 교육, 기업의 AI 활용, 콘텐츠, 유학·취업 준비는 이 엔진이 쓰이는 분야입니다.');
  assert.equal(visions.lab.headline, '한국어를 배우고, 한국에서의 공부와 생활을 준비하는 교육을 만듭니다.');
  assert.equal(visions.lab.subtext, '');
  assert.equal(visions.shift.headline, '기업과 기관이 AI를 자기 일에 활용하고, 가진 가치를 고객에게 전달하도록 돕습니다.');
  assert.match(visions.shift.subtext, /실제 업무에 맞춘 AI 교육과 컨설팅, 기업 브랜딩/);
  assert.equal(visions.pulse.headline, '음악과 영상, 캐릭터의 이야기로 다시 찾고 싶은 작품을 만듭니다.');
  assert.equal(visions.pulse.subtext, '');
  const block = withVisionBlock('# LAB\n\n기존 본문', 'lab');
  assert.ok(block.includes('**' + visions.lab.headline + '**\n<!-- synk-vision:end -->'));
  assert.ok(block.endsWith('기존 본문'));
  assert.equal(withVisionBlock(block, 'lab'), block);
});

test('선택적 부연은 전면 문장이나 SYNK·SHIFT 부연 누락을 숨기지 않는다', () => {
  const source = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n');
  const visions = loadVisions();
  assert.deepEqual(loadVisions(source.replace(/\n/g, '\r\n')), visions);
  assert.throws(() => loadVisions(source.replace(visions.synk.subtext, '')), /필요한 서브텍스트/);
  assert.throws(() => loadVisions(source.replace(visions.shift.subtext, '')), /필요한 서브텍스트/);
  assert.throws(() => loadVisions(source.replace('### 전면 비전\n\n' + visions.lab.headline, '')), /전면 문장/);
});

test('읽기 전용 대조는 쓰지 않고 재생성은 주변 조건과 줄바꿈을 보존한다', t => {
  const root = fixture(t);
  const visions = loadVisions();
  const faqPath = path.join(root, 'docs/정본/SYNK/SYNK FAQ.txt');
  const original = fs.readFileSync(faqPath, 'utf8');
  assert.equal(syncVisionSources({ root, check: true, visions }).changed.length, 1);
  assert.equal(fs.readFileSync(faqPath, 'utf8'), original);
  assert.equal(syncVisionSources({ root, visions }).written, 1);
  const faq = fs.readFileSync(faqPath, 'utf8');
  assert.ok(faq.startsWith('앞의 상품 조건 그대로\r\n'));
  assert.ok(faq.endsWith('\r\n뒤의 안내 그대로'));
  assert.ok(faq.includes(visions.synk.headline));
  assert.ok(faq.includes(visions.synk.subtext));
  assert.ok(faq.includes(visions.lab.headline));
  assert.equal(faq.replace(/\r\n/g, '').includes('\n'), false);
  assert.equal(syncVisionSources({ root, visions }).written, 0);
});

test('표시 구간이 잘못되면 파일을 바꾸지 않는다', t => {
  const root = fixture(t, '끝 표식 없음');
  const faqPath = path.join(root, 'docs/정본/SYNK/SYNK FAQ.txt');
  const before = fs.readFileSync(faqPath);
  assert.throws(() => syncVisionSources({ root }), /비전 표시 구간/);
  assert.deepEqual(fs.readFileSync(faqPath), before);
});
