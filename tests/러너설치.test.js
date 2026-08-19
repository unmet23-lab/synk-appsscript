/* 러너설치 회귀 — 셸 스크립트가 지켜야 하는 것들 (2026-08-18).
 *
 * 왜 이 파일이 생겼나 — `tools/러너설치.sh` 첫 판이 **한글 변수 이름**을 썼다.
 *   이 저장소의 코드는 거의 전부 JS 라 한글 식별자가 정상으로 돌고, 그 습관이 셸로 넘어왔다.
 *   그런데 bash 는 변수 이름에 ASCII 만 받는다 — `저장소=x` 는 대입이 아니라 **명령 실행**으로
 *   읽혀 `No such file or directory` 로 죽는다.
 *   🔴 급소는 여기다: **`bash -n` 이 그것을 통과시킨다.** 문법상 「명령 하나」라 오류가 아니다.
 *   즉 구문검사가 초록을 내는 **거짓 초록**이었고, 실행해 보고서야 잡혔다.
 *   그래서 탐지를 구문검사에 기대지 않고 이 회귀가 따로 진다.
 *
 * ⚠ 이 스위트가 재지 «못»하는 것: 러너가 실제로 등록되는지·서비스가 뜨는지.
 *   그건 유호님 노트북(WSL)에서만 재진다 — 클라우드 컨테이너엔 러너를 세울 수 없다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const 스크립트 = path.join(ROOT, 'tools', '러너설치.sh');
const 원문 = fs.readFileSync(스크립트, 'utf8');

/** 셸에서 «대입»으로 쓰인 이름을 뽑는다. 주석·문자열 안은 과녁이 아니다.
 *
 * 🔴 문자열을 **먼저 걷어낸다.** 안 걷으면 안내 문구 안의 `"deb [arch=$(...)"` 같은 조각이
 *   대입으로 잡힌다 — 첫 판이 정확히 그렇게 거짓양성을 냈다. 가드가 자기 전처리에도 눈이 먼
 *   그 자리다(CLAUDE.md 맹점 ④). 아래 픽스처가 이 반례를 못박는다.
 * 🔑 그리고 대입은 «명령 첫 낱말»에서만 센다 — 줄 중간의 `--opt=val` 은 대입이 아니다. */
function 대입이름들(src) {
  const 이름 = [];
  for (const 줄 of src.split('\n')) {
    const 코드 = 줄
      .replace(/#.*$/, '')                    // 줄 주석
      .replace(/"(?:\\.|[^"\\])*"/g, '""')    // 큰따옴표 문자열
      .replace(/'[^']*'/g, "''");             // 작은따옴표 문자열
    // 명령의 첫 낱말 자리(줄머리 · `;` · `&&` · `||` 뒤)에 온 `이름=` 만 대입이다.
    const m = /(?:^|;|&&|\|\|)\s*([^\s=;|&()"']+)=(?!=)/.exec(코드);
    if (m) 이름.push(m[1]);
  }
  return 이름;
}

/* ── ① ASCII 식별자 (이 파일이 생긴 이유) ─────────────────────────────────── */

test('🔴 탐지력 — 한글 대입을 잡는다 (픽스처 · 버그가 아직 있을 것을 요구하지 않는다)', () => {
  const 나쁜 = '#!/usr/bin/env bash\nset -e\n저장소="a/b"\necho "$저장소"\n';
  const 잡힘 = 대입이름들(나쁜).filter((n) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(n));
  assert.deepEqual(잡힘, ['저장소'], '한글 대입을 못 잡았다 — 이 회귀가 무력하다');

  const 착한 = '#!/usr/bin/env bash\nREPO="a/b"   # 저장소 = 한글은 주석에만\necho "$REPO"\n';
  assert.deepEqual(대입이름들(착한).filter((n) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)), [],
    '거짓양성 — 주석의 한글을 대입으로 셌다');
});

test('🔑 거짓양성 반례 — 문자열 «안»의 `=` 는 대입이 아니다 (첫 판이 여기서 틀렸다)', () => {
  /* 실측 2026-08-18: apt 저장소 등록을 안내하는 문구 안의 `"deb [arch=$(dpkg …)"` 조각이
   *   `[arch` 라는 이름의 대입으로 잡혀 실저장소 검사가 빨개졌다. 탐지기가 자기 전처리에
   *   눈이 먼 자리다 — 그 반례를 여기서 못박는다. */
  const 문구 = '#!/usr/bin/env bash\n'
    + 'say "  echo \\"deb [arch=$(dpkg --print-architecture) signed-by=/x.gpg] https://y stable main\\""\n';
  assert.deepEqual(대입이름들(문구).filter((n) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)), [],
    '문자열 안의 `=` 를 대입으로 셌다 — 안내 문구를 쓸 때마다 이 검사가 빨개진다');
});

test('🔴 실저장소 — 셸 스크립트의 변수 이름이 전부 ASCII 다', () => {
  const 셸들 = [];
  const 훑기 = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) 훑기(p);
      else if (e.name.endsWith('.sh')) 셸들.push(p);
    }
  };
  훑기(path.join(ROOT, 'tools'));
  assert.ok(셸들.length > 0, '셸 스크립트를 하나도 못 찾았다 — 훑는 자리가 틀렸다(0건과 미실행은 같은 모양이다)');

  const 샌것 = [];
  for (const p of 셸들) {
    for (const n of 대입이름들(fs.readFileSync(p, 'utf8'))) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) 샌것.push(`${path.relative(ROOT, p)}: ${n}`);
    }
  }
  assert.deepEqual(샌것, [],
    'bash 변수 이름에 ASCII 아닌 글자가 있다 — `이름=값` 이 대입이 아니라 명령 실행으로 읽혀 죽는다.\n'
    + '  🔑 `bash -n` 은 이것을 «통과»시킨다(문법상 명령 하나다). 한글은 주석·출력 문구에만 쓴다.');
});

/* ── ② 게이트·안전 ─────────────────────────────────────────────────────────── */

test('🔑 bash 구문이 통과한다 (필요조건이지 충분조건이 아니다 — 위 ①이 그 증거다)', () => {
  const r = spawnSync('bash', ['-n', 스크립트], { encoding: 'utf8' });
  assert.equal(r.status, 0, `bash -n 실패:\n${r.stderr}`);
});

test('🔴 모르는 인자를 조용히 안 삼킨다 (F400 계열)', () => {
  const r = spawnSync('bash', [스크립트, '--엉뚱한것'], { encoding: 'utf8', cwd: ROOT });
  assert.notEqual(r.status, 0, `모르는 인자인데 종료코드가 0 이다:\n${r.stdout}`);
  assert.match(r.stderr, /모르는 인자/, '무엇이 잘못됐는지 안 말한다');
  assert.match(r.stderr, /--확인/, '아는 낱말 목록을 안 준다 — 처방 없는 차단은 우회를 가르친다(F103)');
});

test('🔴 fail-closed — `set -euo pipefail` 이 있다', () => {
  assert.match(원문, /^set -euo pipefail$/m,
    '중간 단계가 실패해도 계속 흐른다 — 반쯤 설치된 러너가 「됐다」로 보인다');
});

test('🔴 등록 토큰을 화면·로그에 안 찍는다 (자격증명)', () => {
  const 코드 = 원문.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.ok(!/set -x/.test(코드), 'set -x 가 켜져 있다 — 토큰이 트레이스에 통째로 찍힌다');
  const 찍는줄 = 코드.split('\n').filter((l) => /REG_TOKEN/.test(l) && /(^|\s)(echo|say|printf)\s/.test(l));
  assert.deepEqual(찍는줄, [], `토큰을 출력하는 줄이 있다:\n${찍는줄.join('\n')}`);
  assert.match(코드, /unset REG_TOKEN/, '쓰고 난 토큰을 안 지운다');
});

test('🔴 체크섬을 조용히 건너뛰지 않는다 — 못 읽으면 멈추고 처방을 낸다', () => {
  assert.match(원문, /sha256sum -c/, '내려받은 파일을 검증하지 않는다');
  assert.match(원문, /--sha256 <그 값>/,
    '체크섬을 못 읽었을 때 «사람이 줄 수 있는» 처방이 없다 — 따를 수 없는 차단은 우회를 만든다(F103)');
});

/* ── ③ 같은 판정을 두 곳에 적으면 갈라진다 (F063) ─────────────────────────── */

test('🔴 스위치 이름·라벨이 워크플로와 갈라지지 않는다', () => {
  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'syntax-check.yml'), 'utf8');

  const m = /^SWITCH="([^"]+)"$/m.exec(원문);
  assert.ok(m, '스크립트에서 SWITCH 를 못 읽었다');
  assert.ok(wf.includes(`vars.${m[1]}`),
    `스크립트가 켜는 변수(${m[1]})를 워크플로가 안 본다 — 켜도 job 이 안 뜬다`);

  const l = /^LABEL="([^"]+)"$/m.exec(원문);
  assert.ok(l, '스크립트에서 LABEL 을 못 읽었다');
  assert.match(wf, new RegExp(`runs-on:\\s*\\[[^\\]]*\\b${l[1]}\\b`),
    `스크립트가 다는 라벨(${l[1]})을 워크플로의 runs-on 이 요구하지 않는다 — 러너가 job 을 못 잡는다`);
});

test('🔑 설치 문서가 이 스크립트를 가리킨다 — 손 절차와 자동 통로가 갈라지지 않게', () => {
  const 문서 = path.join(ROOT, 'docs', '_ops', '셀프호스티드_러너_설치.md');
  assert.ok(fs.existsSync(문서), '설치 문서가 없다');
  assert.match(fs.readFileSync(문서, 'utf8'), /tools\/러너설치\.sh/,
    '문서가 스크립트를 안 가리킨다 — 유호님이 클릭 20번을 하게 된다');
});

/* ── ④ 읽기 전용 갈래 ─────────────────────────────────────────────────────── */

test('🔑 `--확인` 은 저장소를 안 바꾼다', (t) => {
  const 전 = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  if (전.status !== 0) return t.skip('git 을 못 돌렸다 — 이 축은 안 재졌다');
  spawnSync('bash', [스크립트, '--확인'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, HOME: os.tmpdir() } });
  const 후 = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(후.stdout, 전.stdout, '`--확인` 이 작업 트리를 건드렸다 — 읽기 전용이어야 한다');
});

/* ── ⑤ 체크섬 추출 — 형제 파일의 값을 집지 않는다 ─────────────────────────
 *
 * 왜 이 절이 생겼나 (2026-08-18 · 유호님 노트북 **첫 실행**에서 터졌다):
 *   릴리스에서 체크섬을 뽑는 첫 판이 `grep -A2 'linux-x64' | grep -oE '[a-f0-9]{64}' | head -1`
 *   이었다. 그런데 릴리스 JSON 의 body 는 **한 줄**이다 — 개행이 `\n` 리터럴로 이스케이프돼
 *   있어서 `-A2`(뒤 2줄)가 아무것도 좁히지 못하고, `head -1` 이 목록 맨 위 형제(win-x64)의
 *   체크섬을 집었다. 실측: 진짜 linux-x64 값은 `04cf0be1…` 인데 스크립트는 `d59123a4…` 를
 *   집었고, **멀쩡히 받은 215MB** 가 남의 값과 대조돼 검증이 터졌다.
 *
 *   🔴 이 자리가 위험한 이유는 「안 돌았다」가 아니라 **돌면서 남의 값을 냈다**는 것이다
 *   (CLAUDE.md 신뢰성 맹점 ④ — 장치는 안 도는 쪽보다 이쪽으로 더 자주 샌다). 게다가 그때
 *   낸 처방이 「지우고 다시 받아라」여서, 따를수록 같은 곳으로 돌아온다(F103).
 *
 *   그래서 탐지를 **픽스처**가 진다 — 실저장소·네트워크에 기대지 않는다(F296). 아래 두 검사는
 *   짝이다: 하나는 새 통로가 맞는 값을 집는지, 다른 하나는 **픽스처가 실제로 그 버그를
 *   재현하는지**(안 그러면 이 회귀는 통과만 하는 장식이다 · 맹점 ②). */

/** 실제 릴리스 body 모양. win-x64 가 linux-x64 **앞**에 온다 — 그게 버그의 조건이었다. */
function 릴리스픽스처(linux, win, arm) {
  return JSON.stringify({
    tag_name: 'v2.336.0',
    body: [
      '## SHA-256 Checksums',
      '',
      `- actions-runner-win-x64-2.336.0.zip <!-- BEGIN SHA win-x64 -->${win}<!-- END SHA win-x64 -->`,
      `- actions-runner-linux-x64-2.336.0.tar.gz <!-- BEGIN SHA linux-x64 -->${linux}<!-- END SHA linux-x64 -->`,
      `- actions-runner-linux-arm64-2.336.0.tar.gz <!-- BEGIN SHA linux-arm64 -->${arm}<!-- END SHA linux-arm64 -->`,
    ].join('\n'),
  });
}

/* v2.336.0 의 linux-x64 실측값. 픽스처는 네트워크를 안 타므로 버전이 올라도 안 낡는다. */
const 리눅스실측 = '04cf0be1aff4c3ec3554466c39124ca250e3effd8873bb7e8d68535aa9505d5d';
const 윈도우가짜 = `d59123a4${'1'.repeat(56)}`;   // 실측 앞 8자리 + 픽스처용 채움
const ARM가짜 = `beef${'2'.repeat(60)}`;

test('🔴 체크섬 — 형제(win-x64)가 앞에 있어도 linux-x64 값을 집는다', () => {
  const r = spawnSync('bash', [스크립트, '--sha추출'], {
    input: 릴리스픽스처(리눅스실측, 윈도우가짜, ARM가짜), encoding: 'utf8', cwd: ROOT,
  });
  assert.equal(r.status, 0, `--sha추출 이 실패했다:\n${r.stderr}`);
  assert.equal(r.stdout.trim(), 리눅스실측,
    '릴리스에서 linux-x64 가 아닌 값을 집었다 — 멀쩡히 받은 파일이 남의 체크섬과 대조돼 터진다');
});

test('🔑 탐지력 — 이 픽스처가 «옛 파이프라인의» 버그를 실제로 재현한다', () => {
  /* 버그가 아직 있을 것을 요구하지 않는다(맹점 ②): 옛 로직을 여기서 한 번만 재현해,
   * 픽스처가 그 함정을 담고 있음을 못박는다. 이게 없으면 위 검사는 「무엇이든 통과」다. */
  const 옛로직 = "tr ',' '\\n' | grep -A2 'linux-x64' | grep -oE '[a-f0-9]{64}' | head -1";
  const r = spawnSync('bash', ['-c', 옛로직], {
    input: 릴리스픽스처(리눅스실측, 윈도우가짜, ARM가짜), encoding: 'utf8',
  });
  assert.equal(r.stdout.trim(), 윈도우가짜,
    '픽스처가 옛 버그를 재현하지 못한다 — 그렇다면 위 검사는 탐지력이 없다(장식이다)');
});

test('🔴 체크섬을 못 찾으면 «빈 값»을 낸다 — 아무거나 집어 오지 않는다', () => {
  /* 못 읽는 것은 사고가 아니다. 사고는 «못 읽었는데 뭔가를 냈다»이다.
   * 빈 값이면 호출부의 `[ -n "$SHA" ] || die …` 가 멈춰 세우고 처방을 낸다. */
  const 마커없음 = JSON.stringify({ tag_name: 'v9.9.9', body: `- 어떤파일.tar.gz ${'a'.repeat(64)}` });
  const r = spawnSync('bash', [스크립트, '--sha추출'], { input: 마커없음, encoding: 'utf8', cwd: ROOT });
  assert.equal(r.status, 0, '마커가 없을 때 죽는다 — 호출부가 처방을 낼 기회를 뺏는다');
  assert.equal(r.stdout.trim(), '',
    '마커가 없는데 64자리 hex 를 집어 왔다 — 이게 정확히 첫 판이 저지른 일이다');
});

test('🔑 `--sha추출` 은 네트워크·저장소를 안 건드린다', (t) => {
  const 전 = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  if (전.status !== 0) return t.skip('git 을 못 돌렸다 — 이 축은 안 재졌다');
  const r = spawnSync('bash', [스크립트, '--sha추출'], {
    input: 릴리스픽스처(리눅스실측, 윈도우가짜, ARM가짜), encoding: 'utf8', cwd: ROOT,
    env: { ...process.env, HOME: os.tmpdir() },
  });
  assert.equal(r.status, 0);
  const 후 = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(후.stdout, 전.stdout, '`--sha추출` 이 작업 트리를 건드렸다');
});

/* ── ⑥ 라벨 판정 — 러너가 «돌고 있는데» 없다고 말하지 않는다 ──────────────
 *
 * 왜 이 절이 생겼나 (2026-08-19 · 유호님 노트북 실측):
 *   `--확인` 이 「리눅스 러너 **없음** · 세우려면 `bash tools/러너설치.sh`」를 냈다.
 *   같은 순간 `svc.sh status` 는 `Running job: check` 였다 — **러너는 job 을 돌리는 중**이었다.
 *
 *   원인은 한 글자다: 스크립트가 `LABEL="linux"`(소문자)를 `grep -q` 로 찾는데, GitHub 가
 *   러너에 붙이는 기본 라벨은 **`Linux`**(대문자)라 `self-hosted,Linux,X64` 에서 안 잡혔다.
 *   ⚠ 급소는 **워크플로가 멀쩡했다**는 것 — Actions 의 `runs-on` 매칭은 대소문자를 무시한다.
 *   즉 러너는 정상이고 **확인 도구만 눈이 멀었다**(F642 와 같은 형태 · 맹점 ④).
 *
 *   🔴 그리고 그 오판이 낸 처방이 「설치하라」였다 — 따르면 멀쩡한 러너를 **215MB 다시 깐다**.
 *   따를수록 같은 자리로 돌아오는 처방이라 F103 계열이다. 그래서 이 절은 두 가지를 진다:
 *   판정이 맞는지, 그리고 **틀린 상태에 «설치» 처방이 안 붙는지**. */

/** 스크립트의 실물 판정을 그대로 부른다(로직 복제 없음 · F063). */
function 라벨판정(줄들) {
  const r = spawnSync('bash', [스크립트, '--라벨판정'], {
    input: `${줄들}\n`, encoding: 'utf8', cwd: ROOT,
  });
  assert.equal(r.status, 0, `--라벨판정 실패:\n${r.stderr}`);
  return r.stdout.trim();
}

test('🔴 대문자 `Linux` 라벨을 찾는다 (유호님 노트북 실물 줄)', () => {
  assert.equal(라벨판정('synk-wsl-localhost|online|self-hosted,Linux,X64'), '등록=1 온라인=1',
    'GitHub 가 실제로 붙이는 대문자 라벨을 못 찾는다 — 도는 러너를 「없다」고 말하게 된다');
});

test('🔑 탐지력 — 옛 `grep -q "linux"` 는 같은 줄에서 «못» 찾는다', () => {
  /* 버그가 아직 있을 것을 요구하지 않는다(맹점 ②): 옛 로직을 여기서 한 번만 재현해,
   * 픽스처가 그 함정을 담고 있음을 못박는다. 이게 없으면 위 검사는 「무엇이든 통과」다. */
  const r = spawnSync('bash', ['-c', 'grep -q "linux"'], {
    input: 'synk-wsl-localhost|online|self-hosted,Linux,X64\n', encoding: 'utf8',
  });
  assert.notEqual(r.status, 0,
    '옛 로직이 이 줄을 찾아버린다 — 그렇다면 픽스처가 실제 버그를 안 담고 있다');
});

test('🔴 등록됐지만 오프라인인 상태를 «따로» 낸다', () => {
  assert.equal(라벨판정('synk-wsl-localhost|offline|self-hosted,Linux,X64'), '등록=1 온라인=0',
    '오프라인을 미등록과 뭉치면 「기계를 켜라」 대신 「설치하라」가 나간다');
});

test('🔑 경계 — `linux-arm` 을 리눅스x64 로 오인하지 않는다', () => {
  assert.equal(라벨판정('other|online|self-hosted,linux-arm,ARM64'), '등록=0 온라인=0',
    '부분일치로 찾고 있다 — 다른 아키텍처 러너를 우리 것으로 센다');
});

test('🔑 러너 0개와 라벨 불일치는 둘 다 «없다»로 수렴한다', () => {
  assert.equal(라벨판정(''), '등록=0 온라인=0');
  assert.equal(라벨판정('win|online|self-hosted,Windows,X64'), '등록=0 온라인=0');
});

test('🔴 오프라인 갈래에 «설치» 처방을 붙이지 않는다 (F103 — 따를수록 나빠지는 처방)', () => {
  /* 세울 게 없는 상태에 「세우려면 설치하라」를 내면 멀쩡한 러너를 다시 깐다.
   * 갈래를 나눈 목적이 그것이므로, 그 목적이 코드에 남아 있는지 여기서 못박는다. */
  const m = /⏸ 러너가 \*\*오프라인\*\*이다[\s\S]*?\n(?=\s*else\b|\s*fi\b)/.exec(원문);
  assert.ok(m, '오프라인 갈래가 사라졌다 — 미검증과 미설치가 다시 한 칸으로 뭉쳤다');
  assert.ok(!/세우려면/.test(m[0]),
    '오프라인인데 「세우려면 설치하라」가 붙어 있다 — 멀쩡한 러너를 215MB 다시 깔게 만든다');
  assert.match(m[0], /다시 설치할 것 없다/, '「설치가 필요 없다」를 명시하지 않는다');
});
