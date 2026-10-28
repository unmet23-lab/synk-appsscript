// 한국어 공부 · 튜터 판단 시험(README §8). node --test experiences/korean-study/qa/tutor.test.mjs
// 답은 화면과 같은 길(recordWrite·recordSort·recordForm → Trail 사건 + obs)로 남기고, 「혼자 해냄」은 Trail.summarize가 정한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readState,migrate,addObs,markSeen,observeWrite,endCheck,linkedTo,next,gradeForm,gradeFind,checkChange,evidence,storeKey,legacyKey,offAxes,
 recordDecision,recordWrite,recordSort,recordForm,trailRows,checkCard,KC,TRAIL_MAX} from '../src/tutor.mjs';
import {drillPool} from '../../synk-world-app/world-writing-focus.mjs';
import {studyBank,studyContent} from '../build.mjs';

const world=JSON.parse(fs.readFileSync(new URL('../../synk-world-app/world-writing-items.json',import.meta.url)));
const content=JSON.parse(fs.readFileSync(new URL('../content/ending-53.json',import.meta.url)));
const open=world.items.filter(i=>i.review.status==='passed');
// 판단 시험은 콘텐츠의 검수 상태와 떼어 본다(학생 화면에 나가는 것은 아래 빌드 시험이 passed만 남기는지 본다).
const bank={open53:open.filter(i=>i.type===53),open54:open.filter(i=>i.type===54),pool:drillPool(open),forms:content.items.filter(i=>i.type==='study-form'),finds:content.items.filter(i=>i.type==='study-find')};
const T0=Date.parse('2026-10-28T09:00:00Z'),ms=m=>T0+m*60000,DAY=1440;
const MIXED='중고 거래 앱 이용자가 늘었다. 2020년에는 300만 명이었습니다. 2024년에는 1,200만 명으로 늘었습니다. 이용자가 늘어난 이유는 두 가지이다.';
const ALL_OFF='중고 거래 앱 이용자가 늘었습니다. 2020년에는 300만 명이었습니다. 2024년에는 1,200만 명으로 늘었어요. 이유는 두 가지입니다.';
const GOOD='언어 교환 프로그램 참가자가 크게 늘었다. 2021년에는 80명이었다. 2025년에는 520명으로 증가했다. 외국인 학생이 많아졌기 때문이다.';
const s0=()=>readState(null);
const scene=(st,m,plan={scene:'test'})=>recordDecision(st,plan,{now:ms(m)});
// 자료 연결 보조는 따로 시험하고, 판단 시험은 자료 없이(연결됨으로) 본다.
const write=(st,itemId,text,m,{support=0,mode='new',pasted=false,item=null}={})=>{const d=scene(st,m,{scene:'write'});return recordWrite(d.state,{did:d.did,item,itemId,text,support,mode,pasted},{now:ms(m)}).state;};
const checkCards=bank.pool.filter(checkCard),learnCards=bank.pool.filter(c=>!checkCard(c));
const sorts=(st,oks,m,{learn=false,cards=learn?learnCards:checkCards}={})=>{const d=scene(st,m);let x=d.state;oks.forEach((ok,i)=>{const c=cards[i];x=recordSort(x,{did:d.did,card:c,pick:ok?c.bin:(c.bin==='plain'?'formal':'plain'),learn},{now:ms(m+i)}).state;});return x;};
const forms=(st,list,m)=>{const d=scene(st,m);let x=d.state;list.forEach(([id,g],i)=>{const f=bank.forms.find(f=>f.id===id);x=recordForm(x,{did:d.did,form:f,grade:g},{now:ms(m+i)}).state;});return x;};
const probe=(st,p,m)=>addObs(st,{kind:'probe',probe:p},{now:ms(m)});
const method=(st,mm,m)=>addObs(st,{kind:'method',method:mm},{now:ms(m)});
const nx=(st,m)=>next(st,bank,{now:ms(m)});
const checksOf=n=>bank.forms.filter(f=>f.use==='check').slice(0,n).map(f=>f.id);

test('처음은 설정 없이 바로 쓰기(L0)', ()=>{const n=nx(s0(),0);assert.deepEqual([n.scene,n.support,n.mode,n.why],['write',0,'new','start']);});

test('같은 「-습니다」 글, 이유가 다른 세 학생은 다른 방법으로 간다', ()=>{
 const base=write(s0(),'w53-resale',MIXED,0);
 const first=nx(base,1);assert.equal(first.scene,'probe');assert.equal(first.probe,'form');
 const [c1,c2]=checksOf(2);
 assert.equal(nx(probe(forms(base,[[c1,false]],2),'form',3),10).method,'forms');
 const b=probe(forms(base,[[c1,true],[c2,true]],2),'form',4);
 assert.equal(nx(b,10).probe,'distinguish');
 assert.equal(nx(probe(sorts(b,[true,true,false],11),'distinguish',14),15).method,'apply');
 assert.equal(nx(probe(sorts(base,[false,false,true],2),'distinguish',5),10).method,'contrast');
 assert.equal(nx(write(s0(),'w53-resale',ALL_OFF,0),1).probe,'distinguish');
});

test('원인 근거가 이미 있으면 확인을 건너뛰고, 한 실패에 확인은 최대 둘', ()=>{
 let st=forms(sorts(s0(),[true,true,true],0),checksOf(2).map(id=>[id,true]),5);
 st=write(st,'w53-resale',MIXED,10);
 assert.deepEqual([nx(st,11).scene,nx(st,11).method],['method','apply']);
 assert.equal(nx(probe(probe(write(s0(),'w53-resale',MIXED,0),'form',1),'distinguish',2),3).scene,'method');
});

test('방법 뒤에는 새 자료가 아니라 같은 글을 고쳐 쓰고(반복 — 독립 아님), 맞으면 그 자리에서 새 자료로 혼자 확인', ()=>{
 let st=method(probe(write(s0(),'w53-resale',MIXED,0),'form',1),'forms',2);
 const r=nx(st,3);assert.deepEqual([r.scene,r.mode,r.itemId,r.support],['write','revise','w53-resale',2]);
 st=write(st,'w53-resale',GOOD,4,{support:2,mode:'revise'});
 const e=evidence(st,{now:ms(5)});assert.equal(e.lastWrite.verdict,'correct');assert.equal(e.lastWrite.indep,false);assert.equal(e.alone.length,0);
 const c=nx(st,5);assert.deepEqual([c.scene,c.mode,c.support,c.why],['write','new',0,'check-now']);assert.notEqual(c.itemId,'w53-resale');
 // 적용 방법 뒤에는 L1(끝 다시 읽기)
 assert.equal(nx(method(probe(write(s0(),'w53-resale',MIXED,0),'form',1),'apply',2),3).support,1);
});

test('방법 뒤 실패 1번 → 도움 한 단 올림, 2번 → 재료가 있는 안 쓴 방법, 셋 다 → 오늘은 쉼, 다른 날 → 새 자료로 다시 시작', ()=>{
 let st=method(probe(write(s0(),'w53-resale',MIXED,0),'form',1),'apply',2);
 st=write(st,'w53-resale',MIXED,3,{support:1,mode:'revise'});
 assert.deepEqual([nx(st,4).mode,nx(st,4).support,nx(st,4).why],['revise',2,'retry-more-help']);
 st=write(st,'w53-resale',MIXED,5,{support:2,mode:'revise'});
 assert.equal(nx(st,6).method,'forms');
 // 형태 연습 재료가 없으면 건너뛰고 구별로(가용성 확인)
 assert.equal(next(st,{...bank,forms:bank.forms.filter(f=>f.use==='check')},{now:ms(6)}).method,'contrast');
 st=write(write(method(st,'forms',7),'w53-resale',MIXED,8,{support:2,mode:'revise'}),'w53-resale',MIXED,9,{support:2,mode:'revise'});
 st=write(write(method(st,'contrast',10),'w53-resale',MIXED,11,{support:2,mode:'revise'}),'w53-resale',MIXED,12,{support:2,mode:'revise'});
 assert.equal(nx(st,13).why,'tried-all');
 const again=nx(st,DAY+13);assert.deepEqual([again.scene,again.mode,again.why],['write','new','restart']);
});

test('같은 시각의 기록도 기록한 차례로 앞뒤를 가린다(after)', ()=>{
 let st=write(s0(),'w53-resale',MIXED,0);st=method(st,'forms',1);st=write(st,'w53-resale',MIXED,1,{support:2,mode:'revise'});
 // 방법과 고쳐 쓰기가 같은 분 — 실패 1번으로 세어 도움을 올린다(예전에는 방법 앞의 쓰기까지 셌다)
 const n=nx(st,2);assert.equal(n.why,'retry-more-help');
});

test('혼자 성공 1번 → 쉼, 하루 뒤 다른 자료, 두 번(하루 간격) → 끝, 7일 뒤 새 자료로 지연 확인', ()=>{
 let st=write(s0(),'w53-exchange',GOOD,0);
 assert.equal(nx(st,1).why,'alone-once');
 const n=nx(st,DAY+1);assert.deepEqual([n.scene,n.support,n.why],['write',0,'recheck']);assert.notEqual(n.itemId,'w53-exchange');
 st=write(st,n.itemId,GOOD,DAY+5);
 assert.equal(nx(st,DAY+6).why,'done');assert.equal(nx(st,5*DAY).why,'done');
 const d=nx(st,DAY*8+6);assert.deepEqual([d.scene,d.why],['write','delayed']);
 // 지연 확인이 틀리면 끝이 아니다(마지막 독립 시도가 틀림)
 const failed=write(st,d.itemId,MIXED,DAY*8+7);assert.equal(evidence(failed,{now:ms(DAY*8+8)}).done,false);assert.notEqual(nx(failed,DAY*8+8).why,'done');
});

test('설명 직후 같은 날 성공만으로는 끝이 아니다', ()=>{
 let st=write(s0(),'w53-resale',MIXED,0);
 st=write(method(st,'forms',1),'w53-resale',GOOD,2,{support:2,mode:'revise'});
 st=write(st,'w53-study-ways',GOOD,3);                 // 그 자리 새 자료 L0 — 독립이지만 방법 직후
 st=write(st,'w53-exchange',GOOD,DAY+3-1);            // 다음 날이 아니다(하루가 안 됨)
 assert.equal(evidence(st,{now:ms(DAY+3)}).done,false);
 st=write(st,'w53-living-cost',GOOD,DAY+10);
 assert.equal(evidence(st,{now:ms(DAY+11)}).done,true);
});

test('늦은 재방문: 끝난 학생이 30일 뒤 와도 처음부터가 아니라 지연 확인, 맞으면 끝이 이어진다(Fable P2-6)', ()=>{
 let st=write(write(s0(),'w53-exchange',GOOD,0),'w53-resale',GOOD,DAY+1);
 const n=nx(st,DAY*31);assert.equal(n.why,'delayed');
 st=write(st,n.itemId,GOOD,DAY*31+1);assert.equal(nx(st,DAY*31+2).why,'done');
 // 끝나지 않은 학생의 15일 뒤는 다시 본다
 assert.equal(nx(write(s0(),'w53-resale',MIXED,0),15*DAY).why,'stale');
});

test('처음 보는 자료가 없으면 거짓 끝 없이 「자료 없음」, 끝난 학생은 끝 그대로', ()=>{
 let st=s0();[...bank.open53,...bank.open54].forEach((it,i)=>{st=markSeen(st,[it.id],{now:ms(i)});});
 st=write(st,'w53-resale',MIXED,20,{support:2,mode:'revise'});st=addObs(st,{kind:'probe',probe:'form'},{now:ms(21)});st=addObs(st,{kind:'probe',probe:'distinguish'},{now:ms(21)});
 st=write(method(st,'forms',22),'w53-resale',GOOD,23,{support:2,mode:'revise'});
 assert.equal(nx(st,24).why,'no-items');
});

test('끝난 학생도 확인할 새 자료가 없으면 「며칠 뒤 확인」을 약속하지 않는다 · 지연 확인이 틀리면 그 앞 성공으로 끝을 되살리지 않는다', ()=>{
 let st=write(write(s0(),'w53-exchange',GOOD,0),'w53-resale',GOOD,DAY+1);
 const used=[...bank.open53,...bank.open54].reduce((x,it)=>markSeen(x,[it.id],{now:ms(DAY+2)}),st);
 assert.equal(evidence(used,{now:ms(DAY*9)}).done,true);assert.equal(nx(used,DAY*9).why,'no-items');
 st=write(st,'w53-study-ways',MIXED,DAY*9);st=write(method(st,'forms',DAY*9+1),'w53-living-cost',GOOD,DAY*9+2);
 assert.equal(evidence(st,{now:ms(DAY*9+3)}).done,false);
 st=write(st,'w53-clinic',GOOD,DAY*10+3);assert.equal(evidence(st,{now:ms(DAY*10+4)}).done,true);
});

test('끝 꼴 판정 범위: 목록 밖 틀린 꼴·정상 형용사·오타·확인 못 함(루트 R1 · Fable 설계 P1-1)', ()=>{
 const v=s=>endCheck(s).v;
 for(const s of ['이용률이 높아지다.','비용이 비싸는다.','변화가 빠르는다.','이용자가 증가했는다.','사람이 많은다.','사람이 없는다.','이용자가 예상되다.','새 제도가 필요한다.','학생들이 많는다.','이용자가 늘었습니다.'])assert.equal(v(s),'wrong',s);
 for(const s of ['교육은 중요하다.','이 방법은 간단하다.','이용자가 증가했다.','이용자가 늘어난다.','이유는 두 가지이다.','책이 없다.','먹는다.'])assert.equal(v(s),'ok',s);
 for(const s of ['이용자가 급증하다.','이용자가 증가했따.','높아진다?','결과가 나타났음.','집에 있는다.','비용을 줄이다.'])assert.equal(v(s),'unknown',s);
});

test('쓰기 근거: KC·과제·미확인 분리 — 오타 한 문장은 그 문장만, 무관한 글·숫자만 박은 글은 근거 아님, 과제는 언제나 미판정', ()=>{
 const resale=bank.open53.find(i=>i.id==='w53-resale');
 const typo=observeWrite('중고 거래 앱 이용자가 늘었다. 2020년에는 300만 명이었다. 2024년에는 1,200만 명으로 증가했따. 이유는 두 가지이다.',resale);
 assert.deepEqual([typo.verdict,typo.unknown.length,typo.task],['correct',1,'unassessed']);
 const unrelated=observeWrite('나는 사과를 좋아한다. 오늘은 비가 온다. 고양이가 귀엽다.',resale);assert.deepEqual([unrelated.linked,unrelated.verdict],[false,'unassessed']);
 const numbers=observeWrite('나는 300만 번 사과를 좋아한다. 오늘은 780만 번 비가 온다. 고양이는 1200만 번 귀엽다.',resale);assert.deepEqual([numbers.linked,numbers.verdict],[false,'unassessed']);
 assert.equal(observeWrite('이용자가 급증하다. 비율이 폭증하다. 수가 격감하다.').verdict,'unassessed');
 assert.equal(observeWrite('교육은 중요하다. 새 제도가 필요하다. 이 방법은 간단하다.').verdict,'correct');
 assert.equal(observeWrite(MIXED).verdict,'incorrect');assert.equal(linkedTo(resale,MIXED),true);
 // 판정 안 함: 세 문장 미만·반복·빈 글
 assert.equal(observeWrite(''),null);assert.equal(observeWrite('이용자가 늘었다. 이유는 두 가지이다.'),null);assert.equal(observeWrite('다. 다. 다. 다.'),null);
});

test('54번 지문을 옮겨 쓴 문장은 학생의 끝이 아니다(Fable 설계 P1-4)', ()=>{
 const it=bank.open54[0];const [a,b]=it.prompt.split(/(?<=다\.)\s*/);
 const o=observeWrite(`${a} ${b} 나는 외국어 공부가 중요하다.`,it);
 assert.equal(o.verdict,'unassessed');assert.ok(o.errorTags.includes('input.copied'));
});

test('붙여 넣은 글: 점검·다음 장면은 그대로, 끝맺음 근거에서만 빠진다(루트 설계 검토 1)', ()=>{
 const st=write(s0(),'w53-exchange',GOOD,0,{pasted:true});
 const e=evidence(st,{now:ms(1)});assert.equal(e.lastWrite.indep,false);assert.equal(e.alone.length,0);assert.equal([...trailRows(st,ms(1)).values()][0].verdict,'unassessed');
 assert.ok(['probe','write','rest'].includes(nx(st,1).scene));
});

test('미확인만 쓰는 학생: 같은 자리에서 새 자료를 더 쓰지 않고 형태 확인·고쳐 쓰기, 거짓 성공 없음', ()=>{
 const U='이용자가 급증하다. 비율이 폭증하다. 수가 격감하다.';
 let st=write(s0(),'w53-resale',U,0);
 const p=nx(st,1);assert.deepEqual([p.scene,p.probe,p.why],['probe','form','unassessed']);
 st=probe(forms(st,checksOf(2).map(id=>[id,true]),2),'form',4);
 const r=nx(st,5);assert.deepEqual([r.mode,r.why],['revise','unassessed']);
 st=write(st,'w53-resale',U,6,{support:1,mode:'revise'});
 assert.equal(nx(st,7).why,'later');assert.equal(evidence(st,{now:ms(7)}).alone.length,0);
 assert.equal(nx(st,DAY).why,'again');
});

test('재노출: 연습에서 본 카드가 확인으로 와도 Trail이 반복으로 빼고, 확인 카드는 고정 몫에서 한 번씩만', ()=>{
 let st=write(s0(),'w53-resale',ALL_OFF,0);
 st=sorts(st,[false,false,false],1,{learn:true,cards:checkCards});        // 확인 몫 카드를 연습으로 먼저 봄(옛 오염 상황)
 st=sorts(st,[false,false,false],5,{cards:checkCards});                     // 같은 카드가 확인으로
 assert.equal(evidence(st,{now:ms(9)}).distinguish,null);
 const n=nx(write(s0(),'w53-resale',ALL_OFF,0),1);assert.ok(n.cards.every(k=>checkCard({key:k})));
 const seen=markSeen(write(s0(),'w53-resale',ALL_OFF,0),checkCards.map(c=>`card:${c.key}`),{now:ms(0)});
 assert.notEqual(nx(seen,1).probe,'distinguish');
});

test('형태 채점: 인정 범위·띄어쓰기는 맞음, 다른 꼴은 틀림, 알아볼 수 없는 꼴은 확인 못 함(오타는 흔들림이 아님)', ()=>{
 const f=id=>bank.forms.find(x=>x.id===id);
 assert.equal(gradeForm(f('s53-f-adj-c1'),'많다'),true);assert.equal(gradeForm(f('s53-f-adj-c1'),'많는다'),false);
 assert.equal(gradeForm(f('s53-f-verb-c1'),'공부하다'),false);assert.equal(gradeForm(f('s53-f-verb-c1'),' 공부한다. '),true);assert.equal(gradeForm(f('s53-f-verb-c1'),'공부 한다'),true);
 assert.equal(gradeForm(f('s53-f-verb-c1'),'공부한댜'),'typo');assert.equal(gradeForm(f('s53-f-verb-c1'),'공부했다'),false);assert.equal(gradeForm(f('s53-f-noun-c1'),''),null);
 const st=probe(forms(write(s0(),'w53-resale',MIXED,0),[[checksOf(1)[0],'typo']],1),'form',2);
 assert.equal(evidence(st,{now:ms(3)}).form,null);
 assert.equal(gradeFind(bank.finds[1],[3,1]),true);assert.equal(gradeFind(bank.finds[1],[1]),false);
});

test('원장: 시계가 뒤로 가도·깨진 묶음이 있어도 next()가 던지지 않고, 깨진 묶음만 버린다(Fable 설계 P1-2)', ()=>{
 let st=write(s0(),'w53-exchange',GOOD,100);
 st=write(st,'w53-resale',GOOD,50);                     // 시계가 뒤로
 assert.doesNotThrow(()=>nx(st,200));assert.equal(trailRows(st,ms(200)).size,2);
 const broken={...st,trail:[...st.trail,{schema:1,id:'p999',type:'practice.attempted',scope:st.trail[0].scope,at:new Date(ms(150)).toISOString(),recordedAt:new Date(ms(150)).toISOString(),presentationId:'zz',attemptNo:1,verdict:'correct',errorTags:[]}]};
 const read=readState(JSON.parse(JSON.stringify(broken)),{now:ms(200)});
 assert.equal(read.trail.length,st.trail.length-3,'깨진 사건이 든 묶음만 버림');assert.equal(trailRows(read,ms(200)).size,1);assert.doesNotThrow(()=>nx(read,200));
 // 사건이 없는 쓰기 관측(잘린 원장)은 근거가 아니다
 const noTrail={...st,trail:[]};assert.equal(evidence(noTrail,{now:ms(200)}).alone.length,0);
 // 미래 시각 기록은 지우지 않고 근거에서만 뺀다
 assert.equal(readState(JSON.parse(JSON.stringify(st)),{now:ms(60)}).obs.length,st.obs.length);
});

test('원장 자르기는 쓰기 묶음보다 카드·형태 묶음을 먼저 던다', ()=>{
 let st=write(write(s0(),'w53-exchange',GOOD,0),'w53-resale',GOOD,DAY+1);
 for(let i=0;i<Math.ceil(TRAIL_MAX/5);i++)st=sorts(st,[true,true],DAY+10+i); // 확인 카드(도움 아님)로 원장만 채운다
 assert.ok(st.trail.length<=TRAIL_MAX);assert.equal(evidence(st,{now:ms(DAY*2)}).done,true);
});

test('저장 판 바꾸기: v1 → v2 옮겨도 기록을 잃지 않고 옛 성공을 새 독립 성공으로 올리지 않는다(루트 설계 검토 2·3)', ()=>{
 const v1={v:1,obs:[
  {at:new Date(ms(0)).toISOString(),kind:'write',itemId:'w53-resale',support:0,same:false,plain:2,off:2,total:4,formal:2,polite:0,flags:0},
  {at:new Date(ms(DAY)).toISOString(),kind:'write',itemId:'w53-exchange',support:0,same:false,plain:4,off:0,total:4,formal:0,polite:0,flags:0},
  {at:new Date(ms(DAY+1)).toISOString(),kind:'sort',card:learnCards[0].key,bin:learnCards[0].bin,ok:true,use:'learn'},
  {at:new Date(ms(DAY+2)).toISOString(),kind:'method',method:'contrast'}],
  drafts:{'w53-exchange':{text:GOOD,updatedAt:new Date(ms(DAY)).toISOString(),checkedAt:new Date(ms(DAY)).toISOString()}},seen:{'w53-exchange':new Date(ms(DAY)).toISOString()},recentCards:[checkCards[0].key]};
 const st=migrate(v1,{now:ms(DAY+3),pool:bank.pool});
 assert.equal(st.v,2);assert.equal(st.obs.length,4);assert.equal(st.drafts['w53-exchange'].text,GOOD);
 const e=evidence(st,{now:ms(DAY+3)});
 assert.deepEqual(e.writesAll.map(w=>w.verdict),['incorrect','unassessed']);assert.equal(e.alone.length,0);
 assert.equal(e.writesAll[0].indep,true,'옛 「-습니다」는 실제로 본 틀린 끝');
 assert.ok(st.seen[`card:${checkCards[0].key}`]&&st.seen[`card:${learnCards[0].key}`]);
 assert.equal(st.seen['w53-exchange'],v1.seen['w53-exchange'],'처음 본 시각을 지키다');
 assert.deepEqual(readState(v1).obs,[],'readState는 v1을 v2로 읽지 않는다(옮기기는 migrate만)');
 assert.equal(storeKey('guest'),'synk.study.v2:guest');assert.equal(legacyKey('guest'),'synk.study.v1:guest');assert.equal(storeKey('../x'),'synk.study.v2:guest');
});

test('기록 읽기: 모르는 종류·깨진 값은 버리고, 학생 글 원문은 관측에 없다', ()=>{
 const st=readState({v:2,obs:[{kind:'write',itemId:'w53-resale',support:0,plain:1,off:2,total:3,formal:2,polite:0,at:new Date(ms(0)).toISOString(),offSentences:['비밀']},{kind:'hack',at:new Date(ms(1)).toISOString()},{kind:'sort',at:new Date(ms(2)).toISOString(),card:'x:1',bin:'nope',ok:true},null,'x'],drafts:{'w53-resale':{text:'글',updatedAt:new Date(ms(0)).toISOString()},'../x':{text:'a'}}},{now:ms(1)});
 assert.equal(st.obs.length,1);assert.equal(JSON.stringify(st.obs).includes('비밀'),false);assert.deepEqual(Object.keys(st.drafts),['w53-resale']);
});

test('독립 판정의 출처는 Trail 하나 — 같은 자료 두 번째 시도·도움 뒤·설명 뒤 연습은 독립이 아니다', ()=>{
 let st=write(s0(),'w53-exchange',GOOD,0);
 st=write(st,'w53-exchange',GOOD,1);
 st=write(st,'w53-resale',GOOD,2,{support:2});
 const rows=[...trailRows(st,ms(3)).values()].filter(r=>r.conceptIds[0]===KC);
 assert.deepEqual(rows.map(r=>[r.exposure,r.assisted,r.independent]),[['new',false,true],['repeat',null,false],['new',true,false]]);
});

// ── 30일 재생(persona). 학생 행동만 정하고 장면은 튜터가 정한다.
const words=it=>((it.label||'')+' '+JSON.stringify(it.data||it.prompt||'')).match(/[가-힣]{2,}/g).slice(0,3);
const say=(it,end)=>{const w=words(it);return `${w[0]} 자료를 보면 ${w[1]}이 크게 ${end[0]}. ${w[2]||w[1]}도 ${end[1]}. 그 이유는 두 가지이다.`;};
function replay(policy,days=30){
 let st=s0();const log=[];const all=[...bank.open53,...bank.open54];
 for(let day=0;day<days;day++)for(let step=0;step<12;step++){
  const t=day*DAY+step,n=next(st,bank,{now:ms(t)});const d=recordDecision(st,{scene:n.scene,why:n.why},{now:ms(t)});st=d.state;log.push({day,...n});
  if(n.scene==='rest')break;
  if(n.scene==='write'){if(n.why==='restart')st=addObs(st,{kind:'cycle'},{now:ms(t)});const it=all.find(i=>i.id===n.itemId);st=recordWrite(st,{did:d.did,item:it,text:policy.write(it,n,day),support:n.support,mode:n.mode},{now:ms(t)}).state;}
  if(n.scene==='probe'){if(n.forms)for(const id of n.forms)st=recordForm(st,{did:d.did,form:bank.forms.find(f=>f.id===id),grade:policy.form},{now:ms(t)}).state;else for(const k of n.cards){const c=bank.pool.find(x=>x.key===k);st=recordSort(st,{did:d.did,card:c,pick:policy.sort(c)},{now:ms(t)}).state;}st=addObs(st,{kind:'probe',probe:n.probe},{now:ms(t)});}
  if(n.scene==='method'){for(const k of n.cards||[]){const c=bank.pool.find(x=>x.key===k);st=recordSort(st,{did:d.did,card:c,pick:c.bin,learn:true},{now:ms(t)}).state;}for(const id of n.forms||[])st=recordForm(st,{did:d.did,form:bank.forms.find(f=>f.id===id),grade:true},{now:ms(t)}).state;st=addObs(st,{kind:'method',method:n.method},{now:ms(t)});}
 }
 return {log,st};
}
const RIGHT=['늘었다','증가했다'],WRONG=['늘었습니다','증가했습니다'];
const perDay=log=>Object.values(log.reduce((m,x)=>{if(x.scene==='write')(m[x.day]??=[]).push(x);return m;},{}));
test('재생: 잘 아는 학생은 이틀 만에 끝, 그 뒤 7·14일 간격 지연 확인만', ()=>{
 const {log}=replay({write:it=>say(it,RIGHT),form:true,sort:c=>c.bin});
 const writes=log.filter(x=>x.scene==='write');
 assert.deepEqual(writes.map(x=>[x.day,x.why]),[[0,'start'],[1,'recheck'],[8,'delayed'],[22,'delayed']]);
 assert.ok(!log.some(x=>x.scene==='probe'||x.scene==='method'));
});
test('재생: 구별이 흔들리는 학생은 구별 연습, 형태가 틀리는 학생은 형태 연습으로 시작한다', ()=>{
 const d=replay({write:(it,n,day)=>n.mode==='revise'||day>=3?say(it,RIGHT):say(it,WRONG),form:true,sort:c=>c.bin==='plain'?'formal':'plain'},6).log;
 assert.equal(d.find(x=>x.scene==='method').method,'contrast');
 const f=replay({write:(it,n,day)=>n.mode==='revise'||day>=3?say(it,RIGHT):say(it,WRONG),form:false,sort:c=>c.bin},6).log;
 assert.equal(f.find(x=>x.scene==='method').method,'forms');
});
test('재생: 계속 틀리는 학생도 하루 쓰기 셋·새 자료 둘을 넘지 않고, 30일 동안 같은 쉼에 갇히지 않으며 거짓 끝이 없다', ()=>{
 const {log,st}=replay({write:it=>say(it,WRONG),form:false,sort:()=>'formal'});
 for(const day of perDay(log)){assert.ok(day.length<=3);assert.ok(day.filter(x=>x.mode==='new').length<=2);}
 assert.ok(!log.some(x=>x.why==='done'));assert.equal(evidence(st,{now:ms(30*DAY)}).alone.length,0);
 const triedAllDays=new Set(log.filter(x=>x.why==='tried-all').map(x=>x.day));assert.ok(triedAllDays.size<=3);
});

test('섞인 끝의 축 짐작은 과거·명사만 가르고 나머지는 둘 다', ()=>{
 assert.deepEqual(offAxes(['늘었습니다.','두 가지입니다.','많아요.']),['verb','adj','noun','past']);
 assert.deepEqual(offAxes(['300만 명이었습니다.']),['past']);
});

test('빌드: 학생에게 가는 문항은 검수 통과분만, 예시답 없음(54는 주제·질문만)', ()=>{
 const b=studyBank(world);assert.ok(b.items.every(i=>i.review.status==='passed'&&!('model' in i)&&!('blanks' in i)&&!('points_to_cover' in i)));
 assert.deepEqual([...new Set(b.items.map(i=>i.type))].sort(),[51,52,53,54]);
 assert.ok(b.items.filter(i=>i.type===54).every(i=>typeof i.prompt==='string'&&Array.isArray(i.questions)));
 const draft={...content,items:content.items.map((i,n)=>({...i,review:{status:n===0?'passed':n===1?'held':'draft'}}))};
 assert.deepEqual(studyContent(draft).items.map(i=>i.id),[content.items[0].id]);
});

test('Fable F1·F2: 기기 언어로 첫 화면 언어, 「적는다」·「가늘다」는 틀린 꼴로 잡지 않음', async()=>{
 const {chooseLang}=await import('../src/copy.mjs');
 const none={getItem:()=>null};
 assert.equal(chooseLang({search:'',storage:none,languages:['mn-MN']}),'mn');assert.equal(chooseLang({search:'',storage:none,languages:['mn-Mong-CN']}),'ko');
 assert.equal(chooseLang({search:'',storage:none,languages:['en-GB']}),'en');assert.equal(chooseLang({search:'?lang=ko',storage:none,languages:['mn']}),'ko');
 assert.equal(chooseLang({search:'',storage:{getItem:()=>'en'},languages:['mn']}),'en');
 assert.equal(checkChange('조사 결과를 표에 적는다.').ok,true);assert.notEqual(checkChange('선이 가늘다.').ok,false);
 assert.equal(checkChange('이용자가 늘다.').why,'dict');assert.equal(checkChange('비율이 높는다.').why,'adj-neun');assert.equal(checkChange('이용자가 급증하다.').ok,null);
});

test('아르곤 s1 B1·B3: 끝난 뒤 새 도움을 받으면 하루 뒤 성공으로 다시 확인, 미판정 지연 확인 뒤 새 자료를 바로 또 내지 않음', ()=>{
 let st=write(write(s0(),'w53-exchange',GOOD,0),'w53-resale',GOOD,DAY+1);
 const U='이용자가 급증하다. 비율이 폭증하다. 수가 격감하다.';
 st=write(st,'w53-study-ways',U,DAY*9);                       // 지연 확인이 미판정
 assert.equal(evidence(st,{now:ms(DAY*9+1)}).done,true);assert.equal(nx(st,DAY*9+1).why,'done','바로 또 새 자료를 내지 않음');
 st=write(st,'w53-study-ways',GOOD,DAY*9+2,{support:1,mode:'revise'}); // 끝난 뒤 도움
 assert.equal(evidence(st,{now:ms(DAY*9+3)}).done,false);
 st=write(st,'w53-living-cost',GOOD,DAY*10+3);assert.equal(evidence(st,{now:ms(DAY*10+4)}).done,false,'도움 뒤 성공 하나뿐(아르곤 s4 B1)');
 st=write(st,'w53-clinic',GOOD,DAY*11+4);assert.equal(evidence(st,{now:ms(DAY*11+5)}).done,true);
});
test('아르곤 s1 B2·B5: 방법 뒤 확인 못 한 고쳐 쓰기도 진전 없음으로 세고, 붙여 넣은 「-습니다」 글도 원인 확인으로 간다', ()=>{
 const U='이용자가 급증하다. 비율이 폭증하다. 수가 격감하다.';
 let st=method(probe(write(s0(),'w53-resale',MIXED,0),'form',1),'apply',2);
 st=write(write(st,'w53-resale',U,3,{support:1,mode:'revise'}),'w53-resale',U,4,{support:2,mode:'revise'});
 assert.equal(nx(st,5).scene,'method');
 const p=write(s0(),'w53-resale',ALL_OFF,0,{pasted:true});
 assert.equal(nx(p,1).probe,'distinguish');assert.equal(evidence(p,{now:ms(1)}).lastWrite.indep,false);
});
test('아르곤 s1 B4: 옛 D1 소개 예시 카드가 뒤에 확인으로 나왔어도 이관 뒤 첫 노출로 세지 않음', ()=>{
 const ex=bank.pool.find(c=>c.bin==='formal');
 const v1={v:1,obs:[{at:new Date(ms(0)).toISOString(),kind:'method',method:'contrast'},{at:new Date(ms(1)).toISOString(),kind:'sort',card:ex.key,bin:ex.bin,ok:true,use:'check'}],drafts:{},seen:{},recentCards:[]};
 const st=migrate(v1,{now:ms(2),pool:bank.pool});
 assert.equal([...trailRows(st,ms(2)).values()][0].independent,false);
});

test('Fable 최종 F1: 오늘 글이 확인 못 함이면 다른 날 이미 고친 글이 아니라 오늘 글을 고쳐 쓴다', ()=>{
 const U='이용자가 급증하다. 비율이 폭증하다. 수가 격감하다.';
 let st=method(probe(write(s0(),'w53-resale',MIXED,0),'form',1),'apply',2);
 st=write(st,'w53-resale',GOOD,3,{support:1,mode:'revise'});st=write(st,'w53-study-ways',GOOD,4);
 st=write(st,'w53-exchange',U,DAY+10);st=probe(forms(st,checksOf(2).map(id=>[id,true]),DAY+11),'form',DAY+13);
 const n=nx(st,DAY+14);assert.deepEqual([n.mode,n.itemId],['revise','w53-exchange']);
});

test('아르곤 s4 B1·B2·B3·B5: 도움 앞 성공을 합치지 않음 · 과제와만 안 이어진 글은 끝 꼴 연습 없음 · 붙여 넣은 바른 글로 고쳐 쓰기 통과 없음 · 「-는다」 활용 안내', ()=>{
 const U='이용자가 급증하다. 비율이 폭증하다. 수가 격감하다.';
 let st=write(s0(),'w53-exchange',GOOD,0);
 st=write(st,'w53-resale',U,DAY);st=write(method(st,'forms',DAY+1),'w53-resale',GOOD,DAY+2,{support:2,mode:'revise'});
 st=write(st,'w53-study-ways',GOOD,2*DAY+3);assert.equal(evidence(st,{now:ms(2*DAY+4)}).done,false);
 const resale=bank.open53.find(i=>i.id==='w53-resale');
 const d=scene(s0(),0,{scene:'write'}),un=recordWrite(d.state,{did:d.did,item:resale,itemId:'w53-resale',text:'나는 사과를 좋아한다. 오늘은 비가 온다. 친구가 학교에 간다.'},{now:ms(0)}).state;
 assert.equal(nx(un,1).why,'later');assert.equal(nx(un,DAY).why,'again');
 let p=method(probe(write(s0(),'w53-resale',MIXED,0),'form',1),'apply',2);
 p=write(p,'w53-resale',GOOD,3,{support:1,mode:'revise',pasted:true});
 assert.notEqual(nx(p,4).why,'check-now');
 assert.deepEqual([checkChange('이용자가 증가했는다.').why,checkChange('이것을 만들는다.').why,checkChange('사람이 많는다.').why],['neun','neun','adj-neun']);
});

test('아르곤 s4 C1: 방법 장면의 연습 답만 하고 떠났어도 도움으로 세어 그 앞 성공을 합치지 않는다', ()=>{
 let st=write(s0(),'w53-exchange',GOOD,0);
 st=sorts(st,[true,true],DAY,{learn:true});
 st=write(st,'w53-resale',GOOD,DAY+5);
 assert.equal(evidence(st,{now:ms(DAY+6)}).done,false);
});
