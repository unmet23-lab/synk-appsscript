import test from 'node:test';
import assert from 'node:assert/strict';
import {lessonById} from '../life-content.mjs';
import {storyLineMarkup,createStoryDetail} from '../life-story.mjs';

test('delay transfer review explains the expected delay while preserving the ten-minute answer and stored question keys',()=>{
 const q=lessonById('plans-apply').questions.find(q=>q.id==='plans-apply-delay'),r=q.review;
 assert.equal(q.answerId,'b');assert.equal(r.id,'plans-apply-delay-transfer');assert.equal(r.skillId,'plans-delay-message');assert.equal(r.expressionId,'plans-delay');assert.equal(r.answerId,'a');
 assert.equal(r.context,'길이 막혀 약속 시간보다 십 분 늦게 도착할 것 같아요.');assert.deepEqual(r.choices,[{id:'a',text:'십 분 늦을 것 같아요.'},{id:'b',text:'십 분 일찍 왔어요.'},{id:'c',text:'지금 도착했어요.'}]);
 assert.doesNotMatch(r.explanation,/늦을 예상 시간/);assert.match(r.explanation,/늦/);assert.match(r.explanation,/기다리는 데 도움/);
});

test('interactive story highlights expose button semantics and keep click, Enter and Space activation; plain highlights stay plain',()=>{
 const expressions=[{korean:'포장해 주세요.'}],html=storyLineMarkup('직원이 ‘포장해 주세요’라고 들었어요.',expressions),tag=html.match(/<mark[^>]+>/)?.[0];
 assert.match(tag,/data-life-mark="0"/);assert.match(tag,/role="button"/);assert.match(tag,/tabindex="0"/);assert.match(tag,/aria-label="포장해 주세요 · 표현 도움 보기"/);
 assert.equal(storyLineMarkup('안내판에 ‘공원’이 있어요.',expressions),'안내판에 ‘<mark class="life-say">공원</mark>’이 있어요.');
 const previous={Element:globalThis.Element,document:globalThis.document},contentListeners={},documentListeners={},activated=[];
 class ElementPort{constructor(){this.dataset={lifeMark:'0'};}closest(selector){return selector==='mark[data-life-mark]'?this:null;}}
 globalThis.Element=ElementPort;globalThis.document={addEventListener:(type,fn)=>documentListeners[type]=fn,removeEventListener:type=>delete documentListeners[type]};
 const content={querySelector:()=>null,addEventListener:(type,fn)=>contentListeners[type]=fn,removeEventListener:type=>delete contentListeners[type]};
 const detail=createStoryDetail({content,isActive:()=>true,onNext(){throw Error('unexpected next');},onPrev(){throw Error('unexpected prev');},onMark:index=>activated.push(index),reduced:()=>true});
 try{for(const key of [null,'Enter',' ']){let prevented=false;const e={target:new ElementPort(),key,preventDefault(){prevented=true;}};(key?documentListeners.keydown:contentListeners.click)(e);assert.equal(prevented,true);}assert.deepEqual(activated,[0,0,0]);}
 finally{detail.dispose();for(const [key,value]of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
