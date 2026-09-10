/* 배포 표면 가드 회귀 테스트 — tools/deploy-security-check.js
 *
 * 왜 이 테스트가 있나: 2026-08-02 임시 doGet 러너 실사고를 수리한 뒤, 같은 결함이 다시 들어오는 것을
 * 기계로 막으려고 가드를 세웠다. 그런데 **가드는 조용히 눈이 먼다** — 판별식을 한 글자 고치면
 * 통과율이 100%가 되고, 초록 화면은 "멀쩡하다"로 읽힌다([[guard-must-check-result]]).
 * 그래서 가드가 「무엇을 잡아야 하는가」와 「무엇을 잡으면 안 되는가」를 양쪽 다 못박는다.
 * 실측 기준선: 08-02에 길이(16자)만 보게 했더니 `p.op === 'purgeTestCheckins'` 가 시크릿으로 걸렸다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const mod = require('../tools/deploy-security-check.js');
const { looksSecret, topLevelFunctions, parseDeploymentLine } = mod;

/* 이 테스트가 지키는 것은 판정식이 아니라 **순서**다.
 * 08-02 옆 세션 지적: clasp-guard는 맨 앞에서 CLASP_GUARD_BYPASS=1 이면 즉시 종료하는데,
 * 임시 러너는 **언제나** bypass로 push한다(러너 코드가 미커밋이라 우회 없이는 3번 검사에 걸린다).
 * 그래서 코드 검사(고정 토큰·doGet 파괴 연산)가 bypass 뒤에 있으면
 * **그것들이 실제로 존재하는 유일한 경로에서 영원히 발화하지 않는다.**
 * 되돌리기는 한 줄이면 되고 그때 아무 테스트도 안 죽는다 — 그래서 여기서 죽인다. */
test('clasp-guard — 코드 검사는 BYPASS 앞, 배포 검사는 뒤', () => {
  const guard = fs.readFileSync(path.join(__dirname, '..', '.claude', 'hooks', 'clasp-guard.js'), 'utf8');
  /* ⚠ 앵커를 **인자 형태에 묶지 않는다.** 원래 `.checkCode()` 를 정확히 찾았는데, F061 수리로
   *   프로젝트를 넘기게 되자(`.checkCode(PROJ)`) 호출이 멀쩡한데도 「사라졌다」로 빨간불이 났다.
   *   검사하려는 것은 **순서**지 인자가 아니다([[worktree-version-collision]] 「문구 앵커는
   *   문구가 바뀌면 죽는다」와 같은 자리). 여는 괄호까지만 앵커로 쓴다. */
  const iCode = guard.indexOf('.checkCode(');
  const iBypass = guard.search(/cmd\.includes\('CLASP_GUARD_BYPASS=1'\)\s*\)\s*process\.exit\(0\)/);
  const iDeploy = guard.indexOf('.checkDeployments(');

  assert.notStrictEqual(iCode, -1, 'checkCode() 호출이 사라졌다 — 훅이 코드 검사를 안 한다');
  assert.notStrictEqual(iBypass, -1, 'BYPASS 조기 종료 앵커를 못 찾았다 — 훅 구조가 바뀌었으니 이 테스트를 갱신할 것');
  assert.notStrictEqual(iDeploy, -1, 'checkDeployments() 호출이 사라졌다');

  assert.ok(iCode < iBypass, 'checkCode()가 BYPASS 뒤로 밀렸다 — 임시 러너 경로에서 보안 검사가 통째로 죽는다');

  /* [2026-08-31] 이 검사를 되살리면서 한 칸이 비어 있는 것을 봤다 — 순서를 셋이 아니라
   *   둘만 재고 있었다. 08-26 실측: BYPASS 줄이 0번(워크트리 배포 차단)보다 18줄 «앞»에
   *   있어 `CLASP_GUARD_BYPASS=1 clasp push` 한 줄로 **워크트리에서 라이브로 밀 수 있었다**.
   *   그때 이 파일은 이미 걷혀 있었고, 설사 있었어도 위 세 줄만으로는 **초록이었다**.
   * 훅 자신이 「0번은 절차가 아니라 **사실**이다 · 5-A 보안검사와 같은 급으로 BYPASS 밖에 둔다」고
   *   적어 둔다 — 그 문장을 여기서 기계로 바꾼다. 라이브는 하나뿐이라 이건 우회 대상이 아니다. */
  const iWorktree = guard.indexOf("'--git-common-dir'");
  assert.notStrictEqual(iWorktree, -1, '워크트리 판정(0번) 앵커를 못 찾았다 — 훅 구조가 바뀌었으니 이 테스트를 갱신할 것');
  assert.ok(iWorktree < iBypass,
    '워크트리 배포 차단(0번)이 BYPASS 뒤로 밀렸다 — 한 줄로 워크트리에서 라이브로 밀 수 있게 된다(08-26 실사고)');
  assert.ok(iBypass < iDeploy, 'checkDeployments()가 BYPASS 앞으로 왔다 — 러너 운용 중 정상 상태를 위반으로 잡는다');
});

/* 두 갈래가 모두 존재하는지만 본다. check()를 실제로 부르면 `clasp deployments`가 돌아
 * 이 테스트 하나가 7.5초를 먹는데, 이 파일은 배포마다 clasp-guard가 통째로 실행한다.
 * 네트워크는 CLI가 부를 때 한 번이면 충분하다 — checkCode()는 파일만 읽어 즉시 끝난다. */
test('두 갈래가 다 있고 checkCode()는 네트워크 없이 돈다', () => {
  assert.strictEqual(typeof mod.checkCode, 'function');
  assert.strictEqual(typeof mod.checkDeployments, 'function');
  assert.strictEqual(typeof mod.check, 'function');
  assert.ok(Array.isArray(mod.checkCode()), 'checkCode()는 문제 목록 배열을 돌려줘야 한다');
});

test('looksSecret — 난수 토큰은 잡는다(미탐 방지)', () => {
  /* 08-02 실사고 토큰과 **같은 모양의 합성 문자열**(소문자·대문자·숫자·구분자 4종, 32자).
   * 실제 토큰을 픽스처로 쓰지 않는다 — 그 토큰은 이미 폐기됐지만, 「탐지기 테스트에 진짜 토큰을
   * 붙여넣는다」는 관행이 다음에 살아 있는 토큰에 적용되면 그때는 실사고다. 탐지력은 동일하다. */
  assert.strictEqual(looksSecret('Xk7Qm2Vt-9RbLpZa4wNc0HsE_JyU1oGf'), true);
  assert.strictEqual(looksSecret('AKfycbyu3CD5tD-0saS42bWiS7CAtl2z'), true);
  // 대소문자가 없는 hex 다이제스트 — 문자 종류 규칙만으로는 새므로 따로 태우는 경로
  assert.strictEqual(looksSecret('a3f9c2e1b8d74f60a3f9c2e1b8d74f60'), true);
});

test('looksSecret — 사람이 지은 이름은 잡지 않는다(오탐 방지)', () => {
  // 이 한 줄이 08-02에 실제로 오탐났던 값이다. 회귀하면 여기서 죽는다.
  assert.strictEqual(looksSecret('purgeTestCheckins'), false);
  assert.strictEqual(looksSecret('updateBizDashboard'), false);
  assert.strictEqual(looksSecret('sheetSelfHealNow'), false);
});

test('topLevelFunctions — doGet 본문이 다음 함수까지만 잘린다', () => {
  const src = [
    'function doGet(e) {',
    '  const p = e.parameter;',
    '  return ok(p);',
    '}',
    '',
    'function doPost(e) {',
    '  sh.deleteRow(2);',   // doPost의 삭제는 doGet 본문에 새면 안 된다
    '}',
  ].join('\n');
  const fns = topLevelFunctions(src);
  assert.deepStrictEqual(fns.map((f) => f.name), ['doGet', 'doPost']);
  assert.ok(!fns[0].body.includes('deleteRow'), 'doGet 본문이 doPost까지 삼켰다 — 경계 판정 붕괴');
  assert.strictEqual(fns[0].line, 1);
  assert.strictEqual(fns[1].line, 6);
});

/* 아래 3줄은 2026-08-02 `clasp deployments` **실제 출력**이다(설명만 원문 유지, ID는 그대로).
 * 임시 배포를 잘 정리할수록 이 판정은 라이브에서 한 번도 안 돌아 — 깨져도 초록이 된다.
 * 그래서 실측 출력을 여기 박아 테스트가 대신 지킨다. */
test('parseDeploymentLine — 임시 배포를 가려낸다', () => {
  const temp = parseDeploymentLine(
    '- AKfycbz-UieG50Mom61UXIrEt-gvqXBWVHiIIaAMVFxPp_-ZuQXrmcQ6rvQeA8K8LIvc5Bic @28 - temp-data-cleanup-runner'
  );
  assert.strictEqual(temp.ver, '28');
  assert.strictEqual(temp.desc, 'temp-data-cleanup-runner', "설명 앞의 '- '가 안 떨어졌다");
  assert.strictEqual(temp.temp, true);

  // @HEAD 줄은 설명이 비어 있다 — 여기서 temp=true가 되면 상시 배포가 매번 걸려 가드가 노이즈가 된다
  const head = parseDeploymentLine('- AKfycbyErIaGA8TGxVMoVO3r5ou1RllX9l1-uMJx4p4CrG0 @HEAD ');
  assert.strictEqual(head.ver, 'HEAD');
  assert.strictEqual(head.temp, false);

  assert.strictEqual(parseDeploymentLine('Found 3 deployments.'), null);
});

test('topLevelFunctions — 문자열·주석 안의 중괄호에 속지 않는다', () => {
  const src = [
    'function doGet(e) {',
    '  const s = "}{ 닫는 괄호처럼 생긴 문자열 }";',
    '  /* } 주석 안의 닫는 괄호 */',
    '  return s;',
    '}',
    'function next() { return 1; }',
  ].join('\n');
  const fns = topLevelFunctions(src);
  assert.deepStrictEqual(fns.map((f) => f.name), ['doGet', 'next']);
  assert.ok(fns[0].body.includes('return s;'), 'doGet 본문이 문자열 중괄호에서 조기 종료됐다');
});

/* 배포 내용 검증은 PATH·실제 자격증명·네트워크를 쓰지 않는다. child_process만 모의로 바꾸고
 * 실제 임시 파일을 받아 비교하는 라이브대조·점검·도장 접기를 함께 통과시킨다. */
function 배포내용모의(t, options = {}) {
  const os = require('node:os');
  const { createRequire } = require('node:module');
  const 기준 = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(기준, 'synk-deploy-test-'));
  const projRoot = options.하위 ? path.join(root, 'crewcard') : root;
  fs.mkdirSync(projRoot, { recursive: true });
  const 파일들 = options.파일들 || { 'Code.js': 'const current = 1;\n', 'appsscript.json': '{}\n' };
  const 쓰기 = (dir, files) => {
    for (const [rel, value] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), value);
    }
  };
  쓰기(projRoot, 파일들);
  fs.writeFileSync(path.join(projRoot, '.clasp.json'), JSON.stringify({ scriptId: 'fixture-project', scriptExtensions: ['.js'] }));
  fs.writeFileSync(path.join(projRoot, '.claspignore'), '**/*\n!Code.js\n!appsscript.json\n');
  const pulls = [], 명령들 = [];
  t.after(() => {
    for (const p of pulls) assert.strictEqual(fs.existsSync(p.cwd), false, '받은 임시 파일이 남았다');
    assert.strictEqual(path.dirname(path.resolve(root)), 기준, '시험 정리 경로가 임시 기준 밖이다');
    fs.rmSync(root, { recursive: true, force: true });
  });
  let D;
  const 실행 = (bin, args, opts) => {
    명령들.push({ bin, args, opts });
    if (bin === 'git') {
      if (args.includes('status')) return options.미커밋 || '';
      if (args[0] === 'log') return ''; // 다른 원문은 과거 판을 지어내지 않고 모름으로 남긴다.
      if (args[0] === 'rev-list') return '1';
      throw new Error('예상 밖 git 호출: ' + args.join(' '));
    }
    if (args.includes('deployments')) {
      if (options.목록실패) throw new Error('모의 배포 목록 조회 실패');
      const fp = D.지문(projRoot, root);
      return (options.배포들 || [{ id: 'fixture-head', ver: 'HEAD' }])
        .map((d) => `- ${d.id} @${d.ver} - ${d.desc === '일치' ? '#fp:' + fp : d.desc || ''}`).join('\n');
    }
    if (args.includes('pull')) {
      const at = args.indexOf('--versionNumber');
      const version = at < 0 ? 'HEAD' : args[at + 1];
      pulls.push({ version, cwd: opts.cwd, args, opts });
      const files = Object.prototype.hasOwnProperty.call(options.원격 || {}, version) ? options.원격[version] : 파일들;
      if (files instanceof Error) throw files;
      쓰기(opts.cwd, files);
      if (options.받은뒤) options.받은뒤(version, projRoot);
      return '받음';
    }
    throw new Error('예상 밖 외부 명령 — 실제로 실행하지 않음');
  };
  const entry = path.resolve(__dirname, '../tools/배포판점검.js');
  const localRequire = createRequire(entry);
  const module = { exports: {} };
  new Function('require', 'module', '__dirname', fs.readFileSync(entry, 'utf8').replace(/^#![^\r\n]*/, ''))(
    (id) => id === 'child_process' ? { execFileSync: 실행 } : localRequire(id), module, path.dirname(entry));
  D = module.exports;
  return { D, root, projRoot, pulls, 명령들, 파일들 };
}

test('라이브 — 설명 지문이 맞아도 HEAD와 실제 고정 버전 둘을 읽어 낡은 원문을 잡는다', (t) => {
  const f = 배포내용모의(t, {
    배포들: [{ id: 'live-44', ver: '44', desc: '일치' }],
    원격: { 44: { 'Code.js': 'const current = 0;\n', 'appsscript.json': '{}\n' } },
  });
  const r = f.D.점검(f.projRoot, f.root, { 라이브: true, 시간제한: 3456 });
  assert.deepStrictEqual(f.pulls.map((p) => p.version), ['HEAD', '44']);
  assert.strictEqual(r.level, 'stale');
  assert.strictEqual(r.측정, true);
  assert.strictEqual(r.프로젝트HEAD.level, 'ok');
  assert.strictEqual(r.고정버전들[0].level, 'stale');
  assert.deepStrictEqual(r.파일들, ['Code.js']);
  assert.strictEqual(f.D.실측접기(r, f.projRoot, f.root).초록, false);
  assert.match(r.lines.join('\n'), /프로젝트 HEAD.*고정 버전/);
  for (const c of f.명령들) {
    assert.strictEqual(c.opts.windowsHide, true, '외부 명령 창을 숨긴다');
    assert.ok(c.opts.timeout > 0, '외부 명령에 제한 시간이 있다');
  }
  for (const p of f.pulls) {
    assert.strictEqual(p.opts.timeout, 3456);
    assert.ok(path.relative(f.root, p.cwd).startsWith('..'), '작업본 밖에서 받는다');
  }
});

test('라이브 — 설명이 없거나 틀려도 실제 원문이 같으면 확인되며 같은 버전은 한 번만 받는다', (t) => {
  const f = 배포내용모의(t, {
    배포들: [
      { id: 'head', ver: 'HEAD' }, { id: 'one', ver: '44' },
      { id: 'two', ver: '44', desc: '#fp:00000000' }, { id: 'three', ver: '45' },
      { id: 'ephemeral', ver: '46', desc: 'temp-fixture' },
    ],
  });
  const r = f.D.점검(f.projRoot, f.root, { 라이브: true });
  assert.deepStrictEqual(f.pulls.map((p) => p.version), ['HEAD', '44', '45']);
  assert.strictEqual(r.level, 'ok');
  assert.strictEqual(r.측정, true);
  assert.deepStrictEqual(r.고정버전들[0].배포들, ['one', 'two']);
  assert.strictEqual(f.D.실측접기(r, f.projRoot, f.root).초록, true);
});

test('라이브 — 고정 배포가 없어도 프로젝트 HEAD 원문을 읽는다', (t) => {
  const f = 배포내용모의(t);
  const r = f.D.점검(f.projRoot, f.root, { 라이브: true });
  assert.deepStrictEqual(f.pulls.map((p) => p.version), ['HEAD']);
  assert.strictEqual(r.level, 'ok');
  assert.strictEqual(r.고정버전들.length, 0);
  assert.strictEqual(r.측정, true);
});

test('라이브 — HEAD 또는 고정 버전 다운로드 실패는 다른 대상까지 재고 전체 도장을 미확인으로 남긴다', (t) => {
  for (const 실패 of ['HEAD', '44']) {
    const f = 배포내용모의(t, {
      배포들: [{ id: 'one', ver: '44', desc: '일치' }],
      원격: { [실패]: new Error('모의 다운로드 실패') },
    });
    const r = f.D.점검(f.projRoot, f.root, { 라이브: true });
    assert.deepStrictEqual(f.pulls.map((p) => p.version), ['HEAD', '44']);
    assert.strictEqual(r.level, 'unreachable');
    assert.strictEqual(r.측정, false);
    assert.strictEqual(f.D.실측접기(r, f.projRoot, f.root).초록, false);
    assert.match(r.lines.join('\n'), /확인 불가/);
  }
});

test('라이브 — 배포 목록을 못 읽어도 HEAD는 재지만 고정 버전 0으로 접지 않는다', (t) => {
  const f = 배포내용모의(t, { 목록실패: true });
  const r = f.D.점검(f.projRoot, f.root, { 라이브: true });
  assert.deepStrictEqual(f.pulls.map((p) => p.version), ['HEAD']);
  assert.strictEqual(r.프로젝트HEAD.level, 'ok');
  assert.strictEqual(r.배포목록확인, false);
  assert.strictEqual(r.측정, false);
  assert.strictEqual(f.D.실측접기(r, f.projRoot, f.root).초록, false);
});

test('라이브대조 — 하위 프로젝트 경로를 맞추고 로컬에 있어도 배포집합 밖인 원격 파일은 잡는다', (t) => {
  const f = 배포내용모의(t, { 하위: true });
  const equal = f.D.라이브대조(f.projRoot, f.root, { versionNumber: 44 });
  assert.deepStrictEqual(equal.다름, []);
  assert.deepStrictEqual(equal.라이브없음, []);
  assert.deepStrictEqual(equal.저장소없음, []);
  const g = 배포내용모의(t, {
    하위: true,
    파일들: { 'Code.js': 'x\n', 'appsscript.json': '{}\n', 'unused.js': 'ignored\n' },
  });
  const extra = g.D.라이브대조(g.projRoot, g.root, { versionNumber: 44 });
  assert.deepStrictEqual(extra.저장소없음, ['crewcard/unused.js']);
  assert.strictEqual(extra.총, 2);
});

test('라이브 — 줄바꿈만 다르면 내용 일치와 원문 바이트 불일치를 구분해 영구 뒤처짐으로 만들지 않는다', (t) => {
  const f = 배포내용모의(t, { 원격: { HEAD: { 'Code.js': 'const current = 1;\r\n', 'appsscript.json': '{}\n' } } });
  const r = f.D.점검(f.projRoot, f.root, { 라이브: true });
  assert.strictEqual(r.level, 'ok');
  assert.strictEqual(r.측정, true);
  assert.strictEqual(r.원문바이트일치, false);
  assert.match(r.lines.join('\n'), /CRLF\/LF만 바꾸면 같음\(원문 바이트는 다름\)/);
  assert.strictEqual(f.D.실측접기(r, f.projRoot, f.root).초록, true);
});

test('라이브 — 템플릿 문자열 줄끝 공백 차이를 정상 내용 일치로 숨기지 않는다', (t) => {
  const f = 배포내용모의(t, {
    파일들: { 'Code.js': 'const text = `line \nnext`;\n', 'appsscript.json': '{}\n' },
    원격: { HEAD: { 'Code.js': 'const text = `line\nnext`;\n', 'appsscript.json': '{}\n' } },
  });
  const r = f.D.점검(f.projRoot, f.root, { 라이브: true });
  assert.strictEqual(r.level, 'stale');
  assert.strictEqual(r.원문바이트일치, false);
  assert.deepStrictEqual(r.프로젝트HEAD.표기차이, []);
  assert.strictEqual(f.D.실측접기(r, f.projRoot, f.root).초록, false);
});

test('라이브 — 대상 사이에 작업본이 바뀌면 각각 같아 보여도 전체 일치 도장은 찍지 않는다', (t) => {
  const newer = { 'Code.js': 'const current = 2;\n', 'appsscript.json': '{}\n' };
  const f = 배포내용모의(t, {
    배포들: [{ id: 'one', ver: '44' }], 원격: { 44: newer },
    받은뒤: (v, dir) => { if (v === '44') fs.writeFileSync(path.join(dir, 'Code.js'), newer['Code.js']); },
  });
  const r = f.D.점검(f.projRoot, f.root, { 라이브: true });
  assert.strictEqual(r.프로젝트HEAD.level, 'ok');
  assert.strictEqual(r.고정버전들[0].level, 'ok');
  assert.strictEqual(r.측정, false);
  assert.strictEqual(f.D.실측접기(r, f.projRoot, f.root).초록, false);
});

test('비라이브 — 설명 지문 일치도 간접 증거이며 원문 실측 도장을 만들지 않는다', (t) => {
  const f = 배포내용모의(t, { 배포들: [{ id: 'one', ver: '44', desc: '일치' }] });
  const r = f.D.점검(f.projRoot, f.root);
  assert.deepStrictEqual(f.pulls, []);
  assert.strictEqual(r.level, 'ok');
  assert.strictEqual(r.측정, false);
  assert.match(r.lines.join('\n'), /간접 증거.*실제 내용은 미확인/);
  assert.doesNotMatch(r.lines.join('\n'), /라이브 최신|옛 코드를 서빙한다/);
  assert.strictEqual(f.D.실측접기(r, f.projRoot, f.root).초록, false);
});

test('라이브대조 — 잘못된 버전 번호는 외부 명령 전에 거부한다', (t) => {
  const f = 배포내용모의(t);
  assert.throws(() => f.D.라이브대조(f.projRoot, f.root, { versionNumber: '44 & echo unexpected' }), /버전 번호/);
  assert.deepStrictEqual(f.명령들, []);
});

test('실측접기 — 점검 반환 뒤 파일이 바뀌면 검증 당시 지문을 보존하고 초록을 해제한다', (t) => {
  const f = 배포내용모의(t);
  const r = f.D.점검(f.projRoot, f.root, { 라이브: true });
  assert.strictEqual(r.level, 'ok');
  assert.strictEqual(r.localFp, f.D.지문(f.projRoot, f.root));
  const 같은판 = f.D.실측접기(r, f.projRoot, f.root);
  assert.strictEqual(같은판.측정, true);
  assert.strictEqual(같은판.초록, true);
  fs.writeFileSync(path.join(f.projRoot, 'Code.js'), 'const current = 9;\n');
  const 다른판 = f.D.실측접기(r, f.projRoot, f.root);
  assert.notStrictEqual(f.D.지문(f.projRoot, f.root), r.localFp);
  assert.strictEqual(다른판.지문, r.localFp, '검증하지 않은 새 작업본 지문에 옛 결과를 붙이지 않는다');
  assert.strictEqual(다른판.측정, false);
  assert.strictEqual(다른판.초록, false);
  assert.strictEqual(r.측정, true, '과거 관찰 자체를 현재 미측정으로 바꿔 쓰지 않는다');
});
