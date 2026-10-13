import {randomUUID} from 'node:crypto';
import {clientFollowUpToday} from './client-projects.mjs';
import {applyClientKickoffAction} from './client-kickoff.mjs';
import {applyClientScheduleAction} from './client-schedule.mjs';
import {applyDeliverableAction} from './pulse-deliverables.mjs';
import {emptyPulseStudio} from './pulse-studio.mjs';
import {startupTemplateDraft,startupTemplateShift} from './client-startup-templates.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,allowed)=>{if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw fail('입력 내용을 다시 봐 주세요.');};
const sections=['kickoff','schedule','deliverables'];
const calendarLabels={weekdays:'평일만',calendar:'달력대로'};
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const required=label=>({label,required:true});
const presets=[
  {id:'short_ad',label:'숏폼 광고',description:'세로 광고 한 편에 필요한 자료와 목표일, 납품 규격 초안이에요.',offsets:[0,2,3,4,5],requirements:['브랜드 로고와 표기 기준','제품·서비스 원본 자료','꼭 들어갈 문구와 근거','보고 나서 할 행동과 링크'],item:{label:'숏폼 광고',platform:'instagram',placement:'릴스',durationSeconds:30,aspectRatio:'9:16'}},
  {id:'product_intro',label:'제품 소개',description:'제품 소개 영상 한 편에 필요한 자료와 목표일, 납품 규격 초안이에요.',offsets:[0,3,4,6,7],requirements:['브랜드 로고와 표기 기준','제품 사진·영상 원본','제품 특징과 근거','사용 설명과 꼭 넣을 표기'],item:{label:'제품 소개 영상',platform:'website',placement:'제품 소개 페이지',durationSeconds:60,aspectRatio:'16:9'}},
  {id:'interview',label:'인터뷰',description:'인터뷰 영상 한 편에 필요한 자료와 목표일, 납품 규격 초안이에요.',offsets:[0,4,5,7,8],requirements:['인터뷰 촬영 원본(영상·소리)','출연자 이름과 직함','질문과 전할 내용','얼굴·목소리 사용 동의'],item:{label:'인터뷰 영상',platform:'youtube',placement:'일반 영상',durationSeconds:180,aspectRatio:'16:9'}}
];

function shift(date,offset,calendar){
  let at=Date.parse(date+'T00:00:00Z');
  // A weekend reference means the next working day when weekdays are selected.
  if(calendar==='weekdays')while([0,6].includes(new Date(at).getUTCDay()))at+=86400000;
  for(let remaining=offset;remaining>0;){at+=86400000;if(calendar==='calendar'||![0,6].includes(new Date(at).getUTCDay()))remaining--;}
  const result=new Date(at).toISOString().slice(0,10);if(!validDate(result))throw fail('시작하는 날에서 계산할 수 있는 범위를 넘었어요.');return result;
}
function setupSections(row){
  const deliverables=row.studio?.deliverables;
  const usedDeliverables=deliverables!==undefined&&(!object(deliverables)||Object.keys(deliverables).some(key=>!['revision','items','notes','request','confirmation','links','history'].includes(key))||deliverables.revision!==0||deliverables.items?.length||deliverables.notes||deliverables.request||deliverables.confirmation||deliverables.links?.length||deliverables.history?.length);
  const used={kickoff:row.kickoffPlan!==undefined,schedule:row.schedulePlan!==undefined,deliverables:!!usedDeliverables||!!row.studio&&row.studio.schemaVersion!==1};
  const reasons={kickoff:'이미 있는 자료 목록은 그대로 둬요. 바꾸려면 「필요한 자료」에서 해요.',schedule:'이미 있는 목표일은 그대로 둬요. 바꾸려면 「일정」에서 해요.',deliverables:'이미 있는 납품 규격은 그대로 둬요. 바꾸려면 PULSE에서 해요.'};
  return Object.fromEntries(sections.map(key=>[key,{available:!used[key],reason:used[key]?reasons[key]:''}]));
}
function argumentsFor(input){
  const preset=presets.find(value=>value.id===input.presetId);if(!preset)throw fail('어떤 영상인지 골라 주세요.');
  if(!validDate(input.referenceDate)||!Object.hasOwn(calendarLabels,input.calendar))throw fail('시작하는 날과 날짜 세는 법을 다시 봐 주세요.');
  return preset;
}
function draftFor(preset,referenceDate,calendar){
  const targets=Object.fromEntries(['kickoff','preview','customer','revision','delivery'].map((key,i)=>[key,shift(referenceDate,preset.offsets[i],calendar)]));
  return {kickoff:{enabled:true,dueDate:targets.kickoff,requirements:preset.requirements.map(required)},schedule:{enabled:true,calendar,targets,remainingWorkDays:null,customerWaitDays:2,internalReviewDays:1},deliverables:{items:[{...preset.item,kind:'video',language:'한국어',subtitles:'',fileFormat:'MP4',quantity:1,notes:''}],notes:'유형에 맞춰 만든 납품 규격 초안이에요. 범위를 정하고 고객 확인을 받은 뒤 확정해요.'}};
}

// Initial setup writes the existing authoritative project once. No agreement,
// source material, approval, completion or customer message is manufactured.
export function createClientStartupService({store,clientProjects,templates=null,clock=()=>new Date().toISOString()}){
  function currentProject(user,id){return clientProjects.project(user,id,true);}
  function revision(row,value){if(!Number.isSafeInteger(value)||value!==row.revision)throw fail('그사이 프로젝트가 바뀌었어요. 새로 불러온 뒤 다시 준비해 주세요.',409);}
  function selectedPreset(user,input){
    if(typeof input.presetId==='string'&&input.presetId.startsWith('template:')){
      if(!templates||!validDate(input.referenceDate)||!Object.hasOwn(calendarLabels,input.calendar)||!Number.isSafeInteger(input.templateRevision)||input.templateRevision<1)throw fail('내 기본 양식 버전과 시작하는 날을 다시 봐 주세요.');
      const template=templates.get(user,input.presetId.slice(9),input.templateRevision);return {id:input.presetId,label:template.label,templateRevision:template.revision,configuration:template.configuration};
    }
    if(Object.hasOwn(input,'templateRevision'))throw fail('기본 유형에는 내 기본 양식 버전을 붙일 수 없어요.');return argumentsFor(input);
  }
  function sectionsFor(row,preset){const availability=setupSections(row);if(preset.configuration)for(const key of sections)if(!Object.hasOwn(preset.configuration.sections,key))availability[key]={available:false,reason:'이 기본 설정에 없는 항목이에요.'};return availability;}
  function workspace(user,id){const row=currentProject(user,id),personal=templates?templates.list(user).map(template=>({id:'template:'+template.id,label:template.label,description:'내 기본 양식 · 시작하는 날에 맞춰 날짜를 다시 계산해요.',templateId:template.id,templateRevision:template.revision,calendar:template.configuration.calendar,templateSections:Object.keys(template.configuration.sections)})):[];return {projectId:row.id,revision:row.revision,presets:[...presets.map(({id,label,description})=>({id,label,description})),...personal],today:clientFollowUpToday(clock()),calendarLabels:{...calendarLabels},sections:setupSections(row)};}
  function preview(user,id,input){
    keys(input,['action','revision','presetId','referenceDate','calendar','templateRevision']);if(input.action!=='preview')throw fail('요청 내용이 비어 있어요.');
    const row=currentProject(user,id);revision(row,input.revision);const preset=selectedPreset(user,input);
    return {projectId:row.id,revision:row.revision,presetId:preset.id,presetLabel:preset.label,referenceDate:input.referenceDate,calendar:input.calendar,sections:sectionsFor(row,preset),draft:preset.configuration?startupTemplateDraft(preset.configuration,input.referenceDate,input.calendar):draftFor(preset,input.referenceDate,input.calendar),...(preset.configuration?{templateRevision:preset.templateRevision,templateSections:Object.keys(preset.configuration.sections),notes:[input.calendar==='weekdays'?'시작하는 날이 주말이면 다음 평일('+startupTemplateShift(input.referenceDate,0,input.calendar)+')부터 세요. 공휴일은 빼지 않아요.':'시작하는 날부터 달력대로 세요.','마이너스는 시작하는 날보다 앞이에요. 날짜가 맞는지 봐 주세요.']}: {})};
  }
  function apply(user,id,input){
    keys(input,['action','revision','presetId','referenceDate','calendar','sections','draft','templateRevision']);if(input.action!=='apply')throw fail('요청 내용이 비어 있어요.');
    return store.transaction(()=>{
      const row=currentProject(user,id);revision(row,input.revision);const preset=selectedPreset(user,input),availability=sectionsFor(row,preset);
      if(!Array.isArray(input.sections)||!input.sections.length||new Set(input.sections).size!==input.sections.length||input.sections.some(key=>!sections.includes(key)))throw fail('넣을 것을 겹치지 않게 골라 주세요.');
      keys(input.draft,input.sections);if(input.sections.some(key=>!Object.hasOwn(input.draft,key)))throw fail('고른 설정 내용이 이상해요.');
      for(const key of input.sections)if(!availability[key].available)throw fail(availability[key].reason,409);
      if(!Number.isSafeInteger(row.revision)||row.revision>=Number.MAX_SAFE_INTEGER)throw fail('이 프로젝트의 버전이 꽉 찼어요.',409);
      const next=structuredClone(row),at=clock(),actor=store.get('users',user.id);
      if(input.sections.includes('kickoff')){
        const value=input.draft.kickoff;keys(value,['enabled','dueDate','requirements']);if(value.enabled!==true||!Array.isArray(value.requirements))throw fail('자료 목록을 다시 봐 주세요.');for(const item of value.requirements)keys(item,['label','required']);
        next.kickoffPlan=applyClientKickoffAction(row,{...value,action:'configure',revision:row.revision},{actor:actor.id,at});
      }
      if(input.sections.includes('schedule')){
        const value=input.draft.schedule;keys(value,['enabled','calendar','targets','remainingWorkDays','customerWaitDays','internalReviewDays']);if(value.enabled!==true||value.calendar!==input.calendar)throw fail('날짜 세는 법을 다시 봐 주세요.');
        next.schedulePlan=applyClientScheduleAction(row,{...value,action:'configure',revision:row.revision},{actor:actor.id,at});
      }
      if(input.sections.includes('deliverables')){
        const value=input.draft.deliverables;keys(value,['items','notes']);if(!Array.isArray(value.items)||!value.items.length)throw fail('납품 규격 초안을 하나 이상 적어 주세요.');for(const item of value.items)if(object(item)&&Object.hasOwn(item,'id'))throw fail('이미 있는 납품 항목은 복사할 수 없어요.');
        const studio=next.studio||emptyPulseStudio();applyDeliverableAction({studio,row:next,input:{action:'save_deliverables',revision:row.revision,deliverableRevision:0,...value},staff:true,stamp:{author:'staff',authorId:actor.id,authorName:actor.name||'담당자',at}});if(Buffer.byteLength(JSON.stringify(studio),'utf8')>1500000)throw fail('기획 기록이 꽉 찼어요. 새 프로젝트로 이어 주세요.',409);next.studio=studio;
      }
      next.revision=row.revision+1;next.updatedAt=at;next.history=[...(row.history||[]),{id:randomUUID(),action:'시작 설정 · '+preset.label,actor:actor.id,at}].slice(-300);
      clientProjects.commitWorkflow(next);
      return {project:clientProjects.workspace(actor).projects.find(project=>project.id===id),applied:{presetId:preset.id,referenceDate:input.referenceDate,calendar:input.calendar,sections:[...input.sections],...(preset.templateRevision?{templateRevision:preset.templateRevision}: {})}};
    });
  }
  function mutate(user,id,input){if(input?.action==='preview')return preview(user,id,input);if(input?.action==='apply')return apply(user,id,input);throw fail('요청 내용이 비어 있어요.');}
  return {workspace,preview,apply,mutate};
}
