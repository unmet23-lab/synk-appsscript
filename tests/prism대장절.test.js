'use strict';
// 합성 뿌리·외부 JSONL만 쓴다. 생성기 통합 시험도 임시 산출로 돌린다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 절 } = require('../tools/lib/prism대장절.js');

function 환경(t, 값들 = {}) {
  for (const 키 of ['SYNK_PRISM_산출', 'SYNK_PRISM_명부']) {
    const 이전 = process.env[키];
    t.after(() => { if (이전 === undefined) delete process.env[키]; else process.env[키] = 이전; });
    if (값들[키] === undefined) delete process.env[키]; else process.env[키] = 값들[키];
  }
}

function 픽스처(t) {
  환경(t);
  const 부모 = fs.realpathSync(os.tmpdir());
  const 루트 = fs.mkdtempSync(path.join(부모, 'synk-prism-section-'));
  t.after(() => {
    const 실제 = fs.realpathSync(루트);
    assert.equal(path.dirname(실제), 부모);
    assert.ok(path.basename(실제).startsWith('synk-prism-section-'));
    fs.rmSync(실제, { recursive: true, force: true });
  });
  const 쓰기 = (경로, 내용) => {
    const 파일 = path.resolve(루트, 경로);
    const 상대 = path.relative(루트, 파일);
    assert.ok(상대 !== '..' && !상대.startsWith(`..${path.sep}`) && !path.isAbsolute(상대));
    fs.mkdirSync(path.dirname(파일), { recursive: true });
    fs.writeFileSync(파일, 내용, 'utf8');
    return 파일;
  };
  쓰기('견본.js', '// 합성 견본\n');
  const 명부 = (항목들) => 쓰기('docs/_ops/prism_접점등록.json', JSON.stringify({ 소비자: 항목들 }));
  명부([]);
  const 산출 = (내용) => { process.env.SYNK_PRISM_산출 = 쓰기('산출.jsonl', 내용); };
  return { 루트, 쓰기, 명부, 산출 };
}

const 소비자 = (경로, 갈래) => ({ 경로, 갈래, 사유: '합성 견본' });
// 앞 발주 기준 2의 완비 행 그대로다. 사람을 가리키는 값은 없다.
const 완비행 = {
  값: 31, n: 12, 분모: 39, 판: 'a1b2c3d', 출처: 'prism/조사여격', 키출처: 'grammar_id',
  대상: 'SYNK LAB 1기', 과업: '문장쓰기', 조건: '4급/자유작문',
  기간: '2026-11-01~2026-12-20', 독립수: 7, 편중: 0.29,
};

test('래칫의 네 수가 그대로 나오며 기본 호출도 HTML 문자열이다', (t) => {
  const f = 픽스처(t);
  f.쓰기('견본.js', 'prism_a; prism_b;');
  f.쓰기('다른견본.js', '// 합성 견본');
  f.명부([소비자('견본.js', '내부'), 소비자('다른견본.js', '학생')]);
  const html = 절({ 루트: f.루트 });
  assert.match(html, /범위 파일 2 · 참조 2 · 등록 소비자 2 · 학생·학부모 참조 0/);
  assert.equal(typeof 절(), 'string');
});

test('깨진 명부는 못 쟀다이며 참조 0으로 채우지 않는다', (t) => {
  const f = 픽스처(t);
  f.쓰기('docs/_ops/prism_접점등록.json', '{합성_깨짐');
  const html = 절({ 루트: f.루트 });
  assert.match(html, /⚠ 못 쟀다/);
  assert.match(html, /안 재봤다/);
  assert.doesNotMatch(html, /참조 0|합성_깨짐/);
});

test('미등록·학생·학부모 참조는 빨간 경고와 잡힌 자리를 낸다', (t) => {
  const f = 픽스처(t);
  f.쓰기('견본.js', '// 견본\nprism_probe;');
  for (const 갈래 of [undefined, '학생', '학부모']) {
    f.명부(갈래 ? [소비자('견본.js', 갈래)] : []);
    const html = 절({ 루트: f.루트 });
    assert.match(html, /color:var\(--coral3\).*⚠ 금지·미등록 참조가 있다/);
    assert.match(html, /견본\.js:2: prism_probe/);
    assert.match(html, new RegExp(`학생·학부모 참조 ${갈래 ? 1 : 0}`));
  }
});

test('산출 환경변수 없음은 안 재봤다이며 비공개 정본을 안내한다', (t) => {
  const f = 픽스처(t);
  const html = 절({ 루트: f.루트 });
  assert.match(html, /⚠ 안 재봤다/);
  assert.match(html, /산출 장부가 이 저장소에 없다/);
  assert.match(html, /비공개 버킷/);
  assert.doesNotMatch(html, /완비 0\/0|거절 0\/0/);
});

test('산출 파일 읽기 실패는 못 쟀다와 이스케이프한 경로를 낸다', (t) => {
  const f = 픽스처(t);
  process.env.SYNK_PRISM_산출 = path.join(f.루트, '없는&견본.jsonl');
  const html = 절({ 루트: f.루트 });
  assert.match(html, /⚠ 못 쟀다/);
  assert.match(html, /없는&amp;견본\.jsonl/);
  assert.doesNotMatch(html, /완비 0\/0/);
});

test('정상 산출은 빈 줄을 분모에서 빼고 계약에 옵션 없이 태운다', (t) => {
  const f = 픽스처(t);
  f.산출(`\r\n \t\r\n${JSON.stringify({ ...완비행, 설명: '평균' })}\n\n`);
  const html = 절({ 루트: f.루트 });
  assert.match(html, /산출 1행 · 입력 1/);
  assert.match(html, /완비 1\/1 · 거절 0\/1/);
  assert.doesNotMatch(html, /대조낱말|grammar_id|a1b2c3d/);
});

test('빈 파일과 공백 줄뿐인 산출은 0행이며 초록이나 0/0이 아니다', (t) => {
  const f = 픽스처(t);
  for (const 내용 of ['', '\n \t\r\n\r\n']) {
    f.산출(내용);
    const html = 절({ 루트: f.루트 });
    assert.match(html, /산출 0행/);
    assert.match(html, /초록이 아니다/);
    assert.doesNotMatch(html, /완비 0\/0|거절 0\/0/);
    assert.doesNotMatch(html, /class="prism줄 통과"><b>산출/);
  }
});

test('완비 하나와 거절 둘 중 깨진 JSON도 분모·줄깨짐 사유에 들어간다', (t) => {
  const f = 픽스처(t);
  f.산출([JSON.stringify(완비행), JSON.stringify({ ...완비행, n: -1 }), '{합성_깨짐'].join('\n'));
  const html = 절({ 루트: f.루트 });
  assert.match(html, /완비 1\/3 · 거절 2\/3/);
  assert.match(html, /n없음 1\/2/);
  assert.match(html, /줄깨짐 1\/2/);
  assert.doesNotMatch(html, /합성_깨짐/);
});

test('거절 사유는 많은 순이며 한 행의 여러 사유도 각각 센다', (t) => {
  const f = 픽스처(t);
  f.산출([
    JSON.stringify({ ...완비행, 판: '', n: -1 }),
    JSON.stringify({ ...완비행, 판: '' }),
    'null',
  ].join('\n'));
  const html = 절({ 루트: f.루트 });
  assert.match(html, /완비 0\/3 · 거절 3\/3/);
  assert.match(html, /판없음 2\/3/);
  assert.match(html, /n없음 1\/3/);
  assert.match(html, /행없음 1\/3/);
  assert.ok(html.indexOf('판없음 2/3') < html.indexOf('n없음 1/3'));
  assert.ok(html.indexOf('판없음 2/3') < html.indexOf('행없음 1/3'));
});

test('대장 생성기는 임시 산출에 제목을 한 번만 붙이며 실물을 바꾸지 않는다', (t) => {
  const f = 픽스처(t);
  const 저장소 = path.resolve(__dirname, '..');
  const 실물 = path.join(저장소, 'docs/이해대장.html');
  const 전 = fs.readFileSync(실물);
  const 산출 = path.join(f.루트, '이해대장.html');
  const env = { ...process.env, SYNK_대장_산출: 산출 };
  delete env.SYNK_대장_정본;
  const r = spawnSync(process.execPath, [path.join(저장소, 'tools/이해대장.js')], {
    cwd: 저장소, env, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024,
  });
  assert.ifError(r.error);
  assert.equal(r.status, 0, r.stderr);
  const html = fs.readFileSync(산출, 'utf8');
  const 제목 = '<h2 class="절">Prism 접점 — 학생·학부모 접점 참조 0</h2>';
  assert.equal(html.split('Prism 접점 — 학생·학부모 접점 참조 0').length - 1, 1);
  assert.ok(html.indexOf('<div class="범례">') < html.indexOf(제목));
  assert.ok(html.indexOf(제목) < html.indexOf('📎 함께 볼 것'));
  assert.match(html, /⚠ 안 재봤다/);
  assert.deepEqual(fs.readFileSync(실물), 전);
});

test('절 부품이 던져도 생성기는 오류를 한 줄로 드러내고 대장을 계속 만든다', (t) => {
  const f = 픽스처(t);
  const 저장소 = path.resolve(__dirname, '..');
  const 부품 = path.join(저장소, 'tools/lib/prism대장절.js');
  const 주입 = f.쓰기('합성고장.cjs', `require(${JSON.stringify(부품)}).절 = () => { throw new Error('합성\\n오류 <견본>'); };`);
  const 산출 = path.join(f.루트, '오류대장.html');
  const env = { ...process.env, SYNK_대장_산출: 산출 };
  delete env.SYNK_대장_정본;
  const r = spawnSync(process.execPath, ['--require', 주입, path.join(저장소, 'tools/이해대장.js')], {
    cwd: 저장소, env, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024,
  });
  assert.ifError(r.error);
  assert.equal(r.status, 0, r.stderr);
  const html = fs.readFileSync(산출, 'utf8');
  assert.match(html, /⚠ 못 쟀다<\/b> — 합성 오류 &lt;견본&gt;/);
  assert.match(html, /📎 함께 볼 것/);
  assert.equal(html.split('Prism 접점 — 학생·학부모 접점 참조 0').length - 1, 1);
});
