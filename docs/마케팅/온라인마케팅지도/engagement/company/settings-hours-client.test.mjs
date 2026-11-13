// 설정 화면 · 전체 수집 시각(하루 한 번/두 번, 11-13) — app.js의 도우미 세 줄과 저장 분기만 잘라 읽는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('./public/app.js', import.meta.url), 'utf8');
const line = prefix => { const found = app.split('\n').find(row => row.startsWith(prefix)); assert.ok(found, prefix); return found; };
function helpers() {
  const context = {};
  vm.createContext(context);
  vm.runInContext([line('function settingsHours('), line('function settingsHoursPayload('), line('function settingsHoursFields(')].join('\n')
    + '\n;Object.assign(globalThis,{settingsHours,settingsHoursPayload,settingsHoursFields});', context);
  return context;
}
const selected = (html, name) => { const select = html.match(new RegExp(`<select name="${name}">([\\s\\S]*?)</select>`))[1]; return select.match(/<option value="(\d*)" selected/)?.[1]; };

test('서버 설정을 사실대로 보인다: hoursKst가 있으면 그대로, 옛 설정(hourKst만)은 하루 한 번, 설정이 없을 때만 09 · 21', () => {
  const { settingsHours, settingsHoursFields } = helpers();
  assert.deepEqual([...settingsHours({ hourKst: 9, hoursKst: [21, 9] })], [9, 21]);
  assert.deepEqual([...settingsHours({ hourKst: 9 })], [9, null], '옛 설정을 두 번으로 부풀리지 않는다');
  assert.deepEqual([...settingsHours({})], [9, 21]);
  assert.deepEqual([...settingsHours({ hoursKst: [7] })], [7, null]);
  assert.deepEqual([...settingsHours({ hoursKst: [25, 'x', 8] })], [8, null], '0~23 정수만');
  const two = settingsHoursFields({ hoursKst: [9, 21] });
  assert.equal(selected(two, 'hourKst'), '9');
  assert.equal(selected(two, 'hourKst2'), '21');
  assert.doesNotMatch(two, /지금 서버 설정은 하루 한 번/);
  const old = settingsHoursFields({ hourKst: 10 });
  assert.equal(selected(old, 'hourKst'), '10');
  assert.equal(selected(old, 'hourKst2'), '', '둘째 시각은 「없음」');
  assert.match(old, /지금 서버 설정은 하루 한 번이에요/);
  assert.match(old, /<option value="" selected>없음 · 하루 한 번<\/option>/);
  assert.doesNotMatch(two + old, /\sstyle=/, 'CSP: style 속성 없음');
});

test('저장은 hoursKst 배열을 보낸다: 없음 → 한 번, 같은 시각 → 한 번, 순서는 오름차순', () => {
  const { settingsHoursPayload } = helpers();
  assert.deepEqual([...settingsHoursPayload({ hourKst: '9', hourKst2: '21' })], [9, 21]);
  assert.deepEqual([...settingsHoursPayload({ hourKst: '21', hourKst2: '9' })], [9, 21]);
  assert.deepEqual([...settingsHoursPayload({ hourKst: '9', hourKst2: '' })], [9]);
  assert.deepEqual([...settingsHoursPayload({ hourKst: '9', hourKst2: '9' })], [9]);
  assert.deepEqual([...settingsHoursPayload({ hourKst: '0' })], [0]);
  assert.throws(() => settingsHoursPayload({ hourKst: '' }));
});

test('설정 화면은 두 칸과 켜짐을 그리고, 저장 분기는 hoursKst와 첫 시각을 함께 보낸다', () => {
  assert.match(app, /자동 수집 \(정한 시각마다 전체 \+ 30분마다 최근 게시물\)<\/span><\/label>\$\{settingsHoursFields\(schedule\)\}/);
  assert.doesNotMatch(app, /하루 한 번 전체 수집할 시각/);
  const save = line("      case 'settings':");
  assert.match(save, /const hoursKst = settingsHoursPayload\(values\); await api\('\/api\/settings', \{ companyName: values\.companyName, hourKst: hoursKst\[0\], hoursKst, enabled: values\.enabled === 'on' \}\)/);
});
