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
   assert.equal(jobs.find(j=>j.id===id).voice.voice.name,'하나');
  }
 }
 // 들어 있는 음성이 지금 요청(해설 하나, 2026-10-17)으로 구운 것인지: 굽기 도구가 적용할 때 qa/voice.source.json에 줄마다 key·sha를 남긴다.
 const recordFile=path.join(__dirname,'qa/voice.source.json');
 assert.ok(fs.existsSync(recordFile),'굽기 기록이 없다 — 입문 내레이션을 tools/미니게임_목소리.cjs로 다시 굽고 node experiences/beginner-games/sync-banks.cjs로 세 게임에 복사해야 한다');
 const record=JSON.parse(fs.readFileSync(recordFile,'utf8'));
 for(const j of jobs){
  assert.equal(record.lines[j.id]?.key,j.key,`${j.id}: 지금 요청으로 구운 음성이 아니다`);
  assert.equal(record.lines[j.id].sha[j.outputs[0]],crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,j.outputs[0]))).digest('hex').slice(0,16),j.id);
 }
 assert.equal(G.GAMES['beginner-games'].newBank,true);
});
// 세 게임 목록은 synk.im에 그대로 공개된다: 승인 칸은 중립 값이고, 만든 서비스·모델·목소리 이름은 없다(2026-10-19). 만든 길은 README 「음성 준비」.
test('the three game voice lists carry the neutral approval value and no production service or voice names',()=>{
 for(const[game,manifest]of[['word-magic','audio/manifest.json'],['order-rush','assets/beginner/voices.json'],['spaceship-coop','assets/audio/manifest.json']]){
  const text=fs.readFileSync(path.join(__dirname,'..',game,manifest),'utf8');
  assert.equal(JSON.parse(text).provider,'approved-voice-v1',game);assert.doesNotMatch(text,G.TOOL_NAMES,game);
 }
});
