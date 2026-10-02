import { backup, DatabaseSync } from 'node:sqlite';
import { mkdir,copyFile,writeFile,access } from 'node:fs/promises';
import { dirname,join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.mjs';

const here=dirname(fileURLToPath(import.meta.url));
if(!process.argv[2])throw new Error('사용법: node backup.mjs <백업을 저장할 폴더>');
const directory=resolve(process.env.SYNK_COMPANY_DATA||join(here,'data'));
await access(join(directory,'company.sqlite'));
await access(join(directory,'encryption.key'));
const target=join(resolve(process.argv[2]),'synk-company-'+new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(target,{recursive:true,mode:0o700});
const store=new Store(directory);
try{
  await backup(store.db,join(target,'company.sqlite'));
  await copyFile(join(directory,'encryption.key'),join(target,'encryption.key'));
  // Copy the immutable files referenced by this SQLite snapshot; in-progress uploads are excluded.
  const snapshot=new DatabaseSync(join(target,'company.sqlite'),{readOnly:true});
  let media;
  try{media=snapshot.prepare("SELECT body FROM documents WHERE kind='studioMedia'").all().map(row=>JSON.parse(row.body));}finally{snapshot.close();}
  if(media.length)await mkdir(join(target,'studio-media'),{recursive:true,mode:0o700});
  for(const item of media){
    if(!/^[0-9a-f-]{36}\.(mp4|webm|png|jpg)$/i.test(item.diskName))throw new Error('검토 파일 이름을 확인해 주세요. 백업이 완료되지 않았습니다.');
    await copyFile(join(directory,'studio-media',item.diskName),join(target,'studio-media',item.diskName));
  }
  await writeFile(join(target,'RESTORE.txt'),'SYNK SNS 백업\n서버를 중지한 뒤 이 백업의 company.sqlite, encryption.key, studio-media 폴더(있는 경우)를 함께 새 데이터 폴더로 복사합니다.\nSYNK_COMPANY_DATA를 새 폴더로 지정하고 서버를 시작합니다. 기존 데이터는 덮어쓰지 않습니다.\n암호화 키와 검토용 비공개 파일이 포함되어 있으므로 관리자만 접근할 수 있는 위치에 보관하세요.\n검토 파일 '+media.length+'개가 데이터베이스와 함께 백업되었습니다.\n');
  console.log(target);
}finally{store.close();}
