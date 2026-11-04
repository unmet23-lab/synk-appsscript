import {esc} from './api.mjs';

// 내부 확인 화면: 손님 답을 담당자가 보는 자리. 직원 화면에서만 불러온다(손님이 받는 묶음 · 오프라인 목록에 넣지 않는다).
// 자동 점검 → 1차 확인(도구가 올린 메모) → 사람이 묻기 · 모델 제안 · 확인 끝 · 판 보내기를 고른다.
const arrow='<span class="arw" aria-hidden="true">→</span>';
const line=(label,action,extra='')=>`<button type="button" class="btn-line" data-action="${action}" ${extra}>${esc(label)}</button>`;
const main=(label,action)=>`<button type="button" class="btn-main" data-action="${action}"><span>${esc(label)}</span>${arrow}</button>`;
const ROUND_STATE=round=>round.approvedAt?'확인 끝':round.feedbackAt?`의견 ${round.changes||0}개`:'고객이 보는 중';
function actions(r){
  if(r.canEdit===false)return '<p class="desk-sum">이 프로젝트는 보기만 할 수 있어요.</p>';
  if(r.status==='retired')return '<p class="desk-sum">보존 기한이 끝나 자료를 지운 의뢰예요.</p>';
  if(!r.confirmed)return line('빠진 것 다시 묻기','desk-ask')+line('모델 제안하기','desk-propose')+main('확인 끝, 1차안 만들기로','desk-confirm');
  const last=r.rounds?.at(-1);
  return (r.needsModel?line('모델 제안하기','desk-propose'):'')+line('빠진 것 다시 묻기','desk-ask')+line('장면 구성 열기','tab','data-tab="storyboard"')+(last?.approvedAt&&last.kind==='images'?'':main(r.rounds?.length?'새 판 보내기':'1차안 보내기','desk-send'));
}
export function deskView(r,{bar=true,top=''}={}){
  const note=r.note,proposal=r.modelProposal,proposalText=proposal&&({open:'고객 답을 기다려요',accepted:'고객이 정했어요',declined:'다른 모델을 바라요'}[proposal.status]||'');
  return `<div class="desk">
    ${bar?'<header class="desk-bar"><img src="./assets/brand-pulse.webp" alt="SYNK PULSE" width="154" height="41"><span class="mono">STUDIO DESK</span></header>':''}
    <div class="desk-grid">
      <nav class="desk-list" aria-label="새 의뢰"><h2>새 의뢰 <span class="mono">${r.queue.length}</span></h2>${r.queue.map((item,i)=>`<button type="button" class="desk-item ${(item.id?item.id===r.id:i===0)?'is-on':''}" ${item.id?`data-action="open-project" data-id="${esc(item.id)}"`:''}><b>${esc(item.title)}</b><small>${esc(item.meta)}</small><span class="desk-state ${item.tone||''}">${esc(item.state)}</span></button>`).join('')}</nav>
      <div class="desk-brief">${top}<p class="desk-kicker">${esc(r.number)} · ${esc(r.at)}</p><h1>${esc(r.title)}</h1>
        ${r.contact?`<p class="desk-contact">${esc(r.contact)}</p>`:''}
        ${r.links===false?'':'<p class="desk-links"><button type="button" class="btn-text" data-action="tab" data-tab="strategy">제작 설계</button><button type="button" class="btn-text" data-action="tab" data-tab="storyboard">장면 구성</button><button type="button" class="btn-text" data-action="tab" data-tab="review">영상 확인</button><button type="button" class="btn-text" data-action="tab" data-tab="manage">프로젝트 관리</button></p>'}
        <dl class="kv">${r.brief.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
        <h2 class="desk-h">받은 자료</h2><div class="contact is-wide">${r.files.map(file=>`<figure><img src="${esc(file.src)}" alt=""><figcaption>${esc(file.label)}${file.size?`<small>${esc(file.size)}</small>`:''}</figcaption></figure>`).join('')}</div>
        ${r.attachments?.length?`<h2 class="desk-h">내려받는 자료</h2><ul class="desk-files">${r.attachments.map(file=>`<li><a href="${esc(file.url)}" download>${esc(file.label)}</a></li>`).join('')}</ul>`:''}
      </div>
      <aside class="desk-side">
        <section><h2>자동 점검</h2><ul class="checks">${r.checks.map(item=>`<li><i class="led ${item.ok?'is-ok':'is-wait'}"></i><div><b>${esc(item.label)}</b>${item.note?`<small>${esc(item.note)}</small>`:''}</div></li>`).join('')}</ul></section>
        ${note?`<section><h2>${esc(note.by)} 1차 확인 <span class="desk-at">${esc(note.at)}</span></h2><p class="desk-sum">${esc(note.summary)}</p>${note.lines?.length?`<h3>한 문장 후보</h3><ol class="lines">${note.lines.map(item=>`<li>${esc(item)}</li>`).join('')}</ol>`:''}${note.model?`<h3>모델</h3><p>${esc(note.model)}</p>`:''}${note.ref?`<h3>뼈대 원본 후보</h3><p>${esc(note.ref)}</p>`:''}${note.risks?.length?`<h3>걸리는 것</h3><ul class="risks">${note.risks.map(risk=>`<li>${esc(risk)}</li>`).join('')}</ul>`:''}</section>`:'<section><h2>1차 확인</h2><p class="desk-sum">자동 확인 메모는 들어오는 대로 여기에 보여요. 기다리지 않고 바로 보셔도 돼요.</p></section>'}
        ${r.asks?.length?`<section><h2>되물은 것</h2><ul class="checks">${r.asks.map(ask=>`<li><i class="led ${ask.status==='answered'?'is-ok':'is-wait'}"></i><div><b>${esc(ask.label)}</b><small>${esc(ask.status==='answered'?(ask.answer||ask.fileName||'파일로 답했어요'):'답을 기다려요')}</small></div></li>`).join('')}</ul></section>`:''}
        ${proposal?`<section><h2>모델 제안</h2><p class="desk-sum">${esc(proposal.modelName||proposal.modelId||'')} · ${esc(proposalText)}</p>${proposal.answer?`<p>${esc(proposal.answer)}</p>`:''}</section>`:''}
        ${r.rounds?.length?`<section><h2>보낸 판</h2><ul class="checks">${r.rounds.map(round=>`<li><i class="led ${round.approvedAt?'is-ok':'is-wait'}"></i><div><b>${round.round}판 · ${round.kind==='images'?'장면 이미지':'글 콘티'}</b><small>${esc(ROUND_STATE(round))}</small></div></li>`).join('')}</ul></section>`:''}
        <section class="desk-actions">${actions(r)}</section>
      </aside>
    </div>
  </div>`;
}
