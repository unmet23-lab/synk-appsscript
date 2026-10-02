'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const here=__dirname,script=require('./narration-script.json'),audio=path.join(here,'audio');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function generate(name,request){
  const file=path.join(audio,name+'.json');
  if(fs.existsSync(file)){if(hash(JSON.parse(fs.readFileSync(file,'utf8')).request)!==hash(request))throw Error('Preserve previous request before changing '+name);return;}
  const r=await fetch('http://127.0.0.1:4371/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,request}),signal:AbortSignal.timeout(200000)});
  const data=await r.json();if(!r.ok||data.error)throw Error(JSON.stringify(data));console.log(JSON.stringify(data));
}
async function main(){
  const status=await fetch('http://127.0.0.1:4371/status').then(r=>r.json());if(!status.connected)throw Error('Connect the existing key locally.');
  const preview=process.argv.includes('--samples');
  if(preview){
    for(const [name,voice] of [['sewoo',script.voice.id],['juwon','tc_5c547545fcfee90007fed459']])await generate('sample-'+name,{seed:922,model:script.voice.model,voice_id:voice,language:'kor',text:'번역만 하려던 제가, 출석 앱을 만들겠다고요? 개발 실력은 제로! 화면 찍고, 물어보고, 또 찍고!',output:{audio_format:'wav',audio_tempo:1.24,target_lufs:-16},prompt:{emotion_type:'preset',emotion_preset:'toneup',emotion_intensity:1.4}});
    return;
  }
  for(const s of script.segments)await generate('narration-'+s.id,{seed:922,model:script.voice.model,voice_id:script.voice.id,language:'kor',text:s.text,output:{audio_format:'wav',audio_tempo:s.tempo,target_lufs:-16},prompt:{emotion_type:'preset',emotion_preset:s.emotion,emotion_intensity:s.intensity}});
  fs.writeFileSync(path.join(audio,'production-settings.json'),JSON.stringify({voice:script.voice,segments:script.segments.map(s=>({id:s.id,emotion:s.emotion,intensity:s.intensity,tempo:s.tempo})),characters:script.segments.reduce((n,s)=>n+s.text.length,0),directListeningVerified:false},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
