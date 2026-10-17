'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const G=require('../../tools/lib/미니게임목소리_게임.cjs'),V=require('../../tools/lib/미니게임목소리.cjs');
test('beginner speech comes from 26 exact requests with approved narrator and matching game bytes',async()=>{
 const jobs=await V.allJobs({games:['beginner-games']});
 assert.equal(jobs.length,26);assert.equal(new Set(jobs.map(x=>x.text)).size,26);
 const report=await V.dryRun({games:['beginner-games']});assert.deepEqual(report.problems,[]);assert.ok(report.totals.cached>=0&&report.totals.cached<=26);
 const source=JSON.parse(fs.readFileSync(path.join(__dirname,'audio/manifest.json'),'utf8'));
 for(const[game,manifest,key,prefix,count]of[['word-magic','audio/manifest.json','file','audio',6],['order-rush','assets/beginner/voices.json','file','assets/beginner',15],['spaceship-coop','assets/audio/manifest.json','src','assets/audio',7]]){
  const bank=JSON.parse(fs.readFileSync(path.join(__dirname,'..',game,manifest),'utf8'));assert.equal(bank.approved,true);assert.equal(Object.keys(bank.clips).length,count);
  for(const[id,c]of Object.entries(bank.clips)){
   const bytes=fs.readFileSync(path.join(__dirname,'..',game,prefix,c[key]));
   assert.equal(c.text,source.clips[id].text);assert.ok(bytes.equals(fs.readFileSync(path.join(__dirname,source.clips[id].file))));
   assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),c.sha256);assert.ok(c.durationSeconds>.12&&c.durationSeconds<8);
   assert.equal(jobs.find(j=>j.id===id).voice.voice.name,'서현');
  }
 }
 assert.equal(G.GAMES['beginner-games'].newBank,true);
});
