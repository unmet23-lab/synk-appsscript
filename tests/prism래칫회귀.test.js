'use strict';
// 라운드 2: 일부 탐색 실패와 같은 파일의 다른 표기로 금칙 검사를 우회하지 못한다.
// 기존 계약 시험을 보존하고, 임시 폴더의 합성 파일만으로 지적을 재현한다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { 검사, 실행 } = require('../tools/prism래칫.js');

function 픽스처(t) {
  const 부모 = fs.realpathSync(os.tmpdir());
  const 루트 = fs.mkdtempSync(path.join(부모, 'synk-prism-round2-'));
  t.after(() => {
    const 실제 = fs.realpathSync(루트);
    assert.equal(path.dirname(실제), 부모);
    assert.ok(path.basename(실제).startsWith('synk-prism-round2-'));
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
  const 명부 = (소비자) => 쓰기('docs/_ops/prism_접점등록.json', JSON.stringify({ 소비자 }));
  쓰기('엔진_운영배치.js', '// 빈 견본');
  쓰기('엔진_폼리포트.js', '// 빈 견본');
  명부([]);
  return { 루트, 쓰기, 명부 };
}
const 소비자 = (경로, 갈래) => ({ 경로, 갈래, 사유: '합성 접점' });
function 확인불가(결과, 무늬) {
  assert.equal(결과.종료코드, 2);
  assert.equal(결과.출력.length, 1);
  assert.match(결과.출력[0], /^확인 불가: /);
  assert.match(결과.출력[0], 무늬);
}

test('glob 대안의 다른 파일이 매치돼도 디렉터리 읽기 실패를 숨기지 않는다', (t) => {
  const f = 픽스처(t);
  const 파일 = f.쓰기('tools/lib/probe.js', 'prism_probe();');
  const 원래읽기 = fs.readdirSync;
  let 코드 = 'EACCES';
  let 실패호출수 = 0;
  t.mock.method(fs, 'readdirSync', function (디렉터리, ...인자) {
    if (path.resolve(디렉터리) === path.dirname(파일)) {
      실패호출수++;
      throw Object.assign(new Error('합성 탐색 실패'), { code: 코드 });
    }
    return 원래읽기.call(this, 디렉터리, ...인자);
  });
  for (const 값 of ['EACCES', 'EPERM', 'ENOENT']) {
    코드 = 값;
    확인불가(검사({ 루트: f.루트, 범위: ['{엔진_폼리포트.js,tools/lib/*.js}'] }), /tools\/lib/);
  }
  assert.equal(실패호출수, 3);
});

test('재귀 glob에서 일부 하위 폴더만 못 읽어도 확인 불가다', (t) => {
  const f = 픽스처(t);
  f.쓰기('접점/a.js', '// 빈 견본');
  const 파일 = f.쓰기('접점/안쪽/probe.js', 'prism_probe();');
  const 원래읽기 = fs.readdirSync;
  t.mock.method(fs, 'readdirSync', function (디렉터리, ...인자) {
    if (path.resolve(디렉터리) === path.dirname(파일)) {
      throw Object.assign(new Error('합성 탐색 실패'), { code: 'EACCES' });
    }
    return 원래읽기.call(this, 디렉터리, ...인자);
  });
  확인불가(실행(['--범위', '접점/**/*.js'], { 루트: f.루트 }), /접점\/안쪽/);
});

test('대안의 고정 디렉터리 상태 확인 실패도 다른 매치로 덮지 않는다', (t) => {
  const f = 픽스처(t);
  const 파일 = f.쓰기('tools/lib/probe.js', 'prism_probe();');
  const 원래상태 = fs.lstatSync;
  t.mock.method(fs, 'lstatSync', function (경로, ...인자) {
    if (path.resolve(경로) === path.dirname(파일)) {
      throw Object.assign(new Error('합성 상태 확인 실패'), { code: 'EACCES' });
    }
    return 원래상태.call(this, 경로, ...인자);
  });
  확인불가(검사({ 루트: f.루트, 범위: ['{엔진_폼리포트.js,tools/lib/*.js}'] }), /tools\/lib/);
});

test('범위 밖 디렉터리는 탐색하지 않고, 빈 대안은 다른 매치와 함께 허용한다', (t) => {
  const f = 픽스처(t);
  const 파일 = f.쓰기('범위밖/probe.js', 'prism_probe();');
  const 원래읽기 = fs.readdirSync;
  let 범위밖호출수 = 0;
  t.mock.method(fs, 'readdirSync', function (디렉터리, ...인자) {
    if (path.resolve(디렉터리) === path.dirname(파일)) {
      범위밖호출수++;
      throw Object.assign(new Error('합성 범위 밖 실패'), { code: 'EACCES' });
    }
    return 원래읽기.call(this, 디렉터리, ...인자);
  });
  const r = 실행(['--범위', '{엔진_폼리포트.js,없는/*.js}'], { 루트: f.루트 });
  assert.equal(r.종료코드, 0);
  assert.equal(r.출력.at(-1), '범위 파일 2 · 참조 0 · 등록 소비자 0 · 학생·학부모 참조 0');
  assert.equal(범위밖호출수, 0);
});

test('Windows의 같은 파일을 대소문자만 바꿔 중복 등록하면 거절한다', { skip: process.platform !== 'win32' }, (t) => {
  const f = 픽스처(t);
  f.쓰기('tools/probe.js', 'prism_a(); prism_b(); prism_c();');
  for (const 갈래 of ['학생', '내부']) {
    f.명부([소비자('tools/probe.js', '학생'), 소비자('tools/PROBE.JS', 갈래)]);
    확인불가(검사({ 루트: f.루트, 범위: ['tools/PROBE.JS'] }), /두 번 등록/);
  }
});

test('Windows의 다른 대소문자 경로에서도 등록한 갈래로 참조를 판정한다', { skip: process.platform !== 'win32' }, (t) => {
  const f = 픽스처(t);
  f.쓰기('tools/probe.js', 'prism_a(); prism_b(); prism_c();');
  for (const 갈래 of ['학생', '학부모', '강사', '내부']) {
    for (const [등록경로, 검사경로] of [['tools/probe.js', 'tools/PROBE.JS'], ['TOOLS/PROBE.JS', 'tools/probe.js']]) {
      f.명부([소비자(등록경로, 갈래)]);
      const r = 검사({ 루트: f.루트, 범위: [검사경로] });
      const 금지 = 갈래 === '학생' || 갈래 === '학부모';
      assert.equal(r.종료코드, 금지 ? 1 : 0);
      assert.equal(r.출력.at(-1), `범위 파일 1 · 참조 3 · 등록 소비자 1 · 학생·학부모 참조 ${금지 ? 3 : 0}`);
    }
  }
});

test('Windows의 기본 범위를 대문자 확장자로 더해도 파일과 참조를 중복 집계하지 않는다', { skip: process.platform !== 'win32' }, (t) => {
  const f = 픽스처(t);
  f.쓰기('엔진_운영배치.js', 'prism_probe();');
  f.명부([소비자('엔진_운영배치.js', '내부')]);
  const r = 실행(['--범위', '엔진_운영배치.JS'], { 루트: f.루트 });
  assert.equal(r.종료코드, 0);
  assert.equal(r.출력.at(-1), '범위 파일 2 · 참조 1 · 등록 소비자 1 · 학생·학부모 참조 0');
});

test('루트 안의 디렉터리 링크도 같은 파일의 등록·집계 열쇠를 공유한다', (t) => {
  const f = 픽스처(t);
  f.쓰기('접점/probe.js', 'prism_probe();');
  fs.symlinkSync(path.join(f.루트, '접점'), path.join(f.루트, '별칭'), process.platform === 'win32' ? 'junction' : 'dir');
  f.명부([소비자('접점/probe.js', '학생')]);
  const r = 검사({ 루트: f.루트, 범위: ['접점/*.js', '별칭/*.js'] });
  assert.equal(r.종료코드, 1);
  assert.equal(r.출력.at(-1), '범위 파일 1 · 참조 1 · 등록 소비자 1 · 학생·학부모 참조 1');
  f.명부([소비자('접점/probe.js', '학생'), 소비자('별칭/probe.js', '내부')]);
  확인불가(검사({ 루트: f.루트, 범위: ['별칭/*.js'] }), /두 번 등록/);
});

test('탐색을 바꿔도 중첩 대안·범위·확장 glob·숨김 경로의 매치를 보존한다', (t) => {
  const f = 픽스처(t);
  for (const 경로 of ['src/a1.js', 'src/a2.js', 'src/b1.ts', 'src/sub/c1.js',
    'src/.hidden/probe.js', 'src/.hidden/deep/.more/probe.js']) {
    f.쓰기(경로, 'prism_probe();');
  }
  const 경우들 = [
    ['src/*.{js,ts}', ['src/a1.js', 'src/a2.js', 'src/b1.ts']],
    ['src/{a{1,2}.js,sub/*.js}', ['src/a1.js', 'src/a2.js', 'src/sub/c1.js']],
    ['src/a{1..2}.js', ['src/a1.js', 'src/a2.js']],
    ['src/+(a1|a2).js', ['src/a1.js', 'src/a2.js']],
    ['src/**/c?.js', ['src/sub/c1.js']],
    ['src/**/.*/*.js', ['src/.hidden/deep/.more/probe.js', 'src/.hidden/probe.js']],
  ];
  for (const [패턴, 예상] of 경우들) {
    // 오류 없는 합성 트리에서는 종전 Node glob과 같은 파일을 골라야 한다.
    assert.deepEqual(fs.globSync(패턴, { cwd: f.루트 }).map((값) => 값.replace(/\\/g, '/')).sort(), 예상, 패턴);
    const r = 검사({ 루트: f.루트, 범위: [패턴] });
    assert.equal(r.종료코드, 1, 패턴);
    assert.deepEqual(r.출력.slice(0, -1).map((줄) => 줄.split(':')[0]), 예상, 패턴);
    assert.equal(r.출력.at(-1), `범위 파일 ${예상.length} · 참조 ${예상.length} · 등록 소비자 0 · 학생·학부모 참조 0`);
  }
});
