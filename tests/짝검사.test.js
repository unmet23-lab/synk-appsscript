'use strict';

// 짝검사 — 원천만 고치고 짝 파일(생성물·사본)을 같이 안 올린 push를 push 전에 막는 표(tools/짝검사.js).
// 고르기·돌리기는 임시 폴더의 가짜 생성기로 재고, 실제 표는 이 저장소의 CI 단계·파일과 대조만 한다(생성기는 안 돌린다).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 짝 = require('../tools/짝검사.js');

const REPO = path.resolve(__dirname, '..');

/** 「src/*.txt를 대문자로 이어 out/가.txt에」 쓰는 가짜 생성기. --check면 대조만 하고 다르면 「낡았다」를 던진다. */
const 생성기 = `const fs = require('fs'), path = require('path');
require('./lib/도움.js');
const root = path.resolve(__dirname, '..');
const 원천 = fs.readdirSync(path.join(root, 'src')).sort().map((f) => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('');
const 결과 = 원천.toUpperCase(), 자리 = path.join(root, 'out/가.txt');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(자리) || fs.readFileSync(자리, 'utf8') !== 결과) throw new Error('낡았다: out/가.txt');
  console.log('맞다');
} else { fs.mkdirSync(path.dirname(자리), { recursive: true }); fs.writeFileSync(자리, 결과); }
`;

function 폴더(t, 파일) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-짝검사-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 }));
  const 쓰기 = (p, v) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), v); };
  for (const [p, v] of Object.entries({ 'tools/만들기.js': 생성기, 'tools/lib/도움.js': '', 'src/가.txt': 'abc\n', 'out/가.txt': 'ABC\n', ...파일 })) 쓰기(p, v);
  return { root, 쓰기 };
}

const 짝줄 = (덧 = {}) => ({
  이름: '가짜 묶음', 단계: '시험', 명령: ['tools/만들기.js', '--check'], 고침: 'node tools/만들기.js',
  결과물: ['out/가.txt'], 원천: ['src/*.txt'], 주석원천: ['out/묶음.js'], 낡음: /낡았다/, ...덧,
});
const 고른 = (root, 바뀐, 표) => 짝.고르기({ root, 바뀐, 표 });

test('무늬 — * 는 한 칸, ** 는 여러 칸, **/ 는 0칸도', () => {
  assert.ok(짝.무늬식('src/*.txt').test('src/가.txt'));
  assert.ok(!짝.무늬식('src/*.txt').test('src/깊이/가.txt'));
  assert.ok(짝.무늬식('a/**').test('a/b/c.js'));
  assert.ok(짝.무늬식('**/*.html').test('가.html'));
  assert.ok(짝.무늬식('**/*.html').test('docs/가/나.html'));
  assert.ok(!짝.무늬식('**/*.html').test('docs/가.htm'));
  assert.ok(짝.무늬식('docs/a.b+c.md').test('docs/a.b+c.md'), '무늬 문자가 없으면 그 경로 하나(. + 는 글자 그대로)');
  assert.ok(!짝.무늬식('docs/a.b+c.md').test('docs/aXb+c.md'));
});

test('묶인 모듈 — esbuild 묶음의 「// 경로」 줄(ESM·들여 쓴 IIFE)만 읽고, 지운 모듈도 남긴다', (t) => {
  const { root } = 폴더(t, {
    'out/묶음.js': [
      '// lib/가.mjs', 'var a = 1;', '  // atlas/엔진.js', '  // strata/maps/지도.json', '// lib/지운것.mjs',
      '// TODO 나중에', '// https://example.invalid/x.js', '// ../밖.js', '// 설명: lib/나.mjs 를 본다', '// lib/스타일.css',
    ].join('\n'),
  });
  assert.deepEqual(짝.묶인모듈(root, 'out/묶음.js').sort(),
    ['atlas/엔진.js', 'lib/가.mjs', 'lib/스타일.css', 'lib/지운것.mjs', 'strata/maps/지도.json'].sort());
  assert.deepEqual(짝.묶인모듈(root, 'out/없는묶음.js'), []);
});

test('스크립트가 부르는 파일 — 상대 import·require 한 겹, 확장자 없으면 .js·/index.js', (t) => {
  const { root } = 폴더(t, {
    'tools/짓기.mjs': "import x from './lib/가.mjs';\nimport('./lib/나.js');\nconst s = require('../strata');\nrequire('node:fs');\nrequire('./없는것');\n",
    'tools/lib/가.mjs': '', 'tools/lib/나.js': '', 'strata/index.js': '',
  });
  assert.deepEqual(짝.스크립트가부르는(root, 'tools/짓기.mjs').sort(), ['strata/index.js', 'tools/lib/가.mjs', 'tools/lib/나.js']);
});

test('고르기 — 원천·결과물·묶인 모듈·스크립트에 걸리는 줄만 · 상관없는 경로는 아무것도 · 스크립트가 없는 줄은 없는 셈', (t) => {
  const { root } = 폴더(t, { 'out/묶음.js': '// lib/묶인.mjs\n' });
  const 표 = [짝줄(), 짝줄({ 이름: '없는 생성기', 명령: ['tools/없다.js'], 원천: ['**/*'] })];
  const 까닭 = (바뀐) => 고른(root, 바뀐, 표).map((x) => `${x.줄.이름}|${x.까닭}`);
  assert.deepEqual(까닭(['src/가.txt']), ['가짜 묶음|원천 src/*.txt: src/가.txt']);
  assert.deepEqual(까닭(['out/가.txt']), ['가짜 묶음|결과물: out/가.txt']);
  assert.deepEqual(까닭(['lib/묶인.mjs']), ['가짜 묶음|원천: lib/묶인.mjs']);
  assert.deepEqual(까닭(['tools/lib/도움.js']), ['가짜 묶음|원천: tools/lib/도움.js'], '생성기가 부르는 파일도 원천이다');
  assert.deepEqual(까닭(['tools/만들기.js']), ['가짜 묶음|원천: tools/만들기.js']);
  assert.deepEqual(까닭(['docs/글.md', 'README.md', 'src/깊이/가.txt']), []);
  assert.deepEqual(까닭([]), []);
  // 문서만 바꾼 push는 묶음 파일을 열지도 않는다(묶인 모듈은 모듈 꼴 파일을 바꿨을 때만 읽는다)
  assert.equal(짝.보는파일(root, 짝줄(), { 읽기: false }).파일.has('lib/묶인.mjs'), false);
});

test('돌리기 — 통과 · 낡음은 막고 고치는 명령과 결과물을 보인다 · 오류도 막는다 · 환경이 없으면 못 돌림(주의만)', async (t) => {
  const { root, 쓰기 } = 폴더(t, {});
  const 표 = [짝줄()];
  const 됨 = await 짝.돌리기({ root, 고름: 고른(root, ['src/가.txt'], 표), 올린: ['src/가.txt'], 더러운: [{ 경로: 'src/가.txt', 추적: true }] });
  assert.equal(됨.결과[0].판정, '통과', JSON.stringify(됨));
  assert.deepEqual(됨.막음, []);

  쓰기('src/가.txt', 'abd\n'); // 원천만 고치고 생성기를 안 돌렸다
  const 낡음 = await 짝.돌리기({ root, 고름: 고른(root, ['src/가.txt'], 표), 올린: ['src/가.txt'], 더러운: [{ 경로: 'src/가.txt', 추적: true }] });
  assert.equal(낡음.결과[0].판정, '낡음');
  assert.deepEqual(낡음.막음, ['가짜 묶음']);
  assert.match(낡음.결과[0].글, /낡았다: out\/가\.txt/);
  const 글 = 짝.글로({ 수: 1, 검사: ['가짜 묶음'], 결과: 낡음 }).join('\n');
  assert.match(글, /짝 검사 막힘/);
  assert.match(글, /→ 고친다: node tools\/만들기\.js/);
  assert.match(글, /→ 그 뒤 결과물을 경로에 더해 같이 올린다: out\/가\.txt/);

  const 죽음 = await 짝.돌리기({ root, 고름: 고른(root, ['src/가.txt'], [짝줄({ 낡음: /이런 글은 없다/ })]), 올린: ['src/가.txt'] });
  assert.equal(죽음.결과[0].판정, '오류', '낡음 무늬에 안 걸리는 실패는 오류 — CI에서도 그대로 깨진다');
  assert.equal(죽음.결과[0].막음, true);

  const 환경없음 = await 짝.돌리기({ root, 고름: 고른(root, ['src/가.txt'], [짝줄({ 환경: ['node_modules/없는것'] })]), 올린: ['src/가.txt'] });
  assert.equal(환경없음.결과[0].판정, '못 돌림');
  assert.equal(환경없음.결과[0].막음, false);
  assert.match(환경없음.결과[0].주의, /못 돌렸다.*CI가 본다/);
});

test('돌리기 — 작업본 대조: 생성물을 만들고도 이번 push에 안 넣으면 워크트리는 막고, 공용 작업본은 주의만 · 뒤처짐은 주의', async (t) => {
  const { root, 쓰기 } = 폴더(t, {});
  쓰기('src/가.txt', 'abd\n');
  쓰기('out/가.txt', 'ABD\n'); // 생성기는 돌렸는데
  const 표 = [짝줄()];
  const 더러운 = [{ 경로: 'src/가.txt', 추적: true }, { 경로: 'out/가.txt', 추적: true }, { 경로: 'src/쪽지.txt', 추적: false }];
  const 빠짐 = await 짝.돌리기({ root, 고름: 고른(root, ['src/가.txt'], 표), 올린: ['src/가.txt'], 더러운 }); // 결과물을 경로에 안 넣었다
  assert.equal(빠짐.결과[0].판정, '통과');
  assert.equal(빠짐.결과[0].막음, true, '작업본에서는 맞아도 올릴 판에는 옛 결과물이 간다');
  assert.deepEqual(빠짐.결과[0].안올린, [{ 경로: 'out/가.txt', 결과물: true }], '무늬로 고른 원천의 미추적 쪽지는 세지 않는다');
  assert.match(짝.글로({ 수: 1, 검사: ['가짜 묶음'], 결과: 빠짐 }).join('\n'), /경로에 더해 같이 올리거나 되돌린다: out\/가\.txt\(결과물\)/);

  const 같이 = await 짝.돌리기({ root, 고름: 고른(root, ['src/가.txt', 'out/가.txt'], 표), 올린: ['src/가.txt', 'out/가.txt'], 더러운 });
  assert.equal(같이.결과[0].막음, false, JSON.stringify(같이));
  assert.equal(같이.결과[0].주의, null);

  const 공용 = await 짝.돌리기({ root, 고름: 고른(root, ['src/가.txt'], 표), 올린: ['src/가.txt'], 더러운, 공용: true });
  assert.equal(공용.결과[0].막음, false);
  assert.match(공용.결과[0].주의, /남의 미커밋이면 괜찮다/);

  쓰기('out/가.txt', 'ABC\n'); // 공용 작업본에서 남이 고치다 만 결과물 때문에 깨진다
  const 섞임 = await 짝.돌리기({ root, 고름: 고른(root, ['src/가.txt'], 표), 올린: ['src/가.txt'], 더러운, 공용: true });
  assert.equal(섞임.결과[0].판정, '낡음');
  assert.equal(섞임.결과[0].막음, false);
  assert.match(섞임.결과[0].주의, /미커밋\(out\/가\.txt\)이 섞였을 수 있어 막지 않았다/);

  쓰기('out/가.txt', 'ABD\n');
  const 뒤 = await 짝.돌리기({ root, 고름: 고른(root, ['src/가.txt', 'out/가.txt'], 표), 올린: ['src/가.txt', 'out/가.txt'], 더러운, 뒤처진: ['src/나.txt', 'docs/x.md'] });
  assert.equal(뒤.결과[0].막음, false);
  assert.match(뒤.결과[0].주의, /origin에서 이 검사가 보는 src\/나\.txt가 바뀌었다/);

  // 바탕이 뒤처져 깨졌을 수 있으면(origin이 그 결과물을 고쳤다) 막되 따라가기부터 하라고 덧붙인다
  쓰기('src/가.txt', 'abe\n');
  const 뒤깨짐 = await 짝.돌리기({ root, 고름: 고른(root, ['src/가.txt'], 표), 올린: ['src/가.txt'], 더러운: [{ 경로: 'src/가.txt', 추적: true }], 뒤처진: ['out/가.txt'] });
  assert.equal(뒤깨짐.결과[0].막음, true);
  assert.match(짝.글로({ 수: 1, 검사: ['가짜 묶음'], 결과: 뒤깨짐 }).join('\n'), /origin에서 이 검사가 보는 out\/가\.txt가 바뀌었다 — 먼저 node tools\/바로올리기\.js 따라가기 --실행/);
});

test('돌리기 — 함수 줄과 시험 줄: 시험 줄은 이번 push의 새 파일을 SYNK_새파일로 받고, 깨지면 시험이 찍은 → 안내를 보인다', async (t) => {
  const 시험글 = `const { test } = require('node:test'); const assert = require('node:assert');
const 새것 = JSON.parse(process.env.SYNK_새파일 || '[]');
test('새 지면도 잰다', () => { assert.ok(새것.includes('docs/새.html'), '새 지면을 못 봤다\\n   → 고친다: node tools/심기.js "docs/새.html"'); });
test('딴 시험', () => { assert.fail('이름 무늬로 안 돈다'); });
`;
  const { root } = 폴더(t, { 'tests/새것.test.js': 시험글, 'docs/새.html': '<p>가</p>\n' });
  const 시험줄 = { 이름: '새 지면 시험', 단계: 'tests/새것.test.js', 시험: ['tests/새것.test.js', '^새 지면'], 고침: 'node tools/심기.js', 원천: ['**/*.html'], 작업본대조: false };
  const 고름 = 고른(root, ['docs/새.html'], [시험줄]);
  assert.equal(고름.length, 1);
  const 됨 = await 짝.돌리기({ root, 고름, 올린: ['docs/새.html'], 새파일: ['docs/새.html'] });
  assert.equal(됨.결과[0].판정, '통과', JSON.stringify(됨));
  const 못봄 = await 짝.돌리기({ root, 고름, 올린: ['docs/새.html'] });
  assert.equal(못봄.결과[0].판정, '깨짐');
  assert.equal(못봄.결과[0].막음, true);
  assert.deepEqual(못봄.결과[0].안내, ['고친다: node tools/심기.js "docs/새.html"']);
  const 글 = 짝.글로({ 수: 1, 검사: ['새 지면 시험'], 결과: 못봄 }).join('\n');
  assert.match(글, /→ 고친다: node tools\/심기\.js "docs\/새\.html"/);
  assert.doesNotMatch(글, /→ 고친다: node tools\/심기\.js$/m, '시험의 안내가 있으면 표의 고침 줄은 뺀다');
  const 빈무늬 = await 짝.돌리기({ root, 고름: 고른(root, ['docs/새.html'], [{ ...시험줄, 시험: ['tests/새것.test.js', '^이런 이름은 없다'] }]), 올린: ['docs/새.html'] });
  assert.equal(빈무늬.결과[0].판정, '오류', '이름 무늬에 맞는 시험이 0개면 아무것도 안 잰 초록이 아니라 오류');
  assert.match(빈무늬.결과[0].글, /맞는 시험이 없다/);

  const 함수표 = (함수) => [{ 이름: '함수 줄', 단계: '시험', 함수, 고침: 'node 고침.js', 있어야: ['src/가.txt'], 원천: ['src/*.txt'], 결과물: [] }];
  const 낡은 = await 짝.돌리기({ root, 고름: 고른(root, ['src/가.txt'], 함수표(() => ({ 통과: false, 글: '사본이 다르다' }))), 올린: ['src/가.txt'] });
  assert.equal(낡은.결과[0].판정, '낡음');
  assert.equal(낡은.결과[0].글, '사본이 다르다');
  const 던짐 = await 짝.돌리기({ root, 고름: 고른(root, ['src/가.txt'], 함수표(() => { throw new Error('원본이 없다'); })), 올린: ['src/가.txt'] });
  assert.equal(던짐.결과[0].판정, '오류');
  assert.deepEqual(고른(root, ['src/가.txt'], [{ ...함수표(() => ({ 통과: true }))[0], 있어야: ['tools/없다.js'] }]), [], '있어야 파일이 없으면 없는 셈');
});

// ── 이 저장소의 표 ─────────────────────────────────────────────────────────────

test('기본표 — WORLD 묶음 전부 · 스크립트·결과물·정확한 원천이 저장소에 있고 · 묶음마다 묶인 모듈이 읽히고 · CI 단계 이름이 워크플로에 있다', () => {
  const 표 = 짝.기본표(REPO);
  const 이름들 = 표.map((x) => x.이름);
  for (const b of require('../tools/lib/atlas-copies.js').WORLD_BUNDLES) assert.ok(이름들.includes(b.label), `${b.label}이 표에 없다`);
  const 흐름 = fs.readFileSync(path.join(REPO, '.github/workflows/syntax-check.yml'), 'utf8');
  for (const 줄 of 표) {
    assert.ok(짝.있는줄(REPO, 줄), `${줄.이름}: 스크립트·시험 파일이 없다`);
    for (const p of [...(줄.결과물 || []), ...(줄.원천 || []), ...(줄.주석원천 || [])].filter((p) => !p.includes('*'))) {
      assert.ok(fs.existsSync(path.join(REPO, p)), `${줄.이름}: ${p}가 없다 — 옮겼거나 지웠으면 표도 고친다`);
    }
    for (const 묶음 of 줄.주석원천 || []) assert.ok(짝.묶인모듈(REPO, 묶음).length >= 1, `${줄.이름}: ${묶음}에서 묶인 모듈을 못 읽었다`);
    if (줄.시험 && 줄.시험[1]) {
      const 이름식 = new RegExp(`\\btest\\(\\s*['"\`]${줄.시험[1].replace(/^\^/, '')}`);
      assert.match(fs.readFileSync(path.join(REPO, 줄.시험[0]), 'utf8'), 이름식, `${줄.이름}: ${줄.시험[0]}에 이름 무늬 ${줄.시험[1]}에 맞는 시험이 없다`);
    }
    assert.ok(줄.단계.startsWith('tests/') ? fs.existsSync(path.join(REPO, 줄.단계)) : 흐름.includes(`name: ${줄.단계}`), `${줄.이름}: CI 단계 「${줄.단계}」가 워크플로에 없다`);
  }
  // CI가 그 단계에서 실제로 부르는 명령과 같은 스크립트다(package.json → sync-atlas · check-account-bundles · build-topik4-course).
  const 사슬 = ['package.json', 'tools/lib/atlas-copies.js', 'tools/check-account-bundles.js'].map((p) => fs.readFileSync(path.join(REPO, p), 'utf8')).join('\n');
  for (const 스크립트 of 표.filter((x) => x.명령).map((x) => x.명령[0])) {
    assert.ok(사슬.includes(path.basename(스크립트)), `${스크립트}: CI 명령 사슬(package.json·atlas-copies·check-account-bundles)에 없다`);
  }
  assert.match(흐름, /npm run check:atlas:local/);
  assert.match(흐름, /npm run check:account-bundles/);
  assert.match(흐름, /npm run check:topik4-course/);
});

test('기본표 — 10-20~10-22 master 빨강을 낸 push의 경로는 골리고, 기록·문서만 바꾼 push는 아무것도 안 골린다', () => {
  const 이름 = (바뀐) => 짝.고르기({ root: REPO, 바뀐 }).map((x) => x.줄.이름);
  // 8c9310b27·411f00623 — 문항 검수 판정 목록만 고치고 두 묶음을 안 다시 만들었다
  const 판정 = 이름(['experiences/topik-items/review/existing-verdicts.json']);
  assert.ok(판정.includes('WORLD life bundle') && 판정.includes('WORLD account bundle'), 판정.join(', '));
  // a06a17bff·b4b28e17a — 생활 모듈을 고치고 생활 묶음을 안 다시 만들었다
  assert.ok(이름(['experiences/synk-world-app/life-ui.mjs']).includes('WORLD life bundle'));
  assert.ok(이름(['experiences/synk-world-app/life-progress.mjs']).includes('WORLD life bundle'));
  // 1eb18efdb·3a669019e — SUIT를 이름으로 부르는 새 지면
  assert.ok(이름(['docs/마케팅/PULSE_포트폴리오_제작준비_20261012/video/jiyu-skincare-20261018/v7/모션/모션.html']).includes('지면 SUIT 싣기(지면폰트 ⑦)'));
  assert.ok(이름(['docs/온라인반_TOPIK4급/쓰기과제.md']).includes('TOPIK4 수업 문항'));
  assert.ok(이름(['atlas/engine.js']).includes('raw consumers and engine metadata'));
  assert.deepEqual(이름(['docs/_ops/트랙.md', 'docs/_ops/결정.md', 'docs/현장노트/git_줄끝_잠금.md', 'README.md', 'AGENTS.md']), []);
  assert.deepEqual(이름(['docs/마케팅/제작양식/만족사례_장부.md', 'tools/바로올리기.js']), []);
});

test('기본표 — 포털 외부 계정 원천과 실제 하위 의존은 선택하고 무관한 게임 파일은 제외한다', () => {
  const 포털 = (p) => 짝.고르기({ root: REPO, 바뀐: [p] }).some((x) => x.줄.이름 === '계정 포털·교사 연결 묶음');
  // 실제 account-view → account-host → play-data → 두 검증 모듈. 빌드된 사본의 주석에 의존하지 않는다.
  for (const p of ['experiences/play-common/account-host.mjs', 'experiences/play-common/play-data.mjs',
    'experiences/korean-racing/garage-core.js', 'experiences/hangul-stage/progress-data.mjs']) {
    assert.equal(포털(p), true, `포털에 묶이는 외부 원천을 놓쳤다: ${p}`);
  }
  for (const p of ['experiences/play-common/racing-command.mjs', 'experiences/play-common/account-host.test.mjs',
    'experiences/korean-racing/campaign.js', 'docs/_ops/트랙.md']) assert.equal(포털(p), false, p);
});

test('모듈 원천 — 실제 import 사슬만 따라 순환·중복·저장소 밖을 막고 생성물 누락도 잡는다', async (t) => {
  const { root } = 폴더(t, {
    'portal/entry.mjs': "import {host} from '../shared/host.mjs'; import('../shared/host.mjs');\n",
    'shared/host.mjs': "export {data as host} from './data.mjs';\n",
    'shared/data.mjs': "import '../portal/entry.mjs'; import {x} from '../portal/entry.mjs'; import('../../outside.mjs'); import('external-package'); export const data=1;\n",
    'shared/unrelated.mjs': 'export const other=1;\n',
  });
  const 표 = [짝줄({ 원천: [], 주석원천: [], 모듈원천: ['portal/entry.mjs', 'portal/entry.mjs', '../outside.mjs'] })];
  const 고름 = 고른(root, ['shared/data.mjs'], 표);
  assert.equal(고름.length, 1, '두 겹 아래 실제 원천이 바뀌면 생성물 검사를 선택한다');
  assert.deepEqual(고른(root, ['shared/unrelated.mjs', '../outside.mjs', 'node_modules/external-package/index.js'], 표), []);
  assert.equal(짝.보는파일(root, 표[0], { 읽기: false }).파일.has('shared/data.mjs'), false, '문서만 바꾸면 모듈 파일을 열지 않는다');
  const 결과 = await 짝.돌리기({ root, 고름, 올린: ['shared/data.mjs'], 더러운: [
    { 경로: 'shared/data.mjs', 추적: true }, { 경로: 'out/가.txt', 추적: true },
  ] });
  assert.equal(결과.결과[0].판정, '통과', '가짜 생성기 자체는 정상인 상태에서 빠뜨린 파일을 확인한다');
  assert.equal(결과.결과[0].막음, true);
  assert.deepEqual(결과.결과[0].안올린, [{ 경로: 'out/가.txt', 결과물: true }]);
});

for (const 지울 of ['experiences/play-common/account-host.mjs', 'experiences/play-common/play-data.mjs',
  'experiences/korean-racing/garage-core.js']) test(`기본표 — 실제 포털 의존 삭제도 선택한다: ${지울}`, (t) => {
  const { root } = 폴더(t, {});
  const 줄 = 짝.기본표(REPO).find((x) => x.이름 === '계정 포털·교사 연결 묶음');
  // 실제 원천을 격리 사본으로 옮긴 뒤 하나만 지운다. 작업본 원천·생성물은 건드리지 않는다.
  for (const p of 짝.보는파일(REPO, 줄).파일.keys()) {
    const 원본 = path.join(REPO, p);
    if (!fs.existsSync(원본) || !fs.statSync(원본).isFile()) continue;
    fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true });
    fs.copyFileSync(원본, path.join(root, p));
  }
  assert.equal(고른(root, [지울], [줄]).length, 1);
  fs.unlinkSync(path.join(root, 지울));
  assert.equal(고른(root, [지울], [줄]).length, 1, '삭제된 공유 원천도 생성기 검사를 선택해야 한다');
});

test('모듈 원천 — 없는 확장자 생략 import는 기존 해석 후보만 보고 일반 스크립트 계약은 유지한다', (t) => {
  const { root } = 폴더(t, { 'portal/entry.mjs': "export {x} from '../shared/missing';\n" });
  const 줄 = 짝줄({ 원천: [], 주석원천: [], 모듈원천: ['portal/entry.mjs'] });
  assert.deepEqual(짝.스크립트가부르는(root, 'portal/entry.mjs'), []);
  for (const p of ['shared/missing.js', 'shared/missing.mjs', 'shared/missing/index.js']) assert.equal(고른(root, [p], [줄]).length, 1);
  assert.deepEqual(고른(root, ['shared/missing.ts', 'shared/other.js'], [줄]), []);
});
