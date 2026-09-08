'use strict';
// 실물 범위는 읽기만 한다. 환경변수 명부와 게이트 판본은 합성 임시 자료로 잰다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { 검사 } = require('../tools/prism래칫.js');
const { 방아쇠목록 } = require('../tools/대장동봉검사.js');
const 저장소 = path.resolve(__dirname, '..');
const 명부경로 = 'docs/_ops/prism_접점등록.json';

function 환경비우기(t) {
  const 이전 = process.env.SYNK_PRISM_명부;
  delete process.env.SYNK_PRISM_명부;
  t.after(() => {
    if (이전 === undefined) delete process.env.SYNK_PRISM_명부;
    else process.env.SYNK_PRISM_명부 = 이전;
  });
}

function 픽스처(t) {
  환경비우기(t);
  const 부모 = fs.realpathSync(os.tmpdir());
  const 루트 = fs.mkdtempSync(path.join(부모, 'synk-prism-scope-'));
  t.after(() => {
    const 실제 = fs.realpathSync(루트);
    assert.equal(path.dirname(실제), 부모);
    assert.ok(path.basename(실제).startsWith('synk-prism-scope-'));
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
  return { 루트, 쓰기 };
}
const 명부내용 = (소비자) => JSON.stringify({ 소비자 });
const 소비자 = (경로, 갈래 = '학생') => ({ 경로, 갈래, 사유: '합성 견본' });

test('실물 기본 범위는 뿌리 .js 전부이며 하위 폴더로 새지 않는다', (t) => {
  환경비우기(t);
  const 파일수 = fs.readdirSync(저장소, { withFileTypes: true })
    .filter((항목) => 항목.isFile() && 항목.name.endsWith('.js')).length;
  const r = 검사({});
  assert.ok(r.셈);
  assert.equal(r.셈.범위파일수, 파일수);
  assert.ok(Object.values(r.셈).every(Number.isInteger));
});

test('실물 명부의 등록 소비자는 둘이고 학생·학부모 참조는 0이다', (t) => {
  환경비우기(t);
  const r = 검사({});
  assert.equal(r.종료코드, 0);
  assert.equal(r.셈.등록소비자수, 2);
  assert.equal(r.셈.학생학부모참조수, 0);
});

test('못 읽는 명부는 종료코드 2와 셈 null이다', (t) => {
  const f = 픽스처(t);
  const r = 검사({ 루트: f.루트, 명부: '없는명부.json' });
  assert.equal(r.종료코드, 2);
  assert.equal(r.셈, null);
});

test('환경변수로 저장소 밖 명부를 실제로 읽되 인자 경로 제한은 유지한다', (t) => {
  const f = 픽스처(t);
  const 항목들 = [소비자('합성a.js'), 소비자('합성b.js', '학부모'), 소비자('합성c.js')];
  const 외부 = f.쓰기('외부명부.json', 명부내용(항목들));
  assert.ok(path.relative(저장소, 외부).startsWith('..'));
  process.env.SYNK_PRISM_명부 = 외부;
  const r = 검사({});
  assert.equal(r.종료코드, 0);
  assert.equal(r.셈.등록소비자수, 항목들.length);
  const 인자 = 검사({ 명부: 외부 });
  assert.equal(인자.종료코드, 2);
  assert.equal(인자.셈, null);
});

test('환경변수와 인자 명부가 함께 있으면 인자가 우선한다', (t) => {
  const f = 픽스처(t);
  f.쓰기('견본.js', '// 합성 견본');
  f.쓰기('인자.json', 명부내용([소비자('견본.js')]));
  process.env.SYNK_PRISM_명부 = f.쓰기('환경.json', 명부내용([]));
  const r = 검사({ 루트: f.루트, 명부: '인자.json' });
  assert.equal(r.종료코드, 0);
  assert.equal(r.셈.등록소비자수, 1);
  assert.equal(검사({ 루트: f.루트 }).셈.등록소비자수, 0);
  // 잘못된 명시 인자는 환경변수로 덮어 통과시키지 않는다.
  assert.equal(검사({ 루트: f.루트, 명부: '' }).종료코드, 2);
});

test('환경변수 명부를 못 읽으면 기본 명부로 조용히 돌아가지 않는다', (t) => {
  const f = 픽스처(t);
  process.env.SYNK_PRISM_명부 = path.join(f.루트, '없음.json');
  const r = 검사({});
  assert.equal(r.종료코드, 2);
  assert.equal(r.셈, null);
});

test('새 뿌리 파일은 자동 검사하고 미등록 참조만 막으며 하위 파일은 제외한다', (t) => {
  const f = 픽스처(t);
  f.쓰기(명부경로, 명부내용([]));
  f.쓰기('견본.js', '// 합성 견본');
  f.쓰기('하위/견본.js', 'prism_out;');
  assert.equal(검사({ 루트: f.루트 }).셈.범위파일수, 1);
  f.쓰기('추가.js', '// 새 파일');
  const 추가 = 검사({ 루트: f.루트 });
  assert.equal(추가.종료코드, 0);
  assert.equal(추가.셈.범위파일수, 2);
  f.쓰기('추가.js', 'prism_new;');
  const 참조 = 검사({ 루트: f.루트 });
  assert.equal(참조.종료코드, 1);
  assert.equal(참조.셈.참조수, 1);
  assert.ok(참조.출력.includes('추가.js:1: prism_new'));
});

test('부품과 명부가 모두 동봉 게이트의 방아쇠에 한 번씩 들어간다', () => {
  for (const 경로 of ['tools/lib/prism대장절.js', 명부경로]) {
    assert.equal(방아쇠목록.filter((값) => 값 === 경로).length, 1);
  }
});

// Git 색인은 건드리지 않는다. 실제 게이트 코드를 격리 실행하고 판본·자식 실행만 합성한다.
for (const 경우 of [
  { 이름: '명부가 스테이징됐으면 색인 판', 상태: 'M', 기대판: '', 내용: 명부내용([소비자('색인.js')]) },
  { 이름: '명부가 스테이징되지 않았으면 HEAD 판', 기대판: 'HEAD', 내용: 명부내용([]) },
  { 이름: '색인에서 삭제됐으면 명부 환경변수를 넘기지 않는다', 상태: 'D', 기대판: '', 내용: null },
  { 이름: 'HEAD에도 없으면 명부 환경변수를 넘기지 않는다', 기대판: 'HEAD', 내용: null },
]) {
  test(`동봉 게이트: ${경우.이름}`, (t) => {
    const f = 픽스처(t);
    f.쓰기('tools/이해대장.js', '// 합성 판정기');
    f.쓰기(명부경로, 명부내용([소비자('작업본a.js'), 소비자('작업본b.js')]));
    const 코드 = fs.readFileSync(path.join(저장소, 'tools/대장동봉검사.js'), 'utf8');
    const 판본호출 = [];
    const 만든방 = [];
    let 실행수 = 0;
    let 종료코드;
    const 모듈 = {};
    const 불러오기 = (이름) => {
      if (이름 === 'node:os') return { tmpdir: () => f.루트 };
      if (이름 === 'node:fs') return {
        ...fs,
        mkdtempSync: (접두) => { const 방 = fs.mkdtempSync(접두); 만든방.push(방); return 방; },
        rmSync: (방, 옵션) => {
          const 실제 = fs.realpathSync(방);
          assert.equal(path.dirname(실제), f.루트);
          assert.ok(path.basename(실제).startsWith('synk-대장-'));
          fs.rmSync(실제, 옵션);
        },
      };
      if (이름 === 'node:child_process') return {
        execFileSync: (명령, 인자) => {
          assert.equal(명령, 'git');
          if (인자[0] === 'diff') {
            return (경우.상태 ? `${경우.상태}\0${명부경로}\0` : '')
              + (경우.상태 === 'M' ? '' : 'M\0tools/lib/prism대장절.js\0');
          }
          assert.equal(인자[0], 'show');
          판본호출.push(인자[1]);
          if (인자[1].endsWith(`:${명부경로}`)) {
            assert.equal(인자[1], `${경우.기대판}:${명부경로}`);
            if (경우.내용 === null) throw new Error('합성 판본 없음');
            return 경우.내용;
          }
          return '합성 정본 또는 화면';
        },
        spawnSync: (명령, 인자, 옵션) => {
          실행수++;
          assert.equal(명령, process.execPath);
          assert.equal(인자[1], '--검사');
          assert.equal(옵션.env.CLAUDE_PROJECT_DIR, undefined);
          if (경우.내용 === null) assert.equal(옵션.env.SYNK_PRISM_명부, undefined);
          else {
            const 파일 = 옵션.env.SYNK_PRISM_명부;
            assert.equal(path.dirname(파일), path.dirname(옵션.env.SYNK_대장_정본));
            assert.equal(fs.readFileSync(파일, 'utf8'), 경우.내용);
          }
          return { status: 0 };
        },
      };
      if (이름 === '../tests/lib/소스검사.js') return require('./lib/소스검사.js');
      return require(이름);
    };
    불러오기.main = 모듈;
    vm.runInNewContext(코드, {
      require: 불러오기, module: 모듈, __dirname: path.join(f.루트, 'tools'),
      process: {
        execPath: process.execPath,
        env: { CLAUDE_PROJECT_DIR: '합성_다른루트', SYNK_PRISM_명부: '합성_환경명부' },
        stdout: { write() {} }, stderr: { write() {} }, exit: (값) => { 종료코드 = 값; },
      },
    });
    assert.equal(종료코드, 0);
    assert.equal(실행수, 1);
    assert.equal(만든방.length, 1);
    assert.ok(판본호출.includes(`${경우.기대판}:${명부경로}`));
    assert.ok(만든방.every((방) => !fs.existsSync(방)));
  });
}
