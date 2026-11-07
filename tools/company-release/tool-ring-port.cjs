'use strict';
// 고정 도구 고리를 판 안으로(사슬 56~) — 다음 판 생성기(p<N>-operators · port-rearm<N>)가 앞 판 원천을 옮길 때 부르는 글자 변환.
// 봉인된 부모(trusted-parent-port.cjs) 뒤에도 판 계보에 남던 옛 도구 고리 셋을 판 안으로 옮기거나 걷는다(README 「고정 도구 고리」).
//   G1 deployment/scope.cjs 상속 사슬(…→ 맨 밑 pulse-workspace-integration-20261013/scope.cjs): 판이 받는 도우미 다섯 · 상수 다섯 · prior만 판 안 scope-base.cjs로.
//   G2 rearm-ops/rearm-prepare-fresh.cjs의 Codex 증거 거울(이력 18): 봉인 역사 경계 뒤로 닿는 길이 없는 죽은 길 — 걷으면 그 경로는 LOCAL_REPOSITORY_PATH_REQUIRED로 멈춘다.
//   G3 rearm/linux-qa.cjs sources()의 옛 승인 사슬 맨 밑 두 파일(pulse-harin-motion-20261012/ha-compat) — 어떤 시험도 부르지 않는 흔적.
// 글자만 바꾸고 판 코드를 실행하지 않는다(scopeBaseEquivalence만 옛 사슬과 새 도우미를 불러 대조한다). 운영 값은 부르는 쪽(.tmp 생성기)이 넘긴다.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const a = require('node:assert/strict');

const FUNCTIONS = Object.freeze(['sha', 'safeName', 'readRegular', 'verify', 'writeNew']);
const VALUES = Object.freeze(['COMPANY', 'PUBLIC', 'MESSENGER', 'WORKERS', 'RUNTIME_NAMES']);
const count = (s, x) => s.split(x).length - 1;
function once(s, before, after, label) { a.equal(count(s, before), 1, 'EXACT_PORT_ANCHOR ' + (label || before.slice(0, 90))); return s.replace(before, () => after); }
const folderName = (n) => { a.ok(typeof n === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(n), 'FOLDER_NAME'); return n; };

/** 맨 밑 모듈 원문에서 도우미 다섯의 정의 문장을 바이트 그대로 자른다 — 살아 있는 함수의 toString()이 원문에 정확히 한 번 있어야 한다. */
function bottomDefinitions(bottomText, bottom) {
  const out = {};
  for (const k of FUNCTIONS) {
    a.equal(typeof bottom[k], 'function', 'SCOPE_BASE_BOTTOM_FUNCTION ' + k);
    const src = bottom[k].toString();
    const stmt = k === 'sha' ? `const sha=${src};` : src;
    if (k !== 'sha') a.ok(src.startsWith(`function ${k}(`), 'SCOPE_BASE_DECLARATION ' + k);
    a.equal(count(bottomText, stmt), 1, 'SCOPE_BASE_SOURCE_ONCE ' + k);
    out[k] = stmt;
  }
  return out;
}

/**
 * deployment/scope-base.cjs 글. oldChain = 판 scope.cjs가 지금 부르는 상속 모듈(예: company-sns-auth-…/deployment/scope.cjs)의 내보내기,
 * bottom = 그 사슬 맨 밑 모듈 내보내기, bottomText = 맨 밑 모듈 원문, priorRelative = scope-base.cjs 자리에서 oldChain.prior까지의 상대 경로('/' 구분).
 * 부르는 쪽은 scopeBaseEquivalence로 옛 사슬과 같은지 본 뒤에만 쓴다. 판마다 같은 바이트로 이어 옮긴다.
 */
function scopeBase({ oldChain, bottom, bottomText, priorRelative }) {
  for (const k of FUNCTIONS) a.ok(oldChain[k] === bottom[k], 'SCOPE_CHAIN_OVERRIDES ' + k); // 사슬 중간이 덮지 않았다 — 같은 함수 객체
  for (const k of VALUES) a.ok(oldChain[k] !== undefined && JSON.stringify(oldChain[k]) !== undefined, 'SCOPE_BASE_VALUE ' + k);
  a.ok(typeof oldChain.prior === 'string' && path.isAbsolute(oldChain.prior), 'SCOPE_BASE_PRIOR');
  a.ok(typeof priorRelative === 'string' && !path.isAbsolute(priorRelative) && !priorRelative.includes('\\') && priorRelative.split('/').every((x) => x === '..' || /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(x)), 'SCOPE_BASE_PRIOR_RELATIVE');
  const d = bottomDefinitions(bottomText, bottom);
  const value = (k) => { const v = oldChain[k]; a.equal(Object.isFrozen(v) && typeof v === 'object', false, 'SCOPE_BASE_VALUE_FROZEN ' + k); return JSON.stringify(v); };
  const text = [
    "'use strict';",
    '// 고정 도구 고리를 판 안으로(사슬 56~, tools/company-release/tool-ring-port.cjs scopeBase): 옛 deployment/scope.cjs 상속 사슬이 판 scope.cjs에 넘기던 것만 둔다.',
    '// 도우미 다섯은 사슬 맨 밑 모듈의 정의 문장을 바이트 그대로 옮겼고, 상수 다섯과 prior는 생성 때 옛 사슬 내보내기에서 옮겼다 — 생성기가 scopeBaseEquivalence로 같음을 확인했다.',
    "const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),a=require('node:assert/strict');",
    `const COMPANY=${value('COMPANY')},PUBLIC=${value('PUBLIC')},MESSENGER=${value('MESSENGER')};`,
    `const WORKERS=${value('WORKERS')},RUNTIME_NAMES=${value('RUNTIME_NAMES')};`,
    `const prior=path.resolve(__dirname,${JSON.stringify(priorRelative)});`,
    d.sha, d.safeName, d.readRegular, d.verify, d.writeNew,
    'module.exports={prior,COMPANY,PUBLIC,MESSENGER,WORKERS,RUNTIME_NAMES,sha,safeName,readRegular,verify,writeNew};',
    '',
  ].join('\n');
  new vm.Script(text, { filename: 'scope-base.cjs' });
  return text;
}

/** 던지면 그 꼴(이름 · 코드 · 메시지), 아니면 null. */
const thrown = (f) => { try { f(); return null; } catch (e) { return [e && e.name, e && e.code, e && e.message].join('|'); } };

/**
 * 새 scope-base가 옛 사슬과 같은지 — 함수는 같은 글(toString) · 같은 행동(probes), 값은 같은 JSON · 같은 꼴, prior는 같은 경로.
 * probes: { candidate: {root, manifestSha256} } — 진짜 부모 후보 트리(verify가 통째로 읽는다). 옛 사슬이 남아 있을 때(첫 옮김) 한 번 돈다.
 */
function scopeBaseEquivalence(next, oldChain, bottom, probes) {
  for (const k of FUNCTIONS) {
    a.ok(oldChain[k] === bottom[k], 'SCOPE_CHAIN_OVERRIDES ' + k);
    a.equal(typeof next[k], 'function', 'SCOPE_BASE_FUNCTION ' + k);
    a.equal(next[k].toString(), oldChain[k].toString(), 'SCOPE_BASE_SOURCE ' + k);
  }
  for (const k of [...VALUES, 'prior']) {
    a.equal(JSON.stringify(next[k]), JSON.stringify(oldChain[k]), 'SCOPE_BASE_VALUE ' + k);
    a.equal(Array.isArray(next[k]), Array.isArray(oldChain[k]), 'SCOPE_BASE_VALUE_SHAPE ' + k);
    a.equal(Object.isFrozen(next[k]), Object.isFrozen(oldChain[k]), 'SCOPE_BASE_VALUE_FROZEN ' + k);
  }
  a.deepEqual(Object.keys(next).sort(), [...FUNCTIONS, ...VALUES, 'prior'].sort(), 'SCOPE_BASE_EXPORTS');
  // 행동: sha
  for (const v of [Buffer.from('raw'), 'text', '한글', Buffer.alloc(0)]) a.equal(next.sha(v), oldChain.sha(v), 'SCOPE_BASE_SHA');
  // safeName — 받는 이름 · 거절 꼴
  for (const n of ['a', 'a/b.json', 'docs/x y/z', '', '/abs', 'a\\b', '../x', 'a/../b', './x', 'a/./b', 'a//b', 7, null]) a.equal(thrown(() => next.safeName(n)), thrown(() => oldChain.safeName(n)), 'SCOPE_BASE_SAFE_NAME ' + String(n));
  // 임시 트리에서 readRegular · verify · writeNew
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-scope-base-'));
  try {
    const tree = path.join(room, 'tree'); fs.mkdirSync(path.join(tree, 'd'), { recursive: true });
    fs.writeFileSync(path.join(tree, 'd', 'x.txt'), 'x'); fs.writeFileSync(path.join(tree, 'y.json'), '{"y":1}');
    const rows = [['d/x.txt', 'x'], ['y.json', '{"y":1}']].map(([p, b]) => ({ path: p, bytes: Buffer.byteLength(b), sha256: next.sha(b) }));
    const manifest = Buffer.from(JSON.stringify({ files: rows }));
    fs.writeFileSync(path.join(tree, 'release-manifest.json'), manifest);
    const digest = next.sha(manifest);
    for (const [r, n] of [[tree, 'y.json'], [tree, 'd'], [tree, 'none.json'], [tree, '../tree/y.json']]) {
      a.equal(thrown(() => next.readRegular(r, n)), thrown(() => oldChain.readRegular(r, n)), 'SCOPE_BASE_READ_REGULAR ' + n);
      if (!thrown(() => next.readRegular(r, n))) a.ok(next.readRegular(r, n).equals(oldChain.readRegular(r, n)), 'SCOPE_BASE_READ_BYTES');
    }
    const same = (r, h, label) => {
      const x = thrown(() => next.verify(r, h)), y = thrown(() => oldChain.verify(r, h));
      a.equal(x, y, 'SCOPE_BASE_VERIFY ' + label);
      if (!x) { const n = next.verify(r, h), o = oldChain.verify(r, h); a.ok(n.raw.equals(o.raw) && JSON.stringify(n.manifest) === JSON.stringify(o.manifest), 'SCOPE_BASE_VERIFY_RESULT ' + label); }
      return x;
    };
    a.equal(same(tree, digest, 'good'), null, 'SCOPE_BASE_VERIFY_GOOD');
    a.notEqual(same(tree, '0'.repeat(64), 'digest'), null);
    fs.writeFileSync(path.join(tree, 'extra.txt'), 'e'); a.notEqual(same(tree, digest, 'extra'), null); fs.rmSync(path.join(tree, 'extra.txt'));
    fs.writeFileSync(path.join(tree, 'y.json'), '{"y":2}'); a.notEqual(same(tree, digest, 'changed'), null); fs.writeFileSync(path.join(tree, 'y.json'), '{"y":1}');
    // 링크(Fable 11-07 P3): Windows는 권한 없이 만들 수 있는 junction, 그 밖은 디렉터리 링크 — readRegular(lstat)와 verify(walk)가 거절하는 꼴이 같아야 한다.
    const other = path.join(room, 'other'); fs.mkdirSync(other); fs.writeFileSync(path.join(other, 'f.txt'), 'f');
    try { fs.symlinkSync(other, path.join(tree, 'j'), process.platform === 'win32' ? 'junction' : 'dir'); } catch (e) { throw new Error('SCOPE_BASE_LINK_PROBE ' + (e && e.code)); }
    for (const n of ['j', 'j/f.txt']) a.equal(thrown(() => next.readRegular(tree, n)), thrown(() => oldChain.readRegular(tree, n)), 'SCOPE_BASE_READ_REGULAR_LINK ' + n);
    a.notEqual(same(tree, digest, 'link'), null);
    fs.rmSync(path.join(tree, 'j'), { recursive: false, force: true });
    a.equal(same(tree, digest, 'link removed'), null, 'SCOPE_BASE_VERIFY_GOOD_AGAIN');
    fs.rmSync(path.join(tree, 'd', 'x.txt')); a.notEqual(same(tree, digest, 'missing'), null);
    const w1 = path.join(room, 'w', 'deep', 'n.bin'), w2 = path.join(room, 'w2', 'deep', 'n.bin');
    a.equal(thrown(() => next.writeNew(w1, Buffer.from('n'))), thrown(() => oldChain.writeNew(w2, Buffer.from('n'))), 'SCOPE_BASE_WRITE_NEW');
    a.ok(fs.readFileSync(w1).equals(fs.readFileSync(w2)), 'SCOPE_BASE_WRITE_BYTES');
    a.equal(thrown(() => next.writeNew(w1, Buffer.from('m'))).replace(w1, '<f>'), thrown(() => oldChain.writeNew(w2, Buffer.from('m'))).replace(w2, '<f>'), 'SCOPE_BASE_WRITE_EXISTING');
  } finally { fs.rmSync(room, { recursive: true, force: true }); }
  // 진짜 부모 후보 트리(판 scope.cjs candidate()가 verify(parent, PARENT)로 통째로 읽는 것)
  const c = probes && probes.candidate;
  a.ok(c && typeof c.root === 'string' && /^[a-f0-9]{64}$/.test(c.manifestSha256 || ''), 'SCOPE_BASE_CANDIDATE_PROBE');
  const n = next.verify(c.root, c.manifestSha256), o = oldChain.verify(c.root, c.manifestSha256);
  a.ok(n.raw.equals(o.raw) && JSON.stringify(n.manifest) === JSON.stringify(o.manifest) && n.manifest.files.length > 0, 'SCOPE_BASE_CANDIDATE');
  return true;
}

/** deployment/scope.cjs: 상속 require 한 줄을 판 안 scope-base.cjs로. 다른 .tmp 판으로 가는 require가 남으면 멈춘다. 돌려주는 inheritedFolder는 생성 보고서용. */
function portScope(text) {
  const s = String(text), re = /const inherited=require\('\.\.\/\.\.\/([A-Za-z0-9][A-Za-z0-9._-]*)\/deployment\/scope\.cjs'\);/g;
  const found = [...s.matchAll(re)];
  a.equal(found.length, 1, 'EXACT_PORT_ANCHOR scope inherited');
  const out = s.replace(found[0][0], () => "const inherited=require('./scope-base.cjs');");
  a.equal(/require\(\s*['"]\.\.\/\.\.\//.test(out), false, 'SCOPE_OTHER_RELEASE_REQUIRE_LEFT');
  a.equal(out.includes(found[0][1]), false, 'SCOPE_INHERITED_FOLDER_LEFT');
  new vm.Script(out, { filename: 'scope.cjs' });
  return { text: out, inheritedFolder: folderName(found[0][1]) };
}

// G2 — 55 rearm-prepare-fresh.cjs의 정확한 글(판마다 같은 바이트로 이어 왔다).
const MIRROR_COMMENT = [
  '  // 이력 18: 부모 v7의 증거 JSON은 Codex 워크트리 원본 절대 경로를 적어 두었다. 그 두 폴더(live-preparation-v7·inert-v7)는 공용 작업본의 v7 거울에',
  '  // 같은 바이트로 있으므로 그 자리로 바꿔 읽는다(아래 sha·정규 파일·심볼릭 링크 검사는 그대로, 그 밖의 저장소 밖 경로는 전처럼 거절).',
  '',
].join('\n');
const MIRROR_LINES = [
  "  const MIRROR = path.join(readRoot, '.tmp', 'business-automation-release-20261020'), CODEX_V7 = ['C:', 'Users', 'q1212', '.codex', 'worktrees', 'business-automation', 'SYNK-appsscript', '.tmp', 'business-automation-20261020'].join(path.sep);",
  "  const CODEX_EVIDENCE = [[CODEX_V7 + path.sep + 'live-preparation-v7', MIRROR], [CODEX_V7 + path.sep + 'inert-v7', path.join(MIRROR, 'inert-v7')]];",
  '',
].join('\n');
const MIRROR_LOOP = 'for (const [from, to] of CODEX_EVIDENCE) if (full.startsWith(from + path.sep)) return to + full.slice(from.length); ';

/** rearm-ops/rearm-prepare-fresh.cjs: Codex 증거 거울(이력 18)을 걷는다 — CARRY_MIRROR(판 안 evidence-carry)는 그대로. */
function portPrepareFreshMirror(text) {
  let s = String(text);
  s = once(s, MIRROR_COMMENT, [
    '  // 이력 18의 Codex 증거 거울은 걷었다(사슬 56~, tool-ring-port.cjs): 그 v7 증거는 봉인 역사라 안쪽 걷기가 따라가지 않고, 맨 위 핀에는 그 경로가 없다.',
    '  // 그런 경로가 오면 아래 regular()가 LOCAL_REPOSITORY_PATH_REQUIRED로 멈춘다(판 안 evidence-carry 거울 하나만 바꿔 읽는다).',
    '',
  ].join('\n'), 'mirror comment');
  s = once(s, MIRROR_LINES, '', 'mirror lines');
  s = once(s, MIRROR_LOOP, '', 'mirror loop');
  // CARRY_MIRROR.source는 옛 Codex 작업트리 경로 글자를 쓴다(판 안 evidence-carry로 바꿔 읽는 한 파일) — 그래서 '.codex' 글자는 남는다.
  for (const x of ['business-automation', 'CODEX_EVIDENCE', 'CODEX_V7', 'live-preparation-v7', 'inert-v7']) a.equal(s.includes(x), false, 'MIRROR_LEFT ' + x);
  a.equal(/(?<!CARRY_)\bMIRROR\b/.test(s), false, 'MIRROR_LEFT MIRROR');
  a.ok(s.includes('CARRY_MIRROR'), 'CARRY_MIRROR_KEPT');
  new vm.Script(s, { filename: 'rearm-prepare-fresh.cjs' });
  return s;
}

const HA_COMPAT_QA = "for(const n of ['approval.cjs','postcheck.cjs'])add(path.resolve(__dirname,'../../pulse-harin-motion-20261012/ha-compat',n));";
/** rearm/linux-qa.cjs: sources()에서 옛 승인 사슬 맨 밑 두 파일(ha-compat)을 뺀다. */
function portLinuxQa(text) {
  const s = once(String(text), HA_COMPAT_QA, '', 'ha-compat qa sources');
  for (const x of ['pulse-harin-motion', 'ha-compat']) a.equal(s.includes(x), false, 'HA_COMPAT_LEFT ' + x);
  new vm.Script(s, { filename: 'linux-qa.cjs' });
  return s;
}

module.exports = { FUNCTIONS, VALUES, bottomDefinitions, scopeBase, scopeBaseEquivalence, portScope, portPrepareFreshMirror, portLinuxQa, _anchors: Object.freeze({ MIRROR_COMMENT, MIRROR_LINES, MIRROR_LOOP, HA_COMPAT_QA }) };
