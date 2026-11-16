import { backup, DatabaseSync } from 'node:sqlite';
import { mkdir,copyFile,writeFile,access } from 'node:fs/promises';
import { dirname,join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.mjs';
import { workspaceMediaNames } from './workspace-media.mjs';
import { cloudLedger, CLOUD_FILE } from './workspace-backup.mjs';

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
  let media,ledger;
  try{media=workspaceMediaNames(snapshot);ledger=cloudLedger(snapshot);}finally{snapshot.close();}
  if(media.length)await mkdir(join(target,'studio-media'),{recursive:true,mode:0o700});
  // 작업실 영상 클라우드(2026-11-16): 버킷에 확인된 영상은 라이브 파일을 읽지 않고 media-cloud.json에 적는다(서버가 비웠을 수 있다).
  const cloudFiles=[];
  for(const diskName of media){
    if(!/^[0-9a-f-]{36}\.(mp4|webm|png|jpg|mp3|wav|srt|vtt|intake)$/i.test(diskName))throw new Error('검토 파일 이름을 확인해 주세요. 백업이 완료되지 않았습니다.');
    const cloud=ledger.get(diskName);
    if(cloud){cloudFiles.push({diskName,sha256:cloud.sha256,bytes:cloud.bytes,bucket:cloud.bucket,object:cloud.object,generation:cloud.generation,md5:cloud.md5});continue;}
    await copyFile(join(directory,'studio-media',diskName),join(target,'studio-media',diskName));
  }
  if(cloudFiles.length)await writeFile(join(target,CLOUD_FILE),JSON.stringify({schema:'synk-workspace-media-cloud/v1',createdAt:new Date().toISOString(),manifestSha256:null,files:cloudFiles},null,2),{mode:0o600});
  await writeFile(join(target,'RESTORE.txt'),'SYNK 회사 데이터 백업 (메신저 제외)\n'+(cloudFiles.length?'작업실 영상 '+cloudFiles.length+'개는 이 폴더에 없고 미디어 버킷에 있습니다('+CLOUD_FILE+'). 버킷의 영상은 30일 안의 정기 백업이 가리키지 않게 되면 지워지므로, 오래 둘 사본이면 먼저 받아 채워 두세요.\n':'')+'메신저까지 함께 옮길 때는 workspace-backup.mjs를 사용하세요.\n서버를 중지한 뒤 이 백업의 company.sqlite, encryption.key, studio-media 폴더(있는 경우)를 함께 새 데이터 폴더로 복사합니다.\nSYNK_COMPANY_DATA를 새 폴더로 지정하고 서버를 시작합니다. 기존 데이터는 덮어쓰지 않습니다.\n암호화 키와 검토용 비공개 파일이 포함되어 있으므로 관리자만 접근할 수 있는 위치에 보관하세요.\n검토 파일 '+media.length+'개가 데이터베이스와 함께 백업되었습니다.\n');
  console.log(target);
}finally{store.close();}
