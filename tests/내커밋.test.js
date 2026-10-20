/* 내커밋 — 공용 작업본에서 내 파일만 커밋하고 내 커밋만 origin에 올리는 도구.
 * 임시 git 저장소(남의 스테이징·미커밋 수정·미푸시 커밋이 섞인 공용 작업본 흉내)와 임시 원격(bare)에서 잰다.
 * 실제 저장소·원격·전역 git 설정은 건드리지 않는다. */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const 도구경로 = path.join(REPO, 'tools', '내커밋.js');
const 도구 = require(도구경로);
const 잠금도구 = require(path.join(REPO, 'tools', 'git잠금.js'));
const 정책 = JSON.parse(fs.readFileSync(path.join(REPO, 'tools', 'git-storage-policy.json'), 'utf8'));

// 시험 git은 이 PC·CI의 시스템·전역 설정을 읽지 않는다(core.autocrlf는 저장소마다 정한다).
for (const k of Object.keys(process.env)) if (/^GIT_/.test(k)) delete process.env[k];
Object.assign(process.env, {
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'synk-mycommit-test-no-global-config'),
  GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: '시험', GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: '시험', GIT_COMMITTER_EMAIL: 'test@example.invalid',
});

function 깃(폴더) {
  const g = (...args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: 폴더, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  g.바이트 = (...args) => execFileSync('git', args, { cwd: 폴더, stdio: ['pipe', 'pipe', 'pipe'] });
  return g;
}

function 쓰기(폴더, 경로, 내용) {
  const 파일 = path.join(폴더, 경로);
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  fs.writeFileSync(파일, 내용);
}

/** 임시 작업본. 원격: true면 bare 원격(origin)을 만들고 바탕 커밋을 올려 둔다. */
function 새저장소(t, { 파일 = {}, 정책고침 = null, autocrlf = 'false', 원격 = false } = {}) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-mycommit-test-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  const 작업본 = path.join(뿌리, '공용');
  fs.mkdirSync(작업본);
  const git = 깃(작업본);
  git('init', '-q', '-b', 'master');
  git('config', 'core.autocrlf', autocrlf);
  쓰기(작업본, 'tools/git-storage-policy.json', `${JSON.stringify({ ...정책, ...(정책고침 || {}) }, null, 2)}\n`);
  for (const [p, v] of Object.entries(파일)) 쓰기(작업본, p, v);
  git('add', '-A');
  git('commit', '-q', '-m', '바탕');
  const 저장 = {
    뿌리, 작업본, git,
    쓰기: (p, v) => 쓰기(작업본, p, v),
    읽기: (p) => fs.readFileSync(path.join(작업본, p), 'utf8'),
    머리: () => git('rev-parse', 'HEAD').trim(),
    인덱스지문: () => crypto.createHash('sha256').update(fs.readFileSync(path.join(작업본, '.git', 'index'))).digest('hex'),
  };
  if (원격) {
    저장.원격 = path.join(뿌리, 'origin.git');
    execFileSync('git', ['init', '-q', '--bare', '-b', 'master', 저장.원격], { stdio: 'pipe' });
    git('remote', 'add', 'origin', 저장.원격);
    git('push', '-q', 'origin', 'master');
    git('fetch', '-q', 'origin');
    /** 다른 곳에서 origin에 커밋을 올린다(남의 push). 짝: 작업본 커밋을 주면 그 작성자·작성 시각·메시지로 커밋한다(남이 내 커밋을 다시 쌓아 올림). */
    저장.원격에올림 = (파일들, 메시지 = '남의 push', { 짝 = null } = {}) => {
      const 다른 = path.join(뿌리, `다른-${crypto.randomBytes(3).toString('hex')}`);
      execFileSync('git', ['clone', '-q', '-c', 'core.autocrlf=false', 저장.원격, 다른], { stdio: 'pipe' });
      const g = 깃(다른);
      for (const [p, v] of Object.entries(파일들)) 쓰기(다른, p, v);
      g('add', '-A');
      if (짝) {
        const [이름, 메일, 날짜, 몸] = git('log', '-1', '--date=raw', '--format=%an%x00%ae%x00%ad%x00%B', 짝).split('\0');
        execFileSync('git', ['commit', '-q', '-F', '-'], {
          cwd: 다른, input: 몸, stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, GIT_AUTHOR_NAME: 이름, GIT_AUTHOR_EMAIL: 메일, GIT_AUTHOR_DATE: 날짜 },
        });
      } else g('commit', '-q', '-m', 메시지);
      g('push', '-q', 'origin', 'master');
      return g('rev-parse', 'HEAD').trim();
    };
    저장.원격머리 = () => execFileSync('git', ['--git-dir', 저장.원격, 'rev-parse', 'master'], { encoding: 'utf8', stdio: 'pipe' }).trim();
    저장.원격파일 = (p, rev = 'master') => execFileSync('git', ['--git-dir', 저장.원격, 'show', `${rev}:${p}`], { encoding: 'utf8', stdio: 'pipe' });
  }
  return 저장;
}

function 상태(저장) {
  return 저장.git('status', '--porcelain=v1', '--untracked-files=all').split('\n').filter(Boolean).sort();
}

// ── 순수 함수 ────────────────────────────────────────────────────────────────

test('줄 나누기는 줄끝을 그대로 들고 다시 이으면 원래 글이 된다', () => {
  const 글 = 'a\r\nb\nc';
  assert.deepEqual(도구.줄나누기(글), [{ 글: 'a', 끝: '\r\n' }, { 글: 'b', 끝: '\n' }, { 글: 'c', 끝: '' }]);
  for (const s of ['', '\n', 'x\n', 'x\r\n\r\n', 'a\nb\r\nc\n']) assert.equal(도구.줄잇기(도구.줄나누기(s)), s);
});

test('줄 차이는 새 판을 되살리고 같은 줄 수가 가장 긴 공통 부분과 같다', () => {
  let 씨 = 7;
  const 난수 = () => { 씨 = (씨 * 1103515245 + 12345) % 2147483648; return 씨 / 2147483648; };
  const 공통길이 = (a, b) => {
    const d = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]);
    return d[a.length][b.length];
  };
  for (let n = 0; n < 300; n++) {
    const a = Array.from({ length: Math.floor(난수() * 9) }, () => 'abc'[Math.floor(난수() * 3)]);
    const b = Array.from({ length: Math.floor(난수() * 9) }, () => 'abc'[Math.floor(난수() * 3)]);
    const ops = 도구.줄차이(a, b);
    const 되살림 = [];
    let 앞a = -1;
    for (const op of ops) {
      if (op[0] === '=') { assert.equal(a[op[1]], b[op[2]]); 되살림.push(a[op[1]]); assert.ok(op[1] > 앞a); 앞a = op[1]; }
      else if (op[0] === '+') 되살림.push(b[op[1]]);
      else { assert.ok(op[1] > 앞a); 앞a = op[1]; }
    }
    assert.deepEqual(되살림, b, `${a.join('')} → ${b.join('')}`);
    assert.equal(ops.filter((op) => op[0] === '=').length, 공통길이(a, b), `${a.join('')} → ${b.join('')}`);
  }
});

test('조각: 바뀐 덩어리마다 6자리 id, 고른 줄만 바탕에 얹는다', () => {
  const 만들기 = (바탕, 새) => 도구.조각만들기(바탕.join('\n') + '\n', 새.join('\n') + '\n');
  const 얹기 = (바탕, 새, 고름글) => {
    const { B, N, 묶음 } = 만들기(바탕, 새);
    const 고름 = 도구.고름읽기(고름글(묶음));
    const 순번 = new Map([...고름].map(([id, 줄]) => [묶음.findIndex((m) => m.id === id), 줄]));
    return 도구.줄잇기(도구.조각얹기(B, N, 묶음, 순번)).split('\n').slice(0, -1);
  };
  const { 묶음 } = 만들기(['h', 'a', 'b'], ['h', 'X', 'a', 'b', 'Y']);
  assert.equal(묶음.length, 2);
  assert.match(묶음[0].id, /^[0-9a-f]{6}$/);
  // 끝에 나란히 더한 두 줄 가운데 내 줄만
  assert.deepEqual(얹기(['h', 'a'], ['h', 'a', '내 줄', '남 줄'], (m) => `${m[0].id}:1`), ['h', 'a', '내 줄']);
  // 남이 x를 고친 자리 바로 앞·뒤에 내가 한 줄 더함: 남의 고침은 빼고 내 줄만, 차례는 그대로
  assert.deepEqual(얹기(['x', 'b'], ['내 줄', "x'", 'b'], (m) => `${m[0].id}:2`), ['내 줄', 'x', 'b']);
  assert.deepEqual(얹기(['x', 'b'], ["x'", '내 줄', 'b'], (m) => `${m[0].id}:3`), ['x', '내 줄', 'b']);
  // 내 바꿈(뺀 줄 1 + 더한 줄 2)만, 옆의 남 바꿈은 뺀다
  assert.deepEqual(얹기(['a', 'b', 'c'], ["a'", "b'", 'c'], (m) => `${m[0].id}:1,${m[0].id}:3`), ["a'", 'b', 'c']);
  // 「전부」와 잘못 쓴 고르기
  assert.equal(도구.고름읽기('전부'), '전부');
  assert.throws(() => 도구.고름읽기('xyz'), /조각 고르기를 못 읽었다/);
  assert.throws(() => 도구.고름읽기('a1b2c3:3-1'), /줄 번호/);
});

test('줄끝 맞추기: 바탕 줄은 바탕 줄끝, 새 줄은 이웃 줄을 따르고 끝 줄바꿈을 되살린다', () => {
  assert.deepEqual(도구.줄끝맞추기('a\r\nb\r\n', 'a\r\nb\r\nc\n'), { 글: 'a\r\nb\r\nc\r\n', 고친줄: 1 });
  // 섞인 바탕을 누가 통째로 CRLF로 바꾼 뒤 한 줄 더함: 바탕 줄은 원래대로, 새 줄은 앞 줄(LF)을 따른다
  assert.deepEqual(도구.줄끝맞추기('a\r\nb\nc\r\n', 'a\r\nb\r\nb2\r\nc\r\n'), { 글: 'a\r\nb\nb2\nc\r\n', 고친줄: 2 });
  assert.deepEqual(도구.줄끝맞추기('a\nb\n', 'a\nb\nc'), { 글: 'a\nb\nc\n', 고친줄: 1 });
  assert.deepEqual(도구.줄끝맞추기('a\nb\n', 'a\nb2\n'), { 글: 'a\nb2\n', 고친줄: 0 });
  assert.deepEqual(도구.줄끝맞추기('a\nb', 'a\nb\nc'), { 글: 'a\nb\nc', 고친줄: 0 }, '바탕이 줄바꿈 없이 끝나면 새 판을 따른다');
});

test('자리 맞춰 붙이기: 남의 미푸시 줄은 건너뛰고 원격에도 있는 줄에 맞춰 내 줄만 붙인다', () => {
  const 줄 = (xs) => xs.map((글) => ({ 글, 끝: '\n' }));
  const 붙이기 = (P, O, C) => {
    const r = 도구.자리맞춰붙이기(줄(P), 줄(O), 줄(C));
    return r.문제 ? r.문제 : r.줄.map((l) => l.글);
  };
  // 내 줄이 남의 미푸시 줄 바로 뒤에 붙어 있다
  assert.deepEqual(붙이기(['## 가', '- a', '- 남', '', '## 나'], ['## 가', '- a', '', '## 나'], ['## 가', '- a', '- 남', '- 내', '', '## 나']),
    ['## 가', '- a', '- 내', '', '## 나']);
  // 표 맨 위에 원격도 행을 더했다: 원격 행 다음에 내 행
  assert.deepEqual(붙이기(['|h|', '|-|', '|남|', '|r1|'], ['|h|', '|-|', '|원격|', '|r1|'], ['|h|', '|-|', '|내|', '|남|', '|r1|']),
    ['|h|', '|-|', '|원격|', '|내|', '|r1|']);
  // 파일 끝에 둘 다 더했다
  assert.deepEqual(붙이기(['a'], ['a', '원격'], ['a', '내']), ['a', '원격', '내']);
  // 내가 고친 줄이 원격에 없다
  assert.match(붙이기(['a', '남의 줄'], ['a'], ['a', '남의 줄 고침']), /원격 판에 그대로 없다/);
  // 줄 셈: 어디서도 오지 않은 줄이 생기면 잡는다
  assert.match(도구.줄셈검사(줄(['a']), 줄(['a', 'o']), 줄(['a', 'c']), 줄(['a', 'o', 'c', '남'])), /원격 판에도 내 커밋에도 없는 줄/);
  assert.match(도구.줄셈검사(줄(['a']), 줄(['a', 'o']), 줄(['a', 'c']), 줄(['a', 'c'])), /있어야 할 줄이 없다/);
  assert.equal(도구.줄셈검사(줄(['a']), 줄(['a', 'c']), 줄(['a', 'c']), 줄(['a', 'c'])), null, '원격이 이미 같은 줄을 더했으면 한 번이면 된다');
});

test('자리 맞춰 붙이기: 원격에만 있던 줄을 내 조각에도 넣었으면 그 줄은 한 번만 두고 내 줄만 붙인다', () => {
  // 도구처럼 파일 내용을 latin1로 풀어 넘기고(한글 줄도 글자 줄로 가려야 한다) 결과를 다시 UTF-8로 읽는다
  const 라 = (s) => Buffer.from(s, 'utf8').toString('latin1'), 유 = (s) => (s === null ? null : Buffer.from(s, 'latin1').toString('utf8'));
  const 맞춤 = (P, O, C) => {
    const r = 도구.자리맞춰붙이기(...[P, O, C].map((xs) => xs.map((글) => ({ 글: 라(글), 끝: '\n' }))));
    return r.문제 ? r : { 줄: r.줄.map((l) => 유(l.글)), 자리: r.자리.map((x) => ({ ...x, 앞줄: 유(x.앞줄), 내줄: 유(x.내줄) })) };
  };
  const 붙이기 = (P, O, C) => { const r = 맞춤(P, O, C); return r.문제 || r.줄; };
  const 바탕 = ['## 가', '- a1', '', '## 나'];
  const 넣기 = (줄들) => ['## 가', '- a1', ...줄들, '', '## 나'];
  const L0 = '- 원격 첫째', L1 = '- 원격 줄(로컬 바탕에 없는 남의 줄)', L2 = '- 내 줄 둘째', L3 = '- 내 줄 셋째', Z = '- 원격 줄 뒤(그새 원격이 더함)';
  // 10-20 재현: 원격 L1 + 그 아래 내 L2를 함께 커밋 → L1은 한 번, L2는 그 뒤(전에는 L1이 두 번 들어갔다)
  const r = 맞춤(바탕, 넣기([L1]), 넣기([L1, L2]));
  assert.deepEqual(r.줄, 넣기([L1, L2]));
  assert.deepEqual(r.자리, [{ 앞줄: L1, 내줄: L2, 줄수: 1, 이미있음: 1 }]);
  // 그새 원격이 L1 아래에 줄을 더 넣었다(원격 줄 다음에 내 줄) · L1 위에도 넣었다 · 내 줄을 원격 줄 위에 두었다(내 차례 그대로)
  assert.deepEqual(붙이기(바탕, 넣기([L1, Z]), 넣기([L1, L2])), 넣기([L1, Z, L2]));
  assert.deepEqual(붙이기(바탕, 넣기([L0, L1]), 넣기([L1, L2])), 넣기([L0, L1, L2]));
  assert.deepEqual(붙이기(바탕, 넣기([L1]), 넣기([L2, L1])), 넣기([L2, L1]));
  // 남의 줄 없이 내 줄만 커밋했어도 원격 줄 다음
  assert.deepEqual(붙이기(바탕, 넣기([L1]), 넣기([L2])), 넣기([L1, L2]));
  // 내 줄이 모두 원격에 이미 있다
  assert.deepEqual(맞춤(바탕, 넣기([L1]), 넣기([L1])), { 줄: 넣기([L1]), 자리: [{ 앞줄: L1, 내줄: null, 줄수: 0, 이미있음: 1 }] });
  // 원격 코드 덩어리를 베껴 한 줄 끼웠다: 울타리까지 한 덩어리로 걷는다
  assert.deepEqual(붙이기(바탕, 넣기(['```bash', 'npm test', '```']), 넣기(['```bash', 'npm test', 'npm run lint', '```'])),
    넣기(['```bash', 'npm test', 'npm run lint', '```']));
  // 빈 줄·울타리 같은 틀 줄만 같으면 걷지 않는다
  assert.deepEqual(붙이기(바탕, 넣기(['```js', 'x()', '```']), 넣기(['```py', 'y()', '```'])), 넣기(['```js', 'x()', '```', '```py', 'y()', '```']));
  assert.deepEqual(붙이기(['## 가', '- a1', '## 나'], ['## 가', '- a1', '- r', '', '## 나'], ['## 가', '- a1', '', '- m', '## 나']),
    ['## 가', '- a1', '- r', '', '', '- m', '## 나']);
  // 문서에 되풀이되는 틀 줄(- **방법:**)은 같은 줄로 보지 않는다: 걷지도 멈추지도 않는다
  const 장부 = ['## 장부', '### S1', '- **방법:**', '  1. 가', '', '## 끝'];
  const 항목 = (제목, 내용) => [제목, '- **방법:**', `  1. ${내용}`, ''];
  assert.deepEqual(붙이기(장부, [...장부.slice(0, 5), ...항목('### S2 원격', '나'), '## 끝'], [...장부.slice(0, 5), ...항목('### S3 내', '다'), '## 끝']),
    [...장부.slice(0, 5), ...항목('### S2 원격', '나'), ...항목('### S3 내', '다'), '## 끝']);
  // 원격 줄을 내 줄 사이에 넣었거나(앞뒤가 모두 내 줄) 차이가 베낀 줄을 다른 틈으로 보냈다(같은 울타리 줄): 두 번 남으니 멈춘다
  assert.match(붙이기(바탕, 넣기([L1]), 넣기([L2, L1, L3])), /두 번 들어간다/);
  assert.match(붙이기(['- 바탕 가', '```'], ['- 바탕 가', '- 원격 갑', '- 원격 을', '```', '- 원격 병'], ['- 바탕 가', '```', '- 원격 갑', '- 원격 을', '```', '- 내 줄']),
    /두 번 들어간다 — 그 파일은 손으로 합친다: - 원격 갑/);
  // 고친 줄 바로 위에 원격 줄을 같이 넣었다
  assert.deepEqual(맞춤(['- a1', '- y', '## 나'], ['- a1', L1, '- y', '## 나'], ['- a1', L1, '- y 고침', '## 나']),
    { 줄: ['- a1', L1, '- y 고침', '## 나'], 자리: [{ 앞줄: L1, 내줄: '- y 고침', 줄수: 1, 이미있음: 1 }] });
});

test('옛·새 판 줄: 내가 새로 더한 줄과 원격만 새로 더한 줄이 앞 60자가 같은 채 함께 남으면 잡고, 짧은 줄·틀 줄은 넘긴다', () => {
  const 라 = (s) => Buffer.from(s, 'utf8').toString('latin1'), 유 = (s) => Buffer.from(s, 'latin1').toString('utf8');
  const 줄 = (xs) => xs.map((글) => ({ 글: 라(글), 끝: '\n' }));
  const 판 = (P, O, C, R) => { const r = 도구.다른판줄(줄(P), 줄(O), 줄(C), 줄(R)); return r && { 내줄: 유(r.내줄), 원격줄: 유(r.원격줄) }; };
  const 머리 = '- **PC 계정 라이브러리 묶음·renderer 맞추기(10-20 준비안, Claude · 릴리스 전):** 공개 0.4.24~0.4.32 묶음은 ';
  const X = `${머리}0.4.14 판에 7곳을 고친 판이다`, X2 = `${머리}0.4.14 판에 8곳을 고친 판이다(런처 사본 포함)`;
  const 바탕 = ['## 가', '- a1', '', '## 나'];
  const 넣기 = (...줄들) => ['## 가', '- a1', ...줄들, '', '## 나'];
  // 원격은 고친 판(X2), 나는 옛 판(X)을 새로 더했고 둘 다 결과에 남았다
  assert.deepEqual(판(바탕, 넣기(X2), 넣기(X), 넣기(X2, X)), { 내줄: X, 원격줄: X2 });
  // 결과에 하나만 남았거나, 원격과 같은 줄이거나, 내 판에도 원격 줄이 있으면(일부러 둘 다 둔다) 잡지 않는다
  assert.equal(판(바탕, 넣기(X2), 넣기(X), 넣기(X2)), null);
  assert.equal(판(바탕, 넣기(X2), 넣기(X2), 넣기(X2)), null);
  assert.equal(판(바탕, 넣기(X2), 넣기(X2, X), 넣기(X2, X)), null);
  // 앞 60자보다 짧은 줄, 바탕에도 같은 머리가 있는 줄, 원격에서 같은 머리가 되풀이되는 줄은 틀로 보고 넘긴다
  assert.equal(판(바탕, 넣기('- 짧은 줄 원격'), 넣기('- 짧은 줄 내'), 넣기('- 짧은 줄 원격', '- 짧은 줄 내')), null);
  const 틀 = `${머리}0.4.14 판 기록(바탕에 있던 줄)`;
  assert.equal(판(넣기(틀), 넣기(틀, X2), 넣기(틀, X), 넣기(틀, X2, X)), null);
  const X3 = `${머리}다른 원격 줄`;
  assert.equal(판(바탕, 넣기(X2, X3), 넣기(X), 넣기(X2, X3, X)), null);
  // 결정 표의 같은 날·같은 표지 행(앞 48자가 같다)은 다른 줄이다
  const 표 = '| 2026-10-03 | 확정 | [Claude 추천 · 유호님 채택(MVP)] **';
  const 행1 = `${표}게임 나레이션은 휴대폰·귀 점검 결과를 본 뒤 다시 시작한다.** 점검표는 QA 폴더에 둔다 |`;
  const 행2 = `${표}사내 메신저 「내 작업실」의 AI 업무 연습은 실제로 AI를 부른다.** 월 상한을 둔다 |`;
  assert.equal(판(['|h|', '|-|'], ['|h|', '|-|', 행1], ['|h|', '|-|', 행2], ['|h|', '|-|', 행1, 행2]), null);
});

test('인자 읽기: 명령마다 받는 인자만 받고 틀리면 사용법 오류', () => {
  const r = 도구.인자읽기(['커밋', 'a.js', 'b.md', '-m', '제목', '-m', '본문', '--조각', 'docs/_ops/트랙.md=a1b2c3:2-3,d4e5f6', '--실행']);
  assert.deepEqual(r.경로들, ['a.js', 'b.md']);
  assert.deepEqual(r.메시지, ['제목', '본문']);
  assert.equal(r.조각[0][0], 'docs/_ops/트랙.md');
  assert.deepEqual([...r.조각[0][1].get('a1b2c3')], [2, 3]);
  assert.equal(r.조각[0][1].get('d4e5f6'), true);
  assert.equal(r.실행, true);
  assert.deepEqual(도구.인자읽기(['올리기', 'abc123', '--합치기']).커밋들, ['abc123']);
  assert.equal(도구.인자읽기(['올리기', 'abc123', '--옛판아님']).옛판아님, true);
  for (const 틀림 of [['커밋'], ['커밋', 'a', '--모름'], ['커밋', 'a', '--조각', '경로만'], ['올리기'], ['올리기', 'c', '-m', 'x'], ['커밋', 'a', '--합치기'], ['커밋', 'a', '--옛판아님'], ['지우기']]) {
    assert.throws(() => 도구.인자읽기(틀림), (e) => e.constructor.name === '사용법오류', 틀림.join(' '));
  }
  assert.ok(도구.공용문서인가('docs/_ops/트랙.md') && 도구.공용문서인가('docs/현장노트/git_줄끝_잠금.md'));
  assert.ok(!도구.공용문서인가('docs/현장노트/하위/x.md') && !도구.공용문서인가('tools/내커밋.js'));
});

// ── 커밋 ────────────────────────────────────────────────────────────────────

test('커밋: 남의 스테이징·미커밋 수정·새 파일은 그대로 두고 내 경로만 커밋한 뒤 공용 인덱스를 맞춘다', async (t) => {
  const 저장 = 새저장소(t, { 파일: { '남의/스테이징.txt': '바탕\n', '남의/수정.txt': '바탕\n', '내/코드.js': 'const a = 1;\n' } });
  const 바탕 = 저장.머리();
  저장.쓰기('남의/스테이징.txt', '바탕\n남이 스테이징\n');
  저장.git('add', '남의/스테이징.txt');
  저장.쓰기('남의/수정.txt', '바탕\n남이 고침\n');
  저장.쓰기('남의/새파일.txt', '남의 새 파일\n');
  저장.쓰기('내/코드.js', 'const a = 2;\n');
  저장.쓰기('내/새.md', '# 내 새 문서\n');
  const 전상태 = 상태(저장), 전인덱스 = 저장.인덱스지문();

  const 미리 = await 도구.커밋({ 저장소: 저장.작업본, 경로들: ['내/코드.js', '내/새.md'], 메시지: '내 변경' });
  assert.equal(미리.결과, '미리 보기', 미리.이유);
  assert.deepEqual(미리.파일.map((f) => `${f.상태} ${f.경로}`).sort(), ['수정 내/코드.js', '추가 내/새.md']);
  assert.equal(미리.용량.통과, true);
  assert.equal(저장.머리(), 바탕, '미리 보기는 커밋하지 않는다');
  assert.equal(저장.인덱스지문(), 전인덱스, '미리 보기는 공용 인덱스를 건드리지 않는다');
  assert.deepEqual(상태(저장), 전상태);

  const r = await 도구.커밋({ 저장소: 저장.작업본, 경로들: ['내/코드.js', '내/새.md'], 메시지: '내 변경', 실행: true });
  assert.equal(r.결과, '커밋함', r.이유);
  assert.equal(저장.git('rev-parse', 'HEAD~1').trim(), 바탕);
  assert.equal(r.커밋, 저장.머리());
  assert.deepEqual(저장.git('show', '--name-only', '--format=', 'HEAD').trim().split('\n').sort(), ['내/새.md', '내/코드.js']);
  assert.equal(저장.git('log', '-1', '--format=%s'), '내 변경\n');
  assert.deepEqual(상태(저장), ['?? 남의/새파일.txt', 'M  남의/스테이징.txt', ' M 남의/수정.txt'].sort(), '남의 것은 그대로, 내 경로는 깨끗하다');
  assert.equal(저장.git('diff', '--cached', '--name-only').trim(), '남의/스테이징.txt');

  const 다시 = await 도구.커밋({ 저장소: 저장.작업본, 경로들: ['내/코드.js', '내/새.md'], 메시지: '내 변경', 실행: true });
  assert.equal(다시.결과, '커밋할 것 없음');
});

test('커밋: 여러 세션이 같이 고치는 문서는 통째로 올리지 않고 고른 내 조각만 바탕에 얹는다', async (t) => {
  const 트랙 = 'docs/_ops/트랙.md';
  const 저장 = 새저장소(t, { 파일: { [트랙]: '# 트랙\n\n## 가\n- a1\n\n## 나\n- b1\n' } });
  저장.쓰기(트랙, '# 트랙\n\n## 가\n- a1\n- 남의 줄\n- 내 줄 1\n\n## 나\n- b1\n- 내 줄 2\n');

  const 막힘 = await 도구.커밋({ 저장소: 저장.작업본, 경로들: [트랙], 메시지: '트랙', 실행: true });
  assert.equal(막힘.결과, '멈춤');
  assert.match(막힘.이유, /통째로 올리지 않는다/);
  const 조각 = 막힘.조각보기[0].조각;
  assert.deepEqual(조각.map((조) => 조.줄.map((l) => l.글)), [['- 남의 줄', '- 내 줄 1'], ['- 내 줄 2']]);
  const 없는조각 = await 도구.커밋({ 저장소: 저장.작업본, 조각: [[트랙, 'abcdef']], 메시지: '트랙', 실행: true });
  assert.equal(없는조각.결과, '멈춤');
  assert.match(없는조각.이유, /조각 abcdef가 지금 차이에 없다/, '미리 본 뒤 파일이 바뀌어 id가 사라지면 멈춘다');
  const 넘는줄 = await 도구.커밋({ 저장소: 저장.작업본, 조각: [[트랙, `${조각[1].id}:2`]], 메시지: '트랙', 실행: true });
  assert.match(넘는줄.이유, /줄이 1개뿐이다/);

  const r = await 도구.커밋({ 저장소: 저장.작업본, 조각: [[트랙, `${조각[0].id}:2,${조각[1].id}`]], 메시지: '트랙', 실행: true });
  assert.equal(r.결과, '커밋함', r.이유);
  assert.equal(저장.git('show', `HEAD:${트랙}`), '# 트랙\n\n## 가\n- a1\n- 내 줄 1\n\n## 나\n- b1\n- 내 줄 2\n');
  assert.equal(저장.읽기(트랙), '# 트랙\n\n## 가\n- a1\n- 남의 줄\n- 내 줄 1\n\n## 나\n- b1\n- 내 줄 2\n', '작업본의 남의 줄은 그대로');
  assert.equal(저장.git('diff', '--cached', '--name-only').trim(), '', '공용 인덱스의 트랙은 새 HEAD 판');
  assert.match(저장.git('diff', '--', 트랙), /^\+- 남의 줄$/m, '남은 차이는 남의 줄뿐');
  assert.equal(저장.git('diff', '--numstat', '--', 트랙).trim(), `1\t0\t${트랙}`);
});

test('커밋: 공용 인덱스에 내 경로의 다른 스테이징이 있으면 아무것도 하지 않는다', async (t) => {
  const 저장 = 새저장소(t, { 파일: { 'a.js': 'a\n' } });
  const 바탕 = 저장.머리();
  저장.쓰기('a.js', 'a\n남이 올린 판\n');
  저장.git('add', 'a.js');
  저장.쓰기('a.js', 'a\n내 판\n');
  const 전인덱스 = 저장.인덱스지문();
  const r = await 도구.커밋({ 저장소: 저장.작업본, 경로들: ['a.js'], 메시지: 'a', 실행: true });
  assert.equal(r.결과, '멈춤');
  assert.equal(r.걸림[0].경로, 'a.js');
  assert.equal(저장.머리(), 바탕);
  assert.equal(저장.인덱스지문(), 전인덱스);
});

test('커밋: 커밋 직전에 남이 커밋해 CAS가 실패하면 새 HEAD 위에서 다시 만든다', async (t) => {
  const 저장 = 새저장소(t, { 파일: { '남.txt': '바탕\n', '내.txt': '바탕\n' } });
  저장.쓰기('내.txt', '바탕\n내 줄\n');
  let 남의커밋 = null;
  const r = await 도구.커밋({
    저장소: 저장.작업본, 경로들: ['내.txt'], 메시지: '내 줄', 실행: true,
    시험고리: {
      커밋직전() {
        if (남의커밋) return;
        저장.쓰기('남.txt', '바탕\n남의 커밋\n');
        저장.git('commit', '-q', '-m', '남의 커밋', '--', '남.txt');
        남의커밋 = 저장.머리();
      },
    },
  });
  assert.equal(r.결과, '커밋함', r.이유);
  assert.equal(r.다시한수, 1);
  assert.equal(저장.git('rev-parse', 'HEAD~1').trim(), 남의커밋, '부모는 남의 새 커밋');
  assert.equal(저장.git('show', 'HEAD:남.txt'), '바탕\n남의 커밋\n', '남의 커밋 내용이 살아 있다');
  assert.equal(저장.git('show', 'HEAD:내.txt'), '바탕\n내 줄\n');
  assert.deepEqual(상태(저장), []);
});

test('커밋: index.lock — 잠깐 생긴 잠금은 기다리고, 주인 없는 잠금은 한 번 치우고, 안 풀리는 잠금이면 커밋하지 않는다', async (t) => {
  const 저장 = 새저장소(t, { 파일: { 'a.txt': '1\n' } });
  const 잠금 = path.join(저장.작업본, '.git', 'index.lock');
  const 짧은잠 = (ms) => spawnSync(process.execPath, ['-e', `setTimeout(()=>{},${Math.min(ms, 50)})`]);

  // ① 잠깐 쓰는 잠금: 세 번째 기다림에 풀린다
  fs.writeFileSync(잠금, '');
  저장.쓰기('a.txt', '2\n');
  let 기다림 = 0;
  const r1 = await 도구.커밋({
    저장소: 저장.작업본, 경로들: ['a.txt'], 메시지: '2', 실행: true,
    잠깐: (ms) => { 기다림++; if (기다림 === 3) fs.rmSync(잠금); 짧은잠(ms); },
  });
  assert.equal(r1.결과, '커밋함', r1.이유);
  assert.ok(기다림 >= 3);

  // ② 주인 없는 잠금(0바이트·오래됨·먼저 시작한 git 없음): 한 번 치우고 커밋
  fs.writeFileSync(잠금, '');
  const 옛날 = new Date(Date.now() - 60000);
  fs.utimesSync(잠금, 옛날, 옛날);
  저장.쓰기('a.txt', '3\n');
  const r2 = await 도구.커밋({
    저장소: 저장.작업본, 경로들: ['a.txt'], 메시지: '3', 실행: true,
    잠금살피기: () => 잠금도구.살피기(저장.작업본, { 잠금, 먼저시작한git: () => 0 }),
  });
  assert.equal(r2.결과, '커밋함', r2.이유);
  assert.ok(!fs.existsSync(잠금));

  // ③ 내용 있는 잠금(쓰는 중일 수 있다)이 안 풀린다: 커밋하지 않고 잠금도 안 지운다
  fs.writeFileSync(잠금, '쓰는 중');
  저장.쓰기('a.txt', '4\n');
  const 전 = 저장.머리();
  const r3 = await 도구.커밋({ 저장소: 저장.작업본, 경로들: ['a.txt'], 메시지: '4', 실행: true, 잠금한도ms: { 커밋전: 300 }, 잠깐: 짧은잠 });
  assert.equal(r3.결과, '멈춤');
  assert.match(r3.이유, /잠금이 풀리지 않아/);
  assert.equal(저장.머리(), 전);
  assert.equal(fs.readFileSync(잠금, 'utf8'), '쓰는 중');
  fs.rmSync(잠금);

  // ④ 커밋 직후 잠금이 생겨 공용 인덱스를 못 맞춘다: 가지를 되돌린다
  const r4 = await 도구.커밋({
    저장소: 저장.작업본, 경로들: ['a.txt'], 메시지: '4', 실행: true, 잠금한도ms: { 맞춤: 300 }, 잠깐: 짧은잠,
    시험고리: { 커밋직후: () => fs.writeFileSync(잠금, '쓰는 중') },
  });
  assert.equal(r4.결과, '실패');
  assert.equal(r4.되돌림, true);
  assert.equal(저장.머리(), 전, '가지는 원래대로');
  assert.equal(저장.읽기('a.txt'), '4\n', '작업본은 그대로');
  fs.rmSync(잠금);
  const r5 = await 도구.커밋({ 저장소: 저장.작업본, 경로들: ['a.txt'], 메시지: '4', 실행: true });
  assert.equal(r5.결과, '커밋함', '잠금이 풀린 뒤 다시 하면 된다');
});

test('커밋: 줄끝이 섞인 파일은 바탕 판의 줄끝을 따르고, 바뀐 줄만 커밋된다', async (t) => {
  const 저장 = 새저장소(t, { autocrlf: 'true', 파일: { 'lf.md': 'a\nb\nc\n' } });
  // 바탕에 CRLF 파일과 섞인 파일을 바이트 그대로 넣는다
  저장.쓰기('crlf.md', 'a\r\nb\r\n');
  저장.쓰기('mixed.md', 'l1\r\nl2\nl3\r\n');
  저장.git('-c', 'core.autocrlf=false', 'add', 'crlf.md', 'mixed.md');
  저장.git('commit', '-q', '-m', 'CRLF·섞인 파일');
  // ① CRLF 파일에 LF 줄을 더함 ② 섞인 파일을 누가 통째로 CRLF로 바꾸고 한 줄 더함 ③ LF 파일이 작업본에서 CRLF + 한 줄 고침
  저장.쓰기('crlf.md', 'a\r\nb\r\nc\n');
  저장.쓰기('mixed.md', 'l1\r\nl2\r\nl3\r\nl4\r\n');
  저장.쓰기('lf.md', 'a\r\nB\r\nc\r\n');
  const r = await 도구.커밋({ 저장소: 저장.작업본, 경로들: ['crlf.md', 'mixed.md', 'lf.md'], 메시지: '줄끝', 실행: true });
  assert.equal(r.결과, '커밋함', r.이유);
  const 블롭 = (p) => 저장.git.바이트('cat-file', 'blob', `HEAD:${p}`).toString('latin1');
  assert.equal(블롭('crlf.md'), 'a\r\nb\r\nc\r\n');
  assert.equal(블롭('mixed.md'), 'l1\r\nl2\nl3\r\nl4\r\n');
  assert.equal(블롭('lf.md'), 'a\nB\nc\n');
  assert.deepEqual(저장.git('diff', '--numstat', 'HEAD~1', 'HEAD').trim().split('\n').sort(), ['1\t0\tcrlf.md', '1\t0\tmixed.md', '1\t1\tlf.md']);
  assert.deepEqual(r.줄끝고침.map((x) => x.경로).sort(), ['crlf.md', 'mixed.md']);
  assert.deepEqual(r.작업본.다시씀.sort(), ['crlf.md', 'mixed.md'], '줄끝만 맞춘 내 파일은 작업본도 새 판으로');
  assert.deepEqual(상태(저장), []);
});

test('커밋: core.autocrlf=false에서 작업본이 통째로 CRLF로 바뀌어도 바뀐 줄만 커밋된다', async (t) => {
  const 저장 = 새저장소(t, { 파일: { 'doc.md': 'a\nb\nc\n' } });
  저장.쓰기('doc.md', 'a\r\nB\r\nc\r\n');
  const r = await 도구.커밋({ 저장소: 저장.작업본, 경로들: ['doc.md'], 메시지: '한 줄', 실행: true });
  assert.equal(r.결과, '커밋함', r.이유);
  assert.equal(저장.git('show', 'HEAD:doc.md'), 'a\nB\nc\n');
  assert.equal(저장.git('diff', '--numstat', 'HEAD~1', 'HEAD').trim(), '1\t1\tdoc.md');
});

test('커밋: 줄끝만 바탕과 다르면 빈 커밋을 만들지 않고, --줄끝그대로면 줄끝을 바꾸는 커밋을 한다', async (t) => {
  const 저장 = 새저장소(t, { autocrlf: 'true', 파일: { 'a.txt': 'a\n' } });
  저장.쓰기('mixed.md', 'l1\r\nl2\nl3\r\n');
  저장.git('-c', 'core.autocrlf=false', 'add', 'mixed.md');
  저장.git('commit', '-q', '-m', '섞인 파일');
  const 바탕 = 저장.머리();
  저장.쓰기('mixed.md', 'l1\r\nl2\r\nl3\r\n');
  const r = await 도구.커밋({ 저장소: 저장.작업본, 경로들: ['mixed.md'], 메시지: '줄끝', 실행: true });
  assert.equal(r.결과, '커밋할 것 없음', r.이유);
  assert.match(r.이유, /줄끝만 바탕과 다르다/);
  assert.equal(저장.머리(), 바탕, '빈 커밋을 만들지 않는다');
  const 그대로 = await 도구.커밋({ 저장소: 저장.작업본, 경로들: ['mixed.md'], 메시지: '줄끝을 CRLF로', 실행: true, 줄끝그대로: true });
  assert.equal(그대로.결과, '커밋함', 그대로.이유);
  assert.equal(저장.git.바이트('cat-file', 'blob', 'HEAD:mixed.md').toString('latin1'), 'l1\r\nl2\r\nl3\r\n');
});

test('커밋: 폴더 경로는 그 아래 남의 파일이 섞일 수 있어 --폴더 없이는 목록만 보이고 멈춘다', async (t) => {
  const 저장 = 새저장소(t, { 파일: { 'tools/a.js': 'a\n', 'tools/b.js': 'b\n' } });
  const 바탕 = 저장.머리();
  저장.쓰기('tools/a.js', 'a 내 고침\n');
  저장.쓰기('tools/b.js', 'b 남의 미커밋\n');
  저장.쓰기('tools/남의새.js', '남의 새 파일\n');
  const 막힘 = await 도구.커밋({ 저장소: 저장.작업본, 경로들: ['tools'], 메시지: '폴더', 실행: true });
  assert.equal(막힘.결과, '멈춤');
  assert.deepEqual(막힘.폴더파일.map((x) => `${x.상태} ${x.경로}`).sort(), ['수정 tools/a.js', '수정 tools/b.js', '추가 tools/남의새.js']);
  assert.equal(저장.머리(), 바탕);
  const 파일로 = await 도구.커밋({ 저장소: 저장.작업본, 경로들: ['tools/a.js'], 메시지: '파일로', 실행: true });
  assert.equal(파일로.결과, '커밋함', 파일로.이유);
  assert.deepEqual(저장.git('show', '--name-only', '--format=', 'HEAD').trim().split('\n'), ['tools/a.js']);
  저장.쓰기('내폴더/하나.md', '1\n');
  저장.쓰기('내폴더/둘.md', '2\n');
  const 폴더 = await 도구.커밋({ 저장소: 저장.작업본, 경로들: ['내폴더'], 메시지: '내 새 폴더', 실행: true, 폴더: true });
  assert.equal(폴더.결과, '커밋함', 폴더.이유);
  assert.deepEqual(저장.git('show', '--name-only', '--format=', 'HEAD').trim().split('\n').sort(), ['내폴더/둘.md', '내폴더/하나.md']);
});

test('커밋: 하위 git 저장소(gitlink)가 섞이면 멈춘다', async (t) => {
  const 저장 = 새저장소(t, { 파일: { 'a.txt': 'a\n' } });
  const 바탕 = 저장.머리();
  const 안쪽 = path.join(저장.작업본, '안쪽');
  fs.mkdirSync(안쪽);
  const g = 깃(안쪽);
  g('init', '-q', '-b', 'master');
  쓰기(안쪽, 'x.txt', 'x\n');
  g('add', 'x.txt');
  g('commit', '-q', '-m', '안쪽');
  const r = await 도구.커밋({ 저장소: 저장.작업본, 경로들: ['안쪽'], 메시지: '안쪽', 실행: true });
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /하위 git 저장소/);
  assert.equal(저장.머리(), 바탕);
});

test('커밋 미리 보기: 긴 조각도 줄 번호를 하나도 빼지 않고 보인다', async (t) => {
  const 트랙 = 'docs/_ops/트랙.md';
  const 저장 = 새저장소(t, { 파일: { [트랙]: '# 트랙\n- a\n' } });
  const 남의줄 = Array.from({ length: 20 }, (_, i) => `- 남의 줄 ${i + 1}`);
  저장.쓰기(트랙, ['# 트랙', '- a', ...남의줄.slice(0, 10), '- 내 줄', ...남의줄.slice(10), ''].join('\n'));
  const r = await 도구.커밋({ 저장소: 저장.작업본, 경로들: [트랙], 메시지: '트랙' });
  assert.equal(r.결과, '멈춤');
  const 글 = 도구._시험.커밋글(r);
  for (let n = 1; n <= 21; n++) assert.match(글, new RegExp(`^ {4}${String(n).padStart(3)} \\+`, 'm'), `${n}번 줄`);
  assert.match(글, / 11 \+  - 내 줄$/m);
  const 조 = r.조각보기[0].조각[0];
  const 골라 = await 도구.커밋({ 저장소: 저장.작업본, 조각: [[트랙, `${조.id}:11`]], 메시지: '내 줄', 실행: true });
  assert.equal(골라.결과, '커밋함', 골라.이유);
  assert.equal(저장.git('show', `HEAD:${트랙}`), '# 트랙\n- a\n- 내 줄\n');
});

test('커밋: 저장 용량 검사에 걸리면 커밋하지 않는다', async (t) => {
  const 저장 = 새저장소(t, { 정책고침: { maxBlobBytes: 64 }, 파일: { 'a.txt': 'a\n' } });
  const 바탕 = 저장.머리();
  저장.쓰기('큰.bin', Buffer.alloc(65, 1));
  const 전인덱스 = 저장.인덱스지문();
  const r = await 도구.커밋({ 저장소: 저장.작업본, 경로들: ['큰.bin'], 메시지: '큰 파일', 실행: true });
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /저장 용량/);
  assert.equal(r.용량.위반[0].code, 'blob-bytes');
  assert.equal(저장.머리(), 바탕);
  assert.equal(저장.인덱스지문(), 전인덱스);
});

// ── 올리기 ──────────────────────────────────────────────────────────────────

const 공용글 = '# 공용\n\n## 가\n- a1\n\n## 나\n- b1\n';

/** 바탕 → 남의 미푸시 커밋 P1 → 내 커밋 C1이 쌓인 공용 작업본과 origin */
function 남의미푸시위내커밋(t) {
  const 저장 = 새저장소(t, { 원격: true, 파일: { '공용.md': 공용글, '남.txt': '바탕\n' } });
  저장.쓰기('공용.md', '# 공용\n\n## 가\n- a1\n- 남 a2\n\n## 나\n- b1\n');
  저장.쓰기('남.txt', '바탕\n남의 미푸시\n');
  저장.git('commit', '-q', '-am', '남의 미푸시 커밋');
  저장.P1 = 저장.머리();
  저장.쓰기('공용.md', '# 공용\n\n## 가\n- a1\n- 남 a2\n\n## 나\n- b1\n- 내 b2\n');
  저장.쓰기('내.md', '# 내 문서\n');
  저장.git('add', '공용.md', '내.md');
  저장.git('-c', 'user.name=나', '-c', 'user.email=me@example.invalid', 'commit', '-q', '--author', '나 <me@example.invalid>', '-m', '내 커밋');
  저장.C1 = 저장.머리();
  return 저장;
}

test('올리기: 남의 미푸시 커밋은 두고 내 커밋만 origin 위에 다시 쌓아 올리고, 같은 자리에 원격도 더한 줄은 원격 줄 다음에 둔다', async (t) => {
  const 저장 = 남의미푸시위내커밋(t);
  const O1 = 저장.원격에올림({ '공용.md': '# 공용\n\n## 가\n- a1\n\n## 나\n- b1\n- 원격 b3\n', '원격.txt': '원격\n' });

  const 미리 = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [저장.C1] });
  assert.equal(미리.결과, '미리 보기', JSON.stringify(미리.문제 || 미리.이유));
  assert.equal(미리.그대로, false);
  assert.equal(미리.바탕, O1);
  assert.deepEqual(미리.경로.map((x) => `${x.방법} ${x.경로}`).sort(), ['내 판 내.md', '자리 맞춤 공용.md']);
  assert.deepEqual(미리.경로.find((x) => x.경로 === '공용.md').자리, [{ 앞줄: '- 원격 b3', 내줄: '- 내 b2', 줄수: 1 }]);
  assert.match(도구._시험.올리기글(미리), /「- 원격 b3」 다음에 「- 내 b2」/);
  assert.equal(미리.남의미푸시, 1);
  assert.equal(저장.원격머리(), O1, '미리 보기는 올리지 않는다');

  const r = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [저장.C1], 실행: true, 합치기: true });
  assert.equal(r.결과, '올림', JSON.stringify(r.문제 || r.이유));
  assert.equal(r.확인, true);
  assert.equal(저장.원격머리(), r.머리);
  assert.equal(execFileSync('git', ['--git-dir', 저장.원격, 'rev-parse', 'master~1'], { encoding: 'utf8' }).trim(), O1);
  assert.equal(저장.원격파일('공용.md'), '# 공용\n\n## 가\n- a1\n\n## 나\n- b1\n- 원격 b3\n- 내 b2\n');
  assert.equal(저장.원격파일('남.txt'), '바탕\n', '남의 미푸시 내용은 올라가지 않는다');
  assert.equal(저장.원격파일('내.md'), '# 내 문서\n');
  assert.equal(저장.원격파일('원격.txt'), '원격\n');
  const [작성자, 제목] = execFileSync('git', ['--git-dir', 저장.원격, 'log', '-1', '--format=%an <%ae>%x00%s', 'master'], { encoding: 'utf8' }).trim().split('\0');
  assert.equal(작성자, '나 <me@example.invalid>');
  assert.equal(제목, '내 커밋');
  assert.equal(저장.머리(), 저장.C1, '로컬 가지는 그대로');
  assert.equal(r.합치기.결과, '건너뜀', 'origin의 남의 커밋(원격.txt)이 로컬에 없으니 합치지 않는다');
  assert.ok(r.합치기.예.includes('원격.txt'));
});

test('올리기: 로컬 바탕에 없는 원격 줄을 내 조각에 같이 넣었으면 원격 판에 그 줄은 한 번만 두고 내 줄은 그 뒤에 붙인다(10-20 재현)', async (t) => {
  const 노트 = 'docs/현장노트/시험.md';
  const 저장 = 새저장소(t, { 원격: true, 파일: { [노트]: '# 노트\n\n## 가\n- a1\n\n## 나\n- b1\n', '남.txt': '바탕\n' } });
  저장.쓰기('남.txt', '바탕\n남의 미푸시\n');
  저장.git('commit', '-q', '-am', '남의 미푸시 커밋');
  const L1 = '- 10-20 또(원격에만 있는 남의 줄): 로컬 바탕에는 없다', L2 = '- 10-20 또(내 줄): 작업본에서 원격 줄 바로 아래에 붙였다';
  const O1 = 저장.원격에올림({ [노트]: `# 노트\n\n## 가\n- a1\n${L1}\n\n## 나\n- b1\n` });
  // 작업본에 원격 줄과 그 아래 내 줄을 함께 넣고 그 파일을 통째로(--조각 =전부) 커밋한 것과 같다
  저장.쓰기(노트, `# 노트\n\n## 가\n- a1\n${L1}\n${L2}\n\n## 나\n- b1\n`);
  저장.git('commit', '-q', '-am', '내 노트');
  const 내것 = 저장.머리();

  const 미리 = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [내것] });
  assert.equal(미리.결과, '미리 보기', JSON.stringify(미리.문제 || 미리.이유));
  const 노트경로 = 미리.경로.find((x) => x.경로 === 노트);
  assert.equal(노트경로.방법, '자리 맞춤', 'git merge-file은 겹침으로 멈춘다');
  assert.deepEqual(노트경로.자리, [{ 앞줄: L1, 내줄: L2, 줄수: 1, 이미있음: 1 }]);
  assert.match(도구._시험.올리기글(미리), /」 다음에 「- 10-20 또\(내 줄\)[^」]*」 \(원격에 이미 있는 내 줄 1개는 한 번만\)/);
  const 더한줄 = 저장.git('diff', O1, 미리.머리, '--', 노트).split('\n').filter((l) => /^\+(?!\+\+ )/.test(l));
  assert.deepEqual(더한줄, [`+${L2}`], '미리 보기가 쓴 다시 쌓은 커밋의 +줄은 내 줄뿐');

  const r = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [내것], 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r.문제 || r.이유));
  assert.equal(저장.원격파일(노트), `# 노트\n\n## 가\n- a1\n${L1}\n${L2}\n\n## 나\n- b1\n`, '원격 줄은 한 번, 내 줄은 그 바로 아래');
  assert.equal(저장.원격파일('남.txt'), '바탕\n', '남의 미푸시 내용은 올라가지 않는다');
});

/** 트랙에 줄 X를 넣는 내 커밋 A와 X를 X2로 고치는 내 커밋 B(남의 미푸시 커밋 위). 원격 판은 「## 나」에 남의 줄이 하나 더 있다. */
function 옛판새판(t) {
  const 트랙 = 'docs/_ops/트랙.md';
  const 저장 = 새저장소(t, { 원격: true, 파일: { [트랙]: '# 트랙\n\n## 가\n- a1\n\n## 나\n- b1\n', '남.txt': '바탕\n' } });
  저장.쓰기('남.txt', '바탕\n남의 미푸시\n');
  저장.git('commit', '-q', '-am', '남의 미푸시 커밋');
  const 머리 = '- **PC 계정 라이브러리 묶음·renderer 맞추기(10-20 준비안, Claude · 릴리스 전):** 공개 0.4.24~0.4.32 묶음은 ';
  const X = `${머리}0.4.14 판에 7곳을 고친 판이다`, X2 = `${머리}0.4.14 판에 8곳을 고친 판이다(런처 사본 포함)`;
  const 로컬판 = (...가) => `# 트랙\n\n## 가\n- a1\n${가.map((l) => `${l}\n`).join('')}\n## 나\n- b1\n`;
  const 원격판 = (가, 나 = []) => `# 트랙\n\n## 가\n- a1\n${가.map((l) => `${l}\n`).join('')}\n## 나\n- b1\n- b2 원격\n${나.map((l) => `${l}\n`).join('')}`;
  저장.쓰기(트랙, 로컬판(X));
  저장.git('commit', '-q', '-am', 'docs(트랙): 준비안');
  const A = 저장.머리();
  저장.쓰기(트랙, 로컬판(X2));
  저장.git('commit', '-q', '-am', 'docs(트랙): 준비안 숫자 바로잡기');
  const B = 저장.머리();
  저장.원격에올림({ [트랙]: 원격판([]) });
  return { 저장, 트랙, X, X2, 머리, 로컬판, 원격판, A, B };
}

test('올리기: 남이 내 커밋을 먼저 다시 쌓아 올렸으면 그 커밋까지 넘겨도 「이미 올라감」으로 건너뛰고 옛 판 줄을 다시 넣지 않는다(10-20 재현)', async (t) => {
  const { 저장, 트랙, X, X2, 머리, 로컬판, 원격판, A, B } = 옛판새판(t);
  // 다른 세션이 내 A·B를 같은 작성자·작성 시각·메시지로 다시 쌓아 올렸고, 그 뒤 남이 「## 나」에 줄을 더했다 — origin에는 고친 판 X2만 있다
  const A짝 = 저장.원격에올림({ [트랙]: 원격판([X]) }, '', { 짝: A });
  const B짝 = 저장.원격에올림({ [트랙]: 원격판([X2]) }, '', { 짝: B });
  const O = 저장.원격에올림({ [트랙]: 원격판([X2], ['- b3 원격(그새 더함)']) });

  // 옛 도구: 미리 보기가 「X2」 다음에 「X」로 A를 다시 쌓고(검사 셋 통과) B가 그 X를 다시 걷는 커밋 둘을 냈다. A만 넘기면 X가 X2 옆에 남았다
  const 미리 = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [A, B] });
  assert.equal(미리.결과, '올릴 것 없음', JSON.stringify(미리.문제 || 미리.경로));
  assert.deepEqual(미리.대응, [{ 원래: A, 새: null, 짝: [A짝] }, { 원래: B, 새: null, 짝: [B짝] }]);
  assert.deepEqual(미리.경로.map((x) => [x.방법, x.경로, x.짝]), [['이미 올라감', 트랙, A짝], ['이미 올라감', 트랙, B짝]]);
  const 글 = 도구._시험.올리기글(미리);
  assert.match(글, new RegExp(`${A.slice(0, 9)} → \\(이미 올라감: origin ${A짝.slice(0, 9)}\\)`));
  assert.match(글, /남이 먼저 올린 2개는 건너뜀/);
  assert.doesNotMatch(글, /다음에/, '자리 맞춤으로 끼우는 줄이 없다');
  assert.equal((await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [A] })).결과, '올릴 것 없음', '앞 커밋 하나만 넘겨도 같다');

  // 그 위에 내 새 커밋(X2 → X3)을 더해 셋을 넘기면 새 커밋만 다시 쌓는다
  const X3 = `${머리}다시 묶어 origin/master에 올림, 남은 일은 PC 릴리스`;
  저장.쓰기(트랙, 로컬판(X3));
  저장.git('commit', '-q', '-am', 'docs(트랙): 준비안 마무리');
  const C = 저장.머리();
  const r = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [A, B, C], 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r.문제 || r.이유));
  assert.deepEqual(r.대응.map((d) => [d.원래, d.새 === null, d.짝 || null]), [[A, true, [A짝]], [B, true, [B짝]], [C, false, null]]);
  assert.equal(execFileSync('git', ['--git-dir', 저장.원격, 'rev-parse', 'master~1'], { encoding: 'utf8' }).trim(), O, '새 커밋 하나만 올라간다');
  const 바뀐줄 = 저장.git('diff', O, r.머리, '--', 트랙).split('\n').filter((l) => /^[+-](?!\+\+ |-- )/.test(l));
  assert.deepEqual(바뀐줄, [`-${X2}`, `+${X3}`], '고친 판이 새 판으로만 바뀐다');
  assert.equal(저장.원격파일(트랙), 원격판([X3], ['- b3 원격(그새 더함)']));
  assert.equal(저장.원격파일('남.txt'), '바탕\n', '남의 미푸시 내용은 올라가지 않는다');
});

test('올리기: 남이 내 커밋의 일부 경로만 먼저 올렸으면 그 경로는 건너뛰고 남은 경로만 다시 쌓는다', async (t) => {
  const 트랙 = 'docs/_ops/트랙.md', 노트 = 'docs/현장노트/시험.md';
  const 저장 = 새저장소(t, { 원격: true, 파일: { [트랙]: '# 트랙\n- t1\n', [노트]: '# 노트\n- n1\n' } });
  저장.쓰기(트랙, '# 트랙\n- t1\n- 내 트랙 줄\n');
  저장.쓰기(노트, '# 노트\n- n1\n- 내 노트 줄\n');
  저장.git('commit', '-q', '-am', 'docs: 트랙·노트');
  const D = 저장.머리();
  저장.원격에올림({ [트랙]: '# 트랙\n- t0 원격\n- t1\n' });
  const D짝 = 저장.원격에올림({ [트랙]: '# 트랙\n- t0 원격\n- t1\n- 내 트랙 줄\n' }, '', { 짝: D });
  const r = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [D], 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r.문제 || r.이유));
  assert.deepEqual(r.경로.map((x) => `${x.방법} ${x.경로}`).sort(), [`내 판 ${노트}`, `이미 올라감 ${트랙}`]);
  assert.deepEqual(r.대응.map((d) => [d.원래, Boolean(d.새), d.짝]), [[D, true, [D짝]]]);
  assert.match(도구._시험.올리기글(r), /→ [0-9a-f]{9} \(일부 경로는 origin [0-9a-f]{9}에 이미 올라감\)/);
  assert.equal(저장.원격파일(트랙), '# 트랙\n- t0 원격\n- t1\n- 내 트랙 줄\n');
  assert.equal(저장.원격파일(노트), '# 노트\n- n1\n- 내 노트 줄\n');
});

test('올리기: 짝 없이 올라간 고친 판(남이 내 커밋 둘을 합쳐 올림) 옆에 옛 판 줄을 넣게 되면 멈추고, --옛판아님이면 쌓는다', async (t) => {
  const { 저장, 트랙, X, X2, 원격판, A, B } = 옛판새판(t);
  const O = 저장.원격에올림({ [트랙]: 원격판([X2]) }, 'docs(트랙): 준비안(두 커밋을 합쳐 올림)');
  for (const 커밋들 of [[A], [A, B]]) {
    const r = await 도구.올리기({ 저장소: 저장.작업본, 커밋들, 실행: true });
    assert.equal(r.결과, '멈춤', JSON.stringify(r.경로));
    assert.equal(r.문제.length, 1);
    assert.equal(r.문제[0].커밋, A);
    assert.match(r.문제[0].이유, /원격에 같은 머리의 다른 판 줄이 있다 — 앞 60자가 같은 줄의 옛·새 판이 함께 들어간다/);
    assert.match(r.문제[0].이유, /내 줄 「…[^」]*7곳을 고친 판이다」 · 원격 줄 「…[^」]*8곳을 고친 판이다\(런처 사본 포함\)」/);
    assert.equal(저장.원격머리(), O);
  }
  const 그대로 = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [A], 옛판아님: true });
  assert.equal(그대로.결과, '미리 보기', JSON.stringify(그대로.문제 || 그대로.이유));
  assert.ok(저장.git('show', `${그대로.머리}:${트랙}`).includes(`${X2}\n${X}\n`), '--옛판아님은 두 줄을 다 둔다');
});

test('올리기: 같은 줄을 원격과 다르게 고쳤으면 멈추고 아무것도 올리지 않는다', async (t) => {
  const 저장 = 새저장소(t, { 원격: true, 파일: { 'code.js': 'const a = 1;\n' } });
  저장.쓰기('남.txt', '남\n');
  저장.git('add', '남.txt');
  저장.git('commit', '-q', '-m', '남의 미푸시');
  저장.쓰기('code.js', 'const a = 3;\n');
  저장.git('commit', '-q', '-am', '내 고침');
  const 내것 = 저장.머리();
  const O1 = 저장.원격에올림({ 'code.js': 'const a = 2;\n' });
  const r = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [내것], 실행: true });
  assert.equal(r.결과, '멈춤');
  assert.match(r.문제[0].이유, /겹친다/);
  assert.equal(저장.원격머리(), O1);
});

test('올리기: 내 커밋이 origin 바로 위에 이어져 있으면 그 커밋 그대로 올리고, 앞 커밋을 빠뜨리면 멈춘다', async (t) => {
  const 저장 = 새저장소(t, { 원격: true, 파일: { 'a.txt': 'a\n' } });
  저장.쓰기('새.txt', '1\n');
  저장.git('add', '새.txt');
  저장.git('commit', '-q', '-m', '하나');
  const C1 = 저장.머리();
  저장.쓰기('새.txt', '1\n2\n');
  저장.git('commit', '-q', '-am', '둘');
  const C2 = 저장.머리();

  const 빠짐 = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [C2], 실행: true });
  assert.equal(빠짐.결과, '멈춤');
  assert.match(빠짐.문제[0].이유, /origin에 없는 파일/);

  const r = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [C1, C2], 실행: true, 합치기: true });
  assert.equal(r.결과, '올림', JSON.stringify(r.문제 || r.이유));
  assert.equal(r.그대로, true);
  assert.equal(저장.원격머리(), C2, '다시 쌓지 않고 그 커밋 그대로');
  assert.equal(r.합치기.결과, '할 것 없음');
  const 또 = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [C2] });
  assert.equal(또.결과, '올릴 것 없음');
});

test('올리기: 내 커밋 뒤로 origin만 움직였으면 그대로 올리지 않고 새 origin 위에 다시 쌓는다', async (t) => {
  const 저장 = 새저장소(t, { 원격: true, 파일: { 'a.txt': 'a\n' } });
  저장.쓰기('내.txt', '내 줄\n');
  저장.git('add', '내.txt');
  저장.git('commit', '-q', '-m', '내 커밋');
  const 내것 = 저장.머리();
  const O1 = 저장.원격에올림({ '원격.txt': '원격\n' });
  const r = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [내것], 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r.문제 || r.이유));
  assert.equal(r.그대로, false);
  assert.equal(r.다시한수, undefined, 'push가 거절되어 다시 하지 않고 한 번에 올라간다');
  assert.equal(execFileSync('git', ['--git-dir', 저장.원격, 'rev-parse', 'master~1'], { encoding: 'utf8' }).trim(), O1);
  assert.equal(저장.원격파일('내.txt'), '내 줄\n');
  assert.equal(저장.원격파일('원격.txt'), '원격\n');
});

test('올리기: 저장 용량 검사에 걸리는 커밋은 올리지 않는다', async (t) => {
  const 저장 = 새저장소(t, { 원격: true, 정책고침: { maxBlobBytes: 64 }, 파일: { 'a.txt': 'a\n' } });
  저장.쓰기('큰.bin', Buffer.alloc(65, 1));
  저장.git('add', '큰.bin');
  저장.git('commit', '-q', '-m', '큰 파일');
  const 바탕 = 저장.원격머리();
  const r = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [저장.머리()], 실행: true });
  assert.equal(r.결과, '멈춤');
  assert.ok(r.문제.some((x) => /저장 용량\(blob-bytes/.test(x.이유)));
  assert.equal(저장.원격머리(), 바탕);
});

test('올리기: 이미 다시 쌓아 올린 커밋을 또 주면 같은 내용이라 빈 커밋을 만들지 않는다', async (t) => {
  const 저장 = 남의미푸시위내커밋(t);
  const 첫 = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [저장.C1], 실행: true });
  assert.equal(첫.결과, '올림', JSON.stringify(첫.문제 || 첫.이유));
  const 또 = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [저장.C1], 실행: true });
  assert.equal(또.결과, '올릴 것 없음', JSON.stringify(또.문제 || 또.이유));
  assert.equal(또.대응[0].새, null);
  assert.equal(저장.원격머리(), 첫.머리);
});

test('올리기 검사: 로컬 커밋을 통째로 올리려 하면 남의 미푸시 줄과 경로가 새는 것을 잡는다', async (t) => {
  const 저장 = 남의미푸시위내커밋(t);
  const { git도구, 쌓기, 올릴판검사 } = 도구._시험;
  const git = git도구(저장.작업본), 블롭 = new Map();
  const 바탕 = 저장.git('rev-parse', 'origin/master').trim();
  const 계획 = 쌓기(git, 블롭, 바탕, [저장.C1]);
  assert.deepEqual((await 올릴판검사(git, 블롭, 저장.작업본, 바탕, 계획)).문제, [], '다시 쌓은 판은 깨끗하다');
  const 문제 = (await 올릴판검사(git, 블롭, 저장.작업본, 바탕, { ...계획, 머리: 저장.C1 })).문제;
  assert.ok(문제.some((x) => x.경로 === '공용.md' && /내 커밋에 없는 줄이 올라간다: - 남 a2/.test(x.이유)), JSON.stringify(문제));
  assert.ok(문제.some((x) => x.경로 === '남.txt' && /내 커밋이 바꾸지 않은 경로/.test(x.이유)), JSON.stringify(문제));
});

test('올리기: 줄끝은 원격 판을 따른다 — 줄끝만 다른 줄은 맞춰 다시 쌓고(origin 바로 위 커밋도), --줄끝그대로면 그대로 올린다', async (t) => {
  const 원격블롭 = (저장, p) => execFileSync('git', ['--git-dir', 저장.원격, 'cat-file', 'blob', `master:${p}`]).toString('latin1');
  // ① origin 바로 위의 도구 밖 커밋이 CRLF 파일에 LF 줄을 더했다: 그대로 올리지 않고 줄끝을 맞춰 다시 쌓는다
  const 저장 = 새저장소(t, { 원격: true, 파일: { 'crlf.md': 'a\r\nb\r\n' } });
  저장.쓰기('crlf.md', 'a\r\nb\r\nc\n');
  저장.git('commit', '-q', '-am', 'LF 줄 더함(도구 밖)');
  const 내것 = 저장.머리();
  const 미리 = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [내것] });
  assert.equal(미리.결과, '미리 보기', JSON.stringify(미리.문제 || 미리.이유));
  assert.equal(미리.그대로, false);
  const r1 = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [내것], 실행: true, 합치기: true });
  assert.equal(r1.결과, '올림', JSON.stringify(r1.문제 || r1.이유));
  assert.equal(r1.경로[0].방법, '내 판 · 줄끝 1줄 맞춤');
  assert.equal(원격블롭(저장, 'crlf.md'), 'a\r\nb\r\nc\r\n');
  assert.equal(r1.합치기.결과, '건너뜀', '줄끝을 맞춘 경로는 로컬과 origin 판이 달라 합치지 않는다');
  assert.match(r1.합치기.이유, /줄끝/);
  assert.equal(저장.머리(), 내것);

  // ② 남의 미푸시 커밋 위의 내 커밋이 같은 자리(파일 끝)에 LF 줄을 더했다: 자리 맞춤으로 쌓고 줄끝도 맞춘다
  저장.git('reset', '-q', '--hard', 'origin/master~1');
  저장.쓰기('남.txt', '남\n');
  저장.git('add', '남.txt');
  저장.git('commit', '-q', '-m', '남의 미푸시');
  저장.쓰기('crlf.md', 'a\r\nb\r\ne\n');
  저장.git('commit', '-q', '-am', 'LF 줄 더함(도구 밖)');
  const r2 = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [저장.머리()], 실행: true });
  assert.equal(r2.결과, '올림', JSON.stringify(r2.문제 || r2.이유));
  assert.equal(r2.경로[0].방법, '자리 맞춤 · 줄끝 1줄 맞춤');
  assert.deepEqual(r2.경로[0].자리, [{ 앞줄: 'c', 내줄: 'e', 줄수: 1 }]);
  assert.equal(원격블롭(저장, 'crlf.md'), 'a\r\nb\r\nc\r\ne\r\n');
  assert.throws(() => 저장.원격파일('남.txt'));

  // ③ 줄끝을 일부러 바꾸는 커밋(CRLF → LF): 맞추면 원격과 같아져 올릴 것이 없고, --줄끝그대로면 그대로 올라간다
  const 재정규화 = 새저장소(t, { 원격: true, 파일: { 'win.txt': 'x\r\ny\r\n' } });
  재정규화.쓰기('win.txt', 'x\ny\n');
  재정규화.git('commit', '-q', '-am', 'win.txt를 LF로');
  const 맞춤 = await 도구.올리기({ 저장소: 재정규화.작업본, 커밋들: [재정규화.머리()], 실행: true });
  assert.equal(맞춤.결과, '올릴 것 없음', JSON.stringify(맞춤.문제 || 맞춤.이유));
  const 그대로 = await 도구.올리기({ 저장소: 재정규화.작업본, 커밋들: [재정규화.머리()], 실행: true, 줄끝그대로: true });
  assert.equal(그대로.결과, '올림', JSON.stringify(그대로.문제 || 그대로.이유));
  assert.equal(그대로.그대로, true);
  assert.equal(원격블롭(재정규화, 'win.txt'), 'x\ny\n');
});

test('올리기 --합치기: 이미 올라가 건너뛴 커밋이 섞여도 합친다(push 뒤 오류 없음)', async (t) => {
  const 저장 = 새저장소(t, { 원격: true, 파일: { '남.txt': '바탕\n' } });
  저장.쓰기('남.txt', '바탕\n남의 미푸시\n');
  저장.git('commit', '-q', '-am', '남의 미푸시');
  저장.쓰기('내1.md', '하나\n');
  저장.git('add', '내1.md');
  저장.git('commit', '-q', '-m', '내 커밋 1');
  const C1 = 저장.머리();
  const 첫 = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [C1], 실행: true });
  assert.equal(첫.결과, '올림', JSON.stringify(첫.문제 || 첫.이유));
  저장.쓰기('내2.md', '둘\n');
  저장.git('add', '내2.md');
  저장.git('commit', '-q', '-m', '내 커밋 2');
  const C2 = 저장.머리(), 전트리 = 저장.git('rev-parse', 'HEAD^{tree}').trim();
  const r = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [C1, C2], 실행: true, 합치기: true });
  assert.equal(r.결과, '올림', JSON.stringify(r.문제 || r.이유));
  assert.deepEqual(r.대응.map((d) => d.새 === null), [true, false]);
  assert.equal(r.합치기.결과, '합침', r.합치기.이유);
  assert.equal(저장.git('rev-parse', 'HEAD^1').trim(), C2);
  assert.equal(저장.git('rev-parse', 'HEAD^{tree}').trim(), 전트리);
  assert.equal(저장.원격파일('남.txt'), '바탕\n');
});

test('올리기 --합치기: origin에 남의 커밋이 없으면 로컬 가지에 「트리는 로컬 그대로」 병합 커밋을 더한다', async (t) => {
  const 저장 = 남의미푸시위내커밋(t);
  const 전트리 = 저장.git('rev-parse', 'HEAD^{tree}').trim();
  const r = await 도구.올리기({ 저장소: 저장.작업본, 커밋들: [저장.C1], 실행: true, 합치기: true });
  assert.equal(r.결과, '올림', JSON.stringify(r.문제 || r.이유));
  assert.deepEqual(r.경로.map((x) => `${x.방법} ${x.경로}`).sort(), ['3방향 공용.md', '내 판 내.md']);
  assert.equal(저장.원격파일('공용.md'), '# 공용\n\n## 가\n- a1\n\n## 나\n- b1\n- 내 b2\n');
  assert.equal(r.합치기.결과, '합침', r.합치기.이유);
  assert.equal(저장.git('rev-parse', 'HEAD^{tree}').trim(), 전트리, '트리는 로컬 그대로');
  assert.equal(저장.git('rev-parse', 'HEAD^1').trim(), 저장.C1);
  assert.equal(저장.git('rev-parse', 'HEAD^2').trim(), r.머리);
  assert.doesNotThrow(() => 저장.git('merge-base', '--is-ancestor', 'origin/master', 'HEAD'));
  assert.deepEqual(상태(저장), [], '작업본·공용 인덱스는 그대로');
});

// ── 재현: 명령줄로 처음부터 끝까지 ────────────────────────────────────────────

test('재현: 남의 미커밋·미푸시가 있는 공용 작업본에서 내 파일만 커밋하고 내 커밋만 올린다(명령줄)', async (t) => {
  const 트랙 = 'docs/_ops/트랙.md';
  const 저장 = 새저장소(t, {
    원격: true, autocrlf: 'true',
    파일: { [트랙]: '# 트랙\n\n## 가\n- a1\n\n## 나\n- b1\n', '남의/스테이징.txt': '바탕\n', '남의/수정.txt': '바탕\n', 'tools/있던.js': 'module.exports = 1;\n' },
  });
  const 명령 = (...args) => {
    const r = spawnSync(process.execPath, [도구경로, ...args], { cwd: 저장.작업본, encoding: 'utf8' });
    t.diagnostic(`$ node tools/내커밋.js ${args.join(' ')}  → 종료 ${r.status}`);
    for (const 줄 of (r.stdout || '').trim().split('\n')) if (!args.includes('--json')) t.diagnostic(`  ${줄}`);
    return r;
  };
  const 제이슨 = (...args) => { const r = 명령(...args, '--json'); return { 종료: r.status, ...JSON.parse(r.stdout) }; };

  // 남: 미푸시 커밋 하나, 스테이징·미커밋 수정·새 파일·트랙의 미커밋 줄
  저장.쓰기('남의/미푸시.txt', '남의 미푸시 커밋\n');
  저장.git('add', '남의/미푸시.txt');
  저장.git('commit', '-q', '-m', '남의 미푸시 커밋');
  const 남의미푸시 = 저장.머리();
  저장.쓰기('남의/스테이징.txt', '바탕\n남이 스테이징\n');
  저장.git('add', '남의/스테이징.txt');
  저장.쓰기('남의/수정.txt', '바탕\n남이 고침\n');
  저장.쓰기('남의/새파일.txt', '남의 새 파일\n');
  // 나: 새 도구와 트랙 한 줄(남의 줄 바로 아래)
  저장.쓰기(트랙, '# 트랙\n\n## 가\n- a1\n- 남의 미커밋 줄\n\n## 나\n- b1\n- 내커밋 도구 추가\n');
  저장.쓰기('tools/새도구.js', 'module.exports = 2;\n');
  const 전상태 = 상태(저장);

  const 막힘 = 제이슨('커밋', 'tools/새도구.js', 트랙, '-m', 'feat: 새 도구', '--실행');
  assert.equal(막힘.종료, 1);
  assert.equal(막힘.결과, '멈춤');
  const 내조각 = 막힘.조각보기[0].조각.find((조) => 조.줄.some((l) => l.글 === '- 내커밋 도구 추가'));
  명령('커밋', 'tools/새도구.js', 트랙, '-m', 'feat: 새 도구');

  const 커밋 = 제이슨('커밋', 'tools/새도구.js', '--조각', `${트랙}=${내조각.id}`, '-m', 'feat: 새 도구', '--실행');
  assert.equal(커밋.종료, 0, 커밋.이유);
  assert.equal(커밋.결과, '커밋함');
  assert.equal(저장.git('rev-parse', 'HEAD~1').trim(), 남의미푸시);
  assert.deepEqual(저장.git('show', '--name-only', '--format=', 'HEAD').trim().split('\n').sort(), [트랙, 'tools/새도구.js'].sort());
  assert.equal(저장.git('show', `HEAD:${트랙}`), '# 트랙\n\n## 가\n- a1\n\n## 나\n- b1\n- 내커밋 도구 추가\n');
  assert.deepEqual(상태(저장), 전상태.filter((x) => !x.endsWith('tools/새도구.js')), '남의 스테이징·미커밋 수정·새 파일·트랙의 남의 줄은 그대로');

  명령('올리기', 커밋.커밋);
  const 올림 = 제이슨('올리기', 커밋.커밋, '--실행');
  assert.equal(올림.종료, 0, JSON.stringify(올림.문제 || 올림.이유));
  assert.equal(올림.결과, '올림');
  assert.equal(저장.원격머리(), 올림.머리);
  assert.equal(저장.원격파일(트랙), '# 트랙\n\n## 가\n- a1\n\n## 나\n- b1\n- 내커밋 도구 추가\n');
  assert.equal(저장.원격파일('tools/새도구.js'), 'module.exports = 2;\n');
  assert.throws(() => 저장.원격파일('남의/미푸시.txt'), '남의 미푸시 커밋은 origin에 없다');
  assert.equal(저장.원격파일('남의/스테이징.txt'), '바탕\n');
  assert.equal(저장.머리(), 커밋.커밋, '로컬 master는 그대로(남의 미푸시 커밋도 그대로)');
  assert.deepEqual(상태(저장), 전상태.filter((x) => !x.endsWith('tools/새도구.js')));
  t.diagnostic(`origin: ${올림.바탕.slice(0, 9)} → ${올림.머리.slice(0, 9)} · 로컬 master ${저장.머리().slice(0, 9)}(남의 미푸시 ${남의미푸시.slice(0, 9)} 위)`);

  const 잘못 = 명령('커밋', '--모르는인자');
  assert.equal(잘못.status, 2);
});
