import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../..');
if(await fs.access(path.join(here,'protocol.json')).then(()=>true,()=>false))throw new Error('Frozen pilot already exists; do not overwrite inputs or rerun this preparation.');
const require=createRequire(import.meta.url),Domain=require('../../../atlas/domain.js');
const sha=b=>createHash('sha256').update(b).digest('hex');
const source='C:/Users/q1212/Documents/SYNK-website/public-brand-stories.json';
const canonical=path.join(repo,'docs/마케팅/SHIFT.md');
const bytes=await fs.readFile(source),canonBytes=await fs.readFile(canonical);
const stories=JSON.parse(bytes),s=stories.shift;
const sections=[
 {id:'C1',name:'한 업무 중심 소개',locator:'shift.lead / shift.hero',content:{lead:s.lead,hero:s.hero}},
 {id:'C2',name:'적용 후보와 준비 상태',locator:'shift.sections[0] (atlas 제외)',content:Object.fromEntries(Object.entries(s.sections[0]).filter(([k])=>k!=='atlas'))},
 {id:'C3',name:'Atlas와 SHIFT 책임',locator:'shift.sections[0].atlas',content:s.sections[0].atlas},
 {id:'C4',name:'도입에 필요한 지원',locator:'shift.sections[id=shift-services]',content:s.sections.find(x=>x.id==='shift-services')},
 {id:'C5',name:'반복 공급 뒤 상품화',locator:'shift.sections[id=shift-expansion]',content:s.sections.find(x=>x.id==='shift-expansion')},
];
if(sections.some(x=>!x.content))throw new Error('Current source section missing');
const at=new Date().toISOString();
const contract={id:'shift.internal-copy-review',version:'1',purpose:'review-order',fields:[
 {id:'commonBoundary',kind:'boolean',maxAgeDays:1},
 {id:'narrowScope',kind:'boolean',maxAgeDays:1},
 {id:'laterLicensing',kind:'boolean',maxAgeDays:1},
],criteria:[
 {id:'common-boundary-first',field:'commonBoundary',feature:'commonBoundary',weight:2},
 {id:'focused-service',field:'narrowScope',feature:'narrowScope',weight:1},
 {id:'stage-order',field:'laterLicensing',feature:'laterLicensing',weight:1},
]};
const scope={domain:'SHIFT',workspace:'internal-copy-pilot-20261007',subject:'internal-requester'};
const declarations=[
 {id:'D1',field:'commonBoundary',value:true,text:'아틀라스엔진(초개인화 공동적용) + 앱이나 기능마다 기능 추가',meaning:'공통 개인화 능력과 전문 기능의 책임을 구분한다.'},
 {id:'D2',field:'narrowScope',value:true,text:'shift의 사업 범위도 (bm) 이걸로 좁혀주고 추 후 api나 엔진 라이선스 상품으로 넓히는 순서로 가자.',meaning:'한 업무의 도입·운영에 집중한다.'},
 {id:'D3',field:'laterLicensing',value:true,text:'shift의 사업 범위도 (bm) 이걸로 좁혀주고 추 후 api나 엔진 라이선스 상품으로 넓히는 순서로 가자.',meaning:'반복 공급 확인 뒤 API·라이선스로 확장한다.'},
];
const observations=declarations.map(({id,field,value})=>({id,field,value,scope,contract:{id:contract.id,version:contract.version,purpose:contract.purpose},source:'declared',at,refs:[id]}));
const features={C1:[false,true,false],C2:[false,true,false],C3:[true,true,false],C4:[false,true,false],C5:[false,true,true]};
const candidates=sections.map(({id})=>({id,features:Object.fromEntries(contract.fields.map((f,i)=>[f.id,features[id][i]]))}));
const decision=Domain.decide({contract,scope,observations,at,candidates});
const rubric=[
 ['R1','현재 사업 단위를 고객사 한 곳의 한 업무 도입·운영으로 다룬다.'],
 ['R2','네 적용 후보를 준비 중인 후보로 다루고 출시·계약 가능으로 확정하지 않는다.'],
 ['R3','교육·컨설팅·자동화·브랜딩을 개인화 도입의 지원 범위로 다룬다.'],
 ['R4','반복 공급과 실측 뒤 API·라이선스로 진행하는 순서를 지킨다.'],
 ['R5','기존 8개 엔진의 공통 능력·전문 모듈·SHIFT 도입·제품 운영의 책임을 구분한다.'],
 ['R6','실고객 성과·가격·일정·운영·동의를 확정하지 않고 note를 포함한 전체 문맥으로 판단한다.'],
];
// The Korean rubric is fixed before either review; no seeded faults or hidden answer key.
const common={task:'실제 SHIFT 로컬 홈페이지 원고 5구간의 사업 범위·준비 상태·성과 표현 검수',sections,canonical:{file:'docs/마케팅/SHIFT.md',text:canonBytes.toString('utf8').split(/\r?\n/).slice(0,67).join('\n')},rubric,completion:'5구간 모두 판정·근거를 남기고, 실제 불일치와 선택적 문장 개선을 구분한다. 근거 있는 문제 없음도 정상 완료. 오류를 일부러 만들거나 note를 떼어 과장으로 채점하지 않는다. 불일치가 있으면 최소 수정안, 없으면 유지 권고를 남긴다.',outputSchema:{sections:[{id:'C1..C5',decision:'유지 또는 수정 필요',rubricIds:['R1..R6'],evidence:'현재 원문 및 정본 위치',issue:null,optionalImprovement:null}],criticalDefects:[],proposedPatch:[],conclusion:'짧은 결론'},excluded:'공개 사이트 현행 검증·가격 결정·고객 운영·배포·인간 사용성 연구'};
await fs.mkdir(path.join(here,'input'),{recursive:true});
const write=(file,obj)=>fs.writeFile(path.join(here,file),JSON.stringify(obj,null,2)+'\n');
await fs.writeFile(path.join(here,'input/source.json'),bytes);
await fs.writeFile(path.join(here,'input/canonical.md'),canonBytes);
await write('input/common.json',common);
await write('input/atlas-decision.json',{declarations,policy:'중요도 2/1/1은 이번 검수의 제품 정책이며 사용자 능력·선호 강도·확률·효과를 측정한 값이 아니다. 현재 대화의 명시 요청만 사용하며 행동 이력·동의 프로필을 만들지 않는다.',decision});
await write('input/baseline.json',{common:'common.json',order:sections.map(x=>x.id),method:'현재 원고 순서의 공통 검수. Atlas 개인화 결과 없이 동일 정본·판정 기준 제공.'});
await write('input/personalized.json',{common:'common.json',order:decision.ranked.map(x=>x.id),method:'Core.domain이 현재 요청의 명시 우선사항을 반영한 검토 순서. 모든 구간의 동일 판정 기준 유지.',decision:'atlas-decision.json'});
const frozenFiles=['source.json','canonical.md','common.json','atlas-decision.json','baseline.json','personalized.json'];
await write('protocol.json',{id:'SHIFT-INTERNAL-COPY-20261007',frozenAt:at,kind:'AI-performed internal workflow comparison',realHumanTrial:false,customerTrial:false,paidProviderCalls:0,repeatCount:1,subjects:'동일 공식 Codex 하네스의 독립 AI 작업자 두 명. 요청별 추론과 서비스 지연이 달라 인과효과·성능 비교로 일반화하지 않음.',commonInput:'두 방식에 같은 원고·정본·완료 기준·출력 구조 제공. 개인화는 현재 대화의 명시 우선사항과 Core의 순서·이유만 추가.',timing:'각 작업자의 첫 시각 확인 도구부터 결과 파일 저장 직전의 실제 UTC까지 경과시간. 입력 읽기·추론·도구 지연 포함. 배정 전 대기·root 준비/후검증은 제외. 사람 작업시간·사용 시간 아님.',errors:'원문 검수에서 적중한 오류 수가 아니라, 완료된 검수 결과가 사전 R1..R6과 완료조건을 위반한 실질 오류 수를 root가 확인한다.',helpRequests:'AI 검수 작업자가 외부 도움을 요청해 검수가 중단됐는지 관측한다. 인간 고객응대 전환 여부는 관측 대상이 없어 공란.',cost:'모델 청구·대표 시간단가·준비/검증 총시간 미측정. 수익과 원가 잔액 계산 불가.',source:[{path:source,sha256:sha(bytes)},{path:canonical,sha256:sha(canonBytes)},{path:path.join(repo,'atlas/domain.js'),sha256:sha(await fs.readFile(path.join(repo,'atlas/domain.js')))}],input:frozenFiles.map(file=>({file:'input/'+file})),fixedRubric:rubric});
const protocol=JSON.parse(await fs.readFile(path.join(here,'protocol.json')));
for(const row of protocol.input)row.sha256=sha(await fs.readFile(path.join(here,row.file)));
await write('protocol.json',protocol);
console.log(JSON.stringify({frozenAt:at,order:decision.ranked.map(x=>x.id),sections:sections.length,sourceSHA:sha(bytes)},null,2));
