// 기획 엔진이 만드는 글 모으기: node engine-texts.mjs <회사 폴더> <출력 .json>
// 주제만 · 다 채움 · 개인화 · 개인 참고 · 회사 벤치마크(오래됨·모름·지정 시리즈 다름) · 제작 여정(경험 있음) · 유형 열 개마다 기획안과 내려받기 글을 만들고,
// 사람이 읽는 글을 겹치지 않게 모아 「~니다」로 끝나는 문장 수와 함께 남긴다. 입력값에는 「~니다」를 쓰지 않아 셈에 섞이지 않는다.
import {writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const [companyArg,outArg]=process.argv.slice(2);
const {getContentCatalog,generateContentIdeas,renderBriefMarkdown}=await import(pathToFileURL(join(resolve(companyArg),'content-engine.mjs')).href);
const catalog=getContentCatalog();
const filled={audience:'첫 업무를 맡은 동료',experience:'회의 메모에서 담당자를 다시 찾느라 20분이 걸렸다',proof:'원본 메모와 정리 화면',takeaway:'담당자 문장을 원문에서 찾아 맞춰 보기',entertainment:'같은 이름이 메모와 표에서 이어지는 순간',
  authenticity:{basis:'메모를 다시 읽은 일은 직접 겪음',ownPerspective:'표 모양보다 근거를 먼저 본다',limits:'메모에 없는 기한은 만들지 않는다',disclosure:'예시 메모는 가상 자료'}};
const personalization={situation:'10분 안에 할 일을 보내야 하는 신입',choice:'담당자가 있으면 맞춰 보고 없으면 묻기',nextStep:'내 메모 한 문장에 담당자와 기한 표시'};
const reference={url:'https://www.instagram.com/reel/example/',title:'분류 질문 참고',publishedAt:'2026-09-20',checkedAt:'2026-09-27',hook:'빠진 정보를 먼저 찾게 한다',structure:'혼자 고르기 → 원문 단서 → 맞춰 보기',payoff:'못 본 빈칸을 스스로 찾는다',brandFit:'업무 초보의 판단을 돕는다',adaptation:'음식 비교를 회의 메모 비교로',reactions:{views:null,likes:0}};
const scenarios=[
  ['주제만',{seriesId:'synkbrief-use',topic:'회의 메모에서 할 일 찾기'}],
  ['다 채움',{seriesId:'synkbrief-use',topic:'회의 메모에서 할 일 찾기',...filled}],
  ['다 채움+개인화+참고',{seriesId:'synkbrief-use',topic:'회의 메모에서 할 일 찾기',...filled,personalization,reference}],
  ['개인화 일부',{seriesId:'synkbrief-use',topic:'회의 메모에서 할 일 찾기',personalization:{situation:'한국어를 처음 배우는 사람'}}],
  ['참고 주소만',{seriesId:'synkbrief-use',topic:'회의 메모에서 할 일 찾기',reference:{url:reference.url}}],
  ['벤치마크 오래됨·지정 다름',{seriesId:'synkbrief-use',topic:'회의 메모에서 할 일 찾기',...filled,personalization,benchmark:{id:'issue-1',itemId:'item-1',title:'회사 참고 1호',rank:1,stale:true,seriesIds:['lab-expression']}}],
  ['벤치마크 상태 모름',{seriesId:'synkbrief-use',topic:'회의 메모에서 할 일 찾기',benchmark:{}}],
  ['벤치마크 다 채움',{seriesId:'synkbrief-use',topic:'회의 메모에서 할 일 찾기',...filled,personalization,reference,benchmark:{id:'issue-1',itemId:'item-1',title:'업무 참고',scope:'직접 본 릴스 8개',periodStart:'2026-09-20',periodEnd:'2026-09-27',researchedAt:'2026-09-27T00:00:00Z',selectionBasis:'우리 업무 대상에 맞는 설명 짜임',rank:2,stale:false,seriesIds:['synkbrief-use'],hook:reference.hook,structure:reference.structure,payoff:reference.payoff,brandFit:reference.brandFit,adaptation:reference.adaptation}}],
  ['제작 여정 경험 있음',{seriesId:'yuhobuilds',topic:'첫 자동화를 그만둘 뻔한 날',experience:'출석 버튼을 찾다가 메뉴가 많다는 걸 알았다',authenticity:{ownPerspective:'메뉴 수보다 첫 행동을 먼저 본다',limits:'다른 앱에서는 확인하지 않았다'}}],
  ...catalog.series.map(series=>[`유형 ${series.name}`,{seriesId:series.id,topic:'회의 메모에서 할 일 찾기'}])
];
const skip=new Set(['id','field','status','mode','seriesId','time']);
const strings=new Map();
const add=(value,where)=>{for(const line of String(value).split('\n')){const text=line.trim();if(!text)continue;if(!strings.has(text))strings.set(text,new Set());strings.get(text).add(where);}};
function walk(value,where,key=''){
  if(typeof value==='string'){if(!skip.has(key))add(value,where);return;}
  if(Array.isArray(value)){for(const item of value)walk(item,where,key);return;}
  if(value&&typeof value==='object')for(const [k,v] of Object.entries(value)){if(['input','benchmark','sourcePaths'].includes(k))continue;walk(v,where,k);}
}
for(const [name,input] of scenarios){const plan=generateContentIdeas(input);walk(plan,name);for(const line of renderBriefMarkdown(plan).split('\n'))add(line,name+' · 내려받기');}
for(const guideline of catalog.guidelines){add(guideline.title,'제작 기준');add(guideline.detail,'제작 기준');}
for(const series of catalog.series){for(const key of ['name','audience','concept','format'])add(series[key],'유형 '+series.name);for(const list of ['materials','guardrails'])for(const value of series[list])add(value,'유형 '+series.name);for(const angle of series.angles)for(const key of ['title','hook','angle','reward'])add(angle[key],'유형 '+series.name);}
const rows=[...strings].map(([text,where])=>({text,where:[...where].slice(0,3)}));
const formal=rows.filter(row=>/니다[.」)]?$|니다[.」]?\s|니다\b|니까[?]/.test(row.text));
await writeFile(resolve(outArg),JSON.stringify({count:rows.length,formalCount:formal.length,formal:formal.map(row=>row.text),rows},null,1));
console.log('글',rows.length,'「~니다」 든 글',formal.length);
