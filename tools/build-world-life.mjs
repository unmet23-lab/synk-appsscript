import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url);
const esbuild=require(path.join(root,'experiences/synk-account/node_modules/esbuild'));
const target=path.join(root,'experiences/brand-opening/content/life-standalone.mjs');
const cssSource=path.join(root,'experiences/synk-world-app/life-ui.css'),cssTarget=path.join(root,'experiences/brand-opening/content/life-ui.css');
const result=await esbuild.build({entryPoints:[path.join(root,'experiences/synk-world-app/life-standalone-entry.mjs')],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',legalComments:'none'});
const bytes=result.outputFiles[0].contents,css=fs.readFileSync(cssSource);
if(process.argv.includes('--check')){
 if(!fs.existsSync(target)||!Buffer.from(bytes).equals(fs.readFileSync(target))||!fs.existsSync(cssTarget)||!css.equals(fs.readFileSync(cssTarget)))throw Error('WORLD life bundle is stale');
 console.log('WORLD life bundle current');
}else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);fs.writeFileSync(cssTarget,css);console.log('WORLD life bundle built');}
