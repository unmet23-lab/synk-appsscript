'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const dir=__dirname;
async function main(){
 const env={};for(const l of fs.readFileSync(path.join(os.homedir(),'Documents/SYNK-talk/.env'),'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'');}
 const tr=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.RADIO_YT_CLIENT_ID,client_secret:env.RADIO_YT_CLIENT_SECRET,refresh_token:env.RADIO_YT_REFRESH_TOKEN,grant_type:'refresh_token'})});const token=(await tr.json()).access_token;assert.ok(token);
 const yt=async(method,route,body)=>{const r=await fetch('https://www.googleapis.com/youtube/v3/'+route,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const j=await r.json();if(!r.ok)throw Error('YouTube '+r.status+' '+j.error?.message);return j;};
 const id=JSON.parse(fs.readFileSync(path.join(dir,'uploaded.json'))).id;
 const v=(await yt('GET','videos?part=snippet,status,processingDetails,contentDetails&id='+id)).items[0];assert.equal(v.status.privacyStatus,'unlisted');assert.equal(v.status.uploadStatus,'processed');
 for(const title of ['47:33 노을빛 드라이브','53:07 너와 걷던 여름밤'])assert.ok(v.snippet.description.includes(title));
 const records=[];
 for(const target of ['mP3T7Sabeh4','HStZY2xuUdM']){
  const cur=(await yt('GET','videos?part=snippet,status&id='+target)).items[0];
  if(!fs.existsSync(path.join(dir,target+'-before.json')))fs.writeFileSync(path.join(dir,target+'-before.json'),JSON.stringify(cur,null,2));
  let desc=cur.snippet.description.replaceAll('시티팝 1','노을빛 드라이브').replaceAll('시티팝 2','너와 걷던 여름밤');
  if(target==='mP3T7Sabeh4'){assert.ok(desc.includes('https://youtu.be/HStZY2xuUdM')||desc.includes('https://youtu.be/'+id));desc=desc.replaceAll('https://youtu.be/HStZY2xuUdM','https://youtu.be/'+id);}
  else if(!desc.includes('https://youtu.be/'+id))desc='🎵 마크와 곡 제목 디자인을 수정한 최신 모음집\nhttps://youtu.be/'+id+'\n\n'+desc;
  const snippet={...cur.snippet,description:desc};for(const k of ['publishedAt','channelId','thumbnails','channelTitle','localized','liveBroadcastContent'])delete snippet[k];
  if(desc!==cur.snippet.description)await yt('PUT','videos?part=snippet',{id:target,snippet});
  let after;for(let i=0;i<6;i++){after=(await yt('GET','videos?part=snippet,status&id='+target)).items[0];if(after.snippet.description===desc)break;await new Promise(r=>setTimeout(r,2000));}
  assert.equal(after.snippet.description,desc);assert.equal(after.status.privacyStatus,cur.status.privacyStatus);fs.writeFileSync(path.join(dir,target+'-after.json'),JSON.stringify(after,null,2));records.push({id:target,description:desc,privacy:after.status.privacyStatus});
 }
 fs.writeFileSync(path.join(dir,'links-verified.json'),JSON.stringify({at:new Date().toISOString(),newVideo:id,records},null,2));console.log(JSON.stringify({newVideo:id,linkedFrom:records.map(r=>r.id)}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
