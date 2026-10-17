import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
// synk-account의 esbuild(WORLD 앱의 도구 묶음)를 먼저, 없는 깨끗한 체크아웃(CI)에서는 저장소 루트의 esbuild로. 두 판의 결과는 같다(10-17 확인).
const esbuild=require(require.resolve('esbuild',{paths:[path.join(root,'experiences/synk-account'),root]}));
// Core Personalization (atlas/personalization.js with the trail/engine/domain it requires) as one ESM module for
// the WORLD app's product storage (world-learning-profile.mjs). Same esbuild and options as build-world-account.mjs;
// the first copy (10-14) was made by hand and this reproduces it byte for byte. absWorkingDir fixes the path comments.
const target=path.join(root,'experiences/synk-world-app/world-learning-profile-core.mjs');
const result=await esbuild.build({absWorkingDir:path.resolve(root),entryPoints:['atlas/personalization.js'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',legalComments:'none'});
const bytes=result.outputFiles[0].contents;
// 줄끝만 다른 건 같은 판으로 본다(core.autocrlf=true 작업본은 커밋된 LF 묶음을 CRLF로 꺼낸다).
const sameText=(a,b)=>Buffer.from(a).toString('utf8').replace(/\r\n/g,'\n')===Buffer.from(b).toString('utf8').replace(/\r\n/g,'\n');
if(process.argv.includes('--check')){
 if(!fs.existsSync(target)||!sameText(bytes,fs.readFileSync(target)))throw new Error('WORLD learning profile core bundle is stale');
 console.log('WORLD learning profile core bundle current');
}else{fs.writeFileSync(target,bytes);console.log('WORLD learning profile core bundle built');}
