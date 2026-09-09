'use strict';
// 인증 정보 없이 공개판의 응답과 원본 시작 바이트를 확인한다. 화면 조작은 하지 않는다.
const fs=require('node:fs'),path=require('node:path');
const source=path.resolve(process.argv[2]),base=new URL(process.argv[3]);
if(base.protocol!=='https:'||!base.hostname.endsWith('.chatgpt.site'))throw Error('Expected actual Sites HTTPS URL');
const files=[];function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(e.name!=='_headers')files.push(f)}}walk(source);
(async()=>{const failures=[];let ok=0;for(let i=0;i<files.length;i+=8)await Promise.all(files.slice(i,i+8).map(async f=>{
 const rel=path.relative(source,f).split(path.sep).join('/'),u=new URL(rel.split('/').map(encodeURIComponent).join('/'),base);
 try{const r=await fetch(u,{headers:{Range:'bytes=0-63'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);if(new URL(r.url).hostname!==base.hostname)throw Error('Redirected outside public site');const reader=r.body.getReader();let prefix=Buffer.alloc(0);while(prefix.length<64){const n=await reader.read();if(n.done)break;prefix=Buffer.concat([prefix,Buffer.from(n.value)])}await reader.cancel();const expected=fs.readFileSync(f).subarray(0,64);if(!prefix.subarray(0,64).equals(expected))throw Error('Content differs from validated source');ok++}catch(e){failures.push({path:rel,error:e.message})}
 }));
 const root=await fetch(base,{signal:AbortSignal.timeout(30000)}),html=await root.text();
 if(!root.ok||!html.includes('SYNK 제작 컬렉션')||/로그인|Sign in/.test(html))failures.push({path:'/',error:'Root does not match public collection'});
 const result={url:base.href,anonymousFiles:ok,total:files.length,rootStatus:root.status,failures};console.log(JSON.stringify(result,null,2));if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1});
