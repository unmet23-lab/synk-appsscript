import {createHash,randomUUID} from 'node:crypto';
import {strategyView,strategyReadiness,CUSTOMER_STRATEGY_LABELS} from './pulse-strategy.mjs';
import {clientKickoffSources} from './client-kickoff.mjs';
import {CASTING_MODELS} from './public/pulse-app/casting-catalog.mjs';

const records=value=>Array.isArray(value)?value:[];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const statuses={disabled:'바뀐 것 보기 꺼짐',clean:'바뀐 것 없음',pending:'바뀐 것 다시 볼 것',reviewed:'바뀐 것 다 봄',archived:'보관됨'};
const labels={objective:'제작 목적',product:'제품·서비스',audience:'대상',situation:'대상이 마주한 상황',barrier:'행동을 막는 이유',targetNotes:'대상에 관한 메모',successMetric:'성공 판단 지표',successTarget:'목표 수치',measurementWindow:'확인 기간',baseline:'현재 기준 수치',measurementSource:'측정 자료',primaryPromise:'핵심 약속',value1:'가치 1',evidence1:'가치 1의 근거',value2:'가치 2',evidence2:'가치 2의 근거',value3:'가치 3',evidence3:'가치 3의 근거',memoryHook:'기억할 요소',desiredAction:'기대 행동',channels:'게재 채널',channelNotes:'채널별로 필요한 점',distribution:'노출 방식',aspectRatio:'화면 비율',durationSeconds:'희망 영상 길이',destinationUrl:'연결 주소',budgetProduction:'제작 예산',budgetMedia:'광고 노출 예산',budgetNotes:'예산 관련 논의',planInterest:'관심 있는 구성',mood:'분위기',visualStyle:'시각적 표현',dialogue:'등장인물의 말',voice:'목소리·말하는 느낌',wardrobe:'의상·소품',casting:'등장인물에 바라는 점',castingSelection:'모델·스타일 선택',subtitles:'말소리를 옮기는 자막',screenCopy:'별도로 강조할 화면 문구',scope:'필요한 결과물과 범위',rightsNotes:'사용처·기간·권리',proposedDeadline:'희망 전달일',scheduleNotes:'일정에서 고려할 점',revisionNotes:'수정·확인 방식',notes:'기타·메모'};
const choices={objective:{sales:'판매·전환',brand:'브랜드 인지',both:'판매와 브랜드'},distribution:{owned:'운영 채널',paid:'유료 광고',mixed:'운영 채널과 광고'},aspectRatio:{multiple:'여러 비율',other:'기타·협의'},planInterest:{basic:'기본 구성',premium:'추가 표현·결과물',custom:'맞춤 구성'},channels:{instagram:'인스타그램',youtube:'유튜브',facebook:'페이스북',tiktok:'틱톡',website:'웹사이트',blog:'블로그',offline:'오프라인',tv:'TV',other:'기타'}};
const castingOptions={
  hair:{label:'헤어',values:{original:'대표 사진 그대로',short:'숏 헤어',bob:'단발','long-straight':'긴 생머리',wave:'웨이브',updo:'묶은 머리',custom:'직접 설명'}},
  makeup:{label:'메이크업',values:{natural:'내추럴',clean:'깔끔하고 단정하게',glow:'화사한 윤광',smoky:'스모키',custom:'직접 설명'}},
  jacket:{label:'자켓',values:{none:'없음',blazer:'블레이저',casual:'캐주얼 자켓',leather:'레더 자켓',custom:'직접 설명'}},
  top:{label:'상의',values:{tshirt:'티셔츠',shirt:'셔츠',knit:'니트',blouse:'블라우스',custom:'직접 설명'}},
  bottom:{label:'하의',values:{trousers:'슬랙스',denim:'데님',skirt:'스커트',custom:'직접 설명'}},
  earrings:{label:'귀걸이',values:{none:'없음',stud:'작은 스터드',hoop:'링 귀걸이',drop:'드롭 귀걸이',custom:'직접 설명'}},
  ring:{label:'반지',values:{none:'없음',simple:'심플한 반지',layered:'레이어드',custom:'직접 설명'}}
};
const structuredText=value=>value&&typeof value==='object'?JSON.stringify(value,null,2):String(value);
function castingText(value){
  if(!object(value)||!Object.values(value).some(item=>item!==''&&item!==null&&item!==undefined))return '미선택';
  const model=CASTING_MODELS.find(model=>model.id===value.modelId),voice=model?.voices.find(voice=>voice.id===value.voice),parts=['모델: '+(model?model.name+' ('+model.id+')':value.modelId||'미정')];
  for(const [key,option]of Object.entries(castingOptions))parts.push(option.label+': '+(option.values[value[key]]||value[key]||'미정'));
  parts.push('목소리: '+(value.voice?value.voice+(voice?' · '+voice.label:''):'미정'));
  if(value.notes)parts.push('기타·메모: '+value.notes);return parts.join('\n');
}
function display(key,value){if(key==='castingSelection')return castingText(value);if(value===null||value===undefined||value==='')return '미입력';if(Array.isArray(value))return value.length?value.map(item=>choices[key]?.[item]||structuredText(item)).join(', '):'미선택';if(object(value))return structuredText(value);if(key==='durationSeconds')return value+'초';if(key==='budgetProduction'||key==='budgetMedia')return Number(value).toLocaleString('ko-KR')+'원';return choices[key]?.[value]||String(value);}
function sourcesOf(row){return clientKickoffSources(row,{customer:true}).filter(source=>['asset','reference'].includes(source.kind)).map(source=>({key:source.key,label:source.label,kind:source.kind,fingerprint:source.fingerprint,...(source.kind==='reference'?{assetId:records(row.studio?.references).find(reference=>'reference:'+reference.id===source.key)?.assetId||null}:{})})).sort((a,b)=>a.key.localeCompare(b.key));}
function currentOf(row){const strategy=strategyView(row.studio?.strategy);return {strategyRevision:strategy.revision,strategy:strategy.data,dueDate:row.dueDate||'',terms:row.terms||'',sources:sourcesOf(row)};}
function blockersOf(row,current){const strategy=strategyView(row.studio?.strategy),result=[];if(!strategyReadiness(current.strategy).ready)result.push('기획에 꼭 있어야 하는 것이 아직 안 적혀 있어요.');if(!strategy.revision||strategy.confirmation?.strategyRevision!==strategy.revision)result.push('고객이 지금 기획을 아직 확인하지 않았어요.');if(!/^\d{4}-\d{2}-\d{2}$/.test(current.dueDate)||!Number.isFinite(Date.parse(current.dueDate+'T00:00:00Z'))||new Date(current.dueDate+'T00:00:00Z').toISOString().slice(0,10)!==current.dueDate)result.push('합의한 전달일이 아직 없어요.');if(typeof current.terms!=='string'||!current.terms.trim())result.push('합의한 범위와 조건이 아직 없어요.');return result;}
function changesOf(baseline,current){
  if(!baseline)return [];
  const result=[],beforeStrategy=strategyView({data:baseline.strategy}).data;
  for(const key of Object.keys(current.strategy))if(JSON.stringify(beforeStrategy[key])!==JSON.stringify(current.strategy[key]))result.push({id:'strategy:'+key,kind:'strategy',label:labels[key]||key,before:display(key,beforeStrategy[key]),after:display(key,current.strategy[key])});
  for(const [key,label]of [['dueDate','합의한 전달일'],['terms','합의한 제작 조건']])if((baseline[key]||'')!==current[key])result.push({id:key,kind:key==='dueDate'?'schedule':'terms',label,before:display(key,baseline[key]),after:display(key,current[key])});
  const old=new Map(records(baseline.sources).map(source=>[source.key,source])),next=new Map(current.sources.map(source=>[source.key,source]));
  for(const key of new Set([...old.keys(),...next.keys()])){const before=old.get(key),after=next.get(key);if(before?.fingerprint===after?.fingerprint)continue;result.push({id:key,kind:'source',label:after?.label||before?.label||'공유 자료',before:before?before.label+' (기준)':'없음',after:after?after.label+(before?' (내용이나 연결이 바뀜)':' (새로 들어옴)'):'공유 자료에서 빠짐'});}
  return result;
}
function impactsOf(row,baseline,current,changes){
  if(!changes.length)return [];
  const strategyChanged=changes.some(change=>change.kind==='strategy'),sourceKeys=new Set(changes.filter(change=>change.kind==='source').map(change=>change.id)),assetIds=new Set([...sourceKeys].filter(key=>key.startsWith('asset:')).map(key=>key.slice(6)));
  for(const source of [...records(baseline?.sources),...current.sources])if(sourceKeys.has(source.key)&&source.assetId)assetIds.add(source.assetId);
  const result=[];
  for(const scene of records(row.studio?.scenes)){
    const oldStrategy=strategyChanged&&(!scene.strategyRevision||scene.strategyRevision<current.strategyRevision),changedSource=scene.assetId&&assetIds.has(scene.assetId);
    if(!oldStrategy&&!changedSource)continue;
    result.push({id:'scene:'+scene.id,kind:'scene',sceneId:scene.id,label:scene.title||'이름 없는 장면',reason:oldStrategy&&changedSource?'이전 기획으로 만든 장면이고, 바뀐 공유 자료를 쓰고 있어요.':oldStrategy?'이전 기획으로 만든 장면이에요. 바뀐 내용이 닿는지 봐 주세요.':'바뀐 공유 자료를 쓰는 장면이에요. 다시 봐 주세요.'});
  }
  result.push({id:'schedule',kind:'schedule',label:'합의한 전달일',reason:'바뀐 내용으로도 전달일을 지킬 수 있는지 봐 주세요.'},{id:'terms',kind:'terms',label:'합의한 범위와 조건',reason:'결과물 범위·비용·수정 조건이 달라지는지 봐 주세요. 조건은 알아서 바뀌지 않아요.'});
  return result;
}

// Baselines are pinned in the authoritative project, independently of the
// strategy editor's rolling history. Only already-public source metadata is
// retained; neither private original files nor media bytes are duplicated.
export function buildClientChanges(row,{canEdit=false,now=new Date().toISOString()}={}){
  const control=row.changeControl||{},enabled=control.enabled===true,baseline=control.baseline||null,current=currentOf(row),captureBlockers=blockersOf(row,current),changes=changesOf(baseline,current),rawImpacts=impactsOf(row,baseline,current,changes),editable=!!canEdit&&row.stage!=='archived';
  // All scene data participates so edits invalidate earlier staff decisions,
  // even if a scene was re-linked to the newest strategy and leaves the list.
  const changeKey=changes.length?hash({baseline:baseline.id,current,scenes:records(row.studio?.scenes)}):'',checks=records(control.checks),impacts=rawImpacts.map(impact=>{const check=checks.findLast(check=>check.changeKey===changeKey&&check.impactId===impact.id);return {...impact,checked:!!check&&!check.resetAt,...(check&&!check.resetAt?{decision:check.decision,note:check.note||''}:{})};});
  const currentStrategyConfirmed=current.strategyRevision>0&&row.studio?.strategy?.confirmation?.strategyRevision===current.strategyRevision,pendingCount=changes.length?impacts.filter(impact=>!impact.checked).length+captureBlockers.length:0;
  const status=row.stage==='archived'?'archived':!enabled?'disabled':!changes.length?'clean':pendingCount?'pending':'reviewed';
  const requestText=!enabled?'':changes.length?[row.title+' 확정한 뒤 바뀐 내용을 봐 주세요.','변경 항목: '+[...changes.filter(change=>change.kind!=='source').map(change=>change.label),...(changes.some(change=>change.kind==='source')?['공유 자료']:[])].join(', '),...(!currentStrategyConfirmed?['고객 화면에서 최신 기획을 확인해 주세요.']:[]),'담당자가 관련 장면과 합의한 전달일·제작 조건을 함께 확인합니다.'].join('\n'):row.title+' 기준을 잡은 뒤 바뀐 내용이 없어요.';
  return {enabled,status,statusLabel:statuses[status],canEdit:editable,canCapture:editable&&!baseline&&captureBlockers.length===0,captureBlockers,baseline:baseline?{id:baseline.id,strategyRevision:baseline.strategyRevision,at:baseline.at}:null,currentStrategyRevision:current.strategyRevision,currentStrategyConfirmed,changeKey,changes,impacts,pendingCount,canAdvance:editable&&enabled&&changes.length>0&&pendingCount===0&&records(control.pastBaselines).length<30,requestText,history:records(control.pastBaselines).map(entry=>({at:entry.at,strategyRevision:entry.strategyRevision,changeCount:entry.changeCount||0}))};
}

export function customerClientChanges(row){
  const report=buildClientChanges(row),sourceChanges=report.changes.filter(change=>change.kind==='source');
  // Removed or newly-private originals must not remain discoverable through a
  // historical diff. Material changes are deliberately summarized without ids.
  const changes=report.changes.filter(change=>change.kind!=='source').map(change=>({...change,label:change.kind==='strategy'?CUSTOMER_STRATEGY_LABELS[change.id.slice('strategy:'.length)]||change.label:change.label}));if(sourceChanges.length)changes.push({id:'shared-materials',kind:'source',label:'공유 자료 변경',before:'이전 제작 기준의 공유 자료',after:'공유된 자료를 다시 살펴봐 주세요.'});
  return {enabled:report.enabled,status:report.status,statusLabel:report.statusLabel,baseline:report.baseline,currentStrategyRevision:report.currentStrategyRevision,currentStrategyConfirmed:report.currentStrategyConfirmed,changes};
}

export function applyClientChangesAction(row,input,{actor,at}={}){
  const fields={capture:['confirmed'],review:['changeKey','impactId','decision','note','confirmed'],reset:['changeKey','impactId'],advance:['changeKey','confirmed'],set_enabled:['enabled']};
  if(!object(input)||!Object.hasOwn(fields,input.action)||Object.keys(input).some(key=>!['action','revision',...fields[input.action]].includes(key)))throw fail('입력 내용을 다시 봐 주세요.');
  if(row.stage==='archived')throw fail('보관한 프로젝트예요. 보관을 풀어야 바꿀 수 있어요.',409);
  const control=structuredClone(row.changeControl||{enabled:false,baseline:null,pastBaselines:[],checks:[]}),report=buildClientChanges(row,{canEdit:true}),current=currentOf(row);
  const makeBaseline=()=>({id:randomUUID(),...current,at,actor});
  if(input.action==='capture'){
    if(input.confirmed!==true)throw fail('기준으로 잡겠다는 확인 표시가 비어 있어요.');
    if(control.baseline)throw fail('이미 기준이 있어요. 바뀐 것을 다 본 뒤 새 기준으로 잡아 주세요.',409);
    if(!report.canCapture)throw fail(report.captureBlockers.join(' ')||'지금은 기준을 잡을 수 없어요.',409);
    control.enabled=true;control.baseline=makeBaseline();control.checks=[];control.pastBaselines=records(control.pastBaselines);
  }else if(input.action==='set_enabled'){
    if(typeof input.enabled!=='boolean')throw fail('켜기 값이 이상해요.');
    if(input.enabled&&!control.baseline)throw fail('고객이 확인한 제작 기준을 먼저 저장해 주세요.',409);
    if(control.enabled===input.enabled)throw fail('이미 같은 변경 점검 설정입니다.',409);control.enabled=input.enabled;
  }else{
    if(!control.enabled||!control.baseline)throw fail('변경 점검을 먼저 켜 주세요.',409);
    if(!report.changeKey||typeof input.changeKey!=='string'||input.changeKey!==report.changeKey)throw fail('그사이 바뀐 내용이나 장면이 있어요. 새로 불러와 주세요.',409);
    if(input.action==='advance'){
      if(input.confirmed!==true)throw fail('새 기준으로 잡겠다는 확인 표시가 비어 있어요.');
      if(records(control.pastBaselines).length>=30)throw fail('기준을 30번 바꿨어요. 새 프로젝트로 이어 주세요.',409);
      if(!report.canAdvance)throw fail('장면·일정·조건 재검토와 최신 고객 기획 확인을 먼저 마쳐 주세요.',409);
      control.pastBaselines=[...records(control.pastBaselines),{...control.baseline,endedAt:at,changeCount:report.changes.length,checks:records(control.checks)}];control.baseline=makeBaseline();control.checks=[];
    }else{
      const impact=report.impacts.find(impact=>impact.id===input.impactId);if(!impact)throw fail('그 항목이 지금 변경에 없어요.',404);
      if(input.action==='review'){
        if(input.confirmed!==true||!['unchanged','updated'].includes(input.decision))throw fail('변경 영향을 확인하고 유지·수정 여부를 선택해 주세요.');
        if(input.note!==undefined&&(typeof input.note!=='string'||input.note.length>600||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input.note)))throw fail('확인 메모를 600자 이하로 입력해 주세요.');
        if(impact.checked)throw fail('이미 재확인한 항목입니다. 필요하면 확인을 취소하고 다시 남겨 주세요.',409);
        if(records(control.checks).length>=600)throw fail('기록이 꽉 찼어요. 새 프로젝트로 이어 주세요.',409);
        control.checks=[...records(control.checks),{changeKey:report.changeKey,impactId:impact.id,decision:input.decision,note:input.note?.trim()||'',actor,at}];
      }else{
        if(!impact.checked)throw fail('되돌릴 기록이 없어요.',409);
        const found=control.checks.findLast(check=>check.changeKey===report.changeKey&&check.impactId===impact.id);found.resetAt=at;found.resetBy=actor;
      }
    }
  }
  return {...control,updatedAt:at,updatedBy:actor};
}
