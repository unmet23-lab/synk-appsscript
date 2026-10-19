'use strict';
// 입문 내레이션(beginner-games/audio)을 세 게임의 승인 목록에 복사하고 sha256·길이를 맞춘다.
// tools/미니게임_목소리.cjs로 입문 게임 3종을 다시 구워 적용한 뒤 한 번 돌린다. 글이 다르면 아무것도 쓰지 않고 멈춘다.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const BANKS=[['word-magic','audio/manifest.json','file','audio'],['order-rush','assets/beginner/voices.json','file','assets/beginner'],['spaceship-coop','assets/audio/manifest.json','src','assets/audio']];
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'audio/manifest.json'),'utf8')).clips;
const plans=BANKS.map(([game,manifest,key,prefix])=>{
 const file=path.join(__dirname,'..',game,manifest),bank=JSON.parse(fs.readFileSync(file,'utf8'));
 for(const[id,c]of Object.entries(bank.clips))if(!source[id]||source[id].text!==c.text)throw Error(`${game}/${id}: 입문 원본과 글이 다르다`);
 return{game,file,bank,key,prefix};
});
let copied=0;
for(const{game,file,bank,key,prefix}of plans){
 for(const[id,c]of Object.entries(bank.clips)){
  const from=path.join(__dirname,source[id].file),to=path.join(__dirname,'..',game,prefix,c[key]);
  if(!fs.readFileSync(from).equals(fs.existsSync(to)?fs.readFileSync(to):Buffer.alloc(0))){fs.copyFileSync(from,to);copied++;}
  c.sha256=crypto.createHash('sha256').update(fs.readFileSync(to)).digest('hex');c.durationSeconds=source[id].durationSeconds;
 }
 fs.writeFileSync(file,JSON.stringify(bank,null,2)+'\n');
}
console.log(`세 게임 ${plans.reduce((n,p)=>n+Object.keys(p.bank.clips).length,0)}개 중 ${copied}개 파일을 새로 복사했다.`);
