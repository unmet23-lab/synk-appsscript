import { createRequire } from 'node:module';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here=fileURLToPath(new URL('./',import.meta.url)),root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(import.meta.url);
const esbuild=require(require.resolve('esbuild',{paths:[root,path.join(root,'영상')]}));
const bundled=esbuild.buildSync({
  entryPoints:[path.join(root,'experiences/korean-racing/garage.js')],bundle:true,write:false,
  format:'iife',globalName:'SynkCollectionEconomy',platform:'browser',target:'es2022',minify:true
}).outputFiles[0].text;
const adapter=await readFile(path.join(here,'collection-adapter.js'),'utf8');
const output=path.join(here,'collection.js');
await writeFile(output,'// Generated from korean-racing/garage.js and collection-adapter.js. Run node experiences/play-common/build-collection.mjs.\n'+bundled+'\n'+adapter);
for(const game of ['korean-rhythm','korean-runner'])await copyFile(output,path.join(root,'experiences',game,'collection.js'));
console.log(`Canonical shared collection built and copied to rhythm / runner (${Buffer.byteLength(bundled+adapter)} bytes).`);
