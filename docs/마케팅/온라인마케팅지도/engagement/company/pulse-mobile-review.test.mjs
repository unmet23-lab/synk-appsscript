import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {projectView,mediaView} from './public/pulse-app/views.mjs';
import {customerClientCloseout} from './client-closeout.mjs';

const originalLocation=globalThis.location;
before(()=>{globalThis.location={origin:'https://pulse.example.test'};});
after(()=>{if(originalLocation===undefined)delete globalThis.location;else globalThis.location=originalLocation;});

const video=(id,label)=>({id,label,kind:'preview',media:{url:'/pulse-app/demo-assets/preview-v2.mp4',mimeType:'video/mp4'}});
function state(overrides={}){
  return {mode:'customer',tab:'review',versionId:'latest',project:{id:'mobile-review',title:'휴대폰 검토',stage:'review',versions:[video('old','이전 시안'),video('latest','최신 시안')],messages:[],studio:{preferences:{},references:[],concepts:[],scenes:[],comments:[],feedbackRounds:{drafts:[],rounds:[],latestVersionId:'latest',latestVersionLabel:'최신 시안',canDraft:true,maxItems:20,nextNumber:1}}},...overrides};
}

test('a long discussion stays after the video feedback and approval in reading order',()=>{
  const s=state();s.project.messages=Array.from({length:20},(_,i)=>({id:`comment-${i}`,author:'staff',authorName:'제작자',text:`기존 의견 ${i}`,versionId:'latest'}));
  const html=projectView(s),player=html.indexOf('id="review-video"'),form=html.indexOf('id="review-feedback"'),approval=html.indexOf('id="review-approval"'),discussion=html.indexOf('class="review-comments"');
  assert.ok(player>=0&&player<form&&form<approval&&approval<discussion);
  assert.equal((html.match(/class="comment"/g)||[]).length,20);
});

test('latest unapproved video has an immediate time-capture shortcut and a separate approval shortcut',()=>{
  const html=projectView(state());
  assert.match(html,/data-action="round-use-time" data-focus-comment="true">이 장면에 의견/);
  assert.match(html,/data-action="review-approval" >승인 확인/);
  assert.match(html,/data-form="round-draft" data-id="new:latest"/);
  assert.match(html,/name="seconds" type="number"/);
  assert.ok(html.indexOf('aria-label="영상 확인 바로가기"')<html.indexOf('id="review-feedback"'));
});

test('shortcuts cannot imply that an older or approved preview accepts new feedback or approval',()=>{
  const older=state({versionId:'old'}),approved=state();approved.project.versions.at(-1).approvedAt='2026-10-12T03:00:00Z';
  for(const s of [older,approved]){
    const html=projectView(s);
    assert.doesNotMatch(html,/data-focus-comment="true"|data-action="review-approval"/);
  }
});

test('pending feedback still blocks final approval while allowing the customer to inspect its reason',()=>{
  const s=state();s.project.messages=[{id:'pending',author:'customer',action:'feedback',authorName:'고객',text:'문구 변경',versionId:'latest',resolved:false}];
  const html=projectView(s);
  assert.match(html,/data-action="review-approval"/);
  assert.match(html,/data-action="approve" data-id="latest" disabled/);
  assert.match(html,/담당자가 준비할 수정본을 기다려 주세요/);
});

test('a draft tied to an old preview remains blocked after the mobile rearrangement',()=>{
  const html=projectView(state({versionId:'old',feedbackDraftVersion:'old',feedbackDraftAction:'feedback'}));
  assert.match(html,/이 글은 이전 시안에 작성한 의견이에요/);
  assert.match(html,/<button type="submit" class="button primary" data-mutate disabled>이 의견 보내기/);
});

test('staff review has neither customer quick action and retains the reply form',()=>{
  const html=projectView(state({mode:'staff',canEdit:true,user:{id:'owner'}}));
  assert.doesNotMatch(html,/data-focus-comment="true"|data-action="review-approval"/);
  assert.match(html,/고객에게 답변 보내기/);
});

test('image previews cannot show a video time-capture shortcut',()=>{
  const s=state();s.project.versions.at(-1).media={url:'/pulse-app/demo-assets/scene-1.png',mimeType:'image/png'};
  const html=projectView(s);assert.doesNotMatch(html,/data-focus-comment="true"/);assert.match(html,/data-action="review-approval"/);
});

test('mobile playback keeps native controls, inline playback and metadata-only preload',()=>{
  const html=mediaView(video('latest','휴대폰에서 확인'));
  assert.match(html,/controls playsinline preload="metadata"/);
  assert.doesNotMatch(html,/autoplay/);
});

function approvedState(overrides={}){
  const s=state(overrides);
  s.project.versions.at(-1).approvedAt='2026-10-12T03:00:00Z';
  s.project.nextStep='각 장면의 이미지와 문구를 확인해 주세요.';
  s.project.studio.strategy={revision:2,data:{primaryPromise:'하나의 메시지',evidence1:'확인한 근거',desiredAction:'문의'},confirmation:{strategyRevision:2,current:true}};
  s.project.studio.scenes=[{id:'scene',title:'승인한 장면',revision:1,duration:5}];
  return s;
}
const nextBanner=s=>projectView(s).match(/<section class="next-decision">([\s\S]*?)<\/section>/)?.[1]||'';

test('latest preview approval advances customer and staff guidance from storyboard to final preparation',()=>{
  const customer=nextBanner(approvedState()),staff=nextBanner(approvedState({mode:'staff',canEdit:true})),viewer=nextBanner(approvedState({mode:'staff',canEdit:false}));
  assert.match(customer,/시안 승인을 마쳤어요/);
  assert.match(customer,/최종 파일을 준비하고 있어요/);
  assert.match(customer,/data-tab="review"[^>]*>승인한 시안 확인/);
  assert.match(staff,/승인한 시안으로 납품을 준비해요/);
  assert.match(staff,/최종 파일과 사용 안내를 등록/);
  assert.match(staff,/data-tab="review"[^>]*>최종 납품 준비/);
  assert.match(viewer,/최종 파일을 준비하고 있어요/);
  assert.match(viewer,/data-tab="review"[^>]*>승인한 시안 확인/);
  assert.doesNotMatch(viewer,/최종 파일과 사용 안내를 등록|최종 납품 준비/);
  for(const banner of [customer,staff,viewer])assert.doesNotMatch(banner,/광고의 흐름을 먼저 맞춰요|각 장면의 이미지와 문구|data-tab="storyboard"/);
});

test('an older final never completes the latest approved preview or hides a new unapproved preview',()=>{
  const s=approvedState();
  s.project.versions.splice(1,0,{id:'old-final',kind:'final',approvedPreviewId:'old',label:'이전 납품'});
  s.project.stage='delivered';
  assert.match(nextBanner(s),/최종 파일을 준비하고 있어요/);
  assert.doesNotMatch(nextBanner(s),/완성된 파일이 도착했어요/);
  s.project.versions.at(-1).approvedAt=null;
  assert.match(nextBanner(s),/새 시안을 함께 확인해요/);
  assert.doesNotMatch(nextBanner(s),/완성된 파일이 도착했어요|시안 승인을 마쳤어요/);
});

test('final delivery guidance requires the file linked to the latest approved preview',()=>{
  const s=approvedState();
  s.project.versions.push({id:'current-final',kind:'final',approvedPreviewId:'latest',label:'현재 납품'});
  s.project.stage='delivered';
  const banner=nextBanner(s);
  assert.match(banner,/완성된 파일이 도착했어요/);
  assert.match(banner,/data-tab="history"[^>]*>납품 파일 확인/);
  assert.doesNotMatch(banner,/최종 파일을 준비하고 있어요|광고의 흐름을 먼저 맞춰요/);
});

test('current customer receipt changes the next banner to a record link without claiming internal project closure',()=>{
  const s=approvedState();s.project.stage='delivered';
  s.project.versions.push({id:'current-final',kind:'final',approvedPreviewId:'latest',label:'현재 납품'});
  s.project.closeout=customerClientCloseout(s.project);
  assert.match(nextBanner(s),/완성된 파일이 도착했어요/);
  s.project.deliveryReceipts=[{id:'receipt',deliveryKey:s.project.closeout.deliveryKey,confirmedAt:'2026-10-12T04:00:00Z'}];
  s.project.closeout=customerClientCloseout(s.project);
  assert.equal(s.project.closeout.canConfirm,false);
  assert.equal(s.project.closeout.closure,undefined,'the customer projection does not expose internal closure');
  const banner=nextBanner(s);
  assert.match(banner,/수령 확인을 마쳤어요/);
  assert.match(banner,/data-tab="history"[^>]*>납품 파일·기록 다시 보기/);
  assert.doesNotMatch(banner,/최종 파일과 사용 안내를 확인해 주세요|프로젝트 마감|프로젝트 완료/);
});

test('a new final bundle or preview cannot inherit the old receipt banner',()=>{
  const s=approvedState();s.project.stage='delivered';
  s.project.versions.push({id:'current-final',kind:'final',approvedPreviewId:'latest',label:'현재 납품'});
  s.project.closeout=customerClientCloseout(s.project);
  const oldKey=s.project.closeout.deliveryKey;
  s.project.deliveryReceipts=[{id:'receipt',deliveryKey:oldKey,confirmedAt:'2026-10-12T04:00:00Z'}];
  s.project.closeout=customerClientCloseout(s.project);assert.match(nextBanner(s),/수령 확인을 마쳤어요/);
  s.project.versions.push({id:'additional-final',kind:'final',approvedPreviewId:'latest',label:'추가 납품'});
  s.project.closeout=customerClientCloseout(s.project);
  assert.notEqual(s.project.closeout.deliveryKey,oldKey);assert.equal(s.project.closeout.receipt,null);
  assert.match(nextBanner(s),/완성된 파일이 도착했어요/);assert.doesNotMatch(nextBanner(s),/수령 확인을 마쳤어요/);
  s.project.versions.push(video('new-preview','새 검토 시안'));
  s.project.closeout=customerClientCloseout(s.project);
  assert.match(nextBanner(s),/새 시안을 함께 확인해요/);assert.doesNotMatch(nextBanner(s),/수령 확인을 마쳤어요|완성된 파일이 도착했어요/);
});

test('strategy reconfirmation and kickoff readiness retain priority after preview approval',()=>{
  const s=approvedState(),strategy=s.project.studio.strategy;
  strategy.revision=3;strategy.request={strategyRevision:3,current:true};
  assert.match(nextBanner(s),/제작 설계 확인을 부탁드려요/);
  s.project.versions.at(-1).approvedAt=null;
  assert.match(nextBanner(s),/제작 설계 확인을 부탁드려요/);
  s.project.versions.at(-1).approvedAt='2026-10-12T03:00:00Z';
  strategy.confirmation={strategyRevision:3,current:true};
  s.project.kickoff={enabled:true,status:'waiting'};
  assert.match(nextBanner(s),/제작 시작 전 준비를 확인해요/);
});
