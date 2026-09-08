'use strict';
/* Prism 계약·접점 래칫 회귀 — 분모/주장 범위 누락과 금지 접점 참조를 막는다.
 * 래칫의 파일·명부는 전부 임시 폴더의 합성 견본이다. 저장소 실물은 고치지 않는다.
 * 참조를 심은 양성 대조와 읽기 실패를 함께 재어 «못 본 0»이 통과하지 않게 한다.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 검증 } = require('../tools/lib/prism계약.js');
const { 검사, 실행, 자가시험 } = require('../tools/prism래칫.js');

const 도구 = path.resolve(__dirname, '../tools/prism래칫.js');
const 정상 = (덮기 = {}) => ({
  값: 31, n: 12, 분모: 39, 판: 'a1b2c3d', 출처: 'prism/조사여격', 키출처: 'grammar_id',
  대상: 'SYNK LAB 1기', 과업: '문장쓰기', 조건: '4급/자유작문',
  기간: '2026-11-01~2026-12-20', 독립수: 7, 편중: 0.29,
  ...덮기,
});
const 통과 = { 통과: true, 사유: [] };
const 거절 = (...사유) => ({ 통과: false, 사유 });

test('완비 행은 통과하며 입력을 고치지 않는다', () => {
  const 행 = Object.freeze(정상());
  assert.deepEqual(검증(행), 통과);
  assert.equal(행.값, 31);
});

test('행 없음은 다른 검사 없이 행없음 하나만 낸다', () => {
  for (const 행 of [null, undefined, 0, '', false, '견본', () => {}, []]) {
    assert.deepEqual(검증(행, { 갈래: '미정' }), 거절('행없음'));
  }
});

test('값은 undefined/키 누락만 거절하고 0·빈 문자열·false는 있는 값이다', () => {
  const 행 = 정상();
  delete 행.값;
  assert.deepEqual(검증(행), 거절('값없음'));
  assert.deepEqual(검증(정상({ 값: undefined })), 거절('값없음'));
  for (const 값 of [0, '', false, null]) assert.deepEqual(검증(정상({ 값 })), 통과);
});

test('n은 유한한 비음수만 받되 0과 소수도 받는다', () => {
  for (const n of [undefined, null, NaN, Infinity, -Infinity, -1, '12', false]) {
    assert.deepEqual(검증(정상({ n })), 거절('n없음'));
  }
  for (const n of [0, 0.5]) assert.deepEqual(검증(정상({ n })), 통과);
});

test('분모는 유한한 양수만 받으며 값과 n이 0이어도 필요하다', () => {
  for (const 분모 of [undefined, null, NaN, Infinity, -Infinity, -1, 0, '39', false]) {
    assert.deepEqual(검증(정상({ 분모 })), 거절('분모없음'));
  }
  assert.deepEqual(검증(정상({ 분모: 0.5 })), 통과);
  assert.deepEqual(검증(정상({ 값: 0, n: 0, 분모: 0, 출처: 'prism/x', 독립수: 0, 편중: null })), 거절('분모없음'));
  assert.deepEqual(검증(정상({ 값: 0, n: 0, 독립수: 0, 편중: null })), 통과);
});

for (const 칸 of ['판', '출처', '키출처', '대상', '과업', '조건', '기간']) {
  test(`${칸}은 비어 있지 않은 문자열을 받으며 형식을 제한하지 않는다`, () => {
    for (const 값 of [undefined, null, '', ' \t\n', 0, false, [], {}]) {
      assert.deepEqual(검증(정상({ [칸]: 값 })), 거절(`${칸}없음`));
    }
    assert.deepEqual(검증(정상({ [칸]: ' 형식 미정 ' })), 통과);
  });
}

test('독립수는 유한한 비음수 정수만 받는다', () => {
  for (const 독립수 of [undefined, null, NaN, Infinity, -Infinity, -1, 0.5, '7', false]) {
    assert.deepEqual(검증(정상({ 독립수 })), 거절('독립수없음'));
  }
  assert.deepEqual(검증(정상({ 독립수: 1 })), 통과);
  assert.deepEqual(검증(정상({ 독립수: 0, 편중: null })), 통과);
});

test('독립수만 null로 바꾼 완비 행은 편중 검사를 건너뛴다', () => {
  assert.deepEqual(검증(정상({ 독립수: null })), 거절('독립수없음'));
  assert.deepEqual(검증(정상({ 독립수: null, 편중: undefined })), 거절('독립수없음'));
});

test('독립수가 양수이면 편중은 유한한 0~1이며 양 끝을 포함한다', () => {
  for (const 편중 of [undefined, null, NaN, Infinity, -Infinity, -0.1, 1.1, '0.29', false]) {
    assert.deepEqual(검증(정상({ 편중 })), 거절('편중없음'));
  }
  for (const 편중 of [0, 0.5, 1]) assert.deepEqual(검증(정상({ 편중 })), 통과);
});

test('독립수가 0이면 편중은 null이어야 한다', () => {
  for (const 편중 of [undefined, 0, 0.5, 1, NaN, Infinity, 'null', false]) {
    assert.deepEqual(검증(정상({ 독립수: 0, 편중 })), 거절('편중없음'));
  }
  assert.deepEqual(검증(정상({ 독립수: 0, 편중: null })), 통과);
});

test('출처와 키출처의 학생행 무늬 넷을 대소문자 구분 없이 거절한다', () => {
  for (const 칸 of ['출처', '키출처']) {
    for (const 무늬 of ['student_id', 'STUDENT_ID', 'learner_id', 'LeArNeR_Id', 'profiles', 'PROFILES', '이름']) {
      assert.deepEqual(검증(정상({ [칸]: `견본/${무늬}/집계` })), 거절('학생행'));
    }
  }
  assert.deepEqual(검증(정상({ 출처: 'student_id', 키출처: 'profiles' })), 거절('학생행'));
  // 이 시험은 한계를 못 박는다. 목록 밖의 학생 무늬까지 안전하다는 뜻이 아니다.
  assert.deepEqual(검증(정상({ 출처: 'git/student_rows.json' })), 통과);
});

test('학생·학부모의 값·설명·라벨 문자열에서 대조 낱말 셋을 찾는다', () => {
  for (const 갈래 of ['학생', '학부모']) {
    for (const 칸 of ['값', '설명', '라벨']) {
      for (const 낱말 of ['평균', '일반', '다른 학생']) {
        assert.deepEqual(검증(정상({ [칸]: `견본 ${낱말} 문구` }), { 갈래 }), 거절('대조낱말'));
      }
    }
    assert.deepEqual(검증(정상({ 값: '평균', 설명: '일반', 라벨: '다른 학생' }), { 갈래 }), 거절('대조낱말'));
    assert.deepEqual(검증(정상({ 값: false, 설명: 0, 라벨: null }), { 갈래 }), 통과);
    assert.deepEqual(검증(정상({ 대상: '몽골어 화자 일반' }), { 갈래 }), 통과);
  }
});

test('옵션 생략·강사·내부에는 낱말 필터가 없다', () => {
  const 행 = 정상({ 값: '평균', 설명: '일반', 라벨: '다른 학생' });
  for (const 옵션 of [undefined, { 갈래: '강사' }, { 갈래: '내부' }]) {
    assert.deepEqual(검증(행, 옵션), 통과);
  }
});

test('모르는 갈래는 거절하고 낱말 검사는 건너뛴다', () => {
  for (const 옵션 of [{ 갈래: '미정' }, { 갈래: '' }, { 갈래: null }, {}, null, false]) {
    assert.deepEqual(검증(정상({ 값: '평균' }), 옵션), 거절('갈래모름'));
  }
});

test('여러 결함의 사유는 계약 순서이며 독립수가 없으면 편중없음을 붙이지 않는다', () => {
  assert.deepEqual(검증({ 분모: 1, 판: 'x' }), 거절(
    '값없음', 'n없음', '출처없음', '키출처없음',
    '대상없음', '과업없음', '조건없음', '기간없음', '독립수없음',
  ));
  assert.deepEqual(검증({}, { 갈래: '미정' }), 거절(
    '값없음', 'n없음', '분모없음', '판없음', '출처없음', '키출처없음',
    '대상없음', '과업없음', '조건없음', '기간없음', '독립수없음', '갈래모름',
  ));
  assert.deepEqual(검증({ 출처: 'profiles', 독립수: 1, 설명: '일반' }, { 갈래: '학생' }), 거절(
    '값없음', 'n없음', '분모없음', '판없음', '키출처없음',
    '대상없음', '과업없음', '조건없음', '기간없음', '편중없음', '학생행', '대조낱말',
  ));
  assert.deepEqual(검증({ 출처: 'profiles' }, { 갈래: '미정' }), 거절(
    '값없음', 'n없음', '분모없음', '판없음', '키출처없음',
    '대상없음', '과업없음', '조건없음', '기간없음', '독립수없음', '학생행', '갈래모름',
  ));
});

function 픽스처(t) {
  const 부모 = fs.realpathSync(os.tmpdir());
  const 루트 = fs.mkdtempSync(path.join(부모, 'synk-prism-test-'));
  t.after(() => {
    // 삭제 대상이 우리가 만든 임시 폴더인지 절대 경로로 확인한다.
    const 실제 = fs.realpathSync(루트);
    assert.equal(path.dirname(실제), 부모);
    assert.ok(path.basename(실제).startsWith('synk-prism-test-'));
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
  const 명부 = (자료) => 쓰기('docs/_ops/prism_접점등록.json', JSON.stringify(자료));
  쓰기('엔진_운영배치.js', '// 빈 견본\n');
  쓰기('엔진_폼리포트.js', '// 빈 견본\n');
  명부({ 소비자: [] });
  return { 루트, 쓰기, 명부 };
}

const 소비자 = (경로, 갈래 = '내부') => ({ 경로, 갈래, 사유: '합성 접점 견본' });
const 마지막 = (r) => r.출력.at(-1);
function 확인불가(r, 무늬) {
  assert.equal(r.종료코드, 2);
  assert.equal(r.출력.length, 1);
  assert.match(r.출력[0], /^확인 불가: /);
  assert.doesNotMatch(r.출력[0], /[\r\n]/);
  if (무늬) assert.match(r.출력[0], 무늬);
}

test('빈 명부와 참조 없는 기본 파일 둘은 실제 셈을 마지막 줄에 낸다', (t) => {
  const f = 픽스처(t);
  const r = 검사({ 루트: f.루트 });
  assert.equal(r.종료코드, 0);
  assert.deepEqual(r.출력, ['범위 파일 2 · 참조 0 · 등록 소비자 0 · 학생·학부모 참조 0']);
});

test('명부 파일 없음과 깨진 JSON은 확인 불가이며 원문은 출력하지 않는다', (t) => {
  const f = 픽스처(t);
  확인불가(검사({ 루트: f.루트, 명부: '없는명부.json' }), /없는명부\.json/);
  f.쓰기('docs/_ops/prism_접점등록.json', '{\n"합성_비공개_내용": 깨짐');
  const r = 검사({ 루트: f.루트 });
  확인불가(r, /JSON/);
  assert.doesNotMatch(r.출력[0], /합성_비공개_내용/);
});

test('명부 최상위 소비자 누락·배열 아님은 확인 불가다', (t) => {
  const f = 픽스처(t);
  for (const 자료 of [null, [], false, {}, { 소비자: null }, { 소비자: {} }, { 소비자: '' }]) {
    f.명부(자료);
    확인불가(검사({ 루트: f.루트 }), /소비자 배열/);
  }
});

test('명부 항목 객체·경로·갈래·사유의 잘못된 값은 확인 불가다', (t) => {
  const f = 픽스처(t);
  const 정상항목 = 소비자('견본.js');
  for (const 항목 of [null, [], '견본', 0, false]) {
    f.명부({ 소비자: [항목] });
    확인불가(검사({ 루트: f.루트 }), /객체/);
  }
  for (const 칸 of ['경로', '갈래', '사유']) {
    for (const 값 of [undefined, null, '', ' \t', 0, false, {}]) {
      f.명부({ 소비자: [{ ...정상항목, [칸]: 값 }] });
      확인불가(검사({ 루트: f.루트 }), new RegExp(칸));
    }
  }
  f.명부({ 소비자: [{ ...정상항목, 갈래: '미정' }] });
  확인불가(검사({ 루트: f.루트 }), /갈래/);
});

test('정규화한 같은 경로는 갈래가 같든 다르든 중복으로 거절한다', (t) => {
  const f = 픽스처(t);
  for (const 갈래 of ['내부', '학생']) {
    f.명부({ 소비자: [소비자('./접점/견본.js'), 소비자('.\\접점\\견본.js', 갈래)] });
    확인불가(검사({ 루트: f.루트 }), /두 번 등록/);
  }
});

test('명부 경로의 역슬래시·앞 ./를 걷어 파일과 비교하며 K는 항목 수다', (t) => {
  const f = 픽스처(t);
  f.쓰기('접점/견본.js', 'prism_value;');
  f.명부({ 소비자: [소비자('.\\.\\접점\\견본.js'), 소비자('아직없는.js', '강사')] });
  const r = 실행(['--범위', './접점/*.js'], { 루트: f.루트 });
  assert.equal(r.종료코드, 0);
  assert.equal(마지막(r), '범위 파일 3 · 참조 1 · 등록 소비자 2 · 학생·학부모 참조 0');
});

test('미등록 한글 이름 prism_시험용을 줄번호와 함께 잡는다', (t) => {
  const f = 픽스처(t);
  f.쓰기('엔진_운영배치.js', '// 견본\nprism_시험용();\n');
  const r = 검사({ 루트: f.루트 });
  assert.equal(r.종료코드, 1);
  assert.deepEqual(r.출력, [
    '엔진_운영배치.js:2: prism_시험용',
    '범위 파일 2 · 참조 1 · 등록 소비자 0 · 학생·학부모 참조 0',
  ]);
});

test('주석·문자열·선언·객체 키·호출을 모두 세고 같은 줄의 반복도 센다', (t) => {
  const f = 픽스처(t);
  f.쓰기('엔진_운영배치.js', [
    '// prism_comment prism_조사여격',
    'const text = "prism_text";',
    'function prism_decl() {}',
    'const obj = { prism_key: true }; prism_call(); prism_call();',
    'xprism_no; _prism_no; prism_; PRISM_no;',
  ].join('\r\n'));
  const r = 검사({ 루트: f.루트 });
  assert.equal(r.종료코드, 1);
  assert.deepEqual(r.출력, [
    '엔진_운영배치.js:1: prism_comment',
    '엔진_운영배치.js:1: prism_조사여격',
    '엔진_운영배치.js:2: prism_text',
    '엔진_운영배치.js:3: prism_decl',
    '엔진_운영배치.js:4: prism_key',
    '엔진_운영배치.js:4: prism_call',
    '엔진_운영배치.js:4: prism_call',
    '범위 파일 2 · 참조 7 · 등록 소비자 0 · 학생·학부모 참조 0',
  ]);
});

test('학생·학부모 참조는 상한 0이며 실패 마지막 줄에도 실제 합계를 낸다', (t) => {
  const f = 픽스처(t);
  f.쓰기('엔진_운영배치.js', 'prism_a; prism_b;');
  f.쓰기('엔진_폼리포트.js', 'prism_c;');
  f.명부({ 소비자: [소비자('엔진_운영배치.js', '학생'), 소비자('엔진_폼리포트.js', '학부모')] });
  const r = 검사({ 루트: f.루트 });
  assert.equal(r.종료코드, 1);
  assert.deepEqual(r.출력, [
    '엔진_운영배치.js:1: prism_a', '엔진_운영배치.js:1: prism_b', '엔진_폼리포트.js:1: prism_c',
    '범위 파일 2 · 참조 3 · 등록 소비자 2 · 학생·학부모 참조 3',
  ]);
});

test('강사·내부의 여러 참조는 통과하며 학생·학부모도 참조가 없으면 통과한다', (t) => {
  const f = 픽스처(t);
  f.쓰기('접점/강사.js', 'prism_a; prism_b;');
  f.쓰기('접점/내부.js', 'prism_c; prism_d;');
  f.명부({ 소비자: [소비자('엔진_운영배치.js', '학생'), 소비자('엔진_폼리포트.js', '학부모'),
    소비자('접점/강사.js', '강사'), 소비자('접점/내부.js')] });
  const r = 실행(['--범위', '접점/*.js'], { 루트: f.루트 });
  assert.equal(r.종료코드, 0);
  assert.equal(마지막(r), '범위 파일 4 · 참조 4 · 등록 소비자 4 · 학생·학부모 참조 0');
});

test('기본 범위를 유지하며 glob을 더하고 겹친 파일은 한 번만 센다', (t) => {
  const f = 픽스처(t);
  f.쓰기('접점/a.js', 'prism_a;');
  f.쓰기('접점/안쪽/b.js', 'prism_b;');
  f.쓰기('범위밖.js', 'prism_out;');
  f.명부({ 소비자: [소비자('접점/a.js'), 소비자('접점/안쪽/b.js')] });
  const r = 실행(['--범위', './접점/**/*.js', '--범위', '.\\접점\\a.js', '--범위', './엔진_*.js'], { 루트: f.루트 });
  assert.equal(r.종료코드, 0);
  assert.equal(마지막(r), '범위 파일 4 · 참조 2 · 등록 소비자 2 · 학생·학부모 참조 0');
});

test('glob의 대안·문자 집합·물음표도 저장소 루트 안에서 푼다', (t) => {
  const f = 픽스처(t);
  f.쓰기('접점/a1.js', '// 견본');
  f.쓰기('접점/b2.ts', '// 견본');
  const r = 실행(['--범위', '접점/[ab]?.{js,ts}'], { 루트: f.루트 });
  assert.equal(r.종료코드, 0);
  assert.equal(마지막(r), '범위 파일 4 · 참조 0 · 등록 소비자 0 · 학생·학부모 참조 0');
});

test('추가 패턴 하나만 무일치여도 기본 파일 둘로 통과하지 않는다', (t) => {
  const f = 픽스처(t);
  확인불가(실행(['--범위', '오타/**/*.js'], { 루트: f.루트 }), /오타\/\*\*\/\*\.js/);
  확인불가(검사({ 루트: f.루트, 범위: ['없는기본.js', '엔진_폼리포트.js'] }), /없는기본\.js/);
});

test('파일 총수가 0이거나 디렉터리만 맞으면 확인 불가다', (t) => {
  const f = 픽스처(t);
  확인불가(검사({ 루트: f.루트, 범위: [] }), /범위 파일이 없다/);
  확인불가(검사({ 루트: f.루트, 범위: ['docs'] }), /파일이 없다/);
});

test('상위 이탈·절대 경로·대안 속 이탈은 glob을 펼치기 전에 거절한다', (t) => {
  const f = 픽스처(t);
  const 원래glob = fs.globSync;
  let 호출수 = 0;
  t.mock.method(fs, 'globSync', (...인자) => { 호출수++; return 원래glob(...인자); });
  for (const 패턴 of ['../*.js', '..\\*.js', '접점/../../*.js', '/tmp/*.js', 'C:\\임시\\*.js',
    'C:견본.js', '\\\\server\\share\\*.js', '{..,접점}/*.js', '{/tmp,접점}/*.js']) {
    확인불가(실행(['--범위', 패턴], { 루트: f.루트 }), /저장소 밖/);
  }
  assert.equal(호출수, 0);
});

test('명부도 저장소 밖 경로와 줄바꿈 경로를 거절한다', (t) => {
  const f = 픽스처(t);
  for (const 경로 of ['../견본.js', '/tmp/견본.js', 'C:\\견본.js', '견본\n.js']) {
    f.명부({ 소비자: [소비자(경로)] });
    확인불가(검사({ 루트: f.루트 }), /경로/);
  }
});

test('읽기 권한 오류와 탐색 뒤 삭제를 조용히 건너뛰지 않는다', (t) => {
  const f = 픽스처(t);
  const 원래읽기 = fs.readFileSync;
  let 오류코드 = 'EACCES';
  t.mock.method(fs, 'readFileSync', function (파일, ...인자) {
    if (파일 === path.join(f.루트, '엔진_폼리포트.js')) {
      const 오류 = new Error('합성 읽기 실패');
      오류.code = 오류코드;
      throw 오류;
    }
    return 원래읽기.call(this, 파일, ...인자);
  });
  for (const 코드 of ['EACCES', 'ENOENT']) {
    오류코드 = 코드;
    확인불가(검사({ 루트: f.루트 }), /범위 파일을 읽을 수 없다 — 엔진_폼리포트\.js/);
  }
});

test('저장소 밖으로 이어진 링크는 파일 내용을 읽기 전에 거절한다', (t) => {
  const f = 픽스처(t);
  const 원래실경로 = fs.realpathSync;
  const 바깥 = path.resolve(f.루트, '..', '합성바깥.js');
  t.mock.method(fs, 'realpathSync', function (파일, ...인자) {
    if (파일 === path.join(f.루트, '엔진_운영배치.js')) return 바깥;
    return 원래실경로.call(this, 파일, ...인자);
  });
  확인불가(검사({ 루트: f.루트 }), /범위 파일을 확인할 수 없다 — 엔진_운영배치\.js/);
});

test('알 수 없는 CLI 인자와 빠진 glob은 확인 불가다', (t) => {
  const f = 픽스처(t);
  for (const 인자 of [['--미정'], ['--범위'], ['--범위', ''], ['--범위', '--자가시험']]) {
    확인불가(실행(인자, { 루트: f.루트 }));
  }
});

function 자식실행(f, 인자 = []) {
  // 실제 도구의 실행 함수를 임시 루트로 부른다. 라이브 파일은 읽지 않는다.
  const 코드 = 'const r = require(process.argv[1]).실행(process.argv.slice(3), {루트: process.argv[2]});'
    + ' for (const l of r.출력) console.log(l); process.exitCode = r.종료코드;';
  const r = spawnSync(process.execPath, ['-e', 코드, 도구, f.루트, ...인자], {
    cwd: f.루트, encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(r.error);
  assert.equal(r.signal, null);
  return r;
}

test('자식 프로세스에서도 종료코드 0·1·2를 실제로 낸다', (t) => {
  const f = 픽스처(t);
  assert.equal(자식실행(f).status, 0);
  f.쓰기('엔진_운영배치.js', 'prism_시험용;');
  const 위반 = 자식실행(f);
  assert.equal(위반.status, 1);
  assert.match(위반.stdout, /엔진_운영배치\.js:1: prism_시험용/);
  assert.equal(위반.stdout.trim().split(/\r?\n/).at(-1), '범위 파일 2 · 참조 1 · 등록 소비자 0 · 학생·학부모 참조 0');
  assert.equal(자식실행(f, ['--범위', '없는/*.js']).status, 2);
});

test('자가시험은 실제 명부·범위와 무관하게 한글 양성 대조를 잡고 임시 폴더를 지운다', (t) => {
  const f = 픽스처(t);
  f.쓰기('docs/_ops/prism_접점등록.json', '깨진 명부');
  const 원래임시 = fs.mkdtempSync;
  const 만든곳 = [];
  t.mock.method(fs, 'mkdtempSync', function (...인자) {
    const 결과 = 원래임시.apply(this, 인자);
    만든곳.push(결과);
    return 결과;
  });
  const r = 실행(['--자가시험', '--범위', '없는/*.js'], { 루트: path.join(f.루트, '없는루트') });
  assert.equal(r.종료코드, 0);
  assert.equal(r.출력.length, 1);
  assert.match(r.출력[0], /자가시험 통과.*1\/1/);
  assert.equal(만든곳.length, 1);
  assert.ok(만든곳.every((경로) => !fs.existsSync(경로)));
});

test('자가시험이 심은 참조를 놓치면 2이며 실패 때도 임시 폴더를 지운다', (t) => {
  const 원래쓰기 = fs.writeFileSync;
  const 원래임시 = fs.mkdtempSync;
  const 만든곳 = [];
  t.mock.method(fs, 'mkdtempSync', function (...인자) {
    const 결과 = 원래임시.apply(this, 인자);
    만든곳.push(결과);
    return 결과;
  });
  t.mock.method(fs, 'writeFileSync', function (파일, 내용, ...인자) {
    return 원래쓰기.call(this, 파일, path.basename(파일) === '견본.js' ? '// 참조를 놓친 상태' : 내용, ...인자);
  });
  확인불가(자가시험(), /참조를 잡지 못했다/);
  assert.equal(만든곳.length, 1);
  assert.ok(만든곳.every((경로) => !fs.existsSync(경로)));
});

test('자가시험 CLI 진입점도 임시 작업 디렉터리에서 종료코드 0을 낸다', (t) => {
  const f = 픽스처(t);
  const r = spawnSync(process.execPath, [도구, '--자가시험'], { cwd: f.루트, encoding: 'utf8', timeout: 10000 });
  assert.ifError(r.error);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^자가시험 통과:/);
});
