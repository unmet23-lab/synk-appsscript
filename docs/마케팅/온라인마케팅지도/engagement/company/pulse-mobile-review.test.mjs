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

test('a long discussion never pushes the video note or the approval away: it waits in its own folded panel',()=>{
  const s=state();s.project.messages=Array.from({length:20},(_,i)=>({id:`comment-${i}`,author:'staff',authorName:'제작자',text:`기존 의견 ${i}`,versionId:'latest'}));
  const html=projectView(s),player=html.indexOf('id="review-video"'),note=html.indexOf('data-form="round-draft"'),ask=html.indexOf('data-panel="ask" hidden'),approval=html.indexOf('id="review-approval"');
  assert.ok(player>=0&&player<note&&note<ask&&ask<approval);
  assert.equal((html.match(/class="sx-thread-row"/g)||[]).length,20);
  // 승인 칸은 스크롤되는 칸 밖에 있다(휴대폰은 화면 아래에 붙는다).
  assert.ok(html.indexOf('</aside>')>approval);
  const lastPanel=html.lastIndexOf('class="sx-panel"',approval),between=html.slice(lastPanel,approval);
  assert.ok(lastPanel>=0);assert.equal((between.match(/<div/g)||[]).length+1,(between.match(/<\/div>/g)||[]).length,'every panel is closed before the approval');
});

test('the latest unapproved video takes a note at the moment on screen, with approval as its own action',()=>{
  const html=projectView(state());
  // 쓰기 시작하면 app.mjs가 지금 시간을 넣는다(form[data-form="round-draft"] textarea[name="text"]). 시간 칸은 비어 있어야 그렇게 된다.
  assert.match(html,/<form class="sx-say" data-form="round-draft" data-id="new:latest" data-item-id="" data-draft-id="" data-version-id="latest"><input type="hidden" name="seconds" value="">/);
  assert.match(html,/<textarea name="text"[^>]*placeholder="이 순간에 남길 의견"/);
  assert.match(html,/data-live-clock/);
  assert.match(html,/data-action="approve" data-id="latest"[^>]*><span>이 시안 최종 승인/);
});

test('shortcuts cannot imply that an older or approved preview accepts new feedback or approval',()=>{
  const older=state({versionId:'old'}),approved=state();approved.project.versions.at(-1).approvedAt='2026-10-12T03:00:00Z';
  // 승인한 뒤에는 서버가 canDraft를 끄고, 화면은 그 값을 따른다.
  if(approved.project.studio?.feedbackRounds)approved.project.studio.feedbackRounds.canDraft=false;
  assert.doesNotMatch(projectView(approved),/data-form="round-draft" data-id="new:/,'an approved preview takes no new note once the server closes it');
  assert.doesNotMatch(projectView(older),/data-form="round-draft" data-id="new:/,'an older preview takes no new note');
  // 옛 시안에서는 승인 단추가 눌리지 않고, 승인한 시안에는 승인 단추가 없다.
  assert.match(projectView(older),/data-action="approve" data-id="latest" disabled/);
  assert.doesNotMatch(projectView(approved),/data-action="approve"/);
});

test('pending feedback still blocks final approval while allowing the customer to inspect its reason',()=>{
  const s=state();s.project.messages=[{id:'pending',author:'customer',action:'feedback',authorName:'고객',text:'문구 변경',versionId:'latest',resolved:false}];
  const html=projectView(s);
  assert.match(html,/data-action="approve" data-id="latest" disabled/);
  assert.match(html,/수정본이 오면 그때 승인해 주세요/);
});

test('a draft tied to an old preview remains blocked after the mobile rearrangement',()=>{
  const html=projectView(state({versionId:'old',feedbackDraftVersion:'old',feedbackDraftAction:'feedback'}));
  assert.match(html,/이 글은 이전 시안을 보며 쓴 의견이에요/);
  assert.match(html,/data-action="move-feedback-draft"/);
  assert.match(html,/<div class="sx-panel" data-panel="ask" >/,'the blocked text is on screen, not folded away');
  assert.match(html,/<button type="submit" class="sx-go" data-mutate disabled><span>문의 보내기/);
});

test('staff review has neither customer quick action and retains the reply form',()=>{
  const html=projectView(state({mode:'staff',canEdit:true,user:{id:'owner'}}));
  assert.doesNotMatch(html,/data-focus-comment="true"|data-action="review-approval"/);
  assert.match(html,/>답변 보내기</);
});

test('image previews cannot show a video time-capture shortcut',()=>{
  const s=state();s.project.versions.at(-1).media={url:'/pulse-app/demo-assets/scene-1.png',mimeType:'image/png'};
  const html=projectView(s);assert.doesNotMatch(html,/data-film-toggle|data-line|<video/);assert.match(html,/data-action="approve" data-id="latest"/);
});

test('mobile playback keeps native controls, inline playback and metadata-only preload',()=>{
  const html=mediaView(video('latest','휴대폰에서 확인'));
  assert.match(html,/controls playsinline preload="metadata"/);
  assert.doesNotMatch(html,/autoplay/);
});

function approvedState(overrides={}){
  const s=state(overrides);
  s.project.versions.at(-1).approvedAt='2026-10-12T03:00:00Z';
  s.project.nextStep='장면마다 그림과 문구를 보고 확인하거나 의견을 남겨 주세요.';
  s.project.studio.strategy={revision:2,data:{primaryPromise:'하나의 메시지',evidence1:'확인한 근거',desiredAction:'문의'},confirmation:{strategyRevision:2,current:true}};
  s.project.studio.scenes=[{id:'scene',title:'승인한 장면',revision:1,duration:5}];
  return s;
}
// 다음 할 일: 고객은 현황의 지금 할 일 덩이, 직원은 옛 안내 칸이다.
const nextBanner=s=>projectView(s.mode==='staff'?s:{...s,tab:'overview'}).match(s.mode==='staff'?/<section class="next-decision">([\s\S]*?)<\/section>/:/<section class="sx-next-block">([\s\S]*?)<\/section>/)?.[1]||'';

test('latest preview approval advances customer and staff guidance from storyboard to final preparation',()=>{
  const customer=nextBanner(approvedState()),staff=nextBanner(approvedState({mode:'staff',canEdit:true})),viewer=nextBanner(approvedState({mode:'staff',canEdit:false}));
  assert.match(customer,/시안 승인을 마쳤어요/);
  assert.match(customer,/최종 파일을 준비하고 있어요/);
  assert.match(customer,/data-tab="review"[^>]*><span>승인한 시안 보기/);
  assert.match(staff,/승인한 시안으로 납품을 준비해요/);
  assert.match(staff,/최종 파일과 사용 안내를 올리고/);
  assert.match(staff,/data-tab="review"[^>]*>최종 납품 준비/);
  assert.match(viewer,/최종 파일을 준비하고 있어요/);
  assert.match(viewer,/data-tab="review"[^>]*>승인한 시안 보기/);
  assert.doesNotMatch(viewer,/최종 파일과 사용 안내를 올리고|최종 납품 준비/);
  for(const banner of [customer,staff,viewer])assert.doesNotMatch(banner,/광고의 흐름을 먼저 맞춰요|장면마다 그림과 문구|data-tab="storyboard"/);
});

test('an older final never completes the latest approved preview or hides a new unapproved preview',()=>{
  const s=approvedState();
  s.project.versions.splice(1,0,{id:'old-final',kind:'final',approvedPreviewId:'old',label:'이전 납품'});
  s.project.stage='delivered';
  assert.match(nextBanner(s),/최종 파일을 준비하고 있어요/);
  assert.doesNotMatch(nextBanner(s),/완성된 파일이 도착했어요/);
  s.project.versions.at(-1).approvedAt=null;
  assert.match(nextBanner(s),/새 시안이 도착했어요/);
  assert.doesNotMatch(nextBanner(s),/완성된 파일이 도착했어요|시안 승인을 마쳤어요/);
});

test('final delivery guidance requires the file linked to the latest approved preview',()=>{
  const s=approvedState();
  s.project.versions.push({id:'current-final',kind:'final',approvedPreviewId:'latest',label:'현재 납품'});
  s.project.stage='delivered';
  const banner=nextBanner(s);
  assert.match(banner,/완성된 파일이 도착했어요/);
  assert.match(banner,/data-tab="history"[^>]*><span>최종 파일 보기/);
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
  assert.match(banner,/data-tab="history"[^>]*><span>파일·기록 보기/);
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
  assert.match(nextBanner(s),/새 시안이 도착했어요/);assert.doesNotMatch(nextBanner(s),/수령 확인을 마쳤어요|완성된 파일이 도착했어요/);
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
  assert.match(nextBanner(s),/제작 전에 준비할 자료가 있어요/);
});
