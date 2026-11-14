// Isolated synthetic data for administrator browser acceptance. No invitations are sent.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {createCompanyApp} from '../server.mjs';
import {today} from '../store.mjs';
import {shiftDate} from '../../analytics.mjs';

export async function createAdminBrowserFixture(){
  const directory=await mkdtemp(join(tmpdir(),'synk-admin-browser-'));
  const probe=createServer();await new Promise(done=>probe.listen(0,'127.0.0.1',done));
  const port=probe.address().port;await new Promise(done=>probe.close(done));
  const password='synthetic-admin-browser-password';
  const app=createCompanyApp({dataDir:directory,port,allowTestHost:true,schedule:false,webPushEnabled:false,
    publicationLinkSchedule:false,publicationPerformanceSchedule:false,
    collector:async()=>{throw Error('Collection is prohibited in the administrator fixture');}});
  async function close(){
    try{await app.stop();}finally{
      assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-admin-browser-'));
      await rm(directory,{recursive:true,force:true});
    }
  }
  try{
  const roles={LAB:'teacher',PATH:'counselor',SHIFT:'instructor',PULSE:'producer'};
  const profile=(companies,duties=[])=>({version:1,revision:1,memberships:companies.map(company=>({company,role:roles[company]})),duties});
  const person=(key,name,role='member',companies=[],duties=[])=>{
    const row=app.store.createUser({email:key+'@example.test',name,role,teamId:'qa-team',password});
    app.store.put('users',row.id,{...row,workspaceProfile:profile(companies,duties)});return app.store.get('users',row.id);
  };
  app.store.put('teams','qa-team',{id:'qa-team',name:'검증 운영팀',active:true});
  const admin=person('admin','검증 관리자','admin');
  const otherAdmin=person('other-admin','다른 관리자','admin');
  const shift=person('shift','검증 강의 담당','member',['SHIFT']);
  const path=person('path','검증 상담 담당','member',['PATH']);
  const lab=person('lab','검증 교사','member',['LAB']);
  const manager=person('manager','검증 팀장','manager',['SHIFT']);
  const stopped=person('stopped','검증 이용 중지','member',['PULSE']);
  app.store.put('users',stopped.id,{...stopped,active:false});
  const historical=person('historical','검증 이전 담당','member',['PULSE'],['social']);
  const sameName=person('same-name','검증 겸임 직원','member',['PATH']);
  const escaped=person('escaped','검증 <img src=x onerror=alert(1)>','member',[]);
  const legacy=person('legacy','검증 소속 미지정');
  const legacyRow={...app.store.get('users',legacy.id)};delete legacyRow.workspaceProfile;app.store.put('users',legacy.id,legacyRow);
  const address=await app.start(),base='http://127.0.0.1:'+address.port;
  const csrf='synthetic-admin-browser-csrf';
  const cookieFor=user=>app.store.mint('session',user.id,{csrfToken:csrf},30);
  const request=async(user,path,body)=>{
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{
      ...(user?{Cookie:'synk_company_session='+cookieFor(user)}:{}),
      ...(body===undefined?{}:{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf})
    },...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,data:await response.json()};
  };
  const issued=await request(admin,'/api/members/invite',{name:'검증 겸임 직원',email:'dual@example.test',role:'member',teamId:'qa-team',workspaceProfile:profile(['SHIFT','PULSE'],['social'])});
  assert.equal(issued.status,201);
  const accepted=await request(null,'/api/join',{token:issued.data.code,name:'검증 겸임 직원',password});
  assert.equal(accepted.status,201);
  const dual=app.store.all('users').find(row=>row.email==='dual@example.test');
  const pending=await request(admin,'/api/members/invite',{name:'검증 초대 대기',email:'pending@example.test',role:'member',workspaceProfile:profile(['LAB'])});
  assert.equal(pending.status,201);
  const end=today(),start=shiftDate(end,-29);
  const channel=(key,owners,extra={})=>{
    const row={id:'qa-channel-'+key,displayName:'검증 채널 '+key,platform:'instagram',canonicalUrl:'https://www.instagram.com/qa_'+key+'/',handle:'qa_'+key,
      ownerIds:owners,teamId:'qa-team',active:true,status:'not-connected',...extra};app.store.put('channels',row.id,row);return row;
  };
  const observed=channel('shared',[dual.id,historical.id]);
  const retained=channel('history',[dual.id]);
  channel('archived',[stopped.id],{active:false});
  const observe=(c,date,owners,views)=>{
    const id=c.id+':post';
    app.store.put('posts',id,{id,channelId:c.id,title:'검증 게시물',url:'https://www.instagram.com/p/qa_example/',publishedDate:shiftDate(end,-60),publishedAt:shiftDate(end,-60)+'T12:00:00Z',source:'manual'});
    app.store.put('snapshots',id+':'+date,{id:id+':'+date,postId:id,date,checkedAt:date+'T12:00:00Z',source:'manual',views,likes:0,comments:2,shares:1,saves:3,followers:10,
      ownership:{known:true,ownerIds:owners,teamId:'qa-team'}});
  };
  observe(observed,shiftDate(start,-1),[dual.id],100);
  observe(observed,end,[dual.id],150);
  observe(retained,shiftDate(end,-1),[historical.id],0);
  app.store.put('channels',observed.id,{...observed,ownerIds:[dual.id,shift.id]});
  for(const [company,ownerId] of [['SHIFT',dual.id],['PATH',path.id]]){
    for(const status of ['open','done']){const id=randomUUID();app.store.put('companyWork',id,{id,company,ownerId,title:'검증 '+company+' '+status,note:'합성 업무',status,revision:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});}
  }
  for(const [ownerId,reviewerId,stage] of [[dual.id,manager.id,'review'],[dual.id,admin.id,'archived'],[stopped.id,admin.id,'producing']]){
    const id=randomUUID();app.store.put('clientProjects',id,{id,title:'검증 영상 프로젝트',customerName:'합성 고객',ownerId,reviewerId,teamId:'qa-team',stage,status:'active',revision:1,versions:[],messages:[],history:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  }
  return {app,base,password,csrf,admin,otherAdmin,dual,shift,path,lab,manager,stopped,historical,sameName,escaped,legacy,pending:pending.data,
    accepted:issued.data,end,start,cookieFor,request,close};
  }catch(error){await close();throw error;}
}
