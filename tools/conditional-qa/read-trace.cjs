'use strict';
// Loaded by NODE_OPTIONS=--require into every process of a verification. A file that is gone makes a test fail, but a test that only asks whether it exists would pass
// and quietly check less. So touching docs left out of the checkout is written down at once, even by a process killed later, and verify() fails that run.
// It only records, and a failure to record stops nothing: the same technique as tools/ci읽기기록.cjs, whose name run.cjs would strip from the environment (SYNK_*).
const OUT = process.env.CQA_TRACE_DIR, ROOT = process.env.CQA_TRACE_ROOT;
if (OUT && ROOT) {
  const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
  const { fileURLToPath } = require('node:url');
  const { outsideTestedTree, onTheWay } = require('./tested-tree.cjs');
  const { appendFileSync, mkdirSync } = fs;
  const docs = path.join(path.resolve(ROOT), 'docs').toLowerCase(), skip = path.resolve(ROOT).length + 1, seen = new Set();
  const note = (value, listing) => {
    try {
      if (Buffer.isBuffer(value)) value = value.toString('utf8');
      else if (value instanceof URL) value = fileURLToPath(value);
      else if (typeof value === 'string' && value.startsWith('file:')) value = fileURLToPath(value);
      if (typeof value !== 'string' || !value) return;
      const full = path.resolve(value), lower = full.toLowerCase();
      if (lower !== docs && !lower.startsWith(docs + path.sep)) return;
      // Windows opens DOCS/x as docs/x, so the folder name is compared as the list spells it. A kept path in other capitals counts as outside, which only ever fails a run.
      const file = `docs${full.slice(skip + 'docs'.length).split(path.sep).join('/')}`;
      // Stat-ing a folder on the way to a kept path is the way there. Listing it would quietly show fewer files than the commit has, so that counts.
      const inside = lower === docs ? false : outsideTestedTree(file) && !onTheWay(file);
      if (seen.has(file) || !(inside || (listing && (lower === docs || onTheWay(file))))) return;
      seen.add(file);
      mkdirSync(OUT, { recursive: true });
      appendFileSync(path.join(OUT, `${process.pid}.txt`), `${file}\n`);
    } catch { /* Recording never gets in a test's way. */ }
  };
  const traced = (original, listing) => {
    const wrapped = function (target, ...rest) { note(target, listing); return original.call(this, target, ...rest); };
    Object.defineProperty(wrapped, 'name', { value: original.name });
    return wrapped;
  };
  const wrap = (owner, name) => {
    const original = owner[name], listing = /^(?:readdir|opendir)/.test(name);
    if (typeof original !== 'function') return;
    const wrapped = traced(original, listing);
    // realpathSync.native and the promisified forms stay callable; a test's own tools use them.
    for (const key of Reflect.ownKeys(original)) {
      if (['length', 'name', 'prototype'].includes(key)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(original, key);
      if (typeof descriptor.value === 'function' && typeof key === 'string') descriptor.value = traced(descriptor.value, listing);
      try { Object.defineProperty(wrapped, key, descriptor); } catch { /* A fixed built-in property stays as it is. */ }
    }
    try { owner[name] = wrapped; } catch { /* Read-only stays read-only. */ }
  };
  const NAMES = ['readFile', 'createReadStream', 'copyFile', 'cp', 'open', 'exists', 'stat', 'lstat', 'access', 'realpath', 'readlink', 'readdir', 'opendir'];
  for (const name of NAMES) { wrap(fs, name); wrap(fs, `${name}Sync`); if (fs.promises && name in fs.promises) wrap(fs.promises, name); }
  // A module asked for and not found counts too: a test that catches MODULE_NOT_FOUND and carries on is the quiet case this file exists for.
  const named = /^(?:\.{1,2}[\\/]|[\\/]|[a-zA-Z]:|file:)/;
  const resolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, ...rest) {
    try { const found = resolve.call(this, request, parent, ...rest); note(found); return found; }
    catch (error) { if (typeof request === 'string' && named.test(request)) note(path.resolve(parent?.filename ? path.dirname(parent.filename) : process.cwd(), request)); throw error; }
  };
  // The CommonJS loader above does not see import. Asking for a file through it and failing is the same case.
  try {
    Module.registerHooks({ resolve(specifier, context, next) {
      try { const found = next(specifier, context); note(found.url); return found; }
      catch (error) { if (named.test(specifier)) try { note(new URL(specifier, context.parentURL)); } catch { /* Not a file. */ } throw error; }
    } });
  } catch { /* An older Node has no such hook; the file is still gone. */ }
  try { Module.syncBuiltinESMExports(); } catch { /* Named ESM imports keep the originals then. */ }
}
