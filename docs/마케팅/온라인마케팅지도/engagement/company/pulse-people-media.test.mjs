// PULSE 「채널 명단」 그림 올리기(조각 ③, 2026-11-23). 설계 docs/디자인/PULSE고객경험_20261120/인플루언서_의뢰창_설계.md 9절 「조각 ③」.
// 이 시험의 사람 · 채널 · 그림은 모두 합성이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat,readFile,writeFile,mkdir} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {workspaceMediaNames,MEDIA_READ_WINDOW_MS} from './workspace-media.mjs';
import {PEOPLE_MEDIA_KIND,PEOPLE_MEDIA_LIMITS,PEOPLE_MEDIA_WRITES,PEOPLE_MEDIA_DELETE_FILES,peopleMediaName,removePeopleImageFile} from './pulse-people-media.mjs';
import {createPulsePeopleRoutes} from './pulse-people-routes.mjs';
import {PEOPLE_SEED,createPulsePeople} from './pulse-people.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const jpeg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwC1RRRXkn0R/9k=','base64');
const real=(extra={})=>({id:'',name:'합성 카페 채널',platform:'instagram',handle:'',url:'https://www.instagram.com/synthetic.cafe/',topics:['food'],audience:'',followers:null,avgViews:null,prices:{post:null,review:null},image:'',samples:[],virtual:false,example:false,active:true,...extra});

// writes를 주지 않으면 서버 옵션을 넘기지 않아 서버 기본값(PEOPLE_MEDIA_WRITES)을 쓴다(둘째 판 GPT GA3).
async function server(t,{writes}={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-people-media-'));let offset=0;
  const clock=()=>new Date(Date.parse('2026-11-23T03:00:00.000Z')+offset).toISOString();
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,pulseRequestFreeBytes:async()=>100*1024**3,clock,...(typeof writes==='boolean'?{pulsePeopleMediaWrites:writes}:{})};
  const app=createCompanyApp(options),address=await app.start(),base='http://127.0.0.1:'+address.port;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const person=(name,email,role,csrf)=>{const row=app.store.createUser({name,email,role,teamId:'team-a'});return {row,id:row.id,csrf,token:app.store.mint('session',row.id,{csrfToken:csrf},120)};};
  const admin=person('관리자 합성','admin@people-media.test','admin','csrf-admin'),member=person('담당자 합성','member@people-media.test','member','csrf-member');
  const parse=async response=>{const text=await response.text();let data=null;try{data=JSON.parse(text);}catch{}return {status:response.status,data,text,headers:response.headers};};
  const staff=(who,path,{body,raw,type='image/png',headers={}}={})=>fetch(base+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+who.token,'X-CSRF-Token':who.csrf,Origin:app.origin,...(body!==undefined?{'Content-Type':'application/json'}:raw!==undefined?{'Content-Type':type}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))}).then(parse);
  const upload=(who,bytes=png,type='image/png',headers={})=>staff(who,'/api/pulse-people/media',{raw:bytes,type,headers});
  const jar=new Map();
  const call=async(path,{body}={})=>{
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),Origin:app.origin,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
    for(const line of response.headers.getSetCookie?.()||[]){const [pair,...rest]=line.split(';'),[name,value]=pair.split('=');if(value&&!/max-age=0/i.test(rest.join(';')))jar.set(name,value);else jar.delete(name);}
    return parse(response);
  };
  const project=app.clientProjects.save(admin.row,{title:'합성 프로젝트',customerName:'합성 고객',ownerId:member.id,dueDate:'2026-12-01'}).project;
  const invite=app.clientProjects.invite(admin.row,project.id,{revision:app.store.get('clientProjects',project.id).revision}).invite;
  assert.equal((await call('/pulse/api/open',{body:{invite}})).status,200);
  const save=async entries=>{const view=await staff(admin,'/api/pulse-people');return staff(admin,'/api/pulse-people/roster',{body:{version:view.data.version,entries}});};
  const disk=id=>app.store.get(PEOPLE_MEDIA_KIND,id)?.diskName;
  const exists=async name=>!!(await stat(join(options.dataDir,'studio-media',name)).catch(()=>null));
  const file=name=>readFile(join(options.dataDir,'studio-media',name));
  return {app,base,admin,member,staff,upload,call,save,disk,exists,file,dataDir:options.dataDir,tick:ms=>{offset+=ms;}};
}

test('올리기: 관리자만, PNG · JPEG 2MB까지, 속이 그림이 아니면 415. 이름과 속이 다르면 속을 따른다',async t=>{
  const f=await server(t);
  assert.equal((await f.upload(f.member)).status,403);
  assert.equal((await f.staff(f.admin,'/api/pulse-people/media',{raw:png,headers:{'X-CSRF-Token':'wrong'}})).status,403);
  assert.equal((await f.upload(f.admin,png,'image/gif')).status,415);
  assert.equal((await f.upload(f.admin,Buffer.from('not an image'),'image/png')).status,415);
  assert.equal((await f.upload(f.admin,png.subarray(0,40),'image/png')).status,415,'끝 덩어리가 없는 PNG(서명만 맞음)는 받지 않는다');
  assert.equal((await f.upload(f.admin,Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0]),Buffer.alloc(60)]),'image/jpeg')).status,415,'끝 표식이 없는 JPEG는 받지 않는다');
  assert.equal((await f.upload(f.admin,Buffer.alloc(PEOPLE_MEDIA_LIMITS.bytes+1,1),'image/png')).status,413);
  // 뼈대를 끝까지 걷는다(둘째 판 GPT GA2): 화소 덩어리(IDAT)가 없는 PNG, 덩어리 길이가 파일 밖을 가리키는 PNG, IEND 뒤에 바이트가 남은 PNG, SOF · SOS 없이 끝나는 JPEG는 받지 않는다.
  const chunks=[];for(let at=8;at<png.length;){const size=png.readUInt32BE(at);chunks.push(png.subarray(at,at+12+size));at+=12+size;}
  assert.equal((await f.upload(f.admin,Buffer.concat([png.subarray(0,8),...chunks.filter(chunk=>chunk.toString('latin1',4,8)!=='IDAT')]),'image/png')).status,415,'IDAT가 없는 PNG');
  const stretched=Buffer.from(png);stretched.writeUInt32BE(1000,8+25);assert.equal((await f.upload(f.admin,stretched,'image/png')).status,415,'IDAT 길이가 파일 밖을 가리키는 PNG');
  assert.equal((await f.upload(f.admin,Buffer.concat([png,Buffer.from([0])]),'image/png')).status,415,'IEND 뒤에 바이트가 남은 PNG');
  const emptyData=Buffer.from([0,0,0,0,0x49,0x44,0x41,0x54,0x35,0xaf,0x06,0x1e]);
  assert.equal((await f.upload(f.admin,Buffer.concat([png.subarray(0,8),...chunks.map(chunk=>chunk.toString('latin1',4,8)==='IDAT'?emptyData:chunk)]),'image/png')).status,415,'자료가 빈 IDAT 하나뿐인 PNG(다시 GA3)');
  for(const type of ['constructor','__proto__','toString'])assert.equal((await f.upload(f.admin,png,type)).status,415,`물려받은 이름 ${type}은 형식이 아니다(다시 GA1)`);
  assert.equal((await f.upload(f.admin,Buffer.concat([jpeg.subarray(0,20),Buffer.from([0xff,0xd9])]),'image/jpeg')).status,415,'APP0 뒤 바로 끝나는 JPEG');
  const sent=await f.upload(f.admin);assert.equal(sent.status,201,sent.text);assert.match(sent.data.ref,/^media:[a-f0-9-]{36}$/);
  const swapped=await f.upload(f.admin,jpeg,'image/png');assert.equal(swapped.status,201,swapped.text);
  const swappedId=swapped.data.ref.slice(6);assert.match(f.disk(swappedId),/\.jpg$/);assert.equal(f.app.store.get(PEOPLE_MEDIA_KIND,swappedId).mimeType,'image/jpeg');
  const id=sent.data.ref.slice(6);assert.ok(await f.exists(f.disk(id)));
  const shown=await f.staff(f.admin,sent.data.url);assert.equal(shown.status,200);assert.equal(shown.headers.get('content-type'),'image/png');assert.equal(shown.headers.get('x-content-type-options'),'nosniff');
  assert.equal((await f.staff(f.member,sent.data.url)).status,403,'관리자가 아니면 그림도 못 본다');
  assert.ok(f.app.store.all('audit').some(row=>row.action==='pulse-people-media-uploaded'));
  assert.ok(workspaceMediaNames(f.app.store.db).includes(f.disk(id)),'백업 · 버킷 목록에 든다');
  assert.throws(()=>peopleMediaName({diskName:'../x.png'}),/채널 명단 그림 기록/);
  const view=await f.staff(f.admin,'/api/pulse-people');assert.ok(view.data.uploads.some(item=>item.ref===sent.data.ref));
});

test('명단: 실제 채널도 올린 그림은 쓸 수 있고 캐스팅북 얼굴은 못 쓴다. 없는 그림은 400. 손님에게는 손님 그림 경로로 보이고 요청마다 권한을 본다',async t=>{
  const f=await server(t);
  const ref=(await f.upload(f.admin)).data.ref,id=ref.slice(6);
  assert.equal((await f.save([real({image:'media:00000000-0000-4000-8000-000000000000'})])).status,400);
  assert.equal((await f.save([real({image:PEOPLE_SEED[0].image})])).status,400);
  const saved=await f.save([real({image:ref,samples:[ref]})]);assert.equal(saved.status,200,saved.text);assert.equal(saved.data.entries[0].image,ref);
  assert.equal('removed' in saved.data,false,'지운 파일 이름은 응답에 싣지 않는다');
  assert.equal((await f.call('/pulse/api/people/media/'+id)).status,404,'스위치가 꺼져 있으면 없다');
  assert.equal((await f.staff(f.admin,'/api/settings/pulse-features',{body:{people:true}})).status,200);
  const list=await f.call('/pulse/api/people');assert.equal(list.data.entries[0].image,'/pulse/api/people/media/'+id);assert.deepEqual(list.data.entries[0].samples,['/pulse/api/people/media/'+id]);
  const image=await f.call('/pulse/api/people/media/'+id);assert.equal(image.status,200);assert.equal(image.headers.get('cache-control'),'private, no-store');
  assert.equal((await f.call('/pulse/api/people/media/'+id+'?x=1')).status,400);
  const other=(await f.upload(f.admin)).data.ref.slice(6);
  assert.equal((await f.call('/pulse/api/people/media/'+other)).status,404,'명단이 가리키지 않는 그림은 손님이 못 받는다');
  const view=await f.staff(f.admin,'/api/pulse-people');
  assert.equal((await f.staff(f.admin,'/api/pulse-people/roster',{body:{version:view.data.version,entries:[{...view.data.entries[0],active:false},real({name:'합성 둘째 채널',url:'https://www.youtube.com/@synthetic'})]}})).status,200);
  assert.equal((await f.call('/pulse/api/people/media/'+id)).status,404,'꺼진 칸의 그림은 손님이 못 받는다');
  assert.equal((await fetch(f.base+'/pulse/api/people/media/'+id,{headers:{Origin:f.app.origin}})).status,401,'손님 세션이 없으면 401');
});

test('정리: 명단이 가리키지 않는 그림은 한 시간 동안 두고, 그 뒤 지우는 중으로 표시해 고르기 · 백업에서 뺀다. 지우는 중으로 하루를 지난 그림은 파일을 지우고 문서를 뗀다',async t=>{
  const f=await server(t);
  const kept=(await f.upload(f.admin)).data.ref,loose=(await f.upload(f.admin)).data.ref;
  const keptId=kept.slice(6),looseId=loose.slice(6),looseDisk=f.disk(looseId);
  assert.equal((await f.save([real({image:kept})])).status,200);
  assert.ok(f.disk(looseId),'한 시간 안에는 다른 탭이 쓰려고 올린 그림일 수 있어 둔다');
  f.tick(PEOPLE_MEDIA_LIMITS.graceMs+1000);
  const view=await f.staff(f.admin,'/api/pulse-people');
  assert.equal((await f.staff(f.admin,'/api/pulse-people/roster',{body:{version:view.data.version,entries:view.data.entries}})).status,200);
  assert.equal(f.app.store.get(PEOPLE_MEDIA_KIND,looseId).gone,true,'지우는 중으로 표시한다');
  assert.equal(workspaceMediaNames(f.app.store.db).includes(looseDisk),false,'표시 뒤의 백업은 그 그림을 세지 않는다');
  assert.equal(await f.exists(looseDisk),true,'파일은 표시 전에 잡힌 백업이 끝나도록 하루 동안 둔다');
  assert.equal((await f.staff(f.admin,'/api/pulse-people')).data.uploads.some(item=>item.ref===loose),false);
  f.tick(PEOPLE_MEDIA_LIMITS.goneMs+60000);
  await f.app.sweepPulseMessageUploads();
  assert.equal(await f.exists(looseDisk),true,'벽시계로 하루가 지나도 지우지 않는다 — 하루는 서버 프로세스의 단조 시계로 잰다');
  // 지우는 중으로 하루를 지난 그림(agedMs)은 6시간 정리가 파일을 지우고 문서를 뗀다.
  f.app.store.put(PEOPLE_MEDIA_KIND,looseId,{...f.app.store.get(PEOPLE_MEDIA_KIND,looseId),agedMs:PEOPLE_MEDIA_LIMITS.goneMs});
  await f.app.sweepPulseMessageUploads();
  assert.equal(await f.exists(looseDisk),false,'하루를 지나면 6시간 정리가 파일을 지운다');
  assert.equal(f.app.store.get(PEOPLE_MEDIA_KIND,looseId)??null,null,'파일을 지운 뒤 문서를 뗀다');
  assert.ok(f.disk(keptId)&&await f.exists(f.disk(keptId)),'명단이 가리키는 그림은 남는다');
  // 지우는 중(gone)인 그림은 파일을 지우기 전이라도 백업 목록에서 뺀다(다시 검수 GA1). 파일이 이미 없으면(서버가 먼저 비움) 지운 것으로 보고, 저장 길에서도 문서를 뗀다.
  const gone='32345678-1234-4123-8123-123456789abc';f.app.store.put(PEOPLE_MEDIA_KIND,gone,{id:gone,diskName:gone+'.png',mimeType:'image/png',byteSize:1,at:'2026-11-20T01:00:00.000Z',gone:true,goneAt:'2026-11-21T01:00:00.000Z',agedMs:PEOPLE_MEDIA_LIMITS.goneMs});
  assert.equal(workspaceMediaNames(f.app.store.db).includes(gone+'.png'),false);
  const again=await f.staff(f.admin,'/api/pulse-people');
  assert.equal((await f.staff(f.admin,'/api/pulse-people/roster',{body:{version:again.data.version,entries:again.data.entries}})).status,200);
  assert.equal(f.app.store.get(PEOPLE_MEDIA_KIND,gone)??null,null);
});

test('정리: 지우는 중인 그림의 하루는 서버 프로세스의 단조 시계로 잰다 — 벽시계를 앞뒤로 돌려도 줄지 않고, 서버가 꺼져 있던 시간은 세지 않는다(둘째 판 GPT GA1 · 다시 GA2)',async t=>{
  const f=await server(t);
  const id=(await f.upload(f.admin)).data.ref.slice(6),disk=f.disk(id);
  let wall=Date.parse('2026-11-23T03:00:00.000Z'),steadyNow=5000;
  const make=()=>createPulsePeople({store:f.app.store,clientProjects:f.app.clientProjects,features:{read:()=>({people:false})},clock:()=>new Date(wall).toISOString(),steady:()=>steadyNow});
  let people=make();
  wall+=2*3600000;steadyNow+=2*3600000;assert.deepEqual(people.sweep(),[]);
  assert.equal(f.app.store.get(PEOPLE_MEDIA_KIND,id).gone,true);assert.equal(f.app.store.get(PEOPLE_MEDIA_KIND,id).agedMs,0,'표시한 정리에서 나이는 0이다');
  wall+=2*86400000;steadyNow+=60000;assert.deepEqual(people.sweep(),[],'벽시계가 이틀 앞으로 가도 실제로는 1분');
  wall-=3*86400000;steadyNow+=60000;assert.deepEqual(people.sweep(),[],'벽시계가 사흘 뒤로 가도 1분씩 더할 뿐');
  steadyNow+=PEOPLE_MEDIA_LIMITS.goneMs-3*3600000;assert.deepEqual(people.sweep(),[],'모두 21시간 2분');
  steadyNow+=10*3600000;people=make();assert.deepEqual(people.sweep(),[],'서버를 다시 띄우면 꺼져 있던 10시간은 세지 않는다');
  steadyNow+=3*3600000;assert.deepEqual(people.sweep(),[disk],'새 프로세스에서 3시간 — 모두 하루를 넘었다');
  assert.equal(await f.exists(disk),true,'sweep은 이름만 돌려주고 파일은 부른 쪽이 지운다');
});

test('지우기와 백업: 이 판은 파일 지우기를 켠다. 표시 뒤 하루는 백업 읽기 한도(6시간)에 뒤 단계(90분)와 시계 차이를 더한 것보다 길다(GPT 다섯째 GA3)',()=>{
  assert.equal(PEOPLE_MEDIA_DELETE_FILES,true);
  assert.ok(PEOPLE_MEDIA_LIMITS.goneMs>=3*MEDIA_READ_WINDOW_MS,'하루 ≥ 6시간 × 3');
});

test('쓰기 스위치: 이 판은 기본으로 올리기를 연다. 대표 화면에 「그림 올리기」 칸이 보인다',async t=>{
  assert.equal(PEOPLE_MEDIA_WRITES,true);
  const f=await server(t,{writes:undefined});
  const view=await f.staff(f.admin,'/api/pulse-people');assert.equal(view.data.mediaOpen,true);
  const sent=await f.upload(f.admin);assert.equal(sent.status,201,sent.text);
  assert.ok((await f.staff(f.admin,'/api/pulse-people')).data.uploads.some(item=>item.ref===sent.data.ref),'저장 전 올린 그림도 고르기에 싣는다');
});

test('쓰기를 닫은 판(이 판을 되돌린 앞 판): 올리기는 404, 새 그림은 저장되지 않고, 이미 저장된 그림 칸은 깨지지 않고 읽힌다(GPT 검수 GA1)',async t=>{
  const f=await server(t,{writes:false});
  assert.equal((await f.upload(f.admin)).status,404);
  const view=await f.staff(f.admin,'/api/pulse-people');assert.equal(view.data.mediaOpen,false);
  // 다음 판(쓰기를 연 판)이 남긴 문서를 이 판이 읽는 경우: 명단과 그림이 그대로 읽히고 백업 목록에 든다.
  const id='12345678-1234-4123-8123-123456789abc';
  f.app.store.put(PEOPLE_MEDIA_KIND,id,{id,diskName:id+'.png',mimeType:'image/png',byteSize:png.length,at:'2026-11-23T02:00:00.000Z',by:f.admin.id});
  f.app.store.put('pulsePeopleRoster','main',{version:4,entries:[{...real({id:'ch_kept0001',image:'media:'+id})}],updatedAt:'2026-11-23T02:00:00.000Z',updatedBy:f.admin.id});
  const read=await f.staff(f.admin,'/api/pulse-people');assert.equal(read.data.broken,false);assert.equal(read.data.entries[0].image,'media:'+id);
  const loose='42345678-1234-4123-8123-123456789abc';f.app.store.put(PEOPLE_MEDIA_KIND,loose,{id:loose,diskName:loose+'.png',mimeType:'image/png',byteSize:1,at:'2026-11-23T02:59:00.000Z',by:f.admin.id});
  assert.deepEqual((await f.staff(f.admin,'/api/pulse-people')).data.uploads.map(item=>item.ref),['media:'+id],'쓰기를 열기 전에는 명단이 가리키는 그림만 고르기에 싣는다(다시 검수 GA2)');
  assert.ok(workspaceMediaNames(f.app.store.db).includes(id+'.png'));
  // 이미 있는 그림은 그대로 다시 저장할 수 있고, 새 그림은 받지 않는다.
  assert.equal((await f.staff(f.admin,'/api/pulse-people/roster',{body:{version:4,entries:read.data.entries}})).status,200);
  const other='22345678-1234-4123-8123-123456789abc';
  f.app.store.put(PEOPLE_MEDIA_KIND,other,{id:other,diskName:other+'.png',mimeType:'image/png',byteSize:png.length,at:'2026-11-23T02:59:00.000Z',by:f.admin.id});
  assert.equal((await f.staff(f.admin,'/api/pulse-people/roster',{body:{version:5,entries:[{...read.data.entries[0],samples:['media:'+other]}]}})).status,400);
});

test('경로 모듈: 파일을 옮기는 사이 세션이 끝나면 그림 문서를 적지 않고 파일을 지운다(GA4). 지우지 못한 파일은 문서를 남겨 다음에 다시 지운다(GA8)',async()=>{
  let live={user:{id:'u1'},hash:'h1',body:{csrfToken:'c1'}};const calls=[];
  const service={mediaOpen:()=>true,assertAdmin:()=>{},addMedia:()=>{calls.push('add');return {ref:'media:x',url:'/x',removed:['a.png','b.png']};},forgetMedia:names=>calls.push('forget:'+names.join(','))};
  const media={receive:async()=>({temporary:'t',metadata:{id:'x',diskName:'x.png'}}),commit:async()=>{calls.push('commit');live=null;},discard:async()=>calls.push('discard'),remove:async name=>{if(name==='b.png')throw new Error('잠김');calls.push('remove:'+name);},serve:async()=>{}};
  const routes=createPulsePeopleRoutes({service,body:async()=>({}),send:()=>{},session:()=>live,origin:'http://o',audit:()=>{},media});
  const req={method:'POST',headers:{origin:'http://o','x-csrf-token':'c1'}};
  await assert.rejects(routes(req,{}, {url:new URL('http://o/api/pulse-people/media')}),error=>error.status===401);
  assert.deepEqual(calls,['commit','discard'],'세션이 끝났으면 문서를 적지 않고 옮긴 파일을 지운다');
  calls.length=0;live={user:{id:'u1'},hash:'h1',body:{csrfToken:'c1'}};media.commit=async()=>calls.push('commit');
  const sent=[],audits=[];const ok=createPulsePeopleRoutes({service,body:async()=>({}),send:(res,status,body)=>sent.push(status),session:()=>live,origin:'http://o',audit:(user,action,target,detail)=>audits.push({action,...detail}),media});
  assert.equal(await ok(req,{}, {url:new URL('http://o/api/pulse-people/media')}),true);
  assert.deepEqual(calls,['commit','add','remove:a.png','forget:a.png'],'지운 파일의 문서만 뗀다');assert.deepEqual(sent,[201]);
  assert.deepEqual(audits,[{action:'pulse-people-media-uploaded',ref:'media:x',removed:1}],'감사 기록에는 시도한 둘이 아니라 실제로 지운 하나를 적는다(서버 끝 판 카본 A2)');
});

test('JPEG는 첫 그림 한 장만 남기고 끝 표식 뒤는 모두 뗀다(Ultra HDR 보정 그림 · 영상도). 끝 표식이 없거나 압축 자료가 빈 JPEG는 받지 않는다. 점진 JPEG(SOS 여럿)는 받는다(Fable 설계 검토 P3-2)',async t=>{
  const f=await server(t);
  const tailed=Buffer.concat([jpeg,Buffer.from('synthetic-trailer')]);
  const sent=await f.upload(f.admin,tailed,'image/jpeg');assert.equal(sent.status,201,sent.text);
  const doc=f.app.store.get(PEOPLE_MEDIA_KIND,sent.data.ref.slice(6));
  assert.equal(doc.byteSize,jpeg.length,'적는 크기는 그림까지다');assert.deepEqual(await f.file(doc.diskName),jpeg,'디스크에도 그림까지만 둔다');
  // Ultra HDR(보정 그림이 바로 뒤 · 패딩 뒤), 움직이는 사진(영상 머리)도 첫 그림 한 장만 남는다(Fable 설계 검토 「명단 JPEG 꼬리」 11-27, GPT -b2 GA1 · -b3 GA1 · GA2). 합성 바이트다.
  const kept=async bytes=>{const sent=await f.upload(f.admin,bytes,'image/jpeg');assert.equal(sent.status,201,sent.text);const doc=f.app.store.get(PEOPLE_MEDIA_KIND,sent.data.ref.slice(6));assert.equal(doc.byteSize,jpeg.length);return f.file(doc.diskName);};
  assert.deepEqual(await kept(Buffer.concat([jpeg,jpeg])),jpeg,'바로 뒤의 둘째 그림도 뗀다');
  assert.deepEqual(await kept(Buffer.concat([jpeg,Buffer.alloc(4),jpeg])),jpeg,'패딩 뒤의 둘째 그림도 뗀다');
  assert.deepEqual(await kept(Buffer.concat([jpeg,jpeg,Buffer.from([0,0,0,0x18]),Buffer.from('ftypmp42synthetic-video')])),jpeg,'영상 꼬리도 뗀다');
  // 이름은 PNG인데 속이 꼬리 붙은 JPEG여도 속을 따르고 꼬리를 뗀다.
  const swapped=await f.upload(f.admin,tailed,'image/png');assert.equal(swapped.status,201,swapped.text);
  const swappedDoc=f.app.store.get(PEOPLE_MEDIA_KIND,swapped.data.ref.slice(6));assert.equal(swappedDoc.mimeType,'image/jpeg');assert.equal(swappedDoc.byteSize,jpeg.length);
  assert.equal((await f.upload(f.admin,jpeg.subarray(0,jpeg.length-2),'image/jpeg')).status,415,'끝 표식 없이 압축 자료에서 끝나는 JPEG');
  const sos=jpeg.indexOf(Buffer.from([0xff,0xda])),header=jpeg.subarray(sos,sos+2+jpeg.readUInt16BE(sos+2));
  assert.equal((await f.upload(f.admin,Buffer.concat([jpeg.subarray(0,sos),header,Buffer.from([0xff,0xd9])]),'image/jpeg')).status,415,'SOS 뒤 압축 자료가 비었다');
  // 산술 부호화 프레임(SOF10)의 스캔은 압축 자료가 0바이트일 수 있다(T.81 D.1.8, 검수 pulse-people-followups-20261127 GA2).
  const arithmetic=Buffer.from(jpeg);arithmetic[jpeg.indexOf(Buffer.from([0xff,0xc0]))+1]=0xca;
  assert.equal((await f.upload(f.admin,Buffer.concat([arithmetic.subarray(0,sos),header,Buffer.from([0xff,0xd9])]),'image/jpeg')).status,201,'산술 부호화 스캔은 빈 압축 자료도 받는다');
  assert.equal((await f.upload(f.admin,Buffer.concat([jpeg.subarray(0,sos),header,Buffer.from([0x12,0xff])]),'image/jpeg')).status,415,'압축 자료 끝의 홀로 남은 FF');
  // 다시 시작 표식(RST)만 든 압축 자료는 빈 자료다(GPT pulse-media-trash GA2).
  assert.equal((await f.upload(f.admin,Buffer.concat([jpeg.subarray(0,sos),header,Buffer.from([0xff,0xd0,0xff,0xd9]),Buffer.from('tail')]),'image/jpeg')).status,415,'RST만 든 압축 자료');
  // 점진 JPEG: 프레임 표식을 SOF2로 바꾸고 SOS를 하나 더 둔다(GPT pulse-media-trash GA3 — SOF0 그대로면 SOF2를 빼는 회귀를 못 잡는다).
  const sof=jpeg.indexOf(Buffer.from([0xff,0xc0]));assert.ok(sof>0,'시험 그림에 SOF0이 있다');
  const sof2=Buffer.from(jpeg);sof2[sof+1]=0xc2;
  // 둘째 스캔의 다시 시작 표식 앞에 채움 FF를 하나 둔다(GPT pulse-media-trash-20261127 GA3 — 채움 분기를 빼면 이 그림을 거절한다).
  const progressive=Buffer.concat([sof2.subarray(0,sof2.length-2),header,Buffer.from([0x12,0xff,0x00,0x34,0xff,0xff,0xd0,0x56]),Buffer.from([0xff,0xd9])]);
  assert.equal((await f.upload(f.admin,progressive,'image/jpeg')).status,201,'SOF2 · 둘째 SOS와 채움 · 다시 시작 표식을 지나 끝 표식까지 걷는다');
  const noFrame=Buffer.from(jpeg);noFrame[sof+1]=0xc4;
  assert.equal((await f.upload(f.admin,noFrame,'image/jpeg')).status,415,'프레임 표식이 없으면 받지 않는다');
  assert.equal((await f.upload(f.admin,Buffer.concat([png,Buffer.from('tail')]),'image/png')).status,415,'PNG 꼬리는 그대로 받지 않는다');
});

test('저장: 올린 뒤 한 시간 넘게 저장하지 않아 지우는 중이 된(또는 지운) 그림을 고르면 까닭과 할 일을 말한다. 화면은 그 그림만 고르기 목록과 쓰던 값에서 뺀다(화면 최종 검수 F1)',async t=>{
  const f=await server(t);
  const ref=(await f.upload(f.admin)).data.ref,id=ref.slice(6);
  f.tick(PEOPLE_MEDIA_LIMITS.graceMs+1000);await f.app.sweepPulseMessageUploads();
  assert.equal(f.app.store.get(PEOPLE_MEDIA_KIND,id).gone,true);
  const message='2번째 칸의 올린 그림을 찾지 못했어요. 올린 뒤 한 시간 안에 저장하지 않은 그림은 지워요. 그림을 다시 올린 뒤 저장해 주세요.';
  const first=await f.save([real(),real({name:'합성 둘째 채널',url:'https://www.youtube.com/@synthetic',samples:[ref]})]);
  assert.equal(first.status,400);assert.equal(first.data.code,'SYNK_PEOPLE_MEDIA_GONE');assert.equal(first.data.error,message);
  assert.deepEqual(first.data.gone,[ref],'찾지 못한 그림의 참조를 함께 내린다(화면이 그 그림만 뺀다)');
  f.app.store.remove(PEOPLE_MEDIA_KIND,id);
  const later=await f.save([real(),real({name:'합성 둘째 채널',url:'https://www.youtube.com/@synthetic',image:ref})]);
  assert.equal(later.data.code,'SYNK_PEOPLE_MEDIA_GONE','파일을 지우고 문서를 뗀 뒤에도 같은 문장');assert.equal(later.data.error,message);assert.deepEqual(later.data.gone,[ref]);
  assert.equal((await f.save([real({image:PEOPLE_SEED[0].image})])).data.code,undefined,'다른 그림 오류는 예전 문장 그대로');
  // 장면 그림이 한도(셋)를 넘는 칸은 찾지 못한 그림 검사에서 보지 않는다 — 칸 검사가 400으로 막는다(GPT pulse-people-followups-20261127-b GA3).
  let lookups=0;const get=f.app.store.get.bind(f.app.store);t.mock.method(f.app.store,'get',(kind,key)=>{if(kind===PEOPLE_MEDIA_KIND)lookups++;return get(kind,key);});
  const flood=await f.save([real(),real({name:'합성 셋째 채널',url:'https://www.youtube.com/@synthetic3',samples:Array.from({length:400},()=>ref)})]);t.mock.restoreAll();
  assert.equal(flood.status,400);assert.equal(flood.data.code,undefined);assert.ok(lookups<=8,'그림 문서를 한도 안에서만 찾는다: '+lookups);
  // 화면(public/pulse-app/app.mjs saveRoster)을 그대로 떼어 가짜 화면 상태로 돌린다(검수 pulse-media-trash-20261127 GA2 · GA4, pulse-people-followups-20261127 GA1 · GA3).
  const app=readFileSync(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8').replace(/\r/g,'');
  const from=app.indexOf('async function saveRoster('),to=app.indexOf('\nasync function rosterAct(',from);assert.ok(from>0&&to>from,'saveRoster가 있다');
  // 요청은 실제 api.mjs request로 보내고 fetch만 가짜다 — 400 응답의 gone이 오류에 옮겨지는 데까지 본다(GPT pulse-people-followups-20261127-b GA2).
  const {request:apiRequest}=await import('./public/pulse-app/api.mjs');
  const goneRef='media:'+randomUUID(),keptRef='media:'+randomUUID(),newRef='media:'+randomUUID();
  const run=async({gone})=>{
    const editing={index:1},values={image:goneRef,sample0:keptRef,sample1:'https://www.youtube.com/@synthetic',sample2:'../not-a-ref'},busyLog=[],calls=[],notices=[];let renders=0;
    const env={busy:false,loading:false,s:{error:'',roster:{version:3,editing,uploads:[{ref:newRef},{ref:goneRef},{ref:keptRef},{ref:'../not-a-ref'}]}},drafts:new Map([['k',{values,revision:1}]]),
      draftKey:()=>'k',setBusy:value=>{env.busy=value;busyLog.push(value);},options:()=>({}),clearDraft(){},forgetRosterDrafts(){},render:()=>{renders++;},notice:text=>{notices.push(text);},connectionExpired(){},
      loadRoster:async()=>{calls.push('loadRoster');},
      request:async(path,settings)=>{calls.push(path);
        t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({error:message,code:'SYNK_PEOPLE_MEDIA_GONE',...(gone?{gone}:{})}),{status:400,headers:{'Content-Type':'application/json'}}));
        try{return await apiRequest(path,settings);}finally{t.mock.restoreAll();}}};
    const saveRoster=new Function('env','with(env){return '+app.slice(from,to)+'}')(env);
    await saveRoster([],'저장했어요',{});
    return {env,editing,values,busyLog,calls,notices,renders};
  };
  // 서버가 알려 준 그림만 고르기 목록과 쓰던 값에서 빼고, 오류를 보이고, 저장 단추를 바로 푼다. 목록을 다시 받지 않는다 — 그사이 올린 그림(newRef)이 남는다.
  const done=await run({gone:[goneRef,'../not-a-ref']});
  assert.deepEqual(done.busyLog,[true,false],'저장 단추가 풀린다');assert.deepEqual(done.calls,['/api/pulse-people/roster'],'목록을 다시 받지 않는다');
  assert.equal(done.env.s.error,message);assert.deepEqual(done.notices,[message]);assert.equal(done.renders,1);
  assert.equal(done.env.s.roster.editing,done.editing,'고치던 칸을 닫지 않는다');
  // 꼴이 틀린 참조('../not-a-ref')는 api.mjs가 걸러 화면 상태에서 빠지지 않는다(-b2 GA2).
  assert.deepEqual(done.env.s.roster.uploads.map(item=>item.ref),[newRef,keptRef,'../not-a-ref'],'지운 그림만 고르기 목록에서 빠진다');
  assert.deepEqual(done.values,{image:'',sample0:keptRef,sample1:'https://www.youtube.com/@synthetic',sample2:'../not-a-ref'},'쓰던 값에서 지운 그림만 비운다');
  // 옛 서버처럼 gone 없이 오면 아무것도 빼지 않고 오류만 보인다.
  const plain=await run({});
  assert.deepEqual(plain.busyLog,[true,false]);assert.equal(plain.env.s.error,message);assert.equal(plain.values.image,goneRef);assert.equal(plain.env.s.roster.uploads.length,4);
});
test('감사 기록의 지운 수에는 이미 없던 파일을 세지 않는다. 이미 없던 파일도 문서는 뗀다(감사 기록 검수 GA1)',async t=>{
  const live={user:{id:'u1'},hash:'h1',body:{csrfToken:'c1'}},forgotten=[],audits=[];
  const service={mediaOpen:()=>true,assertAdmin:()=>{},addMedia:()=>({ref:'media:x',url:'/x',removed:['a.png','b.png','c.png']}),forgetMedia:names=>forgotten.push(...names)};
  const media={receive:async()=>({temporary:'t',metadata:{id:'x',diskName:'x.png'}}),commit:async()=>{},discard:async()=>{},remove:async name=>{if(name==='c.png')throw new Error('잠김');return name==='a.png';},serve:async()=>{}};
  const routes=createPulsePeopleRoutes({service,body:async()=>({}),send:()=>{},session:()=>live,origin:'http://o',audit:(user,action,target,detail)=>audits.push({action,...detail}),media});
  assert.equal(await routes({method:'POST',headers:{origin:'http://o','x-csrf-token':'c1'}},{}, {url:new URL('http://o/api/pulse-people/media')}),true);
  assert.deepEqual(forgotten,['a.png','b.png'],'지웠거나 이미 없던 그림의 문서만 뗀다');
  assert.deepEqual(audits,[{action:'pulse-people-media-uploaded',ref:'media:x',removed:1,missing:1}]);
  // 실제 지우기 함수: 지웠으면 참, 이미 없었으면 거짓을 돌려준다.
  const directory=await mkdtemp(join(tmpdir(),'synk-people-remove-'));
  t.after(async()=>{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const name='42345678-1234-4123-8123-123456789abc.png';await mkdir(join(directory,'studio-media'));await writeFile(join(directory,'studio-media',name),'synthetic');
  assert.equal(await removePeopleImageFile(directory,name),true);assert.equal(await removePeopleImageFile(directory,name),false);
});
