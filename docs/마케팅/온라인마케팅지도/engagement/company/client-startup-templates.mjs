import {randomUUID} from 'node:crypto';
import {applyClientKickoffAction} from './client-kickoff.mjs';
import {applyClientScheduleAction} from './client-schedule.mjs';
import {applyDeliverableAction} from './pulse-deliverables.mjs';

const KIND='clientStartupTemplates',SECTIONS=['kickoff','schedule','deliverables'],TARGETS=['kickoff','preview','customer','revision','delivery'];
const ITEM_FIELDS=['label','kind','platform','placement','durationSeconds','aspectRatio','language','subtitles','fileFormat','quantity','notes'];
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const keys=(value,allowed)=>{if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw fail('입력 내용을 다시 봐 주세요.');};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const calendar=value=>{if(!['weekdays','calendar'].includes(value))throw fail('날짜 세는 법을 다시 봐 주세요.');return value;};
const day=86400000,working=time=>![0,6].includes(new Date(time).getUTCDay());
function normalized(date,mode){if(!validDate(date))throw fail('시작하는 날과 목표일을 다시 봐 주세요.');let time=Date.parse(date+'T00:00:00Z');if(mode==='weekdays')while(!working(time))time+=day;return time;}
function offset(value){if(value!==null&&(!Number.isSafeInteger(value)||value< -365||value>365))throw fail('날짜 간격은 -365~365 사이로 적거나 비워 주세요.');return value;}
export function startupTemplateShift(reference,count,mode){calendar(mode);offset(count);if(count===null)return '';let time=normalized(reference,mode),left=Math.abs(count),direction=count<0?-1:1;while(left){time+=direction*day;if(mode==='calendar'||working(time))left--;}const result=new Date(time).toISOString().slice(0,10);if(!validDate(result))throw fail('계산할 수 있는 날짜 범위를 넘었어요.');return result;}
export function startupTemplateOffset(reference,target,mode){calendar(mode);const start=normalized(reference,mode);if(target==='')return null;const end=normalized(target,mode);if(Math.abs(end-start)>730*day)throw fail('날짜 간격은 -365~365 사이여야 해요.');let time=start,count=0,direction=end<start?-1:1;while(time!==end){time+=direction*day;if(mode==='calendar'||working(time))count+=direction;if(Math.abs(count)>365)throw fail('날짜 간격은 -365~365 사이여야 해요.');}return count;}
const fake=()=>({id:'template-validation',stage:'received',revision:1,versions:[],messages:[],history:[]});
function validateDraftSection(name,value){
  const row=fake(),stamp={actor:'template-validation',at:'2026-01-05T00:00:00.000Z'};
  if(name==='kickoff'){keys(value,['enabled','dueDate','requirements']);if(value.enabled!==true||!Array.isArray(value.requirements))throw fail('자료 목록을 다시 봐 주세요.');for(const item of value.requirements)keys(item,['label','required']);const result=applyClientKickoffAction(row,{...value,action:'configure',revision:1},stamp);return {enabled:true,dueDate:result.dueDate,requirements:result.requirements.map(({label,required})=>({label,required}))};}
  if(name==='schedule'){keys(value,['enabled','calendar','targets','remainingWorkDays','customerWaitDays','internalReviewDays']);if(value.enabled!==true)throw fail('목표일을 다시 봐 주세요.');const result=applyClientScheduleAction(row,{...value,action:'configure',revision:1},stamp);return {enabled:true,calendar:result.calendar,targets:result.targets,remainingWorkDays:result.remainingWorkDays,customerWaitDays:result.customerWaitDays,internalReviewDays:result.internalReviewDays};}
  keys(value,['items','notes']);if(!Array.isArray(value.items)||!value.items.length)throw fail('납품 항목을 하나 이상 적어 주세요.');for(const item of value.items)keys(item,ITEM_FIELDS);const studio={};applyDeliverableAction({studio,row,input:{action:'save_deliverables',revision:1,deliverableRevision:0,...value},staff:true,stamp:{author:'staff',authorId:'template-validation',authorName:'',at:stamp.at}});return {items:studio.deliverables.items.map(({id,...item})=>item),notes:studio.deliverables.notes};
}
export function startupTemplateDraft(configuration,referenceDate,mode=configuration.calendar){
  calendar(mode);normalized(referenceDate,mode);const values=configuration.sections,draft={kickoff:{enabled:true,dueDate:'',requirements:[]},schedule:{enabled:true,calendar:mode,targets:Object.fromEntries(TARGETS.map(key=>[key,''])),remainingWorkDays:null,customerWaitDays:null,internalReviewDays:null},deliverables:{items:[],notes:''}};
  if(values.kickoff)draft.kickoff={enabled:true,dueDate:startupTemplateShift(referenceDate,values.kickoff.dueOffset,mode),requirements:structuredClone(values.kickoff.requirements)};
  if(values.schedule)draft.schedule={enabled:true,calendar:mode,targets:Object.fromEntries(TARGETS.map(key=>[key,startupTemplateShift(referenceDate,values.schedule.offsets[key],mode)])),remainingWorkDays:values.schedule.remainingWorkDays,customerWaitDays:values.schedule.customerWaitDays,internalReviewDays:values.schedule.internalReviewDays};
  if(values.deliverables)draft.deliverables=structuredClone(values.deliverables);return draft;
}
export function normalizeStartupTemplate(configuration){
  keys(configuration,['calendar','sections']);calendar(configuration.calendar);keys(configuration.sections,SECTIONS);if(!Object.keys(configuration.sections).length)throw fail('저장할 것을 하나 이상 골라 주세요.');
  const result={calendar:configuration.calendar,sections:{}};
  for(const [name,value]of Object.entries(configuration.sections)){
    if(name==='kickoff'){keys(value,['dueOffset','requirements']);offset(value.dueOffset);const checked=validateDraftSection(name,{enabled:true,dueDate:startupTemplateShift('2026-01-05',value.dueOffset,configuration.calendar),requirements:value.requirements});result.sections.kickoff={dueOffset:value.dueOffset,requirements:checked.requirements};}
    else if(name==='schedule'){keys(value,['offsets','remainingWorkDays','customerWaitDays','internalReviewDays']);keys(value.offsets,TARGETS);if(TARGETS.some(key=>!Object.hasOwn(value.offsets,key)))throw fail('목표일 간격을 다시 봐 주세요.');for(const count of Object.values(value.offsets))offset(count);const checked=validateDraftSection(name,{enabled:true,calendar:configuration.calendar,targets:Object.fromEntries(TARGETS.map(key=>[key,startupTemplateShift('2026-01-05',value.offsets[key],configuration.calendar)])),remainingWorkDays:value.remainingWorkDays,customerWaitDays:value.customerWaitDays,internalReviewDays:value.internalReviewDays});result.sections.schedule={offsets:{...value.offsets},remainingWorkDays:checked.remainingWorkDays,customerWaitDays:checked.customerWaitDays,internalReviewDays:checked.internalReviewDays};}
    else result.sections.deliverables=validateDraftSection(name,value);
  }
  if(Buffer.byteLength(JSON.stringify(result),'utf8')>180000)throw fail('내 기본 설정이 너무 커요.',413);return result;
}

export function createClientStartupTemplatesService({store,clientProjects,clock=()=>new Date().toISOString()}){
  function current(user){const live=typeof user?.id==='string'&&store.get('users',user.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);if(live.role==='viewer')throw fail('읽기만 할 수 있는 계정이에요.',403);return live;}
  const recordKey=(user,id)=>user.id+'|'+id;
  function rowFor(user,id){if(!uuid(id))throw fail('내 기본 설정 정보가 이상해요.');const row=store.get(KIND,recordKey(user,id));if(!row||row.ownerId!==user.id||row.id!==id)throw fail('그 기본 설정을 찾지 못했어요.',404);if(row.schema!==1||!Number.isSafeInteger(row.revision)||row.revision<1||!['active','deleted'].includes(row.status))throw fail('저장한 기본 설정을 읽지 못했어요.',500);return row;}
  function view(user,row){if(row.status==='deleted')return {id:row.id,revision:row.revision,status:'deleted',label:'',updatedAt:row.updatedAt,configuration:null};try{const value=store.decrypt(row.ciphertext);if(value.ownerId!==user.id||value.id!==row.id||typeof value.label!=='string'||!value.label.trim()||value.label.length>80)throw new Error('Scope mismatch');return {id:row.id,revision:row.revision,status:'active',label:value.label,updatedAt:row.updatedAt,configuration:normalizeStartupTemplate(value.configuration)};}catch{throw fail('저장한 기본 설정을 읽지 못했어요.',500);}}
  function list(user){user=current(user);return store.all(KIND).filter(row=>row.ownerId===user.id&&row.status==='active').map(row=>view(user,rowFor(user,row.id))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));}
  function get(user,id,expectedRevision){user=current(user);const row=rowFor(user,id);if(row.status!=='active'||expectedRevision!==undefined&&row.revision!==expectedRevision)throw fail('내 기본 설정이 바뀌었거나 지워졌어요. 다시 만들어 봐 주세요.',409);return view(user,row);}
  function project(user,id,revision){user=current(user);const row=clientProjects.project(user,id,true);if(revision!==undefined&&(!Number.isSafeInteger(revision)||row.revision!==revision))throw fail('그사이 프로젝트가 바뀌었어요. 설정을 다시 봐 주세요.',409);return {user,row};}
  function workspace(user,id){const scope=project(user,id);return {projectId:id,revision:scope.row.revision,templates:list(scope.user)};}
  function capture(user,id,input){
    keys(input,['action','revision','referenceDate','calendar','sections','source','draft']);if(input.action!=='capture'||!['project','draft'].includes(input.source))throw fail('가져올 설정이 이상해요.');const {row}=project(user,id,input.revision);calendar(input.calendar);normalized(input.referenceDate,input.calendar);
    if(!Array.isArray(input.sections)||!input.sections.length||new Set(input.sections).size!==input.sections.length||input.sections.some(key=>!SECTIONS.includes(key)))throw fail('저장할 것을 겹치지 않게 골라 주세요.');
    let draft=input.draft;
    if(input.source==='project'){
      if(Object.hasOwn(input,'draft'))throw fail('이 프로젝트의 설정만 가져올 수 있어요.');draft={};
      if(input.sections.includes('kickoff')){if(!row.kickoffPlan)throw fail('이 프로젝트에는 자료 목록이 없어요.');draft.kickoff={enabled:true,dueDate:row.kickoffPlan.dueDate||'',requirements:(row.kickoffPlan.requirements||[]).map(({label,required})=>({label,required}))};}
      if(input.sections.includes('schedule')){if(!row.schedulePlan)throw fail('이 프로젝트에는 목표일이 없어요.');const plan=row.schedulePlan;draft.schedule={enabled:true,calendar:input.calendar,targets:plan.targets,remainingWorkDays:plan.remainingWorkDays??null,customerWaitDays:plan.customerWaitDays??null,internalReviewDays:plan.internalReviewDays??null};}
      if(input.sections.includes('deliverables')){if(!row.studio?.deliverables?.items?.length)throw fail('이 프로젝트에는 납품 규격이 없어요.');draft.deliverables={items:row.studio.deliverables.items.map(item=>({...Object.fromEntries(ITEM_FIELDS.filter(key=>key!=='notes').map(key=>[key,item[key]])),notes:''})),notes:''};}
    }else{keys(draft,input.sections);if(input.sections.some(key=>!Object.hasOwn(draft,key)))throw fail('고른 초안이 이상해요.');}
    const configuration={calendar:input.calendar,sections:{}};
    for(const name of input.sections){const value=validateDraftSection(name,draft[name]);if(name==='kickoff')configuration.sections.kickoff={dueOffset:startupTemplateOffset(input.referenceDate,value.dueDate,input.calendar),requirements:value.requirements};else if(name==='schedule'){if(value.calendar!==input.calendar)throw fail('초안과 날짜 세는 법이 달라요.');configuration.sections.schedule={offsets:Object.fromEntries(TARGETS.map(key=>[key,startupTemplateOffset(input.referenceDate,value.targets[key],input.calendar)])),remainingWorkDays:value.remainingWorkDays,customerWaitDays:value.customerWaitDays,internalReviewDays:value.internalReviewDays};}else configuration.sections.deliverables=value;}
    return {projectId:id,revision:row.revision,source:input.source,configuration:normalizeStartupTemplate(configuration),notes:[input.calendar==='weekdays'?'시작하는 날과 목표일이 주말이면 다음 평일로 옮겨서 세요. 공휴일은 빼지 않아요.':'시작하는 날부터 목표일까지 달력대로 센 날수로 저장해요.','마이너스는 시작하는 날보다 앞이에요. 실제 날짜는 저장하지 않아요.',...(input.source==='project'?['납품 메모는 가져오지 않았어요. 필요하면 새로 적어 주세요.']:[])]};
  }
  function mutate(user,id,input){
    if(input?.action==='capture')return capture(user,id,input);
    keys(input,input?.action==='save'?['action','revision','templateId','expectedRevision','label','configuration']:['action','revision','templateId','expectedRevision']);if(!['save','delete'].includes(input.action)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)throw fail('요청 내용이 비어 있어요.');
    const initial=project(user,id,input.revision),creating=input.action==='save'&&input.templateId===null;
    if(creating&&input.expectedRevision!==0||!creating&&!uuid(input.templateId))throw fail('내 기본 설정 버전이 이상해요.');
    let label,configuration;if(input.action==='save'){if(typeof input.label!=='string'||!input.label.trim()||input.label.length>80||/[\u0000-\u001f]/.test(input.label))throw fail('이름은 80자 안으로 적어 주세요.');label=input.label.trim();configuration=normalizeStartupTemplate(input.configuration);}
    return store.transaction(()=>{const scope=project(initial.user,id,input.revision),previous=creating?null:rowFor(scope.user,input.templateId);if(previous&&(previous.revision!==input.expectedRevision||previous.status!=='active'))throw fail('내 기본 설정이 바뀌었거나 지워졌어요. 다시 불러와 주세요.',409);if(creating&&list(scope.user).length>=50)throw fail('내 기본 설정은 50개까지 저장할 수 있어요.',409);if(previous?.revision>=Number.MAX_SAFE_INTEGER)throw fail('이 기본 설정의 버전이 꽉 찼어요.',409);const templateId=previous?.id||randomUUID(),row={schema:1,id:templateId,ownerId:scope.user.id,revision:(previous?.revision||0)+1,status:input.action==='save'?'active':'deleted',updatedAt:clock()};if(input.action==='save')row.ciphertext=store.encrypt({ownerId:scope.user.id,id:templateId,label,configuration});store.put(KIND,recordKey(scope.user,templateId),row);return {projectId:id,revision:scope.row.revision,template:view(scope.user,row)};});
  }
  return {list,get,workspace,capture,mutate};
}
