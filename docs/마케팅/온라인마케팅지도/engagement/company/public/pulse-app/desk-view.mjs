import {esc} from './api.mjs';

// 내부 확인 화면: 손님 답을 담당자가 보는 자리. 직원 화면에서만 불러온다(손님이 받는 묶음 · 오프라인 목록에 넣지 않는다).
// 자동 점검 → 1차 확인(도구가 올린 메모) → 사람이 묻기 · 모델 제안 · 확인 끝 · 판 보내기를 고른다.
const arrow='<span class="arw" aria-hidden="true">→</span>';
const line=(label,action,extra='')=>`<button type="button" class="btn-line" data-action="${action}" ${extra}>${esc(label)}</button>`;
const main=(label,action)=>`<button type="button" class="btn-main" data-action="${action}"><span>${esc(label)}</span>${arrow}</button>`;
// 메일 알림 한 줄(판 2): 연결 · 받는 곳 · 순간마다 마지막 상태. 「Gmail에 넘김」까지만 안다 — 도착 · 반송은 founder@ 받은편지함에서 본다.
const MAIL_MOMENT={request_received:'접수 확인',request_asked:'되묻기',direction_proposed:'방향 제안',draft_ready:'글 콘티',payment_requested:'결제 안내',images_ready:'장면 이미지',preview_ready:'영상 확인',final_ready:'납품'};
const mailAt=at=>{const ms=Date.parse(at);if(!Number.isFinite(ms))return '';const k=new Date(ms+9*3600000).toISOString();return `${Number(k.slice(5,7))}/${Number(k.slice(8,10))} ${k.slice(11,16)}`;};
function mailMoment(item){
  if(item.state==='sent')return `Gmail에 넘김 ${mailAt(item.at)}`;
  if(item.state==='skipped')return item.reason==='read'||item.reason==='acted'?'안 보냄 · 앱에서 먼저 보셨어요':item.reason==='expired'?'안 보냄 · 이틀이 지나서':'안 보냄';
  if(item.state==='failed')return '실패 · 직접 연락해 주세요';
  if(item.state==='unknown')return '보냈는지 확인 못 함 · 직접 연락해 주세요';
  return '보낼 차례';
}
function mailBlock(m){
  if(!m)return '';
  const head={not_connected:'연결 전',broken:'연결 끊김 · 관리자 설정에서 다시 연결',off:'꺼 둠',stopped:'비상 정지',on:m.recipient==='mail_off'?'이 의뢰는 껐어요':m.recipient==='no_email'?'주소 없음 · 휴대폰으로 직접 연락':m.override?'담당자가 고친 주소로 보내요':'의뢰서 주소로 보내요'}[m.connection]||'';
  const moments=Object.entries(m.moments||{}).map(([key,item])=>`<li>${esc(MAIL_MOMENT[key]||key)} · ${esc(mailMoment(item))}</li>`).join('');
  return `<div class="desk-mail"><p class="desk-mail-head">메일 알림 · ${esc(head)}${m.customerChanged&&m.connection==='on'&&m.recipient==='set'?' · 손님이 의뢰서 주소를 고쳐서 그 주소로 보내요':''}</p>${moments?`<ul class="desk-mail-list">${moments}</ul>`:''}
    <details class="desk-mail-edit"><summary>주소 고치기 · 메일 끄기</summary><form data-form="desk-contact"><label><span>알림 메일 주소</span><input type="email" name="email" value="${esc(m.email||'')}" maxlength="254" autocomplete="off"></label><label class="desk-mail-off"><input type="checkbox" name="mailOff" ${m.mailOff?'checked':''}> 이 의뢰는 메일 끄기</label><button type="submit" class="btn-line">저장</button></form></details></div>`;
}
// 영어 프로젝트(다국어 판 2): 손님에게 보이는 직원 글의 영어. 보내는 창마다 영어 칸이 있고, 여기서는 이미 보인 글(장면 · 일지 답 · 프로젝트 머리 · 보낸 파일 이름 등)의 영어를 넣거나 고친다.
// 확인한 영어만 손님에게 보이고, 빠졌거나 원문이 바뀐 칸은 손님에게 한국어 원문이 나간다. 저장하면 확인(reviewed)으로 남는다.
const TR_PART={ask:'되물은 것',model:'모델 제안',direction:'방향 안내',option:'방향 안',round:'보낸 판',scene:'장면',project:'프로젝트',message:'일지 답',version:'보낸 파일'};
const TR_FIELD={label:'물을 것',why:'이유',note:'메모',lead:'한 줄 안내',name:'이름',sentence:'한 문장',filmNote:'견본 설명',flow:'흐름',oneLine:'한 문장',title:'제목',description:'설명',summary:'만들 내용',nextStep:'다음 할 일',terms:'제작 범위',text:'글',guide:'사용 안내'};
const TR_STATE={missing:['빠짐','is-wait','저장'],stale:['원문이 바뀜','is-wait','확인하고 저장'],draft:['초안','is-wait','확인하고 저장'],same:['원문이 이미 영어','is-ok','저장'],ok:['확인','is-ok','고쳐 저장']};
// 납품 파일 이름처럼 직원이 처음부터 영어로 적은 칸은 빠진 것으로 세지 않는다(손님에게 그 글이 그대로 보인다).
const trState=entry=>!entry.text?(/[가-힣]/.test(entry.source)?'missing':'same'):!entry.fresh?'stale':entry.status!=='reviewed'?'draft':'ok';
function trLabel(key){
  const parts=key.split(':'),part=parts[0],field=['model','project'].includes(part)?parts[1]:parts[2];
  const name=(part==='version'&&field==='label')||(part==='scene'&&field==='title')?'이름':part==='round'&&field==='note'?'함께 보낸 말':TR_FIELD[field]||field;
  return `${TR_PART[part]||part} · ${name}${field==='flow'&&parts[3]!==undefined?' '+(Number(parts[3])+1):''}`;
}
const excerpt=text=>text.length>160?text.slice(0,160)+'…':text;
function translationBlock(tr,canEdit){
  if(!tr)return '';
  const lang={en:'영어',ja:'일본어'}[tr.locale]||tr.locale,order={missing:0,stale:1,draft:2,same:3,ok:4};
  const rows=Object.entries(tr.entries||{}).map(([key,entry])=>({key,entry,state:trState(entry)})).sort((a,b)=>order[a.state]-order[b.state]);
  const gaps=rows.filter(row=>row.state!=='ok'&&row.state!=='same').length;
  const list=rows.map(({key,entry,state})=>`<form class="desk-tr-row" data-form="desk-translation" data-id="${esc(key)}"><p class="desk-tr-src"><i class="led ${TR_STATE[state][1]}"></i><b>${esc(trLabel(key))}</b><span class="desk-tr-state">${esc(TR_STATE[state][0])}</span></p><p class="desk-tr-ko" lang="ko">${esc(excerpt(entry.source))}</p><textarea name="text" rows="2" maxlength="${entry.max}" lang="${esc(tr.locale)}" aria-label="${esc(trLabel(key))} · ${esc(lang)}" ${canEdit?'':'disabled'}>${esc(entry.text)}</textarea>${canEdit?`<button type="submit" class="btn-line">${esc(TR_STATE[state][2])}</button>`:''}</form>`).join('');
  return `<section class="desk-tr"><h2 class="desk-h">손님에게 보일 ${esc(lang)} <span class="mono">${rows.length-gaps}/${rows.length}</span></h2><p class="desk-tr-note">이 의뢰는 ${esc(lang)}로 소통해요. 보내는 창마다 ${esc(lang)} 칸이 있고, 여기서는 이미 보인 글의 ${esc(lang)}를 넣거나 고쳐요. 확인한 ${esc(lang)}만 손님에게 보이고, 빠졌거나 원문이 바뀐 칸은 한국어 원문이 나가요.</p>${rows.length?`<details class="desk-tr-list" ${gaps?'open':''}><summary>${gaps?`손볼 칸 ${gaps}개`:'모두 확인했어요'} · 칸 ${rows.length}개</summary>${list}</details>`:`<p class="desk-tr-note">아직 손님에게 보인 직원 글이 없어요.</p>`}</section>`;
}
// 고객 전용 인물(판 3, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/인물판3_설계_20261110.md): 다음 행동 한 줄 → 손님 글 · 사진 → 견적 → 판(파일 올리기 · 보내기) → 승인 기록 → 사용 범위 → 상태 바꾸기.
// 전이 단추는 서버가 지금 상태에서 허락한 것(actions)만 그린다. 손님에게 보이는 글(왜 · 견적 범위 · 판 설명 · 이름 · 사용 범위)은 영어 프로젝트면 영어 칸을 함께 채워야 보내진다(서버 409).
// 폼마다 data-id를 작업 단위로 나눈다(쓰던 글 되살리기가 칸 이름이 같은 다른 폼으로 번지지 않게). 쓰기는 모두 인물 문서 판(revision)이 맞아야 한다.
const P_STATUS={submitted:'접수 · 검토 전',needs_materials:'손님 자료 보완 기다림',rights_pending:'당사자 동의 확인 중',reviewing:'검토 중',quote_review:'손님 견적 확인 기다림',reference_making:'기준 얼굴 만드는 중',reference_review:'손님 기준 얼굴 확인 기다림',building:'학습 · 검증 · 동작 시안 준비',motion_review:'손님 동작 시안 확인 기다림',ready:'준비 끝',withdrawn:'거둠',retired:'사용 마침'};
const P_KIND={scope:'견적 · 범위',reference:'기준 얼굴',motion:'동작 시안',usage:'이번 광고 사용'},P_PURPOSE={identity:'출연하실 분',mood:'분위기 참고'};
const P_KEEP={once:'이번 광고만',reuse:'다음 광고에도'},P_RELATION={self:'본인',agency:'소속 모델',other:'그 밖의 분'},P_CONSENT={link:'확인 링크',document:'서류'};
const P_USAGE=[['brand','브랜드',80],['product','제품',120],['purpose','광고 목적',200,true],['media','매체',200,true],['regions','지역',120],['period','기간',120,true],['fee','비용',120],['schedule','일정',120],['note','메모',600]];
const P_ACTION={request_materials:['자료 더 요청',[['why','손님에게 보일 이유 한 줄',300,true]]],ask_rights:['당사자 동의 확인으로',[['why','손님에게 보일 이유 한 줄',300,true]]],start_review:['검토 시작',[]],send_quote:['견적 · 범위 보내기',[]],publish_reference:['기준 얼굴 보내기',[]],publish_motion:['동작 시안 보내기',[]],withdraw:['요청 거두기',[['why','손님에게 보일 이유 한 줄',300,true]]],retire:['사용 마침',[]]};
function personaDesk(list,canEdit){return (list||[]).map(p=>personaOne(p,canEdit&&p.canEdit!==false)).join('');}
function personaOne(p,canEdit){
  const en=!!p.locale&&p.locale!=='ko',input=(name,label,max,{area=false,required=false,value='',type='text',attrs=''}={})=>`<label><span>${esc(label)}</span>${area?`<textarea name="${name}" rows="2" maxlength="${max}" ${required?'required':''}>${esc(value)}</textarea>`:`<input type="${type}" name="${name}" value="${esc(value)}" ${type==='text'?`maxlength="${max}"`:''} ${required?'required':''} ${attrs}>`}</label>${en&&['why','scope','note','displayName',...P_USAGE.map(([key])=>key)].includes(name)&&!attrs.includes('data-no-tr')?`<label><span>${esc(label)} · 손님에게 보일 영어</span>${area?`<textarea name="${name}Tr" rows="2" maxlength="${max*2}" lang="en"></textarea>`:`<input name="${name}Tr" maxlength="${max*2}" lang="en">`}</label>`:''}`;
  const form=(action,inner,label,{key=action,main=false}={})=>canEdit?`<form class="desk-persona-form" data-form="desk-persona" data-id="${esc(p.id)}:${esc(key)}" data-persona="${esc(p.id)}" data-persona-action="${action}" data-revision="${p.revision}">${inner}<button type="submit" class="${main?'btn-main':'btn-line'}">${esc(label)}</button></form>`:'';
  const media=item=>String(item.mimeType).startsWith('video/')?`<video src="${esc(item.url)}" controls preload="metadata"></video>`:item.inline===false||!String(item.mimeType).startsWith('image/')?`<a href="${esc(item.url)}" download>${esc(item.fileName)}</a>`:`<img src="${esc(item.url)}" alt="">`;
  const req=p.request||{},asked=[['원하는 인상 · 참고할 점',req.look],['쓰임',req.use],['기간',P_KEEP[req.keep]],...(p.kind==='real'?[['관계',P_RELATION[req.relation]],['동의 확인 방법',P_CONSENT[req.consentWay]]]:[])].filter(([,value])=>value);
  const current=p.revisions.find(revision=>revision.id===p.currentRevisionId);
  // 판 파일 올리기: 새 판(또는 손님 확인 전 공개 판)에는 기준 얼굴 그림, 손님이 기준 얼굴을 확인한 지금 판에는 동작 시안 영상(서버 assertAssetUpload와 같은 조건).
  const roles=revision=>[...(revision.status==='draft'||revision.status==='published'&&!revision.referenceApproved&&['reference_review','reference_making'].includes(p.status)?[['reference','기준 얼굴 그림(PNG · JPEG)']]:[]),...(revision.id===p.currentRevisionId&&revision.referenceApproved&&['building','motion_review'].includes(p.status)?[['motion','동작 시안 영상(MP4 · WebM)']]:[])];
  const shown=revision=>new Set([...(revision.sent||[]),...(revision.reference?.assetIds||[]),...(revision.motion?.assetIds||[])]);
  const revisionView=revision=>{const allowed=canEdit?roles(revision):[],sent=shown(revision);return `<li><div><b>${revision.number}판 · ${esc({draft:'만드는 중',published:'보낸 판',superseded:'지난 판'}[revision.status]||revision.status)}${revision.referenceApproved?' · 손님이 기준 얼굴 확인':''}</b>${revision.method?`<small>방식 ${esc({reference:'참조 그림',lora:'LoRA 학습',other:'그 밖'}[revision.method.kind]||revision.method.kind)}${revision.method.base?` · ${esc(revision.method.base)}`:''}</small>`:''}${revision.reference?`<small>기준 얼굴 보냄 ${esc(mailAt(revision.reference.publishedAt))}${revision.reference.note?` · ${esc(revision.reference.note)}`:''}</small>`:''}${revision.motion?`<small>동작 시안 보냄 ${esc(mailAt(revision.motion.publishedAt))}${revision.motion.note?` · ${esc(revision.motion.note)}`:''}</small>`:''}
      ${revision.assets.length?`<div class="contact is-wide desk-persona-media">${revision.assets.map(item=>`<figure>${media(item)}<figcaption>${esc(item.role==='motion'?'동작 시안':'기준 얼굴')} · ${esc(item.fileName)}${sent.has(item.id)?' · 손님에게 보냄':''}</figcaption>${canEdit&&!sent.has(item.id)&&revision.status!=='superseded'?form('remove_asset',`<input type="hidden" name="revisionId" value="${esc(revision.id)}"><input type="hidden" name="assetId" value="${esc(item.id)}">`,'이 파일 지우기',{key:'remove:'+item.id}):''}</figure>`).join('')}</div>`:''}
      ${allowed.length?`<form class="desk-persona-form" data-form="desk-persona-asset" data-id="${esc(p.id)}:asset:${esc(revision.id)}" data-persona="${esc(p.id)}" data-revision-id="${esc(revision.id)}" data-revision="${p.revision}"><label><span>올릴 것</span><select name="role">${allowed.map(([value,label])=>`<option value="${value}">${esc(label)}</option>`).join('')}</select></label><label><span>파일</span><input type="file" name="file" accept="image/png,image/jpeg,video/mp4,video/webm" required></label><button type="submit" class="btn-line">판에 올리기</button></form>`:''}
      ${canEdit&&revision.status!=='superseded'?`<details class="desk-persona-more"><summary>만드는 방식 적기(내부)</summary>${form('set_method',`<input type="hidden" name="revisionId" value="${esc(revision.id)}"><label><span>방식</span><select name="kind">${[['reference','참조 그림'],['lora','LoRA 학습'],['other','그 밖']].map(([value,label])=>`<option value="${value}" ${revision.method?.kind===value?'selected':''}>${label}</option>`).join('')}</select></label>${input('base','바탕 모델 · 도구(내부)',120,{value:revision.method?.base||'',attrs:'data-no-tr'})}${input('note','메모(내부)',600,{area:true,value:revision.method?.note||'',attrs:'data-no-tr'})}`,'방식 저장',{key:'method:'+revision.id})}</details>`:''}</div></li>`;};
  // 전이마다 칸: 견적은 값 · 기간 · 수정 · 범위, 기준 얼굴은 보낼 판(그림이 있는 새 판 · 손님 확인 전 판), 동작 시안은 지금 판(영상이 있을 때).
  const sendable=p.revisions.filter(revision=>revision.status!=='superseded'&&!revision.referenceApproved&&revision.assets.some(item=>item.role==='reference'&&String(item.mimeType).startsWith('image/')));
  // 굵은 단추는 저희 차례에 앞으로 가는 일 하나뿐이다(손님이 보는 중에 다시 보내는 일은 가는 단추 · 「다시」).
  const ahead={send_quote:'reviewing',publish_reference:'reference_making',publish_motion:'building'};
  const transition=action=>{
    const [label,fields]=P_ACTION[action]||[action,[]],main=ahead[action]===p.status,again=!!ahead[action]&&!main;
    if(action==='send_quote')return form(action,`${input('price','인물 제작 값(원)',12,{required:true,type:'number',value:p.quote?.price??'',attrs:'min="0" max="100000000" step="1000"'})}${input('days','기간(일)',3,{required:true,type:'number',value:p.quote?.days??'',attrs:'min="1" max="120" step="1"'})}${input('revisions','수정 횟수',1,{required:true,type:'number',value:p.quote?.revisions??2,attrs:'min="0" max="9" step="1"'})}${input('scope','만들 범위(손님에게 보여요)',600,{area:true,required:true,value:p.quote?.scope||''})}`,p.quote?'견적 고쳐 다시 보내기':label,{main});
    if(action==='publish_reference'){if(!sendable.length)return `<p class="desk-at">기준 얼굴 그림을 판에 먼저 올려 주세요.</p>`;return form(action,`<label><span>보낼 판</span><select name="revisionId">${sendable.map(revision=>`<option value="${esc(revision.id)}">${revision.number}판</option>`).join('')}</select></label>${input('note','손님에게 보일 설명',600,{area:true})}`,again?'기준 얼굴 다시 보내기':label,{main});}
    if(action==='publish_motion'){if(!current?.assets.some(item=>item.role==='motion'))return `<p class="desk-at">동작 시안 영상을 지금 판에 먼저 올려 주세요.</p>`;return form(action,`<input type="hidden" name="revisionId" value="${esc(current.id)}">${input('note','되는 표현과 한계(손님에게 보여요)',600,{area:true})}`,again?'동작 시안 다시 보내기':label,{main});}
    return form(action,fields.map(([name,text,max,required])=>input(name,text,max,{required})).join(''),label);
  };
  const usage=p.usage;
  return `<section class="desk-persona" data-persona-id="${esc(p.id)}"><h2 class="desk-h">맞춤 인물 · ${p.kind==='real'?'실제 인물':'새 가상 인물'}${p.displayName?` · ${esc(p.displayName)}`:''} · ${esc(P_STATUS[p.status]||p.status)}${p.step?` <span class="mono">${p.step}/7</span>`:''}</h2>
    <p class="desk-sum"><i class="led ${['quote_review','reference_review','motion_review','needs_materials'].includes(p.status)||p.status==='ready'&&usage&&!p.usageDone?'is-wait':p.usageDone||p.status==='retired'?'is-ok':'is-wait'}"></i> ${esc(p.next)}</p>
    ${p.why?`<p class="desk-at">손님에게 보이는 이유: ${esc(p.why)}</p>`:''}
    ${asked.length?`<dl class="kv">${asked.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`:''}
    <h3 class="desk-h">손님 사진 <span class="mono">${p.sources.length}</span></h3>${p.sources.length?`<div class="contact is-wide desk-persona-media">${p.sources.map(item=>`<figure>${media(item)}<figcaption>${esc(P_PURPOSE[item.purpose]||item.purpose)} · ${esc(item.fileName)}</figcaption></figure>`).join('')}</div>`:'<p class="desk-at">아직 없어요. 손님은 고객 방 인물 칸에서 보낼 수 있어요.</p>'}
    ${p.quote?`<h3 class="desk-h">견적</h3><p class="desk-sum">${esc(won(p.quote.price))} · ${p.quote.days}일 · 수정 ${p.quote.revisions}회 · ${esc(mailAt(p.quote.at))}</p><p>${esc(p.quote.scope)}</p>`:''}
    <h3 class="desk-h">판 <span class="mono">${p.revisions.length}</span></h3>${p.revisions.length?`<ul class="checks desk-persona-revisions">${p.revisions.map(revisionView).join('')}</ul>`:'<p class="desk-at">아직 판이 없어요. 견적을 손님이 확인하면 새 판을 열어 기준 얼굴을 올려요.</p>'}${p.canOpenRevision?form('open_revision','','새 판 열기'):''}
    ${p.approvals.length?`<h3 class="desk-h">손님 확인 기록</h3><ul class="checks">${p.approvals.map(item=>`<li><i class="led ${item.decision==='approve'?'is-ok':'is-wait'}"></i><div><b>${esc(P_KIND[item.kind]||item.kind)} · ${item.decision==='approve'?'승인':'고칠 점'}${item.revisionId?` · ${p.revisions.find(revision=>revision.id===item.revisionId)?.number||'?'}판`:''}</b><small>${esc(mailAt(item.at))} · ${esc(item.actorName||'손님')} · 초대 링크${item.note?` · ${esc(item.note)}`:''}</small></div></li>`).join('')}</ul>`:''}
    <h3 class="desk-h">이번 광고 사용 범위</h3>${usage?`<dl class="kv">${P_USAGE.filter(([key])=>usage[key]).map(([key,label])=>`<div><dt>${esc(label)}</dt><dd>${esc(usage[key])}</dd></div>`).join('')}</dl><p class="desk-at">${p.usageDone?'손님이 이번 광고 사용을 확인했어요 — 제작 설계에 인물이 붙었어요.':'손님 확인을 기다려요. 범위를 고치면 다시 확인받아요.'}</p>`:`<p class="desk-at">${p.step>=3&&!['withdrawn','retired'].includes(p.status)?'아직 정하지 않았어요. 아래에서 적어 손님에게 보내요(손님이 확인해야 제작 설계에 인물이 붙어요).':'아직 정하지 않았어요. 견적을 보낸 뒤 적을 수 있어요.'}</p>`}
    ${canEdit&&p.step>=3&&!['withdrawn','retired'].includes(p.status)?`<details class="desk-persona-more"><summary>${usage?'사용 범위 고쳐 보내기':'사용 범위 적어 보내기'}</summary>${form('set_usage',P_USAGE.map(([name,label,max,required])=>input(name,label+(required?' · 꼭':''),max,{area:name==='note',required,value:usage?.[name]||''})).join(''),'손님에게 보내기')}</details>`:''}
    ${canEdit&&p.actions.length?`<h3 class="desk-h">다음 단계</h3><div class="desk-persona-actions">${p.actions.map(transition).join('')}</div>`:''}
    ${canEdit?`<details class="desk-persona-more"><summary>이름 · 내부 메모</summary>${form('set_name',input('displayName','손님에게 보일 인물 이름',40,{value:p.displayName}),'이름 저장')}${form('note',input('text','내부 메모(손님에게 안 보여요)',1000,{area:true,value:p.staffNote}),'메모 저장')}</details>`:''}
    ${p.kind==='real'?'<p class="desk-at">실제 인물 — 당사자 확인 쪽은 실제 인물 출연을 켤 때 열어요. 동의 증빙은 서버의 암호문 기록(편집 권한)으로만 남겨요.</p>':''}
    ${p.history?.length?`<details class="desk-persona-more"><summary>기록 ${p.history.length}줄</summary><ul class="desk-files">${p.history.slice(-30).reverse().map(entry=>`<li>${esc(mailAt(entry.at))} · ${esc(entry.action)} · ${esc(entry.actorKind==='customer'?'손님':entry.actorKind==='staff'?'직원':'서버')}${entry.from!==entry.to?` · ${esc(P_STATUS[entry.from]||entry.from||'—')} → ${esc(P_STATUS[entry.to]||entry.to)}`:''}</li>`).join('')}</ul></details>`:''}
  </section>`;
}
const ROUND_STATE=round=>round.approvedAt?'확인 끝':round.feedbackAt?`의견 ${round.changes||0}개`:'고객이 보는 중';
// 결제 · 크몽(판 4): 손님이 크몽에서 접수 번호로 문의 → 담당자가 안전결제요청 → 결제 확인. 장면 이미지 판 · 시안은 결제 확인 뒤에만 보낸다(서버 문턱).
const won=value=>Number.isSafeInteger(value)?(value%10000===0?`${value/10000}만원`:`${value.toLocaleString('ko-KR')}원`):'';
function paymentBlock(r){
  // 결제 상태를 아는 서버(paymentFlow)에서만 — 옛 서버에는 결제 동작이 없다.
  if(!r.paymentFlow||!r.confirmed&&r.status!=='confirmed')return '';
  const p=r.payment;
  const state=!p?(r.payWaiting?'손님 화면에 결제 안내가 떠 있어요 · 크몽 문의(접수 번호)가 오면 결제 요청을 보내요':'결제 안내 전 · 손님이 글 콘티(사진은 첫 장)를 승인하면 결제 안내가 떠요'):p.status==='requested'?`크몽 결제 요청 보냄 · ${won(p.amount)} · ${mailAt(p.requestedAt)}`:p.status==='confirmed'?`결제 확인 · ${mailAt(p.confirmedAt)}${p.ref?` · ${p.ref}`:''}${p.dueDate?` · 받으실 날 ${p.dueDate}`:''}`:`결제 취소 · ${mailAt(p.cancelledAt)}${p.note?` · ${p.note}`:''}`;
  const buttons=p?.status==='confirmed'?line('결제 취소 적기','desk-pay-cancel'):line(p?.status==='requested'?'결제 요청 다시 적기':'크몽에 결제 요청 보냄','desk-pay-request')+line('결제 확인','desk-pay-confirm')+(p?.status==='requested'?line('결제 취소 적기','desk-pay-cancel'):'');
  return `<section class="desk-pay"><h2>결제 · 크몽</h2><p class="desk-sum"><i class="led ${p?.status==='confirmed'?'is-ok':'is-wait'}"></i> ${esc(state)}</p><p class="desk-at">장면 이미지 판과 시안은 결제를 확인한 뒤에 보내요. 크몽에서는 손님 문의(접수 번호)에 안전결제요청을 보내고, 결제가 들어오면 「결제 확인」을 눌러요.</p><div class="desk-pay-act">${buttons}</div></section>`;
}
function actions(r){
  if(r.canEdit===false)return '<p class="desk-sum">이 프로젝트는 보기만 할 수 있어요.</p>';
  if(r.status==='retired')return '<p class="desk-sum">보존 기한이 끝나 자료를 지운 의뢰예요.</p>';
  if(!r.confirmed)return line('빠진 것 다시 묻기','desk-ask')+line('모델 제안하기','desk-propose')+main('확인 끝, 1차안 만들기로','desk-confirm');
  const last=r.rounds?.at(-1),d=r.direction,decided=!d||['chosen','settled'].includes(d.status),waitingDirection=r.canDirect&&!d;
  // 영상 전 확인 1/3은 방향과 모델이다. 방향을 정하기 전에는 1차안 보내기를 띄우지 않는다(옛 프로젝트 · 사진 상품은 그대로).
  const direction=r.canSettle?main('손님과 정한 안으로 정리','desk-settle'):r.canDirect?(d?.status==='open'?line('방향 고쳐 보내기','desk-direction'):main(d?'두 번째 방향 보내기':'방향 제안 보내기','desk-direction')):'';
  return direction+(r.needsModel?line('모델 제안하기','desk-propose'):'')+line('빠진 것 다시 묻기','desk-ask')+line('장면 구성 열기','tab','data-tab="storyboard"')+(last?.approvedAt&&last.kind==='images'||!decided||waitingDirection?'':main(r.rounds?.length?'새 판 보내기':'1차안 보내기','desk-send'));
}
export function deskView(r,{bar=true,top=''}={}){
  const note=r.note,proposal=r.modelProposal,proposalText=proposal&&({open:'고객 답을 기다려요',accepted:'고객이 정했어요',declined:'다른 모델을 바라요',replaced:'방향 제안으로 넘김'}[proposal.status]||'');
  return `<div class="desk">
    ${bar?'<header class="desk-bar"><img src="./assets/brand-pulse.webp" alt="SYNK PULSE" width="154" height="41"><span class="mono">STUDIO DESK</span></header>':''}
    <div class="desk-grid">
      <nav class="desk-list" aria-label="새 의뢰"><h2>새 의뢰 <span class="mono">${r.queue.length}</span></h2>${r.queue.map((item,i)=>`<button type="button" class="desk-item ${(item.id?item.id===r.id:i===0)?'is-on':''}" ${item.id?`data-action="open-project" data-id="${esc(item.id)}"`:''}><b>${esc(item.title)}</b><small>${esc(item.meta)}</small><span class="desk-state ${item.tone||''}">${esc(item.state)}</span></button>`).join('')}</nav>
      <div class="desk-brief">${top}<p class="desk-kicker">${esc(r.number)} · ${esc(r.at)}</p><h1>${esc(r.title)}</h1>
        ${r.contact?`<p class="desk-contact">${esc(r.contact)}</p>`:''}
        ${mailBlock(r.mail)}
        ${r.links===false?'':'<p class="desk-links"><button type="button" class="btn-text" data-action="tab" data-tab="strategy">제작 설계</button><button type="button" class="btn-text" data-action="tab" data-tab="storyboard">장면 구성</button><button type="button" class="btn-text" data-action="tab" data-tab="review">영상 확인</button><button type="button" class="btn-text" data-action="tab" data-tab="manage">프로젝트 관리</button></p>'}
        <dl class="kv">${r.brief.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
        <h2 class="desk-h">받은 자료</h2><div class="contact is-wide">${r.files.map(file=>`<figure><img src="${esc(file.src)}" alt=""><figcaption>${esc(file.label)}${file.size?`<small>${esc(file.size)}</small>`:''}</figcaption></figure>`).join('')}</div>
        ${r.staffFiles?.length?`<h2 class="desk-h">저희가 올린 그림</h2><div class="contact is-wide">${r.staffFiles.map(file=>`<figure><img src="${esc(file.src)}" alt=""><figcaption>${esc(file.label)}</figcaption></figure>`).join('')}</div>`:''}
        ${r.attachments?.length?`<h2 class="desk-h">내려받는 자료</h2><ul class="desk-files">${r.attachments.map(file=>`<li><a href="${esc(file.url)}" download>${esc(file.label)}</a></li>`).join('')}</ul>`:''}${personaDesk(r.personas,r.canEdit!==false)}${translationBlock(r.translation,r.canEdit!==false)}
      </div>
      <aside class="desk-side">
        <section><h2>자동 점검</h2><ul class="checks">${r.checks.map(item=>`<li><i class="led ${item.ok?'is-ok':'is-wait'}"></i><div><b>${esc(item.label)}</b>${item.note?`<small>${esc(item.note)}</small>`:''}</div></li>`).join('')}</ul></section>
        ${note?`<section><h2>${esc(note.by)} 1차 확인 <span class="desk-at">${esc(note.at)}</span></h2><p class="desk-sum">${esc(note.summary)}</p>${note.lines?.length?`<h3>한 문장 후보</h3><ol class="lines">${note.lines.map(item=>`<li>${esc(item)}</li>`).join('')}</ol>`:''}${note.model?`<h3>모델</h3><p>${esc(note.model)}</p>`:''}${note.ref?`<h3>뼈대 원본 후보</h3><p>${esc(note.ref)}</p>`:''}${note.risks?.length?`<h3>걸리는 것</h3><ul class="risks">${note.risks.map(risk=>`<li>${esc(risk)}</li>`).join('')}</ul>`:''}</section>`:'<section><h2>1차 확인</h2><p class="desk-sum">자동 확인 메모는 들어오는 대로 여기에 보여요. 기다리지 않고 바로 보셔도 돼요.</p></section>'}
        ${r.asks?.length?`<section><h2>되물은 것</h2><ul class="checks">${r.asks.map(ask=>`<li><i class="led ${ask.status==='answered'?'is-ok':'is-wait'}"></i><div><b>${esc(ask.label)}</b><small>${esc(ask.status==='answered'?(ask.answer||ask.fileName||'파일로 답했어요'):'답을 기다려요')}</small></div></li>`).join('')}</ul></section>`:''}
        ${r.direction?`<section><h2>방향 제안 · ${r.direction.round}회차</h2><p class="desk-sum">${esc(r.direction.names.join(' · '))} · ${esc({open:'고객 답을 기다려요',chosen:`고객이 「${r.direction.chosen}」 골랐어요`,settled:`「${r.direction.chosen}」로 정리했어요`,declined:'모두 아니래요'}[r.direction.status]||'')}</p>${r.direction.answer?`<p>${esc(r.direction.answer)}</p>`:''}</section>`:''}
        ${proposal?`<section><h2>모델 제안</h2><p class="desk-sum">${esc(proposal.modelName||proposal.modelId||'')} · ${esc(proposalText)}</p>${proposal.answer?`<p>${esc(proposal.answer)}</p>`:''}</section>`:''}
        ${r.rounds?.length?`<section><h2>보낸 판</h2><ul class="checks">${r.rounds.map(round=>`<li><i class="led ${round.approvedAt?'is-ok':'is-wait'}"></i><div><b>${round.round}판 · ${round.kind==='images'?'장면 이미지':'글 콘티'}</b><small>${esc(ROUND_STATE(round))}</small></div></li>`).join('')}</ul></section>`:''}
        ${paymentBlock(r)}
        <section class="desk-actions">${actions(r)}</section>
      </aside>
    </div>
  </div>`;
}
