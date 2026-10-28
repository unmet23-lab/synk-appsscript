// 기기·계정별 학습 기록에서 최근 선택 반응만 가져온다. 글 원문·개인 정보·실력 판정은 넣지 않는다.
export const DATA_TARGETS=['trend','unit','comparison'];
export const semanticTarget=(target,skill)=>skill==='data.accuracy'&&DATA_TARGETS.includes(target)?target:'other';
const short=(v,n)=>typeof v==='string'&&v.trim()&&[...v].length<=n;
export function cleanSemanticDetail(v){
 if(!v||typeof v!=='object'||!/^w5[34]-[a-z0-9-]{1,70}$/.test(v.itemId)||!Number.isFinite(Date.parse(v.attempt)))return null;
 if(![...DATA_TARGETS,'other'].includes(v.target)||!short(v.prompt,220)||!short(v.selected,110)||!short(v.expected,110)||!short(v.explanation,280))return null;
 return {itemId:v.itemId,attempt:v.attempt,target:v.target,prompt:v.prompt,selected:v.selected,expected:v.expected,explanation:v.explanation};
}
export function semanticHistory(state,{now=Date.now()}={}){
 return state.obs.filter(o=>o.kind==='semantic'&&['check','practice'].includes(o.stage)&&Date.parse(o.at)<=now&&Date.parse(o.at)>=now-14*86400000)
  .flatMap(o=>{const d=cleanSemanticDetail(o.detail);if(!d)return [];return [{itemId:d.itemId,skill:o.skill,target:semanticTarget(d.target,o.skill),stage:o.stage,
   result:d.selected===d.expected?'selected-right':'selected-other',prompt:d.prompt,selected:d.selected,expected:d.expected,explanation:d.explanation}];}).slice(-4);
}
