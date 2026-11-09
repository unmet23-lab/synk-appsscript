import {esc,stamp} from './api.mjs';
import {t,k} from './i18n.mjs';

// 상태 이름은 한국어 값으로 두고 그리는 자리에서 옮긴다(의뢰 흐름 손님은 방 아래 준비 칸에서 이 판을 본다). 바뀐 항목 이름 · 값은 받은 그대로다.
const statusLabels={clean:k('바뀐 것 없음'),pending:k('바뀐 것 확인 필요'),reviewed:k('바뀐 것 확인함'),archived:k('보관된 기록')};
const value=text=>text===null||text===undefined||text===''?t('정한 내용 없음'):Array.isArray(text)?text.join(' · '):String(text);
// 직원 검토 칸 · 고객 관리로 가는 길 · 옛 탭의 「제작 설계 보기」 단추 — 한국어 그대로.
// i18n-skip-start
const staffImpacts=(p,c)=>(c.impacts||[]).map(item=>`<li><div><span class="tag ${item.checked?'green':'berry'}">${item.checked?'검토 완료':'재검토 필요'}</span><strong>${esc(item.label)}</strong><p>${esc(item.reason)}</p>${item.note?`<p class="changes-check-note">검토 기록 · ${esc(item.note)}</p>`:''}</div>${item.kind==='scene'&&p.studio?.scenes?.some(scene=>scene.id===item.sceneId)?`<button type="button" class="button quiet small-button" data-action="changes-scene" data-id="${esc(item.sceneId)}">장면 보기</button>`:''}</li>`).join('');
const staffReview=href=>`<a class="button quiet small-button" href="${href}" target="_blank" rel="noopener noreferrer">고객 관리에서 변경 검토 ↗</a>`;
const LEGACY_STRATEGY='<button type="button" class="button quiet small-button" data-action="changes-strategy">지금 제작 설계 보기</button>';
const STAFF_CHANGES={impacts:'제작자가 다시 확인할 작업',note:'<p class="small">장면·일정·조건 검토는 고객 관리에 남겨요. 일정과 비용은 고객과 상의해 정해요.</p>'};
// i18n-skip-end

export function changesView(s,{room=false}={}){
  const p=s.project,c=p?.changes;if(!c?.enabled)return '';
  const staff=s.mode==='staff',archived=p.stage==='archived'||c.status==='archived';
  const changes=(c.changes||[]).map(item=>`<article class="changes-item"><h4>${esc(item.label)}</h4><dl class="changes-comparison"><div><dt>${esc(t('확인했을 때'))}</dt><dd>${esc(value(item.before))}</dd></div><div><dt>${esc(t('지금'))}</dt><dd>${esc(value(item.after))}</dd></div></dl></article>`).join('');
  const impacts=staff?staffImpacts(p,c):'';
  const staffLink=`/?tab=workroom&amp;section=clients&amp;project=${encodeURIComponent(p.id)}&amp;changes=1`;
  return `<section class="changes-card panel-card" aria-labelledby="changes-title"><div class="changes-heading"><div><span class="eyebrow ko">${esc(t('확인 뒤 바뀐 내용'))}</span><h3 id="changes-title">${esc(t('확인한 뒤 바뀐 것'))}</h3></div><span class="tag ${['clean','reviewed'].includes(c.status)?'green':'berry'}">${esc(statusLabels[c.status]?t(statusLabels[c.status]):t('바뀐 것 보는 중'))}</span></div><p class="changes-intro">${esc(archived?t('보관된 프로젝트의 기록이에요.'):t('확인했을 때와 지금 내용을 나란히 보여 드려요. 바뀐 제작 설계는 다시 확인해 주세요.'))}</p><div class="changes-baseline"><span>${esc(t('확인한 때 · {date}',{date:c.baseline?.at?stamp(c.baseline.at):t('아직 없음')}))}</span></div><p class="changes-confirmation"><span class="tag ${c.currentStrategyConfirmed?'green':'berry'}">${esc(c.currentStrategyConfirmed?t('지금 제작 설계 확인함'):t('지금 제작 설계 확인 전'))}</span></p><div class="changes-list">${changes||`<p class="small">${esc(t('확인했을 때와 달라진 것이 없어요.'))}</p>`}</div>${impacts?`<details class="changes-impacts" open><summary>${STAFF_CHANGES.impacts}</summary><ul>${impacts}</ul></details>`:''}<div class="button-row">${staff?staffReview(staffLink):''}${!archived&&!room?LEGACY_STRATEGY:''}</div>${staff?STAFF_CHANGES.note:''}</section>`;
}
