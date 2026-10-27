// 한국어 공부 · 튜터 판단 시험(README §8). node --test experiences/korean-study/qa/tutor.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readState,addObs,markSeen,observeWrite,next,gradeForm,gradeFind,checkChange,evidence,storeKey,offAxes} from '../src/tutor.mjs';
import {drillPool} from '../../synk-world-app/world-writing-focus.mjs';
import {studyBank,studyContent} from '../build.mjs';

const world=JSON.parse(fs.readFileSync(new URL('../../synk-world-app/world-writing-items.json',import.meta.url)));
const content=JSON.parse(fs.readFileSync(new URL('../content/ending-53.json',import.meta.url)));
const open=world.items.filter(i=>i.review.status==='passed');
// 판단 시험은 콘텐츠의 검수 상태와 떼어 본다(학생 화면에 나가는 것은 아래 빌드 시험이 passed만 남기는지 본다).
const bank={open53:open.filter(i=>i.type===53),pool:drillPool(open),forms:content.items.filter(i=>i.type==='study-form'),finds:content.items.filter(i=>i.type==='study-find')};
const T0=Date.parse('2026-10-28T09:00:00Z'),at=m=>new Date(T0+m*60000).toISOString(),DAY=1440;
const MIXED='중고 거래 앱 이용자가 늘었다. 2020년에는 300만 명이었습니다. 2024년에는 1,200만 명으로 늘었습니다. 이용자가 늘어난 이유는 두 가지이다.';
const ALL_OFF='중고 거래 앱 이용자가 늘었습니다. 2020년에는 300만 명이었습니다. 2024년에는 1,200만 명으로 늘었어요. 이유는 두 가지입니다.';
const GOOD='언어 교환 프로그램 참가자가 크게 늘었다. 2021년에는 80명이었다. 2025년에는 520명으로 증가했다. 외국인 학생이 많아졌기 때문이다.';
const s0=()=>readState(null);
const write=(st,itemId,text,m,{support=0,same=false}={})=>addObs(st,{kind:'write',itemId,support,same,...observeWrite(text),at:at(m)},{now:T0+m*60000});
const sorts=(st,oks,m)=>oks.reduce((x,ok,i)=>addObs(x,{kind:'sort',card:`w51-a:${i}`,bin:'plain',ok,use:'check',at:at(m+i)},{now:T0+(m+i)*60000}),st);
const forms=(st,list,m)=>list.reduce((x,[id,ok],i)=>{const f=bank.forms.find(f=>f.id===id);return addObs(x,{kind:'form',id,axis:f.axis,use:f.use,ok,at:at(m+i)},{now:T0+(m+i)*60000});},st);
const probe=(st,p,m)=>addObs(st,{kind:'probe',probe:p,at:at(m)},{now:T0+m*60000});
const method=(st,mm,m)=>addObs(st,{kind:'method',method:mm,at:at(m)},{now:T0+m*60000});
const nx=(st,m)=>next(st,bank,{now:T0+m*60000});

test('처음은 설정 없이 바로 쓰기(L0)', ()=>{const n=nx(s0(),0);assert.equal(n.scene,'write');assert.equal(n.support,0);});

test('같은 「-습니다」 글, 이유가 다른 세 학생은 다른 방법으로 간다', ()=>{
 const base=write(s0(),'w53-resale',MIXED,0);
 // 근거가 없으면 확인부터 — 「-다」가 섞인 글이라 형태 확인이 먼저
 const first=nx(base,1);assert.equal(first.scene,'probe');assert.equal(first.probe,'form');
 const checks=bank.forms.filter(f=>f.use==='check').slice(0,2).map(f=>f.id);
 // 학생 1: 형태 확인 틀림 → 형태부터
 const a=forms(probe(base,'form',2),[[checks[0],false],[checks[1],true]],3);
 assert.equal(nx(a,10).method,'forms');
 // 학생 2: 형태 확인 맞음 → 적용(내 글에 옮기기)
 const b=forms(probe(base,'form',2),[[checks[0],true],[checks[1],true]],3);
 assert.equal(nx(b,10).probe,'distinguish');
 assert.equal(nx(probe(sorts(b,[true,true,false],11),'distinguish',14),15).method,'apply');
 // 학생 3: 카드 구별이 흔들림 → 구별부터
 const c=sorts(probe(base,'distinguish',2),[false,false,true],3);
 assert.equal(nx(c,10).method,'contrast');
 // 전부 「-습니다/-아요」인 글은 구별 확인이 먼저
 assert.equal(nx(write(s0(),'w53-resale',ALL_OFF,0),1).probe,'distinguish');
});

test('원인 근거가 이미 있으면 확인을 건너뛴다', ()=>{
 let st=sorts(s0(),[true,true,true],0);st=forms(st,bank.forms.filter(f=>f.use==='check').slice(0,2).map(f=>[f.id,true]),5);
 st=write(st,'w53-resale',MIXED,10);
 const n=nx(st,11);assert.equal(n.scene,'method');assert.equal(n.method,'apply');
});

test('한 실패에 확인은 최대 둘 — 그 뒤에는 결정한다', ()=>{
 const st=probe(probe(write(s0(),'w53-resale',MIXED,0),'form',1),'distinguish',2);
 assert.equal(nx(st,3).scene,'method');
});

test('방법 뒤: 성공은 지원을 낮추고, 실패 1번은 도움 한 단 올림, 2번은 방법을 바꾸고, 셋 다 쓰면 쉰다', ()=>{
 let st=method(probe(write(s0(),'w53-resale',MIXED,0),'form',1),'apply',2);
 assert.deepEqual([nx(st,3).scene,nx(st,3).support],['write',1]);
 st=write(st,'w53-study-ways',MIXED,4,{support:1});
 assert.deepEqual([nx(st,5).scene,nx(st,5).support],['write',2]);
 st=write(st,'w53-exchange',MIXED,6,{support:2});
 assert.equal(nx(st,7).method,'forms');
 st=write(write(method(st,'forms',8),'w53-living-cost',MIXED,9,{support:2}),'w53-clinic',MIXED,10,{support:2});
 // 처음 보는 자료가 떨어지면 방법보다 먼저 「자료 없음」은 아니고, 방법을 바꾸는 장면이다
 assert.equal(nx(st,11).method,'contrast');
 st=write(write(method(st,'contrast',12),'w53-resale',MIXED,13,{support:2,same:true}),'w53-resale',MIXED,14,{support:2,same:true});
 assert.equal(nx(st,15).scene,'rest');assert.equal(nx(st,15).why,'tried-all');
});

test('도움 뒤에만 성공하면 한 단 낮춘 다음 쓰기', ()=>{
 let st=method(probe(write(s0(),'w53-resale',MIXED,0),'form',1),'contrast',2);
 st=write(st,'w53-study-ways',GOOD,3,{support:2});
 const n=nx(st,4);assert.equal(n.scene,'write');assert.equal(n.support,1);assert.equal(n.why,'fade');
 st=write(st,'w53-exchange',GOOD,5,{support:1});assert.equal(nx(st,6).support,0);
});

test('같은 글을 다시 점검해 맞힌 것은 혼자 성공이 아니다', ()=>{
 const st=write(write(s0(),'w53-resale',MIXED,0),'w53-resale',GOOD,5,{same:true});
 const e=evidence(st,{now:T0+6*60000});assert.equal(e.alone.length,0);
 assert.equal(nx(st,6).why,'fade');
});

test('혼자 성공 1번 → 오늘은 쉼, 하루 뒤 다른 자료, 서로 다른 자료 2번(하루 간격) → 이 주제 끝', ()=>{
 let st=write(s0(),'w53-exchange',GOOD,0);
 assert.equal(nx(st,1).why,'alone-once');
 const n=nx(st,DAY+1);assert.equal(n.scene,'write');assert.equal(n.support,0);assert.notEqual(n.itemId,'w53-exchange');
 st=write(st,n.itemId,GOOD,DAY+5);
 assert.equal(nx(st,DAY+6).why,'done');
});

test('14일 넘은 기록은 다시 본다', ()=>{
 const st=write(s0(),'w53-resale',MIXED,0);
 const n=nx(st,15*DAY);assert.equal(n.scene,'write');assert.equal(n.why,'stale');
});

test('처음 보는 53번 자료가 없으면 쉼', ()=>{
 let st=s0();bank.open53.forEach((it,i)=>{st=write(st,it.id,MIXED,i,{support:2});});
 st=method(st,'apply',20);st=write(st,'w53-resale',MIXED,21,{support:2,same:true});
 // 마지막 실패 1번 뒤 도움을 올려 다시 써야 하지만 쓸 새 자료가 없다
 assert.equal(nx(st,22).scene,'rest');assert.equal(nx(st,22).why,'no-items');
});

test('기록 읽기: 미래 시각·모르는 종류·깨진 값은 버리고, 학생 글 원문은 관측에 없다', ()=>{
 const st=readState({v:1,obs:[{kind:'write',itemId:'w53-resale',support:0,plain:1,off:2,total:3,formal:2,polite:0,at:at(0),offSentences:['비밀']},{kind:'write',at:'2099-01-01T00:00:00Z',itemId:'x',support:0,plain:3,off:0,total:3,formal:0,polite:0},{kind:'hack',at:at(1)},{kind:'sort',at:at(2),card:'x:1',bin:'nope',ok:true},null,'x'],drafts:{'w53-resale':{text:'글',updatedAt:at(0)},'../x':{text:'a'}}},{now:T0+60000});
 assert.equal(st.obs.length,1);assert.equal(JSON.stringify(st.obs).includes('비밀'),false);assert.deepEqual(Object.keys(st.drafts),['w53-resale']);
 assert.equal(readState({v:2,obs:[{kind:'write'}]}).obs.length,0);
});

test('판정 안 함: 세 문장 미만·반복·의문 끝·빈 글', ()=>{
 assert.equal(observeWrite(''),null);assert.equal(observeWrite('   '),null);
 assert.equal(observeWrite('이용자가 늘었다. 이유는 두 가지이다.'),null);
 assert.equal(observeWrite('다. 다. 다. 다.'),null);
 assert.equal(observeWrite('이용자가 늘었다. 왜 늘었을까? 이유는 두 가지이다. 비용이 싸다.'),null);
 assert.equal(observeWrite(GOOD).off,0);assert.equal(observeWrite(MIXED).off,2);
});

test('형태 채점은 검수된 인정 범위만 — 단순히 「다」를 붙인 꼴은 틀림', ()=>{
 const f=id=>bank.forms.find(x=>x.id===id);
 assert.equal(gradeForm(f('s53-f-adj-c1'),'많다'),true);assert.equal(gradeForm(f('s53-f-adj-c1'),'많는다'),false);
 assert.equal(gradeForm(f('s53-f-verb-c1'),'공부하다'),false);assert.equal(gradeForm(f('s53-f-verb-c1'),' 공부한다. '),true);
 assert.equal(gradeForm(f('s53-f-noun-c1'),'이유다'),true);assert.equal(gradeForm(f('s53-f-noun-c1'),''),null);
 assert.equal(gradeFind(bank.finds[1],[3,1]),true);assert.equal(gradeFind(bank.finds[1],[1]),false);
 assert.deepEqual([checkChange('이용자가 많는다.').why,checkChange('이용자가 증가하다.').why,checkChange('이용자가 많습니다.').why,checkChange('이용자가 많다.').ok],['adj-neun','dict','ending',true]);
});

test('섞인 끝의 축 짐작은 과거·명사만 가르고 나머지는 둘 다', ()=>{
 assert.deepEqual(offAxes(['늘었습니다.','두 가지입니다.','많아요.']),['verb','adj','noun','past']);
 assert.deepEqual(offAxes(['300만 명이었습니다.']),['past']);
});

test('계정(owner)마다 다른 저장 키', ()=>{
 assert.equal(storeKey('guest'),'synk.study.v1:guest');assert.notEqual(storeKey('a1'),storeKey('b2'));assert.equal(storeKey('../x'),'synk.study.v1:guest');
});

test('확인용 문항은 정답을 본 뒤 다시 확인용으로 나오지 않는다', ()=>{
 let st=write(s0(),'w53-resale',MIXED,0);
 const checks=bank.forms.filter(f=>f.use==='check').map(f=>f.id);
 st=markSeen(st,checks.slice(0,checks.length-1),{now:T0+60000});
 // 남은 확인용이 하나뿐이면 형태 확인을 묻지 않고 구별 확인으로
 const n=nx(st,2);assert.equal(n.scene,'probe');assert.equal(n.probe,'distinguish');
});

test('빌드: 학생에게 가는 문항은 검수 통과분만, 예시답 없음', ()=>{
 const b=studyBank(world);assert.ok(b.items.every(i=>i.review.status==='passed'&&!('model' in i)&&!('blanks' in i)));
 assert.deepEqual([...new Set(b.items.map(i=>i.type))].sort(),[51,52,53]);
 const draft={...content,items:content.items.map((i,n)=>({...i,review:{status:n===0?'passed':n===1?'held':'draft'}}))};
 assert.deepEqual(studyContent(draft).items.map(i=>i.id),[content.items[0].id]);
});

test('구별 확인만 했으면 형태 확인을 한 번 더 — 둘 다 되면 적용(Fable P1-3)', ()=>{
 let st=probe(sorts(write(s0(),'w53-resale',ALL_OFF,0),[true,true,true],1),'distinguish',4);
 const n=nx(st,5);assert.equal(n.scene,'probe');assert.equal(n.probe,'form');
 st=probe(forms(st,n.forms.map(id=>[id,true]),6),'form',8);
 assert.equal(nx(st,9).method,'apply');
});

test('설명 뒤 연습 카드(D1)는 원인 근거가 아니다(Fable P2-1)', ()=>{
 let st=write(s0(),'w53-resale',MIXED,0);
 st=[false,false,false].reduce((x,ok,i)=>addObs(x,{kind:'sort',card:`w51-a:${i}`,bin:'plain',ok,use:'learn',at:at(1+i)},{now:T0+(1+i)*60000}),st);
 assert.equal(evidence(st,{now:T0+5*60000}).distinguish,null);
});

test('확인 문항이 떨어지고 질문할 것이 없으면 사전 기대로 정한다', ()=>{
 let st=markSeen(write(s0(),'w53-resale',MIXED,0),bank.forms.filter(f=>f.use==='check').map(f=>f.id),{now:T0+60000});
 st=probe(sorts(st,[true,true,true],2),'distinguish',5);
 const n=nx(st,6);assert.equal(n.scene,'method');assert.equal(n.method,'apply');
});

test('루트 R1: 끝만 「-다」인 틀린 꼴(많는다·증가하다.)은 혼자 성공이 아니고 형태 연습으로', ()=>{
 const bad='이용자가 증가하다. 외국인 학생이 많는다. 친구가 한국어를 공부하다.';
 const o=observeWrite(bad);assert.equal(o.off,0);assert.equal(o.flags,3);
 const st=write(s0(),'w53-resale',bad,0);
 assert.equal(evidence(st,{now:T0+60000}).alone.length,0);
 const n=nx(st,1);assert.equal(n.scene,'method');assert.equal(n.method,'forms');
 // 정상 예는 그대로 혼자 성공
 assert.equal(observeWrite(GOOD).flags,0);assert.equal(nx(write(s0(),'w53-exchange',GOOD,0),1).why,'alone-once');
});

test('아르곤 A1·A5: 형태 연습 재료가 없으면 다른 방법, 헷갈린 축이 둘이면 축마다 2문항', ()=>{
 const bad='이용자가 증가하다. 외국인 학생이 많는다. 친구가 한국어를 공부하다.';
 const st=write(s0(),'w53-resale',bad,0);
 const noLearn={...bank,forms:bank.forms.filter(f=>f.use==='check')};
 assert.equal(next(st,noLearn,{now:T0+60000}).method,'apply');
 let s2=forms(write(s0(),'w53-resale',MIXED,0),[['s53-f-verb-c1',false],['s53-f-adj-c1',false]],1);
 s2=probe(s2,'form',3);
 const n=nx(s2,4);assert.equal(n.method,'forms');
 const axes=n.forms.map(id=>bank.forms.find(f=>f.id===id).axis);
 assert.deepEqual([axes.filter(a=>a==='verb').length,axes.filter(a=>a==='adj').length],[2,2]);
});

test('Fable F1·F2: 기기 언어로 첫 화면 언어, 「적는다」·「가늘다」는 틀린 꼴로 잡지 않음', async()=>{
 const {chooseLang}=await import('../src/copy.mjs');
 const none={getItem:()=>null};
 assert.equal(chooseLang({search:'',storage:none,languages:['mn-MN']}),'mn');assert.equal(chooseLang({search:'',storage:none,languages:['mn-Mong-CN']}),'ko');
 assert.equal(chooseLang({search:'',storage:none,languages:['en-GB']}),'en');assert.equal(chooseLang({search:'?lang=ko',storage:none,languages:['mn']}),'ko');
 assert.equal(chooseLang({search:'',storage:{getItem:()=>'en'},languages:['mn']}),'en');
 assert.equal(checkChange('조사 결과를 표에 적는다.').ok,true);assert.equal(checkChange('선이 가늘다.').ok,true);
 assert.equal(checkChange('이용자가 늘다.').why,'dict');assert.equal(checkChange('비율이 높는다.').why,'adj-neun');
});
