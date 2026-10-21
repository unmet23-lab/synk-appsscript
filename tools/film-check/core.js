(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FilmCheck = factory();
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const VERSION = 1;
  const SHOT_RULES = [
    {id:'identity',phase:'image',label:'인물의 정체성',help:'승인 얼굴과 눈·코·턱·나이·헤어·의상이 같은지 대조합니다. 인물이 없으면 이유를 남깁니다.',allowNA:true},
    {id:'product',phase:'image',label:'제품·브랜드 정확도',help:'제품 형태·비율·색·소재·로고·문자를 원본과 대조합니다. 해당 대상이 없으면 이유를 남깁니다.',allowNA:true},
    {id:'lighting',phase:'image',label:'빛·그림자·반사',help:'주광 방향과 색온도, 얼굴과 공간의 밝기, 접촉 그림자와 반사가 서로 맞는지 확인합니다.',allowNA:false},
    {id:'composition',phase:'image',label:'구도·거리·초점',help:'컷의 목적이 읽히는 구도인지, 인물과 물체의 크기·원근·심도가 장면에 맞는지 확인합니다.',allowNA:false},
    {id:'material',phase:'image',label:'피부·소재 질감',help:'피부가 밀랍처럼 매끈하거나 모공이 과장되지 않는지, 머리카락·천·금속의 질감이 자연스러운지 봅니다.',allowNA:false},
    {id:'reference',phase:'image',label:'참조의 역할과 시작 자세',help:'인물·구도·질감 참조가 서로 충돌하지 않는지, 시작 자세에서 요구한 행동이 가능한지 확인합니다.',allowNA:false},
    {id:'physics',phase:'clip',label:'접촉·무게·물리',help:'손과 소품, 발과 바닥의 접촉, 중심 이동, 액체와 옷의 반응에 원인과 결과가 있는지 실제 속도로 봅니다.',allowNA:false},
    {id:'acting',phase:'clip',label:'시선·표정·연기',help:'시선 대상과 행동의 이유가 읽히고, 표정·호흡이 과장되거나 반복되지 않는지 확인합니다.',allowNA:true},
    {id:'temporal',phase:'clip',label:'시간에 따른 형태·카메라 안정성',help:'얼굴·손·배경·제품이 중간에 변형되거나 깜빡이지 않고, 카메라 움직임·속도·모션블러가 자연스러운지 봅니다.',allowNA:false},
    {id:'continuity',phase:'clip',label:'시작·끝과 다음 컷 연결',help:'동작·시선·화면 방향·소품 위치·의상·빛이 콘티와 다음 컷에 이어지는지 비교합니다.',allowNA:false},
    {id:'sound',phase:'clip',label:'대사·입모양·현장음',help:'소리를 직접 듣고 대사·입모양·접촉음의 타이밍과 내용이 맞는지 확인합니다. 무음 소스는 이유를 남깁니다.',allowNA:true},
    {id:'playback',phase:'clip',label:'전체 구간 실제 재생',help:'채택할 구간을 실제 속도로 처음부터 끝까지 재생하고 이상 구간의 타임코드를 기록합니다. 정지 프레임만으로 통과시키지 않습니다.',allowNA:false}
  ];
  const FINAL_RULES = [
    {id:'story',phase:'final',label:'메시지와 시청 보상',help:'처음 보는 사람이 대상·핵심 메시지·행동을 이해하고, 약속한 정보·재미·감정을 얻는지 봅니다.',allowNA:false},
    {id:'edit',phase:'final',label:'편집·장면 연결',help:'동작·시선·화면 방향·리듬·음향 연결을 완성본에서 확인합니다.',allowNA:false},
    {id:'finish',phase:'final',label:'색·노출·질감 일치',help:'실사와 생성 컷의 색·명암·피부·선명도·그레인이 어울리는지 최종 크기로 확인합니다.',allowNA:false},
    {id:'accuracy',phase:'final',label:'제품·인물·문구·출처',help:'원본과 완성본을 대조하고 제품·인물·로고·가격·효과 문구·자료 출처와 사용 범위를 확인합니다.',allowNA:false},
    {id:'audio',phase:'final',label:'완성본 음향 청취',help:'대사·음악·효과음을 직접 듣고 크기·끊김·왜곡·입모양을 확인합니다. 의도된 무음은 이유를 남깁니다.',allowNA:true},
    {id:'delivery',phase:'final',label:'최종 파일 전체 재생',help:'실제 내보낸 파일을 끝까지 재생하고 비율·해상도·글자 가독성·첫 끝 프레임을 확인합니다. 게시 성공과는 별도입니다.',allowNA:false}
  ];
  const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const own = (o,k) => isObject(o) && Object.prototype.hasOwnProperty.call(o,k);
  const str = (v,max=4000) => typeof v === 'string' ? v.slice(0,max) : '';
  const has = v => typeof v === 'string' && !!v.trim();
  const hasDate = v => has(v) && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(v) && Number.isFinite(Date.parse(v));
  const numeric = (v,max=1000000) => {
    if (!(typeof v === 'number' || typeof v === 'string') || (typeof v === 'string' && !v.trim())) return null;
    const n=Number(v); return Number.isFinite(n) && n>=0 && n<=max ? n : null;
  };
  let serial = 0;
  const id = () => 'shot-' + Date.now().toString(36) + '-' + (++serial).toString(36);
  const checks = rules => Object.fromEntries(rules.map(r => [r.id,{status:'pending',note:''}]));
  function newShot() { return {id:id(),title:'',purpose:'',sourceType:'generated',sourceRef:'',identityRef:'',styleRef:'',referenceFile:'',startState:'',action:'',endState:'',lighting:'',camera:'',continuity:'',sound:'',model:'Wan 3.0',duration:5,generationSeconds:5,settingNote:'',quotedCredits:null,plannedTakes:1,actualCredits:null,actualTakes:0,file:'',reviewer:'',reviewedAt:'',review:checks(SHOT_RULES)}; }
  function defaults() { return {version:VERSION,title:'',audience:'',message:'',viewerReward:'',targetSeconds:20,aspect:'16:9',resolution:'1080p',continuity:'',budgetCredits:null,finalFile:'',finalReviewer:'',finalReviewedAt:'',finalChecks:checks(FINAL_RULES),shots:[newShot()]}; }
  function cleanChecks(raw,rules) {
    const out=checks(rules);
    for(const r of rules) { const v=own(raw,r.id)&&isObject(raw[r.id])?raw[r.id]:{}; out[r.id]={status:['pending','pass','fix','na'].includes(v.status)?v.status:'pending',note:str(v.note)}; }
    return out;
  }
  function cleanShot(raw) {
    const s=newShot(), r=isObject(raw)?raw:{};
    for(const key of Object.keys(s)) if(typeof s[key]==='string' && own(r,key)) s[key]=str(r[key],key==='id'?100:4000);
    if(!has(s.id)||!/^[\w-]+$/.test(s.id))s.id=id();
    if(!['generated','stock','existing','filmed'].includes(s.sourceType))s.sourceType='generated';
    for(const key of ['duration','generationSeconds']) if(own(r,key))s[key]=numeric(r[key],3600)??0;
    for(const key of ['plannedTakes','actualTakes'])if(own(r,key)){const n=numeric(r[key],10000);s[key]=n!==null&&Number.isInteger(n)?n:0;}
    for(const key of ['quotedCredits','actualCredits'])s[key]=numeric(r[key]);
    s.review=cleanChecks(r.review,SHOT_RULES);return s;
  }
  function sanitize(raw) {
    if(!isObject(raw)||!own(raw,'version')||raw.version!==VERSION)throw new Error('지원하는 영상 검수 기록(version 1)이 아닙니다.');
    const p=defaults();
    for(const key of Object.keys(p))if(typeof p[key]==='string'&&own(raw,key))p[key]=str(raw[key]);
    p.targetSeconds=own(raw,'targetSeconds')?(numeric(raw.targetSeconds,3600)??0):20;
    p.budgetCredits=numeric(raw.budgetCredits);
    p.finalChecks=cleanChecks(raw.finalChecks,FINAL_RULES);
    p.shots=Array.isArray(raw.shots)?raw.shots.slice(0,200).map(cleanShot):[];
    const seen=new Set();for(const s of p.shots){if(seen.has(s.id))s.id=id();seen.add(s.id);}
    return p;
  }
  function validCheck(rule,value) { return isObject(value)&&(value.status==='pass'||(value.status==='na'&&rule.allowNA&&has(value.note))); }
  function checkResult(values,rules) {
    return {failed:rules.filter(r=>own(values,r.id)&&values[r.id]?.status==='fix').map(r=>r.label),pending:rules.filter(r=>!validCheck(r,own(values,r.id)?values[r.id]:null)&&values?.[r.id]?.status!=='fix').map(r=>r.label)};
  }
  function evaluateShot(shot) {
    const s=cleanShot(shot),planMissing=[];
    for(const [key,label] of [['title','컷 이름'],['purpose','컷의 역할'],['startState','시작 상태'],['action','한 가지 핵심 행동'],['endState','끝 상태'],['lighting','빛 지시'],['camera','구도·카메라 지시'],['continuity','연속성 기준'],['sound','소리 계획']])if(!has(s[key]))planMissing.push(label);
    if(![s.sourceRef,s.identityRef,s.styleRef].some(has))planMissing.push('실사·인물·질감 참조 위치');
    if(!(s.duration>0))planMissing.push('채택 구간 길이');
    if(s.sourceType==='generated'){
      if(!has(s.model))planMissing.push('선택 모델');
      if(!(s.generationSeconds>0)||s.generationSeconds<s.duration)planMissing.push('채택 길이 이상의 생성 길이');
      if(s.quotedCredits===null)planMissing.push('현재 화면의 1회 견적');
      if(!(s.plannedTakes>0))planMissing.push('예정 생성 횟수');
    } else if(!has(s.sourceRef))planMissing.push('실제 소스 위치');
    const result=checkResult(s.review,SHOT_RULES), image=checkResult(s.review,SHOT_RULES.filter(r=>r.phase==='image'));
    const reviewed=!planMissing.length&&!result.failed.length&&!result.pending.length&&has(s.file)&&has(s.reviewer)&&hasDate(s.reviewedAt);
    return {planMissing,failed:result.failed,pending:result.pending,readyForGeneration:!planMissing.length&&!image.failed.length&&!image.pending.length,reviewed,status:result.failed.length?'수정 필요':reviewed?'검수 완료':'검수 전'};
  }
  function evaluate(raw) {
    const p=sanitize(raw),planMissing=[];
    for(const [key,label] of [['title','작품 이름'],['audience','시청 대상'],['message','핵심 메시지'],['viewerReward','시청자가 얻을 것'],['aspect','화면 비율'],['resolution','출력 해상도'],['continuity','공통 연속성 기준']])if(!has(p[key]))planMissing.push(label);
    if(!(p.targetSeconds>0))planMissing.push('목표 영상 길이');
    if(!p.shots.length)planMissing.push('한 개 이상의 컷');
    const usedSeconds=p.shots.reduce((n,s)=>n+s.duration,0);
    if(Math.abs(usedSeconds-p.targetSeconds)>0.25)planMissing.push('채택 구간 합계와 목표 길이 일치');
    const shots=p.shots.map(evaluateShot), f=checkResult(p.finalChecks,FINAL_RULES);
    const finalPending=[...f.pending];
    for(const [key,label] of [['finalFile','최종 파일 위치'],['finalReviewer','최종 검수자']])if(!has(p[key]))finalPending.push(label);
    if(!hasDate(p.finalReviewedAt))finalPending.push('유효한 최종 검수일');
    let estimateCredits=0,estimateUnknown=0,actualCredits=0,actualUnknown=0;
    for(const s of p.shots){
      if(s.sourceType==='generated') { if(s.quotedCredits===null||s.plannedTakes<=0)estimateUnknown++;else estimateCredits+=s.quotedCredits*s.plannedTakes; }
      if(s.actualCredits===null) { if(s.sourceType==='generated'||s.actualTakes>0)actualUnknown++; } else actualCredits+=s.actualCredits;
    }
    return {planMissing,shots,finalFailed:f.failed,finalPending,ready:!planMissing.length&&shots.length>0&&shots.every(s=>s.reviewed)&&!f.failed.length&&!finalPending.length,estimateCredits,estimateUnknown,actualCredits,actualUnknown,usedSeconds,budgetExceeded:p.budgetCredits!==null&&Math.max(estimateCredits,actualCredits)>p.budgetCredits};
  }
  function invalidateShot(shot,phase='all') {
    if(!isObject(shot))return shot;
    shot.review=cleanChecks(shot.review,SHOT_RULES);
    for(const r of SHOT_RULES)if(phase==='all'||r.phase===phase)shot.review[r.id]={status:'pending',note:shot.review[r.id].note};
    shot.reviewer='';shot.reviewedAt='';return shot;
  }
  function invalidateFinal(project) {
    if(!isObject(project))return project;
    project.finalChecks=cleanChecks(project.finalChecks,FINAL_RULES);
    for(const r of FINAL_RULES)project.finalChecks[r.id]={status:'pending',note:project.finalChecks[r.id].note};
    project.finalReviewer='';project.finalReviewedAt='';return project;
  }
  function invalidateContinuity(project) {
    if(!isObject(project))return project;
    for(const shot of Array.isArray(project.shots)?project.shots:[]){
      if(!isObject(shot))continue;
      shot.review=cleanChecks(shot.review,SHOT_RULES);
      shot.review.continuity={status:'pending',note:shot.review.continuity.note};
      shot.reviewer='';shot.reviewedAt='';
    }
    return invalidateFinal(project);
  }
  function importState(value) {
    let raw=value;if(typeof value==='string'){try{raw=JSON.parse(value);}catch{throw new Error('JSON 형식의 검수 기록 또는 PULSE 전달서를 선택해 주세요.');}}
    if(!isObject(raw))throw new Error('검수 기록 또는 PULSE 제작 전달서가 필요합니다.');
    if(own(raw,'version'))return sanitize(raw);
    if(raw.schema!=='synk-production-handoff'||raw.schemaVersion!==1||!isObject(raw.clientProvided))throw new Error('지원하지 않는 파일입니다. 검수 기록 또는 PULSE 제작 전달서 JSON을 선택해 주세요.');
    const d=raw.clientProvided,p=defaults(),c=isObject(raw.continuity)?raw.continuity:{};
    p.title=str(d.subject);p.audience=str(d.audience);p.message=str(d.message);
    p.targetSeconds=numeric(d.duration,3600)??0;p.aspect=Array.isArray(d.ratios)?str(d.ratios[0],30):'';p.resolution=str(d.resolution,30);
    p.continuity=[c.primaryProduct,c.productFacts,c.productLocks,c.identityRules,c.baselineNotes,c.requiredNotices].filter(has).join('\n');
    const assets=Array.isArray(raw.assetManifest)?raw.assetManifest:[];
    p.shots=(Array.isArray(raw.shotPlan)?raw.shotPlan:[]).slice(0,200).filter(isObject).map(v=>{
      const s=newShot(),req=isObject(v.clientRequirements)?v.clientRequirements:{};
      s.title=str(v.label);s.purpose=str(v.purpose)||str(req.mustShow);s.startState=str(v.startState);s.action=str(v.action);s.endState=str(v.endState);s.continuity=str(v.physicalContinuity);
      const refs=Array.isArray(v.referenceAssetIds)?v.referenceAssetIds:[];
      s.sourceRef=assets.filter(a=>isObject(a)&&refs.includes(a.assetId)).map(a=>str(a.name)).filter(has).join('\n')||str(d.assetLink)||str(d.productUrl);
      s.settingNote=[has(req.mustShow)?'고객 요청: '+str(req.mustShow):'',has(req.avoid)?'고객이 피할 것: '+str(req.avoid):'',has(v.nextRevision)?'다음 수정: '+str(v.nextRevision):''].filter(Boolean).join('\n');
      s.duration=0;s.generationSeconds=0;return s;
    });
    if(!p.shots.length)p.shots=[newShot()];
    return sanitize(p);
  }
  const show=v=>has(v)?v.trim():'미정';
  function promptForShot(project,shot) {
    const p=sanitize(project),s=cleanShot(shot);
    return ['이 문서는 제작 지시 초안입니다. 참조 파일을 실제로 확인하고 모델 화면에 수동 적용합니다. 생성·품질 합격을 보장하지 않습니다.','',
      '작품: '+show(p.title),'대상과 핵심 메시지: '+show(p.audience)+' / '+show(p.message),'시청자가 얻을 것: '+show(p.viewerReward),'컷: '+show(s.title)+' / 목적: '+show(s.purpose),
      '소스 방식: '+s.sourceType,'실사·구도·소스 참조: '+show(s.sourceRef),'인물·제품 정체성 참조: '+show(s.identityRef),'조명·소재·질감 참조: '+show(s.styleRef),'검수 기준 이미지 파일: '+show(s.referenceFile),
      '시작 상태: '+show(s.startState),'한 가지 관찰 가능한 핵심 행동: '+show(s.action),'끝 상태: '+show(s.endState),'빛과 그림자: '+show(s.lighting),'구도와 카메라: '+show(s.camera),
      '공통 연속성: '+show(p.continuity),'이번 컷의 연속성: '+show(s.continuity),'소리·대사: '+show(s.sound),
      '보존: 승인 인물·제품의 형태·색·의상·로고를 유지하고, 참조마다 지정한 역할을 지킨다. 손·발·소품 접촉과 움직임의 원인·결과를 확인한다.',
      '수동 선택 모델: '+show(s.model),'채택 길이 / 생성 길이: '+s.duration+'초 / '+s.generationSeconds+'초','출력: '+show(p.aspect)+' / '+show(p.resolution),'기타 설정: '+show(s.settingNote),
      '검수: 정지 이미지의 빛·구도·질감 확인 후 생성한다. 완성 클립은 실제 속도로 끝까지 재생하고 소리를 직접 듣는다. 실패 원인과 다음에 바꿀 한 가지를 기록한다.'].join('\n');
  }
  const md=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/([\\`*_{}\[\]|])/g,'\\$1');
  function report(raw) {
    const p=sanitize(raw),e=evaluate(p),lines=['# '+md(p.title||'영상 제작 검수 기록'),'','이 기록은 사람이 입력한 계획·검수 상태입니다. 프로그램이 영상의 자연스러움이나 품질을 자동 분석한 결과가 아니며, 검수 완료가 게시·배포 완료를 뜻하지 않습니다.','',
      '- 상태: '+(e.ready?'검수 기록 완료':'미완료'),'- 대상: '+md(show(p.audience)),'- 핵심 메시지: '+md(show(p.message)),'- 시청 보상: '+md(show(p.viewerReward)),
      '- 목표 / 채택 구간 합계: '+p.targetSeconds+'초 / '+e.usedSeconds+'초','- 출력: '+md(p.aspect)+' / '+md(p.resolution),'- 예상 생성 비용: '+e.estimateCredits+'크레딧 (견적 미정 '+e.estimateUnknown+'컷)','- 실제 차감: '+e.actualCredits+'크레딧 (기록 미정 '+e.actualUnknown+'컷)','- 예산: '+(p.budgetCredits===null?'미정':p.budgetCredits+'크레딧')+(e.budgetExceeded?' · 입력된 비용이 예산 초과':''),'- 공통 연속성: '+md(show(p.continuity)),''];
    if(e.planMissing.length)lines.push('계획 보완: '+e.planMissing.map(md).join(', '),'');
    const statusNames={pending:'검수 전',pass:'통과 기록',fix:'수정 필요',na:'해당 없음'};
    const addRules=(rules,values)=>{for(const r of rules){const v=values[r.id];lines.push('- '+r.label+': '+statusNames[v.status]+(v.status==='na'&&!validCheck(r,v)?' (유효하지 않음: 허용 항목과 이유 필요)':'')+' — '+md(v.note||'관찰 근거·타임코드 미기록'));}};
    p.shots.forEach((s,i)=>{const ev=e.shots[i];lines.push('## '+(i+1)+'. '+md(s.title||'이름 없는 컷'),'','상태: '+ev.status,'','- 파일: '+md(show(s.file)),'- 검수자 / 일시: '+md(show(s.reviewer))+' / '+md(show(s.reviewedAt)),'- 채택 / 생성 길이: '+s.duration+'초 / '+s.generationSeconds+'초','- 견적 / 예정 횟수: '+(s.quotedCredits===null?'미정':s.quotedCredits+'크레딧')+' / '+s.plannedTakes+'회','- 실제 차감 / 실제 횟수: '+(s.actualCredits===null?'미정':s.actualCredits+'크레딧')+' / '+s.actualTakes+'회','',...promptForShot(p,s).split('\n').map(line=>'> '+md(line)),'');if(ev.planMissing.length)lines.push('계획 보완: '+ev.planMissing.map(md).join(', '),'');addRules(SHOT_RULES,s.review);lines.push('');});
    lines.push('## 완성본 검수','','- 최종 파일: '+md(show(p.finalFile)),'- 검수자 / 일시: '+md(show(p.finalReviewer))+' / '+md(show(p.finalReviewedAt)),'');addRules(FINAL_RULES,p.finalChecks);return lines.join('\n');
  }
  return {VERSION,SHOT_RULES,FINAL_RULES,defaults,newShot,sanitize,importState,evaluateShot,evaluate,invalidateShot,invalidateFinal,invalidateContinuity,promptForShot,report};
});
