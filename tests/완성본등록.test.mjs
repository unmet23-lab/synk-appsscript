import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, realpath, open, symlink, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { watch, writeFileSync } from 'node:fs';
import { stagePublicationDelivery, parseDeliveryArgs } from '../tools/완성본등록.mjs';

const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
const videoBytes = Buffer.concat([Buffer.from('000000206674797069736f6d', 'hex'), Buffer.alloc(1024, 17)]);
async function fixture(t) {
  const temporaryRoot = await realpath(os.tmpdir());
  const root = await mkdtemp(path.join(temporaryRoot, 'synk-final-delivery-'));
  t.after(async () => {
    const resolved = await realpath(root);
    assert.equal(path.dirname(resolved), temporaryRoot);
    assert.ok(path.basename(resolved).startsWith('synk-final-delivery-'));
    await rm(resolved, { recursive: true, force: true });
  });
  const video = path.join(root, '제작완료 $(not-a-command).mp4');
  const subtitle = path.join(root, '한국어.srt');
  const bodyFile = path.join(root, '게시문.txt');
  await writeFile(video, videoBytes);
  await writeFile(subtitle, '1\n00:00:00,000 --> 00:00:01,000\n완성본입니다.\n');
  await writeFile(bodyFile, '확정한 게시문\n#SYNK');
  const options = { inbox: path.join(root, 'inbox'), video, title: '확정한 완성본', bodyFile, subtitle, confirmed: true };
  return { root, options };
}

test('confirmed delivery publishes all bytes together and preserves source files', async (t) => {
  const { options } = await fixture(t);
  const before = await stat(options.video);
  const result = await stagePublicationDelivery(options);
  assert.equal(result.status, 'staged');
  assert.equal(result.reused, false);
  assert.match(result.deliveryId, /^[0-9a-f-]{36}$/);
  assert.deepEqual((await readdir(options.inbox)), [result.deliveryId]);
  const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'));
  assert.equal(manifest.schema, 1);
  assert.equal(manifest.confirmed, true);
  assert.equal(manifest.body, '확정한 게시문\n#SYNK');
  assert.equal(manifest.video.sha256, hash(videoBytes));
  assert.equal(manifest.video.byteSize, videoBytes.length);
  assert.deepEqual(await readFile(path.join(result.path, manifest.video.fileName)), videoBytes);
  assert.deepEqual(await readFile(path.join(result.path, manifest.subtitle.fileName)), await readFile(options.subtitle));
  assert.deepEqual(await readFile(options.video), videoBytes);
  assert.equal((await stat(options.video)).mtimeMs, before.mtimeMs);
  assert.equal(manifest.video.fileName, 'video.mp4');
  assert.equal(JSON.stringify(manifest).includes(options.video), false);
});

test('the same delivery ID reuses intact delivery but never overwrites changed metadata or bytes', async (t) => {
  const { options } = await fixture(t);
  options.deliveryId = randomUUID();
  const first = await stagePublicationDelivery(options);
  const manifestBefore = await readFile(first.manifestPath, 'utf8');
  const second = await stagePublicationDelivery(options);
  assert.equal(second.reused, true);
  assert.equal(second.manifest.finalizedAt, first.manifest.finalizedAt);
  await assert.rejects(stagePublicationDelivery({ ...options, title: '변경한 제목' }), /다른 내용/);
  assert.equal(await readFile(first.manifestPath, 'utf8'), manifestBefore);
  await writeFile(path.join(first.path, 'video.mp4'), Buffer.from('tampered'));
  await assert.rejects(stagePublicationDelivery(options), /변경되어/);
  assert.equal(await readFile(path.join(first.path, 'video.mp4'), 'utf8'), 'tampered');
});

test('explicit confirmation, valid ID and selected channel limits are required before staging', async (t) => {
  const { options } = await fixture(t);
  await assert.rejects(stagePublicationDelivery({ ...options, confirmed: undefined }), /완성본 확정/);
  await assert.rejects(stagePublicationDelivery({ ...options, confirmed: 'true' }), /완성본 확정/);
  await assert.rejects(stagePublicationDelivery({ ...options, deliveryId: '../../elsewhere' }), /UUID/);
  await assert.rejects(stagePublicationDelivery({ ...options, channels: ['tiktok'] }), /채널/);
  await assert.rejects(stagePublicationDelivery({ ...options, channels: ['youtube-video', 'youtube-video'] }), /중복 없이/);
  await assert.rejects(stagePublicationDelivery({ ...options, bodyFile: undefined, body: '가'.repeat(2201) }), /2200자/);
  await assert.rejects(stagePublicationDelivery({ ...options, bodyFile: undefined, body: '가'.repeat(5001), channels: ['youtube-video'] }), /5000자/);
  await assert.rejects(readdir(options.inbox), { code: 'ENOENT' });
});

test('video type, size, subtitle encoding and input conflicts fail without prepared folders', async (t) => {
  const { root, options } = await fixture(t);
  const invalid = path.join(root, 'not-video.mp4');
  await writeFile(invalid, 'arbitrary data');
  await assert.rejects(stagePublicationDelivery({ ...options, video: invalid }), /파일 형식/);
  const huge = path.join(root, 'huge.mp4');
  const handle = await open(huge, 'w');
  await handle.truncate(100 * 1024 * 1024 + 1); await handle.close();
  await assert.rejects(stagePublicationDelivery({ ...options, video: huge }), /일반 파일/);
  await writeFile(options.subtitle, Buffer.from([0xff, 0xfe, 0xfd]));
  await assert.rejects(stagePublicationDelivery(options), /UTF-8/);
  await assert.rejects(stagePublicationDelivery({ ...options, body: 'two sources' }), /하나만/);
  await assert.rejects(readdir(options.inbox), { code: 'ENOENT' });
});

test('WebM and VTT retain their types with original mode and timezone-normalized confirmation', async (t) => {
  const { root, options } = await fixture(t);
  const video = path.join(root, 'final.webm');
  const subtitle = path.join(root, 'final.vtt');
  const data = Buffer.concat([Buffer.from('1a45dfa3', 'hex'), Buffer.alloc(20)]);
  await writeFile(video, data);
  await writeFile(subtitle, 'WEBVTT\n\n00:00.000 --> 00:01.000\n확정\n');
  const result = await stagePublicationDelivery({ ...options, video, subtitle, mode: 'original', channels: ['youtube-video'], finalizedAt: '2026-10-11T12:00:00+09:00' });
  assert.equal(result.manifest.video.fileName, 'video.webm');
  assert.equal(result.manifest.subtitle.fileName, 'subtitle.vtt');
  assert.equal(result.manifest.video.sha256, hash(data));
  assert.equal(result.manifest.mode, 'original');
  assert.equal(result.manifest.finalizedAt, '2026-10-11T03:00:00.000Z');
});

test('existing empty target and abandoned staging folders are preserved', async (t) => {
  const { options } = await fixture(t);
  const id = randomUUID();
  const target = path.join(options.inbox, id);
  await mkdir(target, { recursive: true });
  await assert.rejects(stagePublicationDelivery({ ...options, deliveryId: id }));
  assert.deepEqual(await readdir(target), []);
  const secondId = randomUUID();
  const abandoned = path.join(options.inbox, `.partial-${secondId}`);
  await mkdir(abandoned);
  await writeFile(path.join(abandoned, 'keep.txt'), 'do not delete');
  await assert.rejects(stagePublicationDelivery({ ...options, deliveryId: secondId }), { code: 'EEXIST' });
  assert.equal(await readFile(path.join(abandoned, 'keep.txt'), 'utf8'), 'do not delete');
});

test('inbox junctions and source files inside the inbox are rejected', async (t) => {
  const { root, options } = await fixture(t);
  const actual = path.join(root, 'actual');
  await mkdir(actual);
  const junction = path.join(root, 'junction');
  await symlink(actual, junction, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(stagePublicationDelivery({ ...options, inbox: path.join(junction, 'child') }), /실제 디렉터리/);
  await mkdir(options.inbox);
  const inside = path.join(options.inbox, 'source.mp4');
  await writeFile(inside, videoBytes);
  await assert.rejects(stagePublicationDelivery({ ...options, video: inside }), /원본으로/);
  assert.deepEqual(await readFile(inside), videoBytes);
  assert.deepEqual(await readdir(actual), []);
});

test('concurrent identical delivery never produces two copies or replaces its winner', async (t) => {
  const { options } = await fixture(t);
  await mkdir(options.inbox);
  options.deliveryId = randomUUID();
  options.finalizedAt = '2026-10-11T03:00:00.000Z';
  const results = await Promise.allSettled([stagePublicationDelivery(options), stagePublicationDelivery(options)]);
  assert.ok(results.some((result) => result.status === 'fulfilled'));
  const reused = await stagePublicationDelivery(options);
  assert.equal(reused.reused, true);
  assert.deepEqual(await readdir(options.inbox), [options.deliveryId]);
});

test('a source changed while staging is rejected and its unfinished delivery is removed', async (t) => {
  const { options } = await fixture(t);
  await mkdir(options.inbox);
  const video = await open(options.video, 'r+');
  await video.truncate(32 * 1024 * 1024); await video.close();
  let changed = false;
  const observer = watch(options.inbox, (_event, name) => {
    if (!changed && String(name).startsWith('.partial-')) {
      changed = true;
      writeFileSync(options.video, videoBytes);
    }
  });
  try { await assert.rejects(stagePublicationDelivery(options), /원본이.*변경/); }
  finally { observer.close(); }
  assert.equal(changed, true);
  assert.deepEqual(await readdir(options.inbox), []);
  assert.deepEqual(await readFile(options.video), videoBytes);
});

test('CLI handles quoted paths as values and reports handoff rather than publication', async (t) => {
  const { options } = await fixture(t);
  const command = fileURLToPath(new URL('../tools/완성본등록.mjs', import.meta.url));
  const title = '쉘 $(echo BAD) `whoami` 문자열';
  const result = spawnSync(process.execPath, [command, '--inbox', options.inbox, '--video', options.video, '--title', title, '--body-file', options.bodyFile, '--subtitle', options.subtitle, '--confirmed'], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /로컬 전달 준비 완료/);
  assert.match(result.stdout, /작업실에서 자동 등록 결과를 확인/);
  assert.match(result.stdout, /SNS에 게시하지 않았습니다/);
  const [id] = await readdir(options.inbox);
  assert.equal(JSON.parse(await readFile(path.join(options.inbox, id, 'ready.json'), 'utf8')).title, title);
  assert.deepEqual(parseDeliveryArgs(['--전달폴더', options.inbox, '--영상', options.video, '--제목', '한글', '--채널', 'youtube-video', '--완성확정']), { inbox: options.inbox, video: options.video, title: '한글', channels: ['youtube-video'], confirmed: true });
  assert.throws(() => parseDeliveryArgs(['--title']), /값을 지정/);
  assert.throws(() => parseDeliveryArgs(['--confirmed', '--완성확정']), /한 번만/);
  assert.throws(() => parseDeliveryArgs(['--unknown']), /알 수 없는/);
});
