'use strict';
/* CI 읽기 기록 — `NODE_OPTIONS=--require <이 파일>`로 미리 읽혀, 이 프로세스가 fs로 건드린 경로와 띄운 자식 명령을
 * SYNK_READ_TRACE_DIR/<pid>-<시각>.json 하나로 남긴다(2026-10-20). tools/ci읽기대조.cjs가 읽는다.
 *
 * 왜 있나: 기록 전용 경로만 바꾼 push는 무거운 검사를 건너뛰고(syntax-check.yml의 paths-ignore) 그 경로를 읽는
 *   시험만 records-check.yml이 돈다. 무거운 검사의 체크아웃은 미디어를 뺀다(희소). 둘 다 「어느 시험이 무엇을
 *   읽는가」가 맞아야 안전하므로, 무거운 검사가 돌 때마다 실제 읽기를 적어 대조한다.
 * 프로그램 동작은 바꾸지 않는다 — 감싼 함수는 경로를 적고 원래 함수를 그대로 부른다. 붙은 함수(realpathSync.native 등)도
 *   그대로 옮긴다(빠뜨리면 prism래칫이 루트를 못 읽는다). 기록이 실패해도 조용히 넘어간다. */
const OUT = process.env.SYNK_READ_TRACE_DIR;
if (OUT) {
  const fs = require('node:fs');
  const path = require('node:path');
  const cp = require('node:child_process');
  const Module = require('node:module');
  const { fileURLToPath } = require('node:url');
  const reads = new Map();
  const spawns = [];
  const note = (kind, p) => {
    try {
      if (Buffer.isBuffer(p)) p = p.toString('utf8');
      else if (p instanceof URL) p = fileURLToPath(p);
      if (typeof p !== 'string' || !p) return;
      const full = path.resolve(p);
      let kinds = reads.get(full);
      if (!kinds) reads.set(full, kinds = new Set());
      kinds.add(kind);
    } catch { /* 기록은 프로그램을 막지 않는다 */ }
  };
  const wrapOne = (orig, kind) => {
    const wrapped = function (p, ...rest) { note(kind, p); return orig.call(this, p, ...rest); };
    Object.defineProperty(wrapped, 'name', { value: orig.name });
    return wrapped;
  };
  const wrap = (owner, name, kind) => {
    const orig = owner[name];
    if (typeof orig !== 'function') return;
    const wrapped = wrapOne(orig, kind);
    for (const key of Object.keys(orig)) wrapped[key] = typeof orig[key] === 'function' ? wrapOne(orig[key], kind) : orig[key];
    try { owner[name] = wrapped; } catch { /* 읽기 전용이면 둔다 */ }
  };
  const 종류 = { readFileSync: 'read', readFile: 'read', createReadStream: 'read', copyFileSync: 'read', copyFile: 'read', cpSync: 'read', cp: 'read',
    openSync: 'open', open: 'open', existsSync: 'exists', exists: 'exists', statSync: 'stat', stat: 'stat', lstatSync: 'stat', lstat: 'stat',
    accessSync: 'stat', access: 'stat', realpathSync: 'stat', realpath: 'stat', readlinkSync: 'stat', readlink: 'stat',
    readdirSync: 'dir', readdir: 'dir', opendirSync: 'dir', opendir: 'dir' };
  for (const [name, kind] of Object.entries(종류)) wrap(fs, name, kind);
  for (const [name, kind] of Object.entries(종류)) if (fs.promises && name in fs.promises) wrap(fs.promises, name, kind);
  for (const name of ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync', 'fork']) {
    const orig = cp[name];
    if (typeof orig !== 'function') continue;
    cp[name] = function (command, args, options) {
      try {
        const list = Array.isArray(args) ? args.map(String) : [];
        const opts = Array.isArray(args) ? options : args;
        const env = opts && opts.env ? opts.env : process.env;
        spawns.push({ command: String(command).slice(0, 500), args: list.slice(0, 80).map((a) => a.slice(0, 500)),
          cwd: opts && opts.cwd ? path.resolve(String(opts.cwd)) : process.cwd(),
          ...(env.GIT_DIR ? { gitDir: path.resolve(String(env.GIT_DIR)) } : {}),
          ...(env.GIT_WORK_TREE ? { gitWorkTree: path.resolve(String(env.GIT_WORK_TREE)) } : {}) });
      } catch { /* 위와 같다 */ }
      return orig.apply(this, arguments);
    };
  }
  try { Module.syncBuiltinESMExports(); } catch { /* ESM 이름 가져오기에도 감싼 판이 보이게 */ }
  process.on('exit', () => {
    try {
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, `${process.pid}-${Date.now()}.json`), JSON.stringify({ pid: process.pid, ppid: process.ppid,
        argv: process.argv, cwd: process.cwd(), reads: [...reads].map(([p, kinds]) => [p, [...kinds]]), spawns }));
    } catch { /* 위와 같다 */ }
  });
}
