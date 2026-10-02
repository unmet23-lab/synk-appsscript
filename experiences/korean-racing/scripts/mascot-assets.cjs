const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const repository=path.resolve(__dirname,'../../..');
const race=path.resolve(__dirname,'..');
const canonical=require(path.join(repository,'tools/lib/마스코트자산.js'));
const assets=[];
for(const [name,id] of [['마린','marin'],['까몽','kkamong']])for(const [pose,mood] of [['본체','base'],['집중','focus'],['응원','cheer']]){
  const source=canonical[name==='마린'?'마린경로':'까몽경로'](pose,{누끼:true});
  const optimized=`docs/캐릭터/화면_1024/${name}_${pose}.webp`;
  const target=`assets/mascots/${id}-${mood}.webp`;
  const bytes=fs.readFileSync(path.join(repository,optimized));
  fs.mkdirSync(path.dirname(path.join(race,target)),{recursive:true});fs.writeFileSync(path.join(race,target),bytes);
  assets.push({name,pose,sourceCanonical:source,sourceOptimized:optimized,sourceSize:4096,displaySize:1024,path:target,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
fs.writeFileSync(path.join(race,'assets/mascots/provenance.json'),JSON.stringify({method:'Existing approved front-view transparent WebP assets, copied byte-for-byte. Vehicle-aligned front and rear planes seated in the 3D vehicle; generated rear-view variants documented in rear-provenance.json. No skeletal animation.',assets},null,2));
console.log(`Verified ${assets.length} mascot assets.`);
