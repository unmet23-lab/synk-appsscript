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
if(process.argv.includes('--check')){
 if(!fs.existsSync(target)||!Buffer.from(bytes).equals(fs.readFileSync(target)))throw new Error('WORLD account bundle is stale');
 console.log('WORLD account bundle current');
}else{fs.writeFileSync(target,bytes);console.log('WORLD account bundle built');}
