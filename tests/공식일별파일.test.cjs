'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const tool = path.resolve(__dirname, '../tools/계정통계예약/공식일별파일.py');
const python = process.platform === 'win32' ? 'python' : 'python3';

function csvFixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-official-daily-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return (csv, overrides = {}) => {
    const file = 'traffic.csv';
    const meta = {
      format: 'substack-traffic', accountId: 'synklab-substack', observedHandle: 'synklab.substack.com',
      sourceUrl: 'https://synklab.substack.com/publish/stats/traffic', observedAt: '2025-02-05T10:00:00+09:00',
      start: '2025-02-01', end: '2025-02-05', completeThrough: '2025-02-04',
      evidenceFile: file, evidenceSha256: createHash('sha256').update(csv).digest('hex'), ...overrides
    };
    fs.writeFileSync(path.join(dir, file), csv);
    const metadata = path.join(dir, 'capture.json');
    fs.writeFileSync(metadata, JSON.stringify(meta));
    return spawnSync(python, ['-B', '-X', 'utf8', tool, metadata], { encoding: 'utf8' });
  };
}

test('공식 CSV의 빠진 날짜와 빈 값은 제외하고 실제 0은 보존한다', t => {
  const run = csvFixture(t);
  const result = run('\uFEFFDate,Views\r\n2025/02/01,6\r\n2025/02/03,\r\n2025/02/04,0\r\n2025/02/05,8\r\n');
  assert.equal(result.status, 0, result.stderr);
  const { envelope } = JSON.parse(result.stdout).batches[0];
  assert.equal(envelope.sourceType, 'official-export');
  assert.equal(envelope.observedAt, '2025-02-05T10:00:00+09:00');
  assert.deepEqual(envelope.observations.map(o => [o.period.start, o.period.end, o.metrics]), [
    ['2025-02-01', '2025-02-01', { views: 6 }], ['2025-02-04', '2025-02-04', { views: 0 }]
  ]);
  assert.ok(envelope.observations.every(o => !Object.hasOwn(o.labels, 'timeZone')));
});

test('소유자와 파일이 다르거나 날짜와 열을 확정할 수 없으면 입력 목록을 만들지 않는다', t => {
  const run = csvFixture(t);
  const valid = 'Date,Views\n2025/02/01,6\n';
  const cases = [
    [valid, { observedHandle: 'other.substack.com' }],
    [valid, { sourceUrl: 'https://other.substack.com/publish/stats/traffic' }],
    [valid, { evidenceSha256: '0'.repeat(64) }],
    [valid, { completeThrough: '2025-02-05' }],
    [valid + '2025/02/01,4\n', {}],
    [valid + '2025/01/31,1\n', {}],
    ['Date,Reach\n2025/02/01,6\n', {}]
  ];
  for (const [csv, overrides] of cases) {
    const result = run(csv, overrides);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /공식 파일을 변환하지 못했습니다/u);
    assert.equal(result.stdout, '');
  }
});

test('더우인 공식 파일의 일별 조회수와 팔로워 유입·이탈을 각각 해석한다', () => {
  const script = [
    'import datetime, json, runpy, sys',
    'm = runpy.run_path(sys.argv[1])',
    'date = datetime.date(2025, 2, 1)',
    'def metrics(kind, cells):',
    '    header = m["SOURCES"][kind][0]',
    '    return m["observations"]([header, [date] + cells], kind, date, date, date)[0]["metrics"]',
    'print(json.dumps([metrics("douyin-posts", [1, 7, None, 0, 2]), metrics("douyin-followers", [10, 1, 2, 1, 3])]))'
  ].join('\n');
  const result = spawnSync(python, ['-B', '-X', 'utf8', '-c', script, tool], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [
    { postsPublished: 1, views: 7, shares: 0, comments: 2 }, { followersGained: 2, followersLost: 1 }
  ]);
});
