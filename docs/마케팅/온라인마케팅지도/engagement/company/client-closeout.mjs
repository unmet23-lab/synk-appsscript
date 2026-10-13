import {createHash} from 'node:crypto';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const records=value=>Array.isArray(value)?value:[];
const day=value=>{const at=Date.parse(value);return Number.isFinite(at)?new Date(at+9*3600000).toISOString().slice(0,10):'';};
const nextDay=(value,days)=>new Date(Date.parse(value+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
const when=value=>{const at=Date.parse(value);return Number.isFinite(at)?new Date(at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'';};
const STATUS={no_delivery:'납품 전',waiting_receipt:'고객이 받았다고 안 함',follow_up:'남은 일 있음',ready:'마감할 수 있음',closed:'마감함',archived:'보관됨'};
const requestMessages=row=>records(row.messages).filter(message=>message.author==='customer'&&['feedback','support'].includes(message.action));

// The key names the exact approved preview and complete current final-file set.
// A new file (even under the same approval) cannot inherit a previous receipt.
export function clientDeliveryIdentity(row){
  const preview=records(row.versions).filter(version=>version.kind==='preview').at(-1);
  const finals=preview?.approvedAt?records(row.versions).filter(version=>version.kind==='final'&&version.approvedPreviewId===preview.id):[];
  if(!finals.length)return {deliveryKey:null,approvedPreviewId:preview?.approvedAt?preview.id:null,approvedPreview:preview?.approvedAt?preview:null,finals:[],deliveredAt:null};
  const fields=version=>({id:version.id,label:version.label,url:version.url||'',guide:version.guide||'',createdAt:version.createdAt,media:version.media||null});
  return {deliveryKey:hash({projectId:row.id,preview:fields(preview),approvedAt:preview.approvedAt,finals:finals.map(fields)}),approvedPreviewId:preview.id,approvedPreview:preview,finals,deliveredAt:finals.map(version=>version.createdAt).filter(value=>Number.isFinite(Date.parse(value))).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)||null};
}

export function clientCloseoutWorkKey(row,identity=clientDeliveryIdentity(row)){
  return hash({deliveryKey:identity.deliveryKey,title:row.title,nextContactDate:row.nextContactDate||'',workRevision:row.closeoutWorkRevision||0,requests:requestMessages(row).map(message=>({id:message.id,action:message.action,resolved:message.resolved===true,resolvedAt:message.resolvedAt||null,workflow:message.workflow||null})),followUpHistory:records(row.followUpHistory).map(entry=>({id:entry.id,at:entry.at,disposition:entry.disposition,nextContactDate:entry.nextContactDate}))});
}

export function buildClientCloseout(row,{now=new Date().toISOString()}={}){
  const identity=clientDeliveryIdentity(row),{deliveryKey,approvedPreviewId,approvedPreview,finals,deliveredAt}=identity;
  const receipt=deliveryKey?records(row.deliveryReceipts).findLast(entry=>entry.deliveryKey===deliveryKey)||null:null;
  const remindAfterDays=Number.isInteger(row.deliveryReminderDays)&&row.deliveryReminderDays>=0&&row.deliveryReminderDays<=30?row.deliveryReminderDays:3;
  const deliveredDay=day(deliveredAt),dueDate=deliveredDay&&remindAfterDays?nextDay(deliveredDay,remindAfterDays):'';
  const requests=requestMessages(row),pendingRequests=requests.filter(message=>!message.resolved).length,nextContactDate=row.nextContactDate||'';
  const workKey=clientCloseoutWorkKey(row,identity),lastClosure=records(row.closureHistory).at(-1)||null;
  const closure=deliveryKey&&receipt&&lastClosure?.deliveryKey===deliveryKey&&lastClosure.receiptId===receipt.id&&lastClosure.workKey===workKey&&row.stage==='delivered'&&!pendingRequests&&!nextContactDate?lastClosure:null;
  const checks=[
    {id:'delivery',label:'최종본 보냄',status:deliveryKey&&row.stage==='delivered'?'ready':'missing',text:deliveryKey&&row.stage==='delivered'?`${finals.length}개 최종 파일을 보냈어요.`:'「납품」에서 최종본을 고객에게 보여 주세요.'},
    {id:'receipt',label:'고객이 받았다고 했나',status:receipt?'ready':'missing',text:receipt?'고객이 받았다고 했어요.':'고객이 파일과 사용 안내를 받았다고 눌러야 해요.'},
    {id:'requests',label:'남은 문의와 수정',status:pendingRequests?'missing':'ready',text:pendingRequests?`답할 고객 요청이 ${pendingRequests}개 남았어요.`:'남은 문의나 수정 요청이 없어요.'},
    {id:'contact',label:'다음 연락',status:nextContactDate?'missing':'ready',text:nextContactDate?`${nextContactDate}에 잡힌 연락을 먼저 정리해 주세요.`:'잡힌 연락이 없어요.'},
  ];
  const status=row.stage==='archived'?'archived':!deliveryKey?'no_delivery':closure?'closed':!receipt?'waiting_receipt':checks.some(check=>check.status!=='ready')?'follow_up':'ready';
  const summaryText=[`${row.title} · 마감 요약`,`승인 시안: ${approvedPreview?.label||'없음'}${approvedPreview?.approvedAt?' · 승인 '+when(approvedPreview.approvedAt):''}`,`납품 파일: ${finals.length?finals.map(version=>version.label).join(', '):'없음'}`,`납품 등록: ${when(deliveredAt)||'없음'}`,`고객이 받았다고 한 때: ${receipt?when(receipt.confirmedAt):'아직'}`,`문의와 수정: ${requests.filter(message=>message.resolved).length}개 처리 · ${pendingRequests}개 남음`,`다음 연락: ${nextContactDate||'없음'}`].join('\n');
  return {deliveryKey,approvedPreviewId,deliveredAt,files:finals.map(({id,label})=>({id,label})),receipt:receipt?{confirmedAt:receipt.confirmedAt}:null,remindAfterDays,dueDate,overdue:!!(deliveryKey&&row.stage==='delivered'&&!receipt&&dueDate&&day(now)>=dueDate),status,statusLabel:STATUS[status],pendingRequests,nextContactDate,canClose:status==='ready',checks,closure,lastClosure,summaryText,requestText:deliveryKey?`${row.title} 최종 파일과 사용 안내를 보내 드렸어요.\n파일: ${finals.map(version=>version.label).join(', ')}\n고객 화면에서 「파일과 안내 확인했어요」를 눌러 주세요. 궁금한 점은 후속 문의에 남겨 주세요.`:''};
}

export function customerClientCloseout(row){
  const {deliveryKey,approvedPreviewId,finals,deliveredAt}=clientDeliveryIdentity(row),receipt=deliveryKey?records(row.deliveryReceipts).findLast(entry=>entry.deliveryKey===deliveryKey):null;
  const canConfirm=!!(deliveryKey&&row.stage==='delivered'&&!receipt),status=!deliveryKey?'no_delivery':receipt?'confirmed':'waiting_receipt';
  return {deliveryKey,approvedPreviewId,deliveredAt,files:finals.map(({id,label})=>({id,label})),receipt:receipt?{confirmedAt:receipt.confirmedAt}:null,canConfirm,status,statusLabel:status==='confirmed'?'받았다고 함':status==='waiting_receipt'?'파일과 안내 확인':'납품 전'};
}
