// Disposable, loopback-only workspace for manual browser verification.
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createServer} from 'node:net';
import {createCompanyApp} from './server.mjs';
import {today} from './store.mjs';
import {shiftDate} from '../analytics.mjs';
import assert from 'node:assert/strict';

const directory=await mkdtemp(join(tmpdir(),'synk-workspace-review-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
// Use a different hostname so fixture cookies never replace the user's 127.0.0.1 session.
const app=createCompanyApp({dataDir:directory,host:'127.0.0.1',port,origin:`http://localhost:${port}`,schedule:false});
const password='local-review-fixture-only';
const people=[{key:'admin',name:'검증 관리자',role:'admin',team:'marketing'},{key:'member',name:'검증 동료',role:'member',team:'marketing'},{key:'manager',name:'마케팅 팀장',role:'manager',team:'marketing'},{key:'otherteam',name:'디자인 동료',role:'member',team:'design'},{key:'viewer',name:'검증 열람자',role:'viewer',team:'marketing'}];
const users=Object.fromEntries(people.map(person=>[person.key,app.store.createUser({email:`${person.key}@example.test`,name:person.name,role:person.role,password})]));
const base=`http://localhost:${port}`;
let stopping;async function stop(){if(stopping)return stopping;stopping=(async()=>{await app.stop();const target=resolve(directory),prefix=resolve(tmpdir())+sep;if(!target.startsWith(prefix)||!target.split(sep).at(-1).startsWith('synk-workspace-review-'))throw Error('Unexpected fixture path');await rm(target,{recursive:true,force:true});})();return stopping;}
process.on('SIGINT',()=>void stop().then(()=>{process.exitCode=0;}));process.on('SIGTERM',()=>void stop().then(()=>{process.exitCode=0;}));
async function client(email){
  const response=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const session=await response.json();assert.equal(response.status,200,`Synthetic login failed: ${email}`);
  const cookie=response.headers.getSetCookie().find(value=>value.startsWith('synk_company_session='))?.split(';')[0];assert.ok(cookie,'Fixture company session missing');
  return async(path,data,extra={})=>{
    const res=await fetch(base+path,{method:data===undefined?'GET':'POST',...extra,headers:{Origin:base,Cookie:cookie,'X-CSRF-Token':session.csrfToken,...(data===undefined?{}:{'Content-Type':'application/json'}),...extra.headers},...(data===undefined?{}:{body:JSON.stringify(data)}),...(extra.body?{body:extra.body}:{})});
    const result=await res.json();if(!res.ok)throw new Error(`${path}: ${res.status} ${result.error}`);return result;
  };
}
try{
  await app.start();
  const admin=await client(users.admin.email);
  const teams={marketing:(await admin('/api/teams',{name:'마케팅팀'})).team,design:(await admin('/api/teams',{name:'디자인팀'})).team};
  // Match the self-team form: omit role for the administrator and keep the current session.
  for(const person of people)await admin(`/api/members/${users[person.key].id}/assignment`,{...(person.key==='admin'?{}:{role:person.role}),teamId:teams[person.team].id});
  const clients={admin};for(const person of people.filter(row=>row.key!=='admin'))clients[person.key]=await client(users[person.key].email);
  // Synthetic observations stay in this temporary database; no external collection or real credentials are used.
  const reportDate=today(),previousDate=shiftDate(reportDate,-1),marketingChannels=[];
  for(const [key,baseline,current] of [['admin',100,160],['member',200,290],['otherteam',400,650]]){
    const person=people.find(person=>person.key===key),teamId=teams[person.team].id;
    const channel=(await admin('/api/channels',{urls:`https://www.youtube.com/@synk-review-${key}`,ownerId:users[key].id,teamId})).added[0];
    assert.ok(channel,'Synthetic marketing channel must be created');
    await admin(`/api/channels/${channel.id}/details`,{displayName:`${person.name} 채널 · 검증용`});
    const postId=`review-post-${key}`;
    app.store.put('posts',postId,{id:postId,channelId:channel.id,title:`${person.name}의 검증 콘텐츠`,url:`https://www.youtube.com/watch?v=fixture-${key}`,publishedDate:previousDate,publishedAt:previousDate+'T09:00:00+09:00',source:'fixture:synthetic'});
    for(const [date,views] of [[previousDate,baseline],[reportDate,current]]){
      const checkedAt=date+'T12:00:00+09:00',ownership={known:true,ownerIds:[users[key].id],teamId};
      app.store.put('snapshots',`${postId}-${date}`,{id:`${postId}-${date}`,postId,date,checkedAt,views,likes:Math.floor(views/10),comments:Math.floor(views/50),shares:Math.floor(views/100),saves:null,reach:null,ownership,source:'fixture:synthetic'});
      app.store.put('channelSnapshots',`${channel.id}-${date}`,{id:`${channel.id}-${date}`,channelId:channel.id,date,checkedAt,followers:Math.floor(views/5),views,ownership,source:'fixture:synthetic'});
    }
    marketingChannels.push({id:channel.id,name:`${person.name} 채널 · 검증용`,owner:key,teamId,latestViews:current,dayViews:current-baseline});
  }
  const expectedScopes={mine:{channels:1,latestViews:160,dayViews:60},team:{channels:2,latestViews:450,dayViews:150},all:{channels:3,latestViews:1100,dayViews:400}};
  for(const [scope,expected] of Object.entries(expectedScopes)){
    const report=await admin(`/api/day?date=${reportDate}&scope=${scope}`);
    assert.equal(report.channels.length,expected.channels);assert.equal(report.metrics.views.latest,expected.latestViews);assert.equal(report.metrics.views.day.delta,expected.dayViews);
  }
  const states={};for(const person of people)states[person.key]=await clients[person.key]('/messenger/api/bootstrap');
  // The old category='team' room intentionally remains public. A category label is not an access rule.
  const publicTeam=(await admin('/messenger/api/channels',{name:'마케팅 공유',description:'회사 전체가 볼 수 있는 기존 공개 대화방',category:'team'})).channel;
  const project=(await admin('/messenger/api/channels',{name:'가을 캠페인',description:'캠페인 일정과 시안을 전체에 공유해요',category:'project',scope:'public'})).channel;
  assert.equal(publicTeam.scope,'public');
  const original=(await clients.member(`/messenger/api/channels/${publicTeam.id}/messages`,{body:'이번 주 콘텐츠 일정입니다. 금요일 오전까지 시안을 함께 확인해 주세요.'})).message;
  await admin(`/messenger/api/channels/${publicTeam.id}/messages`,{body:'첫 번째 시안부터 검토하겠습니다.',replyToId:original.id});
  await admin(`/messenger/api/messages/${original.id}/pin`,{});
  await clients.member(`/messenger/api/channels/${project.id}/messages`,{body:'가을 캠페인 시안이 준비됐어요. 파일에서 기획서를 확인해 주세요.'});
  async function attach(sender,channelId,name,body){
    const file=(await sender(`/messenger/api/channels/${channelId}/files`,{}, {headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(name)},body:Buffer.from(body)})).file;
    await sender(`/messenger/api/channels/${channelId}/messages`,{body:name+' 자료를 공유합니다.',fileIds:[file.id]});return file;
  }
  const publicFile=await attach(admin,project.id,'가을 캠페인 기획서.txt','Disposable company-wide fixture document.');
  const marketing=(await clients.member(`/messenger/api/teams/${teams.marketing.id}/channel`,{})).channel;
  const design=(await clients.otherteam(`/messenger/api/teams/${teams.design.id}/channel`,{})).channel;
  assert.equal(marketing.scope,'team');assert.equal(marketing.teamId,teams.marketing.id);
  assert.equal(design.scope,'team');assert.equal(design.teamId,teams.design.id);
  const marketingMessage=(await clients.member(`/messenger/api/channels/${marketing.id}/messages`,{body:'마케팅팀 전용 검증 문구: 이번 주 게시 일정과 역할을 확인해 주세요.'})).message;
  await clients.manager(`/messenger/api/channels/${marketing.id}/messages`,{body:'마케팅팀 안에서 시안을 먼저 검토하겠습니다.',replyToId:marketingMessage.id});
  await clients.manager(`/messenger/api/messages/${marketingMessage.id}/pin`,{});
  await clients.otherteam(`/messenger/api/channels/${design.id}/messages`,{body:'디자인팀 전용 검증 문구: 시안 원본과 수정 내용을 함께 확인해요.'});
  const teamFile=await attach(clients.member,marketing.id,'마케팅팀 내부 메모.txt','MARKETING TEAM ONLY: synthetic attachment for membership checks.');
  const adminDm=(await admin('/messenger/api/dms',{userId:states.member.user.id})).channel;
  await clients.member(`/messenger/api/channels/${adminDm.id}/messages`,{body:'오늘 확인할 내용을 따로 모아두었습니다.'});
  const crossTeamDm=(await clients.member('/messenger/api/dms',{userId:states.otherteam.user.id})).channel;
  await clients.otherteam(`/messenger/api/channels/${crossTeamDm.id}/messages`,{body:'두 담당자만의 검증 문구: 캠페인 디자인 일정은 이 대화에서 확인해요.'});
  const self=states.member.channels.find(channel=>channel.kind==='self');
  await clients.member(`/messenger/api/channels/${self.id}/messages`,{body:'나에게만 보이는 검증 메모: 오늘 해야 할 일을 정리합니다.'});
  const directoryState=await admin('/messenger/api/directory');assert.equal(directoryState.members.length,people.length);
  const viewerState=await clients.viewer('/messenger/api/bootstrap');
  assert.ok(viewerState.channels.some(channel=>channel.id===marketing.id),'Same-team viewer must see the existing team room');
  assert.ok(!viewerState.channels.some(channel=>channel.id===design.id),'Viewer must not see the other team room');
  const otherState=await clients.otherteam('/messenger/api/bootstrap');
  assert.ok(otherState.channels.some(channel=>channel.id===publicTeam.id),'Legacy team category is still company-wide');
  assert.ok(!otherState.channels.some(channel=>channel.id===marketing.id),'Other team must not see the marketing room');
  // Opt-in collaboration examples exist only inside this disposable fixture.
  let collaboration=null;
  if(process.env.SYNK_REVIEW_COLLABORATION==='1'){
    const draft=(await clients.member('/api/content-generate',{seriesId:'synkbrief-use',topic:'회의 메모를 팀의 할 일로 바꾸는 방법',audience:'콘텐츠를 함께 만드는 크루',takeaway:'메시지에서 담당자와 기한을 정해 실행하기',channelId:marketingChannels.find(row=>row.owner==='member').id})).draft;
    const privateDraft=(await clients.member('/api/content-generate',{seriesId:'synkbrief-use',topic:'공유하지 않은 개인 검토 기획'})).draft;
    const noticeRoom=states.admin.channels.find(row=>row.systemKey==='announcements');
    const notice=(await admin(`/messenger/api/channels/${noticeRoom.id}/messages`,{body:'금요일 콘텐츠 검토 안내 · 내용을 읽고 확인 버튼을 눌러 주세요.',ackRequired:true})).message;
    await clients.member(`/messenger/api/messages/${notice.id}/ack`,{});
    const mention=(await clients.member(`/messenger/api/channels/${marketing.id}/messages`,{body:'@검증 관리자 이번 주 콘텐츠 시안 확인 부탁드려요.',mentionIds:[states.admin.user.id]})).message;
    const task=(await clients.member(`/messenger/api/messages/${mention.id}/task`,{title:'콘텐츠 첫 시안 검토',assigneeId:states.admin.user.id,dueDate:shiftDate(reportDate,2),status:'todo'})).task;
    await admin(`/messenger/api/messages/${mention.id}/save`,{});
    await admin(`/messenger/api/messages/${mention.id}/reminder`,{remindAt:new Date(Date.now()+86400000).toISOString()},{method:'PUT'});
    const workspaceLink={title:draft.topic||'회의 메모를 팀의 할 일로 바꾸는 방법',url:`/?tab=content&section=plan&draftId=${encodeURIComponent(draft.id)}`,kind:'content'};
    const review=(await clients.member(`/messenger/api/channels/${adminDm.id}/messages`,{body:'기획 검토 부탁드려요. 의견은 이 대화에 남겨 주세요.',workspaceLink})).message;
    collaboration={noticeId:notice.id,mentionId:mention.id,task,draftId:draft.id,privateDraftId:privateDraft.id,reviewId:review.id};
  }
  // Explicit declarations exist only in this opt-in disposable review database.
  let crewWork=null;
  if(process.env.SYNK_REVIEW_CREW_WORK==='1'){
    const profiles={
      member:{skills:['design','video-editing'],preferredTasks:['design'],communication:'async',workMode:'solo',availableHours:12,participates:true},
      manager:{skills:['planning','research'],preferredTasks:['planning'],communication:'live',workMode:'pair',availableHours:8,participates:true},
      otherteam:{skills:['development','data-analysis'],preferredTasks:[],communication:'flexible',workMode:null,availableHours:null,participates:true},
      viewer:{skills:['channel-operations'],preferredTasks:['channel-operations'],communication:'async',workMode:'solo',availableHours:6,participates:false},
    };
    for(const [key,profile] of Object.entries(profiles)){const current=await clients[key]('/api/crew-profile');await clients[key]('/api/crew-profile',{...profile,confirmed:true,expectedRevision:current.revision});}
    const roster=await admin('/api/crew-work/roster');assert.equal(roster.members.length,5);assert.equal(roster.members.filter(row=>row.shared).length,3);
    assert.ok(!roster.members.find(row=>row.id===users.viewer.id).profile,'An unshared synthetic profile must remain private');
    crewWork={shared:roster.members.filter(row=>row.shared).map(row=>row.id),unshared:[users.admin.id,users.viewer.id]};
  }
  console.log(JSON.stringify({url:base,email:users.admin.email,password,synthetic:true,
    accounts:people.map(person=>({email:users[person.key].email,name:person.name,role:person.role,team:teams[person.team].name,companyUserId:users[person.key].id,messengerUserId:states[person.key].user.id})),
    teams:Object.values(teams).map(({id,name})=>({id,name})),
    channels:{publicTeam:publicTeam.id,project:project.id,marketing:marketing.id,design:design.id,adminDm:adminDm.id,crossTeamDm:crossTeamDm.id,memberSelf:self.id},
    files:{public:publicFile.id,marketing:teamFile.id},
    marketing:{dates:[previousDate,reportDate],channels:marketingChannels,adminScopeResults:expectedScopes},collaboration,crewWork,
  }));
}catch(error){console.error(error.message);await stop();process.exitCode=1;}
