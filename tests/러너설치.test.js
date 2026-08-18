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
