const fs = require('node:fs');
const path = require('node:path');
const base = __dirname;
const raw = path.join(base, 'supplementary-raw');
const meta = JSON.parse(fs.readFileSync(path.join(raw, 'metadata.json'), 'utf8').replace(/^\uFEFF/, ''));
const c = {
  2418520: {
    group: '밝은 생활 3D',
    graphics: '큰 작물·둥근 인물·선명한 색의 농장 3D. 지형과 소품의 형태가 명확하다.',
    costume: '아바타 의상과 트랙터 외형 꾸미기, 농장·실내 장식 공식 명시.',
    platforms: 'Steam Windows/macOS, Switch, PS5, Xbox One/Series. cross-play와 cross-save 공식 지원. 네이티브 모바일 미확인.',
    implication: '다양한 옷·소품을 유지하며 친구 공간을 방문하는 구조의 비교 기준.',
    sources: ['https://www.milkstonestudios.com/games/farm-together-2/', 'https://www.reddit.com/r/FarmTogether/comments/1kq791j/farm_together_2_console_roadmap/'],
  },
  2508780: {
    group: '밝은 생활 3D',
    graphics: '작은 체형의 애니메이션 인물, 풍성한 식생과 강한 초록색. 내려다보는 농장 화면.',
    costume: '의상 보너스·글라이더 외형 및 집·판매대 꾸미기 공식 명시. 세부 장착 슬롯 미검증.',
    platforms: 'Steam Windows, Switch/2, PS5, Xbox Series. 공식 1인용. 네이티브 모바일·cross-save 미확인.',
    implication: '작은 화면에서 농작물과 상호작용 대상을 구분하는 구성 참고. UI 밀도는 모바일에서 별도 조절 필요.',
    sources: ['https://www.storyofseasons.com/grandbazaar/'],
  },
  2209900: {
    group: '인형·장난감 3D',
    graphics: '보랏빛 야간·청록 식물·둥근 장난감 같은 오브젝트의 고딕 판타지 3D.',
    costume: '뱀파이어 외형과 고딕 집 꾸미기, 변신 공식 명시. 세부 의상 레이어 규칙 미검증.',
    platforms: 'Steam Windows/macOS, Switch/2, Android Google Play 출시 확인. iOS와 cross-save 미확인.',
    implication: '특유의 색·무드로 차별화한 모바일 포함 생활 게임. 모바일 리뷰의 발열·메뉴 조작 불만은 별도 성능 검증 필요성을 보여준다.',
    sources: ['https://www.moonlightpeaks.com/', 'https://play.google.com/store/apps/details?id=com.xseed.moonlightpeaks&hl=en_US'],
  },
  2016460: {
    group: '회화적 생활 3D',
    graphics: '붓질처럼 보이는 숲·나뭇잎·부드러운 흙색, 굽은 목재와 낮은 호빗 집의 동화적 3D.',
    costume: '호빗 외형·의상 커스터마이즈, 격자에 얽매이지 않는 실내 장식 공식 명시.',
    platforms: 'Steam Windows와 PS5 공식 출시 확인. Switch/Xbox Series는 과거 공식 발표 포함. 최신 모바일 출시와 cross-save는 미확인.',
    implication: '타운의 정서와 실내 꾸미기에 유용. 예전 Netflix 발표만으로 현재 모바일 지원을 판정하면 안 된다.',
    sources: ['https://talesoftheshire.com/', 'https://store.playstation.com/en-ca/concept/10010195', 'https://www.take2games.com/ir/news/tales-shire-lord-rings-game-launches-march-25-2025'],
  },
  2966320: {
    group: '애니메이션 생활 3D',
    graphics: '대표 홍보 스크린샷에서 밝은 하늘·물빛과 긴 비율의 애니메이션 인물, 섬 배경 확인.',
    costume: '공식 소개에 집·정원 꾸미기 확인. 대표 이미지의 모자·옷은 보이지만 장착 시스템 세부는 미검증.',
    platforms: 'Steam Windows와 Switch 2 공식 출시 확인. 다른 콘솔·네이티브 모바일·cross-save는 이번 부록에서 미검증.',
    implication: '2026년 생활 게임의 애니메이션 인물 방향 비교용. 보이는 옷만으로 조합 호환성을 추정하지 않는다.',
    sources: ['https://www.starsandisland.com/', 'https://www.nintendo.com/en-gb/Games/Nintendo-Switch-2-games/Starsand-Island-3173808.html'],
  },
  3146520: {
    group: '레트로·단순 3D',
    graphics: '픽셀화된 가장자리·넓은 단색 면·큰 눈의 동물, 단순한 나무와 해변의 레트로 3D.',
    costume: '장식 아이템·소품 수집, 캐릭터 표현과 온라인 낚시 공간 공식 명시.',
    platforms: 'Steam Windows 확인. 온라인 멀티플레이는 지원하나 모바일·콘솔 및 플랫폼 간 cross-play/cross-save 미확인.',
    implication: '낮은 시각적 복잡도와 외형 수집·친구 교류가 함께 성립하는 비교 기준. 리뷰 점수는 그래픽 단독 점수가 아니다.',
    sources: [],
  },
  1896700: {
    group: '밝은 생활 3D',
    graphics: '큰 눈·단순한 머리카락 덩어리·부드러운 명암의 인물과 정돈된 농장 3D.',
    costume: '의상 도안 구매→제작→착용/판매, 팔찌·귀걸이·목걸이·반지 변경과 사진 모드 공식 명시.',
    platforms: 'Steam Windows, Switch, PS5, Xbox Series/PC, Apple Arcade iPhone/iPad/Mac/TV/Vision. Apple iCloud 동기화 안내 존재. PC-모바일 cross-save는 미확인.',
    implication: '의상+액세서리를 실제 모바일 생활 게임에 연결한 유용한 선례. 주인공은 고정 인물 Tara.',
    sources: ['https://wyldeflowersgame.com/help.html', 'https://wyldeflowersgame.com/changes.html'],
  },
  2839280: {
    group: '애니메이션 생활 3D',
    graphics: '평평한 색면과 큰 눈의 만화 인물, 질감 있는 일본 소도시 배경의 결합.',
    costume: '주인공 중심 여름 탐험·채집·낚시. 자유 아바타·의상 장착은 이번 공식 설명에서 확인 못함.',
    platforms: 'Steam Windows와 Switch 공식 확인. Steam Deck 자이로 지원 문구는 휴대폰 지원을 뜻하지 않음.',
    implication: '한국어 타운의 소도시 정서·대화 장면 참고. 코스튬 시스템의 직접 선례로는 약하다.',
    sources: ['https://www.spike-chunsoft.co.jp/pages/natsumon/en/'],
  },
  1222670: {
    group: '인간형 생활 3D',
    graphics: '현실에 가까운 신체 비율에 만화적 표정·단순화한 머리카락, 생활 공간 중심 3D.',
    costume: '인물 외형·의상·성격과 집·가구의 광범위한 꾸미기 공식 명시.',
    platforms: 'Steam Windows; EA 앱 Windows/macOS, PlayStation, Xbox 확인. The Sims Mobile/FreePlay는 별도 작품. Sims 4 모바일판 미확인.',
    implication: '장기간 코스튬·가구 카탈로그 운영의 기준. SYNK 초기 제작량의 기준으로 삼기에는 범위가 크다.',
    sources: ['https://www.ea.com/games/the-sims/the-sims-4/buy'],
  },
  2408820: {
    group: '회화적 생활 3D',
    graphics: '각진 작은 캐릭터와 픽셀 질감처럼 보이는 조밀한 수풀, 위에서 보는 입체 섬.',
    costume: '옷장으로 의상·액세서리 교체, 농장 건축·장식 및 1~4인 협동 공식 명시.',
    platforms: 'Steam Windows 출시. PS5/Xbox Series 및 PC와의 cross-platform co-op은 공식 홈페이지에서 coming soon. 모바일·cross-save는 미확인.',
    implication: '작은 인물과 조밀한 배경의 가독성 균형 참고. 예정인 콘솔 지원을 실출시로 계산하지 않는다.',
    sources: ['https://www.lumaisland.com/'],
  },
  2918500: {
    group: '레트로·단순 3D',
    graphics: '큰 색면·작은 표정·단순한 팔다리와 종이 그림 같은 야자수의 가벼운 인상.',
    costume: '완구 수집·농작물·친구와의 활동 공식 명시. 코스튬 조합 세부는 미확인.',
    platforms: 'Steam Windows/macOS 확인. 네이티브 모바일·콘솔·cross-save 미확인.',
    implication: '손쉬워 보이는 형태로 여유로운 생활 분위기를 만드는 비교용. 단순해 보인다고 성능이 검증된 것은 아니다.',
    sources: [],
  },
  2997840: {
    group: '인형·장난감 3D',
    graphics: '둥근 동물과 큰 탈것, 평면적 식생·파스텔 하늘·따뜻한 조명으로 만든 타운 3D.',
    costume: '동물 외형·털무늬와 메카 코스메틱·스티커·도색, 마을 가구 꾸미기 공식 명시.',
    platforms: 'Steam Windows EA. 개발사 FAQ는 콘솔 향후 계획만 확인하며 플랫폼·시점 미정. 네이티브 모바일 미확인.',
    implication: '사람형이 아닌 마스코트의 자기표현과 타운 건설 참고. 리뷰 91개 표본은 성숙한 인기작과 동일 무게로 비교하지 않는다.',
    sources: ['https://www.animalkind.gg/faq'],
  },
  2993780: {
    group: '인형·장난감 3D',
    graphics: '큰 머리·짧은 팔다리·의상 실루엣이 명확한 SD 인물, 밝고 입체적인 판타지 배경.',
    costume: '직업·무기·의상·모자·신발 아이템, 집·마을·지형 꾸미기 공식 명시. 세부 레이어 호환 규칙 미검증.',
    platforms: 'Steam Windows, Switch/2, PS4/5, Xbox Series, iOS/Android(2026-08-20). 모바일 포함 cross-play와 cross-save 공식 지원. Epic 계정·플랫폼별 구매 조건 있음.',
    implication: '모바일+PC+콘솔에서 같은 생활·장비 경험을 제공하는 가장 직접적인 최신 비교 기준 중 하나.',
    sources: ['https://www.fantasylife.jp/fli/en/', 'https://www.fantasylife.jp/fli/en/ios-android/', 'https://www.fantasylife.jp/fli/en/guide/cross-save/'],
  },
  1657630: {
    group: '인형·장난감 3D',
    graphics: '젤리 같은 둥근 생물·강한 파스텔 반사색·풍성한 식물의 환상적인 3D.',
    costume: '목장·장치·생물 수집이 중심. 플레이어 전신 코스튬의 직접 선례로 확인하지 않음.',
    platforms: 'PC Steam/MS/Epic, PS5, Xbox Series. Xbox Cloud는 네이티브 모바일판과 구분. 2026 모바일 발표는 1편이며 2편 근거가 아님.',
    implication: '친근한 형태와 색의 풍성함 참고. 코스튬 및 모바일 직접 비교작으로 과대평가하지 않는다.',
    sources: ['https://slimerancher2.zendesk.com/hc/en-us/articles/19319060075155-Supported-Platforms', 'https://www.slimerancher.com/news/slime-rancher-now-on-mobile-/'],
  },
  1744970: {
    group: '인형·장난감 3D',
    graphics: '둥근 고양이·무광 단색 면·목가적인 섬, 커다란 말풍선과 가방 실루엣.',
    costume: '외형 커스터마이즈와 사진 촬영 공식 명시. 장착 슬롯·레이어 세부는 미검증.',
    platforms: 'Steam Windows, Switch, PS5, Xbox Series 공식 출시 링크 확인. 모바일 출시와 cross-save는 미확인.',
    implication: '작은 고양이 아바타·착용품·NPC 대화·사진을 묶는 경험 참고. Petit Planet과 다른 게임.',
    sources: ['https://www.soedesco.com/games/petit-island'],
  },
};
const evidenceMeta = [];
const rows = meta.map(m => {
  const d = JSON.parse(fs.readFileSync(path.join(raw, `${m.appid}-appdetails.json`), 'utf8').replace(/^\uFEFF/, ''))[m.appid].data;
  const ea = d.genres?.some(g => g.id === '70');
  const storeUrl = `https://store.steampowered.com/app/${m.appid}/`;
  const reviewUrl = `https://store.steampowered.com/appreviews/${m.appid}?json=1&language=all&purchase_type=all&filter=all&review_type=all&num_per_page=0`;
  const positive = m.reviews.total_positive;
  const total = m.reviews.total_reviews;
  const row = {appid:m.appid,name:m.name,release:m.release.date,comingSoon:m.release.coming_soon,...c[m.appid],positive,total,positivePct:Math.round(positive/total*1000)/10,url:storeUrl,shot:d.screenshots[0].path_full,reviewUrl,evidence:'공식 Steam 대표 스크린샷 시각 확인. 화면 표면 관찰이며 렌더링 기술·실기기 성능 검증 아님.',status:ea?'Early Access':'Released'};
  row.sources = [storeUrl, ...row.sources];
  if (ea) row.release += ' · EA';
  evidenceMeta.push({appid:m.appid,name:m.name,observedAt:m.observedAt,reviewFilter:{language:'all',purchase_type:'all',filter:'all',review_type:'all',num_per_page:0},appdetailsUrl:`https://store.steampowered.com/api/appdetails?appids=${m.appid}&l=english`,reviewUrl,appdetailsRaw:path.join(raw,`${m.appid}-appdetails.json`),reviewRaw:path.join(raw,`${m.appid}-reviews.json`),screenshotUrl:row.shot,screenshotLocal:path.join(raw,`${m.appid}-shot.jpg`),screenshotVisuallyInspected:true,additionalSources:row.sources.slice(1),platformScope:'Steam API OS and separately cited official platform pages. Steam Deck compatibility is not native Android/iOS support.',reviewInterpretation:'Lifetime all-language/all-purchase recommendation ratio, not a graphics rating or causal style preference.',limitations:'No game installed or tested on physical mobile devices. One representative screenshot per title; first Starsand screenshot is promotional composition.'});
  return row;
});
fs.writeFileSync(path.join(base,'supplementary-details.json'),JSON.stringify(rows,null,2));
fs.writeFileSync(path.join(raw,'detail-evidence.json'),JSON.stringify({observedAt:new Date().toISOString(),count:rows.length,sourceTimeZone:'UTC',releaseDateRule:'Steam appdetails date; may differ from regional/console/original release. EA explicitly marked.',outsideTagUnion:[2993780,1657630,1744970],rows:evidenceMeta,mobileReviewExamples:[{game:'Moonlight Peaks',source:'https://play.google.com/store/apps/details?id=com.xseed.moonlightpeaks&hl=en_US',reviewer:'Li Dali',date:'2026-09-05',paraphrase:'미감·이야기·플레이를 좋아하지만 Pixel 8 Pro에서 발열과 배터리 소모, 메뉴 조작에 불만.',scope:'개인 경험. 현재 모든 기기 성능이나 전체 여론을 대표하지 않음.'},{game:'Moonlight Peaks',source:'https://play.google.com/store/apps/details?id=com.xseed.moonlightpeaks&hl=en_US',reviewer:'AliceGale',date:'2026-09-06',paraphrase:'퀘스트·인물에 호의적이지만 발열과 모바일 미니게임 설명 부족을 지적.',scope:'개인 경험. 현재 모든 기기 성능이나 전체 여론을 대표하지 않음.'}]},null,2));
console.log(JSON.stringify({count:rows.length,file:path.join(base,'supplementary-details.json'),rows:rows.map(r=>({appid:r.appid,name:r.name,status:r.status,positivePct:r.positivePct,total:r.total}))},null,2));
