'use strict';
// Local, memory-only key connection. Generation is restricted to this episode's script.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__dirname,port=4371,origin=`http://127.0.0.1:${port}`,nonce=crypto.randomBytes(24).toString('hex');
const script=JSON.parse(fs.readFileSync(path.join(root,'extra-narration-script.json'),'utf8'));
const count=script.segments.reduce((n,s)=>n+s.text.length,0);let key='',account=null,busy=false;
const audio=path.join(root,'audio');fs.mkdirSync(audio,{recursive:true});
const api=async(route,method='GET',body,apiKey=key)=>{const r=await fetch('https://api.typecast.ai'+route,{method,headers:{'X-API-KEY':apiKey,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(200000)});if(!r.ok)throw Error(`Typecast HTTP ${r.status}`);return r.json();};
const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
http.createServer(async(req,res)=>{try{
 if(req.headers.host!==`127.0.0.1:${port}`)return reply(res,403,{error:'Host rejected'});
 if(req.method==='GET'&&req.url==='/status')return reply(res,200,{connected:!!key,busy,characters:count,completed:script.segments.filter(s=>fs.existsSync(path.join(audio,s.id+'.json'))).length,plan:account?.plan||null});
 if(req.method==='GET'&&req.url==='/'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':`default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'`});
  return res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>synkbrief 음성 연결</title><style>body{font:18px/1.7 system-ui;background:#f2f5fb;color:#18233a;max-width:620px;margin:60px auto;padding:24px}h1{font-size:30px}input,button{box-sizing:border-box;width:100%;font:inherit;padding:14px;border-radius:10px;margin:8px 0;border:1px solid #9eabc4}button{background:#315fbe;color:white;border:0}small{color:#526079}a{color:#315fbe}</style><h1>synkbrief 내레이션 연결</h1><p>기존 Typecast API 키를 아래에 입력해 주세요.<br>키는 이 컴퓨터의 실행 중인 연결에만 잠시 보관하고, 파일이나 채팅에는 저장하지 않습니다.</p><p>이번 편: ${script.segments.length}개 안내 · ${count}자<br>목소리: ${script.voice.name} · 차분하고 부드러운 여성 내레이션</p><p><a href="https://studio.typecast.ai/developers/api" target="_blank" rel="noreferrer">Typecast API 콘솔 열기</a></p><form id="form"><label for="key">Typecast API 키</label><input id="key" type="password" autocomplete="off" required><button>연결 확인</button></form><p id="status" role="status">연결 대기 중</p><small>연결할 때 계정과 남은 크레딧을 확인합니다. 연결만으로 합성하지 않습니다. 기존 크레딧이 부족하면 합성을 중단합니다.</small><script nonce="${nonce}">document.querySelector('#form').onsubmit=async e=>{e.preventDefault();const input=document.querySelector('#key'),value=input.value;input.value='';document.querySelector('#status').textContent='확인 중…';try{const r=await fetch('/connect',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':'${nonce}'},body:JSON.stringify({key:value})});const d=await r.json();document.querySelector('#status').textContent=r.ok?'연결 완료. 이제 Codex에 연결했다고 알려주세요.':d.error}catch{document.querySelector('#status').textContent='연결을 확인하지 못했어요.'}};</script></html>`);
 }
 if(req.method!=='POST')return reply(res,404,{error:'Not found'});
 if(req.headers.origin&&req.headers.origin!==origin)return reply(res,403,{error:'Origin rejected'});
 if(req.url==='/connect'&&req.headers['x-local-token']!==nonce)return reply(res,403,{error:'Form token required'});
 if(req.url!=='/connect'&&req.headers.origin)return reply(res,403,{error:'Local CLI only'});
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16000)throw Error('Request too large');}const body=JSON.parse(raw||'{}');
 if(req.url==='/connect'){
  if(typeof body.key!=='string'||body.key.trim().length<10)throw Error('API 키를 확인해 주세요.');
  const candidate=body.key.trim(),sub=await api('/v1/users/me/subscription','GET',null,candidate);
  const remaining=sub.credits?.plan_credits-sub.credits?.used_credits;
  if(!Number.isFinite(remaining)||remaining<count)throw Error('기존 월 크레딧이 부족하거나 잔량을 확인할 수 없어요.');
  await api('/v3/voices/'+script.voice.id,'GET',null,candidate);key=candidate;account={plan:sub.plan};return reply(res,200,{connected:true});
 }
 if(req.url==='/disconnect'){key='';account=null;return reply(res,200,{connected:false});}
 if(req.url==='/generate'){
  if(!key)throw Error('먼저 연결해 주세요.');if(busy)throw Error('합성 진행 중');
  const i=script.segments.findIndex(s=>s.id===body.id);if(i<0)throw Error('Unknown script segment');
  const s=script.segments[i],file=path.join(audio,s.id+'.json');if(fs.existsSync(file))return reply(res,200,{cached:true,id:s.id});
  busy=true;try{
   const sub=await api('/v1/users/me/subscription');if(sub.credits.plan_credits-sub.credits.used_credits<s.text.length)throw Error('기존 크레딧 부족');
   const request={seed:923,model:script.voice.model,voice_id:script.voice.id,text:s.text,language:'kor',output:{audio_format:'wav',audio_tempo:script.voice.tempo,target_lufs:-17},prompt:{emotion_type:'preset',emotion_preset:script.voice.emotion,emotion_intensity:script.voice.intensity}};
   const data=await api('/v1/text-to-speech/with-timestamps','POST',request);const bytes=Buffer.from(data.audio,'base64');if(bytes.length<1000||!data.words?.length)throw Error('Invalid voice response');
   fs.writeFileSync(path.join(audio,s.id+'.wav'),bytes);delete data.audio;fs.writeFileSync(file,JSON.stringify({...data,request},null,2));return reply(res,200,{id:s.id,duration:data.audio_duration,words:data.words.length});
  }finally{busy=false;}
 }
 return reply(res,404,{error:'Not found'});
}catch(e){reply(res,400,{error:e.message});}}).listen(port,'127.0.0.1',()=>console.log('Voice connection ready on '+origin));

