'use strict';
// PULSE 회귀 시험의 실행별 기록. 저장소 밖이나 다른 시험의 결과를 덮지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function createQaRun({ root, label, sources, target = {} }) {
  root = fs.realpathSync(root);
  const base = path.resolve(root, process.env.SYNK_QA_OUT || '.tmp/qa-runs');
  const relative = path.relative(root, base).replaceAll('\\', '/');
  if (!relative.startsWith('.tmp/')) throw Error('PULSE 시험 기록은 저장소 .tmp 안에만 쓴다');
  fs.mkdirSync(base, { recursive: true });
  const resolved = path.relative(root, fs.realpathSync(base)).replaceAll('\\', '/');
  if (!resolved.startsWith('.tmp/')) throw Error('PULSE 시험 기록의 실제 경로가 저장소 밖이다');
  const out = fs.mkdtempSync(path.join(base, label + '-'));
  const dataDirectory = path.join(out, 'data'); fs.mkdirSync(dataDirectory);
  const files = new Map();
  function capture(file) {
    if (fs.lstatSync(file).isSymbolicLink()) throw Error('PULSE 시험 원고의 링크는 허용하지 않는다');
    if (fs.statSync(file).isDirectory()) { for (const name of fs.readdirSync(file)) capture(path.join(file, name)); return; }
    const bytes = fs.readFileSync(file);
    files.set(path.relative(root, file).replaceAll('\\', '/'), { bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  }
  for (const source of [...sources, path.relative(root, __filename)]) capture(path.resolve(root, source));
  const manifestPath = path.join(out, 'qa-evidence.json');
  const evidence = { product: 'PULSE casting regression', status: 'running', startedAt: new Date().toISOString(), target,
    runtime: {}, liveProviderCalls: false, sources: Object.fromEntries([...files].sort()) };
  const save = () => fs.writeFileSync(manifestPath, JSON.stringify(evidence, null, 2) + '\n');
  save();
  return { out, dataDirectory, manifestPath,
    update({ target, runtime } = {}) { Object.assign(evidence.target, target); Object.assign(evidence.runtime, runtime); save(); },
    finish({ ok, checks, error } = {}) { Object.assign(evidence, { status: ok ? 'passed' : 'failed', finishedAt: new Date().toISOString(), checks, ...(error ? { error } : {}) }); save(); }
  };
}
module.exports = { createQaRun };
