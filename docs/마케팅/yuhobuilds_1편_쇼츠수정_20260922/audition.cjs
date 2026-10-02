'use strict';
const fs=require('node:fs'),path=require('node:path');
const candidates=[['apollo','아폴로','tc_6a3caede24896d14bae7649e'],['justice','정의로','tc_608820eb05b71bc949df989d'],['igyeom','이겸','tc_67bfd35fda120cfcc76b9cb9']];
const catalog=require('./audio/voice-catalog.json');
(async()=>{
 for(const [slug,name,id] of candidates){
  const voice=catalog.find(v=>v.voice_id===id);if(!voice||voice.gender!=='male')throw Error('Unverified voice '+name);
  const request={seed:923,model:'ssfm-v30',voice_id:id,language:'kor',text:'처음엔 번역만 하려고 했죠. 그런데 어느새 출석 앱을 만들고 있더라고요. 문제는, 제가 코딩을 전혀 모른다는 거였습니다.',output:{audio_format:'wav',audio_tempo:1.2,target_lufs:-16},prompt:{emotion_type:'preset',emotion_preset:'normal',emotion_intensity:1}};
  const output='sample-'+slug;if(fs.existsSync(path.join(__dirname,'audio',output+'.wav')))continue;
  const r=await fetch('http://127.0.0.1:4371/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:output,request}),signal:AbortSignal.timeout(200000)});const result=await r.json();if(!r.ok||result.error)throw Error(JSON.stringify(result));console.log(JSON.stringify({voice:name,...result}));
 }
})();
