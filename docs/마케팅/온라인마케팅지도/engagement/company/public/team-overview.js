'use strict';

const teamOverview = { key: '', result: null, loading: false, error: '', request: 0 };
function teamOverviewKey() {
  return state.user ? [state.user.id,state.user.role,state.user.teamId||'',state.start,state.end].join(':') : '';
}
function resetTeamOverview() {
  teamOverview.request++;
  Object.assign(teamOverview,{key:'',result:null,loading:false,error:''});
}
async function loadTeamOverview(force = false, { quiet = false } = {}) {
  // Collection polling reloads quietly: no loading paint, and the finished paint keeps the reader's place.
  const paint = quiet && typeof renderBackground === 'function' ? renderBackground : render;
  if (!state.user || !['team','all'].includes(state.scope) || !['overview','analysis'].includes(state.tab) || state.marketingView === 'channels') return;
  const key = teamOverviewKey();
  if (!force && teamOverview.key === key && (teamOverview.result || teamOverview.loading)) return;
  const request = ++teamOverview.request;
  Object.assign(teamOverview,{key,result:null,loading:true,error:''});
  if (!quiet) render();
  try {
    const result = await api('/api/team-overview?' + new URLSearchParams({start:state.start,end:state.end}));
    if (request !== teamOverview.request || key !== teamOverviewKey()) return;
    teamOverview.result = result;
  } catch (error) {
    if (request !== teamOverview.request || key !== teamOverviewKey()) return;
    teamOverview.error = error.message;
  } finally {
    if (request === teamOverview.request && key === teamOverviewKey()) {
      teamOverview.loading = false;
      if (['overview','analysis'].includes(state.tab) && ['team','all'].includes(state.scope)) paint();
    }
  }
}
function teamOverviewSection() {
  if (state.scope !== 'team' || state.tab !== 'overview') return '';
  const visibleTeams = (state.data?.teams||[]).filter(team=>team.active!==false&&(isAdmin()||team.id===state.user?.teamId));
  if (!visibleTeams.length) return '';
  const current = teamOverview.key === teamOverviewKey();
  const result = current ? teamOverview.result : null;
  const teams = (result?.teams||[]).filter(team=>visibleTeams.some(visible=>visible.id===team.id));
  const heading = `<header class="team-comparison-head"><div><h2>팀별 현황</h2><p>같은 기간의 성과를 비교하고, 팀을 눌러 자세히 살펴보세요.</p></div><span>${visibleTeams.length}개 팀</span></header>`;
  const error = current && teamOverview.error;
  const body = error ? `<div class="team-comparison-error" role="status"><p>${escape(error)}</p>${button('다시 불러오기','team-overview-retry','refresh','small')}</div>` : !result ? '<div class="team-comparison-loading" role="status">팀별 성과를 불러오고 있어요.</div>' : teams.length ? `<div class="team-comparison-grid">${teams.map(team=>{
    const views=team.metrics?.views,followers=team.metrics?.followers,selected=state.teamId===team.id;
    return `<button type="button" class="team-comparison-card" data-action="team-overview-select" data-id="${escape(team.id)}" aria-pressed="${selected}" aria-label="${escape(team.name)} 상세 보기"><span class="team-comparison-card-head"><strong>${escape(team.name)}</strong><span class="team-selected">${selected?'선택한 팀':'상세 보기'}${icon('arrow')}</span></span><span class="team-comparison-counts"><span>크루 <b>${number(team.memberCount)}</b>명</span><span>채널 <b>${number(team.channelCount)}</b>개</span><span>연결 <b>${number(team.connectedCount)}/${number(team.channelCount)}</b></span></span><span class="team-comparison-metrics"><span><span class="team-metric-label">누적 조회수</span><strong>${number(views?.latest)}</strong></span><span><span class="team-metric-label">기간 조회수 증감</span><strong>${delta(views?.period?.delta)}</strong></span><span><span class="team-metric-label">팔로워·구독자</span><strong>${number(followers?.latest)}</strong></span></span><span class="team-comparison-foot"><small>${team.channelCount===0?'배정된 채널 없음':validNumber(views?.latest)?`조회수 기록 ${number(views.latestCount)} / ${number(views.eligible)}개 대상`:'성과 수집 대기'}</small></span></button>`;
  }).join('')}</div>` : '<p class="team-comparison-empty">현재 열람할 수 있는 팀이 없어요.</p>';
  return `<section class="team-comparison" aria-label="팀별 현황" aria-busy="${!result&&!error}">${heading}${body}<p class="team-comparison-note">${escape(state.start)} — ${escape(state.end)} · 크루와 채널은 열람 가능한 범위만 표시합니다. —는 미확인 또는 비교 불가입니다.</p></section>`;
}
