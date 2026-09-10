'use strict';

// 실제 학생 자료·Apps Script·외부 API 없이 정본 반출 함수를 실행한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', '엔진_수집.js'), 'utf8').replace(/\r\n/g, '\n');
const names = ['골든픽스처_', 'exportGoldenFixture_', 'pushGoldenFixture_', '증언반출_'];
function declaration(name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}\n', start);
  assert.ok(start >= 0 && end > start, `${name} 선언을 찾지 못함`);
  return source.slice(start, end + 2);
}

function harness(properties = {}) {
  const calls = [];
  const forbidden = (name) => () => {
    calls.push(name);
    throw new Error(`반출 중지 상태에서 실행하면 안 되는 단계: ${name}`);
  };
  const sheet = { getSheetByName: forbidden('학생 시트 읽기') };
  const scope = {
    SpreadsheetApp: { getActiveSpreadsheet: forbidden('스프레드시트 열기') },
    DriveApp: { createFile: forbidden('Drive 파일 생성') },
    UrlFetchApp: { fetch: forbidden('외부 요청') },
    명단이름_: forbidden('학생 명단 읽기'),
    골든전송점검_: forbidden('GitHub 연결 점검'),
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (name) => {
          calls.push(`속성:${name}`);
          if (name === 'GITHUB_TOKEN_SYNKTALK') throw new Error('중지 상태에서 자격증명을 읽으면 안 됨');
          return properties[name] || '';
        },
      }),
    },
    // 기존 개인 학습 동의가 모두 yes여도 개발·공개 동의가 되지 않는다.
    voiceConsentRead_: () => ({ 'synthetic-student': 'yes' }),
    voiceConsentMap_: () => ({ 'synthetic-student': 'yes' }),
    CONSENT_VERSION: 'v19',
    GH_TOKEN_KEY: 'GITHUB_TOKEN_SYNKTALK',
  };
  vm.createContext(scope);
  vm.runInContext(names.map(declaration).join('\n'), scope);
  return { scope, sheet, calls };
}

function blocked(value) {
  assert.equal(typeof value, 'string');
  assert.match(value, /반출은 중지/);
  assert.match(value, /기록된 명시적 동의/);
  assert.match(value, /철회 상태/);
  assert.match(value, /학습용 일반 동의/);
}

test('평가자료 조립은 학생 원문·명단을 읽기 전에 중지하고 이유만 반환한다', () => {
  const h = harness();
  blocked(h.scope.골든픽스처_());
  assert.deepEqual(h.calls, []);
});

test('증언 반출은 학생·보호자 답을 읽지 않고 기존 실패값 null을 반환한다', () => {
  const h = harness();
  assert.equal(h.scope.증언반출_(h.sheet), null);
  assert.equal(h.scope.증언반출_(), null);
  assert.deepEqual(h.calls, []);
});

test('일반 동의 yes·운영자 인자·임의 설정은 두 반출 출구를 허용하지 않는다', () => {
  const h = harness({ GOLDEN_PUBLIC_EXIT: 'on', DEVELOPMENT_CONSENT: 'yes', TESTIMONY_EXPORT: 'on' });
  const unverifiedClaim = { consent: 'yes', developmentConsent: true, approved: true };
  blocked(h.scope.골든픽스처_(unverifiedClaim));
  assert.equal(h.scope.증언반출_(h.sheet, unverifiedClaim), null);
  assert.deepEqual(h.calls, []);
});

test('내 드라이브 메뉴가 쓰는 출구도 차단 이유만 반환하며 JSON 파일을 만들지 않는다', () => {
  const h = harness();
  blocked(h.scope.exportGoldenFixture_());
  assert.deepEqual(h.calls, []);
});

test('공개 출구 스위치가 켜져 있어도 토큰 조회·연결 점검·공개 저장소 쓰기로 진행하지 않는다', () => {
  const h = harness({ GOLDEN_PUBLIC_EXIT: 'on' });
  blocked(h.scope.pushGoldenFixture_());
  assert.deepEqual(h.calls, ['속성:GOLDEN_PUBLIC_EXIT']);
});

test('공개 출구가 꺼진 안내는 내 드라이브 반출까지 가능하다고 약속하지 않는다', () => {
  const h = harness();
  const result = h.scope.pushGoldenFixture_();
  assert.match(result, /공개 저장소 출구는 꺼져/);
  assert.match(result, /내 드라이브.*중지/);
  assert.match(result, /학생 원문 반출을 허용하지 않습니다/);
  assert.deepEqual(h.calls, ['속성:GOLDEN_PUBLIC_EXIT']);
});
