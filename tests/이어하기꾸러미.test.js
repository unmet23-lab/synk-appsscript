'use strict';
/* 이어하기 꾸러미 회귀 — 2026-09-05
 *
 * 무엇을 지키나: **자격증명이 클라우드 사본으로 새지 않는가.**
 *   이 도구는 저장소 파일을 원드라이브·구글드라이브로 복사한다. 두 곳 다 «남과 공유할 수 있는»
 *   자리이고, 한 번 올라간 것은 동기화가 여러 기기로 퍼뜨린다 — 되돌릴 수 없다.
 *   지금은 `git ls-files` 만 담아서 안전하지만, 담을 목록이 넓어지는 날(깃 밖 파일을 더하는 날)
 *   그 안전은 사라진다. 그때 «가드가 이미 서 있어야» 한다.
 *
 * 🔴 왜 «금지 목록»이 아니라 «가드 함수»를 재나: 목록을 재면 목록이 자기를 지킬 뿐이다.
 *   여기서 재는 것은 「이 이름을 넣었을 때 실제로 막히는가」다 — 자가 결함을 지키지 못하게.
 *   (기억 `test-guards-the-defect` 의 09-03 사고와 같은 통로)
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const { 금지인가, 문서인가 } = require(path.join(__dirname, '..', 'tools', '이어하기꾸러미.js'));
test('검사기 소스와 합성 시험 토큰을 보존하고 실제 문서의 키 대입은 차단한다', () => {
  const fs = require('node:fs');
  const { textPolicy } = require('../tools/이어하기꾸러미.js');
  assert.equal(textPolicy('tools/이어하기꾸러미.js', fs.readFileSync(path.join(__dirname, '../tools/이어하기꾸러미.js'))), null);
  assert.equal(textPolicy('tests/이어하기꾸러미.test.js', fs.readFileSync(__filename)), null);
  assert.equal(textPolicy('tests/rehearsal.test.js', Buffer.from('api_key: "synthetic-public"')), null);
  assert.equal(textPolicy('docs/rehearsal.md', Buffer.from('api_key: "synthetic-public"')), 'secret-literal');
  assert.equal(textPolicy('tests/rehearsal.test.js', Buffer.from('api_' + 'key: "unreviewed-secret-value"')), 'secret-literal');
});
test('핵심 자료 복사는 링크를 연결하고 재실행해도 중복을 만들지 않는다', t => {
  const fs = require('node:fs');
  const os = require('node:os');
  const { copy, within } = require('../tools/이어하기꾸러미.js');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-core-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const source = path.join(temp, 'source'), destination = path.join(temp, 'destination');
  fs.mkdirSync(path.join(source, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(source, 'docs/a.md'), '[원문](다른문서.md#기준)\n[외부](https://example.com)');
  const row = { brand: 'SYNK', source: 'docs/a.md', target: '정본/a.md', bytes: 10 };
  assert.equal(copy(source, destination, [row]).written, 1);
  const result = fs.readFileSync(path.join(destination, 'SYNK/정본/a.md'), 'utf8');
  assert.ok(result.includes('[원문](<' + path.join(source, 'docs/다른문서.md').replace(/\\/g, '/') + '#기준>)'));
  assert.ok(result.includes('[외부](https://example.com)'));
  assert.equal(copy(source, destination, [row]).unchanged, 1);
  assert.throws(() => within(source, '../escape.md'));
  assert.throws(() => copy(source, destination, [{ ...row, target: '../../escape.md' }]));
  assert.throws(() => copy(source, destination, [{ ...row, source: '.env' }]));
});

test('자격증명 무늬는 담을 목록에 못 든다', () => {
  const 막혀야하는것 = [
    'SYNK_보안/로그인.txt',
    'C:\\Users\\q1212\\SYNK_보안\\제미나이.txt',
    'docs/로그인.txt',
    'tools/비밀번호모음.md',
    'config/password.json',
    'PASSWORD.txt',
    '.env',
    '.env.local',
    'apps/.clasprc.json',
    'secrets/api.json',
    '구글_백업코드_unmet23.txt',
  ];
  for (const p of 막혀야하는것) {
    assert.equal(금지인가(p), true, `막혔어야 한다: ${p}`);
  }
});

test('보통 파일은 안 막힌다 — 가드가 넓어져 꾸러미를 비우지 않는다', () => {
  const 통과해야하는것 = [
    'docs/_ops/결정.md',
    'docs/_ops/트랙.md',
    'Code.js',
    'docs/캐릭터/정본_4K/몽글_본체.png',
    'docs/디자인_토큰.json',
    'tools/이어하기꾸러미.js',
    'docs/환경설정_안내.md',     // '환경'·'설정' 이 들어가도 자격증명이 아니다
    'docs/발음데이터_규격.md',
  ];
  for (const p of 통과해야하는것) {
    assert.equal(금지인가(p), false, `통과했어야 한다: ${p}`);
  }
});

test('글과 자산을 가르는 자 — 원드라이브에 무엇이 가는지를 정한다', () => {
  // 글(원드라이브+구글 양쪽)
  assert.equal(문서인가('docs/_ops/결정.md'), true);
  assert.equal(문서인가('CLAUDE.md'), true);
  assert.equal(문서인가('docs/디자인_토큰.json'), true);
  assert.equal(문서인가('docs/_ops/검수기록.jsonl'), true);
  // 자산(구글만)
  assert.equal(문서인가('docs/캐릭터/정본_4K/몽글_본체.png'), false);
  assert.equal(문서인가('docs/_ops/capture.png'), false);
  assert.equal(문서인가('Code.js'), true);
  assert.equal(문서인가('package.json'), true);
});

const fs = require('node:fs'), os = require('node:os');
const { copy, textPolicy, oneDrivePlan, 시스템목록, cloudDestinationAllows, MAX_TEXT_BYTES } = require('../tools/이어하기꾸러미.js');
function fixture(t) {
  const base = fs.realpathSync(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(base, 'synk-document-copy-'));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(dir)), base);
    assert.ok(path.basename(dir).startsWith('synk-document-copy-'));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const root = path.join(dir, 'SYNK-appsscript'), dest = path.join(dir, 'destination');
  fs.mkdirSync(root);
  const put = (name, data) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    return { brand: 'SYNK', source: name, target: '시스템/SYNK-appsscript/' + name, kind: 'system' };
  };
  return { dir, root, dest, put };
}

test('확장자가 텍스트여도 바이너리·큰 파일·인라인 미디어·비밀 리터럴은 차단한다', t => {
  const f = fixture(t);
  // 합성 미디어·비밀값은 실행 때 조합한다. 시험 소스 자체는 평문 보관 검사도 통과해야 한다.
  const pngBase64 = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(40).fill(0)]).toString('base64');
  const cases = [
    ['fake.ts', Buffer.from([0x47, 0, 0xff, 0x10]), 'not-utf8-text'],
    ['binary.txt', Buffer.from([65, 0, 66]), 'binary-control-bytes'],
    ['poster.html', '<img src="' + ['data', 'image/png;base64,'].join(':') + pngBase64 + '">', 'embedded-media-or-base64'],
    ['picture.json', JSON.stringify({ picture: pngBase64 }), 'embedded-media-or-base64'],
    ['long.json', JSON.stringify({ payload: 'ABcd1234'.repeat(50) }), 'embedded-media-or-base64'],
    ['config.json', JSON.stringify({ ['api_' + 'key']: 'synthetic-value-for-guard-test' }), 'secret-literal'],
    ['short.json', JSON.stringify({ ['pass' + 'word']: '123456' }), 'secret-literal'],
    ['settings.yaml', 'password: 123456\n', 'secret-literal'],
    ['escaped.json', JSON.stringify({ image: ['data', 'image/png;base64,AAAA'].join(':') }).replace('data', '\\u0064ata'), 'embedded-media-or-base64'],
    ['private.txt', '-----BEGIN ' + 'PRIVATE KEY-----', 'secret-signature'],
    ['build/main.js', 'export default 1;', 'generated-or-excluded-path'],
    ['qa/report.json', '{}', 'generated-or-excluded-path'],
    ['docs/photo.png', 'plain text is still not an allowed extension', 'non-text-extension'],
  ];
  const rows = cases.map(([name, data]) => f.put(name, data));
  const large = f.put('large.md', '');
  fs.truncateSync(path.join(f.root, large.source), MAX_TEXT_BYTES + 1);
  rows.push(large);
  const plan = oneDrivePlan(f.root, rows);
  assert.equal(plan.selected.length, 0);
  for (const [name, , reason] of cases) assert.equal(plan.rejected.find(row => row.source === name).reason, reason, name);
  assert.equal(plan.rejected.at(-1).reason, 'over-10MiB');
  assert.equal(copy(f.root, f.dest, rows).written, 0);
  assert.equal(fs.existsSync(f.dest), false);
  for (const name of ['.env.example', 'settings/auth.json', 'api-token.txt', 'private.key', 'certificate.pem', 'login.p12', 'credentials.json']) {
    assert.equal(금지인가(name), true, name);
  }
});

test('시스템 문서는 바이트 그대로, 브랜드 문서와 보관 목록은 OneDrive에 포함한다', t => {
  const f = fixture(t);
  const original = Buffer.from('\uFEFF# 원문\r\n[상대](next.md)\r\n');
  const system = f.put('docs/마케팅/campaign.md', original);
  const brand = { ...system, kind: undefined, target: '정본/마케팅/campaign.md' };
  const record = f.put('docs/_ops/archive/record.jsonl', '{"file":"picture.png","sha256":"0123"}\n');
  const result = copy(f.root, f.dest, [system, brand, record]);
  assert.equal(result.written, 3);
  assert.ok(fs.readFileSync(path.join(f.dest, 'SYNK', system.target)).equals(original));
  assert.match(fs.readFileSync(path.join(f.dest, 'SYNK', brand.target), 'utf8'), /공유 사본/);
  assert.equal(copy(f.root, f.dest, [system, brand, record]).unchanged, 3);
});

test('예약 복원 설정은 원문대로 복사하고 설정 안의 비밀·미디어·바이너리는 차단한다', t => {
  const f = fixture(t);
  const configs = [
    ['job.service', '[Service]\nExecStart=/usr/bin/python3 /opt/synk/run.py\nEnvironment="MODE=production"\n'],
    ['job.timer', '[Timer]\nOnCalendar=*-*-* 14:00:00 Asia/Seoul\n'],
    ['job.slice', '[Slice]\nCPUQuota=100%\n'],
    ['job.logrotate', '/var/log/synk/*.log {\n  rotate 7\n  missingok\n}\n'],
  ];
  const rows = configs.map(([name, body]) => f.put('tools/argon-schedules/' + name, body));
  assert.equal(oneDrivePlan(f.root, rows).selected.length, configs.length);
  assert.equal(copy(f.root, f.dest, rows).written, configs.length);
  for (const [index, [name, body]] of configs.entries()) {
    assert.equal(fs.readFileSync(path.join(f.dest, 'SYNK', rows[index].target), 'utf8'), body);
    assert.equal(textPolicy(name, Buffer.from([65, 0, 66])), 'binary-control-bytes');
    assert.equal(textPolicy(name, Buffer.from(['data', 'image/png;base64,AAAA'].join(':'))), 'embedded-media-or-base64');
    assert.equal(textPolicy(name, Buffer.from('api_' + 'key="synthetic-config-secret"')), 'secret-literal');
    assert.equal(textPolicy(name, Buffer.from('password=123456\n')), 'secret-literal');
  }
  for (const line of ['Environment="SYNK_API_' + 'KEY=synthetic-config-secret"', 'Environment=SYNK_ACCESS_' + 'TOKEN=synthetic-config-secret'])
    assert.equal(textPolicy('job.service', Buffer.from(line)), 'secret-literal');
  assert.equal(textPolicy('job.service', Buffer.from('EnvironmentFile=/etc/synk/protected.env\n')), null);
});

test('복원 시작 문서는 다른 PC에서도 열리는 시스템 사본 상대 링크를 쓴다', t => {
  const f = fixture(t);
  const row = f.put('docs/컴퓨터를 잃어버렸을 때.md', '[원칙](AI_운영원칙.md)\n[창고](../../SYNK_원본창고/README.md)\n[설계](../DESIGN.md)');
  const entry = { ...row, brand: 'SYNK', kind: undefined, target: '복원 시작.md' };
  copy(f.root, f.dest, [entry]);
  const text = fs.readFileSync(path.join(f.dest, 'SYNK/복원 시작.md'), 'utf8');
  assert.match(text, /\]\(시스템\/SYNK-appsscript\/docs\/AI_운영원칙\.md\)/);
  assert.match(text, /\]\(시스템\/SYNK_원본창고\/README\.md\)/);
  assert.match(text, /\]\(시스템\/SYNK-appsscript\/DESIGN\.md\)/);
  assert.ok(!text.includes(f.root));
});

test('목록을 만든 뒤 바뀐 내용도 복사할 때 다시 검사한다', t => {
  const f = fixture(t), row = f.put('page.html', '<h1>safe</h1>');
  const plan = oneDrivePlan(f.root, [row]);
  assert.equal(plan.selected.length, 1);
  fs.writeFileSync(path.join(f.root, row.source), '<img src="' + ['data', 'image/png;base64,AAAA'].join(':') + '">');
  assert.equal(copy(f.root, f.dest, plan.selected).written, 0);
  assert.equal(fs.existsSync(f.dest), false);
});

test('원본과 목적지의 junction 또는 symlink를 통과하지 않는다', t => {
  const f = fixture(t), outside = path.join(f.dir, 'outside');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'note.md'), 'outside');
  fs.symlinkSync(outside, path.join(f.root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const row = { brand: 'SYNK', source: 'linked/note.md', target: 'note.md' };
  assert.equal(oneDrivePlan(f.root, [row]).rejected[0].reason, 'link-or-reparse-point');
  const safe = f.put('safe.md', 'safe');
  fs.mkdirSync(f.dest);
  fs.symlinkSync(outside, path.join(f.dest, 'SYNK'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => copy(f.root, f.dest, [safe]), /reparse/);
  assert.deepEqual(fs.readdirSync(outside), ['note.md']);
});

test('목적지의 Cloud 태그만 지정 루트 안에서 허용하고 다른 reparse 태그는 차단한다', () => {
  const root = path.resolve('fixture-onedrive'), target = path.join(root, 'SYNK', 'note.md');
  for (let i = 0; i < 16; i++) assert.equal(cloudDestinationAllows(target, root, 0x9000001A + i * 0x1000), true);
  for (const tag of [null, 0xA0000003, 0xA000000C, 0x9000001B, 0x9001001A, 0x8000001A]) {
    assert.equal(cloudDestinationAllows(target, root, tag), false);
  }
  assert.equal(cloudDestinationAllows(root, root, 0x9000701A), true);
  assert.equal(cloudDestinationAllows(target, null, 0x9000701A), false);
  assert.equal(cloudDestinationAllows(path.resolve('fixture-onedrive-other/note.md'), root, 0x9000701A), false);
  assert.equal(cloudDestinationAllows(path.dirname(root), root, 0x9000701A), false);
});

test('인증 구현 코드는 이름 때문에 빠지지 않지만 실제 자격증명과 내용은 계속 차단한다', () => {
  const implementation = Buffer.from('export function authenticate(request) { return request.session; }');
  for (const source of ['tools/synk-id/auth-settings.js', 'lib/synk-auth.js', 'lib/tutor-auth.js', 'supabase/functions/auth/index.ts', 'supabase/migrations/auth.sql', 'tools/key-management.py']) {
    assert.equal(textPolicy(source, implementation), null, source);
  }
  for (const source of ['auth.json', 'secrets/api.json', 'credentials.json', 'tokens.json', '.env', 'private.pem']) {
    assert.equal(textPolicy(source, implementation), 'credential-path', source);
  }
  assert.equal(textPolicy('auth.js', Buffer.from('const api_' + 'key = "synthetic-secret-value";')), 'secret-literal');
});

test('동적 Bearer 접두사와 상태 문구는 허용하고 고정 인증값은 계속 막는다', () => {
  const allowed = [
    "headers = { Authorization: 'Bearer ' + token };",
    "headers = { 'Authorization': 'Bearer ' + getToken() };",
    "headers = { Authorization: 'Bearer ' + p.getProperty('SYNK_TOKEN') };",
    "add(ai.hasKey, 'CLAUDE_API_KEY: ' + (ai.hasKey ? '설정됨' : '없음'));",
  ];
  for (const code of allowed) assert.equal(textPolicy('engine.js', Buffer.from(code)), null);
  const blocked = [
    "headers = { Author" + "ization: 'Bearer synthetic-token-value' };",
    "headers = { Author" + "ization: 'Bearer ' + 'synthetic-token-value' };",
    "headers = { Author" + "ization: 'Bearer ' + String('synthetic-token-value') };",
    "headers = { Author" + "ization: 'Bearer ' + token + 'synthetic-token-value' };",
    "const CLAUDE_API_" + "KEY = 'synthetic-secret-value';",
    "const config = { 'CLAUDE_API_" + "KEY': 'synthetic-secret-value' };",
    "const headers = { 'x-service-api-" + "key': 'synthetic-secret-value' };",
    'const config = { clientApi' + 'Key: "synthetic-secret-value" };',
    JSON.stringify({ ['author' + 'ization']: "synthetic-token-with-an'apostrophe" }),
    JSON.stringify({ ['pass' + 'word']: 'synthetic-token-with-a"quote' }),
    "const pass" + "word = '123456';",
    '{"api_' + 'key":"synthetic-secret-value"}',
  ];
  for (const code of blocked) assert.equal(textPolicy('engine.js', Buffer.from(code)), 'secret-literal');
  assert.equal(textPolicy('settings.yaml', Buffer.from('password: 123456\n')), 'secret-literal');
});

test('내용 없는 data 주소 설명·실행 중 조립은 허용하고 실제로 담긴 자료는 계속 막는다(10-19)', () => {
  const allowed = [
    ['docs/현장노트/브라우저_게시.md', '- 다시 확인: 견본 미리보기에 `data:image/png` 그림이 있는지 본다.'],
    ['tests/path-travel-server.test.mjs', "const m = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);"],
    ['engine.js', "img.src = 'data:image/png;base64,' + encoded;"],
    ['engine.js', "const url = 'data:image/' + type + ';base64,' + body;"],
  ];
  for (const [name, code] of allowed) assert.equal(textPolicy(name, Buffer.from(code)), null, code);
  const uri = (...parts) => ['data', parts.join('')].join(':');
  const blocked = [
    ['docs/guide.md', '![견본](' + uri('image/png;base64,', 'AAAA') + ')'],
    ['site/style.css', 'li::before{background:url("' + uri('image/svg+xml,', "%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E") + '")}'],
    ['engine.js', "const font = '" + uri('font/woff2;base64,', 'd09GMgABAAAAAAQ') + "';"],
    ['engine.js', "const blob = '" + uri('application/octet-stream;base64,', 'QUJDREVGR0hJSktMTU5PUA==') + "';"],
    ['engine.js', 'const img = `' + uri('image/png;base64,\n', 'iVBORw0KGgoAAAANSUhEUg') + '`;'],
  ];
  for (const [name, code] of blocked) assert.equal(textPolicy(name, Buffer.from(code)), 'embedded-media-or-base64', code);
});

test('검토한 오탐 값은 그 경로의 그 값에만 허용한다(10-19)', t => {
  const ternary = "<input type=\"${secret ? 'pass" + "word' : 'text'}\">";
  assert.equal(textPolicy('tools/lib/sns-publisher.js', Buffer.from(ternary)), null);
  assert.equal(textPolicy('tools/lib/other-form.js', Buffer.from(ternary)), 'secret-literal');
  assert.equal(textPolicy('tools/lib/sns-publisher.js', Buffer.from("const pass" + "word = 'synthetic-live-value';")), 'secret-literal');
  const company = 'docs/마케팅/온라인마케팅지도/engagement/company/';
  for (const relative of [...['server-publication.test.mjs', 'server-publication-links.test.mjs', 'server-publication-workflow.test.mjs',
    'server-publication-learning.test.mjs'].map(name => company + name), 'tests/hermes-synk-overview.test.cjs']) {
    const source = path.join(__dirname, '..', relative), name = path.basename(relative);
    if (!fs.existsSync(source)) { t.diagnostic('없는 시험 파일: ' + name); continue; }
    const data = fs.readFileSync(source);
    if (textPolicy(relative, data) !== null) { t.diagnostic('검토 뒤 값이 바뀐 시험 파일: ' + name); continue; }
    assert.equal(textPolicy('docs/elsewhere/' + name, data), 'secret-literal', name);
  }
});

test('검토한 문서 예제 예외는 정확한 경로와 원문 SHA에만 적용한다', t => {
  const relative = '.agents/skills/higgsfield-websites/references/security.md';
  const source = path.resolve(__dirname, '..', relative);
  if (!fs.existsSync(source)) { t.skip('선택 설치된 참고 문서가 없는 환경'); return; }
  const original = fs.readFileSync(source);
  const digest = require('node:crypto').createHash('sha256').update(original).digest('hex');
  if (digest !== '3c56006b1665d9968fb94a35c60f5e1f66c616ac70f2ba9e62c370b9fa412c77') {
    t.skip('참고 문서가 갱신되어 종전 예외의 대상이 아님'); return;
  }
  assert.equal(textPolicy(relative, original), null);
  assert.equal(textPolicy('docs/another.md', original), 'secret-literal');
  assert.equal(textPolicy(relative, Buffer.concat([original, Buffer.from('\n수정됨')])), 'secret-literal');
  assert.equal(textPolicy('작업문서_미통합_20261018/files/' + digest + '.md', original), null);
});

test('세 저장소 소스와 창고 운영 스크립트를 원래 구조로 모은다', t => {
  const f = fixture(t), { execFileSync } = require('node:child_process');
  for (const name of ['SYNK-appsscript', 'SYNK-talk', 'SYNK-website']) {
    const root = path.join(f.dir, name);
    fs.mkdirSync(root, { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: root });
    fs.writeFileSync(path.join(root, '.gitignore'), 'ignored.js\n');
    fs.writeFileSync(path.join(root, 'tracked.js'), 'const tracked = true;\n');
    execFileSync('git', ['add', '.gitignore', 'tracked.js'], { cwd: root });
    fs.writeFileSync(path.join(root, 'new.md'), '# 미추적 원문\n');
    fs.writeFileSync(path.join(root, 'ignored.js'), 'ignored');
  }
  const vault = path.join(f.dir, 'SYNK_원본창고');
  fs.mkdirSync(path.join(vault, 'media'), { recursive: true });
  fs.writeFileSync(path.join(vault, 'README.md'), '# 창고');
  fs.writeFileSync(path.join(vault, 'backup.py'), 'print("backup")');
  fs.writeFileSync(path.join(vault, 'state.json'), '{}');
  fs.writeFileSync(path.join(vault, 'media/nested.py'), 'not included');
  const rows = 시스템목록(f.root), plan = oneDrivePlan(f.root, rows);
  assert.equal(rows.scopes.filter(scope => scope.status === 'available').length, 4);
  assert.equal(plan.selected.length, 11);
  assert.ok(!rows.some(row => /ignored|state|nested/.test(row.source)));
  assert.equal(copy(f.root, f.dest, rows).written, 11);
  assert.ok(fs.readFileSync(path.join(f.dest, 'SYNK/시스템/SYNK-talk/new.md')).equals(fs.readFileSync(path.join(f.dir, 'SYNK-talk/new.md'))));
  assert.equal(copy(f.root, path.join(f.dir, 'google'), rows, { google: true }).written, 0);
  assert.throws(() => copy(f.root, f.dest, [{ ...rows[0], sourceScope: 'outside' }]));
  assert.equal(textPolicy('good.js', Buffer.from('const key = process.env.API_KEY;')), null);
});

test('git 무시·QA·미디어 폴더의 작업 MD와 창고 복원 목록을 보존하고 의존성·빌드는 제외한다', t => {
  const f = fixture(t), { execFileSync } = require('node:child_process');
  execFileSync('git', ['init', '-q'], { cwd: f.root });
  f.put('.gitignore', 'ignored/\n');
  for (const name of ['ignored/콘티.md', 'qa/README.md', 'assets/media/제작규칙.md', 'desktop/AUTH.md']) f.put(name, '# 작업 문서');
  for (const name of ['node_modules/pkg/README.md', 'build/README.md', '.tmp/note.md', '.claude/worktrees/task/plan.md']) f.put(name, '# 재생성·별도 보존');
  const vault = path.join(f.dir, 'SYNK_원본창고');
  const add = (base, rel, body) => {
    fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true });
    fs.writeFileSync(path.join(base, rel), body);
  };
  add(vault, '복원검증_20261017/storyboard/콘티.md', '# 보존 원문');
  add(vault, '상태/Videos/upload-done.jsonl', '{"id":"file-id","sha256":"abc"}\n');
  add(vault, 'backup-monitor-config.json', '{"hour":5}');
  add(vault, 'OneDrive_이관_20261018/복원목록.json', '{"files":[]}');
  add(vault, '작업문서_미통합_20261018/index.json', '{"files":[]}');
  add(vault, '문서_안전사본_20261018/원본복원목록.json', '{"files":[]}');
  add(vault, '문서_안전사본_20261018/변환manifest.json', '{"files":[]}');
  add(vault, '문서_안전사본_20261018/arbitrary.json', '{"not":"approved metadata"}');
  add(vault, '문서_안전사본_20261019/원본복원목록.json', '{"not":"approved date"}');
  add(path.join(f.dir, 'PC_백업_20261003'), '복원목록_최소.json', '{"files":[]}');
  add(vault, 'state.json', '{"not":"approved metadata"}');
  add(vault, '복원검증_20261017/credentials.json', '{"pass' + 'word":"synthetic-secret"}');
  add(path.join(f.dir, 'Videos'), '한강/media/콘티.md', '# 영상 원문');
  add(path.join(f.dir, 'Videos'), '한강/movie.mp4', 'not copied');
  add(path.join(f.dir, '.agents/skills'), 'my-skill/SKILL.md', '# 작업 규칙');
  const rows = 시스템목록(f.root), plan = oneDrivePlan(f.root, rows);
  const included = new Set(plan.selected.map(x => x.sourceScope + '/' + x.source));
  for (const name of ['ignored/콘티.md', 'qa/README.md', 'assets/media/제작규칙.md', 'desktop/AUTH.md'])
    assert.ok(included.has('SYNK-appsscript/' + name), name);
  assert.ok(included.has('SYNK_원본창고/복원검증_20261017/storyboard/콘티.md'));
  assert.ok(included.has('SYNK_원본창고/상태/Videos/upload-done.jsonl'));
  assert.ok(included.has('SYNK_원본창고/backup-monitor-config.json'));
  assert.ok(included.has('SYNK_원본창고/OneDrive_이관_20261018/복원목록.json'));
  assert.ok(included.has('SYNK_원본창고/작업문서_미통합_20261018/index.json'));
  assert.ok(included.has('SYNK_원본창고/문서_안전사본_20261018/원본복원목록.json'));
  assert.ok(included.has('SYNK_원본창고/문서_안전사본_20261018/변환manifest.json'));
  assert.ok(!included.has('SYNK_원본창고/문서_안전사본_20261018/arbitrary.json'));
  assert.ok(!included.has('SYNK_원본창고/문서_안전사본_20261019/원본복원목록.json'));
  assert.ok(included.has('PC_백업_20261003/복원목록_최소.json'));
  assert.ok(included.has('Videos/한강/media/콘티.md'));
  assert.ok(included.has('개인작업규칙/my-skill/SKILL.md'));
  for (const name of included) assert.doesNotMatch(name, /node_modules|\/build\/|\.tmp\/|worktrees\/|state\.json|credentials\.json|movie\.mp4/);
  assert.equal(textPolicy('docs/auth-design.md', Buffer.from('# 인증 설계')), null);
  assert.equal(textPolicy('docs/schema-primary-keys.md', Buffer.from('# 기본키 설명')), null);
  assert.equal(textPolicy('docs/auth-design.md', Buffer.from('password: "synthetic-secret"')), 'secret-literal');
  assert.equal(textPolicy('secrets/README.md', Buffer.from('# 비밀 메모')), 'credential-path');
  assert.equal(copy(f.root, f.dest, plan.selected).written, plan.selected.length);
  assert.equal(fs.readFileSync(path.join(f.dest, 'SYNK/시스템/Videos/한강/media/콘티.md'), 'utf8'), '# 영상 원문');
});

// A help/typo request must never reach the synchronizer or either cloud copy.
test('검토한 실행 소스 예외는 전체 SHA를 고정하고 변경·서명 비밀은 막는다', () => {
  const fs = require('node:fs');
  const name = 'docs/마케팅/온라인마케팅지도/engagement/company/deploy/company-backup.sh';
  const data = fs.readFileSync(path.join(__dirname, '..', name));
  assert.equal(textPolicy(name, data), null);
  assert.equal(textPolicy(name, Buffer.concat([data, Buffer.from('\n# changed')])), 'secret-literal');
  assert.equal(textPolicy('other.sh', data), 'secret-literal');
  assert.equal(textPolicy(name, Buffer.concat([data, Buffer.from('\n' + 'ghp_' + 'X'.repeat(30))])), 'secret-signature');
  assert.equal(textPolicy('runtime.js', Buffer.from("headers = {author" + "ization: 'Bearer '.concat(token)};")), null);
  assert.equal(textPolicy('runtime.js', Buffer.from("headers = {author" + "ization: 'Bearer '.concat('actual-literal-secret')};")), 'secret-literal');
});

test('도움말과 잘못된 옵션은 공유 사본을 쓰지 않는다', t => {
  const fs = require('node:fs'), os = require('node:os');
  const {spawnSync} = require('node:child_process');
  const tempBase = fs.realpathSync(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(tempBase, 'synk-copy-cli-'));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(dir)), tempBase);
    assert.ok(path.basename(dir).startsWith('synk-copy-cli-'));
    fs.rmSync(dir, {recursive:true, force:true});
  });
  const tool = path.join(dir, 'tool.js');
  fs.copyFileSync(path.join(__dirname, '../tools/이어하기꾸러미.js'), tool);
  for (const name of ['github-backup-reviewed-literals.json', 'onedrive-reviewed-literals.json'])
    fs.copyFileSync(path.join(__dirname, '../tools', name), path.join(dir, name));
  const marker = path.join(dir, 'side-effect.txt');
  fs.writeFileSync(path.join(dir, '비전동기화.js'),
    'exports.syncVisionSources=()=>require("node:fs").writeFileSync('+JSON.stringify(marker)+',"unexpected");');
  for (const flag of ['--help', '-h', '--unknown']) {
    const result = spawnSync(process.execPath, [tool, flag], {encoding:'utf8'});
    assert.equal(result.status, flag==='--unknown' ? 1 : 0, result.stderr);
    assert.equal(fs.existsSync(marker), false);
  }
});
