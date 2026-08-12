// 삼성서비스 회귀 — 「못 읽은 것」을 「꺼져 있는 것」으로 세지 않는다.
//
// 이 도구가 틀리는 방향은 언제나 **초록**이다: 파싱이 어긋나면 값이 null 이 되고, null 을
// 「이상 없음」으로 세면 되살아난 서비스가 표에서 사라진 채 「전부 ✅」가 나온다. 그래서
// 탐지력은 전부 픽스처가 지고(실기계 검사는 아래에서 skip 으로 드러낸다) 급소 셋을 못박는다:
//   ① 값 이름이 정확히 `Start` 여야 한다 — 같은 키의 형제 값 `StartOverride` 를 읽으면 안 된다
//   ② Start 줄이 없으면 null 이고, null 은 ✅ 가 아니라 ❔(모름)다
//   ③ 한국어 Windows 의 reg.exe 오류문은 CP949 라 깨져서 들어온다 — 글자로 판별하면 안 된다
//
// 실기계 검사(`reg`)는 **Windows 에서만** 성립한다. CI 러너는 Linux 라 `reg` 가 없다 —
// 없는 곳에서 fail 이 아니라 skip 으로 드러낸다(CLAUDE.md 「repo 밖 환경에 기대는 검사」).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const S = require('../tools/삼성서비스.js');

const 키 = 'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\DqaService';

test('정상 출력에서 Start 값을 뽑는다 — 0x4 도 0x00000004 도 4다', () => {
  assert.strictEqual(S.Start값파싱(`\n${키}\n    Start    REG_DWORD    0x4\n\n`), 4);
  assert.strictEqual(S.Start값파싱(`\n${키}\n    Start    REG_DWORD    0x00000004\n\n`), 4);
  assert.strictEqual(S.Start값파싱(`\n${키}\n    Start    REG_DWORD    0x2\n\n`), 2);
});

test('형제 값 `StartOverride` 를 시작 유형으로 읽지 않는다 — 느슨한 매칭의 오독은 「통과」로 보인다', () => {
  const out = `\n${키}\n    StartOverride    REG_DWORD    0x2\n\n`;
  assert.strictEqual(S.Start값파싱(out), null,
    'StartOverride 를 Start 로 읽었다 — 꺼진 서비스가 「되살아남」으로, 되살아난 것이 「꺼짐」으로 뒤집힌다');
});

test('Start 줄이 없으면 null 이고, null 은 ✅ 가 아니라 ❔ 다', () => {
  assert.strictEqual(S.Start값파싱(`\n${키}\n    ErrorControl    REG_DWORD    0x1\n\n`), null);
  const p = S.판정({ 값: null, 읽음: false });
  assert.strictEqual(p.표식, '❔', '못 읽은 것을 ✅ 로 셌다 — 분모가 조용히 줄어든다');
  assert.strictEqual(p.되돌릴것, false, '못 읽은 키에 처방을 내면 없는 키를 만들어 버린다');
});

test('깨진 CP949 오류문이 섞여도 크래시 없이 null — 오류문을 «글자»로 판별하지 않는다', () => {
  const 깨진 = Buffer.from('오류: 지정된 레지스트리 키 또는 값을 찾을 수 없습니다.', 'utf8').toString('latin1');
  assert.strictEqual(S.Start값파싱(깨진), null);
  assert.strictEqual(S.Start값파싱(''), null);
  assert.strictEqual(S.Start값파싱(null), null);
});

test('판정 — 4는 유지, 그 밖의 값은 전부 되돌릴 대상', () => {
  assert.strictEqual(S.판정({ 값: 4, 읽음: true }).되돌릴것, false);
  for (const v of [0, 1, 2, 3]) {
    const p = S.판정({ 값: v, 읽음: true });
    assert.strictEqual(p.되돌릴것, true, `Start=${v} 를 되돌릴 대상에서 빠뜨렸다`);
    assert.strictEqual(p.표식, '🔴');
  }
});

test('처방은 되살아난 줄만 담고 값은 4로 되돌린다 — 대상이 없으면 null', () => {
  const 행들 = [
    { 이름: 'DqaService', 되돌릴것: true },
    { 이름: 'Quick Search Service', 되돌릴것: true },   // 공백 있는 이름 = 따옴표가 필요한 자리
    { 이름: 'SmartSwitchService', 되돌릴것: false },
  ];
  const cmd = S.처방(행들);
  assert.match(cmd, /Services\\DqaService"/);
  assert.match(cmd, /Services\\Quick Search Service"/, '공백 이름이 따옴표 밖으로 새면 명령이 깨진다');
  assert.doesNotMatch(cmd, /SmartSwitchService/, '멀쩡한 서비스에 처방을 냈다');
  assert.strictEqual(cmd.split('\n').length, 2);
  assert.match(cmd, /-Value 4$/m, '되돌리기 방향이 뒤집혔다 — 4=사용 안 함 으로 «다시 끄는» 것이다');
  assert.strictEqual(S.처방([{ 이름: 'x', 되돌릴것: false }]), null);
});

test('명단 15개가 조용히 줄지 않는다 — 빠진 이름은 영원히 안 보인다', () => {
  assert.strictEqual(S.서비스들.length, 15, '08-12 에 끈 것은 15개다 — 줄었다면 왜 줄었는지가 커밋에 있어야 한다');
  assert.strictEqual(new Set(S.서비스들).size, 15, '중복이 있다');
});

// ── 실기계 보너스: reg 가 있는 Windows 에서만. 탐지력은 위 픽스처가 지고 여기선 거짓양성만 본다.
const 윈도 = process.platform === 'win32';
test('실기계 — 재기()가 15줄을 내고 각 줄이 읽음/판정을 갖춘다', { skip: 윈도 ? false : 'Windows 아님(reg 없음)' }, () => {
  const 행들 = S.재기();
  assert.strictEqual(행들.length, 15);
  for (const r of 행들) {
    assert.ok(['✅', '🔴', '❔'].includes(r.표식), `표식이 셋 중 하나가 아니다: ${r.이름}`);
    assert.strictEqual(r.읽음, r.값 !== null, `읽음 과 값 이 갈렸다: ${r.이름}`);
  }
});
