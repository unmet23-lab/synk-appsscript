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
// 「정상 PDF」 = 브랜드 3종이 다 실린 것. 게이트가 Consolas 1종에서 3종으로 넓어졌다(2026-08-06).
const 콘솔라스PDF = '%PDF-1.4\n/BaseFont /ABCDEF+SUIT-Regular\n/BaseFont /BCDEFG+InterTight-Regular\n/BaseFont /CDEFGH+DMMono-Regular\n%%EOF';
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

test('PDF에 브랜드 서체가 없으면 잡는다 (인쇄본에서만 죽는 실측 사고)', () => {
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
  assert.match(r.out, /브랜드 서체가 없다: SUIT·Inter Tight·DM Mono/);
});

test('브랜드 서체가 압축 스트림 안에 있어도 찾아낸다 (평문 grep 은 못 본다 — 오판의 원인)', () => {
  const M = require(TOOL);
  const zlib = require('zlib');
  // 폰트 이름을 **압축된 스트림 안**에만 넣는다. 평문 훑기는 여기서 0건을 돌려준다.
  const 속 = zlib.deflateSync(Buffer.from('/BaseFont /AAAAAA+SUIT-Regular /BaseFont /BBBBBB+InterTight-Bold', 'latin1'));
  const pdf = Buffer.concat([
    Buffer.from('%PDF-1.4\n1 0 obj<</Length 1>>stream\n', 'latin1'), 속,
    Buffer.from('\nendstream endobj\n/BaseFont /CCCCCC+DMMono-Regular\n%%EOF', 'latin1'),
  ]);
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-pdffont-')), 'a.pdf');
  fs.writeFileSync(f, pdf);
  const 폰트 = M.임베드폰트(f);
  assert.ok(폰트.includes('SUIT-Regular'), `압축 안의 SUIT 를 놓쳤다: ${폰트.join(',')}`);
  assert.ok(폰트.includes('InterTight-Bold'), `압축 안의 Inter Tight 를 놓쳤다: ${폰트.join(',')}`);
  assert.ok(폰트.includes('DMMono-Regular'), `평문의 DM Mono 를 놓쳤다: ${폰트.join(',')}`);
  assert.deepStrictEqual(M.빠진서체(폰트), []);
  assert.deepStrictEqual(M.빠진서체(['MalgunGothic', 'Consolas']), ['SUIT', 'Inter Tight', 'DM Mono']);
});

test('이미 정본 스택인 HTML(@font-face 없음)도 심기로 진행한다 — no-op 을 「스택 부재」로 오판하던 자리 (2026-08-07 실측)', () => {
  const M = require(TOOL);
  const dir = tmp('font');
  // 픽스처는 정규화 치환의 **출력형 그대로** 쓴다 — 그래야 치환이 전부 제자리(no-op)가 되어
  // 옛 `html === 전` 게이트를 정확히 때린다. <style> 은 일부러 뺀다: 스택 게이트 바로 다음
  // 검사(<style> 부재)에서 서는 것이 「게이트를 지났다」의 환경 무관 증명이다(python·폰트 없는 CI 포함).
  const f = path.join(dir, '정본스택.html');
  fs.writeFileSync(f, "<html><head></head><body><div style=\"font-family:'Inter Tight','SUIT',sans-serif;\">지도</div></body></html>", 'utf8');
  const r = M.폰트심기(f);
  assert.strictEqual(r.ok, false);
  assert.doesNotMatch(r.이유, /브랜드 폰트 스택을 못 찾았다/, '이미 정본 스택인 HTML 을 「스택 부재」로 오판했다');
  assert.match(r.이유, /<style>/, '스택 게이트를 지나 다음 검사(<style> 부재)에 닿아야 한다');

  // 탐지력은 살아 있어야 한다 — 브랜드 스택이 정말 없으면 여전히 여기서 막는다
  const g = path.join(dir, '무스택.html');
  fs.writeFileSync(g, '<html><head><style>body{font-family:Arial,sans-serif;}</style></head><body>지도</body></html>', 'utf8');
  const r2 = M.폰트심기(g);
  assert.strictEqual(r2.ok, false);
  assert.match(r2.이유, /브랜드 폰트 스택을 못 찾았다/, '스택 부재 탐지가 죽었다 — 게이트를 너무 열었다');
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

test('--stamp 도장은 파생 주석 안에만 — 본문이 정본 경로를 언급해도 오염되지 않는다 (2026-08-05 실측 2건)', () => {
  const repo = makeRepo();
  const maps = makeMaps([{
    이름: '본문언급',
    html: '<!-- 파생: docs/정본.md -->\n<html><body>\n' +
      '<h2>docs/정본.md 를 소개하는 지도</h2>\n' +
      '<footer>정본 = docs/정본.md</footer>\n</body></html>',
    pdf: 콘솔라스PDF,
  }]);
  const r = run(['--stamp', '본문언급'], { SYNK_지도_DIR: maps, SYNK_지도_ROOT: repo.dir });
  assert.strictEqual(r.code, 0, r.out);
  const 갱신 = fs.readFileSync(path.join(maps, '본문언급.html'), 'utf8');
  const 도장 = repo.h2.slice(0, 7);
  assert.ok(
    갱신.includes(`<!-- 파생: docs/정본.md@${도장} -->`),
    '파생 주석에 도장이 안 찍혔다'
  );
  // 전역 치환이었을 때 아래 두 곳에 @가 박혀 인쇄본에 커밋 해시가 노출됐다
  assert.ok(갱신.includes('<h2>docs/정본.md 를 소개하는 지도</h2>'), '본문 헤딩에 도장이 새어 들어갔다');
  assert.ok(갱신.includes('정본 = docs/정본.md</footer>'), '푸터에 도장이 새어 들어갔다');
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
  /* ⚠ `갱신` 은 도구가 다시 쓴 **마크다운**이다 — `코드만()` 대상 아님(ⓑ 런타임 산출 + ⓒ 비JS · #Q72). */
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

/* 🔴 F617 — 바탕화면이 **없는 기계**에서 `지도폴더()` 가 던지면, `훑기()` 는 자기 계약
 *   (「폴더가 없으면 `있음:false` — 호출부가 통과와 구분할 수 있어야 한다」)을 못 지킨다.
 *   그러면 바로 아래 실폴더 검사가 **준비해 둔 skip 에 닿지도 못하고 fail** 한다(실측 2026-08-18 ubuntu ·
 *   SessionStart 는 같은 뿌리를 「[검사기 고장]」으로 냈다).
 * 🔑 탐지력은 **여기 픽스처가 진다** — 실폴더 검사는 그 기계에 폴더가 있으면 원리상 이 갈래를 못 잰다(맹점 ②).
 *   주입은 `lib/바탕화면.js` 가 이미 낸 이음매를 그대로 쓴다(그 파일 머리말: 「안 그러면 픽스처가
 *   이 기계의 진짜 레지스트리에 오염돼 기계마다 다른 답을 낸다」) — 이 검사가 OS 와 무관한 이유다. */
test('🔑 F617 — 바탕화면을 못 찾아도 지도폴더가 던지지 않는다(계약: 없으면 `있음:false` 로 드러난다)', () => {
  const M = require(TOOL);
  const 이전 = process.env.SYNK_지도_DIR;
  delete process.env.SYNK_지도_DIR;          // 덮어쓰기가 있으면 이 갈래를 아예 안 지난다
  try {
    const 없는기계 = { env: {}, 실존: () => false, 조회: () => null };
    let dir;
    assert.doesNotThrow(() => { dir = M.지도폴더(없는기계); },
      '바탕화면이 없으면 던진다 — 읽는 쪽이 `경로()`(쓰는 쪽 규율)를 쓰면 `||` 폴백이 죽은 코드가 된다(F617)');
    assert.strictEqual(typeof dir, 'string');
    assert.ok(dir.length > 0, '추측이라도 문자열은 나와야 `훑기()` 가 existsSync 로 걸러 `있음:false` 를 낼 수 있다');
    assert.strictEqual(M.훑기(dir).있음, false, '없는 폴더인데 `있음:true` 다 — 통과와 미실행이 같은 모양이 된다');
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
