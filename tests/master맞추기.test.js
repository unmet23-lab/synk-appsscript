/* master맞추기 — 공용 작업본의 로컬 master가 origin/master와 갈라졌을 때 맞추는 도구.
 * 임시 git 저장소(남의 미푸시 커밋·미커밋 수정·스테이징·미추적 파일이 섞인 공용 작업본 흉내)와 임시 원격(bare)에서 잰다.
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
const 도구경로 = path.join(REPO, 'tools', 'master맞추기.js');
const 도구 = require(도구경로);
const 잠금도구 = require(path.join(REPO, 'tools', 'git잠금.js'));

// 시험 git은 이 PC·CI의 시스템·전역 설정을 읽지 않는다(core.autocrlf는 저장소마다 정한다).
for (const k of Object.keys(process.env)) if (/^GIT_/.test(k)) delete process.env[k];
Object.assign(process.env, {
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'synk-master-align-test-no-global-config'),
  GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: '시험', GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: '시험', GIT_COMMITTER_EMAIL: 'test@example.invalid',
});

const 해시 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const 라 = (s) => Buffer.from(s, 'utf8').toString('latin1');   // 도구는 줄을 latin1로 풀어 다룬다
const 짧은잠 = (ms) => spawnSync(process.execPath, ['-e', `setTimeout(()=>{},${Math.min(ms, 50)})`]);

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

/** 임시 공용 작업본과 bare 원격(origin). 바탕 커밋을 바이트 그대로 올려 둔다. */
function 새저장소(t, { 파일 = {}, autocrlf = 'false' } = {}) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-master-align-test-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  const 원격 = path.join(뿌리, 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'master', 원격], { stdio: 'pipe' });
  const 작업본 = path.join(뿌리, '공용');
  fs.mkdirSync(작업본);
  const git = 깃(작업본);
  git('init', '-q', '-b', 'master');
  git('config', 'core.autocrlf', autocrlf);
  for (const [p, v] of Object.entries(파일)) 쓰기(작업본, p, v);
  git('-c', 'core.autocrlf=false', 'add', '-A');
  git('commit', '-q', '-m', '바탕');
  git('remote', 'add', 'origin', 원격);
  git('push', '-q', 'origin', 'master');
  git('fetch', '-q', 'origin');
  return {
    뿌리, 작업본, 원격, git,
    쓰기: (p, v) => 쓰기(작업본, p, v),
    읽기: (p) => fs.readFileSync(path.join(작업본, p), 'utf8'),
    바이트: (p) => fs.readFileSync(path.join(작업본, p)),
    있나: (p) => fs.existsSync(path.join(작업본, p)),
    머리: () => git('rev-parse', 'HEAD').trim(),
    보기: (rev, p) => git('show', `${rev}:${p}`),
    인덱스지문: () => 해시(fs.readFileSync(path.join(작업본, '.git', 'index'))),
    /** 공용 작업본에 남의 미푸시 커밋을 더한다(준 경로만 올린다) */
    커밋(파일들, 메시지 = '남의 미푸시 커밋', 지울 = []) {
      for (const p of 지울) fs.rmSync(path.join(작업본, p));   // 먼저 지운다(파일 a → 폴더 a/ 같은 바꿈)
      for (const [p, v] of Object.entries(파일들)) 쓰기(작업본, p, v);
      git('-c', 'core.autocrlf=false', 'add', '-A', '--', ...Object.keys(파일들), ...지울);
      git('commit', '-q', '-m', 메시지);
      return git('rev-parse', 'HEAD').trim();
    },
    /**
     * 다른 곳에서 origin에 커밋을 올린다(GPT·다른 세션의 push). 커미터 시각을 달리 둔다 — 다시 쌓아 올린 커밋은
     * 작성자·메시지가 같아도 커미터 시각이 달라 번호가 다르다(같은 초에 만들면 로컬 커밋과 번호까지 같아진다).
     */
    원격에올림(파일들, 메시지 = 'origin 커밋', 지울 = []) {
      const 다른 = path.join(뿌리, `다른-${crypto.randomBytes(3).toString('hex')}`);
      execFileSync('git', ['clone', '-q', '-c', 'core.autocrlf=false', 원격, 다른], { stdio: 'pipe' });
      const g = 깃(다른);
      for (const p of 지울) fs.rmSync(path.join(다른, p));
      for (const [p, v] of Object.entries(파일들)) 쓰기(다른, p, v);
      g('add', '-A');
      execFileSync('git', ['commit', '-q', '-m', 메시지], { cwd: 다른, stdio: 'pipe', env: { ...process.env, GIT_COMMITTER_DATE: '2026-10-01T09:00:00+09:00' } });
      g('push', '-q', 'origin', 'master');
      return g('rev-parse', 'HEAD').trim();
    },
  };
}

function 상태(저장) {
  return 저장.git('status', '--porcelain=v1', '--untracked-files=all').split('\n').filter(Boolean).sort();
}

/** 미리 보기 → 그 지문으로 실행 */
async function 맞춰보기(저장, 옵션 = {}) {
  const 미리 = await 도구.맞추기({ 저장소: 저장.작업본, ...옵션 });
  assert.equal(미리.결과, '미리 보기', 미리.이유);
  const r = await 도구.맞추기({ 저장소: 저장.작업본, ...옵션, 실행: 미리.지문 });
  return { 미리, r };
}

// ── 순수 함수 ────────────────────────────────────────────────────────────────

const 줄들 = (...xs) => xs.map((글) => ({ 글: 라(글), 끝: '\n' }));
const 글들 = (r) => r.줄.map((l) => Buffer.from(l.글, 'latin1').toString('utf8'));
const 셈 = (...xs) => { const m = new Map(); for (const x of xs) m.set(라(x), (m.get(라(x)) || 0) + 1); return m; };
const 보인글 = (xs) => xs.map((x) => Buffer.from(x.글, 'latin1').toString('utf8'));

test('줄 검사: 로컬 줄 빠짐·origin 줄 빠짐·지운 줄 남음·같은 줄 두 번·어디서도 오지 않은 줄을 가른다', () => {
  const 바탕 = '- 바탕에 있던 긴 줄입니다(스무 글자 넘게)', 로컬 = '- 로컬이 더한 긴 줄입니다(남의 미푸시)', 원격 = '- origin이 더한 긴 줄입니다(GPT)';
  const 검 = (b, h, o, t, 이음) => Object.fromEntries(Object.entries(도구.줄검사(b, h, o, t, 이음)).map(([k, v]) => [k, 보인글(v)]));
  const 빈 = { 로컬빠짐: [], 원격빠짐: [], 남음: [], 겹침: [], 넘침: [] };
  assert.deepEqual(검(셈(바탕), 셈(바탕, 로컬), 셈(바탕, 원격), 셈(바탕, 로컬, 원격)), 빈, '양쪽 줄이 다 있으면 문제없다');
  assert.deepEqual(검(셈(바탕), 셈(바탕, 로컬), 셈(바탕, 원격), 셈(바탕, 원격)).로컬빠짐, [로컬]);
  assert.deepEqual(검(셈(바탕), 셈(바탕, 로컬), 셈(바탕, 원격), 셈(바탕, 로컬)).원격빠짐, [원격]);
  assert.deepEqual(검(셈(바탕), 셈(바탕, 로컬), 셈(), 셈(로컬)), 빈, 'origin이 지운 바탕 줄은 빠져도 된다');
  assert.deepEqual(검(셈(바탕), 셈(바탕), 셈(), 셈(바탕)).남음, [바탕], 'origin이 지운 줄이 남으면 잡는다');
  assert.deepEqual(검(셈(), 셈(로컬), 셈(로컬), 셈(로컬, 로컬)).겹침, [로컬], '양쪽이 더한 같은 줄(다시 쌓아 올린 커밋)은 한 번');
  assert.deepEqual(검(셈(), 셈(로컬), 셈(로컬), 셈(로컬)), 빈);
  assert.deepEqual(검(셈(), 셈(), 셈(), 셈('- 어디서도 오지 않은 줄')).넘침, ['- 어디서도 오지 않은 줄']);
  assert.deepEqual(검(셈(), 셈('}'), 셈('}'), 셈('}', '}')), 빈, '짧은 줄은 양쪽이 따로 더해도 맞다');
  const 바탕머리 = '> 쓴 AI: 가 10-01', 로컬머리 = `${바탕머리} · 나 10-19`, 원격머리 = `${바탕머리} · GPT 10-19`, 이은 = `${로컬머리} · GPT 10-19`;
  assert.deepEqual(검(셈(바탕머리), 셈(로컬머리), 셈(원격머리), 셈(이은), [{ 원래: [라(로컬머리), 라(원격머리)], 결과: 라(이은) }]), 빈, '한 줄로 이은 줄은 원래 두 줄이 들어 있다고 본다');
  const 지움 = 도구.지움보기(셈(바탕, '- 옛 줄 둘'), 셈(바탕, '- 옛 줄 둘', 로컬), 셈('- 옛 줄 둘'), 셈('- 옛 줄 둘'));
  assert.deepEqual(지움.map((x) => [Buffer.from(x.글, 'latin1').toString('utf8'), x.원격, x.로컬]).sort(), [[로컬, 0, 1], [바탕, 1, 0]].sort());
});

test('겹친 덩어리: 한쪽이 품으면 그쪽, 문서는 양쪽 더한 줄 합침·머리말 잇기, 같은 줄을 다르게 고쳤으면 못 푼다', () => {
  const 풀 = (L, B, T, 문서 = true) => 도구.덩어리풀기(줄들(...L), 줄들(...B), 줄들(...T), 문서);
  let r = 풀(['a2', 'b'], ['a'], ['a2'], false);
  assert.equal(r.방법, '로컬이 origin 변경을 품음');
  assert.deepEqual(글들(r), ['a2', 'b']);
  assert.equal(풀(['a2'], ['a'], ['a2', 'c'], false).방법, 'origin이 로컬 변경을 품음');
  assert.match(풀(['x = 1'], ['x = 0'], ['x = 2'], false).실패, /코드·데이터/);
  r = 풀(['| 10-19 | 로컬 행 |'], [], ['| 10-19 | origin 행 |']);
  assert.deepEqual(글들(r), ['| 10-19 | 로컬 행 |', '| 10-19 | origin 행 |']);
  assert.equal(r.방법, '양쪽이 더한 줄 합침');
  r = 풀(['- 내 줄', '- 로컬 줄'], [], ['- origin 줄', '- 내 줄']);
  assert.deepEqual(글들(r), ['- origin 줄', '- 내 줄', '- 로컬 줄'], '양쪽이 더한 같은 줄(다시 쌓아 올린 줄)은 한 번, 차례는 양쪽 차례를 따른다');
  r = 풀(['> 쓴 AI: 가 10-01 · 나 10-19'], ['> 쓴 AI: 가 10-01'], ['> 쓴 AI: 가 10-01 · GPT 10-19']);
  assert.deepEqual(글들(r), ['> 쓴 AI: 가 10-01 · 나 10-19 · GPT 10-19'], '같은 줄 끝에 덧붙인 글은 잇는다');
  assert.equal(r.이음.length, 1);
  // 현장 노트 머리말 세 줄: 판·마지막 확인은 양쪽이 같게 고쳤고(다시 쌓아 올림) 쓴 AI에는 서로 다른 항목을 덧붙였다
  r = 풀(['> 판: A2', '> 마지막 확인: 10-19', '> 쓴 AI: X · 나'], ['> 판: A', '> 마지막 확인: 10-17', '> 쓴 AI: X'], ['> 판: A2', '> 마지막 확인: 10-19', '> 쓴 AI: X · GPT']);
  assert.deepEqual(글들(r), ['> 판: A2', '> 마지막 확인: 10-19', '> 쓴 AI: X · 나 · GPT']);
  // 같은 항목들을 양쪽이 다른 차례로 덧붙였으면(다시 쌓아 올림) 로컬 차례로 한 번씩
  r = 풀(['> 마지막 확인: 10-19', '> 쓴 AI: X 옮김 · 가 10-18 버퍼 · 나 10-19 reset'], ['> 마지막 확인: 10-18', '> 쓴 AI: X 옮김'], ['> 마지막 확인: 10-19', '> 쓴 AI: X 옮김 · 나 10-19 reset · 가 10-18 버퍼']);
  assert.deepEqual(글들(r), ['> 마지막 확인: 10-19', '> 쓴 AI: X 옮김 · 가 10-18 버퍼 · 나 10-19 reset']);
  assert.match(풀(['> 판: A', '> 마지막 확인: 10-19 로컬'], ['> 판: A', '> 마지막 확인: 10-17'], ['> 판: A', '> 마지막 확인: 10-19 origin']).실패, /같은 줄을 다르게 고쳤다: > 마지막 확인: 10-17/);
  assert.match(풀(['- 항목 로컬이 고침'], ['- 항목 바탕'], ['- 항목 origin이 고침']).실패, /같은 줄을 다르게 고쳤다/);
  const 앞 = '- **자동화 3종 후속(10-17):** 게시 후 24/72시간 성과 예약은 회사 서버 릴리스에 반영했다';
  assert.match(풀([`${앞}(로컬 판)`], [], [`${앞}(origin 판)`]).실패, /같은 머리의 다른 줄/, '같은 항목의 두 판은 둘 다 넣지 않는다');
  // 같은 항목을 양쪽이 새로 썼는데 한쪽이 문장을 더 붙였다(다시 쌓아 올린 뒤 고침): 긴 쪽 하나, origin만 더한 줄은 그대로
  const 증상 = '- 증상: 앱을 다시 켠 뒤 같은 세션의 명령이 거부된다.';
  r = 풀(['### 제목', `${증상} 다른 세션에서도 그랬다.`, '- 원인: 같다'], [], ['### 제목', 증상, '- 원인: 같다', '- 고침: origin만 더함']);
  assert.deepEqual(글들(r), ['### 제목', `${증상} 다른 세션에서도 그랬다.`, '- 원인: 같다', '- 고침: origin만 더함']);
  // 짧은 줄(20자 미만)은 앞부분이 같아도 서로 다른 항목일 수 있어 흡수하지 않고 둘 다 둔다
  assert.deepEqual(글들(풀(['## 가'], [], ['## 가나다'])), ['## 가', '## 가나다']);
  assert.deepEqual(글들(풀(['- PULSE 뮤직비디오'], [], ['- PULSE 뮤직비디오 포트폴리오 10-19 공개'])), ['- PULSE 뮤직비디오', '- PULSE 뮤직비디오 포트폴리오 10-19 공개']);
  // 한쪽이 덩어리 안에서 차례만 바꿨으면(줄 셈은 그대로) 다른 쪽이 그 변경을 품은 것이 아니다
  assert.match(풀(['const c = 3;', 'const b = 2;'], ['const b = 2;', 'const c = 3;'], ['const b = 20; // origin', 'const c = 3;'], false).실패, /코드·데이터/);
  assert.match(풀(['q();', 'a();', 'k();'], ['a();', 'k();'], ['a();', 'k();', 'q();', 'z();'], false).실패, /코드·데이터/, '같은 줄이라도 다른 자리에 끼웠으면 품은 것이 아니다');
  r = 풀(['a', '- 로컬 줄', 'c'], ['a', 'b', 'c'], ['a', 'b', 'c', '- origin 줄']);
  assert.deepEqual(글들(r), ['a', '- 로컬 줄', 'c', '- origin 줄'], '한쪽만 지운 바탕 줄은 지운다');
  r = 풀(['- X 다시 쌓은 줄', 'a', '- 로컬 줄'], ['a'], ['a', '- X 다시 쌓은 줄', '- origin 줄']);
  assert.deepEqual(글들(r), ['- X 다시 쌓은 줄', 'a', '- 로컬 줄', '- origin 줄'], '다시 쌓으며 다른 자리에 끼인 같은 줄도 한 번');
  assert.match(풀(['- a1 로컬이 고침', '- 남의 미푸시 줄 하나'], ['- a1'], ['- a1을 origin이 고쳐 씀', '- origin 줄']).실패, /같은 (줄|곳)을 다르게 고쳤다/, '같은 바탕 줄을 둘 다 고쳤으면 멈춘다');
  assert.match(풀(['- 로컬 새 줄 하나', '- 로컬 새 줄 둘', '- 셋'], ['- 옛 줄'], ['- origin 새 줄']).실패, /같은 곳을 다르게 고쳤다/, '짝 못 지은 줄이 양쪽에 남으면 멈춘다');
});

test('한 줄 합치기: 한쪽이 품으면 긴 쪽, 바탕이 있으면 3방향(「 · 」 목록은 항목 단위, 아니면 낱말 단위), 겹치면 못 한다', () => {
  const 합 = (a, c, b) => { const r = 도구.한줄합치기(라(a), 라(c), b == null ? null : 라(b)); return r === null ? null : Buffer.from(r, 'latin1').toString('utf8'); };
  const 증상 = '- 증상: 앱을 다시 켠 뒤 같은 세션의 명령이 거부된다.';
  assert.equal(합(`${증상} 다른 세션에서도 그랬다.`, 증상, null), `${증상} 다른 세션에서도 그랬다.`, '바탕 없으면 낱말째 품는 긴 쪽');
  assert.equal(합('- 로컬 판 문장', '- origin 판 문장', null), null, '바탕 없이 서로 다르면 못 한다');
  assert.equal(합('- 항목 가', '- 항목 가나다라 설명', null), null, '짧은 줄은 긴 줄에 흡수하지 않는다');
  // 바탕이 있으면 「긴 쪽」을 쓰지 않는다 — 한쪽의 낱말 지움을 되살리게 된다(양방향)
  assert.equal(합('- 항목: 가 나 다 라', '- 항목: 가 나', '- 항목: 가 나 다'), null);
  assert.equal(합('- 항목: 가 나', '- 항목: 가 나 다 라', '- 항목: 가 나 다'), null);
  const 바탕 = '> 쓴 AI: 가 10-01 · 다 10-17', 꼬리 = ' · 나(Opus) 10-19 커밋 도구';
  assert.equal(합(바탕 + 꼬리, `${바탕} · 나 10-18 아르곤 두 항목${꼬리}`, 바탕), `${바탕} · 나 10-18 아르곤 두 항목${꼬리}`, 'origin이 가운데 끼운 항목은 그 자리에');
  // 10-19 실제 「시험_화면확인」 머리말 꼴: 양쪽이 서로 다른 항목을 끼운 뒤 같은 꼬리 항목들을 가졌다 → 꼬리는 한 번
  const 머리말 = '> 쓴 AI: Claude Code — 09-30~10-17 옮김 · 클라우드 세션 10-17 더함';
  const 같은꼬리 = ' · Claude Code 10-19 전체 캡처 폭 추가 · Claude Code 10-19 타이머 함정 추가';
  assert.equal(합(`${머리말} · GPT(Codex) 10-17 확장 오류 범위 추가${같은꼬리}`, `${머리말} · 10-18 헤드리스 fps 재기${같은꼬리}`, 머리말),
    `${머리말} · GPT(Codex) 10-17 확장 오류 범위 추가 · 10-18 헤드리스 fps 재기${같은꼬리}`);
  assert.equal(합(`${머리말} · GPT 확장 오류 범위 추가${같은꼬리} · 로컬 끝 항목`, `${머리말} · 10-18 헤드리스 fps 재기${같은꼬리}`, 머리말),
    `${머리말} · GPT 확장 오류 범위 추가 · 10-18 헤드리스 fps 재기${같은꼬리} · 로컬 끝 항목`, '「 · 」 항목 목록은 항목 단위로 — 같은 꼬리는 한 번');
  // 10-19 실제 꼴: origin이 로컬의 항목 하나를 꼬리 뒤에 다시 붙였다 → 항목마다 한 번, 차례는 두 목록의 공통 차례(꼬리 두 항목)를 따른다
  const 머리말2 = '> 쓴 AI: Claude Code — 09-30~10-17 옮김';
  assert.equal(합(`${머리말2} · GPT 10-17 확장 · GPT 10-18 계정 격리 · CC 10-19 캡처 폭 · CC 10-19 타이머`, `${머리말2} · 10-18 헤드리스 fps · CC 10-19 캡처 폭 · CC 10-19 타이머 · GPT 10-18 계정 격리`, 머리말2),
    `${머리말2} · GPT 10-17 확장 · GPT 10-18 계정 격리 · 10-18 헤드리스 fps · CC 10-19 캡처 폭 · CC 10-19 타이머`);
  // 10-19 실제 「git_줄끝_잠금」 머리말 꼴: 양쪽이 같은 항목들을 다른 차례로 덧붙였다 → 로컬 차례로 한 번씩
  const 머리말3 = '> 쓴 AI: Claude Code — 10-02~10-17 옮김 · 클라우드 세션 10-17 더함';
  assert.equal(합(`${머리말3} · GPT 10-18 버퍼 한도 · CC 10-19 reset 재발 · CC 10-19 내커밋 · CC 10-19 EOF`, `${머리말3} · CC 10-19 reset 재발 · CC 10-19 내커밋 · GPT 10-18 버퍼 한도 · CC 10-19 EOF`, 머리말3),
    `${머리말3} · GPT 10-18 버퍼 한도 · CC 10-19 reset 재발 · CC 10-19 내커밋 · CC 10-19 EOF`);
  // 10-19 실제 「브라우저_게시」 꼴: 한쪽은 항목을 가운데 끼웠고 다른 쪽은 같은 항목을 끝에 붙였다 → 로컬 자리에 한 번(양방향)
  const 머리말4 = '> 쓴 AI: Claude Code — 10-03~10-14 옮김 · GPT 10-17 차단 범위 · GPT 10-18 Argon 예약';
  const 가운데 = '> 쓴 AI: Claude Code — 10-03~10-14 옮김 · Claude 10-18 확장 끊김 · GPT 10-17 차단 범위 · GPT 10-18 Argon 예약';
  assert.equal(합(가운데, `${머리말4} · Claude 10-18 확장 끊김`, 머리말4), 가운데);
  assert.equal(합(`${머리말4} · Claude 10-18 확장 끊김`, 가운데, 머리말4), `${머리말4} · Claude 10-18 확장 끊김`);
  // 괄호·「」·백틱 안의 「 · 」는 항목을 나누지 않는다(10-19 실제 「통화 항목 옮김(10-17 … · 10-18 …)」 꼴)
  const 머리5 = '> 쓴 AI: 가 옮김 · 나 10-17 더함';
  assert.equal(합(`${머리5} · 다 10-19 X(10-17 A · 공통 끝)`, `${머리5} · 라 10-19 Y(10-18 B · 공통 끝)`, 머리5), `${머리5} · 다 10-19 X(10-17 A · 공통 끝) · 라 10-19 Y(10-18 B · 공통 끝)`);
  assert.equal(합(`${머리5} · 「가 · 공통」 인용`, `${머리5} · 「나 · 공통」 인용`, 머리5), `${머리5} · 「가 · 공통」 인용 · 「나 · 공통」 인용`);
  assert.equal(합(`${머리5} · \`a · 공통\` 코드`, `${머리5} · \`b · 공통\` 코드`, 머리5), `${머리5} · \`a · 공통\` 코드 · \`b · 공통\` 코드`);
  assert.equal(합('> 쓴 AI: 가(열림 · 나', '> 쓴 AI: 가(열림 · 나 · 다', '> 쓴 AI: 가(열림 · 나'), '> 쓴 AI: 가(열림 · 나 · 다', '닫히지 않은 괄호면 괄호를 보지 않고 나눈다');
  assert.equal(합('> 쓴 AI: 가(열림 · 나 · A · 꼬리', '> 쓴 AI: 가(열림 · 나 · B · 꼬리', '> 쓴 AI: 가(열림 · 나'), '> 쓴 AI: 가(열림 · 나 · A · B · 꼬리', '짝 안 맞는 줄도 같은 꼬리 항목은 한 번');
  assert.equal(합('> 쓴 AI: H · 가(10-17 · 꼬리', '> 쓴 AI: H · 나 · 꼬리', '> 쓴 AI: H'), null, '한쪽이 괄호 짝을 바꿨으면 어디까지가 한 항목인지 몰라 멈춘다');
  assert.equal(합('> 쓴 AI: H · `코드 · 꼬리', '> 쓴 AI: H · 나 · 꼬리', '> 쓴 AI: H'), null, '백틱도');
  // Fable 검수(10-19 저녁): 같은 자리에 넣은 낱말은 글자 포함이 아니라 낱말째 품을 때만 고른다 — 「공개」 ⊂ 「비공개」로 「공개」가 사라지면 안 된다
  assert.equal(합('- 상태: 공개 10-19 확인.', '- 상태: 비공개 10-19 확인.', '- 상태: 10-19 확인.'), null);
  assert.equal(합('- 상태: 가 X 나', '- 상태: 가 XY 나', '- 상태: 가 나'), null);
  assert.equal(합('- 결과: 10-19 재시작 후 정상.', '- 결과: 10-19 재시작 후 비정상.', '- 결과: 10-19 재시작 후'), null);
  assert.equal(합('- 확인: 앱을 다시 켠 뒤 같은 세션의 명령을 다시 보냄 끝.', '- 확인: 앱을 다시 켠 뒤 같은 세션의 명령을 또 보냄 끝.', '- 확인: 끝.'), null, '같은 자리의 다른 낱말');
  assert.equal(합('- 가. X 추가.', '- 가.  X 추가.', '- 가.'), '- 가.  X 추가.', '띄어쓰기만 다른 덧붙임은 한 번');
  // 바탕 줄 끝 공백은 따로 다룬다 — 덧붙인 글이 붙거나 같은 항목이 두 번 들어가지 않게
  assert.equal(합('> 쓴 AI: 가 옮김 · 나 10-17 더함 · 새 항목', '> 쓴 AI: 가 옮김 · 나 10-17 더함 고침', '> 쓴 AI: 가 옮김 · 나 10-17 더함 '), '> 쓴 AI: 가 옮김 · 나 10-17 더함 고침 · 새 항목');
  assert.equal(합('- 고침: Node로 한다. 로컬 문장.', '- 고침: Node로 한다. origin 문장.', '- 고침: Node로 한다. '), '- 고침: Node로 한다. 로컬 문장. origin 문장.');
  assert.equal(합('> 쓴 AI: A · B · GPT 10-18 ', '> 쓴 AI: A · B · GPT 10-18', '> 쓴 AI: A · B'), '> 쓴 AI: A · B · GPT 10-18 ', '끝 공백만 다른 같은 항목은 한 번(끝 공백은 바꾼 쪽)');
  // 같은 글을 서로 다른 자리에 끼웠으면(다시 쌓으며 옮긴 글) 두 번 넣지 않게 멈춘다
  assert.equal(합('- 상태: 가 완료 나', '- 상태: 가 나 완료', '- 상태: 가 나'), null);
  assert.equal(합('- 고침: 대조는 Node 스크립트로 한다. 10-19 재확인.', '- 고침: 대조는 10-19 재확인. Node 스크립트로 한다.', '- 고침: 대조는 Node 스크립트로 한다.'), null);
  // 둘 다 마지막 낱말 뒤에 이어 썼으면(같은 자리의 다른 판) 바탕이 문장으로 끝났을 때만 잇는다
  assert.equal(합('> 마지막 확인: 10-19 오전', '> 마지막 확인: 10-19 저녁', '> 마지막 확인: 10-19'), null);
  // origin이 끝 항목을 늘리며 새 항목도 붙였으면 늘린 글 다음에 새 항목을 로컬·origin 차례로
  assert.equal(합('- 메모 · 가', '- 메모 고침 · 나', '- 메모'), '- 메모 고침 · 가 · 나');
  // 한쪽은 새 항목을 붙이고 다른 쪽은 끝 항목에 글을 늘렸으면 늘린 글이 새 항목 앞(양방향)
  assert.equal(합(`${머리5} · 새 항목 10-19`, `${머리5} 고침(10-19)`, 머리5), `${머리5} 고침(10-19) · 새 항목 10-19`);
  assert.equal(합(`${머리5} 고침(10-19)`, `${머리5} · 새 항목 10-19`, 머리5), `${머리5} 고침(10-19) · 새 항목 10-19`);
  assert.equal(합('> 쓴 AI: 가 · 다', '> 쓴 AI: 가 · 나 · 다 · 라', '> 쓴 AI: 가 · 나 · 다'), null, '한쪽이 바탕 항목을 지웠으면 못 한다');
  assert.equal(합('> 쓴 AI: X 옮김 · CC 10-19 내커밋 도구, 잠금 경로', '> 쓴 AI: X 옮김 · CC 10-19 내커밋 도구, 잠금 경로 추가', '> 쓴 AI: X 옮김'), null, '같은 항목의 두 판(조각이 겹침)은 못 한다');
  const 고침 = '- 고침: 대조는 Node 스크립트로 한다.';
  assert.equal(합(`${고침} 로컬이 덧붙인 문장. 둘 다 다시 쌓아 올린 같은 꼬리 문장.`, `${고침} origin이 덧붙인 문장. 둘 다 다시 쌓아 올린 같은 꼬리 문장.`, 고침), null, '양쪽이 덧붙인 같은 문장이 두 번 들어가면 못 한다');
  assert.equal(합('> 쓴 AI: 가 · 나 고침 · 다', '> 쓴 AI: 가 · 나 · 다 · 라', '> 쓴 AI: 가 · 나 · 다'), '> 쓴 AI: 가 · 나 고침 · 다 · 라', '항목 안을 고친 쪽이 있으면 낱말 단위로');
  assert.equal(합('- 문장 A 끝에 · 로컬 항목', '- 문장 B 끝에 · origin 항목', '- 문장 A 끝에'), null, '항목 목록이어도 바탕 낱말을 바꾼 쪽이 있으면 못 한다');
  assert.equal(합('- **댓글 DM:** 기본. 10-19 로컬이 덧붙인 문장.', '- **댓글 DM:** 기본. **10-19 서버 감시:** origin이 덧붙인 문장.', '- **댓글 DM:** 기본.'),
    '- **댓글 DM:** 기본. 10-19 로컬이 덧붙인 문장. **10-19 서버 감시:** origin이 덧붙인 문장.');
  assert.equal(합('- v5 일정', '- v6 일정', '- v4 일정'), null, '같은 낱말을 서로 다르게 고쳤다');
  assert.equal(합('- a1 로컬이 덧붙임', '- a1을 origin이 고쳐 씀', '- a1'), null, '한쪽이 바탕 낱말을 바꿨으면 낱말 단위로 합치지 않는다(뜻이 꼬인다)');
  assert.notEqual(도구.남은표시(Buffer.from('a\n<<<<<<< 로컬\nb\n'), [Buffer.from('a\n')]), null);
  assert.equal(도구.남은표시(Buffer.from('a\n=======\n'), [Buffer.from('a\n=======\n')]), null, '원래 판에 있던 표시 줄은 괜찮다');
});

test('diff3 덩어리 나누기는 긴 충돌 표시만 본다(글 안의 「<<<<<<<」는 그냥 줄)', () => {
  const 표 = (c) => c.repeat(31);
  const 글 = ['앞', '<<<<<<< 글 안의 표시', `${표('<')} 로컬`, 'L', `${표('|')} 바탕`, 'B', 표('='), 'T', `${표('>')} origin`, '뒤'];
  const r = 도구.블록나누기(줄들(...글));
  assert.equal(r.length, 3);
  assert.deepEqual(r[0].평.map((l) => l.글), ['앞', '<<<<<<< 글 안의 표시'].map(라));
  assert.deepEqual(Object.fromEntries(Object.entries(r[1].충돌).map(([k, v]) => [k, v.map((l) => l.글)])), { 로컬: ['L'], 바탕: ['B'], 원격: ['T'] });
  assert.deepEqual(r[2].평.map((l) => l.글), [라('뒤')]);
});

test('겹친 사본 정리: 다른 자리에 두 번 들어간 절·행은 뒤쪽 사본을 지우고(붙은 짧은 머리·꼬리 줄까지), 한쪽 판에 그만큼 있는 절·머리만 같은 절은 두고, 서로 품지 않거나 사본 조각이 남으면 멈춘다', () => {
  // 쪽: [로컬 판 줄들, origin 판 줄들] — 도구에는 판마다의 줄 셈(빈 줄 빼고)이 간다
  const 판셈 = (xs) => 셈(...xs.filter((x) => x.trim()));
  const 정리 = (xs, 겹침, [로컬 = [], 원격 = []] = []) => 도구.겹침정리(줄들(...xs), 겹침.map(([글, 수 = 1]) => ({ 글: 라(글), 수 })), { 로컬: 판셈(로컬), 원격: 판셈(원격) });
  const X = '### 10-19 다시 쌓아 올린 항목(양쪽이 더함)', x1 = '- 그 항목의 첫 줄입니다(스무 자 넘게)', x2 = '- 그 항목의 둘째 줄입니다(스무 자 넘게)';
  // 같은 절을 양쪽이 다른 자리에 더했다 → 앞 사본만 남기고, 파일 끝까지였던 뒤 사본 앞 빈 줄도 지운다
  const 로컬1 = ['# 트랙', '', '## 가', '- a1', '', X, x1, x2, '', '## 다', '- c1'];
  let r = 정리([...로컬1, '', X, x1, x2], [[X], [x1], [x2]], [로컬1, ['# 트랙', '', '## 가', '- a1', '', '## 다', '- c1', '', X, x1, x2]]);
  assert.deepEqual(글들(r), 로컬1);
  assert.deepEqual([r.절, r.줄수], [1, 4]);
  // 다른 사본을 다 품는 사본이 있으면 그것을 남긴다(뒤에 있어도)
  r = 정리(['## 가', '', X, x1, '', '## 나', '', X, x1, x2], [[X], [x1]], [['## 가', '', X, x1, '', '## 나'], ['## 가', '', '## 나', '', X, x1, x2]]);
  assert.deepEqual(글들(r), ['## 가', '', '## 나', '', X, x1, x2]);
  const 로컬줄 = '- 로컬 판에만 있는 줄입니다(스무 자 넘게)', 원격줄 = '- origin 판에만 있는 줄입니다(스무 자 넘게)';
  assert.match(정리(['## 가', '', X, x1, 로컬줄, '', '## 나', '', X, x1, 원격줄], [[X], [x1]], [['## 가', '', X, x1, 로컬줄, '', '## 나'], ['## 가', '', '## 나', '', X, x1, 원격줄]]).실패,
    /어느 사본도 다른 사본을 다 품지 않는다/, '같은 항목의 두 판은 고르지 않는다');
  const 주 = '## 매주 점검(같은 머리가 여러 번 나온다)';
  assert.match(정리([주, x1, 주, x1, 주, x1], [[x1]], [[주, x1, 주], [주, 주, x1]]).실패, /한쪽 판에 2번, 합친 판에 3번/);
  assert.match(정리(['### 셋', x1, '### 셋', x1, '### 셋', x1], [[x1]], [['### 셋', x1], ['### 셋', x1]]).실패, /남길 줄까지 지웠다/, '겹친 수보다 많이 지우지 않는다');
  // 한쪽 판에 이미 그만큼 있는 절(매주 같은 머리), 머리만 같고 겹친 줄을 함께 갖지 않은 절은 그대로 — 표의 두 번 들어간 행만 지운다
  const R = '| 10-19 | 다시 쌓아 올린 결정 행(양쪽이 더함) |';
  const 표앞 = [주, '- 1주 점검 내용입니다(스무 자 넘게)', '', 주, '- 2주 점검 내용입니다(스무 자 넘게)', ''], 표머리 = ['| 날짜 | 결정 |', '|---|---|'];
  const 표 = [...표앞, '### 메모', '- 로컬이 쓴 메모', '', '### 메모', '- origin이 쓴 메모', '', ...표머리, R, '| 10-18 | 다른 행 |', R];
  r = 정리(표, [[R]], [[...표앞, '### 메모', '- 로컬이 쓴 메모', '', ...표머리, R, '| 10-18 | 다른 행 |'], [...표앞, '### 메모', '- origin이 쓴 메모', '', ...표머리, '| 10-18 | 다른 행 |', R]]);
  assert.deepEqual(글들(r), 표.slice(0, -1));
  assert.deepEqual([r.절, r.줄수], [0, 1]);
  r = 정리([주, '- 1주', x1, '', 주, '- 2주', x1], [[x1]], [[주, '- 1주', x1, '', 주, '- 2주'], [주, '- 1주', '', 주, '- 2주', x1]]);
  assert.deepEqual(글들(r), [주, '- 1주', x1, '', 주, '- 2주'], '한쪽 판에 그만큼 있는 절 안에 두 번 들어간 줄은 줄만 지운다');
  // 줄 묶음: 사이에 끼인 짧은 줄은 묶음째 앞에 있을 때만 함께 지우고, 앞뒤 빈 줄은 한 겹만 남긴다
  const 첫 = '- 겹친 첫 줄입니다(스무 자 넘게 깁니다)', 둘 = '- 겹친 둘째 줄입니다(스무 자 넘게 깁니다)';
  const 가 = '- 항목 가의 긴 줄입니다(스무 자 넘게)', 나 = '- 항목 나의 긴 줄입니다(스무 자 넘게)';
  r = 정리([첫, '  - 짧은 줄', 둘, '', 가, '', 첫, '  - 짧은 줄', 둘, '', 나], [[첫], [둘]], [[첫, '  - 짧은 줄', 둘, '', 가, '', 나], [가, '', 첫, '  - 짧은 줄', 둘, '', 나]]);
  assert.deepEqual(글들(r), [첫, '  - 짧은 줄', 둘, '', 가, '', 나]);
  r = 정리(['- 가', 첫, 둘, '- 나', '', 첫, '', 둘, '', '- 다'], [[첫], [둘]], [['- 가', 첫, 둘, '- 나', '', '- 다'], ['- 가', '- 나', '', 첫, '', 둘, '', '- 다']]);
  assert.deepEqual(글들(r), ['- 가', 첫, 둘, '- 나', '', '- 다'], '겹친 줄 사이 빈 줄은 앞 사본에 없어도 함께 지운다');
  assert.deepEqual(글들(정리([첫, '- 가', '', 첫], [[첫]], [[첫, '- 가'], ['- 가', '', 첫]])), [첫, '- 가'], '파일 끝 사본을 지우면 그 앞 빈 줄도');
  assert.match(정리([첫, '  - 앞 사본의 짧은 줄', 둘, '', 첫, '  - 뒤 사본 짧은 줄', 둘], [[첫], [둘]]).실패, /앞에 그대로 있지 않아/);
  assert.match(정리([`x${첫}`, '  - 짧은 줄', `${둘}x`, 첫, 둘, 첫, '  - 짧은 줄', 둘], [[첫], [둘]]).실패, /앞에 그대로 있지 않아/, '줄 가운데에 걸친 글은 앞에 있는 것으로 보지 않는다');
  // 사본에 붙은 짧은 줄(본문 없는 부모 머리, 「- 10-19 새 항목:」 같은 머리·꼬리 줄)은 남긴 사본 옆과 같고 어느 판보다 많으면 함께 지운다 — Fable 10-20 ①
  const 묶음로컬 = ['# 트랙', '', '## 가', '- a1', '', '## 새 묶음', '', X, x1, '', '## 다', '- c1'];
  r = 정리([...묶음로컬, '', '## 새 묶음', '', X, x1], [[X], [x1]], [묶음로컬, ['# 트랙', '', '## 가', '- a1', '', '## 다', '- c1', '', '## 새 묶음', '', X, x1]]);
  assert.deepEqual(글들(r), 묶음로컬, '빈 줄 너머의 본문 없는 부모 머리까지');
  const 새항목 = ['- 10-19 새 항목:', 첫, 둘, '  - 끝.'];
  r = 정리(['# d', '- 가', ...새항목, '- 나', '- 다', ...새항목], [[첫], [둘]], [['# d', '- 가', ...새항목, '- 나', '- 다'], ['# d', '- 가', '- 나', '- 다', ...새항목]]);
  assert.deepEqual(글들(r), ['# d', '- 가', ...새항목, '- 나', '- 다']);
  r = 정리(['## 가', '', X, x1, '', '## 가', '', X, x1], [[X], [x1]], [['## 가', '', X, x1, '', '## 가'], ['## 가', '', '## 가', '', X, x1]]);
  assert.deepEqual(글들(r), ['## 가', '', X, x1, '', '## 가'], '남긴 사본 옆과 같아도 어느 판에 그만큼 있는 줄(두 번 있는 머리)은 지우지 않는다');
  // 남긴 사본 옆과 달라 함께 못 지운 짧은 줄이 어느 판보다 많이 남으면 사본 조각일 수 있어 멈춘다(줄 묶음·절 둘 다)
  assert.match(정리(['# d', '- 메모:', '- 가', 첫, 둘, '- 나', '- 메모:', 첫, 둘], [[첫], [둘]], [['# d', '- 메모:', '- 가', 첫, 둘, '- 나'], ['# d', '- 가', '- 나', '- 메모:', 첫, 둘]]).실패,
    /지운 사본 옆 짧은 줄 「- 메모:」이 로컬·origin 어느 판보다 많이 남는다/);
  assert.match(정리(['# t', '- 메모:', '', '## 가', '', X, x1, '', '## 나', '- 메모:', '', X, x1], [[X], [x1]], [['# t', '- 메모:', '', '## 가', '', X, x1, '', '## 나'], ['# t', '', '## 가', '', '## 나', '- 메모:', '', X, x1]]).실패,
    /지운 사본 옆 짧은 줄 「- 메모:」/);
});

test('인자 읽기: 지문·풀이·허용·되풀이, 틀리면 사용법 오류', () => {
  const r = 도구.인자읽기(['--풀이', 'docs/_ops/트랙.md=로컬', '--허용', 'docs/_ops/트랙.md', '--실행', '0123456789', '-m', '병합']);
  assert.deepEqual(r.풀이, [['docs/_ops/트랙.md', '로컬']]);
  assert.deepEqual(r.허용, ['docs/_ops/트랙.md']);
  assert.equal(r.실행, '0123456789');
  assert.equal(도구.인자읽기(['--실행', '0123456789', '--되풀이', '3']).되풀이, 3);
  const 실행 = ['--실행', '0123456789'];
  for (const 틀림 of [['--실행', 'abc'], ['--풀이', '경로만'], ['--풀이', '=로컬'], ['--모름'], ['-m', '실행 없이'], ['--허용'],
    ['--되풀이', '2'], [...실행, '--되풀이', '0'], [...실행, '--되풀이', '10'], [...실행, '--되풀이', 'x'], [...실행, '--되풀이']]) {
    assert.throws(() => 도구.인자읽기(틀림), (e) => e.constructor.name === '사용법오류', 틀림.join(' '));
  }
});

// ── 병합 ────────────────────────────────────────────────────────────────────

const 트랙 = 'docs/_ops/트랙.md', 결정 = 'docs/_ops/결정.md';
const 결정머리 = '# 결정\n\n| 날짜 | 결정 |\n|---|---|\n';

/** 남의 미푸시 커밋·미커밋 수정·스테이징·미추적 파일이 있는 공용 작업본과, 그새 GPT가 올린 origin */
function 갈라진저장소(t) {
  const 저장 = 새저장소(t, {
    파일: {
      [트랙]: '# 트랙\n\n## 가\n- a1\n\n## 나\n- b1\n\n## 다\n- c1\n', [결정]: `${결정머리}| 10-01 | 첫 결정 |\n`,
      'tools/a.js': 'module.exports = 1;\n', '지울.txt': '곧 지운다\n', '그림.bin': Buffer.from([0, 1, 2, 3]),
      '남의/수정.txt': '바탕\n', '남의/스테이징.txt': '바탕\n',
    },
  });
  저장.P1 = 저장.커밋({
    [트랙]: '# 트랙\n\n## 가\n- a1\n- a2 남의 미푸시 줄\n\n## 나\n- b1\n\n## 다\n- c1\n',
    [결정]: `${결정머리}| 10-19 | 남의 미푸시 결정 행 |\n| 10-01 | 첫 결정 |\n`,
    'tools/local.js': 'module.exports = "local";\n',
  }, '남의 미푸시 커밋(유호님 확인 기다리는 중)');
  저장.O1 = 저장.원격에올림({
    [트랙]: '# 트랙\n\n## 가\n- a1\n\n## 나\n- b1\n- b2 origin 줄\n\n## 다\n- c1\n',
    [결정]: `${결정머리}| 10-19 | origin 결정 행 |\n| 10-01 | 첫 결정 |\n`,
    'tools/a.js': 'module.exports = 2;\n', 'docs/새.md': '# origin 새 문서\n', '그림.bin': Buffer.from([0, 9, 9, 9]),
  }, 'GPT가 올린 커밋', ['지울.txt']);
  저장.쓰기(트랙, '# 트랙\n\n## 가\n- a1\n- a2 남의 미푸시 줄\n\n## 나\n- b1\n\n## 다\n- c1\n- c2 남의 미커밋 줄\n');
  저장.쓰기('남의/수정.txt', '바탕\n남이 고치는 중\n');
  저장.쓰기('남의/스테이징.txt', '바탕\n남이 스테이징\n');
  저장.git('add', '남의/스테이징.txt');
  저장.쓰기('남의/새.txt', '남의 새 파일\n');
  return 저장;
}

test('병합: 남의 미푸시·미커밋·스테이징·미추적이 섞인 공용 작업본을 origin과 맞추고 남의 것은 그대로 둔다', async (t) => {
  const 저장 = 갈라진저장소(t);
  const 전상태 = 상태(저장);   // git status가 공용 인덱스를 다시 쓸 수 있어 지문보다 먼저
  const 전 = { 머리: 저장.머리(), 인덱스: 저장.인덱스지문(), 상태: 전상태, 트랙: 저장.바이트(트랙) };
  const 미리 = await 도구.맞추기({ 저장소: 저장.작업본 });
  assert.equal(미리.결과, '미리 보기', 미리.이유);
  assert.equal(미리.방법, '병합');
  assert.equal(미리.원격머리, 저장.O1);
  assert.deepEqual([미리.로컬만, 미리.원격만], [1, 1]);
  assert.deepEqual(미리.합침.map((x) => `${x.경로} ${x.방법}`), [`${결정} 양쪽이 더한 줄 합침`, `${트랙} 3방향`]);
  assert.deepEqual(미리.줄문제, []);
  assert.deepEqual(미리.지움.map((x) => `${x.경로} ${x.바이너리 ? '바이너리' : `${x.원격}/${x.로컬}`}`).sort(), ['tools/a.js 1/0', '그림.bin 바이너리', '지울.txt 1/0'].sort(), '지워지는 줄은 모두 origin이 지운 줄');
  assert.deepEqual(Object.fromEntries(미리.작업본.map((x) => [x.경로, x.할일])), {
    [결정]: '새 판', [트랙]: '3방향', 'docs/새.md': '새 판', 'tools/a.js': '새 판', '그림.bin': '새 판', '지울.txt': '지움',
  });
  assert.match(미리.지문, /^[0-9a-f]{10}$/);
  assert.deepEqual([저장.머리(), 저장.인덱스지문(), 상태(저장)], [전.머리, 전.인덱스, 전.상태], '미리 보기는 아무것도 바꾸지 않는다');
  assert.ok(저장.바이트(트랙).equals(전.트랙));
  assert.match(도구.보고글(미리), /로컬 HEAD 대비 계획 트리에서 지워지는 줄 — 3경로 3줄\(origin이 지운 줄 3 · 한 줄로 이은 줄 0 · 로컬 줄 0\)/);

  const r = await 도구.맞추기({ 저장소: 저장.작업본, 실행: 미리.지문 });
  assert.equal(r.결과, '맞춤', r.이유);
  assert.equal(r.주의, undefined, r.주의);
  assert.equal(저장.머리(), r.커밋);
  assert.equal(저장.git('rev-parse', 'HEAD^1').trim(), 전.머리, '첫 부모는 로컬(남의 미푸시 커밋이 가지에 남는다)');
  assert.equal(저장.git('rev-parse', 'HEAD^2').trim(), 저장.O1);
  assert.equal(저장.보기('HEAD', 결정), `${결정머리}| 10-19 | 남의 미푸시 결정 행 |\n| 10-19 | origin 결정 행 |\n| 10-01 | 첫 결정 |\n`);
  assert.equal(저장.보기('HEAD', 트랙), '# 트랙\n\n## 가\n- a1\n- a2 남의 미푸시 줄\n\n## 나\n- b1\n- b2 origin 줄\n\n## 다\n- c1\n');
  assert.equal(저장.보기('HEAD', 'tools/local.js'), 'module.exports = "local";\n');
  assert.equal(저장.읽기(트랙), '# 트랙\n\n## 가\n- a1\n- a2 남의 미푸시 줄\n\n## 나\n- b1\n- b2 origin 줄\n\n## 다\n- c1\n- c2 남의 미커밋 줄\n', '남의 미커밋 줄은 새 판 위에 남는다');
  assert.equal(저장.읽기('tools/a.js'), 'module.exports = 2;\n');
  assert.equal(저장.읽기('docs/새.md'), '# origin 새 문서\n');
  assert.ok(저장.바이트('그림.bin').equals(Buffer.from([0, 9, 9, 9])));
  assert.ok(!저장.있나('지울.txt'));
  assert.deepEqual(상태(저장), [` M ${트랙}`, ' M 남의/수정.txt', 'M  남의/스테이징.txt', '?? 남의/새.txt'].sort(), '남의 것만 그대로 남는다');
  assert.equal(저장.git('diff', '--cached', '--name-only').trim(), '남의/스테이징.txt', '공용 인덱스: 계획 경로는 새 HEAD, 남의 스테이징은 그대로');
  assert.ok(fs.readFileSync(path.join(r.기록, '백업', 트랙)).equals(전.트랙), '쓴 파일은 바이트 백업이 있다');
  assert.deepEqual([r.확인.가지, r.확인.origin품음, r.확인.작업본틀림, r.확인.남은스테이징, r.확인.다른경로바뀜], [true, true, [], [], []]);
  const 또 = await 도구.맞추기({ 저장소: 저장.작업본 });
  assert.equal(또.결과, '맞음', 또.이유);
});

test('10-18 함정: 남의 줄을 지우는 계획이면 멈추고, 지워지는 줄을 보인다', async (t) => {
  const 저장 = 새저장소(t, { 파일: { [트랙]: '# 트랙\n\n## 가\n- a1 바탕 줄\n' } });
  const 남의1 = '- PULSE 뮤직비디오 포트폴리오(남의 미푸시)', 남의2 = '- 고객 화면 리디자인(남의 미푸시)';
  저장.커밋({ [트랙]: `# 트랙\n\n## 가\n- a1 바탕 줄 — 로컬이 고침\n${남의1}\n${남의2}\n` });
  const O = 저장.원격에올림({ [트랙]: '# 트랙\n\n## 가\n- a1 origin이 고쳐 쓴 바탕 줄\n- origin이 더한 줄\n' });
  const 전 = 저장.머리();

  const 그냥 = await 도구.맞추기({ 저장소: 저장.작업본 });
  assert.equal(그냥.결과, '멈춤');
  assert.match(그냥.이유, /규칙으로 못 푼 경로 1개/);
  assert.match(그냥.합침[0].실패, /같은 (줄|곳)을 다르게 고쳤다/);
  assert.ok(그냥.합침[0].덩어리[0].로컬.includes(남의1), '겹친 곳을 보인다');

  // 충돌 규칙을 「origin 판」으로 정하면(10-18 두 번째 맞추기가 그랬다) 남의 줄 둘이 지워진다 → 멈춘다
  const 원격판 = await 도구.맞추기({ 저장소: 저장.작업본, 풀이: [[트랙, 'origin']] });
  assert.equal(원격판.결과, '멈춤');
  assert.match(원격판.이유, /줄 검사에 걸린 경로 1개/);
  assert.deepEqual(원격판.줄문제[0].로컬빠짐.map((x) => x.글).sort(), ['- a1 바탕 줄 — 로컬이 고침', 남의1, 남의2].sort());
  const 글 = 도구.보고글(원격판);
  assert.match(글, /로컬 줄 3/);
  for (const 줄 of [남의1, 남의2]) assert.ok(글.includes(`✗ ${줄}`), 줄);
  assert.equal(저장.머리(), 전);
  const 억지 = await 도구.맞추기({ 저장소: 저장.작업본, 풀이: [[트랙, 'origin']], 실행: 원격판.지문, 되풀이: 1, 잠깐: () => {} });
  assert.equal(억지.결과, '멈춤', '멈춘 계획의 지문으로는 실행하지 않는다');
  assert.equal(저장.머리(), 전);
  const 로컬판 = await 도구.맞추기({ 저장소: 저장.작업본, 풀이: [[트랙, '로컬']] });
  assert.equal(로컬판.결과, '멈춤');
  assert.deepEqual(로컬판.줄문제[0].원격빠짐.map((x) => x.글).sort(), ['- a1 origin이 고쳐 쓴 바탕 줄', '- origin이 더한 줄'].sort());

  // 손으로 합친 판: 두 판의 첫 줄을 한 줄로 합쳤으니 줄 검사가 알린다 → 보고 --허용으로 받아들여 반영
  const 합친 = path.join(저장.뿌리, '합친-트랙.md');
  fs.writeFileSync(합친, `# 트랙\n\n## 가\n- a1 origin이 고쳐 쓴 바탕 줄 — 로컬이 고침\n${남의1}\n${남의2}\n- origin이 더한 줄\n`);
  const 손 = await 도구.맞추기({ 저장소: 저장.작업본, 풀이: [[트랙, 합친]] });
  assert.equal(손.결과, '멈춤');
  assert.deepEqual(Object.entries(손.줄문제[0]).filter(([k, v]) => Array.isArray(v) && v.length).map(([k]) => k).sort(), ['넘침', '로컬빠짐', '원격빠짐'].sort());
  const { r } = await 맞춰보기(저장, { 풀이: [[트랙, 합친]], 허용: [트랙] });
  assert.equal(r.결과, '맞춤', r.이유);
  assert.equal(저장.보기('HEAD', 트랙), fs.readFileSync(합친, 'utf8'));
  assert.equal(저장.읽기(트랙), fs.readFileSync(합친, 'utf8'));
  assert.equal(저장.git('rev-parse', 'HEAD^2').trim(), O);
  assert.deepEqual(상태(저장), []);
});

test('병합: 문서 규칙(머리말 잇기·한쪽이 품음·merge=union)은 풀고, 코드의 같은 줄을 다르게 고쳤으면 멈춘다', async (t) => {
  const 저장 = 새저장소(t, {
    파일: {
      '.gitattributes': 'docs/_ops/*.jsonl merge=union\n',
      'docs/현장노트/x.md': '# x\n\n> 쓴 AI: 가 10-01\n\n본문\n', 'tools/x.js': 'const a = 1;\nconst b = 2;\n',
      'tools/y.js': 'function f() {\n  return 1;\n}\n', 'docs/_ops/장부.jsonl': '{"때":"10-01"}\n',
    },
  });
  저장.커밋({
    'docs/현장노트/x.md': '# x\n\n> 쓴 AI: 가 10-01 · 나 10-19\n\n본문\n', 'tools/x.js': 'const a = 1;\nconst b = 3;\nconst c = 4;\n',
    'tools/y.js': 'function f() {\n  return 2; // 로컬\n}\n', 'docs/_ops/장부.jsonl': '{"때":"10-01"}\n{"때":"10-19","누가":"로컬"}\n',
  });
  저장.원격에올림({
    'docs/현장노트/x.md': '# x\n\n> 쓴 AI: 가 10-01 · GPT 10-19\n\n본문\n', 'tools/x.js': 'const a = 1;\nconst b = 3;\n',
    'tools/y.js': 'function f() {\n  return 3; // origin\n}\n', 'docs/_ops/장부.jsonl': '{"때":"10-01"}\n{"때":"10-19","누가":"origin"}\n',
  });
  const 미리 = await 도구.맞추기({ 저장소: 저장.작업본 });
  assert.equal(미리.결과, '멈춤');
  assert.deepEqual(Object.fromEntries(미리.합침.map((x) => [x.경로, x.방법 || `못 풂: ${x.실패}`])), {
    'docs/_ops/장부.jsonl': '합집합(merge=union)',
    'docs/현장노트/x.md': '양쪽이 고친 줄을 한 줄로 이음',
    'tools/x.js': '로컬이 origin 변경을 품음',
    'tools/y.js': '못 풂: 코드·데이터 파일의 같은 곳을 양쪽이 다르게 고쳤다',
  });

  const { r } = await 맞춰보기(저장, { 풀이: [['tools/y.js', 'origin']], 허용: ['tools/y.js'] });
  assert.equal(r.결과, '맞춤', r.이유);
  assert.equal(저장.보기('HEAD', 'docs/현장노트/x.md'), '# x\n\n> 쓴 AI: 가 10-01 · 나 10-19 · GPT 10-19\n\n본문\n');
  assert.equal(저장.보기('HEAD', 'tools/x.js'), 'const a = 1;\nconst b = 3;\nconst c = 4;\n');
  assert.equal(저장.보기('HEAD', 'docs/_ops/장부.jsonl'), '{"때":"10-01"}\n{"때":"10-19","누가":"로컬"}\n{"때":"10-19","누가":"origin"}\n');
  assert.equal(저장.보기('HEAD', 'tools/y.js'), 'function f() {\n  return 3; // origin\n}\n');
  assert.deepEqual(상태(저장), []);
});

test('병합: 양쪽 이력에 함께 있는 판(그대로 다시 쌓아 올린 커밋)을 바탕으로 합쳐 같은 줄이 두 번 들어가지 않는다', async (t) => {
  const X = '- 내가 더하고 origin에도 그대로 올린 긴 줄';
  const 저장 = 새저장소(t, { 파일: { 'f.md': '- a\n- b\n' } });
  저장.커밋({ 'f.md': `- a\n${X}\n- b\n` }, '내 커밋');
  저장.원격에올림({ 'f.md': `- a\n${X}\n- b\n` }, '내 커밋');                 // 내커밋 올리기가 「내 판」으로 다시 쌓았다(같은 blob)
  저장.원격에올림({ 'f.md': `${X}\n- a\n- b\n` }, 'GPT가 그 줄을 맨 위로 옮김');
  저장.커밋({ 'f.md': `- a\n${X}\n- b\n- 남의 미푸시 줄\n` });
  const { 미리, r } = await 맞춰보기(저장);
  assert.deepEqual(미리.합침.map((x) => `${x.방법} · ${x.바탕}`), ['3방향 · 양쪽 이력의 공통 판']);
  assert.equal(r.결과, '맞춤', r.이유);
  assert.equal(저장.보기('HEAD', 'f.md'), `${X}\n- a\n- b\n- 남의 미푸시 줄\n`, '갈라진 곳을 바탕으로 하면 X가 두 번 들어간다');
});

// ── 빠른 길·빨리감기·맞음 ─────────────────────────────────────────────────────

test('빠른 길: origin에만 있는 커밋이 다시 쌓아 올린 내 커밋뿐이면 트리는 로컬 그대로, 작업본·공용 인덱스는 건드리지 않는다', async (t) => {
  const 저장 = 새저장소(t, { 파일: { 'a.md': '# a\n- 1\n', 'b.md': '# b\n' } });
  저장.커밋({ 'b.md': '# b\n- 남의 미푸시\n' }, '남의 미푸시 커밋');
  const 전 = 저장.커밋({ 'a.md': '# a\n- 1\n- 내 줄 하나\n- 내 줄 둘\n' }, '내 커밋');
  // 내커밋 올리기가 origin 위에 다시 쌓으며 다른 자리에 끼웠다(줄 차례가 다르다)
  const O = 저장.원격에올림({ 'a.md': '# a\n- 내 줄 둘\n- 1\n- 내 줄 하나\n' }, '내 커밋');
  저장.쓰기('a.md', '# a\n- 1\n- 내 줄 하나\n- 내 줄 둘\n- 남의 미커밋\n');
  저장.쓰기('b.md', '# b\n- 남의 미푸시\n- 남이 스테이징\n');
  저장.git('add', 'b.md');
  const 전상태 = 상태(저장), 전인덱스 = 저장.인덱스지문(), 전a = 저장.바이트('a.md');
  const { 미리, r } = await 맞춰보기(저장);
  assert.equal(미리.방법, '빠른 길');
  assert.equal(미리.다시쌓은, 1);
  assert.deepEqual([미리.지움, 미리.작업본], [[], []]);
  assert.match(도구.보고글(미리), /지워지는 줄: 없음\(병합 트리 = 로컬 트리\)/);
  assert.equal(r.결과, '맞춤', r.이유);
  assert.equal(저장.인덱스지문(), 전인덱스, '공용 인덱스 파일을 다시 쓰지 않았다');
  assert.equal(저장.git('rev-parse', 'HEAD^{tree}').trim(), 저장.git('rev-parse', `${전}^{tree}`).trim());
  assert.deepEqual([저장.git('rev-parse', 'HEAD^1').trim(), 저장.git('rev-parse', 'HEAD^2').trim()], [전, O]);
  assert.deepEqual(상태(저장), 전상태, '작업본 그대로');
  assert.ok(저장.바이트('a.md').equals(전a));
});

test('빠른 길이 안 되면 병합으로 간다: 다시 쌓은 커밋이 아닌 origin 커밋이 있거나, 그 변경이 로컬에 다 있지 않을 때', async (t) => {
  const 저장 = 새저장소(t, { 파일: { 'a.md': '# a\n- 1\n' } });
  저장.커밋({ 'a.md': '# a\n- 1\n- 내 줄\n' }, '내 커밋');
  저장.원격에올림({ 'a.md': '# a\n- 1\n- 내 줄\n- 누가 더 고친 줄\n' }, '내 커밋');   // 같은 제목인데 내용이 더 있다
  let 미리 = await 도구.맞추기({ 저장소: 저장.작업본 });
  assert.equal(미리.방법, '병합');
  assert.match(미리.빠른길걸림[0].이유, /origin이 더한 줄이 로컬에 없다: - 누가 더 고친 줄/);
  // 줄 셈으로는 로컬에 다 있어도(차례만 바꿈) 다시 쌓은 커밋이 아니면 그 변경을 버리지 않는다
  const 둘 = 새저장소(t, { 파일: { 'a.md': '- 1\n- 2\n' } });
  둘.원격에올림({ 'a.md': '- 2\n- 1\n' }, 'GPT가 차례를 바꿈');
  둘.커밋({ 'b.md': '남의 미푸시\n' });
  미리 = await 도구.맞추기({ 저장소: 둘.작업본 });
  assert.equal(미리.방법, '병합');
  assert.match(미리.빠른길걸림[0].이유, /같은 작성자·제목의 로컬 커밋이 없는 것 1개\([0-9a-f]{9} GPT가 차례를 바꿈\)/);
  assert.equal(미리.다시쌓은, 0);
});

test('빨리감기: 로컬 master가 origin 조상이면 master를 origin으로 옮기고 남의 미커밋 수정은 3방향으로 얹는다', async (t) => {
  const 저장 = 새저장소(t, { 파일: { 'a.md': '# a\n- 1\n- 2\n- 3\n', 'b.md': '# b\n' } });
  const O = 저장.원격에올림({ 'a.md': '# a\n- 1 origin\n- 2\n- 3\n', 'c.md': '# c\n' });
  저장.쓰기('a.md', '# a\n- 1\n- 2\n- 3\n- 남의 미커밋\n');
  const { 미리, r } = await 맞춰보기(저장);
  assert.equal(미리.방법, '빨리감기');
  assert.equal(r.결과, '맞춤', r.이유);
  assert.equal(저장.머리(), O, '병합 커밋 없이 origin');
  assert.equal(저장.읽기('a.md'), '# a\n- 1 origin\n- 2\n- 3\n- 남의 미커밋\n');
  assert.equal(저장.읽기('c.md'), '# c\n');
  assert.deepEqual(상태(저장), [' M a.md']);
});

test('맞음: origin이 이미 로컬 master 안에 있으면 할 것이 없다', async (t) => {
  const 저장 = 새저장소(t, { 파일: { 'a.md': '# a\n' } });
  저장.커밋({ 'b.md': '# b\n' });
  const r = await 도구.맞추기({ 저장소: 저장.작업본 });
  assert.equal(r.결과, '맞음');
  assert.match(도구.보고글(r), /^\[맞음\]/);
});

// ── 바이너리·줄끝·이력 판 ─────────────────────────────────────────────────────

test('바이너리: 양쪽이 바꾸면 멈추고, 고른 판도 버리는 쪽을 알린다. 작업본에 남의 수정이 있으면 손대지 않는다', async (t) => {
  const 저장 = 새저장소(t, { 파일: { '그림.bin': Buffer.from([0, 1, 2]), '사진.bin': Buffer.from([0, 5, 5]) } });
  저장.커밋({ '그림.bin': Buffer.from([0, 1, 7]) });
  저장.원격에올림({ '그림.bin': Buffer.from([0, 1, 8]), '사진.bin': Buffer.from([0, 5, 6]) });
  저장.쓰기('사진.bin', Buffer.from([0, 5, 9]));
  const 그냥 = await 도구.맞추기({ 저장소: 저장.작업본 });
  assert.equal(그냥.결과, '멈춤');
  assert.match(그냥.합침[0].실패, /바이너리 파일을 양쪽이 다르게 바꿨다/);
  const 원격판 = await 도구.맞추기({ 저장소: 저장.작업본, 풀이: [['그림.bin', 'origin']] });
  assert.equal(원격판.결과, '멈춤');
  assert.deepEqual(원격판.줄문제[0].로컬빠짐, [{ 글: '(바이너리 로컬 판)', 수: 1 }]);
  const { 미리, r } = await 맞춰보기(저장, { 풀이: [['그림.bin', 'origin']], 허용: ['그림.bin'] });
  assert.deepEqual(Object.fromEntries(미리.작업본.map((x) => [x.경로, x.할일])), { '그림.bin': '새 판', '사진.bin': '손대지 않음' });
  assert.equal(r.결과, '맞춤', r.이유);
  assert.ok(저장.바이트('그림.bin').equals(Buffer.from([0, 1, 8])));
  assert.ok(저장.바이트('사진.bin').equals(Buffer.from([0, 5, 9])), '남의 수정은 그대로');
  assert.deepEqual(상태(저장), [' M 사진.bin']);
});

test('줄끝: core.autocrlf=true에서 남의 미커밋 수정은 작업본 줄끝을 따르고, 새 판은 체크아웃과 같은 바이트라 깨끗하다', async (t) => {
  const 저장 = 새저장소(t, { autocrlf: 'true', 파일: { 'crlf.md': 'a\r\nb\r\nc\r\n', 'lf.md': 'x\ny\nz\n', 'mixed.md': 'l1\r\nl2\nl3\r\n' } });
  저장.커밋({ 'lf.md': 'x\ny\nz\nw\n' });
  저장.원격에올림({ 'lf.md': 'x2\ny\nz\n', 'crlf.md': 'a\r\nb\r\nc\r\nd\r\n', 'mixed.md': 'l1\r\nl2\nl3\r\nl4\n' });
  저장.쓰기('lf.md', 'x\r\ny\r\nz\r\nw\r\n남\r\n');
  저장.쓰기('mixed.md', 'l1\r\n남의 줄\r\nl2\nl3\r\n');
  assert.deepEqual(상태(저장), [' M lf.md', ' M mixed.md'], 'crlf.md는 git status로 깨끗하다');
  const { 미리, r } = await 맞춰보기(저장);
  assert.deepEqual(Object.fromEntries(미리.작업본.map((x) => [x.경로, x.할일])), { 'crlf.md': '새 판', 'lf.md': '3방향', 'mixed.md': '3방향' });
  assert.equal(r.결과, '맞춤', r.이유);
  const 날 = (p) => 저장.바이트(p).toString('latin1');
  assert.equal(날('crlf.md'), 'a\r\nb\r\nc\r\nd\r\n');
  assert.equal(날('lf.md'), Buffer.from('x2\r\ny\r\nz\r\nw\r\n남\r\n').toString('latin1'));
  assert.equal(날('mixed.md'), Buffer.from('l1\r\n남의 줄\r\nl2\nl3\r\nl4\r\n').toString('latin1'));
  assert.deepEqual(상태(저장), [' M lf.md', ' M mixed.md']);
  assert.equal(저장.git('diff', '--', 'lf.md').split('\n').filter((l) => /^[-+][^-+]/.test(l)).join('|'), '+남', 'lf.md의 남은 차이는 남의 줄 하나');
});

test('작업본이 옛 판이면 새 판, 옛 판 + 남의 수정이면 그 옛 판을 바탕으로 3방향(로컬 커밋을 되돌리지 않는다), 다른 가지 판이면 손대지 않는다', async (t) => {
  const 바탕 = '1\n2\n3\n4\n5\n';
  const 저장 = 새저장소(t, { 파일: { 'doc.md': 바탕, 'doc2.md': 바탕, 'doc3.md': 바탕 } });
  const B = 저장.머리();
  저장.커밋({ 'doc.md': `${바탕}6\n`, 'doc2.md': `${바탕}6\n` });
  저장.원격에올림({ 'doc.md': '1 origin\n2\n3\n4\n5\n', 'doc2.md': '1 origin\n2\n3\n4\n5\n', 'doc3.md': '1 origin\n2\n3\n4\n5\n' });
  // GPT의 다른 가지(origin에 안 합쳐짐)에만 있는 doc3.md 판
  const 가지판 = '1\n2\n3 다른 가지\n4\n5\n';
  const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: 저장.작업본, input: 가지판, encoding: 'utf8' }).trim();
  const 트리 = execFileSync('git', ['mktree'], { cwd: 저장.작업본, input: 저장.git('ls-tree', B).replace(/^(100644 blob )[0-9a-f]+(\tdoc3\.md)$/m, `$1${blob}$2`), encoding: 'utf8' }).trim();
  저장.git('update-ref', 'refs/heads/codex/다른', 저장.git('commit-tree', 트리, '-p', B, '-m', '다른 가지').trim());
  저장.쓰기('doc.md', 바탕);                         // 옛 판(바탕) 그대로 — 로컬 커밋(6) 전 사본
  저장.쓰기('doc2.md', '1\n2\n3 남의 수정\n4\n5\n');  // 옛 판 + 남의 수정
  저장.쓰기('doc3.md', 가지판);                        // 다른 가지 판 그대로
  const { 미리, r } = await 맞춰보기(저장);
  const 할일 = Object.fromEntries(미리.작업본.map((x) => [x.경로, `${x.할일}: ${x.까닭 || ''}`]));
  assert.match(할일['doc.md'], /^새 판: 작업본이 이력의 판\(/);
  assert.match(할일['doc2.md'], /^3방향: 바탕: 이력의 판\(/);
  assert.match(할일['doc3.md'], /^손대지 않음: 작업본이 다른 가지의 판\(/);
  assert.equal(r.결과, '맞춤', r.이유);
  assert.equal(저장.읽기('doc.md'), '1 origin\n2\n3\n4\n5\n6\n');
  assert.equal(저장.읽기('doc2.md'), '1 origin\n2\n3 남의 수정\n4\n5\n6\n', '로컬 커밋의 6이 남는다(로컬 HEAD 기준 3방향이면 지워졌다)');
  assert.equal(저장.읽기('doc3.md'), 가지판);
  assert.deepEqual(상태(저장), [' M doc2.md', ' M doc3.md']);
});

test('작업본: origin이 지운 파일에 남의 수정이 있으면 미추적으로 남기고, 3방향 결과가 줄 검사에 걸리면 손대지 않는다', async (t) => {
  const X = '- 양쪽이 따로 더한 같은 긴 줄입니다(스무 자 넘게)';
  const 저장 = 새저장소(t, { 파일: { '지울.txt': '곧 지운다\n', 'f.md': '# f\n- 1\n- 2\n- 3\n- 4\n- 5\n' } });
  const O = 저장.원격에올림({ 'f.md': `# f\n- 1\n- 2\n- 3\n- 4\n- 5\n${X}\n` }, 'GPT가 끝에 한 줄', ['지울.txt']);
  저장.쓰기('지울.txt', '곧 지운다\n남이 고치는 중\n');
  저장.쓰기('f.md', `# f\n- 1\n${X}\n- 2\n- 3\n- 4\n- 5\n`);   // 같은 줄을 남이 다른 자리에 미커밋으로 더했다
  const 전f = 저장.바이트('f.md');
  const { 미리, r } = await 맞춰보기(저장);
  const 할일 = Object.fromEntries(미리.작업본.map((x) => [x.경로, `${x.할일}: ${x.까닭 || ''}`]));
  assert.match(할일['지울.txt'], /^미추적으로 남김: 남의 수정이 있다/);
  assert.match(할일['f.md'], /^손대지 않음: 3방향 결과가 줄 검사에 걸렸다\(같은 줄이 두 번 1, 바탕: 로컬 HEAD 판\)/);
  assert.equal(r.결과, '맞춤', r.이유);
  assert.equal(저장.머리(), O);
  assert.equal(저장.읽기('지울.txt'), '곧 지운다\n남이 고치는 중\n', 'origin이 지운 파일의 남의 수정은 지우지 않는다');
  assert.ok(저장.바이트('f.md').equals(전f), '같은 줄이 두 번 들어갈 3방향 결과는 쓰지 않는다');
  assert.deepEqual(상태(저장), [' M f.md', '?? 지울.txt']);
});

test('못 푼 경로: --겹친곳쓰기로 받아 고친 뒤 --풀이폴더로 넘긴다(충돌 표시가 남으면 멈춘다)', async (t) => {
  const 저장 = 새저장소(t, { 파일: { 'docs/a.md': '# a\n- 바탕 줄\n- 둘째\n', 'tools/x.js': 'const v = 0;\n' } });
  저장.커밋({ 'docs/a.md': '# a\n- 로컬이 고친 줄\n- 둘째\n- 로컬 끝\n', 'tools/x.js': 'const v = 1;\n' });
  저장.원격에올림({ 'docs/a.md': '# a\n- origin이 고친 줄\n- 둘째\n', 'tools/x.js': 'const v = 2;\n' });
  const 폴더 = path.join(저장.뿌리, '겹친곳');
  const 미리 = await 도구.맞추기({ 저장소: 저장.작업본, 겹친곳쓰기: 폴더 });
  assert.equal(미리.결과, '멈춤');
  assert.deepEqual(미리.겹친곳.파일.sort(), ['docs/a.md', 'tools/x.js']);
  assert.match(미리.이유, /겹친 곳을 2개 파일로 썼다/);
  const 겹친 = fs.readFileSync(path.join(폴더, 'docs', 'a.md'), 'utf8');
  assert.equal(겹친, '# a\n<<<<<<< 로컬\n- 로컬이 고친 줄\n||||||| 바탕\n- 바탕 줄\n=======\n- origin이 고친 줄\n>>>>>>> origin\n- 둘째\n- 로컬 끝\n', '규칙으로 푼 곳(로컬만 더한 끝 줄)은 풀린 채');
  await assert.rejects(도구.맞추기({ 저장소: 저장.작업본, 겹친곳쓰기: 폴더 }), /비어 있지 않다/, '옛 겹친 파일이 섞이지 않게 빈 폴더만 받는다');
  const 덜 = await 도구.맞추기({ 저장소: 저장.작업본, 풀이폴더: 폴더 });
  assert.equal(덜.결과, '멈춤');
  assert.ok(덜.합침.every((x) => /충돌 표시가 남아 있다/.test(x.실패 || '')), JSON.stringify(덜.합침));
  fs.writeFileSync(path.join(폴더, 'docs', 'a.md'), '# a\n- 로컬과 origin이 고친 줄을 합침\n- 둘째\n- 로컬 끝\n');
  fs.writeFileSync(path.join(폴더, 'tools', 'x.js'), 'const v = 2;\n');
  const 다시 = await 도구.맞추기({ 저장소: 저장.작업본, 풀이폴더: 폴더 });
  assert.equal(다시.결과, '멈춤', '손으로 합친 판도 줄 검사가 알린다');
  assert.deepEqual(다시.줄문제.map((x) => x.경로).sort(), ['docs/a.md', 'tools/x.js']);
  const { 미리: 받음, r } = await 맞춰보기(저장, { 풀이폴더: 폴더, 허용: ['docs/a.md', 'tools/x.js'] });
  assert.match(도구.보고글(받음), /--실행 [0-9a-f]{10} --저장소 \S+ --풀이폴더 \S+ --허용 docs\/a\.md --허용 tools\/x\.js/, '실행 명령은 어느 폴더에서 쳐도 같게 --저장소와 절대 경로로');
  assert.equal(r.결과, '맞춤', r.이유);
  assert.equal(저장.보기('HEAD', 'docs/a.md'), '# a\n- 로컬과 origin이 고친 줄을 합침\n- 둘째\n- 로컬 끝\n');
  assert.equal(저장.보기('HEAD', 'tools/x.js'), 'const v = 2;\n');
  assert.deepEqual(상태(저장), []);
});

test('파일↔폴더가 부딪히는 경로는 --풀이를 줘도 병합 트리에서 말없이 빠지지 않고 멈춘다', async (t) => {
  // ① 로컬은 파일 a를 고쳤고 origin은 a를 지우고 a/b를 더했다 → --풀이 a=로컬이면 a/b가 트리에서 빠질 판
  const 저장 = 새저장소(t, { 파일: { a: 'base\n', 'z.md': '# z\n' } });
  저장.커밋({ a: 'base\n로컬이 고침\n' }, '로컬이 a를 고침');
  저장.원격에올림({ 'a/b': 'origin이 만든 a/b\n' }, 'origin이 a를 폴더로', ['a']);
  const 그냥 = await 도구.맞추기({ 저장소: 저장.작업본 });
  assert.match(그냥.합침.find((x) => x.경로 === 'a').실패, /로컬은 고쳤고 origin은 지웠다/);
  const 로컬로 = await 도구.맞추기({ 저장소: 저장.작업본, 풀이: [['a', '로컬']] });
  assert.equal(로컬로.결과, '멈춤');
  assert.match(로컬로.이유, /파일과 폴더가 부딪혀.*a\/b/);
  // ② 반대: 로컬이 a를 폴더(a/b)로 바꿨고(작업본에선 그 폴더도 지운 상태) origin은 파일 a를 고쳤다 → --풀이 a=origin
  const 둘 = 새저장소(t, { 파일: { a: 'base\n', 'z.md': '# z\n' } });
  둘.커밋({ 'a/b': '로컬이 만든 a/b\n' }, '로컬이 a를 폴더로', ['a']);
  둘.원격에올림({ a: 'base\norigin이 고침\n' }, 'origin이 a를 고침');
  fs.rmSync(path.join(둘.작업본, 'a'), { recursive: true });
  const 원격으로 = await 도구.맞추기({ 저장소: 둘.작업본, 풀이: [['a', 'origin']] });
  assert.equal(원격으로.결과, '멈춤');
  assert.match(원격으로.이유, /파일과 폴더가 부딪혀.*a\/b/);
});

test('한쪽이 옮긴 줄을 다른 쪽이 고쳤으면 옛 판·새 판을 둘 다 남기지 않고 멈춘다', async (t) => {
  const 저장 = 새저장소(t, { 파일: { 'tools/x.js': 'const a = 1;\nconst b = 2;\nconst c = 3;\nmodule.exports = { a, b, c };\n' } });
  저장.커밋({ 'tools/x.js': 'const a = 1;\nconst c = 3;\nconst b = 2;\nmodule.exports = { a, b, c };\n' }, '남이 b·c 차례를 바꿈');
  저장.원격에올림({ 'tools/x.js': 'const a = 1;\nconst b = 20; // origin\nconst c = 3;\nmodule.exports = { a, b, c };\n' }, 'origin이 b를 고침');
  const r = await 도구.맞추기({ 저장소: 저장.작업본 });
  assert.equal(r.결과, '멈춤');
  assert.match(r.합침[0].실패, /옮긴 줄|코드·데이터/);
});

test('풀이 파일의 줄끝은 로컬 판을 따르고(메모장 CRLF로 고쳐도 blob은 LF), 양쪽 다 끝 줄바꿈이 없던 파일은 결과에도 없다', async (t) => {
  const 저장 = 새저장소(t, { autocrlf: 'true', 파일: { 'docs/a.md': '# a\n- 바탕 줄\n', 'docs/n.md': '# n\n- 바탕' } });
  저장.커밋({ 'docs/a.md': '# a\n- 로컬이 고친 줄\n', 'docs/n.md': '# n\n- 바탕\n- 로컬 줄' });
  저장.원격에올림({ 'docs/a.md': '# a\n- origin이 고친 줄\n', 'docs/n.md': '# n\n- 바탕\n- origin 줄' });
  const 파일 = path.join(저장.뿌리, '풀이.md');
  fs.writeFileSync(파일, '# a\r\n- 로컬과 origin을 합친 줄\r\n');
  const { r } = await 맞춰보기(저장, { 풀이: [['docs/a.md', 파일]], 허용: ['docs/a.md'] });
  assert.equal(r.결과, '맞춤', r.이유);
  assert.equal(저장.git.바이트('cat-file', 'blob', 'HEAD:docs/a.md').toString(), '# a\n- 로컬과 origin을 합친 줄\n');
  assert.equal(저장.git.바이트('cat-file', 'blob', 'HEAD:docs/n.md').toString(), '# n\n- 바탕\n- 로컬 줄\n- origin 줄');
});

// ── 겹친 사본·줄 검사 경로·이음·한쪽만 바꾼 경로 ───────────────────────────────

test('병합: 양쪽이 같은 절·행을 다른 자리에 더한 문서는 뒤쪽 사본을 지운다. 같은 머리의 두 판이면 멈추고 --겹친곳쓰기로 합친 판을 받는다', async (t) => {
  const X = '### 10-19 다시 쌓아 올린 항목(양쪽이 더함)', x1 = '- 그 항목의 첫 줄입니다(스무 자 넘게)', x2 = '- 그 항목의 둘째 줄입니다(스무 자 넘게)';
  const R = '| 10-19 | 다시 쌓아 올린 결정 행(양쪽이 더함) |';
  const 표 = (...xs) => `${결정머리}${xs.join('\n')}`, 행들 = [5, 4, 3, 2, 1].map((n) => `| 10-0${n} | 결정 ${n} |`);   // 끝 줄바꿈 없는 문서
  const 트랙바탕 = '# 트랙\n\n## 가\n- a1\n\n## 나\n- b1\n\n## 다\n- c1\n';
  const 로컬트랙 = `# 트랙\n\n## 가\n- a1\n\n${X}\n${x1}\n${x2}\n\n## 나\n- b1\n\n## 다\n- c1\n`;
  const 저장 = 새저장소(t, { 파일: { [트랙]: 트랙바탕, [결정]: 표(...행들) } });
  저장.커밋({ [트랙]: 로컬트랙, [결정]: 표(R, ...행들) }, '내 커밋');
  저장.원격에올림({ [트랙]: `${트랙바탕}\n${X}\n${x1}\n${x2}\n`, [결정]: 표(...행들, R) }, '다른 자리에 다시 쌓아 올림');
  const { 미리, r } = await 맞춰보기(저장);
  assert.deepEqual(미리.합침.map((x) => [x.경로, x.방법, x.정리]), [
    [결정, '3방향 · 같은 절·줄 정리', { 절: 0, 줄: 1 }],
    [트랙, '3방향 · 같은 절·줄 정리', { 절: 1, 줄: 4 }],
  ]);
  assert.match(도구.보고글(미리), /3방향 · 같은 절·줄 정리 {2}docs\/_ops\/트랙\.md\(바탕: 갈라진 곳의 판\) \[두 번 들어간 사본 지움: 절 1 · 4줄\]/);
  assert.equal(r.결과, '맞춤', r.이유);
  assert.equal(저장.보기('HEAD', 트랙), 로컬트랙, '앞 사본만 남고 파일 끝 빈 줄도 남지 않는다');
  assert.equal(저장.보기('HEAD', 결정), 표(R, ...행들), '끝 줄바꿈 없던 문서는 정리 뒤에도 없다');
  assert.deepEqual(상태(저장), []);

  // 같은 머리의 절을 양쪽이 서로 다른 내용으로 더했다 → 고르지 않고 멈춘다. --겹친곳쓰기는 규칙이 합친 판(두 사본)을 쓴다
  const 둘 = 새저장소(t, { 파일: { [트랙]: 트랙바탕 } });
  const 로컬줄 = '- 로컬 판에만 있는 줄입니다(스무 자 넘게)', 원격줄 = '- origin 판에만 있는 줄입니다(스무 자 넘게)';
  둘.커밋({ [트랙]: `# 트랙\n\n## 가\n- a1\n\n${X}\n${x1}\n${로컬줄}\n\n## 나\n- b1\n\n## 다\n- c1\n` });
  둘.원격에올림({ [트랙]: `${트랙바탕}\n${X}\n${x1}\n${원격줄}\n` });
  const 폴더 = path.join(둘.뿌리, '겹친곳');
  const 멈춤 = await 도구.맞추기({ 저장소: 둘.작업본, 겹친곳쓰기: 폴더 });
  assert.equal(멈춤.결과, '멈춤');
  assert.match(멈춤.합침[0].실패, /같은 줄이 두 번 들어갔는데 저절로 못 지운다 — 머리가 같은 절 「### 10-19 다시 쌓아 올린 항목\(양쪽이 더함\)」이 두 번 들어갔는데 어느 사본도/);
  assert.deepEqual(멈춤.겹친곳.파일, [트랙]);
  const 받은 = fs.readFileSync(path.join(폴더, ...트랙.split('/')), 'utf8');
  assert.equal(받은.split(`${X}\n`).length - 1, 2);
  fs.writeFileSync(path.join(폴더, ...트랙.split('/')), `# 트랙\n\n## 가\n- a1\n\n${X}\n${x1}\n${로컬줄}\n${원격줄}\n\n## 나\n- b1\n\n## 다\n- c1\n`);
  const 받아 = await 맞춰보기(둘, { 풀이폴더: 폴더 });
  assert.equal(받아.r.결과, '맞춤', '두 판의 줄을 다 가진 손 합친 판은 --허용 없이 맞춘다');
  assert.deepEqual(받아.미리.줄문제, []);

  // 정리가 다른 줄 문제를 만들면 멈춘다 — 로컬이 일부러 두 번 둔 묶음을 지우면 그 안의 짧은 줄(로컬 줄)까지 빠진다
  const 셋 = 새저장소(t, { 파일: { 'docs/d.md': '# d\n- 바탕 줄\n' } });
  const 첫 = '- 겹친 첫 줄입니다(스무 자 넘게 깁니다)', 끝 = '- 겹친 둘째 줄입니다(스무 자 넘게 깁니다)', 묶음 = `${첫}\n  - s\n${끝}\n`;
  셋.커밋({ 'docs/d.md': `# d\n- 바탕 줄\n${묶음}- 사이 줄\n${묶음}` });
  셋.원격에올림({ 'docs/d.md': `# d\n${첫}\n${끝}\n- 바탕 줄\n` });
  const 걸림 = await 도구.맞추기({ 저장소: 셋.작업본 });
  assert.equal(걸림.결과, '멈춤');
  assert.match(걸림.합침[0].실패, /저절로 못 지운다 — 정리가 「로컬 줄이 빠짐」을 만들었다/);
});

test('줄 검사에 걸린 경로도 --겹친곳쓰기가 합친 판을 쓴다 — 고쳐 --풀이폴더로 넘기면 --허용 없이 맞춘다', async (t) => {
  const 바탕 = 'const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst e = 5;\nconst f = 6;\nmodule.exports = { a, b, c, d, e, f };\n';
  const L = "const 긴이름 = require('./양쪽이-따로-더한-모듈');";
  const 고친판 = 바탕.replace('const b = 2;\n', `const b = 2;\n${L}\n`);
  const 저장 = 새저장소(t, { 파일: { 'tools/x.js': 바탕, '그림.bin': Buffer.from([0, 1, 2]) } });
  저장.커밋({ 'tools/x.js': 고친판, '그림.bin': Buffer.from([0, 1, 7]) });
  저장.원격에올림({ 'tools/x.js': 바탕.replace('const f = 6;\n', `const f = 6;\n${L}\n`), '그림.bin': Buffer.from([0, 1, 8]) });
  const 폴더 = path.join(저장.뿌리, '겹친곳');
  const 미리 = await 도구.맞추기({ 저장소: 저장.작업본, 풀이: [['그림.bin', 'origin']], 겹친곳쓰기: 폴더 });
  assert.equal(미리.결과, '멈춤');
  assert.deepEqual(미리.줄문제.map((x) => x.경로), ['tools/x.js', '그림.bin']);
  assert.deepEqual(미리.겹친곳, { 폴더, 파일: ['tools/x.js'], 못씀: ['그림.bin'] });
  assert.match(미리.이유, /줄 검사에 걸린 경로 2개.*합친 판을 1개 파일로 썼다/);
  const 받은 = fs.readFileSync(path.join(폴더, 'tools', 'x.js'), 'utf8');
  assert.equal(받은, 저장.보기(미리.병합트리, 'tools/x.js'), '규칙이 합친 판(같은 줄 두 번)을 그대로');
  assert.equal(받은.split(L).length - 1, 2);
  assert.match(도구.보고글(미리), /못 쓴 경로.*그림\.bin — .*줄 검사에 걸린 경로는 보고 --허용/);
  const 그냥 = await 도구.맞추기({ 저장소: 저장.작업본, 풀이: [['그림.bin', 'origin']] });
  assert.match(그냥.이유, /합친 판을 고칠 파일로 받으려면 --겹친곳쓰기 <폴더>/);
  fs.writeFileSync(path.join(폴더, 'tools', 'x.js'), 고친판);
  const { r } = await 맞춰보기(저장, { 풀이: [['그림.bin', 'origin']], 풀이폴더: 폴더, 허용: ['그림.bin'] });
  assert.equal(r.결과, '맞춤', r.이유);
  assert.equal(저장.보기('HEAD', 'tools/x.js'), 고친판);
});

test('--겹친곳쓰기 판을 고쳐 넘기면 규칙이 한 줄로 이은 줄의 이음 기록을 다시 찾아 「빠짐·넘침」으로 보이지 않는다', async (t) => {
  // 두 겹친 곳 사이는 영숫자가 든 줄 넷 — 그보다 가까우면 git merge-file이 두 곳을 한 덩어리로 묶는다
  const p = 'docs/현장노트/x.md', 쪽 = (머리말, 항목) => `# x\n\n> 쓴 AI: 가 10-01${머리말}\n\n본문 1\n본문 2\n\n- 항목 ${항목} 문장입니다(스무 자 넘게)\n- 둘째 2\n`;
  const 저장 = 새저장소(t, { 파일: { [p]: 쪽('', '바탕') } });
  저장.커밋({ [p]: 쪽(' · 나 10-19', '로컬이 고친') });
  저장.원격에올림({ [p]: 쪽(' · GPT 10-19', 'origin이 고친') });
  const 폴더 = path.join(저장.뿌리, '겹친곳'), 파일 = path.join(폴더, 'docs', '현장노트', 'x.md');
  const 미리 = await 도구.맞추기({ 저장소: 저장.작업본, 겹친곳쓰기: 폴더 });
  assert.equal(미리.결과, '멈춤');
  const 받은 = fs.readFileSync(파일, 'utf8');
  assert.ok(받은.includes('> 쓴 AI: 가 10-01 · 나 10-19 · GPT 10-19\n'), '규칙이 푼 곳(머리말 잇기)은 풀린 채');
  const 합친줄 = '- 항목 로컬과 origin이 고친 것을 합친 문장';
  fs.writeFileSync(파일, 받은.replace(/<<<<<<< 로컬\n[\s\S]*>>>>>>> origin\n/, `${합친줄}\n`));
  const 다시 = await 도구.맞추기({ 저장소: 저장.작업본, 풀이폴더: 폴더 });
  assert.equal(다시.결과, '멈춤', '손으로 합친 줄은 줄 검사가 알린다');
  const 문제 = 다시.줄문제[0];
  assert.deepEqual([문제.로컬빠짐, 문제.원격빠짐, 문제.넘침, 문제.남음, 문제.겹침].map((xs) => xs.map((x) => x.글)),
    [['- 항목 로컬이 고친 문장입니다(스무 자 넘게)'], ['- 항목 origin이 고친 문장입니다(스무 자 넘게)'], [합친줄], [], []], '이은 머리말은 빠짐·넘침이 아니다');
  assert.deepEqual(다시.합침[0].이은, [{ 로컬: '> 쓴 AI: 가 10-01 · 나 10-19', 원격: '> 쓴 AI: 가 10-01 · GPT 10-19', 결과: '> 쓴 AI: 가 10-01 · 나 10-19 · GPT 10-19' }]);
  assert.deepEqual([다시.지움[0].이은, 다시.지움[0].로컬], [1, 1]);
  assert.match(도구.보고글(다시), /--풀이 파일 \S+x\.md {2}docs\/현장노트\/x\.md\n {4}한 줄로\(낱말 단위로 합침\): > 쓴 AI: 가 10-01 · 나 10-19 · GPT 10-19/);
  // 풀이 파일이 이은 줄을 갖지 않으면(로컬 머리말만 둠) 그 이음 기록은 쓰지 않는다 — origin 머리말이 빠진 것을 그대로 알린다
  const 로컬머리폴더 = path.join(저장.뿌리, '로컬머리말');
  fs.mkdirSync(path.join(로컬머리폴더, 'docs', '현장노트'), { recursive: true });
  fs.writeFileSync(path.join(로컬머리폴더, 'docs', '현장노트', 'x.md'), fs.readFileSync(파일, 'utf8').replace(' · GPT 10-19', ''));
  const 로컬머리 = await 도구.맞추기({ 저장소: 저장.작업본, 풀이폴더: 로컬머리폴더 });
  assert.deepEqual(로컬머리.줄문제[0].원격빠짐.map((x) => x.글).sort(), ['- 항목 origin이 고친 문장입니다(스무 자 넘게)', '> 쓴 AI: 가 10-01 · GPT 10-19'].sort());
  assert.equal(로컬머리.합침[0].이은, undefined);
  const { r } = await 맞춰보기(저장, { 풀이폴더: 폴더, 허용: [p] });
  assert.equal(r.결과, '맞춤', r.이유);
  assert.equal(저장.보기('HEAD', p), fs.readFileSync(파일, 'utf8'));

  // 규칙이 한쪽 줄로 이은 줄(로컬 줄이 origin 줄을 품음)을 받은 판에서 사람이 origin 줄도 따로 살렸으면 그 이음은 쓰지 않는다 — Fable 10-20 ④
  const 긴 = '- 증상: 앱을 다시 켠 뒤 같은 세션의 명령이 거부된다.';
  const 바탕2 = '# x\n\n본문 1\n본문 2\n\n- 끝 줄 a\n- 끝 줄 b\n- 끝 줄 c\n- 끝 줄 d\n\n- 항목 바탕 문장입니다(스무 자 넘게)\n- 둘째 2\n';
  const 둘 = 새저장소(t, { 파일: { [p]: 바탕2 } });
  둘.커밋({ [p]: 바탕2.replace('본문 2\n', `본문 2\n${긴} 다른 세션에서도 그랬다.\n`).replace('항목 바탕', '항목 로컬이 고친') });
  둘.원격에올림({ [p]: 바탕2.replace('본문 2\n', `본문 2\n${긴}\n`).replace('항목 바탕', '항목 origin이 고친') });
  const 폴더2 = path.join(둘.뿌리, '겹친곳'), 파일2 = path.join(폴더2, 'docs', '현장노트', 'x.md');
  await 도구.맞추기({ 저장소: 둘.작업본, 겹친곳쓰기: 폴더2 });
  const 받은2 = fs.readFileSync(파일2, 'utf8');
  assert.ok(받은2.includes(`${긴} 다른 세션에서도 그랬다.\n`) && !받은2.includes(`${긴}\n`), '규칙은 긴 쪽 하나로 이었다');
  fs.writeFileSync(파일2, 받은2.replace(/<<<<<<< 로컬\n[\s\S]*>>>>>>> origin\n/, `${합친줄}\n`).replace(`${긴} 다른 세션에서도 그랬다.\n`, `${긴} 다른 세션에서도 그랬다.\n${긴}\n`));
  const 다시2 = await 도구.맞추기({ 저장소: 둘.작업본, 풀이폴더: 폴더2 });
  assert.deepEqual(다시2.줄문제[0].넘침.map((x) => x.글), [합친줄], 'origin 판에 그대로 있는 줄은 「어디서도 오지 않은 줄」이 아니다');
  assert.equal(다시2.합침[0].이은, undefined);
});

test('한쪽만 바꾼 경로도 --풀이로 덮는다 — 줄 검사는 양쪽이 바꾼 경로처럼 하고, 두 쪽 다 안 바꾼 경로의 --풀이는 멈춘다', async (t) => {
  const 짝시험 = "test('메신저 바깥 링크는 막는다', () => { /* 일부러 뺀 짝 시험 */ });";
  const 원격줄 = '- origin이 더한 긴 줄입니다(스무 자 넘게)';
  const 저장 = 새저장소(t, { 파일: { 'tests/m.test.js': '// 메신저 시험\n', 'docs/o.md': '# o\n- 바탕\n', 'docs/z.md': '# z\n' } });
  저장.커밋({ 'tests/m.test.js': `// 메신저 시험\n${짝시험}\n` }, '로컬만 시험을 더함');
  저장.원격에올림({ 'docs/o.md': `# o\n- 바탕\n${원격줄}\n` }, 'origin만 문서를 고침');
  const 풀이 = [['tests/m.test.js', 'origin'], ['docs/o.md', '로컬']];
  const 그냥 = await 도구.맞추기({ 저장소: 저장.작업본, 풀이 });
  assert.equal(그냥.결과, '멈춤');
  assert.deepEqual(그냥.합침.map((x) => [x.경로, x.방법, x.한쪽만]), [['docs/o.md', '--풀이 로컬', 'origin'], ['tests/m.test.js', '--풀이 origin', '로컬']]);
  assert.deepEqual(그냥.줄문제.map((x) => [x.경로, x.로컬빠짐.map((l) => l.글), x.원격빠짐.map((l) => l.글)]), [['docs/o.md', [], [원격줄]], ['tests/m.test.js', [짝시험], []]]);
  assert.deepEqual(그냥.지움.map((x) => [x.경로, x.로컬]), [['tests/m.test.js', 1]], '로컬 줄을 버리는 것은 지워지는 줄에도 보인다');
  const 글 = 도구.보고글(그냥);
  assert.match(글, /양쪽이 바꾼 경로 0개 · 한쪽만 바꾼 경로의 --풀이 2개/);
  assert.match(글, /--풀이 origin {2}tests\/m\.test\.js \[로컬만 바꾼 경로\]/);
  const { r } = await 맞춰보기(저장, { 풀이, 허용: ['tests/m.test.js', 'docs/o.md'] });
  assert.equal(r.결과, '맞춤', r.이유);
  assert.equal(저장.보기('HEAD', 'tests/m.test.js'), '// 메신저 시험\n');
  assert.equal(저장.읽기('tests/m.test.js'), '// 메신저 시험\n');
  assert.equal(저장.보기('HEAD', 'docs/o.md'), '# o\n- 바탕\n');
  assert.deepEqual(상태(저장), []);

  const 둘 = 새저장소(t, { 파일: { 'docs/o.md': '# o\n', 'docs/z.md': '# z\n' } });
  둘.커밋({ 'docs/o.md': '# o\n- 로컬\n' });
  둘.원격에올림({ 'docs/o.md': '# o\n- origin\n' });
  const 밖 = await 도구.맞추기({ 저장소: 둘.작업본, 풀이: [['docs/z.md', '로컬']] });
  assert.equal(밖.결과, '멈춤');
  assert.match(밖.이유, /--풀이를 준 경로를 로컬도 origin도 바꾸지 않았다: docs\/z\.md/);

  // 로컬이 지운 파일을 --풀이 origin으로 되살리면 작업본 까닭도 그렇게 보인다 — Fable 10-20 ⑤
  const 셋 = 새저장소(t, { 파일: { 'docs/d.md': '# d\n- 로컬이 지운 파일의 긴 줄입니다(스무 자 넘게)\n', 'docs/o.md': '# o\n' } });
  셋.커밋({}, '로컬이 d.md를 지움', ['docs/d.md']);
  셋.원격에올림({ 'docs/o.md': '# o\n- origin\n' }, 'origin만 o.md를 고침');
  const 살림 = await 맞춰보기(셋, { 풀이: [['docs/d.md', 'origin']], 허용: ['docs/d.md'] });
  const d = 살림.미리.작업본.find((x) => x.경로 === 'docs/d.md');
  assert.deepEqual([d.할일, d.까닭], ['새 판', '--풀이로 들인 파일(로컬 HEAD에 없다)']);
  assert.equal(살림.r.결과, '맞춤', 살림.r.이유);
  assert.equal(셋.읽기('docs/d.md'), '# d\n- 로컬이 지운 파일의 긴 줄입니다(스무 자 넘게)\n');
  assert.deepEqual(상태(셋), []);
});

// ── 경합·잠금·막힘 ───────────────────────────────────────────────────────────

/** 남의 미푸시 커밋 하나, origin 커밋 하나, 남의 미커밋 수정 하나가 있는 작은 갈래 */
function 작은갈래(t) {
  const 저장 = 새저장소(t, { 파일: { 'a.md': '# a\n- 1\n', 'b.md': '# b\n- 1\n' } });
  저장.커밋({ 'c.md': '# c 남의 미푸시\n' });
  저장.O = 저장.원격에올림({ 'a.md': '# a\n- 1\n- origin\n', 'b.md': '# b\n- 1\n- origin\n' });
  저장.쓰기('b.md', '# b\n- 남의 미커밋\n- 1\n');
  return 저장;
}
const 바이트들 = (저장) => ['a.md', 'b.md'].map((p) => 해시(저장.바이트(p)));

test('CAS 경합: 쓰는 사이 master가 움직이면 작업본을 되돌리고 멈춘다. 다시 미리 보면 새 머리로 맞춘다', async (t) => {
  const 저장 = 작은갈래(t);
  const 전 = { 머리: 저장.머리(), 바이트: 바이트들(저장), 상태: 상태(저장) };
  const 미리 = await 도구.맞추기({ 저장소: 저장.작업본 });
  let 그사이 = null;
  const r = await 도구.맞추기({
    저장소: 저장.작업본, 실행: 미리.지문,
    시험고리: {
      CAS직전() {
        const 트리 = 저장.git('rev-parse', 'HEAD^{tree}').trim();
        그사이 = 저장.git('commit-tree', 트리, '-p', 'HEAD', '-m', '그사이 남의 커밋').trim();
        저장.git('update-ref', 'refs/heads/master', 그사이);
      },
    },
  });
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /CAS 실패.*작업본을 되돌렸다/);
  assert.equal(저장.머리(), 그사이);
  assert.deepEqual(바이트들(저장), 전.바이트, '작업본은 바이트 그대로');
  assert.deepEqual(상태(저장), 전.상태);
  const 다시 = await 맞춰보기(저장);
  assert.equal(다시.r.결과, '맞춤', 다시.r.이유);
  assert.equal(저장.git('rev-parse', 'HEAD^1').trim(), 그사이);
  assert.equal(저장.읽기('b.md'), '# b\n- 남의 미커밋\n- 1\n- origin\n');
});

test('CAS가 실패해 되돌릴 때, 도구가 쓴 뒤 그사이 남이 고친 파일은 덮지 않고 알린다', async (t) => {
  const 저장 = 작은갈래(t);
  const 미리 = await 도구.맞추기({ 저장소: 저장.작업본 });
  const r = await 도구.맞추기({
    저장소: 저장.작업본, 실행: 미리.지문, 되풀이: 2, 잠깐: () => {},
    시험고리: {
      CAS직전() {
        저장.쓰기('a.md', '# a\n- 1\n- origin\n- 그사이 남이 덧붙임\n');   // 도구가 막 새 판을 쓴 a.md를 남이 고쳤다
        const 트리 = 저장.git('rev-parse', 'HEAD^{tree}').trim();
        저장.git('update-ref', 'refs/heads/master', 저장.git('commit-tree', 트리, '-p', 'HEAD', '-m', '그사이 남의 커밋').trim());
      },
    },
  });
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /a\.md\(그사이 남이 고쳐 되돌리지 않았다\)/);
  assert.deepEqual([r.다시, r.다시세움], [undefined, undefined], '못 되돌린 파일이 있으면 --되풀이여도 다시 세우지 않고 사람이 본다');
  assert.equal(저장.읽기('a.md'), '# a\n- 1\n- origin\n- 그사이 남이 덧붙임\n', '남의 수정이 남는다');
  assert.equal(저장.읽기('b.md'), '# b\n- 남의 미커밋\n- 1\n', '도구가 쓴 그대로인 파일은 되돌린다');
});

test('미리 본 뒤 작업본이 바뀌면 지문이 달라 반영하지 않고, 쓰기 직전에 바뀌면 쓴 파일을 되돌린다', async (t) => {
  const 저장 = 작은갈래(t);
  const 전머리 = 저장.머리();
  const 미리 = await 도구.맞추기({ 저장소: 저장.작업본 });
  저장.쓰기('a.md', '# a\n- 1\n- 그사이 남이 고침\n');
  const 늦음 = await 도구.맞추기({ 저장소: 저장.작업본, 실행: 미리.지문 });
  assert.equal(늦음.결과, '멈춤');
  assert.match(늦음.이유, /미리 보기\(지문 [0-9a-f]{10}\) 뒤 바뀌었다/);
  assert.equal(저장.머리(), 전머리);

  저장.쓰기('a.md', '# a\n- 1\n');
  const 다시 = await 도구.맞추기({ 저장소: 저장.작업본 });
  const 전a = 저장.바이트('a.md');
  const r = await 도구.맞추기({
    저장소: 저장.작업본, 실행: 다시.지문,
    시험고리: { 쓰기직전(경로) { if (경로 === 'b.md') 저장.쓰기('b.md', '그사이 남이 고침\n'); } },
  });
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /쓰기 직전에 작업본이 바뀌었다: b\.md/);
  assert.ok(저장.바이트('a.md').equals(전a), '먼저 쓴 a.md를 되돌렸다');
  assert.equal(저장.읽기('b.md'), '그사이 남이 고침\n', '남이 쓴 것은 덮지 않는다');
  assert.equal(저장.머리(), 전머리);
});

// ── --되풀이 ─────────────────────────────────────────────────────────────────

test('--되풀이: 미리 본 뒤 남의 커밋으로 계획이 바뀌어도 풀이·허용 경로가 그대로면 다시 세운 계획으로 맞춘다', async (t) => {
  const 저장 = 작은갈래(t);
  const 기록폴더 = path.join(저장.작업본, '.git', 'master맞추기', '미리보기');
  fs.mkdirSync(기록폴더, { recursive: true });
  const 옛기록 = path.join(기록폴더, '0000000000.json');
  fs.writeFileSync(옛기록, '{}');
  const 옛날 = new Date(Date.now() - 8 * 864e5);
  fs.utimesSync(옛기록, 옛날, 옛날);
  const 미리 = await 도구.맞추기({ 저장소: 저장.작업본 });
  const 적은 = JSON.parse(fs.readFileSync(path.join(기록폴더, `${미리.지문}.json`), 'utf8'));
  assert.deepEqual([적은.지문, 적은.로컬, 적은.원격머리, 적은.민감], [미리.지문, 미리.로컬, 미리.원격머리, {}], '미리 보기는 대조할 기록을 남긴다');
  assert.ok(!fs.existsSync(옛기록), '일주일 지난 기록은 치운다');
  const 그사이 = 저장.커밋({ 'd.md': '# d 그사이 남의 커밋\n' }, '그사이 남의 커밋');
  const 그냥 = await 도구.맞추기({ 저장소: 저장.작업본, 실행: 미리.지문 });
  assert.equal(그냥.결과, '멈춤');
  assert.match(그냥.이유, /뒤 바뀌었다\(지금 [0-9a-f]{10}\) — 아래 새 계획을 보고/);
  const r = await 도구.맞추기({ 저장소: 저장.작업본, 실행: 미리.지문, 되풀이: 1, 잠깐: () => {} });
  assert.equal(r.결과, '맞춤', r.이유);
  assert.deepEqual(r.다시세움, { 처음지문: 미리.지문, 지문: 그냥.지문, 번: 0 });
  assert.equal(저장.git('rev-parse', 'HEAD^1').trim(), 그사이);
  assert.equal(저장.읽기('b.md'), '# b\n- 남의 미커밋\n- 1\n- origin\n');
  assert.match(도구.보고글(r), /다시 세움: 계획이 미리 보기\(지문 [0-9a-f]{10}\) 뒤 바뀌어 지문 [0-9a-f]{10} 계획으로 실행했다\(--되풀이, 경합으로 다시 세운 횟수 0\)/);
});

test('--되풀이: 쓰는 사이 경합(CAS·작업본)으로 되돌리고 멈추면 다시 세워 맞추고, 횟수를 다 쓰면 멈춘다', async (t) => {
  const 끼어들기 = (저장) => () => {
    const 트리 = 저장.git('rev-parse', 'HEAD^{tree}').trim();
    저장.그사이 = 저장.git('commit-tree', 트리, '-p', 'HEAD', '-m', '그사이 남의 커밋').trim();
    저장.git('update-ref', 'refs/heads/master', 저장.그사이);
  };
  const 저장 = 작은갈래(t);
  let 미리 = await 도구.맞추기({ 저장소: 저장.작업본 });
  let 번 = 0;
  let r = await 도구.맞추기({ 저장소: 저장.작업본, 실행: 미리.지문, 되풀이: 2, 잠깐: () => {}, 시험고리: { CAS직전() { if (번++ === 0) 끼어들기(저장)(); } } });
  assert.equal(r.결과, '맞춤', r.이유);
  assert.equal(r.다시세움.번, 1);
  assert.equal(저장.git('rev-parse', 'HEAD^1').trim(), 저장.그사이);
  assert.equal(저장.읽기('b.md'), '# b\n- 남의 미커밋\n- 1\n- origin\n');

  // 쓰기 직전에 남이 파일을 고쳤다 → 되돌리고 다시 세워 그 고침 위에 3방향
  const 둘 = 작은갈래(t);
  미리 = await 도구.맞추기({ 저장소: 둘.작업본 });
  let 고침 = false;
  r = await 도구.맞추기({
    저장소: 둘.작업본, 실행: 미리.지문, 되풀이: 1, 잠깐: () => {},
    시험고리: { 쓰기직전(경로) { if (경로 === 'b.md' && !고침) { 고침 = true; 둘.쓰기('b.md', '# b 그사이 고침\n- 남의 미커밋\n- 1\n'); } } },
  });
  assert.equal(r.결과, '맞춤', r.이유);
  assert.equal(r.다시세움.번, 1);
  assert.equal(둘.읽기('b.md'), '# b 그사이 고침\n- 남의 미커밋\n- 1\n- origin\n');
  assert.equal(둘.읽기('a.md'), '# a\n- 1\n- origin\n');

  // 늘 끼어들면 횟수만큼 다시 세운 뒤 멈추고, 작업본은 되돌린 그대로
  const 셋 = 작은갈래(t);
  const 전 = 바이트들(셋);
  미리 = await 도구.맞추기({ 저장소: 셋.작업본 });
  r = await 도구.맞추기({ 저장소: 셋.작업본, 실행: 미리.지문, 되풀이: 1, 잠깐: () => {}, 시험고리: { CAS직전: 끼어들기(셋) } });
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /CAS 실패.*작업본을 되돌렸다/);
  assert.equal(r.다시세움.번, 1);
  assert.match(도구.보고글(r), /지문 [0-9a-f]{10} 계획으로 실행하다 멈췄다/);
  assert.deepEqual(바이트들(셋), 전);
  assert.equal(셋.머리(), 셋.그사이);

  // 끼어든 쪽이 먼저 origin을 합쳐 두었으면 다시 세운 계획은 「맞음」 — 멈췄다고 하지 않는다(Fable 10-20 ③)
  const 넷 = 작은갈래(t);
  미리 = await 도구.맞추기({ 저장소: 넷.작업본 });
  r = await 도구.맞추기({
    저장소: 넷.작업본, 실행: 미리.지문, 되풀이: 1, 잠깐: () => {},
    시험고리: { CAS직전() { 넷.git('update-ref', 'refs/heads/master', 넷.git('commit-tree', 넷.git('rev-parse', 'HEAD^{tree}').trim(), '-p', 'HEAD', '-p', 넷.O, '-m', '남이 먼저 합침').trim()); } },
  });
  assert.equal(r.결과, '맞음');
  assert.match(r.이유, /^다시 세워 보니 이미 맞다\(1번째\) — /);
});

test('--되풀이: 풀이·허용 경로가 미리 보기 뒤 바뀌었으면(로컬·origin 판, 풀이 파일·풀이 값, 넣거나 뺀 경로) 또는 미리 보기 기록이 없으면 다시 세운 계획을 실행하지 않는다', async (t) => {
  const 저장 = 새저장소(t, { 파일: { [트랙]: '# 트랙\n\n## 가\n- a1 바탕 줄\n', 'z.md': '# z\n' } });
  저장.커밋({ [트랙]: '# 트랙\n\n## 가\n- a1 바탕 줄 — 로컬이 고침\n' });
  저장.원격에올림({ [트랙]: '# 트랙\n\n## 가\n- a1 origin이 고쳐 쓴 바탕 줄\n' });
  const 합친 = path.join(저장.뿌리, '합친-트랙.md');
  fs.writeFileSync(합친, '# 트랙\n\n## 가\n- a1 origin이 고쳐 쓴 바탕 줄 — 로컬이 고침\n');
  const 옵션 = { 저장소: 저장.작업본, 풀이: [[트랙, 합친]], 허용: [트랙], 잠깐: () => {} };
  let 미리 = await 도구.맞추기(옵션);
  assert.equal(미리.결과, '미리 보기', 미리.이유);
  const 남줄 = '- 그사이 남이 더한 줄';
  const 그사이 = 저장.커밋({ [트랙]: `# 트랙\n\n## 가\n- a1 바탕 줄 — 로컬이 고침\n${남줄}\n` }, '그사이 남의 커밋');
  let r = await 도구.맞추기({ ...옵션, 실행: 미리.지문, 되풀이: 3 });
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /풀이·허용 경로가 미리 보기 뒤 바뀌었다\(docs\/_ops\/트랙\.md 로컬 판\) — 아래 새 계획을 보고/);
  assert.ok(r.지움.find((x) => x.경로 === 트랙).줄.some((l) => l.글 === 남줄 && l.로컬), '다시 세운 계획은 그사이 남이 더한 줄을 버릴 판이었다(--허용이 그 줄까지 받아들이게 두지 않는다)');
  assert.equal(저장.머리(), 그사이, '반영하지 않았다');
  const 새합친 = `# 트랙\n\n## 가\n- a1 origin이 고쳐 쓴 바탕 줄 — 로컬이 고침\n${남줄}\n`;
  fs.writeFileSync(합친, 새합친);
  미리 = await 도구.맞추기(옵션);
  assert.equal(미리.결과, '미리 보기', 미리.이유);
  // 사람이 준 입력이 바뀌어도 멈춘다 — 다른 세션 커밋이 없어도: 미리 본 뒤 풀이 파일을 고쳤거나 풀이 값을 바꿨거나(Fable 10-20 ②) --허용 경로를 더했으면
  fs.writeFileSync(합친, 새합친.replace(`${남줄}\n`, ''));
  r = await 도구.맞추기({ ...옵션, 실행: 미리.지문, 되풀이: 1 });
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /풀이·허용 경로가 미리 보기 뒤 바뀌었다\(docs\/_ops\/트랙\.md 들어갈 판\)/);
  fs.writeFileSync(합친, 새합친);
  r = await 도구.맞추기({ ...옵션, 풀이: [[트랙, '로컬']], 실행: 미리.지문, 되풀이: 1 });
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /\(docs\/_ops\/트랙\.md 들어갈 판\)/);
  r = await 도구.맞추기({ ...옵션, 허용: [트랙, 'z.md'], 실행: 미리.지문, 되풀이: 1 });
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /\(z\.md 풀이·허용에 새로 넣음\)/);
  // origin 판이 바뀌어도(다른 세션의 fetch) 멈춘다 — 풀이 파일 경로는 들어갈 판이 그대로라 origin 판으로만 안다
  저장.원격에올림({ [트랙]: '# 트랙\n\n## 가\n- a1 origin이 고쳐 쓴 바탕 줄\n- origin이 그사이 더한 줄\n' });
  저장.git('fetch', '-q', 'origin');
  r = await 도구.맞추기({ ...옵션, 실행: 미리.지문, 되풀이: 1 });
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /\(docs\/_ops\/트랙\.md origin 판\)/);
  assert.equal(저장.머리(), 그사이);
  // 풀이 파일을 다시 합쳐 미리 본 뒤 그사이 다른 경로만 바뀌면 다시 세운 계획으로 맞춘다
  const 셋째 = `${새합친}- origin이 그사이 더한 줄\n`;
  fs.writeFileSync(합친, 셋째);
  미리 = await 도구.맞추기(옵션);
  assert.equal(미리.결과, '미리 보기', 미리.이유);
  저장.커밋({ 'z.md': '# z 그사이\n' }, '그사이 다른 경로');
  r = await 도구.맞추기({ ...옵션, 실행: 미리.지문, 되풀이: 1 });
  assert.equal(r.결과, '맞춤', r.이유);
  assert.equal(r.다시세움.번, 0);
  assert.equal(저장.보기('HEAD', 트랙), 셋째);

  // --허용만 준 경로도 대조한다: 줄 검사에 걸린 경로를 받아들인 뒤 로컬이 그 경로를 또 고쳤거나, origin 판이 바뀌었으면(다른 세션의 fetch) 멈춘다
  const L = "const 긴이름 = require('./양쪽이-따로-더한-모듈');", 바탕 = 'const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst e = 5;\nconst f = 6;\n';
  const 셋 = 새저장소(t, { 파일: { 'tools/x.js': 바탕 } });
  const 로컬판 = 바탕.replace('const b = 2;\n', `const b = 2;\n${L}\n`), 원격판 = 바탕.replace('const f = 6;\n', `const f = 6;\n${L}\n`);
  셋.커밋({ 'tools/x.js': 로컬판 });
  셋.원격에올림({ 'tools/x.js': 원격판 });
  const 허용옵션 = { 저장소: 셋.작업본, 허용: ['tools/x.js'], 잠깐: () => {} };
  미리 = await 도구.맞추기(허용옵션);
  assert.equal(미리.결과, '미리 보기', 미리.이유);
  셋.커밋({ 'tools/x.js': `// 그사이 로컬이 더 고침\n${로컬판}` });
  r = await 도구.맞추기({ ...허용옵션, 실행: 미리.지문, 되풀이: 1 });
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /풀이·허용 경로가 미리 보기 뒤 바뀌었다\(tools\/x\.js 로컬 판·들어갈 판\)/);
  미리 = await 도구.맞추기(허용옵션);
  assert.equal(미리.결과, '미리 보기', 미리.이유);
  셋.원격에올림({ 'tools/x.js': 원격판.replace('const d = 4;', 'const d = 40;') });
  셋.git('fetch', '-q', 'origin');
  r = await 도구.맞추기({ ...허용옵션, 실행: 미리.지문, 되풀이: 1 });
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /풀이·허용 경로가 미리 보기 뒤 바뀌었다\(tools\/x\.js origin 판·들어갈 판\)/);

  // 미리 보기 기록이 없으면 대조할 수 없어 멈춘다
  const 둘 = 작은갈래(t);
  미리 = await 도구.맞추기({ 저장소: 둘.작업본 });
  fs.rmSync(path.join(둘.작업본, '.git', 'master맞추기', '미리보기'), { recursive: true });
  둘.커밋({ 'd.md': '# d\n' });
  r = await 도구.맞추기({ 저장소: 둘.작업본, 실행: 미리.지문, 되풀이: 1, 잠깐: () => {} });
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /미리 보기\(지문 [0-9a-f]{10}\)의 기록이 없어 다시 세운 계획을 대조할 수 없다/);
});

test('index.lock: 잠깐 생긴 잠금은 기다리고, 주인 없는 잠금은 치우고, 안 풀리면 아무것도 바꾸지 않는다', async (t) => {
  // ① 세 번째 기다림에 풀리는 잠금(PC가 바빠 계획을 다시 세우는 데 10초를 넘겨도 치우지 않게 주인이 있는 잠금으로 본다)
  let 저장 = 작은갈래(t);
  let 잠금 = path.join(저장.작업본, '.git', 'index.lock');
  let 미리 = await 도구.맞추기({ 저장소: 저장.작업본 });
  fs.writeFileSync(잠금, '');
  let 기다림 = 0;
  const 주인있음 = () => 잠금도구.살피기(저장.작업본, { 잠금, 먼저시작한git: () => 1 });
  let r = await 도구.맞추기({ 저장소: 저장.작업본, 실행: 미리.지문, 잠금살피기: 주인있음, 잠깐: (ms) => { 기다림++; if (기다림 === 3) fs.rmSync(잠금); 짧은잠(ms); } });
  assert.equal(r.결과, '맞춤', r.이유);
  assert.ok(기다림 >= 3);

  // ② 주인 없는 잠금(0바이트·오래됨·먼저 시작한 git 없음)은 한 번 치운다
  저장 = 작은갈래(t);
  잠금 = path.join(저장.작업본, '.git', 'index.lock');
  미리 = await 도구.맞추기({ 저장소: 저장.작업본 });
  fs.writeFileSync(잠금, '');
  const 옛날 = new Date(Date.now() - 60000);
  fs.utimesSync(잠금, 옛날, 옛날);
  const 잠금살피기 = () => 잠금도구.살피기(저장.작업본, { 잠금, 먼저시작한git: () => 0 });
  r = await 도구.맞추기({ 저장소: 저장.작업본, 실행: 미리.지문, 잠금살피기 });
  assert.equal(r.결과, '맞춤', r.이유);
  assert.ok(!fs.existsSync(잠금));

  // ③ 내용 있는 잠금(쓰는 중일 수 있다)이 안 풀린다: 아무것도 바꾸지 않고 잠금도 안 지운다
  저장 = 작은갈래(t);
  잠금 = path.join(저장.작업본, '.git', 'index.lock');
  미리 = await 도구.맞추기({ 저장소: 저장.작업본 });
  const 전 = { 머리: 저장.머리(), 바이트: 바이트들(저장) };
  fs.writeFileSync(잠금, '쓰는 중');
  r = await 도구.맞추기({ 저장소: 저장.작업본, 실행: 미리.지문, 잠금한도ms: { 시작: 300 }, 잠깐: 짧은잠 });
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /잠금이 풀리지 않아 아무것도 바꾸지 않았다/);
  assert.deepEqual([저장.머리(), 바이트들(저장)], [전.머리, 전.바이트]);
  assert.equal(fs.readFileSync(잠금, 'utf8'), '쓰는 중');
  fs.rmSync(잠금);
});

test('index.lock: master를 옮긴 직후 잠금 때문에 공용 인덱스를 못 맞추면 master와 작업본을 되돌린다', async (t) => {
  const 저장 = 작은갈래(t);
  const 잠금 = path.join(저장.작업본, '.git', 'index.lock');
  const 전 = { 머리: 저장.머리(), 바이트: 바이트들(저장), 상태: 상태(저장) };
  const 미리 = await 도구.맞추기({ 저장소: 저장.작업본 });
  const r = await 도구.맞추기({
    저장소: 저장.작업본, 실행: 미리.지문, 잠금한도ms: { 맞춤: 300 }, 잠깐: 짧은잠,
    시험고리: { CAS직후: () => fs.writeFileSync(잠금, '쓰는 중') },
  });
  assert.equal(r.결과, '실패');
  assert.equal(r.되돌림, true);
  assert.match(r.이유, /공용 인덱스를 새 master에 맞추지 못했다/);
  fs.rmSync(잠금);
  assert.deepEqual([저장.머리(), 바이트들(저장), 상태(저장)], [전.머리, 전.바이트, 전.상태]);
  const 다시 = await 맞춰보기(저장);
  assert.equal(다시.r.결과, '맞춤', '잠금이 풀린 뒤 다시 하면 된다');
});

test('계획 경로에 남의 스테이징이 있거나 HEAD가 master가 아니면 멈춘다', async (t) => {
  const 저장 = 작은갈래(t);
  저장.쓰기('a.md', '# a\n- 1\n- 남이 스테이징\n');
  저장.git('add', 'a.md');
  const 전인덱스 = 저장.인덱스지문();
  const r = await 도구.맞추기({ 저장소: 저장.작업본 });
  assert.equal(r.결과, '멈춤');
  assert.deepEqual(r.스테이징, [{ 경로: 'a.md', 이유: '로컬 HEAD와 다른 판이 올라가 있다' }]);
  assert.equal(저장.인덱스지문(), 전인덱스);
  저장.git('reset', '-q', '--', 'a.md');
  저장.git('checkout', '-q', '-b', '다른가지');
  const 가지 = await 도구.맞추기({ 저장소: 저장.작업본 });
  assert.equal(가지.결과, '멈춤');
  assert.match(가지.이유, /HEAD가 master가 아니다\(다른가지\)/);
});

// ── 재현: 명령줄로 처음부터 끝까지 ────────────────────────────────────────────

test('재현: 갈라진 공용 작업본의 master를 명령줄로 맞춘다(미리 보기 → 지문으로 실행)', async (t) => {
  const 저장 = 갈라진저장소(t);
  const 명령 = (...args) => {
    const r = spawnSync(process.execPath, [도구경로, ...args], { cwd: 저장.작업본, encoding: 'utf8' });
    t.diagnostic(`$ node tools/master맞추기.js ${args.join(' ')}  → 종료 ${r.status}`);
    if (!args.includes('--json')) for (const 줄 of (r.stdout || '').trim().split('\n')) t.diagnostic(`  ${줄}`);
    return r;
  };
  const 전머리 = 저장.머리();
  t.diagnostic(`전: 로컬 master ${전머리.slice(0, 9)}(남의 미푸시 위) · origin ${저장.O1.slice(0, 9)} · git status ${상태(저장).join(' / ')}`);
  const 보기 = 명령();
  assert.equal(보기.status, 0, 보기.stderr);
  const 지문 = /--실행 ([0-9a-f]{10})/.exec(보기.stdout)[1];
  const 틀림 = 명령('--실행', '0000000000');
  assert.equal(틀림.status, 1);
  assert.match(틀림.stdout, /뒤 바뀌었다/);
  const 실행 = 명령('--실행', 지문);
  assert.equal(실행.status, 0, 실행.stdout);
  assert.match(실행.stdout, /^\[맞춤\] master ← [0-9a-f]{9} \(병합\)/);
  assert.match(실행.stdout, /대조: master = 병합 커밋 ✓ · origin 품음 ✓ · 쓴 파일 ✓ · 공용 인덱스 ✓ · 다른 경로 git status 바뀜 0/);
  assert.equal(저장.git('rev-parse', 'HEAD^1').trim(), 전머리);
  t.diagnostic(`후: 로컬 master ${저장.머리().slice(0, 9)}(부모 ${전머리.slice(0, 9)} · ${저장.O1.slice(0, 9)}) · git status ${상태(저장).join(' / ')}`);
  const 또 = 명령();
  assert.match(또.stdout, /^\[맞음\]/);
  assert.equal(명령('--모르는인자').status, 2);
});
