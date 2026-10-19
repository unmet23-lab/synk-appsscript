#!/usr/bin/env node
// A local handoff only. This helper never contacts the workspace or a publisher.
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const VIDEO_LIMIT = 100 * 1024 * 1024;
const SUBTITLE_LIMIT = 256 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHANNELS = ['youtube-shorts', 'instagram-reels', 'youtube-video'];
const utf8 = new TextDecoder('utf-8', { fatal: true });

function fail(message) { throw new Error(message); }
function sameStat(a, b) {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
}
function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
function text(value, label, limit, required = false) {
  if (typeof value !== 'string') fail(`${label}은 문자열이어야 합니다.`);
  if ((required && !value.trim()) || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail(`${label}은 ${required ? '1~' : ''}${limit}자 이내여야 합니다.`);
  return value;
}
async function exists(file) {
  try { return await lstat(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function directory(input) {
  if (typeof input !== 'string' || !input.trim()) fail('작업실에서 연결한 --inbox 폴더를 지정해 주세요.');
  const result = path.resolve(input);
  // Do not traverse junctions or symlinks when choosing an output destination.
  let ancestor = result;
  const missing = [];
  while (true) {
    const stat = await exists(ancestor);
    if (stat) {
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail('전달 폴더와 상위 경로는 실제 디렉터리여야 합니다.');
    } else missing.push(ancestor);
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  for (const item of missing.reverse()) {
    try { await mkdir(item); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const stat = await lstat(item);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail('전달 폴더와 상위 경로는 실제 디렉터리여야 합니다.');
  }
  if ((await lstat(result)).isSymbolicLink()) fail('전달 폴더로 바로가기나 심볼릭 링크를 사용할 수 없습니다.');
  return realpath(result);
}
async function source(input, limit, label) {
  if (typeof input !== 'string' || !input.trim()) fail(`${label} 파일 경로를 지정해 주세요.`);
  const file = path.resolve(input);
  const before = await lstat(file, { bigint: true });
  if (before.isSymbolicLink() || !before.isFile() || before.size === 0n || before.size > BigInt(limit)) fail(`${label}은 0바이트보다 크고 ${limit}바이트 이하인 일반 파일이어야 합니다.`);
  const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    if (!sameStat(before, await handle.stat({ bigint: true }))) fail(`${label} 원본이 읽는 동안 변경되었습니다.`);
    const result = { file, handle, before, byteSize: Number(before.size), label };
    result.sha256 = await hashSource(result);
    return result;
  } catch (error) { await handle.close(); throw error; }
}
async function hashSource(item, destination) {
  const hash = createHash('sha256');
  const buffer = Buffer.alloc(Math.min(1024 * 1024, item.byteSize));
  let offset = 0;
  while (offset < item.byteSize) {
    const { bytesRead } = await item.handle.read(buffer, 0, Math.min(buffer.length, item.byteSize - offset), offset);
    if (!bytesRead) fail(`${item.label} 원본이 읽는 동안 변경되었습니다.`);
    hash.update(buffer.subarray(0, bytesRead));
    if (destination) {
      let written = 0;
      while (written < bytesRead) written += (await destination.write(buffer, written, bytesRead - written, offset + written)).bytesWritten;
    }
    offset += bytesRead;
  }
  if (!sameStat(item.before, await item.handle.stat({ bigint: true })) || !sameStat(item.before, await lstat(item.file, { bigint: true }))) fail(`${item.label} 원본이 읽는 동안 변경되었습니다.`);
  return hash.digest('hex');
}
async function readSourceText(item) {
  const buffer = Buffer.alloc(item.byteSize);
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesRead } = await item.handle.read(buffer, offset, buffer.length - offset, offset);
    if (!bytesRead) fail(`${item.label} 원본이 읽는 동안 변경되었습니다.`);
    offset += bytesRead;
  }
  if (createHash('sha256').update(buffer).digest('hex') !== item.sha256) fail(`${item.label} 원본이 읽는 동안 변경되었습니다.`);
  try { return utf8.decode(buffer); } catch { fail(`${item.label}은 UTF-8 텍스트여야 합니다.`); }
}
async function copySource(item, destination) {
  const output = await open(destination, 'wx', 0o600);
  try {
    if (await hashSource(item, output) !== item.sha256) fail(`${item.label} 원본이 복사 중 변경되었습니다.`);
    await output.sync();
  } finally { await output.close(); }
}
async function checkExisting(target, manifest) {
  const stat = await lstat(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('같은 전달 ID의 기존 경로를 덮어쓸 수 없습니다.');
  const ready = await source(path.join(target, 'ready.json'), 64 * 1024, '기존 전달 정보');
  let saved;
  try { saved = JSON.parse(await readSourceText(ready)); } finally { await ready.handle.close(); }
  if (JSON.stringify(saved) !== JSON.stringify(manifest)) fail('같은 전달 ID에 다른 내용이 있습니다. 새 전달 ID로 등록해 주세요.');
  for (const asset of [manifest.video, manifest.subtitle].filter(Boolean)) {
    const original = await source(path.join(target, asset.fileName), asset.byteSize, '기존 전달 파일');
    try {
      if (original.byteSize !== asset.byteSize || original.sha256 !== asset.sha256) fail('기존 전달 파일이 변경되어 재사용할 수 없습니다.');
    } finally { await original.handle.close(); }
  }
}

/** Prepare a confirmed final delivery for a locally configured workspace inbox.
 * `confirmed` is explicit; successful staging does not mean imported or posted.
 */
export async function stagePublicationDelivery(options = {}) {
  if (options.confirmed !== true) fail('완성본 확정이 필요합니다. 확인한 완성본에만 --confirmed를 사용해 주세요.');
  const deliveryId = options.deliveryId ?? randomUUID();
  if (typeof deliveryId !== 'string' || !UUID.test(deliveryId)) fail('전달 ID는 UUID여야 합니다.');
  let id = deliveryId.toLowerCase();
  const title = text(options.title, '제목', 100, true).trim();
  const channels = options.channels ?? ['youtube-shorts', 'instagram-reels'];
  if (!Array.isArray(channels) || channels.length < 1 || channels.length > 3 || channels.some((value) => !CHANNELS.includes(value)) || new Set(channels).size !== channels.length) fail('채널은 youtube-shorts, instagram-reels, youtube-video 중 중복 없이 선택해 주세요.');
  const mode = options.mode ?? 'adapt';
  if (!['adapt', 'original'].includes(mode)) fail('mode는 adapt 또는 original이어야 합니다.');
  const language = options.language ?? 'ko';
  if (typeof language !== 'string' || !/^[a-z]{2,3}(?:-[a-z]{2,8})?$/.test(language)) fail('자막 언어 코드를 확인해 주세요.');
  let link = options.link ?? '';
  if (typeof link !== 'string' || link.length > 2000) fail('링크는 2000자 이내 HTTPS 주소여야 합니다.');
  if (link) {
    let parsed;
    try { parsed = new URL(link); } catch { fail('링크는 HTTPS 주소여야 합니다.'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) fail('링크는 자격증명이 없는 HTTPS 주소여야 합니다.');
    link = parsed.href;
  }
  if (options.body !== undefined && options.bodyFile !== undefined) fail('본문과 본문 파일 중 하나만 지정해 주세요.');
  const inputs = [];
  let inbox, staging, created = false;
  try {
    const video = await source(options.video, VIDEO_LIMIT, '영상'); inputs.push(video);
    const videoExtension = path.extname(video.file).toLowerCase();
    if (!['.mp4', '.webm'].includes(videoExtension)) fail('영상은 MP4 또는 WebM만 지원합니다.');
    const signature = Buffer.alloc(12);
    await video.handle.read(signature, 0, signature.length, 0);
    if (videoExtension === '.mp4' ? signature.subarray(4, 8).toString('ascii') !== 'ftyp' : signature.subarray(0, 4).toString('hex') !== '1a45dfa3') fail('영상의 확장자와 파일 형식이 일치하지 않습니다.');
    let body = options.body ?? '';
    if (options.bodyFile !== undefined) {
      const bodySource = await source(options.bodyFile, 20 * 1024, '본문'); inputs.push(bodySource);
      body = await readSourceText(bodySource);
    }
    body = text(body, '본문', channels.includes('instagram-reels') ? 2200 : 5000);
    let subtitle;
    if (options.subtitle !== undefined) {
      subtitle = await source(options.subtitle, SUBTITLE_LIMIT, '자막'); inputs.push(subtitle);
      const extension = path.extname(subtitle.file).toLowerCase();
      if (!['.srt', '.vtt'].includes(extension)) fail('자막은 SRT 또는 VTT만 지원합니다.');
      await readSourceText(subtitle);
      subtitle.outputName = `subtitle${extension}`;
    }
    let inspection;
    if (options.inspection !== undefined) {
      const reportSource = await source(options.inspection, 2 * 1024 * 1024, '영상 사전검사'); inputs.push(reportSource);
      const report = JSON.parse(await readSourceText(reportSource));
      if (!report || report.schema !== 'synk-media-preflight/v1' || report.complete !== true || !['ready', 'needs-review', 'blocked'].includes(report.status) || !Array.isArray(report.issues) || report.issues.some(item => !item || !['warning', 'error'].includes(item.severity))) fail('완료된 영상 사전검사 파일을 지정해 주세요.');
      if (report.status === 'blocked' || report.issues.some(item => item.severity === 'error')) fail('사전검사의 오류를 고치고 다시 검사한 뒤 전달해 주세요.');
      for (const [name, actual] of [['video', video], ['subtitle', subtitle]]) {
        const expected = report.inputs?.[name];
        if (!!expected !== !!actual || actual && (expected.sha256 !== actual.sha256 || expected.byteSize !== actual.byteSize)) fail(`검사한 ${name === 'video' ? '영상' : '자막'}과 전달할 파일이 다릅니다. 다시 검사해 주세요.`);
      }
      // Text comparisons are valid only while the exact supplied sources still exist.
      for (const [name, label] of [['script', '대본'], ['transcript', '받아쓰기']]) {
        if (!Object.hasOwn(report.inputs, name)) continue;
        const expected = report.inputs[name];
        if (!expected || typeof expected.path !== 'string' || !path.isAbsolute(expected.path)) fail(`검사한 ${label}의 경로가 없습니다. 다시 검사해 주세요.`);
        let actual;
        try { actual = await source(expected.path, 2 * 1024 * 1024, `검사 ${label}`); }
        catch { fail(`검사한 ${label} 파일을 다시 읽을 수 없습니다. 원문을 확인하고 다시 검사해 주세요.`); }
        inputs.push(actual);
        if (actual.sha256 !== expected.sha256 || actual.byteSize !== expected.byteSize) fail(`검사한 ${label}이 변경되었습니다. 다시 검사해 주세요.`);
      }
      const reviewNote = text(options.reviewNote ?? '', '검토 근거', 2000).trim();
      if ((report.issues.length || report.status === 'needs-review') && !reviewNote) fail('사전검사에 확인할 곳이 있습니다. 직접 확인한 뒤 --review-note에 근거를 남겨 주세요.');
      inspection = { schema: report.schema, sha256: reportSource.sha256, inspectedAt: report.inspectedAt, issueCount: report.issues.length, reviewNote };
      // A repeated finalization command for exactly this report and payload reuses one delivery.
      // Version 8 marks an application-defined UUID, without claiming UUIDv5 name hashing.
      if (options.deliveryId === undefined) {
        const bytes = createHash('sha256').update(JSON.stringify({ inspection: reportSource.sha256, reviewNote, video: video.sha256, subtitle: subtitle?.sha256, title, body, link, language, channels, mode })).digest().subarray(0, 16);
        bytes[6] = (bytes[6] & 0x0f) | 0x80; bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = bytes.toString('hex'); id = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
      }
    } else if (options.reviewNote !== undefined) fail('--review-note는 --inspection과 함께 사용해 주세요.');
    inbox = await directory(options.inbox);
    if (inputs.some((item) => isWithin(inbox, item.file))) fail('전달 폴더 내부 파일은 원본으로 사용할 수 없습니다.');
    const target = path.join(inbox, id);
    const existing = await exists(target);
    let finalizedAt = options.finalizedAt;
    if (finalizedAt === undefined && existing) {
      if (!existing.isDirectory() || existing.isSymbolicLink()) fail('같은 전달 ID의 기존 경로를 덮어쓸 수 없습니다.');
      const saved = await source(path.join(target, 'ready.json'), 64 * 1024, '기존 전달 정보');
      try { finalizedAt = JSON.parse(await readSourceText(saved)).finalizedAt; } finally { await saved.handle.close(); }
    }
    finalizedAt ??= new Date().toISOString();
    if (typeof finalizedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(finalizedAt) || !Number.isFinite(Date.parse(finalizedAt))) fail('확정 시각은 시간대가 있는 ISO 날짜여야 합니다.');
    const manifest = {
      schema: 1, deliveryId: id, confirmed: true, finalizedAt: new Date(finalizedAt).toISOString(),
      title, body, link, language, channels: [...channels], mode,
      video: { fileName: `video${videoExtension}`, byteSize: video.byteSize, sha256: video.sha256 },
      ...(subtitle ? { subtitle: { fileName: subtitle.outputName, byteSize: subtitle.byteSize, sha256: subtitle.sha256 } } : {}),
      ...(inspection ? { inspection } : {}),
    };
    if (existing) {
      await checkExisting(target, manifest);
      for (const item of inputs) if (await hashSource(item) !== item.sha256) fail(`${item.label} 원본이 준비 중 변경되었습니다.`);
      return { deliveryId: id, path: target, manifestPath: path.join(target, 'ready.json'), manifest, reused: true, status: 'staged' };
    }
    staging = path.join(inbox, `.partial-${id}`);
    await mkdir(staging, { mode: 0o700 }); created = true;
    await copySource(video, path.join(staging, manifest.video.fileName));
    if (subtitle) await copySource(subtitle, path.join(staging, manifest.subtitle.fileName));
    // All originals must still match after every output has been written.
    for (const item of inputs) if (await hashSource(item) !== item.sha256) fail(`${item.label} 원본이 준비 중 변경되었습니다.`);
    const ready = await open(path.join(staging, 'ready.json'), 'wx', 0o600);
    try { await ready.writeFile(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'); await ready.sync(); } finally { await ready.close(); }
    if (await exists(target)) fail('같은 전달 ID의 경로가 생성되었습니다. 기존 경로를 덮어쓰지 않습니다.');
    if ((await realpath(inbox)) !== inbox || (await lstat(inbox)).isSymbolicLink()) fail('전달 폴더 경로가 준비 중 변경되었습니다.');
    await rename(staging, target); created = false;
    return { deliveryId: id, path: target, manifestPath: path.join(target, 'ready.json'), manifest, reused: false, status: 'staged' };
  } finally {
    await Promise.all(inputs.map((item) => item.handle.close()));
    if (created && staging && inbox && path.dirname(staging) === inbox && path.basename(staging) === `.partial-${id}` && await realpath(inbox).catch(() => '') === inbox) {
      const stat = await exists(staging);
      if (stat?.isDirectory() && !stat.isSymbolicLink()) await rm(staging, { recursive: true, force: true });
    }
  }
}

export function parseDeliveryArgs(argv) {
  const aliases = {
    '--inbox': 'inbox', '--전달폴더': 'inbox', '--video': 'video', '--영상': 'video',
    '--title': 'title', '--제목': 'title', '--body': 'body', '--본문': 'body',
    '--body-file': 'bodyFile', '--본문파일': 'bodyFile', '--subtitle': 'subtitle', '--자막': 'subtitle',
    '--link': 'link', '--링크': 'link', '--language': 'language', '--언어': 'language',
    '--channels': 'channels', '--채널': 'channels', '--mode': 'mode', '--변환': 'mode',
    '--delivery-id': 'deliveryId', '--전달ID': 'deliveryId', '--finalized-at': 'finalizedAt', '--확정시각': 'finalizedAt',
    '--inspection': 'inspection', '--사전검사': 'inspection', '--review-note': 'reviewNote', '--검토근거': 'reviewNote',
  };
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--confirmed' || argument === '--완성확정') {
      if (options.confirmed) fail('완성 확정 옵션은 한 번만 지정해 주세요.');
      options.confirmed = true; continue;
    }
    const key = aliases[argument];
    if (!key) fail(`알 수 없는 옵션: ${argument}`);
    if (options[key] !== undefined) fail(`중복 옵션: ${argument}`);
    if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) fail(`${argument} 값을 지정해 주세요.`);
    options[key] = argv[++index];
    if (key === 'channels') options[key] = options[key].split(',').map((value) => value.trim());
  }
  return options;
}

function usage() {
  console.log(`SYNK 완성본 전달 — 로컬 작업실에서 연결한 폴더로 준비합니다.

node tools/완성본등록.mjs --inbox "연결한 전달 폴더" --video "완성본.mp4" --title "게시 제목" --body-file "게시문.txt" --subtitle "자막.srt" --channels youtube-shorts,instagram-reels --confirmed

필수: --inbox --video --title --confirmed
선택: --body 또는 --body-file, --subtitle, --link, --language ko,
      --channels youtube-shorts,instagram-reels 또는 youtube-video,
      --mode adapt|original, --delivery-id UUID, --finalized-at ISO시각
      --inspection 검사.json [--review-note "경고 구간을 직접 확인한 근거"]
한글: --전달폴더 --영상 --제목 --본문파일 --자막 --채널 --완성확정

원본은 보존합니다. 전달 완료 후 작업실의 자동 등록 결과를 확인해 주세요.
사전검사를 연결하면 영상·자막과 검사에 사용한 대본·받아쓰기의 존재 및 SHA256을 대조하고 동일한 전달을 재사용합니다.
이 명령은 작업실 반영이나 SNS 게시 성공을 의미하지 않습니다.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length === 2 || process.argv.includes('--help') || process.argv.includes('--도움')) usage();
  else {
    try {
      const result = await stagePublicationDelivery(parseDeliveryArgs(process.argv.slice(2)));
      console.log(`${result.reused ? '기존 전달 재사용' : '로컬 전달 준비 완료'}: ${result.deliveryId}\n${result.path}\n작업실에서 자동 등록 결과를 확인해 주세요. SNS에 게시하지 않았습니다.`);
    } catch (error) { console.error(`완성본 전달 실패: ${error.message}`); process.exitCode = 1; }
  }
}
