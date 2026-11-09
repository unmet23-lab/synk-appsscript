// 다국어 판 2 마무리(2026-11-09) — 직원 화면 영어 칸(내부 도구, 기획 12-2 「담당자 글」).
// 직원 상태 project.translation이 있을 때(영어 프로젝트)만 보내는 창마다 손님 언어 칸이 생기고, 데스크에 「손님에게 보일 영어」 목록이 생긴다.
// 한국어 프로젝트의 직원 화면에는 칸도 표시도 없다(바이트 대조는 판 2 마무리 때 HEAD와 나란히 그려 했다 — 기획 12-7).
import test from 'node:test';
import assert from 'node:assert/strict';
import {dialogContent,projectView} from './public/pulse-app/views.mjs';
import {deskView} from './public/pulse-app/desk-view.mjs';

globalThis.location=new URL('http://localhost/pulse-app/');
const tr={locale:'en',entries:{
  'scene:s1:title':{source:'캔을 딴다',max:320,text:'Open the can',status:'reviewed',fresh:true},
  'scene:s1:description':{source:'큰 소리',max:6000,text:'A loud pop',status:'reviewed',fresh:false},
  'project:title':{source:'탄산수 15초 광고',max:320,text:'',status:'',fresh:false},
  'option:o1:name':{source:'톡',max:80,text:'Pop',status:'reviewed',fresh:true},
  'option:o1:flow:0':{source:'캔을 딴다',max:400,text:'Opens the can',status:'reviewed',fresh:true},
  'message:m9:text':{source:'두 의견 모두 반영했어요.',max:6000,text:'Both changes are in.',status:'draft',fresh:true}}};
const ENGLISH=/name="[a-zA-Z]+Tr\d?"|data-tr-|tr-box|tr-note/;
const DIALOGS=[['desk-ask',{suggested:'병 색'}],['desk-propose',{kind:'food',modelId:''}],['desk-direction',{round:1,modelId:'',price:390000,dueDate:'2026-11-20',revisions:3,noModel:true,models:[],assets:[]}],['desk-send',{count:2,kind:'script',oneLine:'한 캔에 맛이 다섯 번'}]];

test('직원 대화상자: 영어 프로젝트에서만 손님 언어 칸이 생긴다',()=>{
  for(const [type,item]of DIALOGS){
    assert.doesNotMatch(dialogContent(type,item),ENGLISH,type+' — 한국어 프로젝트에는 칸이 없다');
    const html=dialogContent(type,{...item,tr});
    assert.match(html,/영어 프로젝트예요/,type);
    assert.match(html,{'desk-ask':/name="itemsTr"/,'desk-propose':/name="noteTr"/,'desk-direction':/name="leadTr"[\s\S]*name="nameTr0"[\s\S]*name="flowTr0"[\s\S]*name="nameTr1"/,'desk-send':/name="oneLineTr"[\s\S]*name="noteTr"/}[type],type);
    assert.match(html,/lang="en"/,type+' — 영어 칸은 lang=en');
  }
  // 방향 고쳐 보내기: 옛 안의 영어를 같은 줄에 채우고, 흐름 줄은 시각과 함께, 원문이 바뀐 줄이 있으면 표시한다.
  const option={id:'o1',name:'톡',sentence:'한 문장',flow:[{at:'0:00',text:'캔을 딴다'},{at:'0:03',text:'마신다'}],why:''};
  const edit=dialogContent('desk-direction',{lead:'두 안',options:[option],round:1,modelId:'',price:390000,dueDate:'2026-11-20',revisions:2,noModel:true,models:[],assets:[],tr});
  assert.match(edit,/name="nameTr0"[^>]*value="Pop"/);
  assert.match(edit,/<textarea name="flowTr0"[^>]*>0:00 Opens the can\n0:03<\/textarea>/);
  // 1차안 보내기: 확인한 영어가 없거나 낡은 장면 칸은 그 자리에서 채운다(보낼 때 그 칸부터 저장).
  const send=dialogContent('desk-send',{count:2,kind:'script',oneLine:'',tr,trMissing:[{key:'scene:s1:description',label:'장면 1 설명',source:'큰 소리',text:'A loud pop',max:6000}]});
  assert.match(send,/data-tr-key="scene:s1:description"[^>]*data-tr-label="장면 1 설명"[^>]*maxlength="6000"[^>]*required>A loud pop<\/textarea>/);
  assert.match(dialogContent('desk-send',{count:0,tr}),/아직 보낼 장면이 없어요/);
});

const media=name=>({url:`http://localhost/pulse-app/${name}`,mimeType:name.endsWith('.mp4')?'video/mp4':'image/png'});
const project=translation=>({id:'p',revision:7,title:'탄산수 15초 광고',customerName:'합성',ownerName:'김하늘',stage:'review',...(translation?{translation}:{}),
  versions:[{id:'v1',kind:'preview',label:'시안 v1',media:media('v1.mp4')}],messages:[],
  studio:{preferences:{},assets:[],references:[],concepts:[],sceneReviews:[],comments:[],strategy:{revision:1,confirmation:{strategyRevision:1}},
    scenes:[{id:'s1',title:'캔을 딴다',description:'큰 소리',duration:3,revision:1,visibility:'customer'}]}});
const staff=(over,translation)=>projectView({mode:'staff',canEdit:true,workflow:[],versionId:'',project:project(translation),...over});

test('장면 고치기 · 시안 올리기: 영어 칸은 영어 프로젝트에서만, 옛 영어는 원래 값을 함께 둔다(건드린 칸만 보낸다)',()=>{
  const editor={tab:'storyboard',editor:{type:'scene',id:'s1'}},upload={tab:'review',showVersion:true};
  assert.doesNotMatch(staff(editor),ENGLISH);assert.doesNotMatch(staff(upload),ENGLISH);
  const scene=staff(editor,tr);
  assert.match(scene,/name="titleTr"[^>]*data-tr-orig="Open the can"[^>]*value="Open the can"/);
  assert.match(scene,/원문이 바뀌었어요 · 다시 확인<\/em><textarea name="descriptionTr"[^>]*data-tr-orig="A loud pop"/,'설명 영어는 낡음');
  const version=staff(upload,tr);
  assert.match(version,/name="labelTr"[^>]*required/);assert.match(version,/name="guideTr"/);
});

test('데스크: 손님에게 보일 영어 목록은 빠짐 · 낡음 · 초안부터, 저장 폼은 칸 키를 id로 쓴다',()=>{
  const model={id:'p',number:'P-001',at:'11/09',title:'합성 탄산수',contact:'',brief:[],files:[],attachments:[],checks:[],note:null,confirmed:true,canDirect:true,rounds:[],queue:[{id:'p',title:'합성',meta:'방금'}],canEdit:true};
  assert.doesNotMatch(deskView(model,{bar:false}),/desk-tr/);
  const html=deskView({...model,translation:tr},{bar:false});
  assert.match(html,/손님에게 보일 영어 <span class="mono">3\/6<\/span>/);
  assert.match(html,/<details class="desk-tr-list" open><summary>손볼 칸 3개 · 칸 6개<\/summary>/);
  const order=[...html.matchAll(/data-form="desk-translation" data-id="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(order.slice(0,3),['project:title','scene:s1:description','message:m9:text']);
  assert.match(html,/장면 · 이름<\/b>/);assert.match(html,/방향 안 · 흐름 1<\/b>/);
  assert.match(html,/확인하고 저장/);
  // 원문이 이미 영어인 칸(납품 파일 이름을 영어로 적은 경우)은 빠짐으로 세지 않는다.
  const same=deskView({...model,translation:{locale:'en',entries:{'version:v1:label':{source:'Final film',max:240,text:'',status:'',fresh:false}}}},{bar:false});
  assert.match(same,/원문이 이미 영어/);assert.match(same,/모두 확인했어요/);
  const readOnly=deskView({...model,canEdit:false,translation:tr},{bar:false});
  assert.doesNotMatch(readOnly,/<button type="submit" class="btn-line">/);assert.match(readOnly,/<textarea name="text"[^>]*disabled>/);
});
