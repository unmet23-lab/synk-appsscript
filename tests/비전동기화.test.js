'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { syncVisionSources } = require('../tools/비전동기화.js');
const { loadVisions, withVisionBlock, sourcePath } = require('../tools/lib/비전정본.js');
const ROOT = path.resolve(__dirname, '..');

function fixture(t, faqEnd = '<!-- synk-vision:faq:end -->') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-vision-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'docs/정본/SYNK'), { recursive: true });
  fs.writeFileSync(path.join(root, 'contents_상담AI.js'), [
    'const 상담_지식 = [{ 주제: "학원 정체성", 확정: true,',
    '    // synk-vision:lab:start',
    '    내용: "이전 문장"',
    '    // synk-vision:lab:end',
    '}, { 주제: "기존 조건", 확정: false, 내용: "조건 그대로" }];',
  ].join('\r\n'));
  fs.writeFileSync(path.join(root, 'docs/정본/SYNK/SYNK FAQ.txt'), [
    '앞의 상품 조건 그대로', '<!-- synk-vision:faq:start -->', '이전 문장', faqEnd, '뒤의 안내 그대로',
  ].join('\r\n'));
  return root;
}

test('GAS 상담 프롬프트까지 확정 LAB 비전이 임의 부연 없이 도달한다', () => {
  const vision = loadVisions().lab;
  const contents = fs.readFileSync(path.join(ROOT, 'contents_상담AI.js'), 'utf8');
  const engine = fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8');
  const prompt = vm.runInNewContext(contents + '\n' + engine + '\n상담_시스템_()', {}, { timeout: 1000 });
  assert.ok(prompt.includes([vision.headline, vision.subtext].filter(Boolean).join('\n\n')));
  assert.equal(syncVisionSources({ check: true }).changed.length, 0);
});

test('09-13 네 브랜드 비전은 최신 사용자 문구와 선택한 부연만 유지한다', () => {
  const visions = loadVisions();
  assert.equal(visions.synk.headline, '저마다의 삶을 온전히 누리는 미래를 만듭니다.');
  assert.equal(visions.synk.subtext, 'AI가 넓힌 가능성을 배움과 일, 문화로 연결합니다.');
  assert.equal(visions.lab.headline, '가고 싶은 방향에 집중할 수 있는 환경을 만듭니다.');
  assert.equal(visions.lab.subtext, '');
  assert.equal(visions.shift.headline, '개인과 조직의 성장이 서로의 기회가 되는 미래를 만듭니다.');
  assert.match(visions.shift.subtext, /준비된 인재와 함께 성장/);
  assert.equal(visions.pulse.headline, '함께한 시간이, 각자의 이야기로 이어지는 문화를 만듭니다.');
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
  visions.lab = { ...visions.lab, headline: '따옴표 "그대로"와 경로 \\를 전한다.', subtext: '첫 뜻.\n다음 뜻.' };
  const gasPath = path.join(root, 'contents_상담AI.js');
  const original = fs.readFileSync(gasPath, 'utf8');
  assert.equal(syncVisionSources({ root, check: true, visions }).changed.length, 2);
  assert.equal(fs.readFileSync(gasPath, 'utf8'), original);
  assert.equal(syncVisionSources({ root, visions }).written, 2);
  const generated = fs.readFileSync(gasPath, 'utf8');
  const knowledge = vm.runInNewContext(generated + '\n상담_지식');
  assert.ok(knowledge[0].내용.endsWith(visions.lab.headline + '\n\n' + visions.lab.subtext));
  assert.equal(knowledge[1].내용, '조건 그대로');
  assert.equal(knowledge[1].확정, false);
  assert.equal(generated.replace(/\r\n/g, '').includes('\n'), false);
  const faq = fs.readFileSync(path.join(root, 'docs/정본/SYNK/SYNK FAQ.txt'), 'utf8');
  assert.ok(faq.startsWith('앞의 상품 조건 그대로\r\n'));
  assert.ok(faq.endsWith('\r\n뒤의 안내 그대로'));
  assert.ok(faq.includes(visions.synk.headline));
  assert.ok(faq.includes(visions.synk.subtext));
  assert.equal(syncVisionSources({ root, visions }).written, 0);
});

test('뒤의 표시 구간이 잘못되면 앞의 상담 파일도 바꾸지 않는다', t => {
  const root = fixture(t, '끝 표식 없음');
  const gasPath = path.join(root, 'contents_상담AI.js');
  const before = fs.readFileSync(gasPath);
  assert.throws(() => syncVisionSources({ root }), /비전 표시 구간/);
  assert.deepEqual(fs.readFileSync(gasPath), before);
});
