import {esc} from './api.mjs';

// 내부 확인 화면: 손님 답을 담당자가 보는 자리. 직원 화면에서만 불러온다(손님이 받는 묶음 · 오프라인 목록에 넣지 않는다).
// 자동 점검 → 1차 확인(도구가 올린 메모) → 사람이 묻기 · 모델 제안 · 확인 끝 · 판 보내기를 고른다.
const arrow='<span class="arw" aria-hidden="true">→</span>';
const line=(label,action,extra='')=>`<button type="button" class="btn-line" data-action="${action}" ${extra}>${esc(label)}</button>`;
const main=(label,action)=>`<button type="button" class="btn-main" data-action="${action}"><span>${esc(label)}</span>${arrow}</button>`;
// 메일 알림 한 줄(판 2): 연결 · 받는 곳 · 순간마다 마지막 상태. 「Gmail에 넘김」까지만 안다 — 도착 · 반송은 founder@ 받은편지함에서 본다.
const MAIL_MOMENT={direction_proposed:'방향 제안',draft_ready:'글 콘티',preview_ready:'영상 확인',final_ready:'납품'};
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
const ROUND_STATE=round=>round.approvedAt?'확인 끝':round.feedbackAt?`의견 ${round.changes||0}개`:'고객이 보는 중';
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
        ${r.attachments?.length?`<h2 class="desk-h">내려받는 자료</h2><ul class="desk-files">${r.attachments.map(file=>`<li><a href="${esc(file.url)}" download>${esc(file.label)}</a></li>`).join('')}</ul>`:''}
      </div>
      <aside class="desk-side">
        <section><h2>자동 점검</h2><ul class="checks">${r.checks.map(item=>`<li><i class="led ${item.ok?'is-ok':'is-wait'}"></i><div><b>${esc(item.label)}</b>${item.note?`<small>${esc(item.note)}</small>`:''}</div></li>`).join('')}</ul></section>
        ${note?`<section><h2>${esc(note.by)} 1차 확인 <span class="desk-at">${esc(note.at)}</span></h2><p class="desk-sum">${esc(note.summary)}</p>${note.lines?.length?`<h3>한 문장 후보</h3><ol class="lines">${note.lines.map(item=>`<li>${esc(item)}</li>`).join('')}</ol>`:''}${note.model?`<h3>모델</h3><p>${esc(note.model)}</p>`:''}${note.ref?`<h3>뼈대 원본 후보</h3><p>${esc(note.ref)}</p>`:''}${note.risks?.length?`<h3>걸리는 것</h3><ul class="risks">${note.risks.map(risk=>`<li>${esc(risk)}</li>`).join('')}</ul>`:''}</section>`:'<section><h2>1차 확인</h2><p class="desk-sum">자동 확인 메모는 들어오는 대로 여기에 보여요. 기다리지 않고 바로 보셔도 돼요.</p></section>'}
        ${r.asks?.length?`<section><h2>되물은 것</h2><ul class="checks">${r.asks.map(ask=>`<li><i class="led ${ask.status==='answered'?'is-ok':'is-wait'}"></i><div><b>${esc(ask.label)}</b><small>${esc(ask.status==='answered'?(ask.answer||ask.fileName||'파일로 답했어요'):'답을 기다려요')}</small></div></li>`).join('')}</ul></section>`:''}
        ${r.direction?`<section><h2>방향 제안 · ${r.direction.round}회차</h2><p class="desk-sum">${esc(r.direction.names.join(' · '))} · ${esc({open:'고객 답을 기다려요',chosen:`고객이 「${r.direction.chosen}」 골랐어요`,settled:`「${r.direction.chosen}」로 정리했어요`,declined:'모두 아니래요'}[r.direction.status]||'')}</p>${r.direction.answer?`<p>${esc(r.direction.answer)}</p>`:''}</section>`:''}
        ${proposal?`<section><h2>모델 제안</h2><p class="desk-sum">${esc(proposal.modelName||proposal.modelId||'')} · ${esc(proposalText)}</p>${proposal.answer?`<p>${esc(proposal.answer)}</p>`:''}</section>`:''}
        ${r.rounds?.length?`<section><h2>보낸 판</h2><ul class="checks">${r.rounds.map(round=>`<li><i class="led ${round.approvedAt?'is-ok':'is-wait'}"></i><div><b>${round.round}판 · ${round.kind==='images'?'장면 이미지':'글 콘티'}</b><small>${esc(ROUND_STATE(round))}</small></div></li>`).join('')}</ul></section>`:''}
        <section class="desk-actions">${actions(r)}</section>
      </aside>
    </div>
  </div>`;
}
