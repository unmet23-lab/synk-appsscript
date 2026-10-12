import assert from 'node:assert/strict';
import {mkdtemp,readFile,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {createCompanyApp} from './server.mjs';

export function fixtureWav(seconds=15){
  const rate=16000,count=seconds*rate,bytes=Buffer.alloc(44+count*2);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(count*2,40);
  for(let i=0;i<count;i++){const t=i/rate,phase=t%1;bytes.writeInt16LE(Math.round(phase<.18?Math.sin(t*440*Math.PI*2)*1600*Math.sin(phase/.18*Math.PI):0),44+i*2);}return bytes;
}
export async function createProductionFixture({seed=true}={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-production-'));
  const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  const base=`http://localhost:${port}`,options={dataDir:join(directory,'data'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port,origin:base,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null};
  let app=createCompanyApp(options);await app.start();
  const password='pulse-local-production-only',email='pulse-production@example.test';
  const owner=app.store.createUser({name:'제작 기능 검증 담당자',email,password,role:'admin'});
  const csrf='production-fixture-csrf',token=app.store.mint('session',owner.id,{csrfToken:csrf},120);
  async function request(path,{body,customer=null,headers={},raw=false}={}){
    const res=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:customer?.cookie||'synk_company_session='+token,...(body===undefined?{}:{Origin:base,...(!raw?{'Content-Type':'application/json'}:{}),[customer?'X-Pulse-CSRF':'X-CSRF-Token']:customer?.csrf||csrf}),...headers},...(body===undefined?{}:{body:raw?body:JSON.stringify(body)})});
    const bytes=Buffer.from(await res.arrayBuffer());let data=null;try{data=JSON.parse(bytes.toString());}catch{}return {status:res.status,data,bytes,headers:res.headers};
  }
  function ok(result,status=200){assert.equal(result.status,status,JSON.stringify(result.data?.error||{status:result.status}));return result.data;}
  let row=ok(await request('/api/client-projects',{body:{title:'PULSE 제작 흐름 · 검증 예시',customerName:'가상 모루 브랜드',summary:'실제 의뢰가 아닌 기능 검증 예시',terms:'검증용 예시 · 일정과 수정 조건은 실제 계약이 아닙니다.',nextStep:'메시지와 납품 목록을 먼저 확인해 주세요.'}}),201).project;
  const studio=async(body,customer=null)=>{const r=await request(customer?'/pulse/api/studio':`/api/client-projects/${row.id}/studio`,{customer,body:{revision:row.revision,...body}});if(r.status===200)row=r.data.project;return r;};
  const upload=async(fileName,mimeType,bytes)=>{const r=await request(`/api/client-projects/${row.id}/studio/media`,{body:bytes,raw:true,headers:{'Content-Type':mimeType,'X-File-Name':encodeURIComponent(fileName),'X-Project-Revision':String(row.revision)}});const result=ok(r,201);row=result.project;return result.asset;};
  if(seed){
    ok(await studio({action:'save_strategy',strategy:{primaryPromise:'한 잔으로 시작하는 나만의 아침',evidence1:'커피 준비 장면과 제품 패키지를 보여줍니다. 가상 브랜드의 흐름 확인 예시입니다.',desiredAction:'제품 소개 페이지 확인'}}));
    ok(await studio({action:'request_strategy_review'}));
    ok(await studio({action:'save_deliverables',deliverableRevision:0,notes:'기능 확인을 위한 예시 목록입니다.',items:[{label:'세로 광고',kind:'video',platform:'instagram',placement:'릴스',durationSeconds:15,aspectRatio:'9:16',language:'한국어',subtitles:'burned',fileFormat:'MP4',quantity:1},{label:'가로 광고',kind:'video',platform:'youtube',placement:'제품 소개 영상',durationSeconds:30,aspectRatio:'16:9',language:'한국어',subtitles:'separate',fileFormat:'MP4 + SRT',quantity:1}]}));
    ok(await studio({action:'request_deliverable_review',deliverableRevision:1}));
    for(const [file,title,color,pace]of [['reference-warm.png','따뜻한 표현 예시','따뜻한 크림색','천천히'],['reference-calm.png','차분한 표현 예시','차분한 청록색','보통']]){
      const media=await upload(file,'image/png',await readFile(new URL('./public/pulse-app/demo-assets/'+file,import.meta.url)));
      ok(await studio({action:'preview_save_sample',title,assetId:media.id,aspects:{color,pace,subtitle:'짧고 큰 문구'},description:'가상 브랜드의 화면 예시입니다. 원하는 요소만 골라 주세요.',visibility:'customer'}));
    }
    for(let i=1;i<=4;i++){
      const media=await upload(`scene-${i}.png`,'image/png',await readFile(new URL(`./public/pulse-app/demo-assets/scene-${i}.png`,import.meta.url)));
      ok(await studio({action:'save_scene',title:['아침의 시작','제품 소개','커피 준비','다음 행동'][i-1],description:'가상 브랜드 기능 검증용 장면',narration:i===1?'하루를 시작하는 짧은 여유':'',screenText:['아침에 15초의 여유','모루 드립백 커피','나만의 아침 루틴','제품 소개 확인'][i-1],duration:i===1?3:4,assetId:media.id,visibility:'customer'}));
    }
    const sound=await upload('검증용_타이밍_음.wav','audio/wav',fixtureWav()),videoBytes=await readFile(new URL('./public/pulse-app/demo-assets/preview-v1.mp4',import.meta.url)),clip=await upload('검증용_움직임.mp4','video/mp4',videoBytes);
    ok(await studio({action:'preview_save_animatic',audioAssetId:sound.id,testClipAssetId:clip.id,testClipStart:0,testClipDuration:7,note:'15초 장면 순서와 글자 표시를 확인합니다. 소리는 기능 검증용 타이밍 음입니다.',testNote:'미리 준비된 가상 브랜드 모션그래픽입니다. 인물·목소리의 생성 품질을 입증하는 영상은 아닙니다.',visibility:'customer'}));
    const version=ok(await request(`/api/client-projects/${row.id}/media`,{body:videoBytes,raw:true,headers:{'Content-Type':'video/mp4','X-File-Name':'preview.mp4','X-Version-Label':encodeURIComponent('검증용 시안 v1'),'X-Version-Kind':'preview','X-Version-Guide':encodeURIComponent('문구와 재생 흐름 확인용 예시'),'X-Project-Revision':String(row.revision)}}),201);row=version.project;
  }
  const issue=ok(await request(`/api/client-projects/${row.id}/invite`,{body:{revision:row.revision}}));
  const openResult=await request('/pulse/api/open',{body:{invite:issue.invite}});
  const customer={cookie:openResult.headers.get('set-cookie').split(';')[0],csrf:openResult.data.csrf};row=openResult.data.project;
  return {base,directory,owner,email,password,customer,invite:issue.invite,request,studio,upload,ok,get app(){return app;},get row(){return row;},set row(value){row=value;},async refresh(){row=ok(await request('/pulse/api/project',{customer})).project;return row;},async restart(){await app.stop();app=createCompanyApp(options);await app.start();},async stop(){await app.stop();}};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const fixture=await createProductionFixture();const out=resolve('.tmp/pulse-upgrade');await mkdir(out,{recursive:true});
  const ready={base:fixture.base,customerUrl:fixture.base+'/pulse-app/#invite='+encodeURIComponent(fixture.invite),staffUrl:fixture.base+'/pulse-app/?mode=staff&project='+fixture.row.id,email:fixture.email,password:fixture.password,dataDirectory:fixture.directory};
  await writeFile(join(out,'ready.json'),JSON.stringify(ready,null,2));console.log('Synthetic PULSE preview ready: '+fixture.base+'/pulse-app/');
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void fixture.stop().then(()=>{process.exitCode=0;}));
}
