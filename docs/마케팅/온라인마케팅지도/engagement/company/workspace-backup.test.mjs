import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { Store } from './store.mjs';
import { createMessenger } from '../../../../../tools/company-messenger/server.mjs';
import { backupWorkspace } from './workspace-backup.mjs';

test('workspace backup preserves identities, local attachments, media and Drive registry without original absolute paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'synk-workspace-backup-'));
  const companyDir = join(root, 'company'), messengerDir = join(root, 'messenger');
  let company, messenger;
  try {
    company = new Store(companyDir); messenger = createMessenger({ dataDir: messengerDir, port: 0 });
    const admin = company.createUser({ email: 'backup@example.test', name: '검증', role: 'admin' });
    const mediaName = '51234567-1234-4234-8234-123456789abc.mp4';
    company.put('studioMedia', 'media', { diskName: mediaName });
    await mkdir(join(companyDir, 'studio-media')); await writeFile(join(companyDir, 'studio-media', mediaName), 'video fixture');
    messenger.db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run('m-user', 'backup', '검증', 'owner', 'unused', '2026-09-29');
    messenger.db.prepare('INSERT INTO channels (id,name,description,kind,pair_key,created_at) VALUES (?,?,?,?,?,?)').run('m-channel', '검증', '', 'channel', null, '2026-09-29');
    const attachment = '51234567-1234-4234-8234-123456789abc.bin';
    messenger.db.prepare('INSERT INTO files (id,channel_id,uploader_id,name,size,mime,disk_name,created_at) VALUES (?,?,?,?,?,?,?,?)').run('f1', 'm-channel', 'm-user', 'memo.txt', 7, 'text/plain', attachment, '2026-09-29');
    await writeFile(join(messengerDir, 'uploads', attachment), 'fixture');
    await writeFile(join(messengerDir, 'uploads', 'pending.upload'), 'not included');
    await writeFile(join(messengerDir, 'drive-storage.json'), '{"fixture":true}');
    const links = [{ companyUserId: admin.id, messengerUserId: 'm-user' }];
    await writeFile(join(companyDir, 'workspace-integration.json'), JSON.stringify({ messengerDataDir: messengerDir, identityLinks: links }));
    const target = await backupWorkspace({ destination: join(root, 'backups'), companyDataDir: companyDir });
    assert.equal(await readFile(join(target, 'COMPLETE'), 'utf8'), 'ok\n');
    assert.equal(await readFile(join(target, 'company', 'studio-media', mediaName), 'utf8'), 'video fixture');
    assert.equal(await readFile(join(target, 'messenger', 'uploads', attachment), 'utf8'), 'fixture');
    assert.deepEqual(await readdir(join(target, 'messenger', 'uploads')), [attachment]);
    assert.equal(await readFile(join(target, 'messenger', 'drive-storage.json'), 'utf8'), '{"fixture":true}');
    assert.deepEqual(await readFile(join(target, 'company', 'encryption.key')), await readFile(join(companyDir, 'encryption.key')));
    const manifest = JSON.parse(await readFile(join(target, 'integration-manifest.json'), 'utf8'));
    assert.deepEqual(manifest.identityLinks, links); assert.equal(manifest.mediaCount, 1); assert.equal(manifest.attachmentCount, 1);
    assert.ok(!JSON.stringify(manifest).includes(root));
    const restored = new DatabaseSync(join(target, 'messenger', 'messenger.sqlite'), { readOnly: true });
    try { assert.equal(restored.prepare('SELECT uploader_id FROM files').get().uploader_id, 'm-user'); } finally { restored.close(); }
  } finally {
    company?.close(); await messenger?.close();
    if (!root.startsWith(join(tmpdir(), 'synk-workspace-backup-'))) throw new Error('Unexpected cleanup location');
    await rm(root, { recursive: true, force: true });
  }
});
