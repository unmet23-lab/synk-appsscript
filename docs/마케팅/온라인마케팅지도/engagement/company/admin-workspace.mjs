import {dateRange, shiftDate, METRICS} from '../analytics.mjs';
import {hasWorkspaceFeature} from './workspace-access.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status,code:'ADMIN_WORKSPACE'});
const stages=['received','planning','producing','review','delivered','archived'];
const stageCounts=()=>Object.fromEntries(stages.map(stage=>[stage,0]));
const kstDate=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));

export function createAdminWorkspace({store,clock=()=>new Date().toISOString(),report,membersFor,channelsFor,workspaceProfiles}){
  const projectAssignments=store.db.prepare(`SELECT json_extract(body,'$.ownerId') AS ownerId,
    json_extract(body,'$.reviewerId') AS reviewerId, json_extract(body,'$.teamId') AS teamId,
    json_extract(body,'$.stage') AS stage FROM documents WHERE kind='clientProjects'`);
  return function readAdminWorkspace(actor,query=new URLSearchParams()){
    const live=actor?.id&&store.get('users',actor.id);
    if(!live?.active||live.role!=='admin')throw fail('관리자만 직원 현황을 확인할 수 있어요.',403);
    if([...query.keys()].some(key=>!['start','end'].includes(key))||['start','end'].some(key=>query.getAll(key).length>1))throw fail('조회할 시작일과 종료일만 선택해 주세요.');
    const asOf=clock(),today=kstDate(asOf),end=query.has('end')?query.get('end'):today;
    // Validate the end date before using it to derive a default start.
    dateRange(end,end);
    const start=query.has('start')?query.get('start'):shiftDate(end,-29);
    dateRange(start,end);
    if(end>today)throw fail('오늘 뒤 날짜는 볼 수 없어요.');

    const result=report(live,new URLSearchParams({start,end}));
    const metricsById=new Map(result.memberGroups.map(row=>[row.id,row]));
    const people=membersFor(live),users=new Map(store.all('users').map(row=>[row.id,row]));
    const channels=channelsFor(live),companyWork=store.all('companyWork'),projects=projectAssignments.all();
    const accepted=new Map();
    for(const row of store.all('workspaceInvites')){
      if(row.status!=='accepted'||!row.userId)continue;
      const before=accepted.get(row.userId);
      if(!before||String(row.acceptedAt||'')>String(before.acceptedAt||''))accepted.set(row.userId,row);
    }

    const members=people.map(member=>{
      const invitation=accepted.get(member.id),group=metricsById.get(member.id);
      const assigned=channels.flatMap(channel=>{
        const owner=channel.ownerIds?.includes(member.id);
        const incoming=channel.pendingHandoff?.toOwnerIds?.includes(member.id);
        if(!owner&&!incoming)return [];
        return [{
          id:channel.id,displayName:channel.displayName||'',platform:channel.platform,
          url:channel.canonicalUrl||'',active:channel.active!==false,status:channel.status||'',
          connected:channel.connected===true,shared:new Set(channel.ownerIds||[]).size>1,
          handoffPending:Boolean(channel.pendingHandoff),relation:owner?'owner':'incoming'
        }];
      });
      const owned=assigned.filter(channel=>channel.relation==='owner');
      const observedChannelCount=group?.channelCount||0;
      const state=observedChannelCount>0?(owned.length?'observed':'historyOnly'):
        !owned.length?'unassigned':!owned.some(channel=>channel.active)?'inactiveOnly':
        owned.some(channel=>channel.active&&channel.connected)?'awaitingObservation':'notConnected';
      const work={PATH:{open:0,done:0},SHIFT:{open:0,done:0},
        PULSE:{owner:stageCounts(),reviewer:stageCounts(),ownerInactive:0,reviewerInactive:0},
        LAB:{available:false}};
      for(const row of companyWork){
        if(row.ownerId===member.id&&['PATH','SHIFT'].includes(row.company)&&['open','done'].includes(row.status))work[row.company][row.status]++;
      }
      const person=users.get(member.id);
      const canWork=person?.active===true&&person.role!=='viewer'&&hasWorkspaceFeature(person,'clients');
      for(const project of projects){
        if(!stages.includes(project.stage))continue;
        if(project.ownerId===member.id){
          if(canWork)work.PULSE.owner[project.stage]++;
          else if(project.stage!=='archived')work.PULSE.ownerInactive++;
        }
        if(project.reviewerId===member.id){
          const canReview=canWork&&person.id!==project.ownerId&&(person.role==='admin'||person.teamId&&person.teamId===project.teamId);
          if(canReview)work.PULSE.reviewer[project.stage]++;
          else if(project.stage!=='archived')work.PULSE.reviewerInactive++;
        }
      }
      return {
        id:member.id,
        invitation:invitation?{id:invitation.id,createdAt:invitation.createdAt||null,acceptedAt:invitation.acceptedAt||null}:null,
        channels:assigned,
        performance:{state,observedChannelCount,metrics:Object.fromEntries(METRICS.map(({key})=>[key,group?.metrics?.[key]??null]))},
        work
      };
    });
    return {asOf,start,end,members,invitations:workspaceProfiles.list(live),invitationHistoryLimit:100,
      definitions:{
        members:result.definitions.members,memberGroupsBasis:result.memberGroupsBasis,
        currentChannels:'채널 목록은 현재 담당과 인계 대기를 구분해 보여 줍니다.',
        work:'업무 건수는 조회 시점에 등록된 상태입니다. 완료 건수는 선택 기간의 실적이 아닌 누적 건수입니다.',
        missing:'확인되지 않은 값은 0이 아닌 미확인으로 표시합니다.',
        history:'담당 당시의 관측을 기준으로 집계합니다. 공동 담당자의 수치를 더하면 중복될 수 있습니다.',
        lab:'LAB 수업 지표는 아직 이 화면에 연결되지 않았습니다.'
      }};
  };
}
