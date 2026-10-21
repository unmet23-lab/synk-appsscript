import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(dir,'../../../..'),home=path.join(repo,'experiences/synk-world-home');
const read=file=>JSON.parse(fs.readFileSync(path.join(dir,file),'utf8')),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const phases=[['initial','runs/2026-10-09T20-01-50-212Z-after-1e87ebad/result.json',23],['focused','runs/2026-10-09T20-22-23-069Z-after-focus-719c1a41/result.json',10],['silkDelta','runs/2026-10-09T20-36-00-066Z-after-silk-delta-d954b458/result.json',8],['review','review/result.json',5]];
const checked=[];
for(const [name,file,count]of phases){const result=read(file);assert.equal(result.passed,true,name);assert.equal(result.checks.length,count);assert.ok(result.checks.every(check=>check.passed));assert.equal(result.errors.length,0);checked.push({name,file,checks:count});}
const ui=read('runs/2026-10-09T20-43-14-091Z-ui/result.json');assert.equal(ui.passed,true);assert.equal(ui.checks.length,12);assert.equal(ui.errors.length,0);assert.equal(ui.assetFailures.length,0);assert.equal(ui.dataWrites.length,0);
for(const [file,sha256]of Object.entries(ui.source))assert.equal(hash(fs.readFileSync(path.join(home,file))),sha256);
const http=read('backend-http-result.json'),node=read('backend-node-result.json');assert.equal(http.ok,true);assert.equal(http.checks.length,18);assert.equal(http.sourceStable,true);assert.equal(node.exitCode,0);assert.equal(node.passed,20);
const integrity=read('review/source-integrity.json');assert.equal(integrity.allCurrentSourcesMatch,true);assert.equal(integrity.originals.length,6);
for(const image of integrity.originals)assert.equal(hash(fs.readFileSync(path.join(dir,'review',image.file))),image.capturedSha256);
assert.equal(hash(fs.readFileSync(path.join(home,'avatar-v3.mjs'))),hash(fs.readFileSync(path.join(dir,'before/avatar-v3.mjs'))));
const continuity=read('local-after.json'),repair=read('local-ledger-repair.json');assert.equal(continuity.preserved,true);assert.equal(continuity.rows[0].snapshot.inventory.length,14);assert.equal(continuity.rows[1].snapshot.inventory.length,13);assert.equal(repair.schemaEquivalent,true);assert.equal(repair.worldDataRowsChanged,0);assert.equal(repair.schemaChanges,0);
const {WARDROBE_ITEMS,WARDROBE_OUTFITS}=await import(pathToFileURL(path.join(home,'wardrobe-catalog.mjs')).href);assert.equal(WARDROBE_ITEMS.length,14);assert.equal(WARDROBE_OUTFITS.length,60);
const sourceRows=[];for(const file of ['wardrobe-catalog.mjs','wardrobe-garments-v8.mjs','avatar-wardrobe.mjs','avatar-textiles.mjs','avatar-v3.mjs','wardrobe-stage.mjs','wardrobe-studio.mjs','wardrobe-workbench.mjs','avatar-contract.json']){const bytes=fs.readFileSync(path.join(home,file)),response=await fetch('http://127.0.0.1:4296/'+file);assert.equal(response.status,200);assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(bytes));sourceRows.push({file,sha256:hash(bytes),httpMatches:true});}
const health=await(await fetch('http://127.0.0.1:4296/health')).json();assert.equal(health.ok,true);assert.equal(health.production,false);
const result={checkedAt:new Date().toISOString(),achieved:true,localOnly:true,inventoryCount:14,bodyCount:9,neckCount:5,combinationsIncludingEmpty:60,newItems:WARDROBE_ITEMS.slice(8).map(({id,name,material})=>({id,name,material})),checks:checked,uiChecks:12,backendNode:20,backendHttp:18,originalBodyAndEyesSourceUnchanged:true,existingRecordPreserved:true,localLedgerMetadataReconciled:true,servedSource:sourceRows,health,
  evidenceScope:'Initial 180 combination frames are historical. Final focused material changes and sole silk offset are independently verified; not represented as a repeated 180-frame full run.',
  limits:['Procedural local web candidate; static native GLB not updated','Viewport testing, not physical phone performance','Velvet nap direction is subtle in final views','No public deployment or remote DB change']};fs.writeFileSync(path.join(dir,'completion-audit.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({achieved:true,items:14,combinations:60,ui:12,http:18,node:20,sourceMatches:sourceRows.length,existingRecordsPreserved:true}));
