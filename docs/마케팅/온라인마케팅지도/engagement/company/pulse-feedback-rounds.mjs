import {randomUUID} from 'node:crypto';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const list=value=>Array.isArray(value)?value:[];
const ACTIONS={
  save_feedback_draft:['draftId','versionId','itemId','text','seconds'],
  remove_feedback_draft_item:['draftId','itemId'],
  submit_feedback_round:['draftId','versionId','representativeName','confirmed'],
  classify_feedback_round:['roundId','itemId','classification','scopeNote','scheduleNote']
};
const CLASSIFICATIONS={correction:'제작 오류 정정',included:'합의한 범위 안의 수정',direction_change:'제작 방향 변경 · 추가 협의'};
const LIMITS={drafts:30,rounds:100,items:20,messages:300,classifications:30};
const latestPreview=row=>list(row.versions).filter(version=>version.kind==='preview').at(-1)||null;
function text(value,max=3000,required=false){if(value===undefined&&!required)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail('의견의 내용과 길이를 확인해 주세요.');const result=value.trim();if(required&&!result)throw fail('필수 내용을 입력해 주세요.');return result;}
function seconds(value){if(value===null||value===undefined||value==='')return null;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>86400)throw fail('영상 시간을 확인해 주세요.');return value;}
function requiredId(value){if(typeof value!=='string'||!value||value.length>160)throw fail('의견의 연결 항목을 확인해 주세요.');return value;}
function stateOf(studio){const stored=object(studio.feedbackRounds)?structuredClone(studio.feedbackRounds):{};return {...stored,drafts:list(stored.drafts),rounds:list(stored.rounds)};}
function currentPreview(row,versionId){const preview=latestPreview(row);if(!preview||preview.id!==requiredId(versionId))throw fail('최신 시안을 확인한 뒤 의견을 모아 주세요. 이전 시안의 초안은 보관됩니다.',409);if(preview.approvedAt)throw fail('승인한 시안의 변경은 후속 문의로 남겨 주세요.',409);return preview;}
function findDraft(state,draftId){const draft=state.drafts.find(value=>value.id===requiredId(draftId));if(!draft)throw fail('의견 초안을 찾을 수 없습니다. 제출 여부와 최신 내용을 확인해 주세요.',409);return draft;}
function publicClassification(value){return value?{classification:value.classification,label:CLASSIFICATIONS[value.classification]||'분류 확인 필요',scopeNote:value.scopeNote||'',scheduleNote:value.scheduleNote||'',at:value.at,authorName:value.authorName||'담당자'}:null;}
function publicItem(item,row){const message=list(row.messages).find(value=>value.id===item.messageId);return {id:item.id,text:item.text,seconds:item.seconds??null,...(item.messageId?{messageId:item.messageId,resolved:!!message?.resolved}:{}),classification:publicClassification(list(item.classifications).at(-1)),classificationHistory:list(item.classifications).map(publicClassification)};}

/** Fields extend the studio route's shared action/revision envelope. */
export function feedbackRoundActions(action){return Object.hasOwn(ACTIONS,action)?[...ACTIONS[action]]:null;}

/** Submitted text never changes; only staff classification records are appended. */
export function applyFeedbackRoundAction({studio,row,input,staff,stamp}){
  const fields=feedbackRoundActions(input?.action);
  if(!fields||!object(input)||Object.keys(input).some(key=>!['action','revision',...fields].includes(key)))throw fail('의견 모으기 입력 항목을 확인해 주세요.');
  const classifying=input.action==='classify_feedback_round';
  if(classifying?!staff:staff)throw fail(classifying?'제작 담당자만 의견의 수정 범위를 정리할 수 있습니다.':'고객 화면에서만 의견 초안과 제출을 기록할 수 있습니다.',403);
  if(row.stage==='archived')throw fail('보관한 프로젝트에서는 의견을 변경할 수 없습니다.',409);
  const state=stateOf(studio),at=stamp.at;
  let messages=null;
  if(input.action==='save_feedback_draft'){
    const preview=currentPreview(row,input.versionId),body=text(input.text,3000,true),time=seconds(input.seconds);
    let draft=input.draftId?findDraft(state,input.draftId):state.drafts.find(value=>value.versionId===preview.id);
    if(draft&&draft.versionId!==preview.id)throw fail('이 초안은 이전 시안에 연결되어 있습니다. 최신 시안의 초안에 따로 남겨 주세요.',409);
    if(!draft){if(input.itemId)throw fail('수정할 초안 항목을 찾을 수 없습니다.',404);if(state.drafts.length>=LIMITS.drafts)throw fail('보관 중인 초안이 많습니다. 불필요한 초안 항목을 정리한 뒤 다시 작성해 주세요.',409);draft={id:randomUUID(),versionId:preview.id,versionLabel:preview.label,createdAt:at,updatedAt:at,items:[]};state.drafts.push(draft);}
    const found=input.itemId?draft.items.find(item=>item.id===requiredId(input.itemId)):null;
    if(input.itemId&&!found)throw fail('수정할 초안 항목을 찾을 수 없습니다.',404);
    if(!found&&draft.items.length>=LIMITS.items)throw fail('한 번에 최대 20개 의견을 모을 수 있습니다.',409);
    const item={id:found?.id||randomUUID(),text:body,seconds:time,createdAt:found?.createdAt||at,updatedAt:at};
    if(found)draft.items[draft.items.indexOf(found)]=item;else draft.items.push(item);
    draft.updatedAt=at;
  }else if(input.action==='remove_feedback_draft_item'){
    const draft=findDraft(state,input.draftId),itemId=requiredId(input.itemId);
    if(!draft.items.some(item=>item.id===itemId))throw fail('지울 초안 항목을 찾을 수 없습니다.',404);
    draft.items=draft.items.filter(item=>item.id!==itemId);draft.updatedAt=at;
    if(!draft.items.length)state.drafts=state.drafts.filter(value=>value.id!==draft.id);
  }else if(input.action==='submit_feedback_round'){
    const preview=currentPreview(row,input.versionId),draft=findDraft(state,input.draftId);
    if(draft.versionId!==preview.id)throw fail('이전 시안의 초안은 최신 시안에 제출할 수 없습니다.',409);
    if(input.confirmed!==true)throw fail('의견을 취합한 담당자가 제출 내용을 확인해 주세요.');
    const representativeName=text(input.representativeName,100,true);
    if(!draft.items.length||draft.items.length>LIMITS.items)throw fail('제출할 의견을 먼저 모아 주세요.',409);
    if(state.rounds.length>=LIMITS.rounds)throw fail('의견 제출 기록 한도에 도달했습니다. 기존 기록을 보존하고 새 프로젝트로 이어가 주세요.',409);
    const existing=list(row.messages),ordinary=existing.filter(message=>!(message.author==='customer'&&message.action==='approve')).length;
    if(ordinary+draft.items.length>LIMITS.messages)throw fail('프로젝트의 대화 기록 한도를 초과합니다. 기존 기록을 보존하고 새 프로젝트로 이어가 주세요.',409);
    const roundId=randomUUID(),number=state.rounds.length+1;
    const items=draft.items.map(item=>({id:item.id,text:text(item.text,3000,true),seconds:seconds(item.seconds),messageId:randomUUID(),classifications:[]}));
    messages=items.map(item=>({id:item.messageId,text:item.text,seconds:item.seconds,visibility:'customer',author:'customer',authorName:stamp.authorName||row.customerName,at,versionId:preview.id,resolved:false,action:'feedback',feedbackRoundId:roundId,feedbackRoundNumber:number,feedbackItemId:item.id}));
    state.rounds.push({id:roundId,number,versionId:preview.id,versionLabel:preview.label,representativeName,confirmed:true,submittedAt:at,items});
    state.drafts=state.drafts.filter(value=>value.id!==draft.id);
  }else{
    const round=state.rounds.find(value=>value.id===requiredId(input.roundId)),item=round?.items.find(value=>value.id===requiredId(input.itemId));
    if(!round||!item)throw fail('제출된 의견을 찾을 수 없습니다.',404);
    if(!Object.hasOwn(CLASSIFICATIONS,input.classification))throw fail('수정의 종류를 선택해 주세요.');
    const scopeNote=text(input.scopeNote,1500,true),scheduleNote=text(input.scheduleNote,1000,true);
    const history=list(item.classifications);
    if(history.length>=LIMITS.classifications)throw fail('이 의견의 분류 이력 한도에 도달했습니다. 기존 기록을 보존하고 담당자와 확인해 주세요.',409);
    item.classifications=[...history,{classification:input.classification,scopeNote,scheduleNote,at,authorName:stamp.authorName||'담당자',authorId:stamp.authorId}];
  }
  // Validation completes before either authoritative object changes. The caller
  // commits row (including feedback messages) and studio in one transaction.
  studio.feedbackRounds=state;
  if(messages)row.messages=[...list(row.messages),...messages];
  return studio;
}

/** Customer drafts are deliberately absent from the staff projection. */
export function feedbackRoundsView(studio,row,staff=false){
  const state=stateOf(studio),preview=latestPreview(row),open=!!preview&&!preview.approvedAt&&row.stage!=='archived';
  return {latestVersionId:preview?.id||'',latestVersionLabel:preview?.label||'',canDraft:open,nextNumber:state.rounds.length+1,maxItems:LIMITS.items,
    ...(!staff?{drafts:state.drafts.map(draft=>({id:draft.id,versionId:draft.versionId,versionLabel:draft.versionLabel,createdAt:draft.createdAt,updatedAt:draft.updatedAt,current:draft.versionId===preview?.id,canSubmit:open&&draft.versionId===preview?.id&&draft.items.length>0,items:draft.items.map(item=>({id:item.id,text:item.text,seconds:item.seconds??null}))}))}:{}),
    rounds:state.rounds.map(round=>({id:round.id,number:round.number,versionId:round.versionId,versionLabel:round.versionLabel,representativeName:round.representativeName,confirmed:round.confirmed===true,submittedAt:round.submittedAt,items:round.items.map(item=>publicItem(item,row))}))};
}
