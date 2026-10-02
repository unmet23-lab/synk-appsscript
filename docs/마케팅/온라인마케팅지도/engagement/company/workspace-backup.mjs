import { backup, DatabaseSync } from 'node:sqlite';
import { mkdir, copyFile, writeFile, readFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
async function optionalCopy(source, target) {
  try { await copyFile(source, target); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
export async function backupWorkspace({ destination, companyDataDir, messengerDataDir }) {
  const company = resolve(companyDataDir || process.env.SYNK_COMPANY_DATA || join(here, 'data'));
  let config = {};
  try { config = JSON.parse(await readFile(join(company, 'workspace-integration.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const messenger = resolve(messengerDataDir || process.env.MESSENGER_DATA_DIR || config.messengerDataDir || (companyDataDir || process.env.SYNK_COMPANY_DATA ? join(company, 'messenger') : join(here, '../../../../../tools/company-messenger/data')));
  await access(join(company, 'company.sqlite'));
  await access(join(company, 'encryption.key'));
  await access(join(messenger, 'messenger.sqlite'));
  const target = join(resolve(destination), 'synk-workspace-' + new Date().toISOString().replace(/[:.]/g, '-'));
  await mkdir(join(target, 'company'), { recursive: true, mode: 0o700 });
  await mkdir(join(target, 'messenger'), { mode: 0o700 });
  let mediaCount = 0, attachmentCount = 0;
  for (const [name, directory, database] of [['company', company, 'company.sqlite'], ['messenger', messenger, 'messenger.sqlite']]) {
    const source = new DatabaseSync(join(directory, database), { readOnly: true });
    try { await backup(source, join(target, name, database)); } finally { source.close(); }
    const snapshot = new DatabaseSync(join(target, name, database), { readOnly: true });
    try {
      if (name === 'company') {
        await copyFile(join(directory, 'encryption.key'), join(target, name, 'encryption.key'));
        const rows = snapshot.prepare("SELECT body FROM documents WHERE kind='studioMedia'").all();
        for (const row of rows) {
          const { diskName } = JSON.parse(row.body);
          if (!/^[0-9a-f-]{36}\.(mp4|webm|png|jpg)$/i.test(diskName)) throw new Error('검토 파일의 이름이 올바르지 않습니다.');
          await mkdir(join(target, name, 'studio-media'), { recursive: true, mode: 0o700 });
          await copyFile(join(directory, 'studio-media', diskName), join(target, name, 'studio-media', diskName));
          mediaCount++;
        }
      } else {
        await optionalCopy(join(directory, 'drive-storage.json'), join(target, name, 'drive-storage.json'));
        for (const row of snapshot.prepare("SELECT disk_name FROM files WHERE storage_provider='local'").all()) {
          if (!/^[a-f0-9-]{36}\.bin$/.test(row.disk_name)) throw new Error('첨부파일의 이름이 올바르지 않습니다.');
          await mkdir(join(target, name, 'uploads'), { recursive: true, mode: 0o700 });
          await copyFile(join(directory, 'uploads', row.disk_name), join(target, name, 'uploads', row.disk_name));
          attachmentCount++;
        }
      }
    } finally { snapshot.close(); }
  }
  // Resolve the sibling path when restoring, never leave the old live path in a backup.
  await writeFile(join(target, 'integration-manifest.json'), JSON.stringify({ version: 1, createdAt: new Date().toISOString(), company: 'company', messenger: 'messenger', identityLinks: config.identityLinks || [], mediaCount, attachmentCount }, null, 2), { mode: 0o600 });
  await writeFile(join(target, 'RESTORE.txt'), '싱ㅋ 워크스페이스 백업\n서버를 중지한 뒤 company와 messenger 폴더를 함께 새 위치로 복사하세요. 기존 데이터는 덮어쓰지 마세요.\ncompany/workspace-integration.json에 복원한 messenger 폴더의 절대 경로를 messengerDataDir로, integration-manifest.json의 identityLinks를 함께 저장하세요.\nSYNK_COMPANY_DATA를 복원한 company 폴더로 지정하여 서버를 시작하세요.\nDrive 파일 본문은 Google Drive에 있으며 이 백업에는 연결 설정과 파일 식별자가 포함됩니다. Drive에서 삭제된 파일은 이 백업만으로 복원할 수 없습니다.\n두 DB의 시점을 맞춘 최종 백업은 서버가 중지된 상태에서 실행하세요. 암호화 키와 Google 연결 자격증명이 포함되므로 관리자만 접근할 수 있는 위치에 보관하세요.\n', { mode: 0o600 });
  await writeFile(join(target, 'COMPLETE'), 'ok\n', { mode: 0o600 });
  return target;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('사용법: node workspace-backup.mjs <백업 폴더>');
  console.log(await backupWorkspace({ destination: process.argv[2] }));
}
