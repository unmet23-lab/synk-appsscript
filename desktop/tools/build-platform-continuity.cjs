'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),esbuild=require(require.resolve('esbuild',{paths:[path.join(root,'experiences/synk-account')]}));
const result=esbuild.buildSync({entryPoints:[path.join(root,'experiences/synk-account/src/platform-library-view.mjs')],bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',charset:'utf8'}).outputFiles[0].text;
const file=path.join(root,'desktop/renderer/platform-continuity.mjs'),css=path.join(root,'desktop/renderer/platform-continuity.css');
const style=fs.readFileSync(path.join(root,'experiences/synk-account/src/platform-library.css'),'utf8').replace("url('../assets/slab-cream-long.webp')","url('/assets/launcher/button-soft.webp')");
if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==result||fs.readFileSync(css,'utf8')!==style)throw Error('Stale platform continuity bundle');}
else{fs.writeFileSync(file,result);fs.writeFileSync(css,style);}
console.log('Platform continuity bundle and styles verified/generated locally.');
