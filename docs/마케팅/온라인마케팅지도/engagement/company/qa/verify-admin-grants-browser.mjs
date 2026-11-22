// 관리자 화면 「반」 · 「이용 권한」 · 「최근 부여」 · 관리자 올리기 확인(관리자 직접부여 설계 6절 화면 확인).
// 임시 폴더의 회사 서버와 합성 중앙 응답만 쓴다. 실제 SYNK ID 서버나 회사 자료에 닿지 않는다.
// 출력: ADMIN_GRANTS_QA_OUT(기본 .tmp/admin-grants-browser)에 1440 · 390 캡처와 report.json.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir,tmpdir} from 'node:os';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {createServer} from 'node:net';
import {createCompanyApp} from '../server.mjs';
import {크롬환경} from '../../../../../../tools/lib/크롬조종.js';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const output=resolve(process.env.ADMIN_GRANTS_QA_OUT||'.tmp/admin-grants-browser');
const ids={owner:'11111111-1111-4111-8111-111111111111',member:'22222222-2222-4222-8222-222222222222',student:'33333333-3333-4333-8333-333333333333',teacher:'44444444-4444-4444-8444-444444444444'};
const tokens={owner:'synthetic-owner-access-token'};
const classA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',classB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const now=Date.now(),iso=offset=>new Date(now+offset).toISOString();

// 합성 중앙(synk-account admin-workspace-grants · admin-member-directory). 줄 꼴은 SYNK-talk lib/synk-account-admin-grants.js(31a8e8f5)와 같다.
const central={
  classes:[{id:classA,classKey:'topik4-evening',displayName:'TOPIK 4급 저녁반',active:true,test:false,seasonless:true,teachers:1,learners:1,openRows:1,createdAt:iso(-60*86400000)},
    {id:classB,classKey:'test-qa-morning',displayName:'시험 오전반',active:false,test:true,seasonless:true,teachers:0,learners:0,openRows:0,createdAt:iso(-30*86400000)}],
  people:{[classA]:{teachers:[{staffId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',synkUserId:ids.teacher,name:'합성 선생님',role:'teacher',active:true,assignedAt:iso(-20*86400000)}],
    learners:[{learnerId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',studentCode:'SYNK-1043',active:true,linked:true,synkUserId:ids.student,accountStatus:'active',name:'합성 학생',enrolledAt:iso(-5*86400000),test:false},
      {learnerId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',studentCode:'SYNK-1044',active:true,linked:false,synkUserId:null,accountStatus:null,name:null,enrolledAt:null,test:false},
      {learnerId:'ffffffff-ffff-4fff-8fff-ffffffffffff',studentCode:'SYNK-1031',active:false,linked:true,synkUserId:'55555555-5555-4555-8555-555555555555',accountStatus:'active',name:'빠진 학생',enrolledAt:iso(-40*86400000),test:false}]},
    [classB]:{teachers:[],learners:[]}},
  directory:[{id:ids.student,name:'합성 학생',loginId:'student@example.test',status:'active',createdAt:iso(-30*86400000)},
    {id:ids.teacher,name:'합성 선생님',loginId:'teacher@example.test',status:'active',createdAt:iso(-60*86400000)},
    {id:'66666666-6666-4666-8666-666666666666',name:'합성 탈퇴 요청',loginId:'leaving@example.test',status:'deletion-requested',createdAt:iso(-90*86400000)}],
  entitlements:{[ids.student]:[{product:'world',capability:'practice.plus',source:'billing',validFrom:iso(-10*86400000),validUntil:iso(20*86400000),revokedAt:null,active:true,editable:false},
    {product:'platform',capability:'library.teacher',source:'workspace-admin',validFrom:iso(-2*86400000),validUntil:null,revokedAt:null,active:true,editable:true},
    {product:'world',capability:'town.access.trial',source:'learning-check',validFrom:iso(-3*86400000),validUntil:iso(4*86400000),revokedAt:null,active:true,editable:false}]},
  audit:[{id:'4',at:iso(-3600000),op:'learner.add',outcome:'applied',code:null,actorSynkUserId:ids.owner,targetSynkUserId:ids.student,classId:classA,learnerId:null,staffId:null,entitlementRef:null},
    {id:'3',at:iso(-7200000),op:'teacher.add',outcome:'applied',code:null,actorSynkUserId:ids.owner,targetSynkUserId:ids.teacher,classId:classA,learnerId:null,staffId:null,entitlementRef:null},
    {id:'2',at:iso(-86400000),op:'entitlement.grant',outcome:'applied',code:null,actorSynkUserId:ids.owner,targetSynkUserId:ids.student,classId:null,learnerId:null,staffId:null,entitlementRef:'workspace-admin:'+ids.student+'.platform.library.teacher'},
    {id:'1',at:iso(-90000000),op:'learner.add',outcome:'rejected',code:'ACCOUNT_ALREADY_ENROLLED',actorSynkUserId:ids.owner,targetSynkUserId:ids.student,classId:classB,learnerId:null,staffId:null,entitlementRef:null}],
  writes:[],claims:[],
};
function centralReply(body){
  const ok=data=>Response.json({ok:true,op:body.op,...data});
  // 관리자 브라우저 로그인의 교환 직후 회사 서버가 부르는 재확인 claim. 합성 중앙은 지금 로그인으로 묶는다.
  if(body.action==='admin-reauth-claim'){central.claims.push(body);return Response.json({ok:true,bound:true,loginAt:new Date(stamp).toISOString()});}
  if(body.action==='admin-member-directory'){const q=String(body.q||'').toLowerCase(),rows=central.directory.filter(row=>!q||row.name.toLowerCase().includes(q)||row.loginId.includes(q));return Response.json({ok:true,total:rows.length,page:1,pageSize:25,rows});}
  switch(body.op){
    case 'audit.list':return ok({days:body.days??7,rows:central.audit});
    case 'classes.list':return ok({total:central.classes.length,page:body.page,pageSize:25,rows:central.classes});
    case 'class.people':{const room=central.classes.find(row=>row.id===body.classId);return ok({class:{id:room.id,classKey:room.classKey,displayName:room.displayName,active:room.active,test:room.test,createdAt:room.createdAt},...central.people[body.classId]});}
    case 'entitlements.list':return ok({synkUserId:body.synkUserId,rows:central.entitlements[body.synkUserId]||[]});
    default:{
      central.writes.push(body);
      if(body.op==='learner.add'&&body.synkUserId===ids.student&&!body.move)return Response.json({ok:false,error:{code:'ACCOUNT_ALREADY_ENROLLED',classId:classB,className:'시험 오전반'}},{status:409});
      central.audit.unshift({id:String(central.audit.length+1),at:new Date().toISOString(),op:body.op,outcome:'applied',code:null,actorSynkUserId:ids.owner,targetSynkUserId:body.synkUserId||null,classId:body.classId||null,learnerId:null,staffId:null,entitlementRef:null});
      const done=data=>ok({requestId:body.requestId,outcome:'applied',...data});
      if(body.op==='learner.add')return done({classId:body.classId,learnerId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',studentCode:'SYNK-1043',change:body.move?'moved':'created',...(body.move?{fromClassId:classB}:{}),sharing:{enabled:false,revision:2}});
      if(body.op==='class.setActive'){const room=central.classes.find(row=>row.id===body.classId);return done({class:{id:room.id,classKey:room.classKey,displayName:room.displayName,active:body.active,test:room.test}});}
      if(body.op==='teacher.add')return done({classId:body.classId,staffId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',role:'teacher',change:'assigned'});
      if(body.op==='entitlement.grant'){
        const entitlement={product:body.product,capability:body.capability,validUntil:body.validUntil??null,revokedAt:null,active:true};
        (central.entitlements[body.synkUserId]||=[]).push({...entitlement,source:'workspace-admin',validFrom:new Date().toISOString(),editable:true});
        return done({synkUserId:body.synkUserId,entitlement,change:'granted'});
      }
      return Response.json({ok:false,error:{code:'INVALID_GRANT_REQUEST'}},{status:400});
    }
  }
}

const directory=await mkdtemp(join(tmpdir(),'synk-admin-grants-browser-'));
const probe=createServer();await new Promise(done=>probe.listen(0,'127.0.0.1',done));const port=probe.address().port;await new Promise(done=>probe.close(done));
let stamp=Date.now();
const app=createCompanyApp({dataDir:directory,port,allowTestHost:true,schedule:false,webPushEnabled:false,publicationLinkSchedule:false,publicationPerformanceSchedule:false,
  collector:async()=>{throw Error('Collection is prohibited in this fixture');},
  synkIdentityConfig:{accountApiUrl:'https://identity.example.test/functions/v1/synk-account',publishableKey:'fixture-public',issuer:'https://identity.example.test',clientId:'messenger-browser'},
  synkIdentityVerifier:async value=>{if(value!==tokens.owner)throw Object.assign(Error('rejected'),{status:401});return {synkUserId:ids.owner,expiresAt:stamp+3600_000,loginEmail:'owner@example.test'};},
  synkIdentityFetch:async(url,init)=>String(url).endsWith('/oauth/token')?Response.json({access_token:tokens.owner}):centralReply(JSON.parse(init.body)),
  synkIdentityNow:()=>stamp,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
const checks=[],errors=[],consoleErrors=[],shots=[];let browser;
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
try{
  await mkdir(output,{recursive:true});
  const address=await app.start(),base='http://127.0.0.1:'+address.port;
  app.store.put('teams','qa-team',{id:'qa-team',name:'검증 운영팀',active:true});
  const owner=app.store.createUser({email:'owner@example.test',name:'검증 회사 주인',role:'admin',teamId:'qa-team'});
  const member=app.store.createUser({email:'member@example.test',name:'검증 실무자',role:'member',teamId:'qa-team'});
  const other=app.store.createUser({email:'other-admin@example.test',name:'검증 다른 관리자',role:'admin',teamId:'qa-team'});
  app.store.put('users',member.id,{...app.store.get('users',member.id),workspaceProfile:{version:1,revision:1,memberships:[{company:'LAB',role:'teacher'}],duties:[]}});
  const link=app.store.db.prepare('INSERT INTO synk_identity_links VALUES(?,?,?,?)');
  link.run(ids.owner,owner.id,'qa-link-owner',new Date().toISOString());link.run(ids.member,member.id,'qa-link-member',new Date().toISOString());
  app.store.put('settings','workspaceOwner',{userId:owner.id,setAt:new Date().toISOString(),setBy:'setup'});
  // 브라우저 SYNK ID 로그인을 서버 쪽에서 마치고 그 세션 쿠키를 브라우저에 넣는다(합성 로그인 서버에는 브라우저가 갈 수 없다).
  const jar=new Map(),send=async(path,body)=>{const response=await fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(body?{Origin:app.origin,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});for(const c of response.headers.getSetCookie()){const [name,value]=c.split(';')[0].split('=');if(value)jar.set(name,value);else jar.delete(name);}return response;};
  const started=await (await send('/api/synk-id/start',{action:'login',expectedAccountId:ids.owner,returnTo:'admin'})).json();
  const back=await send('/api/synk-id/callback?state='+new URL(started.authorizationUrl).searchParams.get('state')+'&code=qa');
  check('callback returns to the administrator screen',back.headers.get('location')==='/?tab=admin&synkConnected=1');
  check('the login claimed the re-login once with the code and verifier',central.claims.length===1&&central.claims[0].code==='qa'&&/^[A-Za-z0-9_-]{43,128}$/.test(central.claims[0].codeVerifier));
  browser=await chromium.launch({headless:true,executablePath:process.env.MESSENGER_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',env:크롬환경()});
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ko-KR',timezoneId:'Asia/Seoul'});
  await context.addCookies([{name:'synk_company_session',value:jar.get('synk_company_session'),url:base}]);
  const page=await context.newPage();
  page.on('pageerror',err=>errors.push(err.message));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  const shot=async(name,options={})=>{const path=join(output,name);await page.screenshot({path,...options});shots.push(name);};
  const fits=()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
  // 휴대폰에서 입력칸을 누르면 글자가 16px보다 작을 때 화면이 확대된다. 열린 창의 입력칸을 하나 이상 재야 통과한다.
  const inputSizes=()=>page.locator('#overlay input:not([type="checkbox"]):not([type="hidden"]), #overlay select').evaluateAll(nodes=>nodes.map(node=>parseFloat(getComputedStyle(node).fontSize)));
  const mobileInputs=async name=>{const sizes=await inputSizes();check(name+' inputs do not zoom at 390 ('+sizes.join(', ')+'px)',sizes.length>0&&sizes.every(size=>size>=16));};
  await page.goto(base+'/?tab=admin',{waitUntil:'domcontentloaded'});
  const admin=page.locator('.admin-workspace');await admin.waitFor();
  await admin.locator('.grants-audit-row').first().waitFor();
  check('recent grants list is at the top',await admin.locator('.grants-audit h2').innerText()==='최근 부여');
  check('class and entitlement scopes are shown for the SYNK ID session',await admin.locator('[data-directory-scope="classes"]').count()===1&&await admin.locator('[data-directory-scope="entitlements"]').count()===1);
  await shot('01-admin-top-1440.png');
  await admin.locator('[data-directory-scope="classes"]').click();
  await admin.locator('[data-grants-classes] tbody tr').first().waitFor();
  await admin.locator('[data-grants-action="class-open"]').first().click();
  await admin.locator('[data-grants-class-detail] tbody tr').first().waitFor();
  check('focus stays on the class name after the people load',await page.evaluate(()=>document.activeElement?.id==='grants-class-title'));
  check('class people lists teachers and learners without records',(await admin.locator('[data-grants-class-detail]').innerText()).includes('합성 선생님')&&(await admin.locator('[data-grants-class-detail]').innerText()).includes('SYNK-1044'));
  await shot('02-classes-1440.png',{fullPage:true});
  // 학생 넣기 → 사람 고르기 → 확인 창
  await admin.locator('[data-grants-action="learner-add"]').click();
  const dialog=page.locator('#overlay .modal');await dialog.locator('input[name="q"]').fill('합성');await dialog.locator('input[name="q"]').press('Enter');
  await dialog.locator('[data-grants-action="pick"]').first().waitFor();
  await shot('03-picker-1440.png');
  await dialog.locator('[data-grants-action="pick"]').first().click();
  await page.locator('#overlay .grants-confirm').waitFor();
  check('learner confirmation shows the design wording',(await page.locator('#overlay .grants-confirm').innerText()).includes('코드 없이 바로 이 반에 들어가요.'));
  check('learner confirmation repeats name, email and sign-up date',(await page.locator('#overlay .grants-lines').innerText()).includes('student@example.test'));
  await shot('04-learner-confirm-1440.png');
  await page.locator('#overlay [data-grants-submit]').click();
  await page.locator('#overlay [data-grants-action="learner-move"]').waitFor();
  await shot('05-move-offer-1440.png');
  await page.locator('#overlay [data-grants-action="learner-move"]').click();
  check('move confirmation names both classes',(await page.locator('#overlay .grants-confirm').innerText()).includes('시험 오전반'));
  await shot('06-move-confirm-1440.png');
  await page.locator('#overlay [data-grants-submit]').click();
  await page.locator('#overlay .modal').waitFor({state:'detached'});
  check('the move reached the central function once with move:true',central.writes.filter(row=>row.move===true).length===1);
  check('company audit recorded the writes',app.store.all('audit').filter(row=>row.action==='synk-grant').length===2);
  await page.setViewportSize({width:390,height:900});
  await page.waitForTimeout(300);
  check('classes fit at 390',await fits());
  await shot('07-classes-390.png',{fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  // 이용 권한
  await admin.locator('[data-directory-scope="entitlements"]').click();
  await admin.locator('[data-grants-action="ents-pick"]').click();
  await dialog.locator('input[name="q"]').fill('합성 학생');await dialog.locator('input[name="q"]').press('Enter');
  await dialog.locator('[data-grants-action="pick"]').first().click();
  await admin.locator('[data-grants-ents] tbody tr').first().waitFor();
  check('only rows written by this tool can be revoked',await admin.locator('[data-grants-action="ent-revoke"]').count()===1);
  check('the town trial row says why it cannot be given or taken here',(await admin.locator('[data-grants-ents] tbody tr',{hasText:'마을 체험 입장'}).innerText()).includes('마을 체험은 학습 확인 때 자동으로 주어져 여기서 주거나 거둘 수 없어요.'));
  await shot('08-entitlements-1440.png',{fullPage:true});
  await admin.locator('[data-grants-action="ent-grant"]').click();
  await page.locator('#overlay .grants-confirm').waitFor();
  await shot('09-entitlement-grant-1440.png');
  // 실제로 칸을 바꿔 본다: WORLD 권한을 기한 없이 내면 막히고, 기한을 넣으면 중앙에 한 번 간다.
  const grantForm=page.locator('#overlay .grants-confirm');
  check('the town trial is not offered',!(await grantForm.locator('select[name="choice"] option').allInnerTexts()).some(text=>text.includes('마을 체험')));
  await grantForm.locator('select[name="choice"]').selectOption({label:'WORLD 연습 더하기'});
  await grantForm.locator('input[name="validUntil"]').fill('');
  await page.locator('#overlay [data-grants-submit]').click();
  await page.locator('#overlay .grants-error').waitFor();
  check('WORLD without an expiry is stopped on the screen',(await page.locator('#overlay .grants-error').innerText()).includes('WORLD 권한은 기한을 꼭 정해야 해요.')&&!central.writes.some(row=>row.op==='entitlement.grant'));
  const until=new Date(now+30*86400000).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
  await page.locator('#overlay input[name="validUntil"]').fill(until);
  await page.locator('#overlay [data-grants-submit]').click();
  await page.locator('#overlay .modal').waitFor({state:'detached'});
  const granted=central.writes.filter(row=>row.op==='entitlement.grant');
  check('the grant reached the central function once with the chosen expiry',granted.length===1&&granted[0].product==='world'&&granted[0].capability==='practice.plus'&&granted[0].validUntil===until+'T14:59:59.000Z');
  await admin.locator('[data-grants-ents] tbody tr', {hasText:'WORLD 연습 더하기'}).nth(1).waitFor();
  await page.setViewportSize({width:390,height:900});await page.waitForTimeout(300);
  check('entitlements fit at 390',await fits());
  await shot('10-entitlements-390.png',{fullPage:true});
  await admin.locator('[data-grants-action="ents-pick"]').click();
  await page.locator('#overlay input[name="q"]').waitFor();
  await mobileInputs('picker');
  await page.locator('#overlay [data-action="close-modal"]').first().click();
  await admin.locator('[data-grants-action="ent-grant"]').click();
  await page.locator('#overlay .grants-confirm').waitFor();
  await mobileInputs('entitlement grant');
  check('entitlement grant dialog fits at 390',await fits());
  await shot('10b-entitlement-grant-390.png');
  await page.locator('#overlay [data-action="close-modal"]').first().click();
  await page.setViewportSize({width:1440,height:1000});
  // 관리자 올리기(직원 상세 · 성과 칸의 직원 줄)
  await admin.locator('[data-directory-scope="staff"]').click();
  await admin.locator('[data-grants-action="admin-promote"]').first().waitFor();
  check('promotion is offered only to the linked member',await admin.locator('[data-grants-action="admin-promote"]').count()===1);
  check('demotion is offered for the other administrator',await admin.locator('[data-grants-action="admin-demote"]').count()===1);
  await admin.locator('[data-grants-action="admin-promote"]').click();
  await page.locator('#overlay .grants-confirm').waitFor();
  check('promotion stays disabled until the name is typed',await page.locator('#overlay [data-grants-submit]').isDisabled());
  await page.locator('#overlay [data-grants-confirm-name]').fill('검증 실무자');
  check('typing the name enables promotion',!(await page.locator('#overlay [data-grants-submit]').isDisabled()));
  await shot('11-promote-confirm-1440.png');
  await page.setViewportSize({width:390,height:900});await page.waitForTimeout(300);
  await mobileInputs('promotion');
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#overlay [data-action="close-modal"]').first().click();
  // 15분이 지나면 쓰기 단추가 「SYNK ID로 다시 로그인」으로 바뀐다.
  stamp+=16*60_000;
  await admin.locator('[data-directory-scope="classes"]').click();
  await admin.locator('[data-grants-action="class-toggle"]').waitFor();
  await admin.locator('[data-grants-action="class-toggle"]').click();
  await page.locator('#overlay [data-grants-action="reauth"]').waitFor();
  check('a stale login shows the re-login button',await page.locator('#overlay [data-grants-action="reauth"]').innerText()==='SYNK ID로 다시 로그인');
  check('the dialog says the login is done again',(await page.locator('#overlay .grants-reauth').innerText()).includes('한 번 더 로그인해 확인해요'));
  await shot('12-reauth-1440.png');
  await page.setViewportSize({width:390,height:900});await page.waitForTimeout(300);
  check('dialog fits at 390',await fits());
  await shot('13-reauth-390.png');
  // 단추를 누르면 SYNK ID 포털(reauth=1)로 가고, next는 등록된 승인 주소다. 포털은 합성 응답으로 받는다.
  await page.route('https://synk.im/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><title>portal</title>'}));
  const portalRequest=page.waitForRequest(request=>request.url().startsWith('https://synk.im/id/'));
  await page.locator('#overlay [data-grants-action="reauth"]').click();
  const portal=new URL((await portalRequest).url()),next=new URL(portal.searchParams.get('next')||'about:blank');
  check('the re-login goes through the SYNK ID portal with reauth=1',portal.origin+portal.pathname==='https://synk.im/id/'&&portal.searchParams.get('reauth')==='1');
  check('the portal is sent on to the registered authorize address',next.origin+next.pathname==='https://identity.example.test/auth/v1/oauth/authorize'&&next.searchParams.get('client_id')==='messenger-browser'&&next.searchParams.get('redirect_uri')===app.origin+'/api/synk-id/callback');
  check('no page errors',errors.length===0);
  await writeFile(join(output,'report.json'),JSON.stringify({ok:true,checks,shots,consoleErrors,centralWrites:central.writes.length},null,2));
  console.log(JSON.stringify({ok:true,checks:checks.length,shots,consoleErrors},null,2));
}catch(error){
  await writeFile(join(output,'report.json'),JSON.stringify({ok:false,error:String(error?.stack||error),checks,shots,errors,consoleErrors},null,2)).catch(()=>{});
  console.error(error);process.exitCode=1;
}finally{
  await browser?.close();await app.stop();
  assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});
}
