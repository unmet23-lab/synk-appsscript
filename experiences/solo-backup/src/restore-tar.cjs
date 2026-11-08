'use strict';
const fs = require('node:fs/promises');
const { createReadStream, createWriteStream } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { StringDecoder } = require('node:string_decoder');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const tar = require('tar-stream');
const { contains, directory } = require('./paths.cjs');

function entryPath(root, name) {
  if (typeof name !== 'string') throw new Error('복구 파일 이름이 올바르지 않습니다.');
  const clean = name.replace(/\/$/, '');
  if (clean === '.') return null;
  const parts = clean.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[<>:"\\|?*\x00-\x1f]/.test(p) || /[. ]$/.test(p) || /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\.|$)/i.test(p))) throw new Error('복구 파일 이름이 Windows에서 안전하지 않습니다.');
  const target = path.resolve(root, ...parts);
  if (!contains(root, target) || target === root) throw new Error('복구 파일이 대상 폴더를 벗어납니다.');
  return target;
}
const key = name => name.replace(/\/$/, '').toLowerCase();
async function readManifest(input, root) {
  const nodes = new Map(); let bytes = 0, pending = '', snapshots = 0;
  const decoder = new StringDecoder('utf8');
  function line(text) {
    if (!text.trim()) return;
    const node = JSON.parse(text);
    if (node.message_type === 'snapshot') { snapshots++; return; }
    if (node.message_type !== 'node' || typeof node.path !== 'string' || !node.path.startsWith('/')) throw new Error('복구 목록 형식을 확인하지 못했습니다.');
    const name = node.path.slice(1); entryPath(root, name);
    if (!['file', 'dir'].includes(node.type)) throw new Error(`이 시험판에서 복구하지 못하는 연결·특수 파일이 있습니다: ${node.path}`);
    const size = node.type === 'dir' ? 0 : node.size;
    if (!Number.isSafeInteger(size) || size < 0 || !Number.isSafeInteger(bytes + size)) throw new Error('복구 목록의 파일 크기를 확인하지 못했습니다.');
    if (nodes.has(key(name))) throw new Error('같은 이름의 복구 파일이 중복됩니다.');
    if (nodes.size >= 1000000) throw new Error('이 시험판은 작업 폴더 하나당 파일·폴더 100만 개까지 확인합니다.');
    nodes.set(key(name), { name, type: node.type, size }); bytes += size;
  }
  for await (const chunk of input) {
    pending += decoder.write(chunk);
    let index;
    while ((index = pending.indexOf('\n')) >= 0) { line(pending.slice(0, index)); pending = pending.slice(index + 1); }
    if (pending.length > 1024 * 1024) throw new Error('복구 목록의 한 항목이 너무 큽니다.');
  }
  pending += decoder.end(); if (pending) line(pending);
  if (snapshots !== 1) throw new Error('복구할 스냅샷 목록을 확인하지 못했습니다.');
  return { nodes, bytes };
}
async function hashFile(file) { const h = crypto.createHash('sha256'); for await (const chunk of createReadStream(file)) h.update(chunk); return h.digest('hex'); }
async function extractVerified(input, destination, manifest) {
  const root = await directory(destination);
  if ((await fs.readdir(root)).length) throw new Error('비어 있는 새 복구 폴더가 필요합니다.');
  const extract = tar.extract(); const seen = new Set();
  let active = Promise.resolve(), total = 0, count = 0, failure;
  let tail = Buffer.alloc(0), archiveBytes = 0;
  // tar-stream parses headers; this additionally requires restic's two ending
  // zero blocks. A separate manifest catches missing whole entries as well.
  const ending = new Transform({ transform(chunk, _encoding, callback) {
    archiveBytes += chunk.length;
    tail = chunk.length >= 1024 ? Buffer.from(chunk.subarray(-1024)) : Buffer.concat([tail, chunk]).subarray(-1024);
    callback(null, chunk);
  }, flush(callback) {
    callback(archiveBytes % 512 || tail.length !== 1024 || tail.some(b => b !== 0) ? new Error('복구 데이터의 끝이 잘렸습니다.') : null);
  } });
  extract.on('entry', (header, stream, next) => {
    stream.on('error', () => {});
    active = (async () => {
      if (!['file', 'directory'].includes(header.type)) throw new Error('연결 파일·특수 파일은 이 시험판에서 복구하지 않습니다.');
      const target = entryPath(root, header.name);
      if (!target) { if (header.type !== 'directory' || header.size !== 0) throw new Error('복구 루트 형식이 잘못되었습니다.'); for await (const _ of stream) {} return; }
      const identity = key(header.name), expected = manifest.nodes.get(identity);
      if (!expected || seen.has(identity) || expected.type !== (header.type === 'directory' ? 'dir' : 'file') || expected.size !== header.size) throw new Error('복구 내용이 사전에 확인한 파일 목록과 다릅니다.');
      seen.add(identity);
      if (header.type === 'directory') { await fs.mkdir(target, { recursive: true }); await directory(target); for await (const _ of stream) {} return; }
      await fs.mkdir(path.dirname(target), { recursive: true }); await directory(path.dirname(target));
      const digest = crypto.createHash('sha256'); let written = 0;
      const measure = new Transform({ transform(chunk, _encoding, callback) {
        written += chunk.length;
        if (written > expected.size) return callback(new Error('복구 파일 크기가 기록을 넘습니다.'));
        digest.update(chunk); callback(null, chunk);
      } });
      // Fresh files inherit the destination user's ACL; original SID/DACL is ignored.
      await pipeline(stream, measure, createWriteStream(target, { flags: 'wx', mode: 0o600 }));
      if (written !== expected.size || await hashFile(target) !== digest.digest('hex')) throw new Error('저장한 복구 파일의 크기 또는 SHA-256이 일치하지 않습니다.');
      total += written; count++;
      if (Number.isFinite(header.mtime?.getTime())) await fs.utimes(target, header.mtime, header.mtime);
    })();
    active.then(() => next(), e => { failure ||= e; stream.destroy(e); extract.destroy(e); });
  });
  try { await pipeline(input, ending, extract); } catch (e) { failure ||= e; }
  await active.catch(e => { failure ||= e; });
  if (failure) throw failure;
  if (seen.size !== manifest.nodes.size || total !== manifest.bytes) throw new Error('복구에서 빠진 파일·폴더가 있습니다. 완료되지 않았습니다.');
  return { files: count, bytes: total };
}
module.exports = { extractVerified, readManifest, entryPath };
