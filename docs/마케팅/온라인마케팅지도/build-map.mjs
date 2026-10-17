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
const contentLines = read('inputs/content-lines.json');
const proposal = read('account-setup-proposal.json');
const registry = JSON.parse(fs.readFileSync(path.join(repo,'docs/마케팅/sns-계정.json'),'utf8').replace(/^\uFEFF/,''));
const social = read('intl-social/execution-20260920.json');
const youtube = read('intl-youtube/publication.json');
const jpVnYoutube = read('jp-vn-profile/publication.json');
const original = read('dashboard/src/data.json');
const platformNames = {youtube:'YouTube',instagram:'Instagram',tiktok:'TikTok',facebook:'Facebook',telegram:'Telegram',threads:'Threads',linkedin:'LinkedIn',x:'X',behance:'Behance','naver-clip':'Naver Clip',naverclip:'Naver Clip',naverblog:'Naver Blog','naver-blog':'Naver Blog',tistory:'Tistory',pinterest:'Pinterest',kakao:'KakaoTalk','kakao-channel':'KakaoTalk',substack:'Substack',rutube:'RUTUBE',xiaohongshu:'rednote',douyin:'Douyin',vk:'VK'};
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
const legacyIds = new Set(inventory.accounts.filter(row => row.accountStatus !== 'web-destination').map(row => row.id));
const proposalIds = new Set(proposal.channels.map(row => row.id));
const expansion = Object.entries(registry.accounts).filter(([id]) => !legacyIds.has(id));
const confirmedYouTubeCount = expansion.filter(([,row]) => row.platform === 'youtube').length;
const confirmedSocialCount = expansion.length - confirmedYouTubeCount;
const unconfirmedExpansionCount = proposal.channels.length - expansion.length;
const socialById = new Map(social.channels.map(row => [row.id,row]));
const youtubeById = new Map([...youtube.channels,...jpVnYoutube.channels].map(row => [row.id,row]));
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
const statusText = {
  'blocked-creator-rate-limit':['문자 요청 제한 · 개설 미확인','공식 제한 해소 후 가입 상태 확인'],
  'user-submitted-signup-generic-error':['가입 오류 · 생성 미확인','공식 가입 오류 확인 후 계정 생성 여부 재점검'],
  'blocked-shared-instagram-signup-gate':['개별 가입 미시도','공식 가입 경로 확인 후 개별 계정 시도'],
  'blocked-google-login-allocation-required':['독립 로그인 미배정','로그인 배정 후 국가 계정 개설 확인'],
  'blocked-phone-already-used-user-reported':['기존 번호 충돌 보고 · 생성 미확인','기존 번호 연결 상태 확인'],
  'user-deferred-until-20260922-repeated-code-expiry':['인증 코드 만료 보고 · 생성 미확인','공식 인증 상태와 계정 독립성 확인'],
  'personal-account-confirmed-by-user-screenshot-lab-channel-pending':['개인 계정 확인 · LAB 채널 미확인','LAB 커뮤니티 생성·공개 확인']
};
const newSlots = proposal.channels.map(slot => {
  const account = registry.accounts[slot.id];
  const observed = socialById.get(slot.id);
  const youtubeRecord = youtubeById.get(slot.id);
  const confirmed = Boolean(account);
  const youtubeConfirmed = confirmed && slot.platform === 'YouTube';
  const rednote = slot.id === 'lab-cn-xiaohongshu';
  const [unconfirmedStatus,unconfirmedAction] = statusText[observed?.status] || ['개설·생성 미확인','가입·운영 조건과 실제 계정 확인'];
  const sourcePaths = ['docs/마케팅/온라인마케팅지도/account-setup-proposal.json',
    ...(youtubeConfirmed ? ['docs/마케팅/sns-계정.json',slot.id === 'lab-jp-youtube' || slot.id === 'lab-vn-youtube' ? 'docs/마케팅/온라인마케팅지도/jp-vn-profile/publication.json' : 'docs/마케팅/온라인마케팅지도/intl-youtube/publication.json'] : []),
    ...(observed ? ['docs/마케팅/온라인마케팅지도/intl-social/execution-20260920.json',...(confirmed ? ['docs/마케팅/sns-계정.json'] : [])] : [])];
  return {
    id:slot.id,brand:'LAB',sourceBrand:'LAB',country:slot.country,countryCode:slot.countryCode,platform:slot.platform,
    handle:account?.handle || (rednote ? `rednote ID ${account.platformDisplayId}` : null),
    publicUrl:account?.publicUrl || youtubeRecord?.url || null,loginAlias:account?.loginAlias || null,
    accountStatus:confirmed ? 'confirmed-expansion' : 'planned',channelScope:confirmed ? '확장 확보' : '확장 미확인',
    setupStatus:confirmed ? (rednote ? '본인 계정 확인 · LAB 프로필 미완' : '계정·프로필 확인') : unconfirmedStatus,
    profileStatus:confirmed ? (rednote ? 'LAB 소개·사진 미반영' : youtubeConfirmed ? '소개·사진 공개 확인' : '소개·사진 확인 기록') : '계정 미확인',
    coverStatus:confirmed ? (youtubeConfirmed ? '커버 공개 확인' : rednote ? '시안 준비 · 미반영' : '커버 미확인·미반영') : '계정 미확인',
    avatarStatus:account?.avatarStatus || null,profileStatusCode:account?.profileStatus || observed?.status || null,
    priority:'우선 플랫폼',publishStatus:confirmed ? '새 학습 콘텐츠 게시 미확인' : '계정 미확인',publicationEvidence:null,sharedLabel:'',
    channelRole:'현지 한국어 학습 콘텐츠',
    nextAction:confirmed ? (rednote ? '앱 편집 화면에서 LAB 이름·소개·사진 반영 확인' : youtubeConfirmed ? '원어민 감수와 학습 영상 준비; 게시 시 재확인' : '커버·링크 등 남은 프로필 작업과 학습 콘텐츠 준비') : unconfirmedAction,
    lastEvidenceAt:account?.avatarVerifiedAt || account?.publicUrlVerifiedAt || youtubeRecord?.verifiedAt || (youtubeConfirmed && jpVnYoutube.verifiedAt) || (confirmed ? registry.updatedAt : observed?.lastAccessAttemptAt || null),
    sourceLabel:sourcePaths.join('\n'),sourcePaths,
    verificationScope:rednote ? '로그인된 본인 프로필 확인 · 비로그인 공개 확인 아님' : youtubeConfirmed ? '공개 프로필 확인 기록' : confirmed ? '계정별 점검 기록' : '개설 미확인',
    observedGate:observed?.status || null,
    youtubeProfileVerified:Boolean(youtubeRecord && (youtubeRecord.publicVerified || youtubeRecord.publicReloadVerified))
  };
});
const channels = [...existing,...newSlots];
const countries = production.countries.map(country => ({
  id:`country-${country.code}`,code:country.code,country:country.name,brand:'LAB',platformsLabel:country.platforms.join(' · '),
  existingCount:channels.filter(row => (row.countryCode === country.code || row.country === country.name) && row.brand === 'LAB' && ['operating','confirmed-expansion'].includes(row.accountStatus)).length,
  existingLabel:country.code === 'MN' ? '기존 5개 · 우선 2 + 추가 3' : `확장 확보 ${newSlots.filter(row => row.countryCode === country.code && row.accountStatus === 'confirmed-expansion').length}/2`,
  setupStatus:country.code === 'MN' ? '기존 5개 기록 확인' : `확장 확보 ${newSlots.filter(row => row.countryCode === country.code && row.accountStatus === 'confirmed-expansion').length}/2`,
  scriptStatus:'한국어 원본 검토',translationStatus:'최종 번역 미확인',localReviewStatus:'현지 검수 미확인',
  contentStatus:country.code === 'MN' ? '기존 초안 있음 · 한국어 재검토' : '한국어 원본 확정 후 현지화',
  publishStatus:'새 콘텐츠 게시 미확인',appStatus:'출시 계획 · 공개 출시 미확인',
  nextAction:country.code === 'MN' ? '기존 5개 채널 유지. 한국어 L2 한 편을 먼저 완성하고 몽골어 현지 검수를 진행한다.' : '확보한 프로필과 미확인 계정의 상태를 각각 확인한 뒤 번역·현지 검수와 게시를 준비한다.',
  condition:country.localConditionsStatus,
  sourceLabel:'2026-09-20 대화의 국가별 2플랫폼 계획 · 수요 순위 아님'
}));
const brandSeed = [...plan.brands.slice(0,3),{id:'YUHO',name:'유호 · 제작 기록',role:'SYNK를 만드는 유호의 제작·협업 기록',market:'한국어 중심 · 여러 브랜드를 다루는 개인 트랙',channelPolicy:'브랜드와 분리한 탐색용 트랙 · 기존 계정 유지',nextAction:'L1·S1 출연 영상은 다른 세션에서 제작',legalEntity:'사람·제작 기록 트랙'},...plan.brands.slice(3)];
const brands = brandSeed.map(brand => ({...brand,brand:brand.id,
  nextAction:brand.id === 'YUHO' ? '연재 1편의 육성·최종 검토 후 게시본 준비' : brand.id === 'SHIFT' ? 'synkbrief 활용법 1편의 음성·자료 전달 경로 검토' : brand.nextAction,
  ownedCount:existing.filter(row => row.brand === brand.id && row.channelScope === '기존 운영').length,
  securedExpansionCount:brand.id === 'LAB' ? expansion.length : 0,
  sharedCount:operating.filter(row => (row.id === 'lab-youtube' && brand.id === 'PULSE') || (row.id === 'synklab-substack' && ['LAB','SHIFT'].includes(brand.id))).length,
  plannedSlots:brand.id === 'LAB' ? 46 : null
}));
const tasks = [
  {id:'task-l2',brand:'LAB',country:'한국어 원본',title:'L2 한 편 완성',state:'우선 진행',nextAction:'10대 초보자 대상의 한국어 구성부터 함께 검토'},
  {id:'task-mn',brand:'LAB',country:'몽골',title:'기존 5개 채널 연결 보존',state:'기존 기록 확인',nextAction:'새 게시 시 실제 계정·언어·프로필 확인'},
  {id:'task-global',brand:'LAB',country:'몽골 외 22개국',title:`확장 ${unconfirmedExpansionCount}곳 개설·생성 확인`,state:`${expansion.length}곳 확보 · ${unconfirmedExpansionCount}곳 미확인`,nextAction:'Instagram 오류·TikTok 로그인·중국 인증·VK 브랜드 채널을 계정별로 확인'},
  {id:'task-rednote',brand:'LAB',country:'중국',title:'rednote LAB 프로필',state:'본인 계정 확인 · 프로필 미완',nextAction:'앱 편집 화면에서 이름·소개·까몽 사진 반영 후 확인'},
  {id:'task-localize',brand:'LAB',country:'23개국',title:'번역·현지 검수·플랫폼별 제작',state:'원본 확정 후',nextAction:'국가와 언어를 동일시하지 않고 현지화 언어부터 확정'},
  {id:'task-access',brand:'공통',country:'로그인 6개',title:'현재 연결과 소유권 확인',state:'역할 제안 · 미적용',nextAction:'확인된 연결은 보존하고 미확인 권한·복구 수단 조사'},
  {id:'task-clip',brand:'YUHO',country:'한국',title:'Naver Clip 소개 / 블로그 모바일 배경',state:'사용자 보류',nextAction:'각 채널에 콘텐츠를 업로드할 때 처리'},
  {id:'task-videos',brand:'YUHO·SHIFT',country:'한국',title:'yuhobuilds·synkbrief 검토 영상',state:'로컬 제작 · 게시 전',nextAction:'음성·최종 검토 후 채널별 게시 패키지와 실제 게시 확인'},
  {id:'task-face',brand:'LAB·YUHO',country:'다른 세션',title:'기존 출연 영상 L1·S1',state:'제작 결과 미확인',nextAction:'별도 영상의 실제 촬영·편집 결과 확인'},
  {id:'task-app',brand:'LAB',country:'23개국',title:'학습 앱 국가별 출시',state:'계획 · 출시 미확인',nextAction:'SNS 운영과 별도로 스토어·언어·접속·정책 조건 확인'}
];
const summary = [
  {id:'existing',label:'기존 운영 대상',value:operating.length,unit:'채널',note:'공개 발행 대상 22곳 + 개인 연락 1곳'},
  {id:'lab-secured',label:'LAB 확장 확보',value:expansion.length,unit:'곳',note:`YouTube ${confirmedYouTubeCount} + 기타 SNS ${confirmedSocialCount} · 게시 수 아님`},
  {id:'lab-pending',label:'LAB 확장 미확인',value:unconfirmedExpansionCount,unit:'곳',note:'개설 또는 브랜드 채널 확인 필요'},
  {id:'lab-world',label:'LAB 대상 국가',value:countries.length,unit:'개국',note:'전체 관리 계획 49자리 · 몽골 기존 5 포함'}
];
const destinations=inventory.accounts.filter(row=>row.accountStatus === 'web-destination').map(row=>({...row,handle:row.handle || row.publicUrl?.replace(/^https?:\/\//,''),role:'공식 웹 경로 · SNS 아님',state:'경로 기록 · 이번 작업에서 공개 재검증 안 함'}));
destinations.push({id:'product-talk',brand:'LAB',handle:'SYNK-talk',publicUrl:null,role:'학습·기록 제품 · SNS 아님',state:'별도 앱 제작·출시 트랙'});
const contents = [...production.contents,
  {id:'YB-EP01',brand:'YUHO',title:'yuhobuilds · 6월부터의 제작 여정 1편',format:'세로 영상 검토본',scriptStatus:'실화 기반 원고·자막 57개 준비',productionStatus:'76초 MP4 제작·전체 디코드 확인',publishStatus:'외부 게시 없음 · 직접 청취·최종 승인 전',scopeOwner:'유호 제작 트랙',nextAction:'육성 교체와 최종 검토 후 4개 우선 채널용 게시본 확인',approvalStatus:'unknown',currentExternalStatus:'not-published-in-record',sourcePaths:['docs/마케팅/yuhobuilds_1편_쇼츠수정_20260922/README.md']},
  {id:'SB-EP01',brand:'SHIFT',title:'synkbrief · 회의 메모 활용법 1편',format:'세로 영상·따라 하기 자료 검토본',scriptStatus:'18장면·자막 47개·10쪽 PDF 준비',productionStatus:'140.33초 MP4/WebM 제작·전체 디코드 확인',publishStatus:'SNS 게시 없음 · 직접 청취 품질 승인 전',scopeOwner:'SHIFT 정보 트랙',nextAction:'음성 최종 검토·자료 전달 경로 확인 후 3개 채널 게시본 준비',approvalStatus:'unknown',currentExternalStatus:'not-published-in-record',sourcePaths:['docs/마케팅/synkbrief_회의메모_20260921/video-v12/README.md']}
  ,...contentLines.lines
];
const identityUses = {
  founder:'TikTok For Business 지원 로그인 확인 · 국가별 Business Center·광고 계정은 미생성',
  'synk-yuh':'미얀마 LAB TikTok·러시아 RUTUBE 연결 기록',
  unmet27:'베트남 LAB TikTok 연결 기록 · 다른 국가 가입 완료는 미확인',
  unmet23:'유호 TikTok·LAB 신규 YouTube 14곳·rednote 로그인 기록',
  '77yuhbs':'몽골 LAB TikTok·일본/베트남 LAB YouTube 연결 기록',
  unmet25:'synkbrief TikTok·LinkedIn 개인과 회사 페이지 연결 기록'
};
const identities = plan.identities.map(row => ({...row,
  loginType:row.id === 'synk-yuh' ? 'Google 계정 · 주소 확인 기록' : row.loginType,
  currentUse:identityUses[row.id] || row.currentUse
}));
const baseFiles=['docs/마케팅/sns-계정.json','docs/마케팅/SNS_계정_전체목록_20260919.md','docs/마케팅/프로필최신화_20260919/반영_v6.json','docs/마케팅/프로필최신화_20260919/실행상태.json'];
const expansionFiles=['docs/마케팅/온라인마케팅지도/account-setup-proposal.json','docs/마케팅/온라인마케팅지도/intl-social/execution-20260920.json','docs/마케팅/온라인마케팅지도/intl-youtube/publication.json','docs/마케팅/온라인마케팅지도/jp-vn-profile/publication.json'];
const generatedAt=new Date().toISOString();
function query(label,rows,files,definitions=[]){return {rows,source:{label,files,executedAt:generatedAt,classification:'로컬 계정·제작 기록 및 확장 계획',filters:['2026-09-19~23 로컬 근거 · 이번 갱신에서 실시간 SNS 조회 아님'],metricDefinitions:definitions,caveats:['미확인은 0·미존재·실패가 아니다.','계정 확보·프로필 확인·콘텐츠 제작·게시·성과는 별도 상태다.'],evidenceFlow:[{title:'입력 자료',detail:files.join(' / ')},{title:'대조 방법',detail:'기존 26행과 확장 44자리를 ID로 대조하고 확인된 24곳만 확보로 표시. 23개국 계획은 LAB에만 연결.'}]},methods:[{language:'javascript',code:'docs/마케팅/온라인마케팅지도/build-map.mjs — 로컬 계정 레지스트리·실행 원장·제작 기록과 국가 계획을 ID로 대조해 화면 자료를 생성'}]};}
const snapshot={id:original.id,surface:'dashboard',title:'SYNK 온라인 마케팅 지도',generatedAt,status:'reviewed-local-records',buildStatus:process.argv.includes('--complete')?'complete':'updating',
  filters:[
    {id:'brand',label:'브랜드·트랙',field:'brand',defaultValue:'all',queryIds:['channels']},
    {id:'country',label:'LAB 국가',field:'country',defaultValue:'all',queryIds:['countries']},
    {id:'channelCountry',label:'국가·범위',field:'country',defaultValue:'all',queryIds:['channels']},
    {id:'channelScope',label:'운영 분류',field:'channelScope',defaultValue:'all',queryIds:['channels']},
    {id:'platform',label:'플랫폼',field:'platform',defaultValue:'all',queryIds:['channels']},
    {id:'contentBrand',label:'콘텐츠 브랜드',field:'brand',defaultValue:'all',queryIds:['contents']}
  ],queries:{
    brands:query('회사·브랜드 원문과 확보 계정의 탐색 분류',brands,['docs/마케팅_정본.md',...baseFiles,...expansionFiles],[{label:'기존 운영 채널',definition:'2026-09-19 계정 목록의 23개를 주 분류에 한 번씩 집계한다. YUHO는 별도 법인이 아닌 제작 기록 트랙.'},{label:'확장 확보',definition:'몽골 외 LAB 44자리 중 계정 레지스트리에 실재 확인된 24곳. 게시·성과 수가 아니다.'},{label:'공유 연결',definition:'LAB YouTube의 PULSE 라디오 공유와 SYNK Substack의 LAB·SHIFT 공유만 집계한다.'}]),
    summary:query('기존 운영 대상과 LAB 확장 확인 상태',summary,[...baseFiles,...expansionFiles],[{label:'LAB 전체 계획',definition:'23개국 우선 46자리 + 몽골 추가 3자리 = 49자리. 그중 기존 몽골 5자리, 확장 확보 24자리, 확장 미확인 20자리.'}]),
    countries:query('LAB 23개국별 확보 상태와 제작 계획',countries,['docs/마케팅/온라인마케팅지도/inputs/content-status.json',...expansionFiles]),
    channels:query('기존 26개 등록 항목과 LAB 44개 확장 자리',channels,[...baseFiles,...expansionFiles]),
    contents:query('기존 첫 콘텐츠 계획, 2026-09-23까지의 제작 검토본, 2026-09-27 콘텐츠 라인 9개',contents,['docs/마케팅/온라인마케팅지도/inputs/content-status.json','docs/마케팅/온라인마케팅지도/inputs/content-lines.json','docs/마케팅/콘텐츠_운영체계_20260927.md','docs/마케팅/첫콘텐츠_재작성_20260919/원고별_검수와_구성.md','docs/마케팅/yuhobuilds_1편_쇼츠수정_20260922/README.md','docs/마케팅/synkbrief_회의메모_20260921/video-v12/README.md']),
    identities:query('확인된 로그인 연결 기록과 미적용 역할 제안',identities,['docs/마케팅/온라인마케팅지도/inputs/plan.json','docs/마케팅/sns-계정.json','docs/마케팅/온라인마케팅지도/intl-social/execution-20260920.json','docs/마케팅/온라인마케팅지도/intl-youtube/publication.json']),
    tasks:query('최신 계정·제작 기록에 따른 남은 작업',tasks,[...expansionFiles,'docs/마케팅/yuhobuilds_1편_쇼츠수정_20260922/README.md','docs/마케팅/synkbrief_회의메모_20260921/video-v12/README.md']),
    destinations:query('SNS와 분리하는 공식 웹·제품 도착지',destinations,['docs/마케팅/SNS_계정_전체목록_20260919.md'])
  }};
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
assert(operating.length===23,'운영 대상 23개 대조 실패');
assert(countries.length===23 && newSlots.length===44,'국가/확장 자리 수 오류');
assert(proposalIds.size===44 && expansion.every(([id])=>proposalIds.has(id)),'확장 확보 원장과 44자리 불일치');
assert(social.counts.created+social.counts.notCreated===28 && social.channels.length===28 && confirmedSocialCount===social.counts.created,'국제 SNS 원장 집계 불일치');
assert(newSlots.filter(row=>row.accountStatus==='confirmed-expansion').length===expansion.length && newSlots.filter(row=>row.accountStatus==='planned').length===unconfirmedExpansionCount,'확장 확보·미확인 집계 불일치');
assert(channels.filter(row=>row.country==='몽골').length===5,'몽골 기존 5개 보존 실패');
assert(new Set(channels.map(row=>row.id)).size===channels.length,'채널 ID 중복');
assert(contents.length===16+contentLines.lines.length && contentLines.lines.length===9,'콘텐츠 원고·제작 기록 16개 + 콘텐츠 라인 9개 대조 실패');
assert(plan.identities.length===6,'로그인 계정 6개 대조 실패');
assert(channels.filter(row=>row.accountStatus==='planned').every(row=>row.brand==='LAB' && !row.publicUrl && !row.loginAlias),'미확인 자리를 계정으로 잘못 표시');
assert(newSlots.filter(row=>row.platform==='YouTube' && row.accountStatus==='confirmed-expansion').length===confirmedYouTubeCount && confirmedYouTubeCount===youtube.completionAudit.newChannelsComplete+jpVnYoutube.channels.length,'YouTube 확장 확보 대조 실패');
for(const file of new Set(inventory.accounts.flatMap(row=>row.sourcePaths)))assert(fs.existsSync(path.join(repo,file)),`원자료 없음: ${file}`);
fs.writeFileSync(path.join(dir,'dashboard/src/data.json'),JSON.stringify(snapshot,null,2)+'\n');
// 원천 지문은 줄끝을 LF로 접어 잰다. Windows 작업본(CRLF)과 리눅스 서버·CI(LF)가 같은 값을 내야 한다(10-17).
const lfSha256=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,file),'utf8').replace(/\r\n/g,'\n')).digest('hex');
const manifest={generatedAt,sourceAsOf:{registry:registry.updatedAt,social:social.asOf,latestContent:'2026-09-27'},counts:{operating:operating.length,mongolia:5,plannedCountries:23,prioritySlots:46,newSlots:44,expansionConfirmed:expansion.length,expansionUnconfirmed:unconfirmedExpansionCount,channelRows:channels.length,contents:contents.length,identities:6},hashFormat:'sha256-utf8-lf',files:['inputs/plan.json','inputs/existing-accounts.json','inputs/content-status.json','inputs/content-lines.json','../콘텐츠_운영체계_20260927.md','account-setup-proposal.json','../sns-계정.json','../SNS_계정_전체목록_20260919.md','../프로필최신화_20260919/반영_v6.json','intl-social/execution-20260920.json','intl-youtube/publication.json','jp-vn-profile/publication.json','../yuhobuilds_1편_쇼츠수정_20260922/README.md','../synkbrief_회의메모_20260921/video-v12/README.md'].map(file=>({file,sha256:lfSha256(file)}))};
fs.writeFileSync(path.join(dir,'verification-data.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest.counts));
