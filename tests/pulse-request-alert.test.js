'use strict';

// PULSE 새 의뢰 텔레그램 알림(2026-11-14) — 회사 주 노드 스크립트(tools/pulse-request-alert/alert.py)의 파이썬 시험을 돌리고,
// PC 설치 도구(install.cjs)가 열쇠를 화면에 찍지 않고 짐을 바르게 싸는지 본다. 서버 · 텔레그램 · 헤르메스는 건드리지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const 폴더 = path.join(__dirname, '..', 'tools', 'pulse-request-alert');
const 설치 = require(path.join(폴더, 'install.cjs'));
const python = process.platform === 'win32' ? 'python' : 'python3';
const 열쇠 = '1234567890:' + 'B'.repeat(35);

function 임시(이름, 글) {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-alert-install-'));
  const 파일 = path.join(방, 이름);
  fs.writeFileSync(파일, 글);
  return 파일;
}

test('서버 스크립트 파이썬 시험이 통과한다', () => {
  const r = spawnSync(python, ['-X', 'utf8', '-B', path.join(폴더, 'alert.test.py')], { encoding: 'utf8', windowsHide: true, timeout: 120000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`.slice(-4000));
  assert.match(r.stderr, /\nOK\s*$/);
});

test('헤르메스 설정에서 봇 열쇠만 꺼내고, 유호님 대화방이 허용 사용자에 없으면 멈춘다', () => {
  const 좋은 = 임시('.env', `# 헤르메스\nOPENAI_API_KEY=sk-x\nTELEGRAM_BOT_TOKEN="${열쇠}"\nTELEGRAM_ALLOWED_USERS=111,${설치.대화방}\n`);
  assert.deepEqual(설치.열쇠읽기(좋은), { 열쇠 });
  assert.throws(() => 설치.열쇠읽기(임시('.env', `TELEGRAM_BOT_TOKEN=abc\nTELEGRAM_ALLOWED_USERS=${설치.대화방}\n`)), /HERMES_TOKEN_INVALID/);
  assert.throws(() => 설치.열쇠읽기(임시('.env', `TELEGRAM_BOT_TOKEN=${열쇠}\nTELEGRAM_ALLOWED_USERS=111\n`)), /CHAT_NOT_ALLOWED_IN_HERMES/);
  assert.throws(() => 설치.열쇠읽기(path.join(os.tmpdir(), '없는-헤르메스-설정.env')), /HERMES_ENV_MISSING/);
});

test('짐: 타이머끔 설치는 열쇠만 싣고 장부는 열지 않는다(검수 GA2)', () => {
  const env = 임시('.env', `TELEGRAM_BOT_TOKEN=${열쇠}\nTELEGRAM_ALLOWED_USERS=${설치.대화방}\n`);
  const 짐 = 설치.짐만들기('install', { 열쇠파일: env, 타이머끔: true });
  assert.deepEqual([짐.holdTimer, 짐.seed, typeof 짐.config], [true, null, 'string']);
  const 원문 = 설치.원격원문({ ...짐, expect: { id: '1', project: 'x' } });
  assert.ok(원문.indexOf("P.get('holdTimer')") < 원문.indexOf("alert('--seed'"), '타이머끔이면 장부를 열기 전에 끝난다');
  assert.ok(원문.indexOf("P.get('holdTimer')") < 원문.indexOf("'enable','--now'"));
});

test('짐: 상태 · 시험 · 끄기에는 열쇠가 없고, 설치에만 열쇠 파일 글과 PC 장부(번호 꼴만)가 든다', () => {
  const env = 임시('.env', `TELEGRAM_BOT_TOKEN=${열쇠}\nTELEGRAM_ALLOWED_USERS=${설치.대화방}\n`);
  const 장부 = 임시('알린의뢰.json', JSON.stringify({ 'P-1114-AB12': '2026-11-14T01:00:00.000Z', '../x': 'y', 'P-1114-CD34': 3 }));
  for (const 방식 of ['status', 'test', 'off']) {
    const 짐 = 설치.짐만들기(방식, { 열쇠파일: env, 장부파일: 장부 });
    assert.equal(짐.config, undefined);
    assert.doesNotMatch(Buffer.from(설치.원격원문(짐)).toString(), /B{35}/);
    assert.doesNotMatch(JSON.stringify(짐), /QkJCQkJC/, 'base64로 싼 열쇠도 없다');
  }
  const 짐 = 설치.짐만들기('install', { 열쇠파일: env, 장부파일: 장부 });
  assert.equal(Buffer.from(짐.config, 'base64').toString(), `# SYNK PULSE 새 의뢰 알림 — tools/pulse-request-alert/install.cjs가 쓴다(헤르메스와 같은 봇)\nTELEGRAM_BOT_TOKEN=${열쇠}\nTELEGRAM_CHAT_ID=${설치.대화방}\n`);
  assert.deepEqual(짐.seed, { 'P-1114-AB12': '2026-11-14T01:00:00.000Z' });
  assert.equal(짐.replaceConfig, false);
  assert.equal(설치.짐만들기('install', { 열쇠파일: env, 장부파일: 장부, 열쇠바꿈: true }).replaceConfig, true);
  // 장부를 못 읽으면 null — 서버 장부를 빈 장부로 열지 않고 「다시 열기」로 둔다. 손으로 준 장부가 없으면 멈춘다(검수 A4).
  assert.equal(설치.장부읽기(path.join(os.tmpdir(), '없는-장부.json')), null);
  assert.equal(설치.장부읽기(임시('x.json', '[1,2]')), null);
  assert.equal(설치.장부읽기(임시('x.json', '{깨짐')), null);
  assert.equal(설치.장부읽기(임시('x.json', '{}')), null, '번호가 하나도 없으면 빈 장부로 열지 않는다(검수 b A1)');
  assert.equal(설치.장부읽기(임시('x.json', JSON.stringify({ '../x': 'y' }))), null);
  assert.throws(() => 설치.짐만들기('install', { 열쇠파일: env, 장부파일: path.join(os.tmpdir(), '없는-장부.json') }), /LEDGER_UNREADABLE/);
});

test('인자는 엄격하게 읽는다 — 모르는 옵션 · 방식 둘 · 설치 밖의 --장부는 멈춘다', () => {
  assert.deepEqual(설치.인자읽기([]), { 방식: null, 옵션: {} });
  assert.equal(설치.인자읽기(['--상태']).방식, 'status');
  const 설치인자 = 설치.인자읽기(['--설치', '--열쇠바꿈', '--장부', 'a.json']);
  assert.deepEqual([설치인자.방식, 설치인자.옵션.열쇠바꿈, path.basename(설치인자.옵션.장부파일)], ['install', true, 'a.json']);
  const 끔 = 설치.인자읽기(['--설치', '--타이머끔']);
  assert.deepEqual([끔.방식, 끔.옵션.타이머끔], ['install', true]);
  for (const 틀린 of [['--시험', '--타이머끔'], ['--설치', '--타이머끔', '--장부', 'a.json'], ['constructor'], ['toString'], ['__proto__'], ['--status'], ['--off'], ['--설치', '--끄기'], ['--시험', '--열쇠바꿈'], ['--설치', '--장부'], ['--설치', '--장부', '--열쇠바꿈']]) {
    assert.throws(() => 설치.인자읽기(틀린), /^Error: USAGE/, 틀린.join(' '));
  }
});

test('판정: 기존 타이머가 살아 있다는 것만으로 설치 · 끄기를 성공으로 보지 않는다', () => {
  const files = Object.fromEntries(설치.깔파일().map((f) => [f.path, true]));
  const 상태 = { timerEnabled: 'enabled', timerActive: 'active', files, config: { mode: '0o600', uid: 0, gid: 0 }, statePresent: true };
  const 좋은 = { daemonReload: 0, enable: { code: 0 }, seed: 'kept', status: 상태 };
  assert.equal(설치.판정('install', 좋은), true);
  assert.equal(설치.판정('install', { ...좋은, enable: { code: 1 } }), false);
  assert.equal(설치.판정('install', { ...좋은, daemonReload: 1 }), false);
  assert.equal(설치.판정('install', { ...좋은, status: { ...상태, files: { ...files, '/opt/synk-pulse-request-alert/alert.py': false } } }), false);
  assert.equal(설치.판정('install', { ...좋은, status: { ...상태, config: { mode: '0o644', uid: 0 } } }), false);
  assert.equal(설치.판정('install', { ...좋은, seed: 'none', status: { ...상태, statePresent: false } }), true, '장부 없이 깔면 첫 회차가 「다시 열기」로 만든다');
  assert.equal(설치.판정('install', { ...좋은, seed: { event: 'SYNK_PULSE_ALERT_SEEDED', alerted: 6 } }), true);
  assert.equal(설치.판정('install', { ...좋은, seed: { event: 'SYNK_PULSE_ALERT_SEED_REFUSED' } }), false, '장부 열기 실패는 설치 실패(검수 b A2)');
  // 타이머를 끈 채로 까는 첫 단계(검수 GA2) — 장부를 열지 않고 타이머가 꺼져 있어야 성공이다.
  const 끔상태 = { ...상태, timerEnabled: 'disabled', timerActive: 'inactive', statePresent: false };
  const 끔 = { daemonReload: 0, seed: 'held', disable: { code: 0 }, status: 끔상태 };
  assert.equal(설치.판정('install', 끔, { 타이머끔: true }), true);
  assert.equal(설치.판정('install', { ...끔, status: { ...끔상태, timerActive: 'active' } }, { 타이머끔: true }), false);
  assert.equal(설치.판정('install', { ...끔, seed: { event: 'SYNK_PULSE_ALERT_SEEDED' } }, { 타이머끔: true }), false);
  assert.equal(설치.판정('install', 끔), false, '타이머끔 없이 같은 결과는 설치 실패');
  assert.equal(설치.판정('off', { disable: { code: 0 }, status: { timerActive: 'inactive' } }), true);
  assert.equal(설치.판정('off', { disable: { code: 1 }, status: { timerActive: 'inactive' } }), false);
  assert.equal(설치.판정('off', { disable: { code: 0 }, status: { timerActive: 'active' } }), false);
  assert.equal(설치.판정('test', { test: { ok: false } }), false);
});

test('원격 원문은 서버 신원을 확인하기 전에 아무것도 쓰지 않는다(검수 A5)', () => {
  const env = 임시('.env', `TELEGRAM_BOT_TOKEN=${열쇠}\nTELEGRAM_ALLOWED_USERS=${설치.대화방}\n`);
  const 짐 = { ...설치.짐만들기('install', { 열쇠파일: env, 장부파일: 임시('a.json', JSON.stringify({ 'P-1114-AB12': '2026-11-14T01:00:00.000Z' })) }), expect: { id: '0', project: 'nope' } };
  // 이 PC · CI에는 GCE 메타데이터가 없어 신원이 맞지 않는다 — 파일 · 단위를 쓰기 전에 멈춰야 한다.
  const r = spawnSync(python, ['-X', 'utf8', '-'], { input: 설치.원격원문(짐), encoding: 'utf8', windowsHide: true, timeout: 60000 });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /REMOTE_IDENTITY/);
  assert.equal(r.stdout.trim(), '');
  const 원문 = 설치.원격원문(짐);
  assert.ok(원문.indexOf("'REMOTE_IDENTITY'") < 원문.indexOf("if P['mode']=='install':"), '신원 확인이 설치보다 앞');
  assert.ok(원문.indexOf("'SEED_FAILED'") < 원문.indexOf("'enable','--now'"), '장부 열기 실패면 타이머를 켜기 전에 멈춘다');
});

test('깔 파일 셋의 자리와 해시가 저장소 바이트와 같다', () => {
  const 파일 = 설치.깔파일();
  assert.deepEqual(파일.map((f) => f.path), ['/opt/synk-pulse-request-alert/alert.py', '/etc/systemd/system/synk-pulse-request-alert.service', '/etc/systemd/system/synk-pulse-request-alert.timer']);
  for (const f of 파일) {
    const 바이트 = fs.readFileSync(path.join(폴더, f.로컬));
    assert.equal(f.sha256, crypto.createHash('sha256').update(바이트).digest('hex'));
    assert.equal(Buffer.from(f.b64, 'base64').equals(바이트), true);
    assert.equal(f.mode, '644');
    assert.equal(바이트.includes(13), false, `${f.로컬}은 LF여야 서버에 그대로 깔린다`);
  }
});

test('원격 원문은 파이썬으로 읽히고, 짐은 한 번만 들어간다', () => {
  const 원문 = 설치.원격원문(설치.짐만들기('status'));
  assert.equal((원문.match(/__PAYLOAD__/g) || []).length, 0);
  assert.doesNotMatch(원문, /set -x|print\(P|print\(json\.dumps\(P/);
  const r = spawnSync(python, ['-X', 'utf8', '-c', 'import ast,sys;ast.parse(sys.stdin.read());print("ok")'], { input: 원문, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(r.stdout.trim(), 'ok', r.stderr);
});

test('미리 보기와 오류 글에 열쇠가 찍히지 않는다', () => {
  const env = 임시('.env', `TELEGRAM_BOT_TOKEN=${열쇠}\nTELEGRAM_ALLOWED_USERS=${설치.대화방}\n`);
  const 글 = JSON.stringify(설치.미리보기({ 열쇠파일: env, 장부파일: path.join(os.tmpdir(), '없는-장부.json') }));
  assert.doesNotMatch(글, /B{35}/);
  assert.match(글, /"헤르메스열쇠":"있음"/);
  assert.equal(설치.가리기(`실패 bot${열쇠}/sendMessage`), '실패 bot<열쇠>/sendMessage');
});
