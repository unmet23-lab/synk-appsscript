import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createDriveStorage} from './drive-storage.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2);
const option=name=>{const index=args.indexOf(name);return index>=0?args[index+1]:undefined;};
const storage=createDriveStorage({dataDir:option('--data-dir')||process.env.MESSENGER_DATA_DIR||path.join(root,'data')});
try{
  let status;
  if(args.includes('--status'))status=await storage.status({fresh:true});
  else if(option('--use'))status=await storage.setActive(option('--use')==='local'?null:option('--use'));
  else{
    const sourcePath=option('--credentials'),expectedEmail=option('--email');
    if(!sourcePath||!expectedEmail)throw new Error('사용: node connect-drive.mjs --credentials <인증 JSON 파일> --email <Google 이메일>\n조회: --status / 변경: --use <등록 연결 ID 또는 local>');
    status=await storage.connectFromFile({sourcePath,expectedEmail});
  }
  // status intentionally excludes every token and OAuth secret.
  console.log(JSON.stringify(status,null,2));
  if(status.status==='error')process.exitCode=1;
}catch(error){console.error(error.publicMessage||error.message);process.exitCode=1;}
