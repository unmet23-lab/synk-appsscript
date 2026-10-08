import { backup, DatabaseSync } from 'node:sqlite';
import { mkdir, copyFile, writeFile, readFile, access, realpath } from 'node:fs/promises';
import { dirname, join, resolve, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workspaceMediaNames } from './workspace-media.mjs';

const here = dirname(fileURLToPath(import.meta.url));
async function optionalCopy(source, target) {
  try { await copyFile(source, target); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
async function plannedPath(path) {
  try { return await realpath(path); }
  catch (error) { if (error.code !== 'ENOENT' || dirname(path) === path) throw error; return join(await plannedPath(dirname(path)), basename(path)); }
}
export async function backupWorkspace({ destination, companyDataDir, messengerDataDir } = {}) {
  if (typeof destination !== 'string' || !destination.trim()) throw new Error('백업을 저장할 별도 폴더가 필요합니다.');
  const company = resolve(companyDataDir || process.env.SYNK_COMPANY_DATA || join(here, 'data'));
  let config = {};
  try { config = JSON.parse(await readFile(join(company, 'workspace-integration.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const messenger = resolve(messengerDataDir || config.messengerDataDir || process.env.MESSENGER_DATA_DIR || (companyDataDir || process.env.SYNK_COMPANY_DATA ? join(company, 'messenger') : join(here, '../../../../../tools/company-messenger/data')));
  await access(join(company, 'company.sqlite'));
  await access(join(company, 'encryption.key'));
  await access(join(messenger, 'messenger.sqlite'));
  const output = await plannedPath(resolve(destination));
  for (const source of [await realpath(company), await realpath(messenger)]) {
    if (output === source || output.startsWith(source + sep)) throw new Error('백업은 운영 데이터 폴더 밖에 저장해 주세요.');
  }
  if ((await readFile(join(company, 'encryption.key'))).length !== 32) throw new Error('원래 회사 암호화 키를 확인해 주세요.');
  const target = join(output, 'synk-workspace-' + new Date().toISOString().replace(/[:.]/g, '-'));
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
        for (const diskName of workspaceMediaNames(snapshot)) {
          if (!/^[0-9a-f-]{36}\.(mp4|webm|png|jpg|intake)$/i.test(diskName)) throw new Error('검토 파일의 이름이 올바르지 않습니다.');
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
  await writeFile(join(target, 'RESTORE.txt'), '싱ㅋ 워크스페이스 백업\n두 DB의 시점을 맞춘 최종 백업은 모든 writer가 중지된 상태에서 실행하세요. 실행 중의 순차 DB 백업은 하나의 동일 시점을 보장하지 않습니다.\n기존 데이터는 덮어쓰지 마세요. workspace-restore-acceptance.mjs로 별도 최신 기준 백업과 비교하고 새 위치에만 복구 후보를 만드세요.\n일반 복구는 company·messenger 형제 폴더이며, --cloud-volume 복구는 회사 DB와 키를 루트에, 메신저를 messenger 하위에 둡니다. 클라우드에서는 SYNK_COMPANY_DATA=/data, MESSENGER_DATA_DIR=/data/messenger를 설정하세요.\n복구 후보의 PREPARATION_INCOMPLETE 표시는 운영 검증 전에 제거하지 마세요. 이 도구는 서버 시작이나 예약 작업을 실행하지 않습니다.\n회사 계정 연결은 SYNK_ID_* 환경변수를 사용합니다. /etc/synk/company.env·Secret Manager 값·로컬 실행기 설정은 백업에 포함하지 않으므로 새 환경에 별도 이관하고 실제 콜백 주소를 검증하세요.\nDrive 파일 본문은 Google Drive에 있으며 이 백업에는 연결 설정과 파일 식별자가 포함됩니다. Drive에서 삭제된 파일은 이 백업만으로 복원할 수 없습니다.\n이 백업 폴더 자체는 암호화되어 있지 않습니다. 원래 DB 암호화 키와 Google 연결 자격증명이 포함되므로 관리자만 접근하게 하고 SSH 전송·암호화된 비공개 외부 저장소에 보관하세요. 원래 키를 바꾸지 마세요.\n', { mode: 0o600 });
  await writeFile(join(target, 'COMPLETE'), 'ok\n', { mode: 0o600 });
  return target;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2] || process.argv.length > 3) throw new Error('사용법: node workspace-backup.mjs <백업 폴더>');
    console.log(await backupWorkspace({ destination: process.argv[2] }));
  } catch { console.error('WORKSPACE_BACKUP_FAILED: 백업 원본·설정·별도 저장 위치를 확인해 주세요.'); process.exitCode = 2; }
}
