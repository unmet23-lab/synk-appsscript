'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
const visualProof=read('qa/felt-v9/visual-review.json');
if(visualProof.passed!==true)throw Error('Final visual review has not passed');
const records=[];
for(const variant of ['portrait','landscape']){
 const staticProof=read(`qa/felt-v9/${variant}/static-plate-web.json`);
 if(!staticProof.numericTargetPassed)throw Error(`${variant} failed stability`);
 const entries=read(`qa/felt-v9/${variant}/web-encoding.json`);
 if(hash(entries[0].file)!==staticProof.sha256||hash(entries[0].file)!==entries[0].sha256)throw Error('Stability proof is stale');
 if(visualProof.outputs?.[variant]?.sha256!==entries[0].sha256)throw Error(`${variant} visual proof is stale`);
 records.push(...entries.map(e=>({...e,status:'current',visualEvidence:'qa/felt-v9/visual-review.json'})));
}
const manifest=read('asset-sources.json');
for(const f of manifest.files){
 if(/omni11-v6-web|felt-world-scene-.*-v6\.webp/.test(f.file)){f.status='superseded';f.reason='User reported source-level background jitter; replaced by newly generated Omni v9 with verified fixed-background finishing';}
}
manifest.files=manifest.files.filter(f=>!records.some(r=>r.file===f.file)).concat(records);
manifest.titleMotion={version:9,model:'gemini-omni-1.1-flash-preview',modelVerified:true,nativeSeconds:10,playback:'Entire new 10-second, 240-frame shot loops; no short tail, freeze, reverse or retime',finishing:'The new v9 shot is registered to its own first frame; rigid scenery is held fixed while the generated whole trio, river/boat, sky, leaf tips, falling leaves and lantern interiors remain animated. No individual face or boat overlay.',motionControls:'No visible playback or skip controls; automatic video loop, OS reduced-motion poster',copyright:'© 2027 SYNK',visualEvidence:'qa/felt-v9/visual-review.json',playbackEvidence:'qa/felt-v9/full-loop-playback.json',uiRevision:'2026-10-10-minimal',entry:'Tap or click anywhere, Enter/Space; independent sound icon',userDirection:'Preserve approved felt art and minimal UI; regenerate with no visible scene shake and verify before delivery'};
fs.writeFileSync(path.join(root,'asset-sources.json'),JSON.stringify(manifest,null,2)+'\n');
const moduleFile=path.join(root,'opening.mjs');let moduleText=fs.readFileSync(moduleFile,'utf8');
moduleText=moduleText.replaceAll('omni11-v6-web.mp4','omni11-v9-web.mp4').replaceAll('felt-world-scene-mobile-v6.webp','felt-world-scene-mobile-v9.webp').replaceAll('felt-world-scene-desktop-v6.webp','felt-world-scene-desktop-v9.webp');
if(!moduleText.includes('omni11-v9-web.mp4')||moduleText.includes('omni11-v6-web.mp4'))throw Error('Runtime source selection did not update');
fs.writeFileSync(moduleFile,moduleText);
console.log(JSON.stringify({applied:9,files:records.map(r=>r.file)}));
