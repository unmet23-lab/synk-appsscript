/* 브라우저열기 — 계정으로 프로필을 고르는 자리의 회귀.
 *
 * 왜 이 축만 검사하나: 이 도구가 틀리는 방향은 하나뿐이다 — **딴 계정 창을 여는 것**.
 *   그건 F089 의 모양(같은 화면·로그인만 다름 → 오진단이 실측의 얼굴로 나온다)이라
 *   「열렸다」로는 안 드러난다. 실행부(spawn)는 OS 를 타므로 픽스처가 탐지력을 진다.
 * ⚠ 실저장소(유호님 PC)의 실제 프로필 구성을 검사하지 않는다 — 프로필은 유호님이 배치한
 *   환경이고, 거기 기대는 검사는 CI·다른 기계에서 거짓 적색이 된다(CLAUDE.md 신뢰성). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { 프로필찾기, 작업계정 } = require('../tools/브라우저열기.js');

const 픽스처 = {
  profile: {
    info_cache: {
      'Default': { name: '유호', user_name: '77yuhbs@gmail.com' },
      'Profile 1': { name: 'synk.im', user_name: 'founder@synk.im' },
      'Profile 2': { name: '유호', user_name: 'unmet23@gmail.com' },
      'Profile 3': { name: 'Met', user_name: 'unmet27@gmail.com' },
    },
  },
};

test('작업 계정의 프로필 폴더를 찾는다 — 이름이 겹쳐도 계정으로 가른다', () => {
  assert.equal(프로필찾기(픽스처, 'unmet23@gmail.com'), 'Profile 2');
});

test('한 글자 차이 계정을 안 집는다 — unmet23 / unmet27 은 화면에서 구별이 안 된다(☠️ AI_스택_가이드)', () => {
  assert.equal(프로필찾기(픽스처, 'unmet27@gmail.com'), 'Profile 3');
  assert.notEqual(프로필찾기(픽스처, 'unmet23@gmail.com'), 'Profile 3');
});

test('없는 계정이면 null — 「못 찾음」을 첫 프로필로 번역하지 않는다(폴백이 곧 딴 계정 창이다)', () => {
  assert.equal(프로필찾기(픽스처, 'nobody@gmail.com'), null);
  assert.equal(프로필찾기(픽스처, ''), null);
  assert.equal(프로필찾기(픽스처, null), null);
});

test('빈 Local State·깨진 모양에도 null — 못 읽은 것은 통과가 아니다', () => {
  assert.equal(프로필찾기({}, 작업계정), null);
  assert.equal(프로필찾기(null, 작업계정), null);
  assert.equal(프로필찾기({ profile: {} }, 작업계정), null);
});

test('대소문자·앞뒤 공백이 달라도 같은 계정으로 본다 — 크롬이 표기를 바꿔도 창이 안 갈린다', () => {
  const f = { profile: { info_cache: { 'Profile 9': { user_name: '  UNMET23@Gmail.com ' } } } };
  assert.equal(프로필찾기(f, 'unmet23@gmail.com'), 'Profile 9');
});

test('작업 계정 상수가 유호님 확정값이다 — 바뀌면 여기서 빨개진다(상시 지시 08-11)', () => {
  assert.equal(작업계정, 'unmet23@gmail.com');
});
