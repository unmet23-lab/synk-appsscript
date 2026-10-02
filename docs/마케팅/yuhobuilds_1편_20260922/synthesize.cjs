'use strict';
// Uses the user's existing API connection through a loopback bridge; no key is read or written here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const here=__dirname,script=JSON.parse(fs.readFileSync(path.join(here,'narration-script.json'),'utf8'));
const audio=path.join(here,'audio');fs.mkdirSync(audio,{recursive:true});
const voice='tc_5ecbbc696b7c780008be50c4';
const args=process.argv.slice(2),only=args.includes('--only')?args[args.indexOf('--only')+1]:null;
const digest=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
async function main(){
  const status=await fetch('http://127.0.0.1:4371/status').then(r=>r.json());
  if(!status.connected)throw Error('Connect the existing Typecast key through the local form first.');
  let requested=0;
  for(let i=0;i<script.segments.length;i++){
    const segment=script.segments[i];if(only&&segment.id!==only)continue;
    const name='narration-'+segment.id;
    const request={seed:922,model:'ssfm-v30',text:segment.text,voice_id:voice,language:'kor',output:{audio_tempo:1.02,audio_format:'wav',target_lufs:-17},prompt:{emotion_type:'smart',previous_text:script.segments[i-1]?.text||'',next_text:script.segments[i+1]?.text||''}};
    const alignment=path.join(audio,name+'.json');
    if(fs.existsSync(alignment)&&fs.existsSync(path.join(audio,name+'.wav'))){
      const existing=JSON.parse(fs.readFileSync(alignment,'utf8'));if(digest(existing.request)!==digest(request))throw Error('Script changed for '+name+'; retain the original and explicitly regenerate a revision.');
      console.log('Cached '+segment.id);continue;
    }
    const response=await fetch('http://127.0.0.1:4371/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,request}),signal:AbortSignal.timeout(200000)});
    const result=await response.json();if(!response.ok||result.error)throw Error(JSON.stringify(result));
    requested+=segment.text.length;console.log(JSON.stringify({segment:segment.id,...result}));
  }
  fs.writeFileSync(path.join(audio,'production-settings.json'),JSON.stringify({voice:'윤성',voice_id:voice,model:'ssfm-v30',emotion:'smart with adjacent narration text',tempo:1.02,seed:922,currentRunRequestedCharacters:requested,scriptCharacters:script.segments.reduce((n,s)=>n+s.text.length,0),references:['https://typecast.ai/developers/api/','https://github.com/neosapience/typecast-api-mcp-server'],listeningStatus:'Agent has not directly listened; voice category verified from the live catalog.'},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
