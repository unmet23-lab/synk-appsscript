'use strict';
// C0 API 계약의 민감 예제 값만 바꾼 표시 사본. 원문은 암호화 보존 목록에 계속 남긴다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const policy = require('./이어하기꾸러미.js');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const read = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } };
function changed(file, value) {
  const existing = fs.existsSync(file) ? fs.readFileSync(file) : null;
  const data = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
  if (existing && existing.equals(data)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.' + process.pid + '.tmp'; fs.writeFileSync(temp, data); fs.renameSync(temp, file);
  if (hash(fs.readFileSync(file)) !== hash(data)) throw new Error('safe-markdown-write-mismatch');
  return true;
}
function preserveSafeMarkdown(root, vault) {
  const relative = 'docs/C0_API계약.md';
  const main = path.resolve(root, '../SYNK-talk', relative);
  const candidates = fs.existsSync(main) ? [{ sourceScope: 'SYNK-talk', sourcePath: main, source: relative }] : [];
  const worktree = read(path.join(vault, '작업문서_미통합_자동/excluded-protected-manifest.json'), { rejected: [] });
  for (const row of worktree.rejected.filter(row => row.repository === 'SYNK-talk' && row.relativePath === relative && row.reason === 'secret-literal'))
    candidates.push({ sourceScope: row.repository, sourcePath: path.resolve(row.worktree, relative), source: relative, worktree: true });
  if (!candidates.length) return { documents: 0, uniqueCopies: 0, written: 0 };
  const linked = policy.linkPaths(candidates.map(row => row.sourcePath));
  const directory = path.join(vault, '문서_안전사본_자동'), files = [], copies = new Set(); let written = 0;
  const fileDirectory = path.join(directory, 'files');
  if (policy.linkPaths([fileDirectory])(fileDirectory)) throw new Error('safe-markdown-destination-link');
  for (const row of [...new Map(candidates.map(row => [row.sourcePath.toLowerCase(), row])).values()]) {
    if (linked(row.sourcePath)) throw new Error('safe-markdown-source-link');
    const before = fs.statSync(row.sourcePath);
    if (!before.isFile() || before.size > policy.MAX_TEXT_BYTES) throw new Error('safe-markdown-source-type');
    const original = fs.readFileSync(row.sourcePath), after = fs.statSync(row.sourcePath);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('safe-markdown-source-changed');
    if (policy.textPolicy(relative, original) !== 'secret-literal') continue;
    const originalSha256 = hash(original); let replacementCount = 0;
    const text = new TextDecoder('utf-8', { fatal: true }).decode(original).replace(
      /(?<![\w"'`])(["']?)(?:password|passwd)\1\s*[:=]\s*(["'])((?:\\.|(?!\2)[^\r\n])+)\2/gi,
      (match, keyQuote, valueQuote, value) => {
        if (/^(?:\$\{|<|process\.env\.|env\.|your[_ -]|example|placeholder|dummy|test[_-]|change[_-]?me|\*{3})/i.test(value)) return match;
        replacementCount++; return match.slice(0, -value.length - 1) + 'placeholder-protected-original' + valueQuote;
      });
    if (!replacementCount) throw new Error('safe-markdown-no-approved-value-span');
    const banner = '> **민감 예제 값을 대체한 안전 사본** · 원문은 변경하지 않았습니다.\n' +
      '> 원문 상대 경로: `SYNK-talk/' + relative + '` · 원문 SHA256: `' + originalSha256 + '`\n' +
      '> 작업트리별 원래 경로와 이 사본 SHA는 [사본 목록](../index.json), 암호화 원문의 검증·복원 위치는 ' +
      '[보호 소스 복원 상태](../../protected-source-backup-status.json)와 [서버·소스 복원 목록](../../서버_복원목록.json)을 확인합니다.\n' +
      '> 아래 비밀번호 예제 값 ' + replacementCount + '곳만 표시 값으로 바꿨습니다. 원래 값이 필요하면 해당 원문 SHA의 암호화 보존본을 복원하세요.\n\n';
    const data = Buffer.from(banner + text), safeCopyPath = path.join(directory, 'files', originalSha256 + '.md');
    if (policy.textPolicy('safe-api-contract.md', data)) throw new Error('safe-markdown-still-protected');
    if (!copies.has(originalSha256)) { if (changed(safeCopyPath, data)) written++; copies.add(originalSha256); }
    files.push({ ...row, originalSha256, safeCopyPath, safeCopySha256: hash(data), bytes: data.length, replacementCount,
      originalUnchanged: true, originalBackupStatus: '../protected-source-backup-status.json' });
  }
  changed(path.join(directory, 'index.json'), { schemaVersion: 1, files, policy: 'Explicit redacted copies; original files stay unchanged and require encrypted-source verification.' });
  return { documents: files.length, uniqueCopies: copies.size, written };
}
module.exports = { preserveSafeMarkdown };
