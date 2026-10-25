'use strict';
// Argon 역할 목록은 tools/argon-schedules/configuration/docs.json 한 곳이 원천이다(10-22). 저장소를 볼 수 있는
// PC 쪽(헤르메스 감시·월요일 스캔 읽기·Argon백업.js)은 그 파일을 읽는다. 조사 서버에 손으로 올리는 파일은 저장소를
// 못 봐서 목록을 따로 들고 있으니, 역할을 더하거나 뺄 때 고칠 자리를 이 시험이 모두 짚는다(10-20에 역할 셋을 더하자
// 손으로 적은 목록 둘 때문에 백업 둘이 같은 날 깨졌다).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ARGON = path.join(ROOT, 'tools', 'argon-schedules');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const ROLES = Object.keys(JSON.parse(read('tools/argon-schedules/configuration/docs.json'))).sort();
const sorted = values => [...new Set(values)].sort();
const quoted = text => [...text.matchAll(/'([a-z][a-z0-9-]{1,30})'/g)].map(match => match[1]);

test('docs.json은 역할 이름 → 문서 ID 하나짜리 평평한 표다', () => {
  const docs = JSON.parse(read('tools/argon-schedules/configuration/docs.json'));
  assert.ok(ROLES.length >= 4);
  for (const [role, id] of Object.entries(docs)) {
    assert.match(role, /^[a-z][a-z0-9-]{1,30}$/);
    assert.match(id, /^[A-Za-z0-9_-]{20,100}$/, role);
  }
});

test('조사 서버에 손으로 올리는 파일의 역할 목록이 docs.json과 같다', () => {
  const runCheck = read('tools/argon-schedules/run-check.py').match(/if role not in \(([^)]*)\)/);
  assert.ok(runCheck, 'run-check.py 역할 검사 줄');
  assert.deepEqual(sorted(quoted(runCheck[1])), ROLES, 'run-check.py');

  const account = read('tools/argon-schedules/agy-account.py').match(/^ROLES = \(([^)]*)\)/m);
  assert.ok(account, 'agy-account.py ROLES');
  assert.deepEqual(sorted(quoted(account[1])), ROLES, 'agy-account.py');

  const alert = read('tools/argon-schedules/alert-event.py').match(/for role in \(([^)]*)\)\}/);
  assert.ok(alert, 'alert-event.py UNITS');
  assert.deepEqual(sorted(quoted(alert[1])), ROLES, 'alert-event.py');

  const docsIo = read('tools/argon-schedules/docs-io.py');
  const fixed = docsIo.match(/FIXED_DOCS = \{([\s\S]*?)\n\}/), weekly = docsIo.match(/WEEKLY_ROLES = \(([^)]*)\)/);
  assert.ok(fixed && weekly && /ROLES = frozenset\(\(\*FIXED_DOCS, 'synkbrief', \*WEEKLY_ROLES\)\)/.test(docsIo), 'docs-io.py ROLES 꼴');
  assert.deepEqual(sorted([...quoted(fixed[1]).filter(value => !/^[A-Za-z0-9_-]{30,}$/.test(value)), 'synkbrief', ...quoted(weekly[1])]), ROLES, 'docs-io.py');

  const loop = read('tools/argon-schedules/synk-argon-ultra.logrotate').match(/for role in ([a-z0-9 -]+); do/);
  assert.ok(loop, 'logrotate 역할 반복');
  assert.deepEqual(sorted(loop[1].trim().split(/\s+/).filter(role => role !== 'validation')), ROLES, 'logrotate');

  const filter = JSON.parse(read('tools/argon-schedules/alert-policy.json')).conditions[0].conditionMatchedLog.filter;
  const alternation = filter.match(/jsonPayload\.role=~"\^\(([a-z0-9|-]+)\)\$"/);
  assert.ok(alternation, 'alert-policy.json 역할 조건');
  assert.deepEqual(sorted(alternation[1].split('|')), ROLES, 'alert-policy.json(운영 정책도 같은 목록으로 PATCH 해야 한다)');

  const capture = JSON.parse(read('tools/server-backup/argon-capture.py').match(/EXPECTED_DOCS=(\{[^}]*\})/)[1]);
  assert.deepEqual(capture, JSON.parse(read('tools/argon-schedules/configuration/docs.json')), 'argon-capture.py EXPECTED_DOCS');
});

test('꺼 둔 역할 목록(paused.json)은 docs.json 역할 → 끈 날이고, README 예약 표가 같은 역할만 「꺼 둠」으로 적는다', () => {
  const paused = JSON.parse(read('tools/argon-schedules/configuration/paused.json'));
  assert.ok(paused && typeof paused === 'object' && !Array.isArray(paused));
  for (const [role, since] of Object.entries(paused)) {
    assert.ok(ROLES.includes(role), 'docs.json에 없는 역할 ' + role);
    assert.match(since, /^\d{4}-\d{2}-\d{2}$/, role);
  }
  const readme = read('tools/argon-schedules/README.md');
  for (const role of ROLES) {
    const row = readme.match(new RegExp('^\\| `' + role + '` \\|([^\\n]*)\\|$', 'm'));
    assert.ok(row, 'README 예약 표의 ' + role + ' 줄');
    assert.equal(row[1].includes('꺼 둠'), role in paused, 'README 예약 표 ' + role + '(꺼 두거나 다시 켜면 표와 paused.json을 함께 고친다)');
  }
});

test('역할마다 예약 단위·입력·프롬프트가 있고 남는 것이 없다', () => {
  const units = fs.readdirSync(path.join(ARGON, 'production-units'));
  for (const kind of ['service', 'timer']) {
    const roles = units.map(name => name.match(new RegExp('^synk-argon-ultra-(.+)\\.' + kind + '$'))?.[1]).filter(Boolean);
    assert.deepEqual(sorted(roles), ROLES, 'production-units *.' + kind);
  }
  const inputs = fs.readdirSync(path.join(ARGON, 'production-inputs'));
  for (const suffix of ['.input.jsonl', '.prompt.txt']) {
    assert.deepEqual(sorted(inputs.filter(name => name.endsWith(suffix)).map(name => name.slice(0, -suffix.length))), ROLES, 'production-inputs *' + suffix);
  }
});
