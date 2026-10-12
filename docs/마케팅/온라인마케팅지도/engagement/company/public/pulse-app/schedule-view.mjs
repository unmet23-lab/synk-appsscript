import {esc} from './api.mjs';

const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
const scheduleLink=project=>typeof project?.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(project.id)?`/?tab=workroom&amp;section=clients&amp;project=${encodeURIComponent(project.id)}&amp;schedule=1`:'';

// Internal dates and estimates stay on the staff surface. This summary never
// copies a plan into customer-facing promises or changes a project record.
export function scheduleView(s){
  if(s.mode!=='staff'||s.demo)return '';
  const p=s.project,plan=p?.schedule;if(!plan)return '';
  const href=scheduleLink(p);
  if(!plan.enabled)return plan.canEdit&&p.stage!=='archived'&&href?`<aside class="schedule-setup"><span>제작 일정과 확인 대기일을 정해 두면 늦어진 항목을 함께 볼 수 있어요.</span><a class="button quiet small-button" href="${href}" target="_blank" rel="noopener noreferrer">제작 일정 점검 설정 ↗</a></aside>`:'';
  const pending=count(plan.pendingCount),workDays=count(plan.remainingWorkDays),archived=p.stage==='archived'||plan.status==='archived';
  return `<section class="schedule-summary" aria-labelledby="schedule-summary-title"><header><div><span class="eyebrow">STAFF SCHEDULE</span><h3 id="schedule-summary-title">제작 일정·확인 지연</h3></div><span class="tag ${!archived&&pending?'berry':''}">${archived?'보관된 일정':pending===null?'확인 상태 불러오기 필요':'오늘 확인 '+pending+'건'}</span></header><dl class="schedule-summary-facts"><div><dt>합의한 납품일</dt><dd>${esc(plan.agreedDueDate||'아직 미확정')}</dd></div><div><dt>남은 제작일</dt><dd>${workDays===null?'아직 미입력':workDays+'일'}</dd></div><div><dt>남은 제작일로 계산한 예상일</dt><dd>${esc(plan.estimatedFinishDate||'아직 계산 전')}</dd></div></dl>${plan.risk?.text?`<p class="schedule-summary-risk">${esc(plan.risk.text)}</p>`:''}<footer><p class="small">${plan.calendarLabel?esc(plan.calendarLabel)+' 기준 · ':''}제작자용 예상입니다. 고객과 합의한 납품일은 자동으로 바뀌지 않습니다.</p>${href?`<a class="button quiet small-button" href="${href}" target="_blank" rel="noopener noreferrer">고객 관리에서 일정 확인 ↗</a>`:''}</footer></section>`;
}
