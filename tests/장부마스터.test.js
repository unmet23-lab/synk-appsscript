/* 장부 × origin/master 대조 — 「이 신호가 **이미 닫혔나**」를 묻는 층의 회귀 (마찰 F625).
 *
 * 왜 따로 있나 (tests/마찰신호.test.js 와 겹치지 않는다):
 *   저기는 **작업본 하나**만 본다 — add·resolve·채번이 이 트리 안에서 옳게 도는가.
 *   F625 는 그 안에서 전부 옳게 돌았는데도 났다: 잡은 사람은 나 하나였고(승계했으므로),
 *   장부도 내 트리에선 열린 채가 맞았다. 틀린 것은 **origin/master 였다.**
 *   그래서 이 파일의 픽스처는 언제나 «작업본 + 그와 어긋난 origin» 두 벌이다.
 *
 * 🔑 탐지력은 **픽스처가 진다**(CLAUDE.md 가드 맹점 ②) — 실저장소는 안 만진다.
 *   진짜 git 저장소 둘(bare origin + 작업본)을 임시로 세우고 `fetch`·`show` 가 실제로 돌게 한다.
 *   모사를 주입하면 「경로를 어떻게 짜서 git 에 넘기나」가 검사에서 통째로 빠지는데,
 *   F625 계열의 실제 사고는 언제나 그 이음매에서 났다.
 *
 * 〖틀릴 때의 모습〗 이 검사가 사인하는 길은 하나다 — 픽스처의 origin 을 못 세우면
 *   판정이 전부 `모름` 으로 떨어지고 **막는 검사들이 조용히 초록**이 된다(그게 F207 의 모양이다).
 *   그래서 「막는다」 검사마다 **차단문의 낱말**을 함께 단언한다: `모름` 은 그 문장을 못 만든다.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const TOOL = path.resolve(__dirname, '..', 'tools', 'friction.js');
const 장부마스터 = require(path.resolve(__dirname, '..', 'tools', 'lib', '장부마스터.js'));

const 머리 = [
  '# 마찰 신호',
  '',
  '| ID | 날짜 | 종류 | 신호 | 해소 |',
  '|---|---|---|---|---|',
].join('\n');

function git(인자들, 뿌리) {
  return execFileSync('git', ['-C', 뿌리, ...인자들], { encoding: 'utf8', stdio: 'pipe' });
}

/** 작업본 하나 + 그 origin(bare) 하나. 돌려주는 것은 작업본 경로다. */
function 저장소() {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-master-'));
  const up = path.join(방, 'up.git');
  const wt = path.join(방, 'wt');
  fs.mkdirSync(up); fs.mkdirSync(wt);
  execFileSync('git', ['init', '--bare', '--quiet', up], { stdio: 'pipe' });
  execFileSync('git', ['init', '--quiet', wt], { stdio: 'pipe' });
  git(['symbolic-ref', 'HEAD', 'refs/heads/master'], wt);   // 기본 가지 이름에 안 기댄다
  git(['config', 'user.email', 'test@synk.local'], wt);
  git(['config', 'user.name', 'synk-test'], wt);
  git(['config', 'commit.gpgsign', 'false'], wt);
  fs.mkdirSync(path.join(wt, 'docs', '_ops', '장부'), { recursive: true });
  return { wt, up, 방 };
}

const 장부경로 = (wt) => path.join(wt, 'docs', '_ops', '마찰신호.md');
const 조각경로 = (wt, id) => path.join(wt, 'docs', '_ops', '장부', `${id}.md`);

function 커밋(wt, 제목) {
  git(['add', '-A'], wt);
  git(['commit', '--quiet', '-m', 제목], wt);
}

/** 작업본은 `열림`, origin/master 는 `해소` — F625 가 난 그 어긋남을 그대로 만든다. */
function 어긋나게(옵션) {
  const { wt, up, 방 } = 저장소();
  const {
    id = 'F001',
    마스터조각 = null,        // origin/master 의 조각 내용(null 이면 조각 없음)
    마스터장부 = null,        // origin/master 의 동결 아카이브 내용(null 이면 기본 머리만)
    로컬조각 = `| ${id} | 2026-08-18 | 마찰 | 로컬은 아직 열려 있다 | |`,
    로컬장부 = null,
    origin붙임 = true,
  } = 옵션 || {};

  fs.writeFileSync(장부경로(wt), `${머리}\n`, 'utf8');
  커밋(wt, '장부 머리');
  if (origin붙임) {
    git(['remote', 'add', 'origin', up], wt);
    git(['push', '--quiet', 'origin', 'master'], wt);
  }

  if (origin붙임) {
    // ① origin/master 판을 만든다
    if (마스터장부 !== null) fs.writeFileSync(장부경로(wt), `${머리}\n${마스터장부}\n`, 'utf8');
    if (마스터조각 !== null) fs.writeFileSync(조각경로(wt, id), `${마스터조각}\n`, 'utf8');
    if (마스터장부 !== null || 마스터조각 !== null) {
      커밋(wt, 'origin 판');
      git(['push', '--quiet', 'origin', 'master'], wt);
      git(['reset', '--hard', '--quiet', 'HEAD~1'], wt);     // 작업본만 되돌린다 = 「내가 뒤처졌다」
    }
  }

  // ② 작업본 판 — 커밋하지 않는다(장부는 늘 미커밋 편집 상태에서 닫힌다)
  //    ⚠ 위 `reset --hard` 는 **빈 폴더를 지운다** — 조각 폴더가 사라진 채로 쓰면 ENOENT 다.
  fs.mkdirSync(path.join(wt, 'docs', '_ops', '장부'), { recursive: true });
  if (로컬장부 !== null) fs.writeFileSync(장부경로(wt), `${머리}\n${로컬장부}\n`, 'utf8');
  if (로컬조각 !== null) fs.writeFileSync(조각경로(wt, id), `${로컬조각}\n`, 'utf8');
  return { wt, up, 방, id };
}

function 돌리기(wt, 인자들) {
  try {
    const out = execFileSync(process.execPath, [TOOL, ...인자들], {
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, SYNK_FRICTION_LEDGER: 장부경로(wt), SYNK_FRICTION_ROOT: wt },
    });
    return { 실패: false, out, err: '' };
  } catch (e) {
    return { 실패: true, out: String(e.stdout || ''), err: String(e.stderr || '') };
  }
}

/** 지금 작업본 조각의 해소 칸(마지막 칸). 없으면 `null`. */
function 해소칸(wt, id) {
  let 본문 = '';
  try { 본문 = fs.readFileSync(조각경로(wt, id), 'utf8'); } catch (_) { return null; }
  const 줄 = 장부마스터.행뽑기(본문, id);
  return 줄 === null ? null : 장부마스터.마지막칸(줄).trim();
}

const 해소행 = (id, 문구) => `| ${id} | 2026-08-18 | 마찰 | 신고문 | ${문구} |`;
const 열린행 = (id) => `| ${id} | 2026-08-18 | 마찰 | 신고문 | |`;

test('resolve — origin/master 의 조각이 이미 해소면 막고, 그쪽 문장을 보여 준다', () => {
  const { wt, id } = 어긋나게({ 마스터조각: 해소행('F001', 'tools/무언가.js 신설 — 남이 먼저 닫았다') });
  const r = 돌리기(wt, ['resolve', id, '내가 짓던 판']);
  assert.ok(r.실패, 'master 가 이미 닫은 번호를 그대로 닫으면 같은 파일에 행이 둘이 된다(F625)');
  assert.ok(/이미 해소/.test(r.err), `차단문이 안 나왔다 — 모름으로 떨어진 것일 수 있다:\n${r.err}`);
  assert.ok(r.err.includes('남이 먼저 닫았다'), '그쪽 해소문을 안 보여 주면 합칠지 판단할 재료가 없다');
  assert.strictEqual(해소칸(wt, id), '', '막혔으면 작업본 조각은 그대로 열린 채여야 한다');
});

test('resolve --마스터확인함 — 차단문이 시키는 그 명령이 실제로 통한다(가드 맹점 ③)', () => {
  const { wt, id } = 어긋나게({ 마스터조각: 해소행('F001', '남의 해소문') });
  const r = 돌리기(wt, ['resolve', id, '남의 해소문 + 내 델타', '--마스터확인함']);
  assert.ok(!r.실패, `자기 처방이 안 통하면 우회가 정상 통로가 된다(F103):\n${r.err}`);
  assert.ok(/우회/.test(r.out), '우회했다는 사실이 안 찍히면 「막힌 적 없음」과 같은 모양이 된다');
  assert.strictEqual(해소칸(wt, id), '남의 해소문 + 내 델타');
});

test('resolve — origin/master 에서도 열려 있으면 통과하고, 쟀다는 사실을 찍는다', () => {
  const { wt, id } = 어긋나게({ 마스터조각: 열린행('F001') });
  const r = 돌리기(wt, ['resolve', id, '내가 닫는다']);
  assert.ok(!r.실패, r.err);
  assert.ok(/master 대조 ✓/.test(r.out), '통과도 찍어야 「안 돈 것」과 구별된다(F207)');
  assert.strictEqual(해소칸(wt, id), '내가 닫는다');
});

test('resolve — 그 번호가 origin/master 에 아직 없으면 통과한다(갓 난 신고의 정상 경로)', () => {
  const { wt, id } = 어긋나게({ 마스터조각: null, 마스터장부: null });
  const r = 돌리기(wt, ['resolve', id, '방금 신고하고 방금 닫는다']);
  assert.ok(!r.실패, r.err);
  assert.ok(/아직 없다/.test(r.out), `「없음」과 「모름」이 같은 문장이면 분모가 사라진다:\n${r.out}`);
});

test('두 층을 다 연다 — 조각이 없고 **동결 아카이브**에만 해소가 있어도 막는다(F348)', () => {
  const { wt, id } = 어긋나게({
    마스터조각: null,
    마스터장부: 해소행('F001', '아카이브 층에서 닫혔다'),
    로컬조각: null,
    로컬장부: 열린행('F001'),
  });
  const r = 돌리기(wt, ['resolve', id, '내 판']);
  assert.ok(r.실패, '한 층만 열고 「master 에 없다」를 내면 그건 한 갈래로 낸 부정 판정이다(F348)');
  assert.ok(r.err.includes('아카이브 층에서 닫혔다'), r.err);
});

test('층 우선순위 — 아카이브가 해소여도 **조각이 열려 있으면** 통과한다(read() 와 같은 규칙)', () => {
  const { wt, id } = 어긋나게({
    마스터조각: 열린행('F001'),
    마스터장부: 해소행('F001', '옛 아카이브의 낡은 해소'),
  });
  const r = 돌리기(wt, ['resolve', id, '지금 닫는다']);
  assert.ok(!r.실패, `같은 번호는 조각이 이긴다 — 규칙이 갈리면 여기가 먼저 빨개져야 한다:\n${r.err}`);
  assert.strictEqual(해소칸(wt, id), '지금 닫는다');
});

test('못 재면 fail 이 아니라 skip 이다 — origin 이 없는 트리에서도 닫을 수 있다(F296)', () => {
  const { wt, id } = 어긋나게({ origin붙임: false });
  const r = 돌리기(wt, ['resolve', id, '오프라인에서 닫는다']);
  assert.ok(!r.실패, `못 재는 기계에서 막으면 신호를 영영 못 닫는다:\n${r.err}`);
  assert.ok(/건너뜀/.test(r.out), '건너뛴 사실을 안 찍으면 「쟀는데 깨끗하다」와 같은 모양이 된다(F207)');
  assert.ok(/참조가 없다/.test(r.out), `왜 못 쟀는지가 없으면 0 과 구별이 안 된다:\n${r.out}`);
  assert.strictEqual(해소칸(wt, id), '오프라인에서 닫는다');
});

/* 「없음」과 「모름」이 한 칸으로 뭉치면 **분모가 사라진다**(F207). ref 는 멀쩡한데 그 커밋에
 *   장부가 없는 판 — 경로가 바뀌었거나 얕은 클론이 트리를 다 못 받은 자리다. 여기서 「master 에
 *   아직 없다」를 내면 그건 **안 재고 통과시킨 것**을 「쟀는데 깨끗하다」로 말하는 것이다. */
test('못 읽음 ≠ 없다 — ref 는 있는데 그 커밋에 장부가 없으면 모름이다(F207)', () => {
  const { wt, up } = 저장소();
  fs.writeFileSync(path.join(wt, 'README.md'), '# 장부가 아직 없는 커밋\n', 'utf8');
  커밋(wt, '장부 없는 커밋');
  git(['remote', 'add', 'origin', up], wt);
  git(['push', '--quiet', 'origin', 'master'], wt);
  fs.writeFileSync(장부경로(wt), `${머리}\n`, 'utf8');
  fs.writeFileSync(조각경로(wt, 'F001'), `${열린행('F001')}\n`, 'utf8');

  const r = 돌리기(wt, ['resolve', 'F001', '닫는다']);
  assert.ok(!r.실패, `못 재는 것은 막는 사유가 아니다(F296):\n${r.err}`);
  assert.ok(/건너뜀/.test(r.out), `못 읽음을 「없다」로 접으면 미측정이 통과와 같은 모양이 된다:\n${r.out}`);
  assert.ok(/장부를 못 읽었다/.test(r.out), r.out);
});

test('defer 도 같은 관문을 탄다 — master 가 닫은 번호 위에 보류를 쓰면 그 행이 되살아난다', () => {
  const { wt, id } = 어긋나게({ 마스터조각: 해소행('F001', '남이 닫은 문장') });
  const r = 돌리기(wt, ['defer', id, '지금은 안 닫는다 — 보드 줄에서 판정']);
  assert.ok(r.실패, '옆자리를 안 태우는 것이 F297→F301 의 형태다');
  assert.ok(/이미 해소/.test(r.err), r.err);
});

test('로컬이 이미 해소면 관문을 안 탄다 — 따를 필요 없는 처방을 내지 않는다(F103)', () => {
  const { wt, id } = 어긋나게({
    마스터조각: 해소행('F001', '남의 해소문'),
    로컬조각: 해소행('F001', '내가 이미 닫아 뒀다'),
  });
  const r = 돌리기(wt, ['resolve', id, '또 닫기']);
  assert.ok(r.실패, '이미 해소된 행은 덮어쓰지 않는다');
  assert.ok(/이미 해소로 기록돼 있다/.test(r.err), `로컬 사유가 이겨야 한다:\n${r.err}`);
  assert.strictEqual(해소칸(wt, id), '내가 이미 닫아 뒀다', '기존 해소 기록이 보존돼야 한다');
});

/* 🔑 F625 의 실제 모양은 **낡은 ref** 였다 — 착수 직후 한 번 당기고, 그 뒤 30커밋이 지났다.
 *   그래서 「origin/master 를 읽는다」만으로는 부족하고 **읽기 직전에 당겨야** 한다.
 *   이 픽스처는 그 축만 잰다: 남이 origin 에 닫아 놓았지만 **내 원격추적 ref 는 아직 옛 커밋**이다. */
test('당김 — 남이 닫은 것이 내 원격추적 ref 에 아직 안 왔어도 막는다(F625 의 실제 모양)', () => {
  const { wt, up, 방, id } = 어긋나게({ 마스터조각: 열린행('F001') });
  const 남의트리 = path.join(방, '남');
  execFileSync('git', ['clone', '--quiet', up, 남의트리], { stdio: 'pipe' });
  git(['config', 'user.email', 'other@synk.local'], 남의트리);
  git(['config', 'user.name', 'other'], 남의트리);
  fs.mkdirSync(path.join(남의트리, 'docs', '_ops', '장부'), { recursive: true });
  fs.writeFileSync(path.join(남의트리, 'docs', '_ops', '장부', `${id}.md`),
    `${해소행('F001', '남이 나중에 닫았다')}\n`, 'utf8');
  커밋(남의트리, '남의 해소');
  git(['push', '--quiet', 'origin', 'master'], 남의트리);

  const 옛ref = git(['rev-parse', 'refs/remotes/origin/master'], wt).trim();
  const 진짜 = git(['rev-parse', 'refs/heads/master'], up).trim();
  assert.notStrictEqual(옛ref, 진짜, '픽스처가 낡은 ref 를 못 만들었으면 이 검사는 아무것도 안 잰다');

  const r = 돌리기(wt, ['resolve', id, '내 판']);
  assert.ok(r.실패, '낡은 ref 를 그대로 읽으면 F625 가 그대로 재발한다');
  assert.ok(r.err.includes('남이 나중에 닫았다'), r.err);
});

/* 해소문에는 **백틱 안 파이프**가 실제로 산다(`` `a|b` ``). 날 `split('|')` 로 가르면 칸이 밀려
 *   그쪽 문장이 잘린 채 보이고, 잘린 문장으로는 「합칠지」를 판단할 수 없다. 칸 가르기는
 *   저장소에 한 통로뿐이다(`lib/표.js` · 옛 통로는 `tests/표칸.test.js` 가 금지한다). */
test('해소문의 백틱 안 파이프에서 칸이 안 밀린다', () => {
  const 문장 = '`대기열.js|보드.js` 두 통로를 하나로 합쳐 막았다';
  const { wt, id } = 어긋나게({ 마스터조각: 해소행('F001', 문장) });
  const r = 돌리기(wt, ['resolve', id, '내 판']);
  assert.ok(r.실패, r.out);
  assert.ok(r.err.includes(문장), `칸이 밀려 그쪽 해소문이 잘렸다:\n${r.err}`);
});

test('마스터판 — 판정을 스스로 짓지 않는다(행상태 를 안 주면 모름)', () => {
  const { wt, id } = 어긋나게({ 마스터조각: 해소행('F001', '남의 해소문') });
  const 판 = 장부마스터.마스터판(id, {
    뿌리: wt,
    장부: 장부경로(wt),
    폴더: path.join(wt, 'docs', '_ops', '장부'),
  });
  assert.strictEqual(판.상태, '모름');
  assert.ok(/행상태/.test(판.사유), 판.사유);
});

test('마스터판 — 장부가 저장소 밖이면 모름이다(0 으로 접지 않는다)', () => {
  const { wt } = 어긋나게({ 마스터조각: 해소행('F001', '남의 해소문') });
  const 밖 = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-out-'));
  const 판 = 장부마스터.마스터판('F001', {
    뿌리: wt,
    장부: path.join(밖, '마찰신호.md'),
    폴더: path.join(밖, '장부'),
    행상태: () => '해소',
  });
  assert.strictEqual(판.상태, '모름');
  assert.ok(/저장소 밖/.test(판.사유), 판.사유);
});

test('git경로 — 뿌리 밖·뿌리 자신은 null, 안쪽은 슬래시 경로다', () => {
  const 뿌리 = path.resolve('/tmp/synk-가짜뿌리');
  assert.strictEqual(장부마스터.git경로(뿌리, path.join(뿌리, 'docs', '_ops', 'a.md')), 'docs/_ops/a.md');
  assert.strictEqual(장부마스터.git경로(뿌리, 뿌리), null);
  assert.strictEqual(장부마스터.git경로(뿌리, path.resolve('/tmp/다른곳/a.md')), null);
});

test('행뽑기 — 표기가 흔들려도(공백 둘) 잡고, 다른 번호는 안 잡는다', () => {
  const 본문 = ['# 머리', '|  F007 | 2026-08-18 | 마찰 | 신고 | 해소문 |', '| F070 | 2026-08-18 | 마찰 | 남 | |'].join('\n');
  assert.ok(장부마스터.행뽑기(본문, 'F007').includes('해소문'));
  assert.ok(장부마스터.행뽑기(본문, 'F070').endsWith('| |'));
  assert.strictEqual(장부마스터.행뽑기(본문, 'F999'), null);
});
