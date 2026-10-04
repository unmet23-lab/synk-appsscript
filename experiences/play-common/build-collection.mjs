import { createRequire } from 'node:module';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here=fileURLToPath(new URL('./',import.meta.url)),root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(import.meta.url);
const esbuild=require(require.resolve('esbuild',{paths:[root,path.join(root,'영상')]}));
// The ledger only (items, wallet, equipment, the mini-game reward); racing's course data stays in racing.
const bundled=esbuild.buildSync({
  entryPoints:[path.join(root,'experiences/korean-racing/garage-core.js')],bundle:true,write:false,
  format:'iife',globalName:'SynkCollectionEconomy',platform:'browser',target:'es2022',minify:true
}).outputFiles[0].text;
const adapter=await readFile(path.join(here,'collection-adapter.js'),'utf8');
const output=path.join(here,'collection.js');
await writeFile(output,'// Generated from korean-racing/garage-core.js and collection-adapter.js. Run node experiences/play-common/build-collection.mjs.\n'+bundled+'\n'+adapter);
// Every mini-game that pays common coins loads the same bytes.
const GAMES=['korean-rhythm','korean-runner','blank-slice','entry-check','story-classroom'];
for(const game of GAMES)await copyFile(output,path.join(root,'experiences',game,'collection.js'));
console.log(`Canonical shared collection built and copied to ${GAMES.join(' / ')} (${Buffer.byteLength(bundled+adapter)} bytes).`);
