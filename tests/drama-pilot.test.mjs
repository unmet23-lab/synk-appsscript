import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {pcmInfo,wavFromPCM,decodeAudio} from '../tools/lib/drama-pilot-audio.mjs';
import {ProcessBudget,observeTranscript,publicLesson} from '../tools/lib/drama-pilot-service.mjs';
import {createPilotServer} from '../tools/drama-pilot.mjs';

const spec={id:'location',line:'선배님, 도서관이 어디예요?',minSyllables:7,ending:['polite','formal'],keys:[{word:'도서관'},{word:'어디예요',alts:['어디에 있는지','어디 있는지','어디에 있어요']}],variants:['도서관이 어디에 있어요?']};
const lesson={id:'test',title:'fixture',scene:[{type:'actor',id:'actor1',text:'fixture'},
  {type:'student',id:'line1',text:spec.line,spec}],transfer:{id:'transfer',prompt:'위치를 묻는 상황',text:'복사실이 어디예요?',spec:{...spec,line:'복사실이 어디예요?',keys:[{word:'복사실'},{word:'어디예요'}]},modelAudio:'/media/secret.mp3'}};
const raw=text=>({text,languages:[{code:'ko'}]});
function sine(seconds=1){const pcm=Buffer.alloc(Math.round(16_000*seconds)*2);for(let i=0;i<pcm.length/2;i++)pcm.writeInt16LE(Math.round(4000*Math.sin(i*Math.PI*2*300/16000)),i*2);return pcm;}

test('최초 새상황 전송에는 한국어 정답·모범 음성·명세가 없다',()=>{
  const publicData=publicLesson(lesson);
  assert.equal(publicData.transfer.text,undefined);assert.equal(publicData.transfer.spec,undefined);assert.equal(publicData.transfer.modelAudio,undefined);
  assert.equal(publicData.scene[1].spec,undefined);
});
test('언어 예측 불가·외국어·모호한 끝맺음은 잘했다고 단정하지 않는다',()=>{
  for(const r of [{text:spec.line,languages:[]},{text:'Where is the library?',languages:[{code:'en'}]},raw('도서관 위치 문의'),raw('오늘은 비가 정말 많이 오네요')]){
    const result=observeTranscript(spec,r,{seconds:5,speechSeconds:3});
    assert.equal(result.observation.kind,'pending');assert.equal(result.observation.note,null);assert.equal(result.observation.sure,false);
  }
});
test('원래 허용된 다른 표현은 받아들이고 확실한 반말은 한 가지만 관찰한다',()=>{
  assert.equal(observeTranscript(spec,raw('도서관이 어디에 있어요?'),{seconds:4}).observation.kind,'pass');
  const r=observeTranscript(spec,raw('도서관이 어디야?'),{seconds:4});
  // 낱말/끝맺음이 확실하지 않은 변형을 확정 오류로 만들지 않는다.
  assert.notEqual(r.observation.kind,'pass');
  const off=observeTranscript(spec,raw('고마워. 도서관이 어디예요?'),{seconds:5});
  assert.equal(off.observation.kind,'note');assert.equal(off.observation.note.kind,'ending');
});
test('명세 밖의 들린 말은 인식실패와 구분하고 독립 관찰을 소모하지 않는다',async t=>{
  assert.equal(observeTranscript(spec,raw('오늘은 비가 정말 많이 오네요'),{seconds:5}).status,'ok');
  let n=0;
  const app=await setup(t,{transcribe:async()=>++n===1?raw('저도 잘 모르겠는데요'):raw('복사실이 어디예요?')});
  const pending=await (await app.take({lineId:'transfer',phase:'transfer'})).json();
  assert.equal(pending.status,'ok');assert.equal(pending.observation.kind,'pending');assert.equal(pending.take.independentEligible,false);
  const second=await (await app.take({lineId:'transfer',phase:'transfer'})).json();assert.equal(second.take.independentEligible,true);
});
test('무음은 무음으로, 실제 길이가 한도를 넘으면 해독 단계에서 거절한다',async()=>{
  assert.equal(pcmInfo(Buffer.alloc(32000)).rms,0);
  const silent=await decodeAudio(wavFromPCM(Buffer.alloc(32000)));
  assert.equal(silent.silent,true);assert.equal(silent.seconds,1);
  const audible=await decodeAudio(wavFromPCM(sine(1)));
  assert.equal(audible.silent,false);
  await assert.rejects(decodeAudio(wavFromPCM(sine(20.5))),e=>e.code==='audio_too_long');
  await assert.rejects(decodeAudio(Buffer.from('this is not audio')),e=>e.code==='invalid_audio');
});
test('예약된 사용료는 API 실패 뒤에도 남아 무제한 실패 재시도를 막는다',()=>{
  const budget=new ProcessBudget({maxUSD:.002,maxCalls:3});budget.reserve(20);budget.failure();
  assert.throws(()=>budget.reserve(20),e=>e.code==='usage_limit');
  assert.equal(budget.snapshot().calls,1);assert.equal(budget.snapshot().upstreamFailures,1);
  assert.equal(budget.snapshot().invoiceVerified,false);
});

async function setup(t,overrides={}){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'synk-pilot-test-'));
  await fs.writeFile(path.join(root,'index.html'),'<!doctype html><title>fixture</title>');
  await fs.writeFile(path.join(root,'content.mjs'),'DO_NOT_SERVE');
  const probe=await import('node:net');const socket=probe.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));
  const port=socket.address().port;await new Promise(r=>socket.close(r));
  const calls=[],events=[];
  const app=createPilotServer({lesson,root,port,analysis:true,
    decode:async()=>({wav:Buffer.from('decoded audio'),seconds:4,speechSeconds:3,silent:false}),
    transcribe:async()=>{calls.push(1);return raw('선배님, 도서관이 어디예요?');},ledger:e=>events.push(e),...overrides});
  await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
  t.after(async()=>{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await fs.rm(root,{recursive:true,force:true});});
  const init=await fetch(`${app.origin}/api/bootstrap`);const cookie=init.headers.get('set-cookie').split(';')[0];
  const bootstrap=await init.json();
  const headers={cookie,'x-pilot-csrf':bootstrap.csrfToken,origin:app.origin};
  const post=async(route,data)=>fetch(app.origin+route,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(data)});
  const take=async({lineId='line1',phase='scene',requestId=randomUUID(),consent='yes',...options}={})=>{
    const form=new FormData();form.set('audio',new Blob(['fake recording'],{type:'audio/webm'}),'clip.webm');
    for(const [key,value] of Object.entries({lineId,phase,requestId,consent}))form.set(key,value);
    return fetch(`${app.origin}/api/take`,{method:'POST',headers,...options,body:form});
  };
  return {...app,testRoot:root,headers,post,take,calls,events,bootstrap};
}

test('다른 사이트·위조 Host·CSRF 누락·동의 없음을 외부 호출 전에 거절한다',async t=>{
  const app=await setup(t);
  assert.equal((await fetch(`${app.origin}/api/bootstrap`,{headers:{origin:'https://attacker.invalid'}})).status,403);
  const wrongHost=await new Promise((resolve,reject)=>{
    const req=http.request(`${app.origin}/api/bootstrap`,{headers:{host:'localhost:1234'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
    req.on('error',reject);req.end();
  });
  assert.equal(wrongHost,403);
  assert.equal((await app.take({headers:{cookie:app.headers.cookie}})).status,403);
  assert.equal((await app.take({consent:'no'})).status,403);
  assert.equal(app.calls.length,0);
  assert.equal((await fetch(`${app.origin}/content.mjs`)).status,404);
  assert.equal((await fetch(`${app.origin}/media/../../tools/lib/오픈AI키.mjs`)).status,404);
});
test('정상 녹음·재전송은 한번만 호출하고 기록에는 음성·받아쓴 글이 없다',async t=>{
  const app=await setup(t),requestId=randomUUID();
  const first=await app.take({requestId});assert.equal(first.status,200);
  const body=await first.json();assert.equal(body.observation.kind,'pass');assert.equal(body.take.independentEligible,false);
  const second=await app.take({requestId});assert.deepEqual(await second.json(),body);assert.equal(app.calls.length,1);
  assert.equal((await app.take({requestId,lineId:'transfer',phase:'transfer'})).status,409);
  assert.equal(JSON.stringify(app.events).includes(body.transcript),false);
  assert.equal(JSON.stringify(app.events).includes('fake recording'),false);
  await app.post('/api/reset',{});
  assert.equal((await app.take({requestId})).status,409);
  assert.equal(app.calls.length,1);
});
test('사용 중인 세션 쿠키는 만료시각을 갱신하고 같은 모범 공개 이력을 잇는다',async t=>{
  const app=await setup(t);
  await app.post('/api/reveal',{lineId:'transfer'});
  const again=await fetch(`${app.origin}/api/bootstrap`,{headers:{cookie:app.headers.cookie}});
  assert.equal(again.headers.get('set-cookie').split(';')[0],app.headers.cookie);
  assert.match(again.headers.get('set-cookie'),/Max-Age=2700/);
  assert.equal((await again.json()).firstExposure,false);
});
test('해독/받아쓰기 보류 재시도는 독립 관찰 기회를 없애지 않는다',async t=>{
  let n=0;
  const app=await setup(t,{transcribe:async()=>++n===1?{text:'...',languages:[]}:raw('복사실이 어디예요?')});
  const unclear=await (await app.take({lineId:'transfer',phase:'transfer'})).json();
  assert.equal(unclear.status,'unclear');assert.equal(unclear.take.independentEligible,false);
  const clear=await (await app.take({lineId:'transfer',phase:'transfer'})).json();
  assert.equal(clear.take.independentEligible,true);
});
test('원문 경로와 미디어 바깥 연결은 파일을 읽지 못한다',async t=>{
  const app=await setup(t),outside=await fs.mkdtemp(path.join(os.tmpdir(),'synk-pilot-outside-'));
  t.after(()=>fs.rm(outside,{recursive:true,force:true}));
  await fs.writeFile(path.join(outside,'fixture.mp3'),'OUTSIDE_PRIVATE_FIXTURE');
  await fs.symlink(outside,path.join(app.testRoot,'media'),process.platform==='win32'?'junction':'dir');
  const linked=await fetch(`${app.origin}/media/fixture.mp3`);
  assert.equal(linked.status,404);assert.equal((await linked.text()).includes('OUTSIDE_PRIVATE_FIXTURE'),false);
  // 정규화되지 않은 %2f 원문은 URL 디코딩/파일 열기까지 가지 않아야 한다.
  const status=await new Promise((resolve,reject)=>{
    const req=http.request(app.origin,{path:'/media/..%2f..%2ffixture.mp3'},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
    req.on('error',reject);req.end();
  });
  assert.equal(status,404);
});
test('새 상황은 첫 제출/힌트 여부를 구분하고 다시하기로 본 모범을 지우지 않는다',async t=>{
  const app=await setup(t,{transcribe:async()=>raw('복사실이 어디예요?')});
  const first=await (await app.take({lineId:'transfer',phase:'transfer'})).json();
  assert.equal(first.take.firstUnhintedAttempt,true);assert.equal(first.take.independentEligible,true);
  const second=await (await app.take({lineId:'transfer',phase:'transfer'})).json();assert.equal(second.take.independentEligible,false);
  const revealed=await (await app.post('/api/reveal',{lineId:'transfer'})).json();assert.equal(revealed.hinted,true);
  await app.post('/api/reset',{});
  const after=await (await app.take({lineId:'transfer',phase:'transfer'})).json();
  assert.equal(after.take.hinted,true);assert.equal(after.take.independentEligible,false);
});
test('인식 대기 중 다시 시작하면 이전 응답이 새 시도에 섞이지 않는다',async t=>{
  let release,started;const entered=new Promise(r=>started=r);
  const app=await setup(t,{transcribe:()=>{started();return new Promise(r=>release=r);}});
  const request=app.take();await entered;
  assert.equal((await app.post('/api/reset',{})).status,200);
  release(raw(spec.line));assert.equal((await request).status,409);
  assert.equal(app.budget.snapshot().calls,1);
});
test('무음과 공급자 오류를 성공으로 만들지 않으며 예산을 넘으면 호출하지 않는다',async t=>{
  const silent=await setup(t,{decode:async()=>({wav:Buffer.alloc(0),seconds:3,silent:true})});
  assert.equal((await (await silent.take()).json()).status,'no_speech');assert.equal(silent.calls.length,0);
  const down=await setup(t,{transcribe:async()=>{throw Error('PRIVATE upstream text');},budget:new ProcessBudget({maxCalls:1})});
  const error=await (await down.take()).json();assert.equal(error.status,'unavailable');
  assert.equal(JSON.stringify(error).includes('PRIVATE'),false);assert.equal(JSON.stringify(down.events).includes('PRIVATE'),false);
  assert.equal((await down.take()).status,429);assert.equal(down.budget.snapshot().calls,1);
});

// 11-02 코치 틀(결정 10-31 「싱크타운 다시 짜기」 ③) — 화면 말·목소리에 감독·촬영·컷이 없고, 녹음 전 코치 자리는 비어 있다.
test('시범판 화면 말과 목소리는 코치 틀이고 「AI로 만든」 표기가 없다',async()=>{
  const {STR,endingFix}=await import('../experiences/drama/pilot/strings.mjs');
  const {PILOT,COACH_VOICE}=await import('../experiences/drama/pilot/content.mjs');
  for(const [lang,table] of Object.entries(STR)){
    for(const [key,value] of Object.entries(table)){
      const text=typeof value==='function'?String(value('x',1)):JSON.stringify(value);
      assert.doesNotMatch(text,/감독|촬영|컷|배역|배우|오디션|[Dd]irector|[Ff]ilm|[Ss]hoot|\bCut\b|[Aa]udition/,`${lang}.${key}`);
      // 받아쓰기 동의 글의 「외부 AI 서비스」는 녹음이 어디로 가는지 알리는 말이라 둔다. 인물·목소리 표시는 「AI로 만든」을 쓰지 않는다.
      if(!/^consent/.test(key))assert.doesNotMatch(text,/AI/,`${lang}.${key}`);
    }
  }
  assert.equal(STR.ko.synthetic,'인물은 지어냈고, 목소리는 모두 합성했어요.');
  assert.equal(PILOT.notices.synthetic,STR.ko.synthetic);
  assert.equal(STR.ko.noteEnding,"처음 만난 선배에게는 끝에 '요'를 붙여 봐요.");
  assert.equal(endingFix({kind:'ending',want:'polite',got:'plain',at:'헤맸어'}),'헤맸어 → 헤맸어요');
  assert.equal(endingFix({kind:'ending',want:'polite',got:'plain',at:'있어?'}),'있어 → 있어요');
  for(const at of ['어디야','간다','몰라',''])assert.equal(endingFix({kind:'ending',want:'polite',got:'plain',at}),null,at);
  assert.equal(endingFix({kind:'length'}),null);
  assert.equal(PILOT.director,undefined);
  assert.equal(COACH_VOICE.noteEnding.text,"끝에 '요'를 붙여 봐요. 이 장면을 다시 해 볼까요?");
  assert.equal(COACH_VOICE.wrap.text,'오늘은 여기까지! 수고했어요.');
  for(const [key,cue] of Object.entries(PILOT.coach)){
    assert.doesNotMatch(cue.text,/컷|촬영|감독|테이크|지난번/,key);
    assert.equal(cue.audio===null||cue.audio==='/media/'+COACH_VOICE[key].file,true,key);
  }
  assert.equal(publicLesson(PILOT).coach,PILOT.coach);
  assert.equal(JSON.stringify(PILOT).includes('director-'),false);
});
test('쇼케이스 영상 자리는 학생 목소리 구간 뒤에서만 선배 구간을 자른다',async()=>{
  const {showcaseJobs}=await import('../tools/build-drama-pilot-assets.mjs');
  const {SHOWCASE_CUTS}=await import('../experiences/drama/pilot/content.mjs');
  assert.deepEqual(SHOWCASE_CUTS.map(c=>c.cut),['C1','C3','C2','C4']);
  assert.throws(()=>showcaseJobs([{cut:'C2',src:'C2.mp4',listen:[0.3,4.2],reply:[4.0,null]}]),/끝난 뒤부터/);
  assert.throws(()=>showcaseJobs([{cut:'C4',src:'C4.mp4',listen:[0.3,null]}]),/끝\(초\)/);
  // 학생 목소리가 든 자리에서 listen 없이 선배 구간만 채우면 Hana 소리가 실릴 수 있어 막는다(Fable P2). C1은 학생 목소리가 없다.
  assert.throws(()=>showcaseJobs([{cut:'C2',src:'C2.mp4',listenFor:'s1e01-6',listen:null,reply:[0,null]}]),/listen/);
  assert.deepEqual(showcaseJobs([{cut:'C1',src:'C1.mp4',reply:[0.3,null]}]).map(j=>j.out),['c1-reply.mp4']);
  const jobs=showcaseJobs([{cut:'C2',src:'C2.mp4',listen:[0.3,4.2],reply:[4.3,null],reask:null}]);
  assert.deepEqual(jobs.map(j=>[j.out,j.kind]),[['c2-listen.mp4','video-silent'],['c2-reply.mp4','video']]);
});
// 11-02 장면 화면 = 시네마 자막 — 음성 구는 시범판 서버가 내는 Orbloom 사본(MIT)이고, 화면은 바깥 스크립트·글꼴을 부르지 않는다.
test('장면 화면은 바깥 스크립트 없이 Orbloom 사본을 쓰고 고정폭 라벨에 한글을 넣지 않는다',async t=>{
  const dir=new URL('../experiences/drama/pilot/',import.meta.url);
  const read=f=>fs.readFile(new URL(f,dir),'utf8');
  const [html,js,css,orb]=await Promise.all(['index.html','pilot.mjs','pilot.css','orbloom.mjs'].map(read));
  assert.match(orb,/^\/\*! orbloom@0\.1\.0[\s\S]*MIT License[\s\S]*Ricky Bharti/);
  for(const src of [html,js,css,orb])assert.doesNotMatch(src,/https?:\/\/(?!github\.com\/rickybharti)[^\s'"]+\.(?:m?js|css|woff2?)/);
  // ./today/screen.mjs는 「오늘」 한 장(깃발 ?today=1 뒤, 11-14)만 부르는 같은 폴더 모듈이다 — 공개 빌드는 싣지 않는다(drama-today.test.mjs).
  assert.deepEqual([...js.matchAll(/(?:import\s*\(|from\s+)'([^']+)'/g)].map(m=>m[1]).sort(),['./orbloom.mjs','./strings.mjs','./takes.mjs','./today/screen.mjs']);
  // 고정폭(.k · .who · .ep · .mstate · 표지 k) 자리에 넣는 글은 영문만이다. tx(...)·h('b', ...)(산세리프 한글 안내)는 빼고 본다.
  const hangul=/[가-힣]/;
  const literals=src=>[...src.replace(/tx\([^)]*\)/g,'').replace(/h\('b'[^)]*\)/g,'').matchAll(/'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`]*)`/g)].map(m=>m[1]??m[2]);
  const spots=[
    ...[...js.matchAll(/h\('p', \{ class: 'k' \},([^\n]*)/g)].map(m=>m[1]),                    // .k 줄
    ...[...js.matchAll(/orbMode\('[a-z]+', ([^{\n]*?)(?:, \{|\);)/g)].map(m=>m[1]),            // 구 상태 라벨
    ...[...js.matchAll(/const label = \(sec\) => (`[^`]*`)/g)].map(m=>m[1]),                     // 녹음 중 라벨
    ...[...js.matchAll(/subs\([^,\n]+, [^,\n]+, ([^,)\n]+)/g)].map(m=>m[1]),                    // 자막 화자
    ...[...js.matchAll(/\bk: ('[^']*')/g)].map(m=>m[1]),                                        // 표지 작은 글
    js.match(/const PHASE_TAG = \{[^}]*\}/)[0],                                                  // 회차 알약
  ];
  assert.ok(spots.length>=12,`찾은 자리 ${spots.length}`);
  for(const spot of spots)for(const lit of literals(spot))assert.doesNotMatch(lit,hangul,`${lit} ← ${spot.slice(0,80)}`);
  const app=await setup(t);
  await fs.writeFile(path.join(app.testRoot,'orbloom.mjs'),'export {};');
  const served=await fetch(`${app.origin}/orbloom.mjs`);
  assert.equal(served.status,200);assert.match(served.headers.get('content-type'),/javascript/);
});
