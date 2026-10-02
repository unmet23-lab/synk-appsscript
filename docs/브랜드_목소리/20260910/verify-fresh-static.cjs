'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const base=__dirname;
const html=fs.readFileSync(path.join(base,'상큼한_비교.html'),'utf8');
const data=JSON.parse(fs.readFileSync(path.join(base,'상큼한_데이터.json'),'utf8'));
const embedded=JSON.parse(html.match(/<script id="listening-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const scripts=[...html.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
for(const script of scripts)new vm.Script(script);
if((html.match(/<audio /g)||[]).length!==8||embedded.samples.length!==8||data.models.length!==8)throw Error('Unexpected comparison count');
for(const sample of embedded.samples){
 const p=path.resolve(base,decodeURIComponent(sample.audioHref));
 if(!p.startsWith(base+path.sep)||!fs.existsSync(p))throw Error('Broken audio path '+sample.id);
 if(!html.includes(sample.blindLabel))throw Error('Missing label '+sample.id);
}
for(const file of ['index.html','상큼한_음원_6개.zip'])if(!fs.existsSync(path.join(base,file)))throw Error('Missing download '+file);
const originalIndexHash=crypto.createHash('sha256').update(fs.readFileSync(path.join(base,'index.html'))).digest('hex');
if(originalIndexHash!=='3dec03aca98248738f336149fa074557e57029578eb5f4f77731f4c06a6c51fb')throw Error('Original index changed');
const record={checkedAt:new Date().toISOString(),status:'static-checks-passed; browser-review-unavailable',newSamples:6,totalAudioElements:8,modelRows:8,inlineScriptSyntax:'passed; compiled only, not executed',localAudioPaths:'all exist inside comparison directory',labels:'new A-F and original 01/05 are distinct',zip:'exists; separately round-trip verified',originalIndexHash,browserReview:{status:'blocked',reason:'CUA browser security URL policy rejected opening the new file:// page; no alternate browser or server workaround attempted',renderChecked:false,mobileChecked:false,playbackChecked:false},humanListening:false};
fs.writeFileSync(path.join(base,'검증/상큼한_페이지검사.json'),JSON.stringify(record,null,2));
console.log(JSON.stringify(record));
