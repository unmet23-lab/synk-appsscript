const plans=require('./caption-phrases.json');
const norm=s=>s.replaceAll('백 시간','100시간').replaceAll('일인 기업가','1인 기업가').replaceAll('유월','6월').replaceAll('이일','2일').replace(/[\s.,!?]/g,'');
module.exports=(scenes,words)=>{
 const captions=[];
 for(const s of scenes){
  const ws=words.filter(w=>w.segment===s.id);let cursor=0;
  for(const text of plans[s.id]){
   const group=[];while(cursor<ws.length){group.push(ws[cursor++]);if(norm(group.map(w=>w.text).join(' '))===norm(text))break;}
   if(norm(group.map(w=>w.text).join(' '))!==norm(text))throw Error('Caption phrase does not match speech: '+s.id+' '+text);
   captions.push({text,startMs:Math.round(group[0].start*1000),endMs:Math.min(Math.round(group.at(-1).end*1000)+170,Math.round((s.start+s.duration)/30*1000)),timestampMs:null,confidence:null});
  }
  if(cursor!==ws.length)throw Error('Uncaptioned words: '+s.id);
 }
 for(let i=0;i<captions.length-1;i++){
  const next=captions[i+1].startMs;
  if(next-captions[i].endMs<260)captions[i].endMs=next;
 }
 return captions;
};
