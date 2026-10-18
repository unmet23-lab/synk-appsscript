import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url);
// synk-account의 esbuild(WORLD 앱의 도구 묶음)를 먼저, 없는 깨끗한 체크아웃(CI)에서는 저장소 루트의 esbuild로. 두 판의 결과는 같다(10-17 확인).
const esbuild=require(require.resolve('esbuild',{paths:[path.join(root,'experiences/synk-account'),root]}));
const target=path.join(root,'experiences/brand-opening/content/life-standalone.mjs');
const cssSource=path.join(root,'experiences/synk-world-app/life-ui.css'),cssTarget=path.join(root,'experiences/brand-opening/content/life-ui.css');
// 홈이 직접 부르는 소리·움직임 모듈은 묶지 않고 옆 파일(content/의 한 칸 위)을 같이 쓴다 — 두 벌이면 AudioContext·첫 누름 리스너·설정 알림이 따로 생긴다.
const opening=path.join(root,'experiences/brand-opening'),shared={name:'world-shared',setup(build){build.onResolve({filter:/(?:^|\/)world-(?:sound|motion)\.mjs$/},args=>{const name=path.basename(args.path);return path.resolve(args.resolveDir,args.path)===path.join(opening,name)?{path:'../'+name,external:true}:undefined;});}};
const result=await esbuild.build({entryPoints:[path.join(root,'experiences/synk-world-app/life-standalone-entry.mjs')],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',legalComments:'none',plugins:[shared]});
const bytes=result.outputFiles[0].contents,css=fs.readFileSync(cssSource);
// 줄끝만 다른 건 같은 판으로 본다(core.autocrlf=true 작업본은 커밋된 LF 묶음을 CRLF로 꺼낸다).
const sameText=(a,b)=>Buffer.from(a).toString('utf8').replace(/\r\n/g,'\n')===Buffer.from(b).toString('utf8').replace(/\r\n/g,'\n');
if(process.argv.includes('--check')){
 if(!fs.existsSync(target)||!sameText(bytes,fs.readFileSync(target))||!fs.existsSync(cssTarget)||!sameText(css,fs.readFileSync(cssTarget)))throw Error('WORLD life bundle is stale');
 console.log('WORLD life bundle current');
}else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);fs.writeFileSync(cssTarget,css);console.log('WORLD life bundle built');}
