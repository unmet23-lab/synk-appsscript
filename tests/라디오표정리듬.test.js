'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { 만들기, 시드난수 } = require('../bots/오버레이/라디오표정리듬.js');

function 보기(fps, duration, options = {}) {
  const 리듬 = 만들기({ seed: 37 });
  const 변화 = [], 전부 = [];
  for (let index = 0; index <= duration * fps / 1000; index++) {
    const ms = index * 1000 / fps;
    const 상태 = 리듬.읽기(ms, options);
    const row = { ms, ...상태 };
    전부.push(row);
    if (!변화.length || 변화[변화.length - 1].표정 !== row.표정) 변화.push(row);
  }
  return { 변화, 전부 };
}

for (const fps of [3, 4, 6]) {
  test(`${fps}fps: 폐안을 건너뛰지 않고 표정/기본의 머무는 시간을 유지한다`, () => {
    const { 변화, 전부 } = 보기(fps, 180000);
    const 폐안 = 변화.filter(row => row.단계 === '깜빡');
    const 얼굴 = 변화.filter(row => row.단계 === '표정');
    assert.ok(폐안.length >= 20);
    assert.ok(얼굴.length >= 8);
    for (const row of 폐안) {
      assert.ok(row.끝ms - row.시작ms >= 350 && row.끝ms - row.시작ms <= 390);
      const frames = 전부.filter(frame => frame.시작ms === row.시작ms && frame.단계 === '깜빡');
      assert.ok(frames.length >= 2, '완료되지 않은 첫 폐안도 캡처 두 장 이상에 남는다');
    }
    for (let i = 0; i + 1 < 변화.length; i++) {
      const row = 변화[i], next = 변화[i + 1];
      if (row.단계 === '표정') assert.ok(next.ms - row.ms >= 1400, '비깜빡 표정이 휙 지나가지 않는다');
      if (row.단계 === '기본') assert.ok(next.ms - row.ms >= 1000, '표정 사이 기본 얼굴에서 안정된다');
    }
    for (let i = 1; i < 얼굴.length; i++) assert.notEqual(얼굴[i].표정, 얼굴[i - 1].표정);
    const 이름들 = 얼굴.map(row => row.표정);
    assert.ok(new Set(이름들.slice(0, 5)).size < 5, '다섯 얼굴을 빠짐없이 순서대로 순환하지 않는다');
  });
}

test('60fps 브라우저와 별개인 3/4/6fps 캡처가 어느 위상에서도 폐안을 담는다', () => {
  const { 전부 } = 보기(60, 180000);
  const 완결폐안 = new Set(전부.filter(row => row.단계 === '깜빡' && row.끝ms < 179500).map(row => row.시작ms));
  for (const fps of [3, 4, 6]) {
    for (const offset of [0, 57, 191]) {
      const 보인폐안 = new Set();
      for (let index = 0; ; index++) {
        const ms = offset + index * 1000 / fps;
        if (ms > 180000) break;
        const frame = 전부[Math.floor(ms * 60 / 1000)];
        if (frame.단계 === '깜빡') 보인폐안.add(frame.시작ms);
      }
      for (const 시작 of 완결폐안) assert.ok(보인폐안.has(시작), `${fps}fps/${offset}ms 위상에서 ${시작}ms 깜빡 누락`);
    }
  }
});

test('800ms 지연: 예정 시간이 지나도 실제 관측 틱부터 350~390ms 눈을 감는다', () => {
  const 리듬 = 만들기({ random: () => 0.5 });
  const 첫 = 리듬.읽기(0);
  const 늦은시각 = 첫.다음깜빡ms + 800;
  const 시작 = 리듬.읽기(늦은시각);
  assert.equal(시작.단계, '깜빡');
  assert.equal(시작.시작ms, 늦은시각);
  assert.equal(시작.끝ms, 늦은시각 + 370);
  assert.equal(리듬.읽기(늦은시각 + 333).표정, '깜빡');
  assert.equal(리듬.읽기(늦은시각 + 400).표정, '기본');
});

test('밤에도 눈을 뜨고 얼굴이 변하되 낮보다 간격이 길다', () => {
  const 낮 = 보기(4, 180000);
  const 밤 = 보기(4, 180000, { 밤: true });
  const count = (view, phase) => view.변화.filter(row => row.단계 === phase).length;
  assert.ok(count(밤, '표정') >= 4);
  assert.ok(count(밤, '깜빡') >= 10);
  assert.ok(count(밤, '표정') < count(낮, '표정'));
  assert.ok(count(밤, '깜빡') < count(낮, '깜빡'));
  assert.ok(밤.전부.filter(row => row.표정 === '기본').length / 밤.전부.length > 0.7);
});

test('반응/차림 교대 중단 후 오래된 표정을 재생하지 않고 기본에서 재개한다', () => {
  const 리듬 = 만들기({ seed: 4 });
  const 첫 = 리듬.읽기(0);
  assert.equal(리듬.읽기(첫.다음깜빡ms).표정, '깜빡');
  assert.equal(리듬.중단(첫.다음깜빡ms + 50).단계, '중단');
  const 쉬는중 = 리듬.읽기(300000, { 밤: true, 중단: true });
  assert.equal(쉬는중.표정, null);
  assert.equal(쉬는중.다음깜빡ms, null);
  const 복귀 = 리듬.읽기(300001, { 밤: true, 중단: false });
  assert.equal(복귀.표정, '기본');
  assert.ok(복귀.다음깜빡ms >= 300001 + 4800);
  assert.equal(리듬.읽기(302001, { 밤: true, 중단: false }).표정, '기본');
});

test('존재하는 얼굴만 사용하고 컷이 적어도 유휴 시계가 계속 진행한다', () => {
  const 리듬 = 만들기({ seed: 1 });
  const 실제 = new Set();
  for (let ms = 0; ms < 60000; ms += 250) {
    const row = 리듬.읽기(ms, { 가능표정: ['기본', '집중'] });
    assert.ok(['기본', '집중'].includes(row.표정));
    실제.add(row.표정);
  }
  assert.deepEqual([...실제], ['기본', '집중']);
});

test('난수 주입과 브라우저 전역이 Node와 같은 재현 가능한 상태를 낸다', () => {
  const a = 시드난수(77), b = 시드난수(77);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../bots/오버레이/라디오표정리듬.js'), 'utf8'), context);
  const browser = context.라디오표정리듬.만들기({ seed: 4 });
  const node = 만들기({ seed: 4 });
  for (let ms = 0; ms < 30000; ms += 250) {
    assert.deepEqual(JSON.parse(JSON.stringify(browser.읽기(ms))), node.읽기(ms));
  }
  assert.throws(() => node.읽기(100), /이전 시각/);
});
