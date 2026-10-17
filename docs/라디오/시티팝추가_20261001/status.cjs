'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const dir=__dirname,key=path.join(os.homedir(),'.ssh/synk_radio'),host='synk-radio',name=process.argv[2]||'status';
const script=String.raw`
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto');
const root='/opt/synk-radio/',hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const props=unit=>Object.fromEntries(cp.execFileSync('systemctl',['show',unit,'-p','ActiveState','-p','SubState','-p','MainPID','-p','NRestarts','-p','ExecMainStartTimestamp'],{encoding:'utf8'}).trim().split('\n').map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)];}));
const service=props('radio-live'),pids=[service.MainPID];
for(let i=0;i<pids.length;i++)try{pids.push(...cp.execFileSync('pgrep',['-P',pids[i]],{encoding:'utf8'}).trim().split('\n').filter(Boolean));}catch{}
const opened=[];for(const pid of pids)try{for(const fd of fs.readdirSync('/proc/'+pid+'/fd'))try{const target=fs.readlinkSync('/proc/'+pid+'/fd/'+fd);if(target.startsWith(root+'소리/')&&target.endsWith('.flac'))opened.push({pid,file:target});}catch{}}catch{}
const manifest=JSON.parse(fs.readFileSync(root+'소리/now-playing.json','utf8'));
const recent=cp.execFileSync('journalctl',['-u','radio-live','-n','30','--no-pager','-o','cat'],{encoding:'utf8'}).split('\n').filter(l=>/현재 곡|방송시각|ffmpeg:|진척.*멈/.test(l)).map(l=>l.replace(/rtmps?:\/\/\S+/gi,'[stream address omitted]').replace(/https?:\/\/\S+/gi,'[URL omitted]')).slice(-7);
(async()=>{
 const env=Object.fromEntries(fs.readFileSync(root+'송출/.env','utf8').split(/\r?\n/).map(l=>l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(m=>[m[1],m[2]]));
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.RADIO_YT_CLIENT_ID,client_secret:env.RADIO_YT_CLIENT_SECRET,refresh_token:env.RADIO_YT_REFRESH_TOKEN,grant_type:'refresh_token'})});
 const token=await response.json();if(!response.ok||!token.access_token)throw Error('OAuth read failed: '+response.status);
 const get=async endpoint=>{const r=await fetch('https://www.googleapis.com/youtube/v3/'+endpoint,{headers:{authorization:'Bearer '+token.access_token}});const j=await r.json();if(!r.ok)throw Error('YouTube status read failed: '+r.status);return j;};
 const broadcasts=await get('liveBroadcasts?part=id,status,contentDetails&mine=true&maxResults=10');
 const live=broadcasts.items.find(b=>b.status.lifeCycleStatus==='live');if(!live)throw Error('No current live broadcast');
 const streams=await get('liveStreams?part=id,status&id='+live.contentDetails.boundStreamId);
 const result={at:new Date().toISOString(),service,opened,playlistSha256:hash(root+'소리/playlist.txt'),manifestSha256:hash(root+'소리/now-playing.json'),audioSha256:fs.existsSync(root+'소리/synk-radio-citypop3-20261001.flac')?hash(root+'소리/synk-radio-citypop3-20261001.flac'):null,trackCount:manifest.tracks.length,duration:manifest.duration,recent,broadcast:{id:live.id,lifeCycleStatus:live.status.lifeCycleStatus,streamStatus:streams.items[0]?.status.streamStatus,healthStatus:streams.items[0]?.status.healthStatus}};
 console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
`;
const result=cp.execFileSync('ssh',['-i',key,host,'node'],{input:script,encoding:'utf8',timeout:30000});fs.writeFileSync(path.join(dir,name+'.json'),result);console.log(result);
