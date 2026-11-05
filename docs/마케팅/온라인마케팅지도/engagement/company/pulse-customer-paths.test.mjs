import test from 'node:test';
import assert from 'node:assert/strict';
import {projectView,dialogContent} from './public/pulse-app/views.mjs';
import {customerSceneRequests} from './client-scene-requests.mjs';

globalThis.location=new URL('http://localhost/pulse-app/');
const at='2026-10-14T00:00:00Z';
const base=()=>({id:'p',revision:4,title:'고객 경로 검증',stage:'review',versions:[{id:'v1',kind:'preview',label:'시안 v1',media:{url:'http://localhost/video.mp4',mimeType:'video/mp4'}}],messages:[],studio:{preferences:{},assets:[],references:[],concepts:[],scenes:[],sceneReviews:[],comments:[],feedbackRounds:{drafts:[],rounds:[],latestVersionId:'v1'}}});
const state=p=>({mode:'customer',tab:'review',project:p,versionId:'v1'});

test('submitted feedback appears once with an addressable classification, while staff keeps workflow actions',()=>{
  const p=base();p.messages=[{id:'m1',author:'customer',action:'feedback',versionId:'v1',text:'딱 한 번 나오는 수정 의견',at,resolved:false,feedbackRoundId:'r'}];
  p.studio.feedbackRounds.rounds=[{id:'r',number:1,versionId:'v1',versionLabel:'시안 v1',submittedAt:at,representativeName:'검수자',items:[{id:'i',messageId:'m1',text:p.messages[0].text,seconds:3,resolved:false,classification:{label:'합의한 범위 안의 수정',scopeNote:'크기 조정',scheduleNote:'일정 유지'}}]}];
  const html=projectView(state(p));assert.equal(html.replace(/<[^>]*>/g,'').split('딱 한 번 나오는 수정 의견').length-1,1);assert.match(html,/data-message-id="m1" data-feedback-round-id="r"/);assert.match(html,/크기 조정/);
  const staff=projectView({...state(p),mode:'staff',canEdit:true,workflow:[{messageId:'m1',projectId:'p',statusLabel:'내 차례',actions:[{action:'start',label:'고치기 시작'}]}]});assert.match(staff,/data-workflow="start"/);
});

test('a scene has one confirmation entry and its request is not repeated in scene review history',()=>{
  const p=base();p.studio.scenes=[{id:'s',title:'첫 장면',revision:2,duration:3}];p.studio.sceneReviews=[{id:'r',sceneId:'s',sceneRevision:1,status:'changes',text:'중복 없는 장면 수정',at}];p.sceneRequests={items:[{id:'r',sceneId:'s',requestedRevision:1,resultRevision:2,currentRevision:2,status:'waiting_customer',text:'중복 없는 장면 수정',createdAt:at}]};
  const html=projectView({...state(p),tab:'storyboard'});assert.equal(html.split('중복 없는 장면 수정').length-1,1);assert.equal((html.match(/data-action="confirm-scene"/g)||[]).length,1);assert.doesNotMatch(html,/data-action="confirm-scene-request"|data-target="scene"/);assert.match(html,/>고친 장면 확인</);
  const modal=dialogContent('scene',p.studio.scenes[0]);assert.doesNotMatch(modal,/option value="confirmed"/);assert.match(modal,/option value="changes"/);assert.match(modal,/option value="comment"/);
});

test('follow-up inquiries and project replies are available before any video and delivery links to the same place',()=>{
  const p=base();p.versions=[];p.messages=[{id:'reply',author:'staff',text:'파일 문의 답변',at}];p.studio.comments=[{id:'comment',targetType:'project',targetId:null,text:'프로젝트 답변',at}];
  // 시사실 판(2026-11-05): 「후속 문의」 제목은 「문의와 답변」, 납품 쪽 단추는 「담당자에게 묻기」로 바뀌었고 가는 곳(data-scroll="inquiry")은 같다.
  const html=projectView(state(p));assert.match(html,/data-form="feedback"/);assert.match(html,/>문의와 답변</);assert.match(html,/파일 문의 답변/);assert.match(html,/프로젝트 답변/);assert.doesNotMatch(html,/일정·기타 문의/);
  const delivery=projectView({...state(p),tab:'history'});assert.match(delivery,/data-tab="review" data-scroll="inquiry"[^>]*>담당자에게 묻기</);
});

test('customer scene projection explains the customer action and never asks them to connect staff work',()=>{
  const p=base();p.ownerId='owner';p.studio.scenes=[{id:'s',title:'장면',revision:1,visibility:'customer'}];p.studio.sceneReviews=[{id:'r',author:'customer',sceneId:'s',sceneRevision:1,status:'changes',text:'내 요청',at}];
  const item=customerSceneRequests(p).items[0];assert.equal(item.status,'open');assert.equal(item.statusLabel,'수정 요청');assert.match(item.reason,/제작팀에 전달/);assert.doesNotMatch(item.reason,/고객이|연결해 주세요|준비해 주세요/);
});
