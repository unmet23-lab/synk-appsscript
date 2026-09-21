import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';

const dir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(dir,'../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(dir,name),'utf8').replace(/^\uFEFF/,''));
const plan = read('inputs/plan.json');
const inventory = read('inputs/existing-accounts.json');
const production = read('inputs/content-status.json');
const original = read('dashboard/src/data.json');
const platformNames = {youtube:'YouTube',instagram:'Instagram',tiktok:'TikTok',facebook:'Facebook',telegram:'Telegram',threads:'Threads',linkedin:'LinkedIn',x:'X',behance:'Behance','naver-clip':'Naver Clip',naverclip:'Naver Clip',naverblog:'Naver Blog','naver-blog':'Naver Blog',tistory:'Tistory',pinterest:'Pinterest',kakao:'KakaoTalk',substack:'Substack'};
const profileLabels = {
  'v6-saved-public-verified':'저장·공개 확인 기록',
  'v6-saved-editor-verified':'저장·편집화면 확인 기록',
  'v6-saved-settings-verified':'저장·설정화면 확인 기록',
  'v6-saved-profile-verified':'저장·프로필 확인 기록',
  'v6-user-short-copy-public-verified':'사용자 문구·공개 확인 기록',
  'v6-unsaved-deferred-by-user':'미반영 · 게시 때 수정',
  'not-applicable-unconfirmed-account':'개설 미확인',
  'not-applicable-uncreated-account':'개설 보류',
  'excluded-closure-not-performed':'운영 제외 · 삭제 아님'
};
const coverLabels = {
  'v4-public-verified-preserved':'커버 공개 확인 기록',
  'v4-desktop-public-verified-mobile-check-deferred':'PC 확인 · 모바일 보류',
  'v4-desktop-mobile-public-verified-preserved':'PC·모바일 확인 기록',
  'not-in-cover-refresh-scope':'이번 커버 작업 범위 밖',
  'not-applicable-unconfirmed-account':'개설 미확인',
  'not-applicable-uncreated-account':'개설 보류',
  'excluded-not-rechecked':'운영 제외 · 미확인'
};
const op = row => ['operating','operating-contact'].includes(row.accountStatus);
const operating = inventory.accounts.filter(op);
const existing = inventory.accounts.filter(row => row.accountStatus !== 'web-destination').map(row => ({
  ...row,
  sourceBrand:row.brand,
  brand:row.operatingScope === 'YUHO' ? 'YUHO' : row.brand,
  country:row.country || '공통·미분리',
  platform:platformNames[row.platform] || row.platform,
  channelScope:op(row) ? '기존 운영' : row.accountStatus === 'excluded-existing' ? '운영 제외' : '보류·개설 미확인',
  setupStatus:op(row) ? '기존 계정 기록' : row.accountStatus === 'excluded-existing' ? '운영 제외' : '개설 보류·미확인',
  profileStatus:profileLabels[row.profileStatus] || '미확인',
  profileStatusCode:row.profileStatus,
  coverStatus:coverLabels[row.coverStatus] || '미확인',
  priority:row.brand === 'LAB' ? (['lab-youtube','lab-instagram'].includes(row.id) ? '우선 플랫폼' : '기존 추가 채널 유지') : '기존 운영 분류',
  publishStatus:row.publishable ? '새 콘텐츠 게시 미확인' : '공개 발행 대상 아님',
  publicationEvidence:null,
  sharedLabel:(row.sharedBrands || []).join(' · '),
  sourceLabel:row.sourcePaths.join('\n')
}));
const planned = production.countries.flatMap(country => country.channelSlots.filter(slot => !slot.accountId).map(slot => ({
  id:`lab-${country.code.toLowerCase()}-${slot.platform.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,
  brand:'LAB',sourceBrand:'LAB',country:country.name,countryCode:country.code,platform:slot.platform,
  handle:null,publicUrl:null,loginAlias:null,accountStatus:'planned',channelScope:'신규 계획',setupStatus:'계정 준비 계획',profileStatus:'미착수',coverStatus:'미착수',
  priority:'우선 플랫폼',publishStatus:'미착수',publicationEvidence:null,sharedLabel:'',
  channelRole:'현지 한국어 학습 콘텐츠',nextAction:'가입·운영 조건 확인 → 로그인 배정 → 계정 세팅',
  lastEvidenceAt:null,sourceLabel:'2026-09-20 대화의 LAB 23개국 확장 계획',sourcePaths:['docs/마케팅/온라인마케팅지도/inputs/content-status.json']
})));
const channels = [...existing,...planned];
const countries = production.countries.map(country => ({
  id:`country-${country.code}`,code:country.code,country:country.name,brand:'LAB',platformsLabel:country.platforms.join(' · '),
  existingCount:operating.filter(row => row.country === country.name && row.brand === 'LAB').length,
  existingLabel:country.code === 'MN' ? '기존 5개 · 우선 2 + 추가 3' : '신규 2개 계획 · 기존 확인 없음',
  setupStatus:country.code === 'MN' ? '기존 5개 기록 확인' : '신규 세팅 계획',
  scriptStatus:'한국어 원본 검토',translationStatus:'최종 번역 미확인',localReviewStatus:'현지 검수 미확인',
  contentStatus:country.code === 'MN' ? '기존 초안 있음 · 한국어 재검토' : '한국어 원본 확정 후 현지화',
  publishStatus:'새 콘텐츠 게시 미확인',appStatus:'출시 계획 · 공개 출시 미확인',
  nextAction:country.code === 'MN' ? '기존 5개 채널 유지. 한국어 L2 한 편을 먼저 완성하고 몽골어 현지 검수를 진행한다.' : '국가별 가입·운영 조건과 번역 언어를 확인한 뒤 2개 채널의 로그인·소유권·프로필을 준비한다.',
  condition:country.localConditionsStatus,
  sourceLabel:'2026-09-20 대화의 국가별 2플랫폼 계획 · 수요 순위 아님'
}));
const brandSeed = [...plan.brands.slice(0,3),{id:'YUHO',name:'유호 · 제작 기록',role:'SYNK를 만드는 유호의 제작·협업 기록',market:'한국어 중심 · 여러 브랜드를 다루는 개인 트랙',channelPolicy:'브랜드와 분리한 탐색용 트랙 · 기존 계정 유지',nextAction:'L1·S1 출연 영상은 다른 세션에서 제작',legalEntity:'사람·제작 기록 트랙'},...plan.brands.slice(3)];
const brands = brandSeed.map(brand => ({...brand,brand:brand.id,
  ownedCount:existing.filter(row => row.brand === brand.id && row.channelScope === '기존 운영').length,
  sharedCount:operating.filter(row => (row.id === 'lab-youtube' && brand.id === 'PULSE') || (row.id === 'synklab-substack' && ['LAB','SHIFT'].includes(brand.id))).length,
  plannedSlots:brand.id === 'LAB' ? 46 : null
}));
const tasks = [
  {id:'task-l2',brand:'LAB',country:'한국어 원본',title:'L2 한 편 완성',state:'우선 진행',nextAction:'10대 초보자 대상의 한국어 구성부터 함께 검토'},
  {id:'task-mn',brand:'LAB',country:'몽골',title:'기존 5개 채널 연결 보존',state:'기존 기록 확인',nextAction:'새 게시 시 실제 계정·언어·프로필 확인'},
  {id:'task-global',brand:'LAB',country:'신규 22개국',title:'44개 신규 채널 자리 세팅',state:'계획',nextAction:'국가별 조건 확인 후 로그인·핸들·복구 방식 배정'},
  {id:'task-localize',brand:'LAB',country:'23개국',title:'번역·현지 검수·플랫폼별 제작',state:'원본 확정 후',nextAction:'국가와 언어를 동일시하지 않고 현지화 언어부터 확정'},
  {id:'task-access',brand:'공통',country:'로그인 6개',title:'현재 연결과 소유권 확인',state:'역할 제안 · 미적용',nextAction:'기존 연결 조사 후 소유자·운영자·백업 권한 분리'},
  {id:'task-clip',brand:'YUHO',country:'한국',title:'Naver Clip 소개 / 블로그 모바일 배경',state:'사용자 보류',nextAction:'각 채널에 콘텐츠를 업로드할 때 처리'},
  {id:'task-face',brand:'LAB·YUHO',country:'다른 세션',title:'출연 영상 L1·S1',state:'다른 세션 담당',nextAction:'다른 세션의 실제 촬영·편집 결과를 받아 기록'},
  {id:'task-app',brand:'LAB',country:'23개국',title:'학습 앱 국가별 출시',state:'계획 · 출시 미확인',nextAction:'SNS 운영과 별도로 스토어·언어·접속·정책 조건 확인'}
];
const summary = [
  {id:'existing',label:'기존 운영 대상',value:operating.length,unit:'채널',note:'공개 발행 대상 22곳 + 개인 연락 1곳'},
  {id:'lab-mn',label:'몽골 LAB 기존',value:operating.filter(row => row.country === '몽골' && row.brand === 'LAB').length,unit:'채널',note:'우선 2개와 기존 추가 3개 모두 유지'},
  {id:'lab-world',label:'LAB 확장 대상',value:countries.length,unit:'개국',note:'국가별 우선 2개 · 46개 운영 자리'},
  {id:'lab-new',label:'신규 국가 채널 계획',value:planned.length,unit:'자리',note:'몽골 외 22개국 · 아직 생성 완료 아님'}
];
const destinations=inventory.accounts.filter(row=>row.accountStatus === 'web-destination').map(row=>({...row,handle:row.handle || row.publicUrl?.replace(/^https?:\/\//,''),role:'공식 웹 경로 · SNS 아님',state:'경로 기록 · 이번 작업에서 공개 재검증 안 함'}));
destinations.push({id:'product-talk',brand:'LAB',handle:'SYNK-talk',publicUrl:null,role:'학습·기록 제품 · SNS 아님',state:'별도 앱 제작·출시 트랙'});
const baseFiles=['docs/마케팅/sns-계정.json','docs/마케팅/SNS_계정_전체목록_20260919.md','docs/마케팅/프로필최신화_20260919/반영_v6.json','docs/마케팅/프로필최신화_20260919/실행상태.json'];
const generatedAt=new Date().toISOString();
function query(label,rows,files,definitions=[]){return {rows,source:{label,files,executedAt:generatedAt,classification:'로컬 기록 및 대화 계획',filters:['2026-09-19~20 로컬 근거 · 실시간 SNS 조회 아님'],metricDefinitions:definitions,caveats:['미확인은 0·미존재·실패가 아니다.','운영 대상·프로필 저장·새 콘텐츠 게시·실제 성과는 별도 상태다.'],evidenceFlow:[{title:'입력 자료',detail:files.join(' / ')},{title:'대조 방법',detail:'현행 계정 ID 유지, 최신 반영 원장 우선, 23개국 계획은 LAB에만 연결. 공유 채널은 중복 제거.'}]},methods:[{language:'javascript',code:'docs/마케팅/온라인마케팅지도/build-map.mjs — 입력 JSON 3개를 읽어 정규화하고 집계. 실행: node build-map.mjs'}]};}
const snapshot={id:original.id,surface:'dashboard',title:'SYNK 온라인 마케팅 지도',generatedAt,status:'reviewed-local-records',buildStatus:process.argv.includes('--complete')?'complete':'creating',
  filters:[
    {id:'brand',label:'브랜드·트랙',field:'brand',defaultValue:'all',queryIds:['channels']},
    {id:'country',label:'LAB 국가',field:'country',defaultValue:'all',queryIds:['countries']},
    {id:'channelCountry',label:'국가·범위',field:'country',defaultValue:'all',queryIds:['channels']},
    {id:'channelScope',label:'운영 분류',field:'channelScope',defaultValue:'all',queryIds:['channels']},
    {id:'platform',label:'플랫폼',field:'platform',defaultValue:'all',queryIds:['channels']},
    {id:'contentBrand',label:'콘텐츠 브랜드',field:'brand',defaultValue:'all',queryIds:['contents']}
  ],queries:{
    brands:query('회사·브랜드 원문과 기존 계정의 탐색 분류',brands,['docs/마케팅_정본.md',...baseFiles],[{label:'기존 운영 채널',definition:'기록에서 각 계정의 주 탐색 분류에 한 번만 집계. 0은 해당 분류의 전용 운영 계정 기록 없음. YUHO는 별도 법인·브랜드가 아닌 제작 기록 트랙.'},{label:'공유 연결',definition:'LAB YouTube의 PULSE 라디오 공유와 SYNK Substack의 LAB·SHIFT 공유만 집계. 유호가 다룰 수 있는 다른 브랜드 소재는 공유 계정 수에 포함하지 않는다.'}]),
    summary:query('중복을 제외한 운영 대상과 LAB 확장 계획',summary,baseFiles,[{label:'신규 국가 채널 계획',definition:'23개국 × 우선 2플랫폼 = 46자리. 몽골 기존 우선 2자리를 제외한 신규 계획 44자리. 몽골 추가 3채널은 보존.'}]),
    countries:query('LAB 23개국 운영 계획',countries,['docs/마케팅/온라인마케팅지도/inputs/content-status.json','docs/마케팅/온라인마케팅지도/inputs/plan.json']),
    channels:query('기존 계정 원장과 LAB 신규 계획',channels,baseFiles),
    contents:query('첫 콘텐츠 원고·제작 기록과 현재 사용자 결정',production.contents,['docs/마케팅/온라인마케팅지도/inputs/content-status.json','docs/마케팅/첫콘텐츠_재작성_20260919/원고별_검수와_구성.md']),
    identities:query('사용자가 확인한 로그인 계정과 미적용 역할 제안',plan.identities,['docs/마케팅/온라인마케팅지도/inputs/plan.json','docs/마케팅/SNS_계정_전체목록_20260919.md']),
    tasks:query('사용자 결정과 남아 있는 작업',tasks,['docs/마케팅/온라인마케팅지도/inputs/plan.json','docs/_ops/트랙.md']),
    destinations:query('SNS와 분리하는 공식 웹·제품 도착지',destinations,['docs/마케팅/SNS_계정_전체목록_20260919.md'])
  }};
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
assert(operating.length===23,'운영 대상 23개 대조 실패');
assert(countries.length===23 && planned.length===44,'국가/신규 계획 수 오류');
assert(channels.filter(row=>row.country==='몽골').length===5,'몽골 기존 5개 보존 실패');
assert(new Set(channels.map(row=>row.id)).size===channels.length,'채널 ID 중복');
assert(production.contents.length===14,'콘텐츠 14개 대조 실패');
assert(plan.identities.length===6,'로그인 계정 6개 대조 실패');
assert(channels.filter(row=>row.channelScope==='신규 계획').every(row=>row.brand==='LAB' && !row.publicUrl && !row.loginAlias),'계획을 실제 계정으로 잘못 표시');
for(const file of new Set(inventory.accounts.flatMap(row=>row.sourcePaths)))assert(fs.existsSync(path.join(repo,file)),`원자료 없음: ${file}`);
fs.writeFileSync(path.join(dir,'dashboard/src/data.json'),JSON.stringify(snapshot,null,2)+'\n');
const manifest={generatedAt,asOf:plan.asOf,counts:{operating:operating.length,mongolia:5,plannedCountries:23,prioritySlots:46,newSlots:44,channelRows:channels.length,contents:14,identities:6},files:['inputs/plan.json','inputs/existing-accounts.json','inputs/content-status.json'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex')}))};
fs.writeFileSync(path.join(dir,'verification-data.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest.counts));
