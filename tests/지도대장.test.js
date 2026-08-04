/**
 * 지도대장 회귀 — 바탕화면 사본과 repo 정본의 갈림을 실제로 잡는가
 *
 * 왜 있나: 도구는 e27a93a 로 들어왔는데 이 짝 테스트가 「선언만 되고」 존재하지 않았다
 * (커밋 메시지에 미완성으로 명시). 사본 셋이 전부 갈라졌던 실사고(2026-08-04)를 막는
 * 도구가 스스로는 검증 0인 채였다 — 여기서 해소한다.
 *
 * ⚠ 지도 폴더는 **repo 밖**(OneDrive 바탕화면)에 산다 — CI에는 없다.
 *    탐지력은 픽스처(임시 폴더 + 임시 git 저장소)가 지고, 실폴더는 거짓양성만 본다.
 *    낡음 판정이 git 이력을 요구하므로 정본 쪽도 픽스처 저장소로 잰다(SYNK_지도_ROOT) —
 *    실저장소 이력은 CI에서 shallow 라 조상 판정이 조용히 어긋날 수 있다.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const TOOL = path.resolve(__dirname, '..', 'tools', '지도대장.js');

let seq = 0;
function tmp(prefix) {
  seq += 1;
  return fs.mkdtempSync(path.join(os.tmpdir(), `synk-mapledger-${prefix}-${process.pid}-${seq}-`));
}

function run(args, env) {
  const r = spawnSync(process.execPath, [TOOL].concat(args), {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { out: (r.stdout || '') + (r.stderr || ''), code: r.status };
}

/** 픽스처 git 저장소 — docs/정본.md 를 두 번 커밋해 「낡음」을 만들 재료를 준다 */
function makeRepo() {
  const dir = tmp('repo');
  const g = (args) => {
    const r = spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], {
      cwd: dir, encoding: 'utf8',
    });
    assert.strictEqual(r.status, 0, `픽스처 git 실패: git ${args.join(' ')} — ${r.stderr}`);
    return r.stdout.trim();
  };
  g(['init', '-q']);
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', '정본.md'), '# v1\n');
  g(['add', 'docs/정본.md']);
  g(['commit', '-q', '-m', 'v1', '--no-gpg-sign']);
  const h1 = g(['rev-parse', 'HEAD']);
  fs.writeFileSync(path.join(dir, 'docs', '정본.md'), '# v2\n');
  g(['add', 'docs/정본.md']);
  g(['commit', '-q', '-m', 'v2', '--no-gpg-sign']);
  const h2 = g(['rev-parse', 'HEAD']);
  return { dir, h1, h2 };
}

const 해시 = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
const 콘솔라스PDF = '%PDF-1.4\n/BaseFont /ABCDEF+Consolas\n%%EOF';
const 무폰트PDF = '%PDF-1.4\n/BaseFont /GHIJKL+SomeSans\n%%EOF';

/** 지도 폴더 픽스처: html·pdf·상태 기록을 한 번에 깐다 */
function makeMaps(spec) {
  const dir = tmp('maps');
  const 상태 = {};
  for (const m of spec) {
    fs.writeFileSync(path.join(dir, m.이름 + '.html'), m.html, 'utf8');
    if (m.pdf !== undefined) fs.writeFileSync(path.join(dir, m.이름 + '.pdf'), m.pdf, 'latin1');
    if (m.기록) 상태[m.이름 + '.html'] = m.기록;
  }
  if (Object.keys(상태).length) {
    fs.writeFileSync(path.join(dir, '.지도대장.json'), JSON.stringify(상태), 'utf8');
  }
  return dir;
}

test('폴더가 없으면 통과가 아니라 skip 으로 드러난다 (--check 도 exit 0)', () => {
  const missing = path.join(os.tmpdir(), `synk-mapledger-none-${process.pid}-${Date.now()}`);
  const r = run(['--check'], { SYNK_지도_DIR: missing });
  assert.strictEqual(r.code, 0, '폴더 없음은 실패가 아니다 — CI·클라우드가 여기를 지난다');
  assert.match(r.out, /skip/, '미실행이 통과와 같은 모양이 됐다');
  assert.match(r.out, /지도 폴더가 없다/);
});

test('정본 선언이 없는 지도는 그 자체가 문제다 (--check exit 1)', () => {
  const maps = makeMaps([{ 이름: '고아지도', html: '<html><body>지도</body></html>', pdf: 콘솔라스PDF }]);
  const r = run(['--check'], { SYNK_지도_DIR: maps });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /정본 선언이 없다/, '무엇의 사본인지 모르는 지도를 통과시켰다');
});

test('도장 없는 엣지 = 「최신」이 아니라 「모름」으로 센다', () => {
  const repo = makeRepo();
  const maps = makeMaps([{
    이름: '무도장',
    html: '<!-- 파생: docs/정본.md -->\n<html></html>',
    pdf: 콘솔라스PDF,
  }]);
  const r = run(['--check'], { SYNK_지도_DIR: maps, SYNK_지도_ROOT: repo.dir });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /정본 도장이 없다/);
  assert.match(r.out, /모른다/, '모름을 최신으로 바꿔 말하면 안 된다');
});

test('정본이 도장 이후 커밋되면 「사본이 낡았다」 — 핵심 탐지력', () => {
  const repo = makeRepo();
  const maps = makeMaps([{
    이름: '낡은지도',
    html: `<!-- 파생: docs/정본.md@${repo.h1.slice(0, 7)} -->\n<html></html>`,
    pdf: 콘솔라스PDF,
  }]);
  const r = run(['--check'], { SYNK_지도_DIR: maps, SYNK_지도_ROOT: repo.dir });
  assert.strictEqual(r.code, 1, '낡은 사본이 초록으로 지나갔다 — 이 도구의 존재 이유가 죽었다');
  assert.match(r.out, /사본이 낡았다/);
  assert.match(r.out, /1회 커밋/, '도장 이후 몇 번 바뀌었는지를 못 센다');
});

test('도장이 현재 커밋이면 낡음이 아니다 + 전부 맞으면 문제 0 · exit 0', () => {
  const repo = makeRepo();
  const html = `<!-- 파생: docs/정본.md@${repo.h2.slice(0, 7)} -->\n<html></html>`;
  const maps = makeMaps([{
    이름: '신선한지도',
    html,
    pdf: 콘솔라스PDF,
    기록: { html해시: 해시(Buffer.from(html, 'utf8')), 폰트: ['Consolas'] },
  }]);
  const r = run(['--check'], { SYNK_지도_DIR: maps, SYNK_지도_ROOT: repo.dir });
  assert.strictEqual(r.code, 0, `깨끗한 폴더가 빨간불이다:\n${r.out}`);
  assert.match(r.out, /문제 0건/);
});

test('PDF 짝이 없으면 지도가 반쪽이다', () => {
  const repo = makeRepo();
  const maps = makeMaps([{
    이름: '반쪽',
    html: `<!-- 파생: docs/정본.md@${repo.h2.slice(0, 7)} -->\n<html></html>`,
  }]);
  const r = run(['--check'], { SYNK_지도_DIR: maps, SYNK_지도_ROOT: repo.dir });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /PDF 짝이 없다/);
});

test('HTML 이 굽기 이후 바뀌면 「PDF가 낡았다」(해시 기준 · mtime 아님)', () => {
  const repo = makeRepo();
  const maps = makeMaps([{
    이름: '바뀐지도',
    html: `<!-- 파생: docs/정본.md@${repo.h2.slice(0, 7)} -->\n<html>새 내용</html>`,
    pdf: 콘솔라스PDF,
    기록: { html해시: '0000000000000000', 폰트: ['Consolas'] }, // 옛 해시 = 그 뒤 HTML 이 바뀜
  }]);
  const r = run(['--check'], { SYNK_지도_DIR: maps, SYNK_지도_ROOT: repo.dir });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /PDF가 낡았다/);
});

test('굽기 기록이 없으면 신선도를 「확정할 수 없다」고 말한다 (모름 ≠ 통과)', () => {
  const repo = makeRepo();
  const maps = makeMaps([{
    이름: '기록없음',
    html: `<!-- 파생: docs/정본.md@${repo.h2.slice(0, 7)} -->\n<html></html>`,
    pdf: 콘솔라스PDF,
  }]);
  const r = run(['--check'], { SYNK_지도_DIR: maps, SYNK_지도_ROOT: repo.dir });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /확정할 수 없다/);
});

test('PDF에 모노 폰트가 임베드되지 않으면 잡는다 (인쇄본에서만 죽는 실측 사고)', () => {
  const repo = makeRepo();
  const html = `<!-- 파생: docs/정본.md@${repo.h2.slice(0, 7)} -->\n<html></html>`;
  const maps = makeMaps([{
    이름: '폰트빠짐',
    html,
    pdf: 무폰트PDF,
    기록: { html해시: 해시(Buffer.from(html, 'utf8')), 폰트: ['SomeSans'] },
  }]);
  const r = run(['--check'], { SYNK_지도_DIR: maps, SYNK_지도_ROOT: repo.dir });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /Consolas.*임베드되지 않았다/);
});

test('한글 정본 경로를 통째로 받는다 — ASCII 문자군 정규식이 세 번 당긴 자리', () => {
  const M = require(TOOL);
  const 엣지들 = M.엣지읽기('<!-- 파생: docs/수업표_정본.md@abc1234, docs/반편성_정본_v2.md -->');
  assert.deepStrictEqual(
    엣지들.map((e) => e.정본),
    ['docs/수업표_정본.md', 'docs/반편성_정본_v2.md'],
    '한글 경로가 엣지에서 통째로 빠졌다'
  );
  assert.strictEqual(엣지들[0].도장, 'abc1234');
  assert.strictEqual(엣지들[1].도장, null);
});

test('--readme 는 지도 표를 폴더에서 생성한다 (손 목록은 실제와 갈라진다 · F080 계열)', () => {
  const repo = makeRepo();
  const maps = makeMaps([{
    이름: '2026-08-04_수업지도',
    html: `<!-- 파생: docs/정본.md@${repo.h2.slice(0, 7)} -->\n<html></html>`,
    pdf: 콘솔라스PDF,
  }]);
  fs.writeFileSync(path.join(maps, '_읽어보세요.md'), '# 지도\n\n| 지도 | 정본 |\n|---|---|\n| 낡은손표 | 손으로 적음 |\n', 'utf8');
  const r = run(['--readme'], { SYNK_지도_DIR: maps, SYNK_지도_ROOT: repo.dir });
  assert.strictEqual(r.code, 0, r.out);
  const 갱신 = fs.readFileSync(path.join(maps, '_읽어보세요.md'), 'utf8');
  assert.match(갱신, /수업지도/, '폴더에 실재하는 지도가 표에 없다');
  assert.match(갱신, /docs\/정본\.md/);
  assert.ok(!갱신.includes('낡은손표'), '옛 손 표가 그대로 남았다');
  assert.match(갱신, /지도표:시작/, '재생성 마커가 없으면 다음 갱신이 표를 못 찾는다');
});

test('rot-check 발화 지점 — 지도 문제가 주간 점검 warn 에 실린다 (장치+발동 조건)', () => {
  const maps = makeMaps([{ 이름: '문제지도', html: '<html>선언 없음</html>' }]);
  const 이전 = process.env.SYNK_지도_DIR;
  process.env.SYNK_지도_DIR = maps;
  try {
    const R = require(path.resolve(__dirname, '..', 'tools', 'rot-check.js'));
    const v = R.mapSection();
    assert.strictEqual(v.present, true);
    assert.ok(v.문제수 >= 1, '문제 있는 지도를 mapSection 이 0으로 셌다');
    assert.strictEqual(v.지도들[0].이름, '문제지도');
    // 폴더가 없으면 부패가 아니라 미실행이다
    process.env.SYNK_지도_DIR = path.join(os.tmpdir(), `synk-mapledger-x-${process.pid}-${Date.now()}`);
    assert.strictEqual(R.mapSection().present, false);
  } finally {
    if (이전 === undefined) delete process.env.SYNK_지도_DIR;
    else process.env.SYNK_지도_DIR = 이전;
  }
});

test('실폴더 — 있으면 훑기가 죽지 않는지만 본다(거짓양성 아닌 실문제는 정상 신호다)', (t) => {
  const M = require(TOOL);
  const 결과 = M.훑기();
  if (!결과.있음) { t.skip(`지도 폴더 없음(${결과.dir}) — CI·다른 기계에서는 미실행이 정상`); return; }
  assert.ok(Array.isArray(결과.지도들), '실폴더 훑기가 형태를 깨뜨렸다');
});
