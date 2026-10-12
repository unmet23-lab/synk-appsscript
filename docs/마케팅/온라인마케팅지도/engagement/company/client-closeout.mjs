import {createHash} from 'node:crypto';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const records=value=>Array.isArray(value)?value:[];
const day=value=>{const at=Date.parse(value);return Number.isFinite(at)?new Date(at+9*3600000).toISOString().slice(0,10):'';};
const nextDay=(value,days)=>new Date(Date.parse(value+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
const STATUS={no_delivery:'납품 전',waiting_receipt:'고객 수령 확인 대기',follow_up:'남은 업무 확인',ready:'마감 가능',closed:'마감 완료',archived:'보관됨'};
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
    {id:'delivery',label:'현재 최종본 납품',status:deliveryKey&&row.stage==='delivered'?'ready':'missing',text:deliveryKey&&row.stage==='delivered'?`${finals.length}개 최종 파일이 등록돼 있습니다.`:'현재 승인 시안의 최종본을 납품 상태로 등록해 주세요.'},
    {id:'receipt',label:'고객의 명시적 수령 확인',status:receipt?'ready':'missing',text:receipt?'현재 파일 묶음을 고객이 확인했습니다.':'고객이 파일과 사용 안내를 확인해야 합니다.'},
    {id:'requests',label:'고객 문의·수정 처리',status:pendingRequests?'missing':'ready',text:pendingRequests?`미처리 고객 요청이 ${pendingRequests}개 있습니다.`:'남아 있는 고객 문의·수정 요청이 없습니다.'},
    {id:'contact',label:'후속 연락 정리',status:nextContactDate?'missing':'ready',text:nextContactDate?`${nextContactDate} 후속 연락을 먼저 정리해 주세요.`:'예약된 후속 연락이 없습니다.'},
  ];
  const status=row.stage==='archived'?'archived':!deliveryKey?'no_delivery':closure?'closed':!receipt?'waiting_receipt':checks.some(check=>check.status!=='ready')?'follow_up':'ready';
  const summaryText=[`${row.title} · 납품 마감 요약`,`승인 시안: ${approvedPreview?.label||'없음'}${approvedPreview?.approvedAt?' ('+approvedPreview.approvedAt+')':''}`,`납품 파일: ${finals.length?finals.map(version=>version.label).join(', '):'없음'}`,`납품 등록: ${deliveredAt||'없음'}`,`고객 수령 확인: ${receipt?.confirmedAt||'대기'}`,`고객 문의·수정: ${requests.filter(message=>message.resolved).length}개 처리 · ${pendingRequests}개 남음`,`후속 연락: ${nextContactDate||'예약 없음'}`].join('\n');
  return {deliveryKey,approvedPreviewId,deliveredAt,files:finals.map(({id,label})=>({id,label})),receipt:receipt?{confirmedAt:receipt.confirmedAt}:null,remindAfterDays,dueDate,overdue:!!(deliveryKey&&row.stage==='delivered'&&!receipt&&dueDate&&day(now)>=dueDate),status,statusLabel:STATUS[status],pendingRequests,nextContactDate,canClose:status==='ready',checks,closure,lastClosure,summaryText,requestText:deliveryKey?`${row.title}의 최종 파일과 사용 안내를 확인해 주세요.\n전달 파일: ${finals.map(version=>version.label).join(', ')}\n고객 작업실의 ‘파일과 안내 확인했어요’를 눌러 수령 확인을 남겨 주세요. 문의가 있으면 후속 문의에 남겨 주세요.`:''};
}

export function customerClientCloseout(row){
  const {deliveryKey,approvedPreviewId,finals,deliveredAt}=clientDeliveryIdentity(row),receipt=deliveryKey?records(row.deliveryReceipts).findLast(entry=>entry.deliveryKey===deliveryKey):null;
  const canConfirm=!!(deliveryKey&&row.stage==='delivered'&&!receipt),status=!deliveryKey?'no_delivery':receipt?'confirmed':'waiting_receipt';
  return {deliveryKey,approvedPreviewId,deliveredAt,files:finals.map(({id,label})=>({id,label})),receipt:receipt?{confirmedAt:receipt.confirmedAt}:null,canConfirm,status,statusLabel:status==='confirmed'?'수령 확인 완료':status==='waiting_receipt'?'파일·사용 안내 확인':'납품 전'};
}
