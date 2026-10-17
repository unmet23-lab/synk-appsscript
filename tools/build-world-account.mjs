import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
const esbuild=require(path.join(root,'experiences/synk-account/node_modules/esbuild'));
const target=path.join(root,'experiences/synk-world-app/world-account.bundle.mjs');
const result=await esbuild.build({entryPoints:[path.join(root,'experiences/synk-world-app/world-account.mjs')],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',legalComments:'none'});
const bytes=result.outputFiles[0].contents;
// 줄끝만 다른 건 같은 판으로 본다(core.autocrlf=true 작업본은 커밋된 LF 묶음을 CRLF로 꺼낸다).
const sameText=(a,b)=>Buffer.from(a).toString('utf8').replace(/\r\n/g,'\n')===Buffer.from(b).toString('utf8').replace(/\r\n/g,'\n');
if(process.argv.includes('--check')){
 if(!fs.existsSync(target)||!sameText(bytes,fs.readFileSync(target)))throw new Error('WORLD account bundle is stale');
 console.log('WORLD account bundle current');
}else{fs.writeFileSync(target,bytes);console.log('WORLD account bundle built');}
