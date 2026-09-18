'use strict';

// migrateInflowChannels0918 — 라이브 폼을 새로 만들지 않고 인지채널 선택지에 유튜브·텔레그램을 끼운다.
// 폼·시트는 전부 가짜다. 실제 Google 서비스를 부르지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '엔진_폼리포트.js'), 'utf8');
const START = SRC.indexOf('function migrateInflowChannels0918()');
const CLOSE = /\r?\n\}\r?\n/g;
CLOSE.lastIndex = START;
const END = START >= 0 && CLOSE.exec(SRC) ? CLOSE.lastIndex : -1;
const BODY = END > START ? SRC.slice(START, END) : '';
test('이관 함수를 파일에서 찾는다', () => assert.ok(BODY.length > 0, 'migrateInflowChannels0918 을 찾지 못했다'));
const 열칸 = ['페이스북', '인스타', '틱톡', '유튜브', '텔레그램', '추천', '오픈데이', '학교제휴', '워크인', '기타'];

function harness(forms) {
  const state = { 상담폼ID: forms.상담 ? 'F-consult' : '', 리드폼ID: forms.리드 ? 'F-lead' : '' };
  const byId = { 'F-consult': forms.상담, 'F-lead': forms.리드 };
  const set = [];
  let validation = null;
  const MC = 'MULTIPLE_CHOICE';
  const item = form => ({
    getTitle: () => form.title || '인지채널',
    getType: () => MC,
    asMultipleChoiceItem: () => ({
      getChoices: () => form.choices.map(v => ({ getValue: () => v })),
      setChoiceValues: values => { set.push([form.name, values]); form.choices = values.slice(); },
    }),
  });
  const env = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({}),
      newDataValidation: () => {
        const b = { list: null, requireValueInList(l) { b.list = l; return b; }, setAllowInvalid() { return b; }, build() { return { list: b.list }; } };
        return b;
      },
    },
    FormApp: { ItemType: { MULTIPLE_CHOICE: MC }, openById: id => ({ getItems: () => [item(byId[id])] }) },
    ensureSheet: () => ({}),
    getState: (_st, key) => ({ val: state[key] }),
    bizSheets_: () => ({ ld: { getRange: () => ({ setDataValidation: dv => { validation = dv.list; } }) } }),
    Logger: { log: () => {} },
  };
  const run = new Function(...Object.keys(env), BODY + '\nreturn migrateInflowChannels0918();');
  return { run: () => run(...Object.values(env)), set, validation: () => validation };
}

test('옛 8칸 폼 둘에 유튜브·텔레그램을 제자리에 끼우고 leads 규칙도 10칸으로 건다', () => {
  const 옛칸 = ['페이스북', '인스타', '틱톡', '추천', '오픈데이', '학교제휴', '워크인', '기타'];
  const h = harness({ 상담: { name: '상담', choices: [...옛칸] }, 리드: { name: '리드', choices: [...옛칸] } });
  const report = h.run();
  assert.equal(h.set.length, 2);
  for (const [, values] of h.set) assert.deepEqual(values, 열칸);
  assert.deepEqual(h.validation(), 열칸);
  assert.match(report, /상담폼: 8칸 → 10칸/);
});

test('다시 돌려도 바꾸지 않는다 — 이미 10칸이면 손대지 않는다', () => {
  const h = harness({ 상담: { name: '상담', choices: [...열칸] }, 리드: { name: '리드', choices: [...열칸] } });
  const report = h.run();
  assert.equal(h.set.length, 0);
  assert.match(report, /상담폼: 이미 있음/);
  assert.match(report, /리드폼: 이미 있음/);
});

test('목록 밖에 따로 넣어 둔 선택지는 지우지 않고 뒤에 남긴다 · 연결 안 된 폼은 건너뛴다', () => {
  const h = harness({ 상담: { name: '상담', choices: ['페이스북', '광고', '기타'] } });
  const report = h.run();
  assert.deepEqual(h.set[0][1], ['페이스북', '유튜브', '텔레그램', '기타', '광고']);
  assert.match(report, /리드폼: 리드폼ID 미연결 — 건너뜀/);
});

test('함수 안의 목록은 폼·카드와 같은 열 칸이다', () => {
  const m = /const 채널 = (\[[^\]]*\])/.exec(BODY);
  assert.ok(m, '함수에서 목록을 찾지 못했다');
  assert.deepEqual(JSON.parse(m[1].replace(/'/g, '"')), 열칸);
});
