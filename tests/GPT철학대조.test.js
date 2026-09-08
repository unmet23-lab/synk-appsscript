'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const 도구 = 'tools/GPT철학대조.js';
const 빌드 = 'tools/codex-build.js';
const 검수 = 'tools/codex-review.js';
const 철학 = 'docs/SYNK_철학.md';
const 템플릿 = 'docs/_ops/동결심문_프롬프트.md';
const 발주경로 = 'docs/_ops/발주/GPT철학대조.md';
const 역할순서 = ['실행자', '발주검토자', '검수자', '심문자'];
const 복사목록 = [
  도구, 빌드, 검수, 철학, 템플릿,
  'tools/배포판점검.js', 'tools/deploy-security-check.js', 'tools/모델정책.js',
  'tools/lib/검수런.js', 'tools/lib/인자게이트.js', 'tests/lib/소스검사.js',
  '.claude/hooks/lib/clasp-project.js', '.claude/hooks/lib/board-id.js',
  '.claude/hooks/philosophy-card.js',
];

// 원본은 읽기만 한다. 기존 시험까지 지문으로 확인하고, 변이는 임시 사본에만 쓴다.
const 보호파일 = [...복사목록.filter((파일) => 파일 !== 도구), 'tests/코덱스실행.test.js'];
const 지문 = (파일) => createHash('sha256').update(fs.readFileSync(path.join(ROOT, 파일))).digest('hex');
const 원본지문 = new Map(보호파일.map((파일) => [파일, 지문(파일)]));
after(() => {
  for (const [파일, 원본] of 원본지문) assert.equal(지문(파일), 원본, `원본이 바뀌었다: ${파일}`);
});

function 쓰기(방, 파일, 내용) {
  const 대상 = path.join(방, 파일);
  fs.mkdirSync(path.dirname(대상), { recursive: true });
  fs.writeFileSync(대상, 내용, 'utf8');
}

function 사본(t) {
  const 임시부모 = fs.realpathSync(os.tmpdir());
  const 방 = fs.mkdtempSync(path.join(임시부모, 'synk-gpt-philosophy-'));
  t.after(() => {
    // Windows에서도 최종 절대 경로를 확인한 뒤 이 시험의 임시 폴더만 지운다.
    const 실제 = fs.realpathSync(방);
    assert.equal(path.dirname(실제), 임시부모);
    assert.ok(path.basename(실제).startsWith('synk-gpt-philosophy-'));
    fs.rmSync(실제, { recursive: true, force: true });
  });
  for (const 파일 of 복사목록) {
    fs.mkdirSync(path.dirname(path.join(방, 파일)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 파일), path.join(방, 파일));
  }
  // 개인 memory·운영 데이터는 복사하지 않는다. 조립에 필요한 나머지는 합성 문서다.
  쓰기(방, 'MEMORY.md', '# 시험 색인\n🚫 합성 시험의 금지 항목\n');
  쓰기(방, 'docs/제품방향.md', '# 합성 방향\n\n## 목표\n프롬프트 측정 시험.\n');
  쓰기(방, 'docs/GPT_정본.md', ['공통', '실행자'].map((역할) =>
    `<!-- 역할: ${역할} 시작 -->\n합성 ${역할} 안내\n<!-- 역할: ${역할} 끝 -->`).join('\n'));
  쓰기(방, 발주경로, [
    '# 발주 — 합성 프롬프트 측정', '',
    '## 목표', '판단 정본의 실제 전달을 잰다.', '',
    '## 범위', '- `tools/GPT철학대조.js`', '',
    '## 수용 기준', '1. 역할별 측정 결과가 나온다.', '',
    '## 시험', '- `node --test tests/GPT철학대조.test.js`', '',
    '## 금지', '- 모델을 부르지 않는다.', '',
  ].join('\n'));
  const 초기화 = spawnSync('git', ['init', '--quiet', 방], { encoding: 'utf8', windowsHide: true });
  assert.equal(초기화.status, 0, 초기화.stderr);
  return 방;
}

function 바꾸기(방, 파일, 이전, 이후) {
  const 원문 = fs.readFileSync(path.join(방, 파일), 'utf8');
  assert.equal(원문.split(이전).length - 1, 1, `변이할 자리가 정확히 하나여야 한다: ${파일}`);
  쓰기(방, 파일, 원문.replace(이전, 이후));
}

function 실행(방, 인자 = ['--json']) {
  const env = {
    ...process.env,
    SYNK_MEMORY_INDEX: path.join(방, 'MEMORY.md'),
    SYNK_INTERROGATION_TEMPLATE: path.join(방, 템플릿),
    SYNK_BUILD_LEDGER: path.join(방, '실행기록.jsonl'),
    SYNK_REVIEW_RUNS: path.join(방, '런'),
  };
  // 상위 실행자의 런 식별자가 합성 시험의 자식에게 흘러들지 않게 한다.
  delete env.SYNK_REVIEW_RUN_ID;
  delete env.SYNK_BUILD_RUN_ID;
  const r = spawnSync(process.execPath, [path.join(방, 도구), ...인자], {
    cwd: 방, encoding: 'utf8', windowsHide: true, timeout: 25000, env,
  });
  assert.ifError(r.error);
  assert.equal(r.signal, null);
  return r;
}

function json(r, 종료코드) {
  assert.equal(r.status, 종료코드, r.stderr + r.stdout);
  const 결과 = JSON.parse(r.stdout);
  assert.equal(결과.역할들.length, 4);
  assert.deepEqual(결과.역할들.map((역할) => 역할.이름), 역할순서);
  return 결과;
}

function 실행배선끊기(방) {
  바꾸기(방, 빌드,
    '실행프롬프트({ 발주서, 실행자절, 공통, 라운드, 앞라운드, 철학 });',
    '실행프롬프트({ 발주서, 실행자절, 공통, 라운드, 앞라운드 });');
}

test('정상 조립은 역할 4/4에 본문 길이를 싣고 종료 0이며 부작용이 없다', (t) => {
  const 방 = 사본(t);
  const 본문 = require(path.join(방, 검수)).철학텍스트();
  assert.ok(본문.length > 0, '실정본에서 뽑은 본문으로 길이를 비교한다');
  const 결과 = json(실행(방), 0);
  assert.equal(결과.모두실렸나, true);
  assert.equal(결과.모두쟀나, true);
  for (const 역할 of 결과.역할들) {
    assert.equal(역할.글자수, 본문.length, '머리말 길이를 세면 안 된다');
    assert.equal(역할.실렸나, true);
    assert.equal(역할.쟀나, true);
  }
  assert.deepEqual(결과.역할들.map((역할) => 역할.잰법), ['자식프로세스', '자식프로세스', '함수호출', '함수호출']);
  for (const 파일 of ['.claude/worktrees', '실행기록.jsonl', '런']) {
    assert.equal(fs.existsSync(path.join(방, 파일)), false, `확인 모드가 남긴 부작용: ${파일}`);
  }
});

test('사람용 표는 역할별 한 줄과 검수 경로별 결과를 낸다', (t) => {
  const r = 실행(사본(t), []);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  for (const 이름 of 역할순서) assert.match(r.stdout, new RegExp(`^\\s+${이름}\\s+[\\d,]+자\\s+✅`, 'm'));
  assert.match(r.stdout, /제안✅ 기능체크✅/);
  assert.match(r.stdout, /넷 다 실렸다/);
});

test('실행자 실제 클로저에서 철학을 빼면 0자로 측정하고 종료 1이다', (t) => {
  const 방 = 사본(t);
  실행배선끊기(방);
  const 결과 = json(실행(방), 1);
  assert.deepEqual(결과.역할들[0], { 이름: '실행자', 글자수: 0, 실렸나: false, 잰법: '자식프로세스', 쟀나: true });
  assert.equal(결과.모두쟀나, true);
  assert.equal(결과.모두실렸나, false);
  assert.ok(결과.역할들.slice(1).every((역할) => 역할.실렸나));
  assert.match(실행(방, []).stdout, /안 실리는 역할: 실행자/);
});

test('발주검토자 실제 클로저의 누락도 다른 역할에 가려지지 않는다', (t) => {
  const 방 = 사본(t);
  바꾸기(방, 빌드,
    'const 발주검토프롬프트를만든다 = () => 발주검토프롬프트(발주서, 공통, 철학);',
    'const 발주검토프롬프트를만든다 = () => 발주검토프롬프트(발주서, 공통);');
  const 결과 = json(실행(방), 1);
  assert.equal(결과.역할들[1].글자수, 0);
  assert.equal(결과.모두쟀나, true);
});

test('확인 플래그를 모르는 옛 사본은 측정행이 없어 종료 2와 null을 낸다', (t) => {
  const 방 = 사본(t);
  바꾸기(방, 빌드, "'--마른손', '--프롬프트확인', '--던지기'", "'--마른손', '--던지기'");
  const 결과 = json(실행(방), 2);
  assert.equal(결과.모두쟀나, false);
  assert.equal(결과.모두실렸나, false);
  for (const 역할 of 결과.역할들.slice(0, 2)) {
    assert.equal(역할.쟀나, false);
    assert.equal(역할.글자수, null);
    assert.equal(역할.실렸나, null);
    assert.match(역할.까닭, /측정행/);
    assert.doesNotMatch(역할.까닭, /[\r\n]/);
  }
  assert.ok(결과.역할들.slice(2).every((역할) => 역할.실렸나));
  assert.match(실행(방, []).stdout, /^확인 불가/);
});

test('측정행이 한 역할만 있어도 실행 쪽 두 역할 모두 미측정이다', (t) => {
  const 방 = 사본(t);
  바꾸기(방, 빌드, "잰다('발주검토자', 발주검토프롬프트를만든다())", 'true');
  const 결과 = json(실행(방), 2);
  assert.ok(결과.역할들.slice(0, 2).every((역할) => !역할.쟀나 && 역할.글자수 === null));
});

for (const [이름, 이전, 이후] of [
  ['제안', 'return 제안프롬프트(diff텍스트, 기각제목들, 방향텍스트(), 철학텍스트());',
    'return 제안프롬프트(diff텍스트, 기각제목들, 방향텍스트(), undefined);'],
  ['기능체크', 'return 기능체크프롬프트(diff텍스트, 채택제안들, 방향텍스트(), 철학텍스트(), 렌즈, 미완);',
    'return 기능체크프롬프트(diff텍스트, 채택제안들, 방향텍스트(), undefined, 렌즈, 미완);'],
]) {
  test(`검수자 ${이름} 경로만 끊어도 0자·종료 1이며 끊긴 경로 이름이 나온다`, (t) => {
    const 방 = 사본(t);
    바꾸기(방, 검수, 이전, 이후);
    const r = 실행(방);
    const 결과 = json(r, 1);
    assert.equal(결과.역할들[2].글자수, 0);
    assert.equal(결과.역할들[2].실렸나, false);
    assert.equal(결과.모두쟀나, true);
    assert.match(r.stderr, new RegExp(`누락 경로: ${이름}`));
    const 표 = 실행(방, []);
    assert.equal(표.status, 1);
    assert.ok(표.stdout.includes(`${이름}❌`));
    assert.ok(표.stdout.includes(`${이름 === '제안' ? '기능체크' : '제안'}✅`));
  });
}

test('--json은 고정 순서의 역할 4/4와 JSON 하나만 stdout에 낸다', (t) => {
  const r = 실행(사본(t));
  json(r, 0);
  assert.equal(r.stdout.trim().split(/\r?\n/).length, 1);
});

for (const 경우 of ['정본 파일 없음', '게이트 전부 없음', '추출기 파일 없음']) {
  test(`${경우}은 예외 없이 역할 4/4가 0자이고 종료 1이다`, (t) => {
    const 방 = 사본(t);
    if (경우 === '게이트 전부 없음') 쓰기(방, 철학, '# 합성 문서\n앵커가 없는 본문.\n');
    else fs.unlinkSync(path.join(방, 경우 === '정본 파일 없음' ? 철학 : '.claude/hooks/philosophy-card.js'));
    const r = 실행(방);
    const 결과 = json(r, 1);
    assert.equal(결과.모두쟀나, true);
    assert.equal(결과.모두실렸나, false);
    assert.ok(결과.역할들.every((역할) => 역할.글자수 === 0 && 역할.실렸나 === false && 역할.쟀나));
    assert.doesNotMatch(r.stderr, /\n\s+at /);
  });
}

test('반쪽 게이트도 추출된 문자열 길이로 재고 종료 0과 경고를 낸다', (t) => {
  const 방 = 사본(t);
  // 정본 문장을 베끼지 않고, 추출 앵커 하나에 합성 본문만 둔다.
  쓰기(방, 철학, '**한 문장:** 합성 게이트 시험.\n');
  const 본문 = require(path.join(방, 검수)).철학텍스트();
  assert.ok(본문.includes('이 게이트는 **반쪽이다**'));
  const 결과 = json(실행(방), 0);
  assert.ok(결과.역할들.every((역할) => 역할.글자수 === 본문.length));
  const 표 = 실행(방, []);
  assert.equal(표.status, 0);
  assert.ok(표.stdout.includes('⚠ 게이트가 반쪽이다'));
});

test('심문 함수의 게이트 없음 예외는 미측정으로 오인하지 않고 0자로 센다', (t) => {
  const 방 = 사본(t);
  바꾸기(방, 검수, 'const 철학 = 철학텍스트(철학정본);', "const 철학 = 철학텍스트(철학정본 + '.없음');");
  const r = 실행(방);
  const 결과 = json(r, 1);
  assert.equal(결과.역할들[3].글자수, 0);
  assert.equal(결과.모두쟀나, true);
  assert.doesNotMatch(r.stderr, /\n\s+at /);
});

test('심문 템플릿 마커 누락은 게이트 없음과 달리 미측정·종료 2다', (t) => {
  const 방 = 사본(t);
  const 원문 = fs.readFileSync(path.join(방, 템플릿), 'utf8');
  assert.ok(원문.includes('{{철학게이트}}'));
  쓰기(방, 템플릿, 원문.replaceAll('{{철학게이트}}', '{{합성누락}}'));
  const 결과 = json(실행(방), 2);
  assert.equal(결과.역할들[3].글자수, null);
  assert.equal(결과.역할들[3].실렸나, null);
  assert.match(결과.역할들[3].까닭, /마커가 없다/);
  assert.equal(결과.모두쟀나, false);
});

test('0자와 미측정이 섞이면 종료 2가 우선하고 나머지도 끝까지 잰다', (t) => {
  const 방 = 사본(t);
  실행배선끊기(방);
  fs.unlinkSync(path.join(방, 템플릿));
  const 결과 = json(실행(방), 2);
  assert.equal(결과.역할들[0].글자수, 0);
  assert.equal(결과.역할들[0].쟀나, true);
  assert.equal(결과.역할들[3].글자수, null);
  assert.equal(결과.역할들[3].쟀나, false);
  assert.ok(결과.역할들.slice(1, 3).every((역할) => 역할.실렸나));
});

test('추출기 모듈의 함수 결손 예외는 스택 없이 미측정·종료 2로 낸다', (t) => {
  const 방 = 사본(t);
  쓰기(방, '.claude/hooks/philosophy-card.js', 'module.exports = {};\n');
  const r = 실행(방);
  const 결과 = json(r, 2);
  assert.equal(결과.모두쟀나, false);
  assert.ok(결과.역할들.every((역할) => 역할.글자수 === null && !역할.쟀나));
  assert.match(결과.역할들[0].까닭, /측정 준비 실패/);
  assert.doesNotMatch(r.stderr, /\n\s+at /);
});

test('자식 스크립트가 없어 실행 실패해도 함수로 재는 두 역할은 계속 잰다', (t) => {
  const 방 = 사본(t);
  fs.unlinkSync(path.join(방, 빌드));
  const 결과 = json(실행(방), 2);
  assert.ok(결과.역할들.slice(0, 2).every((역할) => 역할.글자수 === null && !역할.쟀나));
  assert.ok(결과.역할들.slice(2).every((역할) => 역할.실렸나));
});
