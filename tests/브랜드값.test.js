// tests/브랜드값.test.js — 브랜드 킷 값을 지키는 회귀 «1벌» (유호 승인 08-20 「만들자」)
//
// 왜 있나: 압축(08-20 · 테스트 237→9)으로 킷을 지키던 회귀 3벌이 사라져, 4대 자산 중
//   킷만 기계 보호 0이 됐다. 유호님 픽으로 최소 1벌만 부활 — 3축만 본다.
//   ㉠ 킷 구조(41색 · 유효 hex · 이름 중복 0)
//   ㉡ 산출 동기(tools/토큰빌드.js build() ≡ docs/tools/synk-tokens.css · 줄끝 접기)
//   ㉢ 퇴역 회귀(무채축 0039209e 로 걷힌 네이비·크림 9색이 «값 자리»에 되살아나지 않는다)
//
// 이 장치가 틀릴 때의 모습: 킷을 «정당하게» 바꾸는 커밋(유호 확정)이 ㉠·㉢에서 빨개진다 —
//   그때는 킷수·퇴역 목록을 같은 커밋에서 갱신한다(각 에러 메시지가 그 처방을 낸다).
//   퇴역 검사를 저장소 전역으로 넓히지 않는다 — 구→신 매핑 «기록» 속 hex 는 정당하다(실측:
//   전역 검사는 시작부터 거짓 적색이었다 · 값 자리 두 파일만 본다).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { 표기접기 } = require('./lib/소스검사.js');
const { build } = require('../tools/토큰빌드.js');

const ROOT = path.resolve(__dirname, '..');
const 토큰경로 = path.join(ROOT, 'docs', '디자인_토큰.json');
const CSS경로 = path.join(ROOT, 'docs', 'tools', 'synk-tokens.css');
const 토큰 = require(토큰경로);

// 2027 「내일 꾸러미」 41색(조항 ⓙ) + 다크 「양모 밤」의 바탕 Ink Deep 1색(조항 ⓚ · 유호 확정 08-20)
const 킷수 = 42;
const 퇴역 = [ // 무채축(0039209e)으로 걷힌 네이비·크림 — 값 자리 실측 0건에서 출발(08-20 선별)
  '#131A32', '#171820', '#1A2340', '#2A3358', '#5F657D',
  '#E7DDC7', '#EFE7D7', '#F6F1E8', '#FBF7EE',
];

/** 원문에서 퇴역 색을 찾는다 — 대소문자를 접는다(사람은 소문자 hex 도 쓴다 · 맹점 ①). */
function 퇴역검출(원문) {
  const 접은원문 = String(원문).toUpperCase();
  return 퇴역.filter((h) => 접은원문.includes(h));
}

test('㉠ 킷 구조 — 41색 · 유효 hex · 이름 중복 0', () => {
  assert.strictEqual(
    토큰.색.킷.length, 킷수,
    `킷이 ${킷수}색이 아니다(지금 ${토큰.색.킷.length}) — 킷 개편이 유호님 확정이면 이 파일의 킷수를 같은 커밋에서 갱신하라`,
  );
  // 다크가 실제로 「양모 밤」을 가리키는가 — 이름이 바뀌면 무채로 되돌아간 것이다(조항 ⓚ)
  const 다크 = 토큰.색.시맨틱.다크;
  assert.strictEqual(다크.바탕, 'Ink Deep', '다크 바탕이 양모 밤(Ink Deep)이 아니다 — 무채로 되돌아갔는지 본다');
  assert.strictEqual(다크.카드, 'Ink', '다크 카드가 Ink 가 아니다 — 「낮의 글자가 밤의 면」 구조가 깨졌다');
  for (const 칸 of ['안내_면', '정답_면', '보상_면', '기념_면', '안내_글자', '정답_글자', '보상_글자', '기념_글자']) {
    assert.ok(다크[칸], `다크에 2027 역할 칸 「${칸}」이 없다 — 앱이 역할 어휘를 잃는다`);
  }
  const 이름들 = new Set();
  for (const c of 토큰.색.킷) {
    assert.match(c.hex, /^#[0-9A-Fa-f]{6}$/, `킷 「${c.이름}」의 hex 형식이 깨졌다: ${c.hex}`);
    assert.ok(!이름들.has(c.이름), `킷 이름이 중복된다: ${c.이름} — 시맨틱 참조(hexOf)가 어느 쪽인지 모르게 된다`);
    이름들.add(c.이름);
  }
});

test('㉡ 산출 동기 — synk-tokens.css ≡ 토큰빌드 산출 (줄끝 접기)', () => {
  assert.ok(fs.existsSync(CSS경로), 'docs/tools/synk-tokens.css 가 없다 — node tools/토큰빌드.js 로 생성하라');
  const 디스크 = fs.readFileSync(CSS경로, 'utf8');
  assert.strictEqual(
    표기접기(디스크), 표기접기(build()),
    'synk-tokens.css 가 토큰 정본과 어긋난다 — node tools/토큰빌드.js 로 재생성하라(산출물을 손으로 고치면 다음 생성이 되돌린다)',
  );
});

test('㉢ 퇴역 회귀 — 걷어낸 색이 값 자리에 되살아나지 않는다', () => {
  for (const 경로 of [토큰경로, CSS경로]) {
    const 잡힘 = 퇴역검출(fs.readFileSync(경로, 'utf8'));
    assert.deepStrictEqual(
      잡힘, [],
      `퇴역 색 ${잡힘.join('·')} 이 ${path.relative(ROOT, 경로)} 에 되살아났다 — 무채축(0039209e)으로 걷힌 값이다. 정당한 복귀면 유호님 확정과 함께 이 목록에서 빼라`,
    );
  }
});

test('㉢-탐지력 — 픽스처에 심은 퇴역 색을 실제로 문다 (소문자 포함)', () => {
  // 실저장소가 깨끗해도 매처가 살아 있음을 여기서 증명한다(맹점 ② — 버그를 요구하는 회귀 금지).
  const 심은것 = 퇴역[0].toLowerCase();
  const 픽스처 = `:root{ --유령:${심은것}; }`;
  assert.deepStrictEqual(퇴역검출(픽스처), [퇴역[0]], `탐지 규칙이 픽스처의 퇴역 색(${심은것})을 못 문다`);
  assert.deepStrictEqual(퇴역검출(':root{ --정상:#F96859; }'), [], '탐지 규칙이 현행 킷 색(Coral)을 잘못 문다');
});
