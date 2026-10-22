import {createHash} from 'node:crypto';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const KIND='researchProductionLinks';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key=(userId,entryId,index)=>hash([userId,entryId,index]);

export function researchProductionBrief(row,index){
  const r=row.research,g=r.productionGuide,a=r.applications[index];
  if(!a)throw fail('선택한 브랜드 적용 제안을 다시 확인해 주세요.',409);
  return [
    `제작 주제: ${a.idea}`,`브랜드: ${a.brand}`,
    `시청자가 볼 이유: ${r.viewerReason||g.appeal}`,
    `지금 만드는 이유: ${r.whyNow}`,
    '', '선택한 조사 원문',row.title,row.sourceUrl,
    `확인 시각: ${row.researchCheckedAt||row.checkedAt}`,
    `확인 범위: ${r.evidenceLevel}`,`한계: ${r.limitations}`,
    ...r.observedFacts.map(f=>`${f.text}\n${f.sourceUrl}`),
    '', '이번 편의 흐름',
    `첫 화면: ${a.zeroSecondHook}`,`시청자가 할 행동: ${a.action}`,
    `받아갈 것: ${a.reward}`,`맞춤 도구: ${a.personalizationTool}`,
    `브랜드 적용: ${g.brandAdaptation}`,
    '', '준비할 자료',...g.requiredAssets.map((v,i)=>`${i+1}. ${v}`),
    '', '제작 순서',...g.productionSteps.map(s=>`${s.order}. ${s.title}\n${s.instruction}`),
    '', '제작 뒤 확인',
    a.validation72h,
    '선택한 원문·자료·제작 순서를 이어서 사용한다. 영상·자료의 실제 사용 확인 후 게시 묶음을 준비한다.',
    '콘텐츠 선택은 공개 게시·유료 생성 승인이 아니다. 게시·자료·문구는 최종 묶음에서 검토한다.',
    '완성본은 기존 작업실에 등록하고 게시 주소·성과·댓글 자료를 같은 제작 건으로 연결한다.',
    '', `예상 제작 시간: ${Number.isSafeInteger(g.estimatedMinutes)?g.estimatedMinutes+'분 (조사 제안의 추정)':'미확인'}`,
    '추가 제작 비용: 미확인. 기존 구독 안의 작업과 추가 과금을 구분한다.',
  ].join('\n');
}

export function createResearchProductionService({store,research,studio,clock=()=>new Date().toISOString()}){
  function workspace(user){
    const source=research.workspace(user);
    const candidates=source.entries.filter(row=>row.productionReady&&!row.archived).map(row=>({
      entryId:row.id,title:row.title,sourceUrl:row.sourceUrl,checkedAt:row.researchCheckedAt||row.checkedAt,
      whyNow:row.research?.whyNow||'',viewerReason:row.research?.viewerReason||'',
      priority:row.research?.priority||'watch',usage:row.usage,
      applications:(row.research?.applications||[]).map((a,index)=>{
        const saved=store.get(KIND,key(user.id,row.id,index));let production=null;
        if(saved){try{production=studio.production(user,saved.productionId).production;}catch(e){if(![403,404].includes(e.status))throw e;}}
        return {index,brand:a.brand,title:a.idea,hook:a.zeroSecondHook,reward:a.reward,
          requiredAssets:row.research.productionGuide.requiredAssets,
          estimatedMinutes:row.research.productionGuide.estimatedMinutes??null,
          additionalCost:null,production:production?{id:production.id,stage:production.stage,nextAction:production.nextAction}:null};
      }),
    }));
    return {revision:source.revision,candidates};
  }
  function create(user,input){
    user=store.get('users',user?.id);
    if(!user?.active)throw fail('먼저 로그인해 주세요.',401);
    if(user.role==='viewer')throw fail('보기 전용 계정은 제작 건을 만들 수 없어요.',403);
    if(!input||!Array.isArray(input.items)||input.items.length<1||input.items.length>7||
      Object.keys(input).some(k=>!['items','revision'].includes(k)))throw fail('이번에 제작할 양식을 1~7개 선택해 주세요.');
    const items=input.items.map(item=>{
      if(!item||typeof item.entryId!=='string'||item.entryId.length>100||!Number.isSafeInteger(item.applicationIndex)||item.applicationIndex<0||
        Object.keys(item).some(k=>!['entryId','applicationIndex'].includes(k)))throw fail('선택한 양식과 적용 제안을 확인해 주세요.');
      return item;
    });
    if(new Set(items.map(i=>i.entryId)).size!==items.length)throw fail('양식마다 적용 제안을 하나씩 선택해 주세요.');
    // A replay of a successful request can return its original rows even when
    // reserving the guides changed the revision. It still rechecks all access.
    const replay=items.map(i=>store.get(KIND,key(user.id,i.entryId,i.applicationIndex)));
    if(replay.every(Boolean)){
      const source=research.workspace(user);
      if(items.some(i=>!source.entries.some(e=>e.id===i.entryId)))throw fail('조사 자료를 다시 확인해 주세요.',404);
      return {productions:replay.map(r=>studio.production(user,r.productionId).production),existing:true};
    }
    if(typeof input.revision!=='string'||research.revision(user)!==input.revision)throw fail('그사이 조사 자료가 바뀌었으니 창을 닫았다가 다시 열어 골라 주세요.',409);
    return research.selectForProduction(user,items.map(i=>i.entryId),(rows,liveUser)=>{
      const productions=rows.map((row,index)=>{
        const item=items[index],id=key(liveUser.id,row.id,item.applicationIndex),saved=store.get(KIND,id);
        if(saved)return studio.production(liveUser,saved.productionId).production;
        const brief=researchProductionBrief(row,item.applicationIndex),application=row.research.applications[item.applicationIndex];
        const result=studio.saveProduction(liveUser,{
          title:application.idea.slice(0,200),stage:'idea',
          nextAction:'제작 준비 원문을 살펴보고 첫 제작안을 만든 뒤, 시청자가 실제로 보고 쓰는지 확인하기',
          initialBrief:brief,
        });
        store.put(KIND,id,{id,ownerId:liveUser.id,entryId:row.id,applicationIndex:item.applicationIndex,
          productionId:result.production.id,sourceHash:hash(row),createdAt:clock()});
        return result.production;
      });
      return {productions,existing:false};
    });
  }
  return {workspace,create};
}
