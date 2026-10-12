import {randomUUID} from 'node:crypto';
import {clientFollowUpToday} from './client-projects.mjs';
import {applyClientKickoffAction} from './client-kickoff.mjs';
import {applyClientScheduleAction} from './client-schedule.mjs';
import {applyDeliverableAction} from './pulse-deliverables.mjs';
import {emptyPulseStudio} from './pulse-studio.mjs';
import {startupTemplateDraft,startupTemplateShift} from './client-startup-templates.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,allowed)=>{if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw fail('시작 설정의 입력 항목을 확인해 주세요.');};
const sections=['kickoff','schedule','deliverables'];
const calendarLabels={weekdays:'평일(월~금, 공휴일 미반영)',calendar:'달력일'};
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const required=label=>({label,required:true});
const presets=[
  {id:'short_ad',label:'숏폼 광고',description:'세로형 광고 1편을 시작할 때 필요한 자료와 내부 일정 초안입니다.',offsets:[0,2,3,4,5],requirements:['브랜드 로고·표기 기준','제품·서비스 원본 자료','전달할 핵심 문구·근거','유도할 행동·연결 주소'],item:{label:'숏폼 광고',platform:'instagram',placement:'릴스',durationSeconds:30,aspectRatio:'9:16'}},
  {id:'product_intro',label:'제품 소개',description:'제품 소개 영상 1편의 자료와 내부 일정 초안입니다.',offsets:[0,3,4,6,7],requirements:['브랜드 로고·표기 기준','제품 사진·영상 원본','제품 특징·확인 가능한 근거','사용 설명·필수 표기'],item:{label:'제품 소개 영상',platform:'website',placement:'제품 소개 페이지',durationSeconds:60,aspectRatio:'16:9'}},
  {id:'interview',label:'인터뷰',description:'인터뷰 영상 1편의 자료와 내부 일정 초안입니다.',offsets:[0,4,5,7,8],requirements:['인터뷰 촬영 영상·음성 원본','출연자 이름·직함 표기','인터뷰 질문·전달할 내용','초상·음성 사용 동의 확인 자료'],item:{label:'인터뷰 영상',platform:'youtube',placement:'일반 영상',durationSeconds:180,aspectRatio:'16:9'}}
];

function shift(date,offset,calendar){
  let at=Date.parse(date+'T00:00:00Z');
  // A weekend reference means the next working day when weekdays are selected.
  if(calendar==='weekdays')while([0,6].includes(new Date(at).getUTCDay()))at+=86400000;
  for(let remaining=offset;remaining>0;){at+=86400000;if(calendar==='calendar'||![0,6].includes(new Date(at).getUTCDay()))remaining--;}
  const result=new Date(at).toISOString().slice(0,10);if(!validDate(result))throw fail('기준일로부터 계산할 수 있는 날짜 범위를 확인해 주세요.');return result;
}
function setupSections(row){
  const deliverables=row.studio?.deliverables;
  const usedDeliverables=deliverables!==undefined&&(!object(deliverables)||Object.keys(deliverables).some(key=>!['revision','items','notes','request','confirmation','links','history'].includes(key))||deliverables.revision!==0||deliverables.items?.length||deliverables.notes||deliverables.request||deliverables.confirmation||deliverables.links?.length||deliverables.history?.length);
  const used={kickoff:row.kickoffPlan!==undefined,schedule:row.schedulePlan!==undefined,deliverables:!!usedDeliverables||!!row.studio&&row.studio.schemaVersion!==1};
  const reasons={kickoff:'기존 착수 자료·확인 기록을 보존합니다. 변경은 착수 점검에서 해 주세요.',schedule:'기존 내부 일정 설정을 보존합니다. 변경은 일정 점검에서 해 주세요.',deliverables:'기존 PULSE 납품 규격을 보존합니다. 변경은 PULSE에서 해 주세요.'};
  return Object.fromEntries(sections.map(key=>[key,{available:!used[key],reason:used[key]?reasons[key]:''}]));
}
function argumentsFor(input){
  const preset=presets.find(value=>value.id===input.presetId);if(!preset)throw fail('프로젝트 시작 유형을 선택해 주세요.');
  if(!validDate(input.referenceDate)||!Object.hasOwn(calendarLabels,input.calendar))throw fail('시작 기준일과 날짜 계산 방식을 확인해 주세요.');
  return preset;
}
function draftFor(preset,referenceDate,calendar){
  const targets=Object.fromEntries(['kickoff','preview','customer','revision','delivery'].map((key,i)=>[key,shift(referenceDate,preset.offsets[i],calendar)]));
  return {kickoff:{enabled:true,dueDate:targets.kickoff,requirements:preset.requirements.map(required)},schedule:{enabled:true,calendar,targets,remainingWorkDays:null,customerWaitDays:2,internalReviewDays:1},deliverables:{items:[{...preset.item,kind:'video',language:'한국어',subtitles:'',fileFormat:'MP4',quantity:1,notes:''}],notes:'시작 유형으로 준비한 납품 규격 초안입니다. 제작 범위와 고객 확인 후 확정해 주세요.'}};
}

// Initial setup writes the existing authoritative project once. No agreement,
// source material, approval, completion or customer message is manufactured.
export function createClientStartupService({store,clientProjects,templates=null,clock=()=>new Date().toISOString()}){
  function currentProject(user,id){return clientProjects.project(user,id,true);}
  function revision(row,value){if(!Number.isSafeInteger(value)||value!==row.revision)throw fail('프로젝트가 변경되었습니다. 최신 내용을 불러온 뒤 다시 준비해 주세요.',409);}
  function selectedPreset(user,input){
    if(typeof input.presetId==='string'&&input.presetId.startsWith('template:')){
      if(!templates||!validDate(input.referenceDate)||!Object.hasOwn(calendarLabels,input.calendar)||!Number.isSafeInteger(input.templateRevision)||input.templateRevision<1)throw fail('내 양식의 버전과 시작 기준일을 확인해 주세요.');
      const template=templates.get(user,input.presetId.slice(9),input.templateRevision);return {id:input.presetId,label:template.label,templateRevision:template.revision,configuration:template.configuration};
    }
    if(Object.hasOwn(input,'templateRevision'))throw fail('고정 시작 유형에는 내 양식 버전을 지정할 수 없습니다.');return argumentsFor(input);
  }
  function sectionsFor(row,preset){const availability=setupSections(row);if(preset.configuration)for(const key of sections)if(!Object.hasOwn(preset.configuration.sections,key))availability[key]={available:false,reason:'이 내 양식에 포함되지 않은 영역입니다.'};return availability;}
  function workspace(user,id){const row=currentProject(user,id),personal=templates?templates.list(user).map(template=>({id:'template:'+template.id,label:template.label,description:'내 시작 양식 · 선택한 기준일로 간격을 다시 계산합니다.',templateId:template.id,templateRevision:template.revision,calendar:template.configuration.calendar,templateSections:Object.keys(template.configuration.sections)})):[];return {projectId:row.id,revision:row.revision,presets:[...presets.map(({id,label,description})=>({id,label,description})),...personal],today:clientFollowUpToday(clock()),calendarLabels:{...calendarLabels},sections:setupSections(row)};}
  function preview(user,id,input){
    keys(input,['action','revision','presetId','referenceDate','calendar','templateRevision']);if(input.action!=='preview')throw fail('시작 설정 요청을 확인해 주세요.');
    const row=currentProject(user,id);revision(row,input.revision);const preset=selectedPreset(user,input);
    return {projectId:row.id,revision:row.revision,presetId:preset.id,presetLabel:preset.label,referenceDate:input.referenceDate,calendar:input.calendar,sections:sectionsFor(row,preset),draft:preset.configuration?startupTemplateDraft(preset.configuration,input.referenceDate,input.calendar):draftFor(preset,input.referenceDate,input.calendar),...(preset.configuration?{templateRevision:preset.templateRevision,templateSections:Object.keys(preset.configuration.sections),notes:[input.calendar==='weekdays'?'기준일이 주말이면 다음 평일('+startupTemplateShift(input.referenceDate,0,input.calendar)+')을 기준으로 계산합니다. 공휴일은 반영하지 않습니다.':'입력한 기준일의 달력일 간격으로 계산합니다.','음수 간격은 기준일 이전 일정입니다. 실제 적용 날짜를 확인해 주세요.']}: {})};
  }
  function apply(user,id,input){
    keys(input,['action','revision','presetId','referenceDate','calendar','sections','draft','templateRevision']);if(input.action!=='apply')throw fail('시작 설정 요청을 확인해 주세요.');
    return store.transaction(()=>{
      const row=currentProject(user,id);revision(row,input.revision);const preset=selectedPreset(user,input),availability=sectionsFor(row,preset);
      if(!Array.isArray(input.sections)||!input.sections.length||new Set(input.sections).size!==input.sections.length||input.sections.some(key=>!sections.includes(key)))throw fail('적용할 시작 설정을 중복 없이 선택해 주세요.');
      keys(input.draft,input.sections);if(input.sections.some(key=>!Object.hasOwn(input.draft,key)))throw fail('선택한 시작 설정의 내용을 확인해 주세요.');
      for(const key of input.sections)if(!availability[key].available)throw fail(availability[key].reason,409);
      if(!Number.isSafeInteger(row.revision)||row.revision>=Number.MAX_SAFE_INTEGER)throw fail('프로젝트 버전 한도에 도달했습니다.',409);
      const next=structuredClone(row),at=clock(),actor=store.get('users',user.id);
      if(input.sections.includes('kickoff')){
        const value=input.draft.kickoff;keys(value,['enabled','dueDate','requirements']);if(value.enabled!==true||!Array.isArray(value.requirements))throw fail('적용할 착수 자료 목록을 확인해 주세요.');for(const item of value.requirements)keys(item,['label','required']);
        next.kickoffPlan=applyClientKickoffAction(row,{...value,action:'configure',revision:row.revision},{actor:actor.id,at});
      }
      if(input.sections.includes('schedule')){
        const value=input.draft.schedule;keys(value,['enabled','calendar','targets','remainingWorkDays','customerWaitDays','internalReviewDays']);if(value.enabled!==true||value.calendar!==input.calendar)throw fail('내부 일정의 날짜 계산 방식을 확인해 주세요.');
        next.schedulePlan=applyClientScheduleAction(row,{...value,action:'configure',revision:row.revision},{actor:actor.id,at});
      }
      if(input.sections.includes('deliverables')){
        const value=input.draft.deliverables;keys(value,['items','notes']);if(!Array.isArray(value.items)||!value.items.length)throw fail('납품 규격 초안을 한 개 이상 입력해 주세요.');for(const item of value.items)if(object(item)&&Object.hasOwn(item,'id'))throw fail('시작 설정에 기존 납품 항목을 복사할 수 없습니다.');
        const studio=next.studio||emptyPulseStudio();applyDeliverableAction({studio,row:next,input:{action:'save_deliverables',revision:row.revision,deliverableRevision:0,...value},staff:true,stamp:{author:'staff',authorId:actor.id,authorName:actor.name||'담당자',at}});if(Buffer.byteLength(JSON.stringify(studio),'utf8')>1500000)throw fail('기획 기록 한도에 도달했습니다. 기존 기록을 보존하고 새 프로젝트로 이어가 주세요.',409);next.studio=studio;
      }
      next.revision=row.revision+1;next.updatedAt=at;next.history=[...(row.history||[]),{id:randomUUID(),action:'프로젝트 시작 설정 · '+preset.label,actor:actor.id,at}].slice(-300);
      clientProjects.commitWorkflow(next);
      return {project:clientProjects.workspace(actor).projects.find(project=>project.id===id),applied:{presetId:preset.id,referenceDate:input.referenceDate,calendar:input.calendar,sections:[...input.sections],...(preset.templateRevision?{templateRevision:preset.templateRevision}: {})}};
    });
  }
  function mutate(user,id,input){if(input?.action==='preview')return preview(user,id,input);if(input?.action==='apply')return apply(user,id,input);throw fail('시작 설정 요청을 확인해 주세요.');}
  return {workspace,preview,apply,mutate};
}
