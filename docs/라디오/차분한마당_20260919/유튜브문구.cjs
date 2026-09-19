'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),crypto=require('crypto');
const dir=__dirname,mode=process.argv[2]||'--inspect';
if(!['--inspect','--apply','--verify'].includes(mode))throw Error('invalid mode');
const env={};for(const l of fs.readFileSync(path.join(os.homedir(),'Documents/SYNK-talk/.env'),'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'');}
(async()=>{
 const t=await(await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.RADIO_YT_CLIENT_ID,client_secret:env.RADIO_YT_CLIENT_SECRET,refresh_token:env.RADIO_YT_REFRESH_TOKEN,grant_type:'refresh_token'})})).json();
 if(!t.access_token)throw Error('token refresh failed');
 const yt=async(method,route,body)=>{const r=await fetch('https://www.googleapis.com/youtube/v3/'+route,{method,headers:{authorization:'Bearer '+t.access_token,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const j=await r.json();if(!r.ok)throw Error(method+' '+route.split('?')[0]+' '+r.status+' '+(j.error?.message||''));return j;};
 const b=(await yt('GET','liveBroadcasts?part=id,snippet,status&broadcastStatus=active&broadcastType=all&maxResults=10')).items||[];
 assert.equal(b.length,1,'choose a specific active broadcast');const id=b[0].id;assert.equal(id,'eH0owfx9gCw');
 const before=(await yt('GET','videos?part=snippet,status&id='+id)).items[0];
 if(mode==='--inspect'){
  const info={at:new Date().toISOString(),id,snippet:before.snippet,privacyStatus:before.status.privacyStatus,lifeCycleStatus:b[0].status.lifeCycleStatus};
  fs.writeFileSync(path.join(dir,'before-유튜브.json'),JSON.stringify(info,null,2));
  console.log(JSON.stringify({id,title:before.snippet.title,description:before.snippet.description,tags:before.snippet.tags,categoryId:before.snippet.categoryId},null,2));return;
 }
 const saved=JSON.parse(fs.readFileSync(path.join(dir,'before-유튜브.json'))),copy=require('../../../bots/오버레이/라디오간판.js');
 if(mode==='--apply')for(const k of ['title','description'])assert.equal(before.snippet[k],saved.snippet[k],'another edit changed '+k);
 const s=before.snippet;
 const snippet={title:copy.방송제목,description:copy.방송소개,categoryId:s.categoryId,tags:copy.꼬리표};
 for(const k of ['defaultLanguage','defaultAudioLanguage'])if(s[k])snippet[k]=s[k];
 const thumbnail=fs.readFileSync(path.resolve(dir,'../썸네일.png'));
 assert.ok(thumbnail.length<2*1024*1024,'thumbnail exceeds upload limit');
 let tj=null;
 if(mode==='--apply'){
  await yt('PUT','videos?part=snippet',{id,snippet});
  const tr=await fetch('https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId='+id+'&uploadType=media',{method:'POST',headers:{authorization:'Bearer '+t.access_token,'content-type':'image/png'},body:thumbnail});
  tj=await tr.json();if(!tr.ok)throw Error('thumbnail update failed '+tr.status);
 }
 const after=(await yt('GET','videos?part=snippet,status&id='+id)).items[0];
 assert.equal(after.snippet.title,snippet.title);assert.equal(after.snippet.description,snippet.description);assert.equal(after.status.privacyStatus,before.status.privacyStatus);
 assert.deepEqual([...after.snippet.tags].sort(),[...snippet.tags].sort());
 const thumbs=after.snippet.thumbnails,thumb=thumbs.maxres||thumbs.standard||thumbs.high;
 const pub=await fetch(thumb.url);if(!pub.ok)throw Error('public thumbnail read failed');
 fs.writeFileSync(path.join(dir,'공개썸네일.jpg'),Buffer.from(await pub.arrayBuffer()));
 fs.writeFileSync(path.join(dir,'유튜브반영.json'),JSON.stringify({at:new Date().toISOString(),id,before:saved.snippet,after:after.snippet,privacyStatus:after.status.privacyStatus,thumbnail:{sha256:crypto.createHash('sha256').update(thumbnail).digest('hex'),response:tj,publicUrl:thumb.url,verificationFile:'공개썸네일.jpg'}},null,2));
 console.log(JSON.stringify({id,title:after.snippet.title,description:after.snippet.description,verified:true},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});
